import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import NavBar from "./Navbar";
import Sidebar from "./Sidebar";
import ChatWidget from "./ChatWidget/ChatWidget.jsx";
import { useSyncMasterConfig } from "../hooks/useSyncMasterConfig.js";

const Layout = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useSyncMasterConfig();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarExpanded(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarExpanded((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isSidebarExpanded={isSidebarExpanded}
          toggleSidebar={toggleSidebar}
        />

        <main
          className={`
            flex-1 overflow-auto transition-all duration-300 ease-in-out
            ${isMobile ? "ml-0" : isSidebarExpanded ? "ml-64" : "ml-[56px]"}
          `}
        >
          <div className="min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      <ChatWidget />
    </div>
  );
};

export default Layout;
