# Mi espacio: licencias y horas extras

Fecha: 26/10/2026. **Estado: aprobado por el usuario el 26/10/2026.** Salió de la charla del 26/10/2026 sobre el panel personal. Es la segunda de tres entregas:
1. Feriados (`2026-10-26-feriados-design.md`).
2. Mi espacio: licencias y horas extras (este documento).
3. Mi espacio: la agenda (`2026-10-26-mi-espacio-agenda-design.md`).

**Depende de la entrega 1:** los días de licencia se cuentan hábiles, con los feriados cargados.

**Maquetas:** están en `2026-10-26-mi-espacio-mockups/`. Se miran con un servidor estático; el preview `maquetas-mi-espacio`, puerto 8765, sirve la carpeta. Usan el `main.css` real y datos inventados, y hoy es el lunes 26/10/2026.
- **`1-mi-espacio.html`:** la página, con las pestañas Resumen, Licencias, Horas extras y Agenda. El Resumen es el elegido, «Niveles».
- **`2-formularios.html`:** los modales.
- **`4-resumen-opciones.html`:** las cuatro formas que se compararon para el Resumen. Quedó Niveles.
- **La barra oscura de abajo** es de la maqueta, no de la página. Pasa de una pantalla a otra y cambia entre una persona de planta permanente (administradora) y una de contrato (lectora).
- **La maqueta no guarda nada.** Donde no coincida con este documento, manda el documento. Es anterior a las respuestas de la revisión: Sofía Paz, que es lectora, no debería aparecer en «No están» ni en la lista para invitar, y la franquicia se ve «10 a 12», pero se guardan solo las horas.

**Revisión del 26/10/2026 (segunda sesión).** Cuatro agentes leyeron el código y el usuario contestó otra ronda de preguntas. Lo que cambió:
- **La persona a cargo del firmante la elige quien carga la licencia,** sin una regla nueva. Cada licencia lleva su propia autorización, por sus fechas. Por ejemplo, la médica que sigue a las vacaciones va sin persona a cargo (sección 6).
- **Se frena solo el rechazo peligroso de Configuración:** el de la persona autorizada que se quedaría sin días hábiles. Los demás se guardan con el motivo a la vista (sección 6).
- **El email de vencimiento sale desde la fecha de la regla hasta el vencimiento,** una sola vez (sección 9).
- **La franquicia guarda solo el día y las horas** (sección 3.2).
- **«Mostrar a mis compañeros» queda como estaba,** aunque administración ya ve las fechas en Configuración (sección 7).
- Lo que corrigió el análisis del código:
  - el texto del aviso del formulario;
  - lo que pasa cuando una franquicia deja de ser de día entero;
  - «ya empezó» quiere decir antes de hoy;
  - el aviso cuando administración cambia la licencia que cubría una «unida»;
  - el endpoint del firmante;
  - el paso de las 8:15, que va después de las Notas Digitales;
  - las tablas también van en `schema.sql`;
  - lo que llega de la base como texto;
  - la carcasa y los tests que cambian.

  Todo eso queda en las secciones 5 a 12.

## Por qué

Cada persona de la Dirección lleva hoy por su cuenta, en papel o en una planilla, cuántos días de vacaciones le quedan, cuántas horas de franquicia usó, qué horas extras hizo y qué francos le corresponden. Las reglas no son simples: las vacaciones se acumulan y se habilitan en dos mitades, vencen a los dos años, los francos se usan en un mes puntual y las horas a favor de contrato vencen cada mes. Un error se nota tarde, cuando ya no se puede tomar el día.

Mi espacio es un panel personal en el que cada usuario carga sus licencias y sus horas extras, y ve en un vistazo lo que le queda y lo que vence pronto. Lo que carga es suyo: no lo ve nadie más, salvo lo que la persona elige mostrar.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Una página nueva, Mi espacio** (`mi-espacio.html` + `js/mi-espacio.js`), en el menú lateral bajo «Mi cuenta», al lado de Mi Perfil. Es para todos los roles con sesión. Tiene las pestañas Resumen, Licencias y Horas extras; la Agenda se suma en la entrega 3.
- **Las licencias de cada modalidad,** con sus reglas (sección 3), contadas en días hábiles con los feriados.
- **Las horas extras:** en planta, las del 100% y sus francos compensatorios; en contrato, las horas a favor del mes siguiente.
- **El Resumen «Niveles»:** primero «Vence pronto», después «Lo que te queda», con un tanque por saldo, y al costado «Hoy y mañana».
- **Que las licencias de día entero pasen solas a Configuración → Licencias,** con solo las fechas, para quienes pueden tener licencia en el sistema (sección 6).
- **«Hoy no están»:** quien quiere muestra sus ausencias a los compañeros, sin decir de qué son.
- **Un email de aviso** cuando un franco, unas horas a favor o los días de una licencia están por vencer.

**No objetivos**
- No es un sistema de Recursos Humanos: no hay aprobaciones, firmas, certificados ni expedientes. Es un registro personal para llevar la cuenta.
- Nadie ve el panel de otra persona: ni administración, ni un jefe, ni el superadmin (decisión del usuario: «solo quiero que esta sección sea personal para cada usuario»).
- No hay horas extras al 50%: se cobran y no generan francos (decisión del usuario).
- No hay medio día de licencia. Lo que se toma por horas son las franquicias y las horas a favor.
- No cambian `usuarios_licencias` ni las reglas de las licencias de Configuración: Mi espacio las usa como están.

**Antiobjetivos**
- **Que el tipo de una licencia se vea fuera del panel de su dueño.** Una licencia médica es un dato sensible. A Configuración pasan solo las fechas y a los compañeros, solo «no está».
- **Que una cuenta diga «perdiste» o «se perdieron».** Lo que no se usó a tiempo es «no utilizado previamente» y una licencia «vence el 31/12/2026» (pedido del usuario: a veces el Director General autoriza tomarlo igual).
- **Que cargar una licencia en Mi espacio cambie el sistema sin que la persona lo sepa.** Si la licencia pasa a Configuración, el formulario dice antes qué efecto tiene.
- **Que el panel calcule una cosa y el saldo real sea otro** porque se cargó algo dos veces: lo anterior al saldo inicial no descuenta (sección 4).

