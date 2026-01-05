import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaIndustry,
  FaClipboardCheck,
  FaTruckMoving,
  FaChevronDown,
  FaChevronUp,
  FaBars,
  FaTimes,
  FaClipboardList,
} from "react-icons/fa";
import {
  MdNotificationsActive,
  MdOutlineDisplaySettings,
} from "react-icons/md";
import { FaUserShield } from "react-icons/fa6";
import { useSelector } from "react-redux";

// Define menu configurations
const MENU_CONFIG = [
  {
    key: "production",
    icon: FaIndustry,
    label: "Production",
    items: [
      { path: "/production/overview", label: "Production Report" },
      {
        path: "/production/component-traceability-report",
        label: "Component Traceability Report",
      },
      { path: "/production/hourly-report", label: "Hourly Report" },
      { path: "/production/line-hourly-report", label: "Line Hourly Report" },
      {
        path: "/production/stage-history-report",
        label: "Stage History Report",
      },
      {
        path: "/production/model-name-update",
        label: "Model Name Update",
        roles: ["logistic"],
      },
      {
        path: "/production/component-details",
        label: "Component Details",
      },
      { path: "/production/total-production", label: "Total Production" },
      { path: "/production/nfc-report", label: "NFC Report" },
    ],
  },
  {
    key: "quality",
    icon: FaClipboardCheck,
    label: "Quality",
    items: [
      {
        path: "/quality/rework-entry",
        label: "Rework Entry",
        roles: ["admin"],
      },
      {
        path: "/quality/rework-report",
        label: "Rework Report",
        roles: ["admin"],
      },
      {
        path: "/quality/brazing-report",
        label: "Brazing Report",
        roles: ["admin"],
      },
      {
        path: "/quality/gas-charging-report",
        label: "Gas Charging Report",
        roles: ["admin"],
      },
      { path: "/quality/est-report", label: "EST Report", roles: ["admin"] },
      {
        path: "/quality/cpt-report",
        label: "CPT Report",
        roles: ["line quality engineer", "fpa", "quality manager"],
      },
      { path: "/quality/fpa", label: "FPA", roles: ["fpa", "quality manager"] },
      { path: "/quality/fpa-report", label: "FPA Report" },
      { path: "/quality/fpa-defect-report", label: "FPA Defect Report" },
      {
        path: "/quality/lpt",
        label: "LPT",
        roles: ["line quality engineer", "quality manager", "lpt"],
      },
      {
        path: "/quality/lpt-report",
        label: "LPT Report",
        roles: ["line quality engineer", "quality manager", "lpt"],
      },
      {
        path: "/quality/lpt-recipe",
        label: "LPT Recipe",
        roles: ["line quality engineer", "quality manager", "lpt"],
      },
      {
        path: "/quality/dispatch-hold",
        label: "Dispatch Hold",
        roles: ["line quality engineer", "fpa", "quality manager"],
      },
      { path: "/quality/hold-cabinate-details", label: "Hold Cabinet Details" },
      {
        path: "/quality/tag-update",
        label: "Tag Update",
        roles: ["line quality engineer", "quality manager"],
      },
      {
        path: "/quality/upload-bis-report",
        label: "Upload BIS Report",
        roles: ["bis engineer", "quality manager"],
      },
      {
        path: "/quality/bis-reports",
        label: "BIS Reports",
        roles: [
          "line quality engineer",
          "bis engineer",
          "fpa",
          "quality manager",
        ],
      },
      {
        path: "/quality/bis-status",
        label: "BIS Status",
        roles: [
          "line quality engineer",
          "bis engineer",
          "fpa",
          "quality manager",
        ],
      },
      {
        path: "/quality/bee-calculation",
        label: "BEE Calculation",
        roles: [
          "line quality engineer",
          "bis engineer",
          "fpa",
          "quality manager",
        ],
      },
    ],
  },
  {
    key: "dispatch",
    icon: FaTruckMoving,
    label: "Dispatch",
    items: [
      {
        path: "/dispatch/dispatch-performance-report",
        label: "Dispatch Performance Report",
      },
      { path: "/dispatch/dispatch-report", label: "Dispatch Report" },
      { path: "/dispatch/dispatch-unloading", label: "Dispatch Unloading" },
      {
        path: "/dispatch/fg-casting",
        label: "FG Casting",
      },
      { path: "/dispatch/gate-entry", label: "Gate Entry" },
      { path: "/dispatch/error-log", label: "Error Log" },
    ],
  },
  {
    key: "planing",
    icon: FaClipboardList,
    label: "Planing",
    items: [
      {
        path: "/planing/production-planing",
        label: "Production Planing",
        roles: ["production manager", "planning team"],
      },
      { path: "/planing/5-days-planing", label: "5 Days Planing" },
      { path: "/planing/daily-planing", label: "Daily Plan" },
    ],
  },
  {
    key: "visitor",
    icon: FaUserShield,
    label: "Visitor",
    items: [
      {
        path: "/visitor/dashboard",
        label: "Dashboard",
        roles: ["admin", "security", "hr"],
      },
      {
        path: "/visitor/generate-pass",
        label: "Generate Pass",
        roles: ["admin", "security", "hr"],
      },
      {
        path: "/visitor/in-out",
        label: "In / Out",
        roles: ["admin", "security", "hr"],
      },
      {
        path: "/visitor/reports",
        label: "Reports",
        roles: ["admin", "security", "hr"],
      },
      {
        path: "/visitor/history",
        label: "History",
        roles: ["admin", "security", "hr"],
      },
      {
        path: "/visitor/manage-employee",
        label: "Manage Employee",
        roles: ["admin", "hr"],
      },
    ],
  },
  {
    key: "Displays",
    icon: MdOutlineDisplaySettings,
    label: "Displays",
    items: [
      {
        path: "/displays/logistics",
        label: "Logistics",
        roles: ["admin"],
      },
    ],
  },
    {
    key: "Compliance",
    icon: MdOutlineDisplaySettings,
    label: "Compliance",
    items: [
      {
        path: "/compliance/calibiration",
        label: "calibiration",
        roles: ["admin"],
      },
    ],
  },
];

