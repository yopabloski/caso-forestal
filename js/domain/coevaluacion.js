// Caso Forestal · auto y coevaluación. Fuente única de lo que ve el estudiante
// y de los cálculos del panel. Sin dependencias del navegador: se prueba con
// node --test.
//
// Una aplicación por entrega (coev1, coev2, coev3). Cada estudiante evalúa a
// todos los integrantes de su equipo, incluido él mismo: tareas a su cargo,
// lo que entregó realmente y una nota de 1 a 7 con medios puntos. El factor
// de 0 a 1 lo decide el profesor; aquí no se calcula ningún índice.

export const VERSION_COEV = 'coev-v1';

export const ENTREGAS = {
  coev1: { id: 'coev1', n: 1, nombre: 'Entrega 1', fecha: '2026-10-16' },
  coev2: { id: 'coev2', n: 2, nombre: 'Entrega 2', fecha: '2026-10-30' },
  coev3: { id: 'coev3', n: 3, nombre: 'Entrega 3', fecha: '2026-11-17' }
};
export const COEV_IDS = Object.keys(ENTREGAS);
export const esCoev = id => COEV_IDS.includes(id);

// Plazo por defecto: el día de la entrega a las 23:45 en Santiago.
export const HORA_CIERRE = '23:45';
export function cierrePorDefecto(id) {
  const e = ENTREGAS[id];
  return e ? msDesdeLocalChile(`${e.fecha}T${HORA_CIERRE}`) : null;
}

