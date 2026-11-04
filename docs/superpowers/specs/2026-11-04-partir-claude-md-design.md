# Partir CLAUDE.md

Spec del 04/11/2026, sobre main 262c7e9. No cambia código de la aplicación y no va nada a producción.

## 1. Qué problema resuelve

`CLAUDE.md` pesa 654 KB (más de 99.000 palabras) y tiene líneas de hasta 75.000 caracteres.
Cada sesión y cada subagente común lo cargan entero en cada pedido: un subagente que solo leyó tres líneas de un archivo gastó 334.000 tokens.
Eso agotó el límite de uso de la cuenta el 03/11, con cinco agentes en paralelo.
Además, `Read` no puede paginar dentro de una línea tan larga y un merge que la toca obliga a resolver kilobytes enteros.

Terminado es:
- una sesión nueva carga mucho menos al arrancar y encuentra lo que necesita cuando toca un tema;
- toda frase del documento original está en algún lado o tiene un motivo escrito para haberse ido;
- la suite sigue en verde.

## 2. Qué decidió el usuario

| Tema | Decisión |
|---|---|
| Carga | Punteros y documentos: `CLAUDE.md` corto, reglas por ruta chicas en `.claude/rules/` y contratos en `docs/temas/`. |
| Qué queda siempre | Índice medio, unos 25 KB: comandos, entorno, convenciones, doble verificación, roles, seguridad, despliegue en tres renglones, el mapa y las reglas transversales fundidas. |
| Recorte | Sale la historia pura, la descripción de cada test (queda el nombre) y los kits ya desplegados, unos 108 KB. Quedan las decisiones con su motivo y el mapa del código. |
| Despliegue | Procedimiento, orden de migraciones, una sola tabla de vueltas atrás, la regla de la foto y pendientes con fecha. |
| «El sistema no frena licencias» | En el índice, con su alcance exacto (sección 7). |
| El lector en el Seguimiento | Está bien que vea el para y el cc de las notas y los destinatarios de los emails: se documenta. |
| Test de topes | Sí (sección 10). |
| Revisar lo que se fue | Página privada con filtros, más un agente revisor distinto. |

## 3. Lo que se comprobó

Sobre esta misma Mac, con una regla de ensayo en un worktree bajo `.claude/worktrees/`:
- una regla con `paths:` se activa sola al leer un archivo que coincide, en la sesión principal, en un subagente Explore y en un subagente común, también si se creó a mitad de sesión;
- Explore y Plan arrancan sin `CLAUDE.md`, pero reciben las reglas con `paths:`.

Según la documentación oficial de Claude Code (`memory`, `sub-agents`, `permission-modes`):
- los `@import` se expanden al arrancar y no ahorran nada;
- una regla con `paths:` también se activa con `cat`, `head`, `tail`, `grep` o `sed -n` sobre un solo archivo;
- una regla de más de 40.000 caracteres llega recortada en una sesión de 200K;
- **`.claude/` es una ruta protegida**: cada escritura pide permiso o la decide el clasificador, y ninguna regla de permisos lo evita (`.claude/worktrees/` es una excepción);
- después de compactar, `CLAUDE.md` vuelve solo y una regla vuelve cuando se toca de nuevo un archivo que coincide;
- un subagente con `isolation: worktree` no recibe las reglas de su worktree al leer: hay que pasarle los documentos en el brief.

Por eso lo que cambia en cada feature va en `docs/temas/`, sin permisos especiales, y `.claude/rules/` casi no se toca.

## 4. La forma: tres capas

1. **`CLAUDE.md`, siempre cargado, hasta 30 KB.** Lo que no se puede olvidar nunca y el mapa.
2. **`.claude/rules/<tema>.md`, se activan solas, de 1 a 3 KB.** Lo que no se puede olvidar de ese tema, sin copiar contratos, y a qué documento ir. Solo se tocan si nace un tema o cambia un glob.
3. **`docs/temas/<tema>.md`, se leen cuando hace falta, hasta 60 KB.** Los contratos, con servidor y página juntos por tema.

