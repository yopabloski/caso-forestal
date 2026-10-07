// Caso Forestal · MODO DEMO. Misma API que remote-store.js, sobre localStorage.
// Replica las reglas de Firestore que importan para el flujo (correo en la
// lista del curso, RUT al reclamar un correo, aplicación abierta, envío
// bloqueado) para que la demo se comporte como producción.

import { configInicial, APLICACION_IDS } from '../domain/modelo.js';
import { normalizarCodigo, dvRut } from '../domain/identidad.js';
import { VERSION, soloAutorizaciones, AUT_IDS } from '../domain/consentimiento.js';
import { VERSION_ENCUESTA, limpiarRespuestas, itemsDe, ALTERNATIVAS } from '../domain/encuesta.js';
import { cursoNuevo, MODULOS } from '../domain/curso.js';

const KEY = 'fcs:db';
const SESION = 'fcs:sesion';
const CURSO_PANEL = 'fcs:curso-panel';
let cursoActual = null;
let BASE = null;
const ahora = () => new Date().toISOString();

const LISTA_DEMO = [
  { correo: 'demo1@udd.cl', nombre: 'Estudiante Demo Uno', equipo: '01' },
  { correo: 'demo2@udd.cl', nombre: 'Estudiante Demo Dos', equipo: '01' },
  { correo: 'demo3@udd.cl', nombre: 'Estudiante Demo Tres', equipo: '02' },
  { correo: 'demo4@udd.cl', nombre: 'Estudiante Demo Cuatro', equipo: '02' }
];

function cursoBase(nombre = 'Curso demo', periodo = '2026-2', codigos = { 'DEMO-INICIO': 'inicio', 'DEMO-CIERRE': 'cierre', 'DEMO-VER': 'verificador' }) {
  const config = configInicial();
  config.aplicaciones.inicio.estado = 'abierta';
  return {
    config,
    codigos,
    lista: Object.fromEntries(LISTA_DEMO.map(f => [f.correo, f])),
    participantes: {},
    docente: null,
    sal: 'demo'
  };
}

function nuevaBase() {
  const a = cursoNuevo({ nombre: 'Optimización demo A', periodo: '2026-2' });
  const b = cursoNuevo({ nombre: 'Optimización demo B', periodo: '2026-2' });
  b.id = 'optimizacion-demo-b-2026-2';
  return { cursos: {
    [a.id]: { ...cursoBase(a.nombre, a.periodo, { 'DEMO-A-INICIO': 'inicio', 'DEMO-A-CIERRE': 'cierre', 'DEMO-A-VER': 'verificador' }), ...a },
    [b.id]: { ...cursoBase(b.nombre, b.periodo, { 'DEMO-B-INICIO': 'inicio', 'DEMO-B-CIERRE': 'cierre', 'DEMO-B-VER': 'verificador' }), ...b }
  }};
}

function leer() {
  try {
    BASE = JSON.parse(localStorage.getItem(KEY));
    if (BASE?.cursos) return activo();
  } catch {}
  BASE = nuevaBase(); escribir(); return activo();
}
function activo() {
  const ids = Object.keys(BASE.cursos);
  const elegido = cursoActual || localStorage.getItem(CURSO_PANEL) || ids[0];
  cursoActual = BASE.cursos[elegido] ? elegido : ids[0];
  return BASE.cursos[cursoActual];
}
function escribir(db) {
  try { localStorage.setItem(KEY, JSON.stringify(BASE)); } catch {}
  try { window.dispatchEvent(new CustomEvent('fcs:cambio')); } catch {}
}
const clon = x => JSON.parse(JSON.stringify(x));
const error = (code, message) => Object.assign(new Error(message), { code });

export const modo = 'demo';
if (typeof localStorage !== 'undefined') leer();

