// Caso Forestal · vista del resultado de una verificación para el equipo.
// Recibe la vista que arma el servidor (functions/vista_alumno.py) y devuelve
// HTML. Sin dependencias: la usan verificador.js y docs/vista-previa-verificador.html.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esNum = n => typeof n === 'number' && Number.isFinite(n);
export const usd = n => esNum(n) ? 'US$ ' + Math.round(n).toLocaleString('es-CL') : '—';
const num = (n, d = 0) => esNum(n) ? n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const pct = n => esNum(n) ? (100 * n).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%' : '—';
export const fechaCorta = iso => iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function tarjetaCosto(c) {
  const dif = c.diferencia;
  const tol = esNum(c.recalculado) ? Math.max(1, 1e-4 * c.recalculado) : 1;
  let estado = 'neutro', texto = 'El archivo no reporta COSTO_TOTAL';
  if (esNum(dif)) {
    if (Math.abs(dif) <= tol) { estado = 'ok'; texto = 'Coincide con el costo recalculado'; }
    else { estado = 'aviso'; texto = `Diferencia de ${usd(Math.abs(dif))} (${dif > 0 ? 'reportan más' : 'reportan menos'})`; }
  }
  return `<div class="cifra principal-cifra"><small>Costo recalculado</small><b>${usd(c.recalculado)}</b><span>Con el transporte de ${esc(c.modo_transporte || 'costo mínimo')}</span></div>
    <div class="cifra ${estado}"><small>Costo que reportan</small><b>${usd(c.reportado)}</b><span>${esc(texto)}</span></div>`;
}

function desglose(c) {
  const partes = [['Cosecha', c.cosecha, 'p1'], ['Construcción de caminos', c.construccion, 'p2'], ['Transporte', c.transporte, 'p3']];
  const total = partes.reduce((s, [, v]) => s + (esNum(v) ? v : 0), 0);
  if (!total) return '';
  return `<section class="bloque-r"><h3>Desglose del costo recalculado</h3>
    <div class="barra-costo" role="img" aria-label="Desglose del costo">${partes.map(([n, v, k]) => `<span class="${k}" style="flex:${Math.max(v, 0)}" title="${esc(n)}"></span>`).join('')}</div>
    <ul class="leyenda-costo">${partes.map(([n, v, k]) => `<li><i class="${k}"></i>${esc(n)}<b>${usd(v)}</b><em>${pct(v / total)}</em></li>`).join('')}</ul></section>`;
}

