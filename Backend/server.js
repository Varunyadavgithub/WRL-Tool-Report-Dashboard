import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { connectToDB, dbConfig1, dbConfig2, dbConfig3 } from "./config/db.js";
import cookieParser from "cookie-parser";
// const _dirname = path.resolve();

// <------------------------------------------------------------- All API Routes ------------------------------------------------------------->
// <----- Auth Routes ----->
import authRoutes from "./routes/auth.js";
// <----- Shared Routes ----->
import sharedRoutes from "./routes/sharedRoutes.js";

// <----- Production Routes ----->
import ProductionReportRoutes from "./routes/production/ProductionReport.js";
import componentTraceabilityReportRoutes from "./routes/production/componentTraceabilityReport.js";
import hourlyReportRoutes from "./routes/production/hourlyReport.js";
import lineHourlyReportRoutes from "./routes/production/lineHourlyReport.js";
// import consolidatedReportRoutes from "./routes/consolidatedReport.js";
// import stopLossReportRoutes from "./routes/stopLossReport.js";
import stageHistoryReportRoutes from "./routes/production/stageHistoryReport.js";
import modelNameUpdateRoutes from "./routes/production/modelNameUpdate.js";
import componentDetailsRoutes from "./routes/production/componentDetails.js";
import totalProductionRoutes from "./routes/production/totalProduction.js";

// <----- Quality Routes ----->
import fpaRoutes from "./routes/quality/fpa.js";
import fpaReportRoutes from "./routes/quality/fpaReport.js";
import dispatchHoldRoutes from "./routes/quality/dispatchHold.js";
import holdCabinetDetailsRoutes from "./routes/quality/holdCabinetDetails.js";
import tagUpdateRoutes from "./routes/quality/tagUpdate.js";
import lptRoutes from "./routes/quality/lpt.js";
import lptReportRoutes from "./routes/quality/lptReport.js";
import lptRecipeRoutes from "./routes/quality/lptRecipe.js";
import UploadBISReportRoutes from "./routes/quality/UploadBISReport.js";

// <----- Dispatch Routes ----->
import dispatchPerformanceReportRoute from "./routes/dispatch/performanceReport.js";
import dispatchReportRoute from "./routes/dispatch/dispatchReport.js";
import fgCastingRoute from "./routes/dispatch/fgCasting.js";
import errorLogRoute from "./routes/dispatch/errorLog.js";

// <----- Planing Routes ----->
import productionPlaningRoutes from "./routes/planing/productionPlaning.js";
import fiveDaysPlaningRoutes from "./routes/planing/fiveDaysPlaning.js";
import dailyPlaningRoute from "./routes/planing/dailyPlan.js";

// <----- Reminder Routes ----->
import reminderTasksRoutes from "./routes/reminder/task.js";

// <----- Visitor Routes ----->
import visitorPassRoutes from "./routes/visitor/visitorPass.js";

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve("uploads"))); // Static files

// <------------------------------------------------------------- Connect to DB Servers ------------------------------------------------------------->
(async () => {
  try {
    global.pool1 = await connectToDB(dbConfig1);
    global.pool2 = await connectToDB(dbConfig2);
    global.pool3 = await connectToDB(dbConfig3);
  } catch (error) {}
})();

// <------------------------------------------------------------- Test API ------------------------------------------------------------->
// app.get("/", (_, res) => {
//   res.status(200).json({ message: "Backend is working correctly!" });
// });

// <------------------------------------------------------------- APIs ------------------------------------------------------------->
// Auth API
app.use("/api/v1/auth", authRoutes);
// Shared API
app.use("/api/v1/shared", sharedRoutes);

// Production API
app.use("/api/v1/prod", ProductionReportRoutes);
app.use("/api/v1/prod", componentTraceabilityReportRoutes);
app.use("/api/v1/prod", hourlyReportRoutes);
app.use("/api/v1/prod", lineHourlyReportRoutes);
// app.use("/api/v1/prod", consolidatedReportRoutes);
// app.use("/api/v1/prod", stopLossReportRoutes);
app.use("/api/v1/prod", stageHistoryReportRoutes);
app.use("/api/v1/prod", modelNameUpdateRoutes);
app.use("/api/v1/prod", componentDetailsRoutes);
app.use("/api/v1/prod", totalProductionRoutes);

// Quality API
app.use("/api/v1/quality", fpaRoutes);
app.use("/api/v1/quality", fpaReportRoutes);
app.use("/api/v1/quality", dispatchHoldRoutes);
app.use("/api/v1/quality", holdCabinetDetailsRoutes);
app.use("/api/v1/quality", tagUpdateRoutes);
app.use("/api/v1/quality", lptRoutes);
app.use("/api/v1/quality", lptReportRoutes);
app.use("/api/v1/quality", lptRecipeRoutes);
app.use("/api/v1/quality", UploadBISReportRoutes);

// Dispatch API
app.use("/api/v1/dispatch", dispatchPerformanceReportRoute);
app.use("/api/v1/dispatch", dispatchReportRoute);
app.use("/api/v1/dispatch", fgCastingRoute);
app.use("/api/v1/dispatch", errorLogRoute);

// Planing API
app.use("/api/v1/planing", productionPlaningRoutes);
app.use("/api/v1/planing", fiveDaysPlaningRoutes);
app.use("/api/v1/planing", dailyPlaningRoute);

// Reminder API
app.use("/api/v1/reminder", reminderTasksRoutes);

// Visitor API
app.use("/api/v1/visitor", visitorPassRoutes);

// <------------------------------------------------------------- Serve Frontend from Backend ------------------------------------------------------------->
// app.use(express.static(path.join(_dirname, "Frontend", "dist")));
// Wildcard route to serve index.html ONLY if path does not start with /api
// app.get(/^\/(?!api\/).*/, (_, res) => {
//   res.sendFile(path.join(_dirname, "Frontend", "dist", "index.html"));
// });

// <------------------------------------------------------------- Start server ------------------------------------------------------------->
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port:${PORT}`);
});