export function fijarCursoActual(curso) { if (!BASE?.cursos?.[curso]) throw error('curso', 'Curso no encontrado.'); cursoActual = curso; localStorage.setItem(CURSO_PANEL, curso); }
export function cursoActualId() { return cursoActual; }
export async function listarCursos() { leer(); return Object.values(BASE.cursos).map(({ participantes, lista, codigos, config, docente, sal, ...c }) => clon(c)); }
export async function crearCurso(datos) { leer(); const c = cursoNuevo(datos); if (BASE.cursos[c.id]) throw error('curso-existe', 'Ya existe ese curso.'); BASE.cursos[c.id] = { ...cursoBase(c.nombre, c.periodo, {}), ...c }; escribir(); return c; }
export async function guardarModulos(modulos) { const db = leer(); db.modulos = Object.fromEntries(MODULOS.map(m => [m, Boolean(modulos?.[m])])); escribir(); }

const MSG_RUT = 'Este correo ya está registrado con otro RUT. Revisa tu RUT o avisa al profesor.';
const MSG_LISTA = 'Este correo no está en la lista del curso. Revisa que sea tu correo @udd.cl o avisa al profesor.';
const publico = p => { const { respuestas, ...resto } = clon(p); return resto; };

// ---------- Estudiante ----------
export async function cargarConfig() { return clon(leer().config); }

export async function resolverCodigo(codigo) {
  const cod = normalizarCodigo(codigo); leer();
  for (const [curso, db] of Object.entries(BASE.cursos)) if (db.codigos[cod]) { fijarCursoActual(curso); return db.codigos[cod]; }
  return null;
}
export async function resolverCursoCodigo(codigo) { const aplicacion = await resolverCodigo(codigo); return aplicacion ? { curso: cursoActual, aplicacion, codigo: normalizarCodigo(codigo) } : null; }

export async function ingresar({ correo, rut, codigo }) {
  const db = leer();
  const cod = normalizarCodigo(codigo);
  const aplicacion = db.codigos[cod];
  if (!aplicacion) throw error('codigo-invalido', 'La clave del curso no es válida.');
  const ficha = db.lista[correo];
  if (!ficha) throw error('no-en-lista', MSG_LISTA);
  let p = db.participantes[correo];
  if (p && p.rut && p.rut !== rut) throw error('rut-no-coincide', MSG_RUT);
  if (!p) p = db.participantes[correo] = { correo, rut, creado: ahora(), respuestas: {} };
  if (!p.rut) p.rut = rut; // registro creado desde papel
  p.codigo = cod;
  p.ultimoIngreso = ahora();
  escribir(db);
  try { localStorage.setItem(SESION, JSON.stringify({ correo, codigo: cod, curso: cursoActual })); } catch {}
  return { participante: publico(p), aplicacion, ficha: clon(ficha), curso: cursoActual };
}

export async function sesionActual() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESION)); } catch {}
  if (!s?.correo) return null;
  if (s.curso) fijarCursoActual(s.curso);
  const db = leer();
  const p = db.participantes[s.correo];
  if (!p) return null;
  return { participante: publico(p), aplicacion: db.codigos[s.codigo] || null, codigo: s.codigo, ficha: clon(db.lista[s.correo] || null) };
}

export async function salir() { try { localStorage.removeItem(SESION); } catch {} }

export async function guardarConsentimiento(correo, decision, aplicacion = null) {
  const db = leer();
  const p = db.participantes[correo];
  if (!p) throw error('sin-participante', 'Sesión no válida.');
  const registro = { ...soloAutorizaciones(decision), fecha: ahora(), version: VERSION, aplicacion };
  p.consentimiento = registro;
  p.historialConsentimiento = [...(p.historialConsentimiento || []), registro];
  escribir(db);
  return clon(registro);
}

export async function respuestasDe(correo) {
  return clon(leer().participantes[correo]?.respuestas || {});
}

