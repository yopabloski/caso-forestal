import { store } from './services/store.js';
import { verificarSolucion, historialVerificaciones, detalleVerificacion } from './services/verificador-remoto.js';
import { normalizarCorreo, rutValido, normalizarRut, formatearRut, normalizarCodigo } from './domain/identidad.js';
import { renderResultado, usd, fechaCorta } from './verificador-vista.js';
import { comprobanteHtml } from './verificador-comprobante.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sesion = null;
let actual = null; // { id, fecha, huella, resultado }

function mensajeError(err) { return err?.message || 'No fue posible completar la operación. Revisa tu conexión e inténtalo de nuevo.'; }
function mostrar(vista) { $('#vistaIngreso').hidden = vista !== 'ingreso'; $('#vistaVerificador').hidden = vista !== 'verificador'; $('#sesion').hidden = vista === 'ingreso'; }
function prepararRut() {
  $('#rut').addEventListener('input', e => { const limpio = e.target.value.replace(/[^0-9kK]/g, ''); if (limpio.length >= 2) e.target.value = formatearRut(limpio); });
}
const quien = correo => esc(String(correo || '').split('@')[0]);

async function cargarHistorial() {
  const caja = $('#historial'); caja.innerHTML = '<p class="muted">Actualizando historial…</p>';
  try {
    const { registros } = await historialVerificaciones(sesion?.participante?.correo, sesion?.curso);
    if (!registros.length) { caja.innerHTML = '<p class="muted">Aún no hay verificaciones registradas para este equipo.</p>'; return; }
    caja.innerHTML = `<table class="tabla"><thead><tr><th>Fecha</th><th>Entrega</th><th>Resultado</th><th class="num">Costo</th><th></th></tr></thead><tbody>${registros.map(r => `<tr${actual?.id === r.id ? ' class="activa"' : ''}>
      <td>${esc(fechaCorta(r.fecha))}<small class="quien">${quien(r.correo)}</small></td><td>${esc(r.etiqueta_entrega || 'Entrega')}</td>
      <td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span></td>
      <td class="num">${usd(r.costo_recalculado)}</td><td><button class="enlace" type="button" data-ver="${esc(r.id)}">Ver</button></td></tr>`).join('')}</tbody></table>`;
  } catch (err) { caja.innerHTML = `<p class="error-form">${esc(mensajeError(err))}</p>`; }
}

function renderActual() {
  $('#resultado').innerHTML = renderResultado(actual.resultado, { id: actual.id, huella: actual.huella, fecha: actual.fecha });
  $('#resultado').hidden = false;
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function descargarComprobante() {
  if (!actual) return;
  const html = comprobanteHtml({ ...actual, equipo: sesion?.ficha?.equipo || sesion?.participante?.equipo, correo: actual.correo || sesion?.participante?.correo });
  const u = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a'); a.href = u;
  a.download = `comprobante_equipo${sesion?.ficha?.equipo || ''}_${actual.id}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}

$('#formIngreso').addEventListener('submit', async e => {
  e.preventDefault(); $('#errorIngreso').textContent = '';
  const correo = normalizarCorreo($('#correo').value), rut = normalizarRut($('#rut').value), codigo = normalizarCodigo($('#codigo').value);
  if (!correo.endsWith('@udd.cl') || !rutValido(rut) || codigo.length < 4) { $('#errorIngreso').textContent = 'Escribe tu correo UDD, RUT válido y la clave del verificador.'; return; }
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    sesion = await store.ingresar({ correo, rut, codigo });
    if (sesion.aplicacion !== 'verificador') throw new Error('La clave corresponde a otra actividad, no al verificador.');
    $('#equipo').textContent = sesion.ficha?.equipo || sesion.participante?.equipo || '—'; $('#equipoSesion').textContent = $('#equipo').textContent;
    mostrar('verificador'); await cargarHistorial();
  } catch (err) { $('#errorIngreso').textContent = mensajeError(err); }
  finally { btn.disabled = false; btn.textContent = 'Ingresar al verificador'; }
});

$('#archivo').addEventListener('change', e => { const f = e.target.files?.[0]; $('#nombreArchivo').textContent = f ? `${f.name} · ${(f.size / 1024).toFixed(1)} KB` : 'Máximo 600 KB.'; });
$('#formVerificar').addEventListener('submit', async e => {
  e.preventDefault(); $('#errorVerificar').textContent = '';
  const archivo = $('#archivo').files?.[0]; if (!archivo) { $('#errorVerificar').textContent = 'Selecciona un archivo de solución.'; return; }
  if (archivo.size > 600000) { $('#errorVerificar').textContent = 'El archivo supera el límite de 600 KB.'; return; }
  const btn = $('#botonVerificar'); btn.disabled = true; btn.textContent = 'Verificando en el servidor…'; $('#resultado').hidden = true;
  try {
    const r = await verificarSolucion(await archivo.text(), document.querySelector('input[name="instancia"]:checked').value, sesion?.participante?.correo, sesion?.curso);
    actual = { ...r, correo: sesion?.participante?.correo };
    renderActual(); await cargarHistorial();
  } catch (err) { $('#errorVerificar').textContent = mensajeError(err); }
  finally { btn.disabled = false; btn.textContent = 'Verificar solución'; }
});
$('#historial').addEventListener('click', async e => {
  const id = e.target.closest('[data-ver]')?.dataset.ver; if (!id) return;
  e.target.textContent = 'Abriendo…';
  try { actual = await detalleVerificacion(id, sesion?.participante?.correo, sesion?.curso); renderActual(); await cargarHistorial(); }
  catch (err) { e.target.textContent = 'Ver'; $('#errorVerificar').textContent = mensajeError(err); }
});
$('#resultado').addEventListener('click', e => { if (e.target.closest('[data-comprobante]')) descargarComprobante(); });
$('#actualizarHistorial').addEventListener('click', cargarHistorial);
$('#salir').addEventListener('click', async () => { await store.salir(); sesion = null; actual = null; $('#formIngreso').reset(); $('#resultado').hidden = true; mostrar('ingreso'); });
prepararRut();
