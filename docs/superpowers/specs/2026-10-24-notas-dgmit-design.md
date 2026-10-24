# Notas DGMIT en el Seguimiento

Fecha: 24/10/2026.

Antecedente: la propuesta del 21/10/2026, hecha para presentarle la idea a la DGMIT (maquetas, documento de 3 páginas, resumen de una hoja y el Excel para la migración, en `Escritorio/RPAD-propuesta-nota-dgmit/`, fuera del repositorio). La DGMIT dijo que le gustaba la idea pero no avanzó. El usuario decidió dejarla implementada igual: la Dirección de Datos Públicos y Comunicación (DDPC) puede cargar las notas desde el primer día, y la DGMIT se suma cuando quiera.

Maquetas: se actualizan después de este documento, con lo que se decide acá. Este documento manda sobre las maquetas de la propuesta.

## Por qué

El Seguimiento muestra el circuito de cada dataset de gestión externa: el RPAD avisa a la DGMIT y a la Dirección Administrativa, ellas le mandan una nota formal al área y el área entrega los datos. El paso del medio no queda registrado: el circuito dice "Nota formal / Por fuera del RPAD: no queda registrada". Sin ese paso no se puede saber si un dataset está vencido porque el área no respondió o porque la nota todavía no salió, ni cuánto tarda cada paso.

Con esta entrega, quien tenga los datos de la nota (número, fecha en que el área la recibió y si es una solicitud o una reiteración) la carga en el RPAD, y la nota queda en el Seguimiento de cada dataset que pide.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Un botón "Cargar nota DGMIT" en Herramientas → Seguimiento, con un formulario de cuatro campos: número, fecha de recepción, tipo (solicitud o reiteración) y datasets.
- Un rol nuevo, **Colaborador**: ve todo lo que ve un lector y además carga notas DGMIT. Pensado para el personal de la DGMIT; ninguna cuenta lo tiene al desplegar.
- La nota se ve en el circuito (el tramo "Nota formal"), en los movimientos, en la cinta, en la lista "Sin elegir", en el PDF del Seguimiento y en el anexo de la reiteración.
- Una nota se corrige o se anula con motivo. Nunca se borra.

**No objetivos**
- La DGMIT no hace sus notas desde el RPAD (no usa Herramientas → Notas): las sigue haciendo por fuera y acá solo se registran.
- No sale ningún email nuevo y no cambia ninguna Nota Digital (ni el texto de la reiteración ni sus tablas).
- Una nota DGMIT no es un aviso del RPAD: no cuenta en "Avisos del ciclo abierto" ni en la columna de avisos de la lista, y no cambia el estado del dataset, sus ciclos ni sus hitos.
- Las notas anteriores no se cargan en esta entrega: la tabla arranca vacía. Cuando llegue el Excel completo, se arma un SQL de importación aparte (sección 9).
- Gestión interna no cambia: no hay nota formal al área (el relevamiento sigue "por fuera del RPAD").
- No hay indicadores nuevos en Gestión ni avisos a la DGMIT de vencidos sin nota (ideas para más adelante).

**Antiobjetivos**
- Que algo se lea como un reproche o un control sobre la DGMIT. Por eso, mientras no hay nota, el circuito dice "Pendiente de carga" (lo que falta es el registro, no la nota), y nunca "la DGMIT no mandó la nota" ni nada parecido; y el anexo de la reiteración, que le llega a la DGMIT, ni siquiera eso (sección 7).
- Que una nota DGMIT se confunda con un aviso del RPAD o con una Nota Digital a DGMIT (el nombre parecido es otra cosa: la Nota Digital la manda el RPAD a la DGMIT; la nota DGMIT la manda la DGMIT al área).
- Que se pueda borrar una nota cargada, o que un Colaborador pueda tocar algo más que las notas DGMIT que cargó.

## 1. El rol Colaborador

