const fs = require('fs');

function fixProps(file) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Fix getCheckStats signature
    content = content.replace(
        /getCheckStats: \(eq: EquipoInstalado\) => \{ total: number; checked: number; pending: number; ok: number; fail: number; \};/g,
        'getCheckStats: (eq: EquipoInstalado) => { ok: number; fail: number; pending: number; };'
    );
    
    // Fix TS overlap again by using string replacement in case regex missed it
    content = content.replace(
        /item\.tipoRespuesta === 'pregunta-horizontal'/g,
        "(item.tipoRespuesta as string) === 'pregunta-horizontal'"
    );

    // Remove remaining unused imports
    content = content.replace(/Plus, /g, '');
    content = content.replace(/CheckCheck, /g, '');
    content = content.replace(/RotateCcw, /g, '');
    content = content.replace(/AlertTriangle, /g, '');

    fs.writeFileSync(file, content);
}

['SistemaExtintores.tsx', 'SistemaBies.tsx', 'SistemaDeteccion.tsx', 'SistemaGenerico.tsx'].forEach(f => {
    fixProps('src/components/RevisionSistemas/' + f);
});

console.log('Fixed TS errors step 2');
