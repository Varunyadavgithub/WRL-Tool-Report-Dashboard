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
import { getDashboardStats } from "../controllers/visitor/dashboard.js";

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

// -----------------> Visitor In Out Routes
router.post("/in", visitorIn);
router.post("/out", visitorOut);
router.get("/logs", getVisitorLogs);

// -----------------> Visitor Reports Routes
router.get("/repot", fetchVisitors);
router.post("/send-report", sendVisitorReport);

// -----------------> Visitor Dashboard Routes
router.get("/dashboard-stats", getDashboardStats);

export default router;
