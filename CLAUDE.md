# RPAD - Registro Permanente de Actualización de Datasets

Sistema de gestión de datos abiertos para la Municipalidad de Comodoro Rivadavia. Registra datasets, controla frecuencias de actualización, genera reportes PDF/DOCX, y envía notificaciones por email.

## Tech Stack
- **Backend:** Node.js 22, Express 4.18, ES Modules
- **Base de datos:** MariaDB 10.6+ (mysql2/promise, pool de 10 conexiones)
- **Auth:** JWT (7h expiración), bcryptjs
- **Frontend:** HTML5, CSS3, vanilla JS (sin frameworks)
- **PDF:** PDFKit | **DOCX:** docx | **Email:** Nodemailer
- **Emails:** un solo remitente, `remitente()` de `services/emailService.js` ("Dir. de Datos Públicos y Comunicación"), y un solo marco, `marcoEmail` de `services/emailTemplates.js` (diseño pastel "celeste institucional", tablas y estilos en línea, sin emojis), para todas las plantillas. Las Notas Digitales tienen su propio armado.
- **CDN:** Lucide Icons, Chart.js, FullCalendar

## Comandos
- `npm start` — Inicia el servidor (puerto 3001)
- `npm run setup-admin` — Crea un usuario (superadmin, admin, editor o lector; por defecto lector)
- `npm test` — Tests de integración: requieren `docker compose up -d` (MariaDB + Mailpit) y `RPAD_TESTS_DB_LOCAL=1` en el `.env` local
- Migraciones: ejecutar manualmente con `mysql -u root -p < database/updates/migracion-vX-vY.sql`

## Estructura del proyecto
```
app.js                    # Entry point Express
config/database.js        # Pool MySQL
controllers/              # 10 controladores (lógica de negocio)
services/                 # emailService, emailTemplates, fechasDatasetReglas (reglas de fechas, puras)
middleware/auth.js         # JWT middleware
routes/index.js           # Todas las rutas (~190 líneas)
database/schema.sql       # Schema completo
database/updates/         # Migraciones SQL
scripts/setup-admin.js    # Setup inicial
public/                   # Frontend SPA
  js/config.js            # API_URL, localStorage keys
  js/auth.js              # Manejo de sesión JWT
  js/api.js               # Capa centralizada de fetch
  js/main.js              # Layout, sidebar, header
  css/styles.css           # Estilos principales
```

## Convenciones de código

### General
- ES Modules (import/export), NO CommonJS
- async/await para operaciones async
- Arrow functions preferidas
- Idioma: español en variables, comentarios y UI

### Backend
- Respuestas API: `{ success: boolean, data?, error?, message? }`
- Queries SQL: SIEMPRE parametrizadas con `?`, NUNCA concatenar strings
- Transacciones: `beginTransaction()` / `commit()` / `rollback()` para operaciones multi-tabla
- Soft deletes: campo `activo` (TRUE/FALSE), no borrar registros
- Controladores en `controllers/*Controller.js`, servicios en `services/*Service.js`

### Frontend
- Vanilla JS, sin frameworks
- Cada página carga: config.js → auth.js → api.js → página.js (admin, además, `admin-fechas.js` entre `api.js` y `admin.js`)
- API calls centralizadas en `api.js` (objeto `API`)
- Utilidades en `api.js` (objeto `Utils`: formatDate, calcularEstado, escapeHtml, etc.)
- Iconos: Lucide SVG embebidos en main.js (objeto `Icons`)
- Toast notifications: `showToast(message, type)`
- `perfil.js`: lo que arma HTML (`htmlDeFila`, `htmlDeComparacion`, …) es puro y recibe quién mira por parámetro; lo que toca el DOM, `Auth` o la API va aparte. Los tests lo cargan en un `vm` sin `window` ni DOM: al cargarse, el archivo solo declara.
- `correos.js`: pestañas Libro de Notas Digitales (la inicial), Estado, Vista previa y pruebas y Configuración (`#libro`, `#estado`, `#pruebas`, `#configuracion`); las alertas del Estado van arriba de las pestañas, con una marca en Estado. La vista previa y la prueba muestran la nota como saldría en la próxima corrida con notas (`fechaDeVistaPrevia`, con la misma selección que la corrida: `avisoDelDia`); si no es hoy, lo avisan (spec 2026-10-15, 7.7). Como `perfil.js`, al cargarse solo declara (los tests lo cargan en un `vm`).
- `admin-fechas.js`: lo puro de la lista de admin y de "Registrar actualización" (`htmlDeFila`, `htmlDeOpciones`, `htmlDeCiclo`, `textoEstado`, selectores de mes y año, `hoyEnArgentina`); lo que toca el DOM o la API va en `admin.js`. Como `perfil.js` y `correos.js`, al cargarse solo declara (`tests/admin-frontend.test.js` lo carga en un `vm`).
- Fechas en el navegador: texto `'AAAA-MM-DD'`, cortado como texto; nunca `Utils.formatDate` para los campos nuevos (en el navegador argentino muestra el día anterior) ni `toISOString()` para "hoy" (después de las 21 da mañana: `hoyEnArgentina`).

