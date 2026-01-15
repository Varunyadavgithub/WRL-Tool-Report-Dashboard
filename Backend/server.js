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
  dbConfig4,
} from "./config/db.js";
import { startCalibrationCron } from "./cron/calibrationEscalation.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
// const _dirname = path.resolve();

const app = express();

// <------------------------------------------------------------- Middlewares ------------------------------------------------------------->
const allowedOrigins = process.env.CORS_ORIGIN.split(",");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
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
    global.pool4 = await connectToDB(dbConfig4);
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
})();

// <------------------------------------------------------------- APIs ------------------------------------------------------------->
app.use("/api/v1/", routes);

// <------------------------------------------------------------- 404 Handler ------------------------------------------------------------->
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

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
  console.log(`🚀 Server running on port:${PORT}`);
});

// ✅ START CRON AFTER SERVER START
startCalibrationCron();
