import express from "express";
import {
  getDehumidifierStatus,
  getDehumidifierTrend,
  getDehumidifierSummary,
} from "../controllers/reading/dehumidifier.controller.js";

const router = express.Router();

// ==================== Routes ====================

// live table
router.get("/", getDehumidifierStatus);

// graph data  ← ADD THIS
router.get("/machine-reading", getDehumidifierTrend);

router.get("/machine-summary", getDehumidifierSummary);

export default router;
