/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Search, Edit, Trash2, MapPin, Layers, X, Copy, AlertTriangle, Upload, Download, Building2, UserCheck, Eye, Phone, Mail, Users, ChevronRight, CreditCard } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CATEGORIAS_POR_DEFECTO, getIconForSistema } from './Sistemas';
import { addCentro, updateCentro, deleteCentro, subscribeCentros, subscribeFamilias, subscribeArticulos, subscribeTecnicos, subscribeEmpresas, addCentroSistema, deleteCentroSistema, subscribeCentroSistemas, addEquipoInstalado, updateEquipoInstalado, deleteEquipoInstalado, subscribeEquiposInstalados, sistemaToSlug, saveContrato, syncContratosExistentes, updateParte as updateParteFirestore, subscribeSistemasCategorias } from './firebase';
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
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
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
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
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
  comentariosTecnico?: string;
  comentariosPrivados?: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
}

export interface Parte {
  id: string;
  centroId: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Abierto' | 'En revisión' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado' | 'Pre-Cerrado' | 'Retimbrando';
  tipoTrabajo?: string;
  numeroMantenimiento?: string;
  fechaProgramada?: string;
  empresaId?: string;
  firmaCliente?: string;
  firmaTecnico?: string;
  nombreFirmante?: string;
  retirarExtintoresRetimbrado?: boolean;
  dejarExtintoresDeposito?: boolean;
  cantidadExtintoresDeposito?: number;
  retimbradoReiniciado?: boolean;
  observacionesTecnico?: string;
  cantidadRetimbrados?: number;
  comentariosPrivados?: string;
  equiposRetirados?: boolean;
  retimbrado?: boolean;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
};

