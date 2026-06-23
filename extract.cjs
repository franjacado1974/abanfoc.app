const fs = require('fs');
const content = fs.readFileSync('src/RevisionChecklist.tsx', 'utf-8');
const lines = content.split('\n');

const startList = lines.findIndex(l => l.includes('filteredEqs.map((eq, i) => {'));
const endList = lines.findIndex((l, idx) => idx > startList && l.includes(');') && lines[idx-1] && lines[idx-1].includes('</div>') && lines[idx-2] && lines[idx-2].includes('</div>'));

console.log('Found map from', startList, 'to', endList);

const innerMap = lines.slice(startList, endList + 1).join('\n');

const imports = `import React from 'react';
import { CheckCircle2, XCircle, X, CheckCheck, RotateCcw, AlertTriangle, Pencil, Trash2, Plus } from 'lucide-react';
import type { CentroSistema, EquipoInstalado, Parte } from '../../Centros';
import { updateEquipoInstalado, updateParte as updateParteFirestore, uploadFile, type ChecklistItem } from '../../firebase';

interface Props {
    sist: CentroSistema;
    filteredEqs: EquipoInstalado[];
    equiposInstalados: EquipoInstalado[];
    setEquiposInstalados: React.Dispatch<React.SetStateAction<EquipoInstalado[]>>;
    saveEquiposProgress: (currentEquipos?: EquipoInstalado[]) => Promise<void>;
    getItemsToUse: (sistemaId: string) => ChecklistItem[];
    parte: Parte | null;
    parteId: string | undefined;
    updateParte: (updates: Partial<Parte>) => void;
    showToast: (msg: string) => void;
    setEditEquipo: (equipoId: string) => void;
    handleDeleteEquipo: (equipoId: string) => void;
    handleCheckChange: (equipoId: string, itemKey: string, value: any, itemName?: string) => void;
    getCheckStats: (eq: EquipoInstalado) => { total: number; checked: number; pending: number; ok: number; fail: number };
}

export default function COMPONENT_NAME({
    sist,
    filteredEqs,
    equiposInstalados,
    setEquiposInstalados,
    saveEquiposProgress,
    getItemsToUse,
    parte,
    parteId,
    updateParte,
    showToast,
    setEditEquipo,
    handleDeleteEquipo,
    handleCheckChange,
    getCheckStats
}: Props) {
    return (
        <>
            {${innerMap}}
        </>
    );
}
`;

const systems = ['SistemaGenerico', 'SistemaExtintores', 'SistemaBies', 'SistemaDeteccion'];
for (const sys of systems) {
    fs.writeFileSync('src/components/RevisionSistemas/' + sys + '.tsx', imports.replace('COMPONENT_NAME', sys));
}
console.log('Components generated.');
