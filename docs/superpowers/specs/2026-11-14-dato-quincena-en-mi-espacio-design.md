# El dato de la quincena en la agenda de Mi espacio

Fecha: 14/11/2026. Base: main f3949e8 (la agenda del dato en tres grupos). Rama: `claude/mi-espacio-dato-quincena`.
Maqueta aprobada (fuera del repo): `~/rpad-notas/dato-quincena-en-mi-espacio/maqueta/`, color A y texto 2.

## Por qué

El RPAD manda el correo del dato de la quincena cada dos lunes, desde el 24/11/2026.
El usuario quiere que todo el equipo, de cualquier rol, vea en su agenda cuándo sale el próximo, sin entrar a la pestaña Correo, que es solo de administración.
Las fechas son las de «Las próximas ediciones» de esa pestaña: el servidor las arma con la misma regla y la página las imprime tal cual.

## Lo que se ve (decisiones del usuario)

- Un chip de solo lectura en la agenda de Mi espacio, para todos los roles (también lector y colaborador), lo reciban o no por correo.
- Va el día en que sale el mail, no el lunes de la edición: la del lunes 23/11/2026 (feriado) va el martes 24/11.
- Tocarlo es tocar la casilla, como el feriado: en la compu abre «Nuevo evento» con ese día y en el teléfono elige el día; del dato no se despliega nada.
- Las próximas 5 fechas.
- El chip del día del envío queda hasta que termina ese día, con la hora real si la edición ya llegó: la de la corrida que la va a mandar (08:05 o 14:00, la misma de la pastilla de la edición) o, después de salir, la de su primer envío, con «Salió…».
- Lo pasado no se muestra.
- Con el envío automático apagado no aparece nada, tampoco la muestra de la leyenda.
- Los pilotos nunca.
- El mail diario de la agenda no cambia.
- Color turquesa (A de la maqueta) y el ícono de la página El dato de la quincena (Lucide «newspaper»).
- En la casilla, el texto corto «Dato de la quincena», sin la hora.
- En la lista del día elegido (teléfono) y en «Próximos», la hora, «Sale el dato de la quincena» (o «Salió…») y debajo el detalle: «Edición del lunes 23/11: no es hábil el lunes 23/11, Día de la Soberanía Nacional.».

## Cómo se construye: los caminos

- **A, elegido por el usuario:** la respuesta de `GET /api/mi-espacio/eventos` suma las fechas del dato y si el envío está prendido.
  Reusa los feriados que ese pedido ya lee (una sola lectura por pedido) y lee lo demás aislado: si falla, la agenda carga igual, sin los chips.
- B, descartado: un pedido aparte para el dato. Vuelve a leer los feriados, suma un pedido al abrir la pestaña y dibuja con dos fuentes que pueden llegar en otro orden.
- C, descartado: guardar las fechas como eventos con una corrida. Copia la regla, pide migración, se atrasa si cambian los feriados y entraría en el mail diario y en los recordatorios.

## Las fechas (la regla)

Todo en `services/datoQuincenaCorreoReglas.js`, que ya arma «Las próximas ediciones»: una sola fuente.

- `proximasEdiciones` suma la opción `desdeLaSalida` (de entrada, `false`): con `true`, la serie salta las ediciones cuyo día de salida (`sale`) es anterior a hoy, en lugar de las de lunes anterior a hoy.
  La pestaña Correo la llama como hoy, sin la opción: no cambia.
  Así, el martes 24/11 la edición del lunes 23/11 sigue en la serie aunque todavía no haya llegado.
- Una función pura nueva, `datoQuincenaEnMiEspacio({ envioActivo, ultima, ahora, calendario, filasDeFeriados })`, arma la lista de la agenda:
  - Con `envioActivo !== true` o `calendario.error !== null`, ninguna.
  - `ultima` es la última edición regular con lo de su envío (`{ fecha_edicion, correo, envios }`) o null.
  - Si la última ya llegó, su situación sale de `situacionDelEnvio` (la misma de la pastilla y la línea del correo):
    - `programada` (espera su corrida con el envío prendido, también `en_curso` sin ninguna fila enviada): va el día de su `salida` (`proximaSalida`, con la hora de la consulta), con esa hora (08:05 o 14:00): la misma que dice su pastilla, «Sale hoy a las 14:00».
    - `enviada` (salió sola): va solo si su primer envío fue hoy, con esa hora, como «Salió…».
    - Cualquier otra (no enviada, fallida, reenviada, sin envío del RPAD): no va.
  - Después, las de `proximasEdiciones({ ultimaRegular, hoy, calendario, filasDeFeriados, cantidad, desdeLaSalida: true })`, a las 08:05 de su `sale`, hasta completar 5 entre todas.
  - Sin ninguna regular, la serie arranca en `PRIMERA_EDICION`, como en la pestaña Correo.
