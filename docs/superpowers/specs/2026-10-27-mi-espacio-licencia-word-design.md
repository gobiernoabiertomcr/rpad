# Mi espacio: la nota de licencia en Word

Fecha: 27/10/2026. **Estado: aprobado por el usuario el 27/10/2026.** Salió de la charla del 27/10/2026 con el usuario, en una sesión aparte de la coordinadora de Mi espacio. Se suma a la pestaña Licencias de Mi espacio (entrega 2, `2026-10-26-mi-espacio-licencias-y-horas-design.md`, en producción desde el 27/10/2026).

**Va en la cola después del Resumen «Titular»** (`2026-10-27-mi-espacio-resumen-design.md`, en su rama), que cambia los mismos archivos de la página (`public/mi-espacio.html` y `public/js/mi-espacio.js`). El plan arranca leyendo el main de ese momento.

**Maquetas:** en `2026-10-27-mi-espacio-licencia-word-mockups/`:
- `index.html`: la entrada, con las tres versiones del segundo paso, el Word abierto y los Word de muestra;
- `mi-espacio.html#licencias`: la página real de Mi espacio sin servidor. Las respuestas son las de la API real de la rama, sacadas de una copia de la base con personas y licencias inventadas (`js/datos.js`). La barra de abajo a la derecha cambia de versión.

El usuario eligió **la versión C, «La nota a la vista»**. Se miran con el preview `licencia-word-maquetas` (puerto 8766). Los nombres son inventados. Donde la maqueta no coincida con este documento, manda el documento. El texto de la maqueta (`js/nota-licencia.js`) y sus Word (`word/`) son descartables: muestran los textos aprobados, no son el código de la entrega.

## Por qué

Cada licencia se pide con una nota en papel al Director General de Modernización e Investigación Territorial. Hoy cada persona la escribe a mano en Word, con los mismos datos que ya cargó en Mi espacio. El usuario quiere que, al guardar una licencia, el RPAD le dé esa nota lista para imprimir y firmar.

Se arma en el momento, con los datos que la licencia tiene al bajarla: si la licencia cambia después, la nota sale con lo nuevo. Si se guardara, saldría con datos viejos (palabras del usuario).

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Un segundo paso en el modal «Cargar licencia»** (y en «Corregir la licencia»): al guardar, el modal no se cierra. Pasa a «Licencia cargada» (o «Licencia corregida»), con la licencia guardada y la nota a la vista, y ofrece «Descargar Word» (decisión del usuario: versión C).
- **«Word» en cada licencia de la lista**, al lado de «Editar», para bajarla cuando se quiera (decisión del usuario). Lo tienen todas las licencias, también las que ya pasaron, menos el uso autorizado (decisión del usuario).
- **Un Word por tipo de licencia,** con los textos que aprobó el usuario (sección 2): hoja A4 blanca, Arial 11 e interlineado 1,15 (pedido del usuario).

**No objetivos**
- **La nota no se guarda:** ni el archivo, ni el texto, ni cuándo se bajó o quién la bajó.
- **El RPAD no sigue la nota:** no sabe si se presentó, si se firmó ni si se autorizó. Mi espacio sigue sin aprobaciones, firmas ni expedientes (no objetivo de la entrega 2): el Word es un papel que la persona imprime y firma.
- **Sin el nombre del Director.** La nota va dirigida al cargo (decisión del usuario: el repositorio es público y el nombre no puede quedar en el código). Si hace falta, el nombre se agrega a mano en el Word.
- **Sin membrete, sin PDF y sin firma digital** (decisión del usuario: hoja blanca).
- **Sin nota para el uso autorizado ni para las horas extras** (decisión del usuario, «por ahora»).
- **No cambia nada más:** ni la carga, ni las reglas, ni Configuración → Licencias, ni las Notas Digitales, ni el Resumen.

