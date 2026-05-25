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
const MassFlowReport = lazy(() => import("../pages/Quality/MassFlowReport"));
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
const TemplateView = lazy(
  () => import("../pages/AuditReport/Template/TemplateView"),
);
const TemplateApproval = lazy(
  () => import("../pages/AuditReport/Template/TemplateApproval"),
);
const SerialScan = lazy(
  () => import("../pages/AuditReport/Template/SerialScan"),
);
const AuditList = lazy(() => import("../pages/AuditReport/Audit/AuditList"));
const AuditEntry = lazy(() => import("../pages/AuditReport/Audit/AuditEntry"));
const AuditView = lazy(() => import("../pages/AuditReport/Audit/AuditView"));
const AuditApproval = lazy(() => import("../pages/AuditReport/Audit/AuditApproval"));
const AuditDashboard = lazy(() => import("../pages/AuditReport/Auditdashboard"));

const DehumidifierDashboard = lazy(
  () => import("../pages/Readings/DehumidifierDashboard"),
);

const ManpowerForm = lazy(() => import("../pages/Forms/ManpowerForm"));
const ManpowerApproval = lazy(() => import("../pages/Forms/ManpowerApproval"));
const SecurityManpowerList = lazy(
  () => import("../pages/Forms/SecurityManpowerList"),
);
const AttendanceRegister = lazy(() => import("../pages/Forms/AttendanceRegister"));
const ApprenticeDashboard = lazy(() => import("../pages/Apprentice/Dashboard"));
const ApprenticeUpload    = lazy(() => import("../pages/Apprentice/Upload"));
const ApprenticeSlips     = lazy(() => import("../pages/Apprentice/SlipList"));
const MyAttendance = lazy(() => import("../pages/Forms/MyAttendance"));
const AttendanceDashboard = lazy(() => import("../pages/Forms/AttendanceDashboard"));
const LeaveApplication = lazy(() => import("../pages/Forms/LeaveApplication"));
const LeaveApproval = lazy(() => import("../pages/Forms/LeaveApproval"));
const Monitoring = lazy(() => import("../pages/Display/Monitoring"));
const Management = lazy(() => import("../pages/Display/Management"));
const WIPCapture = lazy(() => import("../pages/Production/WIPCapture"));