## 1. La modalidad

La modalidad sale de `usuarios.vinculo`, que carga administración en Configuración → Usuarios:
- **Planta permanente y planta política** tienen las mismas licencias (decisión del usuario).
- **Contrato** tiene las suyas (sección 3).
- **Sin vínculo cargado,** las pestañas Licencias y Horas extras muestran «Pedile a administración que cargue tu modalidad (planta permanente, planta política o contrato) en Configuración → Usuarios.» y no dejan cargar nada. La Agenda funciona igual.
- **Si la modalidad cambia,** el panel aplica la nueva a todo, también a lo cargado antes. Es una limitación conocida: no se guarda el historial de vínculos.

## 2. Días hábiles

Todo lo que se cuenta en días se cuenta en días hábiles: de lunes a viernes, sin los 9 feriados fijos ni los de la tabla `feriados` (entrega 1; `diasHabilesDe`).
- **Una licencia de lunes a lunes** son 6 días hábiles.
- **Una licencia que cruza el 31/12** reparte sus días entre los dos años, cada día en el suyo.
- **No se puede cargar una licencia que no tenga ningún día hábil** (por ejemplo, un sábado y un domingo).
- **Las horas extras se pueden cargar en cualquier día,** también un sábado o un feriado.

Los días hábiles no se guardan: se calculan cada vez, así un feriado nuevo corrige lo ya cargado (entrega 1, sección 6).

## 3. Las reglas

Todas en un archivo puro, `services/miEspacioReglas.js`: sin pool ni `Date` local, con fechas `'AAAA-MM-DD'` y horas `'HH:MM'`, y ninguna función tira error. Los mensajes van en `MENSAJES_MI_ESPACIO`.

### 3.1 Licencia ordinaria (vacaciones), las dos modalidades

- **Cada año tiene su licencia.** Sus días los elige la persona en «Mis vacaciones y saldos»: 10, 15, 20, 25 o 30, según su antigüedad. Si no eligió los de un año, valen los del año anterior.
- **Se habilita en dos mitades:** la primera el 1/7 de ese año y la segunda el 1/1 del siguiente. Con un número impar, la primera mitad es la mayor: 15 se habilitan 8 y 7, y 25 se habilitan 13 y 12. Ejemplo: la licencia 2026 de 20 días habilita 10 el 1/7/2026 y 10 el 1/1/2027.
- **Se acumula y vence** el 31/12 de dos años después: la licencia 2024 vence el 31/12/2026 y la 2025, el 31/12/2027. Lo que no se usó para esa fecha ya no se puede usar.
- **Solo se usan días ya habilitados:** en mayo de 2026 no se puede cargar un día de la mitad que se habilita el 1/7/2026.
- **Se descuenta siempre la licencia más vieja.** El reparto se hace día por día, en el orden de las fechas: cada día hábil de unas vacaciones toma un día de la licencia más vieja que ese día esté habilitada, no vencida y con días libres. Si para algún día no queda ninguno, no se puede guardar: «No te alcanzan los días habilitados: para el 15/06/2026 no te queda ninguno.»
- **Las vacaciones cargadas a futuro** ya descuentan su licencia. En el Resumen se ven como «cargadas», separadas de lo disponible.
- **Cada carga dice de qué licencia salen los días:** «Salen de la licencia 2024, la más vieja. Te quedan 33 días: 3 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.»

### 3.2 Franquicias, solo planta

- **42 horas por año calendario,** que vuelven a cero el 1/1.
- **Se toman por hora entera,** de 1 a 7. Con 7 horas se toma el día entero, que cuenta como ausencia de día completo (sección 6).
- **Solo en un día hábil.**
- **Se guarda el día y cuántas horas,** sin el horario (decisión del usuario). La agenda la muestra como «Franquicia, 2 h».

### 3.3 Licencia por estudios, las dos modalidades

- **El total del año depende de la carrera:** 15 días si es universitaria y 10 si es secundaria. Lo elige la persona cada año, con una tercera opción, «No estudio», que no ofrece el tipo.
- **Se usa por examen:** cada carga es un examen, de 1 a 3 días hábiles. Solo se guardan las fechas, sin materia ni detalle (decisión del usuario).
- **Vuelve a cero el 1/1.**

### 3.4 Atención médica y del grupo familiar, las dos modalidades

- **Atención médica:** hasta 25 días hábiles por año calendario.
- **Atención médica extraordinaria,** por tratamientos de larga duración: sin tope y aparte de los 25.
- **Atención del grupo familiar:** hasta 25 días hábiles por año calendario.
- **Cada día cuenta en su año.** Una carga que pasa el tope no se guarda: «Con esta licencia pasarías los 25 días de atención médica de 2026.»

### 3.5 Horas extras y francos compensatorios, en planta

- **Se cargan solo las horas extras al 100%.**
- **Cada 7 horas extras de un mes dan un franco compensatorio,** que se usa dos meses después y solo durante ese mes. Las horas que no llegan a 7 no generan franco (se cobran) y el panel no las muestra como perdidas.
- **Ejemplos del usuario:**
  - 10,5 horas en octubre de 2026 dan 1 franco para diciembre de 2026.
  - 7,5 horas en noviembre de 2026 dan 1 franco para enero de 2027.
  - 6,5 horas en diciembre de 2026 no dan ningún franco para febrero de 2027.
- **Un franco es un día entero hábil.** Se carga desde «Cargar licencia» → Franco compensatorio, solo en un mes que tenga francos disponibles.
- **Si termina el mes y quedó un franco sin usar,** pasa a «no utilizado previamente»: se sigue viendo, en gris. Si lo autorizan, se puede registrar un uso autorizado, como en contrato (3.6).

### 3.6 Horas extras y horas a favor, en contrato

