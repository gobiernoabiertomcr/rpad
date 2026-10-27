# Mi espacio: la planilla de horas extras de contrato (diseño)

Fecha: 27/10/2026. Rama: `claude/mi-espacio-horas-9c3d4b`. Maqueta: `docs/superpowers/specs/2026-10-27-mi-espacio-horas-mockups/` (abrir `index.html` con un servidor estático; `?abrir=2026-10` abre la planilla directo). Relevamiento del código de hoy: la nota `mi-espacio-horas-relevamiento.md` de la carpeta de notas de la coordinadora (fuera del repo).

Va **después** de «Mi espacio: confirmación y Word de la licencia» (rama `claude/mi-espacio-licencia-word-codigo`, en curso) y **antes** de «Feriados en las Notas Digitales». El plan arranca trayendo el main de ese momento.

## 1. Qué es y por qué

Hoy una persona de contrato carga cada hora extra como un horario suelto «de … a …» en el modal «Cargar horas extras», igual que una de planta: un horario por vez, el modal se cierra y queda vacío en cada «Guardar», la media hora la controla el servidor al guardar, y el día por día se mira mes por mes. Pero el contratado no piensa en horarios sueltos: tiene una jornada fija de 8:00 a 15:00 y lo que cuenta es **a qué hora se fue**. Lo que tiene a mano es una planilla de entradas y salidas como la del reloj (el CSV de ejemplo del usuario).

La idea del usuario: para contrato, «Cargar horas extras» abre una **planilla del mes** con una fila por día, donde se anota la salida (y, si se quiere, la entrada), y el sistema calcula solo las horas extras de cada día con la regla de las medias horas y su tolerancia. Arriba se ve cuánto suma el mes, dicho como lo piensan ellos: **en días de franco y horas** («En noviembre vas a tener 2 días de franco y 4,5 horas a favor»), porque «los contratados aspiran a sumar de a 7 horas para tomarse el día completo».

Al usuario le encantó la maqueta («ME ENCANTO», «esta tremendo todo»). Este documento es esa maqueta más las reglas que definió en la charla del 27/10/2026.

## 2. Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Cargar un mes entero de salidas en una sola pantalla, rápido (con el teclado: Enter salta a la salida del día siguiente) y con un solo «Guardar».
- Que cada día diga en el momento cuántas horas extras da, con la regla del usuario, y que la pantalla, el servidor y lo que se usa después den siempre el mismo número.
- Decir lo que se suma en días de franco (7 horas) y horas, en la planilla y en la tabla de la pestaña.
- Que funcione bien en el teléfono (cada día, una tarjeta) y con lector de pantalla.

**No objetivos**
- **Planta no cambia**: sigue con su modal «Cargar horas extras al 100%» (día, de, a, nota), sus reglas y su día por día (respuesta del usuario: «Planta queda como está»).
- No cambia cómo se **usan** las horas a favor: siguen siendo horas a favor del mes siguiente, que se usan desde «Cargar licencia» → «Horas a favor», de a media hora, y 7 horas son el día entero. «Días de franco» es solo una forma de decirlo (respuesta del usuario). No hay un tipo «franco» nuevo para contrato.
- No cambian lo no utilizado, el uso autorizado, el saldo inicial (`horas_no_utilizadas`), el Resumen, «Cargar licencia», el email de vencimiento de las 8:15, Configuración → Licencias, «Hoy no están» ni la agenda (todos siguen diciendo horas; los números se recalculan solos porque salen de las mismas reglas).
- Sin un segundo horario el mismo día (volver a la noche por un evento): «No pasa» (respuesta del usuario).
- Sin control de la hora de entrada en un día hábil: «El horario de ingreso no hay que controlarlo».
- Sin migrar horas cargadas antes: «Nadie cargó todavía» (respuesta del usuario; el kit lo comprueba, sección 11).

**Antiobjetivos**
- Que la planilla diga un número y lo que después se puede usar sea otro (la cuenta tiene una sola regla, en el servidor, y la copia de la página está atada por tests de paridad).
- Que se pierda lo cargado en la planilla sin aviso (cambiar de mes no lo pierde; cerrar con cambios pregunta).
- Que algo diga «perdiste» o reproche (lo de siempre de Mi espacio).
- Que se rompa algo de planta, del Resumen o del Word de la licencia.

## 3. Las reglas (decididas por el usuario, 27/10/2026)

**La jornada de contrato** es de 8:00 a 15:00, **la misma para todas las personas de contrato** (fija en el código; si algún día hace falta otra, se suma después como dato de la persona).

