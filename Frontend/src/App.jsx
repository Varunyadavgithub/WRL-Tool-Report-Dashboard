import { lazy, Suspense, useState } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSelector } from "react-redux";

// Lazy loaded components
const Layout = lazy(() => import("./components/Layout"));
const Login = lazy(() => import("./pages/Auth/Login"));
const Home = lazy(() => import("./pages/Home"));

const ProductionOverview = lazy(() => import("./pages/Production/Overview"));
const ComponentTraceabilityReport = lazy(
  () => import("./pages/Production/ComponentTraceabilityReport"),
);
const HourlyReport = lazy(() => import("./pages/Production/HourlyReport"));
const LineHourlyReport = lazy(
  () => import("./pages/Production/LineHourlyReport"),
);
const StageHistoryReport = lazy(
  () => import("./pages/Production/StageHistoryReport"),
);
const ModelNameUpdate = lazy(
  () => import("./pages/Production/ModelNameUpdate"),
);
const TotalProduction = lazy(
  () => import("./pages/Production/TotalProduction"),
);
const NFCReport = lazy(() => import("./pages/Production/NFCReport"));
const ComponentDetails = lazy(
  () => import("./pages/Production/ComponentDetails"),
);

const ReworkEntry = lazy(() => import("./pages/Quality/ReworkEntry"));
const ReworkReport = lazy(() => import("./pages/Quality/ReworkReport"));
const BrazingReport = lazy(() => import("./pages/Quality/BrazingReport"));
const GasChargingReport = lazy(
  () => import("./pages/Quality/GasChargingReport"),
);
const ESTReport = lazy(() => import("./pages/Quality/ESTReport"));
const CPTReport = lazy(() => import("./pages/Quality/CPTReport"));
const FPA = lazy(() => import("./pages/Quality/FPA"));
const FPAReports = lazy(() => import("./pages/Quality/FPAReports"));
const FPADefectReport = lazy(() => import("./pages/Quality/FPADefectReport"));
const LPT = lazy(() => import("./pages/Quality/LPT"));
const LPTReport = lazy(() => import("./pages/Quality/LPTReport"));
const DispatchHold = lazy(() => import("./pages/Quality/DispatchHold"));
const HoldCabinateDetails = lazy(
  () => import("./pages/Quality/HoldCabinateDetails"),
);

const DispatchPerformanceReport = lazy(
  () => import("./pages/Dispatch/DispatchPerformanceReport"),
);
const DispatchReport = lazy(() => import("./pages/Dispatch/DispatchReport"));
const DispatchUnloading = lazy(
  () => import("./pages/Dispatch/DispatchUnloading"),
);
const FGCasting = lazy(() => import("./pages/Dispatch/FGCasting"));
const GateEntry = lazy(() => import("./pages/Dispatch/GateEntry"));
const ErrorLog = lazy(() => import("./pages/Dispatch/ErrorLog"));

const FiveDaysPlaning = lazy(() => import("./pages/Planing/FiveDaysPlaning"));
const ProductionPlaning = lazy(
  () => import("./pages/Planing/ProductionPlaning"),
);
const DailyPlan = lazy(() => import("./pages/Planing/DailyPlan"));

const TagUpdate = lazy(() => import("./pages/Quality/TagUpdate"));
const LPTRecipe = lazy(() => import("./pages/Quality/LPTRecipe"));
const UploadBISReport = lazy(() => import("./pages/Quality/UploadBISReport"));
const BISReports = lazy(() => import("./pages/Quality/BISReports"));
const BISStatus = lazy(() => import("./pages/Quality/BISStatus"));
const BEECalculation = lazy(() => import("./pages/Quality/BEECalculation"));

const Dashboard = lazy(() => import("./pages/Visitor/Dashboard"));
const GeneratePass = lazy(() => import("./pages/Visitor/GeneratePass"));
const VisitorPassDisplay = lazy(
  () => import("./pages/Visitor/VisitorPassDisplay"),
);
const InOut = lazy(() => import("./pages/Visitor/InOut"));
const Reports = lazy(() => import("./pages/Visitor/Reports"));
const History = lazy(() => import("./pages/Visitor/History"));
const ManageEmployee = lazy(() => import("./pages/Visitor/ManageEmployee"));

const LogisticsDisplay = lazy(
  () => import("./pages/PerformanceDisplays/LogisticsDisplay"),
);

