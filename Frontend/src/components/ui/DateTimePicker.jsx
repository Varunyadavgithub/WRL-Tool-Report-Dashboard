const toInputValue = (str) => str?.replace(" ", "T");
const fromInputValue = (str) => str?.replace("T", " ");

const DateTimePicker = ({ label, value, onChange, name, className = "" }) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      <input
        type="datetime-local"
        step="1"
        name={name}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        value={toInputValue(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const formatted = fromInputValue(raw);
          onChange({ target: { name, value: formatted } });
        }}
      />
    </div>
  );
};

export default DateTimePicker;
