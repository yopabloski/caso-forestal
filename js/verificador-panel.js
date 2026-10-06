import { store } from './services/store.js';
import { resumenVerificacionesDocente } from './services/verificador-remoto.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => typeof n === 'number' ? n.toLocaleString('es-CL', { maximumFractionDigits: 3 }) : '—';
const fecha = iso => iso ? new Date(iso).toLocaleString('es-CL') : '—';
const csv = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
let datos = null;

function comparaciones(registro) {
  const pares = Object.entries(registro.comparacion_metricas || {});
  if (!pares.length) return 'Sin métricas comparables';
  return pares.map(([nombre, valores]) => `${nombre}: ${num(valores.reportado)} / ${num(valores.recalculado)} (Δ ${num(valores.diferencia)})`).join('<br>');
}

async function cargar() {
  try {
    datos = await resumenVerificacionesDocente();
    const entregas = datos.entregas || [];
    $('#resumen').innerHTML = entregas.length
      ? `<table class="tabla"><thead><tr><th>Equipo</th><th>Entrega</th><th>Intentos</th><th>Primera factible</th><th>Último resultado</th></tr></thead><tbody>${entregas.map(r => `<tr><td>${esc(r.equipo)}</td><td>${esc(r.etiqueta_entrega)}</td><td>${r.pruebas}</td><td>${esc(fecha(r.primera_valida))}</td><td><span class="pill ${r.ultima_valida ? 'ok' : 'no'}">${r.ultima_valida ? 'Factible' : 'No factible'}</span></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Aún no hay verificaciones registradas.</p>';
    const registros = datos.registros || [];
    $('#comparaciones').innerHTML = registros.length
      ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Equipo</th><th>Entrega</th><th>Resultado</th><th>Archivo / recalculado / diferencia</th></tr></thead><tbody>${registros.map(r => `<tr><td>${esc(fecha(r.fecha))}</td><td>${esc(r.equipo)}</td><td>${esc(r.etiqueta_entrega)}</td><td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span></td><td class="mono">${comparaciones(r)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Aún no hay datos para comparar.</p>';
    $('#errores').innerHTML = datos.errores_frecuentes?.length
      ? `<table class="tabla"><thead><tr><th>Error</th><th class="num">Veces</th></tr></thead><tbody>${datos.errores_frecuentes.map(([e, n]) => `<tr><td>${esc(e)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Aún no hay errores registrados.</p>';
  } catch (e) { $('#error').textContent = e.message || 'No fue posible cargar el panel.'; }
}

$('#entrar').addEventListener('click', async () => {
  $('#error').textContent = '';
  try { await store.entrarDocente(); $('#ingreso').hidden = true; $('#panel').hidden = false; await cargar(); }
  catch (e) { $('#error').textContent = e.message || 'No fue posible ingresar.'; }
});
$('#salir').addEventListener('click', async () => { await store.salirDocente(); $('#panel').hidden = true; $('#ingreso').hidden = false; });
$('#csv').addEventListener('click', () => {
  if (!datos) return;
  const filas = [['Fecha', 'Equipo', 'Entrega', 'Resultado', 'Métrica', 'Valor archivo', 'Valor recalculado', 'Diferencia']];
  for (const r of datos.registros || []) {
    const comparacion = Object.entries(r.comparacion_metricas || {});
    if (!comparacion.length) filas.push([r.fecha, r.equipo, r.etiqueta_entrega, r.valida ? 'Factible' : 'No factible', '', '', '', '']);
    for (const [metrica, v] of comparacion) filas.push([r.fecha, r.equipo, r.etiqueta_entrega, r.valida ? 'Factible' : 'No factible', metrica, v.reportado, v.recalculado, v.diferencia]);
  }
  const u = URL.createObjectURL(new Blob(['\uFEFF' + filas.map(r => r.map(csv).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = u; a.download = 'registro-verificador-docente.csv'; a.click(); URL.revokeObjectURL(u);
});
