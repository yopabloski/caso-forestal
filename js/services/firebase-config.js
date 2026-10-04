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

export const enabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

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
  config: 'fcsConfig',              // fcsConfig/sitio: pública (qué aplicación está abierta)
  privado: 'fcsPrivado',            // fcsPrivado/{codigos|docente|seudonimos}: solo docentes
  codigos: 'fcsCodigos',            // fcsCodigos/{CLAVE} → { aplicacion } (get sí, list no)
  admins: 'fcsAdmins',              // fcsAdmins/{uid}: padrón docente (solo consola)
  lista: 'fcsLista',                // fcsLista/{correo}: lista del curso (nombre y equipo)
  participantes: 'fcsParticipantes',// fcsParticipantes/{correo}: RUT, dispositivos, consentimiento
  respuestas: 'respuestas'          // fcsParticipantes/{correo}/respuestas/{inicio|cierre}
};