const Sidebar = ({ isSidebarExpanded, toggleSidebar }) => {
  const userRole = useSelector((state) => state.auth.user?.role || "");

  const canAccess = (allowedRoles) =>
    allowedRoles.includes(userRole) || userRole === "admin";

  const [expandedMenus, setExpandedMenus] = useState(
    MENU_CONFIG.reduce((acc, menu) => ({ ...acc, [menu.key]: false }), {})
  );

  const location = useLocation();

  const toggleMenu = (menu) => {
    setExpandedMenus((prevState) => {
      // Create a new state object with all menus collapsed
      const newState = Object.keys(prevState).reduce(
        (acc, key) => ({
          ...acc,
          [key]: false,
        }),
        {}
      );

      // Toggle the selected menu
      newState[menu] = !prevState[menu];
      return newState;
    });
  };

  const isActive = (path) =>
    location.pathname === path ? "bg-blue-500 text-white" : "text-gray-300";

  const renderMenuItems = (menu) => {
    return (
      <ul className="ml-6 mt-2 space-y-2 max-h-80 overflow-y-auto">
        {menu.items.map((item, index) => {
          if (item.roles && !canAccess(item.roles)) return null; // Hide restricted items

          return (
            <li key={index}>
              <Link
                to={item.path}
                className={`block p-2 rounded-lg hover:bg-gray-700 transition ${isActive(
                  item.path
                )}`}
                onClick={() => window.scrollTo(0, 0)}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderMenuSection = (menu) => {
    const MenuIcon = menu.icon;

    return (
      <li key={menu.key}>
        <div
          className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-gray-700 transition"
          onClick={() => toggleMenu(menu.key)}
        >
          <div className="flex items-center">
            <MenuIcon className="mr-3" />
            {isSidebarExpanded && (
              <span className="font-semibold">{menu.label}</span>
            )}
          </div>
          {isSidebarExpanded &&
            (expandedMenus[menu.key] ? <FaChevronUp /> : <FaChevronDown />)}
        </div>
        {isSidebarExpanded && expandedMenus[menu.key] && renderMenuItems(menu)}
      </li>
    );
  };

  return (
    <aside
      className={`fixed min-h-screen bg-gray-900 text-white transition-all duration-300 ease-in-out ${
        isSidebarExpanded ? "w-64" : "w-16"
      } p-4 shadow-xl flex flex-col`}
    >
      <div className="flex-shrink-0">
        {/* Title */}
        <div className="flex justify-between mb-4">
          {isSidebarExpanded ? (
            <>
              <h1 className="text-2xl font-playfair">Dashboard</h1>
              <button
                className="text-gray-300 hover:text-white focus:outline-none text-2xl cursor-pointer"
                onClick={toggleSidebar}
              >
                {isSidebarExpanded ? <FaTimes /> : <FaBars />}
              </button>
            </>
          ) : (
            <button
              className="text-gray-300 hover:text-white focus:outline-none text-2xl cursor-pointer"
              onClick={toggleSidebar}
            >
              {isSidebarExpanded ? <FaTimes /> : <FaBars />}
            </button>
          )}
        </div>

        <ul className="space-y-4 overflow-y-auto overflow-x-hidden max-h-full">
          {MENU_CONFIG.map(renderMenuSection)}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
