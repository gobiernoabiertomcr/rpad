# Validación de la API pública (plan corto, 03/11/2026)

Spec: `docs/superpowers/specs/2026-11-03-validacion-api-publica-design.md`. Los detalles que no van a un repo público quedan fuera del repo: los tests y los commits describen el arreglo, sin entradas armadas.

## Tareas

Cada una: el test que falla primero, el código, `npm test` completo, revisión aparte (Opus, esfuerzo Extra), commit y push de la rama. Antes de cada commit, el diff contra los nombres de la tabla `usuarios`.

1. **Leer el cuerpo.** `tests/errores-del-cuerpo.test.js`, con `iniciarServidor()` y `fetch` directo: el 400 y el 413 con su formato exacto, sin repetir el cuerpo ni dejarlo en los logs; más de 1000 parámetros en un formulario, 413; las cuatro claves reservadas en cualquier nivel, también escritas con escapes, y más niveles que el tope, 400; un cuerpo de menos de 1 MB y una clave o un texto parecidos siguen llegando a la ruta; los demás errores no cambian (`/api/no-existe`, 404; una ruta mal codificada, 500). `middleware/cuerpo.js`: `cuerpoComun`, después de los dos lectores, y `erroresDelCuerpo`, antes del manejador global, que no cambia.
2. **Contacto.** `tests/contacto-validacion.test.js`, puro (`enviarContacto` con `req` y `res` falsos, `EMAIL_SOLO_A` frena cualquier envío): cada campo que no es un texto, 400 con su mensaje; el borde de 100 caracteres del email; un email largo no llega a la expresión; un valor que sirve llega al envío. En `publico.test.js`, lo mismo por HTTP, en JSON y en un formulario. En el controlador, `textoRecortado` y `emailValido`.
3. **Login y recuperar.** `tests/auth-tipos.test.js`, con `iniciarServidor()`: los valores que no son textos dan el 400 de siempre y no autentican; la contraseña correcta sigue entrando; `/auth/recuperar` da su respuesta de siempre; las claves de los límites comparan hasta 100 caracteres. En `authController.js` y `rateLimit.js`, `claveDeTexto`.
4. **Andino.** `tests/andino.test.js`, puro, con `mock.method(globalThis, 'fetch', …)`: el `signal` y su plazo, sin la opción `timeout`; el portal que no contesta y el que se cuelga en el cuerpo, 504; la red caída sigue en 503; el 404 del portal y el dato mapeado no cambian; un `url` que no es un texto, 400, sin salir a la red. En `permisos.test.js`, la ruta en `RUTAS_SOLO_ADMIN` y que administración llega al controlador. En `admin-frontend.test.js`, los dos pedidos con el token. `VERSION_ADMIN` a `'20261129'`.
5. **Documentación.** CLAUDE.md («Seguridad» y «Despliegue»), README (la ruta pasa a «Protegidos» y el Changelog), sin decir cómo aprovechar nada.

## Comprobación final

1. `git diff --stat 3949aae..HEAD` lista solo lo previsto.
2. Revisión aparte de toda la rama (Opus, esfuerzo Extra), con el diff y sin este plan.
3. Main traído a la rama, suite completa en verde, ningún nombre real en el diff.
4. Merge y push a main.

## Despliegue

Sin kit propio: va con el de la reiteración bimestral, armado contra `3949aae`. Sin SQL, sin cron y sin Run NPM Install. Los archivos: `app.js`, `middleware/cuerpo.js` (nuevo), `routes/index.js`, `controllers/andinoController.js`, `controllers/authController.js`, `controllers/contactoController.js`, `middleware/rateLimit.js`, `public/admin.html` y `public/js/admin.js`.
