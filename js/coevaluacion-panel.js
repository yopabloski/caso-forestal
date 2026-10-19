// Caso Forestal · panel docente de la auto y coevaluación.
import { store, modo } from './services/store.js';
import { normalizarCodigo } from './domain/identidad.js';
import {
  ENTREGAS, COEV_IDS, cierrePorDefecto, msDesdeLocalChile, localChileDesdeMs, textoPlazo,
  analizarAplicacion, notaIndividual, factorValido, notaEquipoValida, filasRespuestas, filasConsolidado,
  companerosPorCorreo, companerosIguales, DESCUENTO_SIN_COEV
} from './domain/coevaluacion.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n1 = x => x === null || x === undefined || x === '' ? '—' : String(Math.round(x * 10) / 10).replace('.', ',');
const fecha = iso => iso ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const sello = () => new Date().toISOString().slice(0, 10);
const leerNum = v => { const x = Number(String(v).replace(',', '.').trim()); return String(v).trim() === '' || !Number.isFinite(x) ? null : x; };

const D = { cursos: [], curso: null, config: null, codigos: {}, lista: [], participantes: [], respuestas: [], privado: { factores: {}, notasEquipo: {} } };
const V = { sec: 'coev1', abiertos: new Set(), editando: false };

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
async function intentar(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { console.error(e); toast(e.code ? e.message : 'No se pudo completar la acción. Revisa tu conexión.', true); return false; }
}
function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function aCSV(filas) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  const c = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const num = v => typeof v === 'number' ? String(v).replace('.', ',') : v;
  return '﻿' + [cols.join(';'), ...filas.map(f => cols.map(k => c(num(f[k]))).join(';'))].join('\r\n');
}
const urlAlumno = codigo => {
  const u = new URL('coevaluacion.html', location.href);
  u.search = codigo ? `?codigo=${encodeURIComponent(codigo)}` : '';
  u.hash = '';
  return u.toString();
};
const sugerirClave = ap => `FCS-CO${ENTREGAS[ap].n}-${Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01OI]/g, 'X')}`;

// ---------- Datos ----------
async function cargar() {
  D.cursos = await store.listarCursos();
  if (!store.cursoActualId() && D.cursos.length) store.fijarCursoActual(D.cursos[0].id);
  D.curso = D.cursos.find(c => c.id === store.cursoActualId()) || null;
  $('#cursoActivo').innerHTML = D.cursos.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} · ${esc(c.periodo)}</option>`).join('');
  $('#cursoActivo').value = D.curso?.id || '';
  if (!D.curso) { $('#cuerpo').innerHTML = '<p class="tenue">No hay cursos. Créalos en el panel de encuestas.</p>'; return; }
  const [config, codigos, lista, participantes, respuestas, privado] = await Promise.all([
    store.cargarConfig(), store.codigosVigentes(), store.listarLista(), store.listarParticipantes(),
    store.listarRespuestas(), store.leerCoevPrivado()
  ]);
  Object.assign(D, { config, codigos, lista, participantes, respuestas, privado: { factores: privado.factores || {}, notasEquipo: privado.notasEquipo || {} } });
  // Cada estudiante necesita ver a sus compañeros: se escriben en su ficha.
  const comp = companerosPorCorreo(lista);
  if (lista.some(f => !companerosIguales(f.companeros, comp[f.correo]))) {
    const n = await store.sincronizarCompaneros();
    if (n) toast(`Equipos actualizados en ${n} fichas.`);
    D.lista = await store.listarLista();
  }
  $('#sync').textContent = `Actualizado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  render();
}

const docsDe = ap => D.respuestas.filter(r => r.clave === ap);
const analisisDe = ap => analizarAplicacion({ lista: D.lista, docs: docsDe(ap) });
const prorrogaDe = (correo, ap) => D.participantes.find(p => p.correo === correo)?.prorrogas?.[ap];

function estadoAp(ap) {
  const a = D.config?.aplicaciones?.[ap];
  if (!a) return { clase: '', texto: 'Sin abrir', abierta: false };
  if (a.estado !== 'abierta') return { clase: '', texto: 'Cerrada', abierta: false };
  if (Number.isFinite(a.cierreMs) && Date.now() >= a.cierreMs) return { clase: 'no', texto: 'Plazo vencido', abierta: false, vencida: true };
  return { clase: 'ok', texto: 'Abierta', abierta: true };
}

