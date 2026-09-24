import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, MapPin, CalendarDays, Search, Trash2, Download, Eye, X, Check, ArrowLeft, Filter, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { subscribePartes, subscribeCentros, subscribeClientes, subscribeTecnicos, deleteParte, db, updateParte, getEquiposInstalados } from './firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { generarActaExtintoresPDF, generarAlbaranPDF, generarCertificadoPDF } from './pdfGenerator';
import { generarContratoPDF } from './pdfContratoGenerator';
import { calcularAlertasExtintores, calcularAlertasBies, type ExtintorAlertas, type BieAlertas } from './recursos-compartidos/services/sistemasUtils';

interface ParteItem {
  id: string;
  centroId: string;
  nombreCentro?: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  empresaId?: string;
  periodicidad: string;
  mesesRevision: string;
  estado: string;
  fechaProgramada?: string;
  _docId?: string;
  retirarExtintoresRetimbrado?: boolean;
  retimbradoReiniciado?: boolean;
  observacionesTecnico?: string;
  cantidadRetimbrados?: number;
}

interface Cliente {
  id: string;
  nombre: string;
  cif?: string;
  direccion?: string;
  poblacion?: string;
}

interface Centro {
  _docId?: string;
  id: string;
  clienteId: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  provincia?: string;
  empresaId?: string;
  numeroContrato?: string;
  fechaInicioContrato?: string;
  fechaFinContrato?: string;
  importeAnualContrato?: string;
  observacionesContrato?: string;
}

