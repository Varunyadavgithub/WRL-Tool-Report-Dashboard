/**
 * Maps a PartProcessEvents DB row (from /api/v1/part-process/records)
 * to the same internal format that mapFOsRecord produces, so all
 * downstream components (Dashboard, HourlyReport, etc.) work unchanged.
 */
import { extractProgramName, extractSapCode } from "../redux/slices/masterConfigSlice";

export const mapDbRecord = (r, idx) => {
  const rawBarcode  = r.Barcode || null;
  const programName = extractProgramName(rawBarcode);  // "1130596-C-OUTER-BTM-FLT-875H-NEW"
  const sapCode     = extractSapCode(programName);     // "1130596"

  return {
    srNo:           idx + 1,
    id:             r.EventId,
    eventId:        r.EventId,
    shift:          r.ShiftName  || "—",
    state:          r.EventType  || "Production",   // "Production" | "Downtime"
    model:          programName,                    // clean program name
    rawBarcode,                                     // original barcode string
    sapCode,                                        // extracted SAP code
    startTime:      r.StartTime  || "",
    endTime:        r.EndTime    || "",
    duration:       r.Duration   || "00:00:00",
    qty:            r.PartsQty   ?? 0,
    quality:        r.PartsQuality || null,
    operator:       r.OperatorName || null,
    downtimeReason: r.DowntimeReason || null,
    downtimeComment: r.DowntimeComment || null,
    assetName:      r.AssetName  || null,
    lineName:       r.LineName   || null,
    energy:         r.Energy     ?? 0,
    syncedAt:       r.SyncedAt   || null,
  };
};
