# Feriados: las fechas de 2026 y 2027, verificadas

Fecha: 26/10/2026. Es la lista que pide la sección 5 de `2026-10-26-feriados-design.md` para escribir `migracion-feriados-datos.sql`. Son los días no hábiles del personal municipal de Comodoro Rivadavia, **sin los 9 feriados fijos del sistema** (`FERIADOS_FIJOS`: 01-01, 03-24, 04-02, 05-01, 05-25, 06-20, 07-09, 12-08 y 12-25).

**Cómo se verificó.** Cada fecha sale de la norma que la fija, leída en una fuente oficial: el Boletín Oficial de la Nación, el texto de las leyes en argentina.gob.ar, la página oficial de feriados de la Jefatura de Gabinete, el Boletín Oficial del Chubut y la intranet de la Municipalidad de Comodoro Rivadavia. Lo que solo apareció en la prensa lo dice la columna Fuente, y además va a «Dudas para el usuario». Los días de la semana se calcularon con `Date.UTC`.

**Lo nuevo que hay que saber antes de escribir el SQL:**
- **El lunes 9/11/2026 es feriado nacional** por la visita del Papa (DNU 1103/2026, publicado el 28/09/2026). No estaba en la charla.
- **El 13/12 es provincial, no municipal.** Lo instituye la Ley I N° 85 del Chubut, la misma del 28/7. Va con el tipo `provincial` (De Chubut).
- **Chubut cambió su régimen de feriados el 22/10/2026** (Ley I N° 857). El 28/7 queda inamovible, pero el 30/4, el 3/11 y el 13/12 pasan a ser trasladables. El 13/12/2026 cae domingo y el gobierno provincial todavía no decidió si lo mueve.
- **Los dos de Comodoro no tienen una ordenanza permanente.** El aniversario (23/2) y el Día del Empleado Municipal (8/11) son asuetos administrativos: el intendente los declara cada año por resolución, y a veces los corre de día.
- **La página oficial todavía no publica 2027**, como dijo el usuario: con `?year=2027` muestra 2026. Las fechas de 2027 de abajo salen de la ley (Carnaval, Semana Santa y los trasladables de lunes a viernes se fijan solos). Lo que la ley deja a un decreto va en «Lo que no está decretado todavía».

## Cómo leer las tablas

- **Tipo:** `nacional_movil` (Nacional móvil), `provincial` (De Chubut), `municipal` (De Comodoro) y `no_laborable` (No laborable), los de la spec.
- **Se repite:** Sí solo en los locales de fecha fija (decisión del usuario). Esas filas se cargan **una sola vez, con la fecha de 2026**: en la tabla de 2027 aparecen como «proyección», no como fila nueva.
- **Aclaración:** marca los que caen en fin de semana y los que coinciden con uno de los 9 fijos.
- Los nombres son los de la norma o los de la página oficial, sin abreviar.

## 2026

