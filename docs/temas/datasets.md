# Datasets: fechas, actualizaciones y estados

Las reglas de fechas, «Registrar actualización», «Requiere nota DGMIT», los estados y Mi Perfil.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`
- `docs/superpowers/specs/2026-10-17-fechas-datasets-design.md`
- `docs/superpowers/specs/2026-10-20-editor-sin-responsabilidad-design.md`

## Archivos

requiereNotaReglas («Requiere nota DGMIT», puro) y notasDigitalesSeguimiento (el anexo de la reiteración: el Seguimiento de cada dataset de la nota);
registroReglas («Recibido el» y el origen de los datos, puro).
datasetController (alta, edición y lecturas), cambiosPendientesController (la doble verificación), catalogController (temas, frecuencias y formatos) y andinoController (el pedido al portal).
fechasDatasetReglas (qué datos se piden para un vencimiento, qué próximas se ofrecen y en qué estado está el dataset, puro).

## Fechas de los datasets

- `proxima_actualizacion` es siempre el último día de un mes, con febrero en 28 también en los años bisiestos (`esFinDeMes`, `finDeMes`;
  `sumarMeses` suma sobre el índice año × 12 + mes, nunca con `setMonth`).
  `datos_al` ("Datos al": el día al que llegan los datos publicados) también es siempre fin de mes.
  El servidor lo valida solo si el campo cambia: un dataset viejo con una fecha mala se edita sin tocarla.
- Corte = fin del mes anterior a la próxima (`corteDe`): el área tiene un mes para preparar los datos sin figurar vencida.
- `ultima_actualizacion` es "Cargado en el portal": el día de la carga, no la fecha de los datos (esa es `datos_al`).
  Las fechas viejas no se corrigen.
- Tipo de pedido (`datasets.tipo_pedido`; si es NULL rige `tipoSugerido(gestion, meses)`, vía `tipoEfectivo`) y qué pide cada uno:
  `acumulado`, del 1/1 del año del corte al corte;
  `foto`, "Vigente al" el corte;
  `anio_anterior`, el último año calendario cerrado;
  `ejercicio`, "Presupuesto del ejercicio aaaa" (si falta más de uno, los dice todos);
  `edicion`, "Próxima edición disponible";
  `relevamiento`, "Relevamiento actualizado";
  `eventual`, sin pedido.
  Eventual va siempre junto con la frecuencia Eventual (sin próxima): el servidor lo exige.
- "Todo lo que falta": si lo publicado termina antes del 1/1 del año del corte, el pedido arranca el 1° del mes siguiente a "Datos al" (nunca el 29/02), aunque cruce el año.
- R7, vencidos: si el vencimiento ya pasó, el pedido llega hasta el corte del último vencimiento del ciclo que ya pasó (`ultimoVencimientoPasado`: suma la frecuencia mientras siga en el pasado).
- Una sola fuente:
  `services/fechasDatasetReglas.js`, puro (sin pool ni `Date` local; las fechas son texto `'AAAA-MM-DD'`, hoy = `hoyArgentina()`):
  `pedido`, `cubre`, `opcionesDeProxima`, `estadoDelDataset`, `tasaDeActualizacion`, `topeDatosAl`, `tipoSugerido`, `tipoEfectivo`, `frecuenciaEnNota`.
  Ninguna tira error: con una entrada inválida devuelven null, false o una lista vacía (`frecuenciaEnNota` devuelve la frecuencia tal cual).
- La API (`GET /datasets` y `/:id`) devuelve `datos_al`, `tipo_pedido` (el efectivo), `tipo_pedido_nombre`, `tipo_pedido_guardado` (el de la columna, aunque sea NULL: `tipoAEnviar` de `admin-fechas.js` lo manda si el selector no cambió; sin él, editar guardaría el efectivo), `frecuencia_meses`, `pedido` (`{ desde, hasta, texto }`), `estado` y `dias_para_vencer`.
  Para la pantalla de admin:
  `GET /datasets/:id/opciones-proxima?datos_al=` y `GET /datasets/calculo-pedido` (`API.opcionesDeProxima`, `API.calculoPedido`).
- El navegador no recalcula las reglas: las pide al servidor.
  Las copias mínimas conocidas (para avisar en el momento; el servidor valida igual) son: en `admin-fechas.js`, `tipoSugeridoDe` (copia de `tipoSugerido`), `TIPOS_DE_PEDIDO` (copia de `TIPOS_PEDIDO` y `NOMBRES_TIPO_PEDIDO`), `frecuenciaEnNotaDe` (copia de `frecuenciaEnNota`, para la vista previa "Así va a salir en la próxima nota"), `tiposPermitidos` y `esEventual` (Eventual va solo con la frecuencia Eventual, la que no tiene meses:
  `esFrecuenciaEventual` del controlador), `finDeMesDe`, `finDelMesAnterior`, `topeDeDatosAl` (copia de `topeDatosAl`), `errorDeDatosAl` y `problemaDeFechasDelRegistro` (los pasos 1 y 2 de `POST /datasets/:id/actualizar`, con los mensajes y el orden del servidor: la carga, la recepción —obligatoria— y, en externa, el origen), lo de «Recibido el» y el origen de los datos (spec 2026-10-24-metricas-y-reportes, 4):
  `MENSAJE_FALTA_RECIBIDO`, `MENSAJE_FALTA_ORIGEN` y `MENSAJE_EDICION_REGISTRA` (copias de las de `services/registroReglas.js`), `OPCIONES_ORIGEN` (copia de la del servidor: las mismas claves, en el mismo orden y con los mismos textos), `origenSugeridoDe` (copia de `origenSugerido`: la fuente pública en un externo con «Requiere nota DGMIT:
  No»; el 0 se compara con `===`), `rotuloDeLaFechaDe` (copia de `rotuloDeLaFecha`:
  «Obtenido el» con la fuente pública) y `problemasDelFormulario(…).edicion` (una edición que cambia a la vez «Cargado en el portal» y la próxima, contra lo guardado y por el día, da `MENSAJE_EDICION_REGISTRA`), los mensajes copiados de `controllers/datasetController.js` (`ERROR_FALTA_DATOS_AL`, `ERROR_FALTA_PROXIMA`, "Todavía no puede haber datos al …" y los de la carga y la recepción posteriores a hoy o a la carga), el texto por defecto del "Qué se solicita" (`QUE_SE_SOLICITA_POR_DEFECTO`)
  y lo de "Requiere nota DGMIT":
  `MENSAJE_FALTA_REQUIERE_NOTA` (copia de la de `services/requiereNotaReglas.js`:
  "Indicá si el dataset requiere nota DGMIT."), `textoDeRequiereNota` (copia de `textoRequiereNota`:
  Sí, No o "—", para la vista previa), `errorDeRequiereNota` y `requiereNotaDe` (un externo sin elegir; el 0 es un valor, nunca `valor || null`); en `admin.js`, `mesesDeLaFrecuencia` (la Eventual es la frecuencia sin meses, como `esFrecuenciaEventual`); en `perfil.js`, `esFinDeMesTexto` (la marca "No es el último día del mes") y `textoDeRequiereNota` (copia de `textoRequiereNota`, vacío donde el servidor dice "sin dato": el renglón no se lista);
  en `seguimiento.js`, `textoDeRequiereNota` (copia de `textoRequiereNota(valor, 'Sin dato')`) y lo del formulario de las notas DGMIT (`TIPOS_NOTA_DGMIT`, `TIPOS_NOTA_DGMIT_LARGOS`, `MENSAJES_NOTA_DGMIT` con sus largos y la fecha mínima, `erroresDelFormularioDeNota`, `datasetsParaElegir` y `esFechaDeTexto`: ver `docs/temas/seguimiento.md`); en `correos.js`, `TIPOS_CON_ANEXO` (copia de la de `services/notasDigitales.js`: los tipos de nota que llevan anexo, el aviso y la reiteración);
  en `auth.js`, `Auth.puedeCargarNotasDgmit()` (copia de `puedeCargarNotasDgmit` de `services/usuariosReglas.js`); en `usuarios.js`, `ROLES_DEL_EDITOR` (copia de la de `services/usuariosReglas.js`: lector y colaborador) y `TEXTO_SE_BORRA_DE_MI_ESPACIO` (copia de la de `services/licenciasReglas.js`: lo que suma la confirmación de «Anular» de una licencia cargada desde Mi espacio);
  en `areas.js`, `MENSAJE_NOMBRE_AREA` (copia de `MENSAJES_AREA.nombre` de `services/areasReglas.js`) y `articuloDelArea` y `deArticuloArea` (copias de `articuloDe` y `deArticulo` de `services/notasGeneradorContenido.js`); en `api.js`, el respaldo `Utils.calcularEstado`; en `notas.js`, las del Generador de Notas (ver `docs/temas/generador-de-notas.md`); en `proyectos.js`, las de Proyectos (ver `docs/temas/proyectos.md`); en `feriados.js`, las de Feriados (ver `docs/temas/feriados.md`);
  en `mi-espacio.js`, las de Mi espacio (ver `docs/temas/mi-espacio.md`).
  Se comparan contra el servidor en un test:
  `tipoSugeridoDe` (con `tipoSugerido`), `TIPOS_DE_PEDIDO` (con `TIPOS_PEDIDO` y `NOMBRES_TIPO_PEDIDO`), `frecuenciaEnNotaDe` (con `frecuenciaEnNota`), `Utils.calcularEstado` (con `estadoDelDataset`), el texto por defecto (con `QUE_SE_SOLICITA_POR_DEFECTO` de `notasDigitalesContenido.js`), `MENSAJE_FALTA_REQUIERE_NOTA` (con la del servidor) y los tres `textoDeRequiereNota` (el de `admin-fechas.js`, con `textoRequiereNota`; el de `perfil.js`, con `textoRequiereNota(valor, '')`;
  el de `seguimiento.js`, con `textoRequiereNota(valor, 'Sin dato')`), `Auth.puedeCargarNotasDgmit()` (con `puedeCargarNotasDgmit`, para cada rol;
  `tests/auth-frontend.test.js`), `ROLES_DEL_EDITOR` y `TEXTO_SE_BORRA_DE_MI_ESPACIO` de `usuarios.js` (con las del servidor;
  `tests/usuarios-frontend.test.js`), `MENSAJE_NOMBRE_AREA`, `articuloDelArea` y `deArticuloArea` de `areas.js` (con `MENSAJES_AREA.nombre`, `articuloDe` y `deArticulo`;
  `tests/areas-frontend.test.js`), en `tests/seguimiento-frontend.test.js`, `TIPOS_NOTA_DGMIT` y `TIPOS_NOTA_DGMIT_LARGOS` (con `TEXTO_TIPO_NOTA_DGMIT`), `MENSAJES_NOTA_DGMIT` y sus constantes (con las de `services/notasDgmitReglas.js`), `erroresDelFormularioDeNota` (con `validarNotaDgmit` y `validarMotivo`, en los casos de borde)
  y `ESTADOS_DE_NOTA` (con `ESTADO_DE_NOTA`), en `tests/admin-frontend.test.js`, `MENSAJE_FALTA_RECIBIDO`, `MENSAJE_FALTA_ORIGEN` y `MENSAJE_EDICION_REGISTRA` (con los de `registroReglas.js` y con el texto escrito a mano), `OPCIONES_ORIGEN`, `origenSugeridoDe` (con `origenSugerido`)
  y `rotuloDeLaFechaDe` (con `rotuloDeLaFecha`), en `tests/reportes-frontend.test.js`, las copias de `reportes.js` (ver `docs/temas/metricas-y-reportes.md`), en `tests/notas-frontend.test.js`, las de `notas.js` (ver `docs/temas/generador-de-notas.md`), en `tests/proyectos-frontend.test.js`, las de `proyectos.js`, en `tests/feriados-frontend.test.js`, las de `feriados.js`, y en `tests/mi-espacio-frontend.test.js`, las de `mi-espacio.js`.
  El resto (`tiposPermitidos`, `esEventual`, `mesesDeLaFrecuencia`, `esFinDeMesTexto`, `topeDeDatosAl`, `finDeMesDe`, `problemaDeFechasDelRegistro`, `problemasDelFormulario`, `errorDeRequiereNota`, `requiereNotaDe`, `TIPOS_CON_ANEXO`, `datasetsParaElegir`, `esFechaDeTexto`, `abreLaCargaPorElHash`, …) solo tiene tests de comportamiento, y los mensajes copiados, tests con el texto escrito a mano: si cambia una regla o un mensaje del servidor, hay que cambiarlos a mano.
- Admin: la lista filtra por estado, gestión, tipo de pedido y "Requiere nota" (Todos, Sí y No;
  Sí y No muestran solo externos); el formulario tiene la sección "Actualización y pedido", con la vista previa "Así va a salir en la próxima nota" (Conjunto de datos, Frecuencia y Datos solicitados, como en la tabla del aviso; en un externo trae "Requiere nota DGMIT" entre Frecuencia y Datos solicitados).
  La lista dice, por ejemplo, "Acumulado.
  Vence el 31/01/2027".
  "Registrar actualización" dice "Vence" o "Vencido desde" (la marca del ciclo, "Vence"), propone las opciones de próxima y no elige ninguna de antemano; en el paso 2 pide «Recibido el» (obligatorio) y, en gestión externa, «¿Quién entregó los datos?» (ver «Registrar una actualización»); el aviso de lo que falta aparece recién cuando la persona pasó por el campo (`revisionDelRegistro`, `tocados`).
  Un dataset con cambio pendiente queda bloqueado también ahí, antes de abrir el modal.
  El formulario de edición avisa, antes de enviar, si la edición cambia a la vez «Cargado en el portal» y la próxima (`#form-error-edicion`).
