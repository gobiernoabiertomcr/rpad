# Feriados en todo el sistema: un solo calendario de días hábiles

Fecha: 27/10/2026. **Estado: aprobada por el usuario el 27/10/2026** (revisada antes por un agente que la leyó como quien la construye). Salió de la simulación del 27/10/2026 (las corridas del 28/10/2026 al 05/02/2027 con licencias cargadas desde Mi espacio) y de la charla con el usuario del mismo día. Sigue a la spec de Feriados (`2026-10-26-feriados-design.md`), cuya sección 8 anotaba qué mirar en cada módulo, y la reemplaza en su no objetivo: «el resto del sistema no cambia en esta etapa».

## Por qué

El RPAD tiene hoy dos calendarios.
- **Mi espacio** cuenta los días hábiles con los 9 feriados fijos y con la tabla `feriados` de Configuración → Feriados: el Carnaval, Semana Santa, los trasladables, los de Chubut, los de Comodoro y los no laborables.
- **Todo lo demás** cuenta solo con los 9 fijos (`esDiaHabil` y `FERIADOS_FIJOS`, `services/notasDigitalesCalendario.js`).

Eso choca con una regla del usuario: **ningún email automático sale en un día que no es hábil.** Con los feriados de la tabla de producción:
- **El lunes 02/11/2026** es feriado de Chubut (trasladado del martes 03/11, que es hábil). Correos → Estado anuncia para ese día el aviso interno de diciembre y la reiteración de noviembre.
- **El lunes 23/11** (Día de la Soberanía, trasladado) sale el aviso externo de diciembre.
- **El lunes 07/12** es no laborable. Si el firmante tiene licencia desde el 09/12, ese día sale la víspera. Con la tabla, la víspera es el viernes 04/12.
- **El lunes 09/11** (visita del Papa) no tiene nada previsto, pero la corrida lo toma como hábil.

La simulación encontró además que **Correos → Estado anuncia fechas que la corrida no cumple** cuando la persona autorizada del firmante está de licencia. Con el firmante de vacaciones del 09/12 al 08/01 y la autorizada del 04/01 al 15/01, el Estado anunció hasta el 31/12 las reiteraciones de enero para el 04/01, y salieron el 11/01.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Un solo calendario de días hábiles en todo el sistema** (decisión del usuario): los 9 fijos más la tabla, lo mismo que muestra la pestaña Feriados (`configuracion.html#feriados`).
- **Lo que anuncia una corrida es lo que la corrida hace** (decisión del usuario): Correos → Estado, la vista previa y la prueba, Configuración → Licencias y Mi espacio dicen el día real en que sale cada cosa, también con feriados, con licencias seguidas y con la persona autorizada de licencia.
- **Dos tandas, con un kit cada una** (decisión del usuario):
  - **Tanda 1:** las corridas de las 8:15 y de las 14:00 y todo lo que las anuncia. Apunta al 02/11/2026; si no llega, ese día se cubre con el plan B (sección 9). **Tiene que estar en producción antes del jueves 03/12/2026** (la víspera del 04/12).
  - **Tanda 2:** Métricas, el Ciclo de vida del dato, la foto del 31/12, el Informe anual y la Agenda de pedidos. **Tiene que estar en producción antes del 10/01/2027,** el día en que se saca la foto de 2026.

**No objetivos**
- **Los hallazgos 2 y 3 de la simulación** (avisar al firmante que la autorizada va a faltar; aclararlo en la nota de autorización). Decisión del usuario: «estamos todos en el mismo espacio físico», se enteran en persona.
- **Del hallazgo 1, la advertencia anticipada y el texto «sin autorizado» de la corrida.** Queda solo que las fechas del Estado sean las reales (decisión del usuario).
- **No cambia cuándo vence nada:** la reiteración sigue a los 20 días corridos (`DIAS_PARA_REITERAR`), la ventana del aviso sigue en 40 y 60 días corridos (`VENTANA_DIAS`) y los vencimientos siguen siendo fin de mes.
- No se cargan feriados de 2025 que falten (la tabla los admite desde el 01/01/2025; si el usuario los quiere, los carga en la pestaña).

**Antiobjetivos**
- **Que una corrida pierda algo.** Un aviso, una reiteración, la víspera de una licencia o un email de los 40 días que no sale nunca.
- **Que algo salga dos veces:** el email de los 40 días no es idempotente.
- **Que las dos corridas cuenten distinto.** La de las 8:15 (nota de auditoría) y la de las 14:00 (recordatorio) comparten la regla del canal (`canalDelCambio`). Si una usara la tabla y la otra no, un cambio podría quedarse un día sin recordatorio y sin nota.
- **Que lo ya enviado cambie,** o que cambie una foto ya sacada.
- **Que la corrida se caiga** porque la tabla no se puede leer.

## 1. El calendario único

