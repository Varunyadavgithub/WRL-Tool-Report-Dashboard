import { AppError } from "../utils/AppError.js";

/**
 * Middleware to restrict access to Super Admin only
 */
export const requireSuperAdmin = (req, res, next) => {
  const userRole = req.user?.role;

  if (!userRole || userRole !== "super admin") {
    throw new AppError("Access denied. Super Admin only.", 403);
  }

  next();
};

/**
 * Middleware to restrict access to specific roles
 * @param {Array<string>} allowedRoles - Array of role names (lowercase)
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.toLowerCase();

    if (!userRole) {
      throw new AppError("Role not found", 400);
    }

    if (!allowedRoles.includes(userRole)) {
      throw new AppError("Access denied. Insufficient permissions.", 403);
    }

    next();
  };
};