| Fecha | Día | Nombre | Tipo | `trasladado_de` | Se repite | Aclaración | Fuente |
|---|---|---|---|---|---|---|---|
| 2026-02-16 | lunes | Carnaval | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1; [página oficial 2026][pagina] |
| 2026-02-17 | martes | Carnaval | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1; [página oficial 2026][pagina] |
| 2026-02-23 | lunes | Aniversario de Comodoro Rivadavia | `municipal` | — | Sí | | Decisión del usuario. Asueto anual por resolución del intendente: para 2026, Res. N° 0220-26, [según la prensa][res0220]. Antecedente oficial: [Res. 368/23][res368] |
| 2026-03-23 | lunes | Día no laborable con fines turísticos | `no_laborable` | — | No | | [Resolución 164/2025 JGM][res164] (B.O. 26/12/2025) |
| 2026-04-02 | jueves | Jueves Santo | `no_laborable` | — | No | **Coincide con un fijo:** Malvinas (04-02) | [Ley 27.399][ley27399], art. 1 («Días no laborables»); [página oficial 2026][pagina] |
| 2026-04-03 | viernes | Viernes Santo | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1; [página oficial 2026][pagina] |
| 2026-06-15 | lunes | Paso a la Inmortalidad del General Don Martín Miguel de Güemes | `nacional_movil` | 2026-06-17 | No | El 17/6 cae miércoles: pasa al lunes anterior | [Ley 27.399][ley27399], arts. 1 y 6; [página oficial 2026][pagina] |
| 2026-07-10 | viernes | Día no laborable con fines turísticos | `no_laborable` | — | No | | [Resolución 164/2025 JGM][res164] |
| 2026-07-28 | martes | Desembarco de los colonos galeses (Gesta galesa) | `provincial` | — | Sí | | [Ley I N° 85][ley85], art. 1, inc. a); inamovible por la [Ley I N° 857][ley857], art. 2 |
| 2026-08-17 | lunes | Paso a la Inmortalidad del General José de San Martín | `nacional_movil` | — | No | Cae lunes: no se traslada | [Ley 27.399][ley27399], arts. 1 y 6; [página oficial 2026][pagina] |
| 2026-10-12 | lunes | Día del Respeto a la Diversidad Cultural | `nacional_movil` | — | No | Cae lunes: no se traslada | [Ley 27.399][ley27399], arts. 1 y 6; [página oficial 2026][pagina] (la llama «Día de la Raza») |
| 2026-11-08 | domingo | Día del Empleado Municipal | `municipal` | — | Sí | **Fin de semana** | Decisión del usuario. Asueto anual por resolución del intendente; la de 2026 no salió todavía. Antecedente oficial: [Res. 2476-24][res2476] |
| 2026-11-09 | lunes | Visita de Su Santidad el Papa León XIV | `nacional_movil` | — | No | Feriado nacional extraordinario, solo de 2026 | [DNU 1103/2026][dnu1103], art. 2 (B.O. 28/09/2026) |
| 2026-11-23 | lunes | Día de la Soberanía Nacional | `nacional_movil` | 2026-11-20 | No | El 20/11 cae viernes: pasa al lunes siguiente | [Ley 27.399][ley27399], arts. 1 y 6; [página oficial 2026][pagina] |
| 2026-12-07 | lunes | Día no laborable con fines turísticos | `no_laborable` | — | No | | [Resolución 164/2025 JGM][res164] |
| 2026-12-13 | domingo | Día del Petróleo Nacional | `provincial` | — | Sí | **Fin de semana.** Se puede trasladar: ver «Lo que no está decretado todavía» | [Ley I N° 85][ley85], art. 1, inc. b); trasladable por la [Ley I N° 857][ley857], arts. 3 y 6 |

**16 fechas:** 12 nacionales (7 móviles y trasladables, el feriado del Papa, el Jueves Santo y 3 turísticos), 2 de Chubut y 2 de Comodoro.

## 2027

| Fecha | Día | Nombre | Tipo | `trasladado_de` | Se repite | Aclaración | Fuente |
|---|---|---|---|---|---|---|---|
| 2027-02-08 | lunes | Carnaval | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1. Pascua: 28/03/2027 (ver abajo) |
| 2027-02-09 | martes | Carnaval | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1 |
| 2027-02-23 | martes | Aniversario de Comodoro Rivadavia | `municipal` | — | Sí | Proyección de la fila de 2026 | La de 2026 |
| 2027-03-25 | jueves | Jueves Santo | `no_laborable` | — | No | | [Ley 27.399][ley27399], art. 1 |
| 2027-03-26 | viernes | Viernes Santo | `nacional_movil` | — | No | | [Ley 27.399][ley27399], art. 1 |
| 2027-06-21 | lunes | Paso a la Inmortalidad del General Don Martín Miguel de Güemes | `nacional_movil` | 2027-06-17 | No | El 17/6 cae jueves: pasa al lunes siguiente | [Ley 27.399][ley27399], art. 6 |
| 2027-07-28 | miércoles | Desembarco de los colonos galeses (Gesta galesa) | `provincial` | — | Sí | Proyección de la fila de 2026. Inamovible | La de 2026 |
| 2027-08-16 | lunes | Paso a la Inmortalidad del General José de San Martín | `nacional_movil` | 2027-08-17 | No | El 17/8 cae martes: pasa al lunes anterior | [Ley 27.399][ley27399], art. 6 |
| 2027-10-11 | lunes | Día del Respeto a la Diversidad Cultural | `nacional_movil` | 2027-10-12 | No | El 12/10 cae martes: pasa al lunes anterior | [Ley 27.399][ley27399], art. 6 |
| 2027-11-08 | lunes | Día del Empleado Municipal | `municipal` | — | Sí | Proyección de la fila de 2026 | La de 2026 |
| 2027-12-13 | lunes | Día del Petróleo Nacional | `provincial` | — | Sí | Proyección de la fila de 2026. Cae lunes: la Ley I N° 857 no lo mueve | La de 2026 |

