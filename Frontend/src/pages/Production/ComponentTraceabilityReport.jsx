import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  useGetModelVariantsQuery,
  useGetComponentTypesQuery,
} from "../../redux/api/commonApi.js";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import {
  FiPackage, FiCpu, FiTruck, FiGrid, FiSearch, FiX,
  FiRefreshCw, FiAlertTriangle, FiCheckCircle,
  FiChevronUp, FiChevronDown, FiFilter,
  FiBox, FiZap, FiEye, FiLayers, FiTrendingUp,
} from "react-icons/fi";
import { MdOutlineFactory, MdOutlineInventory2 } from "react-icons/md";

/* ─── helpers ───────────────────────────────────────────────── */
const fmt = (iso) => (iso ? iso.replace("T", " ").replace("Z", "") : "—");
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : null);
const LIMIT = 100;

const CHART_COLORS = [
  "#f97316","#3b82f6","#10b981","#8b5cf6",
  "#ec4899","#06b6d4","#eab308","#ef4444",
  "#14b8a6","#a855f7","#f43f5e","#22c55e",
];

const sortRows = (rows, { key, dir }) => {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? ""; const bv = b[key] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return dir === "asc" ? cmp : -cmp;
  });
};

const COLUMNS = [
  { key: null,                      label: "#"          },
  { key: "Model_Name",              label: "Model"      },
  { key: "Component_Serial_Number", label: "Serial No." },
  { key: "Component_Name",          label: "Component"  },
  { key: "Component_Type",          label: "Type"       },
  { key: "SAP_Code",                label: "SAP Code"   },
  { key: "Supplier_Name",           label: "Supplier"   },
  { key: "Comp_ScanedOn",           label: "Scanned On" },
  { key: "FG_Date",                 label: "FG Date"    },
  { key: "Fg_Sr_No",                label: "FG Serial"  },
  { key: "Asset_tag",               label: "Asset Tag"  },
];

/* ─── SortIcon ──────────────────────────────────────────────── */
const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <FiChevronUp  className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === "asc"  ? "text-orange-400" : "text-slate-500"}`} />
    <FiChevronDown className={`w-2.5 h-2.5 ${active && dir === "desc" ? "text-orange-400" : "text-slate-500"}`} />
  </span>
);

/* ─── KpiCard ───────────────────────────────────────────────── */
const KpiCard = ({ icon: Icon, label, value, sub, colorCls }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5 hover:shadow-sm transition-shadow">
    <div className={`${colorCls} p-2 rounded-lg flex-shrink-0`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-base font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500 font-medium truncate">{label}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  </div>
);

/* ─── StatusPill ────────────────────────────────────────────── */
const StatusPill = ({ children, color = "slate" }) => {
  const map = {
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate:  "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${map[color]}`}>
      {children}
    </span>
  );
};

/* ─── GROUP DETAIL MODAL ────────────────────────────────────── */
const GroupModal = ({ group, rows, onClose }) => {
  const [search, setSearch] = useState("");
  const filtered = rows.filter(r =>
    !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[90vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">{group.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{group.count} records · grouped by {group.type}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <FiX className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search within group…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                {["#","Model","Serial No.","Component","SAP Code","Supplier","Scanned On","FG Serial","Asset Tag"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className={`border-b border-slate-50 hover:bg-orange-50 transition-colors ${i%2===0?"bg-white":"bg-slate-50/40"}`}>
                  <td className="px-3 py-2 text-slate-400 font-mono">{i+1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.Model_Name||"—"}</td>
                  <td className="px-3 py-2 font-mono text-blue-600 whitespace-nowrap">{r.Component_Serial_Number||"—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.Component_Name||"—"}</td>
                  <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{r.SAP_Code||"NA"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.Supplier_Name||"—"}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmt(r.Comp_ScanedOn)}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.Fg_Sr_No||"—"}</td>
                  <td className="px-3 py-2 font-mono text-emerald-600 font-semibold whitespace-nowrap">{r.Asset_tag||"—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-xs">No records match</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400">
          Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} records
        </div>
      </div>
    </div>
  );
};

