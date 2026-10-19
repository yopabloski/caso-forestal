# Prompt para reiniciar la implementación multicurso

```text
Trabaja en /Users/pablogonzalez/Desktop/UDD/Desarrollos/caso-forestal.

Objetivo: convertir la aplicación actual de encuestas y verificador en una
plataforma multicurso real. No hagas cambios parciales: implementa la
arquitectura completa, pruébala y solo entonces entrega el resultado.

Estado importante:
- Firebase actual es solo de prueba: puedes reemplazar por completo el modelo
  de datos y las reglas. No se requiere migración ni compatibilidad.
- No hay despliegue que preservar.
- Existen cambios locales parciales e incompletos. Revísalos con `git diff`.
  Puedes reutilizarlos si sirven, pero reemplázalos o elimínalos si estorban.
- Antes de modificar, lee README.md, docs/SEGURIDAD.md,
  docs/PUESTA_EN_MARCHA.md, firestore.rules, js/services/remote-store.js,
  js/services/local-store.js, js/panel.js, js/alumno.js,
  js/verificador.js, js/services/verificador-remoto.js y functions/main.py.

Diseño obligatorio:
1. Datos aislados por curso en Firestore:
   fcsCursos/{cursoId}/config/sitio
   fcsCursos/{cursoId}/codigos/{codigo}
   fcsCursos/{cursoId}/lista/{correo}
   fcsCursos/{cursoId}/participantes/{correo}/respuestas/{aplicacion}
   fcsCursos/{cursoId}/privado/{doc}
   fcsCursos/{cursoId}/verificaciones/{id}
   Se permite un índice global mínimo, fcsIndiceCodigos/{codigo}, que solo
   contiene {curso, aplicacion} y permite resolver la clave sin elegir curso.
2. El estudiante ingresa correo + RUT + código. El código resuelve de forma
   automática curso + actividad; nunca se le muestra un selector de cursos.
   El correo debe existir en la lista de ESE curso. La misma persona puede
   estar registrada en varios cursos con consentimientos y equipos separados.
3. Panel docente: crear, nombrar, seleccionar y ver cursos. Al seleccionar un
   curso, lista, aplicaciones, códigos, análisis, descargas y digitación en
   papel operan exclusivamente sobre él. Permitir habilitar módulos: inicio,
   cierre, verificador, autoevaluación y coevaluación (estos dos últimos pueden
   quedar como módulos preparados si sus pantallas aún no existen).
4. Códigos: únicos en toda la plataforma; al guardar/cambiar un código deben
   actualizarse atómicamente el documento del curso y el índice global.
5. Verificador: cliente y Cloud Functions reciben curso. El servidor obtiene
   el equipo desde la lista del curso y guarda/consulta intentos solo dentro de
   ese curso. Mantén los datos privados de instancias fuera del sitio público;
   documenta cómo se asocian recursos privados a cada curso.
6. Reescribe firestore.rules para estas rutas. Estudiantes solo pueden leer y
   modificar sus propios documentos dentro del curso resuelto; no enumeran
   listas, cursos ni códigos. El docente administra cursos. Incluye pruebas de
   reglas para aislamiento: misma cuenta/correo en dos cursos no puede leer ni
   escribir datos cruzados.
7. Actualiza modo demo para tener al menos dos cursos ficticios y comprobar
   que los datos no se cruzan.
8. Actualiza README.md, docs/SEGURIDAD.md y docs/PUESTA_EN_MARCHA.md con el
   nuevo flujo y el procedimiento de configuración desde cero.

Validación mínima obligatoria antes de terminar:
- npm test
- npm run test:reglas
- pruebas nuevas que cubran código → curso → aplicación, dos cursos con el
  mismo correo, aislamiento de lista/respuestas/consentimiento, y verificador
  separado por curso.
- revisión manual del panel en modo demo: crear/seleccionar curso, cargar dos
  listas, abrir códigos distintos y comprobar que cada estudiante entra solo
  al curso asociado al código.

Reglas de trabajo:
- Usa apply_patch para editar archivos.
- No inventes resultados de pruebas ni declares terminado sin ejecutar y
  reportar las validaciones.
- No preguntes decisiones menores: usa IDs derivados de nombre + período y
  aplica el diseño anterior.
```
