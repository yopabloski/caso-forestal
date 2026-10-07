// Caso Forestal · adaptador Firestore. Misma API que local-store.js.
// El SDK se carga desde el CDN de Google (sin bundler). Los estudiantes usan
// autenticación anónima; la identidad es el correo que escriben, que debe
// estar en la lista del curso y queda protegido por la clave del curso y por
// el RUT al reclamarlo desde otro dispositivo (ver firestore.rules).

import { firebaseConfig, SDK, useEmulators, emulatorPorts, paths } from './firebase-config.js';
import { normalizarCodigo } from '../domain/identidad.js';
import { VERSION, soloAutorizaciones } from '../domain/consentimiento.js';
import { VERSION_ENCUESTA, limpiarRespuestas } from '../domain/encuesta.js';
import { configInicial, APLICACION_IDS } from '../domain/modelo.js';
import { rutasCurso } from '../domain/rutas-curso.js';
import { cursoNuevo, MODULOS } from '../domain/curso.js';

export const modo = 'firebase';
const SESION = 'fcs:sesion';
let cursoActual = null;

let fb = null;
async function sdk() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]);
  const instancia = app.initializeApp(firebaseConfig);
  const a = auth.getAuth(instancia);
  const db = fs.getFirestore(instancia);
  if (useEmulators) {
    auth.connectAuthEmulator(a, `http://localhost:${emulatorPorts.auth}`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, 'localhost', emulatorPorts.firestore);
  }
  fb = { app: instancia, auth: a, db, A: auth, F: fs };
  return fb;
}

const usuarioActual = auth => new Promise(res => {
  const off = auth.onAuthStateChanged(u => { off(); res(u); });
});

async function anonimo() {
  const { auth, A } = await sdk();
  const u = auth.currentUser || await usuarioActual(auth);
  if (u) return u;
  return (await A.signInAnonymously(auth)).user;
}

const iso = v => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : (v ?? null);
function plano(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (typeof obj.toDate === 'function') return iso(obj);
  if (Array.isArray(obj)) return obj.map(plano);
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, plano(v)]));
}
const error = (code, message) => Object.assign(new Error(message), { code });
const denegado = e => e?.code === 'permission-denied';
const publico = d => { const { uids, rutIntento, ...resto } = plano(d); return resto; };

// El alumno nunca selecciona un curso: la clave lo resuelve primero en este
// índice. El resto del cliente usa el mismo contexto hasta cerrar sesión.
export async function resolverCursoCodigo(codigo) {
  const cod = normalizarCodigo(codigo);
  if (!cod) return null;
  const { db, F } = await sdk();
  await anonimo();
  const snap = await F.getDoc(F.doc(db, paths.indiceCodigos, cod));
  if (!snap.exists()) return null;
  const dato = plano(snap.data());
  if (!dato?.curso || !['inicio', 'cierre', 'verificador', 'autoevaluacion', 'coevaluacion'].includes(dato.aplicacion)) return null;
  return { curso: rutasCurso(dato.curso).curso, aplicacion: dato.aplicacion, codigo: cod };
}

export function fijarCursoActual(curso) { cursoActual = rutasCurso(curso).curso; }
export function cursoActualId() { return cursoActual; }
function rutas() {
  if (!cursoActual) throw error('curso-no-seleccionado', 'Selecciona un curso en el panel.');
  return rutasCurso(cursoActual);
}
const ref = (F, db, segmentos) => F.doc(db, ...segmentos);

export async function listarCursos() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, paths.cursos));
  return snap.docs.map(d => ({ id: d.id, ...plano(d.data()) })).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

export async function crearCurso(datos) {
  const curso = cursoNuevo(datos);
  const { db, F } = await sdk();
  const ref = F.doc(db, paths.cursos, curso.id);
  if ((await F.getDoc(ref)).exists()) throw error('curso-existe', 'Ya existe un curso con ese identificador.');
  await F.setDoc(ref, { ...curso, creado: F.serverTimestamp() });
  return curso;
}
export async function guardarModulos(modulos) {
  const { db, F } = await sdk();
  await F.updateDoc(F.doc(db, paths.cursos, rutas().curso), { modulos: Object.fromEntries(MODULOS.map(m => [m, Boolean(modulos?.[m])])), actualizado: F.serverTimestamp() });
}

