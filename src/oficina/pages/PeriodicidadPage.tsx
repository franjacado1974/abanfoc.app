import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { subscribeCentros, updateCentro } from '../../recursos-compartidos/firebase/firebase';
import type { Centro } from '../../recursos-compartidos/types/models';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function PeriodicidadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [centros, setCentros] = useState<Centro[]>([]);
  const [centro, setCentro] = useState<Centro | null>(null);
  const [formPeriodicidad, setFormPeriodicidad] = useState<{ periodicidad: string[], mesesRevision: string[] }>({ periodicidad: [], mesesRevision: [] });

  useEffect(() => {
    const unsubscribe = subscribeCentros((items: any[]) => {
      const mapped = items.map((d: any) => ({ ...d }));
      setCentros(mapped);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(mapped));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const centroId = location.state?.centroId;
    if (centroId) {
      const foundCentro = centros.find(c => c._docId === centroId || c.id === centroId);
      if (foundCentro) {
        setCentro(foundCentro);
        setFormPeriodicidad({
          periodicidad: foundCentro.periodicidad || [],
          mesesRevision: foundCentro.mesesRevision || []
        });
      }
    }
  }, [centros, location.state]);

  const normalizeSelectedValues = (values?: string[] | string | null) => {
    if (Array.isArray(values)) return values.filter(value => typeof value === 'string' && value.trim() !== '');
    if (typeof values === 'string' && values.trim() !== '') return [values];
    return [];
  };

  const handleSavePeriodicidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centro) return;

    const periodicidad = normalizeSelectedValues(formPeriodicidad.periodicidad);
    const mesesRevision = normalizeSelectedValues(formPeriodicidad.mesesRevision);
    const updatedCentro = { ...centro, periodicidad, mesesRevision };
    
    const docId = (centro as any)._docId || centro.id;
    const { _docId, ...centroData } = updatedCentro as any;
    
    try {
      await updateCentro(docId, centroData);
      const updatedCentros = centros.map(c => c.id === centro.id ? { ...updatedCentro, _docId: (c as any)._docId || _docId } : c);
      localStorage.setItem('firecheck_db_centros', JSON.stringify(updatedCentros));
      setCentros(updatedCentros);
      
      navigate('/centros');
    } catch (err) {
      console.error('Error guardando periodicidad en Firestore:', err);
      alert('Error al guardar la periodicidad en Firestore');
    }
  };

  if (!centro) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/centros')} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Volver a Centros
          </button>
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-zinc-500">Centro no encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/centros')} className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a Centros
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900">Configurar Periodicidad</h1>
            <p className="text-sm text-zinc-500">{centro.nombre}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <form onSubmit={handleSavePeriodicidad} className="p-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">1. Tipo de contrato</h3>
              <div className="flex flex-wrap gap-4">
                {['Mensual', 'Trimestral', 'Anual'].map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={formPeriodicidad.periodicidad.includes(type)} 
                      onChange={e => { 
                        const newTypes = e.target.checked 
                          ? [...formPeriodicidad.periodicidad, type] 
                          : formPeriodicidad.periodicidad.filter(t => t !== type); 
                        setFormPeriodicidad({ ...formPeriodicidad, periodicidad: newTypes }); 
                      }} 
                      className="w-5 h-5 text-black rounded border-zinc-300 focus:ring-black cursor-pointer" 
                    />
                    <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">2. ¿Cuándo sería la revisión Anual?</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {MESES.map(mes => (
                  <label key={mes} className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border-2 transition-all ${formPeriodicidad.mesesRevision.includes(mes) ? 'bg-zinc-900 border-emerald-500 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}>
                    <input 
                      type="radio" 
                      name="mesRevision" 
                      className="hidden" 
                      checked={formPeriodicidad.mesesRevision.includes(mes)} 
                      onChange={() => { 
                        setFormPeriodicidad({ ...formPeriodicidad, mesesRevision: [mes] }); 
                      }} 
                    />
                    <span className="text-xs font-bold w-full text-center">{mes}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Resumen del contrato</h3>
              {(() => {
                const tipos = formPeriodicidad.periodicidad;
                const mesRevis = formPeriodicidad.mesesRevision[0] || '';
                const lineas: string[] = [];
                
                if (tipos.includes('Anual') && mesRevis) { 
                  lineas.push(`Revisión anual: ${mesRevis.toLowerCase()}`); 
                } else if (tipos.includes('Anual')) { 
                  lineas.push('Revisión anual: (selecciona un mes)'); 
                }
                
                if (tipos.includes('Trimestral') && mesRevis) { 
                  const idx = MESES.indexOf(mesRevis);
                  const trimestres = [3, 6, 9].map(offset => MESES[(idx + offset) % 12]);
                  lineas.push(`Revisión trimestral: ${trimestres.join(', ').toLowerCase()}`);
                } else if (tipos.includes('Trimestral')) { 
                  lineas.push('Revisión trimestral: (selecciona un mes de referencia)'); 
                }
                
                if (tipos.includes('Mensual')) { 
                  lineas.push('Revisión mensual'); 
                }
                
                return lineas.length > 0 ? (
                  <div className="text-sm font-medium text-zinc-900 leading-relaxed space-y-1">
                    {lineas.map((linea, i) => (<p key={i}>{linea}</p>))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 italic">Selecciona al menos un tipo de contrato y un mes para ver el resumen.</p>
                );
              })()}
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => navigate('/centros')} 
                className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex-1 bg-black hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-black/10 transition-all"
              >
                Guardar Periodicidad
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}