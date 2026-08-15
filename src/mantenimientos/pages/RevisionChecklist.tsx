import SistemaExtintores from '../components/RevisionSistemas/SistemaExtintores';
import SistemaBies from '../components/RevisionSistemas/SistemaBies';
import SistemaDeteccion from '../components/RevisionSistemas/SistemaDeteccion';
import SistemaDeteccionAspiracion from '../components/RevisionSistemas/SistemaDeteccionAspiracion';
import SistemaDeteccionMonoxido from '../components/RevisionSistemas/SistemaDeteccionMonoxido';
import SistemaGenerico from '../components/RevisionSistemas/SistemaGenerico';
import SistemaSobrepresionPresurizacion from '../components/RevisionSistemas/SistemaSobrepresionPresurizacion';
import SistemaBombaElectrica from '../components/RevisionSistemas/SistemaBombaElectrica';
import SistemaBombaJockey from '../components/RevisionSistemas/SistemaBombaJockey';
import SistemaBombaDiesel from '../components/RevisionSistemas/SistemaBombaDiesel';
import SistemaAbastecimientoSalaBombas from '../components/RevisionSistemas/SistemaAbastecimientoSalaBombas';
import SistemaCasetas from '../components/RevisionSistemas/SistemaCasetas';
import SistemaExutorios from '../components/RevisionSistemas/SistemaExutorios';
import SistemaHidrantes from '../components/RevisionSistemas/SistemaHidrantes';
import SistemaPuertasRF from '../components/RevisionSistemas/SistemaPuertasRF';
import SistemaSprinklers from '../components/RevisionSistemas/SistemaSprinklers';
import SistemaExtincionGas from '../components/RevisionSistemas/SistemaExtincionGas';
import SistemaExtincionCampanaCocina from '../components/RevisionSistemas/SistemaExtincionCampanaCocina';
import SistemaFuenteAlimentacionAuxiliar from '../components/RevisionSistemas/SistemaFuenteAlimentacionAuxiliar';
import SistemaAlumbradoEmergencia from '../components/RevisionSistemas/SistemaAlumbradoEmergencia';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Layers, ChevronDown, ChevronUp, Plus, X, CheckCircle2, AlertTriangle, PenLine, RotateCcw, CheckCheck, Lock, MessageSquare, Unlock, Calendar, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { addEquipoInstalado, addAlbaran, updateCentro, subscribePartes, subscribeCentros, subscribeClientes, subscribeCentroSistemas, subscribeEquiposInstalados, subscribeArticulos, subscribeSistemasCategorias, generateNumeroMantenimiento, uploadFile, type Albaran, type ChecklistItem } from '../../recursos-compartidos/firebase/firebase';
import { updateEquipoInstalado } from '../services/revisionesService';
import { updateParte as updateParteFirestore } from '../services/partesService';
import { subscribePlantillas, subscribeItemsDePlantilla, type ItemPlantilla } from '../../recursos-compartidos/types/plantillas';
import { getParteOfflineBundle, updateParteOfflineData, getPendingSyncItems, markSyncItemDone, markSyncItemFailed, addPendingSyncItem } from '../../recursos-compartidos/services/offlineDB';
import type { Centro, Parte, Cliente, CentroSistema, EquipoInstalado } from '../../recursos-compartidos/types/models';
import ConfirmationModal from '../../recursos-compartidos/ConfirmationModal';
import { getIconForSistema } from '../../recursos-compartidos/services/sistemasUtils';
import EquipoFormulario from '../../recursos-compartidos/components/EquipoFormulario';

export function esFechaRevisionReciente(val: any, maxDias = 15): boolean {
    if (!val || typeof val !== 'string') return false;
    const str = val.trim();
    if (!str || str === '-') return false;
    let d: Date | null = null;
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
    } else {
        d = new Date(str);
    }
    if (!d || isNaN(d.getTime())) return false;
    const hoy = new Date();
    const hoyZero = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffTime = hoyZero.getTime() - dZero.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= maxDias;
}

