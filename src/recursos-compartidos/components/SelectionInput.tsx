

interface SelectionInputProps {
    value: any;
    opciones: string[];
    onChange: (newValue: string) => void;
    label?: string;
    horizontal?: boolean;
}

export default function SelectionInput({
    value,
    opciones,
    onChange,
    label,
    horizontal = false
}: SelectionInputProps) {
    // Parse current values (supports both comma-separated string and array)
    const currentValues: string[] = typeof value === 'string' && value.trim() !== ''
        ? value.split(',').map(s => s.trim())
        : (Array.isArray(value) ? value : []);

    const handleToggle = (opt: string) => {
        let nextValues: string[];
        if (currentValues.includes(opt)) {
            nextValues = currentValues.filter(v => v !== opt);
        } else {
            nextValues = [...currentValues, opt];
        }
        onChange(nextValues.join(', '));
    };

    const containerClass = horizontal
        ? "flex gap-4 flex-wrap justify-end"
        : "flex gap-4 flex-wrap mt-1";

    const content = opciones.map((opt: string, idx: number) => {
        const isSelected = currentValues.includes(opt);
        return (
            <button
                key={idx}
                type="button"
                onClick={() => handleToggle(opt)}
                className={`inline-flex items-center gap-1.5 py-1 select-none transition-all cursor-pointer ${
                    isSelected ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                }`}
            >
                {/* Circle checkbox indicator */}
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                    isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : 'bg-white border-slate-300 text-transparent'
                }`}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <span className={`text-xs text-slate-700 leading-none ${isSelected ? 'font-bold text-indigo-900' : 'font-normal'}`}>
                    {opt}
                </span>
            </button>
        );
    });

    if (horizontal) {
        return (
            <div className={containerClass}>
                {content}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 col-span-2">
            {label && <label className="text-[10px] font-semibold text-slate-500">{label}</label>}
            <div className={containerClass}>
                {content}
            </div>
        </div>
    );
}