// ---------- Render ----------
function render() {
  if (V.editando) return;
  const avisos = [];
  if (modo === 'demo') avisos.push(['aviso', '<b>Modo demo.</b> Los datos viven solo en este navegador.']);
  if (!D.lista.length) avisos.push(['aviso', '<b>Falta la lista del curso.</b> Cárgala en el panel de encuestas, sección Curso.']);
  $('#avisos').innerHTML = avisos.map(([c, h]) => `<div class="nota-caja ${c}"><p>${h}</p></div>`).join('');
  document.querySelectorAll('#nav button').forEach(b => {
    b.classList.toggle('activo', b.dataset.sec === V.sec);
    const ap = b.dataset.sec;
    if (ENTREGAS[ap]) b.dataset.estado = estadoAp(ap).abierta ? 'abierta' : '';
  });
  if (V.sec === 'consolidado') renderConsolidado(); else renderEntrega(V.sec);
}

function renderEntrega(ap) {
  const e = ENTREGAS[ap];
  const cfg = D.config.aplicaciones?.[ap];
  const est = estadoAp(ap);
  const cod = D.codigos[ap] || '';
  const cierre = Number.isFinite(cfg?.cierreMs) ? cfg.cierreMs : cierrePorDefecto(ap);
  const an = analisisDe(ap);
  const ne = D.privado.notasEquipo[ap] || {};
  const fa = D.privado.factores[ap] || {};
  const pct = an.total ? Math.round((an.enviados / an.total) * 100) : 0;

  $('#cuerpo').innerHTML = `
    <header class="sec-cabeza con-acciones">
      <div><p class="kicker">Auto y coevaluación</p><h1>${e.nombre}</h1>
      <p class="bajada">Cada estudiante evalúa a todo su equipo, incluido él mismo. El factor de 0 a 1 lo decides tú; el panel solo ordena la información.</p></div>
      <div class="acciones izq">
        <button class="btn sec" type="button" data-d="xlsx">Descargar Excel</button>
        <button class="btn sec" type="button" data-d="csv-resp">Respuestas CSV</button>
        <button class="btn sec" type="button" data-d="csv-cons">Notas CSV</button>
      </div>
    </header>

    <div class="tarjeta bloque config-ap">
      <div class="bloque-cabeza"><h2>Aplicación</h2><span class="pill ${est.clase}">${est.texto}${est.abierta && Number.isFinite(cfg?.cierreMs) ? ` hasta el ${esc(textoPlazo(cfg.cierreMs))}` : ''}</span></div>
      <div class="config-rejilla">
        <label class="campo"><span>Clave</span>
          <div class="fila"><input class="mono" id="inClave" value="${esc(cod)}" autocomplete="off" spellcheck="false" placeholder="Por ejemplo ${sugerirClave(ap)}">
          <button class="btn sec chico" type="button" id="btnSugerir">Sugerir</button>
          <button class="btn chico" type="button" id="btnClave">Guardar</button></div>
        </label>
        <label class="campo"><span>Cierre (hora de Chile)</span>
          <div class="fila"><input type="datetime-local" id="inCierre" value="${esc(localChileDesdeMs(cierre))}">
          <button class="btn chico" type="button" id="btnCierre" ${cfg ? '' : 'disabled'}>Guardar</button></div>
          <small class="ayuda">Pasada esta hora nadie puede guardar ni enviar, salvo quien tenga un plazo individual.</small>
        </label>
        <label class="campo"><span>Enlace directo</span>
          <div class="fila"><input readonly value="${cod ? esc(urlAlumno(cod)) : ''}" placeholder="Guarda primero una clave">
          <button class="btn sec chico" type="button" id="btnCopiarUrl" ${cod ? '' : 'disabled'}>Copiar</button></div>
        </label>
      </div>
      <div class="acciones izq">
        <button class="btn ${cfg?.estado === 'abierta' ? 'peligro' : ''}" type="button" id="btnAlternar">${cfg?.estado === 'abierta' ? 'Cerrar ahora' : 'Abrir'}</button>
        <button class="btn sec" type="button" id="btnPantalla" ${cod ? '' : 'disabled'}>Mostrar en pantalla</button>
      </div>
    </div>

    <div class="tiles">
      <div class="tile con-anillo"><div><span>Enviadas</span><b>${an.enviados}</b><small>de ${an.total} estudiantes</small></div><div class="anillo-caja" role="img" aria-label="${pct}%"><div class="anillo" style="--p:${pct}"></div><i>${pct}%</i></div></div>
      <div class="tile"><span>En curso</span><b>${an.enCurso}</b><small>borradores sin enviar</small></div>
      <div class="tile"><span>Faltan</span><b>${an.faltan.length}</b><small>−${String(DESCUENTO_SIN_COEV).replace('.', ',')} si no envían</small></div>
      <div class="tile ${an.alertas ? 'destacada' : ''}"><span>Alertas</span><b>${an.alertas}</b><small>para revisar</small></div>
    </div>

    <details class="tarjeta bloque faltan-bloque" ${an.faltan.length && an.faltan.length <= 15 ? 'open' : ''}>
      <summary><b>Faltan ${an.faltan.length}</b></summary>
      ${an.faltan.length ? `<ul class="lista-faltan">${an.faltan.map(m => `<li><span class="mono">${esc(m.equipo)}</span> ${esc(m.nombre)}${m.estado === 'en-curso' ? ' <span class="pill curso">Borrador</span>' : ''}${Number.isFinite(prorrogaDe(m.correo, ap)) ? ` <span class="pill azul">Plazo ${esc(fecha(new Date(prorrogaDe(m.correo, ap)).toISOString()))}</span>` : ''}</li>`).join('')}</ul>
      <button class="btn chico sec" type="button" id="btnCopiarFaltan">Copiar correos</button>` : '<p class="tenue">Nadie: respondieron todos.</p>'}
    </details>

    <div class="bloque-cabeza suelta"><h2 class="sub sin-margen">Por equipo</h2>
      <p class="tenue">Pares: promedio de lo que le pusieron sus compañeros. Dif.: autoevaluación menos pares. Nota individual = nota del equipo × factor${DESCUENTO_SIN_COEV ? `, −${String(DESCUENTO_SIN_COEV).replace('.', ',')} si no envió` : ''} (mínimo 1,0).</p></div>
    <div class="equipos-coev">${an.equipos.map(eq => tarjetaEquipo(ap, eq, ne[eq.equipo], fa)).join('') || '<p class="tenue">Aún no hay lista del curso.</p>'}</div>`;

  enlazarEntrega(ap, an);
}