**11 fechas: 7 filas nuevas y 4 proyecciones.** Ninguna cae en fin de semana ni coincide con un fijo (el 24/3/2027, fijo, cae miércoles, el día antes del Jueves Santo).

**Semana Santa y Carnaval de 2027.** La ley los fija por la Pascua, que en 2027 es el domingo 28/03. Se calculó con el algoritmo gregoriano de la Pascua, el mismo que da el 05/04/2026: esas fechas coinciden con la página oficial de 2026 (Carnaval 16 y 17/2, Jueves Santo 2/4, Viernes Santo 3/4). Carnaval son los 48 y 47 días antes de la Pascua, y el Jueves y el Viernes Santo, los 3 y 2 días antes.

**Los trasladables de 2027.** El art. 6 de la Ley 27.399 traslada solo, sin decreto: martes y miércoles al lunes anterior, jueves y viernes al lunes siguiente. Desde que salga el calendario oficial de 2027, conviene compararlo con esta tabla.

## Aparte, a confirmar con el usuario: otros feriados de Chubut

Son no laborables provinciales que la charla no mencionó. La Ley I N° 85 los hace obligatorios para la «Administración Pública Provincial». La Ley I N° 857 invita a los municipios a adoptar el calendario provincial (art. 12). La prensa local dice que en 2026 cerraron también los organismos municipales, y en 2019 la Municipalidad de Comodoro avisó que no atendía el 30/4. **No van en la precarga hasta que el usuario diga si rigen para el personal municipal.**

| Fecha | Día | Nombre | Tipo | `trasladado_de` | Se repite | Aclaración | Fuente |
|---|---|---|---|---|---|---|---|
| 2026-04-30 | jueves | Plebiscito de 1902 | `provincial` | — | — | Antes de la Ley I N° 857 era de fecha fija | [Ley I N° 85][ley85], art. 1, inc. c) (incorporado por la Ley 4841) |
| 2026-11-02 | lunes | Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches | `provincial` | 2026-11-03 | — | El 3/11 cae martes: pasa al lunes anterior. El 3/11 queda hábil (art. 8) | Ley I N° 547; [Ley I N° 857][ley857], arts. 3 y 4 («el traslado opera de pleno derecho») |
| 2027-04-30 *o* 2027-05-03 | viernes *o* lunes | Plebiscito de 1902 | `provincial` | — *o* 2027-04-30 | — | Depende de cómo se lea la excepción del art. 5: ver «Dudas» | [Ley I N° 857][ley857], arts. 4 y 5 |
| 2027-11-01 | lunes | Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches | `provincial` | 2027-11-03 | — | El 3/11 cae miércoles: pasa al lunes anterior | [Ley I N° 857][ley857], art. 4 |

Como son trasladables, si rigen convienen **año por año, sin «se repite»** (ver la duda 2).

## No van: lo que no rige para el personal municipal de Comodoro

- **Martes 10 y miércoles 11/11/2026:** feriados del DNU 1103/2026 solo en Córdoba y la Ciudad de Buenos Aires (el 10) y en la Provincia de Buenos Aires (el 11).
- **Los días no laborables religiosos** de la Ley 27.399 (arts. 2 y 3: Pésaj, Rosh Hashaná, Iom Kipur, Año Nuevo Islámico, el fin del Ramadán y la Fiesta del Sacrificio) y el **24/4** de la Ley 26.199: son solo para quienes profesan esas religiones o son de origen armenio. Cada persona los pide como licencia.
- **El 25/9, Día Provincial de la Ballena** (Ley I N° 85, art. 2): solo para las dependencias provinciales de Puerto Pirámides.
- **El 28/9, Día del Empleado de Comercio:** es del convenio de comercio, no del personal municipal.

## Lo que no está decretado todavía

