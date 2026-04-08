import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";

import {
  FiSearch, FiPackage, FiTruck, FiRotateCcw, FiPrinter,
  FiDownload, FiBarChart2, FiRefreshCw, FiZap, FiBox, FiClock,
  FiX, FiCopy, FiCheck,
} from "react-icons/fi";
import { HiOutlineClipboardList, HiOutlineChip } from "react-icons/hi";
import { MdQrCode2, MdOutlineTableChart } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { VscTools } from "react-icons/vsc";
import { GoChecklist } from "react-icons/go";
import { TbComponents, TbReportSearch, TbLink } from "react-icons/tb";
import { BsCardList, BsLayersFill } from "react-icons/bs";
import { RiFlowChart } from "react-icons/ri";

// ── Tab sub-components ────────────────────────────────────────────
import StageHistoryTable     from "./tabs/StageHistoryTable";
import LogisticTable         from "./tabs/LogisticTable";
import ComponentDetailsTable from "./tabs/ComponentDetailsTable";
import FunctionalTestTable   from "./tabs/FunctionalTestTable";
import ReworkReportTable     from "./tabs/ReworkReportTable";
import ReprintHistoryTable   from "./tabs/ReprintHistoryTable";
import HistoryCardTable      from "./tabs/HistoryCard";
import SerialNumbersTable    from "./tabs/SerialNumbersTable";   // NEW

