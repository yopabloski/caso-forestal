// Caso Forestal · bases de datos para descargar (completa y seudonimizada).

import { SECCIONES, SECCION, itemsDe } from './encuesta.js';
import { AUTORIZACIONES, AUT_IDS } from './consentimiento.js';
import { APLICACION_IDS } from './modelo.js';

// Seudónimo estable: FNV-1a de 32 bits sobre (sal + correo), en base 36.
// La sal vive en un documento que solo lee el docente; sin ella el código no
// se puede reconstruir a partir de la lista del curso.
export function idSeudonimo(correo, sal = '') {
  let h = 0x811c9dc5;
  const s = `${sal}|${String(correo).toLowerCase()}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'P' + h.toString(36).toUpperCase().padStart(7, '0');
}

const PREF = { inicio: 'INI', cierre: 'CIE' };
const siNo = v => v === true ? 1 : v === false ? 0 : '';

// Una fila por persona, formato ancho. Opciones:
//  - seudonimizar: quita correo, nombre y RUT; deja el código.
//  - soloAut: deja solo a quienes dieron esa autorización (por ejemplo 'a1').
//  - clave: si viene, agrega las columnas *_OK (1 correcta, 0 incorrecta).
export function construirBase({ personas, sal = '', seudonimizar = false, soloAut = null, clave = null }) {
  const filas = [];
  const cols = ['ID'];
  if (!seudonimizar) cols.push('CORREO', 'NOMBRE', 'RUT');
  cols.push('EQUIPO', 'EN_LISTA', ...AUT_IDS.map(k => `AUT${k.slice(1)}`), 'CONS_FECHA', 'CONS_VERSION', 'CONS_ORIGEN');
  for (const a of APLICACION_IDS) {
    const p = PREF[a];
    cols.push(`${p}_ESTADO`, `${p}_ORIGEN`, `${p}_ENVIADO`, `${p}_MINUTOS`);
    for (const it of itemsDe(a)) {
      cols.push(`${p}_${it.id}`);
      if (clave && it.seccion === 'K') cols.push(`${p}_${it.id}_OK`);
    }
    if (clave) cols.push(`${p}_K_TOTAL`);
  }
  for (const f of personas) {
    if (!f.participante && !f.inicio && !f.cierre) continue; // nunca ingresó
    if (soloAut && f.aut[soloAut] !== true) continue;
    const fila = { ID: idSeudonimo(f.correo, sal) };
    if (!seudonimizar) Object.assign(fila, { CORREO: f.correo, NOMBRE: f.nombre, RUT: f.participante?.rut || '' });
    fila.EQUIPO = f.equipo;
    fila.EN_LISTA = f.enLista ? 1 : 0;
    for (const k of AUT_IDS) fila[`AUT${k.slice(1)}`] = siNo(f.aut[k]);
    fila.CONS_FECHA = f.consentimiento?.fecha || '';
    fila.CONS_VERSION = f.consentimiento?.version || '';
    fila.CONS_ORIGEN = f.consentimiento ? (f.consentimiento.retiro ? 'retiro' : f.consentimiento.origen || 'web') : '';
    for (const a of APLICACION_IDS) {
      const p = PREF[a], doc = f[a];
      fila[`${p}_ESTADO`] = f.estado[a];
      fila[`${p}_ORIGEN`] = doc ? (doc.origen || 'web') : '';
      fila[`${p}_ENVIADO`] = doc?.enviado || '';
      const min = doc?.inicio && doc?.enviado && !doc.origen ? (Date.parse(doc.enviado) - Date.parse(doc.inicio)) / 60000 : null;
      fila[`${p}_MINUTOS`] = min !== null && Number.isFinite(min) ? Math.round(min * 10) / 10 : '';
      const r = doc?.estado === 'enviado' ? (doc.respuestas || {}) : {};
      let total = 0, completas = doc?.estado === 'enviado';
      for (const it of itemsDe(a)) {
        const v = r[it.id];
        fila[`${p}_${it.id}`] = v ?? '';
        if (clave && it.seccion === 'K') {
          fila[`${p}_${it.id}_OK`] = v ? (v === clave[it.id] ? 1 : 0) : '';
          if (!v) completas = false; else if (v === clave[it.id]) total++;
        }
      }
      if (clave) fila[`${p}_K_TOTAL`] = completas ? total : '';
    }
    filas.push(fila);
  }
  return { cols, filas };
}

// Llave de correspondencia código ↔ persona. Se guarda aparte de los datos.
export function llaveDeCorrespondencia(personas, sal = '') {
  return {
    cols: ['ID', 'CORREO', 'NOMBRE', 'EQUIPO'],
    filas: personas.filter(f => f.participante || f.inicio || f.cierre)
      .map(f => ({ ID: idSeudonimo(f.correo, sal), CORREO: f.correo, NOMBRE: f.nombre, EQUIPO: f.equipo }))
  };
}

// Preguntas abiertas en formato largo, con una columna vacía para el tema.
export function baseAbiertas({ personas, sal = '', soloAut = null }) {
  const filas = [];
  for (const it of SECCION.A.items) {
    for (const f of personas) {
      if (soloAut && f.aut[soloAut] !== true) continue;
      const t = f.cierre?.estado === 'enviado' ? (f.cierre.respuestas?.[it.id] || '').trim() : '';
      if (t) filas.push({ ID: idSeudonimo(f.correo, sal), EQUIPO: f.equipo, PREGUNTA: it.id, RESPUESTA: t, CITA_AUTORIZADA: siNo(f.aut.a4), TEMA: '' });
    }
  }
  return { cols: ['ID', 'EQUIPO', 'PREGUNTA', 'RESPUESTA', 'CITA_AUTORIZADA', 'TEMA'], filas };
}

export function libroDeCodigos(docente = null) {
  const filas = [
    { variable: 'ID', etiqueta: 'Código seudónimo estable de la persona', valores: '' },
    { variable: 'CORREO, NOMBRE, RUT', etiqueta: 'Identificación (solo en la base completa)', valores: '' },
    { variable: 'EQUIPO', etiqueta: 'Equipo del caso', valores: '01 a 14' },
    { variable: 'EN_LISTA', etiqueta: 'Está en la lista del curso', valores: '1 sí · 0 no' },
    ...AUTORIZACIONES.map(a => ({ variable: `AUT${a.id.slice(1)}`, etiqueta: a.texto, valores: '1 sí · 0 no · vacío = no ha decidido' })),
    { variable: 'CONS_FECHA', etiqueta: 'Fecha y hora de la decisión vigente (UTC)', valores: '' },
    { variable: 'CONS_VERSION', etiqueta: 'Versión del texto del consentimiento', valores: '' },
    { variable: 'CONS_ORIGEN', etiqueta: 'Cómo se registró la decisión', valores: 'web · papel · retiro' },
    { variable: 'INI_… / CIE_…', etiqueta: 'Prefijo de la aplicación: encuesta de inicio o de cierre', valores: '' },
    { variable: '*_ESTADO', etiqueta: 'Estado de la encuesta', valores: 'enviado · en-curso · pendiente' },
    { variable: '*_ORIGEN', etiqueta: 'Cómo se respondió', valores: 'web · papel' },
    { variable: '*_ENVIADO', etiqueta: 'Fecha y hora de envío (UTC)', valores: '' },
    { variable: '*_MINUTOS', etiqueta: 'Minutos entre la primera respuesta y el envío (solo web)', valores: '' }
  ];
  for (const s of SECCIONES) {
    for (const it of s.items) {
      const meta = docente?.items?.[it.id];
      filas.push({
        variable: it.id,
        etiqueta: (s.prefijo ? `${s.prefijo} ` : '') + it.texto,
        valores: s.tipo === 'likert' ? (s.escala === 'capacidad' ? '1 nada capaz … 5 totalmente capaz' : '1 muy en desacuerdo … 5 muy de acuerdo')
          : s.tipo === 'alternativas' ? Object.entries(it.alternativas).map(([k, v]) => `${k}) ${v}`).join(' · ') : 'texto',
        aplicaciones: s.aplicaciones.join(', '),
        parte: meta?.parte ? meta.parte.join(' y ') : '',
        resultado: meta?.ra || '',
        clave: docente?.clave?.[it.id] || ''
      });
      if (s.tipo === 'alternativas') filas.push({ variable: `${it.id}_OK`, etiqueta: `Respuesta correcta en ${it.id}`, valores: '1 correcta · 0 incorrecta', aplicaciones: s.aplicaciones.join(', ') });
    }
  }
  filas.push({ variable: '*_K_TOTAL', etiqueta: 'Número de respuestas correctas en conocimiento', valores: '0 a 4' });
  return { cols: ['variable', 'etiqueta', 'valores', 'aplicaciones', 'parte', 'resultado', 'clave'], filas };
}

// CSV con BOM y separador ; (se abre directo en Excel con configuración chilena).
export function aCSV({ cols, filas }, sep = ';') {
  const celda = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(sep), ...filas.map(f => cols.map(c => celda(f[c])).join(sep))].join('\r\n') + '\r\n';
}

export const aMatriz = ({ cols, filas }) => [cols, ...filas.map(f => cols.map(c => f[c] ?? ''))];
