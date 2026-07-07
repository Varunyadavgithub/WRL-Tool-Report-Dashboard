import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  createManpowerRequest,
  getManpowerRequests,
  approveManpowerRequest,
  rejectManpowerRequest,
  getSecurityList,
  getDepartments,
  emailApprovalHandler,
} from "../controllers/forms/manpower.controller.js";
import { getAttendanceReport } from "../controllers/production/attendance.controller.js";
import { applyLeave, getMyLeaves, getAllLeaves, approveLeave, rejectLeave, cancelLeave, generateAutoCO } from "../controllers/production/leave.controller.js";

const router = express.Router();

router.post("/create", authenticate, createManpowerRequest);
router.get("/list", authenticate, getManpowerRequests);
router.post("/approve", authenticate, approveManpowerRequest);
router.post("/reject", authenticate, rejectManpowerRequest);
router.get("/security-list", authenticate, getSecurityList);
router.get("/departments", authenticate, getDepartments);
// Public by design — hit directly from a link in an approval-notification email, no browser session exists.
router.get("/email-action/:code/:role/:action", emailApprovalHandler);
router.get("/attendance", authenticate, getAttendanceReport);

// Leave management
router.post("/leave/apply",        authenticate, applyLeave);
router.get("/leave/my",            authenticate, getMyLeaves);
router.get("/leave/all",           authenticate, getAllLeaves);
router.put("/leave/:id/approve",   authenticate, approveLeave);
router.put("/leave/:id/reject",    authenticate, rejectLeave);
router.put("/leave/:id/cancel",    authenticate, cancelLeave);
router.post("/leave/auto-co",      authenticate, generateAutoCO);

export default router;
