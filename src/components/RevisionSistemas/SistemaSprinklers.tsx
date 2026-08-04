import React from 'react';
import { CheckCircle2, XCircle, X, Pencil, Trash2 } from 'lucide-react';
import type { CentroSistema, EquipoInstalado, Parte } from '../../Centros';
import { updateEquipoInstalado, updateParte as updateParteFirestore, uploadFile, type ChecklistItem } from '../../firebase';
import TableInput from '../TableInput';

interface Props {
    sist: CentroSistema;
    filteredEqs: EquipoInstalado[];
    equiposInstalados: EquipoInstalado[];
    setEquiposInstalados: React.Dispatch<React.SetStateAction<EquipoInstalado[]>>;
    saveEquiposProgress: (currentEquipos?: EquipoInstalado[]) => Promise<any[]>;
    getItemsToUse: (sistemaId: string) => ChecklistItem[];
    parte: Parte | null;
    parteId: string | undefined;
    updateParte: (updates: Partial<Parte>) => void;
    showToast: (msg: string) => void;
    setEditEquipo: (equipoId: string) => void;
    handleDeleteEquipo: (equipoId: string) => void;
    handleCheckChange: (equipoId: string, itemKey: string, value: any, itemName?: string) => void;
    getCheckStats: (eq: EquipoInstalado) => { ok: number; fail: number; pending: number };
    getEquipoSyncStatus?: (equipoId: string) => string;
}

