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

  // ── BISCategory: per-model schedule overrides for the BIS test-scheduling
  //    feature. NULL on any of these means "use the global default from
  //    BISTestFrequencyConfig" — only set when a specific model deviates
  //    from the standard IS 7872 cadence.
  for (const col of [
    { name: "IntroductionFrequencyMonths", def: "INT NULL" },
    { name: "IntroductionDurationDays",    def: "INT NULL" },
    { name: "SoundFrequencyMonths",        def: "INT NULL" },
    { name: "SoundDurationDays",           def: "INT NULL" },
    { name: "VolumeFrequencyMonths",       def: "INT NULL" },
    { name: "VolumeDurationDays",          def: "INT NULL" },
  ]) {
    await pool1.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BISCategory' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE BISCategory ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to BISCategory (GARUDA)';
      END
    `);
  }

  // ── BISTestFrequencyConfig: single global-settings row for the 3 BIS test
  //    cadences (Introduction/Sound/Volume). FrequencyMonths drives when the
  //    next test falls due; DurationDays is how long that test typically
  //    takes, used to draw the due window on the schedule calendar.
  await pool1.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BISTestFrequencyConfig')
    BEGIN
      CREATE TABLE BISTestFrequencyConfig (
        Id                       INT IDENTITY(1,1) PRIMARY KEY,
        IntroductionFrequencyMonths INT NOT NULL DEFAULT 12,
        IntroductionDurationDays    INT NOT NULL DEFAULT 6,
        SoundFrequencyMonths        INT NOT NULL DEFAULT 6,
        SoundDurationDays           INT NOT NULL DEFAULT 1,
        VolumeFrequencyMonths       INT NOT NULL DEFAULT 3,
        VolumeDurationDays          INT NOT NULL DEFAULT 1,
        UpdatedBy                NVARCHAR(100) NULL,
        UpdatedAt                DATETIME NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO BISTestFrequencyConfig DEFAULT VALUES;
      PRINT 'Migration: Created BISTestFrequencyConfig table (GARUDA)';
    END
  `);

  // ── BISTestReport: header row for every in-app BIS test report (and, with
  //    Status='Baseline', the one-time "last test date" seed rows used before
  //    any real report exists for a model/type). Child tables holding the
  //    per-report-type test data (Pull Down / Energy / Sound / Volume / etc.)
  //    are added in a later migration once the report-entry forms land.
  await pool1.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BISTestReport')
    BEGIN
      CREATE TABLE BISTestReport (
        Id                  INT IDENTITY(1,1) PRIMARY KEY,
        ReportType          NVARCHAR(20)  NOT NULL, -- Introduction | Sound | Volume
        MaterialCode        NVARCHAR(50)  NOT NULL,
        ModelName           NVARCHAR(300) NOT NULL,
        MachineSerialNumber NVARCHAR(100) NULL,
        TestReportNo        NVARCHAR(100) NULL,
        UidNo               NVARCHAR(100) NULL,
        TestDateFrom        DATE          NULL,
        TestDateTo          DATE          NOT NULL, -- what scheduling reads as "last test date"
        TestedBy            NVARCHAR(150) NULL,
        TestStandard        NVARCHAR(300) NULL,
        Result              NVARCHAR(20)  NULL,     -- PASS | FAIL | PENDING
        SampleReceiptDate   DATE          NULL,
        SampleCondition     NVARCHAR(100) NULL,
        PurposeOfTesting    NVARCHAR(200) NULL,
        Remarks             NVARCHAR(MAX) NULL,
        PreparedBy          NVARCHAR(150) NULL,
        ReviewedBy          NVARCHAR(150) NULL,
        AuthorizedBy        NVARCHAR(150) NULL,
        Status              NVARCHAR(20)  NOT NULL DEFAULT 'Draft', -- Baseline | Draft | Final | Superseded
        RootReportId        INT           NULL,     -- self-FK; NULL = this row is v1/root
        Version             INT           NOT NULL DEFAULT 1,
        IsCurrent           BIT           NOT NULL DEFAULT 1,
        CreatedBy           NVARCHAR(100) NULL,
        CreatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedBy           NVARCHAR(100) NULL,
        UpdatedAt           DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_BISTestReport_Root FOREIGN KEY (RootReportId) REFERENCES BISTestReport(Id)
      );
      CREATE INDEX IX_BISTestReport_Model_Type_Current ON BISTestReport (ModelName, ReportType, IsCurrent);
      PRINT 'Migration: Created BISTestReport table (GARUDA)';
    END
  `);

  // ── BISTestReport: appliance-spec header fields that only the Introduction
  //    report captures (nameplate data — manufacturer, refrigerant, rated
  //    volumes/energy — read once at that test, not repeated on Sound/Volume
  //    reports). Kept on the shared header table rather than a dedicated
  //    1:1 child table since they're still header-grain, not test-data-grain.
  for (const col of [
    { name: "ApplianceType", def: "NVARCHAR(100) NULL" },
    { name: "Manufacturer", def: "NVARCHAR(200) NULL" },
    { name: "ProductVariant", def: "NVARCHAR(200) NULL" },
    { name: "RefrigerantName", def: "NVARCHAR(100) NULL" },
    { name: "RatedVoltageFreqPhase", def: "NVARCHAR(100) NULL" },
    { name: "RatedGrossVolumeLitre", def: "DECIMAL(10,2) NULL" },
    { name: "RatedStorageVolumeLitre", def: "DECIMAL(10,2) NULL" },
    { name: "AnnualElectricityConsumptionKwh", def: "DECIMAL(10,2) NULL" },
    { name: "ReportIssueDate", def: "DATE NULL" },
    { name: "TotalPages", def: "INT NULL" },
    { name: "UnitPickedFrom", def: "NVARCHAR(200) NULL" },
  ]) {
    await pool1.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BISTestReport' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE BISTestReport ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to BISTestReport (GARUDA)';
      END
    `);
  }

  // ── Introduction-report child tables (1:1 with BISTestReport) — one per
  //    sub-test sheet in the lab template (Pull Down / Energy / Thermal
  //    Insulation / Temperature Rise). Spec/measured pairs are text where the
  //    lab records a mixed value ("−23.3°C at 200minute", "Not applicable")
  //    and numeric where the sheet is a clean reading (voltage, frequency).
  const introChildTables = {
    BISPullDownTest: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      AmbientConditionsSpec NVARCHAR(150) NULL,
      AmbientConditionsMeasured NVARCHAR(150) NULL,
      TestVoltageSpec NVARCHAR(50) NULL,
      TestVoltageMeasured DECIMAL(6,2) NULL,
      TestFrequencySpec NVARCHAR(50) NULL,
      TestFrequencyMeasured DECIMAL(6,2) NULL,
      F1TempSpec NVARCHAR(150) NULL,
      F1TempMeasured NVARCHAR(150) NULL,
      F2TempSpec NVARCHAR(150) NULL,
      F2TempMeasured NVARCHAR(150) NULL,
      MaxWarmestTempSpec NVARCHAR(150) NULL,
      MaxWarmestTempMeasured NVARCHAR(150) NULL,
      ThermostatSetting NVARCHAR(50) NULL,
      PullDownTimeSpec NVARCHAR(50) NULL,
      PullDownTimeMeasuredMinutes DECIMAL(8,2) NULL,
      Result NVARCHAR(20) NULL,
      Remarks NVARCHAR(MAX) NULL,
      CONSTRAINT FK_BISPullDownTest_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    BISEnergyTest: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      AmbientConditionsSpec NVARCHAR(150) NULL,
      AmbientConditionsWarm NVARCHAR(150) NULL,
      AmbientConditionsCold NVARCHAR(150) NULL,
      TestVoltageSpec NVARCHAR(50) NULL,
      TestVoltageWarm DECIMAL(6,2) NULL,
      TestVoltageCold DECIMAL(6,2) NULL,
      TestFrequencySpec NVARCHAR(50) NULL,
      TestFrequencyWarm DECIMAL(6,2) NULL,
      TestFrequencyCold DECIMAL(6,2) NULL,
      AvgCompartmentTempSpec NVARCHAR(100) NULL,
      AvgCompartmentTempWarm DECIMAL(6,2) NULL,
      AvgCompartmentTempCold DECIMAL(6,2) NULL,
      EnergyMeterReadingWarmWh DECIMAL(10,3) NULL,
      EnergyMeterReadingColdWh DECIMAL(10,3) NULL,
      TimeElapsedWarmMinutes DECIMAL(8,2) NULL,
      TimeElapsedColdMinutes DECIMAL(8,2) NULL,
      PercentRunningTimeWarm DECIMAL(6,3) NULL,
      PercentRunningTimeCold DECIMAL(6,3) NULL,
      TargetTempTx DECIMAL(6,2) NULL,
      MeasuredTempT1 DECIMAL(6,2) NULL,
      EnergyRateE1 DECIMAL(10,4) NULL,
      MeasuredTempT2 DECIMAL(6,2) NULL,
      EnergyRateE2 DECIMAL(10,4) NULL,
      CalculatedEnergyRateExKwhDay DECIMAL(10,4) NULL,
      EnergyPerDayWh DECIMAL(10,2) NULL,
      AnnualEnergyDeclaredKwh DECIMAL(10,2) NULL,
      AnnualEnergyMeasuredKwh DECIMAL(10,3) NULL,
      DeviationSpec NVARCHAR(50) NULL,
      DeviationPercent DECIMAL(6,3) NULL,
      Result NVARCHAR(20) NULL,
      Remarks NVARCHAR(MAX) NULL,
      CONSTRAINT FK_BISEnergyTest_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    BISThermalInsulationTest: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      AmbientConditionsSpec NVARCHAR(150) NULL,
      AmbientConditionsMeasured NVARCHAR(150) NULL,
      TestVoltageSpec NVARCHAR(50) NULL,
      TestVoltageMeasured DECIMAL(6,2) NULL,
      TestFrequencySpec NVARCHAR(50) NULL,
      TestFrequencyMeasured DECIMAL(6,2) NULL,
      AvgCompartmentTempSpec NVARCHAR(100) NULL,
      AvgCompartmentTempMeasured NVARCHAR(100) NULL,
      CondensationSpec NVARCHAR(300) NULL,
      CondensationObservation NVARCHAR(300) NULL,
      Result NVARCHAR(20) NULL,
      Remarks NVARCHAR(MAX) NULL,
      CONSTRAINT FK_BISThermalInsulationTest_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    BISTemperatureRiseTest: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      AmbientConditionsSpec NVARCHAR(150) NULL,
      AmbientConditionsMeasured NVARCHAR(150) NULL,
      TestVoltageSpec NVARCHAR(50) NULL,
      TestVoltageMeasured DECIMAL(6,2) NULL,
      TestFrequencySpec NVARCHAR(50) NULL,
      TestFrequencyMeasured DECIMAL(6,2) NULL,
      WarmestPackageTempSpec NVARCHAR(100) NULL,
      WarmestPackageTempMeasured NVARCHAR(100) NULL,
      TimeToThresholdSpec NVARCHAR(50) NULL,
      TimeToThresholdMeasured NVARCHAR(50) NULL,
      Result NVARCHAR(20) NULL,
      Remarks NVARCHAR(MAX) NULL,
      CONSTRAINT FK_BISTemperatureRiseTest_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    // ── Sound report child (1:many — one row per measurement location) ──────
    BISSoundMeasurement: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      Location NVARCHAR(20) NOT NULL, -- Front | Right | Left
      SpecificationLimit NVARCHAR(50) NULL,
      BackgroundNoiseDba DECIMAL(6,2) NULL,
      MeasuredNoiseDba DECIMAL(6,2) NULL,
      Status NVARCHAR(20) NULL,
      CONSTRAINT FK_BISSoundMeasurement_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    // ── Volume report children (1:many line items + 1:1 summary) ────────────
    BISVolumeMeasurementItem: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      Category NVARCHAR(30) NOT NULL, -- GrossMeasured | GrossDeductible | StorageMeasured | StorageDeductible
      PartName NVARCHAR(200) NULL,
      WidthMm DECIMAL(8,2) NULL,
      DepthMm DECIMAL(8,2) NULL,
      HeightMm DECIMAL(8,2) NULL,
      Quantity INT NULL,
      VolumeLitre DECIMAL(10,3) NULL,
      CONSTRAINT FK_BISVolumeMeasurementItem_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    BISVolumeSummary: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      TestAmbientSpec NVARCHAR(50) NULL,
      TestAmbientMeasured NVARCHAR(50) NULL,
      GrossTotalMeasuredLitre DECIMAL(10,3) NULL,
      GrossTotalDeductibleLitre DECIMAL(10,3) NULL,
      GrossDeclaredLitre DECIMAL(10,3) NULL,
      GrossMeasuredLitre DECIMAL(10,3) NULL,
      GrossObservationPercent DECIMAL(6,3) NULL,
      GrossResult NVARCHAR(20) NULL,
      StorageTotalMeasuredLitre DECIMAL(10,3) NULL,
      StorageTotalDeductibleLitre DECIMAL(10,3) NULL,
      StorageDeclaredLitre DECIMAL(10,3) NULL,
      StorageMeasuredLitre DECIMAL(10,3) NULL,
      StorageObservationPercent DECIMAL(6,3) NULL,
      StorageResult NVARCHAR(20) NULL,
      Remarks NVARCHAR(MAX) NULL,
      CONSTRAINT FK_BISVolumeSummary_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
    // ── Shared across all 3 report types (1:many) ────────────────────────────
    BISTestReportEquipment: `
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ReportId INT NOT NULL,
      SrNo INT NULL,
      InstrumentName NVARCHAR(200) NULL,
      Make NVARCHAR(100) NULL,
      Model NVARCHAR(100) NULL,
      SerialOrEquipmentId NVARCHAR(100) NULL,
      CalibrationDueDate DATE NULL,
      CONSTRAINT FK_BISTestReportEquipment_Report FOREIGN KEY (ReportId) REFERENCES BISTestReport(Id) ON DELETE CASCADE
    `,
  };

  for (const [tableName, definition] of Object.entries(introChildTables)) {
    await pool1.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}')
      BEGIN
        CREATE TABLE ${tableName} (${definition});
        CREATE INDEX IX_${tableName}_ReportId ON ${tableName} (ReportId);
        PRINT 'Migration: Created ${tableName} table (GARUDA)';
      END
    `);
  }

  // ── PlanOrderPrint: InitialPlanQty freezes the quantity a plan was first
  //    created with. Set once on INSERT and never touched again — later
  //    updates only change PlanQty, so this column stays a permanent record
  //    of what the plan originally asked for.
  await pool1.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PlanOrderPrint')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PlanOrderPrint' AND COLUMN_NAME = 'InitialPlanQty'
    )
    BEGIN
      ALTER TABLE PlanOrderPrint ADD InitialPlanQty INT NULL;
      PRINT 'Migration: Added InitialPlanQty column to PlanOrderPrint (GARUDA)';
    END
  `);

  // Backfill: for existing rows created before this column existed, seed
  // InitialPlanQty from the current PlanQty so the column isn't blank for
  // plans added prior to this feature.
  await pool1.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PlanOrderPrint' AND COLUMN_NAME = 'InitialPlanQty')
    BEGIN
      UPDATE PlanOrderPrint SET InitialPlanQty = PlanQty WHERE InitialPlanQty IS NULL;
    END
  `);

  // ── BISApprovalFlow: single-row config naming which user currently holds
  //    each of the 3 BIS report sign-off roles (Preparer/Reviewer/Authorizer)
  //    and their signature image, used to route the approval queue and to
  //    stamp new report submissions. Editable from BIS Config → Approval Flow.
  await pool1.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BISApprovalFlow')
    BEGIN
      CREATE TABLE BISApprovalFlow (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        PreparerUserCode        NVARCHAR(50)  NULL,
        PreparerSignaturePath   NVARCHAR(300) NULL,
        ReviewerUserCode        NVARCHAR(50)  NULL,
        ReviewerSignaturePath   NVARCHAR(300) NULL,
        AuthorizerUserCode      NVARCHAR(50)  NULL,
        AuthorizerSignaturePath NVARCHAR(300) NULL,
        UpdatedBy               NVARCHAR(100) NULL,
        UpdatedAt               DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO BISApprovalFlow (PreparerUserCode, ReviewerUserCode, AuthorizerUserCode)
      VALUES ('125016', '124042', '125031');
      PRINT 'Migration: Created BISApprovalFlow table (GARUDA)';
    END
  `);

  // ── BISTestReport: per-report snapshot of who actually acted at each
  //    workflow stage and when, plus their signature image at that moment —
  //    kept on the report row (not just read live from BISApprovalFlow) so a
  //    later flow-config change never retroactively alters an already-signed
  //    report. WorkflowRemarks holds the most recent reject reason, if any.
  //    Status gains two new values used between Draft and Final: PendingReview
  //    (submitted by the preparer, awaiting the reviewer) and PendingApproval
  //    (reviewed, awaiting the authorizer) — both fit the existing NVARCHAR(20).
  for (const col of [
    { name: "PreparerUserCode", def: "NVARCHAR(50) NULL" },
    { name: "PreparerSignaturePath", def: "NVARCHAR(300) NULL" },
    { name: "PreparerActionAt", def: "DATETIME NULL" },
    { name: "ReviewerUserCode", def: "NVARCHAR(50) NULL" },
    { name: "ReviewerSignaturePath", def: "NVARCHAR(300) NULL" },
    { name: "ReviewerActionAt", def: "DATETIME NULL" },
    { name: "AuthorizerUserCode", def: "NVARCHAR(50) NULL" },
    { name: "AuthorizerSignaturePath", def: "NVARCHAR(300) NULL" },
    { name: "AuthorizerActionAt", def: "DATETIME NULL" },
    { name: "WorkflowRemarks", def: "NVARCHAR(500) NULL" },
  ]) {
    await pool1.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BISTestReport' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE BISTestReport ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to BISTestReport (GARUDA)';
      END
    `);
  }
  console.log("GARUDA migrations completed.");
};
