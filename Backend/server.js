import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import {
  connectToDB,
  dbConfig1,
  dbConfig2,
  dbConfig3,
  //dbConfig4,
} from "./config/db.config.js";
import { startCalibrationCron } from "./cron/calibrationEscalation.js";
import { startManpowerCron } from "../Backend/cron/manpower.cron.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
// const _dirname = path.resolve();

const app = express();

// <------------------------------------------------------------- Middlewares ------------------------------------------------------------->
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve("uploads"))); // Static files

// <------------------------------------------------------------- Connect to DB Servers ------------------------------------------------------------->
(async () => {
  try {
    global.pool1 = await connectToDB(dbConfig1);
    global.pool2 = await connectToDB(dbConfig2);
    global.pool3 = await connectToDB(dbConfig3);
    //global.pool3 = await connectToDB(dbConfig4);
    console.log("Successfully connected to all databases.");

    // ── Schema migrations (idempotent) ──────────────────────────────────────
    await global.pool3.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = 'Models'
      )
      BEGIN
        ALTER TABLE AuditTemplates ADD Models NVARCHAR(MAX) NULL;
        PRINT 'Migration: Added Models column to AuditTemplates';
      END
    `);

    await global.pool3.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Audits' AND COLUMN_NAME = 'StartedAt'
      )
      BEGIN
        ALTER TABLE Audits ADD StartedAt DATETIME NULL;
        PRINT 'Migration: Added StartedAt column to Audits';
      END
    `);

    await global.pool3.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'AuditTemplateHistory'
      )
      BEGIN
        CREATE TABLE AuditTemplateHistory (
          Id          INT IDENTITY(1,1) PRIMARY KEY,
          TemplateId  INT           NOT NULL,
          Action      NVARCHAR(50)  NOT NULL,
          ActionBy    NVARCHAR(100) NULL,
          ActionAt    DATETIME      NOT NULL DEFAULT GETDATE(),
          Comments    NVARCHAR(MAX) NULL,
          PreviousStatus NVARCHAR(50) NULL,
          NewStatus      NVARCHAR(50) NULL,
          FieldChanges   NVARCHAR(MAX) NULL
        );
        PRINT 'Migration: Created AuditTemplateHistory table';
      END
    `);

  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
})();

// <------------------------------------------------------------- APIs ------------------------------------------------------------->
app.use("/api/v1/", routes);

// <------------------------------------------------------------- Global Error Handler ------------------------------------------------------------->
app.use(globalErrorHandler);

// <------------------------------------------------------------- Serve Frontend from Backend ------------------------------------------------------------->
// app.use(express.static(path.join(_dirname, "Frontend", "dist")));
// Wildcard route to serve index.html ONLY if path does not start with /api
// app.get(/^\/(?!api\/).*/, (_, res) => {
//   res.sendFile(path.join(_dirname, "Frontend", "dist", "index.html"));
// });

// <------------------------------------------------------------- Start server ------------------------------------------------------------->
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port:${PORT}`);
});

// START CRON AFTER SERVER START
startCalibrationCron();
startManpowerCron();