// ─── Role Constants ───────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super admin", // 226005 — full access incl. in-progress modules
  ADMIN: "admin", // 222003/223002 — all live modules only
  LOGISTIC: "logistic",
  QUALITY_MANAGER: "quality manager", // 223005
  LINE_QUALITY_ENGINEER: "line quality engineer", // 224002
  BIS_ENGINEER: "bis engineer", // 225004
  FPA: "fpa", // 225003
  LPT: "lpt", // 225006
  GATE_ENTRY_USER: "gate entry user", // 226001
  PRODUCTION_MANAGER: "production manager", // 223006
  PLANNING_TEAM: "planning team", // 222002 / 223004
  SECURITY: "security", // 224004
  HR: "hr", // 224005
  SUS_LINE_USER: "sus line user", // 226004

  // ── Previously missing roles (now added) ──────────────────────────────────
  PRODUCTION_OPERATOR: "production operator", // 222001 — floor production staff
  ROLE_USER: "roleuser", // 222004
  QUALITY_OPERATOR: "quality operator", // 223001 — floor quality staff
  QUALITY_ENGINEER: "quality engineer", // 223003
  BRAZING_OPERATOR: "brazing operator", // 223007
  QUALITY_AUDITOR: "quality auditor", // 223008
  REPORT_USERS: "report users", // 223009 — view-only report access
  REPORT_USERS_ADMIN: "report users admin", // 223010 — report access with admin view
  REWORK_OPERATOR: "rework operator", // 224001
  ID_MAKER: "id maker", // 224003
  FREEZER_LABEL_ROLE: "freezer label role", // 224006
  CHOC_LABEL_ROLE: "choc label role", // 224007
  OPERATIONS: "operations", // 224008 — operations/floor management
  CHOC_COMP_SCANNING: "choc comp scanning", // 225001
  FREEZER_COMP_SCANNING: "freezer comp scanning", // 225002
  SUS_FG_LABEL: "sus fg label", // 225005
  CHEM_DATA_USER: "chem data user", // 225007
  VISI2_POST_QA: "visi-2 post qa", // 226002
  VISI_COMP_SCAN: "visi comp scan", // 226003
};

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
      },
    ],
    hiddenItems: [
      {
        path: "/display/:slug",
        component: Monitoring,
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
      },
      {
        path: "/planing/daily-planing",
        label: "Daily Plan",
        component: DailyPlan,
      },
    ],
  },

  // ── Production ───────────────────────────────────────────────────────────
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
      },
      {
        path: "/production/component-traceability-report",
        label: "Component Traceability Report",
        component: ComponentTraceabilityReport,
      },
      {
        path: "/production/hourly-report",
        label: "Hourly Report",
        component: HourlyReport,
      },
      {
        path: "/production/line-hourly-report",
        label: "Line Hourly Report",
        component: LineHourlyReport,
      },
      {
        path: "/production/consolidated-report",
        label: "Consolidated Report",
        component: ConsolidatedReport,
      },
      {
        path: "/production/model-name-update",
        label: "Model Name Update",
        component: ModelNameUpdate,
      },
      {
        path: "/production/nfc-report",
        label: "NFC Report",
        component: NFCReport,
      },
      {
        path: "/production/total-production",
        label: "Total Production",
        component: TotalProduction,
      },
      {
        path: "/production/stop-loss-report",
        label: "Stop Loss Report",
        component: StopLossReport,
      },
      {
        path: "/production/manpower-report",
        label: "Manpower Report",
        component: ManpowerReport,
      },
      {
        path: "/production/wip-capture",
        label: "WIP Capture",
        component: WIPCapture,
      },
    ],
  },

  // ── Quality ──────────────────────────────────────────────────────────────
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
      },
      {
        path: "/quality/gas-charging-report",
        label: "Gas Charging Report",
        component: GasChargingReport,
      },
      {
        path: "/quality/est-report",
        label: "EST Report",
        component: ESTReport,
      },
      {
        path: "/quality/cpt-report",
        label: "CPT Report",
        component: CPTReport,
      },
      {
        path: "/quality/fpa",
        label: "FPA",
        component: FPA,
      },
      {
        path: "/quality/fpa-report",
        label: "FPA Report",
        component: FPAReports,
      },
      {
        path: "/quality/fpa-history",
        label: "FPA History",
        component: FPAHistory,
      },
      {
        path: "/quality/fpa-defect-report",
        label: "FPA Defect Report",
        component: FPADefectReport,
      },
      {
        path: "/quality/lpt",
        label: "LPT",
        component: LPT,
      },
      {
        path: "/quality/lpt-report",
        label: "LPT Report",
        component: LPTReport,
      },
      {
        path: "/quality/mass-flow-report",
        label: "Mass Flow Report",
        component: MassFlowReport,
      },
      {
        path: "/quality/lpt-recipe",
        label: "LPT Recipe",
        component: LPTRecipe,
      },
      {
        path: "/quality/dispatch-hold",
        label: "Dispatch Hold",
        component: DispatchHold,
      },
      {
        path: "/quality/hold-cabinate-details",
        label: "Hold Cabinet Details",
        component: HoldCabinateDetails,
      },
      {
        path: "/quality/tag-update",
        label: "Tag Update",
        component: TagUpdate,
      },
      {
        path: "/quality/upload-bis-report",
        label: "Upload BIS Report",
        component: UploadBISReport,
      },
      {
        path: "/quality/bis-reports",
        label: "BIS Reports",
        component: BISReports,
      },
      {
        path: "/quality/bee-calculation",
        label: "BEE Calculation",
        component: BEECalculation,
      },
    ],
  },

  // ── Dispatch ─────────────────────────────────────────────────────────────
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
      },
      {
        path: "/dispatch/dispatch-report",
        label: "Dispatch Report",
        component: DispatchReport,
      },
      {
        path: "/dispatch/dispatch-unloading",
        label: "Dispatch Unloading",
        component: DispatchUnloading,
      },
      {
        path: "/dispatch/fg-casting",
        label: "FG Casting",
        component: FGCasting,
      },
      {
        path: "/dispatch/fg-dispatchReport",
        label: "FG Dispatch Report",
        component: FGDispatchReport,
      },
      {
        path: "/dispatch/gate-entry",
        label: "Gate Entry",
        component: GateEntry,
      },
      {
        path: "/dispatch/error-log",
        label: "Error Log",
        component: ErrorLog,
      },
      {
        path: "/dispatch/remove-error-serials",
        label: "Remove Error Serials",
        component: RemoveDispatchSerials,
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
      },
      {
        path: "/visitor/generate-pass",
        label: "Generate Pass",
        component: GeneratePass,
      },
      {
        path: "/visitor/in-out",
        label: "In / Out",
        component: InOut,
      },
      {
        path: "/visitor/reports",
        label: "Reports",
        component: Reports,
      },
      {
        path: "/visitor/history",
        label: "History",
        component: History,
      },
      {
        path: "/visitor/manage-employee",
        label: "Manage Employee",
        component: ManageEmployee,
      },
    ],
    hiddenItems: [
      {
        path: "/visitor-pass-display/:passId",
        component: VisitorPassDisplay,
      },
    ],
  },

  // ── Compliance ───────────────────────────────────────────────────────────
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
      },
    ],
  },

  // ── Audit Report ─────────────────────────────────────────────────────────
  {
    key: "auditReport",
    icon: ClipboardCheck,
    label: "Audit Report",
    basePath: "/auditreport",
    items: [
      {
        path: "/auditreport/templates",
        label: "Templates",
        component: TemplateList,
      },
      {
        path: "/auditreport/approval",
        label: "Template Approval",
        component: TemplateApproval,
      },
      {
        path: "/auditreport/serial-scan",
        label: "Serial Scan",
        component: SerialScan,
      },
      {
        path: "/auditreport/audits",
        label: "Audits",
        component: AuditList,
      },
      {
        path: "/auditreport/audit-approval",
        label: "Audit Approval",
        component: AuditApproval,
      },
      {
        path: "/auditreport/dashboard",
        label: "Dashboard",
        component: AuditDashboard,
      },
    ],
    hiddenItems: [
      {
        path: "/auditreport/templates/new",
        component: TemplateBuilder,
      },
      {
        path: "/auditreport/templates/:id/view",
        component: TemplateView,
      },
      {
        path: "/auditreport/templates/:id",
        component: TemplateBuilder,
      },
      {
        path: "/auditreport/audits/new",
        component: AuditEntry,
      },
      {
        path: "/auditreport/audits/:id",
        component: AuditEntry,
      },
      {
        path: "/auditreport/audits/:id/view",
        component: AuditView,
      },
    ],
  },


  // ── Utility / Readings ───────────────────────────────────────────────────
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
      },
    ],
  },

  // ── Apprentice Payroll ───────────────────────────────────────────────────
  {
    key: "apprentice",
    icon: FileText,
    label: "Apprentice Payroll",
    basePath: "/apprentice",
    items: [
      { path: "/apprentice/dashboard", label: "Dashboard",     component: ApprenticeDashboard },
      { path: "/apprentice/upload",    label: "Upload Files",  component: ApprenticeUpload    },
      { path: "/apprentice/slips",     label: "Salary Slips",  component: ApprenticeSlips     },
    ],
  },

  // ── Forms ────────────────────────────────────────────────────────────────
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
      },
      {
        path: "/forms/manpower-approval",
        label: "Manpower Approval",
        component: ManpowerApproval,
      },
      {
        path: "/forms/security-manpower",
        label: "Security Manpower List",
        component: SecurityManpowerList,
      },
      {
        path: "/forms/attendance",
        label: "Attendance Register",
        component: AttendanceRegister,
      },
      {
        path: "/forms/my-attendance",
        label: "My Attendance",
        component: MyAttendance,
      },
      {
        path: "/forms/attendance-dashboard",
        label: "Attendance Dashboard",
        component: AttendanceDashboard,
      },
      {
        path: "/forms/leave-application",
        label: "Leave Application",
        component: LeaveApplication,
      },
      {
        path: "/forms/leave-approval",
        label: "Leave Approval",
        component: LeaveApproval,
      },
    ],
  },
];
