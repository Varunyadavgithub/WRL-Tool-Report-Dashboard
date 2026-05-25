import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";

// -- Status config -------------------------------------------------------------
const STATUS_CFG = {
  P:  { label: "P",  title: "Present",       bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  HD: { label: "HD", title: "Half Day",      bg: "#fef9c3", text: "#a16207", border: "#fde047" },
  PM: { label: "PM", title: "Punch Missing", bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  WO: { label: "WO", title: "Week Off",      bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  A:  { label: "A",  title: "Absent",        bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

const SUMMARY_KEYS = ["P", "HD", "PM", "WO", "A", "TTL"];

// -- Helpers -------------------------------------------------------------------
const isoDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const defaultRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 24);
  const to   = new Date(now.getFullYear(), now.getMonth(),    23);
  return { from: isoDate(from), to: isoDate(to) };
};

const buildDateRange = (from, to) => {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(isoDate(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};


const deriveStatus = (records) => {
  if (!records || records.length === 0) return null;

  const best = records.reduce((b, r) => {
    const rank = { Present: 3, "Half Day": 2, "Punch Missing": 1 };
    return (rank[r.AttendanceStatus] ?? 0) > (rank[b.AttendanceStatus] ?? 0) ? r : b;
  }, records[0]);

  switch (best.AttendanceStatus) {
    case "Present":       return "P";
    case "Half Day":      return "HD";
    case "Punch Missing": return "PM";
    default:              return "A";
  }
};

// -- Pivot builder -------------------------------------------------------------
const buildPivot = (records, dates) => {
  const map = {};

  records.forEach((r) => {
    // FIX: normalise both possible employee-code field names
    const empCode = r.EmpCode || r.EmployeeCode || "—";
    const key = `${empCode}||${r.EmployeeName}`;

    if (!map[key]) {
      map[key] = {
        empCode,
        name:       r.EmployeeName || "—",
        department: r.Department   || "—",
        contractor: r.Contractor   || "—",
        shift:      r.Shift        || "—",
        byDate:     {},
      };
    }

    // FIX: use AttendanceDate (DATE column from SQL) for bucketing,
    // NOT the full datetime — avoids cross-midnight mis-attribution.
    const dateKey = r.AttendanceDate
      ? String(r.AttendanceDate).slice(0, 10)
      : null;

    if (dateKey) {
      if (!map[key].byDate[dateKey]) map[key].byDate[dateKey] = [];
      map[key].byDate[dateKey].push(r);
    }
  });

  const rows = Object.values(map).map((emp) => {
    const statusByDate = {};
    let P = 0, HD = 0, PM = 0, WO = 0, A = 0;

    dates.forEach((d) => {
      const dow  = new Date(d).getDay();
      const recs = emp.byDate[d];
      let status;

      if (!recs || recs.length === 0) {
        status = dow === 0 ? "WO" : "A";
      } else {
        status = deriveStatus(recs) ?? "A";
      }

      statusByDate[d] = status;
      if (status === "P")  P++;
      if (status === "HD") HD++;
      if (status === "PM") PM++;
      if (status === "WO") WO++;
      if (status === "A")  A++;
    });

    return { ...emp, statusByDate, summary: { P, HD, PM, WO, A, TTL: P + HD } };
  });

  rows.sort((a, b) =>
    a.contractor.localeCompare(b.contractor) || a.name.localeCompare(b.name)
  );

  return rows;
};

// -- Sub-components ------------------------------------------------------------
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status];
  if (!cfg) return (
    <td style={{ width: 28, minWidth: 28, textAlign: "center", borderRight: "1px solid #f1f5f9", padding: "2px 1px" }}>
      <span style={{ fontSize: 9, color: "#cbd5e1" }}>—</span>
    </td>
  );
  return (
    <td style={{ width: 28, minWidth: 28, textAlign: "center", borderRight: "1px solid #f1f5f9", padding: "2px 1px" }}
      title={cfg.title}>
      <span style={{
        display: "inline-block",
        fontSize: 9,
        fontWeight: 800,
        padding: "1px 3px",
        borderRadius: 3,
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        lineHeight: 1.5,
        letterSpacing: "0.02em",
      }}>
        {cfg.label}
      </span>
    </td>
  );
};

const StatCard = ({ label, value, color, sub }) => (
  <div style={{
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }}>
    <span style={{ fontSize: 22, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</span>
    {sub && <span style={{ fontSize: 10, color: "#94a3b8" }}>{sub}</span>}
  </div>
);

// -- Main Component ------------------------------------------------------------
const AttendanceRegister = () => {
  const def = defaultRange();
  const [fromDate,   setFromDate]   = useState(def.from);
  const [toDate,     setToDate]     = useState(def.to);
  const [search,     setSearch]     = useState("");
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [fetched,    setFetched]    = useState(false);
  const [activeRow,  setActiveRow]  = useState(null);

  // -- Fetch -----------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) { toast.error("Please select both dates"); return; }
    if (new Date(fromDate) > new Date(toDate)) { toast.error("From date must be before To date"); return; }
    const days = (new Date(toDate) - new Date(fromDate)) / 86400000;
    if (days > 90) { toast.error("Date range cannot exceed 90 days"); return; }

    setLoading(true);
    setRecords([]);
    setFetched(false);

    try {
      const res = await axios.get(`${baseURL}manpower/attendance`, {
        params: { fromDate, toDate },
      });
      const data = res.data.data || [];
      setRecords(data);
      setFetched(true);
      if (data.length === 0) toast("No records found for this range", { icon: "📭" });
      else toast.success(`Loaded ${data.length} punch records`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  // -- Derived data ----------------------------------------------------------
  const dates = useMemo(() => buildDateRange(fromDate, toDate), [fromDate, toDate]);

  const allRows = useMemo(() => buildPivot(records, dates), [records, dates]);

  const rows = useMemo(() => {
    let r = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.empCode.toLowerCase().includes(q) ||
        x.department.toLowerCase().includes(q)
      );
    }
    return r;
  }, [allRows, search]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const t = { P: 0, HD: 0, PM: 0, WO: 0, A: 0 };
    rows.forEach((r) => {
      t.P  += r.summary.P;
      t.HD += r.summary.HD;
      t.PM += r.summary.PM;
      t.WO += r.summary.WO;
      t.A  += r.summary.A;
    });
    return t;
  }, [rows]);

  // -- Export CSV ------------------------------------------------------------
  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = [
      "SR", "EMP CODE", "NAME", "DEPARTMENT", "SHIFT",
      ...dates.map((d) => {
        const dt = new Date(d);
        return `${dt.getDate()}/${dt.getMonth() + 1}`;
      }),
      "P", "HD", "PM", "WO", "A", "TTL",
    ];
    const csvRows = rows.map((r, i) => [
      i + 1, r.empCode, `"${r.name}"`, `"${r.department}"`, r.shift,
      ...dates.map((d) => r.statusByDate[d] || ""),
      r.summary.P, r.summary.HD, r.summary.PM, r.summary.WO, r.summary.A, r.summary.TTL,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `attendance_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handlePrint = () => window.print();

  // -- Render ----------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Top bar */}
      <div style={{
        background: "#0f172a",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 30,
        boxShadow: "0 1px 0 rgba(255,255,255,0.06)",
      }}
        className="print:hidden"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>📋</div>
          <div>
            <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Attendance Register
            </div>
            <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>
              Western Refrigeration Pvt. Ltd.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handlePrint}
            style={{ ...btnStyle, background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.1)" }}>
            🖨 Print
          </button>
          <button onClick={handleExportCSV} disabled={!rows.length}
            style={{ ...btnStyle, background: rows.length ? "#16a34a" : "#374151", color: "#fff", opacity: rows.length ? 1 : 0.45 }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/*  */}
        <div style={cardStyle} className="print:hidden">
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Date Range & Filters
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>

            <label style={fieldWrap}>
              <span style={labelStyle}>From Date</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={inputStyle} />
            </label>

            <label style={fieldWrap}>
              <span style={labelStyle}>To Date</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={inputStyle} />
            </label>

            <button onClick={fetchData} disabled={loading}
              style={{
                ...btnStyle,
                background: loading ? "#64748b" : "#6366f1",
                color: "#fff",
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 700,
                gap: 8,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 12px rgba(99,102,241,0.35)",
              }}>
              {loading
                ? <><SpinIcon /> Fetching…</>
                : <>🔍 Fetch Attendance</>}
            </button>

            {fetched && (
              <>
                <div style={{ width: 1, height: 36, background: "#e2e8f0", margin: "0 4px" }} />

                <label style={{ ...fieldWrap, flex: 1, minWidth: 200 }}>
                  <span style={labelStyle}>Search</span>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
                    <input type="text" placeholder="Name, Code, Department…" value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 30, width: "100%", boxSizing: "border-box" }} />
                  </div>
                </label>

                {search && (
                  <button onClick={() => { setSearch(""); }}
                    style={{ ...btnStyle, background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", marginTop: 16 }}>
                    ✕ Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/*  */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }} className="print:hidden">
            <StatCard label="Employees"     value={rows.length} color="#6366f1" sub={`${dates.length} days`} />
            <StatCard label="Present Days"  value={stats.P}     color="#16a34a" />
            <StatCard label="Half Days"     value={stats.HD}    color="#a16207" />
            <StatCard label="Punch Missing" value={stats.PM}    color="#c2410c" />
            <StatCard label="Week Off"      value={stats.WO}    color="#1d4ed8" />
            <StatCard label="Absent"        value={stats.A}     color="#b91c1c" />
          </div>
        )}

        {/*  */}
        {fetched && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} className="print:hidden">
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 700, padding: "3px 8px",
                borderRadius: 20, background: v.bg, color: v.text,
                border: `1px solid ${v.border}`,
              }}>
                <span style={{ fontWeight: 900 }}>{v.label}</span>
                <span style={{ fontWeight: 500, opacity: 0.8 }}>= {v.title}</span>
              </span>
            ))}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10, fontWeight: 700, padding: "3px 8px",
              borderRadius: 20, background: "#f1f5f9", color: "#64748b",
              border: "1px solid #e2e8f0",
            }}>
              WO auto-assigned on Sundays
            </span>
          </div>
        )}

        {/*  */}
        {loading && (
          <div style={{ ...cardStyle, padding: 60, textAlign: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: "spin 0.8s linear infinite" }}>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <path d="M 20 4 A 16 16 0 0 1 36 20" fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Fetching attendance data…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}

        {/*  */}
        {!loading && fetched && rows.length === 0 && (
          <div style={{ ...cardStyle, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>No records found</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              Try adjusting the date range or search filter
            </div>
          </div>
        )}

        {/*  */}
        {!loading && rows.length > 0 && (
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>

            {/* Print-only header */}
            <div className="hidden print:block" style={{ padding: "12px 20px", borderBottom: "2px solid #0f172a", textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Western Refrigeration Pvt. Ltd.</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                Attendance Register — {fromDate} to {toDate}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
                tableLayout: "auto",
              }}>

                {/*  */}
                <colgroup>
                  <col style={{ width: 36 }} />  {/* SR */}
                  <col style={{ width: 80 }} />  {/* EMP CODE */}
                  <col style={{ width: 150 }} /> {/* NAME */}
                  <col style={{ width: 130 }} /> {/* DEPT */}
                  <col style={{ width: 60 }} />  {/* SHIFT */}
                  {dates.map((d) => <col key={d} style={{ width: 28 }} />)}
                  {SUMMARY_KEYS.map((k) => <col key={k} style={{ width: 32 }} />)}
                </colgroup>

                <thead>
                  {/* Row 1: Month spans + summary headers */}
                  <tr style={{ background: "#0f172a", color: "#e2e8f0" }}>
                    <th rowSpan={2} style={{ ...thFixed, left: 0, zIndex: 4, minWidth: 36, borderRight: "1px solid #1e293b" }}>SR</th>
                    <th rowSpan={2} style={{ ...thFixed, left: 36, zIndex: 4, minWidth: 80, textAlign: "left", borderRight: "1px solid #1e293b" }}>CODE</th>
                    <th rowSpan={2} style={{ ...thFixed, left: 116, zIndex: 4, minWidth: 150, textAlign: "left", borderRight: "1px solid #334155", borderLeft: "none" }}>NAME</th>
                    <th rowSpan={2} style={{ ...thBase, textAlign: "left", borderRight: "1px solid #1e293b" }}>DEPARTMENT</th>
                    <th rowSpan={2} style={{ ...thBase, borderRight: "1px solid #334155" }}>SHIFT</th>

                    {/* Month group headers */}
                    {(() => {
                      const months = {};
                      dates.forEach((d) => {
                        const key = d.slice(0, 7);
                        months[key] = (months[key] || 0) + 1;
                      });
                      return Object.entries(months).map(([mo, cnt]) => (
                        <th key={mo} colSpan={cnt} style={{
                          ...thBase,
                          borderRight: "1px solid #334155",
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: "0.03em",
                        }}>
                          {new Date(mo + "-01").toLocaleString("en-IN", { month: "short", year: "numeric" })}
                        </th>
                      ));
                    })()}

                    {/* Summary column headers */}
                    {SUMMARY_KEYS.map((k) => (
                      <th key={k} rowSpan={2} style={{
                        ...thBase,
                        background: "#312e81",
                        color: "#c7d2fe",
                        borderRight: "1px solid #4338ca",
                        fontWeight: 900,
                        fontSize: 11,
                        minWidth: 32,
                      }}>
                        {k}
                      </th>
                    ))}
                  </tr>

                  {/* Row 2: Day numbers */}
                  <tr style={{ background: "#1e293b", color: "#94a3b8" }}>
                    {dates.map((d) => {
                      const dt  = new Date(d);
                      const sun = dt.getDay() === 0;
                      return (
                        <th key={d} style={{
                          ...thBase,
                          fontSize: 10,
                          fontWeight: sun ? 800 : 600,
                          color: sun ? "#93c5fd" : "#94a3b8",
                          background: sun ? "#1e3a5f" : "#1e293b",
                          minWidth: 28,
                          borderRight: "1px solid #334155",
                          padding: "4px 2px",
                        }}>
                          {dt.getDate()}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, idx) => {
                    const isActive = activeRow === idx;
                    const base = idx % 2 === 0 ? "#fff" : "#f8fafc";

                    return (
                      <tr key={`${row.empCode}-${idx}`}
                        onClick={() => setActiveRow(isActive ? null : idx)}
                        style={{
                          background: isActive ? "#eff6ff" : base,
                          cursor: "pointer",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#f0f9ff"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = base; }}
                      >
                        {/* Fixed cols */}
                        <td style={{ ...tdFixed, left: 0, textAlign: "center", fontWeight: 700, color: "#94a3b8", fontSize: 10, zIndex: 2, background: "inherit", borderRight: "1px solid #e2e8f0" }}>
                          {idx + 1}
                        </td>
                        <td style={{ ...tdFixed, left: 36, fontFamily: "monospace", color: "#475569", fontSize: 10, zIndex: 2, background: "inherit", borderRight: "1px solid #e2e8f0" }}>
                          {row.empCode}
                        </td>
                        <td style={{ ...tdFixed, left: 116, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", zIndex: 2, background: "inherit", borderRight: "2px solid #e2e8f0" }}>
                          {row.name}
                        </td>
                        <td style={{ ...tdBase, color: "#64748b", whiteSpace: "nowrap", borderRight: "1px solid #f1f5f9" }}>{row.department}</td>
                        <td style={{ ...tdBase, textAlign: "center", color: "#94a3b8", borderRight: "2px solid #e2e8f0" }}>{row.shift}</td>

                        {/* Status cells */}
                        {dates.map((d) => (
                          <StatusBadge key={d} status={row.statusByDate[d]} />
                        ))}

                        {/* Summary cells */}
                        {SUMMARY_KEYS.map((k) => (
                          <td key={k} style={{
                            textAlign: "center",
                            fontWeight: 800,
                            fontSize: 11,
                            padding: "3px 2px",
                            background: isActive ? "#e0e7ff" : "#f5f3ff",
                            borderRight: "1px solid #e9d5ff",
                            color:
                              k === "P"   ? "#15803d" :
                              k === "HD"  ? "#a16207" :
                              k === "PM"  ? "#c2410c" :
                              k === "WO"  ? "#1d4ed8" :
                              k === "A"   ? "#b91c1c" :
                              "#4338ca",
                          }}>
                            {row.summary[k]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals row */}
                {stats && (
                  <tfoot>
                    <tr style={{ background: "#0f172a", color: "#e2e8f0" }}>
                      <td colSpan={6} style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        fontWeight: 800,
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        position: "sticky",
                        left: 0,
                        background: "#0f172a",
                        zIndex: 2,
                        color: "#94a3b8",
                        borderRight: "2px solid #334155",
                      }}>
                        Total — {rows.length} employees
                      </td>
                      {dates.map((d) => (
                        <td key={d} style={{ borderRight: "1px solid #1e293b" }} />
                      ))}
                      {[
                        [stats.P,  "#86efac"],
                        [stats.HD, "#fde047"],
                        [stats.PM, "#fdba74"],
                        [stats.WO, "#93c5fd"],
                        [stats.A,  "#fca5a5"],
                        [stats.P + stats.HD, "#a5b4fc"],
                      ].map(([val, color], i) => (
                        <td key={i} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 900, color, fontSize: 11, borderRight: "1px solid #334155" }}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Table footer */}
            <div style={{
              padding: "10px 16px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }} className="print:hidden">
              <span style={{ fontSize: 11, color: "#64748b" }}>
                <strong style={{ color: "#334155" }}>{rows.length}</strong> employees ·{" "}
                <strong style={{ color: "#334155" }}>{dates.length}</strong> days ·{" "}
                <strong style={{ color: "#334155" }}>{records.length}</strong> punch records
              </span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {fromDate} → {toDate}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
          body { background: white; }
          table { font-size: 9px; }
        }
      `}</style>
    </div>
  );
};

// -- Shared style objects ------------------------------------------------------
const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  padding: 20,
};

const btnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 8,
  border: "none",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const fieldWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  color: "#334155",
  background: "#fff",
  outline: "none",
};

// FIX: use colgroup-controlled widths + left values here must match colgroup widths
const thFixed = {
  position: "sticky",
  padding: "7px 8px",
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: "0.05em",
  textAlign: "center",
  whiteSpace: "nowrap",
  background: "#0f172a",
};

const thBase = {
  padding: "7px 8px",
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: "0.05em",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdFixed = {
  position: "sticky",
  padding: "5px 8px",
  whiteSpace: "nowrap",
};

const tdBase = {
  padding: "5px 8px",
};

const SpinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.7s linear infinite", display: "inline-block" }}>
    <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
    <path d="M 7 2 A 5 5 0 0 1 12 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export default AttendanceRegister;
