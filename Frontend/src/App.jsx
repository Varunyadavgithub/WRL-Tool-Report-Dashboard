import { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Lazy loaded components
const Login = lazy(() => import("./pages/Auth/Login"));
const NavBar = lazy(() => import("./components/Navbar"));
const Sidebar = lazy(() => import("./components/Sidebar"));
const MainContent = lazy(() => import("./components/MainContent"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));

function App() {
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);

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

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              true ? (
                <div className="flex flex-col h-screen">
                  <NavBar />
                  <div className="flex flex-1 overflow-hidden">
                    <Sidebar
                      isSidebarExpanded={isSidebarExpanded}
                      toggleSidebar={toggleSidebar}
                    />
                    <div
                      className={`flex-1 transition-all duration-300 ease-in-out overflow-auto ${
                        isSidebarExpanded ? "ml-64" : "ml-16"
                      }`}
                    >
                      <MainContent />
                    </div>
                  </div>
                </div>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
