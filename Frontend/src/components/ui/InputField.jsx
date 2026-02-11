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
}) => {
  return (
    <div className={`${className || ""}`}>
      {label && <label className="block font-semibold mb-1">{label}</label>}
      <input
        type={type || "text"}
        className={`p-1 border rounded-md focus:outline-none ${
          widthClass || "w-full"
        }`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        name={name}
        required={required}
      />
    </div>
  );
};

export default InputField;