- Sitio público: el detalle muestra "Datos al", "Cargado en el portal" y "Próxima actualización prevista" (mes y año); la tarjeta y la fila del listado, "Datos al" y "Próxima"; el CSV trae "Cargado en el portal".

### Registrar una actualización

- `POST /datasets/:id/actualizar` recibe `datos_al`, `cargado_el` (o `fecha_actualizacion`, por compatibilidad; por defecto hoy), `recibido_el` (obligatorio), `origen_datos` (obligatorio en gestión externa), `proxima_actualizacion` y `notas`.
  Respeta la próxima que eligió la persona y valida fin de mes, que ninguna fecha sea futura (`datos_al`, hasta `topeDatosAl`) y que `recibido_el` no sea posterior a la carga.
  Crea un cambio `editar` con `registro_actualizacion: true`: pasa por la doble verificación.
- «Recibido el» y el origen de los datos (spec 2026-10-24-metricas-y-reportes, 4; los mensajes, `ORIGENES_DATOS`, `OPCIONES_ORIGEN`, `normalizarOrigen`, `origenSugerido`, `rotuloDeLaFecha` y `textoOrigen` en `services/registroReglas.js`, puro):
  `errorDelRegistro` (`controllers/datasetController.js`) va en este orden: falta «Datos al» → la carga → falta la recepción (`MENSAJE_FALTA_RECIBIDO`, «Indicá cuándo se recibieron los datos.») → recepción futura o posterior a la carga → en externa, falta el origen (`MENSAJE_FALTA_ORIGEN`, «Indicá quién entregó los datos.») → la próxima.
  El origen (`ORIGENES_DATOS`:
  `'area'`, los entregó el área, o `'fuente_publica'`, Datos Públicos los obtuvo de una fuente pública: el digesto, el Boletín Oficial, la web de Vialidad…) pasa por `normalizarOrigen` (null, undefined y '' son sin dato; otro valor tira `TypeError` y el controlador responde 400 «El origen de los datos no es válido.», también en interna); en gestión interna no se pregunta y queda null aunque llegue.
  Viaja en el cambio (`datos_nuevos.origen_datos`, junto con `recibido_el`):
  `historial_actualizaciones` no tiene columna para el origen.
  Vale también para los externos con «Requiere nota:
  No» (la fecha es el día en que Datos Públicos obtuvo la fuente).
  El modal:
  «¿Quién entregó los datos?» (`OPCIONES_ORIGEN`:
  «Los entregó el área» y «Los obtuvo Datos Públicos de una fuente pública»), con la fuente pública elegida de antemano en un externo con «Requiere nota DGMIT:
  No» (`origenSugerido`; se puede cambiar), y la fecha se llama «Recibido el» u «Obtenido el» (`rotuloDeLaFecha`).
  Se ve como «Origen de los datos» (`textoOrigen`:
  «Los entregó el área», «Fuente pública» o la raya) en la comparación de Mi Perfil (`enriquecerDatos` arma `origen_datos_texto` solo si el cambio trae la clave; en interna queda vacío y el renglón no se lista) y en el detalle del movimiento del Seguimiento.
  Sin romper lo anterior: un cambio pendiente sin el dato se aprueba igual y las filas viejas no se tocan; los «Recibido el» viejos se importaron a `actualizaciones_recibido` (ver `docs/temas/base-de-datos.md`) y `fuentesDe` los suma al cambio sin pisar lo que guardó (`conImportado`, consulta aislada `importadosDe`).
