import { useState } from "react";
import EmptyState from "../../../../components/ui/EmptyState";
import {
  FiCheckCircle, FiXCircle, FiClock, FiAlertTriangle,
} from "react-icons/fi";
import { BsLightningCharge } from "react-icons/bs";
import { TbGasStation, TbReportAnalytics } from "react-icons/tb";
import { MdOutlineMultilineChart } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

// ─────────────────────────────────────────────────────────────────
// Inner Tab Config
// ─────────────────────────────────────────────────────────────────
const INNER_TABS = [
  {
    key: "gasCharging",
    label: "Gas Charging",
    short: "Gas",
    Icon: TbGasStation,
    activeBg: "bg-teal-50",
    activeBorder: "border-teal-500",
    activeText: "text-teal-700",
    iconActive: "text-teal-600",
    headerGrad: "from-teal-600 to-emerald-600",
    altRow: "bg-teal-50/30",
    badge: "bg-teal-100 text-teal-700",
    resultKey: "PERFORMANCE",
  },
  {
    key: "est",
    label: "Electrical Safety Test",
    short: "EST",
    Icon: BsLightningCharge,
    activeBg: "bg-amber-50",
    activeBorder: "border-amber-500",
    activeText: "text-amber-700",
    iconActive: "text-amber-600",
    headerGrad: "from-amber-500 to-orange-500",
    altRow: "bg-amber-50/30",
    badge: "bg-amber-100 text-amber-700",
    resultKey: "result",
  },
  {
    key: "mft",
    label: "Multi-Function Test",
    short: "MFT",
    Icon: MdOutlineMultilineChart,
    activeBg: "bg-indigo-50",
    activeBorder: "border-indigo-500",
    activeText: "text-indigo-700",
    iconActive: "text-indigo-600",
    headerGrad: "from-indigo-500 to-purple-600",
    altRow: "bg-indigo-50/30",
    badge: "bg-indigo-100 text-indigo-700",
    resultKey: "STATUS",
  },
  {
    key: "cpt",
    label: "Compressor Performance",
    short: "CPT",
    Icon: TbReportAnalytics,
    activeBg: "bg-rose-50",
    activeBorder: "border-rose-500",
    activeText: "text-rose-700",
    iconActive: "text-rose-600",
    headerGrad: "from-rose-500 to-pink-600",
    altRow: "bg-rose-50/30",
    badge: "bg-rose-100 text-rose-700",
    resultKey: "PERFORMANCE",
  },
];

