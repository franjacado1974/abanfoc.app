import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';

interface TableInputProps {
  label: string;
  opciones: string[]; // Cabeceras de las columnas (horizontal)
  filasNombres?: string[]; // Cabeceras de las filas (vertical, opcional)
  filasInicio?: number; // Filas por defecto
  value: string; // Valor JSON serializado del 2D array string[][]
  onChange: (newValue: string) => void;
  disabled?: boolean;
  equiposInstalados?: any[];
  currentEquipo?: any;
}

export default function TableInput({
  label,
  opciones = [],
  filasNombres = [],
  filasInicio = 1,
  value,
  onChange,
  disabled = false,
  equiposInstalados = [],
  currentEquipo = null,
}: TableInputProps) {
  const [showChart, setShowChart] = useState(false);

  // Buscar nominales en Abastecimiento
  const sistemasDelCentroGlobal = (window as any).sistemasDelCentroGlobal || [];
  const eqAbast = Array.isArray(equiposInstalados) 
    ? equiposInstalados.find(e => {
        const sist = sistemasDelCentroGlobal.find((s: any) => s.id === e.sistemaId);
        const name = (sist?.nombre || '').toUpperCase();
        return name.includes('ABAST') || name.includes('SALA DE BOMBAS');
      })
    : null;

  let nominalCaudal = 0;
  let nominalPresion = 0;

  if (eqAbast) {
    const checklistItemsPorSistemaGlobal = (window as any).checklistItemsPorSistemaGlobal;
    let caudalNominalKey = '';
    let presionNominalKey = '';

    if (checklistItemsPorSistemaGlobal) {
      const abastSistId = Object.keys(checklistItemsPorSistemaGlobal).find(sId => {
        const sist = sistemasDelCentroGlobal.find((s: any) => s.id === sId);
        const sName = (sist?.nombre || '').toUpperCase();
        return sName.includes('ABAST') || sName.includes('SALA DE BOMBAS');
      });

      if (abastSistId) {
        const items = checklistItemsPorSistemaGlobal[abastSistId];
        const caudalItem = items.find((i: any) => {
          const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return lbl.includes('caudal') && lbl.includes('nominal');
        });
        if (caudalItem) caudalNominalKey = caudalItem.key;

        const presionItem = items.find((i: any) => {
          const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return lbl.includes('presion') && lbl.includes('nominal');
        });
        if (presionItem) presionNominalKey = presionItem.key;
      }
    }

    if (caudalNominalKey && eqAbast[caudalNominalKey]) {
      nominalCaudal = parseFloat(String(eqAbast[caudalNominalKey]).replace(',', '.'));
    }
    if (presionNominalKey && eqAbast[presionNominalKey]) {
      nominalPresion = parseFloat(String(eqAbast[presionNominalKey]).replace(',', '.'));
    }

    // Fallback: buscar en propiedades de texto
    if (!nominalCaudal || isNaN(nominalCaudal)) {
      for (const k of Object.keys(eqAbast)) {
        const kLower = k.toLowerCase();
        if (kLower.includes('caudal') && !kLower.includes('jockey') && !kLower.includes('electric')) {
          const val = parseFloat(String(eqAbast[k]).replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            nominalCaudal = val;
            break;
          }
        }
      }
    }
    if (!nominalPresion || isNaN(nominalPresion)) {
      for (const k of Object.keys(eqAbast)) {
        const kLower = k.toLowerCase();
        if (kLower.includes('presion') && !kLower.includes('jockey') && !kLower.includes('electric')) {
          const val = parseFloat(String(eqAbast[k]).replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            nominalPresion = val;
            break;
          }
        }
      }
    }
  }

  const isGrafico = opciones.some(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.includes('caudal') || norm.includes('flow') || norm.includes('m3') || norm.trim() === 'q' || norm.includes('(q)');
  }) && opciones.some(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.includes('presion') || norm.includes('pressure') || norm.includes('bar') || norm.trim() === 'p' || norm.trim() === 'h' || norm.includes('(p)') || norm.includes('(h)');
  });

  const effectiveOpciones = isGrafico ? ['Caudal (m³/h)', 'L.P.M.', 'Presión (bar)', 'R.P.M.'] : opciones;
  const effectiveFilasNombres = isGrafico ? ['0%', '50%', '100%', '140%'] : filasNombres;
  const hasVerticalHeaders = isGrafico || (Array.isArray(effectiveFilasNombres) && effectiveFilasNombres.length > 0);
  const numCols = effectiveOpciones.length > 0 ? effectiveOpciones.length : 1;
  const numRows = hasVerticalHeaders ? effectiveFilasNombres.length : (filasInicio || 1);

  // Resolver caudal/presión nominal del equipo actual (para Bomba Eléctrica o Jockey)
  const checklistItemsPorSistemaGlobal = (window as any).checklistItemsPorSistemaGlobal;
  const currentSistId = currentEquipo?.sistemaId;
  const currentSistItems = (checklistItemsPorSistemaGlobal && currentSistId) ? checklistItemsPorSistemaGlobal[currentSistId] : [];

  let currentCaudalNominalKey = '';
  let currentPresionNominalKey = '';
  
  if (currentSistItems && currentSistItems.length > 0) {
    const caudalItem = currentSistItems.find((i: any) => {
      const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lbl.includes('caudal') && lbl.includes('nominal');
    });
    if (caudalItem) currentCaudalNominalKey = caudalItem.key;

    const presionItem = currentSistItems.find((i: any) => {
      const lbl = (i.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lbl.includes('presion') && lbl.includes('nominal');
    });
    if (presionItem) currentPresionNominalKey = presionItem.key;
  }

  const currentNominalCaudal = (currentCaudalNominalKey && currentEquipo && currentEquipo[currentCaudalNominalKey])
    ? parseFloat(String(currentEquipo[currentCaudalNominalKey]).replace(',', '.'))
    : 0;

  const currentNominalPresion = (currentPresionNominalKey && currentEquipo && currentEquipo[currentPresionNominalKey])
    ? parseFloat(String(currentEquipo[currentPresionNominalKey]).replace(',', '.'))
    : 0;

  // Índices para conversión L.P.M. <-> Caudal (m³/h) y Presión
  const lpmColIdx = effectiveOpciones.findIndex(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
    return norm.includes('lpm') || norm.includes('litro');
  });
  const caudalColIdx = effectiveOpciones.findIndex(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.includes('caudal') || norm.includes('flow') || norm.includes('m3') || norm.trim() === 'q' || norm.includes('(q)');
  });
  const presionColIdx = effectiveOpciones.findIndex(h => {
    const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.includes('presion') || norm.includes('pressure') || norm.includes('bar') || norm.trim() === 'p' || norm.trim() === 'h' || norm.includes('(p)') || norm.includes('(h)');
  });
  
  const rowLpmIdx = hasVerticalHeaders ? lpmColIdx + 1 : lpmColIdx;
  const rowCaudalIdx = hasVerticalHeaders ? caudalColIdx + 1 : caudalColIdx;
  const rowPresionIdx = hasVerticalHeaders ? presionColIdx + 1 : presionColIdx;

  // Cargar matriz de datos
  const [data, setData] = useState<string[][]>(() => {
    try {
      if (value && typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let rowsToMap = parsed;
          if (hasVerticalHeaders && rowsToMap.length !== numRows) {
            rowsToMap = [...rowsToMap];
            const totalCols = numCols + 1;
            while (rowsToMap.length < numRows) {
              rowsToMap.push(Array(totalCols).fill(''));
            }
            rowsToMap = rowsToMap.slice(0, numRows);
          }
          return rowsToMap.map((row: any, rIdx: number) => {
            const expectedLabel = hasVerticalHeaders ? (effectiveFilasNombres[rIdx] || '') : '';
            const rowData = Array.isArray(row) ? row : [];
            const newRow = [...rowData];
            if (hasVerticalHeaders) {
              newRow[0] = expectedLabel; // Forzar etiqueta en primera columna
            }
            const totalCols = hasVerticalHeaders ? numCols + 1 : numCols;
            while (newRow.length < totalCols) newRow.push('');

            // Autocompletar Caudal y LPM en base a caudal nominal y presión nominal del equipo
            if (isGrafico) {
              if (rIdx === 0) {
                newRow[rowCaudalIdx] = '0';
                newRow[rowLpmIdx] = '0';
              } else if (rIdx === 1) {
                newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 2) * 1000) / 1000).replace('.', ',') : '';
                newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal / 2) / 0.06) * 10) / 10).replace('.', ',') : '';
              } else if (rIdx === 2) {
                newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round(currentNominalCaudal * 1000) / 1000).replace('.', ',') : '';
                newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 0.06) * 10) / 10).replace('.', ',') : '';
                newRow[rowPresionIdx] = currentNominalPresion ? String(Math.round(currentNominalPresion * 1000) / 1000).replace('.', ',') : '';
              } else if (rIdx === 3) {
                newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal * 1.4) * 1000) / 1000).replace('.', ',') : '';
                newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal * 1.4) / 0.06) * 10) / 10).replace('.', ',') : '';
              }
            }

            return newRow.slice(0, totalCols);
          });
        }
      }
    } catch (e) {
      console.error('Error parsing table value', e);
    }

    if (hasVerticalHeaders) {
      return effectiveFilasNombres.map((name, rIdx) => {
        const row = [name, ...Array(numCols).fill('')];
        if (isGrafico) {
          if (rIdx === 0) {
            row[rowCaudalIdx] = '0';
            row[rowLpmIdx] = '0';
          } else if (rIdx === 1) {
            row[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 2) * 1000) / 1000).replace('.', ',') : '';
            row[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal / 2) / 0.06) * 10) / 10).replace('.', ',') : '';
          } else if (rIdx === 2) {
            row[rowCaudalIdx] = currentNominalCaudal ? String(Math.round(currentNominalCaudal * 1000) / 1000).replace('.', ',') : '';
            row[rowLpmIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 0.06) * 10) / 10).replace('.', ',') : '';
            if (currentNominalPresion) {
              row[rowPresionIdx] = String(Math.round(currentNominalPresion * 1000) / 1000).replace('.', ',');
            }
          } else if (rIdx === 3) {
            row[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal * 1.4) * 1000) / 1000).replace('.', ',') : '';
            row[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal * 1.4) / 0.06) * 10) / 10).replace('.', ',') : '';
          }
        }
        return row;
      });
    }
    return Array(numRows).fill(null).map(() => Array(numCols).fill(''));
  });

  // Mantener actualizado si cambia value o nominales externamente
  useEffect(() => {
    let rowsToMap: string[][] = [];
    try {
      if (value && typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rowsToMap = parsed;
        }
      }
    } catch (e) {
      // Ignorar
    }

    if (rowsToMap.length === 0) {
      if (hasVerticalHeaders) {
        rowsToMap = effectiveFilasNombres.map((name) => [name, ...Array(numCols).fill('')]);
      } else {
        rowsToMap = Array(numRows).fill(null).map(() => Array(numCols).fill(''));
      }
    }

    if (hasVerticalHeaders && rowsToMap.length !== numRows) {
      rowsToMap = [...rowsToMap];
      const totalCols = numCols + 1;
      while (rowsToMap.length < numRows) {
        rowsToMap.push(Array(totalCols).fill(''));
      }
      rowsToMap = rowsToMap.slice(0, numRows);
    }

    const mapped = rowsToMap.map((row: any, rIdx: number) => {
      const expectedLabel = hasVerticalHeaders ? (effectiveFilasNombres[rIdx] || '') : '';
      const rowData = Array.isArray(row) ? row : [];
      const newRow = [...rowData];
      if (hasVerticalHeaders) {
        newRow[0] = expectedLabel;
      }
      const totalCols = hasVerticalHeaders ? numCols + 1 : numCols;
      while (newRow.length < totalCols) newRow.push('');

      // Autocompletar Caudal y LPM en base a caudal nominal y presión nominal del equipo
      if (isGrafico) {
        if (rIdx === 0) {
          newRow[rowCaudalIdx] = '0';
          newRow[rowLpmIdx] = '0';
        } else if (rIdx === 1) {
          newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 2) * 1000) / 1000).replace('.', ',') : '';
          newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal / 2) / 0.06) * 10) / 10).replace('.', ',') : '';
        } else if (rIdx === 2) {
          newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round(currentNominalCaudal * 1000) / 1000).replace('.', ',') : '';
          newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal / 0.06) * 10) / 10).replace('.', ',') : '';
          newRow[rowPresionIdx] = currentNominalPresion ? String(Math.round(currentNominalPresion * 1000) / 1000).replace('.', ',') : '';
        } else if (rIdx === 3) {
          newRow[rowCaudalIdx] = currentNominalCaudal ? String(Math.round((currentNominalCaudal * 1.4) * 1000) / 1000).replace('.', ',') : '';
          newRow[rowLpmIdx] = currentNominalCaudal ? String(Math.round(((currentNominalCaudal * 1.4) / 0.06) * 10) / 10).replace('.', ',') : '';
        }
      }

      return newRow.slice(0, totalCols);
    });

    const isDifferent = JSON.stringify(mapped) !== JSON.stringify(data);
    if (isDifferent) {
      setData(mapped);
      onChange(JSON.stringify(mapped));
    }
  }, [
    value,
    numCols,
    numRows,
    hasVerticalHeaders,
    effectiveFilasNombres,
    isGrafico,
    currentNominalCaudal,
    currentNominalPresion,
    rowCaudalIdx,
    rowLpmIdx,
    rowPresionIdx
  ]);

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    const newData = data.map((row, ri) => {
      if (ri !== rIdx) return row;
      return row.map((cell, ci) => (ci === cIdx ? val : cell));
    });

    if (isGrafico && lpmColIdx !== -1 && caudalColIdx !== -1) {
      const targetRow = newData[rIdx];
      if (cIdx === rowLpmIdx) {
        const cleanVal = val.trim().replace(',', '.');
        if (cleanVal === '') {
          targetRow[rowCaudalIdx] = '';
        } else {
          const lpmVal = parseFloat(cleanVal);
          if (!isNaN(lpmVal)) {
            const caudalVal = lpmVal * 0.06;
            targetRow[rowCaudalIdx] = String(Math.round(caudalVal * 1000) / 1000).replace('.', ',');
          }
        }
      } else if (cIdx === rowCaudalIdx) {
        const cleanVal = val.trim().replace(',', '.');
        if (cleanVal === '') {
          targetRow[rowLpmIdx] = '';
        } else {
          const caudalVal = parseFloat(cleanVal);
          if (!isNaN(caudalVal)) {
            const lpmVal = caudalVal / 0.06;
            targetRow[rowLpmIdx] = String(Math.round(lpmVal * 10) / 10).replace('.', ',');
          }
        }
      }
    }

    setData(newData);
    onChange(JSON.stringify(newData));
  };

  const handleAddRow = () => {
    if (hasVerticalHeaders) return; // No permitir añadir en tablas de cabecera fija
    const newData = [...data, Array(numCols).fill('')];
    setData(newData);
    onChange(JSON.stringify(newData));
  };

  const handleRemoveRow = (rIdx: number) => {
    if (hasVerticalHeaders) return; // No permitir eliminar en tablas de cabecera fija
    if (data.length <= 1) {
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
              {hasVerticalHeaders && (
                <th className="px-3 py-2 font-bold uppercase text-[9px] tracking-wider border-r border-zinc-800 w-44 min-w-[150px]">
                  {isGrafico ? 'RENDIMIENTO' : 'Concepto / Ensayo'}
                </th>
              )}
              {effectiveOpciones.map((col, idx) => (
                <th key={idx} className="px-3 py-2 font-bold uppercase text-[9px] tracking-wider border-r border-zinc-800 last:border-r-0">
                  {col}
                </th>
              ))}
              {!disabled && !hasVerticalHeaders && (
                <th className="px-3 py-2 text-center w-12 font-bold uppercase text-[9px] tracking-wider">
                  Acción
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                {row.map((cell, cIdx) => {
                  const isPredefinedHeaderCell = hasVerticalHeaders && cIdx === 0;
                  const isAutoCalculatedFlowCell = isGrafico && (cIdx === rowCaudalIdx || cIdx === rowLpmIdx);
                  const isAutoCalculatedPresionCell = isGrafico && rIdx === 2 && cIdx === rowPresionIdx;
                  const isAutoCalculatedCell = isAutoCalculatedFlowCell || isAutoCalculatedPresionCell;
                  return (
                    <td key={cIdx} className={`p-1 border-r border-slate-100 last:border-r-0 ${isPredefinedHeaderCell ? 'bg-slate-50 font-bold text-slate-700 w-44 min-w-[150px]' : ''} ${isAutoCalculatedCell ? 'bg-zinc-50/70' : ''}`}>
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                        disabled={disabled || isPredefinedHeaderCell || isAutoCalculatedCell}
                        className={`w-full px-2 py-1 bg-transparent border-0 rounded text-xs outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500/30 ${isPredefinedHeaderCell ? 'font-bold text-slate-800' : 'font-medium'} ${isAutoCalculatedCell ? 'text-zinc-500 font-semibold cursor-not-allowed select-none' : ''}`}
                        placeholder={isPredefinedHeaderCell ? '' : '...'}
                      />
                    </td>
                  );
                })}
                {!disabled && !hasVerticalHeaders && (
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
      {!disabled && !hasVerticalHeaders && (
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

      {/* Botón Generar Gráfico Q-H si detectamos columnas correspondientes */}
      {isGrafico && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm"
            >
              <TrendingUp className="w-4 h-4" /> {showChart ? 'Ocultar Gráfico Q-H' : 'Generar Gráfico Q-H'}
            </button>
            {showChart && (
              <span className="text-[10px] text-slate-400 font-semibold">
                Mostrando curva de rendimiento
              </span>
            )}
          </div>

          {showChart && (() => {
            let caudalColIdx = effectiveOpciones.findIndex(h => {
              const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return norm.includes('caudal') || norm.includes('flow') || norm.includes('m3') || norm.trim() === 'q' || norm.includes('(q)');
            });
            let presionColIdx = effectiveOpciones.findIndex(h => {
              const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return norm.includes('presion') || norm.includes('pressure') || norm.includes('bar') || norm.trim() === 'p' || norm.trim() === 'h' || norm.includes('(p)') || norm.includes('(h)');
            });

            if (caudalColIdx === -1 && presionColIdx === -1) {
              caudalColIdx = effectiveOpciones.findIndex(h => h.toLowerCase().trim().startsWith('q'));
              presionColIdx = effectiveOpciones.findIndex(h => h.toLowerCase().trim().startsWith('p') || h.toLowerCase().trim().startsWith('h'));
            }

            if (caudalColIdx === -1 && presionColIdx !== -1) {
              caudalColIdx = presionColIdx === 0 ? 1 : 0;
            } else if (presionColIdx === -1 && caudalColIdx !== -1) {
              presionColIdx = caudalColIdx === 0 ? 1 : 0;
            } else if (caudalColIdx === -1 && presionColIdx === -1) {
              const firstColLower = (effectiveOpciones[0] || '').toLowerCase();
              if (firstColLower.includes('p') || firstColLower.includes('bar') || firstColLower.includes('h') || firstColLower.includes('pres')) {
                caudalColIdx = 1;
                presionColIdx = 0;
              } else {
                caudalColIdx = 0;
                presionColIdx = 1;
              }
            }

            const rowCaudalIdx = hasVerticalHeaders ? caudalColIdx + 1 : caudalColIdx;
            const rowPresionIdx = hasVerticalHeaders ? presionColIdx + 1 : presionColIdx;

            const dataPoints: { x: number; y: number }[] = [];
            data.forEach(row => {
              const cVal = parseFloat(String(row[rowCaudalIdx] || '').replace(',', '.'));
              const pVal = parseFloat(String(row[rowPresionIdx] || '').replace(',', '.'));
              if (!isNaN(cVal) && !isNaN(pVal)) {
                dataPoints.push({ x: cVal, y: pVal });
              }
            });

            if (dataPoints.length < 2) {
              return (
                <div className="text-center py-4 bg-slate-100 border border-slate-200 border-dashed rounded-xl text-xs text-slate-500 font-medium">
                  Introduce al menos 2 puntos con valores numéricos válidos en Caudal y Presión para visualizar el gráfico.
                </div>
              );
            }

            const sortedPoints = [...dataPoints].sort((a, b) => a.x - b.x);
            const maxCaudal = Math.max(...sortedPoints.map(p => p.x), 0);
            const refNomCaudal = currentNominalCaudal || nominalCaudal;
            const referenceCaudal = maxCaudal > 0 ? maxCaudal : (refNomCaudal || 100);
            const maxX = referenceCaudal * 1.25;

            const maxPresion = Math.max(...sortedPoints.map(p => p.y), 0);
            const refNomPresion = currentNominalPresion || nominalPresion;
            const referencePresion = Math.max(maxPresion, refNomPresion || 10);
            const maxY = referencePresion * 1.5;
            const roundMaxX = Math.ceil(maxX / 10) * 10;
            const roundMaxY = Math.ceil(maxY / 2) * 2;

            const w = 480;
            const h = 240;
            const padL = 40;
            const padR = 50;
            const padT = 25;
            const padB = 35;

            const chartW = w - padL - padR;
            const chartH = h - padT - padB;

            const scaleX = (val: number) => padL + (chartW * (val / roundMaxX));
            const scaleY = (val: number) => padT + chartH - (chartH * (val / roundMaxY));

            let pathD = '';
            const nPts = sortedPoints.length;
            const mPts: number[] = Array(nPts).fill(0);
            for (let i = 0; i < nPts; i++) {
              if (i === 0) {
                mPts[i] = (sortedPoints[1].y - sortedPoints[0].y) / (sortedPoints[1].x - sortedPoints[0].x);
              } else if (i === nPts - 1) {
                mPts[i] = (sortedPoints[nPts-1].y - sortedPoints[nPts-2].y) / (sortedPoints[nPts-1].x - sortedPoints[nPts-2].x);
              } else {
                const slopeLeft = (sortedPoints[i].y - sortedPoints[i-1].y) / (sortedPoints[i].x - sortedPoints[i-1].x);
                const slopeRight = (sortedPoints[i+1].y - sortedPoints[i].y) / (sortedPoints[i+1].x - sortedPoints[i].x);
                mPts[i] = (slopeLeft + slopeRight) / 2;
              }
            }

            for (let i = 0; i < nPts - 1; i++) {
              const p0 = sortedPoints[i];
              const p1 = sortedPoints[i + 1];
              const dx = p1.x - p0.x;
              
              const steps = 40;
              for (let j = 0; j <= steps; j++) {
                if (i > 0 && j === 0) continue;
                const t = j / steps;
                const h00 = 2 * Math.pow(t, 3) - 3 * Math.pow(t, 2) + 1;
                const h10 = Math.pow(t, 3) - 2 * Math.pow(t, 2) + t;
                const h01 = -2 * Math.pow(t, 3) + 3 * Math.pow(t, 2);
                const h11 = Math.pow(t, 3) - Math.pow(t, 2);
                
                const interpolatedX = p0.x + t * dx;
                const interpolatedY = h00 * p0.y + h10 * dx * mPts[i] + h01 * p1.y + h11 * dx * mPts[i+1];
                
                const px = scaleX(interpolatedX);
                const py = scaleY(interpolatedY);
                if (i === 0 && j === 0) {
                  pathD = `M ${px} ${py}`;
                } else {
                  pathD += ` L ${px} ${py}`;
                }
              }
            }

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner mt-1 flex flex-col items-center">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-3">Vista Previa: Curva de Rendimiento Q-H</span>
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[480px] h-auto">
                  {/* Cuadrícula horizontal */}
                  {Array.from({ length: 6 }).map((_, i) => {
                    const valY = (roundMaxY / 5) * i;
                    const py = scaleY(valY);
                    return (
                      <g key={`grid-y-${i}`}>
                        <line x1={padL} y1={py} x2={w - padR} y2={py} stroke="#1e293b" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
                        <text x={padL - 8} y={py + 3} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="end">{valY.toFixed(1)}</text>
                      </g>
                    );
                  })}

                  {/* Cuadrícula vertical */}
                  {Array.from({ length: 6 }).map((_, i) => {
                    const valX = (roundMaxX / 5) * i;
                    const px = scaleX(valX);
                    return (
                      <g key={`grid-x-${i}`}>
                        <line x1={px} y1={padT} x2={px} y2={padT + chartH} stroke="#1e293b" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
                        <text x={px} y={padT + chartH + 15} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">{valX.toFixed(0)}</text>
                      </g>
                    );
                  })}

                  {/* Líneas de Punto de Trabajo Nominal */}
                  {refNomCaudal > 0 && (
                    <g>
                      <line x1={scaleX(refNomCaudal)} y1={padT} x2={scaleX(refNomCaudal)} y2={padT + chartH} stroke="#10b981" strokeWidth="1" strokeDasharray="5 5" />
                      <text x={scaleX(refNomCaudal) + 4} y={padT + 8} fill="#10b981" fontSize="8" fontWeight="bold">Q Nom: {refNomCaudal} m³/h</text>
                    </g>
                  )}
                  {refNomPresion > 0 && (
                    <g>
                      <line x1={padL} y1={scaleY(refNomPresion)} x2={w - padR} y2={scaleY(refNomPresion)} stroke="#10b981" strokeWidth="1" strokeDasharray="5 5" />
                      <text x={w - padR - 5} y={scaleY(refNomPresion) - 4} fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="end">P Nom: {refNomPresion} bar</text>
                    </g>
                  )}
                  {refNomCaudal > 0 && refNomPresion > 0 && (
                    <circle cx={scaleX(refNomCaudal)} cy={scaleY(refNomPresion)} r="3.5" fill="#10b981" />
                  )}

                  {/* Ejes principales */}
                  <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#475569" strokeWidth="1.5" />
                  <line x1={padL} y1={padT + chartH} x2={w - padR} y2={padT + chartH} stroke="#475569" strokeWidth="1.5" />

                  {/* Etiquetas de los ejes */}
                  <text x={2} y={padT - 10} fill="#f43f5e" fontSize="9" fontWeight="bold">P (bar)</text>
                  <text x={w - padR + 5} y={padT + chartH + 3} fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="start">Q (m³/h)</text>

                  {/* Línea de la curva */}
                  <path d={pathD} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Puntos y valores */}
                  {sortedPoints.map((p, idx) => {
                    const px = scaleX(p.x);
                    const py = scaleY(p.y);
                    return (
                      <g key={`pt-${idx}`}>
                        <circle cx={px} cy={py} r="4.5" fill="#f43f5e" stroke="#0f172a" strokeWidth="2.5" />
                        <text x={px} y={py - 10} fill="#fff" fontSize="9" fontWeight="extrabold" textAnchor="middle">{p.y.toFixed(1)} bar</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
