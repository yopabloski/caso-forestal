// Caso Forestal · página del estudiante.
import { store, modo } from './services/store.js';
import { seccionesDe, itemsDe, completitud, ESCALAS, ALTERNATIVAS, MAX_ABIERTA, valorValido } from './domain/encuesta.js';
import { APLICACIONES, estadoRespuesta } from './domain/modelo.js';
import {
  correoValido, normalizarCorreo, rutValido, normalizarRut, formatearRut, normalizarCodigo
} from './domain/identidad.js';
import * as CI from './domain/consentimiento.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = {
  config: null,
  participante: null,
  ficha: null,      // { nombre, equipo } desde la lista del curso
  aplicacion: null, // 'inicio' | 'cierre'
  docs: {},
  resp: null,       // respuestas en edición
  recienEnviada: false
};

// ---------- Utilidades de UI ----------
const VISTAS = ['vIngreso', 'vInicio', 'vConsentimiento', 'vEncuesta', 'vCerrado', 'vCargando'];
function altoBarra() {
  document.documentElement.style.setProperty('--alto-barra', `${document.querySelector('.barra').getBoundingClientRect().height}px`);
}
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
  toastT = setTimeout(() => t.classList.remove('visible'), 3400);
}

const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

// ---------- Ingreso ----------
function marcar(input, ayuda, msg, neutro = '') {
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  ayuda.textContent = msg || neutro;
  ayuda.classList.toggle('error', Boolean(msg));
}
const AYUDA_RUT = 'Protege tu acceso: nadie más puede responder con tu correo.';

function validarIngreso() {
  const correo = normalizarCorreo($('#inCorreo').value);
  const rut = $('#inRut').value;
  const codigo = normalizarCodigo($('#inCodigo').value);
  let ok = true;
  const m = (sel, ay, cond, msg, neutro) => { marcar($(sel), $(ay), cond ? '' : msg, neutro); ok = ok && cond; };
  m('#inCorreo', '#ayCorreo', correoValido(correo), 'Usa tu correo institucional @udd.cl.');
  m('#inRut', '#ayRut', rutValido(rut), 'RUT no válido. Revisa el dígito verificador.', AYUDA_RUT);
  m('#inCodigo', '#ayCodigo', codigo.length >= 4, 'Escribe la clave que entregó el profesor.');
  return ok ? { correo, rut: normalizarRut(rut), codigo } : null;
}

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
    const datos = validarIngreso();
    if (!datos) return;
    const btn = $('#btnIngresar');
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      const r = await store.ingresar(datos);
      Object.assign(S, { participante: r.participante, aplicacion: r.aplicacion, ficha: r.ficha });
      await continuar({ avanzar: true });
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
// avanzar: al entrar por primera vez lleva directo al paso pendiente.
async function continuar({ avanzar = false } = {}) {
  const p = S.participante;
  $('#sesionNombre').textContent = S.ficha?.nombre || p.correo;
  S.config = await store.cargarConfig();
  const ap = S.config.aplicaciones?.[S.aplicacion];
  if (!ap || ap.estado !== 'abierta') return verCerrado(Boolean(ap));
  S.docs = await store.respuestasDe(p.correo);
  const estado = estadoRespuesta(S.docs[S.aplicacion]);
  if (avanzar && !p.consentimiento) return verConsentimiento();
  if (avanzar && S.aplicacion === 'inicio' && estado !== 'enviado') return abrirEncuesta();
  verInicio();
}

function verCerrado(existe) {
  const nombre = APLICACIONES[S.aplicacion]?.nombre || 'Encuesta';
  $('#cerKicker').textContent = nombre;
  $('#cerTitulo').textContent = existe ? 'Esta encuesta no está abierta.' : 'Esta clave no corresponde a una encuesta.';
  $('#cerTexto').textContent = existe
    ? 'Tus datos ya quedaron registrados. Cuando el profesor la abra podrás ingresar con la misma clave.'
    : 'Revisa la clave o avisa al profesor.';
  mostrar('vCerrado');
}

