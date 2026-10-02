import { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Search, X,
  ChevronRight, Layers, Clock, Filter,
  DownloadCloud, CheckCircle2, RefreshCw, HardDrive, Database,
  Zap, AlertTriangle, SlidersHorizontal,
  FileText, Check, Download
} from 'lucide-react';
import { db, subscribePartes, subscribeCentroSistemas, subscribeClientes, subscribeCentros, updateParte, getEquiposInstalados } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getPlantillas } from './plantillas';
import { saveParteOfflineBundle, getParteOfflineBundle, getOfflineDiagnostics, type OfflineParteBundle } from './offlineDB';
import { generarActaExtintoresPDF, generarCertificadoPDF } from './pdfGenerator';
import { useNavigate } from 'react-router-dom';
import type { Parte, Centro, Cliente, CentroSistema } from './Centros';
import type { Tecnico } from './firebase';
import { calcularAlertasExtintores, calcularAlertasBies, esEquipoExtintor, esEquipoBie, esSistemaExtintores, esSistemaBies, type ExtintorAlertas, type BieAlertas } from './recursos-compartidos/services/sistemasUtils';

interface PartesTecnicoProps {
  loggedUser: { id: string; nombre: string; apellidos: string; rol: string };
  onBack: () => void;
}

export default function PartesTecnico({ loggedUser, onBack }: PartesTecnicoProps) {
  const navigate = useNavigate();

  const [partes, setPartes] = useState<Parte[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]'); } catch { return []; }
  });
  const [centros, setCentros] = useState<Centro[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'); } catch { return []; }
  });
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'); } catch { return []; }
  });
  const [tecnicos] = useState<Tecnico[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'); } catch { return []; }
  });
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>(() => {
    try { return JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'); } catch { return []; }
  });
  const [alertasExtintoresPorCentro, setAlertasExtintoresPorCentro] = useState<Record<string, ExtintorAlertas>>(() => {
    try {
      const allEquipos: any[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const storedCentros: any[] = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
      const map: Record<string, ExtintorAlertas> = {};
      const equiposPorCentro: Record<string, any[]> = {};
      for (const eq of allEquipos) {
        if (eq.centroId && esEquipoExtintor(eq)) {
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
      const allEquipos: any[] = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
      const storedCentros: any[] = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
      const map: Record<string, BieAlertas> = {};
      const equiposPorCentro: Record<string, any[]> = {};
      for (const eq of allEquipos) {
        if (eq.centroId && esEquipoBie(eq)) {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [downloadingParteId, setDownloadingParteId] = useState<string | null>(null);
  const [downloadedPartesMap, setDownloadedPartesMap] = useState<Record<string, boolean>>({});
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagInfo, setDiagInfo] = useState<any>(null);
  const [showModoModal, setShowModoModal] = useState(true);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [parteSeleccionadoPdf, setParteSeleccionadoPdf] = useState<{ target: Parte; esAnterior: boolean } | null>(null);
  const [pdfOptions, setPdfOptions] = useState({ acta: true, certificado: true });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Comprobar si una revisión ha sido realizada
  const estaRealizado = (p: Parte) => {
    return p.estado === 'Pre-Cerrado' ||
           p.estado === 'Finalizado' ||
           p.estado === 'Cerrado' ||
           Boolean((p as any).firmaCliente) ||
           Boolean((p as any).firmaTecnico) ||
           Boolean((p as any).firmado);
  };

  // Obtener el parte correspondiente para mostrar el PDF:
  // Si este parte ya está realizado, devuelve este parte.
  // Si aún está planificado/abierto, busca el último parte completado del mismo centro para que el técnico lo consulte en las próximas revisiones.
  const getParteConPdf = (p: Parte): { target: Parte; esAnterior: boolean } | null => {
    if (estaRealizado(p)) {
      return { target: p, esAnterior: false };
    }
    const centroObj = centros.find(c => c._docId === p.centroId || c.id === p.centroId);
    const cId = p.centroId;
    const cDocId = centroObj?._docId;

    const partesMismoCentro = partes.filter(item =>
      (item.centroId === cId || (cDocId && item.centroId === cDocId)) &&
      item.id !== p.id &&
      estaRealizado(item)
    ).sort((a, b) => {
      const fa = a.fechaProgramada || a.fechaCreacion || '';
      const fb = b.fechaProgramada || b.fechaCreacion || '';
      return fb.localeCompare(fa);
    });

    if (partesMismoCentro.length > 0) {
      return { target: partesMismoCentro[0], esAnterior: true };
    }
    return null;
  };

  const handleAbrirPdfModal = (p: Parte, e: React.MouseEvent) => {
    e.stopPropagation();
    const info = getParteConPdf(p);
    if (!info) {
      alert('Aún no se ha realizado ninguna revisión con PDF disponible para este centro.');
      return;
    }
    setParteSeleccionadoPdf(info);
    setPdfOptions({ acta: true, certificado: true });
    setShowPdfModal(true);
  };

  const confirmarDescargaPdf = async () => {
    if (!parteSeleccionadoPdf) return;
    const { target: parte } = parteSeleccionadoPdf;
    setIsGeneratingPdf(true);

    try {
      const centro = centros.find(c => c._docId === parte.centroId || c.id === parte.centroId);
      const cliente = clientes.find(cl => cl.id === parte.clienteId);
      if (!centro || !cliente) {
        alert('Falta información del centro o cliente para generar el PDF.');
        setIsGeneratingPdf(false);
        return;
      }

      // Intentar obtener datos del bundle offline primero si está descargado
      let offlineBundle = await getParteOfflineBundle(parte.id);
      let sistemasDelCentro: any[] = offlineBundle?.sistemasDelCentro || [];
      let equiposTodos: any[] = offlineBundle?.equiposInstalados || [];
      let checklistItemsPorSistema: Record<string, any[]> = offlineBundle?.checklistItemsPorSistema || {};

      // Si no hay bundle offline o faltan sistemas/equipos, cargar desde Firestore
      if (sistemasDelCentro.length === 0) {
        try {
          const targetCentroId = centro._docId || centro.id || parte.centroId;
          const [sistemasInvSnap, sistemasSisSnap] = await Promise.all([
            getDocs(collection(db, 'centros', targetCentroId, 'inventario')),
            getDocs(collection(db, 'centros', targetCentroId, 'sistemas'))
          ]);
          const seen = new Set<string>();
          sistemasDelCentro = [...sistemasInvSnap.docs, ...sistemasSisSnap.docs]
            .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
            .map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('Error fetching sistemas from Firestore, fallback to local', e);
          sistemasDelCentro = centroSistemas.filter(s => s.centroId === centro._docId || s.centroId === centro.id);
        }
      }

      if (equiposTodos.length === 0) {
        try {
          const targetCentroId = centro._docId || centro.id || parte.centroId;
          let tempEquipos: any[] = [];
          for (const sist of sistemasDelCentro) {
            const eqSnap = await getDocs(collection(db, 'centros', targetCentroId, 'inventario', sist.id, 'equipos'));
            tempEquipos = tempEquipos.concat(eqSnap.docs.map(d => ({ id: d.id, sistemaId: sist.id, ...d.data() })));
          }
          equiposTodos = tempEquipos;
        } catch (e) {
          console.warn('Error fetching equipos from Firestore, fallback to local', e);
          const allStored = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
          equiposTodos = allStored.filter((eq: any) => eq.centroId === centro._docId || eq.centroId === centro.id || eq.centroId === parte.centroId);
        }
      }

      equiposTodos.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

      // Cargar plantillas si no están en el bundle
      if (Object.keys(checklistItemsPorSistema).length === 0) {
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

          const cleanNorm = (str: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

          for (const sist of sistemasDelCentro) {
            const rawSistNombre = ((sist as any).tipo || (sist as any).familia || (sist as any).descripcion || (sist as any).nombre || '').toLowerCase();
            const esAspiracion = rawSistNombre.includes('aspiraci') || rawSistNombre.includes('aspirac') || rawSistNombre.includes('asd');

            const sistemaCat = categoriasSistema.find((c: any) => {
              const nombreSist = cleanNorm((sist as any).tipo || (sist as any).familia || (sist as any).descripcion || '');
              const nombreCat = cleanNorm(c.nombre || '');
              if (nombreCat && nombreSist && nombreCat === nombreSist) return true;
              const isAspA = nombreSist.includes('aspiraci') || nombreSist.includes('aspirac') || nombreSist.includes('asd');
              const isAspB = nombreCat.includes('aspiraci') || nombreCat.includes('aspirac') || nombreCat.includes('asd');
              if (isAspA || isAspB) return isAspA && isAspB;
              const isMonoxA = nombreSist.includes('monoxido') || nombreSist.includes('monox');
              const isMonoxB = nombreCat.includes('monoxido') || nombreCat.includes('monox');
              if (isMonoxA || isMonoxB) return isMonoxA && isMonoxB;
              const isCocinaA = nombreSist.includes('cocina') || nombreSist.includes('campana');
              const isCocinaB = nombreCat.includes('cocina') || nombreCat.includes('campana');
              if (isCocinaA || isCocinaB) return isCocinaA && isCocinaB;
              const isEspumaA = nombreSist.includes('espuma');
              const isEspumaB = nombreCat.includes('espuma');
              if (isEspumaA || isEspumaB) return isEspumaA && isEspumaB;
              const isAguaA = nombreSist.includes('agua') && !isEspumaA;
              const isAguaB = nombreCat.includes('agua') && !isEspumaB;
              if (isAguaA || isAguaB) return isAguaA && isAguaB;
              const isGasA = (nombreSist.includes('gas') || (nombreSist.includes('extinci') && !nombreSist.includes('extintor'))) && !isCocinaA && !isEspumaA && !isAguaA;
              const isGasB = (nombreCat.includes('gas') || (nombreCat.includes('extinci') && !nombreCat.includes('extintor'))) && !isCocinaB && !isEspumaB && !isAguaB;
              if (isGasA || isGasB) return isGasA && isGasB;
              return nombreCat.includes(nombreSist) || nombreSist.includes(nombreCat);
            });
            const sistemaNombre = sistemaCat?.nombre || (sist as any).tipo || (sist as any).familia || '';
            if (!sistemaNombre) continue;

            const nombreSistemaNorm = normalizarNombre(sistemaNombre);
            let plantilla: any = null;

            if (esAspiracion || nombreSistemaNorm.includes('aspirac') || nombreSistemaNorm.includes('asd')) {
              plantilla = plantillas.find((p: any) => {
                const np = normalizarNombre(p.nombre || '');
                return np.includes('aspirac') || np.includes('asd');
              });
            }
            if (!plantilla) {
              plantilla = plantillas.find((p: any) => normalizarNombre(p.nombre || '') === nombreSistemaNorm);
            }
            if (!plantilla) {
              plantilla = plantillas.find((p: any) => {
                const np = normalizarNombre(p.nombre || '');
                if (np.includes('aspirac') || np.includes('asd') || np.includes('monox')) return false;
                return np.includes(nombreSistemaNorm) || nombreSistemaNorm.includes(np);
              });
            }
            if (!plantilla) {
              plantilla = plantillas.find((p: any) => {
                const np = normalizarNombre(p.nombre || '');
                if (np.includes('aspirac') || np.includes('asd') || np.includes('monox')) return false;
                const ps = nombreSistemaNorm.split(' ').filter((w: string) => w.length > 3);
                const pp = np.split(' ').filter((w: string) => w.length > 3);
                return ps.some((x: string) => pp.some((y: string) => x === y || y.includes(x) || x.includes(y)));
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
          console.warn('Error fetching plantillas for PDF:', e);
        }
      }

      // Nombre del técnico
      const storedTecnicos = tecnicos.length ? tecnicos : JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
      const tecnico = storedTecnicos.find((t: any) => t.id === parte.tecnicoId);
      const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : `${loggedUser.nombre} ${loggedUser.apellidos || ''}`.trim() || 'Técnico';

      const firmaCliente = (parte as any).firmaCliente || '';
      const firmaTecnico = (parte as any).firmaTecnico || '';
      const nombreFirmante = (parte as any).nombreFirmante || '';
      const numeroMantenimiento = (parte as any).numeroMantenimiento || parte.id;

      // Empresa
      let empresaSeleccionada: any = undefined;
      const empId = parte.empresaId || centro?.empresaId;
      if (empId) {
        const empresas = JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]');
        empresaSeleccionada = empresas.find((e: any) => e._docId === empId || e.id === empId || (e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === empId.trim().toLowerCase()));
      }
      if (!empresaSeleccionada) {
        const empSingle = JSON.parse(localStorage.getItem('firecheck_db_empresa') || 'null');
        if (empSingle) empresaSeleccionada = empSingle;
      }

      // 1. Generar Acta si está seleccionada
      if (pdfOptions.acta) {
        await generarActaExtintoresPDF(
          cliente, centro, sistemasDelCentro, equiposTodos, numeroMantenimiento,
          tecnicoNombre, undefined, firmaCliente, firmaTecnico, nombreFirmante, checklistItemsPorSistema, empresaSeleccionada,
          false, parte.observacionesTecnico
        );
      }

      // 2. Generar Certificado si está seleccionado
      if (pdfOptions.certificado) {
        await generarCertificadoPDF(
          cliente, centro, parte, tecnicoNombre, (parte as any).estadoCertificado || undefined, sistemasDelCentro, equiposTodos,
          firmaCliente, firmaTecnico, nombreFirmante, false, empresaSeleccionada
        );
      }

      setShowPdfModal(false);
    } catch (err) {
      console.error('Error al generar PDF en el dispositivo:', err);
      alert('Error al generar el PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Cargar mapa de partes descargados en IndexedDB
  useEffect(() => {
    const checkDownloaded = async () => {
      const map: Record<string, boolean> = {};
      for (const p of partes) {
        try {
          const bundle = await getParteOfflineBundle(p.id);
          if (bundle) map[p.id] = true;
        } catch { /* ignore */ }
      }
      setDownloadedPartesMap(map);
    };
    if (partes.length > 0) {
      checkDownloaded();
    }
  }, [partes]);

  const handleDescargarParteOffline = async (parteToDownload: Parte, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingParteId(parteToDownload.id);

    try {
      const centro = centros.find(c => c._docId === parteToDownload.centroId || c.id === parteToDownload.centroId);
      const cliente = clientes.find(cl => cl.id === parteToDownload.clienteId);
      const sistemas = centroSistemas.filter(s => s.centroId === parteToDownload.centroId || (centro && s.centroId === centro.id));

      const equiposInstalados: any[] = [];
      for (const sist of sistemas) {
        try {
          const eqList = await getEquiposInstalados(parteToDownload.centroId, sist.id);
          equiposInstalados.push(...eqList);
        } catch (err) {
          console.warn('Error cargando equipos para offline:', sist.id, err);
        }
      }

      let plantillas: any[] = [];
      try {
        plantillas = await getPlantillas();
      } catch { /* ignore */ }

      const bundle: OfflineParteBundle = {
        parteId: parteToDownload.id,
        centroId: parteToDownload.centroId,
        clienteId: parteToDownload.clienteId,
        parte: parteToDownload,
        cliente: cliente || null,
        centro: centro || null,
        sistemasDelCentro: sistemas,
        equiposInstalados,
        checklistItemsPorSistema: {},
        plantillas,
        categoriasSistema: [],
        equiposCatalogo: [],
        downloadedAt: new Date().toISOString(),
        syncStatus: 'downloaded'
      };

      await saveParteOfflineBundle(bundle);
      try {
        await updateParte(parteToDownload.id, { estado: 'Descargado (Offline)' } as any);
      } catch { /* offline mode ignore */ }

      setDownloadedPartesMap(prev => ({ ...prev, [parteToDownload.id]: true }));
      alert(`✅ Parte "${parteToDownload.numeroMantenimiento || parteToDownload.id}" descargado con éxito en IndexedDB para trabajo Offline.`);
    } catch (err) {
      console.error('Error descargando parte offline:', err);
      alert('Error guardando el parte en IndexedDB.');
    } finally {
      setDownloadingParteId(null);
    }
  };

  const handleOpenDiag = async () => {
    try {
      const diag = await getOfflineDiagnostics();
      setDiagInfo(diag);
      setShowDiagModal(true);
    } catch (err) {
      alert('Error cargando diagnóstico: ' + err);
    }
  };

  // Suscripción en tiempo real a partes desde Firestore
  useEffect(() => {
    const unsub = subscribePartes((items) => {
      const mapped = items.map((d: any) => ({ ...d })) as Parte[];
      setPartes(mapped);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(mapped));
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a clientes desde Firestore
  useEffect(() => {
    const unsub = subscribeClientes((items) => {
      setClientes(items as Cliente[]);
      localStorage.setItem('firecheck_db_clientes', JSON.stringify(items));
    });
    return () => unsub();
  }, []);

  // Suscripción en tiempo real a centros desde Firestore
  useEffect(() => {
    const unsub = subscribeCentros((items) => {
      setCentros(items as Centro[]);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(items));
    });
    return () => unsub();
  }, []);

  // Suscripción a todos los sistemas de centros que aparecen en los partes del técnico
  useEffect(() => {
    const centroIds = [...new Set(partes.map(p => p.centroId).filter(Boolean))];
    if (centroIds.length === 0) return;

    const unsubs = centroIds.map(centroId =>
      subscribeCentroSistemas(centroId, (items: CentroSistema[]) => {
        setCentroSistemas(prev => {
          const otros = prev.filter(s => s.centroId !== centroId);
          return [...otros, ...items];
        });
      })
    );
    return () => unsubs.forEach(u => u());
  }, [partes.length]);

  // Buscar el técnico que corresponde al usuario logueado (por nombre)
  const tecnicoLogueado = tecnicos.find(t =>
    t.nombre?.toLowerCase() === loggedUser?.nombre?.toLowerCase()
  );

  // Filtrar partes asignados a este técnico (excluir Cerrado y Finalizado)
  const partesDelTecnico = partes.filter(p =>
    p.estado !== 'Cerrado' &&
    (tecnicoLogueado ? (p.tecnicoId === tecnicoLogueado.id || p.tecnicoId === tecnicoLogueado._docId) : true)
  ).sort((a, b) => {
    const fa = a.fechaProgramada || a.fechaCreacion || '';
    const fb = b.fechaProgramada || b.fechaCreacion || '';
    return fa.localeCompare(fb);
  });

  // Filtrar por estado, buscador (fecha o nombre de centro) y rango de fechas
  const partesFiltrados = partesDelTecnico.filter(p => {
    if (estadoFilter !== 'TODOS') {
      const st = (p.estado || '').trim();
      if (estadoFilter === 'Abierto') {
        if (st !== 'Abierto' && st !== 'Planificado' && st !== '') return false;
      } else if (estadoFilter === 'En revisión') {
        if (st !== 'En revisión' && st !== 'En curso') return false;
      } else if (estadoFilter === 'Finalizado') {
        if (st !== 'Finalizado') return false;
      } else if (estadoFilter === 'Pre-Cerrado') {
        if (st !== 'Pre-Cerrado') return false;
      } else if (estadoFilter === 'Cerrado') {
        if (st !== 'Cerrado') return false;
      }
    }

    let matchesSearch = true;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const centro = centros.find(c => c._docId === p.centroId || c.id === p.centroId);
      const cliente = clientes.find(cl => cl.id === p.clienteId);
      const fechaStr = (p.fechaProgramada || '').replace(/-/g, '/');
      matchesSearch = (
        (centro?.nombre || '').toLowerCase().includes(term) ||
        (cliente?.nombre || '').toLowerCase().includes(term) ||
        fechaStr.includes(term) ||
        (p.fechaProgramada || '').includes(term)
      );
    }
    
    if (!matchesSearch) return false;

    // Date range match
    if (!startDate && !endDate) return true;
    if (!p.fechaProgramada) return false;
    
    const [d, m, y] = p.fechaProgramada.split('-').map(Number);
    const dateNum = y * 10000 + m * 100 + d;
    
    if (startDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const startNum = sy * 10000 + sm * 100 + sd;
      if (dateNum < startNum) return false;
    }
    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endNum = ey * 10000 + em * 100 + ed;
      if (dateNum > endNum) return false;
    }
    
    return true;
  });

  // Cargar equipos de extintores y BIEs para alertas preventivas (+20 años, RT 5 años, PH 5 años)
  // Solo lee los partes planificados o en curso que se muestran en pantalla
  const ejecutarCargaAlertas = async (mostrarLoading: boolean) => {
    if (mostrarLoading) setLoadingAlertas(true);

    try {
      // Filtrar únicamente los partes que se muestran en pantalla con estado planificado o en curso
      const partesObjetivo = partesFiltrados.filter(p => {
        const st = (p.estado || '').toLowerCase().trim();
        return st === 'planificado' || st === 'en curso' || st === 'abierto' || st === 'en revisión';
      });

      const centroIds = [...new Set(partesObjetivo.map(p => p.centroId).filter(Boolean))];
      if (centroIds.length === 0) {
        return;
      }

      const nuevosMapExt: Record<string, any[]> = {};
      const nuevosMapBie: Record<string, any[]> = {};

      try {
        const stored = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
        for (const eq of stored) {
          if (eq.centroId) {
            if (esEquipoExtintor(eq)) {
              if (!nuevosMapExt[eq.centroId]) nuevosMapExt[eq.centroId] = [];
              nuevosMapExt[eq.centroId].push(eq);
            }
            if (esEquipoBie(eq)) {
              if (!nuevosMapBie[eq.centroId]) nuevosMapBie[eq.centroId] = [];
              nuevosMapBie[eq.centroId].push(eq);
            }
          }
        }
      } catch { /* ignore */ }

      await Promise.all(centroIds.map(async (cId) => {
        try {
          const centro = centros.find(c => c._docId === cId || c.id === cId);
          const targetDocId = centro?._docId || centro?.id || cId;

          const [snapInv, snapSis] = await Promise.all([
            getDocs(collection(db, 'centros', targetDocId, 'inventario')),
            getDocs(collection(db, 'centros', targetDocId, 'sistemas'))
          ]);

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
              const isExtSist = esSistemaExtintores(sDoc.id) || esSistemaExtintores(sNombre);
              const isBieSist = esSistemaBies(sDoc.id) || esSistemaBies(sNombre);
              const taggedList = list.map(e => ({
                ...e,
                sistemaNombre: e.sistemaNombre || sNombre,
                sistemaTipo: e.sistemaTipo || sTipo,
                sistemaId: e.sistemaId || sDoc.id
              }));
              const keysToPopulate = [cId, targetDocId, centro?._docId, centro?.id].filter(Boolean) as string[];
              for (const key of keysToPopulate) {
                if (isExtSist) {
                  if (!nuevosMapExt[key]) nuevosMapExt[key] = [];
                  const otros = (nuevosMapExt[key] || []).filter(e => e.sistemaId !== sDoc.id);
                  nuevosMapExt[key] = [...otros, ...taggedList];
                }
                if (isBieSist) {
                  if (!nuevosMapBie[key]) nuevosMapBie[key] = [];
                  const otros = (nuevosMapBie[key] || []).filter(e => e.sistemaId !== sDoc.id);
                  nuevosMapBie[key] = [...otros, ...taggedList];
                }
              }
            }
          }));
        } catch { /* ignore */ }
      }));

      const resultMapExt: Record<string, ExtintorAlertas> = {};
      const resultMapBie: Record<string, BieAlertas> = {};
      const allTargetKeys = new Set([...Object.keys(nuevosMapExt), ...Object.keys(nuevosMapBie), ...centroIds]);
      for (const cId of allTargetKeys) {
        const centro = centros.find(c => c._docId === cId || c.id === cId);
        const alertExt = calcularAlertasExtintores(nuevosMapExt[cId] || []);
        const alertBie = calcularAlertasBies(nuevosMapBie[cId] || []);
        resultMapExt[cId] = alertExt;
        resultMapBie[cId] = alertBie;
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
    } finally {
      if (mostrarLoading) setLoadingAlertas(false);
      setShowModoModal(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Planificado':
        return 'bg-zinc-200 text-zinc-700 border border-zinc-300';
      case 'Abierto':
      case 'En curso':
      case 'En revisión':
        return 'bg-amber-100 text-amber-700';
      case 'Descargado (Offline)':
        return 'bg-sky-100 text-sky-700';
      case 'Finalizado':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'Pre-Cerrado':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'Cerrado':
        return 'bg-zinc-900 text-white';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  };

  // Al pulsar un parte → cambiar estado a Abierto si estaba Planificado, luego ir a revisión
  const handleAbrirParte = async (parte: Parte) => {
    if (parte.estado === 'Planificado') {
      try {
        await updateParte(parte.id, { estado: 'Abierto' } as any);
        // Actualizar también en localStorage
        const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
        const updatedPartes = storedPartes.map((p: any) =>
          p.id === parte.id ? { ...p, estado: 'Abierto' } : p
        );
        localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
      } catch (err) {
        console.error('Error actualizando estado del parte:', err);
      }
    }
    navigate('/revision-checklist', {
      state: { centroId: parte.centroId, parteId: parte.id }
    });
  };

  // ─── VISTA LISTA DE PARTES ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1d3557] pb-12">
      {/* Header Fijo */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-zinc-500 hover:text-black transition-colors rounded-xl hover:bg-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-zinc-900">Mis Partes</h1>
            <p className="text-[11px] text-zinc-500">
              {tecnicoLogueado
                ? `${tecnicoLogueado.nombre} ${tecnicoLogueado.apellidos}`
                : loggedUser.nombre}
              {' · '}{partesFiltrados.length} parte{partesFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowModoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            title="Opciones de visualización y alertas"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Alertas</span>
          </button>
        </div>

        {/* Buscador, Filtro de Estado y Rango de fechas */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-red-500/80 shadow-sm">
            <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="text-sm outline-none text-zinc-600 bg-transparent flex-1"
            />
            <span className="text-zinc-400 text-sm">a</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="text-sm outline-none text-zinc-600 bg-transparent flex-1"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 text-zinc-400 hover:text-red-500 rounded-md transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none z-10" />
              <select
                value={estadoFilter}
                onChange={e => setEstadoFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-red-500/80 rounded-xl text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm text-zinc-950 appearance-none font-medium cursor-pointer"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="Abierto">Abierto / Planificado</option>
                <option value="En revisión">En revisión / En curso</option>
                <option value="Finalizado">Parte Finalizado / Firmado</option>
                <option value="Pre-Cerrado">Pre-cerrado</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, centro o fecha..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-red-500/80 rounded-xl text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm text-zinc-950"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Lista de partes */}
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4">
        {partesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/60">
            <Calendar className="w-16 h-16 mb-4 opacity-40 text-white" />
            <p className="font-bold text-sm text-center text-white">
              {searchTerm ? 'Sin resultados para tu búsqueda' : 'No tienes partes asignados'}
            </p>
            <p className="text-xs text-center mt-1 text-white/60">
              {searchTerm ? 'Prueba con otro término' : 'Cuando se te asigne un parte aparecerá aquí'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partesFiltrados.map(parte => {
              const centro = centros.find(c => c._docId === parte.centroId || c.id === parte.centroId);
              const cliente = clientes.find(cl => cl.id === parte.clienteId);
              const sistCount = centroSistemas.filter(s => s.centroId === parte.centroId || (centro && s.centroId === centro.id)).length;
              const isPlanificado = parte.estado === 'Planificado';

              return (
                <button
                  key={parte.id}
                  onClick={() => handleAbrirParte(parte)}
                  className={`w-full bg-white rounded-3xl border transition-all text-left shadow-sm hover:shadow-md hover:border-zinc-350 active:scale-[0.98] ${
                    isPlanificado
                      ? 'border-zinc-200 hover:border-zinc-400'
                      : parte.estado === 'Abierto'
                      ? 'border-amber-200 hover:border-amber-400'
                      : parte.estado === 'Finalizado'
                      ? 'border-blue-200 hover:border-blue-400'
                      : parte.estado === 'Pre-Cerrado'
                      ? 'border-emerald-200 hover:border-emerald-400'
                      : parte.estado === 'Cerrado'
                      ? 'border-zinc-300 hover:border-zinc-500'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {/* Vista móvil */}
                  <div className="sm:hidden p-4">
                    {/* Nombre cliente y centro */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-500 truncate">
                          {cliente?.nombre || '—'}
                        </p>
                        <h3 className="text-base font-black text-zinc-900 truncate leading-tight mt-0.5">
                          {centro?.nombre || 'Centro desconocido'}
                        </h3>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          <span className="text-blue-600 font-bold">Parte: {parte.numeroMantenimiento || parte.id}</span>
                        </p>
                      </div>
                      {parte.retirarExtintoresRetimbrado && !parte.retimbradoReiniciado && (
                        <span 
                          className="text-lg animate-pulse mr-1.5 shrink-0 select-none"
                          title="Extintores retirados para retimbrado (Pendiente)"
                        >
                          🧯
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 mt-0.5 ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado === 'Finalizado' ? 'Parte Finalizado' : parte.estado === 'Pre-Cerrado' ? 'Pre-cerrado' : parte.estado}
                      </span>
                    </div>

                    {/* Fecha programada, recuento de sistemas y periodicidad */}
                    <div className="flex flex-col gap-2 pt-2.5 border-t border-zinc-100">
                      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                            <Calendar className="w-3.5 h-3.5" />
                            {parte.fechaProgramada
                              ? parte.fechaProgramada.replace(/-/g, '/')
                              : 'Sin fecha'}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                            {parte.periodicidad || 'Revisión'}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                            <Layers className="w-3.5 h-3.5 text-zinc-400" />
                            {sistCount} sist.
                          </span>

                          {/* Botón Icono PDF con letra roja */}
                          {(() => {
                            const infoPdf = getParteConPdf(parte);
                            const tienePdf = Boolean(infoPdf);
                            return (
                              <button
                                type="button"
                                onClick={(e) => handleAbrirPdfModal(parte, e)}
                                className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md transition-all shadow-xs ${
                                  tienePdf
                                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 active:scale-95 cursor-pointer'
                                    : 'bg-zinc-50 text-zinc-400 border border-zinc-200 hover:bg-zinc-100 cursor-pointer'
                                }`}
                                title={
                                  tienePdf
                                    ? (infoPdf?.esAnterior
                                        ? `Ver PDF de la última revisión realizada (${infoPdf.target.fechaProgramada ? infoPdf.target.fechaProgramada.replace(/-/g, '/') : 'anterior'})`
                                        : 'Ver PDF de esta revisión')
                                    : 'Aún no se ha realizado ninguna revisión para este centro'
                                }
                              >
                                <FileText className={`w-3.5 h-3.5 ${tienePdf ? 'text-red-600' : 'text-zinc-400'}`} />
                                <span className={`text-[11px] font-bold ${tienePdf ? 'text-red-600' : 'text-zinc-400'}`}>PDF</span>
                              </button>
                            );
                          })()}
                        </div>

                        {/* Botón Descargar Parte Completo Offline */}
                        <button
                          type="button"
                          onClick={(e) => handleDescargarParteOffline(parte, e)}
                          disabled={downloadingParteId === parte.id}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                            downloadedPartesMap[parte.id]
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 active:scale-95'
                          }`}
                          title="Guardar cliente, centro, equipos y plantillas en IndexedDB para trabajar offline sin red"
                        >
                          {downloadingParteId === parte.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                              <span>Descargando...</span>
                            </>
                          ) : downloadedPartesMap[parte.id] ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Descargado</span>
                            </>
                          ) : (
                            <>
                              <DownloadCloud className="w-3.5 h-3.5 text-sky-600" />
                              <span>Descargar parte</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Todas las alertas preventivas en la parte inferior (debajo de fecha, periodicidad y sistemas) */}
                      {(() => {
                        const alertasExt = alertasExtintoresPorCentro[parte.centroId] ||
                                           (centro?._docId ? alertasExtintoresPorCentro[centro._docId] : undefined) ||
                                           (centro?.id ? alertasExtintoresPorCentro[centro.id] : undefined);
                        const alertasBie = alertasBiesPorCentro[parte.centroId] ||
                                           (centro?._docId ? alertasBiesPorCentro[centro._docId] : undefined) ||
                                           (centro?.id ? alertasBiesPorCentro[centro.id] : undefined);
                        const hasExt = alertasExt && (alertasExt.caducados20 > 0 || alertasExt.retimbres5 > 0);
                        const hasBie = alertasBie && (alertasBie.caducados20 > 0 || alertasBie.pruebasHidraulicas5 > 0);
                        if (!hasExt && !hasBie) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100">
                            {alertasExt && alertasExt.caducados20 > 0 && (
                              <span 
                                className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                title={`${alertasExt.caducados20} extintores caducados de más de 20 años`}
                              >
                                Ext+20 años: {alertasExt.caducados20} und.
                              </span>
                            )}
                            {alertasExt && alertasExt.retimbres5 > 0 && (
                              <span 
                                className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                title={`${alertasExt.retimbres5} extintores para retimbrar (más de 5 años)`}
                              >
                                RT: {alertasExt.retimbres5} und.
                              </span>
                            )}
                            {alertasBie && alertasBie.caducados20 > 0 && (
                              <span 
                                className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                title={`${alertasBie.caducados20} BIEs caducados de más de 20 años`}
                              >
                                Bie+20 años: {alertasBie.caducados20} und.
                              </span>
                            )}
                            {alertasBie && alertasBie.pruebasHidraulicas5 > 0 && (
                              <span 
                                className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs"
                                title={`${alertasBie.pruebasHidraulicas5} BIEs para prueba hidráulica (más de 5 años)`}
                              >
                                PH: {alertasBie.pruebasHidraulicas5} und.
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Vista desktop */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-500 truncate">{cliente?.nombre || '—'}</p>
                      <p className="text-sm font-bold text-zinc-900 truncate">{centro?.nombre || 'Centro desconocido'}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        <span className="text-blue-600 font-bold">Parte: {parte.numeroMantenimiento || parte.id}</span>{centro?.poblacion ? ` - ${centro.poblacion}` : ''}
                      </p>
                      {(() => {
                        const alertasExt = alertasExtintoresPorCentro[parte.centroId] ||
                                           (centro?._docId ? alertasExtintoresPorCentro[centro._docId] : undefined) ||
                                           (centro?.id ? alertasExtintoresPorCentro[centro.id] : undefined);
                        const alertasBie = alertasBiesPorCentro[parte.centroId] ||
                                           (centro?._docId ? alertasBiesPorCentro[centro._docId] : undefined) ||
                                           (centro?.id ? alertasBiesPorCentro[centro.id] : undefined);
                        const hasExt = alertasExt && (alertasExt.caducados20 > 0 || alertasExt.retimbres5 > 0);
                        const hasBie = alertasBie && (alertasBie.caducados20 > 0 || alertasBie.pruebasHidraulicas5 > 0);
                        if (!hasExt && !hasBie) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {alertasExt && alertasExt.caducados20 > 0 && (
                              <span className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs" title={`${alertasExt.caducados20} extintores caducados de más de 20 años`}>
                                Ext+20 años: {alertasExt.caducados20} und.
                              </span>
                            )}
                            {alertasExt && alertasExt.retimbres5 > 0 && (
                              <span className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs" title={`${alertasExt.retimbres5} extintores para retimbrar (más de 5 años)`}>
                                RT: {alertasExt.retimbres5} und.
                              </span>
                            )}
                            {alertasBie && alertasBie.caducados20 > 0 && (
                              <span className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs" title={`${alertasBie.caducados20} BIEs caducados de más de 20 años`}>
                                Bie+20 años: {alertasBie.caducados20} und.
                              </span>
                            )}
                            {alertasBie && alertasBie.pruebasHidraulicas5 > 0 && (
                              <span className="text-[11px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs" title={`${alertasBie.pruebasHidraulicas5} BIEs para prueba hidráulica (más de 5 años)`}>
                                PH: {alertasBie.pruebasHidraulicas5} und.
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="w-24 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-1 rounded-md inline-block whitespace-nowrap">
                        {parte.periodicidad || 'Revisión'}
                      </span>
                    </div>
                    <div className="w-28 text-center">
                      <span className="text-xs font-bold text-blue-600 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {parte.fechaProgramada ? parte.fechaProgramada.replace(/-/g, '/') : '—'}
                      </span>
                    </div>
                    <div className="w-20 text-center">
                      <span className="text-xs text-zinc-500 flex items-center justify-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-400" />
                        {sistCount} sist.
                      </span>
                    </div>
                    <div className="w-16 text-center">
                      {(() => {
                        const infoPdf = getParteConPdf(parte);
                        const tienePdf = Boolean(infoPdf);
                        return (
                          <button
                            type="button"
                            onClick={(e) => handleAbrirPdfModal(parte, e)}
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md transition-all shadow-xs ${
                              tienePdf
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 active:scale-95 cursor-pointer'
                                : 'bg-zinc-50 text-zinc-400 border border-zinc-200 hover:bg-zinc-100 cursor-pointer'
                            }`}
                            title={
                              tienePdf
                                ? (infoPdf?.esAnterior
                                    ? `Ver PDF de la última revisión realizada (${infoPdf.target.fechaProgramada ? infoPdf.target.fechaProgramada.replace(/-/g, '/') : 'anterior'})`
                                    : 'Ver PDF de esta revisión')
                                : 'Aún no se ha realizado ninguna revisión para este centro'
                            }
                          >
                            <FileText className={`w-3.5 h-3.5 ${tienePdf ? 'text-red-600' : 'text-zinc-400'}`} />
                            <span className={`text-[11px] font-bold ${tienePdf ? 'text-red-600' : 'text-zinc-400'}`}>PDF</span>
                          </button>
                        );
                      })()}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={(e) => handleDescargarParteOffline(parte, e)}
                        disabled={downloadingParteId === parte.id}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                          downloadedPartesMap[parte.id]
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 active:scale-95'
                        }`}
                      >
                        {downloadingParteId === parte.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                            <span>Descargando...</span>
                          </>
                        ) : downloadedPartesMap[parte.id] ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Descargado</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-3.5 h-3.5 text-sky-600" />
                            <span>Descargar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {parte.retirarExtintoresRetimbrado && !parte.retimbradoReiniciado && (
                        <span 
                          className="text-lg animate-pulse mr-1 shrink-0 select-none"
                          title="Extintores retirados para retimbrado (Pendiente)"
                        >
                          🧯
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getEstadoBadge(parte.estado)}`}>
                        {parte.estado === 'Descargado (Offline)' ? 'Offline' : parte.estado === 'Finalizado' ? 'Parte Finalizado' : parte.estado === 'Pre-Cerrado' ? 'Pre-cerrado' : parte.estado}
                      </span>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón Flotante Diagnóstico Administrador */}
      {(loggedUser.rol === 'super-administrador' || loggedUser.rol === 'administrador') && (
        <button
          onClick={handleOpenDiag}
          className="fixed bottom-4 right-4 z-40 bg-zinc-900 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-2xl shadow-xl border border-zinc-700 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          title="Panel Diagnóstico Offline IndexedDB"
        >
          <Database className="w-4 h-4 text-sky-400" />
          <span>Diagnóstico DB</span>
        </button>
      )}

      {/* Modal Diagnóstico de Emergencia IndexedDB */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-zinc-900">Diagnóstico IndexedDB (Offline)</h3>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {diagInfo && (
              <div className="space-y-3 text-xs font-mono text-zinc-700">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
                  <p><strong>Base de Datos:</strong> {diagInfo.dbName}</p>
                  <p><strong>Esquema Versión:</strong> v{diagInfo.dbVersion}</p>
                  <p><strong>Partes Descargados:</strong> {diagInfo.partesCount}</p>
                  <p><strong>Fotos Binarias (Blobs):</strong> {diagInfo.photosCount}</p>
                  <p><strong>Cola Pendiente (Idempotente):</strong> {diagInfo.pendingQueueCount}</p>
                </div>
                {diagInfo.storageEstimate && (
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 space-y-1">
                    <p><strong>Uso de Almacenamiento:</strong> {(diagInfo.storageEstimate.usage / (1024 * 1024)).toFixed(2)} MB</p>
                    <p><strong>Cuota Disponible:</strong> {(diagInfo.storageEstimate.quota / (1024 * 1024)).toFixed(0)} MB</p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowDiagModal(false)}
              className="mt-6 w-full bg-zinc-900 hover:bg-black text-white py-3 rounded-2xl font-bold text-xs shadow-md"
            >
              Cerrar Diagnóstico
            </button>
          </div>
        </div>
      )}

      {/* Modal flotante de selección de modo de visualización */}
      {showModoModal && !loadingAlertas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 text-left relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-zinc-900 leading-tight">
                  Visualización de Partes
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Selecciona cómo deseas consultar tus partes de trabajo
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-5">
              {/* Opción 1: Vista rápida */}
              <button
                onClick={() => {
                  setShowModoModal(false);
                  ejecutarCargaAlertas(false);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-zinc-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-start gap-3.5 group cursor-pointer active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-zinc-900 group-hover:text-blue-600 transition-colors">
                      1º Vista rápida de los partes
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                      Sin esperas
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Muestra los partes sin leer las alertas o que las muestre cuando pueda en segundo plano.
                  </p>
                </div>
              </button>

              {/* Opción 2: Mostrar alertas */}
              <button
                onClick={() => {
                  ejecutarCargaAlertas(true);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-zinc-200 hover:border-red-500 hover:bg-red-50/40 transition-all flex items-start gap-3.5 group cursor-pointer active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 group-hover:bg-red-600 text-red-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-zinc-900 group-hover:text-red-600 transition-colors">
                      2º Mostrar alertas en partes
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Con alertas
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Lee fechas y muestra alertas preventivas (+20 años, retimbres y PH) en partes planificados o en curso.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal flotante de lectura de alertas en curso */}
      {loadingAlertas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-zinc-200 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4 shadow-sm">
              <RefreshCw className="w-7 h-7 text-red-600 animate-spin" />
            </div>
            <h3 className="text-base font-black text-zinc-900 mb-1">
              leyendo fechas y alertas en los partes,...
            </h3>
            <p className="text-xs text-zinc-500 font-medium">
              Analizando partes planificados y en curso en pantalla
            </p>
          </div>
        </div>
      )}
      {/* Modal flotante de selección y descarga PDF para el técnico */}
      {showPdfModal && parteSeleccionadoPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-white">
              <h3 className="font-bold text-zinc-900 text-base sm:text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                Documentos de Revisión (PDF)
              </h3>
              <button 
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 -mr-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Información del centro y parte */}
              <div className="mb-4 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-xs font-bold text-zinc-900 truncate">
                  {centros.find(c => c._docId === parteSeleccionadoPdf.target.centroId || c.id === parteSeleccionadoPdf.target.centroId)?.nombre || 'Centro'}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  {parteSeleccionadoPdf.esAnterior ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ℹ️ Última revisión finalizada ({parteSeleccionadoPdf.target.fechaProgramada ? parteSeleccionadoPdf.target.fechaProgramada.replace(/-/g, '/') : 'Completada'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Revisión realizada ({parteSeleccionadoPdf.target.fechaProgramada ? parteSeleccionadoPdf.target.fechaProgramada.replace(/-/g, '/') : 'Completada'})
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-zinc-600 mb-3.5 font-medium">Selecciona los documentos que deseas generar:</p>
              
              <div className="space-y-2.5">
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${pdfOptions.acta ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {pdfOptions.acta && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={pdfOptions.acta}
                    onChange={(e) => setPdfOptions(prev => ({ ...prev, acta: e.target.checked }))}
                  />
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-zinc-800 block">Acta de Revisión</span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400">Detalle de equipos, checklist, anomalías y firmas</span>
                  </div>
                </label>
                
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${pdfOptions.certificado ? 'bg-red-600 border-red-600' : 'border-2 border-zinc-300'}`}>
                    {pdfOptions.certificado && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={pdfOptions.certificado}
                    onChange={(e) => setPdfOptions(prev => ({ ...prev, certificado: e.target.checked }))}
                  />
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-zinc-800 block">Certificado</span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-400">Certificado oficial de mantenimiento reglamentario</span>
                  </div>
                </label>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  disabled={isGeneratingPdf}
                  className="flex-1 py-2.5 px-3 rounded-xl font-medium text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarDescargaPdf}
                  disabled={isGeneratingPdf || (!pdfOptions.acta && !pdfOptions.certificado)}
                  className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm shadow-red-200 active:scale-95"
                >
                  {isGeneratingPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Ver / Descargar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
