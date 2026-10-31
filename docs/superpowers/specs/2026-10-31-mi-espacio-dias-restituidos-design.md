# Mi espacio: los días de vacaciones que restituye un asueto (diseño)

Fecha: 31/10/2026. Rama: `claude/mi-espacio-dias-restituidos`, desde main 39eef2b (todo main en producción desde el 31/10).
Maqueta: `docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-mockups/`. Se abre `index.html` con un servidor estático. La barra oscura de abajo salta entre los nueve momentos, y el último, «Feriados», abre `configuracion.html`. Los `.docx` de `word/` los armó `renderNotaDocx` de verdad.

Los datos son inventados: Julieta Ferreyra, de planta permanente y admin, con vacaciones del 11/12/2026 al 08/01/2027 y asuetos inventados el 24 y el 31/12/2026. El usuario aprobó la maqueta con su propio caso, fuera del repo; esta copia tiene los mismos textos y pantallas. Donde la maqueta y este documento difieren, manda el documento.

Sigue a `2026-10-26-mi-espacio-licencias-y-horas-design.md` (vacaciones, saldo inicial, el paso a Configuración), `2026-10-27-mi-espacio-dias-de-vacaciones-design.md` (el reparto por carga y «Perdés»), `2026-10-28-mi-espacio-vacaciones-en-la-carga-design.md` (lo que se ve al cargar), `2026-10-27-mi-espacio-licencia-word-design.md` (la nota en Word) y `2026-10-26-feriados-design.md`. Cambia la sección 6 de esta última («un feriado que cae dentro de una licencia ya cargada … es el comportamiento buscado», línea 182), solo para las vacaciones. Lo que no se dice acá sigue como está en esas specs.

## 1. Qué es y por qué

**El caso real** (contado por el usuario el 31/10/2026, sin nombres). Una persona pidió vacaciones del 11/12/2025 al 09/01/2026 con su licencia 2023, que vencía el 31/12/2025 y había que empezar a usar antes de esa fecha. Después de pedirlas, el municipio declaró asueto el 24, 26 y 31/12/2025 y el 02/01/2026 (Res. 2809/25). Esos cuatro días se le tenían que **restituir**, con una nota al Director General y un plazo:
- como eran de una licencia que vencía el 31/12, había que **tomarlos** antes del plazo, con una nota que indicara la fecha;
- si hubieran sido de una licencia que no vencía (2024 o 2025), igual había que hacer una nota antes del plazo **pidiendo que se restituyan** a la licencia.

Sin la nota a tiempo, los días se pierden en los dos casos.

**Lo que hace hoy Mi espacio.** Los días hábiles no se guardan: se cuentan cada vez con los feriados de la tabla. Lo cuentan `diasQueDescuentan` (`services/miEspacioReglas.js:420`) y `feriadosPara` (`services/miEspacioDatos.js:173`). Así, un asueto cargado después en Configuración → Feriados le saca ese día a las vacaciones y lo devuelve **solo, sin nota ni plazo**. Lo simuló un agente con las reglas reales, la precarga de feriados y una persona con 20 días por año. Las vacaciones del 11/12/2026 al 08/01/2027 tienen 19 días hábiles; con asuetos el 24 y el 31/12/2026, 17:
- **Todas de la 2024**, que vence el 31/12/2026. Hasta el 31/12 el Resumen dice «Perdés 2 de la 2024 (vencen el 31/12/2026).», porque `perdidos` no encuentra ningún día libre antes del vencimiento (`repartoDeVacaciones`, `services/miEspacioReglas.js:455`, y la línea 526). Desde el 01/01 los 2 días **desaparecen sin decir nada**: `quedan` da 0 con la licencia vencida (línea 522).
- **De la 2025**, que vence el 31/12/2027. «Te quedan» pasa de 21 a 23: los días vuelven solos.
- **De la 2024 y de la 2025** (15 y 4). Como la carga sigue usando la 2024 aunque venza (spec del 27/10, 2.1), los días que libera el asueto terminan en la 2025, sin nota.
- **La nota en Word** de esas vacaciones, bajada de nuevo después del asueto, dice «diecisiete (17)» en lugar de los «diecinueve (19)» que se presentaron (`notaDeLicencia`, `services/miEspacioNota.js:213`, recalcula los días).
- **Nadie se entera.** El modal de Feriados le dice a administración «N licencias cargadas lo incluyen: sus días hábiles se recalculan.» (`textoDeAfectadasFeriado`, `public/js/feriados.js:398`). A la dueña no le llega nada, y no queda registro de que esos días dejaron de contar.

**La idea.** Cuando un asueto cae en unas vacaciones ya cargadas, esos días quedan **por restituir**, con su plazo y su nota en Word. Si su licencia vence antes del plazo, se cargan como una licencia aparte; si no, se pide la restitución y vuelven a la licencia. Si el plazo pasa sin nada, se pierden.

## 2. Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Que Mi espacio refleje la regla real: los días de un asueto declarado después de cargar unas vacaciones se restituyen solo con una nota y dentro de un plazo.
- Que la persona se entere sola, aunque el asueto se cargue mientras está de vacaciones: un aviso en el Resumen, la fila, «Vence pronto» y el email.
- Que las dos notas nuevas salgan en Word desde Mi espacio, como la nota de cada licencia.
- Que esté en producción antes de los asuetos de fin de año de 2026, que se declaran por decreto cada año y no se precargan (spec de Feriados, línea 175: «Lo que depende de un decreto, se carga desde la pestaña»).

