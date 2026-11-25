import { useState, useEffect, useMemo } from 'react';
import {
  StickyNote, Plus, Search, Eye, Pencil, Trash2,
  User, X, Check, Clock, MapPin, CheckCircle2, Bell, Calendar, Layers, Download, Printer, ClipboardList
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  subscribeNotasBloc,
  addNotaBloc,
  updateNotaBloc,
  deleteNotaBloc,
  type NotaBlocItem,
  type NotaSeccionItem,
  type NotaPlanoElemento
} from './firebase';
import { optimizarImagenParaPDF } from './pdfGenerator';
import NotaSeccionesEditor, {
  exportarDataUrlConCajetin,
  renderPlanoConCajetinHiRes,
  buildReporteEquiposPorSecciones,
  hasLeyendaSimbolos,
  LEYENDA_W,
  type CajetinPlanoMeta
} from './components/NotaSeccionesEditor';

interface NotasProps {
  user?: { nombre: string; apellidos: string; rol: string; usuario?: string } | null;
}

const CATEGORIAS = ['Compras', 'Visitas', 'Presupuestos', 'Varias', 'Completadas'] as const;
type CategoriaNota = typeof CATEGORIAS[number];

const PRIORIDADES = ['Urgente', 'Alta', 'Media', 'Baja'] as const;
type PrioridadNota = typeof PRIORIDADES[number];

const CATEGORIAS_CONFIG: Record<CategoriaNota, { color: string; bgActive: string; badge: string; text: string }> = {
  Compras: {
    color: 'amber',
    bgActive: 'bg-amber-500 text-white shadow-md shadow-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    text: 'text-amber-700'
  },
  Visitas: {
    color: 'blue',
    bgActive: 'bg-blue-600 text-white shadow-md shadow-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    text: 'text-blue-700'
  },
  Presupuestos: {
    color: 'emerald',
    bgActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700'
  },
  Varias: {
    color: 'purple',
    bgActive: 'bg-purple-600 text-white shadow-md shadow-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    text: 'text-purple-700'
  },
  Completadas: {
    color: 'emerald',
    bgActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700'
  }
};

const PRIORIDAD_CONFIG: Record<PrioridadNota, { label: string; badge: string; dot: string }> = {
  Urgente: {
    label: 'Urgente',
    badge: 'bg-red-50 text-red-700 border-red-200/80 font-black',
    dot: 'bg-red-500 animate-pulse'
  },
  Alta: {
    label: 'Alta',
    badge: 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold',
    dot: 'bg-amber-500'
  },
  Media: {
    label: 'Media',
    badge: 'bg-blue-50 text-blue-700 border-blue-200/80 font-bold',
    dot: 'bg-blue-500'
  },
  Baja: {
    label: 'Baja',
    badge: 'bg-slate-50 text-slate-600 border-slate-200/80 font-medium',
    dot: 'bg-slate-400'
  }
};

