/**
 * PartProcess Controller
 * Serves data from the local PartProcessEvents table (pool3 / DB3).
 */
import { syncRange, syncStatus } from "../cron/partProcessSync.js";

// ── GET /api/v1/part-process/records ──────────────────────────────────────────
export const getRecords = async (req, res) => {
  try {
    const { date, startTime = "00:00", endTime = "23:59", shift } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "date is required" });

    const startH = (startTime || "00:00").substring(0, 5);
    const endH   = (endTime   || "23:59").substring(0, 5);

    const result = await global.pool3.request()
      .input("date",   date)
      .input("startH", startH)
      .input("endH",   endH)
      .input("shift",  shift || null)
      .query(`
        SELECT
          EventId, EventDate, ShiftName, EventType, Barcode,
          StartTime, EndTime, Duration, PartsQty, PartsQuality,
          OperatorName, DowntimeReason, DowntimeComment,
          AssetName, LineName, Energy, SyncedAt
        FROM PartProcessEvents
        WHERE EventDate = @date
          AND (
            (@startH = '00:00' AND @endH = '23:59')
            OR (
              LEFT(ISNULL(CONVERT(VARCHAR(8), StartTime, 108), StartTime), 5) >= @startH
              AND LEFT(ISNULL(CONVERT(VARCHAR(8), StartTime, 108), StartTime), 5) <= @endH
            )
          )
          AND (@shift IS NULL OR ShiftName = @shift)
        ORDER BY StartTime ASC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getRecords:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/v1/part-process/sync-status ─────────────────────────────────────
export const getSyncStatus = async (req, res) => {
  try {
    const dbStats = await global.pool3.request().query(`
      SELECT
        EventDate,
        COUNT(*)   AS TotalRecords,
        MAX(SyncedAt) AS LastSynced,
        SUM(CASE WHEN EventType = 'Production' THEN 1 ELSE 0 END) AS ProductionCount,
        SUM(CASE WHEN EventType = 'Downtime'   THEN 1 ELSE 0 END) AS DowntimeCount,
        SUM(PartsQty) AS TotalQty
      FROM PartProcessEvents
      WHERE EventDate >= CAST(GETDATE() - 7 AS DATE)
      GROUP BY EventDate
      ORDER BY EventDate DESC
    `);

    // Overall DB stats
    const overall = await global.pool3.request().query(`
      SELECT
        MIN(EventDate) AS EarliestDate,
        MAX(EventDate) AS LatestDate,
        COUNT(*)       AS TotalRecords
      FROM PartProcessEvents
    `);

    res.json({
      success: true,
      sync:    syncStatus,           // live progress from cron
      last7:   dbStats.recordset,    // per-date breakdown
      overall: overall.recordset[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/v1/part-process/sync ───────────────────────────────────────────
// Body/query: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
// Triggers a manual re-sync for the given date range (runs in background).
export const triggerSync = async (req, res) => {
  try {
    if (syncStatus.running) {
      return res.json({
        success: false,
        message: `Sync already running (${syncStatus.phase}) — ${syncStatus.currentDate}`,
        sync: syncStatus,
      });
    }

    const { startDate, endDate } = { ...req.query, ...req.body };
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    // Fire-and-forget — returns immediately, client polls /sync-status
    syncRange(startDate, endDate, "manual")
      .catch(err => console.error("[PPSync] Manual sync failed:", err));

    res.json({
      success: true,
      message: `Manual sync started: ${startDate} → ${endDate}`,
      sync:    syncStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
