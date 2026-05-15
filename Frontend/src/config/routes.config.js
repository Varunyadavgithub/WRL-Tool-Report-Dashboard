import { lazy } from "react";
import {
  Monitor,
  Wrench,
  Factory,
  ShieldCheck,
  Truck,
  CalendarRange,
  UserCheck,
  SlidersHorizontal,
  BellRing,
  ClipboardCheck,
  Gauge,
  FileText,
} from "lucide-react";

// Lazy loaded components
const ProductionOverview = lazy(() => import("../pages/Production/Overview"));
const ComponentTraceabilityReport = lazy(
  () => import("../pages/Production/ComponentTraceabilityReport"),
);
const HourlyReport = lazy(() => import("../pages/Production/HourlyReport"));
const LineHourlyReport = lazy(
  () => import("../pages/Production/LineHourlyReport"),
);
const ConsolidatedReport = lazy(
  () => import("../pages/Production/ConsolidatedReport/ConsolidatedReport"),
);
const ModelNameUpdate = lazy(
  () => import("../pages/Production/ModelNameUpdate"),
);
const NFCReport = lazy(() => import("../pages/Production/NFCReport"));
const TotalProduction = lazy(
  () => import("../pages/Production/TotalProduction"),
);
const StopLossReport = lazy(() => import("../pages/Production/StopLossReport"));
const ManpowerReport = lazy(() => import("../pages/Production/manPowerReport"));

const ReworkReport = lazy(() => import("../pages/Quality/ReworkReport"));
const GasChargingReport = lazy(
  () => import("../pages/Quality/GasChargingReport"),
);
const ESTReport = lazy(() => import("../pages/Quality/ESTReport"));
const CPTReport = lazy(() => import("../pages/Quality/CPTReport"));
const FPA = lazy(() => import("../pages/Quality/FPA"));
const FPAReports = lazy(() => import("../pages/Quality/FPAReports"));
const FPAHistory = lazy(() => import("../pages/Quality/FPAHistory"));
const FPADefectReport = lazy(() => import("../pages/Quality/FPADefectReport"));
const LPT = lazy(() => import("../pages/Quality/LPT"));
const LPTReport = lazy(() => import("../pages/Quality/LPTReport"));
const DispatchHold = lazy(() => import("../pages/Quality/DispatchHold"));
const HoldCabinateDetails = lazy(
  () => import("../pages/Quality/HoldCabinateDetails"),
);
const TagUpdate = lazy(() => import("../pages/Quality/TagUpdate"));
const LPTRecipe = lazy(() => import("../pages/Quality/LPTRecipe"));
const UploadBISReport = lazy(() => import("../pages/Quality/UploadBISReport"));
const BISReports = lazy(() => import("../pages/Quality/BISReports"));
const BEECalculation = lazy(() => import("../pages/Quality/BEECalculation"));

const DispatchPerformanceReport = lazy(
  () => import("../pages/Dispatch/DispatchPerformanceReport"),
);
const DispatchReport = lazy(() => import("../pages/Dispatch/DispatchReport"));
const FGDispatchReport = lazy(
  () => import("../pages/Dispatch/Fgdispatchreport"),
);
const DispatchUnloading = lazy(
  () => import("../pages/Dispatch/DispatchUnloading"),
);
const RemoveDispatchSerials = lazy(
  () => import("../pages/Dispatch/RemoveDispatchSerials"),
);
const FGCasting = lazy(() => import("../pages/Dispatch/FGCasting"));
const GateEntry = lazy(() => import("../pages/Dispatch/GateEntry"));
const ErrorLog = lazy(() => import("../pages/Dispatch/ErrorLog"));

const ProductionPlaning = lazy(
  () => import("../pages/Planing/ProductionPlaning"),
);
const DailyPlan = lazy(() => import("../pages/Planing/DailyPlan"));

