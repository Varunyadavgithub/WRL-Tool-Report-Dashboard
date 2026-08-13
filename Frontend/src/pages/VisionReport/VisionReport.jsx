import { useState } from "react";
import { FiCrosshair, FiClipboard } from "react-icons/fi";
import { SegmentedTabs, VisionHealthBadge } from "./visionShared.jsx";
import LookupPanel from "./LookupPanel.jsx";
import BatchPanel from "./BatchPanel.jsx";

// Reads a one-time deep link (e.g. a bookmarked/shared URL) without keeping
// the URL in sync afterwards — continuous syncing is what caused the old
// two-route version of this module to lose state on every navigation.
const initialParams = new URLSearchParams(window.location.search);
const initialFg = initialParams.get("fg");
const initialTab = initialParams.get("tab") === "batch" ? "batch" : "lookup";

const VisionReport = () => {
  const [tab, setTab] = useState(initialTab);
  const [lookupRequest, setLookupRequest] = useState(
    initialFg ? { serial: initialFg, nonce: 1 } : null,
  );
  const [cameFromBatch, setCameFromBatch] = useState(false);

  const openInLookup = (serial) => {
    setLookupRequest({ serial, nonce: Date.now() });
    setCameFromBatch(true);
    setTab("lookup");
  };

  const goToLookupTab = () => {
    setCameFromBatch(false);
    setTab("lookup");
  };

  const backToBatch = () => setTab("batch");

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Vision Inspection Report</h1>
          <p className="text-[11px] text-slate-400">AI Vision Inspection · Traceability</p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedTabs
            active={tab}
            onChange={(v) => (v === "lookup" ? goToLookupTab() : setTab(v))}
            tabs={[
              { value: "lookup", label: "Serial Lookup", icon: FiCrosshair },
              { value: "batch", label: "Batch Reports", icon: FiClipboard },
            ]}
          />
          <VisionHealthBadge />
        </div>
      </div>

      {/* Both panels stay mounted — switching tabs is instant and never
          loses filters, search results, or scroll position. */}
      <div className={`flex-1 min-h-0 ${tab === "lookup" ? "flex" : "hidden"}`}>
        <LookupPanel request={lookupRequest} cameFromBatch={cameFromBatch} onBackToBatch={backToBatch} />
      </div>
      <div className={`flex-1 min-h-0 ${tab === "batch" ? "flex" : "hidden"}`}>
        <BatchPanel onOpenSerial={openInLookup} />
      </div>
    </div>
  );
};

export default VisionReport;
