import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const REPORT_TYPES = ["Introduction", "Sound", "Volume"];
const SOUND_LOCATIONS = ["Front", "Right", "Left"];
const VOLUME_CATEGORIES = ["GrossMeasured", "GrossDeductible", "StorageMeasured", "StorageDeductible"];

// Falls back to null for anything that isn't cleanly numeric (blank, stray
// text, etc.) rather than letting a NaN through — sql.Decimal/sql.Int both
// reject NaN at the wire-protocol level with a generic, hard-to-trace
// "not a valid instance of data type decimal" error instead of failing here
// with a clear cause.
const num = (v) => {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v === "" || v === undefined ? null : v);
const dateOrNull = (v) => (v ? new Date(v) : null);

/* ═══════════════════════════════════════════════════════════════════════
   Header insert — common to all 3 report types, plus the Introduction-only
   nameplate fields (left NULL for Sound/Volume).
═══════════════════════════════════════════════════════════════════════ */
const insertHeader = async (txn, { reportType, header, status, createdBy, rootReportId, version }) => {
  const h = header || {};
  const request = new sql.Request(txn)
    .input("ReportType", sql.NVarChar(20), reportType)
    .input("MaterialCode", sql.NVarChar(50), h.materialCode)
    .input("ModelName", sql.NVarChar(300), h.modelName)
    .input("MachineSerialNumber", sql.NVarChar(100), str(h.machineSerialNumber))
    .input("TestReportNo", sql.NVarChar(100), str(h.testReportNo))
    .input("UidNo", sql.NVarChar(100), str(h.uidNo))
    .input("TestDateFrom", sql.Date, dateOrNull(h.testDateFrom))
    .input("TestDateTo", sql.Date, dateOrNull(h.testDateTo))
    .input("TestedBy", sql.NVarChar(150), str(h.testedBy))
    .input("TestStandard", sql.NVarChar(300), str(h.testStandard))
    .input("Result", sql.NVarChar(20), str(h.result))
    .input("SampleReceiptDate", sql.Date, dateOrNull(h.sampleReceiptDate))
    .input("SampleCondition", sql.NVarChar(100), str(h.sampleCondition))
    .input("PurposeOfTesting", sql.NVarChar(200), str(h.purposeOfTesting))
    .input("Remarks", sql.NVarChar(sql.MAX), str(h.remarks))
    .input("PreparedBy", sql.NVarChar(150), str(h.preparedBy))
    .input("ReviewedBy", sql.NVarChar(150), str(h.reviewedBy))
    .input("AuthorizedBy", sql.NVarChar(150), str(h.authorizedBy))
    .input("Status", sql.NVarChar(20), status)
    .input("RootReportId", sql.Int, rootReportId)
    .input("Version", sql.Int, version)
    .input("CreatedBy", sql.NVarChar(100), createdBy)
    .input("ApplianceType", sql.NVarChar(100), str(h.applianceType))
    .input("Manufacturer", sql.NVarChar(200), str(h.manufacturer))
    .input("ProductVariant", sql.NVarChar(200), str(h.productVariant))
    .input("RefrigerantName", sql.NVarChar(100), str(h.refrigerantName))
    .input("RatedVoltageFreqPhase", sql.NVarChar(100), str(h.ratedVoltageFreqPhase))
    .input("RatedGrossVolumeLitre", sql.Decimal(10, 2), num(h.ratedGrossVolumeLitre))
    .input("RatedStorageVolumeLitre", sql.Decimal(10, 2), num(h.ratedStorageVolumeLitre))
    .input("AnnualElectricityConsumptionKwh", sql.Decimal(10, 2), num(h.annualElectricityConsumptionKwh))
    .input("ReportIssueDate", sql.Date, dateOrNull(h.reportIssueDate))
    .input("TotalPages", sql.Int, num(h.totalPages))
    .input("UnitPickedFrom", sql.NVarChar(200), str(h.unitPickedFrom));

  const result = await request.query(`
    INSERT INTO BISTestReport (
      ReportType, MaterialCode, ModelName, MachineSerialNumber, TestReportNo, UidNo,
      TestDateFrom, TestDateTo, TestedBy, TestStandard, Result, SampleReceiptDate,
      SampleCondition, PurposeOfTesting, Remarks, PreparedBy, ReviewedBy, AuthorizedBy,
      Status, RootReportId, Version, IsCurrent, CreatedBy,
      ApplianceType, Manufacturer, ProductVariant, RefrigerantName, RatedVoltageFreqPhase,
      RatedGrossVolumeLitre, RatedStorageVolumeLitre, AnnualElectricityConsumptionKwh,
      ReportIssueDate, TotalPages, UnitPickedFrom
    )
    OUTPUT INSERTED.Id
    VALUES (
      @ReportType, @MaterialCode, @ModelName, @MachineSerialNumber, @TestReportNo, @UidNo,
      @TestDateFrom, @TestDateTo, @TestedBy, @TestStandard, @Result, @SampleReceiptDate,
      @SampleCondition, @PurposeOfTesting, @Remarks, @PreparedBy, @ReviewedBy, @AuthorizedBy,
      @Status, @RootReportId, @Version, 1, @CreatedBy,
      @ApplianceType, @Manufacturer, @ProductVariant, @RefrigerantName, @RatedVoltageFreqPhase,
      @RatedGrossVolumeLitre, @RatedStorageVolumeLitre, @AnnualElectricityConsumptionKwh,
      @ReportIssueDate, @TotalPages, @UnitPickedFrom
    )
  `);
  return result.recordset[0].Id;
};

