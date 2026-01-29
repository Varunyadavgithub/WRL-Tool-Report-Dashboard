import path from "path";
import fs from "fs";
import sql, { dbConfig1, dbConfig3 } from "../../config/db.config.js";

// Update visitor data controller
export const updateVisitors = async (req, res) => {
  const { srNo } = req.params;
  const { modelName, year, description } = req.body;
  const newFileName = req.file?.filename;

  if (!modelName || !year || !description) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const pool = await sql.connect(dbConfig1);

    // If a new file is uploaded, delete the old file
    if (newFileName) {
      // First, get the old filename to delete
      const oldFileQuery = `SELECT FileName FROM BISUpload WHERE SrNo = @SrNo`;
      const oldFileResult = await pool
        .request()
        .input("SrNo", sql.Int, parseInt(srNo))
        .query(oldFileQuery);

      const oldFileName = oldFileResult.recordset[0]?.FileName;

      if (oldFileName) {
        const oldFilePath = path.join(uploadDir, oldFileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Prepare the update query using SrNo
    const query = `
      UPDATE BISUpload 
      SET ModelName = @ModelName, 
          Year = @Year,
          Description = @Description, 
          FileName = @FileName 
      WHERE SrNo = @SrNo
    `;

    const result = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Year", sql.VarChar, year)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, newFileName || null)
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(query);

    // Check if the update was successful
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Record not found or no changes made",
      });
    }

    res.status(200).json({
      success: true,
      srNo: srNo,
      filename: newFileName,
      fileUrl: newFileName ? `/uploads-bis-pdf/${newFileName}` : null,
      message: "Updated successfully",
    });
    await pool.close();
  } catch (error) {
    console.error("Update error:", error);

    // If a new file was uploaded but update failed, delete the new file
    if (req.file) {
      const newFilePath = path.join(uploadDir, req.file.filename);
      if (fs.existsSync(newFilePath)) {
        fs.unlinkSync(newFilePath);
      }
    }

    res.status(500).json({
      success: false,
      message: "Server error during update",
      error: error.message,
    });
  }
};

// fetch visitor data controller
export const visitors = async (_, res) => {
  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    const result = await pool.request().query("SELECT * FROM dbo.visitors");

    res.status(200).json({
      success: true,
      message: "Visitors data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error while fetching visitor data:", error.message);
    res.status(500).json({
      success: false,
      message: "Error while fetching visitor data",
      error: error.message,
    });
  } finally {
    if (pool) await pool.close();
  }
};
