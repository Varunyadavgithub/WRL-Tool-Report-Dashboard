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
  Cog,
  Settings2,
  BarChart2,
  Shield,
  Activity,
  Network,
  Users,
  Clock,
  BookOpen,
  Database,
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
const LineWiseReport = lazy(
  () => import("../pages/Production/LineWiseReport"),
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
const TemplateCompare = lazy(
  () => import("../pages/AuditReport/Template/TemplateCompare"),
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

// ── Master Config ─────────────────────────────────────────────────────────────
const MasterConfigOverview = lazy(() => import("../pages/MasterConfig/Overview"));
const MaterialConfig       = lazy(() => import("../pages/MasterConfig/MaterialConfig"));
const CheckpointLibraryConfig = lazy(() => import("../pages/MasterConfig/CheckpointLibraryConfig"));
const ShiftConfig          = lazy(() => import("../pages/MasterConfig/ShiftConfig"));
const DowntimeConfig       = lazy(() => import("../pages/MasterConfig/DowntimeConfig"));
const QualityConfig        = lazy(() => import("../pages/MasterConfig/QualityConfig"));
const MachineConfig        = lazy(() => import("../pages/MasterConfig/MachineConfig"));
const PlanningConfig       = lazy(() => import("../pages/MasterConfig/PlanningConfig"));
const MailConfig           = lazy(() => import("../pages/MasterConfig/MailConfig"));
const AuditTrail           = lazy(() => import("../pages/MasterConfig/AuditTrail"));

// ── Part Process ──────────────────────────────────────────────────────────────
const PartProcessOverview      = lazy(() => import("../pages/PartProcess/Overview"));
const PartProcessDashboard     = lazy(() => import("../pages/PartProcess/Dashboard"));
const PartProcessProductionReport = lazy(() => import("../pages/PartProcess/ProductionReport"));
const PartProcessHourlyReport  = lazy(() => import("../pages/PartProcess/HourlyReport"));
const PartProcessQualityReport = lazy(() => import("../pages/PartProcess/QualityReport"));
const PartProcessDowntimeReport = lazy(() => import("../pages/PartProcess/DowntimeReport"));
const FactoryMonitor           = lazy(() => import("../pages/PartProcess/FactoryMonitor"));
const FactoryOsSyncLog         = lazy(() => import("../pages/PartProcess/FactoryOsSyncLog"));
const PartProcessOEEReport     = lazy(() => import("../pages/PartProcess/OEEReport"));

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
    subgroupConfig: [
      { key: "operations", label: "Operations" },
      { key: "reports",    label: "Reports" },
      { key: "traceability", label: "Traceability" },
    ],
    items: [
      { path: "/production/overview",                    label: "Production Report",             component: ProductionOverview,             group: "operations" },
      { path: "/production/wip-capture",                 label: "WIP Capture",                   component: WIPCapture,                     group: "operations" },
      { path: "/production/model-name-update",           label: "Model Name Update",              component: ModelNameUpdate,                group: "operations" },
      { path: "/production/hourly-report",               label: "Hourly Report",                 component: HourlyReport,                   group: "reports" },
      { path: "/production/line-hourly-report",          label: "Line Hourly Report",             component: LineHourlyReport,               group: "reports" },
      { path: "/production/line-wise-report",            label: "Line Wise Report",               component: LineWiseReport,                 group: "reports" },
      { path: "/production/consolidated-report",         label: "Consolidated Report",            component: ConsolidatedReport,             group: "reports" },
      { path: "/production/nfc-report",                  label: "NFC Report",                    component: NFCReport,                      group: "reports" },
      { path: "/production/total-production",            label: "Total Production",               component: TotalProduction,                group: "reports" },
      { path: "/production/stop-loss-report",            label: "Stop Loss Report",               component: StopLossReport,                 group: "reports" },
      { path: "/production/manpower-report",             label: "Manpower Report",               component: ManpowerReport,                 group: "reports" },
      { path: "/production/component-traceability-report", label: "Component Traceability Report", component: ComponentTraceabilityReport,  group: "traceability" },
    ],
  },

  // ── Master Config ────────────────────────────────────────────────────────
  {
    key: "masterConfig",
    icon: Settings2,
    label: "Master Config",
    basePath: "/master-config",
    subgroupConfig: [
      { key: "config", label: "Configuration" },
      { key: "admin",  label: "Admin" },
    ],
    items: [
      { path: "/master-config/overview",            label: "Overview",                 component: MasterConfigOverview,      group: "admin"   },
      { path: "/master-config/mail",                label: "Mail & Notifications",     component: MailConfig,                group: "admin"   },
      { path: "/master-config/audit",               label: "Audit Trail",              component: AuditTrail,                group: "admin"   },
      { path: "/master-config/material",            label: "Material",                 component: MaterialConfig,            group: "config"  },
      { path: "/master-config/checkpoint-library",  label: "Checkpoint Library",       component: CheckpointLibraryConfig,   group: "config"  },
      { path: "/master-config/shift",               label: "Shift",                    component: ShiftConfig,               group: "config"  },
      { path: "/master-config/downtime",            label: "Downtime",                 component: DowntimeConfig,            group: "config"  },
      { path: "/master-config/quality",             label: "Quality",                  component: QualityConfig,             group: "config"  },
      { path: "/master-config/machine",             label: "Machine",                  component: MachineConfig,             group: "config"  },
      { path: "/master-config/planning",            label: "Planning",                 component: PlanningConfig,            group: "config"  },
    ],
  },

  // ── Part Process ─────────────────────────────────────────────────────────
  {
    key: "partProcess",
    icon: Cog,
    label: "Part Process",
    basePath: "/part-process",
    items: [
      {
        path: "/part-process/overview",
        label: "Overview",
        component: PartProcessOverview,
      },
      {
        path: "/part-process/production-report",
        label: "Production Report",
        component: PartProcessProductionReport,
      },
      {
        path: "/part-process/hourly-report",
        label: "Hourly Report",
        component: PartProcessHourlyReport,
      },
      {
        path: "/part-process/quality-report",
        label: "Quality Report",
        component: PartProcessQualityReport,
      },
      {
        path: "/part-process/downtime-report",
        label: "Downtime Report",
        component: PartProcessDowntimeReport,
      },
      {
        path: "/part-process/oee-report",
        label: "OEE Report",
        component: PartProcessOEEReport,
      },
      {
        path: "/part-process/factory-monitor",
        label: "Factory Monitor",
        component: FactoryMonitor,
      },
      {
        path: "/part-process/factoryos-sync-log",
        label: "FactoryOS Sync Log",
        component: FactoryOsSyncLog,
      },
    ],
    hiddenItems: [
      {
        path: "/part-process/dashboard",
        component: PartProcessDashboard,
      },
    ],
  },

  // ── Quality ──────────────────────────────────────────────────────────────
  {
    key: "quality",
    icon: ShieldCheck,
    label: "Quality",
    basePath: "/quality",
    subgroupConfig: [
      { key: "general", label: "General" },
      { key: "lpt",     label: "LPT" },
      { key: "fpa",     label: "FPA" },
      { key: "bis",     label: "BIS" },
    ],
    items: [
      { path: "/quality/rework-report",       label: "Rework Report",       component: ReworkReport,       group: "general" },
      { path: "/quality/gas-charging-report", label: "Gas Charging Report", component: GasChargingReport,  group: "general" },
      { path: "/quality/est-report",          label: "EST Report",          component: ESTReport,          group: "general" },
      { path: "/quality/cpt-report",          label: "CPT Report",          component: CPTReport,          group: "general" },
      { path: "/quality/dispatch-hold",       label: "Dispatch Hold",       component: DispatchHold,       group: "general" },
      { path: "/quality/hold-cabinate-details", label: "Hold Cabinet Details", component: HoldCabinateDetails, group: "general" },
      { path: "/quality/tag-update",          label: "Tag Update",          component: TagUpdate,          group: "general" },
      { path: "/quality/lpt",                 label: "LPT",                 component: LPT,                group: "lpt" },
      { path: "/quality/lpt-report",          label: "LPT Report",          component: LPTReport,          group: "lpt" },
      { path: "/quality/lpt-recipe",          label: "LPT Recipe",          component: LPTRecipe,          group: "lpt" },
      { path: "/quality/mass-flow-report",    label: "Mass Flow Report",    component: MassFlowReport,     group: "lpt" },
      { path: "/quality/fpa",                 label: "FPA",                 component: FPA,                group: "fpa" },
      { path: "/quality/fpa-report",          label: "FPA Report",          component: FPAReports,         group: "fpa" },
      { path: "/quality/fpa-history",         label: "FPA History",         component: FPAHistory,         group: "fpa" },
      { path: "/quality/fpa-defect-report",   label: "FPA Defect Report",   component: FPADefectReport,    group: "fpa" },
      { path: "/quality/upload-bis-report",   label: "Upload BIS Report",   component: UploadBISReport,    group: "bis" },
      { path: "/quality/bis-reports",         label: "BIS Reports",         component: BISReports,         group: "bis" },
      { path: "/quality/bee-calculation",     label: "BEE Calculation",     component: BEECalculation,     group: "bis" },
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
    subgroupConfig: [
      { key: "templates", label: "Templates" },
      { key: "audits",    label: "Audits" },
    ],
    items: [
      { path: "/auditreport/templates",      label: "Templates",         component: TemplateList,     group: "templates" },
      { path: "/auditreport/approval",       label: "Template Approval", component: TemplateApproval, group: "templates" },
      { path: "/auditreport/serial-scan",    label: "Serial Scan",       component: SerialScan,       group: "templates" },
      { path: "/auditreport/audits",         label: "Audits",            component: AuditList,        group: "audits" },
      { path: "/auditreport/audit-approval", label: "Audit Approval",    component: AuditApproval,    group: "audits" },
      { path: "/auditreport/dashboard",      label: "Dashboard",         component: AuditDashboard,   group: "audits" },
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
        path: "/auditreport/templates/:id/compare",
        component: TemplateCompare,
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
    subgroupConfig: [
      { key: "hr",         label: "HR & Manpower" },
      { key: "attendance", label: "Attendance" },
    ],
    items: [
      { path: "/forms/manpower-form",        label: "Manpower Form",          component: ManpowerForm,          group: "hr" },
      { path: "/forms/manpower-approval",    label: "Manpower Approval",      component: ManpowerApproval,      group: "hr" },
      { path: "/forms/security-manpower",    label: "Security Manpower List", component: SecurityManpowerList,  group: "hr" },
      { path: "/forms/attendance",           label: "Attendance Register",    component: AttendanceRegister,    group: "attendance" },
      { path: "/forms/my-attendance",        label: "My Attendance",          component: MyAttendance,          group: "attendance" },
      { path: "/forms/attendance-dashboard", label: "Attendance Dashboard",   component: AttendanceDashboard,   group: "attendance" },
      { path: "/forms/leave-application",    label: "Leave Application",      component: LeaveApplication,      group: "attendance" },
      { path: "/forms/leave-approval",       label: "Leave Approval",         component: LeaveApproval,         group: "attendance" },
    ],
  },
];
