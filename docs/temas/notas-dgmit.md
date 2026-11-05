# Notas DGMIT

La nota formal que la DGMIT le manda al área por fuera del RPAD: se registra acá y queda en el Seguimiento.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md`

## Archivos

notasDgmitController: cargar, corregir y anular notas DGMIT;
notasDgmitReglas (la validación de una nota DGMIT y de su motivo, pura).

## Notas DGMIT (spec 2026-10-24-notas-dgmit)

- Qué es: la nota formal que la DGMIT (con la Dirección Administrativa) le manda al área por fuera del RPAD.
  Acá solo se registra (número, día en que el área la recibió, tipo y datasets) y queda en el Seguimiento de cada dataset que pide.
  Revierte la decisión de la spec del Seguimiento de no cargar nada a mano (24/10/2026).
  No es un aviso del RPAD ni una Nota Digital (esa la manda el RPAD a la DGMIT): no cuenta en "Avisos del ciclo abierto" ni en la columna de avisos de la lista y no cambia `avisosDelCiclo`, `ultimoAviso`, `ciclosDe`, `hitosDe` ni el estado.
  No sale ningún email y no cambia ninguna Nota Digital.
  Gestión interna no tiene nota formal (el relevamiento sigue "por fuera del RPAD").
  Las tablas arrancan vacías; las notas anteriores se cargan a mano desde el Seguimiento (decisión del usuario, 25/10/2026): no hay SQL de importación.
  Antiobjetivo: que algo se lea como un reproche o un control sobre la DGMIT.
- Quién: carga el colaborador y administración (`puedeCargarNotasDgmit`; el middleware `cargaNotasDgmit` responde 403 "No tenés permiso para cargar notas DGMIT.").
  Corrige y anula quien la cargó (`creado_por`; si dejó de tener un rol que carga, el middleware la frena antes) o administración (si no, 403 "Solo quien cargó la nota o administración pueden corregirla o anularla.").
  Se guarda directo, sin doble verificación (no es un cambio a un dataset), y cada operación es una transacción (cabecera, datasets e historial juntos).
- El formulario (`#modal-nota` de `seguimiento.html`): lo abre "Cargar nota DGMIT" (`#sg-cargar-nota`, en el encabezado de la lista y de un dataset, visible solo con `Auth.puedeCargarNotasDgmit()`; desde un dataset abre con ese dataset elegido si se puede elegir).
  Campos, todos obligatorios: número (hasta 40 caracteres sin los espacios de los extremos, contados con `Array.from`), fecha de recepción (del 01/01/2025 a hoy), tipo (Solicitud o Reiteración) y datasets (varios; solo activos, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato; agrupados por área, con el estado de cada uno, un buscador sin tildes ni mayúsculas, los alcances "Vencidos y próximos a vencer" —el inicial;
  abre en "Todos" si el elegido no está ahí— y "Todos", con su cantidad, y los elegidos como etiquetas que se quitan).
  La lista sale de `GET /api/seguimiento` (sin endpoint nuevo).
  Si es una solicitud y un elegido ya tiene nota DGMIT en su ciclo abierto, un aviso que no bloquea (`textoDePistaDeSolicitud`; la nota que se corrige no cuenta).
  Los mensajes de error son los mismos en el navegador y en el servidor.
  Al guardar, el aviso del servidor ("Nota DGMIT N° 156/26 (solicitud) cargada en 3 datasets."), se cierra y la página vuelve a pedir la lista o el dataset.
  Un error del servidor con campo va a ese campo; sin campo, un aviso (`avisarFallaSinCampo`): con 403, 404 o 409 (la nota se anuló mientras tanto, o quien mira ya no puede) se cierra el modal y se vuelve a pedir la vista; con otro (por ejemplo, el 400 "La corrección no cambia ningún dato de la nota.") queda abierto y el foco vuelve al botón.
  Accesibilidad como los modales de administración (foco al primer campo y de vuelta al botón, Escape, `aria-describedby`/`aria-invalid`, foco al primer error).
- Validación pura (`services/notasDgmitReglas.js`; ninguna función tira):
  `validarNotaDgmit(entrada, hoy)` → `{ datos, errores }` (el número recortado y los ids sin repetidos; un id inválido invalida todo el campo), `validarMotivo` (hasta 500 caracteres), `MENSAJES_NOTA_DGMIT`, `TEXTO_TIPO_NOTA_DGMIT`, `textoNumeroRepetido`, `textoNoSePuedeElegir`, `sePuedeElegir` (activo, de gestión externa y con «Requiere nota DGMIT» en Sí o sin dato, sobre la fila de la base; la usa también el Generador de Notas: ver `docs/temas/generador-de-notas.md`) e `idsDeDatasets`.
  El controlador (`controllers/notasDgmitController.js`) chequea en la base que los datasets existan y se puedan elegir (`sePuedeElegir`; en una corrección se aceptan los que la nota ya tenía) y que el número no esté repetido.