function plan(p, entregas) {
  const periodos = Object.keys(p.ha_por_periodo || {}).sort();
  const salidas = {};
  for (const [k, v] of Object.entries(entregas || {})) {
    const [s, per] = k.split('-P'); (salidas[s] ||= {})[per] = v;
  }
  return `<section class="bloque-r"><h3>El plan, periodo a periodo</h3>
    <div class="resumen-plan"><span><b>${num(p.rodales)}</b> rodales cosechados</span><span><b>${num(p.volumen_m3)}</b> m³</span><span><b>${num(p.caminos)}</b> caminos</span><span><b>${num(p.km, 2)}</b> km construidos</span></div>
    <div class="tabla-scroll"><table class="tabla"><thead><tr><th></th>${periodos.map(t => `<th class="num">Periodo ${esc(t)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Hectáreas cosechadas</td>${periodos.map(t => `<td class="num">${num(p.ha_por_periodo[t], 1)}</td>`).join('')}</tr>
      <tr><td>Km de caminos nuevos</td>${periodos.map(t => `<td class="num">${num(p.km_por_periodo?.[t], 2)}</td>`).join('')}</tr>
      ${Object.entries(salidas).map(([s, v]) => `<tr><td>m³ entregados en la salida <span class="mono">${esc(s)}</span></td>${periodos.map(t => `<td class="num${v[t] === 0 ? ' cero' : ''}">${num(v[t])}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></section>`;
}

function condiciones(lista) {
  if (!lista?.length) return '';
  return `<section class="bloque-r"><h3>Ruta y compromisos</h3>${lista.map(c => {
    const clase = !c.exigida ? 'no-exigida' : c.cumple ? 'cumple' : 'falla';
    const marca = !c.exigida ? '–' : c.cumple ? '✓' : '✕';
    const etiqueta = !c.exigida ? '<span class="pill">No exigida en este caso</span>' : c.cumple ? '<span class="pill ok">Cumple</span>' : '<span class="pill no">No cumple</span>';
    return `<div class="condicion ${clase}"><span class="marca-estado">${marca}</span><div><b>${esc(c.nombre)}</b> ${etiqueta}<p>${esc(c.detalle)}</p></div></div>`;
  }).join('')}</section>`;
}

function corregir(v) {
  if (v.valida || !v.diagnosticos?.length) return '';
  return `<section class="bloque-r corregir"><h3>Qué corregir · ${v.total_errores} ${v.total_errores === 1 ? 'problema' : 'problemas'}</h3>
    <p class="ayuda-r">Conviene corregir en este orden: un error en las primeras categorías suele provocar los siguientes.</p>
    ${v.diagnosticos.map((d, i) => `<details class="grupo-error" ${i < 2 ? 'open' : ''}><summary><span class="n">${i + 1}</span>${esc(d.categoria)}<span class="pill no">${d.total}</span></summary>
      <ul>${d.detalles.map(x => `<li>${esc(x)}</li>`).join('')}${d.total > d.detalles.length ? `<li class="mas">y ${d.total - d.detalles.length} más del mismo tipo</li>` : ''}</ul></details>`).join('')}</section>`;
}

function advertencias(lista, valida) {
  if (!lista?.length) return '';
  const nota = valida ? ' (no cambian la factibilidad, pero conviene corregirlas antes de entregar)' : '';
  return `<div class="nota-caja aviso"><b>Advertencias</b>${nota}<ul>${lista.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
}

function gerencia(g) {
  if (!g) return '';
  return `<div class="cifra gerencia"><small>Indicador de su gerencia</small><b>${num(g.valor, g.unidad === 'ha' ? 1 : 0)} <em>${esc(g.unidad)}</em></b><span>${esc(g.nombre)}</span></div>`;
}

export function renderResultado(v, meta = {}) {
  const ok = v.valida;
  const titulo = ok ? 'Solución factible' : 'Solución no factible';
  const bajada = ok
    ? 'El plan cumple todas las condiciones que se exigen en este caso. Revisen que el costo que reportan coincida antes de entregarla.'
    : 'El plan no cumple al menos una condición. Abajo está lo que hay que corregir; igual les mostramos el costo del plan tal como está.';
  return `<article>
    <header class="resultado-cabeza ${ok ? 'ok' : 'no'}"><div><p class="kicker">${esc(v.etiqueta_entrega)} · caso <span class="mono">${esc(v.caso)}</span></p><h2>${titulo}</h2></div><span class="pill ${ok ? 'ok' : 'no'}">${ok ? 'Factible' : 'No factible'}</span></header>
    <div class="resultado-cuerpo">
      <p class="bajada-r">${bajada}</p>
      ${corregir(v)}
      <div class="cifras">${tarjetaCosto(v.costo)}${gerencia(v.gerencia)}</div>
      ${advertencias(v.advertencias, ok)}
      ${condiciones(v.condiciones)}
      ${desglose(v.costo)}
      ${plan(v.plan, v.entregas)}
      <footer class="pie-resultado"><span class="mono">Registro ${esc(meta.id || '—')} · huella ${esc(meta.huella || '—')} · ${esc(fechaCorta(meta.fecha))} · verificador ${esc(v.version)}</span>
        <button class="btn sec chico" type="button" data-comprobante>Descargar comprobante</button></footer>
    </div></article>`;
}
