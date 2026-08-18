import sql from "mssql";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import {
  getWwmsPool,
  nowIST,
  generateSessionId,
  parseFgLabel,
  lookupMaterialBySerial,
  logDuplicateScan,
  logDispatchError,
  isUniqueViolation,
} from "./scanHelpers.js";

const getUserDisplayName = (req) => req.user?.name || req.user?.usercode || "unknown";

// POST /api/dispatch/session/create
// Body: { vehicleNo, dockNo }
export const createOrResumeSession = tryCatch(async (req, res) => {
  const { vehicleNo, dockNo } = req.body;

  if (!vehicleNo?.trim() || !dockNo?.trim()) {
    throw new AppError("vehicleNo and dockNo are required.", 400);
  }

  const pool = await getWwmsPool();

  // One Open session per vehicle at a time — resume it instead of creating a new one
  const existing = await pool
    .request()
    .input("VehicleNo", sql.VarChar, vehicleNo.trim())
    .query(`
      SELECT TOP 1 Document_ID, Session_ID, Vehicle_No, DockNo, Count
      FROM Tracking_Document
      WHERE Vehicle_No = @VehicleNo AND LatestStatus = 'Open'
      ORDER BY Generated_On DESC
    `);

  if (existing.recordset.length) {
    const row = existing.recordset[0];
    return res.status(200).json({
      success: true,
      resumed: true,
      message: `Resuming open session for ${row.Vehicle_No}`,
      data: {
        documentId: row.Document_ID,
        sessionId: row.Session_ID,
        vehicleNo: row.Vehicle_No,
        dockNo: row.DockNo,
        count: row.Count,
      },
    });
  }

  const sessionId = generateSessionId();

  const inserted = await pool
    .request()
    .input("SessionId", sql.VarChar, sessionId)
    .input("VehicleNo", sql.VarChar, vehicleNo.trim())
    .input("DockNo", sql.VarChar, dockNo.trim())
    .input("GeneratedOn", sql.DateTime, nowIST())
    .input("GeneratedBy", sql.VarChar, getUserDisplayName(req)).query(`
      INSERT INTO Tracking_Document (Session_ID, Vehicle_No, DockNo, Generated_On, Generated_By, Count, LatestStatus)
      OUTPUT INSERTED.Document_ID
      VALUES (@SessionId, @VehicleNo, @DockNo, @GeneratedOn, @GeneratedBy, 0, 'Open')
    `);

  return res.status(200).json({
    success: true,
    resumed: false,
    message: "Dispatch session created",
    data: {
      documentId: inserted.recordset[0].Document_ID,
      sessionId,
      vehicleNo: vehicleNo.trim(),
      dockNo: dockNo.trim(),
      count: 0,
    },
  });
});

// GET /api/dispatch/session/open
export const getOpenSessions = tryCatch(async (req, res) => {
  const pool = await getWwmsPool();
  const result = await pool.request().query(`
    SELECT Document_ID, Session_ID, Vehicle_No, DockNo, Generated_On, Generated_By, Count, LatestModelName
    FROM Tracking_Document
    WHERE LatestStatus = 'Open'
    ORDER BY Generated_On DESC
  `);

  res.status(200).json({ success: true, data: result.recordset });
});

// GET /api/dispatch/session/:documentId
export const getSessionDetail = tryCatch(async (req, res) => {
  const documentId = parseInt(req.params.documentId, 10);
  if (!Number.isInteger(documentId)) throw new AppError("Invalid documentId.", 400);

  const pool = await getWwmsPool();

  const sessionResult = await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .query(`SELECT * FROM Tracking_Document WHERE Document_ID = @DocumentId`);

  const session = sessionResult.recordset[0];
  if (!session) throw new AppError("Session not found.", 404);

  const itemsResult = await pool
    .request()
    .input("DocumentId", sql.Int, documentId)
    .query(`SELECT * FROM TempDispatch WHERE Document_ID = @DocumentId ORDER BY AddedOn DESC`);

  res.status(200).json({ success: true, data: { session, items: itemsResult.recordset } });
});