- `usuarios.rol` suma `'colaborador'`: `enum('superadmin','admin','editor','colaborador','lector')`. Migración aditiva (sección 10).
- Ve lo mismo que un lector: el sitio público, Mi Perfil (solo Mis datos) y Herramientas. No es de administración (`esAdmin` y `Auth.isAdmin()` siguen siendo superadmin, admin y editor), no audita, no cuenta para el mínimo de aprobadores, no tiene licencias ni firma.
- Además carga notas DGMIT y corrige o anula las que cargó él.
- Quién carga notas DGMIT: el Colaborador y administración (superadmin, admin y editor). Una sola regla pura, `puedeCargarNotasDgmit(rol)` en `services/usuariosReglas.js`, y su copia `Auth.puedeCargarNotasDgmit()` en `public/js/auth.js`.
- Se llama "Colaborador" en todos lados: `TEXTO_ROL` (servidor y `usuarios.js`), `Auth.getRoleText()` (encabezado), `scripts/setup-admin.js` y el selector de rol de Usuarios (entre Editor y Lector).
- Usuarios:
  - Un grupo propio, "Colaboradores", entre Editores y los de solo lectura, con su contador.
  - Debajo del selector de rol, una línea que explica el rol elegido (hoy no hay ninguna), una para cada rol que se puede elegir, con los textos de la maqueta de Usuarios:
    - Lector: "Ve los datos públicos y usa las Herramientas (Reportes, Notas, Gestión y Seguimiento). No modifica nada."
    - Colaborador: "Ve todo lo que ve un lector y, además, carga las notas DGMIT en el Seguimiento (y corrige o anula las que cargó). No modifica datasets ni audita cambios."
    - Editor: "Todo lo de un administrador, pero audita cambios de respaldo y en Usuarios solo crea y modifica lectores y colaboradores."
    - Admin: "Propone y audita cambios en los datasets, maneja áreas, usuarios, reportes y notificaciones. También carga notas DGMIT."
    - La cuenta del superadmin no la modifica nadie más que su titular: no lleva línea.
  - Lo asignan el admin y el superadmin, como cualquier rol. El editor también: hoy crea y modifica solo lectores y no cambia roles; ahora crea y modifica lectores y colaboradores, y puede pasar a alguien de lector a colaborador o al revés, nada más. El mensaje pasa a "Un editor solo puede crear y modificar usuarios lectores y colaboradores." (`MENSAJE_EDITOR_SOLO_LECTORES`).
  - Los avisos al superadmin no cambian de regla: un cambio de rol le avisa (también de lector a colaborador), y crear un colaborador no, como crear un lector.
- El usuario va a pasar a Colaborador a una cuenta de la DGMIT más adelante: eso va por SQL en `database/privado/` (no versionado), después del código, o desde el panel.

## 2. Cargar una nota

**El botón.** "Cargar nota DGMIT", arriba a la derecha de la página del Seguimiento, en el encabezado, junto al título "Seguimiento de datasets". Está en la lista y en la vista de un dataset. Lo ve solo quien puede cargar (`Auth.puedeCargarNotasDgmit()`). Desde la vista de un dataset, el formulario abre con ese dataset ya elegido, si se puede elegir; si no (interno, con "Requiere nota DGMIT" en No o dado de baja), abre sin ninguno elegido.

**El formulario** (un modal; todos los campos son obligatorios):
- **Número de nota DGMIT.** Texto de hasta 40 caracteres (sin los espacios de los extremos). Ayuda: "Como figura en la nota." Ejemplo en el campo: "Ej.: 156/26".
- **Fecha de recepción.** El día en que el área recibió la nota. No puede ser posterior a hoy (`hoyArgentina()`) ni anterior al 01/01/2025. Ayuda: "El día en que el área recibió la nota."
- **Tipo de nota.** Dos opciones: "Solicitud" ("La primera vez que se le piden los datos al área.") y "Reiteración" ("Ya se le habían pedido y se le vuelven a pedir.").
- **Datasets asociados.** Varios. Solo se pueden elegir los activos de gestión externa con "Requiere nota DGMIT" en Sí o sin dato. Agrupados por área (las áreas y los títulos, por orden alfabético), cada uno con su estado ("Vencido hace N días", "Vence en N días", "Vence el dd/mm/aaaa", "Sin fecha", "Sin vencimiento"). Un buscador por título o área (sin importar tildes ni mayúsculas). Dos botones de alcance: "Vencidos y próximos a vencer" (el inicial) y "Todos", cada uno con su cantidad. Los elegidos se ven abajo como etiquetas que se pueden quitar. Si el dataset que viene elegido no está en el alcance inicial, el formulario abre en "Todos".
- La lista de datasets sale de `GET /api/seguimiento` (la lista de "Sin elegir"), que suma `requiere_nota` (sección 6): no hay un endpoint nuevo para esto.

