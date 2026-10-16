# Usuarios: rol superadmin y panel de usuarios

**Fecha:** 2026-10-15
**Estado:** diseño aprobado, pendiente de revisión de esta especificación

## 1. Objetivo

Hoy los usuarios del RPAD solo se crean con el script `npm run setup-admin`. No hay forma de editarlos, desactivarlos ni recuperar una contraseña desde la aplicación, y el rol y el estado de un usuario viajan dentro del token durante 7 horas.

Esta entrega agrega:
- un rol **superadmin**, para la cuenta del Director de Datos Públicos y Comunicación, que va a ser la base de funciones exclusivas en etapas siguientes;
- un **panel de usuarios** para administradores y superadmin: altas, edición, roles, activación y acceso, con historial de cambios;
- **contraseñas por link** de un solo uso (invitación y recuperación), sin que ninguna clave viaje por email ni la vea un administrador;
- **revocación inmediata**: desactivar a alguien o cambiarle el rol tiene efecto en el pedido siguiente.

## 2. Alcance

**Etapa 1 (esta especificación):** rol superadmin, panel de usuarios, links de contraseña, revocación inmediata, cargo y vínculo de cada usuario, auditoría y avisos por email al superadmin.

**Etapa 2 (otra especificación):** licencias de los administradores, cargadas por el superadmin, para que no reciban el aviso de cambios pendientes mientras están de licencia. Esta etapa no construye nada de licencias; el diseño solo deja el lugar donde se van a ver (sección 12.2).

**No cambian:** la doble verificación de datasets, las Notas Digitales, el aviso a áreas y el resto de los permisos de lectores.

## 3. Conceptos

| Término | Significado |
|---|---|
| **Rol** | `superadmin`, `admin` o `lector`. Es el campo `usuarios.rol`. |
| **Aprobador** | Usuario con rol `superadmin` o `admin`. Puede proponer y aprobar cambios de datasets (nunca los propios). |
| **Aprobador activo** | Aprobador con `activo = TRUE` y contraseña definida (`password_hash` no nulo). Es quien efectivamente puede aprobar hoy. |
| **Cargo** | Texto libre con el lugar que ocupa en el organigrama de la DGMIT, por ejemplo "Directora Administrativa". |
| **Vínculo** | `planta_permanente`, `planta_politica` o `contrato`, con los mismos términos del organigrama. Quien tiene contrato ocupa un lugar en el organigrama pero no está formalmente designado. |
| **Estado del usuario** | Derivado, no se guarda: **desactivado** (`activo = FALSE`), **invitación pendiente** (`activo = TRUE` y `password_hash` nulo) o **activo**. |
| **Link de acceso** | Link de un solo uso para elegir contraseña. Es de **invitación** (alta) o de **recuperación** (reset u "olvidé mi contraseña"). |

## 4. Roles y permisos

| Acción | superadmin | admin | lector |
|---|---|---|---|
| Todo lo que hoy hace un admin (datasets, áreas, correos, reportes, gestión) | Sí | Sí | No |
| Doble verificación: proponer y aprobar cambios de otros | Sí | Sí | No |
| Aprobar sus propios cambios | **No** | No | No |
| Recibir el email de cambios pendientes de las 13:00 | Sí | Sí | No |
| Ver el panel de usuarios | Sí | Sí | No |
| Crear usuarios admin o lector, editar, cambiar rol admin ↔ lector, desactivar, reactivar, enviar link de acceso | Sí | Sí | No |
| Modificar la cuenta del superadmin | Solo su titular, y solo sus datos (sección 8.2) | No | No |
| Asignar el rol superadmin | Nadie desde la aplicación (sección 6.3) | No | No |

En esta etapa el superadmin y los admins tienen los mismos poderes sobre los usuarios. La diferencia es que la cuenta del superadmin está protegida y que el superadmin recibe un aviso cuando otro admin hace cambios sensibles (sección 10.3).

## 5. Autorización y sesiones

### 5.1 Rol tomado de la base

