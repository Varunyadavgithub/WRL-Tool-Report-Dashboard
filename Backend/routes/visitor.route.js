import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  fetchDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  fetchUsers,
  addUser,
  updateUser,
  deleteUser,
} from "../controllers/visitor/manageEmployee.controller.js";
import {
  generateVisitorPass,
  fetchPreviousPass,
  getVisitorPassDetails,
} from "../controllers/visitor/generatepass.controller.js";
import {
  visitorIn,
  visitorOut,
  getVisitorLogs,
} from "../controllers/visitor/inOut.controller.js";
import {
  fetchVisitors,
  sendVisitorReport,
} from "../controllers/visitor/reports.controller.js";
import { getDashboardStats } from "../controllers/visitor/dashboard.controller.js";
import {
  getAllVisitors,
  getVisitorDetails,
} from "../controllers/visitor/history.controller.js";

const router = express.Router();

// -----------------> Manage Employee Routes
// Departments
router.get("/departments", authenticate, fetchDepartments);
router.post("/departments", authenticate, addDepartment);
router.put("/departments/:deptCode", authenticate, updateDepartment);
router.delete("/departments/:deptCode", authenticate, deleteDepartment);

// Users
router.get("/users", authenticate, fetchUsers);
router.post("/users", authenticate, addUser);
router.put("/users/:id", authenticate, updateUser);
router.delete("/users/:id", authenticate, deleteUser);

// -----------------> Visitor Pass Routes
router.post("/generate-pass", authenticate, generateVisitorPass);
router.get("/fetch-previous-pass", authenticate, fetchPreviousPass);
router.get("/pass-details/:passId", authenticate, getVisitorPassDetails);

// -----------------> Visitor In Out Routes
router.post("/in", authenticate, visitorIn);
router.post("/out", authenticate, visitorOut);
router.get("/logs", authenticate, getVisitorLogs);
router.get("/reprint/:passId", authenticate, getVisitorPassDetails);

// -----------------> Visitor Reports Routes
router.get("/repot", authenticate, fetchVisitors);
router.post("/send-report", authenticate, sendVisitorReport);

// -----------------> Visitor Dashboard Routes
router.get("/dashboard-stats", authenticate, getDashboardStats);

// -----------------> Visitor History Routes
router.get("/history", authenticate, getAllVisitors);
router.get("/details/:visitorId", authenticate, getVisitorDetails);

export default router;
