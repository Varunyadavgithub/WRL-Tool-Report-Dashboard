import sql from "mssql";
import { dbConfig4 } from "../../config/db.config.js"; // ← point to your HR/attendance DB config
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// -- Shared connection pool (created once, reused per process) ----------------
let _pool = null;

const getPool = async () => {
  if (_pool) return _pool;
  _pool = await new sql.ConnectionPool(dbConfig4).connect();
  _pool.on("error", () => {
    _pool = null; // force re-connect on next request
  });
  return _pool;
};

// -----------------------------------------------------------------------------
//  MANPOWER REPORT
//  GET /prod/manpower-report?StartTime=2026-04-20 07:00:00&EndTime=2026-04-20 20:00:00
// -----------------------------------------------------------------------------

export const getManpower = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  if (!StartTime || !EndTime) {
    throw new AppError("StartTime and EndTime are required", 400);
  }

  const query = `
SELECT
    Contractor.Name                           AS Contractor,
    Name.Name                                 AS WorkmenName,
    BusinessUnit.Name                         AS Department,
    CheckInOut.CheckInDateTime                AS CheckIn,
    CASE
        WHEN YEAR(CheckInOut.CheckOutDateTime) = 1900
        THEN NULL
        ELSE CheckInOut.CheckOutDateTime
    END                                       AS CheckOut,
    ShiftDetail.Name                          AS Shift
FROM CheckInOut
LEFT JOIN deptskilllog    ON CheckInOut.Code          = deptskilllog.CheckInOutCode
LEFT JOIN BadgeDetail     ON CheckInOut.BadgeCode     = BadgeDetail.Code
LEFT JOIN Name            ON BadgeDetail.NameCode     = Name.Code
LEFT JOIN Contractor      ON BadgeDetail.Contractor   = Contractor.Code
LEFT JOIN ShiftDetail     ON CheckInOut.ShiftCode     = ShiftDetail.Code
LEFT JOIN CardType        ON Name.[1_CardTypeCode]    = CardType.Code
LEFT JOIN BusinessUnit    ON deptskilllog.deptCode    = BusinessUnit.Code
LEFT JOIN NATUREOFWORK    ON BadgeDetail.NatureOfWork = NATUREOFWORK.CODE
LEFT JOIN WorkSkill       ON Name.[1_WorkSkillCode]   = WorkSkill.Code
WHERE
    CheckInOut.CheckInDateTime >= @p_fromdate
    AND CheckInOut.CheckInDateTime <= @p_nowdate
    AND Contractor.Name <> 'Western Refrigeration Pvt Ltd Tadgam'
    AND CheckInOut.Status <> 'V'
    AND CheckInOut.OutFlag <> 'AB'
ORDER BY
    Contractor.Name,
    Name.Name,
    CheckInOut.CheckInDateTime;
  `;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("p_fromdate", sql.DateTime, StartTime)
      .input("p_nowdate", sql.DateTime, EndTime)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Manpower report fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch manpower report: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  MANPOWER HOURLY COUNT
//  Returns how many workers were present per hour (for chart overlay)
//  GET /prod/manpower-hourly?StartTime=...&EndTime=...
// -----------------------------------------------------------------------------

export const getManpowerHourly = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  if (!StartTime || !EndTime) {
    throw new AppError("StartTime and EndTime are required", 400);
  }

  const query = `
WITH Hours AS (
  SELECT DATEPART(HOUR, CheckInOut.CheckInDateTime) AS TIMEHOUR,
         COUNT(DISTINCT CheckInOut.Code)             AS ManpowerCount
  FROM CheckInOut
  LEFT JOIN BadgeDetail  ON CheckInOut.BadgeCode   = BadgeDetail.Code
  LEFT JOIN Name         ON BadgeDetail.NameCode   = Name.Code
  LEFT JOIN Contractor   ON BadgeDetail.Contractor = Contractor.Code
  WHERE
    CheckInOut.CheckInDateTime >= @p_fromdate
    AND CheckInOut.CheckInDateTime <= @p_nowdate
    AND Contractor.Name <> 'Western Refrigeration Pvt Ltd Tadgam'
    AND CheckInOut.Status <> 'V'
    AND CheckInOut.OutFlag <> 'AB'
  GROUP BY DATEPART(HOUR, CheckInOut.CheckInDateTime)
)
SELECT TIMEHOUR, ManpowerCount AS COUNT
FROM Hours
ORDER BY TIMEHOUR;
  `;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("p_fromdate", sql.DateTime, StartTime)
      .input("p_nowdate", sql.DateTime, EndTime)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Manpower hourly count fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch manpower hourly count: ${error.message}`,
      500,
    );
  }
});