**No objetivos**
- **Solo la licencia ordinaria** (respuesta del usuario). Estudios, atención médica, grupo familiar, la médica extraordinaria, la franquicia, los francos y las horas a favor siguen recalculándose como hoy: un asueto les saca el día sin nota ni plazo.
- Mi espacio no sigue si la nota se firmó o se aprobó: **armarla en Mi espacio es pedirla**, como con cualquier licencia (respuesta del usuario).
- No se reconstruye nada hacia atrás. Los feriados ya cargados no generan restituciones. Al 31/10/2026 no hay ninguna licencia de Mi espacio activa en producción, así que no se pierde ningún caso.
- El saldo inicial no carga restituciones pendientes (límite sabido, sección 15).
- Configuración → Licencias, las Notas Digitales, la auditoría, Métricas y la agenda no cambian su regla (sección 11).

**Antiobjetivos**
- Que un asueto le haga perder días a alguien sin avisarle, o se los devuelva sin la nota que la regla exige.
- Que lo pedido cambie después: las vacaciones originales, su fila y su nota en Word siguen diciendo los días que se presentaron.
- Que algo frene una carga: los avisos y el «Revisá…» nunca frenan, como en todo Mi espacio («el sistema no frena licencias»).
- Que administración vea de quién son las vacaciones que incluye un asueto.
- Que el texto diga «tardanza», «demora» o un reproche; lo que vence dice «Vencen el …», como en «Vence pronto».
- Que un nombre real o el caso real queden en el repo.

## 3. Las decisiones del usuario (31/10/2026)

Fueron cinco rondas de preguntas, más las respuestas sueltas y lo que pidió al ver la maqueta.

1. **Sin la nota a tiempo, los días se pierden** en los dos casos. Vale para todas las modalidades.
2. **El plazo:** 4 meses desde el primer asueto, al **último día hábil** del mes (ronda 1). Del 24/12/2025 sale abril de 2026, y el plazo es el **29/04/2026**: el 30/04/2026 es feriado provincial («Plebiscito de 1902», en la tabla). El usuario dio «31/4» y se corrigió a 30/04. Del 12/03/2027 sale julio, y el plazo es el 30/07/2027, porque el 31/07 es sábado.
3. **Solo la licencia ordinaria.**
4. **Solo si primero se cargó la licencia y después el asueto** (respuesta suelta). Cuenta cualquier día que deja de ser hábil: un asueto, un no laborable o un feriado nuevo (ronda 1).
5. **¿Tomarlos o que vuelvan?** Según si su licencia vence antes del plazo (ronda 1).
6. **Cuando hay que tomarlos:** que **empiecen** a más tardar el plazo, como la licencia anual (ronda 1). Se toman **todos juntos** (respuesta suelta), **después de las vacaciones originales** (ronda 5) y como **una carga aparte**, pegada a otras vacaciones si se quiere (ronda 2).
7. **Cómo sabe que se hizo la nota:** al armarla en Mi espacio (ronda 2).
8. **Las vacaciones originales siguen con sus días** (ronda 2).
9. **Avisos:** arriba del Resumen, en «Vence pronto», por email y en la fila (ronda 2). Cuándo: desde el asueto y más fuerte cerca del plazo (ronda 3). **El aviso va entre la banda celeste y «El resto de AAAA»**, no arriba de todo: lo pidió el usuario al ver la maqueta.
10. **Cambios:** se acomoda solo y avisa (ronda 3).
11. **Dos licencias:** un pedido por licencia, con el mismo plazo (ronda 3).
12. **Otro asueto después de pedir:** un pedido nuevo, con su propio plazo (ronda 3).
13. **Las dos notas,** con sus textos (ronda 4).
14. **Dónde se cargan:** el botón del aviso y «Cargar licencia» (ronda 4).
15. **Deshacer:** se puede borrar hasta el plazo; pasado el plazo sin nada, «se perdieron» (ronda 4).
16. **Administración:** el modal de Feriados lo dice, sin nombres (ronda 4).
17. **La banda:** una oración más; los días por restituir no suman a «Te quedan» (ronda 5).
18. **Maquetas** antes de la spec, con su caso real. Las aprobó con el único cambio del punto 9.

## 4. La regla

**Qué días se restituyen.** Un día de unas vacaciones de Mi espacio (tipo `vacaciones`) es **restituible** si se cumplen las cuatro condiciones:
- un feriado de la tabla, cargado o corregido **cuando esas vacaciones ya estaban cargadas y ese día estaba dentro de ellas**, lo dejó de hacer hábil. Lo decide la foto de la sección 6;
- ese día **sigue** dentro de las fechas de las vacaciones;
- **sigue** sin ser hábil con los feriados de hoy;
- es del arranque en adelante: es un día que la carga descuenta (`diasQueDescuentan`).

Si después se alargan las vacaciones y ahora incluyen un feriado que ya estaba cargado, ese día no se restituye, porque ya se sabía. Las demás licencias no tienen días restituibles.

**Las vacaciones originales siguen descontando esos días.** Los días restituibles se cuentan en la carga como si fueran hábiles, así la carga conserva los días que se pidieron (19 en el ejemplo). La fila de la lista, el reparto y su nota en Word siguen diciendo 19. Con esto, un asueto ya no le devuelve días a una licencia sin nota ni le hace aparecer un «Perdés».

**La licencia de origen** de cada día restituible es la que el reparto le asigna a ese día. Mientras no se pidió nada, se lee del reparto de hoy y se acomoda solo. Al pedirlo, queda guardada.