### CSS
- Variables CSS: `--primary: #1a365d`, `--success: #10b981`, `--warning: #f59e0b`, `--danger: #ef4444`
- Clases: `.btn-primary`, `.btn-secondary`, `.dataset-card`, `.badge-*`, `.alert-*`
- Fuentes: Inter (texto), Outfit (títulos) via Google Fonts

## Arquitectura clave

### Doble verificación (CRÍTICO)
Todo cambio a datasets pasa por doble verificación:
1. Un admin o un editor propone el cambio → se crea registro en `cambios_pendientes`
2. Otra persona aprueba o rechaza → se aplica al dataset. Auditan los auditores (superadmin o admin); un editor, solo de respaldo, si ese día no hay ningún auditor disponible que no lo haya propuesto (`permisoParaAuditar` en `services/auditoriaReglas.js`; queda `cambios_pendientes.revisado_como_respaldo`)
- Un usuario NO puede aprobar sus propios cambios
- Si un dataset tiene cambio pendiente, queda bloqueado para nuevas ediciones

### Roles
- **superadmin:** todo lo de admin. Su cuenta solo la modifica su titular y recibe un aviso cuando otro usuario crea un admin o un editor, cambia un rol, cambia el email de un admin o un editor, reactiva a uno de ellos o desactiva a alguien; durante su licencia esos avisos se retienen y a la vuelta le llega un resumen. Se asigna por SQL, nunca desde la aplicación.
- **admin:** CRUD datasets (con doble verificación), áreas, panel de usuarios, aprobación de cambios, reportes, notificaciones
- **editor:** todo lo de admin, pero audita cambios solo de respaldo y en el panel de usuarios solo crea y modifica lectores (no cambia roles, tampoco el suyo). Puede tener licencia, cargar su firma y ser la persona autorizada del firmante, pero no firmante titular.
- **lector:** solo lectura de datos públicos + perfil
- **Licencias:** superadmin, admins (y editores) pueden tener licencias (pestaña Licencias de Usuarios). Durante la licencia no reciben emails del sistema; los avisos al superadmin se retienen y le llega un resumen a la vuelta. Ver services/licenciasReglas.js y services/avisosSuperadminService.js.
- El rol y el estado activo se leen de la base en cada pedido (`authMiddleware`): desactivar o cambiar un rol tiene efecto inmediato. `esAdmin(rol)` (services/usuariosReglas.js) y `Auth.isAdmin()` incluyen al superadmin y al editor (acceso a la administración); `esAuditor(rol)` y `Auth.isAuditor()` (superadmin o admin) deciden quién audita y quién cuenta para el mínimo: no comparar con `'admin'` a mano.
- Siempre tiene que haber al menos 2 auditores activos (superadmin o admin, con contraseña): el panel no deja bajar de ese mínimo, y pasar a un admin a editor cuenta como quitar uno. El firmante titular no puede pasar a editor ni a lector.

