// Caso Forestal · lectura de la lista del curso desde un CSV.
// Acepta el archivo de Canvas con equipos (nombre, login_id, group_name) y
// cualquier otro que tenga una columna de correos @udd.cl, una de nombres y
// una de equipos. El archivo se lee en el navegador del docente y se guarda
// en la base de datos: nunca va al repositorio.

import { normalizarCorreo, correoValido, normalizarNombre } from './identidad.js';
import { normalizarEquipo } from './modelo.js';

// CSV con comillas, separador , ; o tabulador, y BOM.
export function leerCSV(texto) {
  const t = String(texto || '').replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] || '';
  const cuenta = s => primera.split(s).length - 1;
  const sep = [';', '\t', ','].sort((a, b) => cuenta(b) - cuenta(a))[0];
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some(c => c.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some(c => c.trim() !== '')) filas.push(fila);
  return filas.map(f => f.map(c => c.trim()));
}

const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function interpretarLista(texto) {
  const filas = leerCSV(texto);
  if (filas.length < 2) return { filas: [], errores: ['El archivo no tiene filas de datos.'], columnas: null };
  const cab = filas[0].map(sinTildes);
  const datos = filas.slice(1);
  const proporcion = (j, fn) => datos.filter(f => fn(f[j] || '')).length / datos.length;

  // Correo: la columna con más valores @udd.cl.
  let cCorreo = -1, mejor = 0;
  cab.forEach((_, j) => { const p = proporcion(j, v => correoValido(v)); if (p > mejor) { mejor = p; cCorreo = j; } });
  // Equipo: por encabezado (group, equipo, grupo) y, si no, la columna donde todos parecen "Equipo NN".
  let cEquipo = cab.findIndex(h => /(^|_|\s)(group_name|equipo|grupo|group|team)(\s|_|$)/.test(h) || h === 'group_name');
  if (cEquipo < 0) cEquipo = cab.findIndex((_, j) => j !== cCorreo && proporcion(j, v => /^(equipo|grupo|team)?\s*\d{1,2}$/i.test(v)) > 0.9);
  // Nombre: por encabezado y, si no, la primera columna de texto con espacios.
  let cNombre = cab.findIndex(h => /^(nombre|name|estudiante|alumno|student)/.test(h));
  if (cNombre < 0) cNombre = cab.findIndex((_, j) => j !== cCorreo && j !== cEquipo && proporcion(j, v => /\S\s+\S/.test(v) && !/\d/.test(v)) > 0.8);

  const errores = [];
  if (cCorreo < 0) errores.push('No encontré una columna con correos @udd.cl.');
  if (cEquipo < 0) errores.push('No encontré la columna del equipo (por ejemplo group_name o equipo).');
  if (cNombre < 0) errores.push('No encontré la columna del nombre.');
  if (errores.length) return { filas: [], errores, columnas: null };

  const out = [], vistos = new Set();
  datos.forEach((f, i) => {
    const n = i + 2;
    const correo = normalizarCorreo(f[cCorreo]);
    const equipo = normalizarEquipo(f[cEquipo]);
    let nombre = normalizarNombre(f[cNombre]);
    // "Apellido, Nombre" (formato de Canvas) → "Nombre Apellido"
    const m = nombre.match(/^([^,]+),\s*(.+)$/);
    if (m) nombre = `${m[2]} ${m[1]}`;
    if (!correoValido(correo)) return errores.push(`Fila ${n}: el correo "${f[cCorreo] || ''}" no es @udd.cl.`);
    if (!equipo) return errores.push(`Fila ${n}: no reconozco el equipo "${f[cEquipo] || ''}".`);
    if (!nombre) return errores.push(`Fila ${n}: falta el nombre.`);
    if (vistos.has(correo)) return errores.push(`Fila ${n}: el correo ${correo} está repetido.`);
    vistos.add(correo);
    out.push({ correo, nombre, equipo });
  });
  return {
    filas: out.sort((a, b) => a.equipo.localeCompare(b.equipo) || a.nombre.localeCompare(b.nombre, 'es')),
    errores,
    columnas: { correo: filas[0][cCorreo], nombre: filas[0][cNombre], equipo: filas[0][cEquipo] }
  };
}

export function resumenEquipos(filas) {
  const m = new Map();
  for (const f of filas) m.set(f.equipo, (m.get(f.equipo) || 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([equipo, n]) => ({ equipo, n }));
}
