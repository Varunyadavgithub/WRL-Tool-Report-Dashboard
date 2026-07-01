// One-off migration: copy every AuditTemplates row's JSON-file-backed content
// (and its AuditTemplateVersions history) into the new AuditTemplateContent
// table. Run manually, AFTER the schema migrations in config/migrations.js
// have applied (CurrentVersionContentId column + AuditTemplateContent table
// must already exist).
//
// Usage:
//   node scripts/migrateTemplatesToSql.js          (migrate)
//   node scripts/migrateTemplatesToSql.js --verify  (re-verify, no writes)
//
// Safe to re-run: every TemplateId is processed independently and skipped if
// it already has AuditTemplateContent rows (idempotent). Never deletes or
// modifies the legacy JSON files.
import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";
import { readTemplateFile, readTemplateFileRaw } from "../utils/storage/templateStorage.js";
import { computeTemplateHash, computeTemplateStats } from "../utils/storage/templateIntegrity.js";

const VERIFY_ONLY = process.argv.includes("--verify");

const canonicalize = ({ headerConfig, infoFields, columns, defaultSections }) =>
  JSON.stringify(
    {
      headerConfig: headerConfig ?? {},
      infoFields: infoFields ?? [],
      columns: columns ?? [],
      defaultSections: defaultSections ?? [],
    },
    null,
    2,
  );

