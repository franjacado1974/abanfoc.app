const fs = require('fs');
let content = fs.readFileSync('src/components/RevisionSistemas/SistemaExtintores.tsx', 'utf-8');

const oldFechaBlock = `} else if (tipo === 'fecha') {
                                                                                const fechaVal = typeof val === 'string' && val ? val.substring(0, 7) : '';
                                                                                const isErrorDate = (caducado || necesitaRetimbre || seAproxima) && (item.key === fabItemKey || item.key === retItemKey);
                                                                                return (
                                                                                    <div key={item.key} className="flex flex-col gap-0.5">
                                                                                        <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                        <input
                                                                                            type="month"
                                                                                            value={fechaVal}
                                                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? e.target.value + '-01' : '')}
                                                                                            className={\`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors \${
                                                                                                isErrorDate
                                                                                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20'
                                                                                                : \`bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 \${fechaVal ? 'font-bold' : ''}\`
                                                                                            }\`}
                                                                                        />
                                                                                    </div>
                                                                                );`;

const newFechaBlock = `} else if (tipo === 'fecha') {
                                                                                const lblLower = (item.label || '').toLowerCase();
                                                                                const isFechaRevision = lblLower.includes('fecha de revisi');
                                                                                const isErrorDate = (caducado || necesitaRetimbre || seAproxima) && (item.key === fabItemKey || item.key === retItemKey);

                                                                                if (isFechaRevision) {
                                                                                    const fechaValFull = typeof val === 'string' ? val : '';
                                                                                    const setHoy = () => {
                                                                                        const hoy = new Date().toISOString().split('T')[0];
                                                                                        handleCheckChange(eq.id, item.key, hoy);
                                                                                    };
                                                                                    return (
                                                                                        <div key={item.key} className="flex flex-col gap-0.5">
                                                                                            <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                            <div className="flex gap-1">
                                                                                                <input
                                                                                                    type="date"
                                                                                                    value={fechaValFull}
                                                                                                    onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value)}
                                                                                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                                                                                />
                                                                                                <button
                                                                                                    onClick={setHoy}
                                                                                                    className="px-2 py-1.5 bg-sky-100 text-sky-700 font-bold text-xs rounded-lg hover:bg-sky-200 transition-colors"
                                                                                                >
                                                                                                    Hoy
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                const fechaVal = typeof val === 'string' && val ? val.substring(0, 7) : '';
                                                                                return (
                                                                                    <div key={item.key} className="flex flex-col gap-0.5">
                                                                                        <label className="text-[10px] font-semibold text-slate-500">{item.label}</label>
                                                                                        <input
                                                                                            type="month"
                                                                                            value={fechaVal}
                                                                                            onChange={(e) => handleCheckChange(eq.id, item.key, e.target.value ? e.target.value + '-01' : '')}
                                                                                            className={\`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 transition-colors \${
                                                                                                isErrorDate
                                                                                                ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500/20'
                                                                                                : \`bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 \${fechaVal ? 'font-bold' : ''}\`
                                                                                            }\`}
                                                                                        />
                                                                                    </div>
                                                                                );`;

const updatedContent = content.replace(oldFechaBlock, newFechaBlock);
if (content === updatedContent) {
    console.log('Error: No se pudo encontrar el bloque para reemplazar en SistemaExtintores.tsx');
    process.exit(1);
}
fs.writeFileSync('src/components/RevisionSistemas/SistemaExtintores.tsx', updatedContent);
console.log('Parche aplicado a SistemaExtintores.tsx');
