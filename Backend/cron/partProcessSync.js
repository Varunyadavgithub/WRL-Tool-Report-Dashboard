/**
 * PartProcess Sync — FactoryOS → Local DB (pool3 / DB3)
 *
 * Startup:  Full historical backfill (configurable days, default 30).
 * Ongoing:  Polls today + yesterday every 60 seconds.
 * Manual:   POST /api/v1/part-process/sync?startDate=&endDate=  (re-trigger range)
 */

import cron from "node-cron";

const FOS_BASE   = "https://factoryos.smartudyog.in/api";
const MACHINE_ID = "b3b8627a-3b55-4af3-96ee-c3fc7f712ecd";
const CREDS      = {
  username: process.env.FOS_USER || "western_user",
  password: process.env.FOS_PASS || "test",
};
const BACKFILL_DAYS = parseInt(process.env.PP_SYNC_DAYS || "30");

// ── JWT cache ───────────────────────────────────────────────────────────────────
let _token    = null;
let _tokenExp = 0;

const authenticate = async () => {
  const res  = await fetch(`${FOS_BASE}/auth/jwt/create/`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`FactoryOS auth failed: ${res.status}`);
  const data = await res.json();
  _token    = data.access;
  _tokenExp = Date.now() + 23 * 60 * 60 * 1000;
  console.log("[PPSync] JWT refreshed");
  return _token;
};

const getToken = async () => {
  if (_token && Date.now() < _tokenExp) return _token;
  return authenticate();
};

// ── Progress tracker (read by status endpoint) ──────────────────────────────────
export const syncStatus = {
  phase:       "idle",          // "idle" | "backfill" | "polling"
  running:     false,
  currentDate: null,
  doneCount:   0,
  totalDates:  0,
  recordsSaved: 0,
  startedAt:   null,
  finishedAt:  null,
  error:       null,
};

// ── Date helpers ────────────────────────────────────────────────────────────────
const isoDate = (d) => d.toISOString().split("T")[0];

const dateRange = (startStr, endStr) => {
  const dates = [];
  const cur   = new Date(startStr + "T00:00:00");
  const fin   = new Date(endStr   + "T00:00:00");
  while (cur <= fin) {
    dates.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// ── Safe JSON parse — guards against HTML error pages ────────────────────────────
const safeJson = async (res) => {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const preview = (await res.text()).slice(0, 80).replace(/\n/g, " ");
    throw new Error(`Non-JSON response (${res.status}): ${preview}`);
  }
  return res.json();
};

// ── Fetch all pages for one date ────────────────────────────────────────────────
const fetchAllPages = async (dateStr) => {
  const token = await getToken();
  const all   = [];
  let url = `${FOS_BASE}/monitoring/daily-summary/${MACHINE_ID}/?date=${dateStr}&page=1`;
  let retried = false;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 401 && !retried) {
      retried = true;
      await authenticate();
      continue;
    }
    if (!res.ok) { console.warn(`[PPSync] HTTP ${res.status} for ${url}`); break; }

    const data = await safeJson(res);
    all.push(...(data.results || []));
    url = data.next || null;
  }
  return all;
};

// ── Upsert records into DB3 ─────────────────────────────────────────────────────
const upsertRecords = async (records, dateStr) => {
  if (!records.length) return 0;
  const pool = global.pool3;
  let count  = 0;

  for (const r of records) {
    try {
      await pool.request()
        .input("EventId",         r.event_id            || "")
        .input("EventDate",       dateStr)
        .input("ShiftName",       r.shift?.shift_name   || null)
        .input("EventType",       r.event_type          || null)
        .input("Barcode",         r.barcode             || null)
        .input("StartTime",       r.start_time          || null)
        .input("EndTime",         r.end_time            || null)
        .input("Duration",        r.duration            || null)
        .input("PartsQty",        r.parts_quantity      || 0)
        .input("PartsQuality",    r.parts_quality       || null)
        .input("OperatorName",    r.operator_name       || null)
        .input("DowntimeReason",  r.downtime_reason     || null)
        .input("DowntimeComment", r.downtime_comment    || null)
        .input("AssetName",       r.asset_name          || null)
        .input("LineName",        r.line_name           || null)
        .input("Energy",          r.energy              || 0)
        .query(`
          MERGE PartProcessEvents AS tgt
          USING (VALUES (@EventId)) AS src(EventId) ON tgt.EventId = src.EventId
          WHEN MATCHED THEN UPDATE SET
            DowntimeReason  = @DowntimeReason,
            DowntimeComment = @DowntimeComment,
            PartsQty        = @PartsQty,
            Energy          = @Energy,
            SyncedAt        = GETDATE()
          WHEN NOT MATCHED THEN INSERT
            (EventId, EventDate, ShiftName, EventType, Barcode,
             StartTime, EndTime, Duration, PartsQty, PartsQuality,
             OperatorName, DowntimeReason, DowntimeComment,
             AssetName, LineName, Energy)
          VALUES
            (@EventId, @EventDate, @ShiftName, @EventType, @Barcode,
             @StartTime, @EndTime, @Duration, @PartsQty, @PartsQuality,
             @OperatorName, @DowntimeReason, @DowntimeComment,
             @AssetName, @LineName, @Energy);
        `);
      count++;
    } catch (err) {
      console.error(`[PPSync] Upsert failed ${r.event_id}:`, err.message);
    }
  }
  return count;
};

