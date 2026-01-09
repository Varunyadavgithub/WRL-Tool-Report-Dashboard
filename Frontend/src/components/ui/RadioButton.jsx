const RadioButton = ({ name, value, checked, label, onChange }) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="
          accent-sky-600
          w-4 h-4
          cursor-pointer
        "
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
};

export default RadioButton;
