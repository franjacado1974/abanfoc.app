const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\canci\\OneDrive\\Escritorio\\SALAMANDRA V.27.07.26.AQ\\src\\components\\RevisionSistemas';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

let count = 0;
files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 1. Fix multi-select intercept so it never catches "quedó" / "comprobaciones" questions
    content = content.replace(
        /const labelUpperAbast = \(item\.label \|\| ''\)\.toUpperCase\(\);\s*if \(labelUpperAbast\.includes\('ABASTECE'\) \|\| labelUpperAbast\.includes\('INSTALACIONES QUE ABASTECE'\)\)/g,
        `const labelUpperAbast = (item.label || '').toUpperCase();
                                                                              const isAbastecePregunta = (labelUpperAbast.includes('ABASTECE') || labelUpperAbast.includes('INSTALACIONES QUE ABASTECE')) && !labelUpperAbast.includes('QUEDO') && !labelUpperAbast.includes('QUEDÓ') && !labelUpperAbast.includes('COMPROBACIONES');
                                                                              if (isAbastecePregunta)`
    );

    content = content.replace(
        /\(item\.label \|\| ''\)\.toUpperCase\(\)\.includes\('ABASTECE'\) \|\| \(item\.label \|\| ''\)\.toUpperCase\(\)\.includes\('INSTALACIONES'\)/g,
        `((item.label || '').toUpperCase().includes('ABASTECE') || (item.label || '').toUpperCase().includes('INSTALACIONES QUE ABASTECE')) && !(item.label || '').toUpperCase().includes('QUEDO') && !(item.label || '').toUpperCase().includes('QUEDÓ') && !(item.label || '').toUpperCase().includes('COMPROBACIONES')`
    );

    // 2. Ensure select dropdown evaluation handles "CON ANOMALÍAS PENDIENTES DE CORREGIR" and "CORRECTA Y EN SERVICIO"
    content = content.replace(
        /const valUpper = typeof val === 'string' \? val\.toUpperCase\(\)\.trim\(\) : '';\s*if \(valUpper\.includes\('NO CORRECTO'\) \|\| valUpper\.includes\('NO CONFORME'\) \|\| valUpper === 'INCORRECTO'\) return 'bg-red-50 border-red-300 text-red-700 font-bold';\s*if \(valUpper\.includes\('CORRECTO'\) \|\| valUpper\.includes\('CONFORME'\)\) return 'bg-green-50 border-green-300 text-green-700 font-bold';/g,
        `const valUpper = typeof val === 'string' ? val.toUpperCase().trim() : '';
                                                                                                    const isRed = valUpper.includes('NO CORRECTO') || valUpper.includes('NO CONFORME') || valUpper === 'INCORRECTO' || valUpper.includes('ANOMAL') || valUpper.includes('PENDIENTE') || valUpper.includes('DEFECTO') || valUpper.includes('FALLO') || valUpper.includes('INOPERAT');
                                                                                                    const isGreen = !isRed && (valUpper.includes('CORRECTO') || valUpper.includes('CONFORME') || valUpper.includes('OPERAT') || valUpper.includes('EN SERVICIO') || valUpper === 'SI' || valUpper === 'SÍ');
                                                                                                    if (isRed) return 'bg-red-50 border-2 border-red-400 text-red-700 font-bold';
                                                                                                    if (isGreen) return 'bg-green-50 border-green-300 text-green-700 font-bold';`
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
