const fs = require('fs');

function fixOverlap(file) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(
        /item.tipoRespuesta === 'pregunta-horizontal'/g,
        "(item.tipoRespuesta as string) === 'pregunta-horizontal'"
    );
    fs.writeFileSync(file, content);
}

['SistemaExtintores.tsx', 'SistemaBies.tsx', 'SistemaDeteccion.tsx', 'SistemaGenerico.tsx'].forEach(f => {
    fixOverlap('src/components/RevisionSistemas/' + f);
});

console.log('Fixed overlap errors');