const esUbicacionMarcaModelo = (label?: string, key?: string) => {
    const lbl = (label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const k = (key || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lbl.includes('ubicacion') || lbl.includes('marca') || lbl.includes('modelo') ||
           k.includes('ubicacion') || k.includes('marca') || k.includes('modelo');
};

export default function SistemaSprinklers({
    sist,
    filteredEqs,
    equiposInstalados,
    setEquiposInstalados,
    saveEquiposProgress,
    getItemsToUse,
    parte,
    parteId,
    updateParte,
    showToast,
    setEditEquipo,
    handleDeleteEquipo,
    handleCheckChange,
    getCheckStats,
    getEquipoSyncStatus
}: Props) {

    const getResponseColorClass = (value: any, isSelected: boolean) => {
        if (typeof value !== 'string' || !value) return 'text-slate-500';
        const valUpper = value.toUpperCase();
        if (valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME')) return 'text-red-600 font-bold';
        if (valUpper.includes('CORRECTO') || valUpper.includes('CONFORME')) return 'text-green-600 font-bold';
        return isSelected ? 'font-bold text-slate-800' : 'text-slate-500';
    };

    return (
        <>
            {filteredEqs.map((eq, i) => {
                const itemsToUse = getItemsToUse(sist.id);
                const algunCheckRojo = itemsToUse.some((item) => {
                                                            const val = eq[item.key as keyof EquipoInstalado];
                                                            if (val === false || val === 'false') return true;
                                                            if (typeof val === 'string') {
                                                                const valUpper = val.toUpperCase().trim();
                                                                return valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || valUpper === 'NO';
                                                            }
                                                            return false;
                                                        });
                const stats = getCheckStats(eq);

                return (
                    <div key={eq.id} className={`rounded-xl border transition-all ${algunCheckRojo ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-150'}`}>
                        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="px-3 py-1 bg-black text-white text-sm font-mono font-bold rounded-lg shadow-md min-w-[36px] text-center shrink-0">
                                    {eq.codigo || (i + 1).toString().padStart(2, '0')}
                                </span>
                                                                        {getEquipoSyncStatus && (() => {
                                                                            const status = getEquipoSyncStatus(eq.id);
                                                                            if (status === 'saving') {
                                                                                return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full animate-pulse shadow-xs">🟡 Guardando...</span>;
                                                                            }
                                                                            if (status === 'offline') {
                                                                                return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-full shadow-xs">🔴 Sin conexión</span>;
                                                                            }
                                                                            return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-xs">🟢 Sincronizado</span>;
                                                                        })()}
                            </div>
                            <div className="flex items-center gap-1.5">
                            </div>
                        </div>

                        <div className="px-4 pb-3">
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5">
                                {/* SOLO los items del checklist dinámico (exactamente como en el editor de plantillas) */}
                                {getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                    const lbl = (item.label || '').toLowerCase();
                                    // Solo filtrar campo de notas para ponerlo debajo del grid
                                    if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) return false;
                                    return true;
                                }).map(item => {
                                     const rawVal = eq[item.key as keyof EquipoInstalado];
                                     const itemOpciones = (item as any).opciones || [];
                                     const val = (rawVal === undefined || rawVal === '')
                                         ? (itemOpciones.includes('CORRECTO') ? 'CORRECTO' : (itemOpciones.includes('CONFORME') ? 'CONFORME' : rawVal))
                                         : rawVal;
                                     const tipo = (item as ChecklistItem).tipoRespuesta as string || 'check';
                                     const lbl = (item.label || '').toLowerCase();
                                     const esCampoNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');

                                     // No renderizar campo notas en el grid (se renderiza debajo)
                                     if (esCampoNotas) return null;

                                     if (tipo === 'seccion') {
                                         return (
                                             <div key={item.key} className="col-span-full border-b border-slate-200 pb-1.5 pt-4 mb-2 flex items-center justify-between">
                                                 <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{item.label}</span>
                                             </div>
                                         );
                                     }

                                     if (tipo === 'tabla') {
                                        return (
                                            <TableInput
                                                key={item.key}
                                                label={item.label}
                                                opciones={item.opciones || []}
                                                filasInicio={item.filasInicio}
                                                value={String(val || '')}
                                                onChange={(newVal) => handleCheckChange(eq.id, item.key, newVal)}
                                            />
                                        );
                                    }

                                    if (item.horizontal || tipo === 'pregunta-horizontal') {
                                        const isCheck = tipo === 'check';
                                        const isNumero = tipo === 'numero';
                                        const isFecha = tipo === 'fecha';
                                        const isTextoLargo = tipo === 'texto-largo';
                                        const isDesplegable = tipo === 'desplegable';
                                        const isSeleccion = tipo === 'seleccion';

                                        return (
                                            <div key={item.key} className="col-span-full border-b border-slate-300 py-1.5 flex items-center justify-between gap-4 min-h-[38px]">
                                                <span className="text-xs font-normal text-slate-600">{item.label}</span>
                                                <div className={`${(isSeleccion || isDesplegable) ? 'w-auto' : 'w-48'} shrink-0 flex justify-end`}>
                                                    {isCheck ? (
                                                        (() => {
                                                            const isChecked = val === true || (typeof val === 'string' && val.toLowerCase() === 'true');
                                                            const isUnchecked = val === false || (typeof val === 'string' && val.toLowerCase() === 'false');
                                                            return (
                                                                <label
                                                                    className={`flex items-center gap-2 cursor-pointer text-xs px-2 py-1.5 rounded-lg transition-all select-none ${
                                                                        isUnchecked
                                                                            ? 'text-red-600 font-semibold bg-red-50 hover:bg-red-100'
                                                                            : isChecked
                                                                            ? 'text-green-700 font-medium bg-green-50 hover:bg-green-100'
                                                                            : 'text-slate-600 font-medium bg-white hover:bg-slate-50 border border-slate-200'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => handleCheckChange(eq.id, item.key, e.target.checked, item.label)}
                                                                        className={`w-3.5 h-3.5 rounded cursor-pointer ${
                                                                            isUnchecked
                                                                                ? 'text-red-500 border-red-300 focus:ring-red-400'
                                                                                : isChecked
                                                                                ? 'text-green-500 border-green-300 focus:ring-green-400'
                                                                                : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                                                                        }`}
                                                                    />
                                                                    <span>OK</span>
                                                                    {isChecked && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                                                    {isUnchecked && <XCircle className="w-3 h-3 text-red-400 ml-auto" />}
                                                                </label>
                                                            );
                                                        })()
                                                    ) : isNumero ? (
                                                        <input
                                                            type="number"
                                                            value={typeof val === 'number' ? val : ''}
                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? Number(e.target.value) : '')}
                                                            className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${typeof val === 'number' ? 'font-bold' : ''}`}
                                                            placeholder="0"
                                                        />
                                                    ) : isFecha ? (
                                                        (() => {
                                                            const esFechaRevision = (item.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('revision');
                                                                        const fechaVal = typeof val === 'string' && val ? (esFechaRevision ? val.substring(0, 10) : val.substring(0, 7)) : '';
                                                            return (
                                                                <input
                                                                    type={esFechaRevision ? "date" : "month"}
                                                                    value={fechaVal}
                                                                    onChange={(e) => handleCheckChange(eq.id, item.key, esFechaRevision ? e.target.value : (e.target.value ? e.target.value + '-01' : ''))}
                                                                    className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 ${fechaVal ? 'font-bold' : ''}`}
                                                                />
                                                            );
                                                        })()
                                                    ) : isTextoLargo ? (
                                                        <textarea
                                                            value={typeof val === 'string' ? val : ''}
                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                            className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none ${getResponseColorClass(val, typeof val === 'string' && val.trim() !== '')}`}
                                                            rows={2}
                                                            placeholder="..."
                                                        />
                                                    ) : isDesplegable ? (
                                                        (() => {
                                                            const opciones = (item as any).opciones || [];
                                                            return (
                                                                <select
                                                                    value={typeof val === 'string' ? val : ''}
                                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                                    className={`w-auto min-w-[110px] px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${getResponseColorClass(val, !!val)}`}
                                                                >
                                                                    <option value="">Selecciona...</option>
                                                                    {opciones.map((opt: string, idx: number) => (
                                                                        <option key={idx} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        })()
                                                    ) : isSeleccion ? (
                                                         (() => {
                                                             const opciones = (item as any).opciones || ['Sí', 'No', 'N/A'];
                                                             return (
                                                                 <div className="flex gap-1.5 flex-wrap justify-end">
                                                                     {opciones.map((opt: string, idx: number) => {
                                                                         const isSelected = val === opt;
                                                                         return (
                                                                             <button
                                                                                 key={idx}
                                                                                 type="button"
                                                                                 onClick={() => handleCheckChange(eq.id, item.key, isSelected ? '' : opt, item.label)}
                                                                                 className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none shadow-sm \${

                                                                                     isSelected

                                                                                         ? (() => {

                                                                                             const optUpper = (opt || '').toUpperCase().trim();

                                                                                             if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO') return 'bg-red-600 text-white border-red-600 font-bold scale-105';

                                                                                             if (optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) return 'bg-green-600 text-white border-green-600 font-bold scale-105';

                                                                                             return 'bg-indigo-600 text-white border-indigo-600 font-bold scale-105';

                                                                                           })()

                                                                                         : (() => {

                                                                                             const optUpper = (opt || '').toUpperCase().trim();

                                                                                             if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO') return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80';

                                                                                             if (optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100/80';

                                                                                             return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

                                                                                           })()

                                                                                 }`}
                                                                             >
                                                                                 {opt}
                                                                             </button>
                                                                         );
                                                                     })}
                                                                 </div>
                                                             );
                                                         })()
                                                    ) : (
                                                         (() => {
                                                             const labelLower = (item.label || '').toLowerCase().replace(/[áéíóú]/g, (c) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'})[c] || c);
                                                             const esNumeroOrden = labelLower.includes('orden');
                                                             const esUCase = esUbicacionMarcaModelo(item.label, item.key);
                                                             const placeholderTexto = labelLower.includes('referencia') && labelLower.includes('instalacion')
                                                                 ? 'Ejemplo: Area general o zona'
                                                                 : '...';
                                                             return (
                                                                 <input
                                                                     type="text"
                                                                     value={esNumeroOrden ? (eq.codigo || '') : (typeof val === 'string' ? (esUCase ? val.toUpperCase() : val) : '')}
                                                                     onChange={(e) => {
                                                                         if (!esNumeroOrden) {
                                                                             handleCheckChange(eq.id, item.key, esUCase ? e.target.value.toUpperCase() : e.target.value);
                                                                         }
                                                                     }}
                                                                     className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${esNumeroOrden ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''} ${esNumeroOrden ? '' : getResponseColorClass(val, typeof val === 'string' && val.trim() !== '')} ${esUCase ? 'uppercase' : ''}`}
                                                                     placeholder={placeholderTexto}
                                                                     readOnly={esNumeroOrden}
                                                                 />
                                                             );
                                                         })()
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (tipo === 'check') {
                                        const isChecked = val === true || (typeof val === 'string' && val.toLowerCase() === 'true');
                                        const isUnchecked = val === false || (typeof val === 'string' && val.toLowerCase() === 'false');
                                        return (
                                            <label
                                                key={item.key}
                                                className={`flex items-center gap-2 cursor-pointer text-xs px-2 py-1.5 rounded-lg transition-all select-none ${
                                                    isUnchecked
                                                        ? 'text-red-600 font-semibold bg-red-50 hover:bg-red-100'
                                                        : isChecked
                                                        ? 'text-green-700 font-medium bg-green-50 hover:bg-green-100'
                                                        : 'text-slate-600 font-medium bg-white hover:bg-slate-50 border border-slate-200'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.checked, item.label)}
                                                    className={`w-3.5 h-3.5 rounded cursor-pointer ${
                                                        isUnchecked
                                                            ? 'text-red-500 border-red-300 focus:ring-red-400'
                                                            : isChecked
                                                            ? 'text-green-500 border-green-300 focus:ring-green-400'
                                                            : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                                                    }`}
                                                />
                                                {item.label}
                                                {isChecked && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                                                {isUnchecked && <XCircle className="w-3 h-3 text-red-400 ml-auto" />}
                                            </label>
                                        );
                                     } else if (tipo === 'numero') {
                                         const tieneValor = typeof val === 'number';
                                         return (
                                             <div key={item.key} className="flex flex-col gap-0.5">
                                                 <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                 <input
                                                     type="number"
                                                     value={tieneValor ? val : ''}
                                                     onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? Number(e.target.value) : '')}
                                                     className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${tieneValor ? 'font-bold' : ''}`}
                                                     placeholder="0"
                                                 />
                                             </div>
                                         );
                                        } else if (tipo === 'fecha') {
                                        const lblLower = (item.label || '').toLowerCase();
                                        const isFechaRevision = lblLower.includes('fecha de revisi');

                                        if (isFechaRevision) {
                                            const fechaValFull = typeof val === 'string' ? val : '';
                                            const hoyStr = new Date().toISOString().split('T')[0];
                                            const noEsHoy = fechaValFull !== hoyStr;
                                            return (
                                                <div key={item.key} className="flex flex-col gap-0.5">
                                                    <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                    <input
                                                        type="date"
                                                        value={fechaValFull}
                                                        onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                        className={`w-full px-2 py-1.5 border rounded-lg text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${noEsHoy ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white'}`}
                                                    />
                                                </div>
                                            );
                                        }

                                        const fechaVal = typeof val === 'string' && val ? val.substring(0, 7) : '';
                                        return (
                                            <div key={item.key} className="flex flex-col gap-0.5">
                                                <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                <input
                                                    type="month"
                                                    value={fechaVal}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? e.target.value + '-01' : '')}
                                                    className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 ${fechaVal ? 'font-bold' : ''}`}
                                                />
                                            </div>
                                        );
                                         } else if (tipo === 'texto') {
                                             const labelLower = (item.label || '').toLowerCase().replace(/[áéíóú]/g, (c) => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'})[c] || c);
                                             const esNumeroOrden = labelLower.includes('orden');
                                             const esUCase = esUbicacionMarcaModelo(item.label, item.key);
                                             if (esNumeroOrden) console.log('🔍 Campo Nº Orden detectado, eq.codigo =', eq.codigo);
                                             const placeholderTexto = labelLower.includes('referencia') && labelLower.includes('instalacion')
                                                 ? 'Ejemplo: Area general o zona'
                                                 : '...';
                                             const tieneValorTexto = !esNumeroOrden && typeof val === 'string' && val.trim() !== '';
                                             return (
                                                 <div key={item.key} className="flex flex-col gap-0.5">
                                                     <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                     <input
                                                         type="text"
                                                         value={esNumeroOrden ? (eq.codigo || '') : (typeof val === 'string' ? (esUCase ? val.toUpperCase() : val) : '')}
                                                         onChange={(e) => {
                                                             if (!esNumeroOrden) {
                                                                 handleCheckChange(eq.id, item.key, esUCase ? e.target.value.toUpperCase() : e.target.value);
                                                             }
                                                         }}
                                                         className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${esNumeroOrden ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''} ${esNumeroOrden ? '' : getResponseColorClass(val, tieneValorTexto)} ${esUCase ? 'uppercase' : ''}`}
                                                         placeholder={placeholderTexto}
                                                         readOnly={esNumeroOrden}
                                                     />
                                                 </div>
                                             );
                                          } else if (tipo === 'texto-largo') {
                                             // No renderizar "notas" en el grid
                                             const lbl = (item.label || '').toLowerCase();
                                             if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) return null;
                                             const tieneValorTextoLargo = typeof val === 'string' && val.trim() !== '';
                                             return (
                                                 <div key={item.key} className="flex flex-col gap-0.5 col-span-2">
                                                     <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                     <textarea
                                                         value={typeof val === 'string' ? val : ''}
                                                         onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                         className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none ${getResponseColorClass(val, tieneValorTextoLargo)}`}
                                                         rows={3}
                                                         placeholder="..."
                                                     />
                                                 </div>
                                             );
                                          } else if (tipo === 'desplegable') {
                                             const opciones = (item as any).opciones || [];
                                             return (
                                                 <div key={item.key} className="flex flex-col gap-0.5">
                                                     <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                     <select
                                                         value={typeof val === 'string' ? val : ''}
                                                         onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                         className={`w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${getResponseColorClass(val, !!val)}`}
                                                     >
                                                         <option value="">Selecciona...</option>
                                                         {opciones.map((opt: string, idx: number) => (
                                                             <option key={idx} value={opt}>{opt}</option>
                                                         ))}
                                                     </select>
                                                 </div>
                                             );
                                          } else if (tipo === 'seleccion') {
                                             const opciones = (item as any).opciones || ['Sí', 'No', 'N/A'];
                                             return (
                                                 <div key={item.key} className="flex flex-col gap-1 col-span-2">
                                                     <label className="text-[10px] font-normal text-slate-500">{item.label}</label>
                                                     <div className="flex gap-1.5 flex-wrap">
                                                         {opciones.map((opt: string, idx: number) => {
                                                             const isSelected = val === opt;
                                                             return (
                                                                 <button
                                                                     key={idx}
                                                                     type="button"
                                                                     onClick={() => handleCheckChange(eq.id, item.key, isSelected ? '' : opt, item.label)}
                                                                     className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none shadow-sm \${

                                                                         isSelected

                                                                             ? (() => {

                                                                                 const optUpper = (opt || '').toUpperCase().trim();

                                                                                 if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO') return 'bg-red-600 text-white border-red-600 font-bold scale-105';

                                                                                 if (optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) return 'bg-green-600 text-white border-green-600 font-bold scale-105';

                                                                                 return 'bg-indigo-600 text-white border-indigo-600 font-bold scale-105';

                                                                               })()

                                                                             : (() => {

                                                                                 const optUpper = (opt || '').toUpperCase().trim();

                                                                                 if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO') return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80';

                                                                                 if (optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100/80';

                                                                                 return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

                                                                               })()

                                                                     }`}
                                                                 >
                                                                     {opt}
                                                                 </button>
                                                             );
                                                         })}
                                                     </div>
                                                 </div>
                                             );
                                          }
                                    })}
                                </div>
                            </div>
                                                                                                                                                                {/* Campos de Anomalías y Observaciones del equipo (Bloque único no duplicado) */}
                                                                   {(() => {
                                                                       const notesItems = getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                                                           const lbl = (item.label || '').toLowerCase();
                                                                           return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                                       });

                                                                       const rawAnom = eq.anomalias;
                                                                       const noteItemAnom = notesItems.find(i => (i.label || '').toLowerCase().includes('anomal') || (i.label || '').toLowerCase().includes('nota'));
                                                                       const valAnom = (typeof rawAnom === 'string' && rawAnom.trim() !== '') 
                                                                           ? rawAnom 
                                                                           : (noteItemAnom && typeof eq[noteItemAnom.key as keyof EquipoInstalado] === 'string' ? (eq[noteItemAnom.key as keyof EquipoInstalado] as string) : '');

                                                                       const rawObs = (eq as any).observaciones;
                                                                       const noteItemObs = notesItems.find(i => (i.label || '').toLowerCase().includes('observacion'));
                                                                       const valObs = (typeof rawObs === 'string' && rawObs.trim() !== '') 
                                                                           ? rawObs 
                                                                           : (noteItemObs && typeof eq[noteItemObs.key as keyof EquipoInstalado] === 'string' ? (eq[noteItemObs.key as keyof EquipoInstalado] as string) : '');

                                                                       const esNoEncontrado = typeof valAnom === 'string' && valAnom.includes('no localizarse');
                                                                       const isExtintor = (sist.tipo || sist.familia || '').toLowerCase().includes('extintor');
                                                                       const isBie = (sist.tipo || sist.familia || '').toLowerCase().includes('bie') || (sist.tipo || sist.familia || '').toLowerCase().includes('boca');
                                                                       const isCaseta = (sist.tipo || sist.familia || '').toLowerCase().includes('caseta');
                                                                       
                                                                       const esAvisoAutoMsg = typeof valAnom === 'string' && (
                                                                           (isExtintor && (valAnom.includes('Extintor caducado') || valAnom.includes('Extintor necesita retimbre') || valAnom.includes('Se aproxima caducidad o retimbrado'))) ||
                                                                           (isBie && (valAnom.includes('Equipo caducado') || valAnom.includes('Se necesita realizar prueba'))) ||
                                                                           (isCaseta && (valAnom.includes('Manguera 70 mm. caducada') || valAnom.includes('Manguera 70 mm. necesita prueba') || valAnom.includes('Manguera 45 mm. caducada') || valAnom.includes('Manguera 45 mm. necesita prueba')))
                                                                       );
                                                                       
                                                                       const isErrorNotas = esNoEncontrado || algunCheckRojo || esAvisoAutoMsg;
                                                                       const tieneAnomalia = (typeof valAnom === 'string' && valAnom.trim() !== '') || isErrorNotas;
                                                                       const tieneObservacion = typeof valObs === 'string' && valObs.trim() !== '';

                                                                       const handleAnomaliaChange = (newVal: string) => {
                                                                           handleCheckChange(eq.id, 'anomalias', newVal);
                                                                           if (noteItemAnom) {
                                                                               handleCheckChange(eq.id, noteItemAnom.key, newVal);
                                                                           }
                                                                       };

                                                                       const handleObservacionesChange = (newVal: string) => {
                                                                           handleCheckChange(eq.id, 'observaciones', newVal);
                                                                           if (noteItemObs) {
                                                                               handleCheckChange(eq.id, noteItemObs.key, newVal);
                                                                           }
                                                                       };

                                                                       return (
                                                                           <div key="single_notes_block" className="px-4 pb-3 mt-4 space-y-3">
                                                                               <div>
                                                                                   <label className={`text-xs font-semibold mb-1 block ${tieneAnomalia ? 'text-red-700 font-bold' : 'text-slate-600'}`}>Anomalías del equipo:</label>
                                                                                   <textarea
                                                                                       value={typeof valAnom === 'string' ? valAnom : ''}
                                                                                       onChange={(e) => handleAnomaliaChange(e.target.value)}
                                                                                       className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[70px] ${tieneAnomalia ? 'bg-red-50 border-2 border-red-400 text-red-800 font-bold focus:border-red-500 focus:ring-red-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                                                                                       rows={3}
                                                                                       placeholder="Escribe aquí las anomalías..."
                                                                                   />
                                                                               </div>
                                                                               <div>
                                                                                   <label className={`text-xs font-semibold mb-1 block ${tieneObservacion ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>Observaciones del equipo:</label>
                                                                                   <textarea
                                                                                       value={typeof valObs === 'string' ? valObs : ''}
                                                                                       onChange={(e) => handleObservacionesChange(e.target.value)}
                                                                                       className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[60px] ${tieneObservacion ? 'bg-blue-50/70 border-2 border-blue-400 text-blue-900 font-bold focus:border-blue-500 focus:ring-blue-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                                                                                       rows={2}
                                                                                       placeholder="Escribe aquí observaciones adicionales..."
                                                                                   />
                                                                               </div>
                                                                           </div>
                                                                       );
                                                                   })()}

                                                                  {/* Galería de fotos debajo de las anomalías */}
                            {(() => {
                                const currentFotos = Array.isArray((eq as any)['fotos'])
                                    ? (eq as any)['fotos']
                                    : ((eq as any)['foto'] ? [(eq as any)['foto']] : []);

                                return (
                                    <div className="px-4 pb-4 flex flex-wrap gap-3">
                                        {currentFotos.map((fotoUrl: string, idx: number) => (
                                            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-sm group">
                                                <img src={fotoUrl} alt="Foto equipo" className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-300" onClick={() => window.open(fotoUrl, '_blank')} />
                                                <button
                                                    onClick={() => {
                                                        const newFotos = currentFotos.filter((_: any, i: number) => i !== idx);
                                                        handleCheckChange(eq.id, 'fotos', newFotos);
                                                        if (newFotos.length === 0) handleCheckChange(eq.id, 'foto', '');
                                                        else if (idx === 0) handleCheckChange(eq.id, 'foto', newFotos[0]);
                                                    }}
                                                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Eliminar foto"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}

                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                try {
                                                    const thumbnail = await new Promise<Blob>((resolve, reject) => {
                                                        const img = new Image();
                                                        const objectUrl = URL.createObjectURL(file);
                                                        img.onload = () => {
                                                            URL.revokeObjectURL(objectUrl);
                                                            const canvas = document.createElement('canvas');
                                                            const MAX = 640;
                                                            let w = img.width, h = img.height;
                                                            if (w > h) { if (w > MAX) { h = Math.floor(h * MAX / w); w = MAX; } }
                                                            else { if (h > MAX) { w = Math.floor(w * MAX / h); h = MAX; } }
                                                            canvas.width = w; canvas.height = h;
                                                            const ctx = canvas.getContext('2d');
                                                            if (!ctx) { reject(new Error('No canvas context')); return; }
                                                            ctx.drawImage(img, 0, 0, w, h);
                                                            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Error blob')), 'image/jpeg', 0.75);
                                                        };
                                                        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Error cargando imagen')); };
                                                        img.src = objectUrl;
                                                    });
                                                    const thumbFile = new File([thumbnail], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                                    const path = `revisiones/${parteId}/${eq.id}/foto_${Date.now()}`;
                                                    const url = await uploadFile(thumbFile, path);

                                                    const newFotos = [...currentFotos, url];
                                                    handleCheckChange(eq.id, 'fotos', newFotos);
                                                    if (currentFotos.length === 0) handleCheckChange(eq.id, 'foto', url);
                                                } catch (err) {
                                                    console.error('Error al subir imagen:', err);
                                                    alert('Error al subir la imagen');
                                                }
                                            }}
                                            className="hidden"
                                            id={`foto-file-multi-${eq.id}`}
                                        />
                                        <label
                                            htmlFor={`foto-file-multi-${eq.id}`}
                                            className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                                            title="Añadir foto"
                                        >
                                            <span className="text-xl leading-none mb-0.5">+</span>
                                            <span className="text-[9px] font-bold">Foto</span>
                                        </label>
                                    </div>
                                );
                            })()}

                            <div className={`px-4 pb-4 ${algunCheckRojo ? 'border-t border-red-200 pt-3' : 'border-t border-slate-200 pt-3'}`}>
                               <div className="flex flex-wrap items-center justify-between gap-2">
                                   <div className="flex items-center gap-2">
                                      <button
                                          type="button"
                                          onClick={async () => {
                                              const itemsToUse = getItemsToUse(eq.sistemaId);
                                              const updatedEquipos = equiposInstalados.map(currEq => {
                                                  if (currEq.id === eq.id) {
                                                      const allChecked: Record<string, any> = {};
                                                      itemsToUse.forEach(item => {
                                                          if (item.tipoRespuesta === 'check') {
                                                              allChecked[item.key] = true;
                                                          }
                                                      });
                                                      return {
                                                          ...currEq,
                                                          revisado: true,
                                                          ...allChecked
                                                      };
                                                  }
                                                  return currEq;
                                              });
                                              setEquiposInstalados(updatedEquipos);
                                              saveEquiposProgress(updatedEquipos);
                                              const equipoModificado = updatedEquipos.find(currEq => currEq.id === eq.id);
                                              if (equipoModificado) {
                                                  try { await updateEquipoInstalado(eq.id, equipoModificado as any); } catch (err) { console.error('Error guardando en Firestore:', err); }
                                              }
                                              showToast('Guardado');
                                              // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                              if (parte?.estado === 'Planificado') {
                                                  updateParte({ estado: 'Abierto' });
                                                  const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                  const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                  const docId = parteActual?._docId || parteId;
                                                  try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                              }
                                          }}
                                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                      >
                                          Revisado OK
                                      </button>
                                      
                                      <button
                                          type="button"
                                          onClick={async () => {
                                              const itemsToUse = getItemsToUse(eq.sistemaId);
                                              const updatedEquipos = equiposInstalados.map(currEq => {
                                                  if (currEq.id === eq.id) {
                                                      const allFalse: Record<string, any> = {};
                                                      itemsToUse.forEach(item => {
                                                          if (item.tipoRespuesta === 'check') {
                                                              allFalse[item.key] = false;
                                                          }
                                                      });
                                                      // También establecer el campo notas con el texto de anomalía
                                                      const notasItem = itemsToUse.find(item => {
                                                          const lbl = (item.label || '').toLowerCase();
                                                          return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                      });
                                                      if (notasItem) {
                                                          allFalse[notasItem.key] = 'Equipo no revisado por no localizarse en su sitio.';
                                                      }
                                                      return {
                                                          ...currEq,
                                                          revisado: true,
                                                          ...allFalse,
                                                          anomalias: 'Equipo no revisado por no localizarse en su sitio.'
                                                      };
                                                  }
                                                  return currEq;
                                              });
                                              setEquiposInstalados(updatedEquipos);
                                              saveEquiposProgress(updatedEquipos);
                                              const equipoModificado = updatedEquipos.find(currEq => currEq.id === eq.id);
                                              if (equipoModificado) {
                                                  try { await updateEquipoInstalado(eq.id, equipoModificado as any); } catch (err) { console.error('Error guardando en Firestore:', err); }
                                              }
                                              showToast('Guardado');
                                              // Cambiar estado del parte a "Abierto" si estaba en "Planificado"
                                              if (parte?.estado === 'Planificado') {
                                                  updateParte({ estado: 'Abierto' });
                                                  const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                  const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                  const docId = parteActual?._docId || parteId;
                                                  try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                              }
                                          }}
                                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                      >
                                          Equipo no encontrado
                                      </button>
                                      <button
                                          type="button"
                                          onClick={async () => {
                                              const itemsToUse = getItemsToUse(eq.sistemaId);
                                              const updatedEquipos = equiposInstalados.map(currEq => {
                                                  if (currEq.id === eq.id) {
                                                      const cleanedEq = { ...currEq, revisado: false };
                                                      cleanedEq.anomalias = ''; // Limpiar siempre anomalías principales

                                                      itemsToUse.forEach(item => {
                                                          const lbl = (item.label || '').toLowerCase();
                                                          const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');

                                                          // Limpiar checks y campos de observaciones
                                                          if (item.tipoRespuesta === 'check') {
                                                              (cleanedEq as any)[item.key] = null;
                                                          } else if (isNotas) {
                                                              (cleanedEq as any)[item.key] = '';
                                                          }
                                                      });
                                                      return cleanedEq;
                                                  }
                                                  return currEq;
                                              });
                                              setEquiposInstalados(updatedEquipos);
                                              saveEquiposProgress(updatedEquipos);
                                          }}
                                          className="px-4 py-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                      >
                                          Limpiar Checks
                                      </button>
                                   </div>
                                   <div className="flex items-center gap-1.5">
                                       <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                                           <CheckCircle2 className="w-3 h-3" /> {stats.ok}
                                       </span>
                                       {stats.fail > 0 && (
                                           <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                                               <XCircle className="w-3 h-3" /> {stats.fail}
                                           </span>
                                       )}
                                       {stats.pending > 0 && (
                                           <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold">
                                               {stats.pending}?
                                           </span>
                                       )}
                                       <div className="w-px h-5 bg-slate-200" />
                                       <button
                                           onClick={() => setEditEquipo(eq.id)}
                                           className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                                           title="Editar equipo"
                                       >
                                           <Pencil className="w-3.5 h-3.5" />
                                       </button>
                                       <button
                                           onClick={() => handleDeleteEquipo(eq.id)}
                                           className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                           title="Eliminar equipo"
                                       >
                                           <Trash2 className="w-3.5 h-3.5" />
                                       </button>
                                   </div>
                               </div>
                          </div>
                    </div>
                );
            })}
        </>
    );
}