**Un día hábil** (lunes a viernes que no es feriado, con los feriados de la tabla: `esDiaHabilCon`): cuenta **solo la salida**, desde las 15:00. La entrada es opcional y no cuenta. Las horas extras son los minutos después de las 15:00, de a media hora, y **una media hora vale desde su minuto 16** (pueden faltar hasta 14 minutos):

```
minutos = salida − 15:00            (si es negativo, 0)
horas   = floor((minutos + 14) / 30) / 2
```

Los 19 renglones del CSV del usuario (mayo de 2026), todos verificados:

| Salida | Horas | Salida | Horas | Salida | Horas |
|---|---|---|---|---|---|
| 15:14 | 0 | 15:44 | 0,5 | 16:15 | 1 |
| 15:15 | 0 | 15:45 | 0,5 | 16:16 | 1,5 |
| 15:16 | 0,5 | 15:46 | 1 | 16:45 | 1,5 |
| 15:27 | 0,5 | 15:47 | 1 | 16:46 | 2 |
| 15:28 | 0,5 | 16:00 | 1 | 16:47 | 2 |
| 15:29 | 0,5 | 16:14 | 1 | 17:01 | 2 |
| | | | | 17:15 | 2 |
| | | | | 17:16 | 2,5 |

Una salida antes de las 15:16 (también antes de las 15:00, por ejemplo un día en que usó horas a favor) da 0.

**Un feriado, un sábado o un domingo** (todo día que no es hábil: también los 9 feriados fijos): la entrada es **obligatoria** y cuentan **todos los minutos trabajados, de la entrada a la salida**, de a media hora, con **10 minutos de tolerancia** (una media hora vale aunque falten hasta 10 minutos para completarla):

```
minutos = salida − entrada          (tiene que ser > 0)
horas   = floor((minutos + 10) / 30) / 2
```

Ejemplos del usuario: 79 minutos = 1 hora; 80 = 1,5; 81 = 1,5; 90 = 1,5; 109 = 1,5; 110 = 2; 111 = 2. De 9:19 a 12:10 (171 min) = 3; de 9:20 a 12:10 (170) = 3; de 9:21 a 12:10 (169) = 2,5. De 8:09 a 15:00 = 7; de 8:10 a 15:00 = 7; de 8:11 a 15:00 = 6,5. «Siempre se cuenta desde el horario en que entra» (una entrada a las 7:40 cuenta desde las 7:40).

**La salida es del mismo día** (no pasa la medianoche) y, si hay entrada, va después de la entrada (también en un día hábil, aunque ahí la entrada no cuente).

**Lo que no cambia**: las horas extras de un mes son horas a favor del mes siguiente (`horasAFavorDe`), 1 a 1, con todo lo demás de la spec `2026-10-26-mi-espacio-licencias-y-horas-design.md` §3.6 (vencen a fin de ese mes, lo no usado pasa a «no utilizadas previamente», el uso autorizado, el saldo inicial).

**Días de franco**: para decirlo, cada 7 horas son un día de franco y lo que sobra, horas (`enDiasDeFranco`): 18,5 h → «2 días de franco y 4,5 horas»; 21 h → «3 días de franco»; 20,5 h → «2 días de franco y 6,5 horas»; 4,5 h → «4,5 horas»; 7 h → «1 día de franco». Singular solo con 1.

**Los días de la planilla**:
- Aparecen los días hábiles del mes y los feriados que caen de lunes a viernes (marcados, con su nombre: los de la tabla y los 9 fijos, `NOMBRES_DE_LOS_FIJOS`).
- Un sábado o un domingo aparece si ya tiene algo cargado o si se lo suma con «¿Trabajaste un sábado o un domingo?» (se cuenta como un feriado; respuesta del usuario). Se puede quitar.
- Un día de **licencia de día entero** de Mi espacio (vacaciones, estudios, atención médica, médica extraordinaria, grupo familiar, horas a favor o uso autorizado de 7 horas: `esDiaEntero`) aparece marcado en verde con su tipo («Estudios», «Horas a favor, el día entero») y **no deja cargar** (respuesta del usuario). Es el panel de su dueña: el tipo se ve. Si ese día ya tenía una salida guardada de antes de cargar la licencia (la licencia nunca se frena por eso: «el sistema no frena ningún tipo de licencia»), la salida **sigue sumando**, la fila la muestra con el aviso «Ese día tenés una licencia de día entero: revisá esta salida.» y un «Quitar», y el Resumen la lista en los faltantes (decisión mía, sección 13).
- Un día con **horas a favor o un uso autorizado de menos de 7 horas** aparece con su etiqueta («2 h a favor») y se carga normal; la salida se cuenta desde las 15:00, como siempre (respuesta del usuario).
- Los días que todavía no llegaron se ven en gris («Todavía no llegó.») y no se cargan. Hoy se carga.
- Hoy lleva la marca «Hoy».