function verInicio() {
  const p = S.participante;
  const ap = APLICACIONES[S.aplicacion];
  const doc = S.docs[S.aplicacion];
  const estado = estadoRespuesta(doc);
  const nombre = (S.ficha?.nombre || '').split(' ')[0];
  $('#iniKicker').textContent = ap.nombre;
  $('#iniTitulo').textContent = nombre ? `Hola, ${nombre}.` : 'Hola.';
  $('#iniBajada').textContent = estado === 'enviado'
    ? 'Ya respondiste esta encuesta. Gracias.'
    : `Son dos pasos y toman unos ${ap.minutos} minutos. La encuesta no tiene nota.`;
  $('#iniNombre').textContent = S.ficha?.nombre || p.correo;
  $('#iniEquipo').textContent = S.ficha?.equipo || '—';

  const listo = $('#iniListo');
  listo.hidden = estado !== 'enviado';
  if (estado === 'enviado') {
    listo.innerHTML = `<p><b>${S.recienEnviada ? '¡Listo! Recibimos tus respuestas.' : 'Encuesta enviada.'}</b> ${doc.enviado ? `Quedó registrada el ${esc(fechaHora(doc.enviado))}.` : ''} Ya puedes cerrar esta página.</p>`;
  }

  // Paso 1 · consentimiento
  const c = p.consentimiento;
  $('#pasoCi').classList.toggle('hecho', Boolean(c));
  $('#pasoCiTexto').textContent = c
    ? `Decisión registrada el ${fechaHora(c.fecha)}${c.retiro ? ' (retiro del consentimiento)' : ''}. Puedes cambiarla cuando quieras.`
    : 'Lee el documento y responde Sí o No a cada autorización. Tu decisión no afecta ninguna nota.';
  const res = $('#pasoCiResumen');
  res.hidden = !c;
  if (c) {
    res.innerHTML = CI.AUTORIZACIONES.map((a, i) =>
      `<li><span>${i + 1}. ${esc(a.corto)}</span><span class="pill ${c[a.id] ? 'ok' : 'no'}">${c[a.id] ? 'Sí' : 'No'}</span></li>`).join('');
  }
  const bCi = $('#btnPasoCi');
  bCi.textContent = c ? 'Ver o cambiar mi decisión' : 'Leer y responder';
  bCi.classList.toggle('sec', Boolean(c));

  // Paso 2 · encuesta
  const { respondidas, total } = completitud(S.aplicacion, doc?.respuestas);
  $('#pasoEnc').classList.toggle('hecho', estado === 'enviado');
  $('#pasoEnc').classList.toggle('bloqueado', !c);
  $('#pasoEncTitulo').textContent = ap.nombre;
  $('#pasoEncTexto').textContent = estado === 'enviado' ? 'Enviada. Ya no se puede modificar.'
    : !c ? 'Se habilita cuando respondas el consentimiento.'
    : estado === 'en-curso' ? `Llevas ${respondidas} de ${total} preguntas. Tus respuestas se guardan solas.`
    : `${total} preguntas. Tus respuestas se guardan solas mientras avanzas.`;
  const bEnc = $('#btnPasoEnc');
  bEnc.hidden = estado === 'enviado';
  bEnc.disabled = !c;
  bEnc.textContent = estado === 'en-curso' ? 'Continuar' : 'Comenzar';
  mostrar('vInicio');
}

