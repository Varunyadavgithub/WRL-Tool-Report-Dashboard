import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ROUTE_CONFIG, ROLES } from "../config/routes.config.js";
import { useGetMyPermissionsQuery } from "../redux/api/permissionApi";

const SUPER_ADMIN_ROLE = ROLES.SUPER_ADMIN;

export const useRoleAccess = () => {
  const { user } = useSelector((state) => state.auth);
  const userRole = user?.roleName?.toLowerCase?.() ?? "";

  // A stale redux-persist login (user cached but the session cookie expired/
  // cleared) is handled globally now — see authExpiryMiddleware (redux/store.js)
  // — no need for a one-off 401 handler on this specific query anymore.
  const { data } = useGetMyPermissionsQuery(undefined, {
    skip: !user || userRole === SUPER_ADMIN_ROLE,
  });

  // Backend returns permissions as an object: { [SectionKey]: { [Path]: boolean } }
  const permissionMap = useMemo(() => {
    if (userRole === SUPER_ADMIN_ROLE) return null;
    if (!data?.permissions) return null;

    // Backend already returns the correct format, use it directly
    return data.permissions;
  }, [data, userRole]);

  const canAccess = (sectionKey, path) => {
    if (userRole === SUPER_ADMIN_ROLE) return true;
    return permissionMap?.[sectionKey]?.[path] || false;
  };

  const accessibleMenu = useMemo(() => {
    return ROUTE_CONFIG.map((section) => {
      const items = section.items.filter((item) =>
        canAccess(section.key, item.path),
      );

      if (!items.length) return null;

      return { ...section, items };
    }).filter(Boolean);
  }, [permissionMap, userRole]);

  const accessibleRoutes = useMemo(() => {
    const routes = [];

    ROUTE_CONFIG.forEach((section) => {
      [...section.items, ...(section.hiddenItems || [])].forEach((item) => {
        if (canAccess(section.key, item.path)) {
          routes.push({
            path: item.path,
            component: item.component,
          });
        }
      });
    });

    return routes;
  }, [permissionMap, userRole]);

  return {
    userRole,
    accessibleMenu,
    accessibleRoutes,
    canAccess,
    isSuperAdmin: userRole === SUPER_ADMIN_ROLE,
  };
};