## 4. La planilla (la maqueta, `index.html` + `planilla.css` + `maqueta.js`)

Para contrato, «Cargar horas extras» (el del encabezado, `#btn-cargar-horas`, y el de la tarjeta de la pestaña, `data-cargar="horas"`) abre la planilla en lugar del modal de hoy. Como hoy, sin «Mis vacaciones y saldos» completo abre ese modal primero; sin modalidad, los botones no se ven.

Es un modal de administración (`.modal-overlay` / `.modal.me-modal`), más ancho que los otros (900 px) y alto (hasta el alto de la pantalla menos 40 px), que un clic en el velo no cierra:

- **Cabeza**: «Cargar horas extras» y la ×.
- **Arriba, fijo** (no se desplaza): el mes con sus flechas (`.me-flecha`, las de la agenda; no se va a meses que todavía no llegaron ni antes del primer mes de `rangoDeFechas`, del 01/01 de hace dos años) y, al lado, la banda celeste (`--sg-cielo`) con el total del mes en grande («18 h») y la frase: en el mes en curso, «En noviembre vas a tener **2 días de franco** y **4 horas a favor**.»; en un mes que ya pasó, «En octubre tuviste **1 día de franco** y **3,5 horas a favor**.»; sin horas, «Todavía no sumaste horas extras en octubre.» (en curso) o «En septiembre no hiciste horas extras.». La frase se actualiza mientras se escribe.
- **Cuerpo** (se desplaza): «Cómo se cuentan las horas» (un `<details>` cerrado, con las dos reglas en una línea cada una y «Las horas de octubre son horas a favor en noviembre.»); las columnas (Día, Entrada *(opcional)*, Salida, Horas extras), pegadas arriba al desplazar; las filas, agrupadas por semana con un renglón chico «5 al 9 de octubre» y el total de la semana a la derecha; y, al final, «¿Trabajaste un sábado o un domingo?» con un selector de los sábados y domingos del mes hasta hoy que no están y «Sumar el día» (sin ninguno: «No quedan sábados ni domingos para sumar en octubre.»).
- **Cada fila**: la fecha («Lun 05/10») con sus marcas debajo (el feriado en ámbar con su nombre, «Sábado», «2 h a favor»), la entrada (`<input type="time">`, en gris mientras está vacía en un día hábil: es opcional), la salida, las horas del día en una pastilla azul («1,5 h»; «0» en gris con «No llega a media hora»; «—» sin salida; «Poné la entrada» en un feriado con salida y sin entrada; «La salida va después» si está al revés) y, a la derecha, «Nota» (abre un campo debajo de la fila; con nota, se ve en cursiva y el link dice «Cambiar nota»), y «Quitar» en un sábado o domingo. Lo cambiado y no guardado lleva una raya de tinta a la izquierda.
- **Tipos de fila**: feriado con fondo `#FFFBEB` (el de la celda de feriado de la agenda); sábado o domingo con un borde; licencia de día entero en verde claro, con su insignia verde y «Es un día de licencia: no se cargan horas.» en lugar de los campos (con una salida guardada de antes, en cambio: la salida y la entrada como texto, sus horas, el aviso «Ese día tenés una licencia de día entero: revisá esta salida.» y «Quitar»); día que no llegó, en gris, con «Todavía no llegó.».
- **Pie**: a la izquierda, «Todo guardado.» o «**3 días** con cambios sin guardar» (con los meses si hay cambios en más de uno: «(septiembre y octubre)»); a la derecha, «Cancelar» y «Guardar».
- **Cambiar de mes** no pierde lo cargado: los cambios de todos los meses se guardan juntos con un solo «Guardar».
- **Cerrar con cambios** (la ×, «Cancelar», Escape) pregunta en el modal de confirmación de la página: «¿Salir sin guardar?» / «Los cambios de 3 días se pierden.» / «Seguir cargando» (con el foco) y «Salir sin guardar».
- **Guardar**: controla en el navegador (las copias, sección 9) y marca cada error en su fila (rojo, debajo, con `aria-invalid` en el campo y el foco en el primero; si el primero es de otro mes, pasa a ese mes) con «Revisá el día marcado.» / «Revisá los 2 días marcados.» arriba del cuerpo; si todo está bien, manda los días cambiados juntos (sección 8), y al responder cierra, avisa «Horas extras guardadas: 3 días.» (aviso y región viva) y vuelve a pedir el Resumen y la pestaña. Mientras guarda, el botón queda deshabilitado y el modal no se cierra (un doble clic manda un solo pedido). Un error del servidor con días va a esos días; sin días, arriba del cuerpo (`role="alert"`).
- **Teclado**: al abrir, el foco va a la salida de hoy (mes en curso; la fila se centra) o a la primera salida (otro mes); Enter en una salida o en una nota lleva a la salida del día siguiente (en el último, a «Guardar»); Escape cierra (preguntando si hay cambios); al cerrar, el foco vuelve a donde estaba (`respaldoDelFoco`).
- **Teléfono** (720 px o menos): el modal casi a pantalla completa, la cabeza en una columna, sin la fila de columnas, y cada día una tarjeta: arriba la fecha y las horas, debajo la entrada y la salida lado a lado (cada una con su rótulo visible, 44 px de alto) y abajo la nota.