**Nación:**
- **Los días no laborables con fines turísticos de 2027.** Hasta tres, en lunes o viernes, fijados por la Jefatura de Gabinete (Ley 27.399, art. 7, «con cincuenta días de antelación al cierre del año calendario», o sea hasta el 11/11/2026). Los de 2026 salieron recién el 26/12/2025: el plazo no siempre se cumple. Cuando salgan, se cargan desde la pestaña, con el tipo `no_laborable`.
- **El 20/11/2027 cae sábado.** El [Decreto 614/2025][dec614] (art. 1) deja que la Jefatura de Gabinete lo pase al lunes 22/11 o al viernes 19/11, o lo deje en el sábado. Si lo mueve, se carga con `trasladado_de` 2027-11-20; si no, no cambia ningún día hábil.
- **Feriados extraordinarios**, como el del 9/11/2026: pueden aparecer en cualquier momento.

**Chubut:**
- **El 13/12/2026 cae domingo.** La [Ley I N° 857][ley857] (art. 6) deja que el Poder Ejecutivo provincial lo pase al lunes 14/12 o al viernes 11/12, o lo mantenga, por decreto. Para 2026 ese decreto se dicta dentro de los 30 días de la promulgación (art. 13; se promulgó el 16/10/2026, así que hasta mediados de noviembre). Al 26/10 no salió: lo busqué en los boletines del 21, 22, 23 y 26/10. Si lo mueve, se marca «En 2026 no rige» y «Se pasó al» en la fila del 13/12, y el domingo 13/12 queda hábil (art. 8).
- **El calendario provincial de 2027:** decreto antes del 30/11/2026 (art. 7). Solo cambia lo de la sección «a confirmar»: el 13/12/2027 cae lunes y el 28/7 es inamovible.

**Comodoro:**
- **El Día del Empleado Municipal de 2026** (domingo 8/11). Otros años la municipalidad corrió el asueto a un día hábil: al viernes 10/11 en 2017 ([intranet][asueto2017]) y al lunes 7/11 en 2022 (según la prensa). En 2026 el lunes 9/11 ya es feriado nacional. Si sale una resolución que lo pasa a otro día, se marca «En 2026 no rige» y «Se pasó al» con ese día.
- **Los asuetos de fin de año de 2026** (24 y 31/12, jueves). No son de todos los años por norma: el intendente los declara cada diciembre. En 2024 fueron el 24 y el 31/12 ([Res. 2852-24][res2852]), y en 2025 el 24, 26 y 31/12 y el 2/1/2026 (Res. 2809/25, según la prensa). Lo mismo para 2027.
- **Las resoluciones de 2027** del aniversario (martes 23/2) y del Día del Empleado Municipal (lunes 8/11).

## Dudas para el usuario

1. **El Día del Petróleo es de Chubut, no de Comodoro.** Lo instituye la Ley I N° 85 (art. 1, inc. b). La spec lo pone entre los de Comodoro, pero el tipo correcto es `provincial` (De Chubut). ¿Va así?
2. **El 13/12 dejó de ser de fecha fija.** Con la Ley I N° 857 se traslada solo cuando cae de martes a viernes: en 2028 cae miércoles y pasa al lunes 11/12; en 2029, jueves, y pasa al lunes 17/12; en 2030, viernes, y pasa al lunes 16/12. Solo queda en su día cuando cae lunes (2027) o cuando cae en fin de semana y el decreto anual no lo mueve (2026, 2031). Con «se repite», la mayoría de los años hay que marcar «no rige» y «se pasó al» desde la pestaña. La otra opción es cargarlo año por año, como los móviles. ¿Se repite o año por año?
3. **¿Rigen para el personal municipal el 30/4 (Plebiscito de 1902) y el 3/11 (Jura de la Bandera de los pueblos tehuelches y mapuches)?** Son no laborables provinciales, como el 28/7 y el 13/12. Si rigen, van las fechas de la sección «a confirmar».
4. **El 30/4/2027 cae viernes, y el sábado 1/5 es feriado nacional.** El art. 4 de la Ley I N° 857 lo pasaría al lunes 3/5. El art. 5 dice que no se traslada «cuando el día inmediato anterior o posterior […] sea feriado nacional y ambos, junto con el fin de semana, conformen un periodo de descanso continuo», y el viernes 30/4 con el sábado 1/5 y el domingo ya son un descanso continuo. Lo más probable es que quede el viernes 30/4, pero lo va a decir el decreto del calendario de 2027. Solo importa si la respuesta a la duda 3 es sí.
5. **Aniversario y Día del Empleado Municipal: un asueto por año, no una norma fija.** El intendente los declara cada año por resolución, con las atribuciones del art. 96, inc. 1 y 29, de la Carta Orgánica Municipal (así lo dicen las resoluciones de la intranet). No encontré una ordenanza que los fije todos los años. La de 2026 del aniversario (Res. N° 0220-26) la vi solo en la prensa: la intranet y el sitio municipal no la publican. ¿Se cargan igual con «se repite», como decidió el usuario?
6. **El viernes 2/1/2026 fue asueto administrativo municipal** (Res. 2809/25, con el 24, 26 y 31/12/2025). Lo dicen dos medios locales; no lo encontré en una fuente oficial. ¿Se precarga, con el tipo `no_laborable` (un asueto puntual)? Ya pasó, pero cuenta si se carga una licencia de enero.
7. **El tipo del 9/11/2026.** Es un feriado nacional que no es móvil: es extraordinario, de un solo año. El tipo más cercano es `nacional_movil` (Nacional móvil). ¿Va así, o se suma un tipo?
8. **El nombre del 12/10.** La Ley 27.399 lo llama «Día del Respeto a la Diversidad Cultural»; la página oficial de 2026, «Día de la Raza». ¿Cuál se usa?
9. **¿Se precargan ya las fechas de 2027 que salen de la ley?** Carnaval, Semana Santa y los tres trasladables que caen de lunes a viernes no necesitan decreto, pero la página oficial todavía no los publica. Se pueden precargar y comparar cuando salga el calendario, o esperar.