// ---------- Consentimiento ----------
function prepararConsentimiento() {
  $('#ciVersion').textContent = `Versión ${CI.VERSION} · ${CI.FECHA_VERSION}`;
  $('#ciTitulo').textContent = CI.TITULO;
  $('#ciSub').textContent = CI.SUBTITULO;
  $('#ciFicha').innerHTML = CI.FICHA.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('');
  $('#ciTexto').innerHTML = CI.SECCIONES.map(s => `<section class="doc-seccion">
      <h2><span class="doc-n">${s.n}</span> ${esc(s.titulo)}</h2>
      ${s.parrafos.map(p => `<p>${esc(p)}</p>`).join('')}
      ${s.lista ? `<ul>${s.lista.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </section>`).join('');
  $('#ciAutTitulo').textContent = CI.TITULO_AUTORIZACIONES;
  $('#ciAutAyuda').textContent = CI.AYUDA_AUTORIZACIONES;
  $('#ciAut').innerHTML = CI.AUTORIZACIONES.map(a => `<li data-aut="${a.id}">
      <p id="t-${a.id}">${esc(a.texto)}</p>
      <div class="sino" role="radiogroup" aria-labelledby="t-${a.id}">
        <label><input type="radio" name="${a.id}" value="si"><span>Sí</span></label>
        <label><input type="radio" name="${a.id}" value="no"><span>No</span></label>
      </div>
    </li>`).join('');
  $('#ciDecTitulo').textContent = CI.TITULO_DECLARACION;
  $('#ciDeclaracion').textContent = CI.DECLARACION;
  $('#ciPdf').href = CI.PDF;

  const leer = () => Object.fromEntries(CI.AUT_IDS.map(k => {
    const v = document.querySelector(`input[name="${k}"]:checked`)?.value;
    return [k, v === 'si' ? true : v === 'no' ? false : null];
  }));
  const revisar = () => {
    const d = leer();
    const faltan = CI.AUT_IDS.filter(k => d[k] === null).length;
    const declaro = $('#ciDeclaro').checked;
    $('#btnConsentir').disabled = faltan > 0 || !declaro;
    $('#ciFalta').textContent = faltan ? `Te falta${faltan === 1 ? '' : 'n'} ${faltan} autorizaci${faltan === 1 ? 'ón' : 'ones'} por responder.`
      : !declaro ? 'Marca la declaración para continuar.' : '';
    document.querySelectorAll('#ciAut li').forEach(li => { if (d[li.dataset.aut] !== null) li.classList.remove('falta'); });
    return d;
  };
  $('#vConsentimiento').addEventListener('change', revisar);
  S.revisarConsentimiento = revisar;

  $('#btnConsentir').addEventListener('click', async () => {
    const d = revisar();
    if (!CI.decisionCompleta(d) || !$('#ciDeclaro').checked) return;
    const btn = $('#btnConsentir');
    btn.disabled = true;
    try {
      S.participante.consentimiento = await store.guardarConsentimiento(S.participante.correo, d, S.aplicacion);
      toast('Decisión guardada.');
      await continuar({ avanzar: true });
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar tu decisión. Revisa tu conexión.', true);
      btn.disabled = false;
    }
  });
}

function verConsentimiento() {
  const p = S.participante;
  const c = p.consentimiento;
  $('#ciFirma').textContent = `${S.ficha?.nombre || ''} · ${p.correo} · ${new Date().toLocaleDateString('es-CL')}`;
  for (const k of CI.AUT_IDS) {
    document.querySelectorAll(`input[name="${k}"]`).forEach(r => {
      r.checked = c ? (r.value === 'si') === (c[k] === true) : false;
    });
  }
  $('#ciDeclaro').checked = false;
  document.querySelectorAll('#ciAut li').forEach(li => li.classList.remove('falta'));
  S.revisarConsentimiento();
  $('#btnConsentir').textContent = c ? 'Guardar mi decisión' : 'Guardar mi decisión y continuar';
  mostrar('vConsentimiento');
}

// ---------- Encuesta ----------
const bkKey = () => `fcs:bk:${S.participante.correo}:${S.aplicacion}`;

function abrirEncuesta() {
  const ap = APLICACIONES[S.aplicacion];
  const doc = S.docs[S.aplicacion];
  let resp = { ...(doc?.respuestas || {}) };
  try {
    const bk = JSON.parse(localStorage.getItem(bkKey()));
    if (bk && (!doc?.actualizado || bk.t > Date.parse(doc.actualizado))) resp = { ...resp, ...bk.r };
  } catch {}
  S.resp = resp;
  $('#encTitulo').textContent = ap.nombre;
  $('#encBajada').textContent = 'Responde todas las preguntas. Puedes pausar y volver: tus respuestas se guardan solas.';
  $('#encGuardado').textContent = doc?.actualizado ? `Guardado ${hora(doc.actualizado)}` : '';
  $('#encGuardado').classList.remove('error');
  renderEncuesta();
  mostrar('vEncuesta');
}

function renderEncuesta() {
  const secs = seccionesDe(S.aplicacion);
  const total = itemsDe(S.aplicacion).length;
  let n = 0;
  $('#encSecciones').innerHTML = secs.map((s, i) => `<section class="seccion" aria-labelledby="sec-${s.id}">
    <header class="seccion-cabeza">
      <p class="kicker">Sección ${i + 1} de ${secs.length}</p>
      <h2 id="sec-${s.id}">${esc(s.titulo)}</h2>
      <p class="enunciado">${esc(s.enunciado)}</p>
      ${s.ayuda ? `<p class="ayuda-sec">${esc(s.ayuda)}</p>` : ''}
    </header>
    <ol class="items">${s.items.map(it => {
      n++;
      const v = S.resp[it.id];
      const ok = valorValido({ ...it, tipo: s.tipo }, v);
      let cuerpo = '';
      if (s.tipo === 'likert') {
        const e = ESCALAS[s.escala];
        cuerpo = `<div class="likert" role="radiogroup" aria-labelledby="t-${it.id}">${[1, 2, 3, 4, 5].map(k =>
          `<button type="button" role="radio" class="op" data-v="${k}" aria-checked="${v === k}" aria-label="${k}${k === 1 ? `, ${e.anclaMin}` : k === 5 ? `, ${e.anclaMax}` : ''}">${k}</button>`).join('')}</div>
          <div class="anclas" aria-hidden="true"><span>${esc(e.anclaMin)}</span><span>${esc(e.anclaMax)}</span></div>`;
      } else if (s.tipo === 'alternativas') {
        cuerpo = `<div class="alternativas" role="radiogroup" aria-labelledby="t-${it.id}">${ALTERNATIVAS.map(k =>
          `<button type="button" role="radio" class="alt" data-v="${k}" aria-checked="${v === k}"><span class="letra">${k}</span><span>${esc(it.alternativas[k])}</span></button>`).join('')}</div>`;
      } else {
        cuerpo = `<textarea class="abierta" maxlength="${MAX_ABIERTA}" aria-labelledby="t-${it.id}" rows="4">${esc(v || '')}</textarea>
          <div class="cuenta"><span>${(v || '').length}</span> / ${MAX_ABIERTA}</div>`;
      }
      return `<li class="item ${ok ? 'respondido' : ''}" id="it-${it.id}" data-id="${it.id}" data-tipo="${s.tipo}">
        <span class="item-num">Pregunta ${n} de ${total}</span>
        <p class="item-texto" id="t-${it.id}">${s.prefijo ? `<span class="prefijo">${esc(s.prefijo)}</span> ` : ''}${esc(it.texto)}</p>
        ${cuerpo}
      </li>`;
    }).join('')}</ol>
  </section>`).join('');
  progreso();
}

function progreso() {
  const { respondidas, total } = completitud(S.aplicacion, S.resp);
  const pct = total ? Math.round((respondidas / total) * 100) : 0;
  $('#encFill').style.width = `${pct}%`;
  $('#encProg').setAttribute('aria-valuenow', String(pct));
  $('#encCuenta').textContent = `${respondidas}/${total}`;
}

let guardarT = null;
function programarGuardado(espera = 900) {
  try { localStorage.setItem(bkKey(), JSON.stringify({ t: Date.now(), r: S.resp })); } catch {}
  $('#encGuardado').textContent = 'Guardando…';
  $('#encGuardado').classList.remove('error');
  clearTimeout(guardarT);
  guardarT = setTimeout(guardarAhora, espera);
}

async function guardarAhora() {
  clearTimeout(guardarT);
  guardarT = null;
  if (!S.resp) return;
  const a = S.aplicacion;
  try {
    await store.guardarRespuestas(S.participante.correo, a, S.ficha.equipo, S.resp, { primera: !S.docs[a] });
    const t = new Date().toISOString();
    S.docs[a] = { ...(S.docs[a] || {}), respuestas: { ...S.resp }, estado: 'borrador', actualizado: t };
    $('#encGuardado').textContent = `Guardado ${hora(t)}`;
  } catch (err) {
    $('#encGuardado').textContent = navigator.onLine ? (err.code ? err.message : 'No se pudo guardar') : 'Sin conexión · guardado en este dispositivo';
    $('#encGuardado').classList.add('error');
  }
}

function prepararEncuesta() {
  const cont = $('#encSecciones');
  cont.addEventListener('click', e => {
    const b = e.target.closest('.op, .alt');
    if (!b) return;
    const li = b.closest('.item');
    const id = li.dataset.id;
    const antes = S.resp[id];
    S.resp[id] = li.dataset.tipo === 'likert' ? Number(b.dataset.v) : b.dataset.v;
    li.querySelectorAll('.op, .alt').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    li.classList.add('respondido');
    li.classList.remove('falta');
    progreso();
    programarGuardado();
    // Avanza sola al siguiente ítem pendiente la primera vez que se responde.
    if (antes === undefined) {
      const ids = itemsDe(S.aplicacion);
      const k = ids.findIndex(i => i.id === id);
      const sig = ids.slice(k + 1).find(i => i.tipo !== 'abierta' && S.resp[i.id] === undefined);
      if (sig) setTimeout(() => $('#it-' + sig.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
    }
  });
  cont.addEventListener('input', e => {
    const ta = e.target.closest('.abierta');
    if (!ta) return;
    const li = ta.closest('.item');
    S.resp[li.dataset.id] = ta.value;
    li.querySelector('.cuenta span').textContent = String(ta.value.length);
    li.classList.toggle('respondido', ta.value.trim().length >= 3);
    li.classList.remove('falta');
    progreso();
    programarGuardado(1500);
  });

  $('#btnVolver').addEventListener('click', async () => {
    if (guardarT) await guardarAhora();
    S.resp = null;
    verInicio();
  });

  $('#btnEnviar').addEventListener('click', () => {
    const { faltan } = completitud(S.aplicacion, S.resp);
    document.querySelectorAll('.item').forEach(li => li.classList.toggle('falta', faltan.includes(li.dataset.id)));
    if (faltan.length) {
      toast(`Te falta${faltan.length === 1 ? '' : 'n'} ${faltan.length} pregunta${faltan.length === 1 ? '' : 's'}.`, true);
      $('#it-' + faltan[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    $('#dlgEnviar').showModal();
  });

  $('#dlgEnviar').addEventListener('close', async () => {
    if ($('#dlgEnviar').returnValue !== 'si') return;
    clearTimeout(guardarT);
    guardarT = null;
    const a = S.aplicacion;
    const btn = $('#btnEnviar');
    btn.disabled = true;
    try {
      await store.enviarRespuestas(S.participante.correo, a, S.ficha.equipo, S.resp, { primera: !S.docs[a] });
      const t = new Date().toISOString();
      S.docs[a] = { ...(S.docs[a] || {}), respuestas: { ...S.resp }, estado: 'enviado', actualizado: t, enviado: t };
      try { localStorage.removeItem(bkKey()); } catch {}
      S.resp = null;
      S.recienEnviada = true;
      verInicio();
    } catch (err) {
      console.error(err);
      toast(err.code ? err.message : 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.', true);
    } finally {
      btn.disabled = false;
    }
  });

  // Guardar antes de salir de la página y al recuperar la conexión.
  document.addEventListener('visibilitychange', () => { if (document.hidden && guardarT) guardarAhora(); });
  window.addEventListener('online', () => { if (S.resp) programarGuardado(); });
}

// ---------- Arranque ----------
async function arrancar() {
  $('#bandaDemo').hidden = modo !== 'demo';
  prepararIngreso();
  prepararConsentimiento();
  prepararEncuesta();
  $('#btnPasoCi').addEventListener('click', verConsentimiento);
  $('#btnPasoEnc').addEventListener('click', () => { if (S.participante?.consentimiento) abrirEncuesta(); });
  $('#btnSalir').addEventListener('click', async () => {
    if (guardarT) await guardarAhora();
    await store.salir();
    Object.assign(S, { participante: null, ficha: null, aplicacion: null, docs: {}, resp: null, recienEnviada: false });
    $('#formIngreso').reset();
    mostrar('vIngreso');
  });
  $('#btnReintentar').addEventListener('click', () => continuar().catch(fallo));

  try {
    const ses = await store.sesionActual();
    // Un enlace con otra clave (por ejemplo la de cierre) obliga a ingresar de nuevo.
    const codigoUrl = normalizarCodigo(new URLSearchParams(location.search).get('codigo') || '');
    if (ses && ses.aplicacion && ses.ficha && (!codigoUrl || codigoUrl === ses.codigo)) {
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
