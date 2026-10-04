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

export const modo = 'firebase';
const SESION = 'fcs:sesion';

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

const MSG_RUT = 'Este correo ya está registrado con otro RUT. Revisa tu RUT o avisa al profesor.';
const MSG_LISTA = 'Este correo no está en la lista del curso. Revisa que sea tu correo @udd.cl o avisa al profesor.';

// ---------- Estudiante ----------
export async function cargarConfig() {
  const { db, F } = await sdk();
  const snap = await F.getDoc(F.doc(db, paths.config, 'sitio'));
  return snap.exists() ? { ...configInicial(), ...plano(snap.data()) } : configInicial();
}

export async function resolverCodigo(codigo) {
  const cod = normalizarCodigo(codigo);
  if (!cod) return null;
  const { db, F } = await sdk();
  await anonimo();
  const snap = await F.getDoc(F.doc(db, paths.codigos, cod));
  return snap.exists() ? snap.data().aplicacion : null;
}

async function fichaDe(correo) {
  const { db, F } = await sdk();
  const snap = await F.getDoc(F.doc(db, paths.lista, correo));
  return snap.exists() ? plano(snap.data()) : null;
}

export async function ingresar({ correo, rut, codigo }) {
  const cod = normalizarCodigo(codigo);
  const aplicacion = await resolverCodigo(cod);
  if (!aplicacion) throw error('codigo-invalido', 'La clave del curso no es válida.');
  const { db, F } = await sdk();
  const user = await anonimo();
  const ref = F.doc(db, paths.participantes, correo);
  let existe = false, miembro = false, datos = null;
  try {
    const snap = await F.getDoc(ref);
    existe = snap.exists();
    miembro = existe;
    datos = existe ? snap.data() : null;
  } catch (e) {
    if (!denegado(e)) throw e;
    existe = true; // existe y este dispositivo aún no es miembro
  }
  if (!existe) {
    try {
      await F.setDoc(ref, {
        correo, rut, codigo: cod, uids: [user.uid],
        creado: F.serverTimestamp(), ultimoIngreso: F.serverTimestamp()
      });
    } catch (e) {
      // La clave ya se validó y el RUT tiene formato: lo que falla es la lista.
      if (denegado(e)) throw error('no-en-lista', MSG_LISTA);
      throw e;
    }
  } else if (!miembro) {
    try {
      await F.updateDoc(ref, {
        uids: F.arrayUnion(user.uid), rutIntento: rut, codigo: cod, ultimoIngreso: F.serverTimestamp()
      });
    } catch (e) {
      if (!denegado(e)) throw e;
      // ¿Registro creado por el docente desde papel (sin RUT ni dispositivos)?
      try {
        await F.updateDoc(ref, { uids: [user.uid], rut, codigo: cod, ultimoIngreso: F.serverTimestamp() });
      } catch (e2) {
        if (denegado(e2)) throw error('rut-no-coincide', MSG_RUT);
        throw e2;
      }
    }
  } else {
    if (datos.rut !== rut) throw error('rut-no-coincide', MSG_RUT);
    await F.updateDoc(ref, { codigo: cod, ultimoIngreso: F.serverTimestamp() });
  }
  const snap = await F.getDoc(ref);
  const ficha = await fichaDe(correo);
  try { localStorage.setItem(SESION, JSON.stringify({ correo, codigo: cod })); } catch {}
  return { participante: publico(snap.data()), aplicacion, ficha };
}

export async function sesionActual() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESION)); } catch {}
  if (!s?.correo) return null;
  const { db, F } = await sdk();
  await anonimo();
  try {
    const snap = await F.getDoc(F.doc(db, paths.participantes, s.correo));
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
  await F.updateDoc(F.doc(db, paths.participantes, correo), {
    consentimiento: { ...aut, fecha: F.serverTimestamp(), version: VERSION, aplicacion },
    historialConsentimiento: F.arrayUnion(registro)
  });
  return registro;
}

export async function respuestasDe(correo) {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, paths.participantes, correo, paths.respuestas));
  const out = {};
  snap.forEach(d => { out[d.id] = plano(d.data()); });
  return out;
}

function codigoSesion() {
  try { return JSON.parse(localStorage.getItem(SESION))?.codigo || null; } catch { return null; }
}

async function escribirRespuesta(correo, aplicacion, equipo, respuestas, estado, { primera = false } = {}) {
  const { db, F } = await sdk();
  const ref = F.doc(db, paths.participantes, correo, paths.respuestas, aplicacion);
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
    await F.setDoc(ref, datos, { mergeFields: campos });
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
  await F.setDoc(F.doc(db, paths.config, 'sitio'), { ...config, actualizado: F.serverTimestamp() });
}

export async function codigosVigentes() {
  const { db, F } = await sdk();
  const snap = await F.getDoc(F.doc(db, paths.privado, 'codigos'));
  return snap.exists() ? snap.data() : {};
}

