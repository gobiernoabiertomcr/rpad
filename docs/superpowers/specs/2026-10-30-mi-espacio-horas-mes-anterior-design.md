# Mi espacio: sumar las horas de un día al mes anterior (diseño)

Fecha: 30/10/2026. Rama: `claude/mi-espacio-horas-mes-anterior-66089f`, desde main 9fcc2af (todo main en producción desde el 30/10). Maqueta: `docs/superpowers/specs/2026-10-30-mi-espacio-horas-mes-anterior-mockups/` (abrir `index.html` con un servidor estático; la barra oscura de abajo salta entre las pantallas, también con `?ver=febrero|enero|como|pestana|pestana-enero|nota`, y `telefono.html` la muestra a 375 px). Datos inventados: Sofía Paz, de contrato, con hoy el miércoles 03/02/2027. Donde la maqueta y este documento difieren, manda el documento: la maqueta no tiene el tilde en el primer mes, ni las filas de 0 h, ni «suman a enero» en la tabla, y su nombre accesible del tilde es el anterior; su nota en Word ya tiene la redacción elegida.

Parte de la planilla de horas extras de contrato (spec `2026-10-27-mi-espacio-horas-design.md`) y de las horas a favor (spec `2026-10-26-mi-espacio-licencias-y-horas-design.md`, 3.6). Lo que no se dice acá sigue como está en esas dos specs.

## 1. Qué es y por qué

Las horas extras de una persona de contrato son horas a favor del mes siguiente: 7 horas son el día entero («un día de franco»), y lo que no llega a 7 se usa de a media hora. Los contratados «aspiran a sumar de a 7 horas para tomarse el día completo» (usuario, 27/10/2026).

El caso que lo motivó (30/10/2026): una persona de contrato no llegó a las 7 horas en un mes, y la autorizaron a hacer horas en los primeros días del mes siguiente que **se suman al mes anterior**, para llegar al día entero. Hoy el sistema no tiene forma de decirlo: las horas de un día suman siempre al mes de su fecha.

La idea del usuario: en la planilla, cada día tiene un tilde **«Sumar a {mes anterior}»**. Tildado, las horas de ese día cuentan como horas extras del mes anterior. El usuario aprobó la maqueta («Me parece perfecto»).

## 2. Objetivos, no objetivos y antiobjetivos

**Objetivos**
- Poder sumar las horas de un día al mes anterior, desde la planilla, con un tilde en la fila del día.
- Que la planilla de los dos meses, la pestaña Horas extras y la nota en Word digan claramente de dónde salen esas horas.
- Que todo lo que ya se calcula con las horas a favor (el Resumen, «Vence pronto», «Cargar licencia» → «Horas a favor», los faltantes, lo no utilizado, el email de vencimiento) siga solo, sin cambios propios.

**No objetivos**
- **Planta no cambia** (respuesta del usuario): su modal «al 100%» y sus francos siguen igual. Tampoco la nota en Word del franco compensatorio de planta.
- No se parte un día: pasa **entero** (respuesta del usuario).
- No se controla la autorización: como todo Mi espacio, cada persona carga lo suyo (respuesta del usuario: el tilde se puede usar **cualquier día**, de cualquier mes). La nota del día sigue opcional.
- No cambia la regla de las licencias: un franco (horas a favor de 7 h) se puede cargar recién cuando están las horas que lo completan; antes, «En febrero te quedan 5,5 horas a favor.» y no se guarda, como hoy (respuesta del usuario).
- No hay sumar a otro mes que no sea el inmediatamente anterior.

**Antiobjetivos**
- Que la planilla diga un número y lo que después se puede usar sea otro (una sola regla en el servidor; las copias del navegador, atadas por tests de paridad).
- Que las mismas horas cuenten dos veces (en su mes y en el anterior) o que se pierdan de vista (el día tiene que verse en los dos meses).
- Que una página vieja abierta en otra pestaña destilde días sin querer al guardar.
- Que algo de planta, del Resumen, de la agenda o de las Notas Digitales cambie.
- Que un nombre real o el caso real queden en el repo.

