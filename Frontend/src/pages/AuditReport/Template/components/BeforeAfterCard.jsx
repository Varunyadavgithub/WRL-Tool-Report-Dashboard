// Small red("Before")/green("After") two-column card for a single field
// change. Shared by TemplateHistoryPanel (one card per FieldChanges entry)
// and TemplateCompare (one card per modified checkpoint field).
const BeforeAfterCard = ({ from, to }) => (
  <div className="grid grid-cols-2 gap-2 p-2 bg-white max-w-xl">
    <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-100">
      <p className="text-red-400 font-bold uppercase mb-1 text-[10px] tracking-wide">Before</p>
      <p className="text-red-700 font-semibold break-all text-xs">{from ?? "—"}</p>
    </div>
    <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-100">
      <p className="text-green-400 font-bold uppercase mb-1 text-[10px] tracking-wide">After</p>
      <p className="text-green-700 font-semibold break-all text-xs">{to ?? "—"}</p>
    </div>
  </div>
);

export default BeforeAfterCard;