- **Cada hora extra de un mes es una hora menos de trabajo el mes siguiente:** las horas a favor. Se usan de a media hora (decisión del usuario), y 7 horas son el día entero.
- **Vencen al final de ese mes siguiente.** Lo que no se usó pasa a «Horas no utilizadas previamente», un acumulado del año que vuelve a cero el 1/1.
- **Ejemplos del usuario:**
  - 10,5 horas extras en octubre de 2026 dan 10,5 horas a favor en noviembre, que se pueden usar por ejemplo 7 un día, 2 otro y 1,5 otro.
  - 7,5 horas en noviembre dan 7,5 horas a favor en diciembre.
  - 6,5 horas en diciembre dan 6,5 horas a favor en enero de 2027.
- **Lo no utilizado no se ofrece como saldo para usar.** Se muestra aparte, con su mes de origen. A veces el Director General autoriza tomarlas (pedido del usuario). Para eso está «Registrar un uso autorizado»: fecha y horas, de a media hora, que se descuentan del acumulado, primero las más viejas.

### 3.7 Las horas extras

- **Se cargan con el día y el horario,** de qué hora a qué hora (decisión del usuario), en pasos de media hora. El panel calcula la cantidad.
- **Si el horario pasa la medianoche,** cuenta entero en el día en que empezó.
- **Una nota opcional,** de hasta 200 caracteres.
- **No pueden superponerse** dos horarios del mismo día.

### 3.8 Dos licencias el mismo día

- **Dos licencias de Mi espacio no pueden compartir un día.** Para tomar más horas el mismo día, se corrige la que ya está.
- **Una enfermedad durante las vacaciones no las corta** (respuesta del usuario). Al volver, se presenta la boleta médica, y la licencia médica corre desde el día de la reincorporación. En el panel, las vacaciones quedan enteras y la médica se carga a partir de ese día. Por eso dos licencias nunca comparten un día.

### 3.9 Lo que vence pronto

El Resumen pone arriba, en «Vence pronto», ordenado por fecha:
- **un franco o unas horas a favor del mes en curso que siguen sin usar,** con el último día hábil del mes («Viernes 30/10»);
- **los días de una licencia ordinaria que vence el 31/12 de este año,** desde el 1/10 («3 días de la licencia 2024»), si no están cargados.

Si no hay nada, la sección no aparece.

### 3.10 Cuando lo guardado deja de cerrar

Los días se recalculan cada vez, así que un cambio posterior puede dejar sin cubrir algo ya guardado:
- dar de baja un feriado;
- bajar los días de vacaciones de un año;
- corregir el saldo inicial;
- un tope que se pasa.

**Qué pasa:**
- Esos cambios no se frenan. La baja de un feriado la hace administración, y la persona conoce sus números mejor que el panel.
- Las reglas devuelven un **faltante**, con un texto neutro: «Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.»
- El Resumen lo muestra como un aviso ámbar arriba de «Lo que te queda».
- Lo que sí se frena es una carga nueva que no cierra (3.1 a 3.6).

## 4. El arranque: «Mis vacaciones y saldos»

**La primera vez que una persona entra a Mi espacio,** con su modalidad cargada, se abre solo el modal «Mis vacaciones y saldos». Después se abre desde el Resumen.

**Qué tiene el modal:**
- La modalidad, sin editar, con la aclaración «la carga administración en Configuración → Usuarios».
- Los días de la licencia del año en curso: 10, 15, 20, 25 o 30, con la explicación de las mitades y el vencimiento.
- La licencia por estudios del año: universitaria, secundaria o «No estudio».
- **«Para arrancar»:**
  - lo que quedaba sin usar de cada licencia ordinaria no vencida: las dos anteriores y la del año, por licencia (decisión del usuario);
  - lo que ya se usó en el año de franquicias, estudios, atención médica y grupo familiar;
  - en contrato, las horas no utilizadas previamente del año.

**«Sin usar» de una licencia ordinaria se cuenta sobre lo habilitado el día del arranque.**
- Ejemplo: licencia 2026 de 20 días, arranque el 26/10/2026 (solo la primera mitad habilitada) y «De la 2026: 10». Quiere decir que no usó nada: hoy tiene 10 disponibles y el 1/1/2027 se le suman los otros 10.
- Si el arranque es antes del 1/7, la licencia del año todavía no tiene nada habilitado y el campo no aparece.

**Lo anterior al arranque, solo en lo que tiene saldo inicial.**
- El saldo inicial dice cómo estaban las cuentas el día en que se cargó (la fecha de arranque): vacaciones, franquicias, estudios, atención médica, grupo familiar y, en contrato, las horas no utilizadas previamente.
- De esos tipos, lo que se cargue con fechas anteriores al arranque se guarda y se ve en las listas como historia, en gris («Antes del saldo inicial: no descuenta»), pero no descuenta, porque ya está dentro del saldo inicial. Así no se cuenta dos veces.
- **Las horas extras, los francos y las horas a favor no tienen saldo inicial.** Se cargan las horas extras de los meses que hagan falta (en planta, por lo menos los dos meses anteriores; en contrato, el anterior) y sus usos, con cualquier fecha, y todo descuenta.
- Ejemplo: alguien de planta arranca el 26/10 con horas extras de agosto. Carga esas horas y el franco que usó el 23/10, y el panel muestra el franco que le queda.

**Corregir el saldo inicial.** Se puede corregir después; la fecha de arranque no cambia.

## 5. Lo que se guarda

Las tablas son nuevas, con el prefijo `mi_espacio_` para no confundirse con la «Agenda de pedidos» ni con `usuarios_licencias`. Van en `migracion-mi-espacio.sql` (aditiva y repetible), con su `rollback-mi-espacio.sql`. Los nombres finales quedan para quien lo construye.

