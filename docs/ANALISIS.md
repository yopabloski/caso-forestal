# Análisis y descargas

Solo cuentan las encuestas **enviadas**. El emparejamiento entre inicio y cierre se hace por el correo de cada persona.

## Filtro por autorización

- **Todos (uso docente):** todas las encuestas enviadas. Sirve para el curso.
- **Solo con autorización 1 (publicación):** únicamente quienes autorizaron el uso de sus encuestas con fines de investigación. Es lo que debe usarse para el artículo. Un retiro del consentimiento saca a la persona de este grupo.

## Autoeficacia (10 ítems, escala 1 a 5)

- Por ítem: n, media, desviación estándar muestral y distribución, al inicio y al cierre.
- Comparación pareada con la **prueba de rangos con signo de Wilcoxon**. Las diferencias cero se descartan; «con cambio» es el número de pares que entra a la prueba.
  - **p**: aproximación normal con corrección por empates y por continuidad. Coincide con `scipy.stats.wilcoxon(zero_method='wilcox', correction=True, method='approx')` y con `wilcox.test(paired = TRUE)` de R cuando hay empates.
  - **p exacto**: distribución exacta de permutación de los signos, válida con empates.
  - **p Holm**: ajuste por comparaciones múltiples dentro de cada tabla.
  - **r**: correlación biserial de rangos para pares, (W⁺ − W⁻)/(W⁺ + W⁻).
- **Por parte del caso**: promedio por persona de los ítems de cada parte (el ítem 7 cuenta en B y en C) y la misma comparación. Requiere el archivo docente.

## Conocimiento (4 preguntas)

- Proporción de cada alternativa al inicio y al cierre.
- Con el archivo docente: respuestas correctas por pregunta y **prueba de McNemar exacta** (binomial, dos colas) sobre las respuestas pareadas, con ajuste de Holm. El total de correctas (0 a 4) se compara con Wilcoxon.

## Valoración y preguntas abiertas (solo cierre)

- Valoración: distribución, media, desviación estándar y porcentaje de acuerdo (4 o 5) por afirmación.
- Abiertas: listado con código seudónimo, equipo y si la persona autorizó citas textuales (autorización 4). «Descargar para codificar» entrega una planilla con una columna `TEMA` vacía.

## Descargas

| Archivo | Contenido |
|---|---|
| Seudonimizado (Excel o CSV) | Una fila por persona, sin correo, nombre ni RUT. Por defecto, solo quienes dieron la autorización 1 |
| Completo (Excel o CSV) | Lo mismo con correo, nombre y RUT. Solo para uso del curso |
| Llave de correspondencia | Código ↔ correo, nombre y equipo. Guardar separada |
| Libro de códigos | Variables, textos, valores, parte del caso y clave |
| Respaldo (JSON) | Todo lo guardado, incluido el historial de consentimiento |

Las columnas llevan el prefijo `INI_` o `CIE_`. Con el archivo docente se agregan `*_K1_OK` a `*_K4_OK` y `*_K_TOTAL`. Las encuestas en borrador aparecen con su estado, pero sin respuestas.

## Validación

`npm test` compara la estadística con valores de referencia de SciPy 1.18 (`tests/fixtures/estadistica_ref_scipy.json`): 21 casos de Wilcoxon con empates, el p exacto contra la enumeración completa de signos, McNemar contra `binomtest` y Holm.
