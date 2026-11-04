# Plan: firma digital de las Notas Digitales

Spec: `docs/superpowers/specs/2026-11-03-notas-firma-digital-design.md`. Maqueta aprobada: `…-mockups/`.

**Va tercera en la fila**, después de Contacto y de la reiteración bimestral, que toca este mismo motor. Las líneas de este plan son
de 3949aae y hay que volver a ubicarlas.

**Modelos:** todas las tareas son con Opus (Extra), salvo la 6: tocan la migración, la corrida, las notas, la API que escribe y un
formulario. La 6 es solo de textos, con Sonnet (Alto): no cambia la lógica, y sus copias están atadas por tests. Cada tarea se
revisa con Opus (Extra). La revisión final, también.

**En cada tarea:** `npm test` completo (si le toca a esta sesión), commit y push de la rama. Antes de cada commit, buscar en el diff
los usernames y nombres de la tabla `usuarios`.

## Task 0: Traer el main y ajustar el plan

- Traer main, volver a escanear `services/notasDigitales.js` (lo que dejó la reiteración bimestral: `correrPasos`, las marcas y si cambió
  algo de `enviar`), y ajustar este plan.
- Revisar con el nuevo main la sección 3 de la spec: si la reiteración cambió cómo se cuentan los días o se generan las notas, ¿sigue
  siendo cierto que todo sale el mismo día?
- Copiar `.env`, usar una base propia `rpad_rama_firma` si conviene y correr la suite para la línea de base.

## Task 1: Migración

**Archivos:** `database/updates/migracion-notas-firma-digital.sql`, `rollback-notas-firma-digital.sql`, `database/schema.sql`,
`tests/schema.test.js`.

- Las columnas de la sección 8 de la spec, con `ADD COLUMN IF NOT EXISTS` y cada una con su `AFTER`: en `notas_digitales`, después de `presentada_por_id`; en
  la configuración, después de `envio_activo`. La FK con un nombre fijo, repetible (como lo hacen las migraciones anteriores: mirar cómo resuelven una FK repetible).
- Cabecera con la spec, «solo agrega», el orden y qué se pierde con la vuelta atrás. Verificación comentada al final.
- Sumar a `schema.sql`, en el mismo orden.
- **Test:** las columnas; la migración dos veces desde la estructura de main; la vuelta atrás dos veces; y que el código anterior anda con
  la estructura nueva (ninguna columna obligatoria sin valor por defecto).
- Aplicarla a la base local recién al mergear, con respaldo en `~/rpad-respaldos/`. Antes, sobre la base propia de la rama.

## Task 2: La verificación

**Archivos:** `services/notasFirmaDigital.js`, `tests/notas-firma-digital.test.js`, `tests/fixtures/firma-digital/` (dos notas originales, sus firmadas y
`generar.mjs`).

**Las fixtures:** `generar.mjs` (se corre una sola vez, a mano; los tests no lo llaman) arma con PDFKit dos PDF con texto inventado, un certificado
autofirmado con `openssl` (`CN=Julieta Ferreyra`, `serialNumber=CUIL 00000000000`) en una carpeta temporal, y agrega la firma como la agrega el
Firmador: una actualización incremental con `/Type/Sig`, `/Filter/Adobe.PPKLite`, `/SubFilter/adbe.pkcs7.detached`, `/ByteRange`, `/Contents` de 30000
hexadecimales y un widget con `/Rect [0 0 0 0]`, y el CMS de `openssl cms -sign -binary -outform DER -nodetach` sin contenido (detached), SHA-256. **La clave privada no se
guarda en ningún lado.** Comparar la forma con una nota real (solo en local) antes de commitear.

