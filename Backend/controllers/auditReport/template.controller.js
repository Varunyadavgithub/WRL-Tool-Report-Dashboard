import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateTemplateCode } from "../../utils/generateCode.js";
import {
  readTemplateFile,
  readTemplateFileRaw,
  deleteTemplateFile,
  backupTemplateFile,
  nextVersion,
} from "../../utils/storage/templateStorage.js";
import { computeTemplateHash, verifyTemplateHash, computeTemplateStats } from "../../utils/storage/templateIntegrity.js";
import { assembleContent, disassembleContent } from "../../utils/storage/templateContent.js";
import { validateTemplatePayload } from "../../utils/validation/templateSchema.js";
import { diffTemplateConfigs, flattenTemplateDiff } from "../../utils/diff/templateDiff.js";

const PARENT_COLUMNS = `
  Id, TemplateCode, TemplateFileName, Name, Description, Category, Version, IsActive,
  Models, ApprovalStatus, ApprovedBy, ApprovedAt, RejectionReason,
  TemplateHash, TemplateSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
  CurrentVersionContentId, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
`;

const EMPTY_CONTENT = { headerConfig: {}, infoFields: [], columns: [], defaultSections: [] };

// ── History helper ────────────────────────────────────────────────────────────
const logTemplateHistory = async (pool, { templateId, action, actionBy, comments, previousStatus, newStatus, fieldChanges, versionNumber, previousVersion, createdFromVersion }) => {
  try {
    await pool.request()
      .input("templateId",        sql.Int,      templateId)
      .input("action",            sql.NVarChar, action)
      .input("actionBy",          sql.NVarChar, actionBy  || "SYSTEM")
      .input("comments",          sql.NVarChar, comments  || null)
      .input("previousStatus",    sql.NVarChar, previousStatus || null)
      .input("newStatus",         sql.NVarChar, newStatus || null)
      .input("fieldChanges",      sql.NVarChar, fieldChanges ? JSON.stringify(fieldChanges) : null)
      .input("versionNumber",     sql.NVarChar(20), versionNumber || null)
      .input("previousVersion",   sql.NVarChar(20), previousVersion || null)
      .input("createdFromVersion",sql.NVarChar(20), createdFromVersion || null)
      .query(`
        INSERT INTO AuditTemplateHistory
          (TemplateId, Action, ActionBy, ActionAt, Comments, PreviousStatus, NewStatus, FieldChanges, VersionNumber, PreviousVersion, CreatedFromVersion)
        VALUES
          (@templateId, @action, @actionBy, GETDATE(), @comments, @previousStatus, @newStatus, @fieldChanges, @versionNumber, @previousVersion, @createdFromVersion)
      `);
  } catch (err) {
    console.warn("Failed to log template history:", err.message);
  }
};

// ── Content loading (SQL-backed, with legacy-file fallback for unmigrated rows) ──

// Loads the content for a parent row's ACTIVE version (or a specific
// historical version when requested). Migrated rows (CurrentVersionContentId
// set) read AuditTemplateContent exclusively — no file I/O. Unmigrated
// legacy rows (pre-Phase-5, not yet covered by scripts/migrateTemplatesToSql.js)
// fall back to the original JSON-file read so they keep behaving exactly as
// before, not worse.
const loadContentForTemplate = async (pool, parent, version = null) => {
  if (version && parent.CurrentVersionContentId) {
    const result = await pool.request()
      .input("templateId", sql.Int, parent.Id)
      .input("version", sql.NVarChar(20), version)
      .query(`SELECT TOP 1 * FROM AuditTemplateContent WHERE TemplateId = @templateId AND Version = @version`);
    if (result.recordset.length) return assembleContent(result.recordset[0]);
  }

  if (parent.CurrentVersionContentId) {
    const result = await pool.request()
      .input("contentId", sql.Int, parent.CurrentVersionContentId)
      .query(`SELECT TOP 1 * FROM AuditTemplateContent WHERE Id = @contentId`);
    if (result.recordset.length) return assembleContent(result.recordset[0]);
  }

  // Legacy fallback — row not yet migrated (or migration found no recoverable
  // file). Mirrors the pre-Phase-5 getTemplateById file-read behaviour.
  if (parent.TemplateFileName) {
    const config = await readTemplateFile(parent.TemplateFileName).catch(() => null);
    if (config) {
      return {
        headerConfig: config.headerConfig || {},
        infoFields: config.infoFields || [],
        columns: config.columns || [],
        defaultSections: config.defaultSections || [],
      };
    }
  }

  return { ...EMPTY_CONTENT };
};

const findActiveTemplateByName = async (pool, name) => {
  const result = await pool.request()
    .input("name", sql.NVarChar, name)
    .query(`SELECT TOP 1 ${PARENT_COLUMNS} FROM AuditTemplates WHERE LOWER(Name) = LOWER(@name) AND IsActive = 1 AND IsDeleted = 0`);
  return result.recordset[0] || null;
};