export const getNombreEquipoDisplay = (eq: any) => {
  if (!eq) return 'Equipo sin tipo';
  const isValid = (val: any) => {
    if (val === undefined || val === null || val === '') return false;
    const s = String(val).trim().toLowerCase();
    return s !== 'true' && s !== 'false' && s !== 'sí' && s !== 'no' && s !== 'ok' && s !== 'correcto' && s !== 'incorrecto';
  };
  if (isValid(eq.nombre)) return eq.nombre;
  if (isValid(eq.tipo)) return eq.tipo;
  if (isValid(eq.clase)) return eq.clase;
  if (isValid(eq.modelo)) return eq.modelo;
  if (isValid(eq.pesoCapacidad)) return eq.pesoCapacidad;
  return 'Equipo sin tipo';
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
  correoGeneral: '', correoAdministracion: '', correoFacturacion: '', correoMantenimiento: '', correoCompras: '', correoPedidos: '', correoOtro: '',
  periodicidad: [], mesesRevision: [],
  formaPago: '', vencimiento: '', iban: '', notas: ''
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
  const [categoriasSistema, setCategoriasSistema] = useState<{id: string, nombre: string, imagenUrl?: string}[]>(() => { const saved = localStorage.getItem('firecheck_db_sistemas_categorias'); return saved ? JSON.parse(saved) : CATEGORIAS_POR_DEFECTO; });
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
    precioMensual: '',
    formaPago: 'Transferencia bancaria'
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [sistemasSourceView, setSistemasSourceView] = useState('list');
  const [isSaving, setIsSaving] = useState(false);

  const handleTryCloseDetail = () => {
    if (!selectedCentro) {
      setIsDetailOpen(false);
      return;
    }

    const missingFields = [];

    // 1. Periodicidad
    if (!selectedCentro.periodicidad || selectedCentro.periodicidad.length === 0) {
      missingFields.push('Periodicidad (debes configurar al menos una frecuencia: Mensual, Trimestral o Anual).');
    }

    // 2. Contrato de Mantenimiento
    if (!selectedCentro.numeroContrato || String(selectedCentro.numeroContrato).trim() === '') {
      missingFields.push('Contrato de Mantenimiento (debes completar los datos del contrato).');
    }

    // 3. Asignar Técnico
    if (!selectedCentro.tecnicoId || String(selectedCentro.tecnicoId).trim() === '') {
      missingFields.push('Asignar Técnico (debes asignar un técnico al centro).');
    }

    // 4. Empresa Mantenedora
    if (!selectedCentro.empresaId || String(selectedCentro.empresaId).trim() === '') {
      missingFields.push('Empresa Mantenedora (debes asignar la empresa mantenedora).');
    }

    // 5. Editar Centro (datos generales)
    const generalFields = [
      { key: 'telefono', label: 'Teléfono' },
      { key: 'correo', label: 'Correo Electrónico' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'poblacion', label: 'Población' },
      { key: 'cp', label: 'Código Postal (CP)' },
      { key: 'provincia', label: 'Provincia' },
      { key: 'contacto', label: 'Persona de Contacto' }
    ];
    const emptyGeneral = generalFields
      .filter(f => !(selectedCentro as any)[f.key] || String((selectedCentro as any)[f.key]).trim() === '')
      .map(f => f.label);
    
    if (emptyGeneral.length > 0) {
      missingFields.push('Editar Centro (faltan rellenar los siguientes datos generales: ' + emptyGeneral.join(', ') + ').');
    }

    // 6. Ver Sistemas
    const sistCount = centroSistemas.filter(s => s.centroId === selectedCentro._docId || s.centroId === selectedCentro.id).length;
    if (sistCount === 0) {
      missingFields.push('Ver Sistemas (debes añadir al menos 1 sistema instalado al centro).');
    }

    // Mostrar modal con listado de errores si falta algo
    if (missingFields.length > 0) {
      setValidationErrors(missingFields);
      setShowValidationModal(true);
    } else {
      setIsDetailOpen(false);
    }
  };
  const [expandedSistemaId, setExpandedSistemaId] = useState<string | null>(null);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  useEffect(() => {
    if (form.clienteId) {
      const client = clientes.find(c => c.id === form.clienteId);
      if (client && clienteSearchTerm !== client.nombre && !showClienteDropdown) {
        setClienteSearchTerm(client.nombre);
      }
    } else {
      if (!showClienteDropdown) {
        setClienteSearchTerm('');
      }
    }
  }, [form.clienteId, clientes, showClienteDropdown]);

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
    try {
      unsub = subscribeCentros((items: any[]) => {
        const uniqueMap = new Map<string, any>();
        items.forEach((d: any) => {
          const key = d.id || d._docId;
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, { ...d });
          }
        });
        const mapped = Array.from(uniqueMap.values());
        setCentros(mapped);
        localStorage.setItem('firecheck_db_centros', JSON.stringify(mapped));
      });
    } catch (e) { console.error('subscribeCentros failed', e); }
    return () => { if (unsub) unsub(); };
  }, []);

  const syncRef = useRef(false);

  useEffect(() => {
    if (centros.length > 0 && !syncRef.current) {
      syncRef.current = true;
      syncContratosExistentes(centros);
    }
  }, [centros]);

  // Suscripción en tiempo real a las categorías de sistemas
  useEffect(() => {
    const unsub = subscribeSistemasCategorias((cats) => {
      if (cats && cats.length > 0) {
        setCategoriasSistema(cats);
        localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(cats));
      }
    });
    return () => unsub();
  }, []);

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

  useEffect(() => {
    if (!form.clienteId || !form.customIdPart || form.customIdPart.trim() === '') return;

    if (!form._docId) {
      const generatedId = calculateNextCentroId(form.clienteId, form.customIdPart);
      if (form.id !== generatedId) {
        const oldId = form.id;
        setForm(prev => ({ ...prev, id: generatedId }));
        if (oldId && oldId !== generatedId) {
          setCentroSistemas(prev => prev.map(s => s.centroId === oldId ? { ...s, centroId: generatedId } : s));
        }
      }
    } else {
      const originalCentro = centros.find(c => c._docId === form._docId);
      if (originalCentro) {
        const clientChanged = originalCentro.clienteId !== form.clienteId;
        const customPartChanged = originalCentro.customIdPart !== form.customIdPart;
        
        if (clientChanged || customPartChanged) {
          let targetId = originalCentro.id;
          if (clientChanged) {
            targetId = calculateNextCentroId(form.clienteId, form.customIdPart);
          } else if (customPartChanged) {
            const parts = originalCentro.id.split('-');
            if (parts.length >= 3) {
              targetId = parts[0] + '-' + parts[1] + '-(' + (form.customIdPart || 'XXXX') + ')';
            } else {
              targetId = calculateNextCentroId(form.clienteId, form.customIdPart);
            }
          }
          if (form.id !== targetId) {
            const oldId = form.id;
            setForm(prev => ({ ...prev, id: targetId }));
            if (oldId && oldId !== targetId) {
              setCentroSistemas(prev => prev.map(s => s.centroId === oldId ? { ...s, centroId: targetId } : s));
            }
          }
        } else {
          if (form.id !== originalCentro.id) {
            const oldId = form.id;
            setForm(prev => ({ ...prev, id: originalCentro.id }));
            if (oldId && oldId !== originalCentro.id) {
              setCentroSistemas(prev => prev.map(s => s.centroId === oldId ? { ...s, centroId: originalCentro.id } : s));
            }
          }
        }
      }
    }
  }, [form.clienteId, form.customIdPart, form._docId, form.id, centros]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isSaving) return;
    if (!form.clienteId) return alert('Debes seleccionar un cliente primero.');
    if (!form.customIdPart || !form.customIdPart.trim()) return alert('El código periodicidad es obligatorio.');
    if (!form.nombre.trim()) return alert('El nombre del centro es obligatorio.');

    const missingFields = [];

    // 1. Periodicidad
    if (!form.periodicidad || form.periodicidad.length === 0) {
      missingFields.push('Periodicidad (debes configurar al menos una frecuencia: Mensual, Trimestral o Anual).');
    }

    // 2. Contrato de Mantenimiento
    if (!form.numeroContrato || String(form.numeroContrato).trim() === '') {
      missingFields.push('Contrato de Mantenimiento (debes completar los datos del contrato).');
    }

    // 3. Asignar Técnico
    if (!form.tecnicoId || String(form.tecnicoId).trim() === '') {
      missingFields.push('Asignar Técnico (debes asignar un técnico al centro).');
    }

    // 4. Empresa Mantenedora
    if (!form.empresaId || String(form.empresaId).trim() === '') {
      missingFields.push('Empresa Mantenedora (debes asignar la empresa mantenedora).');
    }

    // 5. Editar Centro (datos generales obligatorios, válidos para nuevo y edición)
    const generalFields = [
      { key: 'telefono', label: 'Teléfono' },
      { key: 'correo', label: 'Correo Electrónico' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'poblacion', label: 'Población' },
      { key: 'cp', label: 'Código Postal (CP)' },
      { key: 'provincia', label: 'Provincia' },
      { key: 'contacto', label: 'Persona de Contacto' }
    ];
    const emptyGeneral = generalFields
      .filter(f => !(form as any)[f.key] || String((form as any)[f.key]).trim() === '')
      .map(f => f.label);
    
    if (emptyGeneral.length > 0) {
      missingFields.push('Datos del Centro (faltan rellenar los siguientes datos: ' + emptyGeneral.join(', ') + ').');
    }

    // 6. Ver Sistemas
    const docId = form._docId || form.id;
    const sistCount = centroSistemas.filter(s => s.centroId === docId || s.centroId === form.id).length;
    if (sistCount === 0) {
      missingFields.push('Ver Sistemas (debes añadir al menos 1 sistema instalado al centro).');
    }

    if (missingFields.length > 0) {
      setValidationErrors(missingFields);
      setShowValidationModal(true);
      return; // Detener guardado
    }

    setIsSaving(true);
    let finalId = form.id;
    if (!finalId) { 
      finalId = calculateNextCentroId(form.clienteId, form.customIdPart); 
    } else { 
      const parts = finalId.split('-'); 
      if (parts.length >= 3) { 
        finalId = parts[0] + '-' + parts[1] + '-(' + (form.customIdPart || 'XXXX') + ')'; 
      } 
    }
    const newCentro = { ...form, id: finalId, nombre: form.nombre.toUpperCase(), periodicidad: normalizeSelectedValues(form.periodicidad), mesesRevision: normalizeSelectedValues(form.mesesRevision) };
    try {
      if (form._docId) {
        await updateCentro(form._docId, newCentro);
        const updated = centros.map(c => c._docId === form._docId ? { ...newCentro, _docId: form._docId } : c);
        saveToDB(updated);
      } else {
        const created = await addCentro(newCentro);
        const withDoc = { ...newCentro, _docId: created._docId };
        const exists = centros.some(c => (c._docId && c._docId === created._docId) || c.id === withDoc.id);
        const updated = exists
          ? centros.map(c => (c._docId === created._docId || c.id === withDoc.id) ? withDoc : c)
          : [...centros, withDoc];
        saveToDB(updated);
      }
      setView('list');
      setForm(emptyCentro);
    } catch (err) {
      console.error('Error guardando centro en Firestore:', err);
      alert('Error al guardar en Firestore');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (centro: Centro) => { 
    setForm(centro); 
    const client = clientes.find(c => c.id === centro.clienteId);
    setClienteSearchTerm(client ? client.nombre : '');
    setView('form'); 
  };
  const handleEditEquipo = (eq: EquipoInstalado, sist: CentroSistema) => {
    setSistemaSeleccionado(sist);
    const cleanedEq = { ...eq };
    const isInvalidText = (v: any) => {
      if (v === undefined || v === null || v === '') return false;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === 'false' || s === 'sí' || s === 'no' || s === 'ok' || s === 'correcto' || s === 'incorrecto';
    };
    if (isInvalidText(cleanedEq.tipo)) {
      cleanedEq.tipo = !isInvalidText(cleanedEq.nombre) ? cleanedEq.nombre : (!isInvalidText(cleanedEq.clase) ? cleanedEq.clase : (!isInvalidText(cleanedEq.modelo) ? cleanedEq.modelo : (!isInvalidText(cleanedEq.pesoCapacidad) ? cleanedEq.pesoCapacidad : 'Equipo sin tipo')));
    }
    if (isInvalidText(cleanedEq.nombre)) {
      cleanedEq.nombre = cleanedEq.tipo || cleanedEq.clase || cleanedEq.modelo || cleanedEq.pesoCapacidad || 'Equipo sin tipo';
    }
    if (isInvalidText(cleanedEq.tipo)) {
      cleanedEq.tipo = cleanedEq.nombre;
    }
    setFormEquipo(cleanedEq);
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
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    if (view === 'form') {
      setForm(centroActualizado);
    } else {
      setIsDetailOpen(true);
    }
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
      precioMensualContrato: formContrato.precioMensual.trim(),
      formaPagoContrato: formContrato.formaPago
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
        precioMensualContrato: formContrato.precioMensual.trim(),
        formaPagoContrato: formContrato.formaPago
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
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    if (view === 'form') {
      setForm(centroActualizado);
    } else {
      setIsDetailOpen(true);
    }
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
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    if (view === 'form') {
      setForm(centroActualizado);
    } else {
      setIsDetailOpen(true);
    }
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
    if (Array.isArray(storedPartes)) {
      const updatedPartes = storedPartes.map((parte: Parte) => parte.centroId === centroForEmpresa.id ? { ...parte, empresaId: selectedEmpresaId } : parte);
      localStorage.setItem('firecheck_db_partes', JSON.stringify(updatedPartes));
      for (const p of updatedPartes.filter((parte: Parte) => parte.centroId === centroForEmpresa.id)) {
        const pDocId = (p as any)._docId || p.id;
        try { await updateParteFirestore(pDocId, { empresaId: selectedEmpresaId } as any); } catch (e) { console.error("Error syncing parte empresaId to Firestore:", e); }
      }
    }
    const storedAlbaranes = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
    if (Array.isArray(storedAlbaranes)) {
      const updatedAlbaranes = storedAlbaranes.map((alb: any) => alb.centroId === centroForEmpresa.id ? { ...alb, empresaId: selectedEmpresaId } : alb);
      localStorage.setItem('firecheck_db_albaranes', JSON.stringify(updatedAlbaranes));
    }
    const storedCertificados = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
    if (Array.isArray(storedCertificados)) {
      const updatedCertificados = storedCertificados.map((cert: any) => cert.centroId === centroForEmpresa.id ? { ...cert, empresaId: selectedEmpresaId } : cert);
      localStorage.setItem('firecheck_db_certificados', JSON.stringify(updatedCertificados));
    }
    setIsEmpresaModalOpen(false);
    setCentroForEmpresa(null);
    setSelectedEmpresaId('');
    const centroActualizado = updatedCentros.find(c => c.id === updatedCentro.id) || updatedCentro;
    setSelectedCentro(centroActualizado);
    if (view === 'form') {
      setForm(centroActualizado);
    } else {
      setIsDetailOpen(true);
    }
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
    const equiposDelSistema = equiposInstalados.filter(e => e.sistemaId === eq.sistemaId);
    let maxNum = 0;
    let padLength = 2;

    equiposDelSistema.forEach(e => {
      const codeStr = e.codigo || '';
      const matches = codeStr.match(/\d+/);
      if (matches) {
        const num = parseInt(matches[0], 10);
        if (!isNaN(num)) {
          if (num > maxNum) maxNum = num;
          if (matches[0].length > padLength) padLength = matches[0].length;
        }
      }
    });

    if (maxNum === 0) {
      maxNum = equiposDelSistema.length;
    }

    const siguienteNumero = (maxNum + 1).toString().padStart(padLength, '0');
    const oldCodigo = eq.codigo || '';

    const newEquipo = { ...eq, id: generateId(), codigo: siguienteNumero };

    if (oldCodigo) {
      Object.keys(newEquipo).forEach(key => {
        if (key !== 'id' && key !== 'centroId' && key !== 'sistemaId' && (newEquipo as any)[key] === oldCodigo) {
          (newEquipo as any)[key] = siguienteNumero;
        }
      });
    }

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
    setForm(prev => ({
      ...prev,
      nombre: selectedCliente.nombre,
      direccion: selectedCliente.direccion || prev.direccion,
      poblacion: selectedCliente.poblacion || prev.poblacion,
      cp: selectedCliente.cp || prev.cp,
      provincia: selectedCliente.provincia || prev.provincia,
      contacto: selectedCliente.contacto || prev.contacto,
      telefono: selectedCliente.telefono || prev.telefono,
      correo: selectedCliente.correo || prev.correo,
      correoGeneral: selectedCliente.correoGeneral || selectedCliente.correo || prev.correoGeneral,
      correoAdministracion: selectedCliente.correoAdministracion || prev.correoAdministracion,
      correoFacturacion: selectedCliente.correoFacturacion || prev.correoFacturacion,
      correoMantenimiento: selectedCliente.correoMantenimiento || prev.correoMantenimiento,
      correoCompras: selectedCliente.correoCompras || prev.correoCompras,
      correoPedidos: selectedCliente.correoPedidos || prev.correoPedidos,
      correoOtro: selectedCliente.correoOtro || prev.correoOtro,
      formaPago: selectedCliente.formaPago || prev.formaPago,
      vencimiento: selectedCliente.vencimiento || prev.vencimiento,
      iban: selectedCliente.iban || prev.iban,
      notas: selectedCliente.notas || prev.notas,
    }));
  };

  const handleCopyDatosBancariosFromCliente = () => {
    if (!selectedCliente) return alert('Selecciona un cliente primero.');
    if (!selectedCliente.formaPago && !selectedCliente.vencimiento && !selectedCliente.iban && !selectedCliente.notas) {
      alert('El cliente seleccionado no tiene datos bancarios o notas registrados.');
      return;
    }
    setForm(prev => ({
      ...prev,
      formaPago: selectedCliente.formaPago || prev.formaPago,
      vencimiento: selectedCliente.vencimiento || prev.vencimiento,
      iban: selectedCliente.iban || prev.iban,
      notas: selectedCliente.notas || prev.notas,
    }));
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
const renderModals = () => {
  return (
    <>
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

                {/* Forma de Pago */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700">Forma de Pago del Contrato</label>
                  <div className="flex flex-wrap gap-4 p-3.5 border border-zinc-200 rounded-xl bg-zinc-50/30">
                    {['Transferencia bancaria', 'Efectivo', 'Domiciliación bancaria'].map((forma) => {
                      const isChecked = formContrato.formaPago === forma;
                      return (
                        <label key={forma} className={`flex items-center gap-2 group ${isTecnicoMode ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                          <input
                            disabled={isTecnicoMode}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormContrato({ 
                                ...formContrato, 
                                formaPago: isChecked ? '' : forma 
                              });
                            }}
                            className={`w-4 h-4 text-black rounded border-zinc-300 focus:ring-black ${isTecnicoMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          />
                          <span className={`text-sm font-medium text-zinc-700 ${!isTecnicoMode && 'group-hover:text-black'} transition-colors`}>
                            {forma}
                          </span>
                        </label>
                      );
                    })}
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
                        precioMensualContrato: formContrato.precioMensual.trim(),
                        formaPagoContrato: formContrato.formaPago
                      };

                      const empresaCentro = tempCentro.empresaId ? empresas.find(e => e._docId === tempCentro.empresaId || (e as any).id === tempCentro.empresaId || ((e as any).nombre && typeof (e as any).nombre === 'string' && (e as any).nombre.trim().toLowerCase() === tempCentro.empresaId?.trim().toLowerCase())) : undefined;
                      await generarContratoPDF(client, tempCentro, systems, {
                        numeroContrato: formContrato.numeroContrato.trim(),
                        fechaInicio: formContrato.fechaInicio,
                        fechaFin: formContrato.fechaFin,
                        importeAnual: String(total),
                        observaciones: formContrato.sistemasContrato.join(', '),
                        formaPago: formContrato.formaPago
                      }, empresaCentro);
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
    </>
  );
};

  if (view === 'list') {
    return (
      <div className={hideHeader ? '' : 'px-4 md:px-8 py-6'}>
        {!hideHeader ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
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
              <button onClick={() => { if (clientes.length === 0) return alert('Debes crear al menos un Cliente antes de crear un Centro.'); setForm(emptyCentro); setClienteSearchTerm(''); setView('form'); }} className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10"><Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nuevo Centro</span><span className="sm:hidden">Nuevo</span></button>
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
            <button onClick={() => { if (clientes.length === 0) return alert('Debes ir a la sección Clientes y crear uno primero.'); setForm(emptyCentro); setClienteSearchTerm(''); setView('form'); }} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md"><Plus className="w-5 h-5" /> Crear el primer centro</button>
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

        <DetailModal isOpen={isDetailOpen} onClose={handleTryCloseDetail} title="Detalle del Centro" size="lg">
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
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="w-full">
                          <p className="text-xs text-zinc-400 font-medium mb-1">Cuentas de Correo</p>
                          <div className="space-y-1 text-xs">
                            <p><span className="font-bold text-zinc-500">General:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoGeneral || selectedCentro.correo || 'No especificado'}</span></p>
                            {selectedCentro.correoAdministracion && <p><span className="font-bold text-zinc-500">Administración:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoAdministracion}</span></p>}
                            {selectedCentro.correoFacturacion && <p><span className="font-bold text-zinc-500">Facturación:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoFacturacion}</span></p>}
                            {selectedCentro.correoMantenimiento && <p><span className="font-bold text-zinc-500">Mantenimiento:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoMantenimiento}</span></p>}
                            {selectedCentro.correoCompras && <p><span className="font-bold text-zinc-500">Compras:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoCompras}</span></p>}
                            {selectedCentro.correoPedidos && <p><span className="font-bold text-zinc-500">Pedidos:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoPedidos}</span></p>}
                            {selectedCentro.correoOtro && <p><span className="font-bold text-zinc-500">Otro:</span> <span className="font-semibold text-zinc-900">{selectedCentro.correoOtro}</span></p>}
                          </div>
                        </div>
                      </div>
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
                {(selectedCentro.formaPago || selectedCentro.vencimiento || selectedCentro.iban) && (
                  <div className="pt-4 border-t border-zinc-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> Datos Bancarios
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedCentro.formaPago && (
                        <div className="bg-zinc-50 rounded-xl p-3.5">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Forma de Pago</p>
                          <p className="text-sm font-semibold text-zinc-900 mt-1">{selectedCentro.formaPago}</p>
                        </div>
                      )}
                      {selectedCentro.vencimiento && (
                        <div className="bg-zinc-50 rounded-xl p-3.5">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Vencimiento</p>
                          <p className="text-sm font-semibold text-zinc-900 mt-1">{selectedCentro.vencimiento}</p>
                        </div>
                      )}
                      {selectedCentro.iban && (
                        <div className="bg-zinc-50 rounded-xl p-3.5">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">IBAN</p>
                          <p className="text-sm font-semibold text-zinc-900 mt-1 font-mono">{selectedCentro.iban}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedCentro.notas && (
                  <div className="pt-4 border-t border-zinc-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Notas del Centro / Observaciones
                    </h4>
                    <p className="text-sm font-semibold text-amber-950 bg-amber-100/90 border-2 border-amber-300 rounded-xl p-3.5 whitespace-pre-wrap shadow-sm">{selectedCentro.notas}</p>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-zinc-200">
                  {!isTecnicoMode && (
                    <button onClick={() => { setIsDetailOpen(false); handleEdit(selectedCentro); }} className="w-full bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-md shadow-black/10 active:scale-95"><Edit className="w-4 h-4" /> Editar Centro de Trabajo</button>
                  )}
                </div>
              </div>
            );
          })()}
        </DetailModal>

        {renderModals()}

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
          <button 
            onClick={() => {
              if (sistemasSourceView === 'form') {
                setView('form');
              } else {
                setView('list');
              }
            }} 
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>
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
                            (() => {
                              const sistLower = (sist.tipo || sist.familia || '').toLowerCase();
                              const esAreaCobertura = sistLower.includes('detecci') || sistLower.includes('rociador') || sistLower.includes('sprinkler') || (sistLower.includes('puesto') && sistLower.includes('control'));
                              return (
                                <div className="space-y-1.5">
                                  <div className="hidden md:flex items-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                    <div className="w-16 shrink-0">Orden</div>
                                    <div className="flex-1 min-w-0">Tipo</div>
                                    <div className="w-36 shrink-0">{esAreaCobertura ? 'Área de cobertura' : 'Ubicación'}</div>
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
                                          <span className="text-sm font-semibold text-zinc-800">{getNombreEquipoDisplay(eq)}</span>
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
                              );
                            })()
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shrink-0"><MapPin className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{form.id ? 'Editar Centro de Trabajo' : 'Añadir Nuevo Centro'}</h1>
            <p className="text-zinc-500 mt-0.5 text-sm">Selecciona a qué cliente pertenece este centro y rellena sus datos.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <form className="space-y-6" onSubmit={handleSave}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: General Info */}
              <div className="space-y-4">
                {/* 1. Vinculación y Código */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3">
                  <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">1. Vinculación y Código</h2>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Seleccionar Cliente *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-zinc-400" /></div>
                        <input
                          type="text"
                          value={clienteSearchTerm}
                          onChange={e => setClienteSearchTerm(e.target.value)}
                          onFocus={() => setShowClienteDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowClienteDropdown(false);
                              const client = clientes.find(c => c.id === form.clienteId);
                              setClienteSearchTerm(client ? client.nombre : '');
                            }, 200);
                          }}
                          placeholder="Buscar cliente..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                        />
                        {showClienteDropdown && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {clientesFiltrados.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-zinc-400">No se encontraron clientes</div>
                            ) : (
                              clientesFiltrados.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => { setForm({...form, clienteId: c.id}); setClienteSearchTerm(c.nombre); setShowClienteDropdown(false); }}
                                  className={'w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 transition-colors ' + (form.clienteId === c.id ? 'bg-zinc-100 font-semibold' : '')}
                                >
                                  {c.nombre}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                  </div>

                  {selectedCliente && (
                    <div className="flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2.5">
                      <div className="flex-1"><p className="text-[10px] text-zinc-400 font-semibold mb-0.5">DATOS DEL CLIENTE</p><p className="text-sm font-medium text-zinc-900">{selectedCliente.nombre} <span className="text-zinc-400 font-mono ml-1 text-xs">{selectedCliente.cif}</span></p></div>
                      <button type="button" onClick={handleCopyFromCliente} className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-xl transition-colors" title="Copiar datos del cliente al centro"><Copy className="w-4 h-4" /></button>
                    </div>
                  )}

                  {selectedCliente && (
                    <div className="bg-zinc-900 text-white p-4 rounded-xl flex items-center justify-between shadow-sm">
                      <div><p className="text-[10px] text-zinc-400 font-bold mb-0.5">CÓDIGO DE CENTRO</p><p className="text-lg font-mono font-bold tracking-wider">{idPreview || 'CEN XXXX-XX-(XXXX)'}</p></div>
                      <div className="text-right w-1/3"><label className="block text-[9px] text-zinc-400 font-bold mb-0.5">Cód. Periodicidad *</label><input required type="text" value={form.customIdPart} onChange={e => setForm({...form, customIdPart: e.target.value.toUpperCase()})} className="w-full px-2 py-1.5 bg-white/10 rounded-md border border-white/20 focus:bg-white/20 outline-none transition-all text-white font-mono text-xs text-right placeholder-white/30 uppercase" placeholder="Ej: A001" maxLength={10} /></div>
                    </div>
                  )}
                </div>

                {/* 2. Datos del Centro */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3">
                  <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">2. Datos del Centro</h2>
                  
                  <div><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Nombre del Centro *</label><input required type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-semibold" placeholder="Ej. Nave Principal, Sede Norte..." /></div>
                  <div><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Dirección</label><input type="text" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" placeholder="Calle, Polígono, número..." /></div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2"><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Población</label><input type="text" value={form.poblacion} onChange={e => setForm({...form, poblacion: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" /></div>
                    <div><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">CP</label><input type="text" value={form.cp} onChange={e => setForm({...form, cp: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Provincia</label><input type="text" value={form.provincia} onChange={e => setForm({...form, provincia: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" /></div>
                    <div><label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Contacto</label><input type="text" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" /></div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Teléfono</label>
                    <input type="tel" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium" />
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-zinc-200 space-y-2 mt-2">
                    <label className="block text-[10px] font-bold text-zinc-600 uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3 text-red-600" /> Cuentas de Correo
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">General</label>
                        <input type="email" value={form.correoGeneral || form.correo || ''} onChange={e => setForm({...form, correo: e.target.value, correoGeneral: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="general@centro.com" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Administración</label>
                        <input type="email" value={form.correoAdministracion || ''} onChange={e => setForm({...form, correoAdministracion: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="administracion@centro.com" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Facturación</label>
                        <input type="email" value={form.correoFacturacion || ''} onChange={e => setForm({...form, correoFacturacion: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="facturacion@centro.com" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Mantenimiento</label>
                        <input type="email" value={form.correoMantenimiento || ''} onChange={e => setForm({...form, correoMantenimiento: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="mantenimiento@centro.com" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Compras</label>
                        <input type="email" value={form.correoCompras || ''} onChange={e => setForm({...form, correoCompras: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="compras@centro.com" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Pedidos</label>
                        <input type="email" value={form.correoPedidos || ''} onChange={e => setForm({...form, correoPedidos: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="pedidos@centro.com" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase">Otro</label>
                        <input type="email" value={form.correoOtro || ''} onChange={e => setForm({...form, correoOtro: e.target.value})} className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-zinc-200 focus:border-black outline-none text-zinc-900" placeholder="otro@centro.com" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Datos Bancarios y Notas */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-red-600" /> 3. Datos Bancarios y Notas
                    </h2>
                    {selectedCliente && (
                      <button
                        type="button"
                        onClick={handleCopyDatosBancariosFromCliente}
                        className="text-[10px] font-bold text-zinc-600 hover:text-black bg-white border border-zinc-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Copiar datos bancarios y notas del cliente a este centro"
                      >
                        <Copy className="w-3 h-3 text-zinc-500" /> Copiar del Cliente
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Forma de Pago</label>
                      <input
                        type="text"
                        value={form.formaPago || ''}
                        onChange={e => setForm({...form, formaPago: e.target.value})}
                        placeholder="Ej. Transferencia 30 días"
                        className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Vencimiento</label>
                      <input
                        type="text"
                        value={form.vencimiento || ''}
                        onChange={e => setForm({...form, vencimiento: e.target.value})}
                        placeholder="Ej. Día 5 de cada mes"
                        className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">IBAN</label>
                    <input
                      type="text"
                      value={form.iban || ''}
                      onChange={e => setForm({...form, iban: e.target.value.toUpperCase()})}
                      placeholder="ES00 0000 0000 0000 0000 0000"
                      className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Notas del Centro / Observaciones
                    </label>
                    <textarea
                      rows={2}
                      value={form.notas || ''}
                      onChange={e => setForm({...form, notas: e.target.value})}
                      placeholder="Notas o resaltados importantes de este centro o cliente..."
                      className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all resize-none ${
                        form.notas && form.notas.trim() !== ''
                          ? 'bg-amber-100/90 border-2 border-amber-400 text-amber-950 font-bold placeholder-amber-700/60 shadow-xs focus:bg-amber-100 focus:border-amber-500'
                          : 'bg-amber-50/60 border-amber-200 text-zinc-900 placeholder-amber-700/40 font-medium focus:bg-amber-100/70 focus:border-amber-400'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Configuration & Assignments */}
              <div className="space-y-4">
                {form.id ? (
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 h-full flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">4. Configuración y Asignaciones</h2>
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Pulsa para configurar</span>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Periodicidad */}
                        <button
                          type="button"
                          onClick={() => {
                            setCentroForPeriodicidad(form);
                            setFormPeriodicidad({ periodicidad: form.periodicidad || [], mesesRevision: form.mesesRevision || [] });
                            setIsPeriodicidadModalOpen(true);
                          }}
                          className="bg-white border-2 border-zinc-200 hover:border-blue-400 rounded-2xl p-4 flex items-center justify-between transition-all group w-full text-left outline-none"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Periodicidad</span>
                            <span className={'text-xs font-bold mt-1 ' + (form.periodicidad && form.periodicidad.length > 0 ? 'text-green-600' : 'text-red-500')}>
                              {form.periodicidad && form.periodicidad.length > 0 ? form.periodicidad.join(', ') : 'Sin configurar'}
                            </span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-350 group-hover:text-blue-500 transition-colors shrink-0" />
                        </button>

                        {/* Contrato */}
                        <button
                          type="button"
                          onClick={() => {
                            setCentroForContrato(form);
                            setFormContrato({
                              numeroContrato: form.numeroContrato || form.id || '',
                              fechaInicio: form.fechaInicioContrato || '',
                              fechaFin: form.fechaFinContrato || '',
                              observaciones: form.observacionesContrato || '',
                              periodicidad: form.periodicidad || [],
                              sistemasContrato: form.sistemasContrato || (form.observacionesContrato ? form.observacionesContrato.split(', ').filter(Boolean) : []),
                              precioAnual: form.precioAnualContrato || '',
                              precioTrimestral: form.precioTrimestralContrato || '',
                              precioMensual: form.precioMensualContrato || '',
                              formaPago: (form as any).formaPagoContrato || 'Transferencia bancaria'
                            });
                            setIsContratoModalOpen(true);
                          }}
                          className="bg-white border-2 border-zinc-200 hover:border-blue-400 rounded-2xl p-4 flex items-center justify-between transition-all group w-full text-left outline-none"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Contrato</span>
                            <span className={'text-xs font-bold mt-1 ' + (form.numeroContrato ? 'text-green-600' : 'text-red-500')}>
                              {form.numeroContrato ? 'Nº ' + form.numeroContrato : 'Sin configurar'}
                            </span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-350 group-hover:text-blue-500 transition-colors shrink-0" />
                        </button>

                        {/* Técnico */}
                        <button
                          type="button"
                          onClick={() => {
                            setCentroForTecnico(form);
                            setSelectedTecnicoId(form.tecnicoId || '');
                            setIsTecnicoModalOpen(true);
                          }}
                          className="bg-white border-2 border-zinc-200 hover:border-blue-400 rounded-2xl p-4 flex items-center justify-between transition-all group w-full text-left outline-none"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Técnico Asignado</span>
                            <span className={'text-xs font-bold mt-1 ' + (form.tecnicoId ? 'text-green-600' : 'text-red-500')}>
                              {tecnicos.find(t => t.id === form.tecnicoId || t._docId === form.tecnicoId)?.nombre || 'Sin asignar'}
                            </span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-350 group-hover:text-blue-500 transition-colors shrink-0" />
                        </button>

                        {/* Empresa */}
                        <button
                          type="button"
                          onClick={() => {
                            setCentroForEmpresa(form);
                            setSelectedEmpresaId(form.empresaId || '');
                            setIsEmpresaModalOpen(true);
                          }}
                          className="bg-white border-2 border-zinc-200 hover:border-blue-400 rounded-2xl p-4 flex items-center justify-between transition-all group w-full text-left outline-none"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Empresa Mantenedora</span>
                            <span className={'text-xs font-bold mt-1 ' + (form.empresaId ? 'text-green-600' : 'text-red-500')}>
                              {empresas.find(e => e._docId === form.empresaId)?.nombre || 'Sin asignar'}
                            </span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-350 group-hover:text-blue-500 transition-colors shrink-0" />
                        </button>

                        {/* Sistemas */}
                        <button
                          type="button"
                          onClick={() => {
                            setSistemasSourceView('form');
                            openSistemas(form);
                          }}
                          className="bg-white border-2 border-zinc-200 hover:border-blue-400 rounded-2xl p-4 flex items-center justify-between transition-all group w-full text-left outline-none"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sistemas Instalados</span>
                            {(() => {
                              const count = centroSistemas.filter(s => s.centroId === form._docId || s.centroId === form.id).length;
                              return (
                                <span className={'text-xs font-bold mt-1 ' + (count > 0 ? 'text-green-600' : 'text-red-500')}>
                                  {count > 0 ? count + ' sistema(s) instalado(s)' : 'Sin configurar'}
                                </span>
                              );
                            })()}
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-350 group-hover:text-blue-500 transition-colors shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 h-full flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500"><Building2 className="w-6 h-6" /></div>
                    <h3 className="text-sm font-bold text-zinc-700">Configuración requerida</h3>
                    <p className="text-xs text-zinc-500 max-w-xs">Selecciona un cliente e introduce el código de periodicidad en la sección 1 para poder configurar los sistemas, contrato, técnico y empresa.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3 shrink-0 bg-white">
              <button type="submit" disabled={isSaving || !form.clienteId} className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-black/10 active:scale-95"><Save className="w-4 h-4" /> {isSaving ? 'Guardando...' : (form._docId ? 'Guardar Cambios' : 'Registrar Centro')}</button>
            </div>
          </form>
        </div>
      </div>
      {showValidationModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-red-50">
              <h3 className="text-base font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" /> Información del Centro Incompleta
              </h3>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-zinc-700">
                Para poder guardar este centro de trabajo, es obligatorio rellenar toda la información requerida. Por favor, completa los siguientes apartados faltantes:
              </p>
              <ul className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0 animate-ping"></span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors shadow-md shadow-zinc-900/10"
              >
                Entendido, completar datos
              </button>
            </div>
          </div>
        </div>
      )}
      {renderModals()}
    </div>
  );
}
