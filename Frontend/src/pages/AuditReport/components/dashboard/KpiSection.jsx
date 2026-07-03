// ──────────────────────────────────────────────────────────────────────────
// The 6-tile KPI row at the top of the dashboard.
// ──────────────────────────────────────────────────────────────────────────
import {
  FaClipboardList,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaClipboardCheck,
  FaChartBar,
} from "react-icons/fa";
import { KpiCard, KpiSkeletonRow } from "../../components/common";

export default function KpiSection({ loading, stats, cpPassRate, cpTotal }) {
  if (loading) return <KpiSkeletonRow count={6} />;

  const { totalAudits, approvedCount, submittedCount, rejectedCount, draftCount, approvalRate } = stats;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        label="Total Audits"
        value={totalAudits}
        icon={FaClipboardList}
        iconCls="text-indigo-400"
        bg="bg-indigo-50"
        border="border-indigo-100"
        valueCls="text-indigo-700"
        sub={`${approvalRate}% approval rate`}
      />
      <KpiCard
        label="Approved"
        value={approvedCount}
        icon={FaCheckCircle}
        iconCls="text-emerald-500"
        bg="bg-emerald-50"
        border="border-emerald-100"
        valueCls="text-emerald-700"
        sub="Fully reviewed & signed off"
      />
      <KpiCard
        label="Pending Review"
        value={submittedCount}
        icon={FaHourglassHalf}
        iconCls="text-amber-500"
        bg="bg-amber-50"
        border="border-amber-100"
        valueCls="text-amber-700"
        sub="Awaiting LQE decision"
      />
      <KpiCard
        label="Rejected"
        value={rejectedCount}
        icon={FaTimesCircle}
        iconCls="text-red-400"
        bg="bg-red-50"
        border="border-red-100"
        valueCls="text-red-600"
        sub="Returned for correction"
      />
      <KpiCard
        label="Draft"
        value={draftCount}
        icon={FaClipboardCheck}
        iconCls="text-slate-400"
        bg="bg-slate-50"
        border="border-slate-200"
        valueCls="text-slate-600"
        sub="Not yet submitted"
      />
      <KpiCard
        label="Pass Rate (CPs)"
        value={`${cpPassRate}%`}
        icon={FaChartBar}
        iconCls="text-blue-400"
        bg="bg-blue-50"
        border="border-blue-100"
        valueCls="text-blue-700"
        sub={`${cpTotal.toLocaleString()} total checkpoints`}
      />
    </div>
  );
}
