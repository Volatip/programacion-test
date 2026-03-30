import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

interface SearchableSelectProps<T> {
  options: T[];
  value: string | number | null | undefined; // The value ID or string value
  onChange: (value: string | number) => void; // Returns the value (ID or string)
  getLabel: (item: T) => string;
  getValue: (item: T) => string | number;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  renderOption?: (item: T, isSelected: boolean) => React.ReactNode;
  filterOption?: (item: T, query: string) => boolean;
  notFoundText?: string;
  onBlur?: () => void;
  required?: boolean;
}

export function SearchableSelect<T>({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  error = false,
  className = "",
  renderOption,
  filterOption,
  notFoundText = "No se encontraron resultados",
  onBlur,
  required = false
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onBlur]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredOptions = options.filter((item) => {
    if (filterOption) {
      return filterOption(item, searchQuery);
    }
    const label = getLabel(item);
    return normalizeText(label).includes(normalizeText(searchQuery));
  });

  const selectedItem = options.find((item) => getValue(item) === value);
  const selectedLabel = selectedItem ? getLabel(selectedItem) : "";

  const handleSelect = (item: T) => {
    onChange(getValue(item));
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all flex items-center justify-between min-h-[38px] dark:text-white ${
          disabled
            ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-700"
            : error
            ? "border-red-500 bg-red-50 dark:bg-red-900/30"
            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
        }`}
      >
        <span className={`truncate block ${!selectedItem ? "text-gray-500 dark:text-gray-400" : ""}`}>
          {selectedItem ? selectedLabel : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {required && !selectedItem && !disabled && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, height: 0, position: "absolute" }}
          value={""}
          onChange={() => {}}
          required={required}
        />
      )}

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 z-50 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-50 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700 rounded-t-lg z-10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-md outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:text-white dark:placeholder-gray-400 transition-all"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                {notFoundText}
              </div>
            ) : (
              filteredOptions.map((item, index) => {
                const itemValue = getValue(item);
                const isSelected = itemValue === value;
                return (
                  <button
                    key={`${itemValue}-${index}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors flex items-center justify-between group ${
                      isSelected
                        ? "bg-primary/5 text-primary font-medium dark:bg-primary/20 dark:text-primary-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    {renderOption ? (
                      renderOption(item, isSelected)
                    ) : (
                      <span className="truncate">{getLabel(item)}</span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 opacity-100" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
