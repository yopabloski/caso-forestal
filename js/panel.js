// Caso Forestal · panel docente.
import { store, modo } from './services/store.js';
import { APLICACIONES, APLICACION_IDS, codigoSugerido } from './domain/modelo.js';
import { SECCION, seccionesDe, ALTERNATIVAS, valorValido, MAX_ABIERTA } from './domain/encuesta.js';
import { AUTORIZACIONES, AUT_IDS } from './domain/consentimiento.js';
import { normalizarCodigo } from './domain/identidad.js';
import { normalizarCursoId } from './domain/curso.js';
import { interpretarLista, resumenEquipos } from './domain/lista.js';
import * as AN from './domain/analisis.js';
import * as EX from './domain/exportar.js';
import {
  barraLikert, leyendaLikert, leyendaSeries, mancuerna, ejeEscala, barraProp, barraAvance,
  activarTooltips, num, pct, pValor
} from './ui/graficos.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fecha = iso => iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

const D = { cursos: [], curso: null, config: null, codigos: {}, lista: [], participantes: [], respuestas: [], docente: null, sal: '', personas: [] };
const V = { sec: 'avance', tab: 'ae', filtro: 'todos', busca: '', listaPendiente: null };

// ---------- Utilidades ----------
let toastT;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('visible');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('visible'), 3600);
}

function confirmar(titulo, texto, ok = 'Confirmar') {
  return new Promise(res => {
    const d = $('#dlgConfirmar');
    $('#confTitulo').textContent = titulo;
    $('#confTexto').textContent = texto;
    $('#confOk').textContent = ok;
    d.addEventListener('close', () => res(d.returnValue === 'si'), { once: true });
    d.showModal();
  });
}

function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const sello = () => new Date().toISOString().slice(0, 10);

async function intentar(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { console.error(e); toast(e.code ? e.message : 'No se pudo completar la acción. Revisa tu conexión.', true); return false; }
}

const pillEstado = (e, doc) => e === 'enviado'
  ? `<span class="pill ok">Enviada${doc?.origen === 'papel' ? ' · papel' : ''}</span>`
  : e === 'en-curso' ? '<span class="pill curso">En curso</span>' : '<span class="pill">Pendiente</span>';

const personasAnalisis = () => V.filtro === 'a1' ? AN.conAutorizacion(D.personas, 'a1') : D.personas;
const urlAlumno = codigo => {
  const u = new URL('index.html', location.href);
  u.search = codigo ? `?codigo=${encodeURIComponent(codigo)}` : '';
  u.hash = '';
  return u.toString();
};

// ---------- Datos ----------
async function cargar() {
  D.cursos = await store.listarCursos();
  if (!store.cursoActualId() && D.cursos.length) store.fijarCursoActual(D.cursos[0].id);
  D.curso = D.cursos.find(c => c.id === store.cursoActualId()) || null;
  $('#cursoActivo').innerHTML = D.cursos.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} · ${esc(c.periodo)}</option>`).join('');
  $('#cursoActivo').value = D.curso?.id || '';
  if (!D.curso) { render(); return; }
  const [config, codigos, lista, participantes, respuestas, docente, sal] = await Promise.all([
    store.cargarConfig(), store.codigosVigentes(), store.listarLista(), store.listarParticipantes(),
    store.listarRespuestas(), store.leerDocente(), store.salSeudonimos()
  ]);
  Object.assign(D, { config, codigos, lista, participantes, respuestas, docente, sal });
  D.personas = AN.unir({ lista, participantes, respuestas });
  $('#sync').textContent = `Actualizado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  render();
}

function render() {
  renderAvisos();
  ({ avance: renderAvance, aplicaciones: renderAplicaciones, curso: renderCurso, analisis: renderAnalisis, descargas: renderDescargas })[V.sec]();
}

function renderAvisos() {
  const a = [];
  if (modo === 'demo') a.push(['aviso', '<b>Modo demo.</b> Los datos viven solo en este navegador. Para usarlo con el curso, completa <span class="mono">js/services/firebase-config.js</span> (ver docs/PUESTA_EN_MARCHA.md).']);
  if (!D.lista.length) a.push(['aviso', '<b>Falta la lista del curso.</b> Sin ella ningún estudiante puede ingresar. Cárgala en <b>Curso</b>.']);
  if (!D.docente) a.push(['', '<b>Falta el archivo docente</b> (clave de conocimiento, parte del caso y resultado de aprendizaje). Cárgalo en <b>Aplicaciones</b> para ver respuestas correctas y el análisis por parte.']);
  for (const id of APLICACION_IDS) {
    if (D.config.aplicaciones[id]?.estado === 'abierta' && !D.codigos[id]) a.push(['error', `<b>${APLICACIONES[id].nombre} abierta sin clave.</b> Define la clave del curso en <b>Aplicaciones</b>.`]);
  }
  $('#avisos').innerHTML = a.map(([c, h]) => `<div class="nota-caja ${c}"><p>${h}</p></div>`).join('');
}

