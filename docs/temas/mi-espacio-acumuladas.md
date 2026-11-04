# Mi espacio: las horas acumuladas de contrato

Lo que no se usó en su mes pasa a las «Horas acumuladas», sin años ni vencimiento, y se usa desde «Cargar licencia».

Historia y motivos, en las specs:
- `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-design.md`

## Horas acumuladas

- Las horas acumuladas de contrato (spec 2026-11-03-mi-espacio-horas-acumuladas; decisiones del usuario del 03/11/2026;
  la maqueta que eligió, la opción B, «Dos números», con un nombre y unas salidas inventados, en `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-mockups/`): una persona de contrato con 6,5 horas a favor para noviembre y 1,5 de antes no podía tomarse el día entero, 7 horas (dos licencias no comparten un día, y lo no utilizado se usaba solo con un uso autorizado aparte).
  Desde entonces lo que no se usó en su mes pasa a las **«Horas acumuladas»** (reemplaza en contrato a «Horas no utilizadas previamente»), que **no vuelven a cero el 1/1, no vencen y no tienen tope**, y se usan desde «Cargar licencia» → «Horas a favor», solas o junto con las del mes, con la autorización del Director General (Mi espacio no la controla: la nota en Word es el pedido).
  **Planta no cambia nada**: sus francos no utilizados siguen por año, con su reinicio (`noUtilizadasDe`), su uso autorizado y sus textos.
  Antiobjetivos: que un día de 7 horas armado con acumuladas no cuente como día entero, que una hora se cuente dos veces (como hora a favor de su mes y como acumulada, o en dos cargas), que el formulario ofrezca un tope que no es el de la fecha elegida, que algo de planta cambie, que una pestaña abierta con la página anterior guarde mal y textos con «perdiste», «vencieron» o un reproche para las acumuladas (no vencen).
  - La cuenta (spec, 4;
    `acumuladasDe(estado, { hoy, feriados })` de `services/miEspacioReglas.js`, que `calcular` suma como `acumuladas`, después de `noUtilizadas` —que en contrato queda `{}`—; fuera de contrato o sin un hoy válido, null): una sola por persona, sin años, `{ saldo: { cantidad, quedan }, meses: [{ mes_de_uso, mes_trabajado, cantidad, quedan }], usos: [{ id, fecha, cantidad }], entra, sale, quedan }`.
    **Entra** el saldo inicial (`mi_espacio_saldos`, concepto `horas_no_utilizadas`, el del año del arranque, que ahora vale para siempre:
    `saldoInicialDeHoras`) y lo que quedó sin usar de cada mes de uso que ya terminó (el `no_utilizadas` de `horasAFavorDe`), de cualquier año, salvo los `antes_del_arranque` (ya están en el saldo); con «Sumar al mes anterior», cada mes es el de su cuenta.
    **Sale** la parte acumulada de cada carga de horas a favor desde el arranque (`horasAcumuladasDe(fila)`: el `horas_acumuladas` de una fila `horas_a_favor` si es un número positivo, nunca más que `horas`; si no, 0) y las horas de los usos autorizados de contrato que ya estén cargados, de cualquier fecha, pasada o futura (lo de antes del arranque no descuenta).
    **Queda** lo que entra menos lo que sale, descontado primero del saldo y después de los meses, de los más viejos a los más nuevos, sin negativos.
    **«Las de hoy»** (decisión 7): un mes que todavía no terminó no suma, aunque la carga sea de una fecha en que ya habrá terminado (el 03/11, un día de diciembre usa solo lo que había; desde el 01/12, también lo que sobró de noviembre).
    Solo la parte del mes de una carga (`horasDelMesDe(fila)`, `horas` menos la acumulada, nunca menos de 0) es un uso de su mes en `horasAFavorDe` (una toda acumulada no lo es): así ninguna hora cuenta dos veces, y una carga tarde en un mes que ya terminó baja sola las acumuladas.
    Si lo que sale pasa a lo que entra por un cambio posterior (una salida vieja corregida, el saldo inicial bajado), `faltantesDe` suma al final `{ clave: 'acumuladas', campo: 'horas_acumuladas', medida, texto, mensaje }`, «Revisá tus horas acumuladas: usaste 2 horas y había 1,5.» («… y no había ninguna.», `textoFaltanteDeAcumuladas`), con el `mensaje` de `textoQuedanAcumuladas` («Te quedan 1,5 horas acumuladas.», «Te queda 1 hora acumulada.» o «No te quedan horas acumuladas.»):
    en ámbar en el Resumen, nunca frena nada salvo una carga que lo agranda (`problemaDeLaCarga`, con `mensajeDeLaCarga` y lo que ya usaba la fila que se corrige, `quedanDeLasAcumuladas`).
    Reemplaza en contrato a `uso:<anio>`, que queda solo para planta.
  - «Horas a favor» con los dos números (spec, 5 y 7):
    `validarLicencia`, en el paso de las horas (`acumuladasDeLaCarga`), suma `horas_acumuladas` a `datos`: solo en `horas_a_favor`; sin la clave, null, '', solo espacios o 0, null (todo del mes: una pestaña con la página anterior guarda como antes); un número, o un texto que lo es ('0.5'), de 0 a `horas` y de a media hora, ese número;
    otro valor (negativos, cuartos, '0,5', booleanos, más que `horas`) da 400 `acumuladasMedias`, «Las horas acumuladas van de a media hora, hasta el total.», en `horas_acumuladas`, después del error de `horas`; en otro tipo, también en planta, se ignora y se guarda NULL.
    `horas` sigue siendo el total, de 0,5 a 7 (`horasMedias`), y con 7 es de día entero: pasa a Configuración y se ve en «Hoy no están».
    Los topes de los dos campos:
    `topesDeHorasAFavor(estado, fecha, { hoy, feriados, editadaId })` → `{ mes, mes_texto, del_mes, acumuladas, termino }` (el mes de uso de la fecha y su nombre en minúscula, el rótulo «De noviembre»; lo que le queda, `max(0, a_favor − usadas)`; lo que queda hoy de las acumuladas —con una fecha anterior al arranque, 0: lo de antes ya está en el saldo inicial y `acumuladasDe` no descontaría la parte acumulada, así que la página muestra el campo «Horas» de siempre—;
    y si ese mes ya terminó desde el arranque —uno cuyo mes de uso terminó antes del arranque, `antes_del_arranque`, da `termino` false y `del_mes` sin el tope de las acumuladas: lo que le sobraba ya está en el saldo inicial y tomarlo no las baja; revisión final, 2—; con un `calcular` del estado sin la carga de `editadaId`, así cuentan lo que ya usaba la que se corrige;
    null fuera de contrato, sin arranque, sin un hoy válido o sin una fecha), que sirve **`GET /api/mi-espacio/horas-a-favor/topes?fecha=&id=`** (`verTopesDeHorasAFavor`, con `authMiddleware`, en `RUTAS_MI_ESPACIO` y en las lecturas del lector y del colaborador: sin `fecha`, hoy; una que no pasa `esFechaIso` —también una repetida o el 30/02— da 400 `MENSAJES_MI_ESPACIO.fecha` en `fecha` antes de leer nada; sin modalidad, `{ modalidad: null, mensaje }`;
    `id` pasa por `idPositivo` y solo cuenta si es una licencia activa de quien pide —una ajena se ignora sin decir nada: la respuesta es la misma que sin él—; en planta o sin arranque, `data: null`; un 500, «Error al obtener las horas a favor»).
    La página la pide aparte del cálculo porque arma los campos antes de tener las horas.
    **Una carga en un mes que ya terminó** (decisión 9: el 05/12 se carga el 20/11, o se corrige una del 06/11) sale de su mes, como si se hubiera cargado a tiempo, pero lo que le sobraba a noviembre ya pasó a las acumuladas el 01/12: con `termino`, `del_mes` no pasa de `acumuladas`, y lo que se toma del mes también baja las acumuladas (el tope de «Acumuladas» es lo que queda menos lo elegido del mes);
    si lo que sobraba ya se usó como acumuladas en otro día, «De noviembre» ofrece solo lo que sigue libre (puede ser 0).
    Qué frena lo sigue decidiendo `loQueFrena`, y `errorDeLasHoras` (en `evaluarLicencia`) pone el error en su campo: el de un uso autorizado, en `horas`; el de unas horas a favor de contrato que frenan por `horas:<mes>` o `acumuladas`, con los topes de su fecha: si la parte del mes pasa de `del_mes`, en `horas` con el texto de siempre y ese número («En noviembre de 2026 te quedan 6,5 horas a favor.»;
    en una carga tarde, con lo que queda de verdad, aunque por dentro lo que se pasa sea la cuenta de las acumuladas), y si no, en `horas_acumuladas` con `textoQuedanAcumuladas` de lo que queda (con `termino`, menos la parte del mes), nunca negativo.
    Unas horas a favor anteriores al arranque con parte acumulada no se guardan (`validarComoLicencia`, con `antesDelArranqueConAcumuladas`): 400 en `horas_acumuladas` con «No te quedan horas acumuladas.» (`textoQuedanAcumuladas(0)`); sin parte acumulada, o desde el arranque, nada cambia.
    El cálculo (`textoDeLasHorasConAcumuladas`, y `textoDeLosDias`, «7 horas, el día entero» con una parte acumulada):
    «**7 horas, el día entero.** Usás 6,5 horas a favor de noviembre y 0,5 de tus horas acumuladas.
    Te queda 1 hora acumulada.»; todo acumulado, «**1,5 horas.** Usás 1,5 horas acumuladas.
    No te quedan horas acumuladas.» («Usás 1 hora acumulada.»); sin parte acumulada, como antes.
    La columna, en «Base de datos»; la página, en la convención de `mi-espacio.js`.
  - El «Te quedan 0» con un error (spec, 5, decisión del constructor): con un error, la vista del cálculo (`vistaDe`, con `contexto.conError`) deja `queda_texto` en '' en todo tipo, así el recuadro dice solo el total y no «Usás 7 horas a favor de noviembre.
    Te quedan 0.» al lado del error (también en la franquicia de planta, «Te quedan 0 de 42 horas de franquicia.», la médica y el uso autorizado; sin error, lo de siempre): es un arreglo, no un cambio de planta.
  - El uso autorizado de contrato (spec, 8): la página ya no lo ofrece en contrato (el botón de la tarjeta abre «Cargar licencia»).
    Los que haya (en producción no había ninguno el 03/11/2026) siguen contando como salida de las acumuladas, se ven en la lista y se corrigen o se borran con su formulario de siempre, y el servidor los sigue aceptando de contrato (una página vieja), con el error en `horas` y su `queda_texto`, «Te quedan 1,5 horas acumuladas.
    Se descuentan primero las más viejas.».
    Sin migración de datos.
    Planta no cambia:
    «Registrar un uso autorizado» de un franco no utilizado sigue igual.
  - Lo que se ve (spec, 10;
    `services/miEspacioResumen.js`, con la cuenta de `calculo.acumuladas`, leída con tolerancia, `acumuladasDel` y `quedanAcumuladas`, nunca menos de 0; planta, sin cambios): la opción del tipo de «Cargar licencia» (`quedaDelTipo`), «Quedan 6,5 h en noviembre · 1,5 acumuladas» («· 1 acumulada»; sin horas del mes, «Quedan 0 h en noviembre · 1,5 acumuladas»; sin acumuladas, como antes);
    la pastilla gris del final del Resumen (`previoDe`), «1,5 · Horas acumuladas · De meses anteriores» («1 · Hora acumulada»; sin acumuladas, no va); en la tabla de los meses de la pestaña Horas extras, la situación de un mes que terminó con horas sin usar (`situacionDeLasHoras`), «1,5 h pasaron a acumuladas» («1 h pasó a acumuladas»), en gris; y la tarjeta, `acumuladasDeLaTabla` (reemplaza a `noUtilizadasDeLaTabla`;
    la clave sigue siendo `tabla.no_utilizadas`), `{ titulo: 'Horas acumuladas', total_texto, filas, nota, uso_autorizado: { puede, texto } }`: el total a la derecha, sin año («1,5 horas»), de dónde quedan (cada mes, del más nuevo al más viejo, «Noviembre 2026 · 2 horas · de las extras de octubre», y «Del saldo inicial»), «No vencen: quedan hasta que las uses.» y `TEXTO_PARA_USAR_ACUMULADAS`, «Si te autorizan a tomarlas, sumalas en «Cargar licencia», con las horas a favor del mes o solas:
    se descuentan primero las más viejas.», con el botón «Usar horas acumuladas»; sin nada, «No tenés horas acumuladas.» y sin botón (`puede: false`).
    La tarjeta no cambia con el año elegido arriba: es la cuenta de hoy (`usoAutorizadoDe` quedó solo para planta).
    En la lista, la fila de unas horas a favor suma `horas_acumuladas` (su parte acumulada, para el formulario; ninguna otra fila trae la clave) y, con una parte acumulada, `de_licencias_texto` dice de dónde salen sus horas (`textoDeLasAcumuladasDeLaCarga`:
    «6,5 de noviembre y 0,5 acumuladas.», con el mes de su fecha;
    «1 acumulada.»; o «Todas acumuladas.», con su punto, como los demás textos de ese campo, que la página pone uno detrás del otro; sin parte acumulada, ''); la insignia sigue siendo «Horas a favor», y el segundo paso muestra la fila así.
    La fila del saldo inicial (`saldoInicialDe`) dice «Tenías 1,5 horas acumuladas.» («1 hora acumulada»), y el campo de contrato de «Mis vacaciones y saldos» (`camposDelSaldoInicial`) se llama «Horas acumuladas» (el mismo concepto `horas_no_utilizadas`, de 0 a 200, de a media hora).
    «Vence pronto» y el email de vencimiento no cambian: las acumuladas no vencen, así que no avisan.
  - Lo que no cambia (spec, 11): planta entera, la planilla, «Sumar al mes anterior», cómo se cuentan las horas extras y las horas a favor del mes (vencen al final de su mes de uso y avisan como antes), las demás licencias, las vacaciones, los días restituidos, la regla de un día, una licencia, Configuración, las Notas Digitales, la agenda y la corrida de las 8:15.