## 3. La regla

- Cada día de la planilla (`mi_espacio_salidas`) tiene una marca nueva, **`al_mes_anterior`** (sí o no; de entrada, no).
- Las horas de un día marcado (las de siempre, `horasDeLaSalida`: no cambia cómo se cuentan) **suman al mes anterior al de su fecha** en lugar de al suyo. Ese es el único cambio de la cuenta: `horasPorMesDeSalidas` lo pone en `mesMas(mes de la fecha, -1)`. Como de ahí sale todo (`horasAFavorDe`, `noUtilizadasDe`, los faltantes, el Resumen, el email), lo demás se acomoda solo.
- Pasa el día entero, con sus horas (con 0 también: no suma nada).
- Solo con una salida: un día sin salida no tiene tilde. Un día que se borra (entrada, salida y nota vacías) pierde la marca.
- Cualquier día, de cualquier mes de la planilla, también del primer mes que se puede mirar (enero de hace dos años): sus horas van a un mes que la planilla ya no muestra, pero siguen contando en las horas a favor y en la tabla de la pestaña de ese año. La marca no depende de la fecha de hoy: un día tildado sigue tildado aunque pasen los años.
- Solo contrato: planta no tiene planilla.
- Si se destilda después de haber usado esas horas, aparece el faltante ámbar de siempre en el Resumen («Revisá tus horas a favor de …»); no frena nada.

**Ejemplo (inventado, el de la maqueta).** Enero de 2027: 5,5 h. El martes 02/02 sale a las 16:20 (1,5 h) y tilda «Sumar a enero»; el miércoles 03/02 sale a las 15:50 (1 h) sin tildar.
- Enero suma 5,5 + 1,5 = **7 h** → en febrero tiene 1 día de franco (vence el viernes 26/02).
- Febrero suma **1 h** (la del 03/02) → en marzo tiene 1 hora a favor.
- El viernes 05/02 puede cargar «Horas a favor» de 7 h (después de haber cargado el 02/02, no antes).

## 4. La planilla (maqueta: «Febrero», «Enero» y «Cómo se cuentan»)

**El tilde** (en la fila, entre la pastilla de «Horas extras» y «Nota»; maqueta, `htmlDelTilde`):
- Un checkbox con el texto **«Sumar a {mes anterior}»** («Sumar a enero» en febrero, «Sumar a diciembre» en enero), con el nombre del mes en minúscula (respuesta del usuario).
- Su nombre accesible empieza con el texto visible: **«Sumar a enero el martes 02/02»** (WCAG 2.5.3; decisión mía, la maqueta todavía dice «Sumar el martes 02/02 a enero»).
- Sin salida, no se ve pero conserva su lugar (no corre nada al escribir la salida) y no recibe el foco.
- Tildar o destildar es un cambio sin guardar: la fila lleva la raya de lo cambiado y el pie lo cuenta («1 día con cambios sin guardar»), como la entrada, la salida y la nota.
- En el teléfono (720 px o menos) va en la tarjeta, debajo de la entrada y la salida, a la izquierda de «Nota», con 44 px de alto.

**Un día tildado:** su pastilla de horas se ve blanca con borde punteado y, al lado, «→ enero» (el lector de pantalla oye «van a enero»); no depende solo del color.

