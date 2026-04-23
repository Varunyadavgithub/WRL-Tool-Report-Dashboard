import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaChevronDown, FaChevronUp, FaBars, FaTimes } from "react-icons/fa";
import { useRoleAccess } from "../hooks/useRoleAccess.js";

const Sidebar = ({ isSidebarExpanded, toggleSidebar }) => {
  const { accessibleMenu } = useRoleAccess();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && isSidebarExpanded) {
      toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isMobile &&
        isSidebarExpanded &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target)
      ) {
        toggleSidebar();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isSidebarExpanded, toggleSidebar]);

  const toggleMenu = (menuKey) => {
    setExpandedMenus((prev) => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [menuKey]: !prev[menuKey],
    }));
  };

  const isActive = (path) => location.pathname === path;

  const isSectionActive = (items) =>
    items.some((item) => location.pathname.startsWith(item.path));

  return (
    <>
      {isMobile && isSidebarExpanded && (
        <div
          className="fixed inset-0 top-[64px] bg-black/50 z-30 transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {isMobile && !isSidebarExpanded && (
        <button
          className="fixed top-[72px] left-4 z-30 bg-gray-900 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors md:hidden"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
        >
          <FaBars size={20} />
        </button>
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed top-[64px] left-0 h-[calc(100vh-64px)] bg-gray-900 text-white z-40
          flex flex-col shadow-xl
          transition-all duration-300 ease-in-out
          ${
            isMobile
              ? isSidebarExpanded
                ? "w-72 translate-x-0"
                : "w-72 -translate-x-full"
              : isSidebarExpanded
                ? "w-64"
                : "w-16"
          }
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50 flex-shrink-0">
          <div
            className={`overflow-hidden transition-all duration-300 ${
              isSidebarExpanded || isMobile
                ? "w-auto opacity-100"
                : "w-0 opacity-0"
            }`}
          >
            <h1 className="text-lg font-bold tracking-wide whitespace-nowrap">
              Menu
            </h1>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-700 cursor-pointer flex-shrink-0"
            onClick={toggleSidebar}
            aria-label={
              isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
            }
          >
            {isSidebarExpanded || isMobile ? (
              <FaTimes size={18} />
            ) : (
              <FaBars size={18} />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          <ul className="space-y-1 px-2">
            {accessibleMenu.map((menu) => {
              const MenuIcon = menu.icon;
              const isExpanded = expandedMenus[menu.key];
              const sectionActive = isSectionActive(menu.items);

              return (
                <li key={menu.key}>
                  <button
                    className={`
                      w-full flex items-center justify-between p-3 rounded-lg
                      transition-all duration-200 cursor-pointer
                      ${
                        sectionActive
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }
                    `}
                    onClick={() => {
                      if (!isSidebarExpanded && !isMobile) {
                        toggleSidebar();
                      }
                      toggleMenu(menu.key);
                    }}
                    aria-expanded={isExpanded}
                    title={!isSidebarExpanded ? menu.label : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MenuIcon className="flex-shrink-0 text-lg" />
                      <span
                        className={`font-medium whitespace-nowrap truncate transition-all duration-300 ${
                          isSidebarExpanded || isMobile
                            ? "opacity-100 w-auto"
                            : "opacity-0 w-0 overflow-hidden"
                        }`}
                      >
                        {menu.label}
                      </span>
                    </div>
                    {(isSidebarExpanded || isMobile) && (
                      <span className="flex-shrink-0 text-xs transition-transform duration-200">
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </span>
                    )}
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded && (isSidebarExpanded || isMobile)
                        ? "max-h-[2000px] opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <ul className="mt-1 ml-4 pl-3 border-l border-gray-700/50 space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {menu.items.map((item) => {
                        const active = isActive(item.path);
                        return (
                          <li key={item.path}>
                            <Link
                              to={item.path}
                              className={`
                                block px-3 py-2 rounded-lg text-sm
                                transition-all duration-200
                                ${
                                  active
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                }
                              `}
                              onClick={() => window.scrollTo(0, 0)}
                            >
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-shrink-0 border-t border-gray-700/50 p-3">
          <div
            className={`text-xs text-gray-500 text-center transition-all duration-300 ${
              isSidebarExpanded || isMobile ? "opacity-100" : "opacity-0"
            }`}
          >
            2025 Western Refrigeration
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
