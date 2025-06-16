import express from "express";
import { getLptReport } from "../../controllers/quality/lptReport.js";

const router = express.Router();

router.get("/lpt-report", getLptReport);

export default router;