- La edición no registra actualizaciones:
  `updateDataset` responde 400 `MENSAJE_EDICION_REGISTRA` («Para registrar una actualización, usá «Registrar actualización».») si una edición cambia a la vez «Cargado en el portal» y la próxima (así toda actualización pide la fecha y el origen y escribe el historial).
  Corregir una sola de las dos sigue siendo posible.
  El formulario lo avisa antes de enviar (`problemasDelFormulario(…).edicion`, `admin-fechas.js`).
- `aprobarCambio` no aprueba un cambio con una `proxima_actualizacion` o un `datos_al` que no son fin de mes (400: se rechaza y se vuelve a proponer).
  Si el cambio lleva `registro_actualizacion`, en la misma transacción escribe `historial_actualizaciones`:
  `cambio_id`, `vencimiento` (la próxima que se cumplió), `datos_al`, `recibido_el`, `proxima_nueva`;
  `fecha_actualizacion` es la carga.
- `historial_actualizaciones.vencimiento` es la clave del ciclo, la misma que `notas_digitales_datasets.vencimiento`; se guarda para la línea de tiempo de cada dataset (spec 2026-10-17-fechas-datasets, 16), y hoy ningún código la lee: el Seguimiento arma los ciclos sin esta columna.
  El historial anterior no se reconstruyó.
  `gestionController` ("Operador más activo") no cuenta dos veces un registro que está en las dos tablas.

