import { store } from './services/store.js';
import { verificarSolucion, historialVerificaciones } from './services/verificador-remoto.js';
import { normalizarCorreo, rutValido, normalizarRut, formatearRut, normalizarCodigo } from './domain/identidad.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }[c]));
let sesion = null;

function fecha(iso) { return iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function mensajeError(err) { return err?.message || 'No fue posible completar la operación. Revisa tu conexión e inténtalo de nuevo.'; }

function mostrar(vista) { $('#vistaIngreso').hidden = vista !== 'ingreso'; $('#vistaVerificador').hidden = vista !== 'verificador'; $('#sesion').hidden = vista === 'ingreso'; }
function prepararRut() {
  $('#rut').addEventListener('input', e => { const limpio = e.target.value.replace(/[^0-9kK]/g, ''); if (limpio.length >= 2) e.target.value = formatearRut(limpio); });
}

async function cargarHistorial() {
  const caja = $('#historial'); caja.innerHTML = '<p class="muted">Actualizando historial…</p>';
  try {
    const { registros } = await historialVerificaciones(sesion?.participante?.correo, sesion?.curso);
    if (!registros.length) { caja.innerHTML = '<p class="muted">Aún no hay verificaciones registradas para este equipo.</p>'; return; }
    caja.innerHTML = `<table class="tabla"><thead><tr><th>Fecha</th><th>Entrega</th><th>Resultado</th></tr></thead><tbody>${registros.map(r => `<tr><td>${esc(fecha(r.fecha))}</td><td>${esc(r.etiqueta_entrega || 'Entrega')}</td><td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span></td></tr>`).join('')}</tbody></table>`;
  } catch (err) { caja.innerHTML = `<p class="error-form">${esc(mensajeError(err))}</p>`; }
}

function renderResultado(datos) {
  const r = datos.resultado;
  const diagnosticos = !r.valida && r.diagnosticos?.length ? `<section class="condiciones"><h3>Qué revisar</h3>${r.diagnosticos.map(d => `<div class="condicion falla"><span class="marca-estado">!</span><div><b>${esc(d.categoria)}</b><ul class="resultado-lista">${(d.detalles || []).map(detalle => `<li>${esc(detalle)}</li>`).join('')}</ul></div></div>`).join('')}</section>` : '';
  $('#resultado').innerHTML = `<article><header class="resultado-cabeza ${r.valida ? 'ok' : 'no'}"><div><p class="kicker">Resultado registrado · ${esc(r.etiqueta_entrega || 'Entrega')}</p><h2>${r.valida ? 'Solución factible' : 'Solución no factible'}</h2></div><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Factible' : 'No factible'}</span></header><div class="resultado-cuerpo"><p>${r.valida ? 'La solución cumple las restricciones verificadas para esta entrega.' : 'La solución no cumple las restricciones verificadas para esta entrega.'}</p>${diagnosticos}</div></article>`;
  $('#resultado').hidden = false;
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  try { renderResultado(await verificarSolucion(await archivo.text(), document.querySelector('input[name="instancia"]:checked').value, sesion?.participante?.correo, sesion?.curso)); await cargarHistorial(); }
  catch (err) { $('#errorVerificar').textContent = mensajeError(err); }
  finally { btn.disabled = false; btn.textContent = 'Verificar solución'; }
});
$('#actualizarHistorial').addEventListener('click', cargarHistorial);
$('#salir').addEventListener('click', async () => { await store.salir(); sesion = null; $('#formIngreso').reset(); $('#resultado').hidden = true; mostrar('ingreso'); });
prepararRut();