**Antiobjetivos**
- **Que la vista del segundo paso diga una cosa y el Word otra:** salen del mismo armado.
- **Que la nota salga con datos viejos:** se arma con lo que hay en la base al pedirla.
- **Que un nombre real o un dato de producción llegue al repositorio:** ni en el código, ni en los tests, ni en las maquetas.
- **Que el modal diga «Licencia cargada» si no se guardó:** el segundo paso aparece solo con una respuesta 2xx del guardado.
- **Que el Word quede dañado por un carácter raro** en el nombre, el cargo o lo que sea: el texto pasa por `textoParaWord` (sección 4).

## 1. Quién y qué licencias

- **Quién:** cualquier persona con sesión, cualquiera sea su rol, como todo Mi espacio. Cada una baja solo las notas de sus licencias.
- **Qué licencias:** las activas de la persona, de estos ocho tipos: vacaciones, franquicia, estudios, atención médica, atención del grupo familiar, médica extraordinaria, franco compensatorio (planta) y horas a favor (contrato). El uso autorizado no tiene nota.
- **Las que no cuentan** («Antes del saldo inicial: no descuenta», «fuera de la modalidad») tienen nota igual, con el texto de su tipo.

## 2. El texto de la nota (aprobado por el usuario el 27/10/2026)

**La nota entera** (el ejemplo es de una licencia anual ordinaria):

```
                                   Comodoro Rivadavia, 27 de octubre de 2026

Al Señor Director General de
Modernización e Investigación Territorial
S               /               D

De mi mayor consideración:

      Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el
usufructo de cinco (5) días hábiles correspondientes a mi licencia anual
ordinaria, a partir del día martes 3 de noviembre de 2026.

      Sin otro particular, saludo a Ud. atentamente.


                                        ____________________________
                                        Nombre Apellido
                                        Cargo
```

**El párrafo del medio de cada tipo.** Todos empiezan igual: «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar». Después:

| Tipo | Lo que sigue |
|---|---|
| Vacaciones | «el usufructo de cinco (5) días hábiles correspondientes a mi licencia anual ordinaria, a partir del día martes 3 de noviembre de 2026.» |
| Franquicia | «el usufructo de tres (3) horas de franquicia para trámites personales el día miércoles 4 de noviembre de 2026.» |
| Estudios | «licencia por examen por dos (2) días hábiles, a partir del día lunes 16 de noviembre de 2026.» |
| Atención médica | «licencia por atención médica por dos (2) días hábiles, a partir del día jueves 12 de noviembre de 2026.» |
| Grupo familiar | «licencia por atención del grupo familiar por un (1) día hábil, el día viernes 20 de noviembre de 2026.» |
| Médica extraordinaria | «licencia médica extraordinaria por diez (10) días hábiles, a partir del día lunes 23 de noviembre de 2026.» |
| Franco compensatorio | «el usufructo del franco compensatorio correspondiente a las horas extras realizadas en octubre de 2026, el día lunes 14 de diciembre de 2026.» |
| Horas a favor | «el usufructo de dos horas y media (2,5) a favor, correspondientes a las horas extras realizadas en septiembre de 2026, el día jueves 15 de octubre de 2026.» |

**Las reglas de esos textos:**
- **Los días** son los días hábiles de la licencia, con los feriados: la misma cuenta que la lista («12 días corridos, 9 hábiles» da «nueve (9) días hábiles»). Van en letras y en números, con «un (1) día hábil» en singular.
- **Vacaciones dice solo cuántos días y desde cuándo,** sin el hasta ni de qué año salen (pedido del usuario).
- **«A partir del día» es el primer día hábil de la licencia,** no `desde`: una licencia cargada del sábado 31/10 al viernes 6/11 dice «a partir del día lunes 2 de noviembre» (mi decisión: `validarLicencia` deja empezar en un día que no es hábil, y nadie pide arrancar un sábado). Vale para los tipos que cuentan días: vacaciones, estudios, atención médica, grupo familiar y médica extraordinaria. Los de un día (franquicia, franco y horas a favor) dicen su día, `desde`.
- **Con un solo día hábil,** en cualquier tipo de días, va «…por un (1) día hábil, el día martes 3 de noviembre de 2026.» en lugar de «a partir del día», con ese día hábil (aunque `desde` y `hasta` sean distintos). En vacaciones: «…el usufructo de un (1) día hábil correspondiente a mi licencia anual ordinaria, el día…».
- **Sin ningún día hábil** (un feriado cargado después en Configuración → Feriados cae sobre una licencia de días ya guardada): no hay nota. Las dos rutas responden 409 «Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.» (mi decisión). No puede pasar en el segundo paso: el guardado no deja una licencia sin días hábiles.
- **Las horas:**
  - van en letras y en números: «una (1) hora», «tres (3) horas»;
  - las medias, «una hora y media (1,5)», «dos horas y media (2,5)» y «media hora (0,5)»;
  - la franquicia es de horas enteras, de 1 a 7, y las horas a favor van de a media hora.