Una sola pieza, que reciben todas las partes. Lo que sigue es la forma; los nombres exactos los elige quien lo construye.

- **Una sola implementación de las derivadas.** Hoy `proximoDiaHabil`, `diaHabilAnterior`, `ultimoDiaHabilHasta`, `primerDiaHabilDelMes`, `rangoDeAviso`, `diasHabilesTranscurridos` y `sumarDiasHabiles` están escritas sobre `esDiaHabil`. Se escriben una vez, sobre un predicado («¿es hábil?») que se recibe, por ejemplo `derivadasDe(esHabil)`, con un tope de 366 vueltas en cada búsqueda: con la tabla, un año entero cargado como feriado daría un bucle infinito.
- **`CALENDARIO_FIJO`:** el objeto con las derivadas sobre `esDiaHabil`. Los nombres que exporta hoy `notasDigitalesCalendario.js` siguen existiendo y se comportan exactamente igual (un test los compara con una copia congelada de las de hoy, también con entradas que no son fechas). `esDiaHabil` y `FERIADOS_FIJOS` no cambian: son la base.
- **`calendarioCon(filas)`** (en `services/feriadosReglas.js`, que ya importa el calendario fijo: no hay ciclo de imports): el mismo objeto, con un predicado que es `esDiaHabil(fecha)` y que la fecha no esté en los feriados de su año. Los feriados de cada año se calculan con `feriadosDelRango` la primera vez que se pide ese año y se guardan (no hace falta saber de antemano el rango: los recorridos van sin tope hacia atrás y más de 366 días hacia adelante). El predicado no llama a `esFechaIso` (es 5 veces más lento).
- **El objeto dice de dónde salió:** `origen` (`'tabla'` o `'fijos'`) y `error` (null o el motivo).
- **`leerCalendario(conexion = pool)`** (en `services/feriadosDatos.js`): lee las filas con `filasDeFeriados(conexion)` y arma `calendarioCon(filas)`. Si la lectura falla, devuelve el calendario de los 9 fijos con `origen: 'fijos'` y el `error`, y lo anota en la consola. Nunca tira.
- **Cómo viaja.** En los objetos que ya pasan por las capas: `contextoDeCanal` lo devuelve dentro del contexto y así llega solo a `canalDelCambio` desde las dos corridas; `contextoDelDia`, `avisoDelDia` y las opciones de `personasPorDia`, `periodosSinAuditor`, `disponibilidadDelAutorizado`, `autorizadoParaLicencia`, `enviarAvisoAreas`, `enviarCambiosPendientes`, `enviarResumenAvisosRetenidos`, `ejecutarNotasDigitales` y `estadoNotas` suman la clave. Las funciones con parámetros posicionales lo reciben al final.
- **Valores por defecto.** Las reglas puras usan `CALENDARIO_FIJO` si no lo reciben: los tests de hoy pasan sin tocarlos. Los puntos de entrada (las dos corridas, el Estado, la vista previa, la prueba, los pedidos de Configuración y de Mi espacio) lo leen con `leerCalendario` si no lo reciben: producción nunca usa el fijo por olvido, y un test puede pasarle uno armado.
- **Un test que impide olvidarlo:** falla si algún archivo de `services/` o `controllers/` importa una derivada fija (o `esDiaHabil`) desde `notasDigitalesCalendario.js`, salvo el calendario mismo, `feriadosReglas.js` y, hasta la tanda 2, `metricasReglas.js` y `reportesAgenda.js` (la lista de excepciones se escribe en el test y la tanda 2 la achica).

## 2. Si la tabla no se puede leer

Decisión del usuario: **las corridas siguen con los 9 fijos y Correos → Estado lo marca en rojo.** Es casi imposible que falle solo esa tabla: si falla la base, falla todo.
- **Corrida de las 8:15:** el calendario se lee una vez, al principio, y el mismo objeto va a todos los pasos (el email de los 40 días, el resumen al superadmin, las Notas Digitales y `resultados.dia_habil`). Si cayó a los fijos, la corrida lo anota como un error («No se pudieron leer los feriados de Configuración → Feriados: la corrida usó solo los 9 fijos.»). Va entre los errores del resumen de las Notas Digitales, que escribe `registrarFin` (un `anotarEnLaUltimaCorrida` entre `registrarInicio` y `registrarFin` se pierde), y se anota antes de mirar si el envío está activo, así queda también con el envío apagado. La corrida queda «con errores» (la alerta roja de siempre, `corrida-con-errores`) y responde 207. Si la corrida termina «ocupada» (otra tiene el candado), el error queda solo en la respuesta y en la consola, como pasa hoy con la foto.
- **Corrida de las 14:00:** no tiene registro propio. El error va a la última corrida de las Notas (`anotarEnLaUltimaCorrida`), donde se ve en rojo hasta la corrida del día siguiente, y la respuesta es 207.
- **Correos → Estado:** lee el calendario en cada pedido. Si cayó a los fijos, suma la alerta `feriados-sin-leer`, de nivel error: «No se pudieron leer los feriados de Configuración → Feriados: las fechas de esta pantalla cuentan solo los 9 feriados fijos.».
- **Configuración → Licencias:** sigue con los fijos (lo que anuncia coincide con lo que haría la corrida ese día) y lo anota en la consola.
- **Mi espacio y los recordatorios de la agenda** siguen como decidieron sus specs: si no pueden leer los feriados, no mandan nada (mi decisión: no es parte de esta entrega).
- **Tanda 2:** Métricas en vivo, el Ciclo de vida y la Agenda de pedidos responden el error de siempre (500). **La foto nunca se saca con los 9 fijos:** si la tabla no se puede leer, no se saca y se reintenta en la corrida siguiente (como hoy, cuando la foto falla).