- **`mi_espacio_anios`:** `usuario_id`, `anio`, `dias_vacaciones` (10 a 30), `estudios` ('universitario', 'secundario' o NULL), con PK (`usuario_id`, `anio`).
- **`mi_espacio_arranque`:** `usuario_id` (PK) y `fecha` (DATE), el día en que se cargó el saldo inicial.
- **`mi_espacio_saldos`:** el saldo inicial, una fila por concepto. `usuario_id`, `concepto` (por ejemplo 'vacaciones', 'franquicias', 'estudios', 'medica', 'familiar' u 'horas_no_utilizadas'), `anio` (en vacaciones, el de la licencia; en el resto, el del arranque) y `cantidad` DECIMAL(5,1), con PK (`usuario_id`, `concepto`, `anio`).
- **`mi_espacio_licencias`:**
  - `id`, `usuario_id`, `tipo` (enum: vacaciones, franquicia, estudios, medica, medica_extraordinaria, familiar, franco, horas_a_favor y uso_autorizado), `desde`, `hasta` (DATE; iguales en lo de un día) y `horas` (DECIMAL(3,1), solo en franquicia, horas a favor y uso autorizado);
  - `mostrar` (tinyint, «Mostrar a mis compañeros») y `nota` (varchar(200), opcional);
  - lo de Configuración (sección 6): `licencia_oficial_id` (FK a `usuarios_licencias`, ON DELETE SET NULL), `oficial` (enum 'creada' o 'unida', NULL si no pasó) y `sin_pasar` (varchar(200), NULL: el motivo por el que no pasó);
  - `activo` (baja lógica), `created_at` y `updated_at`.
- **`mi_espacio_horas_extras`:** `id`, `usuario_id`, `fecha`, `desde` y `hasta` (TIME), `nota`, `activo`, `created_at` y `updated_at`.
- **`mi_espacio_avisos`:** los emails de vencimiento enviados, para no repetirlos. `usuario_id`, `clave` (por ejemplo 'horas-2026-10' o 'licencia-2024') y `enviado_at`, con PK (`usuario_id`, `clave`).

**Lo que no se guarda:** los saldos, los francos, las horas a favor y lo no utilizado se calculan siempre con las reglas, a partir de lo cargado, el año, el saldo inicial y los feriados.

**Las tablas van también en `database/schema.sql`.** Los tests crean sus bases solo con `schema.sql`, y `tests/schema.test.js` lo compara con la base local, así que la migración se corre también en el Docker local. Con la entrega 1 hay 31 tablas: esta suma 6 y quedan 37.

**Lo que llega de la base como texto:** el pool no tiene `dateStrings` ni `decimalNumbers`, así que los `DECIMAL` llegan como texto (`"7.5"`) y los `TIME`, como `'10:00:00'`. Las fechas se leen con `DATE_FORMAT`, los números con `Number()` y las horas se cortan a `'HH:MM'`.

**El tipo de licencia:** se guarda porque la persona lo carga para su propio control, pero solo lo devuelve la API a su dueño (antiobjetivo).

## 6. El paso a Configuración → Licencias

Lo propuse yo y el usuario lo aprobó: «Está perfecta tu sugerencia».

**Qué pasa.**
- Las ausencias de día completo pasan a `usuarios_licencias`.
- Son ausencias de día completo: vacaciones, estudios, atención médica, médica extraordinaria, grupo familiar, franco, y las franquicias, horas a favor o usos autorizados de 7 horas.
- Pasan solo las fechas, nunca el tipo.
- Cada licencia de Mi espacio es una licencia de Configuración, con `usuario_id` = `creado_por` = la persona.
- Dos licencias seguidas de distinto tipo quedan como dos licencias contiguas en Configuración.

**Para quiénes.**
- Solo para quienes pueden tener licencia en el sistema (`puedeTenerLicencia`: superadmin, admin y editor).
- Al lector y al colaborador no les cambia nada del sistema, porque no auditan ni firman.
- Solo pasa lo que termina hoy o después, porque `validarFechasNuevas` no acepta licencias terminadas. Lo ya pasado queda solo en Mi espacio.

**Con qué reglas.** Las de siempre, sin copiarlas: `validarFechasNuevas`, `validarEdicion`, `puedeAnularse` y `rechazoDeLaBase` (superposición, persona autorizada y días hábiles libres).
- **Una función de servicio para los dos lados.** Se saca de `licenciasController.js`, por ejemplo `cargarLicencia`, `cambiarLicencia` y `anularLicenciaDe`. Reciben la conexión de la transacción y al actor, nunca `req`. No abren ni cierran la transacción, y devuelven el rechazo o la licencia: Mi espacio guarda su fila aunque Configuración rechace (salvo el caso de la persona autorizada, más abajo). `rechazoDeLaBase` y `bloquearUsuarios` hoy son privados: pasan a ese servicio.
- **La regla de `sinCambios` se conserva.** Cambiar el tipo, la nota o «Mostrar» no toca Configuración. Así no se borra `nota_autorizacion_id` y no sale otra nota de autorización.
- **Cada alta, edición y anulación** queda en `usuarios_auditoria`, como hoy.
- **No sale aviso al superadmin:** el actor es la misma persona de la licencia.
- **Configuración sigue con los 9 feriados fijos** (`esDiaHabil`): los días hábiles libres de la persona autorizada y «vuelve el…» se cuentan como hoy.

**El formulario avisa antes de guardar,** en azul: «Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa.» Al superadmin le suma: «Los avisos al superadmin se guardan y te llegan en un resumen a la vuelta.» Para quien audita, muestra también el aviso de días sin auditor de `GET /usuarios/licencias/sin-auditor`, como en Configuración.

**El firmante titular.** Si la persona es el firmante titular de las Notas Digitales, el formulario suma el mismo campo de Configuración, «Autorizo a presentar las notas en mi nombre a:», con sus reglas y el aviso del efecto en las notas.
- **Lo elige la persona al cargar, sin una regla nueva** (decisión del usuario). El campo es opcional y viene vacío. Sin persona autorizada, durante la licencia no se generan notas y lo que vence se reitera a la vuelta: el formulario lo dice.
- **Cada licencia lleva su propia autorización,** por sus fechas, como la nota que sale. Dos licencias seguidas quedan como dos, cada una con la suya: no se unen ni se estiran.
- **El caso del usuario:** el firmante se toma licencia del 26/10 al 10/11 y deja a alguien a cargo. El 11/11 vuelve con boleta médica por el 11 y el 12/11, y se reincorpora el 13/11. Para dejar a alguien a cargo hay que haber ido a trabajar, y no fue: la médica va sin persona a cargo, y esos dos días no se generan notas.
- **Si la licencia empieza hoy o antes,** el formulario avisa: «Las notas de hoy ya salieron a las 8:15 con tu firma.»
- **Los datos del campo** (las personas que se pueden autorizar y sus licencias) hoy vienen solo en `GET /usuarios/licencias`, que es `adminOnly`. Mi espacio los pide con su propio endpoint, que responde solo al firmante titular (sección 10).

