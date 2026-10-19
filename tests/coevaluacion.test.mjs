import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/domain/coevaluacion.js';

test('cierre por defecto: día de la entrega a las 23:45 de Santiago', () => {
  assert.equal(new Date(C.cierrePorDefecto('coev1')).toISOString(), '2026-10-17T02:45:00.000Z');
  assert.equal(C.localChileDesdeMs(C.cierrePorDefecto('coev2')), '2026-10-30T23:45');
  assert.equal(C.localChileDesdeMs(C.msDesdeLocalChile('2026-07-10T09:00')), '2026-07-10T09:00'); // horario de invierno
});

test('plazo: abierta antes del cierre, cerrada después salvo prórroga vigente', () => {
  const ap = { estado: 'abierta', cierreMs: 1000 };
  assert.equal(C.plazoVigente(ap, undefined, 999), true);
  assert.equal(C.plazoVigente(ap, undefined, 1000), false);
  assert.equal(C.plazoVigente(ap, 5000, 2000), true);
  assert.equal(C.plazoVigente({ estado: 'cerrada', cierreMs: 9e9 }, undefined, 10), false);
  assert.equal(C.plazoVigente({ estado: 'cerrada' }, 5000, 10), true);
  assert.equal(C.plazoEfectivo(ap, 5000), 5000);
  assert.equal(C.plazoEfectivo(ap, 500), 1000);
});

test('integrantes: uno mismo primero y luego el equipo', () => {
  const lista = [
    { correo: 'b@udd.cl', nombre: 'Bruno', equipo: '01' }, { correo: 'a@udd.cl', nombre: 'Ana', equipo: '01' },
    { correo: 'c@udd.cl', nombre: 'Carla', equipo: '01' }, { correo: 'd@udd.cl', nombre: 'Diego', equipo: '02' }
  ];
  const comp = C.companerosPorCorreo(lista);
  assert.deepEqual(comp['b@udd.cl'].map(x => x.nombre), ['Ana', 'Carla']);
  const ints = C.integrantesDe({ ...lista[0], companeros: comp['b@udd.cl'] });
  assert.deepEqual(ints.map(x => x.nombre), ['Bruno', 'Ana', 'Carla']);
  assert.equal(ints[0].yo, true);
  assert.equal(comp['d@udd.cl'].length, 0);
});

test('completitud: exige tareas, entregado y nota con medios puntos', () => {
  const correos = ['a', 'b'];
  const largo = 'texto suficientemente largo';
  const d = { evaluaciones: { a: { tareas: largo, entregado: largo, nota: 6.5 }, b: { tareas: 'corto', entregado: largo, nota: 6.3 } } };
  const c = C.completitudCoev(d, correos);
  assert.equal(c.completa, false);
  assert.deepEqual(c.faltan.b, ['tareas', 'nota']);
  assert.equal(C.notaValida(6.3), false);
  assert.equal(C.notaValida(1), true);
  const limpio = C.limpiarCoev({ evaluaciones: { a: { nota: 6.3, tareas: 'x', otro: 1 }, z: { nota: 7 } } }, correos);
  assert.deepEqual(limpio.evaluaciones, { a: { tareas: 'x' }, b: {} });
});

test('análisis por equipo: pares, autoevaluación y alertas', () => {
  const lista = ['a', 'b', 'c'].map(x => ({ correo: x, nombre: x.toUpperCase(), equipo: '01' }));
  const t = 'justificación de largo suficiente para no ser breve, más de cuarenta';
  const ev = notas => Object.fromEntries(Object.entries(notas).map(([k, n]) => [k, { tareas: t, entregado: t, nota: n }]));
  const docs = [
    { correo: 'a', estado: 'enviado', evaluaciones: ev({ a: 7, b: 7, c: 3 }) },
    { correo: 'b', estado: 'enviado', evaluaciones: ev({ a: 6.5, b: 7, c: 3.5 }) },
    { correo: 'c', estado: 'enviado', evaluaciones: ev({ a: 7, b: 7, c: 6.5 }) }
  ];
  const an = C.analizarAplicacion({ lista, docs });
  const c = an.equipos[0].miembros.find(m => m.correo === 'c');
  assert.equal(c.paresMedia, 3.3);
  assert.equal(c.diferencia, 3.3);
  assert.ok(c.alertas.some(a => a.tipo === 'pares-bajo'));
  assert.ok(c.alertas.some(a => a.tipo === 'sobre-auto'));
  assert.equal(an.enviados, 3);
});

test('alerta de todos con 7 y justificaciones breves; pendiente sin respuesta', () => {
  const lista = ['a', 'b'].map(x => ({ correo: x, nombre: x, equipo: '02' }));
  const docs = [{ correo: 'a', estado: 'enviado', evaluaciones: { a: { tareas: 'Su parte.', entregado: 'Bien.', nota: 7 }, b: { tareas: 'Su parte.', entregado: 'Bien.', nota: 7 } } }];
  const an = C.analizarAplicacion({ lista, docs });
  const [a, b] = an.equipos[0].miembros;
  assert.ok(a.alertas.some(x => x.tipo === 'todos-7'));
  assert.equal(b.estado, 'pendiente');
  assert.equal(an.faltan.length, 1);
});

test('nota individual: equipo × factor, −0,5 sin coevaluación, mínimo 1', () => {
  assert.equal(C.notaIndividual(6.2, 1, true), 6.2);
  assert.equal(C.notaIndividual(6.2, 0.6, true), 3.7);
  assert.equal(C.notaIndividual(6, 1, false), 5.5);
  assert.equal(C.notaIndividual(2, 0.2, false), 1);
  assert.equal(C.notaIndividual(null, 1, true), null);
});