### Base de datos
- 24 tablas (ver `database/schema.sql`). Usuarios: `usuarios` (rol, cargo, vínculo, `sesion_version`), `usuarios_tokens` (links de acceso, solo el hash), `usuarios_auditoria` (historial del panel), `usuarios_licencias` (licencias; nunca se borran, se anulan) y `usuarios_firmas` (firma de cada usuario para las notas). Notas de auditoría: `notas_digitales_cambios` (qué cambios incluyó cada una, `nuevo` o `reiterado`)
- Fechas de los datasets (sin tablas nuevas): `datasets.datos_al` y `datasets.tipo_pedido`, `frecuencias.meses`, las columnas `cambio_id`, `vencimiento`, `datos_al`, `recibido_el` y `proxima_nueva` de `historial_actualizaciones`, y `datos_desde`, `datos_hasta` y `datos_solicitados` de `notas_digitales_datasets`. Migraciones aditivas, en este orden: `migracion-fechas-datasets.sql` (estructura), `migracion-fechas-datasets-datos.sql` (carga de "Datos al" y tipo de pedido de los datasets) y `migracion-fechas-datasets-textos.sql` (saca el período de los "Qué se solicita"; va después de subir el código y antes del Restart, y cada `UPDATE` cambia el texto solo si sigue siendo el original del 17/10/2026). Sin `CHECK` en la base: valida la API.
- Campos JSON validados en `cambios_pendientes` (datos_nuevos, datos_anteriores)
- Foreign keys con CASCADE en deletes relevantes

