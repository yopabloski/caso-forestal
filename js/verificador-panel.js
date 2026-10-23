import { store } from './services/store.js';
import { resumenVerificacionesDocente, archivoVerificacionDocente } from './services/verificador-remoto.js';
import { usd, fechaCorta } from './verificador-vista.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esNum = n => typeof n === 'number' && Number.isFinite(n);
const pct = n => esNum(n) ? (100 * n).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%' : '—';
const quien = c => esc(String(c || '').split('@')[0] || '—');
const sello = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
let datos = null;

const filtrados = () => (datos?.registros || []).filter(r =>
  (!$('#selEquipo').value || r.equipo === $('#selEquipo').value) && (!$('#selEntrega').value || r.entrega === $('#selEntrega').value));

function poblarFiltros() {
  for (const [sel, campo, todos, etiqueta] of [['#selEquipo', 'equipo', 'Todos los equipos', e => `Equipo ${e}`], ['#selEntrega', 'entrega', 'Todas las entregas', null]]) {
    const previo = $(sel).value;
    const pares = new Map((datos?.registros || []).map(r => [r[campo], campo === 'entrega' ? r.etiqueta_entrega : etiqueta(r[campo])]));
    const claves = [...pares.keys()].filter(Boolean).sort();
    $(sel).innerHTML = `<option value="">${todos}</option>${claves.map(k => `<option value="${esc(k)}">${esc(pares.get(k))}</option>`).join('')}`;
    $(sel).value = claves.includes(previo) ? previo : '';
  }
}

function agrupado(registros) {
  const g = new Map();
  for (const r of [...registros].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))) {
    const k = `${r.equipo}::${r.entrega}`;
    const x = g.get(k) || { equipo: r.equipo, entrega: r.entrega, etiqueta: r.etiqueta_entrega, intentos: 0, autores: new Set(), primera: null, mejor: null, ultimo: null };
    x.intentos++; x.autores.add(r.correo); x.ultimo = r;
    if (r.valida) { if (!x.primera) x.primera = r; if (!x.mejor || r.costo_recalculado < x.mejor.costo_recalculado) x.mejor = r; }
    g.set(k, x);
  }
  return [...g.values()].sort((a, b) => a.equipo.localeCompare(b.equipo) || a.entrega.localeCompare(b.entrega));
}