`authMiddleware` sigue verificando el JWT y además lee, en cada pedido autenticado, `rol`, `activo` y `sesion_version` del usuario (una consulta por clave primaria). Responde **401** si:
- el usuario no existe o tiene `activo = FALSE`;
- la versión del token (`v` en el payload) no coincide con `sesion_version`. Un token sin `v` (emitido antes del despliegue) cuenta como versión 0.

`req.user.rol` pasa a ser **el rol de la base**, no el del token. Así, un cambio de rol aplica en el pedido siguiente.

### 5.2 Cierre de sesiones

`usuarios.sesion_version` se incrementa cuando:
- se desactiva al usuario;
- se establece una contraseña con un link de acceso;
- el propio usuario cambia su contraseña desde Mi Perfil. En ese caso la respuesta trae un token nuevo para que la sesión actual siga abierta y solo se cierren las demás.

El cambio de rol no incrementa la versión, porque el rol ya se lee de la base en cada pedido.

### 5.3 Rol de administración en código

- Backend: un helper `esAdmin(rol)` (verdadero para `admin` y `superadmin`) usado por `adminOnly` y por la consulta de destinatarios del email de cambios pendientes, que pasa a ser `rol IN ('admin','superadmin')`.
- Frontend: `Auth.isAdmin()` incluye al superadmin y se agrega `Auth.isSuperadmin()`. El header muestra **Superadmin**, **Administrador** o **Lector**.
- Al cargar cada página, si hay una sesión guardada, `main.js` llama a `GET /auth/verify`. Si responde 401, cierra la sesión (y en una página protegida redirige al login); si responde bien, actualiza el usuario guardado en el navegador (rol, nombre, cargo). Con eso el superadmin ve su rol nuevo sin volver a iniciar sesión y una cuenta desactivada se cierra sola.

### 5.4 Login

- Busca el usuario activo por nombre de usuario, como hoy.
- Si el usuario no existe **o no tiene contraseña definida**, igual ejecuta una comparación bcrypt contra un hash fijo y responde el mismo "Credenciales inválidas". Así el tiempo de respuesta no revela si el usuario existe.
- Si las credenciales son válidas, actualiza `ultimo_ingreso` y emite el token con `v = sesion_version`.

## 6. Datos

### 6.1 Cambios en `usuarios`

| Columna | Cambio |
|---|---|
| `rol` | `ENUM('superadmin','admin','lector') NOT NULL DEFAULT 'lector'` |
| `password_hash` | Pasa a admitir `NULL` (invitación pendiente). |
| `cargo` | Nueva: `VARCHAR(200) NULL`. |
| `vinculo` | Nueva: `ENUM('planta_permanente','planta_politica','contrato') NULL`. |
| `ultimo_ingreso` | Nueva: `TIMESTAMP NULL`. |
| `sesion_version` | Nueva: `INT NOT NULL DEFAULT 0`. |

`email` no cambia de definición (`VARCHAR(100) NOT NULL UNIQUE`). La aplicación exige un email válido al crear o editar (sección 8.3); un usuario existente con email vacío sigue funcionando y el panel lo marca como **Sin email**.

### 6.2 Tablas nuevas

**`usuarios_tokens`** (links de acceso):

| Columna | Tipo |
|---|---|
| `id` | `INT AUTO_INCREMENT` PK |
| `usuario_id` | `INT NOT NULL`, FK a `usuarios` |
| `tipo` | `ENUM('invitacion','recuperacion') NOT NULL` |
| `token_hash` | `CHAR(64) NOT NULL UNIQUE` (SHA-256 en hexadecimal) |
| `expira_at` | `DATETIME NOT NULL` |
| `usado_at` | `DATETIME NULL` |
| `anulado_at` | `DATETIME NULL` |
| `creado_por` | `INT NULL`, FK a `usuarios` con `ON DELETE SET NULL` (NULL si lo pidió el propio usuario desde el login) |
| `created_at` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |

Índice por `(usuario_id, tipo)`.

**`usuarios_auditoria`** (historial):