### Fechas de los datasets
- `proxima_actualizacion` es siempre el último día de un mes, con febrero en 28 también en los años bisiestos (`esFinDeMes`, `finDeMes`; `sumarMeses` suma sobre el índice año × 12 + mes, nunca con `setMonth`). `datos_al` ("Datos al": el día al que llegan los datos publicados) también es siempre fin de mes. El servidor lo valida solo si el campo cambia: un dataset viejo con una fecha mala se edita sin tocarla.
- Corte = fin del mes anterior a la próxima (`corteDe`): el área tiene un mes para preparar los datos sin figurar vencida.
- `ultima_actualizacion` es "Cargado en el portal": el día de la carga, no la fecha de los datos (esa es `datos_al`). Las fechas viejas no se corrigen.
- Tipo de pedido (`datasets.tipo_pedido`; si es NULL rige `tipoSugerido(gestion, meses)`, vía `tipoEfectivo`) y qué pide cada uno: `acumulado`, del 1/1 del año del corte al corte; `foto`, "Vigente al" el corte; `anio_anterior`, el último año calendario cerrado; `ejercicio`, "Presupuesto del ejercicio aaaa" (si falta más de uno, los dice todos); `edicion`, "Próxima edición disponible"; `relevamiento`, "Relevamiento actualizado"; `eventual`, sin pedido. Eventual va siempre junto con la frecuencia Eventual (sin próxima): el servidor lo exige.
- "Todo lo que falta": si lo publicado termina antes del 1/1 del año del corte, el pedido arranca el 1° del mes siguiente a "Datos al" (nunca el 29/02), aunque cruce el año.
- R7, vencidos: si el vencimiento ya pasó, el pedido llega hasta el corte del último vencimiento del ciclo que ya pasó (`ultimoVencimientoPasado`: suma la frecuencia mientras siga en el pasado).
- Una sola fuente: `services/fechasDatasetReglas.js`, puro (sin pool ni `Date` local; las fechas son texto `'AAAA-MM-DD'`, hoy = `hoyArgentina()`): `pedido`, `cubre`, `opcionesDeProxima`, `estadoDelDataset`, `tasaDeActualizacion`, `topeDatosAl`, `tipoSugerido`, `tipoEfectivo`, `frecuenciaEnNota`. Ninguna tira error: con una entrada inválida devuelven null, false o una lista vacía (`frecuenciaEnNota` devuelve la frecuencia tal cual).
- La API (`GET /datasets` y `/:id`) devuelve `datos_al`, `tipo_pedido` (el efectivo), `tipo_pedido_nombre`, `frecuencia_meses`, `pedido` (`{ desde, hasta, texto }`), `estado` y `dias_para_vencer`. Para la pantalla de admin: `GET /datasets/:id/opciones-proxima?datos_al=` y `GET /datasets/calculo-pedido` (`API.opcionesDeProxima`, `API.calculoPedido`).
- El navegador no recalcula las reglas: las pide al servidor. Las copias mínimas conocidas (para avisar en el momento; el servidor valida igual) son: en `admin-fechas.js`, `tipoSugeridoDe` (copia de `tipoSugerido`), `TIPOS_DE_PEDIDO` (copia de `TIPOS_PEDIDO` y `NOMBRES_TIPO_PEDIDO`), `frecuenciaEnNotaDe` (copia de `frecuenciaEnNota`, para la vista previa "Así va a salir en la próxima nota"), `tiposPermitidos` y `esEventual` (Eventual va solo con la frecuencia Eventual, la que no tiene meses: `esFrecuenciaEventual` del controlador), `finDeMesDe`, `finDelMesAnterior`, `topeDeDatosAl` (copia de `topeDatosAl`), `errorDeDatosAl` y `problemaDeFechasDelRegistro` (los pasos 1 y 2 de `POST /datasets/:id/actualizar`, con los mensajes del servidor), los mensajes copiados de `controllers/datasetController.js` (`ERROR_FALTA_DATOS_AL`, `ERROR_FALTA_PROXIMA`, "Todavía no puede haber datos al …" y los de la carga y la recepción posteriores a hoy o a la carga) y el texto por defecto del "Qué se solicita" (`QUE_SE_SOLICITA_POR_DEFECTO`); en `admin.js`, `mesesDeLaFrecuencia` (la Eventual es la frecuencia sin meses, como `esFrecuenciaEventual`); en `perfil.js`, `esFinDeMesTexto` (la marca "No es el último día del mes"); en `api.js`, el respaldo `Utils.calcularEstado`. Se comparan contra el servidor en un test: `tipoSugeridoDe` (con `tipoSugerido`), `TIPOS_DE_PEDIDO` (con `TIPOS_PEDIDO` y `NOMBRES_TIPO_PEDIDO`), `frecuenciaEnNotaDe` (con `frecuenciaEnNota`), `Utils.calcularEstado` (con `estadoDelDataset`) y el texto por defecto (con `QUE_SE_SOLICITA_POR_DEFECTO` de `notasDigitalesContenido.js`). El resto (`tiposPermitidos`, `esEventual`, `mesesDeLaFrecuencia`, `esFinDeMesTexto`, `topeDeDatosAl`, `finDeMesDe`, `problemaDeFechasDelRegistro`, …) solo tiene tests de comportamiento, y los mensajes copiados, tests con el texto escrito a mano: si cambia una regla o un mensaje del servidor, hay que cambiarlos a mano.
- Admin: la lista filtra por estado, gestión y tipo de pedido; el formulario tiene la sección "Actualización y pedido", con la vista previa "Así va a salir en la próxima nota" (Conjunto de datos, Frecuencia y Datos solicitados, como en la tabla del aviso). La lista dice, por ejemplo, "Acumulado. Vence el 31/01/2027". "Registrar actualización" dice "Vence" o "Vencido desde" (la marca del ciclo, "Vence"), propone las opciones de próxima y no elige ninguna de antemano. Un dataset con cambio pendiente queda bloqueado también ahí, antes de abrir el modal.
- Sitio público: el detalle muestra "Datos al", "Cargado en el portal" y "Próxima actualización prevista" (mes y año); la tarjeta del listado, "Datos al" y "Próxima"; el CSV suma "Cargado en el portal".

### Registrar una actualización
- `POST /datasets/:id/actualizar` recibe `datos_al`, `cargado_el` (o `fecha_actualizacion`, por compatibilidad; por defecto hoy), `recibido_el` (opcional), `proxima_actualizacion` y `notas`. Respeta la próxima que eligió la persona y valida fin de mes, que ninguna fecha sea futura (`datos_al`, hasta `topeDatosAl`) y que `recibido_el` no sea posterior a la carga. Crea un cambio `editar` con `registro_actualizacion: true`: pasa por la doble verificación.
- `aprobarCambio` no aprueba un cambio con una `proxima_actualizacion` o un `datos_al` que no son fin de mes (400: se rechaza y se vuelve a proponer). Si el cambio lleva `registro_actualizacion`, en la misma transacción escribe `historial_actualizaciones`: `cambio_id`, `vencimiento` (la próxima que se cumplió), `datos_al`, `recibido_el`, `proxima_nueva`; `fecha_actualizacion` es la carga.
- `historial_actualizaciones.vencimiento` es la clave del ciclo, la misma que `notas_digitales_datasets.vencimiento`: sirve a la futura "vida del dataset". El historial anterior no se reconstruyó. `gestionController` ("Operador más activo") no cuenta dos veces un registro que ahora está en las dos tablas.

