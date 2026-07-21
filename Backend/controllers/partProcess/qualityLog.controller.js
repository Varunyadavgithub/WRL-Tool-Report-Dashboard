/** PartProcess Quality Log — manual inspection entries (pool3 / PartProcessQualityLog). */

// ── PartProcessQualityLog table helpers ──────────────────────────────────────

const ensureQualityLogTable = async () => {
  await global.pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'PartProcessQualityLog'
    )
    BEGIN
      CREATE TABLE PartProcessQualityLog (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName      NVARCHAR(50)   NULL,
        EventDate      DATE           NULL,
        Model          NVARCHAR(255)  NULL,
        PartName       NVARCHAR(255)  NULL,
        SapCode        NVARCHAR(100)  NULL,
        InspectedQty   INT            NOT NULL DEFAULT 0,
        RejectedQty    INT            NOT NULL DEFAULT 0,
        DefectCode     NVARCHAR(50)   NULL,
        DefectName     NVARCHAR(255)  NULL,
        Severity       NVARCHAR(50)   NULL,
        Disposition    NVARCHAR(50)   NULL,
        Inspector      NVARCHAR(255)  NULL,
        Remarks        NVARCHAR(MAX)  NULL,
        LoggedAt       DATETIME2      NOT NULL DEFAULT GETDATE(),
        CreatedAt      DATETIME2      NOT NULL DEFAULT GETDATE()
      )
    END
  `);
};

// ── POST /api/v1/part-process/quality-log ─────────────────────────────────────
export const createQualityLog = async (req, res) => {
  try {
    await ensureQualityLogTable();
    const {
      shift, eventDate, model, partName, sapCode,
      inspectedQty, rejectedQty, defectCode, defectName,
      severity, disposition, inspector, remarks, loggedAt,
    } = req.body;

    const result = await global.pool3.request()
      .input("shiftName",    shift        || null)
      .input("eventDate",    eventDate    || null)
      .input("model",        model        || null)
      .input("partName",     partName     || null)
      .input("sapCode",      sapCode      || null)
      .input("inspectedQty", parseInt(inspectedQty, 10) || 0)
      .input("rejectedQty",  parseInt(rejectedQty,  10) || 0)
      .input("defectCode",   defectCode   || null)
      .input("defectName",   defectName   || null)
      .input("severity",     severity     || null)
      .input("disposition",  disposition  || null)
      .input("inspector",    inspector    || null)
      .input("remarks",      remarks      || null)
      .input("loggedAt",     loggedAt     || new Date().toISOString())
      .query(`
        INSERT INTO PartProcessQualityLog
          (ShiftName, EventDate, Model, PartName, SapCode,
           InspectedQty, RejectedQty, DefectCode, DefectName,
           Severity, Disposition, Inspector, Remarks, LoggedAt)
        OUTPUT INSERTED.Id
        VALUES
          (@shiftName, @eventDate, @model, @partName, @sapCode,
           @inspectedQty, @rejectedQty, @defectCode, @defectName,
           @severity, @disposition, @inspector, @remarks, @loggedAt)
      `);

    res.json({ success: true, data: { id: result.recordset[0].Id } });
  } catch (err) {
    console.error("[PartProcess] createQualityLog:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/v1/part-process/quality-log ─────────────────────────────────────
export const getQualityLogs = async (req, res) => {
  try {
    await ensureQualityLogTable();
    const { startDate, endDate, shift } = req.query;

    const result = await global.pool3.request()
      .input("startDate", startDate || null)
      .input("endDate",   endDate   || null)
      .input("shift",     shift     || null)
      .query(`
        SELECT Id, ShiftName, EventDate, Model, PartName, SapCode,
               InspectedQty, RejectedQty, DefectCode, DefectName,
               Severity, Disposition, Inspector, Remarks, LoggedAt, CreatedAt
        FROM PartProcessQualityLog
        WHERE (@startDate IS NULL OR EventDate >= @startDate)
          AND (@endDate   IS NULL OR EventDate <= @endDate)
          AND (@shift     IS NULL OR ShiftName = @shift)
        ORDER BY LoggedAt DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getQualityLogs:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/v1/part-process/quality-log/:id ───────────────────────────────
export const deleteQualityLog = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request()
      .input("id", parseInt(id, 10))
      .query("DELETE FROM PartProcessQualityLog WHERE Id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error("[PartProcess] deleteQualityLog:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
