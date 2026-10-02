import { useState, useEffect, useMemo } from 'react';
import {
  StickyNote, Plus, Search, Eye, Pencil, Trash2,
  User, X, Check, Clock, MapPin, CheckCircle2
} from 'lucide-react';
import {
  subscribeNotasBloc,
  addNotaBloc,
  updateNotaBloc,
  deleteNotaBloc,
  type NotaBlocItem
} from './firebase';

interface NotasProps {
  user?: { nombre: string; apellidos: string; rol: string; usuario?: string } | null;
}

const CATEGORIAS = ['Compras', 'Visitas', 'Presupuestos', 'Varias', 'Completadas'] as const;
type CategoriaNota = typeof CATEGORIAS[number];

const PRIORIDADES = ['Urgente', 'Alta', 'Media', 'Baja'] as const;
type PrioridadNota = typeof PRIORIDADES[number];

const CATEGORIAS_CONFIG: Record<CategoriaNota, { color: string; bgActive: string; badge: string; text: string }> = {
  Compras: {
    color: 'amber',
    bgActive: 'bg-amber-500 text-white shadow-md shadow-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    text: 'text-amber-700'
  },
  Visitas: {
    color: 'blue',
    bgActive: 'bg-blue-600 text-white shadow-md shadow-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    text: 'text-blue-700'
  },
  Presupuestos: {
    color: 'emerald',
    bgActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700'
  },
  Varias: {
    color: 'purple',
    bgActive: 'bg-purple-600 text-white shadow-md shadow-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    text: 'text-purple-700'
  },
  Completadas: {
    color: 'emerald',
    bgActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700'
  }
};

const PRIORIDAD_CONFIG: Record<PrioridadNota, { label: string; badge: string; dot: string }> = {
  Urgente: {
    label: 'Urgente',
    badge: 'bg-red-50 text-red-700 border-red-200/80 font-black',
    dot: 'bg-red-500 animate-pulse'
  },
  Alta: {
    label: 'Alta',
    badge: 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold',
    dot: 'bg-amber-500'
  },
  Media: {
    label: 'Media',
    badge: 'bg-blue-50 text-blue-700 border-blue-200/80 font-bold',
    dot: 'bg-blue-500'
  },
  Baja: {
    label: 'Baja',
    badge: 'bg-slate-50 text-slate-600 border-slate-200/80 font-medium',
    dot: 'bg-slate-400'
  }
};

