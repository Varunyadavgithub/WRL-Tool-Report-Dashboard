import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { CheckCircle2, CircleAlert, Clock3, RefreshCw, Database } from "lucide-react";
import { PART_PROCESS_API } from "../../utils/factoryOsClient";

const stamp = (value) => value ? new Date(value).toLocaleString() : "—";

export default function FactoryOsSyncLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${PART_PROCESS_API}/sync-log`, { withCredentials: true });
      setLogs(response.data?.data || []);
    } catch (error) { toast.error(error.response?.data?.message || "Could not load sync log"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 60_000); return () => clearInterval(timer); }, [load]);
  const successCount = logs.filter((log) => log.Status === "Success").length;
  const totalRecords = logs.filter((log) => log.Status === "Success").reduce((sum, log) => sum + (log.RecordsSynced || 0), 0);
  const latest = logs[0];

  return <div className="min-h-full bg-slate-50 p-4 sm:p-6 space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold text-slate-800">FactoryOS Sync Log</h1><p className="text-sm text-slate-500">Automatic imports into PartProcessEvents. Refreshes every minute.</p></div><button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-60"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}/>Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4"><Clock3 className="h-5 w-5 text-blue-600"/><p className="mt-2 text-sm text-slate-500">Latest sync</p><p className="mt-1 font-semibold text-slate-800">{stamp(latest?.CompletedAt)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600"/><p className="mt-2 text-sm text-slate-500">Successful imports</p><p className="mt-1 text-2xl font-bold text-slate-800">{successCount}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><Database className="h-5 w-5 text-violet-600"/><p className="mt-2 text-sm text-slate-500">Events imported</p><p className="mt-1 text-2xl font-bold text-slate-800">{totalRecords}</p></div></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-800">Import history</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Status", "Production date", "Started", "Completed", "Events", "Details"].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={log.Id}><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${log.Status === "Success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{log.Status === "Success" ? <CheckCircle2 className="h-3.5 w-3.5"/> : <CircleAlert className="h-3.5 w-3.5"/>}{log.Status}</span></td><td className="px-4 py-3">{String(log.SyncDate || "").slice(0, 10)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{stamp(log.StartedAt)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{stamp(log.CompletedAt)}</td><td className="px-4 py-3 font-semibold">{log.RecordsSynced ?? "—"}</td><td className="max-w-lg px-4 py-3 text-xs text-slate-500">{log.Message || "—"}</td></tr>)}{!loading && !logs.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">No FactoryOS syncs have been logged yet. The first entry appears after the next scheduled import.</td></tr>}</tbody></table></div></div>
  </div>;
}