function tarjetaEquipo(ap, eq, notaEq, fa) {
  const abierto = V.abiertos.has(`${ap}:${eq.equipo}`);
  const alertas = eq.miembros.reduce((a, m) => a + m.alertas.filter(x => x.tipo !== 'sin-respuesta').length, 0);
  return `<section class="tarjeta equipo-coev ${alertas ? 'con-alerta' : ''}" data-equipo="${esc(eq.equipo)}">
    <header class="eq-cabeza">
      <div><h3>Equipo ${esc(eq.equipo)}</h3><p class="tenue">${eq.respondieron} de ${eq.total} respondieron${eq.dispersion !== null ? ` · dispersión de pares ${n1(eq.dispersion)}` : ''}${alertas ? ` · <b class="txt-alerta">${alertas} alerta${alertas === 1 ? '' : 's'}</b>` : ''}</p></div>
      <label class="nota-eq"><span>Nota del equipo</span><input type="text" inputmode="decimal" data-nota-eq="${esc(eq.equipo)}" value="${Number.isFinite(notaEq) ? String(notaEq).replace('.', ',') : ''}" placeholder="—"></label>
    </header>
    <div class="tabla-scroll"><table class="tabla t-eq">
      <thead><tr><th>Integrante</th><th>Estado</th><th class="num">Auto</th><th class="num">Pares</th><th class="num">Dif.</th><th class="num">Factor</th><th class="num">Nota ind.</th><th></th></tr></thead>
      <tbody>${eq.miembros.map(m => {
        const f = fa[m.correo];
        const ni = notaIndividual(notaEq, f, m.estado === 'enviado');
        const pr = prorrogaDe(m.correo, ap);
        return `<tr>
          <td><b>${esc(m.nombre)}</b>${m.alertas.filter(a => a.tipo !== 'sin-respuesta').map(a => `<div class="alerta">${esc(a.texto)}</div>`).join('')}</td>
          <td>${m.estado === 'enviado' ? `<span class="pill ok">Enviada</span><br><span class="tenue">${esc(fecha(m.enviado))}</span>` : m.estado === 'en-curso' ? '<span class="pill curso">Borrador</span>' : '<span class="pill">Pendiente</span>'}${Number.isFinite(pr) ? `<br><span class="pill azul" title="Plazo individual">Hasta ${esc(fecha(new Date(pr).toISOString()))}</span>` : ''}</td>
          <td class="num">${n1(m.auto)}</td>
          <td class="num">${m.paresN ? `<b>${n1(m.paresMedia)}</b> <span class="tenue">(${m.paresN})</span>` : '—'}</td>
          <td class="num ${m.diferencia >= 1.5 ? 'txt-alerta' : ''}">${m.diferencia === null ? '—' : `${m.diferencia > 0 ? '+' : ''}${n1(m.diferencia)}`}</td>
          <td class="num"><input class="factor" type="text" inputmode="decimal" data-factor="${esc(m.correo)}" value="${Number.isFinite(f) ? String(f).replace('.', ',') : ''}" placeholder="0 a 1" aria-label="Factor de ${esc(m.nombre)}"></td>
          <td class="num"><b class="nota-ind">${ni === null ? '—' : n1(ni)}</b></td>
          <td><select class="accion" data-correo="${esc(m.correo)}" aria-label="Acciones">
            <option value="">…</option>
            <option value="plazo">${Number.isFinite(pr) ? 'Cambiar plazo individual' : 'Dar plazo individual'}</option>
            ${m.estado === 'enviado' ? '<option value="reabrir">Reabrir (vuelve a borrador)</option>' : ''}
          </select></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <details class="detalle-eq" data-clave="${ap}:${esc(eq.equipo)}" ${abierto ? 'open' : ''}>
      <summary>Matriz de notas y justificaciones</summary>
      ${detalleEquipo(eq)}
    </details>
  </section>`;
}

function detalleEquipo(eq) {
  const ms = eq.miembros;
  const ini = s => s.split(' ').slice(0, 2).join(' ');
  if (!Object.keys(eq.matriz).length) return '<p class="tenue">Nadie del equipo ha enviado todavía.</p>';
  const matriz = `<div class="tabla-scroll"><table class="tabla matriz">
    <thead><tr><th>Evaluador ↓ · Evaluado →</th>${ms.map(m => `<th class="num">${esc(ini(m.nombre))}</th>`).join('')}</tr></thead>
    <tbody>${ms.map(ev => `<tr><td><b>${esc(ini(ev.nombre))}</b></td>${ms.map(ob => {
      const x = eq.matriz[ev.correo]?.[ob.correo];
      return `<td class="num ${ev.correo === ob.correo ? 'diag' : ''}">${x?.nota ? n1(x.nota) : eq.matriz[ev.correo] ? '—' : '<span class="tenue">·</span>'}</td>`;
    }).join('')}</tr>`).join('')}
    <tr class="fila-media"><td>Pares (promedio)</td>${ms.map(m => `<td class="num"><b>${n1(m.paresMedia)}</b></td>`).join('')}</tr></tbody>
  </table></div>`;
  const textos = ms.map(ob => {
    const dichos = ms.filter(ev => eq.matriz[ev.correo]?.[ob.correo]).map(ev => {
      const x = eq.matriz[ev.correo][ob.correo];
      return `<li><div class="dicho-cab"><b>${ev.correo === ob.correo ? 'Autoevaluación' : esc(ev.nombre)}</b><span class="nota-chip">${n1(x.nota)}</span></div>
        <p><span>Tareas:</span> ${esc(x.tareas)}</p><p><span>Entregó:</span> ${esc(x.entregado)}</p></li>`;
    }).join('');
    return `<div class="sobre"><h4>Sobre ${esc(ob.nombre)}</h4><ul class="dichos">${dichos || '<li class="tenue">Sin evaluaciones aún.</li>'}</ul></div>`;
  }).join('');
  const comentarios = ms.filter(m => m.comentario).map(m => `<li><b>${esc(m.nombre)}:</b> ${esc(m.comentario)}</li>`).join('');
  return `${matriz}<div class="sobres">${textos}</div>${comentarios ? `<div class="nota-caja comentarios"><p><b>Sobre el funcionamiento del equipo</b></p><ul>${comentarios}</ul></div>` : ''}`;
}

// Guardado de factores y notas de equipo (documento privado), con espera.
let guardarT = null;
function guardarPrivado() {
  clearTimeout(guardarT);
  $('#sync').textContent = 'Guardando…';
  guardarT = setTimeout(async () => {
    const ok = await intentar(() => store.guardarCoevPrivado(D.privado));
    $('#sync').textContent = ok ? `Guardado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}` : 'Error al guardar';
  }, 700);
}

function enlazarEntrega(ap, an) {
  const c = $('#cuerpo');
  const clave = $('#inClave');
  clave.addEventListener('input', () => { clave.value = clave.value.toUpperCase(); });
  $('#btnSugerir').addEventListener('click', () => { clave.value = sugerirClave(ap); });
  $('#btnClave').addEventListener('click', async () => {
    if (await intentar(() => store.fijarCodigo(ap, normalizarCodigo(clave.value)), 'Clave guardada.')) await cargar();
  });
  $('#btnCopiarUrl').addEventListener('click', async () => {
    const u = urlAlumno(D.codigos[ap]);
    try { await navigator.clipboard.writeText(u); toast('Enlace copiado.'); } catch { toast(u); }
  });
  $('#btnCierre').addEventListener('click', async () => {
    const ms = msDesdeLocalChile($('#inCierre').value);
    if (!ms) return toast('Fecha u hora no válida.', true);
    const config = structuredClone(D.config);
    config.aplicaciones[ap] = { ...config.aplicaciones[ap], cierreMs: ms };
    if (await intentar(() => store.guardarConfig(config), `Cierre: ${textoPlazo(ms)}.`)) await cargar();
  });
  $('#btnAlternar').addEventListener('click', async () => {
    const cfg = D.config.aplicaciones?.[ap];
    const abierta = cfg?.estado === 'abierta';
    if (!abierta && !D.codigos[ap]) return toast('Guarda primero la clave.', true);
    if (!abierta && !D.lista.length) return toast('Carga primero la lista del curso.', true);
    const config = structuredClone(D.config);
    if (abierta) {
      if (!(await confirmar(`¿Cerrar la coevaluación de la ${ENTREGAS[ap].nombre}?`, 'Nadie podrá guardar ni enviar, aunque no haya llegado la hora de cierre. Quienes tengan plazo individual vigente sí podrán. Los borradores se conservan.', 'Cerrar'))) return;
      config.aplicaciones[ap] = { ...cfg, estado: 'cerrada' };
    } else {
      const ms = msDesdeLocalChile($('#inCierre').value) || cierrePorDefecto(ap);
      if (ms <= Date.now() && !(await confirmar('La hora de cierre ya pasó', `Está fijada para el ${textoPlazo(ms)}. Si abres así, nadie podrá responder. Cambia primero el cierre.`, 'Abrir igual'))) return;
      config.aplicaciones[ap] = { id: ap, ...(cfg || {}), estado: 'abierta', cierreMs: ms };
    }
    if (await intentar(() => store.guardarConfig(config), abierta ? 'Coevaluación cerrada.' : 'Coevaluación abierta.')) await cargar();
  });
  $('#btnPantalla').addEventListener('click', () => verPantalla(ap));
  $('#btnCopiarFaltan')?.addEventListener('click', async () => {
    const txt = an.faltan.map(m => m.correo).join('; ');
    try { await navigator.clipboard.writeText(txt); toast('Correos copiados.'); } catch { toast(txt); }
  });
  c.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => exportarEntrega(ap, b.dataset.d)));
  c.querySelectorAll('details.detalle-eq').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) V.abiertos.add(d.dataset.clave); else V.abiertos.delete(d.dataset.clave);
  }));

  V.an = an;
}

function enlazarCuerpo() {
  const c = $('#cuerpo');
  const recalcularFila = (ap, tr) => {
    const eq = tr.closest('[data-equipo]').dataset.equipo;
    const correo = tr.querySelector('[data-factor]').dataset.factor;
    const m = V.an.equipos.find(x => x.equipo === eq).miembros.find(x => x.correo === correo);
    const ni = notaIndividual(D.privado.notasEquipo[ap]?.[eq], D.privado.factores[ap]?.[correo], m.estado === 'enviado');
    tr.querySelector('.nota-ind').textContent = ni === null ? '—' : n1(ni);
  };
  c.addEventListener('focusin', e => { if (e.target.matches('[data-factor], [data-nota-eq]')) V.editando = true; });
  c.addEventListener('focusout', e => { if (e.target.matches('[data-factor], [data-nota-eq]')) V.editando = false; });
  c.addEventListener('change', e => {
    const t = e.target;
    const ap = V.sec;
    if (!ENTREGAS[ap]) return;
    if (t.matches('[data-factor]')) {
      const v = leerNum(t.value);
      if (v !== null && !factorValido(v)) { t.setAttribute('aria-invalid', 'true'); return toast('El factor va de 0 a 1.', true); }
      t.removeAttribute('aria-invalid');
      D.privado.factores[ap] = { ...(D.privado.factores[ap] || {}) };
      if (v === null) delete D.privado.factores[ap][t.dataset.factor]; else D.privado.factores[ap][t.dataset.factor] = v;
      recalcularFila(ap, t.closest('tr'));
      guardarPrivado();
    }
    if (t.matches('[data-nota-eq]')) {
      const v = leerNum(t.value);
      if (v !== null && !notaEquipoValida(v)) { t.setAttribute('aria-invalid', 'true'); return toast('La nota del equipo va de 1 a 7.', true); }
      t.removeAttribute('aria-invalid');
      D.privado.notasEquipo[ap] = { ...(D.privado.notasEquipo[ap] || {}) };
      if (v === null) delete D.privado.notasEquipo[ap][t.dataset.notaEq]; else D.privado.notasEquipo[ap][t.dataset.notaEq] = v;
      t.closest('[data-equipo]').querySelectorAll('.t-eq tbody tr').forEach(tr => recalcularFila(ap, tr));
      guardarPrivado();
    }
    if (t.matches('select.accion') && t.value) {
      const accion = t.value;
      t.value = '';
      accionMiembro(ap, t.dataset.correo, accion);
    }
  });
}

async function accionMiembro(ap, correo, accion) {
  const f = D.lista.find(x => x.correo === correo);
  const quien = f?.nombre || correo;
  if (accion === 'reabrir') {
    const vencida = !estadoAp(ap).abierta && !Number.isFinite(prorrogaDe(correo, ap));
    if (!(await confirmar(`¿Reabrir la evaluación de ${quien}?`, `Vuelve a borrador y podrá modificarla y enviarla de nuevo. La reapertura queda registrada.${vencida ? ' El plazo general ya terminó: dale también un plazo individual o no podrá enviarla.' : ''}`, 'Reabrir'))) return;
    if (await intentar(() => store.reabrir(correo, ap), 'Evaluación reabierta.')) await cargar();
  }
  if (accion === 'plazo') {
    const actual = prorrogaDe(correo, ap);
    const base = Math.max(Date.now(), D.config.aplicaciones?.[ap]?.cierreMs || 0);
    const sugerido = Number.isFinite(actual) ? actual : Math.ceil((base + 24 * 3600e3) / 9e5) * 9e5;
    $('#proQuien').innerHTML = `<b>${esc(quien)}</b> · ${ENTREGAS[ap].nombre}. Solo esta persona podrá guardar y enviar hasta esa hora, aunque la coevaluación esté cerrada.`;
    $('#proHasta').value = localChileDesdeMs(sugerido);
    $('#proAyuda').textContent = Number.isFinite(actual) ? `Plazo actual: ${textoPlazo(actual)}.` : '';
    $('#proQuitar').hidden = !Number.isFinite(actual);
    const d = $('#dlgProrroga');
    d.addEventListener('close', async () => {
      if (d.returnValue === 'si') {
        const ms = msDesdeLocalChile($('#proHasta').value);
        if (!ms || ms <= Date.now()) return toast('Elige una fecha futura.', true);
        if (await intentar(() => store.fijarProrroga(correo, ap, ms), `Plazo hasta el ${textoPlazo(ms)}.`)) await cargar();
      }
      if (d.returnValue === 'quitar' && await intentar(() => store.fijarProrroga(correo, ap, null), 'Plazo individual quitado.')) await cargar();
    }, { once: true });
    d.showModal();
  }
}

function verPantalla(ap) {
  const cod = D.codigos[ap];
  $('#panTitulo').textContent = `Auto y coevaluación · ${ENTREGAS[ap].nombre}`;
  $('#panUrl').textContent = urlAlumno('').replace(/^https?:\/\//, '');
  $('#panClave').textContent = cod;
  const cierre = D.config.aplicaciones?.[ap]?.cierreMs;
  $('#panNota').textContent = `Correo @udd.cl y RUT.${Number.isFinite(cierre) ? ` Cierra el ${textoPlazo(cierre)}.` : ''}`;
  const qr = $('#panQr');
  qr.innerHTML = '';
  if (window.QRCode) new window.QRCode(qr, { text: urlAlumno(cod), width: 300, height: 300, colorDark: '#0B1F26', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  else qr.innerHTML = '<p class="tenue">Sin generador de QR. Usa la dirección y la clave.</p>';
  $('#dlgPantalla').showModal();
}

// ---------- Consolidado ----------
function filasEvolucion() {
  const an = Object.fromEntries(COEV_IDS.map(ap => [ap, analisisDe(ap)]));
  const porCorreo = ap => new Map(an[ap].equipos.flatMap(e => e.miembros).map(m => [m.correo, m]));
  const mapas = Object.fromEntries(COEV_IDS.map(ap => [ap, porCorreo(ap)]));
  return [...D.lista].sort((a, b) => a.equipo.localeCompare(b.equipo) || a.nombre.localeCompare(b.nombre, 'es')).map(f => {
    const fila = { equipo: f.equipo, estudiante: f.nombre, correo: f.correo };
    for (const ap of COEV_IDS) {
      const m = mapas[ap].get(f.correo);
      const n = ENTREGAS[ap].n;
      const entrego = m?.estado === 'enviado';
      if (!D.config.aplicaciones?.[ap]) {
        for (const k of ['respondio', 'auto', 'pares', 'factor', 'nota_individual']) fila[`e${n}_${k}`] = '';
        continue;
      }
      fila[`e${n}_respondio`] = entrego ? 'Sí' : 'No';
      fila[`e${n}_auto`] = m?.auto ?? '';
      fila[`e${n}_pares`] = m?.paresMedia ?? '';
      fila[`e${n}_factor`] = D.privado.factores[ap]?.[f.correo] ?? '';
      fila[`e${n}_nota_individual`] = notaIndividual(D.privado.notasEquipo[ap]?.[f.equipo], D.privado.factores[ap]?.[f.correo], entrego) ?? '';
    }
    return fila;
  });
}

function renderConsolidado() {
  const filas = filasEvolucion();
  const celda = (f, n) => `<td class="num">${f[`e${n}_respondio`] === 'No' ? '<span class="pill no">No</span> ' : ''}${n1(f[`e${n}_pares`])}</td><td class="num">${n1(f[`e${n}_factor`])}</td><td class="num"><b>${n1(f[`e${n}_nota_individual`])}</b></td>`;
  $('#cuerpo').innerHTML = `
    <header class="sec-cabeza con-acciones">
      <div><p class="kicker">Auto y coevaluación</p><h1>Consolidado</h1>
      <p class="bajada">Evolución de cada estudiante en las tres entregas: nota de sus pares, el factor que decidiste y la nota individual.</p></div>
      <div class="acciones izq"><button class="btn" type="button" id="btnXlsxTodo">Descargar Excel</button><button class="btn sec" type="button" id="btnCsvTodo">CSV</button></div>
    </header>
    <div class="tarjeta bloque"><div class="tabla-scroll"><table class="tabla consolidado">
      <thead><tr><th rowspan="2">Eq.</th><th rowspan="2">Estudiante</th>${COEV_IDS.map(ap => `<th colspan="3" class="grupo">${ENTREGAS[ap].nombre}</th>`).join('')}</tr>
      <tr>${COEV_IDS.map(() => '<th class="num">Pares</th><th class="num">Factor</th><th class="num">Nota ind.</th>').join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr><td class="mono">${esc(f.equipo)}</td><td>${esc(f.estudiante)}</td>${COEV_IDS.map(ap => celda(f, ENTREGAS[ap].n)).join('')}</tr>`).join('') || '<tr><td colspan="11" class="tenue">Sin lista del curso.</td></tr>'}</tbody>
    </table></div>
    <p class="tenue">«No» marca a quien no envió su auto y coevaluación en esa entrega (descuento de ${String(DESCUENTO_SIN_COEV).replace('.', ',')}).</p></div>`;
  $('#btnCsvTodo').addEventListener('click', () => descargar(`coev_consolidado_${sello()}.csv`, aCSV(filas)));
  $('#btnXlsxTodo').addEventListener('click', () => {
    if (!window.XLSX) return toast('No se pudo cargar el generador de Excel. Descarga el CSV.', true);
    const X = window.XLSX;
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filas), 'consolidado');
    for (const ap of COEV_IDS) {
      const an = analisisDe(ap);
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filasConsolidado(an, ENTREGAS[ap].nombre, privadoPorNombre(ap))), `notas_e${ENTREGAS[ap].n}`);
      const r = filasRespuestas(an, ENTREGAS[ap].nombre);
      if (r.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(r), `respuestas_e${ENTREGAS[ap].n}`);
    }
    X.writeFile(wb, `coev_consolidado_${sello()}.xlsx`);
  });
}

