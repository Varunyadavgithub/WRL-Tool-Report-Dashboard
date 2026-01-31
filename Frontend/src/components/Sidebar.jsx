import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaChevronDown, FaChevronUp, FaBars, FaTimes } from "react-icons/fa";
import { useRoleAccess } from "../hooks/useRoleAccess.js";

const Sidebar = ({ isSidebarExpanded, toggleSidebar }) => {
  const { accessibleMenu } = useRoleAccess();
  const [expandedMenus, setExpandedMenus] = useState({});
  const location = useLocation();

  const toggleMenu = (menuKey) => {
    setExpandedMenus((prev) => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [menuKey]: !prev[menuKey],
    }));
  };

  const isActive = (path) =>
    location.pathname === path ? "bg-blue-500 text-white" : "text-gray-300";

  return (
    <aside
      className={`fixed min-h-screen bg-gray-900 text-white transition-all duration-300 ease-in-out ${
        isSidebarExpanded ? "w-64" : "w-16"
      } p-4 shadow-xl flex flex-col z-50`}
    >
      <div className="flex-shrink-0">
        <div className="flex justify-between mb-4">
          {isSidebarExpanded && (
            <h1 className="text-2xl font-playfair">Dashboard</h1>
          )}
          <button
            className="text-gray-300 hover:text-white focus:outline-none text-2xl cursor-pointer"
            onClick={toggleSidebar}
            aria-label={
              isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
            }
          >
            {isSidebarExpanded ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <ul className="space-y-4 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-100px)]">
          {accessibleMenu.map((menu) => {
            const MenuIcon = menu.icon;

            return (
              <li key={menu.key}>
                <div
                  className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-gray-700 transition"
                  onClick={() => toggleMenu(menu.key)}
                  role="button"
                  aria-expanded={expandedMenus[menu.key]}
                >
                  <div className="flex items-center">
                    <MenuIcon className="mr-3 flex-shrink-0" />
                    {isSidebarExpanded && (
                      <span className="font-semibold">{menu.label}</span>
                    )}
                  </div>
                  {isSidebarExpanded &&
                    (expandedMenus[menu.key] ? (
                      <FaChevronUp />
                    ) : (
                      <FaChevronDown />
                    ))}
                </div>

                {isSidebarExpanded && expandedMenus[menu.key] && (
                  <ul className="ml-6 mt-2 space-y-2 max-h-80 overflow-y-auto">
                    {menu.items.map((item) => (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`block p-2 rounded-lg hover:bg-gray-700 transition ${isActive(item.path)}`}
                          onClick={() => window.scrollTo(0, 0)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