const Calibiration = lazy(() => import("./pages/Compliance/Calibration"));

const ManageTasks = lazy(() => import("./pages/TaskReminders/ManageTasks"));
const TaskOverview = lazy(() => import("./pages/TaskReminders/TaskOverview"));
// const AuditReportTemplate = lazy(
//   () => import("./pages/AuditReport/AuditReportTemplate"),
// );
// Audit Report Components
const TemplateList = lazy(() => import("./pages/AuditReport/TemplateList"));
const TemplateBuilder = lazy(
  () => import("./pages/AuditReport/TemplateBuilder"),
);
const AuditList = lazy(() => import("./pages/AuditReport/AuditList"));
const AuditEntry = lazy(() => import("./pages/AuditReport/AuditEntry"));
const AuditView = lazy(() => import("./pages/AuditReport/AuditView"));

const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => !prev);
  };

  const userRole = useSelector((state) => state.auth.user?.role || "");

  const canAccess = (allowedRoles) =>
    allowedRoles.includes(userRole) || userRole === "admin";
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
            {/*-------------------------------------------------------------- Production --------------------------------------------------------------*/}
            <Route
              path="/production/overview"
              element={<ProductionOverview />}
            />
            <Route
              path="/production/component-traceability-report"
              element={<ComponentTraceabilityReport />}
            />
            <Route
              path="/production/hourly-report"
              element={<HourlyReport />}
            />
            <Route
              path="/production/line-hourly-report"
              element={<LineHourlyReport />}
            />
            <Route
              path="/production/stage-history-report"
              element={<StageHistoryReport />}
            />
            {canAccess(["logistic"]) && (
              <Route
                path="/production/model-name-update"
                element={<ModelNameUpdate />}
              />
            )}
            <Route
              path="/production/component-details"
              element={<ComponentDetails />}
            />
            <Route
              path="/production/total-production"
              element={<TotalProduction />}
            />
            <Route path="/production/nfc-report" element={<NFCReport />} />
            {/*-------------------------------------------------------------- Quality --------------------------------------------------------------*/}
            {canAccess([]) && (
              <Route path="/quality/rework-entry" element={<ReworkEntry />} />
            )}
            {canAccess([]) && (
              <Route path="/quality/rework-report" element={<ReworkReport />} />
            )}
            {canAccess([]) && (
              <Route
                path="/quality/brazing-report"
                element={<BrazingReport />}
              />
            )}
            {canAccess([]) && (
              <Route
                path="/quality/gas-charging-report"
                element={<GasChargingReport />}
              />
            )}
            {canAccess([]) && (
              <Route path="/quality/est-report" element={<ESTReport />} />
            )}
            {canAccess([]) && (
              <Route path="/quality/cpt-report" element={<CPTReport />} />
            )}
            {canAccess(["fpa", "quality manager"]) && (
              <Route path="/quality/fpa" element={<FPA />} />
            )}
            <Route path="/quality/fpa-report" element={<FPAReports />} />
            <Route
              path="/quality/fpa-defect-report"
              element={<FPADefectReport />}
            />
            {canAccess(["line quality engineer", "quality manager", "lpt"]) && (
              <Route path="/quality/lpt" element={<LPT />} />
            )}
            {canAccess(["line quality engineer", "quality manager", "lpt"]) && (
              <Route path="/quality/lpt-report" element={<LPTReport />} />
            )}
            {canAccess(["line quality engineer", "quality manager", "lpt"]) && (
              <Route path="/quality/lpt-recipe" element={<LPTRecipe />} />
            )}
            {canAccess(["line quality engineer", "fpa", "quality manager"]) && (
              <Route path="/quality/dispatch-hold" element={<DispatchHold />} />
            )}
            <Route
              path="/quality/hold-cabinate-details"
              element={<HoldCabinateDetails />}
            />
            {canAccess(["line quality engineer", "quality manager"]) && (
              <Route path="/quality/tag-update" element={<TagUpdate />} />
            )}
            {canAccess(["bis engineer", "quality manager"]) && (
              <Route
                path="/quality/upload-bis-report"
                element={<UploadBISReport />}
              />
            )}{" "}
            {canAccess([
              "line quality engineer",
              "bis engineer",
              "fpa",
              "quality manager",
            ]) && (
              <Route path="/quality/bis-reports" element={<BISReports />} />
            )}
            {canAccess([
              "line quality engineer",
              "bis engineer",
              "fpa",
              "quality manager",
            ]) && <Route path="/quality/bis-status" element={<BISStatus />} />}
            {canAccess([
              "line quality engineer",
              "bis engineer",
              "fpa",
              "quality manager",
            ]) && (
              <Route
                path="/quality/bee-calculation"
                element={<BEECalculation />}
              />
            )}
            {/*-------------------------------------------------------------- Dispatch --------------------------------------------------------------*/}
            <Route
              path="/dispatch/dispatch-performance-report"
              element={<DispatchPerformanceReport />}
            />
            <Route
              path="/dispatch/dispatch-report"
              element={<DispatchReport />}
            />
            <Route
              path="/dispatch/dispatch-unloading"
              element={<DispatchUnloading />}
            />
            <Route path="/dispatch/fg-casting" element={<FGCasting />} />
            {canAccess(["gate entry user"]) && (
              <Route path="/dispatch/gate-entry" element={<GateEntry />} />
            )}
            <Route path="/dispatch/error-log" element={<ErrorLog />} />
            {/*-------------------------------------------------------------- Planing --------------------------------------------------------------*/}
            {canAccess(["production manager", "planning team"]) && (
              <Route
                path="/planing/production-planing"
                element={<ProductionPlaning />}
              />
            )}
            <Route
              path="/planing/5-days-planing"
              element={<FiveDaysPlaning />}
            />
            <Route path="/planing/daily-planing" element={<DailyPlan />} />
            {/*-------------------------------------------------------------- Visitor --------------------------------------------------------------*/}
            {canAccess(["admin", "security", "hr"]) && (
              <Route path="/visitor/dashboard" element={<Dashboard />} />
            )}
            {canAccess(["admin", "security", "hr"]) && (
              <Route path="/visitor/generate-pass" element={<GeneratePass />} />
            )}
            {canAccess(["admin", "security", "hr"]) && (
              <Route
                path="/visitor-pass-display/:passId"
                element={<VisitorPassDisplay />}
              />
            )}
            {canAccess(["admin", "security", "hr"]) && (
              <Route path="/visitor/in-out" element={<InOut />} />
            )}
            {canAccess(["admin", "security", "hr"]) && (
              <Route path="/visitor/reports" element={<Reports />} />
            )}
            {canAccess(["admin", "security", "hr"]) && (
              <Route path="/visitor/history" element={<History />} />
            )}
            {canAccess(["admin", "hr"]) && (
              <Route
                path="/visitor/manage-employee"
                element={<ManageEmployee />}
              />
            )}
            {/*-------------------------------------------------------------- Performance Displays --------------------------------------------------------------*/}
            {canAccess(["admin"]) && (
              <Route
                path="/displays/logistics"
                element={<LogisticsDisplay />}
              />
            )}
            {/*-------------------------------------------------------------- Compliance --------------------------------------------------------------*/}
            {canAccess(["admin"]) && (
              <Route
                path="/compliance/calibiration"
                element={<Calibiration />}
              />
            )}
            {/*-------------------------------------------------------------- Task Reminders --------------------------------------------------------------*/}
            {canAccess(["admin"]) && (
              <Route path="/reminder/tasks" element={<ManageTasks />} />
            )}
            {canAccess(["admin"]) && (
              <Route path="/reminder/overview" element={<TaskOverview />} />
            )}
            {/*-------------------------------------------------------------- Audit Report --------------------------------------------------------------*/}
            {/* {canAccess(["admin"]) && (
              <Route
                path="/auditreport/template"
                element={<AuditReportTemplate />}
              />
            )} */}
            {canAccess(["admin", "quality manager"]) && (
              <>
                <Route
                  path="/auditreport/templates"
                  element={<TemplateList />}
                />
                <Route
                  path="/auditreport/templates/new"
                  element={<TemplateBuilder />}
                />
                <Route
                  path="/auditreport/templates/:id"
                  element={<TemplateBuilder />}
                />
                <Route path="/auditreport/audits" element={<AuditList />} />
                <Route
                  path="/auditreport/audits/new"
                  element={<AuditEntry />}
                />
                <Route
                  path="/auditreport/audits/:id"
                  element={<AuditEntry />}
                />
                <Route
                  path="/auditreport/audits/:id/view"
                  element={<AuditView />}
                />
              </>
            )}
            {/*-------------------------------------------------------------- Catch All --------------------------------------------------------------*/}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
