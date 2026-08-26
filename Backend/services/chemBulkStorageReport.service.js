/**
 * Chemical Bulk Storage tank report — ported from the standalone Python
 * script that used to run this externally against the same DB (GARUDA /
 * pool1). Pulls the 9 AM reading for each ISO/POLY tank and the day-over-day
 * consumption vs. yesterday's 9 AM reading.
 */
import { buildSectionsExcel } from "./reportExcel.service.js";

const REPORT_QUERY = `
DECLARE @Today DATETIME = CAST(GETDATE() AS DATETIME);
DECLARE @Yesterday DATETIME = DATEADD(DAY, -1, @Today);

WITH Reading9AM AS (
    SELECT
        TankCode,
        CAST(CAST(CapDate AS DATE) AS DATE) AS ReadingDate,
        ROUND(CAST(WeightValue AS FLOAT), 2) AS Weight_9AM,
        ROUND(CAST(LevelValue AS FLOAT), 2) AS Level_9AM,
        ROUND(CAST(TempValue AS FLOAT), 2) AS Temp_9AM,
        CapDate,
        ROW_NUMBER() OVER (
            PARTITION BY TankCode, CAST(CapDate AS DATE)
            ORDER BY ABS(DATEDIFF(SECOND, CapDate,
                     DATEADD(HOUR, 9, CAST(CAST(CapDate AS DATE) AS DATETIME))))
        ) AS rn
    FROM ChemTankReadings
    WHERE
        CAST(CapDate AS TIME) BETWEEN '06:00:00' AND '12:00:00'
        AND (TankCode LIKE 'ISO%' OR TankCode LIKE 'POLY%')
),
TodayData AS (
    SELECT TankCode, Weight_9AM, Level_9AM, Temp_9AM, CapDate
    FROM Reading9AM
    WHERE rn = 1 AND ReadingDate = CAST(@Today AS DATE)
),
YesterdayData AS (
    SELECT TankCode, Weight_9AM
    FROM Reading9AM
    WHERE rn = 1 AND ReadingDate = CAST(@Yesterday AS DATE)
)
SELECT
    t.TankCode                                 AS tankCode,
    FORMAT(t.CapDate, 'dd-MM-yyyy HH:mm:ss')    AS readingTime,
    t.Weight_9AM                                AS weight,
    t.Level_9AM                                 AS level,
    t.Temp_9AM                                  AS temp,
    ROUND(y.Weight_9AM - t.Weight_9AM, 2)       AS consumption
FROM TodayData t
LEFT JOIN YesterdayData y ON t.TankCode = y.TankCode
ORDER BY
    CASE WHEN t.TankCode LIKE 'ISO%' THEN 1 ELSE 2 END,
    t.TankCode;
`;

export const buildChemBulkStorageReport = async (pool) => {
  const result = await pool.request().query(REPORT_QUERY);
  const rows = result.recordset;
  // Case-insensitive: the SQL WHERE clause's LIKE match is case-insensitive
  // (standard collation), but TankCode values are stored as "Poly Tank - N"
  // (not "POLY..."), so a case-sensitive startsWith here would silently drop
  // every Polyol row from both groups.
  const isoRows = rows.filter((r) => r.tankCode?.toUpperCase().startsWith("ISO"));
  const polyRows = rows.filter((r) => r.tankCode?.toUpperCase().startsWith("POLY"));
  return { isoRows, polyRows, generatedAt: new Date() };
};

const EXCEL_COLUMNS = [
  { label: "Tank Code", value: (r) => r.tankCode },
  { label: "Weight @ 9 AM (kg)", align: "center", value: (r) => r.weight },
  { label: "Level @ 9 AM (mm)", align: "center", value: (r) => r.level },
  { label: "Temp @ 9 AM (°C)", align: "center", value: (r) => r.temp },
  { label: "Consumption (kg)", align: "center", value: (r) => r.consumption },
  { label: "Reading Time", value: (r) => r.readingTime },
];

export const buildChemBulkStorageExcel = async ({ isoRows, polyRows, generatedAt }) => {
  const subtitle = `Generated ${generatedAt.toLocaleString()}`;
  return buildSectionsExcel({
    title: "Daily Chemical Tank Report",
    subtitle,
    blocks: [
      { heading: "Isocyanate Chemical Data", columns: EXCEL_COLUMNS, rows: isoRows },
      { heading: "Raw Polyol Chemical Data", columns: EXCEL_COLUMNS, rows: polyRows },
    ],
  });
};