// ─────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-300 italic text-xs">—</span>;
  const v = status.toString().toUpperCase();
  const cfg = {
    PASS:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FiCheckCircle size={10} /> },
    PASSED:  { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FiCheckCircle size={10} /> },
    OK:      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FiCheckCircle size={10} /> },
    ACTIVE:  { cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: <FiCheckCircle size={10} /> },
    FAIL:    { cls: "bg-red-50 text-red-700 border-red-200",             icon: <FiXCircle size={10} /> },
    NG:      { cls: "bg-red-50 text-red-700 border-red-200",             icon: <FiXCircle size={10} /> },
    FAILED:  { cls: "bg-red-50 text-red-700 border-red-200",             icon: <FiXCircle size={10} /> },
    PENDING: { cls: "bg-amber-50 text-amber-700 border-amber-200",       icon: <FiClock size={10} /> },
    INACTIVE:{ cls: "bg-gray-100 text-gray-500 border-gray-200",         icon: null },
  };
  const s = cfg[v] || { cls: "bg-gray-50 text-gray-500 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${s.cls}`}>
      {s.icon}{status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pass/Fail summary bar (shown above each table)
// ─────────────────────────────────────────────────────────────────
function PassFailBar({ data, resultKey }) {
  if (!data || data.length === 0) return null;
  const total = data.length;
  const pass = data.filter(d => {
    const v = (d[resultKey] || "").toString().toUpperCase();
    return ["PASS", "PASSED", "OK"].includes(v);
  }).length;
  const fail = total - pass;
  const pct = Math.round((pass / total) * 100);

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center gap-3 text-xs font-semibold">
        <span className="text-gray-400">{total} records</span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="text-emerald-600 flex items-center gap-1">
          <FiCheckCircle size={11} /> {pass} Pass
        </span>
        {fail > 0 && (
          <span className="text-red-600 flex items-center gap-1">
            <FiXCircle size={11} /> {fail} Fail
          </span>
        )}
      </div>
      <div className="flex-1 max-w-[180px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fail > 0 ? "bg-emerald-400" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-black ${fail > 0 ? "text-red-500" : "text-emerald-600"}`}>
        {pct}% Pass
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Th helper
// ─────────────────────────────────────────────────────────────────
const Th = ({ children, ...props }) => (
  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center
                 border-r border-white/10 last:border-0 whitespace-nowrap" {...props}>
    {children}
  </th>
);
const Td = ({ children, className = "", ...props }) => (
  <td className={`px-3 py-2.5 text-xs ${className}`} {...props}>{children}</td>
);

// ─────────────────────────────────────────────────────────────────
// Gas Charging Table
// ─────────────────────────────────────────────────────────────────
function GasChargingTable({ data, tabConfig }) {
  const headers = [
    "Sr","Result ID","Date","Time","Barcode","Model Name","Model",
    "Runtime(s)","Refrigerant","Set Gas Wt","Actual Gas Wt",
    "Leak Set","Leak Read","Leak Time","Evac Set","Evac Actual","Evac Time",
    "Performance","Fault Code","Fault Name","Sync","Machine",
  ];
  const getR = d => d.PERFORMANCE ?? d.RESULT ?? d.STATUS ?? "";

  return (
    <>
      <PassFailBar data={data} resultKey="PERFORMANCE" />
      <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1600px" }}>
          <thead className="sticky top-0 z-10">
            <tr className={`bg-gradient-to-r ${tabConfig.headerGrad} text-white`}>
              {headers.map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? data.map((item, i) => {
              const r = getR(item);
              const fail = ["FAIL","NG"].includes(r?.toUpperCase());
              const bg = fail ? "bg-red-50/60" : i % 2 === 0 ? "bg-white" : tabConfig.altRow;
              return (
                <tr key={i} className={`text-center transition-colors ${bg} hover:bg-indigo-50/30`}>
                  <Td className="font-bold text-gray-400">{i + 1}</Td>
                  <Td className="font-mono">{item.Result_ID || "—"}</Td>
                  <Td>{item.DATE || "—"}</Td>
                  <Td className="font-mono">{item.TIME || "—"}</Td>
                  <Td className="font-mono font-semibold text-teal-700">{item.BARCODE || "—"}</Td>
                  <Td className="text-left">{item.MODELNAME || "—"}</Td>
                  <Td>{item.MODEL || "—"}</Td>
                  <Td className="font-mono">{item.RUNTIME_SECONDS?.trim() || "—"}</Td>
                  <Td className="uppercase">{item.REFRIGERANT || "—"}</Td>
                  <Td className="font-mono">{item.SET_GAS_WEIGHT?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.ACTUAL_GAS_WEIGHT?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.LEAK_SET_VALUE?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.LEAK_TEST_VALUE?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.LEAK_TEST_TIME?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.SET_EVACUATION_VALUE?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.ACTUAL_EVACUATION_VALUE?.trim() || "—"}</Td>
                  <Td className="font-mono">{item.ACTUAL_EVACUATION_TIME?.trim() || "—"}</Td>
                  <Td><StatusBadge status={r} /></Td>
                  <Td>{item.FaultCode || "—"}</Td>
                  <Td className="text-left">{item.FaultName || "—"}</Td>
                  <Td>{item.SyncStatus || "—"}</Td>
                  <Td>{item.MACHINE || "—"}</Td>
                </tr>
              );
            }) : (
              <tr><td colSpan={headers.length}><EmptyState message="No Gas Charging data found." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// EST Table
// ─────────────────────────────────────────────────────────────────
function ESTTable({ data = [], tabConfig }) {
  const groups = [
    { label: "Sr No",       children: ["Sr No"]       },
    { label: "Ref No",      children: ["Ref No"]      },
    { label: "Model No",    children: ["Model No"]    },
    { label: "Serial No",   children: ["Serial No"]   },
    { label: "Date Time",   children: ["Date Time"]   },
    { label: "Operator",    children: ["Operator"]    },
    { label: "ECT",         children: ["Set Ω","Set T","Read Ω","Result"]      },
    { label: "HV",          children: ["Set kV","Set mA","Set T","Read kV","Result"] },
    { label: "IR",          children: ["Set MΩ","Set T","Read MΩ","Result"]     },
    { label: "LCT LN",      children: ["Set mA","Set T","Read mA","Read V","Result"] },
    { label: "LCT NL",      children: ["Read mA","Read V","Result"]             },
    { label: "Final Result",children: ["Final Result"] },
    { label: "Status",      children: ["Status"]       },
  ];
  const single = g => g.children.length === 1;
  const fmt = iso => iso ? new Date(iso).toLocaleString() : "—";

  return (
    <>
      <PassFailBar data={data} resultKey="result" />
      <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "2400px" }}>
          <thead className="sticky top-0 z-10">
            <tr className={`bg-gradient-to-r ${tabConfig?.headerGrad} text-white`}>
              {groups.map((g, i) => (
                <th key={i} colSpan={g.children.length} rowSpan={single(g) ? 2 : 1}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center
                                border border-white/20 ${!single(g) ? "border-b-2 border-b-white/40" : ""}`}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className={`bg-gradient-to-r ${tabConfig?.headerGrad} text-white/90`}>
              {groups.filter(g => !single(g)).flatMap((g, gi) =>
                g.children.map((c, ci) => (
                  <th key={`${gi}-${ci}`}
                      className="px-2 py-1.5 text-[9px] font-semibold uppercase text-center border border-white/10">
                    {c}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? data.map((item, i) => {
              const fail = item.result && item.result.toUpperCase() !== "PASS";
              const bg = fail ? "bg-red-50/60" : i % 2 === 0 ? "bg-white" : tabConfig?.altRow;
              return (
                <tr key={i} className={`text-center transition-colors ${bg} hover:bg-indigo-50/30`}>
                  {[
                    <Td className="font-bold text-gray-400 border border-gray-100">{i + 1}</Td>,
                    <Td className="font-mono border border-gray-100">{item.RefNo ?? "—"}</Td>,
                    <Td className="text-left border border-gray-100">{item.model_no ?? "—"}</Td>,
                    <Td className="font-mono font-semibold text-amber-700 border border-gray-100">{item.serial_no ?? "—"}</Td>,
                    <Td className="border border-gray-100">{fmt(item.date_time)}</Td>,
                    <Td className="border border-gray-100">{item.operator ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_ect_ohms ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_ect_time ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_ect_ohms ?? "—"}</Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.ect_result} /></Td>,
                    <Td className="border border-gray-100">{item.set_hv_kv ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_hv_ma ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_hv_time ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_hv_kv ?? "—"}</Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.hv_result} /></Td>,
                    <Td className="border border-gray-100">{item.set_ir_mohms ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_ir_time ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_ir_mohms === "> LIMIT" || item.read_ir_mohms === "-" ? "> LIMIT" : (item.read_ir_mohms ?? "—")}</Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.ir_result} /></Td>,
                    <Td className="border border-gray-100">{item.set_lct_ma ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.set_lct_time ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_lct_ln_ma ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_lct_ln_Vtg ?? "—"}</Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.lct_ln_result} /></Td>,
                    <Td className="border border-gray-100">{item.read_lct_nl_ma ?? "—"}</Td>,
                    <Td className="border border-gray-100">{item.read_lct_nl_Vtg ?? "—"}</Td>,
                    <Td className="border border-gray-100"><StatusBadge status={!item.lct_nl_result || item.lct_nl_result === "-" ? "Pass" : item.lct_nl_result} /></Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.result} /></Td>,
                    <Td className="border border-gray-100"><StatusBadge status={item.status === 1 ? "Active" : "Inactive"} /></Td>,
                  ].map((cell, ci) => ({ ...cell, key: ci }))}
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={groups.reduce((s, g) => s + g.children.length, 0)}>
                  <EmptyState message="No EST data found." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// MFT Table
// ─────────────────────────────────────────────────────────────────
function MFTTable({ data, tabConfig }) {
  const headers = [
    "Sr","ID","Product Code","Equipment No","Pass/Fail Times",
    "MFT No","Status","Error Code","Start Time","Stop Time",
    "Reason","PDF File","Sync",
  ];
  return (
    <>
      <PassFailBar data={data} resultKey="STATUS" />
      <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1200px" }}>
          <thead className="sticky top-0 z-10">
            <tr className={`bg-gradient-to-r ${tabConfig.headerGrad} text-white`}>
              {headers.map((h, i) => <Th key={i}>{h}</Th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? data.map((item, i) => {
              const r = item.STATUS ?? "";
              const fail = !["PASS","PASSED"].includes(r?.toUpperCase());
              const bg = fail ? "bg-red-50/60" : i % 2 === 0 ? "bg-white" : tabConfig.altRow;
              return (
                <tr key={i} className={`text-center transition-colors ${bg} hover:bg-indigo-50/30`}>
                  <Td className="font-bold text-gray-400">{i + 1}</Td>
                  <Td className="font-mono">{item.ID || "—"}</Td>
                  <Td>{item.PRODUCT_CODE || "—"}</Td>
                  <Td className="font-mono font-semibold text-indigo-700">{item.EQUIPMENT_NO || "—"}</Td>
                  <Td>{item.PASS_FAILED_TIMES || "—"}</Td>
                  <Td className="font-mono">{item.MFT_NO || "—"}</Td>
                  <Td><StatusBadge status={item.STATUS} /></Td>
                  <Td>{item.ERRORCODE || "—"}</Td>
                  <Td>{item.START_TIME || "—"}</Td>
                  <Td>{item.STOP_TIME || "—"}</Td>
                  <Td className="text-left max-w-[150px] truncate">{item.REASON || "—"}</Td>
                  <Td>{item.PDFFileName || "—"}</Td>
                  <Td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.SYNCSTATUS === 1 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {item.SYNCSTATUS === 1 ? "Synced" : "Pending"}
                    </span>
                  </Td>
                </tr>
              );
            }) : (
              <tr><td colSpan={headers.length}><EmptyState message="No MFT data found." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// CPT Table
// ─────────────────────────────────────────────────────────────────
function CPTTable({ data = [], tabConfig }) {
  const fmtNum = v => {
    if (v === null || v === undefined) return "—";
    const n = Number(v); if (isNaN(n)) return v;
    return n % 1 === 0 ? n.toString() : n.toFixed(3);
  };

  const groups = [
    { label: "Sr",            children: ["Sr"]           },
    { label: "Result ID",     children: ["Result ID"]    },
    { label: "Date",          children: ["Date"]         },
    { label: "Time",          children: ["Time"]         },
    { label: "Barcode",       children: ["Barcode"]      },
    { label: "Model",         children: ["Model"]        },
    { label: "Model Name",    children: ["Model Name"]   },
    { label: "Runtime (min)", children: ["Min"]          },
    { label: "Temp (°C)",     children: ["Min","Max"]    },
    { label: "Current (A)",   children: ["Min","Max"]    },
    { label: "Voltage (V)",   children: ["Min","Max"]    },
    { label: "Power (W)",     children: ["Min","Max"]    },
    { label: "Performance",   children: ["Performance"]  },
    { label: "Fault Code",    children: ["Fault Code"]   },
    { label: "Fault Name",    children: ["Fault Name"]   },
    { label: "Area",          children: ["Area"]         },
  ];
  const single = g => g.children.length === 1;

  return (
    <>
      <PassFailBar data={data} resultKey="PERFORMANCE" />
      <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1900px" }}>
          <thead className="sticky top-0 z-10">
            <tr className={`bg-gradient-to-r ${tabConfig?.headerGrad} text-white`}>
              {groups.map((g, i) => (
                <th key={i} colSpan={g.children.length} rowSpan={single(g) ? 2 : 1}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center
                                border border-white/20 ${!single(g) ? "border-b-2 border-b-white/40" : ""}`}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className={`bg-gradient-to-r ${tabConfig?.headerGrad} text-white/90`}>
              {groups.filter(g => !single(g)).flatMap((g, gi) =>
                g.children.map((c, ci) => (
                  <th key={`${gi}-${ci}`}
                      className="px-2 py-1.5 text-[9px] font-semibold uppercase text-center border border-white/10">
                    {c}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? data.map((item, i) => {
              const r = item.PERFORMANCE ?? "";
              const fail = ["FAIL","NG"].includes(r?.toUpperCase());
              const bg = fail ? "bg-red-50/60" : i % 2 === 0 ? "bg-white" : tabConfig?.altRow;
              return (
                <tr key={i} className={`text-center transition-colors ${bg} hover:bg-rose-50/30`}>
                  <Td className="font-bold text-gray-400 border border-gray-100">{i + 1}</Td>
                  <Td className="font-mono border border-gray-100">{item.Result_ID ?? "—"}</Td>
                  <Td className="border border-gray-100">{item.DATE ?? "—"}</Td>
                  <Td className="font-mono border border-gray-100">{item.TIME ?? "—"}</Td>
                  <Td className="font-mono font-semibold text-rose-700 border border-gray-100">{item.BARCODE ?? "—"}</Td>
                  <Td className="border border-gray-100">{item.MODEL ?? "—"}</Td>
                  <Td className="text-left border border-gray-100">{item.MODELNAME ?? "—"}</Td>
                  <Td className="font-mono font-bold border border-gray-100">{item.RUNTIME_MINUTES ?? "—"}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MIN_TEMPERATURE)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MAX_TEMPERATURE)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MIN_CURRENT)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MAX_CURRENT)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MIN_VOLTAGE)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MAX_VOLTAGE)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MIN_POWER)}</Td>
                  <Td className="font-mono border border-gray-100">{fmtNum(item.MAX_POWER)}</Td>
                  <Td className="border border-gray-100"><StatusBadge status={r} /></Td>
                  <Td className="font-mono border border-gray-100">{item.FaultCode ?? "—"}</Td>
                  <Td className="text-left border border-gray-100">{item.FaultName ?? "—"}</Td>
                  <Td className="font-mono border border-gray-100">{item.AREA_ID ?? "—"}</Td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={groups.reduce((s, g) => s + g.children.length, 0)}>
                  <EmptyState message="No CPT data found." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

const TABLE_MAP = { gasCharging: GasChargingTable, est: ESTTable, mft: MFTTable, cpt: CPTTable };

// ─────────────────────────────────────────────────────────────────
// Main FunctionalTestTable — BUG FIX: cpt now correctly received
// ─────────────────────────────────────────────────────────────────
function FunctionalTestTable({ data }) {
  const dataMap = {
    gasCharging: data?.gasCharging || [],
    est:         data?.est         || [],
    mft:         data?.mft         || [],
    cpt:         data?.cpt         || [],  // ← BUG FIX: was missing / ignored
  };

  const total = Object.values(dataMap).reduce((s, d) => s + d.length, 0);
  const firstWithData = INNER_TABS.find(t => dataMap[t.key]?.length > 0);
  const [active, setActive] = useState(firstWithData?.key || INNER_TABS[0].key);

  if (total === 0) return <EmptyState message="No functional test data found for this serial number." />;

  const activeConfig = INNER_TABS.find(t => t.key === active);
  const ActiveTable  = TABLE_MAP[active];

  return (
    <div className="flex flex-col gap-3">

      {/* Mini stat cards — clickable to switch tab */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {INNER_TABS.map(tab => {
          const Icon  = tab.Icon;
          const count = dataMap[tab.key]?.length || 0;
          const isAct = active === tab.key;
          const pass  = dataMap[tab.key]?.filter(d => {
            const v = (d[tab.resultKey] || "").toString().toUpperCase();
            return ["PASS","PASSED","OK"].includes(v);
          }).length || 0;
          const hasFail = count > 0 && pass < count;

          return (
            <button key={tab.key} onClick={() => setActive(tab.key)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer
                          transition-all duration-150 hover:shadow-md hover:-translate-y-0.5
                          ${isAct
                            ? `${tab.activeBg} ${tab.activeBorder} ${tab.activeText} border-2 shadow-sm`
                            : "bg-white border-gray-200 text-gray-600"
                          } ${count === 0 ? "opacity-50" : ""}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                              ${isAct ? tab.activeBg : "bg-gray-100"}`}>
                <Icon size={16} className={isAct ? tab.iconActive : "text-gray-400"} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{tab.short}</p>
                <p className="text-xl font-black leading-tight text-gray-800">{count}</p>
                {count > 0 && (
                  <p className={`text-[10px] font-semibold ${hasFail ? "text-red-500" : "text-emerald-600"}`}>
                    {hasFail ? `${count - pass} fail` : "All pass"}
                  </p>
                )}
              </div>
              {hasFail && !isAct && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Inner tab bar */}
        <div className="flex items-center bg-gray-50/80 border-b border-gray-200 px-2 pt-2 gap-0.5">
          {INNER_TABS.map(tab => {
            const Icon  = tab.Icon;
            const isAct = active === tab.key;
            const count = dataMap[tab.key]?.length || 0;
            return (
              <button key={tab.key} onClick={() => setActive(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                           whitespace-nowrap rounded-t-xl transition-all duration-150 cursor-pointer
                           ${isAct
                             ? `${tab.activeBg} ${tab.activeText} border-t-2 border-x ${tab.activeBorder} border-x-gray-200 -mb-[1px] shadow-sm`
                             : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/70"
                           }`}
              >
                <span className={isAct ? tab.iconActive : "text-gray-400"}><Icon size={14} /></span>
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.short}</span>
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                                 rounded-full text-[10px] font-bold ml-1
                                 ${isAct ? tab.badge : "bg-gray-200 text-gray-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table content */}
        <div key={active} style={{ animation: "ft-fadein 0.15s ease-out" }}>
          <ActiveTable data={dataMap[active] || []} tabConfig={activeConfig} />
        </div>
      </div>

      <style>{`
        @keyframes ft-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default FunctionalTestTable;