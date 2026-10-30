# Gestión de Datasets sin el prefijo `ad-` (plan corto, 30/10/2026)

## El problema y la causa

Una persona con rol editor no veía «Registrar actualización» en Gestión de Datasets (`admin.html`). La causa no es el rol: con el código de main (que es el de producción, comparado archivo por archivo), su cuenta en una copia local de la base ve el botón. Su captura muestra, en cada fila, el reloj, el lápiz y el tacho, pero no el botón: su navegador tiene un bloqueador de anuncios.

- EasyList (la lista que traen de fábrica uBlock Origin, AdBlock, Adblock Plus y AdGuard) y AdGuard Base tienen la regla genérica `##.ad-btn`, que oculta todo elemento con la clase `ad-btn`. En `admin.html` son 65 elementos: los 50 «Registrar actualización» de las filas y de las tarjetas del celular y los 15 botones de las ventanas («Siguiente», «Proponer cambios», «Proponer baja», «Proponer actualización», «Cancelar»…). Los otros tres controles de la fila son `ad-icono` y no los toca.
- Cruzadas las reglas genéricas de EasyList, EasyList Spanish, AdGuard Base, AdGuard Español, uBlock filters y Fanboy Annoyance (bajadas el 30/10/2026) contra todas las páginas, renderizadas en el navegador: la única que coincide es `.ad-btn`, y solo en `admin.html`.
- Las listas tienen 1167 reglas genéricas `.ad-…`: el prefijo `ad-` de las ~60 clases de la página es un imán (hay `.ad-info-wrap`, `.ad-format-300x250`, `.ad-subtitle`…). Mañana una lista puede sumar `.ad-tabla` o `.ad-form`.
- No es solo del editor: le pasa a cualquiera, de cualquier rol, con un bloqueador.

## Decisión del usuario (30/10/2026)

Cambiar todo el prefijo `ad-` de Gestión de Datasets, no solo `ad-btn`, y sumar un test que no deje volver a usar clases `ad-` en ninguna página.

## El nombre nuevo

`gdat-` (Gestión de DATasets): 0 reglas en esas seis listas (ni genéricas ni de un dominio) y 0 usos en `public/`. `gd-` tiene 5 reglas (`.gd-cookie-bar`, `.gd-social-share`…) y `gds-`, 1.

## Tareas

1. **El test que falla primero** (`tests/paginas.test.js`): ninguna página (`public/*.html`), script (`public/js/*.js`) ni hoja (`public/css/*.css`) usa un nombre que empiece con `ad-` en el lugar de un identificador: la expresión `(?<![A-Za-z0-9_-])ad-[A-Za-z0-9_]` (después de la revisión, también con un número: las listas tienen `.ad-300x250`), que no toma `cantidad-`, `rpad-` ni `data-ad-`. El mensaje dice el archivo y los nombres, y por qué (los bloqueadores de anuncios los ocultan). Hoy falla con `admin.html`, `admin-fechas.js` y `admin.js`.
2. **El cambio de nombre**, mecánico, con la misma expresión: `ad-` → `gdat-` en `public/admin.html` (el `<style>` y el HTML), `public/js/admin-fechas.js`, `public/js/admin.js`, `tests/admin-frontend.test.js` y las dos menciones de `tests/paginas.test.js`. Ningún nombre se arma concatenando `'ad-'`, y todos los `ad-` de esos archivos son clases (comprobado), salvo uno: el id del título de cada tarjeta del celular, que arma `idDelTituloDeTarjeta` (`ad-tarjeta-<id>-titulo`) y que la tarjeta usa en su `aria-labelledby`; cambia en los dos lugares a la vez. Nada más cambia: ni los otros ids, ni los `data-`, ni los textos.
3. **Las versiones**: `admin-fechas.js` y `admin.js` pasan de `?v=20261127` a `?v=20261128` (nunca usada en esos archivos) en `admin.html`, y `VERSION_ADMIN` en `tests/paginas.test.js`. Sin eso, un navegador con el script viejo en caché (Apache los guarda un mes) dibujaría filas `ad-` con la hoja nueva `gdat-`.
4. **Documentación**: en CLAUDE.md, una línea en «CSS» (ningún nombre empieza con `ad-`, por los bloqueadores, y el test que lo controla) y el kit en «Despliegue»; en el README, un renglón en «Troubleshooting».

## Verificación

- `npm test` completo antes y después (con el candado), contra una copia propia del dump.
- En vivo, con la app de la rama y una cuenta editor de prueba: el botón se ve en la compu y en el celular; con la regla `.ad-btn { display: none !important }` puesta a mano sigue viéndose; y el cruce con las seis listas da 0 coincidencias en `admin.html` (con las ventanas).

## Comprobación final (pedido del usuario, antes del despliegue)

Que no se haya roto nada ni se haya tocado nada de más:

1. **Solo los archivos previstos**: `git diff --stat ea8c8e7..HEAD` lista solo `public/admin.html`, `public/js/admin-fechas.js`, `public/js/admin.js`, `tests/admin-frontend.test.js`, `tests/paginas.test.js`, CLAUDE.md, README.md y este plan.
2. **El cambio de nombre es exacto**: en cada uno de los tres archivos de la página y en `tests/admin-frontend.test.js`, volver a escribir `gdat-` como `ad-` (y la versión `20261128` como `20261127`) da, byte por byte, el archivo de ea8c8e7. Así no cambió nada más que el nombre. La única excepción, después de la revisión, es la aclaración del comentario de `admin-fechas.js` que dice que el mockup tiene las clases con el prefijo de antes: la comprobación la saca antes de comparar.
3. **Ningún `ad-` quedó**: la misma expresión del test no encuentra nada en `public/`.
4. **La suite**: la misma cantidad de tests que antes, más los nuevos, y ninguno falla.
5. **En vivo**: el editor de prueba ve el botón, también con la regla del bloqueador puesta; y el cruce con las seis listas da 0.
6. **Sin nombres reales**: el diff no tiene ningún nombre, apellido ni usuario de la tabla `usuarios`.
7. **Una revisión aparte**, de un agente que mira el diff sin el plan, buscando algo roto o de más.

## Despliegue

Sin SQL, sin cron y sin Run NPM Install: subir `public/admin.html`, `public/js/admin-fechas.js` y `public/js/admin.js` y Restart. La vuelta atrás, los tres archivos de ea8c8e7. A quien ya tenía la página abierta le alcanza con recargar.
