import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "../../components/ui/SelectField.jsx";
import DateTimePicker from "../../components/ui/DateTimePicker.jsx";
import Loader from "../../components/ui/Loader.jsx";
import ExportButton from "../../components/ui/ExportButton.jsx";
import { baseURL } from "../../assets/assets.js";
import {
  ClipboardList,
  UserCheck,
  Users,
  ShieldCheck,
  LayoutDashboard,
  RefreshCcw,
  Loader2,
  Check,
  X,
  LogOut,
  LogIn,
  Search,
  Inbox,
} from "lucide-react";

/* ── Static option lists ────────────────────────────────────────── */
const TYPE_OPTIONS = [
  { value: "Official", label: "Official" },
  { value: "Personal", label: "Personal" },
];
const COMING_BACK_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];
const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "Pending Dept Head", label: "Pending Dept Head" },
  { value: "Pending HR", label: "Pending HR" },
  { value: "Approved", label: "Approved" },
  { value: "Out", label: "Out" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
];

const STATUS_STYLES = {
  "Pending Dept Head": "bg-amber-50 text-amber-700 border-amber-200",
  "Pending HR": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Out: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-slate-100 text-slate-500 border-slate-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

const TABS = [
  { key: "request", label: "Request Pass", icon: ClipboardList },
  { key: "depthead", label: "Dept Head", icon: UserCheck },
  { key: "hr", label: "HR Approval", icon: Users },
  { key: "security", label: "Security Gate", icon: ShieldCheck },
  { key: "dashboard", label: "All Passes", icon: LayoutDashboard },
];

const EMPTY_FORM = {
  empCode: "",
  empName: "",
  deptName: "",
  contactNo: "",
  placeOfVisit: "",
  reason: "",
  type: "Official",
  comingBack: "Yes",
  outDateTime: "",
  expectedInDateTime: "",
};

/* ── Small shared bits ─────────────────────────────────────────── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
      STATUS_STYLES[status] || "bg-slate-100 text-slate-500 border-slate-200"
    }`}
  >
    {status}
  </span>
);

const EmptyState = ({ title, subtitle }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-14">
    <Inbox className="w-10 h-10 opacity-25" strokeWidth={1.2} />
    <p className="text-sm font-medium text-slate-500">{title}</p>
    {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
  </div>
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const Gatepass = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null); // row currently mid-action

  const [activeTab, setActiveTab] = useState("request");
  const [passes, setPasses] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [nameDrafts, setNameDrafts] = useState({}); // { [passId]: "typed name" }

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  /* ── Fetch ── */
  const fetchPasses = async ({ silent = false } = {}) => {
    try {
      if (!silent) setRefreshing(true);
      const res = await axios.get(`${baseURL}gatepass/list`);
      if (res?.data?.success) setPasses(res.data.data);
    } catch {
      toast.error("Failed to load gate passes.");
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived queues ── */
  const deptHeadQueue = useMemo(
    () => passes.filter((p) => p.status === "Pending Dept Head"),
    [passes],
  );
  const hrQueue = useMemo(
    () => passes.filter((p) => p.status === "Pending HR"),
    [passes],
  );
  const readyForOut = useMemo(
    () => passes.filter((p) => p.status === "Approved"),
    [passes],
  );
  const currentlyOut = useMemo(
    () => passes.filter((p) => p.status === "Out"),
    [passes],
  );
  const recentRequests = useMemo(
    () =>
      [...passes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [passes],
  );
  const dashboardRows = useMemo(() => {
    let rows = [...passes];
    if (statusFilter !== "All") {
      rows = rows.filter((p) => p.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter((p) =>
        `${p.empName}${p.empCode}${p.deptName}`.toLowerCase().includes(s),
      );
    }
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [passes, statusFilter, search]);

  const stats = useMemo(
    () => ({
      pending: deptHeadQueue.length + hrQueue.length,
      approved: readyForOut.length,
      out: currentlyOut.length,
    }),
    [deptHeadQueue, hrQueue, readyForOut, currentlyOut],
  );

  /* ── Handlers: create ── */
  const handleFormChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = [
      "empCode",
      "empName",
      "deptName",
      "contactNo",
      "placeOfVisit",
      "reason",
      "outDateTime",
    ];
    const missing = required.filter((f) => !form[f]?.trim?.());
    if (missing.length) {
      toast.error("Please fill in all required fields.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await axios.post(`${baseURL}gatepass/create`, form);
      if (res?.data?.success) {
        toast.success("Request submitted to Dept Head.");
        setForm(EMPTY_FORM);
        fetchPasses({ silent: true });
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to submit gate pass.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Handlers: approvals ── */
  const handleApproval = async (id, stage, decision) => {
    const name = (nameDrafts[id] || "").trim();
    if (!name) {
      toast.error("Please enter your name first.");
      return;
    }
    try {
      setActionId(id);
      const res = await axios.put(`${baseURL}gatepass/${id}/${stage}`, {
        name,
        decision,
      });
      if (res?.data?.success) {
        toast.success(
          decision === "Approved" ? "Approved and forwarded." : "Rejected.",
        );
        fetchPasses({ silent: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  /* ── Handlers: security ── */
  const handleSecurity = async (id, direction) => {
    const name = (nameDrafts[id] || "").trim();
    if (!name) {
      toast.error("Please enter the supervisor's name first.");
      return;
    }
    try {
      setActionId(id);
      const res = await axios.put(
        `${baseURL}gatepass/${id}/security/${direction}`,
        { name },
      );
      if (res?.data?.success) {
        toast.success(
          direction === "out" ? "Gate out logged." : "Gate in logged.",
        );
        fetchPasses({ silent: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  /* ── Export ── */
  const fetchExportData = async () => {
    try {
      const res = await axios.get(`${baseURL}gatepass/export`, {
        params: {
          status: statusFilter !== "All" ? statusFilter : undefined,
          search: search.trim() || undefined,
        },
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Failed to fetch export data.");
      return [];
    }
  };

  if (initialLoading) return <Loader />;

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Sub-header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Gate Pass Management
          </h1>
          <p className="text-[11px] text-slate-400">
            Request, approve, and track employee out-passes end to end
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[80px]">
            <span className="text-xl font-bold font-mono text-amber-700">
              {stats.pending}
            </span>
            <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">
              Pending
            </span>
          </div>
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[80px]">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {stats.approved}
            </span>
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
              Approved
            </span>
          </div>
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[80px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {stats.out}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Out
            </span>
          </div>
          <button
            onClick={() => fetchPasses()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex flex-wrap gap-1 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 flex-1 min-w-[130px] justify-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === "depthead" && deptHeadQueue.length > 0 && (
                <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 rounded-full font-bold">
                  {deptHeadQueue.length}
                </span>
              )}
              {key === "hr" && hrQueue.length > 0 && (
                <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 rounded-full font-bold">
                  {hrQueue.length}
                </span>
              )}
              {key === "security" &&
                readyForOut.length + currentlyOut.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] px-1.5 rounded-full font-bold">
                    {readyForOut.length + currentlyOut.length}
                  </span>
                )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {activeTab === "request" && (
          <RequestTab
            form={form}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            submitting={submitting}
            recentRequests={recentRequests}
          />
        )}

        {activeTab === "depthead" && (
          <ApprovalQueue
            title="Department Head Approval"
            subtitle="Requests waiting on department head sign-off."
            queue={deptHeadQueue}
            stage="depthead"
            nameDrafts={nameDrafts}
            setNameDrafts={setNameDrafts}
            actionId={actionId}
            onDecision={handleApproval}
          />
        )}

        {activeTab === "hr" && (
          <ApprovalQueue
            title="HR Approval"
            subtitle="Requests cleared by the department head, waiting on HR."
            queue={hrQueue}
            stage="hr"
            nameDrafts={nameDrafts}
            setNameDrafts={setNameDrafts}
            actionId={actionId}
            onDecision={handleApproval}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            readyForOut={readyForOut}
            currentlyOut={currentlyOut}
            nameDrafts={nameDrafts}
            setNameDrafts={setNameDrafts}
            actionId={actionId}
            onAction={handleSecurity}
          />
        )}

        {activeTab === "dashboard" && (
          <DashboardTab
            rows={dashboardRows}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            search={search}
            setSearch={setSearch}
            fetchExportData={fetchExportData}
          />
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   TAB: Request Pass
════════════════════════════════════════════ */
const RequestTab = ({
  form,
  onChange,
  onSubmit,
  submitting,
  recentRequests,
}) => (
  <>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
        New Gate Pass Request
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[160px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Employee Code
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.empCode}
            onChange={onChange("empCode")}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Employee Name
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.empName}
            onChange={onChange("empName")}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Department
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.deptName}
            onChange={onChange("deptName")}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Contact No.
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.contactNo}
            onChange={onChange("contactNo")}
          />
        </div>
        <div className="min-w-[190px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Place of Visit
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.placeOfVisit}
            onChange={onChange("placeOfVisit")}
          />
        </div>
        <div className="min-w-[190px] flex-1">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Reason
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.reason}
            onChange={onChange("reason")}
          />
        </div>

        <div className="min-w-[150px] flex-1">
          <SelectField
            label="Pass Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={onChange("type")}
          />
        </div>
        <div className="min-w-[150px] flex-1">
          <SelectField
            label="Coming Back?"
            options={COMING_BACK_OPTIONS}
            value={form.comingBack}
            onChange={onChange("comingBack")}
          />
        </div>
        <div className="min-w-[190px] flex-1">
          <DateTimePicker
            label="Out Date & Time"
            name="outDateTime"
            value={form.outDateTime}
            onChange={onChange("outDateTime")}
          />
        </div>
        <div className="min-w-[190px] flex-1">
          <DateTimePicker
            label="Expected In (optional)"
            name="expectedInDateTime"
            value={form.expectedInDateTime}
            onChange={onChange("expectedInDateTime")}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            submitting
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
          }`}
        >
          {submitting && <Spinner cls="w-4 h-4" />}
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>

    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-auto">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Recent Requests
      </p>
      {recentRequests.length === 0 ? (
        <EmptyState
          title="No passes yet"
          subtitle="Submit a request above to get started."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {recentRequests.map((p) => (
            <TicketRow key={p.id} pass={p} />
          ))}
        </div>
      )}
    </div>
  </>
);

const TicketRow = ({ pass }) => (
  <div className="border border-slate-100 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap hover:bg-slate-50/70 transition-colors">
    <div className="min-w-[180px]">
      <p className="text-sm font-semibold text-slate-800">
        {pass.empName}{" "}
        <span className="text-slate-400 font-normal">· {pass.empCode}</span>
      </p>
      <p className="text-xs text-slate-400">
        {pass.deptName} · {pass.type} · {pass.placeOfVisit}
      </p>
    </div>
    <div className="text-xs text-slate-500">{pass.outDateTime}</div>
    <StatusBadge status={pass.status} />
  </div>
);

/* ════════════════════════════════════════════
   TAB: Approval queue (Dept Head / HR)
════════════════════════════════════════════ */
const ApprovalQueue = ({
  title,
  subtitle,
  queue,
  stage,
  nameDrafts,
  setNameDrafts,
  actionId,
  onDecision,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
      {title}
    </p>
    <p className="text-xs text-slate-400 mb-3">{subtitle}</p>

    {queue.length === 0 ? (
      <EmptyState
        title="Queue is empty"
        subtitle="Nothing waiting on you right now."
      />
    ) : (
      <div className="flex flex-col gap-3">
        {queue.map((p) => {
          const isBusy = actionId === p.id;
          return (
            <div
              key={p.id}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {p.empName}{" "}
                    <span className="text-slate-400 font-normal">
                      · {p.empCode}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.deptName} · {p.type} · Out: {p.outDateTime}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                <div>
                  <span className="block text-slate-400 uppercase text-[10px]">
                    Place of Visit
                  </span>
                  {p.placeOfVisit}
                </div>
                <div>
                  <span className="block text-slate-400 uppercase text-[10px]">
                    Reason
                  </span>
                  {p.reason}
                </div>
                <div>
                  <span className="block text-slate-400 uppercase text-[10px]">
                    Contact
                  </span>
                  {p.contactNo}
                </div>
                <div>
                  <span className="block text-slate-400 uppercase text-[10px]">
                    Coming Back?
                  </span>
                  {p.comingBack}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <input
                  placeholder="Your name"
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nameDrafts[p.id] || ""}
                  onChange={(e) =>
                    setNameDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                  }
                />
                <button
                  disabled={isBusy}
                  onClick={() => onDecision(p.id, stage, "Approved")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer disabled:opacity-50"
                >
                  {isBusy ? (
                    <Spinner cls="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Approve
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => onDecision(p.id, stage, "Rejected")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

/* ════════════════════════════════════════════
   TAB: Security Gate
════════════════════════════════════════════ */
const SecurityTab = ({
  readyForOut,
  currentlyOut,
  nameDrafts,
  setNameDrafts,
  actionId,
  onAction,
}) => (
  <>
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
        Ready for Gate Out
      </p>
      <p className="text-xs text-slate-400 mb-3">
        Approved passes waiting to exit.
      </p>
      {readyForOut.length === 0 ? (
        <EmptyState
          title="Nothing to release"
          subtitle="Approved passes will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {readyForOut.map((p) => (
            <SecurityCard
              key={p.id}
              pass={p}
              direction="out"
              icon={LogOut}
              label="Mark Gate Out"
              busy={actionId === p.id}
              value={nameDrafts[p.id] || ""}
              onNameChange={(v) => setNameDrafts((d) => ({ ...d, [p.id]: v }))}
              onAction={() => onAction(p.id, "out")}
            />
          ))}
        </div>
      )}
    </div>

    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
        Currently Out
      </p>
      <p className="text-xs text-slate-400 mb-3">
        Log the return when the employee is back.
      </p>
      {currentlyOut.length === 0 ? (
        <EmptyState
          title="Everyone's in"
          subtitle="No one is currently marked out."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {currentlyOut.map((p) => (
            <SecurityCard
              key={p.id}
              pass={p}
              direction="in"
              icon={LogIn}
              label="Mark Gate In"
              busy={actionId === p.id}
              value={nameDrafts[p.id] || ""}
              onNameChange={(v) => setNameDrafts((d) => ({ ...d, [p.id]: v }))}
              onAction={() => onAction(p.id, "in")}
            />
          ))}
        </div>
      )}
    </div>
  </>
);

const SecurityCard = ({
  pass,
  icon: Icon,
  label,
  busy,
  value,
  onNameChange,
  onAction,
}) => (
  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {pass.empName}{" "}
          <span className="text-slate-400 font-normal">· {pass.empCode}</span>
        </p>
        <p className="text-xs text-slate-400">
          {pass.deptName} · {pass.placeOfVisit}
        </p>
      </div>
      <StatusBadge status={pass.status} />
    </div>
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <input
        placeholder="Supervisor name"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <button
        disabled={busy}
        onClick={onAction}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-all cursor-pointer disabled:opacity-50"
      >
        {busy ? (
          <Spinner cls="w-3.5 h-3.5" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
        {label}
      </button>
    </div>
  </div>
);

/* ════════════════════════════════════════════
   TAB: Dashboard
════════════════════════════════════════════ */
const DashboardTab = ({
  rows,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  fetchExportData,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col min-h-0">
    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
        All Passes
      </p>
      {rows.length > 0 && (
        <ExportButton fetchData={fetchExportData} filename="Gate_Pass_Report" />
      )}
    </div>

    <div className="flex flex-wrap gap-3 mb-3">
      <div className="min-w-[190px]">
        <SelectField
          label="Status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>
      <div className="min-w-[220px] flex-1">
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Search
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name, code, or department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
    </div>

    <div className="flex-1 overflow-auto">
      {rows.length === 0 ? (
        <EmptyState
          title="No matching passes"
          subtitle="Try a different filter or search term."
        />
      ) : (
        <table className="min-w-full text-xs text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              {["Employee", "Dept", "Type", "Out", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  <span className="font-medium text-slate-800">
                    {p.empName}
                  </span>
                  <br />
                  <span className="text-slate-400">{p.empCode}</span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  {p.deptName}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  {p.type}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap font-mono text-[11px]">
                  {p.outDateTime}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

export default Gatepass;
