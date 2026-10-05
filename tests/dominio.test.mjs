// Pruebas de dominio: contenido de la encuesta, identidad, lista del curso,
// análisis y exportación. Uso: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SECCIONES, ITEMS, itemsDe, completitud, limpiarRespuestas, valorValido, ITEM } from '../js/domain/encuesta.js';
import { AUTORIZACIONES, decisionCompleta, soloAutorizaciones } from '../js/domain/consentimiento.js';
import { rutValido, normalizarRut, correoValido, normalizarCodigo } from '../js/domain/identidad.js';
import { normalizarEquipo, estadoRespuesta } from '../js/domain/modelo.js';
import { leerCSV, interpretarLista, resumenEquipos } from '../js/domain/lista.js';
import * as AN from '../js/domain/analisis.js';
import * as EX from '../js/domain/exportar.js';

// Clave FICTICIA para las pruebas. La real vive solo en privado/ (fuera del repositorio).
const CLAVE = { K1: 'd', K2: 'a', K3: 'c', K4: 'd' };
const RUTA_DOCENTE = new URL('../privado/metadatos-docente.json', import.meta.url);
const DOCENTE_REAL = fs.existsSync(RUTA_DOCENTE) ? JSON.parse(fs.readFileSync(RUTA_DOCENTE, 'utf8')) : null;

test('contenido de la encuesta según el brief (v4)', () => {
  assert.equal(itemsDe('inicio').length, 14);
  assert.equal(itemsDe('cierre').length, 25);
  assert.deepEqual(SECCIONES.map(s => [s.id, s.items.length]), [['AE', 10], ['K', 4], ['U', 7], ['A', 4]]);
  assert.deepEqual(Object.keys(ITEM.K1.alternativas), ['a', 'b', 'c', 'd']);
  assert.equal(AUTORIZACIONES.length, 5);
  assert.equal(new Set(ITEMS.map(i => i.id)).size, 25);
});

