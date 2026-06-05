import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, ShieldCheck, Plus, Trash2, ArrowLeft
} from 'lucide-react';
import { addUserToFirestore } from './firebase';
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

export default function Ajustes() {
  const navigate = useNavigate();
  const [view, setView] = useState<'menu' | 'tecnicos' | 'usuarios'>('menu');

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

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'tecnico' | 'usuario'; id: string } | null>(null);

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
            {view === 'menu' ? 'Panel de Configuracion' : view === 'tecnicos' ? 'Gestion de Tecnicos' : 'Gestion de Usuarios'}
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
      </div>

      {isConfirmModalOpen && itemToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={itemToDelete.type === 'tecnico' ? confirmDeleteTecnico : confirmDeleteUsuario}
          title="Confirmar Eliminacion"
          message="ATENCION SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS CONFIRMA SU PETICION?"
          confirmText="Si, eliminar"
          cancelText="No, cancelar"
        />
      )}
    </div>
  );
}
