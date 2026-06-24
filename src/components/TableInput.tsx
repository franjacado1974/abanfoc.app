import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface TableInputProps {
  label: string;
  opciones: string[]; // Cabeceras de las columnas
  filasInicio?: number; // Filas por defecto
  value: string; // Valor JSON serializado del 2D array string[][]
  onChange: (newValue: string) => void;
  disabled?: boolean;
}

export default function TableInput({
  label,
  opciones = [],
  filasInicio = 1,
  value,
  onChange,
  disabled = false,
}: TableInputProps) {
  const numCols = opciones.length > 0 ? opciones.length : 1;
  const numRows = filasInicio || 1;

  // Cargar matriz de datos
  const [data, setData] = useState<string[][]>(() => {
    try {
      if (value && typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((row: any) => {
            if (!Array.isArray(row)) return Array(numCols).fill('');
            if (row.length < numCols) return [...row, ...Array(numCols - row.length).fill('')];
            if (row.length > numCols) return row.slice(0, numCols);
            return row;
          });
        }
      }
    } catch (e) {
      console.error('Error parsing table value', e);
    }
    return Array(numRows).fill(null).map(() => Array(numCols).fill(''));
  });

  // Mantener actualizado si cambia value externamente
  useEffect(() => {
    try {
      if (value && typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isDifferent = JSON.stringify(parsed) !== JSON.stringify(data);
          if (isDifferent) {
            setData(parsed.map((row: any) => {
              if (!Array.isArray(row)) return Array(numCols).fill('');
              if (row.length < numCols) return [...row, ...Array(numCols - row.length).fill('')];
              if (row.length > numCols) return row.slice(0, numCols);
              return row;
            }));
          }
        }
      }
    } catch (e) {
      // Ignorar errores de parseo intermedios
    }
  }, [value, numCols]);

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    const newData = data.map((row, ri) => 
      row.map((cell, ci) => (ri === rIdx && ci === cIdx ? val : cell))
    );
    setData(newData);
    onChange(JSON.stringify(newData));
  };

  const handleAddRow = () => {
    const newData = [...data, Array(numCols).fill('')];
    setData(newData);
    onChange(JSON.stringify(newData));
  };

  const handleRemoveRow = (rIdx: number) => {
    if (data.length <= 1) {
      // No dejar la tabla completamente vacía
      const newData = [Array(numCols).fill('')];
      setData(newData);
      onChange(JSON.stringify(newData));
      return;
    }
    const newData = data.filter((_, ri) => ri !== rIdx);
    setData(newData);
    onChange(JSON.stringify(newData));
  };

  return (
    <div className="col-span-full border border-slate-200 rounded-xl overflow-hidden my-3 bg-white shadow-sm">
      {/* Título de la tabla */}
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-slate-400 font-semibold">{data.length} filas</span>
      </div>

      {/* Contenedor responsivo para tablas anchas */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-black text-white border-b border-slate-300">
              {opciones.map((col, idx) => (
                <th key={idx} className="px-3 py-2 font-bold uppercase text-[9px] tracking-wider border-r border-zinc-800 last:border-r-0">
                  {col}
                </th>
              ))}
              {!disabled && (
                <th className="px-3 py-2 text-center w-12 font-bold uppercase text-[9px] tracking-wider">
                  Acción
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-1 border-r border-slate-100 last:border-r-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 bg-transparent border-0 rounded text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500/30 font-medium"
                      placeholder="..."
                    />
                  </td>
                ))}
                {!disabled && (
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(rIdx)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Botón Añadir fila inferior */}
      {!disabled && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir fila
          </button>
        </div>
      )}
    </div>
  );
}