const Dashboard = lazy(() => import("../pages/Visitor/Dashboard"));
const GeneratePass = lazy(() => import("../pages/Visitor/GeneratePass"));
const VisitorPassDisplay = lazy(
  () => import("../pages/Visitor/VisitorPassDisplay"),
);
const InOut = lazy(() => import("../pages/Visitor/InOut"));
const Reports = lazy(() => import("../pages/Visitor/Reports"));
const History = lazy(() => import("../pages/Visitor/History"));
const ManageEmployee = lazy(() => import("../pages/Visitor/ManageEmployee"));

const Calibiration = lazy(() => import("../pages/Compliance/Calibration"));

const TemplateBuilder = lazy(
  () => import("../pages/AuditReport/Template/TemplateBuilder"),
);
const TemplateList = lazy(
  () => import("../pages/AuditReport/Template/TemplateList"),
);
const AuditList = lazy(() => import("../pages/AuditReport/Audit/AuditList"));
const AuditEntry = lazy(() => import("../pages/AuditReport/Audit/AuditEntry"));
const AuditView = lazy(() => import("../pages/AuditReport/Audit/AuditView"));

const DehumidifierDashboard = lazy(
  () => import("../pages/Readings/DehumidifierDashboard"),
);

const ManpowerForm = lazy(() => import("../pages/Forms/ManpowerForm"));
const ManpowerApproval = lazy(() => import("../pages/Forms/ManpowerApproval"));
const SecurityManpowerList = lazy(
  () => import("../pages/Forms/SecurityManpowerList"),
);
const Monitoring = lazy(() => import("../pages/Display/Monitoring"));
const Management = lazy(() => import("../pages/Display/Management"));
const WIPCapture = lazy(() => import("../pages/Production/WIPCapture"));

// ─── Role Constants ───────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super admin", // Full access — including in-progress modules
  ADMIN: "admin", // All live modules only (no in-progress modules)
  LOGISTIC: "logistic",
  QUALITY_MANAGER: "quality manager",
  LINE_QUALITY_ENGINEER: "line quality engineer",
  BIS_ENGINEER: "bis engineer",
  FPA: "fpa",
  LPT: "lpt",
  GATE_ENTRY_USER: "gate entry user",
  PRODUCTION_MANAGER: "production manager",
  PLANNING_TEAM: "planning team",
  SECURITY: "security",
  HR: "hr",
  SUS_LINE_USER: "sus line user",
};

// ─── Role Groups (reusable shorthand) ────────────────────────────────────────
// Every item carries an explicit roles list — access is always intentional.
// Rule: SUPER_ADMIN is always first, ADMIN second, then specific roles.
//
// IN-PROGRESS modules (Compliance, Audit Report, Utility, Forms):
//   → Only SUPER_ADMIN. ADMIN is excluded until the module goes live.
//
// LIVE modules:
//   → Both SUPER_ADMIN and ADMIN, plus any other permitted roles.

const ALL_ROLES = Object.values(ROLES);

// Both admin tiers — use for any live page accessible to all admin-level users
const BOTH_ADMINS = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const QUALITY_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.QUALITY_MANAGER,
  ROLES.LINE_QUALITY_ENGINEER,
  ROLES.BIS_ENGINEER,
  ROLES.FPA,
  ROLES.LPT,
];

// Roles that can see the general production reports (not WIP-only)
const PRODUCTION_REPORT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.PRODUCTION_MANAGER,
  ROLES.PLANNING_TEAM,
  ROLES.LOGISTIC,
  ROLES.QUALITY_MANAGER,
  ROLES.LINE_QUALITY_ENGINEER,
];

// Dispatch roles (general reports)
const DISPATCH_REPORT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.LOGISTIC,
  ROLES.PRODUCTION_MANAGER,
  ROLES.PLANNING_TEAM,
];

