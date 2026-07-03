const InputField = ({
  label,
  type,
  placeholder,
  value,
  onChange,
  name,
  required,
  className,
  widthClass,
  disabled,
  icon: Icon,
}) => {
  return (
    <div className={`${widthClass || "w-full"} ${className || ""}`}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        )}
        <input
          type={type || "text"}
          className={`w-full ${Icon ? "pl-8" : "px-3"} pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          name={name}
          required={required}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default InputField;
