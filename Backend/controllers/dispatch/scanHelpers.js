import sql from "mssql";
import { dbConfig1, dbConfig2, connectToDB } from "../../config/db.config.js";
import { convertToIST } from "../../utils/convertToIST.js";

// Garuda_WRL_LIVE (MaterialBarcode/Material master) and WWMS (dispatch tables) pools
export const getGarudaPool = () => connectToDB(dbConfig1);
export const getWwmsPool = () => connectToDB(dbConfig2);

export const nowIST = () => convertToIST(new Date());

// "WTDP" + yyyyMMddHHmmss (IST) — matches the legacy Session_ID format found in real data
export const generateSessionId = () => {
  const stamp = nowIST().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `WTDP${stamp}`;
};

// Real FG labels wrap every field in literal square brackets, e.g. "[42540260800605]"
const stripBrackets = (s) => s?.trim().replace(/^\[/, "").replace(/\]$/, "").trim() ?? "";

// Parses "[FGMATERIAL];[COUNTRY];[COLOR];[GRAPHICS];[SERIAL];[VSERIAL]" -> SERIAL is field 5
export const parseFgLabel = (rawBarcode) => {
  const parts = String(rawBarcode ?? "").trim().split(";");
  if (parts.length !== 6) return null;
  const serial = stripBrackets(parts[4]);
  if (!serial) return null;
  return {
    fgMaterial: stripBrackets(parts[0]),
    countryCode: stripBrackets(parts[1]),
    bodyColor: stripBrackets(parts[2]),
    graphics: stripBrackets(parts[3]),
    serial,
    vSerial: stripBrackets(parts[5]),
  };
};

// ModelCode is NOT Material.MatCode — it's the 4 digits right after the leading
// digit of the FG Serial itself, e.g. "41795260803230" -> "1795" (confirmed against
// real DispatchMaster/Tracking_Document history).
export const getModelCodeFromSerial = (serial) => String(serial ?? "").slice(1, 5);

// FG master lookup — Garuda_WRL_LIVE.MaterialBarcode + Material
export const lookupMaterialBySerial = async (serial) => {
  const pool = await getGarudaPool();
  const result = await pool
    .request()
    .input("Serial", sql.VarChar, serial)
    .query(`
      SELECT
        mb.Serial   AS FGSerialNo,
        mb.VSerial  AS AssetCode,
        mb.Serial2  AS BatchCode,
        mb.Status   AS Status,
        m.Name      AS ModelName
      FROM MaterialBarcode mb
      INNER JOIN Material m ON m.MatCode = mb.Material
      WHERE mb.Serial = @Serial
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, ModelCode: getModelCodeFromSerial(row.FGSerialNo) };
};

// Duplicate-scan attempts (unloading or dispatch) -> DispatchDuplicate (no session concept, matches its schema)
export const logDuplicateScan = async ({ modelName, fgSerialNo }) => {
  const pool = await getWwmsPool();
  await pool
    .request()
    .input("ModelName", sql.VarChar, modelName ?? "")
    .input("FGSerialNo", sql.VarChar, fgSerialNo)
    .input("Datetime", sql.DateTime, nowIST())
    .query(
      `INSERT INTO DispatchDuplicate (ModelName, FGSerialNo, Datetime) VALUES (@ModelName, @FGSerialNo, @Datetime)`
    );
};

// Validation-failure log -> DispatchErrorLog against a fixed ErrorMaster ErrorID.
// Session_ID is NOT NULL on this table even though FG Unloading has no real session —
// callers pass a synthetic `UNLOADING-<scannerNo>` sentinel in that case.
export const logDispatchError = async ({
  sessionId,
  fgSerialNo = null,
  assetNo = null,
  modelName = null,
  modelCode = null,
  errorMessage,
  errorId = null,
}) => {
  const pool = await getWwmsPool();
  await pool
    .request()
    .input("SessionId", sql.VarChar, sessionId)
    .input("FGSerialNo", sql.VarChar, fgSerialNo)
    .input("AssetNo", sql.VarChar, assetNo)
    .input("ModelName", sql.VarChar, modelName)
    .input("ModelCode", sql.VarChar, modelCode != null ? String(modelCode) : null)
    .input("ErrorMessage", sql.VarChar, errorMessage)
    .input("ErrorID", sql.Int, errorId)
    .input("ErrorOn", sql.DateTime, nowIST())
    .query(`
      INSERT INTO DispatchErrorLog
        (Session_ID, FGSerialNo, AssetNo, ModelName, ModelCode, ErrorMessage, ErrorID, ErrorOn)
      VALUES
        (@SessionId, @FGSerialNo, @AssetNo, @ModelName, @ModelCode, @ErrorMessage, @ErrorID, @ErrorOn)
    `);
};

// SQL Server unique-constraint violation numbers — the race-safe backstop behind the pre-checks
export const isUniqueViolation = (err) => err?.number === 2627 || err?.number === 2601;
