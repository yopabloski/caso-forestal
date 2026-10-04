// Caso Forestal · modelo de datos compartido por el modo demo y Firebase.

export const APLICACIONES = {
  inicio: { id: 'inicio', nombre: 'Encuesta de inicio', corto: 'Inicio', orden: 1, minutos: 10 },
  cierre: { id: 'cierre', nombre: 'Encuesta de cierre', corto: 'Cierre', orden: 2, minutos: 15 }
};
export const APLICACION_IDS = ['inicio', 'cierre'];
export const ESTADOS_APLICACION = ['cerrada', 'abierta'];

export const configInicial = () => ({
  titulo: 'Caso Forestal Cordillera Sur',
  curso: 'Tópicos de Optimización · 2026-2',
  aplicaciones: {
    inicio: { id: 'inicio', estado: 'cerrada' },
    cierre: { id: 'cierre', estado: 'cerrada' }
  }
});

// "Equipo 07", "7", "07" → "07". Devuelve '' si no reconoce un equipo.
export function normalizarEquipo(valor) {
  const m = String(valor ?? '').match(/(\d{1,2})\s*$/);
  if (!m) return '';
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? String(n).padStart(2, '0') : '';
}

// Estado de una respuesta: 'pendiente' | 'en-curso' | 'enviado'
export function estadoRespuesta(doc) {
  if (!doc) return 'pendiente';
  if (doc.estado === 'enviado') return 'enviado';
  return Object.keys(doc.respuestas || {}).length ? 'en-curso' : 'pendiente';
}

export const codigoSugerido = aplicacion =>
  `FCS-${aplicacion === 'cierre' ? 'CIE' : 'INI'}-${Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01OI]/g, 'X')}`;

export const tieneConsentimiento = p => Boolean(p?.consentimiento);