// "2026-10-16T23:45" interpretado en America/Santiago → milisegundos UTC.
// Se calcula el desfase real de esa fecha (horario de verano incluido).
export function msDesdeLocalChile(local) {
  const m = String(local || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const supuesto = Date.UTC(y, mo - 1, d, h, mi);
  const desfase = desfaseChile(supuesto);
  const ms = supuesto - desfase;
  // Si el cambio de hora cae entre medio, recalcula con el desfase del resultado.
  return supuesto - desfaseChile(ms);
}
function desfaseChile(ms) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(ms));
  const v = t => Number(partes.find(p => p.type === t).value);
  return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute')) - Math.floor(ms / 60000) * 60000;
}
export function localChileDesdeMs(ms) {
  if (!Number.isFinite(ms)) return '';
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(ms));
  const v = t => partes.find(p => p.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
}
export function textoPlazo(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export const NOTAS = Array.from({ length: 13 }, (_, i) => 1 + i / 2);
export const MIN_TEXTO = 15;
export const MAX_TEXTO = 800;
export const MAX_COMENTARIO = 1500;

export const REFERENCIA_NOTA = [
  [7, 'Cumplió todas sus tareas a tiempo y con calidad, y ayudó al equipo más allá de lo asignado.'],
  [5, 'Cumplió sus tareas con algún atraso o con correcciones importantes.'],
  [4, 'Cumplió lo mínimo.'],
  [2, 'Aportó muy poco.'],
  [1, 'No participó.']
];

export const PREGUNTAS = {
  tareas: { titulo: 'Tareas a su cargo en esta entrega', ayuda: 'Lo que le tocaba hacer según la distribución del equipo.' },
  entregado: { titulo: 'Lo que entregó realmente', ayuda: 'Qué hizo, cuándo y con qué calidad.' },
  nota: { titulo: 'Nota a su contribución', ayuda: 'De 1 a 7, con medios puntos.' }
};
export const PREGUNTA_FINAL = '¿Hay algo sobre el funcionamiento del equipo que el profesor deba saber?';

export const notaValida = n => typeof n === 'number' && NOTAS.includes(n);
const textoOk = t => typeof t === 'string' && t.trim().length >= MIN_TEXTO;

// Integrantes que evalúa un estudiante: él primero y luego el resto del
// equipo por nombre. `companeros` viene de su ficha en la lista del curso.
export function integrantesDe(ficha) {
  const yo = { correo: ficha.correo, nombre: ficha.nombre, yo: true };
  const otros = (ficha.companeros || []).filter(c => c.correo !== ficha.correo)
    .map(c => ({ correo: c.correo, nombre: c.nombre, yo: false }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return [yo, ...otros];
}

// Compañeros de cada estudiante a partir de la lista completa del curso.
export function companerosPorCorreo(lista) {
  const porEquipo = new Map();
  for (const f of lista) {
    if (!porEquipo.has(f.equipo)) porEquipo.set(f.equipo, []);
    porEquipo.get(f.equipo).push({ correo: f.correo, nombre: f.nombre });
  }
  const out = {};
  for (const f of lista) {
    out[f.correo] = porEquipo.get(f.equipo).filter(c => c.correo !== f.correo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  return out;
}
export function companerosIguales(a = [], b = []) {
  const k = x => x.map(c => `${c.correo}|${c.nombre}`).sort().join(';');
  return k(a) === k(b);
}

export function limpiarCoev(datos, correos) {
  const ev = {};
  for (const c of correos) {
    const e = datos?.evaluaciones?.[c] || {};
    const r = {};
    if (typeof e.tareas === 'string') r.tareas = e.tareas.slice(0, MAX_TEXTO);
    if (typeof e.entregado === 'string') r.entregado = e.entregado.slice(0, MAX_TEXTO);
    if (notaValida(e.nota)) r.nota = e.nota;
    ev[c] = r;
  }
  const comentario = typeof datos?.comentario === 'string' ? datos.comentario.slice(0, MAX_COMENTARIO) : '';
  return { evaluaciones: ev, comentario };
}

// Qué le falta a cada integrante para poder enviar.
export function faltantes(datos, correos) {
  const out = {};
  for (const c of correos) {
    const e = datos?.evaluaciones?.[c] || {};
    const f = [];
    if (!textoOk(e.tareas)) f.push('tareas');
    if (!textoOk(e.entregado)) f.push('entregado');
    if (!notaValida(e.nota)) f.push('nota');
    if (f.length) out[c] = f;
  }
  return out;
}
export function completitudCoev(datos, correos) {
  const f = faltantes(datos, correos);
  const hechos = correos.filter(c => !f[c]).length;
  return { hechos, total: correos.length, faltan: f, completa: hechos === correos.length };
}

// ¿Puede escribir ahora? Misma lógica que firestore.rules.
export function plazoVigente(ap, prorrogaMs, ahora = Date.now()) {
  if (Number.isFinite(prorrogaMs) && ahora < prorrogaMs) return true;
  if (!ap || ap.estado !== 'abierta') return false;
  return !Number.isFinite(ap.cierreMs) || ahora < ap.cierreMs;
}
export function plazoEfectivo(ap, prorrogaMs) {
  const base = Number.isFinite(ap?.cierreMs) ? ap.cierreMs : null;
  if (Number.isFinite(prorrogaMs) && (base === null || prorrogaMs > base)) return prorrogaMs;
  return base;
}

// ---------- Panel ----------
const media = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const de = xs => {
  if (xs.length < 2) return null;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const r1 = x => x === null || x === undefined ? null : Math.round(x * 10) / 10;
const coma = x => String(x).replace('.', ',');
const corto = t => !t || t.trim().length < 40;

export const UMBRALES = { paresBajo: 1.0, sobreAuto: 1.5 };

// docs: respuestas de esta aplicación, una por estudiante ({ correo, estado, evaluaciones, ... }).
// lista: [{ correo, nombre, equipo }].
export function analizarAplicacion({ lista, docs }) {
  const porCorreo = new Map(docs.map(d => [d.correo, d]));
  const equipos = new Map();
  for (const f of lista) {
    if (!equipos.has(f.equipo)) equipos.set(f.equipo, []);
    equipos.get(f.equipo).push(f);
  }
  const resultado = [...equipos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([equipo, integrantes]) => {
    integrantes = [...integrantes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const enviados = integrantes.filter(f => porCorreo.get(f.correo)?.estado === 'enviado');
    const matriz = {}; // matriz[evaluador][evaluado] = { nota, tareas, entregado }
    for (const ev of enviados) matriz[ev.correo] = porCorreo.get(ev.correo).evaluaciones || {};
    const miembros = integrantes.map(f => {
      const doc = porCorreo.get(f.correo);
      const auto = matriz[f.correo]?.[f.correo]?.nota ?? null;
      const pares = enviados.filter(e => e.correo !== f.correo)
        .map(e => matriz[e.correo]?.[f.correo]?.nota).filter(notaValida);
      return {
        correo: f.correo, nombre: f.nombre, equipo,
        estado: doc?.estado === 'enviado' ? 'enviado' : doc ? 'en-curso' : 'pendiente',
        enviado: doc?.enviado || null, origen: doc?.origen || null,
        comentario: doc?.estado === 'enviado' ? (doc.comentario || '') : '',
        auto, pares, paresMedia: r1(media(pares)), paresN: pares.length,
        diferencia: auto !== null && pares.length ? r1(auto - media(pares)) : null,
        alertas: []
      };
    });
    const mediasPares = miembros.map(m => m.paresMedia).filter(x => x !== null);
    for (const m of miembros) {
      if (m.estado !== 'enviado') m.alertas.push({ tipo: 'sin-respuesta', texto: 'No ha enviado su auto y coevaluación.' });
      const resto = miembros.filter(o => o !== m && o.paresMedia !== null).map(o => o.paresMedia);
      if (m.paresMedia !== null && resto.length && m.paresMedia <= media(resto) - UMBRALES.paresBajo) {
        m.alertas.push({ tipo: 'pares-bajo', texto: `Sus pares lo evalúan ${coma(r1(media(resto) - m.paresMedia))} puntos bajo el resto del equipo.` });
      }
      if (m.diferencia !== null && m.diferencia >= UMBRALES.sobreAuto) {
        m.alertas.push({ tipo: 'sobre-auto', texto: `Su autoevaluación supera en ${coma(m.diferencia)} puntos lo que dicen sus pares.` });
      }
      const suyas = matriz[m.correo];
      if (suyas) {
        const notas = Object.values(suyas).map(e => e.nota).filter(notaValida);
        if (notas.length >= 2 && notas.every(n => n === 7) && Object.values(suyas).every(e => corto(e.tareas) || corto(e.entregado))) {
          m.alertas.push({ tipo: 'todos-7', texto: 'Puso 7 a todos con justificaciones muy breves.' });
        }
      }
    }
    return {
      equipo, miembros, matriz,
      respondieron: enviados.length, total: integrantes.length,
      dispersion: r1(de(mediasPares)),
      rango: mediasPares.length ? r1(Math.max(...mediasPares) - Math.min(...mediasPares)) : null
    };
  });
  const miembros = resultado.flatMap(e => e.miembros);
  return {
    equipos: resultado,
    total: miembros.length,
    enviados: miembros.filter(m => m.estado === 'enviado').length,
    enCurso: miembros.filter(m => m.estado === 'en-curso').length,
    faltan: miembros.filter(m => m.estado !== 'enviado'),
    alertas: miembros.reduce((a, m) => a + m.alertas.filter(x => x.tipo !== 'sin-respuesta').length, 0)
  };
}

export const DESCUENTO_SIN_COEV = 0.5;

// Nota individual = nota del equipo × factor, menos 0,5 si no entregó la auto
// y coevaluación; mínimo 1,0 y redondeada a un decimal.
export function notaIndividual(notaEquipo, factor, entrego) {
  if (!Number.isFinite(notaEquipo) || !Number.isFinite(factor)) return null;
  const n = notaEquipo * factor - (entrego ? 0 : DESCUENTO_SIN_COEV);
  return Math.max(1, Math.round(n * 10) / 10);
}

export function factorValido(x) { return Number.isFinite(x) && x >= 0 && x <= 1; }
export function notaEquipoValida(x) { return Number.isFinite(x) && x >= 1 && x <= 7; }

// Filas para las descargas.
export function filasRespuestas(analisis, entrega) {
  const filas = [];
  for (const e of analisis.equipos) {
    const nombre = Object.fromEntries(e.miembros.map(m => [m.correo, m.nombre]));
    for (const [evaluador, evs] of Object.entries(e.matriz)) {
      for (const [evaluado, x] of Object.entries(evs)) {
        filas.push({
          entrega, equipo: e.equipo,
          evaluador: nombre[evaluador] || evaluador, correo_evaluador: evaluador,
          evaluado: nombre[evaluado] || evaluado, correo_evaluado: evaluado,
          tipo: evaluador === evaluado ? 'autoevaluación' : 'coevaluación',
          nota: x.nota ?? '', tareas: x.tareas || '', entregado: x.entregado || ''
        });
      }
    }
  }
  return filas;
}

export function filasConsolidado(analisis, entrega, privado) {
  const f = privado?.factores?.[entrega] || {};
  const ne = privado?.notasEquipo?.[entrega] || {};
  return analisis.equipos.flatMap(e => e.miembros.map(m => {
    const entrego = m.estado === 'enviado';
    const notaEq = ne[e.equipo];
    const factor = f[m.correo];
    return {
      entrega, equipo: e.equipo, estudiante: m.nombre, correo: m.correo,
      respondio: entrego ? 'Sí' : 'No',
      autoevaluacion: m.auto ?? '', nota_pares: m.paresMedia ?? '', n_pares: m.paresN,
      nota_equipo: Number.isFinite(notaEq) ? notaEq : '',
      descuento: entrego ? 0 : DESCUENTO_SIN_COEV,
      factor: Number.isFinite(factor) ? factor : '',
      nota_individual: notaIndividual(notaEq, factor, entrego) ?? '',
      alertas: m.alertas.filter(a => a.tipo !== 'sin-respuesta').map(a => a.texto).join(' ')
    };
  }));
}
