import { lazy, Suspense, useState } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useRoleAccess } from "./hooks/useRoleAccess.js";

// Lazy loaded components
const Layout = lazy(() => import("./components/Layout"));
const Login = lazy(() => import("./pages/Auth/Login"));
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const { accessibleRoutes } = useRoleAccess();

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => !prev);
  };

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Layout Route */}
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <Layout
                isSidebarExpanded={isSidebarExpanded}
                toggleSidebar={toggleSidebar}
              />
            }
          >
            <Route path="/" index element={<Home />} />

            {/* Dynamic routes based on user role */}
            {accessibleRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<route.component />}
              />
            ))}

            {/* Catch All */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
