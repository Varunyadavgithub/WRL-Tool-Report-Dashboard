import sql, { dbConfig1 } from "../../config/db.js";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads");

// Upload file controller
export const uploadBisPdfFile = async (req, res) => {
  const { modelName, description } = req.body;
  const fileName = req.file?.filename;

  if (!modelName || !description || !fileName) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  // const originalFileName = fileName.split("-").slice(3).join("-");
  const uploadedAt = new Date().toISOString().split("T")[0]; // "yyyy-mm-dd"

  try {
    const pool = await sql.connect(dbConfig1);

    const query = `
      INSERT INTO BISUpload (ModelName, Description, FileName, UploadAT)
      VALUES (@ModelName, @Description, @FileName, @UploadAT)
    `;
    const result = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, fileName)
      .input("UploadAT", sql.DateTime, uploadedAt)
      .query(query);

    res.status(200).json({
      success: true,
      filename: req.file.originalname,
      fileUrl: `/uploads-bis-pdf/${req.file.filename}`,
      message: "Uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get files list controller
export const getBisReportFiles = async (_, res) => {
  try {
    const pool = await sql.connect(dbConfig1);
    const query = `
      SELECT * FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const result = await pool.request().query(query);

    const files = result.recordset.map((file) => ({
      id: file.Id,
      modelName: file.ModelName,
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
export const downloadBisFile = async (req, res) => {
  const { filename } = req.params;
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
      SELECT * FROM BISUpload 
      WHERE FileName = @FileName
    `;

    const result = await pool
      .request()
      .input("FileName", sql.VarChar, filename)
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
export const deleteBisFile = async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  try {
    fs.unlinkSync(filePath);

    const pool = await sql.connect(dbConfig1);
    const query = `
      DELETE FROM BISUpload WHERE FileName = @FileName
    `;

    const result = await pool
      .request()
      .input("FileName", sql.VarChar, filename)
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
export const updateBisFile = async (req, res) => {
  const { filename } = req.params;
  const { modelName, description } = req.body;
  const newFileName = req.file?.filename;

  if (!modelName || !description) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const pool = await sql.connect(dbConfig1);

    // If a new file is uploaded, delete the old file
    if (newFileName && newFileName !== filename) {
      const oldFilePath = path.join(uploadDir, filename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Prepare the update query
    const query = `
      UPDATE BISUpload 
      SET ModelName = @ModelName, 
          Description = @Description, 
          FileName = @FileName 
      WHERE FileName = @OldFileName
    `;

    const result = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, newFileName || filename)
      .input("OldFileName", sql.VarChar, filename)
      .query(query);

    // Check if the update was successful
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "File not found or no changes made",
      });
    }

    res.status(200).json({
      success: true,
      filename: newFileName || filename,
      fileUrl: `/uploads-bis-pdf/${newFileName || filename}`,
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