### Datos solicitados en las Notas Digitales
- La tabla de próximos a vencer del aviso (4 columnas: Conjunto de datos, Área, Frecuencia y Datos solicitados; sin columna de fecha: en el aviso de todos los días todos vencen el mismo día, y si el aviso junta más de un vencimiento —la víspera de una licencia larga, un aviso recuperado tarde— las filas van ordenadas por vencimiento, con una fila a todo el ancho "Vencen el dd/mm/aaaa" ("Vence el …" si es uno solo) antes del primer dataset de cada uno, en el HTML, el texto y el PDF, donde esa fila viaja con la primera de su grupo; sale del `vencimiento` de cada dataset y no se guarda) y la de reiteración (7, con Vence o Venció) llevan la columna "Datos solicitados" (el `pedido` de cada ficha, calculado el día de la nota); la sección de vencidos de un aviso también sigue con 7. El párrafo del aviso externo termina en "…con los datos del período que se indica en cada caso." El anexo (recuadro "DATOS SOLICITADOS") y el email a las áreas de los 40 días también lo dicen; el anexo dice "Vence el dd/mm/aaaa · faltan N días" ("Venció el … · hace N días", "Vence hoy"; la línea de tiempo termina en "Vence") y el email va sin fecha. Desde el 18/10/2026 ya no hay "fecha sugerida de envío" en las notas (spec 2026-10-17, sección 18).
- La frecuencia lleva "(Acumulado)" (`frecuenciaEnNota`, `services/fechasDatasetReglas.js`: "Trimestralmente (Acumulado)") cuando el tipo de pedido efectivo es `acumulado` y la frecuencia es de 1 a 11 meses: un acumulado pide desde el 1/1 del año del corte, así que la frecuencia y el período no coinciden. Va en las tablas del aviso y de la reiteración (HTML, texto y PDF), en el renglón "Frecuencia" del anexo, en el email de 40 días y en la vista previa del admin. No se guarda: se arma al generar la nota con el tipo efectivo de `conPedido`.
- Cada nota guarda lo que pidió en `notas_digitales_datasets` (`datos_desde`, `datos_hasta`, `datos_solicitados`): lo ya enviado no cambia. Las notas 1/26 y 2/26 quedan en NULL.
- La reiteración recalcula el pedido cada vez (todo lo que falta, R7), no repite el del aviso.
- Los "Qué se solicita" no llevan fechas ni períodos: los pone el sistema (el formulario avisa, sin bloquear, si el texto los trae y el tipo pone fechas).

### Estados de dataset
Se calculan una sola vez, en el servidor (`estadoDelDataset`), según `proxima_actualizacion` y la frecuencia en meses; las páginas usan `d.estado` (`Utils.estadoDe`) y `dias_para_vencer`. `Utils.calcularEstado` queda solo de respaldo y da lo mismo.
- `actualizado` — al día
- `proximo` — próximo a vencer (hasta 60 días corridos; el día del vencimiento todavía cuenta)
- `atrasado` / `sin-respuesta` — vencido (según tipo_gestion interna/externa)
- `sin-fecha` — sin fecha de próxima actualización
- `eventual` — frecuencia Eventual: no tiene vencimiento, ni al día ni atrasado
- La tasa de actualización (`tasaDeActualizacion`) es (actualizados + próximos) sobre el total sin los eventuales: la misma en el tablero, el Estado General de Gestión y el reporte de Cumplimiento.

### Recordatorios automáticos
- Salen solo en días hábiles: lunes a viernes sin los 9 feriados nacionales fijos (`esDiaHabil` en `services/notasDigitalesCalendario.js`). Hoy = `hoyArgentina()`, nunca `CURDATE()`.
- Cron 8:15 (`/api/cron/notificaciones`): aviso a las áreas (`services/avisosDiariosService.js`) y Notas Digitales (`services/notasDigitales.js`), con la nota de auditoría al final.
- Cron 14:00 (`/api/cron/cambios-pendientes`): recordatorio de cambios pendientes (`enviarCambiosPendientes`) a quienes pueden auditarlos.