/* ─── GROUP PANEL (sidebar) ─────────────────────────────────── */
const GroupPanel = ({ rows, groupBy, onGroupByChange }) => {
  const [modalGroup, setModalGroup] = useState(null);
  const [modalRows, setModalRows]   = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  const groups = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const key = r[groupBy] || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map)
      .map(([name, items]) => ({ name, count: items.length, items }))
      .sort((a, b) => b.count - a.count);
  }, [rows, groupBy]);

  const openModal = (g) => {
    setModalGroup({ name: g.name, count: g.count, type: groupBy });
    setModalRows(g.items);
  };
  const toggleExpand = (name) =>
    setExpandedGroups(p => ({ ...p, [name]: !p[name] }));

  const GROUP_OPTIONS = [
    { key: "Component_Type", label: "Type"     },
    { key: "Supplier_Name",  label: "Supplier" },
    { key: "Model_Name",     label: "Model"    },
    { key: "SAP_Code",       label: "SAP"      },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* group-by selector */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 flex-wrap flex-shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">By:</span>
        {GROUP_OPTIONS.map(g => (
          <button key={g.key} onClick={() => onGroupByChange(g.key)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all border ${
              groupBy === g.key
                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* group list — scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400">
            <FiLayers className="w-7 h-7 opacity-20 mb-2" />
            <p className="text-xs">No data</p>
          </div>
        )}
        {groups.map((g, i) => {
          const pct = Math.round((g.count / rows.length) * 100);
          const expanded = expandedGroups[g.name];
          return (
            <div key={g.name} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-all">
              <div
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-50"
                onClick={() => toggleExpand(g.name)}
              >
                {/* rank badge */}
                <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800 truncate leading-tight">{g.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1">
                      <div className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                      {g.count} · {pct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); openModal(g); }}
                    className="p-1 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="View all records"
                  >
                    <FiEye className="w-3 h-3" />
                  </button>
                  {expanded
                    ? <FiChevronUp className="w-3 h-3 text-slate-400" />
                    : <FiChevronDown className="w-3 h-3 text-slate-400" />}
                </div>
              </div>

              {/* inline expand — preview rows */}
              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-2.5 py-1.5 max-h-36 overflow-y-auto space-y-0.5">
                  {g.items.slice(0, 12).map((r, ri) => (
                    <div key={ri} className="flex items-center gap-1.5 text-[10px] py-0.5">
                      <span className="text-slate-400 font-mono w-4 flex-shrink-0 text-right">{ri+1}</span>
                      <span className="font-mono text-blue-500 truncate flex-1 min-w-0">{r.Component_Serial_Number||"—"}</span>
                      <span className="text-emerald-600 font-mono flex-shrink-0">{r.Asset_tag||"—"}</span>
                    </div>
                  ))}
                  {g.items.length > 12 && (
                    <button
                      onClick={e => { e.stopPropagation(); openModal(g); }}
                      className="text-[10px] text-orange-500 font-semibold hover:underline w-full text-center pt-0.5"
                    >
                      +{g.items.length - 12} more — View All
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalGroup && (
        <GroupModal group={modalGroup} rows={modalRows} onClose={() => setModalGroup(null)} />
      )}
    </div>
  );
};

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
const ComponentTraceabilityReport = () => {
  /* filters */
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedCompType, setSelectedCompType]         = useState(null);
  const [startTime, setStartTime]                       = useState("");
  const [endTime, setEndTime]                           = useState("");

  /* data */
  const [rows, setRows]       = useState([]);
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);

  /* UI */
  const [search, setSearch]                 = useState("");
  const [sort, setSort]                     = useState({ key: null, dir: "asc" });
  const [filtersChanged, setFiltersChanged] = useState(false);
  const [groupBy, setGroupBy]               = useState("Component_Type");
  const [highlightRow, setHighlightRow]     = useState(null);
  const [showGroups, setShowGroups]         = useState(false);

  /* RTK */
  const { data: variants  = [], isLoading: variantsLoading,  error: variantsError  } = useGetModelVariantsQuery();
  const { data: compTypes = [], isLoading: compTypesLoading, error: compTypesError } = useGetComponentTypesQuery();

  useEffect(() => {
    if (variantsError)  toast.error("Failed to load model variants");
    if (compTypesError) toast.error("Failed to load component types");
  }, [variantsError, compTypesError]);

  const buildParams = useCallback((extra = {}) => ({
    startTime, endTime,
    model:    selectedModelVariant ? parseInt(selectedModelVariant.value, 10) : 0,
    compType: selectedCompType     ? parseInt(selectedCompType.value, 10)     : 0,
    ...extra,
  }), [startTime, endTime, selectedModelVariant, selectedCompType]);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}prod/component-traceability`, {
        params: buildParams({ page: pageNum, limit: LIMIT }),
      });
      if (res?.data?.success) {
        const incoming = res.data.data ?? [];
        setRows(prev => pageNum === 1 ? incoming : [...prev, ...incoming]);
        setHasMore(incoming.length === LIMIT);
      } else {
        toast.error("No data returned from server.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const handleQuery = () => {
    if (!startTime || !endTime) { toast.error("Please select both Start Time and End Time."); return; }
    if (new Date(endTime) <= new Date(startTime)) { toast.error("End Time must be after Start Time."); return; }
    setQueried(true); setFiltersChanged(false);
    setRows([]); setPage(1); setSearch(""); setSort({ key: null, dir: "asc" }); setHighlightRow(null);
    fetchPage(1);
  };

  useEffect(() => { if (page > 1) fetchPage(page); }, [page]);

  const observerRef = useRef();
  const sentinelRef = useCallback((node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) setPage(p => p + 1);
    });
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore]);

  const handleFilterChange = (setter) => (val) => {
    setter(val);
    if (queried) setFiltersChanged(true);
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) { toast.error("Please select a time range."); return []; }
    try {
      const res = await axios.get(`${baseURL}prod/export-component-traceability`, { params: buildParams() });
      return res?.data?.success ? res.data.data : [];
    } catch { toast.error("Failed to fetch export data."); return []; }
  };

  const toggleSort = (key) => {
    if (!key) return;
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.Model_Name, r.Component_Serial_Number, r.Component_Name,
       r.Component_Type, r.SAP_Code, r.Supplier_Name, r.Fg_Sr_No, r.Asset_tag]
        .some(v => v && String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const displayRows = useMemo(() => sortRows(filteredRows, sort), [filteredRows, sort]);

  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const uniq = (key) => new Set(rows.map(r => r[key]).filter(Boolean)).size;
    const dates = [...new Set(rows.map(r => fmtDate(r.FG_Date)).filter(Boolean))].sort();
    const daySpan = dates.length > 1
      ? Math.round((new Date(dates[dates.length-1]) - new Date(dates[0])) / 86400000) + 1
      : 1;
    return {
      total:      rows.length,
      components: uniq("Component_Serial_Number"),
      models:     uniq("Model_Name"),
      suppliers:  uniq("Supplier_Name"),
      types:      uniq("Component_Type"),
      avgPerDay:  (rows.length / daySpan).toFixed(1),
      daySpan,
    };
  }, [rows]);

  if (variantsLoading || compTypesLoading) return <Loader />;

  return (
    /* Full viewport height, no scroll on this outer wrapper */
    <div className="flex flex-col h-screen bg-slate-100 font-sans overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
              <MdOutlineInventory2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-tight">Component Traceability</h1>
              <p className="text-[10px] text-slate-400">Track components across finished goods production</p>
            </div>
          </div>
          {rows.length > 0 && (
            <ExportButton fetchData={fetchExportData} filename="Component_Traceability_Report" />
          )}
        </div>
      </div>

      {/* ── FILTER BAR ─────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 self-end pb-1">
            <FiFilter className="w-3 h-3 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filters</span>
          </div>
          <SelectField
            label="Model Variant" options={variants}
            value={selectedModelVariant?.value || ""}
            onChange={e => handleFilterChange(setSelectedModelVariant)(variants.find(o => o.value === e.target.value) || null)}
            className="w-44"
          />
          <SelectField
            label="Component Type" options={compTypes}
            value={selectedCompType?.value || ""}
            onChange={e => handleFilterChange(setSelectedCompType)(compTypes.find(o => o.value === e.target.value) || null)}
            className="w-44"
          />
          <DateTimePicker label="Start Time" name="startTime" value={startTime}
            onChange={e => handleFilterChange(setStartTime)(e.target.value)} className="w-44" />
          <DateTimePicker label="End Time" name="endTime" value={endTime}
            onChange={e => handleFilterChange(setEndTime)(e.target.value)} className="w-44" />

          <button
            onClick={handleQuery} disabled={loading}
            className={`flex items-center gap-1.5 h-9 px-4 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
              loading
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600 shadow shadow-orange-200 active:scale-95"
            }`}
          >
            {loading && rows.length === 0
              ? <><FiRefreshCw className="w-3.5 h-3.5 animate-spin" />Loading…</>
              : <><FiZap className="w-3.5 h-3.5" />Run Query</>
            }
          </button>

          {filtersChanged && (
            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold">
              <FiAlertTriangle className="w-3 h-3" />
              Filters changed — re-run
            </div>
          )}
        </div>
      </div>

      {/* ── KPI STRIP ──────────────────────────────────────── */}
      {kpis && (
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex-shrink-0">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <KpiCard icon={FiPackage}        label="Total Records"  value={kpis.total.toLocaleString()}      colorCls="bg-orange-50 text-orange-500" />
            <KpiCard icon={FiCpu}            label="Unique Comps"   value={kpis.components.toLocaleString()} colorCls="bg-blue-50 text-blue-500" />
            <KpiCard icon={MdOutlineFactory} label="Models"         value={kpis.models}                      colorCls="bg-emerald-50 text-emerald-500" />
            <KpiCard icon={FiTruck}          label="Suppliers"      value={kpis.suppliers}                   colorCls="bg-violet-50 text-violet-500" />
            <KpiCard icon={FiGrid}           label="Comp Types"     value={kpis.types}                       colorCls="bg-pink-50 text-pink-500" />
            <KpiCard icon={FiTrendingUp}     label="Avg / Day"      value={kpis.avgPerDay} sub={`over ${kpis.daySpan}d`} colorCls="bg-amber-50 text-amber-500" />
          </div>
        </div>
      )}

      {/* ── BODY: Table (left) + Groups panel (right) ──────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── TABLE AREA ─────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* search */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text" placeholder="Search records…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 w-52"
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <FiX className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* status pills */}
              {rows.length > 0 && (
                <>
                  <StatusPill color="blue">{rows.length.toLocaleString()} loaded</StatusPill>
                  {search && <StatusPill color="orange">{filteredRows.length} matched</StatusPill>}
                  {hasMore
                    ? <StatusPill color="orange"><FiChevronDown className="w-2.5 h-2.5" />More below</StatusPill>
                    : <StatusPill color="green"><FiCheckCircle className="w-2.5 h-2.5" />All loaded</StatusPill>
                  }
                </>
              )}
            </div>

            {/* toggle group panel */}
            <button
              onClick={() => setShowGroups(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex-shrink-0 ${
                showGroups
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600"
              }`}
            >
              <FiLayers className="w-3.5 h-3.5" />
              {showGroups ? "Hide Groups" : "Show Groups"}
            </button>
          </div>

          {/* scrollable table */}
          <div className="flex-1 overflow-auto bg-white">
            <table className="min-w-full text-xs text-slate-700">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-slate-200 text-left">
                  {COLUMNS.map(col => (
                    <th key={col.label} onClick={() => toggleSort(col.key)}
                      className={`px-3 py-2.5 font-semibold whitespace-nowrap border-r border-slate-700 last:border-r-0 text-[11px] ${
                        col.key ? "cursor-pointer hover:bg-slate-800 transition-colors" : ""
                      }`}
                    >
                      <span className="flex items-center">
                        {col.label}
                        {col.key && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((item, idx) => {
                  const isLast    = idx === displayRows.length - 1;
                  const isHighlit = highlightRow === idx;
                  return (
                    <tr
                      key={`${item.Fg_Sr_No}-${idx}`}
                      ref={isLast && !search ? sentinelRef : null}
                      onClick={() => setHighlightRow(isHighlit ? null : idx)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        isHighlit
                          ? "bg-orange-50 ring-1 ring-inset ring-orange-200"
                          : idx % 2 === 0
                            ? "bg-white hover:bg-slate-50"
                            : "bg-slate-50/50 hover:bg-slate-100/80"
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{item.Model_Name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-blue-600 text-[11px] whitespace-nowrap">{item.Component_Serial_Number || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.Component_Name || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap">
                          {item.Component_Type || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400 text-[11px] whitespace-nowrap">{item.SAP_Code ?? "NA"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.Supplier_Name || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-400">{fmt(item.Comp_ScanedOn)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-400">{fmt(item.FG_Date)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{item.Fg_Sr_No || "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-emerald-600 font-semibold whitespace-nowrap">{item.Asset_tag || "—"}</td>
                    </tr>
                  );
                })}

                {/* empty — search no match */}
                {!loading && queried && rows.length > 0 && filteredRows.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-16 text-slate-400">
                    <FiSearch className="w-9 h-9 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-semibold">No records match "<strong>{search}</strong>"</p>
                    <button onClick={() => setSearch("")} className="mt-1.5 text-orange-500 text-xs font-semibold hover:underline">
                      Clear search
                    </button>
                  </td></tr>
                )}

                {/* empty — query no data */}
                {!loading && queried && rows.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-24 text-slate-400">
                    <FiBox className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-semibold">No records found for the selected filters.</p>
                    <p className="text-xs mt-1">Try adjusting the time range or removing filters.</p>
                  </td></tr>
                )}

                {/* pre-query */}
                {!loading && !queried && (
                  <tr><td colSpan={11} className="text-center py-28 text-slate-400">
                    <FiZap className="w-10 h-10 mx-auto mb-3 opacity-20 text-orange-400" />
                    <p className="text-sm font-semibold">
                      Set filters above and click <span className="text-orange-500">Run Query</span>
                    </p>
                  </td></tr>
                )}
              </tbody>
            </table>

            {/* load-more spinner */}
            {loading && rows.length > 0 && (
              <div className="flex justify-center py-4 border-t border-slate-100">
                <Loader />
              </div>
            )}
          </div>

          {/* first-fetch fullscreen loader */}
          {loading && rows.length === 0 && (
            <div className="flex-1 flex items-center justify-center bg-white">
              <Loader />
            </div>
          )}
        </div>

        {/* ── GROUPS SIDE PANEL ──────────────────────────── */}
        {showGroups && (
          <div className="w-64 flex-shrink-0 flex flex-col bg-white border-l border-slate-200 min-h-0">
            {/* panel header */}
            <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FiLayers className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-bold text-slate-700">Groups</span>
              </div>
              {rows.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {rows.length.toLocaleString()} rec.
                </span>
              )}
            </div>

            {/* panel body */}
            <div className="flex-1 min-h-0">
              {rows.length > 0
                ? <GroupPanel rows={rows} groupBy={groupBy} onGroupByChange={setGroupBy} />
                : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 px-4 text-center gap-2">
                    <FiLayers className="w-8 h-8 opacity-50" />
                    <p className="text-xs font-medium">Run a query to see groups</p>
                  </div>
                )
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentTraceabilityReport;