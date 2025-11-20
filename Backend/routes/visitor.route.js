import express from "express";
import {
  fetchDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  fetchUsers,
  addUser,
  updateUser,
  deleteUser,
} from "../controllers/visitor/manageEmployee.js";
import {
  getEmployee,
  generateVisitorPass,
  fetchPreviousPass,
  getVisitorPassDetails,
} from "../controllers/visitor/visitorPass.js";
import {
  visitorIn,
  visitorOut,
  getVisitorLogs,
} from "../controllers/visitor/visitorInOut.js";
import {
  fetchVisitors,
  sendVisitorReport,
} from "../controllers/visitor/reports.js";
import { visitors } from "../controllers/visitor/visitors.js";
import { getDashboardStats } from "../controllers/visitor/dashboard.js";
import { notifyCurrentlyInsideVisitors } from "../controllers/visitor/currentlyInside.js";
import {
  getAllVisitorsHistory,
  getVisitorFullHistory,
} from "../controllers/visitor/visitorHistoryController.js";

const router = express.Router();

// -----------------> Manage Employee Routes
// Departments
router.get("/departments", fetchDepartments);
router.post("/departments", addDepartment);
router.put("/departments/:deptCode", updateDepartment);
router.delete("/departments/:deptCode", deleteDepartment);

// Users
router.get("/users", fetchUsers);
router.post("/users", addUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// -----------------> Visitor Pass Routes
router.get("/employees", getEmployee);
router.post("/generate-pass", generateVisitorPass);
router.get("/fetch-previous-pass", fetchPreviousPass);
router.get("/pass-details/:passId", getVisitorPassDetails);

// -----------------> Visitor In Out Routes
router.post("/in", visitorIn);
router.post("/out", visitorOut);
router.get("/logs", getVisitorLogs);
router.get("/reprint/:passId", getVisitorPassDetails);
router.post("/notify-currently-inside", notifyCurrentlyInsideVisitors);

// -----------------> Visitor Reports Routes
router.get("/repot", fetchVisitors);
router.post("/send-report", sendVisitorReport);
router.get("/visitors", visitors);
// -----------------> Visitor Dashboard Routes
router.get("/dashboard-stats", getDashboardStats);
// -----------------> Visitor History Routes
router.get("/history", getAllVisitorsHistory);
router.get("/details/:visitorId", getVisitorFullHistory);

export default router;