## 5. La pestaña Horas extras de contrato

- La tabla de cada mes no cambia (Mes trabajado | Horas extras | A favor en | Usadas | Situación), salvo que **«A favor en» suma debajo, en chico, lo mismo en días de franco**: «Noviembre 2026» / «2 días de franco y 4 horas» (respuesta del usuario: «Planilla y pestaña»). Viene del servidor (`a_favor_detalle`).
- El **día por día** muestra cada día con salida del mes elegido: «Lun 05/10 | Salida 16:20 · Entrada 08:02 · 1,5 h», «Lun 12/10 *Feriado* | De 09:21 a 12:10 · 2,5 h», «Sáb 24/10 *Sábado* | De 09:00 a 13:20 · 4,5 h», con la nota en cursiva; los que dan 0, en gris con «No llega a media hora»; una salida con aviso (sección 7), con su aviso en ámbar («Ahora es feriado: falta la entrada.», sin horas, o «Ese día tenés una licencia de día entero: revisá esta salida.», con sus horas). «Editar» (con `aria-label` «Editar el lunes 05/10») abre la planilla en ese mes con el foco en la salida de ese día. El total del título («18 horas») es el del mes.
- «Horas no utilizadas previamente», la nota de la regla y el uso autorizado, como hoy.

## 6. Los datos

**Una tabla nueva, `mi_espacio_salidas`** (una fila por persona y día; contrato lee solo esta, planta solo `mi_espacio_horas_extras`):

```sql
CREATE TABLE IF NOT EXISTS mi_espacio_salidas (
  id int NOT NULL AUTO_INCREMENT,
  usuario_id int NOT NULL,
  fecha date NOT NULL,
  entrada time DEFAULT NULL,       -- opcional en un día hábil; obligatoria en uno que no lo es (lo valida la API)
  salida time NOT NULL,
  nota varchar(200) DEFAULT NULL,
  activo tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_mi_espacio_salidas_dia (usuario_id, fecha),
  CONSTRAINT fk_mi_espacio_salidas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);
```

- Las horas **no se guardan**: se calculan con los feriados del momento, como todo Mi espacio. Un feriado que se carga después cambia la cuenta de ese día (y un feriado dado de baja, al revés): ver los faltantes en la sección 7.
- La clave única deja guardar con `INSERT … ON DUPLICATE KEY UPDATE` (vuelve a activar una fila dada de baja). Borrar un día es baja lógica (`activo = 0`).
- Las horas se leen cortadas a `'HH:MM'` (`TIME_FORMAT(…, '%H:%i')`), las fechas con `DATE_FORMAT`, las marcas con `Number()`.
- Sin `CHECK`: valida la API. Va también en `database/schema.sql` (41 → 42 tablas) y en `tests/schema.test.js`.
- `database/updates/migracion-mi-espacio-horas.sql` (aditiva y repetible: un `CREATE TABLE IF NOT EXISTS`) y `rollback-mi-espacio-horas.sql` (después de volver a los archivos anteriores: `DROP TABLE IF EXISTS mi_espacio_salidas`; se pierde lo cargado en la planilla).
- **Por qué otra tabla y no `mi_espacio_horas_extras`**: un horario «de … a …» y una entrada/salida no significan lo mismo; mezclarlos obligaría a saber de qué modalidad era cada fila. Si cambia el vínculo de una persona, cuenta solo lo de la modalidad actual (planta: sus horarios; contrato: sus salidas) y lo otro queda guardado sin contar, y vuelve a contar si vuelve el vínculo (decisión mía; hoy ninguna persona cambió de vínculo).