**La API del módulo** (puro; nunca tira; lo que no se pudo leer es un resultado):
```js
// El PDF subido, contra las notas candidatas [{ id, numero, anio, pdf, estado, espera_firma }]
export const verificarNotaFirmada = (subido, notas) => ({
  resultado: 'firmada' | 'sin_firma' | 'firma_invalida' | 'ya_salio' | 'otra',
  nota,                  // la que empieza con los mismos bytes, o null
  firmado_por, firmado_at // solo con 'firmada'
});
export const leerFirmaAgregada = (subido, largoDelOriginal) => /* { ok, firmado_por, firmado_at } | { ok: false, motivo } */;
export const conLineaDeFirma = ({ html, texto }, nombre) => /* { html, texto } */;
export const textoDeLaLineaDeFirma = (nombre) => `La nota está firmada digitalmente por ${nombre}.`;
export const debeEsperarFirma = ({ activa, esPrueba, ahora, quienFirma }) => /* boolean */;
export const HORA_LIMITE_DE_FIRMA = '14:00';
```
- El orden: identificar por prefijo (`Buffer.equals` sobre `subarray`, el más largo primero no hace falta: dos notas nunca empiezan igual, porque
  llevan su fecha de creación y su número). Igual largo o sin nada agregado: `sin_firma`. Una nota con `estado` `enviada`: `ya_salio`.
- Un lector de DER chico, solo con largos definidos, que rechaza lo que se sale del buffer. Lee `SignedData`: `digestAlgorithms`, `certificates` (el primero), `signerInfos`,
  `signedAttrs`, `messageDigest`, `signingTime` (UTCTime o GeneralizedTime) y la firma. Para verificar, los `signedAttrs` se vuelven a etiquetar con SET (0x31), como manda CMS, y se usa
  `crypto.createVerify` con la clave de `new X509Certificate(der)`. Sin `signedAttrs`: `firma_invalida`.
- `firmado_at`: el `signingTime` pasado a hora argentina, `'AAAA-MM-DD HH:MM:SS'`. Sin él, null.
- `firmado_por`: el `CN` del `subject`, tal cual; sin él, `firma_invalida`. Se recorta a 255.
- `debeEsperarFirma` usa `ahora` como texto (`'AAAA-MM-DD HH:MM:SS'`), solo el `true` literal de `activa` o el 1 de la base.

**Tests, puros, sobre las fixtures:**
- La firmada de A contra A y B: `firmada`, A, con el nombre y la fecha. Con la lista al revés, igual.
- El PDF original tal cual: `sin_firma`. Otro PDF: `otra`. Vacío, null, un texto: `otra`, sin tirar.
- Un byte cambiado: en lo original (`otra`), en lo agregado dentro de los rangos (`firma_invalida`) y en el CMS (`firma_invalida`). Un `/ByteRange` que no llega al final, uno que
  empieza después de 0, uno que corta dentro del original: `firma_invalida`. Bytes agregados después de la firma: `firma_invalida`. Sin `/ByteRange`: `sin_firma`. El DER cortado: `firma_invalida`.
- `ya_salio`.
- `conLineaDeFirma`: va después del primer `</p>` y del primer renglón; escapa `<b>"x"</b>` en el HTML y no en el texto; contra el HTML real de `renderHtml` (`notas-digitales-word`: `bloquesDeNotaDigital` sobre el HTML guardado sigue igual, porque no se guarda).
- `debeEsperarFirma` en sus bordes: 13:59:59 sí y 14:00:00 no.

## Task 3: La corrida

**Archivos:** `services/notasDigitales.js`, `services/emailTemplates.js`, `controllers/notificacionesController.js`, `tests/notas-firma-digital-motor.test.js` (Docker, base propia), `tests/email-diseno.test.js` y `emails-fixtures.js`.

- `ejecutarNotasDigitales` suma el parámetro `ahora = ahoraArgentina()`, que llega a `correrPasos`. `resumen` suma `para_firmar: []`.
- En `correrPasos`, los cuatro `await enviar(id, …)` que siguen a un `generarNota` (autorización, aviso, reiteración y auditoría; **no** el de los reintentos) pasan a `enviarOEsperar`:
  ```js
  const enviarOEsperar = async (id, contexto) => {
    const persona = config.firma_digital_activa ? await quienFirmaLaNota(id, hoy) : null;
    if (debeEsperarFirma({ activa: config.firma_digital_activa, ahora, quienFirma: persona })) {
      await pool.query('UPDATE notas_digitales SET espera_firma = 1 WHERE id = ?', [id]);
      resumen.para_firmar.push({ id, persona });
      return;
    }
    await enviar(id, contexto);
  };
  ```
  Si se corta entre generar y marcar, la nota queda como una `pendiente` común y sale al otro día. Es lo más seguro. Un error de `quienFirmaLaNota` no frena: se anota y la nota se envía.