/* ═══════════════════════════════════════════════════════════════════════
   Child-table inserts — one function per report type.
═══════════════════════════════════════════════════════════════════════ */
const insertIntroductionChildren = async (txn, reportId, testData = {}) => {
  const pd = testData.pullDownTest || {};
  await new sql.Request(txn)
    .input("ReportId", sql.Int, reportId)
    .input("AmbientConditionsSpec", sql.NVarChar(150), str(pd.ambientConditionsSpec))
    .input("AmbientConditionsMeasured", sql.NVarChar(150), str(pd.ambientConditionsMeasured))
    .input("TestVoltageSpec", sql.NVarChar(50), str(pd.testVoltageSpec))
    .input("TestVoltageMeasured", sql.Decimal(6, 2), num(pd.testVoltageMeasured))
    .input("TestFrequencySpec", sql.NVarChar(50), str(pd.testFrequencySpec))
    .input("TestFrequencyMeasured", sql.Decimal(6, 2), num(pd.testFrequencyMeasured))
    .input("F1TempSpec", sql.NVarChar(150), str(pd.f1TempSpec))
    .input("F1TempMeasured", sql.NVarChar(150), str(pd.f1TempMeasured))
    .input("F2TempSpec", sql.NVarChar(150), str(pd.f2TempSpec))
    .input("F2TempMeasured", sql.NVarChar(150), str(pd.f2TempMeasured))
    .input("MaxWarmestTempSpec", sql.NVarChar(150), str(pd.maxWarmestTempSpec))
    .input("MaxWarmestTempMeasured", sql.NVarChar(150), str(pd.maxWarmestTempMeasured))
    .input("ThermostatSetting", sql.NVarChar(50), str(pd.thermostatSetting))
    .input("PullDownTimeSpec", sql.NVarChar(50), str(pd.pullDownTimeSpec))
    .input("PullDownTimeMeasuredMinutes", sql.Decimal(8, 2), num(pd.pullDownTimeMeasuredMinutes))
    .input("Result", sql.NVarChar(20), str(pd.result))
    .input("Remarks", sql.NVarChar(sql.MAX), str(pd.remarks)).query(`
      INSERT INTO BISPullDownTest (
        ReportId, AmbientConditionsSpec, AmbientConditionsMeasured, TestVoltageSpec, TestVoltageMeasured,
        TestFrequencySpec, TestFrequencyMeasured, F1TempSpec, F1TempMeasured, F2TempSpec, F2TempMeasured,
        MaxWarmestTempSpec, MaxWarmestTempMeasured, ThermostatSetting, PullDownTimeSpec,
        PullDownTimeMeasuredMinutes, Result, Remarks
      ) VALUES (
        @ReportId, @AmbientConditionsSpec, @AmbientConditionsMeasured, @TestVoltageSpec, @TestVoltageMeasured,
        @TestFrequencySpec, @TestFrequencyMeasured, @F1TempSpec, @F1TempMeasured, @F2TempSpec, @F2TempMeasured,
        @MaxWarmestTempSpec, @MaxWarmestTempMeasured, @ThermostatSetting, @PullDownTimeSpec,
        @PullDownTimeMeasuredMinutes, @Result, @Remarks
      )
    `);

  const en = testData.energyTest || {};
  await new sql.Request(txn)
    .input("ReportId", sql.Int, reportId)
    .input("AmbientConditionsSpec", sql.NVarChar(150), str(en.ambientConditionsSpec))
    .input("AmbientConditionsWarm", sql.NVarChar(150), str(en.ambientConditionsWarm))
    .input("AmbientConditionsCold", sql.NVarChar(150), str(en.ambientConditionsCold))
    .input("TestVoltageSpec", sql.NVarChar(50), str(en.testVoltageSpec))
    .input("TestVoltageWarm", sql.Decimal(6, 2), num(en.testVoltageWarm))
    .input("TestVoltageCold", sql.Decimal(6, 2), num(en.testVoltageCold))
    .input("TestFrequencySpec", sql.NVarChar(50), str(en.testFrequencySpec))
    .input("TestFrequencyWarm", sql.Decimal(6, 2), num(en.testFrequencyWarm))
    .input("TestFrequencyCold", sql.Decimal(6, 2), num(en.testFrequencyCold))
    .input("AvgCompartmentTempSpec", sql.NVarChar(100), str(en.avgCompartmentTempSpec))
    .input("AvgCompartmentTempWarm", sql.Decimal(6, 2), num(en.avgCompartmentTempWarm))
    .input("AvgCompartmentTempCold", sql.Decimal(6, 2), num(en.avgCompartmentTempCold))
    .input("EnergyMeterReadingWarmWh", sql.Decimal(10, 3), num(en.energyMeterReadingWarmWh))
    .input("EnergyMeterReadingColdWh", sql.Decimal(10, 3), num(en.energyMeterReadingColdWh))
    .input("TimeElapsedWarmMinutes", sql.Decimal(8, 2), num(en.timeElapsedWarmMinutes))
    .input("TimeElapsedColdMinutes", sql.Decimal(8, 2), num(en.timeElapsedColdMinutes))
    .input("PercentRunningTimeWarm", sql.Decimal(6, 3), num(en.percentRunningTimeWarm))
    .input("PercentRunningTimeCold", sql.Decimal(6, 3), num(en.percentRunningTimeCold))
    .input("TargetTempTx", sql.Decimal(6, 2), num(en.targetTempTx))
    .input("MeasuredTempT1", sql.Decimal(6, 2), num(en.measuredTempT1))
    .input("EnergyRateE1", sql.Decimal(10, 4), num(en.energyRateE1))
    .input("MeasuredTempT2", sql.Decimal(6, 2), num(en.measuredTempT2))
    .input("EnergyRateE2", sql.Decimal(10, 4), num(en.energyRateE2))
    .input("CalculatedEnergyRateExKwhDay", sql.Decimal(10, 4), num(en.calculatedEnergyRateExKwhDay))
    .input("EnergyPerDayWh", sql.Decimal(10, 2), num(en.energyPerDayWh))
    .input("AnnualEnergyDeclaredKwh", sql.Decimal(10, 2), num(en.annualEnergyDeclaredKwh))
    .input("AnnualEnergyMeasuredKwh", sql.Decimal(10, 3), num(en.annualEnergyMeasuredKwh))
    .input("DeviationSpec", sql.NVarChar(50), str(en.deviationSpec))
    .input("DeviationPercent", sql.Decimal(6, 3), num(en.deviationPercent))
    .input("Result", sql.NVarChar(20), str(en.result))
    .input("Remarks", sql.NVarChar(sql.MAX), str(en.remarks)).query(`
      INSERT INTO BISEnergyTest (
        ReportId, AmbientConditionsSpec, AmbientConditionsWarm, AmbientConditionsCold,
        TestVoltageSpec, TestVoltageWarm, TestVoltageCold, TestFrequencySpec, TestFrequencyWarm, TestFrequencyCold,
        AvgCompartmentTempSpec, AvgCompartmentTempWarm, AvgCompartmentTempCold,
        EnergyMeterReadingWarmWh, EnergyMeterReadingColdWh, TimeElapsedWarmMinutes, TimeElapsedColdMinutes,
        PercentRunningTimeWarm, PercentRunningTimeCold, TargetTempTx, MeasuredTempT1, EnergyRateE1,
        MeasuredTempT2, EnergyRateE2, CalculatedEnergyRateExKwhDay, EnergyPerDayWh,
        AnnualEnergyDeclaredKwh, AnnualEnergyMeasuredKwh, DeviationSpec, DeviationPercent, Result, Remarks
      ) VALUES (
        @ReportId, @AmbientConditionsSpec, @AmbientConditionsWarm, @AmbientConditionsCold,
        @TestVoltageSpec, @TestVoltageWarm, @TestVoltageCold, @TestFrequencySpec, @TestFrequencyWarm, @TestFrequencyCold,
        @AvgCompartmentTempSpec, @AvgCompartmentTempWarm, @AvgCompartmentTempCold,
        @EnergyMeterReadingWarmWh, @EnergyMeterReadingColdWh, @TimeElapsedWarmMinutes, @TimeElapsedColdMinutes,
        @PercentRunningTimeWarm, @PercentRunningTimeCold, @TargetTempTx, @MeasuredTempT1, @EnergyRateE1,
        @MeasuredTempT2, @EnergyRateE2, @CalculatedEnergyRateExKwhDay, @EnergyPerDayWh,
        @AnnualEnergyDeclaredKwh, @AnnualEnergyMeasuredKwh, @DeviationSpec, @DeviationPercent, @Result, @Remarks
      )
    `);

  const ti = testData.thermalInsulationTest || {};
  await new sql.Request(txn)
    .input("ReportId", sql.Int, reportId)
    .input("AmbientConditionsSpec", sql.NVarChar(150), str(ti.ambientConditionsSpec))
    .input("AmbientConditionsMeasured", sql.NVarChar(150), str(ti.ambientConditionsMeasured))
    .input("TestVoltageSpec", sql.NVarChar(50), str(ti.testVoltageSpec))
    .input("TestVoltageMeasured", sql.Decimal(6, 2), num(ti.testVoltageMeasured))
    .input("TestFrequencySpec", sql.NVarChar(50), str(ti.testFrequencySpec))
    .input("TestFrequencyMeasured", sql.Decimal(6, 2), num(ti.testFrequencyMeasured))
    .input("AvgCompartmentTempSpec", sql.NVarChar(100), str(ti.avgCompartmentTempSpec))
    .input("AvgCompartmentTempMeasured", sql.NVarChar(100), str(ti.avgCompartmentTempMeasured))
    .input("CondensationSpec", sql.NVarChar(300), str(ti.condensationSpec))
    .input("CondensationObservation", sql.NVarChar(300), str(ti.condensationObservation))
    .input("Result", sql.NVarChar(20), str(ti.result))
    .input("Remarks", sql.NVarChar(sql.MAX), str(ti.remarks)).query(`
      INSERT INTO BISThermalInsulationTest (
        ReportId, AmbientConditionsSpec, AmbientConditionsMeasured, TestVoltageSpec, TestVoltageMeasured,
        TestFrequencySpec, TestFrequencyMeasured, AvgCompartmentTempSpec, AvgCompartmentTempMeasured,
        CondensationSpec, CondensationObservation, Result, Remarks
      ) VALUES (
        @ReportId, @AmbientConditionsSpec, @AmbientConditionsMeasured, @TestVoltageSpec, @TestVoltageMeasured,
        @TestFrequencySpec, @TestFrequencyMeasured, @AvgCompartmentTempSpec, @AvgCompartmentTempMeasured,
        @CondensationSpec, @CondensationObservation, @Result, @Remarks
      )
    `);

  const tr = testData.temperatureRiseTest || {};
  await new sql.Request(txn)
    .input("ReportId", sql.Int, reportId)
    .input("AmbientConditionsSpec", sql.NVarChar(150), str(tr.ambientConditionsSpec))
    .input("AmbientConditionsMeasured", sql.NVarChar(150), str(tr.ambientConditionsMeasured))
    .input("TestVoltageSpec", sql.NVarChar(50), str(tr.testVoltageSpec))
    .input("TestVoltageMeasured", sql.Decimal(6, 2), num(tr.testVoltageMeasured))
    .input("TestFrequencySpec", sql.NVarChar(50), str(tr.testFrequencySpec))
    .input("TestFrequencyMeasured", sql.Decimal(6, 2), num(tr.testFrequencyMeasured))
    .input("WarmestPackageTempSpec", sql.NVarChar(100), str(tr.warmestPackageTempSpec))
    .input("WarmestPackageTempMeasured", sql.NVarChar(100), str(tr.warmestPackageTempMeasured))
    .input("TimeToThresholdSpec", sql.NVarChar(50), str(tr.timeToThresholdSpec))
    .input("TimeToThresholdMeasured", sql.NVarChar(50), str(tr.timeToThresholdMeasured))
    .input("Result", sql.NVarChar(20), str(tr.result))
    .input("Remarks", sql.NVarChar(sql.MAX), str(tr.remarks)).query(`
      INSERT INTO BISTemperatureRiseTest (
        ReportId, AmbientConditionsSpec, AmbientConditionsMeasured, TestVoltageSpec, TestVoltageMeasured,
        TestFrequencySpec, TestFrequencyMeasured, WarmestPackageTempSpec, WarmestPackageTempMeasured,
        TimeToThresholdSpec, TimeToThresholdMeasured, Result, Remarks
      ) VALUES (
        @ReportId, @AmbientConditionsSpec, @AmbientConditionsMeasured, @TestVoltageSpec, @TestVoltageMeasured,
        @TestFrequencySpec, @TestFrequencyMeasured, @WarmestPackageTempSpec, @WarmestPackageTempMeasured,
        @TimeToThresholdSpec, @TimeToThresholdMeasured, @Result, @Remarks
      )
    `);
};

