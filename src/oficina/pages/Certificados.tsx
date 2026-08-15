import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileCheck, Download, Search, CheckCircle2, CircleX, Clock, Trash2, Eye, 
  Building2, MapPin, User, CalendarDays, AlertTriangle, ArrowLeft, Plus, 
  Wrench, PlayCircle, FileText, X, Layers
} from 'lucide-react';
import ConfirmationModal from '../../recursos-compartidos/ConfirmationModal';
import { generarCertificadoPDF, generarCertificadoPDFView } from '../../recursos-compartidos/services/pdfGenerator';
import { subscribeCertificados, deleteCertificado, createCertificado as addCertificado } from '../services/facturacionService';
import { db } from '../../recursos-compartidos/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import DetailModal from '../../recursos-compartidos/components/DetailModal';

export const CATEGORIAS_CERTIFICADO = [
  {
    id: 'revision',
    nombre: 'Certificado de Revisión',
    descripcion: 'Revisión periódica de mantenimiento PCI',
    icono: CheckCircle2,
    colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    colorBtn: 'bg-emerald-600 hover:bg-emerald-700',
    colorIconBg: 'bg-emerald-100 text-emerald-700',
    plantillaTexto: 'CERTIFICA que se ha efectuado la revisión periódica de los equipos y sistemas de protección contra incendios según la normativa vigente (R.D. 513/2017).'
  },
  {
    id: 'instalacion',
    nombre: 'Certificado de Instalación',
    descripcion: 'Nuevas instalaciones de sistemas y equipos PCI',
    icono: Wrench,
    colorBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    colorBtn: 'bg-blue-600 hover:bg-blue-700',
    colorIconBg: 'bg-blue-100 text-blue-700',
    plantillaTexto: 'CERTIFICA que se ha realizado la instalación completa de los sistemas de protección contra incendios indicados, habiendo sido ejecutados según proyecto técnico y normativa R.D. 513/2017.'
  },
  {
    id: 'reparacion',
    nombre: 'Certificado de Reparación',
    descripcion: 'Corrección de deficiencias y sustitución de elementos',
    icono: AlertTriangle,
    colorBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    colorBtn: 'bg-amber-600 hover:bg-amber-700',
    colorIconBg: 'bg-amber-100 text-amber-700',
    plantillaTexto: 'CERTIFICA que se han reparado y subsanado satisfactoriamente las deficiencias detectadas en los equipos y sistemas de protección contra incendios.'
  },
  {
    id: 'puesta_en_marcha',
    nombre: 'Certificado de Puesta en Marcha',
    descripcion: 'Pruebas funcionales de servicio e inspección',
    icono: PlayCircle,
    colorBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    colorBtn: 'bg-purple-600 hover:bg-purple-700',
    colorIconBg: 'bg-purple-100 text-purple-700',
    plantillaTexto: 'CERTIFICA que se han realizado con resultado favorable las pruebas de puesta en marcha, presión y funcionamiento en carga de los sistemas instalados.'
  },
  {
    id: 'obligacion_salarial',
    nombre: 'Certificado de Obligación Salarial',
    descripcion: 'Cumplimiento laboral y salarial del personal',
    icono: FileCheck,
    colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    colorBtn: 'bg-indigo-600 hover:bg-indigo-700',
    colorIconBg: 'bg-indigo-100 text-indigo-700',
    plantillaTexto: 'Que dicha empresa cumple con todas las obligaciones legales de naturaleza salarial, con los trabajadores asignados al expediente, mediante el abono de sus correspondientes nóminas, encontrándose al corriente en el pago de los salarios de los mismos.\n\nLos trabajadores y/o el/los Representantes de los mismos abajo firmantes, declaran encontrarse al corriente de todas sus obligaciones de carácter salarial.'
  },
  {
    id: 'generico',
    nombre: 'Certificado Genérico',
    descripcion: 'Certificaciones especiales con título libre',
    icono: FileText,
    colorBadge: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    colorBtn: 'bg-zinc-800 hover:bg-zinc-900',
    colorIconBg: 'bg-zinc-200 text-zinc-800',
    plantillaTexto: 'CERTIFICA que se han realizado los trabajos y verificaciones técnicas descritas a continuación en las instalaciones del centro de trabajo.'
  }
];

