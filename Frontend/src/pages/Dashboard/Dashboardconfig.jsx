import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiPlus, FiEdit2, FiTrash2, FiPlay, FiSearch,
  FiRefreshCw, FiAlertCircle, FiLoader, FiX,
  FiSave, FiCalendar, FiActivity, FiSettings,
  FiLayers, FiZap, FiCpu, FiBarChart2, FiShield,
  FiCheck, FiAlertTriangle,
} from "react-icons/fi";
import { baseURL } from "../../assets/assets";

// ─── API base ─────────────────────────────────────────────────────────────────
// Controller routes: GET/POST /dashboard/configs  PUT/DELETE /dashboard/configs/:id
const API = `${baseURL}dashboard/configs`;

// ─── Empty form mirrors DashboardConfig DB columns ────────────────────────────
const EMPTY_FORM = {
  id: null,
  dashboardName: "",
  lineName: "", lineCode: "",
  stationCode1: "", stationName1: "", lineTaktTime1: "", lineMonthlyProduction1: "", lineTarget1: "",
  stationCode2: "", stationName2: "", lineTaktTime2: "", lineMonthlyProduction2: "",
  qualityProcessCode: "", qualityLineName: "",
  sectionName: "",
};

// ─── Table column definitions ─────────────────────────────────────────────────
const COLUMNS = [
  { key: "dashboardName",          label: "Dashboard",    group: "General"   },
  { key: "lineName",               label: "Line Name",    group: "General"   },
  { key: "lineCode",               label: "Line Code",    group: "General"   },
  { key: "stationCode1",           label: "Station",      group: "Display 1" },
  { key: "stationName1",           label: "Name",         group: "Display 1" },
  { key: "lineTaktTime1",          label: "Takt (s)",     group: "Display 1" },
  { key: "lineMonthlyProduction1", label: "Monthly",      group: "Display 1" },
  { key: "lineTarget1",            label: "UPH",          group: "Display 1" },
  { key: "stationCode2",           label: "Station",      group: "Display 2" },
  { key: "stationName2",           label: "Name",         group: "Display 2" },
  { key: "lineTaktTime2",          label: "Takt (s)",     group: "Display 2" },
  { key: "lineMonthlyProduction2", label: "Monthly",      group: "Display 2" },
  { key: "qualityProcessCode",     label: "Process Code", group: "Quality"   },
  { key: "qualityLineName",        label: "Line Name",    group: "Quality"   },
  { key: "sectionName",            label: "Section",      group: "Loss"      },
];

const GROUP_CONFIG = {
  "General":   { color: "#6366f1", light: "#eef2ff", icon: FiCpu,       label: "General Info"   },
  "Display 1": { color: "#0ea5e9", light: "#e0f2fe", icon: FiLayers,    label: "Main Display 1" },
  "Display 2": { color: "#f59e0b", light: "#fef3c7", icon: FiZap,       label: "Main Display 2" },
  "Quality":   { color: "#8b5cf6", light: "#ede9fe", icon: FiShield,    label: "Quality"        },
  "Loss":      { color: "#ef4444", light: "#fee2e2", icon: FiBarChart2,  label: "Loss Analysis"  },
};

const FORM_SECTIONS = [
  {
    group: "General",
    fields: [
      { key: "dashboardName", label: "Dashboard Name",              placeholder: "e.g. FREEZER FG PACKING", full: true },
      { key: "lineName",      label: "Line Name",                   placeholder: "e.g. FREEZER" },
      { key: "lineCode",      label: "Line Code",                   placeholder: "e.g. 12501" },
    ],
  },
  {
    group: "Display 1",
    fields: [
      { key: "stationCode1",           label: "Station Code",       placeholder: "e.g. 1220010" },
      { key: "stationName1",           label: "Station Name",       placeholder: "e.g. FG PACKING" },
      { key: "lineTaktTime1",          label: "Takt Time (s)",      placeholder: "e.g. 40" },
      { key: "lineMonthlyProduction1", label: "Monthly Production", placeholder: "e.g. 27000" },
      { key: "lineTarget1",            label: "Target UPH",         placeholder: "e.g. 85" },
    ],
  },
  {
    group: "Display 2",
    fields: [
      { key: "stationCode2",           label: "Station Code",       placeholder: "e.g. 1220005" },
      { key: "stationName2",           label: "Station Name",       placeholder: "e.g. FG LOADING" },
      { key: "lineTaktTime2",          label: "Takt Time (s)",      placeholder: "e.g. 40" },
      { key: "lineMonthlyProduction2", label: "Monthly Production", placeholder: "e.g. 27000" },
    ],
  },
  {
    group: "Quality",
    fields: [
      { key: "qualityProcessCode", label: "Quality Process Code (comma-separated)", placeholder: "e.g. 12210, 12206", full: true },
      { key: "qualityLineName",    label: "Line Name",                               placeholder: "e.g. Freezer" },
    ],
  },
  {
    group: "Loss",
    fields: [
      { key: "sectionName", label: "Section Name (EMGMaster.Location)", placeholder: "e.g. FINAL ASSEMBLY", full: true },
    ],
  },
];

