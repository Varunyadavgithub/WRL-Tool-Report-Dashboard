/** PartProcess Downtime Log — manual changeover/downtime entries (pool3 / PartProcessDowntimeLog). */

// ── PartProcessDowntimeLog table helpers ─────────────────────────────────────

const ensureDowntimeLogTable = async () => {
  await global.pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'PartProcessDowntimeLog'
    )
    BEGIN
      CREATE TABLE PartProcessDowntimeLog (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        SrNo         NVARCHAR(20)   NULL,
        EventId      NVARCHAR(50)   NULL,
        ShiftName    NVARCHAR(50)   NULL,
        EventDate    DATE           NULL,
        StartTime    NVARCHAR(20)   NULL,
        EndTime      NVARCHAR(20)   NULL,
        Duration     NVARCHAR(20)   NULL,
        Model        NVARCHAR(255)  NULL,
        FromModel    NVARCHAR(255)  NULL,
        IsChangeover BIT            NOT NULL DEFAULT 0,
        ReasonCode   NVARCHAR(50)   NULL,
        ReasonName   NVARCHAR(255)  NULL,
        Category     NVARCHAR(100)  NULL,
        Planned      BIT            NOT NULL DEFAULT 0,
        Remarks      NVARCHAR(MAX)  NULL,
        LoggedAt     DATETIME2      NOT NULL DEFAULT GETDATE(),
        CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
      )
    END;
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PartProcessDowntimeLog' AND COLUMN_NAME = 'EventId'
    )
    BEGIN
      ALTER TABLE PartProcessDowntimeLog ADD EventId NVARCHAR(50) NULL
    END
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PartProcessDowntimeLog'
        AND COLUMN_NAME = 'EventId'
        AND DATA_TYPE IN ('int', 'bigint', 'smallint')
    )
    BEGIN
      ALTER TABLE PartProcessDowntimeLog ALTER COLUMN EventId NVARCHAR(50) NULL
    END
  `);
};

// ── POST /api/v1/part-process/downtime-log ────────────────────────────────────
export const createDowntimeLog = async (req, res) => {
  try {
    await ensureDowntimeLogTable();
    const {
      srNo, eventId, shift, eventDate, startTime, endTime, duration,
      model, fromModel, isChangeover, reasonCode, reasonName,
      category, planned, remarks, loggedAt,
    } = req.body;

    const result = await global.pool3.request()
      .input("srNo",         srNo                              || null)
      .input("eventId",      eventId != null ? String(eventId) : null)
      .input("shiftName",    shift                             || null)
      .input("eventDate",    eventDate                         || null)
      .input("startTime",    startTime                         || null)
      .input("endTime",      endTime                           || null)
      .input("duration",     duration                          || null)
      .input("model",        model                             || null)
      .input("fromModel",    fromModel                         || null)
      .input("isChangeover", isChangeover ? 1 : 0)
      .input("reasonCode",   reasonCode   || null)
      .input("reasonName",   reasonName   || null)
      .input("category",     category     || null)
      .input("planned",      planned      ? 1 : 0)
      .input("remarks",      remarks      || null)
      .input("loggedAt",     loggedAt     || new Date().toISOString())
      .query(`
        INSERT INTO PartProcessDowntimeLog
          (SrNo, EventId, ShiftName, EventDate, StartTime, EndTime, Duration,
           Model, FromModel, IsChangeover, ReasonCode, ReasonName,
           Category, Planned, Remarks, LoggedAt)
        OUTPUT INSERTED.Id
        VALUES
          (@srNo, @eventId, @shiftName, @eventDate, @startTime, @endTime, @duration,
           @model, @fromModel, @isChangeover, @reasonCode, @reasonName,
           @category, @planned, @remarks, @loggedAt)
      `);

    res.json({ success: true, data: { id: result.recordset[0].Id } });
  } catch (err) {
    console.error("[PartProcess] createDowntimeLog:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/v1/part-process/downtime-log ────────────────────────────────────
export const getDowntimeLogs = async (req, res) => {
  try {
    await ensureDowntimeLogTable();
    const { startDate, endDate, shift } = req.query;

    const result = await global.pool3.request()
      .input("startDate", startDate || null)
      .input("endDate",   endDate   || null)
      .input("shift",     shift     || null)
      .query(`
        SELECT l.Id, l.SrNo, l.EventId, l.ShiftName,
               COALESCE(l.EventDate, e.EventDate, CAST(l.LoggedAt AS DATE)) AS EventDate,
               l.StartTime, l.EndTime, l.Duration, l.Model, l.FromModel,
               l.IsChangeover, l.ReasonCode, l.ReasonName, l.Category,
               l.Planned, l.Remarks, l.LoggedAt, l.CreatedAt
        FROM PartProcessDowntimeLog l
        -- Source event IDs may be alphanumeric (for example D1771521929),
        -- while older downtime-log rows store a numeric EventId. Compare as
        -- text so a non-numeric source ID cannot fail the entire log query.
        LEFT JOIN PartProcessEvents e
          ON CONVERT(NVARCHAR(50), e.EventId) = CONVERT(NVARCHAR(50), l.EventId)
        WHERE (@startDate IS NULL OR COALESCE(l.EventDate, e.EventDate, CAST(l.LoggedAt AS DATE)) >= @startDate)
          AND (@endDate   IS NULL OR COALESCE(l.EventDate, e.EventDate, CAST(l.LoggedAt AS DATE)) <= @endDate)
          AND (@shift     IS NULL OR l.ShiftName = @shift)
        ORDER BY l.LoggedAt DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("[PartProcess] getDowntimeLogs:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/v1/part-process/downtime-log/:id ─────────────────────────────
export const deleteDowntimeLog = async (req, res) => {
  try {
    const { id } = req.params;
    await global.pool3.request()
      .input("id", parseInt(id, 10))
      .query("DELETE FROM PartProcessDowntimeLog WHERE Id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error("[PartProcess] deleteDowntimeLog:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
