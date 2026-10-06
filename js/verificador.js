import { store } from './services/store.js';
import { verificarSolucion, historialVerificaciones } from './services/verificador-remoto.js';
import { normalizarCorreo, rutValido, normalizarRut, formatearRut } from './domain/identidad.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }[c]));
const CLAVE_VERIFICADOR = 'FCS-VER'; // habilitada por el docente solo para registrar la sesión del caso
let sesion = null, ultimo = null;

function moneda(n) { return typeof n === 'number' ? `US$ ${n.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '—'; }
function numero(n, d = 1) { return typeof n === 'number' ? n.toLocaleString('es-CL', { maximumFractionDigits: d }) : '—'; }
function fecha(iso) { return iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function mensajeError(err) { return err?.message || 'No fue posible completar la operación. Revisa tu conexión e inténtalo de nuevo.'; }

function mostrar(vista) { $('#vistaIngreso').hidden = vista !== 'ingreso'; $('#vistaVerificador').hidden = vista !== 'verificador'; $('#sesion').hidden = vista === 'ingreso'; }
function prepararRut() {
  $('#rut').addEventListener('input', e => { const limpio = e.target.value.replace(/[^0-9kK]/g, ''); if (limpio.length >= 2) e.target.value = formatearRut(limpio); });
}

async function cargarHistorial() {
  const caja = $('#historial'); caja.innerHTML = '<p class="muted">Actualizando historial…</p>';
  try {
    const { registros } = await historialVerificaciones(sesion?.participante?.correo);
    if (!registros.length) { caja.innerHTML = '<p class="muted">Aún no hay verificaciones registradas para este equipo.</p>'; return; }
    caja.innerHTML = `<table class="tabla"><thead><tr><th>Fecha</th><th>Instancia</th><th>CASO</th><th>Resultado</th><th>Errores</th><th class="num">Costo</th></tr></thead><tbody>${registros.map(r => `<tr><td>${esc(fecha(r.fecha))}</td><td>${r.instancia === 'mini' ? 'Mini instancia' : 'Predio'}</td><td><span class="mono">${esc(r.caso || '—')}</span></td><td><span class="pill ${r.valida ? 'ok' : 'no'}">${r.valida ? 'Válida' : 'No válida'}</span></td><td>${r.errores}</td><td class="num">${esc(moneda(r.costo_recalculado))}</td></tr>`).join('')}</tbody></table>`;
  } catch (err) { caja.innerHTML = `<p class="error-form">${esc(mensajeError(err))}</p>`; }
}

function renderResultado(datos) {
  const r = datos.resultado; ultimo = datos;
  const i = r.indicadores || {};
  const errores = r.errores?.length ? `<h3>Qué debes corregir</h3><ul class="resultado-lista">${r.errores.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '';
  const advertencias = r.advertencias?.length ? `<h3>Advertencias</h3><ul class="resultado-lista">${r.advertencias.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '';
  const condiciones = r.condiciones?.length ? `<section class="condiciones"><h3>Condiciones del plan</h3>${r.condiciones.map(c => `<div class="condicion ${c.cumple ? 'cumple' : c.exigida ? 'falla' : 'no-exigida'}"><span class="marca-estado">${c.cumple ? '✓' : c.exigida ? '!' : '·'}</span><div><b>${esc(c.nombre)}${c.exigida ? '' : ' · no exigida'}</b><p>${esc(c.detalle)}</p></div></div>`).join('')}</section>` : '';
  $('#resultado').innerHTML = `<article><header class="resultado-cabeza ${r.valida ? 'ok' : 'no'}"><div><p class="kicker">${r.valida ? 'Resultado registrado' : 'Resultado registrado · requiere corrección'}</p><h2>${r.valida ? 'Solución válida' : 'Solución no válida'}</h2></div><span class="pill ${r.valida ? 'ok' : 'no'}">${r.errores?.length || 0} error${r.errores?.length === 1 ? '' : 'es'}</span></header><div class="resultado-cuerpo">${r.valida ? '<p>Tu solución cumple las restricciones revisadas para el caso declarado en el archivo.</p>' : '<p>Corrige los errores indicados y vuelve a verificar. Las advertencias no invalidan por sí solas la solución.</p>'}${errores}${advertencias}<div class="indicadores"><div class="indicador"><small>Costo recalculado</small><b>${esc(moneda(i.costo_total))}</b></div><div class="indicador"><small>Caminos</small><b>${esc(numero(i.km_caminos))} km</b></div><div class="indicador"><small>Rodales</small><b>${esc(numero(i.rodales_cosechados, 0))}</b></div><div class="indicador"><small>Tránsito</small><b>${esc(numero(i.transito_m3km, 0))} m³-km</b></div><div class="indicador"><small>Junto a nativo</small><b>${esc(numero(i.ha_junto_al_nativo))} ha</b></div><div class="indicador"><small>Huella archivo</small><b class="mono">${esc(r.huella_archivo)}</b></div></div>${condiciones}<div class="resultado-acciones"><button class="btn sec chico" type="button" id="descargarComprobante">Descargar comprobante</button></div></div></article>`;
  $('#resultado').hidden = false;
  $('#descargarComprobante').addEventListener('click', descargarComprobante);
  $('#resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function descargarComprobante() {
  if (!ultimo) return;
  const r = ultimo.resultado, i = r.indicadores || {};
  const texto = [`COMPROBANTE DE VERIFICACIÓN · Forestal Cordillera Sur`, `Fecha: ${fecha(ultimo.fecha)}`, `Equipo: ${r.equipo}`, `Resultado: ${r.valida ? 'SOLUCIÓN VÁLIDA' : 'SOLUCIÓN NO VÁLIDA'}`, `Caso: ${r.caso}`, `Huella del archivo: ${r.huella_archivo}`, '', `Costo recalculado: ${moneda(i.costo_total)}`, `Caminos: ${numero(i.km_caminos)} km`, '', 'Errores:', ...(r.errores || ['Sin errores']), '', 'Advertencias:', ...(r.advertencias || ['Sin advertencias'])].join('\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `comprobante-verificador-${r.huella_archivo}.txt`; a.click(); URL.revokeObjectURL(url);
}

$('#formIngreso').addEventListener('submit', async e => {
  e.preventDefault(); $('#errorIngreso').textContent = '';
  const correo = normalizarCorreo($('#correo').value), rut = normalizarRut($('#rut').value);
  if (!correo.endsWith('@udd.cl') || !rutValido(rut)) { $('#errorIngreso').textContent = 'Escribe tu correo UDD y un RUT válido.'; return; }
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    sesion = await store.ingresar({ correo, rut, codigo: CLAVE_VERIFICADOR });
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
  try { renderResultado(await verificarSolucion(await archivo.text(), document.querySelector('input[name="instancia"]:checked').value, sesion?.participante?.correo)); await cargarHistorial(); }
  catch (err) { $('#errorVerificar').textContent = mensajeError(err); }
  finally { btn.disabled = false; btn.textContent = 'Verificar solución'; }
});
$('#actualizarHistorial').addEventListener('click', cargarHistorial);
$('#salir').addEventListener('click', async () => { await store.salir(); sesion = null; $('#formIngreso').reset(); $('#resultado').hidden = true; mostrar('ingreso'); });
prepararRut();