// filasConsolidado indexa por la etiqueta de la entrega.
const privadoPorNombre = ap => ({
  factores: { [ENTREGAS[ap].nombre]: D.privado.factores[ap] || {} },
  notasEquipo: { [ENTREGAS[ap].nombre]: D.privado.notasEquipo[ap] || {} }
});

function exportarEntrega(ap, que) {
  const an = analisisDe(ap);
  const nombre = ENTREGAS[ap].nombre;
  const cons = filasConsolidado(an, nombre, privadoPorNombre(ap));
  const resp = filasRespuestas(an, nombre);
  const base = `coev_e${ENTREGAS[ap].n}`;
  if (que === 'csv-cons') return descargar(`${base}_notas_${sello()}.csv`, aCSV(cons));
  if (que === 'csv-resp') return resp.length ? descargar(`${base}_respuestas_${sello()}.csv`, aCSV(resp)) : toast('Aún no hay respuestas enviadas.', true);
  if (!window.XLSX) return toast('No se pudo cargar el generador de Excel. Descarga los CSV.', true);
  const X = window.XLSX;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(cons), 'notas');
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(resp.length ? resp : [{ aviso: 'Sin respuestas enviadas' }]), 'respuestas');
  X.writeFile(wb, `${base}_${sello()}.xlsx`);
}

