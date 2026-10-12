![RPAD - Registro Permanente de Actualización de Datasets](public/img/logo-2025.png)

# RPAD - Registro Permanente de Actualización de Datasets

![Versión](https://img.shields.io/badge/version-1.5.0-blue.svg)
![Node](https://img.shields.io/badge/node-v22.18.0-green.svg)
![License](https://img.shields.io/badge/License-CC%20BY--SA%204.0-blue)

Sistema de seguimiento y gestión de actualización de datasets para la Municipalidad de Comodoro Rivadavia.

**Versión actual:** 1.5.0

## Descripción

RPAD permite registrar datasets, asignarles frecuencias de actualización y monitorear su estado. El tablero de seguimiento muestra estadísticas en tiempo real sobre datasets actualizados, próximos a vencer y vencidos, diferenciando entre gestión interna y externa. Incluye un sistema de doble verificación donde un operador propone cambios y un segundo operador los aprueba o rechaza antes de que se apliquen.

## Tecnologías

- **Backend**: Node.js + Express (JavaScript ES Modules)
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Base de datos**: MySQL/MariaDB
- **Autenticación**: JWT
- **Gráficos**: Chart.js (via CDN)
- **Calendario**: FullCalendar.js (via CDN)
- **Email**: Nodemailer
- **PDFs**: PDFKit
- **DOCX:** docx (generación programática de documentos Word)

## Roles de Usuario

El sistema cuenta con dos roles de usuario:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `admin` | Administrador completo | Proponer creación, edición y eliminación de datasets. Aprobar o rechazar cambios propuestos por otro admin. Gestionar áreas. Configurar notificaciones SMTP. Generar reportes y notas. |
| `lector` | Solo lectura | Ver todas las secciones (tablero, calendario, datasets, áreas, reportes, notas) sin poder modificar datos. |

Los cambios sobre datasets requieren doble verificación: un admin propone y otro admin distinto aprueba o rechaza. Los usuarios con rol `lector` ven el mensaje "Solo lectura" en lugar de los botones de acción.

## Estructura del proyecto

```
rpad/
├── app.js                         # Entry point - Express server
├── package.json
├── htaccess-frontend.txt          # Referencia de configuración Apache
├── .env                           # Variables de entorno (no incluido en repo)
├── .env.example                   # Template de variables
├── config/
│   └── database.js                # Pool de conexiones MySQL
├── controllers/
│   ├── authController.js          # Login, verificación, cambio password
│   ├── catalogController.js       # Temas, frecuencias, formatos
│   ├── datasetController.js       # CRUD datasets, estadísticas
│   ├── areasController.js         # CRUD áreas responsables
│   ├── andinoController.js        # Integración con portal de datos
│   ├── cambiosPendientesController.js  # Sistema de doble verificación
│   ├── contactoController.js      # Formulario de contacto público
│   ├── notificacionesController.js  # Sistema de alertas por email
│   ├── notasController.js         # Generador de notas DOCX
│   └── reportesController.js      # Generación de reportes PDF
├── services/
│   ├── emailService.js            # Configuración SMTP y envío
│   └── emailTemplates.js          # Plantillas HTML para emails
├── database/
│   ├── schema.sql                 # Estructura y datos iniciales de la BD
│   └── updates/                   # Scripts de migración
│       ├── migracion-v1.2.0-v1.3.0.sql
│       ├── migracion-v1.3.0-v1.4.0.sql
│       └── migracion-v1.4.0-v1.5.0.sql
├── middleware/
│   └── auth.js                    # JWT middleware
├── routes/
│   └── index.js                   # Definición de rutas API
├── scripts/
│   └── setup-admin.js             # Script para crear usuario admin
└── public/                        # FRONTEND
    ├── index.html                 # Tablero de seguimiento
    ├── datasets.html              # Listado de datasets
    ├── dataset.html               # Detalle de dataset
    ├── login.html                 # Formulario de login
    ├── admin.html                 # Panel de administración de datasets
    ├── areas.html                 # Panel de administración de áreas
    ├── correos.html               # Configuración de correos y notificaciones
    ├── reportes.html              # Generador de reportes
    ├── calendario.html            # Calendario interactivo de vencimientos
    ├── notas.html                 # Generador de notas administrativas DOCX
    ├── perfil.html                # Perfil de usuario y cambio de contraseña
    ├── contacto.html              # Formulario de contacto público
    ├── css/
    │   └── styles.css
    ├── js/
    │   ├── config.js              # Configuración (API_URL)
    │   ├── main.js                # JavaScript compartido entre páginas
    │   ├── auth.js                # Manejo de autenticación
    │   ├── api.js                 # Llamadas a la API y utilidades
    │   ├── dashboard.js           # Lógica del tablero
    │   ├── datasets.js            # Listado de datasets
    │   ├── dataset-detail.js      # Detalle de dataset
    │   ├── admin.js               # Panel de administración
    │   ├── areas.js               # Gestión de áreas responsables
    │   ├── correos.js             # Configuración de correos
    │   ├── reportes.js            # Generación de reportes PDF
    │   ├── calendario.js          # Calendario interactivo de vencimientos
    │   ├── notas.js               # Generador de notas administrativas
    │   ├── perfil.js              # Perfil de usuario
    │   └── contacto.js            # Formulario de contacto
    └── img/
        ├── icon.png
        ├── logo-2025.png
        └── logo-2025-blanco.png
```

## Base de datos

### Crear la base de datos

1. En cPanel ir a **MySQL Databases**
2. Crear una nueva base de datos (ej: `usuario_rpad`)
3. Crear un usuario MySQL y asignarle todos los permisos sobre esa base

### Ejecutar el schema

Desde **phpMyAdmin** en cPanel:

1. Seleccionar la base de datos creada
2. Ir a la pestaña **Importar**
3. Subir el archivo `database/schema.sql`
4. Click en **Ejecutar**

### Estructura de tablas

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Administradores del sistema |
| `temas` | Catálogo de temas para clasificación |
| `frecuencias` | Catálogo de frecuencias de actualización |
| `formatos` | Catálogo de formatos de archivo (CSV, XLSX, etc.) con distinción de habituales |
| `areas` | Áreas responsables con contactos, emails y artículos gramaticales (el/la) |
| `datasets` | Registro principal de datasets (sin columnas de formato fijas) |
| `dataset_formatos` | Tabla intermedia para la relación muchos-a-muchos entre datasets y formatos |
| `cambios_pendientes` | Cola de cambios propuestos pendientes de aprobación (doble verificación) |
| `historial_actualizaciones` | Log de actualizaciones realizadas |
| `notificaciones_log` | Registro de notificaciones enviadas |

### Migración desde v1.4.0 a v1.5.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.4.0.

Si ya tenés la versión 1.4.0 instalada, importar el script ubicado en /database/updates/migracion-v1.4.0-v1.5.0.sql 

### Migración desde v1.3.0 a v1.4.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.3.0.

Si ya tenés la versión 1.3.0 instalada, importar el script ubicado en /database/updates/migracion-v1.3.0-v1.4.0.sql 

### Migración desde v1.2.0 a v1.3.0

⚠️ Requisito: Ejecutar esto si su sistema está en la versión 1.2.0.

Si ya tenés la versión 1.2.0 instalada, importar el script ubicado en /database/updates/migracion-v1.2.0-v1.3.0.sql 

### Migración desde v1.0.0 a v1.2.0

Si tenés la versión 1.0.0, ejecutar primero:

```sql
ALTER TABLE `datasets` 
ADD COLUMN `tipo_gestion` ENUM('interna', 'externa') NOT NULL DEFAULT 'externa'
AFTER `observaciones`;
```

Y luego ejecutar la migración de v1.2.0 a v1.3.0.

---

## Instalación en cPanel

### 1. Subir archivos

Subir la carpeta `rpad/` al directorio home:
```
/home/TU_USUARIO/rpad/
```

> ⚠️ **NO en public_html**. Debe estar en el directorio home del usuario.

### 2. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar:
```bash
cp .env.example .env
```

Editar `.env`:
```
# Base de datos
DB_HOST=localhost
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_password
DB_NAME=tu_base_de_datos

# Seguridad
JWT_SECRET=una_clave_secreta_larga
CRON_SECRET=clave_para_cron_job

# Servidor
PORT=3001
CORS_ORIGIN=https://tu-dominio.com

# SMTP (para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_cuenta@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
```

> **Nota sobre SMTP:** Si el hosting bloquea conexiones SMTP salientes (error ECONNREFUSED), usar Gmail con [contraseña de aplicación](https://myaccount.google.com/apppasswords).

### 3. Configurar Node.js App en cPanel

1. Ir a **Setup Node.js App**
2. Click en **Create Application**
3. Configurar:
   - **Node.js version**: 22.x (o la más reciente disponible)
   - **Application mode**: Production
   - **Application root**: `rpad`
   - **Application URL**: Seleccionar dominio/subdominio
   - **Application startup file**: `app.js`
4. Click **Create**

### 4. Instalar dependencias

Desde la terminal virtual de la app en cPanel:
```bash
npm install
```

### 5. Configurar variables de entorno en cPanel

En la sección **Environment variables** de la app, agregar cada variable del `.env`.

### 6. Crear usuario administrador

```bash
npm run setup-admin
```

### 7. Iniciar la aplicación

Click en **Restart** en el panel de Node.js App.

### 8. Verificar funcionamiento

```
https://tu-dominio.com/api/health
```

Respuesta esperada:
```json
{"status":"ok","timestamp":"...","service":"RPAD API"}
```

---

## Configurar Cron Job (Notificaciones automáticas)

### 1. Verificar que funciona manualmente

```
https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET
```

### 2. Configurar en cPanel → Cron Jobs

| Campo | Valor |
|-------|-------|
| Minuto | 0 |
| Hora | 8 |
| Día | * |
| Mes | * |
| Día semana | * |
| Comando | `curl -s "https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET" > /dev/null` |

Esto ejecuta todos los días a las 8:00 el aviso directo a las áreas (40 días antes) y las **Notas Digitales**:

- **Aviso**: gestión interna 60 días antes del vencimiento, gestión externa 30 días antes.
- **Reiteración**: primer día hábil de cada mes, para los datasets avisados hace 21 días o más que siguen pendientes.
- Solo en días hábiles. Cada nota se numera (`Nota Digital N° 12/26`), se envía con el PDF adjunto y queda en el libro de la pantalla de Correos.
- El envío automático arranca **desactivado**: se activa desde Correos cuando la configuración (destinatarios y firma) está completa.

---

## API Endpoints

### Públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/datasets` | Listar datasets (con filtros) |
| GET | `/api/datasets/estadisticas` | Estadísticas para tablero |
| GET | `/api/datasets/:id` | Detalle de un dataset |
| GET | `/api/catalogos/temas` | Listar temas |
| GET | `/api/catalogos/frecuencias` | Listar frecuencias |
| GET | `/api/catalogos/formatos` | Listar formatos disponibles |
| GET | `/api/areas` | Listar áreas activas |
| GET | `/api/areas/:id` | Detalle de un área |
| GET | `/api/andino/fetch?url=...` | Obtener metadatos desde el portal |
| POST | `/api/contacto` | Enviar formulario de contacto |

### Protegidos (requieren JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/auth/verify` | Verificar sesión activa |
| POST | `/api/auth/change-password` | Cambiar contraseña |
| POST | `/api/datasets` | Crear dataset (vía cambio pendiente) |
| PUT | `/api/datasets/:id` | Actualizar dataset (vía cambio pendiente) |
| DELETE | `/api/datasets/:id` | Eliminar dataset (vía cambio pendiente) |
| POST | `/api/datasets/:id/actualizar` | Registrar actualización |
| GET | `/api/cambios-pendientes` | Listar cambios pendientes de aprobación |
| GET | `/api/cambios-pendientes/:id` | Detalle de un cambio pendiente |
| POST | `/api/cambios-pendientes/:id/aprobar` | Aprobar un cambio pendiente |
| POST | `/api/cambios-pendientes/:id/rechazar` | Rechazar un cambio pendiente |
| POST | `/api/areas` | Crear área |
| PUT | `/api/areas/:id` | Actualizar área |
| DELETE | `/api/areas/:id` | Eliminar área |
| GET | `/api/notificaciones/ejecutar` | Ejecutar proceso de notificaciones |
| GET | `/api/notificaciones/prueba/:tipo` | Enviar email de prueba |
| GET | `/api/notificaciones/verificar-smtp` | Verificar conexión SMTP |
| GET | `/api/notificaciones/preview/:tipo` | Previsualizar email |
| GET | `/api/reportes/estado-general` | Descargar reporte PDF general |
| GET | `/api/reportes/historial-notificaciones` | Descargar historial de notificaciones |
| GET | `/api/reportes/por-area/:areaId` | Descargar reporte de un área |
| GET | `/api/reportes/cumplimiento` | Descargar reporte de cumplimiento |

### Cron (requiere secret)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cron/notificaciones?secret=...` | Ejecutar notificaciones (para cron) |

### Filtros disponibles en `/api/datasets`

- `?tema=ID` - Filtrar por tema
- `?frecuencia=ID` - Filtrar por frecuencia
- `?estado=actualizado|proximo|atrasado|sin-respuesta` - Filtrar por estado
- `?busqueda=texto` - Buscar en título y descripción
- `?area=ID` - Filtrar por área responsable

---

## Troubleshooting

### Error de conexión a MySQL
- Verificar credenciales en `.env`
- Verificar que el usuario MySQL tiene permisos sobre la base de datos

### Error 503 / App no inicia
- Revisar logs en cPanel → Setup Node.js App
- Verificar que `app.js` existe y está configurado como startup file

### Error SMTP ECONNREFUSED
- El hosting bloquea conexiones SMTP salientes
- Solución: Usar Gmail con contraseña de aplicación

### Token inválido o expirado
- Cerrar sesión y volver a iniciar

### Notificaciones no se envían
- Verificar conexión SMTP desde panel Admin
- Revisar que CRON_SECRET coincide en `.env` y cron job
- En Correos, revisar que el envío automático de Notas Digitales esté activado y que no haya alertas de configuración incompleta
- Revisar en el libro de Notas Digitales las notas "Fallida" (el detalle del error está en el estado) y reintentarlas
- En desarrollo, `EMAIL_SOLO_A` en `.env` limita los envíos a esas casillas

### PDFs con páginas en blanco
- Actualizar a v1.3.0 (corregido con `bufferPages: true`)

---

## Changelog

### v1.5.0 (2026-02-06)
- Sistema de doble verificación para cambios en datasets: un operador propone y otro aprueba o rechaza.
- Nueva tabla `cambios_pendientes` con estados pendiente/aprobado/rechazado y validación JSON.
- Nuevo controlador `cambiosPendientesController.js` con endpoints para listar, aprobar y rechazar cambios.
- Las operaciones de crear, editar y eliminar datasets ahora pasan por la cola de aprobación.
- Registro de revisor y comentario de rechazo en cada cambio.
- Artículos gramaticales en tabla `areas`: columnas `articulo` y `articulo_superior` (ENUM el/la) para correcta visualización de nombres.
- Formulario de contacto público (`contacto.html`) con `contactoController.js`.
- Página de configuración de correos separada (`correos.html`).
- Página de perfil de usuario (`perfil.html`) para cambio de contraseña y datos personales.
- JavaScript compartido entre páginas (`main.js`).
- Mejoras en el generador de notas DOCX.
- Archivo de referencia `htaccess-frontend.txt` para configuración Apache.

### v1.4.0 (2025-12-10)
- Migración del sistema de formatos a relación Many-to-Many (N:M).
- Soporte para múltiples formatos por dataset (sin límite).
- Sistema de "chips" en la interfaz de administración para selección rápida de formatos.
- Normalización automática de nombres de formatos al importar desde Andino.
- Eliminación de columnas `formato_primario` y `formato_secundario`.
- Generador de notas administrativas en formato DOCX para solicitud de actualización de datasets.
- Soporte para notas internas (a Subsecretaría) y externas (a organismos).
- Selección múltiple de datasets con períodos pendientes en el generador.
- Formato de notas según Resolución 2820/22.
- Sistema de roles de usuario: `admin` (acceso completo) y `lector` (solo lectura).
- Usuarios con rol `lector` pueden ver todas las secciones pero no crear, editar ni eliminar.
- Middleware `adminOnly` para proteger rutas de escritura en el backend.
- Ocultamiento automático de botones de acción en frontend según rol.
- Calendario interactivo de vencimientos con FullCalendar.js.
- Vista mensual con navegación y colores por estado (verde/amarillo/rojo).
- Modal con listado de datasets al hacer clic en un día.
- Filtros por área y tema en el calendario.
- Exportación a iCal (.ics) compatible con Google Calendar, Outlook y Apple Calendar.
- Script `setup-admin.js` actualizado para solicitar rol al crear usuarios.

### v1.3.0 (2025-12-07)
- Sistema de gestión de áreas con CRUD completo
- Tabla `areas` estructurada con contacto y emails múltiples
- Notificaciones diferenciadas para gestión interna vs externa
- Nuevo tipo de notificación `area-aviso-40` para avisar a las áreas
- Sistema de reportes PDF con 4 tipos de reporte
- Tarjetas visuales en reportes Por Área e Historial
- Calendario de vencimientos en dashboard (próximos 12 meses)
- Tabla `notificaciones_log` para registro de emails enviados
- Fix área en detalle dataset: muestra correctamente el nombre

### v1.2.0 (2025-12-05)
- Integración con API de Andino (portal de datos abiertos)
- Flujo de 2 pasos para crear datasets con importación automática
- Botón "Actualizar desde portal" en edición
- Sistema de notificaciones por email
- Alertas automáticas según tipo de gestión y días restantes
- Panel de notificaciones en administración
- Endpoint de cron para ejecución automática
- Plantillas HTML institucionales para emails

### v1.1.0 (2025-12-04)
- Tablero de seguimiento rediseñado con hero section y gráfico de dona
- Campo `tipo_gestion` para diferenciar datasets internos/externos
- Estados "Atrasado" y "Sin respuesta" según tipo de gestión
- Stat cards clickeables con animaciones

### v1.0.0 (2025-11-30)
- Versión inicial
- CRUD de datasets
- Dashboard con estadísticas
- Autenticación JWT
- Panel de administración

---

## Licencia

Uso interno - Municipalidad de Comodoro Rivadavia

## Contacto

**Dirección de Datos Públicos y Comunicación**  
Dirección General de Modernización e Investigación Territorial  
Municipalidad de Comodoro Rivadavia

📧 datospublicos@comodoro.gov.ar  
🌐 https://datos.comodoro.gov.ar