// ---------- Avance ----------
function renderAvance() {
  const av = AN.avance(D.personas);
  const tile = (t, v, s) => `<div class="tile"><span>${esc(t)}</span><b>${v}</b><small>${esc(s)}</small></div>`;
  const ap = id => {
    const c = av.porAplicacion[id];
    const faltan = av.faltan[id];
    const abierta = D.config.aplicaciones[id]?.estado === 'abierta';
    return `<div class="tarjeta bloque">
      <div class="bloque-cabeza"><h2>${APLICACIONES[id].nombre}</h2><span class="pill ${abierta ? 'ok' : ''}">${abierta ? 'Abierta' : 'Cerrada'}</span></div>
      <p class="grande"><b>${c.enviado}</b> de ${av.total} enviadas <span class="tenue">(${pct(c.enviado, av.total)})${c.enCurso ? ` · ${c.enCurso} en curso` : ''}</span></p>
      ${barraAvance(c)}
      <details class="faltan" ${faltan.length && faltan.length <= 12 ? 'open' : ''}>
        <summary>Faltan ${faltan.length}</summary>
        ${faltan.length ? `<ul>${faltan.map(f => `<li><span class="mono">${esc(f.equipo)}</span> ${esc(f.nombre)}${f.estado[id] === 'en-curso' ? ' <span class="pill curso">En curso</span>' : ''}</li>`).join('')}</ul>
        <button class="btn chico sec" type="button" data-copiar="${id}">Copiar correos</button>` : '<p class="tenue">Nadie: respondieron todos.</p>'}
      </details>
    </div>`;
  };
  $('#avanceCuerpo').innerHTML = `
    <div class="tiles">
      ${tile('Lista del curso', av.total, `${av.porEquipo.length} equipos`)}
      ${tile('Inicio', `${av.porAplicacion.inicio.enviado}`, `de ${av.total} enviadas`)}
      ${tile('Cierre', `${av.porAplicacion.cierre.enviado}`, `de ${av.total} enviadas`)}
      ${tile('Pareadas', av.pareados, 'inicio y cierre')}
      ${tile('Autorización 1', av.autorizaciones.a1, `de ${av.decidieron} que decidieron`)}
    </div>
    <div class="rejilla-2">${ap('inicio')}${ap('cierre')}</div>
    <h2 class="sub">Por equipo</h2>
    <div class="equipos">${av.porEquipo.map(e => `<div class="tarjeta equipo">
      <div class="equipo-cabeza"><b>Equipo ${esc(e.equipo)}</b><span class="tenue">I ${e.inicio.enviado}/${e.integrantes.length} · C ${e.cierre.enviado}/${e.integrantes.length}</span></div>
      <table><thead><tr><th>Estudiante</th><th>Inicio</th><th>Cierre</th></tr></thead><tbody>
      ${e.integrantes.map(f => `<tr><td>${esc(f.nombre)}</td><td>${pillEstado(f.estado.inicio, f.inicio)}</td><td>${pillEstado(f.estado.cierre, f.cierre)}</td></tr>`).join('')}
      </tbody></table></div>`).join('') || '<p class="tenue">Aún no hay lista del curso.</p>'}</div>
    ${av.fueraDeLista.length ? `<div class="nota-caja aviso"><p><b>Registros fuera de la lista:</b> ${av.fueraDeLista.map(f => esc(f.correo)).join(', ')}.</p></div>` : ''}`;
  $('#avanceCuerpo').querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    const txt = av.faltan[b.dataset.copiar].map(f => f.correo).join('; ');
    try { await navigator.clipboard.writeText(txt); toast('Correos copiados.'); } catch { toast(txt); }
  }));
}

