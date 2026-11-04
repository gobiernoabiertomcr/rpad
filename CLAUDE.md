# RPAD - Registro Permanente de Actualización de Datasets

Sistema de gestión de datos abiertos para la Municipalidad de Comodoro Rivadavia.
Registra datasets, controla frecuencias de actualización, genera reportes PDF/DOCX, y envía notificaciones por email.

Este archivo se carga siempre: tiene lo que no se puede olvidar y el mapa.
Los contratos de cada tema están en `docs/temas/`.
Al abrir un archivo, una regla de `.claude/rules/` puede decirte qué documento leer: leelo antes de cambiar nada.
Un subagente con `isolation: worktree` no recibe esas reglas: pasale los documentos en el brief.

## Tech Stack

- **Backend:** Node.js 22, Express 4.18, ES Modules
- **Base de datos:** MariaDB 10.6+ (mysql2/promise, pool de 10 conexiones)
- **Auth:** JWT (7h expiración), bcryptjs
- **Frontend:** HTML5, CSS3, vanilla JS (sin frameworks)
- **PDF:** PDFKit | **DOCX:** docx | **Email:** Nodemailer
- **Emails:** un solo remitente, `remitente()` de `services/emailService.js` ("Dir. de Datos Públicos y Comunicación"), y un solo marco, `marcoEmail` de `services/emailTemplates.js` (diseño pastel "celeste institucional", tablas y estilos en línea, sin emojis), para todas las plantillas.
  Las Notas Digitales tienen su propio armado.
- **CDN:** ninguno.
  Ninguna página carga un script ni una hoja de afuera, salvo las fuentes de Google (lo controlan `tests/paginas.test.js` y `tests/publico.test.js`).
  Una página que vuelva a cargar algo de afuera necesita sumarlo a la CSP.
  Sin Lucide por CDN (los íconos son SVG embebidos) ni FullCalendar (el calendario es HTML propio).
  Fuentes por Google Fonts.

## Comandos

- `npm start` — Inicia el servidor (puerto 3001)
- `npm run setup-admin` — Crea un usuario (superadmin, admin, editor, colaborador o lector; por defecto lector)
- `npm test` — Tests de integración: requieren `docker compose up -d` (MariaDB + Mailpit) y `RPAD_TESTS_DB_LOCAL=1` en el `.env` local.
  Cada servidor de prueba (`iniciarServidor`, `tests/helpers.js`) escucha en un puerto libre y se da por listo cuando su proceso escribe «Servidor corriendo en puerto: N» (`app.js`): ese cartel no se cambia.
- Migraciones: en local, `mysql -u USUARIO -p NOMBRE_BASE < database/updates/<archivo>.sql` (ningún SQL trae `USE`); en producción, phpMyAdmin (`docs/temas/despliegue.md`).

## Entorno

- Una sola suite por contenedor: chocan las bases de nombre fijo (`rpad_test_<archivo>` y `rpad_schema_*`), los `GET_LOCK`, que son de toda la instancia, y Mailpit.
- Nunca `docker compose` desde un worktree: recrea `rpad-db` y corta lo que esté corriendo. Nunca `down -v`: el único volumen tiene todas las bases.
- Un worktree no trae lo que está en `.gitignore`: hay que copiar el `.env`, con `RPAD_TESTS_DB_LOCAL=1`.
- `tests/schema.test.js` y `tests/permisos.test.js` leen la base del `.env`: una migración nueva también tiene que correr en la base local antes de la suite.
- Un test nuevo llama al servicio con un hoy fijo, no a `/api/cron/*`: la corrida real escribe en la base del `.env` (`tests/notificaciones.test.js` es la excepción que queda).

## Estructura

