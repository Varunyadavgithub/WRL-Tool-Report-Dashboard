import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import {
  connectToDB,
  dbConfig1,
  dbConfig2,
  dbConfig3,
  dbConfig4,
} from "./config/db.config.js";
import { startCalibrationCron } from "./cron/calibrationEscalation.js";
import { startManpowerCron } from "../Backend/cron/manpower.cron.js";
import { startShiftEndReportCron } from "./cron/shiftEndReport.cron.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import { runMigrations } from "./config/migrations.js";
import { runGarudaMigrations } from "./config/garudaMigrations.js";
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
    global.pool3 = await connectToDB(dbConfig3);
    console.log("Successfully connected to Server 1 and Server 3.");

    await runGarudaMigrations(global.pool1);
    await runMigrations(global.pool3);

    // Server 2 (WWMS) and Server 4 (CLMS) are remote-only with no local backup —
    // skip them instead of crashing the app when offline.
    try {
      global.pool2 = await connectToDB(dbConfig2);
      console.log("Successfully connected to Server 2.");
    } catch (error) {
      console.warn("Server 2 (WWMS) unreachable, skipping:", error.message);
    }
    try {
      global.pool4 = await connectToDB(dbConfig4);
      console.log("Successfully connected to Server 4.");
    } catch (error) {
      console.warn("Server 4 (CLMS) unreachable, skipping:", error.message);
    }
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
startShiftEndReportCron();