const insertSoundChildren = async (txn, reportId, testData = {}) => {
  const measurements = Array.isArray(testData.measurements) ? testData.measurements : [];
  for (const loc of SOUND_LOCATIONS) {
    const m = measurements.find((x) => x.location === loc) || {};
    if (!m.location && m.backgroundNoiseDba === undefined && m.measuredNoiseDba === undefined) continue;
    await new sql.Request(txn)
      .input("ReportId", sql.Int, reportId)
      .input("Location", sql.NVarChar(20), loc)
      .input("SpecificationLimit", sql.NVarChar(50), str(m.specificationLimit))
      .input("BackgroundNoiseDba", sql.Decimal(6, 2), num(m.backgroundNoiseDba))
      .input("MeasuredNoiseDba", sql.Decimal(6, 2), num(m.measuredNoiseDba))
      .input("Status", sql.NVarChar(20), str(m.status)).query(`
        INSERT INTO BISSoundMeasurement (ReportId, Location, SpecificationLimit, BackgroundNoiseDba, MeasuredNoiseDba, Status)
        VALUES (@ReportId, @Location, @SpecificationLimit, @BackgroundNoiseDba, @MeasuredNoiseDba, @Status)
      `);
  }
};

const insertVolumeChildren = async (txn, reportId, testData = {}) => {
  const items = Array.isArray(testData.items) ? testData.items : [];
  for (const item of items) {
    if (!VOLUME_CATEGORIES.includes(item.category)) continue;
    await new sql.Request(txn)
      .input("ReportId", sql.Int, reportId)
      .input("Category", sql.NVarChar(30), item.category)
      .input("PartName", sql.NVarChar(200), str(item.partName))
      .input("WidthMm", sql.Decimal(8, 2), num(item.widthMm))
      .input("DepthMm", sql.Decimal(8, 2), num(item.depthMm))
      .input("HeightMm", sql.Decimal(8, 2), num(item.heightMm))
      .input("Quantity", sql.Int, num(item.quantity))
      .input("VolumeLitre", sql.Decimal(10, 3), num(item.volumeLitre)).query(`
        INSERT INTO BISVolumeMeasurementItem (ReportId, Category, PartName, WidthMm, DepthMm, HeightMm, Quantity, VolumeLitre)
        VALUES (@ReportId, @Category, @PartName, @WidthMm, @DepthMm, @HeightMm, @Quantity, @VolumeLitre)
      `);
  }

  const s = testData.summary || {};
  await new sql.Request(txn)
    .input("ReportId", sql.Int, reportId)
    .input("TestAmbientSpec", sql.NVarChar(50), str(s.testAmbientSpec))
    .input("TestAmbientMeasured", sql.NVarChar(50), str(s.testAmbientMeasured))
    .input("GrossTotalMeasuredLitre", sql.Decimal(10, 3), num(s.grossTotalMeasuredLitre))
    .input("GrossTotalDeductibleLitre", sql.Decimal(10, 3), num(s.grossTotalDeductibleLitre))
    .input("GrossDeclaredLitre", sql.Decimal(10, 3), num(s.grossDeclaredLitre))
    .input("GrossMeasuredLitre", sql.Decimal(10, 3), num(s.grossMeasuredLitre))
    .input("GrossObservationPercent", sql.Decimal(6, 3), num(s.grossObservationPercent))
    .input("GrossResult", sql.NVarChar(20), str(s.grossResult))
    .input("StorageTotalMeasuredLitre", sql.Decimal(10, 3), num(s.storageTotalMeasuredLitre))
    .input("StorageTotalDeductibleLitre", sql.Decimal(10, 3), num(s.storageTotalDeductibleLitre))
    .input("StorageDeclaredLitre", sql.Decimal(10, 3), num(s.storageDeclaredLitre))
    .input("StorageMeasuredLitre", sql.Decimal(10, 3), num(s.storageMeasuredLitre))
    .input("StorageObservationPercent", sql.Decimal(6, 3), num(s.storageObservationPercent))
    .input("StorageResult", sql.NVarChar(20), str(s.storageResult))
    .input("Remarks", sql.NVarChar(sql.MAX), str(s.remarks)).query(`
      INSERT INTO BISVolumeSummary (
        ReportId, TestAmbientSpec, TestAmbientMeasured, GrossTotalMeasuredLitre, GrossTotalDeductibleLitre,
        GrossDeclaredLitre, GrossMeasuredLitre, GrossObservationPercent, GrossResult,
        StorageTotalMeasuredLitre, StorageTotalDeductibleLitre, StorageDeclaredLitre, StorageMeasuredLitre,
        StorageObservationPercent, StorageResult, Remarks
      ) VALUES (
        @ReportId, @TestAmbientSpec, @TestAmbientMeasured, @GrossTotalMeasuredLitre, @GrossTotalDeductibleLitre,
        @GrossDeclaredLitre, @GrossMeasuredLitre, @GrossObservationPercent, @GrossResult,
        @StorageTotalMeasuredLitre, @StorageTotalDeductibleLitre, @StorageDeclaredLitre, @StorageMeasuredLitre,
        @StorageObservationPercent, @StorageResult, @Remarks
      )
    `);
};

