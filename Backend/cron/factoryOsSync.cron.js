import cron from "node-cron";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts");
let running = false;

const writeLog = async ({ date, startedAt, status, recordsSynced = null, message = null }) => {
  if (!global.pool3) return;
  try {
    await global.pool3.request()
      .input("date", date)
      .input("startedAt", startedAt)
      .input("status", status)
      .input("recordsSynced", recordsSynced)
      .input("message", message ? message.slice(0, 4000) : null)
      .query(`
        INSERT INTO PartProcessSyncLog (SyncDate, StartedAt, CompletedAt, Status, RecordsSynced, Message)
        VALUES (@date, @startedAt, GETDATE(), @status, @recordsSynced, @message)
      `);
  } catch (error) {
    console.error("[FactoryOS Sync] Could not write sync log:", error.message);
  }
};

const istDate = (offsetDays = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const runSync = (date) => new Promise((resolve) => {
  const startedAt = new Date();
  const env = {
    ...process.env,
    FOS_USER: process.env.FOS_USER || "western_user",
    FOS_PASS: process.env.FOS_PASS || "test",
  };
  execFile(process.env.PYTHON_BIN || "python", [
    path.join(scriptsDir, "sync_factoryos_part_process_events.py"), "--date", date,
  ], { cwd: path.resolve(scriptsDir, ".."), env, timeout: 360_000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
    if (error) {
      const message = (stderr || error.message).trim();
      console.error("[FactoryOS Sync]", message);
      await writeLog({ date, startedAt, status: "Failed", message });
      return resolve();
    }
    const message = stdout.trim();
    const recordsSynced = Number(message.match(/Synced\s+(\d+)/)?.[1] ?? 0);
    console.log("[FactoryOS Sync]", message);
    await writeLog({ date, startedAt, status: "Success", recordsSynced, message });
    resolve();
  });
});

// FactoryOS's daily-summary buckets an overnight shift (e.g. Shift 2,
// 20:00-08:00) entirely under the date its evening portion started on — the
// post-midnight tail only becomes available from FactoryOS sometime AFTER
// that shift ends, which is already "yesterday" relative to the sync that's
// running then. A sync that only ever targets "today" can never go back and
// pick that tail up once the calendar date rolls over, so it silently stays
// missing forever. Re-syncing yesterday's date on every tick closes that gap:
// whenever FactoryOS finishes finalising an overnight shift's tail, the next
// 5-minute tick picks it up. sync_factoryos_part_process_events.py itself
// re-derives each event's true calendar EventDate from its own shift window,
// so this is safe to run indefinitely without re-mistagging anything.
const syncCycle = async () => {
  if (running) return;
  running = true;
  try {
    await runSync(istDate(0));
    await runSync(istDate(-1));
  } finally {
    running = false;
  }
};

export const startFactoryOsSyncCron = () => {
  // Refresh the in-progress production day (and re-check yesterday for any
  // overnight-shift tail FactoryOS has since finalised) every five minutes.
  cron.schedule("*/5 * * * *", syncCycle, { timezone: "Asia/Kolkata" });
  console.log("[FactoryOS Sync] Cron started — syncing today + yesterday every 5 minutes.");
  setTimeout(syncCycle, 10_000); // Allow DB migrations to create the log table first.
};
