import express from "express";
import { getCurrentStageStatus } from "../../controllers/production/stageHistoryReport.js";

const router = express.Router();

router.get("/stage-history", getCurrentStageStatus);

export default router;