## 7. Las reglas puras (`services/miEspacioReglas.js`)

- El `Estado` suma `salidas: [{ id, fecha, entrada, salida, nota }]` (solo las activas; `miEspacioDatos.js` las lee en `estadosDe`, en lote como las demás, y `feriadosPara` las suma a las fechas que definen el rango de feriados).
- Constantes: `SALIDA_DE_LA_JORNADA = '15:00'`, `TOLERANCIA_DIA_HABIL = 14`, `TOLERANCIA_DIA_INHABIL = 10` (y, si al constructor le sirve, `ENTRADA_DE_LA_JORNADA = '08:00'`, solo para textos).
- `horasDeLaSalida({ fecha, entrada, salida }, feriados)` → número (de a 0,5) o null: la regla de la sección 3 (null sin salida válida, en un día no hábil sin entrada válida o con la salida antes o igual a la entrada). Horas `'HH:MM'` con cualquier minuto (`00:00` a `23:59`). Nunca tira.
- `horasPorMesDeSalidas(salidas, feriados)` → `Map('AAAA-MM' → horas)`, como `horasPorMes`.
- `horasAFavorDe` pasa a tomar las horas por mes de `estado.salidas` (con los feriados que ya recibe); `francosDe` sigue con `estado.horasExtras`. `mesesTrabajados` recibe el `Map` de horas en lugar de la lista (o lo que el constructor prefiera, sin cambiar lo que devuelven).
- `enDiasDeFranco(horas)` → «2 días de franco y 4,5 horas» (sección 3); `''` con 0 o con lo que no es un número.
- `textoDeLaSumaDelMes(mes, horas, hoy)` → la frase de la banda (sección 4), plana.
- `validarSalida(dia, contexto)` con `contexto = { hoy, estado, feriados }` → `{ datos, error }` (`error = { campo, mensaje }`). Primero, el formato de la fecha (`MENSAJES_MI_ESPACIO.fecha`); después, **un día con entrada, salida y nota vacías es un borrado** (`datos.borrar = true`) y pasa siempre (también en un día de licencia o uno que no llegó: así se puede quitar cualquier salida guardada). Si no es un borrado, en este orden:
  1. `fecha`: dentro de `rangoDeFechas(hoy)` desde su `desde` hasta **hoy** (`textoRango`; un día que no llegó: «Ese día todavía no llegó.»).
  2. `fecha`: que no sea un día de licencia de día entero de Mi espacio (activa, de la modalidad: `esDiaEntero` y `diasQueDescuentan`, o la cuenta que use el constructor): «Ese día tenés una licencia de día entero: no se cargan horas.».
  3. `entrada` y `salida`: formato `'HH:MM'` («Escribí la hora como 16:45.»).
  4. `salida`: obligatoria si hay entrada o nota: en un día hábil «Falta la salida: es la que cuenta.», en uno que no lo es «Falta la salida.».
  5. `entrada`: obligatoria en un día que no es hábil: «En un feriado, poné también la entrada.» o «En un sábado o domingo, poné también la entrada.».
  6. `salida`: después de la entrada si hay entrada: «La salida tiene que ser después de la entrada.».
  7. `nota`: recortada, hasta 200 caracteres (`MENSAJES_MI_ESPACIO.nota`).
  Los mensajes, en `MENSAJES_MI_ESPACIO`.
- **Avisos de las salidas guardadas que dejaron de cerrar** porque cambió algo después (van con los faltantes del Resumen, `faltantesDe` o al lado, como prefiera el constructor, con la clave `salida:<fecha>`, pero **nunca frenan una carga**: no entran en `problemaDeLaCarga`/`evaluarLicencia`, así una licencia nunca se rechaza por una salida):
  - un día que pasó a ser feriado (o sábado o domingo no cambia: ya lo era) y no tiene entrada: «Revisá tus horas extras del lunes 12/10: ahora es feriado y falta la entrada.». Esa salida **no suma** (no se puede contar sin entrada) y se arregla en la planilla poniendo la entrada;
  - un día en que después se cargó una licencia de día entero: «Revisá tus horas extras del viernes 09/10: ese día tenés una licencia de día entero.». Esa salida **sigue sumando** (así no cambian las horas a favor del mes siguiente ni aparece un faltante de horas a favor por la licencia) y se arregla en la planilla con «Quitar» (o corrigiendo la licencia).
  La baja de un feriado no deja avisos: el día pasa a ser hábil y cuenta la salida desde las 15:00.
