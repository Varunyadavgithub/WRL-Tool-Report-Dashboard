import { useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";
import {
  FiSearch,
  FiPackage,
  FiTruck,
  FiRotateCcw,
  FiPrinter,
  FiCreditCard,
  FiTag,
} from "react-icons/fi";
import { HiOutlineClipboardList } from "react-icons/hi";
import { MdOutlineTableChart } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { VscTools } from "react-icons/vsc";
import { GoChecklist } from "react-icons/go";
import { TbComponents } from "react-icons/tb";
import { BsCardList } from "react-icons/bs";

import Loader from "../../../components/ui/Loader";
import ExportButton from "../../../components/ui/ExportButton";
import Title from "../../../components/ui/Title";

import StageHistoryTable from "./tabs/StageHistoryTable";
import LogisticTable from "./tabs/LogisticTable";
import ComponentDetailsTable from "./tabs/ComponentDetailsTable";
import FunctionalTestTable from "./tabs/FunctionalTestTable";
import ReworkReportTable from "./tabs/ReworkReportTable";
import ReprintHistoryTable from "./tabs/ReprintHistoryTable";
import HistoryCard from "./tabs/HistoryCard";

// Tab Config
const TABS = [
  {
    key: "stageHistory",
    label: "Stage History",
    icon: <HiOutlineClipboardList size={17} />,
    endpoint: "prod/stage-history",
    paramKey: "componentIdentifier",
    exportFilename: "Stage_History_Report",
  },
  {
    key: "logistic",
    label: "Logistic Status",
    icon: <FiTruck size={16} />,
    endpoint: "prod/logistic-status",
    paramKey: "componentIdentifier",
    exportFilename: "Logistic_Status_Report",
  },
  {
    key: "componentDetails",
    label: "Component Details",
    icon: <TbComponents size={16} />,
    endpoint: "prod/component-details",
    paramKey: "componentIdentifier",
    exportFilename: "Component_Details_Report",
  },
  {
    key: "functionalTest",
    label: "Functional Test",
    icon: <GoChecklist size={16} />,
    endpoint: "prod/functional-test",
    paramKey: "componentIdentifier",
    exportFilename: "Functional_Test_Report",
  },
  {
    key: "reworkReport",
    label: "Rework Report",
    icon: <VscTools size={16} />,
    endpoint: "prod/rework-report",
    paramKey: "componentIdentifier",
    exportFilename: "Rework_Report",
  },
  {
    key: "reprintHistory",
    label: "Reprint History",
    icon: <FiPrinter size={16} />,
    endpoint: "prod/reprint-history",
    paramKey: "componentIdentifier",
    exportFilename: "Reprint_History_Report",
  },
  {
    key: "historyCard",
    label: "History Card",
    icon: <BsCardList size={16} />,
    endpoint: "prod/history-card",
    paramKey: "componentIdentifier",
    exportFilename: "History_Card_Report",
  },
];

// Tab Component Map
const TAB_COMPONENTS = {
  stageHistory: StageHistoryTable,
  logistic: LogisticTable,
  componentDetails: ComponentDetailsTable,
  functionalTest: FunctionalTestTable,
  reworkReport: ReworkReportTable,
  reprintHistory: ReprintHistoryTable,
  historyCard: HistoryCard,
};

// Placeholder Before Query
function QueryPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
        <MdOutlineTableChart size={36} className="text-indigo-300" />
      </div>
      <p className="text-lg font-bold text-gray-500">Search to View Report</p>
      <p className="text-sm mt-1.5 text-gray-400 text-center">
        Enter the Component Identifier above and click{" "}
        <span className="font-semibold text-indigo-500">Query</span> to load
        report data.
      </p>
    </div>
  );
}

