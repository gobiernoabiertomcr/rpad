# Seguimiento del dataset

El registro de los movimientos de un dataset: ciclos, avisos, cinta, PDF y la página.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-20-seguimiento-dataset-design.md`
- `docs/superpowers/specs/2026-10-20-requiere-nota-y-anexo-reiteracion-design.md`
- `docs/superpowers/specs/2026-10-24-reiteracion-en-su-anexo-design.md`

## Archivos

seguimientoReglas (movimientos, ciclos y avisos, puro), seguimientoCinta (la cinta como datos, pura), seguimientoDatos (las consultas, solo lectura) y seguimientoPdf (el PDF de una hoja, o de N hojas para un anexo);

## Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset)

- Qué es:
  Herramientas → Seguimiento (`seguimiento.html` + `js/seguimiento.js`, una de las 14 páginas con carcasa; sin `publico.css`, sin `aria-current`, con su `<style>`).
  Para todos los roles con sesión (el lector también; sin sesión, al login).
  Es el registro de todos los movimientos de un dataset y la prueba de cada vez que el RPAD avisó que había que pedir la información.
  Muestra lo que registró el sistema y las notas DGMIT, lo único que se carga a mano, desde esta misma página (administración y el colaborador; la decisión de la spec del Seguimiento de no cargar nada a mano se revirtió el 24/10/2026: ver «Notas DGMIT»).
  Todo lo demás es de solo lectura.
- Pantallas: sin `id`, la lista "Sin elegir" (todos los datasets, activos y dados de baja; buscador por título o área; filtros por estado como botones con cantidad:
  Vencidos —el inicial—, Próximos a vencer, Actualizados, Eventuales, Sin fecha y Dados de baja —estos dos solo si hay— y Todos —solo los activos: los dados de baja están en su botón—; los vencidos por días de vencido, el resto por vencimiento; la columna "Última nota DGMIT al área"; cada fila abre `?id=N`).
  Con `?id=N`: ficha (insignia, área, "Requiere nota DGMIT" en un externo, "Descargar PDF", "Ver en el portal" solo con URL http/https), avisos del ciclo abierto (el circuito dibujado), la cinta de los últimos 12 meses y los movimientos (filtros por tipo con cantidad, filas que se despliegan, hitos de vencimiento entre las filas, 10 primero y tandas de 20, y la aclaración fija de desde cuándo hay registro).
  "Descargar la nota y su anexo" en una nota (aviso o reiteración; las reiteraciones anteriores al anexo no lo tienen) lo ve solo administración (usa los endpoints `adminOnly` de siempre).
  También se llega desde Gestión de Datasets (`admin.html`): cada fila suma el ícono "Ver seguimiento" (`htmlDeAcciones` de `admin-fechas.js`; no se bloquea con un cambio pendiente: ver no cambia nada).
  Estados de la página como `dataset-detail.js` (cargando, no encontrado —los dados de baja sí existen— y error, cada uno con su `h2`: la página conserva su `h1` "Seguimiento de datasets").
- El circuito que cuenta: el RPAD no le pide los datos al área.
  Gestión externa: el RPAD avisa a DGMIT y a la Dirección Administrativa (por email hasta el 12/10/2026; desde el 13/10/2026, por Nota Digital), ellas mandan la nota formal al área por fuera del RPAD (solo queda si alguien la carga como nota DGMIT: ver «Notas DGMIT») y a los 40 días el RPAD le manda al área un email que anticipa la nota formal (`area-aviso-40`).
  Gestión interna: el RPAD avisa a DGMIT y a la Dirección de Investigación Territorial, que hacen el relevamiento por fuera; no hay email al área.
  Los siete tipos de email retirados (`externo-60/40/5/vencido`, `interno-60/30/vencido`) son "Email a DGMIT: <qué pedía>" (`QUE_PEDIA`; el asunto original, `ASUNTOS_EMAIL`, solo en el detalle), nunca "recordatorio interno"; las notas son "Nota Digital a DGMIT";
  `area-aviso-40`, "Email al área: anticipo de la nota formal".
  Antiobjetivo: presentar como pedido al área algo que no lo fue.
- Requiere nota DGMIT en el Seguimiento (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7):
  `fuentesDe` y `aDataset` traen `requiere_nota` y `fichaDe` lo devuelve (`ficha.requiere_nota`: 1, 0 o null; null en gestión interna).
  La ficha de un externo suma "Requiere nota DGMIT:
  Sí / No / Sin dato" (en el PDF, "Datos que se piden" comparte el renglón con este dato:
  `celdasDelPedido`); la interna no cambia.
  Circuito de un externo con "No" y sin nota DGMIT en el ciclo abierto (`circuitoDe`; con una nota, se muestra la nota: ver «Notas DGMIT»): el recuadro del medio sigue diciendo "DGMIT y Dirección Administrativa", con el rol "No hace falta nota formal"; el tramo punteado se titula "Sin nota formal", con el texto "Los datos se obtienen de la fuente";
  y `alArea` es null (el renglón "Al área" no se dibuja), salvo que en el ciclo abierto el RPAD ya le haya mandado al área el email de los 40 días (el dataset estaba en "Sí" y pasó a "No"): ese email existió y se muestra con sus fechas.
  Con "No" nunca aparece "todavía no se le envió el email que anticipa la nota formal".
  Con "Sí" o sin dato, todo como siempre.
  En los movimientos, un cambio dice "Cambió: requiere nota DGMIT" y el valor vacío es "—" (no "Sin dato": ese es solo de la ficha).
- Lenguaje neutro (pedido del usuario): el atraso muchas veces no depende del área sino de que no se mandó la nota formal.
  Se describe el estado del dataset:
  "Vencido hace N días", "Estuvo vencido N días", "Venció", "Actualizado el dd/mm/aaaa, N días después del vencimiento".
  Nunca "sin entregar", "sin respuesta del área" ni "atrasado" en el Seguimiento.
  La insignia de los dos estados vencidos (atrasado y sin respuesta) dice "Vencido" solo acá (`estadoDeSeguimiento`:
  `vencido`, y `baja` para un dado de baja); en el resto del sitio siguen "Atrasado" y "Sin respuesta del área".
- Una sola fuente de las reglas:
  `services/seguimientoReglas.js`, puro (sin pool ni `Date` local; fechas `'AAAA-MM-DD'`, momentos `'AAAA-MM-DD HH:MM:SS'` en hora argentina; ninguna función tira error).
  `movimientosDe`, `ciclosDe`, `cicloDelAviso`, `avisosDelCiclo`, `ultimoAviso`, `notaDgmitDelCiclo`, `hitosDe`, `estadoDeSeguimiento`, `circuitoDe`, `unirAlta`, `nombreCorto`, `seguimientoDe(fuentes, hoy, opcionesCinta, opciones)` (todo lo de un dataset:
  `{ ficha, circuito, cinta, movimientos, hitos, registro }`;
  `opciones` son las de `circuitoDe`, `{ anexo: true }` en el anexo de la reiteración), `resumenParaLista`, `sinErroresTecnicos`, `conNotasDgmitEditables`, `nombreDelPdf` y `disposicionDeAdjunto`.
  La pantalla y el PDF dibujan lo que calcula el servidor: el navegador no recalcula nada.
- Fuentes (`services/seguimientoDatos.js`, `fuentesDe(ids|null)`, solo lectura, consultas parametrizadas):
  `cambios_pendientes` (alta, actualización registrada, cambio en la ficha, propuesta rechazada o pendiente, baja), `historial_actualizaciones` (solo las filas sin `cambio_id`, de diciembre de 2025: las demás son el cambio; las repetidas del mismo día se muestran una vez y cortan el ciclo una sola vez), `notificaciones_log` (por `datasets_ids`) y `notas_digitales` + `notas_digitales_datasets` (aviso y reiteración, sin `es_prueba`;
  también las pendientes y fallidas, que se muestran con su estado y no cuentan como aviso) + `notas_digitales_cambios` (las notas de auditoría), y las notas DGMIT (`notas_dgmit` y sus dos tablas, en una consulta aislada: ver «Notas DGMIT»).
  Desde «Métricas y Reportes», también lo importado de `actualizaciones_recibido` (el «Recibido el» y el origen de las actualizaciones viejas: completan `nuevos` del cambio solo donde el cambio no trae el valor, `conImportado`, en otra consulta aislada, `importadosDe`: si falla, los cambios salen como siempre) y `dataset.tema_principal` (el nombre del tema principal); lo que ya devolvía no cambió.
  TIMESTAMP (`created_at`, `revisado_at`, `enviado_at`) en UTC, pasados a hora argentina con `UNIX_TIMESTAMP` y `ahoraArgentina`;
  `notas_digitales.fecha` es DATE y `enviada_at` ya está en hora argentina.
  Los `crear` aprobados quedan con `dataset_id` NULL: se unen al dataset al leer, por el título de `datos_nuevos` y por `revisado_at` a 5 segundos o menos de `datasets.created_at` (si el título cambió después, solo por la hora); no se toca `aprobarCambio`.
  Las fechas viejas de `datos_anteriores` (`2025-07-31T03:00:00.000Z`) se normalizan a `AAAA-MM-DD`.
  El área del email al área es la del momento del envío (`notificaciones_log.area_id`), no la actual.
  Nombres en "nombre y apellido corto" (`nombreCorto`: el primer nombre y el último apellido; con dos palabras o menos, completo).
- Ciclos (`ciclosDe`): un ciclo es el tiempo en que rige un vencimiento, reconstruido con los cambios `editar` aprobados y las actualizaciones anteriores a la doble verificación (filas de `historial_actualizaciones` sin `cambio_id`, una por día), en el orden en que pasaron (`revisado_at` y `created_at`).
  Un cambio que mueve la próxima y "Cargado en el portal" es una actualización y cierra el ciclo (para el atraso, en la fecha de la carga; para asignar avisos, el ciclo rige en el RPAD hasta la aprobación).
  Uno que solo mueve la próxima es una reprogramación: antes del vencimiento sigue dentro del mismo ciclo; aprobada después del vencimiento, cierra el ciclo como `reprogramacion` (estuvo vencido hasta la aprobación).
  Uno que solo cambia "Cargado en el portal" es una carga dentro del ciclo y no lo cierra.
  Cada cambio se mide contra su propia próxima anterior (`datos_anteriores.proxima_actualizacion`): una próxima corregida por SQL entre dos cambios no deja el ciclo con la fecha vieja.
  El ciclo abierto vence siempre en la próxima actual del dataset (si una corrección por SQL la cambió sin dejar un cambio, manda la actual).
  Eventual (frecuencia sin meses) y sin fecha no tienen ciclos; los dados de baja terminan en la baja.
  Cuánto estuvo vencido: carga menos vencimiento (actualización), aprobación menos vencimiento (reprogramación), hoy menos vencimiento (abierto).
  Una actualización anterior a la doble verificación (el botón de diciembre de 2025 movía la carga y la próxima en el momento) también cierra el ciclo, en su fecha: los avisos de antes no cuentan para el ciclo que abre.
  Una que después se deshizo por fuera del sistema (la carga que siguió —la anterior del primer cambio aprobado posterior que la trae, o la de hoy— es anterior a ella; pasó con la tanda del 17/12/2025 en 8 datasets) no cuenta: no corta nada; sin ninguna carga posterior conocida, cuenta.
  El vencimiento inicial sale solo de los cambios de antes de la primera simple, y sin alta conocida lo de antes de la primera simple no es un ciclo.
  La próxima que cumplía no quedó guardada: si ningún cambio anterior la dice, el ciclo que cierra tiene `venc` null (sin días de vencido ni hito; en la cinta, un tramo sin "vence" ni rayado), y el vencimiento del que abre lo da la próxima anterior del cambio siguiente o la próxima actual.
  Cada ciclo lleva `origen` (`alta`, `actualizacion` o `reprogramacion`), y "Avisos del ciclo abierto" dice desde cuándo se cuentan (`circuito.desde`:
  "Desde la actualización del 16/12/2025 · Vencimiento del 30/11/2026"), en la pantalla y en el PDF.
  La lista "Sin elegir" cuenta los avisos del ciclo abierto y su "Último aviso" es el más reciente de ese mismo ciclo (`avisosDelCiclo(...).ultimo`;
  "—" si no hubo).
- Avisos de un ciclo (`avisosDelCiclo`): una Nota Digital pertenece al ciclo cuyo vencimiento es el `notas_digitales_datasets.vencimiento` de la nota (si ninguno lo tiene, al que regía en el RPAD al enviarse); un email, al ciclo que regía al enviarse (`enviado_at` contra los momentos que abren y cierran cada ciclo: las aprobaciones y el registro de las actualizaciones simples).
  Cuentan solo los emails a DGMIT con `success` y las notas `enviada` de tipo aviso o reiteración; los emails al área se cuentan aparte con la misma regla; las notas de auditoría no son avisos de ningún ciclo (tratan de un cambio, no del pedido de datos).
  Quedan afuera las notas de prueba y la prueba del email al área.
  Los emails duplicados por corridas manuales se muestran los dos (se enviaron de verdad).
- La cinta (`services/seguimientoCinta.js`, `ventanaDe`, `cintaDe`; pura): los 12 meses que terminan en el mes de hoy (`hoyArgentina()`), en un espacio de 1000 de ancho con la línea útil de x = 30 a x = 970 (x = 30 + (d + 0,5 − inicio) / días de la ventana × 940; los días se cuentan como texto, sin `Date` local).
  Devuelve `{ meses, tramos, textos, vencimientos, marcas, hoy }`; la pantalla la dibuja en SVG y el PDF con PDFKit, con los mismos números.
  Tres filas de marcas: arriba las notas y los emails a DGMIT, sobre la banda el alta, las actualizaciones, los cambios en la ficha y sus pendientes, y abajo las notas DGMIT sin anular, los emails al área y las propuestas rechazadas.
  En una fila, las marcas a menos de 11 unidades (12 en el PDF) se juntan en una con la cantidad, y se dibuja la de más prioridad (nota, email, actualización, actualización pendiente, cambio, cambio pendiente, alta, nota DGMIT, rechazo, email al área).
  Los textos de la banda ("Vencido hace N días", "Estuvo vencido N días", "Vencido desde el dd/mm/aaaa (hace N días)", "Frecuencia eventual: sin vencimiento", "Sin fecha de próxima actualización", "Todavía no estaba en el RPAD") van en el hueco libre más grande entre las marcas; si no entra, no va.
  En el teléfono la cinta conserva su ancho mínimo (unos 640 px) dentro de un contenedor con desplazamiento horizontal: el resto de la página no se desplaza de costado.
- El PDF (`services/seguimientoPdf.js`, `renderSeguimiento`):
  A4, una hoja por dataset (nunca pasa a una segunda: las secciones tienen lugar fijo y se completan solas), con el lenguaje del ANEXO:
  `COLOR`, Helvetica, márgenes de 15 mm, `DocumentoNota` y el QR vectorial.
  Reutiliza ayudantes de `services/notasDigitalesAnexo.js` (`COLOR`, `renglon`, `prepararGrilla`, `dibujarTarjetaQr`, `cargarQrcode`, …) a los que solo se les agregó `export`: el ANEXO dibuja lo mismo.
  Secciones: encabezado, etiqueta y título (dos líneas), ficha con QR, avisos del ciclo abierto, la cinta (la del PDF, con `{ separacion: 12, letra: 8.4 }`; las etiquetas de las notas que se pisan van juntas, también cuando un grupo al crecer alcanza al anterior, y un grupo más ancho que la hoja saca etiquetas del medio:
  `dibujarEtiquetasDeNotas`) con su leyenda (solo los tipos que aparecen), los últimos movimientos (`FILAS_PDF` = 8; los hitos no van: los muestra la cinta), la aclaración y el pie ("Generado el dd/mm/aaaa a las hh:mm por <nombre corto>", "Hoja 1 de 1").
  Se llama `Seguimiento - <título> - <AAAA-MM-DD>.pdf` y se descarga con `API.pedirArchivo` + `descargarBlob`.
  El mismo dibujante de hojas (`dibujarHojas`) arma el anexo de la reiteración:
  `renderAnexoDeSeguimiento(seguimientos, { hoy, generado, numeroTexto })` pone N hojas en un solo PDF, cada una con el pie "Anexo de la Nota Digital N° … · Hoja k de N" (`renderSeguimiento` sigue con "Seguimiento del dataset · Hoja 1 de 1").
  El reporte «Por área» suma la misma hoja de cada dataset con `dibujarHoja(doc, seguimiento, { hoy, generado, pie })` (exportada, con `await cargarQrcode()` antes), y la base de los reportes usa el encabezado, el pie y la cabeza de sección de acá (`dibujarEncabezado`, con su parámetro `derecha`;
  `dibujarPie`, `LINEA_DEL_PIE`, `dibujarCabezaDeSeccion`).
  `OPCIONES_CINTA_PDF` (`{ separacion: 12, letra: 8.4 }`) se exporta para que la descarga y el anexo calculen el Seguimiento igual.
  Si la lista de los avisos del ciclo abierto no entra en sus dos renglones, se sacan números de notas del medio, de a uno, hasta que entre ("11 emails y las Notas Digitales N° 2/26, …, 9/26 y 2/27"): siempre quedan la primera y las dos últimas, y el título, "N avisos", cuenta todos los avisos.
  Las versiones las arma `textosCortosDeAvisos` en `circuito.avisos.textosCortos` y `dibujarTramo` usa la primera que entra; si ninguna entra, la más corta, cortada al final con "…" (spec 2026-10-24-reiteracion-en-su-anexo; vale para la descarga y el anexo, y la pantalla no cambia).
- API (`controllers/seguimientoController.js`):
  `GET /api/seguimiento` (la lista de "Sin elegir"), `GET /api/seguimiento/:id` (todo lo de un dataset) y `GET /api/seguimiento/:id/pdf`.
  Con `authMiddleware` y sin `adminOnly`: los usa el lector (`tests/permisos.test.js`; sin sesión, 401).
  Un id que no es un entero positivo (`abc`, `0`, `-3`, `1.5`, `1e3`) o que no existe da 404 en JSON, nunca 500.
  El PDF responde con `Content-Disposition` armado por `disposicionDeAdjunto` (`filename` en ASCII y `filename*` en UTF-8).
  Respuestas `{ success, data }`.
  El texto técnico del error de un email que no se pudo enviar (`extra.error`) lo recibe solo administración (`esAdmin`); al resto, `sinErroresTecnicos` se lo deja en null y el detalle sigue diciendo "No se pudo enviar.".
  En cada nota DGMIT, `GET /api/seguimiento/:id` dice si quien mira puede corregirla o anularla (`conNotasDgmitEditables`: ver «Notas DGMIT»).
- Registro: los envíos quedan registrados desde el 06/12/2025 y los cambios desde el 26/01/2026 (`REGISTRO_DESDE`); antes no hay registro y no se reconstruye (ediciones directas anteriores, cargas por SQL).
  Una aclaración fija lo dice en la pantalla y en el PDF, para que un dataset sin registros no parezca "sin movimientos".
- Tests:
  `tests/seguimiento-reglas.test.js`, `seguimiento-cinta.test.js`, `seguimiento-pdf.test.js` y `seguimiento-frontend.test.js` (puros, sin base) corren sobre `tests/seguimiento-casos.js`, casos reales del dump del 20/10/2026 con los nombres de las personas y los correos cambiados (`CASOS`, `CATALOGOS`, `HOY_DE_LOS_CASOS`);
  `seguimiento-datos.test.js` y `seguimiento-api.test.js` usan una base de prueba propia (necesitan Docker).
  El PDF se prueba con `tests/pdf-lector.js` (una hoja, los textos, 8 renglones, el QR y que nada se pise).

## La página: seguimiento.js

- `seguimiento.js`: al cargarse solo declara (`tests/seguimiento-frontend.test.js` lo carga en un `vm`, con un `document` que no hace nada y el `api.js` de verdad).
  Lo que arma HTML (la lista de "Sin elegir", la ficha, el circuito, el SVG de la cinta, los movimientos, los hitos y el formulario de las notas DGMIT:
  `htmlDeOpcionesDeNota`, `htmlDeElegidos`, `textoDePistaDeSolicitud`, …) es puro y recibe quién mira por parámetro (`esAdmin`); lo que toca el DOM o la API va aparte, al final.
  Pide los datos con `API.pedirJson`, el PDF con `API.pedirArchivo` (JWT en el encabezado, nunca en la URL) y carga, corrige y anula notas DGMIT con `API.pedirJson` (POST y PUT;
  `api.js` no cambió).
  No recalcula nada: estado, ciclos, avisos, la nota DGMIT del ciclo, cinta (con sus x) y textos los manda el servidor.
  "Hoy" del formulario:
  `Utils.hoyEnArgentina()` (de `api.js`).
  Copias mínimas:
  `nombreDelPdf` (copia de `nombreDelPdf` de `services/seguimientoReglas.js`, atada por un test de paridad), `NOTA_SIN_ANEXO` (copia del mensaje de `descargarAnexo`; la ven las reiteraciones anteriores al anexo, que no lo tienen), `textoDeRequiereNota` (copia de `textoRequiereNota(valor, 'Sin dato')`, atada por un test de paridad: la ficha de un externo dice Sí, No o Sin dato) y lo de las notas DGMIT (ver «Notas DGMIT»):
  `TIPOS_NOTA_DGMIT` y `TIPOS_NOTA_DGMIT_LARGOS` (copia de `TEXTO_TIPO_NOTA_DGMIT` de `services/notasDgmitReglas.js`; el largo empieza con el corto), `MENSAJES_NOTA_DGMIT`, `LARGO_NUMERO_NOTA_DGMIT`, `LARGO_MOTIVO_NOTA_DGMIT` y `FECHA_MINIMA_NOTA_DGMIT` (copias de `MENSAJES_NOTA_DGMIT`, `LARGO_NUMERO`, `LARGO_MOTIVO` y `FECHA_MINIMA`) y `erroresDelFormularioDeNota` (la validación de `validarNotaDgmit` y, al corregir, de `validarMotivo`;
  cuenta caracteres con `Array.from`, como el servidor), todas atadas por tests de paridad;
  `datasetsParaElegir` (los que se pueden elegir, como `sePuedeElegir` de `services/notasDgmitReglas.js`) y `esFechaDeTexto` (copia de `esFechaIso`) solo tienen tests de comportamiento.
  `ESTADOS_DE_NOTA` (el estado de una Nota Digital en su detalle) es copia de `ESTADO_DE_NOTA` de `services/seguimientoReglas.js`, atada por un test de paridad (la usa también el reporte «Avisos del RPAD»).
  Con `seguimiento.html?id=N#cargar-nota` (el link «Cargar nota DGMIT» de «Para completar», en Métricas) abre el formulario con ese dataset elegido, solo para quien puede cargar (`abreLaCargaPorElHash`, el `true` literal), y saca el hash de la dirección (`history.replaceState`).

## Archivos de tests

`seguimiento-frontend.test.js`, `permisos.test.js`, `seguimiento-reglas.test.js`, `seguimiento-cinta.test.js`, `seguimiento-pdf.test.js`, `seguimiento-datos.test.js`, `seguimiento-api.test.js`