- Número repetido: no puede haber dos notas sin anular con el mismo número (sin importar mayúsculas ni los espacios de los extremos: se guarda recortado y la colación compara sin mayúsculas).
  Sin índice único (una anulada puede repetir el número):
  `numeroRepetido` lo busca dentro de la transacción con `SELECT … FOR UPDATE` y responde 409 en `numero` con "Ya hay una nota DGMIT N° … cargada.
  Para sumarle datasets o cambiar algo, corregila.".
  Con REPEATABLE READ, dos escrituras simultáneas pueden chocar en un bloqueo mutuo (`ER_LOCK_DEADLOCK`):
  `enTransaccion` la intenta hasta 3 veces (`INTENTOS`: 3 intentos en total, cada uno desde el principio), y la que se repite ve lo que dejó la otra y responde el 409 en lugar de un 500.
- Corregir y anular:
  "Corregir" y "Anular" aparecen en el detalle del movimiento solo con `extra.editable` y si no está anulada.
  Corregir abre el mismo formulario ("Corregir nota DGMIT N° …", "Guardar corrección") con el "Motivo de la corrección" obligatorio; cambia número, fecha, tipo y datasets, y una corrección que no cambia nada da 400.
  Anular pide confirmación en un modal chico (`#modal-anular`, "¿Anular la nota DGMIT N° …? Deja de contar en el Seguimiento de sus N datasets, pero no se borra: …") con motivo obligatorio.
  Nunca se borra: cada corrección y la anulación quedan en `notas_dgmit_historial` (quién, cuándo, motivo y, en la corrección, `anteriores`).
  Una anulada no se corrige ni se vuelve a anular (si fue un error, se carga de nuevo).
  Orden de los controles: 404 (id que no es un entero positivo o que no existe) → 403 → 409 (anulada) → 400 → 409 (número repetido).
  Una corrección que le saca un dataset hace que la nota deje de aparecer en su Seguimiento.
- Las reglas (`services/seguimientoReglas.js`): vigentes son las no anuladas recibidas hasta hoy (el anexo usa la fecha de la nota como hoy).
  Una nota es del ciclo que regía el día en que el área la recibió, a las 00:00 (`cicloDelAviso`): si ese día se aprobó una actualización, queda en el ciclo anterior.
  Si ningún ciclo regía ese día (anterior al primero, o posterior a la baja), `cicloDelAviso` da el 0, que con un solo ciclo es el abierto (un dataset sin alta conocida y sin actualizaciones registradas "empieza" en su vencimiento): solo en ese caso la nota cuenta para el ciclo abierto si `recibida` no es anterior a la última carga en el portal (`dataset.ultima`; sin ella, cuenta), porque una nota anterior ya la respondió esa carga (`algunCicloRige`; ruling R7).
  Vale para el circuito, la lista y la pista;
  `cicloDelAviso` no lleva esta condición (la pone `notasDgmitPorCiclo`): un aviso del RPAD que no cae en ningún ciclo cuenta en el 0.
  `notaDgmitDelCiclo` es la vigente más reciente del ciclo abierto (por `recibida`, después `cargada`, después `id`); sin ciclos (eventual o sin fecha), la vigente más reciente.
  Una fuente sin `notasDgmit` es una lista vacía.
- El circuito (`circuitoDe`;
  `tramoFuera` = `{ titulo, texto, registrada, nota, tituloPdf, textoPdf }`), solo en gestión externa.
  Con nota en el ciclo abierto: en la página, la tarjeta en violeta (`--sg-violeta` #5B4691, `sg-flecha registrada`) y, en el PDF del Seguimiento, la línea llena violeta, "Nota DGMIT N° 156/26" / "Solicitud recibida por el área el 22/10/2026, hace 2 días" ("hoy", "hace 1 día";
  "Reiteración recibida…"); con «Requiere nota DGMIT» en No la nota se muestra igual y la banda del medio (el recuadro, en el PDF) vuelve a "Mandan la nota formal al área".
  Sin nota: el borde punteado gris en la página y la línea punteada gris en el PDF, "Nota formal" con "Pendiente de carga" (el ciclo abierto ya tuvo algún aviso del RPAD o ya venció: falta el registro, no la nota), "Todavía no hizo falta" (sin avisos y sin vencer, o sin ciclos) o "Ya no se pide" (dado de baja); con «No» y sin nota, "Sin nota formal" con "Los datos se obtienen de la fuente".
  Nunca "la DGMIT no mandó la nota".
  El renglón "Al área" de la pantalla es el del email de los 40 días (`alArea.texto`): solo el PDF usa `alArea.textoPdf`.
- Movimientos: tipo `dgmit`, filtro "Notas DGMIT" (después de "Emails al área"; cuenta también las anuladas).
  Título "Nota DGMIT N° 156/26 al área: solicitud"; detalle "Recibida por el área el 22/10/2026.", "La misma nota pide también …" y, si está anulada, "Anulada el dd/mm/aaaa por X: motivo."; quién "Cargó <nombre corto>";
  `fecha` = `recibida` y `momento` = `recibida 00:00:00`; no van las recibidas después de hoy.
  `extra` = `{ nota_id, numero, tipo, recibida, anulada, cargada, por, area, datasets, historial, editable }` (nombres cortos;
  `area`, la del dataset hoy).
  Al desplegarla: número, tipo (el texto largo), recibida, área, datasets de la nota, Cargada, cada corrección y la anulación (en rojo y negrita), y los botones (con `aria-label` propio:
  "Corregir la nota DGMIT N° …").
  Una anulada se ve tachada y en gris.
