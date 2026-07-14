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

  console.log("GARUDA migrations completed.");
};