// ── Sync a date range (exported for manual trigger) ────────────────────────────
export const syncRange = async (startDate, endDate, phase = "backfill") => {
  const dates = dateRange(startDate, endDate);
  if (!dates.length) return 0;

  syncStatus.phase       = phase;
  syncStatus.running     = true;
  syncStatus.totalDates  = dates.length;
  syncStatus.doneCount   = 0;
  syncStatus.startedAt   = new Date().toISOString();
  syncStatus.finishedAt  = null;
  syncStatus.error       = null;
  syncStatus.recordsSaved = 0;

  console.log(`[PPSync] ${phase} start: ${dates.length} dates (${startDate} → ${endDate})`);

  let totalSaved = 0;
  for (const dateStr of dates) {
    try {
      syncStatus.currentDate = dateStr;
      const records = await fetchAllPages(dateStr);
      const saved   = await upsertRecords(records, dateStr);
      totalSaved += saved;
      syncStatus.recordsSaved = totalSaved;
      syncStatus.doneCount++;
      console.log(`[PPSync] ${dateStr}: ${saved}/${records.length}  (${syncStatus.doneCount}/${dates.length})`);
    } catch (err) {
      console.error(`[PPSync] ${dateStr} error:`, err.message);
      syncStatus.error = `${dateStr}: ${err.message}`;
    }
  }

  syncStatus.phase      = "idle";
  syncStatus.running    = false;
  syncStatus.currentDate = null;
  syncStatus.finishedAt = new Date().toISOString();
  console.log(`[PPSync] ${phase} complete: ${totalSaved} records saved`);
  return totalSaved;
};

// ── Backfill on startup ─────────────────────────────────────────────────────────
const runBackfill = async () => {
  try {
    // Find the most recent date already in DB
    const result = await global.pool3.request().query(`
      SELECT
        MAX(EventDate) AS MaxDate,
        COUNT(*)       AS TotalRecords
      FROM PartProcessEvents
    `);
    const { MaxDate, TotalRecords } = result.recordset[0];

    const today      = isoDate(new Date());
    const defaultStart = isoDate(new Date(Date.now() - BACKFILL_DAYS * 86_400_000));

    // Decide start date
    let startDate;
    if (!TotalRecords || TotalRecords === 0) {
      // DB is empty — full backfill from BACKFILL_DAYS ago
      startDate = defaultStart;
      console.log(`[PPSync] DB empty — full backfill last ${BACKFILL_DAYS} days (${startDate} → ${today})`);
    } else {
      // DB has data — catch up from the day after the last synced date
      const lastSynced = new Date(MaxDate);
      lastSynced.setDate(lastSynced.getDate() + 1); // +1 day: start from next day
      startDate = isoDate(lastSynced);
      if (startDate > today) {
        console.log("[PPSync] DB already up to date, skipping backfill");
        return;
      }
      console.log(`[PPSync] Catch-up from ${startDate} → ${today} (last in DB: ${MaxDate})`);
    }

    await syncRange(startDate, today, "backfill");
  } catch (err) {
    console.error("[PPSync] Backfill error:", err.message);
    syncStatus.error = err.message;
  }
};

// ── Regular 60-second polling (today + yesterday) ──────────────────────────────
let _polling = false;

const pollLatest = async () => {
  if (syncStatus.running) return; // don't overlap with a backfill
  _polling = true;
  try {
    const today     = isoDate(new Date());
    const yesterday = isoDate(new Date(Date.now() - 86_400_000));
    for (const dateStr of [today, yesterday]) {
      const records = await fetchAllPages(dateStr);
      const saved   = await upsertRecords(records, dateStr);
      if (saved) console.log(`[PPSync] Poll ${dateStr}: ${saved} records`);
    }
    syncStatus.finishedAt = new Date().toISOString();
  } catch (err) {
    // Downgrade to debug-level — these happen when the API is temporarily
    // unreachable (network blip, server restart, expired token).
    // The next 60-second tick will retry automatically.
    if (process.env.PP_SYNC_DEBUG === "1") {
      console.warn("[PPSync] Poll skipped:", err.message);
    }
  } finally {
    _polling = false;
  }
};

// ── Entry point ─────────────────────────────────────────────────────────────────
export const startPartProcessSync = () => {
  // 1. Backfill historical data first (runs in background, non-blocking)
  runBackfill().catch(err => console.error("[PPSync] Startup backfill failed:", err));

  // 2. Then poll every 60 s for new records
  cron.schedule("* * * * *", pollLatest);

  console.log(`[PPSync] Started — backfilling ${BACKFILL_DAYS} days, then polling every 60 s`);
};