const migrateOneTemplate = async (pool, parent, report) => {
  // Idempotency guard — skip templates already migrated on a prior run.
  const already = await pool.request()
    .input("templateId", sql.Int, parent.Id)
    .query(`SELECT COUNT(*) AS cnt FROM AuditTemplateContent WHERE TemplateId = @templateId`);
  if (already.recordset[0].cnt > 0) {
    report.skippedAlreadyMigrated.push(parent.Id);
    return;
  }

  const versionRows = (
    await pool.request()
      .input("templateId", sql.Int, parent.Id)
      .query(`SELECT * FROM AuditTemplateVersions WHERE TemplateId = @templateId ORDER BY CreatedAt ASC`)
  ).recordset;

  // Legacy rows with no AuditTemplateVersions history (pre-Phase-1, or never
  // read via getTemplateById's lazy-backfill) — synthesize a single version
  // directly from the parent row's own TemplateFileName.
  const chain = versionRows.length > 0
    ? versionRows
    : (parent.TemplateFileName
        ? [{
            Version: parent.Version || "01",
            TemplateFileName: parent.TemplateFileName,
            CreatedBy: parent.CreatedBy,
            CreatedAt: parent.CreatedAt,
          }]
        : []);

  if (chain.length === 0) {
    report.noContentFound.push({ id: parent.Id, name: parent.Name });
    return;
  }

  let previousContentId = null;
  let insertedAny = false;
  let activeContentId = null;

  for (let i = 0; i < chain.length; i++) {
    const v = chain[i];
    const config = await readTemplateFile(v.TemplateFileName).catch(() => null);
    if (!config) {
      report.fileMissing.push({ id: parent.Id, name: parent.Name, version: v.Version, fileName: v.TemplateFileName });
      continue;
    }

    const { headerConfig, infoFields, columns, defaultSections } = config;
    const canonical = canonicalize({ headerConfig, infoFields, columns, defaultSections });
    const contentHash = computeTemplateHash(canonical);
    const contentSize = Buffer.byteLength(canonical, "utf8");
    const stats = computeTemplateStats({ defaultSections: defaultSections ?? [] });

    // Sanity check against the figures already on record (computed by the
    // same computeTemplateStats function at original save time) — catches a
    // parse/shape mismatch even though the hash itself isn't comparable
    // (old hash covered the whole file incl. volatile metadata; new hash
    // covers only the four content fields).
    if (
      v.SectionCount != null &&
      (stats.sectionCount !== v.SectionCount ||
        stats.stageCount !== v.StageCount ||
        stats.checkpointCount !== v.CheckpointCount ||
        stats.requiredCheckpointCount !== v.RequiredCheckpointCount)
    ) {
      report.statMismatch.push({
        id: parent.Id, name: parent.Name, version: v.Version,
        recorded: { s: v.SectionCount, st: v.StageCount, c: v.CheckpointCount, r: v.RequiredCheckpointCount },
        recomputed: stats,
      });
    }

    const isActiveVersion = (v.Version === parent.Version) ? 1 : 0;
    const changeType = i === 0 ? "create" : "edit";

    const insertResult = await pool.request()
      .input("templateId", sql.Int, parent.Id)
      .input("version", sql.NVarChar(20), v.Version)
      .input("headerConfig", sql.NVarChar(sql.MAX), JSON.stringify(headerConfig ?? {}))
      .input("infoFields", sql.NVarChar(sql.MAX), JSON.stringify(infoFields ?? []))
      .input("columns", sql.NVarChar(sql.MAX), JSON.stringify(columns ?? []))
      .input("defaultSections", sql.NVarChar(sql.MAX), JSON.stringify(defaultSections ?? []))
      .input("contentHash", sql.NVarChar(64), contentHash)
      .input("contentSize", sql.Int, contentSize)
      .input("sectionCount", sql.Int, stats.sectionCount)
      .input("stageCount", sql.Int, stats.stageCount)
      .input("checkpointCount", sql.Int, stats.checkpointCount)
      .input("requiredCheckpointCount", sql.Int, stats.requiredCheckpointCount)
      .input("approvalStatus", sql.NVarChar(50), isActiveVersion ? (parent.ApprovalStatus || "draft") : "draft")
      .input("approvedBy", sql.NVarChar(200), isActiveVersion ? parent.ApprovedBy : null)
      .input("approvedAt", sql.DateTime, isActiveVersion ? parent.ApprovedAt : null)
      .input("rejectionReason", sql.NVarChar(sql.MAX), isActiveVersion ? parent.RejectionReason : null)
      .input("isActiveVersion", sql.Bit, isActiveVersion)
      .input("changeType", sql.NVarChar(20), changeType)
      .input("createdFromVersionId", sql.Int, previousContentId)
      .input("createdBy", sql.NVarChar(200), v.CreatedBy)
      .input("createdAt", sql.DateTime, v.CreatedAt)
      .query(`
        INSERT INTO AuditTemplateContent (
          TemplateId, Version, HeaderConfig, InfoFields, Columns, DefaultSections,
          ContentHash, ContentSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
          ApprovalStatus, ApprovedBy, ApprovedAt, RejectionReason,
          IsActiveVersion, ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.Id
        VALUES (
          @templateId, @version, @headerConfig, @infoFields, @columns, @defaultSections,
          @contentHash, @contentSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount,
          @approvalStatus, @approvedBy, @approvedAt, @rejectionReason,
          @isActiveVersion, @changeType, @createdFromVersionId, @createdBy, @createdAt
        );
      `);

    const newContentId = insertResult.recordset[0].Id;
    previousContentId = newContentId;
    insertedAny = true;
    if (isActiveVersion) activeContentId = newContentId;
  }

  if (!insertedAny) {
    report.noContentFound.push({ id: parent.Id, name: parent.Name });
    return;
  }

  // If none of the chain's versions matched the parent's current Version
  // string exactly (shouldn't normally happen), fall back to the most
  // recently inserted row as active so every migrated template ends up with
  // exactly one active version.
  if (!activeContentId) activeContentId = previousContentId;

  const activeRow = (await pool.request()
    .input("contentId", sql.Int, activeContentId)
    .query(`SELECT * FROM AuditTemplateContent WHERE Id = @contentId`)).recordset[0];

  await pool.request()
    .input("id", sql.Int, parent.Id)
    .input("contentId", sql.Int, activeContentId)
    .input("hash", sql.NVarChar(64), activeRow.ContentHash)
    .input("size", sql.Int, activeRow.ContentSize)
    .input("sectionCount", sql.Int, activeRow.SectionCount)
    .input("stageCount", sql.Int, activeRow.StageCount)
    .input("checkpointCount", sql.Int, activeRow.CheckpointCount)
    .input("requiredCheckpointCount", sql.Int, activeRow.RequiredCheckpointCount)
    .query(`
      UPDATE AuditTemplates
      SET CurrentVersionContentId = @contentId,
          TemplateHash = @hash, TemplateSize = @size,
          SectionCount = @sectionCount, StageCount = @stageCount,
          CheckpointCount = @checkpointCount, RequiredCheckpointCount = @requiredCheckpointCount
      WHERE Id = @id
    `);

  report.migrated.push(parent.Id);
};