export function tieneFechaInvalida(eq: any): boolean {
    if (!eq) return false;

    const nombreEq = (eq.nombre || '').toLowerCase();
    const claseEq = (eq.clase || '').toLowerCase();
    const tipoEq = (eq.tipo || '').toLowerCase();

    const tieneRetimbreKey = Object.keys(eq).some(k => k.toLowerCase().includes('retimbre'));
    const tieneHidraKey = Object.keys(eq).some(k => k.toLowerCase().includes('hidra') || k.toLowerCase().includes('pruebahidra'));

    const esExtintor = nombreEq.includes('extintor') || claseEq.includes('extintor') || tipoEq.includes('extintor') || tieneRetimbreKey;
    const esBie = nombreEq.includes('bie') || nombreEq.includes('boca') || claseEq.includes('bie') || claseEq.includes('boca') || tipoEq.includes('bie') || tipoEq.includes('boca') || (tieneHidraKey && !tieneRetimbreKey);

    // Si no es ninguno de los dos, no hay regla de fecha inválida estándar
    if (!esExtintor && !esBie) {
        return false;
    }

    // Encontrar claves
    let keyFab = '';
    let keyRet = '';
    let keyHidra = '';

    for (const k of Object.keys(eq)) {
        const kLower = k.toLowerCase();
        if (kLower.includes('revision') || kLower.includes('inspeccion') || kLower.includes('proxim')) {
            continue;
        }
        if (kLower.includes('fabricaci') || kLower.includes('fechafab') || kLower.includes('añofab') || kLower.includes('anofab')) {
            keyFab = k;
        } else if (kLower.includes('retimbre')) {
            keyRet = k;
        } else if (kLower.includes('hidra') || kLower.includes('prueba')) {
            keyHidra = k;
        }
    }

    const valFab = keyFab ? eq[keyFab] : null;
    const valRet = keyRet ? eq[keyRet] : null;
    const valHidra = keyHidra ? eq[keyHidra] : null;

    const parseDate = (val: any) => {
        if (typeof val !== 'string' || !val || val === '-') return null;
        const clean = val.trim();
        if (/^\d{4}-\d{2}(-\d{2})?$/.test(clean)) {
            const d = new Date(clean);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    };

    const dateFab = parseDate(valFab);
    const dateRet = parseDate(valRet);
    const dateHidra = parseDate(valHidra);

    const today = new Date();

    // 1. Lógica de Extintores
    if (esExtintor && dateFab) {
        const monthsSinceFab = (today.getFullYear() - dateFab.getFullYear()) * 12 + today.getMonth() - dateFab.getMonth();
        if (monthsSinceFab >= 240) {
            return true; // Caducado >= 20 años
        }

        // Retimbre
        let refDate = dateFab;
        if (dateRet) {
            refDate = dateRet;
        }
        const monthsSinceRef = (today.getFullYear() - refDate.getFullYear()) * 12 + today.getMonth() - refDate.getMonth();
        if (monthsSinceRef >= 60 || monthsSinceFab >= 237 || monthsSinceRef >= 57) {
            return true; // Necesita retimbre o se aproxima
        }
    }

    // 2. Lógica de BIEs
    if (esBie) {
        if (dateFab) {
            let diffYears = today.getFullYear() - dateFab.getFullYear();
            if (today.getMonth() < dateFab.getMonth() || (today.getMonth() === dateFab.getMonth() && today.getDate() < dateFab.getDate())) {
                diffYears--;
            }
            if (diffYears >= 20) {
                return true; // Caducado >= 20 años (BIE)
            }
        }

        if (dateHidra) {
            let diffYears = today.getFullYear() - dateHidra.getFullYear();
            if (today.getMonth() < dateHidra.getMonth() || (today.getMonth() === dateHidra.getMonth() && today.getDate() < dateHidra.getDate())) {
                diffYears--;
            }
            if (diffYears >= 5) {
                return true; // Necesita prueba hidráulica >= 5 años (BIE)
            }
        }
    }

    return false;
}

export function equipoTieneAnomalias(eq: any): boolean {
    if (!eq) return false;

    // 1. Campo .anomalias con texto
    if (eq.anomalias && typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '') {
        return true;
    }

    // 2. Nueva validación: Anomalía de fecha
    if (tieneFechaInvalida(eq)) {
        return true;
    }

    // 3. Revisar todas las propiedades de eq
    for (const k of Object.keys(eq)) {
        const kLower = k.toLowerCase();
        
        // Ignorar claves de metadatos conocidas
        if (
            kLower === 'id' ||
            kLower === 'centroid' ||
            kLower === 'sistemaid' ||
            kLower === 'codigo' ||
            kLower === 'nombre' ||
            kLower === 'ubicacion' ||
            kLower === 'revisable' ||
            kLower === 'revisado' ||
            kLower === 'placa' ||
            kLower === 'clase' ||
            kLower === 'fabricante' ||
            kLower === 'fechafabricacion' ||
            kLower === 'ultimoretimbre' ||
            kLower === 'pesocapacidad' ||
            kLower === 'longitud' ||
            kLower === 'pruebahidraulica' ||
            kLower === 'foto' ||
            kLower === 'createdat' ||
            kLower === 'updatedat' ||
            kLower === 'capacidad' ||
            kLower === 'peso' ||
            kLower === 'marca' ||
            kLower === 'modelo' ||
            kLower === 'tipo' ||
            kLower === 'preciounidad' ||
            kLower === 'precio' ||
            kLower === 'subtotal' ||
            kLower === 'cantidad' ||
            kLower === 'anomalias' ||
            kLower === 'ordendelista' ||
            kLower === 'ordenlista' ||
            kLower === 'fecharevision' ||
            kLower === 'fechaderevision'
        ) {
            continue;
        }

        const val = eq[k];

        // 3. Cualquier campo de notas/observaciones/anomalía con texto
        if (kLower.includes('nota') || kLower.includes('observaci') || kLower.includes('anomal')) {
            if (typeof val === 'string' && val.trim() !== '') {
                return true;
            }
            continue;
        }

        // 4. Si el valor es boolean false o string 'false'
        if (val === false || val === 'false') {
            return true;
        }

        // 5. Si el valor es una cadena que representa un estado negativo
        if (typeof val === 'string') {
            const valUpper = val.toUpperCase().trim();
            if (
                valUpper === 'NO CORRECTO' ||
                valUpper.includes('NO CORRECTO') ||
                valUpper === 'INCORRECTO'
            ) {
                return true;
            }
        }
    }

    return false;
}

/* ============================================================================
 * BLINDAJE CRÍTICO (AGENTS.md REGLA 9): NO MODIFICAR ESTA FUNCIÓN
 * Preserva espacios (tecla Espacio) y saltos de línea (tecla Enter) manuales.
 * Queda PROHIBIDO usar .map(l => l.trim()).filter(Boolean) en la división inicial.
 * ============================================================================ */
export function evaluarAnomaliasPorFecha(eq: any, sistema?: any): string {
    let rawAnom = typeof eq?.anomalias === 'string' ? eq.anomalias : '';
    
    // Capturar saltos de línea al final producidos al pulsar Enter en la textarea
    const matchEndNewlines = rawAnom.match(/[\r\n]+$/);
    const endNewlines = matchEndNewlines ? matchEndNewlines[0] : '';

    let lineas = rawAnom.split(/\r?\n/);

    const sistTipo = ((sistema?.tipo || sistema?.familia || '') + ' ' + (eq?.nombre || '') + ' ' + (eq?.tipo || '')).toLowerCase();
    const isExtintor = sistTipo.includes('extintor');
    const isBie = sistTipo.includes('bie') || sistTipo.includes('boca');

    const today = new Date();

    let caducado20 = false;
    const fabStr = eq?.fechaFabricacion || eq?.fabricacion || eq?.item_fab || eq?.fecha_fabricacion || '';
    if (fabStr) {
        const dFab = new Date(fabStr);
        if (!isNaN(dFab.getTime())) {
            let diffYears = today.getFullYear() - dFab.getFullYear();
            if (today.getMonth() < dFab.getMonth() || (today.getMonth() === dFab.getMonth() && today.getDate() < dFab.getDate())) {
                diffYears--;
            }
            if (diffYears >= 20) caducado20 = true;
        }
    }

    let retimbre5 = false;
    const retStr = eq?.ultimoRetimbre || eq?.pruebaHidraulica || eq?.retimbre || eq?.item_ret || '';
    if (retStr) {
        const dRet = new Date(retStr);
        if (!isNaN(dRet.getTime())) {
            let diffYears = today.getFullYear() - dRet.getFullYear();
            if (today.getMonth() < dRet.getMonth() || (today.getMonth() === dRet.getMonth() && today.getDate() < dRet.getDate())) {
                diffYears--;
            }
            if (diffYears >= 5) retimbre5 = true;
        }
    }

    // Limpiar alertas de fecha previas conservando textos y espacios manuales
    lineas = lineas.filter((l: string) => {
        const trimmed = l.trim();
        return (
            !trimmed.includes("Extintor caducado") &&
            !trimmed.includes("Extintor necesita retimbr") &&
            !trimmed.includes("Extintor necesita retimbre") &&
            !trimmed.includes("Se aproxima caducidad") &&
            !trimmed.includes("Equipo caducado") &&
            !trimmed.includes("BIE caducado") &&
            !trimmed.includes("BIE necesita realizar prueba")
        );
    });

    if (isExtintor) {
        if (caducado20 && !lineas.some((l: string) => l.includes("caducado + de 20 años"))) lineas.push("- Extintor caducado + de 20 años, se debe sustituir por equipo nuevo.");
        if (retimbre5 && !lineas.some((l: string) => l.includes("retimbrado obligatorio")))  lineas.push("- Extintor necesita retimbrado obligatorio de los 5 años.");
    } else if (isBie) {
        if (caducado20 && !lineas.some((l: string) => l.includes("caducado + de 20 años"))) lineas.push("- BIE caducado + de 20 años, se debe sustituir tramo de manguera según normativa.");
        if (retimbre5 && !lineas.some((l: string) => l.includes("prueba hidráulica")))  lineas.push("- BIE necesita realizar prueba hidráulica obligatoria cada 5 años.");
    } else {
        if (caducado20 && !lineas.some((l: string) => l.includes("caducado + de 20 años"))) lineas.push("- Equipo caducado + de 20 años, se debe sustituir por equipo nuevo.");
        if (retimbre5 && !lineas.some((l: string) => l.includes("retimbrado obligatorio")))  lineas.push("- Equipo necesita retimbrado obligatorio de los 5 años.");
    }

    const resultadoBase = lineas.join('\n');
    if (endNewlines && !resultadoBase.endsWith(endNewlines)) {
        return resultadoBase + endNewlines;
    }
    return resultadoBase;
}

export default function RevisionChecklist() {
    const navigate = useNavigate();
    const location = useLocation();
    const { centroId, parteId } = location.state || {};

    const loggedUser = (() => {
        try {
            const session = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
            return session ? JSON.parse(session) : null;
        } catch { return null; }
    })();
    const userRole = (loggedUser?.rol || '').toLowerCase().trim();
    const isAdminOrSuper = userRole === 'administrador' || userRole === 'super-administrador' || userRole === 'superadministrador' || userRole === 'admin';
    const isTecnico = userRole === 'tecnico' || !isAdminOrSuper;

    const [centro, setCentro] = useState<Centro | null>(null);
    const [parte, setParte] = useState<Parte | null>(null);

    const hasComments = Boolean(
        (parte?.comentariosPrivados && parte.comentariosPrivados.trim().length > 0) ||
        (centro?.comentariosTecnico && centro.comentariosTecnico.trim().length > 0) ||
        ((parte as any)?.comentarios && (parte as any).comentarios.trim().length > 0)
    );
    const [showCommentsModal, setShowCommentsModal] = useState(false);
    const [privateComment, setPrivateComment] = useState('');
    const [publicComment, setPublicComment] = useState('');
    const [sistemasDelCentro, setSistemasDelCentro] = useState<CentroSistema[]>([]);
    const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>([]);
    const [, setEquiposCatalogo] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_equipos') || '[]'));
    const [categoriasSistema, setCategoriasSistema] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]'));
    const [loading, setLoading] = useState(true);
    const [clientes, setClientes] = useState<Cliente[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
    const [openSistemas, setOpenSistemas] = useState<Record<string, boolean>>({});
    const [tecnicos] = useState<{ id: string; nombre: string; apellidos: string }[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
        } catch { return []; }
    });
    // Orden personalizado de sistemas (guardado en localStorage)
    const [sistemaOrden, setSistemaOrden] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('firecheck_revision_sistema_orden');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    // Checklist dinámico desde Firestore (usando plantillas) - mapa por sistemaId
    const [checklistItemsPorSistema, setChecklistItemsPorSistema] = useState<Record<string, ChecklistItem[]>>({});
    const [plantillas, setPlantillas] = useState<any[]>([]);

    // Cargar todas las plantillas
    useEffect(() => {
        const unsub = subscribePlantillas((lista) => {
            setPlantillas(lista);
        });
        return () => unsub();
    }, []);

    // Cuando cambian los sistemas del centro o las plantillas, cargar los items de cada sistema
    useEffect(() => {
        if (sistemasDelCentro.length === 0 || plantillas.length === 0 || categoriasSistema.length === 0) return;

        console.log("=== RevisionChecklist: loading templates ===");
        console.log("sistemasDelCentro:", sistemasDelCentro);
        console.log("plantillas:", plantillas.map(p => p.nombre));
        console.log("categoriasSistema:", categoriasSistema.map(c => c.nombre));

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

        const unsubs: (() => void)[] = [];

        sistemasDelCentro.forEach(sist => {
            // Obtener el nombre del sistema desde categoriasSistema
            const sistemaCat = categoriasSistema.find(c => {
                const nombreSist = (sist.tipo || sist.familia || '').toLowerCase().trim();
                const nombreCat = (c.nombre || '').toLowerCase().trim();
                const isCocinaA = nombreSist.includes('cocina') || nombreSist.includes('campana');
                const isCocinaB = nombreCat.includes('cocina') || nombreCat.includes('campana');
                if (isCocinaA || isCocinaB) return isCocinaA && isCocinaB;
                const isGasA = (nombreSist.includes('gas') || (nombreSist.includes('extinci') && !nombreSist.includes('extintor'))) && !isCocinaA;
                const isGasB = (nombreCat.includes('gas') || (nombreCat.includes('extinci') && !nombreCat.includes('extintor'))) && !isCocinaB;
                if (isGasA || isGasB) return isGasA && isGasB;
                return nombreCat === nombreSist || nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
            });
            const sistemaNombre = sistemaCat?.nombre || sist.tipo || sist.familia || '';
            if (!sistemaNombre) {
                console.warn(`⚠️ Sistema sin nombre para sist.id: ${sist.id}`);
                return;
            }

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);

            // Buscar la plantilla que coincida con el nombre del sistema con orden de prioridad
            // 1. Coincidencia exacta
            let plantilla = plantillas.find(p => {
                const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                return nombrePlantillaNorm === nombreSistemaNorm;
            });

            // 2. Coincidencia por inclusión (si una contiene a la otra)
            if (!plantilla) {
                plantilla = plantillas.find(p => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    return nombrePlantillaNorm.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(nombrePlantillaNorm);
                });
            }

            // 3. Coincidencia por palabras compartidas
            if (!plantilla) {
                plantilla = plantillas.find(p => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    const palabrasSistema = nombreSistemaNorm.split(' ').filter(w => w.length > 3);
                    const palabrasPlantilla = nombrePlantillaNorm.split(' ').filter(w => w.length > 3);
                    return palabrasSistema.some(ps => palabrasPlantilla.some(pp => ps === pp || pp.includes(ps) || ps.includes(pp)));
                });
            }

            if (!plantilla) {
                console.warn(`❌ No se encontró plantilla para sistema: "${sistemaNombre}" (sist.id: ${sist.id})`);
                return;
            }

            console.log(`✅ Coincidencia: sistema "${sistemaNombre}" (sist.id: ${sist.id}) -> Plantilla "${plantilla.nombre}" (plantilla.id: ${plantilla.id})`);

            const unsub = subscribeItemsDePlantilla(plantilla.id, (items: ItemPlantilla[]) => {
                console.log(`📋 Cargados ${items.length} items de plantilla "${plantilla.nombre}" para sist.id: ${sist.id}`);
                const checklistItems: ChecklistItem[] = items.map(item => ({
                    id: item.id,
                    key: item.key,
                    label: item.label,
                    tipoRespuesta: item.tipoRespuesta,
                    opciones: item.opciones || [],
                    filasInicio: item.filasInicio,
                    sistemaId: sist.id,
                    sistemaNombre: sistemaNombre,
                    orden: item.orden,
                    horizontal: item.horizontal === true,
                }));
                setChecklistItemsPorSistema(prev => {
                    console.log(`💾 Actualizando checklistItemsPorSistema para ${sist.id}:`, checklistItems);
                    return { ...prev, [sist.id]: checklistItems };
                });
            });
            unsubs.push(unsub);
        });

        return () => unsubs.forEach(u => u());
    }, [sistemasDelCentro, plantillas, categoriasSistema]);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [equipoIdToDelete, setEquipoIdToDelete] = useState<string | null>(null);

    // Modal Revisar todo
    const [revisarTodoConfirm, setRevisarTodoConfirm] = useState<{ isOpen: boolean; sistemaId: string | null }>({ isOpen: false, sistemaId: null });

    // Estado para modal de edición de equipo
    const [editEquipo, setEditEquipo] = useState<string | null>(null);

    // Estado para modal de añadir equipo
    const [addEquipo, setAddEquipo] = useState<{ isOpen: boolean; sistemaId: string | null; codigo: string; nombre: string; ubicacion: string; placa: string; fechaFabricacion: string; ultimoRetimbre: string }>({
        isOpen: false, sistemaId: null, codigo: '', nombre: '', ubicacion: '', placa: '', fechaFabricacion: '', ultimoRetimbre: ''
    });

    // Estados para pre-cierre y firmas
    const [showEquiposSinRevisarModal, setShowEquiposSinRevisarModal] = useState(false);
    const [pendingEquiposCount, setPendingEquiposCount] = useState(0);
    const [showEquiposFechaInvalidaModal, setShowEquiposFechaInvalidaModal] = useState(false);
    const [equiposFechaInvalidaCount, setEquiposFechaInvalidaCount] = useState(0);
    const [showPreguntaRetimbrarModal, setShowPreguntaRetimbrarModal] = useState(false);
    const [seRetiranEquipos, setSeRetiranEquipos] = useState(false);
    const [showAvisoRetimbrarModal, setShowAvisoRetimbrarModal] = useState(false);
    const [showPreCierreModal, setShowPreCierreModal] = useState(false);
    const [showFirmasModal, setShowFirmasModal] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendProgress, setSendProgress] = useState(0);
    const [sendCompleted, setSendCompleted] = useState(false);
    const canvasClienteRef = useRef<HTMLCanvasElement>(null);
    const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);
    const [drawingCliente, setDrawingCliente] = useState(false);
    const [drawingTecnico, setDrawingTecnico] = useState(false);
    const [firmaClienteOk, setFirmaClienteOk] = useState(false);
    const [firmaTecnicoOk, setFirmaTecnicoOk] = useState(false);
    const [nombreClienteFirma, setNombreClienteFirma] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // ── GESTOR DE SINCRONIZACIÓN INTELIGENTE CON DEBOUNCE POR EQUIPO Y LOCAL-FIRST ─────────
    const syncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const pendingEquiposRef = useRef<Map<string, EquipoInstalado>>(new Map());
    const inFlightSyncRef = useRef<Set<string>>(new Set());
    const lastActiveEquipoIdRef = useRef<string | null>(null);
    const [eqSyncStates, setEqSyncStates] = useState<Record<string, 'saving' | 'saved' | 'offline'>>({});

    const getEquipoSyncStatus = (eqId: string): 'saving' | 'saved' | 'offline' => {
        return eqSyncStates[eqId] || 'saved';
    };

    // Sincroniza inmediatamente un equipo específico en Firestore
    const flushEquipoSync = async (eqId: string) => {
        if (syncTimersRef.current[eqId]) {
            clearTimeout(syncTimersRef.current[eqId]);
            delete syncTimersRef.current[eqId];
        }
        const eqToSync = pendingEquiposRef.current.get(eqId);
        if (eqToSync) {
            inFlightSyncRef.current.add(eqId);
            setEqSyncStates(prev => ({ ...prev, [eqId]: 'saving' }));
            try {
                const targetCentroId = eqToSync.centroId || centroId;
                const targetSistemaId = eqToSync.sistemaId;
                await updateEquipoInstalado(eqId, eqToSync as any, targetCentroId, targetSistemaId);
                // Solo después de que Firestore confirme la escritura, limpiamos si no se introdujeron nuevos cambios
                if (pendingEquiposRef.current.get(eqId) === eqToSync) {
                    pendingEquiposRef.current.delete(eqId);
                }
                inFlightSyncRef.current.delete(eqId);
                if (lastActiveEquipoIdRef.current === eqId) {
                    lastActiveEquipoIdRef.current = null;
                }
                setEqSyncStates(prev => ({ ...prev, [eqId]: 'saved' }));
            } catch (err) {
                console.error('Error sincronizando equipo en Firestore:', err);
                inFlightSyncRef.current.delete(eqId);
                if (lastActiveEquipoIdRef.current === eqId) {
                    lastActiveEquipoIdRef.current = null;
                }
                setEqSyncStates(prev => ({ ...prev, [eqId]: 'offline' }));
            }
        } else {
            if (lastActiveEquipoIdRef.current === eqId) {
                lastActiveEquipoIdRef.current = null;
            }
        }
    };

    // Sincroniza inmediatamente TODOS los equipos con cambios pendientes
    const flushAllPendingSync = async () => {
        const pendingIds = Array.from(pendingEquiposRef.current.keys());
        if (pendingIds.length === 0) return;
        for (const eqId of pendingIds) {
            await flushEquipoSync(eqId);
        }
    };

    const [isOnlineState, setIsOnlineState] = useState(navigator.onLine);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [isSyncingFullParte, setIsSyncingFullParte] = useState(false);
    const [syncStatusText, setSyncStatusText] = useState<'synced' | 'pending' | 'syncing' | 'error'>('synced');

    // Carga de ultra-baja latencia desde IndexedDB (0 pantallas en blanco)
    useEffect(() => {
        if (!parteId) return;
        const loadLocalBundle = async () => {
            try {
                const bundle = await getParteOfflineBundle(parteId);
                if (bundle) {
                    if (bundle.centro) setCentro(bundle.centro);
                    if (bundle.cliente) setClientes([bundle.cliente]);
                    if (bundle.parte) setParte(bundle.parte);
                    if (bundle.sistemasDelCentro && bundle.sistemasDelCentro.length > 0) {
                        setSistemasDelCentro(bundle.sistemasDelCentro);
                        setOpenSistemas(prev => {
                            const next = { ...prev };
                            bundle.sistemasDelCentro.forEach((s: any) => { if (!(s.id in next)) next[s.id] = false; });
                            return next;
                        });
                    }
                    if (bundle.equiposInstalados && bundle.equiposInstalados.length > 0) {
                        setEquiposInstalados(bundle.equiposInstalados);
                    }
                    setLoading(false);
                }

                const pending = await getPendingSyncItems(parteId);
                setPendingSyncCount(pending.length);
                if (pending.length > 0) setSyncStatusText('pending');
            } catch (err) {
                console.warn('[OfflineDB] Error cargando bundle local:', err);
            }
        };

        loadLocalBundle();
    }, [parteId]);

    // Función de Sincronización Transaccional por Bloques (Idempotente y en segundo plano)
    const handleSincronizarParteCompleto = async () => {
        if (!parteId) return;
        setIsSyncingFullParte(true);
        setSyncStatusText('syncing');

        try {
            const pendingItems = await getPendingSyncItems(parteId);
            if (pendingItems.length === 0) {
                setSyncStatusText('synced');
                setPendingSyncCount(0);
                showToast('✅ El parte está 100% sincronizado.');
                setIsSyncingFullParte(false);
                return;
            }

            let successCount = 0;

            for (const item of pendingItems) {
                try {
                    if (item.blockType === 'equipo') {
                        const payloadToSync = { ...item.payload };
                        // Convertir y subir cualquier URL de Blob local a Firebase Storage
                        for (const [key, val] of Object.entries(payloadToSync)) {
                            if (typeof val === 'string' && val.startsWith('blob:')) {
                                try {
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                                    const res = await fetch(val, { signal: controller.signal });
                                    clearTimeout(timeoutId);
                                    const blobData = await res.blob();
                                    const fileObj = new File([blobData], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                    const storagePath = `equipos/${centroId}/${payloadToSync.sistemaId || 'sist'}/${item.blockId}/${key}_${Date.now()}`;
                                    const uploadedUrl = await uploadFile(fileObj, storagePath);
                                    payloadToSync[key] = uploadedUrl;
                                } catch (photoErr) {
                                    console.warn(`[SyncBlob] Error subiendo foto blob en ${key}:`, photoErr);
                                }
                            }
                        }
                        await updateEquipoInstalado(item.blockId, payloadToSync);
                    } else if (item.blockType === 'parte') {
                        const docId = (parte as any)?._docId || parte?.id;
                        if (docId) {
                            await updateParteFirestore(docId, item.payload);
                        }
                    }
                    await markSyncItemDone(item.sync_item_uuid);
                    successCount++;
                } catch (err: any) {
                    console.warn(`[SyncBlock] Error en bloque transaccional ${item.sync_item_uuid}:`, err);
                    await markSyncItemFailed(item.sync_item_uuid, err?.message || 'Error de red');
                }
            }

            const remaining = await getPendingSyncItems(parteId);
            setPendingSyncCount(remaining.length);

            if (remaining.length === 0) {
                await updateParteOfflineData(parteId, { syncStatus: 'synced' });
                setSyncStatusText('synced');
                showToast('✅ Sincronización completada con éxito.');
            } else {
                setSyncStatusText('error');
                showToast(`⚠️ Sincronizados ${successCount} bloques. Quedan ${remaining.length} guardados localmente para reintento.`);
            }
        } catch (err) {
            console.error('Error sincronizando parte completo:', err);
            setSyncStatusText('error');
            showToast('⚠️ Sin red. Todos los cambios continúan guardados localmente.');
        } finally {
            setIsSyncingFullParte(false);
        }
    };

    // Escuchar eventos de red y reintentos automáticos
    useEffect(() => {
        const handleOnlineStatus = () => {
            setIsOnlineState(true);
            handleSincronizarParteCompleto();
        };
        const handleOfflineStatus = () => {
            setIsOnlineState(false);
        };

        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);

        // Si el dispositivo está online con WiFi al entrar, sincronizar cola de bloques en segundo plano
        if (navigator.onLine && parteId) {
            handleSincronizarParteCompleto();
        }

        return () => {
            window.removeEventListener('online', handleOnlineStatus);
            window.removeEventListener('offline', handleOfflineStatus);
        };
    }, [parteId]);

    // Función para mostrar el toast temporalmente
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // ── Función para Re-abrir Parte Cerrado ───────────────────────────
    const handleReabrirParte = async () => {
        if (!confirm('¿Estás seguro de que quieres re-abrir este parte de trabajo? El técnico podrá volver a editarlo.')) return;
        await flushAllPendingSync();
        try {
            const docId = (parte as any)?._docId || parte?.id;
            if (docId) {
                await updateParteFirestore(docId, { estado: 'Abierto' });
                updateParte({ estado: 'Abierto' });
                showToast('Parte re-abierto correctamente');
            }
        } catch (err) {
            console.error('Error re-abriendo parte:', err);
            alert('No se pudo re-abrir el parte de trabajo.');
        }
    };

    // ── Función para Cerrar Parte Definitivamente ─────────────────────
    const handleCerrarParte = async () => {
        if (!confirm('¿Estás seguro de que deseas CERRAR definitivamente este parte? Pasará a ser de solo lectura y ya no aparecerá en el dispositivo del técnico.')) return;
        await flushAllPendingSync();
        try {
            const docId = (parte as any)?._docId || parte?.id;
            if (docId) {
                await updateParteFirestore(docId, { estado: 'Cerrado' });
                updateParte({ estado: 'Cerrado' });
                showToast('Parte cerrado correctamente');
            }
        } catch (err) {
            console.error('Error cerrando parte:', err);
            alert('No se pudo cerrar el parte de trabajo.');
        }
    };

    // ── Función para Pre-Cerrar Parte desde Escritorio (Luz Verde) ───
    const handlePreCerrarParte = async () => {
        if (!confirm('¿Deseas cambiar el estado de este parte a Pre-cerrado?')) return;
        await flushAllPendingSync();
        try {
            const docId = (parte as any)?._docId || parte?.id;
            if (docId) {
                await updateParteFirestore(docId, { estado: 'Pre-Cerrado' });
                updateParte({ estado: 'Pre-Cerrado' });
                showToast('Parte en estado Pre-cerrado');
            }
        } catch (err) {
            console.error('Error pre-cerrando parte:', err);
            alert('No se pudo cambiar el estado a Pre-cerrado.');
        }
    };

    // ── Carga inicial desde Firestore ──────────────────────────────────────────
    useEffect(() => {
        if (!centroId || !parteId) {
            alert('Faltan datos para iniciar la revisión.');
            navigate(-1);
            return;
        }

    // 1. Cargar clientes
    const unsubClientes = subscribeClientes((items) => {
            setClientes(items as Cliente[]);
            localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
        });

        // 2. Cargar centros y encontrar el centro actual
        const unsubCentros = subscribeCentros((items) => {
            const found = items.find((c: any) => c.id === centroId || c._docId === centroId) as Centro | undefined;
            if (found) setCentro(found);
            localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
        });

        // 3. Cargar partes y encontrar el parte actual
        const unsubPartes = subscribePartes((items) => {
            const found = items.find((p: any) => p.id === parteId || p._docId === parteId) as Parte | undefined;
            if (found) {
                setParte(found);
                if (parteId) {
                    updateParteOfflineData(parteId, { parte: found }).catch(() => {});
                }
            }
            localStorage.setItem('firecheck_db_partes', JSON.stringify(items));
            setLoading(false);
        });

        // 4. Cargar sistemas del centro
        const unsubSistemas = subscribeCentroSistemas(centroId, (items: CentroSistema[]) => {
            setSistemasDelCentro(items);
            // Inicializar acordeones cerrados
            setOpenSistemas(prev => {
                const next = { ...prev };
                items.forEach(s => { if (!(s.id in next)) next[s.id] = false; });
                return next;
            });
            localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(items));
        });

        // 5. Cargar categorías de sistemas (catálogo) para el autocompletado
        const unsubSst = subscribeSistemasCategorias((items) => {
            setCategoriasSistema(items);
            localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(items));
        });

        // 6. Cargar artículos (catálogo de equipos) para el autocompletado
        const unsubArt = subscribeArticulos((items) => {
            const revisables = items.filter(a => a.revisable === true);
            setEquiposCatalogo(revisables);
            localStorage.setItem('firecheck_db_sistemas_equipos', JSON.stringify(revisables));
        });

        return () => {
            unsubClientes(); unsubCentros(); unsubPartes(); unsubSistemas();
            unsubSst(); unsubArt();
        };
    }, [centroId, parteId, navigate]);