// ---------- Arranque ----------
function ir(sec) {
  V.sec = sec;
  V.editando = false;
  window.scrollTo({ top: 0 });
  render();
}

async function entrar(usuario) {
  $('#puerta').hidden = true;
  $('#shell').hidden = false;
  $('#usuario').textContent = usuario.email || '';
  $('#demoTools').hidden = modo !== 'demo';
  await cargar();
  store.suscribir(() => { if (!document.querySelector('dialog[open]') && !V.editando) cargar().catch(console.error); });
}

function preparar() {
  enlazarCuerpo();
  $('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-sec]'); if (b) ir(b.dataset.sec); });
  $('#btnRefrescar').addEventListener('click', () => intentar(cargar, 'Datos actualizados.'));
  $('#btnSalirDocente').addEventListener('click', async () => { await store.salirDocente(); location.reload(); });
  $('#cursoActivo').addEventListener('change', async e => { store.fijarCursoActual(e.target.value); await cargar(); });
  $('#btnSembrar').addEventListener('click', async () => {
    if (!(await confirmar('¿Cargar datos de ejemplo?', 'Reemplaza la demo por un curso ficticio de 53 estudiantes con la coevaluación de la Entrega 1.', 'Cargar'))) return;
    await store.sembrar();
    await cargar();
  });
  $('#btnGoogle').addEventListener('click', async () => {
    $('#puertaMsg').textContent = '';
    try { await entrar(await store.entrarDocente()); }
    catch (e) { console.error(e); $('#puertaMsg').textContent = e.code === 'no-docente' ? e.message : 'No fue posible entrar. Revisa que el navegador permita la ventana de Google.'; }
  });
  const h = location.hash.slice(1);
  if (h === 'consolidado' || ENTREGAS[h]) V.sec = h;
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