| Columna | Tipo |
|---|---|
| `id` | `INT AUTO_INCREMENT` PK |
| `usuario_id` | `INT NOT NULL`, FK a `usuarios` (usuario afectado) |
| `actor_id` | `INT NULL`, FK a `usuarios` con `ON DELETE SET NULL` (quién hizo el cambio; NULL si fue un pedido anónimo desde el login) |
| `accion` | `ENUM('alta','edicion','cambio_rol','desactivacion','reactivacion','invitacion_enviada','recuperacion_enviada','contrasena_establecida','contrasena_cambiada','perfil_editado') NOT NULL` |
| `detalle` | `LONGTEXT NULL` con `CHECK (json_valid(detalle))` |
| `created_at` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |

Índice por `(usuario_id, created_at)`.

Ninguna FK hacia `usuarios` usa `CASCADE`: los usuarios no se borran, se desactivan.

### 6.3 Migraciones

1. **`database/updates/migracion-usuarios-superadmin.sql`** (versionada): solo estructura, es decir, los cambios de 6.1 y las tablas de 6.2. `database/schema.sql` se actualiza en paralelo para que `tests/schema.test.js` siga comparando bien.
2. **Carga de datos, no versionada.** El repositorio es público, así que la asignación del rol superadmin y la carga inicial de cargo y vínculo de los usuarios existentes (según el organigrama de la DGMIT) van en un SQL dentro de `database/privado/`, una carpeta nueva que se agrega a `.gitignore`. Se corre una sola vez en producción, después de la migración. Ningún endpoint asigna el rol superadmin; para crearlo en una instalación nueva se usa `npm run setup-admin` (sección 11.4).

## 7. Links de acceso

### 7.1 Generación

- El token son 32 bytes aleatorios (`crypto.randomBytes`) en base64url. En la base solo se guarda su SHA-256.
- Vencimiento: **72 horas** para una invitación y **2 horas** para una recuperación.
- Generar un link nuevo para un usuario **anula** (`anulado_at`) los links anteriores sin usar de ese usuario.
- El link va en el **fragmento** de la URL: `{APP_URL}/establecer-contrasena.html#token=…`. El fragmento no se envía al servidor, así que el token no queda en los logs de acceso ni del proxy. La página lo lee con JavaScript, lo saca de la barra de direcciones (`history.replaceState`) y lo manda en el body de un POST.
- `APP_URL` es una variable de entorno nueva. Por defecto vale `https://rpad.mcrmodernizacion.gob.ar`, la URL que hoy está fija en `services/emailTemplates.js`, que pasa a leerla de ahí.

### 7.2 Cuándo se genera

| Situación | Tipo | Quién |
|---|---|---|
| Alta de un usuario en el panel | invitación | el admin que lo crea |
| "Enviar link de acceso" en el panel, usuario con invitación pendiente | invitación | el admin |
| "Enviar link de acceso" en el panel, usuario activo | recuperación | el admin |
| "¿Olvidaste tu contraseña?", usuario con invitación pendiente | invitación | nadie (pedido anónimo) |
| "¿Olvidaste tu contraseña?", usuario activo | recuperación | nadie (pedido anónimo) |

No se generan links para usuarios desactivados ni para usuarios sin un email válido. Mientras no se use el link de recuperación, la contraseña actual sigue funcionando.

### 7.3 "¿Olvidaste tu contraseña?"

- `POST /api/auth/recuperar` recibe `{ identificador }`, que puede ser el usuario o el email.
- **Siempre** responde 200 con el mismo mensaje, exista o no la cuenta: "Si los datos corresponden a una cuenta activa, te enviamos un email con un link. Revisá también la carpeta de spam."
- Tiene límite de pedidos (con `express-rate-limit`, como el login, pero contando todos los pedidos): **5 por hora por IP** y **3 por hora por identificador**.

### 7.4 Establecer la contraseña

- `POST /api/auth/link/validar` recibe `{ token }` y responde `{ valido, tipo, nombre_completo, username }`, o `{ valido: false, motivo }` con `motivo` igual a `vencido`, `usado` o `invalido`.
- `POST /api/auth/establecer-contrasena` recibe `{ token, password }`. En una transacción, con el token bloqueado (`FOR UPDATE`), verifica que exista, no esté usado ni anulado, no esté vencido y que el usuario esté activo. Después:
  - guarda el hash bcrypt de la contraseña nueva;
  - marca el token como usado y anula los demás tokens pendientes del usuario;
  - incrementa `sesion_version`;
  - registra `contrasena_establecida` en la auditoría, con el propio usuario como actor.