- Es una estimación, como la pestaña Correo: una edición que todavía no llegó dice 08:05.

## Los textos (los arma el servidor)

Cada ítem es `{ fecha, hora, texto, nombre, titulo, detalle }`:

- `fecha`: 'AAAA-MM-DD', el día en que sale (o salió).
- `hora`: '08:05' o '14:00', con dos cifras como los eventos de la agenda; en una que salió, la hora de su primer envío.
- `texto`: «Dato de la quincena» (la casilla del mes).
- `nombre`: «Sale el dato de la quincena» o, si ya salió, «Salió el dato de la quincena» (la lista del día y «Próximos»).
- `detalle`: «Edición del lunes 23/11» y, si se corre, «: » y el motivo de la regla («no es hábil el lunes 23/11, Día de la Soberanía Nacional»), con punto final.
  El motivo es el de la serie: se calcula contra `proximoDiaHabil` del lunes de la edición y va solo si el ítem cae ese día y ese día no es el lunes.
  Si una edición que ya llegó sale otro día (quedó en reintento, o llegó después de las 14:00), el detalle dice solo «Edición del lunes 23/11.»: no se explica por qué, para no decir nada falso.
  Lenguaje neutro: nunca «tarde», «demora» ni «atraso».
- `titulo`: el `title` de la casilla, entero: «Sale el dato de la quincena, a las 08:05. Edición del lunes 23/11: no es hábil el lunes 23/11, Día de la Soberanía Nacional.».
- El día de la edición va sin el año («lunes 23/11»); el motivo, como lo arma hoy la regla.

## El servidor

- `listarEventos` (`controllers/miEspacioEventosController.js`) suma dos claves al final de la respuesta, después de `frase_del_mes`:
  - `dato_quincena`: los ítems cuya `fecha` cae en el rango pedido (`desde` a `hasta`), por fecha.
  - `dato_quincena_activo`: el envío automático prendido (`true`/`false`), para la muestra de la leyenda.
- El calendario sale de las filas de feriados que el pedido ya lee (`calendarioCon(filasFeriados)`): no se vuelve a leer la tabla.
- Lo que se lee de más (el interruptor con `leerConfig` y la última regular con su correo y sus filas automáticas) va aislado en un try/catch, como «Hoy y mañana» del Resumen: si falla, `dato_quincena: []`, `dato_quincena_activo: false`, el error a la consola y la agenda responde igual.
- Una consulta nueva en `services/datoQuincenaCorreoDatos.js` si hace falta (la última regular con su id; su correo y sus filas, con las que ya existen). Solo lectura y parametrizada.
- La importación de las reglas del correo va en el controlador, no en `miEspacioEventosReglas.js`: `datoQuincenaCorreoReglas.js` importa `emailTemplates.js`, que importa las reglas de eventos, y se cerraría un ciclo.
- `frase_del_mes` no cuenta el dato. Nada cambia en «Hoy y mañana» del Resumen, en el mail diario ni en los recordatorios.
- Nada personal: son las mismas fechas para todos; ningún email, nombre ni dato de la lista del correo.

## La página (`public/js/mi-espacio.js`, `public/mi-espacio.html`)

- `cosasPorDia`: cada ítem va como `{ clase: 'dato', texto, titulo }`, sin `evento_id`, después de los feriados y antes de los eventos.
- `htmlDeCosa`: el `<span>` del dato lleva su `titulo` en el `title`; sin `evento_id` no es un botón y el clic cae en la casilla (`tocarUnDia`), como el feriado.
- La celda no cambia de fondo (solo el feriado pinta la celda).
- El día elegido (`htmlDelDiaElegido`) y «Próximos» (`gruposDeProximos`): después de lo de todo el día y antes de los eventos, con `hora`, `nombre` y `detalle`; sin botón.
  En «Próximos», hoy y mañana muestran la hora; esta semana y más adelante, el día y la hora delante del nombre, como un evento.