const LISTA_FICTICIA = [
  ['ana.prueba@udd.cl', 'Ana Prueba', '01'], ['bruno.prueba@udd.cl', 'Bruno Prueba', '01'],
  ['carla.prueba@udd.cl', 'Carla Prueba', '02'], ['diego.prueba@udd.cl', 'Diego Prueba', '02'],
  ['elena.prueba@udd.cl', 'Elena Prueba', '03'], ['felipe.prueba@udd.cl', 'Felipe Prueba', '03']
].map(([correo, nombre, equipo]) => ({ correo, nombre, equipo }));

export async function cargarCursoFicticio() {
  const curso = { ...cursoNuevo({ nombre: 'Curso de prueba ficticio', periodo: '2026-2' }), prueba: true };
  const { db, F } = await sdk();
  const cursoRef = F.doc(db, paths.cursos, curso.id);
  const existente = await F.getDoc(cursoRef);
  if (existente.exists()) { fijarCursoActual(curso.id); return { id: curso.id, ...plano(existente.data()) }; }
  const r = rutasCurso(curso.id);
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  const codigos = { inicio: `PRUEBA-${sufijo}-INI`, cierre: `PRUEBA-${sufijo}-CIE` };
  const config = configInicial();
  config.aplicaciones.inicio.estado = 'abierta';
  config.aplicaciones.cierre.estado = 'abierta';
  const batch = F.writeBatch(db);
  batch.set(cursoRef, { ...curso, creado: F.serverTimestamp() });
  batch.set(ref(F, db, r.config), { ...config, actualizado: F.serverTimestamp() });
  batch.set(ref(F, db, r.privado.concat('codigos')), codigos);
  for (const fila of LISTA_FICTICIA) batch.set(ref(F, db, r.lista.concat(fila.correo)), fila);
  for (const [aplicacion, codigo] of Object.entries(codigos)) {
    batch.set(ref(F, db, r.codigos.concat(codigo)), { aplicacion });
    batch.set(F.doc(db, paths.indiceCodigos, codigo), { curso: curso.id, aplicacion });
  }
  await batch.commit();
  fijarCursoActual(curso.id);
  return curso;
}

export async function eliminarCursoFicticio() {
  const { db, F } = await sdk();
  const r = rutas();
  const cursoRef = F.doc(db, paths.cursos, r.curso);
  const curso = await F.getDoc(cursoRef);
  if (!curso.exists() || !curso.data().prueba) throw error('curso-no-ficticio', 'Solo se pueden eliminar desde aquí los cursos ficticios de prueba.');
  const batch = F.writeBatch(db);
  const codigos = await F.getDocs(F.collection(db, ...r.codigos));
  codigos.forEach(d => { batch.delete(d.ref); batch.delete(F.doc(db, paths.indiceCodigos, d.id)); });
  for (const ruta of [r.lista, r.privado, r.verificaciones]) (await F.getDocs(F.collection(db, ...ruta))).forEach(d => batch.delete(d.ref));
  const participantes = await F.getDocs(F.collection(db, ...r.participantes));
  for (const p of participantes.docs) {
    (await F.getDocs(F.collection(db, ...r.respuestas(p.id)))).forEach(d => batch.delete(d.ref));
    batch.delete(p.ref);
  }
  batch.delete(ref(F, db, r.config));
  batch.delete(cursoRef);
  await batch.commit();
  cursoActual = null;
}

// ---------- Estudiante ----------
export async function cargarConfig() {
  const { db, F } = await sdk();
  const snap = await F.getDoc(ref(F, db, rutas().config));
  return snap.exists() ? { ...configInicial(), ...plano(snap.data()) } : configInicial();
}

export async function resolverCodigo(codigo) {
  const encontrado = await resolverCursoCodigo(codigo);
  if (!encontrado) return null;
  fijarCursoActual(encontrado.curso);
  return encontrado.aplicacion;
}

async function fichaDe(correo) {
  const { db, F } = await sdk();
  const snap = await F.getDoc(ref(F, db, rutas().lista.concat(correo)));
  return snap.exists() ? plano(snap.data()) : null;
}

