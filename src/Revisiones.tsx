export default function Revisiones() {
  return (
    <div className="min-h-screen bg-indigo-50/40 p-6 md:p-12">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Revisiones</h1>
          <p className="text-zinc-500 mt-2 text-sm">mantenimientos periódicos</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center shadow-sm">
            <p className="text-zinc-500 text-sm">No hay tareas o calendarios disponibles en este momento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
