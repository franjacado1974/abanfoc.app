import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, ShieldCheck, FireExtinguisher, Plus, Trash2, ArrowLeft, Image as ImageIcon, X, Loader, Edit, Percent, ClipboardList, ChevronDown, ChevronUp
} from 'lucide-react';
import { addUserToFirestore, subscribeSistemasCategorias, addSistemaCategoria, deleteSistemaCategoria, updateSistemaCategoria, uploadFile, subscribeImpuestos, saveImpuestoConfig, subscribeTecnicos, saveTecnico, deleteTecnico } from './firebase';
import FormBuilderPlantillas from './FormBuilderPlantillas';
import ConfirmationModal from './ConfirmationModal';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
};

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
  password?: string;
}

interface SistemaTipo {
  id: string;
  nombre: string;
}

interface SistemaItem {
  id: string;
  nombre: string;
  imagenUrl?: string;
  tipos?: SistemaTipo[];
}

export default function Ajustes() {
  const navigate = useNavigate();
  const [view, setView] = useState<'menu' | 'tecnicos' | 'usuarios' | 'sistemas' | 'impuestos' | 'plantillas'>('menu');

  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; apellidos: string; habilitacion?: string; _docId?: string }[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_tecnicos');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [nuevoTecnico, setNuevoTecnico] = useState({ nombre: '', apellidos: '', habilitacion: '' });
  const [editTecnicoId, setEditTecnicoId] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_usuarios');
      if (!stored && !localStorage.getItem('firecheck_migration_done')) {
        const initialAdmin: Usuario[] = [{
          id: 'USR-' + generateId().slice(0, 8).toUpperCase(),
          nombre: 'Super',
          apellidos: 'Admin',
          rol: 'super-administrador',
          password: 'admin'
        }];
        localStorage.setItem('firecheck_db_usuarios', JSON.stringify(initialAdmin));
        localStorage.setItem('firecheck_migration_done', 'true');
        return initialAdmin;
      }
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', apellidos: '', rol: 'visualizador', password: '' });

  // ─── GESTION DE SISTEMAS ──────────────────────────────────────────────
  const [sistemas, setSistemas] = useState<SistemaItem[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_sistemas_categorias');
      if (stored) { // Assuming 'cats' from Firestore now includes imagenUrl
        return JSON.parse(stored).map((s: any) => ({
          ...s, // The s object from localStorage should already contain imagenUrl if saved from Firestore
          imagenUrl: s.imagenUrl || undefined
        }));
      }
      return [];
    } catch { return []; }
  });

  const [isSistemaModalOpen, setIsSistemaModalOpen] = useState(false);
  const [editSistemaId, setEditSistemaId] = useState<string | null>(null);
  const [sistemaNombre, setSistemaNombre] = useState('');
  const [sistemaImagen, setSistemaImagen] = useState<File | null>(null);
  const [sistemaImagenPreview, setSistemaImagenPreview] = useState<string | null>(null);

  // Estados para acordeón y tipos de equipos
  const [expandedSistemaId, setExpandedSistemaId] = useState<string | null>(null);
  const [isTipoModalOpen, setIsTipoModalOpen] = useState(false);
  const [editTipoId, setEditTipoId] = useState<string | null>(null);
  const [tipoNombre, setTipoNombre] = useState('');
  const [activeSistemaForTipo, setActiveSistemaForTipo] = useState<string | null>(null);

  // ─── GESTION DE IMPUESTOS ──────────────────────────────────────────────
  const [impuestosConfig, setImpuestosConfig] = useState({ iva: 21, exento: false });
  const [impuestosStatus, setImpuestosStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Cargar configuración de impuestos desde Firestore
  useEffect(() => {
    const unsub = subscribeImpuestos((config) => {
      if (config) {
        setImpuestosConfig({ iva: config.iva, exento: config.exento });
        localStorage.setItem('firecheck_impuestos_config', JSON.stringify({ iva: config.iva, exento: config.exento }));
      } else {
        // Si no hay datos en Firestore, usar valores por defecto
        const local = localStorage.getItem('firecheck_impuestos_config');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setImpuestosConfig({ iva: parsed.iva || 21, exento: parsed.exento || false });
          } catch { /* usar defaults */ }
        }
      }
    });
    return () => unsub();
  }, []);

  const handleIvaChange = async (val: number) => {
    const iva = Math.max(0, Math.min(100, val || 0));
    const newConfig = { iva, exento: false };
    setImpuestosConfig(newConfig);
    setImpuestosStatus('saving');
    try {
      await saveImpuestoConfig(newConfig);
      localStorage.setItem('firecheck_impuestos_config', JSON.stringify(newConfig));
      setImpuestosStatus('success');
      setTimeout(() => setImpuestosStatus('idle'), 2000);
    } catch (e) {
      console.error('Error guardando configuración de IVA:', e);
      setImpuestosStatus('error');
      setTimeout(() => setImpuestosStatus('idle'), 3000);
    }
  };

  // Cargar sistemas desde Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeSistemasCategorias((cats) => {
      if (cats.length > 0) { // Assuming 'cats' from Firestore now includes imagenUrl
        // No need to merge with a separate imagenesMap, as imagenUrl should be directly in cats
        setSistemas(cats); 
        localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(cats));
      }
    });
    return () => unsub();
  }, []);

  // Cargar técnicos desde Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeTecnicos((items) => {
      setTecnicos(items);
      localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(items));
    });
    return () => unsub();
  }, []);

  const handleAddSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sistemaNombre.trim()) return;

    const newCatId = editSistemaId || crypto.randomUUID();
    const newCatNombre = sistemaNombre.toUpperCase();

    try {
      // Subir imagen si se ha seleccionado (primero, para obtener la URL)
      let imagenUrl: string | undefined = undefined;
      if (sistemaImagen) {
        try {
          const path = `sistemas_imagenes/${newCatId}_${Date.now()}`;
          imagenUrl = await uploadFile(sistemaImagen, path);
        } catch (err) {
          console.warn('Error al subir imagen:', err);
        }
      }

      // Guardar en Firestore con la imagenUrl (se sincronizará en tiempo real)
      await addSistemaCategoria({ 
        id: newCatId, 
        nombre: newCatNombre,
        imagenUrl: imagenUrl
      });

      setIsSistemaModalOpen(false);
      setSistemaNombre('');
      setSistemaImagen(null);
      setSistemaImagenPreview(null);
      setEditSistemaId(null);
    } catch (error) {
      alert('Error al guardar el sistema en Firebase.');
    }
  };

  const handleEditSistema = (sist: SistemaItem) => {
    setEditSistemaId(sist.id);
    setSistemaNombre(sist.nombre);
    setSistemaImagenPreview(sist.imagenUrl || null);
    setSistemaImagen(null);
    setIsSistemaModalOpen(true);
  };

  const handleDeleteSistema = (id: string) => {
    setItemToDelete({ type: 'sistema', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteSistema = async () => {
    if (!itemToDelete || itemToDelete.type !== 'sistema') return;
    setIsConfirmModalOpen(false);
    try {
      await deleteSistemaCategoria(itemToDelete.id);
      const updated = sistemas.filter(s => s.id !== itemToDelete.id);
      setSistemas(updated);
      // The updated 'sistemas' (which are SistemaItem) contain imagenUrl.
      // When saving to localStorage, we save the 'cats' from Firestore, which should also contain imagenUrl.
      localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(updated)); 
    } catch (error) {
      alert('Error al eliminar el sistema de Firebase.');
    }
    setItemToDelete(null);
  };

  const handleSistemaImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSistemaImagen(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSistemaImagenPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // --- LOGICA PARA TIPOS DE EQUIPOS ---
  const toggleExpandedSistema = (id: string) => {
    setExpandedSistemaId(prev => (prev === id ? null : id));
  };

  const handleSaveTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoNombre.trim() || !activeSistemaForTipo) return;

    const sistemaActual = sistemas.find(s => s.id === activeSistemaForTipo);
    if (!sistemaActual) return;

    let updatedTipos = sistemaActual.tipos ? [...sistemaActual.tipos] : [];
    
    if (editTipoId) {
      updatedTipos = updatedTipos.map(t => t.id === editTipoId ? { ...t, nombre: tipoNombre.trim() } : t);
    } else {
      updatedTipos.push({ id: generateId(), nombre: tipoNombre.trim() });
    }

    try {
      await updateSistemaCategoria(activeSistemaForTipo, { tipos: updatedTipos } as any);
      setSistemas(sistemas.map(s => s.id === activeSistemaForTipo ? { ...s, tipos: updatedTipos } : s));
      setIsTipoModalOpen(false);
      setTipoNombre('');
      setEditTipoId(null);
    } catch (err) {
      console.error('Error guardando tipo:', err);
      alert('Error guardando el tipo de equipo.');
    }
  };

  const handleEditTipo = (sistId: string, tipo: SistemaTipo) => {
    setActiveSistemaForTipo(sistId);
    setEditTipoId(tipo.id);
    setTipoNombre(tipo.nombre);
    setIsTipoModalOpen(true);
  };

  const handleDeleteTipo = async (sistId: string, tipoId: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este tipo de equipo?')) return;
    const sistemaActual = sistemas.find(s => s.id === sistId);
    if (!sistemaActual) return;

    const updatedTipos = (sistemaActual.tipos || []).filter(t => t.id !== tipoId);
    try {
      await updateSistemaCategoria(sistId, { tipos: updatedTipos } as any);
      setSistemas(sistemas.map(s => s.id === sistId ? { ...s, tipos: updatedTipos } : s));
    } catch (err) {
      console.error('Error borrando tipo:', err);
      alert('Error eliminando el tipo de equipo.');
    }
  };
  // ------------------------------------

  // ─── GESTION DE PLANTILLAS ────────────────────────────────────────────
  // (gestionada por el componente FormBuilderPlantillas)

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'tecnico' | 'usuario' | 'sistema'; id: string } | null>(null);

  const handleAddTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTecnico.nombre.trim() || !nuevoTecnico.apellidos.trim()) return;
    try {
      const tecExistente = editTecnicoId ? tecnicos.find(t => t.id === editTecnicoId) : null;
      const newTec = {
        id: editTecnicoId || generateId(),
        _docId: tecExistente?._docId,
        nombre: nuevoTecnico.nombre.trim(),
        apellidos: nuevoTecnico.apellidos.trim(),
        habilitacion: nuevoTecnico.habilitacion.trim()
      };
      await saveTecnico(newTec as any);
      setNuevoTecnico({ nombre: '', apellidos: '', habilitacion: '' });
      setEditTecnicoId(null);
    } catch (err) {
      console.error('Error guardando técnico:', err);
      alert('Error al guardar el técnico.');
    }
  };

  const handleEditTecnico = (tec: any) => {
    setEditTecnicoId(tec.id);
    setNuevoTecnico({
      nombre: tec.nombre,
      apellidos: tec.apellidos,
      habilitacion: tec.habilitacion || ''
    });
  };

  const handleCancelEditTecnico = () => {
    setEditTecnicoId(null);
    setNuevoTecnico({ nombre: '', apellidos: '', habilitacion: '' });
  };

  const handleDeleteTecnico = (id: string) => {
    setItemToDelete({ type: 'tecnico', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteTecnico = async () => {
    if (!itemToDelete || itemToDelete.type !== 'tecnico') return;
    setIsConfirmModalOpen(false);
    const tec = tecnicos.find(t => t.id === itemToDelete.id);
    const docId = tec?._docId || itemToDelete.id;
    try {
      await deleteTecnico(docId);
    } catch (err) {
      console.error('Error eliminando técnico:', err);
      alert('Error al eliminar el técnico.');
    }
    setItemToDelete(null);
  };

  const handleResetUsuarios = () => {
    if (!confirm('Estas seguro de que quieres eliminar TODOS los usuarios?')) return;
    setUsuarios([]);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify([]));
  };

  const handleSyncTecnicos = () => {
    const updated = [...usuarios];
    let hasChanges = false;
    tecnicos.forEach(t => {
      if (!updated.some(u => u.nombre === t.nombre && u.apellidos === t.apellidos)) {
        updated.push({ ...t, rol: 'visualizador', password: '' });
        hasChanges = true;
      }
    });
    if (hasChanges) {
      setUsuarios(updated);
      localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
    }
  };

  const handleAddUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuario.nombre.trim() || !nuevoUsuario.apellidos.trim()) return;
    const userData = {
      nombre: nuevoUsuario.nombre.trim(),
      apellidos: nuevoUsuario.apellidos.trim(),
      rol: nuevoUsuario.rol,
      password: nuevoUsuario.password.trim()
    };
    try {
      const savedUser = await addUserToFirestore(userData);
      const localUser: Usuario = {
        id: savedUser.id,
        nombre: savedUser.nombre,
        apellidos: savedUser.apellidos,
        rol: savedUser.rol,
        password: userData.password
      };
      const updated = [...usuarios, localUser];
      setUsuarios(updated);
      localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
      alert(`Usuario "${userData.nombre}" creado correctamente en Firestore`);
    } catch (err) {
      console.error('Error guardando usuario en Firestore:', err);
      alert('Error al crear el usuario en Firestore. Comprueba tu conexion.');
      return;
    }
    setNuevoUsuario({ nombre: '', apellidos: '', rol: 'visualizador', password: '' });
  };

  const handleDeleteUsuario = (id: string) => {
    setItemToDelete({ type: 'usuario', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteUsuario = () => {
    if (!itemToDelete || itemToDelete.type !== 'usuario') return;
    setIsConfirmModalOpen(false);
    const updated = usuarios.filter(u => u.id !== itemToDelete.id);
    setUsuarios(updated);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
    setItemToDelete(null);
  };

  const handleUpdateRol = (id: string, newRol: string) => {
    const updated = usuarios.map(u => u.id === id ? { ...u, rol: newRol } : u);
    setUsuarios(updated);
    localStorage.setItem('firecheck_db_usuarios', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#DCE1E5]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#DCE1E5]/90 backdrop-blur-md border-b border-zinc-200/60">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
          {view !== 'menu' ? (
            <button
              onClick={() => setView('menu')}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Home</span>
            </button>
          )}
          <h1 className="text-lg font-bold text-zinc-900 flex-1 text-center">
            {view === 'menu' ? 'Panel de Configuracion' : view === 'tecnicos' ? 'Gestion de Tecnicos' : view === 'usuarios' ? 'Gestion de Usuarios' : view === 'sistemas' ? 'Gestion de Sistemas' : view === 'plantillas' ? 'Editor de Plantillas' : 'Impuestos'}
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className={`${view === 'plantillas' ? 'w-full' : 'max-w-2xl mx-auto'} p-4 sm:p-6`}>
        {view === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={() => navigate('/configuracion-datos')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Gestion de empresa</p>
                <p className="text-xs text-zinc-500">Datos fiscales, RASIC, logo y firmas.</p>
              </div>
            </button>

            <button
              onClick={() => setView('tecnicos')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Gestion tecnicos</p>
                <p className="text-xs text-zinc-500">Alta de operarios y tecnicos.</p>
              </div>
            </button>

            <button
              onClick={() => setView('usuarios')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Gestion de usuarios</p>
                <p className="text-xs text-zinc-500">Asignar roles y permisos del sistema.</p>
              </div>
            </button>

            <button
              onClick={() => setView('sistemas')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-fuchsia-200 hover:bg-fuchsia-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FireExtinguisher className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Gestion de sistemas</p>
                <p className="text-xs text-zinc-500">Gestion de sistemas contra incendios.</p>
              </div>
            </button>

            <button
              onClick={() => setView('impuestos')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-amber-200 hover:bg-amber-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Impuestos</p>
                <p className="text-xs text-zinc-500">Configuración del IVA y tipos impositivos.</p>
              </div>
            </button>

            <button
              onClick={() => setView('plantillas')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-white hover:border-teal-200 hover:bg-teal-50/50 transition-all text-left group"
            >
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Plantillas</p>
                <p className="text-xs text-zinc-500">Gestión de plantillas de checklists.</p>
              </div>
            </button>
          </div>
        )}

        {view === 'tecnicos' && (
          <section className="space-y-6">
            <form onSubmit={handleAddTecnico} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col gap-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {editTecnicoId ? 'Editar Técnico' : 'Nuevo Tecnico'}
              </p>
              <input
                type="text" required placeholder="Nombre"
                value={nuevoTecnico.nombre}
                onChange={e => setNuevoTecnico({ ...nuevoTecnico, nombre: e.target.value })}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
              />
              <input
                type="text" required placeholder="Apellidos"
                value={nuevoTecnico.apellidos}
                onChange={e => setNuevoTecnico({ ...nuevoTecnico, apellidos: e.target.value })}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
              />
              <input
                type="text" placeholder="Nº Habilitación (opcional)"
                value={nuevoTecnico.habilitacion}
                onChange={e => setNuevoTecnico({ ...nuevoTecnico, habilitacion: e.target.value })}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium flex-1">
                  {editTecnicoId ? (
                    <>
                      <Edit className="w-4 h-4" /> Guardar Cambios
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Anadir Tecnico
                    </>
                  )}
                </button>
                {editTecnicoId && (
                  <button 
                    type="button" 
                    onClick={handleCancelEditTecnico} 
                    className="border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <p className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                Tecnicos registrados ({tecnicos.length})
              </p>
              {tecnicos.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">No hay tecnicos registrados.</div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {tecnicos.map(t => (
                    <li key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-900 text-sm">{t.nombre} {t.apellidos}</span>
                        {t.habilitacion && (
                          <span className="text-xs text-zinc-400 font-semibold mt-0.5">Habilitación nº: {t.habilitacion}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditTecnico(t)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTecnico(t.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {view === 'usuarios' && (
          <section className="space-y-6">
            <form onSubmit={handleAddUsuario} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nuevo Usuario</p>
                <div className="flex gap-3">
                  <button type="button" onClick={handleSyncTecnicos} className="text-[10px] text-indigo-600 hover:underline font-bold uppercase">Vincular Tecnicos</button>
                  <button type="button" onClick={handleResetUsuarios} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Borrar Todo</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" required placeholder="Nombre"
                  value={nuevoUsuario.nombre}
                  onChange={e => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                />
                <input
                  type="text" required placeholder="Apellidos"
                  value={nuevoUsuario.apellidos}
                  onChange={e => setNuevoUsuario({ ...nuevoUsuario, apellidos: e.target.value })}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
                />
              </div>
              <input
                type="text" required placeholder="Contrasena"
                value={nuevoUsuario.password}
                onChange={e => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black"
              />
              <select
                value={nuevoUsuario.rol}
                onChange={e => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black bg-white"
              >
                <option value="super-administrador">Super Administrador</option>
                <option value="administrador">Administrador</option>
                <option value="editor">Editor</option>
                <option value="visualizador">Visualizador</option>
                <option value="tecnico">Técnico</option>
              </select>
              <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
                <Plus className="w-4 h-4" /> Anadir Usuario
              </button>
            </form>

            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <p className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                Usuarios registrados ({usuarios.length})
              </p>
              {usuarios.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">No hay usuarios.</div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {usuarios.map(u => (
                    <li key={u.id} className="p-4 flex flex-col gap-2 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 text-sm">{u.nombre} {u.apellidos}</span>
                        <button onClick={() => handleDeleteUsuario(u.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Rol:</span>
                        <select
                          value={u.rol}
                          onChange={(e) => handleUpdateRol(u.id, e.target.value)}
                          className="text-xs bg-zinc-100 border border-zinc-200 rounded px-2 py-1 outline-none"
                        >
                          <option value="super-administrador">Super Administrador</option>
                          <option value="administrador">Administrador</option>
                          <option value="editor">Editor</option>
                          <option value="visualizador">Visualizador</option>
                          <option value="tecnico">Técnico</option>
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {view === 'sistemas' && (
          <section className="space-y-6">
            {/* Header con acciones */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Sistemas registrados ({sistemas.length})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditSistemaId(null); setSistemaNombre(''); setSistemaImagen(null); setSistemaImagenPreview(null); setIsSistemaModalOpen(true); }}
                  className="flex items-center justify-center gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir
                </button>
              </div>
            </div>

            {/* Lista de sistemas */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              {sistemas.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">No hay sistemas registrados.</div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {sistemas.map(sist => {
                    const isExpanded = expandedSistemaId === sist.id;
                    return (
                    <li key={sist.id} className="flex flex-col border-b border-zinc-100 last:border-b-0">
                      {/* Cabecera del sistema */}
                      <div 
                        className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
                        onClick={() => toggleExpandedSistema(sist.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Imagen del sistema */}
                          <div className="w-12 h-12 flex items-center justify-center shrink-0">
                            {sist.imagenUrl ? (
                              <img src={sist.imagenUrl} alt={sist.nombre} className="w-10 h-10 object-contain" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-fuchsia-50 flex items-center justify-center border border-fuchsia-100">
                                <ImageIcon className="w-5 h-5 text-fuchsia-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 text-sm truncate">{sist.nombre}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {sist.tipos?.length || 0} tipos registrados
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditSistema(sist); }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSistema(sist.id); }}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                        </div>
                      </div>

                      {/* Contenido desplegable: Tipos de equipos */}
                      {isExpanded && (
                        <div className="bg-zinc-50 border-t border-zinc-100 px-6 py-4 pl-20">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Tipos de Equipos</h5>
                            <button
                              onClick={() => { setActiveSistemaForTipo(sist.id); setEditTipoId(null); setTipoNombre(''); setIsTipoModalOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-md text-[11px] font-bold transition-colors shadow-sm"
                            >
                              <Plus className="w-3 h-3" /> Añadir tipo
                            </button>
                          </div>

                          {!sist.tipos || sist.tipos.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic py-3 text-center bg-white rounded-lg border border-dashed border-zinc-200">No hay tipos registrados en este sistema.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {sist.tipos.map(tipo => (
                                <div key={tipo.id} className="flex items-center justify-between px-3 py-2 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">
                                  <span className="text-sm font-semibold text-zinc-700">{tipo.nombre}</span>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleEditTipo(sist.id, tipo)} 
                                      className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" 
                                      title="Editar tipo"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteTipo(sist.id, tipo.id)} 
                                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                                      title="Eliminar tipo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {view === 'impuestos' && (
          <section className="space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6">
              <h2 className="text-lg font-bold text-zinc-900 mb-4">Configuración del IVA</h2>
              <p className="text-sm text-zinc-500 mb-6">Define el porcentaje de IVA que se aplicará por defecto en presupuestos, albaranes y facturas.</p>
              
              <div className="space-y-6">
                {/* IVA General */}
                <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100">
                  <label className="text-sm font-bold text-zinc-800 block mb-3">IVA General</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={impuestosConfig.iva}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                        handleIvaChange(val);
                      }}
                      className="w-24 px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center"
                    />
                    <span className="text-sm font-bold text-zinc-600">%</span>
                    {impuestosStatus === 'saving' && <Loader className="w-4 h-4 text-amber-500 animate-spin" />}
                    {impuestosStatus === 'success' && <span className="text-xs text-emerald-600 font-bold">✓ Guardado</span>}
                    {impuestosStatus === 'error' && <span className="text-xs text-red-600 font-bold">Error</span>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Este porcentaje se usará como valor por defecto al crear nuevos presupuestos, albaranes y facturas.</p>
                </div>

                {/* Exento de IVA */}
                <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-bold text-zinc-800 block mb-1">Exento de IVA (0%)</label>
                      <p className="text-xs text-zinc-500">Cuando se seleccione esta opción en un presupuesto, albarán o factura, se mostrará el texto de exención de IVA por inversión del sujeto pasivo.</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-zinc-100 rounded-lg border border-zinc-200">
                    <p className="text-xs text-zinc-600 italic">
                      "Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === 'plantillas' && (
          <FormBuilderPlantillas />
        )}

      </div>

      {isConfirmModalOpen && itemToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={itemToDelete.type === 'tecnico' ? confirmDeleteTecnico : itemToDelete.type === 'sistema' ? confirmDeleteSistema : confirmDeleteUsuario}
          title="Confirmar Eliminacion"
          message="ATENCION SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS CONFIRMA SU PETICION?"
          confirmText="Si, eliminar"
          cancelText="No, cancelar"
        />
      )}

      {/* MODAL SISTEMA */}
      {isSistemaModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
              <h2 className="text-lg font-bold text-zinc-900">
                {editSistemaId ? 'Editar Sistema' : 'Nuevo Sistema'}
              </h2>
              <button onClick={() => setIsSistemaModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSistema} className="p-6">
              <div className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900">Nombre del Sistema</label>
                  <input
                    required autoFocus type="text" value={sistemaNombre} onChange={e => setSistemaNombre(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all text-zinc-900 uppercase"
                    placeholder="Ej: SISTEMA ROCIADORES"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900">Imagen del Sistema</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-50 border border-fuchsia-200 rounded-xl cursor-pointer hover:bg-fuchsia-100 transition-colors text-sm font-medium text-fuchsia-700">
                      <ImageIcon className="w-4 h-4" />
                      {sistemaImagenPreview ? 'Cambiar imagen' : 'Seleccionar imagen'}
                      <input type="file" accept="image/*" onChange={handleSistemaImagenChange} className="hidden" />
                    </label>
                    {sistemaImagenPreview && (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-200">
                        <img src={sistemaImagenPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setSistemaImagen(null); setSistemaImagenPreview(null); }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsSistemaModalOpen(false)} className="flex-1 px-4 py-2.5 text-zinc-700 bg-zinc-50 hover:bg-zinc-100 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl font-medium transition-colors shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TIPO EQUIPO */}
      {isTipoModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
              <h2 className="text-lg font-bold text-zinc-900">
                {editTipoId ? 'Editar Tipo de Equipo' : 'Nuevo Tipo de Equipo'}
              </h2>
              <button onClick={() => setIsTipoModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTipo} className="p-6">
              <div className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-zinc-900">Nombre del Tipo</label>
                  <input
                    required autoFocus type="text" value={tipoNombre} onChange={e => setTipoNombre(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all text-zinc-900"
                    placeholder="Ej: Polvo ABC 6Kg"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsTipoModalOpen(false)} className="flex-1 px-4 py-2.5 text-zinc-700 bg-zinc-50 hover:bg-zinc-100 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-white bg-black hover:bg-zinc-800 rounded-xl font-medium transition-colors shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
