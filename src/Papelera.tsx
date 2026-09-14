import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, RotateCcw, ArrowLeft, Search, X, 
  Clock, ShieldAlert, CheckCircle2,
  FileCheck, FileDigit, FileText, Gauge, Calculator, AlertTriangle
} from 'lucide-react';
import { 
  subscribePapelera, 
  restaurarElementoPapelera, 
  eliminarDefinitivoPapelera, 
  vaciarPapeleraCompleta,
  type PapeleraItem 
} from './firebase';

export default function Papelera() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PapeleraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');

  // Modales de confirmación
  const [itemToRestore, setItemToRestore] = useState<PapeleraItem | null>(null);
  const [itemToDeleteDefinitive, setItemToDeleteDefinitive] = useState<PapeleraItem | null>(null);
  const [showVaciarModal, setShowVaciarModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePapelera((papeleraItems) => {
      setItems(papeleraItems);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  // Calcular días restantes hasta cumplir 100 días
  const calcularDiasRestantes = (fechaExpiracion: string) => {
    if (!fechaExpiracion) return 100;
    const expTime = new Date(fechaExpiracion).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Formatear fecha legible
  const formatFecha = (isoString: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Obtener tipos únicos presentes en la papelera
  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.tipo) set.add(i.tipo);
    });
    return Array.from(set);
  }, [items]);

  // Filtrado de elementos
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        (item.titulo && item.titulo.toLowerCase().includes(term)) ||
        (item.clienteNombre && item.clienteNombre.toLowerCase().includes(term)) ||
        (item.centroNombre && item.centroNombre.toLowerCase().includes(term)) ||
        (item.tipo && item.tipo.toLowerCase().includes(term)) ||
        (item.eliminadoPor && item.eliminadoPor.toLowerCase().includes(term));

      const matchesTipo = selectedTipo === 'TODOS' || item.tipo === selectedTipo;

      return matchesSearch && matchesTipo;
    });
  }, [items, searchTerm, selectedTipo]);

  // Manejar Restauración
  const handleRestaurar = async () => {
    if (!itemToRestore) return;
    setIsProcessing(true);
    try {
      await restaurarElementoPapelera(itemToRestore);
      showToast(`«${itemToRestore.titulo}» se ha restaurado con éxito a su sección original.`);
      setItemToRestore(null);
    } catch (err) {
      console.error('Error al restaurar elemento:', err);
      alert('Ocurrió un error al intentar restaurar el elemento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejar Borrado Definitivo Individual
  const handleEliminarDefinitivo = async () => {
    if (!itemToDeleteDefinitive) return;
    setIsProcessing(true);
    try {
      await eliminarDefinitivoPapelera(itemToDeleteDefinitive._docId || itemToDeleteDefinitive.id);
      showToast(`Elemento eliminado de forma definitiva.`);
      setItemToDeleteDefinitive(null);
    } catch (err) {
      console.error('Error al eliminar definitivamente:', err);
      alert('Ocurrió un error al intentar eliminar el elemento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejar Vaciar Papelera
  const handleVaciarPapelera = async () => {
    setIsProcessing(true);
    try {
      await vaciarPapeleraCompleta();
      showToast('La papelera se ha vaciado por completo.');
      setShowVaciarModal(false);
    } catch (err) {
      console.error('Error al vaciar papelera:', err);
      alert('Ocurrió un error al vaciar la papelera.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Insignia de tipo según colección
  const renderTipoBadge = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'prueba técnica':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
            <Gauge className="w-3.5 h-3.5 text-purple-600" />
            Prueba Técnica
          </span>
        );
      case 'certificado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            Certificado
          </span>
        );
      case 'albarán':
      case 'albaran':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <FileDigit className="w-3.5 h-3.5 text-amber-600" />
            Albarán
          </span>
        );
      case 'parte de trabajo':
      case 'parte':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            Parte de Trabajo
          </span>
        );
      case 'presupuesto':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            Presupuesto
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            {tipo || 'Documento'}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 sm:px-8 py-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-zinc-950 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-zinc-800 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold">{successToast}</p>
        </div>
      )}

      {/* Header y Navegación */}
      <div className="mb-6 flex flex-col items-center sm:items-start text-center sm:text-left">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              Papelera de Reciclaje
            </h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Todos los archivos y documentos eliminados se conservan durante 100 días antes de su purga automática. Puedes recuperarlos en cualquier momento.
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => setShowVaciarModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 shadow-sm transition-all cursor-pointer self-start sm:self-auto active:scale-95"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              Vaciar Papelera ({items.length})
            </button>
          )}
        </div>
      </div>

      {/* Barra de Búsqueda y Pestañas de Tipo */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Campo de Búsqueda */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por documento, cliente, centro o usuario que eliminó..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-black transition-colors"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Pestañas de filtro por Tipo */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedTipo('TODOS')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedTipo === 'TODOS'
                ? 'bg-black text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Todos ({items.length})
          </button>
          {tiposDisponibles.map((tipo) => {
            const count = items.filter(i => i.tipo === tipo).length;
            const isSelected = selectedTipo === tipo;
            return (
              <button
                key={tipo}
                onClick={() => setSelectedTipo(tipo)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tipo} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-medium text-xs">
            Cargando elementos de la papelera...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-300 mb-3">
              <Trash2 className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-zinc-700">La papelera está vacía</h4>
            <p className="text-xs text-zinc-450 mt-1 max-w-sm leading-relaxed">
              {searchTerm || selectedTipo !== 'TODOS'
                ? 'No se encontraron elementos con los filtros de búsqueda aplicados.'
                : 'No hay ningún archivo ni documento eliminado pendiente de reciclaje.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200/60 text-[11px] font-black uppercase text-zinc-450 tracking-wider">
                  <th className="py-4 px-6 text-center">TIPO</th>
                  <th className="py-4 px-6">DOCUMENTO / DETALLE</th>
                  <th className="py-4 px-6">ELIMINADO POR</th>
                  <th className="py-4 px-6">FECHA ELIMINACIÓN</th>
                  <th className="py-4 px-6 text-center">RETENCIÓN (100 DÍAS)</th>
                  <th className="py-4 px-6 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredItems.map((item) => {
                  const diasRestantes = calcularDiasRestantes(item.fechaExpiracion);
                  const isExpiringSoon = diasRestantes <= 10;
                  const isMidExpiring = diasRestantes <= 30;

                  return (
                    <tr 
                      key={item._docId || item.id}
                      className="hover:bg-zinc-50/60 transition-colors group"
                    >
                      {/* TIPO */}
                      <td className="py-4 px-6 text-center">
                        {renderTipoBadge(item.tipo)}
                      </td>

                      {/* DOCUMENTO / DETALLE */}
                      <td className="py-4 px-6">
                        <div className="max-w-md">
                          <span className="font-semibold text-zinc-800 block text-xs">
                            {item.titulo || 'Sin título'}
                          </span>
                          {(item.clienteNombre || item.centroNombre) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium mt-0.5">
                              {item.clienteNombre && <span>{item.clienteNombre}</span>}
                              {item.clienteNombre && item.centroNombre && <span>•</span>}
                              {item.centroNombre && <span className="text-zinc-400">{item.centroNombre}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ELIMINADO POR */}
                      <td className="py-4 px-6 font-medium text-zinc-600">
                        <span className="bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-lg text-[11px]">
                          {item.eliminadoPor || 'Usuario'}
                        </span>
                      </td>

                      {/* FECHA ELIMINACIÓN */}
                      <td className="py-4 px-6 text-zinc-600 font-medium">
                        {formatFecha(item.fechaEliminacion)}
                      </td>

                      {/* DÍAS RESTANTES */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isExpiringSoon 
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
                            : isMidExpiring 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Clock className="w-3 h-3" />
                          Quedan {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}
                        </span>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Restaurar */}
                          <button
                            onClick={() => setItemToRestore(item)}
                            title="Restaurar a su sección original"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-all font-bold text-xs cursor-pointer active:scale-95 shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restaurar</span>
                          </button>

                          {/* Botón Eliminar Definitivamente */}
                          <button
                            onClick={() => setItemToDeleteDefinitive(item)}
                            title="Eliminar de forma permanente"
                            className="p-1.5 rounded-xl bg-zinc-100 hover:bg-red-600 text-zinc-500 hover:text-white border border-zinc-200 hover:border-red-600 transition-all cursor-pointer active:scale-95 shadow-xs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE RESTAURAR */}
      {itemToRestore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-zinc-950">¿Restaurar documento?</h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              El elemento <strong className="text-zinc-900">«{itemToRestore.titulo}»</strong> volverá a aparecer de inmediato en su menú original (<span className="capitalize font-semibold">{itemToRestore.tipo}</span>).
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setItemToRestore(null)}
                disabled={isProcessing}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestaurar}
                disabled={isProcessing}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Restaurando...' : 'Sí, Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BORRADO DEFINITIVO */}
      {itemToDeleteDefinitive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-zinc-950">¿Eliminar definitivamente?</h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Estás a punto de borrar de forma permanente <strong className="text-zinc-900">«{itemToDeleteDefinitive.titulo}»</strong>. Esta acción es irreversible y no se podrá recuperar.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setItemToDeleteDefinitive(null)}
                disabled={isProcessing}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminarDefinitivo}
                disabled={isProcessing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE VACIAR PAPELERA */}
      {showVaciarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-zinc-950">¿Vaciar toda la papelera?</h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Se eliminarán de forma permanente todos los <strong className="text-zinc-900">{items.length} elementos</strong> contenidos en la papelera. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowVaciarModal(false)}
                disabled={isProcessing}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVaciarPapelera}
                disabled={isProcessing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Vaciando...' : 'Sí, Vaciar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