## La página

Desde las horas acumuladas de contrato (spec 2026-11-03-mi-espacio-horas-acumuladas, 5 y 10; la opción B, «Dos números», de la maqueta que eligió el usuario, con datos inventados, en `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-mockups/`;
la regla, en «Mi espacio: licencias y horas extras»), «Cargar licencia» → «Horas a favor» de contrato, con horas acumuladas (o al corregir una carga que ya las usa), reemplaza el campo «Horas» por dos `<select>` en la misma fila, dentro de `#ml-dos-horas` (oculto de entrada, en `#ml-grupo-horas`):
«De noviembre» (`#ml-horas-del-mes`, con su rótulo `#ml-horas-del-mes-rotulo` y su tope al lado, «(quedan 6,5)», en `#ml-horas-del-mes-tope`) y «Acumuladas» (`#ml-horas-acumuladas`, con `#ml-horas-acumuladas-rotulo` y «(tenés 1,5)» en `#ml-horas-acumuladas-tope`), cada uno con su error debajo (`#ml-horas-del-mes-error` y `#ml-horas-acumuladas-error`, en su `aria-describedby`), y debajo el total en negrita (`#ml-horas-total`, en el `aria-describedby` de los dos, antes del resto:
revisión final, 3) y la ayuda «Las horas acumuladas se usan con la autorización del Director General.» (`#ml-horas-acumuladas-ayuda`, también en el `aria-describedby` de «Acumuladas»); en ese modo se ocultan el rótulo de «Horas» (`#ml-horas-rotulo`), `#ml-horas` y su error.
Sin acumuladas (ni ahora ni en la carga que se corrige), el formulario es el de antes.
Lo puro:
`lasDosHoras(topes, elegidas, guardadas)` → `{ delMes: { tope, valor }, acumuladas: { tope, valor } }` («De …», hasta `del_mes` y nunca más de 7;
«Acumuladas», hasta `acumuladas` —con `termino`, menos lo elegido del mes, que ya es parte de ellas— y nunca más de 7 menos lo del mes; lo elegido baja a su tope; sin topes, los dos hasta 7;
con `guardadas`, las partes de la carga que se corrige mientras la fecha siga en su mes, `partesGuardadas`, cada tope es al menos la suya: abrir «Editar» nunca baja lo guardado, y el faltante lo dice el cálculo del servidor), `htmlDeOpcionesDeLasDos(tope, elegida)` (de 0 al tope, de a media hora), `textoDelTotalDeLasDos` («Total: 7 horas, el día entero.», «Total: 2 horas.», «Total:
1 hora.» o, sin nada elegido, «Elegí cuántas horas tomás.»), `rotulosDeLasDos(topes, desde)` y `htmlDelRotuloDelMes` (con el `mes_texto` del servidor, escapado; los topes de los rótulos, de a media hora y sin el tope de 7 de las opciones, `mediaHoraDelRotulo`: con 8 acumuladas, «(tenés 8)», como la tarjeta, revisión final, 1;
sin topes —mientras llegan o si no llegaron—, el mes de la fecha elegida, con `nombreDelMes`, o «Del mes» sin fecha, y sin topes: nunca uno viejo), `mediaHoraHasta` y `horasElegidas`, `acumuladasValidas(valor, horas)` (copia de `acumuladasDeLaCarga`, que `erroresDeLicencia` usa en `horas_acumuladas` solo en las horas a favor y solo si `horas` está bien, como el servidor), `valoresDeLicencia` (suma `horas_acumuladas`:
la parte acumulada de una fila de horas a favor, como texto, o '') y `cuerpoDeLicencia` (manda `horas_acumuladas`, un número, solo en las horas a favor y con un valor: en el modo de un campo el cuerpo es el de antes, sin la clave).
Lo que toca el DOM:
`pedirLosTopes(formulario, { esperar })` (al abrir, al cambiar de tipo y, 300 ms después del último cambio de `#ml-desde`, `ESPERA_DEL_CALCULO`, solo en las horas a favor: numera el pedido, `pagina.pedidos.topes`, deja los tres selects de horas deshabilitados, los rótulos con el mes de la fecha y sin topes, y «Guardar» deshabilitado hasta que llegan) y `traerLosTopes` (`GET /mi-espacio/horas-a-favor/topes` con `fecha` si `#ml-desde` es una fecha —sin una, los de hoy, que dice el servidor:
el reloj del teléfono no cuenta— e `id` al corregir; una respuesta vieja, de otro pedido o de otra apertura, se descarta; con un 401, al login; con otra falla, sin topes; al llegar, `dosHoras` es tener acumuladas o que la fila ya las use, y se dibuja y se pide el cálculo);
`pedirCalculo` no pide mientras se esperan los topes (`cargandoTopes`) ni con un error en `horas_acumuladas`;
`pintarLasDosHoras` (la llaman `pintarCamposDelTipo`, `abrirLicencia` y el `change` de los dos campos, que también limpia sus errores y vuelve a pedir el cálculo) y `horasDelCampo` (en el modo de dos campos, el total, para «Mostrar» y `valoresDelFormulario`).
El formulario suma `topes`, `cargandoTopes`, `temporizadorDeTopes` (que `cerrarFormulario` limpia) y `dosHoras`.
Un error del servidor con campo va a su control:
`FORMULARIOS.licencia.campos.horas_acumuladas` es `ml-horas-acumuladas`, y `controlDelCampo('licencia', 'horas')` da `ml-horas-del-mes` en el modo de dos campos (`pintarCalculo` usa `controlDelCampo`, así también el error del cálculo va a su campo).
En la pestaña Horas extras, la tarjeta de contrato (`htmlDeNoUtilizadas`, con el `titulo` y la `nota` del servidor, escapados —sin ellos, los de antes—, y `htmlDelUsoDeLasAcumuladas(uso)`) dice el texto del servidor y, con `puede` en el `true` literal, «Usar horas acumuladas», un `<button>` con `data-usar-acumuladas="horas_a_favor"` que `alTocarHoras` lleva a `abrirLicencia({ tipo:
'horas_a_favor', volverA })` (el foco vuelve al botón al cerrar, e `IDENTIDADES_DEL_FOCO` suma `data-usar-acumuladas`); en contrato ya no se ofrece «Registrar un uso autorizado» (uno ya cargado se sigue abriendo desde su «Editar»; planta, `htmlDelUsoAutorizado` con `data-abrir="uso"`, no cambió).
Copias atadas por tests de paridad:
`MENSAJES_FORMULARIOS.acumuladasMedias` y `acumuladasValidas` (con `validarLicencia`, cuatro totales por veinte valores).
Los estilos, en el `<style>` de `mi-espacio.html`, solo con los tokens `--sg-*`:
`.me-dos-horas` (dos columnas `1fr 1fr`; en 640 px, una), `.me-dos-horas-total` (en negrita, `--sg-tinta`) y `.me-dos-horas .form-hint`, a todo el ancho.
`VERSION_MI_ESPACIO` pasó a `'20261221'` (de `'20261220'`, la de los días restituidos).

