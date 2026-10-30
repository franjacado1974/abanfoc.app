import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, X, Plus, Clock, CheckCircle, FileText, Trash2, Edit, Save,
  ChevronDown, ArrowLeft, Wrench, HardHat, ReceiptText, Gauge,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { 
  subscribePedidos, addPedido, updatePedido, deletePedido, 
  subscribeClientes, subscribeCentros, subscribePresupuestos,
  subscribeEmpresas, subscribeTecnicos, subscribeAlbaranes,
  addReparacion, addInstalacion,
  obtenerSiguienteNumeroPedido, extraerSufijoSecuencia, obtenerEmpresaPorDefecto,
  type Pedido, type Presupuesto, type Cliente, type Centro,
  type Empresa, type Tecnico, type Albaran,
  type ReparacionItem, type InstalacionItem
} from './firebase';
import { generarPresupuestoPDF } from './pdfGenerator';

const ESTADOS = [
  { valor: 'Pendiente' as const, color: 'bg-amber-100 text-amber-700 border-amber-200', icono: Clock },
  { valor: 'En Proceso' as const, color: 'bg-sky-100 text-sky-700 border-sky-200', icono: Clock },
  { valor: 'Completado' as const, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icono: CheckCircle },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getMonthFromDate = (dateStr?: string): string => {
  if (!dateStr) return MESES[new Date().getMonth()];
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length >= 2) {
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) return MESES[mIdx];
  }
  return MESES[new Date().getMonth()];
};

