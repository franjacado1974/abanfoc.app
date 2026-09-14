import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Download, Edit, Send, Trash2, Save, Package, PackagePlus, Wrench, Type, Calculator, CheckCircle, Clock, Ban, ChevronDown, ChevronUp, GripVertical, FileText, ArrowLeft, Plus, HardHat, Gauge, Check, Mail, Eye, Copy, ExternalLink, Activity, ShieldCheck } from 'lucide-react';
import { 
  subscribePresupuestos, addPresupuesto, updatePresupuesto, deletePresupuesto, 
  subscribeClientes, subscribeArticulos, subscribeCentros, subscribeImpuestos, subscribeEmpresas,
  addPedido, addReparacion, addInstalacion, db
} from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { Presupuesto, PresupuestoLinea, Cliente, Articulo, Centro, ReparacionItem, InstalacionItem } from './firebase';
import { generarPresupuestoPDF } from './pdfGenerator';
import { APP_VERSION } from './constants';

export function formatCodigoPresupuesto(numero?: string, fallbackId?: string): string {
  if (!numero && !fallbackId) return 'PRV —';
  const raw = (numero || fallbackId || '').trim();
  const clean = raw.replace(/^(PDV|PRV|PRE)[-\s]*/i, '');
  return `PRV ${clean}`;
}

export function formatCodigoPedido(numero?: string, fallbackId?: string): string {
  if (!numero && !fallbackId) return 'PDV —';
  const raw = (numero || fallbackId || '').trim();
  const clean = raw.replace(/^(PDV|PRV|PRE)[-\s]*/i, '');
  return `PDV ${clean}`;
}

const ESTADOS: { valor: Presupuesto['estado']; etiqueta: string; color: string; bg: string; icono: React.ElementType }[] = [
  { valor: 'Borrador', etiqueta: 'Borrador', color: 'text-zinc-600', bg: 'bg-zinc-100', icono: FileText },
  { valor: 'Enviado', etiqueta: 'Enviado', color: 'text-red-600', bg: 'bg-sky-100', icono: Send },
  { valor: 'En espera', etiqueta: 'En espera', color: 'text-amber-600', bg: 'bg-amber-100', icono: Clock },
  { valor: 'Aprobado', etiqueta: 'Aprobado', color: 'text-emerald-600', bg: 'bg-emerald-100', icono: CheckCircle },
  { valor: 'Rechazado', etiqueta: 'Rechazado', color: 'text-red-600', bg: 'bg-red-100', icono: Ban },
];

const generateId = () => crypto.randomUUID?.()?.slice(0, 8)?.toUpperCase() || Math.random().toString(36).slice(2, 10).toUpperCase();

function formatMoneda(valor: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(valor) || 0);
}

// La función formatDecimal no se usa actualmente y se ha eliminado para evitar errores de compilación.

function formatDecimalInput(valor: number): string {
  if (valor === 0) return '0';
  return String(valor).replace('.', ',');
}