export async function ingresar({ correo, rut, codigo }) {
  const cod = normalizarCodigo(codigo);
  const aplicacion = await resolverCodigo(cod);
  if (!aplicacion) throw error('codigo-invalido', 'La clave del curso no es válida.');
  const { db, F } = await sdk();
  const user = await anonimo();
  const r = rutas();
  const participanteRef = ref(F, db, r.participante(correo));
  const alta = {
    correo, rut, codigo: cod, uids: [user.uid],
    creado: F.serverTimestamp(), ultimoIngreso: F.serverTimestamp()
  };
  try {
    // El primer ingreso no necesita leer antes el documento (que por diseño
    // es privado): intenta crearlo directamente.
    await F.setDoc(participanteRef, alta);
  } catch (e) {
    if (!denegado(e)) throw e;
    // Si ya existía, las reglas permiten reclamarlo solo al repetir el RUT.
    try {
      await F.updateDoc(participanteRef, {
        uids: F.arrayUnion(user.uid), rutIntento: rut, codigo: cod, ultimoIngreso: F.serverTimestamp()
      });
    } catch (reclamo) {
      if (!denegado(reclamo)) throw reclamo;
      // ¿Registro creado por el docente desde papel (sin RUT ni dispositivos)?
      try {
        await F.updateDoc(participanteRef, { uids: [user.uid], rut, codigo: cod, ultimoIngreso: F.serverTimestamp() });
      } catch (e2) {
        // Sin revelar si el correo ya existe o está en la lista: ambos datos
        // son privados mientras el dispositivo no ha sido validado.
        if (denegado(e2)) throw error('identidad-no-validada', 'No fue posible validar el acceso. Revisa tu correo institucional y RUT, o avisa al profesor.');
        throw e2;
      }
    }
  }
  const snap = await F.getDoc(participanteRef);
  const ficha = await fichaDe(correo);
  try { localStorage.setItem(SESION, JSON.stringify({ correo, codigo: cod, curso: r.curso })); } catch {}
  return { participante: publico(snap.data()), aplicacion, ficha, curso: r.curso };
}

export async function sesionActual() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESION)); } catch {}
  if (!s?.correo) return null;
  if (!s.curso) return null;
  fijarCursoActual(s.curso);
  const { db, F } = await sdk();
  await anonimo();
  try {
    const snap = await F.getDoc(ref(F, db, rutas().participante(s.correo)));
    if (!snap.exists()) return null;
    const aplicacion = await resolverCodigo(s.codigo);
    return { participante: publico(snap.data()), aplicacion, codigo: s.codigo, ficha: await fichaDe(s.correo) };
  } catch { return null; }
}

export async function salir() { try { localStorage.removeItem(SESION); } catch {} }

export async function guardarConsentimiento(correo, decision, aplicacion = null) {
  const { db, F } = await sdk();
  const aut = soloAutorizaciones(decision);
  const registro = { ...aut, fecha: new Date().toISOString(), version: VERSION, aplicacion };
  await F.updateDoc(ref(F, db, rutas().participante(correo)), {
    consentimiento: { ...aut, fecha: F.serverTimestamp(), version: VERSION, aplicacion },
    historialConsentimiento: F.arrayUnion(registro)
  });
  return registro;
}

export async function respuestasDe(correo) {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, ...rutas().respuestas(correo)));
  const out = {};
  snap.forEach(d => { out[d.id] = plano(d.data()); });
  return out;
}

function codigoSesion() {
  try { return JSON.parse(localStorage.getItem(SESION))?.codigo || null; } catch { return null; }
}

async function escribirRespuesta(correo, aplicacion, equipo, respuestas, estado, { primera = false } = {}) {
  const { db, F } = await sdk();
  const respuestaRef = ref(F, db, rutas().respuestas(correo).concat(aplicacion));
  const datos = {
    aplicacion, equipo, codigo: codigoSesion(), estado, version: VERSION_ENCUESTA,
    respuestas: limpiarRespuestas(aplicacion, respuestas),
    actualizado: F.serverTimestamp()
  };
  // mergeFields reemplaza "respuestas" completo (una respuesta borrada no
  // sobrevive) y conserva "inicio" y "reaperturas" del documento.
  const campos = ['aplicacion', 'equipo', 'codigo', 'estado', 'version', 'respuestas', 'actualizado'];
  if (estado === 'enviado') { datos.enviado = F.serverTimestamp(); campos.push('enviado'); }
  if (primera) { datos.inicio = F.serverTimestamp(); campos.push('inicio'); } // para medir el tiempo de respuesta
  try {
    await F.setDoc(respuestaRef, datos, { mergeFields: campos });
  } catch (e) {
    if (denegado(e)) throw error('no-permitido', 'No fue posible guardar: la encuesta puede estar cerrada o ya fue enviada.');
    throw e;
  }
}

