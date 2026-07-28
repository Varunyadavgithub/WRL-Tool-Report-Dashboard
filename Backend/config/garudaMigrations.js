/**
 * Migrations for pool1 (GARUDA) — kept separate from config/migrations.js,
 * which only ever touches pool3 (the local app DB this app fully owns).
 * GARUDA may have consumers outside this codebase, so anything here must be
 * strictly additive (new nullable column, never altering/dropping existing
 * ones) and follow the same idempotent IF-NOT-EXISTS style as migrations.js.
 */
export const runGarudaMigrations = async (pool1) => {
  // ── Users: add PasswordHash for bcrypt-based login, alongside the existing
  //    plaintext Password column (left untouched for any other consumer of
  //    this table) ─────────────────────────────────────────────────────────
  await pool1.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordHash'
    )
    BEGIN
      ALTER TABLE Users ADD PasswordHash NVARCHAR(255) NULL;
      PRINT 'Migration: Added PasswordHash column to Users (GARUDA)';
    END
  `);

  // ── BISUpload: energy-consumption values auto-extracted from the uploaded
  //    lab-report PDF at upload time (declared/measured kWh, deviation %,
  //    and that check's PASS/FAIL) — best-effort, so all four stay nullable.
  for (const col of [
    { name: "DeclaredAnnualEnergy",   def: "DECIMAL(12,3) NULL" },
    { name: "MeasuredAnnualEnergy",   def: "DECIMAL(12,3) NULL" },
    { name: "EnergyDeviationPercent", def: "DECIMAL(6,2)  NULL" },
    { name: "TestResult",             def: "NVARCHAR(20)  NULL" },
  ]) {
    await pool1.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BISUpload')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BISUpload' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE BISUpload ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to BISUpload (GARUDA)';
      END
    `);
  }

  // ── BISCategory: BIS/Non-BIS classification of finished-goods materials
  //    (Material.Type = 100). Category: 0 = Non-BIS, 1 = BIS. Fully manually
  //    managed from the BIS Config UI (Backend/controllers/quality/BisCategory
  //    .controller.js) from this point on — the MERGE below only ever INSERTs
  //    brand-new Type=100 materials that aren't classified yet (defaulting to
  //    Non-BIS via CertificateControl), it never touches ModelName/Category on
  //    a row that already exists, so manual edits survive server restarts.
  await pool1.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BISCategory')
    BEGIN
      CREATE TABLE BISCategory (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        MaterialCode NVARCHAR(50)  NOT NULL,
        ModelName    NVARCHAR(300) NULL,
        Category     TINYINT       NOT NULL DEFAULT 0,
        CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_BISCategory_MaterialCode UNIQUE (MaterialCode)
      );
      PRINT 'Migration: Created BISCategory table (GARUDA)';
    END
  `);

  await pool1.request().query(`
    MERGE BISCategory AS target
    USING (
      -- ModelName stored here matches the "actual model name" convention used
      -- throughout the BIS status query/BISUpload (9-char prefix + optional
      -- ' RT' suffix), not the raw full Material.Name.
      SELECT
        MatCode AS MaterialCode,
        LEFT(Name, 9) + CASE WHEN RIGHT(Name, 1) = 'R' THEN ' RT' ELSE '' END AS ModelName,
        CASE WHEN CertificateControl <> 0 THEN 1 ELSE 0 END AS Category
      FROM Material
      WHERE Type = 100
    ) AS src
    ON target.MaterialCode = src.MaterialCode
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (MaterialCode, ModelName, Category)
      VALUES (src.MaterialCode, src.ModelName, src.Category);
  `);

  console.log("GARUDA migrations completed.");
};