## Respuestas del usuario y lista para la precarga

El usuario contestó las dudas el 26/10/2026:
1. **El 13/12 va como De Chubut** (`provincial`), como dice la Ley I N° 85.
2. **El 13/12 va año por año,** sin «se repite», porque casi todos los años se traslada.
3. **Rigen para el personal municipal el 30/4 y el 3/11,** los dos año por año.
4. **El 30/4/2027 no se precarga:** se carga cuando salga el decreto provincial del calendario de 2027.
5. **El aniversario (23/2) y el Día del Empleado Municipal (8/11) siguen con «se repite».** El año que se corre uno, se marca «no rige» y «se pasó al» desde la pestaña.
6. **El 2/1/2026 no se trabajó.** Lo dice la Res. 2809/25 (texto confirmado por el usuario: «DECLARAR asueto administrativo para la Administración Pública Municipal para los días 24, 26, 31 de diciembre de 2025 y 02 de enero de 2026 durante toda la jornada laboral»). Se precarga el 2/1/2026, tipo `no_laborable`. Los de 2025 no van: la precarga empieza en 2026.
7. **El tipo `nacional_movil` pasa a ser `nacional` («Nacional»),** y el 9/11/2026 va con ese tipo.
8. **El 12/10 lleva el nombre de la ley:** «Día del Respeto a la Diversidad Cultural».
9. **Lo de 2027 que fija la ley se precarga ya.**

**La lista para `migracion-feriados-datos.sql`:** 28 filas, 19 de 2026 y 9 de 2027. Las que se repiten se cargan una sola vez, con la fecha de 2026.

