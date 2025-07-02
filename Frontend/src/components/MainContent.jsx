import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home";

import ProductionOverview from "../pages/Production/Overview";
import ComponentTraceabilityReport from "../pages/Production/ComponentTraceabilityReport";
import HourlyReport from "../pages/Production/HourlyReport";
import LineHourlyReport from "../pages/Production/LineHourlyReport";
import StageHistoryReport from "../pages/Production/StageHistoryReport";
import ModelNameUpdate from "../pages/Production/ModelNameUpdate";
import TotalProduction from "../pages/Production/TotalProduction";

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

import ProductionPlaning from "../pages/Planing/ProductionPlaning";
import FiveDaysPlaning from "../pages/Planing/FiveDaysPlaning";
import { useSelector } from "react-redux";
import NotFound from "../pages/NotFound";
import ComponentDetails from "../pages/Production/ComponentDetails";
import TagUpdate from "../pages/Quality/TagUpdate";
import LPTRecipe from "../pages/Quality/LPTRecipe";
import UploadBISReport from "../pages/Quality/UploadBISReport";
import BISReports from "../pages/Quality/BISReports";
import BISStatus from "../pages/Quality/BISStatus";

import Dashboard from "../pages/Reminder/Dashboard";
import Tasks from "../pages/Reminder/Tasks";
import DailyPlan from "../pages/Planing/DailyPlan";
import VisitorPass from "../pages/Visitor/VisitorPass";

function MainContent() {
  const userRole = useSelector((state) => state.auth.user?.role || "");

  const canAccess = (allowedRoles) =>
    allowedRoles.includes(userRole) || userRole === "admin";

  return (
    <div className="flex-1 p-4 min-h-screen overflow-auto">
      <Routes>
        <Route path="/" index element={<Home />} />
        {/* Production */}
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
        {/* 🚫 Restricted Route: Only Logistic and Admin */}
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
        {/* Quality */}
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
        {/* 🚫 Restricted Route: Only FPA, Quality Manager and Admin */}
        {canAccess(["fpa", "quality manager"]) && (
          <Route path="/quality/fpa" element={<FPA />} />
        )}
        <Route path="/quality/fpa-report" element={<FPAReports />} />
        {/* 🚫 Restricted Route: Only Line Quality Engineer, Quality Manager, Lpt and Admin */}
        {canAccess(["line quality engineer", "quality manager", "lpt"]) && (
          <Route path="/quality/lpt" element={<LPT />} />
        )}
        {canAccess(["line quality engineer", "quality manager", "lpt"]) && (
          <Route path="/quality/lpt-report" element={<LPTReport />} />
        )}
        {/* 🚫 Restricted Route: Only Line Quality Engineer and Admin */}
        {canAccess(["line quality engineer"]) && (
          <Route path="/quality/lpt-recipe" element={<LPTRecipe />} />
        )}
        {/* 🚫 Restricted Route: Only Line Quality Engineer, Quality Manager and Admin */}
        {canAccess(["line quality engineer", "fpa", "quality manager"]) && (
          <Route path="/quality/dispatch-hold" element={<DispatchHold />} />
        )}
        <Route
          path="/quality/hold-cabinate-details"
          element={<HoldCabinateDetails />}
        />
        {/* 🚫 Restricted Route: Only Line Quality Engineer, Quality Manager and Admin */}
        {canAccess(["line quality engineer", "quality manager"]) && (
          <Route path="/quality/tag-update" element={<TagUpdate />} />
        )}
        {/* 🚫 Restricted Route: Only BIS Engineer, Quality Manager and Admin */}
        {canAccess(["bis engineer", "quality manager"]) && (
          <Route
            path="/quality/upload-bis-report"
            element={<UploadBISReport />}
          />
        )}{" "}
        {/* 🚫 Restricted Route: Only Line Quality Engineer, FPA, Quality Manager and Admin */}
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
        {/* Dispatch */}
        <Route
          path="/dispatch/dispatch-performance-report"
          element={<DispatchPerformanceReport />}
        />
        <Route path="/dispatch/dispatch-report" element={<DispatchReport />} />
        <Route
          path="/dispatch/dispatch-unloading"
          element={<DispatchUnloading />}
        />
        {/* 🚫 Restricted Route: Only Logistic and Admin */}
        {canAccess(["logistic"]) && (
          <Route path="/dispatch/fg-casting" element={<FGCasting />} />
        )}
        <Route path="/dispatch/gate-entry" element={<GateEntry />} />
        {/* 🚫 Restricted Route: Only Logistic and Admin */}
        {canAccess(["logistic"]) && (
          <Route path="/dispatch/error-log" element={<ErrorLog />} />
        )}
        {/* Planing */}
        {/* 🚫 Restricted Route: Only Production Manager, Planning Team and Admin */}
        {canAccess(["production manager", "planning team"]) && (
          <Route
            path="/planing/production-planing"
            element={<ProductionPlaning />}
          />
        )}
        <Route path="/planing/5-days-planing" element={<FiveDaysPlaning />} />
        <Route path="/planing/daily-planing" element={<DailyPlan />} />
        {/* Reminder */}
        {canAccess(["admin"]) && (
          <Route path="/reminder/dashboard" element={<Dashboard />} />
        )}
        {canAccess(["admin"]) && (
          <Route path="/reminder/tasks" element={<Tasks />} />
        )}
        {/* Visitor */}
        {canAccess(["admin"]) && (
          <Route path="/visitor/pass" element={<VisitorPass />} />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default MainContent;
