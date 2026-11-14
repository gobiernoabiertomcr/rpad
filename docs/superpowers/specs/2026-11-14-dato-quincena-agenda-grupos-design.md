# El dato de la quincena: la agenda en tres grupos

Fecha: 14/11/2026. Base: main 4394696 (el contrato v1.3). Lo pidió el usuario después de ver el piloto 14.

## Por qué

Datito ordena la agenda en tres partes: lo que ya pasó, lo que viene y las efemérides.
En su mail se lee bien, porque cada parte tiene su título.
El RPAD la muestra como una sola lista, en el orden en que llega, así que parece desordenada (el 23/11 antes del 18/11).
Desde el 24/11 el equipo recibe el mail del RPAD, no el de Datito.

## Lo que se hace

- El servidor arma los grupos con lo que ya trae cada ítem (`fecha` y `tipo`) y la `fecha_edicion`. No cambia nada del contrato con Datito.
- Los grupos, en este orden y con estos títulos (decisión del usuario):
  1. «Lo que pasó»: los eventos (sin `tipo`, o `tipo` `evento`) con fecha anterior a la edición.
  2. «Lo que viene»: los eventos con fecha igual o posterior a la edición.
  3. «Efemérides»: las efemérides (`tipo` `efemeride`), cualquiera sea su fecha.
- Dentro de cada grupo, por fecha, de la más vieja a la más nueva; con la misma fecha, en el orden en que llegaron.
- Un grupo vacío no aparece. Sin ítems, la agenda no aparece, como hoy.
- Dentro de un grupo, el ítem no lleva la pastilla «Efeméride»: el título del grupo ya lo dice.

## El detalle

- `detalleDeLaEdicion` suma `agenda_grupos`: una lista de `{ titulo, eventos }`, con cada evento `{ fecha_texto, titulo, detalle, url }` (los mismos textos de hoy, sin `etiqueta`).
- `agenda` queda como está, para una pestaña abierta con la página anterior.
- La función de los grupos es pura y recibe la fecha de la edición por parámetro.

## La página (`public/js/dato-quincena.js`, `public/dato-quincena.html`)

- La sección «Agenda de la quincena» muestra cada grupo con su título (un subtítulo, `h4`) y su lista, con el mismo dibujo de cada ítem de hoy.
- Sube el `?v=` de `dato-quincena.js` y `VERSION_DATO_QUINCENA` en `tests/paginas.test.js`.
- Todo texto pasa por `esc`.

## El mail (`services/emailTemplates.js`)

- La agenda del mail muestra cada grupo con su título en negrita y sus ítems como hoy; tablas y estilos en línea.
- La versión de texto: el título de cada grupo en su renglón y los ítems debajo.
- `modeloDelMail` pasa `agenda_grupos` al modelo.

## Tests

- Reglas: los tres grupos con la edición del piloto 14 (ítems del 06/11 al 26/11 con la edición del 14/11); el orden por fecha y, con la misma fecha, el de llegada; un ítem del mismo día de la edición va a «Lo que viene»; una efeméride ya pasada va a «Efemérides»; sin `tipo` es un evento; grupos vacíos fuera; sin agenda, lista vacía.
- Página (vm): los títulos de los grupos, el orden, sin pastilla dentro de un grupo, el escapado.
- Mail: los títulos, el orden y la versión de texto.
- `tests/fixtures/dato-quincena-respuestas.json` suma `agenda_grupos`.

## Documentos

`docs/temas/dato-quincena.md` y `docs/temas/dato-quincena-correo.md`: lo vigente, un renglón por oración.

## Despliegue

Sin SQL: un kit con los archivos cambiados contra 4394696, y un piloto antes del 23/11.
