const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const srcHtml = path.join(__dirname, 'Editor_DWG_PCI.html');
const srcIco = path.join(__dirname, 'editor-dwg-pci.ico');

// 1. Obtener carpeta real del Escritorio de Windows
let desktopDir = '';
try {
  desktopDir = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"],
    { encoding: 'utf8' }
  ).trim();
} catch {}

if (!desktopDir || !fs.existsSync(desktopDir)) {
  const candidates = [
    path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'OneDrive', 'Escritorio'),
    path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'Desktop')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      desktopDir = c;
      break;
    }
  }
}

if (!desktopDir) {
  throw new Error('No se pudo localizar la carpeta del Escritorio de Windows.');
}

// 2. Guardar copia permanente autónoma en %LOCALAPPDATA%\EditorDWG_PCI
const localApp =
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\canci', 'AppData', 'Local');
const installDir = path.join(localApp, 'EditorDWG_PCI');
fs.mkdirSync(installDir, { recursive: true });

const installedHtml = path.join(installDir, 'Editor_DWG_PCI.html');
const installedIco = path.join(installDir, 'editor-dwg-pci.ico');
fs.copyFileSync(srcHtml, installedHtml);
fs.copyFileSync(srcIco, installedIco);

// 3. Detectar Chrome o Microsoft Edge para abrirlo en modo ventana de aplicación nativa (--app=...)
const browserCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

let appBrowserExe = '';
for (const b of browserCandidates) {
  if (fs.existsSync(b)) {
    appBrowserExe = b;
    break;
  }
}

const fileUrl = 'file:///' + installedHtml.replace(/\\/g, '/');
const shortcutPath = path.join(desktopDir, 'Editor DWG PCI.lnk');

const psCreateShortcut = appBrowserExe
  ? `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${appBrowserExe.replace(/'/g, "''")}'
$sc.Arguments = '--app="${fileUrl}"'
$sc.WorkingDirectory = '${installDir.replace(/'/g, "''")}'
$sc.IconLocation = '${installedIco.replace(/'/g, "''")},0'
$sc.Description = 'Editor independiente de planos AutoCAD DWG y simbologia PCI'
$sc.Save()
`
  : `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${installedHtml.replace(/'/g, "''")}'
$sc.WorkingDirectory = '${installDir.replace(/'/g, "''")}'
$sc.IconLocation = '${installedIco.replace(/'/g, "''")},0'
$sc.Description = 'Editor independiente de planos AutoCAD DWG y simbologia PCI'
$sc.Save()
`;

execFileSync('powershell.exe', ['-NoProfile', '-Command', psCreateShortcut], { stdio: 'inherit' });

console.log('Instalado en:', installDir);
console.log('Acceso directo creado en:', shortcutPath);
