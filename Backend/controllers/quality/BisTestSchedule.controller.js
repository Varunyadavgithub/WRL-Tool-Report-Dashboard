import sql from "mssql";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const REPORT_TYPES = ["Introduction", "Sound", "Volume"];

// Final-assembly line station codes — the same "produced" definition used
// throughout production reporting (see Backend/controllers/production/
// totalProduction.controller.js's getStationCodes("final")). A unit only
// counts as produced once it clears one of these stations.
const FINAL_STATION_CODES = ["1220010", "1230017"];
const MAX_PRODUCTION_SHIFT_MONTHS = 12;

// Days-until-due bucketing for the schedule dashboard/calendar.
const scheduleStatus = (lastTestDate, daysUntilDue) => {
  if (!lastTestDate) return "No Baseline";
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 30) return "Due Soon";
  return "Scheduled";
};

const monthKey = (materialCode, date) => `${materialCode}|${date.getFullYear()}-${date.getMonth() + 1}`;
const firstOfNextMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };

/* ═══════════════════════════════════════════════════════════════════════
   Produced-quantity lookup — one row per unit that cleared a final-line
   station (ActivityType 5), grouped by model/year/month. Used to push a due
   date forward when the model simply wasn't being produced that month (no
   units on the line to pull a sample from).
═══════════════════════════════════════════════════════════════════════ */
const fetchProductionByModelMonth = async (pool, materialCodes, windowStart, windowEnd) => {
  const map = new Map();
  if (materialCodes.length === 0) return map;

  const request = pool.request()
    .input("WindowStart", sql.DateTime, windowStart)
    .input("WindowEnd", sql.DateTime, windowEnd);
  const codeParams = materialCodes.map((code, i) => {
    request.input(`Mc${i}`, sql.NVarChar(50), code);
    return `@Mc${i}`;
  });
  const stationParams = FINAL_STATION_CODES.map((code, i) => {
    request.input(`St${i}`, sql.Int, Number(code));
    return `@St${i}`;
  });

  const result = await request.query(`
    ;WITH Psno AS (
      SELECT DocNo, Material
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99
        AND Material IN (${codeParams.join(", ")})
    )
    SELECT Psno.Material, YEAR(b.ActivityOn) AS Yr, MONTH(b.ActivityOn) AS Mo, COUNT(*) AS Qty
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON c.StationCode = b.StationCode
    WHERE b.ActivityType = 5
      AND c.StationCode IN (${stationParams.join(", ")})
      AND b.ActivityOn >= @WindowStart AND b.ActivityOn < @WindowEnd
    GROUP BY Psno.Material, YEAR(b.ActivityOn), MONTH(b.ActivityOn)
  `);

  for (const row of result.recordset) {
    map.set(`${row.Material}|${row.Yr}-${row.Mo}`, row.Qty);
  }
  return map;
};

// Walks a due date forward one month at a time while its month has zero
// recorded production for that model — no units on the line means no
// sample to pull, so it's not meaningful to call the test "due" that month.
// Only shifts within the queried window; a month we have no production data
// for at all (outside the window) is left alone rather than guessed at.
const shiftDueDateForProduction = (dueDate, materialCode, durationDays, productionMap, windowStart, windowEnd) => {
  let due = new Date(dueDate);
  let shiftedMonths = 0;

  for (let i = 0; i < MAX_PRODUCTION_SHIFT_MONTHS; i++) {
    if (due < windowStart || due >= windowEnd) break;
    const qty = productionMap.get(monthKey(materialCode, due)) || 0;
    if (qty > 0) break;
    due = firstOfNextMonth(due);
    shiftedMonths++;
  }

  if (shiftedMonths === 0) return null;
  return { nextDueDate: due, windowEnd: addDays(due, durationDays) };
};

