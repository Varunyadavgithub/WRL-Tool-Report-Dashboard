import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Tag, Search, RefreshCw, CheckCircle2, XCircle, Activity,
  BarChart3, Scan, Hash, Box, QrCode, ArrowRight,
  TrendingUp, TrendingDown, Clock, User, Download, Filter,
  AlertTriangle, Shield, Zap, FileText, Eye, RotateCcw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { baseURL } from "../../assets/assets";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "update", label: "Update Tag", icon: Tag },
  { id: "log", label: "Activity Log", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const UPDATE_OPTIONS = [
  { label: "Asset Number", value: "newassetnumber", icon: Hash, color: "#2563EB", light: "#EFF6FF", border: "#BFDBFE" },
  { label: "Customer QR", value: "newcustomerqr", icon: QrCode, color: "#059669", light: "#ECFDF5", border: "#A7F3D0" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const formatDateShort = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const exportToCsv = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((r) => headers.map((h) => `"${r[h] ?? ""}"`).join(","));
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  blueMid: "#DBEAFE",
  green: "#059669",
  greenLight: "#ECFDF5",
  red: "#DC2626",
  redLight: "#FEF2F2",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
};

const css = {
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
  },
  input: {
    width: "100%",
    background: T.surfaceAlt,
    border: `1.5px solid ${T.border}`,
    borderRadius: 9,
    padding: "10px 14px",
    fontSize: 13,
    color: T.text,
    outline: "none",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    boxSizing: "border-box",
    transition: "border-color 0.15s, background 0.15s",
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 7,
    display: "block",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: T.text,
    letterSpacing: "-0.01em",
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: 0,
  },
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: 9,
    border: "none",
    cursor: "pointer",
    background: T.blue,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 7,
    whiteSpace: "nowrap",
    transition: "opacity 0.15s",
    boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
  },
  successBtn: {
    padding: "10px 20px",
    borderRadius: 9,
    border: "none",
    cursor: "pointer",
    background: "#059669",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 7,
    whiteSpace: "nowrap",
    transition: "opacity 0.15s",
    boxShadow: "0 2px 8px rgba(5,150,105,0.28)",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color, bgColor, trend }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
    padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)", position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at 70% 30%, ${bgColor} 0%, transparent 70%)` }} />
    <div style={{ width: 40, height: 40, borderRadius: 11, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${color}22` }}>
      <Icon size={19} color={color} />
    </div>
    <div>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</p>
      <p style={{ margin: "5px 0 0", fontSize: 12, color: T.textSub, fontWeight: 500 }}>{label}</p>
    </div>
    {sub && (
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: -4 }}>
        {trend === "up" && <TrendingUp size={12} color={color} />}
        {trend === "down" && <TrendingDown size={12} color={T.red} />}
        <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{sub}</span>
      </div>
    )}
  </div>
);

const Badge = ({ type }) => {
  const map = {
    asset: { label: "Asset No.", bg: T.blueMid, color: T.blue, icon: Hash },
    customerqr: { label: "Customer QR", bg: "#D1FAE5", color: T.green, icon: QrCode },
  };
  const s = map[type] || { label: type, bg: T.border, color: T.textSub, icon: Tag };
  const Icon = s.icon;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon size={9} /> {s.label}
    </span>
  );
};

const StatusPill = ({ success }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: success ? "#D1FAE5" : "#FEE2E2", color: success ? T.green : T.red, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
    {success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
    {success ? "Success" : "Failed"}
  </span>
);

const DetailCard = ({ assetNumber, fgSerialNumber, modelName, serial2, loading }) => {
  const fields = [
    { label: "FG Serial No.", value: fgSerialNumber, icon: Hash, color: T.blue },
    { label: "Asset Number", value: assetNumber, icon: Tag, color: T.purple },
    { label: "Model Name", value: modelName, icon: Box, color: T.amber },
    { label: "Customer QR", value: serial2, icon: QrCode, color: T.green },
  ];
  return (
    <div style={css.card}>
      <div style={{ padding: "13px 18px", background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={14} color={T.blue} />
        <span style={{ ...css.sectionTitle, fontSize: 12, color: T.blue }}>Asset Details</span>
      </div>
      <div style={{ padding: "4px 0" }}>
        {fields.map(({ label, value, icon: Icon, color }, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderBottom: i < fields.length - 1 ? `1px solid ${T.bg}` : "none" }}>
            <span style={{ fontSize: 12, color: T.textSub, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon size={13} color={T.textMuted} /> {label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: loading ? T.textMuted : value ? color : T.textMuted, background: loading ? T.bg : value ? `${color}12` : T.bg, padding: "3px 10px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {loading ? "···" : value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}>
      <p style={{ margin: "0 0 6px", color: T.textSub, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: "3px 0", color: p.color, fontWeight: 700 }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, iconColor, title, subtitle, action }) => (
  <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <div>
      <p style={css.sectionTitle}><Icon size={15} color={iconColor || T.blue} /> {title}</p>
      {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textSub }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TagUpdate = () => {
  const [activeTab, setActiveTab] = useState("update");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const [assemblyNumber, setAssemblyNumber] = useState("");
  const [fgSerialNumber, setFgSerialNumber] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [serial2, setSerial2] = useState("");
  const [newAssetNumber, setNewAssetNumber] = useState("");
  const [newCustomerQr, setNewCustomerQr] = useState("");
  const [selectedToUpdate, setSelectedToUpdate] = useState(UPDATE_OPTIONS[0]);

  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  const assemblyRef = useRef(null);

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.success).length,
    failed: logs.filter((l) => !l.success).length,
    assetUpdates: logs.filter((l) => l.updateType === "asset").length,
    qrUpdates: logs.filter((l) => l.updateType === "customerqr").length,
    successRate: logs.length ? Math.round((logs.filter((l) => l.success).length / logs.length) * 100) : 0,
  };

  const dailyData = (() => {
    const map = {};
    logs.forEach((log) => {
      const date = formatDateShort(log.createdAt);
      if (!map[date]) map[date] = { date, success: 0, failed: 0, asset: 0, qr: 0 };
      if (log.success) map[date].success++; else map[date].failed++;
      if (log.updateType === "asset") map[date].asset++; else map[date].qr++;
    });
    return Object.values(map).slice(-12);
  })();

  const pieData = [
    { name: "Success", value: stats.success, color: T.green },
    { name: "Failed", value: stats.failed, color: T.red },
  ];

  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/tag-update-logs`);
      setLogs(res.data?.logs || []);
    } catch {
      toast.error("Failed to load activity logs.");
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === "log" || activeTab === "analytics") fetchLogs(); }, [activeTab, fetchLogs]);
  useEffect(() => { if (activeTab === "update") setTimeout(() => assemblyRef.current?.focus(), 100); }, [activeTab]);

  const fetchAssetDetails = async () => {
    const trimmed = assemblyNumber.trim();
    if (!trimmed) { toast.error("Assembly Number is required"); return; }
    setFetched(false);
    setFgSerialNumber(""); setAssetNumber(""); setModelName(""); setSerial2("");
    setNewAssetNumber(""); setNewCustomerQr("");
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/asset-tag-details`, { params: { assemblyNumber: trimmed } });
      if (!res.data?.FGNo) { toast.error("No asset found for this Assembly Number."); return; }
      setFgSerialNumber(res.data.FGNo); setAssetNumber(res.data.AssetNo);
      setModelName(res.data.ModelName); setSerial2(res.data.Serial2);
      setFetched(true);
      toast.success("Asset details loaded successfully.");
    } catch (err) { toast.error(err.response?.data?.message || "Failed to fetch asset details."); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setAssemblyNumber(""); setFgSerialNumber(""); setAssetNumber("");
    setModelName(""); setSerial2(""); setNewAssetNumber(""); setNewCustomerQr("");
    setFetched(false);
    setTimeout(() => assemblyRef.current?.focus(), 50);
  };

  const validateBeforeUpdate = () => {
    if (!fetched || !assemblyNumber || !fgSerialNumber) { toast.error("Please query an Assembly Number first."); return false; }
    return true;
  };

  const handleUpdateNewAsset = async () => {
    if (!validateBeforeUpdate()) return;
    const trimmed = newAssetNumber.trim();
    if (!trimmed) { toast.error("New Asset Number is required"); return; }
    try {
      setLoading(true);
      const res = await axios.put(`${baseURL}quality/new-asset-tag`, { assemblyNumber: assemblyNumber.trim(), fgSerialNumber: fgSerialNumber.trim(), newAssetNumber: trimmed });
      if (res.data.success) { toast.success(res.data.message || "Asset tag updated!"); setAssetNumber(trimmed); setNewAssetNumber(""); fetchLogs(); }
      else toast.error(res.data.message || "Update failed.");
    } catch (err) { toast.error(err.response?.data?.message || "Failed to update Asset Number."); }
    finally { setLoading(false); }
  };

  const handleUpdateNewCustomerQr = async () => {
    if (!validateBeforeUpdate()) return;
    const trimmed = newCustomerQr.trim();
    if (!trimmed) { toast.error("New Customer QR is required"); return; }
    try {
      setLoading(true);
      const res = await axios.put(`${baseURL}quality/new-customer-qr`, { assemblyNumber: assemblyNumber.trim(), fgSerialNumber: fgSerialNumber.trim(), newCustomerQr: trimmed });
      if (res.data.success) { toast.success(res.data.message || "Customer QR updated!"); setSerial2(trimmed); setNewCustomerQr(""); fetchLogs(); }
      else toast.error(res.data.message || "Update failed.");
    } catch (err) { toast.error(err.response?.data?.message || "Failed to update Customer QR."); }
    finally { setLoading(false); }
  };

  const filteredLogs = logs.filter((log) => {
    const matchFilter = logFilter === "all" || (logFilter === "success" && log.success) || (logFilter === "failed" && !log.success) || (logFilter === "asset" && log.updateType === "asset") || (logFilter === "customerqr" && log.updateType === "customerqr");
    const s = logSearch.toLowerCase();
    const matchSearch = !s || log.assemblyNumber?.toLowerCase().includes(s) || log.updatedBy?.toLowerCase().includes(s) || log.oldValue?.toLowerCase().includes(s) || log.newValue?.toLowerCase().includes(s);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => setCurrentPage(1), [logFilter, logSearch]);

  const inputFocus = (e) => { e.target.style.borderColor = T.blue; e.target.style.background = "#fff"; };
  const inputBlur = (e) => { e.target.style.borderColor = T.border; e.target.style.background = T.surfaceAlt; };
  const ghostBtn = { padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer", fontSize: 12, fontWeight: 600, background: T.surface, color: T.textSub, display: "flex", alignItems: "center", gap: 6 };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: T.text }}>

      {/* ── Sticky top bar ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.07)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>

          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${T.blue}, #3B82F6)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" }}>
              <Tag size={18} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>Tag Update</p>
              <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>Asset & QR Management</p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: T.bg, borderRadius: 10, padding: 4 }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  padding: "7px 20px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  border: active ? `1px solid ${T.blueMid}` : "1px solid transparent",
                  background: active ? T.surface : "transparent",
                  color: active ? T.blue : T.textSub,
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: active ? "0 1px 4px rgba(15,23,42,0.09)" : "none",
                }}>
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </div>

          {/* Live pills */}
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Total", val: stats.total, color: T.blue, bg: T.blueLight }, { label: "Success", val: stats.success, color: T.green, bg: T.greenLight }, { label: "Failed", val: stats.failed, color: T.red, bg: T.redLight }].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 8, padding: "5px 14px", display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1 }}>{val}</span>
                <span style={{ fontSize: 10, color, opacity: 0.7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{ padding: "24px 28px" }}>

        {/* ══ UPDATE TAB ══ */}
        {activeTab === "update" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 300px", gap: 20, alignItems: "start" }}>

            {/* Col 1: Query */}
            <div style={css.card}>
              <SectionHeader icon={Scan} iconColor={T.blue} title="Query Assembly" subtitle="Scan or enter to fetch asset details"
                action={fetched && <button onClick={resetForm} style={{ ...ghostBtn, fontSize: 11 }}><RotateCcw size={11} /> Reset</button>}
              />
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={css.label}>Assembly Number <span style={{ color: T.red }}>*</span></label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <Scan size={14} color={T.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      <input ref={assemblyRef} type="text" placeholder="Scan or type Assembly Number…" value={assemblyNumber}
                        onChange={(e) => { setAssemblyNumber(e.target.value); setFetched(false); }}
                        onKeyDown={(e) => e.key === "Enter" && fetchAssetDetails()}
                        onFocus={inputFocus} onBlur={inputBlur}
                        style={{ ...css.input, paddingLeft: 36 }} />
                    </div>
                    <button onClick={fetchAssetDetails} disabled={loading} style={{ ...css.primaryBtn, opacity: loading ? 0.65 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                      {loading ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
                      {loading ? "Querying…" : "Query"}
                    </button>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} color={T.amber} /> Press Enter to query instantly
                  </p>
                </div>

                {!fetched && !loading && assemblyNumber && (
                  <div style={{ background: T.amberLight, border: "1px solid #FDE68A", borderRadius: 9, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={15} color={T.amber} />
                    <span style={{ fontSize: 12, color: "#92400E" }}>Click <strong>Query</strong> or press <strong>Enter</strong> to load asset details.</span>
                  </div>
                )}

                {fetched && (
                  <div style={{ background: T.greenLight, border: "1px solid #A7F3D0", borderRadius: 9, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={15} color={T.green} />
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#065F46", fontWeight: 700 }}>Asset loaded — ready to update</p>
                      <p style={{ margin: "1px 0 0", fontSize: 11, color: "#047857" }}>Select what to update in the next panel</p>
                    </div>
                  </div>
                )}

                <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tips</p>
                  {[{ icon: Scan, text: "Use a barcode scanner for instant input" }, { icon: Shield, text: "Duplicate values are auto-checked before saving" }, { icon: Activity, text: "All changes are logged with timestamp & user" }].map(({ icon: Icon, text }, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={12} color={T.textMuted} />
                      <span style={{ fontSize: 11, color: T.textSub }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Col 2: Update */}
            <div style={{ ...css.card, opacity: fetched ? 1 : 0.45, pointerEvents: fetched ? "auto" : "none", transition: "opacity 0.3s" }}>
              <SectionHeader icon={Tag} iconColor={T.purple} title="Apply Update" subtitle={fetched ? "Choose field and enter new value" : "Query an assembly first"} />
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Radio */}
                <div>
                  <label style={css.label}>Update Field</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {UPDATE_OPTIONS.map((opt) => {
                      const active = selectedToUpdate.value === opt.value;
                      const Icon = opt.icon;
                      return (
                        <label key={opt.value} style={{ flex: 1, cursor: fetched ? "pointer" : "default", display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${active ? opt.color : T.border}`, borderRadius: 10, padding: "12px 14px", background: active ? opt.light : T.surfaceAlt, transition: "all 0.15s" }}>
                          <input type="radio" name="updateType" value={opt.value} checked={active} onChange={() => setSelectedToUpdate(opt)} style={{ display: "none" }} />
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? `${opt.color}18` : T.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${active ? opt.border : T.border}` }}>
                            <Icon size={14} color={active ? opt.color : T.textMuted} />
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? opt.color : T.textSub }}>{opt.label}</p>
                            <p style={{ margin: 0, fontSize: 10, color: active ? opt.color : T.textMuted, opacity: active ? 0.8 : 1 }}>{opt.value === "newassetnumber" ? "Change asset tag" : "Change QR code"}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Current value */}
                <div style={{ background: T.bg, borderRadius: 9, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: T.textSub, display: "flex", alignItems: "center", gap: 7 }}>
                    <Eye size={13} color={T.textMuted} /> Current value
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, background: T.amberLight, border: "1px solid #FDE68A", padding: "3px 10px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedToUpdate.value === "newassetnumber" ? (assetNumber || "—") : (serial2 || "—")}
                  </span>
                </div>

                {/* New value */}
                <div>
                  <label style={css.label}>{selectedToUpdate.value === "newassetnumber" ? "New Asset Number" : "New Customer QR"}<span style={{ color: T.red }}> *</span></label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      {selectedToUpdate.value === "newassetnumber"
                        ? <Hash size={13} color={T.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                        : <QrCode size={13} color={T.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />}
                      <input
                        type="text"
                        placeholder={selectedToUpdate.value === "newassetnumber" ? "Enter new asset number…" : "Scan new QR code…"}
                        value={selectedToUpdate.value === "newassetnumber" ? newAssetNumber : newCustomerQr}
                        onChange={(e) => selectedToUpdate.value === "newassetnumber" ? setNewAssetNumber(e.target.value) : setNewCustomerQr(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") selectedToUpdate.value === "newassetnumber" ? handleUpdateNewAsset() : handleUpdateNewCustomerQr(); }}
                        onFocus={inputFocus} onBlur={inputBlur}
                        style={{ ...css.input, paddingLeft: 36 }} disabled={!fetched}
                      />
                    </div>
                    <button onClick={selectedToUpdate.value === "newassetnumber" ? handleUpdateNewAsset : handleUpdateNewCustomerQr}
                      disabled={loading || !fetched}
                      style={{ ...css.successBtn, opacity: (loading || !fetched) ? 0.55 : 1, cursor: (loading || !fetched) ? "not-allowed" : "pointer" }}>
                      {loading ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={13} />}
                      {loading ? "Updating…" : "Update"}
                    </button>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} color={T.amber} /> Press Enter to apply
                  </p>
                </div>
              </div>
            </div>

            {/* Col 3: Detail card + mini stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DetailCard assetNumber={assetNumber} fgSerialNumber={fgSerialNumber} modelName={modelName} serial2={serial2} loading={loading && !fetched} />

              {fetched && (
                <div style={{ ...css.card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)" }}>
                  <CheckCircle2 size={20} color={T.green} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#065F46" }}>Asset ready</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#047857" }}>Fill in the new value and click Update</p>
                  </div>
                </div>
              )}

              <div style={css.card}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.bg}` }}>
                  <p style={{ ...css.sectionTitle, fontSize: 12 }}><FileText size={13} color={T.textMuted} /> Today's Stats</p>
                </div>
                <div style={{ padding: "8px 0" }}>
                  {(() => {
                    const today = new Date().toDateString();
                    const tl = logs.filter(l => new Date(l.createdAt).toDateString() === today);
                    return [{ label: "Updates today", val: tl.length, color: T.blue }, { label: "Success today", val: tl.filter(l => l.success).length, color: T.green }, { label: "Failed today", val: tl.filter(l => !l.success).length, color: T.red }];
                  })().map(({ label, val, color }, i, arr) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.bg}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSub }}>{label}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ LOG TAB ══ */}
        {activeTab === "log" && (
          <div style={css.card}>
            <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={css.sectionTitle}><Activity size={15} color={T.blue} /> Activity Log</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textSub }}>{filteredLogs.length} entries · all tag update operations</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <Search size={13} color={T.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input placeholder="Search assembly, user, value…" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} onFocus={inputFocus} onBlur={inputBlur} style={{ ...css.input, paddingLeft: 32, width: 240, fontSize: 12 }} />
                  </div>
                  {[{ id: "all", label: "All" }, { id: "asset", label: "Asset" }, { id: "customerqr", label: "Cust. QR" }, { id: "success", label: "Success" }, { id: "failed", label: "Failed" }].map((f) => (
                    <button key={f.id} onClick={() => setLogFilter(f.id)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${logFilter === f.id ? T.blue : T.border}`, background: logFilter === f.id ? T.blueLight : T.surface, color: logFilter === f.id ? T.blue : T.textSub }}>
                      {f.label}
                    </button>
                  ))}
                  <button onClick={() => exportToCsv(filteredLogs, "tag-update-log.csv")} style={ghostBtn}><Download size={12} /> Export</button>
                  <button onClick={fetchLogs} disabled={logLoading} style={ghostBtn}><RefreshCw size={12} style={logLoading ? { animation: "spin 1s linear infinite" } : {}} /> Refresh</button>
                </div>
              </div>
            </div>

            {logLoading ? (
              <div style={{ padding: 70, textAlign: "center" }}>
                <RefreshCw size={22} color={T.blue} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 13, color: T.textSub }}>Loading activity logs…</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: 70, textAlign: "center" }}>
                <Activity size={32} color={T.border} style={{ marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, color: T.textSub }}>{logSearch || logFilter !== "all" ? "No entries match the current filter." : "No log entries yet."}</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: T.bg }}>
                        {["#", "Date & Time", "Assembly No.", "Type", "Old Value", "New Value", "Updated By", "Status"].map((h) => (
                          <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedLogs.map((log, i) => (
                        <tr key={log.id || i} style={{ borderBottom: `1px solid ${T.bg}`, background: T.surface, transition: "background 0.1s", cursor: "default" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = T.surfaceAlt}
                          onMouseLeave={(e) => e.currentTarget.style.background = T.surface}>
                          <td style={{ padding: "11px 18px", color: T.textMuted, fontSize: 12 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                          <td style={{ padding: "11px 18px", whiteSpace: "nowrap", color: T.textSub, fontSize: 12 }}><Clock size={11} color={T.textMuted} style={{ marginRight: 5, verticalAlign: "middle" }} />{formatDateTime(log.createdAt)}</td>
                          <td style={{ padding: "11px 18px" }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{log.assemblyNumber}</span></td>
                          <td style={{ padding: "11px 18px" }}><Badge type={log.updateType} /></td>
                          <td style={{ padding: "11px 18px", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.oldValue || "—"}</td>
                          <td style={{ padding: "11px 18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ color: T.green, fontWeight: 700 }}>{log.newValue || "—"}</span></td>
                          <td style={{ padding: "11px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: T.blue, flexShrink: 0 }}>
                                {(log.updatedBy || "?").slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12, color: T.textSub }}>{log.updatedBy || "System"}</span>
                            </div>
                          </td>
                          <td style={{ padding: "11px 18px" }}><StatusPill success={log.success} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "12px 22px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredLogs.length)}–{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…"); acc.push(p); return acc; }, []).map((p, i) =>
                      p === "…" ? <span key={`e${i}`} style={{ padding: "5px 4px", color: T.textMuted, fontSize: 12 }}>…</span>
                        : <button key={p} onClick={() => setCurrentPage(p)} style={{ width: 30, height: 30, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${currentPage === p ? T.blue : T.border}`, background: currentPage === p ? T.blueLight : T.surface, color: currentPage === p ? T.blue : T.textSub }}>{p}</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* KPI row — full width 5 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              <KpiCard icon={BarChart3} label="Total Updates" value={stats.total} color={T.blue} bgColor={T.blueLight} sub="All time" />
              <KpiCard icon={CheckCircle2} label="Successful" value={stats.success} color={T.green} bgColor={T.greenLight} sub={`${stats.successRate}% rate`} trend="up" />
              <KpiCard icon={XCircle} label="Failed" value={stats.failed} color={T.red} bgColor={T.redLight} sub="Review needed" trend={stats.failed > 0 ? "down" : null} />
              <KpiCard icon={Hash} label="Asset Updates" value={stats.assetUpdates} color={T.amber} bgColor={T.amberLight} />
              <KpiCard icon={QrCode} label="QR Updates" value={stats.qrUpdates} color={T.purple} bgColor={T.purpleLight} />
            </div>

            {/* Charts row 1: area + donut + type bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
              <div style={css.card}>
                <SectionHeader icon={TrendingUp} iconColor={T.blue} title="Daily Update Trend" subtitle="Success vs Failed updates over the last 12 days" />
                <div style={{ padding: "18px 12px 12px" }}>
                  {dailyData.length === 0
                    ? <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No data yet</div>
                    : <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={dailyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.green} stopOpacity={0.2} /><stop offset="100%" stopColor={T.green} stopOpacity={0} /></linearGradient>
                          <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.red} stopOpacity={0.15} /><stop offset="100%" stopColor={T.red} stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: T.textSub }} />
                        <Area type="monotone" dataKey="success" name="Success" stroke={T.green} strokeWidth={2} fill="url(#gS)" dot={{ fill: T.green, r: 3, strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="failed" name="Failed" stroke={T.red} strokeWidth={2} fill="url(#gF)" dot={{ fill: T.red, r: 3, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Donut */}
                <div style={css.card}>
                  <SectionHeader icon={Shield} iconColor={T.green} title="Success Rate" />
                  <div style={{ padding: "16px 20px" }}>
                    {stats.total === 0
                      ? <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No data</div>
                      : <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                        <ResponsiveContainer width={110} height={110}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                              {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: T.green, lineHeight: 1, letterSpacing: "-0.04em" }}>{stats.successRate}%</p>
                          <p style={{ margin: "4px 0 10px", fontSize: 11, color: T.textSub }}>Overall success rate</p>
                          {pieData.map((d) => (
                            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: T.textSub }}>{d.name}: <strong style={{ color: T.text }}>{d.value}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>}
                  </div>
                </div>

                {/* Type bars */}
                <div style={css.card}>
                  <SectionHeader icon={Filter} iconColor={T.purple} title="By Update Type" />
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                    {stats.total === 0
                      ? <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No data</div>
                      : [{ label: "Asset Number", val: stats.assetUpdates, color: T.blue }, { label: "Customer QR", val: stats.qrUpdates, color: T.purple }].map(({ label, val, color }) => {
                        const pct = stats.total ? Math.round((val / stats.total) * 100) : 0;
                        return (
                          <div key={label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>{label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color }}>{val} <span style={{ color: T.textMuted, fontWeight: 400 }}>({pct}%)</span></span>
                            </div>
                            <div style={{ background: T.bg, borderRadius: 999, height: 7, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.7s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts row 2: bar chart + recent feed */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
              <div style={css.card}>
                <SectionHeader icon={BarChart3} iconColor={T.purple} title="Asset vs QR per Day" subtitle="Grouped daily breakdown by update type" />
                <div style={{ padding: "18px 12px 12px" }}>
                  {dailyData.length === 0
                    ? <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 13 }}>No data yet</div>
                    : <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barSize={14} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="date" tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: T.textSub }} />
                        <Bar dataKey="asset" name="Asset No." fill={T.blue} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="qr" name="Customer QR" fill={T.purple} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>}
                </div>
              </div>

              <div style={css.card}>
                <SectionHeader icon={Clock} iconColor={T.amber} title="Recent Activity" subtitle={`Last ${Math.min(logs.length, 10)} operations`} />
                <div style={{ overflowY: "auto", maxHeight: 320 }}>
                  {logLoading
                    ? <div style={{ padding: 30, textAlign: "center", color: T.textSub, fontSize: 13 }}>Loading…</div>
                    : logs.length === 0
                      ? <div style={{ padding: 30, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No activity yet.</div>
                      : logs.slice(0, 10).map((log, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 20px", borderBottom: i < 9 ? `1px solid ${T.bg}` : "none", transition: "background 0.1s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = T.surfaceAlt}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: log.success ? "#D1FAE5" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                            {log.success ? <CheckCircle2 size={13} color={T.green} /> : <XCircle size={13} color={T.red} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.assemblyNumber}</span>
                              <Badge type={log.updateType} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                              <User size={10} color={T.textMuted} />
                              <span style={{ fontSize: 11, color: T.textSub }}>{log.updatedBy}</span>
                              <span style={{ fontSize: 10, color: T.textMuted }}>·</span>
                              <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</span>
                            </div>
                            {log.newValue && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                <ArrowRight size={10} color={T.textMuted} />
                                <span style={{ fontSize: 11, color: T.green, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, fontWeight: 600 }}>{log.newValue}</span>
                              </div>
                            )}
                            {!log.success && log.failReason && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                                <AlertTriangle size={10} color={T.red} />
                                <span style={{ fontSize: 10, color: T.red }}>{log.failReason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #F1F5F9; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
};

export default TagUpdate;