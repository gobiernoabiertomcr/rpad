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
- **QR:** qrcode (código QR del anexo de las Notas Digitales, dibujado como vectores en el PDF)

## Roles de Usuario

El sistema cuenta con tres roles de usuario:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `superadmin` | Administrador con la cuenta protegida | Todo lo de `admin`. Su cuenta solo la modifica su titular. Recibe un email cuando otro admin crea un admin, cambia un rol, cambia el email de un admin, reactiva a un admin o desactiva a alguien. Se asigna por SQL, no desde la aplicación. |
| `admin` | Administrador completo | Proponer creación, edición y eliminación de datasets. Aprobar o rechazar cambios propuestos por otro admin. Gestionar áreas y usuarios. Configurar notificaciones SMTP. Generar reportes y notas. |
| `lector` | Solo lectura | Ver todas las secciones (tablero, calendario, datasets, reportes, notas) sin poder modificar datos. |

Los cambios sobre datasets requieren doble verificación: un admin (o el superadmin) propone y otro distinto aprueba o rechaza. Los usuarios con rol `lector` ven el mensaje "Solo lectura" en lugar de los botones de acción.

### Panel de usuarios

En **Administración → Usuarios**, admin y superadmin pueden:

- **Crear usuarios.** El usuario nuevo recibe un email con un link para elegir su contraseña (vence en 72 h). Nadie ve ni envía contraseñas.
- **Editar** nombre, usuario, email, cargo, vínculo (planta permanente, planta política o contrato) y rol (admin o lector).
- **Desactivar y reactivar.** Desactivar cierra las sesiones de esa persona en el acto. Los usuarios nunca se borran.
- **Enviar un link para restablecer la contraseña** (vence en 2 h), o reenviar la invitación. Cambiar el email de un usuario o desactivarlo anula sus links pendientes: hay que reenviarle el link.
- **Ver el historial** de cambios de cada usuario.

Siempre tiene que haber al menos **2 usuarios que puedan aprobar cambios**: el panel no deja desactivar ni pasar a lector a un admin si quedarían menos. Cualquier usuario puede pedir un link nuevo desde **"¿Olvidaste tu contraseña?"** en la pantalla de ingreso.

El superadmin recibe un aviso por email cuando otro admin crea un administrador, cambia un rol, cambia el email de un administrador, reactiva a un administrador o desactiva a alguien.

## Campo "Qué se solicita" de los datasets

Cada dataset tiene un campo opcional **"Qué se solicita"**: qué información concreta tiene que enviar el área responsable para actualizarlo (registros, campos, cobertura y formato). Es un texto que vale para cualquier ciclo de actualización, sin fechas puntuales.

