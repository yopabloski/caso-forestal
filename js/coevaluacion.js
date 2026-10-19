// Caso Forestal · auto y coevaluación (página del estudiante, pensada para el teléfono).
import { store, modo } from './services/store.js';
import {
  ENTREGAS, esCoev, NOTAS, REFERENCIA_NOTA, PREGUNTAS, PREGUNTA_FINAL, MIN_TEXTO, MAX_TEXTO,
  integrantesDe, completitudCoev, plazoVigente, plazoEfectivo, textoPlazo
} from './domain/coevaluacion.js';
import { correoValido, normalizarCorreo, rutValido, normalizarRut, formatearRut, normalizarCodigo } from './domain/identidad.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nota = n => String(n).replace('.', ',');
const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

const S = { participante: null, ficha: null, aplicacion: null, config: null, doc: null, datos: null, integrantes: [], plazoMs: null };

// ---------- UI ----------
const VISTAS = ['vIngreso', 'vForm', 'vEnviada', 'vCerrado', 'vCargando'];
function altoBarra() { document.documentElement.style.setProperty('--alto-barra', `${$('.barra').getBoundingClientRect().height}px`); }
window.addEventListener('resize', altoBarra);
function mostrar(id) {
  for (const v of VISTAS) $('#' + v).hidden = v !== id;
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#sesionChip').hidden = !S.participante || id === 'vIngreso';
  altoBarra();
}
let toastT;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('visible');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('visible'), 3600);
}
function mensaje(kicker, titulo, texto, { reintentar = true } = {}) {
  $('#cKicker').textContent = kicker;
  $('#cTitulo').textContent = titulo;
  $('#cTexto').textContent = texto;
  $('#btnReintentar').hidden = !reintentar;
  mostrar('vCerrado');
}

// ---------- Ingreso ----------
function marcar(input, ayuda, msg, neutro = '') {
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  ayuda.textContent = msg || neutro;
  ayuda.classList.toggle('error', Boolean(msg));
}
const AYUDA_RUT = 'El mismo con que respondiste la encuesta de inicio.';