function ConsolidatedReport() {
  const [componentIdentifier, setComponentIdentifier] = useState("");
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [queried, setQueried] = useState(false);

  const [materialName, setMaterialName] = useState("");
  const [barcodeAlias, setBarcodeAlias] = useState("");
  const [serial, setSerial] = useState("");
  const [customerQr, setCustomerQr] = useState("");
  const [asset, setAsset] = useState("");

  // Cache
  const [tabCache, setTabCache] = useState(() => {
    const initial = {};
    TABS.forEach((tab) => {
      initial[tab.key] = { data: [], loading: false, fetched: false };
    });
    return initial;
  });

  const queriedSerial = useRef("");

  // ─── Parse Response (handles different response shapes) ────
  const parseResponse = (tabKey, response) => {
    if (tabKey === "stageHistory") {
      return response.data?.data?.recordsets?.[0] || [];
    }

    // Functional Test returns { gasCharging, est, mft } structure
    if (tabKey === "functionalTest") {
      return response?.data?.data || { gasCharging: [], est: [], mft: [] };
    }

    if (response?.data?.success === false) {
      return [];
    }
    return response?.data?.data || [];
  };

  // ─── Fetch Single Tab ───────────────────────────────────────
  const fetchTabData = useCallback(async (tabKey, componentIdentifier) => {
    const tab = TABS.find((t) => t.key === tabKey);
    if (!tab) return;

    // Set loading
    setTabCache((prev) => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], loading: true },
    }));

    try {
      // Use the tab's own paramKey for the API call
      const response = await axios.get(`${baseURL}${tab.endpoint}`, {
        params: { [tab.paramKey]: componentIdentifier },
      });

      const data = parseResponse(tabKey, response);

      // Extract meta data
      if (tabKey === "stageHistory") {
        setMaterialName(
          data.length > 0 && data[0].MaterialName
            ? data[0].MaterialName
            : "N/A",
        );
        setBarcodeAlias(
          data.length > 0 && data[0].BarcodeAlias
            ? data[0].BarcodeAlias
            : "N/A",
        );
        setSerial(data.length > 0 && data[0].Serial ? data[0].Serial : "N/A");
        setCustomerQr(
          data.length > 0 && data[0].CustomerQR ? data[0].CustomerQR : "N/A",
        );
        setAsset(data.length > 0 && data[0].VSerial ? data[0].VSerial : "N/A");
      }

      // Cache it
      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { data, loading: false, fetched: true },
      }));
    } catch (error) {
      console.error(`Failed to fetch ${tab.label}:`, error);
      toast.error(`Failed to fetch ${tab.label}.`);

      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { ...prev[tabKey], loading: false },
      }));
    }
  }, []);

  // ─── Handle Query ───────────────────────────────────────────
  const handleQuery = async () => {
    if (!componentIdentifier.trim()) {
      toast.error("Please enter a Serial Number or FG Number.");
      return;
    }

    // If serial changed, clear all cache
    if (queriedSerial.current !== componentIdentifier.trim()) {
      const freshCache = {};
      TABS.forEach((tab) => {
        freshCache[tab.key] = { data: [], loading: false, fetched: false };
      });
      setTabCache(freshCache);
    }

    queriedSerial.current = componentIdentifier.trim();
    setQueried(true);

    // Fetch only active tab
    await fetchTabData(activeTab, componentIdentifier.trim());
  };

  // ─── Handle Tab Switch ──────────────────────────────────────
  const handleTabSwitch = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);

      if (queried && !tabCache[tabKey].fetched && !tabCache[tabKey].loading) {
        fetchTabData(tabKey, queriedSerial.current);
      }
    },
    [queried, tabCache, fetchTabData],
  );

  // Reset
  const handleReset = () => {
    setMaterialName("");
    setBarcodeAlias("");
    setSerial("");
    setCustomerQr("");
    setAsset("");
    setQueried(false);
    setActiveTab(TABS[0].key);
    queriedSerial.current = "";

    const freshCache = {};
    TABS.forEach((tab) => {
      freshCache[tab.key] = { data: [], loading: false, fetched: false };
    });
    setTabCache(freshCache);
  };

  // ─── Current Tab State ──────────────────────────────────────
  const currentCache = tabCache[activeTab];
  const currentTab = TABS.find((t) => t.key === activeTab);
  const CurrentComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Consolidated Report" align="center" />

      {/* ─── FILTERS ────────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100 mt-5">
        {/* Row 1: Input + Buttons */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Component Identifier Input */}
          <div className="flex-1 min-w-[240px] max-w-sm">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Serial Number / FG No.
            </label>
            <div className="relative group">
              <input
                type="text"
                placeholder="e.g. SN-20250601-001"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm
                     placeholder:text-gray-400
                     focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                     focus:bg-white outline-none transition-all duration-200"
                value={componentIdentifier}
                onChange={(e) => setComponentIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              />
              <FiSearch
                size={15}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400
                     group-focus-within:text-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuery}
              disabled={currentCache.loading}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold
                   text-white shadow-sm transition-all duration-200 cursor-pointer
                   ${
                     currentCache.loading
                       ? "bg-gray-400 cursor-not-allowed shadow-none"
                       : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md hover:shadow-indigo-200 active:scale-[0.97]"
                   }`}
            >
              {currentCache.loading ? (
                <>
                  <AiOutlineLoading3Quarters
                    size={14}
                    className="animate-spin"
                  />
                  Searching…
                </>
              ) : (
                <>
                  <FiSearch size={14} />
                  Query
                </>
              )}
            </button>

            {queried && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                     px-4 py-2.5 text-sm font-medium text-gray-600
                     hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800
                     transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                <FiRotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Info Summary (only shown after query) */}
        {(materialName || barcodeAlias || serial || customerQr || asset) && (
          <div
            className="mt-4 p-4 rounded-2xl
               bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50
               border border-indigo-200/60
               shadow-sm"
          >
            <div className="flex items-start gap-3">
              {/* Main Icon */}
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                <FiPackage className="text-lg" />
              </div>

              {/* Content */}
              <div className="flex flex-wrap gap-2">
                {materialName && (
                  <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-indigo-100 text-gray-700 shadow-sm">
                    <span className="text-gray-400 mr-1">Material:</span>
                    {materialName}
                  </div>
                )}

                {barcodeAlias && (
                  <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-indigo-100 text-gray-700 shadow-sm">
                    <span className="text-gray-400 mr-1">
                      Assembly Barcode:
                    </span>
                    {barcodeAlias}
                  </div>
                )}

                {serial && (
                  <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-indigo-100 text-gray-700 shadow-sm">
                    <span className="text-gray-400 mr-1">FG Serial:</span>
                    {serial}
                  </div>
                )}

                {customerQr && (
                  <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-indigo-100 text-gray-700 shadow-sm">
                    <span className="text-gray-400 mr-1">Customer QR:</span>
                    {customerQr}
                  </div>
                )}

                {asset && (
                  <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-indigo-100 text-gray-700 shadow-sm">
                    <span className="text-gray-400 mr-1">Asset:</span>
                    {asset}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── TABS + REPORT ──────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden mt-5">
        {/* Tab Bar */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 p-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const cache = tabCache[tab.key];
              const count = cache.fetched ? cache.data.length : null;
              const isLoading = cache.loading;

              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabSwitch(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium
                             whitespace-nowrap rounded-t-lg transition-all duration-200
                    ${
                      isActive
                        ? "text-indigo-700 bg-white border-t-2 border-x border-indigo-500 border-x-gray-100 -mb-[1px]"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/70"
                    }`}
                >
                  <span
                    className={`transition-colors ${
                      isActive ? "text-indigo-600" : "text-gray-400"
                    }`}
                  >
                    {isLoading ? (
                      <AiOutlineLoading3Quarters
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      tab.icon
                    )}
                  </span>

                  {tab.label}

                  {count != null && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
                                  rounded-full text-[10px] font-bold transition-colors
                                  ${
                                    isActive
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-gray-200 text-gray-500"
                                  }`}
                    >
                      {count}
                    </span>
                  )}

                  {cache.fetched && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {queried && currentCache.fetched && currentCache.data.length > 0 && (
            <div className="pl-4 flex-shrink-0">
              <ExportButton
                data={currentCache.data}
                filename={currentTab.exportFilename}
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-5">
          {!queried ? (
            <QueryPlaceholder />
          ) : currentCache.loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader />
              <p className="mt-4 text-sm text-gray-400 animate-pulse flex items-center gap-2">
                <AiOutlineLoading3Quarters size={13} className="animate-spin" />
                Fetching {currentTab.label}…
              </p>
            </div>
          ) : currentCache.fetched ? (
            <div className="animate-fadeIn">
              <CurrentComponent data={currentCache.data} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <AiOutlineLoading3Quarters
                size={24}
                className="animate-spin mb-3"
              />
              <p className="text-sm">Loading {currentTab.label}…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConsolidatedReport;