function escribirRespuesta(correo, aplicacion, equipo, respuestas, estado, { primera = false } = {}) {
  const db = leer();
  const p = db.participantes[correo];
  let codigo = null;
  try { codigo = JSON.parse(localStorage.getItem(SESION))?.codigo; } catch {}
  const previo = p?.respuestas?.[aplicacion];
  const permitido = p && p.consentimiento
    && db.config.aplicaciones[aplicacion]?.estado === 'abierta'
    && db.codigos[codigo] === aplicacion
    && db.lista[correo]?.equipo === equipo
    && previo?.estado !== 'enviado';
  if (!permitido) throw error('no-permitido', 'No fue posible guardar: la encuesta puede estar cerrada o ya fue enviada.');
  const t = ahora();
  p.respuestas[aplicacion] = {
    ...(previo || {}),
    aplicacion, equipo, codigo, estado, version: VERSION_ENCUESTA,
    respuestas: limpiarRespuestas(aplicacion, respuestas),
    actualizado: t,
    ...(estado === 'enviado' ? { enviado: t } : {}),
    ...(primera || !previo?.inicio ? { inicio: previo?.inicio || t } : {})
  };
  escribir(db);
}

export async function guardarRespuestas(c, a, eq, r, o) { escribirRespuesta(c, a, eq, r, 'borrador', o); }
export async function enviarRespuestas(c, a, eq, r, o) { escribirRespuesta(c, a, eq, r, 'enviado', o); }

// ---------- Docente ----------
export async function restaurarDocente() { return { uid: 'demo', email: 'modo demo' }; }
export async function entrarDocente() { return { uid: 'demo', email: 'modo demo' }; }
export async function salirDocente() {}

export async function guardarConfig(config) {
  const db = leer();
  db.config = clon(config);
  escribir(db);
}

export async function codigosVigentes() {
  const out = {};
  for (const [cod, ap] of Object.entries(leer().codigos)) out[ap] = cod;
  return out;
}

export async function fijarCodigo(aplicacion, codigo) {
  const cod = normalizarCodigo(codigo);
  if (cod.length < 4) throw error('codigo', 'La clave debe tener al menos 4 caracteres.');
  if (!['inicio', 'cierre', 'verificador', 'autoevaluacion', 'coevaluacion'].includes(aplicacion)) throw error('aplicacion', 'Aplicación desconocida.');
  const db = leer();
  if (db.codigos[cod] && db.codigos[cod] !== aplicacion) throw error('codigo-usado', 'Esa clave ya la usa la otra aplicación.');
  for (const [c, a] of Object.entries(db.codigos)) if (a === aplicacion) delete db.codigos[c];
  db.codigos[cod] = aplicacion;
  escribir(db);
  return cod;
}

export async function listarLista() { return Object.values(clon(leer().lista)); }

export async function cargarLista(filas) {
  const db = leer();
  db.lista = Object.fromEntries(filas.map(f => [f.correo, { correo: f.correo, nombre: f.nombre, equipo: f.equipo }]));
  escribir(db);
}

export async function listarParticipantes() {
  return Object.values(leer().participantes).map(p => ({ ...publico(p), dispositivos: p.rut ? 1 : 0 }));
}

export async function listarRespuestas() {
  const out = [];
  for (const p of Object.values(leer().participantes)) {
    for (const [clave, doc] of Object.entries(p.respuestas || {})) out.push({ correo: p.correo, clave, ...clon(doc) });
  }
  return out;
}

export async function reabrir(correo, aplicacion) {
  const db = leer();
  const doc = db.participantes[correo]?.respuestas?.[aplicacion];
  if (!doc) return;
  doc.estado = 'borrador';
  doc.reaperturas = [...(doc.reaperturas || []), { fecha: ahora(), por: 'modo demo' }];
  escribir(db);
}

export async function eliminarParticipante(correo) {
  const db = leer();
  delete db.participantes[correo];
  escribir(db);
}

export async function registrarRetiro(correo) {
  const db = leer();
  const p = db.participantes[correo];
  if (!p) return;
  const registro = { ...soloAutorizaciones({}), fecha: ahora(), version: VERSION, aplicacion: null, retiro: true };
  p.consentimiento = registro;
  p.historialConsentimiento = [...(p.historialConsentimiento || []), { ...registro, por: 'modo demo' }];
  escribir(db);
}

