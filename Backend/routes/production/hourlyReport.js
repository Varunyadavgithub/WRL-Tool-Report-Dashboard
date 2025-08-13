import express from "express";
import {
  getHourlyCategoryCount,
  getHourlyModelCount,
  getHourlySummary,
} from "../../controllers/production/hourlyReport.js";

const router = express.Router();

router.get("/hourly-summary", getHourlySummary);
router.get("/hourly-model-count", getHourlyModelCount);
router.get("/hourly-category-count", getHourlyCategoryCount);

export default router;