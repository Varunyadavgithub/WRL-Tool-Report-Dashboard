import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import cookieParser from "cookie-parser";
import { startCalibrationCron } from "./cron/calibrationEscalation.js";

import routes from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api/v1/", routes);

// Log DB details for verification
import { dbConfig1, dbConfig2, dbConfig3 } from "./config/db.js";
console.log("\n========= DATABASE CONFIG LOADED =========");
console.log("DB1:", dbConfig1.database);
console.log("DB2:", dbConfig2.database);
console.log("DB3:", dbConfig3.database, "<< Calibration DB");
console.log("==========================================\n");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

// ✅ START CRON AFTER SERVER START
startCalibrationCron();
