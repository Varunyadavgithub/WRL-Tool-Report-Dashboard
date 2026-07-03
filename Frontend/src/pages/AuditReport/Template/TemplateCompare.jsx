// ──────────────────────────────────────────────────────────────────────────
// Compare Versions — redesigned.
//
// What changed and why: the previous version nested a differently-colored
// bordered card at every level (section → stage → checkpoint → field),
// which is what made a modestly-sized diff look overwhelming. This version
// renders every level with the same row primitive (ChangeRow) and lets
// indentation — not color-blocking — communicate depth. Everything below
// the top level starts collapsed, so the page opens as a short scannable
// list instead of a wall of expanded detail; an "Expand all" toggle is
// there for when someone genuinely wants to see everything at once.
//
// Data fetching, param handling, and the diff shape consumed from the API
// are unchanged from the original implementation.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaExchangeAlt, FaClipboardList, FaExpandAlt, FaCompressAlt, FaHistory } from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import toast from "react-hot-toast";
import useAuditData from "../../../hooks/useAuditData";
import BeforeAfterCard from "./components/BeforeAfterCard";
import { ChangeRow, ChangeCountChip } from "./components/diff/ChangeRow";
import { EmptyState, SecondaryButton, CardSkeleton } from "../components/common";
import { fmtDateLong as fmtDate } from "../utils/formatters";

// ── Field-level diff shown when a modified checkpoint is expanded ────────
const FieldDiffList = ({ fields }) => (
  <div className="pl-[4.5rem] pb-2 space-y-2">
    {fields.map((f, fi) => (
      <div key={fi}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{f.field}</p>
        <BeforeAfterCard from={f.from} to={f.to} />
      </div>
    ))}
  </div>
);

// ── One stage's diff, nested inside a modified section ───────────────────
const StageDiffRow = ({ stage, expandAll }) => {
  const hasContent =
    stage.checkpoints.added.length > 0 || stage.checkpoints.removed.length > 0 || stage.checkpoints.modified.length > 0;

  return (
    <ChangeRow
      key={String(expandAll)}
      type="modified"
      label={stage.stageName}
      meta={stage.renamed ? `renamed from "${stage.renamed.from}"` : undefined}
      level={1}
      defaultOpen={expandAll}
    >
      {stage.renamed && <div className="pl-12 pb-2"><BeforeAfterCard from={stage.renamed.from} to={stage.renamed.to} /></div>}
      {stage.checkpoints.added.map((cp) => (
        <ChangeRow key={cp.id} type="added" label={cp.checkPoint} level={2} />
      ))}
      {stage.checkpoints.removed.map((cp) => (
        <ChangeRow key={cp.id} type="removed" label={cp.checkPoint} level={2} />
      ))}
      {stage.checkpoints.modified.map((cp) => (
        <ChangeRow
          key={`${cp.id}-${expandAll}`}
          type="modified"
          label={cp.checkPoint}
          meta={`${cp.fields.length} field${cp.fields.length !== 1 ? "s" : ""} changed`}
          level={2}
          defaultOpen={expandAll}
        >
          <FieldDiffList fields={cp.fields} />
        </ChangeRow>
      ))}
      {!hasContent && !stage.renamed && (
        <p className="pl-12 pb-2 text-xs text-slate-400">No further changes in this stage.</p>
      )}
    </ChangeRow>
  );
};

