// Convert "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS" for input
const toInputValue = (str) => str?.replace(" ", "T");

// Convert "YYYY-MM-DDTHH:MM:SS" → "YYYY-MM-DD HH:MM:SS"
const fromInputValue = (str) => str?.replace("T", " ");

const DateTimePicker = ({ label, value, onChange, name }) => {
  return (
    <div>
      {label && <label className="block font-semibold mb-1">{label}</label>}
      <input
        type="datetime-local"
        step="1"
        name={name}
        className="w-full p-1 border rounded-md"
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