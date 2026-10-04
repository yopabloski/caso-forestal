// Pruebas de firestore.rules contra el emulador.
// Requiere: npm install (firebase, @firebase/rules-unit-testing, firebase-tools) y Java.
// Uso: npm run test:reglas
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, collection, getDocs, collectionGroup } from 'firebase/firestore';

let env;
const CORREO = 'ana.perez@udd.cl';
const OTRO = 'luis.rojas@udd.cl';
const RUT = '12345678-5';
const P = `fcsParticipantes/${CORREO}`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'caso-forestal-test',
    firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'fcsAdmins/profe'), { email: 'profe@gmail.com' });
    await setDoc(doc(db, 'fcsCodigos/FCS-INI'), { aplicacion: 'inicio' });
    await setDoc(doc(db, 'fcsCodigos/FCS-CIE'), { aplicacion: 'cierre' });
    await setDoc(doc(db, 'fcsPrivado/codigos'), { inicio: 'FCS-INI', cierre: 'FCS-CIE' });
    await setDoc(doc(db, 'fcsPrivado/docente'), { clave: { K1: 'x' } });
    await setDoc(doc(db, 'fcsConfig/sitio'), { aplicaciones: { inicio: { id: 'inicio', estado: 'abierta' }, cierre: { id: 'cierre', estado: 'cerrada' } } });
    await setDoc(doc(db, `fcsLista/${CORREO}`), { correo: CORREO, nombre: 'Ana Pérez', equipo: '07' });
    await setDoc(doc(db, `fcsLista/${OTRO}`), { correo: OTRO, nombre: 'Luis Rojas', equipo: '02' });
  });
});

const alumno = uid => env.authenticatedContext(uid).firestore();
const profe = () => env.authenticatedContext('profe').firestore();
const nuevo = (uid, extra = {}) => ({ correo: CORREO, rut: RUT, codigo: 'FCS-INI', uids: [uid], ...extra });
const CONS = { a1: true, a2: false, a3: true, a4: false, a5: true, version: 'v4', aplicacion: 'inicio' };
async function registrar(uid = 'dev1', consentir = true) {
  const db = alumno(uid);
  await assertSucceeds(setDoc(doc(db, P), nuevo(uid)));
  if (consentir) await assertSucceeds(updateDoc(doc(db, P), { consentimiento: CONS, historialConsentimiento: arrayUnion({ ...CONS, fecha: 'x' }) }));
  return db;
}
const resp = (extra = {}) => ({ aplicacion: 'inicio', equipo: '07', codigo: 'FCS-INI', estado: 'borrador', version: 'v4', respuestas: { AE1: 3, K1: 'a' }, ...extra });

test('alta: solo correos de la lista, con clave vigente y dueño único', async () => {
  const db = alumno('dev1');
  await assertFails(setDoc(doc(db, 'fcsParticipantes/x@gmail.com'), { ...nuevo('dev1'), correo: 'x@gmail.com' }));
  await assertFails(setDoc(doc(db, 'fcsParticipantes/fuera@udd.cl'), { ...nuevo('dev1'), correo: 'fuera@udd.cl' })); // no está en la lista
  await assertFails(setDoc(doc(db, P), nuevo('dev1', { codigo: 'FALSA' })));
  await assertFails(setDoc(doc(db, P), nuevo('otro')));
  await assertFails(setDoc(doc(db, P), nuevo('dev1', { rut: '123' })));
  await assertFails(setDoc(doc(db, P), nuevo('dev1', { consentimiento: CONS })));
  await assertFails(setDoc(doc(db, P), nuevo('dev1', { correo: OTRO })));
  await assertSucceeds(setDoc(doc(db, P), nuevo('dev1')));
});

test('sin sesión no se puede registrar ni leer', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(anon, P), nuevo('x')));
  await assertFails(getDoc(doc(anon, 'fcsCodigos/FCS-INI')));
  await assertSucceeds(getDoc(doc(anon, 'fcsConfig/sitio')));
});

test('otro dispositivo necesita el RUT correcto', async () => {
  await registrar('dev1');
  const db2 = alumno('dev2');
  await assertFails(getDoc(doc(db2, P)));
  await assertFails(updateDoc(doc(db2, P), { uids: arrayUnion('dev2'), rutIntento: '11111111-1', codigo: 'FCS-INI' }));
  await assertFails(updateDoc(doc(db2, P), { uids: ['dev2'], rutIntento: RUT, codigo: 'FCS-INI' })); // no puede expulsar al dueño
  await assertFails(updateDoc(doc(db2, P), { uids: ['dev2'], rut: '11111111-1', codigo: 'FCS-INI' })); // ni cambiar el RUT
  await assertSucceeds(updateDoc(doc(db2, P), { uids: arrayUnion('dev2'), rutIntento: RUT, codigo: 'FCS-INI' }));
  await assertSucceeds(getDoc(doc(db2, P)));
});

