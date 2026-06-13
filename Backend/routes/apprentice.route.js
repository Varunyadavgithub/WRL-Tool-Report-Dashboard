import express from "express";
import {
  uploadSalaryData, getSlips, getSlipById,
  publishSlip, publishAll, deleteSlips,
  emailSlip, emailAll,
  getDashboard, getHistory,
} from "../controllers/apprentice/salary.controller.js";

const router = express.Router();

router.post  ("/upload",             uploadSalaryData);
router.get   ("/slips",              getSlips);
router.get   ("/slips/:id",          getSlipById);
router.put   ("/slips/:id/publish",  publishSlip);
router.put   ("/slips/publish-all",  publishAll);
router.post  ("/slips/:id/email",    emailSlip);
router.post  ("/email-all",          emailAll);
router.delete("/slips",              deleteSlips);
router.get   ("/dashboard",          getDashboard);
router.get   ("/history",            getHistory);

export default router;
