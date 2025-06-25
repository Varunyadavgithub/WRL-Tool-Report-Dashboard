import path from "path";
import fs from "fs";
import sql, { dbConfig1 } from "../../config/db.js";

const uploadDir = path.resolve("uploads", "BISReport");

// Upload file controller
export const uploadBisPdfFile = async (req, res) => {
  const { modelName, year, description } = req.body;
  const fileName = req.file?.filename;

  if (!modelName || !year || !description || !fileName) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const uploadedAt = new Date(Date.now() + 330 * 60000);

  try {
    const pool = await sql.connect(dbConfig1);

    const query = `
      INSERT INTO BISUpload (ModelName, Year, Description, FileName, UploadAT)
      VALUES (@ModelName, @Year, @Description, @FileName, @UploadAT)
    `;
    const result = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Year", sql.VarChar, year)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, fileName)
      .input("UploadAT", sql.DateTime, uploadedAt)
      .query(query);

    res.status(200).json({
      success: true,
      filename: req.file.originalname,
      fileUrl: `/uploads/BISReport/${req.file.filename}`,
      message: "Uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get files list controller
export const getBisPdfFiles = async (_, res) => {
  try {
    const pool = await sql.connect(dbConfig1);
    const query = `
      SELECT * FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const result = await pool.request().query(query);

    const files = result.recordset.map((file) => ({
      srNo: file.SrNo,
      modelName: file.ModelName,
      year: file.Year,
      description: file.Description,
      fileName: file.FileName,
      url: `/uploads-bis-pdf/${file.FileName}`,
      uploadAt: file.UploadAT,
    }));

    res.status(200).json({ success: true, files });
    await pool.close();
  } catch (error) {
    console.error("Error reading files:", error.message);
    res.status(500).json({ success: false, message: "Error reading files" });
  }
};

// Download file controller
export const downloadBisPdfFile = async (req, res) => {
  const { srNo } = req.params;
  const { filename } = req.query;
  if (!srNo) {
    return res.status(400).json({
      success: false,
      message: "SrNo is required",
    });
  }

  const filePath = path.join(uploadDir, filename);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Verify file in database
    const pool = await sql.connect(dbConfig1);
    const query = `
      SELECT FileName, ModelName, Year 
      FROM BISUpload 
      WHERE SrNo = @SrNo
    `;

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "File record not found in database",
      });
    }

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);

    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("File streaming error:", error);
      res.status(500).json({
        success: false,
        message: "Error streaming file",
      });
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during file download",
      error: error.message,
    });
  }
};

// Delete file controller
export const deleteBisPdfFile = async (req, res) => {
  const { srNo } = req.params;
  const { filename } = req.query;

  if (!srNo) {
    return res
      .status(400)
      .json({ success: false, message: "SrNo is required" });
  }

  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  try {
    // Delete the physical file
    fs.unlinkSync(filePath);

    // Connect to DB and delete the record based on filename and year
    const pool = await sql.connect(dbConfig1);
    const query = `
      DELETE FROM BISUpload 
      WHERE SrNo = @SrNo
    `;

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(query);

    res
      .status(200)
      .json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete file" });
  }
};

// Update BIS File Controller
export const updateBisPdfFile = async (req, res) => {
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

export const getBisReportStatus = async (_, res) => {
  try {
    const pool = await sql.connect(dbConfig1);

    // First, fetch the BIS Upload files
    const filesQuery = `
      SELECT * FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const filesResult = await pool.request().query(filesQuery);

    const files = filesResult.recordset.map((file) => ({
      srNo: file.SrNo,
      modelName: file.ModelName,
      year: file.Year,
      description: file.Description,
      fileName: file.FileName,
      url: `/uploads-bis-pdf/${file.FileName}`,
      uploadAt: file.UploadAT,
    }));

    // Then, fetch the BIS Report Status
    const istDate = new Date(Date.now() + 330 * 60000);
    const formattedDate = istDate.toISOString().slice(0, 19).replace("T", " ");

    const statusQuery = `
     WITH Psno AS (
    SELECT DocNo, Material 
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
),
FilteredData AS (
    SELECT 
        m.Name AS FullModel,
        LEFT(m.Name, 9) AS Model_Prefix,
        b.ActivityOn,
        CASE WHEN RIGHT(m.Name, 1) = 'R' THEN 'R' ELSE '' END AS HasRT
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON m.MatCode = Psno.Material
    WHERE m.CertificateControl <> 0
      AND b.ActivityType = 5
      AND c.StationCode IN (1220010)
      AND b.ActivityOn BETWEEN '2022-01-01 00:00:01' AND @CurrentDate
),
ProductionSummary AS (
    SELECT 
        Model_Prefix,
        YEAR(ActivityOn) AS Activity_Year,
        MAX(HasRT) AS LastChar, -- Will be 'R' if any model ends with 'R'
        COUNT(*) AS Model_Count
    FROM FilteredData
    GROUP BY Model_Prefix, YEAR(ActivityOn)
),
-- Deduplicate BISUpload table
DedupedBIS AS (
    SELECT *
    FROM (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY LEFT(ModelName, 9), Year
                   ORDER BY ModelName
               ) AS rn
        FROM BISUpload
    ) AS sub
    WHERE rn = 1
),
FinalResult AS (
    SELECT 
        COALESCE(b.ModelName, 
                 CONCAT(p.Model_Prefix, CASE WHEN p.LastChar = 'R' THEN ' RT' ELSE '' END)
        ) AS ModelName,
        p.Activity_Year AS Year,
        p.Model_Count AS Prod_Count,
        CASE 
            WHEN b.ModelName IS NOT NULL THEN 'Test Completed'
            ELSE 'Test Pending'
        END AS Status,
        b.FileName,
        b.Description
    FROM ProductionSummary p
    LEFT JOIN DedupedBIS b
      ON LEFT(b.ModelName, 9) = p.Model_Prefix
     AND b.Year = p.Activity_Year
     AND (
         RIGHT(b.ModelName, 2) != 'RT' -- normal model
         OR (RIGHT(b.ModelName, 2) = 'RT' AND p.LastChar = 'R') -- RT logic
     )
)
SELECT * 
FROM FinalResult
ORDER BY ModelName, Year;
    `;

    const statusResult = await pool
      .request()
      .input("CurrentDate", sql.DateTime, new Date(formattedDate))
      .query(statusQuery);

    const status = statusResult.recordset.map((item) => ({
      ...item,
      fileUrl: item.FileName ? `/uploads-bis-pdf/${item.FileName}` : null,
    }));

    // Combine files and status
    const combinedResult = {
      files: files,
      status: status,
    };

    res.status(200).json({
      success: true,
      ...combinedResult,
    });

    await pool.close();
  } catch (error) {
    console.error("Error reading files and status:", error.message);
    res.status(500).json({
      success: false,
      message: "Error reading files and status",
      error: error.message,
    });
  }
};