export async function fijarCodigo(aplicacion, codigo) {
  const cod = normalizarCodigo(codigo);
  if (cod.length < 4) throw error('codigo', 'La clave debe tener al menos 4 caracteres.');
  if (!APLICACION_IDS.includes(aplicacion)) throw error('aplicacion', 'Aplicación desconocida.');
  const { db, F } = await sdk();
  const nuevo = F.doc(db, paths.codigos, cod);
  const existente = await F.getDoc(nuevo);
  if (existente.exists() && existente.data().aplicacion !== aplicacion) throw error('codigo-usado', 'Esa clave ya la usa la otra aplicación.');
  const vigentes = await codigosVigentes();
  const batch = F.writeBatch(db);
  if (vigentes[aplicacion] && vigentes[aplicacion] !== cod) batch.delete(F.doc(db, paths.codigos, vigentes[aplicacion]));
  batch.set(nuevo, { aplicacion });
  batch.set(F.doc(db, paths.privado, 'codigos'), { ...vigentes, [aplicacion]: cod });
  await batch.commit();
  return cod;
}

export async function listarLista() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, paths.lista));
  return snap.docs.map(d => plano(d.data()));
}

// Reemplaza la lista del curso completa: borra a quienes ya no están.
export async function cargarLista(filas) {
  const { db, F } = await sdk();
  const actuales = await F.getDocs(F.collection(db, paths.lista));
  const nuevos = new Set(filas.map(f => f.correo));
  const batch = F.writeBatch(db);
  actuales.forEach(d => { if (!nuevos.has(d.id)) batch.delete(d.ref); });
  for (const f of filas) batch.set(F.doc(db, paths.lista, f.correo), { correo: f.correo, nombre: f.nombre, equipo: f.equipo });
  await batch.commit();
}

export async function listarParticipantes() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collection(db, paths.participantes));
  return snap.docs.map(d => ({ ...plano(d.data()), dispositivos: (d.data().uids || []).length, uids: undefined, rutIntento: undefined }));
}

export async function listarRespuestas() {
  const { db, F } = await sdk();
  const snap = await F.getDocs(F.collectionGroup(db, paths.respuestas));
  return snap.docs
    .filter(d => d.ref.parent.parent?.parent.id === paths.participantes)
    .map(d => ({ correo: d.ref.parent.parent.id, clave: d.id, ...plano(d.data()) }));
}

export async function reabrir(correo, aplicacion) {
  const { db, F, auth } = await sdk();
  await F.updateDoc(F.doc(db, paths.participantes, correo, paths.respuestas, aplicacion), {
    estado: 'borrador',
    reaperturas: F.arrayUnion({ fecha: new Date().toISOString(), por: auth.currentUser?.email || '' })
  });
}

export async function eliminarParticipante(correo) {
  const { db, F } = await sdk();
  const resp = await F.getDocs(F.collection(db, paths.participantes, correo, paths.respuestas));
  const batch = F.writeBatch(db);
  resp.forEach(d => batch.delete(d.ref));
  batch.delete(F.doc(db, paths.participantes, correo));
  await batch.commit();
}

// Retiro del consentimiento (llega por correo al profesor): las cinco
// autorizaciones pasan a No. Las respuestas se conservan porque la encuesta es
// una actividad del curso, pero quedan fuera de los análisis de investigación.
export async function registrarRetiro(correo) {
  const { db, F, auth } = await sdk();
  const aut = soloAutorizaciones({});
  const fecha = new Date().toISOString();
  await F.updateDoc(F.doc(db, paths.participantes, correo), {
    consentimiento: { ...aut, fecha: F.serverTimestamp(), version: VERSION, aplicacion: null, retiro: true },
    historialConsentimiento: F.arrayUnion({ ...aut, fecha, version: VERSION, retiro: true, por: auth.currentUser?.email || '' })
  });
}

// Encuesta respondida en papel y digitada por el docente.
export async function digitarPapel({ correo, aplicacion, equipo, consentimiento, respuestas }) {
  const { db, F, auth } = await sdk();
  const pref = F.doc(db, paths.participantes, correo);
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
  batch.set(F.doc(db, paths.participantes, correo, paths.respuestas, aplicacion), {
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
  const snap = await F.getDoc(F.doc(db, paths.privado, 'docente'));
  return snap.exists() ? plano(snap.data()) : null;
}

export async function guardarDocente(meta) {
  const { db, F } = await sdk();
  await F.setDoc(F.doc(db, paths.privado, 'docente'), { ...meta, cargado: F.serverTimestamp() });
}

// Sal secreta de los seudónimos: se crea una vez y solo la lee el docente.
export async function salSeudonimos() {
  const { db, F } = await sdk();
  const ref = F.doc(db, paths.privado, 'seudonimos');
  const snap = await F.getDoc(ref);
  if (snap.exists() && snap.data().sal) return snap.data().sal;
  const sal = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  await F.setDoc(ref, { sal, creado: F.serverTimestamp() });
  return sal;
}

// El panel refresca bajo demanda y cada 60 s; no se mantienen listeners
// abiertos sobre toda la colección para no multiplicar lecturas.
export function suscribir(fn) {
  const t = setInterval(fn, 60000);
  return () => clearInterval(t);
}
