import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const REPORT_TYPES = ["Introduction", "Sound", "Volume"];
const SOUND_LOCATIONS = ["Front", "Right", "Left"];
const VOLUME_CATEGORIES = ["GrossMeasured", "GrossDeductible", "StorageMeasured", "StorageDeductible"];

const num = (v) => (v === "" || v === undefined || v === null ? null : Number(v));
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
  const { reportType, header, testData, equipment, status } = req.body;
  validatePayload({ reportType, header });
  const finalStatus = status === "Final" ? "Final" : "Draft";
  const createdBy = req.user?.name || req.user?.usercode || "system";

  const pool = await connectToDB(dbConfig1);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const reportId = await insertHeader(transaction, {
      reportType, header, status: finalStatus, createdBy, rootReportId: null, version: 1,
    });
    await insertChildrenByType(transaction, reportType, reportId, testData, equipment);
    await transaction.commit();
    res.status(200).json({ success: true, id: reportId, message: "BIS test report saved successfully." });
  } catch (error) {
    await transaction.rollback();
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
             TestDateFrom, TestDateTo, TestedBy, Result, Status, Version, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
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
  const { reportType, header, testData, equipment, status } = req.body;
  if (!id) throw new AppError("Missing required field: id.", 400);
  validatePayload({ reportType, header });
  const finalStatus = status === "Final" ? "Final" : "Draft";
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
        .input("Status", sql.NVarChar(20), finalStatus)
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
        reportType, header, status: finalStatus, createdBy: updatedBy,
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
    await transaction.rollback();
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
    if (existing.recordset[0].Status !== "Draft") {
      throw new AppError("Only Draft reports can be deleted. Final reports are kept for the audit trail.", 400);
    }

    await pool.request().input("Id", sql.Int, reportId).query(`DELETE FROM BISTestReport WHERE Id = @Id`);
    res.status(200).json({ success: true, message: "Draft report deleted successfully." });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete BIS test report: ${error.message}`, 500);
  }
});
