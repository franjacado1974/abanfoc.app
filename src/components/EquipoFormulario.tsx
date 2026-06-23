/**
 * EquipoFormulario.tsx
 * 
 * Muestra EXACTAMENTE los campos definidos en la plantilla
 * del Editor de Plantillas (Ajustes > Plantillas).
 * 
 * - Busca la plantilla por nombre EXACTO del sistema
 * - Renderiza únicamente los items de la plantilla
 * - Sin campos fijos: no muestra Orden, Tipo/Nombre ni Ubicación
 * - Foto solo visible en modo revisión
 * - Al guardar, persiste id, centroId, sistemaId y todos los campos de la plantilla
 */
import { useState, useEffect } from 'react';
import { X, Save, Camera, CheckCircle2, XCircle } from 'lucide-react';
import { getPlantillas, subscribeItemsDePlantilla, type ItemPlantilla } from '../plantillas';
import { uploadFile, subscribeSistemasCategorias } from '../firebase';
import type { EquipoInstalado } from '../Centros';

interface EquipoFormularioProps {
    equipo: Partial<EquipoInstalado> | null;
    sistemaId: string;
    sistemaNombre: string;
    centroId: string;
    parteId?: string;
    plantillaId?: string;
    onSave: (equipo: Partial<EquipoInstalado>) => Promise<void>;
    onCancel: () => void;
    isNew?: boolean;
    equiposExistentes?: EquipoInstalado[];
}