```
app.js                    # Entry point Express (y las redirecciones de usuarios.html y areas.html a Configuración y de gestion.html a Proyectos)
config/database.js        # Pool MySQL
config/upload.js          # Las subidas de Proyectos: subida(tipo), multer armado en cada pedido con sus límites, rutaSegura y UPLOADS_DIR; y la de una nota firmada, subidaDeNotaFirmada (en memoria)
controllers/              # Un controlador por tema: en la sección Archivos de cada documento
services/                 # Reglas puras (*Reglas.js), consultas (*Datos.js) y dibujo (*Pdf.js): en la sección Archivos de cada documento
middleware/auth.js         # JWT middleware (authMiddleware y sesionOpcional, las dos sobre verificarSesion; adminOnly, cargaNotasDgmit, usaGeneradorDeNotas, cronAuth)
middleware/cuerpo.js       # Lo que se responde cuando el cuerpo o la query de un pedido no se pueden usar (datosComunes y erroresDelCuerpo)
middleware/rateLimit.js    # Los límites de pedidos de login, recuperar y links
routes/index.js           # Todas las rutas
database/schema.sql       # Schema completo
database/updates/         # Migraciones SQL
scripts/setup-admin.js    # Setup inicial
public/                   # Frontend: una página HTML por pantalla
  js/config.js            # API_URL, localStorage keys
  js/auth.js              # Manejo de sesión JWT
  js/api.js               # Capa centralizada de fetch
  js/main.js              # Carcasa: encabezado, menú lateral, año del footer
  css/main.css            # Carcasa, fuentes, tokens y estilos de administración (las 14 páginas con carcasa)
  css/publico.css         # Solo las 5 páginas públicas (index, datasets, dataset, calendario, contacto)
  css/styles.css, layout.css, perfil.css  # Sin uso: no los carga ninguna página
```

## El mapa

Si tocás esto, leé este documento de `docs/temas/`:

| Tema | Documento |
|---|---|
| Fechas de un dataset, «Registrar actualización», «Requiere nota DGMIT», estados, Mi Perfil | `datasets.md` |
| Quién audita, canal de cada cambio, nota de auditoría, días sin auditor | `auditoria.md` |
| Notas Digitales: datos solicitados, tablas, anexos, firma, licencia del firmante, hoja, reiteración, Correos | `notas-digitales.md` |
| Firma digital de las notas | `firma-digital.md` |
| Calendario de días hábiles y crons | `calendario-y-corridas.md` |
| Seguimiento del dataset: ciclos, avisos, cinta, PDF | `seguimiento.md` |
| Notas DGMIT | `notas-dgmit.md` |
| Métricas, foto del 31/12 y reportes PDF | `metricas-y-reportes.md` |
| Ciclo de vida del dato | `ciclo-de-vida.md` |
| Generador de Notas y el Word de las notas | `generador-de-notas.md` |
| Configuración: usuarios, licencias, áreas | `configuracion.md` |
| Feriados | `feriados.md` |
| Proyectos | `proyectos.md` |
| Carga de páginas, versiones, CSS, carcasa, sitio público | `frontend.md` |
| Una tabla, una columna, una migración | `base-de-datos.md` |
| Producción, kits, orden de migraciones y vueltas atrás, pendientes con fecha | `despliegue.md` |
| Mi espacio: modalidad, vacaciones, topes, horas extras, saldo inicial, Resumen, su API | `mi-espacio.md` |
| Mi espacio: paso a Configuración, «Hoy no están», email de vencimiento | `mi-espacio-paso-y-avisos.md` |
| Mi espacio: planilla de contrato, «Sumar al mes anterior» | `mi-espacio-planilla.md` |
| Mi espacio: horas acumuladas | `mi-espacio-acumuladas.md` |
| Mi espacio: días restituidos | `mi-espacio-restituidos.md` |
| Mi espacio: agenda, eventos, recordatorios | `mi-espacio-agenda.md` |
| Mi espacio: el mes de la agenda, nombre corto | `mi-espacio-agenda-mes.md` |
| Mi espacio: evento Personal (Público) | `mi-espacio-evento-publico.md` |
| Mi espacio: nota de licencia en Word | `mi-espacio-nota-word.md` |

`miEspacioReglas.js`, `miEspacioResumen.js` y `mi-espacio.js` tienen todos los subtemas adentro: elegí por lo que vas a cambiar, no por el archivo.

## Cómo se documenta

- Al terminar una feature se actualiza `docs/temas/<tema>.md`.
  `CLAUDE.md`, solo si nace un tema o cambia una regla transversal.
  `.claude/rules/`, solo si nace un tema o cambia un glob: es una ruta protegida y cada escritura pide permiso.
- Se escribe lo vigente.
  Lo que era antes y qué entrega lo trajo quedan en git y en la spec: nada de «pasó a», «desde la entrega X» ni listas de lo que cubre cada test.
