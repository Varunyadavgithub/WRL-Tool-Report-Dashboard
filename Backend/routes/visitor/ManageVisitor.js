import express from "express";
import {
  addDepartment,
  addUser,
  deleteDepartment,
  deleteUser,
  fetchDepartments,
  fetchUsers,
  updateDepartment,
  updateUser,
} from "../../controllers/visitor/ManageVisitor.js";

const router = express.Router();

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

export default router;
