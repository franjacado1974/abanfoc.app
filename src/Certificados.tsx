import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, Download, Search, CheckCircle2, CircleX, Clock, Trash2, Eye, Building2, MapPin, User, CalendarDays, AlertTriangle } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { generarCertificadoPDF } from './pdfGenerator';
import DetailModal from './components/DetailModal';

export default function Certificados() {
  const navigate = useNavigate();
  const [certificados, setCertificados] = useState<any[]>([]);
  const [clientes] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
  const [centros] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'));
  const [sistemas] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'));
  const [equipos, setEquipos] = useState<any[]>([]);
  const [tecnicos] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'));
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [certificadoIdToDelete, setCertificadoIdToDelete] = useState<string | null>(null);
  
  // Detail modal state
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const storedCertificados = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
    setCertificados(storedCertificados);
    const storedEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
    setEquipos(storedEquipos);
  }, []);

  const handleDeleteCertificado = (id: string) => {
    setCertificadoIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteCertificado = () => {
    if (!certificadoIdToDelete) return;
    setIsConfirmModalOpen(false);
    const updatedCertificados = certificados.filter(cert => cert.id !== certificadoIdToDelete);
    setCertificados(updatedCertificados);
    localStorage.setItem('firecheck_db_certificados', JSON.stringify(updatedCertificados));
    setCertificadoIdToDelete(null);
  };

  const sortedAndFilteredCertificados = useMemo(() => {
    const filtered = certificados.filter(cert => {
      const cliente = clientes.find(c => c.id === cert.clienteId);
      const centro = centros.find(c => c.id === cert.centroId);
      const term = searchTerm.toLowerCase();

      return (
        cert.numeroMantenimiento.toLowerCase().includes(term) ||
        (cliente && cliente.nombre.toLowerCase().includes(term)) ||
        (centro && centro.nombre.toLowerCase().includes(term))
      );
    });

    return filtered.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
  }, [certificados, clientes, centros, searchTerm]);

  const handleGenerarPDF = async (cert: any) => {
    try {
      const centro = centros.find(c => c.id === cert.centroId);
      const cliente = clientes.find(cl => cl.id === cert.clienteId);
      const tecnico = tecnicos.find(t => t.id === cert.tecnicoId);
      
      if (!centro || !cliente) {
        alert("No se encontró el centro o cliente asociado al certificado.");
        return;
      }
      
      const sistemasDelCentro = sistemas.filter((s: any) => s.centroId === centro.id);
      const equiposDelCentro = equipos.filter((e: any) => e.centroId === centro.id);
      
      if (sistemasDelCentro.length === 0 || equiposDelCentro.length === 0) {
        alert("No hay sistemas o equipos revisados en este centro para generar el PDF.");
        return;
      }
      
      const albaranes = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a: any) => a.parteId === cert.parteId);

      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';
      await generarCertificadoPDF(
        cliente, 
        centro, 
        cert, 
        nombreTecnico, 
        cert.estado, 
        sistemasDelCentro, 
        equiposDelCentro,
        albaranData?.firmaCliente,
        albaranData?.firmaTecnico,
        albaranData?.nombreFirmante
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el PDF.");
    }
  };

  const handleViewDetail = (cert: any) => {
    setSelectedCert(cert);
    setIsDetailOpen(true);
  };

  return (
    <>
      <div className="px-4 md:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 bg-white rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-cyan-600" />
              Todos los Certificados
            </h1>
          </div>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text"
            placeholder="Buscar por mantenimiento, cliente o centro..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {sortedAndFilteredCertificados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
            <FileCheck className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">No hay certificados</h3>
            <p className="text-zinc-500">No se han encontrado certificados generados.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <div className="w-32">Nº Mantenimiento</div>
              <div className="w-28">Fecha</div>
              <div className="flex-1">Cliente / Centro</div>
              <div className="w-28">Estado</div>
              <div className="w-28 text-right">Acciones</div>
            </div>

            <div className="divide-y divide-zinc-100">
              {sortedAndFilteredCertificados.map((cert) => {
                const cliente = clientes.find(c => c.id === cert.clienteId);
                const centro = centros.find(c => c.id === cert.centroId);
                const isPositivo = cert.estado === 'Favorable' || cert.estado === 'Positivo (Favorable)';

                return (
                  <div
                    key={cert.id}
                    className="flex flex-col md:flex-row md:items-center px-4 py-3.5 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                    onClick={() => handleViewDetail(cert)}
                  >
                    {/* Mobile */}
                    <div className="flex md:hidden items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-zinc-500">{cert.numeroMantenimiento}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleViewDetail(cert); }} className="p-1 text-zinc-400 hover:text-blue-900 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex md:hidden items-center gap-2 mb-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span className="text-xs text-zinc-500">{new Date(cert.fechaCreacion).toLocaleDateString()}</span>
                    </div>
                    <div className="flex md:hidden mb-2">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{cliente?.nombre || 'Desconocido'}</p>
                        <p className="text-xs text-zinc-500">{centro?.nombre || 'Sin centro'}</p>
                      </div>
                    </div>
                    <div className="flex md:hidden items-center justify-between mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        isPositivo 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {isPositivo ? <CheckCircle2 className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                        {isPositivo ? 'Favorable' : 'Anomalías'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerarPDF(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCertificado(cert.id); }}
                          className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Desktop cells */}
                    <div className="hidden md:flex items-center w-full">
                      <div className="w-32">
                        <span className="text-[11px] font-mono font-bold text-zinc-700">{cert.numeroMantenimiento}</span>
                      </div>
                      <div className="w-28 text-sm text-zinc-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(cert.fechaCreacion).toLocaleDateString()}
                      </div>
                      <div className="flex-1 pr-2">
                        <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-cyan-700 transition-colors">{cliente?.nombre || 'Desconocido'}</p>
                        <p className="text-xs text-zinc-500 truncate">{centro?.nombre || 'Sin centro'}</p>
                      </div>
                      <div className="w-28">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase ${
                          isPositivo 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {isPositivo ? <CheckCircle2 className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                          {isPositivo ? 'Favorable' : 'Anomalías'}
                        </span>
                      </div>
                      <div className="w-28 flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewDetail(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerarPDF(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCertificado(cert.id); }}
                          className="p-1.5 text-zinc-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && certificadoIdToDelete && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDeleteCertificado}
          title="Confirmar Eliminación"
          message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
          confirmText="Sí, eliminar"
          cancelText="No, cancelar"
        />
      )}

      {/* Detail Modal */}
      <DetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Detalle del Certificado"
        size="lg"
      >
        {selectedCert && (() => {
          const cliente = clientes.find(c => c.id === selectedCert.clienteId);
          const centro = centros.find(c => c.id === selectedCert.centroId);
          const tecnico = tecnicos.find(t => t.id === selectedCert.tecnicoId);
          const isPositivo = selectedCert.estado === 'Favorable' || selectedCert.estado === 'Positivo (Favorable)';
          const sistemasDelCentro = sistemas.filter((s: any) => s.centroId === selectedCert.centroId);

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${isPositivo ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  {isPositivo ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Certificado</p>
                  <h3 className="text-xl font-bold text-zinc-900">{selectedCert.numeroMantenimiento}</h3>
                  <p className="text-sm text-zinc-500">{new Date(selectedCert.fechaCreacion).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="ml-auto">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                    isPositivo 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {isPositivo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CircleX className="w-3.5 h-3.5" />}
                    {isPositivo ? 'Favorable' : 'Anomalías'}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente</h4>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Cliente</p>
                      <p className="text-sm font-bold text-zinc-900">{cliente?.nombre || 'Desconocido'}</p>
                      {cliente && <p className="text-xs text-zinc-500">{cliente.cif}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Centro</p>
                      <p className="text-sm font-bold text-zinc-900">{centro?.nombre || 'Sin centro'}</p>
                      {centro && <p className="text-xs text-zinc-500">{centro.direccion}, {centro.poblacion}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Información</h4>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Técnico</p>
                      <p className="text-sm font-semibold text-zinc-900">{tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Fecha de creación</p>
                      <p className="text-sm font-semibold text-zinc-900">{new Date(selectedCert.fechaCreacion).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sistemas revisados */}
              {sistemasDelCentro.length > 0 && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Sistemas Revisados</h4>
                  <div className="flex flex-wrap gap-2">
                    {sistemasDelCentro.map((s: any) => (
                      <span key={s.id} className="bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700">
                        {s.nombre || s.categoria || 'Sistema'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  onClick={() => { setIsDetailOpen(false); handleGenerarPDF(selectedCert); }}
                  className="flex items-center gap-1.5 bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Descargar PDF
                </button>
              </div>
            </div>
          );
        })()}
      </DetailModal>
    </>
  );
}