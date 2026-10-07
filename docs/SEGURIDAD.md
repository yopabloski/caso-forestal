# Seguridad y datos personales

## Aislamiento multicurso

Cada curso es un perímetro Firestore: `fcsCursos/{cursoId}`. Un código se consulta de forma puntual en `fcsIndiceCodigos/{codigo}` y solo contiene el curso y la actividad. Las reglas no permiten listar ese índice, cursos, listas ni códigos. El mismo correo puede crear un participante independiente en dos cursos, con RUT, consentimiento, equipos y respuestas independientes. Las pruebas de reglas verifican explícitamente que una sesión con datos en un curso no lea ni escriba el otro.

El backend del verificador recibe siempre `curso`, valida que el participante y su equipo pertenezcan a ese árbol y guarda cuotas e intentos bajo ese curso. Las instancias, encargos y referencias siguen fuera de GitHub Pages en `functions/verificador/privado`; el documento privado `recurso-verificador` de cada curso identifica la asociación operativa sin exponer rutas al estudiante.

## Modelo de identidad

- **Estudiantes:** autenticación anónima de Firebase. Cada dispositivo recibe un `uid`. El registro `fcsParticipantes/{correo}` guarda en `uids` los dispositivos autorizados para ese correo.
- **Docente:** entra con Google y debe tener un documento en `fcsAdmins/{uid}`, que solo se crea desde la consola.

Como las cuentas @udd.cl no son de Google, el correo no se verifica con un proveedor. La protección contra suplantación se apoya en cuatro capas:

1. **Lista del curso.** Solo se puede registrar un correo que esté en `fcsLista`. El nombre y el equipo salen de ahí; el estudiante no los escribe.
2. **Clave del curso**, una por encuesta. Hay que conocerla para registrarse y para guardar respuestas. Se puede consultar una clave concreta, nunca listarlas.
3. **RUT como segundo factor.** Un dispositivo nuevo solo se suma a un correo ya registrado si escribe el mismo RUT. Quien no es miembro no puede leer el RUT registrado.
4. **Envío bloqueado.** Una encuesta enviada no se puede modificar. Solo el docente la reabre, y cada reapertura queda registrada.

La clase de lanzamiento funciona como inscripción: al responder la encuesta de inicio en la sala, cada correo queda amarrado al RUT de su dueño.

## Qué impide cada regla

| Regla | Evita |
|---|---|
| `fcsAdmins`: `write: false` | Que alguien se agregue como docente |
| `fcsConfig`: escritura solo docente | Que un estudiante abra o cierre una encuesta |
| `fcsPrivado`: lectura y escritura solo docente | Que alguien lea la clave de conocimiento, las claves vigentes o la sal de los seudónimos |
| `fcsCodigos`: `get` sí, `list` no | Que alguien enumere las claves vigentes |
| `fcsLista`: cada quien lee solo su ficha, después de registrarse | Que un estudiante descargue la lista del curso |
| Alta de participante: correo @udd.cl igual al ID y presente en la lista, RUT con formato, `uids == [yo]`, clave vigente y solo campos permitidos | Registros de fuera del curso, dueños falsos o campos inyectados |
| Actualización por miembro: solo `consentimiento`, `historialConsentimiento`, `codigo` y `ultimoIngreso` | Que un estudiante cambie su correo, su RUT o la lista de dispositivos |
| Consentimiento: cinco valores Sí o No y versión | Decisiones incompletas o con campos extra |
| Reclamo desde otro dispositivo: solo *añadir* su uid, con el RUT correcto y como máximo 10 dispositivos | Que alguien tome un correo ajeno o expulse al dueño |
| Respuestas: dueño, consentimiento decidido, encuesta abierta, clave de esa encuesta, equipo igual al de la lista, solo ítems conocidos | Escribir fuera de plazo, a nombre de otro, en otro equipo o con campos extra |
| Respuesta enviada: el estudiante ya no puede actualizarla | Modificar una encuesta después de enviarla |
| Lectura global de respuestas solo para el docente | Que un estudiante lea las respuestas de otros |

Las pruebas de `tests/reglas/` cubren cada fila (`npm run test:reglas`).

## Límites conocidos

- Quien conozca la clave, el correo de un compañero **que aún no se ha registrado** y un RUT con formato válido podría registrarse en su nombre. Cuando el dueño intente entrar con su RUT recibirá un error y avisará. Se resuelve con **Eliminar todos sus datos** en el panel. Por eso conviene que todos se registren en la clase de lanzamiento.
- Las reglas validan el formato del RUT, no el dígito verificador (lo valida la página).
- Las reglas comprueban que los ítems existan, no el rango de cada respuesta. La página solo guarda valores válidos y el análisis descarta el resto.
- Una encuesta digitada desde papel y luego reabierta no puede ser editada por el estudiante desde la web: corrígela digitándola de nuevo.

## Datos personales

- **Qué se guarda:** correo, RUT, decisión de consentimiento con su historial (fecha, hora y versión del texto) y respuestas. El nombre y el equipo están en la lista del curso.
- **Dónde:** Firestore (Firebase, de Google), en el proyecto del docente. El repositorio no contiene datos personales.
- **Plazo:** cinco años, según el consentimiento. Después hay que borrar el proyecto de Firebase o sus colecciones.
- **Retiro:** llega por correo al profesor. En **Curso → Registrar retiro del consentimiento** las cinco autorizaciones pasan a No y la persona queda fuera de los análisis para publicación. Sus respuestas se conservan como actividad del curso. **Eliminar todos sus datos** borra el registro, el consentimiento y las respuestas.
- **Seudonimización:** la exportación seudonimizada excluye correo, nombre y RUT. El código de cada persona se deriva de su correo y de una sal secreta guardada en `fcsPrivado/seudonimos`, así que es estable y no se puede reconstruir desde la lista del curso. La **llave de correspondencia** se descarga aparte y debe guardarse separada de los datos.