- Sí se escribe la decisión con su motivo, si alguien podría «arreglarla» de buena fe.
- Un renglón por oración. Sin kits: cada kit tiene su `PASOS.txt`.
- `tests/documentos.test.js` controla los topes: si molesta, se parte el documento.

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
- Soft deletes: campo `activo` (TRUE/FALSE) en lo que se puede volver a mirar. Hay borrados reales donde el tema lo dice: áreas, métricas manuales, hitos.
- Controladores en `controllers/*Controller.js`. Los servicios se nombran por lo que hacen: `*Reglas.js` (puro), `*Datos.js` (consultas), `*Pdf.js` (dibujo), `*Service.js`.
- Un 500 dice un mensaje fijo por operación; el error completo, solo en la consola.
- Un id que no es un entero positivo (`idPositivo`) o que no existe da 404 en JSON, nunca 500.

### Frontend

- Vanilla JS, sin frameworks
- API calls centralizadas en `api.js` (objeto `API`)
- Utilidades en `api.js` (objeto `Utils`: formatDate, calcularEstado, escapeHtml, etc.)
- Iconos: Lucide SVG embebidos, con `aria-hidden="true"` los decorativos del HTML. Los del objeto `Icons` de main.js no lo llevan.
- Toast notifications: `showToast(message, type)`. No escapa: lo escapa quien lo llama.
- Siempre `<script src="js/X.js…"></script>` a secas, sin `defer` ni otros atributos (lo lee `tests/paginas.test.js`).
- Cada `?v=` está atado a una constante de `tests/paginas.test.js`: al cambiar un script, se suben las dos. Tocar `auth.js`, `main.js` o `api.js` sube `VERSION` en todas las páginas que los cargan (`docs/temas/frontend.md`).
- La carcasa está copiada a mano en las 14 páginas: un cambio va en las 14.
- Los scripts de cada página, al cargarse, solo declaran (los tests los cargan en un `vm`): lo que arma HTML es puro y recibe quién mira por parámetro; lo que toca el DOM o la API va aparte, al final, con los eventos delegados en contenedores fijos.
- `API.pedirJson` tira error ante una respuesta de error, pero no da los `errores` de un 400. `API.pedirArchivo` es solo GET y no da el estado ni el `Content-Disposition`: por eso hay `fetch` propios, con JWT en el encabezado, nunca en la URL.
- «Guardar» y confirmar deshabilitan su botón hasta la respuesta (un doble clic manda un solo pedido).
- Los textos no llevan `maxlength` (cuenta unidades de UTF-16: un emoji son dos): se cuenta con `Array.from`, como el servidor.
- Ningún nombre de clase ni id empieza con `ad-` (de «admin»): los bloqueadores de anuncios ocultan muchos (`tests/paginas.test.js` lo controla).
- Foco visible, 4,5:1 o más en todo texto y el color nunca es lo único que distingue; con `prefers-reduced-motion`, nada se mueve.

## Reglas transversales

### Fechas y días hábiles

- Fechas en el navegador: texto `'AAAA-MM-DD'`, cortado como texto; nunca `Utils.formatDate` para una fecha sola (en el navegador argentino muestra el día anterior) ni `toISOString()` para "hoy" (después de las 21 da mañana: `Utils.hoyEnArgentina()`).
- En el servidor, hoy es `hoyArgentina()`. Las reglas puras no usan pool ni `Date` local y reciben hoy por parámetro.
- Un TIMESTAMP está en UTC: se pasa a hora argentina con `UNIX_TIMESTAMP` y `ahoraArgentina`, y una antigüedad se mide en SQL. `NOW()` da hora argentina en producción y UTC en el Docker local.
- Hay un solo calendario de días hábiles: los 9 fijos y la tabla `feriados`.
  Una sola lectura de la tabla por corrida o por pedido.
  `leerCalendario` nunca tira; la caída se detecta siempre por `calendario.error !== null`, nunca por `origen`.
  Métricas y la foto no siguen con los 9 fijos (`exigirLaTabla`).
  `tests/calendario-unico.test.js` falla si otro archivo importa `esDiaHabil` o una derivada fija.

### El servidor manda