const insertEquipment = async (txn, reportId, equipment = []) => {
  let srNo = 1;
  for (const e of equipment) {
    if (!e.instrumentName && !e.serialOrEquipmentId) continue;
    await new sql.Request(txn)
      .input("ReportId", sql.Int, reportId)
      .input("SrNo", sql.Int, srNo++)
      .input("InstrumentName", sql.NVarChar(200), str(e.instrumentName))
      .input("Make", sql.NVarChar(100), str(e.make))
      .input("Model", sql.NVarChar(100), str(e.model))
      .input("SerialOrEquipmentId", sql.NVarChar(100), str(e.serialOrEquipmentId))
      .input("CalibrationDueDate", sql.Date, dateOrNull(e.calibrationDueDate)).query(`
        INSERT INTO BISTestReportEquipment (ReportId, SrNo, InstrumentName, Make, Model, SerialOrEquipmentId, CalibrationDueDate)
        VALUES (@ReportId, @SrNo, @InstrumentName, @Make, @Model, @SerialOrEquipmentId, @CalibrationDueDate)
      `);
  }
};

const insertChildrenByType = async (txn, reportType, reportId, testData, equipment) => {
  if (reportType === "Introduction") await insertIntroductionChildren(txn, reportId, testData);
  else if (reportType === "Sound") await insertSoundChildren(txn, reportId, testData);
  else if (reportType === "Volume") await insertVolumeChildren(txn, reportId, testData);
  await insertEquipment(txn, reportId, equipment);
};