`.gitignore` pasa de `.claude/` a `.claude/*` y `!.claude/rules/`: `.claude/worktrees/` y `settings.local.json` siguen ignorados.
El filtro del kit suma `.claude/` y `.gitignore`. No vive en ningún script: se escribe en `docs/temas/despliegue.md` y se avisa en el reporte final. Los dos kits que esperan despliegue no se tocan.

## 5. Los documentos

Medidos antes del recorte, con el reparto de `rutas.py`:

| Documento | KB | Contenido |
|---|---:|---|
| `mi-espacio.md` | 61 | Modalidad, días hábiles, vacaciones, topes, horas extras, cálculo, saldo inicial, el panel, la API y la página |
| `mi-espacio-restituidos.md` | 48 | Los días que restituye un asueto |
| `mi-espacio-planilla.md` | 38 | La planilla de contrato y «Sumar al mes anterior» |
| `mi-espacio-agenda-mes.md` | 34 | El mes, las barras, el teclado, el nombre corto |
| `mi-espacio-agenda.md` | 33 | Eventos, quién ve qué, emails y recordatorios |
| `mi-espacio-nota-word.md` | 29 | La nota de licencia en Word |
| `mi-espacio-evento-publico.md` | 26 | El evento Personal (Público) |
| `mi-espacio-paso-y-avisos.md` | 25 | El paso a Configuración, «Hoy no están» y el email de vencimiento |
| `mi-espacio-acumuladas.md` | 21 | Las horas acumuladas de contrato |
| `base-de-datos.md` | 33 | Tablas y columnas por tema, cada migración y qué pasa sin ella |
| `feriados.md` | 30 | La pestaña, sus reglas y la foto de días por restituir |
| `notas-digitales.md` | 29 | Datos solicitados, tablas, anexos, firma, licencia del firmante, hoja, reiteración y `correos.js` |
| `metricas-y-reportes.md` | 29 | Métricas, la foto y los reportes |
| `configuracion.md` | 21 | Usuarios, licencias y áreas |
| `calendario-y-corridas.md` | 21 | El calendario único y los crons |
| `datasets.md` | 20 | Fechas, registrar una actualización, «Requiere nota», estados y Mi Perfil |
| `generador-de-notas.md` | 20 | El generador y el Word |
| `seguimiento.md` | 20 | Ciclos, avisos, cinta, PDF y `seguimiento.js` |
| `despliegue.md` | 19 | Pasa a unos 5 KB (sección 8) |
| `ciclo-de-vida.md` | 18 | El PDF del Ciclo de vida del dato |
| `proyectos.md` | 14 | Proyectos |
| `notas-dgmit.md` | 13 | Notas DGMIT |
| `frontend.md` | 12 | Carga de páginas, versiones, CSS, carcasa y sitio público |
| `firma-digital.md` | 7 | La firma digital de las notas |
| `auditoria.md` | 3 | Disponibilidad, canal, nota de auditoría y días sin auditor |

`mi-espacio.md` queda arriba del tope hasta el recorte: si después sigue arriba, se separa `mi-espacio-resumen.md`.

Cada documento empieza con su título, una línea de qué es y las specs que le dieron origen, que es donde queda la historia. Después, `## Archivos` (lo que hoy está en las líneas de `controllers/` y `services/`), sus secciones en el orden original, `## La página` y `## Tests`, con los nombres de los archivos.

### Formato

Un renglón por oración, con las continuaciones de un bullet sangradas. Ningún renglón pasa de 600 caracteres: el generador corta en el `;`, los `:` o la coma más cercanos.
El análisis de los merges da que así se lee un 60 % menos para resolver un choque.

### Reglas por ruta