- El navegador no recalcula las reglas: cifras, estados, días, plurales y textos los arma el servidor, y la página y los PDF los imprimen tal cual (Ruling 19).
- Las copias del navegador son mínimas, para avisar en el momento, y están atadas por tests de paridad: si cambia una regla o un mensaje del servidor, hay que cambiarlas.
- Una sola fuente por regla: `estadoDelDataset`, `tasaDeActualizacion`, `cumplimientoPorArea`, `permisoParaAuditar`, `canalDelCambio`, `disponibilidad`, `ciclosDe`. No se copian: se llaman.
- Todo texto del servidor pasa por `Utils.escapeHtml` (también en `title` y `aria-label`) y un número va con `String`: `Utils.escapeHtml(0)` da ''.

### Datos

- El 0 es un valor: sobre `requiere_nota` y los parecidos, nunca `x || null`, siempre `??`.
- Lo ya enviado no cambia: una nota queda en bytes, y su PDF y su anexo nunca se regeneran.
- La foto del 31/12 (`metricas_fotos`) no se modifica nunca y guarda textos ya armados. Cambiar su forma obliga a subir su versión o a leer con tolerancia.
- Las migraciones van antes que el código, y todo lo nuevo va también en `database/schema.sql`. `estadosDe` lee las tablas de Mi espacio que hacen al estado de una persona: una columna sin migrar en ellas da 500 en todo Mi espacio.
- Sin `CHECK` en la base para las reglas de negocio: valida la API.
- `aprobarCambio` es el único que aplica un cambio a un dataset. La forma de `datos_nuevos` y `datos_anteriores` la leen el Seguimiento, Métricas y las notas de auditoría: es un contrato.

### Privacidad

- El tipo de una licencia solo sale para su dueño: a Configuración pasan solo las fechas y a los compañeros, solo «no está».
- Un id de otra persona da el mismo 404 que uno que no existe.
- Un evento Personal (Público) le llega a otra persona recortado desde la consulta, y el orden no delata el título.
- Sin destinatario, `sendEmail` va a las casillas por defecto de la DGMIT: nunca se llama con una lista vacía.
- El texto de nodemailer, que puede traer la dirección, no va a un resultado que se muestre.
- Repositorio público: ningún nombre real, tampoco en ejemplos ni citas, y ningún dato de producción (Ruling 3). Las cargas de personas van en `database/privado/`, que no se versiona.

### Lenguaje y nombres

- Lenguaje neutro: nunca «tardanza», «demora», «atraso», «sin respuesta», «sin entregar» ni «no mandó». El atraso muchas veces no depende del área.
- En Mi espacio, lo que no se usó es «no utilizado previamente» y una licencia «vence el …». «Perdés» es la excepción, para lo que ya no se puede usar.
- En el código, la agenda es `evento` o `mi_espacio_`, **nunca «agenda» a secas**, para no confundirla con la Agenda de pedidos de Reportes.
- Hay dos `nombreCorto`, en archivos distintos: `miEspacioReglas.js` y `seguimientoReglas.js`. Un archivo que necesite las dos usa un alias.

### Qué frena una licencia

- El sistema no frena licencias por lo que cambió después: un feriado dado de baja, un saldo corregido, una salida de la planilla, unos días por restituir o lo que quedó distinto en Configuración avisan y nunca frenan una carga.
- Sí frenan, porque no se podría cumplir lo pedido: una carga nueva que no cierra; una corrección que empeora lo que falta; una persona a cargo que no sirve; y borrar o mover una licencia que ya empezó en Configuración.

## Doble verificación (CRÍTICO)

Todo cambio a datasets pasa por doble verificación:
1. Un admin o un editor propone el cambio → se crea registro en `cambios_pendientes`
2. Otra persona aprueba o rechaza → se aplica al dataset.
   Auditan los auditores (superadmin o admin); un editor, de respaldo, si ese día no hay ningún auditor disponible que no lo haya propuesto (queda `cambios_pendientes.revisado_como_respaldo`), o, si hay alguno, **sin responsabilidad por la auditoría** cuando el cambio lo propuso un auditor (por su rol de hoy; queda `cambios_pendientes.revisado_sin_responsabilidad`; spec 2026-10-20-editor-sin-responsabilidad).
   El cambio de un editor, con auditores disponibles, lo auditan ellos.
   Una sola regla: `permisoParaAuditar` en `services/auditoriaReglas.js`, que devuelve siempre `{ puede, respaldo, sin_responsabilidad, mensaje }` (las dos marcas nunca juntas).
   `quienesAuditan` (recordatorio de las 14:00, nota de auditoría, días sin auditor) no cambia: el editor no recibe recordatorios mientras haya auditores.