- `quienFirmaLaNota(id, hoy)`: `presentada_por_id ?? firmante_id`; null si no hay, si está inactiva, si `emailValido` falla o si tiene una licencia sin anular que incluye hoy. Devuelve `{ id, nombre, email }`.
- Reintentos (hoy, línea 517): suma `AND NOT (espera_firma = 1 AND fecha = ?)`.
- `enviarNota`: el SELECT trae `pdf_firmado` y `firmado_por`. Adjunta `pdf_firmado ?? pdf`, con el mismo nombre. Con `pdf_firmado`, `conLineaDeFirma`. Los dos `UPDATE` suman `espera_firma = 0`.
- `avisarLasQueEsperan(resumen)`, dentro del candado y **después de `correrPasos`, también si cortó antes de terminar** (va en `ejecutarNotasDigitales`, antes de `registrarFin`): agrupa por persona, lee los `pdf`, manda con `sendEmail` y `to: [email]`. Un error (`success: false` o una excepción), `anotarError` con `{ tipo: 'para-firmar', id }`, sin direcciones.
- `textoResultado` suma `, N para firmar` solo si hay.
- `notasParaFirmarTemplate({ nombre, notas, url })` en `emailTemplates.js`, con `plantillaSimple`, y texto plano. Los textos, los de `mail-firmante.html`, en singular y en plural. El primer nombre sale del `nombre_completo` (la primera palabra).
- `enviarLasQueEsperanFirma({ hoy, calendario })` (spec 4.9): sale sin hacer nada si el día no es hábil o si el envío automático está apagado; bajo `conBloqueo`; da `{ ocupado, enviadas, fallidas, errores }`. La llama `ejecutarNotificacionCambiosPendientes` **antes** de `enviarCambiosPendientes`, en un `try/catch` propio; los errores van con `anotarEnLaUltimaCorrida` y a `data.firma_digital`, y la respuesta es 207 si hubo errores. El mensaje de esa corrida no cambia si no hay nada.

**Tests (fecha y hora fijas, función llamada directo, nunca `/api/cron/*`, Mailpit filtrado por casillas de prueba):**
- Interruptor apagado: la corrida es igual a la de antes (las de `notas-motor` no se tocan y siguen verdes).
- Prendido, a las 8:05: la nota queda `pendiente` con `espera_firma` 1, no hay email a los destinatarios, sí al firmante, con los adjuntos iguales byte a byte al `pdf`. Un solo mail con dos notas. Las cuatro clases.
- Sin quien firme, para cada caso (sin titular, inactivo, sin email, de licencia), y con la corrida después de las 14:00: sale como hoy. Una nota de prueba, también.
- Una corrida repetida no reenvía la que espera ni repite el mail.
- A la mañana siguiente, una que esperaba de ayer sale con la imagen.
- 14:00: salen las que esperan, con `espera_firma` 0 y la nota sin la línea; primero las notas y después los recordatorios; día no hábil o envío apagado, nada; con el candado ocupado, nada y sin error.
- El mail que falla: la nota sigue esperando y el error queda en la última corrida.
- Licencia del titular con persona autorizada: firma ella, y el mail le llega a ella. La víspera: firma el titular. Las dos firmas y la leyenda siguen en el PDF.
- La auditoría: los cambios en la nota que espera siguen fuera del recordatorio, y la nota sale a las 14:00 a más tardar.

## Task 4: La API

**Archivos:** `routes/index.js`, `controllers/notasDigitalesController.js`, `services/notasDigitales.js`, `config/upload.js` (el multer en memoria), `tests/notas-firma-digital-api.test.js` (Docker), `tests/permisos.test.js`, `tests/notas-api.test.js`.

