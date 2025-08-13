import { useState, useEffect, useRef } from "react";

const SelectField = ({
  label,
  name,
  options = [],
  value,
  onChange,
  className = "",
}) => {
  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const filtered = options.filter((opt) => {
      const label = typeof opt === "string" ? opt : opt.label;
      return label?.toLowerCase().includes(search.toLowerCase());
    });
    setFilteredOptions(filtered);
  }, [search, options]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    const selectedValue = typeof opt === "string" ? opt : opt.value;
    const event = { target: { name, value: selectedValue } };
    onChange(event);
    setSearch(""); // Reset search
    setShowOptions(false);
  };

  const selectedLabel =
    options.find((opt) =>
      typeof opt === "string" ? opt === value : opt.value === value
    )?.label || value;

  return (
    <div className="relative" ref={dropdownRef}>
      {label && <label className="block font-semibold mb-1">{label}</label>}

      <input
        type="text"
        value={search || selectedLabel || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowOptions(true);
        }}
        onFocus={() => setShowOptions(true)}
        className={`w-full p-2 border rounded-md bg-white ${className}`}
        placeholder={`Search ${label?.toLowerCase()}`}
      />

      {showOptions && (
        <ul className="absolute z-50 w-full bg-white border mt-1 max-h-60 overflow-auto rounded-md shadow">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const optionLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <li
                  key={idx}
                  className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSelect(opt)}
                >
                  {optionLabel}
                </li>
              );
            })
          ) : (
            <li className="p-2 text-gray-500">No options found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SelectField;