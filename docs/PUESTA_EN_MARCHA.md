# Puesta en marcha

Calcula unos 40 minutos. Los pasos 1 a 5 se hacen una sola vez.

> **Decisión de identidad vigente.** Para esta primera aplicación se mantiene
> el acceso implementado: correo @udd.cl + RUT + clave del curso. En paralelo
> se puede probar el acceso institucional con Microsoft/Entra ID, pero esa
> prueba no debe retrasar ni reemplazar este montaje. Si Microsoft exige
> aprobación del administrador de la UDD, se continúa con el flujo actual.

## 1. Proyecto Firebase del caso

1. En <https://console.firebase.google.com> crea un proyecto nuevo, por ejemplo `caso-forestal-udd`. No necesitas Google Analytics.
2. **Build → Firestore Database → Create database**, en modo *production* y con ubicación `southamerica-west1` (Santiago). Esta ubicación queda fijada para la base de datos; Santiago reduce la latencia para este curso.
3. **Build → Authentication → Get started** y activa dos proveedores:
   - **Anonymous**: lo usan los estudiantes. Da a cada dispositivo una identidad técnica; la identidad real es el correo de la lista del curso, protegido por el RUT y la clave.
   - **Google**: lo usa el docente para entrar al panel.
   - **Microsoft (opcional, prueba en paralelo):** por ahora **no lo habilites**. Firebase pedirá un ID y un secreto de una aplicación registrada previamente en Microsoft Entra ID. Solo vuelve a este proveedor cuando contemos con esos dos valores y la URL de redirección de Firebase haya sido agregada a esa aplicación. Si Microsoft solicita aprobación del administrador, detén la prueba y continúa con Anonymous + Google: son suficientes para aplicar las encuestas.
4. **Authentication → Settings → Authorized domains**: agrega `TU-USUARIO.github.io`.
5. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra la app y copia `apiKey`, `authDomain`, `projectId` y `appId` en `js/services/firebase-config.js`.

> Estos valores no son secretos: la seguridad la dan las reglas del paso 2.

## 2. Reglas de seguridad

En **Firestore → Rules**, pega el contenido de `firestore.rules` y publica. Con la CLI:

```bash
npm install
npx firebase login
npx firebase use --add            # elige el proyecto
npx firebase deploy --only firestore:rules
```

**Antes de usarlo con el curso, corre las pruebas de las reglas** (necesitan Java, igual que en Nonio):

```bash
npm run test:reglas
```

Deben pasar las 13. Estas pruebas no se pudieron ejecutar al construir el sitio, porque el emulador de Firestore no se podía descargar en ese entorno.

## 3. GitHub Pages

```bash
git init && git add . && git commit -m "Caso Forestal · encuestas v1"
gh repo create caso-forestal --public --source . --push   # o créalo desde github.com
```

En el repositorio: **Settings → Pages → Deploy from a branch → `main` / root**. La URL queda como `https://TU-USUARIO.github.io/caso-forestal/`.

Antes del primer `git add`, comprueba con `git status` que **no** aparezcan `privado/` ni archivos `.csv` o `.xlsx`: `.gitignore` los excluye.

## 4. Padrón docente

1. Abre `panel.html` publicado y entra con tu cuenta de Google. Como aún no estás en el padrón, verás un mensaje con tu **UID**.
2. En **Firestore → Data**, crea la colección `fcsAdmins` y agrega un documento cuyo **ID sea ese UID**. Basta un campo, por ejemplo `email: "tu@gmail.com"`.
3. Vuelve a entrar.

El padrón solo se modifica desde la consola: nadie puede agregarse como docente desde el navegador.

## 5. Datos del curso

En el panel:

1. **Curso → Elegir CSV**: sube el archivo con los equipos (por ejemplo «Caso - Cosecha Forestal - con equipos.csv»). Revisa la vista previa (53 estudiantes, 14 equipos) y guarda.
2. **Aplicaciones → Cargar archivo docente**: sube `privado/metadatos-docente.json`.

## 6. Prueba completa (hazla el martes)