// ---------- Aplicaciones ----------
function renderAplicaciones() {
  $('#aplicacionesCuerpo').innerHTML = APLICACION_IDS.map(id => {
    const abierta = D.config.aplicaciones[id]?.estado === 'abierta';
    const cod = D.codigos[id] || '';
    return `<div class="tarjeta bloque" data-ap="${id}">
      <div class="bloque-cabeza"><h2>${APLICACIONES[id].nombre}</h2><span class="pill ${abierta ? 'ok' : ''}">${abierta ? 'Abierta' : 'Cerrada'}</span></div>
      <p class="tenue">${id === 'inicio' ? 'Consentimiento, autoeficacia y conocimiento.' : 'Decisión registrada del consentimiento, autoeficacia, conocimiento, valoración y preguntas abiertas.'}</p>
      <label class="campo"><span>Clave del curso</span>
        <div class="fila"><input class="mono" data-clave value="${esc(cod)}" autocomplete="off" spellcheck="false" placeholder="Por ejemplo ${codigoSugerido(id)}">
        <button class="btn sec chico" type="button" data-sugerir>Sugerir</button>
        <button class="btn chico" type="button" data-guardar-clave>Guardar</button></div>
        <small class="ayuda">Al cambiarla, la anterior deja de servir. Los estudiantes que ya ingresaron conservan su registro.</small>
      </label>
      <label class="campo"><span>Enlace directo (ya trae la clave)</span>
        <div class="fila"><input readonly value="${cod ? esc(urlAlumno(cod)) : ''}" placeholder="Guarda primero una clave">
        <button class="btn sec chico" type="button" data-copiar-url ${cod ? '' : 'disabled'}>Copiar</button></div>
      </label>
      <div class="acciones izq">
        <button class="btn ${abierta ? 'peligro' : ''}" type="button" data-alternar>${abierta ? 'Cerrar encuesta' : 'Abrir encuesta'}</button>
        <button class="btn sec" type="button" data-pantalla ${cod ? '' : 'disabled'}>Mostrar en pantalla</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('#aplicacionesCuerpo [data-ap]').forEach(card => {
    const id = card.dataset.ap;
    const input = card.querySelector('[data-clave]');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    card.querySelector('[data-sugerir]').addEventListener('click', () => { input.value = codigoSugerido(id); });
    card.querySelector('[data-guardar-clave]').addEventListener('click', async () => {
      if (await intentar(() => store.fijarCodigo(id, input.value), 'Clave guardada.')) await cargar();
    });
    card.querySelector('[data-copiar-url]').addEventListener('click', async () => {
      const u = urlAlumno(D.codigos[id]);
      try { await navigator.clipboard.writeText(u); toast('Enlace copiado.'); } catch { toast(u); }
    });
    card.querySelector('[data-alternar]').addEventListener('click', async () => {
      const abierta = D.config.aplicaciones[id]?.estado === 'abierta';
      if (!abierta && !D.codigos[id]) return toast('Guarda primero la clave del curso.', true);
      if (!abierta && !D.lista.length) return toast('Carga primero la lista del curso.', true);
      if (abierta && !(await confirmar(`¿Cerrar la ${APLICACIONES[id].nombre.toLowerCase()}?`, 'Nadie podrá responder ni guardar cambios hasta que la abras de nuevo. Los borradores se conservan.', 'Cerrar'))) return;
      const config = structuredClone(D.config);
      config.aplicaciones[id] = { id, estado: abierta ? 'cerrada' : 'abierta' };
      if (await intentar(() => store.guardarConfig(config), abierta ? 'Encuesta cerrada.' : 'Encuesta abierta.')) await cargar();
    });
    card.querySelector('[data-pantalla]').addEventListener('click', () => verPantalla(id));
  });

  const d = D.docente;
  $('#docenteCuerpo').innerHTML = `
    <p>${d ? `<span class="pill ok">Cargado</span> ${d.cargado ? `el ${esc(fecha(d.cargado))}` : ''} · clave de ${Object.keys(d.clave || {}).length} preguntas · ${Object.keys(d.items || {}).length} ítems con parte del caso.`
      : '<span class="pill curso">Sin cargar</span> El panel no puede marcar respuestas correctas ni agrupar por parte del caso.'}</p>
    <p class="tenue">Es el archivo <span class="mono">metadatos-docente.json</span>: la clave de las preguntas de conocimiento y, por ítem, la parte del caso y el resultado de aprendizaje. Se guarda en un documento que solo lee el docente. No lo subas al repositorio: el código del sitio es público.</p>
    <label class="btn sec">Cargar archivo docente<input type="file" id="docenteArchivo" accept=".json,application/json" hidden></label>`;
  $('#docenteArchivo').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    let meta;
    try { meta = JSON.parse(await f.text()); } catch { return toast('El archivo no es un JSON válido.', true); }
    const errores = AN.validarDocente(meta);
    if (errores.length) return toast(errores[0], true);
    if (await intentar(() => store.guardarDocente({ version: meta.version || '', clave: meta.clave, items: meta.items || {} }), 'Archivo docente cargado.')) await cargar();
  });
}

function verPantalla(id) {
  const cod = D.codigos[id];
  const u = urlAlumno(cod);
  $('#panTitulo').textContent = APLICACIONES[id].nombre;
  $('#panUrl').textContent = urlAlumno('').replace(/^https?:\/\//, '').replace(/index\.html$/, '');
  $('#panClave').textContent = cod;
  const qr = $('#panQr');
  qr.innerHTML = '';
  if (window.QRCode) new window.QRCode(qr, { text: u, width: 300, height: 300, colorDark: '#1F4E79', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  else qr.innerHTML = '<p class="tenue">No se pudo generar el código QR (sin conexión al generador). Usa la dirección y la clave.</p>';
  $('#dlgPantalla').showModal();
}

// ---------- Curso ----------
function renderCurso() {
  const eq = resumenEquipos(D.lista);
  const pend = V.listaPendiente;
  $('#listaCuerpo').innerHTML = `
    <div class="nota-caja"><p><b>Módulos habilitados</b></p><div class="fila">${[['inicio','Inicio'],['cierre','Cierre'],['verificador','Verificador'],['autoevaluacion','Autoevaluación'],['coevaluacion','Coevaluación']].map(([id, nombre]) => `<label><input type="checkbox" data-modulo="${id}" ${D.curso?.modulos?.[id] ? 'checked' : ''}> ${nombre}</label>`).join(' ')}</div><p class="ayuda">Autoevaluación y coevaluación quedan preparadas para sus pantallas futuras.</p></div>
    <div class="bloque-cabeza"><h2>Lista del curso</h2><span class="pill ${D.lista.length ? 'ok' : 'curso'}">${D.lista.length ? `${D.lista.length} estudiantes · ${eq.length} equipos` : 'Sin cargar'}</span></div>
    ${eq.length ? `<p class="tenue">Integrantes por equipo: ${eq.map(e => `<span class="mono">${e.equipo}</span>:${e.n}`).join(' · ')}</p>` : ''}
    <p class="tenue">Sube el CSV con los equipos (por ejemplo «Caso - Cosecha Forestal - con equipos.csv»: columnas <span class="mono">nombre</span>, <span class="mono">login_id</span>, <span class="mono">group_name</span>). Se lee en este navegador y se guarda en la base de datos; nunca va al repositorio.</p>
    <label class="btn sec">Elegir CSV<input type="file" id="listaArchivo" accept=".csv,text/csv" hidden></label>
    ${pend ? `<div class="vista-previa">
      ${pend.errores.length ? `<div class="nota-caja error"><p><b>${pend.errores.length} problema${pend.errores.length === 1 ? '' : 's'}:</b></p><ul>${pend.errores.slice(0, 8).map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      ${pend.filas.length ? `<div class="nota-caja"><p><b>${pend.filas.length} estudiantes en ${resumenEquipos(pend.filas).length} equipos.</b> Columnas usadas: correo «${esc(pend.columnas.correo)}», nombre «${esc(pend.columnas.nombre)}», equipo «${esc(pend.columnas.equipo)}».</p>
        <p>${resumenEquipos(pend.filas).map(e => `<span class="mono">${e.equipo}</span>:${e.n}`).join(' · ')}</p>
        <p class="tenue">Primeros: ${pend.filas.slice(0, 3).map(f => `${esc(f.nombre)} (${esc(f.equipo)})`).join(', ')}…</p></div>
        <div class="acciones izq"><button class="btn" type="button" id="listaGuardar">${D.lista.length ? 'Reemplazar la lista' : 'Guardar la lista'}</button><button class="btn sec" type="button" id="listaDescartar">Descartar</button></div>` : ''}
    </div>` : ''}`;
  $('#listaArchivo').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    V.listaPendiente = interpretarLista(await f.text());
    renderCurso();
  });
  $('#listaCuerpo').querySelectorAll('[data-modulo]').forEach(input => input.addEventListener('change', async () => {
    const modulos = { ...(D.curso?.modulos || {}), [input.dataset.modulo]: input.checked };
    if (await intentar(() => store.guardarModulos(modulos), 'Módulos actualizados.')) await cargar();
  }));
  $('#listaDescartar')?.addEventListener('click', () => { V.listaPendiente = null; renderCurso(); });
  $('#listaGuardar')?.addEventListener('click', async () => {
    const filas = V.listaPendiente.filas;
    const salen = D.lista.filter(a => !filas.some(b => b.correo === a.correo)).length;
    if (D.lista.length && !(await confirmar('¿Reemplazar la lista del curso?', `Quedarán ${filas.length} estudiantes.${salen ? ` ${salen} de la lista actual ya no podrán ingresar.` : ''} Las respuestas ya guardadas no se borran.`, 'Reemplazar'))) return;
    if (await intentar(() => store.cargarLista(filas), 'Lista guardada.')) { V.listaPendiente = null; await cargar(); }
  });

  const q = V.busca.trim().toLowerCase();
  const filas = D.personas.filter(f => !q || `${f.nombre} ${f.correo} equipo ${f.equipo}`.toLowerCase().includes(q));
  const aut = f => f.consentimiento
    ? AUT_IDS.map((k, i) => `<span class="aut ${f.aut[k] ? 'si' : 'no'}" data-tip="${i + 1}. ${esc(AUTORIZACIONES[i].corto)}: ${f.aut[k] ? 'Sí' : 'No'}">${i + 1}${f.aut[k] ? '✓' : '✗'}</span>`).join('') + (f.consentimiento.retiro ? ' <span class="pill no">Retiro</span>' : '')
    : '<span class="tenue">Sin decidir</span>';
  $('#tablaCurso').innerHTML = `<thead><tr><th>Eq.</th><th>Estudiante</th><th>Registro</th><th>Autorizaciones</th><th>Inicio</th><th>Cierre</th><th>Acciones</th></tr></thead><tbody>
    ${filas.map(f => `<tr>
      <td class="mono">${esc(f.equipo || '—')}</td>
      <td><b>${esc(f.nombre || '(fuera de la lista)')}</b><br><span class="tenue mono">${esc(f.correo)}</span></td>
      <td>${f.participante ? `${f.participante.rut ? `<span class="mono">${esc(f.participante.rut)}</span>` : '<span class="pill azul">Solo papel</span>'}<br><span class="tenue">${esc(fecha(f.participante.ultimoIngreso || f.participante.creado))}</span>` : '<span class="tenue">No ha ingresado</span>'}</td>
      <td class="auts">${aut(f)}</td>
      <td>${pillEstado(f.estado.inicio, f.inicio)}${f.estado.inicio === 'enviado' && f.inicio?.enviado ? `<br><span class="tenue">${esc(fecha(f.inicio.enviado))}</span>` : ''}</td>
      <td>${pillEstado(f.estado.cierre, f.cierre)}${f.estado.cierre === 'enviado' && f.cierre?.enviado ? `<br><span class="tenue">${esc(fecha(f.cierre.enviado))}</span>` : ''}</td>
      <td><select class="accion" data-correo="${esc(f.correo)}" aria-label="Acciones para ${esc(f.nombre || f.correo)}">
        <option value="">Acciones…</option>
        ${f.enLista ? '<option value="papel">Digitar encuesta en papel</option>' : ''}
        ${f.estado.inicio === 'enviado' ? '<option value="reabrir-inicio">Reabrir inicio</option>' : ''}
        ${f.estado.cierre === 'enviado' ? '<option value="reabrir-cierre">Reabrir cierre</option>' : ''}
        ${f.consentimiento && !f.consentimiento.retiro ? '<option value="retiro">Registrar retiro del consentimiento</option>' : ''}
        ${f.participante ? '<option value="eliminar">Eliminar todos sus datos</option>' : ''}
      </select></td></tr>`).join('') || '<tr><td colspan="7" class="tenue">Sin resultados.</td></tr>'}</tbody>`;
}

async function accionCurso(correo, accion) {
  const f = D.personas.find(x => x.correo === correo);
  const quien = f?.nombre || correo;
  if (accion === 'papel') return abrirPapel(correo);
  if (accion.startsWith('reabrir-')) {
    const id = accion.split('-')[1];
    if (!(await confirmar(`¿Reabrir la encuesta de ${id} de ${quien}?`, 'Volverá a quedar como borrador y podrá modificarla y enviarla de nuevo mientras la encuesta esté abierta. La reapertura queda registrada.', 'Reabrir'))) return;
    if (await intentar(() => store.reabrir(correo, id), 'Encuesta reabierta.')) await cargar();
  }
  if (accion === 'retiro') {
    if (!(await confirmar(`¿Registrar el retiro de ${quien}?`, 'Sus cinco autorizaciones pasan a No y sus datos quedan fuera de los análisis para publicación desde ahora. Sus respuestas se conservan como actividad del curso.', 'Registrar retiro'))) return;
    if (await intentar(() => store.registrarRetiro(correo), 'Retiro registrado.')) await cargar();
  }
  if (accion === 'eliminar') {
    if (!(await confirmar(`¿Eliminar todos los datos de ${quien}?`, 'Se borran su registro, su consentimiento y sus respuestas de inicio y cierre. No se puede deshacer.', 'Eliminar'))) return;
    if (await intentar(() => store.eliminarParticipante(correo), 'Datos eliminados.')) await cargar();
  }
}

// ---------- Encuesta en papel ----------
function itemsPapel(aplicacion) {
  return seccionesDe(aplicacion).map(s => `<fieldset class="papel-grupo"><legend>${esc(s.titulo)}</legend>
    <div class="${s.tipo === 'abierta' ? 'papel-textos' : 'papel-celdas'}">${s.items.map(it => s.tipo === 'likert'
      ? `<label>${it.id}<input data-item="${it.id}" type="number" min="1" max="5" step="1" inputmode="numeric"></label>`
      : s.tipo === 'alternativas'
        ? `<label>${it.id}<select data-item="${it.id}"><option value=""></option>${ALTERNATIVAS.map(a => `<option>${a}</option>`).join('')}</select></label>`
        : `<label>${it.id} · ${esc(it.texto)}<textarea data-item="${it.id}" rows="2" maxlength="${MAX_ABIERTA}"></textarea></label>`).join('')}</div></fieldset>`).join('');
}

function abrirPapel(correo = '') {
  const sel = $('#papEstudiante');
  sel.innerHTML = '<option value="">Elige…</option>' + D.personas.filter(f => f.enLista).map(f => `<option value="${esc(f.correo)}">${esc(f.equipo)} · ${esc(f.nombre)}</option>`).join('');
  sel.value = correo;
  $('#papConsent').innerHTML = AUTORIZACIONES.map((a, i) => `<label data-tip="${esc(a.texto)}">${i + 1}. ${esc(a.corto)}<select data-aut="${a.id}"><option value=""></option><option value="si">Sí</option><option value="no">No</option></select></label>`).join('');
  const refrescar = () => {
    $('#papItems').innerHTML = itemsPapel($('#papAplicacion').value);
    const f = D.personas.find(x => x.correo === sel.value);
    const ap = $('#papAplicacion').value;
    $('#papCiEstado').textContent = !f ? '' : f.consentimiento
      ? `Ya tiene una decisión registrada (${fecha(f.consentimiento.fecha)}). Deja las cinco en blanco para conservarla.`
      : 'No tiene decisión registrada. Si no entregó el consentimiento, deja las cinco en blanco: sus datos quedan fuera de la investigación.';
    $('#papError').textContent = f?.estado[ap] === 'enviado' ? `Atención: ya tiene la encuesta de ${ap} enviada${f[ap]?.origen === 'papel' ? ' (papel)' : ' por la web'}. Guardar la reemplaza.` : '';
  };
  sel.onchange = refrescar;
  $('#papAplicacion').onchange = refrescar;
  refrescar();
  $('#dlgPapel').showModal();
}

async function guardarPapel(e) {
  e.preventDefault();
  const correo = $('#papEstudiante').value;
  const aplicacion = $('#papAplicacion').value;
  const f = D.personas.find(x => x.correo === correo);
  const err = m => { $('#papError').textContent = m; };
  if (!f) return err('Elige al estudiante.');
  const auts = Object.fromEntries([...document.querySelectorAll('#papConsent [data-aut]')].map(s => [s.dataset.aut, s.value]));
  const dadas = AUT_IDS.filter(k => auts[k]).length;
  if (dadas && dadas < AUT_IDS.length) return err('Completa las cinco autorizaciones o deja las cinco en blanco.');
  const respuestas = {};
  for (const s of seccionesDe(aplicacion)) {
    for (const it of s.items) {
      const el = document.querySelector(`#papItems [data-item="${it.id}"]`);
      const v = s.tipo === 'likert' ? Number(el.value) : el.value.trim();
      if (!valorValido({ ...it, tipo: s.tipo }, v)) { el.focus(); return err(`Falta o no es válida la respuesta de ${it.id}.`); }
      respuestas[it.id] = v;
    }
  }
  const ok = await intentar(() => store.digitarPapel({
    correo, aplicacion, equipo: f.equipo, respuestas,
    consentimiento: dadas ? Object.fromEntries(AUT_IDS.map(k => [k, auts[k] === 'si'])) : null
  }), 'Encuesta en papel guardada.');
  if (ok) { $('#dlgPapel').close(); await cargar(); }
}

// ---------- Análisis ----------
const mde = r => r.n ? `${num(r.media)} (${num(r.de)})` : '—';
const delta = p => p.n ? `${p.mediaCierre - p.mediaInicio >= 0 ? '+' : '−'}${num(Math.abs(p.mediaCierre - p.mediaInicio))}` : '—';
const NOTA_WILCOXON = 'Prueba de rangos con signo de Wilcoxon para muestras pareadas («con cambio» son los pares con diferencia distinta de cero, los únicos que entran a la prueba). p: aproximación normal con corrección por empates y por continuidad; p exacto: permutación de los signos. p Holm: ajuste por comparaciones múltiples dentro de la tabla. r: correlación biserial de rangos, (W⁺ − W⁻)/(W⁺ + W⁻).';

function filaComparacion(etq, x, extra = '') {
  const p = x.pareado;
  return `<tr><td>${etq}</td>${extra}<td class="num">${x.inicio.n}</td><td class="num">${mde(x.inicio)}</td><td class="num">${x.cierre.n}</td><td class="num">${mde(x.cierre)}</td>
    <td class="num">${p.n}</td><td class="num">${p.nDif}</td><td class="num">${delta(p)}</td><td class="num">${p.nDif ? num(p.wMas, 1) : '—'}</td><td class="num">${p.z === null ? '—' : num(p.z)}</td>
    <td class="num">${pValor(p.p)}</td><td class="num">${pValor(p.pExacto)}</td><td class="num">${'pHolm' in p ? pValor(p.pHolm) : ''}</td><td class="num">${p.rb === null ? '—' : num(p.rb)}</td></tr>`;
}
const CAB_COMP = (primera, extra = '') => `<thead><tr><th>${primera}</th>${extra}<th class="num">n ini</th><th class="num">Inicio M (DE)</th><th class="num">n cie</th><th class="num">Cierre M (DE)</th><th class="num">Pares</th><th class="num">Con cambio</th><th class="num">Δ media</th><th class="num">W⁺</th><th class="num">z</th><th class="num">p</th><th class="num">p exacto</th><th class="num">p Holm</th><th class="num">r</th></tr></thead>`;

function tablaAFilas(tabla) {
  return [...tabla.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
}

function analisisAE(ps) {
  const r = AN.autoeficacia(ps, D.docente);
  const t = r.total;
  const e = SECCION.AE;
  return `
    <div class="tiles">
      <div class="tile"><span>Escala completa · inicio</span><b>${num(t.inicio.media)}</b><small>n = ${t.inicio.n} · DE ${num(t.inicio.de)}</small></div>
      <div class="tile"><span>Escala completa · cierre</span><b>${num(t.cierre.media)}</b><small>n = ${t.cierre.n} · DE ${num(t.cierre.de)}</small></div>
      <div class="tile"><span>Cambio pareado</span><b>${delta(t.pareado)}</b><small>${t.pareado.n} pares · p ${pValor(t.pareado.p)}</small></div>
      <div class="tile"><span>Tamaño del efecto</span><b>${t.pareado.rb === null ? '—' : num(t.pareado.rb)}</b><small>r biserial de rangos</small></div>
    </div>
    <div class="tarjeta bloque">
      <div class="bloque-cabeza"><h2>Por ítem</h2>${leyendaSeries()}</div>
      <p class="tenue">${esc(e.enunciado)} Escala de 1 (nada capaz) a 5 (totalmente capaz). El punto marca la media; la barra, cuántos eligieron cada valor.</p>
      ${leyendaLikert('Nada capaz', 'Totalmente capaz')}
      <div class="items-an">
        <div class="item-an cab"><span></span><span>Media (1 a 5)${ejeEscala()}</span><span>Distribución</span><span class="num">Pares · Δ · p</span></div>
        ${r.items.map(i => `<div class="item-an">
          <div><b class="mono">${i.id}</b> ${esc(i.texto)}${i.parte ? `<br><span class="pill azul">Parte ${esc(i.parte.join(' y '))}</span> <span class="tenue">${esc(i.ra || '')}</span>` : ''}</div>
          <div>${mancuerna(i.inicio.media, i.cierre.media)}<small class="tenue">${num(i.inicio.media)} → ${num(i.cierre.media)}</small></div>
          <div class="dist"><span>Inicio</span>${barraLikert(i.inicio.dist, `${i.id} inicio`)}<span>Cierre</span>${barraLikert(i.cierre.dist, `${i.id} cierre`)}</div>
          <div class="num">${i.pareado.n} · <b>${delta(i.pareado)}</b><br><span class="tenue">p ${pValor(i.pareado.p)}</span></div>
        </div>`).join('')}
      </div>
    </div>
    ${r.partes ? `<div class="tarjeta bloque"><div class="bloque-cabeza"><h2>Por parte del caso</h2><button class="btn chico sec" data-tabla="tablaPartes" data-nombre="autoeficacia_por_parte">Descargar tabla</button></div>
      <p class="tenue">Promedio de los ítems de cada parte por persona (el ítem 7 cuenta en B y en C).</p>
      <div class="tabla-scroll"><table class="tabla" id="tablaPartes">${CAB_COMP('Parte', '<th>Ítems</th>')}<tbody>
      ${r.partes.map(p => filaComparacion(esc(p.nombre), p, `<td class="mono">${p.ids.map(x => x.slice(2)).join(', ')}</td>`)).join('')}
      ${filaComparacion('<b>Escala completa</b>', t, '<td class="mono">1 a 10</td>')}</tbody></table></div></div>` : ''}
    <div class="tarjeta bloque"><div class="bloque-cabeza"><h2>Tabla por ítem</h2><button class="btn chico sec" data-tabla="tablaAE" data-nombre="autoeficacia_por_item">Descargar tabla</button></div>
      <div class="tabla-scroll"><table class="tabla" id="tablaAE">${CAB_COMP('Ítem', r.partes ? '<th>Parte</th>' : '')}<tbody>
      ${r.items.map(i => filaComparacion(`<span class="mono">${i.id}</span>`, i, r.partes ? `<td>${esc((i.parte || []).join(' y '))}</td>` : '')).join('')}</tbody></table></div>
      <p class="tenue nota-metodo">${NOTA_WILCOXON}</p></div>`;
}

function analisisK(ps) {
  const r = AN.conocimiento(ps, D.docente?.clave || null);
  const hayClave = Boolean(D.docente?.clave);
  const t = r.total;
  return `
    ${hayClave ? '' : '<div class="nota-caja aviso"><p>Sin el archivo docente solo se muestra qué alternativa eligió cada grupo. Cárgalo en <b>Aplicaciones</b> para ver respuestas correctas y la prueba de McNemar.</p></div>'}
    ${t ? `<div class="tiles">
      <div class="tile"><span>Correctas · inicio</span><b>${num(t.inicio.media)}</b><small>de ${t.max} · n = ${t.inicio.n}</small></div>
      <div class="tile"><span>Correctas · cierre</span><b>${num(t.cierre.media)}</b><small>de ${t.max} · n = ${t.cierre.n}</small></div>
      <div class="tile"><span>Cambio pareado</span><b>${delta(t.pareado)}</b><small>${t.pareado.n} pares · p ${pValor(t.pareado.p)} (Wilcoxon)</small></div>
    </div>` : ''}
    <div class="bloque-cabeza suelta"><span></span>${leyendaSeries()}</div>
    ${r.items.map(i => `<div class="tarjeta bloque">
      <h2><span class="mono">${i.id}</span></h2><p>${esc(i.texto)}</p>
      <div class="alts-an">${ALTERNATIVAS.map((a, k) => `<div class="alt-an ${i.clave === a ? 'correcta' : ''}">
        <div><b>${a})</b> ${esc(i.alternativas[a])}${i.clave === a ? ' <span class="pill ok">Correcta</span>' : ''}</div>
        <div class="props"><span>Inicio</span>${barraProp(i.inicio.dist[k], i.inicio.n, 'inicio', `${i.id} ${a}) inicio`)}<span>Cierre</span>${barraProp(i.cierre.dist[k], i.cierre.n, 'cierre', `${i.id} ${a}) cierre`)}</div>
      </div>`).join('')}</div>
      ${i.pareado ? `<p class="resumen-k">Correctas: inicio <b>${i.inicio.correctas}/${i.inicio.n}</b> (${pct(i.inicio.correctas, i.inicio.n)}), cierre <b>${i.cierre.correctas}/${i.cierre.n}</b> (${pct(i.cierre.correctas, i.cierre.n)}). Pareadas (${i.pareado.pares}): ${i.pareado.b} pasaron de incorrecta a correcta y ${i.pareado.c} de correcta a incorrecta; McNemar exacto p ${pValor(i.pareado.p)}, p Holm ${pValor(i.pareado.pHolm)}.</p>` : `<p class="tenue">n inicio = ${i.inicio.n} · n cierre = ${i.cierre.n}</p>`}
    </div>`).join('')}
    ${hayClave ? `<div class="tarjeta bloque"><div class="bloque-cabeza"><h2>Tabla por pregunta</h2><button class="btn chico sec" data-tabla="tablaK" data-nombre="conocimiento_por_pregunta">Descargar tabla</button></div>
      <div class="tabla-scroll"><table class="tabla" id="tablaK"><thead><tr><th>Pregunta</th><th class="num">Inicio correctas</th><th class="num">Cierre correctas</th><th class="num">Pares</th><th class="num">Correctas ini (pares)</th><th class="num">Correctas cie (pares)</th><th class="num">Incorrecta→correcta</th><th class="num">Correcta→incorrecta</th><th class="num">p McNemar</th><th class="num">p Holm</th></tr></thead><tbody>
      ${r.items.map(i => `<tr><td class="mono">${i.id}</td><td class="num">${i.inicio.correctas}/${i.inicio.n} (${pct(i.inicio.correctas, i.inicio.n)})</td><td class="num">${i.cierre.correctas}/${i.cierre.n} (${pct(i.cierre.correctas, i.cierre.n)})</td><td class="num">${i.pareado.pares}</td><td class="num">${pct(i.pareado.correctasInicio, i.pareado.pares)}</td><td class="num">${pct(i.pareado.correctasCierre, i.pareado.pares)}</td><td class="num">${i.pareado.b}</td><td class="num">${i.pareado.c}</td><td class="num">${pValor(i.pareado.p)}</td><td class="num">${pValor(i.pareado.pHolm)}</td></tr>`).join('')}</tbody></table></div>
      <p class="tenue nota-metodo">Prueba de McNemar exacta (binomial, dos colas) sobre las respuestas pareadas. p Holm: ajuste por las cuatro preguntas.</p></div>` : ''}`;
}

function analisisU(ps) {
  const r = AN.valoracion(ps);
  const n = Math.max(0, ...r.map(i => i.n));
  if (!n) return '<div class="nota-caja"><p>Aún no hay encuestas de cierre enviadas.</p></div>';
  return `<div class="tarjeta bloque"><div class="bloque-cabeza"><h2>Valoración del caso</h2><button class="btn chico sec" data-tabla="tablaU" data-nombre="valoracion">Descargar tabla</button></div>
    <p class="tenue">Solo encuesta de cierre. Escala de 1 (muy en desacuerdo) a 5 (muy de acuerdo).</p>
    ${leyendaLikert('Muy en desacuerdo', 'Muy de acuerdo')}
    <div class="items-an u">${r.map(i => `<div class="item-an">
      <div><b class="mono">${i.id}</b> ${esc(i.texto)}</div>
      <div class="dist una">${barraLikert(i.dist, i.id)}</div>
      <div class="num"><b>${num(i.media)}</b> <span class="tenue">(${num(i.de)})</span><br><span class="tenue">${pct(i.deAcuerdo, i.n)} de acuerdo</span></div>
    </div>`).join('')}</div>
    <div class="tabla-scroll"><table class="tabla" id="tablaU"><thead><tr><th>Afirmación</th><th class="num">n</th><th class="num">M</th><th class="num">DE</th><th class="num">1</th><th class="num">2</th><th class="num">3</th><th class="num">4</th><th class="num">5</th><th class="num">De acuerdo (4 o 5)</th></tr></thead><tbody>
    ${r.map(i => `<tr><td><span class="mono">${i.id}</span> ${esc(i.texto)}</td><td class="num">${i.n}</td><td class="num">${num(i.media)}</td><td class="num">${num(i.de)}</td>${i.dist.map(c => `<td class="num">${c}</td>`).join('')}<td class="num">${pct(i.deAcuerdo, i.n)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function analisisA(ps) {
  const r = AN.abiertas(ps, f => EX.idSeudonimo(f.correo, D.sal));
  if (!r.some(q => q.respuestas.length)) return '<div class="nota-caja"><p>Aún no hay encuestas de cierre enviadas.</p></div>';
  return `<div class="bloque-cabeza suelta"><p class="tenue">Cada respuesta lleva el código seudónimo y el equipo. Para codificar por tema, descarga la planilla: trae una columna TEMA vacía.</p>
    <button class="btn sec" type="button" id="btnAbiertasCsv">Descargar para codificar (CSV)</button></div>
    ${r.map(q => `<div class="tarjeta bloque"><h2><span class="mono">${q.id}</span> ${esc(q.texto)}</h2><p class="tenue">${q.respuestas.length} respuestas</p>
      <ul class="abiertas">${q.respuestas.map(x => `<li><p>${esc(x.texto)}</p><span class="tenue mono">${esc(x.id)} · equipo ${esc(x.equipo)}</span> ${x.citable ? '<span class="pill ok">Cita autorizada</span>' : '<span class="pill">Sin autorización de cita</span>'}</li>`).join('')}</ul></div>`).join('')}`;
}

function renderAnalisis() {
  const ps = personasAnalisis();
  const env = a => ps.filter(f => f.estado[a] === 'enviado').length;
  $('#filtroN').textContent = `${env('inicio')} de inicio · ${env('cierre')} de cierre · ${ps.filter(f => f.estado.inicio === 'enviado' && f.estado.cierre === 'enviado').length} pareadas`;
  document.querySelectorAll('#filtroAut button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === V.filtro)));
  document.querySelectorAll('#pestanas button').forEach(b => b.classList.toggle('activo', b.dataset.tab === V.tab));
  $('#analisisCuerpo').innerHTML = ({ ae: analisisAE, k: analisisK, u: analisisU, a: analisisA })[V.tab](ps);
  $('#btnAbiertasCsv')?.addEventListener('click', () => {
    descargar(`fcs_abiertas_${sello()}.csv`, EX.aCSV(EX.baseAbiertas({ personas: D.personas, sal: D.sal, soloAut: V.filtro === 'a1' ? 'a1' : null })));
  });
}

// ---------- Descargas ----------
function renderDescargas() {
  const n = D.personas.filter(f => f.participante || f.inicio || f.cierre).length;
  const n1 = AN.conAutorizacion(D.personas, 'a1').length;
  $('#descargasCuerpo').innerHTML = `
    <div class="rejilla-2">
      <div class="tarjeta bloque">
        <h2>Datos seudonimizados</h2>
        <p>Sin correo, nombre ni RUT: cada persona lleva un código estable. Es la base para el análisis y para compartir con el equipo de investigación.</p>
        <label class="check"><input type="checkbox" id="dSoloAut" checked> Solo quienes dieron la autorización 1 (${n1} de ${n})</label>
        <div class="acciones izq"><button class="btn" data-d="seud-xlsx">Excel</button><button class="btn sec" data-d="seud-csv">CSV</button></div>
      </div>
      <div class="tarjeta bloque">
        <h2>Datos completos</h2>
        <p>Con correo, nombre y RUT de los ${n} estudiantes con registro. Úsalos para el curso; no los compartas ni los subas al repositorio.</p>
        <div class="acciones izq"><button class="btn" data-d="comp-xlsx">Excel</button><button class="btn sec" data-d="comp-csv">CSV</button></div>
      </div>
      <div class="tarjeta bloque">
        <h2>Llave de correspondencia</h2>
        <p>Código ↔ correo, nombre y equipo. Guárdala separada de los datos seudonimizados: quien tenga ambas puede identificar a cada persona.</p>
        <div class="acciones izq"><button class="btn sec" data-d="llave">CSV</button></div>
      </div>
      <div class="tarjeta bloque">
        <h2>Respaldo completo</h2>
        <p>Todo lo guardado (lista, registros, consentimientos con su historial y respuestas) en un archivo JSON. Descárgalo al cerrar cada encuesta.</p>
        <div class="acciones izq"><button class="btn sec" data-d="respaldo">JSON</button><button class="btn sec" data-d="libro">Libro de códigos (CSV)</button></div>
      </div>
    </div>
    <p class="tenue">El Excel trae tres hojas: datos (una fila por persona), preguntas abiertas y libro de códigos. El CSV usa punto y coma y abre directo en Excel.${D.docente ? '' : ' Sin el archivo docente no se incluyen las columnas de respuesta correcta.'}</p>`;
  $('#descargasCuerpo').querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => exportar(b.dataset.d)));
}

function exportar(que) {
  const clave = D.docente?.clave || null;
  const base = (seud, soloAut) => EX.construirBase({ personas: D.personas, sal: D.sal, seudonimizar: seud, soloAut, clave });
  const xlsx = (nombre, seud, soloAut) => {
    if (!window.XLSX) return toast('No se pudo cargar el generador de Excel. Descarga el CSV.', true);
    const X = window.XLSX;
    const wb = X.utils.book_new();
    const hoja = (t, n) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(EX.aMatriz(t)), n);
    hoja(base(seud, soloAut), 'datos');
    hoja(EX.baseAbiertas({ personas: D.personas, sal: D.sal, soloAut }), 'abiertas');
    hoja(EX.libroDeCodigos(D.docente), 'libro_de_codigos');
    X.writeFile(wb, nombre);
  };
  const soloAut = $('#dSoloAut')?.checked ? 'a1' : null;
  if (que === 'seud-xlsx') xlsx(`fcs_seudonimizado_${sello()}.xlsx`, true, soloAut);
  if (que === 'seud-csv') descargar(`fcs_seudonimizado_${sello()}.csv`, EX.aCSV(base(true, soloAut)));
  if (que === 'comp-xlsx') xlsx(`fcs_completo_${sello()}.xlsx`, false, null);
  if (que === 'comp-csv') descargar(`fcs_completo_${sello()}.csv`, EX.aCSV(base(false, null)));
  if (que === 'llave') descargar(`fcs_llave_${sello()}.csv`, EX.aCSV(EX.llaveDeCorrespondencia(D.personas, D.sal)));
  if (que === 'libro') descargar(`fcs_libro_de_codigos_${sello()}.csv`, EX.aCSV(EX.libroDeCodigos(D.docente)));
  if (que === 'respaldo') {
    const { config, codigos, lista, participantes, respuestas } = D;
    descargar(`fcs_respaldo_${sello()}.json`, JSON.stringify({ exportado: new Date().toISOString(), config, codigos, lista, participantes, respuestas }, null, 1), 'application/json');
  }
}

// ---------- Arranque ----------
function ir(sec) {
  V.sec = sec;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('activo', b.dataset.sec === sec));
  document.querySelectorAll('.panel-sec').forEach(s => { s.hidden = s.id !== `sec-${sec}`; });
  window.scrollTo({ top: 0 });
  render();
}

