import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";
import { tryCatch } from "../utils/tryCatch.js";
import { AppError } from "../utils/AppError.js";

/* =========================================================
   GET LOGGED-IN USER PERMISSIONS
========================================================= */
export const getMyPermissions = tryCatch(async (req, res) => {
  const role = req.user?.roleName.toLowerCase();

  if (!role) throw new AppError("Role not found", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    const result = await pool.request().input("role", sql.VarChar, role).query(`
        SELECT SectionKey, Path, CanAccess
        FROM RolePermissions
        WHERE RoleName = @role
      `);

    res.json({
      success: true,
      role,
      permissions: result.recordset,
    });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET PERMISSIONS FOR A SPECIFIC ROLE
========================================================= */
export const getRolePermissions = tryCatch(async (req, res) => {
  const { role } = req.params;

  if (!role) throw new AppError("Role parameter is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    const result = await pool
      .request()
      .input("role", sql.VarChar, role.toLowerCase()).query(`
        SELECT SectionKey, Path, CanAccess
        FROM RolePermissions
        WHERE RoleName = @role
      `);

    // Convert to the format expected by frontend: { [sectionKey]: { [path]: boolean } }
    const permissionMap = {};
    result.recordset.forEach((p) => {
      if (!permissionMap[p.SectionKey]) {
        permissionMap[p.SectionKey] = {};
      }
      permissionMap[p.SectionKey][p.Path] = p.CanAccess;
    });

    res.json({
      success: true,
      data: permissionMap,
    });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS (PUT /:role)
========================================================= */
export const updateRolePermissionsByRole = tryCatch(async (req, res) => {
  const { role } = req.params;
  const permissions = req.body;

  if (!role) throw new AppError("Role parameter is required", 400);
  if (!permissions || typeof permissions !== "object") {
    throw new AppError("Permissions object is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    // delete old permissions
    await pool.request().input("role", sql.VarChar, role.toLowerCase()).query(`
        DELETE FROM RolePermissions
        WHERE RoleName = @role
      `);

    // insert new permissions
    for (const sectionKey in permissions) {
      const section = permissions[sectionKey];
      for (const path in section) {
        const canAccess = section[path];
        await pool
          .request()
          .input("role", sql.VarChar, role.toLowerCase())
          .input("section", sql.VarChar, sectionKey)
          .input("path", sql.VarChar, path)
          .input("access", sql.Bit, canAccess ? 1 : 0).query(`
            INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess)
            VALUES (@role, @section, @path, @access)
          `);
      }
    }

    res.json({
      success: true,
      message: "Permissions updated successfully",
    });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS (POST /admin/update)
========================================================= */
export const updateRolePermissions = tryCatch(async (req, res) => {
  const { role, permissions } = req.body;

  if (!role) throw new AppError("Role is required", 400);
  if (!Array.isArray(permissions)) {
    throw new AppError("Permissions must be an array", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    // delete old permissions
    await pool.request().input("role", sql.VarChar, role).query(`
        DELETE FROM RolePermissions
        WHERE RoleName = @role
      `);

    // insert new permissions
    for (const p of permissions) {
      await pool
        .request()
        .input("role", sql.VarChar, role)
        .input("section", sql.VarChar, p.sectionKey)
        .input("path", sql.VarChar, p.path)
        .input("access", sql.Bit, p.canAccess ? 1 : 0).query(`
          INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess)
          VALUES (@role, @section, @path, @access)
        `);
    }

    res.json({
      success: true,
      message: "Permissions updated successfully",
    });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET ALL ROLES
========================================================= */
export const getAllRoles = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(`
        SELECT RoleCode, RoleName
        FROM UserRoles
        ORDER BY RoleName
      `);

    res.json({
      success: true,
      roles: result.recordset,
    });
  } finally {
    await pool.close();
  }
});