- Contraseña: **mínimo 8 caracteres y máximo 72 bytes** (el límite de bcrypt; hoy no se controla).
- Los dos endpoints comparten un límite de **20 pedidos cada 15 minutos por IP**.
- Al terminar no se inicia sesión: la página redirige al login con el mensaje "Tu contraseña quedó guardada. Ya podés ingresar."

## 8. Reglas del panel

Todas se controlan en el backend; la pantalla solo las refleja.

### 8.1 Mínimo de aprobadores

No se puede **desactivar** ni **pasar a lector** a un aprobador si después de la operación quedarían **menos de 2 aprobadores activos**: con uno solo, la doble verificación se traba y nada se puede aprobar.

La verificación se hace dentro de la transacción de la operación, bloqueando (`SELECT … FOR UPDATE`) las filas de los aprobadores activos antes de contar. Así, dos admins que intentan degradarse mutuamente al mismo tiempo no pueden dejar el sistema con un solo aprobador. Si la regla se viola, la respuesta es **409** con el mensaje "No se puede: quedarían menos de 2 usuarios que puedan aprobar cambios."

### 8.2 Cuenta del superadmin

- Ningún admin puede editar, cambiar de rol, desactivar ni enviar links de acceso a una cuenta superadmin (**403**: "Esta cuenta solo la modifica su titular.").
- El propio superadmin puede editar en el panel sus datos (nombre, email, cargo, vínculo), pero no su rol ni su estado.
- Pedir `rol = 'superadmin'` en un alta o una edición devuelve **400**.

### 8.3 Validaciones

| Campo | Regla |
|---|---|
| Nombre completo | Obligatorio, hasta 100 caracteres, sin espacios al principio ni al final. |
| Usuario | Obligatorio, de 3 a 50 caracteres entre `A-Z`, `0-9`, `.`, `_` y `-`. Se guarda en mayúsculas y debe ser único. |
| Email | Obligatorio, con formato válido, hasta 100 caracteres. Se guarda en minúsculas y debe ser único. |
| Cargo | Opcional, hasta 200 caracteres. |
| Vínculo | Opcional; si viene, tiene que ser uno de los tres valores. |
| Rol | `admin` o `lector`. |

Un dato inválido devuelve **400** con el campo y el motivo. Un usuario o email repetido devuelve **409**.

### 8.4 Sugerencia de usuario

Al escribir el nombre completo, la pantalla propone un usuario con el patrón existente: la inicial de cada palabra salvo la última, más la última palabra completa, en mayúsculas y sin tildes ni espacios. Se ignoran las partículas `de`, `del`, `la`, `las`, `los` y `y`. Por ejemplo, "Laura Inés Fernández" da `LIFERNANDEZ` y "María de los Ángeles Ruiz" da `MARUIZ`. Si el usuario ya existe en la lista cargada, se le agrega un número (`LIFERNANDEZ2`). El admin puede cambiar la sugerencia. Es una función pura en `Utils` (`public/js/api.js`).

### 8.5 Modificarse a uno mismo

Un admin puede cambiar su propio rol o desactivarse, siempre que se respete el mínimo de aprobadores. Antes de hacerlo, la pantalla pide confirmación: "Vas a perder el acceso de administrador en este momento." Después, el pedido siguiente responde 401 o 403 y la sesión se cierra o se recarga como lector.

### 8.6 Desactivar y reactivar

- **Desactivar:** `activo = FALSE`, incrementa `sesion_version` y anula los links pendientes. Si el usuario tiene cambios de datasets que propuso y siguen pendientes, el panel lo advierte antes de confirmar ("Tiene N cambios pendientes que otros admins todavía pueden aprobar o rechazar"); la desactivación no los toca.
- **Reactivar:** `activo = TRUE`. Si el usuario nunca definió su contraseña, vuelve a quedar con la invitación pendiente y el panel ofrece reenviarla.

## 9. Auditoría

Cada operación escribe una fila en `usuarios_auditoria`, en la misma transacción que el cambio cuando lo hay.