- **El mes de las horas extras:**
  - en un franco, el de dos meses antes del día del franco (los francos se usan dos meses después de las horas extras: el de diciembre sale de las de octubre);
  - en las horas a favor, el del mes anterior (las de octubre salen de las de septiembre).
  - En los dos se cruza el año: un franco de enero de 2027 sale de noviembre de 2026.
- **Las fechas:** el día de la semana, el día, el mes en letras y el año («martes 3 de noviembre de 2026»).
- **«correspondientes»** concuerda con lo que cuenta: «un (1) día hábil correspondiente», «una (1) hora a favor, correspondiente». Con las medias manda la palabra: «media hora (0,5) a favor, correspondiente» y «una hora y media (1,5) a favor, correspondiente» (dicen «hora»), «dos horas y media (2,5) a favor, correspondientes» (dice «horas»; mi decisión).

**La fecha de la nota** es el día de la última vez que se guardó la licencia, en hora argentina (decisiones del usuario: la de la carga y, si se corrigió, la de la última corrección). Es `mi_espacio_licencias.updated_at`, que la base pone al día solo cuando un guardado cambia algo. Una corrección sin cambios no la mueve (mi decisión: no es una corrección).

**La firma:**
- el nombre (`usuarios.nombre_completo`) y el cargo (`usuarios.cargo`), leídos al armar la nota;
- en un contratado (`vinculo = 'contrato'`), entre el nombre y el cargo, el renglón «Personal contratado, cumpliendo funciones de», más chico, como en las Notas Digitales (`renglonesDeFirma`);
- sin cargo cargado, solo el nombre, sin el renglón del contratado (mi decisión: «cumpliendo funciones de» necesita un cargo).

**Fijos en el código** (sin nombres de personas): «Comodoro Rivadavia», «Al Señor Director General de / Modernización e Investigación Territorial», «S / D», «De mi mayor consideración:» y «Sin otro particular, saludo a Ud. atentamente.». Si cambia la autoridad o el cargo, se cambia el código.

**La nota opcional de la licencia no va en el Word** (decisión del usuario: es un apunte personal).

## 3. El Word

Aprobado por el usuario sobre la maqueta (`index.html`, «Así se ve el Word»):
- **La hoja:** A4, 11906 × 16838 twips, escritos como literales (`convertMillimetersToTwip` redondea para abajo y daría 11905 × 16837).
- **Los márgenes:** 2,5 cm arriba y abajo y 3 cm a los costados. Sin encabezado, sin pie, sin membrete ni marca de agua.
- **La letra:** Arial 11 (`size: 22`), interlineado 1,15 (`line: 276`, `lineRule: auto`) en el párrafo por defecto del documento, sin espacio entre párrafos.
- **El orden:**
  1. la fecha, a la derecha, y dos renglones vacíos;
  2. el destinatario en dos renglones, «S / D» y un renglón vacío;
  3. el saludo y un renglón vacío;
  4. el cuerpo, justificado y con sangría de 1,25 cm en el primer renglón, y un renglón vacío;
  5. el cierre, con la misma sangría, y cuatro renglones vacíos;
  6. la firma, centrada en la mitad derecha (sangría izquierda de 8 cm): la línea, el nombre, el renglón del contratado (9 pt) y el cargo.
