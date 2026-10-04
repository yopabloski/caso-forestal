// Caso Forestal · análisis de la encuesta (funciones puras, usadas por el
// panel y por las pruebas). Solo cuentan las respuestas ENVIADAS.

import { SECCION, ALTERNATIVAS, IDS } from './encuesta.js';
import { AUT_IDS } from './consentimiento.js';
import { APLICACION_IDS, estadoRespuesta } from './modelo.js';
import { media, desviacion, distribucion, wilcoxonPareado, mcnemarExacto, holm } from './estadistica.js';

const LIKERT = [1, 2, 3, 4, 5];

// Une lista del curso, participantes y respuestas en una fila por persona.
export function unir({ lista = [], participantes = [], respuestas = [] }) {
  const porCorreo = new Map();
  const base = correo => {
    if (!porCorreo.has(correo)) porCorreo.set(correo, { correo, nombre: '', equipo: '', enLista: false, participante: null, inicio: null, cierre: null });
    return porCorreo.get(correo);
  };
  for (const f of lista) Object.assign(base(f.correo), { nombre: f.nombre, equipo: f.equipo, enLista: true });
  for (const p of participantes) base(p.correo).participante = p;
  for (const r of respuestas) {
    if (!APLICACION_IDS.includes(r.clave)) continue;
    const f = base(r.correo);
    f[r.clave] = r;
    if (!f.equipo && r.equipo) f.equipo = r.equipo;
  }
  return [...porCorreo.values()].map(f => ({
    ...f,
    consentimiento: f.participante?.consentimiento || null,
    aut: Object.fromEntries(AUT_IDS.map(k => [k, f.participante?.consentimiento ? f.participante.consentimiento[k] === true : null])),
    estado: Object.fromEntries(APLICACION_IDS.map(a => [a, estadoRespuesta(f[a])]))
  })).sort((a, b) => (a.equipo || 'zz').localeCompare(b.equipo || 'zz') || a.nombre.localeCompare(b.nombre, 'es') || a.correo.localeCompare(b.correo));
}

// Respuestas enviadas de una persona en una aplicación (o null).
export const enviadas = (f, aplicacion) => f[aplicacion]?.estado === 'enviado' ? (f[aplicacion].respuestas || {}) : null;

// Filtro por autorización: los análisis para publicación usan solo a quienes
// dieron la autorización indicada (a1 para las encuestas).
export const conAutorizacion = (personas, aut = 'a1') => personas.filter(f => f.aut[aut] === true);

export function avance(personas) {
  const curso = personas.filter(f => f.enLista);
  const equipos = [...new Set(curso.map(f => f.equipo))].sort();
  const cuenta = (fs, a) => ({
    enviado: fs.filter(f => f.estado[a] === 'enviado').length,
    enCurso: fs.filter(f => f.estado[a] === 'en-curso').length,
    pendiente: fs.filter(f => f.estado[a] === 'pendiente').length
  });
  return {
    total: curso.length,
    registrados: curso.filter(f => f.participante).length,
    decidieron: curso.filter(f => f.consentimiento).length,
    autorizaciones: Object.fromEntries(AUT_IDS.map(k => [k, curso.filter(f => f.aut[k] === true).length])),
    pareados: curso.filter(f => f.estado.inicio === 'enviado' && f.estado.cierre === 'enviado').length,
    porAplicacion: Object.fromEntries(APLICACION_IDS.map(a => [a, cuenta(curso, a)])),
    porEquipo: equipos.map(e => {
      const fs = curso.filter(f => f.equipo === e);
      return { equipo: e, integrantes: fs, ...Object.fromEntries(APLICACION_IDS.map(a => [a, cuenta(fs, a)])) };
    }),
    faltan: Object.fromEntries(APLICACION_IDS.map(a => [a, curso.filter(f => f.estado[a] !== 'enviado')])),
    fueraDeLista: personas.filter(f => !f.enLista)
  };
}

function resumenLikert(xs) {
  return { n: xs.length, media: media(xs), de: desviacion(xs), dist: distribucion(xs, LIKERT) };
}

// Comparación pareada de una medida (función persona→valor en cada aplicación).
function comparar(personas, valor) {
  const ini = [], cie = [], parIni = [], parCie = [];
  for (const f of personas) {
    const a = valor(f, 'inicio'), b = valor(f, 'cierre');
    if (a !== null) ini.push(a);
    if (b !== null) cie.push(b);
    if (a !== null && b !== null) { parIni.push(a); parCie.push(b); }
  }
  return { ini, cie, parIni, parCie, prueba: wilcoxonPareado(parIni, parCie) };
}

