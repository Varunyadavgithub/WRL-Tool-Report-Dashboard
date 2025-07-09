import express from "express";
import { getDashboardStats } from "../../controllers/visitor/dashboard.js";

const router = express.Router();

router.get("/dashboard-stats", getDashboardStats);

export default router;