- `subirNotasFirmadas({ archivos, usuarioId })` en el servicio, con `conBloqueo`: lee las candidatas (las que esperan, y las notas de hoy para decir «ya salió»), `verificarNotaFirmada` por archivo y, con `firmada`, guarda (`pdf_firmado`, `firmado_por`, `firmado_at`, `firma_subida_por`) en un `UPDATE … WHERE id = ? AND espera_firma = 1` (si no cambió ninguna fila, `ya_salio`). **No envía.** Ninguna falla de un archivo frena a los demás. Arma los mensajes de la tabla de la spec 4.5.
- `enviarNotasFirmadas({ ids })`, con `conBloqueo`: de esa lista, las que siguen con `espera_firma = 1` y `pdf_firmado`, llama a `enviarNota`. Da un resultado por nota.
- Ruta `POST /notificaciones/notas-digitales/firmadas`, antes de las que llevan `:id`, con `authMiddleware`, `adminOnly` y `subidaEnMemoria` (`multer.memoryStorage()`, 10 archivos de 10 MB; el nombre con `nombreOriginal`, exportado). Los errores de multer, 400 en español; sin archivos, 400 «Elegí al menos un PDF.». Ocupado, 409 «Hay una corrida de Notas Digitales en curso. Probá de nuevo en unos minutos.». Si no, 200 `{ success: true, data: { resultados: [{ archivo, nota_id, ok, mensaje }] }, message }`, también con todos mal.
- Ruta `POST /notificaciones/notas-digitales/firmadas/enviar`, también antes de las de `:id`, con los mismos permisos: `{ ids }` con `idsPositivos`; una lista vacía o que no sirve, 400; ocupado, 409; si no, 200 con `resultados: [{ nota_id, ok, mensaje }]`.
- `listarNotas` y `obtenerNota` suman `espera_firma` (booleano), `firmado_por` y `firmado_at`. **Nunca** `pdf_firmado` en una lista.
- `descargarPdf`: `pdf_firmado ?? pdf`. El nombre, igual.
- `reintentarNota`: 409 con `espera_firma` (spec 4.11).
- `guardarConfig` y `configPublica`: `firma_digital_activa`, con los mismos valores que `envio_activo`; las columnas siguen saliendo de una lista fija.
- `estadoNotas`: `firma_digital_activa` y `para_firmar: [{ id, numero, anio, tipo, gestion, firma_nombre }]`, y la alerta `para-firmar` (advertencia) al principio de las del servidor.

**Tests:** cada fila de la tabla de la spec 4.5; varios archivos con un resultado cada uno, también `document.pdf` repetido; **subir no envía nada** (Mailpit vacío para esa nota, `estado` `pendiente`, `espera_firma` 1); subir de nuevo reemplaza; subida y sin confirmar, a las 14:00 sale firmada con la línea; `enviar` solo manda las de `ids`, firmadas y que esperan (una sin firmar, una ya enviada o de otra lista, no), y dos veces no la manda dos veces; el email lleva el firmado, con el nombre de siempre y la línea, y `pdf` queda igual; `firma_subida_por`; el SMTP que falla (queda `fallida`, con el firmado; «Reintentar» y la corrida siguiente lo mandan firmado); los límites de multer; `RUTAS_SOLO_ADMIN` (lector y colaborador, 403; sin sesión, 401; el editor, sí); la lista sin los bytes; «PDF» de una firmada; el 409 de «Reintentar»; el interruptor; el Estado con y sin notas para firmar.

## Task 5: La pantalla

**Archivos:** `public/correos.html`, `public/js/correos.js`, `tests/correos-frontend.test.js`, `tests/paginas.test.js`.

- Lo puro, testeable en el `vm`: `htmlDeParaFirmar(notas)`, `htmlDeLasSubidas(resultados)`, `textoDeLaFirma(n)`, `textoDelBotonDeEnviar(n)`, y `filaDelLibro` con «Para firmar» o «Firmada, sin enviar», sin «Reintentar» y con «Firmada digitalmente por X». Todo texto del servidor con `Utils.escapeHtml`.
- Lo del DOM: `#nd-para-firmar` arriba de los filtros, dibujado desde `cargarEstado`, con un `<input type="file" multiple accept="application/pdf">` oculto detrás del botón; `#nd-subidas` con `role="status"`; `subirFirmadas(archivos)`, un `fetch` POST propio con `FormData` y `Auth.getAuthHeaders()` sin `Content-Type`, como `proyectos.js` (con un 401, al login; `api.js` no cambia). El botón deshabilitado mientras sube; un 409 o un error, con `avisar`. Después, `cargarLibro` y `cargarEstado`; el foco queda en el botón. «Bajar PDF» con `API.getNotaPdf` y `descargarBlob`. `#nd-enviar-firmadas`, con el POST de los ids que muestra la tarjeta. «Ver»: `#modal-firmada` (`.modal-overlay`, `aria-modal`, foco, Escape), con `API.getNotaPdf`, `URL.createObjectURL` en un `<iframe>` (se revoca al cerrar), la línea de la firma, «Descargar» y «Cerrar». `estado.para_firmar` suma `firmado_por` y `firmado_at`.
- El interruptor debajo de «Envío automático», con `cambiarFirmaDigital` y una confirmación al prender (`pedirConfirmacion`: «Desde la próxima corrida, las notas esperan hasta las 14:00 a que las suban firmadas.»). Si la activación falla, vuelve atrás.
- `ETIQUETAS` no cambia: «Para firmar» lo dice la fila.
- Estilos en el `<style>` de `correos.html`, con los tokens `--pf-*` de la página y las medidas de la maqueta, sin ningún nombre que empiece con `ad-`.
- `VERSION_CORREOS` sube.

