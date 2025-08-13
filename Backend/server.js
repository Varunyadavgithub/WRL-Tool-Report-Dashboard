import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { connectToDB, dbConfig1, dbConfig2, dbConfig3 } from "./config/db.js";
import cookieParser from "cookie-parser";
// const _dirname = path.resolve();

// <------------------------------------------------------------- All API Routes ------------------------------------------------------------->
import authRoutes from "./routes/auth.route.js";
import sharedRoutes from "./routes/shared.route.js";

// <----- Production Routes ----->
import ProductionReportRoutes from "./routes/production/ProductionReport.js";
import componentTraceabilityReportRoutes from "./routes/production/componentTraceabilityReport.js";
import hourlyReportRoutes from "./routes/production/hourlyReport.js";
import lineHourlyReportRoutes from "./routes/production/lineHourlyReport.js";
import stageHistoryReportRoutes from "./routes/production/stageHistoryReport.js";
import modelNameUpdateRoutes from "./routes/production/modelNameUpdate.js";
import componentDetailsRoutes from "./routes/production/componentDetails.js";
import totalProductionRoutes from "./routes/production/totalProduction.js";

import qualityRoutes from "./routes/quality.route.js";
import dispatchRoute from "./routes/dispatch.route.js";
import productionPlaningRoutes from "./routes/planing.route.js";
import reminderTasksRoutes from "./routes/task.route.js";
import visitorRoutes from "./routes/visitor.route.js";

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

// <------------------------------------------------------------- APIs ------------------------------------------------------------->
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/shared", sharedRoutes);

// Production API
app.use("/api/v1/prod", ProductionReportRoutes);
app.use("/api/v1/prod", componentTraceabilityReportRoutes);
app.use("/api/v1/prod", hourlyReportRoutes);
app.use("/api/v1/prod", lineHourlyReportRoutes);
app.use("/api/v1/prod", stageHistoryReportRoutes);
app.use("/api/v1/prod", modelNameUpdateRoutes);
app.use("/api/v1/prod", componentDetailsRoutes);
app.use("/api/v1/prod", totalProductionRoutes);

app.use("/api/v1/quality", qualityRoutes);
app.use("/api/v1/dispatch", dispatchRoute);
app.use("/api/v1/planing", productionPlaningRoutes);
app.use("/api/v1/reminder", reminderTasksRoutes);
app.use("/api/v1/visitor", visitorRoutes);

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