- **El nombre del archivo:** «Nota de licencia - <tipo> - <desde>.docx» (decisión del usuario: el tipo y la fecha en que empieza). Por ejemplo, «Nota de licencia - Licencia anual ordinaria - 2026-11-03.docx».
  - Los nombres de los tipos: Licencia anual ordinaria, Franquicia, Estudios, Atención médica, Atención del grupo familiar, Médica extraordinaria, Franco compensatorio y Horas a favor.
  - Va con `disposicionDeAdjunto` (`services/seguimientoReglas.js`).

## 4. Cómo se arma (el servidor)

- **Un módulo puro, `services/miEspacioNota.js`** (sin pool ni `Date` local; las fechas son texto `'AAAA-MM-DD'`; ninguna función tira):
  - recibe la licencia (`tipo`, `desde`, `hasta`, días hábiles, horas), la fecha de la nota y la persona (`nombre`, `cargo`, `contratado`);
  - devuelve la nota como estructura: `{ fecha, destinatario, sd, saludo, cuerpo, cierre, firma, nombre }`, o null para un tipo sin nota;
  - suma el HTML de la vista, armado y escapado ahí mismo, y el nombre del archivo;
  - lleva los ayudantes nuevos: los números en letras, de 1 a 999, con «un» y «una»; las horas con sus medias; y la fecha con el día de la semana.
  - Puede usar `formatoLargo` (`notasDigitalesCalendario.js`) y `renglonesDeFirma` (`notasDigitalesContenido.js`).
- **El Word, en `services/miEspacioNotaWord.js`:** arma el .docx con la librería `docx` (ya instalada) desde esa misma estructura. Todo texto variable pasa por `textoParaWord` de `services/notasWord.js`, a la que solo se le agrega `export`.
  - Mi decisión: un armado propio y chico, en lugar de sumarle a `renderDocx` la hoja, la letra, la sangría y una firma con texto. Así el Word del Generador y el de las Notas Digitales no cambian.
- **Los datos** (`controllers/miEspacioController.js` y `services/miEspacioDatos.js`, solo lectura, consultas parametrizadas):
  - la licencia activa de la persona, con su `updated_at` pasado a fecha argentina (`UNIX_TIMESTAMP` y `ahoraArgentina`, como `subido_el` de Proyectos: la base guarda los TIMESTAMP en UTC, y un guardado a las 22:00 no puede salir con la fecha del día siguiente);
  - los feriados, para contar los días hábiles;
  - el nombre, el cargo y el vínculo de la persona (`personaDe` hoy no lee el cargo).
- **La fila de `GET …/nota`** sale del mismo armado que la lista: `filaDeLicencia` (`services/miEspacioResumen.js`) es privada y necesita el contexto entero (`contextoDe`, el cálculo del estado y `vinculosDe`). Hace falta exportar un envoltorio que arme la fila de una sola licencia con ese contexto; `licenciaDe` sola no alcanza.
- **Una persona sin modalidad** (le sacaron el vínculo en Configuración → Usuarios): la lista no muestra sus licencias, pero las dos rutas arman la nota igual, porque el texto no depende de la modalidad (mi decisión). Sin vínculo, la firma no lleva el renglón del contratado.

## 5. La API

Con `authMiddleware`, como todas las rutas de Mi espacio (`tests/permisos.test.js`: las dos en `RUTAS_MI_ESPACIO`, con 401 sin sesión):

- **`GET /api/mi-espacio/licencias/:id/nota`:** lo que necesita el segundo paso, en una sola respuesta:
  ```
  { success, data: { fila, html, fecha, aclaracion } }
  ```
  - `fila`: la licencia como la arma `filaDeLicencia` para la lista. Así el segundo paso no depende del año que muestra la lista: una licencia de 2027 no está en la lista de 2026.
  - `html`: la nota, armada y escapada por el servidor.
  - `fecha`: la fecha de la nota, `'AAAA-MM-DD'`.
  - `aclaracion`: el renglón que va arriba de la nota, «Lleva la fecha del 27/10/2026, la última vez que guardaste un cambio en la licencia. Se baja en Word, para imprimir y firmar.».
