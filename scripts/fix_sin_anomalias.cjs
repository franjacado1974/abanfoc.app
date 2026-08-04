const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\canci\\OneDrive\\Escritorio\\SALAMANDRA V.27.07.26.AQ\\src\\components\\RevisionSistemas';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

let count = 0;
files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    content = content.replace(
        /const valUpper = typeof val === 'string' \? val\.toUpperCase\(\)\.trim\(\) : '';\s*const isRed = valUpper\.includes\('NO CORRECTO'\) \|\| valUpper\.includes\('NO CONFORME'\) \|\| valUpper === 'INCORRECTO' \|\| valUpper\.includes\('ANOMAL'\) \|\| valUpper\.includes\('PENDIENTE'\) \|\| valUpper\.includes\('DEFECTO'\) \|\| valUpper\.includes\('FALLO'\) \|\| valUpper\.includes\('INOPERAT'\);\s*const isGreen = !isRed && \(valUpper\.includes\('CORRECTO'\) \|\| valUpper\.includes\('CONFORME'\) \|\| valUpper\.includes\('OPERAT'\) \|\| valUpper\.includes\('EN SERVICIO'\) \|\| valUpper === 'SI' \|\| valUpper === 'SÍ'\);/g,
        `const valUpper = typeof val === 'string' ? val.toUpperCase().trim() : '';
                                                                                                    const hasSinAnomalias = valUpper.includes('SIN ANOMAL');
                                                                                                    const isRed = !hasSinAnomalias && (valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || valUpper.includes('ANOMAL') || valUpper.includes('PENDIENTE') || valUpper.includes('DEFECTO') || valUpper.includes('FALLO') || valUpper.includes('INOPERAT'));
                                                                                                    const isGreen = !isRed && (valUpper.includes('CORRECTO') || valUpper.includes('CONFORME') || valUpper.includes('OPERAT') || valUpper.includes('EN SERVICIO') || valUpper.includes('FUNCIONAMIENTO') || hasSinAnomalias || valUpper === 'SI' || valUpper === 'SÍ');`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
        count++;
    } else {
        console.log(`No change in ${file}`);
    }
});

console.log(`Total files updated: ${count}`);
