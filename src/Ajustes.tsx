import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, ShieldCheck, Layers, FireExtinguisher, Plus, Trash2, ArrowLeft, Image as ImageIcon, X, Cloud, Loader
} from 'lucide-react';
import { addUserToFirestore, subscribeSistemasCategorias, addSistemaCategoria, deleteSistemaCategoria, uploadFile } from './firebase';
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

interface SistemaItem {
  id: string;
  nombre: string;
  imagenUrl?: string;
}

export default function Ajustes() {
  const navigate = useNavigate();
  const [view, setView] = useState<'menu' | 'tecnicos' | 'usuarios' | 'sistemas'>('menu');

  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string; apellidos: string }[]>(() => {
    try {
      const stored = localStorage.getItem('firecheck_db_tecnicos');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [nuevoTecnico, setNuevoTecnico] = useState({ nombre: '', apellidos: '' });

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
      if (stored) {
        const parsed = JSON.parse(stored);
        // Add imagenUrl from stored images if present
        const savedImages = localStorage.getItem('firecheck_db_sistemas_imagenes');
        const imagenesMap: Record<string, string> = savedImages ? JSON.parse(savedImages) : {};
        return parsed.map((s: any) => ({
          id: s.id,
          nombre: s.nombre,
          imagenUrl: imagenesMap[s.id] || undefined
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
  const [isSyncingSistemas, setIsSyncingSistemas] = useState(false);
  const [syncSistemasStatus, setSyncSistemasStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Cargar sistemas desde Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeSistemasCategorias((cats) => {
      if (cats.length > 0) {
        const savedImages = localStorage.getItem('firecheck_db_sistemas_imagenes');
        const imagenesMap: Record<string, string> = savedImages ? JSON.parse(savedImages) : {};
        const sistConImagen = cats.map(s => ({
          ...s,
          imagenUrl: imagenesMap[s.id] || undefined
        }));
        setSistemas(sistConImagen);
        localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(cats));
      }
    });
    return () => unsub();
  }, []);

  const handleAddSistema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sistemaNombre.trim()) return;

    const newCat = {
      id: editSistemaId || crypto.randomUUID(),
      nombre: sistemaNombre.toUpperCase()
    };

    try {
      await addSistemaCategoria(newCat);
      
      // Subir imagen si se ha seleccionado
      let imagenUrl: string | undefined = undefined;
      if (sistemaImagen) {
        try {
          const path = `sistemas_imagenes/${newCat.id}_${Date.now()}`;
          imagenUrl = await uploadFile(sistemaImagen, path);
        } catch (err) {
          console.warn('Error al subir imagen:', err);
        }
      }

      // Guardar imagen en localStorage
      if (imagenUrl) {
        const savedImages = localStorage.getItem('firecheck_db_sistemas_imagenes');
        const imagenesMap: Record<string, string> = savedImages ? JSON.parse(savedImages) : {};
        imagenesMap[newCat.id] = imagenUrl;
        localStorage.setItem('firecheck_db_sistemas_imagenes', JSON.stringify(imagenesMap));
      }

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
      localStorage.setItem('firecheck_db_sistemas_categorias', JSON.stringify(updated));
      // Eliminar imagen del mapa
      const savedImages = localStorage.getItem('firecheck_db_sistemas_imagenes');
      if (savedImages) {
        const imagenesMap: Record<string, string> = JSON.parse(savedImages);
        delete imagenesMap[itemToDelete.id];
        localStorage.setItem('firecheck_db_sistemas_imagenes', JSON.stringify(imagenesMap));
      }
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

  const handleSyncSistemasToFirestore = async () => {
    setIsSyncingSistemas(true);
    setSyncSistemasStatus('syncing');
    try {
      for (const sist of sistemas) {
        await addSistemaCategoria({ id: sist.id, nombre: sist.nombre });
      }
      setSyncSistemasStatus('success');
      setTimeout(() => setSyncSistemasStatus('idle'), 3000);
    } catch (e) {
      console.error('Error sincronizando sistemas:', e);
      setSyncSistemasStatus('error');
      setTimeout(() => setSyncSistemasStatus('idle'), 3000);
    } finally {
      setIsSyncingSistemas(false);
    }
  };

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'tecnico' | 'usuario' | 'sistema'; id: string } | null>(null);

  const handleAddTecnico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTecnico.nombre.trim() || !nuevoTecnico.apellidos.trim()) return;
    const newTec = { id: generateId(), nombre: nuevoTecnico.nombre.trim(), apellidos: nuevoTecnico.apellidos.trim() };
    const updated = [...tecnicos, newTec];
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
    setNuevoTecnico({ nombre: '', apellidos: '' });
  };

  const handleDeleteTecnico = (id: string) => {
    setItemToDelete({ type: 'tecnico', id });
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteTecnico = () => {
    if (!itemToDelete || itemToDelete.type !== 'tecnico') return;
    setIsConfirmModalOpen(false);
    const updated = tecnicos.filter(t => t.id !== itemToDelete.id);
    setTecnicos(updated);
    localStorage.setItem('firecheck_db_tecnicos', JSON.stringify(updated));
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
    <div className="min-h-screen bg-[#f8f6f3]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#f8f6f3]/90 backdrop-blur-md border-b border-zinc-200/60">
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
              <span>Inicio</span>
            </button>
          )}
          <h1 className="text-lg font-bold text-zinc-900 flex-1 text-center">
            {view === 'menu' ? 'Panel de Configuracion' : view === 'tecnicos' ? 'Gestion de Tecnicos' : view === 'usuarios' ? 'Gestion de Usuarios' : 'Gestion de Sistemas'}
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6">
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
          </div>
        )}

        {view === 'tecnicos' && (
          <section className="space-y-6">
            <form onSubmit={handleAddTecnico} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col gap-3">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nuevo Tecnico</p>
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
              <button type="submit" className="bg-black hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium">
                <Plus className="w-4 h-4" /> Anadir Tecnico
              </button>
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
                      <span className="font-medium text-zinc-900 text-sm">{t.nombre} {t.apellidos}</span>
                      <button onClick={() => handleDeleteTecnico(t.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                  onClick={handleSyncSistemasToFirestore}
                  disabled={isSyncingSistemas}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    syncSistemasStatus === 'success'
                      ? 'bg-emerald-500 text-white'
                      : syncSistemasStatus === 'error'
                      ? 'bg-red-500 text-white'
                      : 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200'
                  }`}
                >
                  {isSyncingSistemas ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : syncSistemasStatus === 'success' ? (
                    <Cloud className="w-3.5 h-3.5" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  {isSyncingSistemas ? '' : syncSistemasStatus === 'success' ? 'OK' : 'Firebase'}
                </button>
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
                  {sistemas.map(sist => (
                    <li key={sist.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
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
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleEditSistema(sist)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSistema(sist.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
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
    </div>
  );
}
