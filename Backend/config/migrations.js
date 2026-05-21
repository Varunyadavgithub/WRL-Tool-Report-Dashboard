// All schema migrations are idempotent — safe to run on every server start.
// Add new migrations at the bottom of the runMigrations function.

export const runMigrations = async (pool3) => {
  // ── AuditTemplates: add Models column ────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'AuditTemplates'
    )
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = 'Models'
    )
    BEGIN
      ALTER TABLE AuditTemplates ADD Models NVARCHAR(MAX) NULL;
      PRINT 'Migration: Added Models column to AuditTemplates';
    END
  `);

  // ── Audits: add StartedAt column ─────────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Audits'
    )
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Audits' AND COLUMN_NAME = 'StartedAt'
    )
    BEGIN
      ALTER TABLE Audits ADD StartedAt DATETIME NULL;
      PRINT 'Migration: Added StartedAt column to Audits';
    END
  `);

  // ── Create AuditTemplateHistory table ────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'AuditTemplateHistory'
    )
    BEGIN
      CREATE TABLE AuditTemplateHistory (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId     INT           NOT NULL,
        Action         NVARCHAR(50)  NOT NULL,
        ActionBy       NVARCHAR(100) NULL,
        ActionAt       DATETIME      NOT NULL DEFAULT GETDATE(),
        Comments       NVARCHAR(MAX) NULL,
        PreviousStatus NVARCHAR(50)  NULL,
        NewStatus      NVARCHAR(50)  NULL,
        FieldChanges   NVARCHAR(MAX) NULL
      );
      PRINT 'Migration: Created AuditTemplateHistory table';
    END
  `);

  // ── Create LeaveRequests table ───────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'LeaveRequests'
    )
    BEGIN
      CREATE TABLE LeaveRequests (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        EmpCode         NVARCHAR(50)   NOT NULL,
        EmpName         NVARCHAR(200)  NULL,
        Department      NVARCHAR(200)  NULL,
        LeaveType       NVARCHAR(10)   NOT NULL,
        FromDate        DATE           NOT NULL,
        ToDate          DATE           NOT NULL,
        TotalDays       DECIMAL(5,1)   NOT NULL DEFAULT 1,
        Reason          NVARCHAR(MAX)  NULL,
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'pending',
        AppliedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        ApprovedBy      NVARCHAR(200)  NULL,
        ApprovedAt      DATETIME       NULL,
        RejectionReason NVARCHAR(MAX)  NULL
      );
      PRINT 'Migration: Created LeaveRequests table';
    END
  `);

  console.log("Migrations completed.");
};
