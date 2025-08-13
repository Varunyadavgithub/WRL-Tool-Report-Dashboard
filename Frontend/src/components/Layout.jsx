import { Outlet } from "react-router-dom";
import NavBar from "./Navbar";
import Sidebar from "./Sidebar";

const Layout = ({ isSidebarExpanded, toggleSidebar }) => {
  return (
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
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;