**Aviso de solicitud repetida.** Si el tipo es Solicitud y alguno de los datasets elegidos ya tiene una nota DGMIT en su ciclo abierto, aparece un aviso que no bloquea: "«Áreas específicas de género» ya tiene la nota DGMIT N° 156/26 (solicitud, recibida el 22/10/2026) en este ciclo. Si se le vuelven a pedir los datos, es una reiteración." (con más de uno, uno por renglón).

**Mensajes de error** (en el campo, los mismos en el navegador y en el servidor):
- "Escribí el número de la nota."
- "El número de la nota puede tener hasta 40 caracteres."
- "Elegí la fecha en que el área recibió la nota."
- "La fecha de recepción no puede ser posterior a hoy."
- "La fecha de recepción no puede ser anterior al 01/01/2025."
- "Elegí si es una solicitud o una reiteración."
- "Elegí al menos un dataset."

**Número repetido.** Un número identifica una nota: no puede haber dos notas sin anular con el mismo número (sin importar mayúsculas ni los espacios de los extremos). Si ya existe, el servidor responde 409 con "Ya hay una nota DGMIT N° 156/26 cargada. Para sumarle datasets o cambiar algo, corregila." Así, si la DGMIT y la DDPC cargan la misma nota, no queda dos veces.

**Guardar.** Pie del formulario: "Se guarda al confirmar y queda registrado quién la cargó y cuándo." y los botones "Cancelar" y "Guardar nota". Se guarda directo, sin doble verificación (como las licencias: no es un cambio a un dataset). Al guardar se cierra, aparece el aviso "Nota DGMIT N° 156/26 (solicitud) cargada en 3 datasets." ("en 1 dataset" si es uno) y la página vuelve a pedir sus datos (la lista o el dataset), así se ve la nota sin recargar. Si el servidor rechaza con un error en un campo, va a ese campo; sin campo, un aviso: con 403, 404 o 409 (la nota se anuló mientras tanto, o quien mira ya no puede) se cierra el formulario (o el modal de anular) y la página vuelve a pedir sus datos, así desaparecen los botones que ya no sirven; con otro (por ejemplo, "La corrección no cambia ningún dato de la nota.") queda abierto y el foco vuelve al botón (revisión final, 24/10/2026).

**Accesibilidad.** Como los modales de administración: el foco va al primer campo al abrir y vuelve al botón al cerrar, Escape cierra, los errores quedan unidos a su campo (`aria-describedby`, `aria-invalid`) y el foco va al primer campo con error.

## 3. Corregir y anular

- En el detalle de un movimiento de nota DGMIT (sección 6) aparecen "Corregir" y "Anular" solo si quien mira la cargó o es de administración (`extra.editable`, que calcula el servidor). Una nota anulada no se corrige ni se vuelve a anular (si fue un error, se carga de nuevo).
- **Corregir** abre el mismo formulario con el título "Corregir nota DGMIT N° 156/26", con los datos de la nota, más un campo obligatorio "Motivo de la corrección" (hasta 500 caracteres; "Escribí el motivo."). Se puede cambiar todo: número, fecha, tipo y datasets. En la lista de datasets están también los que la nota ya tenía aunque hoy no se puedan elegir (por ejemplo, uno que pasó a "No"): siguen marcados y se pueden quitar. El botón dice "Guardar corrección" y el aviso, "Nota DGMIT N° 156/26 corregida."
- **Anular** pide confirmación en un modal chico: "¿Anular la nota DGMIT N° 156/26? Deja de contar en el Seguimiento de sus 3 datasets, pero no se borra: queda en los movimientos, tachada y con el motivo." Con el campo obligatorio "Motivo de la anulación" (hasta 500 caracteres) y los botones "Cancelar" y "Anular nota". El aviso: "Nota DGMIT N° 156/26 anulada."
- Cada corrección y cada anulación queda en el historial de la nota, con quién, cuándo, el motivo y los datos que tenía antes (número, tipo, fecha y datasets).
- Cómo se ve: una nota corregida muestra sus datos actuales y, en el detalle, "Corregida el dd/mm/aaaa a las hh:mm por X: motivo." (todas las correcciones, la más nueva primero). Una nota anulada se ve tachada en los movimientos de la pantalla, con "Anulada el dd/mm/aaaa por X: motivo." en el detalle; no cuenta en nada más (ni circuito, ni cinta, ni lista, ni PDF).
- Si una corrección le saca un dataset a la nota, la nota deja de aparecer en el Seguimiento de ese dataset (no lo pedía). El historial lo conserva en la base.

