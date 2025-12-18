import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { connectToDB, dbConfig1, dbConfig2, dbConfig3 } from "./config/db.js";
import cookieParser from "cookie-parser";
// const _dirname = path.resolve();

// <------------------------------------------------------------- All API Routes ------------------------------------------------------------->
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
app.use("/api/v1/", routes);

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
