# Base de datos

Las tablas y columnas de cada tema, cada migración, qué pasa sin ella y su vuelta atrás. El orden general está en `docs/temas/despliegue.md`.

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-10-24-metricas-y-reportes-design.md`
- `docs/superpowers/specs/2026-10-24-notas-dgmit-design.md`
- `docs/superpowers/specs/2026-10-24-generador-de-notas-design.md`
- `docs/superpowers/specs/2026-10-26-feriados-design.md`
- `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md`
- `docs/superpowers/specs/2026-10-26-mi-espacio-agenda-design.md`
- `docs/superpowers/specs/2026-10-27-mi-espacio-horas-design.md`
- `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-design.md`
- `docs/superpowers/specs/2026-10-29-mi-espacio-evento-publico-design.md`
- `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-design.md`
- `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-design.md`
- `docs/superpowers/specs/2026-11-03-notas-firma-digital-design.md`

## Base de datos

- 45 tablas (ver `database/schema.sql`).
  Usuarios:
  `usuarios` (rol, cargo, vínculo, `sesion_version`), `usuarios_tokens` (links de acceso, solo el hash), `usuarios_auditoria` (historial del panel), `usuarios_licencias` (licencias; nunca se borran, se anulan) y `usuarios_firmas` (firma de cada usuario para las notas).
  Notas de auditoría:
  `notas_digitales_cambios` (qué cambios incluyó cada una, `nuevo` o `reiterado`).
  Notas DGMIT:
  `notas_dgmit`, `notas_dgmit_datasets` y `notas_dgmit_historial` (ver abajo).
  Métricas:
  `metricas_fotos` y `actualizaciones_recibido` (ver abajo).
  Feriados:
  `feriados` y `feriados_no_rige` (ver abajo).
  Mi espacio:
  `mi_espacio_anios`, `mi_espacio_arranque`, `mi_espacio_saldos`, `mi_espacio_licencias`, `mi_espacio_horas_extras`, `mi_espacio_salidas` (la planilla de contrato) y `mi_espacio_avisos`, los días restituidos (`mi_espacio_restituciones`, los pedidos, y `mi_espacio_restituibles`, la foto) y su agenda:
  `mi_espacio_eventos`, `mi_espacio_evento_personas`, `mi_espacio_evento_vistas` (a quién se le muestra un Personal (Público)), `mi_espacio_evento_informados`, `mi_espacio_evento_envios`, `mi_espacio_eventos_corridas` y `mi_espacio_diario_envios` (ver abajo)
- Campos JSON validados en `cambios_pendientes` (datos_nuevos, datos_anteriores)
- Foreign keys con CASCADE en deletes relevantes

## Métricas y Reportes

- Métricas y Reportes (spec 2026-10-24-metricas-y-reportes, 3 y 4):
  `metricas_fotos` (`anio` smallint PK, `al` DATE —siempre `AAAA-12-31`—, `datos` longtext con el JSON de la foto, que valida el código, `created_at`) y `actualizaciones_recibido` (`cambio_id` PK, FK a `cambios_pendientes` ON DELETE CASCADE;
  `recibido_el` DATE NULL, `origen_datos` enum('area','fuente_publica') NULL, `created_at`): el «Recibido el» y el origen de las actualizaciones aprobadas que no los traen, importados una vez por `cambio_id` sin reescribir `datos_nuevos`.
  El origen de una actualización nueva viaja en el cambio (`datos_nuevos.origen_datos`): no hay columna nueva en `historial_actualizaciones`.
  `migracion-metricas.sql` (aditiva y repetible: dos `CREATE TABLE IF NOT EXISTS`) va **antes** del código;
  `migracion-metricas-recibido-datos.sql` (los «Recibido el» viejos: 28 `INSERT … SELECT … FROM cambios_pendientes WHERE id = N ON DUPLICATE KEY UPDATE`, solo ids, fechas y orígenes; 27 salen del Excel que completó el usuario y el último, el origen `fuente_publica` del cambio 51 —la actualización del 19/10/2026 del dataset 1, que ya traía su «Recibido el»—, de la confirmación del usuario en el diseño, spec línea 13, Ruling 35: lo importado no tapa su fecha;
  repetible, y un cambio que no existe no hace nada) va después de la estructura —el código anterior no lee la tabla: puede ir antes o después de subir los archivos— y **antes del 10/01/2027** (la foto de 2026 no se modifica nunca); la consulta comentada del final lista las actualizaciones aprobadas que siguen sin «Recibido el».
  `rollback-metricas.sql` va después de volver a los archivos anteriores y borra las dos tablas (se pierden la foto y lo importado).

## Notas DGMIT

- Notas DGMIT (spec 2026-10-24-notas-dgmit, 4):
  `usuarios.rol` lleva `'colaborador'` (`enum('superadmin','admin','editor','colaborador','lector')`) y hay tres tablas:
  `notas_dgmit` (`numero` varchar(40), `tipo` enum('solicitud','reiteracion'), `recibida` DATE —el día en que el área la recibió—, `anulada`, `creado_por` FK usuarios ON DELETE SET NULL, `created_at`, `updated_at`), `notas_dgmit_datasets` (`nota_id`, `dataset_id`;
  PK compuesta, las dos FK ON DELETE CASCADE) y `notas_dgmit_historial` (`accion` enum('correccion','anulacion'), `motivo` varchar(500), `anteriores` JSON en longtext —`{ numero, tipo, recibida, datasets }` antes de la corrección;
  NULL en la anulación—, `usuario_id` FK ON DELETE SET NULL, `created_at`).
  No se reusan las tablas de las Notas Digitales (todo lo que lee de ellas contaría las notas DGMIT como avisos del RPAD).
  Sin índice único en `numero`: la unicidad la controla la API (una anulada puede repetir el número).
  `migracion-notas-dgmit.sql` (aditiva y repetible: el `MODIFY` del rol y tres `CREATE TABLE IF NOT EXISTS`) va **antes** del código.
  `rollback-notas-dgmit.sql` va después de volver a los archivos anteriores: pasa los colaboradores a lector, vuelve el rol a cuatro valores y borra las tres tablas (se pierden las notas cargadas); si se deshacen también las entregas del editor, va **antes** que `rollback-editor-sin-responsabilidad.sql` y `rollback-editor-auditoria.sql` (no conocen el rol colaborador).
  Después de esta migración no se vuelven a correr `migracion-editor-auditoria.sql` ni `migracion-usuarios-superadmin.sql`: fijan el rol sin `colaborador` (fallan o dejan el rol de un colaborador vacío).

## Fechas y Requiere nota

- Fechas de los datasets (sin tablas propias):
  `datasets.datos_al` y `datasets.tipo_pedido`, `frecuencias.meses`, las columnas `cambio_id`, `vencimiento`, `datos_al`, `recibido_el` y `proxima_nueva` de `historial_actualizaciones`, y `datos_desde`, `datos_hasta` y `datos_solicitados` de `notas_digitales_datasets`.
  Migraciones aditivas, en este orden:
  `migracion-fechas-datasets.sql` (estructura), `migracion-fechas-datasets-datos.sql` (carga de "Datos al" y tipo de pedido de los datasets; se corre una sola vez) y `migracion-fechas-datasets-textos.sql` (saca el período de los "Qué se solicita"; va después de subir el código y antes del Restart, y cada `UPDATE` cambia el texto solo si sigue siendo el original del 17/10/2026).
  Sin `CHECK` en la base: valida la API.
- Requiere nota DGMIT (sin tablas propias):
  `datasets.requiere_nota` (`TINYINT(1) NULL DEFAULT NULL`, después de `tipo_gestion`; 1 = Sí, 0 = No, NULL = sin dato; en gestión interna, siempre NULL).
  Migraciones aditivas, en este orden y las dos **antes** de subir el código:
  `migracion-requiere-nota.sql` (estructura; se puede repetir) y `migracion-requiere-nota-datos.sql` (carga inicial de los 45 externos activos, 35 con Sí y 10 con No; se corre una sola vez, cada `UPDATE` solo escribe si sigue siendo externo y con `requiere_nota IS NULL`, y la consulta del final tiene que dar 0 filas).
  Sin `CHECK` en la base: valida la API (ver `docs/temas/datasets.md`).

## Auditoría sin responsabilidad

- Auditoría sin responsabilidad:
  `cambios_pendientes.revisado_sin_responsabilidad` (`tinyint(1) NOT NULL DEFAULT 0`, al final, después de `aviso_sin_auditores_at`: así el rollback y la migración del editor la dejan en su lugar).
  `migracion-editor-sin-responsabilidad.sql` va **antes** del código (sin la columna, aprobar y rechazar dan 500);
  `rollback-editor-sin-responsabilidad.sql` va después de volver a los archivos anteriores, y antes de `rollback-editor-auditoria.sql` si se deshacen las dos.

## Ámbito de las áreas

- Ámbito de las áreas (spec 2026-10-24-generador-de-notas, 2 y 8; sin tablas propias):
  `areas.ambito` (`enum('municipal','externo') NOT NULL DEFAULT 'municipal'`, después de `articulo_superior`) decide qué nota de la DGMIT le corresponde al área en el Generador de Notas: municipal, la interna (por la Subsecretaría);
  `externo` (fuera del municipio), la externa (directo al organismo).
  `migracion-generador-notas.sql` (aditiva: un `ADD COLUMN IF NOT EXISTS` y 13 `UPDATE … WHERE id = N AND nombre = '…'`, las áreas fuera del municipio del Anexo A de la spec: 2, 3, 4, 6, 24, 27, 28, 29, 30, 35, 41, 43 y 44; un área renombrada no se encuentra y queda municipal; los nombres y las dependencias no se tocan) va **antes** del código y después de `migracion-metricas.sql`, y la consulta comentada del final tiene que dar 13.
  Se puede repetir, salvo que alguien haya cambiado a mano en Configuración → Áreas el ámbito de una de las 13 (la vuelve a marcar como externa).
  `rollback-generador-notas.sql` va después de volver a los archivos anteriores y borra la columna (se pierde el ámbito, también lo cambiado a mano).
  Sin `CHECK` en la base: valida la API (ver `docs/temas/generador-de-notas.md`).

## Feriados

- Feriados (spec 2026-10-26-feriados, 1 y 5):
  `feriados` (`fecha` DATE —en uno que se repite, la de su primer año—, `nombre` varchar(150), `tipo` enum('nacional','provincial','municipal','no_laborable'), `trasladado_de` DATE NULL —la fecha original de un trasladable, del mismo año—, `se_repite` tinyint(1) DEFAULT 0, `hasta_anio` smallint NULL —en uno que se repite, el último año en que rige;
  NULL: sigue—, `activo` tinyint(1) DEFAULT 1 —la baja lógica—, `creado_por` FK usuarios ON DELETE SET NULL —NULL en la precarga—, `created_at` y `updated_at`; índice `idx_feriados_fecha`) y `feriados_no_rige` (`feriado_id` FK ON DELETE CASCADE y `anio` smallint, PK compuesta: los años en que uno que se repite no rige).
  Los 9 fijos no se guardan: salen de `FERIADOS_FIJOS`.
  Sin índice único: el mismo día puede tener dos feriados (el Jueves Santo de 2026 cae el día de Malvinas; la API avisa y no lo impide).
  Sin `CHECK` en la base: valida la API (ver `docs/temas/feriados.md`).
  `migracion-feriados.sql` (aditiva y repetible: dos `CREATE TABLE IF NOT EXISTS`) va **antes** del código (sin las tablas, `GET /api/feriados` da 500 y la pestaña dice que no se pudieron cargar; también las leen `services/feriadosDatos.js` y `services/miEspacioDatos.js`).
  `migracion-feriados-datos.sql` (la precarga de 2026 y 2027: 28 `INSERT … SELECT … WHERE NOT EXISTS` con la misma fecha y el mismo nombre, 19 de 2026 y 9 de 2027, con `creado_por` NULL y, arriba de cada uno, su fuente en un renglón `-- Fuente:` propio —`tests/schema.test.js` lee como código todo lo que va en el renglón del `INSERT`—, sacadas de `docs/superpowers/specs/2026-10-26-feriados-fuentes.md`; las tres que se repiten, el 23/2, el 28/7 y el 8/11, van una vez, con la fecha de 2026;
  lo que todavía no está decretado se carga desde la pestaña) va después de la estructura y antes de subir el código (el código anterior no lee la tabla: después también anda).
  Se puede volver a correr (no vuelve a cargar una con la misma fecha y el mismo nombre, aunque se haya dado de baja), salvo que desde la pestaña se haya corregido la fecha o el nombre de una de las 28 (la vuelve a cargar con los de acá); la consulta comentada del final da 28 filas, 19 de 2026, 9 de 2027 y 3 que se repiten (cuenta las de `creado_por` NULL).
  `rollback-feriados.sql` va después de volver a los archivos anteriores y borra primero `feriados_no_rige` y después `feriados` (se pierden la precarga y lo cargado desde la pestaña).
  Mientras esté `migracion-mi-espacio-restituciones.sql`, no se puede correr solo: va después de `rollback-mi-espacio-restituciones.sql` (la foto de los días por restituir apunta a `feriados`; ver abajo).

## Mi espacio

- Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 5; los saldos, los francos, las horas a favor y lo no utilizado no se guardan: los calculan las reglas con lo cargado, el saldo inicial y los feriados):
  `mi_espacio_anios` (`usuario_id`, `anio` smallint, `dias_vacaciones` tinyint —10 a 30—, `estudios` enum('universitario','secundario') NULL —NULL: no estudia—;
  PK `(usuario_id, anio)`), `mi_espacio_arranque` (`usuario_id` PK y `fecha` DATE, el día en que cargó su saldo inicial; no cambia al corregirlo), `mi_espacio_saldos` (el saldo inicial:
  `usuario_id`, `concepto` enum('vacaciones','franquicias','estudios','medica','familiar','horas_no_utilizadas'), `anio` —en vacaciones, el de la licencia; en el resto, el del arranque— y `cantidad` DECIMAL(5,1);
  PK `(usuario_id, concepto, anio)`), `mi_espacio_licencias` (`id`, `usuario_id`, `tipo` enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado') —también 'restituidos', al final:
  ver abajo—, `desde` y `hasta` DATE —iguales en lo de un día—, `horas` DECIMAL(3,1) NULL —solo la franquicia, las horas a favor y el uso autorizado—, `horas_acumuladas` DECIMAL(3,1) NULL —ver abajo—, `mostrar` tinyint DEFAULT 1, `nota` varchar(200), `licencia_oficial_id` FK a `usuarios_licencias` ON DELETE SET NULL —nunca se dispara:
  las de Configuración se anulan—, `oficial` enum('creada','unida') NULL, `sin_pasar` varchar(200) NULL —el motivo por el que no pasó—, `activo` —baja lógica—, `created_at` y `updated_at`; índice `(usuario_id, desde, hasta)`), `mi_espacio_horas_extras` (`id`, `usuario_id`, `fecha`, `desde` y `hasta` TIME, `nota`, `activo` y las fechas; índice `(usuario_id, fecha)`; solo las lee planta: ver abajo) y `mi_espacio_avisos` (los emails de vencimiento enviados:
  `usuario_id`, `clave` varchar(40) —'franco-2026-10', 'horas-2026-10' o 'licencia-2024'— y `enviado_at` DATETIME, en hora argentina;
  PK `(usuario_id, clave)`).
  Todas con FK a `usuarios` ON DELETE CASCADE (los usuarios no se borran).
  Van también en `schema.sql` (los tests crean sus bases con él y `tests/schema.test.js` lo compara con la base local).
  `migracion-mi-espacio.sql` (aditiva y repetible: seis `CREATE TABLE IF NOT EXISTS`) va después de las de los feriados y **antes** del código, obligatoria:
  Configuración → Licencias lee `mi_espacio_licencias` (el `EXISTS` de la insignia «Cargada desde Mi espacio», en `COLUMNAS_LICENCIA`), así que sin la migración `GET /usuarios/licencias` da 500 (y la corrida de la mañana anota el error de Mi espacio).
  `rollback-mi-espacio.sql` va después de volver a los archivos anteriores y borra las seis en el orden inverso (se pierde todo lo cargado en Mi espacio; las licencias que pasaron a Configuración quedan allí, sin la insignia); si también se deshacen las licencias y las firmas, va **antes** que `rollback-licencias-firmas.sql` (`mi_espacio_licencias` apunta a `usuarios_licencias`).
  Mientras esté `migracion-mi-espacio-restituciones.sql`, no se puede correr solo: va después de `rollback-mi-espacio-restituciones.sql` (ver abajo).

## La agenda

- La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 3):
  `mi_espacio_eventos` (`id`, `creado_por` FK usuarios ON DELETE SET NULL —el evento sigue para los invitados—, `titulo` varchar(150), `detalle` text NULL, `fecha` DATE, `desde` TIME y `hasta` TIME NULL —hora argentina, sin pasar a UTC—, `compartido` y `para_todos` tinyint (y después, `publico`, `publico_todos` y `texto_publico`: ver abajo), `recordatorio` enum('ninguno','1h','2h','dia_anterior') DEFAULT '2h', `activo` —baja lógica—, `created_at` y `updated_at`;
  índice `(fecha, activo)`), `mi_espacio_evento_personas` (`evento_id` y `usuario_id`, PK compuesta, las dos FK ON DELETE CASCADE, y `sin_recordatorio`: las personas elegidas y quién apagó su recordatorio; en un «para todos», solo las que lo apagaron), `mi_espacio_evento_envios` (qué email salió a quién:
  `evento_id` y `usuario_id`, FK ON DELETE CASCADE, `tipo` enum('recordatorio','invitacion','cambio','cancelacion'), `para` DATETIME —el momento del evento del que habla, `${fecha} ${desde}`, leído con `DATE_FORMAT(para, '%Y-%m-%d %H:%i')`—, `enviado_at` DATETIME NULL —escrito con `ahoraArgentina()`;
  NULL mientras un recordatorio está reservado— y `success`) y `mi_espacio_eventos_corridas` (una sola fila, `id` = 1, con la última corrida de los recordatorios para Correos → Estado:
  `inicio_at`, `fin_at`, `resultado` varchar(1000) y `con_errores`).
  **La clave única vale solo para los recordatorios:** `uq_mi_espacio_evento_envios_recordatorio` (`evento_id`, `usuario_id`, `para`, `recordatorio_unico`), con `recordatorio_unico` una columna generada STORED (`case when tipo = 'recordatorio' then 1 end`):
  1 en los recordatorios y NULL en los demás, y como dos NULL nunca chocan, el mismo recordatorio no entra dos veces (la reserva con `INSERT IGNORE` da `affectedRows` 0) y las invitaciones, los cambios y las cancelaciones se repiten (a quien se saca y se vuelve a sumar le llega otra invitación).
  Si el evento cambia de hora, cambia `para` y el recordatorio es otro.
  Esa clave es también el índice de la FK de `evento_id`.
  Sin `CHECK`: valida la API.
  Van también en `schema.sql`.
  `migracion-mi-espacio-agenda.sql` (aditiva y repetible: cuatro `CREATE TABLE IF NOT EXISTS`, en orden de dependencias) va después de `migracion-mi-espacio.sql` y **antes** del código: sin las tablas, la pestaña Agenda no carga, la corrida termina con errores y Correos → Estado advierte que no pudo leerla (el Resumen sale igual, sin los eventos: su consulta va aislada).
  `tests/permisos.test.js` lee `mi_espacio_eventos_corridas` y `mi_espacio_evento_envios` de la base del `.env`: la base local también necesita la migración antes de correr la suite.
  `rollback-mi-espacio-agenda.sql` va después de volver a los archivos anteriores y de borrar la Tarea Cron de `/api/cron/eventos`, y borra las cuatro en el orden inverso (se pierden los eventos, con quién se compartió cada uno, los recordatorios apagados, el registro de los emails y la última corrida; lo demás de Mi espacio no se toca); si también se deshace `migracion-mi-espacio.sql`, va **antes** que `rollback-mi-espacio.sql`.
  No se puede correr solo mientras esté `migracion-mi-espacio-evento-publico.sql`: va después de `rollback-mi-espacio-evento-publico.sql` (ver abajo).

## La planilla de contrato

- La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, 6):
  `mi_espacio_salidas` (`id`, `usuario_id` FK usuarios ON DELETE CASCADE, `fecha` DATE, `entrada` TIME NULL —opcional en un día hábil y obligatoria en uno que no lo es: lo valida la API—, `salida` TIME NOT NULL, `nota` varchar(200), `activo` —baja lógica— y `created_at` y `updated_at` timestamp NOT NULL; clave única `uq_mi_espacio_salidas_dia` `(usuario_id, fecha)`, una fila por persona y día, que es también el índice de la FK).
  Se guarda con un `INSERT … ON DUPLICATE KEY UPDATE`, que vuelve a activar la fila de un día borrado.
  Las horas no se guardan: las calculan las reglas con los feriados del momento (un feriado cargado después cambia la cuenta de ese día).
  Contrato lee solo esta tabla y planta solo `mi_espacio_horas_extras` (decisión de la spec: un horario «de … a …» y una entrada y salida no dicen lo mismo); si cambia el vínculo de una persona, lo de la otra modalidad queda guardado sin contar.
  Se lee con `TIME_FORMAT(…, '%H:%i')` (una entrada NULL sigue null) y `DATE_FORMAT`.
  Va también en `schema.sql`.
  `migracion-mi-espacio-horas.sql` (aditiva y repetible: un `CREATE TABLE IF NOT EXISTS`) va después de `migracion-mi-espacio-agenda.sql` y **antes** del código, obligatoria:
  `estadosDe` lee la tabla, así que sin ella todo lo de Mi espacio que lee el estado de una persona (el Resumen, las licencias, las horas extras, «Mis vacaciones y saldos», la nota de licencia) da 500 para todos, y el paso de Mi espacio de la corrida de la mañana anota el error.
  Antes de correrla, la consulta de su cabecera, `SELECT COUNT(*) FROM mi_espacio_horas_extras h JOIN usuarios u ON u.id = h.usuario_id WHERE h.activo = 1 AND u.vinculo = 'contrato';`, tiene que dar 0 (unas horas extras de una persona de contrato dejarían de contar; si no da 0, no se sigue: hay que decidir qué hacer con ellas).
  `tests/schema.test.js` (compara `schema.sql` con la base del `.env`) y `tests/permisos.test.js` (las lecturas de Mi espacio, sobre esa base) la necesitan: la base local también necesita la migración antes de correr la suite.
  `rollback-mi-espacio-horas.sql` va después de volver a los archivos anteriores y borra la tabla (se pierde lo cargado en la planilla; con el código anterior, las horas de contrato vuelven a salir de `mi_espacio_horas_extras`, que no se toca); si también se deshace la agenda, va **antes** que `rollback-mi-espacio-agenda.sql`.
  «Sumar al mes anterior» (spec 2026-10-30-mi-espacio-horas-mes-anterior, 8): `mi_espacio_salidas` trae, después de `nota`, `al_mes_anterior` tinyint(1) NOT NULL DEFAULT 0: 1 si las horas del día suman al mes anterior al de su fecha (el tilde «Sumar a enero» de la planilla); lo ya cargado queda en 0 y un borrado lo vuelve a 0.
  `estadosDe` la lee como booleano (`al_mes_anterior` en cada salida, `Number(…) === 1`).
  Se guarda con dos upserts: si el día no trae el campo, `UPSERT_DE_LA_SALIDA` no la nombra (un día nuevo queda en 0 y uno guardado conserva la suya: una página vieja que no conoce el tilde no lo borra); si lo trae, `UPSERT_DE_LA_SALIDA_CON_LA_MARCA` la escribe (`al_mes_anterior = VALUES(al_mes_anterior)`); la baja (`BAJA_DE_LA_SALIDA`) la deja en 0.
  `migracion-mi-espacio-horas-mes-anterior.sql` (aditiva y repetible: un `ADD COLUMN IF NOT EXISTS … AFTER nota`, con la verificación comentada al final, `SHOW COLUMNS FROM mi_espacio_salidas LIKE 'al_mes_anterior';`, 1 fila) va después de `migracion-mi-espacio-horas.sql` y **antes** del código, obligatoria:
  `estadosDe` lee la columna, así que sin ella da «Unknown column» y todo lo de Mi espacio que lee el estado de una persona (la planilla, la pestaña Horas extras, el Resumen, las licencias, la nota de licencia) da 500 para todos, y el paso de Mi espacio de la corrida de la mañana anota el error.
  El código anterior anda con la columna (no la lee; lo que guarda queda en 0).
  `tests/schema.test.js` (la compara con la base del `.env`) la necesita: la base local también necesita la migración antes de correr la suite.
  `rollback-mi-espacio-horas-mes-anterior.sql` va después de volver a los archivos anteriores y borra la columna (las salidas quedan; se pierde qué días estaban tildados y sus horas vuelven a su mes: un uso de horas a favor que se apoyaba en ellas puede quedar con el aviso ámbar de lo que falta, sin frenar nada); si también se deshace la planilla, va **antes** que `rollback-mi-espacio-horas.sql`.

## El evento Personal (Público)

- El evento Personal (Público) de la agenda (spec 2026-10-29-mi-espacio-evento-publico, 6.1 y 8):
  `mi_espacio_eventos` trae, después de `para_todos`, `publico` tinyint(1) NOT NULL DEFAULT 0 (1 en un Personal (Público)), `publico_todos` tinyint(1) NOT NULL DEFAULT 0 (1 si se les muestra a todos los usuarios activos:
  una marca, también para quien se da de alta después) y `texto_publico` varchar(60) NULL (lo que ven los demás en lugar del título), y hay otra tabla, `mi_espacio_evento_vistas` (`evento_id` y `usuario_id`, PK compuesta, las dos FK ON DELETE CASCADE, con el índice `fk_mi_espacio_evento_vistas_usuario`: a quién se le muestra un Público con personas elegidas, una fila por persona; sin `sin_recordatorio`, porque el recordatorio de un Público le llega solo a quien lo creó).
  Un Público se guarda con `compartido` 0 y `para_todos` 0 (`para_todos` quiere decir solo «toda la administración»), `texto_publico` de 1 a 60 caracteres y `publico_todos` 1 o al menos una fila en `mi_espacio_evento_vistas`; un Privado o un Laboral, `publico` 0, `publico_todos` 0, `texto_publico` NULL y ninguna fila en ella (decisión de la spec, 10.1: así todo lo que decide emails y visibilidad por `compartido` y `para_todos` lo trata como un evento personal de quien lo creó).
  `migracion-mi-espacio-evento-publico.sql` (aditiva y repetible: tres `ADD COLUMN IF NOT EXISTS`, cada uno con su `AFTER`, y un `CREATE TABLE IF NOT EXISTS`) va después de `migracion-mi-espacio-horas.sql` y **antes** del código, obligatoria: toda consulta de los eventos lee `e.publico` (y las de quien mira, `mi_espacio_evento_vistas`), así que sin ella da «Unknown column»:
  la pestaña Agenda no carga (`GET /mi-espacio/eventos` da 500), no se puede crear, cambiar ni borrar ningún evento, la corrida de los recordatorios de un día hábil termina con errores (Correos → Estado lo marca) y «Hoy y mañana» del Resumen sale sin los eventos (va aislado); lo demás de Mi espacio sigue andando.
  El código anterior anda con la estructura nueva (no la lee, y lo que guarda queda con `publico` en 0).
  `tests/schema.test.js` (compara `schema.sql` con la base del `.env`) y `tests/permisos.test.js` (`GET /mi-espacio/eventos` del lector y del colaborador, sobre esa base) la necesitan: la base local también necesita la migración antes de correr la suite.
  `rollback-mi-espacio-evento-publico.sql` va después de volver a los archivos anteriores y borra `mi_espacio_evento_vistas` y las tres columnas, en el orden inverso (los Públicos quedan como eventos personales de quien los creó, sin emails ni nada a la vista de otros; se pierden el texto que veían los demás y a quién se le mostraba cada uno).
  La vuelta atrás del SQL privado del evento real (`database/privado/rollback-mi-espacio-evento-publico-datos.sql`, ver `docs/temas/despliegue.md`) va **antes**: necesita las columnas.
  **Si también se deshace la agenda, este va antes que `rollback-mi-espacio-agenda.sql`, que no se puede correr solo mientras esté `migracion-mi-espacio-evento-publico.sql`**: borra las tablas de los envíos, de las personas y de la última corrida, falla en `DROP TABLE mi_espacio_eventos` con ERROR 1451 (`mi_espacio_evento_vistas` le apunta) y deja la base a medias; se recupera corriendo `rollback-mi-espacio-evento-publico.sql` y repitiendo el de la agenda (comprobado sobre una copia del dump;
  `tests/schema.test.js` los corre en ese orden).
- **El aviso diario de la agenda y de quién depende cada usuario** (`migracion-mi-espacio-eventos-diario.sql`; spec 2026-11-04-agenda-aviso-y-dependencia, 9):
  `usuarios.depende_de` int(11) NULL, con FK a `usuarios(id)` ON DELETE SET NULL y `usuarios.eventos_por_mail` tinyint(1) NOT NULL DEFAULT 1.
  `mi_espacio_eventos.publicado_at` datetime NULL, en hora argentina: cuándo quedó Público con esa fecha; NULL, los de antes, cuenta como anterior a hoy.
  `mi_espacio_evento_informados` (`evento_id`, `usuario_id`, `fecha`, `informado_at`, PK en los tres primeros, las dos FK con CASCADE): a quién ya se le informó cada Público y para qué fecha, escrita solo cuando el mail salió bien.
  `mi_espacio_diario_envios` (`id`, `usuario_id`, `dia`, `momento` enum('tarde','manana'), `enviado_at`, `success`, único en persona, día y momento, FK con CASCADE): la reserva del mail de cada persona, como la de los recordatorios.
  `mi_espacio_eventos_corridas` suma la fila `id = 2`, la del aviso diario, sin cambiar de forma.
  **Los datos:** un Laboral con `para_todos` 1 quería decir «toda la administración» y con el código nuevo quiere decir todos los usuarios activos: la migración lo pasa a filas sin cambiar quién lo ve y lo deja con `para_todos` 0.
  Antes borra las filas de quien hoy no es administración: son de un recordatorio apagado, hoy no le dan acceso y convertidas sí.
  Por eso se puede repetir solo antes del Restart del código nuevo: después achicaría a la administración los «Todos» nuevos.
  `rollback-mi-espacio-eventos-diario.sql` va después de volver a los archivos anteriores y antes de los del Público y la agenda: los «para todos» viejos no vuelven y un «Todos» nuevo queda solo para la administración.

## Los días restituidos

- Los días que restituye un asueto (spec 2026-10-31-mi-espacio-dias-restituidos, 6):
  `mi_espacio_licencias.tipo` lleva `'restituidos'` al final del enum (diez valores: la carga aparte de los días restituidos del caso A, «Días restituidos»), y hay dos tablas.
  `mi_espacio_restituciones`, los pedidos (`id`;
  `usuario_id` FK usuarios ON DELETE CASCADE;
  `licencia_id`, la carga de la que salen los días —unas vacaciones o, en la recursión, una carga de días restituidos—, FK `mi_espacio_licencias` ON DELETE CASCADE;
  `anio` smallint, la licencia de origen;
  `caso` enum('tomar','restituir') —'tomar', el caso A, con su carga de días restituidos en `carga_id`; 'restituir', el B—;
  `dias` smallint;
  `primer_asueto` DATE, del que sale el plazo;
  `tanda` smallint;
  `fecha` DATE, el día del pedido —`hoyArgentina()`: la fecha de la nota B y desde cuándo vuelven sus días; no se deduce de `created_at`, así no depende de la zona horaria de la base—;
  `carga_id` FK `mi_espacio_licencias` ON DELETE SET NULL;
  `activo`, la baja lógica;
  `created_at` y `updated_at`; índices `(usuario_id, activo)` y los de las FK).
  `mi_espacio_restituibles`, la foto (`id`;
  `licencia_id` FK `mi_espacio_licencias` ON DELETE CASCADE;
  `feriado_id` FK `feriados` ON DELETE CASCADE;
  `fecha` DATE;
  `tanda` smallint NULL, NULL mientras ningún pedido la selló;
  `restitucion_id` FK `mi_espacio_restituciones` ON DELETE SET NULL, NULL mientras no se pidió;
  `created_at`; clave única `uq_mi_espacio_restituibles_dia` `(licencia_id, fecha)`, una fila por carga y día, que es también el índice de la FK de `licencia_id`).
  Los grupos, el plazo, el caso y la situación no se guardan: los calculan las reglas con la foto, las fechas y los feriados de hoy (ver `docs/temas/mi-espacio-restituidos.md`).
  `estadosDe` lee las dos, de las cargas y los pedidos activos o no (las tandas cuentan los dos), con dos consultas más para todas las personas.
  Las claves de los emails de los días por restituir (`restitucion-<carga>-<anio>-<tanda>-1` y `-2`) entran en `mi_espacio_avisos.clave`, `varchar(40)`: sin SQL.
  `migracion-mi-espacio-restituciones.sql` (aditiva y repetible: el `MODIFY` del enum, que deja lo mismo si se repite, y dos `CREATE TABLE IF NOT EXISTS`, primero los pedidos; con la verificación comentada al final, `SHOW TABLES LIKE 'mi_espacio_restitu%';`, 2 filas, y `SHOW COLUMNS FROM mi_espacio_licencias LIKE 'tipo';`, que termina en 'restituidos';
  no carga datos: los feriados ya cargados no generan fotos) va después de `migracion-mi-espacio-horas-mes-anterior.sql` y **antes** del código, obligatoria:
  `estadosDe` lee las dos tablas, así que sin ellas da «Table doesn't exist» y todo lo de Mi espacio que lee el estado de una persona (el Resumen, las licencias, las horas extras, la planilla, la nota de licencia) da 500 para todos, el paso de Mi espacio de la corrida de la mañana anota el error y, como el feriado saca la foto en su misma transacción, Configuración → Feriados no puede corregir ningún feriado (la corrección siempre lee la foto)
  ni cargar uno, volver a hacer regir uno o cargar el día de «Se pasó al» cuando cae en unas vacaciones ya cargadas («no rige» y la baja siguen andando).
  El código anterior anda con la estructura nueva (no la lee y nunca guarda 'restituidos').
  `tests/schema.test.js` (la compara con la base del `.env`) y `tests/permisos.test.js` (las lecturas de Mi espacio, sobre esa base) la necesitan: la base local también necesita la migración antes de correr la suite.
  `rollback-mi-espacio-restituciones.sql` va después de volver a los archivos anteriores: pasa las cargas `'restituidos'` a `'vacaciones'` (con `updated_at = updated_at`: la fecha de su nota no cambia;
  siguen en Mi espacio y, las que pasaron, en Configuración, pero en Mi espacio pasan a descontar de las licencias como unas vacaciones más y puede aparecer un faltante ámbar, que no frena nada), borra las dos tablas, primero la foto, y vuelve el enum a nueve valores (se pierden los pedidos y la foto: lo que había vuelto a una licencia con un pedido deja de sumar y las vacaciones vuelven a contar sus días con los feriados de hoy;
  las claves `restitucion-…` ya anotadas en `mi_espacio_avisos` quedan, y el código anterior no las lee).
  Si también se deshace «Sumar al mes anterior», va **antes** que `rollback-mi-espacio-horas-mes-anterior.sql`.
  **Mientras esté esta migración, `rollback-mi-espacio.sql` y `rollback-feriados.sql` no se pueden correr solos**: las dos tablas apuntan a `mi_espacio_licencias` y a `feriados`, así que fallan a mitad de camino (el de Mi espacio borra los avisos y las horas extras y falla en `mi_espacio_licencias`; el de los feriados borra `feriados_no_rige` y falla en `feriados`) y dejan la base a medias: este va antes que ellos (sus cabeceras lo dicen).

## Las horas acumuladas

- Las horas acumuladas de contrato (spec 2026-11-03-mi-espacio-horas-acumuladas, 6):
  `mi_espacio_licencias` trae, después de `horas`, `horas_acumuladas` DECIMAL(3,1) NULL: la parte de `horas` que sale de las horas acumuladas, solo en `horas_a_favor` (en cualquier otro tipo, NULL;
  NULL y 0 son lo mismo).
  **`horas` es el total del día**, y así lo leen (el día entero, el paso a Configuración, la planilla, la agenda, «Hoy no están», la nota); la parte del mes es `horas − horas_acumuladas` (`horasDelMesDe`).
  `estadosDe` la lee como número o null (`COLUMNAS_LICENCIA_MIA` y `aLicencia`, con `numeroONulo`).
  La escriben solo el INSERT de `cargarLicenciaMia` y el UPDATE de `corregirLicenciaMia` (`parteAcumuladaDe`, `datos.horas_acumuladas ?? null`: unos días restituidos, cuyo validador no trae la clave, quedan en NULL).
  `migracion-mi-espacio-horas-acumuladas.sql` (aditiva y repetible: un `ADD COLUMN IF NOT EXISTS … AFTER horas`, con la verificación comentada al final, `SHOW COLUMNS FROM mi_espacio_licencias LIKE 'horas_acumuladas';`, 1 fila; no carga datos: lo ya cargado queda en NULL, todo del mes) va después de `migracion-mi-espacio-restituciones.sql` y **antes** del código, obligatoria:
  `estadosDe` la lee, así que sin ella da «Unknown column» y todo lo de Mi espacio que lee el estado de una persona (el Resumen, las licencias, las horas extras, la planilla, la nota de licencia) da 500 para todos, y el paso de Mi espacio de la corrida de la mañana anota el error.
  El código anterior anda con la columna (no la lee; una carga nueva queda en NULL; si corrige una carga que ya tenía horas acumuladas, su UPDATE no toca la columna y queda el valor viejo, que el código nuevo nunca toma por más que `horas` —`horasAcumuladasDe`— y el rollback borra).
  `rollback-mi-espacio-horas-acumuladas.sql` va después de volver a los archivos anteriores y borra la columna (`DROP COLUMN IF EXISTS`; las licencias quedan, con sus horas, pero se pierde qué parte de cada día era acumulada: esas cargas cuentan enteras contra su mes y pueden quedar con el faltante ámbar de las horas a favor, que no frena nada); si también se deshacen los días restituidos, va **antes** que `rollback-mi-espacio-restituciones.sql` (el orden inverso: la base no lo exige).

## La firma digital

- La firma digital de las Notas Digitales (spec 2026-11-03-notas-firma-digital, 8):
  `notas_digitales` trae, después de `presentada_por_id`, `espera_firma` tinyint(1) NOT NULL DEFAULT 0 (1 mientras la nota espera la firma), `pdf_firmado` mediumblob (la copia firmada, tal como se subió), `firmado_por` varchar(255), `firmado_at` datetime (del certificado y del CMS, en hora argentina) y `firma_subida_por` int(11) (quién la subió, FK a `usuarios` ON DELETE SET NULL, `fk_notas_firma_subida_por`), y `notas_digitales_config` trae, al final, `firma_digital_activa` tinyint(1)
  NOT NULL DEFAULT 0 (el interruptor, apagado).
  `pdf` y `html` no cambian nunca.
  `migracion-notas-firma-digital.sql` (aditiva y repetible) va **antes** del código, obligatoria: sin las columnas, toda consulta de las notas da «Unknown column» y las Notas Digitales no se generan.
  El código anterior anda con ellas (no las lee y una nota nueva queda en 0).
  `tests/schema.test.js` la necesita: la base local también, antes de correr la suite.
  `rollback-notas-firma-digital.sql` va después de volver a los archivos anteriores y las borra (se pierden las copias firmadas: las notas que ya salieron quedan como enviadas, con su `pdf` sin firmar en el Libro; una que esperaba en ese momento pasa a ser una pendiente común y sale en la corrida siguiente).
- La leyenda de la firma digital (spec 2026-11-04-firma-digital-leyenda, 6):
  `notas_digitales.pdf_para_firmar` mediumblob (la copia con la leyenda, solo mientras la nota espera), después de `firma_subida_por`: así la migración y el rollback de la firma digital la dejan en su lugar.
  `migracion-notas-firma-leyenda.sql` (aditiva y repetible) va **antes** del código, obligatoria: el código nuevo la escribe al enviar cualquier nota y, sin ella, el email sale, la nota no queda como enviada y se vuelve a mandar.
  El código anterior anda con ella (no la lee).
  `tests/schema.test.js` la necesita: la base local también, antes de correr la suite.
  `rollback-notas-firma-leyenda.sql` va después de volver a los archivos anteriores, y antes de `rollback-notas-firma-digital.sql` si se deshacen las dos: una nota que espera en ese momento sale a las 14:00 y una firmada sobre la copia, sin subir, ya no se reconoce.

## Archivos de tests

`schema.test.js`, `permisos.test.js`
