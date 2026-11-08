# Métricas: los rótulos de la tabla del modal y el número de la nota DGMIT

Fecha: 08/11/2026. Decisiones del usuario del 08/11/2026, en tres rondas de preguntas y una maqueta; aprobó la maqueta el 08/11/2026.
La maqueta se vio con la página real de main y los datos de la copia local de producción del 07/11/2026, fuera del repo (`~/rpad-notas/metricas-modal-rotulos/`); los ejemplos de acá son inventados.
Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

La tabla «Los ciclos (N)» del modal de cada tramo (pestaña Métricas, spec 2026-11-07-metricas-cajones-y-ciclos, 5) tiene encabezados de una o dos palabras: «Aviso», «Vencimiento», «Nota DGMIT», «Datos recibidos» y «Días».
El usuario pidió, con sus palabras: «En todas usás algo más descriptivo, pero simple y que no sea largo.».
También pidió el dato de la nota DGMIT en la redacción y en la respuesta del área: hoy la tabla da su fecha, pero no cuál es la nota.

## 2. Decisiones del usuario

1. **Los rótulos de las fechas y de los días** son los de la tabla de la sección 3, elegidos entre dos o tres propuestas por columna.
2. **La nota DGMIT va en la misma celda que su fecha**, con el número entre paréntesis: «02/03/2026 (N° 7/26)».
   Es su idea («la fecha y entre paréntesis la nota DGMIT»), con el «N°» que ya usa el Seguimiento («Nota DGMIT N° 7/26»).
   Se descartaron «(Nota 7/26)» y el número debajo de la fecha, en letra chica.
3. **La fecha y el número van siempre en un renglón**, como en la maqueta que aprobó: la columna del dataset se angosta lo que haga falta.
   La propuesta elegida decía que el paréntesis bajaba entero si no entraba; en la maqueta, con el modal de 900 píxeles, bajaba en casi todas las filas, y se pasó a un renglón antes de mostrársela.
4. **«Dataset» queda igual**, y «Datos recibidos» y «Carga en el portal», donde no cambian.
5. **Solo el modal.**
   El PDF de Métricas, el Informe anual y el PDF del Ciclo de vida del dato no tienen esas tablas, y no cambian.
   Tampoco cambian los encabezados de «Los casos» de la pestaña ni los de «Los casos destildados» del PDF de Métricas: son otra tabla, con una fila por ciclo y todos sus momentos.
6. En la respuesta del área, el usuario había escrito dos renglones «Días», uno sobre el circuito de la nota y otro sobre la producción del dato; eligió juntarlos en «Días de circuito y producción».

## 3. Los rótulos

Las columnas, de izquierda a derecha: el dataset, la fecha donde empieza la etapa, la fecha donde termina y los días.

| Gestión | Tramo | Empieza | Termina | Días |
|---|---|---|---|---|
| las dos | Aviso anticipado | Pedido DDPC vía RPAD | Vencimiento del dato | Días de anticipación |
| externa | Redacción y entrega de nota | Pedido DDPC vía RPAD | Entrega de nota DGMIT | Días de redacción y entrega |
| externa | Respuesta del área | Entrega de nota DGMIT | Datos recibidos | Días de circuito y producción |
| externa | Preparación y carga | Datos recibidos | Carga en el portal | Días de preparación y carga |
| interna | Producción del relevamiento | Pedido DDPC vía RPAD | Entrega del relevamiento | Días de producción |
| interna | Preparación y carga | Entrega del relevamiento | Carga en el portal | Días de preparación y carga |

- La primera columna sigue diciendo «Dataset».
- La carga es el único tramo cuyo rótulo cambia con la gestión: en la interna, la fecha donde empieza es la misma que termina la producción, y lleva su mismo rótulo.
- En la interna, «Entrega del relevamiento» vale también para un ciclo resuelto con datos de una fuente pública: la producción ya cuenta así todo dato recibido (`medir`), y la regla no cambia.
- Lo que va en cada celda no cambia: las fechas, «en curso», «pendiente de carga», la marca «avisado ya vencido: desde ese primer aviso» y los días en las dos unidades.

## 4. El número de la nota DGMIT

- Va junto a la fecha de la nota, en la misma celda: en la redacción, en la columna donde termina («Entrega de nota DGMIT»); en la respuesta del área, en la columna donde empieza.
- Lo llevan las filas que tienen esa fecha: en la redacción, las que cuentan; en la respuesta del área, las que cuentan y las en curso.
  Una nota pendiente de carga no tiene número ni fecha: sigue diciendo «pendiente de carga».
