import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

export default function Revisiones() {
  const [showCalendar, setShowCalendar] = useState(false);

  if (showCalendar) {
    return (
      <div className="min-h-screen bg-indigo-50/40 p-6 md:p-12">
        <div className="max-w-7xl mx-auto w-full flex flex-col" style={{ height: 'calc(100vh - 100px)' }}>
          <div className="flex-grow bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden relative">
            <iframe 
              src="https://calendar.google.com/calendar/embed?src=c_8588530bae585174640b0ed606693f595e85658ef39bbf980bb745c85a6c223c%40group.calendar.google.com&ctz=Europe%2FMadrid" 
              style={{ border: 0, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
              frameBorder={0} 
              title="Google Calendar"
            ></iframe>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50/40 p-6 md:p-12">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Revisiones Preventivas</h1>
          <p className="text-zinc-500 mt-2">Planificación y seguimiento de mantenimientos periódicos.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Tarjeta del Calendario */}
          <button 
            onClick={() => setShowCalendar(true)}
            className="group relative flex flex-col bg-indigo-50 border-indigo-200 hover:border-indigo-300 text-indigo-950 p-6 rounded-3xl border shadow-sm hover:shadow-lg transition-all text-left overflow-hidden cursor-pointer"
            style={{ minHeight: '220px' }}
          >
            <div className="absolute -top-4 -right-4 p-6 text-indigo-200 group-hover:-translate-y-2 group-hover:translate-x-2 transition-transform">
              <CalendarDays className="w-28 h-28 opacity-60" />
            </div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-10 relative z-10 group-hover:scale-110 transition-transform shadow-sm bg-indigo-100 text-indigo-600">
              <CalendarDays className="w-5 h-5" strokeWidth={2.5} />
            </div>
            
            <div className="mt-auto relative z-10">
              <h2 className="text-xl font-bold mb-1.5 flex items-center gap-2">
                Calendario
              </h2>
              <p className="opacity-70 text-sm line-clamp-2">Abre el calendario para consultar o programar fechas.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