| Regla | Se activa con | Va a |
|---|---|---|
| `frontend.md` | `public/**`, `tests/paginas.test.js`, `tests/*-frontend.test.js` | `frontend.md` |
| `datasets.md` | `services/{fechasDatasetReglas,registroReglas,requiereNotaReglas}.js`, `controllers/{dataset,cambiosPendientes,catalog}Controller.js`, `public/js/{admin,admin-fechas,perfil}.js` y sus tests | `datasets.md`, `auditoria.md` |
| `notas-digitales.md` | `services/notasDigitales*.js`, `services/firmasService.js`, `services/notasFirmaDigital.js`, `controllers/{notasDigitales,firmas}Controller.js`, `public/js/correos.js`, `tests/notas-*` | `notas-digitales.md`, `firma-digital.md` |
| `calendario-y-corridas.md` | `services/notasDigitalesCalendario.js`, `services/feriados{Reglas,Datos}.js`, `services/auditoria*.js`, `services/avisos*.js`, `controllers/notificacionesController.js` | `calendario-y-corridas.md`, `auditoria.md`, `feriados.md` |
| `seguimiento.md` | `services/seguimiento*.js`, `services/notasDgmitReglas.js`, sus controladores, `public/js/seguimiento.js`, `tests/seguimiento-*`, `tests/notas-dgmit-*` | `seguimiento.md`, `notas-dgmit.md` |
| `metricas-y-reportes.md` | `services/metricas*.js`, `services/reportes*.js`, `controllers/{metricas,reportes,gestion}Controller.js`, `public/js/reportes.js` y sus tests | `metricas-y-reportes.md`, `ciclo-de-vida.md` |
| `generador-de-notas.md` | `services/notasGenerador*.js`, `services/notasWord.js`, `controllers/notasController.js`, `public/js/notas.js` | `generador-de-notas.md` |
| `configuracion.md` | `public/configuracion.html`, `public/js/{usuarios,areas,feriados}.js`, `controllers/{usuarios,licencias,areas,feriados}Controller.js`, `services/{licencias*,areasReglas,usuarios*}.js` | `configuracion.md`, `feriados.md` |
| `proyectos.md` | `controllers/proyectosController.js`, `services/proyectosReglas.js`, `config/upload.js`, `public/js/proyectos.js`, `tests/proyectos-*` | `proyectos.md` |
| `mi-espacio.md` | `services/miEspacio*.js`, `controllers/miEspacio*.js`, `public/js/mi-espacio.js`, `public/mi-espacio.html`, `tests/mi-espacio*` | El mapa de subtemas de Mi espacio: esos archivos los tienen todos adentro y un glob no puede saber cuál se toca |
| `migraciones.md` | `database/**`, `tests/schema.test.js` | `base-de-datos.md`, `despliegue.md` |
| `emails.md` | `services/email*.js` | El tema de cada plantilla |
| `rutas-y-permisos.md` | `routes/index.js`, `middleware/**`, `tests/permisos.test.js` | Cada documento describe sus rutas |

Como un puntero cuesta 1 KB, los archivos que cruzan varios temas también pueden activar el suyo: `feriadosReglas.js`, `emailTemplates.js`, `routes/index.js`.

## 6. Qué sale y qué queda

Unos 108 KB salen. La partición ya baja la carga de una sesión típica de 654 KB a entre 25 y 100 KB: el recorte evita que el problema vuelva, y por eso no se fuerza.

Se trabaja por oración. **Nada se borra por patrón**: hay unas 100 frases con «desde la X» pegadas a contratos vivos.

| Motivo | Qué es | Ejemplos |
|---|---|---|
| H, historia pura | Lo que hacía el código antes, qué entrega trajo qué, cómo se llamaba, cuentas de un día | «`VERSION_MI_ESPACIO` pasó a `'20261215'` (de `'20261214'`…)», «(hasta la agenda con más onda iba primero…)», «con las 37 de antes, quedan 41», «con la base del 24/10/2026, 5», «Es la primera de tres entregas» |
| V, reescrita | Un contrato con un marco de historia: sale el marco, queda el contrato | «Desde los días restituidos, `estadosDe` lee las dos» pasa a «`estadosDe` lee las dos» |
| T, descripción de un test | Qué cubre cada archivo de tests. Queda su nombre en `## Tests` | Las líneas de «Tests:», hoy 62 KB |
| K, kit desplegado | La instrucción de un kit que ya se desplegó | La línea de cada kit, sus commits base, el plan B de noviembre |
| R, repetido literal | La misma oración, al pie de la letra | Solo literal: lo demás es paráfrasis y queda |
| C, corregida | Lo que dice el documento no es lo que hace el código, verificado | Sección 9 |
| A, agregada | Un contrato vivo que faltaba, con su evidencia | `tipo_pedido_guardado` |

