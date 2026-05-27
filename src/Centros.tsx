import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Search, Edit, Trash2, MapPin, Layers, X, Copy, AlertTriangle, GripHorizontal, Upload, Download, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { CATEGORIAS_POR_DEFECTO, getIconForSistema } from './Sistemas';
import { addCentro, updateCentro, deleteCentro, subscribeCentros, subscribeEquiposBySystem, getCollectionName } from './firebase';
import ConfirmationModal from './ConfirmationModal'; // Import the new modal component

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Necesitamos la interfaz del Cliente para mostrar su info
export interface Cliente {
  id: string; // ej: CLI0001
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

// Interfaz del Centro
export interface Centro {
  id: string; // ej: CEN0001-01-(XXXX)
  clienteId: string; // ej: CLI0001
  customIdPart: string; // El XXXX editable
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
}

export interface Parte {
  id: string;
  centroId: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado';
  numeroMantenimiento?: string;
  fechaProgramada?: string;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
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
  revisado?: boolean; // Indica si el equipo ya ha sido revisado
  
  // Datos específicos y Checklist Extintores (Opcional)
  placa?: string;
  clase?: string;
  fabricante?: string;
  fechaFabricacion?: string;
  ultimoRetimbre?: string;
  pesoCapacidad?: string;
  anomalias?: string;
  longitud?: string;
  pruebaHidraulica?: string;

