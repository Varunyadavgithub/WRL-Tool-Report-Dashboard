import { useState, useMemo } from "react";
import { Cpu, Wifi, WifiOff } from "lucide-react";
import toast from "react-hot-toast";
import { inputCls, selectCls, Field, StatusBadge, Modal, TableActions, PageHeader, EmptyState, TH, TD } from "./_shared";

const CONTROLLERS = ["FANUC","Siemens","Mitsubishi","Allen Bradley","Beckhoff","Delta","Omron","Custom PLC","Other"];
const DEPARTMENTS  = ["Pressing","Welding","Machining","Assembly","Painting","Inspection","Packing","Maintenance"];
const LINES        = ["Line 1","Line 2","Line 3","Line 4","Line 5","Assembly Line","Packing Line"];

const INIT = { machineName:"", machineCode:"", ipAddress:"", controllerType:"FANUC", apiEndpoint:"", department:"", lineName:"", plantLocation:"Plant A", status:true, connected:false };

const ConnBadge = ({ ok }) =>
  ok ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Wifi className="w-2.5 h-2.5" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
      <WifiOff className="w-2.5 h-2.5" /> Offline
    </span>
  );

const MachineConfig = () => {
  const [data, setData]   = useState([]);
  const [modal, setModal] = useState({ open:false, mode:"add", row:null });
  const [form, setForm]   = useState(INIT);
  const [search, setSearch] = useState("");
  const [testing, setTesting] = useState(null);

  const filtered = useMemo(() => data.filter((r) =>
    r.machineName.toLowerCase().includes(search.toLowerCase()) ||
    r.machineCode.toLowerCase().includes(search.toLowerCase()) ||
    r.ipAddress.includes(search)
  ), [data, search]);

  const openAdd  = () => { setForm(INIT); setModal({ open:true, mode:"add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ open:true, mode:"edit", row }); };
  const closeModal = () => setModal({ open:false });

  const handleSave = () => {
    if (!form.machineName || !form.machineCode || !form.ipAddress) { toast.error("Machine Name, Code and IP Address are required."); return; }
    if (modal.mode === "add") {
      if (data.find((r) => r.machineCode === form.machineCode)) { toast.error("Machine Code already exists."); return; }
      setData([...data, { ...form, id: Date.now() }]);
      toast.success("Machine added.");
    } else {
      setData(data.map((r) => r.id === modal.row.id ? { ...form, id: r.id } : r));
      toast.success("Machine updated.");
    }
    closeModal();
  };

  const handleDelete = (id) => { setData(data.filter((r) => r.id !== id)); toast.success("Deleted."); };
  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const testConnection = (id) => {
    setTesting(id);
    setTimeout(() => {
      setData((d) => d.map((r) => r.id === id ? { ...r, connected: Math.random() > 0.3 } : r));
      setTesting(null);
      toast.success("Connectivity test complete.");
    }, 1500);
  };

  const online  = data.filter((r) => r.connected).length;
  const offline = data.filter((r) => !r.connected).length;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <PageHeader title="Machine Configuration" subtitle="Manage machine masters, controller types, IP addresses and API endpoints" icon={Cpu} onAdd={openAdd} addLabel="Add Machine" search={search} onSearch={setSearch} />

      <div className="flex-1 overflow-auto p-4">
        {/* Summary chips */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full"><Wifi className="w-3 h-3" /> {online} Online</span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full"><WifiOff className="w-3 h-3" /> {offline} Offline</span>
          <button
            onClick={() => { setTesting("all"); data.forEach((r) => { setTimeout(() => { setData((d) => d.map((x) => x.id === r.id ? { ...x, connected: Math.random() > 0.3 } : x)); setTesting(null); }, 2000); }); toast.success("Testing all connections…"); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-cyan-300 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 transition-colors"
          >
            <Wifi className="w-3 h-3" /> Test All
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <TH>#</TH><TH>Machine Name</TH><TH>Code</TH><TH>IP Address</TH>
                  <TH>Controller</TH><TH>Department</TH><TH>Line</TH><TH>Plant</TH>
                  <TH center>Connection</TH><TH center>Status</TH><TH center>Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    <TD cls="text-slate-400">{idx + 1}</TD>
                    <TD cls="font-bold text-slate-800 whitespace-nowrap">{r.machineName}</TD>
                    <TD><span className="font-mono font-bold text-cyan-600 text-xs">{r.machineCode}</span></TD>
                    <TD mono cls="text-slate-600">{r.ipAddress}</TD>
                    <TD><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{r.controllerType}</span></TD>
                    <TD cls="text-slate-500">{r.department}</TD>
                    <TD cls="text-slate-500">{r.lineName}</TD>
                    <TD cls="text-slate-500">{r.plantLocation}</TD>
                    <TD center>
                      <div className="flex items-center justify-center gap-1.5">
                        <ConnBadge ok={r.connected} />
                        <button
                          onClick={() => testConnection(r.id)}
                          disabled={testing === r.id}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                        >
                          {testing === r.id ? "…" : "Test"}
                        </button>
                      </div>
                    </TD>
                    <TD center><StatusBadge active={r.status} /></TD>
                    <TD center><TableActions onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)} /></TD>
                  </tr>
                )) : <EmptyState colSpan={11} message="No machines configured." />}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal.open && (
        <Modal title={modal.mode === "add" ? "Add Machine" : "Edit Machine"} onClose={closeModal} onSave={handleSave} wide>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Machine Name" required><input value={form.machineName} onChange={sf("machineName")} placeholder="e.g. Bending Machine 1" className={inputCls} /></Field>
            <Field label="Machine Code" required><input value={form.machineCode} onChange={sf("machineCode")} placeholder="e.g. BM-01" className={inputCls} /></Field>
            <Field label="IP Address" required><input value={form.ipAddress} onChange={sf("ipAddress")} placeholder="e.g. 192.168.1.10" className={inputCls} /></Field>
            <Field label="Controller Type">
              <select value={form.controllerType} onChange={sf("controllerType")} className={selectCls}>
                {CONTROLLERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="API Endpoint">
              <input value={form.apiEndpoint} onChange={sf("apiEndpoint")} placeholder="e.g. /api/machine/BM01" className={inputCls} />
            </Field>
            <Field label="Department">
              <select value={form.department} onChange={sf("department")} className={selectCls}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Line Name">
              <select value={form.lineName} onChange={sf("lineName")} className={selectCls}>
                <option value="">Select Line</option>
                {LINES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Plant Location">
              <input value={form.plantLocation} onChange={sf("plantLocation")} placeholder="e.g. Plant A" className={inputCls} />
            </Field>
            <div className="col-span-2 flex gap-6 p-3 rounded-lg bg-slate-50 border border-slate-200">
              {[["status","Machine Active"],["connected","Mark as Connected"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form[k]} onChange={sf(k)} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-slate-700 font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MachineConfig;