**La banda del mes** (la cifra grande y la frase):
- La cifra es lo que suma el mes: sus días sin tildar **más** los días tildados del mes siguiente. El total de cada semana no cuenta los días tildados de esa semana.
- La frase es la de hoy (`textoDeLaSumaDelMes`) con un verbo que mira **el mes en que se usan las horas** (el siguiente al de la planilla): si ya pasó, «tuviste»; si es el mes de hoy, **«tenés»**; si todavía no llegó, «vas a tener». Hoy dice «tuviste» para cualquier mes anterior al de hoy, aunque el mes de uso esté en curso (por ejemplo, la planilla de enero mirada en febrero), y con este cambio se va a mirar seguido (decisión mía, el usuario la vio en la maqueta). Sin horas, como hoy.
- Una segunda línea, solo si hace falta, con las dos cosas que pueden pasar: «Incluye 1,5 h de febrero.» (lo que entra del mes siguiente) y «1,5 h del martes 02/02 suman a enero.» (lo que se va al anterior; con dos días, «… del martes 02/02 y del jueves 04/02 suman a enero.»; con más, «4 h de 3 días suman a enero.»; «suma» con 1 h). Solo cuentan los días que dan horas. La banda tiene siempre el alto de dos renglones (tildar no corre la planilla).

**El bloque «De febrero»** (en la planilla de enero, después de la última semana): un renglón como el de una semana, «De febrero» con su total («1,5 h»), y una fila de solo lectura por cada día tildado del mes siguiente: la fecha, «Salida 16:20» (y la entrada, si la tiene), sus horas y el botón **«Ver en febrero»**, que abre la planilla de febrero con el foco en el tilde de ese día. Si el mes siguiente todavía no llegó, no hay bloque.

**Lo que no se guardó:** la planilla trabaja con los dos meses a la vez. Si se tilda un día de febrero y, sin guardar, se va a enero, la banda y el bloque de enero ya lo muestran. «Guardar» manda todo junto, como hoy (todo o nada).

**«Cómo se cuentan las horas»** suma un renglón: «Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a enero»: cuentan como horas extras de enero.» (con el mes anterior al de la planilla).

## 5. La pestaña Horas extras (maqueta: «Pestaña» y «Pestaña, enero»)

**La tabla** (`tablaDeHorasExtras`, `htmlDeTablaDeHorasAFavor`):
- «Horas extras» de un mes es lo que suma con la regla nueva (enero: 7 h). Debajo, chico, de dónde sale cuando entra algo del mes siguiente: «5,5 h + 1,5 h de febrero» (si no tiene horas propias, «1,5 h de febrero»). En el mes que da horas al anterior, debajo: «1,5 h suman a enero» (decisión mía; la maqueta no lo tiene).
- «A favor en», su detalle en días de franco, «Usadas» y «Situación» salen de las horas a favor de siempre (ya incluyen lo sumado).
- **Un mes con salidas cargadas tiene siempre su fila**, aunque sume 0 o todas sus horas pasen al anterior (respuesta del usuario, 30/10/2026: «Sí, con salidas hay fila»), por ejemplo «Febrero 2027 · 0 h · Marzo 2027 · — · El mes sigue sumando», con «1,5 h suman a enero» debajo. Así sus días se ven y se editan desde la pestaña. En esas filas: «A favor en», el mes de uso, sin detalle; «Usadas», como hoy; «Situación», «El mes sigue sumando» mientras el mes trabajado no terminó y, después, si no hay horas ni usos, «Sin horas a favor» (no «Todas usadas»); con usos de más, lo de hoy. Esto cambia lo que dijo el Ruling 5 de la planilla para la tabla (un mes que suma 0 no tenía fila) y resuelve el Ruling 10 (el día por día de un mes que suma 0 no se alcanzaba). **Solo la tabla y el día por día:** las horas a favor, el Resumen, «Vence pronto» y el email siguen sin un mes que suma 0.

**El día por día** (`htmlDeDiaPorDiaDeSalidas`):
- Un día tildado lleva su pastilla punteada y «Suma a enero».
- Al final de un mes, los días tildados del mes siguiente que suman a él, con «De febrero» debajo de la fecha (como «Feriado»). Su «Editar» abre la planilla de **su** mes (febrero) con el foco en ese día.
- El total del día por día es el mismo que «Horas extras» de la fila (enero: 7 h).

