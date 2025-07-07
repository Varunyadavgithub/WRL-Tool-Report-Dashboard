import express from "express";
import { fetchVisitors } from "../../controllers/visitor/reports.js";

const router = express.Router();

// Visitors
router.get("/repot", fetchVisitors);

export default router;
