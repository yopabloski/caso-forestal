// Caso Forestal · fachada. Elige Firebase o demo local al cargar; ninguna
// vista sabe cuál está activo.
import { enabled } from './firebase-config.js';

const impl = enabled ? await import('./remote-store.js') : await import('./local-store.js');

export const store = impl;
export const modo = impl.modo;
