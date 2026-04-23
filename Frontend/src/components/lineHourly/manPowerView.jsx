/**
 * ManpowerView.jsx
 *
 * Manpower attendance report panel.
 * Receives `data` (raw rows from /prod/manpower-report).
 * Shows:
 *   - KPI strip  (total, contractors, departments, shifts)
 *   - Contractor-wise summary cards
 *   - Searchable / filterable detail table with dept + shift badges
 */

import { useMemo, useState } from "react";
import {
  Users,
  Building2,
  Clock,
  LogIn,
  LogOut,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  SunMedium,
  Moon,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmtDT = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
};

const fmtTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
};

// duration in hours between two datetime strings
const durationHrs = (inDT, outDT) => {
  if (!outDT) return null;
  try {
    const diff = (new Date(outDT) - new Date(inDT)) / 3_600_000;
    if (diff < 0) return null;
    return diff.toFixed(1);
  } catch {
    return null;
  }
};

// palette for contractor badges
const CONTRACTOR_COLORS = [
  { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
  { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
  { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  { bg: "#f0fdf4", text: "#14532d", border: "#86efac" },
  { bg: "#fdf2f8", text: "#831843", border: "#f9a8d4" },
];

// ── KPI card ─────────────────────────────────────────────────────────────────

const KPI = ({ icon: Icon, label, value, color = "#4f46e5", sub }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white shadow-sm flex-1 min-w-[120px]">
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `${color}18` }}
    >
      <Icon size={16} style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none mb-1">
        {label}
      </div>
      <div
        className="text-xl font-extrabold leading-none"
        style={{ color: "#0f172a" }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ── Contractor summary card ───────────────────────────────────────────────────

const ContractorCard = ({ name, count, palette, present, absent }) => (
  <div
    className="rounded-xl border px-4 py-3 flex flex-col gap-1 min-w-[180px]"
    style={{ background: palette.bg, borderColor: palette.border }}
  >
    <div
      className="text-[11px] font-bold truncate"
      style={{ color: palette.text }}
      title={name}
    >
      {name}
    </div>
    <div className="flex items-end gap-2">
      <span
        className="text-2xl font-extrabold leading-none"
        style={{ color: palette.text }}
      >
        {count}
      </span>
      <span className="text-[10px] text-slate-400 mb-0.5 leading-tight">
        workers
      </span>
    </div>
    <div className="flex gap-2 mt-1">
      {present !== undefined && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
          {present} in
        </span>
      )}
      {absent !== undefined && absent > 0 && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
          {absent} pending out
        </span>
      )}
    </div>
  </div>
);

// ── Main ManpowerView ─────────────────────────────────────────────────────────

const ManpowerView = ({ data = [], loading = false }) => {
  const [search, setSearch] = useState("");
  const [filterContractor, setFilterContractor] = useState("All");
  const [filterShift, setFilterShift] = useState("All");
  const [sortKey, setSortKey] = useState("CheckIn");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedContractor, setExpandedContractor] = useState(null);

  // ── derived ────────────────────────────────────────────────────────────────

  const contractors = useMemo(
    () => ["All", ...new Set(data.map((r) => r.Contractor).filter(Boolean))],
    [data],
  );
  const shifts = useMemo(
    () => ["All", ...new Set(data.map((r) => r.Shift).filter(Boolean))],
    [data],
  );

  const contractorMap = useMemo(() => {
    const m = {};
    data.forEach((r) => {
      const c = r.Contractor || "Unknown";
      if (!m[c]) m[c] = { total: 0, present: 0, pendingOut: 0 };
      m[c].total += 1;
      if (r.CheckIn) m[c].present += 1;
      if (!r.CheckOut) m[c].pendingOut += 1;
    });
    return m;
  }, [data]);

  const deptMap = useMemo(() => {
    const m = {};
    data.forEach((r) => {
      const d = r.Department || "N/A";
      m[d] = (m[d] || 0) + 1;
    });
    return m;
  }, [data]);

  const shiftMap = useMemo(() => {
    const m = {};
    data.forEach((r) => {
      const s = r.Shift || "Unknown";
      m[s] = (m[s] || 0) + 1;
    });
    return m;
  }, [data]);

  const pendingOut = useMemo(
    () => data.filter((r) => !r.CheckOut).length,
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data;
    if (filterContractor !== "All")
      rows = rows.filter((r) => r.Contractor === filterContractor);
    if (filterShift !== "All")
      rows = rows.filter((r) => r.Shift === filterShift);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.WorkmenName?.toLowerCase().includes(q) ||
          r.Contractor?.toLowerCase().includes(q) ||
          r.Department?.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data, filterContractor, filterShift, search, sortKey, sortAsc]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }) =>
    sortKey === col ? (
      sortAsc ? (
        <ChevronUp size={10} className="inline ml-0.5" />
      ) : (
        <ChevronDown size={10} className="inline ml-0.5" />
      )
    ) : null;

  // ── CSV export ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!filtered.length) return;
    const rows = [
      ["Contractor", "Name", "Department", "Shift", "Check-In", "Check-Out", "Duration (hrs)"],
      ...filtered.map((r) => [
        r.Contractor || "",
        r.WorkmenName || "",
        r.Department || "",
        r.Shift || "",
        r.CheckIn ? new Date(r.CheckIn).toLocaleString() : "",
        r.CheckOut ? new Date(r.CheckOut).toLocaleString() : "",
        durationHrs(r.CheckIn, r.CheckOut) ?? "",
      ]),
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `Manpower_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-1 h-16 rounded-xl bg-slate-100 border border-slate-200"
            />
          ))}
        </div>
        <div className="h-8 w-full rounded-xl bg-slate-100 border border-slate-200" />
        <div className="h-64 rounded-xl bg-slate-100 border border-slate-200" />
      </div>
    );
  }

  // ── empty state ────────────────────────────────────────────────────────────

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
          <Users size={22} className="text-slate-300" />
        </div>
        <div className="text-sm font-semibold text-slate-500">
          No manpower data
        </div>
        <div className="text-xs text-slate-400">
          Select a date range and click Query
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* KPI strip */}
      <div className="flex flex-wrap gap-2">
        <KPI
          icon={Users}
          label="Total Headcount"
          value={data.length}
          color="#4f46e5"
          sub={`${Object.keys(contractorMap).length} contractors`}
        />
        <KPI
          icon={Building2}
          label="Departments"
          value={Object.keys(deptMap).length}
          color="#0891b2"
        />
        <KPI
          icon={SunMedium}
          label="Shifts"
          value={Object.keys(shiftMap).length}
          color="#d97706"
          sub={Object.entries(shiftMap)
            .map(([s, c]) => `${s}: ${c}`)
            .join(" · ")}
        />
        <KPI
          icon={Clock}
          label="Pending Check-Out"
          value={pendingOut}
          color={pendingOut > 0 ? "#dc2626" : "#059669"}
          sub={pendingOut > 0 ? "still on floor" : "all checked out"}
        />
      </div>

      {/* Contractor summary cards */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(contractorMap).map(([name, stats], i) => (
          <ContractorCard
            key={name}
            name={name}
            count={stats.total}
            present={stats.present}
            absent={stats.pendingOut}
            palette={CONTRACTOR_COLORS[i % CONTRACTOR_COLORS.length]}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
        {/* Search */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search name, dept…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"
          />
        </div>

        {/* Contractor filter */}
        <select
          value={filterContractor}
          onChange={(e) => setFilterContractor(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {contractors.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        {/* Shift filter */}
        <select
          value={filterShift}
          onChange={(e) => setFilterShift(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {shifts.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <span className="text-xs text-slate-400 ml-1">
          {filtered.length} of {data.length} records
        </span>

        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { label: "#", key: null, w: "40px" },
                  { label: "Contractor", key: "Contractor", w: "160px" },
                  { label: "Name", key: "WorkmenName", w: "160px" },
                  { label: "Department", key: "Department", w: "140px" },
                  { label: "Shift", key: "Shift", w: "100px" },
                  { label: "Check-In", key: "CheckIn", w: "130px" },
                  { label: "Check-Out", key: "CheckOut", w: "130px" },
                  { label: "Duration", key: null, w: "80px" },
                  { label: "Status", key: null, w: "90px" },
                ].map(({ label, key, w }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{ width: w, minWidth: w }}
                    className={`px-3 py-2.5 text-left font-semibold text-slate-500 border-b border-slate-200 select-none whitespace-nowrap ${key ? "cursor-pointer hover:text-slate-700" : ""}`}
                  >
                    {label}
                    {key && <SortIcon col={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => {
                  const dur = durationHrs(row.CheckIn, row.CheckOut);
                  const isOut = !!row.CheckOut;
                  const contractorIdx = Object.keys(contractorMap).indexOf(
                    row.Contractor,
                  );
                  const palette =
                    CONTRACTOR_COLORS[contractorIdx % CONTRACTOR_COLORS.length];

                  return (
                    <tr
                      key={i}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}
                    >
                      {/* # */}
                      <td className="px-3 py-2 text-slate-300 font-mono text-center">
                        {i + 1}
                      </td>

                      {/* Contractor */}
                      <td className="px-3 py-2">
                        <span
                          className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate max-w-[150px]"
                          style={{
                            background: palette.bg,
                            color: palette.text,
                            borderColor: palette.border,
                          }}
                          title={row.Contractor}
                        >
                          {row.Contractor || "—"}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {row.WorkmenName || "—"}
                      </td>

                      {/* Department */}
                      <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate">
                        {row.Department || "—"}
                      </td>

                      {/* Shift */}
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1 text-slate-500">
                          {row.Shift?.toLowerCase().includes("night") ? (
                            <Moon size={9} className="text-violet-400" />
                          ) : (
                            <SunMedium size={9} className="text-amber-400" />
                          )}
                          {row.Shift || "—"}
                        </span>
                      </td>

                      {/* Check-In */}
                      <td className="px-3 py-2 font-mono text-sky-600 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <LogIn size={9} className="shrink-0" />
                          {fmtTime(row.CheckIn)}
                        </span>
                      </td>

                      {/* Check-Out */}
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {isOut ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <LogOut size={9} className="shrink-0" />
                            {fmtTime(row.CheckOut)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <AlertCircle size={9} className="shrink-0" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2 font-mono text-center text-slate-500">
                        {dur ? (
                          <span
                            className={`text-[11px] font-bold ${Number(dur) >= 8 ? "text-emerald-600" : "text-amber-500"}`}
                          >
                            {dur}h
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2">
                        {isOut ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Checked Out
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            On Floor
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer totals */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td
                    colSpan={2}
                    className="px-3 py-2.5 text-xs font-bold text-slate-300"
                  >
                    Grand Total
                  </td>
                  <td
                    colSpan={7}
                    className="px-3 py-2.5 text-xs font-bold text-right"
                  >
                    <span className="font-mono text-base text-white mr-6">
                      {filtered.length}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      workers · {filtered.filter((r) => r.CheckOut).length}{" "}
                      checked out · {filtered.filter((r) => !r.CheckOut).length}{" "}
                      still on floor
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManpowerView;