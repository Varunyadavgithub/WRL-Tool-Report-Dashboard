/**
 * Settings.jsx — Role Permission Manager
 * Design matches FPA.jsx: slate-50 bg, white rounded-2xl cards,
 * indigo accent, sticky header, compact typography, left-bordered stat cards.
 */

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Save,
  RotateCcw,
  Users,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Search,
  Shield,
  Loader2,
} from "lucide-react";
import { ROUTE_CONFIG, ROLES } from "../../config/routes.config.js";
import { fetchRolePermissions, updateRolePermissions } from "../../redux/slices/permissionSlice.js";

const SUPER_ADMIN_ROLE = ROLES.SUPER_ADMIN;
const IN_PROGRESS_SECTIONS = ["compliance", "auditReport", "reading", "forms"];

// All roles except super admin
const MANAGEABLE_ROLES = Object.entries(ROLES)
  .filter(([, value]) => value !== SUPER_ADMIN_ROLE)
  .map(([key, value]) => ({ key, value }));

// ── Stat Card — identical to FPA.jsx StatCard ─────────────────────────────────
const StatCard = ({ label, value, accent, sub }) => (
  <div
    className="relative bg-white rounded-xl p-4 shadow-sm border border-gray-100 overflow-hidden"
    style={{ borderLeft: `4px solid ${accent}` }}
  >
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
      {label}
    </p>
    <p className="text-3xl font-black" style={{ color: accent }}>
      {value ?? "—"}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    <div
      className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10"
      style={{ background: accent }}
    />
  </div>
);