- Es el de la misma nota que da la fecha: la primera nota DGMIT vigente del ciclo (`nota_dgmit` del caso, `h.nota` de los hechos), tal como está cargado («7/26»).
- El texto lo arma el servidor: «(N° 7/26)», con el «°» del Seguimiento (U+00B0).
  Sin número (no debería pasar: la columna es obligatoria), no va nada y la celda dice solo la fecha.
- La fecha y el número no se separan: si la tabla no entra, se desplaza de costado en su marco, como hoy en el teléfono.

## 5. Contratos

### Lo que manda el servidor

`modalDelTramo` (`services/metricasReglas.js`):
- `puntas`: los dos rótulos de las fechas, los de la sección 3, según el tramo y la gestión.
- `rotulo_de_los_dias`: clave nueva, el rótulo de la columna de los días, después de `puntas`.
- En cada ciclo, dos claves nuevas, después de `desde` y de `hasta`: `desde_nota_dgmit` y `hasta_nota_dgmit`, «(N° 7/26)» o ''.
  Queda `{ dataset_id, titulo, area, estado, desde, desde_nota_dgmit, hasta, hasta_nota_dgmit, hasta_texto, dias_texto, nota }`.
  `nota` sigue siendo la marca del avisado ya vencido.
- Las once claves del tramo que lee el Ciclo de vida no cambian (`tests/metricas-huellas.test.js`).

### Lo que dibuja la página

`htmlDelModal` y `htmlDeFilaDelModal` (`public/js/reportes.js`):
- El encabezado de los días es `rotulo_de_los_dias`; sin esa clave, «Días» (`COLUMNA_DE_LOS_DIAS`).
- Con número, la celda es la fecha y el número dentro de un `<span class="nro">`, que no se corta (`white-space: nowrap`, en el `<style>` de `reportes.html`): «02/03/2026 (N° 7/26)».
  Sin número, la celda es la de hoy.
- Todo texto nuevo pasa por `escaparTexto`, como el resto.

### La foto del 31/12

- La foto guarda el modal de las vistas en días corridos: con este cambio en producción antes del 10/01/2027, la foto de 2026 guarda los rótulos y los números nuevos.
- Son claves nuevas: `VERSION_DE_LA_FOTO` sigue en 1 y una foto sin ellas se lee con tolerancia (la página pone «Días» y la fecha sola).
  Hoy no hay ninguna foto: la primera se saca el 10/01/2027.
- Un despliegue después del 10/01/2027 deja la foto de 2026 con los rótulos de antes para siempre: el kit va antes.

## 6. Versiones

- `reportes.js?v=` sube a 20261214 (`VERSION_REPORTES`, `tests/paginas.test.js`).
- `VERSION_FERIADOS` tiene que seguir siendo mayor: sube a 20261215, y con ella `feriados.js?v=` en `configuracion.html`, sin que cambie `feriados.js`.

## 7. Documentación

- `docs/temas/metricas-y-reportes.md` está en 58,8 de 60 KB: la sección «El modal de cada tramo» pasa a un documento nuevo, `docs/temas/metricas-modal.md`, con los rótulos y el número de esta spec.
  En su lugar queda un renglón que manda al documento nuevo.
- El documento nuevo suma su fila en «El mapa» de `CLAUDE.md`.
- `.claude/rules/metricas-y-reportes.md` podría nombrar también el documento nuevo; es una ruta protegida y no hace falta para los tests (`metricas-y-reportes.md` manda al nuevo): queda como pendiente para el usuario.

## 8. Tests

- `tests/metricas-reglas.test.js`: las claves del modal y de cada ciclo; los rótulos de cada tramo en las dos gestiones, también sin ciclos; el número en la redacción (las que cuentan, no las pendientes) y en la respuesta (las que cuentan y las en curso), con el número de la nota del ciclo; '' en los demás tramos y sin número.
- `tests/reportes-frontend.test.js`: el encabezado de los días con `rotulo_de_los_dias` y, sin él, «Días»; la fecha y el número juntos en su `<span class="nro">`; sin las claves nuevas, la fila de hoy; los textos nuevos escapados.
- `tests/paginas.test.js`: las versiones de la sección 6.
- Los números de nota de los tests son inventados.

## 9. Fuera de alcance

- Los encabezados de «Los casos» y de «Los casos destildados», los PDF y el Ciclo de vida.
- Los textos del modal que no son la tabla: el nombre, quién, la frase, la cifra, la leyenda, «Cómo se cuenta» y el gráfico.
- El tipo de la nota (solicitud o reiteración): no va.
