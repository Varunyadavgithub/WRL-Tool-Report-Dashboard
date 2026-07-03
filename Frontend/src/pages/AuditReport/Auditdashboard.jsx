// ──────────────────────────────────────────────────────────────────────────
// Audit Dashboard — page shell only. All data-fetching lives in
// useDashboardData, all section rendering lives in components/dashboard/*.
// This file's only job is composition + layout, which is what makes it
// readable at a glance instead of requiring a 500-line scroll.
// ──────────────────────────────────────────────────────────────────────────
import { FaSync } from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";

import useDashboardData from "./hooks/useDashboardData";
import { PageHeader, SecondaryButton } from "./components/common";
import KpiSection from "./components/dashboard/KpiSection";
import CheckpointBreakdownCard from "./components/dashboard/CheckpointBreakdownCard";
import AuditStatusBreakdownCard from "./components/dashboard/AuditStatusBreakdownCard";
import ModelSummaryTable from "./components/dashboard/ModelSummaryTable";
import TopPendingModelsCard from "./components/dashboard/TopPendingModelsCard";
import RecentAuditsTable from "./components/dashboard/RecentAuditsTable";

const AuditDashboard = () => {
  const {
    loading,
    lastRefreshed,
    refresh,
    stats,
    cpAgg,
    cpPassRate,
    modelSummary,
    modelTotals,
    topPendingModels,
    recentAudits,
  } = useDashboardData();

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <PageHeader
        icon={HiClipboardDocumentCheck}
        title="Audit Dashboard"
        meta={lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : undefined}
        actions={
          <SecondaryButton icon={FaSync} onClick={refresh} disabled={loading}>
            Refresh
          </SecondaryButton>
        }
      />

      <div className="w-full px-6 py-5 space-y-5">
        <KpiSection loading={loading} stats={stats} cpPassRate={cpPassRate} cpTotal={cpAgg.total} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <CheckpointBreakdownCard loading={loading} cpAgg={cpAgg} cpPassRate={cpPassRate} />
          <AuditStatusBreakdownCard loading={loading} stats={stats} />
        </div>

        <ModelSummaryTable loading={loading} modelSummary={modelSummary} modelTotals={modelTotals} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <TopPendingModelsCard loading={loading} topPendingModels={topPendingModels} />
          <RecentAuditsTable loading={loading} recentAudits={recentAudits} />
        </div>
      </div>
    </div>
  );
};

export default AuditDashboard;