// Autoeficacia: por ítem y, si está cargado el archivo docente, por parte.
export function autoeficacia(personas, docente = null) {
  const sec = SECCION.AE;
  const likert = (f, a, id) => { const r = enviadas(f, a); const v = r?.[id]; return Number.isInteger(v) ? v : null; };
  const items = sec.items.map(it => {
    const c = comparar(personas, (f, a) => likert(f, a, it.id));
    return {
      id: it.id, texto: it.texto,
      parte: docente?.items?.[it.id]?.parte || null, ra: docente?.items?.[it.id]?.ra || null,
      inicio: resumenLikert(c.ini), cierre: resumenLikert(c.cie),
      pareado: { ...c.prueba, n: c.parIni.length, nDif: c.prueba.n, mediaInicio: media(c.parIni), mediaCierre: media(c.parCie) }
    };
  });
  const ajustados = holm(items.map(i => i.pareado.p));
  items.forEach((i, k) => { i.pareado.pHolm = ajustados[k]; });

  const promedio = (f, a, ids) => {
    const vs = ids.map(id => likert(f, a, id));
    return vs.some(v => v === null) ? null : media(vs);
  };
  const compuesto = (nombre, ids) => {
    const c = comparar(personas, (f, a) => promedio(f, a, ids));
    return {
      nombre, ids,
      inicio: { n: c.ini.length, media: media(c.ini), de: desviacion(c.ini) },
      cierre: { n: c.cie.length, media: media(c.cie), de: desviacion(c.cie) },
      pareado: { ...c.prueba, n: c.parIni.length, nDif: c.prueba.n, mediaInicio: media(c.parIni), mediaCierre: media(c.parCie) }
    };
  };
  let partes = null;
  if (docente?.items) {
    const nombres = [...new Set(sec.items.flatMap(it => docente.items[it.id]?.parte || []))].sort();
    partes = nombres.map(p => compuesto(`Parte ${p}`, sec.items.filter(it => (docente.items[it.id]?.parte || []).includes(p)).map(it => it.id)));
    const adj = holm(partes.map(p => p.pareado.p));
    partes.forEach((p, k) => { p.pareado.pHolm = adj[k]; });
  }
  return { items, partes, total: compuesto('Escala completa', sec.items.map(i => i.id)) };
}

// Conocimiento: distribución por alternativa y, con la clave, proporción de
// respuestas correctas y prueba de McNemar con las respuestas pareadas.
export function conocimiento(personas, clave = null) {
  const sec = SECCION.K;
  const alt = (f, a, id) => { const r = enviadas(f, a); return ALTERNATIVAS.includes(r?.[id]) ? r[id] : null; };
  const items = sec.items.map(it => {
    const ini = personas.map(f => alt(f, 'inicio', it.id)).filter(v => v !== null);
    const cie = personas.map(f => alt(f, 'cierre', it.id)).filter(v => v !== null);
    const ok = clave?.[it.id] || null;
    const out = {
      id: it.id, texto: it.texto, alternativas: it.alternativas, clave: ok,
      inicio: { n: ini.length, dist: distribucion(ini, ALTERNATIVAS), correctas: ok ? ini.filter(v => v === ok).length : null },
      cierre: { n: cie.length, dist: distribucion(cie, ALTERNATIVAS), correctas: ok ? cie.filter(v => v === ok).length : null },
      pareado: null
    };
    if (ok) {
      let n = 0, okIni = 0, okCie = 0, b = 0, c = 0;
      for (const f of personas) {
        const x = alt(f, 'inicio', it.id), y = alt(f, 'cierre', it.id);
        if (x === null || y === null) continue;
        n++;
        if (x === ok) okIni++;
        if (y === ok) okCie++;
        if (x !== ok && y === ok) b++;
        if (x === ok && y !== ok) c++;
      }
      out.pareado = { n, correctasInicio: okIni, correctasCierre: okCie, ...mcnemarExacto(b, c), pares: n };
    }
    return out;
  });
  let total = null;
  if (clave) {
    const adj = holm(items.map(i => i.pareado?.p ?? null));
    items.forEach((i, k) => { if (i.pareado) i.pareado.pHolm = adj[k]; });
    const puntaje = (f, a) => {
      const vs = sec.items.map(it => alt(f, a, it.id));
      return vs.some(v => v === null) ? null : sec.items.filter((it, k) => vs[k] === clave[it.id]).length;
    };
    const c = comparar(personas, puntaje);
    total = {
      max: sec.items.length,
      inicio: { n: c.ini.length, media: media(c.ini), de: desviacion(c.ini) },
      cierre: { n: c.cie.length, media: media(c.cie), de: desviacion(c.cie) },
      pareado: { ...c.prueba, n: c.parIni.length, nDif: c.prueba.n, mediaInicio: media(c.parIni), mediaCierre: media(c.parCie) }
    };
  }
  return { items, total };
}

// Valoración del caso (solo cierre).
export function valoracion(personas) {
  return SECCION.U.items.map(it => {
    const xs = personas.map(f => enviadas(f, 'cierre')?.[it.id]).filter(Number.isInteger);
    return { id: it.id, texto: it.texto, ...resumenLikert(xs), deAcuerdo: xs.filter(v => v >= 4).length };
  });
}

// Preguntas abiertas (solo cierre), para codificar por tema.
export function abiertas(personas, idDe = f => f.correo) {
  return SECCION.A.items.map(it => ({
    id: it.id, texto: it.texto,
    respuestas: personas
      .map(f => ({ id: idDe(f), equipo: f.equipo, texto: (enviadas(f, 'cierre')?.[it.id] || '').trim(), citable: f.aut.a4 === true }))
      .filter(r => r.texto)
  }));
}

// Archivo docente: { version, clave: { K1: letra, … }, items: { AE1: { parte: [letras], ra: texto }, … } }
export function validarDocente(meta) {
  const errores = [];
  if (!meta || typeof meta !== 'object') return ['El archivo no tiene el formato esperado.'];
  const clave = meta.clave || {};
  for (const it of SECCION.K.items) {
    if (!ALTERNATIVAS.includes(clave[it.id])) errores.push(`Falta la clave de ${it.id} (a, b, c o d).`);
  }
  for (const [id, v] of Object.entries(meta.items || {})) {
    if (!IDS.includes(id)) errores.push(`El ítem ${id} no existe en la encuesta.`);
    if (v.parte && !Array.isArray(v.parte)) errores.push(`La parte de ${id} debe ser una lista, por ejemplo ["B","C"].`);
  }
  return errores;
}