**Tests:** cada función pura con su escapado (`<b>"x"</b>`); con un DOM y un `fetch` falsos: la tarjeta solo con notas, subir, el botón deshabilitado, los resultados en la región y sin escribirlos dos veces, «Enviar las N» solo con firmadas y con los ids de la pantalla, el doble clic que manda un solo pedido, «Ver» con el `blob:` que se revoca, el 401 y el 409, «Reintentar» que no aparece, el interruptor que vuelve atrás; y en `paginas.test.js`, los ids nuevos, el `role="status"` y la versión.

## Task 6: La hora en los textos (Sonnet)

**Archivos:** los de la spec, sección 5, y sus tests. `VERSION_PANTALLAS` y `VERSION_MI_ESPACIO` suben. `efectoEnNotas` en `usuarios.js` y `mi-espacio.js` sigue con su paridad. Buscar `8:15` y `08:15` en `public/` y en los textos de `services/`; los comentarios no se tocan.

## Task 7: La simulación (obligatoria)

Con una copia de la base local (recargada con el último dump de producción si hay uno más nuevo), `rpad_sim_firma`, y el SMTP de Mailpit con una etiqueta. Controladores llamados por su función, con reloj falso, **nunca** `/api/cron/*` y nunca dos simulaciones a la vez (`GET_LOCK` es de todo el servidor). Mirar `~/rpad-notas/dias-restituidos-simulacion-cierre.md`.

1. **Apagada:** dos meses de corridas, contra main sin esta rama: las mismas notas, con sus números, datasets, destinatarios y fechas.
2. **Prendida:** los mismos dos meses. Una parte se firma (con el certificado de prueba), se sube y se envía; otra se sube y no se confirma (sale firmada a las 14:00); otra no se sube (sale con la imagen a las 14:00). Las mismas notas, con sus números, el mismo día. Mirar Seguimiento, Métricas y el reporte de avisos.
3. **Licencia del titular con persona autorizada,** una auditoría y un feriado cargado a último momento.
4. **Con la nota real, solo en local y sin copiarla:** `verificarNotaFirmada(document.pdf, [Nota-Digital-7-26.pdf])` da `firmada`.
5. Cero intentos de red, cero errores. Dejar el cierre en `~/rpad-notas/firma-digital-simulacion-cierre.md`, sin nombres en el repo.

## Task 8: Docs, revisión, merge y kit

- `CLAUDE.md` y `README.md`: lo justo (Notas Digitales, la tabla, la ruta y la corrida de las 8:05; si ya se partió `CLAUDE.md`, en el documento que corresponda).
- Revisión final de toda la rama con Opus (Extra). Traer main, suite en verde, merge y push automáticos. Aplicar la migración a la base local, con respaldo.
- Kit `~/rpad-kits/RPAD-deploy-notas-firma-digital/` contra lo último desplegado (preguntarle a la coordinadora), con esta receta: comprobación con `?v=`, respaldo, migración antes del código, archivos, Restart, **mover la Tarea Cron de las 8:15 a las 8:05**, mirar Correos → Estado y dejar el interruptor apagado hasta que el usuario quiera probarlo. La primera prueba real la hace el usuario, con una nota del día. La vuelta atrás: los archivos anteriores, Restart, el rollback y la Tarea Cron a las 8:15 (o dejarla: no molesta).
- Reporte `TODO EN VERDE`, con el hash y la ruta del kit.
