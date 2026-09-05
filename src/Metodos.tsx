import { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Play, Search, Video, 
  HelpCircle, Tablet, Wrench, FileCheck, 
  ReceiptText, Sparkles, ExternalLink, Plus,
  Edit, Trash2, X, Save
} from 'lucide-react';
import { 
  collection, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, query, orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

export interface VideoTutorial {
  id: string;
  _docId?: string;
  titulo: string;
  descripcion: string;
  categoria: 'general' | 'tablet' | 'mantenimientos' | 'operaciones' | 'documentos';
  duracion: string;
  videoUrl?: string;
  destacado?: boolean;
  fechaCreacion?: string;
}

const TUTORIALES_BASE: VideoTutorial[] = [
  {
    id: 'intro-app',
    titulo: 'Introducción General a Salamandra',
    descripcion: 'Recorrido completo por la plataforma de escritorio: clientes, centros, navegación y flujo de trabajo.',
    categoria: 'general',
    duracion: '5:20 min',
    destacado: true
  },
  {
    id: 'tablet-revisiones',
    titulo: 'Uso de la App Móvil / Tablet en Cliente',
    descripcion: 'Cómo el técnico recibe los partes, realiza el checklist en tiempo real, registra anomalías y recoge firmas.',
    categoria: 'tablet',
    duracion: '8:45 min',
    destacado: true
  },
  {
    id: 'partes-trabajo',
    titulo: 'Gestión y Planificación de Partes',
    descripcion: 'Creación de partes de trabajo, asignación de fechas de revisión periódicas y seguimiento de estados.',
    categoria: 'mantenimientos',
    duracion: '6:15 min'
  },
  {
    id: 'reparaciones-instalaciones',
    titulo: 'Módulo de Reparaciones e Instalaciones',
    descripcion: 'Control mensual de averías, notas rápidas notificables y conversión directa de tareas a albaranes.',
    categoria: 'operaciones',
    duracion: '7:10 min'
  },
  {
    id: 'albaranes-facturacion',
    titulo: 'Albaranes, Certificados y Facturación',
    descripcion: 'Generación de documentos PDF oficiales, actas de revisión, certificados favorables y estado de facturación.',
    categoria: 'documentos',
    duracion: '9:30 min'
  },
  {
    id: 'pruebas-tecnicas',
    titulo: 'Ensayos Hidráulicos y Curva P - Q',
    descripcion: 'Registro de mediciones de presión estática, caudal simultáneo en BIEs/Hidrantes y cálculo normativo UNE.',
    categoria: 'operaciones',
    duracion: '6:50 min'
  }
];

export default function Metodos() {
  const [tutoriales, setTutoriales] = useState<VideoTutorial[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todos');

  // Modales
  const [selectedVideo, setSelectedVideo] = useState<VideoTutorial | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VideoTutorial | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<VideoTutorial | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'general' as VideoTutorial['categoria'],
    duracion: '',
    videoUrl: '',
    destacado: false
  });

  // Obtener rol del usuario activo
  const userRole = useMemo(() => {
    try {
      const stored = sessionStorage.getItem('firecheck_logged_user') || localStorage.getItem('firecheck_logged_user');
      if (stored) {
        const u = JSON.parse(stored);
        const r = (u.rol || '').toLowerCase().trim();
        if (r === 'admin' || r === 'administracion' || r === 'administración') return 'administrador';
        if (r === 'superusuario' || r === 'superadministrador' || r === 'super-administrador') return 'super-administrador';
        return r;
      }
    } catch {}
    return 'visualizador';
  }, []);

  const canManage = ['super-administrador', 'administrador', 'editor'].includes(userRole);

  // 1. Carga inicial local y suscripción en tiempo real a Firebase
  useEffect(() => {
    try {
      const saved = localStorage.getItem('firecheck_db_tutoriales_metodos');
      if (saved) {
        setTutoriales(JSON.parse(saved));
      } else {
        setTutoriales(TUTORIALES_BASE);
      }
    } catch (e) {
      console.warn('Error cargando tutoriales de localStorage:', e);
      setTutoriales(TUTORIALES_BASE);
    }

    const q = query(collection(db, 'tutoriales_metodos'), orderBy('fechaCreacion', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const remoteItems: VideoTutorial[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: data.id || docSnap.id,
            _docId: docSnap.id,
            titulo: data.titulo || '',
            descripcion: data.descripcion || '',
            categoria: data.categoria || 'general',
            duracion: data.duracion || '0:00 min',
            videoUrl: data.videoUrl || '',
            destacado: !!data.destacado,
            fechaCreacion: data.fechaCreacion || new Date().toISOString()
          };
        });
        setTutoriales(remoteItems);
        localStorage.setItem('firecheck_db_tutoriales_metodos', JSON.stringify(remoteItems));
      } else {
        // Si está vacía en Firestore, precargar tutoriales base
        TUTORIALES_BASE.forEach(async (base) => {
          try {
            await addDoc(collection(db, 'tutoriales_metodos'), {
              ...base,
              fechaCreacion: new Date().toISOString()
            });
          } catch {}
        });
      }
    }, (err) => {
      console.warn('Error escuchando tutoriales en Firestore:', err);
    });

    return () => unsub();
  }, []);

  const updateLocalState = (items: VideoTutorial[]) => {
    setTutoriales(items);
    localStorage.setItem('firecheck_db_tutoriales_metodos', JSON.stringify(items));
  };

  const categorias = [
    { id: 'todos', label: 'Todos los tutoriales' },
    { id: 'general', label: 'General' },
    { id: 'tablet', label: 'App Tablet / Móvil' },
    { id: 'mantenimientos', label: 'Mantenimientos' },
    { id: 'operaciones', label: 'Operaciones' },
    { id: 'documentos', label: 'Documentos' },
  ];

  const getCategoriaIcon = (cat: VideoTutorial['categoria']) => {
    switch (cat) {
      case 'general': return Sparkles;
      case 'tablet': return Tablet;
      case 'mantenimientos': return FileCheck;
      case 'operaciones': return Wrench;
      case 'documentos': return ReceiptText;
      default: return Video;
    }
  };

  // Convertir URL de video a reproductor embebido (YouTube, Vimeo, Drive, OneDrive, Directo)
  const getEmbedInfo = (url?: string): { type: 'youtube' | 'vimeo' | 'drive' | 'onedrive' | 'direct' | 'none'; src: string } => {
    if (!url || !url.trim()) return { type: 'none', src: '' };
    const trimmed = url.trim();

    // YouTube (incluyendo shorts, youtu.be, embed, watch)
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0` };
    }

    // Vimeo
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|)(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
    }

    // Google Drive
    if (trimmed.includes('drive.google.com')) {
      const driveSrc = trimmed.replace(/\/view(\?.*)?$/, '/preview');
      return { type: 'drive', src: driveSrc };
    }

    // OneDrive / SharePoint
    if (trimmed.includes('1drv.ms') || trimmed.includes('onedrive.live.com') || trimmed.includes('sharepoint.com')) {
      return { type: 'onedrive', src: trimmed };
    }

    // Direct video file (mp4, webm, etc.) o Firebase Storage
    if (trimmed.match(/\.(mp4|webm|ogg)($|\?)/i) || trimmed.includes('firebasestorage.googleapis.com')) {
      return { type: 'direct', src: trimmed };
    }

    return { type: 'direct', src: trimmed };
  };

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      titulo: '',
      descripcion: '',
      categoria: 'general',
      duracion: '5:00 min',
      videoUrl: '',
      destacado: false
    });
    setIsFormModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (item: VideoTutorial) => {
    setEditingItem(item);
    setFormData({
      titulo: item.titulo,
      descripcion: item.descripcion,
      categoria: item.categoria,
      duracion: item.duracion,
      videoUrl: item.videoUrl || '',
      destacado: !!item.destacado
    });
    setIsFormModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      alert('Por favor introduce el título del video o tutorial.');
      return;
    }

    if (editingItem) {
      // Editar
      const updatedFields: Partial<VideoTutorial> = {
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: formData.categoria,
        duracion: formData.duracion.trim() || '0:00 min',
        videoUrl: formData.videoUrl.trim(),
        destacado: formData.destacado
      };

      const updatedList = tutoriales.map(t => 
        (t.id === editingItem.id || t._docId === editingItem._docId)
          ? { ...t, ...updatedFields }
          : t
      );
      updateLocalState(updatedList);

      try {
        if (editingItem._docId) {
          await updateDoc(doc(db, 'tutoriales_metodos', editingItem._docId), updatedFields);
        }
      } catch (err) {
        console.error('Error al actualizar tutorial en Firebase:', err);
      }
    } else {
      // Crear nuevo
      const newId = `TUT-${Date.now().toString().slice(-6)}`;
      const newItem: VideoTutorial = {
        id: newId,
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: formData.categoria,
        duracion: formData.duracion.trim() || '5:00 min',
        videoUrl: formData.videoUrl.trim(),
        destacado: formData.destacado,
        fechaCreacion: new Date().toISOString()
      };

      const updatedList = [newItem, ...tutoriales];
      updateLocalState(updatedList);

      try {
        const docRef = await addDoc(collection(db, 'tutoriales_metodos'), newItem);
        newItem._docId = docRef.id;
      } catch (err) {
        console.error('Error al agregar tutorial en Firebase:', err);
      }
    }

    setIsFormModalOpen(false);
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const { id, _docId } = deleteConfirmItem;

    const updatedList = tutoriales.filter(t => t.id !== id && t._docId !== _docId);
    updateLocalState(updatedList);

    try {
      if (_docId) {
        await deleteDoc(doc(db, 'tutoriales_metodos', _docId));
      }
    } catch (err) {
      console.error('Error al eliminar tutorial en Firebase:', err);
    }

    setDeleteConfirmItem(null);
  };

  // Filtrado de tutoriales
  const tutorialesFiltrados = tutoriales.filter((item) => {
    if (activeCategory !== 'todos' && item.categoria !== activeCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.titulo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tutorialDestacado = tutoriales.find(t => t.destacado) || tutoriales[0];

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-600 shadow-sm shrink-0">
            <GraduationCap className="w-6 h-6 stroke-[2.25]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tutoriales</h1>
            <p className="text-xs text-slate-500 font-medium">
              Videos formativos, guías paso a paso y mejores prácticas de uso de Salamandra.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Añadir Video / Tutorial</span>
          </button>
        )}
      </div>

      {/* Banner Destacado Superior */}
      {tutorialDestacado && (
        <div className="bg-gradient-to-r from-zinc-950 via-slate-900 to-zinc-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden border border-zinc-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Centro de Aprendizaje Salamandra
            </span>
            <h2 className="text-xl sm:text-2xl font-black mb-2">{tutorialDestacado.titulo}</h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {tutorialDestacado.descripcion}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedVideo(tutorialDestacado)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Reproducir Video Destacado ({tutorialDestacado.duracion})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buscador y Filtros por Categoría */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tutorial por título o tema..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Tarjetas de Video / Tutoriales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorialesFiltrados.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No se encontraron videos o tutoriales con los filtros aplicados.</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda o añade un nuevo tutorial.</p>
          </div>
        ) : (
          tutorialesFiltrados.map((item) => {
            const IconComponent = getCategoriaIcon(item.categoria);
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Cabecera de la tarjeta con miniatura interactiva */}
                  <div 
                    onClick={() => setSelectedVideo(item)}
                    className="h-44 bg-gradient-to-br from-slate-900 to-zinc-900 relative flex items-center justify-center cursor-pointer overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[11px] font-bold text-white">
                      {item.duracion}
                    </span>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-red-600/90 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {item.categoria}
                    </span>
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1">{item.titulo}</h3>
                      </div>

                      {/* Botones de gestión (Editar / Eliminar) */}
                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Editar tutorial"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar tutorial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {item.descripcion}
                    </p>
                  </div>
                </div>

                {/* Pie de la tarjeta */}
                <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {item.videoUrl ? 'Enlace configurado' : 'Video informativo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedVideo(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <span>Ver Tutorial</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL REPRODUCTOR DE VIDEO */}
      {selectedVideo && (() => {
        const embed = getEmbedInfo(selectedVideo.videoUrl);
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header del modal reproductor */}
              <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                    <Play className="w-4 h-4 fill-red-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">{selectedVideo.titulo}</h3>
                    <p className="text-[11px] text-zinc-400">{selectedVideo.categoria.toUpperCase()} • {selectedVideo.duracion}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVideo(null)}
                  className="text-zinc-400 hover:text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenedor del reproductor */}
              <div className="bg-black flex flex-col items-center justify-center">
                {embed.type === 'youtube' || embed.type === 'vimeo' || embed.type === 'drive' ? (
                  <div className="w-full aspect-video">
                    <iframe
                      src={embed.src}
                      title={selectedVideo.titulo}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : embed.type === 'onedrive' ? (
                  <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[360px] bg-gradient-to-b from-zinc-950 to-zinc-900 w-full">
                    <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 shadow-2xl">
                      <Play className="w-10 h-10 fill-blue-500 text-blue-500 ml-1" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
                      Video Alojado en Microsoft OneDrive
                    </span>
                    <h4 className="text-xl font-black text-white mb-2">{selectedVideo.titulo}</h4>
                    <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
                      {selectedVideo.descripcion || 'Video tutorial formativo alojado en OneDrive.'}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <a
                        href={embed.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span>Abrir y Reproducir en OneDrive</span>
                      </a>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-4 max-w-sm">
                      Microsoft OneDrive protege los enlaces de compartición privada bloqueando la incrustación directa en otras webs por seguridad, pero puedes reproducirlo a pantalla completa con un solo clic.
                    </p>
                  </div>
                ) : embed.type === 'direct' && embed.src ? (
                  <div className="w-full aspect-video bg-black flex items-center justify-center">
                    <video
                      src={embed.src}
                      controls
                      autoPlay
                      className="w-full h-full max-h-[70vh]"
                    >
                      Tu navegador no soporta la reproducción de video HTML5.
                    </video>
                  </div>
                ) : (
                  <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[360px]">
                    <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-500 mb-4 shadow-xl">
                      <Video className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-black text-white mb-2">{selectedVideo.titulo}</h4>
                    <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
                      {selectedVideo.descripcion}
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                      <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Este tutorial aún no tiene un enlace de video configurado. Puedes añadir la URL de YouTube o Drive pulsando en el botón editar.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie con descripción del video */}
              <div className="p-4 bg-zinc-900/90 border-t border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
                <span className="line-clamp-1">{selectedVideo.descripcion}</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToEdit = selectedVideo;
                      setSelectedVideo(null);
                      handleOpenEditModal(itemToEdit);
                    }}
                    className="ml-4 shrink-0 font-bold text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar enlace</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CREAR / EDITAR VIDEO */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingItem ? 'Editar Video / Tutorial' : 'Nuevo Video / Tutorial'}
                  </h3>
                  <p className="text-xs text-slate-400">Configura los datos del tutorial para Salamandra.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 flex flex-col gap-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Título del Video <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej: Cómo realizar una revisión con la tablet"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Categoría y Duración en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                  >
                    <option value="general">General</option>
                    <option value="tablet">App Tablet / Móvil</option>
                    <option value="mantenimientos">Mantenimientos</option>
                    <option value="operaciones">Operaciones</option>
                    <option value="documentos">Documentos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Duración Estimada
                  </label>
                  <input
                    type="text"
                    value={formData.duracion}
                    onChange={(e) => setFormData({ ...formData, duracion: e.target.value })}
                    placeholder="Ej: 5:20 min"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {/* URL del video */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enlace del Video (YouTube, Vimeo, Drive, OneDrive o MP4)
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/... o enlace de OneDrive / Drive"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Soporta enlaces de <strong>YouTube</strong>, <strong>Google Drive</strong>, <strong>Microsoft OneDrive</strong>, <strong>Vimeo</strong> o archivos <strong>MP4</strong> directos.
                </p>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Explica brevemente qué se aprende en este tutorial..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              {/* Checkbox Destacado */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkDestacado"
                  checked={formData.destacado}
                  onChange={(e) => setFormData({ ...formData, destacado: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="chkDestacado" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Marcar como tutorial destacado en el banner superior
                </label>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  {editingItem ? 'Guardar Cambios' : 'Crear Tutorial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden text-center animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-6">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-sm">
                <Trash2 className="w-7 h-7 stroke-[2.25]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">¿Eliminar tutorial?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se eliminará el video <strong>"{deleteConfirmItem.titulo}"</strong> de la lista de métodos.
              </p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer text-xs"
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