### Firma de las Notas Digitales y licencia del firmante
- Cada usuario carga su firma en Mi Perfil (`usuarios_firmas`). El superadmin elige al firmante titular en Correos (`notas_digitales_config.firmante_usuario_id`). Sin titular elegido, las notas usan la firma cargada en Correos, como antes.
- `services/notasDigitalesFirmas.js` decide cómo se firma cada fecha (`firmaParaFecha`). La víspera de la licencia del titular se anticipan los avisos (`anticipoPorLicencia`). Con persona autorizada, esos avisos (o una nota de tipo `autorizacion`) comunican la autorización (`autorizacionPendiente`); la licencia guarda esa nota (`usuarios_licencias.nota_autorizacion_id`) y durante la licencia las notas salen con las dos firmas y una leyenda que la cita. Durante la licencia, cada dataset adelantado vuelve a salir en un aviso en su fecha (su `cuenta_desde`, o el último día hábil anterior en que la persona autorizada está disponible), presentado por ella y con el párrafo "Este pedido ya se había adelantado por Nota Digital N° …", que cita la nota anticipada solo si se envió (si quedó pendiente o fallido, el dataset entra igual y no se nombra; `diaDelAvisoEnSuFecha` en `services/licenciasReglas.js`, `pendientesEnSuFecha` en `services/notasDigitalesDatos.js`, spec 7.6). Si se recupera 20 días tarde o más (por ejemplo, una autorización cargada con la licencia avanzada), los datasets que ya tienen que reiterarse quedan afuera: los informa la reiteración. La reiteración da una fila por dataset y "Informado en" nombra todos sus avisos. La persona autorizada puede tener una licencia propia que se superponga en parte con la del titular (`autorizadoParaLicencia`: le tiene que quedar algún día hábil; la autorización se comunica igual en la víspera y los días en que la persona autorizada falta no se generan notas; el formulario lo advierte y el Estado muestra una advertencia). Sin autorizado, durante la licencia no se generan notas y las reiteraciones salen a la vuelta. Un aviso anticipado cuenta los 20 días de la reiteración desde `notas_digitales_datasets.cuenta_desde`.
- Personal contratado (`usuarios.vinculo = 'contrato'`): en su firma, entre el nombre y el cargo, va el renglón más chico `Personal contratado, cumpliendo funciones de`; en los párrafos (leyenda, autorización, "Propuesto por") dice `personal contratado, cumpliendo funciones de {cargo}`. Sale solo de `cargoEnTexto` y `renglonesDeFirma` (`services/notasDigitalesContenido.js`); quien no es contratado sale como siempre.