1. Sube primero una lista de prueba con dos o tres correos @udd.cl que controles (el tuyo y el del ayudante), cada uno con un equipo.
2. **Aplicaciones**: guarda una clave para la encuesta de inicio y ábrela.
3. Desde el teléfono, en otro navegador o en una ventana privada, entra con el enlace directo y responde todo el flujo. Entra de nuevo desde un segundo dispositivo con el mismo correo: con otro RUT debe rechazarte y con el correcto debe dejarte ver tu encuesta enviada.
4. Revisa **Avance**, **Análisis** y **Descargas**.
5. En **Curso**, elimina los datos de las cuentas de prueba y sube la lista real, que reemplaza a la de prueba.

> No abras el panel y la página del estudiante en el **mismo perfil** del navegador: el ingreso con Google reemplaza la sesión anónima del estudiante.

## 7. El día de cada aplicación

1. **Aplicaciones**: guarda la clave del día y cambia la encuesta a **Abierta**.
2. **Mostrar en pantalla** proyecta el código QR, la dirección y la clave. El QR ya trae la clave.
3. Sigue el avance en **Avance**; ahí está la lista de quienes faltan.
4. Si alguien no puede entrar, que responda en papel. Después, **Curso → Digitar encuesta en papel**.
5. Al terminar, cambia la encuesta a **Cerrada** y descarga el **Respaldo completo** en **Descargas**.

## 8. Verificador de soluciones

El verificador usa Cloud Functions en Python, por lo que el proyecto debe estar en el plan Blaze. No se publica su código ni los datos de los equipos: `functions/` está excluida de Git y se despliega desde esta copia local privada.

1. En Firestore crea `fcsCodigos/FCS-VER` con `{ "aplicacion": "verificador" }`. Esta clave técnica permite reutilizar la identidad ya implementada; no habilita ninguna encuesta.
2. Confirma que cada integrante del curso ya esté en `fcsLista` con su equipo. El servidor toma el equipo desde ahí, nunca desde el archivo ni desde el navegador.
3. Desde esta carpeta ejecuta `firebase deploy --only functions`. Antes, crea el entorno Python de `functions/` e instala `pip install -r requirements.txt`.
4. Abre `verificador.html` con una cuenta de prueba de cada equipo. Sube una solución de prueba, revisa el historial y descarga un comprobante.
5. Entra a `verificador-panel.html` con la misma cuenta docente que está en `fcsAdmins`. Comprueba que muestra el intento y que la descarga CSV funciona.

El backend guarda fecha, equipo, instancia, resultado, errores, costo, indicadores y huella SHA-256 abreviada. No guarda el archivo completo de solución. La brecha del panel se calcula contra la referencia privada que corresponda a la Parte B, C o D.

### Prueba local antes del despliegue

1. En `functions/`, crea y activa un entorno virtual de Python 3.11 e instala `pip install -r requirements.txt`. La versión instalada de Firebase CLI usa el runtime `python311`; Python 3.14 no sirve para este entorno.
2. En una terminal inicia `firebase emulators:start --only auth,firestore,functions`.
3. En otra terminal inicia `npm run serve` y abre `http://localhost:5174/verificador.html?emu=1`.
4. En otra terminal, carga un padrón de prueba y crea `fcsCodigos/FCS-VER` con este bloque (no requiere iniciar sesión en Google):

   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 python - <<'PY'
   from google.auth.credentials import AnonymousCredentials
   from google.cloud import firestore

   db = firestore.Client(project="caso-forestal-udd", credentials=AnonymousCredentials())
   correo = "prueba07@udd.cl"
   db.collection("fcsLista").document(correo).set({"correo": correo, "nombre": "Estudiante de prueba", "equipo": "07"})
   db.collection("fcsCodigos").document("FCS-VER").set({"aplicacion": "verificador"})
   print("Padrón de prueba cargado.")
   PY
   ```
5. Sube una solución de prueba válida y otra con una línea incorrecta. Confirma el resultado, el historial del equipo, el comprobante y el panel docente.

Para el cierre se usa otra clave. Quien respondió el inicio entra con el mismo correo y RUT, ve su decisión de consentimiento y puede cambiarla.

## Emuladores (opcional)

```bash
npx firebase emulators:start --only auth,firestore
# abre http://localhost:5174/index.html?emu=1
```