function prepararIngreso() {
  const rut = $('#inRut');
  rut.addEventListener('input', () => {
    const limpio = rut.value.replace(/[^0-9kK]/g, '');
    if (limpio.length >= 2) rut.value = formatearRut(limpio);
  });
  $('#inCodigo').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
  const params = new URLSearchParams(location.search);
  if (params.get('codigo')) $('#inCodigo').value = normalizarCodigo(params.get('codigo'));

  $('#formIngreso').addEventListener('submit', async e => {
    e.preventDefault();
    $('#errIngreso').textContent = '';
    const correo = normalizarCorreo($('#inCorreo').value);
    const rutV = $('#inRut').value;
    const codigo = normalizarCodigo($('#inCodigo').value);
    let ok = true;
    const m = (sel, ay, cond, msg, neutro) => { marcar($(sel), $(ay), cond ? '' : msg, neutro); ok = ok && cond; };
    m('#inCorreo', '#ayCorreo', correoValido(correo), 'Usa tu correo institucional @udd.cl.');
    m('#inRut', '#ayRut', rutValido(rutV), 'RUT no válido. Revisa el dígito verificador.', AYUDA_RUT);
    m('#inCodigo', '#ayCodigo', codigo.length >= 4, 'Escribe la clave que entregó el profesor.');
    if (!ok) return;
    const btn = $('#btnIngresar');
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      const r = await store.ingresar({ correo, rut: normalizarRut(rutV), codigo });
      if (!esCoev(r.aplicacion)) {
        await store.salir();
        marcar($('#inCodigo'), $('#ayCodigo'), 'Esta clave es de otra actividad del curso.');
        return;
      }
      Object.assign(S, { participante: r.participante, aplicacion: r.aplicacion, ficha: r.ficha });
      await continuar();
    } catch (err) {
      if (!err.code) console.error(err);
      $('#errIngreso').textContent = err.code ? err.message : 'No fue posible ingresar. Revisa tu conexión e intenta de nuevo.';
      if (err.code === 'codigo-invalido') marcar($('#inCodigo'), $('#ayCodigo'), 'Clave no válida.');
      if (err.code === 'rut-no-coincide') marcar($('#inRut'), $('#ayRut'), 'No coincide con el registrado.');
      if (err.code === 'no-en-lista') marcar($('#inCorreo'), $('#ayCorreo'), 'No está en la lista del curso.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
}

// ---------- Flujo ----------
async function continuar() {
  mostrar('vCargando');
  const e = ENTREGAS[S.aplicacion];
  $('#sesionNombre').textContent = S.ficha?.nombre || S.participante.correo;
  S.config = await store.cargarConfig();
  const docs = await store.respuestasDe(S.participante.correo);
  S.doc = docs[S.aplicacion] || null;
  const ap = S.config.aplicaciones?.[S.aplicacion];
  const prorroga = S.participante.prorrogas?.[S.aplicacion];
  S.plazoMs = plazoEfectivo(ap, prorroga);

  if (S.doc?.estado === 'enviado') return verEnviada();
  if (!ap) return mensaje(e.nombre, 'Esta evaluación aún no está disponible.', 'El profesor la abrirá el día de la entrega. Intenta más tarde con la misma clave.');
  if (!plazoVigente(ap, prorroga)) {
    const vencio = Number.isFinite(S.plazoMs) && Date.now() >= S.plazoMs;
    return mensaje(`Auto y coevaluación · ${e.nombre}`,
      vencio ? 'El plazo terminó.' : 'Esta evaluación no está abierta.',
      vencio
        ? `Cerró el ${textoPlazo(S.plazoMs)}.${S.doc ? ' Tu borrador quedó guardado, pero no se envió.' : ''} Si tuviste un problema justificado, escríbele al profesor.`
        : 'Cuando el profesor la abra podrás ingresar con la misma clave.',
      { reintentar: !vencio });
  }
  S.integrantes = integrantesDe({ ...S.ficha, correo: S.participante.correo });
  if (S.integrantes.length < 2) {
    return mensaje(e.nombre, 'No encontramos a tu equipo.', 'Tu ficha del curso aún no tiene a tus compañeros. Avísale al profesor para que actualice la lista.');
  }
  abrirFormulario();
}

const bkKey = () => `fcs:bk:${S.participante.correo}:${S.aplicacion}`;

function abrirFormulario() {
  const e = ENTREGAS[S.aplicacion];
  let datos = { evaluaciones: structuredClone(S.doc?.evaluaciones || {}), comentario: S.doc?.comentario || '' };
  try {
    const bk = JSON.parse(localStorage.getItem(bkKey()));
    if (bk && (!S.doc?.actualizado || bk.t > Date.parse(S.doc.actualizado))) datos = bk.d;
  } catch {}
  S.datos = datos;
  const nombre = (S.ficha?.nombre || '').split(' ')[0];
  $('#fKicker').textContent = `Auto y coevaluación · ${e.nombre}`;
  $('#fTitulo').textContent = nombre ? `${nombre}, evalúa a tu equipo.` : 'Evalúa a tu equipo.';
  $('#fBajada').textContent = `Son ${S.integrantes.length} integrantes, incluido tú. Para cada uno: qué le tocaba, qué entregó y una nota. Se guarda solo mientras avanzas.`;
  $('#fNombre').textContent = S.ficha?.nombre || S.participante.correo;
  $('#fEquipo').textContent = S.ficha?.equipo || '—';
  $('#fPlazo').textContent = Number.isFinite(S.plazoMs) ? `Plazo: ${textoPlazo(S.plazoMs)}. Después no se puede enviar.` : '';
  $('#fEscala').innerHTML = REFERENCIA_NOTA.map(([n, t]) => `<li><b>${n}</b><span>${esc(t)}</span></li>`).join('');
  $('#fFinalTexto').textContent = PREGUNTA_FINAL;
  $('#fComentario').value = datos.comentario || '';
  $('#fGuardado').textContent = S.doc?.actualizado ? `Guardado ${hora(S.doc.actualizado)}` : '';
  $('#fGuardado').classList.remove('error');
  avisoPlazo();
  render();
  mostrar('vForm');
}

function avisoPlazo() {
  const caja = $('#fAviso');
  if (!Number.isFinite(S.plazoMs)) { caja.hidden = true; return; }
  const min = Math.round((S.plazoMs - Date.now()) / 60000);
  caja.hidden = min > 120;
  if (min <= 120) caja.innerHTML = `<p><b>${min <= 0 ? 'El plazo terminó.' : `Quedan ${min < 60 ? `${min} minutos` : `${Math.floor(min / 60)} h ${min % 60} min`}.`}</b> Envía antes de las ${esc(new Date(S.plazoMs).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }))}: después la evaluación cuenta como no entregada.</p>`;
}
setInterval(() => { if (!$('#vForm').hidden) avisoPlazo(); }, 30000);

function render() {
  $('#fEvaluados').innerHTML = S.integrantes.map((p, i) => {
    const ev = S.datos.evaluaciones[p.correo] || {};
    const campo = (k, ph) => `<label class="campo">
        <span>${esc(PREGUNTAS[k].titulo)}</span>
        <small class="ayuda">${esc(PREGUNTAS[k].ayuda)}</small>
        <textarea data-k="${k}" rows="3" maxlength="${MAX_TEXTO}" placeholder="${esc(ph)}">${esc(ev[k] || '')}</textarea>
      </label>`;
    return `<li class="evaluado tarjeta" data-correo="${esc(p.correo)}">
      <header class="ev-cabeza">
        <span class="ev-n">${i + 1}</span>
        <div><h2>${esc(p.nombre)}</h2><p class="ev-sub">${p.yo ? 'Tú · autoevaluación' : 'Coevaluación'}</p></div>
        <span class="ev-estado" aria-hidden="true"></span>
      </header>
      ${campo('tareas', p.yo ? 'Ej.: formular las restricciones de flujo y revisar el .dat' : 'Ej.: implementar el modelo en OPL')}
      ${campo('entregado', p.yo ? 'Qué hiciste, cuándo y con qué calidad' : 'Qué hizo, cuándo y con qué calidad')}
      <fieldset class="campo notas">
        <legend><span>${esc(PREGUNTAS.nota.titulo)}</span><small class="ayuda">${esc(PREGUNTAS.nota.ayuda)}</small></legend>
        <div class="notas-rejilla" role="radiogroup" aria-label="Nota de ${esc(p.nombre)}">
          ${NOTAS.map(n => `<button type="button" role="radio" class="nota${Number.isInteger(n) ? ' entera' : ''}" data-n="${n}" aria-checked="${ev.nota === n}">${nota(n)}</button>`).join('')}
        </div>
      </fieldset>
      <p class="ev-falta" aria-live="polite"></p>
    </li>`;
  }).join('');
  for (const li of document.querySelectorAll('.evaluado')) marcarEvaluado(li, false);
  progreso();
}

function faltaTexto(f) {
  const m = { tareas: 'tareas', entregado: 'lo entregado', nota: 'la nota' };
  return f.map(x => m[x]).join(', ').replace(/, ([^,]*)$/, ' y $1');
}
function marcarEvaluado(li, mostrarFalta) {
  const c = completitudCoev(S.datos, [li.dataset.correo]);
  const f = c.faltan[li.dataset.correo];
  li.classList.toggle('completo', !f);
  if (!f) { li.classList.remove('falta'); li.querySelector('.ev-falta').textContent = ''; }
  else if (mostrarFalta || li.classList.contains('falta')) {
    li.classList.add('falta');
    li.querySelector('.ev-falta').textContent = `Falta ${faltaTexto(f)}${f.some(x => x !== 'nota') ? ` (al menos ${MIN_TEXTO} caracteres)` : ''}.`;
  }
}
function progreso() {
  const c = completitudCoev(S.datos, S.integrantes.map(p => p.correo));
  const pct = Math.round((c.hechos / c.total) * 100);
  $('#fFill').style.width = `${pct}%`;
  $('#fProg').setAttribute('aria-valuenow', String(pct));
  $('#fCuenta').textContent = `${c.hechos}/${c.total}`;
  return c;
}

let guardarT = null;
function programarGuardado(espera = 1200) {
  try { localStorage.setItem(bkKey(), JSON.stringify({ t: Date.now(), d: S.datos })); } catch {}
  $('#fGuardado').textContent = 'Guardando…';
  $('#fGuardado').classList.remove('error');
  clearTimeout(guardarT);
  guardarT = setTimeout(guardarAhora, espera);
}
async function guardarAhora() {
  clearTimeout(guardarT);
  guardarT = null;
  if (!S.datos) return;
  try {
    await store.guardarCoev(S.participante.correo, S.aplicacion, S.ficha.equipo, S.datos, S.integrantes.map(p => p.correo), 'borrador', { primera: !S.doc });
    const t = new Date().toISOString();
    S.doc = { ...(S.doc || {}), estado: 'borrador', actualizado: t };
    $('#fGuardado').textContent = `Guardado ${hora(t)}`;
  } catch (err) {
    $('#fGuardado').textContent = navigator.onLine ? (err.code ? err.message : 'No se pudo guardar') : 'Sin conexión · guardado en este teléfono';
    $('#fGuardado').classList.add('error');
  }
}

function prepararFormulario() {
  const cont = $('#fEvaluados');
  cont.addEventListener('click', e => {
    const b = e.target.closest('.nota');
    if (!b) return;
    const li = b.closest('.evaluado');
    const c = li.dataset.correo;
    S.datos.evaluaciones[c] = { ...(S.datos.evaluaciones[c] || {}), nota: Number(b.dataset.n) };
    li.querySelectorAll('.nota').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    marcarEvaluado(li, false);
    progreso();
    programarGuardado(600);
  });
  cont.addEventListener('input', e => {
    const ta = e.target.closest('textarea[data-k]');
    if (!ta) return;
    const li = ta.closest('.evaluado');
    const c = li.dataset.correo;
    S.datos.evaluaciones[c] = { ...(S.datos.evaluaciones[c] || {}), [ta.dataset.k]: ta.value };
    marcarEvaluado(li, false);
    progreso();
    programarGuardado();
  });
  $('#fComentario').addEventListener('input', e => { S.datos.comentario = e.target.value; programarGuardado(); });

  $('#btnEnviar').addEventListener('click', () => {
    const c = progreso();
    document.querySelectorAll('.evaluado').forEach(li => marcarEvaluado(li, true));
    if (!c.completa) {
      const n = c.total - c.hechos;
      toast(`Te falta${n === 1 ? '' : 'n'} ${n} integrante${n === 1 ? '' : 's'} por completar.`, true);
      document.querySelector('.evaluado.falta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (Number.isFinite(S.plazoMs) && Date.now() >= S.plazoMs) { avisoPlazo(); return toast('El plazo terminó.', true); }
    $('#dlgEnviar').showModal();
  });
  $('#dlgEnviar').addEventListener('close', async () => {
    if ($('#dlgEnviar').returnValue !== 'si') return;
    clearTimeout(guardarT);
    guardarT = null;
    const btn = $('#btnEnviar');
    btn.disabled = true;
    try {
      await store.guardarCoev(S.participante.correo, S.aplicacion, S.ficha.equipo, S.datos, S.integrantes.map(p => p.correo), 'enviado', { primera: !S.doc });
      const t = new Date().toISOString();
      S.doc = { ...(S.doc || {}), ...structuredClone(S.datos), estado: 'enviado', enviado: t, actualizado: t };
      try { localStorage.removeItem(bkKey()); } catch {}
      verEnviada(true);
    } catch (err) {
      console.error(err);
      toast(err.code ? err.message : 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.', true);
    } finally {
      btn.disabled = false;
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && guardarT) guardarAhora(); });
  window.addEventListener('online', () => { if (S.datos && !$('#vForm').hidden) programarGuardado(); });
}

function verEnviada(recien = false) {
  const e = ENTREGAS[S.aplicacion];
  $('#eKicker').textContent = `Auto y coevaluación · ${e.nombre}`;
  $('#eTitulo').textContent = recien ? '¡Listo! Recibimos tu evaluación.' : 'Ya enviaste esta evaluación.';
  $('#eTexto').textContent = `${S.doc?.enviado ? `Quedó registrada el ${fechaHora(S.doc.enviado)}. ` : ''}Solo la lee el profesor. Ya puedes cerrar esta página.`;
  const integrantes = integrantesDe({ ...S.ficha, correo: S.participante.correo });
  const ev = S.doc?.evaluaciones || {};
  $('#eResumen').innerHTML = integrantes.map(p => {
    const x = ev[p.correo] || {};
    return `<div class="res-ev"><div class="res-cab"><b>${esc(p.nombre)}${p.yo ? ' (tú)' : ''}</b><span class="res-nota">${x.nota ? nota(x.nota) : '—'}</span></div>
      <p><span>Tareas:</span> ${esc(x.tareas || '')}</p><p><span>Entregó:</span> ${esc(x.entregado || '')}</p></div>`;
  }).join('') + (S.doc?.comentario ? `<div class="res-ev"><p><span>Comentario:</span> ${esc(S.doc.comentario)}</p></div>` : '');
  mostrar('vEnviada');
}

// ---------- Arranque ----------
async function arrancar() {
  $('#bandaDemo').hidden = modo !== 'demo';
  prepararIngreso();
  prepararFormulario();
  $('#btnSalir').addEventListener('click', async () => {
    if (guardarT) await guardarAhora();
    await store.salir();
    Object.assign(S, { participante: null, ficha: null, aplicacion: null, doc: null, datos: null });
    $('#formIngreso').reset();
    mostrar('vIngreso');
  });
  $('#btnReintentar').addEventListener('click', () => continuar().catch(fallo));
  try {
    const ses = await store.sesionActual();
    const codigoUrl = normalizarCodigo(new URLSearchParams(location.search).get('codigo') || '');
    if (ses && esCoev(ses.aplicacion) && ses.ficha && (!codigoUrl || codigoUrl === ses.codigo)) {
      Object.assign(S, { participante: ses.participante, aplicacion: ses.aplicacion, ficha: ses.ficha });
      await continuar();
    } else {
      if (ses?.participante) $('#inCorreo').value = ses.participante.correo;
      mostrar('vIngreso');
    }
  } catch (err) { fallo(err); }
}
function fallo(err) {
  console.error(err);
  mostrar('vIngreso');
  $('#errIngreso').textContent = 'No fue posible conectar. Revisa tu conexión e intenta de nuevo.';
}

arrancar();
