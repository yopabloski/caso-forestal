// Caso Forestal · configuración Firebase del cliente.
//
// Pegue aquí la configuración web del proyecto Firebase del caso
// (Consola Firebase → Configuración del proyecto → Tus apps → SDK config).
// Mientras apiKey esté vacío la app funciona en MODO DEMO: todo se guarda en
// el localStorage de este navegador y el panel docente se abre sin login.
//
// Estos valores no son secretos: viajan al navegador por diseño. La protección
// real está en firestore.rules y en los dominios autorizados de Authentication.

export const firebaseConfig = {
  apiKey: 'AIzaSyAAhveQi7ff9PvDk3nH-P9nxutXAPfiYAQ',
  authDomain: 'caso-forestal-udd.firebaseapp.com',
  projectId: 'caso-forestal-udd',
  appId: '1:184868117274:web:5dd697ab887e8aa89eaaa3'
};

if (typeof window !== 'undefined' && window.__FCS_FIREBASE__) {
  Object.assign(firebaseConfig, window.__FCS_FIREBASE__);
}

export const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

// ?demo=1 fuerza el modo local incluso si este archivo ya contiene la
// configuración real; permite revisar cursos ficticios sin tocar Firebase.
const forceDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
export const enabled = !forceDemo && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// ?emu=1 activa los emuladores locales (auth 9099, firestore 8080).
export const useEmulators = (() => {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search).get('emu');
  try {
    if (p === '1') localStorage.setItem('fcs:emu', '1');
    if (p === '0') localStorage.removeItem('fcs:emu');
    return localStorage.getItem('fcs:emu') === '1';
  } catch { return p === '1'; }
})();

export const emulatorPorts = { auth: 9099, firestore: 8080 };

// Un solo proyecto para todo el sitio del caso. La encuesta usa el prefijo
// "fcs"; la coevaluación y el verificador agregarán sus propias colecciones.
export const paths = {
  cursos: 'fcsCursos',
  indiceCodigos: 'fcsIndiceCodigos',
  admins: 'fcsAdmins',
  respuestas: 'respuestas'
};