test('lo publicable no contiene la clave, la parte ni el resultado de aprendizaje', { skip: !DOCENTE_REAL && 'sin privado/metadatos-docente.json' }, () => {
  const raiz = new URL('../', import.meta.url);
  const archivos = fs.readdirSync(raiz, { recursive: true }).map(String)
    .filter(f => !/^(node_modules|privado|\.git)\b/.test(f) && /\.(js|mjs|html|md|json|css|rules)$/.test(f) && f !== 'package-lock.json');
  assert.ok(archivos.length >= 30);
  const prohibidos = [
    ...Object.entries(DOCENTE_REAL.clave).map(([k, v]) => new RegExp(`${k}["']?\\s*[:=]\\s*["']?${v}["']?(?![a-z])`)),
    ...Object.values(DOCENTE_REAL.items).filter(i => i.ra).map(i => new RegExp(i.ra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  ];
  for (const f of archivos) {
    const t = fs.readFileSync(new URL(f, raiz), 'utf8');
    for (const re of prohibidos) assert.ok(!re.test(t), `${f} contiene ${re}`);
    assert.ok(!/Clave:\s*[abcd]\b/.test(t), `${f} contiene una clave`);
  }
});

test('validación de respuestas y completitud', () => {
  assert.ok(valorValido(ITEM.AE1, 3));
  assert.ok(!valorValido(ITEM.AE1, 6));
  assert.ok(!valorValido(ITEM.AE1, '3'));
  assert.ok(valorValido(ITEM.K2, 'c'));
  assert.ok(!valorValido(ITEM.K2, 'e'));
  assert.ok(!valorValido(ITEM.A1, '  '));
  const r = Object.fromEntries(itemsDe('inicio').map(i => [i.id, i.tipo === 'likert' ? 4 : 'a']));
  assert.equal(completitud('inicio', r).faltan.length, 0);
  assert.equal(completitud('cierre', r).faltan.length, 11);
  assert.deepEqual(Object.keys(limpiarRespuestas('inicio', { ...r, U1: 5, X: 1, AE2: 9 })).length, 13);
});

test('identidad y consentimiento', () => {
  assert.ok(rutValido('12.345.678-5'));
  assert.ok(!rutValido('12.345.678-9'));
  assert.equal(normalizarRut('12.345.678-5'), '12345678-5');
  assert.ok(correoValido('ana.perez@udd.cl'));
  assert.ok(!correoValido('ana@gmail.com'));
  assert.equal(normalizarCodigo(' fcs-ini-ab3k '), 'FCS-INI-AB3K');
  assert.ok(!decisionCompleta({ a1: true, a2: false }));
  assert.ok(decisionCompleta({ a1: true, a2: false, a3: true, a4: false, a5: true }));
  assert.deepEqual(soloAutorizaciones({ a1: true, x: 1 }), { a1: true, a2: false, a3: false, a4: false, a5: false });
});

test('lista del curso desde el CSV de Canvas', () => {
  const csv = '﻿nombre,canvas_user_id,user_id,login_id,secciones,group_name\r\n'
    + '"Pérez Soto, Ana",101,9001,Ana.Perez@udd.cl,IIM329A,Equipo 07\r\n'
    + 'Luis Rojas,102,9002,lrojas@udd.cl,IIM329A,Equipo 7\r\n'
    + 'García, Marta,103,9003,mgarcia@udd.cl,IIM329A,Equipo 08\r\n'
    + 'Sin Equipo,104,9004,sin@udd.cl,IIM329A,\r\n'
    + 'Otra Persona,105,9005,otra@gmail.com,IIM329A,Equipo 01\r\n'
    + 'Repetida,106,9006,lrojas@udd.cl,IIM329A,Equipo 02\r\n';
  const r = interpretarLista(csv);
  assert.deepEqual(r.columnas, { correo: 'login_id', nombre: 'nombre', equipo: 'group_name' });
  assert.deepEqual(r.filas, [
    { correo: 'ana.perez@udd.cl', nombre: 'Ana Pérez Soto', equipo: '07' },
    { correo: 'lrojas@udd.cl', nombre: 'Luis Rojas', equipo: '07' },
    { correo: 'mgarcia@udd.cl', nombre: 'Marta García', equipo: '08' }
  ]);
  assert.equal(r.errores.length, 3);
  assert.deepEqual(resumenEquipos(r.filas), [{ equipo: '07', n: 2 }, { equipo: '08', n: 1 }]);
  const otro = interpretarLista('Estudiante;Correo;Equipo\nAna Pérez;ana@udd.cl;3\nLuis Rojas;luis@udd.cl;14\n');
  assert.deepEqual(otro.filas.map(f => f.equipo), ['03', '14']);
  assert.equal(leerCSV('a,b\n"x, ""y""",2\n')[1][0], 'x, "y"');
  assert.equal(normalizarEquipo('Equipo 09'), '09');
  assert.equal(normalizarEquipo('sin'), '');
});

// Curso pequeño para análisis y exportación.
function curso() {
  const lista = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ correo: `${x}@udd.cl`, nombre: `Persona ${x.toUpperCase()}`, equipo: i < 3 ? '01' : '02' }));
  const cons = (a1, a4 = true) => ({ a1, a2: true, a3: true, a4, a5: true, fecha: '2026-10-07T12:00:00.000Z', version: 'v4' });
  const participantes = [
    { correo: 'a@udd.cl', rut: '11111111-1', consentimiento: cons(true) },
    { correo: 'b@udd.cl', rut: '22222222-2', consentimiento: cons(true, false) },
    { correo: 'c@udd.cl', rut: '33333333-3', consentimiento: cons(false) },
    { correo: 'd@udd.cl', rut: '44444444-4' }
  ];
  const ini = (ae, k) => ({ ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`AE${i + 1}`, ae])), K1: k[0], K2: k[1], K3: k[2], K4: k[3] });
  const cie = (ae, k, u) => ({ ...ini(ae, k), ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`U${i + 1}`, u])), A1: 'Aprendí el gap', A2: 'Un índice', A3: 'Capacidad', A4: 'Nada' });
  const doc = (correo, clave, respuestas, estado = 'enviado') => ({ correo, clave, aplicacion: clave, equipo: '01', estado, respuestas, inicio: '2026-10-07T12:00:00.000Z', enviado: estado === 'enviado' ? '2026-10-07T12:08:30.000Z' : undefined });
  const respuestas = [
    doc('a@udd.cl', 'inicio', ini(2, 'aaaa')), doc('a@udd.cl', 'cierre', cie(4, 'dacd', 5)),
    doc('b@udd.cl', 'inicio', ini(3, 'dacd')), doc('b@udd.cl', 'cierre', cie(4, 'dacd', 4)),
    doc('c@udd.cl', 'inicio', ini(1, 'dbcd')), doc('c@udd.cl', 'cierre', cie(2, 'abcd', 2)),
    doc('d@udd.cl', 'inicio', ini(5, 'dddd'), 'borrador')
  ];
  return AN.unir({ lista, participantes, respuestas });
}

