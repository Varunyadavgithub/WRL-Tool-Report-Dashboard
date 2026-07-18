// ──────────────────────────────────────────────────────────────────────────
// Compare Versions — redesigned.
//
// What changed and why: the previous version was a nested tree (section →
// stage → checkpoint → field) that looked overwhelming even for a modest
// diff. This version flattens the whole diff into one flat, sortable-by-eye
// table — one row per atomic change — so every change is scannable at a
// glance instead of requiring you to trace indentation levels.
//
// Data fetching, param handling, and the diff shape consumed from the API
// are unchanged from the original implementation.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaExchangeAlt, FaClipboardList, FaHistory } from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import toast from "react-hot-toast";
import useAuditData from "../../../hooks/useAuditData";
import { ChangeCountChip } from "./components/diff/ChangeRow";
import { CHANGE_TYPE } from "./components/diff/changeType";
import { EmptyState, SecondaryButton, CardSkeleton } from "../components/common";
import { fmtDateLong as fmtDate } from "../utils/formatters";

const TypeBadge = ({ type }) => {
  const cfg = CHANGE_TYPE[type] || CHANGE_TYPE.modified;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border ${cfg.chip}`}>
      <Icon size={8} aria-hidden="true" /> {cfg.label}
    </span>
  );
};

// Flattens the section → stage → checkpoint → field diff tree into one flat
// list of atomic changes — the unit a table row represents.
const flattenDiff = (diff) => {
  const rows = [];
  let rid = 0;
  const push = (row) => rows.push({ id: rid++, before: "", after: "", field: "", stage: "", checkpoint: "", ...row });

  diff.sections.added.forEach((s) =>
    push({ type: "added", section: s.sectionName, field: `${s.stageCount} stages · ${s.checkpointCount} checkpoints` }));
  diff.sections.removed.forEach((s) =>
    push({ type: "removed", section: s.sectionName, field: `${s.stageCount} stages · ${s.checkpointCount} checkpoints` }));
  diff.sections.renamed
    .filter((s) => !diff.sections.modified.some((m) => m.id === s.id))
    .forEach((s) => push({ type: "renamed", section: s.to, field: "Section Name", before: s.from, after: s.to }));

  diff.sections.modified.forEach((sec) => {
    if (sec.renamed) {
      push({ type: "renamed", section: sec.sectionName, field: "Section Name", before: sec.renamed.from, after: sec.renamed.to });
    }
    sec.stages.added.forEach((st) =>
      push({ type: "added", section: sec.sectionName, stage: st.stageName, field: `${st.checkpointCount} checkpoints` }));
    sec.stages.removed.forEach((st) =>
      push({ type: "removed", section: sec.sectionName, stage: st.stageName, field: `${st.checkpointCount} checkpoints` }));
    sec.stages.modified.forEach((stage) => {
      if (stage.renamed) {
        push({ type: "renamed", section: sec.sectionName, stage: stage.stageName, field: "Stage Name", before: stage.renamed.from, after: stage.renamed.to });
      }
      stage.checkpoints.added.forEach((cp) =>
        push({ type: "added", section: sec.sectionName, stage: stage.stageName, checkpoint: cp.checkPoint }));
      stage.checkpoints.removed.forEach((cp) =>
        push({ type: "removed", section: sec.sectionName, stage: stage.stageName, checkpoint: cp.checkPoint }));
      stage.checkpoints.modified.forEach((cp) => {
        cp.fields.forEach((f) =>
          push({ type: "modified", section: sec.sectionName, stage: stage.stageName, checkpoint: cp.checkPoint, field: f.field, before: f.from, after: f.to }));
      });
    });
  });

  return rows;
};

const DiffTable = ({ rows }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          {["Type", "Section", "Stage", "Checkpoint", "Field / Details", "Before", "After"].map((h) => (
            <th key={h} className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
            <td className="px-4 py-2.5"><TypeBadge type={r.type} /></td>
            <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{r.section || "—"}</td>
            <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{r.stage || "—"}</td>
            <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{r.checkpoint || "—"}</td>
            <td className="px-4 py-2.5 text-slate-500">{r.field || "—"}</td>
            <td className="px-4 py-2.5">
              {r.before ? <span className="text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1 break-all">{r.before}</span> : <span className="text-slate-300">—</span>}
            </td>
            <td className="px-4 py-2.5">
              {r.after ? <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1 break-all">{r.after}</span> : <span className="text-slate-300">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────
const TemplateCompare = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getTemplateVersions, compareTemplateVersions } = useAuditData();

  const [versions, setVersions] = useState([]);
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [result, setResult] = useState(null);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Load version chain once, default to the latest two when no query params given
  useEffect(() => {
    let active = true;
    setLoadingVersions(true);
    getTemplateVersions(id)
      .then((rows) => {
        if (!active) return;
        setVersions(rows);
        if (!searchParams.get("from") && !searchParams.get("to") && rows.length >= 2) {
          setTo(rows[0].Version);
          setFrom(rows[1].Version);
        } else if (!searchParams.get("from") && !searchParams.get("to") && rows.length === 1) {
          setTo(rows[0].Version);
          setFrom(rows[0].Version);
        }
      })
      .catch((err) => {
        toast.error("Failed to load versions: " + err.message);
        navigate(`/auditreport/templates`);
      })
      .finally(() => active && setLoadingVersions(false));
    return () => {
      active = false;
    };
  }, [id]);

  const runCompare = useCallback(
    (f, t) => {
      if (!f || !t) return;
      setLoadingDiff(true);
      compareTemplateVersions(id, f, t)
        .then(setResult)
        .catch((err) => toast.error("Compare failed: " + err.message))
        .finally(() => setLoadingDiff(false));
    },
    [id],
  );

  // Re-run whenever from/to settle (after defaulting) or change via the pickers
  useEffect(() => {
    if (!from || !to) return;
    setSearchParams({ from, to }, { replace: true });
    runCompare(from, to);
  }, [from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  if (loadingVersions) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Loading version history…</p>
        </div>
      </div>
    );
  }

  const diff = result?.diff;
  const fromMeta = result?.from;
  const toMeta = result?.to;

  const diffRows = diff ? flattenDiff(diff) : [];

  // Four buckets instead of the original nine — added/removed/renamed roll
  // up section+stage+checkpoint counts; "modified" is checkpoint field
  // edits, which is the only place a true field-level "modification" happens.
  const buckets = diff
    ? {
        added: diff.summary.sectionsAdded + diff.summary.stagesAdded + diff.summary.checkpointsAdded,
        removed: diff.summary.sectionsRemoved + diff.summary.stagesRemoved + diff.summary.checkpointsRemoved,
        renamed: diff.summary.sectionsRenamed + diff.summary.stagesRenamed,
        modified: diff.summary.checkpointsModified,
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300"
              aria-label="Back to templates"
            >
              <FaArrowLeft size={13} className="text-slate-600" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <HiClipboardDocumentCheck className="text-indigo-500 flex-shrink-0" size={16} aria-hidden="true" />
              <h1 className="text-base font-bold text-slate-900 truncate">Compare Versions</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecondaryButton icon={FaHistory} onClick={() => navigate(`/auditreport/templates/${id}/history`)}>
              Change log
            </SecondaryButton>
            <label className="sr-only" htmlFor="compare-from">From version</label>
            <select
              id="compare-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {versions.map((v) => (
                <option key={v.Id} value={v.Version}>
                  v{v.Version} · {fmtDate(v.CreatedAt)}
                </option>
              ))}
            </select>
            <button
              onClick={swap}
              aria-label="Swap from and to versions"
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300"
            >
              <FaExchangeAlt size={12} aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor="compare-to">To version</label>
            <select
              id="compare-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {versions.map((v) => (
                <option key={v.Id} value={v.Version}>
                  v{v.Version} · {fmtDate(v.CreatedAt)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-5 space-y-5">
        {loadingDiff ? (
          <div className="space-y-3">
            <CardSkeleton rows={1} />
            <CardSkeleton rows={5} />
          </div>
        ) : !diff ? null : (
          <>
            {/* Version meta strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1.5">From — v{fromMeta.version}</p>
                <p className="text-sm text-slate-600 font-medium">{fmtDate(fromMeta.createdAt)} · {fromMeta.createdBy || "System"}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {fromMeta.stats.sectionCount} sections · {fromMeta.stats.checkpointCount} checkpoints
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide mb-1.5">To — v{toMeta.version}</p>
                <p className="text-sm text-slate-600 font-medium">{fmtDate(toMeta.createdAt)} · {toMeta.createdBy || "System"}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {toMeta.stats.sectionCount} sections · {toMeta.stats.checkpointCount} checkpoints
                </p>
              </div>
            </div>

            {!diff.summary.hasChanges ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState icon={FaClipboardList} title="No differences between these two versions" />
              </div>
            ) : (
              <>
                {/* Overview strip — 4 buckets instead of 9 chips */}
                <div className="flex flex-wrap gap-2">
                  <ChangeCountChip type="added" count={buckets.added} label="added" />
                  <ChangeCountChip type="removed" count={buckets.removed} label="removed" />
                  <ChangeCountChip type="renamed" count={buckets.renamed} label="renamed" />
                  <ChangeCountChip type="modified" count={buckets.modified} label="checkpoint edits" />
                </div>

                {/* Diff table — one row per atomic change */}
                <DiffTable rows={diffRows} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemplateCompare;
