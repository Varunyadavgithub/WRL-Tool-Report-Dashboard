import { useState } from "react";
import { FiCopy, FiCheck, FiSearch, FiInfo } from "react-icons/fi";
import { MdQrCode2, MdOutlineNumbers } from "react-icons/md";
import { BsBoxSeam, BsLayersFill, BsLightning } from "react-icons/bs";
import { HiOutlineChip } from "react-icons/hi";
import { TbGasStation, TbArrowsExchange } from "react-icons/tb";
import { RiFlowChart } from "react-icons/ri";
import EmptyState from "../../../../components/ui/EmptyState";

// ─────────────────────────────────────────────────────────────────
// Classify a barcode by its prefix
// F... = FG Serial  |  4... = Foaming Serial  |  S... = Assembly
// ─────────────────────────────────────────────────────────────────
function classifySerial(barcode) {
  if (!barcode) return { type: "UNKNOWN", label: "Unknown", short: "?", order: 99 };
  const b = barcode.toString().toUpperCase();
  if (b.startsWith("F"))
    return { type: "FG",       label: "FG Serial",       short: "FG",   order: 3,
             bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700",
             badgeBg: "bg-emerald-100", icon: HiOutlineChip,
             gradFrom: "from-emerald-500", gradTo: "to-teal-500",
             ringColor: "ring-emerald-300",
             desc: "Final Good serial — used for shipment & logistics tracking" };
  if (b.startsWith("4"))
    return { type: "FOAMING",  label: "Foaming Serial",  short: "FOAM", order: 2,
             bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700",
             badgeBg: "bg-blue-100", icon: TbGasStation,
             gradFrom: "from-blue-500", gradTo: "to-indigo-500",
             ringColor: "ring-blue-300",
             desc: "Foaming process serial — linked to insulation stage" };
  if (b.startsWith("S"))
    return { type: "ASSEMBLY", label: "Assembly Serial",  short: "ASM",  order: 1,
             bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-700",
             badgeBg: "bg-violet-100", icon: BsLayersFill,
             gradFrom: "from-violet-500", gradTo: "to-purple-600",
             ringColor: "ring-violet-300",
             desc: "Assembly serial — anchor for all stage history queries" };
  return { type: "OTHER", label: "Serial", short: "SN", order: 0,
           bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700",
           badgeBg: "bg-gray-100", icon: MdOutlineNumbers,
           gradFrom: "from-gray-500", gradTo: "to-gray-600",
           ringColor: "ring-gray-300",
           desc: "Serial number" };
}

