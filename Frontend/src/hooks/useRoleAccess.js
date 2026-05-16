import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ROUTE_CONFIG, ROLES } from "../config/routes.config.js";
import { useGetMyPermissionsQuery } from "../redux/api/permissionApi";

const SUPER_ADMIN_ROLE = ROLES.SUPER_ADMIN;

export const useRoleAccess = () => {
  const { user } = useSelector((state) => state.auth);
  const userRole = user?.role?.toLowerCase?.() ?? "";

  const { data } = useGetMyPermissionsQuery(undefined, {
    skip: userRole === SUPER_ADMIN_ROLE,
  });

  const permissions = data?.permissions || [];

  const permissionMap = useMemo(() => {
    if (!permissions.length) return null;

    const map = {};

    permissions.forEach((p) => {
      if (!map[p.sectionKey]) map[p.sectionKey] = {};
      map[p.sectionKey][p.path] = p.canAccess;
    });

    return map;
  }, [permissions]);

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