**Creada o unida.** La licencia de Mi espacio guarda cómo quedó en Configuración (`oficial`: 'creada', 'unida' o NULL):
- **Creada:** Mi espacio creó la de Configuración.
- **Unida:** ya había una de administración que cubría todas sus fechas, y no se creó otra.

**Si se superpone con una licencia que cargó administración.**
- Si la de Configuración cubre todas las fechas, la de Mi espacio queda **unida**.
- Si se superpone en parte, se guarda en Mi espacio sin pasar a Configuración, con el aviso «Se superpone con una licencia de Configuración del 03/11 al 05/11: revisala con administración».

**Una unida nunca toca la licencia de administración.**
- Corregirla o borrarla en Mi espacio cambia solo Mi espacio.
- Si con la corrección sus fechas quedan fuera de la de administración, se separa y se trata como una nueva: pasa, si puede.

**Corregir o borrar una creada.**
- Si todavía no empezó, se corrige libremente y Configuración la sigue; borrarla anula la de Configuración.
- Si ya empezó, solo se puede cambiar el hasta, como en Configuración, y no se puede borrar («Ya empezó: no se puede borrar»). «Ya empezó» quiere decir que empezó antes de hoy: una que empieza hoy todavía se puede borrar, como en Configuración (`puedeAnularse`).
- Si terminó, las fechas quedan fijas.
- El tipo, la nota y «Mostrar» se pueden cambiar siempre, sin tocar Configuración.
- **Si un cambio de tipo o de horas hace que deje de ser de día entero** (una franquicia de 7 horas que pasa a 3), la de Configuración se anula si todavía se puede. Si no se puede, queda, y el panel lo dice.

**Si administración la cambia en Configuración.** Configuración muestra la insignia «Cargada desde Mi espacio» y la deja editar y anular como siempre:
- si la anula, la de Mi espacio queda como registro personal, sin unir;
- si cambia las fechas, Mi espacio muestra «En Configuración: del … al …». Desde ahí, una corrección en Mi espacio ya no se copia a Configuración, para no pisar lo que hizo administración, y lo avisa.
- **La insignia** se calcula con `EXISTS (SELECT 1 FROM mi_espacio_licencias m WHERE m.licencia_oficial_id = l.id AND m.oficial = 'creada' AND m.activo = 1)`. Va con `EXISTS` y no con un JOIN, porque varias «unidas» pueden apuntar a la misma licencia, y solo cuentan las «creadas»: una unida no hace de Mi espacio una licencia de administración.
- **Si administración acorta o anula la licencia que cubría una «unida»,** el panel lo avisa: «Ya no está cubierta en Configuración del … al …: revisala con administración.». Mi espacio lee `anulada` y las fechas de la de Configuración. La FK `ON DELETE SET NULL` nunca se dispara, porque las licencias se anulan, no se borran.

**Si Configuración la rechaza:**
- **Si sos la persona autorizada del firmante y te quedarías sin ningún día hábil** para presentar las notas, no se guarda (decisión del usuario): las notas saldrían presentadas por alguien que no está. El formulario lo dice: «Sos la persona autorizada del firmante del … al …, y con esta licencia no te quedaría ningún día hábil para presentar las notas. Hablalo con el firmante antes de cargarla.»
- **Por otro motivo** (se superpone en parte con una de administración, pasa de 365 días o tu rol ya no puede tener licencia): se guarda igual en Mi espacio, sin pasar, con el motivo a la vista («No pasó a Configuración: …»). Una ausencia real siempre se puede registrar en el panel propio.

**Si cambia el rol.** Si pasa o no a Configuración se decide cada vez que se guarda o se corrige una licencia, con el rol de ese momento. Cambiar el rol no mueve nada solo:
- un lector que pasa a admin ve pasar sus licencias futuras recién cuando las corrige;
- las de un admin que pasa a lector quedan en Configuración, donde ya no tienen efecto.

## 7. Lo que ven los demás: «Hoy no están»

- **La casilla «Mostrar a mis compañeros que no estoy»,** marcada de entrada, hace que las ausencias de día completo se vean como «Laura Gómez no está», sin el tipo.
  - Controla solo lo que se ve en Mi espacio. Si la licencia pasa a Configuración, administración ve igual las fechas en Configuración → Licencias y en «De licencia hasta» de Usuarios. El usuario decidió dejarla así (26/10/2026).
- **Dónde aparecen:** en «Hoy y mañana» del Resumen y, desde la entrega 3, en la agenda de todos.
- **No se muestran las franquicias ni las horas a favor de menos de 7 horas.**
- **«Los compañeros» son administración:** superadmin, admin y editor (`esAdmin`; respuesta del usuario).
  - Solo ellos ven las ausencias de los demás, y solo se muestran las ausencias de ellos.
  - El lector y el colaborador usan Mi espacio igual, pero sin la casilla «Mostrar a mis compañeros» y sin «No están».
  - Es la misma regla que define a quién se invita en la agenda (entrega 3).
- **La API (`GET /api/mi-espacio/ausentes?desde=&hasta=`)** devuelve solo el nombre, las fechas y la vuelta («Vuelve el lunes 02/11», el siguiente día hábil), nunca el tipo ni la nota.

## 8. Las pantallas

Las medidas, los colores y los textos están en las maquetas. Acá van las reglas.