// ─────────────────────────────────────────────────────────────────
// Tab Config
// ─────────────────────────────────────────────────────────────────
const TABS = [
  {
    key: "serialNumbers",
    label: "Serial Numbers",
    shortLabel: "Serials",
    Icon: TbLink,
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
    Icon: HiOutlineClipboardList,
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
    Icon: FiTruck,
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
    Icon: TbComponents,
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
    Icon: GoChecklist,
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
    Icon: VscTools,
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
    Icon: FiPrinter,
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
    Icon: BsCardList,
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
  serialNumbers:    SerialNumbersTable,
  stageHistory:     StageHistoryTable,
  logistic:         LogisticTable,
  componentDetails: ComponentDetailsTable,
  functionalTest:   FunctionalTestTable,
  reworkReport:     ReworkReportTable,
  reprintHistory:   ReprintHistoryTable,
  historyCard:      HistoryCardTable,
};

const HISTORY_KEY = "cr_search_history";
const MAX_HISTORY = 8;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function getCount(tabKey, data) {
  if (!data) return 0;
  if (tabKey === "functionalTest" && !Array.isArray(data)) {
    return (data.gasCharging?.length || 0) + (data.est?.length || 0) +
           (data.mft?.length || 0)         + (data.cpt?.length || 0);
  }
  return Array.isArray(data) ? data.length : 0;
}

function getExportRows(tabKey, data) {
  if (!data) return [];
  if (tabKey === "functionalTest" && !Array.isArray(data)) {
    return [
      ...(data.gasCharging || []).map(r => ({ _Section: "GasCharging", ...r })),
      ...(data.est         || []).map(r => ({ _Section: "EST",         ...r })),
      ...(data.mft         || []).map(r => ({ _Section: "MFT",         ...r })),
      ...(data.cpt         || []).map(r => ({ _Section: "CPT",         ...r })),
    ];
  }
  return Array.isArray(data) ? data : [];
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map(r =>
      keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(id) {
  const prev = loadHistory().filter(h => h !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([id, ...prev].slice(0, MAX_HISTORY)));
}

// ─────────────────────────────────────────────────────────────────
// Search History Dropdown
// ─────────────────────────────────────────────────────────────────
function HistoryDropdown({ history, onSelect, onClear, onRemove }) {
  if (!history.length) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl
                    border border-gray-200 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <FiClock size={10} /> Recent Searches
        </p>
        <button onClick={onClear}
          className="text-[10px] text-red-400 hover:text-red-600 font-semibold cursor-pointer">
          Clear all
        </button>
      </div>
      {history.map((id, i) => (
        <div key={i}
          className="flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50/60
                     cursor-pointer group border-b border-gray-50 last:border-0 transition-colors">
          <FiSearch size={12} className="text-gray-300 flex-shrink-0" />
          <span className="flex-1 font-mono text-sm text-gray-700 truncate"
                onClick={() => onSelect(id)}>
            {id}
          </span>
          <button onClick={() => onRemove(id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity
                       w-5 h-5 rounded flex items-center justify-center
                       hover:bg-red-100 text-gray-400 hover:text-red-500 cursor-pointer">
            <FiX size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// QueryPlaceholder
// ─────────────────────────────────────────────────────────────────
function QueryPlaceholder({ onHistorySelect, history }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 select-none">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100
                        border-2 border-indigo-200/60 flex items-center justify-center shadow-inner">
          <TbReportSearch size={38} className="text-indigo-400" />
        </div>
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full
                         flex items-center justify-center shadow-md">
          <FiSearch size={11} className="text-white" />
        </span>
      </div>

      <p className="text-base font-extrabold text-gray-800 mb-1.5 tracking-tight">
        Enter a component identifier
      </p>
      <p className="text-sm text-gray-400 text-center max-w-xs leading-relaxed">
        Type a <span className="font-semibold text-indigo-600">Serial Number</span>,{" "}
        <span className="font-semibold text-indigo-600">FG Number</span>, or{" "}
        <span className="font-semibold text-indigo-600">Foaming Serial</span>{" "}
        then click <span className="font-semibold text-gray-700">Query</span>.
      </p>

      {/* Tab preview chips */}
      <div className="mt-7 flex flex-wrap justify-center gap-2 max-w-md">
        {TABS.map(tab => {
          const Icon = tab.Icon;
          return (
            <div key={tab.key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50
                         border border-gray-100 text-gray-400">
              <Icon size={12} />
              <span className="text-xs font-medium">{tab.shortLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Recent history in placeholder */}
      {history.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <FiClock size={10} /> Recent
          </p>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map((id, i) => (
              <button key={i} onClick={() => onHistorySelect(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white
                           border border-gray-200 text-xs font-mono text-gray-600
                           hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700
                           transition-all cursor-pointer shadow-sm">
                <FiSearch size={10} /> {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Summary Grid (clickable stat cards)
// ─────────────────────────────────────────────────────────────────
function SummaryGrid({ tabCache, activeTab, onTabClick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mb-4">
      {TABS.map(tab => {
        const cache   = tabCache[tab.key];
        const count   = cache.fetched ? getCount(tab.key, cache.data) : null;
        const Icon    = tab.Icon;
        const isActive = activeTab === tab.key;
        return (
          <button key={tab.key} onClick={() => onTabClick(tab.key)}
            className={`flex flex-col gap-1 p-3 rounded-xl border text-left cursor-pointer
                        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                        active:translate-y-0 active:scale-[0.98]
                        ${isActive
                          ? `${tab.accentBg} ${tab.accentBorder.replace("border-","border-")} border-2 shadow-sm`
                          : cache.fetched
                            ? "bg-white border-gray-200 shadow-sm"
                            : "bg-gray-50/60 border-dashed border-gray-200"
                        }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center
                            ${cache.fetched || isActive ? tab.accentBg : "bg-gray-100"}`}>
              <Icon size={13} className={cache.fetched || isActive ? tab.accentText : "text-gray-300"} />
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1
                            ${isActive ? tab.accentText : "text-gray-400"}`}>
                {tab.shortLabel}
              </p>
              {cache.loading ? (
                <AiOutlineLoading3Quarters size={13} className="animate-spin text-gray-400" />
              ) : count !== null ? (
                <p className={`text-xl font-black leading-none ${isActive ? tab.accentText : "text-gray-800"}`}>
                  {count}
                </p>
              ) : (
                <p className="text-xl font-black text-gray-200">—</p>
              )}
              {cache.fetched && !cache.loading && (
                <p className={`text-[9px] font-semibold mt-0.5
                              ${count > 0 ? tab.accentText : "text-gray-300"}`}>
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

// ─────────────────────────────────────────────────────────────────
// Meta info pills
// ─────────────────────────────────────────────────────────────────
function CopyPill({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-200
                 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
      {copied ? <FiCheck size={8} className="text-emerald-500" /> : <FiCopy size={8} className="text-gray-400" />}
    </button>
  );
}

function MetaStrip({ materialName, barcodeAlias, serial, customerQr, asset }) {
  const items = [
    { label: "Material",         value: materialName, Icon: FiBox,         cls: "text-indigo-600 bg-indigo-50" },
    { label: "Assembly Barcode", value: barcodeAlias, Icon: BsLayersFill,  cls: "text-violet-600 bg-violet-50" },
    { label: "FG Serial",        value: serial,       Icon: HiOutlineChip, cls: "text-emerald-600 bg-emerald-50" },
    { label: "Customer QR",      value: customerQr,   Icon: MdQrCode2,     cls: "text-cyan-600 bg-cyan-50" },
    { label: "Asset",            value: asset,        Icon: RiFlowChart,   cls: "text-amber-600 bg-amber-50" },
  ].filter(i => i.value && i.value !== "N/A");

  if (!items.length) return null;

  return (
    <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/60 via-violet-50/30 to-cyan-50/40
                    border border-indigo-100 flex flex-wrap gap-2 items-center">
      <div className="p-1.5 rounded-lg bg-white border border-indigo-100 shadow-sm">
        <FiPackage size={14} className="text-indigo-500" />
      </div>
      {items.map((item, i) => {
        const Icon = item.Icon;
        return (
          <div key={i} className="relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white
                     border border-gray-100 shadow-sm text-xs">
            <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.cls}`}>
              <Icon size={11} />
            </span>
            <span className="text-gray-400">{item.label}:</span>
            <span className="font-bold text-gray-700 font-mono">{item.value}</span>
            <CopyPill value={item.value} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Progress bar for "load all" state
// ─────────────────────────────────────────────────────────────────
function FetchProgressBar({ tabCache }) {
  const fetched = TABS.filter(t => tabCache[t.key].fetched).length;
  const pct = Math.round((fetched / TABS.length) * 100);
  if (fetched === 0 || fetched === TABS.length) return null;
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
             style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{fetched}/{TABS.length} tabs loaded</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
function ConsolidatedReport() {
  const [componentIdentifier, setComponentIdentifier] = useState("");
  const [activeTab, setActiveTab]     = useState(TABS[0].key);
  const [queried, setQueried]         = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(loadHistory);

  const [materialName, setMaterialName] = useState("");
  const [barcodeAlias, setBarcodeAlias] = useState("");
  const [serial, setSerial]             = useState("");
  const [customerQr, setCustomerQr]     = useState("");
  const [asset, setAsset]               = useState("");

  const freshCache = () => {
    const out = {};
    TABS.forEach(t => { out[t.key] = { data: null, loading: false, fetched: false }; });
    return out;
  };

  const [tabCache, setTabCache]     = useState(freshCache);
  const queriedSerial               = useRef("");
  const searchInputRef              = useRef(null);
  const historyRef                  = useRef(null);

  // Ctrl+K → focus search
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close history dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // BUG FIX: cpt included, functionalTest data is object not array
  const parseResponse = (tabKey, response) => {
    if (tabKey === "stageHistory") {
      return response.data?.data?.recordsets?.[0] || [];
    }
    if (tabKey === "functionalTest") {
      const d = response?.data?.data || {};
      return {
        gasCharging: d.gasCharging || [],
        est:         d.est         || [],
        mft:         d.mft         || [],
        cpt:         d.cpt         || [],
      };
    }
    if (response?.data?.success === false) return [];
    return response?.data?.data || [];
  };

  const fetchTabData = useCallback(async (tabKey, identifier) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return;

    setTabCache(prev => ({ ...prev, [tabKey]: { ...prev[tabKey], loading: true } }));

    try {
      const response = await axios.get(`${baseURL}${tab.endpoint}`, {
        params: { [tab.paramKey]: identifier },
      });
      const data = parseResponse(tabKey, response);

      if (tabKey === "stageHistory") {
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        setMaterialName(row?.MaterialName  || "");
        setBarcodeAlias(row?.BarcodeAlias  || "");
        setSerial(row?.Serial              || "");
        setCustomerQr(row?.CustomerQR      || "");
        setAsset(row?.VSerial              || "");
      }

      setTabCache(prev => ({ ...prev, [tabKey]: { data, loading: false, fetched: true } }));
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load ${tab.label}`);
      const emptyData = tabKey === "functionalTest"
        ? { gasCharging: [], est: [], mft: [], cpt: [] } : [];
      setTabCache(prev => ({ ...prev, [tabKey]: { data: emptyData, loading: false, fetched: true } }));
    }
  }, []);

  const runQuery = async (id) => {
    const trimmed = id.trim();
    if (!trimmed) { toast.error("Please enter a Serial Number or FG Number."); return; }

    setShowHistory(false);

    if (queriedSerial.current !== trimmed) {
      setTabCache(freshCache());
      setMaterialName(""); setBarcodeAlias(""); setSerial(""); setCustomerQr(""); setAsset("");
    }

    queriedSerial.current = trimmed;
    setComponentIdentifier(trimmed);
    setQueried(true);

    // Save to history
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

  const handleTabSwitch = useCallback((tabKey) => {
    setActiveTab(tabKey);
    if (queried && !tabCache[tabKey].fetched && !tabCache[tabKey].loading) {
      fetchTabData(tabKey, queriedSerial.current);
    }
  }, [queried, tabCache, fetchTabData]);

  const handleFetchAll = () => {
    if (!queriedSerial.current) return;
    TABS.filter(t => !tabCache[t.key].fetched && !tabCache[t.key].loading)
        .forEach(t => fetchTabData(t.key, queriedSerial.current));
  };

  const handleRefreshTab = () => {
    if (!queriedSerial.current) return;
    setTabCache(prev => ({ ...prev, [activeTab]: { data: null, loading: false, fetched: false } }));
    fetchTabData(activeTab, queriedSerial.current);
  };

  const handleReset = () => {
    setComponentIdentifier("");
    setMaterialName(""); setBarcodeAlias(""); setSerial(""); setCustomerQr(""); setAsset("");
    setQueried(false);
    setActiveTab(TABS[0].key);
    queriedSerial.current = "";
    setTabCache(freshCache());
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removeHistory = (id) => {
    const next = searchHistory.filter(h => h !== id);
    setSearchHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setShowHistory(false);
  };

  const isAnyLoading = TABS.some(t => tabCache[t.key].loading);
  const allFetched   = TABS.every(t => tabCache[t.key].fetched);
  const fetchedCount = TABS.filter(t => tabCache[t.key].fetched).length;

  const currentCache     = tabCache[activeTab];
  const currentTab       = TABS.find(t => t.key === activeTab);
  const CurrentComponent = TAB_COMPONENTS[activeTab];
  const currentCount     = currentCache.fetched ? getCount(activeTab, currentCache.data) : 0;
  const exportRows       = getExportRows(activeTab, currentCache.data);

  return (
    <div className="min-h-screen bg-[#f0f2f8] p-3 md:p-5">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600
                          flex items-center justify-center shadow-lg shadow-indigo-200/60">
            <FiBarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-gray-900 leading-none tracking-tight">
              Consolidated Report
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Full product traceability dashboard</p>
          </div>
        </div>

        {queried && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white
                          border border-gray-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-600 font-mono truncate max-w-[140px]">
              {queriedSerial.current}
            </span>
          </div>
        )}
      </div>

      {/* ── SEARCH CARD ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-3">
        <div className="flex flex-wrap items-end gap-3">

          {/* Search input with history */}
          <div className="flex-1 min-w-[220px] max-w-md" ref={historyRef}>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Serial / FG / Foaming Number
              <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-mono normal-case text-[9px]">
                Ctrl+K
              </span>
            </label>
            <div className="relative">
              <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="e.g. F001234, 42570260400583, SN-001..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50
                           text-sm font-mono placeholder:text-gray-300 placeholder:font-sans
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100/60 focus:bg-white
                           outline-none transition-all duration-200"
                value={componentIdentifier}
                onChange={e => setComponentIdentifier(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onKeyDown={e => {
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Query */}
            <button
              onClick={handleQuery}
              disabled={isAnyLoading}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white
                         transition-all duration-200 shadow-sm
                         ${isAnyLoading
                           ? "bg-gray-300 cursor-not-allowed"
                           : "bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:shadow-md hover:shadow-indigo-200/60 active:scale-[0.97] cursor-pointer"
                         }`}
            >
              {isAnyLoading
                ? <><AiOutlineLoading3Quarters size={13} className="animate-spin" /> Querying…</>
                : <><FiSearch size={13} /> Query</>}
            </button>

            {/* Load All */}
            {queried && !allFetched && !isAnyLoading && (
              <button onClick={handleFetchAll}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200
                           bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700
                           hover:bg-indigo-100 transition-all duration-150 cursor-pointer active:scale-[0.97]">
                <FiZap size={13} /> Load All ({TABS.length - fetchedCount})
              </button>
            )}

            {/* Refresh current tab */}
            {queried && currentCache.fetched && !currentCache.loading && (
              <button onClick={handleRefreshTab} title="Refresh this tab"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50
                           transition-all cursor-pointer">
                <FiRefreshCw size={13} />
              </button>
            )}

            {/* Reset */}
            {queried && (
              <button onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-4 py-2.5 text-sm font-medium text-gray-500
                           hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300
                           transition-all cursor-pointer active:scale-[0.97]">
                <FiRotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Meta strip with copy-on-hover */}
        <MetaStrip
          materialName={materialName} barcodeAlias={barcodeAlias}
          serial={serial} customerQr={customerQr} asset={asset}
        />
      </div>

      {/* ── SUMMARY GRID ────────────────────────────────────────── */}
      {queried && (
        <>
          <FetchProgressBar tabCache={tabCache} />
          <SummaryGrid tabCache={tabCache} activeTab={activeTab} onTabClick={handleTabSwitch} />
        </>
      )}

      {/* ── TAB PANEL ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center justify-between pr-2">

            {/* Tabs */}
            <div className="flex overflow-x-auto scrollbar-hide px-2 pt-2 gap-0.5 flex-1">
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                const cache    = tabCache[tab.key];
                const count    = cache.fetched ? getCount(tab.key, cache.data) : null;
                const Icon     = tab.Icon;
                return (
                  <button key={tab.key} onClick={() => handleTabSwitch(tab.key)}
                    title={tab.description}
                    className={`group relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold
                               whitespace-nowrap rounded-t-xl border-t-2 border-x transition-all duration-150
                               cursor-pointer
                               ${isActive
                                 ? `${tab.accentBg} ${tab.accentText} ${tab.accentBorder} border-x-gray-100 -mb-[1px] shadow-sm`
                                 : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/70"
                               }`}
                  >
                    <span className={isActive ? tab.accentText : "text-gray-400 group-hover:text-gray-500"}>
                      {cache.loading
                        ? <AiOutlineLoading3Quarters size={14} className="animate-spin" />
                        : <Icon size={15} />
                      }
                    </span>
                    <span className="hidden lg:inline">{tab.label}</span>
                    <span className="lg:hidden">{tab.shortLabel}</span>

                    {count !== null && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1.5
                                       rounded-full text-[9px] font-black
                                       ${isActive ? tab.accentBadge : "bg-gray-200 text-gray-500"}`}>
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
              <button onClick={() => exportCSV(exportRows, currentTab.exportFilename)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-gray-200
                           bg-white px-3 py-1.5 mb-1 mr-1 text-xs font-semibold text-gray-600
                           hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900
                           transition-all cursor-pointer shadow-sm whitespace-nowrap">
                <FiDownload size={12} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>

          {/* Active tab description strip */}
          {queried && currentTab?.description && (
            <div className={`px-5 py-1.5 border-t border-gray-100 ${currentTab.accentBg}`}>
              <p className={`text-[10px] font-semibold ${currentTab.accentText}`}>
                {currentTab.description}
              </p>
            </div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="p-5">
          {!queried ? (
            <QueryPlaceholder onHistorySelect={handleHistorySelect} history={searchHistory} />
          ) : currentCache.loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {(() => { const I = currentTab.Icon; return <I size={18} className={currentTab.accentText} />; })()}
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Loading {currentTab.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{queriedSerial.current}</p>
                <p className="text-xs text-gray-400 mt-0.5">{currentTab.description}</p>
              </div>
            </div>
          ) : currentCache.fetched ? (
            <div key={`${activeTab}-${queriedSerial.current}`}
                 style={{ animation: "cr-fadein 0.2s ease-out" }}>
              {/* Pass currentIdentifier to SerialNumbersTable */}
              {activeTab === "serialNumbers"
                ? <SerialNumbersTable data={currentCache.data} currentIdentifier={queriedSerial.current} />
                : <CurrentComponent data={currentCache.data} />
              }
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AiOutlineLoading3Quarters size={20} className="animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Waiting for {currentTab.label}…</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cr-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default ConsolidatedReport;