## Tests

Desde las horas acumuladas de contrato (con una persona de contrato inventada y sin nombre: arranque el 28/10/2026, 1,5 horas de saldo inicial y 6,5 horas a favor para noviembre;
en la página, la persona de contrato de los fixtures): en `mi-espacio-reglas.test.js`, `horasAcumuladasDe` y `horasDelMesDe` (también con valores raros y sin pasar del total), la cuenta el 03/11, el 30/11 y el 01/12, sin reinicio en 2027, los meses de antes del arranque, una carga del mes y acumuladas (cada lado descuenta lo suyo, nunca dos veces), las más viejas primero y sin negativos, el uso autorizado ya cargado que sigue contando,
el faltante `acumuladas` (sus dos textos y su lugar al final), `calcular`, `validarLicencia` con `horas_acumuladas` en sus bordes, `topesDeHorasAFavor` (con y sin `editadaId`, otro mes y la carga tarde con `termino`), `evaluarLicencia` (los textos del cálculo, cada error en su campo, la corrección y la carga tarde), «lo que ya estaba no frena», el arreglo del «Te quedan 0» en todo tipo y que planta no cambia;
en `mi-espacio-resumen.test.js`, la pastilla, la opción del tipo, la fila de la lista, el saldo inicial, la tarjeta (sin reinicio, la misma con cualquier año, todas usadas, un saldo bajado después y sin acumuladas) y «pasaron a acumuladas»;
en `mi-espacio-api.test.js` (Docker), la columna en `estadoDe` y `estadosDe` y el `describe` de las horas acumuladas, con fechas relativas a hoy: 7 horas con 0,5 acumuladas se guarda, pasa a Configuración, se ve en «Hoy no están» y su nota dice la frase de la spec; 7 con 1,5 sí, y 8 con 0,5 y 7 con 2, el 400 en su campo, sin guardar nada; los valores raros; sin la clave, como antes; la franquicia de planta que la ignora; la corrección; el doble envío; una carga a futuro con «las de hoy»;
la carga tarde en un mes que ya terminó;
`GET /mi-espacio/horas-a-favor/topes` (sin fecha, con un `id` propio, ajeno o dado de baja, las fechas que no sirven, planta, sin arranque, el lector y el 500); y lo ajeno;
en `mi-espacio-frontend.test.js`, las paridades (`acumuladasMedias` y `acumuladasValidas`), lo puro (`valoresDeLicencia`, `cuerpoDeLicencia` en los dos modos, `lasDosHoras` —también con lo guardado—, las opciones, el total, los rótulos y el escapado), la tarjeta con su botón y, con el DOM y el `fetch` falsos, abrir con acumuladas, cambiar la fecha (los campos deshabilitados mientras llegan los topes y la respuesta vieja que se descarta), el total y «Mostrar»,
sin acumuladas o con los topes en 500 (el campo de siempre y el cuerpo sin la clave), `termino`, los 400 en su campo, corregir sin bajar lo guardado y en otro mes, pasar a otro tipo y volver, y los estilos (dos columnas, una en 640 px, y 4,5:1 o más); en `schema.test.js`, la columna después de `horas`, la migración dos veces desde la estructura de main y la vuelta atrás; en `permisos.test.js`, la ruta nueva en `RUTAS_MI_ESPACIO` y en las lecturas del lector y del colaborador;
y en `paginas.test.js`, `VERSION_MI_ESPACIO` en `'20261221'` y los ids nuevos de `#modal-licencia`.

## Archivos de tests

`mi-espacio-reglas.test.js`, `mi-espacio-resumen.test.js`, `mi-espacio-api.test.js`, `mi-espacio-frontend.test.js`, `schema.test.js`, `permisos.test.js`, `paginas.test.js`
