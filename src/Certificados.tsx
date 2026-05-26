import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, Download, Search, CheckCircle2, CircleX, Clock, Trash2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { generarCertificadoPDF } from './pdfGenerator';

export default function Certificados() {
  const navigate = useNavigate();
  const [certificados, setCertificados] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [sistemas, setSistemas] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [certificadoIdToDelete, setCertificadoIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    const storedCertificados = JSON.parse(localStorage.getItem('firecheck_db_certificados') || '[]');
    const storedClientes = JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]');
    const storedCentros = JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]');
    const storedSistemas = JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]');
    const storedEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
    const storedTecnicos = JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]');

    setCertificados(storedCertificados);
    setClientes(storedClientes);
    setCentros(storedCentros);
    setSistemas(storedSistemas);
    setEquipos(storedEquipos);
    setTecnicos(storedTecnicos);
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

  const handleGenerarPDF = (cert: any) => {
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
      generarCertificadoPDF(
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

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-3">
              <FileCheck className="w-8 h-8 text-cyan-500" />
              Todos los Certificados
            </h1>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input 
            type="text"
            placeholder="Buscar por mantenimiento, cliente o centro..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Cabecera de la lista */}
          <div className="hidden md:flex items-center gap-4 px-6 py-4 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-wider">
            <div className="w-32">Nº Mantenimiento</div>
            <div className="w-32">Fecha</div>
            <div className="flex-1">Cliente / Centro</div>
            <div className="w-40 text-center">Estado</div>
            <div className="w-24 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-zinc-100">
            {sortedAndFilteredCertificados.length === 0 ? (
              <div className="p-20 text-center text-zinc-400">
                No se han encontrado certificados generados.
              </div>
            ) : (
              sortedAndFilteredCertificados.map((cert) => {
                const cliente = clientes.find(c => c.id === cert.clienteId);
                const centro = centros.find(c => c.id === cert.centroId);
                const isPositivo = cert.estado === 'Favorable' || cert.estado === 'Positivo (Favorable)';

                return (
                  <div key={cert.id} className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 hover:bg-zinc-50/50 transition-colors">
                    <div className="w-32 font-mono font-bold text-zinc-900 text-sm">{cert.numeroMantenimiento}</div>
                    <div className="w-32 text-zinc-500 text-sm flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(cert.fechaCreacion).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-zinc-900 text-sm leading-tight">{cliente?.nombre || 'Desconocido'}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{centro?.nombre || 'Sin centro'}</p>
                    </div>
                    <div className="w-40 flex justify-center">
                      <span className={`w-full max-w-[140px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center justify-center gap-2 border ${
                        isPositivo 
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700' 
                        : 'bg-red-100 border-red-200 text-red-700'
                      }`}>
                        {isPositivo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CircleX className="w-3.5 h-3.5" />}
                        {isPositivo ? 'Favorable' : 'Anomalías'}
                      </span>
                    </div>
                    <div className="w-24 flex justify-end gap-2">
                      <button 
                        onClick={() => handleGenerarPDF(cert)}
                        className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        title="Descargar PDF"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCertificado(cert.id)}
                        className="p-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors"
                        title="Eliminar certificado"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Confirmation Modal
  if (isConfirmModalOpen && certificadoIdToDelete) {
    return (
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDeleteCertificado}
        title="Confirmar Eliminación"
        message="ATENCIÓN SE PROCEDE A BORRAR EL ELEMENTO Y SUS REGISTROS ¿ CONFIRMA SU PETICIÓN ?"
        confirmText="Sí, eliminar"
        cancelText="No, cancelar"
      />
    );
  }
}