## 3. Tanda 1: las corridas

Todo lo que sigue cuenta con el calendario de la corrida.

**Corrida de las 8:15** (`controllers/notificacionesController.js`, `ejecutarNotificacionesDiarias`):
- **Email de los 40 días a las áreas** (`services/avisosDiariosService.js`): el «hoy es hábil» (`enviarAvisoAreas`) y el rango de vencimientos que avisa (`rangoDeAviso`, que también busca el próximo hábil) salen **del mismo calendario**. Si uno usara la tabla y el otro no, se perderían o se duplicarían vencimientos.
- **Resumen de avisos retenidos al superadmin** (`services/avisosSuperadminService.js`): no sale en un feriado de la tabla; sale el próximo día hábil.
- **Notas Digitales** (`services/notasDigitales.js`): la puerta del día (`correrPasos`), el `cuenta_desde` de los avisos anticipados, la víspera y el anticipo por la licencia del firmante (`autorizacionPendiente`, `anticipoPorLicencia`), los días libres de la persona autorizada (`disponibilidadDelAutorizado`, `diasHabilesLibres`), el aviso en su fecha (`pendientesEnSuFecha`, `diaDelAvisoEnSuFecha`: con el calendario, su regla de siempre, «su `cuenta_desde`, o el último día hábil anterior en que la persona autorizada está disponible», lleva un `cuenta_desde` que cae en un feriado de la tabla al hábil anterior, nunca fuera de la licencia; el `cuenta_desde` guardado no cambia y los 20 días de la reiteración se siguen contando desde él), la reiteración (el primer día con notas del mes) y la nota de auditoría (el canal con sus 2 días hábiles, los 5 días hábiles entre notas y la columna «días hábiles pendiente»; para que el contenido siga puro, el número llega calculado con el cambio).
- **El email de vencimiento de Mi espacio** ya usa la tabla: no cambia.
- **La foto** es de la tanda 2.

**Corrida de las 14:00** (`ejecutarNotificacionCambiosPendientes` → `enviarCambiosPendientes`): el «hoy es hábil», el canal de cada cambio (el mismo calendario que la nota de auditoría), el aviso a quien propone y su «hasta» (`proximoDiaConQuienAudite`) y los días sin auditor (`personasPorDia`, `periodosSinAuditor`, `agruparDiasSinAuditor`).

Lo que pasa en concreto con la precarga de producción:

| Día | Hoy (9 fijos) | Con la tabla |
|---|---|---|
| Lunes 02/11/2026 | Aviso interno del 31/12 y reiteración de noviembre | «Día no hábil»; salen el martes 03/11 |
| Lunes 09/11 | Corrida sin nada previsto | «Día no hábil» |
| Lunes 23/11 | Aviso externo del 31/12 | Sale el martes 24/11 |
| Lunes 07/12 | Víspera de una licencia del firmante desde el 09/12 | La víspera es el viernes 04/12 |
| 08 y 09/02/2027 (Carnaval), 23/02, 25 y 26/03 | Hábiles | No hábiles |

El email de los 40 días no cambia ningún vencimiento de fin de mes entre noviembre de 2026 y marzo de 2027: avisa al hábil anterior y ninguno cae en un feriado de la tabla. El primero que cambia es el del 31/07/2027 (el 21/06 es feriado: avisa el 18/06).

## 4. Tanda 1: lo que anuncia la corrida

**La regla.** Un día «con notas» es un día hábil (con el calendario) en que la corrida genera notas: el modo del día (`firmaParaFecha`) no es «sin autorizado» (licencia del firmante sin persona autorizada, o con la persona autorizada de licencia, desactivada o sin firma). Toda fecha que se anuncia se calcula con esa misma regla. `fechaDeVistaPrevia` ya recorre los días así (`tests/notas-licencias.test.js` la compara contra probar día por día); se generaliza a «el primer día con notas desde una fecha», que devuelve null si no hay ninguno en 366 días (hoy devuelve hoy). Para que el Estado no traiga en cada día las imágenes de las firmas, conviene una consulta del modo del día sin ellas, que `firmaParaFecha` también use.

