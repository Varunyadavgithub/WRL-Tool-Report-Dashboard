import express from "express";
import { addDailyPlans } from "../../controllers/planing/dailyPlan.js";

const router = express.Router();

router.post("/upload-daily-plan", addDailyPlans);

export default router;
