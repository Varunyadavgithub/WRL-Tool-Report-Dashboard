import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";
import {
  Search,
  Package,
  Truck,
  RotateCcw,
  Printer,
  Download,
  BarChart2,
  RefreshCw,
  Zap,
  Box,
  Clock,
  X,
  Copy,
  Check,
  Loader2,
  ClipboardList,
  Cpu,
  Link,
} from "lucide-react";

// ── Tab sub-components ─────────────────────────────────────────────────────────
import StageHistoryTable from "./tabs/StageHistoryTable";
import LogisticTable from "./tabs/LogisticTable";
import ComponentDetailsTable from "./tabs/ComponentDetailsTable";
import FunctionalTestTable from "./tabs/FunctionalTestTable";
import ReworkReportTable from "./tabs/ReworkReportTable";
import ReprintHistoryTable from "./tabs/ReprintHistoryTable";
import HistoryCardTable from "./tabs/HistoryCard";
import SerialNumbersTable from "./tabs/SerialNumbersTable";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Tab Config ─────────────────────────────────────────────────────────────────
const TABS = [
  {
    key: "serialNumbers",
    label: "Serial Numbers",
    shortLabel: "Serials",
    icon: Link,
    endpoint: "prod/serial-numbers",
    paramKey: "componentIdentifier",
    exportFilename: "Serial_Numbers_Report",
    accentBg: "bg-sky-50",
    accentBorder: "border-sky-500",
    accentText: "text-sky-700",
    accentBadge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
    description: "All serials linked to this production order",
  },
  {
    key: "stageHistory",
    label: "Stage History",
    shortLabel: "Stage",
    icon: ClipboardList,
    endpoint: "prod/stage-history",
    paramKey: "componentIdentifier",
    exportFilename: "Stage_History_Report",
    accentBg: "bg-indigo-50",
    accentBorder: "border-indigo-500",
    accentText: "text-indigo-700",
    accentBadge: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-400",
    description: "Station scan history with operators",
  },
  {
    key: "logistic",
    label: "Logistic Status",
    shortLabel: "Logistic",
    icon: Truck,
    endpoint: "prod/logistic-status",
    paramKey: "componentIdentifier",
    exportFilename: "Logistic_Status_Report",
    accentBg: "bg-cyan-50",
    accentBorder: "border-cyan-500",
    accentText: "text-cyan-700",
    accentBadge: "bg-cyan-100 text-cyan-700",
    dot: "bg-cyan-400",
    description: "FG label, auto-scan, unloading & dispatch",
  },
  {
    key: "componentDetails",
    label: "Components",
    shortLabel: "Parts",
    icon: Cpu,
    endpoint: "prod/component-details",
    paramKey: "componentIdentifier",
    exportFilename: "Component_Details_Report",
    accentBg: "bg-violet-50",
    accentBorder: "border-violet-500",
    accentText: "text-violet-700",
    accentBadge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-400",
    description: "BOM components & supplier details",
  },
  {
    key: "functionalTest",
    label: "Functional Test",
    shortLabel: "F-Test",
    icon: BarChart2,
    endpoint: "prod/functional-test",
    paramKey: "componentIdentifier",
    exportFilename: "Functional_Test_Report",
    accentBg: "bg-emerald-50",
    accentBorder: "border-emerald-500",
    accentText: "text-emerald-700",
    accentBadge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-400",
    description: "Gas, EST, MFT, CPT test results",
  },
  {
    key: "reworkReport",
    label: "Rework Report",
    shortLabel: "Rework",
    icon: RefreshCw,
    endpoint: "prod/rework-report",
    paramKey: "componentIdentifier",
    exportFilename: "Rework_Report",
    accentBg: "bg-amber-50",
    accentBorder: "border-amber-500",
    accentText: "text-amber-700",
    accentBadge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
    description: "Defects, root causes & counter-actions",
  },
  {
    key: "reprintHistory",
    label: "Reprint History",
    shortLabel: "Reprints",
    icon: Printer,
    endpoint: "prod/reprint-history",
    paramKey: "componentIdentifier",
    exportFilename: "Reprint_History_Report",
    accentBg: "bg-rose-50",
    accentBorder: "border-rose-500",
    accentText: "text-rose-700",
    accentBadge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-400",
    description: "Label reprint trail & operators",
  },
  {
    key: "historyCard",
    label: "History Card",
    shortLabel: "History",
    icon: ClipboardList,
    endpoint: "prod/history-card",
    paramKey: "componentIdentifier",
    exportFilename: "History_Card_Report",
    accentBg: "bg-slate-50",
    accentBorder: "border-slate-500",
    accentText: "text-slate-700",
    accentBadge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    description: "Full production + rework + pending stages",
  },
];

