/**
 * permissionController.js
 *
 * ── BUGS FIXED ────────────────────────────────────────────────────────────────
 *  1. getAllRoles referenced undefined `dbConfig1` (never imported) → ReferenceError
 *     at runtime. Fixed: now uses dbConfig3.
 *  2. req.user?.roleName.toLowerCase() crashes when roleName is undefined.
 *     Fixed: optional chaining → req.user?.roleName?.toLowerCase().
 *  3. delete + insert were NOT wrapped in a transaction. If any INSERT failed
 *     mid-loop the role ended up with ZERO permissions (the DELETE had already
 *     committed). Fixed: applyPermissions() wraps everything in sql.Transaction
 *     with a rollback() on failure.
 *  4. updateRolePermissions (POST /admin/update) validated that permissions was
 *     an Array, but the frontend Redux slice sends an Object. The handler was
 *     effectively broken. Fixed: both update handlers now accept the same
 *     { [sectionKey]: { [path]: boolean } } shape.
 *  5. CanAccess BIT was forwarded as-is; MSSQL driver returns true/false OR 1/0
 *     depending on version. Fixed: Boolean() cast added everywhere.
 *
 * ── NEW ───────────────────────────────────────────────────────────────────────
 *  • copyRolePermissions  POST /admin/copy  { fromRole, toRole }
 *    Uses a single INSERT … SELECT on the DB — zero N+1 round-trips.
 *  • flattenPermissions() helper shared by both update handlers.
 *  • applyPermissions()   transactional helper shared by both update handlers.
 *  • UpdatedBy / UpdatedAt columns tracked on every write.
 *
 * ── RECOMMENDED DB SCHEMA ────────────────────────────────────────────────────
 *
 *  CREATE TABLE RolePermissions (
 *    Id         INT           IDENTITY(1,1) PRIMARY KEY,
 *    RoleName   VARCHAR(100)  NOT NULL,
 *    SectionKey VARCHAR(100)  NOT NULL,
 *    Path       VARCHAR(255)  NOT NULL,
 *    CanAccess  BIT           NOT NULL DEFAULT 0,
 *    UpdatedAt  DATETIME2     NOT NULL DEFAULT GETDATE(),
 *    UpdatedBy  VARCHAR(100)  NULL,
 *    -- Prevents duplicate rows; also makes the DELETE+INSERT idempotent:
 *    CONSTRAINT UQ_RolePermissions UNIQUE (RoleName, SectionKey, Path)
 *  );
 *  -- Query performance for the most common lookup pattern:
 *  CREATE INDEX IX_RolePermissions_Role ON RolePermissions (RoleName);
 *
 *  -- Optional: full audit trail of who changed what and when
 *  CREATE TABLE RolePermissionsAudit (
 *    Id        INT           IDENTITY(1,1) PRIMARY KEY,
 *    RoleName  VARCHAR(100)  NOT NULL,
 *    Action    VARCHAR(20)   NOT NULL,   -- 'UPDATE' | 'COPY' | 'RESET'
 *    ChangedBy VARCHAR(100)  NOT NULL,
 *    ChangedAt DATETIME2     NOT NULL DEFAULT GETDATE()
 *  );
 */

import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";
import { tryCatch }  from "../utils/tryCatch.js";
import { AppError }  from "../utils/AppError.js";

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Flatten { [sectionKey]: { [path]: boolean } }
 * into    [{ sectionKey, path, canAccess }]
 */
const flattenPermissions = (obj) => {
  const rows = [];
  for (const sectionKey of Object.keys(obj)) {
    const section = obj[sectionKey];
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    for (const path of Object.keys(section)) {
      rows.push({ sectionKey, path, canAccess: Boolean(section[path]) });
    }
  }
  return rows;
};

/**
 * Delete all existing permissions for `role` then bulk-insert `rows`.
 * Wrapped in a transaction — if any INSERT fails the DELETE is rolled back
 * and the role retains its previous permissions.
 */
