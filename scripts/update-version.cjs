#!/usr/bin/env node
/**
 * Script para actualizar la versión en constants.ts antes de cada deploy.
 * Formato: V.DD.MM.YY.LETRA  (LETRA = A, B, C... correlativo del día)
 * Ejemplo: V.14.06.26.A
 */

const fs = require('fs');
const path = require('path');

// ── Ejecutar Verificación de Blindaje Obligatorio (AGENTS.md REGLA 6) ────────
require('./verify-safeguards.cjs');

// ── Calcular fecha actual ──────────────────────────────────────────────────
const now = new Date();
const dd = String(now.getDate()).padStart(2, '0');
const mm = String(now.getMonth() + 1).padStart(2, '0');
const yy = String(now.getFullYear()).slice(-2);

const dateKey = `${dd}${mm}${yy}`; // clave del día para el contador

// ── Leer/actualizar contador correlativo ──────────────────────────────────
const counterFile = path.join(__dirname, 'version-counter.json');
let counter = { date: '', count: 0 };

if (fs.existsSync(counterFile)) {
  try { counter = JSON.parse(fs.readFileSync(counterFile, 'utf8')); } catch {}
}

if (counter.date !== dateKey) {
  // Nuevo día, reiniciar contador
  counter = { date: dateKey, count: 0 };
} else {
  // Mismo día, incrementar
  counter.count += 1;
}

fs.writeFileSync(counterFile, JSON.stringify(counter, null, 2));

// ── Convertir número a letra (0=A, 1=B, 2=C, ..., 25=Z, 26=AA, 27=AB...) ──
function numberToLetter(num) {
  let result = '';
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

const letra = numberToLetter(counter.count);

// ── Construir cadena de versión ────────────────────────────────────────────
const version = `V.${dd}.${mm}.${yy}.${letra}`;
console.log(`📦 Versión generada: ${version}`);

// ── Actualizar constants.ts ────────────────────────────────────────────────
const constantsFile = path.join(__dirname, '..', 'src', 'constants.ts');
let content = fs.readFileSync(constantsFile, 'utf8');

const updated = content.replace(
  /V\.\d{2}\.\d{2}\.\d{2}\.[A-Z]+/g,
  version
);

if (updated === content) {
  console.warn('⚠️  No se encontró el patrón de versión en constants.ts. Revisa el formato.');
} else {
  fs.writeFileSync(constantsFile, updated, 'utf8');
  console.log(`✅ constants.ts actualizado con versión: ${version}`);
}

// ── Actualizar version.json en public ──────────────────────────────────────
try {
  const versionFile = path.join(__dirname, '..', 'public', 'version.json');
  fs.writeFileSync(versionFile, JSON.stringify({ version }, null, 2), 'utf8');
  console.log(`✅ public/version.json actualizado con versión: ${version}`);
} catch (err) {
  console.error('⚠️  Error al escribir public/version.json:', err);
}
