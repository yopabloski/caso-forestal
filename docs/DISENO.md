# Diseño · sistema «Cordillera»

Un solo sistema visual para las encuestas, el verificador y los paneles. Todo sale de las variables de `css/base.css`; para cambiar la paleta basta con editar el bloque `:root`.

## Idea

Tinta pizarra para la estructura, un degradado **agua → brote** para lo que importa ahora (acción principal, selección, avance) y **curvas de nivel** como motivo: sirven para el mapa de un predio y para una función objetivo.

## Paleta

| Rol | Color | Uso |
|---|---|---|
| Tinta 800 | `#102B34` | Barra superior, barra lateral, portadas |
| Tinta 900 | `#0B1F26` | Texto |
| Tinta 600 / 500 | `#3E5761` / `#5C727A` | Texto secundario y de apoyo |
| Agua | `#17C3B2` | Inicio del degradado, foco de los campos |
| Brote | `#2EDC8E` | Fin del degradado |
| Agua 700 | `#0A7C78` | Enlaces y rótulos sobre blanco |
| Menta | `#62DCC0` | Acento sobre tinta |
| Resina | `#FFB547` | Foco del teclado, modo demo, «en curso» |
| Fondo / Hoja | `#F1F5F5` / `#FFFFFF` | Página y tarjetas |
| Correcto | `#146C49` sobre `#E1F6EC` | Estados positivos |
| Aviso | `#8A5A00` sobre `#FFF3D6` | Advertencias |
| Error | `#B42B24` sobre `#FDEBE8` | Errores y acciones destructivas |

Contraste comprobado (WCAG): tinta sobre el degradado 7,1:1 a 8,8:1; blanco sobre tinta 800 14,8:1; agua 700 sobre blanco 5,0:1; texto de apoyo sobre blanco 5,1:1.

**Gráficos.** Inicio `#D9722B` y cierre `#0B8F88`, validadas como par categórico (visión normal y daltonismo, contraste ≥ 3:1 sobre blanco). Escala de 1 a 5: divergente `#B5491C · #EBAF86 · #D5DCDF · #7FCFC6 · #0B6F6A`, con punto medio gris. Si se cambian hay que volver a validarlas.

## Tipografía

Alojada en `assets/fuentes/` (sin servicios externos; licencia OFL):

- **Bricolage Grotesque**: títulos e indicadores.
- **Onest**: texto e interfaz.
- **JetBrains Mono**: claves, códigos y cifras tabulares.

## Componentes

- **Botón principal** (`.btn`): degradado con texto en tinta, brillo al pasar el cursor y leve hundimiento al presionar. Uno por pantalla.
- **Secundario** (`.btn.sec`): blanco con borde; **destructivo** (`.btn.peligro`): rojo suave que se llena al pasar el cursor.
- **Selección** (escala 1 a 5, alternativas, Sí/No, instancia): lo elegido toma el degradado; nunca depende solo del color, siempre hay una marca o un cambio de forma.
- **Tarjetas** (`.tarjeta`): radio de 20 px y sombra suave. **Indicadores** (`.tile`): cifra grande; `.destacada` para el dato principal de la vista; `.con-anillo` para porcentajes de avance.
- **Estados** (`.pill`): punto más texto. **Notas** (`.nota-caja`): ícono más texto.
- **Portada oscura** (`.portada-oscura`): pantallas de ingreso y clave en pantalla.

## Dónde se usa cada página

| Página | Dispositivo | Decisiones |
|---|---|---|
| Encuestas (`index.html`) | Teléfono | Una columna, botones de 48 px o más, barra de avance fija arriba y envío fijo abajo |
| Verificador (`verificador.html`) | Computador | Dos columnas: subir y resultado a la izquierda, registro del equipo a la derecha; se apila en pantallas angostas |
| Paneles (`panel.html`, `verificador-panel.html`) | Computador | Barra lateral común con navegación entre ambos paneles |
