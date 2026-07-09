import fs from 'fs';
import path from 'path';

const root = "C:/Users/canci/OneDrive/Documentos/ABANFOC SERVIDOR/OneDrive/Cosas de Francis/SALAMANDRA/Versiones/V.07.07.26.A";
const filePath = path.join(root, "src", "pdfGenerator.ts");
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('export const') || line.includes('generar')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