// ─── Route Configuration ──────────────────────────────────────────────────────
export const ROUTE_CONFIG = [
  // ── Display ──────────────────────────────────────────────────────────────
  {
    key: "display",
    icon: Monitor,
    label: "Display",
    basePath: "/display",
    items: [
      {
        path: "/display/management",
        label: "Management",
        icon: Wrench,
        component: Management,
        roles: [...BOTH_ADMINS, ROLES.PLANNING_TEAM],
      },
    ],
    hiddenItems: [
      {
        path: "/display/:slug",
        component: Monitoring,
        // Monitoring display is accessible to all authenticated users
        roles: ALL_ROLES,
      },
    ],
  },

  // ── Planning ─────────────────────────────────────────────────────────────
  {
    key: "planing",
    icon: CalendarRange,
    label: "Planning",
    basePath: "/planing",
    items: [
      {
        path: "/planing/production-planing",
        label: "Production Planning",
        component: ProductionPlaning,
        roles: [...BOTH_ADMINS, ROLES.PRODUCTION_MANAGER, ROLES.PLANNING_TEAM],
      },
      {
        path: "/planing/daily-planing",
        label: "Daily Plan",
        component: DailyPlan,
        roles: [...BOTH_ADMINS, ROLES.PRODUCTION_MANAGER, ROLES.PLANNING_TEAM],
      },
    ],
  },

  // ── Production ───────────────────────────────────────────────────────────
  // SUS_LINE_USER → sees only Production module, only WIP Capture page.
  // All other production report pages are hidden from SUS_LINE_USER.
  {
    key: "production",
    icon: Factory,
    label: "Production",
    basePath: "/production",
    items: [
      {
        path: "/production/overview",
        label: "Production Report",
        component: ProductionOverview,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/component-traceability-report",
        label: "Component Traceability Report",
        component: ComponentTraceabilityReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/hourly-report",
        label: "Hourly Report",
        component: HourlyReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/line-hourly-report",
        label: "Line Hourly Report",
        component: LineHourlyReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/consolidated-report",
        label: "Consolidated Report",
        component: ConsolidatedReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/model-name-update",
        label: "Model Name Update",
        component: ModelNameUpdate,
        roles: [...BOTH_ADMINS],
      },
      {
        path: "/production/nfc-report",
        label: "NFC Report",
        component: NFCReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/total-production",
        label: "Total Production",
        component: TotalProduction,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/stop-loss-report",
        label: "Stop Loss Report",
        component: StopLossReport,
        roles: PRODUCTION_REPORT_ROLES,
      },
      {
        path: "/production/manpower-report",
        label: "Manpower Report",
        component: ManpowerReport,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        // SUS_LINE_USER's only permitted page in the entire app
        path: "/production/wip-capture",
        label: "WIP Capture",
        component: WIPCapture,
        roles: [...BOTH_ADMINS, ROLES.SUS_LINE_USER],
      },
    ],
  },

  // ── Quality ──────────────────────────────────────────────────────────────
  // Quality module is visible only to quality-related roles and admin.
  // Each page further narrows access where needed.
  {
    key: "quality",
    icon: ShieldCheck,
    label: "Quality",
    basePath: "/quality",
    items: [
      {
        path: "/quality/rework-report",
        label: "Rework Report",
        component: ReworkReport,
        roles: [
          ...BOTH_ADMINS,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/gas-charging-report",
        label: "Gas Charging Report",
        component: GasChargingReport,
        roles: [
          ...BOTH_ADMINS,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/est-report",
        label: "EST Report",
        component: ESTReport,
        roles: [
          ...BOTH_ADMINS,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/cpt-report",
        label: "CPT Report",
        component: CPTReport,
        roles: QUALITY_ROLES,
      },
      {
        path: "/quality/fpa",
        label: "FPA",
        component: FPA,
        roles: [...BOTH_ADMINS, ROLES.FPA, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/fpa-report",
        label: "FPA Report",
        component: FPAReports,
        roles: [
          ...BOTH_ADMINS,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/fpa-history",
        label: "FPA History",
        component: FPAHistory,
        roles: [
          ...BOTH_ADMINS,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/fpa-defect-report",
        label: "FPA Defect Report",
        component: FPADefectReport,
        roles: [
          ...BOTH_ADMINS,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
          ROLES.LINE_QUALITY_ENGINEER,
        ],
      },
      {
        path: "/quality/lpt",
        label: "LPT",
        component: LPT,
        roles: [
          ...BOTH_ADMINS,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/lpt-report",
        label: "LPT Report",
        component: LPTReport,
        roles: [
          ...BOTH_ADMINS,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/lpt-recipe",
        label: "LPT Recipe",
        component: LPTRecipe,
        roles: [
          ...BOTH_ADMINS,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/dispatch-hold",
        label: "Dispatch Hold",
        component: DispatchHold,
        roles: [
          ...BOTH_ADMINS,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/hold-cabinate-details",
        label: "Hold Cabinet Details",
        component: HoldCabinateDetails,
        roles: QUALITY_ROLES,
      },
      {
        path: "/quality/tag-update",
        label: "Tag Update",
        component: TagUpdate,
        roles: [...BOTH_ADMINS, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/upload-bis-report",
        label: "Upload BIS Report",
        component: UploadBISReport,
        roles: [...BOTH_ADMINS, ROLES.BIS_ENGINEER, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/bis-reports",
        label: "BIS Reports",
        component: BISReports,
        roles: [
          ...BOTH_ADMINS,
          ROLES.BIS_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/bee-calculation",
        label: "BEE Calculation",
        component: BEECalculation,
        roles: [
          ...BOTH_ADMINS,
          ROLES.BIS_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
    ],
  },

  // ── Dispatch ─────────────────────────────────────────────────────────────
  // GATE_ENTRY_USER → sees only the Dispatch module, only the Gate Entry page.
  {
    key: "dispatch",
    icon: Truck,
    label: "Dispatch",
    basePath: "/dispatch",
    items: [
      {
        path: "/dispatch/dispatch-performance-report",
        label: "Dispatch Performance Report",
        component: DispatchPerformanceReport,
        roles: DISPATCH_REPORT_ROLES,
      },
      {
        path: "/dispatch/dispatch-report",
        label: "Dispatch Report",
        component: DispatchReport,
        roles: DISPATCH_REPORT_ROLES,
      },
      {
        path: "/dispatch/dispatch-unloading",
        label: "Dispatch Unloading",
        component: DispatchUnloading,
        roles: DISPATCH_REPORT_ROLES,
      },
      {
        path: "/dispatch/fg-casting",
        label: "FG Casting",
        component: FGCasting,
        roles: DISPATCH_REPORT_ROLES,
      },
      {
        path: "/dispatch/fg-dispatchReport",
        label: "FG Dispatch Report",
        component: FGDispatchReport,
        roles: DISPATCH_REPORT_ROLES,
      },
      {
        // GATE_ENTRY_USER's only permitted page in the entire app
        path: "/dispatch/gate-entry",
        label: "Gate Entry",
        component: GateEntry,
        roles: [...BOTH_ADMINS, ROLES.GATE_ENTRY_USER],
      },
      {
        path: "/dispatch/error-log",
        label: "Error Log",
        component: ErrorLog,
        roles: [...BOTH_ADMINS, ROLES.LOGISTIC],
      },
      {
        path: "/dispatch/remove-error-serials",
        label: "Remove Error Serials",
        component: RemoveDispatchSerials,
        roles: [...BOTH_ADMINS, ROLES.LOGISTIC],
      },
    ],
  },

  // ── Visitor ──────────────────────────────────────────────────────────────
  {
    key: "visitor",
    icon: UserCheck,
    label: "Visitor",
    basePath: "/visitor",
    items: [
      {
        path: "/visitor/dashboard",
        label: "Dashboard",
        component: Dashboard,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
      {
        path: "/visitor/generate-pass",
        label: "Generate Pass",
        component: GeneratePass,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
      {
        path: "/visitor/in-out",
        label: "In / Out",
        component: InOut,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
      {
        path: "/visitor/reports",
        label: "Reports",
        component: Reports,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
      {
        path: "/visitor/history",
        label: "History",
        component: History,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
      {
        path: "/visitor/manage-employee",
        label: "Manage Employee",
        component: ManageEmployee,
        roles: [...BOTH_ADMINS, ROLES.HR],
      },
    ],
    hiddenItems: [
      {
        path: "/visitor-pass-display/:passId",
        component: VisitorPassDisplay,
        roles: [...BOTH_ADMINS, ROLES.SECURITY, ROLES.HR],
      },
    ],
  },

  // ── Compliance ───────────────────────────────────────────────────────────
  // 🚧 IN PROGRESS — SUPER_ADMIN only until live
  {
    key: "compliance",
    icon: SlidersHorizontal,
    label: "Compliance",
    basePath: "/compliance",
    items: [
      {
        path: "/compliance/calibiration",
        label: "Calibration",
        component: Calibiration,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },

  // ── Audit Report ─────────────────────────────────────────────────────────
  // 🚧 IN PROGRESS — SUPER_ADMIN only until live
  {
    key: "auditReport",
    icon: ClipboardCheck,
    label: "Audit Report",
    basePath: "/auditreport",
    items: [
      {
        path: "/auditreport/build-templates",
        label: "Build Templates",
        component: TemplateBuilder,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/auditreport/templates",
        label: "All Templates",
        component: TemplateList,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/auditreport/audits",
        label: "Audits",
        component: AuditList,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
    hiddenItems: [
      {
        path: "/auditreport/templates/:id",
        component: TemplateBuilder,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/auditreport/audits/new",
        component: AuditEntry,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/auditreport/audits/:id",
        component: AuditEntry,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/auditreport/audits/:id/view",
        component: AuditView,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },

  // ── Utility / Readings ───────────────────────────────────────────────────
  // 🚧 IN PROGRESS — SUPER_ADMIN only until live
  {
    key: "reading",
    icon: Gauge,
    label: "Utility",
    basePath: "/reading",
    items: [
      {
        path: "/reading/dehumidifier",
        label: "Utility Reading",
        component: DehumidifierDashboard,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },

  // ── Forms ────────────────────────────────────────────────────────────────
  // 🚧 IN PROGRESS — SUPER_ADMIN only until live
  {
    key: "forms",
    icon: FileText,
    label: "Forms",
    basePath: "/forms",
    items: [
      {
        path: "/forms/manpower-form",
        label: "Manpower Form",
        component: ManpowerForm,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/forms/manpower-approval",
        label: "Manpower Approval",
        component: ManpowerApproval,
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        path: "/forms/security-manpower",
        label: "Security Manpower List",
        component: SecurityManpowerList,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },
];

// ─── Access Utilities ─────────────────────────────────────────────────────────

/**
 * Check if a user role is in the allowed roles list.
 * If no roles list is provided, access is DENIED (secure by default).
 */
export const canAccess = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return false; // deny by default
  return allowedRoles.includes(userRole);
};

/**
 * Returns the flat list of { path, component } route objects a user can access.
 * Used to register React Router <Route> elements.
 */
export const getAccessibleRoutes = (userRole) => {
  const routes = [];

  ROUTE_CONFIG.forEach((section) => {
    // Visible items
    section.items.forEach((item) => {
      if (canAccess(userRole, item.roles)) {
        routes.push({ path: item.path, component: item.component });
      }
    });

    // Hidden items (no sidebar entry, but still need a registered route)
    if (section.hiddenItems) {
      section.hiddenItems.forEach((item) => {
        if (canAccess(userRole, item.roles)) {
          routes.push({ path: item.path, component: item.component });
        }
      });
    }
  });

  return routes;
};

/**
 * Returns the sidebar menu structure filtered for the given user role.
 * Sections with zero accessible items are omitted entirely.
 */
export const getAccessibleMenu = (userRole) => {
  return ROUTE_CONFIG.map((section) => {
    const accessibleItems = section.items.filter((item) =>
      canAccess(userRole, item.roles),
    );

    if (accessibleItems.length === 0) return null;

    return { ...section, items: accessibleItems };
  }).filter(Boolean);
};
