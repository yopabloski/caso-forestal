# Caso Forestal Cordillera Sur · encuestas en línea

Sitio multicurso del caso para Tópicos de Optimización. Cada curso tiene su propia lista, consentimientos, respuestas, códigos, material docente y registros del verificador bajo `fcsCursos/{cursoId}`. Una misma persona puede participar en varios cursos sin que sus datos se mezclen.

HTML, CSS y JS sin compilación, publicado como estático en GitHub Pages. Firebase se usa para Authentication y Firestore. El verificador agrega una Cloud Function privada en Python: el motor, las instancias y las referencias nunca se publican en GitHub Pages.

- `index.html`: los estudiantes responden desde el teléfono.
- `panel.html`: panel docente, desde el computador.
- `consentimiento.html`: copia imprimible del consentimiento (de ahí sale `assets/consentimiento-v4.pdf`).
- `verificador.html`: carga de soluciones, resultado, historial y comprobante para cada equipo.
- `verificador-panel.html`: seguimiento docente agregado y exportación CSV.

## Probar sin Firebase (modo demo)

```bash
npm run serve        # http://localhost:5174  (o doble clic en "Iniciar.command")
npm test             # pruebas de dominio y de estadística
```

Mientras `js/services/firebase-config.js` no tenga `apiKey`, todo se guarda en el `localStorage` del navegador:

1. Abre `panel.html` → **Aplicaciones** → carga `privado/metadatos-docente.json`.
2. El panel abre con dos cursos ficticios aislados. Selecciona uno o crea otro; todas las vistas operan solo sobre el curso activo.
3. Para probar como estudiante usa correo `demo1@udd.cl` a `demo4@udd.cl`, cualquier RUT válido y una clave del curso elegido: `DEMO-A-INICIO` o `DEMO-B-INICIO`.

**Para publicar, sigue `docs/PUESTA_EN_MARCHA.md`.**

## Cómo entra un estudiante

Las cuentas @udd.cl no son de Google, así que el ingreso no usa una cuenta verificada. Se pide **correo @udd.cl + RUT + clave del curso**:

- el correo debe estar en la **lista del curso** cargada por el docente; de ahí salen el nombre y el equipo;
- la **clave del curso** la entrega el profesor en clases (hay una por encuesta);
- el **RUT** queda amarrado al correo la primera vez; desde otro dispositivo solo entra quien lo repite.

Flujo: ingreso → consentimiento (cinco autorizaciones con Sí o No y declaración) → encuesta con guardado automático → envío con confirmación. Todos responden la encuesta, autoricen o no. Una encuesta enviada queda bloqueada; solo el docente puede reabrirla. En el cierre se muestra la decisión registrada y se puede cambiar.

## Lo que no está en el repositorio

El código es público, así que aquí **no hay** nombres, correos, respuestas ni la pauta:

- la **lista del curso** se sube desde el panel y vive en Firestore;
- la **clave de las preguntas de conocimiento**, la **parte del caso** y el **resultado de aprendizaje** de cada ítem están en `privado/metadatos-docente.json`, que `.gitignore` excluye; se carga desde el panel y queda en un documento que solo lee el docente.

## Datos multicurso

El único índice global es `fcsIndiceCodigos/{codigo}` con `{curso, aplicacion}`. El estudiante ingresa correo, RUT y código: el código resuelve el curso y actividad automáticamente; no existe selector de curso para estudiantes. Los datos por curso viven en `fcsCursos/{cursoId}/config/sitio`, `codigos`, `lista`, `participantes/{correo}/respuestas`, `privado` y `verificaciones`. Los recursos privados del verificador se mantienen fuera del sitio público, en el directorio privado de Functions, y su asociación se registra en `fcsCursos/{cursoId}/privado/recurso-verificador`.

## Dónde vive cada cosa

| Archivo | Rol |
|---|---|
| `js/domain/encuesta.js` | **Fuente única** de secciones, ítems y escalas (lo que ve el estudiante) |
| `js/domain/consentimiento.js` | Texto del consentimiento, autorizaciones y versión |
| `js/domain/identidad.js` | Validación de correo, RUT y clave |
| `js/domain/lista.js` | Lectura del CSV de la lista del curso |
| `js/domain/estadistica.js` | Wilcoxon pareado, McNemar exacto y Holm, validados contra SciPy |
| `js/domain/analisis.js` | Avance, autoeficacia, conocimiento, valoración y abiertas |
| `js/domain/exportar.js` | Bases completa y seudonimizada, llave, libro de códigos |
| `js/services/store.js` | Fachada: Firebase o demo local |
| `js/services/remote-store.js` | Adaptador Firestore |
| `js/services/local-store.js` | Modo demo (localStorage) y datos de ejemplo |
| `js/ui/graficos.js` | Gráficos del panel |
| `firestore.rules` | Reglas de seguridad (ver `docs/SEGURIDAD.md`) |

## Documentación

| Documento | Para qué |
|---|---|
| `docs/PUESTA_EN_MARCHA.md` | Crear el proyecto Firebase, publicar y preparar cada aplicación |
| `docs/SEGURIDAD.md` | Modelo de identidad, qué protege cada regla y sus límites |
| `docs/ANALISIS.md` | Qué calcula cada vista y cómo se exportan los datos |
