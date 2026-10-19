# Arquitectura multicurso

Cada curso vive en `fcsCursos/{cursoId}`. Sus colecciones son `config/sitio`,
`codigos`, `lista`, `participantes`, `privado` y `verificaciones`.

El único punto global es `fcsIndiceCodigos/{codigo}` con `{ curso, aplicacion }`.
La página de alumno consulta ese índice antes de leer datos personales: el
estudiante no escoge un curso y solo puede entrar si su correo pertenece a la
lista del curso resuelto. Un mismo correo puede existir en varios cursos.

El verificador recibe `curso` en cada callable, toma el equipo desde
`fcsCursos/{curso}/lista/{correo}` y registra el intento dentro del mismo
curso. Las autoevaluaciones y coevaluaciones son módulos de `config/sitio` y
usan el mismo árbol de participantes.