// ─── Pre-compute group header spans ──────────────────────────────────────────
const GROUP_SPANS = (() => {
  const spans = []; let i = 0;
  while (i < COLUMNS.length) {
    const g = COLUMNS[i].group; let count = 0;
    while (i + count < COLUMNS.length && COLUMNS[i + count].group === g) count++;
    spans.push({ group: g, count }); i += count;
  }
  return spans;
})();

// ─── Map DB row (PascalCase) → form state (camelCase) ────────────────────────
// Matches exactly what the controller returns via OUTPUT INSERTED.*
const dbToForm = (row) => ({
  id:                     row.Id,
  dashboardName:          row.DashboardName          ?? "",
  lineName:               row.LineName               ?? "",
  lineCode:               row.LineCode               ?? "",
  stationCode1:           row.StationCode1           ?? "",
  stationName1:           row.StationName1           ?? "",
  lineTaktTime1:          String(row.LineTaktTime1          ?? ""),
  lineMonthlyProduction1: String(row.LineMonthlyProduction1 ?? ""),
  lineTarget1:            String(row.LineTarget1            ?? ""),
  stationCode2:           row.StationCode2           ?? "",
  stationName2:           row.StationName2           ?? "",
  lineTaktTime2:          String(row.LineTaktTime2          ?? ""),
  lineMonthlyProduction2: String(row.LineMonthlyProduction2 ?? ""),
  qualityProcessCode:     row.QualityProcessCode     ?? "",
  qualityLineName:        row.QualityLineName        ?? "",
  sectionName:            row.SectionName            ?? "",
});

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: { bg: "#f0fdf4", border: "#86efac", icon: <FiCheck size={14}/>, text: "#15803d" },
    error:   { bg: "#fef2f2", border: "#fca5a5", icon: <FiAlertTriangle size={14}/>, text: "#dc2626" },
    info:    { bg: "#eff6ff", border: "#93c5fd", icon: <FiActivity size={14}/>, text: "#1d4ed8" },
  };
  const s = styles[type] || styles.info;

  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
      padding: "12px 18px", color: s.text, fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex",
      alignItems: "center", gap: 10, minWidth: 240,
      animation: "slideUp 0.25s ease",
    }}>
      {s.icon} {message}
      <button onClick={onClose} style={{
        marginLeft: "auto", background: "none", border: "none",
        cursor: "pointer", color: s.text, opacity: 0.6, display: "flex",
      }}>
        <FiX size={13}/>
      </button>
    </div>
  );
};

