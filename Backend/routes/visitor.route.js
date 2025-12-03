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
} from "../controllers/visitor/manageEmployee.controller.js";
import {
  getEmployee,
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
import { visitors } from "../controllers/visitor/visitors.controller.js";
import { getDashboardStats } from "../controllers/visitor/dashboard.controller.js";
import {
  getAllVisitors,
  getVisitorDetails,
} from "../controllers/visitor/history.controller.js";

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

// -----------------> Visitor Reports Routes
router.get("/repot", fetchVisitors);
router.post("/send-report", sendVisitorReport);
router.get("/visitors", visitors);
// -----------------> Visitor Dashboard Routes
router.get("/dashboard-stats", getDashboardStats);
// -----------------> Visitor History Routes
router.get("/history", getAllVisitors);
router.get("/details/:visitorId", getVisitorDetails);

export default router;