## 4. Los datos

Tres tablas nuevas (de 24 a 27). No se reusan las de Notas Digitales (`notas_digitales`, `notas_digitales_datasets`): todo lo que lee de ellas (los avisos del ciclo, las reiteraciones, el Libro) contaría las notas DGMIT como avisos del RPAD.

```sql
CREATE TABLE notas_dgmit (
  id int(11) NOT NULL AUTO_INCREMENT,
  numero varchar(40) NOT NULL,
  tipo enum('solicitud','reiteracion') NOT NULL,
  recibida date NOT NULL,                       -- el día en que el área recibió la nota
  anulada tinyint(1) NOT NULL DEFAULT 0,
  creado_por int(11) DEFAULT NULL,              -- quién la cargó (FK usuarios, ON DELETE SET NULL)
  created_at timestamp NULL DEFAULT current_timestamp(),
  updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id), KEY (recibida), KEY (creado_por)
);

CREATE TABLE notas_dgmit_datasets (
  nota_id int(11) NOT NULL,                     -- FK notas_dgmit ON DELETE CASCADE
  dataset_id int(11) NOT NULL,                  -- FK datasets ON DELETE CASCADE
  PRIMARY KEY (nota_id, dataset_id), KEY (dataset_id)
);

CREATE TABLE notas_dgmit_historial (
  id int(11) NOT NULL AUTO_INCREMENT,
  nota_id int(11) NOT NULL,                     -- FK notas_dgmit ON DELETE CASCADE
  accion enum('correccion','anulacion') NOT NULL,
  motivo varchar(500) NOT NULL,
  anteriores longtext DEFAULT NULL,             -- JSON: { numero, tipo, recibida, datasets: [ids] } antes del cambio
  usuario_id int(11) DEFAULT NULL,              -- FK usuarios ON DELETE SET NULL
  created_at timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id), KEY (nota_id)
);
```

Con el estilo de `database/schema.sql` (InnoDB, utf8mb4_unicode_ci, nombres de las FK como los demás). La unicidad del número se valida en la API, dentro de la transacción, no con un índice: una nota anulada puede tener el mismo número que una vigente. Las fechas de `created_at` (TIMESTAMP) se leen con `UNIX_TIMESTAMP` y `ahoraArgentina`, como el resto del Seguimiento.

## 5. Las reglas

- `fuentesDe` (`services/seguimientoDatos.js`, solo lectura) suma `notasDgmit` a las fuentes de cada dataset: `[{ id, numero, tipo, recibida, anulada, cargada, por, por_id, datasets, historial }]`. `cargada` es el momento de la carga en hora argentina, `por` el nombre de quien la cargó, `datasets` todos los datasets de la nota (`{ id, titulo }`, por título; "Corregir" los necesita y el detalle nombra a los otros) y `historial` sus correcciones y anulación (`{ accion, motivo, por, momento }`, la más nueva primero). Todas, también las anuladas. `tests/seguimiento-casos.js` y los demás armadores de fuentes la reciben vacía.
- **Nunca frena una Nota Digital.** `fuentesDe` también arma el anexo de la reiteración, y si el anexo falla la reiteración no se genera. Por eso la consulta de las notas DGMIT va aislada: si falla (por ejemplo, porque falta la migración), se registra el error y cada dataset queda con `notasDgmit` vacía; el resto de las fuentes y el anexo salen como siempre.
- Las reglas viven en `services/seguimientoReglas.js` (puro). Lo de validar la carga, en un módulo puro nuevo, `services/notasDgmitReglas.js` (sección 8). Ninguna función tira error y una fuente sin `notasDgmit` es una lista vacía.
- **Vigentes:** las no anuladas con `recibida` igual o anterior a hoy (el anexo de la reiteración calcula con la fecha de la nota como hoy).
- **A qué ciclo pertenece:** al que regía el día en que el área la recibió, con el momento `recibida 00:00:00` (`cicloDelAviso(ciclos, momento)`). Si una actualización se aprobó ese mismo día, la nota queda en el ciclo anterior: se mandó antes de que llegaran los datos. Si ningún ciclo regía ese día (una nota anterior al primer ciclo, o posterior a la baja), `cicloDelAviso` da el ciclo 0, que con un solo ciclo es el abierto (por ejemplo, un dataset sin alta conocida y sin actualizaciones registradas: su único ciclo "empieza" en su vencimiento). En ese caso, y solo en ese, la nota cuenta para el ciclo abierto únicamente si `recibida` no es anterior a la última carga en el portal (`dataset.ultima`; sin ella, o si no es una fecha, cuenta): una nota anterior ya la respondió esa carga o una anterior (ruling R7 de la revisión final, 24/10/2026). Vale para todo lo que muestra la nota del ciclo abierto: el circuito (pantalla, PDF y anexo), la columna de la lista y la pista de solicitud repetida. `cicloDelAviso` no cambia.
- **La nota del ciclo abierto:** la vigente más reciente del ciclo abierto (por `recibida`, después `cargada`, después `id`). Sin ciclos (eventual o sin fecha), la vigente más reciente de todas.
- Una nota DGMIT no cambia `avisosDelCiclo`, `ultimoAviso`, `ciclosDe`, `hitosDe` ni el estado.

