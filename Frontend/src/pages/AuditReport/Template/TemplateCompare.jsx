import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaExchangeAlt,
  FaLayerGroup,
  FaPlusCircle,
  FaMinusCircle,
  FaClipboardList,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import toast from "react-hot-toast";
import useAuditData from "../../../hooks/useAuditData";
import BeforeAfterCard from "./components/BeforeAfterCard";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

// ── Summary chip strip ────────────────────────────────────────────────────────
const SummaryStrip = ({ summary }) => {
  const chips = [
    { label: "Sections Added", value: summary.sectionsAdded, cls: "bg-green-50 text-green-700 border-green-200" },
    { label: "Sections Removed", value: summary.sectionsRemoved, cls: "bg-red-50 text-red-700 border-red-200" },
    { label: "Sections Renamed", value: summary.sectionsRenamed, cls: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Stages Added", value: summary.stagesAdded, cls: "bg-green-50 text-green-700 border-green-200" },
    { label: "Stages Removed", value: summary.stagesRemoved, cls: "bg-red-50 text-red-700 border-red-200" },
    { label: "Stages Renamed", value: summary.stagesRenamed, cls: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Checkpoints Added", value: summary.checkpointsAdded, cls: "bg-green-50 text-green-700 border-green-200" },
    { label: "Checkpoints Removed", value: summary.checkpointsRemoved, cls: "bg-red-50 text-red-700 border-red-200" },
    { label: "Checkpoints Modified", value: summary.checkpointsModified, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  ].filter((c) => c.value > 0);

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c.label}
          className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.cls}`}
        >
          {c.value} {c.label}
        </span>
      ))}
    </div>
  );
};

// ── Field-level checkpoint diff card ──────────────────────────────────────────
const CheckpointModifiedCard = ({ cp }) => (
  <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
    <div className="px-2.5 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] font-bold text-blue-700">
      {cp.checkPoint || "Checkpoint"}
    </div>
    <div className="divide-y divide-gray-50">
      {cp.fields.map((f, fi) => (
        <div key={fi}>
          <div className="px-2.5 pt-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wide">
            {f.field}
          </div>
          <BeforeAfterCard from={f.from} to={f.to} />
        </div>
      ))}
    </div>
  </div>
);

// ── Stage block inside a modified section ────────────────────────────────────
const StageBlock = ({ stage }) => (
  <div className="border border-gray-100 rounded-lg overflow-hidden">
    <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
      <span className="text-[11px] font-bold text-indigo-700">{stage.stageName}</span>
      {stage.renamed && (
        <span className="text-[9px] text-amber-600 font-semibold">
          renamed from "{stage.renamed.from}"
        </span>
      )}
    </div>
    <div className="p-2.5 space-y-2">
      {stage.checkpoints.added.map((cp) => (
        <div key={cp.id} className="flex items-center gap-2 text-[11px] text-green-700">
          <FaPlusCircle size={9} /> {cp.checkPoint}
        </div>
      ))}
      {stage.checkpoints.removed.map((cp) => (
        <div key={cp.id} className="flex items-center gap-2 text-[11px] text-red-700">
          <FaMinusCircle size={9} /> {cp.checkPoint}
        </div>
      ))}
      {stage.checkpoints.modified.map((cp) => (
        <CheckpointModifiedCard key={cp.id} cp={cp} />
      ))}
    </div>
  </div>
);

// ── Top-level section card ────────────────────────────────────────────────────
const SectionCard = ({ tone, title, subtitle, children }) => {
  const toneCls = {
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-white",
  }[tone];
  const headerTextCls = {
    green: "text-green-700",
    red: "text-red-700",
    amber: "text-amber-700",
    blue: "text-gray-800",
  }[tone];

  return (
    <div className={`rounded-xl border ${toneCls} overflow-hidden`}>
      <div className="px-4 py-2.5 flex items-center gap-2">
        <FaLayerGroup size={11} className={headerTextCls} />
        <span className={`text-sm font-bold ${headerTextCls}`}>{title}</span>
        {subtitle && <span className="text-[10px] text-gray-400 ml-1">{subtitle}</span>}
      </div>
      {children && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading version history…</p>
        </div>
      </div>
    );
  }

  const diff = result?.diff;
  const fromMeta = result?.from;
  const toMeta = result?.to;

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex-shrink-0"
              title="Back to Templates"
            >
              <FaArrowLeft size={13} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <HiClipboardDocumentCheck className="text-indigo-500 flex-shrink-0" size={16} />
              <h1 className="text-base font-black text-gray-800">Compare Versions</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:border-indigo-400"
            >
              {versions.map((v) => (
                <option key={v.Id} value={v.Version}>
                  v{v.Version} · {fmtDate(v.CreatedAt)}
                </option>
              ))}
            </select>
            <button
              onClick={swap}
              title="Swap"
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all"
            >
              <FaExchangeAlt size={12} />
            </button>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:border-indigo-400"
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

      <div className="px-6 py-5 space-y-5 max-w-5xl mx-auto">
        {loadingDiff ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : !diff ? null : (
          <>
            {/* Version meta strip */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">From — v{fromMeta.version}</p>
                <p className="text-xs text-gray-500">{fmtDate(fromMeta.createdAt)} · {fromMeta.createdBy || "System"}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {fromMeta.stats.sectionCount} sections · {fromMeta.stats.checkpointCount} checkpoints
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide mb-1">To — v{toMeta.version}</p>
                <p className="text-xs text-gray-500">{fmtDate(toMeta.createdAt)} · {toMeta.createdBy || "System"}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {toMeta.stats.sectionCount} sections · {toMeta.stats.checkpointCount} checkpoints
                </p>
              </div>
            </div>

            <SummaryStrip summary={diff.summary} />

            {!diff.summary.hasChanges ? (
              <div className="bg-white rounded-2xl border border-gray-200 py-14 text-center">
                <FaClipboardList className="text-4xl text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No differences between these two versions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {diff.sections.added.map((s) => (
                  <SectionCard
                    key={s.id}
                    tone="green"
                    title={s.sectionName}
                    subtitle={`Section Added · ${s.stageCount} stages · ${s.checkpointCount} checkpoints`}
                  />
                ))}
                {diff.sections.removed.map((s) => (
                  <SectionCard
                    key={s.id}
                    tone="red"
                    title={s.sectionName}
                    subtitle={`Section Removed · ${s.stageCount} stages · ${s.checkpointCount} checkpoints`}
                  />
                ))}
                {diff.sections.renamed
                  .filter((s) => !diff.sections.modified.some((m) => m.id === s.id))
                  .map((s) => (
                    <SectionCard key={s.id} tone="amber" title={s.to} subtitle="Section Renamed">
                      <BeforeAfterCard from={s.from} to={s.to} />
                    </SectionCard>
                  ))}
                {diff.sections.modified.map((sec) => (
                  <SectionCard
                    key={sec.id}
                    tone="blue"
                    title={sec.sectionName}
                    subtitle={sec.renamed ? `Renamed from "${sec.renamed.from}"` : "Modified"}
                  >
                    {sec.renamed && <BeforeAfterCard from={sec.renamed.from} to={sec.renamed.to} />}
                    {sec.stages.added.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-[11px] text-green-700 pl-1">
                        <FaPlusCircle size={9} /> Stage added: {st.stageName} ({st.checkpointCount} checkpoints)
                      </div>
                    ))}
                    {sec.stages.removed.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-[11px] text-red-700 pl-1">
                        <FaMinusCircle size={9} /> Stage removed: {st.stageName} ({st.checkpointCount} checkpoints)
                      </div>
                    ))}
                    {sec.stages.modified.map((stage) => (
                      <StageBlock key={stage.id} stage={stage} />
                    ))}
                  </SectionCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemplateCompare;