| Acción | Cuándo | `detalle` |
|---|---|---|
| `alta` | Alta en el panel | Datos iniciales (sin contraseña) |
| `edicion` | Cambio de nombre, usuario, email, cargo o vínculo en el panel | `{ campos: { email: { antes, despues }, … } }` |
| `cambio_rol` | Cambio de rol | `{ antes, despues }` |
| `desactivacion` / `reactivacion` | Panel | `{ cambios_pendientes: N }` (solo al desactivar) |
| `invitacion_enviada` / `recuperacion_enviada` | Panel o "olvidé mi contraseña" | `{ origen: 'panel' \| 'login', email_enviado, error? }` |
| `contrasena_establecida` | Link de acceso usado | — |
| `contrasena_cambiada` | Mi Perfil | — |
| `perfil_editado` | Mi Perfil (nombre o email) | `{ campos: … }` |

La pestaña **Historial** del panel muestra estas filas del usuario, de la más reciente a la más vieja, con quién, cuándo y qué. Un pedido anónimo desde el login aparece como "Pedido desde la pantalla de ingreso".

## 10. Emails

Los tres usan `sendEmail` y respetan la barrera `EMAIL_SOLO_A`. Las plantillas van en `services/emailTemplates.js` con el estilo de las existentes.

### 10.1 Invitación

- **Asunto:** "Tu acceso al RPAD"
- **Contenido:** saludo con el nombre, usuario asignado, rol ("Administrador" o "Lector"), botón "Elegir mi contraseña", vencimiento con fecha y hora, y qué hacer si vence (pedir un link nuevo desde "¿Olvidaste tu contraseña?" o a un administrador).

### 10.2 Recuperación

- **Asunto:** "Restablecé tu contraseña del RPAD"
- **Contenido:** botón "Elegir una contraseña nueva", vencimiento, y "Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando".

### 10.3 Aviso al superadmin

- **Cuándo:** un usuario que **no** es superadmin crea un usuario con rol admin, cambia un rol (en cualquier sentido) o desactiva a alguien.
- **A quién:** todos los superadmin activos con email válido.
- **Asunto:** "RPAD: cambio en los usuarios"
- **Contenido:** quién hizo el cambio, a quién afectó, qué cambió (por ejemplo "Lector → Administrador") y cuándo, más un botón al panel de usuarios.

### 10.4 Si el envío falla

La operación igual se guarda. La respuesta trae `email_enviado: false` y la pantalla muestra "El usuario se guardó, pero no se pudo enviar el email. Podés reenviarlo desde Enviar link de acceso." El intento queda en la auditoría con `email_enviado: false` y el error. Un aviso al superadmin que falla solo se registra en el log del servidor.

## 11. API

### 11.1 Panel (todas con `authMiddleware` + `adminOnly`)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/usuarios` | Lista con `id`, `username`, `nombre_completo`, `email`, `email_valido`, `cargo`, `vinculo`, `rol`, `estado`, `ultimo_ingreso`, `invitacion_vence` y `cambios_pendientes_propuestos`, más `resumen: { aprobadores_activos, minimo: 2 }`. `estado` vale `activo`, `invitacion_pendiente` o `desactivado` (sección 3). |
| GET | `/api/usuarios/:id` | Un usuario más su `historial` (sección 9). |
| POST | `/api/usuarios` | Alta y envío de la invitación. Responde 201 con el usuario y `email_enviado`. |
| PUT | `/api/usuarios/:id` | Edición de datos y rol. |
| POST | `/api/usuarios/:id/desactivar` | Sección 8.6. |
| POST | `/api/usuarios/:id/reactivar` | Sección 8.6. |
| POST | `/api/usuarios/:id/enviar-acceso` | Invitación o recuperación según el estado (7.2). |

Respuestas con el formato del proyecto: `{ success, data?, error?, message? }`.

### 11.2 Públicas

| Método | Ruta | Límite |
|---|---|---|
| POST | `/api/auth/recuperar` | 5 por hora por IP y 3 por hora por identificador |
| POST | `/api/auth/link/validar` | 20 cada 15 minutos por IP (compartido) |
| POST | `/api/auth/establecer-contrasena` | 20 cada 15 minutos por IP (compartido) |

### 11.3 Cambios en rutas existentes

