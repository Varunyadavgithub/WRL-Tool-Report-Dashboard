import { useEffect, useState } from "react";
import { X, Plus, Trash2, Save, Gauge } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets";
import { inputCls } from "./shared";

// Config-time spec sheet for one BIS model, shown on the Test Lab Dashboard
// in place of live sensor readings (this app has no chamber hardware
// integration to produce those).
const BISModelSetupModal = ({ row, onClose }) => {
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSpecs, setSavingSpecs] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${baseURL}quality/bis-model-specs/${row.materialCode}`);
        setSpecs((res.data.specs || []).map((s) => ({ specKey: s.specKey, specValue: s.specValue || "" })));
      } catch {
        toast.error("Failed to load model specs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [row.materialCode]);

  const addSpec = () => setSpecs((p) => [...p, { specKey: "", specValue: "" }]);
  const updateSpec = (idx, field, value) => setSpecs((p) => p.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  const removeSpec = (idx) => setSpecs((p) => p.filter((_, i) => i !== idx));

  const saveSpecs = async () => {
    setSavingSpecs(true);
    try {
      await axios.put(`${baseURL}quality/bis-model-specs/${row.materialCode}`, { specs: specs.filter((s) => s.specKey.trim()) });
      toast.success("Specs saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save specs");
    } finally {
      setSavingSpecs(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-black">{row.modelName}</h3>
            <p className="text-[11px] text-blue-100 mt-0.5">Spec sheet for the Test Lab Dashboard</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">Loading…</p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-500" /> Model Specs
                </h4>
                <button onClick={addSpec} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
                  <Plus className="w-3 h-3" /> Add Spec
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">Shown on the Test Lab Dashboard instead of live readings — this app has no chamber sensor integration.</p>
              {specs.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">No specs added yet.</p>
              ) : (
                <div className="space-y-2">
                  {specs.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" placeholder="Spec name (e.g. Rated Voltage)" value={s.specKey}
                        onChange={(e) => updateSpec(idx, "specKey", e.target.value)} className={`${inputCls} flex-1`} />
                      <input type="text" placeholder="Value (e.g. 230V / 50Hz)" value={s.specValue}
                        onChange={(e) => updateSpec(idx, "specValue", e.target.value)} className={`${inputCls} flex-1`} />
                      <button onClick={() => removeSpec(idx)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-2">
                <button onClick={saveSpecs} disabled={savingSpecs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
                  <Save className="w-3 h-3" /> {savingSpecs ? "Saving…" : "Save Specs"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BISModelSetupModal;