- **Dónde se edita:** en el formulario del dataset del panel de administración (`admin.html`).
- **Doble verificación:** es un dato del dataset como los demás. Quien lo edita lo propone y otro admin lo aprueba o rechaza; al revisar el cambio se ve el texto anterior y el nuevo. Un campo vacío queda sin texto (`NULL`).
- **Dónde se muestra:** en la página pública del dataset (`dataset.html`), en el recuadro "Qué se solicita" (si el dataset no tiene texto, no se muestra), y en el **anexo** que acompaña a los avisos de las Notas Digitales. Si un dataset no lo tiene cargado, el anexo usa un texto genérico.
- **Carga inicial:** la migración `database/updates/migracion-que-se-solicita-datos.sql` carga el texto de los 80 datasets activos (ver [Segunda entrega de Notas Digitales](#segunda-entrega-de-notas-digitales)). Se corre una sola vez, en ese despliegue: después, cada texto se cambia solo con doble verificación.

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
│   ├── notificacionesController.js  # Cron diario: aviso a áreas y Notas Digitales
│   ├── notasDigitalesController.js  # API de Notas Digitales (libro, prueba, configuración)
│   ├── notasController.js         # Generador de notas DOCX
│   └── reportesController.js      # Generación de reportes PDF
├── services/
│   ├── emailService.js            # Configuración SMTP y envío
│   ├── emailTemplates.js          # Plantillas HTML para emails
│   └── notasDigitales*.js         # Notas Digitales: motor, calendario, consultas, contenido, PDF y anexo
├── database/
│   ├── schema.sql                 # Estructura y datos iniciales de la BD
│   └── updates/                   # Scripts de migración
│       ├── migracion-v1.2.0-v1.3.0.sql
│       ├── migracion-v1.3.0-v1.4.0.sql
│       ├── migracion-v1.4.0-v1.5.0.sql
│       ├── migracion-notas-digitales.sql
│       ├── migracion-notas-digitales-anexo.sql   # Segunda entrega: columna anexo_pdf
│       ├── migracion-que-se-solicita.sql         # Segunda entrega: columna que_se_solicita
│       └── migracion-que-se-solicita-datos.sql   # Segunda entrega: carga inicial de los textos
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
| `datasets` | Registro principal de datasets (sin columnas de formato fijas), con el texto opcional "Qué se solicita" (`que_se_solicita`) |
| `dataset_formatos` | Tabla intermedia para la relación muchos-a-muchos entre datasets y formatos |
| `cambios_pendientes` | Cola de cambios propuestos pendientes de aprobación (doble verificación) |
| `historial_actualizaciones` | Log de actualizaciones realizadas |
| `notificaciones_log` | Registro de notificaciones enviadas |

### Migración: Usuarios (superadmin y panel de usuarios)

⚠️ Requisito: las migraciones anteriores aplicadas. No hay dependencias nuevas de npm.

Secuencia de despliegue, **en este orden** (todo desde cPanel):

1. **Backup de la base:** phpMyAdmin → base del RPAD → **Exportar** → método **Personalizado**, formato SQL → en "Opciones de creación de objetos" tildar **Agregar sentencia DROP TABLE / VIEW / PROCEDURE / FUNCTION / EVENT / TRIGGER** → **Continuar**. Guardar el archivo. Sin esa opción, el backup no se puede restaurar con Importar sobre la base existente (falla con "Table already exists").
2. **Backup de los archivos:** Administrador de archivos → carpeta de la app → seleccionar `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` → **Comprimir** → descargar el zip.
3. **Migración de estructura:** phpMyAdmin → base del RPAD → pestaña **SQL** → pegar el contenido de `database/updates/migracion-usuarios-superadmin.sql` → **Continuar**. Agrega columnas y tablas y amplía dos columnas existentes (`password_hash` admite vacío y `rol` admite `superadmin`); no borra ni cambia datos, y el código actual sigue funcionando con la estructura nueva: si los pasos siguientes se demoran, no pasa nada. Si se corta a mitad, se puede volver a correr: lo que ya existe se saltea.
4. **Subir los archivos** con el Administrador de archivos. Cambian 32 archivos, todos dentro de `controllers`, `middleware`, `routes`, `services`, `scripts` y `public` (`app.js`, `config/` y `package.json` no cambian):
   - En la PC, armar un zip **con esos archivos y sus carpetas** (por ejemplo, desde el repo: `git archive --format=zip -o rpad-usuarios.zip main -- $(git diff --name-only <commit-anterior>..main -- controllers middleware routes services scripts public)`). No usar el "Download ZIP" de GitHub tal cual: crea una carpeta de más (`rpad-main/`) y no reemplaza nada.
   - Administrador de archivos → carpeta de la app → **Cargar** el zip → seleccionarlo → **Extraer** en la misma carpeta de la app. Reemplaza los archivos que cambian y agrega los nuevos; no borra nada.
   - Revisar que existan los archivos nuevos: `controllers/usuariosController.js`, `services/accesoService.js`, `services/usuariosReglas.js`, `services/usuariosAuditoriaService.js`, `public/usuarios.html`, `public/establecer-contrasena.html`, `public/js/usuarios.js` y `public/js/establecer-contrasena.js`. Si falta cualquiera de `services/`, la app no arranca. Hacer los pasos 4 y 5 **seguidos**, sin dejar pasar tiempo entre subir los archivos y el Restart: las pantallas nuevas se sirven apenas se suben, y hasta el Restart la app sigue corriendo con el código anterior.
5. **Setup Node.js App** → la app del RPAD → **Environment variables** → agregar `APP_URL` = `https://rpad.mcrmodernizacion.gob.ar` → **Save** (es opcional: si no se agrega, la app usa ese mismo valor). Después, **Restart** (sin demorarse después del paso 4). No hace falta "Run NPM Install": no hay dependencias nuevas.
6. **Datos de usuarios:** phpMyAdmin → pestaña **SQL** → pegar el contenido de `database/privado/usuarios-superadmin-datos.sql`. Ese archivo no está en el repositorio: lo tiene el Director de Datos Públicos y Comunicación. Tiene que ir **después** del Restart: el código anterior no conoce el rol superadmin. El `SELECT` final muestra los usuarios con su rol, cargo y vínculo para revisar.
7. **Verificar:**
   - el superadmin ve "Superadmin" en el header;
   - Administración → Usuarios muestra a todos con su cargo;
   - "Nuevo usuario" con rol **Lector** y una casilla de prueba propia: la invitación llega y el link funciona;
   - desactivar ese usuario de prueba;
   - lo existente sigue igual: ingresar con un admin y con un lector, abrir el Tablero y Gestión de Datasets, ver que los cambios pendientes cargan (Mi Perfil → Para Revisar) y que Correos → Estado no muestra alertas nuevas.

**Si algo sale mal:** subir de nuevo los archivos del backup del paso 2 → Restart → phpMyAdmin → pestaña SQL → pegar `database/updates/rollback-usuarios-superadmin.sql`.

- El rollback deja la estructura exactamente como estaba; se pierden los cargos, vínculos e historial de usuarios. El superadmin queda como admin, y los usuarios con la invitación pendiente (todavía sin contraseña) quedan desactivados.
- Los archivos nuevos (`usuarios.html`, `establecer-contrasena.html`, `js/usuarios.js`, `js/establecer-contrasena.js`, `services/accesoService.js`, `services/usuariosReglas.js`, `services/usuariosAuditoriaService.js`, `controllers/usuariosController.js`) se pueden borrar después con el Administrador de archivos; si quedan, no molestan.
- Si el rollback SQL falla, la alternativa es restaurar el backup del paso 1: phpMyAdmin → **Importar**. Se pierde lo cargado en el sistema desde que se hizo ese backup.

### Migración: Notas Digitales

⚠️ Requisito: la base tiene que tener aplicadas las migraciones anteriores. La migración crea las tablas `notas_digitales` (libro), `notas_digitales_datasets` y `notas_digitales_config` (destinatarios iniciales, texto del pie del membrete del PDF, envío automático **desactivado** y registro de la última corrida diaria).

Secuencia de despliegue, en este orden:

1. **Backup de la base de producción**, por ejemplo:
   ```bash
   mysqldump -u USUARIO -p NOMBRE_BASE > backup-antes-de-notas-digitales.sql
   ```
2. **Ejecutar la migración antes de subir el código.** El script no tiene `USE`: hay que indicar la base en el comando.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-notas-digitales.sql
   ```
   La migración no se puede correr dos veces. Solo crea tablas nuevas y no modifica las existentes. Si falla a mitad de camino, borrar las que se hayan creado y volver a correrla. No restaurar el backup por esto: se perdería lo que se cargó en el sistema desde que se hizo.
   ```sql
   DROP TABLE IF EXISTS notas_digitales_datasets, notas_digitales_config, notas_digitales;
   ```
3. **Subir el código**, correr `npm install` y reiniciar la app (**Restart** en Setup Node.js App).
4. **Verificar SMTP** en Correos → Estado ("Verificar conexión SMTP"). Si la conexión es rechazada, habilitar la salida SMTP de la cuenta en WHM ("SMTP Restrictions").
5. En Correos → Configuración, **cargar la firma** (nombre, cargo e imagen), el **membrete del PDF** (la imagen del banner y, si cambió, el texto del pie; la migración deja cargado `www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.`) y las **casillas de prueba**. El banner no está en el repositorio: se sube desde esa pantalla. Revisar el PDF con "Ver PDF" en Correos → Vista previa y prueba. Después, **enviar una prueba de cada variante** (aviso y reiteración, de gestión interna y externa) y revisar las cuatro en las casillas de prueba, con su PDF.
6. **Recién entonces, activar el envío automático** en Correos → Estado. Las notas las dispara el mismo cron diario de `/api/cron/notificaciones` (ver [Configurar Cron Job](#configurar-cron-job-notificaciones-automáticas)).
7. **El primer día hábil siguiente**, revisar Correos → Estado: la línea "Última corrida diaria" tiene que mostrar la corrida de las 08:00 sin errores y no tiene que haber alertas. Revisar también el libro de Notas Digitales.

Los siete emails de aviso anteriores (interno y externo) dejan de salir apenas se sube el código; las Notas Digitales empiezan cuando se activa el envío automático.

#### Segunda entrega de Notas Digitales

⚠️ Requisito: la primera entrega (la secuencia anterior) ya tiene que estar aplicada.

Qué cambia en esta entrega:

- **El aviso informa solo datasets a vencer** (todavía no vencidos). Un dataset vencido que nunca tuvo aviso ya no va en el aviso: entra en la **reiteración** mensual, con "Sin aviso previo" en la columna "Informado en".
- **Cada aviso viaja con un segundo PDF, el anexo**: una hoja A4 por dataset, con la descripción, la ficha (con código QR al portal), "Qué se solicita", las observaciones y el contacto del área. Se genera junto con la nota y se guarda en el libro. Las reiteraciones no llevan anexo.
- **Campo nuevo "Qué se solicita"** en los datasets (ver [Campo "Qué se solicita"](#campo-qué-se-solicita-de-los-datasets)), con doble verificación; se muestra en la página pública del dataset y en el anexo.
- **Correos**: botón "Ver anexo" en Vista previa y prueba (solo para avisos) y botón "Anexo" en cada aviso del libro.
- **Textos**: se quitaron las menciones a WhatsApp y las notas dicen "En tal sentido, solicito…".
- **Revisión de cambios**: el campo "Observaciones" muestra el valor anterior y el nuevo.

Secuencia de despliegue, en este orden:

1. **Backup de la base de producción**, por ejemplo:
   ```bash
   mysqldump -u USUARIO -p NOMBRE_BASE > backup-antes-del-anexo-de-avisos.sql
   ```
2. **Columna del anexo.** Los scripts no tienen `USE`: hay que indicar la base en el comando.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-notas-digitales-anexo.sql
   ```
3. **Columna "Qué se solicita".**
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-que-se-solicita.sql
   ```
4. **Carga inicial de "Qué se solicita".** Va después del paso 3, porque necesita la columna.
   ```bash
   mysql -u USUARIO -p NOMBRE_BASE < database/updates/migracion-que-se-solicita-datos.sql
   ```
   Solo completa los datasets que todavía no tienen texto (`que_se_solicita IS NULL`): no pisa un texto ya cargado o aprobado desde RPAD, así que se puede correr también si alguien ya editó alguno.
   ⚠️ **Se corre una sola vez, durante este despliegue.** No volver a correrla meses después: un texto que un admin vació con un cambio aprobado también queda en `NULL`, y la carga lo volvería a llenar sin doble verificación.
5. **Subir el código.**
6. En **Setup Node.js App**, **Run NPM Install**: hay una dependencia nueva, `qrcode` (el código QR del anexo).
7. **Antes del Restart, verificar que exista la carpeta `node_modules/qrcode`** (en el Administrador de archivos de cPanel, dentro de la carpeta de la app). Si no está, volver a correr Run NPM Install. Sin ella la app arranca igual, pero cada aviso falla con el error "No se pudo cargar la librería qrcode" (queda en Correos → Estado, con su alerta) y no sale.
8. **Restart** de la app.
9. En **Correos → Vista previa y prueba**, revisar con "Ver PDF" y "Ver anexo" que se vean bien, y **enviar una prueba de un aviso** a las casillas de prueba: tiene que llegar con **2 adjuntos** (`Nota-Digital-PRUEBA.pdf` y `Anexo-Nota-Digital-PRUEBA.pdf`).

Por qué importa el orden: **las tres migraciones se corren antes de reiniciar con el código nuevo**.

- Sin la columna `anexo_pdf` (paso 2), falla generar y enviar las notas.
- Sin la columna `que_se_solicita` (paso 3), falla aprobar cambios sobre los datasets.
- Si la carga inicial (paso 4) se corre después de que alguien aprobó una edición de "Qué se solicita", no la pisa. Es lo esperado.

En lugar del comando `mysql`, cada script se puede aplicar desde **phpMyAdmin → Importar**, con la base seleccionada y el archivo en UTF-8, en el mismo orden. Los pasos 2 y 3 agregan una columna: si se corren dos veces, la segunda falla con "Duplicate column name" y no cambia nada. El paso 4 se puede repetir sin problema dentro de este mismo despliegue (por ejemplo, si se cortó a mitad); después ya no se vuelve a correr.

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

- **Aviso**: gestión interna 60 días antes del vencimiento y gestión externa 30 días antes, junto con los demás datasets de esa gestión que vencen el mismo mes. Informa **solo datasets a vencer** (todavía no vencidos) y se envía con dos PDF: la nota y el **anexo** (una hoja A4 por dataset).
- **Reiteración**: primer día hábil de cada mes, para los datasets avisados hace 20 días o más que siguen pendientes y para los vencidos que nunca tuvieron aviso (con "Sin aviso previo"). Lleva solo el PDF de la nota, sin anexo.
- Solo en días hábiles. Cada nota se numera (`Nota Digital N° 12/26`), se envía con su PDF adjunto (el aviso, también con el anexo) y queda en el libro de la pantalla de Correos, donde se descargan ambos PDF (botones "PDF" y "Anexo").
- La salida del cron se descarta (`> /dev/null`): el resultado de cada corrida queda en Correos → Estado ("Última corrida diaria"), con una alerta si terminó con errores, si se interrumpió o si el cron dejó de llamar.
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
- En Correos → Estado, revisar la línea "Última corrida diaria" y sus alertas (corrida con errores, interrumpida o que no llegó)
- Revisar en el libro de Notas Digitales las notas "Fallida" (el último error se ve con el botón "Ver") y reintentarlas
- En desarrollo, `EMAIL_SOLO_A` en `.env` limita los envíos a esas casillas

### PDFs con páginas en blanco
- Actualizar a v1.3.0 (corregido con `bufferPages: true`)

---

## Changelog

### Usuarios y superadmin (2026-10)
- Rol `superadmin`, con la cuenta protegida y avisos por email de cambios hechos por otros admins
- Panel de usuarios: alta, edición, cargo y vínculo, roles, activación, links de acceso e historial
- Contraseñas por link de un solo uso (invitación y recuperación) y "¿Olvidaste tu contraseña?"
- Desactivar a alguien o cambiarle el rol tiene efecto inmediato
- Mínimo de 2 aprobadores activos para la doble verificación

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
