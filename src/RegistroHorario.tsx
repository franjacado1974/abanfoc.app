import { useState, useEffect, useMemo } from 'react';
import { 
  Clock, ArrowRightCircle, ArrowLeftCircle, 
  Download, Search, Filter, Calendar, Users, 
  Trash2, RefreshCw
} from 'lucide-react';
import { 
  subscribeRegistroHorario, 
  subscribeUsuarios, 
  deleteRegistroHorario, 
  type FichajeHorario 
} from './firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from './constants';

export default function RegistroHorario() {
  const [registros, setRegistros] = useState<FichajeHorario[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('todos');
  const [selectedType, setSelectedType] = useState<'todos' | 'entrada' | 'salida'>('todos');
  const [dateRangePreset, setDateRangePreset] = useState<'hoy' | 'semana' | 'mes' | 'todos' | 'custom'>('mes');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modal confirmación eliminar
  const [itemToDelete, setItemToDelete] = useState<FichajeHorario | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubReg = subscribeRegistroHorario((items) => {
      setRegistros(items);
      setLoading(false);
    });

    const unsubUsers = subscribeUsuarios((usersList) => {
      setUsuarios(usersList);
    });

    return () => {
      unsubReg();
      unsubUsers();
    };
  }, []);

  // Calcular fechas para presets
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const weekStartStr = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
    const monday = new Date(d.setDate(diff));
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dayStr = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  }, []);

  const monthStartStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }, []);

  // Filtrar usuarios con rol "Técnico" o "Administración" (excluyendo Super Administrador y Administrador)
  const eligibleUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const r = (u.rol || '').toString().trim().toLowerCase();
      if (
        r === 'super-administrador' ||
        r === 'superadministrador' ||
        r === 'superusuario' ||
        r === 'administrador' ||
        r === 'admin'
      ) {
        return false;
      }
      return (
        r === 'tecnico' ||
        r === 'técnico' ||
        r === 'administracion' ||
        r === 'administración' ||
        r === 'editor' ||
        r === 'visualizador'
      );
    });
  }, [usuarios]);

  // Filtrado de registros
  const filteredRegistros = useMemo(() => {
    return registros.filter((reg) => {
      // 1. Filtro de usuario
      if (selectedUser !== 'todos' && reg.usuarioId !== selectedUser && reg.usuarioNombre !== selectedUser) {
        return false;
      }

      // 2. Filtro de tipo
      if (selectedType !== 'todos' && reg.tipo !== selectedType) {
        return false;
      }

      // 3. Filtro de fecha
      if (dateRangePreset === 'hoy') {
        if (reg.fecha !== todayStr) return false;
      } else if (dateRangePreset === 'semana') {
        if (reg.fecha < weekStartStr || reg.fecha > todayStr) return false;
      } else if (dateRangePreset === 'mes') {
        if (reg.fecha < monthStartStr || reg.fecha > todayStr) return false;
      } else if (dateRangePreset === 'custom') {
        if (customStartDate && reg.fecha < customStartDate) return false;
        if (customEndDate && reg.fecha > customEndDate) return false;
      }

      // 4. Búsqueda por texto (nombre, rol, notas)
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchName = (reg.usuarioNombre || '').toLowerCase().includes(q);
        const matchRol = (reg.usuarioRol || '').toLowerCase().includes(q);
        const matchNotas = (reg.notas || '').toLowerCase().includes(q);
        const matchHora = (reg.hora || '').toLowerCase().includes(q);
        const matchFecha = (reg.fecha || '').toLowerCase().includes(q);
        if (!matchName && !matchRol && !matchNotas && !matchHora && !matchFecha) {
          return false;
        }
      }

      return true;
    });
  }, [
    registros,
    selectedUser,
    selectedType,
    dateRangePreset,
    customStartDate,
    customEndDate,
    searchTerm,
    todayStr,
    weekStartStr,
    monthStartStr,
  ]);

  // Estadísticas del día
  const stats = useMemo(() => {
    const total = registros.length;
    const hoyRegistros = registros.filter((r) => r.fecha === todayStr);
    const entradasHoy = hoyRegistros.filter((r) => r.tipo === 'entrada').length;
    const salidasHoy = hoyRegistros.filter((r) => r.tipo === 'salida').length;
    
    const usuariosHoySet = new Set(hoyRegistros.map((r) => r.usuarioNombre));
    const usuariosActivosHoy = usuariosHoySet.size;

    return {
      total,
      entradasHoy,
      salidasHoy,
      usuariosActivosHoy,
    };
  }, [registros, todayStr]);

  const handleDelete = async () => {
    if (!itemToDelete || !itemToDelete.id) return;
    setIsDeleting(true);
    try {
      await deleteRegistroHorario(itemToDelete.id);
      setItemToDelete(null);
    } catch (e) {
      console.error('Error eliminando registro:', e);
      alert('Error al eliminar el registro');
    } finally {
      setIsDeleting(false);
    }
  };

  // Generación y descarga de PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();

      // Cabecera institucional
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, 'F');

      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('REGISTRO HORARIO Y CONTROL DE JORNADA', 14, 13);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Sistema Salamandra - ABANFOC | Versión ${APP_VERSION}`, 14, 20);

      // Metadatos de emisión
      doc.setFontSize(8);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, pageWidth - 14, 20, { align: 'right' });

      // Cuadro de Resumen del Filtro
      let currentY = 36;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Informe de Fichajes', 14, currentY);

      currentY += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);

      const periodoTexto =
        dateRangePreset === 'hoy'
          ? `Hoy (${todayStr})`
          : dateRangePreset === 'semana'
          ? `Esta semana (${weekStartStr} a ${todayStr})`
          : dateRangePreset === 'mes'
          ? `Este mes (${monthStartStr} a ${todayStr})`
          : dateRangePreset === 'custom'
          ? `Periodo personalizado: ${customStartDate || 'Inicio'} hasta ${customEndDate || 'Hoy'}`
          : 'Histórico completo';

      const usuarioTexto =
        selectedUser === 'todos'
          ? 'Todos los usuarios'
          : usuarios.find((u) => u.id === selectedUser || u.nombre === selectedUser)?.nombre || selectedUser;

      const tipoTexto =
        selectedType === 'todos' ? 'Entradas y Salidas' : selectedType === 'entrada' ? 'Solo Entradas' : 'Solo Salidas';

      doc.text(`Periodo: ${periodoTexto}`, 14, currentY);
      doc.text(`Empleado/Usuario: ${usuarioTexto}`, 14, currentY + 5);
      doc.text(`Filtro: ${tipoTexto} | Total de registros listados: ${filteredRegistros.length}`, 14, currentY + 10);

      currentY += 16;

      // Filas para la tabla
      const tableRows = filteredRegistros.map((r) => {
        const tipoLabel = r.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA';
        const fechaFormat = r.fecha ? r.fecha.split('-').reverse().join('/') : '-';
        return [
          r.usuarioNombre || 'Desconocido',
          r.usuarioRol || 'Técnico',
          tipoLabel,
          fechaFormat,
          r.hora || '-',
          r.notas || '-',
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['EMPLEADO / USUARIO', 'ROL', 'TIPO', 'FECHA', 'HORA', 'OBSERVACIONES']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [220, 38, 38], // red-600
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold' },
          1: { cellWidth: 25 },
          2: { cellWidth: 25, fontStyle: 'bold' },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'ENTRADA') {
              data.cell.styles.textColor = [16, 185, 129]; // emerald-600
            } else if (data.cell.raw === 'SALIDA') {
              data.cell.styles.textColor = [239, 68, 68]; // red-500
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Pie de página con numeración
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${pageCount} - Documento generado automáticamente por Salamandra FireCheck`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      // Descargar
      const fileName = `Registro_Horario_${usuarioTexto.replace(/\s+/g, '_')}_${todayStr}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Error generando PDF de registro horario:', err);
      alert('Hubo un error al generar el PDF.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-zinc-200/80 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <Clock className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl font-black text-zinc-900 tracking-tight">Registro Horario</h1>
                <span className="bg-red-50 text-red-700 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-red-200">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Control de jornada laboral y registro de entradas y salidas de todos los usuarios
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportPDF}
              disabled={filteredRegistros.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              title="Descargar informe en formato PDF"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Registros</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-zinc-950 mt-2">{stats.total}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Histórico global</p>
          </div>

          <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Entradas Hoy</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <ArrowRightCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2">{stats.entradasHoy}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Fichajes de entrada hoy</p>
          </div>

          <div className="bg-white border border-red-200/80 rounded-2xl p-4 shadow-sm bg-gradient-to-br from-white to-red-50/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Salidas Hoy</span>
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-700">
                <ArrowLeftCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-red-700 mt-2">{stats.salidasHoy}</p>
            <p className="text-[11px] text-red-600/80 mt-0.5">Fichajes de salida hoy</p>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Personal Activo Hoy</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-zinc-950 mt-2">{stats.usuariosActivosHoy}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Usuarios que han fichado</p>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-zinc-500" />
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">Filtros y Búsqueda</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda por texto */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Buscar por texto</label>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nombre, rol, notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Selector de Usuario */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Usuario / Empleado</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="todos">Todos los usuarios</option>
                {eligibleUsers.map((u) => {
                  const label = u.nombre ? `${u.nombre} ${u.apellidos || ''}` : u.usuario || u.id;
                  return (
                    <option key={u.id || u._docId} value={u.id || u.nombre}>
                      {label} ({u.rol || 'técnico'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selector de Tipo */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Tipo de Fichaje</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="todos">Todos (Entradas y Salidas)</option>
                <option value="entrada">🟢 Solo Entradas</option>
                <option value="salida">🔴 Solo Salidas</option>
              </select>
            </div>

            {/* Presets de Fecha */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 uppercase">Periodo</label>
              <select
                value={dateRangePreset}
                onChange={(e) => setDateRangePreset(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
                <option value="todos">Histórico completo</option>
                <option value="custom">Personalizado...</option>
              </select>
            </div>
          </div>

          {/* Rango de fecha personalizado */}
          {dateRangePreset === 'custom' && (
            <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500">Desde:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500">Hasta:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Table of Records */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-zinc-900">
              Registros ({filteredRegistros.length})
            </h3>
            {loading && (
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando...
              </span>
            )}
          </div>

          {filteredRegistros.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mx-auto mb-3">
                <Clock className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-zinc-700">No se encontraron registros</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                No hay fichajes de jornada que coincidan con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 text-[11px] font-black uppercase text-zinc-500 border-b border-zinc-200/60">
                    <th className="py-3 px-6">Empleado / Usuario</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredRegistros.map((reg) => {
                    const isEntrada = reg.tipo === 'entrada';
                    const fechaFormatted = reg.fecha ? reg.fecha.split('-').reverse().join('/') : '-';

                    return (
                      <tr key={reg.id || reg._docId} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3 px-6 font-bold text-zinc-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-700 shrink-0">
                              {(reg.usuarioNombre || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{reg.usuarioNombre || 'Usuario Desconocido'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">
                            {reg.usuarioRol || 'Técnico'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isEntrada ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ArrowRightCircle className="w-3.5 h-3.5" /> ENTRADA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                              <ArrowLeftCircle className="w-3.5 h-3.5" /> SALIDA
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-700">
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                            {fechaFormatted}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-900">
                          {reg.hora || '-'}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">
                          {reg.notas || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setItemToDelete(reg)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar este registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Confirmación de Eliminación */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden text-left">
            <div className="px-6 py-5 bg-red-50 border-b border-red-100 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-600 shadow-sm">
                <Trash2 className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-red-950">¿Eliminar registro?</h2>
              <p className="text-xs text-red-600 mt-1">
                Se eliminará el fichaje de {itemToDelete.usuarioNombre} ({itemToDelete.tipo.toUpperCase()}) del {itemToDelete.fecha} a las {itemToDelete.hora}.
              </p>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:bg-red-300"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar registro'}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="w-full px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