test('el miembro no puede cambiar correo, RUT ni dispositivos', async () => {
  const db = await registrar();
  await assertFails(updateDoc(doc(db, P), { rut: '22508532-3' }));
  await assertFails(updateDoc(doc(db, P), { uids: ['dev1', 'intruso'] }));
  await assertFails(updateDoc(doc(db, P), { correo: OTRO }));
  await assertFails(updateDoc(doc(db, P), { equipo: '01' }));
});

test('consentimiento: cinco Sí o No, y se puede cambiar', async () => {
  const db = await registrar('dev1', false);
  await assertFails(updateDoc(doc(db, P), { consentimiento: { a1: true, version: 'v4' } }));
  await assertFails(updateDoc(doc(db, P), { consentimiento: { ...CONS, a3: 'si' } }));
  await assertFails(updateDoc(doc(db, P), { consentimiento: { ...CONS, admin: true } }));
  await assertSucceeds(updateDoc(doc(db, P), { consentimiento: CONS }));
  await assertSucceeds(updateDoc(doc(db, P), { consentimiento: { ...CONS, a1: false } }));
});

test('un consentimiento registrado por el docente no bloquea el ingreso ni la nueva decisión', async () => {
  const db = await registrar();
  // Retiro registrado por el docente (trae campos que el estudiante no puede escribir).
  await assertSucceeds(updateDoc(doc(profe(), P), { consentimiento: { a1: false, a2: false, a3: false, a4: false, a5: false, version: 'v4', aplicacion: null, retiro: true } }));
  await assertSucceeds(updateDoc(doc(db, P), { codigo: 'FCS-CIE', ultimoIngreso: 'x' })); // vuelve a ingresar
  await assertSucceeds(updateDoc(doc(db, P), { consentimiento: CONS })); // y puede decidir de nuevo
  // El docente cambia la clave: la guardada queda obsoleta, pero el consentimiento se puede cambiar.
  await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), 'fcsCodigos/FCS-CIE')));
  await assertSucceeds(updateDoc(doc(db, P), { consentimiento: { ...CONS, a2: true } }));
  await assertFails(updateDoc(doc(db, P), { codigo: 'FCS-CIE' }));
});

test('lista del curso: cada quien lee solo su ficha y después de registrarse', async () => {
  const db = alumno('dev1');
  await assertFails(getDoc(doc(db, `fcsLista/${CORREO}`)));
  await registrar('dev1');
  await assertSucceeds(getDoc(doc(db, `fcsLista/${CORREO}`)));
  await assertFails(getDoc(doc(db, `fcsLista/${OTRO}`)));
  await assertFails(getDocs(collection(db, 'fcsLista')));
  await assertFails(setDoc(doc(db, `fcsLista/${CORREO}`), { correo: CORREO, nombre: 'Ana', equipo: '01' }));
});

test('respuestas: todos responden con consentimiento decidido, aunque sea No', async () => {
  const db = await registrar('dev1', false);
  const ref = doc(db, `${P}/respuestas/inicio`);
  await assertFails(setDoc(ref, resp())); // aún no decide
  await assertSucceeds(updateDoc(doc(db, P), { consentimiento: { ...CONS, a1: false, a3: false, a5: false } }));
  await assertSucceeds(setDoc(ref, resp()));
});

test('respuestas: aplicación abierta, clave de esa aplicación, equipo de la lista e ítems conocidos', async () => {
  const db = await registrar();
  const ref = doc(db, `${P}/respuestas/inicio`);
  await assertFails(setDoc(doc(db, `${P}/respuestas/cierre`), resp({ aplicacion: 'cierre', codigo: 'FCS-CIE' }))); // cerrada
  await assertFails(setDoc(ref, resp({ codigo: 'FCS-CIE' }))); // clave de otra aplicación
  await assertFails(setDoc(ref, resp({ codigo: 'FALSA' })));
  await assertFails(setDoc(ref, resp({ equipo: '02' })));
  await assertFails(setDoc(ref, resp({ aplicacion: 'cierre' })));
  await assertFails(setDoc(ref, resp({ respuestas: { AE1: 3, HACK: 1 } })));
  await assertFails(setDoc(ref, resp({ respuestas: { A1: 'x'.repeat(2001) } })));
  await assertFails(setDoc(ref, resp({ origen: 'papel' })));
  await assertFails(setDoc(doc(db, `${P}/respuestas/otra`), resp({ aplicacion: 'otra' })));
  await assertSucceeds(setDoc(ref, resp()));
  // Otro estudiante no puede escribir ni leer estas respuestas.
  const db2 = alumno('dev9');
  await setDoc(doc(db2, `fcsParticipantes/${OTRO}`), { correo: OTRO, rut: '11111111-1', codigo: 'FCS-INI', uids: ['dev9'] });
  await assertFails(getDoc(doc(db2, `${P}/respuestas/inicio`)));
  await assertFails(setDoc(doc(db2, `${P}/respuestas/inicio`), resp()));
});