const getTemplateByIdInternal = async (pool, id) => {
  const result = await pool.request().input("id", sql.Int, id)
    .query(`SELECT ${PARENT_COLUMNS} FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
  if (!result.recordset.length) return null;
  const parent = result.recordset[0];
  const content = await loadContentForTemplate(pool, parent);
  return {
    ...parent,
    HeaderConfig: content.headerConfig,
    InfoFields: content.infoFields,
    Columns: content.columns,
    DefaultSections: content.defaultSections,
  };
};

// Get all templates
export const getAllTemplates = tryCatch(async (req, res) => {
  const { category, isActive, search, includeHistory, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const wantsHistory = includeHistory === "true";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted=0"];

  // Default to Active-only (spec: Template List shows active templates by
  // default). includeHistory=true or an explicit isActive param override this.
  if (isActive !== undefined) {
    request.input("isActive", sql.Bit, isActive === "true" ? 1 : 0);
    whereConditions.push("IsActive=@isActive");
  } else if (!wantsHistory) {
    whereConditions.push("IsActive=1");
  }

  if (category) {
    request.input("category", sql.NVarChar(100), category);
    whereConditions.push("Category = @category");
  }

  if (search) {
    request.input("search", sql.NVarChar, `%${search}%`);
    whereConditions.push("(Name LIKE @search OR Description LIKE @search)");
  }

  request.input("offset", sql.Int, offset);
  request.input("limit", sql.Int, parseInt(limit));

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    WITH TemplateData AS (
      SELECT ${PARENT_COLUMNS},
        ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) AS RowNum
      FROM AuditTemplates
      ${whereClause}
    )
    SELECT
      (SELECT COUNT(*) FROM TemplateData) AS TotalCount,
      *
    FROM TemplateData
    WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
  `;

  const result = await request.query(query);

  // Stat columns are computed once at version-creation time and already
  // cover what the list view needs. Only fall back to a file read for
  // legacy rows that have neither a CurrentVersionContentId nor stat columns.
  const templates = await Promise.all(
    result.recordset.map(async (template) => {
      let content = null;

      if (!template.CurrentVersionContentId && template.TemplateFileName && template.CheckpointCount == null) {
        content = await readTemplateFile(template.TemplateFileName).catch(() => null);
      }

      const row = {
        ...template,
        HeaderConfig: content?.headerConfig || null,
        InfoFields: content?.infoFields || [],
        Columns: content?.columns || [],
        DefaultSections: content?.defaultSections || [],
      };

      if (wantsHistory) {
        const versions = await pool.request()
          .input("templateId", sql.Int, template.Id)
          .query(`
            SELECT Version, IsActiveVersion, ApprovalStatus, CreatedBy, CreatedAt
            FROM AuditTemplateContent WHERE TemplateId = @templateId ORDER BY CreatedAt DESC
          `);
        row.versions = versions.recordset;
      }

      return row;
    }),
  );

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Templates retrieved successfully.",
    data: templates,
    totalCount: result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Pre-flight name-uniqueness check, used by the name-prompt popup before any
// builder session starts.
export const checkTemplateName = tryCatch(async (req, res) => {
  const { name } = req.query;
  if (!name) throw new AppError("Name query param is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const existing = await findActiveTemplateByName(pool, name);
    if (!existing) {
      return res.status(200).json({ success: true, exists: false, data: null });
    }
    const data = await getTemplateByIdInternal(pool, existing.Id);
    res.status(200).json({
      success: true,
      exists: true,
      message: `An active template named "${name}" already exists.`,
      data,
    });
  } finally {
    await pool.close();
  }
});

// Get template by ID
export const getTemplateById = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { version } = req.query;

  if (!id) throw new AppError("Template ID is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool.request().input("id", sql.Int, id)
      .query(`SELECT ${PARENT_COLUMNS} FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);

    if (result.recordset.length === 0) throw new AppError("Template not found", 404);

    const template = result.recordset[0];

    let content;
    if (template.CurrentVersionContentId) {
      // SQL-backed — source of truth, no file I/O, no hash-verify-against-disk
      // needed (SQL row durability replaces that threat model).
      content = await loadContentForTemplate(pool, template, version);
    } else {
      // Legacy, unmigrated row — preserve the original file-read + lazy
      // hash-backfill + integrity-check behaviour exactly.
      content = await loadLegacyContentWithBackfill(pool, template);
    }

    res.status(200).json({
      success: true,
      message: "Template retrieved successfully",
      data: {
        ...template,
        HeaderConfig: content.headerConfig,
        InfoFields: content.infoFields,
        Columns: content.columns,
        DefaultSections: content.defaultSections,
      },
    });
  } finally {
    await pool.close();
  }
});

// Legacy-row helper — identical logic to the pre-Phase-5 getTemplateById,
// kept only for rows the migration script could not recover (no JSON file
// found on disk). New rows always have CurrentVersionContentId and never hit
// this path.
const loadLegacyContentWithBackfill = async (pool, template) => {
  let config = null;
  if (template.TemplateFileName) {
    try {
      config = await readTemplateFile(template.TemplateFileName);
    } catch (err) {
      console.warn(`Could not load config for template ${template.Name}:`, err.message);
    }
  }

  if (config && !template.TemplateHash) {
    try {
      const rawString = await readTemplateFileRaw(template.TemplateFileName);
      if (rawString) {
        const hash = computeTemplateHash(rawString);
        const stats = computeTemplateStats(config);
        const size = Buffer.byteLength(rawString, "utf8");

        await pool.request()
          .input("id", sql.Int, template.Id)
          .input("hash", sql.NVarChar(64), hash)
          .input("size", sql.Int, size)
          .input("sectionCount", sql.Int, stats.sectionCount)
          .input("stageCount", sql.Int, stats.stageCount)
          .input("checkpointCount", sql.Int, stats.checkpointCount)
          .input("requiredCount", sql.Int, stats.requiredCheckpointCount)
          .query(`
            UPDATE AuditTemplates
            SET TemplateHash = @hash, TemplateSize = @size,
                SectionCount = @sectionCount, StageCount = @stageCount,
                CheckpointCount = @checkpointCount, RequiredCheckpointCount = @requiredCount
            WHERE Id = @id
          `);

        template.TemplateHash = hash;
        template.TemplateSize = size;
        template.SectionCount = stats.sectionCount;
        template.StageCount = stats.stageCount;
        template.CheckpointCount = stats.checkpointCount;
        template.RequiredCheckpointCount = stats.requiredCheckpointCount;
      }
    } catch (err) {
      console.warn(`Backfill failed for template ${template.Id}:`, err.message);
    }
  } else if (config && template.TemplateHash) {
    const rawString = await readTemplateFileRaw(template.TemplateFileName);
    const { valid, skipped } = verifyTemplateHash(rawString, template.TemplateHash);
    if (!valid && !skipped) {
      throw new AppError(
        "Template file integrity check failed — stored hash does not match file contents. Contact an administrator.",
        409,
      );
    }
  }

  return {
    headerConfig: config?.headerConfig || {},
    infoFields: config?.infoFields || [],
    columns: config?.columns || [],
    defaultSections: config?.defaultSections || [],
  };
};

// Create template — brand-new logical template (TemplateId), version "01".
// Name collisions never overwrite: they return a 200 {exists:true} pre-flight
// payload so the frontend can drive an Edit-Existing-vs-Cancel dialog.
export const createTemplate = tryCatch(async (req, res) => {
  const {
    name,
    description,
    category,
    isActive,
    approvalStatus,
    models,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
    createdByUser,
  } = req.body;

  if (!name) throw new AppError("Template name is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const existing = await findActiveTemplateByName(pool, name);
    if (existing) {
      const data = await getTemplateByIdInternal(pool, existing.Id);
      return res.status(200).json({
        success: true,
        exists: true,
        message: `An active template named "${name}" already exists.`,
        data,
      });
    }

    validateTemplatePayload({ headerConfig, infoFields, columns, defaultSections });

    const templateCode = await generateTemplateCode();
    const rawCreatedBy = req.user?.userCode || req.user?.name || createdByUser;
    const createdBy = (rawCreatedBy != null && String(rawCreatedBy).trim()) ? String(rawCreatedBy).trim() : "SYSTEM";

    const content = disassembleContent({ headerConfig, infoFields, columns, defaultSections });

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let template;
    let contentId;
    try {
      const result = await new sql.Request(transaction)
        .input("templateCode", sql.NVarChar(50), templateCode)
        .input("name", sql.NVarChar, name)
        .input("description", sql.NVarChar, description || null)
        .input("category", sql.NVarChar(100), category || null)
        .input("version", sql.NVarChar(20), "01")
        .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
        .input("approvalStatus", sql.NVarChar(50), approvalStatus || "draft")
        .input("models", sql.NVarChar, models ? JSON.stringify(models) : null)
        .input("createdBy", sql.NVarChar(200), createdBy)
        .input("templateHash", sql.NVarChar(64), content.hash)
        .input("templateSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .query(`
          INSERT INTO AuditTemplates (
            TemplateCode, Name, Description, Category, Version, IsActive,
            Models, ApprovalStatus, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt,
            TemplateHash, TemplateSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount
          )
          OUTPUT INSERTED.*
          VALUES (
            @templateCode, @name, @description, @category, @version, @isActive,
            @models, @approvalStatus, @createdBy, GETDATE(), @createdBy, GETDATE(),
            @templateHash, @templateSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount
          );
        `);
      template = result.recordset[0];

      const contentResult = await new sql.Request(transaction)
        .input("templateId", sql.Int, template.Id)
        .input("version", sql.NVarChar(20), "01")
        .input("headerConfig", sql.NVarChar(sql.MAX), content.headerConfigJson)
        .input("infoFields", sql.NVarChar(sql.MAX), content.infoFieldsJson)
        .input("columns", sql.NVarChar(sql.MAX), content.columnsJson)
        .input("defaultSections", sql.NVarChar(sql.MAX), content.defaultSectionsJson)
        .input("contentHash", sql.NVarChar(64), content.hash)
        .input("contentSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .input("approvalStatus", sql.NVarChar(50), approvalStatus || "draft")
        .input("createdBy", sql.NVarChar(200), createdBy)
        .query(`
          INSERT INTO AuditTemplateContent (
            TemplateId, Version, HeaderConfig, InfoFields, Columns, DefaultSections,
            ContentHash, ContentSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
            ApprovalStatus, IsActiveVersion, ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
          )
          OUTPUT INSERTED.Id
          VALUES (
            @templateId, @version, @headerConfig, @infoFields, @columns, @defaultSections,
            @contentHash, @contentSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount,
            @approvalStatus, 1, 'create', NULL, @createdBy, GETDATE()
          );
        `);
      contentId = contentResult.recordset[0].Id;

      await new sql.Request(transaction)
        .input("id", sql.Int, template.Id)
        .input("contentId", sql.Int, contentId)
        .query(`UPDATE AuditTemplates SET CurrentVersionContentId = @contentId WHERE Id = @id`);

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    await logTemplateHistory(pool, {
      templateId: template.Id,
      action: "created",
      actionBy: createdBy,
      versionNumber: "01",
      newStatus: approvalStatus || "draft",
      fieldChanges: [{ field: "Name", from: null, to: name }],
    });

    res.status(201).json({
      success: true,
      exists: false,
      message: "Template created successfully",
      data: {
        ...template,
        CurrentVersionContentId: contentId,
        HeaderConfig: headerConfig || {},
        InfoFields: infoFields || [],
        Columns: columns || [],
        DefaultSections: defaultSections || [],
      },
    });
  } finally {
    await pool.close();
  }
});

// Create a new version of an EXISTING logical template. The single source of
// truth for "editing" — never UPDATEs the previous version's content, always
// INSERTs a new AuditTemplateContent row and flips IsActiveVersion. The new
// version always starts at the approval status the client requests (default
// 'draft') — it never silently inherits the prior version's 'approved'
// status, mirroring Phase 3's forceRedraft precedent.
export const createTemplateVersion = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    models,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
    approvalStatus,
    createdByUser,
    basedOnVersion,
    changeType,
  } = req.body;

  if (!id) throw new AppError("Template ID is required", 400);
  validateTemplatePayload({ headerConfig, infoFields, columns, defaultSections });

  const rawUpdatedBy = req.user?.usercode || req.user?.name || req.user?.id || createdByUser;
  const updatedBy = (rawUpdatedBy != null && String(rawUpdatedBy).trim()) ? String(rawUpdatedBy).trim() : "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const parentResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT ${PARENT_COLUMNS} FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
    if (!parentResult.recordset.length) throw new AppError("Template not found", 404);
    const parent = parentResult.recordset[0];

    if (basedOnVersion && basedOnVersion !== parent.Version) {
      throw new AppError(
        `This template has changed since you loaded it (now at version ${parent.Version}). Please reload and retry.`,
        409,
      );
    }

    const oldContent = await loadContentForTemplate(pool, parent);
    const newVersion = nextVersion(parent.Version || "01");
    const content = disassembleContent({ headerConfig, infoFields, columns, defaultSections });

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let updatedParent;
    let newContentId;
    try {
      const contentResult = await new sql.Request(transaction)
        .input("templateId", sql.Int, id)
        .input("version", sql.NVarChar(20), newVersion)
        .input("headerConfig", sql.NVarChar(sql.MAX), content.headerConfigJson)
        .input("infoFields", sql.NVarChar(sql.MAX), content.infoFieldsJson)
        .input("columns", sql.NVarChar(sql.MAX), content.columnsJson)
        .input("defaultSections", sql.NVarChar(sql.MAX), content.defaultSectionsJson)
        .input("contentHash", sql.NVarChar(64), content.hash)
        .input("contentSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .input("approvalStatus", sql.NVarChar(50), approvalStatus || "draft")
        .input("changeType", sql.NVarChar(20), changeType || "edit")
        .input("createdFromVersionId", sql.Int, parent.CurrentVersionContentId || null)
        .input("createdBy", sql.NVarChar(200), updatedBy)
        .query(`
          INSERT INTO AuditTemplateContent (
            TemplateId, Version, HeaderConfig, InfoFields, Columns, DefaultSections,
            ContentHash, ContentSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
            ApprovalStatus, IsActiveVersion, ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
          )
          OUTPUT INSERTED.Id
          VALUES (
            @templateId, @version, @headerConfig, @infoFields, @columns, @defaultSections,
            @contentHash, @contentSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount,
            @approvalStatus, 1, @changeType, @createdFromVersionId, @createdBy, GETDATE()
          );
        `);
      newContentId = contentResult.recordset[0].Id;

      await new sql.Request(transaction)
        .input("templateId", sql.Int, id)
        .input("newContentId", sql.Int, newContentId)
        .query(`UPDATE AuditTemplateContent SET IsActiveVersion = 0 WHERE TemplateId = @templateId AND Id <> @newContentId`);

      const parentUpdateResult = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("version", sql.NVarChar(20), newVersion)
        .input("contentId", sql.Int, newContentId)
        .input("name", sql.NVarChar, name ?? parent.Name)
        .input("description", sql.NVarChar, description !== undefined ? (description || null) : parent.Description)
        .input("category", sql.NVarChar(100), category !== undefined ? (category || null) : parent.Category)
        .input("models", sql.NVarChar, models !== undefined ? JSON.stringify(models) : parent.Models)
        .input("approvalStatus", sql.NVarChar(50), approvalStatus || "draft")
        .input("updatedBy", sql.NVarChar(200), updatedBy)
        .input("templateHash", sql.NVarChar(64), content.hash)
        .input("templateSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .query(`
          UPDATE AuditTemplates
          SET Version = @version,
              CurrentVersionContentId = @contentId,
              Name = @name, Description = @description, Category = @category, Models = @models,
              ApprovalStatus = @approvalStatus, ApprovedBy = NULL, ApprovedAt = NULL, RejectionReason = NULL,
              TemplateHash = @templateHash, TemplateSize = @templateSize,
              SectionCount = @sectionCount, StageCount = @stageCount,
              CheckpointCount = @checkpointCount, RequiredCheckpointCount = @requiredCheckpointCount,
              UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE Id = @id;
        `);
      updatedParent = parentUpdateResult.recordset[0];

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const diff = diffTemplateConfigs(
      { defaultSections: oldContent.defaultSections },
      { defaultSections: defaultSections || [] },
    );

    await logTemplateHistory(pool, {
      templateId: parseInt(id),
      action: "version_created",
      actionBy: updatedBy,
      versionNumber: newVersion,
      previousVersion: parent.Version,
      createdFromVersion: parent.Version,
      previousStatus: parent.ApprovalStatus,
      newStatus: approvalStatus || "draft",
      fieldChanges: flattenTemplateDiff(diff),
    });

    res.status(201).json({
      success: true,
      message: `Version ${newVersion} created`,
      data: {
        ...updatedParent,
        HeaderConfig: headerConfig || {},
        InfoFields: infoFields || [],
        Columns: columns || [],
        DefaultSections: defaultSections || [],
      },
    });
  } finally {
    await pool.close();
  }
});

// Update template — status/metadata-only (approve / reject / submit /
// rename). Content changes must go through POST /templates/:id/version;
// this rejects any request that includes content fields, so a stale caller
// can never silently no-op a content change.
export const updateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    isActive,
    models,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
    approvalStatus,
    approvedBy,
    approvedAt,
    rejectionReason,
  } = req.body;

  if (!id) throw new AppError("Template ID is required", 400);

  const hasContentFields =
    headerConfig !== undefined || infoFields !== undefined ||
    columns !== undefined || defaultSections !== undefined;

  if (hasContentFields) {
    throw new AppError(
      "Content changes must be saved via POST /templates/:id/version, which creates a new version instead of overwriting the existing one.",
      400,
    );
  }

  const rawUpdatedBy = req.user?.usercode || req.user?.name || req.user?.id || req.body?.createdByUser;
  const updatedBy = (rawUpdatedBy != null && String(rawUpdatedBy).trim()) ? String(rawUpdatedBy).trim() : "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const checkResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT ${PARENT_COLUMNS} FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);

    if (checkResult.recordset.length === 0) throw new AppError("Template not found", 404);
    const currentTemplate = checkResult.recordset[0];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let template;
    try {
      const result = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .input("name", sql.NVarChar, name ?? currentTemplate.Name)
        .input("description", sql.NVarChar, description !== undefined ? (description || null) : currentTemplate.Description)
        .input("category", sql.NVarChar(100), category !== undefined ? (category || null) : currentTemplate.Category)
        .input("isActive", sql.Bit, isActive !== undefined ? (isActive !== false ? 1 : 0) : (currentTemplate.IsActive ?? 1))
        .input("approvalStatus", sql.NVarChar(50), approvalStatus || currentTemplate.ApprovalStatus || "draft")
        .input("approvedBy", sql.NVarChar(200), approvedBy !== undefined ? (approvedBy || null) : currentTemplate.ApprovedBy)
        .input("approvedAt", sql.DateTime, approvedAt !== undefined ? (approvedAt ? new Date(approvedAt) : null) : currentTemplate.ApprovedAt)
        .input("rejectionReason", sql.NVarChar, rejectionReason !== undefined ? (rejectionReason || null) : currentTemplate.RejectionReason)
        .input("models", sql.NVarChar, models !== undefined ? JSON.stringify(models) : null)
        .input("updatedBy", sql.NVarChar(200), updatedBy)
        .query(`
          UPDATE AuditTemplates
          SET
            Name = @name, Description = @description, Category = @category, IsActive = @isActive,
            ${models !== undefined ? "Models = @models," : ""}
            ApprovalStatus = @approvalStatus, ApprovedBy = @approvedBy, ApprovedAt = @approvedAt,
            RejectionReason = @rejectionReason, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE Id = @id AND IsDeleted = 0;
        `);
      template = result.recordset[0];

      // Mirror the same status fields onto the active content row, if migrated.
      if (currentTemplate.CurrentVersionContentId) {
        await new sql.Request(transaction)
          .input("contentId", sql.Int, currentTemplate.CurrentVersionContentId)
          .input("approvalStatus", sql.NVarChar(50), approvalStatus || currentTemplate.ApprovalStatus || "draft")
          .input("approvedBy", sql.NVarChar(200), approvedBy !== undefined ? (approvedBy || null) : currentTemplate.ApprovedBy)
          .input("approvedAt", sql.DateTime, approvedAt !== undefined ? (approvedAt ? new Date(approvedAt) : null) : currentTemplate.ApprovedAt)
          .input("rejectionReason", sql.NVarChar, rejectionReason !== undefined ? (rejectionReason || null) : currentTemplate.RejectionReason)
          .query(`
            UPDATE AuditTemplateContent
            SET ApprovalStatus = @approvalStatus, ApprovedBy = @approvedBy, ApprovedAt = @approvedAt, RejectionReason = @rejectionReason
            WHERE Id = @contentId
          `);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const fieldChanges = [];
    if (name && name !== currentTemplate.Name)
      fieldChanges.push({ field: "Name", from: currentTemplate.Name, to: name });
    if (description !== undefined && description !== currentTemplate.Description)
      fieldChanges.push({ field: "Description", from: currentTemplate.Description, to: description });
    if (category !== undefined && category !== currentTemplate.Category)
      fieldChanges.push({ field: "Category", from: currentTemplate.Category, to: category });
    if (approvalStatus && approvalStatus !== currentTemplate.ApprovalStatus)
      fieldChanges.push({ field: "Status", from: currentTemplate.ApprovalStatus, to: approvalStatus });

    const historyAction =
      approvalStatus === "pending_approval" ? "submitted_for_approval"
      : approvalStatus === "approved"       ? "approved"
      : approvalStatus === "rejected"       ? "rejected"
      : "status_changed";

    await logTemplateHistory(pool, {
      templateId: parseInt(id),
      action: historyAction,
      actionBy: updatedBy,
      comments: rejectionReason || null,
      previousStatus: currentTemplate.ApprovalStatus,
      newStatus: approvalStatus || currentTemplate.ApprovalStatus,
      versionNumber: currentTemplate.Version,
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : null,
    });

    res.status(200).json({ success: true, message: "Template updated successfully", data: template });
  } finally {
    await pool.close();
  }
});

// Delete template (soft delete)
export const deleteTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) throw new AppError("Template ID is required", 400);

  const updatedBy = String(req.user?.usercode || req.user?.name || req.user?.id || "SYSTEM");

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const checkResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT Id, TemplateCode, TemplateFileName
    FROM AuditTemplates
    WHERE Id = @id AND IsDeleted = 0
  `);

  if (checkResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const templateFileName = checkResult.recordset[0].TemplateFileName;

  const auditCheck = await pool
    .request()
    .input("templateId", sql.Int, id)
    .query(
      "SELECT COUNT(*) AS Count FROM Audits WHERE TemplateId = @templateId AND IsDeleted = 0",
    );

  if (auditCheck.recordset[0].Count > 0) {
    await pool.close();
    throw new AppError(
      "Cannot delete template. It is used in existing audits.",
      400,
    );
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .input("updatedBy", sql.NVarChar(200), updatedBy).query(`
      UPDATE AuditTemplates
      SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
      WHERE Id = @id;
    `);

  await pool.close();

  // Legacy-row-only: SQL-backed (migrated) templates have no JSON file to
  // clean up — AuditTemplateContent rows are kept forever as history.
  if (templateFileName) {
    try {
      await backupTemplateFile(templateFileName);
      await deleteTemplateFile(templateFileName);
    } catch (err) {
      console.warn("Could not delete template file:", err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});

// Duplicate template — always prompts for a new name (client-supplied).
// Different/unique name -> brand-new logical template (new TemplateId, v01).
// Same name as an existing template -> structured "exists" response; the
// frontend then explicitly calls POST /templates/:existingId/version with
// changeType:'duplicate' to confirm "Create Version".
export const duplicateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { newName, createdBy: createdByBody, createdByUser, confirmCreateVersion } = req.body;

  if (!id) throw new AppError("Template ID is required", 400);
  if (!newName || !newName.trim()) throw new AppError("A new name is required to duplicate a template", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const originalResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT ${PARENT_COLUMNS} FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
    if (!originalResult.recordset.length) throw new AppError("Template not found", 404);
    const original = originalResult.recordset[0];

    const trimmedName = newName.trim();
    const existing = await findActiveTemplateByName(pool, trimmedName);

    if (existing && !confirmCreateVersion) {
      const data = await getTemplateByIdInternal(pool, existing.Id);
      return res.status(200).json({
        success: true,
        exists: true,
        existingTemplateId: existing.Id,
        message: `A template named "${trimmedName}" already exists.`,
        data,
      });
    }

    // Confirmed: the duplicated name collides with an existing template and
    // the client confirmed "Create Version" — create a new version of THAT
    // template using the source template's content, entirely server-side
    // (the client never needs to carry full content between calls).
    if (existing && confirmCreateVersion) {
      const sourceContent = await loadContentForTemplate(pool, original);
      const content = disassembleContent(sourceContent);
      const rawCreatedByVer = req.user?.userCode || req.user?.name || createdByBody || createdByUser;
      const createdByVer = (rawCreatedByVer != null && String(rawCreatedByVer).trim()) ? String(rawCreatedByVer).trim() : "SYSTEM";
      const newVersion = nextVersion(existing.Version || "01");

      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      let updatedExisting;
      let newContentId;
      try {
        const contentResult = await new sql.Request(transaction)
          .input("templateId", sql.Int, existing.Id)
          .input("version", sql.NVarChar(20), newVersion)
          .input("headerConfig", sql.NVarChar(sql.MAX), content.headerConfigJson)
          .input("infoFields", sql.NVarChar(sql.MAX), content.infoFieldsJson)
          .input("columns", sql.NVarChar(sql.MAX), content.columnsJson)
          .input("defaultSections", sql.NVarChar(sql.MAX), content.defaultSectionsJson)
          .input("contentHash", sql.NVarChar(64), content.hash)
          .input("contentSize", sql.Int, content.sizeBytes)
          .input("sectionCount", sql.Int, content.stats.sectionCount)
          .input("stageCount", sql.Int, content.stats.stageCount)
          .input("checkpointCount", sql.Int, content.stats.checkpointCount)
          .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
          .input("createdFromVersionId", sql.Int, original.CurrentVersionContentId || null)
          .input("createdBy", sql.NVarChar(200), createdByVer)
          .query(`
            INSERT INTO AuditTemplateContent (
              TemplateId, Version, HeaderConfig, InfoFields, Columns, DefaultSections,
              ContentHash, ContentSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
              ApprovalStatus, IsActiveVersion, ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
              @templateId, @version, @headerConfig, @infoFields, @columns, @defaultSections,
              @contentHash, @contentSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount,
              'draft', 1, 'duplicate', @createdFromVersionId, @createdBy, GETDATE()
            );
          `);
        newContentId = contentResult.recordset[0].Id;

        await new sql.Request(transaction)
          .input("templateId", sql.Int, existing.Id)
          .input("newContentId", sql.Int, newContentId)
          .query(`UPDATE AuditTemplateContent SET IsActiveVersion = 0 WHERE TemplateId = @templateId AND Id <> @newContentId`);

        const updateResult = await new sql.Request(transaction)
          .input("id", sql.Int, existing.Id)
          .input("version", sql.NVarChar(20), newVersion)
          .input("contentId", sql.Int, newContentId)
          .input("updatedBy", sql.NVarChar(200), createdByVer)
          .input("templateHash", sql.NVarChar(64), content.hash)
          .input("templateSize", sql.Int, content.sizeBytes)
          .input("sectionCount", sql.Int, content.stats.sectionCount)
          .input("stageCount", sql.Int, content.stats.stageCount)
          .input("checkpointCount", sql.Int, content.stats.checkpointCount)
          .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
          .query(`
            UPDATE AuditTemplates
            SET Version = @version, CurrentVersionContentId = @contentId,
                ApprovalStatus = 'draft', ApprovedBy = NULL, ApprovedAt = NULL, RejectionReason = NULL,
                TemplateHash = @templateHash, TemplateSize = @templateSize,
                SectionCount = @sectionCount, StageCount = @stageCount,
                CheckpointCount = @checkpointCount, RequiredCheckpointCount = @requiredCheckpointCount,
                UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
            OUTPUT INSERTED.*
            WHERE Id = @id;
          `);
        updatedExisting = updateResult.recordset[0];

        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      await logTemplateHistory(pool, {
        templateId: existing.Id,
        action: "duplicated_as_version",
        actionBy: createdByVer,
        versionNumber: newVersion,
        previousVersion: existing.Version,
        createdFromVersion: original.Version,
        newStatus: "draft",
        comments: `Version created from duplicating "${original.Name}" (TemplateId ${original.Id})`,
      });

      return res.status(201).json({
        success: true,
        exists: false,
        message: `Version ${newVersion} created on "${existing.Name}"`,
        data: {
          ...updatedExisting,
          HeaderConfig: sourceContent.headerConfig,
          InfoFields: sourceContent.infoFields,
          Columns: sourceContent.columns,
          DefaultSections: sourceContent.defaultSections,
        },
      });
    }

    const originalContent = await loadContentForTemplate(pool, original);

    const newTemplateCode = await generateTemplateCode();
    const rawCreatedByDup = req.user?.userCode || req.user?.name || createdByBody || createdByUser;
    const createdBy = (rawCreatedByDup != null && String(rawCreatedByDup).trim()) ? String(rawCreatedByDup).trim() : "SYSTEM";

    const content = disassembleContent(originalContent);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let template;
    let contentId;
    try {
      const result = await new sql.Request(transaction)
        .input("templateCode", sql.NVarChar(50), newTemplateCode)
        .input("name", sql.NVarChar, trimmedName)
        .input("description", sql.NVarChar, original.Description)
        .input("category", sql.NVarChar(100), original.Category)
        .input("version", sql.NVarChar(20), "01")
        .input("isActive", sql.Bit, 1)
        .input("createdBy", sql.NVarChar(200), createdBy)
        .input("templateHash", sql.NVarChar(64), content.hash)
        .input("templateSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .query(`
          INSERT INTO AuditTemplates (
            TemplateCode, Name, Description, Category, Version, IsActive,
            ApprovalStatus, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt,
            TemplateHash, TemplateSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount
          )
          OUTPUT INSERTED.*
          VALUES (
            @templateCode, @name, @description, @category, @version, @isActive,
            'draft', @createdBy, GETDATE(), @createdBy, GETDATE(),
            @templateHash, @templateSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount
          );
        `);
      template = result.recordset[0];

      const contentResult = await new sql.Request(transaction)
        .input("templateId", sql.Int, template.Id)
        .input("version", sql.NVarChar(20), "01")
        .input("headerConfig", sql.NVarChar(sql.MAX), content.headerConfigJson)
        .input("infoFields", sql.NVarChar(sql.MAX), content.infoFieldsJson)
        .input("columns", sql.NVarChar(sql.MAX), content.columnsJson)
        .input("defaultSections", sql.NVarChar(sql.MAX), content.defaultSectionsJson)
        .input("contentHash", sql.NVarChar(64), content.hash)
        .input("contentSize", sql.Int, content.sizeBytes)
        .input("sectionCount", sql.Int, content.stats.sectionCount)
        .input("stageCount", sql.Int, content.stats.stageCount)
        .input("checkpointCount", sql.Int, content.stats.checkpointCount)
        .input("requiredCheckpointCount", sql.Int, content.stats.requiredCheckpointCount)
        .input("createdFromVersionId", sql.Int, original.CurrentVersionContentId || null)
        .input("createdBy", sql.NVarChar(200), createdBy)
        .query(`
          INSERT INTO AuditTemplateContent (
            TemplateId, Version, HeaderConfig, InfoFields, Columns, DefaultSections,
            ContentHash, ContentSize, SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
            ApprovalStatus, IsActiveVersion, ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
          )
          OUTPUT INSERTED.Id
          VALUES (
            @templateId, @version, @headerConfig, @infoFields, @columns, @defaultSections,
            @contentHash, @contentSize, @sectionCount, @stageCount, @checkpointCount, @requiredCheckpointCount,
            'draft', 1, 'duplicate', @createdFromVersionId, @createdBy, GETDATE()
          );
        `);
      contentId = contentResult.recordset[0].Id;

      await new sql.Request(transaction)
        .input("id", sql.Int, template.Id)
        .input("contentId", sql.Int, contentId)
        .query(`UPDATE AuditTemplates SET CurrentVersionContentId = @contentId WHERE Id = @id`);

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    await logTemplateHistory(pool, {
      templateId: template.Id,
      action: "duplicated_as_new",
      actionBy: createdBy,
      versionNumber: "01",
      newStatus: "draft",
      comments: `Duplicated from "${original.Name}" (TemplateId ${original.Id})`,
    });

    res.status(201).json({
      success: true,
      exists: false,
      message: "Template duplicated successfully",
      data: {
        ...template,
        CurrentVersionContentId: contentId,
        HeaderConfig: originalContent.headerConfig,
        InfoFields: originalContent.infoFields,
        Columns: originalContent.columns,
        DefaultSections: originalContent.defaultSections,
      },
    });
  } finally {
    await pool.close();
  }
});

// Get template history (change log)
export const getTemplateHistory = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Template ID is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool.request()
      .input("templateId", sql.Int, id)
      .query(`
        SELECT Id, TemplateId, Action, ActionBy, ActionAt, Comments,
               PreviousStatus, NewStatus, FieldChanges, VersionNumber, PreviousVersion, CreatedFromVersion
        FROM   AuditTemplateHistory
        WHERE  TemplateId = @templateId
        ORDER BY ActionAt DESC;
      `);

    const history = result.recordset.map((r) => ({
      ...r,
      FieldChanges: r.FieldChanges ? JSON.parse(r.FieldChanges) : null,
    }));

    res.status(200).json({ success: true, data: history });
  } finally {
    await pool.close();
  }
});

// List all versions for a template (the version chain) — SQL-backed, with a
// legacy fallback to AuditTemplateVersions for unmigrated rows.
export const getTemplateVersions = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Template ID is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const parentResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT CurrentVersionContentId FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
    if (!parentResult.recordset.length) throw new AppError("Template not found", 404);

    if (parentResult.recordset[0].CurrentVersionContentId) {
      const result = await pool.request()
        .input("templateId", sql.Int, id)
        .query(`
          SELECT Id, TemplateId, Version, ContentHash AS TemplateHash, ContentSize AS TemplateSize,
                 SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
                 JsonSchemaVersion, ApprovalStatus, IsActiveVersion AS IsLatest,
                 ChangeType, CreatedFromVersionId, CreatedBy, CreatedAt
          FROM   AuditTemplateContent
          WHERE  TemplateId = @templateId
          ORDER BY CreatedAt DESC;
        `);
      return res.status(200).json({ success: true, data: result.recordset });
    }

    const legacy = await pool.request()
      .input("templateId", sql.Int, id)
      .query(`
        SELECT Id, TemplateId, Version, TemplateFileName, TemplateHash, TemplateSize,
               SectionCount, StageCount, CheckpointCount, RequiredCheckpointCount,
               JsonSchemaVersion, IsLatest, CreatedBy, CreatedAt
        FROM   AuditTemplateVersions
        WHERE  TemplateId = @templateId
        ORDER BY CreatedAt DESC;
      `);
    res.status(200).json({ success: true, data: legacy.recordset });
  } finally {
    await pool.close();
  }
});

// Fetch a specific historical version's config
export const getTemplateVersionFile = tryCatch(async (req, res) => {
  const { id, version } = req.params;
  if (!id || !version) throw new AppError("Template ID and version are required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const parentResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT CurrentVersionContentId FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
    if (!parentResult.recordset.length) throw new AppError("Template not found", 404);

    if (parentResult.recordset[0].CurrentVersionContentId) {
      const result = await pool.request()
        .input("templateId", sql.Int, id)
        .input("version", sql.NVarChar(20), version)
        .query(`SELECT * FROM AuditTemplateContent WHERE TemplateId = @templateId AND Version = @version`);
      if (!result.recordset.length) throw new AppError("Version not found", 404);

      const row = result.recordset[0];
      res.status(200).json({
        success: true,
        data: { ...row, config: assembleContent(row), hashValid: true },
      });
      return;
    }

    // Legacy fallback
    const legacy = await pool.request()
      .input("templateId", sql.Int, id)
      .input("version", sql.NVarChar(20), version)
      .query(`SELECT * FROM AuditTemplateVersions WHERE TemplateId = @templateId AND Version = @version`);
    if (!legacy.recordset.length) throw new AppError("Version not found", 404);

    const row = legacy.recordset[0];
    const config = await readTemplateFile(row.TemplateFileName);
    const rawString = await readTemplateFileRaw(row.TemplateFileName);
    const { valid, skipped } = verifyTemplateHash(rawString, row.TemplateHash);

    res.status(200).json({
      success: true,
      data: { ...row, config, hashValid: skipped ? null : valid },
    });
  } finally {
    await pool.close();
  }
});

// Compare two versions of a template — structured, id-based diff
export const compareTemplateVersions = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;
  if (!id) throw new AppError("Template ID is required", 400);
  if (!from || !to) throw new AppError("Both from and to query params are required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const parentResult = await pool.request().input("id", sql.Int, id)
      .query(`SELECT CurrentVersionContentId FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0`);
    if (!parentResult.recordset.length) throw new AppError("Template not found", 404);

    const toMeta = (row, fromHash, fromSize) => ({
      version: row.Version,
      hash: fromHash,
      createdBy: row.CreatedBy,
      createdAt: row.CreatedAt,
      stats: {
        sectionCount: row.SectionCount,
        stageCount: row.StageCount,
        checkpointCount: row.CheckpointCount,
        requiredCheckpointCount: row.RequiredCheckpointCount,
      },
    });

    if (parentResult.recordset[0].CurrentVersionContentId) {
      const rows = await pool.request()
        .input("templateId", sql.Int, id)
        .input("from", sql.NVarChar(20), from)
        .input("to", sql.NVarChar(20), to)
        .query(`SELECT * FROM AuditTemplateContent WHERE TemplateId = @templateId AND Version IN (@from, @to)`);

      const fromRow = rows.recordset.find((r) => r.Version === from);
      const toRow = rows.recordset.find((r) => r.Version === to);
      if (!fromRow) throw new AppError(`Version ${from} not found for this template`, 404);
      if (!toRow) throw new AppError(`Version ${to} not found for this template`, 404);

      const fromConfig = assembleContent(fromRow);
      const toConfig = from === to ? fromConfig : assembleContent(toRow);
      const diff = diffTemplateConfigs(fromConfig, toConfig);

      return res.status(200).json({
        success: true,
        data: {
          from: toMeta(fromRow, fromRow.ContentHash),
          to: toMeta(toRow, toRow.ContentHash),
          diff,
        },
      });
    }

    // Legacy fallback
    const rows = await pool.request()
      .input("templateId", sql.Int, id)
      .input("from", sql.NVarChar(20), from)
      .input("to", sql.NVarChar(20), to)
      .query(`SELECT * FROM AuditTemplateVersions WHERE TemplateId = @templateId AND Version IN (@from, @to)`);

    const fromRow = rows.recordset.find((r) => r.Version === from);
    const toRow = rows.recordset.find((r) => r.Version === to);
    if (!fromRow) throw new AppError(`Version ${from} not found for this template`, 404);
    if (!toRow) throw new AppError(`Version ${to} not found for this template`, 404);

    const fromConfig = await readTemplateFile(fromRow.TemplateFileName);
    const toConfig = from === to ? fromConfig : await readTemplateFile(toRow.TemplateFileName);
    const diff = diffTemplateConfigs(fromConfig, toConfig);

    res.status(200).json({
      success: true,
      data: { from: toMeta(fromRow, fromRow.TemplateHash), to: toMeta(toRow, toRow.TemplateHash), diff },
    });
  } finally {
    await pool.close();
  }
});

// Get template categories
export const getTemplateCategories = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool.request().query(`
    SELECT DISTINCT Category, COUNT(*) AS Count
    FROM AuditTemplates
    WHERE IsDeleted = 0 AND Category IS NOT NULL
    GROUP BY Category
    ORDER BY Category;
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Template categories retrieved successfully",
    data: result.recordset,
  });
});
