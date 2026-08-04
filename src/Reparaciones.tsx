import { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  Clock, PauseCircle, User, MapPin, Briefcase, 
  X, Save, ChevronDown, FileText, StickyNote, Bell
} from 'lucide-react';
import { 
  subscribeReparaciones, addReparacion, updateReparacion, deleteReparacion, 
  subscribeTecnicos, subscribeCentros,
  type ReparacionItem 
} from './firebase';

export default function Reparaciones() {
  const [reparaciones, setReparaciones] = useState<ReparacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Listas para desplegables de ayuda
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReparacionItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; docId?: string } | null>(null);

  // Modal rápido de Nota / Notificación
  const [notaModalItem, setNotaModalItem] = useState<ReparacionItem | null>(null);
  const [notaText, setNotaText] = useState('');

  // Formulario de edición/creación
  const [formData, setFormData] = useState({
    reparacion: '',
    lugar: '',
    tecnicoAsignado: '',
    comercial: '',
    estado: 'Pendiente' as 'Pendiente' | 'En curso' | 'Parado' | 'Finalizado',
    observaciones: ''
  });

  // Cargar datos locales y suscribir a Firebase
  useEffect(() => {
    // 1. Cargar desde LocalStorage para acceso instantáneo
    try {
      const saved = localStorage.getItem('firecheck_db_reparaciones');
      if (saved) {
        setReparaciones(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error cargando reparaciones de localStorage:', e);
    }

    // 2. Suscribir a Firebase
    const unsubRep = subscribeReparaciones((items) => {
      setReparaciones(items);
      localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(items));
      setLoading(false);
    });

    const unsubTec = subscribeTecnicos((items) => setTecnicos(items));
    const unsubCen = subscribeCentros((items) => setCentros(items));

    return () => {
      unsubRep();
      unsubTec();
      unsubCen();
    };
  }, []);

  // Guardar en localStorage cuando cambien
  const updateLocalAndState = (newItems: ReparacionItem[]) => {
    setReparaciones(newItems);
    localStorage.setItem('firecheck_db_reparaciones', JSON.stringify(newItems));
  };

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      reparacion: '',
      lugar: '',
      tecnicoAsignado: '',
      comercial: '',
      estado: 'Pendiente',
      observaciones: ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (item: ReparacionItem) => {
    setEditingItem(item);
    setFormData({
      reparacion: item.reparacion || '',
      lugar: item.lugar || '',
      tecnicoAsignado: item.tecnicoAsignado || '',
      comercial: item.comercial || '',
      estado: item.estado || 'Pendiente',
      observaciones: item.nota || item.observaciones || ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para ver / redactar Nota rápida
  const handleOpenNotaModal = (item: ReparacionItem) => {
    setNotaModalItem(item);
    setNotaText(item.nota || item.observaciones || '');
  };

  // Guardar Nota desde modal flotante de notas
  const handleSaveNota = async () => {
    if (!notaModalItem) return;
    const docId = notaModalItem._docId || notaModalItem.id;
    const trimmed = notaText.trim();

    const updatedList = reparaciones.map(r => 
      (r.id === notaModalItem.id || r._docId === notaModalItem._docId)
        ? { ...r, nota: trimmed, observaciones: trimmed }
        : r
    );
    updateLocalAndState(updatedList);

    try {
      await updateReparacion(docId, { nota: trimmed, observaciones: trimmed });
    } catch (err) {
      console.error('Error al guardar nota en Firebase:', err);
    }

    setNotaModalItem(null);
  };

  // Guardar (Crear o Modificar completo)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reparacion.trim()) {
      alert('Por favor, introduce el nombre o descripción de la reparación.');
      return;
    }

    if (editingItem) {
      // Editar
      const docId = editingItem._docId || editingItem.id;
      const updatedItem: Partial<ReparacionItem> = {
        reparacion: formData.reparacion.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim()
      };

      const updatedList = reparaciones.map(r => 
        (r.id === editingItem.id || r._docId === editingItem._docId) ? { ...r, ...updatedItem } : r
      );
      updateLocalAndState(updatedList);

      try {
        await updateReparacion(docId, updatedItem);
      } catch (err) {
        console.error('Error al actualizar reparación en Firebase:', err);
      }
    } else {
      // Crear nuevo
      const newId = `REP-${Date.now().toString().slice(-6)}`;
      const newItem: ReparacionItem = {
        id: newId,
        reparacion: formData.reparacion.trim(),
        lugar: formData.lugar.trim(),
        tecnicoAsignado: formData.tecnicoAsignado.trim(),
        comercial: formData.comercial.trim(),
        estado: formData.estado,
        observaciones: formData.observaciones.trim(),
        nota: formData.observaciones.trim(),
        fechaCreacion: new Date().toISOString()
      };

      const updatedList = [newItem, ...reparaciones];
      updateLocalAndState(updatedList);

      try {
        await addReparacion(newItem);
      } catch (err) {
        console.error('Error al agregar reparación en Firebase:', err);
      }
    }

    setIsModalOpen(false);
  };

  // Eliminar
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const { id, docId } = deleteConfirmId;

    const updatedList = reparaciones.filter(r => r.id !== id && r._docId !== docId);
    updateLocalAndState(updatedList);

    try {
      await deleteReparacion(docId || id);
    } catch (err) {
      console.error('Error al eliminar reparación en Firebase:', err);
    }

    setDeleteConfirmId(null);
  };

  // Filtrado de la lista
  const reparacionesFiltradas = reparaciones.filter(r => {
    if (estadoFilter !== 'TODOS' && r.estado !== estadoFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchRep = (r.reparacion || '').toLowerCase().includes(q);
      const matchLugar = (r.lugar || '').toLowerCase().includes(q);
      const matchTec = (r.tecnicoAsignado || '').toLowerCase().includes(q);
      const matchCom = (r.comercial || '').toLowerCase().includes(q);
      const matchNota = (r.nota || r.observaciones || '').toLowerCase().includes(q);
      return matchRep || matchLugar || matchTec || matchCom || matchNota;
    }
    return true;
  });

  // Estadísticas
  const totalCount = reparaciones.length;
  const pendientesCount = reparaciones.filter(r => r.estado === 'Pendiente').length;
  const enCursoCount = reparaciones.filter(r => r.estado === 'En curso').length;
  const paradosCount = reparaciones.filter(r => r.estado === 'Parado').length;
  const finalizadosCount = reparaciones.filter(r => r.estado === 'Finalizado').length;

  // Renderizador de Insignias de Estado (Colores requeridos)
  const renderEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pendiente
          </span>
        );
      case 'En curso':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            En curso
          </span>
        );
      case 'Parado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]">
            <PauseCircle className="w-3.5 h-3.5 text-red-600" />
            Parado
          </span>
        );
      case 'Finalizado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finalizado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            {estado}
          </span>
        );
    }
  };

  const opcionesEstado = [
    { value: 'TODOS', label: 'Todos los estados', colorClass: '' },
    { value: 'Pendiente', label: 'Pendiente (Gris)', colorClass: 'bg-slate-400' },
    { value: 'En curso', label: 'En curso (Amarillo)', colorClass: 'bg-amber-400' },
    { value: 'Parado', label: 'Parado (Rojo)', colorClass: 'bg-red-500' },
    { value: 'Finalizado', label: 'Finalizado (Verde)', colorClass: 'bg-emerald-500' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm">
              <Wrench className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reparaciones y Averías</h1>
              <p className="text-xs text-slate-500 font-medium">Gestión de tareas de reparación, asignación de técnicos y notas notificables.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nueva Reparación
        </button>
      </div>

      {/* Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tareas</span>
          <span className="text-2xl font-black text-slate-900 mt-2">{totalCount}</span>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pendientes</span>
          <span className="text-2xl font-black text-slate-700 mt-2">{pendientesCount}</span>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">En curso</span>
          <span className="text-2xl font-black text-amber-700 mt-2">{enCursoCount}</span>
        </div>
        <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Parados</span>
          <span className="text-2xl font-black text-red-700 mt-2">{paradosCount}</span>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Finalizados</span>
          <span className="text-2xl font-black text-emerald-700 mt-2">{finalizadosCount}</span>
        </div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por reparación, lugar, técnico o nota..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-slate-50/50"
          />
        </div>

        {/* Dropdown Filtro por Estado */}
        <div className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium flex items-center justify-between gap-3 text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>{opcionesEstado.find(o => o.value === estadoFilter)?.label || 'Todos los estados'}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in duration-150">
              {opcionesEstado.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => {
                    setEstadoFilter(op.value);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
                    estadoFilter === op.value
                      ? 'bg-red-50 text-red-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {op.colorClass ? (
                    <span className={`w-2.5 h-2.5 rounded-full ${op.colorClass}`} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                  )}
                  {op.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">REPARACIÓN</th>
                <th className="px-6 py-4">LUGAR</th>
                <th className="px-6 py-4">TÉCNICO ASIGNADO</th>
                <th className="px-6 py-4">COMERCIAL</th>
                <th className="px-6 py-4">ESTADO</th>
                <th className="px-4 py-4 text-center">NOTA</th>
                <th className="px-6 py-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Cargando tareas de reparación...
                  </td>
                </tr>
              ) : reparacionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No se encontraron tareas de reparación.
                  </td>
                </tr>
              ) : (
                reparacionesFiltradas.map((item) => {
                  const noteContent = (item.nota || item.observaciones || '').trim();
                  const hasNote = noteContent.length > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* REPARACIÓN */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.reparacion || 'Sin título'}</p>
                          </div>
                        </div>
                      </td>

                      {/* LUGAR */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.lugar || '—'}</span>
                        </div>
                      </td>

                      {/* TÉCNICO ASIGNADO */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.tecnicoAsignado || 'Sin asignar'}</span>
                        </div>
                      </td>

                      {/* COMERCIAL */}
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{item.comercial || '—'}</span>
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td className="px-6 py-4">
                        {renderEstadoBadge(item.estado)}
                      </td>

                      {/* NOTA CON ICONO Y NOTIFICACIÓN SI EXISTE */}
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenNotaModal(item)}
                          className={`relative inline-flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer ${
                            hasNote
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm hover:bg-amber-200'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
                          }`}
                          title={hasNote ? `Nota registrada: "${noteContent}" (Clic para abrir)` : 'Añadir nota'}
                        >
                          <StickyNote className={`w-4 h-4 ${hasNote ? 'text-amber-800' : 'text-slate-400'}`} />
                          
                          {/* Insignia / Punto de notificación si hay algo escrito */}
                          {hasNote && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border-2 border-white"></span>
                            </span>
                          )}
                        </button>
                      </td>

                      {/* ACCIONES */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId({ id: item.id, docId: item._docId })}
                            className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FLOTANTE RÁPIDO DE NOTA DE REPARACIÓN */}
      {notaModalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Header modal nota */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="font-extrabold text-base truncate">
                    Nota de Reparación
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{notaModalItem.reparacion || 'Tarea sin título'}</p>
                </div>
              </div>
              <button
                onClick={() => setNotaModalItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido modal nota */}
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>Instrucciones / Observaciones notificables</span>
              </div>

              <textarea
                rows={5}
                autoFocus
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                placeholder="Escribe aquí cualquier nota, aviso o detalle de la reparación..."
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-amber-50/30 text-slate-800 resize-none font-medium"
              />

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                La nota quedará resguardada en el icono con un aviso de notificación encendido.
              </p>

              {/* Botones de acción del modal de notas */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {notaText.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNotaText('');
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Borrar nota
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotaModalItem(null)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNota}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-sm cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Guardar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR COMPLETO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingItem ? 'Editar Reparación' : 'Nueva Reparación'}
                  </h3>
                  <p className="text-xs text-slate-400">Introduce los datos de la tarea de reparación.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 flex flex-col gap-4">
              {/* REPARACIÓN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reparación (Descripción / Tarea) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.reparacion}
                  onChange={(e) => setFormData({ ...formData, reparacion: e.target.value })}
                  placeholder="Ej: Cambio de manómetro en BIE 2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* LUGAR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lugar / Centro / Ubicación
                </label>
                <input
                  type="text"
                  value={formData.lugar}
                  onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                  placeholder="Ej: Centro Comercial Norte - Planta 1"
                  list="centros-list"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <datalist id="centros-list">
                  {centros.map((c: any) => (
                    <option key={c.id} value={c.nombre || c.id} />
                  ))}
                </datalist>
              </div>

              {/* TÉCNICO ASIGNADO Y COMERCIAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Técnico Asignado
                  </label>
                  <input
                    type="text"
                    value={formData.tecnicoAsignado}
                    onChange={(e) => setFormData({ ...formData, tecnicoAsignado: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    list="tecnicos-list"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  <datalist id="tecnicos-list">
                    {tecnicos.map((t: any) => (
                      <option key={t.id || t._docId} value={`${t.nombre} ${t.apellidos}`.trim()} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Comercial
                  </label>
                  <input
                    type="text"
                    value={formData.comercial}
                    onChange={(e) => setFormData({ ...formData, comercial: e.target.value })}
                    placeholder="Ej: Carlos Gómez"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {/* ESTADO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                >
                  <option value="Pendiente">Pendiente (Gris)</option>
                  <option value="En curso">En curso (Amarillo)</option>
                  <option value="Parado">Parado (Rojo)</option>
                  <option value="Finalizado">Finalizado (Verde)</option>
                </select>
              </div>

              {/* NOTA / OBSERVACIONES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  Nota / Observaciones notificables
                </label>
                <textarea
                  rows={2}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Detalles sobre materiales, repuestos o notas que encenderán la notificación..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {editingItem ? 'Guardar Cambios' : 'Crear Reparación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CONFIRMACIÓN */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden text-center animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-sm">
                <Trash2 className="w-7 h-7 stroke-[2.25]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">¿Eliminar reparación?</h3>
              <p className="text-sm text-slate-500 mt-1">Esta acción no se puede deshacer. Se eliminará la tarea de reparación.</p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