**Los grupos.** Los días restituibles de unas vacaciones forman **un pedido por cada licencia de origen**, con el mismo plazo (decisión 11).

**El plazo** de un grupo que todavía no se pidió es el último día hábil (`ultimoDiaHabilDelMesCon`, `services/feriadosReglas.js:257`, con los 9 fijos y la tabla) del mes que está 4 meses después del mes del **primer** día restituible de su **tanda**. Una tanda son los días restituibles de unas vacaciones cuya foto se sacó antes del mismo pedido: la primera tanda, los fotografiados antes de cualquier pedido sobre esas vacaciones; la segunda, los fotografiados después del primer pedido y antes del segundo; y así. Así, los grupos de una misma tanda comparten el plazo aunque se pidan en días distintos (decisión 11: si se pide la 2024, la 2025 conserva el plazo del primer asueto), y un asueto que llega después de un pedido arma una tanda nueva, con el plazo contado desde él (decisión 12). Un pedido guarda el primer asueto de su tanda; su plazo se vuelve a calcular con los feriados de hoy, así que un feriado nuevo en el último día lo corre.

**¿Tomarlos (caso A) o que vuelvan (caso B)?**
- Si su licencia de origen vence **antes** del plazo (`venceLaLicencia`, `services/miEspacioReglas.js:315`: el 31/12 de dos años después), es el **caso A**: hay que tomarlos.
- Si vence el mismo día o después, es el **caso B**: se pide la restitución.
- Ejemplos:
  - días de la 2024 (vence el 31/12/2026) con un asueto del 24/12/2026: plazo 30/04/2027, caso A;
  - días de la 2025 (vence el 31/12/2027) con ese mismo asueto: caso B;
  - días de la 2025 con un asueto del 15/10/2027: plazo 29/02/2028, después del vencimiento, caso A.

**Caso A, cargar los días restituidos.** Se cargan como una licencia aparte, de tipo nuevo `restituidos` («Días restituidos»):
- son exactamente los N días del grupo, todos juntos;
- «Desde» va después del fin de las vacaciones originales y a más tardar el plazo (puede terminar después);
- «Hasta» lo pone Mi espacio: el N-ésimo día hábil desde «Desde»;
- no se pisa con otra licencia, como siempre;
- no sale de ninguna licencia: sus días son los del grupo y no entran en el reparto;
- pasa a Configuración → Licencias como cualquier vacación (sección 11);
- tiene su nota en Word (sección 12) y su fila, con la insignia «Días restituidos».

**Caso B, pedir la restitución.** «Pedir la restitución» registra el pedido y arma la nota. Los N días vuelven **enseguida** a su licencia de origen y se suman a lo que queda, con el vencimiento de esa licencia. Las vacaciones originales siguen descontándolos: lo que vuelve es un agregado a la licencia, no un día menos en la carga (sección 7).

**Deshacer** (decisión 15). Mientras no pasó el plazo, borrar la carga del caso A o el pedido del caso B deja otra vez los días «por restituir».
- Pasado el plazo, el pedido del caso B no se puede borrar.
- La carga del caso A se sigue pudiendo borrar como cualquier licencia, con las reglas de siempre del paso a Configuración, pero los días quedan perdidos.

**Se pierden.** Si el plazo pasa sin que se haya pedido nada, el grupo queda **perdido**: la carga sigue descontando esos días y la fila lo dice en gris. Nunca vuelven solos.

**Cambios después** (decisión 10):
- **Mientras no se pidió nada**, todo se acomoda solo, porque la regla de arriba mira las fechas y los feriados de hoy. Si se borran las vacaciones, no queda nada para restituir. Si se acortan y un día restituible queda afuera, ese día sale. Si el asueto se da de baja, el día vuelve a ser hábil y vuelve a contar como un día común de las vacaciones.
- **Si ya se pidió** (cargado en A, o pedido en B), queda como está y el Resumen avisa arriba, en ámbar, con lo que hay que revisar: «Revisá tus días restituidos: el asueto del 24/12/2026 se dio de baja.» o «… tus vacaciones ya no incluyen el 31/12/2026.». Nunca frena una carga.

**Recursión.** Si un asueto cae en una carga de días restituidos, se aplica la misma regla. Esa carga conserva sus N días, y el día del asueto queda por restituir con la misma licencia de origen. Su «vencimiento» es el plazo del grupo del que salió, así que siempre es el caso A.

## 5. El ejemplo de la maqueta

Julieta Ferreyra es de planta permanente, con 20 días por año y arranque el 02/11/2026. Su saldo: 19 de la 2024, 15 de la 2025 y 10 de la 2026. Carga vacaciones del 11/12/2026 al 08/01/2027: 19 días hábiles, todos de la 2024 (vence el 31/12/2026). El martes 22/12/2026, administración carga asuetos el jueves 24 y el jueves 31/12/2026.

- **Lunes 11/01/2027, al volver.**
  - Entre la banda y «El resto de 2027», el aviso: «Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierden.», con «Cargar los días restituidos».
  - En la fila de las vacaciones, que siguen con 19 días: «▲ 2 días por restituir (asuetos del 24/12 y el 31/12/2026): empezá a tomarlos a más tardar el 30/04/2027.».
  - En la banda: «Además, 2 restituidos de la 2024: empezá a tomarlos a más tardar el viernes 30/04.».
  - A las 8:15 le llega el email; mientras estuvo de vacaciones no se mandó.
  - «Te quedan 35 días de vacaciones»: los 2 no suman.