function parseDecimal(valor: string): number {
  return Number(String(valor).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  try {
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return fecha;
  }
}


export default function Presupuestos() {
  const navigate = useNavigate();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [servicios, setServicios] = useState<Articulo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [showForm, setShowForm] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState<Presupuesto | null>(null);
  const [showDetail, setShowDetail] = useState<Presupuesto | null>(null);
  const [showCatalogo, setShowCatalogo] = useState<'articulo' | 'servicio' | null>(null);
  const [presupuestoParaAcciones, setPresupuestoParaAcciones] = useState<Presupuesto | null>(null);
  const [catalogoSearch, setCatalogoSearch] = useState('');

  // Estados para modal de aceptación y derivación
  const [presupuestoParaAceptar, setPresupuestoParaAceptar] = useState<Presupuesto | null>(null);
  const [tipoTrabajoSeleccionado, setTipoTrabajoSeleccionado] = useState<'Reparación' | 'Instalación' | 'Prueba técnica'>('Reparación');
  const [isProcessingAceptacion, setIsProcessingAceptacion] = useState(false);
  const [toastExito, setToastExito] = useState<string | null>(null);

  // Estados para envío por enlace único seguro
  const [presupuestoParaEnviar, setPresupuestoParaEnviar] = useState<Presupuesto | null>(null);
  const [emailDestino, setEmailDestino] = useState('');
  const [enlaceGenerado, setEnlaceGenerado] = useState('');
  const [tokenGenerado, setTokenGenerado] = useState('');
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Estados para modal de auditoría y seguimiento
  const [presupuestoParaSeguimiento, setPresupuestoParaSeguimiento] = useState<Presupuesto | null>(null);
  const [copiadoSeguimiento, setCopiadoSeguimiento] = useState(false);

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formClienteSearch, setFormClienteSearch] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [formFechaValidez, setFormFechaValidez] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const getDefaultIva = () => {
    try {
      const config = JSON.parse(localStorage.getItem('firecheck_impuestos_config') || '{}');
      return config.iva || 21;
    } catch { return 21; }
  };
  const [formIva, setFormIva] = useState(getDefaultIva());
  const [formIvaExento, setFormIvaExento] = useState(false);
  const [formDescuento, setFormDescuento] = useState<number>(0);
  const [formCentroId, setFormCentroId] = useState('');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  
  // Definimos una interfaz extendida para las líneas del formulario
  interface EditablePresupuestoLinea extends PresupuestoLinea {
    precioUnidadInput?: string; // Para manejar el input de texto mientras se edita
  }
  const [formLineas, setFormLineas] = useState<EditablePresupuestoLinea[]>([]);
  const [draggedLineIndex, setDraggedLineIndex] = useState<number | null>(null);
  const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);
  const [formNewLinea, setFormNewLinea] = useState({ familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
  const [usuarioActual, setUsuarioActual] = useState<{ nombre: string; apellidos?: string } | null>(null);

  // Obtener usuario actual
  useEffect(() => {
    try {
      const session = sessionStorage.getItem('firecheck_logged_user');
      if (session) {
        const user = JSON.parse(session);
        setUsuarioActual(user);
      }
    } catch (e) {
      console.error('Error obteniendo usuario actual:', e);
    }
  }, []);

  const filteredClientes = useMemo(() => {
    const term = formClienteSearch.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter(c => c.nombre?.toLowerCase().includes(term) || String(c.id).toLowerCase().includes(term));
  }, [clientes, formClienteSearch]);

  const selectedCliente = clientes.find(c => c.id === formClienteId);

  const centrosFiltrados = useMemo(() => {
    if (!formClienteId) return [];
    return centros.filter(c => c.clienteId === formClienteId);
  }, [centros, formClienteId]);

  // Cargar datos
  useEffect(() => {
    const unsub1 = subscribePresupuestos(items => {
      setPresupuestos(items);
      localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(items));
    });
    const unsub2 = subscribeClientes(items => {
      try { setClientes(Array.isArray(items) ? items : []); } catch {}
    });
    const unsub3 = subscribeArticulos(items => {
      try {
        const arr = Array.isArray(items) ? items : [];
        setArticulos(arr.filter(a => a && a.revisable !== false));
        setServicios(arr.filter(a => a && (a.revisable === false || a.revisable === undefined)));
      } catch {}
    });
    const unsub4 = subscribeCentros(items => {
      try { setCentros(Array.isArray(items) ? items : []); } catch {}
    });
    const unsub5 = subscribeImpuestos((config) => {
      if (config) {
        localStorage.setItem('firecheck_impuestos_config', JSON.stringify({ iva: config.iva, exento: config.exento }));
      }
    });
    const unsub6 = subscribeEmpresas(items => {
      try { setEmpresas(Array.isArray(items) ? items : []); } catch {}
    });

    // Cargar desde localStorage como fallback
    try {
      const saved = localStorage.getItem('firecheck_db_presupuestos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPresupuestos(parsed);
      }
    } catch {}

    return () => { try { unsub1(); } catch {} try { unsub2(); } catch {} try { unsub3(); } catch {} try { unsub4(); } catch {} try { unsub5(); } catch {} try { unsub6(); } catch {} };
  }, []);

  // Filtrar presupuestos
  const filteredPresupuestos = useMemo(() => {
    let result = presupuestos;
    if (statusFilter !== 'Todos') {
      result = result.filter(p => p.estado === statusFilter);
    }
    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase().trim();
    return result.filter(p =>
      p.titulo.toLowerCase().includes(term) ||
      (p.nombreCliente || '').toLowerCase().includes(term) ||
      p.fechaCreacion.includes(term) ||
      p.id.toLowerCase().includes(term) ||
      (p.numeroPresupuesto || '').toLowerCase().includes(term)
    );
  }, [presupuestos, searchTerm, statusFilter]);

  // Calcular totales del formulario
  const formSubtotal = useMemo(() =>
    formLineas.reduce((sum, l) => sum + (l.cantidad * l.precioUnidad), 0),
    [formLineas]
  );
  const formDescuentoImporte = useMemo(() => {
    if (!formDescuento || formDescuento <= 0) return 0;
    return (formSubtotal * formDescuento) / 100;
  }, [formSubtotal, formDescuento]);

  const formBaseImponible = Math.max(0, formSubtotal - formDescuentoImporte);
  const formTotal = formBaseImponible + (formIvaExento ? 0 : (formBaseImponible * formIva / 100));

  // Filtrar items del catálogo
  const filteredCatalogoItems = useMemo(() => {
    const items = showCatalogo === 'articulo' ? articulos : servicios;
    if (!catalogoSearch.trim()) return items;
    const term = catalogoSearch.toLowerCase().trim();
    return items.filter(item =>
      (item.nombre || '').toLowerCase().includes(term) ||
      (item.codigo || '').toLowerCase().includes(term) ||
      (item.familia || '').toLowerCase().includes(term)
    );
  }, [showCatalogo, articulos, servicios, catalogoSearch]);

  // Abrir formulario para nuevo presupuesto
  const handleNuevo = () => {
    setEditingPresupuesto(null);
    setFormTitulo('');
    setFormClienteId('');
    setFormFechaValidez('');
    setFormNotas('');
    setFormIva(getDefaultIva());
    setFormIvaExento(false);
    setFormDescuento(0);
    setFormLineas([]); // Reiniciar las líneas
    setFormNewLinea({ familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
    setShowForm(true);
  };

  // Abrir formulario para editar
  const handleEditar = (p: Presupuesto) => {
    setEditingPresupuesto(p);
    setFormTitulo(p.titulo);
    setFormClienteId(p.clienteId);
    setFormCentroId(p.centroId || '');
    setFormFechaValidez(p.fechaValidez || '');
    setFormNotas(p.notas || '');
    setFormIva(p.iva);
    setFormIvaExento(p.iva === 0);
    setFormDescuento(p.descuentoPorcentaje || 0);
    setFormLineas([...p.lineas.map(line => ({ ...line, familia: line.familia || '', precioUnidadInput: formatDecimalInput(line.precioUnidad) }))]); // Inicializar el input string
    setFormNewLinea({ familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
    setShowForm(true);
  };

  // Duplicar presupuesto para nueva versión o modificación
  const handleDuplicar = (p: Presupuesto) => {
    setEditingPresupuesto(null); // Es un nuevo presupuesto en la base de datos
    let nuevoTitulo = p.titulo;
    const matchVersion = nuevoTitulo.match(/\(v(\d+)\)$/i);
    if (matchVersion) {
      const nextV = parseInt(matchVersion[1], 10) + 1;
      nuevoTitulo = nuevoTitulo.replace(/\(v\d+\)$/i, `(v${nextV})`);
    } else if (nuevoTitulo.match(/\s*-\s*v(\d+)$/i)) {
      const matchV = nuevoTitulo.match(/\s*-\s*v(\d+)$/i);
      const nextV = parseInt(matchV![1], 10) + 1;
      nuevoTitulo = nuevoTitulo.replace(/\s*-\s*v\d+$/i, ` - v${nextV}`);
    } else {
      nuevoTitulo = `${nuevoTitulo} (v2)`;
    }

    setFormTitulo(nuevoTitulo);
    setFormClienteId(p.clienteId);
    setFormCentroId(p.centroId || '');
    setFormFechaValidez(p.fechaValidez || '');
    setFormNotas(p.notas || '');
    setFormIva(p.iva);
    setFormIvaExento(p.iva === 0);
    setFormDescuento(p.descuentoPorcentaje || 0);
    setFormLineas(p.lineas.map(line => ({
      ...line,
      id: `L-${generateId()}`,
      familia: line.familia || '',
      precioUnidadInput: formatDecimalInput(line.precioUnidad)
    })));
    setFormNewLinea({ familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
    setShowForm(true);
    setToastExito('Presupuesto duplicado. Puedes editar las partidas y guardar la nueva versión.');
  };

  // Añadir artículo/servicio desde catálogo
  const handleAddFromCatalogo = (item: Articulo, tipo: 'articulo' | 'servicio') => {
    const nuevaLinea: EditablePresupuestoLinea = {
      id: `L-${generateId()}`,
      tipo,
      codigo: item.codigo,
      familia: item.familia || '',
      concepto: item.nombre,
      descripcion: (item as any).descripcion || '',
      fotoUrl: item.fotoUrl,
      cantidad: 1,
      precioUnidad: item.precioVenta,
      subtotal: item.precioVenta, // Se recalculará al cambiar cantidad/precio
      precioUnidadInput: formatDecimalInput(item.precioVenta), // Inicializar el input string
    };
    setFormLineas(prev => [...prev, nuevaLinea]);
    setShowCatalogo(null);
  };

  // Añadir línea manual
  const handleAddManual = () => {
    if (!formNewLinea.concepto.trim()) return;
    const nuevaLinea: EditablePresupuestoLinea = {
      id: `L-${generateId()}`,
      tipo: 'manual',
      familia: formNewLinea.familia.trim(),
      concepto: formNewLinea.concepto,
      descripcion: formNewLinea.descripcion,
      cantidad: formNewLinea.cantidad,
      precioUnidad: formNewLinea.precioUnidad,
      subtotal: formNewLinea.cantidad * formNewLinea.precioUnidad, // Se recalculará al cambiar cantidad/precio
      precioUnidadInput: formatDecimalInput(formNewLinea.precioUnidad), // Inicializar el input string
    };
    setFormLineas(prev => [...prev, nuevaLinea]);
    setFormNewLinea({ familia: '', concepto: '', descripcion: '', cantidad: 1, precioUnidad: 0 });
  };

  // Eliminar línea del formulario
  const handleRemoveLinea = (id: string) => {
    setFormLineas(prev => prev.filter(l => l.id !== id));
  };

  // Reordenar líneas (arrastrar y soltar)
  const handleDragStart = (index: number) => {
    setDraggedLineIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedLineIndex === null || draggedLineIndex === index) return;
    setDragOverLineIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedLineIndex === null || draggedLineIndex === index) {
      setDraggedLineIndex(null);
      setDragOverLineIndex(null);
      return;
    }
    setFormLineas(prev => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedLineIndex, 1);
      updated.splice(index, 0, movedItem);
      return updated;
    });
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedLineIndex(null);
    setDragOverLineIndex(null);
  };

  // Mover línea hacia arriba o hacia abajo
  const handleMoverLinea = (index: number, direccion: 'up' | 'down') => {
    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formLineas.length) return;
    setFormLineas(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Guardar presupuesto
  const handleGuardar = async () => {
    if (!formTitulo.trim()) return alert('Introduce un título para el presupuesto.');
    if (!formClienteId) return alert('Selecciona un cliente.');
    if (formLineas.length === 0) return alert('Añade al menos una línea al presupuesto.');

    const cliente = clientes.find(c => c.id === formClienteId);
    const subtotal = formSubtotal;
    const total = formTotal;

    // Sanitizar líneas excluyendo campos temporales como precioUnidadInput
    const lineasSanitizadas: PresupuestoLinea[] = formLineas.map(l => {
      const sanitized: PresupuestoLinea = {
        id: l.id || `L-${generateId()}`,
        tipo: l.tipo || 'manual',
        concepto: l.concepto || '',
        cantidad: Number(l.cantidad) || 1,
        precioUnidad: Number(l.precioUnidad) || 0,
        subtotal: (Number(l.cantidad) || 1) * (Number(l.precioUnidad) || 0),
      };
      if (l.familia) sanitized.familia = l.familia;
      if (l.codigo) sanitized.codigo = l.codigo;
      if (l.descripcion) sanitized.descripcion = l.descripcion;
      if (l.fotoUrl) sanitized.fotoUrl = l.fotoUrl;
      return sanitized;
    });

    const presupuestoData: any = {
      id: editingPresupuesto?.id || `PRE-${generateId()}`,
      titulo: formTitulo.trim(),
      clienteId: formClienteId,
      nombreCliente: cliente?.nombre || 'Cliente',
      fechaCreacion: editingPresupuesto?.fechaCreacion || new Date().toISOString(),
      estado: editingPresupuesto?.estado || 'Borrador',
      lineas: lineasSanitizadas,
      subtotal,
      descuentoPorcentaje: Number(formDescuento) || 0,
      descuentoImporte: formDescuentoImporte,
      iva: formIva,
      total,
    };

    if (formCentroId) presupuestoData.centroId = formCentroId;
    if (formFechaValidez) presupuestoData.fechaValidez = formFechaValidez;
    if (formNotas && formNotas.trim()) presupuestoData.notas = formNotas.trim();
    if (usuarioActual) {
      presupuestoData.usuarioRealizado = `${usuarioActual.nombre}${usuarioActual.apellidos ? ' ' + usuarioActual.apellidos : ''}`.trim();
    }

    try {
      if (editingPresupuesto) {
        const docId = (editingPresupuesto as any)._docId || editingPresupuesto.id;
        await updatePresupuesto(docId, presupuestoData);
        setPresupuestos(prev => prev.map(item => ((item as any)._docId === docId || item.id === editingPresupuesto.id) ? { ...item, ...presupuestoData, _docId: docId } : item));
      } else {
        const saved = await addPresupuesto(presupuestoData);
        if (saved) {
          setPresupuestos(prev => [saved as any, ...prev]);
        }
      }
      setShowForm(false);
      setEditingPresupuesto(null);
    } catch (e: any) {
      console.error('Error guardando presupuesto:', e);
      alert(`Error al guardar el presupuesto: ${e?.message || 'Error desconocido'}`);
    }
  };

  // Cambiar estado
  const handleCambiarEstado = async (p: Presupuesto, nuevoEstado: Presupuesto['estado']) => {
    const docId = (p as any)._docId || p.id;
    try {
      if (nuevoEstado === 'Aprobado') {
        // Al marcar como aceptado/aprobado, abrir la ventana modal para seleccionar tipo de trabajo
        setPresupuestoParaAceptar(p);
        setTipoTrabajoSeleccionado('Reparación');
        return;
      }
      if (nuevoEstado === 'Enviado') {
        // Abrir el nuevo modal de envío por enlace seguro
        handleAbrirModalEnvio(p);
        return;
      }
      await updatePresupuesto(docId, { estado: nuevoEstado } as any);
      setPresupuestos(prev => prev.map(item => ((item as any)._docId === docId || item.id === p.id) ? { ...item, estado: nuevoEstado } : item));
    } catch (e) {
      console.error('Error actualizando estado:', e);
    }
  };

  // Abrir modal de envío de presupuesto por enlace
  const handleAbrirModalEnvio = (p: Presupuesto) => {
    const cli = clientes.find(c => (c as any)._docId === p.clienteId || c.id === p.clienteId || c.nombre === p.nombreCliente);
    const emailSug = cli?.correoGeneral || cli?.correoAdministracion || cli?.correo || cli?.correoFacturacion || '';
    setEmailDestino(emailSug);

    // Reutilizar o generar token único seguro de alta entropía
    const token = p.seguimiento?.tokenAcceso || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const url = `${window.location.origin}/portal-presupuesto/${token}`;
    setTokenGenerado(token);
    setEnlaceGenerado(url);
    setEnlaceCopiado(false);
    setPresupuestoParaEnviar(p);
  };

  // Copiar enlace público al portapapeles
  const handleCopiarEnlace = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setEnlaceCopiado(true);
      setTimeout(() => setEnlaceCopiado(false), 3000);

      // Si el presupuesto estaba en 'Borrador', actualizar a 'Enviado' y guardar token
      if (presupuestoParaEnviar) {
        const docId = (presupuestoParaEnviar as any)._docId || presupuestoParaEnviar.id;
        const ahora = new Date().toISOString();
        const eventos = Array.isArray(presupuestoParaEnviar.seguimiento?.eventos) ? [...presupuestoParaEnviar.seguimiento.eventos] : [];
        eventos.unshift({
          tipo: 'envio',
          fecha: ahora,
          detalle: 'Enlace generado y copiado al portapapeles'
        });

        const nuevoSeguimiento = {
          ...(presupuestoParaEnviar.seguimiento || {}),
          tokenAcceso: tokenGenerado,
          enlaceUrl: url,
          fechaEnvio: ahora,
          enviadoPor: usuarioActual?.nombre || 'Comercial',
          eventos
        };

        await updatePresupuesto(docId, {
          estado: 'Enviado',
          seguimiento: nuevoSeguimiento
        } as any);

        setPresupuestos(prev => prev.map(item => ((item as any)._docId === docId || item.id === presupuestoParaEnviar.id) ? {
          ...item,
          estado: 'Enviado',
          seguimiento: nuevoSeguimiento
        } : item));
      }
    } catch (e) {
      console.error('Error al copiar al portapapeles:', e);
    }
  };

  // Confirmar envío de correo y registrar evento en Firestore
  const handleConfirmarEnvioEmail = async () => {
    if (!presupuestoParaEnviar) return;
    setIsSendingEmail(true);
    const p = presupuestoParaEnviar;
    const docId = (p as any)._docId || p.id;
    const codigoPresupuesto = formatCodigoPresupuesto(p.numeroPresupuesto, p.id);
    const ahora = new Date().toISOString();

    try {
      const eventos = Array.isArray(p.seguimiento?.eventos) ? [...p.seguimiento.eventos] : [];
      eventos.unshift({
        tipo: 'envio',
        fecha: ahora,
        detalle: emailDestino ? `Enlace enviado por correo a ${emailDestino}` : 'Enlace generado y enviado'
      });

      const nuevoSeguimiento = {
        ...(p.seguimiento || {}),
        tokenAcceso: tokenGenerado,
        enlaceUrl: enlaceGenerado,
        fechaEnvio: ahora,
        remitenteEmail: 'abanfoc@abanfoc.es',
        destinatarioEmail: emailDestino,
        enviadoPor: 'abanfoc@abanfoc.es',
        eventos
      };

      await updatePresupuesto(docId, {
        estado: 'Enviado',
        seguimiento: nuevoSeguimiento
      } as any);

      setPresupuestos(prev => prev.map(item => ((item as any)._docId === docId || item.id === p.id) ? {
        ...item,
        estado: 'Enviado',
        seguimiento: nuevoSeguimiento
      } : item));

      // Preparar enlaces para Gmail Web y cliente predeterminado (mailto)
      const asuntoRaw = `Presupuesto ${codigoPresupuesto} - ${p.titulo} - ABANFOC S.L.`;
      const cuerpoRaw = 
        `Estimado/a cliente,\n\n` +
        `Le adjuntamos el enlace para consultar, descargar y firmar digitalmente el presupuesto ${codigoPresupuesto} ("${p.titulo}") por un importe total de ${formatMoneda(p.total)}:\n\n` +
        `${enlaceGenerado}\n\n` +
        `Desde este enlace seguro podrá revisar las partidas detalladas, descargar el documento oficial en PDF y rubricar su conformidad online sin necesidad de imprimir ni escanear.\n\n` +
        `Quedamos a su entera disposición para cualquier aclaración o consulta.\n\n` +
        `Atentamente,\n` +
        `ABANFOC S.L.\n` +
        `Tel: 93 010 89 17 | abanfoc@abanfoc.es`;

      const asunto = encodeURIComponent(asuntoRaw);
      const cuerpo = encodeURIComponent(cuerpoRaw);

      // Si el usuario usa Gmail en navegador, URL directa a redactar en Gmail con cuenta de abanfoc@abanfoc.es
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailDestino || '')}&cc=${encodeURIComponent('abanfoc@abanfoc.es')}&su=${asunto}&body=${cuerpo}`;
      const mailtoUrl = `mailto:${emailDestino || ''}?cc=abanfoc@abanfoc.es&subject=${asunto}&body=${cuerpo}`;

      // Abrir Gmail en nueva pestaña (lo que el usuario tenía antes y esperaba)
      const win = window.open(gmailUrl, '_blank');
      if (!win) {
        // En caso de que el navegador bloquee popups, usar enlace invisible mailto
        const a = document.createElement('a');
        a.href = mailtoUrl;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setPresupuestoParaEnviar(null);
      setToastExito(`Presupuesto ${codigoPresupuesto} enviado correctamente. Se ha abierto la redacción de correo.`);
      setTimeout(() => setToastExito(null), 4000);
    } catch (e: any) {
      console.error('Error al enviar presupuesto:', e);
      alert('Error al actualizar el presupuesto: ' + (e?.message || 'Error desconocido'));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Confirmar aceptación del presupuesto y derivar al módulo correspondiente
  const handleConfirmarAceptacion = async () => {
    if (!presupuestoParaAceptar) return;
    setIsProcessingAceptacion(true);
    const p = presupuestoParaAceptar;
    const docId = (p as any)._docId || p.id;
    const codigoPresupuesto = formatCodigoPresupuesto(p.numeroPresupuesto, p.id);
    const codigoPedido = formatCodigoPedido(p.numeroPresupuesto, p.id);

    try {
      // 1. Actualizar estado del presupuesto a 'Aprobado' y vincular el pedido
      await updatePresupuesto(docId, { 
        estado: 'Aprobado',
        pedidoId: codigoPedido,
        tipoTrabajo: tipoTrabajoSeleccionado
      } as any);

      // Actualizar estado local y localStorage inmediatamente
      setPresupuestos(prev => {
        const updated = prev.map(item => ((item as any)._docId === docId || item.id === p.id || item.id === docId) ? { ...item, estado: 'Aprobado' as const, pedidoId: codigoPedido, tipoTrabajo: tipoTrabajoSeleccionado } : item);
        try { localStorage.setItem('firecheck_db_presupuestos', JSON.stringify(updated)); } catch {}
        return updated;
      });

      // Datos de ubicación seguros
      const centroObj = centros.find(c => (c as any)._docId === p.centroId || c.id === p.centroId);
      const clienteObj = clientes.find(c => (c as any)._docId === p.clienteId || c.id === p.clienteId);
      const nombreCentro = centroObj?.nombre || '';
      const nombreCliente = clienteObj?.nombre || p.nombreCliente || '';
      let lugar = '';
      if (nombreCentro && nombreCliente) {
        lugar = `${nombreCentro} (${nombreCliente})`;
      } else if (nombreCentro) {
        lugar = nombreCentro;
      } else if (nombreCliente) {
        lugar = nombreCliente;
      } else {
        lugar = 'Cliente / Centro';
      }

      const fechaHoy = new Date().toISOString().slice(0, 10);
      const MESES_LISTA = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesActual = MESES_LISTA[new Date().getMonth()];
      const notaPedido = (p.notas && typeof p.notas === 'string' && p.notas.trim()) 
        ? p.notas.trim() 
        : `Pedido ${codigoPedido} generado desde presupuesto ${codigoPresupuesto}`;
      const tituloSeguro = (p.titulo && typeof p.titulo === 'string' && p.titulo.trim()) 
        ? p.titulo.trim() 
        : `Presupuesto ${codigoPresupuesto}`;

      // 2. Guardar Pedido en colección 'pedidos'
      const nuevoPedido: any = {
        id: `PED-${Date.now()}`,
        numeroPedido: codigoPedido,
        presupuestoId: p.id || docId,
        clienteId: p.clienteId || '',
        nombreCliente,
        centroId: p.centroId || '',
        nombreCentro,
        titulo: tituloSeguro,
        tipoPedido: tipoTrabajoSeleccionado,
        estado: 'Pendiente',
        fechaCreacion: new Date().toISOString(),
        fechaPrevista: fechaHoy,
        items: (p.lineas || []).map(l => ({
          cantidad: Number(l.cantidad) || 1,
          concepto: l.concepto || '',
          descripcion: l.descripcion || '',
          precioUnidad: Number(l.precioUnidad) || 0,
          subtotal: Number(l.subtotal) || 0
        })),
        subtotal: Number(p.subtotal) || 0,
        descuentoPorcentaje: Number(p.descuentoPorcentaje) || 0,
        descuentoImporte: Number(p.descuentoImporte) || 0,
        iva: Number(p.iva) || 21,
        total: Number(p.total) || 0,
        notas: notaPedido,
      };
      await addPedido(nuevoPedido);
      try {
        const rawP = localStorage.getItem('firecheck_db_pedidos');
        const arrP = rawP ? JSON.parse(rawP) : [];
        localStorage.setItem('firecheck_db_pedidos', JSON.stringify([nuevoPedido, ...arrP]));
      } catch {}

      // 3. Pasar al módulo correspondiente según el tipo seleccionado
      if (tipoTrabajoSeleccionado === 'Reparación') {
        const newRepId = `REP-${Date.now().toString().slice(-6)}`;
        const newRep: ReparacionItem = {
          id: newRepId,
          reparacion: tituloSeguro,
          lugar: lugar.trim(),
          tecnicoAsignado: '',
          comercial: '',
          estado: 'Pendiente',
          fechaCreacion: new Date().toISOString(),
          fecha: fechaHoy,
          mes: mesActual,
          observaciones: notaPedido,
          nota: notaPedido,
          pedidoId: codigoPedido,
          presupuestoId: p.id || docId
        };
        await addReparacion(newRep);
        try {
          const raw = localStorage.getItem('firecheck_db_reparaciones');
          const arr = raw ? JSON.parse(raw) : [];
          localStorage.setItem('firecheck_db_reparaciones', JSON.stringify([newRep, ...arr]));
        } catch {}
      } else if (tipoTrabajoSeleccionado === 'Instalación') {
        const newInsId = `INS-${Date.now().toString().slice(-6)}`;
        const newIns: InstalacionItem = {
          id: newInsId,
          instalacion: tituloSeguro,
          lugar: lugar.trim(),
          tecnicoAsignado: '',
          comercial: '',
          estado: 'Pendiente',
          fechaCreacion: new Date().toISOString(),
          fecha: fechaHoy,
          mes: mesActual,
          observaciones: notaPedido,
          nota: notaPedido,
          pedidoId: codigoPedido,
          presupuestoId: p.id || docId
        };
        await addInstalacion(newIns);
        try {
          const raw = localStorage.getItem('firecheck_db_instalaciones');
          const arr = raw ? JSON.parse(raw) : [];
          localStorage.setItem('firecheck_db_instalaciones', JSON.stringify([newIns, ...arr]));
        } catch {}
      } else if (tipoTrabajoSeleccionado === 'Prueba técnica') {
        const pruebaDoc = {
          clienteNombre: nombreCliente,
          centroNombre: nombreCentro,
          clienteId: p.clienteId || '',
          centroId: p.centroId || '',
          pedidoId: codigoPedido,
          presupuestoId: p.id || docId,
          titulo: tituloSeguro,
          observaciones: notaPedido,
          evaluacionGlobal: 'pendiente',
          createdAt: new Date().toISOString(),
          fecha: fechaHoy,
          versionApp: APP_VERSION,
        };
        await addDoc(collection(db, 'pruebas_tecnicas'), pruebaDoc);
      }

      setPresupuestoParaAceptar(null);
      setToastExito(`Pedido ${codigoPedido} generado correctamente y derivado a ${tipoTrabajoSeleccionado}.`);
      setTimeout(() => setToastExito(null), 5000);
    } catch (e: any) {
      console.error('Error al confirmar aceptación de presupuesto:', e);
      alert('Error al procesar la aceptación: ' + (e?.message || 'Error desconocido'));
    } finally {
      setIsProcessingAceptacion(false);
    }
  };

  // Eliminar presupuesto
  const handleEliminar = async (p: Presupuesto) => {
    if (!confirm(`¿Eliminar el presupuesto "${p.titulo}"? Esta acción no se puede deshacer.`)) return;
    if (!confirm('CONFIRMACIÓN: ¿Estás seguro de querer eliminar este presupuesto definitivamente?')) return;
    const docId = (p as any)._docId || p.id;
    try {
      await deletePresupuesto(docId);
    } catch (e) {
      console.error('Error eliminando presupuesto:', e);
    }
  };

  // Descargar PDF
  const handleDescargar = (p: Presupuesto) => {
    let empresaSeleccionada: any = undefined;
    const empId = (p as any).empresaId || centros.find(c => (c as any)._docId === (p as any).centroId || c.id === (p as any).centroId)?.empresaId;
    if (empId) {
      empresaSeleccionada = empresas.find(e => (e as any)._docId === empId || (e as any).id === empId || ((e as any).nombre && typeof (e as any).nombre === 'string' && (e as any).nombre.trim().toLowerCase() === empId.trim().toLowerCase()));
    }
    const clienteObj = clientes.find(c => (c as any)._docId === p.clienteId || c.id === p.clienteId || (c.nombre && c.nombre === p.nombreCliente));
    generarPresupuestoPDF({
      titulo: p.titulo,
      numeroPresupuesto: p.numeroPresupuesto,
      nombreCliente: p.nombreCliente || clienteObj?.nombre || 'Cliente',
      cliente: clienteObj,
      fechaCreacion: p.fechaCreacion,
      fechaValidez: p.fechaValidez,
      estado: p.estado,
      lineas: p.lineas.map(l => ({
        familia: l.familia,
        concepto: l.concepto,
        descripcion: l.descripcion,
        codigo: l.codigo,
        fotoUrl: l.fotoUrl,
        cantidad: l.cantidad,
        precioUnidad: l.precioUnidad,
        subtotal: l.subtotal,
      })),
      subtotal: p.subtotal,
      descuentoPorcentaje: p.descuentoPorcentaje,
      descuentoImporte: p.descuentoImporte,
      iva: p.iva,
      total: p.total,
      notas: p.notas,
    }, empresaSeleccionada);
  };

  // Obtener info del estado
  const getEstadoInfo = (estado: Presupuesto['estado']) => ESTADOS.find(e => e.valor === estado) || ESTADOS[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
          </button>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Presupuestos Comerciales</h1>
          <p className="text-xs font-semibold text-zinc-500 mt-1">Creación, envío y control de ofertas y presupuestos comerciales.</p>
        </div>

        {/* Pestañas + buscador y botón */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
          {/* Pestañas */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1.5 rounded-2xl w-fit border border-zinc-200/40">
            <button
              onClick={() => setStatusFilter('Todos')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Todos'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              Todos
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'Todos' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {presupuestos.length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Borrador')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Borrador'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              Borradores
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'Borrador' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {presupuestos.filter(p => p.estado === 'Borrador').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Enviado')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Enviado'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              Enviados
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'Enviado' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {presupuestos.filter(p => p.estado === 'Enviado').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('En espera')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'En espera'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              En espera
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'En espera' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {presupuestos.filter(p => p.estado === 'En espera').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Aprobado')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Aprobado'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              Aprobados
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'Aprobado' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {presupuestos.filter(p => p.estado === 'Aprobado').length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('Rechazado')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                statusFilter === 'Rechazado'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/20 font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              Rechazados
              <span className={`text-[9px] font-black font-sans px-1.5 py-0.5 rounded transition-colors ${
                statusFilter === 'Rechazado' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-250 text-zinc-500'
              }`}>
                {presupuestos.filter(p => p.estado === 'Rechazado').length}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar presupuestos..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all text-zinc-950 shadow-sm animate-none"
              />
            </div>
            <button
              onClick={handleNuevo}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Presupuesto
            </button>
          </div>
        </div>

        {/* LISTA DE PRESUPUESTOS */}
        {filteredPresupuestos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200 border-dashed">
            <Calculator className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">
              {searchTerm ? 'Sin resultados' : 'No hay presupuestos'}
            </h3>
            <p className="text-zinc-500 text-sm">
              {searchTerm ? 'No se encontraron presupuestos que coincidan con tu búsqueda.' : 'Crea tu primer presupuesto para empezar.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 text-left">Referencia</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Centro</th>
                  <th className="px-4 py-3 text-left">Título</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredPresupuestos.map(p => {
                  const estadoInfo = getEstadoInfo(p.estado);
                  const EstadoIcono = estadoInfo.icono;
                  const nombreCentro = centros.find(c => c._docId === p.centroId || c.id === p.centroId)?.nombre || '';
                  return (
                    <tr key={p.id} className="hover:bg-white transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold text-zinc-800">{formatCodigoPresupuesto(p.numeroPresupuesto, p.id)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-800">{p.nombreCliente || 'Cliente'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-600">{nombreCentro || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-zinc-900 truncate max-w-[180px]">{p.titulo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${estadoInfo.bg} ${estadoInfo.color}`}>
                            <EstadoIcono className="w-3 h-3" />
                            {estadoInfo.etiqueta}
                          </span>
                          {p.pedidoId && (
                            <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200 inline-flex items-center gap-1" title={`Pedido vinculado: ${p.pedidoId}`}>
                              <Package className="w-2.5 h-2.5" /> {p.pedidoId}
                            </span>
                          )}
                          {p.seguimiento?.firmado ? (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Firmado
                            </span>
                          ) : p.seguimiento?.visitasCount && p.seguimiento.visitasCount > 0 ? (
                            <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-200 inline-flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" /> {p.seguimiento.visitasCount} {p.seguimiento.visitasCount === 1 ? 'visita' : 'visitas'}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-zinc-500">{formatFecha(p.fechaCreacion)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-zinc-900">{formatMoneda(p.total)}</p>
                        {p.descuentoPorcentaje && Number(p.descuentoPorcentaje) > 0 ? (
                          <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/60 mt-0.5">
                            Dto. {Number(p.descuentoPorcentaje)}%
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setPresupuestoParaAcciones(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-xl text-xs font-bold transition-all border border-zinc-200/80 shadow-xs hover:shadow cursor-pointer"
                          title="Ver opciones y acciones disponibles"
                        >
                          <span>Selecciona</span>
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">{showDetail.titulo}</h2>
              <button onClick={() => setShowDetail(null)} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Cliente</p>
                  <p className="text-sm font-bold text-zinc-800">{showDetail.nombreCliente || 'Cliente'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Nº Presupuesto</p>
                  <p className="text-sm font-bold text-zinc-800 font-mono">{formatCodigoPresupuesto(showDetail.numeroPresupuesto, showDetail.id)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Fecha creación</p>
                  <p className="text-sm text-zinc-700">{formatFecha(showDetail.fechaCreacion)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase">Validez</p>
                  <p className="text-sm text-zinc-700">{showDetail.fechaValidez ? formatFecha(showDetail.fechaValidez) : '—'}</p>
                </div>
              </div>

              {/* Líneas */}
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Líneas del presupuesto</h3>
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs min-w-[460px]">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                          <th className="px-3 py-2 text-left">Concepto</th>
                          <th className="px-3 py-2 text-center">Cant.</th>
                          <th className="px-3 py-2 text-right">Precio</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showDetail.lineas.map((l, i) => (
                          <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-white'}>
                            <td className="px-3 py-2 text-zinc-800">
                              {l.familia && (
                                <p className="font-bold text-zinc-950 uppercase tracking-tight">{l.familia}</p>
                              )}
                              <p className={`${l.familia ? 'text-zinc-600 text-[11px] mt-0.5' : 'font-medium text-zinc-800'}`}>
                                {l.descripcion || l.concepto}
                                {l.codigo ? <span className="text-zinc-400 font-mono ml-1.5">({l.codigo})</span> : ''}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-center text-zinc-600">{l.cantidad}</td>
                            <td className="px-3 py-2 text-right text-zinc-600">{formatMoneda(l.precioUnidad)}</td>
                            <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(l.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Descuento sobre el subtotal entre 2 líneas horizontales */}
              {showDetail.descuentoPorcentaje && Number(showDetail.descuentoPorcentaje) > 0 ? (
                <div className="border-y-2 border-zinc-200 py-2.5 px-3 bg-red-50/40 flex items-center justify-between text-xs font-bold text-red-600 rounded-lg">
                  <span>Descuento sobre el subtotal: {Number(showDetail.descuentoPorcentaje).toFixed(2).replace('.', ',')} %</span>
                  <span>-{formatMoneda(showDetail.descuentoImporte || (showDetail.subtotal * Number(showDetail.descuentoPorcentaje) / 100))}</span>
                </div>
              ) : null}

              {/* Totales */}
              <div className="border-t border-zinc-100 pt-4 flex flex-col items-end gap-1">
                <div className="text-sm text-zinc-500">Subtotal: <span className="font-bold text-zinc-800">{formatMoneda(showDetail.subtotal)}</span></div>
                <div className="text-sm text-zinc-500">
                  {showDetail.iva === 0 ? (
                    <>IVA: <span className="font-bold text-zinc-800">Exento (0%)</span></>
                  ) : (
                    <>IVA ({showDetail.iva}%): <span className="font-bold text-zinc-800">
                      {formatMoneda((showDetail.subtotal - (showDetail.descuentoImporte || 0)) * showDetail.iva / 100)}
                    </span></>
                  )}
                </div>
                <div className="text-lg font-black text-zinc-900">TOTAL: {formatMoneda(showDetail.total)}</div>
              </div>

              {/* Notas */}
              {showDetail.notas && (
                <div className="bg-zinc-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Notas</p>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{showDetail.notas}</p>
                </div>
              )}

              {/* Usuario */}
              {showDetail.usuarioRealizado && (
                <div className="bg-red-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-red-650 uppercase mb-1">Realizado por</p>
                  <p className="text-sm font-semibold text-red-600">{showDetail.usuarioRealizado}</p>
                </div>
              )}

              {/* Sección de Seguimiento del Enlace en Modal Detalle */}
              <div className="bg-gradient-to-r from-sky-50 to-blue-50/50 rounded-2xl p-4 border border-sky-200/80">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">Trazabilidad del Enlace</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const p = showDetail;
                      setShowDetail(null);
                      setPresupuestoParaSeguimiento(p);
                    }}
                    className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-white px-2.5 py-1 rounded-lg border border-sky-200 transition-colors shadow-xs cursor-pointer"
                  >
                    Ver Historial Completo
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-sky-100">
                  <div>
                    <span className="text-[10px] text-sky-600 font-medium">Visitas</span>
                    <p className="text-base font-black text-sky-950">{showDetail.seguimiento?.visitasCount || 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-sky-600 font-medium">Descargas</span>
                    <p className="text-base font-black text-sky-950">{showDetail.seguimiento?.descargasCount || 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-sky-600 font-medium">Firma</span>
                    <p className="text-xs font-bold text-sky-950 mt-1">
                      {showDetail.seguimiento?.firmado ? 'Firmado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-zinc-100 flex justify-end shrink-0">
              <button onClick={() => setShowDetail(null)} className="px-6 py-2.5 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO (CREAR/EDITAR) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-6xl xl:max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                {editingPresupuesto ? 'Editar presupuesto' : 'Nuevo presupuesto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 sm:p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
              {/* Datos generales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Cliente *</label>
                  <input
                    type="text"
                    value={formClienteSearch || selectedCliente?.nombre || ''}
                    onChange={(e) => {
                      setFormClienteSearch(e.target.value);
                      setClienteDropdownOpen(true);
                      setFormClienteId('');
                    }}
                    onFocus={() => setClienteDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setClienteDropdownOpen(false), 150)}
                    placeholder="Escribe el nombre del cliente..."
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                  {clienteDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full rounded-3xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        {filteredClientes.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-zinc-500">No hay clientes que coincidan.</div>
                        ) : (
                          filteredClientes.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormClienteId(c.id);
                                setFormClienteSearch(c.nombre || '');
                                setClienteDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-800 hover:bg-orange-50 transition-colors"
                            >
                              {c.nombre}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Centro</label>
                  <select
                    value={formCentroId}
                    onChange={(e) => setFormCentroId(e.target.value)}
                    disabled={!formClienteId}
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecciona un centro...</option>
                    {centrosFiltrados.map(c => (
                      <option key={c._docId || c.id} value={c._docId || c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Título *</label>
                  <input
                    type="text"
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value.toUpperCase())}
                    placeholder="Ej: PRESUPUESTO MANTENIMIENTO ANUAL"
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 uppercase focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Fecha de validez</label>
                  <input
                    type="date"
                    value={formFechaValidez}
                    onChange={(e) => setFormFechaValidez(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Líneas del presupuesto */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase">Líneas del presupuesto</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCatalogo('articulo')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors">
                      <Package className="w-3.5 h-3.5" /> Añadir artículo
                    </button>
                    <button onClick={() => setShowCatalogo('servicio')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors">
                      <Wrench className="w-3.5 h-3.5" /> Añadir servicio
                    </button>
                  </div>
                </div>

                {/* Tabla de líneas */}
                {formLineas.length > 0 ? (
                  <div className="border border-zinc-200 rounded-xl overflow-hidden mb-3">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-xs min-w-[620px]">
                        <thead>
                          <tr className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                            <th className="px-2 py-2 text-center w-16" title="Posición y orden">Orden</th>
                            <th className="px-3 py-2 text-left w-12">Tipo</th>
                            <th className="px-3 py-2 text-left">Concepto</th>
                            <th className="px-3 py-2 text-center w-16">Cant.</th>
                            <th className="px-3 py-2 text-right w-28">Precio</th>
                            <th className="px-3 py-2 text-right w-28">Subtotal</th>
                            <th className="px-3 py-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formLineas.map((l, i) => (
                            <tr
                              key={l.id}
                              draggable
                              onDragStart={() => handleDragStart(i)}
                              onDragOver={(e) => handleDragOver(e, i)}
                              onDrop={() => handleDrop(i)}
                              onDragEnd={handleDragEnd}
                              className={`transition-colors ${
                                draggedLineIndex === i
                                  ? 'opacity-40 bg-orange-100/60'
                                  : dragOverLineIndex === i
                                  ? 'border-t-2 border-orange-500 bg-orange-50'
                                  : i % 2 === 0
                                  ? 'bg-white hover:bg-zinc-50/80'
                                  : 'bg-zinc-50/40 hover:bg-zinc-50/80'
                              }`}
                            >
                              <td className="px-1.5 py-1 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <div
                                    className="cursor-grab active:cursor-grabbing p-1 text-zinc-400 hover:text-orange-600 rounded transition-colors"
                                    title="Arrastra para mover de posición"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <button
                                      type="button"
                                      disabled={i === 0}
                                      onClick={() => handleMoverLinea(i, 'up')}
                                      className="p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                      title="Subir una posición"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={i === formLineas.length - 1}
                                      onClick={() => handleMoverLinea(i, 'down')}
                                      className="p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                      title="Bajar una posición"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-400 w-4 text-center select-none">
                                    {i + 1}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {l.fotoUrl ? (
                                  <img src={l.fotoUrl} alt={l.concepto} className="w-8 h-8 rounded-md object-cover border border-zinc-200 shrink-0 bg-white img-no-bg" />
                                ) : (
                                  l.tipo === 'articulo' ? <Package className="w-3.5 h-3.5 text-orange-500" /> :
                                  l.tipo === 'servicio' ? <Wrench className="w-3.5 h-3.5 text-red-600" /> :
                                  <Type className="w-3.5 h-3.5 text-zinc-400" />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="text"
                                    value={l.familia || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, familia: val } : li));
                                    }}
                                    placeholder="Familia (ej. EXTINTORES)..."
                                    className="w-full px-2 py-1 font-bold text-zinc-950 uppercase tracking-tight bg-white border border-zinc-200/90 rounded-lg text-xs placeholder:font-normal placeholder:normal-case placeholder:text-zinc-400 focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500 outline-none"
                                  />
                                  <textarea
                                    value={l.descripcion !== undefined && l.descripcion !== '' ? l.descripcion : l.concepto}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, concepto: val, descripcion: val } : li));
                                    }}
                                    rows={1}
                                    placeholder="Descripción del artículo..."
                                    className="w-full px-2 py-1 text-zinc-700 bg-zinc-50 border border-zinc-200/80 rounded-lg text-xs placeholder:text-zinc-400 focus:bg-white focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500 outline-none resize-y min-h-[26px]"
                                  />
                                  {l.codigo && <p className="text-[10px] text-zinc-400 font-mono px-0.5">{l.codigo}</p>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center" onMouseDown={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  value={l.cantidad}
                                  onChange={(e) => {
                                    const nuevaCant = Math.max(0, Number(e.target.value));
                                    setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, cantidad: nuevaCant, subtotal: nuevaCant * li.precioUnidad } : li));
                                  }}
                                  min={0}
                                  className="w-16 px-2 py-1 text-center text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-right" onMouseDown={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={l.precioUnidadInput !== undefined ? l.precioUnidadInput : formatDecimalInput(l.precioUnidad)}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, precioUnidadInput: inputValue, precioUnidad: parseDecimal(inputValue), subtotal: li.cantidad * parseDecimal(inputValue) } : li));
                                  }}
                                  onBlur={(e) => {
                                    const inputValue = e.target.value;
                                    const nuevoPrecio = Math.max(0, parseDecimal(inputValue));
                                    setFormLineas(prev => prev.map(li => li.id === l.id ? { ...li, precioUnidad: nuevoPrecio, precioUnidadInput: undefined, subtotal: li.cantidad * nuevoPrecio } : li));
                                  }}
                                  min={0}
                                  className="w-24 px-2 py-1 text-right text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-zinc-800">{formatMoneda(l.cantidad * l.precioUnidad)}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => handleRemoveLinea(l.id)} className="p-1 text-zinc-300 hover:text-red-500 rounded transition-colors cursor-pointer">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 mb-3">
                    <p className="text-sm text-zinc-400">No hay líneas añadidas. Usa los botones superiores para añadir artículos, servicios o una línea manual.</p>
                  </div>
                )}

                {/* Previsualización del descuento bajo todos los artículos */}
                {formDescuento > 0 && (
                  <div className="border-y-2 border-zinc-200 py-2 px-3 mb-3 bg-red-50/40 flex items-center justify-between text-xs font-bold text-red-600 rounded-lg">
                    <span>Descuento sobre el subtotal: {formDescuento.toFixed(2).replace('.', ',')} %</span>
                    <span>-{formatMoneda(formDescuentoImporte)}</span>
                  </div>
                )}

                {/* Línea manual */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={formNewLinea.familia}
                      onChange={(e) => setFormNewLinea(prev => ({ ...prev, familia: e.target.value }))}
                      placeholder="Familia (en negrita)..."
                      className="sm:w-44 px-3 py-2 font-bold uppercase tracking-tight bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder:font-normal placeholder:normal-case placeholder:text-zinc-400 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                    />
                    <input
                      type="text"
                      value={formNewLinea.concepto}
                      onChange={(e) => setFormNewLinea(prev => ({ ...prev, concepto: e.target.value, descripcion: e.target.value }))}
                      placeholder="Descripción del artículo..."
                      className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formNewLinea.cantidad}
                      onChange={(e) => setFormNewLinea(prev => ({ ...prev, cantidad: Math.max(1, Number(e.target.value)) }))}
                      min={1}
                      className="w-20 sm:w-16 px-2 py-2 text-center bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                      placeholder="Cant"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatDecimalInput(formNewLinea.precioUnidad)}
                      onChange={(e) => setFormNewLinea(prev => ({ ...prev, precioUnidad: Math.max(0, parseDecimal(e.target.value)) }))}
                      min={0}
                      className="flex-1 sm:w-24 px-2 py-2 text-right bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                      placeholder="0,00"
                    />
                    <button
                      onClick={handleAddManual}
                      disabled={!formNewLinea.concepto.trim()}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* IVA / Impuestos */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Tipo de IVA</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setFormIvaExento(false); setFormIva(getDefaultIva()); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        !formIvaExento 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      IVA {getDefaultIva()}%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormIvaExento(true); setFormIva(0); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        formIvaExento 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      Exento
                    </button>
                  </div>
                </div>
                {formIvaExento && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-[11px] text-amber-800 italic leading-relaxed">
                      Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012
                    </p>
                  </div>
                )}
              </div>

              {/* Descuento sobre el subtotal */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Descuento sobre el subtotal</label>
                    <p className="text-[11px] text-zinc-400">Aplica un porcentaje de descuento global sobre el subtotal del presupuesto.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formDescuento === 0 ? '' : formDescuento}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setFormDescuento(val);
                        }}
                        placeholder="0"
                        className="w-16 text-right text-xs font-bold text-zinc-800 outline-none"
                      />
                      <span className="text-xs font-bold text-zinc-500">%</span>
                    </div>
                    {[0, 5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setFormDescuento(pct)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          formDescuento === pct
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-zinc-200/80 text-zinc-600 hover:bg-zinc-300'
                        }`}
                      >
                        {pct === 0 ? 'Sin dto.' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Notas</label>
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={3}
                  placeholder="Condiciones, observaciones..."
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                />
                {usuarioActual && (
                  <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-100">
                    Presupuesto realizado por: <span className="font-semibold text-zinc-700">{usuarioActual.nombre}{usuarioActual.apellidos ? ' ' + usuarioActual.apellidos : ''}</span>
                  </div>
                )}
              </div>

              {/* Totales */}
              <div className="border-t border-zinc-100 pt-4 flex flex-col items-end gap-1">
                <div className="text-sm text-zinc-500">Subtotal: <span className="font-bold text-zinc-800">{formatMoneda(formSubtotal)}</span></div>
                {formDescuento > 0 && (
                  <div className="w-full max-w-sm border-y-2 border-zinc-200 py-2 my-1 flex items-center justify-between text-xs font-bold text-red-600">
                    <span>Descuento sobre el subtotal: {formDescuento.toFixed(2).replace('.', ',')} %</span>
                    <span>-{formatMoneda(formDescuentoImporte)}</span>
                  </div>
                )}
                {formIvaExento ? (
                  <div className="text-sm text-zinc-500">IVA: <span className="font-bold text-zinc-800">Exento (0%)</span></div>
                ) : (
                  <div className="text-sm text-zinc-500">IVA ({formIva}%): <span className="font-bold text-zinc-800">{formatMoneda(formBaseImponible * formIva / 100)}</span></div>
                )}
                <div className="text-lg font-black text-orange-600">TOTAL: {formatMoneda(formTotal)}</div>
                {formIvaExento && (
                  <div className="text-[10px] text-zinc-400 italic text-right max-w-xs mt-1">
                    Factura exenta de IVA por inversión del sujeto pasivo de acuerdo con el artículo 84 letra f-Uno. 2º - Ley 37/1992 - art. 5 Ley 7/2012
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-t border-zinc-100 flex items-center justify-between gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleGuardar} className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-orange-200 transition-all cursor-pointer">
                <Save className="w-4 h-4" /> {editingPresupuesto ? 'Guardar cambios' : 'Crear presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATÁLOGO (seleccionar artículo/servicio) */}
      {showCatalogo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                {showCatalogo === 'articulo' ? <Package className="w-5 h-5 text-orange-500" /> : <Wrench className="w-5 h-5 text-red-600" />}
                {showCatalogo === 'articulo' ? 'Seleccionar artículo' : 'Seleccionar servicio'}
              </h2>
              <button onClick={() => { setShowCatalogo(null); setCatalogoSearch(''); }} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Buscador dentro del catálogo */}
            <div className="px-4 pt-2 pb-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={catalogoSearch}
                  onChange={(e) => setCatalogoSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o familia..."
                  className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 placeholder-zinc-400 focus:ring-1 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                />
                {catalogoSearch && (
                  <button onClick={() => setCatalogoSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {(showCatalogo === 'articulo' ? articulos : servicios).length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">No hay {showCatalogo === 'articulo' ? 'artículos' : 'servicios'} disponibles en el catálogo.</p>
              ) : filteredCatalogoItems.length === 0 ? (
                <p className="text-center text-sm text-zinc-400 py-8">No se encontraron resultados para "{catalogoSearch}"</p>
              ) : (
                filteredCatalogoItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddFromCatalogo(item, showCatalogo)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-all text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 truncate">{item.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.codigo && <span className="text-[10px] font-mono text-zinc-400">{item.codigo}</span>}
                        {item.familia && <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{item.familia}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-black text-zinc-900 ml-3">{formatMoneda(item.precioVenta)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREGUNTAR TIPO DE TRABAJO AL ACEPTAR PRESUPUESTO */}
      {presupuestoParaAceptar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera */}
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Crear Pedido / Derivar Trabajo</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">Selecciona el módulo donde se guardará el pedido</p>
                </div>
              </div>
              <button 
                onClick={() => setPresupuestoParaAceptar(null)}
                disabled={isProcessingAceptacion}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del presupuesto */}
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Presupuesto de Venta</span>
                  <span className="text-xs font-mono font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                    {formatCodigoPresupuesto(presupuestoParaAceptar.numeroPresupuesto, presupuestoParaAceptar.id)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nuevo Pedido Generado</span>
                  <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-xs flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    {formatCodigoPedido(presupuestoParaAceptar.numeroPresupuesto, presupuestoParaAceptar.id)}
                  </span>
                </div>
                <div className="border-t border-slate-200/70 pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium truncate max-w-[200px]">{presupuestoParaAceptar.nombreCliente || 'Cliente'}</span>
                  <span className="font-black text-slate-900">{formatMoneda(presupuestoParaAceptar.total)}</span>
                </div>
              </div>

              {/* Selector de Tipo de Trabajo */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2.5">
                  ¿A qué módulo pasará este pedido?
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Opción 1: Reparación */}
                  <button
                    type="button"
                    onClick={() => setTipoTrabajoSeleccionado('Reparación')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                      tipoTrabajoSeleccionado === 'Reparación'
                        ? 'border-red-600 bg-red-50/70 text-red-950 shadow-sm scale-[1.02]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      tipoTrabajoSeleccionado === 'Reparación' ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      <Wrench className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold leading-tight">Reparación</span>
                    <span className="text-[10px] text-zinc-500 mt-1">Averías</span>
                  </button>

                  {/* Opción 2: Instalación */}
                  <button
                    type="button"
                    onClick={() => setTipoTrabajoSeleccionado('Instalación')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                      tipoTrabajoSeleccionado === 'Instalación'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-sm scale-[1.02]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      tipoTrabajoSeleccionado === 'Instalación' ? 'bg-amber-600 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      <HardHat className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold leading-tight">Instalación</span>
                    <span className="text-[10px] text-zinc-500 mt-1">Montajes</span>
                  </button>

                  {/* Opción 3: Prueba técnica */}
                  <button
                    type="button"
                    onClick={() => setTipoTrabajoSeleccionado('Prueba técnica')}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                      tipoTrabajoSeleccionado === 'Prueba técnica'
                        ? 'border-sky-600 bg-sky-50/70 text-sky-950 shadow-sm scale-[1.02]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                      tipoTrabajoSeleccionado === 'Prueba técnica' ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      <Gauge className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold leading-tight">Prueba técnica</span>
                    <span className="text-[10px] text-zinc-500 mt-1">Ensayos</span>
                  </button>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPresupuestoParaAceptar(null)}
                  disabled={isProcessingAceptacion}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAceptacion}
                  disabled={isProcessingAceptacion}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAceptacion ? (
                    <span>Procesando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar y Generar Pedido</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ENVIAR PRESUPUESTO MEDIANTE ENLACE SEGURO */}
      {presupuestoParaEnviar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            {/* Cabecera */}
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Enviar Presupuesto por Enlace</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    {formatCodigoPresupuesto(presupuestoParaEnviar.numeroPresupuesto, presupuestoParaEnviar.id)} &bull; {presupuestoParaEnviar.nombreCliente || 'Cliente'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPresupuestoParaEnviar(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Enlace generado */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Enlace único y seguro de acceso
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-700 select-all truncate">
                    {enlaceGenerado}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopiarEnlace(enlaceGenerado)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
                      enlaceCopiado 
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
                        : 'bg-zinc-900 hover:bg-black text-white'
                    }`}
                  >
                    {enlaceCopiado ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Enlace</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  El cliente podrá visualizar las partidas, descargar el PDF y firmar digitalmente.
                </p>
              </div>

              {/* Remitente Fijo Corporativo */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Cuenta Remitente Oficial
                </label>
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-sky-50/70 border border-sky-200/80 rounded-xl text-xs font-bold text-sky-900">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>abanfoc@abanfoc.es</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-200/70 text-sky-800 rounded-md">
                    Fija Corporativa
                  </span>
                </div>
              </div>

              {/* Selector / Input de Correo */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Destinatario de Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={emailDestino}
                    onChange={(e) => setEmailDestino(e.target.value)}
                    placeholder="correo@cliente.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Cuentas de correo sugeridas del cliente */}
                {(() => {
                  const cli = clientes.find(c => (c as any)._docId === presupuestoParaEnviar.clienteId || c.id === presupuestoParaEnviar.clienteId || c.nombre === presupuestoParaEnviar.nombreCliente);
                  const emails = [
                    cli?.correoGeneral,
                    cli?.correoAdministracion,
                    cli?.correoFacturacion,
                    cli?.correoMantenimiento,
                    cli?.correoCompras,
                    cli?.correoPedidos,
                    cli?.correo,
                  ].filter((em, i, arr): em is string => Boolean(em && typeof em === 'string' && em.trim() && arr.indexOf(em) === i));

                  if (emails.length <= 1 && (!emails[0] || emails[0] === emailDestino)) return null;

                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase mr-1">Cuentas cliente:</span>
                      {emails.map(em => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setEmailDestino(em)}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                            emailDestino === em 
                              ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold' 
                              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Vista previa del mensaje */}
              <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Vista Previa del Asunto</span>
                  <span className="text-[10px] text-zinc-400 font-mono">ABANFOC S.L.</span>
                </div>
                <p className="text-xs font-bold text-zinc-800 mb-2">
                  Presupuesto {formatCodigoPresupuesto(presupuestoParaEnviar.numeroPresupuesto, presupuestoParaEnviar.id)} - {presupuestoParaEnviar.titulo} - ABANFOC S.L.
                </p>
                <div className="pt-2 border-t border-zinc-200/60 text-xs text-zinc-600 space-y-1">
                  <p>Estimado/a cliente,</p>
                  <p>Le adjuntamos el enlace para consultar, descargar y rubricar la aceptación de la oferta por importe de <strong>{formatMoneda(presupuestoParaEnviar.total)}</strong>.</p>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="p-5 border-t border-zinc-100 bg-white flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setPresupuestoParaEnviar(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleCopiarEnlace(enlaceGenerado)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{enlaceCopiado ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmarEnvioEmail}
                disabled={isSendingEmail}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                <span>{isSendingEmail ? 'Enviando...' : 'Abrir en Correo y Marcar Enviado'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEGUIMIENTO Y AUDITORÍA DE PRESUPUESTO */}
      {presupuestoParaSeguimiento && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            {/* Cabecera */}
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Seguimiento y Trazabilidad del Enlace</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    {formatCodigoPresupuesto(presupuestoParaSeguimiento.numeroPresupuesto, presupuestoParaSeguimiento.id)} &bull; {presupuestoParaSeguimiento.titulo}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPresupuestoParaSeguimiento(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Tarjetas KPI de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Envío */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-1 mb-1">
                    <span className="uppercase tracking-wider flex items-center gap-1">
                      <Send className="w-3 h-3 text-sky-500" /> Envío
                    </span>
                    <span className="text-[9px] font-semibold text-zinc-400 lowercase truncate">
                      abanfoc@abanfoc.es
                    </span>
                  </div>
                  <p className="text-xs font-black text-zinc-800">
                    {presupuestoParaSeguimiento.seguimiento?.fechaEnvio 
                      ? formatFecha(presupuestoParaSeguimiento.seguimiento.fechaEnvio) 
                      : (presupuestoParaSeguimiento.estado === 'Enviado' ? 'Enviado' : 'Pendiente')}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate mt-1">
                    Para: <span className="font-semibold text-zinc-700">{presupuestoParaSeguimiento.seguimiento?.destinatarioEmail || 'Sin email reg.'}</span>
                  </p>
                </div>

                {/* 2. Visitas */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                    <Eye className="w-3 h-3 text-sky-600" /> Visitas
                  </div>
                  <p className="text-xl font-black text-zinc-900 leading-none">
                    {presupuestoParaSeguimiento.seguimiento?.visitasCount || 0}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {presupuestoParaSeguimiento.seguimiento?.primeraApertura 
                      ? `1.ª: ${formatFecha(presupuestoParaSeguimiento.seguimiento.primeraApertura)}` 
                      : 'No abierto'}
                  </p>
                </div>

                {/* 3. Descargas PDF */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                    <Download className="w-3 h-3 text-emerald-600" /> Descargas PDF
                  </div>
                  <p className="text-xl font-black text-zinc-900 leading-none">
                    {presupuestoParaSeguimiento.seguimiento?.descargasCount || 0}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {Number(presupuestoParaSeguimiento.seguimiento?.descargasCount) > 0 ? 'Documento bajado' : 'Sin descargas'}
                  </p>
                </div>

                {/* 4. Estado de Firma */}
                <div className={`border rounded-2xl p-3.5 flex flex-col justify-between ${
                  presupuestoParaSeguimiento.seguimiento?.firmado 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                    : 'bg-zinc-50 border-zinc-200/80'
                }`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 text-zinc-400">
                    <CheckCircle className={`w-3 h-3 ${presupuestoParaSeguimiento.seguimiento?.firmado ? 'text-emerald-600' : 'text-zinc-400'}`} /> Firma
                  </div>
                  <p className={`text-xs font-black ${presupuestoParaSeguimiento.seguimiento?.firmado ? 'text-emerald-800' : 'text-zinc-700'}`}>
                    {presupuestoParaSeguimiento.seguimiento?.firmado ? 'Firmado' : 'Sin firmar'}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate mt-1">
                    {presupuestoParaSeguimiento.seguimiento?.firmado?.nombre || 'Pendiente'}
                  </p>
                </div>
              </div>

              {/* Si está firmado, mostrar tarjeta con firma */}
              {presupuestoParaSeguimiento.seguimiento?.firmado && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Firma Registrada
                    </span>
                    <h4 className="text-sm font-bold text-emerald-950 mt-1.5">
                      {presupuestoParaSeguimiento.seguimiento.firmado.nombre}
                    </h4>
                    <p className="text-xs text-emerald-800">
                      DNI / NIF: <strong className="font-mono">{presupuestoParaSeguimiento.seguimiento.firmado.dni}</strong> &bull; Fecha: {formatFecha(presupuestoParaSeguimiento.seguimiento.firmado.fecha)}
                    </p>
                  </div>
                  {presupuestoParaSeguimiento.seguimiento.firmado.firmaBase64 && (
                    <div className="bg-white p-2 rounded-xl border border-emerald-200 shadow-xs">
                      <img 
                        src={presupuestoParaSeguimiento.seguimiento.firmado.firmaBase64} 
                        alt="Rúbrica digital" 
                        className="h-16 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Enlace y Acciones Rápidas */}
              {(() => {
                const token = presupuestoParaSeguimiento.seguimiento?.tokenAcceso || (presupuestoParaSeguimiento as any)._docId || presupuestoParaSeguimiento.id;
                const linkUrl = `${window.location.origin}/portal-presupuesto/${token}`;
                return (
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Enlace Directo al Portal</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={linkUrl} 
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono text-zinc-700 truncate select-all"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(linkUrl);
                          setCopiadoSeguimiento(true);
                          setTimeout(() => setCopiadoSeguimiento(false), 3000);
                        }}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiadoSeguimiento ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiadoSeguimiento ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-sky-600 hover:border-sky-300 transition-colors shrink-0"
                        title="Abrir portal en nueva pestaña"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Historial Cronológico (Timeline) */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Historial Cronológico de Actividad
                </h4>

                {Array.isArray(presupuestoParaSeguimiento.seguimiento?.eventos) && presupuestoParaSeguimiento.seguimiento.eventos.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
                    {presupuestoParaSeguimiento.seguimiento.eventos.map((ev, idx) => {
                      let iconBg = 'bg-zinc-100 text-zinc-600';
                      let IconComponent = Clock;
                      if (ev.tipo === 'envio') {
                        iconBg = 'bg-sky-100 text-sky-700';
                        IconComponent = Send;
                      } else if (ev.tipo === 'visita') {
                        iconBg = 'bg-blue-100 text-blue-700';
                        IconComponent = Eye;
                      } else if (ev.tipo === 'descarga_pdf') {
                        iconBg = 'bg-emerald-100 text-emerald-700';
                        IconComponent = Download;
                      } else if (ev.tipo === 'firmado') {
                        iconBg = 'bg-emerald-600 text-white';
                        IconComponent = Check;
                      }

                      return (
                        <div key={idx} className="relative flex items-start gap-3 text-xs">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 -ml-6 z-10 ${iconBg} shadow-xs`}>
                            <IconComponent className="w-2.5 h-2.5" />
                          </div>
                          <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-2.5 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-900">{ev.detalle || ev.tipo}</span>
                              <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                                {new Date(ev.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-xs">
                    No se han registrado visitas ni eventos todavía.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-100 bg-white flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPresupuestoParaSeguimiento(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ACCIONES */}
      {presupuestoParaAcciones && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPresupuestoParaAcciones(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden border border-zinc-100 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black text-xs font-mono shadow-md">
                  PRV
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-zinc-900 font-mono">
                      {formatCodigoPresupuesto(presupuestoParaAcciones.numeroPresupuesto, presupuestoParaAcciones.id)}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getEstadoInfo(presupuestoParaAcciones.estado).bg} ${getEstadoInfo(presupuestoParaAcciones.estado).color}`}>
                      {getEstadoInfo(presupuestoParaAcciones.estado).etiqueta}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium truncate max-w-[320px]">
                    {presupuestoParaAcciones.nombreCliente || 'Cliente'} &bull; <span className="font-bold text-zinc-800">{formatMoneda(presupuestoParaAcciones.total)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPresupuestoParaAcciones(null)}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer flex items-center justify-center"
                title="Cerrar"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Opciones de Acción con descripción debajo */}
            <div className="p-5 overflow-y-auto space-y-2.5">
              {/* 1. Editar Presupuesto */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  handleEditar(p);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-amber-400 bg-white hover:bg-amber-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Edit className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-amber-900 transition-colors">
                    Editar Presupuesto
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Modificar partidas, familias, descripciones, unidades, precios y notas del presupuesto.
                  </p>
                </div>
              </button>

              {/* 2. Duplicar Presupuesto (Nueva Versión) */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  handleDuplicar(p);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-purple-400 bg-white hover:bg-purple-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Copy className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-purple-900 transition-colors">
                    Duplicar Presupuesto
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Crear una copia completa para realizar modificaciones y generar una nueva versión independiente.
                  </p>
                </div>
              </button>

              {/* 2. Enviar por Enlace Seguro */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  handleAbrirModalEnvio(p);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-sky-400 bg-white hover:bg-sky-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-sky-900 transition-colors">
                    Enviar por Enlace Seguro
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Generar o copiar el enlace interactivo para visualización y firma digital del cliente.
                  </p>
                </div>
              </button>

              {/* 3. Seguimiento y Visitas */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  setPresupuestoParaSeguimiento(p);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform relative">
                  <Activity className="w-5 h-5" />
                  {presupuestoParaAcciones.seguimiento?.visitasCount && presupuestoParaAcciones.seguimiento.visitasCount > 0 ? (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-900 group-hover:text-indigo-900 transition-colors">
                      Historial y Seguimiento
                    </p>
                    {presupuestoParaAcciones.seguimiento?.firmado ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Firmado
                      </span>
                    ) : presupuestoParaAcciones.seguimiento?.visitasCount && presupuestoParaAcciones.seguimiento.visitasCount > 0 ? (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                        {presupuestoParaAcciones.seguimiento.visitasCount} visitas
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Consultar el historial cronológico de aperturas, accesos web y firma digital del cliente.
                  </p>
                </div>
              </button>

              {/* 4. Crear Pedido de Trabajo */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  setPresupuestoParaAceptar(p);
                  setTipoTrabajoSeleccionado((p.tipoTrabajo as any) || 'Reparación');
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-emerald-400 bg-white hover:bg-emerald-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-900 group-hover:text-emerald-900 transition-colors">
                      Crear Pedido de Trabajo
                    </p>
                    {presupuestoParaAcciones.pedidoId && (
                      <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                        {presupuestoParaAcciones.pedidoId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    {presupuestoParaAcciones.pedidoId
                      ? `Ya vinculado a pedido (${presupuestoParaAcciones.pedidoId}). Clic para derivar o crear uno nuevo.`
                      : 'Convertir el presupuesto en una orden de trabajo (Reparación, Instalación o Prueba técnica).'}
                  </p>
                </div>
              </button>

              {/* 5. Descargar PDF Oficial */}
              <button
                type="button"
                onClick={() => {
                  handleDescargar(presupuestoParaAcciones);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-teal-400 bg-white hover:bg-teal-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-teal-900 transition-colors">
                    Descargar PDF Oficial
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Generar y descargar el documento PDF con membrete de la empresa, familias y desglose.
                  </p>
                </div>
              </button>

              {/* 6. Eliminar Presupuesto */}
              <button
                type="button"
                onClick={() => {
                  const p = presupuestoParaAcciones;
                  setPresupuestoParaAcciones(null);
                  handleEliminar(p);
                }}
                className="w-full text-left p-3.5 rounded-2xl border border-zinc-200/80 hover:border-red-400 bg-white hover:bg-red-50/40 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs hover:shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-700 group-hover:text-red-900 transition-colors">
                    Eliminar Presupuesto
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Borrar permanentemente este presupuesto del registro del sistema.
                  </p>
                </div>
              </button>
            </div>

            {/* Pie de la ventana modal: Diferentes opciones de estado */}
            <div className="px-6 py-4 bg-zinc-50/90 border-t border-zinc-200/80 shrink-0">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                Cambiar estado del presupuesto:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {ESTADOS.map(e => {
                  const Icono = e.icono;
                  const esActivo = presupuestoParaAcciones.estado === e.valor;
                  return (
                    <button
                      key={e.valor}
                      type="button"
                      onClick={async () => {
                        const p = presupuestoParaAcciones;
                        if (e.valor === 'Aprobado') {
                          setPresupuestoParaAcciones(null);
                          setPresupuestoParaAceptar(p);
                          setTipoTrabajoSeleccionado((p.tipoTrabajo as any) || 'Reparación');
                          return;
                        }
                        if (e.valor === 'Enviado') {
                          setPresupuestoParaAcciones(null);
                          handleAbrirModalEnvio(p);
                          return;
                        }
                        await handleCambiarEstado(p, e.valor);
                        setPresupuestoParaAcciones(prev => prev ? { ...prev, estado: e.valor } : null);
                      }}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        esActivo
                          ? `${e.bg} ${e.color} border-current ring-2 ring-offset-1 ring-zinc-300 shadow-sm scale-[1.02]`
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <Icono className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{e.etiqueta}</span>
                      {esActivo && <Check className="w-3.5 h-3.5 ml-0.5 stroke-[3] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE ÉXITO */}
      {toastExito && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold">{toastExito}</p>
          <button onClick={() => setToastExito(null)} className="ml-2 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}