**Correos → Estado** (`estadoNotas` y sus ayudantes):
- **Próximo aviso:** si la fecha del aviso cae en una licencia del firmante con días hábiles, cuya víspera (con el calendario) es la próxima corrida o después y ese día el modo es el del titular, se anuncia la víspera; si no, el primer día con notas desde esa fecha.
- **Aviso en su fecha:** el primer día con notas desde su día.
- **Reiteración:** el primer día con notas desde el primer día hábil del mes que corresponde. En el caso de la simulación da el 11/01 (hoy dice 04/01). La cantidad se calcula con esa fecha.
- **Nota de auditoría:** el canal se calcula en el primer día con notas, y la próxima reiteración (5 días hábiles después de la última) se pasa por el primer día con notas y vuelve a confirmar el canal en esa fecha.
- **Licencia del firmante:** la víspera, el último día hábil y la vuelta con el calendario; la vuelta es el primer día con notas después de la licencia (así ve una licencia que sigue a otra).
- **La alerta «la corrida de ayer no corrió»** (`debioCorrer`) usa el calendario.
- Lo que se sigue aproximando, como hoy: el primer recordatorio que van a poner las corridas de las 14:00 no se predice.
- Con el envío automático apagado, el Estado sigue anunciando las fechas como hoy (mi decisión: la pantalla ya muestra que está desactivado).

**Vista previa y prueba** (Correos → Vista previa y pruebas; `previewNota`, `previewPdf`, `previewAnexo` y `enviarPrueba`):
- **Aviso:** como hoy, la nota del primer día con notas, con el calendario.
- **Reiteración y nota de auditoría:** la nota de la fecha que anuncia el Estado para ese tipo y esa gestión, con la selección de esa fecha (decisión del usuario). Una sola función da las fechas al Estado y a la vista previa. Si el Estado no anuncia ninguna nota de auditoría, la vista previa usa el primer día con notas (como hoy).
- **Lo que dice arriba de la vista previa** (`textoDeVistaPrevia` de `public/js/correos.js`, sube `VERSION_CORREOS`) y el mensaje de la prueba (`mensajeDePrueba`): hoy aclaran el día solo cuando hoy no se generan notas. Ahora también cuando hoy hay notas pero esta sale otro día (por ejemplo, la reiteración del mes ya salió): textos en la sección 6.
- **El email de los 40 días** (vista previa y prueba, `fechaDelProximoAviso`): el próximo día hábil con el calendario.

**Configuración → Licencias** (`controllers/licenciasController.js`, `services/licenciasOficialesService.js`, `public/js/usuarios.js`):
- **La víspera** de cada licencia del firmante, con el calendario. Si ese día no hay anticipo (cae dentro de otra licencia del firmante, por ejemplo vacaciones del 09/12 al 31/12 y una médica del 04/01 al 08/01 cargadas seguidas desde Mi espacio, o la licencia no tiene días hábiles), no hay víspera y el texto lo dice (sección 6). Hoy `vispera: null` quiere decir «no se sabe, se nombra en general»: «no hay anticipo» necesita una marca propia en la respuesta (en `aRespuesta` de Configuración, en `pasoPrevistoDe` de Mi espacio y en la licencia del firmante del Estado), y `efectoEnNotas` y su copia la leen.
- **El formulario, antes de guardar,** sigue como hoy: con una fecha de inicio nueva dice «el último día hábil anterior» sin preguntarle al servidor (mi decisión: no se suma una ruta para eso; ver «Límites sabidos»).
- **«Vuelve el…»** y las ausencias unidas de la persona autorizada (`conSusLicencias`, `unirAusencias`).
- **El 409 «la persona autorizada no tiene días»** (`rechazoDeLaBase`, `disponibilidadDelAutorizado`): con el calendario, leído dentro de la transacción después de `bloquearUsuarios` (es una lectura común, sin bloqueos).
- **Los días sin auditor** (`GET /usuarios/licencias/sin-auditor`).

**Mi espacio** (`services/miEspacioReglas.js`, `services/miEspacioPaso.js`, `controllers/miEspacioController.js`, `public/js/mi-espacio.js`): ya lee las filas de la tabla en su contexto; arma el calendario con ellas (`calendarioCon`) y se lo pasa a lo que hoy usa los fijos.
- **`limiteParaCambiarTipo`** (hasta cuándo se pueden cambiar de tipo unas vacaciones con persona a cargo): con el calendario. Para unas vacaciones desde el 09/12/2026 pasa del 04/12 al 03/12, porque la nota que informa quién queda a cargo sale el 04/12.
- **La víspera del aviso del paso a Configuración** (`pasoPrevistoDe`): la misma regla que Configuración, también sin víspera cuando no hay anticipo.
- **«Las notas de hoy ya salieron a las 8:15 con tu firma.»** (`AVISO_NOTAS_DE_HOY`) se muestra solo si hoy salieron notas firmadas por el titular (mi decisión: hoy sale también un sábado, un feriado o antes de las 8:15).
- **`GET /mi-espacio/firmante`** usa `conSusLicencias`: el mismo arreglo que Configuración.