## Requiere nota DGMIT

- El dato:
  `datasets.requiere_nota` dice si la DGMIT tiene que mandarle una nota formal al área (1 = Sí) o si los datos se sacan de una fuente pública y no hace falta (0 = No; por ejemplo el TMDA, de la web de Vialidad, y la cantidad de empleados municipales, del Boletín Oficial);
  NULL = sin dato, y en gestión interna siempre NULL.
  El 0 es un valor: sobre este campo nunca `x || null`, siempre `??`.
  Un externo en NULL se comporta como "Sí" en todo menos en mostrar el dato ("—" en la nota, "Sin dato" en el Seguimiento); después de la carga inicial no queda ninguno.
  No cambia quién recibe las notas ni cuándo salen, y no se muestra en la pantalla pública (la API pública lo entrega: el SELECT trae `d.*`).
- Reglas (`services/requiereNotaReglas.js`, puro):
  `MENSAJE_FALTA_REQUIERE_NOTA` ("Indicá si el dataset requiere nota DGMIT."), `normalizarRequiereNota` (1, true y '1' son Sí; 0, false y '0', No; null y '' son sin dato; otro valor tira `TypeError` y el controlador responde 400), `requiereNotaResultante` (NULL si la gestión es interna) y `textoRequiereNota(valor, sinDato = '—')` (Sí, No o `sinDato`; nunca tira).
