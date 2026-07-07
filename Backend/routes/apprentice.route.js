import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  uploadSalaryData, getSlips, getSlipById,
  publishSlip, publishAll, deleteSlips,
  emailSlip, emailAll,
  getDashboard, getHistory,
} from "../controllers/apprentice/salary.controller.js";

const router = express.Router();

router.post  ("/upload",             authenticate, uploadSalaryData);
router.get   ("/slips",              authenticate, getSlips);
router.get   ("/slips/:id",          authenticate, getSlipById);
router.put   ("/slips/:id/publish",  authenticate, publishSlip);
router.put   ("/slips/publish-all",  authenticate, publishAll);
router.post  ("/slips/:id/email",    authenticate, emailSlip);
router.post  ("/email-all",          authenticate, emailAll);
router.delete("/slips",              authenticate, deleteSlips);
router.get   ("/dashboard",          authenticate, getDashboard);
router.get   ("/history",            authenticate, getHistory);

export default router;
