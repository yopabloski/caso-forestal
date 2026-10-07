// Caso Forestal · gráficos del panel, en HTML y CSS (sin librerías).
// Color: inicio y cierre son dos series categóricas (naranja y verde azulado,
// validadas para daltonismo y contraste); la escala 1 a 5 usa una paleta
// divergente con punto medio gris. El color nunca va solo: cada serie lleva
// su etiqueta y cada segmento su valor al pasar el cursor.

export const SERIE = { inicio: '#D9722B', cierre: '#0B8F88' };
export const DIVERGENTE = ['#B5491C', '#EBAF86', '#D5DCDF', '#7FCFC6', '#0B6F6A'];

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const num = (v, d = 2) => v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (a, b) => b ? `${Math.round((a / b) * 100)}%` : '—';
export const pValor = p => p === null || p === undefined ? '—' : p < 0.001 ? '< 0,001' : num(p, 3);

// Barra apilada al 100% con la distribución de una escala 1 a 5.
export function barraLikert(dist, etiqueta) {
  const n = dist.reduce((a, b) => a + b, 0);
  if (!n) return `<div class="g-barra vacia" aria-label="${esc(etiqueta)}: sin respuestas"><span>Sin respuestas</span></div>`;
  return `<div class="g-barra" role="img" aria-label="${esc(etiqueta)}: ${dist.map((c, i) => `${i + 1}: ${c}`).join(', ')}">${dist.map((c, i) => c
    ? `<i style="flex:${c} 1 0;background:${DIVERGENTE[i]}" data-tip="${esc(etiqueta)} · valor ${i + 1}: ${c} de ${n} (${pct(c, n)})"></i>` : '').join('')}</div>`;
}

export const leyendaLikert = (min, max) => `<div class="g-leyenda" aria-hidden="true">
  <span>${esc(min)}</span>${DIVERGENTE.map((c, i) => `<i style="background:${c}"></i><b>${i + 1}</b>`).join('')}<span>${esc(max)}</span></div>`;

export const leyendaSeries = () => `<div class="g-leyenda series">
  <span><i class="punto" style="background:${SERIE.inicio}"></i>Inicio</span>
  <span><i class="punto" style="background:${SERIE.cierre}"></i>Cierre</span></div>`;

// Mancuerna: media de inicio y de cierre sobre el eje 1 a 5.
export function mancuerna(mIni, mCie, { min = 1, max = 5 } = {}) {
  const pos = v => `${((v - min) / (max - min)) * 100}%`;
  const hay = v => v !== null && v !== undefined && Number.isFinite(v);
  const a = hay(mIni), b = hay(mCie);
  const izq = a && b ? Math.min(mIni, mCie) : null;
  return `<div class="g-eje" role="img" aria-label="Media de inicio ${num(mIni)}, media de cierre ${num(mCie)}">
    ${[1, 2, 3, 4, 5].map(v => `<u style="left:${pos(v)}"></u>`).join('')}
    ${a && b ? `<s style="left:${pos(izq)};width:calc(${pos(Math.max(mIni, mCie))} - ${pos(izq)})"></s>` : ''}
    ${a ? `<i style="left:${pos(mIni)};background:${SERIE.inicio}" data-tip="Inicio: media ${num(mIni)}"></i>` : ''}
    ${b ? `<i style="left:${pos(mCie)};background:${SERIE.cierre}" data-tip="Cierre: media ${num(mCie)}"></i>` : ''}
  </div>`;
}
export const ejeEscala = () => `<div class="g-eje-num" aria-hidden="true">${[1, 2, 3, 4, 5].map(v => `<span style="left:${(v - 1) * 25}%">${v}</span>`).join('')}</div>`;

// Barras horizontales comparadas (inicio y cierre) para una proporción.
export function barraProp(valor, total, serie, etiqueta) {
  const p = total ? (valor / total) * 100 : 0;
  return `<div class="g-prop" data-tip="${esc(etiqueta)}: ${valor} de ${total} (${pct(valor, total)})">
    <div class="g-pista"><i style="width:${p}%;background:${SERIE[serie]}"></i></div>
    <span>${pct(valor, total)}</span></div>`;
}

// Avance de una aplicación: enviadas, en curso y pendientes.
export function barraAvance({ enviado, enCurso, pendiente }) {
  const n = enviado + enCurso + pendiente;
  if (!n) return '';
  return `<div class="g-barra avance" role="img" aria-label="${enviado} enviadas, ${enCurso} en curso, ${pendiente} pendientes">
    ${enviado ? `<i style="flex:${enviado} 1 0;background:linear-gradient(90deg,#17C3B2,#2EDC8E)" data-tip="Enviadas: ${enviado} de ${n}"></i>` : ''}
    ${enCurso ? `<i style="flex:${enCurso} 1 0;background:#FFB547" data-tip="En curso: ${enCurso} de ${n}"></i>` : ''}
    ${pendiente ? `<i style="flex:${pendiente} 1 0;background:#DCE5E8" data-tip="Pendientes: ${pendiente} de ${n}"></i>` : ''}
  </div>`;
}

// Capa de información al pasar el cursor (un solo elemento flotante).
export function activarTooltips(raiz = document) {
  let tip = document.querySelector('.g-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'g-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  const mover = e => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) { tip.classList.remove('visible'); return; }
    tip.textContent = el.dataset.tip;
    tip.classList.add('visible');
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, e.clientX + 12))}px`;
    tip.style.top = `${Math.max(8, e.clientY - r.height - 12)}px`;
  };
  raiz.addEventListener('mousemove', mover);
  raiz.addEventListener('mouseleave', () => tip.classList.remove('visible'), true);
}
