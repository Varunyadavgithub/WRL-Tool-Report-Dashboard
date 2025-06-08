import sql, { dbConfig1 } from "../../config/db.js";

export const getDispatchHoldDetails = async (req, res) => {
  const { startDate, endDate, status } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  const istStart = new Date(new Date(startDate).getTime() + 330 * 60000);
  const istEnd = new Date(new Date(endDate).getTime() + 330 * 60000);

  let statusCondition = "";
  if (status) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "hold") {
      statusCondition =
        "dh.HoldDatetime BETWEEN @startDate AND @endDate AND mb.Status = 11 AND dh.ReleasedDateTime IS NULL ORDER BY dh.HoldDatetime DESC";
    } else if (lowerStatus === "release") {
      statusCondition =
        "dh.ReleasedDateTime BETWEEN @startDate AND @endDate  AND mb.Status = 1 AND dh.ReleasedDateTime IS NOT NULL ORDER BY dh.ReleasedDateTime DESC";
    } else {
      statusCondition = `    (
        (mb.Status = 11 AND dh.ReleasedDateTime IS NULL AND dh.HoldDatetime BETWEEN '2025-05-08 08:00:00.000' AND '2025-06-08 08:00:00.000')
        OR
        (mb.Status = 1 AND dh.ReleasedDateTime IS NOT NULL AND dh.ReleasedDateTime BETWEEN '2025-05-08 08:00:00.000' AND '2025-06-08 08:00:00.000')
    )
    ORDER BY
      ISNULL(dh.ReleasedDateTime, dh.HoldDatetime) DESC;`;
    }
  }

  const query = `
    SELECT
      m.Name AS ModelNo,
      dh.Serial AS FGSerialNo,
      dh.DefectCode AS HoldReason,
      dh.HoldDatetime AS HoldDate,
      u.UserName AS HoldBy,
      DATEDIFF(
        DAY,
        dh.HoldDateTime,
        ISNULL(dh.ReleasedDateTime, GETDATE())
    ) AS DaysOnHold,
      ISNULL(dh.Action, 'Not Released') AS CorrectiveAction,
      dh.ReleasedDateTime AS ReleasedOn,
      us.UserName AS ReleasedBy,
      CASE
        WHEN dh.ReleasedDateTime IS NULL THEN 'Hold'
        ELSE 'Release'
      END AS Status
    FROM DispatchHold AS dh
    INNER JOIN MaterialBarcode mb ON mb.Serial = dh.Serial
    INNER JOIN Material m ON m.MatCode = dh.Material
    LEFT JOIN Users u ON u.UserCode = dh.HoldUserCode
    LEFT JOIN Users us ON us.UserCode = dh.ReleasedUserCode
    WHERE
    ${statusCondition};
  `;

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      data: result.recordset,
      totalCount: result.recordset.length,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
