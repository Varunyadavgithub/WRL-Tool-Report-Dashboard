import sql from "mssql";
import { dbConfig4 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

let _pool = null;

const getPool = async () => {
  if (_pool) return _pool;
  _pool = await new sql.ConnectionPool(dbConfig4).connect();
  // FIX: reset pool reference on error so next call reconnects
  _pool.on("error", (err) => {
    console.error("[DB] Pool error:", err.message);
    _pool = null;
  });
  return _pool;
};

// GET /manpower/attendance?fromDate=2026-04-24&toDate=2026-05-23
export const getAttendanceReport = tryCatch(async (req, res) => {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    throw new AppError("fromDate and toDate are required", 400);
  }

  // Basic date-format validation (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(fromDate) || !dateRe.test(toDate)) {
    throw new AppError("Dates must be in YYYY-MM-DD format", 400);
  }

  if (new Date(fromDate) > new Date(toDate)) {
    throw new AppError("fromDate must be before or equal to toDate", 400);
  }

  // FIX: 90-day guard on the server to prevent runaway queries
  const daySpan = (new Date(toDate) - new Date(fromDate)) / 86400000;
  if (daySpan > 90) {
    throw new AppError("Date range cannot exceed 90 days", 400);
  }

  // Shift window: start at 07:00 on fromDate, end at 08:00 on day after toDate.
  // This captures night-shift workers whose CheckInDateTime is on the boundary.
  // The SQL query uses CAST(CheckInDateTime AS DATE) for AttendanceDate, so
  // the pivot will always bucket records by their actual punch-in calendar date —
  // cross-midnight punches appear on the correct day.
  const fromDateTime = `${fromDate} 07:00:00`;
  const toDateTime = (() => {
    const d = new Date(toDate);
    d.setDate(d.getDate() + 1);
    return `${d.toISOString().slice(0, 10)} 08:00:00`;
  })();

  const query = `
SELECT
    BadgeDetail.Code                          AS EmployeeCode,
    Name.IDCardNo                             AS EmpCode,
    Contractor.Name                           AS Contractor,
    Name.Name                                 AS EmployeeName,
    BusinessUnit.Name                         AS Department,
    CAST(CheckInOut.CheckInDateTime AS DATE)  AS AttendanceDate,
    CONVERT(VARCHAR(8), CheckInOut.CheckInDateTime,  108) AS InTime,
    CASE
        WHEN YEAR(CheckInOut.CheckOutDateTime) = 1900 THEN NULL
        ELSE CONVERT(VARCHAR(8), CheckInOut.CheckOutDateTime, 108)
    END                                       AS OutTime,
    ShiftDetail.Name                          AS Shift,
    CASE
        WHEN YEAR(CheckInOut.CheckOutDateTime) = 1900 THEN NULL
        ELSE CAST(
            DATEDIFF(MINUTE, CheckInOut.CheckInDateTime, CheckInOut.CheckOutDateTime) / 60.0
        AS DECIMAL(10,2))
    END                                       AS WorkingHours,
    CASE
        WHEN YEAR(CheckInOut.CheckOutDateTime) = 1900
            THEN 'Punch Missing'
        WHEN DATEDIFF(MINUTE, CheckInOut.CheckInDateTime, CheckInOut.CheckOutDateTime) >= 360
            THEN 'Present'
        WHEN DATEDIFF(MINUTE, CheckInOut.CheckInDateTime, CheckInOut.CheckOutDateTime) < 360
            THEN 'Half Day'
        ELSE 'Absent'
    END                                       AS AttendanceStatus,
    -- FIX: LateStatus is now returned so the frontend can show the 'L' badge
    CASE
        WHEN CAST(CheckInOut.CheckInDateTime AS TIME) > '07:15:00'
        THEN 'Late'
        ELSE 'On Time'
    END                                       AS LateStatus
FROM CheckInOut
LEFT JOIN deptskilllog ON CheckInOut.Code        = deptskilllog.CheckInOutCode
LEFT JOIN BadgeDetail  ON CheckInOut.BadgeCode   = BadgeDetail.Code
LEFT JOIN Name         ON BadgeDetail.NameCode   = Name.Code
LEFT JOIN Contractor   ON BadgeDetail.Contractor = Contractor.Code
LEFT JOIN ShiftDetail  ON CheckInOut.ShiftCode   = ShiftDetail.Code
LEFT JOIN BusinessUnit ON deptskilllog.deptCode  = BusinessUnit.Code
WHERE
    CheckInOut.CheckInDateTime >= @fromDateTime
    AND CheckInOut.CheckInDateTime <= @toDateTime
    AND CheckInOut.Status <> 'V'
    AND CheckInOut.OutFlag <> 'AB'
    AND Contractor.Name IN ('Western Refrigeration Pvt Ltd Tadgam', 'LOGISTIC')
    ${req.query.empCode ? "AND Name.IDCardNo = @empCode" : ""}
ORDER BY
    Contractor.Name,
    Name.Name,
    CheckInOut.CheckInDateTime;
  `;

  try {
    const pool    = await getPool();
    const request = pool.request()
      .input("fromDateTime", sql.DateTime, fromDateTime)
      .input("toDateTime",   sql.DateTime, toDateTime);

    if (req.query.empCode) {
      request.input("empCode", sql.NVarChar(50), req.query.empCode.trim().toUpperCase());
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      count:   result.recordset.length,
      data:    result.recordset,
    });
  } catch (error) {
    // FIX: reset pool on DB errors so the next request gets a fresh connection
    _pool = null;
    throw new AppError(`Failed to fetch attendance report: ${error.message}`, 500);
  }
});