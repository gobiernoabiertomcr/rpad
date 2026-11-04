# Validación de la API pública (spec, 03/11/2026)

## Por qué

El escaneo general del 03/11/2026 sumó tres arreglos chicos de la API pública, que el usuario eligió juntos: el formulario de contacto, el pedido al portal de datos abiertos y los errores al leer el cuerpo de un pedido. Al revisar las demás rutas públicas apareció el login, con la misma clase de arreglo, y el usuario eligió sumarlo acá. Es robustez: para quien usa las pantallas solo cambian cuatro casos raros. Un email de más de 100 caracteres da «Ingrese un email válido», un portal que tarda más de 10 segundos da el aviso de que no respondió a tiempo, una sesión vencida da el error al consultar el portal (antes, recién al guardar) y una pestaña de Gestión de Datasets abierta durante el despliegue tiene que recargarse para consultarlo.

## Qué se decidió

### Leer el cuerpo (`middleware/cuerpo.js`, `app.js`)

- Un cuerpo que no se puede leer es un error del pedido, no del servidor. Los errores de la lectura del cuerpo (los que traen `err.type`) con `err.status` 400 o 413 responden ese status con `{ success: false, error }` y un texto fijo: «Los datos enviados no tienen un formato válido.» o «Los datos enviados superan el tamaño permitido.». Nunca `err.message`, que repite lo que mandó el cliente.
- Esos errores no van enteros a la consola: `err.body` trae el cuerpo tal como llegó, y ese cuerpo puede ser una contraseña. Queda un renglón con el tipo, el método y la ruta.
- Los demás errores no cambian: siguen en 500 con «Error interno del servidor» y con su detalle en la consola (también los que traen otro status, o el 400 de una ruta mal codificada, que no trae `err.type`).
- Después de leer el cuerpo, un valor del cuerpo (JSON o formulario) o de la query tiene que comportarse como un dato común en todas las rutas, también las que piden sesión. Con el mismo 400 se rechazan, en cualquier nivel, las claves que pisan lo que todo objeto trae de fábrica (`__proto__`, `constructor`, `toString` y `valueOf`) y un cuerpo de más de 32 niveles debajo de la raíz, el tope con que ya se lee un formulario. Ninguna pantalla manda nada de eso. Una clave o un texto que solo las contiene (`constructora`) pasa. Va en un recorrido sin recursión, en `middleware/cuerpo.js`, y no en un `reviver` de `JSON.parse`, que haría mucho más lenta la lectura.

### Formulario de contacto (`controllers/contactoController.js`)

Cada campo se valida en este orden: que sea un texto, su largo y su formato. Un campo que no es un texto cuenta como vacío y da el 400 de ese campo, con los mensajes de siempre. El email usa `emailValido` de `services/usuariosReglas.js`, la regla de los usuarios: hasta 100 caracteres, el largo de `usuarios.email`, sin los espacios de los extremos.

### Login y «¿Olvidaste tu contraseña?» (`controllers/authController.js`, `middleware/rateLimit.js`)

- Login: `username` y `password` tienen que ser textos; si no, el 400 de siempre, «Usuario y contraseña son requeridos». Antes de consultar la base.
- `/auth/recuperar`: un `identificador` que no es un texto cuenta como vacío y da la misma respuesta de siempre (no revela nada ni busca).
- Las claves de los límites de intentos (`limiteLoginPorUsuario`, `limiteRecuperarPorIdentificador`) toman solo un texto, con un tope de 100 caracteres, que no le llega a ninguna cuenta. Un valor que no es un texto cuenta como vacío.

### Portal de datos abiertos (`controllers/andinoController.js`, `routes/index.js`, `public/js/admin.js`)

- El pedido al portal tiene un tiempo límite real, con `AbortSignal.timeout`, que vale también si el portal contesta los encabezados y no termina el cuerpo. Si vence: 504, «El portal de datos abiertos no respondió a tiempo. Probá de nuevo en unos minutos.». El navegador ya muestra `result.error`.
- Un `url` que no es un texto da el 400 de siempre, «Se requiere el parámetro url».
- **Decisión del usuario (03/11/2026): `GET /api/andino/fetch` pasa a pedir sesión de administración** (`authMiddleware` + `adminOnly`). Solo la usa Gestión de Datasets, así que `admin.js` manda el token en sus dos pedidos y `admin.html` pide `admin-fechas.js` y `admin.js` con una versión nueva. Con un 401 o un 403, el mensaje del paso 1 no ofrece seguir con la carga manual, que también pide sesión.

## Antiobjetivos

- Que cambie algo más que esos cuatro casos para quien usa las pantallas.
- Que un mensaje o un log repita lo que mandó el cliente.
- Que un error que no es de la lectura del cuerpo cambie de status.
- Que la spec, los commits, los tests o la documentación expliquen cómo aprovechar lo que se arregla: el repo es público y el arreglo todavía no está desplegado.

## Fuera de alcance, para la limpieza de código

- `API.fetchFromAndino` de `public/js/api.js` no la llama nadie y no manda el token. Se queda: tocar `api.js` obliga a subir su versión en todas las páginas.

## Tests

Los que fallan sin el arreglo: `tests/errores-del-cuerpo.test.js` (por HTTP, con la app real), `tests/contacto-validacion.test.js` (puro), `tests/auth-tipos.test.js` (por HTTP), `tests/andino.test.js` (puro, con un `fetch` falso) y lo que se suma a `publico.test.js`, `permisos.test.js`, `admin-frontend.test.js` y `paginas.test.js`.

## Despliegue

**Sin kit propio (decisión del usuario, 03/11/2026):** va con el kit de la reiteración bimestral, que por eso se arma contra `3949aae`. Sin SQL, sin cron, sin variables de entorno nuevas y sin Run NPM Install.