export const guardarRespuestas = (c, a, eq, r, o) => escribirRespuesta(c, a, eq, r, 'borrador', o);
export const enviarRespuestas = (c, a, eq, r, o) => escribirRespuesta(c, a, eq, r, 'enviado', o);

// ---------- Docente ----------
async function esDocente(uid) {
  const { db, F } = await sdk();
  try { return (await F.getDoc(F.doc(db, paths.admins, uid))).exists(); } catch { return false; }
}

export async function restaurarDocente() {
  const { auth } = await sdk();
  const u = auth.currentUser || await usuarioActual(auth);
  if (!u || u.isAnonymous) return null;
  return (await esDocente(u.uid)) ? { uid: u.uid, email: u.email } : null;
}

export async function entrarDocente() {
  const { auth, A } = await sdk();
  const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  if (!(await esDocente(cred.user.uid))) {
    const uid = cred.user.uid;
    await A.signOut(auth);
    throw error('no-docente', `Esta cuenta no está en el padrón docente. Agrega un documento con ID ${uid} en la colección ${paths.admins}.`);
  }
  return { uid: cred.user.uid, email: cred.user.email };
}

export async function salirDocente() {
  const { auth, A } = await sdk();
  await A.signOut(auth);
}

export async function guardarConfig(config) {
  const { db, F } = await sdk();
  await F.setDoc(ref(F, db, rutas().config), { ...config, actualizado: F.serverTimestamp() });
}

export async function codigosVigentes() {
  const { db, F } = await sdk();
  const snap = await F.getDoc(ref(F, db, rutas().privado.concat('codigos')));
  return snap.exists() ? snap.data() : {};
}

export async function fijarCodigo(aplicacion, codigo) {
  const cod = normalizarCodigo(codigo);
  if (cod.length < 4) throw error('codigo', 'La clave debe tener al menos 4 caracteres.');
  if (!['inicio', 'cierre', 'verificador', 'autoevaluacion', 'coevaluacion'].includes(aplicacion)) throw error('aplicacion', 'Aplicación desconocida.');
  const { db, F } = await sdk();
  const r = rutas();
  const nuevo = ref(F, db, r.codigos.concat(cod));
  const existente = await F.getDoc(nuevo);
  const indice = ref(F, db, [paths.indiceCodigos, cod]);
  const indiceExistente = await F.getDoc(indice);
  if (indiceExistente.exists() && (indiceExistente.data().curso !== r.curso || indiceExistente.data().aplicacion !== aplicacion)) throw error('codigo-usado', 'Esa clave ya está asignada a otro curso o actividad.');
  const vigentes = await codigosVigentes();
  const batch = F.writeBatch(db);
  if (vigentes[aplicacion] && vigentes[aplicacion] !== cod) {
    batch.delete(ref(F, db, r.codigos.concat(vigentes[aplicacion])));
    batch.delete(ref(F, db, [paths.indiceCodigos, vigentes[aplicacion]]));
  }
  batch.set(nuevo, { aplicacion });
  batch.set(indice, { curso: r.curso, aplicacion });
  batch.set(ref(F, db, r.privado.concat('codigos')), { ...vigentes, [aplicacion]: cod });
  await batch.commit();
  return cod;
}

export async function listarLista() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, ...rutas().lista));
  return snap.docs.map(d => plano(d.data()));
}

// Reemplaza la lista del curso completa: borra a quienes ya no están.
export async function cargarLista(filas) {
  const { db, F } = await sdk();
  const r = rutas();
  const actuales = await F.getDocs(F.collection(db, ...r.lista));
  const nuevos = new Set(filas.map(f => f.correo));
  const batch = F.writeBatch(db);
  actuales.forEach(d => { if (!nuevos.has(d.id)) batch.delete(d.ref); });
  for (const f of filas) batch.set(ref(F, db, r.lista.concat(f.correo)), { correo: f.correo, nombre: f.nombre, equipo: f.equipo });
  await batch.commit();
}

export async function listarParticipantes() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, ...rutas().participantes));
  return snap.docs.map(d => ({ ...plano(d.data()), dispositivos: (d.data().uids || []).length, uids: undefined, rutIntento: undefined }));
}