const runMigration = async () => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const report = {
    migrated: [],
    skippedAlreadyMigrated: [],
    noContentFound: [],
    fileMissing: [],
    statMismatch: [],
  };

  const parents = (await pool.request().query(`SELECT * FROM AuditTemplates ORDER BY Id`)).recordset;
  console.log(`Found ${parents.length} AuditTemplates rows to process.`);

  for (const parent of parents) {
    try {
      await migrateOneTemplate(pool, parent, report);
    } catch (err) {
      console.error(`Failed to migrate TemplateId=${parent.Id} (${parent.Name}):`, err.message);
      report.noContentFound.push({ id: parent.Id, name: parent.Name, error: err.message });
    }
  }

  await pool.close();

  console.log("\n=== Migration summary ===");
  console.log("Migrated:", report.migrated.length, report.migrated);
  console.log("Already migrated (skipped):", report.skippedAlreadyMigrated.length, report.skippedAlreadyMigrated);
  console.log("No content found (manual review):", report.noContentFound.length, JSON.stringify(report.noContentFound, null, 2));
  console.log("File missing on disk (manual review):", report.fileMissing.length, JSON.stringify(report.fileMissing, null, 2));
  console.log("Stat mismatches (manual review):", report.statMismatch.length, JSON.stringify(report.statMismatch, null, 2));
};

const runVerify = async () => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const rows = (await pool.request().query(`SELECT * FROM AuditTemplateContent ORDER BY Id`)).recordset;
  console.log(`Verifying ${rows.length} AuditTemplateContent rows...`);

  let mismatches = 0;
  for (const row of rows) {
    const canonical = canonicalize({
      headerConfig: JSON.parse(row.HeaderConfig),
      infoFields: JSON.parse(row.InfoFields),
      columns: JSON.parse(row.Columns),
      defaultSections: JSON.parse(row.DefaultSections),
    });
    const recomputed = computeTemplateHash(canonical);
    if (recomputed !== row.ContentHash) {
      mismatches++;
      console.error(`MISMATCH: AuditTemplateContent.Id=${row.Id} (TemplateId=${row.TemplateId}, Version=${row.Version}) — stored=${row.ContentHash} recomputed=${recomputed}`);
    }
  }

  const parentCheck = await pool.request().query(`
    SELECT t.Id, t.Name FROM AuditTemplates t
    WHERE t.CurrentVersionContentId IS NULL
  `);
  console.log(`Templates with no CurrentVersionContentId set: ${parentCheck.recordset.length}`);
  if (parentCheck.recordset.length > 0) console.log(JSON.stringify(parentCheck.recordset, null, 2));

  await pool.close();

  console.log(`\nVerification complete. ${rows.length - mismatches}/${rows.length} content rows verified clean.`);
  if (mismatches > 0) {
    console.error(`${mismatches} hash mismatches found — review before relying on AuditTemplateContent as source of truth.`);
    process.exitCode = 1;
  }
};

if (VERIFY_ONLY) {
  await runVerify();
} else {
  await runMigration();
}
