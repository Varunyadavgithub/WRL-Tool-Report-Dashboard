import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { CheckCircle2, XCircle, Eye, RefreshCw, Inbox, ArrowLeft, ThumbsUp } from "lucide-react";
import { baseURL } from "../../../assets/assets";
import PopupModal from "../../../components/ui/PopupModal";
import { reportTypeLabel } from "./shared";
import BISReportDetailView from "./BISReportDetailView";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Draft → PendingReview (Reviewer's queue) → PendingApproval (Authorizer's
// queue) → Final. Whether the logged-in user sees either section at all
// depends on which role(s) they hold in BISApprovalFlow (server-checked).
const BISApprovalQueue = () => {
  const { user } = useSelector((store) => store.auth);
  const [reports, setReports] = useState([]);
  const [isReviewer, setIsReviewer] = useState(false);
  const [isAuthorizer, setIsAuthorizer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [actingId, setActingId] = useState(null);

  const [rejectTarget, setRejectTarget] = useState(null); // { row, endpoint }
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-approval-queue`);
      setReports(res?.data?.reports || []);
      setIsReviewer(Boolean(res?.data?.isReviewer));
      setIsAuthorizer(Boolean(res?.data?.isAuthorizer));
    } catch {
      toast.error("Failed to fetch approval queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const endpointFor = (row) => (row.Status === "PendingReview" ? "review" : "authorize");

  const handleApprove = async (row) => {
    try {
      setActingId(row.Id);
      await axios.post(`${baseURL}quality/bis-test-reports/${row.Id}/${endpointFor(row)}`, { decision: "approve" });
      toast.success(row.Status === "PendingReview" ? "Report approved and sent to the authorizer" : "Report authorized and marked Final");
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve report");
    } finally {
      setActingId(null);
    }
  };

  const openReject = (row) => { setRejectTarget(row); setRejectReason(""); };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return toast.error("A rejection reason is required");
    try {
      setRejecting(true);
      await axios.post(`${baseURL}quality/bis-test-reports/${rejectTarget.Id}/${endpointFor(rejectTarget)}`, { decision: "reject", remarks: rejectReason.trim() });
      toast.success("Report rejected and returned to the preparer");
      setRejectTarget(null);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject report");
    } finally {
      setRejecting(false);
    }
  };

  const openView = async (row) => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-test-reports/${row.Id}`);
      setDetail(res.data);
    } catch {
      toast.error("Failed to load report");
    }
  };

  if (detail) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setDetail(null)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-all w-fit print:hidden">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Approval Queue
        </button>
        <BISReportDetailView data={detail} onClose={() => setDetail(null)} />
      </div>
    );
  }

  const Section = ({ title, status, emptyText }) => {
    const rows = reports.filter((r) => r.Status === status);
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
          <span className="text-[11px] text-slate-400">{rows.length} pending</span>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <Inbox className="w-8 h-8 opacity-20" strokeWidth={1.2} />
            <p className="text-xs">{emptyText}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {["Type", "Model", "Test Report No.", "Test Date", "Prepared By", "Reviewed By", "Result", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.Id} className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40">
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-600 font-medium">{reportTypeLabel(row.ReportType)}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 font-semibold text-slate-800">{row.ModelName}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">{row.TestReportNo || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500 font-mono">{fmtDate(row.TestDateTo)}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">{row.PreparedBy || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100 text-slate-500">{row.ReviewedBy || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      {row.Result && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.Result === "PASS" ? "bg-emerald-100 text-emerald-700" : row.Result === "FAIL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{row.Result}</span>}
                    </td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openView(row)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="View"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleApprove(row)} disabled={actingId === row.Id} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openReject(row)} disabled={actingId === row.Id} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">Signed in as <span className="font-semibold text-slate-600">{user?.name || user?.usercode}</span> ({user?.usercode})</p>
        <button onClick={fetchQueue} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {!isReviewer && !isAuthorizer ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <ThumbsUp className="w-12 h-12 opacity-20" strokeWidth={1.2} />
          <p className="text-sm text-slate-500">You don't hold a role in the BIS approval flow.</p>
          <p className="text-xs text-slate-400">Reviewer/Authorizer assignments are set in BIS Config → Approval Flow.</p>
        </div>
      ) : (
        <>
          {isReviewer && <Section title="Pending My Review" status="PendingReview" emptyText="Nothing waiting on your review." />}
          {isAuthorizer && <Section title="Pending My Authorization" status="PendingApproval" emptyText="Nothing waiting on your authorization." />}
        </>
      )}

      {rejectTarget && (
        <PopupModal
          title="Reject Report"
          description={`Reject the ${reportTypeLabel(rejectTarget.ReportType)} report for "${rejectTarget.ModelName}" and return it to the preparer?`}
          confirmText={rejecting ? "Rejecting…" : "Confirm Reject"}
          cancelText="Cancel"
          modalId="bis-reject-modal"
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
          icon={<XCircle className="w-10 h-10 text-red-500 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        >
          <div className="mt-4 text-left">
            <label className="block text-xs font-bold text-slate-700 mb-2">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe what needs to be corrected…"
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 resize-none"
            />
          </div>
        </PopupModal>
      )}
    </div>
  );
};

export default BISApprovalQueue;