// Generar numeroMantenimiento si no existe
    useEffect(() => {
        if (parte && !parte.numeroMantenimiento) {
            generateNumeroMantenimiento().then(num => {
                handleParteChange({ numeroMantenimiento: num });
            }).catch(console.error);
        }
    }, [parte?.id, parte?.numeroMantenimiento]); // eslint-disable-line react-hooks/exhaustive-deps

    // 5. Cargar equipos de cada sistema en tiempo real con Fusión Inteligente
    useEffect(() => {
        if (!centroId || sistemasDelCentro.length === 0) return;

        const unsubs = sistemasDelCentro.map(sist =>
            subscribeEquiposInstalados(centroId, sist.id, (items: EquipoInstalado[]) => {
                // Evaluar anomalías de fecha automáticamente para cada equipo en tiempo real
                const itemsEvaluados = items.map(item => {
                    const anoActualizada = evaluarAnomaliasPorFecha(item, sist);
                    if (anoActualizada !== item.anomalias) {
                        return { ...item, anomalias: anoActualizada };
                    }
                    return item;
                });

                setEquiposInstalados(prev => {
                    const otrosSistemas = prev.filter(e => e.sistemaId !== sist.id);
                    const actualesEsteSistema = prev.filter(e => e.sistemaId === sist.id);

                    const itemsFusionados = itemsEvaluados.map(itemFromFirestore => {
                        const esPendienteLocal = pendingEquiposRef.current.has(itemFromFirestore.id);
                        const esEnVuelo = inFlightSyncRef.current.has(itemFromFirestore.id);
                        const equipoLocalActual = actualesEsteSistema.find(e => e.id === itemFromFirestore.id);

                        if ((esPendienteLocal || esEnVuelo) && equipoLocalActual) {
                            // Preservar estado local solo si hay un cambio en vuelo o guardándose
                            return equipoLocalActual;
                        }
                        return itemFromFirestore;
                    });

                    const resultEquipos = [...otrosSistemas, ...itemsFusionados];
                    if (parteId) {
                        updateParteOfflineData(parteId, { equiposInstalados: resultEquipos }).catch(() => {});
                    }
                    return resultEquipos;
                });
            })
        );
        return () => unsubs.forEach(u => u());
    }, [centroId, sistemasDelCentro.length, parte?.estado, parteId]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveEquiposProgress = async (currentEquipos: EquipoInstalado[] = equiposInstalados) => {
        await flushAllPendingSync();
        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const equiposOtrosCentros = allEquipos.filter((eq: EquipoInstalado) => eq.centroId !== centroId);
        const updatedAllEquipos = [...equiposOtrosCentros, ...currentEquipos];
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAllEquipos));
        // Sincronizar con Firestore
        for (const eq of currentEquipos) {
            try { await updateEquipoInstalado(eq.id, eq as any); } catch (err) { console.error('Error sincronizando equipo en Firestore:', err); }
        }
        return updatedAllEquipos;
    };

    const updateParte = (changes: Partial<Parte>) => {
        if (!parteId) return;

        const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updatedPartes = storedPartes.map((p: Parte) =>
            p.id === parteId ? { ...p, ...changes } : p
        );
        const updatedParte = updatedPartes.find((p: Parte) => p.id === parteId);

        localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
        if (updatedParte) setParte(updatedParte);
    };

    const handleParteChange = async (changes: Partial<Parte>) => {
        updateParte(changes);
        try {
            const docId = (parte as any)?._docId || parte?.id;
            if (docId) {
                await updateParteFirestore(docId, changes);
            }
        } catch (err) {
            console.error('Error updating parte in Firestore:', err);
        }
    };

    const handleCheckChange = (equipoId: string, checkKey: string, value: boolean | string | number | string[], checkLabel?: string) => {
        setEquiposInstalados(prevEquipos => {
            const updatedEquipos = prevEquipos.map(eq => {
                if (eq.id !== equipoId) return eq;
                
                const itemsToUseForCheck = checklistItemsPorSistema[eq.sistemaId] || getItemsToUse(eq.sistemaId) || [];
                const resolvedLabelForCheck = checkLabel || itemsToUseForCheck.find(i => i.key === checkKey)?.label || null;

                const keyLower = checkKey.toLowerCase();
                const labelLower = (resolvedLabelForCheck || '').toLowerCase();
                const isUbicacionField = keyLower === 'ubicacion' || keyLower === 'cobertura' || keyLower.includes('ubicacion') || labelLower.includes('ubicacion') || labelLower.includes('cobertura') || labelLower.includes('nivel planta') || labelLower.includes('planta') || labelLower.includes('nivel');

                let finalVal = value;
                if (typeof value === 'string' && isUbicacionField) {
                    finalVal = value.toUpperCase();
                }

                // Actualizar el valor del check
                const updated = { ...eq, [checkKey]: finalVal, revisado: true };
                if (isUbicacionField && typeof finalVal === 'string') {
                    updated.ubicacion = finalVal;
                }
                
                // Sincronizar fechas y evaluar anomalías por fecha incondicionalmente
                const sistema = sistemasDelCentro.find(s => s.id === eq.sistemaId);
                const itemsToUseForDates = checklistItemsPorSistema[eq.sistemaId] || getItemsToUse(eq.sistemaId) || [];
                const fabItem = itemsToUseForDates.find(i => (i.label||'').toLowerCase().includes('fabricaci'));
                const retItem = itemsToUseForDates.find(i => {
                    const lbl = (i.label||'').toLowerCase();
                    return lbl.includes('retimbre') || lbl.includes('hidra') || lbl.includes('prueba');
                });

                if (fabItem && checkKey === fabItem.key) {
                    updated.fechaFabricacion = value ? String(value) : '';
                }
                if (retItem && checkKey === retItem.key) {
                    updated.ultimoRetimbre = value ? String(value) : '';
                    updated.pruebaHidraulica = value ? String(value) : '';
                }

                // Evaluar y actualizar eq.anomalias conservando notas manuales
                updated.anomalias = evaluarAnomaliasPorFecha(updated, sistema);

                const anoItem = itemsToUseForDates.find(i => (i.label||'').toLowerCase().includes('anomal') || (i.label||'').toLowerCase().includes('notas'));
                if (anoItem && anoItem.key && anoItem.key !== 'anomalias') {
                    (updated as any)[anoItem.key] = updated.anomalias;
                }

                const obsItem = itemsToUseForDates.find(i => (i.label||'').toLowerCase().includes('observacion'));
                if (obsItem && obsItem.key && obsItem.key !== 'observaciones' && checkKey === 'observaciones') {
                    (updated as any)[obsItem.key] = value;
                }

                
                /* ============================================================================
                 * BLINDAJE CRÍTICO (AGENTS.md REGLA 6): NO MODIFICAR ESTA AUTOGENERACIÓN
                 * Asignación incondicional a updated.anomalias para preguntas 'NO CORRECTO'
                 * ============================================================================ */
                const itemsToUseForAuto = checklistItemsPorSistema[eq.sistemaId] || getItemsToUse(eq.sistemaId) || [];
                const resolvedLabel = checkLabel || itemsToUseForAuto.find(i => i.key === checkKey)?.label || null;

                const isFieldNotes = checkKey === 'anomalias' || checkKey === 'observaciones' || checkKey === 'notas' ||
                    (resolvedLabel && (
                        resolvedLabel.toLowerCase().includes('anomal') || 
                        resolvedLabel.toLowerCase().includes('observac') || 
                        resolvedLabel.toLowerCase().includes('nota')
                    ));

                if (resolvedLabel && !isFieldNotes) {
                    const valStr = typeof value === 'string' ? value.toUpperCase().trim() : '';
                    const isFailed = (typeof value === 'boolean' && value === false) ||
                                     (valStr === 'FALSE') ||
                                     (valStr === 'NO CORRECTO' || valStr.includes('NO CORRECTO')) ||
                                     (valStr === 'NO CONFORME' || valStr.includes('NO CONFORME')) ||
                                     (valStr === 'INCORRECTO') ||
                                     (valStr === 'NO');

                    const cleanLabel = resolvedLabel.replace(/^[-\s–—•*]+/g, '').trim();
                    const labelLowerNorm = cleanLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const esPreguntaEstadoFinal = labelLowerNorm.includes('quedo') || labelLowerNorm.includes('comprobaciones la instalacion') || labelLowerNorm.includes('instalacion quedo');

                    if (!esPreguntaEstadoFinal) {
                        const textoAnomalia = `- ${cleanLabel}, NO CORRECTO.`;
                        
                        let lineasActuales = typeof updated.anomalias === 'string' 
                            ? updated.anomalias.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
                            : [];

                        if (isFailed) {
                            const yaExiste = lineasActuales.some(l => l.includes(cleanLabel));
                            if (!yaExiste) {
                                lineasActuales.push(textoAnomalia);
                            } else {
                                lineasActuales = lineasActuales.map(l => l.includes(cleanLabel) ? textoAnomalia : l);
                            }
                        } else {
                            lineasActuales = lineasActuales.filter(l => !l.includes(cleanLabel));
                        }

                        const resultAnoStr = lineasActuales.join('\n');
                        updated.anomalias = resultAnoStr;

                        const notasItem = itemsToUseForAuto.find(item => {
                            const lbl = (item.label || '').toLowerCase();
                            return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                        });
                        if (notasItem && notasItem.key && notasItem.key !== 'anomalias') {
                            (updated as any)[notasItem.key] = resultAnoStr;
                        }
                    }
                }
                
                return updated;
            });

            // Sincronización inteligente con debounce por equipo y flush si cambia de equipo
            const equipoModificado = updatedEquipos.find(eq => eq.id === equipoId);
            if (equipoModificado) {
                // Marcar estado local como guardando/pendiente
                setEqSyncStates(prev => ({ ...prev, [equipoId]: 'saving' }));

                // Respaldar inmediatamente todo en localStorage para cero pérdida offline
                try {
                    const allEquiposStored = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
                    const otrosCentros = allEquiposStored.filter((e: any) => e.centroId !== centroId);
                    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify([...otrosCentros, ...updatedEquipos]));
                } catch (e) {}

                // Mejora 1: Si cambia de equipo antes de 2.5s, sincronizar el equipo anterior de forma inmediata
                if (lastActiveEquipoIdRef.current && lastActiveEquipoIdRef.current !== equipoId) {
                    flushEquipoSync(lastActiveEquipoIdRef.current);
                }
                lastActiveEquipoIdRef.current = equipoId;

                // Guardar última versión en cola
                pendingEquiposRef.current.set(equipoId, equipoModificado);

                if (parteId) {
                    updateParteOfflineData(parteId, { equiposInstalados: updatedEquipos }).catch(() => {});
                    addPendingSyncItem(parteId, 'equipo', equipoId, equipoModificado).catch(() => {});
                }

                // Programar sincronización en 600ms tras dejar de teclear
                syncTimersRef.current[equipoId] = setTimeout(() => {
                    flushEquipoSync(equipoId);
                }, 600);
            }

            return updatedEquipos;
        });
    };

    const handleSaveRevision = async () => {
        if (!parteId) return;
        await flushAllPendingSync();

        // 1. Verificar que todos los equipos han sido procesados (Revisados o No encontrados)
        const equiposSinRevisar = equiposInstalados.filter(eq => !eq.revisado);
        if (equiposSinRevisar.length > 0) {
            setPendingEquiposCount(equiposSinRevisar.length);
            setShowEquiposSinRevisarModal(true);
            return;
        }

        const equiposInvalidos = equiposInstalados.filter((eq) => {
            const itemsDelSistema = checklistItemsPorSistema[eq.sistemaId] || [];
            const algunCheckRojo = itemsDelSistema.some((item) => {
                const val = eq[item.key as keyof EquipoInstalado];
                if (val === false || val === 'false') return true;
                if (typeof val === 'string') {
                    const valUpper = val.toUpperCase().trim();
                    return valUpper === 'NO CORRECTO' || valUpper.includes('NO CORRECTO') || valUpper === 'INCORRECTO';
                }
                return false;
            });

            const tieneAnomalia = itemsDelSistema.some(item => {
                const lbl = (item.label || '').toLowerCase();
                if (lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal')) {
                    const val = eq[item.key as keyof EquipoInstalado];
                    if (typeof val === 'string' && val.trim() !== '') return true;
                }
                return false;
            });
            const textoAnomaliaDirecto = !!eq.anomalias && eq.anomalias.trim() !== '';

            return algunCheckRojo && !tieneAnomalia && !textoAnomaliaDirecto;
        });

        if (equiposInvalidos.length > 0) {
            alert('Hay equipos con checks en rojo. Debes escribir la anomalía obligatoriamente en esos equipos.');
            return;
        }

        // 3. Validar que la "Fecha de revisión" (si existe) coincide con HOY
        const hoy = new Date().toISOString().split('T')[0];
        const equiposFechaInvalida = equiposInstalados.filter(eq => {
            const itemsDelSistema = checklistItemsPorSistema[eq.sistemaId] || [];
            const itemFechaRev = itemsDelSistema.find(item => (item.label || '').toLowerCase().includes('fecha de revisi'));
            if (!itemFechaRev) return false;
            const val = eq[itemFechaRev.key as keyof EquipoInstalado];
            return val !== hoy;
        });

        if (equiposFechaInvalida.length > 0) {
            setEquiposFechaInvalidaCount(equiposFechaInvalida.length);
            setShowEquiposFechaInvalidaModal(true);
            return;
        }

        // Mostrar modal de pregunta de retimbrado
        setShowPreguntaRetimbrarModal(true);
    };

    const handleConfirmarPreCierre = () => {
        setShowPreCierreModal(false);
        setFirmaClienteOk(false);
        setFirmaTecnicoOk(false);
        setShowFirmasModal(true);
        // Limpiar canvas al abrir
        setTimeout(() => {
            [canvasClienteRef, canvasTecnicoRef].forEach(ref => {
                const canvas = ref.current;
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
                }
            });
        }, 100);
    };

    const getCanvasPos = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
            y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setDrawing: (v: boolean) => void, e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getCanvasPos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, drawing: boolean, e: React.MouseEvent | React.TouchEvent) => {
        if (!drawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getCanvasPos(canvas, e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDraw = (setDrawing: (v: boolean) => void, setFirmaOk: (v: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
        setDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
        setFirmaOk(hasContent);
    };

    const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setFirmaOk: (v: boolean) => void) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFirmaOk(false);
    };

    const handleFinalizarConFirmas = async () => {
        if (!nombreClienteFirma.trim()) {
            alert('Por favor, introduce el nombre del cliente.');
            return;
        }
        if (!centro || !parte) return;

        await flushAllPendingSync();

        setIsSending(true);
        setSendProgress(15);
        setSendCompleted(false);

        try {
            const firmaCliente = canvasClienteRef.current?.toDataURL('image/png') || '';
            const firmaTecnico = canvasTecnicoRef.current?.toDataURL('image/png') || '';

            setSendProgress(35);

            // 1. Generar ID correlativo de Albarán para guardar las firmas
            const albaranesExistentes: Albaran[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
            const year = new Date().getFullYear().toString().slice(-2);
            const prefix = `ALB-${year}-`;
            const patterned = albaranesExistentes.filter((alb) => alb.id?.startsWith(prefix));
            let nextNum = 1;
            if (patterned.length > 0) {
                const nums = patterned.map((alb) => {
                    const parts = alb.id.split('-');
                    return parseInt(parts[parts.length - 1]);
                }).filter((n) => !isNaN(n));
                if (nums.length > 0) nextNum = Math.max(...nums) + 1;
            }
            const nextId = `${prefix}${nextNum.toString().padStart(3, '0')}`;

            const numMantenimiento = parte?.numeroMantenimiento || await generateNumeroMantenimiento();

            // Generar items para el albarán basado en los equipos de este centro
            const conteoPorSistema: Record<string, { cantidad: number, nombre: string }> = {};
            equiposInstalados.forEach(eq => {
                const sistId = eq.sistemaId || 'sin-sistema';
                if (!conteoPorSistema[sistId]) {
                    const sist = sistemasDelCentro.find(s => s.id === sistId);
                    conteoPorSistema[sistId] = {
                        cantidad: 0,
                        nombre: (sist as any)?.nombre || (sist as any)?.tipo || (sist as any)?.familia || eq.nombre || eq.clase || 'Equipos varios'
                    };
                }
                conteoPorSistema[sistId].cantidad += 1;
            });

            const per = parte?.periodicidad || 'Revisión';
            const conceptoStr = per.toLowerCase().includes('revisión') || per.toLowerCase().includes('revision') ? per : `Revisión ${per}`;

            const albaranItems = Object.values(conteoPorSistema).map(sys => {
                const desc = (sys.nombre || '').trim();
                const formattedDesc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1).toLowerCase() : '';
                return {
                    cantidad: sys.cantidad,
                    concepto: conceptoStr,
                    descripcion: formattedDesc,
                    precioUnidad: 0,
                    subtotal: 0
                };
            });

            const nuevoAlbaran: Albaran = {
                id: nextId,
                centroId: centro?.id || '',
                clienteId: centro?.clienteId || '',
                empresaId: centro?.empresaId || '',
                parteId: parteId,
                tecnicoId: parte?.tecnicoId || '',
                numeroMantenimiento: numMantenimiento,
                fechaCreacion: new Date().toISOString(),
                facturado: false,
                items: albaranItems,
                firmaCliente,
                firmaTecnico,
                nombreFirmante: nombreClienteFirma
            };

            setSendProgress(60);
            await saveEquiposProgress();

            // Determinar si hay alguna anomalía para fijar el estado del Certificado
            const tieneAnomalia = equiposInstalados.some(eq => equipoTieneAnomalias(eq));
            const estadoCertificado = tieneAnomalia ? 'No favorable' : 'Favorable';

            // Guardar Certificado localmente para que aparezca en el menú Certificados
            try {
                const nuevoCertificado = {
                    id: `CERT-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`,
                    clienteId: centro?.clienteId || parte?.clienteId || '',
                    centroId: centro?.id || '',
                    empresaId: centro?.empresaId || parte?.empresaId || '',
                    parteId: parteId,
                    numeroMantenimiento: numMantenimiento,
                    fechaCreacion: new Date().toISOString(),
                    estado: estadoCertificado
                };

                const certificadosExistentes = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
                certificadosExistentes.push(nuevoCertificado);
                localStorage.setItem('firecheck_db_certificados', JSON.stringify(certificadosExistentes));
            } catch (certSaveErr) {
                console.error('Error al guardar el certificado en local storage:', certSaveErr);
            }

            setSendProgress(80);

            // Guardar Albarán con las firmas
            await addAlbaran(nuevoAlbaran);
            
            // Cambiar estado a Finalizado y guardar firmas en el parte
            const docId = (parte as any)?._docId || parteId;
            await updateParteFirestore(docId, { 
                estado: 'Finalizado', 
                numeroMantenimiento: numMantenimiento,
                firmaCliente,
                firmaTecnico,
                nombreFirmante: nombreClienteFirma,
                equiposRetirados: seRetiranEquipos
            } as any);

            // Actualizar localmente
            updateParte({ 
                estado: 'Finalizado', 
                numeroMantenimiento: numMantenimiento,
                firmaCliente,
                firmaTecnico,
                nombreFirmante: nombreClienteFirma,
                equiposRetirados: seRetiranEquipos
            });

            setSendProgress(100);
            setSendCompleted(true);

            setTimeout(() => {
                setIsSending(false);
                setShowFirmasModal(false);
                navigate(-1);
            }, 3000);
        } catch (err) {
            console.error('Error al finalizar el parte:', err);
            setIsSending(false);
            alert('Error al guardar los datos finales y las firmas.');
        }
    };

    const handleOpenComments = () => {
        setPrivateComment(parte?.comentariosPrivados || '');
        setPublicComment(centro?.comentariosTecnico || '');
        setShowCommentsModal(true);
    };

    const handleSaveComments = async () => {
        if (!parteId || !centro) return;

        // 1. Guardar comentarios privados en el parte
        await handleParteChange({ comentariosPrivados: privateComment });

        // 2. Guardar comentarios públicos en el centro
        const docId = centro._docId || centro.id;
        if (docId) {
            // Actualizar en localStorage para soporte offline
            const storedCentros = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
            const updatedCentros = storedCentros.map((c: Centro) =>
                (c.id === centro.id || c._docId === centro._docId) ? { ...c, comentariosTecnico: publicComment } : c
            );
            localStorage.setItem('firecheck_db_centros', JSON.stringify(updatedCentros));
            setCentro(prev => prev ? { ...prev, comentariosTecnico: publicComment } : null);

            // Sincronizar con Firestore
            try {
                await updateCentro(docId, { comentariosTecnico: publicComment } as any);
            } catch (err) {
                console.error('Error actualizando comentarios del centro en Firestore:', err);
            }
        }

        setShowCommentsModal(false);
        alert('Comentarios guardados correctamente.');
    };

    const handlePauseRevision = () => {
        if (!parteId) return;

        saveEquiposProgress();
        updateParte({ estado: 'Descargado (Offline)' });

        alert('Revisión pausada. Todos los datos se han guardado.');
        navigate(-1);
    };

    const handleDeleteEquipo = (id: string) => {
        setEquipoIdToDelete(id);
        setIsConfirmModalOpen(true);
    };

    const handleCopiarEquipo = async (eqToCopy: EquipoInstalado) => {
        try {
            const sistemaId = eqToCopy.sistemaId;
            const equiposDelSistema = equiposInstalados.filter(e => e.sistemaId === sistemaId);
            const itemsToUse = checklistItemsPorSistema[sistemaId] || getItemsToUse(sistemaId) || [];

            // Buscar clave dinámica de "Orden de lista" si existe
            const itemOrden = itemsToUse.find((it: any) => it.label?.toLowerCase().trim() === 'orden de lista');
            const ordenKey = itemOrden?.key;

            let siguienteNumero = 1;
            if (equiposDelSistema.length > 0) {
                const numeros = equiposDelSistema
                    .map(e => {
                        const val = ordenKey ? (e as any)[ordenKey] || e.codigo : e.codigo;
                        return parseInt(val || '0', 10);
                    })
                    .filter(n => !isNaN(n));
                siguienteNumero = numeros.length > 0 ? Math.max(...numeros) + 1 : equiposDelSistema.length + 1;
            }
            const nextCodigo = siguienteNumero.toString().padStart(2, '0');

            let newId = '';
            try {
                newId = `EQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
            } catch {
                newId = `EQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            }

            const newEq: EquipoInstalado = {
                ...eqToCopy,
                id: newId,
                codigo: nextCodigo,
                placa: ''
            };
            delete (newEq as any)._docId;

            if (ordenKey) {
                (newEq as any)[ordenKey] = nextCodigo;
            }

            // Limpiar claves dinámicas que contengan "placa"
            itemsToUse.forEach((item: any) => {
                const lbl = (item.label || '').toLowerCase();
                const k = (item.key || '').toLowerCase();
                if (lbl.includes('placa') || k.includes('placa')) {
                    (newEq as any)[item.key] = '';
                }
            });

            const updatedEquipos = [...equiposInstalados, newEq];
            setEquiposInstalados(updatedEquipos);
            saveEquiposProgress(updatedEquipos);

            if (parteId) {
                await updateParteOfflineData(parteId, { equiposInstalados: updatedEquipos });
                if (newEq.id) {
                    await addPendingSyncItem(parteId, 'equipo', newEq.id, newEq);
                }
            }

            try {
                if (navigator.onLine) {
                    await addEquipoInstalado(newEq as any);
                    showToast('Equipo copiado');
                } else {
                    showToast('Equipo copiado en local (Offline)');
                }
            } catch (err) {
                console.warn('Guardado offline para equipo copiado:', err);
                showToast('Equipo copiado en local (Offline)');
            }
        } catch (err) {
            console.error('Error al copiar nuevo equipo:', err);
            showToast('Error al copiar equipo');
        }
    };

    const handleConfirmarRevisarTodo = async () => {
        const sistId = revisarTodoConfirm.sistemaId;
        if (!sistId) return;
        setRevisarTodoConfirm({ isOpen: false, sistemaId: null });

        const itemsToUse = getItemsToUse(sistId);
        let updatedCount = 0;
        const hoy = new Date().toISOString().split('T')[0];
        const updatedEquipos = equiposInstalados.map(eq => {
            if (eq.sistemaId === sistId) {
                updatedCount++;
                const allChecked: Record<string, any> = {};
                itemsToUse.forEach(item => {
                    if (item.tipoRespuesta === 'check') {
                        allChecked[item.key] = true;
                    } else if (item.tipoRespuesta === 'fecha') {
                        const lblLower = (item.label || '').toLowerCase();
                        if (lblLower.includes('fecha de revisi')) {
                            allChecked[item.key] = hoy;
                        }
                    }
                });
                const notasItem = itemsToUse.find(item => {
                    const lbl = (item.label || '').toLowerCase();
                    return lbl.includes('notas') || lbl.includes('observaciones') || lbl.includes('anomal');
                });
                if (notasItem) {
                    allChecked[notasItem.key] = '';
                }
                return {
                    ...eq,
                    revisado: true,
                    anomalias: '',
                    ...allChecked
                };
            }
            return eq;
        });

        if (updatedCount > 0) {
            setEquiposInstalados(updatedEquipos);
            saveEquiposProgress(updatedEquipos);
            
            // Guardar individualmente en Firestore para asegurar sincronía
            updatedEquipos.filter(eq => eq.sistemaId === sistId).forEach(async (equipoModificado) => {
                try {
                    await updateEquipoInstalado(equipoModificado.id, equipoModificado as any);
                } catch (err) {
                    console.error('Error guardando en Firestore desde Revisar Todo:', err);
                }
            });

            showToast('Guardado');
            if (parte?.estado === 'Planificado') {
                updateParte({ estado: 'Abierto' });
                const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
                const parteActual = storedPartes.find((p: any) => p.id === parteId);
                const docId = parteActual?._docId || parteId;
                try { await updateParteFirestore(docId, { estado: 'Abierto' }); } catch (err) { console.error('Error actualizando estado en Firestore:', err); }
            }
        }
    };

    const confirmDeleteEquipo = async () => {
        if (!equipoIdToDelete) return;
        setIsConfirmModalOpen(false);
        
        // Encontrar el equipo a eliminar desde el estado actual
        const eqEliminado = equiposInstalados.find(eq => eq.id === equipoIdToDelete);
        
        const updatedEquipos = equiposInstalados.filter(eq => eq.id !== equipoIdToDelete);
        setEquiposInstalados(updatedEquipos);

        const allEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        const updatedAll = allEquipos.filter((eq: any) => eq.id !== equipoIdToDelete);
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(updatedAll));

        // Eliminar también de Firestore
        if (eqEliminado?.centroId && eqEliminado?.sistemaId) {
            try {
                const { deleteEquipoInstalado } = await import('../services/revisionesService');
                await deleteEquipoInstalado(eqEliminado.centroId, eqEliminado.sistemaId, equipoIdToDelete);
            } catch (err) {
                console.warn('Error eliminando equipo de Firestore:', err);
            }
        }
    };

    const moveSistema = (sistemaId: string, direction: 'up' | 'down') => {
        const sistemasOrdenados = [...sistemasDelCentro].sort((a, b) => {
            const idxA = sistemaOrden.indexOf(a.id);
            const idxB = sistemaOrden.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        const currentIndex = sistemasOrdenados.findIndex(s => s.id === sistemaId);
        if (currentIndex === -1) return;
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sistemasOrdenados.length) return;

        const newOrden = sistemasOrdenados.map(s => s.id);
        const [moved] = newOrden.splice(currentIndex, 1);
        newOrden.splice(newIndex, 0, moved);
        setSistemaOrden(newOrden);
        localStorage.setItem('firecheck_revision_sistema_orden', JSON.stringify(newOrden));
    };

    const toggleSistema = useCallback((sistemaId: string) => {
        setOpenSistemas(prev => ({ ...prev, [sistemaId]: !prev[sistemaId] }));
    }, []);

    const getItemsToUse = useCallback((sistemaId?: string): ChecklistItem[] => {
        if (sistemaId) {
            return checklistItemsPorSistema[sistemaId] || [];
        }
        // Si no hay sistemaId, buscar en cualquier sistema cargado
        const allItems = Object.values(checklistItemsPorSistema).flat();
        if (allItems.length > 0) return allItems;
        return [];
    }, [checklistItemsPorSistema]);

    const getCheckStats = useCallback((eq: EquipoInstalado) => {
        let ok = 0;
        let fail = 0;
        let pending = 0;
        const items = getItemsToUse(eq.sistemaId);
        items.forEach(item => {
            if ((item.tipoRespuesta as any) === 'seccion' || (item.tipoRespuesta as any) === 'titulo' || item.tipoRespuesta === 'tabla') return;
            const val = eq[item.key as keyof EquipoInstalado];
            if (val === true || val === 'true' || (typeof val === 'string' && val.toUpperCase().trim() === 'CORRECTO')) {
                ok++;
            } else if (val === false || val === 'false' || (typeof val === 'string' && (val.toUpperCase().trim() === 'NO CORRECTO' || val.toUpperCase().trim().includes('NO CORRECTO') || val.toUpperCase().trim() === 'INCORRECTO'))) {
                fail++;
            } else if (val === undefined || val === null || val === '') {
                pending++;
            } else {
                ok++;
            }
        });
        return { ok, fail, pending };
    }, [getItemsToUse]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm font-medium">Cargando revisión...</p>
                </div>
            </div>
        );
    }

    console.log('RevisionChecklist render check:', { centro, parte, centroId, parteId });
    if (!centro || !parte) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-amber-100 text-center max-w-md">
                    <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-amber-700 font-medium">Cargando datos del parte...</p>
                    <p className="text-xs text-zinc-400 mt-2">Conectando con Firestore</p>
                </div>
            </div>
        );
    }

    const sistemasOrdenados = useMemo(() => {
        return [...sistemasDelCentro].sort((a, b) => {
            const idxA = sistemaOrden.indexOf(a.id);
            const idxB = sistemaOrden.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }, [sistemasDelCentro, sistemaOrden]);

    const clientInfo = useMemo(() => {
        return clientes.find(cl => cl.id === centro.clienteId);
    }, [clientes, centro.clienteId]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Insignia Estado de Red */}
                        {isOnlineState ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                <Wifi className="w-3 h-3 text-emerald-600" />
                                <span className="hidden sm:inline">Online</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full animate-pulse">
                                <WifiOff className="w-3 h-3 text-rose-600" />
                                <span>Modo Offline</span>
                            </span>
                        )}

                        {/* Insignia Estado de Sincronización Local */}
                        {pendingSyncCount > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full" title={`Estado: ${syncStatusText}`}>
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                                <span>{pendingSyncCount} cambios locales</span>
                            </span>
                        ) : (
                            <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full" title={`Estado: ${syncStatusText}`}>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Sincronizado</span>
                            </span>
                        )}

                        {/* Botón Sincronizar Parte Completo */}
                        <button
                            type="button"
                            onClick={handleSincronizarParteCompleto}
                            disabled={isSyncingFullParte}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer ${
                                isSyncingFullParte
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : pendingSyncCount > 0
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                    : 'bg-zinc-900 hover:bg-black text-white shadow-zinc-900/10'
                            }`}
                            title="Sincronizar parte completo bloque por bloque en segundo plano"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFullParte ? 'animate-spin' : ''}`} />
                            <span>{isSyncingFullParte ? 'Sincronizando...' : 'Sincronizar parte'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {parte?.estado === 'Cerrado' && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-orange-850 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-650 shrink-0" />
                            <div className="text-sm font-semibold">
                                Este parte de trabajo está cerrado y se muestra en modo de solo lectura.
                            </div>
                        </div>
                        {isAdminOrSuper && (
                            <button
                                type="button"
                                onClick={handleReabrirParte}
                                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-100 flex items-center gap-1.5 shrink-0"
                            >
                                <Unlock className="w-3.5 h-3.5" /> Re-abrir Parte
                            </button>
                        )}
                    </div>
                )}
                {parte?.estado !== 'En revisión' && parte?.estado !== 'Cerrado' && parte?.estado !== 'Pre-Cerrado' && (
                    <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sky-900 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
                            <div className="text-sm font-semibold">
                                Pulsa en <span className="font-bold text-green-700">"Empezar revisión"</span> para habilitar la edición de este parte. Puedes desplegar los sistemas para consultar el contenido.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleParteChange({ estado: 'En revisión' })}
                            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-100 flex items-center gap-1.5 shrink-0"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Empezar revisión
                        </button>
                    </div>
                )}
                {/* Header Card */}
                <div className="mb-8 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-6 border-b border-slate-100 relative">
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                            Revisión del parte: <span className="text-slate-500 font-mono text-lg">{parte.numeroMantenimiento || parte.id}</span>
                        </h1>
                        
                        <div className="mt-4 space-y-1">
                            <div className="text-lg font-bold text-slate-800">
                                {clientInfo?.nombre || 'Cliente'}
                            </div>
                            <div className="text-base font-semibold text-slate-600 flex items-center gap-2 flex-wrap">
                                <span>{centro.nombre}</span>
                                {(centro.id || centro.customIdPart) && (
                                    <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        {centro.id || centro.customIdPart}
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-slate-500">
                                {centro.direccion}, {centro.poblacion}
                            </div>
                            <div className="text-sm text-slate-500">
                                Tipo de revisión: <span className="font-semibold text-slate-700">{parte.periodicidad || 'No definida'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {parte.tecnicoId ? (
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-600">Técnico asignado:</label>
                                    <select
                                        value={parte.tecnicoId || ''}
                                        onChange={(e) => handleParteChange({ tecnicoId: e.target.value })}
                                        className="bg-white border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-sky-500 font-semibold text-sky-700"
                                    >
                                        <option value="">-- Seleccionar Técnico --</option>
                                        {tecnicos.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value=""
                                        onChange={(e) => handleParteChange({ tecnicoId: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    >
                                        <option value="" disabled>Asignar Técnico</option>
                                        {tecnicos.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>
                                        ))}
                                    </select>
                                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm pointer-events-none">
                                        Asignar Técnico
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {parte.estado !== 'En revisión' && parte.estado !== 'Cerrado' && parte.estado !== 'Pre-Cerrado' && (
                                <button
                                    onClick={() => handleParteChange({ estado: 'En revisión' })}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Empezar revisión
                                </button>
                            )}
                            <span className="flex items-center gap-1.5 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                <div className={`w-2 h-2 rounded-full ${parte.estado === 'En revisión' ? 'bg-green-500' : (parte.estado === 'Cerrado' || parte.estado === 'Pre-Cerrado') ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                                Estado: <span className="font-semibold text-slate-700">{parte.estado}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Systems Accordion List */}
                <div className="space-y-4">
                    {sistemasDelCentro.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
                            <Layers className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">Este centro no tiene sistemas registrados.</p>
                        </div>
                    ) : (
                        sistemasOrdenados.map((sist, index, arr) => {
                            // Buscar la imagen del sistema en categoriasSistema (cargado desde Firestore)
                            const sistemaCat = categoriasSistema.find(c => {
                                const nombreSist = (sist.tipo || sist.familia || '').toLowerCase().trim();
                                const nombreCat = (c.nombre || '').toLowerCase().trim();
                                const isMonoxA = nombreSist.includes('monoxido') || nombreSist.includes('monox');
                                const isMonoxB = nombreCat.includes('monoxido') || nombreCat.includes('monox');
                                if (isMonoxA || isMonoxB) return isMonoxA && isMonoxB;
                                const isAspA = nombreSist.includes('aspiraci') || nombreSist.includes('aspirac');
                                const isAspB = nombreCat.includes('aspiraci') || nombreCat.includes('aspirac');
                                if (isAspA || isAspB) return isAspA && isAspB;
                                const isCocinaA = nombreSist.includes('cocina') || nombreSist.includes('campana');
                                const isCocinaB = nombreCat.includes('cocina') || nombreCat.includes('campana');
                                if (isCocinaA || isCocinaB) return isCocinaA && isCocinaB;
                                const isGasA = (nombreSist.includes('gas') || (nombreSist.includes('extinci') && !nombreSist.includes('extintor'))) && !isCocinaA;
                                const isGasB = (nombreCat.includes('gas') || (nombreCat.includes('extinci') && !nombreCat.includes('extintor'))) && !isCocinaB;
                                if (isGasA || isGasB) return isGasA && isGasB;
                                return nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
                            });
                            const imagenUrl = sistemaCat?.imagenUrl;
                            const IconoCat = imagenUrl || getIconForSistema(sist.tipo || sist.familia || '');
                            const isFirst = index === 0;
                            const isLast = index === arr.length - 1;
                            return (
                                <div key={sist.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                                {/* Accordion Header - sticky respecto al viewport */}
                                <div className="sticky top-[57px] z-10 bg-white px-6 py-4 border-b border-slate-100 rounded-t-2xl shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => toggleSistema(sist.id)}
                                            className="flex items-center gap-3 text-left flex-1 min-w-0"
                                        >
                                            <div className="w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden">
                                                {typeof IconoCat === 'string' ? (
                                                    <img src={IconoCat} alt="Icon" className="w-7 h-7 object-contain" />
                                                ) : (
                                                    <IconoCat className="w-5 h-5 text-slate-500" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                {(() => {
                                                    const tieneAnomaliaSistema = equiposInstalados
                                                        .filter(eq => String(eq.sistemaId) === String(sist.id))
                                                        .some(eq => {
                                                            if (typeof eq.anomalias === 'string' && eq.anomalias.trim() !== '') return true;
                                                            for (const k of Object.keys(eq)) {
                                                                if (k.toLowerCase().includes('anomal')) {
                                                                    const val = eq[k];
                                                                    if (typeof val === 'string' && val.trim() !== '') return true;
                                                                }
                                                            }
                                                            return false;
                                                        });
                                                    return (
                                                        <h2 className="text-lg font-semibold text-slate-800 truncate flex items-center gap-2">
                                                            <span>{sist.familia || sist.tipo}</span>
                                                            {tieneAnomaliaSistema && (
                                                                <span title="Este sistema contiene equipos con anomalías">
                                                                    <AlertTriangle className="w-5 h-5 text-amber-500 fill-amber-100 shrink-0" />
                                                                </span>
                                                            )}
                                                        </h2>
                                                    );
                                                })()}
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {(() => {
                                                        const equiposSistema = equiposInstalados
                                                          .filter(eq => eq.sistemaId === sist.id)
                                                          .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
                                                        const numEquipos = equiposSistema.length;
                                                        
                                                        // Buscar el campo "Referencia instalación" en el primer equipo
                                                        const itemReferenciaInstalacion = getItemsToUse(sist.id).find((item: ChecklistItem) => {
                                                            const lbl = (item.label || '').toLowerCase();
                                                            return lbl.includes('referencia') && lbl.includes('instalacion');
                                                        });
                                                        
                                                        let referenciaTexto = '';
                                                        if (itemReferenciaInstalacion && equiposSistema.length > 0) {
                                                            const primerEquipo = equiposSistema[0];
                                                            const valorReferencia = primerEquipo[itemReferenciaInstalacion.key as keyof EquipoInstalado];
                                                            if (typeof valorReferencia === 'string' && valorReferencia.trim() !== '') {
                                                                referenciaTexto = valorReferencia.trim().toUpperCase() + ', ';
                                                            }
                                                        }
                                                        
                                                        return `${referenciaTexto}${numEquipos} equipo${numEquipos !== 1 ? 's' : ''}`;
                                                    })()}
                                                </p>
                                                {/* Luces de colores para el estado de cada equipo con número y navegación directa */}
                                                {(() => {
                                                     const equiposSistema = equiposInstalados
                                                         .filter(eq => eq.sistemaId === sist.id)
                                                         .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
                                                     if (equiposSistema.length === 0) return null;
                                                     return (
                                                         <div className="flex items-center gap-1.5 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                                             {equiposSistema.map((eq, idx) => {
                                                                  const itemsToUse = getItemsToUse(sist.id);
                                                                  
                                                                  // Buscar si tiene campo de fecha de revisión
                                                                  const itemFechaRevision = itemsToUse.find((item) => {
                                                                      const labelLower = (item.label || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                                      return labelLower.includes('fecha de revision');
                                                                  });
                                                                  
                                                                  const valFecha = itemFechaRevision ? eq[itemFechaRevision.key as keyof EquipoInstalado] : null;
                                                                  const fechaEsReciente = esFechaRevisionReciente(valFecha, 15);
                                                                  
                                                                  // Se mantiene verde si la fecha de revisión está en los últimos 15 días. Si no tiene ese campo, usamos eq.revisado.
                                                                  const isRevisado = itemFechaRevision ? fechaEsReciente : eq.revisado;
                                                                  
                                                                  let colorClass = 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)] text-white'; // Amarillo (Supera 15 días / Pendiente)
                                                                  let titleText = 'Supera los 15 días o pendiente';
                                                                  
                                                                  if (isRevisado) {
                                                                      colorClass = 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] text-white'; // Verde (Revisado en los últimos 15 días)
                                                                      titleText = 'Revisado (OK - Últimos 15 días)';
                                                                  }
                                                                  
                                                                  const numeroEquipo = idx + 1;
                                                                 
                                                                 return (
                                                                     <span
                                                                         key={eq.id}
                                                                         role="button"
                                                                         onClick={(e) => {
                                                                             e.stopPropagation();
                                                                             // Asegurar que el sistema está abierto en el acordeón
                                                                             setOpenSistemas(prev => ({ ...prev, [sist.id]: true }));
                                                                             // Desplazar suavemente dejando la cabecera del equipo completamente visible
                                                                             const scrollToTarget = () => {
                                                                                 const el = document.getElementById(`equipo-${eq.id}`);
                                                                                 if (el) {
                                                                                     const headerOffset = 160;
                                                                                     const elementPosition = el.getBoundingClientRect().top;
                                                                                     const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                                                                                     window.scrollTo({
                                                                                         top: offsetPosition,
                                                                                         behavior: 'smooth'
                                                                                     });
                                                                                     el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
                                                                                     setTimeout(() => {
                                                                                         el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
                                                                                     }, 2000);
                                                                                 }
                                                                             };
                                                                             setTimeout(scrollToTarget, 50);
                                                                             setTimeout(scrollToTarget, 220);
                                                                         }}
                                                                         className={`min-w-[14px] h-[14px] px-0.5 rounded-full ${colorClass} flex items-center justify-center text-[9px] font-bold leading-none transition-all hover:scale-110 active:scale-95 cursor-pointer select-none`}
                                                                         title={`${eq.codigo || `Equipo ${numeroEquipo}`}: ${titleText} (Haz clic para ir al equipo)`}
                                                                     >
                                                                         {numeroEquipo}
                                                                     </span>
                                                                 );
                                                             })}
                                                         </div>
                                                     );
                                                 })()}
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* Flechas para reordenar */}
                                            <div className="flex flex-col gap-0.5 mr-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveSistema(sist.id, 'up'); }}
                                                    disabled={isFirst}
                                                    className={`p-0.5 rounded transition-colors ${isFirst ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                                    title="Mover arriba"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); moveSistema(sist.id, 'down'); }}
                                                    disabled={isLast}
                                                    className={`p-0.5 rounded transition-colors ${isLast ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                                    title="Mover abajo"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>


                                    </div>
                                </div>

                                {/* Accordion Content */}
                                {openSistemas[sist.id] && (
                                    <div className="px-4 sm:px-6 py-5">
                                        {sist.descripcion && (
                                            <p className="text-sm text-slate-500 mb-5 px-1">{sist.descripcion}</p>
                                        )}

                                        {/* Botones de acción del sistema - parte superior */}
                                        {parte.estado !== 'Cerrado' && (
                                            <div className="mb-5 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRevisarTodoConfirm({ isOpen: true, sistemaId: sist.id });
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-green-200"
                                                >
                                                    <CheckCheck className="w-4 h-4" /> Revisar todo como ok
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddEquipo(prev => ({ ...prev, isOpen: true, sistemaId: sist.id }));
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Añadir equipo
                                                </button>
                                            </div>
                                        )}

                                        <div className={`space-y-4 ${parte.estado === 'Cerrado' ? 'pointer-events-none select-none opacity-95' : ''}`}>
                                            {(() => {
                                                const filteredEqs = equiposInstalados
                                                    .filter(eq => eq.sistemaId === sist.id)
                                                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
                                                return filteredEqs.length === 0 ? (
                                                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                                        <Layers className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                        <p className="text-sm text-slate-400 font-medium">No hay equipos instalados en este sistema.</p>
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        const sistLower = (sist.tipo || sist.familia || '').toLowerCase();
                                                        const isExtintor = sistLower.includes('extintor');
                                                        const isBie = sistLower.includes('bie') || sistLower.includes('boca');
                                                        const isDeteccionMonoxido = sistLower.includes('monoxido') || sistLower.includes('monóxido') || sistLower.includes('monox');
                                                        const isDeteccionAspiracion = sistLower.includes('aspiraci') || sistLower.includes('aspirac');
                                                        const isDeteccion = sistLower.includes('detecci') && !isDeteccionMonoxido && !isDeteccionAspiracion;
                                                        const isSobrepresion = sistLower.includes('sobrepresi') || sistLower.includes('presuriza');
                                                        const isBombaElectrica = sistLower.includes('bomba electrica') || sistLower.includes('bomba eléctrica');
                                                        const isBombaJockey = sistLower.includes('bomba jockey') || sistLower.includes('jockey');
                                                        const isBombaDiesel = sistLower.includes('bomba diesel') || sistLower.includes('diesel');
                                                        const isAbastecimiento = sistLower.includes('abastecimiento') || sistLower.includes('sala de bombas');
                                                        const isCasetas = sistLower.includes('caseta');
                                                        const isExutorios = sistLower.includes('exutorio');
                                                        const isHidrantes = sistLower.includes('hidrante');
                                                        const isPuertasRF = sistLower.includes('puerta rf') || sistLower.includes('puertas rf') || sistLower.includes('cortafuego');
                                                        const isSprinklers = sistLower.includes('sprinkler') || sistLower.includes('rociador');
                                                        const isExtincionCampanaCocina = sistLower.includes('campana') || sistLower.includes('cocina');
                                                        const isExtincionGas = (sistLower.includes('gas') || (sistLower.includes('extinci') && !isExtintor)) && !isExtincionCampanaCocina;
                                                        const isFuenteAlimentacionAuxiliar = sistLower.includes('fuente') || (sistLower.includes('alimentaci') && sistLower.includes('auxiliar')) || (sistLower.includes('alimentac') && sistLower.includes('auxiliar'));
                                                        const isAlumbradoEmergencia = sistLower.includes('alumbrado') || sistLower.includes('emergencia');

                                                        const commonProps = {
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
                                                        };

                                                        if (isExtintor) return <SistemaExtintores {...commonProps} />;
                                                        if (isBie) return <SistemaBies {...commonProps} />;
                                                        if (isDeteccionMonoxido) return <SistemaDeteccionMonoxido {...commonProps} />;
                                                        if (isDeteccionAspiracion) return <SistemaDeteccionAspiracion {...commonProps} />;
                                                        if (isDeteccion) return <SistemaDeteccion {...commonProps} />;
                                                        if (isSobrepresion) return <SistemaSobrepresionPresurizacion {...commonProps} />;
                                                        if (isBombaElectrica) return <SistemaBombaElectrica {...commonProps} />;
                                                        if (isBombaJockey) return <SistemaBombaJockey {...commonProps} />;
                                                        if (isBombaDiesel) return <SistemaBombaDiesel {...commonProps} />;
                                                        if (isAbastecimiento) return <SistemaAbastecimientoSalaBombas {...commonProps} />;
                                                        if (isCasetas) return <SistemaCasetas {...commonProps} />;
                                                        if (isExutorios) return <SistemaExutorios {...commonProps} />;
                                                        if (isHidrantes) return <SistemaHidrantes {...commonProps} />;
                                                        if (isPuertasRF) return <SistemaPuertasRF {...commonProps} />;
                                                        if (isSprinklers) return <SistemaSprinklers {...commonProps} />;
                                                        if (isExtincionCampanaCocina) return <SistemaExtincionCampanaCocina {...commonProps} />;
                                                        if (isExtincionGas) return <SistemaExtincionGas {...commonProps} />;
                                                        if (isFuenteAlimentacionAuxiliar) return <SistemaFuenteAlimentacionAuxiliar {...commonProps} />;
                                                        if (isAlumbradoEmergencia) return <SistemaAlumbradoEmergencia {...commonProps} />;
                                                        return <SistemaGenerico {...commonProps} />;
                                                    })()
                                                );
                                            })()}
                                        </div>

                                        {(parte.estado === 'En revisión' || parte.estado === 'Pre-Cerrado') && equiposInstalados.some(eq => eq.sistemaId === sist.id) && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddEquipo(prev => ({ ...prev, isOpen: true, sistemaId: sist.id }));
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Añadir equipo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })
                    )}
                </div>

                {parte.estado === 'Cerrado' && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-full">
                                <Lock className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-orange-900">Parte Cerrado</h3>
                                <p className="text-xs text-orange-700">Esta revisión está finalizada y es de solo lectura.</p>
                            </div>
                        </div>
                        {isAdminOrSuper && (
                            <button
                                onClick={handleReabrirParte}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                            >
                                Reabrir parte
                            </button>
                        )}
                    </div>
                )}

                <div className="mt-10 pt-6 border-t border-slate-200 flex flex-row items-center justify-between sm:justify-end gap-1.5 sm:gap-3">
                    <button
                        type="button"
                        onClick={handleOpenComments}
                        className="relative flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition-all text-[11px] sm:text-sm text-center leading-tight"
                    >
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Comentarios
                        {hasComments && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 border-2 border-white"></span>
                            </span>
                        )}
                    </button>
                    {parte.estado !== 'Cerrado' && (
                        <>
                            <button
                                onClick={handlePauseRevision}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all text-[11px] sm:text-sm text-center leading-tight"
                            >
                                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Guardar datos
                            </button>
                            {isTecnico && (
                                <button
                                    onClick={handleSaveRevision}
                                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all text-[11px] sm:text-sm text-center leading-tight"
                                >
                                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Finalizar parte
                                </button>
                            )}
                            {isAdminOrSuper && (
                                <>
                                    <button
                                        onClick={handlePreCerrarParte}
                                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all text-[11px] sm:text-sm text-center leading-tight"
                                    >
                                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Pre-cerrar
                                    </button>
                                    <button
                                        onClick={handleCerrarParte}
                                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-black hover:bg-zinc-900 shadow-md shadow-zinc-800 transition-all text-[11px] sm:text-sm text-center leading-tight"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Cerrar
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    {parte.estado === 'Cerrado' && isAdminOrSuper && (
                        <button
                            onClick={handleReabrirParte}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-200 transition-all text-[11px] sm:text-sm text-center leading-tight"
                        >
                            <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Re-abrir
                        </button>
                    )}
                </div>
            </div>

            {/* MODAL EDITAR EQUIPO */}
            {editEquipo && equiposInstalados.find(e => e.id === editEquipo) && centroId && (
                <EquipoFormulario
                    equipo={equiposInstalados.find(e => e.id === editEquipo) || null}
                    sistemaId={equiposInstalados.find(e => e.id === editEquipo)?.sistemaId || ''}
                    sistemaNombre={sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.familia || ''}
                    centroId={centroId}
                    parteId={parteId}
                    plantillaId={sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === equiposInstalados.find(e => e.id === editEquipo)?.sistemaId)?.familia || ''}
                    equiposExistentes={equiposInstalados.filter(e => e.sistemaId === equiposInstalados.find(eq => eq.id === editEquipo)?.sistemaId)}
                    onSave={async (updatedEq) => {
                        const updated = equiposInstalados.map(eq =>
                            eq.id === editEquipo ? { ...eq, ...updatedEq } as any : eq
                        );
                        setEquiposInstalados(updated);
                        saveEquiposProgress(updated);

                        if (parteId) {
                            await updateParteOfflineData(parteId, { equiposInstalados: updated });
                            if (updatedEq.id) {
                                await addPendingSyncItem(parteId, 'equipo', updatedEq.id, updatedEq);
                            }
                        }

                        try {
                            if (updatedEq.id && !updatedEq.id.startsWith('temp_') && navigator.onLine) {
                                await updateEquipoInstalado(updatedEq.id, updatedEq);
                                showToast('Equipo actualizado');
                            } else {
                                showToast('Equipo guardado en local (Offline)');
                            }
                        } catch (err) {
                            console.warn('Guardado offline para equipo actualizado:', err);
                            showToast('Equipo guardado en local (Offline)');
                        }
                        
                        setEditEquipo(null);
                    }}
                    onCancel={() => setEditEquipo(null)}
                    isNew={false}
                />
            )}

            {isConfirmModalOpen && equipoIdToDelete && (
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => { setIsConfirmModalOpen(false); setEquipoIdToDelete(null); }}
                    onConfirm={confirmDeleteEquipo}
                    title="Confirmar Eliminación"
                    message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
                    confirmText="Sí, eliminar"
                    cancelText="No, cancelar"
                />
            )}

            {/* MODAL AÑADIR EQUIPO */}
            {addEquipo.isOpen && addEquipo.sistemaId && centroId && (
                <EquipoFormulario
                    equipo={null}
                    sistemaId={addEquipo.sistemaId}
                    sistemaNombre={sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.familia || ''}
                    centroId={centroId}
                    parteId={parteId}
                    plantillaId={sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.tipo || sistemasDelCentro.find(s => s.id === addEquipo.sistemaId)?.familia || ''}
                    equiposExistentes={equiposInstalados.filter(e => e.sistemaId === addEquipo.sistemaId)}
                    onSave={async (equipo) => {
                        const itemsToUse = addEquipo.sistemaId ? (checklistItemsPorSistema[addEquipo.sistemaId] || []) : [];
                        const defaultCorrecto: Record<string, string> = {};
                        itemsToUse.forEach((item: ChecklistItem) => {
                            const opciones = (item as any).opciones || [];
                            if (opciones.includes('CORRECTO')) {
                                defaultCorrecto[item.key] = 'CORRECTO';
                            }
                        });
                        const equipoConCodigo = {
                            ...defaultCorrecto,
                            ...equipo,
                            codigo: equipo.codigo || '',
                            revisado: false
                        };
                        const updatedEquipos = [...equiposInstalados, equipoConCodigo as any];
                        setEquiposInstalados(updatedEquipos);
                        saveEquiposProgress(updatedEquipos);
                        
                        if (parteId) {
                            await updateParteOfflineData(parteId, { equiposInstalados: updatedEquipos });
                            if (equipoConCodigo.id) {
                                await addPendingSyncItem(parteId, 'equipo', equipoConCodigo.id, equipoConCodigo);
                            }
                        }

                        try {
                            if (navigator.onLine) {
                                await addEquipoInstalado(equipoConCodigo as any);
                                showToast('Equipo añadido');
                            } else {
                                showToast('Equipo añadido en local (Offline)');
                            }
                        } catch (err) {
                            console.warn('Guardado offline para equipo nuevo:', err);
                            showToast('Equipo añadido en local (Offline)');
                        }
                        
                        setAddEquipo(prev => ({ ...prev, isOpen: false }));
                    }}
                    onCancel={() => {
                        setAddEquipo(prev => ({ ...prev, isOpen: false }));
                    }}
                    isNew={true}
                />
            )}

            {revisarTodoConfirm.isOpen && revisarTodoConfirm.sistemaId && (
                <ConfirmationModal
                    isOpen={revisarTodoConfirm.isOpen}
                    onClose={() => setRevisarTodoConfirm({ isOpen: false, sistemaId: null })}
                    onConfirm={handleConfirmarRevisarTodo}
                    title="Confirmar Revisión"
                    message="¿Seguro que quieres pasar todos los equipos como revisados y OK?"
                    confirmText="Sí, revisar todo"
                    cancelText="No, cancelar"
                />
            )}

            {/* MODAL EQUIPOS SIN REVISAR */}
            {showEquiposSinRevisarModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-6 py-5 bg-amber-50 border-b border-amber-100 text-center">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-7 h-7 text-amber-600" />
                            </div>
                            <h2 className="text-lg font-bold text-amber-900">Equipos pendientes por revisar</h2>
                            <p className="text-sm text-amber-700 mt-1">
                                Atención: Quedan <strong className="font-bold">{pendingEquiposCount}</strong> {pendingEquiposCount === 1 ? 'equipo sin revisar' : 'equipos sin revisar'}.
                            </p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={() => setShowEquiposSinRevisarModal(false)}
                                className="w-full px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver a la revisión
                            </button>
                            <button
                                onClick={() => {
                                    setShowEquiposSinRevisarModal(false);
                                    const hoy = new Date().toISOString().split('T')[0];
                                    const equiposFechaInvalida = equiposInstalados.filter(eq => {
                                        const itemsDelSistema = checklistItemsPorSistema[eq.sistemaId] || [];
                                        const itemFechaRev = itemsDelSistema.find(item => (item.label || '').toLowerCase().includes('fecha de revisi'));
                                        if (!itemFechaRev) return false;
                                        const val = eq[itemFechaRev.key as keyof EquipoInstalado];
                                        return val !== hoy;
                                    });

                                    if (equiposFechaInvalida.length > 0) {
                                        setEquiposFechaInvalidaCount(equiposFechaInvalida.length);
                                        setShowEquiposFechaInvalidaModal(true);
                                    } else {
                                        setShowPreguntaRetimbrarModal(true);
                                    }
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Finalizar parte
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FECHA DE REVISIÓN DESACTUALIZADA */}
            {showEquiposFechaInvalidaModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-6 py-5 bg-amber-50 border-b border-amber-100 text-center">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Calendar className="w-7 h-7 text-amber-600" />
                            </div>
                            <h2 className="text-lg font-bold text-amber-900">Fechas de revisión pendientes</h2>
                            <p className="text-sm text-amber-700 mt-1">
                                Atención: Hay <strong className="font-bold">{equiposFechaInvalidaCount}</strong> {equiposFechaInvalidaCount === 1 ? 'equipo' : 'equipos'} donde la "Fecha de revisión" no coincide con la fecha de hoy ({new Date().toISOString().split('T')[0]}).
                            </p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={() => setShowEquiposFechaInvalidaModal(false)}
                                className="w-full px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver al parte
                            </button>
                            <button
                                onClick={() => {
                                    setShowEquiposFechaInvalidaModal(false);
                                    setShowPreguntaRetimbrarModal(true);
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PREGUNTA RETIMBRAR */}
            {showPreguntaRetimbrarModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-6 py-5 bg-indigo-50 border-b border-indigo-100 text-center">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <RotateCcw className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-bold text-indigo-900">¿Se retiran equipos para retimbrar o recargar en esta revisión?</h2>
                            <p className="text-sm text-indigo-600 mt-1">Indica si se retiran equipos para su retimbrado o recarga durante esta inspección.</p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setSeRetiranEquipos(true);
                                    setShowAvisoRetimbrarModal(true);
                                    setShowPreguntaRetimbrarModal(false);
                                    handleConfirmarPreCierre();
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Sí
                            </button>
                            <button
                                onClick={() => {
                                    setSeRetiranEquipos(false);
                                    setShowAvisoRetimbrarModal(false);
                                    setShowPreguntaRetimbrarModal(false);
                                    handleConfirmarPreCierre();
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PRE-CIERRE */}
            {showPreCierreModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="px-6 py-5 bg-indigo-50 border-b border-indigo-100 text-center">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <PenLine className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h2 className="text-lg font-bold text-indigo-900">¿Finalizar la revisión?</h2>
                            <p className="text-sm text-indigo-600 mt-1">Se solicitarán las firmas del cliente y del técnico para finalizar el parte.</p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={handleConfirmarPreCierre}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Sí, continuar con las firmas
                            </button>
                            <button
                                onClick={() => setShowPreCierreModal(false)}
                                className="w-full px-4 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver a la revisión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FIRMAS */}
            {showFirmasModal && (() => {
                const tecnicos: any[] = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
                const tecnico = tecnicos.find((t: any) => t.id === parte?.tecnicoId || t._docId === parte?.tecnicoId);
                const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : (JSON.parse(localStorage.getItem('firecheck_logged_user') || '{}')?.nombre || 'Técnico');
                return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[95vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <PenLine className="w-5 h-5 text-indigo-600" /> Firmas de conformidad
                            </h2>
                            <button
                                onClick={() => setShowFirmasModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-6">
                            {/* Firma Cliente */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">C</span>
                                        Firma del Cliente
                                        {firmaClienteOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                    </label>
                                    <button
                                        onClick={() => clearCanvas(canvasClienteRef, setFirmaClienteOk)}
                                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Borrar
                                    </button>
                                </div>
                                {/* Campo nombre cliente */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        value={nombreClienteFirma}
                                        onChange={e => setNombreClienteFirma(e.target.value)}
                                        placeholder="Nombre y apellidos del cliente..."
                                        className="w-full px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 outline-none transition-all"
                                    />
                                </div>
                                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaClienteOk ? 'border-green-400' : 'border-slate-200'}`}>
                                    <canvas
                                        ref={canvasClienteRef}
                                        width={600}
                                        height={240}
                                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                                        style={{ display: 'block' }}
                                        onMouseDown={e => startDraw(canvasClienteRef, setDrawingCliente, e)}
                                        onMouseMove={e => draw(canvasClienteRef, drawingCliente, e)}
                                        onMouseUp={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                        onMouseLeave={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(canvasClienteRef, setDrawingCliente, e); }}
                                        onTouchMove={e => { e.preventDefault(); draw(canvasClienteRef, drawingCliente, e); }}
                                        onTouchEnd={() => stopDraw(setDrawingCliente, setFirmaClienteOk, canvasClienteRef)}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">Firme con el dedo o el ratón en el recuadro</p>
                            </div>

                            {/* Firma Técnico */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">T</span>
                                        Firma del Técnico
                                        {firmaTecnicoOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                    </label>
                                    <button
                                        onClick={() => clearCanvas(canvasTecnicoRef, setFirmaTecnicoOk)}
                                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Borrar
                                    </button>
                                </div>
                                {/* Nombre técnico automático */}
                                <div className="mb-3">
                                    <div className="w-full px-3 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-sm font-semibold text-indigo-700 flex items-center gap-2">
                                        <span className="w-4 h-4 text-indigo-400">👤</span>
                                        {nombreTecnico}
                                    </div>
                                </div>
                                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaTecnicoOk ? 'border-green-400' : 'border-slate-200'}`}>
                                    <canvas
                                        ref={canvasTecnicoRef}
                                        width={600}
                                        height={240}
                                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                                        style={{ display: 'block' }}
                                        onMouseDown={e => startDraw(canvasTecnicoRef, setDrawingTecnico, e)}
                                        onMouseMove={e => draw(canvasTecnicoRef, drawingTecnico, e)}
                                        onMouseUp={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                        onMouseLeave={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                        onTouchStart={e => { e.preventDefault(); startDraw(canvasTecnicoRef, setDrawingTecnico, e); }}
                                        onTouchMove={e => { e.preventDefault(); draw(canvasTecnicoRef, drawingTecnico, e); }}
                                        onTouchEnd={() => stopDraw(setDrawingTecnico, setFirmaTecnicoOk, canvasTecnicoRef)}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">Firme con el dedo o el ratón en el recuadro</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowFirmasModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                type="button"
                                onClick={handleFinalizarConFirmas}
                                disabled={!firmaClienteOk || !firmaTecnicoOk || !nombreClienteFirma.trim()}
                                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {firmaClienteOk && firmaTecnicoOk && nombreClienteFirma.trim() ? '✓ Finalizar Parte' : 'Faltan datos'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* VENTANA FLOTANTE CONFIRMACIÓN RETIMBRADO/RECARGA EN FIRMAS */}
            {showFirmasModal && showAvisoRetimbrarModal && seRetiranEquipos && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[220]">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-red-100">
                        <div className="px-6 py-5 bg-red-50 border-b border-red-100 text-center">
                            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-7 h-7 text-red-600" />
                            </div>
                            <h2 className="text-lg font-bold text-red-900">¿Se retiran equipos para retimbrar o recargar?</h2>
                            <p className="text-sm text-red-600 mt-1">Has indicado que SÍ se van a retirar equipos durante esta revisión.</p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAvisoRetimbrarModal(false);
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Sí, es correcto
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSeRetiranEquipos(false);
                                    setShowAvisoRetimbrarModal(false);
                                }}
                                className="w-full px-4 py-3 rounded-xl font-bold text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                            >
                                No (Cambiar a NO)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMENTARIOS */}
            {showCommentsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-red-600" /> Comentarios de la revisión
                            </h2>
                            <button
                                onClick={() => setShowCommentsModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 space-y-6">
                            {/* Campo Privado */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1 flex flex-col">
                                    <span>Datos privados</span>
                                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wider mt-0.5">NO SE VERÁN EN LA DOCUMENTACIÓN</span>
                                </label>
                                <textarea
                                    value={privateComment}
                                    onChange={(e) => setPrivateComment(e.target.value)}
                                    readOnly={parte.estado === 'Cerrado'}
                                    rows={4}
                                    placeholder="Escribe aquí los comentarios internos o privados..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-normal text-slate-700 bg-slate-50/50"
                                />
                                <p className="text-[11px] text-slate-400 mt-1 font-medium">Esta información se guardará únicamente de forma interna en el parte de trabajo.</p>
                            </div>

                            {/* Campo Público */}
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1 flex flex-col">
                                    <span>Información pública</span>
                                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wider mt-0.5">SE VERÁ EN EL DOCUMENTO PDF ACTAS</span>
                                </label>
                                <textarea
                                    value={publicComment}
                                    onChange={(e) => setPublicComment(e.target.value)}
                                    readOnly={parte.estado === 'Cerrado'}
                                    rows={4}
                                    placeholder="Escribe aquí las observaciones públicas que deben aparecer en el acta..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-normal text-slate-700 bg-slate-50/50"
                                />
                                <p className="text-[11px] text-slate-400 mt-1 font-medium">Esta información quedará sincronizada en la colección de centros y se imprimirá en el acta oficial.</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setShowCommentsModal(false)}
                                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm w-full sm:w-auto"
                            >
                                {parte.estado === 'Cerrado' ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {parte.estado !== 'Cerrado' && (
                                <button
                                    onClick={handleSaveComments}
                                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm w-full sm:w-auto"
                                >
                                    Guardar comentarios
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST DE GUARDADO */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[300] flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl font-medium text-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    {toastMessage}
                </div>
            )}
            {/* OVERLAY DE ENVÍO Y SINCRONIZACIÓN A FIREBASE */}
            {isSending && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        {!sendCompleted ? (
                            <>
                                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Sincronizando datos...</h3>
                                <p className="text-xs text-slate-500 mt-1 mb-5">Guardando firmas y actualizando parte en Firebase</p>
                                
                                {/* Barra de progreso */}
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-2 p-0.5 border border-slate-200">
                                    <div 
                                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-300 shadow-sm"
                                        style={{ width: `${sendProgress}%` }}
                                    ></div>
                                </div>
                                <span className="text-[11px] font-bold text-indigo-600 font-mono">{sendProgress}%</span>
                            </>
                        ) : (
                            <div className="animate-in zoom-in-95 duration-300 py-2">
                                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-green-600 shadow-md">
                                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Parte finalizado pendiente de supervisar por el responsable</h3>
                                <p className="text-xs text-slate-500 mt-2">La revisión ha sido firmada y sincronizada correctamente.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}