- Lista "Sin elegir": columna "Última nota DGMIT al área" ("N° 156/26" y, más chico, "Solicitud, recibida el 22/10/2026"; o "—").
  `resumenParaLista` trae `requiere_nota` (1, 0 o null) y `nota_dgmit` (`{ numero, tipo, recibida }` de `notaDgmitDelCiclo`, o null).
- Cinta: una marca violeta (un rectángulo lleno) en la fila de abajo, el día de la recepción; en esa fila gana la nota DGMIT, después el rechazo y después el email al área.
  Detalle "22/10/2026:
  Nota DGMIT N° 156/26 al área: solicitud"; leyenda "Nota DGMIT al área".
  Las anuladas no tienen marca.
- PDF (`seguimientoPdf.js`): el tramo usa `tituloPdf`/`textoPdf` ("Nota DGMIT" / "Solicitud 156/26.
  Recibida el 22/10/2026", sin "hace N días": el anexo queda guardado y se lee después), en violeta y lleno con nota.
  Con nota, el renglón "Al área" es `alArea.textoPdf` ("Al área: el 22/10/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset.", también sin vencimiento) en lugar del email de los 40 días.
  Los movimientos van sin las anuladas (`movimientosDeLaHoja`;
  `FILAS_PDF` es 8 y la hoja es una); la marca y su leyenda, como en la pantalla.
  El título del movimiento y "Al área" se ajustan a una línea (el número puede tener 40 caracteres).
- Anexo de la reiteración (decisión del usuario, 24/10/2026):
  `seguimientosDeLaNota` le pasa `{ anexo: true }` (`OPCIONES_CIRCUITO_ANEXO`) a `seguimientoDe`, y sin nota el tramo es neutral:
  "Nota formal / La manda la DGMIT al área", nunca "Pendiente de carga" (el anexo le llega a la DGMIT y la tabla arranca vacía).
  Con una nota cargada hasta el momento de generarlo, la muestra en violeta, como el PDF.
  Vale también para la vista previa y la prueba de Correos.
  La descarga desde el Seguimiento y la pantalla usan los tres textos de "Nota formal" ("Pendiente de carga", "Todavía no hizo falta" y "Ya no se pide").
  Lo ya generado no cambia (queda en bytes).
- Fuentes:
  `fuentesDe` trae en cada dataset `notasDgmit`, `[{ id, numero, tipo, recibida, anulada, cargada, por, por_id, datasets, historial }]`, todas, también las anuladas (`por` en nombre completo, que las reglas acortan;
  `datasets` = todos los de la nota, `{ id, titulo }` por título;
  `historial` = `{ accion, motivo, por, momento }`, la más nueva primero).
  Su consulta va aislada (`notasDgmitDe`, tres consultas para todos los datasets juntos, sin N+1): si falla (por ejemplo, sin la migración) registra el error y cada dataset queda con `notasDgmit` vacía, así nunca frena el anexo de una reiteración.
  `fuentesDeEjemplo` y `tests/seguimiento-casos.js` la traen vacía.
- API:
  `POST /api/notas-dgmit` (`{ numero, recibida, tipo, datasets }` → 201 `{ success, data: { id, numero, tipo, recibida, datasets }, message }`), `PUT /api/notas-dgmit/:id` (lo mismo más `motivo`) y `POST /api/notas-dgmit/:id/anular` (`{ motivo }`), con `authMiddleware` + `cargaNotasDgmit` (sin sesión 401; lector 403).
  Un error de validación da 400 `{ success: false, error, campo, errores }` (`error` y `campo`, el primero en el orden número, fecha, tipo, datasets y motivo); un dataset que no existe o que no se puede elegir, 400 en `datasets` ("«título» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT.").
  `GET /api/seguimiento/:id` pasa por `conNotasDgmitEditables`:
  `extra.editable` (quien la cargó, si todavía tiene un rol que carga —`puedeCargarNotasDgmit`: si pasó a lector, no ve los botones—, o administración con `esAdmin(rol) === true`; falla cerrado) y saca `por_id` de la respuesta.
  La página llama con `API.pedirJson`.
- Además de los de «Archivos de tests», el rol colaborador lo prueban los del panel de usuarios: `usuarios-panel.test.js`, `usuarios-frontend.test.js`, `usuarios-reglas.test.js` y `editor-panel.test.js`.

## Archivos de tests

`notas-dgmit-reglas.test.js`, `notas-dgmit-api.test.js`, `seguimiento-reglas.test.js`, `seguimiento-cinta.test.js`, `seguimiento-pdf.test.js`, `seguimiento-frontend.test.js`, `seguimiento-datos.test.js`, `seguimiento-api.test.js`, `notas-motor.test.js`, `permisos.test.js`, `schema.test.js`, `auth-frontend.test.js`