## 5. Tanda 2: Métricas, el Ciclo de vida, la foto, el Informe anual y la Agenda de pedidos

**Dónde se cuentan días hábiles:** solo en dos funciones de `services/metricasReglas.js` y en una de la Agenda.
- **`duracion`** (los días hábiles de cada tramo, de las etapas, de «se cargaron … después» y de los textos de los casos).
- **`diaDelAvisoDe`** (el día en que sale el aviso de la regla: la cobertura y su motivo).
- **`fechaDeAvisoPorRegla`** (`services/reportesAgenda.js`, «Aviso aprox.» de la Agenda de pedidos).

**Cómo entra:** el calendario (o los feriados) viaja en las opciones de `casosDe`, `vistaDe`, `etapasDe` y `agendaDe`, y en el `ctx` que ya arma `contextoDe`. Lo leen los controladores (`metricasConOpciones`, `cicloDeVidaDe`, `reporteAgenda`) y `sacarFotoSiCorresponde`. El Informe anual lee solo fotos: no recalcula nada. La paridad Métricas ↔ Agenda (`tests/metricas-reglas.test.js`) se mantiene con el mismo calendario en las dos.

**La foto:**
- **Guarda los feriados con los que se calculó,** como una clave opcional (la lista de fechas). `VERSION_DE_LA_FOTO` sigue en 1: `PARTES_DE_LA_FOTO` no la exige y la lectura acepta claves de más.
- `etapasDeLaFoto`, que recalcula las etapas de una foto vieja sin ellas, usa los feriados guardados en la foto; sin la clave, los 9 fijos (así se sacó esa foto).
- **Nunca con los 9 fijos por una falla:** si la tabla no se puede leer, no se saca (sección 2).
- **Si la tanda 2 llega después del 10/01/2027,** la foto de 2026 queda con los 9 fijos y la de 2027 con la tabla: la comparación del Informe anual y el «Año anterior» del Ciclo de vida mezclarían dos calendarios. Por eso el plazo.

**Qué cifras se mueven** (con la precarga):
- 2026 pasa de 253 a 237 días hábiles.
- Con los casos de prueba (`tests/metricas-casos.js`): el aviso anticipado externo pasa de 27 a 26 días hábiles (mediana), el interno de 42 a 40 y «se cargaron … después» de 27 a 25.
- No cambian: la cobertura del aviso, las reiteraciones, el índice, la antigüedad, los estados, el trabajo del RPAD ni las áreas.
- Los ciclos cuyo aviso se corrió por un feriado de la tabla (el 31/12 externo, del 23/11 al 24/11) dejan de figurar como faltantes entre las 0:00 y las 8:15 de ese día, y su aviso anticipado cuenta un día menos, que es lo que pasó.
- Antes de 2025 la tabla no tiene días: rigen solo los 9 fijos, como hasta ahora.

## 6. Los textos

**El aviso azul de la pestaña Feriados** (`public/configuracion.html`, `#feriados-aviso`, atado por `tests/paginas.test.js`). Hoy: «Por ahora, estos feriados cuentan solo para Mi espacio: los días hábiles de las licencias y los francos. Las Notas Digitales, la auditoría y Métricas siguen con los 9 feriados fijos.»
- **Tanda 1:** «Estos feriados, junto con los 9 fijos, son los días no hábiles de las Notas Digitales, los emails automáticos, las licencias y Mi espacio: esos días no sale ninguna nota ni ningún email automático. Métricas, el Ciclo de vida del dato y la Agenda de pedidos todavía cuentan solo los 9 fijos.»
- **Tanda 2:** «Estos feriados, junto con los 9 fijos, son los días no hábiles de todo el sistema: esos días no sale ninguna nota ni ningún email automático, y no cuentan como días hábiles en las licencias, Mi espacio ni Métricas.»

**Métricas y el Ciclo de vida** (tanda 2):
- «Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.» pasa a «Los días son hábiles: de lunes a viernes, sin feriados ni días no laborables.» En `public/reportes.html`, `BAJADA_DE_LOS_DIAS` de `public/js/reportes.js` (sube `VERSION_REPORTES`) y `T.bajada.habiles` de `services/reportesMetricasPdf.js` (también en el Informe anual).
- «Días hábiles: de lunes a viernes, sin los feriados nacionales fijos; entre paréntesis, los corridos. …» (`services/reportesCicloDeVidaPdf.js`) pasa a «Días hábiles: de lunes a viernes, sin feriados ni días no laborables; entre paréntesis, los corridos. …».
- «(si ese día no es hábil, el siguiente)» de la Agenda queda: sigue siendo cierto.
- Cambian las referencias de los PDF de Métricas y del Informe anual (`REFERENCIA_DE_LOS_PDF` de `tests/reportes-pdf.test.js`): se vuelven a tomar.