  checkAcceso?: boolean;
  checkAltura?: boolean;
  checkSoporte?: boolean;
  checkSenalizacion?: boolean;
  checkManguera?: boolean;
  checkPeso?: boolean;
  checkManometro?: boolean;
  checkMarcado?: boolean;
  checkEtiquetas?: boolean;
  checkRetimbre?: boolean;
  checkRiesgo?: boolean;
  checkDistancia?: boolean;
  checkPasador?: boolean;
  checkMovilidad?: boolean;
}

const emptyCentro: Centro = {
  id: '', clienteId: '', customIdPart: '', nombre: '', direccion: '',
  poblacion: '', cp: '', provincia: '', telefono: '', contacto: '', correo: '',
  periodicidad: [],
  mesesRevision: []
};

function SortableSistemaWrapper({ sist, children }: { sist: any, children: (attrs: any, listeners: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sist.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`h-full ${isDragging ? 'opacity-50' : ''}`}>
      {children(attributes, listeners)}
    </div>
  );
}

export default function Centros() {
  const navigate = useNavigate();
  const location = useLocation();
  const [centros, setCentros] = useState<Centro[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_centros');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [clientes, _setClientes] = useState<Cliente[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_clientes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [centroSistemas, setCentroSistemas] = useState<CentroSistema[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_centro_sistemas');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [categoriasSistema, _setCategoriasSistema] = useState<{id: string, nombre: string}[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_sistemas_categorias');
      return saved ? JSON.parse(saved) : CATEGORIAS_POR_DEFECTO;
    } catch { return CATEGORIAS_POR_DEFECTO; }
  });
  const [view, setView] = useState<'list' | 'form' | 'sistemas' | 'equipos'>('list');
  const [form, setForm] = useState<Centro>(emptyCentro);
  const [centroSeleccionado, setCentroSeleccionado] = useState<Centro | null>(null);
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState<CentroSistema | null>(null);
  const [isClaseOtro, setIsClaseOtro] = useState(false);

  const [isPeriodicidadModalOpen, setIsPeriodicidadModalOpen] = useState(false);
  const [centroForPeriodicidad, setCentroForNewPeriodicidad] = useState<Centro | null>(null);
  const [formPeriodicidad, setFormPeriodicidad] = useState<{ periodicidad: string[], mesesRevision: string[] }>({ periodicidad: [], mesesRevision: [] });

  const [formSistema, setFormSistema] = useState<CentroSistema>({ id: '', centroId: '', tipo: '', familia: '', descripcion: '' });
  const [isSistemaModalOpen, setIsSistemaModalOpen] = useState(false);

  const [equiposInstalados, setEquiposInstalados] = useState<EquipoInstalado[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_equipos_instalados');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [equiposCatalogo, _setEquiposCatalogo] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_sistemas_equipos');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [formEquipo, setFormEquipo] = useState<EquipoInstalado>({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' });
  const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
  
  // Variables para la selección de sistema desde el catálogo
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [selectedCatIdForCentro, setSelectedCatIdForCentro] = useState('');
  const [centroForNewSistema, setCentroForNewSistema] = useState<Centro | null>(null);

  // Variables para la selección de equipo desde el catálogo
  const [selectedEquipoCatalogo, setSelectedEquipoCatalogo] = useState('');
  const [cantidadAñadir, setCantidadAñadir] = useState(1);
  
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'centro' | 'sistema' | 'equipo', id: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState(location.state?.search || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    const dataToExport = centros.map(c => {
      const cli = clientes.find(cl => cl.id === c.clienteId);
      return {
        'ID Centro': c.id,
        'Cliente': cli ? cli.nombre : 'Desconocido',
        'Código Centro': c.customIdPart || '',
        'Nombre Centro': c.nombre,
        'Dirección': c.direccion,
        'Población': c.poblacion,
        'C.P.': c.cp,
        'Provincia': c.provincia,
        'Teléfono': c.telefono,
        'Contacto': c.contacto,
        'Correo': c.correo
      };
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
            
            // Si el Excel tiene el ID (actualización)
            const idExistente = row['ID Centro'];
            const idx = newCentros.findIndex(c => c.id === idExistente);

            if (idx >= 0) {
              newCentros[idx] = {
                ...newCentros[idx],
                clienteId: cliMatch ? cliMatch.id : newCentros[idx].clienteId,
                customIdPart: row['Código Centro'] || newCentros[idx].customIdPart || '',
                nombre: String(row['Nombre Centro']).toUpperCase(),
                direccion: row['Dirección'] || '',
                poblacion: row['Población'] || '',
                cp: row['C.P.'] || '',
                provincia: row['Provincia'] || '',
                telefono: row['Teléfono'] || '',
                contacto: row['Contacto'] || '',
                correo: row['Correo'] || ''
              };
            } else {
              const cliIdForNew = cliMatch ? cliMatch.id : '';
              let clientNum = cliIdForNew ? cliIdForNew.replace('CLI ', '').replace('CLI', '') : '0000';
              clientNum = clientNum.padStart(4, '0');
              const centrosDelCliente = newCentros.filter(c => c.clienteId === cliIdForNew);
              const centerNum = String(centrosDelCliente.length + 1).padStart(2, '0');
              const newId = `CEN ${clientNum}-${centerNum}-(XXXX)`;

              newCentros.push({
                id: newId,
                clienteId: cliMatch ? cliMatch.id : '',
                customIdPart: row['Código Centro'] || '',
                nombre: String(row['Nombre Centro']).toUpperCase(),
                direccion: row['Dirección'] || '',
                poblacion: row['Población'] || '',
                cp: row['C.P.'] || '',
                provincia: row['Provincia'] || '',
                telefono: row['Teléfono'] || '',
                contacto: row['Contacto'] || '',
                correo: row['Correo'] || ''
              });
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

  // Cargar bases de datos y limpiar huérfanos/UUIDs antiguos
  useEffect(() => {
    try {
      let hasChanges = false;
      const currentClientes = clientes;
      let currentSistemas = centroSistemas;
      let currentEquipos = equiposInstalados;

      const validCentros = centros.filter(c => {
        const clienteExiste = c && c.clienteId && currentClientes.some(cli => cli.id === c.clienteId);
        const tieneIdRaro = c && typeof c.id === 'string' && c.id.length > 25;

        if (!c || !c.id || !clienteExiste || tieneIdRaro) {
          hasChanges = true;
          return false; // Lo borramos
        }
        return true;
      });

      const finalCentros = validCentros.map(c => {
        if (typeof c.id === 'string' && c.id.startsWith('CEN') && !c.id.startsWith('CEN ')) {
          const oldId = c.id;
          const parts = c.id.replace('CEN', '').split('-');
          if (parts.length >= 3) {
            const newId = `CEN ${parts[0]}-${parts[1]}-${parts[2]}`;
            hasChanges = true;
            currentSistemas = currentSistemas.map((s: any) => s.centroId === oldId ? { ...s, centroId: newId } : s);
            currentEquipos = currentEquipos.map((e: any) => e.centroId === oldId ? { ...e, centroId: newId } : e);
            return { ...c, id: newId };
          }
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
    } catch (_e) { }
  }, [clientes, centros, centroSistemas, equiposInstalados]);

  // Revisar si venimos de otra página y queremos abrir un centro directamente
  useEffect(() => {
    if (centros.length > 0 && location.state?.action === 'abrir-centro' && location.state?.centroId) {
      const targetCentro = centros.find(c => c.id === location.state.centroId);
      if (targetCentro) {
        setCentroSeleccionado(targetCentro);
        setView('sistemas');
        // Limpiamos el state para no reabrir en re-renders accidentales
        navigate(location.pathname, { replace: true });
      }
    }
  }, [centros, location.state, navigate, location.pathname]);

  const saveToDB = (data: Centro[]) => {
    localStorage.setItem('firecheck_db_centros', JSON.stringify(data));
    setCentros(data);
  };

  // Sincronización en tiempo real desde Firestore
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = subscribeCentros((items: any[]) => {
        // Mapeamos documentos tal cual vienen (contienen id: docId + fields)
        const mapped = items.map((d: any) => ({ ...d }));
        setCentros(mapped);
        localStorage.setItem('firecheck_db_centros', JSON.stringify(mapped));
      });
    } catch (e) {
      console.error('subscribeCentros failed', e);
    }
    return () => { if (unsub) unsub(); };
  }, []);

  // Escuchar cambios en equipos del catálogo (localStorage + storage events entre pestañas)
  useEffect(() => {
    const loadEquiposCatalogo = () => {
      try {
        const saved = localStorage.getItem('firecheck_db_sistemas_equipos');
        let parsed = saved ? JSON.parse(saved) : [];
        if (parsed.length === 0 && categoriasSistema.length > 0) {
          const allEquipos = [];
          categoriasSistema.forEach(cat => {
            const catNombre = (cat.nombre || '').replace(/^sistema\s+/i, '').toLowerCase().replace(/\s+/g, '_');
            const key = 'firecheck_db_sistemas_equipos_' + (catNombre || 'unknown');
            const catEquipos = localStorage.getItem(key);
            if (catEquipos) { try { allEquipos.push(...JSON.parse(catEquipos)); } catch {} }
          });
          parsed = allEquipos;
        }
        _setEquiposCatalogo(parsed);
      } catch { }
    };
    loadEquiposCatalogo();
    const handleStorage = () => loadEquiposCatalogo();
    const handleCustom = () => loadEquiposCatalogo();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('equiposCatalogoChanged', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('equiposCatalogoChanged', handleCustom);
    };
  }, [categoriasSistema]);

  // Escuchar equipos desde Firestore para todas las categorías (cuando cambian)
  useEffect(() => {
    if (categoriasSistema.length === 0) return;
    
    const unsubs: (() => void)[] = [];
    categoriasSistema.forEach(cat => {
      const unsub = subscribeEquiposBySystem(cat.nombre, (newEqs) => {
        // Guardar en clave individual del sistema
        const catNombre = (cat.nombre || '').replace(/^sistema\s+/i, '').toLowerCase().replace(/\s+/g, '_');
        localStorage.setItem('firecheck_db_sistemas_equipos_' + catNombre, JSON.stringify(newEqs));
        
        // Reconstruir y guardar el índice maestro
        const allEquipos: any[] = [];
        categoriasSistema.forEach(c => {
          const key = 'firecheck_db_sistemas_equipos_' + (c.nombre || '').replace(/^sistema\s+/i, '').toLowerCase().replace(/\s+/g, '_');
          const saved = localStorage.getItem(key);
          if (saved) { try { allEquipos.push(...JSON.parse(saved)); } catch {} }
        });
        localStorage.setItem('firecheck_db_sistemas_equipos', JSON.stringify(allEquipos));
        _setEquiposCatalogo(allEquipos);
      });
      unsubs.push(unsub);
    });
    
    return () => unsubs.forEach(u => u());
  }, [categoriasSistema]);

  // ----- LOGICA DE IDs ----- //
  const calculateNextCentroId = (cliId: string, customPart: string) => {
    if (!cliId) return '';
    // Extraer numero del cliente (CLI 0001 -> 0001)
    let clientNum = cliId.replace('CLI ', '').replace('CLI', '');
    // Asegurarnos de que tiene 4 dígitos (0001)
    clientNum = clientNum.padStart(4, '0');
    
    // Contar cuantos centros tiene este cliente
    const centrosDelCliente = centros.filter(c => c.clienteId === cliId);
    const centerNum = String(centrosDelCliente.length + 1).padStart(2, '0');
    
    // Construir ID final: CEN 0001-01-(XXXX)
    return `CEN ${clientNum}-${centerNum}-(${customPart || 'XXXX'})`;
  };

  // ----- ACCIONES ----- //
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId) return alert('Debes seleccionar un cliente primero.');
    if (!form.customIdPart || !form.customIdPart.trim()) return alert('El código periodicidad es obligatorio.');
    if (!form.nombre.trim()) return alert('El nombre del centro es obligatorio.');
    let finalId = form.id;
    if (!finalId) {
      finalId = calculateNextCentroId(form.clienteId, form.customIdPart);
    } else {
      // Si estamos editando y cambiamos la customIdPart, reconstruimos el ID manteniendo el resto igual
      const parts = finalId.split('-'); // ["CEN 0001", "01", "(XXXX)"]
      if (parts.length >= 3) {
        finalId = `${parts[0]}-${parts[1]}-(${form.customIdPart || 'XXXX'})`;
      }
    }

    const newCentro: any = { ...form, id: finalId, nombre: form.nombre.toUpperCase() };
    
    try {
      if ((form as any)._docId) {
        console.info('handleSave: updating existing centro, _docId=', (form as any)._docId, 'data=', newCentro);
        // Actualizar en Firestore si ya tiene _docId
        await updateCentro((form as any)._docId, newCentro);
        const updated = centros.map(c => c.id === form.id ? { ...newCentro, _docId: (form as any)._docId } : c);
        saveToDB(updated);
      } else {
        console.info('handleSave: adding new centro to Firestore, data=', newCentro);
        // Añadir nuevo en Firestore
        const created = await addCentro(newCentro);
        console.info('handleSave: addCentro returned', created);
        const withDoc = { ...newCentro, _docId: created.id };
        const updated = form.id ? centros.map(c => c.id === form.id ? withDoc : c) : [...centros, withDoc];
        saveToDB(updated);
      }
    } catch (err) {
      console.error('Error guardando centro en Firestore:', err);
      alert('Error al guardar en Firestore');
      return;
    }

    setView('list');
    setForm(emptyCentro);
  };

  const handleEdit = (centro: Centro) => {
    setForm(centro);
    setView('form');
  };
  const handleEditEquipo = (eq: EquipoInstalado, sist: CentroSistema) => {
    setSistemaSeleccionado(sist);
    setFormEquipo(eq);

    const opcionesClase = ['POLVO', 'CO2', 'ESPUMA', 'GAS', 'AGUA', 'ADITIVO'];
    setIsClaseOtro(eq.clase ? !opcionesClase.includes(eq.clase.toUpperCase()) : false);
    setIsEquipoModalOpen(true);
  };

  const handleSavePeriodicidad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForPeriodicidad) return;

    const updatedCentros = centros.map(c =>
      c.id === centroForPeriodicidad.id
        ? { ...c, ...formPeriodicidad }
        : c
    );

    saveToDB(updatedCentros);
    setIsPeriodicidadModalOpen(false);
    setCentroForNewPeriodicidad(null);
  };

  const handleDelete = async (id: string) => {
    setItemToDelete({ type: 'centro', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteCentro = async () => {
    if (!itemToDelete || itemToDelete.type !== 'centro') return;
    setIsConfirmModalOpen(false);
    const target = centros.find(c => c.id === itemToDelete.id) as any;
    try {
      if (target && target._docId) {
        await deleteCentro(target._docId);
      }
    } catch (err) {
      console.error('Error borrando centro en Firestore:', err);
      alert('Error al borrar en Firestore');
    }
    const remaining = centros.filter(c => c.id !== itemToDelete.id);
    saveToDB(remaining);
    const dbSist = centroSistemas.filter(s => s.centroId !== itemToDelete.id);
    setCentroSistemas(dbSist);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(dbSist));
    setItemToDelete(null);
  };

  const openSistemas = (c: Centro) => {
    setCentroSeleccionado(c);
    setView('sistemas');
  };

  // ----- FUNCIONES SISTEMAS DEL CENTRO -----
  const handleSaveSistema = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroSeleccionado) return;
    
    // Si formSistema.familia está vacío, lo cogemos de la categoría seleccionada
    let familiaReal = formSistema.familia;
    if (!familiaReal && formSistema.tipo) {
      const cat = categoriasSistema.find(c => c.nombre === formSistema.tipo);
      if (cat) familiaReal = cat.nombre;
    }
    
    let db: CentroSistema[];
    if (formSistema.id) {
      db = centroSistemas.map(s => s.id === formSistema.id ? { ...formSistema, familia: familiaReal, centroId: centroSeleccionado.id } : s);
    } else {
      db = [...centroSistemas, { ...formSistema, familia: familiaReal, id: generateId(), centroId: centroSeleccionado.id }];
    }
    
    setCentroSistemas(db);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(db));
    setIsSistemaModalOpen(false);
  };

  const handleAddSistemaFromCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroForNewSistema || !selectedCatIdForCentro) return;
    
    const cat = categoriasSistema.find(c => c.id === selectedCatIdForCentro);
    if (!cat) return;

    const newSistema: CentroSistema = {
      id: generateId(),
      centroId: centroForNewSistema.id,
      tipo: cat.nombre,
      familia: cat.nombre,
      descripcion: ''
    };

    const db = [...centroSistemas, newSistema];
    setCentroSistemas(db);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(db));
    
    setIsAddCatModalOpen(false);
    setSelectedCatIdForCentro('');
    setCentroForNewSistema(null);
  };

  const handleDeleteSistema = (id: string) => {
    setItemToDelete({ type: 'sistema', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteSistema = () => {
    if (!itemToDelete || itemToDelete.type !== 'sistema') return;
    setIsConfirmModalOpen(false);
    const db = centroSistemas.filter(s => s.id !== itemToDelete.id);
    setCentroSistemas(db);
    localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(db));
    const dbEq = equiposInstalados.filter(e => e.sistemaId !== itemToDelete.id);
    setEquiposInstalados(dbEq);
    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(dbEq));
    setItemToDelete(null);
  };

  // ----- FUNCIONES EQUIPOS DEL SISTEMA (EN CENTRO) -----
  const handleAddDesdeCatalogo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centroSeleccionado || !sistemaSeleccionado || !selectedEquipoCatalogo || cantidadAñadir < 1) return;
    
    const equipoBase = equiposCatalogo.find(eq => eq.id === selectedEquipoCatalogo);
    if (!equipoBase) return;

    const nuevosEquipos: EquipoInstalado[] = [];
    for (let i = 0; i < cantidadAñadir; i++) {
      nuevosEquipos.push({
        id: generateId(),
        centroId: centroSeleccionado.id,
        sistemaId: sistemaSeleccionado.id,
        codigo: '', // Vacío para que el usuario se lo asigne uno a uno
        nombre: equipoBase.nombre,
        ubicacion: '',
        revisado: false,
        checkAcceso: true,
        checkAltura: true,
        checkSoporte: true,
        checkSenalizacion: true,
        checkManguera: true,
        checkPeso: true,
        checkManometro: true,
        checkMarcado: true,
        checkEtiquetas: true,
        checkRetimbre: true,
        checkRiesgo: true,
        checkDistancia: true,
        checkPasador: true,
        checkMovilidad: true
      });
    }

    const db = [...equiposInstalados, ...nuevosEquipos];
    setEquiposInstalados(db);
    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(db));
    setIsEquipoModalOpen(false);
    setSelectedEquipoCatalogo('');
    setCantidadAñadir(1);
  };

  const handleDuplicateEquipoCentro = (eq: EquipoInstalado) => {
    const newEquipo = {
      ...eq,
      id: generateId(),
      codigo: eq.codigo ? `${eq.codigo}-COPIA` : ''
    };
    const db = [...equiposInstalados, newEquipo];
    setEquiposInstalados(db);
    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(db));
  };

  const handleUpdateEquipo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEquipo.id) return;

    const exists = equiposInstalados.some(eq => eq.id === formEquipo.id);
    const db = exists 
      ? equiposInstalados.map(eq => eq.id === formEquipo.id ? { ...formEquipo, revisado: true } : eq)
      : [...equiposInstalados, { ...formEquipo, revisado: true }];

    setEquiposInstalados(db);
    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(db));
    setFormEquipo({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' });
    setIsEquipoModalOpen(false);
  };

  const handleDeleteEquipo = (id: string) => {
    setItemToDelete({ type: 'equipo', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteEquipo = () => {
    if (!itemToDelete || itemToDelete.type !== 'equipo') return;
    setIsConfirmModalOpen(false);
    const db = equiposInstalados.filter(eq => eq.id !== itemToDelete.id);
    setEquiposInstalados(db);
    localStorage.setItem('firecheck_db_equipos_instalados', JSON.stringify(db));
    setItemToDelete(null);
  };

  // Cliente seleccionado actual en el formulario
  const selectedCliente = form.clienteId ? clientes.find(c => c.id === form.clienteId) : null;
  // Previsualización del ID mientras se escribe
  const idPreview = form.id ? form.id : calculateNextCentroId(form.clienteId, form.customIdPart);

  // Copiar datos del cliente al centro
  const handleCopyFromCliente = () => {
    if (!selectedCliente) return;
    setForm({
      ...form,
      nombre: selectedCliente.nombre,
      direccion: selectedCliente.direccion || '',
      poblacion: selectedCliente.poblacion || '',
      cp: selectedCliente.cp || '',
      provincia: selectedCliente.provincia || '',
      contacto: selectedCliente.contacto || '',
      telefono: selectedCliente.telefono || '',
      correo: selectedCliente.correo || ''
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEndSistemas = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setCentroSistemas((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('firecheck_db_centro_sistemas', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };

  // Filtrado (seguro contra campos undefined)
  const filteredCentros = centros.filter(c => {
    const client = clientes.find(cl => cl.id === c?.clienteId);
    // Limpiamos los espacios extras en el termino de busqueda antes de comparar
    const term = (searchTerm || '').toLowerCase().trim();
    const nombre = c && c.nombre ? String(c.nombre).toLowerCase() : '';
    const cid = c && c.id ? String(c.id).toLowerCase() : '';
    const clienteId = c && c.clienteId ? String(c.clienteId).toLowerCase() : '';
    const poblacion = c && c.poblacion ? String(c.poblacion).toLowerCase() : '';
    const clientNombre = client && client.nombre ? String(client.nombre).toLowerCase() : '';
    return nombre.includes(term) ||
           cid.includes(term) ||
           // Buscamos también por el ID del cliente para que funcione el link
           clienteId.includes(term) ||
           poblacion.includes(term) ||
           (clientNombre && clientNombre.includes(term));
  });

  // ----- RENDERIZADO DE LA LISTA ----- //
  const renderContent = () => {
    if (view === 'list') {
      return (
      <div className="min-h-screen bg-emerald-50/40 p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver al panel
              </button>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Directorio de Centros</h1>
              <p className="text-zinc-500 mt-2">{centros.length} centros registrados en el sistema.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-white text-zinc-700 border border-zinc-200 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 hover:text-black transition-all text-sm shadow-sm"
                title="Exportar a Excel"
              >
                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white text-zinc-700 border border-zinc-200 px-4 py-2.5 rounded-xl font-medium hover:bg-zinc-50 hover:text-black transition-all text-sm shadow-sm"
                title="Importar desde Excel"
              >
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span>
              </button>
              <button onClick={() => { 
                if (clientes.length === 0) return alert('Debes crear al menos un Cliente antes de crear un Centro.');
                setForm(emptyCentro); setView('form'); 
              }} className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-medium hover:bg-zinc-800 transition-all text-sm shadow-md shadow-black/10">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Centro</span><span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Buscador */}
          {centros.length > 0 && (
            <div className="relative mb-8">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-zinc-400" />
              </div>
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-xl border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all shadow-sm text-zinc-900 placeholder-zinc-400"
                placeholder="Buscar centro por nombre, ID o población..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {/* Lista de Centros */}
          {centros.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay centros</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">
                Los centros de trabajo se vinculan a tus clientes. Para crear uno, necesitas haber dado de alta un cliente previamente.
              </p>
              <button onClick={() => {
                if (clientes.length === 0) return alert('Debes ir a la sección Clientes y crear uno primero.');
                setForm(emptyCentro); setView('form');
              }} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md">
                <Plus className="w-5 h-5" /> Crear el primer centro
              </button>
            </div>
          ) : filteredCentros.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">No se ha encontrado ningún centro que coincida con "{searchTerm}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCentros.map((c) => {
                const client = clientes.find(cl => cl.id === c.clienteId);
                return (
                  <div key={c.id} className="bg-white p-3.5 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-base font-bold text-zinc-950 truncate" title={c.nombre}>{c.nombre}</h3>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 bg-zinc-100 text-zinc-800 text-[10px] font-mono font-bold rounded block w-max mt-1">
                        {c.id}
                      </span>
                      <span className="text-xs font-medium text-zinc-700/80 truncate mt-1" title={`${client?.nombre || 'Cliente desconocido'} ${client?.cif ? `(${client.cif})` : ''}`}>
                        {client?.nombre || 'Cliente desconocido'}
                      </span>
                    </div>
                    
                    <div className="space-y-0.5 text-xs mb-3 flex-1">
                      {c.direccion && <p className="text-zinc-900/70 truncate" title={c.direccion}>{c.direccion}</p>}
                      <p className="text-zinc-900/60 truncate" title={`${c.poblacion || ''} ${c.cp || ''} ${c.provincia ? `(${c.provincia})` : ''}`}>
                        {c.poblacion ? `${c.poblacion}` : 'Sin ubicación'}
                      </p>
                    </div>
                    
                    <div className="space-y-1 text-xs text-zinc-900/80 mb-3 bg-zinc-50 p-2 rounded-2xl border border-zinc-100">
                      {c.contacto && <p className="truncate"><strong className="text-zinc-950 font-medium">Contacto:</strong> {c.contacto}</p>}
                      {c.telefono && <p className="truncate"><strong className="text-zinc-950 font-medium">Tel:</strong> {c.telefono}</p>}
                    </div>

                    <div className="flex justify-end gap-0.5">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-black hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors" title="Editar centro">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar centro">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex flex-col gap-2">
                      <span className="text-xs font-medium text-zinc-700 text-center">
                        <strong className="text-zinc-900">{centroSistemas.filter(s => s.centroId === c.id).length}</strong> sistemas instalados
                      </span>
                      <button 
                        onClick={() => openSistemas(c)} 
                        className="w-full flex items-center justify-center text-sm bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-3 py-2 rounded-xl font-medium transition-colors shadow-sm"
                      >
                        Añadir sistemas al centro
                      </button>
                      <button
                        onClick={() => {
                          setCentroForNewPeriodicidad(c);
                          setFormPeriodicidad({
                            periodicidad: c.periodicidad || [],
                            mesesRevision: c.mesesRevision || []
                          });
                          setIsPeriodicidadModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center text-sm bg-black hover:bg-zinc-800 text-white px-3 py-2 rounded-xl font-medium transition-colors shadow-sm"
                      >
                        Editar Periodicidad
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODAL PERIODICIDAD */}
          {isPeriodicidadModalOpen && centroForPeriodicidad && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
              <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">Configurar Periodicidad</h2>
                    <p className="text-xs text-zinc-500">{centroForPeriodicidad.nombre}</p>
                  </div>
                  <button onClick={() => setIsPeriodicidadModalOpen(false)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSavePeriodicidad} className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">1. Tipo de contrato</h3>
                    <div className="flex flex-wrap gap-4">
                      {['Mensual', 'Trimestral', 'Anual'].map(type => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formPeriodicidad.periodicidad.includes(type)}
                            onChange={e => {
                              const newTypes = e.target.checked
                                ? [...formPeriodicidad.periodicidad, type]
                                : formPeriodicidad.periodicidad.filter(t => t !== type);
                              setFormPeriodicidad({ ...formPeriodicidad, periodicidad: newTypes });
                            }}
                            className="w-5 h-5 text-black rounded border-zinc-300 focus:ring-black cursor-pointer"
                          />
                          <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">2. ¿Cuándo sería la revisión Anual?</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {MESES.map(mes => (
                        <label key={mes} className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border-2 transition-all ${formPeriodicidad.mesesRevision.includes(mes) ? 'bg-zinc-900 border-emerald-500 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}>
                          <input
                            type="radio"
                            name="mesRevision"
                            className="hidden"
                            checked={formPeriodicidad.mesesRevision.includes(mes)}
                            onChange={() => {
                              setFormPeriodicidad({ ...formPeriodicidad, mesesRevision: [mes] });
                            }}
                          />
                          <span className="text-xs font-bold w-full text-center">{mes}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* RESUMEN DE PERIODICIDAD */}
                  <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Resumen del contrato</h3>
                    {(() => {
                      const tipos = formPeriodicidad.periodicidad;
                      const mesRevis = formPeriodicidad.mesesRevision[0] || '';
                      const lineas: string[] = [];

                      if (tipos.includes('Anual') && mesRevis) {
                        lineas.push(`Revisión anual: ${mesRevis.toLowerCase()}`);
                      } else if (tipos.includes('Anual')) {
                        lineas.push('Revisión anual: (selecciona un mes)');
                      }

                      if (tipos.includes('Trimestral') && mesRevis) {
                        const idx = MESES.indexOf(mesRevis);
                        const trimestres = [3, 6, 9].map(offset => MESES[(idx + offset) % 12]);
                        lineas.push(`Revisión trimestral: ${trimestres.join(', ').toLowerCase()}`);
                      } else if (tipos.includes('Trimestral')) {
                        lineas.push('Revisión trimestral: (selecciona un mes de referencia)');
                      }

                      if (tipos.includes('Mensual')) {
                        lineas.push('Revisión mensual');
                      }

                      return lineas.length > 0 ? (
                        <div className="text-sm font-medium text-zinc-900 leading-relaxed space-y-1">
                          {lineas.map((linea, i) => (
                            <p key={i}>{linea}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400 italic">Selecciona al menos un tipo de contrato y un mes para ver el resumen.</p>
                      );
                    })()}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsPeriodicidadModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 bg-black hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-black/10 transition-all">Guardar Periodicidad</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isConfirmModalOpen && itemToDelete && (
            <ConfirmationModal
              isOpen={isConfirmModalOpen}
              onClose={() => { setIsConfirmModalOpen(false); setItemToDelete(null); }}
              onConfirm={itemToDelete.type === 'centro' ? confirmDeleteCentro : itemToDelete.type === 'sistema' ? confirmDeleteSistema : confirmDeleteEquipo}
              title="Confirmar Eliminación"
              message="ATENCIÓN: Vas a proceder al borrado del elemento y sus registros ¿CONFIRMAS LA PETICIÓN?"
              confirmText="Sí, eliminar"
              cancelText="No, cancelar"
            />
          )}
        </div>
      </div>
    );
  }

    if (view === 'sistemas' && centroSeleccionado) {
      const sistDelCentro = centroSistemas.filter(s => s.centroId === centroSeleccionado.id);
      const clientInfo = clientes.find(cl => cl.id === centroSeleccionado.clienteId);
      return (
      <div className="min-h-screen bg-emerald-50/40 p-6 md:p-12">
        <div className="max-w-4xl mx-auto w-full">
          <button 
            onClick={() => setView('list')} 
            className="text-sm font-medium text-emerald-600 hover:text-emerald-950 mb-8 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a Centros
          </button>

          <div className="mb-8">
            <div className="mb-5">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 block">
                {clientInfo?.nombre || 'Cliente'} &bull; {centroSeleccionado.nombre}
              </span>
              <h1 className="text-3xl font-bold text-emerald-950 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                Sistemas del Centro
              </h1>
              <p className="text-emerald-900/60 mt-1">Sistemas vinculados a este centro de trabajo</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={(e) => { 
                  e.preventDefault();
                  setCentroForNewSistema(centroSeleccionado); 
                  setSelectedCatIdForCentro(''); 
                  setIsAddCatModalOpen(true); 
                }}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Añadir sistemas
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSistemas}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sistDelCentro.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-emerald-100 border-dashed">
                  <Layers className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                  <p className="text-emerald-900/50 font-medium">Este centro no tiene sistemas registrados.</p>
                </div>
              ) : (
                <SortableContext items={sistDelCentro.map(s => s.id)} strategy={rectSortingStrategy}>
                  {sistDelCentro.map(sist => {
                    const equiposDelSistema = equiposInstalados.filter(e => e.sistemaId === sist.id);
                    const equiposCount = equiposDelSistema.length;
                    const IconoCat = getIconForSistema(sist.tipo || sist.familia || '');
                    return (
                    <SortableSistemaWrapper key={sist.id} sist={sist}>
                      {(attrs, listeners) => (
                      <div className="bg-white p-4 rounded-3xl border-2 border-emerald-100 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all flex flex-col group h-full relative overflow-hidden">
                        {/* Botón de arrastrar escondido, aparece en hover */}
                        <div 
                          {...attrs} 
                          {...listeners} 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-2 right-14 p-1.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing md:opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                          <GripHorizontal className="w-5 h-5" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-3 relative z-10">
                          <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 overflow-hidden relative z-10 shrink-0">
                        {IconoCat && (typeof IconoCat === 'string' ? (
                          <img src={IconoCat} alt="Icon" className="w-6 h-6 object-contain opacity-80" />
                        ) : (
                          <IconoCat className="w-5 h-5" />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">{sist.tipo}</span>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-emerald-950 text-base leading-tight truncate">{sist.familia || sist.tipo}</h3>
                          <span className="shrink-0 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded" title="Equipos registrados">
                            {equiposCount}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 relative z-10">
                      <button onClick={(e) => { e.stopPropagation(); setFormSistema(sist); setIsSistemaModalOpen(true); }} className="p-1.5 text-black hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteSistema(sist.id); }} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {sist.descripcion && (
                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-50 mt-2 relative z-10">
                      <p className="text-sm text-emerald-900/70">{sist.descripcion}</p>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-emerald-50 relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Equipos en el sistema</h4>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSistemaSeleccionado(sist);
                            setFormEquipo({ 
                              id: '', 
                              centroId: centroSeleccionado.id, 
                              sistemaId: sist.id, 
                              codigo: '', 
                              nombre: '', 
                              ubicacion: '',
                              clase: '',
                              checkAcceso: true,
                              checkAltura: true,
                              checkSoporte: true,
                              checkSenalizacion: true,
                              checkManguera: true,
                              checkPeso: true,
                              checkManometro: true,
                              checkMarcado: true,
                              checkEtiquetas: true,
                              checkRetimbre: true,
                              checkRiesgo: true,
                              checkDistancia: true,
                              checkPasador: true,
                              checkMovilidad: true
                            });
                            setIsClaseOtro(false);
                            setSelectedEquipoCatalogo('');
                            setIsEquipoModalOpen(true); 
                          }} 
                          className="flex items-center gap-1 text-[10px] bg-slate-900 hover:bg-black text-white px-2 py-1 rounded-md font-bold transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Añadir equipos
                        </button>
                      </div>
                    </div>
                    {equiposDelSistema.length === 0 ? (
                      <p className="text-xs text-emerald-600/50 italic py-2 text-center bg-emerald-50/50 rounded-lg border border-emerald-50/50">Sin equipos</p>
                    ) : (
                      <div className="space-y-1.5 mt-2">
                        {equiposDelSistema.map((eq: any, i) => {
                          const hasAnomalies = Object.keys(eq).some(k => k.startsWith('check') && eq[k] === false);
                          
                          return (
                            <div key={eq.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                              <span className="font-medium text-slate-700 truncate pr-2 flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{eq.codigo || (i+1).toString().padStart(2, '0')}</span> 
                                {eq.nombre || eq.modelo || 'Equipo sin nombre'}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasAnomalies && (
                                  <span title="Anomalías detectadas"><AlertTriangle className="w-4 h-4 text-red-500" /></span>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDuplicateEquipoCentro(eq); }} className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors" title="Duplicar equipo">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleEditEquipo(eq, sist); }} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar equipo">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteEquipo(eq.id); }} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar equipo">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </SortableSistemaWrapper>
              )})}
            </SortableContext>
              )}
            </div>
          </DndContext>

          {/* MODAL EQUIPO (AÑADIR O EDITAR) */}
          {isEquipoModalOpen && sistemaSeleccionado && centroSeleccionado && (
            <div className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/30 shrink-0">
                  <h2 className="text-lg font-bold text-emerald-950">
                    {formEquipo.id ? 'Editar Equipo' : 'Añadir desde Catálogo'}
                  </h2>
                  <button onClick={() => { setIsEquipoModalOpen(false); setFormEquipo({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' }); setSelectedEquipoCatalogo(''); setIsClaseOtro(false); }} className="p-2 text-emerald-400 hover:text-emerald-700 hover:bg-white rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="overflow-y-auto p-6">
                  {formEquipo.id ? (
                    <form onSubmit={handleUpdateEquipo} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-emerald-950">Código / Nº</label>
                          <input type="text" value={formEquipo.codigo} onChange={e => setFormEquipo({...formEquipo, codigo: e.target.value.toUpperCase()})} className="w-full px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-950" placeholder="Ej: 01, EXT-01..." />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-emerald-950">Nombre del Equipo</label>
                          <input type="text" value={formEquipo.nombre} onChange={e => setFormEquipo({...formEquipo, nombre: e.target.value})} className="w-full px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-950" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-emerald-950">Ubicación</label>
                        <input type="text" value={formEquipo.ubicacion} onChange={e => setFormEquipo({...formEquipo, ubicacion: e.target.value})} className="w-full px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-950" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-emerald-800 uppercase">Placa / ID</label>
                          <input type="text" value={formEquipo.placa || ''} onChange={e => setFormEquipo({...formEquipo, placa: e.target.value})} className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-emerald-800 uppercase">Clase</label>
                          {sistemaSeleccionado && (sistemaSeleccionado.tipo || '').toUpperCase().includes('EXTINTOR') ? (
                            <div className="space-y-1">
                              <select 
                                value={isClaseOtro ? 'OTRO' : (formEquipo.clase || '')} 
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === 'OTRO') {
                                    setIsClaseOtro(true);
                                    setFormEquipo({...formEquipo, clase: ''});
                                  } else {
                                    setIsClaseOtro(false);
                                    setFormEquipo({...formEquipo, clase: val});
                                  }
                                }}
                                className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                              >
                                <option value="">-- Seleccionar --</option>
                                {['POLVO', 'CO2', 'ESPUMA', 'GAS', 'AGUA', 'ADITIVO'].map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="OTRO">OTRO...</option>
                              </select>
                              {isClaseOtro && (
                                <input 
                                  type="text" 
                                  placeholder="Especificar clase"
                                  value={formEquipo.clase || ''} 
                                  onChange={e => setFormEquipo({...formEquipo, clase: e.target.value.toUpperCase()})} 
                                  className="w-full px-3 py-2 mt-1 bg-white border border-emerald-100 rounded-lg text-xs" 
                                />
                              )}
                            </div>
                          ) : (
                            <input type="text" value={formEquipo.clase || ''} onChange={e => setFormEquipo({...formEquipo, clase: e.target.value})} className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-emerald-800 uppercase">Fabricante</label>
                          <input type="text" value={formEquipo.fabricante || ''} onChange={e => setFormEquipo({...formEquipo, fabricante: e.target.value})} className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-emerald-800 uppercase">F. Fab.</label>
                          <input type="month" value={formEquipo.fechaFabricacion || ''} onChange={e => setFormEquipo({...formEquipo, fechaFabricacion: e.target.value})} className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs" />
                        </div>
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => { setIsEquipoModalOpen(false); setFormEquipo({ id: '', centroId: '', sistemaId: '', codigo: '', nombre: '', ubicacion: '' }); setIsClaseOtro(false); }} className="flex-1 px-4 py-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-medium transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors shadow-sm">Guardar Datos</button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleAddDesdeCatalogo} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-emerald-950">Sistema</label>
                        <div className="px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-950 font-medium text-sm">
                          {sistemaSeleccionado.tipo || sistemaSeleccionado.familia}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-emerald-950">Seleccionar Equipo del Catálogo *</label>
                        <select
                          required
                          value={selectedEquipoCatalogo}
                          onChange={e => setSelectedEquipoCatalogo(e.target.value)}
                          className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-950"
                        >
                          <option value="">-- Elige un equipo --</option>
                          {equiposCatalogo
                            .filter(eq => {
                              const tipo = sistemaSeleccionado.tipo || sistemaSeleccionado.familia || '';
                              if (tipo.toUpperCase().includes('EXTINTOR')) {
                                return (eq.familia || '').toUpperCase().includes('EXTINTOR');
                              }
                              return true;
                            })
                            .map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.codigo} - {eq.nombre}</option>
                            ))}
                        </select>
                        {equiposCatalogo.length === 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-1">No hay equipos en el catálogo. Ve a Equipamientos para añadirlos.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-emerald-950">Cantidad</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={cantidadAñadir}
                          onChange={e => setCantidadAñadir(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-950"
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => { setIsEquipoModalOpen(false); setSelectedEquipoCatalogo(''); }} className="flex-1 px-4 py-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={!selectedEquipoCatalogo} className="flex-1 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl font-medium transition-colors shadow-sm">
                          Añadir {cantidadAñadir > 1 ? `${cantidadAñadir} equipos` : '1 equipo'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODAL SISTEMA (CENTRO) */}
          {isSistemaModalOpen && (
            <div className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/30">
                  <h2 className="text-lg font-bold text-emerald-950">Editar Sistema</h2>
                  <button onClick={() => setIsSistemaModalOpen(false)} className="p-2 text-emerald-400 hover:text-emerald-700 hover:bg-white rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveSistema} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-emerald-950">Familia / Nombre en este centro *</label>
                    <input
                      required type="text" value={formSistema.familia} onChange={e => setFormSistema({...formSistema, familia: e.target.value})}
                      className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-950"
                      placeholder="Ej: SISTEMA EXTINTORES NAVE 1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-emerald-950">Descripción / Notas</label>
                    <textarea
                      value={formSistema.descripcion} onChange={e => setFormSistema({...formSistema, descripcion: e.target.value})}
                      className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-950 resize-none"
                      rows={3}
                      placeholder="Alguna observación sobre este sistema..."
                    />
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button type="button" onClick={() => setIsSistemaModalOpen(false)} className="flex-1 px-4 py-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-medium transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors shadow-sm">Guardar Cambios</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL AÑADIR SISTEMA DESDE CATÁLOGO */}
          {isAddCatModalOpen && (
            <div className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/30">
                  <h2 className="text-lg font-bold text-emerald-950">Añadir Sistema al Centro</h2>
                  <button onClick={() => setIsAddCatModalOpen(false)} className="p-2 text-emerald-400 hover:text-emerald-700 hover:bg-white rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddSistemaFromCatalog} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-emerald-950">Seleccionar Sistema del Catálogo *</label>
                    <select
                      required
                      value={selectedCatIdForCentro}
                      onChange={e => setSelectedCatIdForCentro(e.target.value)}
                      className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-950"
                    >
                      <option value="">-- Elige un sistema --</option>
                      {categoriasSistema.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button type="button" onClick={() => setIsAddCatModalOpen(false)} className="flex-1 px-4 py-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-medium transition-colors">Cancelar</button>
                    <button type="submit" disabled={!selectedCatIdForCentro} className="flex-1 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl font-medium transition-colors shadow-sm">
                      Añadir al Centro
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isConfirmModalOpen && itemToDelete && (
            <ConfirmationModal
              isOpen={isConfirmModalOpen}
              onClose={() => { setIsConfirmModalOpen(false); setItemToDelete(null); }}
              onConfirm={itemToDelete.type === 'centro' ? confirmDeleteCentro : itemToDelete.type === 'sistema' ? confirmDeleteSistema : confirmDeleteEquipo}
              title="Confirmar Eliminación"
              message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
              confirmText="Sí, eliminar"
              cancelText="No, cancelar"
            />
          )}
        </div>
      </div>
    );
  }

  };

  if (view !== 'form') {
    return renderContent();
  }

  // ----- RENDERIZADO DEL FORMULARIO ----- //
  return (
    <div className="min-h-screen bg-emerald-50/40 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { setView('list'); setForm(emptyCentro); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al directorio
          </button>
        </div>

        <div className="mb-6">
          <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {form.id ? 'Editar Centro de Trabajo' : 'Añadir Nuevo Centro'}
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Selecciona a qué cliente pertenece este centro y rellena sus datos.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <form className="space-y-3" onSubmit={handleSave}>
            
            {/* SECCIÓN 1: VINCULACIÓN CON CLIENTE E ID */}
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <h2 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-wide">1. Vinculación y Código</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-900 mb-1.5">SELECCIONAR CLIENTE *</label>
                  <select
                    required
                    disabled={!!form.id}
                    value={form.clienteId}
                    onChange={(e) => setForm({...form, clienteId: e.target.value})}
                    className="w-full px-3 py-2.5 text-sm bg-white rounded-lg border border-zinc-200 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 disabled:opacity-50"
                  >
                    <option value="">-- Elige un cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                
{selectedCliente && (
                   <div className="flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2.5">
                     <div className="flex-1">
                       <p className="text-[10px] text-zinc-400 font-semibold mb-0.5">DATOS DEL CLIENTE</p>
                       <p className="text-sm font-medium text-zinc-900">{selectedCliente.nombre} <span className="text-zinc-400 font-mono ml-1 text-xs">{selectedCliente.cif}</span></p>
                     </div>
                     <button 
                       type="button"
                       onClick={handleCopyFromCliente}
                       className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors"
                       title="Copiar datos del cliente al centro"
                     >
                       <Copy className="w-4 h-4" />
                     </button>
                   </div>
                 )}
              </div>

              {selectedCliente && (
                <div className="bg-black text-white p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold mb-0.5">CÓDIGO DE CENTRO</p>
                    <p className="text-lg font-mono font-bold tracking-wider">{idPreview || 'CEN XXXX-XX-(XXXX)'}</p>
                  </div>
                    <div className="text-right w-1/3">
                    <label className="block text-[10px] text-red-400 font-bold mb-0.5">codigo periodicidad <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={form.customIdPart} 
                      onChange={e => setForm({...form, customIdPart: e.target.value.toUpperCase()})}
                      className="w-full px-2 py-1.5 bg-white/10 rounded-md border border-white/20 focus:bg-white/20 outline-none transition-all text-white font-mono text-xs text-right placeholder-white/30 uppercase" 
                      placeholder="Ej: A001" 
                      maxLength={10}
                    />
                  </div>
                </div>
              )}
            </div>

            <hr className="border-zinc-100 my-4" />

            {/* SECCIÓN 2: DATOS DEL CENTRO */}
            <div>
              <h2 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-wide">2. Datos del Centro</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-900 mb-1">NOMBRE DEL CENTRO *</label>
                  <input 
                    required type="text" 
                    value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    placeholder="Ej. Nave Principal, Sede Norte..." 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-900 mb-1">DIRECCIÓN</label>
                  <input 
                    type="text" 
                    value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    placeholder="Calle, Polígono, número..." 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">POBLACIÓN</label>
                    <input 
                      type="text" 
                      value={form.poblacion} onChange={e => setForm({...form, poblacion: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">CÓDIGO POSTAL</label>
                    <input 
                      type="text" 
                      value={form.cp} onChange={e => setForm({...form, cp: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">PROVINCIA</label>
                    <input 
                      type="text" 
                      value={form.provincia} onChange={e => setForm({...form, provincia: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">CONTACTO (En el centro)</label>
                    <input 
                      type="text" 
                      value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">TELÉFONO</label>
                    <input 
                      type="tel" 
                      value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-1">CORREO</label>
                    <input 
                      type="email" 
                      value={form.correo} onChange={e => setForm({...form, correo: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-zinc-50/50 rounded-lg border border-zinc-200 focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-zinc-900 placeholder-zinc-400" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={!form.clienteId} className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-md active:scale-95">
                <Save className="w-4 h-4" /> {form.id ? 'Guardar Cambios' : 'Registrar Centro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}