- `GET /api/auth/verify` y `GET /api/auth/profile` devuelven además `cargo` y `vinculo`.
- `POST /api/auth/change-password` incrementa `sesion_version` y devuelve un token nuevo, que `perfil.js` guarda.
- `PUT /api/auth/profile` valida el formato del email y el largo del nombre, y registra `perfil_editado`.

### 11.4 Organización del código

| Archivo | Contenido |
|---|---|
| `controllers/usuariosController.js` | Endpoints del panel. |
| `controllers/authController.js` | Login con los cambios de 5.4 y endpoints públicos de 11.2. |
| `services/accesoService.js` | Generar, validar, consumir y anular links, y armar y enviar los emails de acceso. |
| `services/usuariosAuditoriaService.js` | `registrar(conexion, { usuarioId, actorId, accion, detalle })` y lectura del historial. |
| `services/usuariosReglas.js` | Funciones chicas y testeables: `esAdmin`, `estadoDeUsuario`, validaciones y control del mínimo de aprobadores. |
| `public/js/api.js` | `Utils.sugerirUsername` (8.4). El backend no la necesita: solo valida que el usuario sea único. |
| `public/usuarios.html`, `public/js/usuarios.js` | Panel (12.2). |
| `public/establecer-contrasena.html`, `public/js/establecer-contrasena.js` | Links de acceso (12.3). |
| `middleware/auth.js` | `authMiddleware` asíncrono (5.1) y `adminOnly` con `esAdmin`. |
| `middleware/rateLimit.js` | Límites nuevos de 11.2. |
| `scripts/setup-admin.js` | Acepta `superadmin`, `admin` o `lector` (por defecto `lector`), valida el email y el largo de la contraseña. Es la vía para crear el superadmin en una instalación nueva. |

## 12. Pantallas

El panel usa el sistema visual que ya tiene el RPAD (Inter, `--primary`, badges y modales de `main.css`), sin estilos nuevos de base.

### 12.1 Sidebar y header

- Nuevo enlace **Usuarios** en la sección Administración, entre Áreas y Correos, en todas las páginas que tienen sidebar. Lo ven admin y superadmin.
- El header muestra el rol según 5.3.

### 12.2 `usuarios.html` + `js/usuarios.js`

Si entra un lector, se lo redirige a `index.html`, como en Correos.

```
Usuarios                                        [+ Nuevo usuario]
[Buscar por nombre, usuario, cargo o email.....................]

Pueden aprobar cambios      (AA)(BB)(CC)(DD)   4 activos (mínimo 2)
────────────────────────────────────────────────────────────────
 AA  Nombre Apellido              [Superadmin]
     USUARIO   Cargo
     Último ingreso: hoy 09:12                              [Ver]
 CC  Nombre Apellido              [Admin] [Contrato]
     USUARIO   Cumple funciones de Cargo (sin designación formal)
     Último ingreso: ayer                                   [Ver]

Solo lectura                                          5 activos
────────────────────────────────────────────────────────────────
 EE  Nombre Apellido              [Lector] [Sin email]
     USUARIO   Cargo                                        [Ver]

▸ Desactivados (0)
```

- **Encabezado de aprobadores.** Muestra las iniciales de cada aprobador activo y el contador "N activos (mínimo 2)". Con exactamente 2, el contador pasa al color de advertencia, porque no se puede sacar a nadie más. En la etapa 2, los aprobadores de licencia se van a mostrar atenuados ahí.
- **Filas.** Cada una tiene las iniciales, el nombre, el usuario, el cargo (con la fórmula de contrato cuando corresponde), el último ingreso ("Sin registro" si nunca ingresó después del despliegue) y el botón "Ver".
- **Etiquetas:**
  - **Superadmin**: azul sólido (`--primary`);
  - **Admin**: azul claro;
  - **Lector**: gris;
  - **Contrato**: violeta (`--purple-light`);
  - **Invitación pendiente**: amarilla (`--warning-light`), con el vencimiento en el título emergente;
  - **Sin email**: roja (`--danger-light`).
- **Desactivados.** Plegados al final con `<details>` y con la fila atenuada.
- **Búsqueda.** Filtra en el navegador por nombre, usuario, cargo y email, en los tres grupos.

