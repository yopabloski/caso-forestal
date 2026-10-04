// Caso Forestal · validación de correo, RUT y clave del curso (tomado de Nonio).

export const DOMINIO = 'udd.cl';

export function normalizarCorreo(valor) {
  return String(valor || '').trim().toLowerCase();
}

export function correoValido(valor) {
  const c = normalizarCorreo(valor);
  return /^[a-z0-9._%+-]+@udd\.cl$/.test(c);
}

// "20.998.765-4", "209987654", "20998765-k" → { cuerpo: '20998765', dv: '4' }
export function partesRut(valor) {
  const limpio = String(valor || '').toUpperCase().replace(/[^0-9K]/g, '');
  if (limpio.length < 2) return null;
  return { cuerpo: limpio.slice(0, -1).replace(/^0+/, ''), dv: limpio.slice(-1) };
}

export function dvRut(cuerpo) {
  let suma = 0, mul = 2;
  for (let i = String(cuerpo).length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}

export function rutValido(valor) {
  const p = partesRut(valor);
  if (!p || !/^\d{7,8}$/.test(p.cuerpo)) return false;
  return dvRut(p.cuerpo) === p.dv;
}

// Forma canónica que se guarda: 20998765-4
export function normalizarRut(valor) {
  const p = partesRut(valor);
  return p ? `${p.cuerpo}-${p.dv}` : '';
}

// Formato amigable mientras se escribe: 20.998.765-4
export function formatearRut(valor) {
  const p = partesRut(valor);
  if (!p) return String(valor || '').toUpperCase();
  const cuerpo = p.cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${p.dv}`;
}

export function normalizarCodigo(valor) {
  return String(valor || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function nombreValido(valor) {
  return String(valor || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

export function normalizarNombre(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}