const TAB_COMPONENTS = {
  serialNumbers: SerialNumbersTable,
  stageHistory: StageHistoryTable,
  logistic: LogisticTable,
  componentDetails: ComponentDetailsTable,
  functionalTest: FunctionalTestTable,
  reworkReport: ReworkReportTable,
  reprintHistory: ReprintHistoryTable,
  historyCard: HistoryCardTable,
};

const HISTORY_KEY = "cr_search_history";
const MAX_HISTORY = 8;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCount(tabKey, data) {
  if (!data) return 0;
  if (tabKey === "functionalTest" && !Array.isArray(data)) {
    return (
      (data.gasCharging?.length || 0) +
      (data.est?.length || 0) +
      (data.mft?.length || 0) +
      (data.cpt?.length || 0)
    );
  }
  return Array.isArray(data) ? data.length : 0;
}

function getExportRows(tabKey, data) {
  if (!data) return [];
  if (tabKey === "functionalTest" && !Array.isArray(data)) {
    return [
      ...(data.gasCharging || []).map((r) => ({
        _Section: "GasCharging",
        ...r,
      })),
      ...(data.est || []).map((r) => ({ _Section: "EST", ...r })),
      ...(data.mft || []).map((r) => ({ _Section: "MFT", ...r })),
      ...(data.cpt || []).map((r) => ({ _Section: "CPT", ...r })),
    ];
  }
  return Array.isArray(data) ? data : [];
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((r) =>
      keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveHistory(id) {
  const prev = loadHistory().filter((h) => h !== id);
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify([id, ...prev].slice(0, MAX_HISTORY)),
  );
}

// ── History Dropdown ───────────────────────────────────────────────────────────
function HistoryDropdown({ history, onSelect, onClear, onRemove }) {
  if (!history.length) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-2.5 h-2.5" /> Recent Searches
        </p>
        <button
          onClick={onClear}
          className="text-[10px] text-red-400 hover:text-red-600 font-semibold"
        >
          Clear all
        </button>
      </div>
      {history.map((id, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50/60 cursor-pointer group border-b border-slate-50 last:border-0 transition-colors"
        >
          <Search className="w-3 h-3 text-slate-300 shrink-0" />
          <span
            className="flex-1 font-mono text-sm text-slate-700 truncate"
            onClick={() => onSelect(id)}
          >
            {id}
          </span>
          <button
            onClick={() => onRemove(id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-500"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Summary Grid ───────────────────────────────────────────────────────────────
function SummaryGrid({ tabCache, activeTab, onTabClick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 shrink-0">
      {TABS.map((tab) => {
        const cache = tabCache[tab.key];
        const count = cache.fetched ? getCount(tab.key, cache.data) : null;
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabClick(tab.key)}
            className={`flex flex-col gap-1 p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${
              isActive
                ? `${tab.accentBg} ${tab.accentBorder} border-2 shadow-sm`
                : cache.fetched
                  ? "bg-white border-slate-200 shadow-sm"
                  : "bg-slate-50/60 border-dashed border-slate-200"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${cache.fetched || isActive ? tab.accentBg : "bg-slate-100"}`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${cache.fetched || isActive ? tab.accentText : "text-slate-300"}`}
              />
            </div>
            <div>
              <p
                className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isActive ? tab.accentText : "text-slate-400"}`}
              >
                {tab.shortLabel}
              </p>
              {cache.loading ? (
                <Spinner cls="w-3.5 h-3.5 text-slate-400" />
              ) : count !== null ? (
                <p
                  className={`text-xl font-black leading-none ${isActive ? tab.accentText : "text-slate-800"}`}
                >
                  {count}
                </p>
              ) : (
                <p className="text-xl font-black text-slate-200">—</p>
              )}
              {cache.fetched && !cache.loading && (
                <p
                  className={`text-[9px] font-semibold mt-0.5 ${count > 0 ? tab.accentText : "text-slate-300"}`}
                >
                  {count > 0 ? "records" : "no data"}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Meta Strip ─────────────────────────────────────────────────────────────────
function CopyPill({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? (
        <Check className="w-2 h-2 text-emerald-500" />
      ) : (
        <Copy className="w-2 h-2 text-slate-400" />
      )}
    </button>
  );
}

function MetaStrip({ materialName, barcodeAlias, serial, customerQr, asset }) {
  const items = [
    {
      label: "Material",
      value: materialName,
      cls: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Assembly Barcode",
      value: barcodeAlias,
      cls: "text-violet-600 bg-violet-50",
    },
    {
      label: "FG Serial",
      value: serial,
      cls: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Customer QR",
      value: customerQr,
      cls: "text-cyan-600 bg-cyan-50",
    },
    { label: "Asset", value: asset, cls: "text-amber-600 bg-amber-50" },
  ].filter((i) => i.value && i.value !== "N/A");
  if (!items.length) return null;
  return (
    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap gap-2 items-center">
      <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      {items.map((item, i) => (
        <div
          key={i}
          className="relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-100 shadow-sm text-xs"
        >
          <span className="text-slate-400">{item.label}:</span>
          <span className={`font-bold font-mono ${item.cls}`}>
            {item.value}
          </span>
          <CopyPill value={item.value} />
        </div>
      ))}
    </div>
  );
}

// ── Fetch Progress Bar ─────────────────────────────────────────────────────────
function FetchProgressBar({ tabCache }) {
  const fetched = TABS.filter((t) => tabCache[t.key].fetched).length;
  const pct = Math.round((fetched / TABS.length) * 100);
  if (fetched === 0 || fetched === TABS.length) return null;
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
        {fetched}/{TABS.length} tabs loaded
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function ConsolidatedReport() {
  const [componentIdentifier, setComponentIdentifier] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [queried, setQueried] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(loadHistory);

  const [materialName, setMaterialName] = useState("");
  const [barcodeAlias, setBarcodeAlias] = useState("");
  const [serial, setSerial] = useState("");
  const [customerQr, setCustomerQr] = useState("");
  const [asset, setAsset] = useState("");

  const freshCache = () => {
    const out = {};
    TABS.forEach((t) => {
      out[t.key] = { data: null, loading: false, fetched: false };
    });
    return out;
  };

  const [tabCache, setTabCache] = useState(freshCache);
  const queriedSerial = useRef("");
  const searchInputRef = useRef(null);
  const historyRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target))
        setShowHistory(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const parseResponse = (tabKey, response) => {
    if (tabKey === "stageHistory")
      return response.data?.data?.recordsets?.[0] || [];
    if (tabKey === "functionalTest") {
      const d = response?.data?.data || {};
      return {
        gasCharging: d.gasCharging || [],
        est: d.est || [],
        mft: d.mft || [],
        cpt: d.cpt || [],
      };
    }
    if (response?.data?.success === false) return [];
    return response?.data?.data || [];
  };

  const fetchTabData = useCallback(async (tabKey, identifier) => {
    const tab = TABS.find((t) => t.key === tabKey);
    if (!tab) return;
    setTabCache((prev) => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], loading: true },
    }));
    try {
      const response = await axios.get(`${baseURL}${tab.endpoint}`, {
        params: { [tab.paramKey]: identifier },
      });
      const data = parseResponse(tabKey, response);
      if (tabKey === "stageHistory") {
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        setMaterialName(row?.MaterialName || "");
        setBarcodeAlias(row?.BarcodeAlias || "");
        setSerial(row?.Serial || "");
        setCustomerQr(row?.CustomerQR || "");
        setAsset(row?.VSerial || "");
      }
      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { data, loading: false, fetched: true },
      }));
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load ${tab.label}`);
      const emptyData =
        tabKey === "functionalTest"
          ? { gasCharging: [], est: [], mft: [], cpt: [] }
          : [];
      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { data: emptyData, loading: false, fetched: true },
      }));
    }
  }, []);

  const runQuery = async (id) => {
    const trimmed = id.trim();
    if (!trimmed) {
      toast.error("Please enter a Serial Number or FG Number.");
      return;
    }
    setShowHistory(false);
    if (queriedSerial.current !== trimmed) {
      setTabCache(freshCache());
      setMaterialName("");
      setBarcodeAlias("");
      setSerial("");
      setCustomerQr("");
      setAsset("");
    }
    queriedSerial.current = trimmed;
    setComponentIdentifier(trimmed);
    setQueried(true);
    saveHistory(trimmed);
    setSearchHistory(loadHistory());
    await fetchTabData(activeTab, trimmed);
  };

  const handleQuery = () => runQuery(componentIdentifier);
  const handleHistorySelect = (id) => {
    setComponentIdentifier(id);
    setShowHistory(false);
    runQuery(id);
  };
  const handleTabSwitch = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);
      if (queried && !tabCache[tabKey].fetched && !tabCache[tabKey].loading) {
        fetchTabData(tabKey, queriedSerial.current);
      }
    },
    [queried, tabCache, fetchTabData],
  );

  const handleFetchAll = () => {
    if (!queriedSerial.current) return;
    TABS.filter(
      (t) => !tabCache[t.key].fetched && !tabCache[t.key].loading,
    ).forEach((t) => fetchTabData(t.key, queriedSerial.current));
  };

  const handleRefreshTab = () => {
    if (!queriedSerial.current) return;
    setTabCache((prev) => ({
      ...prev,
      [activeTab]: { data: null, loading: false, fetched: false },
    }));
    fetchTabData(activeTab, queriedSerial.current);
  };

  const handleReset = () => {
    setComponentIdentifier("");
    setMaterialName("");
    setBarcodeAlias("");
    setSerial("");
    setCustomerQr("");
    setAsset("");
    setQueried(false);
    setActiveTab(TABS[0].key);
    queriedSerial.current = "";
    setTabCache(freshCache());
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removeHistory = (id) => {
    const next = searchHistory.filter((h) => h !== id);
    setSearchHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setShowHistory(false);
  };

  const isAnyLoading = TABS.some((t) => tabCache[t.key].loading);
  const allFetched = TABS.every((t) => tabCache[t.key].fetched);
  const fetchedCount = TABS.filter((t) => tabCache[t.key].fetched).length;
  const currentCache = tabCache[activeTab];
  const currentTab = TABS.find((t) => t.key === activeTab);
  const CurrentComponent = TAB_COMPONENTS[activeTab];
  const currentCount = currentCache.fetched
    ? getCount(activeTab, currentCache.data)
    : 0;
  const exportRows = getExportRows(activeTab, currentCache.data);

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Consolidated Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Full product traceability dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queried && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              {queriedSerial.current}
            </span>
          )}
          {queried && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
              <span className="text-xl font-bold font-mono text-blue-700">
                {fetchedCount}
              </span>
              <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
                Tabs Loaded
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3 min-h-0">
        {/* ── SEARCH CARD ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search input */}
            <div className="flex-1 min-w-[220px] max-w-md" ref={historyRef}>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Serial / FG / Foaming Number
                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono normal-case text-[9px]">
                  Ctrl+K
                </span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="e.g. F001234, 42570260400583, SN-001..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono placeholder:text-slate-300 placeholder:font-sans focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all"
                  value={componentIdentifier}
                  onChange={(e) => setComponentIdentifier(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isAnyLoading) handleQuery();
                    if (e.key === "Escape") setShowHistory(false);
                  }}
                />
                {showHistory && searchHistory.length > 0 && (
                  <HistoryDropdown
                    history={searchHistory}
                    onSelect={handleHistorySelect}
                    onClear={clearHistory}
                    onRemove={removeHistory}
                  />
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <button
                onClick={handleQuery}
                disabled={isAnyLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isAnyLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {isAnyLoading ? <Spinner /> : <Search className="w-4 h-4" />}
                {isAnyLoading ? "Querying…" : "Query"}
              </button>

              {queried && !allFetched && !isAnyLoading && (
                <button
                  onClick={handleFetchAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-all"
                >
                  <Zap className="w-4 h-4" /> Load All (
                  {TABS.length - fetchedCount})
                </button>
              )}

              {queried && currentCache.fetched && !currentCache.loading && (
                <button
                  onClick={handleRefreshTab}
                  title="Refresh this tab"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {queried && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              )}
            </div>
          </div>

          <MetaStrip
            materialName={materialName}
            barcodeAlias={barcodeAlias}
            serial={serial}
            customerQr={customerQr}
            asset={asset}
          />
        </div>

        {/* ── SUMMARY GRID + PROGRESS ── */}
        {queried && (
          <>
            <FetchProgressBar tabCache={tabCache} />
            <SummaryGrid
              tabCache={tabCache}
              activeTab={activeTab}
              onTabClick={handleTabSwitch}
            />
          </>
        )}

        {/* ── TAB PANEL ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 shrink-0">
            <div
              className="flex overflow-x-auto px-2 pt-1.5 gap-0.5 flex-1"
              style={{ scrollbarWidth: "none" }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const cache = tabCache[tab.key];
                const count = cache.fetched
                  ? getCount(tab.key, cache.data)
                  : null;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabSwitch(tab.key)}
                    title={tab.description}
                    className={`group relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-t-2 border-x transition-all cursor-pointer ${
                      isActive
                        ? `${tab.accentBg} ${tab.accentText} ${tab.accentBorder} border-x-slate-100 -mb-px shadow-sm`
                        : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/70"
                    }`}
                  >
                    <span
                      className={
                        isActive
                          ? tab.accentText
                          : "text-slate-400 group-hover:text-slate-500"
                      }
                    >
                      {cache.loading ? (
                        <Spinner cls="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className="hidden lg:inline">{tab.label}</span>
                    <span className="lg:hidden">{tab.shortLabel}</span>
                    {count !== null && (
                      <span
                        className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[9px] font-black ${
                          isActive
                            ? tab.accentBadge
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                    {cache.fetched && !isActive && (
                      <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Export CSV */}
            {queried && currentCache.fetched && currentCount > 0 && (
              <button
                onClick={() => exportCSV(exportRows, currentTab.exportFilename)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 m-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>

          {/* Active tab description */}
          {queried && currentTab?.description && (
            <div
              className={`px-4 py-1.5 border-b border-slate-100 shrink-0 ${currentTab.accentBg}`}
            >
              <p
                className={`text-[10px] font-semibold ${currentTab.accentText}`}
              >
                {currentTab.description}
              </p>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto min-h-0 p-4">
            {!queried ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <BarChart2 className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-base font-bold text-slate-500 mb-1">
                  Enter a component identifier
                </p>
                <p className="text-sm text-slate-400 text-center max-w-xs leading-relaxed">
                  Type a{" "}
                  <span className="font-semibold text-blue-600">
                    Serial Number
                  </span>
                  ,{" "}
                  <span className="font-semibold text-blue-600">FG Number</span>
                  , or{" "}
                  <span className="font-semibold text-blue-600">
                    Foaming Serial
                  </span>{" "}
                  then click{" "}
                  <span className="font-semibold text-slate-700">Query</span>.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <div
                        key={tab.key}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-400"
                      >
                        <Icon className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          {tab.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {searchHistory.length > 0 && (
                  <div className="mt-6 w-full max-w-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Clock className="w-2.5 h-2.5" /> Recent
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.slice(0, 5).map((id, i) => (
                        <button
                          key={i}
                          onClick={() => handleHistorySelect(id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all shadow-sm"
                        >
                          <Search className="w-2.5 h-2.5" /> {id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : currentCache.loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Spinner cls="w-6 h-6 text-blue-600" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Loading {currentTab.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    {queriedSerial.current}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentTab.description}
                  </p>
                </div>
              </div>
            ) : currentCache.fetched ? (
              <div key={`${activeTab}-${queriedSerial.current}`}>
                {activeTab === "serialNumbers" ? (
                  <SerialNumbersTable
                    data={currentCache.data}
                    currentIdentifier={queriedSerial.current}
                  />
                ) : (
                  <CurrentComponent data={currentCache.data} />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                <Spinner cls="w-5 h-5" />
                <p className="text-sm">Waiting for {currentTab.label}…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsolidatedReport;