- Los demás cálculos (`calcular`, las horas a favor, lo no utilizado, el email, el Resumen) no cambian: leen `horasAFavorDe`.

## 8. La API (`controllers/miEspacioController.js`; `authMiddleware`, siempre sobre `req.user.userId`; en `RUTAS_MI_ESPACIO` de `tests/permisos.test.js`)

**`GET /api/mi-espacio/salidas?mes=AAAA-MM`** (sin `mes`, el en curso; un mes que no es `AAAA-MM`, antes del primer mes de `rangoDeFechas` o posterior al de hoy: 400 en `mes`, antes de leer nada). Sin modalidad: 200 `{ modalidad: null, mensaje }`, como las otras lecturas. En planta: 400 «La planilla es para las personas de contrato.» (`campo` null). Devuelve lo que arma `planillaDelMes` (`services/miEspacioResumen.js`, pura):

```
{ modalidad: 'contrato', mes, mes_texto: 'Octubre 2026', hoy, anterior: '2026-09' | null, siguiente: '2026-11' | null,
  dias: [{ fecha, fecha_texto: 'Lun 05/10', fecha_larga: 'lunes 05/10', tipo: 'habil' | 'feriado' | 'finde',
           feriado: 'Día del Respeto a la Diversidad Cultural' | null, finde_texto: 'Sábado' | 'Domingo' | null,
           licencia: { texto: 'Estudios', entera: true } | null, futuro, hoy,
           entrada: '08:02' | null, salida: '16:20' | null, nota: null | '…',
           horas: 1.5 | null, horas_texto: '1,5 h' | '0' | '',
           aviso: 'Ese día tenés una licencia de día entero: revisá esta salida.' | 'Ahora es feriado: falta la entrada.' | null }],
  fines_de_semana: [ /* los sábados y domingos del mes hasta hoy sin nada cargado, con la misma forma, para «Sumar el día» */ ],
  suma: { horas: 18, cifra: '18', texto: 'En noviembre vas a tener 2 días de franco y 4 horas a favor.' } }
```

**`PUT /api/mi-espacio/salidas`** con `{ dias: [{ fecha, entrada, salida, nota }] }`: cada día con su estado completo (todo vacío = borrar). Controles: modalidad y arranque como las horas extras de hoy (`frenoDeLasHorasExtras`: `sinModalidad`, `sinArranque`, 400 con `campo` null); planta, el 400 del GET; `dias` tiene que ser una lista de 1 a 100 días (`MAXIMO_DIAS_POR_GUARDADO`; «No hay cambios para guardar.» o «Guardá de a 100 días como mucho.», en `dias`), sin fechas repetidas («Ese día está dos veces.»). Después, `validarSalida` de cada día, **todos**: si alguno falla, **no se guarda ninguno** y responde 400 `{ success: false, error, campo, fecha, errores: [{ fecha, campo, mensaje }] }` (`error`, `campo` y `fecha` son los del primero por fecha). Si todos pasan, una transacción (`enTransaccion`, que bloquea la fila de la persona: dos guardados a la vez se ordenan) con un `INSERT … ON DUPLICATE KEY UPDATE` por día (o la baja). Responde 200 `{ success: true, data: { guardados }, message: 'Horas extras guardadas: 3 días.' }` («1 día»). Un 500, «Error al guardar las horas extras». No toca Configuración (las horas extras nunca pasan) ni manda emails.

**Las rutas de hoy** (`POST/PUT/DELETE /mi-espacio/horas-extras…`) a una persona de contrato: 400 «Las personas de contrato cargan sus horas en la planilla.» (`campo` null), así nadie de contrato crea horarios que ya no cuentan. `GET /mi-espacio/horas-extras` sigue igual para las dos, con el `dias_por_mes` de contrato armado con las salidas (sección 5: `{ fecha, fecha_texto, tipo_texto, horario: 'Salida 16:20' | 'De 09:21 a 12:10', entrada_texto: 'Entrada 08:02' | '', horas, horas_texto, cero, nota }`) y `a_favor_detalle` en cada mes.

## 9. La página (`public/mi-espacio.html` y `public/js/mi-espacio.js`)

