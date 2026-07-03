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
        LabourId        NVARCHAR(60)   NULL,
        Email           NVARCHAR(200)  NULL,
        MobileNo        NVARCHAR(20)   NULL,
        EmpName         NVARCHAR(200)  NULL,
        Category        NVARCHAR(200)  NULL,
        Department      NVARCHAR(200)  NULL,
        Location        NVARCHAR(120)  NULL,
        DateOfJoining   NVARCHAR(20)   NULL,
        SalaryMonth     INT            NOT NULL,
        SalaryYear      INT            NOT NULL,
        PresentDays     DECIMAL(5,1)   NULL DEFAULT 0,
        LOP             DECIMAL(5,1)   NULL DEFAULT 0,
        OtherAllowance  DECIMAL(12,2)  NULL DEFAULT 0,
        Arrear          DECIMAL(12,2)  NULL DEFAULT 0,
        CompanyStipend  DECIMAL(12,2)  NULL DEFAULT 0,
        GovernmentDBT   DECIMAL(12,2)  NULL DEFAULT 0,
        TotalStipend    DECIMAL(12,2)  NULL DEFAULT 0,
        Incentive       DECIMAL(12,2)  NULL DEFAULT 0,
        GrossAmount     DECIMAL(12,2)  NULL DEFAULT 0,
        Canteen         DECIMAL(12,2)  NULL DEFAULT 0,
        HostelRent      DECIMAL(12,2)  NULL DEFAULT 0,
        Electricity     DECIMAL(12,2)  NULL DEFAULT 0,
        Uniform         DECIMAL(12,2)  NULL DEFAULT 0,
        Shoes           DECIMAL(12,2)  NULL DEFAULT 0,
        OtherDed        DECIMAL(12,2)  NULL DEFAULT 0,
        NetDeduction    DECIMAL(12,2)  NULL DEFAULT 0,
        NetPayment      DECIMAL(12,2)  NULL DEFAULT 0,
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'draft',
        EmailedAt       DATETIME       NULL,
        CreatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_AppSlip UNIQUE (EmpCode, SalaryMonth, SalaryYear)
      );
    END
  `);

  // ── ApprenticeSalarySlips: rename legacy columns to match current schema ─
  for (const [oldName, newName] of [
    ["GrossPay",        "GrossAmount"],
    ["Hostel",          "HostelRent"],
    ["OtherDeductions", "OtherDed"],
    ["TotalDeductions", "NetDeduction"],
    ["NetPay",          "NetPayment"],
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ApprenticeSalarySlips' AND COLUMN_NAME='${oldName}')
      AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ApprenticeSalarySlips' AND COLUMN_NAME='${newName}')
      BEGIN
        EXEC sp_rename 'ApprenticeSalarySlips.${oldName}', '${newName}', 'COLUMN';
        PRINT 'Migration: Renamed ApprenticeSalarySlips.${oldName} to ${newName}';
      END
    `);
  }

  // ── ApprenticeSalarySlips: add columns introduced by the current schema ──
  for (const col of [
    { name: "LabourId",       def: "NVARCHAR(60)  NULL" },
    { name: "Email",          def: "NVARCHAR(200) NULL" },
    { name: "MobileNo",       def: "NVARCHAR(20)  NULL" },
    { name: "Location",       def: "NVARCHAR(120) NULL" },
    { name: "DateOfJoining",  def: "NVARCHAR(20)  NULL" },
    { name: "LOP",            def: "DECIMAL(5,1)  NULL DEFAULT 0" },
    { name: "OtherAllowance", def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "Arrear",         def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "CompanyStipend", def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "GovernmentDBT",  def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "TotalStipend",   def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "GrossAmount",    def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "HostelRent",     def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "OtherDed",       def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "NetDeduction",   def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "NetPayment",     def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "EmailedAt",      def: "DATETIME      NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ApprenticeSalarySlips')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ApprenticeSalarySlips' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE ApprenticeSalarySlips ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to ApprenticeSalarySlips';
      END
    `);
  }

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

  // ── PartProcessEvents: machine event log synced from FactoryOS API ──────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PartProcessEvents'
    )
    BEGIN
      CREATE TABLE PartProcessEvents (
        EventId        NVARCHAR(50)   NOT NULL PRIMARY KEY,
        EventDate      DATE           NOT NULL,
        ShiftName      NVARCHAR(100)  NULL,
        EventType      NVARCHAR(20)   NULL,
        Barcode        NVARCHAR(500)  NULL,
        StartTime      NVARCHAR(10)   NULL,
        EndTime        NVARCHAR(10)   NULL,
        Duration       NVARCHAR(15)   NULL,
        PartsQty       INT            NOT NULL DEFAULT 0,
        PartsQuality   NVARCHAR(20)   NULL,
        OperatorName   NVARCHAR(200)  NULL,
        DowntimeReason NVARCHAR(500)  NULL,
        DowntimeComment NVARCHAR(MAX) NULL,
        AssetName      NVARCHAR(200)  NULL,
        LineName       NVARCHAR(200)  NULL,
        Energy         FLOAT          NOT NULL DEFAULT 0,
        SyncedAt       DATETIME       NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_PPE_Date      ON PartProcessEvents (EventDate);
      CREATE INDEX IX_PPE_DateShift ON PartProcessEvents (EventDate, ShiftName);
      PRINT 'Migration: Created PartProcessEvents table';
    END
  `);

  // ── MaterialConfigs: Master Config > Material Config ─────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MaterialConfigs')
    BEGIN
      CREATE TABLE MaterialConfigs (
        Id                        INT IDENTITY(1,1) PRIMARY KEY,
        SapCode                   NVARCHAR(50)   NOT NULL,
        PartName                  NVARCHAR(300)  NULL,
        Category                  NVARCHAR(100)  NULL,
        Length                    DECIMAL(12,3)  NULL,
        Width                     DECIMAL(12,3)  NULL,
        Thickness                 DECIMAL(12,3)  NULL,
        Weight                    DECIMAL(12,3)  NULL,
        ComponentWeight           DECIMAL(12,3)  NULL,
        ScrapWeight               DECIMAL(12,3)  NULL,
        NoOfSheet                 DECIMAL(12,3)  NULL,
        ActualComponentsPerSheet  DECIMAL(12,3)  NULL,
        PncLoadingUnloading       DECIMAL(12,3)  NULL,
        DefinedComponentCycleTime DECIMAL(12,3)  NULL,
        DrawingNumber             NVARCHAR(100)  NULL,
        DrawingRevision           NVARCHAR(50)   NULL,
        Status                    BIT            NOT NULL DEFAULT 1,
        CreatedAt                 DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt                 DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_MaterialConfig_SapCode UNIQUE (SapCode)
      );
      PRINT 'Migration: Created MaterialConfigs table';
    END
  `);

  // ── ShiftConfigs: Master Config > Shift Config ────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ShiftConfigs')
    BEGIN
      CREATE TABLE ShiftConfigs (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName     NVARCHAR(100) NOT NULL,
        ShiftCode     NVARCHAR(20)  NULL,
        StartTime     NVARCHAR(10)  NULL,
        EndTime       NVARCHAR(10)  NULL,
        BreakStart    NVARCHAR(10)  NULL,
        BreakEnd      NVARCHAR(10)  NULL,
        TeaBreaks     NVARCHAR(10)  NULL,
        Color         NVARCHAR(20)  NULL,
        OvertimeShift BIT           NOT NULL DEFAULT 0,
        WeeklyOff     NVARCHAR(200) NULL,
        Status        BIT           NOT NULL DEFAULT 1,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO ShiftConfigs (ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status) VALUES
        ('Shift 1', 'S1', '08:00', '16:00', '12:00', '12:30', '2', '#3b82f6', 0, 'Sunday', 1),
        ('Shift 2', 'S2', '16:00', '00:00', '20:00', '20:30', '2', '#8b5cf6', 0, 'Sunday', 1),
        ('Shift 3', 'S3', '00:00', '08:00', '04:00', '04:30', '1', '#f59e0b', 0, 'Sunday', 1);
      PRINT 'Migration: Created ShiftConfigs table';
    END
  `);

  // ── MasterDepartments: Master Config > Downtime Config (department list) ─
  // Named "MasterDepartments" (not "Departments") to avoid colliding with the
  // pre-existing lowercase "departments" table used by employee management.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MasterDepartments')
    BEGIN
      CREATE TABLE MasterDepartments (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Name      NVARCHAR(200) NOT NULL,
        Status    BIT           NOT NULL DEFAULT 1,
        CreatedAt DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_MasterDepartment_Name UNIQUE (Name)
      );
      INSERT INTO MasterDepartments (Name, Status) VALUES
        ('Maintenance', 1),
        ('Production',  1),
        ('Quality',     1),
        ('Stores',      1),
        ('Electrical',  1),
        ('HR',          1);
      PRINT 'Migration: Created MasterDepartments table';
    END
  `);

  // ── DowntimeReasons: Master Config > Downtime Config ─────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='DowntimeReasons')
    BEGIN
      CREATE TABLE DowntimeReasons (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        DtCode     NVARCHAR(50)  NULL,
        Reason     NVARCHAR(300) NOT NULL,
        Department NVARCHAR(200) NULL,
        Status     BIT           NOT NULL DEFAULT 1,
        CreatedAt  DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt  DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO DowntimeReasons (DtCode, Reason, Department, Status) VALUES
        ('DT001', 'Machine Breakdown',      'Maintenance', 1),
        ('DT002', 'Tool Change',            'Production',  1),
        ('DT003', 'Material Shortage',      'Stores',      1),
        ('DT004', 'No Operator',            'HR',          1),
        ('DT005', 'Quality Issue',          'Quality',     1),
        ('DT006', 'Power Failure',          'Electrical',  1),
        ('DT007', 'Preventive Maintenance', 'Maintenance', 1),
        ('DT008', 'Setup & Changeover',     'Production',  1),
        ('DT009', 'Others',                 '',            1);
      PRINT 'Migration: Created DowntimeReasons table';
    END
  `);

  // ── QualityDefects: Master Config > Quality Config ───────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='QualityDefects')
    BEGIN
      CREATE TABLE QualityDefects (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        QCode        NVARCHAR(50)  NULL,
        DefectName   NVARCHAR(300) NOT NULL,
        Category     NVARCHAR(100) NULL,
        Type         NVARCHAR(50)  NULL,
        Severity     NVARCHAR(50)  NULL,
        Stage        NVARCHAR(100) NULL,
        RootCause    NVARCHAR(300) NULL,
        CapaRequired BIT           NOT NULL DEFAULT 0,
        Status       BIT           NOT NULL DEFAULT 1,
        CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO QualityDefects (QCode, DefectName, Category, Type, Severity, Stage, RootCause, CapaRequired, Status) VALUES
        ('QD001', 'Dimensional Variation', 'Dimensional',    'Rework',    'Major',    'In-Process',       'Tool Wear',        1, 1),
        ('QD002', 'Surface Finish Defect', 'Surface Finish', 'Rejection', 'Major',    'Final Inspection', 'Wrong Parameters', 1, 1),
        ('QD003', 'Burr / Sharp Edge',     'Process',        'Rework',    'Minor',    'In-Process',       'Tool Condition',   0, 1),
        ('QD004', 'Crack / Fracture',      'Material',       'Rejection', 'Critical', 'Incoming',         'Material Defect',  1, 1),
        ('QD005', 'Wrong Assembly',        'Assembly',       'Rework',    'Major',    'In-Process',       'Method Issue',     1, 1),
        ('QD006', 'Porosity',              'Material',       'Rejection', 'Critical', 'Incoming',         'Casting Defect',   1, 1),
        ('QD007', 'Paint Peel-off',        'Cosmetic',       'Rework',    'Minor',    'Final Inspection', 'Surface Prep',     0, 1),
        ('QD008', 'Wrong Material',        'Material',       'Hold',      'Critical', 'Incoming',         'Supplier',         1, 1);
      PRINT 'Migration: Created QualityDefects table';
    END
  `);

  // ── MailSubscribers: Master Config > Mail Config ─────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MailSubscribers')
    BEGIN
      CREATE TABLE MailSubscribers (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        EmpName       NVARCHAR(200)  NOT NULL,
        EmpId         NVARCHAR(50)   NULL,
        Department    NVARCHAR(200)  NULL,
        Designation   NVARCHAR(200)  NULL,
        Email         NVARCHAR(200)  NOT NULL,
        Mobile        NVARCHAR(20)   NULL,
        Subscriptions NVARCHAR(MAX)  NULL,
        Frequency     NVARCHAR(50)   NOT NULL DEFAULT 'Shift-wise',
        Whatsapp      BIT            NOT NULL DEFAULT 0,
        Sms           BIT            NOT NULL DEFAULT 0,
        Status        BIT            NOT NULL DEFAULT 1,
        CreatedAt     DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt     DATETIME       NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Migration: Created MailSubscribers table';
    END
  `);

  // ── Machines: Master Config > Machine Config ─────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Machines')
    BEGIN
      CREATE TABLE Machines (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        MachineName    NVARCHAR(200)  NOT NULL,
        MachineCode    NVARCHAR(50)   NOT NULL,
        IpAddress      NVARCHAR(50)   NULL,
        ControllerType NVARCHAR(50)   NULL,
        ApiEndpoint    NVARCHAR(300)  NULL,
        Department     NVARCHAR(200)  NULL,
        LineName       NVARCHAR(100)  NULL,
        PlantLocation  NVARCHAR(100)  NULL,
        ImagePath      NVARCHAR(300)  NULL,
        Connected      BIT            NOT NULL DEFAULT 0,
        Status         BIT            NOT NULL DEFAULT 1,
        CreatedAt      DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt      DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_Machine_Code UNIQUE (MachineCode)
      );
      PRINT 'Migration: Created Machines table';
    END
  `);

  // ── ProductionPlans: Master Config > Planning Configuration ──────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ProductionPlans')
    BEGIN
      CREATE TABLE ProductionPlans (
        Id                 INT IDENTITY(1,1) PRIMARY KEY,
        MachineName        NVARCHAR(200)  NOT NULL,
        SapCode            NVARCHAR(50)   NOT NULL,
        PartName           NVARCHAR(300)  NULL,
        ModelCode          NVARCHAR(100)  NULL,
        TargetQty          DECIMAL(14,2)  NOT NULL DEFAULT 0,
        Shift              NVARCHAR(50)   NOT NULL DEFAULT 'All Shifts',
        PlanDate           DATE           NOT NULL,
        Priority           NVARCHAR(20)   NOT NULL DEFAULT 'Medium',
        Customer           NVARCHAR(200)  NULL,
        PlannedCycleTime   DECIMAL(12,3)  NULL,
        Status             BIT            NOT NULL DEFAULT 1,
        CreatedAt          DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt          DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_ProductionPlan_Key UNIQUE (SapCode, MachineName, PlanDate, Shift)
      );
      CREATE INDEX IX_ProductionPlan_SapDate ON ProductionPlans (SapCode, PlanDate);
      PRINT 'Migration: Created ProductionPlans table';
    END
  `);

  // ── AuditTemplates: add version-integrity snapshot columns ───────────────
  for (const col of [
    { name: "TemplateHash",            def: "NVARCHAR(64)  NULL" },
    { name: "TemplateSize",            def: "INT           NULL" },
    { name: "SectionCount",            def: "INT           NULL" },
    { name: "StageCount",              def: "INT           NULL" },
    { name: "CheckpointCount",         def: "INT           NULL" },
    { name: "RequiredCheckpointCount", def: "INT           NULL" },
    { name: "JsonSchemaVersion",       def: "NVARCHAR(10)  NULL DEFAULT '1'" },
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

  // ── AuditTemplateVersions: immutable per-version file+hash ledger ────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AuditTemplateVersions')
    BEGIN
      CREATE TABLE AuditTemplateVersions (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId              INT           NOT NULL,
        Version                 NVARCHAR(20)  NOT NULL,
        TemplateFileName        NVARCHAR(500) NOT NULL,
        TemplateHash            NVARCHAR(64)  NOT NULL,
        TemplateSize            INT           NOT NULL DEFAULT 0,
        SectionCount            INT           NOT NULL DEFAULT 0,
        StageCount              INT           NOT NULL DEFAULT 0,
        CheckpointCount         INT           NOT NULL DEFAULT 0,
        RequiredCheckpointCount INT           NOT NULL DEFAULT 0,
        JsonSchemaVersion       NVARCHAR(10)  NULL DEFAULT '1',
        IsLatest                BIT           NOT NULL DEFAULT 0,
        CreatedBy               NVARCHAR(200) NULL,
        CreatedAt               DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_TemplateVersion UNIQUE (TemplateId, Version)
      );
      CREATE INDEX IX_TemplateVersions_TemplateId ON AuditTemplateVersions (TemplateId);
      PRINT 'Migration: Created AuditTemplateVersions table';
    END
  `);

  // ── Audits: hardened template linkage (Phase 2) ──────────────────────────
  // Permanent snapshot of which template VERSION/FILE/HASH an audit was
  // created against, stamped server-side at creation time. Existing rows
  // have no source of truth to backfill from, so they stay NULL forever —
  // an accepted, documented gap (unlike Phase 1's hash backfill).
  for (const col of [
    { name: "TemplateVersion",  def: "NVARCHAR(20)  NULL" },
    { name: "TemplateFileName", def: "NVARCHAR(500) NULL" },
    { name: "TemplateHash",     def: "NVARCHAR(64)  NULL" },
    { name: "TemplateSize",     def: "INT           NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Audits')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Audits' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE Audits ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to Audits';
      END
    `);
  }

  // ── CheckpointLibrary: Master Config > Checkpoint Library (Phase 3) ──────
  // Global, admin-curated reusable checkpoints. No FK to AuditTemplates —
  // inserting a library checkpoint into a template makes a fully
  // independent local copy (fresh permanent UUID), same spirit as
  // duplicateTemplate.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='CheckpointLibrary')
    BEGIN
      CREATE TABLE CheckpointLibrary (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        CheckPointText NVARCHAR(500) NOT NULL,
        Method        NVARCHAR(300) NULL,
        Specification NVARCHAR(500) NULL,
        Category      NVARCHAR(100) NULL,
        Required      BIT           NOT NULL DEFAULT 0,
        UsageCount    INT           NOT NULL DEFAULT 0,
        Status        BIT           NOT NULL DEFAULT 1,
        CreatedBy     NVARCHAR(200) NULL,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedBy     NVARCHAR(200) NULL,
        UpdatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Migration: Created CheckpointLibrary table';
    END
  `);

  // ── AuditTemplates: pointer to the current active version's content (Phase 5) ─
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplates')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = 'CurrentVersionContentId'
    )
    BEGIN
      ALTER TABLE AuditTemplates ADD CurrentVersionContentId INT NULL;
      PRINT 'Migration: Added CurrentVersionContentId column to AuditTemplates';
    END
  `);

  // ── AuditTemplateContent: SQL-backed, immutable per-version content (Phase 5) ─
  // Replaces JSON-file storage as the source of truth. TemplateId stays stable
  // across versions (AuditTemplates.Id never changes); each row here is one
  // immutable version's content. Only IsActiveVersion and the approval-status
  // fields on the currently-active row are ever updated after insert.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AuditTemplateContent')
    BEGIN
      CREATE TABLE AuditTemplateContent (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId              INT            NOT NULL,
        Version                 NVARCHAR(20)   NOT NULL,
        HeaderConfig            NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
        InfoFields              NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        Columns                 NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        DefaultSections         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        ContentHash             NVARCHAR(64)   NOT NULL,
        ContentSize             INT            NOT NULL DEFAULT 0,
        SectionCount            INT            NOT NULL DEFAULT 0,
        StageCount              INT            NOT NULL DEFAULT 0,
        CheckpointCount         INT            NOT NULL DEFAULT 0,
        RequiredCheckpointCount INT            NOT NULL DEFAULT 0,
        JsonSchemaVersion       NVARCHAR(10)   NULL DEFAULT '1',
        ApprovalStatus          NVARCHAR(50)   NOT NULL DEFAULT 'draft',
        ApprovedBy              NVARCHAR(200)  NULL,
        ApprovedAt              DATETIME       NULL,
        RejectionReason         NVARCHAR(MAX)  NULL,
        IsActiveVersion         BIT            NOT NULL DEFAULT 0,
        ChangeType              NVARCHAR(20)   NOT NULL DEFAULT 'create',
        CreatedFromVersionId    INT            NULL,
        CreatedBy               NVARCHAR(200)  NULL,
        CreatedAt               DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_TemplateContent_Version UNIQUE (TemplateId, Version)
      );
      CREATE INDEX IX_TemplateContent_TemplateId ON AuditTemplateContent (TemplateId);
      CREATE INDEX IX_TemplateContent_ActiveLookup ON AuditTemplateContent (TemplateId, IsActiveVersion) WHERE IsActiveVersion = 1;
      PRINT 'Migration: Created AuditTemplateContent table';
    END
  `);

  // ── AuditTemplateHistory: per-version audit-trail columns (Phase 5) ──────
  for (const col of [
    { name: "VersionNumber",     def: "NVARCHAR(20) NULL" },
    { name: "PreviousVersion",   def: "NVARCHAR(20) NULL" },
    { name: "CreatedFromVersion", def: "NVARCHAR(20) NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplateHistory')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplateHistory' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE AuditTemplateHistory ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to AuditTemplateHistory';
      END
    `);
  }

  // ── DrawingPath column on MaterialConfigs ────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MaterialConfigs' AND COLUMN_NAME = 'DrawingPath'
    )
    BEGIN
      ALTER TABLE MaterialConfigs ADD DrawingPath NVARCHAR(500) NULL;
      PRINT 'Migration: Added DrawingPath column to MaterialConfigs';
    END
  `);

  // ── LPTReport: add LPTType column ────────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LPTReport')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'LPTReport' AND COLUMN_NAME = 'LPTType'
    )
    BEGIN
      ALTER TABLE LPTReport ADD LPTType NVARCHAR(50) NULL DEFAULT 'LPT';
      UPDATE LPTReport SET LPTType = 'LPT' WHERE LPTType IS NULL;
      PRINT 'Migration: Added LPTType column to LPTReport';
    END
  `);

  // ── LPTRecipe: add BIS column and auto-classify existing records ─────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LPTRecipe')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'LPTRecipe' AND COLUMN_NAME = 'BIS'
    )
    BEGIN
      ALTER TABLE LPTRecipe ADD BIS NVARCHAR(50) NULL DEFAULT 'Non BIS';
      UPDATE LPTRecipe
        SET BIS = CASE WHEN LEFT(ModelName, 1) IN ('F', 'D') THEN 'BIS' ELSE 'Non BIS' END;
      PRINT 'Migration: Added BIS column to LPTRecipe and classified existing records';
    END
  `);

  // ── AppSettings: global key-value store (e.g. menu layout) ─────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AppSettings')
    BEGIN
      CREATE TABLE AppSettings (
        SettingKey  NVARCHAR(100)  NOT NULL PRIMARY KEY,
        Value       NVARCHAR(MAX)  NULL,
        UpdatedBy   NVARCHAR(100)  NULL,
        UpdatedAt   DATETIME       NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Migration: Created AppSettings table';
    END
  `);

  console.log("Migrations completed.");
};
