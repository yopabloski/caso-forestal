// Caso Forestal · texto del consentimiento informado (versión en línea).
// Base: Consentimiento_Informado_CosechaForestal_v3. La sección 4 cambia
// respecto de la v3 porque el ingreso ya no es con una cuenta verificada: el
// estudiante se identifica con su correo @udd.cl, su RUT y la clave del curso.
// Si el texto cambia, cambie VERSION: cada decisión queda registrada con la
// versión vigente al momento de responder.

export const VERSION = 'v4';
export const FECHA_VERSION = '4 de octubre de 2026';
export const CONTACTO = 'pablogonzalez@udd.cl';

export const TITULO = 'Consentimiento informado';
export const SUBTITULO = 'Evaluación de un caso de estudio de optimización aplicado a la planificación forestal sostenible';

export const FICHA = [
  ['Investigador responsable', 'Pablo González Brevis, profesor del curso. Facultad de Ingeniería, Universidad del Desarrollo.'],
  ['Curso', 'Tópicos de Optimización (IIM329A), segundo semestre de 2026.'],
  ['Contacto', `<a href="mailto:${CONTACTO}">${CONTACTO}</a>`]
];

export const SECCIONES = [
  {
    n: 1, titulo: 'Invitación y propósito',
    parrafos: ['Te invitamos a participar en un estudio que busca evaluar si un caso de estudio basado en un problema real de planificación forestal, con decisiones abiertas y consideraciones ambientales, contribuye al aprendizaje del modelamiento matemático y de la toma de decisiones. Los resultados se usarán para mejorar el curso y podrán publicarse en revistas y congresos de educación en investigación de operaciones, como INFORMS Transactions on Education o la competencia de casos educativos de EURO.']
  },
  {
    n: 2, titulo: 'Qué implica participar',
    parrafos: ['Participar no te exige ninguna actividad adicional a las que ya forman parte del curso. Solo autorizas que la información que se genera normalmente en el caso se use con fines de investigación:'],
    lista: [
      'Tus respuestas a la encuesta de autorreporte de competencias que se usó para formar los equipos (ya respondida).',
      'Tus respuestas a las encuestas breves de inicio y de cierre del caso, y el plan intuitivo que tu equipo proponga en la clase de lanzamiento.',
      'Tus entregas del caso y las calificaciones obtenidas en cada criterio de la rúbrica.',
      'Los registros técnicos del verificador de soluciones: fechas, número de intentos y resultados de la validación.',
      'Tus comentarios escritos y reflexiones sobre el caso.',
      'Los reportes de avance y las tablas de tareas de tu equipo, y tus auto y coevaluaciones. Estas últimas se analizan solo de forma agregada: nunca se publica lo que una persona dijo de otra.'
    ]
  },
  {
    n: 3, titulo: 'Participación voluntaria y sin efecto en tus notas',
    parrafos: ['Tu participación es voluntaria. Decidir no participar, o retirarte en cualquier momento, no tiene ninguna consecuencia en tus calificaciones ni en tu relación con el profesor o la Universidad. Todas las actividades del caso se evalúan igual, participes o no en el estudio. El profesor del curso es el investigador responsable del estudio y tendrá acceso a tu decisión y a tus respuestas. Tu decisión no se usa en ninguna evaluación.']
  },
  {
    n: 4, titulo: 'Confidencialidad',
    parrafos: ['Te identificas con tu correo @udd.cl, tu RUT y la clave del curso. El correo y el RUT se usan solo para comprobar que eres estudiante del curso, para proteger tu acceso y para emparejar tus respuestas de inicio y de cierre. Antes del análisis, tu nombre, tu correo y tu RUT se reemplazan por un código. Los resultados se reportarán de forma agregada y ninguna publicación incluirá nombres ni datos que permitan identificarte. Si autorizas citas textuales, se publicarán sin tu nombre y editando cualquier detalle que pudiera identificarte. Las respuestas se guardan en una base de datos en línea (Firebase, de Google) administrada por el profesor, con acceso restringido al equipo de investigación, durante cinco años. Después se eliminarán.']
  },
  {
    n: 5, titulo: 'Riesgos y beneficios',
    parrafos: ['Participar no implica riesgos adicionales a los de cursar la asignatura. No hay beneficios directos ni compensación económica. Tu participación ayudará a mejorar la enseñanza de la optimización para futuras generaciones.']
  },
  {
    n: 6, titulo: 'Derecho a retirarte',
    parrafos: ['Puedes retirar tu consentimiento en cualquier momento, sin dar explicaciones, escribiendo al contacto indicado arriba. Si lo haces, tus datos no se incluirán en los análisis que se realicen desde ese momento.']
  }
];

export const TITULO_AUTORIZACIONES = 'Autorizaciones';
export const AYUDA_AUTORIZACIONES = 'Responde Sí o No a cada una. Puedes aceptar algunas y rechazar otras.';

export const AUTORIZACIONES = [
  { id: 'a1', corto: 'Encuestas', texto: 'Autorizo el uso de mis respuestas a las encuestas del curso con fines de investigación: la encuesta de competencias usada para formar los equipos (ya respondida) y las encuestas de inicio y cierre del caso.' },
  { id: 'a2', corto: 'Entregas y notas', texto: 'Autorizo el uso de mis entregas y calificaciones del caso, de forma anónima y agregada.' },
  { id: 'a3', corto: 'Verificador', texto: 'Autorizo el uso de los registros técnicos generados por el verificador de soluciones (fechas, número de intentos, resultados de la validación).' },
  { id: 'a4', corto: 'Citas textuales', texto: 'Autorizo que se citen textualmente mis comentarios escritos, sin mi nombre ni ningún dato que permita identificarme.' },
  { id: 'a5', corto: 'Reportes y coevaluaciones', texto: 'Autorizo el uso, anónimo y agregado, de los reportes de avance de mi equipo y de mis auto y coevaluaciones.' }
];
export const AUT_IDS = AUTORIZACIONES.map(a => a.id);

export const TITULO_DECLARACION = 'Declaración';
export const DECLARACION = 'Declaro que leí este documento y que tuve la oportunidad de hacer preguntas. Entiendo que mi participación es voluntaria y que puedo retirarme en cualquier momento sin consecuencias.';

export const PDF = 'assets/consentimiento-v4.pdf';

// ¿Están las cinco autorizaciones respondidas con Sí o No?
export const decisionCompleta = d => AUT_IDS.every(k => typeof d?.[k] === 'boolean');
export const soloAutorizaciones = d => Object.fromEntries(AUT_IDS.map(k => [k, Boolean(d?.[k])]));
