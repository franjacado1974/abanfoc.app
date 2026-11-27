const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const assetsDir = path.join(distDir, 'assets');
const files = fs.readdirSync(assetsDir);

const cssContent = files
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n');

const jsContent = files
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Editor de Planos DWG · Simbología Contra Incendios</title>
    <style>${cssContent}</style>
  </head>
  <body class="m-0 p-0 overflow-hidden bg-slate-100">
    <div id="root"></div>
    <script type="module">${jsContent}</script>
  </body>
</html>
`;

const outPath = path.join(__dirname, 'Editor_DWG_PCI.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Generado archivo portable autonomo:', outPath, Math.round(html.length / 1024), 'KB');
