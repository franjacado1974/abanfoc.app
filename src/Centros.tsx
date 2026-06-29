/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Search, Edit, Trash2, MapPin, Layers, X, Copy, AlertTriangle, Upload, Download, Building2, UserCheck, Eye, Phone, Mail, Users, ChevronRight, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CATEGORIAS_POR_DEFECTO, getIconForSistema } from './Sistemas';
import { addCentro, updateCentro, deleteCentro, subscribeCentros, subscribeFamilias, subscribeArticulos, subscribeTecnicos, subscribeEmpresas, addCentroSistema, deleteCentroSistema, subscribeCentroSistemas, addEquipoInstalado, updateEquipoInstalado, deleteEquipoInstalado, subscribeEquiposInstalados, sistemaToSlug, saveContrato, syncContratosExistentes } from './firebase';
import type { Articulo, Tecnico } from './firebase';
import ConfirmationModal from './ConfirmationModal';
import DetailModal from './components/DetailModal';
import EquipoFormulario from './components/EquipoFormulario';
import { generarContratoPDF } from './pdfContratoGenerator';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface Cliente {
  id: string;
  nombre: string;
  cif: string;
  direccion: string;
  poblacion: string;
  cp: string;
  provincia: string;
  telefono: string;
  contacto: string;
  correo: string;
}

interface EmpresaData {
  _docId?: string;
  nombre: string;
  cif?: string;
  localidad?: string;
}

export interface Centro {
  _docId?: string;
  id: string;
  clienteId: string;
  customIdPart: string;
  nombre: string;
  direccion: string;
  poblacion: string;
  cp: string;
  provincia: string;
  telefono: string;
  contacto: string;
  correo: string;
  periodicidad?: string[];
  mesesRevision?: string[];
  tecnicoId?: string;
  empresaId?: string;
  numeroContrato?: string;
  fechaInicioContrato?: string;
  fechaFinContrato?: string;
  importeAnualContrato?: string;
  observacionesContrato?: string;
  sistemasContrato?: string[];
  precioAnualContrato?: string;
  precioTrimestralContrato?: string;
  precioMensualContrato?: string;
}

export interface Parte {
  id: string;
  centroId: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Abierto' | 'En revisión' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado' | 'Pre-Cerrado';
  tipoTrabajo?: string;
  numeroMantenimiento?: string;
  fechaProgramada?: string;
  empresaId?: string;
  firmaCliente?: string;
  firmaTecnico?: string;
  nombreFirmante?: string;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
};

export interface CentroSistema {
  id: string;
  centroId: string;
  tipo: string;
  familia: string;
  descripcion: string;
}

export interface EquipoInstalado {
  id: string;
  centroId: string;
  sistemaId: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  revisable?: boolean;
  revisado?: boolean;
  placa?: string;
  clase?: string;
  fabricante?: string;
  fechaFabricacion?: string;
  ultimoRetimbre?: string;
  pesoCapacidad?: string;
  anomalias?: string;
  longitud?: string;
  pruebaHidraulica?: string;
  checkAcceso?: boolean | null;
  checkAltura?: boolean | null;
  checkSoporte?: boolean | null;
  checkSenalizacion?: boolean | null;
  checkManguera?: boolean | null;
  checkPeso?: boolean | null;
  checkManometro?: boolean | null;
  checkMarcado?: boolean | null;
  checkEtiquetas?: boolean | null;
  checkRetimbre?: boolean | null;
  checkRiesgo?: boolean | null;
  checkDistancia?: boolean | null;
  checkPasador?: boolean | null;
  checkMovilidad?: boolean | null;
  foto?: string;
  [key: string]: any; // Allow for dynamic properties from templates
}

const emptyCentro: Centro = {
  id: '', clienteId: '', customIdPart: '', nombre: '', direccion: '',
  poblacion: '', cp: '', provincia: '', telefono: '', contacto: '', correo: '',
  periodicidad: [], mesesRevision: []
};

