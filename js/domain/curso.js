// Contexto de curso. Un código de acceso resuelve este identificador antes de
// que se lea una lista, consentimiento o respuesta.
export const MODULOS = ['inicio', 'cierre', 'verificador', 'autoevaluacion', 'coevaluacion'];

export function normalizarCursoId(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

export function validarCursoId(valor) {
  const id = normalizarCursoId(valor);
  return id.length >= 3 ? id : '';
}

export function cursoNuevo({ nombre, periodo }) {
  const id = validarCursoId(`${nombre}-${periodo}`);
  if (!id) throw new Error('El nombre y período deben formar un identificador de al menos 3 caracteres.');
  return { id, nombre: String(nombre).trim(), periodo: String(periodo).trim(), modulos: Object.fromEntries(MODULOS.map(m => [m, m === 'inicio' || m === 'cierre' || m === 'verificador'])), creado: new Date().toISOString() };
}
