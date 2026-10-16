# RPAD - Registro Permanente de Actualización de Datasets

Sistema de gestión de datos abiertos para la Municipalidad de Comodoro Rivadavia. Registra datasets, controla frecuencias de actualización, genera reportes PDF/DOCX, y envía notificaciones por email.

## Tech Stack
- **Backend:** Node.js 22, Express 4.18, ES Modules
- **Base de datos:** MariaDB 10.6+ (mysql2/promise, pool de 10 conexiones)
- **Auth:** JWT (7h expiración), bcryptjs
- **Frontend:** HTML5, CSS3, vanilla JS (sin frameworks)
- **PDF:** PDFKit | **DOCX:** docx | **Email:** Nodemailer
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
services/                 # emailService, emailTemplates
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
- Cada página carga: config.js → auth.js → api.js → página.js
- API calls centralizadas en `api.js` (objeto `API`)
- Utilidades en `api.js` (objeto `Utils`: formatDate, calcularEstado, escapeHtml, etc.)
- Iconos: Lucide SVG embebidos en main.js (objeto `Icons`)
- Toast notifications: `showToast(message, type)`

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
- Campos JSON validados en `cambios_pendientes` (datos_nuevos, datos_anteriores)
- Foreign keys con CASCADE en deletes relevantes

### Estados de dataset
Calculados dinámicamente según `proxima_actualizacion`:
- `actualizado` — al día
- `proximo` — próximo a vencer
- `atrasado` / `sin-respuesta` — vencido (según tipo_gestion interna/externa)
- `sin-fecha` — sin fecha de próxima actualización

### Recordatorios automáticos
- Salen solo en días hábiles: lunes a viernes sin los 9 feriados nacionales fijos (`esDiaHabil` en `services/notasDigitalesCalendario.js`). Hoy = `hoyArgentina()`, nunca `CURDATE()`.
- Cron 8:15 (`/api/cron/notificaciones`): aviso a las áreas (`services/avisosDiariosService.js`) y Notas Digitales (`services/notasDigitales.js`), con la nota de auditoría al final.
- Cron 14:00 (`/api/cron/cambios-pendientes`): recordatorio de cambios pendientes (`enviarCambiosPendientes`) a quienes pueden auditarlos.

### Firma de las Notas Digitales y licencia del firmante
- Cada usuario carga su firma en Mi Perfil (`usuarios_firmas`). El superadmin elige al firmante titular en Correos (`notas_digitales_config.firmante_usuario_id`). Sin titular elegido, las notas usan la firma cargada en Correos, como antes.
- `services/notasDigitalesFirmas.js` decide cómo se firma cada fecha (`firmaParaFecha`). La víspera de la licencia del titular se anticipan los avisos (`anticipoPorLicencia`). Con persona autorizada, esos avisos (o una nota de tipo `autorizacion`) comunican la autorización (`autorizacionPendiente`); la licencia guarda esa nota (`usuarios_licencias.nota_autorizacion_id`) y durante la licencia las notas salen con las dos firmas y una leyenda que la cita. Sin autorizado, durante la licencia no se generan notas y las reiteraciones salen a la vuelta. Un aviso anticipado cuenta los 20 días de la reiteración desde `notas_digitales_datasets.cuenta_desde`.

### Auditoría de cambios pendientes
- Disponible (un día dado) = activo, con contraseña y sin licencia: solo lo calcula `personasDeAuditoria` (`services/auditoriaService.js`). El canal de cada cambio lo decide una sola función pura, `canalDelCambio` (`services/auditoriaReglas.js`), igual para el recordatorio de las 14:00 y la nota de las 8:15.
- Canal **nota** (spec 9.1): ya tuvo su primer recordatorio un día hábil anterior (`cambios_pendientes.primer_recordatorio_at`), el firmante titular (sin titular, el superadmin) no puede auditarlo, hay auditores disponibles y hay quién firme. Si no, canal **recordatorio**.
- Recordatorio: solo días hábiles, los cambios propuestos hace una hora o más. `created_at` es TIMESTAMP y la base puede estar en UTC: la antigüedad se mide en SQL con `TIMESTAMPDIFF(SECOND, created_at, NOW())` (reloj y zona de la base en los dos extremos), nunca comparando su texto con `ahoraArgentina()`.
- Nota de auditoría (tipo `auditoria`, sin gestión, numeración del libro): una por día, después de avisos y reiteraciones; nuevos y reiterados a los 5 días hábiles de la última nota; destinatarios `para_auditoria` y `cc_auditoria` de `notas_digitales_config`, con el `cco` general.

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
- Las migraciones van antes que el código. Las cargas de datos de personas (roles, cargos) van en `database/privado/` (no versionado) y se corren después del código.
- Regla del proyecto: no romper nada de lo implementado. Correr `npm test` completo antes y después de cada cambio.
