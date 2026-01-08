import sql from "mssql";
import { dbConfig3 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

/* ===================== ADD / UPDATE ASSET ===================== */
export const addAsset = tryCatch(async (req, res) => {
  const d = req.body;

  const filePath = req.file
    ? `/uploads/calibration/${req.file.filename}`
    : null;

  const assetId =
    d.id !== undefined && d.id !== null && d.id !== ""
      ? parseInt(d.id, 10)
      : null;

  if (!d.lastDate || !d.frequency) {
    throw new AppError(
      "Missing required field Invalid Date and Frequency.",
      400
    );
  }

  const nextDate = new Date(d.lastDate);
  nextDate.setMonth(nextDate.getMonth() + Number(d.frequency));

  const pool = await sql.connect(dbConfig3);

  try {
    /* ===================== UPDATE ===================== */
    if (assetId) {
      const existing = await pool.request().input("ID", sql.Int, assetId)
        .query(`
          SELECT owner_employee_id, department_id
          FROM CalibrationAssets
          WHERE ID=@ID
        `);

      if (!existing.recordset.length) {
        throw new AppError("Asset not found.", 404);
      }

      const ownerEmployeeId =
        d.owner_employee_id ?? existing.recordset[0].owner_employee_id;

      const departmentId =
        d.department_id ?? existing.recordset[0].department_id;

      await pool
        .request()
        .input("ID", sql.Int, assetId)
        .input("EquipmentName", d.equipment)
        .input("IdentificationNo", d.identification)
        .input("LeastCount", d.leastCount)
        .input("RangeValue", d.range)
        .input("Location", d.location)
        .input("LastCalibrationDate", d.lastDate)
        .input("NextCalibrationDate", nextDate)
        .input("FrequencyMonths", Number(d.frequency))
        .input("OwnerEmployeeId", ownerEmployeeId)
        .input("DepartmentId", departmentId)
        .input("Remarks", d.remarks || null).query(`
          UPDATE CalibrationAssets SET
            EquipmentName=@EquipmentName,
            IdentificationNo=@IdentificationNo,
            LeastCount=@LeastCount,
            RangeValue=@RangeValue,
            Location=@Location,
            LastCalibrationDate=@LastCalibrationDate,
            NextCalibrationDate=@NextCalibrationDate,
            FrequencyMonths=@FrequencyMonths,
            Remarks=@Remarks,
            owner_employee_id=@OwnerEmployeeId,
            department_id=@DepartmentId
          WHERE ID=@ID
        `);

      if (filePath) {
        await pool
          .request()
          .input("AssetID", assetId)
          .input("CalibratedOn", d.lastDate)
          .input("ValidTill", nextDate)
          .input("PerformedBy", d.ownerEmployeeId || null)
          .input("CalibrationAgency", d.agency || null)
          .input("Result", "Pass")
          .input("FilePath", filePath)
          .input("EscalationLevel", "Updated").query(`
            INSERT INTO CalibrationHistory
            (AssetID, CalibratedOn, ValidTill, PerformedBy,
             CalibrationAgency, Result, FilePath, EscalationLevel)
            VALUES
            (@AssetID,@CalibratedOn,@ValidTill,@PerformedBy,
             @CalibrationAgency,'Pass',@FilePath,@EscalationLevel)
          `);
      }

      return res.status(200).json({
        success: true,
        message: "Equipment Updated Successfully",
      });
    }

    /* ===================== INSERT ===================== */
    const result = await pool
      .request()
      .input("EquipmentName", d.equipment)
      .input("IdentificationNo", d.identification)
      .input("LeastCount", d.leastCount)
      .input("RangeValue", d.range)
      .input("Location", d.location)
      .input("LastCalibrationDate", d.lastDate)
      .input("NextCalibrationDate", nextDate)
      .input("FrequencyMonths", Number(d.frequency))
      .input("OwnerEmployeeId", d.owner_employee_id)
      .input("DepartmentId", d.department_id)
      .input("Status", "Calibrated")
      .input("Remarks", d.remarks || null).query(`
        INSERT INTO CalibrationAssets
        (
          EquipmentName,
          IdentificationNo,
          LeastCount,
          RangeValue,
          Location,
          LastCalibrationDate,
          NextCalibrationDate,
          FrequencyMonths,
          Status,
          Remarks,
          owner_employee_id,
          department_id
        )
        OUTPUT INSERTED.ID
        VALUES
        (
          @EquipmentName,
          @IdentificationNo,
          @LeastCount,
          @RangeValue,
          @Location,
          @LastCalibrationDate,
          @NextCalibrationDate,
          @FrequencyMonths,
          @Status,
          @Remarks,
          @OwnerEmployeeId,
          @DepartmentId
        )
      `);

    const newId = result.recordset[0].ID;

    if (filePath) {
      await pool
        .request()
        .input("AssetID", newId)
        .input("CalibratedOn", d.lastDate)
        .input("ValidTill", nextDate)
        .input("PerformedBy", d.ownerEmployeeId || null)
        .input("CalibrationAgency", d.agency || null)
        .input("Result", "Pass")
        .input("FilePath", filePath)
        .input("EscalationLevel", "Calibrated").query(`
          INSERT INTO CalibrationHistory
          (AssetID, CalibratedOn, ValidTill, PerformedBy,
           CalibrationAgency, Result, FilePath, EscalationLevel)
          VALUES
          (@AssetID,@CalibratedOn,@ValidTill,@PerformedBy,
           @CalibrationAgency,'Pass',@FilePath,@EscalationLevel)
        `);
    }

    res
      .status(200)
      .json({ success: true, message: "Equipment Added Successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to add or update the assets data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* ===================== UPLOAD CALIBRATION REPORT ===================== */
export const uploadCalibrationReport = tryCatch(async (req, res) => {
  const assetId = parseInt(req.params.id);
  const filePath = `/uploads/calibration/${req.file.filename}`;
  const { performedByEmpId, agency, result } = req.body;

  if (!assetId || !result) {
    throw new AppError("Missing required field assetId and result.", 400);
  }

  const pool = await sql.connect(dbConfig3);

  try {
    const asset = await pool.request().input("ID", sql.Int, assetId).query(`
        SELECT FrequencyMonths
        FROM CalibrationAssets
        WHERE ID=@ID
      `);

    if (!asset.recordset.length) {
      throw new AppError("Asset not found.", 404);
    }

    const lastDate = asset.recordset[0].LastCalibrationDate;
    const freq = asset.recordset[0].FrequencyMonths;

    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + freq);

    await pool
      .request()
      .input("AssetID", assetId)
      .input("CalibratedOn", lastDate)
      .input("ValidTill", nextDate)
      .input("PerformedBy", performedByEmpId)
      .input("CalibrationAgency", agency)
      .input("Result", result)
      .input("FilePath", filePath)
      .input("EscalationLevel", result === "Fail" ? "Critical" : "Calibrated")
      .query(`
        INSERT INTO CalibrationHistory
        (AssetID, CalibratedOn, ValidTill, PerformedBy,
         CalibrationAgency, Result, FilePath, EscalationLevel)
        VALUES
        (@AssetID,@CalibratedOn,@ValidTill,@PerformedBy,
         @CalibrationAgency,@Result,@FilePath,@EscalationLevel)
      `);

    await pool
      .request()
      .input("ID", sql.Int, assetId)
      .input("Status", result === "Fail" ? "Out of Calibration" : "Calibrated")
      .input("LastCalibrationDate", calibratedOn)
      .input("NextCalibrationDate", nextDate).query(`
        UPDATE CalibrationAssets
        SET
          Status = @Status,
          LastCalibrationDate = @LastCalibrationDate,
          NextCalibrationDate = @NextCalibrationDate,
          EscalationLevel = NULL,
          LastEscalationSentOn = NULL
        WHERE ID = @ID
      `);

    await pool.request().input("AssetID", sql.Int, assetId).query(`
        UPDATE CalibrationEscalationLog
        SET Remarks = 'Resolved by new calibration',
            TriggeredBy = 'SYSTEM'
        WHERE AssetID = @AssetID
          AND Remarks IS NULL
      `);

    res.status(200).json({
      success: true,
      message: "Calibration report uploaded successfully.",
    });
  } catch (error) {
    throw new AppError(
      `Failed to Upload Calibration Report data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* ===================== GET ALL ASSETS ===================== */
export const getAllAssets = tryCatch(async (req, res) => {
  const query = `
    SELECT A.*, H.EmployeeName, H.DepartmentName
    FROM CalibrationAssets A
    OUTER APPLY (
      SELECT TOP 1
        U.name AS EmployeeName,
        D.department_name AS DepartmentName
      FROM CalibrationHistory CH
      LEFT JOIN users U ON U.employee_id = CH.PerformedBy
      LEFT JOIN departments D ON D.DeptCode = U.department_id
      WHERE CH.AssetID = A.ID
      ORDER BY CH.CreatedAt DESC
    ) H
    ORDER BY A.NextCalibrationDate ASC
  `;

  const pool = await sql.connect(dbConfig3);

  try {
    const data = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "All Assets retrieved successfully.",
      data: data.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch All Assets data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/* ===================== ADD CALIBRATION CYCLE ===================== */
export const addCalibrationRecord = tryCatch(async (req, res) => {
  const { assetId, calibratedOn, performedBy, agency, result, remarks, file } =
    req.body;

  const next = new Date(calibratedOn);
  next.setMonth(next.getMonth() + 12);

  const query = `
    INSERT INTO CalibrationHistory
      (AssetID, CalibratedOn, ValidTill, PerformedBy, CalibrationAgency, Result, FilePath, Remarks, EscalationLevel)
    VALUES
      (@AssetID,@CalibratedOn,@ValidTill,@PerformedBy, @CalibrationAgency,@Result,@FilePath,@Remarks,@EscalationLevel)
  `;

  const pool = await sql.connect(dbConfig3);

  try {
    await pool
      .request()
      .input("AssetID", assetId)
      .input("CalibratedOn", calibratedOn)
      .input("ValidTill", next)
      .input("PerformedBy", performedBy)
      .input("CalibrationAgency", agency)
      .input("Result", result)
      .input("Remarks", remarks)
      .input("FilePath", file)
      .input("EscalationLevel", "Calibrated")
      .query(query);

    res
      .status(200)
      .json({ success: true, message: "Calibration Logged Successfully" });
  } catch (error) {
    throw new AppError(`Failed to add Calibration data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/* ===================== GET CERTIFICATES ===================== */
export const getCertificates = tryCatch(async (req, res) => {
  const query = `
    SELECT 
      CH.ID, 
      CH.AssetID, 
      CH.CreatedAt        AS EventTime, 
      'CALIBRATION'       AS EventType, 
      CH.Result, 
      CH.FilePath, 
      U.name              AS EmployeeName, 
      D.department_name, 
      NULL                AS EscalationLevel, 
      NULL                AS MailTo, 
      NULL                AS MailCC, 
      CH.CalibrationAgency, 
      CH.ValidTill
    FROM CalibrationHistory CH
    LEFT JOIN users U
      ON U.employee_id = CH.PerformedBy
    LEFT JOIN departments D
      ON D.DeptCode = U.department_id
    WHERE CH.AssetID = @id

    UNION ALL

    SELECT
      EL.ID,
      EL.AssetID,
      EL.TriggeredOn      AS EventTime,
      'ESCALATION'        AS EventType,
      NULL                AS Result,
      NULL                AS FilePath,
      NULL                AS EmployeeName,
      NULL                AS department_name,
      CONCAT('L', EL.EscalationLevel) AS EscalationLevel,
      EL.MailTo,
      EL.MailCC,
      NULL                AS CalibrationAgency,
      NULL                AS ValidTill
    FROM CalibrationEscalationLog EL
    WHERE EL.AssetID = @id

    ORDER BY EventTime DESC
  `;

  const pool = await sql.connect(dbConfig3);

  try {
    const data = await pool.request().input("id", req.params.id).query(query);

    res.status(200).json({
      success: true,
      message: "Certificates retrieved successfully.",
      data: data.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Certificates:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* ===================== UPLOAD CERTIFICATE ONLY ===================== */
export const uploadCertificate = tryCatch(async (req, res) => {
  const filePath = `/uploads/calibration/${req.file.filename}`;

  const query = `
    UPDATE CalibrationAssets
    SET Remarks='Report Updated'
    WHERE ID=@AssetID
  `;

  const pool = await sql.connect(dbConfig3);

  try {
    await pool
      .request()
      .input("AssetID", req.params.id)
      .input("FilePath", filePath)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Certificate Uploaded successfully.",
    });
  } catch (error) {
    throw new AppError(
      `Failed to upload the Certificates:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

/* ===================== ASSET + HISTORY ===================== */
export const getAssetWithHistory = tryCatch(async (req, res) => {
  const pool = await sql.connect(dbConfig3);

  try {
    const asset = await pool
      .request()
      .input("id", req.params.id)
      .query(`SELECT * FROM CalibrationAssets WHERE ID=@id`);

    const history = await pool
      .request()
      .input("id", req.params.id)
      .query(`SELECT * FROM CalibrationHistory WHERE AssetID=@id`);

    res.status(200).json({
      success: true,
      message: "Assets and History retrieved successfully.",
      asset: asset.recordset[0],
      history: history.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetche the Asset and History data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
