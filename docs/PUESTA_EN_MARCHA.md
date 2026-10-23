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

## 5. Crear y configurar cursos

En el panel crea un curso con nombre y período (el identificador se deriva de ambos), selecciónalo y luego:

1. En **Curso**, habilita los módulos necesarios y sube el CSV con los equipos. Repite este paso por cada curso: nunca reutilices una lista global.
2. En **Aplicaciones**, sube `privado/metadatos-docente.json`, define claves únicas globalmente y abre las actividades de ese curso. La clave resuelve curso y actividad para el estudiante.
3. Para asociar una instancia privada del verificador, deja sus archivos bajo `functions/verificador/privado/` y registra la referencia administrativa en `fcsCursos/{cursoId}/privado/recurso-verificador`; nunca publiques esas instancias en Pages.

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

Desde el 23-oct-2026 cada intento guarda dos documentos. En `fcsCursos/{curso}/verificaciones/{id}` quedan fecha, integrante, equipo, instancia, resultado, errores, costos reportado y recalculado, cota, gap, brecha contra la referencia, indicadores, huella y la vista que recibió el equipo. En `fcsCursos/{curso}/verificacionesArchivos/{id}` queda el archivo de solución completo, que ningún cliente puede leer por reglas. El panel docente lo descarga mediante la función `archivo_verificacion_docente`.

El equipo ve el costo recalculado y su desglose, el costo que reportó, el plan por periodo, las entregas por salida, la ruta y los compromisos y el indicador de su gerencia. No ve la cota, el gap (los deben calcular y presentar ellos), la referencia docente ni la brecha. En el predio, una línea CASO no reconocida deja la solución como no factible, para no validar sin saber qué exigir.

### Pruebas sin Firebase (en cualquier terminal)

```bash
cd functions
python3 tests/test_main_simulado.py   # funciones con Firestore simulado: 28 comprobaciones
python3 tests/vista_previa.py         # regenera docs/vista-previa-verificador.json
```

### Prueba local con emuladores antes del despliegue

1. En `functions/`, activa el entorno de Python 3.11 (`source venv/bin/activate`) e instala `pip install -r requirements.txt`.
2. Terminal 1, en la carpeta del sitio: `npx firebase emulators:start --only auth,firestore,functions`.
3. Terminal 2, en `functions/` con el venv activo: `python tests/sembrar_emulador.py`. Crea el curso «prueba-verificador», tres estudiantes de prueba (dos del equipo 07 y uno del 03) y la clave `PRUEBAVER`.
4. Terminal 3, en la carpeta del sitio: `npm run serve`. Abre `http://localhost:5174/verificador.html?emu=1`.
5. Entra con `prueba07a@udd.cl`, un RUT válido y la clave `PRUEBAVER`. Sube los archivos de `functions/tests/ejemplos/`: los dos de la mini instancia y los dos de la Parte C del equipo 07 (uno factible y uno sin la ruta de emergencia). Revisa el resultado, el historial y el comprobante.
6. Entra con `prueba07b@udd.cl` en otra ventana privada: debe ver el mismo historial del equipo. Con `prueba03@udd.cl` no debe verlo.
7. Abre `http://localhost:5174/verificador-panel.html?emu=1`, entra con la cuenta de prueba que ofrece el emulador y luego corre `python tests/sembrar_emulador.py --admin`. Recarga el panel: deben aparecer los intentos, la brecha, la descarga del archivo y el Excel.
8. Al terminar, abre de nuevo `http://localhost:5174/verificador.html?emu=0` para que el navegador deje de usar los emuladores.

Para el cierre se usa otra clave. Quien respondió el inicio entra con el mismo correo y RUT, ve su decisión de consentimiento y puede cambiarla.

## Emuladores (opcional)

```bash
npx firebase emulators:start --only auth,firestore
# abre http://localhost:5174/index.html?emu=1
```

## Auto y coevaluación (una por entrega)

Se administra en `coevaluacion-panel.html` (enlace «Coevaluación» en el menú del panel). Hay tres aplicaciones: Entrega 1, 2 y 3.

1. **Publica las reglas nuevas** (`npx firebase deploy --only firestore:rules`) y corre `npm run test:reglas`: ahora son 19 pruebas, 6 de ellas de la coevaluación (hora de cierre, plazo individual, bloqueo tras enviar).
2. Al abrir el panel, las fichas de la lista se actualizan solas con los compañeros de cada estudiante (es lo único que el estudiante ve del resto del curso).
3. En la entrega: **Sugerir → Guardar** la clave, revisa la **hora de cierre** (por defecto el día de la entrega a las 23:45, hora de Chile) y pulsa **Abrir**. Comparte el enlace directo o muéstralo en pantalla.
4. Pasada la hora de cierre nadie puede guardar ni enviar. Para un caso justificado, en la fila del estudiante elige **Dar plazo individual**; si ya la había enviado y necesita corregir, además **Reabrir**.
5. Factor (0 a 1) y nota del equipo se escriben en la tabla de cada equipo y se guardan solos en `fcsCursos/{curso}/privado/coevaluacion`, que solo lee el docente. La nota individual es nota del equipo × factor, −0,5 si no envió la coevaluación, mínimo 1,0.
6. **Descargar Excel** trae dos hojas: notas (columnas para la planilla) y respuestas (una fila por evaluador y evaluado). El **Consolidado** junta las tres entregas.
