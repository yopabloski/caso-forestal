import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs } from 'firebase/firestore';

let env;
const correo = 'ana@udd.cl';
const cursoA = 'optimizacion-a-2026-2';
const cursoB = 'optimizacion-b-2026-2';
const participante = (curso, c = correo) => `fcsCursos/${curso}/participantes/${c}`;
const lista = (curso, c = correo) => `fcsCursos/${curso}/lista/${c}`;
const respuesta = curso => `${participante(curso)}/respuestas/inicio`;
const alumno = uid => env.authenticatedContext(uid).firestore();

before(async () => { env = await initializeTestEnvironment({ projectId: 'caso-forestal-test', firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } }); });
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'fcsAdmins/profe'), { email: 'profe@udd.cl' });
    for (const curso of [cursoA, cursoB]) {
      await setDoc(doc(db, `fcsCursos/${curso}`), { nombre: curso });
      await setDoc(doc(db, `${lista(curso)}`), { correo, nombre: 'Ana', equipo: curso === cursoA ? '01' : '02' });
      await setDoc(doc(db, `fcsCursos/${curso}/config/sitio`), { aplicaciones: { inicio: { estado: 'abierta' } } });
    }
    await setDoc(doc(db, 'fcsIndiceCodigos/A-INI'), { curso: cursoA, aplicacion: 'inicio' });
    await setDoc(doc(db, 'fcsIndiceCodigos/B-INI'), { curso: cursoB, aplicacion: 'inicio' });
  });
});
const alta = (curso, codigo, uid = 'ana-device') => ({ correo, rut: '12345678-5', codigo, uids: [uid] });
const resp = (curso, codigo) => ({ aplicacion: 'inicio', equipo: curso === cursoA ? '01' : '02', codigo, estado: 'borrador', respuestas: { AE1: 3 } });

test('código resuelve solo su curso y no se puede reutilizar cruzado', async () => {
  const db = alumno('ana-device');
  await assertSucceeds(getDoc(doc(db, 'fcsIndiceCodigos/A-INI')));
  await assertFails(getDocs(collection(db, 'fcsIndiceCodigos')));
  await assertSucceeds(setDoc(doc(db, participante(cursoA)), alta(cursoA, 'A-INI')));
  await assertFails(setDoc(doc(db, participante(cursoB)), alta(cursoB, 'A-INI')));
});

test('el mismo correo puede existir en dos cursos, con consentimientos y respuestas aislados', async () => {
  const db = alumno('ana-device');
  await assertSucceeds(setDoc(doc(db, participante(cursoA)), alta(cursoA, 'A-INI')));
  await assertSucceeds(setDoc(doc(db, participante(cursoB)), alta(cursoB, 'B-INI')));
  await assertSucceeds(setDoc(doc(db, respuesta(cursoA)), resp(cursoA, 'A-INI')));
  await assertSucceeds(setDoc(doc(db, respuesta(cursoB)), resp(cursoB, 'B-INI')));
});

test('un segundo dispositivo solo reclama el registro con el mismo RUT', async () => {
  const primero = alumno('ana-device');
  const segundo = alumno('otro-device');
  await assertSucceeds(setDoc(doc(primero, participante(cursoA)), alta(cursoA, 'A-INI')));
  await assertFails(updateDoc(doc(segundo, participante(cursoA)), { uids: arrayUnion('otro-device'), rutIntento: '11111111-1', codigo: 'A-INI' }));
  await assertSucceeds(updateDoc(doc(segundo, participante(cursoA)), { uids: arrayUnion('otro-device'), rutIntento: '12345678-5', codigo: 'A-INI' }));
  await assertSucceeds(getDoc(doc(segundo, participante(cursoA))));
});

test('no se puede leer lista, participante o respuesta de otro curso sin pertenecer', async () => {
  const db = alumno('ana-device');
  await assertSucceeds(setDoc(doc(db, participante(cursoA)), alta(cursoA, 'A-INI')));
  await assertSucceeds(getDoc(doc(db, lista(cursoA))));
  await assertFails(getDoc(doc(db, lista(cursoB))));
  await assertFails(getDoc(doc(db, participante(cursoB))));
  await assertFails(getDocs(collection(db, `fcsCursos/${cursoA}/lista`)));
});

test('el docente administra ambos cursos y el estudiante no enumera cursos', async () => {
  const estudiante = alumno('ana-device');
  const profe = env.authenticatedContext('profe').firestore();
  await assertFails(getDocs(collection(estudiante, 'fcsCursos')));
  await assertSucceeds(getDocs(collection(profe, 'fcsCursos')));
  await assertSucceeds(setDoc(doc(profe, `fcsCursos/${cursoB}/privado/recurso-verificador`), { ubicacion: 'functions/verificador/privado/curso-b' }));
});

test('los registros del verificador se guardan y se leen por curso', async () => {
  const estudiante = alumno('ana-device');
  const profe = env.authenticatedContext('profe').firestore();
  await assertSucceeds(setDoc(doc(profe, `fcsCursos/${cursoA}/verificaciones/intento-a`), { equipo: '01', valida: true }));
  await assertSucceeds(setDoc(doc(profe, `fcsCursos/${cursoB}/verificaciones/intento-b`), { equipo: '02', valida: false }));
  await assertFails(getDoc(doc(estudiante, `fcsCursos/${cursoA}/verificaciones/intento-a`)));
  await assertSucceeds(getDoc(doc(profe, `fcsCursos/${cursoA}/verificaciones/intento-a`)));
  await assertSucceeds(getDoc(doc(profe, `fcsCursos/${cursoB}/verificaciones/intento-b`)));
});
