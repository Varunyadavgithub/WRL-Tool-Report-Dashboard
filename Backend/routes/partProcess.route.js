import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { getRecords, getSyncStatus, triggerSync } from "../controllers/partProcess.controller.js";

const router = Router();

router.get("/records",     authenticate, getRecords);
router.get("/sync-status", authenticate, getSyncStatus);
router.post("/sync",       authenticate, triggerSync);

export default router;
