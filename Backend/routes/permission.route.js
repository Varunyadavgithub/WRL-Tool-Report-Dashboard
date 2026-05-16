import express from "express";
import {
  getMyPermissions,
  getRolePermissions,
  updateRolePermissions,
  updateRolePermissionsByRole,
  getAllRoles,
} from "../controllers/permission.controller.js";

import { authenticate } from "../middlewares/auth.js";
import { requireSuperAdmin } from "../middlewares/roleGuard.js";

const router = express.Router();

// Get logged-in user's permissions
router.get("/me", authenticate, getMyPermissions);

// Get permissions for a specific role (Super Admin only)
router.get("/:role", authenticate, requireSuperAdmin, getRolePermissions);

// Update permissions for a specific role (Super Admin only) - PUT method
router.put("/:role", authenticate, requireSuperAdmin, updateRolePermissionsByRole);

// Update role permissions (Super Admin only) - POST method for backward compatibility
router.post("/admin/update", authenticate, requireSuperAdmin, updateRolePermissions);

// Get all roles (Super Admin only)
router.get("/admin/roles", authenticate, requireSuperAdmin, getAllRoles);

export default router;