export async function digitarPapel({ correo, aplicacion, equipo, consentimiento, respuestas }) {
  const db = leer();
  let p = db.participantes[correo];
  if (!p) p = db.participantes[correo] = { correo, creado: ahora(), origen: 'papel', respuestas: {} };
  const t = ahora();
  if (consentimiento) {
    const registro = { ...soloAutorizaciones(consentimiento), fecha: t, version: VERSION, aplicacion, origen: 'papel' };
    p.consentimiento = registro;
    p.historialConsentimiento = [...(p.historialConsentimiento || []), { ...registro, por: 'modo demo' }];
  }
  p.respuestas[aplicacion] = {
    aplicacion, equipo, estado: 'enviado', version: VERSION_ENCUESTA, origen: 'papel', digitadoPor: 'modo demo',
    respuestas: limpiarRespuestas(aplicacion, respuestas), actualizado: t, enviado: t
  };
  escribir(db);
}

export async function leerDocente() { return clon(leer().docente); }
export async function guardarDocente(meta) {
  const db = leer();
  db.docente = { ...clon(meta), cargado: ahora() };
  escribir(db);
}
export async function salSeudonimos() { return leer().sal || 'demo'; }

export function suscribir(fn) {
  const h = () => fn();
  window.addEventListener('fcs:cambio', h);
  window.addEventListener('storage', h);
  return () => { window.removeEventListener('fcs:cambio', h); window.removeEventListener('storage', h); };
}