**El efecto en las notas de una licencia del firmante sin anticipo** (Configuración → Licencias y el formulario de Mi espacio: `efectoEnNotas`, que está en `usuarios.js` y copiado en `mi-espacio.js`). Cuando la víspera cae dentro de otra licencia del firmante:
- **Sin persona autorizada:** «Empieza a continuación de otra licencia: los avisos no se adelantan. Lo que toque avisar y las reiteraciones salen el primer día hábil después de la licencia.»
- **Con persona autorizada:** «Empieza a continuación de otra licencia: los avisos no se adelantan. Desde el primer día, {nombre} presenta las notas con las dos firmas, después de la nota que comunica la autorización.»
- Quien lo construye confirma con un test qué hace la corrida en ese caso. Si hace otra cosa, el texto dice lo que hace y se le muestra al usuario antes del merge.

**Correos → Estado, la licencia del firmante sin anticipo** (`textoLicenciaFirmante` de `public/js/correos.js`, que hoy dice siempre «los avisos se anticipan el …» en una licencia futura):
- **Sin persona autorizada:** «Licencia del firmante del {desde} al {hasta}, sin autorizado: empieza a continuación de otra licencia, así que los avisos no se adelantan, y las reiteraciones se postergan al {vuelta}.»
- **Con persona autorizada:** «Licencia del firmante del {desde} al {hasta}: empieza a continuación de otra licencia, así que los avisos no se adelantan. {nombre} presenta las notas por autorización, con las dos firmas, desde el primer día.»

**La vista previa y la prueba cuando la nota sale otro día y hoy sí hay notas:**
- Arriba de la vista previa: «Esta nota no sale hoy: así saldría el {fecha}.» y, en la segunda línea, «Con los datos de hoy, ese día esta nota incluiría N dataset(s). Asunto: …» (o «Ese día no saldría ninguna nota de este tipo: se muestran datos de ejemplo.»).
- La prueba: «Prueba enviada a … (como saldría el {fecha})», como hoy cuando hoy no hay notas.

**Las alertas:** las de la sección 2.

## 7. Tests

- **Los de hoy pasan sin cambios** salvo los que fijan a propósito lo que cambia: las bases de prueba se crean con `database/schema.sql`, que tiene la tabla `feriados` vacía (el calendario da lo mismo que los fijos), y las reglas puras usan `CALENDARIO_FIJO` por defecto. Los que cambian, por ejemplo:
  - `tests/mi-espacio-reglas.test.js` («con los 9 feriados fijos», «Carnaval cuenta como hábil», si se le pasa el calendario);
  - `tests/paginas.test.js` (el aviso azul);
  - los textos de `usuarios-frontend` y `mi-espacio-frontend` (`efectoEnNotas` y su paridad);
  - en la tanda 2, las claves exactas de la foto (`tests/metricas-foto.test.js`), los textos y las referencias de los PDF.
- **`tests/notificaciones.test.js`** decide qué tests corren con `esDiaHabil(hoyArgentina())` sobre la base del `.env`, que tiene la precarga: corrido un feriado de la tabla fallaría. Tiene que decidir con `leerCalendario`.
- **Nuevos, puros:**
  - `calendarioCon([])` da lo mismo que `CALENDARIO_FIJO` en las derivadas, del 2025 al 2028 y con entradas que no son fechas;
  - el tope de 366 vueltas;
  - con la precarga: `canalDelCambio` (primer recordatorio el viernes 30/10: el 03/11 sigue por recordatorio, a las 8:15 y a las 14:00), `diasHabilesLibres` y `unirAusencias` con el 02/11, `limiteParaCambiarTipo` del 09/12 da 03/12, `rangoDeAviso` en los bordes.
- **Nuevos, con una base de prueba propia** que carga `database/updates/migracion-feriados-datos.sql` tal cual:
  - la corrida del 02/11 da «Día no hábil» y la del 03/11 genera el aviso interno del 31/12 y la reiteración;
  - el 09/11 no genera nada;
  - la víspera de una licencia del firmante desde el 09/12 es el 04/12 (y el 07/12 no genera nada);
  - el Estado, la vista previa, Configuración y Mi espacio dan esas mismas fechas;
  - el caso de la simulación: el Estado anuncia la reiteración de enero el 11/01;
  - las licencias seguidas: sin víspera y la vuelta real;
  - las 8:15 y las 14:00 dejan cada cambio pendiente en un solo canal;
  - con la tabla renombrada (no se puede leer): la corrida usa los fijos, queda con errores y el Estado muestra la alerta;
  - la respuesta de cada corrida dice qué calendario usó (`'tabla'`).
