import sql, { dbConfig1 } from "../../config/db.js";

export const getFpaDefectReport = async (req, res) => {
  const { ReportType, DefectName, Model, StartDate, EndDate, TopCount } = req.query;

  if (!ReportType) {
    return res.status(400).json({ success: false, message: "ReportType is required (Daily/Monthly/Yearly)" });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool.request();

    request.input("ReportType", sql.VarChar, ReportType);
    request.input("DefectName", sql.VarChar, DefectName || null);
    request.input("Model", sql.VarChar, Model || null);
    request.input("StartDate", sql.Date, StartDate || null);
    request.input("EndDate", sql.Date, EndDate || null);
    request.input("TopCount", sql.Int, TopCount ? parseInt(TopCount) : 5);  // default Top 5

    const result = await request.execute("GetFPAReport");

    res.json({ success: true, results: result.recordset });
    pool.close();
  } catch (error) {
    console.error("FPA Report Fetch Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