// ---------- Solo demo: datos de ejemplo ----------
function azar(semilla) { // mulberry32
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = ['Antonia', 'Benjamín', 'Catalina', 'Diego', 'Emilia', 'Felipe', 'Gabriela', 'Hernán', 'Isidora', 'Joaquín', 'Karina', 'Lucas', 'Martina', 'Nicolás', 'Olivia', 'Pedro', 'Renata', 'Sebastián', 'Trinidad', 'Vicente'];
const APELLIDOS = ['Araya', 'Bustos', 'Cárcamo', 'Durán', 'Escobar', 'Fuentes', 'Garrido', 'Henríquez', 'Inostroza', 'Jara', 'Leiva', 'Molina', 'Navarro', 'Olivares', 'Parra', 'Quezada', 'Riquelme', 'Sanhueza', 'Toledo', 'Urrutia', 'Vega', 'Zapata'];
const FRASES = {
  A1: ['Aprendí a pasar de un problema mal definido a un modelo que se puede resolver.', 'Lo más valioso fue entender el gap y cuándo detener el solver.', 'Trabajar con datos reales y tener que limpiarlos antes de modelar.', 'Ver que una restricción adicional tiene un costo que se puede medir.'],
  A2: ['El verificador mostró que la madera de un rodal no llegaba a ninguna salida.', 'Teníamos mal un índice en la restricción de flujo; lo vimos al revisar un rodal a mano.', 'Usamos un M demasiado grande y el solver no cerraba el gap.', 'Un camino aparecía construido dos veces; lo detectamos con el verificador.'],
  A3: ['Suponer que la madera podía repartirse entre las dos plantas.', 'El supuesto sobre la capacidad de las cuadrillas.', 'Asumir que los caminos no tienen capacidad.', 'Cómo tratamos el bosque en pie al final del horizonte.'],
  A4: ['Daría una semana más para la Parte D.', 'Entregaría antes la hoja de encargo.', 'Agregaría una clase de ayuda con OPL.', 'Nada, me pareció bien equilibrado.']
};

export async function sembrar() {
  const r = azar(20261007);
  const entero = (a, b) => a + Math.floor(r() * (b - a + 1));
  const elegir = arr => arr[Math.floor(r() * arr.length)];
  const acotar = v => Math.max(1, Math.min(5, Math.round(v)));
  const anterior = leer();
  const db = cursoBase(anterior.nombre, anterior.periodo, anterior.codigos);
  Object.assign(db, { id: cursoActual, nombre: anterior.nombre, periodo: anterior.periodo, modulos: anterior.modulos, creado: anterior.creado });
  db.docente = anterior.docente || null;
  const clave = db.docente?.clave || {};
  db.lista = {};
  let n = 0;
  for (let e = 1; e <= 14; e++) {
    const tam = e <= 11 ? 4 : 3;
    for (let k = 0; k < tam; k++) {
      n++;
      const nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
      const correo = `estudiante${String(n).padStart(2, '0')}@udd.cl`;
      db.lista[correo] = { correo, nombre, equipo: String(e).padStart(2, '0') };
    }
  }
  const dia = 24 * 3600 * 1000;
  const tInicio = Date.parse('2026-10-07T12:10:00Z');
  const tCierre = Date.parse('2026-11-19T15:00:00Z');
  const correos = Object.keys(db.lista);
  correos.forEach((correo, idx) => {
    const ficha = db.lista[correo];
    const cuerpo = String(19000000 + entero(0, 2999999));
    const hab = (r() - 0.5) * 1.6; // nivel general de la persona
    const respondeInicio = idx % 18 !== 5;
    const respondeCierre = idx % 9 !== 3;
    if (!respondeInicio && !respondeCierre) return;
    const aut = Object.fromEntries(AUT_IDS.map((k, i) => [k, r() < [0.9, 0.82, 0.86, 0.7, 0.8][i]]));
    if (idx % 13 === 7) AUT_IDS.forEach(k => { aut[k] = false; });
    const tC = (respondeInicio ? tInicio : tCierre) + entero(0, 500) * 1000;
    const consent = { ...aut, fecha: new Date(tC).toISOString(), version: VERSION, aplicacion: respondeInicio ? 'inicio' : 'cierre' };
    const p = db.participantes[correo] = {
      correo, rut: `${cuerpo}-${dvRut(cuerpo)}`, creado: consent.fecha, ultimoIngreso: consent.fecha,
      codigo: 'DEMO-INICIO', consentimiento: consent, historialConsentimiento: [consent], respuestas: {}
    };
    const generar = (aplicacion, mejora, base) => {
      const resp = {};
      for (const it of itemsDe(aplicacion)) {
        if (it.seccion === 'AE') {
          const nItem = Number(it.id.slice(2));
          resp[it.id] = acotar(2.3 + (nItem <= 2 ? 0.5 : 0) + hab + mejora * (0.35 + (nItem % 4) * 0.25) + (r() - 0.5) * 2.2);
        } else if (it.seccion === 'K') {
          const pOk = Math.min(0.92, 0.35 + mejora * 0.3 + hab * 0.12);
          const ok = clave[it.id];
          resp[it.id] = ok && r() < pOk ? ok : elegir(ok ? ALTERNATIVAS.filter(a => a !== ok) : ALTERNATIVAS);
        } else if (it.seccion === 'U') {
          resp[it.id] = acotar(3.9 + hab * 0.4 - (it.id === 'U6' ? 0.9 : 0) + (r() - 0.5) * 1.8);
        } else {
          resp[it.id] = elegir(FRASES[it.id]);
        }
      }
      const t0 = base + entero(60, 400) * 1000;
      p.respuestas[aplicacion] = {
        aplicacion, equipo: ficha.equipo, codigo: aplicacion === 'inicio' ? 'DEMO-INICIO' : 'DEMO-CIERRE', estado: 'enviado',
        version: VERSION_ENCUESTA, respuestas: resp,
        inicio: new Date(t0).toISOString(), actualizado: new Date(t0 + entero(240, 700) * 1000).toISOString(),
        enviado: new Date(t0 + entero(240, 700) * 1000).toISOString()
      };
    };
    if (respondeInicio) generar('inicio', 0, tInicio);
    if (respondeCierre) generar('cierre', 1, tCierre + entero(0, 1) * dia);
    if (idx === 11 && p.respuestas.inicio) { p.respuestas.inicio.origen = 'papel'; p.respuestas.inicio.digitadoPor = 'modo demo'; }
    if (idx === 20 && p.respuestas.cierre) { p.respuestas.cierre.estado = 'borrador'; delete p.respuestas.cierre.enviado; delete p.respuestas.cierre.respuestas.A4; }
  });
  db.config.aplicaciones.inicio.estado = 'cerrada';
  db.config.aplicaciones.cierre.estado = 'abierta';
  BASE.cursos[cursoActual] = db;
  escribir();
}

export async function vaciar() {
  const docente = leer().docente || null;
  BASE = nuevaBase();
  activo().docente = docente;
  escribir();
  try { localStorage.removeItem(SESION); } catch {}
}