| Fecha | Nombre | Tipo | `trasladado_de` | Se repite | Fuente |
|---|---|---|---|---|---|
| 2026-01-02 | Asueto administrativo municipal | `no_laborable` | — | No | Res. 2809/25, confirmada por el usuario; [prensa][res2809] |
| 2026-02-16 | Carnaval | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2026-02-17 | Carnaval | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2026-02-23 | Aniversario de Comodoro Rivadavia | `municipal` | — | Sí | Res. N° 0220-26 ([prensa][res0220]); antecedente [Res. 368/23][res368] |
| 2026-03-23 | Día no laborable con fines turísticos | `no_laborable` | — | No | [Resolución 164/2025 JGM][res164] |
| 2026-04-02 | Jueves Santo | `no_laborable` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2026-04-03 | Viernes Santo | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2026-04-30 | Plebiscito de 1902 | `provincial` | — | No | [Ley I N° 85][ley85], art. 1, inc. c) |
| 2026-06-15 | Paso a la Inmortalidad del General Don Martín Miguel de Güemes | `nacional` | 2026-06-17 | No | [Ley 27.399][ley27399], arts. 1 y 6 |
| 2026-07-10 | Día no laborable con fines turísticos | `no_laborable` | — | No | [Resolución 164/2025 JGM][res164] |
| 2026-07-28 | Desembarco de los colonos galeses (Gesta galesa) | `provincial` | — | Sí | [Ley I N° 85][ley85], art. 1, inc. a); [Ley I N° 857][ley857], art. 2 |
| 2026-08-17 | Paso a la Inmortalidad del General José de San Martín | `nacional` | — | No | [Ley 27.399][ley27399], arts. 1 y 6 |
| 2026-10-12 | Día del Respeto a la Diversidad Cultural | `nacional` | — | No | [Ley 27.399][ley27399], arts. 1 y 6 |
| 2026-11-02 | Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches | `provincial` | 2026-11-03 | No | [Ley I N° 857][ley857], arts. 3 y 4; [prensa][traslado3nov] |
| 2026-11-08 | Día del Empleado Municipal | `municipal` | — | Sí | Antecedente [Res. 2476-24][res2476] |
| 2026-11-09 | Visita de Su Santidad el Papa León XIV | `nacional` | — | No | [DNU 1103/2026][dnu1103], art. 2 |
| 2026-11-23 | Día de la Soberanía Nacional | `nacional` | 2026-11-20 | No | [Ley 27.399][ley27399], arts. 1 y 6 |
| 2026-12-07 | Día no laborable con fines turísticos | `no_laborable` | — | No | [Resolución 164/2025 JGM][res164] |
| 2026-12-13 | Día del Petróleo Nacional | `provincial` | — | No | [Ley I N° 85][ley85], art. 1, inc. b) |
| 2027-02-08 | Carnaval | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2027-02-09 | Carnaval | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2027-03-25 | Jueves Santo | `no_laborable` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2027-03-26 | Viernes Santo | `nacional` | — | No | [Ley 27.399][ley27399], art. 1 |
| 2027-06-21 | Paso a la Inmortalidad del General Don Martín Miguel de Güemes | `nacional` | 2027-06-17 | No | [Ley 27.399][ley27399], art. 6 |
| 2027-08-16 | Paso a la Inmortalidad del General José de San Martín | `nacional` | 2027-08-17 | No | [Ley 27.399][ley27399], art. 6 |
| 2027-10-11 | Día del Respeto a la Diversidad Cultural | `nacional` | 2027-10-12 | No | [Ley 27.399][ley27399], art. 6 |
| 2027-11-01 | Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches | `provincial` | 2027-11-03 | No | [Ley I N° 857][ley857], art. 4 |
| 2027-12-13 | Día del Petróleo Nacional | `provincial` | — | No | [Ley I N° 85][ley85], art. 1, inc. b); cae lunes: la [Ley I N° 857][ley857] no lo mueve |

En 2027 rigen además, por proyección de las filas de 2026 que se repiten, el 23/2, el 28/7 y el 8/11.

## Fuentes

**Nación:**
- **[Ley 27.399][ley27399]**, «Establecimiento de feriados y fines de semana largos» (B.O. 18/10/2017, N° 33732). Art. 1: los feriados inamovibles (incluidos el Carnaval y el Viernes Santo), los trasladables (17/6, 17/8, 12/10 y 20/11) y el Jueves Santo como día no laborable. Art. 6: la regla del traslado. Art. 7: hasta tres días turísticos por año, en lunes o viernes.
- **[Decreto 614/2025][dec614]** (B.O. 28/08/2025, N° 35737): los trasladables que caen sábado o domingo pueden pasar al lunes o al viernes «según lo determine la Autoridad de Aplicación» (la Jefatura de Gabinete).
- **[Resolución 164/2025 de la Jefatura de Gabinete][res164]** (B.O. 26/12/2025, N° 35818): los días no laborables con fines turísticos de 2026, lunes 23/3, viernes 10/7 y lunes 7/12.
- **[DNU 1103/2026][dnu1103]** (firmado el 25/09/2026, B.O. 28/09/2026): feriado nacional el lunes 9/11/2026 «en todo el territorio» (art. 2); el 10 y el 11/11, solo en otras jurisdicciones (arts. 3 y 4).
- **[Página oficial de feriados de la Jefatura de Gabinete][pagina]**, consultada el 26/10/2026: el calendario de 2026 completo; 2027 todavía no está.

