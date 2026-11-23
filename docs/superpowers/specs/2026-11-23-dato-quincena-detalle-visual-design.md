# El dato de la quincena: la jerarquía visual del detalle

Fecha: 23/11/2026. Base: main 1f81139 (en producción).
El usuario eligió mirando maquetas sobre la página real con la regular del 23/11 (fuera del repo, `~/rpad-notas/dq-detalle-visual/web/`).

## Por qué

- En Propuestas, el título de la propuesta y la cifra clave salían casi iguales: los dos enormes, en Bricolage y en negrita.
  No había jerarquía entre uno y otro.
- En General pasaba lo mismo con la principal de Datito, y ahí la cifra salía más grande que el título.
- En su propio correo, Datito muestra la cifra distinta del título: un recuadro, debajo de un título más chico.
- El usuario quiere además que «Por qué hoy» diga «Por qué es noticia».

## Objetivos, no objetivos y anti-objetivos

- Objetivo: en Propuestas y en General, el título manda y la cifra clave se lee como otra cosa, en una ficha celeste con su rótulo.
- Objetivo: los títulos de los campos de la propuesta se encuentran más rápido al recorrerla.
- Objetivo: el rótulo «Por qué es noticia» en la página, en «Copiar la propuesta» y en el mail.
- No objetivo: la clave `por_que_hoy` del JSON, que es contrato con Datito, ni nada del POST, la validación o lo guardado.
- No objetivo: Datasets nuevos, la lista de ediciones, la franja de la principal del equipo, la agenda y los archivos.
- No objetivo: el diseño del mail. Cambia solo el rótulo del campo.
- Anti-objetivo: que el primer correo real (martes 24/11 a las 8:05) salga distinto de lo probado: el kit no se despliega antes.
- Anti-objetivo: que el mail cambie en algo más que el rótulo (lo controla el resguardo).

## Enfoques

Tres direcciones para la cifra, en la maqueta:

- A «Recuadro del correo»: la cifra en un recuadro azul noche, con texto blanco en negrita, como el correo de Datito.
- B «Copete de diario»: el título queda igual y la cifra pasa a copete, en Figtree, más chica y sin negrita, con una barra a la izquierda.
- C «Ficha celeste»: la cifra en una ficha celeste con el rótulo «La cifra clave» y el texto en Bricolage.

Elegida: C (decisión del usuario).
El usuario eligió también aplicarla en General, marcar más los títulos de los campos y cambiar el rótulo también en el mail.

## La página

- La cifra clave, en Propuestas y en la principal de Datito de General, es una ficha:
  `<div class="dq-cifra">` (en General, `dq-principal-cifra`) con `<p class="dq-cifra-rotulo">La cifra clave</p>` y `<p class="dq-cifra-texto">` con el texto del servidor, escapado.
  El rótulo es un texto fijo de la página, como «Ángulo» o «Dataset:».
- La ficha: fondo `--sg-cielo`, texto `--sg-tinta` (10,2:1), radio de 12 px, sin el filete de arriba de antes.
  Lleva un borde transparente de 1 px, que en alto contraste (`forced-colors`) se ve: la ficha no depende del fondo.
  El rótulo, en Figtree 0,8 rem y negrita; el texto, en Bricolage 700, `clamp(1.12rem, 1rem + 0.4vw, 1.3rem)` (en General, 1,1 rem), interlineado 1,32, sin cifras tabulares (es un texto corrido).
- El título de la propuesta baja de `clamp(1.55rem, 1.15rem + 1.25vw, 2.15rem)` a `clamp(1.45rem, 1.15rem + 0.95vw, 1.9rem)`.
  El de la principal en General queda como está.
- En el teléfono (hasta 640 px), el título de la propuesta en 1,4 rem y el texto de la ficha en 1,08 rem, con menos relleno; sin scroll de costado desde 360 px.
- Los títulos de los campos de la propuesta («Por qué es noticia», «Ángulo», «Puntos centrales», «Texto para redes», «Borrador de nota» e «Idea de placa») pasan a Bricolage 700, 1,05 rem.
  Los de las tarjetas de Datasets nuevos (`h5`) y el de «Para validar antes de publicar» quedan como están.
- «Por qué hoy» dice «Por qué es noticia».
- `dato-quincena.js` sube su versión (`VERSION_DATO_QUINCENA`).
  El CSS va en el `<style>` de la página: `main.css` no cambia.

## El servidor y el mail

- `textoParaCopiar` (`services/datoQuincenaReglas.js`): el bloque «Por qué es noticia\n…».
- La plantilla del mail (`datoQuincenaTemplate`, `services/emailTemplates.js`): el campo «Por qué es noticia», en el HTML y en el texto.
- El resguardo (`tests/dato-quincena-resguardo.test.js`): el fixture no se regenera; lo esperado suma el cambio del rótulo, una vez por propuesta, en el HTML y en el texto, a las dos inserciones de la principal del equipo.
  El resto del mail sigue igual byte por byte.

## El despliegue

- Sin SQL. El kit lleva la página, su script y los dos servicios (por eso, Restart), con su vuelta atrás, contra 1f81139.
- No antes del martes 24/11 a las 8:10, por el mail.
  Decisión: desde las 14:10 de ese martes, así el reintento de las 14:00 sale con el mismo rótulo que el primer correo.
  Un reintento de otro día o un reenvío posterior al despliegue sale con «Por qué es noticia»: cambia solo ese rótulo.
- Fuera de las horas en punto y a y media, y de las rutinas de Datito (viernes a las 10:00 y a las 11:30).

## Lo que queda para quien lo construye

- Los tests de cada cambio, en los archivos de siempre (`dato-quincena-frontend`, `dato-quincena-reglas`, `dato-quincena-correo-reglas`, `email-diseno`, `dato-quincena-resguardo` y `paginas`), con datos inventados.
- Los documentos: `docs/temas/dato-quincena.md` (la página y lo que se copia), `dato-quincena-correo.md`, `dato-quincena-principal-equipo.md` y `dato-quincena-contrato.md` (lo que dicen del resguardo).
