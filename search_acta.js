import fs from 'fs';
import path from 'path';

const root = "C:/Users/canci/OneDrive/Documentos/ABANFOC SERVIDOR/OneDrive/Cosas de Francis/SALAMANDRA/Versiones/V.07.07.26.A";
const filePath = path.join(root, "src", "pdfGenerator.ts");
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
for (let i = 407; i < 2191; i++) {
  const line = lines[i];
  if (line.includes('layout') || line.includes('vertical') || line.includes('horizontal') || line.toLowerCase().includes('rociador')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