## 6. El Resumen, «Cargar licencia» y el email

Sin cambios de pantalla ni de texto: siguen leyendo las horas a favor, que ya traen lo sumado (por ejemplo, la pastilla de febrero dice 7 y «Vence pronto», «7 horas a favor de febrero»).

## 7. La nota en Word de las horas a favor (respuestas del usuario, 30/10/2026)

El usuario pidió una redacción más clara y eligió, de tres variantes, la **C**, y que **todas** las notas de horas a favor pongan el día primero, tengan o no días sumados.

- Sin días sumados (cambia el orden respecto de hoy):
  > Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de dos horas y media (2,5) a favor el día jueves 15 de octubre de 2026, correspondientes a las horas extras realizadas en septiembre de 2026.
- Con un día sumado:
  > Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de siete (7) horas a favor el día viernes 5 de febrero de 2027, correspondientes a las horas extras realizadas en enero de 2027 (incluidas las del martes 2 de febrero de 2027, sumadas a enero).
- Con dos: «(incluidas las del martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero)»; con tres o más: «(incluidas las del lunes 1, el martes 2 y el miércoles 3 de febrero de 2027, sumadas a enero)».

Las reglas:
- El mes de las horas sigue siendo el anterior al día de la licencia (`MESES_HASTA_LAS_HORAS`), como hoy.
- Los días sumados son los días tildados del mes siguiente a ese (el mismo mes de la licencia) **que dan horas**, en orden de fecha, como están al armar la nota (la nota nunca se guarda).
- «correspondiente» o «correspondientes» concuerda con las horas, como hoy (`correspondientesALasHoras`).
- Cambia el ejemplo de la spec de la nota en Word (`2026-10-27-mi-espacio-licencia-word-design.md`, el cuerpo de «horas a favor»): este documento lo reemplaza. La maqueta `.docx` de esa spec queda como historia.

## 8. Los datos

- `mi_espacio_salidas` suma **`al_mes_anterior tinyint(1) NOT NULL DEFAULT 0`**, después de `nota`. Las tablas siguen siendo 43.
- Migración `database/updates/migracion-mi-espacio-horas-mes-anterior.sql`: un `ADD COLUMN IF NOT EXISTS … AFTER nota`, aditiva y repetible, **antes** del código (el código nuevo la lee: sin ella, la planilla, la pestaña, el Resumen y todo lo que lee el estado de una persona darían 500). Lo ya cargado queda en 0: nada cambia hasta que alguien tilde. El código anterior anda con la columna (no la lee).
- Vuelta atrás: `rollback-mi-espacio-horas-mes-anterior.sql`, después de volver a los archivos anteriores, borra la columna. Las horas tildadas vuelven a su mes; un uso que ya se apoyaba en ellas puede quedar con el faltante ámbar (no frena nada). Va antes que `rollback-mi-espacio-horas.sql` si se deshacen las dos.
- `schema.sql`, `tests/schema.test.js` (la columna, la migración dos veces desde la estructura de main y la vuelta atrás) y la base local del `.env` (la suite la necesita: se corre la migración en la copia de la rama, nunca en `datospublicos_mcr_rpad`).
- Lectura (`estadosDe`): `estado.salidas` suma `al_mes_anterior` como booleano.
- Guardado (`PUT /mi-espacio/salidas`): cada día puede traer `al_mes_anterior`. Si viene, tiene que ser `true` o `false` (otro valor, 400 en `al_mes_anterior`); si no viene, **se conserva lo guardado** (una página vieja que no conoce el tilde no lo borra) y un día nuevo queda en 0. Un borrado lo deja en 0. El `INSERT … ON DUPLICATE KEY UPDATE` lo incluye solo cuando viene.

## 9. La API

