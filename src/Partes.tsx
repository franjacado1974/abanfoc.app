import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, MapPin, CalendarDays, Search, Trash2, Download, Lock, X, Check } from 'lucide-react';
import { subscribePartes, subscribeCentros, subscribeClientes, deleteParte, db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { generarActaExtintoresPDF, generarAlbaranPDF, generarCertificadoPDF } from './pdfGenerator';

interface ParteItem {
  id: string;
  centroId: string;
  nombreCentro?: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  empresaId?: string;
  periodicidad: string;
  mesesRevision: string;
  estado: string;
  fechaProgramada?: string;
  _docId?: string;
}

interface Cliente {
  id: string;
  nombre: string;
  cif?: string;
  direccion?: string;
  poblacion?: string;
}

interface Centro {
  id: string;
  clienteId: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  provincia?: string;
}

export default function Partes() {
  const navigate = useNavigate();
  const [partes, setPartes] = useState<ParteItem[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedParteToDownload, setSelectedParteToDownload] = useState<ParteItem | null>(null);
  const [downloadOptions, setDownloadOptions] = useState({ acta: true, certificado: true, albaran: true });

  useEffect(() => {
    const unsubPartes = subscribePartes((items) => {
      setPartes(items.map((d: any) => ({ ...d })) as ParteItem[]);
    });
    const unsubCentros = subscribeCentros((items) => {
      setCentros(items);
    });
    const unsubClientes = subscribeClientes((items) => {
      setClientes(items);
    });
    return () => {
      unsubPartes();
      unsubCentros();
      unsubClientes();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (_e: MouseEvent) => {
      // Menú ya no se usa
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCliente = (clienteId: string) => clientes.find(c => c.id === clienteId);
  const getCentro = (centroId: string) => centros.find(c => c.id === centroId);

  const getTipoRevision = (periodicidad: string): string => {
    if (periodicidad.toLowerCase().includes('trimestral')) return 'Revisión Trimestral';
    if (periodicidad.toLowerCase().includes('anual')) return 'Revisión Anual';
    if (periodicidad.toLowerCase().includes('mensual')) return 'Revisión Mensual';
    return periodicidad;
  };

  const getRevisionColor = (periodicidad: string): string => {
    if (periodicidad.toLowerCase().includes('trimestral')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (periodicidad.toLowerCase().includes('anual')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (periodicidad.toLowerCase().includes('mensual')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  };

  const formatFecha = (fecha?: string) => {
    if (!fecha) return '—';
    try {
      const [dia, mes, anio] = fecha.split('-');
      return `${dia}/${mes}/${anio}`;
    } catch {
      return fecha;
    }
  };

  const irARevision = (parte: ParteItem) => {
    navigate('/revision-checklist', {
      state: {
        parteId: parte.id,
        centroId: parte.centroId,
        clienteId: parte.clienteId,
        periodicidad: parte.periodicidad,
        fechaProgramada: parte.fechaProgramada,
      }
    });
  };

  const eliminarParte = async (parte: ParteItem) => {
    if (!confirm('¿Estás seguro de eliminar este parte de trabajo?')) return;
    try {
      const docId = (parte as any)._docId || parte.id;
      await deleteParte(docId);
    } catch (err) {
      console.error('Error eliminando parte:', err);
    }
  };

  const openDownloadModal = (parte: ParteItem) => {
    setSelectedParteToDownload(parte);
    setDownloadOptions({ acta: true, certificado: true, albaran: true });
    setShowDownloadModal(true);
  };

  const confirmDownloadPDFs = async () => {
    if (!selectedParteToDownload) return;
    const parte = selectedParteToDownload;
    setShowDownloadModal(false);

    const centro = getCentro(parte.centroId);
    const cliente = getCliente(parte.clienteId);
    if (!centro || !cliente) {
      alert('Falta información de centro o cliente.');
      return;
    }
    
    try {
      alert('Generando documentos PDF seleccionados... Por favor, espera.');
      // 1. Obtener Sistemas del centro
      const sistemasCol = collection(db, 'centros', centro.id, 'inventario');
      const sistemasSnap = await getDocs(sistemasCol);
      const sistemasDelCentro = sistemasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Obtener Equipos instalados
      let equiposTodos: any[] = [];
      for (const sist of sistemasDelCentro) {
          const equiposCol = collection(db, 'centros', centro.id, 'inventario', sist.id, 'equipos');
          const equiposSnap = await getDocs(equiposCol);
          equiposTodos = equiposTodos.concat(equiposSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      // Ordenar equiposTodos
      equiposTodos.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

      // Tecnico nombre
      const tecnicos = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');
      const tecnico = tecnicos.find((t: any) => t.id === parte.tecnicoId);
      const tecnicoNombre = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'Técnico';

      const firmaCliente = (parte as any).firmaCliente || '';
      const firmaTecnico = (parte as any).firmaTecnico || '';
      const nombreFirmante = (parte as any).nombreFirmante || '';
      const numeroMantenimiento = (parte as any).numeroMantenimiento || parte.id;

      let checklistItemsTodos: any[] = [];
      try {
        const checkSnap = await getDocs(collection(db, 'checklist'));
        checklistItemsTodos = checkSnap.docs.map(d => ({ key: d.id, ...d.data() }));
      } catch (e) {
        console.error('Checklist fetch error', e);
      }

      // 1. Acta
      if (downloadOptions.acta) {
        await generarActaExtintoresPDF(
          cliente, centro, sistemasDelCentro, equiposTodos, numeroMantenimiento,
          tecnicoNombre, undefined, firmaCliente, firmaTecnico, nombreFirmante, checklistItemsTodos
        );
      }

      // 2. Certificado
      if (downloadOptions.certificado) {
        await generarCertificadoPDF(
          cliente, centro, parte, tecnicoNombre, undefined, sistemasDelCentro, equiposTodos,
          firmaCliente, firmaTecnico, nombreFirmante, false
        );
      }

      // 3. Albarán
      if (downloadOptions.albaran) {
        await generarAlbaranPDF(
          cliente, centro, equiposTodos, numeroMantenimiento, tecnicoNombre,
          firmaCliente, firmaTecnico, nombreFirmante, undefined, undefined, false, 'ALBARÁN DE REVISIÓN'
        );
      }

    } catch (error) {
      console.error('Error generando PDFs:', error);
      alert('Hubo un error al generar los documentos. Ver consola.');
    }
  };

  const partesFiltrados = search
    ? partes.filter(p => {
        const centro = getCentro(p.centroId);
        const cliente = getCliente(p.clienteId);
        const text = `${centro?.nombre || ''} ${cliente?.nombre || ''} ${centro?.poblacion || ''} ${getTipoRevision(p.periodicidad)}`.toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : partes;

  // Only show parts that have a fechaProgramada (planified)
  const partesPlanificados = partesFiltrados.filter(
    p => p.fechaProgramada && p.fechaProgramada.trim() !== ''
  ).sort((a, b) => {
    if (!a.fechaProgramada) return 1;
    if (!b.fechaProgramada) return -1;
    const [da, ma, ya] = a.fechaProgramada.split('-').map(Number);
    const [db, mb, yb] = b.fechaProgramada.split('-').map(Number);
    return (ya * 10000 + ma * 100 + da) - (yb * 10000 + mb * 100 + db);
  });

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-sky-950 flex items-center gap-3">
            <FileText className="w-8 h-8 text-sky-500" /> Partes de Trabajo
          </h1>
          <div className="ml-auto relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar partes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-sky-100 overflow-hidden">
          {partesPlanificados.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500 font-medium">No hay partes de trabajo planificados</p>
              <p className="text-zinc-400 text-sm mt-1">
                Los partes aparecerán aquí cuando se programen trabajos en el calendario de Planificación
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sky-100 bg-sky-50/30">
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Cliente
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Centro
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Población
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Fecha Planificada
                      </div>
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Tipo Revisión
                      </div>
                    </th>
                    <th className="text-right px-4 py-4 text-xs font-bold uppercase tracking-wider text-sky-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {partesPlanificados.map(parte => {
                    const centro = getCentro(parte.centroId);
                    const cliente = getCliente(parte.clienteId);
                    return (
                      <tr key={parte.id} className="hover:bg-amber-50/40 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-zinc-900 text-sm">
                            {cliente?.nombre || '—'}
                          </p>
                          {cliente?.cif && (
                            <p className="text-[10px] text-zinc-400 mt-0.5">{cliente.cif}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-800 text-sm">
                            {centro?.nombre || parte.nombreCentro || '—'}
                          </p>
                          {centro?.id && (
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{centro.id}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-zinc-600">
                            {centro?.poblacion || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-zinc-800">
                            {formatFecha(parte.fechaProgramada)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 text-[11px] font-bold rounded-full border ${getRevisionColor(parte.periodicidad)}`}>
                            {getTipoRevision(parte.periodicidad)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => irARevision(parte)}
                              className="p-2 rounded-lg hover:bg-sky-50 text-sky-600 transition-colors"
                              title={(parte.estado === 'Pre-Cerrado' || parte.estado === 'Cerrado') ? "Revisar Parte (Bloqueado)" : "Ir a Revisión"}
                            >
                              {(parte.estado === 'Pre-Cerrado' || parte.estado === 'Cerrado') ? <Lock className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </button>
                            
                            {(parte.estado === 'Pre-Cerrado' || parte.estado === 'Cerrado' || parte.estado === 'Descargado (Offline)' || (parte as any).firmaCliente) && (
                              <button
                                onClick={() => openDownloadModal(parte)}
                                className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                                title="Descargar PDFs"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            )}

                            <button
                              onClick={() => eliminarParte(parte)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-5 h-5" />
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

        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
          <span>Total: {partesPlanificados.length} parte{partesPlanificados.length !== 1 ? 's' : ''} planificado{partesPlanificados.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Modal de Opciones de Descarga PDF */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="font-bold text-zinc-800 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                Descargar Documentos
              </h3>
              <button 
                onClick={() => setShowDownloadModal(false)}
                className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-zinc-600 mb-5">Selecciona los documentos que deseas generar y descargar:</p>
              
              <div className="space-y-3">
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.acta ? 'bg-sky-500 border-sky-500' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.acta && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.acta}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, acta: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Acta de Revisión</span>
                </label>
                
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.certificado ? 'bg-sky-500 border-sky-500' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.certificado && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.certificado}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, certificado: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Certificado</span>
                </label>
                
                <label className="flex items-center p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors ${downloadOptions.albaran ? 'bg-sky-500 border-sky-500' : 'border-2 border-zinc-300'}`}>
                    {downloadOptions.albaran && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={downloadOptions.albaran}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, albaran: e.target.checked }))}
                  />
                  <span className="font-medium text-zinc-700">Albarán de Trabajo</span>
                </label>
              </div>

              <div className="mt-6 pt-5 border-t border-zinc-100 flex gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDownloadPDFs}
                  disabled={!downloadOptions.acta && !downloadOptions.certificado && !downloadOptions.albaran}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}