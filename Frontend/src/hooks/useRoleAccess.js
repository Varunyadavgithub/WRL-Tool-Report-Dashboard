import { useSelector } from "react-redux";
import { useMemo } from "react";
import {
  getAccessibleMenu,
  getAccessibleRoutes,
} from "../config/routes.config";

export const useRoleAccess = () => {
  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role || "";

  const accessibleMenu = useMemo(() => getAccessibleMenu(userRole), [userRole]);
  const accessibleRoutes = useMemo(
    () => getAccessibleRoutes(userRole),
    [userRole],
  );

  return {
    user,
    userRole,
    isAdmin: userRole === "admin",
    accessibleMenu,
    accessibleRoutes,
  };
};
