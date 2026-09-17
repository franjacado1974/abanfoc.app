import { useState, useEffect } from 'react';
import { 
  Inbox, MessageSquarePlus, AlertTriangle, CheckCircle2, Clock, 
  User, Calendar, Search, Filter, Send, Check, ArrowLeft, Pencil, Trash2, X, MessageSquare,
  Layers, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown
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
import { db } from '../../recursos-compartidos/firebase/firebase';
import ConfirmationModal from '../../recursos-compartidos/ConfirmationModal';
import { APP_VERSION } from '../../recursos-compartidos/types/constants';

export interface BuzonComentario {
  id: string;
  usuario: string;
  texto: string;
  fecha: string;
  hora: string;
}

export interface BuzonVersion {
  id?: string;
  version: string;
  descripcion: string;
  fecha?: string;
  orden?: number;
  usuario?: string;
  createdAt?: any;
  updatedAt?: any;
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
      const raw = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const nombreUsuario = loggedUser 
    ? `${loggedUser.nombre || ''} ${loggedUser.apellidos || ''}`.trim() || loggedUser.nombre || 'Usuario'
    : 'Usuario';

  // Comprobar si el usuario actual es Super Administrador (único con permisos para editar, borrar y cambiar estados)
  const isSuperUser = (() => {
    if (!loggedUser) return true; // En localhost o si no hay sesión restringida, permitir edición para no bloquear al dueño
    const rol = (loggedUser.rol || '').toLowerCase().trim();
    const userStr = (loggedUser.usuario || loggedUser.username || loggedUser.nombre || '').toLowerCase().trim();
    return rol === 'super-administrador' || rol === 'superusuario' || rol === 'superadministrador' || userStr === 'superusuario' || userStr === 'super-administrador';
  })();

  // Estados de los formularios
  const [sugerenciaTitulo, setSugerenciaTitulo] = useState('');
  const [sugerenciaDesc, setSugerenciaDesc] = useState('');
  const [enviandoSugerencia, setEnviandoSugerencia] = useState(false);

  const [errorTitulo, setErrorTitulo] = useState('');
  const [errorDesc, setErrorDesc] = useState('');
  const [enviandoError, setEnviandoError] = useState(false);

  // Utilidades para manejo de fechas en Versiones
  const getTodayInputDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateToInput = (fechaStr?: string): string => {
    if (!fechaStr) return getTodayInputDate();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
    return getTodayInputDate();
  };

  const formatInputToDisplay = (inputDateStr: string): string => {
    if (!inputDateStr) {
      const now = new Date();
      return now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const parts = inputDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return inputDateStr;
  };

  const parseFechaTimestamp = (fechaStr?: string): number => {
    if (!fechaStr) return 0;
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      return new Date(y, m, d).getTime();
    }
    if (fechaStr.includes('-')) {
      return new Date(fechaStr).getTime() || 0;
    }
    return 0;
  };

  // Estados para Versiones
  const [versiones, setVersiones] = useState<BuzonVersion[]>([]);
  const [versionInput, setVersionInput] = useState(APP_VERSION || '');
  const [versionFechaInput, setVersionFechaInput] = useState(getTodayInputDate());
  const [versionDesc, setVersionDesc] = useState('');
  const [enviandoVersion, setEnviandoVersion] = useState(false);
  const [versionEditandoId, setVersionEditandoId] = useState<string | null>(null);
  const [versionAEliminar, setVersionAEliminar] = useState<BuzonVersion | null>(null);

  const [mensajeToast, setMensajeToast] = useState<string | null>(null);

  // Navegación interna entre las 3 tarjetas del buzón
  const [activeSection, setActiveSection] = useState<'menu' | 'sugerencias' | 'fallos' | 'versiones'>('menu');
  const [searchVersionQuery, setSearchVersionQuery] = useState('');

  // Estados del listado e histórico
  const [registros, setRegistros] = useState<BuzonRegistro[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Cargar registros de versiones desde Firestore en tiempo real
  useEffect(() => {
    try {
      const qVersiones = query(collection(db, 'versiones'));
      const unsubVersiones = onSnapshot(qVersiones, (snapshot) => {
        const docs: BuzonVersion[] = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as BuzonVersion));
        setVersiones(docs);
      }, (err) => {
        console.error('Error suscribiendo a versiones:', err);
      });
      return () => unsubVersiones();
    } catch (err) {
      console.error('Error inicializando Firestore versiones query:', err);
    }
  }, []);

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

  // Guardar o actualizar versión en Firestore (Solo Super Administrador)
  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperUser) return;
    if (!versionInput.trim() || !versionDesc.trim()) return;

    setEnviandoVersion(true);
    try {
      const fecha = formatInputToDisplay(versionFechaInput);

      if (versionEditandoId) {
        const docRef = doc(db, 'versiones', versionEditandoId);
        await updateDoc(docRef, {
          version: versionInput.trim(),
          descripcion: versionDesc.trim(),
          fecha,
          updatedAt: serverTimestamp()
        });
        setVersionEditandoId(null);
        setVersionDesc('');
        setVersionInput(APP_VERSION || '');
        setVersionFechaInput(getTodayInputDate());
        showToast('Versión actualizada correctamente');
      } else {
        // Asignar el orden para que quede al inicio
        const nuevaVersionData: Omit<BuzonVersion, 'id'> = {
          version: versionInput.trim(),
          descripcion: versionDesc.trim(),
          fecha,
          orden: 0,
          usuario: nombreUsuario,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Desplazar las existentes un orden hacia abajo
        const batch = versiones.map((item) => {
          if (!item.id) return Promise.resolve();
          const currentOrd = typeof item.orden === 'number' ? item.orden : 0;
          return updateDoc(doc(db, 'versiones', item.id), { orden: currentOrd + 1 });
        });
        await Promise.all(batch);

        await addDoc(collection(db, 'versiones'), nuevaVersionData);
        setVersionDesc('');
        setVersionInput(APP_VERSION || '');
        setVersionFechaInput(getTodayInputDate());
        showToast('¡Versión guardada correctamente!');
      }
    } catch (err) {
      console.error('Error guardando versión:', err);
      alert('No se pudo guardar la versión. Comprueba tu conexión.');
    } finally {
      setEnviandoVersion(false);
    }
  };

  const handleStartEditVersion = (v: BuzonVersion) => {
    if (!isSuperUser) return;
    setVersionEditandoId(v.id || null);
    setVersionInput(v.version || '');
    setVersionDesc(v.descripcion || '');
    setVersionFechaInput(formatDateToInput(v.fecha));
  };

  const handleCancelEditVersion = () => {
    setVersionEditandoId(null);
    setVersionInput(APP_VERSION || '');
    setVersionDesc('');
    setVersionFechaInput(getTodayInputDate());
  };

  const handleConfirmDeleteVersion = async () => {
    if (!versionAEliminar || !versionAEliminar.id || !isSuperUser) return;
    try {
      await deleteDoc(doc(db, 'versiones', versionAEliminar.id));
      showToast('Registro de versión eliminado correctamente');
      if (versionEditandoId === versionAEliminar.id) {
        handleCancelEditVersion();
      }
    } catch (err) {
      console.error('Error eliminando versión:', err);
      alert('No se pudo eliminar el registro de versión.');
    } finally {
      setVersionAEliminar(null);
    }
  };

  // Mover una versión hacia arriba o abajo en la lista
  const handleMoveVersion = async (index: number, direction: 'up' | 'down') => {
    if (!isSuperUser) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= versionesFiltradas.length) return;

    const currentItem = versionesFiltradas[index];
    const targetItem = versionesFiltradas[targetIndex];
    if (!currentItem.id || !targetItem.id) return;

    try {
      const listaActual = [...versionesOrdenadas];
      const idxA = listaActual.findIndex(x => x.id === currentItem.id);
      const idxB = listaActual.findIndex(x => x.id === targetItem.id);
      if (idxA === -1 || idxB === -1) return;

      const temp = listaActual[idxA];
      listaActual[idxA] = listaActual[idxB];
      listaActual[idxB] = temp;

      const updates = listaActual.map((item, idx) => {
        if (!item.id) return Promise.resolve();
        return updateDoc(doc(db, 'versiones', item.id), { orden: idx });
      });

      await Promise.all(updates);
      showToast('Posición actualizada');
    } catch (err) {
      console.error('Error cambiando orden de versión:', err);
      alert('No se pudo cambiar el orden.');
    }
  };

  // Reordenar automáticamente todas las versiones por su fecha (más recientes primero)
  const handleAutoOrdenarPorFecha = async () => {
    if (!isSuperUser || versiones.length < 2) return;
    try {
      const ordenadas = [...versiones].sort((a, b) => {
        const tA = parseFechaTimestamp(a.fecha) || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tB = parseFechaTimestamp(b.fecha) || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tB - tA;
      });

      const batch = ordenadas.map((item, idx) => {
        if (!item.id) return Promise.resolve();
        return updateDoc(doc(db, 'versiones', item.id), { orden: idx });
      });

      await Promise.all(batch);
      showToast('Versiones ordenadas cronológicamente por fecha');
    } catch (err) {
      console.error('Error ordenando versiones por fecha:', err);
      alert('No se pudo reordenar automáticamente.');
    }
  };

  // Guardar resolución y cambio de estado de un registro (Solo Super Administrador)
  const handleSaveResolucion = async (id: string) => {
    if (!id || !isSuperUser) return;
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

  // Eliminar registro (Solo Super Administrador)
  const handleConfirmDelete = async () => {
    if (!registroAEliminar || !registroAEliminar.id || !isSuperUser) return;
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

  // Iniciar edición de un registro (Solo Super Administrador)
  const handleStartEdit = (reg: BuzonRegistro) => {
    if (!isSuperUser) return;
    setRegistroEditando(reg);
    setEditTitulo(reg.titulo || '');
    setEditDescripcion(reg.descripcion || '');
    setEditTipo(reg.tipo);
    setEditEstado(reg.estado);
    setEditResolucion(reg.resolucion || '');
  };

  // Guardar edición completa de un registro (Solo Super Administrador)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registroEditando || !registroEditando.id || !isSuperUser) return;
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

  // Filtrado de registros por sección
  const sugerenciasFiltradas = registros.filter(reg => {
    if (reg.tipo !== 'Sugerencia') return false;
    if (filterEstado !== 'todos' && reg.estado !== filterEstado) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitulo = (reg.titulo || '').toLowerCase().includes(q);
      const matchDesc = (reg.descripcion || '').toLowerCase().includes(q);
      const matchUser = (reg.usuario || '').toLowerCase().includes(q);
      if (!matchTitulo && !matchDesc && !matchUser) return false;
    }
    return true;
  });

  const fallosFiltrados = registros.filter(reg => {
    if (reg.tipo !== 'Error') return false;
    if (filterEstado !== 'todos' && reg.estado !== filterEstado) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitulo = (reg.titulo || '').toLowerCase().includes(q);
      const matchDesc = (reg.descripcion || '').toLowerCase().includes(q);
      const matchUser = (reg.usuario || '').toLowerCase().includes(q);
      if (!matchTitulo && !matchDesc && !matchUser) return false;
    }
    return true;
  });

  const versionesOrdenadas = [...versiones].sort((a, b) => {
    if (typeof a.orden === 'number' && typeof b.orden === 'number') {
      return a.orden - b.orden;
    }
    if (typeof a.orden === 'number') return -1;
    if (typeof b.orden === 'number') return 1;

    const tA = parseFechaTimestamp(a.fecha) || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const tB = parseFechaTimestamp(b.fecha) || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return tB - tA;
  });

  const versionesFiltradas = versionesOrdenadas.filter(v => {
    if (searchVersionQuery.trim() !== '') {
      const q = searchVersionQuery.toLowerCase();
      const matchVer = (v.version || '').toLowerCase().includes(q);
      const matchDesc = (v.descripcion || '').toLowerCase().includes(q);
      const matchFecha = (v.fecha || '').toLowerCase().includes(q);
      if (!matchVer && !matchDesc && !matchFecha) return false;
    }
    return true;
  });

  const sugerenciasCount = registros.filter(r => r.tipo === 'Sugerencia').length;
  const erroresCount = registros.filter(r => r.tipo === 'Error').length;

  // Renderizador de cada consulta (común a Sugerencias y Fallos)
  const renderRegistroItem = (reg: BuzonRegistro) => {
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
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                esError
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'bg-purple-100 text-purple-700 border-purple-200'
              }`}
            >
              {reg.tipo}
            </span>

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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoResolucion}
                onClick={() => handleSaveResolucion(reg.id!)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
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
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Top Bar para técnico / móvil */}
      {isTecnicoMode && (
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (activeSection !== 'menu') {
                setActiveSection('menu');
              } else if (onBack) {
                onBack();
              }
            }}
            className="flex items-center gap-2 text-slate-700 font-bold text-sm cursor-pointer"
          >
            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </span>
            {activeSection !== 'menu' ? 'Menú Buzón' : 'Volver'}
          </button>
          <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-purple-600" /> Buzón
          </h1>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Cabecera Principal y Navegación */}
        {!isTecnicoMode && (
          <div className="mb-8">
            {activeSection === 'menu' ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl shrink-0">
                  <Inbox className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight">Buzón de Comunicaciones</h1>
                  <p className="text-sm font-semibold text-slate-500 mt-0.5">
                    Selecciona una tarjeta para gestionar sugerencias, incidencias técnicas o el historial de versiones
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('menu')}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer active:scale-98 self-start"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                  <span>Volver a las tarjetas del Buzón</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Buzón /</span>
                  <span className="text-xs font-black text-slate-800">
                    {activeSection === 'sugerencias' && 'Sugerencias de Mejora'}
                    {activeSection === 'fallos' && 'Reporte de Fallos'}
                    {activeSection === 'versiones' && 'Control de Versiones'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notificación Toast */}
        {mensajeToast && (
          <div className="mb-6 p-4 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">{mensajeToast}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VISTA 1: LAS 3 TARJETAS PRINCIPALES DEL MENÚ              */}
        {/* ========================================================= */}
        {activeSection === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* TARJETA 1: SUGERENCIAS DE MEJORA */}
            <div
              onClick={() => setActiveSection('sugerencias')}
              className="group bg-white rounded-3xl border-2 border-purple-100 hover:border-purple-300 p-6 sm:p-8 shadow-xl shadow-purple-500/5 hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3.5 bg-purple-50 group-hover:bg-purple-100 text-purple-600 rounded-2xl transition-colors">
                    <MessageSquarePlus className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-purple-100/70 text-purple-800 rounded-full border border-purple-200">
                    {sugerenciasCount} {sugerenciasCount === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-purple-600 transition-colors">
                  Sugerencias de Mejora
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Aporta ideas, propuestas o nuevas funcionalidades para hacer la plataforma más ágil y eficiente.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600">
                <span>Abrir sugerencias</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* TARJETA 2: REPORTE DE FALLOS */}
            <div
              onClick={() => setActiveSection('fallos')}
              className="group bg-white rounded-3xl border-2 border-red-100 hover:border-red-300 p-6 sm:p-8 shadow-xl shadow-red-500/5 hover:shadow-red-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3.5 bg-red-50 group-hover:bg-red-100 text-red-600 rounded-2xl transition-colors">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-red-100/70 text-red-800 rounded-full border border-red-200">
                    {erroresCount} {erroresCount === 1 ? 'incidencia' : 'incidencias'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-red-600 transition-colors">
                  Reporte de Fallos
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Notifica errores, anomalías técnicas o comportamientos inesperados para su resolución inmediata.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-red-600">
                <span>Abrir incidencias</span>
                <div className="w-8 h-8 rounded-xl bg-red-50 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* TARJETA 3: VERSIONES */}
            <div
              onClick={() => setActiveSection('versiones')}
              className="group bg-white rounded-3xl border-2 border-blue-100 hover:border-blue-300 p-6 sm:p-8 shadow-xl shadow-blue-500/5 hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="p-3.5 bg-blue-50 group-hover:bg-blue-100 text-blue-600 rounded-2xl transition-colors">
                    <Layers className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-blue-100/70 text-blue-800 rounded-full border border-blue-200">
                    Versión: {APP_VERSION}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  Versiones
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Registro cronológico y control de cambios de cada actualización del programa y nuevas funciones.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                <span>Ver historial ({versiones.length})</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VISTA 2: CONTENIDO DEDICADO DE SUGERENCIAS DE MEJORA      */}
        {/* ========================================================= */}
        {activeSection === 'sugerencias' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Formulario de Sugerencias */}
            <div className="bg-white rounded-3xl border border-purple-100 p-6 sm:p-8 shadow-xl shadow-purple-500/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <MessageSquarePlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nueva Sugerencia de Mejora</h2>
                  <p className="text-xs text-slate-500">Aporta tus ideas o propuestas de mejora para el programa</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                ¿Tienes alguna idea para hacer la aplicación más fácil o eficiente? Compártela con el equipo.
              </p>

              <form onSubmit={handleSendSugerencia} className="space-y-4">
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
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-200 transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  {enviandoSugerencia ? 'Enviando...' : 'Enviar Sugerencia'}
                </button>
              </form>
            </div>

            {/* Listado de Sugerencias */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Sugerencias</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Propuestas registradas y respuestas del equipo</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-800 rounded-full border border-purple-200 self-start sm:self-auto">
                  {sugerenciasFiltradas.length} {sugerenciasFiltradas.length === 1 ? 'sugerencia' : 'sugerencias'}
                </span>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar sugerencia por título, descripción o autor..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-400 text-slate-800"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={filterEstado}
                    onChange={e => setFilterEstado(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-400 text-slate-800 appearance-none cursor-pointer"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="Pendiente">Pendientes</option>
                    <option value="En revisión">En revisión</option>
                    <option value="Resuelto">Resueltos</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Cargando sugerencias...</div>
              ) : sugerenciasFiltradas.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No hay sugerencias que coincidan con la búsqueda.
                </div>
              ) : (
                <div className="space-y-4">
                  {sugerenciasFiltradas.map(renderRegistroItem)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VISTA 3: CONTENIDO DEDICADO DE REPORTE DE FALLOS          */}
        {/* ========================================================= */}
        {activeSection === 'fallos' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Formulario de Reporte de Fallos */}
            <div className="bg-white rounded-3xl border border-red-100 p-6 sm:p-8 shadow-xl shadow-red-500/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nuevo Reporte de Fallo</h2>
                  <p className="text-xs text-slate-500">Describe anomalías o incidencias técnicas detectadas</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Si algo no funciona correctamente o has detectado un error técnico, infórmalo aquí para solucionarlo.
              </p>

              <form onSubmit={handleSendError} className="space-y-4">
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
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  {enviandoError ? 'Enviando...' : 'Reportar Error'}
                </button>
              </form>
            </div>

            {/* Listado de Fallos */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Fallos e Incidencias</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Incidencias técnicas reportadas y estado de resolución</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-800 rounded-full border border-red-200 self-start sm:self-auto">
                  {fallosFiltrados.length} {fallosFiltrados.length === 1 ? 'incidencia' : 'incidencias'}
                </span>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar fallo por título, descripción o autor..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-400 text-slate-800"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={filterEstado}
                    onChange={e => setFilterEstado(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-400 text-slate-800 appearance-none cursor-pointer"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="Pendiente">Pendientes</option>
                    <option value="En revisión">En revisión</option>
                    <option value="Resuelto">Resueltos</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Cargando incidencias...</div>
              ) : fallosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No hay fallos reportados que coincidan con la búsqueda.
                </div>
              ) : (
                <div className="space-y-4">
                  {fallosFiltrados.map(renderRegistroItem)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VISTA 4: CONTENIDO DEDICADO DE VERSIONES                  */}
        {/* ========================================================= */}
        {activeSection === 'versiones' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Formulario de Versiones (Exclusivo para Super Administrador) */}
            {isSuperUser && (
              <div className="bg-white rounded-3xl border border-blue-100 p-6 sm:p-8 shadow-xl shadow-blue-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        {versionEditandoId ? 'Modificar Registro de Versión' : 'Anotar Nueva Versión'}
                      </h2>
                      <p className="text-xs text-slate-500">Registra y controla los cambios y mejoras de la aplicación</p>
                    </div>
                  </div>
                  <span className="text-xs font-black uppercase px-3 py-1 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 self-start sm:self-auto">
                    Versión actual: {APP_VERSION}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Anota el número de versión y describe las actualizaciones introducidas para realizar un seguimiento continuo del proyecto.
                </p>

                <form onSubmit={handleSaveVersion} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Versión</label>
                      <input
                        type="text"
                        value={versionInput}
                        onChange={e => setVersionInput(e.target.value)}
                        placeholder="Ej. V.17.09.26.L"
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de la versión</label>
                      <input
                        type="date"
                        value={versionFechaInput}
                        onChange={e => setVersionFechaInput(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Descripción de la actualización</label>
                      <input
                        type="text"
                        value={versionDesc}
                        onChange={e => setVersionDesc(e.target.value)}
                        placeholder="Ej. Añadido envío de PDF de albaranes por Gmail y modal de progreso..."
                        required
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={enviandoVersion}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer active:scale-98"
                    >
                      <Check className="w-4 h-4" />
                      {enviandoVersion ? 'Guardando...' : versionEditandoId ? 'Guardar Cambios' : 'Registrar Versión'}
                    </button>
                    {versionEditandoId && (
                      <button
                        type="button"
                        onClick={handleCancelEditVersion}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Tabla con 2 Columnas de Versiones */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Historial de Versiones</h3>
                    <span className="text-[11px] font-black uppercase px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                      Actual: {APP_VERSION}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSuperUser
                      ? 'Control cronológico de versiones y actualizaciones del software'
                      : 'Consulta el registro de versiones y mejoras introducidas en la aplicación'}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isSuperUser && versiones.length > 1 && (
                    <button
                      type="button"
                      onClick={handleAutoOrdenarPorFecha}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer shrink-0"
                      title="Ordenar automáticamente todas las versiones por su fecha (más recientes arriba)"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ordenar por Fecha</span>
                    </button>
                  )}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchVersionQuery}
                      onChange={e => setSearchVersionQuery(e.target.value)}
                      placeholder="Buscar por versión o cambios..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-400 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de 2 Columnas (Versión y Descripción) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-40 sm:w-48">Versión</th>
                      <th className="py-3 px-4">Descripción</th>
                      {isSuperUser && <th className="py-3 px-4 w-32 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {versionesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={isSuperUser ? 3 : 2} className="py-12 text-center text-slate-400 font-medium text-xs">
                          {searchVersionQuery ? 'No se encontraron versiones con esa búsqueda.' : 'No hay versiones registradas aún.'}
                        </td>
                      </tr>
                    ) : (
                      versionesFiltradas.map((v, idx) => (
                        <tr key={v.id} className="hover:bg-blue-50/40 transition-colors group">
                          <td className="py-3 px-4 align-top">
                            <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-black text-xs tracking-tight whitespace-nowrap">
                              {v.version}
                            </span>
                            {v.fecha && (
                              <span className="block text-[11px] text-slate-400 font-medium mt-1 whitespace-nowrap">
                                {v.fecha}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium text-xs whitespace-pre-wrap leading-relaxed align-top">
                            {v.descripcion}
                          </td>
                          {isSuperUser && (
                            <td className="py-3 px-4 text-right align-top">
                              <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveVersion(idx, 'up')}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded-lg transition-colors cursor-pointer"
                                  title="Subir orden"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === versionesFiltradas.length - 1}
                                  onClick={() => handleMoveVersion(idx, 'down')}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded-lg transition-colors cursor-pointer"
                                  title="Bajar orden"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditVersion(v)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar versión y fecha"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVersionAEliminar(v)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar versión"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
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

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR CONSULTA */}
      <ConfirmationModal
        isOpen={!!registroAEliminar}
        onClose={() => setRegistroAEliminar(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Consulta"
        message={`¿Estás seguro de que deseas eliminar la consulta "${registroAEliminar?.titulo}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
      />

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR VERSIÓN */}
      {isSuperUser && (
        <ConfirmationModal
          isOpen={!!versionAEliminar}
          onClose={() => setVersionAEliminar(null)}
          onConfirm={handleConfirmDeleteVersion}
          title="Eliminar Registro de Versión"
          message={`¿Estás seguro de que deseas eliminar el registro de la versión "${versionAEliminar?.version}"? Esta acción no se puede deshacer.`}
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
        />
      )}
    </div>
  );
}