- Alta y edición (doble verificación): el formulario tiene el select "Requiere nota DGMIT" junto a "Tipo de gestión", solo con gestión externa; en el alta de un externo y al pasar un dataset a externo viene vacío y es obligatorio.
  El servidor lo exige en todo guardado del formulario de un externo (400 con el mensaje;
  "Registrar actualización" no pasa por ahí) y, si el campo no viene, conserva el valor; con gestión interna lo deja en NULL aunque llegue un valor.
  Como `tipo_gestion` es 'externa' por defecto, un alta por API sin el campo da 400.
  Va en `datosNuevos`, `datosAnteriores` y `hayCambiosReales` (una edición que solo cambia este dato es un cambio real; compara normalizado).
  `aprobarCambio` lo aplica así: el INSERT escribe `datosNuevos.requiere_nota ?? null` y el UPDATE lo incluye en los `campos` que escribe cuando `datosNuevos[campo] !== undefined` (los dos conservan un 0); un cambio viejo sin la clave no lo toca (UPDATE) o lo deja NULL (INSERT).
  Se ve como "Requiere nota DGMIT" (Sí, No o —) en todo lo que muestra un cambio: la comparación de Mi Perfil (`calcularCambios`, `enriquecerDatos`, `perfil.js`), la nota de auditoría (`CAMPOS_DEL_DATASET`) y los movimientos del Seguimiento.