export async function listarRespuestas() {
  const { db, F } = await sdk();
  const r = rutas();
  const participantes = await F.getDocs(F.collection(db, ...r.participantes));
  const grupos = await Promise.all(participantes.docs.map(async p => (await F.getDocs(F.collection(db, ...r.respuestas(p.id)))).docs.map(d => ({ correo: p.id, clave: d.id, ...plano(d.data()) }))));
  return grupos.flat();
}

export async function reabrir(correo, aplicacion) {
  const { db, F, auth } = await sdk();
  await F.updateDoc(ref(F, db, rutas().respuestas(correo).concat(aplicacion)), {
    estado: 'borrador',
    reaperturas: F.arrayUnion({ fecha: new Date().toISOString(), por: auth.currentUser?.email || '' })
  });
}

export async function eliminarParticipante(correo) {
  const { db, F } = await sdk();
  const r = rutas();
  const resp = await F.getDocs(F.collection(db, ...r.respuestas(correo)));
  const batch = F.writeBatch(db);
  resp.forEach(d => batch.delete(d.ref));
  batch.delete(ref(F, db, r.participante(correo)));
  await batch.commit();
}

// Retiro del consentimiento (llega por correo al profesor): las cinco
// autorizaciones pasan a No. Las respuestas se conservan porque la encuesta es
// una actividad del curso, pero quedan fuera de los análisis de investigación.
export async function registrarRetiro(correo) {
  const { db, F, auth } = await sdk();
  const aut = soloAutorizaciones({});
  const fecha = new Date().toISOString();
  await F.updateDoc(ref(F, db, rutas().participante(correo)), {
    consentimiento: { ...aut, fecha: F.serverTimestamp(), version: VERSION, aplicacion: null, retiro: true },
    historialConsentimiento: F.arrayUnion({ ...aut, fecha, version: VERSION, retiro: true, por: auth.currentUser?.email || '' })
  });
}

// Encuesta respondida en papel y digitada por el docente.
export async function digitarPapel({ correo, aplicacion, equipo, consentimiento, respuestas }) {
  const { db, F, auth } = await sdk();
  const r = rutas();
  const pref = ref(F, db, r.participante(correo));
  const por = auth.currentUser?.email || '';
  const snap = await F.getDoc(pref);
  const batch = F.writeBatch(db);
  if (!snap.exists()) batch.set(pref, { correo, uids: [], creado: F.serverTimestamp(), origen: 'papel' });
  if (consentimiento) {
    const aut = soloAutorizaciones(consentimiento);
    batch.set(pref, {
      consentimiento: { ...aut, fecha: F.serverTimestamp(), version: VERSION, aplicacion, origen: 'papel' },
      historialConsentimiento: F.arrayUnion({ ...aut, fecha: new Date().toISOString(), version: VERSION, aplicacion, origen: 'papel', por })
    }, { merge: true });
  }
  batch.set(ref(F, db, r.respuestas(correo).concat(aplicacion)), {
    aplicacion, equipo, estado: 'enviado', version: VERSION_ENCUESTA, origen: 'papel', digitadoPor: por,
    respuestas: limpiarRespuestas(aplicacion, respuestas),
    actualizado: F.serverTimestamp(), enviado: F.serverTimestamp()
  });
  await batch.commit();
}

// Archivo docente: clave de conocimiento, parte del caso y resultado de
// aprendizaje de cada ítem. Vive solo en fcsPrivado.
export async function leerDocente() {
  const { db, F } = await sdk();
  const snap = await F.getDoc(ref(F, db, rutas().privado.concat('docente')));
  return snap.exists() ? plano(snap.data()) : null;
}

export async function guardarDocente(meta) {
  const { db, F } = await sdk();
  await F.setDoc(ref(F, db, rutas().privado.concat('docente')), { ...meta, cargado: F.serverTimestamp() });
}

// Sal secreta de los seudónimos: se crea una vez y solo la lee el docente.
export async function salSeudonimos() {
  const { db, F } = await sdk();
  const secretoRef = ref(F, db, rutas().privado.concat('seudonimos'));
  const snap = await F.getDoc(secretoRef);
  if (snap.exists() && snap.data().sal) return snap.data().sal;
  const sal = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  await F.setDoc(secretoRef, { sal, creado: F.serverTimestamp() });
  return sal;
}

// El panel refresca bajo demanda y cada 60 s; no se mantienen listeners
// abiertos sobre toda la colección para no multiplicar lecturas.
export function suscribir(fn) {
  const t = setInterval(fn, 60000);
  return () => clearInterval(t);
}
