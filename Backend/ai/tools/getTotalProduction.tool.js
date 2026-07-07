import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Same department -> station-code mapping as Backend/controllers/production/totalProduction.controller.js
// (not exported there, so mirrored here — this is the CORE Production module's
// finished-goods count, on GARUDA/pool1, completely separate from the
// PartProcessEvents/OEE pipeline getProductionSummary wraps on pool3).
const STATION_CODES = {
  final: ["1220010", "1230017"],
  "post-foaming": ["1230007", "1220003", "1220004", "1230012"],
  "final-loading": ["1220005", "1230013"],
};

export const definition = {
  type: "function",
  function: {
    name: "getTotalProduction",
    description:
      "Get total finished-goods unit counts from the core Production module (the 'Total Production' report), broken down by model, for a date range and ONE named stage. There are three stages — final (Final FG), post-foaming, and final-loading — and none is a silent default. If the user hasn't said which stage, ask them before calling this tool rather than guessing.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endDate: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
        department: {
          type: "string",
          enum: ["final", "post-foaming", "final-loading"],
          description: "Which stage to count: 'final' = Final FG (finished goods), 'post-foaming' = post-foaming line, 'final-loading' = final loading line. Required — must come from the user, not assumed.",
        },
      },
      required: ["startDate", "endDate", "department"],
    },
  },
};

// A bare "YYYY-MM-DD" (no time part) means "the whole day" to a caller, but
// passed straight through to convertToIST it becomes midnight-to-midnight —
// a zero-width window that silently matches nothing. Expand bare dates to
// full-day bounds so "give me production for June 23" doesn't come back empty.
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const execute = async ({ startDate, endDate, department } = {}) => {
  const stationCodes = STATION_CODES[department];
  if (!stationCodes) {
    return { error: `department is required and must be one of: final, post-foaming, final-loading. Ask the user which stage they mean.` };
  }

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  // station codes come only from the fixed internal STATION_CODES map above
  // (never user input) — safe to inline as literals.
  const stationCodeList = stationCodes.map((c) => `'${c}'`).join(", ");

  const result = await global.pool1.request()
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd)
    .query(`
      WITH Psno AS (
        SELECT DocNo, Material
        FROM MaterialBarcode
        WHERE PrintStatus = 1 AND Status <> 99
      )
      SELECT
        (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS modelName,
        COUNT(*) AS unitCount
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
      JOIN WorkCenter c ON b.StationCode = c.StationCode
      WHERE b.ActivityType = 5
        AND c.StationCode IN (${stationCodeList})
        AND b.ActivityOn BETWEEN @startTime AND @endTime
      GROUP BY Psno.Material
      ORDER BY unitCount DESC
    `);

  const rows = result.recordset;
  const totalUnits = rows.reduce((sum, r) => sum + r.unitCount, 0);

  return {
    department,
    startDate,
    endDate,
    totalUnits,
    byModel: rows.slice(0, 15),
  };
};