const formatMoneda = (valor: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(valor || 0);

const formatFecha = (iso: string | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function Pedidos() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'referencia' | 'fecha' | 'estado'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limitePedidos, setLimitePedidos] = useState<number | 'todos'>(10);

  const handleSort = (field: 'referencia' | 'fecha' | 'estado') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'fecha' ? 'desc' : 'asc');
    }
  };

  const [form, setForm] = useState<Pedido>({
    id: '',
    empresaId: '',
    clienteId: '',
    centroId: '',
    fechaCreacion: new Date().toISOString(),
    fechaPrevista: '',
    tipoPedido: '',
    titulo: '',
    numeroPedido: '',
    items: [],
    estado: 'Pendiente',
    presupuestoId: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    const unsubPedidos = subscribePedidos(setPedidos);
    const unsubClientes = subscribeClientes(setClientes);
    const unsubCentros = subscribeCentros(setCentros);
    const unsubPresupuestos = subscribePresupuestos(setPresupuestos);
    const unsubEmpresas = subscribeEmpresas(setEmpresas);
    const unsubTecnicos = subscribeTecnicos(setTecnicos);
    const unsubAlbaranes = subscribeAlbaranes(setAlbaranes);
    return () => { 
      unsubPedidos(); 
      unsubClientes(); 
      unsubCentros(); 
      unsubPresupuestos(); 
      unsubEmpresas();
      unsubTecnicos();
      unsubAlbaranes();
    };
  }, []);

  // Detectar si venimos de aprobar un presupuesto para abrir Nuevo Pedido de inmediato
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromPresupuestoId = params.get('fromPresupuesto');
    if (fromPresupuestoId && presupuestos.length > 0) {
      const pres = presupuestos.find(p => (p as any)._docId === fromPresupuestoId || p.id === fromPresupuestoId);
      if (pres) {
        handleCrearDesdePresupuesto(pres);
      }
    }
  }, [location.search, presupuestos]);

  const presupuestosAprobados = useMemo(() =>
    presupuestos.filter(p =>
      p.estado === 'Aprobado' &&
      !pedidos.some(ped =>
        ped.presupuestoId === p.id ||
        ped.presupuestoId === (p as any)._docId ||
        (p.pedidoId && ped.numeroPedido === p.pedidoId)
      )
    ),
    [presupuestos, pedidos]
  );

  const filteredPedidos = useMemo(() => {
    let result = [...pedidos];
    if (statusFilter !== 'Todos') {
      result = result.filter(p => p.estado === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => {
        const cliNombre = clientes.find(c => c.id === p.clienteId || (c as any)._docId === p.clienteId)?.nombre || (p as any).nombreCliente || '';
        const cenNombre = centros.find(c => c.id === p.centroId || (c as any)._docId === p.centroId)?.nombre || (p as any).nombreCentro || '';
        return (
          (p.titulo || '').toLowerCase().includes(term) ||
          (p.numeroPedido || '').toLowerCase().includes(term) ||
          cliNombre.toLowerCase().includes(term) ||
          cenNombre.toLowerCase().includes(term)
        );
      });
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'referencia') {
        const refA = (a.numeroPedido || a.id || '').toLowerCase();
        const refB = (b.numeroPedido || b.id || '').toLowerCase();
        cmp = refA.localeCompare(refB, 'es', { numeric: true });
      } else if (sortField === 'estado') {
        cmp = (a.estado || '').localeCompare(b.estado || '', 'es');
      } else {
        const dateA = new Date(a.fechaCreacion || 0).getTime();
        const dateB = new Date(b.fechaCreacion || 0).getTime();
        cmp = dateA - dateB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [pedidos, searchTerm, clientes, centros, statusFilter, sortField, sortOrder]);

  const pedidosAMostrar = limitePedidos === 'todos'
    ? filteredPedidos
    : filteredPedidos.slice(0, Number(limitePedidos));

  const getEstadoInfo = (estado: string) => ESTADOS.find(e => e.valor === estado) || ESTADOS[0];

  const handleNuevo = async () => {
    setEditingId(null);
    const nextPedido = await obtenerSiguienteNumeroPedido();
    const defaultEmpresaId = obtenerEmpresaPorDefecto(empresas);
    setForm({
      id: '',
      empresaId: defaultEmpresaId,
      clienteId: '',
      centroId: '',
      titulo: '',
      fechaCreacion: new Date().toISOString(),
      fechaPrevista: new Date().toISOString().slice(0, 10),
      tipoPedido: '',
      items: [{ cantidad: 1, concepto: 'Trabajo', descripcion: '', precioUnidad: 0, subtotal: 0 }],
      estado: 'Pendiente',
      presupuestoId: '',
      numeroPedido: nextPedido,
      notas: '',
    });
    setView('form');
  };

  const handleCrearDesdePresupuesto = (p: Presupuesto) => {
    setEditingId(null);
    const sufijo = extraerSufijoSecuencia(p.numeroPresupuesto || p.id);
    const codigoPDV = sufijo ? `PDV.${sufijo}` : `PDV.${new Date().getFullYear().toString().slice(-2)}${String(pedidos.length + 1).padStart(3, '0')}`;
    setForm({
      id: '',
      empresaId: (p as any).empresaId || '',
      clienteId: p.clienteId,
      centroId: (p as any).centroId || '',
      titulo: p.titulo,
      fechaCreacion: new Date().toISOString(),
      fechaPrevista: new Date().toISOString().slice(0, 10),
      tipoPedido: (p as any).tipoTrabajo || '',
      items: p.lineas ? p.lineas.filter(l => l.tipo !== 'capitulo').map(l => ({ cantidad: l.cantidad, concepto: l.concepto, descripcion: l.descripcion || '', precioUnidad: l.precioUnidad, subtotal: l.subtotal })) : [],
      estado: 'Pendiente',
      presupuestoId: p.id,
      numeroPedido: codigoPDV,
      notas: `Pedido creado desde presupuesto: ${p.numeroPresupuesto || p.id}`,
    });
    setView('form');
  };

  const handleEdit = (ped: Pedido) => {
    setEditingId(ped.id || null);
    setForm({ ...ped });
    setView('form');
  };

  // Guarda el pedido en Firebase (colección "pedidos") y genera tarea si corresponde
  const handleSave = async () => {
    if (!form.titulo.trim() || !form.clienteId) {
      alert('Rellena el título y selecciona un cliente.');
      return;
    }
    try {
      const finalPedido = form.numeroPedido?.trim() || (!editingId ? await obtenerSiguienteNumeroPedido() : '');
      let savedForm: Pedido = { ...form, numeroPedido: finalPedido };

      // Si se especificó un tipo de pedido y es un pedido nuevo (o no tenía tarea previa generada)
      if (form.tipoPedido && !form.tareaGeneradaId && !editingId) {
        const fechaUso = form.fechaPrevista || (form.fechaCreacion ? form.fechaCreacion.slice(0, 10) : new Date().toISOString().slice(0, 10));
        const mesUso = getMonthFromDate(fechaUso);

        const centroObj = centros.find(c => (c._docId || c.id) === form.centroId);
        const clienteObj = clientes.find(c => c.id === form.clienteId || (c as any)._docId === form.clienteId);
        let lugar = '';
        if (centroObj && clienteObj) {
          lugar = `${centroObj.nombre} (${clienteObj.nombre})`;
        } else if (centroObj) {
          lugar = centroObj.nombre;
        } else if (clienteObj) {
          lugar = clienteObj.nombre;
        }

        const notaInicial = form.notas ? form.notas.trim() : `Pedido: ${finalPedido || form.titulo}`;

        if (form.tipoPedido === 'Reparación') {
          const newRepId = `REP-${Date.now().toString().slice(-6)}`;
          const newRep: ReparacionItem = {
            id: newRepId,
            reparacion: form.titulo.trim(),
            clienteId: form.clienteId,
            clienteNombre: clienteObj?.nombre || '',
            centroId: form.centroId || '',
            lugar: lugar.trim(),
            tecnicoAsignado: '',
            comercial: '',
            estado: 'Pendiente',
            fechaCreacion: new Date().toISOString(),
            fecha: fechaUso,
            mes: mesUso,
            observaciones: notaInicial,
            nota: notaInicial,
            pedidoId: finalPedido,
            numeroPedido: finalPedido,
            presupuestoId: form.presupuestoId || ''
          };
          await addReparacion(newRep);
          savedForm.tareaGeneradaId = newRepId;

          try {
            const raw = localStorage.getItem('firecheck_db_reparaciones');
            const arr = raw ? JSON.parse(raw) : [];
            localStorage.setItem('firecheck_db_reparaciones', JSON.stringify([newRep, ...arr]));
          } catch {}
        } else if (form.tipoPedido === 'Instalación') {
          const newInsId = `INS-${Date.now().toString().slice(-6)}`;
          const newIns: InstalacionItem = {
            id: newInsId,
            instalacion: form.titulo.trim(),
            clienteId: form.clienteId,
            clienteNombre: clienteObj?.nombre || '',
            centroId: form.centroId || '',
            lugar: lugar.trim(),
            tecnicoAsignado: '',
            comercial: '',
            estado: 'Pendiente',
            fechaCreacion: new Date().toISOString(),
            fecha: fechaUso,
            mes: mesUso,
            observaciones: notaInicial,
            nota: notaInicial,
            pedidoId: finalPedido,
            numeroPedido: finalPedido,
            presupuestoId: form.presupuestoId || ''
          };
          await addInstalacion(newIns);
          savedForm.tareaGeneradaId = newInsId;

          try {
            const raw = localStorage.getItem('firecheck_db_instalaciones');
            const arr = raw ? JSON.parse(raw) : [];
            localStorage.setItem('firecheck_db_instalaciones', JSON.stringify([newIns, ...arr]));
          } catch {}
        }
      }

      if (editingId) {
        const docId = (savedForm as any)._docId || editingId;
        await updatePedido(docId, savedForm as Partial<Pedido>);
      } else {
        await addPedido(savedForm);
      }
      setView('list');
      setEditingId(null);
    } catch (e) {
      console.error('Error guardando pedido en Firebase:', e);
      alert('Error al guardar el pedido.');
    }
  };

  const handleDelete = async (ped: Pedido) => {
    if (!confirm(`¿Eliminar el pedido "${ped.titulo}"?`)) return;
    const docId = (ped as any)._docId || ped.id;
    try { await deletePedido(docId); } catch (e) { console.error(e); }
  };

  const handleCambiarEstado = async (ped: Pedido, estado: Pedido['estado']) => {
    const docId = (ped as any)._docId || ped.id;
    try { await updatePedido(docId, { estado } as Partial<Pedido>); } catch (e) { console.error(e); }
  };

  // Abrir Albaranes directamente con los datos precargados desde el pedido de ventas
  const handleOpenCrearAlbaran = (ped: Pedido) => {
    let numeroPedido = ped.numeroPedido || (ped.id ? `PDV ${ped.id.replace(/^(PDV|PRV|PRE|PED)[-\s]*/i, '')}` : '');
    let titulo = ped.titulo || 'Trabajo de Pedido';

    // Buscar si proviene de un presupuesto vinculado para heredar líneas con detalle y familia
    const matchPresupuesto = presupuestos.find(p => 
      (ped.presupuestoId && (p.id === ped.presupuestoId || (p as any)._docId === ped.presupuestoId)) ||
      (numeroPedido && (
        p.numeroPresupuesto === numeroPedido ||
        `PDV ${p.numeroPresupuesto?.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}` === numeroPedido
      ))
    );

    const matchCentro = centros.find(c => 
      (ped.centroId && (c.id === ped.centroId || (c as any)._docId === ped.centroId)) ||
      (matchPresupuesto?.centroId && (c.id === matchPresupuesto.centroId || (c as any)._docId === matchPresupuesto.centroId)) ||
      (ped.clienteId && c.clienteId === ped.clienteId)
    );

    const rawClienteId = ped.clienteId || matchPresupuesto?.clienteId || matchCentro?.clienteId || '';
    const rawClienteNombre = (ped as any).nombreCliente || matchPresupuesto?.nombreCliente || '';
    const matchCliente = clientes.find(c =>
      (rawClienteId && (c.id === rawClienteId || (c as any)._docId === rawClienteId)) ||
      (rawClienteNombre && c.nombre.trim().toLowerCase() === rawClienteNombre.trim().toLowerCase())
    );

    let clienteId = matchCliente?.id || rawClienteId || '';
    let clienteNombreLibre = !clienteId && rawClienteNombre ? rawClienteNombre : '';
    let centroId = ped.centroId || matchPresupuesto?.centroId || matchCentro?._docId || matchCentro?.id || '';
    let centroNombreLibre = !centroId && (ped as any).nombreCentro ? (ped as any).nombreCentro : '';
    let empresaId = ped.empresaId || (matchPresupuesto as any)?.empresaId || matchCentro?.empresaId || (empresas.length > 0 ? (empresas[0]._docId || empresas[0].id || '') : '');

    if (matchPresupuesto?.titulo) {
      titulo = matchPresupuesto.titulo;
    }

    // Cargar artículos de la caché local para obtener la familia
    let articulosList: any[] = [];
    try {
      articulosList = JSON.parse(localStorage.getItem('firecheck_db_articulos') || '[]');
    } catch {
      articulosList = [];
    }

    let items: { cantidad: number; concepto: string; descripcion: string; precioUnidad: number; subtotal: number }[] = [];

    if (matchPresupuesto?.lineas && matchPresupuesto.lineas.length > 0) {
      items = matchPresupuesto.lineas
        .filter(l => l.tipo !== 'capitulo')
        .map(l => {
          const art = articulosList.find(a => 
            (l.codigo && a.codigo && a.codigo === l.codigo) ||
            (a.nombre && l.concepto && a.nombre.toLowerCase().trim() === l.concepto.toLowerCase().trim())
          );
          const familia = l.familia || art?.familia || l.concepto || ped.tipoPedido || 'Trabajo';
          const descripcion = l.descripcion || l.concepto || '';
          const cantidad = Number(l.cantidad) || 1;
          const precioUnidad = Number(l.precioUnidad) || 0;
          return {
            cantidad,
            concepto: familia,
            descripcion,
            precioUnidad,
            subtotal: cantidad * precioUnidad
          };
        });
    } else if (ped.items && ped.items.length > 0) {
      items = ped.items.map(l => {
        const art = articulosList.find(a => 
          (a.nombre && l.concepto && a.nombre.toLowerCase().trim() === l.concepto.toLowerCase().trim())
        );
        const familia = (l as any).familia || art?.familia || l.concepto || ped.tipoPedido || 'Trabajo';
        const descripcion = l.descripcion || l.concepto || '';
        const cantidad = Number(l.cantidad) || 1;
        const precioUnidad = Number(l.precioUnidad) || 0;
        return {
          cantidad,
          concepto: familia,
          descripcion,
          precioUnidad,
          subtotal: cantidad * precioUnidad
        };
      });
    } else {
      items = [
        {
          cantidad: 1,
          concepto: ped.tipoPedido || 'Trabajo',
          descripcion: ped.titulo || '',
          precioUnidad: 0,
          subtotal: 0
        }
      ];
    }

    navigate('/albaranes', {
      state: {
        prefillAlbaran: {
          empresaId,
          clienteId,
          centroId,
          clienteNombreLibre,
          centroNombreLibre,
          tecnicoId: tecnicos.length > 0 ? tecnicos[0].id : '',
          numeroPedido,
          titulo,
          fechaCreacion: ped.fechaCreacion || new Date().toISOString(),
          items
        }
      }
    });
  };

  // Descargar / Ver Pedido de Venta (PDV) en PDF
  const handleDescargarPDV = async (ped: Pedido) => {
    // 1. Buscar presupuesto vinculado
    const matchPresupuesto = presupuestos.find(p => 
      (ped.presupuestoId && (p.id === ped.presupuestoId || (p as any)._docId === ped.presupuestoId)) ||
      (ped.numeroPedido && (
        p.numeroPresupuesto === ped.numeroPedido ||
        `PDV ${p.numeroPresupuesto?.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}` === ped.numeroPedido ||
        p.id === ped.numeroPedido
      ))
    );

    // Buscar centro y cliente
    const matchCentro = centros.find(c => 
      (ped.centroId && (c.id === ped.centroId || (c as any)._docId === ped.centroId)) ||
      (matchPresupuesto?.centroId && (c.id === matchPresupuesto.centroId || (c as any)._docId === matchPresupuesto.centroId)) ||
      (c.clienteId === ped.clienteId)
    );

    const clienteId = ped.clienteId || matchPresupuesto?.clienteId || matchCentro?.clienteId;
    const clienteObj = clientes.find(c => (c as any)._docId === clienteId || c.id === clienteId);
    const nombreCliente = clienteObj?.nombre || matchPresupuesto?.nombreCliente || (ped as any)?.nombreCliente || 'Cliente';

    // Empresa mantenedora
    const empresaId = ped.empresaId || (matchPresupuesto as any)?.empresaId || matchCentro?.empresaId;
    let empresaSeleccionada = empresas.find(e => (e as any)._docId === empresaId || (e as any).id === empresaId);
    if (!empresaSeleccionada && empresas.length > 0) {
      empresaSeleccionada = empresas[0];
    }

    // Código de pedido (ej: PDV XXXXXX)
    let codigoPDV = ped.numeroPedido || '';
    if (!codigoPDV && matchPresupuesto?.numeroPresupuesto) {
      codigoPDV = `PDV ${matchPresupuesto.numeroPresupuesto.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}`;
    }
    if (!codigoPDV) {
      codigoPDV = ped.id ? (ped.id.startsWith('PDV') ? ped.id : `PDV ${ped.id.replace(/^(PRV|PRE|PED)[-\s]*/i, '')}`) : `PDV-${Date.now().toString().slice(-6)}`;
    }

    // Líneas del pedido
    let lineasPDF: { familia?: string; concepto: string; descripcion?: string; codigo?: string; fotoUrl?: string; cantidad: number; precioUnidad: number; subtotal: number }[] = [];

    if (matchPresupuesto?.lineas && matchPresupuesto.lineas.length > 0) {
      lineasPDF = matchPresupuesto.lineas.map(l => ({
        familia: l.familia,
        concepto: l.concepto,
        descripcion: l.descripcion,
        codigo: l.codigo,
        fotoUrl: l.fotoUrl,
        cantidad: Number(l.cantidad) || 1,
        precioUnidad: Number(l.precioUnidad) || 0,
        subtotal: Number(l.subtotal) || ((Number(l.cantidad) || 1) * (Number(l.precioUnidad) || 0))
      }));
    } else if (ped.items && ped.items.length > 0) {
      lineasPDF = ped.items.map(l => ({
        familia: (l as any).familia,
        concepto: l.concepto,
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad) || 1,
        precioUnidad: Number(l.precioUnidad) || 0,
        subtotal: Number(l.subtotal) || ((Number(l.cantidad) || 1) * (Number(l.precioUnidad) || 0))
      }));
    } else {
      lineasPDF = [{
        concepto: ped.tipoPedido || 'Trabajo',
        cantidad: 1,
        precioUnidad: 0,
        subtotal: 0
      }];
    }

    const subtotal = matchPresupuesto?.subtotal ?? lineasPDF.reduce((sum, l) => sum + l.subtotal, 0);
    const iva = matchPresupuesto?.iva ?? (subtotal * 0.21);
    const total = matchPresupuesto?.total ?? (subtotal + iva);
    const notas = matchPresupuesto?.notas || ped.notas || '';
    const fechaCreacion = ped.fechaCreacion || matchPresupuesto?.fechaCreacion || new Date().toISOString();

    await generarPresupuestoPDF({
      titulo: matchPresupuesto?.titulo || ped.titulo || 'Pedido de Venta',
      numeroPresupuesto: codigoPDV,
      nombreCliente,
      cliente: clienteObj,
      fechaCreacion,
      estado: 'Aprobado',
      lineas: lineasPDF,
      subtotal,
      iva,
      total,
      notas,
      esPedido: true,
      tituloDocumento: 'PEDIDO DE VENTA'
    }, empresaSeleccionada);
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { cantidad: 1, concepto: 'Trabajo', descripcion: '', precioUnidad: 0, subtotal: 0 }] });
  };

  const removeItem = (index: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const items = form.items.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        if (field === 'cantidad' || field === 'precioUnidad') {
          updated.subtotal = (updated.cantidad || 0) * (updated.precioUnidad || 0);
        }
        return updated;
      }
      return item;
    });
    setForm({ ...form, items });
  };

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Pedidos de Venta</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-1">Registro de presupuestos aceptados convertidos en pedido, listos para pasar a trabajo y albarán.</p>
          </div>

          {/* Pestañas + buscador y botón */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
            {/* Pestañas */}
            <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
              <button
                onClick={() => setStatusFilter('Todos')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  statusFilter === 'Todos'
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 ${statusFilter === 'Todos' ? 'text-red-600' : 'text-zinc-400'}`} />
                Todos
                <span className={`text-[10px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                  statusFilter === 'Todos' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {pedidos.length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('Pendiente')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  statusFilter === 'Pendiente'
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${statusFilter === 'Pendiente' ? 'text-red-600' : 'text-zinc-400'}`} />
                Pendientes
                <span className={`text-[10px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                  statusFilter === 'Pendiente' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {pedidos.filter(p => p.estado === 'Pendiente').length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('En Proceso')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  statusFilter === 'En Proceso'
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${statusFilter === 'En Proceso' ? 'text-red-600' : 'text-zinc-400'}`} />
                En Proceso
                <span className={`text-[10px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                  statusFilter === 'En Proceso' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {pedidos.filter(p => p.estado === 'En Proceso').length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('Completado')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  statusFilter === 'Completado'
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
                }`}
              >
                <CheckCircle className={`w-3.5 h-3.5 ${statusFilter === 'Completado' ? 'text-red-600' : 'text-zinc-400'}`} />
                Completados
                <span className={`text-[10px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                  statusFilter === 'Completado' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {pedidos.filter(p => p.estado === 'Completado').length}
                </span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-zinc-200/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none text-sm text-zinc-950 shadow-sm"
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={handleNuevo} 
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Pedido
              </button>
            </div>
          </div>

          {presupuestosAprobados.length > 0 && (
            <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-xs font-bold text-emerald-700 uppercase mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Presupuestos aprobados pendientes de pedido
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {presupuestosAprobados.map(p => (
                  <button key={p.id} onClick={() => handleCrearDesdePresupuesto(p)} className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left cursor-pointer">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate">{p.titulo}</p>
                      <p className="text-[10px] text-zinc-500">{p.nombreCliente} — {formatMoneda(p.total)}</p>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TABLA DE PEDIDOS */}
          {filteredPedidos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 border-dashed p-16 text-center">
              <FileText className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-2">{searchTerm ? 'Sin resultados' : 'No hay pedidos registrados'}</h3>
              <p className="text-zinc-500 text-sm">Cuando aceptes un presupuesto y lo marques como pedido, aparecerá registrado en esta tabla.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="bg-zinc-200/90 text-zinc-700 font-extrabold uppercase tracking-wider text-xs border-b border-zinc-300">
                      <th
                        onClick={() => handleSort('referencia')}
                        className="px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group whitespace-nowrap"
                        title="Ordenar por número de pedido"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Nº Pedido</span>
                          {sortField === 'referencia' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('fecha')}
                        className="px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group whitespace-nowrap"
                        title="Ordenar por fecha"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Fecha</span>
                          {sortField === 'fecha' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Centro</th>
                      <th className="px-4 py-3 text-left">Título / Trabajo</th>
                      <th
                        onClick={() => handleSort('estado')}
                        className="px-4 py-3 text-left cursor-pointer hover:bg-zinc-300/80 transition-colors select-none group whitespace-nowrap"
                        title="Ordenar por estado"
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <span>Estado</span>
                          {sortField === 'estado' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" /> : <ArrowDown className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Importe</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {pedidosAMostrar.map((ped, index) => {
                      const estadoInfo = getEstadoInfo(ped.estado);
                      const EstadoIcono = estadoInfo.icono;
                      const matchPresupuesto = presupuestos.find(p =>
                        (ped.presupuestoId && (p.id === ped.presupuestoId || (p as any)._docId === ped.presupuestoId)) ||
                        (ped.numeroPedido && p.pedidoId === ped.numeroPedido)
                      );
                      const cliente = clientes.find(c => c.id === ped.clienteId || (c as any)._docId === ped.clienteId);
                      const centro = centros.find(c => c.id === ped.centroId || (c as any)._docId === ped.centroId);
                      const nombreCliente = cliente?.nombre || (ped as any).nombreCliente || matchPresupuesto?.nombreCliente || 'Cliente';
                      const nombreCentro = centro?.nombre || (ped as any).nombreCentro || '—';

                      const codigoPDV = ped.numeroPedido || (ped.id ? `PDV ${ped.id.replace(/^(PDV|PRV|PRE|PED)[-\s]*/i, '')}` : 'PDV');
                      const codigoPRV = matchPresupuesto?.numeroPresupuesto || (ped.presupuestoId ? `PRV ${ped.presupuestoId.replace(/^(PDV|PRV|PRE)[-\s]*/i, '')}` : '');

                      const albaranAsociado = albaranes.find(alb =>
                        (ped.numeroPedido && alb.numeroPedido === ped.numeroPedido) ||
                        (codigoPDV && alb.numeroPedido === codigoPDV)
                      );

                      const importeTotal = (ped as any).total || matchPresupuesto?.total || ped.items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
                      const rowKey = ped.id || (ped as any)._docId || codigoPDV;

                      return (
                        <tr 
                          key={rowKey} 
                          className={`transition-all duration-150 group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'} hover:bg-amber-100/90 hover:shadow-xs`}
                        >
                          {/* Nº Pedido / Presupuesto */}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80">
                                {codigoPDV}
                              </span>
                              {codigoPRV && (
                                <span className="text-[10px] font-mono font-semibold text-zinc-500">
                                  Origen: {codigoPRV}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <p className="text-xs font-semibold text-zinc-600">{formatFecha(ped.fechaCreacion)}</p>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-2.5">
                            <p className="text-sm text-zinc-800 font-medium">{nombreCliente}</p>
                          </td>

                          {/* Centro */}
                          <td className="px-4 py-2.5">
                            <p className="text-sm text-zinc-600">{nombreCentro}</p>
                          </td>

                          {/* Título y Tipo de Trabajo */}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col items-start gap-1">
                              <p className="text-sm font-bold text-zinc-900 truncate max-w-[220px]" title={ped.titulo}>
                                {ped.titulo}
                              </p>
                              {ped.tipoPedido && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                  ped.tipoPedido === 'Reparación'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : ped.tipoPedido === 'Instalación'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                                    : 'bg-sky-50 text-sky-800 border-sky-300'
                                }`}>
                                  {ped.tipoPedido === 'Reparación' ? (
                                    <Wrench className="w-2.5 h-2.5 text-amber-600" />
                                  ) : ped.tipoPedido === 'Instalación' ? (
                                    <HardHat className="w-2.5 h-2.5 text-indigo-600" />
                                  ) : (
                                    <Gauge className="w-2.5 h-2.5 text-sky-600" />
                                  )}
                                  {ped.tipoPedido}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Estado + Albarán vinculado */}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <div className="relative inline-flex items-center gap-1">
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 uppercase tracking-wider ${estadoInfo.color}`}>
                                  <EstadoIcono className="w-3 h-3" /> {estadoInfo.valor}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenStatusMenuId(openStatusMenuId === rowKey ? null : rowKey);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                  title="Cambiar estado del pedido"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                {openStatusMenuId === rowKey && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenuId(null)} />
                                    <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 py-1 min-w-[140px] z-50 animate-in fade-in zoom-in-95 duration-100">
                                      {ESTADOS.filter(e => e.valor !== ped.estado).map(e => {
                                        const Icono = e.icono;
                                        return (
                                          <button
                                            key={e.valor}
                                            type="button"
                                            onClick={() => {
                                              handleCambiarEstado(ped, e.valor);
                                              setOpenStatusMenuId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 cursor-pointer"
                                          >
                                            <Icono className="w-3.5 h-3.5" /> {e.valor}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>

                              {albaranAsociado && (
                                <span
                                  className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1"
                                  title={`Albarán generado: ${albaranAsociado.id}`}
                                >
                                  <ReceiptText className="w-2.5 h-2.5" /> {albaranAsociado.id}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Importe */}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <p className="font-black text-zinc-900">{formatMoneda(importeTotal)}</p>
                            <p className="text-[10px] text-zinc-400">{ped.items.length} partida(s)</p>
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-2.5 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => handleDescargarPDV(ped)} 
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer" 
                                title="Ver / Descargar Pedido de Venta (PDV)"
                              >
                                <Search className="w-4 h-4" />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleOpenCrearAlbaran(ped)} 
                                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                  albaranAsociado
                                    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                    : 'text-zinc-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={albaranAsociado ? `Albarán creado (${albaranAsociado.id}) - Clic para generar otro` : 'Crear Albarán desde este Pedido'}
                              >
                                <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <text x="12" y="19" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11.5" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif">A</text>
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(ped)}
                                className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                title="Editar Pedido"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(ped)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                title="Eliminar Pedido"
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
            </div>
          )}

          {filteredPedidos.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 bg-white px-5 py-3.5 rounded-2xl border border-zinc-200/80 shadow-xs">
              <div className="font-bold text-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                {limitePedidos === 'todos' ? (
                  <span>Mostrando todos los pedidos ({filteredPedidos.length} en total)</span>
                ) : (
                  <span>
                    Mostrando los {Math.min(Number(limitePedidos), filteredPedidos.length)} últimos pedidos
                    {filteredPedidos.length > Number(limitePedidos) && (
                      <span className="text-zinc-400 font-normal ml-1">
                        (de {filteredPedidos.length} pedidos en total)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-zinc-500 font-semibold uppercase text-[11px] tracking-wider">Mostrar:</span>
                <select
                  value={limitePedidos}
                  onChange={(e) => setLimitePedidos(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-xl px-3.5 py-1.5 outline-none focus:border-red-500 focus:bg-white cursor-pointer transition-colors shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value="todos">Mostrar todos</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filteredCentros = centros.filter(c => c.clienteId === form.clienteId);

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => { setView('list'); setEditingId(null); }} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6 md:p-8">
          <h2 className="text-lg font-bold text-zinc-900 mb-6">{editingId ? 'Editar Pedido' : 'Nuevo Pedido'}</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Título *</label>
                <input type="text" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/10 focus:border-red-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Nº Pedido</label>
                <input type="text" value={form.numeroPedido || ''} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold outline-none" readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Cliente *</label>
                <select value={form.clienteId} onChange={e => setForm({ ...form, clienteId: e.target.value, centroId: '' })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none">
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Centro</label>
                <select value={form.centroId} onChange={e => setForm({ ...form, centroId: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none" disabled={!form.clienteId}>
                  <option value="">Sin centro</option>
                  {filteredCentros.map(c => <option key={c._docId || c.id} value={c._docId || c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Fecha prevista</label>
                <input type="date" value={form.fechaPrevista || ''} onChange={e => setForm({ ...form, fechaPrevista: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Estado</label>
                <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as Pedido['estado'] })} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none">
                  {ESTADOS.map(e => <option key={e.valor} value={e.valor}>{e.valor}</option>)}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2 bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80">
                <label className="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1.5 mb-1">
                  Tipo de pedido
                  <span className="text-[11px] text-zinc-500 font-normal lowercase">(al guardar, creará automáticamente una tarea en Reparaciones o Instalaciones)</span>
                </label>
                <select 
                  value={form.tipoPedido || ''} 
                  onChange={e => setForm({ ...form, tipoPedido: e.target.value as any })} 
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 shadow-sm cursor-pointer"
                >
                  <option value="">Ninguno / Sin especificar</option>
                  <option value="Reparación">🔧 Reparación (Crea tarea en el menú Reparaciones)</option>
                  <option value="Instalación">⛑️ Instalación (Crea tarea en el menú Instalaciones)</option>
                </select>
              </div>
            </div>

            {form.presupuestoId && (
              <div className="p-3 bg-red-50 rounded-xl border border-blue-200 text-xs text-red-650">
                Creado desde presupuesto: {presupuestos.find(p => p.id === form.presupuestoId)?.numeroPresupuesto || form.presupuestoId}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-zinc-500 uppercase">Líneas de trabajo</label>
                <button type="button" onClick={addItem} className="text-xs font-bold text-red-650 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Añadir</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-900 text-white uppercase font-bold">
                      <th className="px-3 py-2 text-left w-14">Cant.</th>
                      <th className="px-3 py-2 text-left w-48">Concepto</th>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-right w-28">P. Unidad</th>
                      <th className="px-3 py-2 text-right w-28">Subtotal</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {form.items.map((item, index) => (
                      <tr key={index} className="group">
                        <td className="p-1"><input type="number" min="1" value={item.cantidad} onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value))} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1 text-center" /></td>
                        <td className="p-1"><input type="text" value={item.concepto} onChange={e => updateItem(index, 'concepto', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                        <td className="p-1"><input type="text" value={item.descripcion} onChange={e => updateItem(index, 'descripcion', e.target.value)} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1" /></td>
                        <td className="p-1"><input type="number" step="0.01" min="0" value={item.precioUnidad} onChange={e => updateItem(index, 'precioUnidad', parseFloat(e.target.value))} className="w-full bg-transparent border-b border-transparent group-hover:border-zinc-200 outline-none p-1 text-right" /></td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(item.subtotal)}</td>
                        <td className="p-1"><button type="button" onClick={() => removeItem(index)} className="p-1 text-zinc-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-3 text-sm">
                <span className="font-bold text-zinc-800">Total: {formatMoneda(form.items.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Notas</label>
              <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={3} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm outline-none resize-none" />
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100">
              <button onClick={handleSave} className="flex items-center gap-2 bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
                <Save className="w-4 h-4" /> {editingId ? 'Actualizar Pedido' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