// ── One top-level section row (added / removed / renamed-only / modified) ─
const SectionDiffRow = ({ item, expandKey }) => {
  if (item.kind === "added") {
    return (
      <ChangeRow
        key={expandKey}
        type="added"
        label={item.sectionName}
        meta={`${item.stageCount} stages · ${item.checkpointCount} checkpoints`}
        level={0}
      />
    );
  }
  if (item.kind === "removed") {
    return (
      <ChangeRow
        key={expandKey}
        type="removed"
        label={item.sectionName}
        meta={`${item.stageCount} stages · ${item.checkpointCount} checkpoints`}
        level={0}
      />
    );
  }
  if (item.kind === "renamed") {
    return (
      <ChangeRow key={expandKey} type="renamed" label={item.to} meta="Section renamed" level={0} defaultOpen={item.defaultOpen}>
        <div className="pl-6 pb-2"><BeforeAfterCard from={item.from} to={item.to} /></div>
      </ChangeRow>
    );
  }
  // modified
  const sec = item.data;
  return (
    <ChangeRow
      key={expandKey}
      type="modified"
      label={sec.sectionName}
      meta={sec.renamed ? `renamed from "${sec.renamed.from}"` : "Modified"}
      level={0}
      defaultOpen={item.defaultOpen}
    >
      {sec.renamed && <div className="pl-6 pb-2"><BeforeAfterCard from={sec.renamed.from} to={sec.renamed.to} /></div>}
      {sec.stages.added.map((st) => (
        <ChangeRow key={st.id} type="added" label={st.stageName} meta={`${st.checkpointCount} checkpoints`} level={1} />
      ))}
      {sec.stages.removed.map((st) => (
        <ChangeRow key={st.id} type="removed" label={st.stageName} meta={`${st.checkpointCount} checkpoints`} level={1} />
      ))}
      {sec.stages.modified.map((stage) => (
        <StageDiffRow key={stage.id} stage={stage} expandAll={item.defaultOpen} />
      ))}
    </ChangeRow>
  );
};

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
  const [expandAll, setExpandAll] = useState(false);

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

  // Build one ordered, flat list of top-level section changes so rendering
  // is a single .map() instead of four separate blocks.
  const sectionItems = diff
    ? [
        ...diff.sections.added.map((s) => ({ kind: "added", key: `a-${s.id}`, ...s })),
        ...diff.sections.removed.map((s) => ({ kind: "removed", key: `r-${s.id}`, ...s })),
        ...diff.sections.renamed
          .filter((s) => !diff.sections.modified.some((m) => m.id === s.id))
          .map((s) => ({ kind: "renamed", key: `n-${s.id}`, ...s })),
        ...diff.sections.modified.map((s) => ({ kind: "modified", key: `m-${s.id}`, data: s })),
      ]
    : [];

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

      <div className="px-6 py-5 space-y-5 max-w-3xl mx-auto">
        {loadingDiff ? (
          <div className="space-y-3">
            <CardSkeleton rows={1} />
            <CardSkeleton rows={5} />
          </div>
        ) : !diff ? null : (
          <>
            {/* Version meta strip */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-wide mb-1">From — v{fromMeta.version}</p>
                <p className="text-xs text-slate-500">{fmtDate(fromMeta.createdAt)} · {fromMeta.createdBy || "System"}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {fromMeta.stats.sectionCount} sections · {fromMeta.stats.checkpointCount} checkpoints
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide mb-1">To — v{toMeta.version}</p>
                <p className="text-xs text-slate-500">{fmtDate(toMeta.createdAt)} · {toMeta.createdBy || "System"}</p>
                <p className="text-[11px] text-slate-400 mt-1">
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <ChangeCountChip type="added" count={buckets.added} label="added" />
                    <ChangeCountChip type="removed" count={buckets.removed} label="removed" />
                    <ChangeCountChip type="renamed" count={buckets.renamed} label="renamed" />
                    <ChangeCountChip type="modified" count={buckets.modified} label="checkpoint edits" />
                  </div>
                  <SecondaryButton
                    icon={expandAll ? FaCompressAlt : FaExpandAlt}
                    onClick={() => setExpandAll((v) => !v)}
                  >
                    {expandAll ? "Collapse all" : "Expand all"}
                  </SecondaryButton>
                </div>

                {/* Diff tree */}
                <div className="bg-white rounded-2xl border border-slate-200 px-4 divide-y divide-slate-50">
                  {sectionItems.map((item) => (
                    <SectionDiffRow key={item.key} item={{ ...item, defaultOpen: expandAll }} expandKey={`${item.key}-${expandAll}`} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemplateCompare;