## Estados de dataset

Se calculan una sola vez, en el servidor (`estadoDelDataset`), según `proxima_actualizacion` y la frecuencia en meses; las páginas usan `d.estado` (`Utils.estadoDe`) y `dias_para_vencer`.
`Utils.calcularEstado` queda solo de respaldo y da lo mismo.
- `actualizado` — actualizado (vence en más de 60 días).
  "Al día" son los actualizados más los próximos (la tasa, Métricas y `/gestion/metricas`); en administración el filtro de los `actualizado` dice "Actualizados"
- `proximo` — próximo a vencer (hasta 60 días corridos; el día del vencimiento todavía cuenta)
- `atrasado` / `sin-respuesta` — vencido (según tipo_gestion interna/externa)
- `sin-fecha` — sin fecha de próxima actualización
- `eventual` — frecuencia Eventual: no tiene vencimiento, ni al día ni atrasado
- La tasa de actualización (`tasaDeActualizacion`) es (actualizados + próximos) sobre el total sin los eventuales: la misma en la portada ("Índice de actualización"), el reporte PDF Estado general, Métricas (el punto de hoy del índice mes a mes y el ranking de áreas) y la "Tasa de cumplimiento" de `/gestion/metricas` (`tests/estados-api.test.js`:
  «la tasa es la misma en la portada, el Estado general y /metricas»).
  El ranking de áreas tiene una sola regla, `cumplimientoPorArea` (`fechasDatasetReglas.js`), para `/gestion/metricas` y Métricas (`areasYTemas`).
  Los sin fecha cuentan en la base, como no al día.
- Reportes PDF Estado General y por Área: cinco tarjetas (Total, Actualizados, Próximos, Vencidos y Eventuales; con los sin fecha, suman el total).
  Los sin fecha no tienen tarjeta: una línea debajo los cuenta, y el reporte por Área los lista en su grupo, "Sin fecha (n)", al final, nunca entre los vencidos.

## Mi Perfil

