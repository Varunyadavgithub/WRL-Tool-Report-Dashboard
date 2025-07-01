import express from "express";
import {
  addDailyPlans,
  fetchDailyPlans,
} from "../../controllers/planing/dailyPlan.js";

const router = express.Router();

router.post("/upload-daily-plan", addDailyPlans);
router.get("/daily-plans", fetchDailyPlans);

export default router;