- **Jueves 01/04/2027.**
  - Todo lo anterior, más «Vence pronto»: «2 días restituidos de la 2024», «Vencen el viernes 30/04, en 29 días.» y el botón.
  - La marca ámbar en la pestaña Resumen, y la oración de la banda en ámbar.
  - El viernes 23/04 (5 días hábiles antes del plazo) le llega el segundo email.
- **Carga los días** desde el lunes 12/04/2027: Mi espacio pone el «Hasta» el martes 13/04. Se baja la nota A y la fila de las vacaciones dice «Los 2 días restituidos están cargados del 12/04 al 13/04/2027.».
- **Si no los cargaba**, el lunes 03/05/2027 la fila dice «2 días por restituir: se perdieron el 30/04/2027.», en gris, y el aviso ya no está.
- **Variante B.** Las mismas vacaciones con días de la 2025 (vence el 31/12/2027): «podés pedir que te restituyan 2 días a tu licencia 2025 …». Al pedirlo, «Te quedan» pasa de 21 a 23.

## 6. Los datos

**El tipo nuevo.** El enum `mi_espacio_licencias.tipo` suma **`'restituidos'`** al final (`database/schema.sql:751`; `TIPOS_LICENCIA`, `services/miEspacioReglas.js:64`). Es un tipo y no una marca sobre `vacaciones` por tres razones:
- El reparto recorre solo `tipo === 'vacaciones'` (línea 466): con un tipo propio, la carga del caso A queda afuera sin tocar el reparto.
- Tiene su insignia, su filtro, su nombre en la agenda y su nota.
- Hay 16 líneas con `'vacaciones'` en `miEspacioReglas.js` y 5 en `miEspacioResumen.js` que, en su mayoría, no tienen que verla.

Las que sí tienen que verla se listan en la sección 7: el día entero, la persona a cargo del titular, `FRASE_DE_LA_LICENCIA` y los nombres.

**Dos tablas nuevas** (las tablas pasan de 43 a 45):
- `mi_espacio_restituciones`, **los pedidos**:
  - `id`, `usuario_id` (FK `usuarios`) y `licencia_id` (las vacaciones originales, FK `mi_espacio_licencias`);
  - `anio`, la licencia de origen;
  - `caso`, enum `'tomar'` o `'restituir'`;
  - `dias`, los que se pidieron;
  - `primer_asueto`, DATE, del que sale el plazo;
  - `carga_id` (en A, la carga `restituidos`, FK `mi_espacio_licencias`; en B, NULL);
  - `activo` (baja lógica), `created_at` y `updated_at`. En B, `created_at` es el día del pedido: la fecha de la nota y la habilitación de los días.
- `mi_espacio_restituibles`, **la foto**:
  - `id`, `licencia_id` (las vacaciones, FK ON DELETE CASCADE) y `feriado_id` (FK `feriados`);
  - `fecha`, el día;
  - `restitucion_id` (FK `mi_espacio_restituciones`, NULL mientras no se pidió);
  - `created_at`;
  - clave única `(licencia_id, fecha)`.

Sin `CHECK`: valida la API. Los nombres exactos son del plan.

**La foto se saca en la transacción del feriado:**
- **Alta.** `crearFeriado` (`controllers/feriadosController.js:125`, hoy un solo `INSERT`) pasa a una transacción. Después del `INSERT`, anota con `INSERT IGNORE` cada día que ese feriado deja de hacer hábil (`fechasQueCambianDiasHabiles`, `services/feriadosReglas.js:208`, contra los otros feriados activos), por cada carga activa de tipo `vacaciones` o `restituidos` de cualquier persona que incluya ese día y lo descuente (del arranque en adelante). Uno que se repite, en cada año en que rige dentro de esas cargas.
- **Corrección.** `corregirFeriado` (línea 146) hace lo mismo después del `UPDATE`, y borra las fotos de ese feriado cuya fecha ya no es una de sus fechas y que todavía no se pidieron. Las de un pedido quedan: la regla ve que ese día volvió a ser hábil y el Resumen dice «Revisá…» (sección 4).
- **«Se pasó al».** `cambiarRige` (línea 209), con `pasa_al`, hace lo mismo con el día que carga `cargarElDiaAlQueSePaso`.
- **«No rige» y la baja** no tocan la foto: el día vuelve a ser hábil y deja de ser restituible por la regla.

**Migración** `database/updates/migracion-mi-espacio-restituciones.sql`: el `MODIFY` del enum con `'restituidos'` al final y los dos `CREATE TABLE IF NOT EXISTS` (primero los pedidos). Es aditiva y repetible, y va **antes** del código, porque es obligatoria. `estadosDe` (`services/miEspacioDatos.js:77`) lee las dos tablas: sin ellas, todo lo de Mi espacio que lee el estado de una persona da 500, y Configuración → Feriados no puede cargar ni corregir un feriado. El código anterior anda con la estructura nueva: no la lee y nunca guarda `'restituidos'`. No carga datos: los feriados ya cargados no generan fotos.

**Vuelta atrás** `rollback-mi-espacio-restituciones.sql`, después de volver a los archivos anteriores:
- pasa las cargas `'restituidos'` a `'vacaciones'` (siguen en Configuración; en Mi espacio pasan a descontar de las licencias, y puede aparecer un faltante ámbar);
- borra las dos tablas, primero la foto;
- vuelve el enum a nueve valores.

Se pierden los pedidos y la foto. Las vacaciones originales vuelven a contar los días con los feriados de hoy, como antes. Si también se deshace «Sumar al mes anterior», este va **antes** que `rollback-mi-espacio-horas-mes-anterior.sql`.

