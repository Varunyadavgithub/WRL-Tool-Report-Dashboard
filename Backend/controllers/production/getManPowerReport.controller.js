import sql from "mssql";
import { dbConfig4 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// Validates and formats a datetime string safe for T-SQL injection.
const safeDatetime = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new AppError("Invalid datetime value.", 400);
  return d.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
};

export const getManpowerReport = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = safeDatetime(convertToIST(startDate));
  const istEnd   = safeDatetime(convertToIST(endDate));

  const query = `
    DECLARE @p_fromdate DATETIME = '${istStart}';
    DECLARE @p_nowdate  DATETIME = '${istEnd}';

    SELECT  
        Contractor.Name                          AS Contractor,
        Name.Name                                AS [Workmen Name],
        BusinessUnit.Name                        AS Department,
        CheckInOut.CheckInDateTime               AS [In Date Time],
        CASE 
            WHEN YEAR(CheckInOut.CheckOutDateTime) = 1900 
            THEN NULL 
            ELSE CheckInOut.CheckOutDateTime 
        END                                      AS [Out Date Time],
        ShiftDetail.Name                         AS Shift
    FROM CheckInOut
    LEFT JOIN deptskilllog
        ON  CheckInOut.Code              = deptskilllog.CheckInOutCode
    LEFT JOIN BadgeDetail
        ON  CheckInOut.BadgeCode         = BadgeDetail.Code
    LEFT JOIN Name
        ON  BadgeDetail.NameCode         = Name.Code
    LEFT JOIN Contractor
        ON  BadgeDetail.Contractor       = Contractor.Code
    LEFT JOIN ShiftDetail
        ON  CheckInOut.ShiftCode         = ShiftDetail.Code
    LEFT JOIN CardType
        ON  Name.[1_CardTypeCode]        = CardType.Code
    LEFT JOIN BusinessUnit
        ON  deptskilllog.deptCode        = BusinessUnit.Code
    LEFT JOIN NATUREOFWORK
        ON BadgeDetail.NatureOfWork = NATUREOFWORK.CODE
    LEFT JOIN WorkSkill
        ON  Name.[1_WorkSkillCode]       = WorkSkill.Code
    WHERE
        CheckInOut.CheckInDateTime >= @p_fromdate
        AND CheckInOut.CheckInDateTime <= @p_nowdate
        AND (
            (Contractor.Name = 'Western Refrigeration Pvt Ltd Tadgam' 
             AND NATUREOFWORK.NAME = 'Technician')
         OR (Contractor.Name <> 'Western Refrigeration Pvt Ltd Tadgam')
        )
        AND CheckInOut.Status <> 'V'
        AND CheckInOut.OutFlag <> 'AB'
    ORDER BY
        Contractor.Name,
        Name.Name,
        CheckInOut.CheckInDateTime;
  `;

  const pool = await new sql.ConnectionPool(dbConfig4).connect();
  try {
    const result = await pool.request().query(query);
    const data   = result.recordset ?? [];

    res.status(200).json({
      success:    true,
      message:    "Manpower Report fetched successfully.",
      data,
      totalCount: data.length,
    });
  } finally {
    await pool.close();
  }
});