/** PartProcess raw event records + sync-log reads (pool3 / PartProcessEvents, PartProcessSyncLog). */

// SQL Server error 1205 = deadlock victim. The FactoryOS sync cron writes to
// PartProcessEvents every 5 minutes (see cron/factoryOsSync.cron.js), which
// can collide with these reads and get one side picked as the deadlock
// victim — same transient-contention issue already handled on the write side
// in scripts/write_part_process_events.mjs, needed here too since a plain
// SELECT can still be chosen as the victim under concurrent writes.
const MAX_DEADLOCK_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isDeadlock = (err) => err?.number === 1205 ||
  (err?.code === "EREQUEST" && /deadlock/i.test(err?.message || ""));

// `attempt` must build a FRESH pool.request() on every call — an mssql
// Request object can't be reused after it's been executed once.
const queryWithRetry = async (attempt) => {
  for (let i = 1; i <= MAX_DEADLOCK_RETRIES; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (isDeadlock(err) && i < MAX_DEADLOCK_RETRIES) {
        await sleep(300 * i);
        continue;
      }
      throw err;
    }
  }
};

// ── GET /api/v1/part-process/records ──────────────────────────────────────────
export const getRecords = async (req, res) => {
  try {
    const { date, startTime = "00:00", endTime = "23:59", shift } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "date is required" });

    const startH = (startTime || "00:00").substring(0, 5);
    const endH   = (endTime   || "23:59").substring(0, 5);

    const result = await queryWithRetry(() => global.pool3.request()
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
      `));

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getRecords:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/v1/part-process/records-range ────────────────────────────────────
// Multi-day fetch for analytics/dashboards. EventDate is inclusive on both ends.
export const getRecordsRange = async (req, res) => {
  try {
    const { startDate, endDate, shift } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    const result = await queryWithRetry(() => global.pool3.request()
      .input("startDate", startDate)
      .input("endDate",   endDate)
      .input("shift",     shift || null)
      .query(`
        SELECT
          EventId, EventDate, ShiftName, EventType, Barcode,
          StartTime, EndTime, Duration, PartsQty, PartsQuality,
          OperatorName, DowntimeReason, DowntimeComment,
          AssetName, LineName, Energy, SyncedAt
        FROM PartProcessEvents
        WHERE EventDate BETWEEN @startDate AND @endDate
          AND (@shift IS NULL OR ShiftName = @shift)
        ORDER BY EventDate ASC, StartTime ASC
      `));

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getRecordsRange:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/v1/part-process/sync-log ───────────────────────────────────────
export const getSyncLog = async (_req, res) => {
  try {
    const result = await queryWithRetry(() => global.pool3.request().query(`
      SELECT TOP 100 Id, SyncDate, StartedAt, CompletedAt, Status, RecordsSynced, Message
      FROM PartProcessSyncLog
      ORDER BY CompletedAt DESC, Id DESC
    `));
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getSyncLog:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