export default function Notas({ user }: NotasProps) {
  // Estado de notas en tiempo real
  const [notas, setNotas] = useState<NotaBlocItem[]>(() => {
    try {
      const cached = localStorage.getItem('firecheck_db_notas_bloc');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Pestaña activa
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaNota>('Compras');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('Todas');

  // Modales
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [notaEditando, setNotaEditando] = useState<NotaBlocItem | null>(null);
  const [modalVerNota, setModalVerNota] = useState<NotaBlocItem | null>(null);
  const [notaAEliminar, setNotaAEliminar] = useState<NotaBlocItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formLugar, setFormLugar] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [formContenido, setFormContenido] = useState('');
  const [formCategoria, setFormCategoria] = useState<CategoriaNota>('Compras');
  const [formPrioridad, setFormPrioridad] = useState<PrioridadNota>('Media');

  // Obtener nombre del usuario actual
  const currentUserName = useMemo(() => {
    if (user?.nombre) {
      return `${user.nombre} ${user.apellidos || ''}`.trim();
    }
    if (user?.usuario) return user.usuario;
    try {
      const saved = localStorage.getItem('firecheck_logged_user') || sessionStorage.getItem('firecheck_logged_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.nombre) return `${u.nombre} ${u.apellidos || ''}`.trim();
        if (u?.usuario) return u.usuario;
      }
    } catch { /* ignore */ }
    return 'Usuario';
  }, [user]);

  // Suscripción a Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeNotasBloc((items) => {
      setNotas(items);
    });
    return () => unsub();
  }, []);

  // Conteo de notas por categoría
  const countPorCategoria = useMemo(() => {
    const counts: Record<CategoriaNota, number> = {
      Compras: 0,
      Visitas: 0,
      Presupuestos: 0,
      Varias: 0,
      Completadas: 0
    };
    notas.forEach(n => {
      const isComp = n.completada === true || n.categoria === 'Completadas';
      if (isComp) {
        counts['Completadas']++;
      } else if (counts[n.categoria as CategoriaNota] !== undefined) {
        counts[n.categoria as CategoriaNota]++;
      } else {
        counts['Varias']++;
      }
    });
    return counts;
  }, [notas]);

  // Estado para animar el check en verde durante 1 segundo antes de guardar y mover a Completadas
  const [completingIds, setCompletingIds] = useState<Record<string, boolean>>({});

  // Manejar marcar / desmarcar como completada
  const handleToggleCompletada = async (nota: NotaBlocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const docId = nota._docId || nota.id;
    if (!docId) return;

    // Si ya está completada o en la categoría Completadas, reabrirla devolviéndola a su categoría previa
    if (nota.completada || nota.categoria === 'Completadas') {
      const catDestino = (nota.categoriaAnterior as CategoriaNota) || 'Varias';
      try {
        await updateNotaBloc(docId, {
          completada: false,
          completadaPor: '',
          fechaCompletada: '',
          categoria: catDestino
        });
      } catch (err) {
        console.error('Error reabriendo nota:', err);
      }
      return;
    }

    // Si no está completada:
    // 1. Activar inmediatamente el estado visual (icono en verde pulsante)
    setCompletingIds(prev => ({ ...prev, [docId]: true }));

    // 2. Esperar 1 segundo exacto (1000ms) y guardar en la categoría 'Completadas'
    setTimeout(async () => {
      try {
        await updateNotaBloc(docId, {
          completada: true,
          completadaPor: currentUserName,
          fechaCompletada: new Date().toISOString(),
          categoriaAnterior: (nota.categoria as string) || 'Varias',
          categoria: 'Completadas'
        });
      } catch (err) {
        console.error('Error guardando nota completada:', err);
      } finally {
        setCompletingIds(prev => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
      }
    }, 1000);
  };

  // Notas filtradas para la categoría y búsqueda actual
  const notasFiltradas = useMemo(() => {
    return notas
      .filter(n => {
        const isComp = n.completada === true || n.categoria === 'Completadas';

        // Filtrar por categoría activa
        if (categoriaActiva === 'Completadas') {
          if (!isComp) return false;
        } else {
          if (isComp) return false;
          const cat = (n.categoria || 'Varias').toLowerCase();
          if (cat !== categoriaActiva.toLowerCase()) return false;
        }

        // Filtrar por prioridad
        if (filtroPrioridad !== 'Todas' && n.prioridad !== filtroPrioridad) return false;

        // Filtrar por búsqueda
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchLugar = (n.lugar || '').toLowerCase().includes(q);
          const matchMotivo = (n.motivo || '').toLowerCase().includes(q);
          const matchUsuario = (n.usuarioNombre || '').toLowerCase().includes(q);
          const matchCompletadaPor = (n.completadaPor || '').toLowerCase().includes(q);
          const matchContenido = (n.contenido || '').toLowerCase().includes(q);
          if (!matchLugar && !matchMotivo && !matchUsuario && !matchCompletadaPor && !matchContenido) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // En Completadas, ordenar por fecha de finalización descendente
        if (categoriaActiva === 'Completadas') {
          return new Date(b.fechaCompletada || b.fechaActualizacion || b.fechaCreacion || 0).getTime() -
                 new Date(a.fechaCompletada || a.fechaActualizacion || a.fechaCreacion || 0).getTime();
        }
        // Ordenar por prioridad (Urgente > Alta > Media > Baja) y fecha descendente
        const pOrder: Record<string, number> = { Urgente: 4, Alta: 3, Media: 2, Baja: 1 };
        const pDiff = (pOrder[b.prioridad] || 0) - (pOrder[a.prioridad] || 0);
        if (pDiff !== 0) return pDiff;
        return new Date(b.fechaCreacion || 0).getTime() - new Date(a.fechaCreacion || 0).getTime();
      });
  }, [notas, categoriaActiva, filtroPrioridad, searchQuery]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setNotaEditando(null);
    setFormLugar('');
    setFormMotivo('');
    setFormContenido('');
    setFormCategoria(categoriaActiva === 'Completadas' ? 'Varias' : categoriaActiva);
    setFormPrioridad('Media');
    setModalFormOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (nota: NotaBlocItem) => {
    setNotaEditando(nota);
    setFormLugar(nota.lugar || '');
    setFormMotivo(nota.motivo || '');
    setFormContenido(nota.contenido || '');
    setFormCategoria((nota.categoria as CategoriaNota) || 'Varias');
    setFormPrioridad((nota.prioridad as PrioridadNota) || 'Media');
    if (modalVerNota) setModalVerNota(null);
    setModalFormOpen(true);
  };

  // Guardar nota (Crear o Actualizar)
  const handleSaveNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLugar.trim()) {
      alert('Por favor, introduce el lugar de la nota.');
      return;
    }
    if (!formMotivo.trim()) {
      alert('Por favor, introduce el motivo o lo que hay que hacer.');
      return;
    }

    setIsSaving(true);
    try {
      if (notaEditando && (notaEditando._docId || notaEditando.id)) {
        const docId = notaEditando._docId || notaEditando.id!;
        await updateNotaBloc(docId, {
          lugar: formLugar.trim().toUpperCase(),
          motivo: formMotivo.trim(),
          contenido: formContenido.trim(),
          categoria: formCategoria,
          prioridad: formPrioridad,
          usuarioNombre: notaEditando.usuarioNombre || currentUserName,
          completada: formCategoria === 'Completadas' ? true : (notaEditando.completada ?? false),
          completadaPor: formCategoria === 'Completadas' ? (notaEditando.completadaPor || currentUserName) : ((notaEditando.categoria as string) === 'Completadas' ? '' : notaEditando.completadaPor),
          fechaCompletada: formCategoria === 'Completadas' ? (notaEditando.fechaCompletada || new Date().toISOString()) : ((notaEditando.categoria as string) === 'Completadas' ? '' : notaEditando.fechaCompletada),
          categoriaAnterior: notaEditando.categoriaAnterior || ((notaEditando.categoria as string) !== 'Completadas' ? notaEditando.categoria : 'Varias')
        });
      } else {
        await addNotaBloc({
          lugar: formLugar.trim().toUpperCase(),
          motivo: formMotivo.trim(),
          contenido: formContenido.trim(),
          categoria: formCategoria,
          prioridad: formPrioridad,
          usuarioNombre: currentUserName,
          fechaCreacion: new Date().toISOString(),
          completada: formCategoria === 'Completadas',
          completadaPor: formCategoria === 'Completadas' ? currentUserName : undefined,
          fechaCompletada: formCategoria === 'Completadas' ? new Date().toISOString() : undefined,
        });
      }

      setModalFormOpen(false);
      setNotaEditando(null);
    } catch (err) {
      console.error('Error guardando nota:', err);
      alert('Hubo un error al guardar la nota. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar nota
  const handleConfirmDelete = async () => {
    if (!notaAEliminar) return;
    const docId = notaAEliminar._docId || notaAEliminar.id;
    if (!docId) return;

    try {
      await deleteNotaBloc(docId);
      setNotaAEliminar(null);
      if (modalVerNota && (modalVerNota._docId === docId || modalVerNota.id === docId)) {
        setModalVerNota(null);
      }
    } catch (err) {
      console.error('Error eliminando nota:', err);
      alert('Hubo un error al eliminar la nota.');
    }
  };

  // Formatear fecha amigable
  const formatFecha = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${horas}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* CABECERA SUPERIOR */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
            <StickyNote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Bloc de Notas</h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200/70">
                {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Anotaciones y recordatorios compartidos del equipo por categorías.
            </p>
          </div>
        </div>

        {/* ACCIÓN PRINCIPAL */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Nota
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS (CATEGORÍAS) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {CATEGORIAS.map(cat => {
            const isActive = categoriaActiva === cat;
            const count = countPorCategoria[cat] || 0;
            const config = CATEGORIAS_CONFIG[cat];
            const isCompletadas = cat === 'Completadas';

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaActiva(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer select-none shrink-0 ${
                  isActive
                    ? config.bgActive
                    : isCompletadas
                    ? 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {isCompletadas && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                <span>{cat}</span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : config.badge
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO DE PRIORIDAD */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* BUSCADOR */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por lugar, motivo, autor..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* FILTRO PRIORIDAD */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Prioridad:</span>
          {(['Todas', ...PRIORIDADES] as const).map(prio => {
            const isSelected = filtroPrioridad === prio;
            return (
              <button
                key={prio}
                type="button"
                onClick={() => setFiltroPrioridad(prio)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {prio}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTADO DE TARJETAS DE NOTAS */}
      {notasFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
            <StickyNote className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {categoriaActiva === 'Completadas'
              ? 'No hay notas completadas todavía'
              : `No hay notas en la categoría "${categoriaActiva}"`}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery
              ? 'No se encontraron notas que coincidan con la búsqueda introducida.'
              : categoriaActiva === 'Completadas'
              ? 'Cuando marques una nota como completada con el icono del check, se moverá automáticamente aquí indicando quién la finalizó.'
              : 'Añade la primera nota para compras, visitas, presupuestos o asuntos varios.'}
          </p>
          {categoriaActiva !== 'Completadas' && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear nota en {categoriaActiva}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notasFiltradas.map((nota) => {
            const prioConfig = PRIORIDAD_CONFIG[nota.prioridad as PrioridadNota] || PRIORIDAD_CONFIG['Media'];
            const catConfig = CATEGORIAS_CONFIG[nota.categoria as CategoriaNota] || CATEGORIAS_CONFIG['Varias'];
            const docId = nota._docId || nota.id || '';
            const isBeingCompleted = !!completingIds[docId];
            const isCompleted = nota.completada || nota.categoria === 'Completadas';
            const isCheckGreen = isCompleted || isBeingCompleted;

            return (
              <div
                key={docId}
                className={`bg-white rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden ${
                  isBeingCompleted
                    ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20'
                    : isCompleted
                    ? 'border-emerald-200/90 hover:border-emerald-300'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Indicador de categoría (Línea superior delgada) */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-${catConfig.color}-500`} />

                <div>
                  {/* FILA SUPERIOR: BADGE DE PRIORIDAD + ACCIONES */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${prioConfig.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prioConfig.dot}`} />
                      {prioConfig.label}
                    </span>

                    {/* ACCIONES: CHECK COMPLETAR (APAGADO / VERDE), OJO, LÁPIZ, PAPELERA */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* BOTÓN CHECK: Apagado por defecto, Verde al finalizar / completada */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleCompletada(nota, e)}
                        disabled={isBeingCompleted}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isCheckGreen
                            ? 'text-emerald-600 bg-emerald-50 border border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent'
                        } ${isBeingCompleted ? 'scale-110 animate-pulse' : 'hover:scale-105'}`}
                        title={
                          isCompleted
                            ? `Completada por ${nota.completadaPor || 'Usuario'} (Clic para reabrir)`
                            : isBeingCompleted
                            ? 'Finalizando... Guardando en Completadas'
                            : 'Marcar como completada'
                        }
                      >
                        <CheckCircle2 className={`w-4 h-4 transition-transform ${isCheckGreen ? 'stroke-[2.5]' : 'stroke-2'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalVerNota(nota)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Ver nota completa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(nota)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar nota"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotaAEliminar(nota)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 1. LUGAR / TÍTULO (EN MAYÚSCULA Y NEGRITA) */}
                  <h3
                    onClick={() => setModalVerNota(nota)}
                    className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {nota.lugar}
                  </h3>

                  {/* 2. MOTIVO / QUÉ HAY QUE HACER (TONO MÁS SUAVE) */}
                  <p
                    onClick={() => setModalVerNota(nota)}
                    className="text-xs text-slate-600 font-normal leading-relaxed line-clamp-3 mt-1.5 cursor-pointer"
                  >
                    {nota.motivo}
                  </p>
                </div>

                <div>
                  {/* 3. NOMBRE DEL USUARIO QUE REGISTRÓ LA NOTA + FECHA */}
                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 min-w-0" title={`Registrado por: ${nota.usuarioNombre}`}>
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">
                        {nota.usuarioNombre}
                      </span>
                    </div>
                    {nota.fechaCreacion && (
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {nota.fechaCreacion.slice(8, 10)}/{nota.fechaCreacion.slice(5, 7)}
                      </span>
                    )}
                  </div>

                  {/* 4. PIE DE COMPLETADA (SI APLICA O EN ANIMACIÓN DE 1 SEGUNDO) */}
                  {isBeingCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-200 flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Finalizada. Guardando en Completadas...</span>
                    </div>
                  )}

                  {!isBeingCompleted && isCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold bg-emerald-50/70 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                      <span className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Completada por: <strong className="font-black text-emerald-900">{nota.completadaPor || 'Usuario'}</strong></span>
                      </span>
                      {nota.fechaCompletada && (
                        <span className="text-[10px] text-emerald-600 font-normal shrink-0 ml-1">
                          {nota.fechaCompletada.slice(8, 10)}/{nota.fechaCompletada.slice(5, 7)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: CREAR / EDITAR NOTA */}
      {modalFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <StickyNote className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {notaEditando ? 'Editar Nota' : 'Nueva Nota'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveNota} className="p-6 space-y-4">
              {/* Categoría y Prioridad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría / Pestaña <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as CategoriaNota)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prioridad
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {PRIORIDADES.map(prio => {
                      const isSel = formPrioridad === prio;
                      const conf = PRIORIDAD_CONFIG[prio];
                      return (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => setFormPrioridad(prio)}
                          className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all text-center ${
                            isSel
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1. LUGAR (TÍTULO PRINCIPAL) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lugar / Título <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formLugar}
                    onChange={(e) => setFormLugar(e.target.value)}
                    placeholder="Ej. NAVE LOGÍSTICA MERCABARNA..."
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-900 placeholder:normal-case placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Se mostrará en mayúscula y negrita en la tarjeta.
                </span>
              </div>

              {/* 2. MOTIVO / QUÉ HAY QUE HACER */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo o Qué hay que hacer <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Ej. Revisar válvulas de mariposa y tomar medidas de manguera 45mm..."
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Resumen principal visible desde fuera de la tarjeta.
                </span>
              </div>

              {/* DETALLE COMPLETO SIN LÍMITE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detalles y notas adicionales <span className="text-slate-400 font-normal">(sin límite)</span>
                </label>
                <textarea
                  rows={5}
                  value={formContenido}
                  onChange={(e) => setFormContenido(e.target.value)}
                  placeholder="Escribe aquí todas las especificaciones, listados de material, contactos, observaciones o notas extensas..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[120px]"
                />
              </div>

              {/* USUARIO AUTOR (INFORMATIVO) */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Usuario que registra la nota:</span>
                  </div>
                  <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    {notaEditando?.usuarioNombre || currentUserName}
                  </span>
                </div>
                {notaEditando?.completadaPor && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-emerald-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completada por:</span>
                    </div>
                    <span className="font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                      {notaEditando.completadaPor}
                    </span>
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Guardando...' : notaEditando ? 'Guardar Cambios' : 'Registrar Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VER NOTA COMPLETA (OJO) */}
      {modalVerNota && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Cabecera del modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${CATEGORIAS_CONFIG[modalVerNota.categoria as CategoriaNota]?.badge || 'bg-slate-800 text-white'}`}>
                  {modalVerNota.categoria}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${PRIORIDAD_CONFIG[modalVerNota.prioridad as PrioridadNota]?.badge || 'bg-slate-700'}`}>
                  {modalVerNota.prioridad}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalVerNota(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Completo */}
            <div className="p-6 space-y-4">
              {/* BANNER NOTA FINALIZADA / COMPLETADA */}
              {(modalVerNota.completada || modalVerNota.categoria === 'Completadas' || modalVerNota.completadaPor) && (
                <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                          Nota Finalizada
                        </span>
                        {modalVerNota.fechaCompletada && (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatFecha(modalVerNota.fechaCompletada)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        Completada por: <span className="text-emerald-700 font-black">{modalVerNota.completadaPor || 'Usuario'}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleCompletada(modalVerNota, { stopPropagation: () => {} } as any);
                      setModalVerNota(null);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 transition-colors shadow-2xs cursor-pointer shrink-0"
                    title="Devolver a su categoría activa"
                  >
                    Reabrir nota
                  </button>
                </div>
              )}

              {/* LUGAR (MAYÚSCULA Y NEGRITA) */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Lugar
                </span>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {modalVerNota.lugar}
                </h2>
              </div>

              {/* MOTIVO */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Motivo o Qué hay que hacer
                </span>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {modalVerNota.motivo}
                </p>
              </div>

              {/* DETALLES EXTENSOS (SI EXISTEN) */}
              {modalVerNota.contenido && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Detalles y notas adicionales
                  </span>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {modalVerNota.contenido}
                  </div>
                </div>
              )}

              {/* AUTOR Y FECHA */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Registrado por: <strong className="text-slate-800">{modalVerNota.usuarioNombre}</strong></span>
                  </div>
                  {modalVerNota.completadaPor && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completada por: <strong className="text-emerald-800">{modalVerNota.completadaPor}</strong></span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                  {modalVerNota.fechaCreacion && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Creada: {formatFecha(modalVerNota.fechaCreacion)}</span>
                    </div>
                  )}
                  {modalVerNota.fechaCompletada && (
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Finalizada: {formatFecha(modalVerNota.fechaCompletada)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTONES: EDITAR Y CERRAR */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalVerNota(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(modalVerNota)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN */}
      {notaAEliminar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">¿Eliminar esta nota?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se eliminará la nota de <strong className="text-slate-800 uppercase">"{notaAEliminar.lugar}"</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNotaAEliminar(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-200 cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
