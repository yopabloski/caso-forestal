// Caso Forestal · FUENTE ÚNICA del contenido de la encuesta (versión vigente:
// Encuestas_Caso_v4). Este archivo es público: contiene solo lo que ve el
// estudiante. La parte del caso, el resultado de aprendizaje y la clave de las
// preguntas de conocimiento NO van aquí: se cargan en el panel desde el
// archivo docente y se guardan en un documento que solo lee el profesor.

export const VERSION_ENCUESTA = 'v4';

export const ESCALAS = {
  capacidad: { min: 1, max: 5, anclaMin: 'Nada capaz', anclaMax: 'Totalmente capaz' },
  acuerdo: { min: 1, max: 5, anclaMin: 'Muy en desacuerdo', anclaMax: 'Muy de acuerdo' }
};

export const ALTERNATIVAS = ['a', 'b', 'c', 'd'];

export const SECCIONES = [
  {
    id: 'AE',
    tipo: 'likert',
    escala: 'capacidad',
    aplicaciones: ['inicio', 'cierre'],
    titulo: 'Qué tan capaz te sientes',
    enunciado: '¿Qué tan capaz te sientes hoy de hacer lo siguiente?',
    ayuda: 'Marca de 1 (nada capaz) a 5 (totalmente capaz). No hay respuestas correctas ni incorrectas.',
    prefijo: 'Me siento capaz de…',
    items: [
      { id: 'AE1', texto: 'Identificar las decisiones, restricciones y objetivos de un problema real que no viene planteado como modelo.' },
      { id: 'AE2', texto: 'Explicitar y justificar los supuestos de un modelo.' },
      { id: 'AE3', texto: 'Formular un modelo de programación entera mixta con variables binarias para decisiones de construcción y cosecha.' },
      { id: 'AE4', texto: 'Representar con restricciones de flujo que un punto de una red esté conectado con un destino.' },
      { id: 'AE5', texto: 'Implementar en OPL/CPLEX un modelo de tamaño real a partir de datos en archivos.' },
      { id: 'AE6', texto: 'Comprobar por mi cuenta que una solución cumple todas las restricciones del problema.' },
      { id: 'AE7', texto: 'Interpretar la cota inferior y el gap que reporta el solver.' },
      { id: 'AE8', texto: 'Cuantificar cuánto cuesta agregar una restricción a un modelo ya resuelto.' },
      { id: 'AE9', texto: 'Analizar el conflicto entre dos objetivos con un método de optimización multiobjetivo.' },
      { id: 'AE10', texto: 'Comunicar una recomendación basada en un modelo a alguien sin formación técnica.' }
    ]
  },
  {
    id: 'K',
    tipo: 'alternativas',
    aplicaciones: ['inicio', 'cierre'],
    titulo: 'Cuatro preguntas de optimización',
    enunciado: 'Elige la alternativa que te parezca correcta.',
    ayuda: 'Estas preguntas no tienen nota. Responde con lo que sabes hoy, sin consultar apuntes ni a tus compañeros.',
    items: [
      {
        id: 'K1',
        texto: 'CPLEX se detiene con costo US$16 millones y gap de 20%. ¿Qué se puede afirmar?',
        alternativas: {
          a: 'El óptimo es US$16 millones ± 20%.',
          b: 'El óptimo está entre unos US$12,8 y 16 millones.',
          c: 'El plan es 20% peor que el óptimo.',
          d: 'No se puede afirmar nada.'
        }
      },
      {
        id: 'K2',
        texto: 'Para cosechar un rodal en el periodo 2, su madera debe llegar a una salida. ¿Qué debe cumplirse?',
        alternativas: {
          a: 'El camino que toca su nodo debe estar construido en el periodo 2.',
          b: 'Todos los caminos del predio deben estar construidos.',
          c: 'Debe existir una ruta de caminos construidos en el periodo 1 o 2 hasta una salida.',
          d: 'Basta con que el rodal no sea adyacente a otro cosechado.'
        }
      },
      {
        id: 'K3',
        texto: 'Un equipo usa M = 1.000.000.000 en la restricción que activa el flujo por un camino. ¿Cuál es el principal problema?',
        alternativas: {
          a: 'La relajación lineal se debilita y puede haber problemas numéricos.',
          b: 'El modelo queda infactible.',
          c: 'El costo se multiplica por M.',
          d: 'Ninguno: un M más grande siempre es más seguro.'
        }
      },
      {
        id: 'K4',
        texto: 'Un equipo minimiza el costo y obtiene un plan de US$4,3 millones con 500 ha cosechadas junto al bosque nativo. Luego minimiza esas hectáreas y obtiene un plan con 150 ha y un costo de US$5,6 millones. ¿Qué se puede afirmar?',
        alternativas: {
          a: 'El segundo plan es mejor, porque mejora el objetivo ambiental.',
          b: 'Ninguno de los dos planes domina al otro; elegir depende de cuánto valore el directorio cada objetivo.',
          c: 'Existe un plan con costo de US$4,3 millones y 150 ha.',
          d: 'El primer plan no cumple las restricciones del segundo modelo.'
        }
      }
    ]
  },
  {
    id: 'U',
    tipo: 'likert',
    escala: 'acuerdo',
    aplicaciones: ['cierre'],
    titulo: 'Tu valoración del caso',
    enunciado: '¿Qué tan de acuerdo estás con cada afirmación?',
    ayuda: 'Marca de 1 (muy en desacuerdo) a 5 (muy de acuerdo).',
    items: [
      { id: 'U1', texto: 'El caso me ayudó a aprender a modelar problemas de optimización.' },
      { id: 'U2', texto: 'El problema se sintió realista.' },
      { id: 'U3', texto: 'Tener datos distintos a los de otros equipos me obligó a resolver el problema por mi cuenta.' },
      { id: 'U4', texto: 'El verificador me ayudó a detectar errores en mi modelo o en mis datos.' },
      { id: 'U5', texto: 'Tener que justificar supuestos me hizo entender mejor el problema.' },
      { id: 'U6', texto: 'La carga de trabajo fue adecuada para el tiempo disponible.' },
      { id: 'U7', texto: 'Recomendaría usar este caso en futuras versiones del curso.' }
    ]
  },
  {
    id: 'A',
    tipo: 'abierta',
    aplicaciones: ['cierre'],
    titulo: 'Preguntas abiertas',
    enunciado: 'Responde con tus palabras. Bastan unas pocas líneas por pregunta.',
    ayuda: '',
    items: [
      { id: 'A1', texto: '¿Qué fue lo más valioso que aprendiste con este caso?' },
      { id: 'A2', texto: 'Describe un error que detectaste en tu modelo o en tus datos. ¿Cómo lo detectaste?' },
      { id: 'A3', texto: '¿Qué supuesto de tu equipo cambió más el resultado?' },
      { id: 'A4', texto: '¿Qué cambiarías del caso para el próximo semestre?' }
    ]
  }
];