export default function Certificados() {
  const navigate = useNavigate();
  const [certificados, setCertificados] = useState<any[]>([]);
  const [clientes] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_clientes') || '[]'));
  const [centros] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_centros') || '[]'));
  const [sistemas] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_centro_sistemas') || '[]'));
  const [equipos, setEquipos] = useState<any[]>([]);
  const [tecnicos] = useState<any[]>(() => JSON.parse(localStorage.getItem('firecheck_db_tecnicos') || '[]'));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('todos');
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [certificadoIdToDelete, setCertificadoIdToDelete] = useState<string | null>(null);
  
  // Detail modal state
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal de creación manual
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formManualCert, setFormManualCert] = useState({
    clienteId: '',
    centroId: '',
    tecnicoId: '',
    tipoCertificado: 'revision',
    tituloCertificado: '',
    numeroMantenimiento: '',
    fechaCreacion: new Date().toISOString().split('T')[0],
    estado: 'Favorable',
    textoCertificado: '',
    observaciones: ''
  });

  useEffect(() => {
    const unsubCertificados = subscribeCertificados((firebaseCertificados) => {
      setCertificados(firebaseCertificados);
      localStorage.setItem('firecheck_db_certificados', JSON.stringify(firebaseCertificados));
    });
    const storedEquipos = JSON.parse(localStorage.getItem('firecheck_db_equipos_instalados') || '[]');
    setEquipos(storedEquipos);

    return () => {
      unsubCertificados();
    };
  }, []);

  const handleDeleteCertificado = (id: string) => {
    setCertificadoIdToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDeleteCertificado = async () => {
    if (!certificadoIdToDelete) return;
    setIsConfirmModalOpen(false);
    try {
      await deleteCertificado(certificadoIdToDelete);
    } catch (e) {
      console.error("Error al eliminar certificado:", e);
      alert("Error al eliminar el certificado de la base de datos.");
    }
    setCertificadoIdToDelete(null);
  };

  const handleOpenCreateModal = (tipoId?: string) => {
    const catId = tipoId || 'revision';
    const cat = CATEGORIAS_CERTIFICADO.find(c => c.id === catId) || CATEGORIAS_CERTIFICADO[0];
    const year = new Date().getFullYear();
    const randomCorr = Math.floor(1000 + Math.random() * 9000);
    const numSugerido = `CERT-${year}-${randomCorr}`;

    setFormManualCert({
      clienteId: '',
      centroId: '',
      tecnicoId: tecnicos[0]?.id || '',
      tipoCertificado: cat.id,
      tituloCertificado: cat.id === 'generico' ? 'CERTIFICADO DE GARANTÍA Y CONFORMIDAD' : '',
      numeroMantenimiento: numSugerido,
      fechaCreacion: new Date().toISOString().split('T')[0],
      estado: 'Favorable',
      textoCertificado: cat.plantillaTexto,
      observaciones: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleCategoryChangeInForm = (newTipo: string) => {
    const cat = CATEGORIAS_CERTIFICADO.find(c => c.id === newTipo) || CATEGORIAS_CERTIFICADO[0];
    setFormManualCert(prev => ({
      ...prev,
      tipoCertificado: newTipo,
      tituloCertificado: newTipo === 'generico' ? (prev.tituloCertificado || 'CERTIFICADO OFICIAL') : '',
      textoCertificado: cat.plantillaTexto
    }));
  };

  const handleSaveManualCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formManualCert.clienteId) return alert('Por favor, selecciona un cliente.');
    if (!formManualCert.centroId) return alert('Por favor, selecciona un centro de trabajo.');

    const centroObj = centros.find(c => c._docId === formManualCert.centroId || c.id === formManualCert.centroId);
    const empId = centroObj?.empresaId || '';

    const catInfo = CATEGORIAS_CERTIFICADO.find(c => c.id === formManualCert.tipoCertificado);

    const newCert: any = {
      id: `cert-man-${Date.now()}`,
      clienteId: formManualCert.clienteId,
      centroId: formManualCert.centroId,
      empresaId: empId,
      parteId: `parte-man-${Date.now()}`,
      numeroMantenimiento: formManualCert.numeroMantenimiento.trim() || `CERT-${new Date().getFullYear()}-001`,
      fechaCreacion: formManualCert.fechaCreacion ? new Date(formManualCert.fechaCreacion).toISOString() : new Date().toISOString(),
      estado: formManualCert.estado,
      tecnicoId: formManualCert.tecnicoId,
      tipoCertificado: formManualCert.tipoCertificado,
      tituloCertificado: formManualCert.tipoCertificado === 'generico' ? (formManualCert.tituloCertificado || 'CERTIFICADO OFICIAL') : (catInfo?.nombre || 'CERTIFICADO'),
      textoCertificado: formManualCert.textoCertificado,
      observaciones: formManualCert.observaciones,
      esManual: true
    };

    try {
      await addCertificado(newCert);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error("Error guardando certificado manual:", err);
      alert("Error al guardar el certificado en la base de datos.");
    }
  };

  const sortedAndFilteredCertificados = useMemo(() => {
    const filtered = certificados.filter(cert => {
      const cliente = clientes.find(c => c.id === cert.clienteId);
      const centro = centros.find(c => c._docId === cert.centroId || c.id === cert.centroId);
      const term = searchTerm.toLowerCase();

      // Filtro de categoría activa
      const certTipo = cert.tipoCertificado || 'revision';
      if (activeCategoryFilter !== 'todos' && certTipo !== activeCategoryFilter) {
        return false;
      }

      const certNum = cert.numeroMantenimiento || cert.id || '';
      const tituloCert = cert.tituloCertificado || '';

      return (
        certNum.toLowerCase().includes(term) ||
        tituloCert.toLowerCase().includes(term) ||
        (cliente && cliente.nombre.toLowerCase().includes(term)) ||
        (centro && centro.nombre.toLowerCase().includes(term))
      );
    });

    return filtered.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
  }, [certificados, clientes, centros, searchTerm, activeCategoryFilter]);

  const centrosFiltradosPorCliente = useMemo(() => {
    if (!formManualCert.clienteId) return [];
    return centros.filter(c => c.clienteId === formManualCert.clienteId);
  }, [centros, formManualCert.clienteId]);

  const handleGenerarPDF = async (cert: any) => {
    try {
      const centro = centros.find(c => c._docId === cert.centroId || c.id === cert.centroId);
      const cliente = clientes.find(cl => cl.id === cert.clienteId);
      const tecnico = tecnicos.find(t => t.id === cert.tecnicoId);
      
      if (!centro || !cliente) {
        alert("No se encontró el centro o cliente asociado al certificado.");
        return;
      }
      
      const sistemasDelCentro = sistemas.filter((s: any) => s.centroId === centro._docId || s.centroId === centro.id);
      const equiposDelCentro = equipos.filter((e: any) => e.centroId === centro._docId || e.centroId === centro.id);
      
      const albaranes = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a: any) => a.parteId === cert.parteId);
      
      const empresas = JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]');
      const empId = cert.empresaId || centro?.empresaId;
      let empresaSeleccionada = empresas.find((e: any) => e._docId === empId || e.id === empId || (e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === empId?.trim().toLowerCase()));
      if (!empresaSeleccionada && empId) {
          try {
              const docSnap = await getDoc(doc(db, 'empresa', empId));
              if (docSnap.exists()) empresaSeleccionada = { _docId: docSnap.id, ...docSnap.data() };
          } catch(e){}
      }

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
        albaranData?.nombreFirmante,
        false,
        empresaSeleccionada
      );
    } catch (e) {
      console.error(e);
      alert("Hubo un error al generar el PDF.");
    }
  };

  const handleViewPDF = async (cert: any) => {
    try {
      const centro = centros.find(c => c._docId === cert.centroId || c.id === cert.centroId);
      const cliente = clientes.find(cl => cl.id === cert.clienteId);
      const tecnico = tecnicos.find(t => t.id === cert.tecnicoId);
      if (!centro || !cliente) return;
      const sistemasDelCentro = sistemas.filter((s: any) => s.centroId === centro._docId || s.centroId === centro.id);
      const equiposDelCentro = equipos.filter((e: any) => e.centroId === centro._docId || e.centroId === centro.id);
      const albaranes = JSON.parse(localStorage.getItem('firecheck_db_albaranes') || '[]');
      const albaranData = albaranes.find((a: any) => a.parteId === cert.parteId);
      
      const empresas = JSON.parse(localStorage.getItem('firecheck_db_empresas') || '[]');
      const empId = cert.empresaId || centro?.empresaId;
      let empresaSeleccionada = empresas.find((e: any) => e._docId === empId || e.id === empId || (e.nombre && typeof e.nombre === 'string' && e.nombre.trim().toLowerCase() === empId?.trim().toLowerCase()));
      if (!empresaSeleccionada && empId) {
          try {
              const docSnap = await getDoc(doc(db, 'empresa', empId));
              if (docSnap.exists()) empresaSeleccionada = { _docId: docSnap.id, ...docSnap.data() };
          } catch(e){}
      }
      
      const nombreTecnico = tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado';
      
      const pdfBlobUrl = await generarCertificadoPDFView(
        cliente, 
        centro, 
        cert, 
        nombreTecnico, 
        cert.estado, 
        sistemasDelCentro, 
        equiposDelCentro,
        albaranData?.firmaCliente,
        albaranData?.firmaTecnico,
        albaranData?.nombreFirmante,
        false,
        empresaSeleccionada
      );
      window.open(pdfBlobUrl, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewDetail = (cert: any) => {
    setSelectedCert(cert);
    setIsDetailOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC] px-4 md:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
            </button>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              Certificados Oficiales
            </h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Gestión de certificados por categoría y emisión de certificados manuales.</p>
          </div>

          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md shadow-black/10 active:scale-95 cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Crear Certificado Manual
          </button>
        </div>

        {/* ── CUADRÍCULA DE TARJETAS POR TIPO DE CERTIFICADO ── */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Tipos de Certificado Disponibles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIAS_CERTIFICADO.map(cat => {
              const Icono = cat.icono;
              const count = certificados.filter(c => (c.tipoCertificado || 'revision') === cat.id).length;
              const isSelected = activeCategoryFilter === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`bg-white rounded-3xl border transition-all p-5 shadow-sm flex flex-col justify-between group ${
                    isSelected ? 'border-black ring-2 ring-black/5 shadow-md' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${cat.colorIconBg}`}>
                        <Icono className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                        {count} {count === 1 ? 'certificado' : 'certificados'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-zinc-900 group-hover:text-black transition-colors">
                      {cat.nombre}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {cat.descripcion}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveCategoryFilter(isSelected ? 'todos' : cat.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-black text-white' 
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      {isSelected ? 'Ver todos' : 'Filtrar lista'}
                    </button>
                    <button
                      onClick={() => handleOpenCreateModal(cat.id)}
                      className={`flex items-center gap-1 text-xs font-bold text-white px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 ${cat.colorBtn}`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Crear manual
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BARRA DE BÚSQUEDA Y PESTAÑAS DE FILTRADO ── */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-4 mb-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text"
                placeholder="Buscar por nº certificado, título, cliente o centro..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:bg-white focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-sm text-zinc-900 placeholder-zinc-400 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {activeCategoryFilter !== 'todos' && (
              <button
                onClick={() => setActiveCategoryFilter('todos')}
                className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2.5 rounded-2xl hover:bg-red-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" /> Quitar filtro de categoría
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setActiveCategoryFilter('todos')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeCategoryFilter === 'todos' 
                  ? 'bg-black text-white' 
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Todos ({certificados.length})
            </button>
            {CATEGORIAS_CERTIFICADO.map(cat => {
              const cCount = certificados.filter(c => (c.tipoCertificado || 'revision') === cat.id).length;
              const active = activeCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    active 
                      ? 'bg-black text-white' 
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {cat.nombre.replace('Certificado de ', '').replace('Certificado ', '')} ({cCount})
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TABLA DE CERTIFICADOS ── */}
        {sortedAndFilteredCertificados.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center shadow-sm">
            <FileCheck className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">No hay certificados encontrados</h3>
            <p className="text-zinc-500 mb-6 text-sm">No hay certificados registrados para el filtro o término seleccionado.</p>
            <button
              onClick={() => handleOpenCreateModal(activeCategoryFilter !== 'todos' ? activeCategoryFilter : 'revision')}
              className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Crear Certificado Manual
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden overflow-x-auto">
            {/* Desktop header */}
            <div className="hidden md:flex items-center bg-[#f9f7f4] border-b border-zinc-200/80 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 min-w-[750px]">
              <div className="w-36 shrink-0">Nº Certificado</div>
              <div className="w-36 shrink-0">Tipo / Categoría</div>
              <div className="w-28 shrink-0">Fecha</div>
              <div className="flex-1 min-w-0">Cliente / Centro</div>
              <div className="w-28 shrink-0">Estado</div>
              <div className="w-28 shrink-0 text-right">Acciones</div>
            </div>

            <div className="divide-y divide-zinc-100 min-w-[750px] md:min-w-0">
              {sortedAndFilteredCertificados.map((cert) => {
                const cliente = clientes.find(c => c.id === cert.clienteId);
                const centro = centros.find(c => c._docId === cert.centroId || c.id === cert.centroId);
                const isPositivo = cert.estado === 'Favorable' || cert.estado === 'Positivo (Favorable)';
                const catInfo = CATEGORIAS_CERTIFICADO.find(c => c.id === (cert.tipoCertificado || 'revision')) || CATEGORIAS_CERTIFICADO[0];

                return (
                  <div
                    key={cert.id}
                    className="flex flex-col md:flex-row md:items-center px-4 py-3.5 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                    onClick={() => handleViewDetail(cert)}
                  >
                    {/* Mobile */}
                    <div className="flex md:hidden items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-lg">{cert.numeroMantenimiento}</span>
                        {cert.esManual && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Manual</span>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleViewDetail(cert); }} className="p-1 text-zinc-400 hover:text-red-600 rounded-xl">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex md:hidden items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${catInfo.colorBadge}`}>
                        {catInfo.nombre}
                      </span>
                      <span className="text-xs text-zinc-400">·</span>
                      <span className="text-xs text-zinc-500">{new Date(cert.fechaCreacion).toLocaleDateString()}</span>
                    </div>
                    <div className="flex md:hidden mb-2">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{cliente?.nombre || 'Desconocido'}</p>
                        <p className="text-xs text-zinc-500">{centro?.nombre || 'Sin centro'}</p>
                      </div>
                    </div>
                    <div className="flex md:hidden items-center justify-between mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold uppercase ${
                        isPositivo 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {isPositivo ? <CheckCircle2 className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                        {isPositivo ? 'Favorable' : 'Anomalías / Obs'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerarPDF(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewPDF(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all"
                          title="Ver PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCertificado(cert.id); }}
                          className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Desktop cells */}
                    <div className="hidden md:flex items-center w-full">
                      <div className="w-36 shrink-0 flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-zinc-700">{cert.numeroMantenimiento}</span>
                        {cert.esManual && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase">Manual</span>}
                      </div>
                      <div className="w-36 shrink-0 pr-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold truncate max-w-full ${catInfo.colorBadge}`}>
                          {catInfo.nombre.replace('Certificado de ', '').replace('Certificado ', '')}
                        </span>
                      </div>
                      <div className="w-28 shrink-0 text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {new Date(cert.fechaCreacion).toLocaleDateString()}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-black transition-colors">
                          {cert.tituloCertificado || cliente?.nombre || 'Desconocido'}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {cliente?.nombre ? `${cliente.nombre} · ${centro?.nombre || 'Sin centro'}` : (centro?.nombre || 'Sin centro')}
                        </p>
                      </div>
                      <div className="w-28 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase ${
                          isPositivo 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {isPositivo ? <CheckCircle2 className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
                          {isPositivo ? 'Favorable' : 'Observaciones'}
                        </span>
                      </div>
                      <div className="w-28 shrink-0 flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewDetail(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-xl transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerarPDF(cert); }}
                          className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-xl transition-all"
                          title="Descargar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCertificado(cert.id); }}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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

      {/* ── MODAL PARA CREAR CERTIFICADO MANUAL ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-zinc-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-black" /> Crear Certificado Manual
                </h2>
                <p className="text-xs text-zinc-500">Emitir certificado oficial de forma manual.</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualCert} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {/* Tipo de Certificado */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">Tipo de Certificado *</label>
                <select
                  value={formManualCert.tipoCertificado}
                  onChange={e => handleCategoryChangeInForm(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition-all text-zinc-900"
                >
                  {CATEGORIAS_CERTIFICADO.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Título Personalizado si es Genérico */}
              {formManualCert.tipoCertificado === 'generico' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">Título Personalizado del Certificado *</label>
                  <input
                    required
                    type="text"
                    value={formManualCert.tituloCertificado}
                    onChange={e => setFormManualCert({ ...formManualCert, tituloCertificado: e.target.value })}
                    placeholder="Ej. CERTIFICADO DE GARANTÍA Y CONFORMIDAD TÉCNICA"
                    className="w-full px-4 py-2.5 bg-amber-50/70 border border-amber-300 rounded-xl text-sm font-bold text-amber-950 placeholder-amber-700/40 outline-none focus:bg-amber-100 focus:border-amber-500 transition-all"
                  />
                </div>
              )}

              {/* Cliente y Centro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">Seleccionar Cliente *</label>
                  <select
                    required
                    value={formManualCert.clienteId}
                    onChange={e => setFormManualCert({ ...formManualCert, clienteId: e.target.value, centroId: '' })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-black transition-all text-zinc-900"
                  >
                    <option value="">-- Elige un cliente --</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.cif})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">Centro de Trabajo *</label>
                  <select
                    required
                    disabled={!formManualCert.clienteId}
                    value={formManualCert.centroId}
                    onChange={e => setFormManualCert({ ...formManualCert, centroId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-black transition-all text-zinc-900 disabled:opacity-50"
                  >
                    <option value="">-- Elige un centro --</option>
                    {centrosFiltradosPorCliente.map(c => (
                      <option key={c._docId || c.id} value={c._docId || c.id}>{c.nombre} ({c.poblacion})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ref, Fecha, Técnico y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">Nº Referencia</label>
                  <input
                    type="text"
                    value={formManualCert.numeroMantenimiento}
                    onChange={e => setFormManualCert({ ...formManualCert, numeroMantenimiento: e.target.value })}
                    placeholder="CERT-2026-0001"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold outline-none focus:bg-white focus:border-black transition-all text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={formManualCert.fechaCreacion}
                    onChange={e => setFormManualCert({ ...formManualCert, fechaCreacion: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-black transition-all text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">Técnico</label>
                  <select
                    value={formManualCert.tecnicoId}
                    onChange={e => setFormManualCert({ ...formManualCert, tecnicoId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-black transition-all text-zinc-900"
                  >
                    <option value="">-- Sin asignar --</option>
                    {tecnicos.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre} {t.apellidos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">Resultado</label>
                  <select
                    value={formManualCert.estado}
                    onChange={e => setFormManualCert({ ...formManualCert, estado: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-black transition-all text-zinc-900"
                  >
                    <option value="Favorable">Favorable</option>
                    <option value="Con Observaciones">Con Observaciones</option>
                    <option value="No Favorable">No Favorable</option>
                  </select>
                </div>
              </div>

              {/* Texto del Certificado */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">Texto / Declaración del Certificado</label>
                <textarea
                  rows={4}
                  value={formManualCert.textoCertificado}
                  onChange={e => setFormManualCert({ ...formManualCert, textoCertificado: e.target.value })}
                  placeholder="Redacta la declaración oficial de certificación..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-black transition-all text-zinc-900 resize-none leading-relaxed"
                />
              </div>

              {/* Observaciones adicionales */}
              <div>
                <label className="block text-xs font-bold text-amber-800 uppercase mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Observaciones Adicionales (Resaltadas en Amarillo)
                </label>
                <textarea
                  rows={2}
                  value={formManualCert.observaciones}
                  onChange={e => setFormManualCert({ ...formManualCert, observaciones: e.target.value })}
                  placeholder="Anotaciones importantes o aclaraciones técnicas..."
                  className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-950 placeholder-amber-700/40 outline-none focus:bg-amber-100 focus:border-amber-400 transition-all resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" /> Guardar y Emitir Certificado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          const centro = centros.find(c => c._docId === selectedCert.centroId || c.id === selectedCert.centroId);
          const tecnico = tecnicos.find(t => t.id === selectedCert.tecnicoId);
          const isPositivo = selectedCert.estado === 'Favorable' || selectedCert.estado === 'Positivo (Favorable)';
          const sistemasDelCentro = sistemas.filter((s: any) => s.centroId === selectedCert.centroId || (centro && s.centroId === centro.id));
          const catInfo = CATEGORIAS_CERTIFICADO.find(c => c.id === (selectedCert.tipoCertificado || 'revision')) || CATEGORIAS_CERTIFICADO[0];

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${isPositivo ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                  {isPositivo ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${catInfo.colorBadge}`}>
                      {catInfo.nombre}
                    </span>
                    {selectedCert.esManual && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Manual</span>}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mt-0.5">{selectedCert.tituloCertificado || selectedCert.numeroMantenimiento}</h3>
                  <p className="text-xs text-zinc-500 font-mono">{selectedCert.numeroMantenimiento}</p>
                </div>
                <div className="ml-auto">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                    isPositivo 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {isPositivo ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {selectedCert.estado}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Cliente y Centro</h4>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Cliente</p>
                      <p className="text-sm font-bold text-zinc-900">{cliente?.nombre || 'Desconocido'}</p>
                      {cliente && <p className="text-xs text-zinc-500">{cliente.cif}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Centro de Trabajo</p>
                      <p className="text-sm font-bold text-zinc-900">{centro?.nombre || 'Sin centro'}</p>
                      {centro && <p className="text-xs text-zinc-500">{centro.direccion}, {centro.poblacion}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Información General</h4>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Técnico Actuante</p>
                      <p className="text-sm font-semibold text-zinc-900">{tecnico ? `${tecnico.nombre} ${tecnico.apellidos}` : 'No asignado'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Fecha de Emisión</p>
                      <p className="text-sm font-semibold text-zinc-900">{new Date(selectedCert.fechaCreacion).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Declaración de certificación */}
              {selectedCert.textoCertificado && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Declaración Oficial</h4>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs font-medium text-zinc-800 leading-relaxed">
                    {selectedCert.textoCertificado}
                  </div>
                </div>
              )}

              {/* Observaciones destacadas en amarillo */}
              {selectedCert.observaciones && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Observaciones Adicionales
                  </h4>
                  <p className="text-xs font-semibold text-amber-950 bg-amber-100/90 border-2 border-amber-300 rounded-xl p-3.5 whitespace-pre-wrap shadow-xs">
                    {selectedCert.observaciones}
                  </p>
                </div>
              )}

              {/* Sistemas del centro */}
              {sistemasDelCentro.length > 0 && (
                <div className="pt-4 border-t border-zinc-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Sistemas Vinculados al Centro</h4>
                  <div className="flex flex-wrap gap-2">
                    {sistemasDelCentro.map((s: any) => (
                      <span key={s.id} className="bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-700">
                        {s.nombre || s.categoria || 'Sistema'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  onClick={() => { setIsDetailOpen(false); handleViewPDF(selectedCert); }}
                  className="flex items-center gap-1.5 bg-zinc-100 text-zinc-800 border border-zinc-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Ver PDF
                </button>
                <button
                  onClick={() => { setIsDetailOpen(false); handleGenerarPDF(selectedCert); }}
                  className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors"
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