- `GET /mi-espacio/salidas?mes=`: cada día suma `al_mes_anterior`; la planilla suma lo que hace falta para el tilde y el bloque (el texto «Sumar a enero», si el mes tiene tilde, los días tildados del mes siguiente con sus horas, y la segunda línea de la banda), y `suma.horas` y `suma.texto` pasan a la regla nueva. Los textos los arma el servidor (Ruling 19); el navegador los recalcula solo mientras se escribe o se tilda, con copias atadas por tests de paridad, como hoy la banda.
- `GET /mi-espacio/horas-extras`: la tabla con el detalle de las horas y las filas de los meses con salidas; el día por día con la marca de los tildados y los días que entran del mes siguiente.
- `GET /mi-espacio/licencias/:id/nota` y `…/word`: el cuerpo nuevo.
- Las formas exactas (nombres de las claves) son del plan.

## 10. Lo que no cambia

Planta (sus horas extras, francos y nota del franco), la regla de cada día (la jornada, la media hora, la tolerancia, los feriados), el tope de 100 días por guardado, los avisos de las salidas, el uso autorizado y lo no utilizado (salvo que ahora reciben lo sumado), «Cargar licencia», Configuración, la agenda, las Notas Digitales, Métricas y Reportes.

## 11. Despliegue (cPanel, sin terminal)

1. En phpMyAdmin, `migracion-mi-espacio-horas-mes-anterior.sql`.
2. Subir los archivos y Restart (sin Run NPM Install, sin variables de entorno nuevas, sin cron nuevo).
3. Ctrl+F5: en Mi espacio → Horas extras, «Cargar horas extras» de una persona de contrato muestra el tilde en los días con salida.

`VERSION_MI_ESPACIO` sube (de `'20261218'` a `'20261219'`).

## 12. Tests (la suite completa antes y después)

- Reglas: `horasPorMesDeSalidas` con días tildados (al mes anterior, cruzando el año, en el primer mes del rango, con 0 h), las horas a favor, lo no utilizado y los faltantes que se acomodan, y el verbo de `textoDeLaSumaDelMes`.
- La planilla del servidor (`planillaDelMes`) y la tabla (`tablaDeHorasExtras`): la cifra, la segunda línea, el bloque, los meses con salidas que suman 0, el detalle y el día por día.
- La API: guardar, conservar sin el campo, el borrado, los 400 y que no se cuente dos veces.
- La nota: los tres casos de la sección 7, con 0 h tildadas que no se nombran, y el Word igual a la vista.
- La página: el tilde, su nombre accesible, la pastilla, la banda con lo no guardado de otro mes, el pie, el bloque y «Ver en febrero», el teléfono, el escapado y las paridades nuevas.
- `schema.test.js`, `paginas.test.js` (`VERSION_MI_ESPACIO`) y los de permisos, sin rutas nuevas.

## 13. Decisiones mías (para revisar)

1. El tilde aparece solo con una salida y conserva su lugar; está en todos los meses, también en el primer mes del rango, y la marca no depende de la fecha de hoy.
2. Su nombre accesible empieza con el texto visible: «Sumar a enero el martes 02/02».
3. El verbo de la banda mira el mes de uso («tuviste», «tenés», «vas a tener»).
4. En la tabla, el mes que da horas dice «1,5 h suman a enero» debajo de sus horas.
5. Sin el campo en el guardado, se conserva lo guardado (compatibilidad con una página vieja).
6. Un día tildado con 0 h se puede guardar (no suma nada) y no se nombra en la nota.
7. El nombre de la columna, `al_mes_anterior`.
8. Las filas de 0 h de un mes que ya terminó dicen «Sin horas a favor» en «Situación».

## 14. Lo que queda para el constructor

Los nombres de las claves de la API y de las funciones nuevas, cómo se reparte el trabajo entre el servidor y las copias del navegador (con sus paridades), los mensajes de los 400 nuevos y los detalles de diseño que la maqueta no muestra, siguiendo el `<style>` real de `mi-espacio.html` y la maqueta (`propuesta.css`).