### Lo que parece historia y hay que dejar

- **Calendario:** «la que vence va en `<b>` desde el 1/10» es una regla, aunque empiece con «desde».
- **Compatibilidad viva:** «un cuerpo de antes», «una pestaña con la página anterior», «una página vieja», «un cambio viejo sin la clave», «una foto sin `etapas`», «las notas 1/26 y 2/26 quedan en NULL», «conservan su PDF de 216 × 330». Si dice «como antes» o «de antes», se reescribe con el comportamiento concreto: sin el pasado, no se sabe qué describe.
- **Constantes y textos con fecha:** `REGISTRO_DESDE`, «Hasta el 12/10, el email de los 5 días…» (se muestra en pantalla), «por email hasta el 12/10/2026; desde el 13/10/2026, por Nota Digital» (de ahí salen los títulos de los tipos retirados).
- **Bloques «Desde X, … suma …» de `mi-espacio.js`:** guardan firmas y formas vigentes. Se reescribe el marco; nunca se borran.
- **Los retiros atados a un test:** «(los dos dan 404: `tests/reportes.test.js`)», `usuarios.html` y `areas.html` que no tienen que existir, y sus redirecciones.
- **«Revisión final, N»:** sale la etiqueta y queda el motivo, como el `pointer-events: none` de las barras.
- **«`api.js` no cambió»:** si justifica un `fetch` propio, queda el límite de `API`; si no dice nada más, sale.
- **Las decisiones (D):** «decisión del usuario», «respuesta del usuario», «Ruling N», los antiobjetivos y los «Límites sabidos» quedan con su motivo. Un «Ruling N» suelto se deja: nombra un plan y su spec está en el encabezado.
- **Reglas dentro de las líneas de tests:** antes de sacar una, se rescata lo que manda. Por ejemplo: «la foto con un hoy fijo, nunca `/api/cron/*`», «los datos reales no se versionan», «con los nombres cambiados», «un cambio a propósito en esos PDF tiene que volver a tomar la referencia», y que `VERSION_FERIADOS` tiene que ser mayor que `VERSION_REPORTES`.

### Las versiones

Los incisos «pasó a» salen de todos lados. `frontend.md` queda con esto, sin valores, porque los valores están en `tests/paginas.test.js:15-105`:
- cada `?v=` está atado a una constante de ese test; son contadores, no fechas;
- al cambiar un script se sube su constante y su `?v=`;
- `auth.js`, `main.js` y `api.js` comparten `VERSION`: tocar uno sube los tres en las 15 páginas que los cargan, y los valores escritos a mano en `tests/proyectos-frontend.test.js`;
- `VERSION_FERIADOS` tiene que ser mayor que `VERSION_REPORTES`;
- las dos hojas comparten `VERSION_CSS`;
- sin versión: `config.js` y `contacto.js`; `establecer-contrasena.js` lleva `?v=` a mano, sin constante ni test.

Sigue una tabla de script, constante y página.

### Referencias cruzadas

Las 132 referencias a otra sección pasan a nombrar su documento: «ver «Configuración»» es «ver `docs/temas/configuracion.md`».
Las 36 «ver abajo» se resuelven si el texto al que apuntan se mudó.
Las de «Mi espacio» a secas, que hoy no apuntan a ningún encabezado, se resuelven una por una.

## 7. El índice