async function entrar(usuario) {
  $('#puerta').hidden = true;
  $('#shell').hidden = false;
  $('#usuario').textContent = usuario.email || '';
  $('#demoTools').hidden = modo !== 'demo';
  await cargar();
  store.suscribir(() => { if (!document.querySelector('dialog[open]') && !V.listaPendiente) cargar().catch(console.error); });
}

function preparar() {
  activarTooltips();
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-sec]'); if (b) ir(b.dataset.sec); });
  $('#pestanas').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) { V.tab = b.dataset.tab; renderAnalisis(); } });
  $('#filtroAut').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) { V.filtro = b.dataset.v; renderAnalisis(); } });
  $('#filtroCurso').addEventListener('input', e => { V.busca = e.target.value; renderCurso(); });
  $('#tablaCurso').addEventListener('change', e => {
    const s = e.target.closest('select.accion');
    if (!s || !s.value) return;
    const accion = s.value;
    s.value = '';
    accionCurso(s.dataset.correo, accion);
  });
  $('#analisisCuerpo').addEventListener('click', e => {
    const b = e.target.closest('button[data-tabla]');
    if (!b) return;
    const filas = tablaAFilas($('#' + b.dataset.tabla));
    descargar(`fcs_${b.dataset.nombre}_${V.filtro === 'a1' ? 'aut1' : 'todos'}_${sello()}.csv`, EX.aCSV({ cols: filas[0], filas: filas.slice(1).map(f => Object.fromEntries(filas[0].map((c, i) => [c, f[i]]))) }));
  });
  $('#btnPapel').addEventListener('click', () => abrirPapel());
  $('#papCancelar').addEventListener('click', () => $('#dlgPapel').close());
  $('#formPapel').addEventListener('submit', guardarPapel);
  $('#btnRefrescar').addEventListener('click', () => intentar(cargar, 'Datos actualizados.'));
  $('#btnSalirDocente').addEventListener('click', async () => { await store.salirDocente(); location.reload(); });
  $('#cursoActivo').addEventListener('change', async e => { store.fijarCursoActual(e.target.value); V.listaPendiente = null; await cargar(); });
  $('#btnNuevoCurso').addEventListener('click', () => $('#dlgCurso').showModal());
  $('#formCurso').addEventListener('submit', async e => {
    e.preventDefault();
    const c = await intentar(() => store.crearCurso({ nombre: $('#cursoNombre').value, periodo: $('#cursoPeriodo').value }), 'Curso creado.');
    if (c) { store.fijarCursoActual(normalizarCursoId(`${$('#cursoNombre').value}-${$('#cursoPeriodo').value}`)); $('#dlgCurso').close(); await cargar(); }
  });
  $('#btnSembrar').addEventListener('click', async () => {
    if (!(await confirmar('¿Cargar datos de ejemplo?', 'Reemplaza todo lo que hay en la demo por un curso ficticio de 53 estudiantes en 14 equipos, con encuestas de inicio y de cierre.', 'Cargar'))) return;
    await store.sembrar();
    await cargar();
    toast('Datos de ejemplo cargados.');
  });
  $('#btnVaciar').addEventListener('click', async () => {
    if (!(await confirmar('¿Vaciar la demo?', 'Borra los datos de ejemplo de este navegador.', 'Vaciar'))) return;
    await store.vaciar();
    await cargar();
  });
  $('#btnGoogle').addEventListener('click', async () => {
    $('#puertaMsg').textContent = '';
    try { await entrar(await store.entrarDocente()); }
    catch (e) { console.error(e); $('#puertaMsg').textContent = e.code === 'no-docente' ? e.message : 'No fue posible entrar. Revisa que el navegador permita la ventana de Google.'; }
  });
}

async function arrancar() {
  preparar();
  try {
    const u = await store.restaurarDocente();
    if (u) return await entrar(u);
  } catch (e) { console.error(e); }
  $('#puerta').hidden = false;
}

arrancar();