- **`GET /api/mi-espacio/licencias/:id/word`:** el .docx, con el `Content-Type` de Word y `Content-Disposition` armado por `disposicionDeAdjunto(nombre)`.
- **Los errores, en las dos:**
  - **404 «Licencia no encontrada»:** un id que no pasa `idPositivo`, una licencia de otra persona o una dada de baja.
  - **404 «Esta licencia no tiene nota.»:** un uso autorizado.
  - **409 «Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.»:** una licencia de días sin ningún día hábil (sección 2).
  - **500, con un mensaje fijo** («Error al armar la nota»): cualquier otra falla. El detalle va solo a `console.error`.
- **La lista no cambia.** El nombre del archivo lo da el `Content-Disposition` del Word, que la página lee (sección 6).

Sin tablas, columnas ni migraciones.

## 6. La página

**El segundo paso** (versión C de la maqueta, la que eligió el usuario):

1. **Al guardar con éxito** (POST o PUT, 2xx) el formulario de licencia (no el de «Registrar un uso autorizado», que también pasa por `guardarLicencia` y se sigue cerrando como hoy), el modal no se cierra:
   - el título pasa a «Licencia cargada» o «Licencia corregida»;
   - el cuerpo y el pie del formulario se reemplazan por los del segundo paso;
   - la página vuelve a pedir todo de fondo (`volverAPedirTodo`), así la lista de atrás ya muestra la licencia;
   - mientras llega `GET …/nota`, el cuerpo dice «Armando la nota…».
2. **El cuerpo,** con lo que manda `GET …/nota`:
   - arriba, la licencia guardada: la tilde verde, la insignia del tipo, las fechas y la cantidad, y debajo, en gris, de qué licencias salen, lo de Configuración y «Tus compañeros ven…» (los textos de `fila`, como en la lista);
   - después, «Así sale la nota», con `aclaracion` debajo;
   - después, la hoja: el `html` sobre un fondo gris, a escala del ancho del modal (A4, Arial, interlineado 1,15).
3. **Los avisos de la respuesta** van en un recuadro ámbar arriba de la licencia, en lugar del aviso flotante de hoy. Solo los trae la corrección (`PUT`, por ejemplo `TEXTO_NO_SE_COPIA`): el alta responde sin `avisos`.
   - En el segundo paso no sale el aviso flotante de «Licencia cargada»: lo dice el título.
   - `#me-anuncio` anuncia «Licencia cargada. Podés descargar la nota en Word.» (o «corregida»), con los avisos.
4. **El pie:** «Listo» (borde), que cierra, y «Descargar Word» (tinta).
5. **El foco** va a «Descargar Word» al mostrarse el segundo paso. Escape, la × y «Listo» cierran. Al volver a abrirlo, es otra vez el formulario.
   - **Al cerrar, el foco va donde va hoy después de guardar:** el «Editar» de la licencia guardada si la lista la muestra y, si no, el respaldo de siempre.
   - Hoy eso no sale solo: `volverAPedirTodo` calcula el respaldo con el elemento enfocado, que en el segundo paso está dentro del modal; `devolverElFoco` no hace nada con un modal abierto, y el botón que abrió el modal ya lo reemplazó la recarga de la lista (`cerrarModal` dejaría el foco en `<body>`). Hay que guardar el respaldo antes de recargar y aplicarlo al cerrar.
6. **Si `GET …/nota` falla:**
   - lo que se ve: «La licencia quedó guardada, pero no se pudo armar la vista de la nota. Probá «Descargar Word» o bajala después con «Word» en la lista.»;
   - «Descargar Word» sigue andando;
   - con un 401, al login.

