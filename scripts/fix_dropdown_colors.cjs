const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\canci\\OneDrive\\Escritorio\\SALAMANDRA V.27.07.26.AQ\\src\\components\\RevisionSistemas';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

let count = 0;
files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Pattern 1: Select dropdown styling evaluation
    // Replace old simple check with comprehensive RED and GREEN check
    content = content.replace(
        /if\s*\(\s*valUpper\.includes\(['"]NO CORRECTO['"]\)\s*\|\|\s*valUpper\.includes\(['"]NO CONFORME['"]\)\s*\|\|\s*valUpper\s*===\s*['"]INCORRECTO['"]\s*\)\s*return\s*['"]bg-red-50 border-red-300 text-red-700 font-bold['"];?\s*if\s*\(\s*valUpper\.includes\(['"]CORRECTO['"]\)\s*\|\|\s*valUpper\.includes\(['"]CONFORME['"]\)\s*\)\s*return\s*['"]bg-green-50 border-green-300 text-green-700 font-bold['"];?/g,
        `const isRed = valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || valUpper.includes('ANOMAL') || valUpper.includes('PENDIENTE') || valUpper.includes('DEFECTO') || valUpper.includes('FALLO') || valUpper.includes('INOPERAT');
                                                                                                    const isGreen = !isRed && (valUpper.includes('CORRECTO') || valUpper.includes('CONFORME') || valUpper.includes('OPERAT') || valUpper.includes('EN SERVICIO') || valUpper === 'SI' || valUpper === 'SÍ');
                                                                                                    if (isRed) return 'bg-red-50 border-2 border-red-400 text-red-700 font-bold';
                                                                                                    if (isGreen) return 'bg-green-50 border-green-300 text-green-700 font-bold';`
    );

    // Pattern 2: optUpper checks in buttons
    content = content.replace(
        /if\s*\(\s*optUpper\.includes\(['"]NO CORRECTO['"]\)\s*\|\|\s*optUpper\.includes\(['"]NO CONFORME['"]\)\s*\|\|\s*optUpper\s*===\s*['"]INCORRECTO['"]\s*\)/g,
        `if (optUpper.includes('NO CORRECTO') || optUpper.includes('NO CONFORME') || optUpper === 'INCORRECTO' || optUpper.includes('ANOMAL') || optUpper.includes('PENDIENTE') || optUpper.includes('DEFECTO') || optUpper.includes('FALLO') || optUpper.includes('INOPERAT'))`
    );

    // Pattern 3: esIncorrecto / isFailed helper functions if any
    content = content.replace(
        /\(valStr === 'NO CORRECTO' \|\| valStr\.includes\('NO CORRECTO'\)\) \|\|\s*\(valStr === 'NO CONFORME' \|\| valStr\.includes\('NO CONFORME'\)\) \|\|\s*\(valStr === 'INCORRECTO'\) \|\|\s*\(valStr === 'NO'\)/g,
        `(valStr === 'NO CORRECTO' || valStr.includes('NO CORRECTO')) || (valStr === 'NO CONFORME' || valStr.includes('NO CONFORME')) || (valStr === 'INCORRECTO') || (valStr === 'NO') || valStr.includes('ANOMAL') || valStr.includes('PENDIENTE') || valStr.includes('DEFECTO') || valStr.includes('FALLO')`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated dropdown colors in ${file}`);
        count++;
    } else {
        console.log(`No match in ${file}`);
    }
});

console.log(`Total files updated: ${count}`);
