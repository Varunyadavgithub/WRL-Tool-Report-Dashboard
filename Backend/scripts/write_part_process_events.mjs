#!/usr/bin/env node
/** SQL Server writer used by sync_factoryos_part_process_events.py. */
import sql, { dbConfig3, connectToDB } from "../config/db.config.js";

const UPSERT_SQL = `
MERGE PartProcessEvents AS target
USING (VALUES (@EventId, @EventDate, @ShiftName, @EventType, @Barcode, @StartTime, @EndTime, @Duration, @PartsQty, @PartsQuality, @OperatorName, @DowntimeReason, @DowntimeComment, @AssetName, @LineName, @Energy)) AS source (EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality, OperatorName, DowntimeReason, DowntimeComment, AssetName, LineName, Energy)
ON target.EventId = source.EventId
WHEN MATCHED THEN UPDATE SET
  EventDate = source.EventDate, ShiftName = source.ShiftName, EventType = source.EventType, Barcode = source.Barcode,
  StartTime = source.StartTime, EndTime = source.EndTime, Duration = source.Duration, PartsQty = source.PartsQty,
  PartsQuality = source.PartsQuality, OperatorName = source.OperatorName, DowntimeReason = source.DowntimeReason,
  DowntimeComment = source.DowntimeComment, AssetName = source.AssetName, LineName = source.LineName,
  Energy = source.Energy, SyncedAt = GETDATE()
WHEN NOT MATCHED THEN INSERT (EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime, Duration, PartsQty, PartsQuality, OperatorName, DowntimeReason, DowntimeComment, AssetName, LineName, Energy, SyncedAt)
VALUES (source.EventId, source.EventDate, source.ShiftName, source.EventType, source.Barcode, source.StartTime, source.EndTime, source.Duration, source.PartsQty, source.PartsQuality, source.OperatorName, source.DowntimeReason, source.DowntimeComment, source.AssetName, source.LineName, source.Energy, GETDATE());`;

const input = await new Promise((resolve, reject) => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
  process.stdin.on("error", reject);
});
if (!Array.isArray(input)) throw new Error("Expected a JSON array of event rows on standard input");

let pool;
try {
  pool = await connectToDB(dbConfig3);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const row of input) {
      const request = new sql.Request(transaction);
      request.input("EventId", sql.NVarChar(50), row[0]); request.input("EventDate", sql.Date, row[1]);
      request.input("ShiftName", sql.NVarChar(100), row[2]); request.input("EventType", sql.NVarChar(20), row[3]);
      request.input("Barcode", sql.NVarChar(500), row[4]); request.input("StartTime", sql.NVarChar(10), row[5]);
      request.input("EndTime", sql.NVarChar(10), row[6]); request.input("Duration", sql.NVarChar(15), row[7]);
      request.input("PartsQty", sql.Int, row[8]); request.input("PartsQuality", sql.NVarChar(20), row[9]);
      request.input("OperatorName", sql.NVarChar(200), row[10]); request.input("DowntimeReason", sql.NVarChar(500), row[11]);
      request.input("DowntimeComment", sql.NVarChar(sql.MAX), row[12]); request.input("AssetName", sql.NVarChar(200), row[13]);
      request.input("LineName", sql.NVarChar(200), row[14]); request.input("Energy", sql.Float, row[15]);
      await request.query(UPSERT_SQL);
    }
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  process.stdout.write(JSON.stringify({ synced: input.length }) + "\n");
} finally {
  if (pool) await pool.close();
}
