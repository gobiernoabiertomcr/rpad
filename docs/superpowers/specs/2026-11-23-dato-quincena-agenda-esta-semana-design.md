# El dato de la quincena: «Esta semana» en la agenda

Fecha: 23/11/2026. Base: main 3b6f10a (en producción); el código va después de la votación de la principal (`docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md`).
Lo pidió una consulta de Datito (su v06.2), y el usuario eligió mirando maquetas sobre la página real con la regular del 23/11 (fuera del repo, `~/rpad-notas/datito-v06-2/web/`).

## Por qué

- Desde su v06, Datito arma la agenda con lo que viene: los eventos de los días 3 a 20 desde el lunes de la edición.
  En su propio correo la parte en tres bloques: los eventos de jueves a domingo de esa misma semana, los de los días 7 a 20 («Lo que viene») y las efemérides.
- El RPAD arma sus grupos con la fecha de cada evento y la de la edición (spec 2026-11-14-dato-quincena-agenda-grupos), pensados para copiar los bloques de Datito: «Lo que pasó», «Lo que viene» y «Efemérides».
  Con la v06 el primer bloque de Datito ya no es lo que pasó, así que en el RPAD esos eventos caen en «Lo que viene», mezclados con los de la semana siguiente, y «Lo que pasó» queda vacío.
- El equipo lee el mail del RPAD, no el de Datito: es ahí donde los dos bloques tienen que verse aparte.

## Objetivos, no objetivos y anti-objetivos

- Objetivo: en la página y en el mail, los eventos de la semana de la edición van en su propio grupo, «Esta semana», antes de «Lo que viene».
- No objetivo: el contrato con Datito. El JSON no trae ni va a traer el bloque de cada evento: el RPAD lo calcula con lo que ya llega (`fecha`, `tipo` y `fecha_edicion`).
- No objetivo: las efemérides, que siguen en un solo grupo cualquiera sea su fecha, como el tercer bloque de Datito.
- No objetivo: la página y la plantilla del mail, que ya dibujan tantos grupos como mande el servidor (visto en la maqueta, en la página y en el mail).
- No objetivo: Mi espacio, que no muestra la agenda de una edición.
- Anti-objetivo: que el mail cambie en algo más que el grupo nuevo (lo controla `tests/dato-quincena-resguardo.test.js`, que con esta regla no cambia).
- Anti-objetivo: depender de que Datito cambie algo. Su v06.2 (el nombre del bloque en su `correo.txt`) y este cambio van cada uno por su lado, en cualquier orden.

## Enfoques

- A: el RPAD separa «Esta semana» por su cuenta, con las fechas.
  Una regla del servidor; sin contrato nuevo ni despliegue coordinado.
- B: el RPAD queda como está y Datito renombra solo su copia del correo.
  Sin trabajo, pero el equipo sigue viendo los dos bloques juntos.
- C: un campo de bloque por evento en el JSON.
  Es un cambio de contrato (hoy da 422 «Esta clave no está en el formato de la edición.» y la edición no se archiva), obliga a desplegar el RPAD antes y no suma nada que el RPAD no pueda calcular.

Elegido: A (decisión del usuario), con el nombre «Esta semana» (decisión del usuario, el que propuso Datito).

## La regla

- `GRUPOS_DE_LA_AGENDA` (`services/datoQuincenaReglas.js`) pasa a cuatro grupos, en este orden:
  1. «Lo que pasó»: los eventos (sin `tipo` o con `evento`) anteriores a la edición, como hoy.
  2. «Esta semana»: los eventos del día de la edición al domingo de esa semana, los dos incluidos.
  3. «Lo que viene»: los eventos posteriores a ese domingo.
  4. «Efemérides»: las efemérides, cualquiera sea su fecha, como hoy.
- La semana va de lunes a domingo, como el grupo «Esta semana» de los próximos de Mi espacio (`public/js/mi-espacio.js`, «hasta el domingo»): una regular, que cae en lunes, la cuenta de los días 0 a 6, que son los de Datito (3 a 6).
  Decisión: «hasta el domingo» y no «7 días», porque el nombre dice la semana y así coincide con Mi espacio; en un lunes las dos dan lo mismo.
  Un piloto puede caer otro día: su «Esta semana» va de su fecha a su domingo (uno de un domingo tiene solo ese día).
- El corte se mide desde `fecha_edicion`, no desde el día en que sale el mail: una regular sale el lunes o, con feriados, el martes o el miércoles de esa semana, y «Esta semana» sigue siendo cierta.
- Lo demás de la función no cambia: dentro de cada grupo, por fecha y, con la misma, en el orden en que llegaron; un grupo vacío no va; sin agenda, una lista vacía; no cambia la agenda que recibe.
- Se calcula al leer: las ediciones ya archivadas también se ven así en la página y en un reenvío o una prueba.
  El mail que ya salió no cambia.

## Lo que cambia y lo que no

- Cambia `services/datoQuincenaReglas.js` (la regla y su comentario) y nada más del código: `agenda_grupos` sigue teniendo la misma forma.
- No cambian `public/js/dato-quincena.js` (sin `?v=` nuevo ni `VERSION_DATO_QUINCENA`), `public/dato-quincena.html`, `services/emailTemplates.js`, `modeloDelMail`, `agenda` del detalle (la lista sin agrupar), la validación, el POST, la base ni las Tareas Cron.
- Con cuatro grupos, la página hace cuatro columnas arriba de 820 px y una debajo; en una regular de la v06 son tres («Lo que pasó» no aparece).

## Tests

- `tests/dato-quincena-reglas.test.js`, `gruposDeLaAgenda`: los casos que hoy ponen en «Lo que viene» un evento de la semana de la edición pasan a «Esta semana» (el piloto 14, el orden con la edición del 16/11, el mismo día, sin `tipo`).
  Casos nuevos: el domingo de la semana va en «Esta semana» y el lunes siguiente en «Lo que viene»; los cuatro grupos en su orden; un piloto que no cae en lunes; una edición de un domingo.
- `tests/dato-quincena-correo-reglas.test.js`: el caso de la edición del 16/11 (con el día 0 en «Lo que viene») pasa a «Esta semana».
- `tests/dato-quincena-frontend.test.js` y `tests/email-diseno.test.js`: un caso con cuatro grupos (la página y el mail no cambian; solo se fija que los dibujan).
- No cambian: `tests/fixtures/dato-quincena-respuestas.json` (sus ediciones traen un evento del día 8 o uno pasado), el resguardo del mail y su fixture (el evento del día 8 sigue en «Lo que viene»).

## Documentos

`docs/temas/dato-quincena.md` (los grupos del detalle) y `docs/temas/dato-quincena-correo.md` (la agenda del mail): lo vigente, un renglón por oración.
La decisión de las columnas de `docs/temas/dato-quincena-principal-equipo.md` sigue siendo cierta y no cambia.

## Despliegue

- Sin SQL: un kit con `services/datoQuincenaReglas.js`, contra lo que esté en producción después del kit de la votación.
- En producción antes de que salga el mail de la edición del lunes 07/12 (el miércoles 09/12 a las 8:05): el mail arma la agenda al salir.
- No hace falta avisarle a Datito ni coordinar horarios: el contrato no cambia.