`schema.sql`, `tests/schema.test.js` (las tablas, el enum, la migración dos veces desde la estructura de main y la vuelta atrás) y la base local del `.env` (la suite la necesita: la migración se corre en la copia de la rama).

## 7. Las reglas (puras) y lo que cambia

En `services/miEspacioReglas.js`, salvo que se diga otra cosa. Ninguna tira. Los textos los arma el servidor (Ruling 19).

**Nuevas:**
- **`plazoDeRestitucion(primerAsueto, feriados)`.** El último día hábil del mes que está 4 meses después. Ejemplos: 24/12/2026 → 30/04/2027; 24/12/2025 → 29/04/2026; 12/03/2027 → 30/07/2027; 31/10/2027 → 29/02/2028.
- **`casoDeRestitucion(anio, plazo)`.** `'tomar'` si `venceLaLicencia(anio) < plazo`; si no, `'restituir'`.
- **`restitucionesDe(estado, opciones)`.** Los grupos de una persona, `[{ licencia_id, anio, caso, dias, fechas, primer_asueto, plazo, situacion, restitucion_id, carga_id, revisar }]`.
  - Tiene en cuenta la foto, las fechas y los feriados de hoy, el reparto y los pedidos.
  - `situacion` es `'por_restituir'`, `'pedida'` (B), `'cargada'` (A) o `'perdida'`.
  - `revisar` es el texto del «Revisá…» o `''`.
- **`hastaDeLosRestituidos(desde, dias, feriados)`.** El N-ésimo día hábil desde «Desde».
- **`validarRestituidos(entrada, contexto)`.** La validación de la carga del caso A, con los errores en su campo:
  - el grupo existe, es del caso A, está por restituir y no pasó el plazo;
  - «Desde» va después de las vacaciones y a más tardar el plazo;
  - las fechas son los N días hábiles;
  - no se superpone con otra licencia.
- **Los textos:**
  - el aviso A, con dos variantes: antes del 31/12, «Como esa licencia vence el 31/12/2026, antes del plazo, …»; desde el 01/01, «Como esa licencia ya venció, …»;
  - el aviso B, la línea de la fila en cada situación y la oración de la banda;
  - «Vence pronto», el email, el «Revisá…» y el del modal de Feriados.

**Cambian:**
- **`diasQueDescuentan`** (línea 420). En `vacaciones` y `restituidos`, suma a los días hábiles los días restituibles de esa carga (sección 4), en todas las situaciones. Así la carga conserva sus días.
- **`ordinariasDe`** (línea 387). Por cada pedido B activo, suma a la licencia de su `anio` una mitad más, `{ dias, habilita: el día del pedido }`, que no se pierde con «Perdés» mientras quede un día libre, como el resto. Por eso `porHabilitarDe` (línea 604) y `alcanceDeLaCarga` (línea 2062) no cambian: la mitad del pedido ya está habilitada.
- **`repartoDeVacaciones`** (línea 455). Devuelve también la licencia de cada día (`porFecha`), para saber la licencia de origen. La regla del reparto no cambia.
- **`calcular`** (línea 1728). Suma `restituciones` (las de `restitucionesDe`), con las mismas `ocupadas` y los mismos feriados.
- **`esDiaEntero`** (línea 769, `TIPOS_DE_DIA_ENTERO`). Suma `'restituidos'`: pasa a Configuración y se ve en «Hoy no están» como cualquier ausencia de día entero.
- **`NOMBRES_TIPO`, `TIPOS_POR_MODALIDAD` y `TIPOS_CON_NOTA`.** Suman «Días restituidos», en planta y en contrato.
  - En «Cargar licencia», el tipo aparece solo mientras haya un grupo A por restituir. Hay una opción por grupo («2 de la 2024 · empezar hasta el 30/04»), y para los demás tipos `restituidos` no es elegible.
  - Una carga `restituidos` no cambia de tipo, y ninguna otra pasa a serlo.
- **La persona a cargo del titular** (`autorizadoSoloVacaciones`, línea 129, en `controllers/miEspacioController.js:306`). Acepta también `restituidos`: son vacaciones. `limiteParaCambiarTipo` no aplica, porque el tipo no cambia.
- **`FRASE_DE_LA_LICENCIA`** (`services/miEspacioEventosReglas.js:995`). Suma «tus días restituidos».
- **`avisosDeVencimiento`** (línea 2780). Suma dos avisos por grupo por restituir, cada uno una vez:
  - desde que el grupo aparece hasta el plazo;
  - desde 5 días hábiles antes del plazo (`restarDiasHabilesCon`) hasta el plazo.

  Las claves van en `mi_espacio_avisos` y entran en `varchar(40)`, por ejemplo `restitucion-<licencia>-<anio>-<AAAAMMDD>-1` y `…-2`, con el primer asueto. Como hoy, la corrida no se lo manda a quien ese día está de licencia (`ausentesEn`, `services/miEspacioAvisos.js`): le llega el primer día que vuelve.
- **`faltantesDe` no cambia.** Un grupo por restituir no es un faltante: no frena nada ni prende la marca. La marca la prende «Vence pronto».

**En `services/miEspacioResumen.js`:**
- **`resumenDe`** (línea 535) suma:
  - `restituciones`, el aviso de cada grupo por restituir, con su botón;
  - `para_revisar`, el «Revisá…» de los grupos ya pedidos que cambiaron;
  - en la bajada (`bajadaDe`, línea 307), una oración por grupo, con `vence: true` solo los últimos 30 días;
  - en `vence_pronto` (`venceProntoDe`, línea 139), los grupos por restituir de los últimos 30 días corridos antes del plazo, con su `accion`: «Cargar los días restituidos» (tipo `restituidos`, con el grupo) o «Pedir la restitución».
