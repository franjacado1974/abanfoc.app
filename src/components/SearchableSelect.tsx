import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string, option?: SearchableSelectOption) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  emptyMessage = 'No se encontraron resultados',
  className = ''
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Opción actualmente seleccionada
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  // Función de normalización para búsqueda insensible a mayúsculas y acentos
  const normalize = (str: string) =>
    str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';

  // Filtrado y ordenación alfabética automática
  const filteredOptions = useMemo(() => {
    const sorted = [...options].sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
    );
    if (!searchTerm.trim()) return sorted;
    const q = normalize(searchTerm);
    return sorted.filter(opt =>
      normalize(opt.label).includes(q) || (opt.sublabel && normalize(opt.sublabel).includes(q))
    );
  }, [options, searchTerm]);

  // Cerrar al hacer clic o toque fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelect = (opt: SearchableSelectOption) => {
    onChange(opt.value, opt);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`w-full flex items-center px-3.5 py-2.5 rounded-xl border transition-all cursor-text bg-white ${
          disabled
            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
            : isOpen
            ? 'border-red-500 ring-2 ring-red-500/20 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearchTerm('');
            }
          }}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
        />
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-red-500' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  className={`px-3.5 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors select-none ${
                    isSelected
                      ? 'bg-red-50 text-red-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-slate-400 font-normal truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 text-center italic">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