- Como el resto de `mi-espacio.js`: lo que arma HTML y calcula, puro y primero (la planilla de un mes con los cambios encima, cada fila, la banda, el pie, los errores, el cuerpo del pedido, el día por día nuevo), recibe lo que necesita por parámetro; lo que toca el DOM o la API, al final. Se prueba en el `vm` de `tests/mi-espacio-frontend.test.js`.
- El estado de la planilla, propio (`pagina.planilla`: el mes, los meses ya pedidos, los cambios por fecha, los sábados y domingos sumados, los errores, las notas abiertas, si está guardando y un contador para descartar respuestas viejas); no se cruza con el de los otros formularios.
- Cada mes se pide una vez por apertura (`GET /mi-espacio/salidas?mes=`); cambiar de mes conserva los cambios.
- **Copias mínimas atadas por tests de paridad** (para calcular en el momento; el servidor valida igual): `horasDeLaSalida` (en todos los renglones del CSV, en los ejemplos del feriado y en los bordes: 15:15/15:16, 79/80, 109/110 minutos, sin salida, sin entrada en un feriado, al revés), `enDiasDeFranco`, `textoDeLaSumaDelMes`, `SALIDA_DE_LA_JORNADA`, las dos tolerancias y los mensajes nuevos de `MENSAJES_MI_ESPACIO` que usa la planilla. Las etiquetas de la semana («5 al 9 de octubre») y su total los arma la página (son de presentación, como `diasDeLaGrilla` de la agenda).
- Planta sigue con `abrirHorasExtras` y su modal; contrato abre la planilla. El modal de horas de hoy y su `textoDeLaSuma` quedan para planta (la rama de contrato de `textoDeLaSuma` se puede quitar con sus tests: decisión del constructor).
- Accesibilidad: cada fila es un grupo con el nombre de su fecha (`role="group"` + `aria-labelledby`); cada campo con su `aria-label` («Salida del lunes 05/10», «Entrada (opcional) del lunes 05/10»); el error de una fila en su `aria-describedby`; una región viva propia dentro del modal (con `aria-modal`, la de la página puede no leerse) para el mes que se elige y lo guardado; la banda y las horas de cada fila no son regiones vivas; el foco visible de siempre. Todo texto del servidor pasa por `Utils.escapeHtml` (también en los `aria-label`) y un número va con `String`.
- Estilos en el `<style>` de `mi-espacio.html`, con prefijo propio (la maqueta usa `.mp-`), los tokens `--sg-*` y contraste de al menos 4,5:1 en los textos y 3:1 en los bordes de los controles (`--sg-borde-control`). `VERSION_MI_ESPACIO` sube (después de la del Word).
- Los textos no llevan `maxlength` (la nota cuenta caracteres en el servidor).

## 10. Convivencia con las otras sesiones

- **Word de la licencia** (va antes): toca `guardarLicencia`, `#modal-licencia`, `htmlDeFilaDeLicencia`, `alTocarLicencias`, `miEspacioController.js` (dos rutas nuevas), `miEspacioResumen.js` (`filaDeUnaLicencia`), `miEspacioDatos.js` (`datosDeLaNota`), `routes/index.js`, `VERSION_MI_ESPACIO` y los tests de la página, la API, permisos y páginas. Esta spec no toca nada de eso salvo los mismos archivos en otros lugares; el plan relee el main con el Word mergeado. El Word deduce el mes de las horas extras de un uso de horas a favor por la fecha (−1 mes): sigue valiendo, porque esta spec no cambia de qué mes salen las horas a favor.
- **Feriados en las Notas Digitales** (va después): podría tocar `services/miEspacioReglas.js`; esta spec agrega funciones y no cambia las de las licencias.

## 11. Despliegue (cPanel, sin terminal)

1. **Antes**, en phpMyAdmin: `SELECT COUNT(*) FROM mi_espacio_horas_extras h JOIN usuarios u ON u.id = h.usuario_id WHERE h.activo = 1 AND u.vinculo = 'contrato';` tiene que dar **0** (si no, no se sigue: esas horas dejarían de contar y hay que decidir qué hacer con ellas).
2. `migracion-mi-espacio-horas.sql` **antes de subir el código** (obligatoria: sin la tabla, `estadosDe` falla y Mi espacio entero da 500 para todos, y el email de las 8:15 anota el error).
3. Subir los archivos y Restart. Sin cron nuevo, sin variables de entorno, sin Run NPM Install.
4. Fuera del horario de los crons (8:15, 14:00 y las medias horas).

## 12. Tests (la suite completa antes y después; la de base es la del main del momento)

