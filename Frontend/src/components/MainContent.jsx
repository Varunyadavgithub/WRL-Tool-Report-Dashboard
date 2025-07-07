import { Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";

import Home from "../pages/Home";

import ProductionOverview from "../pages/Production/Overview";
import ComponentTraceabilityReport from "../pages/Production/ComponentTraceabilityReport";
import HourlyReport from "../pages/Production/HourlyReport";
import LineHourlyReport from "../pages/Production/LineHourlyReport";
import StageHistoryReport from "../pages/Production/StageHistoryReport";
import ModelNameUpdate from "../pages/Production/ModelNameUpdate";
import TotalProduction from "../pages/Production/TotalProduction";
import ComponentDetails from "../pages/Production/ComponentDetails";

import ReworkReport from "../pages/Quality/ReworkReport";
import BrazingReport from "../pages/Quality/BrazingReport";
import GasChargingReport from "../pages/Quality/GasChargingReport";
import ESTReport from "../pages/Quality/ESTReport";
import MFTReport from "../pages/Quality/MFTReport";
import FPA from "../pages/Quality/FPA";
import FPAReports from "../pages/Quality/FPAReports";
import LPT from "../pages/Quality/LPT";
import LPTReport from "../pages/Quality/LPTReport";
import DispatchHold from "../pages/Quality/DispatchHold";
import HoldCabinateDetails from "../pages/Quality/HoldCabinateDetails";

import DispatchPerformanceReport from "../pages/Dispatch/DispatchPerformanceReport";
import DispatchReport from "../pages/Dispatch/DispatchReport";
import DispatchUnloading from "../pages/Dispatch/DispatchUnloading";
import FGCasting from "../pages/Dispatch/FGCasting";
import GateEntry from "../pages/Dispatch/GateEntry";
import ErrorLog from "../pages/Dispatch/ErrorLog";

import FiveDaysPlaning from "../pages/Planing/FiveDaysPlaning";
import ProductionPlaning from "../pages/Planing/ProductionPlaning";
import DailyPlan from "../pages/Planing/DailyPlan";

import TagUpdate from "../pages/Quality/TagUpdate";
import LPTRecipe from "../pages/Quality/LPTRecipe";
import UploadBISReport from "../pages/Quality/UploadBISReport";
import BISReports from "../pages/Quality/BISReports";
import BISStatus from "../pages/Quality/BISStatus";

import Dashboard from "../pages/Reminder/Dashboard";
import Tasks from "../pages/Reminder/Tasks";

import VisitorPass from "../pages/Visitor/VisitorPass";
import ManageEmployee from "../pages/Visitor/ManageEmployee";
import VisitorDashboard from "../pages/Visitor/Dashboard";
import VisitorReports from "../pages/Visitor/Reports";

import NotFound from "../pages/NotFound";

function MainContent() {
  const userRole = useSelector((state) => state.auth.user?.role || "");

  const canAccess = (allowedRoles) =>
    allowedRoles.includes(userRole) || userRole === "admin";

  return (
    <div className="flex-1 p-4 min-h-screen overflow-auto">
      <Routes>
        <Route path="/" index element={<Home />} />
        {/*-------------------------------------------------------------- Production --------------------------------------------------------------*/}
        <Route path="/production/overview" element={<ProductionOverview />} />
        <Route
          path="/production/component-traceability-report"
          element={<ComponentTraceabilityReport />}
        />
        <Route path="/production/hourly-report" element={<HourlyReport />} />
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
        {/*-------------------------------------------------------------- Quality --------------------------------------------------------------*/}
        {canAccess([]) && (
          <Route path="/quality/rework-report" element={<ReworkReport />} />
        )}
        {canAccess([]) && (
          <Route path="/quality/brazing-report" element={<BrazingReport />} />
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
          <Route path="/quality/mft-report" element={<MFTReport />} />
        )}
        {canAccess(["fpa", "quality manager"]) && (
          <Route path="/quality/fpa" element={<FPA />} />
        )}
        <Route path="/quality/fpa-report" element={<FPAReports />} />
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
        ]) && <Route path="/quality/bis-reports" element={<BISReports />} />}
        {canAccess([
          "line quality engineer",
          "bis engineer",
          "fpa",
          "quality manager",
        ]) && <Route path="/quality/bis-status" element={<BISStatus />} />}
        {/*-------------------------------------------------------------- Dispatch --------------------------------------------------------------*/}
        <Route
          path="/dispatch/dispatch-performance-report"
          element={<DispatchPerformanceReport />}
        />
        <Route path="/dispatch/dispatch-report" element={<DispatchReport />} />
        <Route
          path="/dispatch/dispatch-unloading"
          element={<DispatchUnloading />}
        />
        {canAccess(["logistic"]) && (
          <Route path="/dispatch/fg-casting" element={<FGCasting />} />
        )}
        <Route path="/dispatch/gate-entry" element={<GateEntry />} />
        {canAccess(["logistic"]) && (
          <Route path="/dispatch/error-log" element={<ErrorLog />} />
        )}
        {/*-------------------------------------------------------------- Planing --------------------------------------------------------------*/}
        {canAccess(["production manager", "planning team"]) && (
          <Route
            path="/planing/production-planing"
            element={<ProductionPlaning />}
          />
        )}
        <Route path="/planing/5-days-planing" element={<FiveDaysPlaning />} />
        <Route path="/planing/daily-planing" element={<DailyPlan />} />
        {/*-------------------------------------------------------------- Reminder --------------------------------------------------------------*/}
        {canAccess(["admin"]) && (
          <Route path="/reminder/dashboard" element={<Dashboard />} />
        )}
        {canAccess(["admin"]) && (
          <Route path="/reminder/tasks" element={<Tasks />} />
        )}
        {/*-------------------------------------------------------------- Visitor --------------------------------------------------------------*/}
        {canAccess(["admin"]) && (
          <Route path="/visitor/generate-pass" element={<VisitorPass />} />
        )}
        {canAccess(["admin"]) && (
          <Route path="/visitor/manage-employee" element={<ManageEmployee />} />
        )}
        {canAccess(["admin"]) && (
          <Route path="/visitor/dashboard" element={<VisitorDashboard />} />
        )}
        {canAccess(["admin"]) && (
          <Route path="/visitor/reports" element={<VisitorReports />} />
        )}
        {/*-------------------------------------------------------------- Catch All --------------------------------------------------------------*/}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default MainContent;