- **`filasDeLicencias`** (línea 828). Cada fila de vacaciones suma `restituciones`: la línea de cada grupo con su situación y, si está por restituir, su botón. La fila `restituidos` dice «Restituidos de la licencia 2024 por los asuetos del 24/12 y el 31/12/2026.» en lugar del reparto.
- **`tiposDe`** (línea 510). La opción de «Días restituidos» por grupo.

**En `services/miEspacioNota.js`:**
- **`notaDeLicencia`** (línea 213). Un cuerpo para `restituidos` (sección 12), con los asuetos que le pasa el controlador. Las vacaciones originales siguen con sus 19 días (por `diasQueDescuentan`).
- **Nueva: `notaDeRestitucion(pedido, { fecha, persona })`.** La nota B, con la misma estructura, así `htmlDeLaNota` y `renderNotaDocx` (`services/miEspacioNotaWord.js`) no cambian.
- **Nueva: `textoDeLosAsuetos(fechas)`.** «de los días jueves 24 y jueves 31 de diciembre de 2026» o, con varios meses o años, «de los días miércoles 24, viernes 26 y miércoles 31 de diciembre de 2025 y viernes 2 de enero de 2026».

**En `services/feriadosReglas.js` y los datos:**
- **`fotosDelFeriado(fila, cargas, otrasFilas, opciones)`** (pura): qué días de qué cargas entran en la foto.
- **`licenciasQueIncluyen`** (`services/miEspacioDatos.js:425`) cuenta también cuántas son vacaciones con el día restituible.

## 8. La API

Todas van con `authMiddleware` y sobre `req.user.userId`: solo el dueño. Un id de otra persona, que no existe o dado de baja da el mismo 404, «Restitución no encontrada». Las rutas nuevas van en `RUTAS_MI_ESPACIO` de `tests/permisos.test.js`.

- **`GET /mi-espacio/resumen`, `GET /mi-espacio/licencias` y `POST /mi-espacio/licencias/calculo`:** las claves nuevas de la sección 7.
- **`POST /mi-espacio/licencias`** con `tipo: 'restituidos'`, `restitucion: { licencia_id, anio }` y `desde`. El servidor calcula el «Hasta» y, en la misma transacción, crea la carga y su pedido `'tomar'` y enlaza la foto. Errores, 400 con su campo:
  - el grupo ya no está por restituir (también si pasó el plazo);
  - «Desde» fuera de rango;
  - la superposición.

  `PUT /mi-espacio/licencias/:id` cambia «Desde» (el «Hasta» se vuelve a calcular), la nota y «Mostrar». `DELETE` la da de baja y, si no pasó el plazo, deja el grupo otra vez por restituir. El paso a Configuración, como siempre.
- **`POST /mi-espacio/restituciones`** con `{ licencia_id, anio }`: registra el pedido B. Responde 201 con `{ id }` y «Restitución pedida: los 2 días volvieron a tu licencia 2025.». Un grupo que no está por restituir o que es del caso A, 400.
- **`DELETE /mi-espacio/restituciones/:id`:** hasta el plazo. Después, 409: «Ya pasó el plazo: la restitución no se puede borrar.».
- **`GET /mi-espacio/restituciones/:id/nota`** y **`…/word`**: la nota B, como las de las licencias (sin guardar nada, con `disposicionDeAdjunto`).
- **`GET /feriados/afectadas`, `POST /feriados` y `PUT /feriados/:id`** (`adminOnly`): suman `vacaciones_para_restituir` (cuántas) y `plazo_de_restitucion` (desde ese día), sin decir de quién.

Cada escritura de Mi espacio va en una transacción que bloquea primero, como las de hoy.

## 9. Las pantallas (según la maqueta)

**El Resumen** (`htmlDelResumen`, `public/js/mi-espacio.js:453`, hoy los faltantes, la banda, el resto y «Hoy y mañana»):
- **El aviso de los días por restituir** va **entre la banda y «El resto de AAAA»** (decisión 9). Es ámbar, como el de los faltantes, con el texto y el botón de cada grupo. Arriba de todo quedan los faltantes, lo de Configuración y el «Revisá…» de los grupos ya pedidos.
- **La banda:** la oración del grupo al final de la bajada, en ámbar los últimos 30 días.
- **«Vence pronto»:** la entrada con el talón del plazo, «Vencen el viernes 30/04, en 29 días.» y el botón; prende la marca de la pestaña.
- **El teléfono:** el aviso queda después de la regla, dentro del orden de una columna.

**La lista de Licencias:**
- debajo de la fila de unas vacaciones, la línea de cada grupo (`.me-restituir-linea`):
  - por restituir, con ▲, en ámbar y con su botón;
  - cargada, pedida («Restitución pedida el 01/04/2027: los 2 días volvieron a la licencia 2025.», con «Word» y «Borrar el pedido») o perdida, en gris;
- la carga del caso A, con la insignia azul «Días restituidos», «Word», «Editar» y su propio filtro.

