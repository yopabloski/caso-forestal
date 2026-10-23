// Comprobante descargable de una verificación (HTML autónomo, imprimible a PDF).
// Lo adjunta el equipo a su entrega; el docente lo contrasta con el registro
// del panel por el número de registro y la huella del archivo.
import { usd, fechaCorta } from './verificador-vista.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function comprobanteHtml({ id, fecha, huella, correo, equipo, resultado: v }) {
  const fila = (k, val) => `<tr><th>${esc(k)}</th><td>${val}</td></tr>`;
  const cond = (v.condiciones || []).filter(c => c.exigida).map(c => `<li class="${c.cumple ? 'ok' : 'no'}">${c.cumple ? '✓' : '✕'} ${esc(c.nombre)}</li>`).join('');
  const errores = (v.errores || []).map(e => `<li>${esc(e)}</li>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de verificación · Equipo ${esc(equipo)}</title>
<style>body{font:15px/1.5 Arial,Helvetica,sans-serif;color:#0B1F26;max-width:760px;margin:2rem auto;padding:0 1rem}
.membrete{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5C727A}h1{font-size:24px;margin:.3rem 0 1rem}
.estado{display:inline-block;padding:.3rem .9rem;border-radius:999px;font-weight:700}.estado.ok{background:#E1F6EC;color:#146C49}.estado.no{background:#FDEBE8;color:#B42B24}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid #E3EBEE;vertical-align:top}th{width:38%;color:#3E5761;font-weight:600}
.mono{font-family:Menlo,Consolas,monospace;font-size:13px}h2{font-size:16px;margin-top:1.4rem}li.ok{color:#146C49}li.no{color:#B42B24}
.pie{margin-top:2rem;font-size:12px;color:#5C727A;border-top:1px solid #E3EBEE;padding-top:.8rem}@media print{body{margin:0}}</style></head><body>
<p class="membrete">Universidad del Desarrollo · Tópicos de Optimización · 2026-2 · Caso Forestal Cordillera Sur</p>
<h1>Comprobante de verificación</h1>
<p><span class="estado ${v.valida ? 'ok' : 'no'}">${v.valida ? 'Solución factible' : 'Solución no factible'}</span></p>
<table>${fila('Equipo', esc(equipo))}${fila('Verificado por', esc(correo))}${fila('Fecha y hora', esc(fechaCorta(fecha)))}
${fila('Entrega', `${esc(v.etiqueta_entrega)} · caso <span class="mono">${esc(v.caso)}</span>`)}
${fila('Costo recalculado', usd(v.costo?.recalculado))}${fila('Costo reportado en el archivo', usd(v.costo?.reportado))}
${fila('Número de registro', `<span class="mono">${esc(id)}</span>`)}${fila('Huella del archivo', `<span class="mono">${esc(huella)}</span>`)}
${fila('Versión del verificador', esc(v.version))}</table>
${cond ? `<h2>Condiciones exigidas</h2><ul>${cond}</ul>` : ''}
${errores ? `<h2>Problemas encontrados (${v.total_errores})</h2><ul>${errores}</ul>` : ''}
<p class="pie">Este comprobante resume una verificación registrada en el servidor del curso. El docente la contrasta con su registro por el número de registro y la huella del archivo. Para guardarlo como PDF, usa Imprimir → Guardar como PDF.</p>
</body></html>`;
}