export default function Settings() {
  const { user } = useSelector((store) => store.auth);
  const { rolePermissions, loading } = useSelector((store) => store.permissions);
  const dispatch = useDispatch();
  const userRole = user?.role?.toLowerCase?.() ?? "";

  const [selectedRole, setSelectedRole] = useState(MANAGEABLE_ROLES[0]?.value ?? "");
  const [permissions, setPermissions] = useState({});
  const [expandedSections, setExpandedSections] = useState(
    Object.fromEntries(ROUTE_CONFIG.map((s) => [s.key, true]))
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (userRole !== SUPER_ADMIN_ROLE) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
          <p className="text-sm text-gray-400">Only Super Admin can manage permissions.</p>
        </div>
      </div>
    );
  }

  // ── Load permissions from backend ──────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchRolePermissions(selectedRole));
    setHasChanges(false);
    setSaved(false);
  }, [selectedRole, dispatch]);

  // ── Sync permissions from Redux state ─────────────────────────────────────
  useEffect(() => {
    if (rolePermissions && Object.keys(rolePermissions).length > 0) {
      setPermissions(rolePermissions);
    }
  }, [rolePermissions]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleSection = (key) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleItem = (sectionKey, itemPath) => {
    setPermissions((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [itemPath]: !prev[sectionKey]?.[itemPath] },
    }));
    setHasChanges(true);
    setSaved(false);
  };

  const toggleSectionAll = (section) => {
    const allItems = [...section.items, ...(section.hiddenItems ?? [])];
    const allOn = allItems.every((item) => permissions[section.key]?.[item.path]);
    const next = {};
    allItems.forEach((item) => { next[item.path] = !allOn; });
    setPermissions((prev) => ({ ...prev, [section.key]: { ...prev[section.key], ...next } }));
    setHasChanges(true);
    setSaved(false);
  };

  const toggleAll = (on) => {
    const next = {};
    ROUTE_CONFIG.forEach((section) => {
      next[section.key] = {};
      [...section.items, ...(section.hiddenItems ?? [])].forEach(
        (item) => { next[section.key][item.path] = on; }
      );
    });
    setPermissions(next);
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dispatch(updateRolePermissions({ role: selectedRole, permissions })).unwrap();
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save permissions:", error);
      alert("Failed to save permissions. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to deny all permissions (secure by default)
    // Permissions are now managed from backend, no hardcoded defaults
    const defaultPermissions = {};
    ROUTE_CONFIG.forEach((section) => {
      const allItems = [
        ...section.items,
        ...(section.hiddenItems ?? []),
      ];

      allItems.forEach((item) => {
        if (!defaultPermissions[section.key]) {
          defaultPermissions[section.key] = {};
        }

        // Default: deny all access
        defaultPermissions[section.key][item.path] = false;
      });
    });

    setPermissions(defaultPermissions);
    setHasChanges(true);
    setSaved(false);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalVisibleItems = ROUTE_CONFIG.reduce((a, s) => a + s.items.length, 0);
  const grantedItems = ROUTE_CONFIG.reduce(
    (a, s) => a + s.items.filter((item) => permissions[s.key]?.[item.path]).length, 0
  );
  const coveragePct = totalVisibleItems ? Math.round((grantedItems / totalVisibleItems) * 100) : 0;
  const coverageColor = coveragePct >= 80 ? "#22c55e" : coveragePct >= 40 ? "#f97316" : "#ef4444";

  const filteredRoles = MANAGEABLE_ROLES.filter((r) =>
    r.value.toLowerCase().includes(roleSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Sticky Header — mirrors FPA header exactly ───────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-none">
            Permission Manager
          </h1>
          <p className="text-xs text-gray-400">
            Role Access Control · Super Admin Only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: coverageColor + "20", color: coverageColor }}
          >
            {selectedRole.toUpperCase()}: {coveragePct}% access
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || loading}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-sm ${
              saved
                ? "bg-green-500 text-white shadow-green-200"
                : hasChanges
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-5">

        {/* ── KPI Row — mirrors FPA StatCard grid ──────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Managed Roles"
            value={MANAGEABLE_ROLES.length}
            accent="#6366f1"
            sub="excluding super admin"
          />
          <StatCard
            label="Pages Granted"
            value={grantedItems}
            accent="#22c55e"
            sub={`of ${totalVisibleItems} total`}
          />
          <StatCard
            label="Pages Denied"
            value={totalVisibleItems - grantedItems}
            accent="#ef4444"
            sub="for selected role"
          />
          <StatCard
            label="In Progress"
            value={IN_PROGRESS_SECTIONS.length}
            accent="#f97316"
            sub="modules locked"
          />
        </div>

        {/* ── Main 2-column layout ─────────────────────────────────────────── */}
        <div className="flex gap-5 flex-col xl:flex-row">

          {/* ── Left: Role Panel ─────────────────────────────────────────── */}
          <div className="xl:w-60 flex-shrink-0 space-y-3">

            {/* Role selector card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Roles
                </span>
              </div>

              {/* Role search */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5">
                  <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter roles…"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    className="bg-transparent text-xs outline-none w-full text-gray-600 placeholder-gray-400"
                  />
                </div>
              </div>

              <ul className="pb-2 max-h-[52vh] overflow-y-auto">
                {filteredRoles.map((role) => {
                  // For the selected role, use current permissions from state
                  // For other roles, we'd need to fetch them - for now show 0%
                  const perms = selectedRole === role.value ? permissions : {};
                  const granted = ROUTE_CONFIG.reduce(
                    (a, s) => a + s.items.filter((item) => perms[s.key]?.[item.path]).length, 0
                  );
                  const pct = totalVisibleItems ? Math.round((granted / totalVisibleItems) * 100) : 0;
                  const isSelected = selectedRole === role.value;
                  const barColor = pct >= 80 ? "#22c55e" : pct >= 40 ? "#f97316" : "#ef4444";

                  return (
                    <li key={role.key}>
                      <button
                        onClick={() => setSelectedRole(role.value)}
                        className={`w-full text-left px-4 py-3 transition-all duration-150 border-r-2 ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-600"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-semibold capitalize truncate max-w-[130px] ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
                            {role.value}
                          </span>
                          <span className="text-[10px] font-black" style={{ color: barColor }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Quick Actions
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition"
                >
                  <Unlock className="w-3.5 h-3.5" /> Grant All Pages
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition"
                >
                  <Lock className="w-3.5 h-3.5" /> Revoke All Pages
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Permission sections ────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Selected role info bar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 capitalize leading-none">
                    {selectedRole}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-semibold text-indigo-600">{grantedItems}</span>
                    {" "}of {totalVisibleItems} pages granted
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${coveragePct}%`, background: coverageColor }}
                  />
                </div>
                <span className="text-xs font-black w-10 text-right" style={{ color: coverageColor }}>
                  {coveragePct}%
                </span>
              </div>
              {hasChanges && (
                <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-semibold border border-amber-200">
                  Unsaved changes
                </span>
              )}
            </div>

            {/* Module cards */}
            {ROUTE_CONFIG.map((section) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections[section.key];
              const isWIP = IN_PROGRESS_SECTIONS.includes(section.key);
              const visibleItems = section.items;
              const hiddenItems = section.hiddenItems ?? [];
              const allItems = [...visibleItems, ...hiddenItems];

              const grantedInSection = visibleItems.filter(
                (item) => permissions[section.key]?.[item.path]
              ).length;
              const allOn = allItems.every((item) => permissions[section.key]?.[item.path]);

              return (
                <div
                  key={section.key}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden border ${
                    isWIP ? "border-amber-200" : "border-gray-200"
                  }`}
                >
                  {/* Section header — click to expand/collapse */}
                  <div
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors ${
                      isWIP ? "bg-amber-50 hover:bg-amber-100/50" : "hover:bg-slate-50"
                    }`}
                    onClick={() => toggleSection(section.key)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${isWIP ? "bg-amber-100" : "bg-indigo-50"}`}>
                        <SectionIcon className={`w-4 h-4 ${isWIP ? "text-amber-600" : "text-indigo-600"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{section.label}</span>
                          {isWIP && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" /> IN PROGRESS
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {grantedInSection}/{visibleItems.length} pages granted
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSectionAll(section); }}
                        className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${
                          allOn
                            ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {allOn ? "Deselect all" : "Select all"}
                      </button>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>

                  {/* Checkbox grid */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">

                      {/* Visible pages */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                          Pages
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {visibleItems.map((item) => {
                            const checked = permissions[section.key]?.[item.path] === true;
                            return (
                              <label
                                key={item.path}
                                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all duration-150 ${
                                  checked
                                    ? "bg-indigo-50 border-indigo-200"
                                    : "bg-slate-50 border-transparent hover:border-gray-200 hover:bg-white"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleItem(section.key, item.path)}
                                  className="sr-only"
                                />
                                {checked
                                  ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                                  : <Square className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                                }
                                <div className="min-w-0">
                                  <p className={`text-xs font-semibold truncate ${checked ? "text-indigo-800" : "text-gray-600"}`}>
                                    {item.label}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                                    {item.path}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* System / hidden routes */}
                      {hiddenItems.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                            System Routes
                            <span className="ml-2 normal-case font-normal text-gray-300">
                              (not in sidebar)
                            </span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {hiddenItems.map((item) => {
                              const checked = permissions[section.key]?.[item.path] === true;
                              return (
                                <label
                                  key={item.path}
                                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all duration-150 ${
                                    checked
                                      ? "bg-purple-50 border-purple-200"
                                      : "bg-slate-50 border-transparent hover:border-gray-200 hover:bg-white"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleItem(section.key, item.path)}
                                    className="sr-only"
                                  />
                                  {checked
                                    ? <CheckSquare className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                                    : <Square className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                                  }
                                  <div className="min-w-0">
                                    <p className={`text-xs font-semibold font-mono truncate ${checked ? "text-purple-800" : "text-gray-500"}`}>
                                      {item.path}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">system route</p>
                                  </div>
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
            })}
          </div>
        </div>
      </div>
    </div>
  );
}