**«Cargar licencia» con «Días restituidos»:**
- se abre desde el botón (el aviso, «Vence pronto», la fila) con el grupo ya elegido, o eligiendo la opción;
- «Desde», con la ayuda «Los 2 días van juntos: elegí desde cuándo y Mi espacio pone el «Hasta». Podés empezar del 11/01/2027 al viernes 30/04/2027.»;
- «Hasta», de solo lectura, con «Lo pone Mi espacio: 2 días hábiles.»;
- el cálculo: «2 días hábiles. Son los días restituidos de la licencia 2024, por los asuetos del 24/12 y el 31/12/2026.»;
- la nota, «Mostrar» y el paso a Configuración, como unas vacaciones;
- al guardar, el segundo paso con la nota A y «Descargar Word».

**«Pedir la restitución»:** un modal con el recuadro («2 días hábiles vuelven a tu licencia 2025 (vence el 31/12/2027), por los asuetos del 24/12 y el 31/12/2026. Al pedirla se arma la nota al Director General y los días vuelven enseguida.»), «Así sale la nota» con la hoja y «Pedir la restitución». Después, el segundo paso: «Los 2 días volvieron a tu licencia 2025: te quedan 23 días de vacaciones.», la nota y «Descargar Word».

**Configuración → Feriados** (`public/js/feriados.js`). Debajo de la fecha del modal, con la cuenta del servidor:
- todas son vacaciones: «1 licencia cargada lo incluye: son vacaciones, y ese día queda para restituir con nota hasta el 30/04/2027.»;
- hay de los dos: «3 licencias cargadas lo incluyen. En 2 vacaciones, ese día queda para restituir con nota hasta el 30/04/2027; la otra se recalcula.»;
- ninguna es de vacaciones: el texto de hoy.

Sin nombres. `VERSION_FERIADOS` sube, de `'20261209'` a `'20261210'`.

`VERSION_MI_ESPACIO` sube, de `'20261219'` a `'20261220'`. Los estilos van en el `<style>` de `mi-espacio.html`, con los tokens `--sg-*`, como `propuesta.css` de la maqueta.

## 10. El email (la corrida de las 8:15)

En el mismo email de vencimiento de Mi espacio (`services/miEspacioAvisos.js`), con `vencimientoMiEspacioTemplate`, el renglón de cada grupo. Si es el único, el asunto es «RPAD: tenés días para restituir en Mi espacio» y el texto el de la maqueta: «Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierden.», con «Ver en Mi espacio». Lo demás del email no cambia: el destinatario, el remitente, el marco, las claves que se anotan solo si sale y el candado.

## 11. Configuración, las Notas Digitales y lo demás

- **La carga del caso A pasa a Configuración → Licencias** como unas vacaciones: el mismo paso, el mismo aviso y la insignia «Cargada desde Mi espacio». Del titular, con persona a cargo.
- **Las vacaciones originales no cambian en Configuración:** guardan solo sus fechas.
- **Las Notas Digitales, la auditoría y Correos → Estado** siguen viendo el asueto como día no hábil, como hoy. Las demás licencias de Mi espacio, «Hoy no están», la agenda (que muestra la carga A con su nombre) y Métricas no cambian su regla.

## 12. Las notas en Word (textos aprobados en la ronda 4)

Tienen el mismo encabezado, saludo, cierre y firma que la nota de cada licencia (`services/miEspacioNota.js`), y salen en la misma hoja A4, sin membrete.

- **A, la carga de los días restituidos** (su fecha es la de la carga, `updated_at`, como siempre):
  > Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de dos (2) días hábiles de mi licencia anual ordinaria 2024, restituidos por los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones, a partir del día lunes 12 de abril de 2027.
- **B, la restitución** (su fecha es el día del pedido):
  > Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar la restitución a mi licencia anual ordinaria 2025 de dos (2) días hábiles, correspondientes a los asuetos de los días jueves 24 y jueves 31 de diciembre de 2026, declarados durante mis vacaciones.
- **Con un solo día:** «un (1) día hábil», «restituido por el asueto del día jueves 24 de diciembre de 2026, declarado durante mis vacaciones».
- **Los archivos:** «Nota de licencia - Días restituidos - 2027-04-12.docx» (con el «Desde») y «Nota de restitución - Licencia 2025 - 2027-04-01.docx» (con el día del pedido).

## 13. Lo que no cambia

- El reparto por carga, «Perdés», lo que se habilita y hasta dónde llega una carga, el saldo inicial y las licencias que no son de vacaciones.
- Configuración → Licencias y sus reglas, las Notas Digitales, la planilla de contrato, la agenda (salvo el nombre del tipo y la frase), Métricas y Reportes.
- La regla de los feriados para todo lo que no son las vacaciones de Mi espacio.

## 14. Despliegue (cPanel, sin terminal)

Va después de main 39eef2b, ya en producción, y **antes de los asuetos de fin de año** (que se suelen declarar a mediados de diciembre).
1. En phpMyAdmin, `migracion-mi-espacio-restituciones.sql`, **antes** de subir el código, con su verificación comentada.
2. Subir los archivos y Restart. Sin Run NPM Install, sin variables de entorno nuevas y sin cron nuevo: el email va en la corrida de las 8:15.
3. Con Ctrl+F5, solo mirar:
   - Mi espacio abre sin errores;
   - en Configuración → Feriados, el modal de un feriado nuevo, sin guardarlo, con una fecha dentro de unas vacaciones cargadas, si hay alguna (en producción todavía no hay).

## 15. Límites sabidos

