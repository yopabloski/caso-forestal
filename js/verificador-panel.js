import { store } from './services/store.js';
import { resumenVerificacionesDocente } from './services/verificador-remoto.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => typeof n === 'number' ? n.toLocaleString('es-CL', { maximumFractionDigits: 3 }) : '—';
const fecha = iso => iso ? new Date(iso).toLocaleString('es-CL') : '—';
const csv = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
let datos = null;
let cursos = [];

function comparaciones(registro) {
  const pares = Object.entries(registro.comparacion_metricas || {});
  return pares.length ? pares.map(([nombre, valores]) => `${nombre}: ${num(valores.reportado)} / ${num(valores.recalculado)} (Δ ${num(valores.diferencia)})`).join('<br>') : 'Sin métricas comparables';
}

function registrosFiltrados() {
  const equipo = $('#selEquipo').value;
  return (datos?.registros || []).filter(r => !equipo || r.equipo === equipo);
}

function poblarEquipos() {
  const previo = $('#selEquipo').value;
  const equipos = [...new Set((datos?.registros || []).map(r => r.equipo).filter(Boolean))].sort();
  $('#selEquipo').innerHTML = `<option value="">Todos los equipos</option>${equipos.map(e => `<option value="${esc(e)}">Equipo ${esc(e)}</option>`).join('')}`;
  $('#selEquipo').value = equipos.includes(previo) ? previo : '';
}

function render() {
  const registros = registrosFiltrados();
  const equipo = $('#selEquipo').value;
  const entregas = (datos?.entregas || []).filter(r => !equipo || r.equipo === equipo);
  $('#resumen').innerHTML = entregas.length
    ? `<table class="tabla"><thead><tr><th>Equipo</th><th>Entrega</th><th>Intentos</th><th>Primera factible</th><th>Último resultado</th></tr></thead><tbody>${entregas.map(r => `<tr><td>${esc(r.equipo)}</td><td>${esc(r.etiqueta_entrega)}</td><td>${r.pruebas}</td><td>${esc(fecha(r.primera_valida))}</td><td><span class="pill ${r.ultima_valida ? 'ok' : 'no'}">${r.ultima_valida ? 'Factible' : 'No factible'}</span></td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No hay verificaciones para este filtro.</p>';
  $('#comparaciones').innerHTML = registros.length
    ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Equipo</th><th>Entrega</th><th>Resultado</th><th>Archivo / recalculado / diferencia</th></tr></thead><tbody>${registros.map(r => `<tr><td>${esc(fecha(r.fecha))}</td><td>${esc(r.equipo)}</td><td>${esc(r.etiqueta_entrega)}</td><td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span></td><td class="mono">${comparaciones(r)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No hay datos para comparar.</p>';
  const conteo = new Map();
  registros.forEach(r => (r.errores || []).forEach(e => conteo.set(e, (conteo.get(e) || 0) + 1)));
  const errores = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  $('#errores').innerHTML = errores.length
    ? `<table class="tabla"><thead><tr><th>Error</th><th class="num">Veces</th></tr></thead><tbody>${errores.map(([e, n]) => `<tr><td>${esc(e)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">No hay errores para este filtro.</p>';
}

async function cargar() {
  try {
    datos = await resumenVerificacionesDocente(store.cursoActualId());
    poblarEquipos();
    render();
  } catch (e) { $('#error').textContent = e.message || 'No fue posible cargar el panel.'; }
}

async function cargarCursos() {
  cursos = await store.listarCursos();
  $('#selCurso').innerHTML = cursos.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} · ${esc(c.periodo)}</option>`).join('');
  if (cursos.length) { store.fijarCursoActual(cursos[0].id); $('#selCurso').value = cursos[0].id; }
}

$('#entrar').addEventListener('click', async () => {
  $('#error').textContent = '';
  try {
    await store.entrarDocente(); await cargarCursos();
    $('#ingreso').hidden = true; $('#panel').hidden = false;
    await cargar();
  } catch (e) { $('#error').textContent = e.message || 'No fue posible ingresar.'; }
});
$('#selCurso').addEventListener('change', async e => { store.fijarCursoActual(e.target.value); await cargar(); });
$('#selEquipo').addEventListener('change', render);
$('#salir').addEventListener('click', async () => { await store.salirDocente(); $('#panel').hidden = true; $('#ingreso').hidden = false; });
$('#csv').addEventListener('click', () => {
  if (!datos) return;
  const filas = [['Fecha', 'Equipo', 'Entrega', 'Resultado', 'Métrica', 'Valor archivo', 'Valor recalculado', 'Diferencia']];
  for (const r of registrosFiltrados()) {
    const comparacion = Object.entries(r.comparacion_metricas || {});
    if (!comparacion.length) filas.push([r.fecha, r.equipo, r.etiqueta_entrega, r.valida ? 'Factible' : 'No factible', '', '', '', '']);
    for (const [metrica, v] of comparacion) filas.push([r.fecha, r.equipo, r.etiqueta_entrega, r.valida ? 'Factible' : 'No factible', metrica, v.reportado, v.recalculado, v.diferencia]);
  }
  const u = URL.createObjectURL(new Blob(['\uFEFF' + filas.map(r => r.map(csv).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = u; a.download = 'registro-verificador-filtrado.csv'; a.click(); URL.revokeObjectURL(u);
});