**La página** sigue el lenguaje del Seguimiento y de Proyectos: tokens `--sg-*`, tarjetas blancas sin sombra, píldoras y pestañas con hash (`#resumen`, `#licencias`, `#horas`; `#agenda` en la entrega 3).
- **Los tokens van en el `<style>` de la página,** como en Proyectos y el Seguimiento, nunca en `main.css`. Los del Resumen de la maqueta (`--rs-*` y las clases `.op-*`) pasan a `--sg-*`, y se definen en la página los que faltan (`--sg-ambar-fondo`, `--sg-gris-fondo` y `--sg-violeta-fondo`).
- **El título** es «Mi espacio», con el ícono `calendar-check` de Lucide. Debajo, una bajada y tres botones (`<button>`, no links): «Nuevo evento» (desde la entrega 3), «Cargar horas extras» y «Cargar licencia».
- **Una marca ámbar en la pestaña Resumen** cuando hay algo en «Vence pronto», con `role="img"` y `aria-label`, como la marca del Estado en Correos (no un `title`).
- **Los modales** son los de administración (`.modal-overlay` y `.modal` con `.active`, `aria-modal`). Un clic en el velo no los cierra, como en Configuración: son formularios largos.
- **Es una de las páginas con carcasa,** que pasan a ser 14 (sección 11).

**Resumen, «Niveles»** (maqueta 1):
- **Arriba, la modalidad y el año.**
- **«Vence pronto»:** cada cosa con su fecha en un bloque amarillo (el día grande y el mes), qué vence y un botón para resolverla («Cargarlo», «Usarlas», «Cargar vacaciones»).
- **«Lo que te queda»:** una fila de tanques que apoyan sobre la misma línea, cada uno con el número grande arriba y el nombre con su total debajo.
  - **El de vacaciones** tiene una capa por licencia, de abajo hacia arriba: la que vence en el año, en ámbar; las otras, en tinta y en azul medio; las cargadas a futuro, rayadas; y lo que todavía no se habilita, punteado. Al lado lleva la lista de cada licencia con su número y su vencimiento.
  - **Los demás:** franquicias (o horas a favor de este mes en contrato), estudios, atención médica y grupo familiar. Uno que vence este mes va en ámbar.
  - **Debajo, los francos (o las horas a favor) mes por mes, en pastillas:** la del mes que vence en amarillo, la que todavía suma punteada y lo no utilizado previamente en gris. Una línea aclara la médica extraordinaria.
  - **Cada tanque es un link** a su pestaña, con el foco visible del RPAD.
  - **El único movimiento de la página:** al abrir, los tanques se llenan desde abajo una vez, y no se mueven con `prefers-reduced-motion`.
- **Al costado, «Hoy y mañana»:** «No están», el próximo feriado y, desde la entrega 3, los eventos de hoy y mañana. En el teléfono va debajo.

**Licencias:**
- la lista del año, con el selector de año y los filtros por tipo como botones con su cantidad;
- cada fila tiene las fechas (con los días hábiles o las horas), la insignia del tipo, «Próxima» si no empezó, de qué licencia salen las vacaciones, si pasó a Configuración, si se muestra a los compañeros y «Editar»;
- al final, el saldo inicial con «Cambiar», y una nota: «Los días se cuentan hábiles: sin sábados, domingos ni feriados».

**Horas extras:**
- **En planta,** la tabla por mes: horas, francos, para usar en, situación. Debajo, el mes en curso día por día.
- **En contrato,** la tabla por mes: horas extras, a favor en, usadas, situación. Debajo, «Horas no utilizadas previamente» con su mes de origen y «Registrar un uso autorizado».

**Formularios** (maqueta 2), con la accesibilidad de los modales del RPAD (el foco, Escape, `aria-invalid` y los mensajes debajo de cada campo):
- **«Cargar licencia»:**
  - los tipos de la modalidad como opciones grandes, cada una con lo que queda;
  - los campos del tipo elegido;
  - el cálculo del servidor antes de guardar: días hábiles, de qué licencia salen y lo que queda;
  - «Mostrar a mis compañeros»;
  - el aviso del paso a Configuración, cuando corresponde.
- **«Cargar horas extras»:** el día, de y a, y la nota, con lo que suma: «En octubre llevás 14 horas: 2 francos para diciembre».
- **«Mis vacaciones y saldos»** (sección 4).
- **«Registrar un uso autorizado».**

## 9. El aviso de vencimiento por email

Es un paso nuevo y aislado de la corrida de las 8:15 (`ejecutarNotificacionesDiarias`), con su propio try/catch y su `resultados.miEspacio`.
- **Va después de las Notas Digitales:** `registrarInicio` borra lo anotado en la última corrida. Sus errores van a `resultados.errores` y a `anotarEnLaUltimaCorrida`, como los de la foto.
- **Sale solo en días hábiles,** con su propio control (`esDiaHabilCon` y los feriados), no con `resultados.dia_habil`, que sigue con los 9 fijos: en Carnaval da hábil.
- **El `Set` de feriados se pide con margen:** «el último día hábil del mes» y «5 días hábiles antes» caminan fuera del mes. Las funciones con feriados que hacen falta (el próximo día hábil y el último hábil del mes) se suman a `services/feriadosReglas.js`.

**Cuándo sale** (decisión del usuario: desde la fecha de la regla hasta el vencimiento, una sola vez):
- **A quien tiene un franco o unas horas a favor del mes sin usar:** desde 5 días hábiles antes del último día hábil del mes, hasta ese último día.
- **A quien tiene días de una licencia ordinaria que vence el 31/12:** desde el primer día hábil de diciembre, hasta el 31/12.
- Sale el primer día de ese tramo en que la persona no está de licencia y la corrida anda. Si ese día falla, sale al siguiente.

**Reglas del envío:**
- Una vez por persona y por cosa (`mi_espacio_avisos`).
- No sale si la persona está de licencia ese día, oficial o cargada en Mi espacio (una ausencia de día completo). Hoy no hay una función que junte las dos fuentes: se suma una, en lote, para todas las personas de la corrida.
- Con `sendEmail` y `to: [email]` después de `emailValido`, nunca con `to` vacío: sin destinatario, `sendEmail` manda a las casillas por defecto de la DGMIT.
- Con `remitente()` y `plantillaSimple`, en el marco de siempre y sin emojis. La plantilla va en `services/emailTemplates.js`, y se suma a los casos de `tests/emails-fixtures.js` y a los mapas `ASUNTOS` y `TEXTOS` de `tests/email-diseno.test.js`.
- **El texto:** «Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.»
- **El botón:** abre `mi-espacio.html#resumen`.
- **El email no dice el tipo de ninguna licencia médica:** solo vacaciones, francos y horas.