// POST /api/dispatch/scan
// Body: { documentId, rawBarcode }
export const scanFgDispatch = tryCatch(async (req, res) => {
  const { documentId, rawBarcode } = req.body;
  const docId = parseInt(documentId, 10);

  if (!Number.isInteger(docId)) throw new AppError("documentId is required.", 400);
  if (!rawBarcode || !String(rawBarcode).trim()) {
    throw new AppError("rawBarcode is required.", 400);
  }

  const pool = await getWwmsPool();

  const sessionResult = await pool
    .request()
    .input("DocumentId", sql.Int, docId)
    .query(`SELECT Document_ID, Session_ID, LatestStatus FROM Tracking_Document WHERE Document_ID = @DocumentId`);

  const session = sessionResult.recordset[0];
  if (!session) throw new AppError("Dispatch session not found.", 404);
  if (session.LatestStatus !== "Open") {
    throw new AppError("This dispatch session is not open.", 400);
  }

  const parsed = parseFgLabel(rawBarcode);
  if (!parsed) {
    await logDispatchError({
      sessionId: session.Session_ID,
      errorMessage: "Improper Data Format for FG",
      errorId: 3,
    });
    return res.status(422).json({ success: false, code: "INVALID_FORMAT", message: "Invalid FG Label Format" });
  }

  const material = await lookupMaterialBySerial(parsed.serial);
  if (!material) {
    await logDispatchError({
      sessionId: session.Session_ID,
      fgSerialNo: parsed.serial,
      errorMessage: "Invalid FG Serial Number",
      errorId: 7,
    });
    return res.status(404).json({ success: false, code: "INVALID_SERIAL", message: "Invalid FG Serial Number" });
  }

  const { FGSerialNo, ModelName, ModelCode } = material;
  // AssetCode is optional (not every FG has one), but DispatchMaster.AssetCode is NOT NULL —
  // store "" instead of null rather than rejecting the scan.
  const AssetCode = material.AssetCode?.trim() || "";

  // 1) Already dispatched?
  const alreadyDispatched = await pool
    .request()
    .input("FGSerialNo", sql.VarChar, FGSerialNo)
    .query(`SELECT FGSerialNo FROM DispatchMaster WHERE FGSerialNo = @FGSerialNo`);
  if (alreadyDispatched.recordset.length) {
    await logDuplicateScan({ modelName: ModelName, fgSerialNo: FGSerialNo });
    return res.status(409).json({ success: false, code: "ALREADY_DISPATCHED", message: "FG Already Dispatched" });
  }

  // 2) Already being loaded (in TempDispatch, any session)?
  const inProgress = await pool
    .request()
    .input("FGSerialNo", sql.VarChar, FGSerialNo)
    .query(`SELECT FGSerialNo FROM TempDispatch WHERE FGSerialNo = @FGSerialNo`);
  if (inProgress.recordset.length) {
    await logDuplicateScan({ modelName: ModelName, fgSerialNo: FGSerialNo });
    return res.status(409).json({ success: false, code: "ALREADY_LOADING", message: "FG Already Being Loaded" });
  }

  // 3) QA hold?
  if (material.Status === 11) {
    await logDispatchError({
      sessionId: session.Session_ID,
      fgSerialNo: FGSerialNo,
      assetNo: AssetCode,
      modelName: ModelName,
      modelCode: ModelCode,
      errorMessage: "FG Cabinet Hold in MES",
      errorId: 6,
    });
    return res.status(409).json({ success: false, code: "QA_HOLD", message: "This FG is on Hold by QA" });
  }

  // 3b) Scrapped?
  if (material.Status === 99) {
    await logDispatchError({
      sessionId: session.Session_ID,
      fgSerialNo: FGSerialNo,
      assetNo: AssetCode,
      modelName: ModelName,
      modelCode: ModelCode,
      errorMessage: "FG Scrapped",
      errorId: 8,
    });
    return res.status(409).json({ success: false, code: "SCRAPPED", message: "This FG is Scrapped" });
  }

  // 4) Dispatch Unloading completed?
  const unloaded = await pool
    .request()
    .input("FGSerialNo", sql.VarChar, FGSerialNo)
    .query(`SELECT FGSerialNo FROM DispatchUnloading WHERE FGSerialNo = @FGSerialNo`);
  if (!unloaded.recordset.length) {
    await logDispatchError({
      sessionId: session.Session_ID,
      fgSerialNo: FGSerialNo,
      assetNo: AssetCode,
      modelName: ModelName,
      modelCode: ModelCode,
      errorMessage: "Dispatch Un-Loading Record Does not Exist",
      errorId: 1,
    });
    return res.status(409).json({ success: false, code: "UNLOADING_PENDING", message: "Dispatch Unloading is Pending" });
  }

  // All valid -> add to TempDispatch + bump session counters, transactionally
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("ModelName", sql.VarChar, ModelName)
      .input("FGSerialNo", sql.VarChar, FGSerialNo)
      .input("AssetCode", sql.VarChar, AssetCode)
      .input("SessionId", sql.VarChar, session.Session_ID)
      .input("AddedOn", sql.DateTime, nowIST())
      .input("AddedBy", sql.VarChar, getUserDisplayName(req))
      .input("DocumentId", sql.Int, docId)
      .input("ModelCode", sql.VarChar, String(ModelCode)).query(`
        INSERT INTO TempDispatch (ModelName, FGSerialNo, AssetCode, Session_ID, AddedOn, AddedBy, Document_ID, ModelCode)
        VALUES (@ModelName, @FGSerialNo, @AssetCode, @SessionId, @AddedOn, @AddedBy, @DocumentId, @ModelCode)
      `);

    await new sql.Request(transaction)
      .input("DocumentId", sql.Int, docId)
      .input("ModelName", sql.VarChar, ModelName)
      .input("ModelCode", sql.VarChar, String(ModelCode)).query(`
        UPDATE Tracking_Document
        SET Count = Count + 1, LatestModelName = @ModelName, ModelCode = @ModelCode
        WHERE Document_ID = @DocumentId
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    if (isUniqueViolation(err)) {
      await logDuplicateScan({ modelName: ModelName, fgSerialNo: FGSerialNo });
      return res.status(409).json({ success: false, code: "ALREADY_LOADING", message: "FG Already Being Loaded" });
    }
    throw new AppError(`Failed to add FG to dispatch: ${err.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "FG Added to Dispatch",
    data: { modelName: ModelName, fgSerialNo: FGSerialNo, assetCode: AssetCode, batchCode: material.BatchCode },
  });
});

