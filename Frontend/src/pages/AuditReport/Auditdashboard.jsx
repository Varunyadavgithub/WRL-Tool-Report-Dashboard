/**
 * Settings.jsx — Role Permission Manager (v2 · Complete Redesign)
 *
 * AESTHETIC: Security Command Center — deep charcoal dark-mode, electric
 * indigo accents, monospaced route paths, frosted-glass header, coloured
 * role avatars, bottom "diff tray" that surfaces every pending change.
 *
 * ── BUGS FIXED ────────────────────────────────────────────────────────────────
 *  1. CRITICAL — React Hooks violation: both useEffect hooks appeared AFTER an
 *     early `return` guard. All hooks now unconditionally precede the guard.
 *  2. handleReset was silently setting all permissions to false locally; now
 *     re-fetches the last committed state from the backend.
 *  3. Stale permissions bled through on role switch when the incoming role had
 *     no DB rows (rolePermissions = {}) — the sync effect was skipped. Now
 *     initialises to all-false via buildEmptyPermissions() in that case.
 *  4. Non-selected roles in the sidebar showed 0% (misleading). Fixed: only
 *     the currently loaded role shows a live percentage + progress bar.
 *  5. alert() replaced with a non-blocking toast notification system.
 *  6. No guard when switching roles with unsaved changes → confirm modal added.
 *  7. No loading state in the permission grid → animated skeleton added.
 *
 * ── NEW FEATURES ──────────────────────────────────────────────────────────────
 *  • Full dark-mode Security Console redesign
 *  • Bottom Diff Tray — expandable panel listing every pending grant / revoke
 *  • Permission search bar — filters sections + items in real time
 *  • Donut SVG progress indicator per role (sidebar + info bar)
 *  • Copy / Clone permissions to another role (modal)
 *  • Keyboard shortcut Ctrl / ⌘ + S to save
 *  • Per-item amber dot when value differs from last-saved snapshot
 *  • Expand / Collapse all sections toggle
 *  • Error banner with Retry button
 *  • Toast notifications (success · error · info)
 *  • Unsaved-changes confirm modal on role switch
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Save,
  Users,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  AlertTriangle,
  Search,
  Loader2,
  Copy,
  X,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  Info,
  Filter,
  Shield,
} from "lucide-react";
import { ROUTE_CONFIG, ROLES } from "../../config/routes.config.js";
import {
  fetchRolePermissions,
  updateRolePermissions,
} from "../../redux/slices/permissionSlice.js";

// ── Constants ──────────────────────────────────────────────────────────────────
const SUPER_ADMIN_ROLE     = ROLES.SUPER_ADMIN;
const IN_PROGRESS_SECTIONS = ["compliance", "auditReport", "reading", "forms"];
const MANAGEABLE_ROLES     = Object.entries(ROLES)
  .filter(([, v]) => v !== SUPER_ADMIN_ROLE)
  .map(([key, value]) => ({ key, value }));

// Deterministic colour for role avatars based on first char code
const ROLE_PALETTE = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b",
  "#f43f5e", "#a78bfa", "#ec4899", "#84cc16",
];
const roleColor  = (name) => ROLE_PALETTE[(name?.charCodeAt(0) ?? 0) % ROLE_PALETTE.length];
const cvColor    = (pct)  => pct >= 80 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";

// ── Utilities ──────────────────────────────────────────────────────────────────
const buildEmptyPermissions = () => {
  const map = {};
  ROUTE_CONFIG.forEach((s) => {
    map[s.key] = {};
    // FIX: guard against sections where items is undefined
    [...(s.items ?? []), ...(s.hiddenItems ?? [])].forEach((i) => {
      if (i?.path) map[s.key][i.path] = false;
    });
  });
  return map;
};

// ── Donut progress SVG ─────────────────────────────────────────────────────────
const Donut = ({ pct, color, size = 36, stroke = 3.5 }) => {
  const r    = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2235" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
};

// ── Toast system ───────────────────────────────────────────────────────────────
const Toast = ({ toasts, remove }) => (
  <div className="fixed bottom-24 right-5 z-50 flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl"
        style={{
          background : t.type === "success" ? "#052e16" : t.type === "error" ? "#450a0a" : "#0f172a",
          border     : `1px solid ${t.type === "success" ? "#16a34a" : t.type === "error" ? "#dc2626" : "#334155"}`,
          color      : "#f1f5f9",
        }}
      >
        {t.type === "success"
          ? <Check        className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} />
          : t.type === "error"
          ? <AlertCircle  className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
          : <Info         className="w-4 h-4 shrink-0" style={{ color: "#60a5fa" }} />}
        {t.message}
        <button onClick={() => remove(t.id)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

// ── Confirm modal ──────────────────────────────────────────────────────────────
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmLabel = "Confirm", danger }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        style={{ background: "#161929", border: "1px solid #252840" }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ background: danger ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)" }}>
          <AlertTriangle className="w-6 h-6" style={{ color: danger ? "#f87171" : "#fbbf24" }} />
        </div>
        <h3 className="text-base font-bold mb-1.5" style={{ color: "#e2e8f0" }}>{title}</h3>
        <p  className="text-sm mb-5"              style={{ color: "#94a3b8" }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition"
            style={{ background: "#252840", color: "#94a3b8" }}>Cancel</button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition"
            style={{ background: danger ? "#7f1d1d" : "#3730a3", color: "#fff" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ── Copy-role modal ────────────────────────────────────────────────────────────
const CopyRoleModal = ({ open, fromRole, roles, onCopy, onClose }) => {
  const [target, setTarget] = useState("");
  useEffect(() => { if (open) setTarget(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        style={{ background: "#161929", border: "1px solid #252840" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4" style={{ color: "#818cf8" }} />
            <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Clone Permissions</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: "#64748b" }} />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: "#64748b" }}>
          Copy all permissions from{" "}
          <span className="font-bold capitalize" style={{ color: "#818cf8" }}>{fromRole}</span>{" "}
          into:
        </p>
        <select
          value={target} onChange={(e) => setTarget(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-4"
          style={{ background: "#0c0e18", border: "1px solid #252840", color: "#e2e8f0" }}>
          <option value="">Select target role…</option>
          {roles.filter((r) => r.value !== fromRole).map((r) => (
            <option key={r.key} value={r.value}>{r.value}</option>
          ))}
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#252840", color: "#94a3b8" }}>Cancel</button>
          <button onClick={() => target && onCopy(target)} disabled={!target}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
            style={{ background: "#3730a3", color: "#fff" }}>Clone</button>
        </div>
      </div>
    </div>
  );
};

// ── Diff Tray ─────────────────────────────────────────────────────────────────
// Floats above the page bottom, listing every pending grant/revoke change.
const DiffTray = ({ changes, onSave, onDiscard, isSaving }) => {
  const [expanded, setExpanded] = useState(false);
  if (changes.length === 0) return null;
  const granted = changes.filter((c) => c.newVal).length;
  const revoked = changes.filter((c) => !c.newVal).length;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40"
      style={{ background: "#0c0e18", borderTop: "1px solid #252840", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}>

      {/* Expanded list */}
      {expanded && (
        <div className="px-6 py-4 max-h-48 overflow-y-auto" style={{ borderBottom: "1px solid #1e2235" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#475569" }}>
            Pending Changes
          </p>
          <div className="flex flex-wrap gap-2">
            {changes.map((c, i) => (
              <span key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono"
                style={{
                  background : c.newVal ? "rgba(52,211,153,0.08)"  : "rgba(248,113,113,0.08)",
                  color      : c.newVal ? "#34d399"                 : "#f87171",
                  border     : `1px solid ${c.newVal ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                }}>
                {c.newVal ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                {c.sectionLabel} › {c.itemLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tray action bar */}
      <div className="flex items-center justify-between px-6 py-3 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: "#818cf8" }}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {changes.length} pending change{changes.length !== 1 ? "s" : ""}
          </button>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#475569" }}>
            {granted > 0 && (
              <span className="flex items-center gap-1" style={{ color: "#34d399" }}>
                <Unlock className="w-3 h-3" /> {granted} granted
              </span>
            )}
            {revoked > 0 && (
              <span className="flex items-center gap-1" style={{ color: "#f87171" }}>
                <Lock className="w-3 h-3" /> {revoked} revoked
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
            style={{ background: "#1e2235", color: "#475569", border: "1px solid #252840" }}>⌘S</kbd>
          <button onClick={onDiscard}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-125 transition"
            style={{ background: "#252840", color: "#94a3b8" }}>Discard</button>
          <button onClick={onSave} disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-60 transition"
            style={{ background: "#4338ca", color: "#fff" }}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? "Saving…" : "Commit Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Loading skeleton ───────────────────────────────────────────────────────────
const PermissionSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-2xl p-4" style={{ background: "#161929", border: "1px solid #252840" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg" style={{ background: "#1e2235" }} />
          <div className="space-y-1.5">
            <div className="h-3 w-32 rounded" style={{ background: "#1e2235" }} />
            <div className="h-2.5 w-20 rounded" style={{ background: "#161929" }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((j) => (
            <div key={j} className="h-14 rounded-xl" style={{ background: "#1e2235" }} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="rounded-2xl p-4 relative overflow-hidden"
    style={{ background: "#161929", border: "1px solid #252840" }}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#475569" }}>{label}</p>
      <div className="p-1.5 rounded-lg" style={{ background: color + "18" }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
    </div>
    <p className="text-3xl font-black mb-0.5" style={{ color }}>{value ?? "—"}</p>
    {sub && <p className="text-[11px]" style={{ color: "#475569" }}>{sub}</p>}
    <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full"
      style={{ background: color, opacity: 0.06 }} />
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Settings() {

  // ── ALL HOOKS BEFORE ANY CONDITIONAL RETURN (Rules of Hooks) ──────────────

  const { user }                            = useSelector((s) => s.auth);
  const { rolePermissions, loading, error } = useSelector((s) => s.permissions);
  const dispatch                            = useDispatch();

  const [selectedRole,     setSelectedRole]     = useState(MANAGEABLE_ROLES[0]?.value ?? "");
  const [pendingRole,      setPendingRole]       = useState(null);
  const [permissions,      setPermissions]       = useState({});
  const [expandedSections, setExpandedSections] = useState(
    Object.fromEntries(ROUTE_CONFIG.map((s) => [s.key, true]))
  );
  const [allExpanded,      setAllExpanded]       = useState(true);
  const [hasChanges,       setHasChanges]        = useState(false);
  const [saved,            setSaved]             = useState(false);
  const [roleSearch,       setRoleSearch]        = useState("");
  const [permSearch,       setPermSearch]        = useState("");
  const [isSaving,         setIsSaving]          = useState(false);
  const [isCopying,        setIsCopying]         = useState(false);
  const [toasts,           setToasts]            = useState([]);
  const [showUnsavedModal, setShowUnsavedModal]  = useState(false);
  const [showCopyModal,    setShowCopyModal]     = useState(false);

  const toastIdRef = useRef(0);
  // Ref so keyboard shortcut can always call the latest handleSave without
  // capturing a stale closure (handleSave is defined later in the function).
  const saveRef    = useRef(null);

  const userRole = user?.roleName?.toLowerCase?.() ?? "";

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    []
  );

  // ── Fetch permissions when role changes ────────────────────────────────────
  useEffect(() => {
    if (userRole !== SUPER_ADMIN_ROLE) return;
    dispatch(fetchRolePermissions(selectedRole));
    setHasChanges(false);
    setSaved(false);
  }, [selectedRole, dispatch, userRole]);

  // ── Sync Redux → local state ───────────────────────────────────────────────
  useEffect(() => {
    if (!rolePermissions) return;
    // FIX: when the role has no DB rows, rolePermissions === {} — previously
    // this branch was skipped, leaving the previous role's data visible.
    setPermissions(
      Object.keys(rolePermissions).length > 0
        ? rolePermissions
        : buildEmptyPermissions()
    );
  }, [rolePermissions]);

  // ── Keyboard shortcut ⌘S / Ctrl+S ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── GUARD: placed AFTER every hook ────────────────────────────────────────
  if (userRole !== SUPER_ADMIN_ROLE) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0c0e18" }}>
        <div className="rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl"
          style={{ background: "#161929", border: "1px solid #252840" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(248,113,113,0.1)" }}>
            <Lock className="w-8 h-8" style={{ color: "#f87171" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>Access Denied</h2>
          <p className="text-sm"             style={{ color: "#64748b" }}>
            Only Super Admin can manage permissions.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalItems   = ROUTE_CONFIG.reduce((a, s) => a + s.items.length, 0);
  const grantedCount = ROUTE_CONFIG.reduce(
    (a, s) => a + s.items.filter((i) => permissions[s.key]?.[i.path]).length, 0
  );
  const pct    = totalItems ? Math.round((grantedCount / totalItems) * 100) : 0;
  const color  = cvColor(pct);

  // Build diff list for the Diff Tray
  const changes = [];
  if (rolePermissions) {
    ROUTE_CONFIG.forEach((section) => {
      // FIX: guard — some sections in ROUTE_CONFIG may have items: undefined
      [...(section.items ?? []), ...(section.hiddenItems ?? [])].forEach((item) => {
        if (!item?.path) return;
        const orig = Boolean(rolePermissions[section.key]?.[item.path] ?? false);
        const curr = Boolean(permissions[section.key]?.[item.path] ?? false);
        if (orig !== curr) {
          changes.push({
            sectionKey  : section.key,
            sectionLabel: section.label ?? section.key,
            itemPath    : item.path,
            itemLabel   : item.label ?? item.path,
            oldVal      : orig,
            newVal      : curr,
          });
        }
      });
    });
  }

  const filteredRoles = MANAGEABLE_ROLES.filter((r) =>
    r.value.toLowerCase().includes(roleSearch.toLowerCase())
  );

  // Live-filter sections and their items by the permission search query
  const filteredConfig = (() => {
    if (!permSearch) {
      return ROUTE_CONFIG.map((s) => ({
        ...s,
        // FIX: s.items may be undefined for sections still being wired up
        visibleItems : s.items ?? [],
        visibleHidden: s.hiddenItems ?? [],
      }));
    }
    const q = permSearch.toLowerCase();
    return ROUTE_CONFIG.reduce((acc, section) => {
      const sectionHit   = (section.label ?? "").toLowerCase().includes(q);
      // FIX: guard — section.items may be undefined
      const safeItems    = section.items ?? [];
      const safeHidden   = section.hiddenItems ?? [];
      const visibleItems = sectionHit
        ? safeItems
        : safeItems.filter(
            (i) => (i.label ?? "").toLowerCase().includes(q) || (i.path ?? "").toLowerCase().includes(q)
          );
      const visibleHidden = sectionHit
        ? safeHidden
        : safeHidden.filter(
            (i) => (i.path ?? "").toLowerCase().includes(q) || (i.label ?? "").toLowerCase().includes(q)
          );
      if (visibleItems.length > 0 || visibleHidden.length > 0) {
        acc.push({ ...section, visibleItems, visibleHidden });
      }
      return acc;
    }, []);
  })();

  // ── Action helpers ─────────────────────────────────────────────────────────
  const mark = () => { setHasChanges(true); setSaved(false); };

  const handleRoleSwitch = (role) => {
    if (role === selectedRole) return;
    if (hasChanges) { setPendingRole(role); setShowUnsavedModal(true); }
    else setSelectedRole(role);
  };

  const confirmRoleSwitch = () => {
    setSelectedRole(pendingRole);
    setPendingRole(null);
    setShowUnsavedModal(false);
    setHasChanges(false);
  };

  const toggleSection = (key) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  const toggleAllExpanded = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    setExpandedSections(Object.fromEntries(ROUTE_CONFIG.map((s) => [s.key, next])));
  };

  const toggleItem = (sectionKey, itemPath) => {
    setPermissions((p) => ({
      ...p,
      [sectionKey]: { ...p[sectionKey], [itemPath]: !p[sectionKey]?.[itemPath] },
    }));
    mark();
  };

  const toggleSectionAll = (section) => {
    // FIX: guard — section.items may be undefined
    const all   = [...(section.items ?? []), ...(section.hiddenItems ?? [])];
    const allOn = all.every((i) => permissions[section.key]?.[i.path]);
    const next  = Object.fromEntries(all.map((i) => [i.path, !allOn]));
    setPermissions((p) => ({ ...p, [section.key]: { ...p[section.key], ...next } }));
    mark();
  };

  const toggleAll = (on) => {
    const next = {};
    ROUTE_CONFIG.forEach((s) => {
      next[s.key] = {};
      // FIX: guard — some sections may have items: undefined
      [...(s.items ?? []), ...(s.hiddenItems ?? [])].forEach((i) => {
        if (i?.path) next[s.key][i.path] = on;
      });
    });
    setPermissions(next);
    mark();
  };

  // FIX: was resetting to all-false locally; now re-fetches backend state
  const handleReset = () => {
    dispatch(fetchRolePermissions(selectedRole));
    setHasChanges(false);
    setSaved(false);
    addToast("Reset to last saved state", "info");
  };

  const handleDiscard = () => handleReset();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dispatch(updateRolePermissions({ role: selectedRole, permissions })).unwrap();
      setSaved(true);
      setHasChanges(false);
      addToast("Permissions saved successfully", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      addToast("Failed to save — please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Keep ref in sync so the keyboard shortcut always invokes the latest version
  saveRef.current = handleSave;

  const handleCopy = async (targetRole) => {
    setIsCopying(true);
    setShowCopyModal(false);
    try {
      await dispatch(updateRolePermissions({ role: targetRole, permissions })).unwrap();
      addToast(`Permissions cloned to "${targetRole}"`, "success");
    } catch {
      addToast("Failed to clone permissions", "error");
    } finally {
      setIsCopying(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background  : "#0c0e18",
        color       : "#e2e8f0",
        paddingBottom: changes.length > 0 ? "76px" : "0",
      }}
    >
      {/* Portals */}
      <Toast toasts={toasts} remove={removeToast} />

      <ConfirmModal
        open={showUnsavedModal}
        title="Unsaved Changes"
        message={`You have ${changes.length} unsaved change${changes.length !== 1 ? "s" : ""}. Switching roles will discard them. Continue?`}
        onConfirm={confirmRoleSwitch}
        onCancel={() => { setShowUnsavedModal(false); setPendingRole(null); }}
        confirmLabel="Discard & Switch"
        danger
      />

      <CopyRoleModal
        open={showCopyModal}
        fromRole={selectedRole}
        roles={MANAGEABLE_ROLES}
        onCopy={handleCopy}
        onClose={() => setShowCopyModal(false)}
      />

      {/* ══ Frosted-glass sticky header ══════════════════════════════════════ */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 flex-wrap gap-3"
        style={{
          background    : "rgba(12,14,24,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom  : "1px solid #1e2235",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: "rgba(99,102,241,0.15)" }}>
            <Shield className="w-4 h-4" style={{ color: "#818cf8" }} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none tracking-tight" style={{ color: "#e2e8f0" }}>
              Permission Manager
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: "#475569" }}>
              Role Access Control · Super Admin Only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {changes.length > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-lg font-semibold"
              style={{
                background: "rgba(251,191,36,0.1)",
                color     : "#fbbf24",
                border    : "1px solid rgba(251,191,36,0.2)",
              }}
            >
              {changes.length} change{changes.length !== 1 ? "s" : ""}
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: color + "18", color }}
          >
            {selectedRole.toUpperCase()} · {pct}%
          </span>
          <button
            onClick={handleReset} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-125 disabled:opacity-40 transition"
            style={{ background: "#1e2235", color: "#94a3b8" }}
            title="Reset to last saved state"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg disabled:cursor-not-allowed hover:brightness-110 transition"
            style={{
              background: saved ? "#065f46" : hasChanges ? "#3730a3" : "#1e2235",
              color     : saved || hasChanges ? "#fff" : "#475569",
            }}
          >
            {isSaving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Save    className="w-3.5 h-3.5" />}
            {isSaving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-5">

        {/* ══ KPI strip ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Managed Roles"  value={MANAGEABLE_ROLES.length}     icon={Users}          color="#818cf8" sub="excl. super admin"      />
          <StatCard label="Pages Granted"  value={grantedCount}                icon={Unlock}         color="#34d399" sub={`of ${totalItems} total`} />
          <StatCard label="Pages Denied"   value={totalItems - grantedCount}   icon={Lock}           color="#f87171" sub="for selected role"        />
          <StatCard label="In Progress"    value={IN_PROGRESS_SECTIONS.length} icon={AlertTriangle}  color="#fbbf24" sub="modules locked"           />
        </div>

        {/* ══ Error banner ════════════════════════════════════════════════ */}
        {error && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
            <p className="text-sm font-medium" style={{ color: "#fca5a5" }}>{error}</p>
            <button
              onClick={() => dispatch(fetchRolePermissions(selectedRole))}
              className="ml-auto text-xs font-semibold underline"
              style={{ color: "#f87171" }}
            >Retry</button>
          </div>
        )}

        {/* ══ Main 2-column layout ════════════════════════════════════════ */}
        <div className="flex gap-5 flex-col xl:flex-row">

          {/* ── Left sidebar ───────────────────────────────────────────── */}
          <div className="xl:w-64 shrink-0 space-y-3">

            {/* Role list */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#161929", border: "1px solid #252840" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1e2235" }}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: "#818cf8" }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#475569" }}>
                    Roles
                  </span>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: "#818cf8" }}>
                  {MANAGEABLE_ROLES.length}
                </span>
              </div>

              {/* Role search */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "#0c0e18", border: "1px solid #252840" }}>
                  <Search className="w-3 h-3 shrink-0" style={{ color: "#475569" }} />
                  <input
                    type="text" placeholder="Filter roles…" value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    className="bg-transparent text-xs outline-none w-full"
                    style={{ color: "#cbd5e1" }}
                  />
                </div>
              </div>

              <ul className="pb-2 max-h-[52vh] overflow-y-auto">
                {filteredRoles.map((role) => {
                  const isSelected = role.value === selectedRole;
                  const rc         = roleColor(role.value);
                  return (
                    <li key={role.key}>
                      <button
                        onClick={() => handleRoleSwitch(role.value)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-all"
                        style={{
                          background : isSelected ? rc + "12" : "transparent",
                          borderRight: `2px solid ${isSelected ? rc : "transparent"}`,
                        }}
                      >
                        {/* Coloured avatar */}
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 uppercase"
                          style={{ background: rc + "20", color: rc }}
                        >{role.value.slice(0, 2)}</div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold capitalize truncate"
                            style={{ color: isSelected ? rc : "#cbd5e1" }}>
                            {role.value}
                          </p>
                          {/* Live progress bar only for the currently loaded role */}
                          {isSelected && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "#252840" }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: color }} />
                              </div>
                              <span className="text-[9px] font-black tabular-nums" style={{ color }}>{pct}%</span>
                            </div>
                          )}
                        </div>

                        {isSelected && <Donut pct={pct} color={color} size={28} stroke={3} />}
                      </button>
                    </li>
                  );
                })}
                {filteredRoles.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs" style={{ color: "#475569" }}>
                    No roles match &ldquo;{roleSearch}&rdquo;
                  </li>
                )}
              </ul>
            </div>

            {/* Quick-action card */}
            <div className="rounded-2xl p-4" style={{ background: "#161929", border: "1px solid #252840" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#475569" }}>
                Quick Actions
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "Grant All",   Icon: Unlock,                           c: "#34d399", action: () => toggleAll(true)          },
                  { label: "Revoke All",  Icon: Lock,                             c: "#f87171", action: () => toggleAll(false)         },
                  { label: isCopying ? "Cloning…" : "Clone to Role",
                    Icon: isCopying ? Loader2 : Copy,                             c: "#818cf8", action: () => setShowCopyModal(true)   },
                  { label: allExpanded ? "Collapse All" : "Expand All",
                    Icon: allExpanded ? Minimize2 : Maximize2,                    c: "#94a3b8", action: toggleAllExpanded              },
                ].map(({ label, Icon, c, action }) => (
                  <button
                    key={label} onClick={action}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:brightness-125 transition"
                    style={{ background: c + "10", color: c }}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${label === "Cloning…" ? "animate-spin" : ""}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: permissions ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Role info bar */}
            <div
              className="rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4"
              style={{ background: "#161929", border: "1px solid #252840" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black uppercase"
                  style={{ background: roleColor(selectedRole) + "20", color: roleColor(selectedRole) }}
                >{selectedRole.slice(0, 2)}</div>
                <div>
                  <h2 className="text-sm font-bold capitalize leading-none" style={{ color: "#e2e8f0" }}>
                    {selectedRole}
                  </h2>
                  <p className="text-[11px] mt-1" style={{ color: "#475569" }}>
                    <span className="font-bold" style={{ color: "#818cf8" }}>{grantedCount}</span>
                    {" "}of {totalItems} pages granted
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 min-w-32 flex-1">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#252840" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-black tabular-nums" style={{ color }}>{pct}%</span>
                </div>
                <Donut pct={pct} color={color} size={44} stroke={4} />
              </div>
            </div>

            {/* Permission search */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: "#161929", border: "1px solid #252840" }}
            >
              <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: "#475569" }} />
              <input
                type="text"
                placeholder="Search permissions by name or path…"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1"
                style={{ color: "#cbd5e1" }}
              />
              {permSearch && (
                <button onClick={() => setPermSearch("")}
                  className="p-0.5 rounded transition hover:bg-white/5"
                  style={{ color: "#475569" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* No results */}
            {!loading && permSearch && filteredConfig.length === 0 && (
              <div className="rounded-2xl px-5 py-8 text-center"
                style={{ background: "#161929", border: "1px solid #252840" }}>
                <p className="text-sm" style={{ color: "#475569" }}>
                  No permissions match &ldquo;{permSearch}&rdquo;
                </p>
              </div>
            )}

            {/* Section cards */}
            {loading ? <PermissionSkeleton /> : (
              filteredConfig.map((section) => {
                // ── PRIMARY FIX ──────────────────────────────────────────────
                // section.icon is undefined for some ROUTE_CONFIG entries that
                // haven't had an icon assigned yet.  Calling
                //   React.createElement(undefined, ...)  →  white screen crash.
                // Fall back to Shield so the section always renders.
                const SectionIcon   = section.icon ?? Shield;

                const isExpanded    = expandedSections[section.key];
                const isWIP         = IN_PROGRESS_SECTIONS.includes(section.key);

                // FIX: guard — visibleItems / section.items may be undefined
                const visItems      = section.visibleItems  ?? section.items ?? [];
                const hidItems      = section.visibleHidden ?? section.hiddenItems ?? [];

                // FIX: guard — section.items may be undefined
                const allSectionItems = [...(section.items ?? []), ...(section.hiddenItems ?? [])];

                const grantedInSection = visItems.filter(
                  (i) => permissions[section.key]?.[i.path]
                ).length;
                const allOn = allSectionItems.every((i) => permissions[section.key]?.[i.path]);
                const sPct  = visItems.length
                  ? Math.round((grantedInSection / visItems.length) * 100)
                  : 0;
                const sColor = cvColor(sPct);

                return (
                  <div
                    key={section.key}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: "#161929",
                      border    : `1px solid ${isWIP ? "rgba(251,191,36,0.25)" : "#252840"}`,
                    }}
                  >
                    {/* Section header */}
                    <div
                      className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors"
                      style={{ background: isWIP ? "rgba(251,191,36,0.04)" : "transparent" }}
                      onClick={() => toggleSection(section.key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg"
                          style={{ background: isWIP ? "rgba(251,191,36,0.15)" : "rgba(99,102,241,0.12)" }}>
                          <SectionIcon className="w-4 h-4"
                            style={{ color: isWIP ? "#fbbf24" : "#818cf8" }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
                              {section.label}
                            </span>
                            {isWIP && (
                              <span
                                className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                IN PROGRESS
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: "#475569" }}>
                            <span style={{ color: sColor }}>{grantedInSection}</span>
                            /{visItems.length} pages granted
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSectionAll(section); }}
                          className="text-xs px-3 py-1 rounded-lg font-semibold hover:brightness-125 transition"
                          style={{
                            background: allOn ? "rgba(99,102,241,0.15)" : "#1e2235",
                            color     : allOn ? "#818cf8" : "#64748b",
                          }}
                        >{allOn ? "Deselect all" : "Select all"}</button>
                        {isExpanded
                          ? <ChevronDown  className="w-4 h-4" style={{ color: "#475569" }} />
                          : <ChevronRight className="w-4 h-4" style={{ color: "#475569" }} />}
                      </div>
                    </div>

                    {/* Checkbox grid */}
                    {isExpanded && (
                      <div className="p-4 space-y-4" style={{ borderTop: "1px solid #1e2235" }}>

                        {/* Visible pages */}
                        {visItems.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5"
                              style={{ color: "#334155" }}>Pages</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                              {visItems.map((item) => {
                                const checked    = permissions[section.key]?.[item.path] === true;
                                const origVal    = Boolean(rolePermissions?.[section.key]?.[item.path] ?? false);
                                const isModified = origVal !== checked;
                                return (
                                  <label
                                    key={item.path}
                                    className="relative flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
                                    style={{
                                      background: checked ? "rgba(99,102,241,0.1)" : "#1e2235",
                                      border    : `1.5px solid ${checked ? "rgba(99,102,241,0.3)" : "transparent"}`,
                                    }}
                                  >
                                    <input
                                      type="checkbox" checked={checked}
                                      onChange={() => toggleItem(section.key, item.path)}
                                      className="sr-only"
                                    />
                                    {checked
                                      ? <CheckSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#818cf8" }} />
                                      : <Square      className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#334155" }} />}
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate"
                                        style={{ color: checked ? "#c7d2fe" : "#94a3b8" }}>
                                        {item.label}
                                      </p>
                                      <p className="text-[10px] font-mono truncate mt-0.5"
                                        style={{ color: "#334155" }}>
                                        {item.path}
                                      </p>
                                    </div>
                                    {/* Amber dot = value differs from last saved */}
                                    {isModified && (
                                      <span
                                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                                        style={{ background: "#fbbf24" }}
                                        title="Modified (unsaved)"
                                      />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* System / hidden routes */}
                        {hidItems.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5"
                              style={{ color: "#334155" }}>
                              System Routes
                              <span className="ml-2 normal-case font-normal" style={{ color: "#252840" }}>
                                (not in sidebar)
                              </span>
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                              {hidItems.map((item) => {
                                const checked    = permissions[section.key]?.[item.path] === true;
                                const origVal    = Boolean(rolePermissions?.[section.key]?.[item.path] ?? false);
                                const isModified = origVal !== checked;
                                return (
                                  <label
                                    key={item.path}
                                    className="relative flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
                                    style={{
                                      background: checked ? "rgba(167,139,250,0.1)" : "#1e2235",
                                      border    : `1.5px solid ${checked ? "rgba(167,139,250,0.25)" : "transparent"}`,
                                    }}
                                  >
                                    <input
                                      type="checkbox" checked={checked}
                                      onChange={() => toggleItem(section.key, item.path)}
                                      className="sr-only"
                                    />
                                    {checked
                                      ? <CheckSquare className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
                                      : <Square      className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#334155" }} />}
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-mono font-semibold truncate"
                                        style={{ color: checked ? "#c4b5fd" : "#64748b" }}>
                                        {item.path}
                                      </p>
                                      <p className="text-[10px] mt-0.5" style={{ color: "#334155" }}>
                                        system route
                                      </p>
                                    </div>
                                    {isModified && (
                                      <span
                                        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                                        style={{ background: "#fbbf24" }}
                                        title="Modified (unsaved)"
                                      />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ══ Bottom Diff Tray ═════════════════════════════════════════════════ */}
      <DiffTray
        changes={changes}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isSaving}
      />
    </div>
  );
}