- `tests/mi-espacio-reglas.test.js` (puro): `horasDeLaSalida` con los 19 renglones del CSV y los ejemplos del feriado, sábado y domingo, un feriado fijo (25/05), uno de la tabla, salida antes de las 15:00, sin salida, sin entrada en un feriado, al revés, horas raras; `enDiasDeFranco` (0, 4,5, 7, 18,5, 20,5, 21); `textoDeLaSumaDelMes`; `validarSalida` en su orden y en sus bordes (hoy sí, mañana no, la licencia de día entero, la de 2 horas, el borrado); `horasAFavorDe` con salidas (mismos resultados que hoy con el caso CONTRATO pasado a salidas); los faltantes nuevos; que planta no cambia.
- `tests/fixtures/mi-espacio-casos.js`: el caso CONTRATO pasa sus `horasExtras` a `salidas` con los mismos totales (septiembre 10,5 h y octubre 4 h; por ejemplo salidas a las 19:00, 19:00 y 17:30 en septiembre y a las 19:00 el 21/10), así las aserciones de hoy siguen igual.
- `tests/mi-espacio-resumen.test.js` (puro): `planillaDelMes` (los tipos de día, las licencias, los días que no llegaron, hoy, los sábados y domingos, la suma) y la tabla de contrato con `a_favor_detalle` y el día por día nuevo.
- `tests/mi-espacio-api.test.js` (Docker): el GET (contrato, planta, sin modalidad, los meses válidos e inválidos), el PUT (alta, corrección, borrado, que todo o nada, cada 400 con su día y su campo, la licencia de día entero, el día que no llegó, el feriado sin entrada, el doble envío, el límite de 100), las rutas de horas extras de hoy a contrato, y que las horas a favor, el Resumen y la tabla salen de las salidas.
- `tests/mi-espacio-frontend.test.js` (`vm`): la planilla pura (las filas de cada tipo, la banda, el pie, los errores, el cuerpo), las paridades y, con el DOM y el `fetch` falsos, abrir desde los dos botones, el foco en hoy, cambiar de mes sin perder lo cargado, sumar y quitar un sábado, la nota, Enter, guardar con errores (también de otro mes) y bien, el doble clic, cerrar con cambios, el día por día nuevo y «Editar».
- `tests/schema.test.js` (la tabla, la migración dos veces y la vuelta atrás), `tests/permisos.test.js` (las dos rutas en `RUTAS_MI_ESPACIO`) y `tests/paginas.test.js` (`VERSION_MI_ESPACIO`, el modal y sus ids, los estilos).
- `CLAUDE.md`: la tabla, las rutas, las reglas, las copias de `mi-espacio.js`, el despliegue.

## 13. Decisiones mías (para revisar)

1. Una tabla nueva (`mi_espacio_salidas`) en lugar de reusar la de horas extras; si cambia el vínculo, cuenta solo lo de la modalidad actual.
2. Las horas se calculan siempre (no se guardan): un feriado cargado después cambia la cuenta de ese día. Si una salida deja de cerrar, aparece como aviso en el Resumen y en su fila, sin frenar nada (una licencia nunca se rechaza por una salida): la que pasó a ser feriado sin entrada no suma hasta que se pone la entrada; la de un día en que después se cargó una licencia de día entero sigue sumando hasta que se la quita.
2b. Un día vacío (sin entrada, salida ni nota) es un borrado y pasa siempre, también en un día de licencia o uno que no llegó.
3. Un solo «Guardar» para todos los meses, todo o nada, hasta 100 días.
4. La salida es del mismo día y, si hay entrada, va después de ella también en un día hábil.
5. Los días que no llegaron no se cargan (el servidor los rechaza); hoy sí.
6. Las rutas de horas extras de hoy rechazan a contrato; la planilla rechaza a planta.
7. La navegación de meses va del primer mes de `rangoDeFechas` (enero de hace dos años) al mes en curso.
8. En el día por día de la pestaña aparecen también los días que dan 0, en gris.
9. Cada día conserva su nota opcional (abre con «Nota»).

## 14. Lo que queda para el constructor

Los nombres finales de las funciones y las clases (la maqueta usa `.mp-`), cómo se reparte el código entre `miEspacioReglas.js` y `miEspacioResumen.js`, si `mesesTrabajados` recibe un `Map` o una función, si la rama de contrato de `textoDeLaSuma` se quita, el texto exacto de «Cómo se cuentan las horas» (el de la maqueta sirve), y el detalle visual dentro de lo que muestra la maqueta.