- **Lo cargado antes no se reconstruye.** Los feriados cargados antes del despliegue no generan restituciones, y el saldo inicial no carga restituciones pendientes.
- **Manda el orden en el RPAD.** Si la persona carga las vacaciones después de que administración cargó el asueto, aunque las haya pedido en papel antes, no hay restitución: la regla del usuario es «carga licencia y luego carga asueto». Al revés, un feriado corregido a una fecha que cae en unas vacaciones cuenta como cargado después.
- **El plazo del modal de Feriados** se cuenta desde el día que se carga. Si esas vacaciones ya tenían días por restituir de un asueto anterior, su plazo real es el de ese.
- **El email no llega a quien está de licencia ese día.** Si la persona está de licencia los 5 días hábiles anteriores al plazo, el segundo email no llega. El aviso y «Vence pronto» siguen.

## 16. Tests (la suite completa antes y después)

- **Reglas:**
  - `plazoDeRestitucion`, con los cuatro ejemplos, el 29/04/2026 por el feriado provincial y un feriado nuevo en el último día;
  - `casoDeRestitucion`, con el borde de octubre;
  - `restitucionesDe`, en cada situación: dos licencias, otro asueto después de pedir, los cambios (acortar, alargar, borrar, la baja del asueto, «no rige») y la recursión;
  - que las vacaciones conserven sus días y no aparezca un «Perdés» por un asueto;
  - la mitad B en `ordinariasDe`;
  - `validarRestituidos` en sus bordes;
  - los textos, con el singular y las dos variantes del aviso A;
  - `avisosDeVencimiento`, con sus dos claves y la persona de licencia.
- **El Resumen y la lista:** el aviso entre la banda y el resto, la bajada, «Vence pronto» de los últimos 30 días, las líneas de la fila, la insignia y la opción del tipo.
- **La nota:** los cuerpos A y B, `textoDeLosAsuetos` (un mes, dos meses, dos años, un día) y el Word igual a la vista.
- **La API (Docker):**
  - la foto en el alta, la corrección y «Se pasó al», en una sola transacción con el feriado;
  - la carga A con el «Hasta» calculado, el pedido B y el borrado antes y después del plazo;
  - lo ajeno da 404, y los 400 con su campo;
  - el modal de Feriados, sin nombres.
- **La corrida** (Docker y Mailpit, con el reloj fijo): los dos emails, una sola vez, y el de quien estaba de licencia.
- **La página** (`mi-espacio-frontend`, `feriados-frontend`): todo lo de la sección 9, el escapado, el teléfono y los contrastes.
- **`schema.test.js`, `paginas.test.js`** (`VERSION_MI_ESPACIO` y `VERSION_FERIADOS`) **y `permisos.test.js`.**
- **Los tests de hoy que esperan que un asueto recalcule unas vacaciones** cambian solo para las vacaciones con foto. Sin foto, el recálculo sigue igual: el feriado ya estaba.

## 17. Decisiones de la sesión, revisadas por el usuario

El 31/10/2026 el usuario aprobó todas las decisiones, en una sexta ronda de preguntas (las 1, 3, 5 y 6) y al ver la maqueta (las demás: «lo único, esta franja», la del punto 9 de la sección 3).

1. **Un tipo nuevo**, `restituidos` («Días restituidos»), con insignia azul y su filtro, y no una marca sobre vacaciones (sección 6). En «Cargar licencia», una opción por grupo. *Aprobada.*
2. **«Vencen» en plural** en «Vence pronto» y en el email, como el resto de Mi espacio.
3. **El aviso A antes del 31/12** dice «Como esa licencia vence el 31/12/2026, antes del plazo, …», y desde el 01/01, «Como esa licencia ya venció, …». *Aprobada.*
4. **En B, las vacaciones originales siguen con sus días** después del pedido. Lo que vuelve es un agregado a la licencia de origen (la mitad del pedido, sección 7), así vuelve justo a esa licencia y no a la última que usó la carga.
5. **El pedido B no se puede borrar después del plazo** (409). La carga A se puede borrar como cualquier licencia, pero los días quedan perdidos. *Aprobada.*
6. **El «Revisá tus días restituidos…»** de lo ya pedido va arriba de todo, con lo de Configuración. Solo el aviso de lo que está por restituir va entre la banda y el resto. *Aprobada.*
7. **La oración de la banda** va en ámbar solo los últimos 30 días; antes, en el color de la frase.
8. **Los textos que redactó la maqueta:** el aviso B, las líneas de la fila, la ayuda y el cálculo de «Cargar licencia», el modal B y su segundo paso, el email y su asunto, y los dos textos del modal de Feriados.
9. **Los nombres de los dos archivos** de la sección 12.
10. **Las tandas** (sección 4): los grupos de una misma tanda comparten el plazo, y un asueto después de un pedido arma una tanda nueva. Así se cumplen las decisiones 11 y 12 a la vez.
11. **El plazo del modal de Feriados** se cuenta desde el día que se carga.
12. **La carga A no cambia de tipo**, y ninguna otra pasa a `restituidos`.
13. **La recursión** sigue la misma regla, siempre como el caso A.
14. **La vuelta atrás** pasa las cargas `restituidos` a vacaciones.
15. **La carga A acepta persona a cargo del titular**, como unas vacaciones.
16. **El email nombra las vacaciones** («del 11/12/2026 al 08/01/2027»); el aviso del Resumen no, porque se ve al lado.

## 18. Lo que queda para el constructor

Le toca decidir:
- los nombres exactos de las tablas, las columnas, las claves de la API, las funciones nuevas y las claves de `mi_espacio_avisos`;
- los mensajes de los 400 nuevos;
- cómo se reparte el trabajo entre el servidor y las copias del navegador, con sus paridades;
- los detalles de diseño que la maqueta no muestra, siguiendo el `<style>` real de `mi-espacio.html` y `propuesta.css` de la maqueta.