- Un usuario NO puede aprobar sus propios cambios
- Si un dataset tiene cambio pendiente, queda bloqueado para nuevas ediciones

## Roles

- **superadmin:** todo lo de admin.
  Su cuenta solo la modifica su titular y recibe un aviso cuando otro usuario crea un admin o un editor, cambia un rol, cambia el email de un admin o un editor, reactiva a uno de ellos o desactiva a alguien; durante su licencia esos avisos se retienen y a la vuelta le llega un resumen.
  Se asigna por SQL (o con `npm run setup-admin`), nunca desde el panel.
- **admin:** CRUD datasets (con doble verificación), Configuración (el panel de usuarios, las licencias, las áreas y los feriados), aprobación de cambios, reportes, las métricas manuales de Métricas («Cargar el mes»), notificaciones
- **editor:** todo lo de admin, pero audita cambios de respaldo o, los de un auditor, sin responsabilidad por la auditoría y en el panel de usuarios solo crea y modifica lectores y colaboradores, y solo pasa a alguien de lector a colaborador o al revés (`ROLES_DEL_EDITOR` y `rechazoParaEditor` en services/usuariosReglas.js; nunca cambia el suyo).
  Puede tener licencia, cargar su firma y ser la persona autorizada del firmante, pero no firmante titular.
- **colaborador:** lo mismo que un lector y, además, carga notas DGMIT en Herramientas → Seguimiento y corrige o anula las que cargó, y usa el Generador de Notas (Herramientas → Notas).
  No es de administración (`esAdmin` y `Auth.isAdmin()` no lo incluyen), no audita, no cuenta para el mínimo de auditores y no tiene licencias ni firma.
  Lo asignan el admin y el superadmin, y el editor (entre lector y colaborador).
  Un cambio de rol le avisa al superadmin (también de lector a colaborador); crear un colaborador no, como crear un lector.
- **lector:** solo lectura de datos públicos + perfil y Mi espacio, y las Herramientas: Métricas y Reportes (la pestaña Métricas y los ocho PDF, sin cargar las métricas manuales), Proyectos (ve todo y baja y previsualiza los documentos y los archivos, como el colaborador; no carga, edita ni borra) y Seguimiento (incluido quién propuso y quién aprobó cada cambio).
  No tiene Notas: el menú lateral no la muestra y `notas.html` dice "No tenés permiso para usar el generador de notas.".
  La ayuda del rol en Usuarios lo dice (`usuarios.js`; la del colaborador suma el generador)
- **Licencias:** superadmin, admins (y editores) pueden tener licencias (pestaña Licencias de Configuración).
  Durante la licencia no reciben emails del sistema (salvo los de la agenda de Mi espacio, que van al mail laboral); los avisos al superadmin se retienen y le llega un resumen a la vuelta.
  Ver services/licenciasReglas.js y services/avisosSuperadminService.js.
  El alta, la edición y la anulación con sus reglas están en `services/licenciasOficialesService.js`, que comparten Configuración y Mi espacio.
- **Mi espacio:** todos los roles con sesión usan su propio panel de licencias y horas extras, que no ve nadie más (ni administración, ni el superadmin).
  «Los compañeros» son administración (`esAdmin`: superadmin, admin y editor): solo ellos tienen la casilla «Mostrar a mis compañeros» y ven «Hoy no están», y solo se muestran sus ausencias.
  Solo administración comparte eventos Laborales; cualquier rol carga un Personal (Público).
