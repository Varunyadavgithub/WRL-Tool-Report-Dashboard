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
} from "./config/db.config.js";
import { startCalibrationCron } from "./cron/calibrationEscalation.js";
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
    console.log("Successfully connected to all databases.");
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
