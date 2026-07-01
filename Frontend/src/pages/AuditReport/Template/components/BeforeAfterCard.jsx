// Small red("Before")/green("After") two-column card for a single field
// change. Shared by TemplateHistoryPanel (one card per FieldChanges entry)
// and TemplateCompare (one card per modified checkpoint field).
const BeforeAfterCard = ({ from, to }) => (
  <div className="grid grid-cols-2 gap-1 p-1.5 bg-white">
    <div className="bg-red-50 rounded px-1.5 py-1 border border-red-100">
      <p className="text-red-400 font-bold uppercase mb-0.5 text-[8px]">Before</p>
      <p className="text-red-700 font-semibold break-all text-[9px]">{from ?? "—"}</p>
    </div>
    <div className="bg-green-50 rounded px-1.5 py-1 border border-green-100">
      <p className="text-green-400 font-bold uppercase mb-0.5 text-[8px]">After</p>
      <p className="text-green-700 font-semibold break-all text-[9px]">{to ?? "—"}</p>
    </div>
  </div>
);

export default BeforeAfterCard;