test('respuestas: bloqueo al enviar y reapertura docente', async () => {
  const db = await registrar();
  const ref = doc(db, `${P}/respuestas/inicio`);
  const campos = ['aplicacion', 'equipo', 'codigo', 'estado', 'version', 'respuestas'];
  await assertSucceeds(setDoc(ref, resp(), { mergeFields: campos }));
  await assertSucceeds(setDoc(ref, resp({ respuestas: { AE1: 5 } }), { mergeFields: campos }));
  assert.deepEqual((await getDoc(ref)).data().respuestas, { AE1: 5 }); // mergeFields reemplaza el mapa completo
  await assertSucceeds(setDoc(ref, resp({ estado: 'enviado' }), { mergeFields: campos }));
  await assertFails(setDoc(ref, resp({ respuestas: { AE1: 1 } }), { mergeFields: campos }));
  await assertFails(updateDoc(ref, { estado: 'borrador' }));
  await assertFails(deleteDoc(ref));
  await assertSucceeds(updateDoc(doc(profe(), `${P}/respuestas/inicio`), { estado: 'borrador', reaperturas: arrayUnion({ fecha: 'x', por: 'profe' }) }));
  await assertFails(setDoc(ref, { ...resp(), reaperturas: [] })); // no puede borrar el historial
  await assertSucceeds(setDoc(ref, resp({ respuestas: { AE1: 1 } }), { mergeFields: campos }));
});

test('aplicación cerrada: ni borradores ni envíos', async () => {
  const db = await registrar();
  const ref = doc(db, `${P}/respuestas/inicio`);
  await assertSucceeds(setDoc(ref, resp()));
  await updateDoc(doc(profe(), 'fcsConfig/sitio'), { 'aplicaciones.inicio.estado': 'cerrada' });
  await assertFails(setDoc(ref, resp({ estado: 'enviado' })));
  await assertSucceeds(getDoc(ref));
});

test('registro creado desde papel: el primer ingreso lo completa', async () => {
  await assertSucceeds(setDoc(doc(profe(), P), { correo: CORREO, uids: [], origen: 'papel', consentimiento: { ...CONS, origen: 'papel' } }));
  await assertSucceeds(setDoc(doc(profe(), `${P}/respuestas/inicio`), { aplicacion: 'inicio', equipo: '07', estado: 'enviado', origen: 'papel', respuestas: { AE1: 2 } }));
  const db = alumno('dev1');
  await assertFails(updateDoc(doc(db, P), { uids: ['dev1'], rut: RUT, codigo: 'FALSA' }));
  await assertFails(updateDoc(doc(db, P), { uids: ['dev1'], rut: RUT, codigo: 'FCS-INI', consentimiento: CONS }));
  await assertSucceeds(updateDoc(doc(db, P), { uids: ['dev1'], rut: RUT, codigo: 'FCS-INI' }));
  await assertSucceeds(getDoc(doc(db, `${P}/respuestas/inicio`)));
  await assertFails(updateDoc(doc(alumno('dev2'), P), { uids: ['dev2'], rut: '11111111-1', codigo: 'FCS-INI' })); // ya tiene dueño
});

test('lecturas globales, padrón docente, claves y archivo docente', async () => {
  await registrar();
  const intruso = alumno('intruso');
  await assertFails(getDocs(collection(intruso, 'fcsParticipantes')));
  await assertFails(getDocs(collectionGroup(intruso, 'respuestas')));
  await assertFails(getDocs(collection(intruso, 'fcsCodigos')));
  await assertSucceeds(getDoc(doc(intruso, 'fcsCodigos/FCS-INI')));
  await assertFails(getDoc(doc(intruso, 'fcsPrivado/docente'))); // la clave de conocimiento
  await assertFails(getDoc(doc(intruso, 'fcsPrivado/codigos')));
  await assertFails(setDoc(doc(intruso, 'fcsAdmins/intruso'), { x: 1 }));
  await assertFails(setDoc(doc(intruso, 'fcsConfig/sitio'), { aplicaciones: {} }));
  await assertFails(setDoc(doc(intruso, 'fcsCodigos/MIA'), { aplicacion: 'inicio' }));
  const p = profe();
  await assertSucceeds(getDocs(collection(p, 'fcsParticipantes')));
  await assertSucceeds(getDocs(collectionGroup(p, 'respuestas')));
  await assertSucceeds(getDocs(collection(p, 'fcsLista')));
  await assertSucceeds(getDoc(doc(p, 'fcsPrivado/docente')));
  await assertFails(setDoc(doc(p, 'fcsAdmins/otro'), { x: 1 })); // ni el docente se agrega desde el navegador
});