test('unir, avance y filtro por autorización', () => {
  const ps = curso();
  assert.equal(ps.length, 5);
  const av = AN.avance(ps);
  assert.equal(av.total, 5);
  assert.deepEqual(av.porAplicacion.inicio, { enviado: 3, enCurso: 1, pendiente: 1 });
  assert.equal(av.pareados, 3);
  assert.deepEqual(av.faltan.cierre.map(f => f.correo), ['d@udd.cl', 'e@udd.cl']);
  assert.equal(av.autorizaciones.a1, 2);
  assert.deepEqual(AN.conAutorizacion(ps, 'a1').map(f => f.correo), ['a@udd.cl', 'b@udd.cl']);
  assert.equal(ps.find(f => f.correo === 'd@udd.cl').aut.a1, null);
  assert.equal(estadoRespuesta(null), 'pendiente');
});

test('autoeficacia: medias, pares y partes; el borrador no cuenta', () => {
  const ps = curso();
  const docente = { items: { AE1: { parte: ['A'] }, AE2: { parte: ['A'] }, AE7: { parte: ['B', 'C'] }, AE8: { parte: ['C'] } } };
  const r = AN.autoeficacia(ps, docente);
  const i1 = r.items[0];
  assert.equal(i1.inicio.n, 3);
  assert.equal(i1.inicio.media, 2);
  assert.deepEqual(i1.inicio.dist, [1, 1, 1, 0, 0]);
  assert.equal(i1.pareado.n, 3);
  assert.equal(i1.pareado.nDif, 3);
  assert.ok(Math.abs(i1.pareado.mediaCierre - i1.pareado.mediaInicio - 4 / 3) < 1e-12);
  assert.equal(i1.pareado.rb, 1);
  assert.deepEqual(r.partes.map(p => [p.nombre, p.ids]), [['Parte A', ['AE1', 'AE2']], ['Parte B', ['AE7']], ['Parte C', ['AE7', 'AE8']]]);
  assert.equal(r.total.pareado.n, 3);
  assert.equal(AN.autoeficacia(ps, null).partes, null);
  assert.equal(AN.autoeficacia(AN.conAutorizacion(ps), null).items[0].inicio.n, 2);
});

test('conocimiento: correctas y McNemar; sin clave solo distribución', () => {
  const ps = curso();
  const r = AN.conocimiento(ps, CLAVE);
  const k1 = r.items[0];
  assert.deepEqual(k1.inicio.dist, [1, 0, 0, 2]);
  assert.equal(k1.inicio.correctas, 2);
  assert.equal(k1.cierre.correctas, 2);
  assert.deepEqual([k1.pareado.pares, k1.pareado.b, k1.pareado.c], [3, 1, 1]);
  assert.equal(k1.pareado.p, 1);
  assert.equal(r.total.inicio.media, (1 + 4 + 3) / 3); // "aaaa" acierta K2
  const sin = AN.conocimiento(ps, null);
  assert.equal(sin.total, null);
  assert.equal(sin.items[0].pareado, null);
  assert.equal(sin.items[0].inicio.correctas, null);
});