export default function Notas({ user }: NotasProps) {
  // Estado de notas en tiempo real
  const [notas, setNotas] = useState<NotaBlocItem[]>(() => {
    try {
      const cached = localStorage.getItem('firecheck_db_notas_bloc');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Pestaña activa
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaNota>('Compras');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('Todas');

  // Modales
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [notaEditando, setNotaEditando] = useState<NotaBlocItem | null>(null);
  const [modalVerNota, setModalVerNota] = useState<NotaBlocItem | null>(null);
  const [notaAEliminar, setNotaAEliminar] = useState<NotaBlocItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formLugar, setFormLugar] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [formContenido, setFormContenido] = useState('');
  const [formCategoria, setFormCategoria] = useState<CategoriaNota>('Compras');
  const [formPrioridad, setFormPrioridad] = useState<PrioridadNota>('Media');
  const [formAlarmaActiva, setFormAlarmaActiva] = useState(false);
  const [formAlarmaDate, setFormAlarmaDate] = useState('');
  const [formAlarmaTime, setFormAlarmaTime] = useState('09:00');
  const [formSecciones, setFormSecciones] = useState<NotaSeccionItem[]>([]);
  const [formEmpresaMantenedora, setFormEmpresaMantenedora] = useState('');
  const [formClienteNombre, setFormClienteNombre] = useState('');
  const [formCentroNombre, setFormCentroNombre] = useState('');
  const [planoAmpliado, setPlanoAmpliado] = useState<{ url: string; title: string; nota?: NotaBlocItem } | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [savedInlineNotice, setSavedInlineNotice] = useState(false);
  const [reporteModalData, setReporteModalData] = useState<{
    titulo: string;
    cliente?: string;
    centro?: string;
    autor?: string;
    fecha?: string;
    secciones: NotaSeccionItem[];
  } | null>(null);

  const empresasList = useMemo<{ nombre: string }[]>(() => {
    try {
      const raw = localStorage.getItem('firecheck_db_empresas');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const clientesList = useMemo<{ nombre: string }[]>(() => {
    try {
      const raw = localStorage.getItem('firecheck_db_clientes');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const centrosList = useMemo<{ nombre: string }[]>(() => {
    try {
      const raw = localStorage.getItem('firecheck_db_centros');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const defaultEmpresaNombre = 'ABANFOC S.L.';

  const formatFechaCorta = (iso?: unknown) => {
    if (!iso) return new Date().toLocaleDateString('es-ES');
    if (typeof iso === 'object' && iso !== null && 'seconds' in iso && typeof (iso as { seconds: number }).seconds === 'number') {
      return new Date((iso as { seconds: number }).seconds * 1000).toLocaleDateString('es-ES');
    }
    const d = new Date(iso as string | number | Date);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('es-ES');
    return d.toLocaleDateString('es-ES');
  };

  const buildCajetinMeta = (nota: NotaBlocItem, seccionTitulo?: string): CajetinPlanoMeta => ({
    empresaMantenedora: nota.empresaMantenedora || defaultEmpresaNombre,
    clienteNombre: nota.clienteNombre || nota.lugar || '—',
    centroNombre: nota.centroNombre || nota.lugar || '—',
    autor: nota.usuarioNombre || currentUserName,
    fecha: formatFechaCorta(nota.fechaCreacion),
    seccionTitulo
  });

  const htmlToPlainText = (html: string): string => {
    if (!html) return '';
    return html
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleDescargarImagenPlano = async (
    dataUrl: string,
    nombre?: string,
    cajetin?: CajetinPlanoMeta
  ) => {
    const slug = (nombre || 'plano')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    const finalUrl = await exportarDataUrlConCajetin(
      dataUrl,
      cajetin || {
        empresaMantenedora: defaultEmpresaNombre,
        clienteNombre: nombre || '—',
        centroNombre: nombre || '—',
        autor: currentUserName,
        fecha: formatFechaCorta()
      }
    );
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `plano-${slug || 'nota'}.png`;
    link.click();
  };

  const handleDescargarNotaPDF = async (nota: NotaBlocItem) => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const margin = 15;
      const maxW = pageW - margin * 2;
      let y = 18;

      const ensureSpace = (needed: number) => {
        if (y + needed > 282) {
          doc.addPage();
          y = 18;
        }
      };

      // Cabecera
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 35, 66);
      const titleLines = doc.splitTextToSize((nota.lugar || 'NOTA').toUpperCase(), maxW);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 7 + 2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const meta = `Categoría: ${nota.categoria}  |  Prioridad: ${nota.prioridad}  |  Autor: ${nota.usuarioNombre || 'Usuario'}`;
      doc.text(meta, margin, y);
      y += 5;

      if (nota.alarmaActiva && nota.alarmaFecha) {
        const fAlarma = `${nota.alarmaFecha.slice(8, 10)}/${nota.alarmaFecha.slice(5, 7)}/${nota.alarmaFecha.slice(0, 4)} ${nota.alarmaFecha.slice(11, 16)}`;
        doc.setTextColor(180, 83, 9);
        doc.text(`Alarma programada: ${fAlarma}`, margin, y);
        y += 5;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      // Motivo (sin etiqueta "MOTIVO / QUÉ HAY QUE HACER:")
      if (nota.motivo && nota.motivo.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const motivoLines = doc.splitTextToSize(nota.motivo.trim(), maxW);
        doc.text(motivoLines, margin, y);
        y += motivoLines.length * 5 + 4;
      }

      // Detalles adicionales
      if (nota.contenido && nota.contenido.trim()) {
        ensureSpace(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLES Y NOTAS ADICIONALES:', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const detLines = doc.splitTextToSize(nota.contenido.trim(), maxW);
        detLines.forEach((line: string) => {
          ensureSpace(5);
          doc.text(line, margin, y);
          y += 5;
        });
        y += 4;
      }

      // Secciones por zonas y planos
      if (nota.secciones && nota.secciones.length > 0) {
        let prevPlanoElementos: NotaPlanoElemento[] = [];
        for (let i = 0; i < nota.secciones.length; i++) {
          const sec = nota.secciones[i];
          ensureSpace(16);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(15, 35, 66);
          const tituloZonaPdf = sec.titulo?.trim()
            ? `ZONA ${i + 1} ${sec.titulo.trim().toUpperCase()}`
            : `ZONA ${i + 1}`;
          doc.text(tituloZonaPdf, margin, y);
          y += 6;

          const plain = htmlToPlainText(sec.contenidoHtml || '');
          if (plain) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            const secLines = doc.splitTextToSize(plain, maxW);
            secLines.forEach((line: string) => {
              ensureSpace(5);
              doc.text(line, margin, y);
              y += 5;
            });
            y += 3;
          }

          if (sec.dibujoDataUrl || (sec.planoElementos && sec.planoElementos.length > 0)) {
            try {
              const metaCajetin = buildCajetinMeta(
                nota,
                sec.titulo?.trim() ? `Zona ${i + 1} ${sec.titulo.trim()}` : `Zona ${i + 1}`
              );
              const conCajetin =
                sec.planoElementos && sec.planoElementos.length > 0
                  ? renderPlanoConCajetinHiRes(sec.planoElementos, metaCajetin, prevPlanoElementos, 2)
                  : await exportarDataUrlConCajetin(sec.dibujoDataUrl || '', metaCajetin, sec.planoElementos);
              const optimized = await optimizarImagenParaPDF(conCajetin, 1800, 0.92);
              const totalW = 720 + (hasLeyendaSimbolos(sec.planoElementos) ? LEYENDA_W : 0);
              const imgW = maxW;
              const imgH = imgW * ((380 + 74) / totalW);
              ensureSpace(imgH + 6);
              doc.addImage(optimized.base64, optimized.format, margin, y, imgW, imgH);
              y += imgH + 6;
            } catch (err) {
              console.error('Error optimizando plano para PDF:', err);
            }
          }
          if (sec.planoElementos && sec.planoElementos.length > 0) {
            prevPlanoElementos = [...prevPlanoElementos, ...sec.planoElementos];
          }
          y += 2;
        }
      }

      const slug = (nota.lugar || 'nota')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');
      doc.save(`nota-${slug || 'detalle'}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDescargarReporteEquiposPDF = (datos: {
    titulo: string;
    cliente?: string;
    centro?: string;
    autor?: string;
    fecha?: string;
    secciones: NotaSeccionItem[];
  }) => {
    const reporte = buildReporteEquiposPorSecciones(datos.secciones);
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const maxW = pageW - margin * 2;
    let y = 16;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - 14) {
        doc.addPage();
        y = 16;
      }
    };

    // Cabecera
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('REPORTE DE ELEMENTOS POR ZONAS', margin, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${(datos.titulo || 'SIN TÍTULO').toUpperCase()}  ·  Total equipos: ${reporte.totalGeneral}`,
      margin,
      18
    );

    y = 31;
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    const metaParts: string[] = [];
    if (datos.cliente) metaParts.push(`Cliente: ${datos.cliente}`);
    if (datos.centro) metaParts.push(`Centro: ${datos.centro}`);
    if (datos.autor) metaParts.push(`Autor: ${datos.autor}`);
    if (datos.fecha) metaParts.push(`Fecha: ${datos.fecha}`);
    if (metaParts.length > 0) {
      const metaLines = doc.splitTextToSize(metaParts.join('  |  '), maxW);
      doc.text(metaLines, margin, y);
      y += metaLines.length * 4.5 + 3;
    }

    // Resumen global por tipo y sección
    ensureSpace(18);
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    const lineH = 6.2;
    const innerW = maxW - 8;
    type ResumenPdfRow = { prefix: string; boldPart: string; firstSuffix: string; extraLines: string[] };
    const resumenRows: ResumenPdfRow[] =
      reporte.resumenPorTipo.length > 0
        ? reporte.resumenPorTipo.map((r) => {
            const prefix = `- ${r.tipoLabel}: `;
            const boldPart = `${r.total} und.`;
            const suffix = ` (${r.porSeccion
              .map((s) => `${s.count} und. en ${s.seccionTitulo}`)
              .join(' / ')})`;
            doc.setFontSize(8.8);
            doc.setFont('helvetica', 'normal');
            const prefixW = doc.getTextWidth(prefix);
            doc.setFont('helvetica', 'bold');
            const boldW = doc.getTextWidth(boldPart);
            doc.setFont('helvetica', 'normal');
            const availFirst = Math.max(25, innerW - prefixW - boldW);
            const firstWrapped = doc.splitTextToSize(suffix, availFirst) as string[];
            const firstSuffix = firstWrapped[0] || '';
            const restText = suffix.slice(firstSuffix.length).trimStart();
            const extraLines = restText ? (doc.splitTextToSize(restText, innerW) as string[]) : [];
            return { prefix, boldPart, firstSuffix, extraLines };
          })
        : [{ prefix: 'Sin equipos registrados en los planos.', boldPart: '', firstSuffix: '', extraLines: [] }];

    const totalPdfLines = resumenRows.reduce((sum, row) => sum + 1 + row.extraLines.length, 0);
    const boxH = 12 + totalPdfLines * lineH;
    doc.roundedRect(margin, y, maxW, boxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(120, 53, 15);
    doc.text(`RECUENTO TOTAL GLOBAL (${reporte.totalGeneral} und.)`, margin + 4, y + 6.5);
    doc.setFontSize(8.8);
    let curY = y + 12.5;
    resumenRows.forEach((row) => {
      let curX = margin + 4;
      doc.setFont('helvetica', 'normal');
      doc.text(row.prefix, curX, curY);
      curX += doc.getTextWidth(row.prefix);
      if (row.boldPart) {
        doc.setFont('helvetica', 'bold');
        doc.text(row.boldPart, curX, curY);
        curX += doc.getTextWidth(row.boldPart);
      }
      if (row.firstSuffix) {
        doc.setFont('helvetica', 'normal');
        doc.text(row.firstSuffix, curX, curY);
      }
      curY += lineH;
      row.extraLines.forEach((ex) => {
        doc.setFont('helvetica', 'normal');
        doc.text(ex, margin + 4, curY);
        curY += lineH;
      });
    });
    y += boxH + 7;

    // Desglose por sección
    reporte.secciones.forEach((sec, idx) => {
      ensureSpace(18);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, maxW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const secLabel =
        sec.titulo.toLowerCase() === `zona ${idx + 1}`
          ? sec.titulo.toUpperCase()
          : `ZONA ${idx + 1} ${sec.titulo.toUpperCase()}`;
      doc.text(`${secLabel}  (${sec.total} und.)`, margin + 3, y + 5.5);
      y += 10;

      const secCounts = Object.entries(sec.conteoPorTipo)
        .map(([k, v]) => `${k}: ${v} und.`)
        .join(' / ');
      if (secCounts) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(185, 28, 28);
        const cLines = doc.splitTextToSize(secCounts, maxW);
        doc.text(cLines, margin, y);
        y += cLines.length * 4.2 + 2;
      }

      if (sec.equipos.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Sin equipos en esta zona.', margin + 2, y);
        y += 6;
      } else {
        sec.equipos.forEach((eq) => {
          const detalles: string[] = [];
          if (eq.modelo) detalles.push(`Tipo: ${eq.modelo}`);
          if (eq.ff) detalles.push(`FF: ${eq.ff}`);
          if (eq.ut) detalles.push(`UT: ${eq.ut}`);
          if (eq.ph) detalles.push(`PH: ${eq.ph}`);
          if (eq.estadoSenal) detalles.push(`Señal: ${eq.estadoSenal}`);
          const lineStr = `• ${eq.codigo}${detalles.length > 0 ? '  —  ' + detalles.join('  |  ') : ''}`;
          const wrapped = doc.splitTextToSize(lineStr, maxW - 4);
          ensureSpace(wrapped.length * 4.5 + 2);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
          doc.setTextColor(30, 41, 59);
          doc.text(wrapped, margin + 2, y);
          y += wrapped.length * 4.5 + 1.5;
        });
        y += 3;
      }
    });

    const slug = (datos.titulo || 'reporte')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    doc.save(`reporte-equipos-${slug || 'zonas'}.pdf`);
  };

  const handleImprimirNota = (nota: NotaBlocItem) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Por favor, permite las ventanas emergentes para imprimir la nota.');
      return;
    }

    const esc = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const seccionesHtml = (nota.secciones || [])
      .map(
        (sec, i) => `
      <div class="section-box">
        <h3>Zona ${i + 1}${sec.titulo?.trim() ? ` ${esc(sec.titulo.trim())}` : ''}</h3>
        ${sec.contenidoHtml ? `<div class="section-text">${sec.contenidoHtml}</div>` : ''}
        ${
          sec.dibujoDataUrl
            ? `<div class="section-img">
                <img src="${sec.dibujoDataUrl}" alt="Plano ${esc(sec.titulo || '')}" />
                <table class="cajetin">
                  <tr>
                    <td rowspan="2" style="width:30%">
                      <div class="c-lbl">EMPRESA MANTENEDORA</div>
                      <div class="c-val-lg">${esc(nota.empresaMantenedora || defaultEmpresaNombre)}</div>
                      <div class="c-sub">PLANO DE INSTALACIÓN / REVISIÓN</div>
                    </td>
                    <td style="width:44%">
                      <div class="c-lbl">CLIENTE</div>
                      <div class="c-val">${esc(nota.clienteNombre || nota.lugar || '—')}</div>
                    </td>
                    <td style="width:26%">
                      <div class="c-lbl">REALIZADO POR</div>
                      <div class="c-val">${esc(nota.usuarioNombre || currentUserName)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div class="c-lbl">CENTRO / ZONA</div>
                      <div class="c-val">${esc(nota.centroNombre || nota.lugar || '—')}${sec.titulo ? ` · ${esc(sec.titulo)}` : ''}</div>
                    </td>
                    <td>
                      <div class="c-lbl">FECHA</div>
                      <div class="c-val">${esc(formatFechaCorta(nota.fechaCreacion))}</div>
                    </td>
                  </tr>
                </table>
              </div>`
            : ''
        }
      </div>
    `
      )
      .join('');

    win.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Nota - ${esc(nota.lugar)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; }
          .header { border-bottom: 2px solid #0f2342; padding-bottom: 10px; margin-bottom: 16px; }
          .header h1 { margin: 0 0 6px; font-size: 20px; text-transform: uppercase; color: #0f2342; }
          .meta { font-size: 12px; color: #475569; }
          .block { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
          .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .section-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 14px; page-break-inside: avoid; }
          .section-box h3 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; color: #0f2342; }
          .section-text { font-size: 13px; line-height: 1.5; }
          .section-img img { max-width: 100%; border: 1px solid #cbd5e1; border-bottom: none; border-radius: 6px 6px 0 0; margin-top: 8px; display: block; }
          .cajetin { width: 100%; border-collapse: collapse; background: #f8fafc; margin-bottom: 4px; }
          .cajetin td { border: 1.5px solid #0f172a; padding: 5px 8px; vertical-align: top; }
          .c-lbl { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
          .c-val { font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .c-val-lg { font-size: 12px; font-weight: 800; color: #0f2342; margin-top: 3px; text-transform: uppercase; }
          .c-sub { font-size: 8px; color: #475569; margin-top: 3px; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${esc(nota.lugar)}</h1>
          <div class="meta">
            Categoría: <strong>${esc(nota.categoria)}</strong> · Prioridad: <strong>${esc(nota.prioridad)}</strong> · Registrado por: <strong>${esc(nota.usuarioNombre || 'Usuario')}</strong>
          </div>
        </div>
        <div class="block">
          <div class="label">Motivo / Qué hay que hacer</div>
          <div style="font-size:13px;font-weight:bold;white-space:pre-wrap;">${esc(nota.motivo)}</div>
        </div>
        ${
          nota.contenido
            ? `<div class="block"><div class="label">Detalles y notas adicionales</div><div style="font-size:12px;white-space:pre-wrap;">${esc(nota.contenido)}</div></div>`
            : ''
        }
        ${seccionesHtml}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 350);
  };

  // Obtener nombre del usuario actual
  const currentUserName = useMemo(() => {
    if (user?.nombre) {
      return `${user.nombre} ${user.apellidos || ''}`.trim();
    }
    if (user?.usuario) return user.usuario;
    try {
      const saved = localStorage.getItem('firecheck_logged_user') || sessionStorage.getItem('firecheck_logged_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.nombre) return `${u.nombre} ${u.apellidos || ''}`.trim();
        if (u?.usuario) return u.usuario;
      }
    } catch { /* ignore */ }
    return 'Usuario';
  }, [user]);

  // Suscripción a Firestore en tiempo real
  useEffect(() => {
    const unsub = subscribeNotasBloc((items) => {
      setNotas(items);
    });
    return () => unsub();
  }, []);

  // Conteo de notas por categoría
  const countPorCategoria = useMemo(() => {
    const counts: Record<CategoriaNota, number> = {
      Compras: 0,
      Visitas: 0,
      Presupuestos: 0,
      Varias: 0,
      Completadas: 0
    };
    notas.forEach(n => {
      const isComp = n.completada === true || n.categoria === 'Completadas';
      if (isComp) {
        counts['Completadas']++;
      } else if (counts[n.categoria as CategoriaNota] !== undefined) {
        counts[n.categoria as CategoriaNota]++;
      } else {
        counts['Varias']++;
      }
    });
    return counts;
  }, [notas]);

  // Estado para animar el check en verde durante 1 segundo antes de guardar y mover a Completadas
  const [completingIds, setCompletingIds] = useState<Record<string, boolean>>({});

  // Manejar marcar / desmarcar como completada
  const handleToggleCompletada = async (nota: NotaBlocItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const docId = nota._docId || nota.id;
    if (!docId) return;

    // Si ya está completada o en la categoría Completadas, reabrirla devolviéndola a su categoría previa
    if (nota.completada || nota.categoria === 'Completadas') {
      const catDestino = (nota.categoriaAnterior as CategoriaNota) || 'Varias';
      try {
        await updateNotaBloc(docId, {
          completada: false,
          completadaPor: '',
          fechaCompletada: '',
          categoria: catDestino
        });
      } catch (err) {
        console.error('Error reabriendo nota:', err);
      }
      return;
    }

    // Si no está completada:
    // 1. Activar inmediatamente el estado visual (icono en verde pulsante)
    setCompletingIds(prev => ({ ...prev, [docId]: true }));

    // 2. Esperar 1 segundo exacto (1000ms) y guardar en la categoría 'Completadas'
    setTimeout(async () => {
      try {
        await updateNotaBloc(docId, {
          completada: true,
          completadaPor: currentUserName,
          fechaCompletada: new Date().toISOString(),
          categoriaAnterior: (nota.categoria as string) || 'Varias',
          categoria: 'Completadas'
        });
      } catch (err) {
        console.error('Error guardando nota completada:', err);
      } finally {
        setCompletingIds(prev => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
      }
    }, 1000);
  };

  // Notas filtradas para la categoría y búsqueda actual
  const notasFiltradas = useMemo(() => {
    return notas
      .filter(n => {
        const isComp = n.completada === true || n.categoria === 'Completadas';

        // Filtrar por categoría activa
        if (categoriaActiva === 'Completadas') {
          if (!isComp) return false;
        } else {
          if (isComp) return false;
          const cat = (n.categoria || 'Varias').toLowerCase();
          if (cat !== categoriaActiva.toLowerCase()) return false;
        }

        // Filtrar por prioridad
        if (filtroPrioridad !== 'Todas' && n.prioridad !== filtroPrioridad) return false;

        // Filtrar por búsqueda
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchLugar = (n.lugar || '').toLowerCase().includes(q);
          const matchMotivo = (n.motivo || '').toLowerCase().includes(q);
          const matchUsuario = (n.usuarioNombre || '').toLowerCase().includes(q);
          const matchCompletadaPor = (n.completadaPor || '').toLowerCase().includes(q);
          const matchContenido = (n.contenido || '').toLowerCase().includes(q);
          if (!matchLugar && !matchMotivo && !matchUsuario && !matchCompletadaPor && !matchContenido) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // En Completadas, ordenar por fecha de finalización descendente
        if (categoriaActiva === 'Completadas') {
          return new Date(b.fechaCompletada || b.fechaActualizacion || b.fechaCreacion || 0).getTime() -
                 new Date(a.fechaCompletada || a.fechaActualizacion || a.fechaCreacion || 0).getTime();
        }
        // Ordenar por prioridad (Urgente > Alta > Media > Baja) y fecha descendente
        const pOrder: Record<string, number> = { Urgente: 4, Alta: 3, Media: 2, Baja: 1 };
        const pDiff = (pOrder[b.prioridad] || 0) - (pOrder[a.prioridad] || 0);
        if (pDiff !== 0) return pDiff;
        return new Date(b.fechaCreacion || 0).getTime() - new Date(a.fechaCreacion || 0).getTime();
      });
  }, [notas, categoriaActiva, filtroPrioridad, searchQuery]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setNotaEditando(null);
    setFormLugar('');
    setFormMotivo('');
    setFormContenido('');
    setFormCategoria(categoriaActiva === 'Completadas' ? 'Varias' : categoriaActiva);
    setFormPrioridad('Media');
    setFormAlarmaActiva(false);
    setFormAlarmaDate(new Date().toISOString().slice(0, 10));
    setFormAlarmaTime('09:00');
    setFormSecciones([]);
    setFormEmpresaMantenedora(defaultEmpresaNombre);
    setFormClienteNombre('');
    setFormCentroNombre('');
    setModalFormOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (nota: NotaBlocItem) => {
    setNotaEditando(nota);
    setFormLugar(nota.lugar || '');
    setFormMotivo(nota.motivo || '');
    setFormContenido(nota.contenido || '');
    setFormCategoria((nota.categoria as CategoriaNota) || 'Varias');
    setFormPrioridad((nota.prioridad as PrioridadNota) || 'Media');
    setFormAlarmaActiva(Boolean(nota.alarmaActiva && nota.alarmaFecha));
    if (nota.alarmaFecha && nota.alarmaFecha.includes('T')) {
      const [d, t] = nota.alarmaFecha.split('T');
      setFormAlarmaDate(d || new Date().toISOString().slice(0, 10));
      setFormAlarmaTime((t || '09:00').slice(0, 5));
    } else {
      setFormAlarmaDate(new Date().toISOString().slice(0, 10));
      setFormAlarmaTime('09:00');
    }
    setFormSecciones(Array.isArray(nota.secciones) ? nota.secciones : []);
    setFormEmpresaMantenedora(nota.empresaMantenedora || defaultEmpresaNombre);
    setFormClienteNombre(nota.clienteNombre || '');
    setFormCentroNombre(nota.centroNombre || '');
    if (modalVerNota) setModalVerNota(null);
    setModalFormOpen(true);
  };

  // Guardar nota (Crear o Actualizar, opcionalmente permaneciendo en el editor sin salir)
  const ejecutarGuardadoNota = async (permanecerEnEditor: boolean) => {
    if (!formLugar.trim()) {
      alert('Por favor, introduce el lugar de la nota.');
      return;
    }
    if (!formMotivo.trim()) {
      alert('Por favor, introduce el motivo o lo que hay que hacer.');
      return;
    }
    if (formAlarmaActiva && (!formAlarmaDate || !formAlarmaTime)) {
      alert('Por favor, selecciona fecha y hora para la alarma.');
      return;
    }

    const alarmaFechaFinal = formAlarmaActiva ? `${formAlarmaDate}T${formAlarmaTime}` : '';
    const seccionesLimpias =
      formCategoria === 'Presupuestos' || formCategoria === 'Completadas'
        ? formSecciones.filter(
            (s) => s.titulo.trim() || s.contenidoHtml.replace(/<[^>]+>/g, '').trim() || s.dibujoDataUrl
          )
        : [];

    setIsSaving(true);
    try {
      if (notaEditando && (notaEditando._docId || notaEditando.id)) {
        const docId = notaEditando._docId || notaEditando.id!;
        const fechaCambiada = alarmaFechaFinal !== (notaEditando.alarmaFecha || '');
        const payload = {
          lugar: formLugar.trim().toUpperCase(),
          motivo: formMotivo.trim(),
          contenido: formContenido.trim(),
          categoria: formCategoria,
          prioridad: formPrioridad,
          usuarioNombre: notaEditando.usuarioNombre || currentUserName,
          completada: formCategoria === 'Completadas' ? true : (notaEditando.completada ?? false),
          completadaPor: formCategoria === 'Completadas' ? (notaEditando.completadaPor || currentUserName) : ((notaEditando.categoria as string) === 'Completadas' ? '' : notaEditando.completadaPor),
          fechaCompletada: formCategoria === 'Completadas' ? (notaEditando.fechaCompletada || new Date().toISOString()) : ((notaEditando.categoria as string) === 'Completadas' ? '' : notaEditando.fechaCompletada),
          categoriaAnterior: notaEditando.categoriaAnterior || ((notaEditando.categoria as string) !== 'Completadas' ? notaEditando.categoria : 'Varias'),
          alarmaActiva: formAlarmaActiva,
          alarmaFecha: alarmaFechaFinal,
          alarmaNotificada: !formAlarmaActiva || fechaCambiada ? false : Boolean(notaEditando.alarmaNotificada),
          secciones: seccionesLimpias,
          empresaMantenedora: formEmpresaMantenedora.trim() || defaultEmpresaNombre,
          clienteNombre: formClienteNombre.trim(),
          centroNombre: formCentroNombre.trim()
        };
        await updateNotaBloc(docId, payload);
        if (permanecerEnEditor) {
          setNotaEditando({ ...notaEditando, ...payload });
        }
      } else {
        const creada = await addNotaBloc({
          lugar: formLugar.trim().toUpperCase(),
          motivo: formMotivo.trim(),
          contenido: formContenido.trim(),
          categoria: formCategoria,
          prioridad: formPrioridad,
          usuarioNombre: currentUserName,
          fechaCreacion: new Date().toISOString(),
          completada: formCategoria === 'Completadas',
          completadaPor: formCategoria === 'Completadas' ? currentUserName : undefined,
          fechaCompletada: formCategoria === 'Completadas' ? new Date().toISOString() : undefined,
          alarmaActiva: formAlarmaActiva,
          alarmaFecha: alarmaFechaFinal,
          alarmaNotificada: false,
          secciones: seccionesLimpias,
          empresaMantenedora: formEmpresaMantenedora.trim() || defaultEmpresaNombre,
          clienteNombre: formClienteNombre.trim(),
          centroNombre: formCentroNombre.trim()
        });
        if (permanecerEnEditor && creada) {
          setNotaEditando(creada as NotaBlocItem);
        }
      }

      if (permanecerEnEditor) {
        setSavedInlineNotice(true);
        setTimeout(() => setSavedInlineNotice(false), 2500);
      } else {
        setModalFormOpen(false);
        setNotaEditando(null);
      }
    } catch (err) {
      console.error('Error guardando nota:', err);
      alert('Hubo un error al guardar la nota. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNota = async (e: React.FormEvent) => {
    e.preventDefault();
    await ejecutarGuardadoNota(false);
  };

  // Eliminar nota
  const handleConfirmDelete = async () => {
    if (!notaAEliminar) return;
    const docId = notaAEliminar._docId || notaAEliminar.id;
    if (!docId) return;

    try {
      await deleteNotaBloc(docId);
      setNotaAEliminar(null);
      if (modalVerNota && (modalVerNota._docId === docId || modalVerNota.id === docId)) {
        setModalVerNota(null);
      }
    } catch (err) {
      console.error('Error eliminando nota:', err);
      alert('Hubo un error al eliminar la nota.');
    }
  };

  // Formatear fecha amigable
  const formatFecha = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${horas}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* CABECERA SUPERIOR */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
            <StickyNote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Bloc de Notas</h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200/70">
                {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Anotaciones y recordatorios compartidos del equipo por categorías.
            </p>
          </div>
        </div>

        {/* ACCIÓN PRINCIPAL */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Nota
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS (CATEGORÍAS) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {CATEGORIAS.map(cat => {
            const isActive = categoriaActiva === cat;
            const count = countPorCategoria[cat] || 0;
            const config = CATEGORIAS_CONFIG[cat];
            const isCompletadas = cat === 'Completadas';

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaActiva(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer select-none shrink-0 ${
                  isActive
                    ? config.bgActive
                    : isCompletadas
                    ? 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {isCompletadas && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                <span>{cat}</span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : config.badge
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO DE PRIORIDAD */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* BUSCADOR */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por lugar, motivo, autor..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* FILTRO PRIORIDAD */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Prioridad:</span>
          {(['Todas', ...PRIORIDADES] as const).map(prio => {
            const isSelected = filtroPrioridad === prio;
            return (
              <button
                key={prio}
                type="button"
                onClick={() => setFiltroPrioridad(prio)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {prio}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTADO DE TARJETAS DE NOTAS */}
      {notasFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
            <StickyNote className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {categoriaActiva === 'Completadas'
              ? 'No hay notas completadas todavía'
              : `No hay notas en la categoría "${categoriaActiva}"`}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery
              ? 'No se encontraron notas que coincidan con la búsqueda introducida.'
              : categoriaActiva === 'Completadas'
              ? 'Cuando marques una nota como completada con el icono del check, se moverá automáticamente aquí indicando quién la finalizó.'
              : 'Añade la primera nota para compras, visitas, presupuestos o asuntos varios.'}
          </p>
          {categoriaActiva !== 'Completadas' && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear nota en {categoriaActiva}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notasFiltradas.map((nota) => {
            const prioConfig = PRIORIDAD_CONFIG[nota.prioridad as PrioridadNota] || PRIORIDAD_CONFIG['Media'];
            const catConfig = CATEGORIAS_CONFIG[nota.categoria as CategoriaNota] || CATEGORIAS_CONFIG['Varias'];
            const docId = nota._docId || nota.id || '';
            const isBeingCompleted = !!completingIds[docId];
            const isCompleted = nota.completada || nota.categoria === 'Completadas';
            const isCheckGreen = isCompleted || isBeingCompleted;

            return (
              <div
                key={docId}
                className={`bg-white rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden ${
                  isBeingCompleted
                    ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/20'
                    : isCompleted
                    ? 'border-emerald-200/90 hover:border-emerald-300'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Indicador de categoría (Línea superior delgada) */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-${catConfig.color}-500`} />

                <div>
                  {/* FILA SUPERIOR: BADGE DE PRIORIDAD + ACCIONES */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${prioConfig.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prioConfig.dot}`} />
                      {prioConfig.label}
                    </span>

                    {/* ACCIONES: CHECK COMPLETAR (APAGADO / VERDE), OJO, LÁPIZ, PAPELERA */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* BOTÓN CHECK: Apagado por defecto, Verde al finalizar / completada */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleCompletada(nota, e)}
                        disabled={isBeingCompleted}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isCheckGreen
                            ? 'text-emerald-600 bg-emerald-50 border border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent'
                        } ${isBeingCompleted ? 'scale-110 animate-pulse' : 'hover:scale-105'}`}
                        title={
                          isCompleted
                            ? `Completada por ${nota.completadaPor || 'Usuario'} (Clic para reabrir)`
                            : isBeingCompleted
                            ? 'Finalizando... Guardando en Completadas'
                            : 'Marcar como completada'
                        }
                      >
                        <CheckCircle2 className={`w-4 h-4 transition-transform ${isCheckGreen ? 'stroke-[2.5]' : 'stroke-2'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalVerNota(nota)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Ver nota completa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(nota)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar nota"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotaAEliminar(nota)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 1. LUGAR / TÍTULO (EN MAYÚSCULA Y NEGRITA) */}
                  <h3
                    onClick={() => setModalVerNota(nota)}
                    className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {nota.lugar}
                  </h3>

                  {/* 2. MOTIVO / QUÉ HAY QUE HACER (TONO MÁS SUAVE) */}
                  <p
                    onClick={() => setModalVerNota(nota)}
                    className="text-xs text-slate-600 font-normal leading-relaxed line-clamp-3 mt-1.5 cursor-pointer"
                  >
                    {nota.motivo}
                  </p>

                  {nota.alarmaActiva && nota.alarmaFecha && (
                    <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                      nota.alarmaNotificada
                        ? 'bg-slate-50 text-slate-500 border-slate-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      <Bell className={`w-3.5 h-3.5 ${nota.alarmaNotificada ? 'text-slate-400' : 'text-amber-600'}`} />
                      <span>
                        Alarma: {nota.alarmaFecha.slice(8, 10)}/{nota.alarmaFecha.slice(5, 7)}/{nota.alarmaFecha.slice(0, 4)} · {nota.alarmaFecha.slice(11, 16)}
                      </span>
                    </div>
                  )}

                  {nota.secciones && nota.secciones.length > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-blue-50 text-blue-800 border-blue-200 text-[11px] font-bold ml-1">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {nota.secciones.length} {nota.secciones.length === 1 ? 'zona' : 'zonas'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  {/* 3. NOMBRE DEL USUARIO QUE REGISTRÓ LA NOTA + FECHA */}
                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 min-w-0" title={`Registrado por: ${nota.usuarioNombre}`}>
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700 truncate">
                        {nota.usuarioNombre}
                      </span>
                    </div>
                    {nota.fechaCreacion && (
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {nota.fechaCreacion.slice(8, 10)}/{nota.fechaCreacion.slice(5, 7)}
                      </span>
                    )}
                  </div>

                  {/* 4. PIE DE COMPLETADA (SI APLICA O EN ANIMACIÓN DE 1 SEGUNDO) */}
                  {isBeingCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-200 flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Finalizada. Guardando en Completadas...</span>
                    </div>
                  )}

                  {!isBeingCompleted && isCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-700 font-semibold bg-emerald-50/70 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                      <span className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Completada por: <strong className="font-black text-emerald-900">{nota.completadaPor || 'Usuario'}</strong></span>
                      </span>
                      {nota.fechaCompletada && (
                        <span className="text-[10px] text-emerald-600 font-normal shrink-0 ml-1">
                          {nota.fechaCompletada.slice(8, 10)}/{nota.fechaCompletada.slice(5, 7)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: CREAR / EDITAR NOTA */}
      {modalFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 max-h-[92vh] flex flex-col">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <StickyNote className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {notaEditando ? 'Editar Nota' : 'Nueva Nota'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveNota} className="p-6 space-y-4 overflow-y-auto">
              {/* ALARMA / RECORDATORIO (DESTACADO ARRIBA) */}
              <div className={`rounded-2xl p-3.5 border-2 transition-all ${
                formAlarmaActiva
                  ? 'bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 border-amber-500 shadow-md shadow-amber-500/15'
                  : 'bg-gradient-to-r from-amber-50/90 to-orange-50/60 border-amber-300 shadow-xs'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      formAlarmaActiva
                        ? 'bg-amber-600 text-white shadow-sm animate-pulse'
                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                    }`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-black uppercase tracking-wide text-amber-950">
                        Recordatorio con Alarma
                      </span>
                      <span className="block text-[11px] font-medium text-amber-800/80">
                        {formAlarmaActiva
                          ? 'Aviso programado: recibirás una notificación en la fecha y hora indicadas'
                          : 'Programa una fecha y hora para que no se te pase esta nota'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !formAlarmaActiva;
                      setFormAlarmaActiva(next);
                      if (next) {
                        if (!formAlarmaDate) setFormAlarmaDate(new Date().toISOString().slice(0, 10));
                        if (!formAlarmaTime) setFormAlarmaTime('09:00');
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                      formAlarmaActiva
                        ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-sm'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {formAlarmaActiva ? 'Alarma activada' : 'Activar alarma'}
                  </button>
                </div>

                {formAlarmaActiva && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-300/80">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-700" />
                        Fecha de aviso
                      </label>
                      <input
                        type="date"
                        value={formAlarmaDate}
                        onChange={(e) => setFormAlarmaDate(e.target.value)}
                        required={formAlarmaActiva}
                        className="w-full px-3 py-2 bg-white border border-amber-400 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        Hora de aviso
                      </label>
                      <input
                        type="time"
                        value={formAlarmaTime}
                        onChange={(e) => setFormAlarmaTime(e.target.value)}
                        required={formAlarmaActiva}
                        className="w-full px-3 py-2 bg-white border border-amber-400 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Categoría y Prioridad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría / Pestaña <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as CategoriaNota)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prioridad
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {PRIORIDADES.map(prio => {
                      const isSel = formPrioridad === prio;
                      const conf = PRIORIDAD_CONFIG[prio];
                      return (
                        <button
                          key={prio}
                          type="button"
                          onClick={() => setFormPrioridad(prio)}
                          className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all text-center ${
                            isSel
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 1. LUGAR (TÍTULO PRINCIPAL) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lugar / Título <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formLugar}
                    onChange={(e) => setFormLugar(e.target.value)}
                    placeholder="Ej. NAVE LOGÍSTICA MERCABARNA..."
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-900 placeholder:normal-case placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Se mostrará en mayúscula y negrita en la tarjeta.
                </span>
              </div>

              {/* DATOS PARA CAJETÍN DE PLANOS (SOLO EN PRESUPUESTOS) */}
              {formCategoria === 'Presupuestos' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Empresa Mantenedora
                    </label>
                    <input
                      type="text"
                      list="notas-empresas-list"
                      value={formEmpresaMantenedora}
                      onChange={(e) => setFormEmpresaMantenedora(e.target.value)}
                      placeholder={defaultEmpresaNombre}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="notas-empresas-list">
                      {empresasList.map((emp, idx) => (
                        <option key={idx} value={emp.nombre} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Nombre del cliente (se mostrará en el cajetín)
                    </label>
                    <input
                      type="text"
                      list="notas-clientes-list"
                      value={formClienteNombre}
                      onChange={(e) => setFormClienteNombre(e.target.value)}
                      placeholder={formLugar || 'Nombre cliente...'}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="notas-clientes-list">
                      {clientesList.map((cli, idx) => (
                        <option key={idx} value={cli.nombre} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Centro del cliente (se mostrará en el cajetín)
                    </label>
                    <input
                      type="text"
                      list="notas-centros-list"
                      value={formCentroNombre}
                      onChange={(e) => setFormCentroNombre(e.target.value)}
                      placeholder={formLugar || 'Nombre centro...'}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="notas-centros-list">
                      {centrosList.map((cen, idx) => (
                        <option key={idx} value={cen.nombre} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              {/* 2. MOTIVO / QUÉ HAY QUE HACER */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo o Qué hay que hacer <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Ej. Revisar válvulas de mariposa y tomar medidas de manguera 45mm..."
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Resumen principal visible desde fuera de la tarjeta.
                </span>
              </div>

              {/* DETALLE COMPLETO SIN LÍMITE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detalles y notas adicionales <span className="text-slate-400 font-normal">(sin límite)</span>
                </label>
                <textarea
                  rows={5}
                  value={formContenido}
                  onChange={(e) => setFormContenido(e.target.value)}
                  placeholder="Escribe aquí todas las especificaciones, listados de material, contactos, observaciones o notas extensas..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[100px]"
                />
              </div>

              {/* SECCIONES POR ZONAS Y PLANOS (SOLO EN PRESUPUESTOS) */}
              {formCategoria === 'Presupuestos' && (
                <NotaSeccionesEditor
                  secciones={formSecciones}
                  onChange={setFormSecciones}
                  onGuardarNota={() => void ejecutarGuardadoNota(true)}
                  isSavingNota={isSaving}
                  savedNotice={savedInlineNotice}
                  onDescargarNotaPdf={() =>
                    void handleDescargarNotaPDF({
                      id: notaEditando?.id || 'borrador',
                      lugar: formLugar.trim() || 'Nota',
                      motivo: formMotivo.trim(),
                      contenido: formContenido.trim(),
                      categoria: formCategoria,
                      prioridad: formPrioridad,
                      completada: Boolean(notaEditando?.completada),
                      usuarioNombre: notaEditando?.usuarioNombre || currentUserName,
                      fechaCreacion: notaEditando?.fechaCreacion || new Date().toISOString(),
                      alarmaActiva: formAlarmaActiva,
                      alarmaFecha: formAlarmaActiva ? `${formAlarmaDate}T${formAlarmaTime}` : '',
                      secciones: formSecciones,
                      empresaMantenedora: formEmpresaMantenedora.trim() || defaultEmpresaNombre,
                      clienteNombre: formClienteNombre.trim(),
                      centroNombre: formCentroNombre.trim()
                    })
                  }
                  isExportingPdf={isExportingPdf}
                  onVerReporte={() =>
                    setReporteModalData({
                      titulo: formLugar.trim() || 'Nota sin título',
                      cliente: formClienteNombre.trim() || undefined,
                      centro: formCentroNombre.trim() || undefined,
                      autor: notaEditando?.usuarioNombre || currentUserName,
                      fecha: formatFechaCorta(notaEditando?.fechaCreacion),
                      secciones: formSecciones
                    })
                  }
                  cajetinMeta={{
                    empresaMantenedora: formEmpresaMantenedora.trim() || defaultEmpresaNombre,
                    clienteNombre: formClienteNombre.trim() || formLugar.trim() || '—',
                    centroNombre: formCentroNombre.trim() || formLugar.trim() || '—',
                    autor: notaEditando?.usuarioNombre || currentUserName,
                    fecha: formatFechaCorta(notaEditando?.fechaCreacion)
                  }}
                />
              )}

              {/* USUARIO AUTOR (INFORMATIVO) */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Usuario que registra la nota:</span>
                  </div>
                  <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    {notaEditando?.usuarioNombre || currentUserName}
                  </span>
                </div>
                {notaEditando?.completadaPor && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-emerald-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completada por:</span>
                    </div>
                    <span className="font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                      {notaEditando.completadaPor}
                    </span>
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() =>
                    void handleDescargarNotaPDF({
                      id: notaEditando?.id || 'borrador',
                      lugar: formLugar.trim() || 'Nota',
                      motivo: formMotivo.trim(),
                      contenido: formContenido.trim(),
                      categoria: formCategoria,
                      prioridad: formPrioridad,
                      completada: Boolean(notaEditando?.completada),
                      usuarioNombre: notaEditando?.usuarioNombre || currentUserName,
                      fechaCreacion: notaEditando?.fechaCreacion || new Date().toISOString(),
                      alarmaActiva: formAlarmaActiva,
                      alarmaFecha: formAlarmaActiva ? `${formAlarmaDate}T${formAlarmaTime}` : '',
                      secciones: formCategoria === 'Presupuestos' ? formSecciones : [],
                      empresaMantenedora: formEmpresaMantenedora.trim() || defaultEmpresaNombre,
                      clienteNombre: formClienteNombre.trim(),
                      centroNombre: formCentroNombre.trim()
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalFormOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? 'Guardando...' : notaEditando ? 'Guardar Cambios' : 'Registrar Nota'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VER NOTA COMPLETA (OJO) */}
      {modalVerNota && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 max-h-[92vh] flex flex-col">
            {/* Cabecera del modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${CATEGORIAS_CONFIG[modalVerNota.categoria as CategoriaNota]?.badge || 'bg-slate-800 text-white'}`}>
                  {modalVerNota.categoria}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${PRIORIDAD_CONFIG[modalVerNota.prioridad as PrioridadNota]?.badge || 'bg-slate-700'}`}>
                  {modalVerNota.prioridad}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalVerNota(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Completo */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* BANNER NOTA FINALIZADA / COMPLETADA */}
              {(modalVerNota.completada || modalVerNota.categoria === 'Completadas' || modalVerNota.completadaPor) && (
                <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                          Nota Finalizada
                        </span>
                        {modalVerNota.fechaCompletada && (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatFecha(modalVerNota.fechaCompletada)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        Completada por: <span className="text-emerald-700 font-black">{modalVerNota.completadaPor || 'Usuario'}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleToggleCompletada(modalVerNota, { stopPropagation: () => {} } as any);
                      setModalVerNota(null);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 transition-colors shadow-2xs cursor-pointer shrink-0"
                    title="Devolver a su categoría activa"
                  >
                    Reabrir nota
                  </button>
                </div>
              )}

              {/* LUGAR (MAYÚSCULA Y NEGRITA) */}
              {modalVerNota.alarmaActiva && modalVerNota.alarmaFecha && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Alarma programada: {modalVerNota.alarmaFecha.slice(8, 10)}/{modalVerNota.alarmaFecha.slice(5, 7)}/{modalVerNota.alarmaFecha.slice(0, 4)} a las {modalVerNota.alarmaFecha.slice(11, 16)}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Lugar
                </span>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {modalVerNota.lugar}
                </h2>
              </div>

              {/* MOTIVO */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Motivo o Qué hay que hacer
                </span>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {modalVerNota.motivo}
                </p>
              </div>

              {/* DETALLES EXTENSOS (SI EXISTEN) */}
              {modalVerNota.contenido && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Detalles y notas adicionales
                  </span>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {modalVerNota.contenido}
                  </div>
                </div>
              )}

              {/* SECCIONES Y PLANOS (SI EXISTEN) */}
              {modalVerNota.secciones && modalVerNota.secciones.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Zonas y planos ({modalVerNota.secciones.length})
                  </span>
                  {modalVerNota.secciones.map((sec, idx) => (
                    <div key={sec.id || idx} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Zona {idx + 1}{sec.titulo?.trim() ? ` ${sec.titulo.trim()}` : ''}
                      </h4>
                      {sec.contenidoHtml && (
                        <div
                          className="text-xs text-slate-700 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                          dangerouslySetInnerHTML={{ __html: sec.contenidoHtml }}
                        />
                      )}
                      {sec.dibujoDataUrl && (
                        <div className="pt-1 space-y-1.5">
                          <img
                            src={sec.dibujoDataUrl}
                            alt={`Plano ${sec.titulo || `Zona ${idx + 1}`}`}
                            onClick={() =>
                              setPlanoAmpliado({
                                url: sec.dibujoDataUrl!,
                                title: sec.titulo || `Zona ${idx + 1}`,
                                nota: modalVerNota
                              })
                            }
                            className="w-full max-h-64 object-contain rounded-xl border border-slate-200 bg-white cursor-zoom-in hover:border-blue-400 transition-colors"
                            title="Clic para ampliar el plano"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                handleDescargarImagenPlano(
                                  sec.dibujoDataUrl!,
                                  `${modalVerNota.lugar}-${sec.titulo || `zona-${idx + 1}`}`,
                                  buildCajetinMeta(
                                    modalVerNota,
                                    sec.titulo?.trim()
                                      ? `Zona ${idx + 1} ${sec.titulo.trim()}`
                                      : `Zona ${idx + 1}`
                                  )
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Descargar imagen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* DESTACADO: REPORTE DE SISTEMAS Y EQUIPOS */}
              {modalVerNota.secciones && modalVerNota.secciones.length > 0 && (() => {
                const resumen = buildReporteEquiposPorSecciones(modalVerNota.secciones);
                return (
                  <div className="bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-xs font-black uppercase tracking-wide text-amber-950">
                            Reporte de Sistemas y Equipos
                          </span>
                          <span className="block text-[11px] font-medium text-amber-800/90">
                            {resumen.totalGeneral > 0
                              ? `${resumen.totalGeneral} equipos contabilizados en ${resumen.secciones.length} ${resumen.secciones.length === 1 ? 'zona' : 'zonas'}`
                              : 'Sin equipos registrados en los planos'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setReporteModalData({
                            titulo: modalVerNota.lugar || 'Nota',
                            cliente: modalVerNota.clienteNombre || undefined,
                            centro: modalVerNota.centroNombre || undefined,
                            autor: modalVerNota.usuarioNombre,
                            fecha: formatFechaCorta(modalVerNota.fechaCreacion),
                            secciones: modalVerNota.secciones || []
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer shrink-0"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Ver / Descargar Reporte
                      </button>
                    </div>
                    {resumen.resumenPorTipo.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-300/70">
                        {resumen.resumenPorTipo.map((r) => (
                          <span
                            key={r.tipoLabel}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-amber-300 text-[11px] font-black text-slate-800"
                          >
                            {r.tipoLabel}: <span className="text-red-600">{r.total} und.</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* AUTOR Y FECHA */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Registrado por: <strong className="text-slate-800">{modalVerNota.usuarioNombre}</strong></span>
                  </div>
                  {modalVerNota.completadaPor && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completada por: <strong className="text-emerald-800">{modalVerNota.completadaPor}</strong></span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                  {modalVerNota.fechaCreacion && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Creada: {formatFecha(modalVerNota.fechaCreacion)}</span>
                    </div>
                  )}
                  {modalVerNota.fechaCompletada && (
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Finalizada: {formatFecha(modalVerNota.fechaCompletada)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTONES: DESCARGAR PDF, IMPRIMIR, EDITAR Y CERRAR */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isExportingPdf}
                    onClick={() => handleDescargarNotaPDF(modalVerNota)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImprimirNota(modalVerNota)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                  {modalVerNota.secciones && modalVerNota.secciones.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setReporteModalData({
                          titulo: modalVerNota.lugar || 'Nota',
                          cliente: modalVerNota.clienteNombre || undefined,
                          centro: modalVerNota.centroNombre || undefined,
                          autor: modalVerNota.usuarioNombre,
                          fecha: formatFechaCorta(modalVerNota.fechaCreacion),
                          secciones: modalVerNota.secciones || []
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Reporte equipos
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalVerNota(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(modalVerNota)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar Nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR ELIMINACIÓN */}
      {notaAEliminar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">¿Eliminar esta nota?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Se eliminará la nota de <strong className="text-slate-800 uppercase">"{notaAEliminar.lugar}"</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNotaAEliminar(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-200 cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PLANO AMPLIADO */}
      {planoAmpliado && (
        <div
          onClick={() => setPlanoAmpliado(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-white rounded-2xl p-2 shadow-2xl cursor-default"
          >
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleDescargarImagenPlano(
                    planoAmpliado.url,
                    planoAmpliado.title,
                    planoAmpliado.nota
                      ? buildCajetinMeta(planoAmpliado.nota, planoAmpliado.title)
                      : undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-md cursor-pointer"
                title="Descargar imagen"
              >
                <Download className="w-4 h-4" />
                Descargar imagen
              </button>
              <button
                type="button"
                onClick={() => setPlanoAmpliado(null)}
                className="p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={planoAmpliado.url}
              alt={`Plano ${planoAmpliado.title}`}
              className="w-full max-h-[85vh] object-contain rounded-xl bg-white"
            />
          </div>
        </div>
      )}

      {/* MODAL 5: REPORTE DE ELEMENTOS POR SECCIONES */}
      {reporteModalData && (() => {
        const reporte = buildReporteEquiposPorSecciones(reporteModalData.secciones);
        return (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[130] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ClipboardList className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">
                      Reporte de Elementos por Zonas
                    </h3>
                    <p className="text-[11px] text-slate-300 truncate">
                      {reporteModalData.titulo} · Total: {reporte.totalGeneral} equipos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReporteModalData(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* Resumen Global */}
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-950 uppercase">
                      Recuento Total Global
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-black">
                      {reporte.totalGeneral} equipos
                    </span>
                  </div>
                  {reporte.resumenPorTipo.length === 0 ? (
                    <p className="text-xs text-amber-900">
                      No hay equipos registrados en las zonas de esta nota.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {reporte.resumenPorTipo.map((r) => (
                        <div
                          key={r.tipoLabel}
                          className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-200 rounded-xl px-3.5 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-800">- {r.tipoLabel}:</span>
                            <strong className="font-black text-slate-950">{r.total} und.</strong>
                            <span className="text-slate-600 font-medium">
                              ({r.porSeccion.map((s) => `${s.count} und. en ${s.seccionTitulo}`).join(' / ')})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black shrink-0">
                            Total: {r.total} und.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(reporte.incidenciasSenal).length > 0 && (
                    <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-red-800">Incidencias señal:</span>
                      {Object.entries(reporte.incidenciasSenal).map(([est, count]) => (
                        <span
                          key={est}
                          className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold"
                        >
                          {est}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desglose por cada sección */}
                {reporte.secciones.map((sec, idx) => (
                  <div key={sec.seccionId} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900 uppercase">
                        {sec.titulo.toLowerCase() === `zona ${idx + 1}`
                          ? sec.titulo
                          : `Zona ${idx + 1} ${sec.titulo}`}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {Object.entries(sec.conteoPorTipo).map(([tipo, count]) => (
                          <span
                            key={tipo}
                            className="px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[10px] font-bold text-slate-700"
                          >
                            {tipo}: {count} und.
                          </span>
                        ))}
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-black">
                          Total: {sec.total} und.
                        </span>
                      </div>
                    </div>

                    {sec.equipos.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-500 italic">
                        Sin equipos en esta zona.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                              <th className="px-3 py-2 font-black">Equipo</th>
                              <th className="px-3 py-2 font-black">Tipo / Modelo</th>
                              <th className="px-3 py-2 font-black">FF</th>
                              <th className="px-3 py-2 font-black">UT / PH</th>
                              <th className="px-3 py-2 font-black">Estado señal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sec.equipos.map((eq, i) => (
                              <tr key={`${sec.seccionId}-${eq.codigo}-${i}`} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 font-black text-red-700 whitespace-nowrap">
                                  {eq.codigo}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-800">
                                  {eq.modelo || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                  {eq.ff || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                  {eq.ut ? `UT: ${eq.ut}` : eq.ph ? `PH: ${eq.ph}` : '—'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {eq.estadoSenal ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        eq.estadoSenal === 'Correcta'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {eq.estadoSenal}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDescargarReporteEquiposPDF(reporteModalData)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Reporte PDF
                </button>
                <button
                  type="button"
                  onClick={() => setReporteModalData(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