export const SECCION = Object.fromEntries(SECCIONES.map(s => [s.id, s]));
export const ITEMS = SECCIONES.flatMap(s => s.items.map(i => ({ ...i, seccion: s.id, tipo: s.tipo, escala: s.escala })));
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const IDS = ITEMS.map(i => i.id);

export const seccionesDe = aplicacion => SECCIONES.filter(s => s.aplicaciones.includes(aplicacion));
export const itemsDe = aplicacion => seccionesDe(aplicacion).flatMap(s => s.items.map(i => ({ ...i, seccion: s.id, tipo: s.tipo, escala: s.escala })));

export const MAX_ABIERTA = 2000;

// ¿Es válido el valor v para el ítem?
export function valorValido(item, v) {
  if (!item) return false;
  if (item.tipo === 'likert') return Number.isInteger(v) && v >= 1 && v <= 5;
  if (item.tipo === 'alternativas') return ALTERNATIVAS.includes(v);
  if (item.tipo === 'abierta') return typeof v === 'string' && v.trim().length >= 3 && v.length <= MAX_ABIERTA;
  return false;
}

export function completitud(aplicacion, respuestas = {}) {
  const items = itemsDe(aplicacion);
  const respondidas = items.filter(i => valorValido(i, respuestas[i.id])).length;
  return { respondidas, total: items.length, faltan: items.filter(i => !valorValido(i, respuestas[i.id])).map(i => i.id) };
}

// Deja solo ítems de la aplicación con valores válidos (lo que se guarda).
export function limpiarRespuestas(aplicacion, respuestas = {}) {
  const out = {};
  for (const i of itemsDe(aplicacion)) {
    const v = respuestas[i.id];
    if (i.tipo === 'abierta') { if (typeof v === 'string' && v.trim()) out[i.id] = v.slice(0, MAX_ABIERTA); }
    else if (valorValido(i, v)) out[i.id] = v;
  }
  return out;
}