- `ICONOS_DEL_MES` suma `dato` (Lucide «newspaper», el de la página El dato de la quincena).
- La leyenda suma «El dato de la quincena» (`#ag-leyenda-dato`, oculta de entrada), que `pintarMesDeEventos` muestra con `dato_quincena_activo === true`.
- En el teléfono, el punto del dato con su color.
- CSS en el `<style>` de `mi-espacio.html`, con tokens nuevos en `:root`: `--sg-turquesa: #1E5C56`, `--sg-turquesa-borde: #2B7A73`, `--sg-turquesa-fondo: #DCF1EE`.
  Texto sobre su fondo 6,57:1; borde y punto contra blanco 5,08:1 y contra el cielo 4,26:1.
  Reglas: `.me-ev.dato, .me-leyenda .dato`, `.me-fila-del-dia.dato .me-elegido-cosa`, `.me-prox-icono.dato` y `.me-puntos .dato` (640 px). El alto contraste ya cubre los puntos.
- Todo texto del servidor pasa por `esc`.
- Sube `VERSION_MI_ESPACIO` en `tests/paginas.test.js` y el `?v=` de `mi-espacio.js` en `mi-espacio.html`.

## Tests

- Reglas (`tests/dato-quincena-correo-reglas.test.js`), con un hoy y un ahora fijos y los feriados del 23/11 y del 07/12 y 08/12:
  - `proximasEdiciones` sin la opción da lo mismo que hoy; con `desdeLaSalida` el martes 24/11 incluye la del 23/11.
  - `datoQuincenaEnMiEspacio`: apagado, ninguna; calendario caído, ninguna; sin regulares, desde `PRIMERA_EDICION`; cinco en total; la del 23/11 el 24/11 con su motivo; la del día programada a las 08:05 y a las 14:00 (con la hora de la consulta, como la pastilla); en reintento, con la próxima corrida; una que sale otro día que el de la serie, sin motivo; enviada hoy («Salió…», con la hora de su primer envío); enviada ayer, no va; no enviada, no va; los textos exactos.
- API (`tests/mi-espacio-eventos-api.test.js`): las claves de la respuesta en su orden; un lector y un colaborador reciben `dato_quincena` y `dato_quincena_activo`; si falla la lectura del dato, la agenda responde 200 sin chips.
- Página (vm, `tests/mi-espacio-frontend.test.js`): `cosasPorDia` (el orden y sin `evento_id`), el `span` con su `title`, el día elegido y «Próximos» (el orden y las horas), el escapado, la leyenda que aparece y desaparece, los íconos del mes, y el clic en el chip que abre «Nuevo evento» con ese día en la compu.
- `tests/paginas.test.js`: la versión, la leyenda con su muestra nueva, las clases de los chips y los contrastes (4,5:1 del día elegido y 3:1 de los puntos).
- Lo que se arma con las funciones del servidor en los tests (`respuestaDeEventos`) suma las claves nuevas.

## Documentos

- `docs/temas/mi-espacio-agenda-mes.md`: el chip del dato, su color, la leyenda y el clic.
- `docs/temas/mi-espacio-agenda.md`: las dos claves nuevas de `GET /mi-espacio/eventos`.
- `docs/temas/dato-quincena-correo.md`: que las próximas ediciones también las usa la agenda, la opción `desdeLaSalida` y por qué no se copia la regla.
- Un renglón por oración; lo vigente, sin historia.
- `.claude/rules/` no cambia (no nace un tema).

## Despliegue

Sin SQL ni variables nuevas. Un kit con los archivos cambiados (`~/rpad-kits/RPAD-deploy-dato-quincena-en-mi-espacio/`), con Restart, contra el commit que diga la coordinadora.

## Lo que no se hace

- No cambia la pestaña Correo ni su regla de hoy.
- No hay detalle propio del dato en la agenda: no se abre nada.
- No va en el mail diario, en «Hoy y mañana» ni en los recordatorios.
- No se guarda nada en la base.

## Decisiones de la sesión (para que el usuario las revise)

- La hora con dos cifras y en negrita en las listas («08:05»), como los eventos de la agenda; la pestaña Correo sigue con «8:05».
- La hora de una edición que ya llegó es la de la próxima corrida que la manda (la de su pastilla), y el detalle no explica por qué sale a las 14:00 u otro día: la causa puede ser un reintento y la agenda no la adivina.
- Después del envío, «Salió el dato de la quincena».
- La muestra de la leyenda solo con el envío prendido.
- En la casilla, el dato va después del feriado y antes de los eventos; en las listas, después de lo de todo el día y antes de los eventos.
- `frase_del_mes` no lo cuenta.
- Si la lista del correo está vacía, igual se muestra: lo que decide es el interruptor.