// ─── Config Form Modal ────────────────────────────────────────────────────────
const ConfigModal = ({ config, saving, onClose, onSave }) => {
  const [form, setForm] = useState({ ...config });
  const [activeSection, setActiveSection] = useState(0);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!config.id;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 780,
        maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 28px", borderBottom: "1px solid #f1f5f9", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FiSettings color="#fff" size={20}/>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", fontFamily: "'Georgia', serif" }}>
                {isEdit ? "Edit Configuration" : "New Dashboard"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 1 }}>
                Configure production line dashboard settings
              </div>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} style={{
            width: 36, height: 36, borderRadius: 8, border: "1px solid #e2e8f0",
            background: "#f8fafc", cursor: "pointer", color: "#64748b",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FiX size={16}/>
          </button>
        </div>

        {/* Section Tabs */}
        <div style={{
          display: "flex", padding: "12px 28px", gap: 8, background: "#f8fafc",
          borderBottom: "1px solid #f1f5f9", flexShrink: 0, overflowX: "auto",
        }}>
          {FORM_SECTIONS.map((sec, i) => {
            const cfg = GROUP_CONFIG[sec.group];
            const Icon = cfg.icon;
            const active = activeSection === i;
            return (
              <button key={i} onClick={() => setActiveSection(i)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "7px 14px",
                borderRadius: 8, border: active ? `1.5px solid ${cfg.color}` : "1.5px solid transparent",
                background: active ? cfg.light : "transparent",
                color: active ? cfg.color : "#64748b", fontWeight: 700, fontSize: 12,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              }}>
                <Icon size={13}/>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "24px 28px", flex: 1 }}>
          {(() => {
            const sec = FORM_SECTIONS[activeSection];
            const cfg = GROUP_CONFIG[sec.group];
            return (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
                  padding: "14px 16px", background: cfg.light, borderRadius: 10,
                  border: `1px solid ${cfg.color}22`,
                }}>
                  <cfg.icon color={cfg.color} size={16}/>
                  <span style={{ color: cfg.color, fontWeight: 700, fontSize: 13 }}>{cfg.label}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: "auto" }}>
                    {sec.fields.length} fields
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {sec.fields.map((f) => (
                    <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : "auto" }}>
                      <label style={{
                        display: "block", fontSize: 12, fontWeight: 600,
                        color: "#475569", marginBottom: 6, letterSpacing: 0.3,
                      }}>{f.label}</label>
                      <input
                        value={form[f.key] || ""}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        disabled={saving}
                        style={{
                          width: "100%", boxSizing: "border-box", padding: "10px 14px",
                          borderRadius: 9, background: "#f8fafc",
                          border: "1.5px solid #e2e8f0", color: "#0f172a",
                          fontSize: 13, outline: "none", transition: "all 0.15s",
                          opacity: saving ? 0.6 : 1, fontFamily: "monospace",
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = cfg.color;
                          e.target.style.background = "#fff";
                          e.target.style.boxShadow = `0 0 0 3px ${cfg.color}18`;
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = "#e2e8f0";
                          e.target.style.background = "#f8fafc";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 28px", borderTop: "1px solid #f1f5f9", background: "#fafafa", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {FORM_SECTIONS.map((_, i) => (
              <div key={i} onClick={() => setActiveSection(i)} style={{
                width: i === activeSection ? 24 : 8, height: 8, borderRadius: 4,
                background: i === activeSection ? "#6366f1" : "#e2e8f0",
                cursor: "pointer", transition: "all 0.3s",
              }}/>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {activeSection > 0 && (
              <button onClick={() => setActiveSection(s => s - 1)} disabled={saving} style={{
                padding: "10px 20px", borderRadius: 9, background: "#f1f5f9",
                border: "1px solid #e2e8f0", color: "#475569", fontWeight: 600,
                fontSize: 13, cursor: "pointer",
              }}>← Back</button>
            )}
            {activeSection < FORM_SECTIONS.length - 1 ? (
              <button onClick={() => setActiveSection(s => s + 1)} disabled={saving} style={{
                padding: "10px 20px", borderRadius: 9, background: "#6366f1",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>Next →</button>
            ) : (
              <button onClick={() => onSave(form)} disabled={saving} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "10px 28px",
                borderRadius: 9,
                background: saving ? "#cbd5e1" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
              }}>
                {saving
                  ? <><FiLoader size={14} style={{ animation: "spin 1s linear infinite" }}/> Saving…</>
                  : <><FiSave size={14}/> {isEdit ? "Update Config" : "Save Config"}</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Launch Modal ─────────────────────────────────────────────────────────────
const LaunchModal = ({ config, onClose, onLaunch }) => {
  const pad2 = (n) => String(n).padStart(2, "0");
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const [shiftDate, setShiftDate] = useState(todayISO());
  const [shift, setShift] = useState("A");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.65)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: 480,
        overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          background: "linear-gradient(135deg, #059669, #10b981)", padding: "22px 26px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: "rgba(255,255,255,0.2)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <FiPlay color="#fff" size={20}/>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "'Georgia', serif" }}>
              Launch Dashboard
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              {config.dashboardName}
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 26px" }}>
          {/* Date picker */}
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 12,
              fontWeight: 700, color: "#475569", marginBottom: 7,
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              <FiCalendar size={12}/> Shift Date
            </label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} style={{
              width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 9,
              background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#0f172a",
              fontSize: 13, outline: "none",
            }}/>
          </div>

          {/* Shift selector */}
          <div style={{ marginBottom: 22 }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 700, color: "#475569",
              marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5,
            }}>Shift</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["A", "08:00 – 20:00", "#059669", "#ecfdf5"],
                ["B", "20:00 – 08:00", "#d97706", "#fefce8"],
              ].map(([s, lbl, color, bg]) => (
                <button key={s} onClick={() => setShift(s)} style={{
                  padding: "14px 0", borderRadius: 10, cursor: "pointer",
                  border: shift === s ? `2px solid ${color}` : "2px solid #e2e8f0",
                  background: shift === s ? bg : "#f8fafc",
                  color: shift === s ? color : "#94a3b8", fontWeight: 700,
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 18 }}>Shift {s}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4 }}>{lbl}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Config summary */}
          <div style={{
            background: "#f8fafc", borderRadius: 10, padding: "12px 14px",
            marginBottom: 22, border: "1px solid #e2e8f0",
          }}>
            {[
              ["Line",      `${config.lineName || "—"} · ${config.lineCode || "—"}`],
              ["Station 1", `${config.stationCode1 || "—"} — ${config.stationName1 || "—"}`],
              ["Station 2", config.stationCode2 ? `${config.stationCode2} — ${config.stationName2}` : "Not configured"],
              ["Quality",   config.qualityProcessCode || "Not configured"],
              ["Section",   config.sectionName || "Not configured"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 12 }}>
                <span style={{ color: "#94a3b8", minWidth: 68 }}>{k}</span>
                <span style={{ color: "#334155", fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <button onClick={onClose} style={{
              padding: "12px 0", borderRadius: 10, background: "#f1f5f9",
              border: "1px solid #e2e8f0", color: "#64748b", fontWeight: 600,
              fontSize: 13, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={() => onLaunch(config, shiftDate, shift)} style={{
              padding: "12px 0", borderRadius: 10,
              background: "linear-gradient(135deg, #059669, #10b981)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
            }}>
              <FiPlay size={14}/> Open Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────────────
const DeleteModal = ({ name, saving, onClose, onConfirm }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.65)",
    backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
    justifyContent: "center", padding: 24,
  }}>
    <div style={{
      background: "#fff", borderRadius: 20, width: 400, padding: 32,
      boxShadow: "0 32px 80px rgba(0,0,0,0.2)", textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: "#fee2e2",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <FiTrash2 color="#ef4444" size={28}/>
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", marginBottom: 8 }}>
        Delete Configuration?
      </div>
      <div style={{ color: "#64748b", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        <strong style={{ color: "#ef4444" }}>{name}</strong> will be permanently removed.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={onClose} disabled={saving} style={{
          padding: "12px 0", borderRadius: 10, background: "#f1f5f9",
          border: "1px solid #e2e8f0", color: "#64748b", fontWeight: 600,
          cursor: "pointer", opacity: saving ? 0.5 : 1,
        }}>Keep It</button>
        <button onClick={onConfirm} disabled={saving} style={{
          padding: "12px 0", borderRadius: 10, background: "#ef4444",
          border: "none", color: "#fff", fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {saving
            ? <><FiLoader size={14} style={{ animation: "spin 1s linear infinite" }}/> Deleting…</>
            : <><FiTrash2 size={14}/> Delete</>
          }
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const DashboardConfigPage = () => {
  const navigate = useNavigate();
  const [configs,  setConfigs]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [modal,    setModal]    = useState(null); // { type: "add"|"edit"|"launch"|"delete", config }
  const [toast,    setToast]    = useState(null);
  const [search,   setSearch]   = useState("");

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // ── Fetch all configs from GET /dashboard/configs ─────────────────────────
  const fetchConfigs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(API);
      // Controller returns { success, data: [...] }
      setConfigs((res.data?.data ?? []).map(dbToForm));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load configurations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // ── Save: POST or PUT ─────────────────────────────────────────────────────
  const handleSave = useCallback(async (form) => {
    if (!form.dashboardName?.trim()) { showToast("Dashboard name is required.", "error"); return; }
    if (!form.stationCode1?.trim())  { showToast("Station Code 1 is required.", "error"); return; }

    setSaving(true);
    try {
      if (form.id) {
        // PUT /dashboard/configs/:id
        const res = await axios.put(`${API}/${form.id}`, form);
        const updated = dbToForm(res.data.data);
        setConfigs(c => c.map(x => x.id === form.id ? updated : x));
        showToast("Configuration updated successfully.");
      } else {
        // POST /dashboard/configs
        const res = await axios.post(API, form);
        const created = dbToForm(res.data.data);
        setConfigs(c => [created, ...c]);
        showToast("New configuration saved.");
      }
      setModal(null);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  // ── Delete: soft-delete via DELETE /dashboard/configs/:id ─────────────────
  const handleDelete = useCallback(async (id) => {
    setSaving(true);
    try {
      await axios.delete(`${API}/${id}`);
      setConfigs(c => c.filter(x => x.id !== id));
      showToast("Configuration deleted.", "info");
      setModal(null);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete.", "error");
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  // ── Launch: navigate to /final-assembly with full config state ────────────
  // FinalAssembly reads state.config and passes it to buildParams(),
  // which maps → stationCode1, stationCode2, lineCode, sectionName,
  //              lineTaktTime1, lineTaktTime2, stationName1, stationName2
  const handleLaunch = useCallback((cfg, shiftDate, shift) => {
    setModal(null);
    navigate("/display/final-assembly", {
      state: { config: cfg, shiftDate, shift, autoLoad: true },
    });
  }, [navigate]);

  const filtered = configs.filter(c =>
    [c.dashboardName, c.lineName, c.sectionName, c.stationName1, c.stationName2]
      .some(v => (v || "").toLowerCase().includes(search.toLowerCase()))
  );

  const stats = [
    { label: "Total Configs",  value: configs.length,                                                     color: "#6366f1", bg: "#eef2ff", icon: FiSettings  },
    { label: "Active Lines",   value: [...new Set(configs.map(c => c.lineName).filter(Boolean))].length,   color: "#0ea5e9", bg: "#e0f2fe", icon: FiLayers    },
    { label: "Sections",       value: [...new Set(configs.map(c => c.sectionName).filter(Boolean))].length, color: "#f59e0b", bg: "#fef3c7", icon: FiBarChart2 },
    { label: "Dual Displays",  value: configs.filter(c => c.stationCode2?.trim()).length,                   color: "#10b981", bg: "#ecfdf5", icon: FiZap       },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", padding: "28px 32px",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
          }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 22 }}>W</span>
          </div>
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 800, fontFamily: "'Georgia', serif" }}>
              Dashboard Manager
            </h1>
            <p style={{ margin: "3px 0 0", color: "#94a3b8", fontSize: 13 }}>
              Manage production line configurations · Launch shift dashboards
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 9, padding: "9px 14px",
            background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
          }}>
            <FiSearch color="#94a3b8" size={14}/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search configurations…"
              style={{
                background: "none", border: "none", color: "#0f172a",
                outline: "none", fontSize: 13, width: 220,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#94a3b8", display: "flex", padding: 0,
              }}>
                <FiX size={13}/>
              </button>
            )}
          </div>

          <button onClick={fetchConfigs} disabled={loading} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
            background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
            color: "#475569", fontWeight: 600, fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
            <FiRefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }}/>
            Refresh
          </button>

          <button
            onClick={() => setModal({ type: "add", config: { ...EMPTY_FORM } })}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 13,
              borderRadius: 10, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <FiPlus size={14}/> New Config
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12,
          padding: "14px 18px", color: "#dc2626", fontSize: 13, marginBottom: 20,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <FiAlertCircle size={16}/> {error}
          </span>
          <button onClick={fetchConfigs} style={{
            display: "flex", alignItems: "center", gap: 5, background: "#ef4444",
            border: "none", borderRadius: 7, color: "#fff", padding: "6px 14px",
            cursor: "pointer", fontWeight: 700, fontSize: 12,
          }}>
            <FiRefreshCw size={11}/> Retry
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              background: "#fff", borderRadius: 14, padding: "18px 20px",
              border: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: s.bg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon color={s.color} size={22}/>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "#fff", borderRadius: 16, overflow: "hidden",
        border: "1px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              {/* Group header row */}
              <tr>
                <th style={{
                  background: "#f8fafc", padding: "10px 16px",
                  borderBottom: "1px solid #f1f5f9", color: "#94a3b8",
                  fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", textAlign: "left",
                }}>Actions</th>
                {GROUP_SPANS.map(({ group, count }) => {
                  const cfg = GROUP_CONFIG[group];
                  const Icon = cfg.icon;
                  return (
                    <th key={group} colSpan={count} style={{
                      background: cfg.light, padding: "10px 12px",
                      borderBottom: `2px solid ${cfg.color}44`,
                      borderLeft: "1px solid #f1f5f9",
                      color: cfg.color, fontWeight: 800, fontSize: 11,
                      textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center",
                    }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Icon size={11}/> {group}
                      </span>
                    </th>
                  );
                })}
              </tr>
              {/* Column header row */}
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #f1f5f9" }}>
                <th style={{ padding: "8px 16px", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 10 }}></th>
                {COLUMNS.map(col => (
                  <th key={col.key} style={{
                    padding: "8px 10px", borderBottom: "1px solid #f1f5f9",
                    borderLeft: "1px solid #f1f5f9", color: "#64748b",
                    fontSize: 10, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap",
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} style={{ padding: 56, textAlign: "center", background: "#fff" }}>
                    <FiLoader size={28} color="#6366f1" style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 12px" }}/>
                    <div style={{ fontSize: 14, color: "#94a3b8" }}>Loading configurations…</div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} style={{ padding: 56, textAlign: "center", background: "#fff" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 16, background: "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 14px",
                    }}>
                      <FiSettings size={28} color="#cbd5e1"/>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>
                      {search ? "No results found" : "No configurations yet"}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 5 }}>
                      {search
                        ? `No configs match "${search}"`
                        : "Click 'New Config' to add your first configuration"}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((cfg, ri) => (
                <tr
                  key={cfg.id}
                  style={{
                    background: ri % 2 === 0 ? "#fff" : "#fafafa",
                    borderBottom: "1px solid #f8fafc", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                  onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "#fafafa"}
                >
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #f8fafc", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button
                        onClick={() => setModal({ type: "launch", config: cfg })}
                        title="Launch Dashboard"
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                          borderRadius: 7, background: "#ecfdf5", border: "none",
                          color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        <FiPlay size={10}/> Launch
                      </button>
                      <button
                        onClick={() => setModal({ type: "edit", config: { ...cfg } })}
                        title="Edit"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: 7, background: "#eef2ff",
                          border: "none", color: "#6366f1", cursor: "pointer",
                        }}
                      >
                        <FiEdit2 size={12}/>
                      </button>
                      <button
                        onClick={() => setModal({ type: "delete", config: cfg })}
                        title="Delete"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: 7, background: "#fef2f2",
                          border: "none", color: "#ef4444", cursor: "pointer",
                        }}
                      >
                        <FiTrash2 size={12}/>
                      </button>
                    </div>
                  </td>
                  {COLUMNS.map(col => {
                    const v = cfg[col.key];
                    const isDash = col.key === "dashboardName";
                    const isNum  = ["lineTaktTime1","lineMonthlyProduction1","lineTarget1","lineTaktTime2","lineMonthlyProduction2"].includes(col.key);
                    return (
                      <td key={col.key} style={{
                        padding: "9px 10px", borderBottom: "1px solid #f8fafc",
                        borderLeft: "1px solid #f8fafc",
                        color: isDash ? "#0f172a" : "#475569",
                        fontWeight: isDash ? 700 : 400,
                        fontSize: isDash ? 12 : 11,
                        whiteSpace: "nowrap",
                        textAlign: isNum ? "center" : "left",
                      }}>
                        {v
                          ? isDash
                            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", flexShrink: 0, display: "inline-block" }}/>
                                {v}
                              </span>
                            : v
                          : <span style={{ color: "#e2e8f0" }}>—</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #f1f5f9",
          fontSize: 12, color: "#94a3b8",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FiActivity size={12} color="#6366f1"/>
            Showing <strong style={{ color: "#0f172a", margin: "0 3px" }}>{filtered.length}</strong>
            of <strong style={{ color: "#0f172a", margin: "0 3px" }}>{configs.length}</strong> configurations
          </span>
          <div style={{ display: "flex", gap: 14 }}>
            {Object.entries(GROUP_CONFIG).map(([g, c]) => {
              const Icon = c.icon;
              return (
                <span key={g} style={{ display: "flex", alignItems: "center", gap: 4, color: c.color, fontSize: 11 }}>
                  <Icon size={10}/> {g}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <ConfigModal
          config={modal.config}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal?.type === "launch" && (
        <LaunchModal
          config={modal.config}
          onClose={() => setModal(null)}
          onLaunch={handleLaunch}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          name={modal.config.dashboardName}
          saving={saving}
          onClose={() => !saving && setModal(null)}
          onConfirm={() => handleDelete(modal.config.id)}
        />
      )}

      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f8fafc; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.7; }
      `}</style>
    </div>
  );
};

export default DashboardConfigPage;