## 10. El servidor

`controllers/miEspacioController.js`. Las reglas puras van en `services/miEspacioReglas.js` y las consultas en `services/miEspacioDatos.js`.
- **Todas las rutas llevan `authMiddleware`** y trabajan siempre sobre `req.user.userId`.
- **Un id de otra persona responde 404,** igual que un id que no existe: no se revela que existe.
- **Respuestas `{ success, data?, error?, campo? }`:** un error de validación es 400 con su `campo`.

**Las rutas:**

| Ruta | Qué hace |
|---|---|
| `GET /api/mi-espacio/resumen` | Todo lo del Resumen, ya calculado: modalidad, vence pronto, tanques y pastillas, con los números y los textos (Ruling 19: el navegador no recalcula). |
| `GET`, `PUT /api/mi-espacio/anio/:anio` y `GET`, `PUT /api/mi-espacio/saldo-inicial` | «Mis vacaciones y saldos». |
| `GET /api/mi-espacio/licencias?anio=`, `POST`, `PUT /:id` y `DELETE /:id` | Las licencias, con el paso a Configuración en la misma transacción. Borrar es una baja lógica. |
| `POST /api/mi-espacio/licencias/calculo` | El cálculo antes de guardar, sin guardar nada: días hábiles, reparto entre licencias, saldo que queda, errores y avisos. |
| `GET /api/mi-espacio/horas-extras?anio=`, `POST`, `PUT /:id` y `DELETE /:id` | Las horas extras. |
| `GET /api/mi-espacio/ausentes?desde=&hasta=` | «Hoy no están» (sección 7). |
| `GET /api/mi-espacio/firmante` | Lo que necesita el campo «Autorizo a…» (sección 6): al firmante titular, las personas que puede autorizar y lo necesario para el aviso de sus días hábiles libres; a cualquier otra persona, `{ soy_titular: false }`. |

**Fechas y momentos:** como texto `'AAAA-MM-DD'` (`DATE_FORMAT`). Hoy es `hoyArgentina()`; los momentos, `ahoraArgentina()`.

## 11. El navegador y la carcasa

**`mi-espacio.js`** sigue la convención de `proyectos.js`:
- al cargarse solo declara;
- lo que arma HTML y calcula es puro y va primero; lo que toca el DOM o la API va al final;
- pide con `API.pedirJson`;
- «hoy» es `Utils.hoyEnArgentina()`;
- todo texto pasa por `Utils.escapeHtml` y cada número va con `String`.

**Copias mínimas** para avisar en el momento (el servidor valida igual), atadas por tests de paridad: los mensajes, los días de vacaciones permitidos y los topes.

**La carcasa.** La página nueva suma un enlace al menú «Mi cuenta» de las 13 páginas con carcasa, que pasan a 14.
- **Solo cambia el menú lateral:** un `<a>` más en `#sidebarAccount` de las 14 páginas, después de Mi Perfil. El encabezado y el footer no cambian.
- **El ícono `calendar-check` va escrito en el HTML,** como los demás del menú (el de `calendar` más `<path d="m9 16 2 2 4-4"/>`). No se suma a `ICON_SELECTOR_MAP`: aparecería como ícono elegible en Proyectos y rompería sus tests. Tampoco a `Icons`: tocar `main.js` obliga a subir `VERSION` en todas las páginas.
- **`tests/paginas.test.js`:** la lista de destinos, la cantidad de páginas (14), la versión y el orden de los scripts (`mi-espacio.js` después de `api.js`), y un test nuevo del menú «Mi cuenta» (Mi Perfil y Mi espacio, en ese orden, con sus íconos), como los de Administración y Herramientas. La carcasa se copia de `index.html`, no de la maqueta: la maqueta la arma con JavaScript y pone `aria-current`, que el test prohíbe en las páginas que no son públicas.
- **Mi espacio se ve para todos los roles con sesión,** así que `updateSidebarAuth` no cambia.
- **Sin sesión, `mi-espacio.js` manda al login,** con su propio control al cargar (`if (!Auth.isAuthenticated())`, como `proyectos.js` y `perfil.js`). `PAGINAS_PUBLICAS` de `main.js` no hace eso: solo actúa cuando una sesión guardada deja de valer.

## 12. Tests

- **`tests/mi-espacio-reglas.test.js` (puro), los casos del usuario y sus bordes:**
  - **Vacaciones:** las mitades con 15 y 25, el vencimiento a los dos años, el reparto día por día de la más vieja, lo no habilitado, lo cargado a futuro y una carga que cruza un vencimiento.
  - **Franquicias, estudios y los topes de atención médica y familiar.**
  - **Francos:** 10,5 h dan 1, 7,5 h dan 1 y 6,5 h no dan; solo se usan en su mes; después, no utilizado previamente.
  - **Horas a favor de contrato:** de a media hora, el vencimiento y lo no utilizado, que vuelve a cero el 1/1.
  - **El uso autorizado, más viejas primero.**
  - **El saldo inicial y lo anterior al arranque.**
  - **Los feriados en el medio y el cruce de año.**
- **`tests/mi-espacio-api.test.js` (Docker, con base propia):**
  - cada ruta, cada 400 con su campo, el 404 de lo ajeno;
  - que el tipo no salga en `ausentes`;
  - el paso a Configuración: alta, superposición, edición antes y después de empezar, anulación, el firmante titular, el lector que no pasa y el registro en `usuarios_auditoria`.
- **`tests/mi-espacio-frontend.test.js`:** la página en un `vm`, el Resumen con los datos de las dos maquetas, los formularios y las paridades.
- **El aviso de vencimiento,** con un hoy fijo (`mock.timers` y el paso llamado directo, como `tests/metricas-foto.test.js`) y Mailpit, sin llamar a `/api/cron/*`: el tramo de días, la persona de licencia, el que falló un día y sale al siguiente, y una sola vez.
- **El paso a Configuración, con el firmante titular:** la licencia sin persona a cargo, el caso del usuario (vacaciones y la médica pegada), el aviso de las 8:15 y el rechazo de la persona autorizada que no se guarda.
- **Los tests existentes que cambian:**
  - `permisos.test.js`: las rutas nuevas, con una lista nueva de «con sesión, sin ella 401»;
  - `paginas.test.js`: 14 páginas, el menú «Mi cuenta» y las versiones;
  - `schema.test.js`: las tablas, la migración y la vuelta atrás;
  - `email-diseno.test.js`: la plantilla nueva;
  - los de licencias (`licencias-api`, `licencias-reglas`): la insignia «Cargada desde Mi espacio» y la función de servicio compartida, sin cambiar lo que hoy hace Configuración.