const applyPermissions = async (pool, role, rows, updatedBy = "system") => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("role", sql.VarChar, role.toLowerCase())
      .query(`DELETE FROM RolePermissions WHERE RoleName = @role`);

    for (const { sectionKey, path, canAccess } of rows) {
      await new sql.Request(transaction)
        .input("role",      sql.VarChar, role.toLowerCase())
        .input("section",   sql.VarChar, sectionKey)
        .input("path",      sql.VarChar, path)
        .input("access",    sql.Bit,     canAccess ? 1 : 0)
        .input("updatedBy", sql.VarChar, updatedBy)
        .query(`
          INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess, UpdatedBy, UpdatedAt)
          VALUES (@role, @section, @path, @access, @updatedBy, GETDATE())
        `);
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/* =========================================================
   GET LOGGED-IN USER PERMISSIONS
   GET /permissions/me
========================================================= */
export const getMyPermissions = tryCatch(async (req, res) => {
  // FIX: was req.user?.roleName.toLowerCase() — crashes when roleName is undefined
  const role = req.user?.roleName?.toLowerCase();
  if (!role) throw new AppError("Role not found", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool
      .request()
      .input("role", sql.VarChar, role)
      .query(`
        SELECT SectionKey, Path, CanAccess
        FROM   RolePermissions
        WHERE  RoleName = @role
      `);

    // FIX: cast BIT → boolean (MSSQL driver returns 1/0 or true/false by version)
    const permissionMap = {};
    result.recordset.forEach(({ SectionKey, Path, CanAccess }) => {
      if (!permissionMap[SectionKey]) permissionMap[SectionKey] = {};
      permissionMap[SectionKey][Path] = Boolean(CanAccess);
    });

    res.json({ success: true, role, permissions: permissionMap });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET PERMISSIONS FOR A SPECIFIC ROLE
   GET /permissions/:role
========================================================= */
export const getRolePermissions = tryCatch(async (req, res) => {
  const { role } = req.params;
  if (!role) throw new AppError("Role parameter is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool
      .request()
      .input("role", sql.VarChar, role.toLowerCase())
      .query(`
        SELECT SectionKey, Path, CanAccess
        FROM   RolePermissions
        WHERE  RoleName = @role
      `);

    const permissionMap = {};
    result.recordset.forEach(({ SectionKey, Path, CanAccess }) => {
      if (!permissionMap[SectionKey]) permissionMap[SectionKey] = {};
      permissionMap[SectionKey][Path] = Boolean(CanAccess); // FIX: cast
    });

    res.json({ success: true, data: permissionMap });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS   PUT /:role
   Body: { [sectionKey]: { [path]: boolean } }
========================================================= */
export const updateRolePermissionsByRole = tryCatch(async (req, res) => {
  const { role }       = req.params;
  const permissionsObj = req.body;

  if (!role) throw new AppError("Role parameter is required", 400);
  if (!permissionsObj || typeof permissionsObj !== "object" || Array.isArray(permissionsObj)) {
    throw new AppError(
      "Body must be a permissions object: { [sectionKey]: { [path]: boolean } }",
      400
    );
  }

  const rows      = flattenPermissions(permissionsObj);
  const updatedBy = req.user?.email ?? "system";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    // FIX: wrapped in transaction — previously a failed INSERT left the role
    // with zero permissions because the DELETE had already committed.
    await applyPermissions(pool, role, rows, updatedBy);
    res.json({ success: true, message: "Permissions updated successfully" });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS   POST /admin/update
   Body: { role: string, permissions: { [sectionKey]: { [path]: boolean } } }

   This is the format dispatched by the frontend Redux thunk.

   FIX: the original handler validated `Array.isArray(permissions)` but the
   frontend sends an Object — it was broken. Now unified with the same
   { [sectionKey]: { [path]: boolean } } shape as the PUT endpoint above.
========================================================= */
export const updateRolePermissions = tryCatch(async (req, res) => {
  const { role, permissions: permissionsObj } = req.body;

  if (!role) throw new AppError("role is required", 400);
  if (!permissionsObj || typeof permissionsObj !== "object" || Array.isArray(permissionsObj)) {
    throw new AppError(
      "permissions must be an object: { [sectionKey]: { [path]: boolean } }",
      400
    );
  }

  const rows      = flattenPermissions(permissionsObj);
  const updatedBy = req.user?.email ?? "system";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    await applyPermissions(pool, role, rows, updatedBy); // FIX: transactional
    res.json({ success: true, message: "Permissions updated successfully" });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: COPY PERMISSIONS FROM ONE ROLE TO ANOTHER  (NEW)
   POST /admin/copy
   Body: { fromRole: string, toRole: string }

   Uses a single server-side INSERT … SELECT — no N+1 round-trips.
========================================================= */
export const copyRolePermissions = tryCatch(async (req, res) => {
  const { fromRole, toRole } = req.body;

  if (!fromRole || !toRole)
    throw new AppError("fromRole and toRole are required", 400);
  if (fromRole.toLowerCase() === toRole.toLowerCase())
    throw new AppError("Source and destination roles must be different", 400);

  const pool        = await new sql.ConnectionPool(dbConfig3).connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Wipe target role's permissions
    await new sql.Request(transaction)
      .input("toRole", sql.VarChar, toRole.toLowerCase())
      .query(`DELETE FROM RolePermissions WHERE RoleName = @toRole`);

    // 2. Copy source → target in a single statement (no N+1)
    await new sql.Request(transaction)
      .input("fromRole",  sql.VarChar, fromRole.toLowerCase())
      .input("toRole",    sql.VarChar, toRole.toLowerCase())
      .input("updatedBy", sql.VarChar, req.user?.email ?? "system")
      .query(`
        INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess, UpdatedBy, UpdatedAt)
        SELECT @toRole, SectionKey, Path, CanAccess, @updatedBy, GETDATE()
        FROM   RolePermissions
        WHERE  RoleName = @fromRole
      `);

    await transaction.commit();
    res.json({
      success: true,
      message: `Permissions copied from "${fromRole}" to "${toRole}" successfully`,
    });
  } catch (err) {
    await transaction.rollback();
    throw err;
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET ALL ROLES
   GET /roles

   FIX: was using undefined `dbConfig1` (never imported) → ReferenceError
   at runtime. Now uses dbConfig3. Update to point at whatever database
   actually holds your UserRoles table if it differs.
========================================================= */
export const getAllRoles = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool.request().query(`
      SELECT RoleCode, RoleName
      FROM   UserRoles
      ORDER  BY RoleName
    `);
    res.json({ success: true, roles: result.recordset });
  } finally {
    await pool.close();
  }
});