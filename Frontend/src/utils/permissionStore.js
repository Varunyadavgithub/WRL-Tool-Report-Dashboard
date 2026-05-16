/**
 * permissionStore.js
 *
 * Stores role-based permissions in localStorage.
 * Shape: { [roleName]: { [sectionKey]: { [itemPath]: boolean } } }
 *
 * Easy to swap to an API later — just replace getPermissions / savePermissions
 * with fetch calls and remove the localStorage lines.
 */

const STORAGE_KEY = "wrl_role_permissions";
const INITIALIZED_KEY = "wrl_permissions_initialized";

// ─── Read / Write ─────────────────────────────────────────────────────────────

export const getPermissions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const savePermissions = (permissions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
  } catch (e) {
    console.error("Failed to save permissions:", e);
  }
};

// ─── Per-role helpers ─────────────────────────────────────────────────────────

/**
 * Get permission map for a single role.
 * Returns: { [sectionKey]: { [itemPath]: boolean } }
 */
export const getRolePermissions = (roleName) => {
  const all = getPermissions();
  return all[roleName] ?? {};
};

/**
 * Save the full permission map for a single role.
 */
export const saveRolePermissions = (roleName, rolePerms) => {
  const all = getPermissions();
  all[roleName] = rolePerms;
  savePermissions(all);
};

// ─── Access check ─────────────────────────────────────────────────────────────

/**
 * Check if a role can access a specific route path.
 * Returns false if no permission record exists (deny by default).
 */
export const canRoleAccessPath = (roleName, sectionKey, itemPath) => {
  const rolePerms = getRolePermissions(roleName);
  return rolePerms?.[sectionKey]?.[itemPath] === true;
};

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Called once on app boot (or from Settings on reset).
 * Seeds localStorage from routeConfig so existing role arrays
 * become the default permission state — no lockout on first deploy.
 *
 * @param {Array}  ROUTE_CONFIG  - the routeConfig array
 * @param {Object} ROLES         - the ROLES constants object
 * @param {string} SUPER_ADMIN   - value of the super admin role (always gets all)
 * @param {boolean} force        - re-seed even if already initialized
 */
export const initializePermissions = (ROUTE_CONFIG, ROLES, SUPER_ADMIN, force = false) => {
  if (!force && localStorage.getItem(INITIALIZED_KEY)) return;

  const permissions = {};

  // Give every role an empty map first
  Object.values(ROLES).forEach((role) => {
    permissions[role] = {};
  });

  ROUTE_CONFIG.forEach((section) => {
    const allItems = [
      ...section.items,
      ...(section.hiddenItems ?? []),
    ];

    allItems.forEach((item) => {
      const allowedRoles = item.roles ?? [];

      Object.values(ROLES).forEach((role) => {
        if (!permissions[role][section.key]) {
          permissions[role][section.key] = {};
        }

        if (role === SUPER_ADMIN) {
          // SUPER_ADMIN always gets everything
          permissions[role][section.key][item.path] = true;
        } else {
          // Seed from the static roles array in routeConfig
          permissions[role][section.key][item.path] = allowedRoles.includes(role);
        }
      });
    });
  });

  savePermissions(permissions);
  localStorage.setItem(INITIALIZED_KEY, "true");
};

/**
 * Clear the initialized flag so the next app boot re-seeds from routeConfig.
 * Useful after adding new routes.
 */
export const resetPermissionInit = () => {
  localStorage.removeItem(INITIALIZED_KEY);
};