**«Descargar Word»** (en el segundo paso y en la lista) pide `GET …/word` con un `fetch` propio de la página, con `Auth.getAuthHeaders()` (JWT en el encabezado, nunca en la URL; `api.js` no cambia), como `pedirWord` del Generador de Notas, y lo baja con un `descargarBlob` local, copiado de `correos.js`.
- Mi decisión: el `fetch` propio, y no `API.pedirArchivo`, porque `API.pedirArchivo` no da el estado ni el `Content-Disposition`.
- **El nombre del archivo** sale del `Content-Disposition` de la respuesta (el `filename*` en UTF-8 de `disposicionDeAdjunto`). Así la página no copia los nombres de los tipos y el nombre llega también cuando falló `GET …/nota`. Sin el encabezado, «Nota de licencia.docx».
- Mientras baja, el botón queda deshabilitado.
- Si falla: el mensaje del servidor (por ejemplo, el 409 de la sección 2) o, sin mensaje, «No se pudo descargar la nota. Probá de nuevo en unos minutos.».
- Con un 401, al login.

**«Word» en la lista** (decisión del usuario: «Word», como el botón de Correos → Libro):
- va al lado de «Editar», en un grupo de acciones a la derecha de la fila;
- se escribe con `aria-label` «Descargar en Word la nota de la licencia del 16/11 al 27/11/2026»;
- no aparece en el uso autorizado (por su `tipo`);
- en el teléfono queda arriba a la derecha, con «Editar», como en la maqueta.

**Las convenciones de `mi-espacio.js`** siguen:
- lo que arma HTML es puro y va primero, por ejemplo `htmlDeFilaDeLicencia` con «Word» y `htmlDelSegundoPaso`;
- lo que toca el DOM o la API va aparte, al final;
- al cargarse, el archivo solo declara (`tests/mi-espacio-frontend.test.js`);
- todo texto del servidor pasa por `Utils.escapeHtml`, salvo `html`, que ya viene escapado, como en el Generador de Notas;
- los estilos del segundo paso van en el `<style>` de `mi-espacio.html`, con los tokens `--sg-*`;
- sube `VERSION_MI_ESPACIO` (`tests/paginas.test.js`).

**Calidad:**
- contraste de 4,5:1 o más;
- foco visible;
- sin desplazamiento horizontal en un teléfono de 375 px;
- el modal se desplaza solo en el cuerpo: la hoja no tiene su propia barra.

## 7. Tests

- **`tests/mi-espacio-nota.test.js`, puro:**
  - los ocho tipos con los textos de la sección 2, al pie de la letra;
  - el singular y el plural; los números en letras (1, 21 —«veintiún»—, 30 y 45) y las horas (0,5, 1, 1,5, 2,5 y 7), con su «correspondiente» o «correspondientes»;
  - el primer día hábil (una licencia que arranca un sábado o un feriado), un solo día hábil entre fechas distintas y ningún día hábil;
  - el día de la semana; el mes de las horas extras, también cruzando el año;
  - la firma de un contratado y la de alguien sin cargo;
  - el uso autorizado, que da null;
  - el HTML escapado; el nombre del archivo.
- **`tests/mi-espacio-nota-word.test.js`, puro, con JSZip como `notas-word.test.js`:**
  - la hoja A4 y los márgenes;
  - Arial 22 e interlineado 276 en el párrafo por defecto;
  - el orden y los textos; la sangría del cuerpo y la del cierre; la firma;
  - un nombre con caracteres que el XML no admite, que da un Word sano.
- **En `tests/mi-espacio-api.test.js`, con Docker:**
  - las dos rutas;
  - la licencia de otra persona y la dada de baja (404), el uso autorizado (404 con su mensaje) y la licencia sin días hábiles (409);
  - la fecha: la de la carga, la de una corrección, la de una corrección sin cambios y la de un guardado a las 22:00 de Argentina;
  - el `Content-Disposition`;
  - una persona sin modalidad, que también arma la nota;
  - un lector, que también baja la suya.
