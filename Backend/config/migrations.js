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

  // ── ApprenticeEmployees ───────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeEmployees')
    BEGIN
      CREATE TABLE ApprenticeEmployees (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        EmpCode     NVARCHAR(50)  NOT NULL,
        EmpName     NVARCHAR(200) NOT NULL,
        Department  NVARCHAR(200) NULL,
        Category    NVARCHAR(200) NULL,
        Designation NVARCHAR(200) NULL,
        BankAccount NVARCHAR(100) NULL,
        IFSC        NVARCHAR(50)  NULL,
        UAN         NVARCHAR(50)  NULL,
        ESIC        NVARCHAR(50)  NULL,
        IsActive    BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_AppEmp_Code UNIQUE (EmpCode)
      );
    END
  `);

  // ── ApprenticeUploadLogs ──────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeUploadLogs')
    BEGIN
      CREATE TABLE ApprenticeUploadLogs (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        SalaryMonth   INT           NOT NULL,
        SalaryYear    INT           NOT NULL,
        UploadedBy    NVARCHAR(200) NULL,
        RowsTotal     INT           NOT NULL DEFAULT 0,
        RowsOk        INT           NOT NULL DEFAULT 0,
        RowsFailed    INT           NOT NULL DEFAULT 0,
        Status        NVARCHAR(20)  NOT NULL DEFAULT 'processing',
        ErrorLog      NVARCHAR(MAX) NULL,
        UploadedAt    DATETIME      NOT NULL DEFAULT GETDATE()
      );
    END
  `);

  // ── ApprenticeSalarySlips ─────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeSalarySlips')
    BEGIN
      CREATE TABLE ApprenticeSalarySlips (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        UploadBatchId   INT            NULL,
        EmpCode         NVARCHAR(50)   NOT NULL,
        EmpName         NVARCHAR(200)  NULL,
        Department      NVARCHAR(200)  NULL,
        Category        NVARCHAR(200)  NULL,
        SalaryMonth     INT            NOT NULL,
        SalaryYear      INT            NOT NULL,
        PresentDays     DECIMAL(5,1)   NULL DEFAULT 0,
        WeeklyOff       INT            NULL DEFAULT 0,
        HalfDays        DECIMAL(5,1)   NULL DEFAULT 0,
        AbsentDays      DECIMAL(5,1)   NULL DEFAULT 0,
        OTHours         DECIMAL(8,2)   NULL DEFAULT 0,
        Stipend         DECIMAL(12,2)  NULL DEFAULT 0,
        OTAmount        DECIMAL(12,2)  NULL DEFAULT 0,
        Bonus           DECIMAL(12,2)  NULL DEFAULT 0,
        Incentive       DECIMAL(12,2)  NULL DEFAULT 0,
        GrossPay        DECIMAL(12,2)  NULL DEFAULT 0,
        Hostel          DECIMAL(12,2)  NULL DEFAULT 0,
        Canteen         DECIMAL(12,2)  NULL DEFAULT 0,
        Electricity     DECIMAL(12,2)  NULL DEFAULT 0,
        Uniform         DECIMAL(12,2)  NULL DEFAULT 0,
        Shoes           DECIMAL(12,2)  NULL DEFAULT 0,
        OtherDeductions DECIMAL(12,2)  NULL DEFAULT 0,
        TotalDeductions DECIMAL(12,2)  NULL DEFAULT 0,
        NetPay          DECIMAL(12,2)  NULL DEFAULT 0,
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'draft',
        BankAccount     NVARCHAR(100)  NULL,
        UAN             NVARCHAR(50)   NULL,
        DayWiseData     NVARCHAR(MAX)  NULL,
        CreatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_AppSlip UNIQUE (EmpCode, SalaryMonth, SalaryYear)
      );
    END
  `);

  // ── AuditTemplates: add approval-workflow columns ────────────────────────
  for (const col of [
    { name: "ApprovalStatus",  def: "NVARCHAR(50)  NULL DEFAULT 'draft'" },
    { name: "ApprovedBy",      def: "NVARCHAR(200) NULL" },
    { name: "ApprovedAt",      def: "DATETIME      NULL" },
    { name: "RejectionReason", def: "NVARCHAR(MAX) NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplates')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE AuditTemplates ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to AuditTemplates';
      END
    `);
  }

  // ── Audits: allow 'rework' as a valid Status value ───────────────────────
  // Drop any CHECK constraint on Audits.Status so 'rework' is accepted.
  // If no constraint exists this is a no-op.
  await pool3.request().query(`
    DECLARE @cname NVARCHAR(200);
    SELECT TOP 1 @cname = cc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
      ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
    WHERE ccu.TABLE_NAME = 'Audits' AND ccu.COLUMN_NAME = 'Status';
    IF @cname IS NOT NULL
      EXEC('ALTER TABLE Audits DROP CONSTRAINT [' + @cname + ']');
  `);

  // ── AuditHistory: ensure Comments column exists ───────────────────────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditHistory')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditHistory' AND COLUMN_NAME = 'Comments'
    )
    BEGIN
      ALTER TABLE AuditHistory ADD Comments NVARCHAR(MAX) NULL;
      PRINT 'Migration: Added Comments column to AuditHistory';
    END
  `);

  console.log("Migrations completed.");
};