// POST /api/dispatch/complete
// Body: { documentId }
export const completeDispatch = tryCatch(async (req, res) => {
  const docId = parseInt(req.body.documentId, 10);
  if (!Number.isInteger(docId)) throw new AppError("documentId is required.", 400);

  const pool = await getWwmsPool();

  const sessionResult = await pool
    .request()
    .input("DocumentId", sql.Int, docId)
    .query(`SELECT Document_ID, Session_ID, LatestStatus FROM Tracking_Document WHERE Document_ID = @DocumentId`);
  const session = sessionResult.recordset[0];
  if (!session) throw new AppError("Dispatch session not found.", 404);
  if (session.LatestStatus !== "Open") throw new AppError("This dispatch session is not open.", 400);

  const itemsResult = await pool
    .request()
    .input("DocumentId", sql.Int, docId)
    .query(`SELECT * FROM TempDispatch WHERE Document_ID = @DocumentId`);
  const items = itemsResult.recordset;
  if (!items.length) throw new AppError("No FG scanned in this session yet.", 400);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const item of items) {
      await new sql.Request(transaction)
        .input("ModelName", sql.VarChar, item.ModelName)
        .input("FGSerialNo", sql.VarChar, item.FGSerialNo)
        .input("AssetCode", sql.VarChar, item.AssetCode)
        .input("SessionId", sql.VarChar, item.Session_ID)
        .input("AddedOn", sql.DateTime, nowIST())
        .input("AddedBy", sql.VarChar, getUserDisplayName(req))
        .input("DocumentId", sql.Int, item.Document_ID)
        .input("ModelCode", sql.VarChar, item.ModelCode).query(`
          INSERT INTO DispatchMaster (ModelName, FGSerialNo, AssetCode, Session_ID, AddedOn, AddedBy, Document_ID, ModelCode)
          VALUES (@ModelName, @FGSerialNo, @AssetCode, @SessionId, @AddedOn, @AddedBy, @DocumentId, @ModelCode)
        `);

      await new sql.Request(transaction)
        .input("FGSerialNo", sql.VarChar, item.FGSerialNo)
        .query(`DELETE FROM TempDispatch WHERE FGSerialNo = @FGSerialNo`);
    }

    await new sql.Request(transaction)
      .input("DocumentId", sql.Int, docId)
      .query(`UPDATE Tracking_Document SET LatestStatus = 'Completed' WHERE Document_ID = @DocumentId`);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    await logDispatchError({
      sessionId: session.Session_ID,
      errorMessage: `Dispatch completion failed: ${err.message}`,
    });
    throw new AppError(`Failed to complete dispatch: ${err.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "Dispatch Completed Successfully",
    data: { documentId: docId, sessionId: session.Session_ID, completedCount: items.length },
  });
});

// POST /api/dispatch/scan/remove
// Body: { documentId, fgSerialNo } — only while the session is still Open
export const removeFgFromSession = tryCatch(async (req, res) => {
  const { fgSerialNo } = req.body;
  const docId = parseInt(req.body.documentId, 10);

  if (!Number.isInteger(docId)) throw new AppError("documentId is required.", 400);
  if (!fgSerialNo?.trim()) throw new AppError("fgSerialNo is required.", 400);

  const pool = await getWwmsPool();

  const sessionResult = await pool
    .request()
    .input("DocumentId", sql.Int, docId)
    .query(`SELECT Document_ID, Session_ID, LatestStatus FROM Tracking_Document WHERE Document_ID = @DocumentId`);
  const session = sessionResult.recordset[0];
  if (!session) throw new AppError("Dispatch session not found.", 404);
  if (session.LatestStatus !== "Open") {
    throw new AppError("FG can only be removed while the dispatch session is Open.", 400);
  }

  const itemResult = await pool
    .request()
    .input("FGSerialNo", sql.VarChar, fgSerialNo.trim())
    .input("DocumentId", sql.Int, docId)
    .query(`SELECT FGSerialNo FROM TempDispatch WHERE FGSerialNo = @FGSerialNo AND Document_ID = @DocumentId`);
  if (!itemResult.recordset.length) {
    throw new AppError("This FG is not part of the current session.", 404);
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("FGSerialNo", sql.VarChar, fgSerialNo.trim())
      .input("DocumentId", sql.Int, docId)
      .query(`DELETE FROM TempDispatch WHERE FGSerialNo = @FGSerialNo AND Document_ID = @DocumentId`);

    await new sql.Request(transaction)
      .input("DocumentId", sql.Int, docId)
      .query(`
        UPDATE Tracking_Document
        SET Count = CASE WHEN Count > 0 THEN Count - 1 ELSE 0 END
        WHERE Document_ID = @DocumentId
      `);

    await new sql.Request(transaction)
      .input("deletedBy", sql.NVarChar, getUserDisplayName(req))
      .input("deletedAt", sql.DateTime, nowIST())
      .input("inputType", sql.NVarChar, "DISPATCH_SCAN_REMOVE")
      .input("sessionId", sql.NVarChar, session.Session_ID)
      .input("fgSerialNo", sql.NVarChar, fgSerialNo.trim())
      .input("deletedFrom", sql.NVarChar, "TempDispatch")
      .input("notFoundIn", sql.NVarChar, null)
      .input("hasError", sql.Bit, 0)
      .input("errorDetail", sql.NVarChar, null).query(`
        INSERT INTO DispatchDeleteLog
          (DeletedBy, DeletedAt, InputType, SessionID, FGSerialNo, DeletedFrom, NotFoundIn, HasError, ErrorDetail)
        VALUES
          (@deletedBy, @deletedAt, @inputType, @sessionId, @fgSerialNo, @deletedFrom, @notFoundIn, @hasError, @errorDetail)
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new AppError(`Failed to remove FG from session: ${err.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "FG removed from dispatch",
    data: { fgSerialNo: fgSerialNo.trim() },
  });
});
