import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getRecords, getRecordsRange, getSyncLog,
  createDowntimeLog, getDowntimeLogs, deleteDowntimeLog,
  createQualityLog, getQualityLogs, deleteQualityLog,
} from "../controllers/partProcess.controller.js";

const router = Router();

router.get("/records",       authenticate, getRecords);
router.get("/records-range", authenticate, getRecordsRange);
router.get("/sync-log",      authenticate, getSyncLog);

router.post("/downtime-log",       authenticate, createDowntimeLog);
router.get("/downtime-log",        authenticate, getDowntimeLogs);
router.delete("/downtime-log/:id", authenticate, deleteDowntimeLog);

router.post("/quality-log",        authenticate, createQualityLog);
router.get("/quality-log",         authenticate, getQualityLogs);
router.delete("/quality-log/:id",  authenticate, deleteQualityLog);

export default router;
