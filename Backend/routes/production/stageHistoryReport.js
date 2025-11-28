import express from "express";
import {
  getCurrentStageStatus,
  getLogisticStatus,
} from "../../controllers/production/stageHistoryReport.js";

const router = express.Router();

router.get("/stage-history", getCurrentStageStatus);
router.get("/logistic-status", getLogisticStatus);

export default router;
