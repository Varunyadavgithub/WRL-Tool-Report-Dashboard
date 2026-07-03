import { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

const SelectField = ({
  label,
  name,
  options = [],
  value,
  onChange,
  className = "",
  placeholder,
}) => {
  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const filtered = options.filter((opt) => {
      const lbl = typeof opt === "string" ? opt : opt.label;
      return lbl?.toLowerCase().includes(search.toLowerCase());
    });
    setFilteredOptions(filtered);
  }, [search, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowOptions(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    const selectedValue = typeof opt === "string" ? opt : opt.value;
    onChange({ target: { name, value: selectedValue } });
    setSearch("");
    setShowOptions(false);
  };

  const selectedLabel =
    options.find((opt) =>
      typeof opt === "string" ? opt === value : opt.value === value
    )?.label ||
    value ||
    "";

  const displayValue = showOptions ? search : selectedLabel;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowOptions(true);
          }}
          onFocus={() => {
            setShowOptions(true);
            setSearch("");
          }}
          placeholder={placeholder || `Select ${label?.toLowerCase() || "option"}`}
          className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showOptions ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {showOptions && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 mt-1 max-h-56 overflow-auto rounded-lg shadow-lg py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const optValue = typeof opt === "string" ? opt : opt.value;
              const isSelected = optValue === value;
              return (
                <li
                  key={idx}
                  onClick={() => handleSelect(opt)}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {optLabel}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-xs text-slate-400">No options found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SelectField;