- Mi Perfil en pestañas:
  Para revisar, Mis cambios, Mis datos y Mi firma (el email de las 14:00 abre `perfil.html#para-revisar`; el lector solo ve Mis datos).
  Cada cambio es una fila que se despliega con la comparación (lo viejo tachado, lo nuevo resaltado; palabra por palabra en los textos largos) y se aprueba (con confirmación en la fila) o se rechaza (con motivo) ahí mismo.
  Las listas `GET /cambios-pendientes/para-revisar` y `/mis-cambios` traen la comparación (`campos_modificados`), los datos enriquecidos y `dataset_url`;
  `para-revisar`, además, `auditoria` con `auditan` (quiénes lo auditan hoy, para la marca del editor).
  `GET /:id` devuelve `auditoria` como `{ puede, respaldo, sin_responsabilidad, mensaje }` (con `sin_responsabilidad`, `mensaje` es el aviso «Este cambio lo auditan … Si lo aprobás o lo rechazás vos, queda registrado sin responsabilidad por la auditoría.»).
  Auditar sin responsabilidad (spec 2026-10-20-editor-sin-responsabilidad): la fila muestra «Lo auditan …», la nota ámbar con el aviso (`notaSinResponsabilidad`, `id="aviso-N"`, que describe los botones, la confirmación y el motivo) y los botones habilitados; la pregunta es «¿Aprobar sin responsabilidad por la auditoría? El cambio se aplica al dataset ahora.».
  `perfil.js` aprueba y rechaza con `API.pedirJson` (no con `API.aprobarCambio`/`rechazarCambio`, para no tocar `api.js`) y manda `sin_responsabilidad` con lo que la fila mostró; el servidor responde **409** («La situación de este cambio cambió.
  Revisá el aviso y volvé a confirmar.», `MENSAJE_SITUACION_CAMBIADA`) si no coincide con lo de hoy (solo cuenta el `true` literal: una página vieja que no lo manda no puede auditar sin responsabilidad), y Mi Perfil vuelve a abrir la fila.
  Revisados y Mis cambios dicen «Aprobado por X (sin responsabilidad por la auditoría)» (`textoRevisor`).
  La marca no se muestra en ningún otro lugar: el Seguimiento, sus PDF y el anexo no la leen (tampoco el «(respaldo)»).
  `calcularCambios` compara por día `ultima_actualizacion` (rótulo "Cargado en el portal"), `datos_al`, `proxima_actualizacion` y `recibido_el`; un registro de actualización se titula "Actualización registrada".
  La UI solo refleja el permiso del servidor (`permisoDeAuditoria` falla cerrado), que vuelve a validar al aprobar o rechazar.

## La página: perfil.js

- `perfil.js`: lo que arma HTML (`htmlDeFila`, `htmlDeComparacion`, …) es puro y recibe quién mira por parámetro; lo que toca el DOM, `Auth` o la API va aparte.
  Los tests lo cargan en un `vm` sin `window` ni DOM: al cargarse, el archivo solo declara.

## La página: admin-fechas.js

- `admin-fechas.js`: lo puro de la lista de admin y de "Registrar actualización" (`htmlDeFila`, `htmlDeOpciones`, `htmlDeCiclo`, `textoEstado`, selectores de mes y año, `hoyEnArgentina`, y el origen de los datos:
  `htmlDeOpcionesDeOrigen`, `origenSugeridoDe`, `rotuloDeLaFechaDe`, `problemaDeFechasDelRegistro` y `revisionDelRegistro`); lo que toca el DOM o la API va en `admin.js`.
  Como `perfil.js` y `correos.js`, al cargarse solo declara (`tests/admin-frontend.test.js` lo carga en un `vm`).

## Archivos de tests

`admin-frontend.test.js`, `auth-frontend.test.js`, `usuarios-frontend.test.js`, `areas-frontend.test.js`, `seguimiento-frontend.test.js`, `reportes-frontend.test.js`, `notas-frontend.test.js`, `proyectos-frontend.test.js`, `feriados-frontend.test.js`, `mi-espacio-frontend.test.js`, `estados-api.test.js`
