import sql from "mssql";
import { convertToIST } from "../../utils/convertToIST.js";

// Mirrors Frontend/src/pages/Production/HourlyReport.jsx's LINE_STAGE_MAPPING
// (not shared/exported anywhere backend-reachable, so mirrored here) — the
// real per-line x per-stage station/linecode grid used by the Hourly Report
// page. This is a finer-grained view than getTotalProduction's plant-wide
// department totals (final/post-foaming/final-loading are effectively the
// union of these lines' stages) — use this tool when the user names a
// specific line, or wants two or more lines combined/compared.
const LINE_STAGE_MAPPING = {
  "Freezer Line": {
    "FG Label": { linecodes: [12501], stationCodes: [1220010] },
    MFT: { linecodes: [12501], stationCodes: [1220014] },
    EST: { linecodes: [12501], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12501], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12501], stationCodes: [1220005] },
    "Post Foaming": { linecodes: [12301, 12302], stationCodes: [1220003, 1220004] },
    Foaming: { linecodes: [12301, 12302], stationCodes: [1220001, 1220002] },
  },
  "Chocolate Line": {
    "FG Label": { linecodes: [12305], stationCodes: [1220010] },
    MFT: { linecodes: [12305], stationCodes: [1220014] },
    EST: { linecodes: [12305], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12305], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12305], stationCodes: [1220005] },
    "Post Foaming": { linecodes: [12305], stationCodes: [1230007] },
    Foaming: { linecodes: [12305], stationCodes: [] },
  },
  "VISI Cooler Line": {
    "FG Label": { linecodes: [12605], stationCodes: [1220010] },
    MFT: { linecodes: [12605], stationCodes: [1220014] },
    EST: { linecodes: [12605], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12605], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12605], stationCodes: [1220005] },
    "Post Comp Scan": { linecodes: [12605], stationCodes: [1240003] },
    "Post Foaming": { linecodes: [12605], stationCodes: [1230012] },
    Foaming: { linecodes: [12605], stationCodes: [] },
  },
  "SUS Line": {
    "FG Label": { linecodes: [12304], stationCodes: [1230017] },
    MFT: { linecodes: [12304], stationCodes: [1230028] },
    EST: { linecodes: [12304], stationCodes: [1230015] },
    "Gas Charging": { linecodes: [12304], stationCodes: [1260010] },
    "Comp Scan 1": { linecodes: [12304], stationCodes: [1230013] },
    "Comp Scan 2": { linecodes: [12304], stationCodes: [1230014] },
    "Post Foaming": { linecodes: [12304], stationCodes: [1230012] },
    Foaming: { linecodes: [12304], stationCodes: [] },
  },
};

const LINE_NAMES = Object.keys(LINE_STAGE_MAPPING);

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const expandToDayBounds = (dateStr, isEnd) =>
  BARE_DATE.test(dateStr?.trim()) ? `${dateStr.trim()} ${isEnd ? "23:59:59" : "00:00:00"}` : dateStr;

export const definition = {
  type: "function",
  function: {
    name: "getLineProduction",
    description:
      "Get finished-goods unit counts for one or more SPECIFIC physical production lines at a named stage, for a date range. Use this when the user names a line (e.g. 'Freezer Line'), or asks for two or more lines combined/compared — pass all requested lines in one call and the result includes both a per-line breakdown and a combined total. Not every stage exists on every line (e.g. only Freezer Line has 'Foaming' configured); the result will say so per line rather than silently omitting it. Different from getTotalProduction, which is a plant-wide rollup across all lines, not line-specific.",
    parameters: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: { type: "string", enum: LINE_NAMES },
          description: `Which line(s) to include, one or more of: ${LINE_NAMES.join(", ")}.`,
        },
        stage: {
          type: "string",
          description:
            "The process stage to count, e.g. 'FG Label', 'MFT', 'EST', 'Gas Charging', 'Comp Scan', 'Post Foaming', 'Foaming'. Valid stage names vary slightly by line (SUS Line uses 'Comp Scan 1'/'Comp Scan 2'; VISI Cooler Line has 'Post Comp Scan') — if the user's stage name doesn't match a line, this tool reports that explicitly rather than guessing a substitute.",
        },
        startDate: { type: "string", description: "Start date/time, e.g. '2026-07-05 00:00' or '2026-07-05'." },
        endDate: { type: "string", description: "End date/time, e.g. '2026-07-05 23:59' or '2026-07-05'." },
      },
      required: ["lines", "stage", "startDate", "endDate"],
    },
  },
};

const queryOneLine = async (line, stationCodes, linecodes, istStart, istEnd) => {
  const request = global.pool1.request()
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd);

  // stationCodes/linecodes come only from the fixed internal LINE_STAGE_MAPPING
  // above (never user input) — safe to inline as literals.
  const stationList = stationCodes.join(", ");
  const linecodeList = linecodes.join(", ");

  const result = await request.query(`
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
      AND c.StationCode IN (${stationList})
      AND b.remark IN (${linecodeList})
      AND b.ActivityOn BETWEEN @startTime AND @endTime
    GROUP BY Psno.Material
    ORDER BY unitCount DESC
  `);

  const rows = result.recordset;
  return { line, totalUnits: rows.reduce((s, r) => s + r.unitCount, 0), byModel: rows.slice(0, 10) };
};

export const execute = async ({ lines, stage, startDate, endDate } = {}) => {
  if (!Array.isArray(lines) || !lines.length) return { error: "lines must be a non-empty array of line names." };

  const istStart = convertToIST(expandToDayBounds(startDate, false));
  const istEnd = convertToIST(expandToDayBounds(endDate, true));

  const unavailable = [];
  const queryable = [];

  for (const line of lines) {
    const lineMap = LINE_STAGE_MAPPING[line];
    if (!lineMap) {
      unavailable.push({ line, reason: `Unknown line. Valid lines: ${LINE_NAMES.join(", ")}.` });
      continue;
    }
    const cfg = lineMap[stage];
    if (!cfg || !cfg.stationCodes.length || !cfg.linecodes.length) {
      const validStages = Object.keys(lineMap).join(", ");
      unavailable.push({ line, reason: `Stage "${stage}" isn't configured for ${line}. Valid stages for this line: ${validStages}.` });
      continue;
    }
    queryable.push({ line, ...cfg });
  }

  const results = await Promise.all(
    queryable.map((q) => queryOneLine(q.line, q.stationCodes, q.linecodes, istStart, istEnd)),
  );

  return {
    stage,
    startDate,
    endDate,
    combinedTotalUnits: results.reduce((s, r) => s + r.totalUnits, 0),
    lines: results,
    unavailable: unavailable.length ? unavailable : undefined,
  };
};