## 13. Documentación y despliegue

- **`CLAUDE.md`:**
  - la página y su convención;
  - las tablas nuevas, sumadas al conteo de tablas;
  - «Mi espacio» en Roles;
  - el paso a Configuración en «Licencias»;
  - el paso nuevo de la corrida de las 8:15.
- **`README.md`:** las migraciones y su orden.
- **Despliegue:** primero va la entrega 1. Después se corre `migracion-mi-espacio.sql` antes de subir el código, se suben los archivos y se reinicia la aplicación. No necesita cron nuevo: usa la corrida de las 8:15.

## Decisiones

**Del usuario (26/10/2026):**
- Un panel personal para cada usuario, que no ve nadie más.
- Las modalidades y sus licencias, como las describió (sección 3). Planta política tiene las mismas que planta permanente.
- La jornada es de 7 horas.
- Todo se cuenta por año calendario.
- Las vacaciones se acumulan y se habilitan en dos mitades, el 1/7 y el 1/1; con número impar, 8 y 7, y 13 y 12.
- Cada licencia vence el 31/12 de dos años después.
- Se descuenta la licencia más vieja y solo se usan días habilitados.
- Los días se cuentan hábiles, con los feriados.
- La licencia por estudios: hasta 3 días por examen, solo con las fechas.
- El franco de planta se usa solo en su mes.
- Lo no utilizado se ve, con un nombre neutro.
- Las horas de contrato no utilizadas se acumulan en el año y se descuentan si se autoriza tomarlas.
- Las horas extras se cargan con el día y el horario; solo las del 100% en planta.
- Las franquicias se toman por hora entera.
- El saldo inicial, una vez, y en vacaciones por licencia.
- El paso a Configuración, como lo propuse.
- Las sugerencias que se suman: el aviso de vencimiento, lo propio en la agenda y «Hoy no están».
- Una página propia, con pestañas, llamada «Mi espacio».
- El Resumen es «Niveles», con «Vence pronto» primero.
- Se va a mirar sobre todo en la compu.

**Del usuario, en la segunda sesión (26/10/2026):**
- La persona a cargo del firmante la elige quien carga la licencia, sin una regla nueva: para dejar a alguien a cargo hay que haber ido a trabajar, y eso lo sabe la persona. Cada licencia lleva su propia autorización, por sus fechas.
- Si Configuración rechaza el paso, se frena solo el caso de la persona autorizada que se quedaría sin días hábiles; el resto se guarda con el motivo.
- El email de vencimiento sale desde la fecha de la regla hasta el vencimiento, una sola vez.
- La franquicia guarda solo el día y las horas.
- «Mostrar a mis compañeros» queda como estaba.
- Aprobó todas las decisiones mías de la primera revisión (la lista de abajo), con los ajustes del análisis del código.

**Mías, aprobadas por el usuario en la segunda sesión (26/10/2026):**
- La modalidad la carga administración; sin ella no se cargan licencias.
- Un cambio de modalidad se aplica a todo lo cargado.
- Lo anterior al saldo inicial no descuenta.
- Un franco de planta no utilizado también admite un uso autorizado, como las horas de contrato.
- Las horas extras se cargan en pasos de media hora; si pasan la medianoche, cuentan en el día en que empezaron.
- «Vence pronto» muestra la licencia que vence el 31/12 desde el 1/10.
- Cuándo sale el email de vencimiento y que no sale durante una licencia.
- Las reglas del paso a Configuración que no estaban en la charla: el firmante, la superposición, la corrección después de empezar y los cambios de administración.
- «Mostrar a mis compañeros» viene marcada.
- Un id ajeno responde 404, no 403.
- «Sin usar» de una licencia ordinaria, en el saldo inicial, se cuenta sobre lo habilitado ese día.
- La regla del arranque vale solo para lo que tiene saldo inicial; las horas extras, los francos y las horas a favor se cargan con sus meses.
- Dos licencias de Mi espacio no comparten un día.
- Lo que deja de cerrar por un cambio posterior se muestra como faltante, sin frenar el cambio.
- La licencia guarda si pasó a Configuración «creada» o «unida»; una unida nunca toca la de administración, y una corrección no pisa lo que cambió administración.
- El paso a Configuración se decide con el rol del momento en que se guarda.
- Una franquicia que deja de ser de 7 horas sale de Configuración si todavía se puede anular.
- «Ya empezó» quiere decir antes de hoy.
- Si administración acorta o anula la licencia que cubría una «unida», el panel lo avisa.
- El aviso del formulario dice lo que de verdad cambia: no contás como disponible para auditar, y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor.

**Mías, nuevas en la segunda sesión (aprobadas por el usuario el 26/10/2026):**
- Si el firmante carga una licencia que empieza hoy o antes, el formulario avisa que las notas de hoy ya salieron a las 8:15 con su firma.
- Los modales no se cierran con un clic en el velo, como en Configuración.
- La función de servicio compartida con Configuración no cambia nada de lo que hoy hace Configuración.

**Respuestas del usuario a la revisión (26/10/2026):**
- «Los compañeros» son administración: superadmin, admin y editor.
- Una enfermedad durante las vacaciones no las corta: la médica corre desde la reincorporación.
- Las tablas con prefijo `mi_espacio_`.

## Lo que queda para quien lo construye

- Los nombres finales de las tablas, las columnas, las funciones y los mensajes.
- Cómo se reparte el código entre reglas, datos y controlador.
- El dibujo exacto de los tanques en el teléfono.
- Cómo se ordenan las filas de una misma fecha.
- La forma interna de la respuesta de `resumen`, siempre que el navegador no recalcule nada.