**Modal "Ver"**, con las pestañas **Datos** e **Historial**:
- **Datos:**
  - formulario con nombre completo, usuario, email, rol (Admin/Lector), cargo y vínculo, y el botón "Guardar cambios";
  - debajo, el bloque **Acceso**: último ingreso, estado, el botón "Enviar link de acceso" (su texto dice "Reenviar invitación" cuando la invitación está pendiente) y "Desactivar" o "Reactivar";
  - "Enviar link de acceso" queda deshabilitado si el usuario no tiene un email válido, con la explicación al lado.
- **Cuenta superadmin vista por un admin:** todo en solo lectura, con la nota "Esta cuenta solo la modifica su titular."
- **Historial:** la lista de la sección 9.
- **Confirmaciones:** desactivar, pasar a lector y modificarse a uno mismo piden confirmación con un texto que dice qué va a pasar.

**Nuevo usuario** usa el mismo formulario, sin el bloque Acceso. El usuario se sugiere mientras se escribe el nombre (8.4). Al guardar, la pantalla muestra "Usuario creado. Le enviamos la invitación a {email}." (o el mensaje de 10.4).

**Errores del backend** (409 por el mínimo de aprobadores o por un dato repetido, 403 por la cuenta protegida, 400 por validación): se muestran dentro del modal, junto al campo cuando corresponde, sin cerrarlo.

### 12.3 `establecer-contrasena.html` + `js/establecer-contrasena.js`

Página pública con el mismo estilo que `login.html` (tarjeta centrada, sin sidebar). Tiene dos modos:
- **Con `#token=`:**
  - valida el link;
  - si sirve, muestra "Hola, {nombre}. Elegí tu contraseña para el usuario {USUARIO}." y dos campos (contraseña y repetir), con el mínimo de 8 caracteres indicado;
  - si no sirve, explica por qué ("El link venció", "Este link ya se usó", "El link no es válido") y ofrece pedir uno nuevo.
- **Sin token:** formulario "Usuario o email" que llama a `/auth/recuperar` y muestra el mensaje genérico de 7.3.

### 12.4 Login y Mi Perfil

- `login.html` agrega el enlace "¿Olvidaste tu contraseña?" hacia `establecer-contrasena.html`, y muestra el mensaje de éxito cuando llega desde esa página.
- Mi Perfil muestra el cargo y el vínculo en solo lectura, porque se editan desde el panel.

## 13. Casos borde

| Caso | Comportamiento |
|---|---|
| Admin creado con invitación pendiente | No cuenta como aprobador activo hasta que define su contraseña. |
| Token viejo de un usuario desactivado | 401 en el pedido siguiente. |
| Rol cambiado mientras la persona tiene la página abierta | El backend aplica el rol nuevo en el pedido siguiente; el menú se actualiza al cargar la próxima página (5.3). |
| Usuario existente con email vacío | Sigue ingresando. No se le pueden generar links hasta que se le cargue un email; para editarlo hay que completarlo. |
| Dos links pedidos seguidos | Solo el último sirve: el anterior queda anulado. |
| "Olvidé mi contraseña" para un usuario desactivado o inexistente | Respuesta genérica y no se envía nada. |
| Admin que se desactiva a sí mismo | Permitido si se respeta 8.1. Su pedido siguiente responde 401 y la sesión se cierra. |
| Despliegue con sesiones abiertas | Siguen válidas (token sin `v` = versión 0). La cuenta superadmin ve su rol nuevo al cargar la página siguiente. |

## 14. Tests

Son de integración con `node:test` contra el entorno Docker local (MariaDB y Mailpit), siguiendo `tests/helpers.js`.

### 14.1 `tests/usuarios-panel.test.js`

- **Permisos:** sin login, 401; lector, 403; admin y superadmin, 200 en todas las rutas de 11.1.
- **Alta:** crea al usuario con la invitación pendiente; el email llega a Mailpit con un link que funciona; queda la auditoría `alta` y `invitacion_enviada`.
- **Validaciones:** email inválido o repetido, usuario repetido, `rol = 'superadmin'` (400) y largos máximos.
- **Cuenta superadmin:** un admin no puede editarla, desactivarla ni enviarle links (403); el propio superadmin puede editar sus datos pero no su rol.
- **Mínimo de aprobadores:**
  - con 2 aprobadores, desactivar o degradar a uno responde 409;
  - dos degradaciones simultáneas dejan al menos 2 aprobadores;
  - un admin con invitación pendiente no cuenta.