export default function EquipoFormulario({
    equipo,
    sistemaId,
    sistemaNombre,
    centroId,
    parteId,
    plantillaId: _plantillaId,
    onSave,
    onCancel,
    isNew = false,
    equiposExistentes = []
}: EquipoFormularioProps) {
    const [formData, setFormData] = useState<Partial<EquipoInstalado>>(equipo || {});
    const [plantillaItems, setPlantillaItems] = useState<ItemPlantilla[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [plantillaEncontradaNombre, setPlantillaEncontradaNombre] = useState<string | null>(null);
    const [tiposSistema, setTiposSistema] = useState<{ id: string; nombre: string }[]>([]);

    const modoRevision = !!parteId;

    // Cargar tipos del sistema actual
    useEffect(() => {
        const unsub = subscribeSistemasCategorias((categorias) => {
            const normalizarNombre = (nombre: string) =>
                nombre
                    .toLowerCase()
                    .trim()
                    .replace(/^sistema\s+/i, '')
                    .replace(/\s+/g, ' ')
                    .replace(/[áàäâ]/g, 'a')
                    .replace(/[éèëê]/g, 'e')
                    .replace(/[íìïî]/g, 'i')
                    .replace(/[óòöô]/g, 'o')
                    .replace(/[úùüû]/g, 'u');

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);
            
            const cat = categorias.find(c => {
                const nombreCatNorm = normalizarNombre(c.nombre);
                return nombreCatNorm === nombreSistemaNorm || nombreCatNorm.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(nombreCatNorm);
            });
            
            if (cat && cat.tipos) {
                setTiposSistema(cat.tipos);
            } else {
                setTiposSistema([]);
            }
        });
        return () => unsub();
    }, [sistemaNombre]);

    // Cargar items de la plantilla buscando por nombre EXACTO del sistema
    useEffect(() => {
        let unsub: (() => void) | undefined;

        const cargarPlantilla = async () => {
            try {
                setLoading(true);

                const plantillas = await getPlantillas();

                const normalizarNombre = (nombre: string) =>
                    nombre
                        .toLowerCase()
                        .trim()
                        .replace(/^sistema\s+/i, '')
                        .replace(/^check\s*list\s+/i, '')
                        .replace(/^checklist\s+/i, '')
                        .replace(/\s+/g, ' ')
                        .replace(/[áàäâ]/g, 'a')
                        .replace(/[éèëê]/g, 'e')
                        .replace(/[íìïî]/g, 'i')
                        .replace(/[óòöô]/g, 'o')
                        .replace(/[úùüû]/g, 'u');

                const nombreSistemaNorm = normalizarNombre(sistemaNombre);

                // Buscar la plantilla que coincida con el nombre del sistema con orden de prioridad
                // 1. Coincidencia exacta
                let plantillaEncontrada = plantillas.find(p => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    return nombrePlantillaNorm === nombreSistemaNorm;
                });

                // 2. Coincidencia por inclusión (si una contiene a la otra)
                if (!plantillaEncontrada) {
                    plantillaEncontrada = plantillas.find(p => {
                        const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                        return nombrePlantillaNorm.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(nombrePlantillaNorm);
                    });
                }

                // 3. Coincidencia por palabras compartidas
                if (!plantillaEncontrada) {
                    plantillaEncontrada = plantillas.find(p => {
                        const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                        const palabrasSistema = nombreSistemaNorm.split(' ').filter(w => w.length > 3);
                        const palabrasPlantilla = nombrePlantillaNorm.split(' ').filter(w => w.length > 3);
                        return palabrasSistema.some(ps => palabrasPlantilla.some(pp => ps === pp || pp.includes(ps) || ps.includes(pp)));
                    });
                }

                if (plantillaEncontrada) {
                    console.log(`✅ Plantilla encontrada: "${plantillaEncontrada.nombre}" (ID: ${plantillaEncontrada.id})`);
                    setPlantillaEncontradaNombre(plantillaEncontrada.nombre);
                    unsub = subscribeItemsDePlantilla(plantillaEncontrada.id, (items) => {
                        const ordenados = [...items].sort((a, b) => a.orden - b.orden);
                        setPlantillaItems(ordenados);
                        setLoading(false);
                    });
                } else {
                    console.warn(`⚠️ No se encontró plantilla para sistema: "${sistemaNombre}". Buscando coincidencias...`);
                    // Debug: mostrar plantillas disponibles
                    console.log('Plantillas disponibles:', plantillas.map(p => `"${p.nombre}"`).join(', '));
                    setPlantillaEncontradaNombre(null);
                    setPlantillaItems([]);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error cargando plantilla:', error);
                setPlantillaItems([]);
                setLoading(false);
            }
        };

        cargarPlantilla();

        return () => {
            if (unsub) unsub();
        };
    }, [sistemaNombre]);

    // Auto-generar código para equipos nuevos
    useEffect(() => {
        if (isNew && !equipo?.id) {
            const equiposDelSistema = equiposExistentes;
            let siguienteNumero = 1;
            
            // Buscar la clave dinámica de "Orden de lista" si existe
            const itemOrden = plantillaItems.find(it => it.label?.toLowerCase().trim() === 'orden de lista');
            const ordenKey = itemOrden?.key;

            if (equiposDelSistema.length > 0) {
                // Intentar buscar números ya sea por el campo "codigo" o por el campo dinámico "Orden de lista"
                const numeros = equiposDelSistema
                    .map(e => {
                        const val = ordenKey ? (e as any)[ordenKey] || e.codigo : e.codigo;
                        return parseInt(val || '0');
                    })
                    .filter(n => !isNaN(n));
                siguienteNumero = numeros.length > 0 ? Math.max(...numeros) + 1 : equiposDelSistema.length + 1;
            }
            
            const nextStr = siguienteNumero.toString().padStart(2, '0');
            
            setFormData(prev => {
                const newData = { ...prev, codigo: prev.codigo || nextStr };
                if (ordenKey && !(newData as any)[ordenKey]) {
                    (newData as any)[ordenKey] = nextStr;
                }
                return newData;
            });
        }
    }, [isNew, equipo?.id, equiposExistentes, plantillaItems]);

    // Inicializar formData con el equipo existente
    useEffect(() => {
        if (equipo) {
            setFormData(equipo);
        }
    }, [equipo]);

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const equipoToSave: Partial<EquipoInstalado> = {
                ...formData,
                centroId,
                sistemaId,
            };

            // Mapear campos dinámicos conocidos a propiedades fijas para que se vean en el listado
            plantillaItems.forEach(item => {
                const label = (item.label || '').toLowerCase().trim();
                const value = (formData as any)[item.key];
                
                if (value !== undefined && value !== null && value !== '') {
                    if (label === 'orden de lista' || label === 'orden') {
                        equipoToSave.codigo = String(value);
                    } else if (label.includes('nombre') || label.includes('tipo')) {
                        equipoToSave.nombre = String(value);
                    } else if (label.includes('ubicación') || label.includes('ubicacion')) {
                        equipoToSave.ubicacion = String(value);
                    }
                }
            });

            // Si es nuevo, generar ID
            if (isNew && !equipoToSave.id) {
                try {
                    equipoToSave.id = `EQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
                } catch {
                    equipoToSave.id = `EQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                }
            }

            await onSave(equipoToSave);
        } catch (error: any) {
            console.error('Error al guardar equipo:', error);
            alert('Error al guardar el equipo: ' + (error?.message || String(error)));
        } finally {
            setSaving(false);
        }
    };

    const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const thumbnail = await new Promise<Blob>((resolve, reject) => {
                const img = new window.Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const canvas = document.createElement('canvas');
                    const MAX = 640;
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > MAX) { h = Math.floor(h * MAX / w); w = MAX; } }
                    else { if (h > MAX) { w = Math.floor(w * MAX / h); h = MAX; } }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('canvas error')); return; }
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('blob error')), 'image/jpeg', 0.75);
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load error')); };
                img.src = url;
            });

            const thumbFile = new File([thumbnail], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const path = `equipos/${centroId}/${sistemaId}/${formData.id || 'temp'}/foto_${Date.now()}`;
            const url = await uploadFile(thumbFile, path);
            handleChange('foto', url);
        } catch (err) {
            console.error('Error al subir imagen:', err);
            alert('Error al subir la imagen');
        }
    };

    // ── Logica Avisos Extintores ──────────────────────────────────────────
    const isExtintor = sistemaNombre.toLowerCase().includes('extintor');
    const fabItem = isExtintor ? plantillaItems.find(i => i.label.toLowerCase().includes('fabricaci')) : null;
    const retItem = isExtintor ? plantillaItems.find(i => i.label.toLowerCase().includes('retimbre')) : null;
    const anoItem = isExtintor ? plantillaItems.find(i => i.label.toLowerCase().includes('anomal') || i.label.toLowerCase().includes('observacion')) : null;

    let caducado = false;
    let necesitaRetimbre = false;
    let seAproxima = false;
    let autoMsg = "";

    if (isExtintor && fabItem) {
        const valFab = formData[fabItem.key as keyof EquipoInstalado] as string;
        const valRet = retItem ? formData[retItem.key as keyof EquipoInstalado] as string : null;
        
        if (valFab) {
            const today = new Date();
            const dateFab = new Date(valFab);
            if (!isNaN(dateFab.getTime())) {
                const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
                
                if (monthsSinceFab >= 240) {
                    caducado = true;
                    autoMsg = "Extintor caducado + 20 años";
                } else {
                    let refDate = dateFab;
                    if (valRet) {
                        const dr = new Date(valRet);
                        if (!isNaN(dr.getTime())) refDate = dr;
                    }
                    const monthsSinceRef = (today.getFullYear() - refDate.getFullYear()) * 12 + today.getMonth() - refDate.getMonth();
                    
                    if (monthsSinceRef >= 60) {
                        necesitaRetimbre = true;
                        autoMsg = "Extintor necesita retimbre";
                    } else if (monthsSinceFab >= 237 || monthsSinceRef >= 57) {
                        seAproxima = true;
                        autoMsg = "Se aproxima caducidad o retimbrado del equipo";
                    }
                }
            }
        }
    }

    // Efecto para autocompletar anomalias de extintor
    useEffect(() => {
        if (!isExtintor || !anoItem) return;
        
        setFormData(prev => {
            const currentAno = (prev[anoItem.key as keyof EquipoInstalado] as string) || "";
            const autoMsgs = ["Extintor caducado + 20 años", "Extintor necesita retimbre", "Se aproxima caducidad o retimbrado del equipo"];
            
            const hasAnyOld = autoMsgs.some(m => currentAno.includes(m));
            if (!autoMsg && !hasAnyOld) return prev; // Nada que hacer
            
            let newVal = currentAno;
            if (autoMsg && currentAno.includes(autoMsg)) {
                // Ya tiene el mensaje correcto, comprobamos que no tenga otros viejos
                const otherMsgs = autoMsgs.filter(m => m !== autoMsg);
                if (!otherMsgs.some(m => currentAno.includes(m))) {
                    return prev;
                }
            }

            // Quitar mensajes viejos
            autoMsgs.forEach(m => { newVal = newVal.replace(m, '').trim(); });
            
            // Añadir el nuevo
            if (autoMsg) {
                newVal = (newVal + (newVal ? "\n" : "") + autoMsg).trim();
            }

            if (newVal === currentAno) return prev; // Sin cambios
            
            return { ...prev, [anoItem.key]: newVal };
        });
    }, [formData[fabItem?.key || ''], formData[retItem?.key || ''], autoMsg, isExtintor, anoItem?.key]);


    // ── Render de cada campo según tipoRespuesta ──────────────────────────

    const renderField = (item: ItemPlantilla) => {
        const value = formData[item.key as keyof EquipoInstalado];
        const tipo = item.tipoRespuesta || 'texto';
        const isErrorDate = (caducado || necesitaRetimbre || seAproxima) && (item.key === fabItem?.key || item.key === retItem?.key);
        const isAnoFieldWithMsg = isExtintor && item.key === anoItem?.key && typeof value === 'string' && value.trim() !== '';

        // Campos tipo "check" se muestran como checkboxes
        if (tipo === 'check') {
            const isChecked = value === true;
            const isUnchecked = value === false;
            
            return (
                <label
                    key={item.key}
                    className={`flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-lg transition-all select-none ${
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
                        onChange={(e) => handleChange(item.key, e.target.checked)}
                        className={`w-4 h-4 rounded cursor-pointer ${
                            isUnchecked
                                ? 'text-red-500 border-red-300 focus:ring-red-400'
                                : isChecked
                                ? 'text-green-500 border-green-300 focus:ring-green-400'
                                : 'text-slate-400 border-slate-300 focus:ring-slate-400'
                        }`}
                    />
                    {item.label}
                    {isChecked && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                    {isUnchecked && <XCircle className="w-4 h-4 text-red-400 ml-auto" />}
                </label>
            );
        }

        // Campos normales (texto, número, fecha, texto-largo, imagen)
        switch (tipo) {
            case 'seccion':
                return (
                    <div key={item.key} className="col-span-full border-b border-slate-200 pb-1.5 pt-4 mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{item.label}</span>
                    </div>
                );

            case 'numero':
                return (
                    <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <input
                            type="number"
                            value={typeof value === 'number' ? value : ''}
                            onChange={(e) => handleChange(item.key, e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="0"
                        />
                    </div>
                );

            case 'fecha': {
                const fechaVal = typeof value === 'string' && value ? value.substring(0, 7) : '';
                return (
                    <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <input
                            type="month"
                            value={fechaVal}
                            onChange={(e) => handleChange(item.key, e.target.value ? e.target.value + '-01' : '')}
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-colors ${
                                isErrorDate 
                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20' 
                                : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                        />
                    </div>
                );
            }

            case 'imagen': {
                const imgUrl = typeof (formData as any)[item.key] === 'string' ? (formData as any)[item.key] : '';
                const imgInputId = `img-field-${item.key}`;

                if (!modoRevision) {
                    return (
                        <div key={item.key} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                                <Camera className="w-4 h-4" /> Disponible en revisión
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <input type="file" accept="image/*" capture="environment" id={imgInputId}
                            className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const thumbnail = await new Promise<Blob>((resolve, reject) => {
                                        const img = new window.Image();
                                        const url = URL.createObjectURL(file);
                                        img.onload = () => {
                                            URL.revokeObjectURL(url);
                                            const canvas = document.createElement('canvas');
                                            const MAX = 640;
                                            let w = img.width, h = img.height;
                                            if (w > h) { if (w > MAX) { h = Math.floor(h * MAX / w); w = MAX; } }
                                            else { if (h > MAX) { w = Math.floor(w * MAX / h); h = MAX; } }
                                            canvas.width = w; canvas.height = h;
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) { reject(new Error('canvas error')); return; }
                                            ctx.drawImage(img, 0, 0, w, h);
                                            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('blob error')), 'image/jpeg', 0.75);
                                        };
                                        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load error')); };
                                        img.src = url;
                                    });
                                    const thumbFile = new File([thumbnail], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                    const path = `equipos/${centroId}/${sistemaId}/${formData.id || 'temp'}/${item.key}_${Date.now()}`;
                                    const uploadedUrl = await uploadFile(thumbFile, path);
                                    handleChange(item.key, uploadedUrl);
                                } catch (err) {
                                    console.error('Error subiendo imagen de campo:', err);
                                    alert('Error al subir la imagen');
                                }
                            }}
                        />
                        {imgUrl ? (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                <img src={imgUrl} alt={item.label} className="w-full h-full object-cover" />
                                <button onClick={() => handleChange(item.key, '')}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <label htmlFor={imgInputId}
                                className="flex items-center justify-center gap-2 px-3 py-4 border border-dashed border-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
                                <Camera className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs text-indigo-500 font-medium">Hacer foto</span>
                            </label>
                        )}
                    </div>
                );
            }

            case 'texto-largo':
                return (
                    <div key={item.key} className="flex flex-col gap-1 col-span-2">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <textarea
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 resize-none transition-colors ${
                                isAnoFieldWithMsg
                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20'
                                : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                            rows={4}
                            placeholder="..."
                        />
                    </div>
                );

            case 'desplegable': {
                const opciones = (item as any).opciones || [];
                return (
                    <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <select
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Selecciona...</option>
                            {opciones.map((opt: string, idx: number) => (
                                <option key={idx} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                );
            }

            case 'texto':
            default: {
                const labelLower = (item.label || '').toLowerCase().trim();
                const isTipoField = labelLower === 'tipo' || labelLower === 'tipo de equipo';
                
                if (isTipoField && tiposSistema.length > 0) {
                    return (
                        <div key={item.key} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                            <select
                                value={typeof value === 'string' ? value : ''}
                                onChange={(e) => handleChange(item.key, e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Selecciona un tipo...</option>
                                {tiposSistema.map(ts => (
                                    <option key={ts.id} value={ts.nombre}>{ts.nombre}</option>
                                ))}
                            </select>
                        </div>
                    );
                }

                return (
                    <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">{item.label}</label>
                        <input
                            type="text"
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-colors ${
                                isErrorDate || isAnoFieldWithMsg
                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20' 
                                : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20'
                            }`}
                            placeholder="..."
                        />
                    </div>
                );
            }
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
                    <p className="text-slate-500 text-sm font-medium mt-3">Cargando plantilla...</p>
                </div>
            </div>
        );
    }

    // ── Render principal ────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {isNew ? 'Nuevo Equipo' : 'Editar Equipo'}
                        </h2>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                            Sistema: {sistemaNombre}
                        </p>
                        {plantillaEncontradaNombre && (
                            <p className="text-xs text-emerald-600 font-medium mt-1">
                                Plantilla: {plantillaEncontradaNombre}
                            </p>
                        )}
                        {modoRevision && (
                            <p className="text-xs text-amber-600 font-medium mt-1">
                                Modo Revisión
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {plantillaItems.length === 0 ? (
                        /* Sin plantilla: campos mínimos */
                        <div className="space-y-4">
                            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                ⚠️ No se encontró una plantilla para este sistema. 
                                {'Crea una en Configuraciones > Plantillas con el nombre exacto: '}<strong>{sistemaNombre}</strong>
                            </p>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-600">Nombre / Tipo</label>
                                <input
                                    type="text"
                                    value={formData.nombre || ''}
                                    onChange={(e) => handleChange('nombre', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Nombre del equipo..."
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-600">Ubicación</label>
                                <input
                                    type="text"
                                    value={formData.ubicacion || ''}
                                    onChange={(e) => handleChange('ubicacion', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Ubicación..."
                                />
                            </div>
                        </div>
                    ) : (
                        /* ÚNICAMENTE los campos de la plantilla */
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {plantillaItems.map(item => renderField(item))}
                            </div>
                        </div>
                    )}

                    {/* Foto (solo modo revisión) */}
                    {modoRevision && (
                        <div className="border-t border-slate-200 pt-6 mt-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-4">Fotografía</h3>
                            <div className="flex items-center gap-4">
                                <input type="file" accept="image/*" capture="environment"
                                    onChange={handleUploadFoto} className="hidden" id="foto-upload" />
                                <label htmlFor="foto-upload"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer">
                                    <Camera className="w-4 h-4" /> Añadir foto
                                </label>
                                {(formData as any).foto && typeof (formData as any).foto === 'string' && (
                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                                        <img src={(formData as any).foto} alt="Foto" className="w-full h-full object-cover" />
                                        <button onClick={() => handleChange('foto', '')}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                    <button type="button" onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        disabled={saving}>
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar equipo
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}