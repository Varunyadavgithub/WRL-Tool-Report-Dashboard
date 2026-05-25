import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ROUTE_CONFIG, ROLES } from "../config/routes.config.js";
import { useGetMyPermissionsQuery } from "../redux/api/permissionApi";
import { logoutUser } from "../redux/slices/authSlice.js";

const SUPER_ADMIN_ROLE = ROLES.SUPER_ADMIN;

export const useRoleAccess = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const userRole = user?.roleName?.toLowerCase?.() ?? "";

  const { data, isError, error } = useGetMyPermissionsQuery(undefined, {
    skip: !user || userRole === SUPER_ADMIN_ROLE,
  });

  // Stale redux-persist state: user in localStorage but cookie expired → clear it
  useEffect(() => {
    if (isError && error?.status === 401) {
      dispatch(logoutUser());
    }
  }, [isError, error, dispatch]);

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