- **Revocación:** después de desactivar, el token del usuario responde 401; después de degradar, el mismo token recibe 403 en una ruta de admin.
- **Reactivación** de un usuario activo y de uno con invitación pendiente.
- **Aviso al superadmin:** llega cuando un admin cambia un rol, crea un admin o desactiva a alguien, y no llega cuando el cambio lo hace el superadmin.
- **Historial:** `GET /usuarios/:id` devuelve las filas en orden.

### 14.2 `tests/usuarios-contrasena.test.js`

- Un link sirve una sola vez; un link vencido o anulado no sirve; reenviar anula el anterior.
- Establecer la contraseña permite ingresar con la nueva y deja en 401 los tokens anteriores.
- Un usuario con la invitación pendiente no puede ingresar, y la respuesta es igual a la de un usuario inexistente.
- `/auth/recuperar` da la misma respuesta para una cuenta existente, una inexistente y una desactivada, y solo envía email en el primer caso. Se prueban también sus límites.
- Contraseña de menos de 8 caracteres o de más de 72 bytes: 400.
- Cambiar la contraseña desde Mi Perfil devuelve un token nuevo que sigue funcionando y deja en 401 el anterior.

### 14.3 Tests que se actualizan

- `tests/helpers.js`: crea también un superadmin de prueba.
- `tests/permisos.test.js`: agrega las rutas nuevas y verifica que el superadmin pasa todas las rutas de admin.
- `tests/notificaciones.test.js`: el superadmin recibe el email de cambios pendientes.
- `tests/doble-verificacion.test.js`: el superadmin no puede aprobar sus propios cambios.
- `tests/schema.test.js`: pasa con el `schema.sql` nuevo y verifica que `schema.sql` no tenga datos de usuarios.

### 14.4 Funciones puras

- `Utils.sugerirUsername` (tildes, partículas, palabras sueltas, números de colisión), cargando `public/js/api.js` con `vm`, como `tests/frontend-utils.test.js`.
- `estadoDeUsuario`, las validaciones y la regla del mínimo de aprobadores sobre listas en memoria.

## 15. Despliegue

1. Correr `database/updates/migracion-usuarios-superadmin.sql` en producción, como las migraciones anteriores (antes de subir el código nuevo).
2. Subir los archivos nuevos de la aplicación.
3. Agregar `APP_URL=https://rpad.mcrmodernizacion.gob.ar` a las variables de entorno de cPanel (si falta, se usa ese mismo valor por defecto) y reiniciar la aplicación Node. Los pasos 2 y 3 van seguidos.
4. Correr una sola vez el SQL de datos de `database/privado/` (rol superadmin, cargos y vínculos). Va después del reinicio: el código anterior no conoce el rol superadmin.
5. Verificar:
   - el superadmin ve "Superadmin" en el header;
   - el panel lista a los usuarios con sus cargos;
   - una invitación de prueba enviada a una casilla propia llega y su link funciona.

No hay cambios en los cron de cPanel.

## 16. Documentación

- `CLAUDE.md`: roles (tres), tablas nuevas, variables `APP_URL`, `EMAIL_SOLO_A` y `RPAD_TESTS_DB_LOCAL`, y el comando `npm test`.
- `README.md`: el panel de usuarios, los links de contraseña y la migración nueva.

## 17. Fuera de alcance

- Licencias de administradores y su efecto en los avisos (etapa 2).
- Vincular usuarios a una estructura jerárquica del organigrama: el cargo es texto libre.
- Borrar usuarios.
- Cambiar la FK `ON DELETE CASCADE` de `cambios_pendientes.usuario_id`. Como los usuarios ya no se borran, no tiene efecto práctico.
- Política de contraseñas más allá del mínimo de 8 caracteres y el máximo de 72 bytes.
- Notificar al usuario afectado cuando cambia su rol o lo desactivan.
