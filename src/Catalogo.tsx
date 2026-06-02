import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Wrench, Search, Plus, Upload, Download, Edit, Trash2, X, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
  revisable: boolean;
}

interface Servicio {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
}

export default function Catalogo() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'articulos' | 'servicios'>('articulos');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal edición artículo
  const [editingArticulo, setEditingArticulo] = useState<Articulo | null>(null);
  const [artForm, setArtForm] = useState<Articulo | null>(null);

  // Modal edición servicio
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null);
  const [srvForm, setSrvForm] = useState<Servicio | null>(null);

  useEffect(() => {
    const savedArticulos = localStorage.getItem('firecheck_db_articulos');
    if (savedArticulos) { try { setArticulos(JSON.parse(savedArticulos)); } catch { setArticulos([]); } }
    const savedServicios = localStorage.getItem('firecheck_db_servicios');
    if (savedServicios) { try { setServicios(JSON.parse(savedServicios)); } catch { setServicios([]); } }
  }, []);

  const filteredArticulos = useMemo(() => {
    return articulos.filter(a => {
      const term = searchTerm.toLowerCase();
      return (a.nombre || '').toLowerCase().includes(term) ||
             (a.codigo || '').toLowerCase().includes(term) ||
             (a.familia || '').toLowerCase().includes(term);
    });
  }, [articulos, searchTerm]);

  const filteredServicios = useMemo(() => {
    return servicios.filter(s => {
      const term = searchTerm.toLowerCase();
      return (s.nombre || '').toLowerCase().includes(term) ||
             (s.codigo || '').toLowerCase().includes(term) ||
             (s.familia || '').toLowerCase().includes(term);
    });
  }, [servicios, searchTerm]);

  const handleExport = () => {
    if (activeTab === 'articulos') {
      if (articulos.length === 0) return alert('No hay artículos para exportar');
      const ws = XLSX.utils.json_to_sheet(articulos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
      XLSX.writeFile(wb, 'catalogo_articulos.xlsx');
    } else {
      if (servicios.length === 0) return alert('No hay servicios para exportar');
      const ws = XLSX.utils.json_to_sheet(servicios);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
      XLSX.writeFile(wb, 'catalogo_servicios.xlsx');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        if (activeTab === 'articulos') {
          const imported: Articulo[] = data.map((row: any) => ({
            id: row.id || 'ART-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            codigo: String(row.codigo || row.Código || ''),
            nombre: String(row.nombre || row.Nombre || ''),
            familia: String(row.familia || row.Familia || ''),
            precioCompra: parseFloat(row.precioCompra || row['P. Compra'] || 0),
            precioVenta: parseFloat(row.precioVenta || row['P. Venta'] || 0),
            revisable: row.revisable === true || row.revisable === 'true' || row.revisable === 'Sí',
          })).filter(a => a.nombre);
          const updated = [...articulos, ...imported];
          setArticulos(updated);
          localStorage.setItem('firecheck_db_articulos', JSON.stringify(updated));
          alert(`${imported.length} artículos importados correctamente.`);
        } else {
          const imported: Servicio[] = data.map((row: any) => ({
            id: row.id || 'SRV-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            codigo: String(row.codigo || row.Código || ''),
            nombre: String(row.nombre || row.Nombre || ''),
            familia: String(row.familia || row.Familia || ''),
            precioCompra: parseFloat(row.precioCompra || row['P. Compra'] || 0),
            precioVenta: parseFloat(row.precioVenta || row['P. Venta'] || 0),
          })).filter(s => s.nombre);
          const updated = [...servicios, ...imported];
          setServicios(updated);
          localStorage.setItem('firecheck_db_servicios', JSON.stringify(updated));
          alert(`${imported.length} servicios importados correctamente.`);
        }
      } catch (err) {
        console.error(err);
        alert('Error al importar el archivo');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  // Artículo handlers
  const handleEditArticulo = (a: Articulo) => {
    setEditingArticulo(a);
    setArtForm({ ...a });
  };
  const handleSaveArticulo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artForm) return;
    const updated = articulos.map(a => a.id === artForm.id ? artForm : a);
    setArticulos(updated);
    localStorage.setItem('firecheck_db_articulos', JSON.stringify(updated));
    setEditingArticulo(null);
    setArtForm(null);
  };
  const handleDeleteArticulo = (id: string) => {
    if (!confirm('¿Eliminar este artículo?')) return;
    const updated = articulos.filter(a => a.id !== id);
    setArticulos(updated);
    localStorage.setItem('firecheck_db_articulos', JSON.stringify(updated));
  };

  // Servicio handlers
  const handleEditServicio = (s: Servicio) => {
    setEditingServicio(s);
    setSrvForm({ ...s });
  };
  const handleSaveServicio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvForm) return;
    const updated = servicios.map(s => s.id === srvForm.id ? srvForm : s);
    setServicios(updated);
    localStorage.setItem('firecheck_db_servicios', JSON.stringify(updated));
    setEditingServicio(null);
    setSrvForm(null);
  };
  const handleDeleteServicio = (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    const updated = servicios.filter(s => s.id !== id);
    setServicios(updated);
    localStorage.setItem('firecheck_db_servicios', JSON.stringify(updated));
  };

  const tabs = [
    { id: 'articulos' as const, label: 'Artículos', icon: Package, count: articulos.length },
    { id: 'servicios' as const, label: 'Servicios', icon: Wrench, count: servicios.length },
  ];

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Catálogo</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestión de artículos y servicios</p>
      </div>

      {/* Tabs + botones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                activeTab === tab.id ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200 text-zinc-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <button onClick={handleExport} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm">
            <Upload className="w-3.5 h-3.5" /> Exportar
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all text-xs shadow-sm">
            <Download className="w-3.5 h-3.5" /> Importar
          </button>
          <button onClick={() => navigate(activeTab === 'articulos' ? '/articulos' : '/servicios')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-black text-white px-3 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all text-xs shadow-md shadow-black/10">
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-zinc-400" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-zinc-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none transition-all shadow-sm text-sm text-zinc-900 placeholder-zinc-400"
          placeholder={`Buscar ${activeTab === 'articulos' ? 'artículo' : 'servicio'} por nombre, código o familia...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabla Artículos */}
      {activeTab === 'articulos' && (
        <>
          {articulos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><Package className="w-8 h-8 text-zinc-400" /></div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay artículos</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">No tienes artículos registrados en el catálogo.</p>
              <button onClick={() => navigate('/articulos')} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md">
                <Plus className="w-5 h-5" /> Añadir primer artículo
              </button>
            </div>
          ) : filteredArticulos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">No se ha encontrado ningún artículo que coincida con "{searchTerm}".</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <div className="w-20">Código</div>
                <div className="flex-1">Nombre</div>
                <div className="w-36">Familia</div>
                <div className="w-28 text-right">P. Compra</div>
                <div className="w-28 text-right">P. Venta</div>
                <div className="w-24 text-center">Revisable</div>
                <div className="w-20 text-right">Acciones</div>
              </div>
              <div className="divide-y divide-zinc-200">
                {filteredArticulos.map((a) => (
                  <div key={a.id} className="flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-zinc-50/80 transition-colors group">
                    {/* Mobile */}
                    <div className="flex md:hidden items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{a.codigo}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleEditArticulo(a)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteArticulo(a.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex md:hidden mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{a.nombre}</p>
                        <p className="text-xs text-zinc-500">{a.familia}</p>
                      </div>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:flex items-center w-full">
                      <div className="w-20"><span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{a.codigo}</span></div>
                      <div className="flex-1 min-w-0 pr-2"><p className="text-sm font-bold text-zinc-900 truncate">{a.nombre}</p></div>
                      <div className="w-36 text-sm text-zinc-600 truncate pr-2">{a.familia || '-'}</div>
                      <div className="w-28 text-sm text-zinc-600 text-right pr-2">{a.precioCompra ? `${a.precioCompra.toFixed(2)} €` : '-'}</div>
                      <div className="w-28 text-sm text-zinc-600 text-right pr-2">{a.precioVenta ? `${a.precioVenta.toFixed(2)} €` : '-'}</div>
                      <div className="w-24 text-center">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${a.revisable ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                          {a.revisable ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div className="w-20 flex items-center justify-end gap-1">
                        <button onClick={() => handleEditArticulo(a)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteArticulo(a.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tabla Servicios */}
      {activeTab === 'servicios' && (
        <>
          {servicios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><Wrench className="w-8 h-8 text-zinc-400" /></div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Aún no hay servicios</h3>
              <p className="text-zinc-500 mb-8 max-w-md mx-auto">No tienes servicios registrados en el catálogo.</p>
              <button onClick={() => navigate('/servicios')} className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-md">
                <Plus className="w-5 h-5" /> Añadir primer servicio
              </button>
            </div>
          ) : filteredServicios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-sm">
              <Search className="w-8 h-8 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No hay resultados</h3>
              <p className="text-zinc-500">No se ha encontrado ningún servicio que coincida con "{searchTerm}".</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="hidden md:flex items-center bg-[#f9f7f4] border-b-2 border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <div className="w-20">Código</div>
                <div className="flex-1">Nombre</div>
                <div className="w-36">Familia</div>
                <div className="w-28 text-right">P. Compra</div>
                <div className="w-28 text-right">P. Venta</div>
                <div className="w-20 text-right">Acciones</div>
              </div>
              <div className="divide-y divide-zinc-200">
                {filteredServicios.map((s) => (
                  <div key={s.id} className="flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-zinc-50/80 transition-colors group">
                    {/* Mobile */}
                    <div className="flex md:hidden items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{s.codigo}</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleEditServicio(s)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteServicio(s.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex md:hidden mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">{s.nombre}</p>
                        <p className="text-xs text-zinc-500">{s.familia}</p>
                      </div>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:flex items-center w-full">
                      <div className="w-20"><span className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{s.codigo}</span></div>
                      <div className="flex-1 min-w-0 pr-2"><p className="text-sm font-bold text-zinc-900 truncate">{s.nombre}</p></div>
                      <div className="w-36 text-sm text-zinc-600 truncate pr-2">{s.familia || '-'}</div>
                      <div className="w-28 text-sm text-zinc-600 text-right pr-2">{s.precioCompra ? `${s.precioCompra.toFixed(2)} €` : '-'}</div>
                      <div className="w-28 text-sm text-zinc-600 text-right pr-2">{s.precioVenta ? `${s.precioVenta.toFixed(2)} €` : '-'}</div>
                      <div className="w-20 flex items-center justify-end gap-1">
                        <button onClick={() => handleEditServicio(s)} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteServicio(s.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal editar artículo */}
      {editingArticulo && artForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-900">Editar Artículo</h2>
              <button onClick={() => { setEditingArticulo(null); setArtForm(null); }} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveArticulo} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Código</label>
                  <input required type="text" value={artForm.codigo} onChange={e => setArtForm({...artForm, codigo: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Familia</label>
                  <input required type="text" value={artForm.familia} onChange={e => setArtForm({...artForm, familia: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nombre</label>
                <input required type="text" value={artForm.nombre} onChange={e => setArtForm({...artForm, nombre: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">P. Compra (€)</label>
                  <input type="number" step="0.01" value={artForm.precioCompra} onChange={e => setArtForm({...artForm, precioCompra: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">P. Venta (€)</label>
                  <input type="number" step="0.01" value={artForm.precioVenta} onChange={e => setArtForm({...artForm, precioVenta: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={artForm.revisable} onChange={e => setArtForm({...artForm, revisable: e.target.checked})} className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm font-medium text-zinc-700">Revisable</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setEditingArticulo(null); setArtForm(null); }} className="flex-1 px-4 py-2.5 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar servicio */}
      {editingServicio && srvForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-900">Editar Servicio</h2>
              <button onClick={() => { setEditingServicio(null); setSrvForm(null); }} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveServicio} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Código</label>
                  <input required type="text" value={srvForm.codigo} onChange={e => setSrvForm({...srvForm, codigo: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Familia</label>
                  <input required type="text" value={srvForm.familia} onChange={e => setSrvForm({...srvForm, familia: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nombre</label>
                <input required type="text" value={srvForm.nombre} onChange={e => setSrvForm({...srvForm, nombre: e.target.value})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">P. Compra (€)</label>
                  <input type="number" step="0.01" value={srvForm.precioCompra} onChange={e => setSrvForm({...srvForm, precioCompra: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">P. Venta (€)</label>
                  <input type="number" step="0.01" value={srvForm.precioVenta} onChange={e => setSrvForm({...srvForm, precioVenta: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-black" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setEditingServicio(null); setSrvForm(null); }} className="flex-1 px-4 py-2.5 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"><Save className="w-4 h-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
