import { useState, useRef } from 'react';
import {
  X,
  Upload,
  Eye,
  Download,
  Trash2,
  FolderOpen,
  Settings,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { type Presupuesto, type Cliente, type Centro, type Empresa, updatePresupuesto } from '../firebase';
import { generarPresupuestoPDF } from '../pdfGenerator';
import {
  type DocumentoAdjuntoOneDrive,
  DEFAULT_ONEDRIVE_ROOT_FOLDER,
  getMakeOneDriveConfig,
  saveMakeOneDriveConfig,
  buildPresupuestoFolderName,
  uploadFileViaMakeWebhook
} from '../services/onedriveService';

interface Props {
  presupuesto: Presupuesto;
  clientes: Cliente[];
  centros: Centro[];
  empresas: Empresa[];
  onClose: () => void;
  onUpdatePresupuestoLocal: (updated: Presupuesto) => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function PresupuestoAdjuntosOneDriveModal({
  presupuesto,
  clientes,
  centros,
  empresas,
  onClose,
  onUpdatePresupuestoLocal,
}: Props) {
  const initialConfig = getMakeOneDriveConfig();
  const [rootFolderInput, setRootFolderInput] = useState(initialConfig.rootFolderPath || DEFAULT_ONEDRIVE_ROOT_FOLDER);
  const [showConfig, setShowConfig] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentoAdjuntoOneDrive | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const centroObj = centros.find((c) => (c as any)._docId === presupuesto.centroId || c.id === presupuesto.centroId);
  const clienteObj = clientes.find(
    (c) => (c as any)._docId === presupuesto.clienteId || c.id === presupuesto.clienteId || (c.nombre && c.nombre === presupuesto.nombreCliente)
  );
  const nombreCentro = centroObj?.nombre || (presupuesto as any).nombreCentro || presupuesto.nombreCliente || clienteObj?.nombre || '';
  const folderName = buildPresupuestoFolderName(presupuesto.numeroPresupuesto, presupuesto.id, nombreCentro);
  const adjuntos: DocumentoAdjuntoOneDrive[] = Array.isArray(presupuesto.documentosAdjuntos) ? presupuesto.documentosAdjuntos : [];

  const handleSaveConfig = () => {
    setErrorMsg('');
    setInfoMsg('');
    saveMakeOneDriveConfig({
      rootFolderPath: rootFolderInput.trim() || DEFAULT_ONEDRIVE_ROOT_FOLDER,
    });
    setShowConfig(false);
    setInfoMsg('Carpeta raíz actualizada en este navegador.');
  };

  const generarBlobCopiaPresupuesto = async (): Promise<{ blob: Blob; fileName: string }> => {
    let empresaSeleccionada: any = undefined;
    const empId = (presupuesto as any).empresaId || centroObj?.empresaId;
    if (empId) {
      empresaSeleccionada = empresas.find(
        (e) =>
          (e as any)._docId === empId ||
          (e as any).id === empId ||
          ((e as any).nombre && typeof (e as any).nombre === 'string' && (e as any).nombre.trim().toLowerCase() === empId.trim().toLowerCase())
      );
    }
    const blob = (await generarPresupuestoPDF(
      {
        titulo: presupuesto.titulo,
        numeroPresupuesto: presupuesto.numeroPresupuesto,
        nombreCliente: presupuesto.nombreCliente || clienteObj?.nombre || 'Cliente',
        cliente: clienteObj,
        fechaCreacion: presupuesto.fechaCreacion,
        fechaValidez: presupuesto.fechaValidez,
        estado: presupuesto.estado,
        lineas: (presupuesto.lineas || []).map((l) => ({
          tipo: l.tipo,
          capitulo: l.capitulo,
          capituloId: l.capituloId,
          familia: l.familia,
          concepto: l.concepto,
          descripcion: l.descripcion,
          codigo: l.codigo,
          fotoUrl: l.fotoUrl,
          cantidad: l.cantidad,
          precioUnidad: l.precioUnidad,
          subtotal: l.subtotal,
        })),
        subtotal: presupuesto.subtotal,
        descuentoPorcentaje: presupuesto.descuentoPorcentaje,
        descuentoImporte: presupuesto.descuentoImporte,
        iva: presupuesto.iva,
        total: presupuesto.total,
        notas: presupuesto.notas,
        returnBlob: true,
      },
      empresaSeleccionada
    )) as Blob;

    const fileName = `Presupuesto_${folderName}.pdf`;
    return { blob, fileName };
  };

  const persistAdjuntos = async (nextAdjuntos: DocumentoAdjuntoOneDrive[]) => {
    const docId = presupuesto._docId || presupuesto.id;
    await updatePresupuesto(docId, { documentosAdjuntos: nextAdjuntos });
    onUpdatePresupuestoLocal({ ...presupuesto, documentosAdjuntos: nextAdjuntos });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');
    setInfoMsg('');
    setIsUploading(true);

    try {
      const presupuestoDocId = presupuesto._docId || presupuesto.id;
      let updatedList = [...adjuntos];
      let missingWebUrlCount = 0;

      // Si aún no hay copia del PDF del presupuesto en OneDrive, generarla y enviarla automáticamente
      const yaTieneCopia = updatedList.some((d) => d.esCopiaPresupuesto);
      if (!yaTieneCopia) {
        setUploadStatus('Generando y enviando copia del presupuesto en PDF...');
        const { blob, fileName } = await generarBlobCopiaPresupuesto();
        const uploadedPdf = await uploadFileViaMakeWebhook({
          fileData: blob,
          fileName,
          folderName,
          presupuestoId: presupuestoDocId,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          nombreCentro,
          esCopiaPresupuesto: true,
        });
        if (!uploadedPdf.webUrl) missingWebUrlCount += 1;
        updatedList.push({
          id: `od_${Date.now()}_pdf`,
          nombre: uploadedPdf.nombre,
          onedriveItemId: uploadedPdf.id,
          webUrl: uploadedPdf.webUrl,
          downloadUrl: uploadedPdf.downloadUrl,
          size: uploadedPdf.size,
          mimeType: uploadedPdf.mimeType,
          carpetaNombre: folderName,
          rutaCompleta: uploadedPdf.rutaCompleta,
          esCopiaPresupuesto: true,
          syncedViaMake: true,
          fechaSubida: new Date().toISOString(),
        });
      }

      const fileArray = Array.from(files);
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadStatus(`Enviando a OneDrive (${i + 1}/${fileArray.length}): ${file.name}...`);
        const uploaded = await uploadFileViaMakeWebhook({
          fileData: file,
          fileName: file.name,
          folderName,
          presupuestoId: presupuestoDocId,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          nombreCentro,
          esCopiaPresupuesto: false,
        });
        if (!uploaded.webUrl) missingWebUrlCount += 1;

        const existingIdx = updatedList.findIndex(
          (d) => (uploaded.id && d.onedriveItemId === uploaded.id) || d.nombre === uploaded.nombre
        );
        const newDoc: DocumentoAdjuntoOneDrive = {
          id: existingIdx >= 0 ? updatedList[existingIdx].id : `od_${Date.now()}_${i}`,
          nombre: uploaded.nombre,
          onedriveItemId: uploaded.id,
          webUrl: uploaded.webUrl,
          downloadUrl: uploaded.downloadUrl,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          carpetaNombre: folderName,
          rutaCompleta: uploaded.rutaCompleta,
          syncedViaMake: true,
          fechaSubida: new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          updatedList[existingIdx] = newDoc;
        } else {
          updatedList.push(newDoc);
        }
      }

      setUploadStatus('Guardando referencias en el presupuesto...');
      await persistAdjuntos(updatedList);

      if (missingWebUrlCount > 0) {
        setInfoMsg(
          'Archivo(s) enviados a OneDrive correctamente. Para abrir el enlace directo desde aquí, configura "Webhook Response" en Make devolviendo webUrl.'
        );
      } else {
        setInfoMsg('Archivo(s) guardados en OneDrive y vinculados al presupuesto.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al enviar archivos a OneDrive.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSavePresupuestoCopyOnly = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setIsUploading(true);
    try {
      const presupuestoDocId = presupuesto._docId || presupuesto.id;
      setUploadStatus('Generando y enviando copia del presupuesto PDF...');
      const { blob, fileName } = await generarBlobCopiaPresupuesto();
      const uploadedPdf = await uploadFileViaMakeWebhook({
        fileData: blob,
        fileName,
        folderName,
        presupuestoId: presupuestoDocId,
        numeroPresupuesto: presupuesto.numeroPresupuesto,
        nombreCentro,
        esCopiaPresupuesto: true,
      });

      let updatedList = [...adjuntos];
      const existingIdx = updatedList.findIndex(
        (d) => d.esCopiaPresupuesto || (uploadedPdf.id && d.onedriveItemId === uploadedPdf.id)
      );
      const pdfDoc: DocumentoAdjuntoOneDrive = {
        id: existingIdx >= 0 ? updatedList[existingIdx].id : `od_${Date.now()}_pdf`,
        nombre: uploadedPdf.nombre,
        onedriveItemId: uploadedPdf.id,
        webUrl: uploadedPdf.webUrl,
        downloadUrl: uploadedPdf.downloadUrl,
        size: uploadedPdf.size,
        mimeType: uploadedPdf.mimeType,
        carpetaNombre: folderName,
        rutaCompleta: uploadedPdf.rutaCompleta,
        esCopiaPresupuesto: true,
        syncedViaMake: true,
        fechaSubida: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        updatedList[existingIdx] = pdfDoc;
      } else {
        updatedList.unshift(pdfDoc);
      }
      await persistAdjuntos(updatedList);
      setInfoMsg(
        uploadedPdf.webUrl
          ? 'Copia PDF del presupuesto guardada en OneDrive.'
          : 'Copia PDF enviada a OneDrive. Añade "Webhook Response" en Make si quieres abrir el enlace directo desde aquí.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error guardando la copia del presupuesto en OneDrive.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handlePreview = (docItem: DocumentoAdjuntoOneDrive) => {
    setErrorMsg('');
    if (docItem.webUrl) {
      window.open(docItem.webUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setErrorMsg(
      'Este archivo no tiene enlace directo todavía porque Make no devolvió "webUrl" mediante Webhook Response.'
    );
  };

  const handleDownload = (docItem: DocumentoAdjuntoOneDrive) => {
    setErrorMsg('');
    const targetUrl = docItem.downloadUrl || docItem.webUrl;
    if (!targetUrl) {
      setErrorMsg(
        'No hay URL de descarga registrada para este archivo. Añade un módulo "Webhook Response" en Make devolviendo downloadUrl o webUrl.'
      );
      return;
    }
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = docItem.nombre;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDoc) return;
    const target = confirmDeleteDoc;
    setConfirmDeleteDoc(null);
    setErrorMsg('');
    setInfoMsg('');
    setBusyItemId(target.id);
    try {
      const nextList = adjuntos.filter((d) => d.id !== target.id);
      await persistAdjuntos(nextList);
      setInfoMsg('Referencia eliminada del presupuesto.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al eliminar la referencia.');
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-zinc-200/80 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-5 bg-zinc-50 border-b border-zinc-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Paperclip className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-zinc-900 truncate">
                  Documentos adjuntos en OneDrive
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 truncate">
                  Presupuesto <span className="font-bold text-zinc-800">{presupuesto.numeroPresupuesto || presupuesto.id}</span>
                  {nombreCentro ? <> · <span className="font-semibold text-zinc-700">{nombreCentro}</span></> : null}
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-zinc-600 flex items-center gap-2 flex-wrap pt-1">
              <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold">Carpeta destino:</span>
              <span className="font-mono text-xs font-bold text-zinc-800 bg-zinc-200/80 px-2.5 py-1 rounded-lg break-all">
                {rootFolderInput}/{folderName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfig((prev) => !prev)}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                showConfig
                  ? 'bg-sky-100 text-sky-800 border-sky-300'
                  : 'bg-white text-zinc-500 hover:text-zinc-900 border-zinc-200'
              }`}
              title="Ajustar carpeta raíz"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
          {/* Estado de conexión segura vía Cloud Function */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="flex items-center gap-3 min-w-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-emerald-950 truncate">
                  Conexión segura activa (Cloud Functions → Make → OneDrive)
                </p>
                <p className="text-xs text-emerald-800/80 truncate">
                  Credenciales protegidas en servidor · Tamaño máximo 25 MB por archivo
                </p>
              </div>
            </div>
          </div>

          {/* Panel opcional de carpeta raíz */}
          {showConfig && (
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
              <p className="text-xs font-black text-sky-950 uppercase tracking-wider">
                Carpeta destino en OneDrive
              </p>
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Carpeta raíz en OneDrive
                  </label>
                  <input
                    type="text"
                    value={rootFolderInput}
                    onChange={(e) => setRootFolderInput(e.target.value)}
                    placeholder={DEFAULT_ONEDRIVE_ROOT_FOLDER}
                    className="w-full px-3.5 py-2.5 bg-white border border-sky-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    Guardar carpeta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mensajes de error o información */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {infoMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Zona de subida de archivos */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3.5 px-5 rounded-xl bg-zinc-900 hover:bg-black text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <span>{isUploading ? uploadStatus || 'Subiendo a OneDrive...' : 'Subir archivo(s) a OneDrive'}</span>
            </button>
            <button
              type="button"
              disabled={isUploading}
              onClick={handleSavePresupuestoCopyOnly}
              className="py-3.5 px-5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
              title="Generar y guardar copia en PDF del presupuesto en OneDrive"
            >
              <FileText className="w-5 h-5 text-amber-700" />
              <span>Guardar copia PDF</span>
            </button>
          </div>

          {/* Lista de documentos adjuntos vinculados al presupuesto */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-black text-zinc-600 uppercase tracking-wider">
                Archivos vinculados ({adjuntos.length})
              </h3>
            </div>
            {adjuntos.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/60">
                <Paperclip className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-600">
                  No hay documentos adjuntos en este presupuesto todavía.
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Al subir un archivo se guardará en OneDrive junto con una copia del presupuesto en PDF.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                {adjuntos.map((docItem) => {
                  const isBusy = busyItemId === docItem.id;
                  const hasLink = Boolean(docItem.webUrl || docItem.downloadUrl);
                  return (
                    <div key={docItem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handlePreview(docItem)}
                          className={`text-sm font-bold truncate block text-left w-full cursor-pointer ${
                            hasLink ? 'text-sky-700 hover:text-sky-900 hover:underline' : 'text-zinc-800'
                          }`}
                          title={hasLink ? 'Abrir archivo en OneDrive' : 'Sin enlace directo (añadir Webhook Response en Make)'}
                        >
                          {docItem.nombre}
                        </button>
                        <div className="flex items-center gap-2.5 text-xs text-zinc-500 mt-1 flex-wrap">
                          {docItem.esCopiaPresupuesto && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                              Copia Presupuesto
                            </span>
                          )}
                          {!hasLink && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-semibold text-[11px]">
                              En OneDrive (sin enlace directo)
                            </span>
                          )}
                          {docItem.size ? <span>{formatFileSize(docItem.size)}</span> : null}
                          <span>{new Date(docItem.fechaSubida).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handlePreview(docItem)}
                          className="px-3 py-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Previsualizar en OneDrive"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDownload(docItem)}
                          className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Descargar desde OneDrive"
                        >
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          <span>Descargar</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteDoc(docItem)}
                          className="px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="Quitar enlace del presupuesto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmación de eliminación */}
      {confirmDeleteDoc && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteDoc(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-zinc-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5 text-center">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-zinc-900">¿Quitar documento del presupuesto?</h3>
              <p className="text-xs text-zinc-500 break-words">
                Se quitará <strong>{confirmDeleteDoc.nombre}</strong> de la lista de enlaces de este presupuesto.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                className="flex-1 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Sí, quitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