export default function Partes() {
  const navigate = useNavigate();
  const [partes, setPartes] = useState<ParteItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]'); } catch { return []; }
  });
  const [centros, setCentros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [tecnicos, setTecnicos] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<'fecha' | 'cliente' | 'centro' | 'poblacion' | 'tipo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'fecha' | 'cliente' | 'centro' | 'poblacion' | 'tipo') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'fecha' ? 'desc' : 'asc');
    }
  };
  const [alertasExtintoresPorCentro, setAlertasExtintoresPorCentro] = useState<Record<string, ExtintorAlertas>>(() => {
    try {
      const cached = localStorage.getItem('firecheck_db_alertas_ext');
      if (cached) return JSON.parse(cached);
      const allEquipos: any[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const storedCentros: any[] = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
      const map: Record<string, ExtintorAlertas> = {};
      const equiposPorCentro: Record<string, any[]> = {};
      for (const eq of allEquipos) {
        if (eq.centroId) {
          if (!equiposPorCentro[eq.centroId]) equiposPorCentro[eq.centroId] = [];
          equiposPorCentro[eq.centroId].push(eq);
        }
      }
      for (const cId of Object.keys(equiposPorCentro)) {
        const alertRes = calcularAlertasExtintores(equiposPorCentro[cId]);
        map[cId] = alertRes;
        const cObj = storedCentros.find((c: any) => c._docId === cId || c.id === cId);
        if (cObj?._docId) map[cObj._docId] = alertRes;
        if (cObj?.id) map[cObj.id] = alertRes;
      }
      return map;
    } catch {
      return {};
    }
  });

  const [alertasBiesPorCentro, setAlertasBiesPorCentro] = useState<Record<string, BieAlertas>>(() => {
    try {
      const cached = localStorage.getItem('firecheck_db_alertas_bie');
      if (cached) return JSON.parse(cached);
      const allEquipos: any[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const storedCentros: any[] = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
      const map: Record<string, BieAlertas> = {};
      const equiposPorCentro: Record<string, any[]> = {};
      for (const eq of allEquipos) {
        if (eq.centroId) {
          if (!equiposPorCentro[eq.centroId]) equiposPorCentro[eq.centroId] = [];
          equiposPorCentro[eq.centroId].push(eq);
        }
      }
      for (const cId of Object.keys(equiposPorCentro)) {
        const alertRes = calcularAlertasBies(equiposPorCentro[cId]);
        map[cId] = alertRes;
        const cObj = storedCentros.find((c: any) => c._docId === cId || c.id === cId);
        if (cObj?._docId) map[cObj._docId] = alertRes;
        if (cObj?.id) map[cObj.id] = alertRes;
      }
      return map;
    } catch {
      return {};
    }
  });

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedParteToDownload, setSelectedParteToDownload] = useState<ParteItem | null>(null);
  const [downloadOptions, setDownloadOptions] = useState({ acta: true, certificado: true, albaran: true, contrato: false });

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isViewSignaturesModalOpen, setIsViewSignaturesModalOpen] = useState(false);
  const [parteIdToFinalize, setParteIdToFinalize] = useState<string | null>(null);
  const [parteVerFirmas, setParteVerFirmas] = useState<any | null>(null);
  const [albaranAsociado, setAlbaranAsociado] = useState<any | null>(null);
  const [nombreFirmanteEdit, setNombreFirmanteEdit] = useState('');
  const [firmaClienteRedrawOk, setFirmaClienteRedrawOk] = useState(false);
  const [firmaTecnicoRedrawOk, setFirmaTecnicoRedrawOk] = useState(false);
  const [drawingCliente, setDrawingCliente] = useState(false);
  const [drawingTecnico, setDrawingTecnico] = useState(false);
  const canvasFirmaClienteRef = useRef<HTMLCanvasElement>(null);
  const canvasFirmaTecnicoRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const unsubPartes = subscribePartes((items) => {
      const mappedItems = items.map((d: any) => ({ ...d })) as ParteItem[];
      setPartes(mappedItems);
      // Mantener sincronizado el localStorage con Firestore para toda la app
      try {
        localStorage.setItem('firecheck_db_partes', JSON.stringify(mappedItems));
      } catch (e) {
        console.warn("[StorageQuota] Error guardando firecheck_db_partes en localStorage:", e);
      }
    });
    const unsubCentros = subscribeCentros((items) => {
      setCentros(items);
    });
    const unsubClientes = subscribeClientes((items) => {
      setClientes(items);
    });
    const unsubTecnicos = subscribeTecnicos((items) => {
      setTecnicos(items);
      try {
        localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items));
      } catch (e) {
        console.warn("[StorageQuota] Error guardando firecheck_db_tecnicos en localStorage:", e);
      }
    });
    return () => {
      unsubPartes();
      unsubCentros();
      unsubClientes();
      unsubTecnicos();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (_e: MouseEvent) => {
      // Menú ya no se usa
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar equipos de extintores para alertas preventivas (+20 años y RT 5 años)
  useEffect(() => {
    const centroIds = [...new Set(partes.map(p => p.centroId).filter(Boolean))];
    if (centroIds.length === 0) return;

    let isMounted = true;

    const cargarAlertasCentros = async () => {
      const nuevosMap: Record<string, any[]> = {};

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        for (const eq of stored) {
          if (eq.centroId) {
            if (!nuevosMap[eq.centroId]) nuevosMap[eq.centroId] = [];
            nuevosMap[eq.centroId].push(eq);
          }
        }
      } catch { /* ignore */ }

      await Promise.all(centroIds.map(async (cId) => {
        try {
          const centro = centros.find(c => c._docId === cId || c.id === cId);
          const targetDocId = centro?._docId || centro?.id || cId;

          let snapInv = await getDocs(collection(db, 'centros', targetDocId, 'inventario'));
          if (snapInv.empty && centro?.id && targetDocId !== centro.id) {
            snapInv = await getDocs(collection(db, 'centros', centro.id, 'inventario'));
          }
          let snapSis = await getDocs(collection(db, 'centros', targetDocId, 'sistemas'));
          if (snapSis.empty && centro?.id && targetDocId !== centro.id) {
            snapSis = await getDocs(collection(db, 'centros', centro.id, 'sistemas'));
          }

          const seenSist = new Set<string>();
          const allDocs = [...snapInv.docs, ...snapSis.docs].filter(d => {
            if (seenSist.has(d.id)) return false;
            seenSist.add(d.id);
            return true;
          });

          const sistemasInteres = allDocs.filter(d => {
            const data = d.data();
            const nombre = ((data.tipo || '') + ' ' + (data.familia || '') + ' ' + (data.nombre || '') + ' ' + d.id).toLowerCase();
            return nombre.includes('extintor') || nombre.includes('bie') || nombre.includes('boca');
          });

          await Promise.all(sistemasInteres.map(async (sDoc) => {
            let list = await getEquiposInstalados(targetDocId, sDoc.id);
            if ((!list || list.length === 0) && centro?.id && targetDocId !== centro.id) {
              list = await getEquiposInstalados(centro.id, sDoc.id);
            }
            if (list && list.length > 0) {
              const sData = sDoc.data() || {};
              const sNombre = sData.tipo || sData.familia || sData.nombre || sDoc.id || '';
              const sTipo = sData.tipo || sDoc.id || '';
              const taggedList = list.map(e => ({
                ...e,
                sistemaNombre: e.sistemaNombre || sNombre,
                sistemaTipo: e.sistemaTipo || sTipo,
                sistemaId: e.sistemaId || sDoc.id
              }));
              const keys = [cId, targetDocId, centro?._docId, centro?.id].filter(Boolean) as string[];
              for (const k of keys) {
                if (!nuevosMap[k]) nuevosMap[k] = [];
                const otros = (nuevosMap[k] || []).filter(e => e.sistemaId !== sDoc.id);
                nuevosMap[k] = [...otros, ...taggedList];
              }
            }
          }));
        } catch { /* ignore */ }
      }));

      if (!isMounted) return;

      const resultMapExt: Record<string, ExtintorAlertas> = {};
      const resultMapBie: Record<string, BieAlertas> = {};
      for (const k of Object.keys(nuevosMap)) {
        const centro = centros.find(c => c._docId === k || c.id === k);
        const alertExt = calcularAlertasExtintores(nuevosMap[k]);
        const alertBie = calcularAlertasBies(nuevosMap[k]);
        resultMapExt[k] = alertExt;
        resultMapBie[k] = alertBie;
        if (centro?._docId) {
          resultMapExt[centro._docId] = alertExt;
          resultMapBie[centro._docId] = alertBie;
        }
        if (centro?.id) {
          resultMapExt[centro.id] = alertExt;
          resultMapBie[centro.id] = alertBie;
        }
      }
      setAlertasExtintoresPorCentro(resultMapExt);
      setAlertasBiesPorCentro(resultMapBie);
      try {
        localStorage.setItem('firecheck_db_alertas_ext', JSON.stringify(resultMapExt));
        localStorage.setItem('firecheck_db_alertas_bie', JSON.stringify(resultMapBie));
      } catch { /* ignore quota */ }
    };

    cargarAlertasCentros();

    return () => {
      isMounted = false;
    };
  }, [partes, centros]);

  const getCliente = (clienteId: string) => clientes.find(c => c.id === clienteId);
  const getCentro = (centroId: string) => centros.find(c => c._docId === centroId || c.id === centroId);

  const getTipoRevision = (periodicidad?: string): string => {
    if (!periodicidad || typeof periodicidad !== 'string') return 'Revisión General';
    const lower = periodicidad.toLowerCase();
    if (lower.includes('trimestral')) return 'Revisión Trimestral';
    if (lower.includes('anual')) return 'Revisión Anual';
    if (lower.includes('mensual')) return 'Revisión Mensual';
    return periodicidad;
  };

  const getRevisionColor = (periodicidad?: string): string => {
    if (!periodicidad || typeof periodicidad !== 'string') return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    const lower = periodicidad.toLowerCase();
    if (lower.includes('trimestral')) return 'bg-sky-100 text-sky-800 border-zinc-300';
    if (lower.includes('anual')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (lower.includes('mensual')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  };

  const formatFecha = (fecha?: any) => {
    if (!fecha) return '—';
    if (typeof fecha !== 'string') return String(fecha);
    try {
      const parts = fecha.split('-');
      if (parts.length === 3) {
        const [dia, mes, anio] = parts;
        return `${dia}/${mes}/${anio}`;
      }
      return fecha;
    } catch {
      return fecha;
    }
  };

  const irARevision = (parte: ParteItem) => {
    navigate('/revision-checklist', {
      state: {
        parteId: parte.id,
        centroId: parte.centroId,
        clienteId: parte.clienteId,
        periodicidad: parte.periodicidad,
        fechaProgramada: parte.fechaProgramada,
      }
    });
  };

  const eliminarParte = async (parte: ParteItem) => {
    if (!confirm('¿Estás seguro de eliminar este parte de trabajo?')) return;
    try {
      const docId = (parte as any)._docId || parte.id;
      await deleteParte(docId);
    } catch (err) {
      console.error('Error eliminando parte:', err);
    }
  };

  // Helper de IDs aleatorios para certificados
  const generateId = () => {
    return crypto.randomUUID();
  };

  // Dibujo de firmas
  const getPosFirma = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
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

  const startFirmaDraw = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setDrawing: (v: boolean) => void, e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosFirma(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawFirma = (canvasRef: React.RefObject<HTMLCanvasElement | null>, drawing: boolean, e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosFirma(canvas, e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopFirmaDraw = (setDrawing: (v: boolean) => void, setFirmaOk: (v: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
    setFirmaOk(hasContent);
  };

  const clearFirmaCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, setFirmaOk: (v: boolean) => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaOk(false);
  };



  // Abrir modal de finalización (con firmas editables)
  const handleFinalizarParte = (id: string) => {
    const currentParte = partes.find(p => p.id === id);
    if (!currentParte) return;

    if (currentParte.estado !== 'Pre-Cerrado') {
      alert('Este parte debe estar en estado Pre-Cerrado para poder finalizarlo.');
      return;
    }

    let firmaCliente = (currentParte as any).firmaCliente || '';
    let firmaTecnico = (currentParte as any).firmaTecnico || '';
    let nombreFirmante = (currentParte as any).nombreFirmante || '';

    if (!firmaCliente || !firmaTecnico) {
      const albaranes: any[] = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const alb = albaranes.find(a => a.parteId === id);
      if (alb) {
        firmaCliente = alb.firmaCliente || '';
        firmaTecnico = alb.firmaTecnico || '';
        nombreFirmante = alb.nombreFirmante || '';
      }
    }

    setAlbaranAsociado({ parteId: id, firmaCliente, firmaTecnico, nombreFirmante } as any);
    setNombreFirmanteEdit(nombreFirmante);
    setParteIdToFinalize(id);
    setIsSignatureModalOpen(true);
  };

  void handleFinalizarParte;



  // Ejecutar finalización del parte
  const executeFinalizarParte = async (id: string) => {
    const parteAFinalizar = partes.find(p => p.id === id);
    if (!parteAFinalizar) return;

    const getFirmaFromCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, originalFirma: string): string => {
      const canvas = canvasRef.current;
      if (!canvas) return originalFirma;
      const ctx = canvas.getContext('2d');
      if (!ctx) return originalFirma;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
      if (!hasContent) return originalFirma;
      return canvas.toDataURL('image/png');
    };

    const firmaCliente = getFirmaFromCanvas(canvasFirmaClienteRef, albaranAsociado?.firmaCliente || '');
    const firmaTecnico = getFirmaFromCanvas(canvasFirmaTecnicoRef, albaranAsociado?.firmaTecnico || '');

    const docId = (parteAFinalizar as any)._docId || id;
    try {
      await updateParte(docId, {
        estado: 'Finalizado',
        firmaCliente,
        firmaTecnico,
        nombreFirmante: nombreFirmanteEdit || albaranAsociado?.nombreFirmante || ''
      } as any);
    } catch (e) {
      console.error(e);
    }

    // Generar Certificado Automático
    try {
      const storedEquipos: any[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const eqDelCentro = storedEquipos.filter((e) => e.centroId === parteAFinalizar.centroId);

      const hasAnomalies = eqDelCentro.some((eq) =>
        Object.keys(eq).some(k => k.startsWith('check') && (eq as Record<string, any>)[k] === false)
      );

      const nuevoCertificado = {
        id: `CERT-${generateId().slice(0, 8).toUpperCase()}`,
        centroId: parteAFinalizar.centroId,
        clienteId: parteAFinalizar.clienteId,
        parteId: parteAFinalizar.id,
        fechaCreacion: new Date().toISOString(),
        estado: hasAnomalies ? 'NO favorable' : 'Favorable',
        numeroMantenimiento: (parteAFinalizar as any).numeroMantenimiento || 'Sin Número',
        tecnicoId: parteAFinalizar.tecnicoId
      };

      const certificadosExistentes = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
      localStorage.setItem('firecheck_db_certificados', JSON.stringify([...certificadosExistentes, nuevoCertificado]));
    } catch (e) {
      console.error("Error generando certificado automático", e);
    }
  };

  // Confirmar finalización definitiva
  const confirmFinalizarDefinitivo = async () => {
    if (!parteIdToFinalize || !albaranAsociado) return;

    const getFirmaFromCanvas = (canvasRef: React.RefObject<HTMLCanvasElement | null>, originalFirma: string): string => {
      const canvas = canvasRef.current;
      if (!canvas) return originalFirma;
      const ctx = canvas.getContext('2d');
      if (!ctx) return originalFirma;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasContent = Array.from(data).some((v, i) => i % 4 === 3 && v > 0);
      if (!hasContent) return originalFirma;
      return canvas.toDataURL('image/png');
    };

    const firmaCliente = getFirmaFromCanvas(canvasFirmaClienteRef, albaranAsociado.firmaCliente || '');
    const firmaTecnico = getFirmaFromCanvas(canvasFirmaTecnicoRef, albaranAsociado.firmaTecnico || '');

    try {
      const { addAlbaran } = await import('./firebase');
      await addAlbaran({
        ...albaranAsociado,
        firmaCliente,
        firmaTecnico,
        nombreFirmante: nombreFirmanteEdit || albaranAsociado.nombreFirmante
      });
    } catch (e) {
      console.error('Error actualizando firmas:', e);
    }

    await executeFinalizarParte(parteIdToFinalize);
    setIsSignatureModalOpen(false);
    setParteIdToFinalize(null);
    setAlbaranAsociado(null);
  };

  const openDownloadModal = (parte: ParteItem) => {
    setSelectedParteToDownload(parte);
    setDownloadOptions({ acta: true, certificado: true, albaran: true, contrato: false });
    setShowDownloadModal(true);
  };

  const confirmDownloadPDFs = async () => {
    if (!selectedParteToDownload) return;
    const parte = selectedParteToDownload;
    setShowDownloadModal(false);

    const centro = getCentro(parte.centroId);
    const cliente = getCliente(parte.clienteId);
    if (!centro || !cliente) {
      alert('Falta información de centro o cliente.');
      return;
    }
    
    try {
      // 1. Obtener Sistemas del centro
      const sistemasCol = collection(db, 'centros', centro._docId || centro.id, 'inventario');
      const sistemasSnap = await getDocs(sistemasCol);
      const sistemasDelCentro = sistemasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Obtener Equipos instalados
      let equiposTodos: any[] = [];
      for (const sist of sistemasDelCentro) {
          const equiposCol = collection(db, 'centros', centro._docId || centro.id, 'inventario', sist.id, 'equipos');
          const equiposSnap = await getDocs(equiposCol);
          equiposTodos = equiposTodos.concat(equiposSnap.docs.map(d => ({ id: d.id, sistemaId: sist.id, ...d.data() })));
      }

      // Ordenar equiposTodos
      equiposTodos.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

      // Tecnico nombre
      const storedTecnicos = tecnicos.length ? tecnicos : JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
      const tecnico = storedTecnicos.find((t: any) => t.id === parte.tecnicoId);
      const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'Técnico';

      const firmaCliente = (parte as any).firmaCliente || '';
      const firmaTecnico = (parte as any).firmaTecnico || '';
      const nombreFirmante = (parte as any).nombreFirmante || '';
      const numeroMantenimiento = (parte as any).numeroMantenimiento || parte.id;

      let checklistItemsPorSistema: Record<string, any[]> = {};
      try {
        const categoriasSistema = JSON.parse(localStorage.getItem('firecheck_db_sistemas_categorias') || '[]');
        const plantillasSnap = await getDocs(collection(db, 'plantillas'));
        const plantillas = plantillasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

        for (const sist of sistemasDelCentro) {
            const sistemaCat = categoriasSistema.find((c: any) => {
                const nombreSist = ((sist as any).tipo || (sist as any).familia || '').toLowerCase().trim();
                const nombreCat = (c.nombre || '').toLowerCase().trim();
                const isCocinaA = nombreSist.includes('cocina') || nombreSist.includes('campana');
                const isCocinaB = nombreCat.includes('cocina') || nombreCat.includes('campana');
                if (isCocinaA || isCocinaB) return isCocinaA && isCocinaB;
                const isGasA = (nombreSist.includes('gas') || (nombreSist.includes('extinci') && !nombreSist.includes('extintor'))) && !isCocinaA;
                const isGasB = (nombreCat.includes('gas') || (nombreCat.includes('extinci') && !nombreCat.includes('extintor'))) && !isCocinaB;
                if (isGasA || isGasB) return isGasA && isGasB;
                return nombreCat === nombreSist || nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
            });
            const sistemaNombre = sistemaCat?.nombre || (sist as any).tipo || (sist as any).familia || '';
            if (!sistemaNombre) continue;

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);
            // Buscar la plantilla que coincida con el nombre del sistema con orden de prioridad
            // 1. Coincidencia exacta
            let plantilla = plantillas.find((p: any) => {
                const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                return nombrePlantillaNorm === nombreSistemaNorm;
            });

            // 2. Coincidencia por inclusión (si una contiene a la otra)
            if (!plantilla) {
                plantilla = plantillas.find((p: any) => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    return nombrePlantillaNorm.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(nombrePlantillaNorm);
                });
            }

            // 3. Coincidencia por palabras compartidas
            if (!plantilla) {
                plantilla = plantillas.find((p: any) => {
                    const nombrePlantillaNorm = normalizarNombre(p.nombre || '');
                    const palabrasSistema = nombreSistemaNorm.split(' ').filter((w: string) => w.length > 3);
                    const palabrasPlantilla = nombrePlantillaNorm.split(' ').filter((w: string) => w.length > 3);
                    return palabrasSistema.some((ps: string) => palabrasPlantilla.some((pp: string) => ps === pp || pp.includes(ps) || ps.includes(pp)));
                });
            }

          if (plantilla) {
            const itemsCol = collection(db, 'plantillas', plantilla.id, 'items');
            const itemsSnap = await getDocs(itemsCol);
            let items = itemsSnap.docs.map(d => ({ key: d.id, ...d.data() }));
            items.sort((a: any, b: any) => (a.orden || a.order || 0) - (b.orden || b.order || 0));
            checklistItemsPorSistema[sist.id] = items;
          }
        }
      } catch (e) {
        console.error('Checklist fetch error', e);
      }

      // Obtener empresa
      let empresaSeleccionada: any = undefined;
      const empId = parte.empresaId || centro?.empresaId;
      if (empId) {
        const empresas = JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]');
        empresaSeleccionada = empresas.find((e: any) => e._docId === empId || e.id === empId || (e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === empId.trim().toLowerCase()));
        if (!empresaSeleccionada) {
            try {
                const docRef = doc(db, 'empresa', empId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    empresaSeleccionada = { _docId: docSnap.id, ...docSnap.data() };
                }
            } catch (e) {
                console.error("Error fetching empresa from Firestore", e);
            }
        }
      }

      // 1. Acta
      if (downloadOptions.acta) {
        await generarActaExtintoresPDF(
          cliente, centro, sistemasDelCentro, equiposTodos, numeroMantenimiento,
          tecnicoNombre, undefined, firmaCliente, firmaTecnico, nombreFirmante, checklistItemsPorSistema, empresaSeleccionada,
          false, parte.observacionesTecnico
        );
      }

      // 2. Certificado
      if (downloadOptions.certificado) {
        await generarCertificadoPDF(
          cliente, centro, parte, tecnicoNombre, (parte as any).estadoCertificado || undefined, sistemasDelCentro, equiposTodos,
          firmaCliente, firmaTecnico, nombreFirmante, false, empresaSeleccionada
        );
      }

      // 3. Albarán
      if (downloadOptions.albaran) {
        let numeroPedido = (parte as any).numeroPedido || '';
        try {
          const albaranesCol = collection(db, 'albaranes');
          let q = query(albaranesCol, where('parteId', '==', parte.id));
          let snap = await getDocs(q);
          if (snap.empty && (parte as any)._docId && (parte as any)._docId !== parte.id) {
            q = query(albaranesCol, where('parteId', '==', (parte as any)._docId));
            snap = await getDocs(q);
          }
          if (!snap.empty) {
            const albData = snap.docs[0].data();
            if (albData && albData.numeroPedido) {
              numeroPedido = albData.numeroPedido;
            }
          }
        } catch (err) {
          console.error("Error fetching albaran for numeroPedido:", err);
        }

        await generarAlbaranPDF(
          cliente, centro, equiposTodos, numeroMantenimiento, tecnicoNombre,
          firmaCliente, firmaTecnico, nombreFirmante, undefined, empresaSeleccionada, false, 'ALBARÁN DE REVISIÓN', parte.periodicidad, sistemasDelCentro, numeroPedido, parte.fechaCreacion
        );
      }

      // 4. Contrato de Mantenimiento
      if (downloadOptions.contrato) {
        const systemsWithCounts = sistemasDelCentro.map(s => {
          const count = equiposTodos.filter(eq => eq.sistemaId === s.id).length;
          return {
            ...s,
            cantidadEquipos: count
          };
        });

        await generarContratoPDF(
          cliente,
          centro,
          systemsWithCounts,
          {
            numeroContrato: centro.numeroContrato || '',
            fechaInicio: centro.fechaInicioContrato || '',
            fechaFin: centro.fechaFinContrato || '',
            importeAnual: centro.importeAnualContrato || '',
            observaciones: centro.observacionesContrato || '',
            formaPago: (centro as any).formaPagoContrato || ''
          },
          empresaSeleccionada
        );
      }

    } catch (error) {
      console.error('Error generando PDFs:', error);
      alert('Hubo un error al generar los documentos. Ver consola.');
    }
  };

  const partesFiltrados = partes.filter(p => {
    // 1. Filtro por tipo de estado
    if (estadoFilter !== 'TODOS') {
      const st = (p.estado || '').trim();
      const esRetimbrando = Boolean((p as any).equiposRetirados || (p as any).retimbrado || st === 'Retimbrando');
      if (estadoFilter === 'Retimbrando') {
        if (!esRetimbrando || st === 'Cerrado') return false;
      } else if (estadoFilter === 'Abierto') {
        if (st !== 'Abierto' && st !== 'Planificado' && st !== '') return false;
      } else if (estadoFilter === 'En revisión') {
        if (st !== 'En revisión' && st !== 'En curso') return false;
      } else if (estadoFilter === 'Finalizado') {
        if (st !== 'Finalizado' || esRetimbrando) return false;
      } else if (estadoFilter === 'Pre-Cerrado') {
        if (st !== 'Pre-Cerrado') return false;
      } else if (estadoFilter === 'Cerrado') {
        if (st !== 'Cerrado') return false;
      }
    }

    // 2. Búsqueda por texto
    if (search) {
      const centro = getCentro(p.centroId);
      const cliente = getCliente(p.clienteId);
      const text = `${centro?.nombre || ''} ${cliente?.nombre || ''} ${centro?.poblacion || ''} ${getTipoRevision(p.periodicidad)}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }

    return true;
  });

  // Show all parts, including those without a fechaProgramada
  const partesPlanificados = partesFiltrados.filter(p => {
    if (!startDate && !endDate) return true;
    if (!p.fechaProgramada || typeof p.fechaProgramada !== 'string' || p.fechaProgramada.trim() === '') return false;
    
    const [d, m, y] = p.fechaProgramada.split('-').map(Number);
    const dateNum = y * 10000 + m * 100 + d;
    
    let pass = true;
    if (startDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startNum = sy * 10000 + sm * 100 + sd;
      if (dateNum < startNum) pass = false;
    }
    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endNum = ey * 10000 + em * 100 + ed;
      if (dateNum > endNum) pass = false;
    }
    return pass;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === 'fecha') {
      const hasA = a.fechaProgramada && typeof a.fechaProgramada === 'string' && a.fechaProgramada.trim() !== '';
      const hasB = b.fechaProgramada && typeof b.fechaProgramada === 'string' && b.fechaProgramada.trim() !== '';
      if (!hasA && !hasB) {
        comparison = (a.fechaCreacion || '').localeCompare(b.fechaCreacion || '');
      } else if (!hasA) {
        comparison = 1;
      } else if (!hasB) {
        comparison = -1;
      } else {
        const [da, ma, ya] = (typeof a.fechaProgramada === 'string' ? a.fechaProgramada : '').split('-').map(Number);
        const [db, mb, yb] = (typeof b.fechaProgramada === 'string' ? b.fechaProgramada : '').split('-').map(Number);
        const numA = (ya || 0) * 10000 + (ma || 0) * 100 + (da || 0);
        const numB = (yb || 0) * 10000 + (mb || 0) * 100 + (db || 0);
        comparison = numA - numB;
      }
    } else if (sortField === 'cliente') {
      const clienteA = getCliente(a.clienteId)?.nombre || '';
      const clienteB = getCliente(b.clienteId)?.nombre || '';
      comparison = clienteA.localeCompare(clienteB, 'es', { sensitivity: 'base' });
    } else if (sortField === 'centro') {
      const centroA = getCentro(a.centroId)?.nombre || a.nombreCentro || '';
      const centroB = getCentro(b.centroId)?.nombre || b.nombreCentro || '';
      comparison = centroA.localeCompare(centroB, 'es', { sensitivity: 'base' });
    } else if (sortField === 'poblacion') {
      const pobA = getCentro(a.centroId)?.poblacion || '';
      const pobB = getCentro(b.centroId)?.poblacion || '';
      comparison = pobA.localeCompare(pobB, 'es', { sensitivity: 'base' });
    } else if (sortField === 'tipo') {
      const tipoA = getTipoRevision(a.periodicidad);
      const tipoB = getTipoRevision(b.periodicidad);
      comparison = tipoA.localeCompare(tipoB, 'es', { sensitivity: 'base' });
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center sm:items-start text-center sm:text-left">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div>
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                Partes de Trabajo
              </h1>
              <p className="text-xs font-semibold text-zinc-500 mt-1">Gestión, seguimiento y precierre de partes de revisión en los clientes.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                 <div className="flex items-center gap-2 bg-white px-3 rounded-xl border border-zinc-200/80 shadow-sm shrink-0 h-[52px]">
                <CalendarDays className="w-4 h-4 text-zinc-400" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="text-sm outline-none text-zinc-600 bg-transparent border-0"
                  title="Fecha inicial"
                />
                <span className="text-zinc-400 text-sm">a</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="text-sm outline-none text-zinc-650 bg-transparent border-0"
                  title="Fecha final"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="ml-1 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Limpiar fechas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Buscador */}
              <div className="relative w-full sm:w-64 shrink-0 h-[52px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" />
                <input
                  type="text"
                  placeholder="Buscar partes..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-full pl-10 pr-4 bg-white border border-zinc-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-zinc-955 shadow-sm"
                />
              </div>

              {/* Filtro por Estado con Indicador de Color (A la derecha) */}
              {(() => {
                const opcionesEstado = [
                  { value: 'TODOS', label: 'Todos los estados', colorClass: '' },
                  { value: 'Abierto', label: 'Planificado', colorClass: 'bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.8)]' },
                  { value: 'En revisión', label: 'En curso', colorClass: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' },
                  { value: 'Finalizado', label: 'Parte Finalizado (Firmado)', colorClass: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' },
                  { value: 'Retimbrando', label: 'Retimbrando', colorClass: 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse' },
                  { value: 'Pre-Cerrado', label: 'Pre-cerrado', colorClass: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' },
                  { value: 'Cerrado', label: 'Cerrado', colorClass: 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.6)]' },
                ];
                const selectedOption = opcionesEstado.find(o => o.value === estadoFilter) || opcionesEstado[0];

                return (
                  <div className="relative shrink-0 h-[52px]" ref={filterRef}>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="h-full px-4 bg-white border border-zinc-200/80 rounded-xl text-sm flex items-center justify-between gap-3 text-zinc-900 shadow-sm font-medium hover:border-zinc-300 transition-all min-w-[200px]"
                      title="Filtrar partes por estado"
                    >
                      <div className="flex items-center gap-2.5">
                        <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
                        {selectedOption.colorClass && (
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedOption.colorClass}`} />
                        )}
                        <span className="truncate">{selectedOption.label}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 min-w-[200px]">
                        {opcionesEstado.map((op) => (
                          <button
                            key={op.value}
                            type="button"
                            onClick={() => {
                              setEstadoFilter(op.value);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                              estadoFilter === op.value
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            {op.colorClass ? (
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${op.colorClass}`} />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full border border-zinc-300 shrink-0" />
                            )}
                            <span className="flex-1">{op.label}</span>
                            {estadoFilter === op.value && <Check className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-zinc-200/85 overflow-hidden">
          {partesPlanificados.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">No hay partes de trabajo planificados</p>
              <p className="text-zinc-400 text-sm mt-1">
                Los partes aparecerán aquí cuando se programen trabajos en el calendario de Planificación
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-200/90 border-b border-zinc-300 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                    <th 
                      onClick={() => handleSort('cliente')} 
                      className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                      title="Ordenar por cliente"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Cliente</span>
                        {sortField === 'cliente' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('centro')} 
                      className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                      title="Ordenar por centro"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Centro</span>
                        {sortField === 'centro' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('poblacion')} 
                      className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                      title="Ordenar por población"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Población</span>
                        {sortField === 'poblacion' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('fecha')} 
                      className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                      title="Ordenar por fecha planificada"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Fecha Planificada</span>
                        {sortField === 'fecha' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('tipo')} 
                      className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:text-zinc-950 transition-colors select-none group"
                      title="Ordenar por tipo de revisión"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Tipo Revisión</span>
                        {sortField === 'tipo' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        )}
                      </div>
                    </th>
                    <th className="text-right px-6 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {partesPlanificados.map(parte => {
                    const centro = getCentro(parte.centroId);
                    const cliente = getCliente(parte.clienteId);
                    return (
                      <tr key={parte.id} className="hover:bg-amber-50/40 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-bold text-zinc-900 text-sm">
                                {cliente?.nombre || '—'}
                              </p>
                              {cliente?.cif && (
                                <p className="text-[10px] text-zinc-400 mt-0.5">{cliente.cif}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-800 text-sm">
                            {centro?.nombre || parte.nombreCentro || '—'}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {centro?.id ? `${centro.id} - ` : ''}<span className="text-blue-600 font-bold">Parte: {(parte as any).numeroMantenimiento || parte.id}</span>
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-zinc-600">
                            {centro?.poblacion || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-zinc-800">
                            {formatFecha(parte.fechaProgramada)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-block px-3 py-1 text-[11px] font-bold rounded-full border ${getRevisionColor(parte.periodicidad)}`}>
                              {getTipoRevision(parte.periodicidad)}
                            </span>
                            {(() => {
                              const alertasExt = alertasExtintoresPorCentro[parte.centroId] ||
                                                 (centro?._docId ? alertasExtintoresPorCentro[centro._docId] : undefined) ||
                                                 (centro?.id ? alertasExtintoresPorCentro[centro.id] : undefined);
                              const alertasBie = alertasBiesPorCentro[parte.centroId] ||
                                                 (centro?._docId ? alertasBiesPorCentro[centro._docId] : undefined) ||
                                                 (centro?.id ? alertasBiesPorCentro[centro.id] : undefined);

                              const hasExtAlerts = alertasExt && (alertasExt.caducados20 > 0 || alertasExt.retimbres5 > 0);
                              const hasBieAlerts = alertasBie && (alertasBie.caducados20 > 0 || alertasBie.pruebasHidraulicas5 > 0);

                              if (!hasExtAlerts && !hasBieAlerts) return null;

                              return (
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  {alertasExt && alertasExt.caducados20 > 0 && (
                                    <span 
                                      className="inline-flex items-center text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                      title={`${alertasExt.caducados20} extintores caducados de más de 20 años`}
                                    >
                                      Ext+20 años: {alertasExt.caducados20} und.
                                    </span>
                                  )}
                                  {alertasExt && alertasExt.retimbres5 > 0 && (
                                    <span 
                                      className="inline-flex items-center text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                      title={`${alertasExt.retimbres5} extintores para retimbrar (más de 5 años)`}
                                    >
                                      RT: {alertasExt.retimbres5} und.
                                    </span>
                                  )}
                                  {alertasBie && alertasBie.caducados20 > 0 && (
                                    <span 
                                      className="inline-flex items-center text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                      title={`${alertasBie.caducados20} BIEs caducados de más de 20 años`}
                                    >
                                      Bie+20 años: {alertasBie.caducados20} und.
                                    </span>
                                  )}
                                  {alertasBie && alertasBie.pruebasHidraulicas5 > 0 && (
                                    <span 
                                      className="inline-flex items-center text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                      title={`${alertasBie.pruebasHidraulicas5} BIEs para prueba hidráulica (más de 5 años)`}
                                    >
                                      PH: {alertasBie.pruebasHidraulicas5} und.
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                             {parte.retirarExtintoresRetimbrado && !parte.retimbradoReiniciado && (
                              <span 
                                className="text-lg animate-pulse mr-2 shrink-0 select-none"
                                title="Extintores retirados para retimbrado (Pendiente)"
                              >
                                🧯
                              </span>
                            )}
                            {(parte.tecnicoId || parte.estado === 'En revisión' || parte.estado === 'Pre-Cerrado' || parte.estado === 'Finalizado' || parte.estado === 'Cerrado') && (
                              <div 
                                className={`w-2.5 h-2.5 rounded-full mr-2 shrink-0 ${
                                  parte.estado === 'Cerrado'
                                    ? 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.6)]'
                                    : (parte as any).equiposRetirados || (parte as any).retimbrado
                                      ? 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse'
                                      : parte.estado === 'Pre-Cerrado'
                                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                                        : parte.estado === 'Finalizado'
                                          ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                                          : parte.estado === 'En revisión' 
                                            ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' 
                                            : 'bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.8)]'
                                }`} 
                                title={
                                  parte.estado === 'Cerrado'
                                    ? "Revisión Cerrada"
                                    : (parte as any).equiposRetirados || (parte as any).retimbrado
                                      ? "Equipos retirados para retimbrar (Luz roja parpadeante)"
                                      : parte.estado === 'Finalizado'
                                        ? "Revisión Finalizada"
                                        : parte.estado === 'Pre-Cerrado'
                                          ? "Revisión Pre-Cerrada (Firmada)" 
                                          : parte.estado === 'En revisión' 
                                            ? "Revisión Empezada" 
                                            : "Planificado"
                                }
                              ></div>
                            )}
                            <button
                              onClick={() => irARevision(parte)}
                              className="p-2 rounded-xl hover:bg-sky-50 text-red-600 transition-colors"
                              title={(parte.estado === 'Pre-Cerrado' || parte.estado === 'Finalizado' || parte.estado === 'Cerrado') ? "Revisar parte finalizado" : "Ir a Revisión"}
                            >
                              {(parte.estado === 'Pre-Cerrado' || parte.estado === 'Finalizado' || parte.estado === 'Cerrado') ? <Eye className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </button>
                            
                            {(parte.estado === 'Pre-Cerrado' || parte.estado === 'Finalizado' || parte.estado === 'Cerrado' || parte.estado === 'Descargado (Offline)' || (parte as any).firmaCliente) && (
                              <button
                                onClick={() => openDownloadModal(parte)}
                                className="p-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors"
                                title="Descargar PDFs"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            )}

                            <button
                              onClick={() => eliminarParte(parte)}
                              className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
          <span>Total: {partesPlanificados.length} parte{partesPlanificados.length !== 1 ? 's' : ''} planificado{partesPlanificados.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Modal de Opciones de Descarga PDF */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-white">
              <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                Descargar Documentos
              </h3>
              <button 
                onClick={() => setShowDownloadModal(false)}
                className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-zinc-600 mb-5">Selecciona los documentos que deseas generar y descargar:</p>
              
              <div className="space-y-3">
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.acta ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.acta && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.acta}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, acta: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Acta de Revisión</span>
                </label>
                
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.certificado ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.certificado && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.certificado}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, certificado: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Certificado</span>
                </label>
                
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.albaran ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.albaran && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.albaran}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, albaran: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Albarán de Trabajo</span>
                </label>
 
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.contrato ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.contrato && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.contrato}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, contrato: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Contrato de Mantenimiento</span>
                </label>
              </div>
 
              <div className="mt-6 pt-5 border-t border-zinc-100 flex gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDownloadPDFs}
                  disabled={!downloadOptions.acta && !downloadOptions.certificado && !downloadOptions.albaran && !downloadOptions.contrato}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualización de Firmas */}
      {isViewSignaturesModalOpen && parteVerFirmas && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">Firmas del Parte</h2>
              <button onClick={() => { setIsViewSignaturesModalOpen(false); setParteVerFirmas(null); }} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400 uppercase">Firmante del Cliente</label>
                <p className="text-sm font-bold text-zinc-800">{parteVerFirmas.nombreFirmante || 'No especificado'}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Firma del Cliente</label>
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-32 flex items-center justify-center">
                  {parteVerFirmas.firmaCliente ? (
                    <img src={parteVerFirmas.firmaCliente} alt="Firma Cliente" className="max-h-full object-contain" />
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No disponible</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Firma del Técnico</label>
                <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-32 flex items-center justify-center">
                  {parteVerFirmas.firmaTecnico ? (
                    <img src={parteVerFirmas.firmaTecnico} alt="Firma Técnico" className="max-h-full object-contain" />
                  ) : (
                    <p className="text-sm text-zinc-400 italic">No disponible</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex justify-end shrink-0">
              <button
                onClick={() => { setIsViewSignaturesModalOpen(false); setParteVerFirmas(null); }}
                className="px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Firma y Finalización */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">Revisión de Firmas y Finalización</h2>
              <button onClick={() => setIsSignatureModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {albaranAsociado ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase">Firmante del Cliente</label>
                    <input
                      type="text"
                      value={nombreFirmanteEdit}
                      onChange={e => setNombreFirmanteEdit(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
                        Firma del Cliente
                        {firmaClienteRedrawOk && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </label>
                      <button
                        onClick={() => clearFirmaCanvas(canvasFirmaClienteRef, setFirmaClienteRedrawOk)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-650 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Borrar dibujo
                      </button>
                    </div>
                    <div className="mb-2 border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-24 flex items-center justify-center">
                      <img src={albaranAsociado.firmaCliente || ''} alt="Firma Cliente original" className="max-h-full object-contain opacity-70" />
                    </div>
                    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaClienteRedrawOk ? 'border-green-400' : 'border-zinc-200'}`}>
                      <canvas
                        ref={canvasFirmaClienteRef}
                        width={600}
                        height={180}
                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                        style={{ display: 'block' }}
                        onMouseDown={e => startFirmaDraw(canvasFirmaClienteRef, setDrawingCliente, e)}
                        onMouseMove={e => drawFirma(canvasFirmaClienteRef, drawingCliente, e)}
                        onMouseUp={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                        onMouseLeave={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                        onTouchStart={e => { e.preventDefault(); startFirmaDraw(canvasFirmaClienteRef, setDrawingCliente, e); }}
                        onTouchMove={e => { e.preventDefault(); drawFirma(canvasFirmaClienteRef, drawingCliente, e); }}
                        onTouchEnd={() => stopFirmaDraw(setDrawingCliente, setFirmaClienteRedrawOk, canvasFirmaClienteRef)}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Dibuje encima si desea modificar la firma</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-2">
                        Firma del Técnico
                        {firmaTecnicoRedrawOk && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      </label>
                      <button
                        onClick={() => clearFirmaCanvas(canvasFirmaTecnicoRef, setFirmaTecnicoRedrawOk)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-650 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Borrar dibujo
                      </button>
                    </div>
                    <div className="mb-2 border border-zinc-200 rounded-2xl bg-zinc-50 p-2 h-24 flex items-center justify-center">
                      <img src={albaranAsociado.firmaTecnico || ''} alt="Firma Técnico original" className="max-h-full object-contain opacity-70" />
                    </div>
                    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${firmaTecnicoRedrawOk ? 'border-green-400' : 'border-zinc-200'}`}>
                      <canvas
                        ref={canvasFirmaTecnicoRef}
                        width={600}
                        height={180}
                        className="w-full touch-none bg-slate-50 cursor-crosshair"
                        style={{ display: 'block' }}
                        onMouseDown={e => startFirmaDraw(canvasFirmaTecnicoRef, setDrawingTecnico, e)}
                        onMouseMove={e => drawFirma(canvasFirmaTecnicoRef, drawingTecnico, e)}
                        onMouseUp={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                        onMouseLeave={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                        onTouchStart={e => { e.preventDefault(); startFirmaDraw(canvasFirmaTecnicoRef, setDrawingTecnico, e); }}
                        onTouchMove={e => { e.preventDefault(); drawFirma(canvasFirmaTecnicoRef, drawingTecnico, e); }}
                        onTouchEnd={() => stopFirmaDraw(setDrawingTecnico, setFirmaTecnicoRedrawOk, canvasFirmaTecnicoRef)}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 text-center">Dibuje encima si desea modificar la firma</p>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-zinc-500">Cargando datos de firma...</p>
              )}
            </div>
            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3 shrink-0">
              <button onClick={() => setIsSignatureModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmFinalizarDefinitivo} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all">
                Finalizar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}