export default function Centros({ hideHeader }: { hideHeader?: boolean } = {}) {
  const loggedUser = useMemo(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  }, []);
  const isTecnicoMode = loggedUser?.rol === 'tecnico';
  const isVisualizador = loggedUser?.rol === 'visualizador' || isTecnicoMode;

  const navigate = useNavigate();
  const location = useLocation();
  const [centros, setCentros] = useState<Centro[]>(() => { try { const saved = localStorage.getItem('firecheck_db_centros'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [clientes] = useState<Cliente[]>(() => { try { const saved = localStorage.getItem('firecheck_db_clientes'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>(() => { try { const saved = localStorage.getItem('firecheck_db_centro_sistemas'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [categoriasSistema] = useState<{id: string, nombre: string}[]>(() => { const saved = localStorage.getItem('firecheck_db_sistemas_categorias'); return saved ? JSON.parse(saved) : CATEGORIAS_POR_DEFECTO; });
  const [view, setView] = useState<'list' | 'form' | 'sistemas' | 'periodicidad' | 'asignar-tecnico'>('list');
  const [form, setForm] = useState<Centro>(emptyCentro);
  const [centroSeleccionado, setCentroSeleccionado] = useState<Centro | null>(null);
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState<CentroSistema | null>(null);
  const [isPeriodicidadModalOpen, setIsPeriodicidadModalOpen] = useState(false);
  const [centroForPeriodicidad, setCentroForPeriodicidad] = useState<Centro | null>(null);
  const [formPeriodicidad, setFormPeriodicidad] = useState<{ periodicidad: string[], mesesRevision: string[] }>({ periodicidad: [], mesesRevision: [] });
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  const [centroForContrato, setCentroForContrato] = useState<Centro | null>(null);
  const [formContrato, setFormContrato] = useState({
    numeroContrato: '',
    fechaInicio: '',
    fechaFin: '',
    observaciones: '',
    periodicidad: [] as string[],
    sistemasContrato: [] as string[],
    precioAnual: '',
    precioTrimestral: '',
    precioMensual: ''
  });
  const [isTecnicoModalOpen, setIsTecnicoModalOpen] = useState(false);
  const [centroForTecnico, setCentroForTecnico] = useState<Centro | null>(null);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState('');
  const [tecnicos, setTecnicos] = useState<Tecnico[]>(() => { const saved = localStorage.getItem('firecheck_db_tecnicos'); return saved ? JSON.parse(saved) : []; });
  const [isEmpresaModalOpen, setIsEmpresaModalOpen] = useState(false);
  const [centroForEmpresa, setCentroForEmpresa] = useState<Centro | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaData[]>(() => { try { const saved = localStorage.getItem('firecheck_db_empresas'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [formSistema, setFormSistema] = useState<CentroSistema>({ id: '', centroId: '', tipo: '', familia: '', descripcion: '' });
  const [isSistemaModalOpen, setIsSistemaModalOpen] = useState(false);
  const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>(() => { try { const saved = localStorage.getItem('firecheck_db_equipos_instalados'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [, setArticulosCatalogo] = useState<Articulo[]>([]);
  const [, setIsArticulosLoading] = useState(true);
  const [formEquipo, setFormEquipo] = useState<EquipoInstalado>({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' });
  const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [selectedCatIdForCentro, setSelectedCatIdForCentro] = useState('');
  const [centroForNewSistema, setCentroForNewSistema] = useState<Centro | null>(null);
  const [_isFamiliasLoading, setIsFamiliasLoading] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'centro' | 'sistema' | 'equipo', id: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
  const [selectedCentro, setSelectedCentro] = useState<Centro | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedSistemaId, setExpandedSistemaId] = useState<string | null>(null);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clienteSearchTerm.toLowerCase()) ||
    c.cif?.toLowerCase().includes(clienteSearchTerm.toLowerCase())
  );

  const handleExportExcel = () => {
    const dataToExport = centros.map(c => {
      const cli = clientes.find(cl => cl.id === c.clienteId);
      return { 'ID Centro': c.id, 'Cliente': cli ? cli.nombre : 'Desconocido', 'Código Centro': c.customIdPart || '', 'Nombre Centro': c.nombre, 'Dirección': c.direccion, 'Población': c.poblacion, 'C.P.': c.cp, 'Provincia': c.provincia, 'Teléfono': c.telefono, 'Contacto': c.contacto, 'Correo': c.correo };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Centros');
    XLSX.writeFile(workbook, 'centros_export.xlsx');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetInput = e.target;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        const newCentros = [...centros];
        data.forEach(row => {
          if (row['Nombre Centro']) {
            const clienteName = row['Cliente'] || '';
            const cliMatch = clientes.find(c => c.nombre.toLowerCase() === clienteName.toLowerCase());
            const idExistente = row['ID Centro'];
            const idx = newCentros.findIndex(c => c.id === idExistente);
            if (idx >= 0) {
              newCentros[idx] = { ...newCentros[idx], clienteId: cliMatch ? cliMatch.id : newCentros[idx].clienteId, customIdPart: row['Código Centro'] || newCentros[idx].customIdPart || '', nombre: String(row['Nombre Centro']).toUpperCase(), direccion: row['Dirección'] || '', poblacion: row['Población'] || '', cp: row['C.P.'] || '', provincia: row['Provincia'] || '', telefono: row['Teléfono'] || '', contacto: row['Contacto'] || '', correo: row['Correo'] || '' };
            } else {
              const cliIdForNew = cliMatch ? cliMatch.id : '';
              let clientNum = cliIdForNew ? cliIdForNew.replace('CLI ', '').replace('CLI', '') : '0000';
              clientNum = clientNum.padStart(4, '0');
              const centrosDelCliente = newCentros.filter(c => c.clienteId === cliIdForNew);
              const centerNum = String(centrosDelCliente.length + 1).padStart(2, '0');
              const newId = `CEN ${clientNum}-${centerNum}-(XXXX)`;
              newCentros.push({ id: newId, clienteId: cliMatch ? cliMatch.id : '', customIdPart: row['Código Centro'] || '', nombre: String(row['Nombre Centro']).toUpperCase(), direccion: row['Dirección'] || '', poblacion: row['Población'] || '', cp: row['C.P.'] || '', provincia: row['Provincia'] || '', telefono: row['Teléfono'] || '', contacto: row['Contacto'] || '', correo: row['Correo'] || '' });
            }
          }
        });
        setCentros(newCentros);
        localStorage.setItem('firecheck_db_centros', JSON.stringify(newCentros));
        alert('Centros importados correctamente');
      } catch (err) {
        console.error(err);
        alert('Error al importar el archivo Excel');
      }
      targetInput.value = '';
    };
    reader.readAsBinaryString(file);
  };

  useEffect(() => {
    try {
      let hasChanges = false;
      const currentClientes = clientes;
      let currentSistemas = centroSistemas;
      let currentEquipos = equiposInstalados;
      const validCentros = centros.filter(c => { const clienteExiste = c && c.clienteId && currentClientes.some(cli => cli.id === c.clienteId); const tieneIdRaro = c && typeof c.id === 'string' && c.id.length > 25; if (!c || !c.id || !clienteExiste || tieneIdRaro) { hasChanges = true; return false; } return true; });
      const finalCentros = validCentros.map(c => {
        if (typeof c.id === 'string' && c.id.startsWith('CEN') && !c.id.startsWith('CEN ')) {
          const oldId = c.id;
          const parts = c.id.replace('CEN', '').split('-');
          if (parts.length >= 3) { const newId = `CEN ${parts[0]}-${parts[1]}-${parts[2]}`; hasChanges = true; currentSistemas = currentSistemas.map((s) => s.centroId === oldId ? { ...s, centroId: newId } : s); currentEquipos = currentEquipos.map((e) => e.centroId === oldId ? { ...e, centroId: newId } : e); return { ...c, id: newId }; }
        }
        return c;
      });
      if (hasChanges) {
        localStorage.setItem('firecheck_db_centros', JSON.stringify(finalCentros));
        localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(currentSistemas));
        localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(currentEquipos));
        setCentroSistemas(currentSistemas);
        setEquiposInstalados(currentEquipos);
        setCentros(finalCentros);
      }
    } catch { /* no-op */ }
  }, [clientes, centros, centroSistemas, equiposInstalados]);

  useEffect(() => {
    if (centros.length > 0 && location.state?.action === 'abrir-centro' && location.state?.centroId) {
      const targetCentro = centros.find(c => c._docId === location.state.centroId || c.id === location.state.centroId);
      if (targetCentro) { setCentroSeleccionado(targetCentro); setView('sistemas'); navigate(location.pathname, { replace: true, state: { ...location.state, action: undefined } }); }
    }
  }, [centros, location.state, navigate, location.pathname]);

  useEffect(() => {
    setIsFamiliasLoading(true);
    const unsubscribe = subscribeFamilias(() => { setIsFamiliasLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeTecnicos((items: Tecnico[]) => { setTecnicos(items); localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items)); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeEmpresas((items: EmpresaData[]) => { setEmpresas(items); localStorage.setItem('firecheck_db_empresas', JSON.stringify(items)); });
    return () => unsubscribe();
  }, []);

  const saveToDB = (data: Centro[]) => { localStorage.setItem('firecheck_db_centros', JSON.stringify(data)); setCentros(data); };

  const normalizeSelectedValues = (values?: string[] | string | null) => {
    if (Array.isArray(values)) return values.filter(value => typeof value === 'string' && value.trim() !== '');
    if (typeof values === 'string' && values.trim() !== '') return [values];
    return [];
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try { unsub = subscribeCentros((items: any[]) => { const mapped = items.map((d: any) => ({ ...d })); setCentros(mapped); localStorage.setItem('firecheck_db_centros', JSON.stringify(mapped)); }); } catch (e) { console.error('subscribeCentros failed', e); }
    return () => { if (unsub) unsub(); };
  }, []);

  const syncRef = useRef(false);

  useEffect(() => {
    if (centros.length > 0 && !syncRef.current) {
      syncRef.current = true;
      syncContratosExistentes(centros);
    }
  }, [centros]);

  // Suscripción en tiempo real a los sistemas del centro seleccionado
  useEffect(() => {
    const centroDocId = centroSeleccionado?._docId || centroSeleccionado?.id;
    if (!centroDocId) return;
    const unsub = subscribeCentroSistemas(centroDocId, (items: CentroSistema[]) => {
      // Actualizar solo los sistemas de este centro
      setCentroSistemas(prev => {
        const otrosCentros = prev.filter(s => s.centroId !== centroDocId);
        const merged = [...otrosCentros, ...items];
        localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(merged));
        return merged;
      });
    });
    return () => unsub();
  }, [centroSeleccionado?._docId, centroSeleccionado?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suscripción en tiempo real a los equipos de los sistemas del centro seleccionado
  // Se re-ejecuta cuando cambia el centro O cuando cambia la lista de sistemas de ese centro
  useEffect(() => {
    const centroDocId = centroSeleccionado?._docId || centroSeleccionado?.id;
    if (!centroDocId) return;
    const sistDelCentro = centroSistemas.filter(s => s.centroId === centroDocId);
    if (sistDelCentro.length === 0) return;

    const unsubs = sistDelCentro.map(sist => {
      const sistemaId = sist.id;
      return subscribeEquiposInstalados(centroDocId, sistemaId, (items: EquipoInstalado[]) => {
        setEquiposInstalados(prev => {
          const otrosSistemas = prev.filter(e => e.sistemaId !== sistemaId);
          const merged = [...otrosSistemas, ...items];
          localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(merged));
          return merged;
        });
      });
    });
    return () => unsubs.forEach(u => u());
  }, [centroSeleccionado?._docId, centroSeleccionado?.id, centroSistemas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setIsArticulosLoading(true);
    const unsubscribe = subscribeArticulos((articulos) => { setArticulosCatalogo(articulos.filter(articulo => articulo.revisable === true)); setIsArticulosLoading(false); });
    return () => unsubscribe();
  }, []);

  const calculateNextCentroId = (cliId: string, customPart: string) => {
    if (!cliId) return '';
    let clientNum = cliId.replace('CLI ', '').replace('CLI', '');
    clientNum = clientNum.padStart(4, '0');
    const centrosDelCliente = centros.filter(c => c.clienteId === cliId);
    const centerNum = String(centrosDelCliente.length + 1).padStart(2, '0');
    return `CEN ${clientNum}-${centerNum}-(${customPart || 'XXXX'})`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId) return alert('Debes seleccionar un cliente primero.');
    if (!form.customIdPart || !form.customIdPart.trim()) return alert('El código periodicidad es obligatorio.');
    if (!form.nombre.trim()) return alert('El nombre del centro es obligatorio.');
    let finalId = form.id;
    if (!finalId) { finalId = calculateNextCentroId(form.clienteId, form.customIdPart); } else { const parts = finalId.split('-'); if (parts.length >= 3) { finalId = `${parts[0]}-${parts[1]}-(${form.customIdPart || 'XXXX'})`; } }
    const newCentro: any = { ...form, id: finalId, nombre: form.nombre.toUpperCase(), periodicidad: normalizeSelectedValues(form.periodicidad), mesesRevision: normalizeSelectedValues(form.mesesRevision) };
    try {
      if ((form as any)._docId) { await updateCentro((form as any)._docId, newCentro); const updated = centros.map(c => c.id === form.id ? { ...newCentro, _docId: (form as any)._docId } : c); saveToDB(updated); }
      else { const created = await addCentro(newCentro); const withDoc = { ...newCentro, _docId: created._docId }; const updated = form.id ? centros.map(c => c.id === form.id ? withDoc : c) : [...centros, withDoc]; saveToDB(updated); }
    } catch (err) { console.error('Error guardando centro en Firestore:', err); alert('Error al guardar en Firestore'); return; }
    setView('list');
    setForm(emptyCentro);
  };

  const handleEdit = (centro: Centro) => { setForm(centro); setView('form'); };
  const handleEditEquipo = (eq: EquipoInstalado, sist: CentroSistema) => {
    setSistemaSeleccionado(sist);
    setFormEquipo(eq);
    setIsEquipoModalOpen(true);
  };

  const handleSavePeriodicidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForPeriodicidad) return;
    const periodicidad = normalizeSelectedValues(formPeriodicidad.periodicidad);
    const mesesRevision = normalizeSelectedValues(formPeriodicidad.mesesRevision);
    const updatedCentro = { ...centroForPeriodicidad, periodicidad, mesesRevision };
    const docId = (centroForPeriodicidad as any)._docId || centroForPeriodicidad.id;
    const { _docId, ...centroData } = updatedCentro as any;
    try { await updateCentro(docId, centroData); } catch (err) { console.error('Error guardando periodicidad en Firestore:', err); alert('Error al guardar la periodicidad en Firestore'); return; }
    const updatedCentros = centros.map(c => c.id === centroForPeriodicidad.id ? { ...updatedCentro, _docId: (c as any)._docId || _docId } : c);
    saveToDB(updatedCentros);
    setIsPeriodicidadModalOpen(false);
    setCentroForPeriodicidad(null);
    // Volver a mostrar el detalle del centro con los datos actualizados
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    setIsDetailOpen(true);
  };

  const handleSaveContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForContrato) return;

    const isMensual = formContrato.periodicidad.includes('Mensual');
    const isTrimestral = formContrato.periodicidad.includes('Trimestral');
    const isAnual = formContrato.periodicidad.includes('Anual');

    const pAnual = parseFloat(formContrato.precioAnual) || 0;
    const pTrimestral = parseFloat(formContrato.precioTrimestral) || 0;
    const pMensual = parseFloat(formContrato.precioMensual) || 0;

    let total = 0;
    if (isAnual && isTrimestral && isMensual) {
      total = pAnual + (pTrimestral * 3) + (pMensual * 8);
    } else if (isAnual && isTrimestral) {
      total = pAnual + (pTrimestral * 3);
    } else if (isAnual && isMensual) {
      total = pAnual + (pMensual * 11);
    } else if (isTrimestral && isMensual) {
      total = (pTrimestral * 4) + (pMensual * 8);
    } else if (isAnual) {
      total = pAnual;
    } else if (isTrimestral) {
      total = pTrimestral * 4;
    } else if (isMensual) {
      total = pMensual * 12;
    }

    const updatedCentro = {
      ...centroForContrato,
      numeroContrato: formContrato.numeroContrato.trim(),
      fechaInicioContrato: formContrato.fechaInicio,
      fechaFinContrato: formContrato.fechaFin,
      importeAnualContrato: String(total),
      observacionesContrato: formContrato.sistemasContrato.join(', '),
      periodicidad: formContrato.periodicidad,
      sistemasContrato: formContrato.sistemasContrato,
      precioAnualContrato: formContrato.precioAnual.trim(),
      precioTrimestralContrato: formContrato.precioTrimestral.trim(),
      precioMensualContrato: formContrato.precioMensual.trim()
    };
    const docId = (centroForContrato as any)._docId || centroForContrato.id;
    const { _docId, ...centroData } = updatedCentro as any;
    try {
      await updateCentro(docId, centroData);
      await saveContrato(docId, {
        clienteId: centroForContrato.clienteId,
        numeroContrato: formContrato.numeroContrato.trim(),
        fechaInicioContrato: formContrato.fechaInicio,
        fechaFinContrato: formContrato.fechaFin,
        importeAnualContrato: String(total),
        observacionesContrato: formContrato.sistemasContrato.join(', '),
        periodicidad: formContrato.periodicidad,
        sistemasContrato: formContrato.sistemasContrato,
        precioAnualContrato: formContrato.precioAnual.trim(),
        precioTrimestralContrato: formContrato.precioTrimestral.trim(),
        precioMensualContrato: formContrato.precioMensual.trim()
      });
    } catch (err) {
      console.error('Error guardando contrato en Firestore:', err);
      alert('Error al guardar el contrato en Firestore');
      return;
    }
    const updatedCentros = centros.map(c => c.id === centroForContrato.id ? { ...updatedCentro, _docId: (c as any)._docId || _docId } : c);
    saveToDB(updatedCentros);
    setIsContratoModalOpen(false);
    setCentroForContrato(null);
    // Volver a mostrar el detalle del centro con los datos actualizados
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    setIsDetailOpen(true);
  };

  const handleSaveTecnicoAsignado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForTecnico) return;
    const updatedCentro = { ...centroForTecnico, tecnicoId: selectedTecnicoId };
    const docId = (centroForTecnico as any)._docId || centroForTecnico.id;
    const { _docId, ...centroData } = updatedCentro as any;
    try { await updateCentro(docId, centroData); } catch (err) { console.error('Error asignando técnico en Firestore:', err); alert('Error al guardar el técnico asignado en Firestore'); return; }
    const updatedCentros = centros.map(c => c.id === centroForTecnico.id ? { ...updatedCentro, _docId: (c as any)._docId || _docId } : c);
    saveToDB(updatedCentros);
    const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
    if (Array.isArray(storedPartes)) { const updatedPartes = storedPartes.map((parte: Parte) => parte.centroId === centroForTecnico.id ? { ...parte, tecnicoId: selectedTecnicoId } : parte); localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes)); }
    setIsTecnicoModalOpen(false);
    setCentroForTecnico(null);
    setSelectedTecnicoId('');
    // Volver a mostrar el detalle del centro con los datos actualizados
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    setIsDetailOpen(true);
  };

  const handleSaveEmpresaAsignada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForEmpresa) return;
    const updatedCentro = { ...centroForEmpresa, empresaId: selectedEmpresaId };
    const docId = (centroForEmpresa as any)._docId || centroForEmpresa.id;
    const { _docId, ...centroData } = updatedCentro as any;
    try { await updateCentro(docId, centroData); } catch (err) { console.error('Error asignando empresa en Firestore:', err); alert('Error al guardar la empresa asignada en Firestore'); return; }
    const updatedCentros = centros.map(c => c.id === centroForEmpresa.id ? { ...updatedCentro, _docId: (c as any)._docId || _docId } : c);
    saveToDB(updatedCentros);
    const storedPartes = JSON.parse(localStorage.getItem('firecheck_db_partes') || '[]');
    if (Array.isArray(storedPartes)) { const updatedPartes = storedPartes.map((parte: Parte) => parte.centroId === centroForEmpresa.id ? { ...parte, empresaId: selectedEmpresaId } : parte); localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes)); }
    setIsEmpresaModalOpen(false);
    setCentroForEmpresa(null);
    setSelectedEmpresaId('');
  };

  const handleDelete = async (id: string) => { setItemToDelete({ type: 'centro', id }); setIsConfirmModalOpen(true); };

  const confirmDeleteCentro = async () => {
    if (!itemToDelete || itemToDelete.type !== 'centro') return;
    setIsConfirmModalOpen(false);
    const target = centros.find(c => c.id === itemToDelete.id) as any;
    try { if (target && target._docId) { await deleteCentro(target._docId); } } catch (err) { console.error('Error borrando centro en Firestore:', err); alert('Error al borrar en Firestore'); }
    const remaining = centros.filter(c => c.id !== itemToDelete.id);
    saveToDB(remaining);
    const dbSist = centroSistemas.filter(s => s.centroId !== target?.id && s.centroId !== target?._docId);
    setCentroSistemas(dbSist);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(dbSist));
    setItemToDelete(null);
  };

  const openSistemas = (c: Centro) => { setCentroSeleccionado(c); setView('sistemas'); };

  const handleSaveSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroSeleccionado) return;
    let familiaReal = formSistema.familia;
    if (!familiaReal && formSistema.tipo) { const cat = categoriasSistema.find(c => c.nombre === formSistema.tipo); if (cat) familiaReal = cat.nombre; }
    const sistemaData: CentroSistema = { ...formSistema, familia: familiaReal, centroId: centroSeleccionado._docId || centroSeleccionado.id };
    if (!sistemaData.id) sistemaData.id = generateId();
    // Guardar en Firestore
    try { await addCentroSistema(sistemaData); } catch (err) { console.error('Error guardando sistema en Firestore:', err); }
    setIsSistemaModalOpen(false);
  };

  const handleAddSistemaFromCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForNewSistema || !selectedCatIdForCentro) return;
    const sistemaCategoria = categoriasSistema.find(cat => cat.id === selectedCatIdForCentro);
    if (!sistemaCategoria) return;
    // El slug se genera en addCentroSistema a partir del tipo/familia
    // Usamos el slug como id para que coincida con el documento en Firestore
    const slug = sistemaToSlug(sistemaCategoria.nombre);
    const newSistema: CentroSistema = { id: slug, centroId: centroForNewSistema._docId || centroForNewSistema.id, tipo: sistemaCategoria.nombre, familia: sistemaCategoria.nombre, descripcion: '' };
    // Guardar en Firestore → centros/{centroId}/inventario/{slug}
    try { await addCentroSistema(newSistema); } catch (err) { console.error('Error guardando sistema en Firestore:', err); }
    setIsAddCatModalOpen(false);
    setSelectedCatIdForCentro('');
    setCentroForNewSistema(null);
  };

  const handleDeleteSistema = (id: string) => { setItemToDelete({ type: 'sistema', id }); setIsConfirmModalOpen(true); };

  const confirmDeleteSistema = async () => {
    if (!itemToDelete || itemToDelete.type !== 'sistema') return;
    setIsConfirmModalOpen(false);
    const sistemaId = itemToDelete.id;
    // Obtener el centroId del sistema
    const sistemaObj = centroSistemas.find(s => s.id === sistemaId);
    const centroIdDelSistema = sistemaObj?.centroId || '';
    // Borrar sistema en Firestore (subcolección + raíz)
    try { await deleteCentroSistema(centroIdDelSistema, sistemaId); } catch (err) { console.error('Error borrando sistema en Firestore:', err); }
    // Borrar equipos del sistema en Firestore
    const equiposDelSistema = equiposInstalados.filter(e => e.sistemaId === sistemaId);
    for (const eq of equiposDelSistema) {
      try { await deleteEquipoInstalado(centroIdDelSistema, sistemaId, eq.id); } catch (err) { console.error('Error borrando equipo en Firestore:', err); }
    }
    setItemToDelete(null);
  };



  const handleDuplicateEquipoCentro = async (eq: EquipoInstalado) => {
    const newEquipo = { ...eq, id: generateId(), codigo: eq.codigo ? `${eq.codigo}-COPIA` : '' };
    try { await addEquipoInstalado(newEquipo); } catch (err) { console.error('Error duplicando equipo en Firestore:', err); }
  };


  const handleDeleteEquipo = (id: string) => { setItemToDelete({ type: 'equipo', id }); setIsConfirmModalOpen(true); };

  const confirmDeleteEquipo = async () => {
    if (!itemToDelete || itemToDelete.type !== 'equipo') return;
    setIsConfirmModalOpen(false);
    // Buscar el equipo para obtener centroId y sistemaId
    const equipoObj = equiposInstalados.find(e => e.id === itemToDelete.id);
    const centroIdEq = equipoObj?.centroId || '';
    const sistemaIdEq = equipoObj?.sistemaId || '';
    try { await deleteEquipoInstalado(centroIdEq, sistemaIdEq, itemToDelete.id); } catch (err) { console.error('Error borrando equipo en Firestore:', err); }
    setItemToDelete(null);
  };

  const selectedCliente = form.clienteId ? clientes.find(c => c.id === form.clienteId) : null;
  const idPreview = form.id ? form.id : calculateNextCentroId(form.clienteId, form.customIdPart);

  const handleCopyFromCliente = () => {
    if (!selectedCliente) return;
    setForm({ ...form, nombre: selectedCliente.nombre, direccion: selectedCliente.direccion || '', poblacion: selectedCliente.poblacion || '', cp: selectedCliente.cp || '', provincia: selectedCliente.provincia || '', contacto: selectedCliente.contacto || '', telefono: selectedCliente.telefono || '', correo: selectedCliente.correo || '' });
  };


  const filteredCentros = centros.filter(c => {
    if (!c) return false;
    const client = clientes.find(cl => cl.id === c?.clienteId);
    const term = (searchTerm || '').toLowerCase().trim();
    const nombre = c && c.nombre ? String(c.nombre).toLowerCase() : '';
    const cid = c && c.id ? String(c.id).toLowerCase() : '';
    const clienteId = c && c.clienteId ? String(c.clienteId).toLowerCase() : '';
    const poblacion = c && c.poblacion ? String(c.poblacion).toLowerCase() : '';
    const clientNombre = client && client.nombre ? String(client.nombre).toLowerCase() : '';
    return nombre.includes(term) || cid.includes(term) || clienteId.includes(term) || poblacion.includes(term) || (clientNombre && clientNombre.includes(term));
  });

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (view === 'list') {
    return (
      <div className={hideHeader ? '' : 'px-4 md:px-8 py-6'}>
        {!hideHeader ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-3 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
            </button>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Directorio de Centros</h1>
            <p className="text-sm text-zinc-500 mt-1">{centros.length} centros registrados en el sistema.</p>
          </div>
          {!isVisualizador && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
              <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"><Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span></button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm"><Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importar</span></button>
              <button onClick={() => { if (clientes.length === 0) return alert('Debes crear al menos un Cliente antes de crear un Centro.'); setForm(emptyCentro); setView('form'); }} className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"><Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nuevo Centro</span><span className="sm:hidden">Nuevo</span></button>
            </div>
          )}
        </div>
        ) : null}
        {centros.length > 0 && (
          <div className="relative mb-5">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="w-4 h-4 text-zinc-400" /></div>
            <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-zinc-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400" placeholder="Buscar centro por nombre, ID o población..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        )}
        {centros.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><Building2 className="w-8 h-8 text-zinc-400" /></div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay centros</h3>
            <p className="text-zinc-500 mb-8 max-w-md mx-auto">Los centros de trabajo se vinculan a tus clientes. Para crear uno, necesitas haber dado de alta un cliente previamente.</p>
            <button onClick={() => { if (clientes.length === 0) return alert('Debes ir a la sección Clientes y crear uno primero.'); setForm(emptyCentro); setView('form'); }} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md"><Plus className="w-5 h-5" /> Crear el primer centro</button>
          </div>
        ) : filteredCentros.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-sm">
            <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
            <p className="text-zinc-500">No se ha encontrado ningún centro que coincida con "{searchTerm}".</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
            <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 min-w-[800px]">
              <div className="w-48 shrink-0">Código</div><div className="flex-1 min-w-0">Centro</div>{!isTecnicoMode && <div className="w-36 shrink-0">Cliente</div>}<div className="w-32 shrink-0">Población</div>{!isTecnicoMode && <div className="w-28 shrink-0">Teléfono</div>}{!isTecnicoMode && <div className="w-16 shrink-0 text-center">Sist.</div>}<div className="w-24 shrink-0 text-right">Acciones</div>
            </div>
            <div className="divide-y divide-zinc-200">
              {filteredCentros.map((c) => {
                const client = clientes.find(cl => cl.id === c.clienteId);
                const sistCount = centroSistemas.filter(s => s.centroId === c._docId || s.centroId === c.id).length;
                return (
                  <div key={c.id} className="flex flex-col md:flex-row md:items-center px-4 py-3.5 hover:bg-zinc-50/80 transition-colors cursor-pointer group" onClick={() => { setSelectedCentro(c); setIsDetailOpen(true); }}>
                    <div className="flex md:hidden items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{c.id}</span>
                      <div className="flex items-center gap-1">
                        {!isTecnicoMode && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">{sistCount} sist.</span>}
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCentro(c); setIsDetailOpen(true); }} className="p-1.5 text-zinc-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex md:hidden"><div className="flex-1 min-w-0"><p className="text-sm font-bold text-zinc-900 truncate">{c.nombre}</p>{!isTecnicoMode && client && <p className="text-xs text-zinc-500 truncate">{client.nombre}</p>}</div></div>
                    <div className="flex md:hidden items-center gap-3 mt-2">{c.poblacion && <span className="text-xs text-zinc-500">{c.poblacion}</span>}{!isTecnicoMode && c.telefono && <span className="text-xs text-zinc-500">{c.telefono}</span>}</div>
                    <div className="hidden md:flex items-center w-full min-w-[800px]">
                      <div className="w-48 shrink-0"><span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded whitespace-nowrap">{c.id}</span></div>
                      <div className="flex-1 min-w-0 pr-2"><p className="text-sm font-bold text-zinc-900 truncate group-hover:text-blue-900 transition-colors">{c.nombre}</p></div>
                      {!isTecnicoMode && <div className="w-36 shrink-0 text-sm text-zinc-600 truncate pr-2">{client?.nombre || '-'}</div>}
                      <div className="w-32 shrink-0 text-sm text-zinc-600 truncate pr-2 flex items-center gap-1"><MapPin className="w-3 h-3 text-zinc-400 shrink-0" />{c.poblacion || '-'}</div>
                      {!isTecnicoMode && <div className="w-28 shrink-0 text-sm text-zinc-600 truncate pr-2">{c.telefono || '-'}</div>}
                      {!isTecnicoMode && <div className="w-16 shrink-0 text-sm text-zinc-600 text-center pr-2"><span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{sistCount}</span></div>}
                      <div className="w-24 shrink-0 flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCentro(c); setIsDetailOpen(true); }} className="p-1.5 text-zinc-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                        {!isVisualizador && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detalle del Centro" size="lg">
          {selectedCentro && (() => {
            const client = clientes.find(cl => cl.id === selectedCentro.clienteId);
            const tecnicoAsignado = tecnicos.find(t => t.id === selectedCentro.tecnicoId || t._docId === selectedCentro.tecnicoId);
            const empresaAsignada = empresas.find(emp => emp._docId === selectedCentro.empresaId);
            const sistCount = centroSistemas.filter(s => s.centroId === selectedCentro._docId || s.centroId === selectedCentro.id).length;
            return (
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white"><Building2 className="w-6 h-6" /></div>
                  <div><p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Centro</p><h3 className="text-xl font-bold text-zinc-900">{selectedCentro.nombre}</h3><p className="text-sm text-zinc-500 font-mono">{selectedCentro.id}</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Información General</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><Building2 className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Cliente</p><p className="text-sm font-semibold text-zinc-900">{client?.nombre || 'No especificado'}</p></div></div>
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><Phone className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Teléfono</p><p className="text-sm font-semibold text-zinc-900">{selectedCentro.telefono || 'No especificado'}</p></div></div>
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><Mail className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Correo Electrónico</p><p className="text-sm font-semibold text-zinc-900">{selectedCentro.correo || 'No especificado'}</p></div></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Dirección y Contacto</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><MapPin className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Dirección</p><p className="text-sm font-semibold text-zinc-900">{selectedCentro.direccion || 'No especificada'}</p></div></div>
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><MapPin className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Ubicación</p><p className="text-sm font-semibold text-zinc-900">{[selectedCentro.poblacion, selectedCentro.cp, selectedCentro.provincia].filter(Boolean).join(', ') || 'No especificada'}</p></div></div>
                      <div className="flex items-start gap-3"><div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0"><Users className="w-4 h-4" /></div><div><p className="text-xs text-zinc-400 font-medium">Contacto</p><p className="text-sm font-semibold text-zinc-900">{selectedCentro.contacto || 'No especificado'}</p></div></div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Asignaciones</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-zinc-50 rounded-xl p-3.5"><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Sistemas</p><p className="text-sm font-semibold text-zinc-900 mt-1">{sistCount} sistemas instalados</p></div>
                    {empresaAsignada && <div className="bg-zinc-50 rounded-xl p-3.5"><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Empresa</p><p className="text-sm font-semibold text-zinc-900 mt-1">{empresaAsignada.nombre}</p></div>}
                    {tecnicoAsignado && <div className="bg-zinc-50 rounded-xl p-3.5"><p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Técnico</p><p className="text-sm font-semibold text-zinc-900 mt-1">{tecnicoAsignado.nombre} {tecnicoAsignado.apellidos}</p></div>}
                  </div>
                </div>
                {selectedCentro.periodicidad && selectedCentro.periodicidad.length > 0 && (
                  <div className="pt-4 border-t border-zinc-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Periodicidad</h4>
                    <p className="text-sm text-zinc-700 bg-zinc-50 rounded-xl p-3.5">{selectedCentro.periodicidad.join(', ')}{selectedCentro.mesesRevision?.length ? ` — Revisión en ${selectedCentro.mesesRevision[0]}` : ''}</p>
                  </div>
                )}
                {selectedCentro.numeroContrato && (
                  <div className="pt-4 border-t border-zinc-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Contrato de Mantenimiento</h4>
                    <div className="text-sm text-zinc-700 bg-zinc-50 rounded-xl p-3.5 space-y-1.5">
                      <p><strong>Nº Contrato:</strong> {selectedCentro.numeroContrato}</p>
                      {selectedCentro.fechaInicioContrato && <p><strong>Vigencia:</strong> {new Date(selectedCentro.fechaInicioContrato).toLocaleDateString('es-ES')} a {selectedCentro.fechaFinContrato ? new Date(selectedCentro.fechaFinContrato).toLocaleDateString('es-ES') : 'indefinido'}</p>}
                      {selectedCentro.importeAnualContrato && <p><strong>Importe Anual:</strong> {selectedCentro.importeAnualContrato} €</p>}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-zinc-200">
                  <button onClick={() => { setIsDetailOpen(false); setCentroForPeriodicidad(selectedCentro); setFormPeriodicidad({ periodicidad: selectedCentro.periodicidad || [], mesesRevision: selectedCentro.mesesRevision || [] }); setIsPeriodicidadModalOpen(true); }} className="flex items-center justify-center gap-1 bg-blue-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors border border-blue-600"><Layers className="w-3.5 h-3.5" /> Periodicidad</button>
                  <button onClick={() => {
                    setIsDetailOpen(false);
                    setCentroForContrato(selectedCentro);
                    setFormContrato({
                      numeroContrato: selectedCentro.numeroContrato || selectedCentro.id || '',
                      fechaInicio: selectedCentro.fechaInicioContrato || '',
                      fechaFin: selectedCentro.fechaFinContrato || '',
                      observaciones: selectedCentro.observacionesContrato || '',
                      periodicidad: selectedCentro.periodicidad || [],
                      sistemasContrato: selectedCentro.sistemasContrato || (selectedCentro.observacionesContrato ? selectedCentro.observacionesContrato.split(', ').filter(Boolean) : []),
                      precioAnual: (selectedCentro as any).precioAnualContrato || '',
                      precioTrimestral: (selectedCentro as any).precioTrimestralContrato || '',
                      precioMensual: (selectedCentro as any).precioMensualContrato || ''
                    });
                    setIsContratoModalOpen(true);
                  }} className="flex items-center justify-center gap-1 bg-amber-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors border border-amber-600">
                    <FileText className="w-3.5 h-3.5" /> Contrato Mantenimiento
                  </button>
                  <button onClick={() => { setIsDetailOpen(false); setCentroForTecnico(selectedCentro); setSelectedTecnicoId(selectedCentro.tecnicoId || ''); setIsTecnicoModalOpen(true); }} className="flex items-center justify-center gap-1 bg-green-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-500 transition-colors border border-green-600"><UserCheck className="w-3.5 h-3.5" /> {isTecnicoMode ? 'Técnico Asignado' : 'Asignar Técnico'}</button>
                  <button onClick={() => { setIsDetailOpen(false); setCentroForEmpresa(selectedCentro); setSelectedEmpresaId(selectedCentro.empresaId || ''); setIsEmpresaModalOpen(true); }} className="flex items-center justify-center gap-1 bg-rose-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-rose-500 transition-colors border border-rose-600"><Building2 className="w-3.5 h-3.5" /> Empresa Mantenedora</button>
                  {!isTecnicoMode && (
                    <button onClick={() => { setIsDetailOpen(false); handleEdit(selectedCentro); }} className="flex items-center justify-center gap-1 bg-zinc-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-500 transition-colors border border-zinc-600"><Edit className="w-3.5 h-3.5" /> Editar Centro</button>
                  )}
                  <button onClick={() => { setIsDetailOpen(false); openSistemas(selectedCentro); }} className="flex items-center justify-center gap-1 bg-orange-200 text-orange-800 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-300 transition-colors border border-orange-400"><Layers className="w-3.5 h-3.5" /> Ver Sistemas</button>
                </div>
              </div>
            );
          })()}
        </DetailModal>

        {isPeriodicidadModalOpen && centroForPeriodicidad && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div><h2 className="text-lg font-bold text-zinc-900">Periodicidad</h2><p className="text-xs text-zinc-500">{centroForPeriodicidad.nombre}</p></div>
                <button onClick={() => setIsPeriodicidadModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSavePeriodicidad} className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">1. Tipo de contrato</h3>
                  <div className="flex flex-wrap gap-4">
                    {['Mensual', 'Trimestral', 'Anual'].map(type => (
                      <label key={type} className={`flex items-center gap-2 group ${isTecnicoMode ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                        <input disabled={isTecnicoMode} type="checkbox" checked={formPeriodicidad.periodicidad.includes(type)} onChange={e => { const newTypes = e.target.checked ? [...formPeriodicidad.periodicidad, type] : formPeriodicidad.periodicidad.filter(t => t !== type); setFormPeriodicidad({ ...formPeriodicidad, periodicidad: newTypes }); }} className={`w-5 h-5 text-black rounded border-zinc-300 focus:ring-black ${isTecnicoMode ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
                        <span className={`text-sm font-medium text-zinc-700 ${!isTecnicoMode && 'group-hover:text-black'} transition-colors`}>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">2. ¿Cuándo sería la revisión Anual?</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {MESES.map(mes => (
                      <label key={mes} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${formPeriodicidad.mesesRevision.includes(mes) ? 'bg-zinc-900 border-emerald-500 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-600'} ${isTecnicoMode ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-zinc-100'}`}>
                        <input disabled={isTecnicoMode} type="radio" name="mesRevision" className="hidden" checked={formPeriodicidad.mesesRevision.includes(mes)} onChange={() => { setFormPeriodicidad({ ...formPeriodicidad, mesesRevision: [mes] }); }} />
                        <span className="text-xs font-bold w-full text-center">{mes}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Resumen del contrato</h3>
                  {(() => {
                    const tipos = formPeriodicidad.periodicidad;
                    const mesRevis = formPeriodicidad.mesesRevision[0] || '';
                    const lineas: string[] = [];
                    if (tipos.includes('Anual') && mesRevis) { lineas.push(`Revisión anual: ${mesRevis.toLowerCase()}`); } else if (tipos.includes('Anual')) { lineas.push('Revisión anual: (selecciona un mes)'); }
                    if (tipos.includes('Trimestral') && mesRevis) { const idx = MESES.indexOf(mesRevis); const trimestres = [3, 6, 9].map(offset => MESES[(idx + offset) % 12]); lineas.push(`Revisión trimestral: ${trimestres.join(', ').toLowerCase()}`); } else if (tipos.includes('Trimestral')) { lineas.push('Revisión trimestral: (selecciona un mes de referencia)'); }
                    if (tipos.includes('Mensual')) { lineas.push('Revisión mensual'); }
                    return lineas.length > 0 ? (<div className="text-sm font-medium text-zinc-900 leading-relaxed space-y-1">{lineas.map((linea, i) => (<p key={i}>{linea}</p>))}</div>) : (<p className="text-sm text-zinc-400 italic">Selecciona al menos un tipo de contrato y un mes para ver el resumen.</p>);
                  })()}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsPeriodicidadModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">{isTecnicoMode ? 'Cerrar' : 'Cancelar'}</button>
                  {!isTecnicoMode && <button type="submit" className="flex-1 bg-black hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-black/10 transition-all">Guardar Periodicidad</button>}
                </div>
              </form>
            </div>
          </div>
        )}

        {isContratoModalOpen && centroForContrato && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div><h2 className="text-lg font-bold text-zinc-900">Contrato de Mantenimiento</h2><p className="text-xs text-zinc-500">{centroForContrato.nombre}</p></div>
                <button onClick={() => setIsContratoModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveContrato} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Nº de Contrato</label>
                    <input
                      disabled={isTecnicoMode}
                      type="text"
                      value={formContrato.numeroContrato}
                      onChange={e => setFormContrato({ ...formContrato, numeroContrato: e.target.value })}
                      placeholder="Ej: CONT-2026-0001"
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-zinc-400 transition-colors bg-white text-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Fecha de Inicio</label>
                    <input
                      disabled={isTecnicoMode}
                      type="date"
                      value={formContrato.fechaInicio}
                      onChange={e => setFormContrato({ ...formContrato, fechaInicio: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-zinc-400 transition-colors bg-white text-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Fecha de Fin / Vencimiento</label>
                    <input
                      disabled={isTecnicoMode}
                      type="date"
                      value={formContrato.fechaFin}
                      onChange={e => setFormContrato({ ...formContrato, fechaFin: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm outline-none focus:border-zinc-400 transition-colors bg-white text-black"
                    />
                  </div>
                </div>

                {/* Selector de Periodicidad */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700">Periodicidad del Contrato e Importe por revisión</label>
                  <div className="space-y-3 p-3.5 border border-zinc-200 rounded-xl bg-zinc-50/30">
                    {[
                      { type: 'Anual', stateKey: 'precioAnual', label: 'Anual (Revisión Anual)' },
                      { type: 'Trimestral', stateKey: 'precioTrimestral', label: 'Trimestral (Revisión Trimestral)' },
                      { type: 'Mensual', stateKey: 'precioMensual', label: 'Mensual (Revisión Mensual)' }
                    ].map(({ type, stateKey, label }) => {
                      const isChecked = formContrato.periodicidad.includes(type);
                      return (
                        <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 last:border-b-0 pb-2.5 last:pb-0">
                          <label className={`flex items-center gap-2 group ${isTecnicoMode ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                            <input
                              disabled={isTecnicoMode}
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const newTypes = e.target.checked
                                  ? [...formContrato.periodicidad, type]
                                  : formContrato.periodicidad.filter(t => t !== type);
                                setFormContrato({ ...formContrato, periodicidad: newTypes });
                              }}
                              className={`w-4 h-4 text-black rounded border-zinc-300 focus:ring-black ${isTecnicoMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            />
                            <span className={`text-sm font-medium text-zinc-700 ${!isTecnicoMode && 'group-hover:text-black'} transition-colors`}>{label}</span>
                          </label>
                          
                          {isChecked && (
                            <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                              <span className="text-xs font-medium text-zinc-500">Importe (€):</span>
                              <input
                                disabled={isTecnicoMode}
                                type="number"
                                value={formContrato[stateKey as 'precioAnual' | 'precioTrimestral' | 'precioMensual']}
                                onChange={e => setFormContrato({ ...formContrato, [stateKey]: e.target.value })}
                                placeholder="Ej: 150"
                                className="w-24 px-2.5 py-1 border border-zinc-200 rounded-lg text-xs outline-none focus:border-zinc-400 bg-white text-black text-right font-semibold"
                              />
                              <span className="text-[10px] text-zinc-400 font-bold uppercase shrink-0">+ IVA</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sistemas a Revisar */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700">Sistemas a revisar</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-zinc-200 rounded-xl p-3 bg-zinc-50/30">
                    {categoriasSistema.map(cat => (
                      <label key={cat.id} className={`flex items-center gap-1.5 group ${isTecnicoMode ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} py-0.5`}>
                        <input
                          disabled={isTecnicoMode}
                          type="checkbox"
                          checked={formContrato.sistemasContrato.includes(cat.nombre)}
                          onChange={e => {
                            const newSist = e.target.checked
                              ? [...formContrato.sistemasContrato, cat.nombre]
                              : formContrato.sistemasContrato.filter(s => s !== cat.nombre);
                            setFormContrato({ ...formContrato, sistemasContrato: newSist });
                          }}
                          className={`w-3.5 h-3.5 text-black rounded border-zinc-300 focus:ring-black ${isTecnicoMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                        <span className={`text-xs font-semibold text-zinc-600 ${!isTecnicoMode && 'group-hover:text-black'} transition-colors truncate`}>{cat.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex gap-3 items-center">
                  <button
                    type="button"
                    onClick={async () => {
                      const client = clientes.find(cl => cl.id === centroForContrato.clienteId);
                      const systems = centroSistemas
                        .filter(s => s.centroId === centroForContrato._docId || s.centroId === centroForContrato.id)
                        .map(s => {
                          const count = equiposInstalados.filter(eq => 
                            (eq.centroId === centroForContrato.id || eq.centroId === centroForContrato._docId) && 
                            eq.sistemaId === s.id
                          ).length;
                          return {
                            ...s,
                            cantidadEquipos: count
                          };
                        });
                      
                      const pAnual = parseFloat(formContrato.precioAnual) || 0;
                      const pTrimestral = parseFloat(formContrato.precioTrimestral) || 0;
                      const pMensual = parseFloat(formContrato.precioMensual) || 0;

                      let total = 0;
                      const isMensual = formContrato.periodicidad.includes('Mensual');
                      const isTrimestral = formContrato.periodicidad.includes('Trimestral');
                      const isAnual = formContrato.periodicidad.includes('Anual');

                      if (isAnual && isTrimestral && isMensual) {
                        total = pAnual + (pTrimestral * 3) + (pMensual * 8);
                      } else if (isAnual && isTrimestral) {
                        total = pAnual + (pTrimestral * 3);
                      } else if (isAnual && isMensual) {
                        total = pAnual + (pMensual * 11);
                      } else if (isTrimestral && isMensual) {
                        total = (pTrimestral * 4) + (pMensual * 8);
                      } else if (isAnual) {
                        total = pAnual;
                      } else if (isTrimestral) {
                        total = pTrimestral * 4;
                      } else if (isMensual) {
                        total = pMensual * 12;
                      }

                      const tempCentro = {
                        ...centroForContrato,
                        numeroContrato: formContrato.numeroContrato.trim(),
                        fechaInicioContrato: formContrato.fechaInicio,
                        fechaFinContrato: formContrato.fechaFin,
                        importeAnualContrato: String(total),
                        observacionesContrato: formContrato.sistemasContrato.join(', '),
                        periodicidad: formContrato.periodicidad,
                        sistemasContrato: formContrato.sistemasContrato,
                        precioAnualContrato: formContrato.precioAnual.trim(),
                        precioTrimestralContrato: formContrato.precioTrimestral.trim(),
                        precioMensualContrato: formContrato.precioMensual.trim()
                      };

                      await generarContratoPDF(client, tempCentro, systems, {
                        numeroContrato: formContrato.numeroContrato.trim(),
                        fechaInicio: formContrato.fechaInicio,
                        fechaFin: formContrato.fechaFin,
                        importeAnual: String(total),
                        observaciones: formContrato.sistemasContrato.join(', ')
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar PDF
                  </button>

                  {!isTecnicoMode && (
                    <button
                      type="submit"
                      className="flex-1 bg-black hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-black/10 transition-all cursor-pointer text-center"
                    >
                      Guardar Contrato
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {isTecnicoModalOpen && centroForTecnico && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-blue-50/70">
                <div><h2 className="text-lg font-bold text-zinc-900">Asignar técnico</h2><p className="text-xs text-zinc-500">{centroForTecnico.nombre}</p></div>
                <button onClick={() => setIsTecnicoModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveTecnicoAsignado} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-blue-900 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Técnico asignado al centro</label>
                  <select disabled={isTecnicoMode} value={selectedTecnicoId} onChange={e => setSelectedTecnicoId(e.target.value)} className={`w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${isTecnicoMode ? 'opacity-75 cursor-not-allowed' : ''}`}>
                    <option value="">Sin técnico asignado</option>
                    {tecnicos.map(t => (<option key={t._docId ?? t.id} value={t.id}>{t.nombre} {t.apellidos}</option>))}
                  </select>
                  {!isTecnicoMode && <p className="text-xs text-zinc-500">Esta asignación se aplicará también a los partes existentes de este centro.</p>}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsTecnicoModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">{isTecnicoMode ? 'Cerrar' : 'Cancelar'}</button>
                  {!isTecnicoMode && <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all">Guardar técnico</button>}
                </div>
              </form>
            </div>
          </div>
        )}

        {isEmpresaModalOpen && centroForEmpresa && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-rose-50/80">
                <div><h2 className="text-lg font-bold text-zinc-900">Empresa asignada</h2><p className="text-xs text-zinc-500">{centroForEmpresa.nombre}</p></div>
                <button onClick={() => setIsEmpresaModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveEmpresaAsignada} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-rose-950 flex items-center gap-2"><Building2 className="w-4 h-4" /> Empresa asignada al centro</label>
                  <select disabled={isTecnicoMode} value={selectedEmpresaId} onChange={e => setSelectedEmpresaId(e.target.value)} className={`w-full px-4 py-3 bg-rose-50/30 border border-rose-100 rounded-xl focus:ring-2 focus:ring-rose-800/20 focus:border-rose-800 outline-none ${isTecnicoMode ? 'opacity-75 cursor-not-allowed' : ''}`}>
                    <option value="">Sin empresa asignada</option>
                    {empresas.map(emp => (<option key={emp._docId} value={emp._docId}>{emp.nombre}{emp.cif ? ` (${emp.cif})` : ''}</option>))}
                  </select>
                  {!isTecnicoMode && <p className="text-xs text-zinc-500">Esta asignación se aplicará también a los partes existentes de este centro.</p>}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsEmpresaModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">{isTecnicoMode ? 'Cerrar' : 'Cancelar'}</button>
                  {!isTecnicoMode && <button type="submit" className="flex-1 bg-rose-900 hover:bg-rose-950 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-rose-200 transition-all">Guardar empresa</button>}
                </div>
              </form>
            </div>
          </div>
        )}

        {isConfirmModalOpen && itemToDelete && (
          <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => { setIsConfirmModalOpen(false); setItemToDelete(null); }} onConfirm={itemToDelete.type === 'centro' ? confirmDeleteCentro : itemToDelete.type === 'sistema' ? confirmDeleteSistema : confirmDeleteEquipo} title="Confirmar Eliminación" message="ATENCIÓN: Vas a proceder al borrado del elemento y sus registros ¿CONFIRMAS LA PETICIÓN?" confirmText="Sí, eliminar" cancelText="No, cancelar" />
        )}
      </div>
    );
  }

  if (view === 'sistemas' && centroSeleccionado) {
    const sistDelCentro = centroSistemas.filter(s => s.centroId === (centroSeleccionado._docId || centroSeleccionado.id));
    const clientInfo = clientes.find(cl => cl.id === centroSeleccionado.clienteId);
    return (
      <div className="px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto w-full">
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-5 transition-colors"><ArrowLeft className="w-3.5 h-3.5" /> Volver a Centros</button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{clientInfo?.nombre || 'Cliente'} · {centroSeleccionado.nombre}</p>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2"><Layers className="w-6 h-6 text-zinc-500" />Sistemas del Centro</h1>
              <p className="text-sm text-zinc-500 mt-1">{sistDelCentro.length} sistemas instalados</p>
            </div>
            {!isTecnicoMode && (
              <button onClick={(e) => { e.preventDefault(); setCentroForNewSistema(centroSeleccionado); setSelectedCatIdForCentro(''); setIsAddCatModalOpen(true); }} className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"><Plus className="w-3.5 h-3.5" /> Añadir sistema</button>
            )}
          </div>
          {/* TABLA TIPO LISTA CON ACORDEÓN */}
          {sistDelCentro.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><Layers className="w-8 h-8 text-zinc-400" /></div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Sin sistemas instalados</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">Este centro no tiene sistemas registrados. Añade el primer sistema con el botón de arriba.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
              {/* Cabecera de tabla */}
              <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 min-w-[600px]">
                <div className="w-8 shrink-0"></div>
                <div className="w-10 shrink-0"></div>
                <div className="flex-1 min-w-0 pl-2">Sistema</div>
                <div className="w-24 shrink-0 text-center">Equipos</div>
                <div className="w-32 shrink-0 text-right">Acciones</div>
              </div>
              <div className="divide-y divide-zinc-100">
                {sistDelCentro.map(sist => {
                  const equiposDelSistema = equiposInstalados
                    .filter(e => e.sistemaId === sist.id)
                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }));
                  const equiposCount = equiposDelSistema.length;
                  const isExpanded = expandedSistemaId === sist.id;
                  const IconoCat = getIconForSistema(sist.tipo || sist.familia || '');
                  return (
                    <div key={sist.id}>
                      {/* FILA DEL SISTEMA */}
                      <div
                        className={`flex items-center px-4 py-3.5 bg-white transition-colors group min-w-[600px] ${isTecnicoMode ? 'cursor-default' : 'hover:bg-zinc-50/70 cursor-pointer'}`}
                        onClick={() => { if (!isTecnicoMode) setExpandedSistemaId(isExpanded ? null : sist.id); }}
                      >
                        <div className="w-8 shrink-0 flex items-center justify-center">
                          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          </div>
                        </div>
                        <div className="w-10 h-10 flex items-center justify-center shrink-0">
                          {IconoCat && (typeof IconoCat === 'string' ? (
                            <img src={IconoCat} alt="Icon" className="w-8 h-8 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-600">
                              <IconoCat className="w-5 h-5" />
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0 pl-3">
                          <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-blue-900 transition-colors">{sist.familia || sist.tipo}</p>
                          {sist.descripcion && <p className="text-xs text-zinc-400 truncate mt-0.5">{sist.descripcion}</p>}
                        </div>
                        <div className="w-24 shrink-0 text-center">
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[11px] font-bold">{equiposCount}</span>
                        </div>
                        <div className="w-32 shrink-0 flex items-center justify-end gap-1">
                          {!isTecnicoMode && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSistema(sist.id); }} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar sistema"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </div>
                      {/* CONTENIDO DEL ACORDEÓN (EQUIPOS) */}
                      {isExpanded && (
                        <div className="bg-zinc-100/80 border-t border-zinc-200 px-4 md:px-14 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Equipos del sistema</h5>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSistemaSeleccionado(sist);
                                setFormEquipo({ id: '', centroId: centroSeleccionado!.id, sistemaId: sist.id, codigo: '', nombre: '', ubicacion: '' });
                                setIsEquipoModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-bold transition-colors shadow-sm"
                            >
                              <Plus className="w-3 h-3" /> Añadir equipo
                            </button>
                          </div>
                          {equiposDelSistema.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic py-4 text-center bg-white rounded-lg border border-dashed border-zinc-200">No hay equipos en este sistema.</p>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="hidden md:flex items-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                <div className="w-16 shrink-0">Orden</div>
                                <div className="flex-1 min-w-0">Tipo</div>
                                <div className="w-36 shrink-0">Ubicación</div>
                                <div className="w-20 shrink-0 text-right">Acciones</div>
                              </div>
                              {equiposDelSistema.filter(eq => eq.revisable !== false).map((eq: any, i) => {
                                const hasAnomalies = Object.keys(eq).some(k => k.startsWith('check') && eq[k] === false);
                                return (
                                  <div key={eq.id} className="flex flex-col md:flex-row md:items-center px-3 py-2.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-300 transition-colors">
                                    <div className="flex md:hidden items-center justify-between mb-1">
                                      <span className="text-[10px] font-mono font-bold text-zinc-400">#{eq.codigo || (i+1).toString().padStart(2, '0')}</span>
                                      <div className="flex items-center gap-1">
                                        {hasAnomalies && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                      </div>
                                    </div>
                                    <div className="w-full md:w-16 shrink-0 hidden md:block">
                                      <span className="px-1.5 py-0.5 bg-zinc-900 text-white text-[10px] font-mono font-bold rounded-lg">{eq.codigo || (i+1).toString().padStart(2, '0')}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-semibold text-zinc-800">{eq.nombre || eq.tipo || eq.modelo || 'Equipo sin tipo'}</span>
                                    </div>
                                    <div className="w-full md:w-36 shrink-0 text-xs text-zinc-500 truncate mt-0.5 md:mt-0">{eq.ubicacion || '—'}</div>
                                    {!isTecnicoMode && (
                                      <div className="flex items-center gap-1 shrink-0 mt-1 md:mt-0 justify-end">
                                        {hasAnomalies && <span className="hidden md:inline" title="Anomalías detectadas"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>}
                                        <button onClick={(e) => { e.stopPropagation(); handleEditEquipo(eq, sist); }} className="p-1 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar equipo"><Edit className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDuplicateEquipoCentro(eq); }} className="p-1 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors" title="Duplicar equipo"><Copy className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEquipo(eq.id); }} className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar equipo"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isEquipoModalOpen && sistemaSeleccionado && centroSeleccionado && (
            <EquipoFormulario
              equipo={formEquipo.id ? formEquipo : null}
              sistemaId={sistemaSeleccionado.id}
              sistemaNombre={sistemaSeleccionado.tipo || sistemaSeleccionado.familia || ''}
              centroId={centroSeleccionado._docId || centroSeleccionado.id}
              plantillaId={sistemaSeleccionado.tipo || sistemaSeleccionado.familia || ''}
              equiposExistentes={equiposInstalados.filter(e => e.sistemaId === sistemaSeleccionado.id)}
              onSave={async (equipo) => {
                if (formEquipo.id) {
                  await updateEquipoInstalado(equipo.id!, equipo as any);
                } else {
                  const equipoConCodigo = {
                    ...equipo,
                    codigo: equipo.codigo || ''
                  };
                  await addEquipoInstalado(equipoConCodigo as any);
                }
                setIsEquipoModalOpen(false);
                setFormEquipo({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' });
              }}
              onCancel={() => {
                setIsEquipoModalOpen(false);
                setFormEquipo({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' });
              }}
              isNew={!formEquipo.id}
            />
          )}

          {isSistemaModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <h2 className="text-lg font-bold text-zinc-900">Editar Sistema</h2>
                  <button onClick={() => setIsSistemaModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSaveSistema} className="p-6 space-y-4">
                  <div className="space-y-1.5"><label className="text-sm font-semibold text-zinc-900">Familia / Nombre en este centro *</label><input required type="text" value={formSistema.familia} onChange={e => setFormSistema({...formSistema, familia: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all text-zinc-900" placeholder="Ej: SISTEMA EXTINTORES NAVE 1" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-semibold text-zinc-900">Descripción / Notas</label><textarea value={formSistema.descripcion} onChange={e => setFormSistema({...formSistema, descripcion: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all text-zinc-900 resize-none" rows={3} placeholder="Alguna observación sobre este sistema..." /></div>
                  <div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsSistemaModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button><button type="submit" className="flex-1 px-4 py-2.5 text-white bg-zinc-900 hover:bg-black rounded-xl font-medium transition-colors shadow-sm">Guardar Cambios</button></div>
                </form>
              </div>
            </div>
          )}

          {isAddCatModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <h2 className="text-lg font-bold text-zinc-900">Añadir Sistema al Centro</h2>
                  <button onClick={() => setIsAddCatModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddSistemaFromCatalog} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-zinc-900">Seleccionar Sistema *</label>
                    <select required value={selectedCatIdForCentro} onChange={e => setSelectedCatIdForCentro(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all text-zinc-900">
                      <option value="">-- Elige un sistema --</option>
                      {categoriasSistema.map(cat => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
                    </select>
                    {categoriasSistema.length === 0 && (<p className="text-xs text-amber-600 font-medium">No hay sistemas disponibles. Ve a la sección Sistemas para crear categorías.</p>)}
                  </div>
                  <div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsAddCatModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button><button type="submit" disabled={!selectedCatIdForCentro} className="flex-1 px-4 py-2.5 text-white bg-zinc-900 hover:bg-black disabled:opacity-50 rounded-xl font-medium transition-colors shadow-sm">Añadir al Centro</button></div>
                </form>
              </div>
            </div>
          )}

          {isConfirmModalOpen && itemToDelete && (
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => { setIsConfirmModalOpen(false); setItemToDelete(null); }} onConfirm={itemToDelete.type === 'centro' ? confirmDeleteCentro : itemToDelete.type === 'sistema' ? confirmDeleteSistema : confirmDeleteEquipo} title="Confirmar Eliminación" message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?" confirmText="Sí, eliminar" cancelText="No, cancelar" />
          )}
        </div>
      </div>
    );
  }

  // Form view (añadir/editar centro)
  return (
    <div className="min-h-screen bg-emerald-50/40 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { setView('list'); setForm(emptyCentro); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors"><ArrowLeft className="w-4 h-4" /> Volver al directorio</button>
        </div>
        <div className="mb-6">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center mb-3"><MapPin className="w-5 h-5" /></div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{form.id ? 'Editar Centro de Trabajo' : 'Añadir Nuevo Centro'}</h1>
          <p className="text-zinc-500 mt-1 text-sm">Selecciona a qué cliente pertenece este centro y rellena sus datos.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <form className="space-y-3" onSubmit={handleSave}>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <h2 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-wide">1. Vinculación y Código</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-900 mb-1.5">SELECCIONAR CLIENTE *</label>
                  {form.id ? (
                    <select required disabled value={form.clienteId} className="w-full px-3 py-2.5 text-sm bg-white rounded-lg border border-zinc-200 text-zinc-900 disabled:opacity-50">
                      <option value={form.clienteId}>{clientes.find(c => c.id === form.clienteId)?.nombre || form.clienteId}</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-zinc-400" /></div>
                      <input
                        type="text"
                        value={clienteSearchTerm}
                        onChange={e => setClienteSearchTerm(e.target.value)}
                        onFocus={() => setShowClienteDropdown(true)}
                        placeholder="Buscar cliente..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-lg border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400"
                      />
                      {showClienteDropdown && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {clientesFiltrados.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-zinc-400">No se encontraron clientes</div>
                          ) : (
                            clientesFiltrados.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { setForm({...form, clienteId: c.id}); setClienteSearchTerm(c.nombre); setShowClienteDropdown(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 transition-colors ${form.clienteId === c.id ? 'bg-zinc-100 font-semibold' : ''}`}
                              >
                                {c.nombre}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedCliente && (
                  <div className="flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2.5">
                    <div className="flex-1"><p className="text-[10px] text-zinc-400 font-semibold mb-0.5">DATOS DEL CLIENTE</p><p className="text-sm font-medium text-zinc-900">{selectedCliente.nombre} <span className="text-zinc-400 font-mono ml-1 text-xs">{selectedCliente.cif}</span></p></div>
                    <button type="button" onClick={handleCopyFromCliente} className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors" title="Copiar datos del cliente al centro"><Copy className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              {selectedCliente && (
                <div className="bg-black text-white p-4 rounded-lg flex items-center justify-between">
                  <div><p className="text-[10px] text-zinc-400 font-bold mb-0.5">CÓDIGO DE CENTRO</p><p className="text-lg font-mono font-bold tracking-wider">{idPreview || 'CEN XXXX-XX-(XXXX)'}</p></div>
                  <div className="text-right w-1/3"><label className="block text-[10px] text-red-400 font-bold mb-0.5">codigo periodicidad <span className="text-red-500">*</span></label><input required type="text" value={form.customIdPart} onChange={e => setForm({...form, customIdPart: e.target.value.toUpperCase()})} className="w-full px-2 py-1.5 bg-white/10 rounded-md border border-white/20 focus:bg-white/20 outline-none transition-all text-white font-mono text-xs text-right placeholder-white/30 uppercase" placeholder="Ej: A001" maxLength={10} /></div>
                </div>
              )}
            </div>
            <hr className="border-zinc-100 my-4" />
            <div>
              <h2 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-wide">2. Datos del Centro</h2>
              <div className="space-y-3">
                <div><label className="block text-xs font-semibold text-zinc-900 mb-1">NOMBRE DEL CENTRO *</label><input required type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" placeholder="Ej. Nave Principal, Sede Norte..." /></div>
                <div><label className="block text-xs font-semibold text-zinc-900 mb-1">DIRECCIÓN</label><input type="text" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" placeholder="Calle, Polígono, número..." /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">POBLACIÓN</label><input type="text" value={form.poblacion} onChange={e => setForm({...form, poblacion: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">CÓDIGO POSTAL</label><input type="text" value={form.cp} onChange={e => setForm({...form, cp: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">PROVINCIA</label><input type="text" value={form.provincia} onChange={e => setForm({...form, provincia: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
 
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">CONTACTO (En el centro)</label><input type="text" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">TELÉFONO</label><input type="tel" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
                  <div><label className="block text-xs font-semibold text-zinc-900 mb-1">CORREO</label><input type="email" value={form.correo} onChange={e => setForm({...form, correo: e.target.value})} className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" /></div>
                </div>
              </div>
            </div>
            <div className="pt-4 flex items-center justify-end gap-3">
              <button type="submit" disabled={!form.clienteId} className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-md active:scale-95"><Save className="w-4 h-4" /> {form.id ? 'Guardar Cambios' : 'Registrar Centro'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}