Hasta 30 KB, con este orden: qué es, tech stack, comandos, entorno, estructura corta, el mapa, cómo se documenta, convenciones generales, reglas transversales, doble verificación, roles, seguridad, variables de entorno y despliegue en tres renglones.

**El mapa:** una tabla de tema, documento y cuándo leerlo, con los subtemas de Mi espacio.

**Comandos:** la línea de las migraciones pasa a «en local, `mysql -u USUARIO -p NOMBRE_BASE < database/updates/<archivo>.sql` (ningún SQL trae `USE`); en producción, phpMyAdmin».

**Entorno:** una sola suite por contenedor (chocan las bases `rpad_test_*` y `rpad_schema_*`, los `GET_LOCK` de toda la instancia y Mailpit); nunca `docker compose` desde un worktree, ni `down -v`; un worktree no trae `.env`.

**Cómo se documenta**, para que no vuelva a crecer:
- al terminar una feature se actualiza `docs/temas/<tema>.md`; `CLAUDE.md` solo si nace un tema o cambia una regla transversal; `.claude/rules/` solo si nace un tema o cambia un glob;
- se escribe lo vigente; lo que era antes y qué entrega lo trajo quedan en git y en la spec;
- sí se escribe la decisión con su motivo, si alguien podría «arreglarla» de buena fe;
- un renglón por oración, sin listas de lo que cubre cada test y sin kits: cada kit tiene su `PASOS.txt`;
- `tests/documentos.test.js` controla los topes: si molesta, se parte el documento.

**Reglas transversales**, fundidas desde las listas de los informes de clasificación (`~/rpad-notas/partir-claude-md/clasificacion-*.md`). Entre otras:
- fechas como texto `'AAAA-MM-DD'`; hoy es `hoyArgentina()`; en el navegador, `Utils.hoyEnArgentina()`, nunca `toISOString()`;
- el servidor arma cifras y textos, y la página los imprime (Ruling 19); las copias del navegador están atadas por tests de paridad;
- todo texto del servidor pasa por `Utils.escapeHtml`; un número va con `String`, porque `Utils.escapeHtml(0)` da '';
- `requiere_nota` y los que valen 0: nunca `x || null`;
- lo ya enviado no cambia y un PDF guardado no se regenera;
- `metricas_fotos` no se modifica nunca, y cambiar la forma de la foto obliga a subir su versión o a leer con tolerancia;
- una sola lectura del calendario por corrida o pedido; `leerCalendario` nunca tira; la caída se detecta por `calendario.error`;
- el tipo de una licencia no sale de su dueño, un id ajeno da el mismo 404 que uno que no existe y un Público llega recortado desde la consulta;
- sin destinatario, `sendEmail` va a las casillas de la DGMIT, así que nunca se llama con una lista vacía;
- `Date`, `CURDATE()` y `setMonth` no se usan para fechas de negocio;
- ningún id ni clase empieza con `ad-`;
- ningún nombre real en el repositorio, ni datos de producción;
- lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó»;
- «agenda» a secas no se usa en el código: choca con la Agenda de pedidos de Reportes;
- las migraciones van antes que el código, y una columna nueva sin migración da 500 en todo Mi espacio.

**«No frena»**, con su alcance:

> El sistema no frena licencias por lo que cambió después: un feriado dado de baja, un saldo corregido, una salida de la planilla, unos días por restituir o lo que quedó distinto en Configuración avisan y nunca frenan una carga.
> Sí frenan, porque no se podría cumplir lo pedido: una carga nueva que no cierra; una corrección que empeora lo que falta; una persona a cargo que no sirve; y borrar o mover una licencia que ya empezó en Configuración.

## 8. Despliegue