- **`tests/mi-espacio-frontend.test.js`:**
  - el guardado de una licencia ya no cierra el modal. Cambian los tests que hoy esperan que se cierre (alrededor de las líneas 2092, 2146, 2474 y 3158 de main 780e39b: el aviso después de guardar y el foco en el «Editar» nuevo);
  - el de «Registrar un uso autorizado» se sigue cerrando como hoy;
  - el segundo paso con lo del servidor, el recuadro de los avisos de una corrección, el foco, «Listo» y Escape, y el foco al cerrar;
  - el formulario de nuevo al reabrir;
  - la falla de `…/nota` y la de la descarga, con el mensaje del servidor;
  - «Word» en las filas, menos en el uso autorizado;
  - la descarga con el `fetch` propio y `descargarBlob`, con el nombre del `Content-Disposition` y el 401: el contexto del `vm` necesita `Blob` y `URL.createObjectURL` falsos.
- **`tests/permisos.test.js`** (las dos rutas) **y `tests/paginas.test.js`** (`VERSION_MI_ESPACIO`).
- **La regla del proyecto:** `npm test` completo antes y después; el Word del Generador y el de las Notas Digitales no cambian (sus tests siguen verdes sin tocarlos).

## 8. Despliegue

Sin SQL ni Tarea Cron: subir los archivos y Restart. El kit va después del del Resumen «Titular».

## Decisiones del usuario (27/10/2026)

1. La nota va al Director General de Modernización e Investigación Territorial, **solo con el cargo**: el nombre no puede ir en el código y no se carga en ningún lado.
2. Hoja A4 blanca, Arial 11, interlineado 1,15, sin membrete.
3. Se arma en el momento con los datos de la licencia; nunca se guarda.
4. La fecha de la nota es la de la carga y, si se corrigió, la de la última corrección.
5. La nota opcional de la licencia no va en el Word.
6. Los textos de la sección 2: la fórmula «tenga a bien autorizar el usufructo» la propuso el usuario. En vacaciones van solo los días y desde cuándo; en estudios, sin «Oportunamente presentaré la constancia del examen»; en franquicia, «para trámites personales».
7. El segundo paso es la versión C, «La nota a la vista». El modal queda abierto después de bajar el Word, con «Listo».
8. Al corregir una licencia también pasa al segundo paso, con «Licencia corregida».
9. «Word» en todas las licencias de la lista menos el uso autorizado, también las que ya pasaron. El uso autorizado no lleva Word, por ahora.
10. En las vacaciones del firmante, la nota no nombra a la persona a cargo de las Notas Digitales.
11. El archivo se llama «Nota de licencia - <tipo> - <desde>.docx».

## Mis decisiones (para revisar)

- «A partir del día» es el primer día hábil de la licencia, y el singular sale con un solo día hábil (sección 2).
- Una licencia de días sin ningún día hábil (por un feriado cargado después) no tiene nota: 409 con un mensaje que dice qué hacer (secciones 2 y 5).
- «media hora» y «una hora y media» concuerdan en singular («correspondiente») (sección 2).
- Un armado propio y chico del Word, en lugar de extender `renderDocx` (sección 4).
- Una corrección que no cambia nada no mueve la fecha de la nota (sección 2).
- Sin cargo cargado, la firma lleva solo el nombre (sección 2).
- Una persona sin modalidad también arma la nota (sección 4).
- `GET …/nota` trae la fila, así el segundo paso no depende de la lista (sección 5).
- La descarga usa un `fetch` propio y toma el nombre del `Content-Disposition`; la lista no cambia (secciones 5 y 6).
- En el segundo paso, los avisos de una corrección van en el modal, no en el aviso flotante; el foco, a «Descargar Word», y al cerrar, adonde va hoy después de guardar (sección 6).
- El uso autorizado responde 404 «Esta licencia no tiene nota.» (sección 5).

## Lo que queda para quien lo construya

- Los nombres internos, salvo los de la API y los módulos de las secciones 4 y 5.
- El CSS fino del segundo paso, partiendo del de la maqueta (`css/maqueta.css`).
- La cuenta exacta de los días hábiles, con la función que ya usa la lista.
- Actualizar el `CLAUDE.md` con la función.