## 6. Cómo se ve en la pantalla

**El circuito** (`circuitoDe`, `tramoFuera`), solo en gestión externa:
- Con nota en el ciclo abierto, el tramo pasa a línea llena violeta (#5B4691): título "Nota DGMIT N° 156/26" y texto "Solicitud recibida por el área el 22/10/2026, hace 2 días" ("hoy", "hace 1 día"; "Reiteración recibida…" si es una reiteración). Se muestra la del ciclo abierto aunque el dataset esté en "Requiere nota DGMIT: No" (si la nota existió, se muestra, como el email de los 40 días); en ese caso el recuadro del medio vuelve a decir "Mandan la nota formal al área", para no contradecir al tramo.
- Sin nota, línea punteada gris y título "Nota formal", con uno de tres textos:
  - "Pendiente de carga": el ciclo abierto ya tuvo algún aviso del RPAD o ya venció (ya hacía falta la nota).
  - "Todavía no hizo falta": el ciclo abierto todavía no tuvo avisos y no venció, o no hay ciclos (eventual o sin fecha). Es la misma frase del recuadro de avisos.
  - "Ya no se pide": el dataset está dado de baja.
- Con "Requiere nota DGMIT" en No y sin nota, como hoy: "Sin nota formal / Los datos se obtienen de la fuente".
- `tramoFuera` suma `registrada` (true con nota), `nota` (`{ numero, tipo, recibida }` o null) y los textos del PDF (`tituloPdf`, `textoPdf`; sección 7).
- El renglón "Al área" de la pantalla (el email de los 40 días) no cambia.

**Los movimientos.** Un tipo nuevo, `dgmit`, con su filtro "Notas DGMIT" (después de "Emails al área"; la cantidad cuenta también las anuladas).
- Título: "Nota DGMIT N° 156/26 al área: solicitud" (o "…: reiteración").
- Detalle: "Recibida por el área el 22/10/2026." y, si la nota pide otros datasets, "La misma nota pide también Gasto Público y Presupuesto Municipal." Si está anulada, "Anulada el dd/mm/aaaa por X: motivo."
- Quién: "Cargó Diego Cuatro" (nombre corto). Sin nombre conocido, nada.
- `fecha`: `recibida`; `momento`: `recibida 00:00:00` (para el orden dentro del día).
- Al desplegarlo: Número de nota DGMIT, Tipo de nota ("Solicitud: la primera vez que se le piden los datos al área" o "Reiteración: ya se le habían pedido y se le vuelven a pedir"), Recibida por el área, Área (la del dataset hoy), Datasets de la nota (todos, uno por renglón), Cargada (momento y quién), las correcciones y, si corresponde, "Corregir" y "Anular".
- Una anulada se ve con el título tachado y el texto en gris.

**La cinta.** Una marca violeta en la fila de abajo (la de los emails al área y las propuestas rechazadas), el día de la recepción: un rectángulo lleno, como una hoja. Prioridad dentro de la fila: nota DGMIT, después rechazo, después email al área. Detalle de la marca, como el de todas: la fecha y el título del movimiento ("22/10/2026: Nota DGMIT N° 156/26 al área: solicitud"). Leyenda: "Nota DGMIT al área". Las anuladas no tienen marca.

**La lista "Sin elegir".** Una columna nueva, "Última nota DGMIT al área": "N° 156/26" y abajo, más chico, "Solicitud, recibida el 22/10/2026", o "—". Es la nota del ciclo abierto (sección 5). `resumenParaLista` suma `requiere_nota` (1, 0 o null, como la ficha) y `nota_dgmit` (`{ numero, tipo, recibida }` o null). En el teléfono, la columna se acomoda como las demás.

**El estilo.** El violeta es un token del `<style>` de `seguimiento.html` (`--sg-violeta: #5B4691`, contraste mayor a 7:1 sobre blanco). En alto contraste (`forced-colors`) la línea llena y la punteada se siguen distinguiendo por el trazo.

## 7. El PDF y el anexo de la reiteración

- El tramo del circuito: con nota, línea llena violeta, título "Nota DGMIT" y texto "Solicitud 156/26. Recibida el 22/10/2026" (sin "hace N días": el anexo queda guardado y se lee después). Sin nota, punteado gris con "Nota formal" y el mismo texto de la pantalla ("Pendiente de carga", "Todavía no hizo falta" o "Ya no se pide").
- El renglón "Al área": con nota, "Al área: el 22/10/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset." (reemplaza al texto del email de los 40 días, que sigue en la cinta y en los movimientos). Sin nota, como hoy.
- Los movimientos de la hoja incluyen los de notas DGMIT vigentes (las anuladas no van). `FILAS_PDF` sigue en 8 y la hoja sigue siendo una.
- La marca y su renglón en la leyenda, como en la pantalla (la leyenda solo lista los tipos que aparecen).
- El anexo de la reiteración: `seguimientosDeLaNota` arma cada hoja con `fuentesDe` y `seguimientoDe`, así que lleva las notas DGMIT cargadas hasta el momento en que se genera. Lo ya generado no cambia (queda en bytes).
- **En el anexo, sin nota, el tramo es neutral** (decisión del usuario, 24/10/2026): "Nota formal / La manda la DGMIT al área", en lugar de "Pendiente de carga", "Todavía no hizo falta" o "Ya no se pide". El anexo le llega solo a la DGMIT y a la Dirección Administrativa con cada reiteración, y la tabla arranca vacía: sin esto, todas las hojas dirían "Pendiente de carga" desde el primer día. Con una nota cargada, el anexo la muestra en violeta, igual que el PDF. Vale también para la vista previa y la prueba del anexo en Correos (son el mismo anexo). El PDF que se descarga desde el Seguimiento y la pantalla siguen con los tres textos de la sección 6. El renglón "Al área" del anexo sin nota sigue como hoy. Cómo le llega esa opción a `circuitoDe` (por ejemplo, un parámetro de `seguimientoDe` que pasa `seguimientosDeLaNota`) queda para quien lo construye.

## 8. La API

- `POST /api/notas-dgmit`: carga una nota. Cuerpo `{ numero, recibida, tipo, datasets: [ids] }`. Responde 201 `{ success, data: { id, numero, tipo, recibida, datasets }, message }`.
- `PUT /api/notas-dgmit/:id`: corrige. El mismo cuerpo más `motivo`. Solo quien la cargó o administración (403 si no); 404 si no existe; 409 si está anulada.
- `POST /api/notas-dgmit/:id/anular`: anula. Cuerpo `{ motivo }`. Mismos permisos y respuestas.
- Las tres con `authMiddleware` y un middleware nuevo que exige `puedeCargarNotasDgmit(req.user.rol)` (403 "No tenés permiso para cargar notas DGMIT."). Sin sesión, 401. Un id que no es un entero positivo da 404, como en el Seguimiento.
- Validación pura en `services/notasDgmitReglas.js`: `validarNotaDgmit(entrada, hoy)` devuelve `{ datos, errores }` (errores por campo, con los mensajes de la sección 2) y `validarMotivo(motivo)`. El controlador (`controllers/notasDgmitController.js`) chequea en la base que los datasets existan y se puedan elegir (activos, externos, `requiere_nota` NULL o 1; en una corrección, también los que la nota ya tenía) y que el número no esté repetido. Un dataset que no se puede elegir da 400 con "«título» no se puede elegir: solo los datasets activos de gestión externa que requieren nota DGMIT."
- Cargar, corregir y anular son transacciones (`beginTransaction`/`commit`/`rollback`): cabecera, datasets e historial juntos.
- `GET /api/seguimiento` suma `requiere_nota` y `nota_dgmit` a cada fila. `GET /api/seguimiento/:id` pone `extra.editable` en cada movimiento `dgmit` según quién mira (quien la cargó, si todavía tiene un rol que carga notas, o administración) y saca `por_id` de la respuesta.
- La página llama a estas rutas con `API.pedirJson`, como el resto del Seguimiento: `api.js` no cambia.

## 9. La importación de las notas anteriores (después)

No es parte de esta entrega. Cuando la Dirección Administrativa devuelva el Excel completo (`Notas DGMIT a las áreas - para completar.xlsx`: hojas Solicitudes y Reiteraciones, con ID, dataset, área, número, fecha de recepción y observaciones), se arma un SQL que inserta en `notas_dgmit` y `notas_dgmit_datasets`: una nota por número (las filas con el mismo número se juntan en una nota con varios datasets), `tipo` según la hoja y `creado_por` la cuenta de quien la importe. El script que arma el SQL aplica las mismas reglas que la API (fecha, largo del número, datasets que se pueden elegir, número no repetido) y lista lo que no pudo cargar.

## 10. Pruebas

- `tests/seguimiento-reglas.test.js` (puro): a qué ciclo pertenece una nota (incluido el día de una actualización aprobada), cuál es la del ciclo abierto, las anuladas y las posteriores a hoy no cuentan, los tres textos sin nota, el externo con "No" con y sin nota, gestión interna sin cambios, el movimiento `dgmit` (título, detalle, otros datasets, anulada, quién), que una nota DGMIT no cambia avisos, ciclos, hitos ni estado, y `resumenParaLista` con `requiere_nota` y `nota_dgmit`.
- `tests/notas-dgmit-reglas.test.js` (puro): `validarNotaDgmit` y `validarMotivo` con cada mensaje, los bordes de la fecha (01/01/2025, hoy, mañana) y el número de 40 y 41 caracteres.
- `tests/seguimiento-cinta.test.js`: la marca en la fila de abajo, la prioridad y que la anulada no tiene marca.
- `tests/seguimiento-pdf.test.js` (con `tests/pdf-lector.js`): el tramo con y sin nota, el renglón "Al área", la fila de la nota en los movimientos, la leyenda, una sola hoja y que nada se pise; el anexo con una hoja con nota y otra sin (la que no tiene nota, con "Nota formal / La manda la DGMIT al área" y nunca "Pendiente de carga").
- `tests/seguimiento-frontend.test.js` (en el `vm`): la columna de la lista, el circuito con la clase de la línea llena, el detalle del movimiento con y sin "Corregir" y "Anular", la anulada tachada, el armado del formulario (grupos, alcance, estado de cada dataset, preselección) y el aviso de solicitud repetida.
- `tests/notas-dgmit-api.test.js` (Docker): cargar, corregir y anular; los permisos (lector 403, colaborador puede, colaborador no corrige la de otro, administración corrige cualquiera); los 400 de cada campo y del dataset que no se puede elegir; el 409 del número repetido (y que una anulada no lo bloquea); el 409 de corregir o anular una anulada; el historial; que `GET /api/seguimiento/:id` muestra la nota con `editable` según quién mira.
- `tests/permisos.test.js`: las tres rutas nuevas (sin sesión 401, lector 403).
- `tests/schema.test.js`: las tres tablas y el rol nuevo en `schema.sql` y en la migración.
- Usuarios (los tests que ya existen del panel y de `usuariosReglas`): el rol nuevo en el alta y la edición, lo que puede el editor con un colaborador, el aviso al superadmin por un cambio de rol de lector a colaborador.
- `npm test` completo antes y después (regla del proyecto).

## 11. Documentación y despliegue

- **Revierte una decisión del Seguimiento.** El spec del Seguimiento (`2026-10-20-seguimiento-dataset-design.md`, línea 63) dice "No hay carga manual de movimientos… también para las notas formales". Se agrega ahí una nota que apunta a este documento, y se actualizan CLAUDE.md (roles, base de datos con 27 tablas, la sección del Seguimiento y una sección nueva "Notas DGMIT") y el README.
- **Migración:** `database/updates/migracion-notas-dgmit.sql`, aditiva y repetible: el `MODIFY` del rol (sin tocar los valores que ya hay) y los tres `CREATE TABLE IF NOT EXISTS`. Va **antes** del código.
- **Vuelta atrás:** `database/updates/rollback-notas-dgmit.sql`. Va después de volver a los archivos anteriores. Pasa los colaboradores a lector, vuelve el rol a los cuatro valores de antes y borra las tres tablas (se pierden las notas cargadas: el kit lo advierte). Siempre, sin condición: un `MODIFY` condicionado no se puede escribir en SQL plano para phpMyAdmin, y el resultado es el mismo que pasar a lector a mano a los que queden (decisión R1 de la ejecución, como el rollback del editor, que pasa los editores a admin). Si también se deshacen las entregas del editor, va **antes** que `rollback-editor-sin-responsabilidad.sql` y `rollback-editor-auditoria.sql`, que no conocen el rol colaborador.
- **No volver a correr** `migracion-editor-auditoria.sql` (ni `migracion-usuarios-superadmin.sql`) después de esta migración: fijan el rol sin `colaborador` y, con un colaborador cargado, fallan o le dejan el rol vacío. El README y el kit lo advierten.
- **Kit en el Escritorio:** `RPAD-deploy-notas-dgmit`, como los anteriores (migración, archivos, Restart, verificación). No cambia el cron ni las variables de entorno y no sale ningún email.

## Decisiones mías (para que las revises)

1. **Dos textos más para cuando no hay nota.** "Pendiente de carga" solo cuando ya hacía falta la nota (el RPAD ya avisó o el dataset ya venció). Antes de eso, "Todavía no hizo falta"; un dataset dado de baja, "Ya no se pide". Así un dataset que vence dentro de 8 meses no aparece con algo "pendiente".
2. **El número no se repite.** Dos notas sin anular no pueden tener el mismo número, para que la misma nota no quede cargada dos veces si la cargan la DGMIT y la DDPC. Si la DGMIT usara el mismo número para notas distintas, hay que sacar esta regla.
3. **El editor maneja colaboradores.** Crea y modifica lectores y colaboradores, y pasa a alguien de uno a otro (como mostraba la maqueta de Usuarios).
4. **Corregir conserva la nota.** Una corrección cambia los datos de la nota y guarda los anteriores en el historial (no anula y carga otra): en los movimientos queda una sola fila, con sus correcciones en el detalle.
5. **El PDF no muestra las anuladas.** La pantalla las muestra tachadas; la hoja impresa, no.
6. **"Al área" en el PDF.** Con nota, el renglón nombra la nota y deja de nombrar el email de los 40 días (no entran los dos en un renglón; el email sigue en la cinta y en los movimientos).
7. **Fecha mínima 01/01/2025**, como en el Excel.
8. **Una nota recibida el mismo día de una actualización** queda en el ciclo anterior.
9. **Un externo con "No" que tiene nota** muestra la nota y el recuadro del medio vuelve a "Mandan la nota formal al área".
10. **La consulta de las notas DGMIT va aislada** en `fuentesDe`: si falla, las notas quedan vacías y la reiteración sale igual.
11. **Una línea de ayuda para cada rol** en Usuarios, con los textos de la maqueta (el del lector, ajustado a lo que de verdad ve: las Herramientas).
12. **Detalles para quien lo construye:** el movimiento lleva los datasets de la nota con id y título (`extra.datasets`), porque "Corregir" los necesita; el aviso de solicitud repetida no cuenta la nota que se está corrigiendo; el número repetido se controla con `SELECT … FOR UPDATE` dentro de la transacción.

## Lo que queda para quien lo construye

- Los nombres internos que este documento no fija (funciones, clases CSS, ids del HTML), siguiendo los de `seguimiento.js` y `seguimiento.html`.
- El dibujo exacto del ícono de la nota en la cinta y en la leyenda (un rectángulo lleno violeta, del tamaño de las otras marcas).
- El orden de los métodos nuevos en `api.js` y de las rutas en `routes/index.js`.
- Cómo se reparte el código del modal entre lo puro (lo que arma HTML, en `seguimiento.js`, cargado por los tests en el `vm`) y lo que toca el DOM y la API (al final del archivo).
