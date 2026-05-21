import express from "express";
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

router.post("/create", createManpowerRequest);
router.get("/list", getManpowerRequests);
router.post("/approve", approveManpowerRequest);
router.post("/reject", rejectManpowerRequest);
router.get("/security-list", getSecurityList);
router.get("/departments", getDepartments);
router.get("/email-action/:code/:role/:action", emailApprovalHandler);
router.get("/attendance", getAttendanceReport);

// Leave management
router.post("/leave/apply",        applyLeave);
router.get("/leave/my",            getMyLeaves);
router.get("/leave/all",           getAllLeaves);
router.put("/leave/:id/approve",   approveLeave);
router.put("/leave/:id/reject",    rejectLeave);
router.put("/leave/:id/cancel",    cancelLeave);
router.post("/leave/auto-co",      generateAutoCO);

export default router;