Tres renglones en el índice (cPanel, las migraciones antes que el código, fuera del horario de los crons) y `docs/temas/despliegue.md`, de unos 5 KB:
- el procedimiento en cPanel y las tres Tareas Cron;
- cómo se arma un kit, con el filtro nuevo;
- los pasos: comprobar los `?v=`, respaldo, SQL, archivos, Restart y solo mirar; no se guarda nada en la base real, porque un evento Laboral de prueba manda invitaciones de verdad;
- las migraciones antes que el código, con sus excepciones;
- **una sola tabla** con el orden de las migraciones y el de las vueltas atrás, incluida `rollback-usuarios-superadmin.sql`, que hoy no se nombra, y cuáles no se pueden correr solas;
- después de `migracion-notas-dgmit.sql` no se vuelven a correr `migracion-editor-auditoria.sql` ni `migracion-usuarios-superadmin.sql`;
- la foto de cada 10/01;
- **pendientes con fecha**, que se borran al cumplirse: la reiteración bimestral antes del 01/12/2026; mover la Tarea Cron de la firma digital a las 8:05; las notas DGMIT de 2026 a mano antes del 10/01/2027; y el control del 10 u 11/01/2027.

Salen los kits ya desplegados, sus commits base, el plan B de noviembre y los `?v=` de cada comprobación previa. Siguen en git y en cada `PASOS.txt`.

`database/privado/rollback-mi-espacio-evento-publico-datos.sql` no aparece en esta Mac: el documento lo dice.

## 9. Diferencias con el código

Vienen del escaneo y de los informes de clasificación. Cada una se vuelve a verificar con grep antes de corregirla.

**Se corrige el documento:**

| Dice | Es |
|---|---|
| `mysql -u root -p < …` | Ningún SQL trae `USE`: sección 7 |
| `routes/index.js` ~395 líneas | Sin cuenta: cambia en cada feature |
| `main.js` «solo declara» | Crea un `<style>` y engancha `DOMContentLoaded` |
| Los decorativos con `aria-hidden` | Vale para el HTML; los `Icons` de `main.js` no lo llevan |
| `getEstadisticas` «la sigue usando administración» | No tiene ninguna llamada |
| Servicios en `*Service.js` | Solo 9 de 66; la regla vale para controladores |
| Soft deletes siempre | Hay borrados reales: `areasController`, `gestionController`, `proyectosController` y otros |
| «es lo único del archivo que lleva la palabra» (agenda) | Hay 49 líneas |
| La API de métricas no recibe la gestión | La lee y nadie la usa |
| «Todavía no estaba en el RPAD» va en el hueco libre | Va al centro de su tramo |
| El Informe anual lee solo fotos | Las cifras sí; los logros son en vivo |
| El lector ve «los emails del área» | También para y cc de las notas y los destinatarios de los emails (decisión del usuario: está bien) |
| `requiere_nota` no se muestra en público | La pantalla no; la API pública lo entrega |
| Falta `tipo_pedido_guardado` | Se agrega: sin él, editar guardaría el tipo efectivo |
| `enviada_at` «ya está en hora argentina» | Se escribe con `NOW()`: en producción da hora argentina (la nota 3/26, creada 11:15 UTC, enviada 08:15) y en el Docker local, UTC |
| `FRASE_DE_LA_LICENCIA` con 9 tipos | Son 10 |
| «así no se pierde ni se repite un vencimiento» | Vale entre corridas seguidas con el mismo calendario; el email de 40 días no deduplica |
| Rate limiting: login y contacto | Suma 50 fallidos por IP, recuperar y links |
| Sin `MAILPIT_URL` | Se agrega a las variables |
| «nunca `CURDATE()`» | `gestionController` lo usa; la regla vale para lo que se avisa |
| «ninguna función tira» (nota de licencia) | Un tipo nuevo sin su entrada en `CUERPOS` tira |
| «las siete tablas» | Sin cuenta |
| «nunca se queda un día sin recordatorio y sin nota» | Salvo que falle la autorización tardía |
| El email de vencimiento, «una sola vez» | Si sale y anotar falla, sale de nuevo |
| Falta importar las notas DGMIT | Se cargan a mano (decisión del usuario, 25/10); también en `README.md:169` y `:713` |
| `migracion-fechas-datasets-textos.sql`, después de los archivos | Y antes del Restart |
| La CSP | Suma `scriptSrcAttr` |
| «Sin `CHECK`» | Salvo `json_valid` en `cambios_pendientes` |