// ─────────────────────────────────────────────────────────────────
// Copy-to-clipboard button
// ─────────────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold
                  transition-all duration-200 cursor-pointer
                  ${copied
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300"
                  }`}
    >
      {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Serial Card
// ─────────────────────────────────────────────────────────────────
function SerialCard({ barcode, meta, isActive, isAnchor }) {
  if (!barcode) {
    return (
      <div className="flex-1 min-w-[180px] flex flex-col items-center gap-2
                      p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <MdOutlineNumbers size={22} className="text-gray-300" />
        </div>
        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">{meta.label}</p>
        <p className="text-xs text-gray-300 italic">Not found</p>
      </div>
    );
  }

  const Icon = meta.icon;
  return (
    <div className={`flex-1 min-w-[200px] relative flex flex-col gap-3 p-5 rounded-2xl border-2
                     transition-all duration-200
                     ${isActive
                       ? `${meta.bg} ${meta.border} ring-4 ${meta.ringColor}/40 shadow-lg`
                       : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                     }`}>
      {isAnchor && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 px-2 py-0.5
                         bg-amber-400 text-white text-[10px] font-black rounded-full shadow-sm uppercase tracking-wider">
          <BsLightning size={9} /> Anchor
        </span>
      )}
      {isActive && (
        <span className={`absolute -top-2.5 right-3 inline-flex items-center gap-1 px-2 py-0.5
                          bg-gradient-to-r ${meta.gradFrom} ${meta.gradTo}
                          text-white text-[10px] font-black rounded-full shadow-sm uppercase tracking-wider`}>
          Current
        </span>
      )}

      {/* Icon + label */}
      <div className="flex items-center gap-2.5">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradFrom} ${meta.gradTo}
                         flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{meta.label}</p>
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.badgeBg} ${meta.text}`}>
            {meta.short}
          </span>
        </div>
      </div>

      {/* Barcode value */}
      <div className="flex flex-col gap-1.5">
        <p className={`font-mono text-sm font-bold break-all leading-tight
                       ${isActive ? meta.text : "text-gray-800"}`}>
          {barcode}
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed">{meta.desc}</p>
      </div>

      {/* Copy */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <span className="text-[10px] text-gray-400">
          {barcode.length} chars
        </span>
        <CopyBtn value={barcode} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Connection Arrow
// ─────────────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="flex flex-col items-center justify-center flex-shrink-0 px-1">
      <div className="flex flex-col items-center gap-1 text-gray-300">
        <div className="w-px h-4 bg-gradient-to-b from-gray-200 to-gray-300" />
        <TbArrowsExchange size={16} className="text-gray-400 rotate-90 sm:rotate-0" />
        <div className="w-px h-4 bg-gradient-to-b from-gray-300 to-gray-200" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Raw table of all ProcessStageLabel rows
// ─────────────────────────────────────────────────────────────────
function RawTable({ rows }) {
  const keys = rows.length > 0
    ? Object.keys(rows[0]).filter(k => !["BarcodeType","Material"].includes(k))
    : [];

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <RiFlowChart size={14} className="text-gray-500" />
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          Raw ProcessStageLabel Records ({rows.length} rows)
        </p>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-800 text-gray-200">
              {keys.map((k, i) => (
                <th key={i}
                    className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-r border-gray-700 last:border-0">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, ri) => (
              <tr key={ri} className={`${ri % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-indigo-50/30`}>
                {keys.map((k, ki) => (
                  <td key={ki} className="px-3 py-2 text-center font-mono text-gray-600 border-r border-gray-100 last:border-0 whitespace-nowrap">
                    {row[k] != null
                      ? String(row[k]).replace("T", " ").replace("Z", "").substring(0, 19)
                      : <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────
function SerialNumbersTable({ data, currentIdentifier }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyState message="No serial number data found for this identifier." />;
  }

  // Classify & sort: Assembly → Foaming → FG
  const classified = data.map(row => ({
    ...row,
    _meta: classifySerial(row.BarcodeNo),
  })).sort((a, b) => a._meta.order - b._meta.order);

  const fgRow       = classified.find(r => r._meta.type === "FG");
  const foamingRow  = classified.find(r => r._meta.type === "FOAMING");
  const assemblyRow = classified.find(r => r._meta.type === "ASSEMBLY");

  // "Anchor" = the last serial (Assembly if exists, else Foaming, else whatever is lowest order)
  const anchorRow   = assemblyRow || foamingRow || classified[0];
  const anchorBarcode = anchorRow?.BarcodeNo;

  // PSNo shared across all
  const psNo = data[0]?.PSNo;

  // Material info from FG row if available
  const materialName = fgRow?.MaterialName || foamingRow?.MaterialName || assemblyRow?.MaterialName || "";
  const sapCode      = fgRow?.SAPCode      || foamingRow?.SAPCode      || assemblyRow?.SAPCode      || "";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header strip ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl
                      bg-gradient-to-r from-slate-50 via-indigo-50/40 to-violet-50/30
                      border border-indigo-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center shadow-sm">
            <MdQrCode2 size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-700 uppercase tracking-wider">Production Order</p>
            <p className="font-mono text-lg font-black text-indigo-700">{psNo || "—"}</p>
          </div>
        </div>
        {materialName && (
          <>
            <div className="w-px h-10 bg-gray-200 hidden sm:block" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Material</p>
              <p className="text-sm font-bold text-gray-700">{materialName}</p>
            </div>
          </>
        )}
        {sapCode && (
          <>
            <div className="w-px h-10 bg-gray-200 hidden sm:block" />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SAP Code</p>
              <p className="font-mono text-sm font-bold text-gray-700">{sapCode}</p>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-semibold text-gray-600">
            <BsBoxSeam size={11} className="text-indigo-500" />
            {data.length} serials linked
          </span>
        </div>
      </div>

      {/* ── Info banner about anchor ─────────────────────── */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FiInfo size={13} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-800">How serials are linked</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            All three serials share the same <span className="font-bold">Production Order (PSNo: {psNo})</span>.
            The <span className="font-bold">Assembly Serial</span> (marked as <span className="font-bold text-amber-900">Anchor</span>) is
            the base identifier used to look up Stage History, Rework, and History Card data.
            Searching with any of these three serials will return the same report.
          </p>
        </div>
      </div>

      {/* ── Three linked serial cards ──────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <SerialCard
          barcode={assemblyRow?.BarcodeNo}
          meta={classifySerial(assemblyRow?.BarcodeNo || "S")}
          isActive={currentIdentifier === assemblyRow?.BarcodeNo}
          isAnchor={anchorBarcode === assemblyRow?.BarcodeNo}
        />
        <Arrow />
        <SerialCard
          barcode={foamingRow?.BarcodeNo}
          meta={classifySerial(foamingRow?.BarcodeNo || "4")}
          isActive={currentIdentifier === foamingRow?.BarcodeNo}
          isAnchor={anchorBarcode === foamingRow?.BarcodeNo && anchorBarcode !== assemblyRow?.BarcodeNo}
        />
        <Arrow />
        <SerialCard
          barcode={fgRow?.BarcodeNo}
          meta={classifySerial(fgRow?.BarcodeNo || "F")}
          isActive={currentIdentifier === fgRow?.BarcodeNo}
          isAnchor={false}
        />
      </div>

      {/* ── Other serials (if more than 3) ──────────────── */}
      {classified.filter(r => !["FG","FOAMING","ASSEMBLY"].includes(r._meta.type)).length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Additional Serials</p>
          </div>
          <div className="divide-y divide-gray-100">
            {classified
              .filter(r => !["FG","FOAMING","ASSEMBLY"].includes(r._meta.type))
              .map((row, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-gray-700">{row.BarcodeNo}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                      {row._meta.short}
                    </span>
                  </div>
                  <CopyBtn value={row.BarcodeNo} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Copy All button ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          onClick={() => {
            const all = [assemblyRow?.BarcodeNo, foamingRow?.BarcodeNo, fgRow?.BarcodeNo]
              .filter(Boolean).join("\n");
            navigator.clipboard.writeText(all);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                     bg-white text-xs font-semibold text-gray-600
                     hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300
                     transition-all cursor-pointer shadow-sm"
        >
          <FiCopy size={12} /> Copy All Serials
        </button>

        <button
          onClick={() => setShowRaw(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                     bg-white text-xs font-semibold text-gray-500
                     hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer"
        >
          <FiSearch size={12} />
          {showRaw ? "Hide" : "Show"} Raw Records
        </button>
      </div>

      {/* ── Raw table toggle ────────────────────────────── */}
      {showRaw && <RawTable rows={data} />}
    </div>
  );
}

export default SerialNumbersTable;