### Auditoría de cambios pendientes
- Disponible (un día dado) = activo, con contraseña y sin licencia: la única definición es `disponibilidad` (`services/auditoriaReglas.js`), que usan `personasDeAuditoria` y `personasPorDia` (`services/auditoriaService.js`). El canal de cada cambio lo decide una sola función pura, `canalDelCambio` (`services/auditoriaReglas.js`), igual para el recordatorio de las 14:00 y la nota de las 8:15.
- Canal **nota** (spec 9.1): ya tuvo sus dos recordatorios por email: su primer recordatorio (`cambios_pendientes.primer_recordatorio_at`) fue hace `RECORDATORIOS_ANTES_DE_LA_NOTA` (2) días hábiles o más, o sea recordatorio el día 1 y el día 2 a las 14:00 y nota el día 3 a las 8:15, el firmante titular (sin titular, el superadmin) no puede auditarlo, hay auditores disponibles y la nota puede salir (envío automático activo, configuración de Notas Digitales completa, Para de auditoría cargado y hay quién firme). Si no, canal **recordatorio**.
- Recordatorio: solo días hábiles, los cambios propuestos hace una hora o más. `created_at` es TIMESTAMP y la base puede estar en UTC: la antigüedad se mide en SQL con `TIMESTAMPDIFF(SECOND, created_at, NOW())` (reloj y zona de la base en los dos extremos), nunca comparando su texto con `ahoraArgentina()`.
- Nota de auditoría (tipo `auditoria`, sin gestión, numeración del libro): una por día, después de avisos y reiteraciones; nuevos y reiterados a los 5 días hábiles de la última nota; destinatarios `para_auditoria` y `cc_auditoria` de `notas_digitales_config`, con el `cco` general.
- Días sin auditor (spec 9.5): un día hábil en que ningún superadmin ni admin está disponible (los editores no cuentan: son el respaldo). `periodosSinAuditor` (`services/auditoriaService.js`) agrupa los días hábiles seguidos en períodos `{ desde, hasta, vuelve, respaldo }` (la regla pura es `agruparDiasSinAuditor`, en `auditoriaReglas.js`; `vuelve` es el primer día hábil con algún auditor, hasta 366 días, o `null`). La disponibilidad sigue en un solo lugar (`disponibilidad`, usada por `personasDeAuditoria` y `personasPorDia`). Se muestra en tres lugares: el formulario de licencias (`GET /api/usuarios/licencias/sin-auditor` simula la licencia sin guardarla, con `usuario_id` y `excluir`; la pestaña Licencias lo pide sin parámetros, de hoy a hoy + 60 días), el aviso a quien propone y Correos → Estado (`sin_quien_audite` y `periodos_sin_auditor`).
- Aviso a quien propone (dentro del recordatorio de las 14:00, `sinAuditorTemplate`): si un cambio que entra en el recordatorio no tiene a nadie que lo audite (`quienesAuditan` vacío), quien lo propuso recibe un solo email con todos sus cambios en esa situación, una vez por cambio (`cambios_pendientes.aviso_sin_auditores_at`, escrito con `ahoraArgentina()`). De licencia no se manda: queda NULL y sale a su vuelta si sigue sin auditor.
- Mi Perfil en pestañas: Para revisar, Mis cambios, Mis datos y Mi firma (el email de las 14:00 abre `perfil.html#para-revisar`; el lector solo ve Mis datos). Cada cambio es una fila que se despliega con la comparación (lo viejo tachado, lo nuevo resaltado; palabra por palabra en los textos largos) y se aprueba (con confirmación en la fila) o se rechaza (con motivo) ahí mismo. Las listas `GET /cambios-pendientes/para-revisar` y `/mis-cambios` traen la comparación (`campos_modificados`), los datos enriquecidos y `dataset_url`; `para-revisar`, además, `auditoria` con `auditan` (quiénes lo auditan hoy, para la marca del editor). `GET /:id` sigue devolviendo `auditoria` como `{ puede, respaldo, mensaje }`. `calcularCambios` compara por día `ultima_actualizacion` (rótulo "Cargado en el portal"), `datos_al`, `proxima_actualizacion` y `recibido_el`; un registro de actualización se titula "Actualización registrada". La UI solo refleja el permiso del servidor (`permisoDeAuditoria` falla cerrado), que vuelve a validar al aprobar o rechazar.

## Seguridad
- JWT_SECRET obligatorio al iniciar (process.exit(1) si falta)
- Rate limiting: login (10/15min), contacto (5/hora por IP)
- Helmet CSP configurado
- Passwords hasheadas con bcrypt
- SQL injection prevenido con queries parametrizadas
- XSS prevenido con `Utils.escapeHtml()` en frontend

## Variables de entorno requeridas
```
PORT, CORS_ORIGIN
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
JWT_SECRET (obligatorio), CRON_SECRET
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
APP_URL (links de los emails; por defecto la URL de producción)
EMAIL_SOLO_A, RPAD_TESTS_DB_LOCAL, DB_ROOT_PASSWORD (solo desarrollo local)
```

## Despliegue (producción)
- cPanel sin terminal: el SQL se corre en phpMyAdmin (pestaña SQL o Importar), los archivos se suben con el Administrador de archivos, y las variables de entorno, "Run NPM Install" y Restart se manejan en Setup Node.js App. El cron se configura en Tareas Cron.
- Las migraciones van antes que el código (excepción: `migracion-fechas-datasets-textos.sql` va después de subir los archivos, ver el README). Las cargas de datos de personas (roles, cargos) van en `database/privado/` (no versionado) y se corren después del código.
- Regla del proyecto: no romper nada de lo implementado. Correr `npm test` completo antes y después de cada cambio.
