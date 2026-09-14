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
    handleCopiarEquipo?: (eqToCopy: EquipoInstalado) => void | Promise<void>;
}

const esCampoUbicacion = (label?: string, key?: string) => {
    const lbl = (label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const k = (key || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lbl.includes('ubicacion') || lbl.includes('cobertura') || lbl.includes('planta') || lbl.includes('nivel') ||
           k.includes('ubicacion') || k.includes('cobertura') || k.includes('planta') || k.includes('nivel');
};

const esUbicacionMarcaModelo = (label?: string, key?: string) => {
    const lbl = (label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const k = (key || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lbl.includes('ubicacion') || lbl.includes('marca') || lbl.includes('modelo') ||
           k.includes('ubicacion') || k.includes('marca') || k.includes('modelo');
};

export default function SistemaFuenteAlimentacionAuxiliar({
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
    getEquipoSyncStatus,
    handleCopiarEquipo
}: Props) {
    return (
        <>
            {filteredEqs.map((eq, i) => {
                const itemsToUse = getItemsToUse(sist.id);
                const algunCheckRojo = itemsToUse.some((item) => {
                    const val = eq[item.key as keyof EquipoInstalado];
                    if (val === false || val === 'false') return true;
                    if (typeof val === 'string') {
                        const valUpper = val.toUpperCase().trim();
                        if (valUpper.includes('SIN ANOMAL') || valUpper.includes('SIN DEFECTO') || (valUpper.includes('CORRECTO') && !valUpper.includes('NO CORRECTO')) || (valUpper.includes('CONFORME') && !valUpper.includes('NO CONFORME'))) return false;
                        return valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || valUpper === 'NO' || (valUpper.includes('ANOMAL') && !valUpper.includes('SIN ANOMAL'));
                    }
                    return false;
                });
                const stats = getCheckStats(eq);

                return (
                    <div key={eq.id} id={`equipo-${eq.id}`} className={`scroll-mt-44 rounded-xl border transition-all ${algunCheckRojo ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-150'}`}>
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
                                {/* SOLO los items del checklist dinámico */}
                                {getItemsToUse(sist.id).filter((item: ChecklistItem) => {
                                    const lbl = (item.label || '').toLowerCase();
                                    const tipo = ((item as any).tipoRespuesta || (item as any).tipo || '').toLowerCase();
                                    // Filtrar campo de notas/observaciones/anomalias e imagen/foto para renderizarlo independientemente abajo
                                    if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) return false;
                                    if (lbl.includes('imagen') || lbl.includes('foto') || tipo === 'imagen' || tipo === 'foto') return false;
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
                                    const esCampoImagen = lbl.includes('imagen') || lbl.includes('foto') || tipo === 'imagen' || tipo === 'foto';
                                    
                                    if (esCampoNotas || esCampoImagen) return null;
                                    
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
                                            <div key={item.key} className="col-span-full border-b border-slate-100 pb-2 pt-2 flex items-center justify-between gap-4">
                                                <span className="text-xs font-semibold text-slate-700">{item.label}</span>
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
                                                            className={`w-full px-2 py-1.5 rounded-lg text-xs outline-none transition-colors ${esCampoUbicacion(item.label, item.key) && typeof val === 'string' && val.length > 40 ? 'bg-red-50 border-2 border-red-500 text-red-700 font-bold focus:border-red-600 focus:ring-2 focus:ring-red-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`}
                                                            placeholder="0"
                                                        />
                                                    ) : isFecha ? (
                                                        (() => {
                                                            const labelLower = (item.label || '').toLowerCase();
                                                            const isFechaRevision = labelLower.includes('fecha de revision') || labelLower.includes('fecha de revisión');
                                                            const fechaVal = typeof val === 'string' && val 
                                                                ? (isFechaRevision ? val.substring(0, 10) : val.substring(0, 7)) 
                                                                : '';
                                                            const hoyStr = new Date().toISOString().split('T')[0];
                                                            const noEsHoy = isFechaRevision && fechaVal !== '' && fechaVal !== hoyStr;
                                                            return (
                                                                <input
                                                                    type={isFechaRevision ? 'date' : 'month'}
                                                                    value={fechaVal}
                                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? (isFechaRevision ? e.target.value : e.target.value + '-01') : '')}
                                                                    className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors ${
                                                                        noEsHoy
                                                                            ? 'border-orange-400 bg-orange-50 text-orange-800 font-bold focus:border-orange-500 focus:ring-orange-500/20'
                                                                            : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'
                                                                    }`}
                                                                />
                                                            );
                                                        })()
                                                    ) : isTextoLargo ? (
                                                        <textarea
                                                            value={typeof val === 'string' ? val : ''}
                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
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
                                                                    className={`w-auto min-w-[110px] px-2 py-1.5 rounded-lg text-xs outline-none focus:ring-2 border transition-all ${
                                                                        (() => {
                                                                            const valUpper = typeof val === 'string' ? val.toUpperCase().trim() : '';
                                                                            const isGood = valUpper.includes('SIN ANOMAL') || valUpper.includes('SIN DEFECTO') || valUpper.includes('EN SERVICIO') || ((valUpper.includes('CORRECTO') || valUpper.includes('CONFORME')) && !valUpper.includes('NO CORRECTO') && !valUpper.includes('NO CONFORME'));
                                                                            if (isGood) {
                                                                                return 'bg-green-50 border-green-400 text-green-700 font-medium focus:border-green-500 focus:ring-green-500/20';
                                                                            }
                                                                            const isBad = valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || (valUpper.includes('ANOMAL') && !valUpper.includes('SIN ANOMAL')) || valUpper.includes('PENDIENTE') || (valUpper.includes('DEFECTO') && !valUpper.includes('SIN DEFECTO')) || valUpper.includes('FALLO') || valUpper.includes('INOPERAT');
                                                                            if (isBad) {
                                                                                return 'bg-red-50 border-red-400 text-red-700 font-bold focus:border-red-500 focus:ring-red-500/20';
                                                                            }
                                                                            return 'bg-white border-slate-200 text-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20';
                                                                        })()
                                                                    }`}
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {opciones.map((opt: string, iOpt: number) => (
                                                                        <option key={iOpt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            );
                                                        })()
                                                    ) : isSeleccion ? (
                                                        (() => {
                                                            const opciones = (item as any).opciones || [];
                                                            return (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {opciones.map((opt: string, idxOpt: number) => {
                                                                        const isSelected = val === opt;
                                                                        return (
                                                                            <button
                                                                                key={idxOpt}
                                                                                type="button"
                                                                                onClick={() => handleCheckChange(eq.id, item.key, opt)}
                                                                                className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                                                                                    isSelected
                                                                                        ? (() => {
                                                                                            const optUpper = (opt || '').toUpperCase().trim();
                                                                                            const isGood = optUpper.includes('SIN ANOMAL') || optUpper.includes('SIN DEFECTO') || optUpper.includes('EN SERVICIO') || ((optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) && !optUpper.includes('NO CORRECTO') && !optUpper.includes('NO CONFORME'));
                                                                                            if (isGood) return 'bg-green-600 text-white border-green-600 font-bold scale-105';
                                                                                            const isBad = optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO' || (optUpper.includes('ANOMAL') && !optUpper.includes('SIN ANOMAL')) || optUpper.includes('PENDIENTE') || (optUpper.includes('DEFECTO') && !optUpper.includes('SIN DEFECTO')) || optUpper.includes('FALLO') || optUpper.includes('INOPERAT');
                                                                                            if (isBad) return 'bg-red-600 text-white border-red-600 font-bold scale-105';
                                                                                            return 'bg-indigo-600 text-white border-indigo-600 font-bold scale-105';
                                                                                          })()
                                                                                        : (() => {
                                                                                            const optUpper = (opt || '').toUpperCase().trim();
                                                                                            const isGood = optUpper.includes('SIN ANOMAL') || optUpper.includes('SIN DEFECTO') || optUpper.includes('EN SERVICIO') || ((optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) && !optUpper.includes('NO CORRECTO') && !optUpper.includes('NO CONFORME'));
                                                                                            if (isGood) return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100/80';
                                                                                            const isBad = optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO' || (optUpper.includes('ANOMAL') && !optUpper.includes('SIN ANOMAL')) || optUpper.includes('PENDIENTE') || (optUpper.includes('DEFECTO') && !optUpper.includes('SIN DEFECTO')) || optUpper.includes('FALLO') || optUpper.includes('INOPERAT');
                                                                                            if (isBad) return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80';
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
                                                        <input
                                                            type="text"
                                                            value={typeof val === 'string' ? val : ''}
                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                            className={`w-full px-2 py-1.5 rounded-lg text-xs outline-none transition-colors ${esCampoUbicacion(item.label, item.key) && typeof val === 'string' && val.length > 40 ? 'bg-red-50 border-2 border-red-500 text-red-700 font-bold focus:border-red-600 focus:ring-2 focus:ring-red-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`}
                                                            placeholder="..."
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Respuestas verticales estándar
                                    if (tipo === 'check') {
                                        const isChecked = val === true || (typeof val === 'string' && val.toLowerCase() === 'true');
                                        const isUnchecked = val === false || (typeof val === 'string' && val.toLowerCase() === 'false');

                                        return (
                                            <div key={item.key} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                                                isUnchecked
                                                    ? 'bg-red-50/80 border-red-200 text-red-900 font-medium'
                                                    : isChecked
                                                    ? 'bg-green-50/50 border-green-200/60 text-slate-800'
                                                    : 'bg-white border-slate-200 text-slate-700'
                                            }`}>
                                                <span className="text-xs leading-tight pr-2 font-medium">{item.label}</span>
                                                <label className={`flex items-center gap-1 cursor-pointer shrink-0 select-none px-1.5 py-0.5 rounded text-xs ${
                                                    isUnchecked
                                                        ? 'text-red-600 font-bold bg-red-100/80'
                                                        : isChecked
                                                        ? 'text-green-700 font-bold bg-green-100/80'
                                                        : 'text-slate-600 hover:bg-slate-100'
                                                }`}>
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
                                                </label>
                                            </div>
                                        );
                                    }

                                    if (tipo === 'numero') {
                                        return (
                                            <div key={item.key} className="p-2 bg-white rounded-lg border border-slate-200">
                                                <label className="text-[11px] text-slate-500 font-medium block mb-1">{item.label}</label>
                                                <input
                                                    type="number"
                                                    value={typeof val === 'number' ? val : ''}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? Number(e.target.value) : '')}
                                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:bg-white focus:border-indigo-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                        );
                                    }

                                    if (tipo === 'fecha') {
                                        const labelLower = (item.label || '').toLowerCase();
                                        const isFechaRevision = labelLower.includes('fecha de revision') || labelLower.includes('fecha de revisión');
                                        const fechaVal = typeof val === 'string' && val 
                                            ? (isFechaRevision ? val.substring(0, 10) : val.substring(0, 7)) 
                                            : '';
                                        const hoyStr = new Date().toISOString().split('T')[0];
                                        const noEsHoy = isFechaRevision && fechaVal !== '' && fechaVal !== hoyStr;

                                        return (
                                            <div key={item.key} className="p-2 bg-white rounded-lg border border-slate-200">
                                                <label className="text-[11px] text-slate-500 font-medium block mb-1">{item.label}</label>
                                                <input
                                                    type={isFechaRevision ? 'date' : 'month'}
                                                    value={fechaVal}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? (isFechaRevision ? e.target.value : e.target.value + '-01') : '')}
                                                    className={`w-full px-2 py-1 border rounded text-xs outline-none transition-colors ${
                                                        noEsHoy
                                                            ? 'border-orange-400 bg-orange-50 text-orange-800 font-bold'
                                                            : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500'
                                                    }`}
                                                />
                                            </div>
                                        );
                                    }

                                    if (tipo === 'texto-largo') {
                                        return (
                                            <div key={item.key} className="col-span-full p-2 bg-white rounded-lg border border-slate-200">
                                                <label className="text-[11px] text-slate-500 font-medium block mb-1">{item.label}</label>
                                                <textarea
                                                    value={typeof val === 'string' ? val : ''}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:bg-white focus:border-indigo-500 resize-none"
                                                    rows={2}
                                                    placeholder="..."
                                                />
                                            </div>
                                        );
                                    }

                                    if (tipo === 'desplegable') {
                                        const opciones = (item as any).opciones || [];
                                        return (
                                            <div key={item.key} className="p-2 bg-white rounded-lg border border-slate-200">
                                                <label className="text-[11px] text-slate-500 font-medium block mb-1">{item.label}</label>
                                                <select
                                                    value={typeof val === 'string' ? val : ''}
                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                    className={`w-full px-2 py-1 border rounded text-xs outline-none transition-colors ${
                                                        (() => {
                                                            const valUpper = typeof val === 'string' ? val.toUpperCase().trim() : '';
                                                            const isGood = valUpper.includes('SIN ANOMAL') || valUpper.includes('SIN DEFECTO') || valUpper.includes('EN SERVICIO') || ((valUpper.includes('CORRECTO') || valUpper.includes('CONFORME')) && !valUpper.includes('NO CORRECTO') && !valUpper.includes('NO CONFORME'));
                                                            if (isGood) {
                                                                return 'bg-green-50 border-green-400 text-green-700 font-medium';
                                                            }
                                                            const isBad = valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || (valUpper.includes('ANOMAL') && !valUpper.includes('SIN ANOMAL')) || valUpper.includes('PENDIENTE') || (valUpper.includes('DEFECTO') && !valUpper.includes('SIN DEFECTO')) || valUpper.includes('FALLO') || valUpper.includes('INOPERAT');
                                                            if (isBad) {
                                                                return 'bg-red-50 border-red-400 text-red-700 font-bold';
                                                            }
                                                            return 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-indigo-500';
                                                        })()
                                                    }`}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {opciones.map((opt: string, iOpt: number) => (
                                                        <option key={iOpt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    }

                                    if (tipo === 'seleccion') {
                                        const opciones = (item as any).opciones || [];
                                        return (
                                            <div key={item.key} className="col-span-full p-2 bg-white rounded-lg border border-slate-200">
                                                <label className="text-[11px] text-slate-500 font-medium block mb-1.5">{item.label}</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {opciones.map((opt: string, idxOpt: number) => {
                                                        const isSelected = val === opt;
                                                        return (
                                                            <button
                                                                key={idxOpt}
                                                                type="button"
                                                                onClick={() => handleCheckChange(eq.id, item.key, opt)}
                                                                className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                                                                    isSelected
                                                                        ? (() => {
                                                                            const optUpper = (opt || '').toUpperCase().trim();
                                                                            if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO' || optUpper.includes('ANOMAL') || optUpper.includes('PENDIENTE') || optUpper.includes('DEFECTO') || optUpper.includes('FALLO') || optUpper.includes('INOPERAT')) return 'bg-red-600 text-white border-red-600 font-bold scale-105';
                                                                            if (optUpper.includes('CORRECTO') || optUpper.includes('CONFORME')) return 'bg-green-600 text-white border-green-600 font-bold scale-105';
                                                                            return 'bg-indigo-600 text-white border-indigo-600 font-bold scale-105';
                                                                          })()
                                                                        : (() => {
                                                                            const optUpper = (opt || '').toUpperCase().trim();
                                                                            if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO' || optUpper.includes('ANOMAL') || optUpper.includes('PENDIENTE') || optUpper.includes('DEFECTO') || optUpper.includes('FALLO') || optUpper.includes('INOPERAT')) return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80';
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

                                    // Campo texto genérico
                                    const esPropEstándar = esUbicacionMarcaModelo(item.label, item.key);
                                    return (
                                        <div key={item.key} className={`p-2 rounded-lg border ${esPropEstándar ? 'bg-indigo-50/40 border-indigo-150' : 'bg-white border-slate-200'}`}>
                                            <label className="text-[11px] text-slate-500 font-medium block mb-1">{item.label}</label>
                                            <input
                                                type="text"
                                                value={typeof val === 'string' ? val : ''}
                                                onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:bg-white focus:border-indigo-500"
                                                placeholder="..."
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Campos Independientes: Anomalías (ROJO) y Observaciones (AZUL) */}
                        {(() => {
                            const valAnom = eq.anomalias;
                            const esNoEncontrado = typeof valAnom === 'string' && valAnom.includes('no localizarse');
                            const tieneValorAnom = typeof valAnom === 'string' && valAnom.trim() !== '';
                            const isErrorAnom = esNoEncontrado || algunCheckRojo || tieneValorAnom;

                            const valObs = eq.observaciones;
                            const tieneValorObs = typeof valObs === 'string' && valObs.trim() !== '';

                            return (
                                <div className="px-4 mt-3 space-y-3">
                                    {/* 1. Campo de Anomalías (ROJO si tiene anomalías o fallos) */}
                                    <div>
                                        <label className={`text-xs font-semibold mb-1 block ${isErrorAnom ? 'text-red-700 font-bold' : 'text-slate-600'}`}>Anomalías del equipo:</label>
                                        <textarea
                                            value={typeof valAnom === 'string' ? valAnom : ''}
                                            onChange={(e) => handleCheckChange(eq.id, 'anomalias', e.target.value)}
                                            className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[70px] ${isErrorAnom ? 'bg-red-50 border-2 border-red-400 text-red-800 font-bold focus:border-red-500 focus:ring-red-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                                            rows={3}
                                            placeholder="Escribe aquí las anomalías..."
                                        />
                                    </div>

                                    {/* 2. Campo de Observaciones (AZUL si tiene texto) */}
                                    <div>
                                        <label className={`text-xs font-semibold mb-1 block ${tieneValorObs ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>Observaciones del equipo:</label>
                                        <textarea
                                            value={typeof valObs === 'string' ? valObs : ''}
                                            onChange={(e) => handleCheckChange(eq.id, 'observaciones', e.target.value)}
                                            className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 resize-y min-h-[70px] ${tieneValorObs ? 'bg-blue-50 border-2 border-blue-400 text-blue-800 font-bold focus:border-blue-500 focus:ring-blue-500/20' : 'bg-white border border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'}`}
                                            rows={3}
                                            placeholder="Escribe aquí las observaciones..."
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Galería de fotos */}
                        {(() => {
                            const currentFotos = Array.isArray((eq as any)['fotos']) 
                                ? (eq as any)['fotos'] 
                                : ((eq as any)['foto'] ? [(eq as any)['foto']] : []);
                            
                            return (
                                <div className="px-4 pb-4 mt-3 flex flex-wrap gap-3">
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
                                            if (parte?.estado === 'Planificado') {
                                                updateParte({ estado: 'Abierto' });
                                                const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                                                const parteActual = storedPartes.find((p: any) => p.id === parteId);
                                                const docId = parteActual?._docId || parteId;
                                                try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg text-xs transition-all shadow-sm ${eq.revisado ? 'bg-green-600 hover:bg-green-700 text-white font-bold shadow-md scale-105' : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 font-semibold'}`}
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
                                                    cleanedEq.anomalias = '';
                                                    
                                                    itemsToUse.forEach(item => {
                                                        const lbl = (item.label || '').toLowerCase();
                                                        const isNotas = lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                                                        
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
                                                                              <button
                                                                                  type="button"
                                                                                  onClick={() => {
                                                                                      if (handleCopiarEquipo) {
                                                                                          handleCopiarEquipo(eq);
                                                                                      }
                                                                                  }}
                                                                                  className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                                                                              >
                                                                                  Copiar nuevo equipo
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
