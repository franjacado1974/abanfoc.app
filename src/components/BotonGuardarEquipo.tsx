interface BotonGuardarEquipoProps {
    eqId: string;
    getEquipoSyncStatus?: (equipoId: string) => string;
    handleGuardarEquipoManual?: (equipoId: string) => void | Promise<void>;
}

export default function BotonGuardarEquipo({
    eqId,
    getEquipoSyncStatus,
    handleGuardarEquipoManual
}: BotonGuardarEquipoProps) {
    if (!handleGuardarEquipoManual) return null;

    const status = getEquipoSyncStatus ? getEquipoSyncStatus(eqId) : 'pending';

    if (status === 'saving') {
        return (
            <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600/80 text-white rounded-lg text-xs font-semibold shadow-sm cursor-wait animate-pulse"
            >
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Guardando...</span>
            </button>
        );
    }

    if (status === 'saved') {
        return (
            <button
                type="button"
                onClick={() => handleGuardarEquipoManual(eqId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                title="Equipo guardado correctamente en Firestore. Clic para forzar nuevo guardado."
            >
                <span>✓ Guardado</span>
            </button>
        );
    }

    if (status === 'offline') {
        return (
            <button
                type="button"
                onClick={() => handleGuardarEquipoManual(eqId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                title="Guardado de forma segura en almacenamiento local (Offline). Se sincronizará automáticamente al recuperar la conexión."
            >
                <span>✓ Guardado en local (Offline)</span>
            </button>
        );
    }

    // Estado 'pending' o por defecto: Azul "Guardar"
    return (
        <button
            type="button"
            onClick={() => handleGuardarEquipoManual(eqId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
            title="Guardar datos de este equipo"
        >
            <span>Guardar</span>
        </button>
    );
}
