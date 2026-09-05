import { useState, useEffect } from 'react';
import { 
  Inbox, MessageSquarePlus, AlertTriangle, CheckCircle2, Clock, 
  User, Calendar, Search, Filter, Send, Check, ArrowLeft, Pencil, Trash2, X, MessageSquare 
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  arrayUnion,
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import ConfirmationModal from './ConfirmationModal';

export interface BuzonComentario {
  id: string;
  usuario: string;
  texto: string;
  fecha: string;
  hora: string;
}

export interface BuzonRegistro {
  id?: string;
  tipo: 'Sugerencia' | 'Error';
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string;
  usuario: string;
  estado: 'Pendiente' | 'En revisión' | 'Resuelto';
  resolucion?: string;
  comentarios?: BuzonComentario[];
  createdAt?: any;
  updatedAt?: any;
}

interface BuzonProps {
  isTecnicoMode?: boolean;
  onBack?: () => void;
}

export default function Buzon({ isTecnicoMode = false, onBack }: BuzonProps) {
  // Marcar como visto el buzon al entrar
  useEffect(() => {
    localStorage.setItem('firecheck_buzon_last_seen', String(Date.now()));
  }, []);
  const loggedUser = (() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      return session ? JSON.parse(session) : null;
    } catch { return null; }
  })();

  const nombreUsuario = loggedUser 
    ? `${loggedUser.nombre || ''} ${loggedUser.apellidos || ''}`.trim() || loggedUser.nombre || 'Usuario'
    : 'Usuario';

  // Comprobar si el usuario actual es Super Usuario / Administrador
  const isSuperUser = (() => {
    if (!loggedUser) return false;
    const rol = (loggedUser.rol || '').toLowerCase();
    const userStr = (loggedUser.usuario || loggedUser.username || loggedUser.nombre || '').toLowerCase();
    return rol === 'super-administrador' || rol === 'superusuario' || rol === 'administrador' || userStr.includes('superusuario') || userStr.includes('admin');
  })();

  // Estados de los formularios
  const [sugerenciaTitulo, setSugerenciaTitulo] = useState('');
  const [sugerenciaDesc, setSugerenciaDesc] = useState('');
  const [enviandoSugerencia, setEnviandoSugerencia] = useState(false);

  const [errorTitulo, setErrorTitulo] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [enviandoError, setEnviandoError] = useState(false);

  const [mensajeToast, setMensajeToast] = useState<string | null>(null);

  // Estados del listado e histórico
  const [registros, setRegistros] = useState<BuzonRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sugerencia' | 'error' | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('todos');

  // Estado para resolver un registro
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [textoResolucion, setTextoResolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<'En revisión' | 'Resuelto'>('Resuelto');
  const [guardandoResolucion, setGuardandoResolucion] = useState(false);

  // Estado para eliminar
  const [registroAEliminar, setRegistroAEliminar] = useState<BuzonRegistro | null>(null);

  // Estado para editar completo
  const [registroEditando, setRegistroEditando] = useState<BuzonRegistro | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editTipo, setEditTipo] = useState<'Sugerencia' | 'Error'>('Sugerencia');
  const [editEstado, setEditEstado] = useState<'Pendiente' | 'En revisión' | 'Resuelto'>('Pendiente');
  const [editResolucion, setEditResolucion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Estado para hilos de comentarios/chat
  const [comentariosTexto, setComentariosTexto] = useState<{ [regId: string]: string }>({});
  const [enviandoComentarioId, setEnviandoComentarioId] = useState<string | null>(null);

  // Cargar registros desde Firestore en tiempo real (ordenados del más reciente al más antiguo)
  useEffect(() => {
    try {
      const q = query(collection(db, 'buzon'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs: BuzonRegistro[] = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as BuzonRegistro));
        setRegistros(docs);
        setLoading(false);
      }, (err) => {
        console.error('Error suscribiendo a buzon:', err);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error('Error inicializando Firestore buzon query:', err);
      setLoading(false);
    }
  }, []);

  const showToast = (msg: string) => {
    setMensajeToast(msg);
    setTimeout(() => setMensajeToast(null), 4000);
  };

  // Enviar Sugerencia
  const handleSendSugerencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sugerenciaTitulo.trim() || !sugerenciaDesc.trim()) return;

    setEnviandoSugerencia(true);
    try {
      const now = new Date();
      const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      const nuevoRegistro: Omit<BuzonRegistro, 'id'> = {
        tipo: 'Sugerencia',
        titulo: sugerenciaTitulo.trim(),
        descripcion: sugerenciaDesc.trim(),
        fecha,
        hora,
        usuario: nombreUsuario,
        estado: 'Pendiente',
        resolucion: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'buzon'), nuevoRegistro);
      setSugerenciaTitulo('');
      setSugerenciaDesc('');
      showToast('¡Sugerencia enviada correctamente!');
    } catch (err) {
      console.error('Error enviando sugerencia:', err);
      alert('No se pudo enviar la sugerencia. Comprueba tu conexión.');
    } finally {
      setEnviandoSugerencia(false);
    }
  };

  // Enviar Reporte de Error
  const handleSendError = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorTitulo.trim() || !errorDesc.trim()) return;

    setEnviandoError(true);
    try {
      const now = new Date();
      const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      const nuevoRegistro: Omit<BuzonRegistro, 'id'> = {
        tipo: 'Error',
        titulo: errorTitulo.trim(),
        descripcion: errorDesc.trim(),
        fecha,
        hora,
        usuario: nombreUsuario,
        estado: 'Pendiente',
        resolucion: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'buzon'), nuevoRegistro);
      setErrorTitulo('');
      setErrorDesc('');
      showToast('¡Reporte de error enviado correctamente!');
    } catch (err) {
      console.error('Error enviando reporte de error:', err);
      alert('No se pudo enviar el reporte de error. Comprueba tu conexión.');
    } finally {
      setEnviandoError(false);
    }
  };

  // Guardar resolución de un registro
  const handleSaveResolucion = async (id: string) => {
    if (!id) return;
    setGuardandoResolucion(true);
    try {
      const docRef = doc(db, 'buzon', id);
      await updateDoc(docRef, {
        estado: nuevoEstado,
        resolucion: textoResolucion.trim(),
        updatedAt: serverTimestamp()
      });
      setResolviendoId(null);
      setTextoResolucion('');
      showToast('Registro actualizado correctamente');
    } catch (err) {
      console.error('Error actualizando resolución:', err);
      alert('Error al guardar la resolución');
    } finally {
      setGuardandoResolucion(false);
    }
  };

  // Eliminar registro
  const handleConfirmDelete = async () => {
    if (!registroAEliminar || !registroAEliminar.id) return;
    try {
      await deleteDoc(doc(db, 'buzon', registroAEliminar.id));
      showToast('Consulta eliminada correctamente');
    } catch (err) {
      console.error('Error eliminando registro del buzón:', err);
      alert('No se pudo eliminar la consulta. Comprueba tu conexión.');
    } finally {
      setRegistroAEliminar(null);
    }
  };

  // Iniciar edición de un registro
  const handleStartEdit = (reg: BuzonRegistro) => {
    setRegistroEditando(reg);
    setEditTitulo(reg.titulo || '');
    setEditDescripcion(reg.descripcion || '');
    setEditTipo(reg.tipo);
    setEditEstado(reg.estado);
    setEditResolucion(reg.resolucion || '');
  };

  // Guardar edición completa de un registro
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registroEditando || !registroEditando.id) return;
    if (!editTitulo.trim() || !editDescripcion.trim()) return;

    setGuardandoEdicion(true);
    try {
      await updateDoc(doc(db, 'buzon', registroEditando.id), {
        titulo: editTitulo.trim(),
        descripcion: editDescripcion.trim(),
        tipo: editTipo,
        estado: editEstado,
        resolucion: editResolucion.trim(),
        updatedAt: serverTimestamp()
      });
      showToast('Consulta actualizada correctamente');
      setRegistroEditando(null);
    } catch (err) {
      console.error('Error actualizando consulta:', err);
      alert('Error al guardar los cambios de la consulta.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Enviar comentario al hilo de conversación (sincronizado con Firebase)
  const handleSendComentario = async (regId: string) => {
    const texto = (comentariosTexto[regId] || '').trim();
    if (!regId || !texto) return;

    setEnviandoComentarioId(regId);
    try {
      const now = new Date();
      const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      const nuevoComentario: BuzonComentario = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        usuario: nombreUsuario,
        texto,
        fecha,
        hora
      };

      const docRef = doc(db, 'buzon', regId);
      await updateDoc(docRef, {
        comentarios: arrayUnion(nuevoComentario),
        updatedAt: serverTimestamp()
      });

      setComentariosTexto(prev => ({ ...prev, [regId]: '' }));
      showToast('Comentario añadido a la conversación');
    } catch (err) {
      console.error('Error al enviar comentario:', err);
      alert('No se pudo enviar el comentario. Inténtalo de nuevo.');
    } finally {
      setEnviandoComentarioId(null);
    }
  };

  // Filtrado de registros
  const registrosFiltrados = registros.filter(reg => {
    // Filtro por pestaña
    if (activeTab === 'sugerencia' && reg.tipo !== 'Sugerencia') return false;
    if (activeTab === 'error' && reg.tipo !== 'Error') return false;

    // Filtro por estado
    if (filterEstado !== 'todos' && reg.estado !== filterEstado) return false;

    // Filtro por búsqueda de texto
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitulo = (reg.titulo || '').toLowerCase().includes(q);
      const matchDesc = (reg.descripcion || '').toLowerCase().includes(q);
      const matchUser = (reg.usuario || '').toLowerCase().includes(q);
      if (!matchTitulo && !matchDesc && !matchUser) return false;
    }

    return true;
  });

  const sugerenciasCount = registros.filter(r => r.tipo === 'Sugerencia').length;
  const erroresCount = registros.filter(r => r.tipo === 'Error').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Top Bar para técnico / móvil */}
      {isTecnicoMode && (
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-slate-700 font-bold text-sm"
          >
            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </span>
            Volver
          </button>
          <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-purple-600" /> Buzón
          </h1>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Cabecera Principal */}
        {!isTecnicoMode && (
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl shrink-0">
              <Inbox className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">Buzón de Comunicaciones</h1>
              <p className="text-sm font-semibold text-slate-500 mt-0.5">
                Envía tus sugerencias o reporta incidencias detectadas para mejorar la plataforma
              </p>
            </div>
          </div>
        )}

        {/* Notificación Toast */}
        {mensajeToast && (
          <div className="mb-6 p-4 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">{mensajeToast}</span>
          </div>
        )}

        {/* BLOQUE DE FORMULARIOS: 2 SECCIONES CLARAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          
          {/* SECCIÓN 1: SUGERENCIAS */}
          <div className="bg-white rounded-3xl border border-purple-100 p-5 sm:p-6 shadow-xl shadow-purple-500/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <MessageSquarePlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Sugerencias de Mejora</h2>
                  <p className="text-xs text-slate-500">Aporta tus ideas o propuestas de mejora</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                ¿Tienes alguna idea para hacer la aplicación más fácil o eficiente? Compártela con el equipo.
              </p>

              <form onSubmit={handleSendSugerencia} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título de la sugerencia</label>
                  <input
                    type="text"
                    value={sugerenciaTitulo}
                    onChange={e => setSugerenciaTitulo(e.target.value)}
                    placeholder="Ej. Añadir botón rápido para copiar..."
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Detalle de la sugerencia</label>
                  <textarea
                    value={sugerenciaDesc}
                    onChange={e => setSugerenciaDesc(e.target.value)}
                    placeholder="Describe en detalle tu propuesta..."
                    rows={3}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviandoSugerencia}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-200 transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  {enviandoSugerencia ? 'Enviando...' : 'Enviar Sugerencia'}
                </button>
              </form>
            </div>
          </div>

          {/* SECCIÓN 2: ERRORES DETECTADOS */}
          <div className="bg-white rounded-3xl border border-red-100 p-5 sm:p-6 shadow-xl shadow-red-500/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Reporte de Fallos</h2>
                  <p className="text-xs text-slate-500">Describe fallos o comportamientos anómalos</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Si algo no funciona correctamente o has detectado un error técnico, infórmalo aquí para solucionarlo.
              </p>

              <form onSubmit={handleSendError} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título del fallo o error</label>
                  <input
                    type="text"
                    value={errorTitulo}
                    onChange={e => setErrorTitulo(e.target.value)}
                    placeholder="Ej. El botón de firma no guarda..."
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descripción detallada del problema</label>
                  <textarea
                    value={errorDesc}
                    onChange={e => setErrorDesc(e.target.value)}
                    placeholder="Explica qué estabas haciendo y qué fallo ocurrió..."
                    rows={3}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviandoError}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  {enviandoError ? 'Enviando...' : 'Reportar Error'}
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* SECCIÓN DE HISTÓRICO Y CONSULTA CON PESTAÑAS Y FILTROS PREPARADOS */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Mensajes</h2>
              <p className="text-xs text-slate-500 mt-0.5">Consulta de sugerencias y errores registrados por el equipo</p>
            </div>

            {/* PESTAÑAS (TABS) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('todos')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'todos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({registros.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sugerencia')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'sugerencia'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sugerencias ({sugerenciasCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('error')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'error'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Errores ({erroresCount})
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS PREPARADA (BÚSQUEDA Y ESTADO) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, contenido o usuario..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-400 text-slate-800"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <select
                value={filterEstado}
                onChange={e => setFilterEstado(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-400 text-slate-800 appearance-none cursor-pointer"
              >
                <option value="todos">Todos los estados</option>
                <option value="Pendiente">Pendientes</option>
                <option value="En revisión">En revisión</option>
                <option value="Resuelto">Resueltos</option>
              </select>
            </div>
          </div>

          {/* LISTA DE REGISTROS */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Cargando buzón...</div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              No hay registros que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="space-y-4">
              {registrosFiltrados.map((reg) => {
                const esError = reg.tipo === 'Error';
                const isResolviendo = resolviendoId === reg.id;

                return (
                  <div
                    key={reg.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      esError
                        ? 'bg-red-50/30 border-red-100 hover:border-red-200'
                        : 'bg-purple-50/30 border-purple-100 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Badge de Tipo */}
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                            esError
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-purple-100 text-purple-700 border-purple-200'
                          }`}
                        >
                          {reg.tipo}
                        </span>

                        {/* Badge de Estado */}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                            reg.estado === 'Resuelto'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : reg.estado === 'En revisión'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {reg.estado}
                        </span>
                      </div>

                      {/* Acciones para resolver, editar o eliminar (Solo visibles para Super Usuario / Admin) */}
                      {reg.id && (
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          {isSuperUser && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(reg)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                                title="Editar consulta y estado"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRegistroAEliminar(reg)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                                title="Eliminar consulta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {isSuperUser && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isResolviendo) {
                                  setResolviendoId(null);
                                } else {
                                  setResolviendoId(reg.id || null);
                                  setTextoResolucion(reg.resolucion || '');
                                  setNuevoEstado(reg.estado === 'Resuelto' ? 'Resuelto' : 'Resuelto');
                                }
                              }}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900 underline ml-1 cursor-pointer"
                            >
                              {isResolviendo ? 'Cancelar' : reg.resolucion ? 'Editar resolución' : 'Resolver / Responder'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 mb-1">{reg.titulo}</h3>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mb-3">{reg.descripcion}</p>

                    {/* BLOQUE DE RESOLUCIÓN SI EXISTE */}
                    {reg.resolucion && !isResolviendo && (
                      <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Resolución / Respuesta:
                        </div>
                        <p className="whitespace-pre-wrap">{reg.resolucion}</p>
                      </div>
                    )}

                    {/* FORMULARIO DE RESOLUCIÓN */}
                    {isResolviendo && reg.id && (
                      <div className="mt-3 p-4 bg-white border border-slate-300 rounded-xl space-y-3 animate-in fade-in duration-200">
                        <h4 className="text-xs font-bold text-slate-800">Actualizar Estado y Resolución</h4>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Estado</label>
                          <select
                            value={nuevoEstado}
                            onChange={e => setNuevoEstado(e.target.value as any)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                          >
                            <option value="En revisión">En revisión</option>
                            <option value="Resuelto">Resuelto</option>
                            <option value="Pendiente">Pendiente</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Comentario de Resolución</label>
                          <textarea
                            value={textoResolucion}
                            onChange={e => setTextoResolucion(e.target.value)}
                            placeholder="Escribe cómo se ha resuelto o la respuesta dada..."
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setResolviendoId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={guardandoResolucion}
                            onClick={() => handleSaveResolucion(reg.id!)}
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Guardar Resolución
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SECCIÓN DE HILO DE CONVERSACIÓN / CHAT MULTIUSUARIO */}
                    <div className="mt-4 pt-3 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                          <span>Conversación ({reg.comentarios?.length || 0})</span>
                        </div>
                      </div>

                      {/* LISTA DE MENSAJES DE LA CONVERSACIÓN */}
                      {reg.comentarios && reg.comentarios.length > 0 && (
                        <div className="space-y-2 mb-3 max-h-60 overflow-y-auto pr-1">
                          {reg.comentarios.map((c, cIdx) => {
                            const esMiMensaje = c.usuario === nombreUsuario;
                            return (
                              <div
                                key={c.id || cIdx}
                                className={`p-2.5 rounded-xl text-xs ${
                                  esMiMensaje
                                    ? 'bg-purple-100/80 border border-purple-200/80 ml-4'
                                    : 'bg-white border border-slate-200 mr-4'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-extrabold text-slate-900 text-[11px] flex items-center gap-1">
                                    <User className="w-3 h-3 text-purple-600 shrink-0" />
                                    {c.usuario}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {c.fecha} {c.hora}
                                  </span>
                                </div>
                                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{c.texto}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* INPUT PARA RESPONDER / COMENTAR EN TIEMPO REAL */}
                      {reg.id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendComentario(reg.id!);
                          }}
                          className="flex items-center gap-2 mt-2"
                        >
                          <input
                            type="text"
                            value={comentariosTexto[reg.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComentariosTexto(prev => ({ ...prev, [reg.id!]: val }));
                            }}
                            placeholder="Escribe una respuesta o comentario..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          />
                          <button
                            type="submit"
                            disabled={!comentariosTexto[reg.id]?.trim() || enviandoComentarioId === reg.id}
                            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Responder</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {/* PIE DE REGISTRO */}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{reg.usuario || 'Anónimo'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> {reg.fecha}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {reg.hora}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE EDICIÓN DE CONSULTA */}
      {registroEditando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-purple-600" /> Editar Consulta del Buzón
              </h2>
              <button
                type="button"
                onClick={() => setRegistroEditando(null)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de consulta</label>
                  <select
                    value={editTipo}
                    onChange={e => setEditTipo(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Sugerencia">Sugerencia</option>
                    <option value="Error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                  <select
                    value={editEstado}
                    onChange={e => setEditEstado(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En revisión">En revisión</option>
                    <option value="Resuelto">Resuelto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={editDescripcion}
                  onChange={e => setEditDescripcion(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Respuesta / Resolución</label>
                <textarea
                  value={editResolucion}
                  onChange={e => setEditResolucion(e.target.value)}
                  placeholder="Opcional. Escribe la respuesta o resolución..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegistroEditando(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      <ConfirmationModal
        isOpen={!!registroAEliminar}
        onClose={() => setRegistroAEliminar(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Consulta"
        message={`¿Estás seguro de que deseas eliminar la consulta "${registroAEliminar?.titulo}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