/* ═══════════════════════════════════════════════════════════════════════
   GET SCHEDULE — every BIS-classified model × the 3 report types, with the
   next-due date computed live from (last test date + effective frequency).
   Never cached/stored, so a frequency change in config or an override on a
   model is reflected on the very next read.
═══════════════════════════════════════════════════════════════════════ */
export const getBisTestSchedule = tryCatch(async (_, res) => {
  try {
    const pool = await connectToDB(dbConfig1);

    const result = await pool.request().query(`
      ;WITH DistinctModels AS (
        -- Multiple material codes (colour/pack variants etc.) can share the
        -- same derived ModelName, so roll BISCategory up to one row per model
        -- before building the schedule — otherwise each report type would be
        -- duplicated once per material code sharing that model name. MAX()
        -- picks a representative MaterialCode and skips NULL overrides.
        SELECT
          ModelName,
          MAX(MaterialCode) AS MaterialCode,
          MAX(IntroductionFrequencyMonths) AS IntroductionFrequencyMonths,
          MAX(IntroductionDurationDays) AS IntroductionDurationDays,
          MAX(SoundFrequencyMonths) AS SoundFrequencyMonths,
          MAX(SoundDurationDays) AS SoundDurationDays,
          MAX(VolumeFrequencyMonths) AS VolumeFrequencyMonths,
          MAX(VolumeDurationDays) AS VolumeDurationDays
        FROM BISCategory
        WHERE Category = 1
        GROUP BY ModelName
      ),
      ModelTypes AS (
        SELECT DM.MaterialCode, DM.ModelName, 'Introduction' AS ReportType,
               COALESCE(DM.IntroductionFrequencyMonths, CFG.IntroductionFrequencyMonths) AS FrequencyMonths,
               COALESCE(DM.IntroductionDurationDays, CFG.IntroductionDurationDays) AS DurationDays
        FROM DistinctModels DM CROSS JOIN BISTestFrequencyConfig CFG
        UNION ALL
        SELECT DM.MaterialCode, DM.ModelName, 'Sound',
               COALESCE(DM.SoundFrequencyMonths, CFG.SoundFrequencyMonths),
               COALESCE(DM.SoundDurationDays, CFG.SoundDurationDays)
        FROM DistinctModels DM CROSS JOIN BISTestFrequencyConfig CFG
        UNION ALL
        SELECT DM.MaterialCode, DM.ModelName, 'Volume',
               COALESCE(DM.VolumeFrequencyMonths, CFG.VolumeFrequencyMonths),
               COALESCE(DM.VolumeDurationDays, CFG.VolumeDurationDays)
        FROM DistinctModels DM CROSS JOIN BISTestFrequencyConfig CFG
      ),
      LastTests AS (
        -- Ranked instead of a plain MAX() so we can also surface which row
        -- supplied the date (its Id + Status) — the frontend needs that to
        -- know whether the date is directly editable (a Baseline row) or
        -- belongs to a submitted report (edit the report instead).
        SELECT ModelName, ReportType, Id, Status, TestDateTo,
               ROW_NUMBER() OVER (PARTITION BY ModelName, ReportType ORDER BY TestDateTo DESC, Id DESC) AS rn
        FROM BISTestReport
        WHERE Status IN ('Baseline', 'Final') AND IsCurrent = 1
      )
      SELECT
        MT.MaterialCode, MT.ModelName, MT.ReportType, MT.FrequencyMonths, MT.DurationDays,
        LT.TestDateTo AS LastTestDate, LT.Id AS SourceReportId, LT.Status AS SourceStatus,
        CASE WHEN LT.TestDateTo IS NOT NULL
             THEN DATEADD(MONTH, MT.FrequencyMonths, LT.TestDateTo) END AS NextDueDate,
        CASE WHEN LT.TestDateTo IS NOT NULL
             THEN DATEADD(DAY, MT.DurationDays, DATEADD(MONTH, MT.FrequencyMonths, LT.TestDateTo)) END AS WindowEnd,
        CASE WHEN LT.TestDateTo IS NOT NULL
             THEN DATEDIFF(DAY, CAST(GETDATE() AS DATE), DATEADD(MONTH, MT.FrequencyMonths, LT.TestDateTo)) END AS DaysUntilDue
      FROM ModelTypes MT
      LEFT JOIN LastTests LT ON LT.ModelName = MT.ModelName AND LT.ReportType = MT.ReportType AND LT.rn = 1
      ORDER BY MT.ModelName, MT.ReportType
    `);

    const schedule = result.recordset.map((row) => ({
      materialCode: row.MaterialCode,
      modelName: row.ModelName,
      reportType: row.ReportType,
      frequencyMonths: row.FrequencyMonths,
      durationDays: row.DurationDays,
      lastTestDate: row.LastTestDate,
      sourceReportId: row.SourceReportId,
      sourceStatus: row.SourceStatus,
      nextDueDate: row.NextDueDate,
      windowEnd: row.WindowEnd,
      daysUntilDue: row.DaysUntilDue,
      status: scheduleStatus(row.LastTestDate, row.DaysUntilDue),
    }));

    // ── Push due dates off months with zero production for that model ─────
    const today = new Date();
    const windowStart = new Date(today.getFullYear() - 2, today.getMonth(), 1);
    const windowEnd = new Date(today.getFullYear(), today.getMonth() + MAX_PRODUCTION_SHIFT_MONTHS + 1, 1);
    const materialCodes = [...new Set(schedule.filter((i) => i.nextDueDate).map((i) => i.materialCode))];
    const productionMap = await fetchProductionByModelMonth(pool, materialCodes, windowStart, windowEnd);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const item of schedule) {
      if (!item.nextDueDate) continue;
      const shifted = shiftDueDateForProduction(item.nextDueDate, item.materialCode, item.durationDays, productionMap, windowStart, windowEnd);
      if (!shifted) continue;

      item.originalNextDueDate = item.nextDueDate;
      item.nextDueDate = shifted.nextDueDate;
      item.windowEnd = shifted.windowEnd;
      item.daysUntilDue = Math.round((shifted.nextDueDate - todayMidnight) / 86400000);
      item.status = scheduleStatus(item.lastTestDate, item.daysUntilDue);
      item.shiftedForNoProduction = true;
    }

    const summary = { overdue: 0, dueSoon: 0, scheduled: 0, noBaseline: 0 };
    for (const item of schedule) {
      if (item.status === "Overdue") summary.overdue++;
      else if (item.status === "Due Soon") summary.dueSoon++;
      else if (item.status === "Scheduled") summary.scheduled++;
      else summary.noBaseline++;
    }

    res.status(200).json({ success: true, schedule, summary });
  } catch (error) {
    throw new AppError(`Failed to compute BIS test schedule: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   BASELINE SETUP — one-time (and re-runnable for newly added models) seed
   of "last test date" per model/type, stored as Status='Baseline' rows on
   BISTestReport. Idempotent: skips any model/type that already has a
   Baseline or Final row so it can safely be re-opened later.
═══════════════════════════════════════════════════════════════════════ */
export const createBisTestBaseline = tryCatch(async (req, res) => {
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError("Missing required field: entries (non-empty array).", 400);
  }

  const createdBy = req.user?.name || req.user?.usercode || "system";

  const valid = [];
  for (const entry of entries) {
    const { modelName, materialCode, reportType, lastTestDate } = entry || {};
    if (!modelName || !materialCode || !REPORT_TYPES.includes(reportType) || !lastTestDate) continue;
    valid.push({ modelName, materialCode, reportType, lastTestDate });
  }

  if (valid.length === 0) {
    throw new AppError("No valid baseline entries provided (need modelName, materialCode, reportType, lastTestDate).", 400);
  }

  try {
    const pool = await connectToDB(dbConfig1);
    let inserted = 0;
    let skipped = 0;

    for (const entry of valid) {
      const existing = await pool
        .request()
        .input("ModelName", sql.NVarChar(300), entry.modelName)
        .input("ReportType", sql.NVarChar(20), entry.reportType).query(`
          SELECT TOP 1 Id FROM BISTestReport
          WHERE ModelName = @ModelName AND ReportType = @ReportType
            AND Status IN ('Baseline', 'Final') AND IsCurrent = 1
        `);

      if (existing.recordset.length > 0) {
        skipped++;
        continue;
      }

      await pool
        .request()
        .input("ReportType", sql.NVarChar(20), entry.reportType)
        .input("MaterialCode", sql.NVarChar(50), entry.materialCode)
        .input("ModelName", sql.NVarChar(300), entry.modelName)
        .input("TestDateTo", sql.Date, new Date(entry.lastTestDate))
        .input("CreatedBy", sql.NVarChar(100), createdBy).query(`
          INSERT INTO BISTestReport (ReportType, MaterialCode, ModelName, TestDateTo, Status, Version, IsCurrent, CreatedBy)
          VALUES (@ReportType, @MaterialCode, @ModelName, @TestDateTo, 'Baseline', 1, 1, @CreatedBy)
        `);
      inserted++;
    }

    res.status(200).json({
      success: true,
      message: `Baseline setup complete: ${inserted} added, ${skipped} skipped (already had a baseline or report).`,
      inserted,
      skipped,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to save BIS test baseline: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UPDATE BASELINE DATE — corrects a previously-entered "last test date".
   Only allowed on Status='Baseline' rows: a Final report's date is part of
   the actual submitted record, so that's edited via the report itself
   (Test Reports tab) rather than patched here in isolation.
═══════════════════════════════════════════════════════════════════════ */
export const updateBisTestBaseline = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { lastTestDate } = req.body;
  if (!id || !lastTestDate) {
    throw new AppError("Missing required fields: id, lastTestDate.", 400);
  }

  try {
    const pool = await connectToDB(dbConfig1);
    const reportId = parseInt(id, 10);

    const existing = await pool.request().input("Id", sql.Int, reportId).query(`SELECT Status FROM BISTestReport WHERE Id = @Id`);
    if (existing.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Baseline entry not found." });
    }
    if (existing.recordset[0].Status !== "Baseline") {
      throw new AppError("This date belongs to a submitted report — edit it from the Test Reports tab instead.", 400);
    }

    await pool
      .request()
      .input("Id", sql.Int, reportId)
      .input("TestDateTo", sql.Date, new Date(lastTestDate))
      .query(`UPDATE BISTestReport SET TestDateTo = @TestDateTo, UpdatedAt = GETDATE() WHERE Id = @Id`);

    res.status(200).json({ success: true, message: "Baseline date updated." });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update baseline date: ${error.message}`, 500);
  }
});
