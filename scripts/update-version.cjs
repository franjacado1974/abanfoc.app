#!/usr/bin/env node
/**
 * Script para actualizar la versión en App.tsx antes de cada deploy.
 * Formato: DD.MM.AA.HHmm.N  (N = correlativo del día, guardado en version-counter.json)
 */

const fs = require('fs');
const path = require('path');

// ── Calcular fecha/hora actual ─────────────────────────────────────────────
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yy = String(now.getFullYear()).slice(-2);
const HH = String(now.getHours()).padStart(2, '0');
const min = String(now.getMinutes()).padStart(2, '0');

const dateKey = `${dd}${mm}${yy}`; // clave del día para el contador

// ── Leer/actualizar contador correlativo ──────────────────────────────────
const counterFile = path.join(__dirname, 'version-counter.json');
let counter = { date: '', count: 0 };

if (fs.existsSync(counterFile)) {
  try { counter = JSON.parse(fs.readFileSync(counterFile, 'utf8')); } catch {}
}

if (counter.date !== dateKey) {
  counter = { date: dateKey, count: 1 };
} else {
  counter.count += 1;
}

fs.writeFileSync(counterFile, JSON.stringify(counter, null, 2));

// ── Construir cadena de versión ────────────────────────────────────────────
const version = `V${dd}.${mm}.${yy}.${HH}${min}.${String(counter.count).padStart(2, '0')}`;
console.log(`📦 Versión generada: ${version}`);

// ── Actualizar constants.ts ────────────────────────────────────────────────
const constantsFile = path.join(__dirname, '..', 'src', 'constants.ts');
let content = fs.readFileSync(constantsFile, 'utf8');

const updated = content.replace(
  /V\.\d{2}\.\d{2}\.\d{2}\.\w+/g,
  version
);

if (updated === content) {
  console.warn('⚠️  No se encontró el patrón de versión en constants.ts. Revisa el formato.');
} else {
  fs.writeFileSync(constantsFile, updated, 'utf8');
  console.log(`✅ constants.ts actualizado con versión: ${version}`);
}
