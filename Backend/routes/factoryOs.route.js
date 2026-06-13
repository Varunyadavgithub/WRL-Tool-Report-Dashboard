import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getDailySummary,
  getStatus,
  forceAuth,
} from "../controllers/factoryOs.controller.js";

const router = Router();

// All routes require the user to be logged in to the WRL Dashboard
router.get("/daily-summary", authenticate, getDailySummary);
router.get("/status",        authenticate, getStatus);
router.post("/auth",         authenticate, forceAuth);

export default router;