function render() {
  const regs = filtrados(), grupos = agrupado(regs);
  const equipos = new Set(regs.map(r => r.equipo)), conValida = new Set(regs.filter(r => r.valida).map(r => r.equipo));
  $('#kpis').innerHTML = `<div class="cifra principal-cifra"><small>Intentos</small><b>${regs.length}</b><span>${equipos.size} equipos</span></div>
    <div class="cifra ok"><small>Equipos con solución factible</small><b>${conValida.size} / ${equipos.size}</b><span>en el filtro actual</span></div>
    <div class="cifra"><small>Intentos factibles</small><b>${pct(regs.length ? regs.filter(r => r.valida).length / regs.length : NaN)}</b><span>del total</span></div>`;
  $('#resumen').innerHTML = grupos.length ? `<table class="tabla"><thead><tr><th>Equipo</th><th>Entrega</th><th class="num">Intentos</th><th class="num">Integrantes</th><th>Primera factible</th><th class="num">Mejor costo factible</th><th class="num">Brecha</th><th>Último</th></tr></thead><tbody>${grupos.map(x => `<tr>
    <td class="mono">${esc(x.equipo)}</td><td>${esc(x.etiqueta)}</td><td class="num">${x.intentos}</td><td class="num">${x.autores.size}</td>
    <td>${x.primera ? esc(fechaCorta(x.primera.fecha)) : '—'}</td><td class="num">${x.mejor ? usd(x.mejor.costo_recalculado) : '—'}</td>
    <td class="num ${x.mejor && esNum(x.mejor.brecha_referencia) ? (x.mejor.brecha_referencia <= 1e-4 ? 'optimo' : 'positivo') : ''}">${x.mejor ? pct(x.mejor.brecha_referencia) : '—'}</td>
    <td><span class="pill ${x.ultimo.valida ? 'ok' : 'no'}">${x.ultimo.valida ? 'Factible' : 'No factible'}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No hay verificaciones para este filtro.</p>';
  $('#evolucion').innerHTML = regs.length ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Equipo</th><th>Entrega</th><th>Resultado</th><th class="num">Reportado</th><th class="num">Recalculado</th><th class="num">Gap informado</th><th class="num">Brecha</th><th></th></tr></thead><tbody>${regs.map(r => `<tr>
    <td>${esc(fechaCorta(r.fecha))}<small>${quien(r.correo)}</small></td><td class="mono">${esc(r.equipo)}</td><td>${esc(r.etiqueta_entrega)}<small class="mono">${esc(r.caso)}</small></td>
    <td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span>${r.errores?.length ? `<small>${r.errores.length} errores</small>` : ''}</td>
    <td class="num">${usd(r.costo_reportado)}</td><td class="num">${usd(r.costo_recalculado)}</td><td class="num">${pct(r.gap_calculado)}</td>
    <td class="num">${pct(r.brecha_referencia)}</td><td><button class="enlace" type="button" data-archivo="${esc(r.id)}">Archivo</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sin intentos.</p>';
  const conteo = new Map();
  regs.forEach(r => (r.errores || []).forEach(e => { const k = String(e).replace(/\d[\d.,]*/g, '#'); conteo.set(k, (conteo.get(k) || 0) + 1); }));
  const errores = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  $('#errores').innerHTML = errores.length ? `<table class="tabla"><thead><tr><th>Error (los números se agrupan como #)</th><th class="num">Veces</th></tr></thead><tbody>${errores.map(([e, n]) => `<tr><td>${esc(e)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No hay errores para este filtro.</p>';
}

function filasExport() {
  return filtrados().map(r => ({
    Fecha: r.fecha, Equipo: r.equipo, Integrante: r.correo, Instancia: r.instancia, Entrega: r.etiqueta_entrega, Caso: r.caso,
    Factible: r.valida ? 'Sí' : 'No', Errores: (r.errores || []).length, 'Costo reportado': r.costo_reportado, 'Costo recalculado': r.costo_recalculado,
    'Cota reportada': r.cota_reportada, 'Gap informado': r.gap_calculado, 'Brecha vs referencia': r.brecha_referencia,
    'Km caminos': r.indicadores?.km_caminos, 'Tránsito m3·km': r.indicadores?.transito_m3km, 'Ha junto al nativo': r.indicadores?.ha_junto_al_nativo,
    Huella: r.huella, Registro: r.id, 'Detalle de errores': (r.errores || []).join(' | '), Advertencias: (r.advertencias || []).join(' | '),
  }));
}
function bajar(blob, nombre) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }

async function cargar() {
  $('#resumen').innerHTML = '<p class="muted">Cargando…</p>';
  try { datos = await resumenVerificacionesDocente(store.cursoActualId()); poblarFiltros(); render(); }
  catch (e) { $('#resumen').innerHTML = `<p class="error-form">${esc(e.message || 'No fue posible cargar el panel.')}</p>`; }
}
async function cargarCursos() {
  const cursos = await store.listarCursos();
  $('#selCurso').innerHTML = cursos.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} · ${esc(c.periodo)}</option>`).join('');
  if (cursos.length) { store.fijarCursoActual(cursos[0].id); $('#selCurso').value = cursos[0].id; }
}

$('#entrar').addEventListener('click', async () => {
  $('#error').textContent = '';
  try { await store.entrarDocente(); await cargarCursos(); $('#ingreso').hidden = true; $('#panel').hidden = false; await cargar(); }
  catch (e) { $('#error').textContent = e.message || 'No fue posible ingresar.'; }
});
$('#selCurso').addEventListener('change', async e => { store.fijarCursoActual(e.target.value); await cargar(); });
$('#selEquipo').addEventListener('change', render);
$('#selEntrega').addEventListener('change', render);
$('#actualizar').addEventListener('click', cargar);
$('#salir').addEventListener('click', async () => { await store.salirDocente(); $('#panel').hidden = true; $('#ingreso').hidden = false; });
$('#evolucion').addEventListener('click', async e => {
  const b = e.target.closest('[data-archivo]'); if (!b) return;
  b.textContent = 'Bajando…';
  try { const a = await archivoVerificacionDocente(b.dataset.archivo, store.cursoActualId()); bajar(new Blob([a.contenido], { type: 'text/plain;charset=utf-8' }), `equipo${a.equipo}_${(a.fecha || '').slice(0, 16).replace(/[-:T]/g, '')}_${a.id}.txt`); b.textContent = 'Archivo'; }
  catch (err) { b.textContent = 'Sin archivo'; b.title = err.message || ''; }
});
$('#csv').addEventListener('click', () => {
  const filas = filasExport(); if (!filas.length) return;
  const cab = Object.keys(filas[0]), q = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  bajar(new Blob(['﻿' + [cab, ...filas.map(f => cab.map(k => f[k]))].map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }), `verificador_${sello()}.csv`);
});
$('#xlsx').addEventListener('click', () => {
  if (!window.XLSX) return alert('No se pudo cargar el generador de Excel. Usa el CSV.');
  const X = window.XLSX, wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filasExport()), 'Intentos');
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(agrupado(filtrados()).map(x => ({ Equipo: x.equipo, Entrega: x.etiqueta, Intentos: x.intentos, Integrantes: x.autores.size,
    'Primera factible': x.primera?.fecha || '', 'Mejor costo factible': x.mejor?.costo_recalculado ?? '', 'Brecha del mejor': x.mejor?.brecha_referencia ?? '', 'Último factible': x.ultimo.valida ? 'Sí' : 'No' }))), 'Resumen');
  X.writeFile(wb, `verificador_${sello()}.xlsx`);
});