**No se corrige el código:** esta rama no lo toca. Lo que parece un error del código queda dicho tal como es y va a la lista de la limpieza: `Icons` sin `aria-hidden`, un tipo nuevo sin `CUERPOS`, comentarios viejos, `.env.example` sin `UPLOADS_DIR` ni `MAILPIT_URL`, `package.json` en 1.2.0 y `README.md:301`.

Las frases de Windows en `docs/superpowers/` son historia y no se tocan. La mención de Windows en `proyectos.md` es del contrato de los CSV.

## 10. El test de topes

`tests/documentos.test.js`, puro, sin base ni servidor:
- `CLAUDE.md` hasta 30 KB, cada documento hasta 60 KB y cada regla hasta 4 KB;
- ningún renglón de más de 600 caracteres en los tres;
- cada `docs/temas/*.md` aparece en el mapa de `CLAUDE.md`;
- cada `docs/temas/…` citado en `CLAUDE.md`, en una regla o en otro documento existe;
- cada regla tiene `paths:`, cita al menos un documento y cada glob coincide con algún archivo;
- ningún documento dice «pasó a» seguido de una versión;
- `.gitignore` deja versionar `.claude/rules/`.

## 11. La comprobación

Un script, no a ojo, contra el `CLAUDE.md` de main en el momento de implementar:
1. Parte el original en oraciones y cláusulas (unas 2.700).
2. Cada una tiene que estar al pie de la letra (con los espacios normalizados) en un documento, en una regla o en `CLAUDE.md`, o tener una decisión con motivo. Lo que no cierra hace fallar la comprobación.
3. Cada literal distinto del original (unos 4.700 entre backticks y 950 entre comillas) sigue en algún lado o entra en la lista de los que se fueron.
4. Las referencias, las líneas largas y los topes.

El recorte no edita texto a mano. Trabaja sobre una hoja con `[id] oración` y escribe solo decisiones: quitar la oración, quitar una subcadena exacta, reemplazar una subcadena o agregar una oración, siempre con motivo. Un script las aplica y rechaza la que no calza. Así, lo que se va es una lista exacta y nada se copia mal.

**La lista de lo que se fue** se publica como página privada, con filtros por documento y por motivo y un buscador. Trae cada frase, lo que se quitó, lo que quedó y por qué, y aparte los literales que ya no aparecen. Es texto de un repositorio público.

**El revisor:** agentes distintos de los que recortaron comparan el original con el resultado, por tramos, buscando un contrato perdido o una reescritura que cambie el sentido.

## 12. Lo que no cambia

La aplicación, los tests existentes, las specs y los planes anteriores, y los dos kits que esperan despliegue. Ningún archivo nuevo viaja en un kit: la aplicación no lee ningún documento, y el único test que lo hace es el nuevo.

## 13. Riesgos

- **Una sesión no lee el documento que le manda el puntero.** Por eso lo que no se puede olvidar va en la capa de arriba. Se ensaya con subagentes reales antes del merge.
- **Una regla transversal queda en una sola capa y se pierde de vista.** La lista sale de los informes, y un revisor mira el índice y las reglas contra el original y contra el código.
- **Dos lugares que dicen lo mismo se separan con el tiempo.** Una transversal queda en el índice y en su documento. Se acepta: fundirlas todas es la opción que el usuario no eligió.
- **El documento crece otra vez.** Para eso están el test y «Cómo se documenta».
- **Otra sesión edita `CLAUDE.md` mientras tanto.** Hoy no hay otra en la fila. Si pasa, se vuelve a partir desde el main nuevo: las decisiones van por el contenido de cada oración y sobreviven.

## 14. Lo que queda para otras sesiones

- La lista de la limpieza (sección 9).
- La memoria `proceso-sesion-coordinadora` y los briefs tienen que decir dónde se documenta cada cosa, y el filtro del kit suma `.claude/` y `.gitignore`: va en el reporte final.