- **Tanda 2:** las paridades de Métricas y la Agenda con la precarga (31/12 interno → 03/11; la cobertura), la foto con los feriados guardados, la foto que no se saca si la tabla no se puede leer y `etapasDeLaFoto` con los feriados de la foto.
- La suite completa antes y después de cada tanda, con el candado `C:\Users\Mariano\.rpad-suite.lock`.

## 8. Verificación: la simulación otra vez

Antes del merge de la tanda 1 se simulan las corridas de las 8:15 y de las 14:00, día por día, **con el código de la tanda 1** (decisión del usuario: la simulación va después de implementar los feriados), **del 28/10/2026 al 05/02/2027**, con el escenario del usuario. Para comparar, el mismo escenario se corre también con el código de producción (mi decisión: tarda unos minutos).

**El escenario del usuario.** Todas las licencias se cargan desde Mi espacio y pasan solas a Configuración → Licencias.
- **05/11:** el firmante carga sus vacaciones del 09/12/2026 al 08/01/2027, con la persona autorizada a cargo.
- **20/11:** la persona autorizada carga sus vacaciones del 04/01 al 15/01/2027 y, en Configuración → Feriados, cuatro asuetos municipales: el 23, el 24, el 30 y el 31/12/2026.
- **24/11:** el firmante corrige el Día del Petróleo del 13/12 al 14/12/2026, con «Trasladado del 13/12».
- Mías, para probar lo que falta: un cambio pendiente propuesto el 30/10 (el canal del 03/11) y miradas a Correos → Estado el 28/10, 30/10, 03/11, 06/11, 20/11, 24/11, 03/12, 04/12, 21/12, 29/12, 04/01 y 11/01.

**Cómo.** Los scripts y el volcado de la base del 27/10 están copiados en la carpeta de notas compartida de la coordinadora (`simulacion-mi-espacio/sim/`; el original estaba en una carpeta temporal). Se copian a otra carpeta y se cambian: el código que corren (esta rama), los frenos del nombre de la base (para aceptar `rpad_rama_feriados_notas`, la copia de esta entrega, y nada más), la etiqueta de Mailpit, los textos fijos del informe y las acciones del escenario. Ningún email real: van a archivos y al Mailpit local. Nada pasa por `/api/cron`. La base se borra al cerrar. El informe va al Escritorio, fuera del repo.

**Lo que se tiene que ver con la tanda 1:**
- el 02/11, el 09/11 y el 23/11, «Día no hábil»; el 03/11 salen el aviso interno del 31/12 y la reiteración de noviembre; el 24/11, el aviso externo del 31/12;
- la víspera es el viernes 04/12 (el 07/12 es no laborable y el 08/12, fijo), con la nota de autorización a la persona autorizada;
- durante la licencia, ninguna nota el 14/12, el 23, 24, 25, 30 y 31/12, el 01/01 ni del 04/01 al 08/01; los avisos en su fecha que caen en esos días se presentan el día hábil anterior en que la persona autorizada está;
- las reiteraciones de enero salen el 11/01, a la vuelta del firmante, y el Estado lo anuncia desde el 20/11 (cuando se carga la licencia de la persona autorizada);
- cada fecha que anuncia el Estado es la que después cumple la corrida.

## 9. Documentación, despliegue, plazos y plan B

- **`CLAUDE.md`:**
  - «Recordatorios automáticos»: un solo calendario;
  - «Feriados»: deja de decir que el resto del sistema no cambia;
  - la Estructura: el calendario y `leerCalendario`;
  - «Métricas y Reportes», tanda 2: los días hábiles con la tabla;
  - las convenciones de `usuarios.js` y `mi-espacio.js` si cambian.
- **Despliegue de cada tanda:** sin SQL, sin cron nuevo y sin Run NPM Install. Se suben los archivos y se hace Restart, fuera del horario de los crons (8:15, 14:00 y las medias horas).
- **Kits:** `RPAD-deploy-feriados-en-notas` (tanda 1) y `RPAD-deploy-feriados-en-metricas` (tanda 2), en el Escritorio, comparados byte a byte con git contra lo que está en producción.
- **Después de desplegar la tanda 1:** mirar en Correos → Estado que las fechas anunciadas sean las de la sección 3 y que no haya alertas nuevas.
- **Plazos:** tanda 1 antes del jueves 03/12/2026; tanda 2 antes del 10/01/2027.