test('valoración y abiertas', () => {
  const ps = curso();
  const u = AN.valoracion(ps);
  assert.equal(u.length, 7);
  assert.deepEqual(u[0].dist, [0, 1, 0, 1, 1]);
  assert.equal(u[0].deAcuerdo, 2);
  const a = AN.abiertas(ps, f => EX.idSeudonimo(f.correo, 'sal'));
  assert.equal(a[0].respuestas.length, 3);
  assert.deepEqual(a[0].respuestas.map(x => x.citable), [true, false, true]);
  assert.ok(a[0].respuestas.every(x => /^P[0-9A-Z]{7}$/.test(x.id)));
});

test('exportación: seudonimizada sin identificadores y filtro por autorización', () => {
  const ps = curso();
  const completa = EX.construirBase({ personas: ps, sal: 's1', clave: CLAVE });
  assert.equal(completa.filas.length, 4); // quien nunca ingresó no aparece
  assert.ok(completa.cols.includes('CORREO') && completa.cols.includes('RUT'));
  const a = completa.filas.find(f => f.CORREO === 'a@udd.cl');
  assert.equal(a.INI_K1_OK, 0);
  assert.equal(a.CIE_K_TOTAL, 4);
  assert.equal(a.INI_MINUTOS, 8.5);
  assert.equal(a.AUT1, 1);
  const d = completa.filas.find(f => f.CORREO === 'd@udd.cl');
  assert.equal(d.INI_ESTADO, 'en-curso');
  assert.equal(d.INI_AE1, ''); // el borrador no se exporta como respuesta
  assert.equal(d.AUT1, '');
  const seud = EX.construirBase({ personas: ps, sal: 's1', seudonimizar: true, soloAut: 'a1', clave: CLAVE });
  assert.equal(seud.filas.length, 2);
  assert.ok(!seud.cols.some(c => ['CORREO', 'NOMBRE', 'RUT'].includes(c)));
  const csv = EX.aCSV(seud);
  assert.ok(!/udd\.cl|Persona|11111111/.test(csv));
  assert.ok(csv.startsWith('﻿ID;EQUIPO;'));
  assert.equal(EX.idSeudonimo('A@udd.cl', 's1'), EX.idSeudonimo('a@udd.cl', 's1'));
  assert.notEqual(EX.idSeudonimo('a@udd.cl', 's1'), EX.idSeudonimo('a@udd.cl', 's2'));
  assert.equal(EX.llaveDeCorrespondencia(ps, 's1').filas.length, 4);
  assert.equal(EX.baseAbiertas({ personas: ps, sal: 's1', soloAut: 'a1' }).filas.length, 8);
  assert.ok(EX.libroDeCodigos({ clave: CLAVE, items: {} }).filas.some(f => f.variable === 'K1' && f.clave === 'd'));
  assert.equal(EX.aCSV({ cols: ['x'], filas: [{ x: 'a;"b"' }] }), '﻿x\r\n"a;""b"""\r\n');
});

test('archivo docente', () => {
  assert.deepEqual(AN.validarDocente({ clave: CLAVE, items: { AE1: { parte: ['A'] } } }), []);
  assert.equal(AN.validarDocente({ clave: { K1: 'd' } }).length, 3);
  assert.equal(AN.validarDocente({ clave: CLAVE, items: { ZZ: {} } }).length, 1);
  if (DOCENTE_REAL) assert.deepEqual(AN.validarDocente(DOCENTE_REAL), []);
});
