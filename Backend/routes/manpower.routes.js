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

const router = express.Router();

router.post("/create", createManpowerRequest);
router.get("/list", getManpowerRequests);
router.post("/approve", approveManpowerRequest);
router.post("/reject", rejectManpowerRequest);
router.get("/security-list", getSecurityList);
router.get("/departments", getDepartments);
router.get("/email-action/:code/:role/:action", emailApprovalHandler);

export default router;
