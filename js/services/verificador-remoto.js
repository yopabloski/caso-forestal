// Cliente de las funciones privadas del verificador. El navegador solo envía
// el archivo; el equipo, la instancia y el registro se determinan en servidor.
import { firebaseConfig, SDK, useEmulators } from './firebase-config.js';

let funciones;
async function api() {
  if (funciones) return funciones;
  const [app, fun] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-functions.js`)
  ]);
  const instancia = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
  funciones = fun.getFunctions(instancia, 'southamerica-west1');
  if (useEmulators) fun.connectFunctionsEmulator(funciones, 'localhost', 5001);
  return funciones;
}

async function llamar(nombre, datos = {}) {
  const fun = await api();
  const sdk = await import(`${SDK}/firebase-functions.js`);
  const respuesta = await sdk.httpsCallable(fun, nombre)(datos);
  return respuesta.data;
}

export const verificarSolucion = (contenido, instancia, correo, curso) => llamar('verificar_solucion', { contenido, instancia, correo, curso });
export const historialVerificaciones = (correo, curso) => llamar('historial_verificaciones', { correo, curso });
export const resumenVerificacionesDocente = curso => llamar('resumen_verificaciones_docente', { curso });
