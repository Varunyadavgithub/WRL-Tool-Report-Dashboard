import { useState } from "react";
import {
  Copy,
  Check,
  Search,
  Info,
  ArrowLeftRight,
  Package,
  QrCode,
  Layers,
  Zap,
  Hash,
} from "lucide-react";
import EmptyState from "../../../../components/ui/EmptyState";

// ── Classify a barcode ─────────────────────────────────────────────────────────
function classifySerial(barcode) {
  if (!barcode)
    return { type: "UNKNOWN", label: "Unknown", short: "?", order: 99 };
  const b = barcode.toString().toUpperCase();
  if (b.startsWith("F"))
    return {
      type: "FG",
      label: "FG Serial",
      short: "FG",
      order: 3,
      bg: "bg-emerald-50",
      border: "border-emerald-300",
      text: "text-emerald-700",
      badgeBg: "bg-emerald-100",
      gradFrom: "from-emerald-500",
      gradTo: "to-teal-500",
      ringColor: "ring-emerald-300",
      desc: "Final Good serial — used for shipment & logistics tracking",
    };
  if (b.startsWith("4"))
    return {
      type: "FOAMING",
      label: "Foaming Serial",
      short: "FOAM",
      order: 2,
      bg: "bg-blue-50",
      border: "border-blue-300",
      text: "text-blue-700",
      badgeBg: "bg-blue-100",
      gradFrom: "from-blue-500",
      gradTo: "to-indigo-500",
      ringColor: "ring-blue-300",
      desc: "Foaming process serial — linked to insulation stage",
    };
  if (b.startsWith("S"))
    return {
      type: "ASSEMBLY",
      label: "Assembly Serial",
      short: "ASM",
      order: 1,
      bg: "bg-violet-50",
      border: "border-violet-300",
      text: "text-violet-700",
      badgeBg: "bg-violet-100",
      gradFrom: "from-violet-500",
      gradTo: "to-purple-600",
      ringColor: "ring-violet-300",
      desc: "Assembly serial — anchor for all stage history queries",
    };
  return {
    type: "OTHER",
    label: "Serial",
    short: "SN",
    order: 0,
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700",
    badgeBg: "bg-slate-100",
    gradFrom: "from-slate-500",
    gradTo: "to-slate-600",
    ringColor: "ring-slate-300",
    desc: "Serial number",
  };
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title="Copy to clipboard"
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
        copied
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      {copied ? (
        <Check className="w-2.5 h-2.5" />
      ) : (
        <Copy className="w-2.5 h-2.5" />
      )}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Serial Card ────────────────────────────────────────────────────────────────
function SerialCard({ barcode, meta, isActive, isAnchor }) {
  if (!barcode) {
    return (
      <div className="flex-1 min-w-[180px] flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
          <Hash className="w-5 h-5 text-slate-300" />
        </div>
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
          {meta.label}
        </p>
        <p className="text-xs text-slate-300 italic">Not found</p>
      </div>
    );
  }
  return (
    <div
      className={`flex-1 min-w-[200px] relative flex flex-col gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
        isActive
          ? `${meta.bg} ${meta.border} ring-4 ${meta.ringColor}/40 shadow-lg`
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      {isAnchor && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-white text-[10px] font-black rounded-full shadow-sm uppercase tracking-wider">
          <Zap className="w-2.5 h-2.5" /> Anchor
        </span>
      )}
      {isActive && (
        <span
          className={`absolute -top-2.5 right-3 inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r ${meta.gradFrom} ${meta.gradTo} text-white text-[10px] font-black rounded-full shadow-sm uppercase tracking-wider`}
        >
          Current
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradFrom} ${meta.gradTo} flex items-center justify-center shadow-sm shrink-0`}
        >
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {meta.label}
          </p>
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.badgeBg} ${meta.text}`}
          >
            {meta.short}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p
          className={`font-mono text-sm font-bold break-all leading-tight ${isActive ? meta.text : "text-slate-800"}`}
        >
          {barcode}
        </p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          {meta.desc}
        </p>
      </div>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400">
          {barcode.length} chars
        </span>
        <CopyBtn value={barcode} />
      </div>
    </div>
  );
}

// ── Arrow ──────────────────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 px-1">
      <div className="flex flex-col items-center gap-1 text-slate-300">
        <div className="w-px h-4 bg-gradient-to-b from-slate-200 to-slate-300" />
        <ArrowLeftRight className="w-4 h-4 text-slate-400 rotate-90 sm:rotate-0" />
        <div className="w-px h-4 bg-gradient-to-b from-slate-300 to-slate-200" />
      </div>
    </div>
  );
}

// ── Raw Table ──────────────────────────────────────────────────────────────────
function RawTable({ rows }) {
  const keys =
    rows.length > 0
      ? Object.keys(rows[0]).filter(
          (k) => !["BarcodeType", "Material"].includes(k),
        )
      : [];
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Raw ProcessStageLabel Records ({rows.length} rows)
        </p>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 text-slate-200">
              {keys.map((k, i) => (
                <th
                  key={i}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-r border-slate-700 last:border-0"
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`${ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-blue-50/30`}
              >
                {keys.map((k, ki) => (
                  <td
                    key={ki}
                    className="px-3 py-2 text-center font-mono text-slate-600 border-r border-slate-100 last:border-0 whitespace-nowrap"
                  >
                    {row[k] != null ? (
                      String(row[k])
                        .replace("T", " ")
                        .replace("Z", "")
                        .substring(0, 19)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
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

// ── Main ───────────────────────────────────────────────────────────────────────
function SerialNumbersTable({ data, currentIdentifier }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <EmptyState message="No serial number data found for this identifier." />
    );
  }

  const classified = data
    .map((row) => ({ ...row, _meta: classifySerial(row.BarcodeNo) }))
    .sort((a, b) => a._meta.order - b._meta.order);
  const fgRow = classified.find((r) => r._meta.type === "FG");
  const foamingRow = classified.find((r) => r._meta.type === "FOAMING");
  const assemblyRow = classified.find((r) => r._meta.type === "ASSEMBLY");
  const anchorRow = assemblyRow || foamingRow || classified[0];
  const anchorBarcode = anchorRow?.BarcodeNo;
  const psNo = data[0]?.PSNo;
  const materialName =
    fgRow?.MaterialName ||
    foamingRow?.MaterialName ||
    assemblyRow?.MaterialName ||
    "";
  const sapCode =
    fgRow?.SAPCode || foamingRow?.SAPCode || assemblyRow?.SAPCode || "";

  return (
    <div className="flex flex-col gap-5">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Production Order
            </p>
            <p className="font-mono text-lg font-black text-blue-700">
              {psNo || "—"}
            </p>
          </div>
        </div>
        {materialName && (
          <>
            <div className="w-px h-10 bg-slate-200 hidden sm:block" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Material
              </p>
              <p className="text-sm font-bold text-slate-700">{materialName}</p>
            </div>
          </>
        )}
        {sapCode && (
          <>
            <div className="w-px h-10 bg-slate-200 hidden sm:block" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                SAP Code
              </p>
              <p className="font-mono text-sm font-bold text-slate-700">
                {sapCode}
              </p>
            </div>
          </>
        )}
        <div className="ml-auto">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600">
            <Package className="w-3 h-3 text-blue-500" /> {data.length} serials
            linked
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-800">
            How serials are linked
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            All three serials share the same{" "}
            <span className="font-bold">Production Order (PSNo: {psNo})</span>.
            The <span className="font-bold">Assembly Serial</span> (marked as{" "}
            <span className="font-bold text-amber-900">Anchor</span>) is the
            base identifier used to look up Stage History, Rework, and History
            Card data. Searching with any of these three serials will return the
            same report.
          </p>
        </div>
      </div>

      {/* Three linked cards */}
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
          isAnchor={
            anchorBarcode === foamingRow?.BarcodeNo &&
            anchorBarcode !== assemblyRow?.BarcodeNo
          }
        />
        <Arrow />
        <SerialCard
          barcode={fgRow?.BarcodeNo}
          meta={classifySerial(fgRow?.BarcodeNo || "F")}
          isActive={currentIdentifier === fgRow?.BarcodeNo}
          isAnchor={false}
        />
      </div>

      {/* Other serials */}
      {classified.filter(
        (r) => !["FG", "FOAMING", "ASSEMBLY"].includes(r._meta.type),
      ).length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Additional Serials
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {classified
              .filter(
                (r) => !["FG", "FOAMING", "ASSEMBLY"].includes(r._meta.type),
              )
              .map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {row.BarcodeNo}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">
                      {row._meta.short}
                    </span>
                  </div>
                  <CopyBtn value={row.BarcodeNo} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          onClick={() => {
            const all = [
              assemblyRow?.BarcodeNo,
              foamingRow?.BarcodeNo,
              fgRow?.BarcodeNo,
            ]
              .filter(Boolean)
              .join("\n");
            navigator.clipboard.writeText(all);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
        >
          <Copy className="w-3 h-3" /> Copy All Serials
        </button>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer"
        >
          <Search className="w-3 h-3" /> {showRaw ? "Hide" : "Show"} Raw Records
        </button>
      </div>

      {showRaw && <RawTable rows={data} />}
    </div>
  );
}

export default SerialNumbersTable;