**Chubut:**
- **[Ley I N° 85][ley85]** (antes Ley 2258), «Ley de feriados provinciales», texto del Digesto de la Legislatura. Art. 1: no laborables permanentes el 28/7 (inc. a), el 13/12, «Día del Petróleo Nacional» (inc. b), y el 30/4 (inc. c, Ley 4841); el descanso es obligatorio para la Administración Pública Provincial, bancos y seguros. Art. 2: el 25/9, solo en Puerto Pirámides.
- **[Ley I N° 857][ley857]**, «régimen de clasificación y traslado de los feriados provinciales» (sancionada el 15/10/2026, promulgada por el Decreto 1613 del 16/10/2026, B.O. del Chubut N° 14958, 22/10/2026, págs. 2 y 3). Art. 2: el 28/7 es inamovible. Art. 3: el 30/4, el 3/11 (Ley I N° 547) y el 13/12 son trasladables. Art. 4: martes y miércoles al lunes anterior, jueves y viernes al lunes siguiente, «de pleno derecho». Art. 5: la excepción. Art. 6: sábado y domingo, por decreto. Art. 7: el calendario del año siguiente, por decreto antes del 30/11. Art. 8: la fecha original queda hábil. Art. 12: invita a los municipios. Art. 13: el decreto de 2026, dentro de los 30 días de la promulgación.
- **Ley I N° 547** (el 3/11): no leí su texto; la cita la Ley I N° 857, art. 3, inc. b).

**Comodoro Rivadavia** (intranet municipal, publicaciones oficiales de años anteriores):
- [Res. 368/23][res368]: asueto administrativo del 23/2/2023, por el aniversario.
- [Res. 2476-24][res2476]: asueto del 8/11/2024, Día del Empleado Municipal.
- [Res. 2852-24][res2852]: asueto del 24 y el 31/12/2024, con las atribuciones del art. 96, inc. 1 y 29, de la Carta Orgánica Municipal.
- [Asueto del Día del Empleado Municipal de 2017][asueto2017], corrido al viernes 10/11.

**Prensa local** (solo para lo que no está en una fuente oficial):
- [Res. 0220-26][res0220]: asueto del lunes 23/2/2026, por el 125° aniversario.
- [Res. 2809/25][res2809]: asueto del 24, 26 y 31/12/2025 y del 2/1/2026.
- [Traslado del 3/11/2026 al lunes 2/11][traslado3nov], para la administración pública provincial y municipal.

[ley27399]: https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto
[dec614]: https://www.argentina.gob.ar/normativa/nacional/norma-416911/texto
[res164]: https://www.argentina.gob.ar/normativa/nacional/norma-421799/texto
[dnu1103]: https://www.boletinoficial.gob.ar/detalleAviso/primera/348022/20260928
[pagina]: https://www.argentina.gob.ar/feriados
[ley85]: https://koha.chubut.edu.ar/normativas/ley/leyI_85.PDF
[ley857]: https://boletin.chubut.gov.ar/mostrar/6637
[res368]: https://www.comodoro.gov.ar/intranet/2023/02/asueto-23-de-febrero/
[res2476]: https://www.comodoro.gov.ar/intranet/2024/11/no-2476-24-asueto-08-11-2024/
[res2852]: https://www.comodoro.gov.ar/intranet/2024/12/asueto-administrativo-para-la-administracion-publica-municipal-para-los-dias-24-y-31-de-diciembre-de-2024/
[asueto2017]: https://www.comodoro.gov.ar/intranet/2017/11/1011-asueto-dia-del-empleado-municipal/
[res0220]: https://comodoro24.com.ar/el-municipio-declaro-asueto-administrativo-por-el-125-aniversario-de-comodoro/
[res2809]: https://www.adnsur.com.ar/sociedad/la-municipalidad-de-comodoro-decreto-asueto-administrativo-para-cuatro-dias-de-fin-de-ano_a69460dc39a0e276960f13c2c
[traslado3nov]: https://www.adnsur.com.ar/sociedad/chubut-traslado-un-feriado-y-habra-un-fin-de-semana-largo-en-noviembre_a6ad8cd4a5f444e29d2172631