const validatePayload = ({ reportType, header }) => {
  if (!REPORT_TYPES.includes(reportType)) {
    throw new AppError(`Invalid reportType. Must be one of: ${REPORT_TYPES.join(", ")}.`, 400);
  }
  if (!header?.materialCode || !header?.modelName || !header?.testDateTo) {
    throw new AppError("Missing required header fields: materialCode, modelName, testDateTo.", 400);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   CREATE
═══════════════════════════════════════════════════════════════════════ */
export const createBisTestReport = tryCatch(async (req, res) => {
  const { reportType, header, testData, equipment } = req.body;
  validatePayload({ reportType, header });
  // Reports always start life as a Draft now — "Final" is only reached by
  // walking the Preparer → Reviewer → Authorizer approval chain (see
  // submitBisTestReportForReview / reviewBisTestReport / authorizeBisTestReport
  // below), never set directly from the create/edit form.
  const createdBy = req.user?.name || req.user?.usercode || "system";

  const pool = await connectToDB(dbConfig1);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const reportId = await insertHeader(transaction, {
      reportType, header, status: "Draft", createdBy, rootReportId: null, version: 1,
    });
    await insertChildrenByType(transaction, reportType, reportId, testData, equipment);
    await transaction.commit();
    res.status(200).json({ success: true, id: reportId, message: "BIS test report saved successfully." });
  } catch (error) {
    // SQL Server can auto-abort the transaction server-side on a severe
    // error (bad data type conversion, constraint violation, etc.), which
    // then makes the client-side rollback() call itself throw "Transaction
    // has been aborted." Swallow that secondary failure here so it never
    // replaces/hides the original error below.
    try { await transaction.rollback(); } catch { /* transaction already gone server-side */ }
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to save BIS test report: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   LIST
═══════════════════════════════════════════════════════════════════════ */
export const getBisTestReports = tryCatch(async (req, res) => {
  const { reportType, modelName, status } = req.query;

  try {
    const pool = await connectToDB(dbConfig1);
    const request = pool.request();
    const conditions = ["IsCurrent = 1", "Status != 'Baseline'"];

    if (reportType && REPORT_TYPES.includes(reportType)) {
      conditions.push("ReportType = @ReportType");
      request.input("ReportType", sql.NVarChar(20), reportType);
    }
    if (modelName) {
      conditions.push("ModelName LIKE @ModelName");
      request.input("ModelName", sql.NVarChar(300), `%${modelName}%`);
    }
    if (status) {
      conditions.push("Status = @Status");
      request.input("Status", sql.NVarChar(20), status);
    }

    const result = await request.query(`
      SELECT Id, ReportType, MaterialCode, ModelName, MachineSerialNumber, TestReportNo,
             TestDateFrom, TestDateTo, TestedBy, Result, Status, Version, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt,
             WorkflowRemarks
      FROM BISTestReport
      WHERE ${conditions.join(" AND ")}
      ORDER BY UpdatedAt DESC
    `);

    res.status(200).json({ success: true, reports: result.recordset });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS test reports: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   DETAIL — header + type-specific children + equipment
═══════════════════════════════════════════════════════════════════════ */
export const getBisTestReportById = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Missing required field: id.", 400);

  try {
    const pool = await connectToDB(dbConfig1);
    const reportId = parseInt(id, 10);

    const headerResult = await pool.request().input("Id", sql.Int, reportId).query(`SELECT * FROM BISTestReport WHERE Id = @Id`);
    if (headerResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    const header = headerResult.recordset[0];

    const equipmentResult = await pool.request().input("ReportId", sql.Int, reportId)
      .query(`SELECT * FROM BISTestReportEquipment WHERE ReportId = @ReportId ORDER BY SrNo`);

    let testData = {};
    if (header.ReportType === "Introduction") {
      const [pd, en, ti, tr] = await Promise.all([
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISPullDownTest WHERE ReportId = @ReportId`),
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISEnergyTest WHERE ReportId = @ReportId`),
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISThermalInsulationTest WHERE ReportId = @ReportId`),
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISTemperatureRiseTest WHERE ReportId = @ReportId`),
      ]);
      testData = {
        pullDownTest: pd.recordset[0] || null,
        energyTest: en.recordset[0] || null,
        thermalInsulationTest: ti.recordset[0] || null,
        temperatureRiseTest: tr.recordset[0] || null,
      };
    } else if (header.ReportType === "Sound") {
      const m = await pool.request().input("ReportId", sql.Int, reportId)
        .query(`SELECT * FROM BISSoundMeasurement WHERE ReportId = @ReportId ORDER BY Id`);
      testData = { measurements: m.recordset };
    } else if (header.ReportType === "Volume") {
      const [items, summary] = await Promise.all([
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISVolumeMeasurementItem WHERE ReportId = @ReportId ORDER BY Id`),
        pool.request().input("ReportId", sql.Int, reportId).query(`SELECT * FROM BISVolumeSummary WHERE ReportId = @ReportId`),
      ]);
      testData = { items: items.recordset, summary: summary.recordset[0] || null };
    }

    res.status(200).json({ success: true, header, testData, equipment: equipmentResult.recordset });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS test report: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   HISTORY — every version in a report's chain
═══════════════════════════════════════════════════════════════════════ */
export const getBisTestReportHistory = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Missing required field: id.", 400);

  try {
    const pool = await connectToDB(dbConfig1);
    const reportId = parseInt(id, 10);

    const current = await pool.request().input("Id", sql.Int, reportId).query(`SELECT Id, RootReportId FROM BISTestReport WHERE Id = @Id`);
    if (current.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    const rootId = current.recordset[0].RootReportId || current.recordset[0].Id;

    const result = await pool.request().input("RootId", sql.Int, rootId).query(`
      SELECT Id, Version, Status, TestDateTo, Result, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      FROM BISTestReport
      WHERE Id = @RootId OR RootReportId = @RootId
      ORDER BY Version ASC
    `);

    res.status(200).json({ success: true, history: result.recordset });
  } catch (error) {
    throw new AppError(`Failed to fetch BIS test report history: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UPDATE — Draft reports are updated in place (nothing official to preserve
   yet); Final reports are versioned (new row, old one marked Superseded) so
   the audit history stays intact.
═══════════════════════════════════════════════════════════════════════ */
export const updateBisTestReport = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { reportType, header, testData, equipment } = req.body;
  if (!id) throw new AppError("Missing required field: id.", 400);
  validatePayload({ reportType, header });
  const updatedBy = req.user?.name || req.user?.usercode || "system";

  const pool = await connectToDB(dbConfig1);
  const existingResult = await pool.request().input("Id", sql.Int, parseInt(id, 10))
    .query(`SELECT * FROM BISTestReport WHERE Id = @Id AND IsCurrent = 1`);
  if (existingResult.recordset.length === 0) {
    throw new AppError("Report not found or is not the current version.", 404);
  }
  const existing = existingResult.recordset[0];
  if (existing.ReportType !== reportType) {
    throw new AppError("Report type cannot be changed on update.", 400);
  }
  if (existing.Status === "PendingReview" || existing.Status === "PendingApproval") {
    throw new AppError(
      `This report is currently ${existing.Status === "PendingReview" ? "pending review" : "pending approval"} and cannot be edited. Reject it back to Draft first, or wait for the approval decision.`,
      409,
    );
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    let reportId;

    if (existing.Status === "Draft") {
      // In-place: no official version to preserve yet — replace header + children.
      await new sql.Request(transaction).input("ReportId", sql.Int, existing.Id).query(`
        DELETE FROM BISPullDownTest WHERE ReportId = @ReportId;
        DELETE FROM BISEnergyTest WHERE ReportId = @ReportId;
        DELETE FROM BISThermalInsulationTest WHERE ReportId = @ReportId;
        DELETE FROM BISTemperatureRiseTest WHERE ReportId = @ReportId;
        DELETE FROM BISSoundMeasurement WHERE ReportId = @ReportId;
        DELETE FROM BISVolumeMeasurementItem WHERE ReportId = @ReportId;
        DELETE FROM BISVolumeSummary WHERE ReportId = @ReportId;
        DELETE FROM BISTestReportEquipment WHERE ReportId = @ReportId;
      `);

      const h = header;
      await new sql.Request(transaction)
        .input("Id", sql.Int, existing.Id)
        .input("MaterialCode", sql.NVarChar(50), h.materialCode)
        .input("ModelName", sql.NVarChar(300), h.modelName)
        .input("MachineSerialNumber", sql.NVarChar(100), str(h.machineSerialNumber))
        .input("TestReportNo", sql.NVarChar(100), str(h.testReportNo))
        .input("UidNo", sql.NVarChar(100), str(h.uidNo))
        .input("TestDateFrom", sql.Date, dateOrNull(h.testDateFrom))
        .input("TestDateTo", sql.Date, dateOrNull(h.testDateTo))
        .input("TestedBy", sql.NVarChar(150), str(h.testedBy))
        .input("TestStandard", sql.NVarChar(300), str(h.testStandard))
        .input("Result", sql.NVarChar(20), str(h.result))
        .input("SampleReceiptDate", sql.Date, dateOrNull(h.sampleReceiptDate))
        .input("SampleCondition", sql.NVarChar(100), str(h.sampleCondition))
        .input("PurposeOfTesting", sql.NVarChar(200), str(h.purposeOfTesting))
        .input("Remarks", sql.NVarChar(sql.MAX), str(h.remarks))
        .input("PreparedBy", sql.NVarChar(150), str(h.preparedBy))
        .input("ReviewedBy", sql.NVarChar(150), str(h.reviewedBy))
        .input("AuthorizedBy", sql.NVarChar(150), str(h.authorizedBy))
        .input("Status", sql.NVarChar(20), "Draft")
        .input("UpdatedBy", sql.NVarChar(100), updatedBy)
        .input("ApplianceType", sql.NVarChar(100), str(h.applianceType))
        .input("Manufacturer", sql.NVarChar(200), str(h.manufacturer))
        .input("ProductVariant", sql.NVarChar(200), str(h.productVariant))
        .input("RefrigerantName", sql.NVarChar(100), str(h.refrigerantName))
        .input("RatedVoltageFreqPhase", sql.NVarChar(100), str(h.ratedVoltageFreqPhase))
        .input("RatedGrossVolumeLitre", sql.Decimal(10, 2), num(h.ratedGrossVolumeLitre))
        .input("RatedStorageVolumeLitre", sql.Decimal(10, 2), num(h.ratedStorageVolumeLitre))
        .input("AnnualElectricityConsumptionKwh", sql.Decimal(10, 2), num(h.annualElectricityConsumptionKwh))
        .input("ReportIssueDate", sql.Date, dateOrNull(h.reportIssueDate))
        .input("TotalPages", sql.Int, num(h.totalPages))
        .input("UnitPickedFrom", sql.NVarChar(200), str(h.unitPickedFrom)).query(`
          UPDATE BISTestReport SET
            MaterialCode = @MaterialCode, ModelName = @ModelName, MachineSerialNumber = @MachineSerialNumber,
            TestReportNo = @TestReportNo, UidNo = @UidNo, TestDateFrom = @TestDateFrom, TestDateTo = @TestDateTo,
            TestedBy = @TestedBy, TestStandard = @TestStandard, Result = @Result, SampleReceiptDate = @SampleReceiptDate,
            SampleCondition = @SampleCondition, PurposeOfTesting = @PurposeOfTesting, Remarks = @Remarks,
            PreparedBy = @PreparedBy, ReviewedBy = @ReviewedBy, AuthorizedBy = @AuthorizedBy,
            Status = @Status, UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE(),
            ApplianceType = @ApplianceType, Manufacturer = @Manufacturer, ProductVariant = @ProductVariant,
            RefrigerantName = @RefrigerantName, RatedVoltageFreqPhase = @RatedVoltageFreqPhase,
            RatedGrossVolumeLitre = @RatedGrossVolumeLitre, RatedStorageVolumeLitre = @RatedStorageVolumeLitre,
            AnnualElectricityConsumptionKwh = @AnnualElectricityConsumptionKwh, ReportIssueDate = @ReportIssueDate,
            TotalPages = @TotalPages, UnitPickedFrom = @UnitPickedFrom
          WHERE Id = @Id
        `);

      reportId = existing.Id;
    } else {
      // Final (or already-Superseded, shouldn't happen since we filter IsCurrent=1):
      // version the chain — insert a new row, retire the old one.
      const rootReportId = existing.RootReportId || existing.Id;
      reportId = await insertHeader(transaction, {
        reportType, header, status: "Draft", createdBy: updatedBy,
        rootReportId, version: existing.Version + 1,
      });
      await new sql.Request(transaction).input("Id", sql.Int, existing.Id).query(`
        UPDATE BISTestReport SET IsCurrent = 0, Status = 'Superseded' WHERE Id = @Id
      `);
    }

    await insertChildrenByType(transaction, reportType, reportId, testData, equipment);
    await transaction.commit();
    res.status(200).json({ success: true, id: reportId, message: "BIS test report updated successfully." });
  } catch (error) {
    // See the matching comment in createBisTestReport — don't let a rollback
    // failure on an already-server-aborted transaction hide the real error.
    try { await transaction.rollback(); } catch { /* transaction already gone server-side */ }
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update BIS test report: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   DELETE — Draft only (Final reports are part of the audit trail; supersede
   via update instead of deleting).
═══════════════════════════════════════════════════════════════════════ */
export const deleteBisTestReport = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Missing required field: id.", 400);

  try {
    const pool = await connectToDB(dbConfig1);
    const reportId = parseInt(id, 10);

    const existing = await pool.request().input("Id", sql.Int, reportId).query(`SELECT Status FROM BISTestReport WHERE Id = @Id`);
    if (existing.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    if (existing.recordset[0].Status !== "Draft" && !isSuperAdmin(req)) {
      throw new AppError("Only Draft reports can be deleted. Final reports are kept for the audit trail.", 400);
    }

    await pool.request().input("Id", sql.Int, reportId).query(`DELETE FROM BISTestReport WHERE Id = @Id`);
    res.status(200).json({ success: true, message: "Draft report deleted successfully." });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete BIS test report: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   APPROVAL WORKFLOW — Draft → PendingReview → PendingApproval → Final.
   Each step is gated to the one user currently holding that role in
   BISApprovalFlow, and snapshots that user's name + signature image onto
   the report row so a later flow-config change never rewrites who actually
   signed an already-submitted report. A reject at either stage sends the
   report back to Draft (still the same row/version) for the preparer to fix
   and resubmit. Super Admin bypasses all 3 role checks — full access
   regardless of who the flow currently assigns.
═══════════════════════════════════════════════════════════════════════ */
const isSuperAdmin = (req) => (req.user?.roleName || "").toLowerCase() === "super admin";

// req.user.usercode (from the JWT, itself read straight off Users.UserCode)
// and the BISApprovalFlow role columns can each independently come back as a
// number or a string depending on the underlying column type — normalize
// both sides before comparing OR binding to sql.NVarChar, which throws
// "Invalid string." for any non-null, non-string value.
const toStr = (v) => (v === null || v === undefined ? null : String(v));

const getApprovalFlow = async (pool) => {
  const result = await pool.request().query(`SELECT TOP 1 * FROM BISApprovalFlow ORDER BY Id`);
  if (result.recordset.length === 0) {
    throw new AppError("BIS approval flow is not configured. Set it up in BIS Config first.", 500);
  }
  return result.recordset[0];
};

const getCurrentReport = async (pool, reportId) => {
  const result = await pool.request().input("Id", sql.Int, reportId)
    .query(`SELECT * FROM BISTestReport WHERE Id = @Id AND IsCurrent = 1`);
  if (result.recordset.length === 0) {
    throw new AppError("Report not found or is not the current version.", 404);
  }
  return result.recordset[0];
};

export const submitBisTestReportForReview = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Missing required field: id.", 400);
  const usercode = toStr(req.user?.usercode);

  const pool = await connectToDB(dbConfig1);
  const reportId = parseInt(id, 10);
  const report = await getCurrentReport(pool, reportId);
  if (report.Status !== "Draft") {
    throw new AppError(`Only Draft reports can be submitted for review (current status: ${report.Status}).`, 409);
  }

  const flow = await getApprovalFlow(pool);
  if (!flow.PreparerUserCode && !isSuperAdmin(req)) {
    throw new AppError("No preparer is configured in the BIS approval flow.", 400);
  }
  if (usercode !== toStr(flow.PreparerUserCode) && !isSuperAdmin(req)) {
    throw new AppError("Only the assigned preparer can submit this report for review.", 403);
  }

  await pool.request()
    .input("Id", sql.Int, reportId)
    .input("PreparedBy", sql.NVarChar(150), req.user?.name || usercode)
    .input("PreparerUserCode", sql.NVarChar(50), usercode)
    .input("PreparerSignaturePath", sql.NVarChar(300), flow.PreparerSignaturePath)
    .query(`
      UPDATE BISTestReport SET
        Status = 'PendingReview',
        PreparedBy = @PreparedBy, PreparerUserCode = @PreparerUserCode,
        PreparerSignaturePath = @PreparerSignaturePath, PreparerActionAt = GETDATE(),
        WorkflowRemarks = NULL, UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);

  res.status(200).json({ success: true, message: "Report submitted for review." });
});

export const reviewBisTestReport = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { decision, remarks } = req.body;
  if (!id) throw new AppError("Missing required field: id.", 400);
  if (!["approve", "reject"].includes(decision)) throw new AppError("decision must be 'approve' or 'reject'.", 400);
  const usercode = toStr(req.user?.usercode);

  const pool = await connectToDB(dbConfig1);
  const reportId = parseInt(id, 10);
  const report = await getCurrentReport(pool, reportId);
  if (report.Status !== "PendingReview") {
    throw new AppError(`Report is not awaiting review (current status: ${report.Status}).`, 409);
  }

  const flow = await getApprovalFlow(pool);
  if (usercode !== toStr(flow.ReviewerUserCode) && !isSuperAdmin(req)) {
    throw new AppError("Only the assigned reviewer can act on this report.", 403);
  }

  if (decision === "reject") {
    if (!remarks?.trim()) throw new AppError("A remark is required when rejecting a report.", 400);
    await pool.request().input("Id", sql.Int, reportId).input("Remarks", sql.NVarChar(500), remarks.trim())
      .query(`UPDATE BISTestReport SET Status = 'Draft', WorkflowRemarks = @Remarks, UpdatedAt = GETDATE() WHERE Id = @Id`);
    return res.status(200).json({ success: true, message: "Report rejected and returned to the preparer." });
  }

  await pool.request()
    .input("Id", sql.Int, reportId)
    .input("ReviewedBy", sql.NVarChar(150), req.user?.name || usercode)
    .input("ReviewerUserCode", sql.NVarChar(50), usercode)
    .input("ReviewerSignaturePath", sql.NVarChar(300), flow.ReviewerSignaturePath)
    .query(`
      UPDATE BISTestReport SET
        Status = 'PendingApproval',
        ReviewedBy = @ReviewedBy, ReviewerUserCode = @ReviewerUserCode,
        ReviewerSignaturePath = @ReviewerSignaturePath, ReviewerActionAt = GETDATE(),
        WorkflowRemarks = NULL, UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);

  res.status(200).json({ success: true, message: "Report approved and sent to the authorizer." });
});

export const authorizeBisTestReport = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { decision, remarks } = req.body;
  if (!id) throw new AppError("Missing required field: id.", 400);
  if (!["approve", "reject"].includes(decision)) throw new AppError("decision must be 'approve' or 'reject'.", 400);
  const usercode = toStr(req.user?.usercode);

  const pool = await connectToDB(dbConfig1);
  const reportId = parseInt(id, 10);
  const report = await getCurrentReport(pool, reportId);
  if (report.Status !== "PendingApproval") {
    throw new AppError(`Report is not awaiting authorization (current status: ${report.Status}).`, 409);
  }

  const flow = await getApprovalFlow(pool);
  if (usercode !== toStr(flow.AuthorizerUserCode) && !isSuperAdmin(req)) {
    throw new AppError("Only the assigned authorizer can act on this report.", 403);
  }

  if (decision === "reject") {
    if (!remarks?.trim()) throw new AppError("A remark is required when rejecting a report.", 400);
    await pool.request().input("Id", sql.Int, reportId).input("Remarks", sql.NVarChar(500), remarks.trim())
      .query(`UPDATE BISTestReport SET Status = 'Draft', WorkflowRemarks = @Remarks, UpdatedAt = GETDATE() WHERE Id = @Id`);
    return res.status(200).json({ success: true, message: "Report rejected and returned to the preparer." });
  }

  await pool.request()
    .input("Id", sql.Int, reportId)
    .input("AuthorizedBy", sql.NVarChar(150), req.user?.name || usercode)
    .input("AuthorizerUserCode", sql.NVarChar(50), usercode)
    .input("AuthorizerSignaturePath", sql.NVarChar(300), flow.AuthorizerSignaturePath)
    .query(`
      UPDATE BISTestReport SET
        Status = 'Final',
        AuthorizedBy = @AuthorizedBy, AuthorizerUserCode = @AuthorizerUserCode,
        AuthorizerSignaturePath = @AuthorizerSignaturePath, AuthorizerActionAt = GETDATE(),
        WorkflowRemarks = NULL, UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);

  res.status(200).json({ success: true, message: "Report authorized and marked Final." });
});

/* ═══════════════════════════════════════════════════════════════════════
   APPROVAL QUEUE — reports currently awaiting the logged-in user's action,
   split by which of their role(s) (reviewer/authorizer) apply.
═══════════════════════════════════════════════════════════════════════ */
export const getBisApprovalQueue = tryCatch(async (req, res) => {
  const usercode = toStr(req.user?.usercode);
  const pool = await connectToDB(dbConfig1);
  const flow = await getApprovalFlow(pool);

  const admin = isSuperAdmin(req);
  const isReviewer = admin || (Boolean(usercode) && usercode === toStr(flow.ReviewerUserCode));
  const isAuthorizer = admin || (Boolean(usercode) && usercode === toStr(flow.AuthorizerUserCode));

  const conditions = [];
  if (isReviewer) conditions.push("Status = 'PendingReview'");
  if (isAuthorizer) conditions.push("Status = 'PendingApproval'");

  if (conditions.length === 0) {
    return res.status(200).json({ success: true, reports: [], isReviewer, isAuthorizer });
  }

  const result = await pool.request().query(`
    SELECT Id, ReportType, MaterialCode, ModelName, MachineSerialNumber, TestReportNo,
           TestDateFrom, TestDateTo, TestedBy, Result, Status, Version,
           PreparedBy, PreparerActionAt, ReviewedBy, ReviewerActionAt, WorkflowRemarks, UpdatedAt
    FROM BISTestReport
    WHERE IsCurrent = 1 AND (${conditions.join(" OR ")})
    ORDER BY UpdatedAt ASC
  `);

  res.status(200).json({ success: true, reports: result.recordset, isReviewer, isAuthorizer });
});