**Plan B, si la tanda 1 no está en producción para el lunes 02/11/2026:**
1. El domingo 01/11 a la noche o el lunes 02/11 antes de las 8:15, apagar el «Envío automático» en Correos → Configuración.
2. El lunes 02/11 entre las 8:20 y las 14:00, volverlo a prender. Tiene que estar prendido a las 14:00: apagado, el recordatorio de esa hora manda por email lo que iba por nota.
3. El martes 03/11 a las 8:15 salen solos el aviso interno de diciembre (con fecha 03/11) y la reiteración de noviembre. No se pierde nada.
4. Lo que no cubre: el 02/11 a las 14:00 el recordatorio de cambios pendientes sale igual si hay alguno sin auditar.
5. El viernes 06/11, mirar el Estado: si anuncia algo para el 09/11, repetir los pasos 1 y 2.
6. El 23/11, repetir los pasos 1 y 2 (el aviso externo de diciembre sale el 24/11).
7. **No usarlo el 07/12:** con el envío apagado se pierde el adelanto de la víspera. Si la tanda 1 no llegó, la víspera sale el 07/12 (no laborable), pero sale.

Borrar la Tarea Cron ese día es peor: la alerta «sin corrida» y el riesgo de olvidarse de volver a crearla.

## Decisiones

**Del usuario (27/10/2026):**
- Se unifica todo el sistema a un calendario: los 9 fijos y la tabla, también Métricas, el Ciclo de vida, la foto y la Agenda de pedidos («llegamos a hacerlo antes del 10/1»).
- Lo que anuncia una corrida es lo que hace: entra todo lo que la anuncia (Correos → Estado, vista previa y prueba, Configuración → Licencias y Mi espacio).
- Dos tandas, con un kit cada una: primero las corridas, después Métricas.
- Si la tabla no se puede leer, las corridas siguen con los 9 fijos y Correos → Estado lo marca en rojo.
- La vista previa y la prueba de la reiteración y de la nota de auditoría muestran la fecha real en que salen.
- Del hallazgo 1, solo la fecha real en el Estado; se descartan la advertencia anticipada, el texto «sin autorizado» y los hallazgos 2 y 3 («estamos todos en el mismo espacio físico»).

**Mías:**
- La forma del calendario único (sección 1) y el test que impide usar el fijo por olvido.
- Las licencias seguidas: sin víspera cuando no hay anticipo, y la vuelta real en el Estado.
- «Las notas de hoy ya salieron…» de Mi espacio, solo si salieron.
- Con el envío automático apagado, el Estado sigue anunciando las fechas.
- Mi espacio y la agenda siguen sin mandar nada si no pueden leer los feriados (sus specs); Configuración sigue con los fijos.
- La foto guarda sus feriados y nunca se saca con los fijos por una falla.
- La Agenda de pedidos y `diaDelAvisoDe` van en la tanda 2 (hasta entonces dicen 23/11 cuando el aviso sale el 24/11, y la cobertura muestra un faltante entre las 0:00 y las 8:15 de ese día).
- Los textos de la sección 6, para que el usuario los apruebe con esta spec.
- El formulario de Configuración → Licencias no le pregunta al servidor antes de guardar (no se suma una ruta): la fila guardada dice lo real.
- La caída a los 9 fijos se anota entre los errores de la corrida de las Notas.

## Límites sabidos

- **La víspera es exacta.** Si alguien carga un feriado en la víspera de una licencia del firmante el día anterior a esa víspera, después de las 8:15, la nueva víspera ya pasó y el adelanto se pierde (lo mismo que hoy si se carga la licencia tarde). Con persona autorizada, la nota de autorización sale el primer día de la licencia; sin ella, los avisos esperan la vuelta.
- **El primer recordatorio de las 14:00 no se predice** en el Estado (como hoy).
- **Lo ya enviado no cambia:** las notas, sus anexos y los `cuenta_desde` guardados quedan como están. Un `cuenta_desde` que cae en un feriado de la tabla solo cambia el día en que se vuelve a presentar el aviso en su fecha (el hábil anterior dentro de la licencia), no la cuenta de la reiteración.
- **El formulario de Configuración → Licencias, antes de guardar,** sigue diciendo «el último día hábil anterior» cuando cambia la fecha de inicio (no le pide nada al servidor, como hoy): en una licencia que sigue a otra, ese texto anuncia un adelanto que no va a pasar. Al guardar, la fila dice lo real. Mi espacio sí lo dice antes de guardar (su cálculo previo).

## Lo que queda para quien lo construye

- Los nombres exactos de las funciones, de las claves y de los mensajes que no están escritos acá.
- Si el calendario viaja como objeto o como Set en cada función interna, mientras cumpla la sección 1.
- Cómo se mide el «primer día con notas» sin traer las imágenes de las firmas.
- El orden de las tareas, con la condición de que el «hoy es hábil» y `rangoDeAviso` del email de los 40 días, y el canal de las dos corridas, cambien en la misma tarea.