- El rol y el estado activo se leen de la base en cada pedido (`authMiddleware`, y `sesionOpcional` en las rutas públicas que muestran más con una sesión; las dos sobre `verificarSesion`): desactivar o cambiar un rol tiene efecto inmediato.
- `esAdmin(rol)` (services/usuariosReglas.js) y `Auth.isAdmin()` incluyen al superadmin y al editor (acceso a la administración);
  `esAuditor(rol)` y `Auth.isAuditor()` (superadmin o admin) deciden quién audita y quién cuenta para el mínimo;
  `puedeCargarNotasDgmit(rol)` y su copia `Auth.puedeCargarNotasDgmit()` (administración y el colaborador) deciden quién carga notas DGMIT y quién usa el Generador de Notas (`cargaNotasDgmit`, `usaGeneradorDeNotas` y el enlace "Notas" del menú lateral): no comparar con `'admin'` a mano.
- Siempre tiene que haber al menos 2 auditores activos (superadmin o admin, con contraseña): el panel no deja bajar de ese mínimo, y pasar a un admin a editor, colaborador o lector cuenta como quitar uno.
  El firmante titular no puede pasar a editor, colaborador ni lector.

## Seguridad

- JWT_SECRET obligatorio al iniciar (process.exit(1) si falta)
- Rate limiting (`middleware/rateLimit.js`): login, 10 fallidos por usuario e IP y 50 por IP cada 15 minutos; recuperar, 5 por hora por IP y 3 por identificador; links de acceso, 20 cada 15 minutos por IP. Contacto: 5 por hora por IP, en memoria.
- El cuerpo de un pedido (`middleware/cuerpo.js`): un JSON roto da 400 y uno de más de 1 MB, 413, con el formato de la API y un texto fijo, sin repetir lo que llegó ni dejarlo en la consola.
  `datosComunes`, después de los dos lectores, rechaza con el mismo 400, en todas las rutas, las claves de `CLAVES_RESERVADAS`, que pisan lo que todo objeto trae de fábrica, en el cuerpo y en la query, y un cuerpo de más de 32 niveles (un multipart no pasa por ahí: esas subidas no leen `req.body`).
  Los demás errores siguen en 500 (`tests/errores-del-cuerpo.test.js`)
- Contacto, login y «¿Olvidaste tu contraseña?» miran primero que cada campo sea un texto; en el email de contacto, el largo antes que el formato (`tests/contacto-validacion.test.js` y `tests/auth-tipos.test.js`).
  `GET /api/andino/fetch` pide sesión de administración y su pedido al portal tiene tiempo límite: 504 si vence (`tests/andino.test.js`)
- Helmet CSP configurado (`app.js`): `script-src 'self' 'unsafe-inline'` y `script-src-attr 'unsafe-inline'`, sin ningún CDN (ni jsDelivr ni cdnjs); estilos del sitio y de Google Fonts.
  `tests/publico.test.js` lee la cabecera y `tests/paginas.test.js` mira que ninguna página cargue un script o una hoja de afuera
- Passwords hasheadas con bcrypt
- SQL injection prevenido con queries parametrizadas
- XSS prevenido con `Utils.escapeHtml()` en frontend
- Los datos de contacto de las áreas (emails, teléfonos y persona de contacto) solo los devuelven las APIs públicas de áreas y de datasets a una sesión de administración (`sesionOpcional` + `esAdmin`; ver `docs/temas/configuracion.md`)

## Variables de entorno requeridas

```
PORT, CORS_ORIGIN
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
JWT_SECRET (obligatorio), CRON_SECRET
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
APP_URL (links de los emails; por defecto la URL de producción)
EMAIL_SOLO_A, RPAD_TESTS_DB_LOCAL, DB_ROOT_PASSWORD, MAILPIT_URL (solo desarrollo local)
UPLOADS_DIR (opcional, absoluta: la carpeta de las subidas de Proyectos; sin ella, uploads/ junto a la app; los tests la apuntan a una temporal)
```

## Despliegue (producción)

- cPanel sin terminal: el SQL se corre en phpMyAdmin (pestaña SQL o Importar), los archivos se suben con el Administrador de archivos, y las variables de entorno, "Run NPM Install" y Restart se manejan en Setup Node.js App. El cron se configura en Tareas Cron.
- Las migraciones van antes que el código, y el respaldo y el despliegue, fuera del horario de los crons. El detalle, el orden de las vueltas atrás y lo pendiente con fecha, en `docs/temas/despliegue.md`.
- Regla del proyecto: no romper nada de lo implementado. Correr `npm test` completo antes y después de cada cambio.
