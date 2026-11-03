# Mi espacio: las horas acumuladas de contrato

Fecha: 03/11/2026. Decisiones del usuario del 03/11/2026; el usuario aprobó este diseño el 03/11/2026. La maqueta, con un nombre y unas salidas inventados (los totales son
los del caso), está en `docs/superpowers/specs/2026-11-03-mi-espacio-horas-acumuladas-mockups/`; el usuario eligió la
**opción B, «Dos números»**. Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

Una persona de contrato (en la maqueta, Micaela Ojeda) hizo 6,5 horas extras en octubre de 2026, que son horas a favor para
noviembre, y cargó en su saldo inicial (arranque el 28/10/2026) 1,5 horas «no utilizadas previamente». El viernes 06/11 quiere
tomarse el día entero, 7 horas: 6,5 de noviembre y 0,5 de lo que tenía de antes. Mi espacio no la deja.

Los contratados suman de a 7 horas para tomarse el día completo (lo dijo el usuario en la planilla, spec 2026-10-27, y en
«Sumar al mes anterior», spec 2026-10-30). Lo que no se usó en su mes no tiene que perderse ni quedar escondido: tiene que
poder completar un día.

## 2. Lo que pasa hoy (diagnóstico)

Comprobado con el código de main (cd44547) y una copia de los datos de producción del 03/11/2026:

- Las horas se calculan bien: 6,5 h a favor de noviembre (vencen el 30/11) y 1,5 h no utilizadas previamente (el saldo inicial).
- «Cargar licencia» → «Horas a favor» usa solo las horas del mes: con 7 h responde «En noviembre de 2026 te quedan 6,5 horas a
  favor.».
- Las no utilizadas se usan solo con «Registrar un uso autorizado», un formulario aparte al fondo de la pestaña Horas extras.
  «Vence pronto», «Usarlas» y «Cargar licencia» no lo ofrecen.
- Dos licencias no pueden compartir un día (spec 2026-10-26, 3.8): 6,5 h a favor y 0,5 h de uso autorizado el mismo día dan
  «Ya tenés una licencia cargada el 06/11/2026: corregí la que ya está.».
- Un día de 6,5 h no es de día entero: no pasa a Configuración → Licencias, los compañeros no lo ven y la nota dice 6,5 horas.
- Lo no utilizado de contrato es por año y vuelve a cero el 1/1 (lo pidió el usuario el 26/10: «la cuenta se resetea cada
  año»). El saldo inicial cuenta solo en el año del arranque.
- Hallazgo aparte, también en producción: con 7 h pedidas y 6,5 disponibles, el recuadro del cálculo dice «Usás 7 horas a favor
  de noviembre. Te quedan 0.» al lado del error. Los dos se contradicen.

No es un error de cálculo: falta poder juntar las dos cosas en un día.

## 3. Lo que decidió el usuario (03/11/2026)

1. **Las horas acumuladas de contrato no vuelven a cero el 1/1.** Todo lo demás de Mi espacio sigue volviendo a cero o
   venciendo como hoy (también los francos no utilizados de planta). Sin vencimiento ni tope: quedan hasta que se usan.
2. **Se llaman «Horas acumuladas»** en todos lados (contrato). Reemplaza a «Horas no utilizadas previamente».
3. **Se usan desde «Cargar licencia» → «Horas a favor»**, solas o junto con las del mes. «Registrar un uso autorizado» deja de
   ser el camino en contrato.
4. **Dos números** (opción B de la maqueta): cuántas horas del mes y cuántas acumuladas, con el total debajo.
5. **Siguen necesitando la autorización del Director General**, y el formulario lo dice. Mi espacio no la controla (como el
   uso autorizado de hoy): la nota en Word es el pedido de autorización.
6. **La nota en Word dice primero el total y el día, y después de dónde sale cada parte** (texto en la sección 9).
7. **Para cargar un día a futuro valen las acumuladas que hay hoy.** Lo que sobre de un mes pasa a las acumuladas recién cuando
   termina ese mes.
8. Planta no cambia nada.
9. **Un día que se carga tarde sale de su mes**, como si se hubiera cargado a tiempo (sección 5, «Una carga en un mes que ya
   terminó»).

## 4. Las horas acumuladas: la cuenta (contrato)

Una sola cuenta por persona, sin años. Con hoy:

- **Lo que entra:** el saldo inicial de horas acumuladas (`mi_espacio_saldos`, concepto `horas_no_utilizadas`, el del año del
  arranque, que ahora vale para siempre) y lo que quedó sin usar de cada mes de uso que ya terminó (el `no_utilizadas` de
  `horasAFavorDe`), de cualquier año, salvo los que terminaron antes del arranque (`antes_del_arranque`: ya están en el saldo).
  Con «Sumar al mes anterior», cada mes es el de su cuenta de hoy (no cambia).
- **Lo que sale:** la parte acumulada de cada carga de «Horas a favor» (la columna nueva, sección 6) y las horas de los usos
  autorizados de contrato que ya estén cargados (en producción no hay ninguno; sección 8), de cualquier fecha, pasada o futura.
  Como el uso autorizado de hoy, lo de antes del arranque no descuenta (ya está en el saldo).
- **Lo que queda:** lo que entra menos lo que sale. Se descuenta primero el saldo inicial y después los meses, de los más viejos
  a los más nuevos (como hoy, para mostrar de dónde quedan).
- **«Las de hoy»** (decisión 7): un mes que todavía no terminó no suma, aunque la carga sea de una fecha en que ya habrá
  terminado. Hoy, 03/11, un día de diciembre puede usar las 1,5; desde el 01/12, también lo que sobró de noviembre.
- **Si lo que sale pasa a lo que entra** por un cambio posterior (se corrigió una salida vieja, se bajó el saldo inicial), queda
  un faltante ámbar en el Resumen, «Revisá tus horas acumuladas: usaste 2 horas y había 1,5.», que nunca frena nada salvo una
  carga que lo agranda (la regla de siempre, `problemaDeLaCarga`). Reemplaza en contrato a `uso:<anio>`.

Planta sigue con su cuenta por año, con reinicio el 1/1 (`noUtilizadasDe` en francos, sin cambios).

## 5. «Cargar licencia» → «Horas a favor» (contrato)

Lo que se ve (la opción B de la maqueta, sobre el modal real):

- La opción del tipo dice lo que queda del mes en curso y las acumuladas: «Quedan 6,5 h en noviembre · 1,5 acumuladas». Sin
  acumuladas, como hoy («Quedan 6,5 h en noviembre»). Sin horas del mes y con acumuladas: «Quedan 0 h en noviembre · 1,5
  acumuladas».
- En lugar del campo «Horas», dos campos en la misma fila: **«De noviembre»** (el mes de la fecha elegida, en minúscula; con su
  tope al lado: «(quedan 6,5)») y **«Acumuladas»** («(tenés 1,5)»). Cada uno de 0 a su tope, de a media hora. Debajo, en
  negrita, el total: «Total: 7 horas, el día entero.», «Total: 2 horas.», «Total: 1 hora.» o, sin nada elegido, «Elegí cuántas
  horas tomás.». Y la ayuda: «Las horas acumuladas se usan con la autorización del Director General.» (solo si hay acumuladas o
  si la carga usa alguna).
- El total va de 0,5 a 7. Los campos no ofrecen más de lo que entra: «De noviembre» hasta lo que queda del mes (con lo que usa
  la carga que se corrige) y nunca más de 7; «Acumuladas», hasta lo que queda y nunca más de 7 menos lo elegido del mes.
- **Los topes son los del mes de la fecha elegida y los de hoy**, y los manda el servidor: cambiar la fecha a otro mes cambia el
  rótulo y el tope de «De …». Nunca se muestra un tope viejo.
- Sin acumuladas (ni ahora ni en la carga que se corrige), el formulario es el de hoy: un solo campo «Horas».
- El cálculo (el recuadro celeste) dice, por ejemplo: «**7 horas, el día entero.** Usás 6,5 horas a favor de noviembre y 0,5 de
  tus horas acumuladas. Te queda 1 hora acumulada.»; solo acumuladas: «**1,5 horas.** Usás 1,5 horas acumuladas. No te quedan
  horas acumuladas.»; solo del mes, como hoy.
- **El hallazgo de la sección 2 se corrige:** con un error en las horas, el recuadro no dice «Usás … Te quedan 0.»: dice solo el
  total, como el cálculo de unas vacaciones con un error de días. *Decisión del constructor: vale para todo tipo con la misma
  contradicción, también la franquicia de planta («Te quedan 0 de 42 horas de franquicia.» al lado del error del tope) y el uso
  autorizado; es un arreglo, no un cambio de planta.*
- Con 7 horas en total es de día entero (sección 7).
- Los errores, debajo de su campo: las del mes que no alcanzan, el de hoy («En noviembre de 2026 te quedan 6,5 horas a
  favor.»), debajo de «De noviembre»; las acumuladas que no alcanzan, «Te quedan 1,5 horas acumuladas.» («Te queda 1 hora
  acumulada.», «No te quedan horas acumuladas.»), debajo de «Acumuladas».

**Una carga en un mes que ya terminó** (decisión 9): por ejemplo, el 05/12 se carga el 20/11, un día que se tomó y no se
cargó, o se corrige el 05/12 una carga del 06/11. Lo que le sobraba a noviembre ya pasó a las acumuladas el 01/12, así que esas
horas están en los dos lados y no se pueden contar dos veces:

- La parte del mes sale de su mes, como si se hubiera cargado a tiempo: «De noviembre» sigue, y la nota dice «correspondientes a
  las horas extras realizadas en octubre de 2026».
- Pero esas horas ya son parte de las acumuladas: lo que se toma del mes también baja las acumuladas. El tope de «De noviembre» es
  lo que le sobraba a noviembre, sin pasar de lo que queda de las acumuladas (con lo que ya usaba la carga que se corrige); el de
  «Acumuladas», lo que queda de las acumuladas menos lo elegido del mes.
- Si lo que le sobraba a noviembre ya se usó como acumuladas en otro día, «De noviembre» ofrece solo lo que sigue libre (puede
  ser 0).
- Si no alcanza, el error va debajo de «De noviembre», con lo que queda de verdad («En noviembre de 2026 te quedan 0,5 horas a
  favor.», el texto de hoy con ese número), aunque por dentro lo que se pasa sea la cuenta de las acumuladas.

Los demás caminos que abren este modal: «Usarlas» de «Vence pronto» (como hoy) y el botón de la tarjeta de las acumuladas
(sección 10).

## 6. La base

Una columna nueva en `mi_espacio_licencias`, después de `horas`: **`horas_acumuladas DECIMAL(3,1) NULL`**, la parte de `horas`
que sale de las acumuladas. Solo en `horas_a_favor`; en cualquier otro tipo, NULL. NULL y 0 son lo mismo. **`horas` sigue
siendo el total del día**, así lo que lee `horas` (el día entero, el paso a Configuración, la planilla, la agenda, «Hoy no
están», la nota de hoy) sigue andando. La parte del mes es `horas − horas_acumuladas`.

- `migracion-mi-espacio-horas-acumuladas.sql`: aditiva y repetible (`ADD COLUMN IF NOT EXISTS … AFTER horas`), con su
  verificación comentada (`SHOW COLUMNS FROM mi_espacio_licencias LIKE 'horas_acumuladas';`, 1 fila). Va después de
  `migracion-mi-espacio-restituciones.sql` y **antes** del código, obligatoria: `estadosDe` la lee, así que sin ella todo lo de
  Mi espacio que lee el estado da 500 (como las migraciones anteriores). El código anterior anda con la columna (no la lee).
- `rollback-mi-espacio-horas-acumuladas.sql`: después de volver a los archivos anteriores; borra la columna. Se pierde qué parte
  de cada día era acumulada: esas cargas cuentan enteras contra su mes y pueden quedar con el faltante ámbar de las horas a
  favor (no frena nada).
- Va también en `schema.sql`. Sin `CHECK`: valida la API.

## 7. La API

`POST /mi-espacio/licencias/calculo`, `POST /mi-espacio/licencias` y `PUT /mi-espacio/licencias/:id`, con `tipo:
'horas_a_favor'`, suman **`horas_acumuladas`** al cuerpo; `horas` sigue siendo el total.

- Sin la clave (una página vieja, o una persona sin acumuladas), null o '': 0. Así una pestaña abierta con la página anterior
  guarda como hoy.
- Validación (en `validarLicencia`, en el paso de las horas): `horas` como hoy (`horasMedias`); `horas_acumuladas` de 0 a
  `horas`, de a media hora; otro valor da 400 en `horas_acumuladas` («Las horas acumuladas van de a media hora, hasta el
  total.»). En otro tipo, la clave se ignora y se guarda NULL.
- Lo que no alcanza lo dicen los faltantes, como siempre (`problemaDeLaCarga`): la parte del mes contra su mes (`horas:<mes>`,
  en `horas`, como hoy) y la acumulada contra la cuenta (sección 4, en `horas_acumuladas`), cada uno con lo que quedaba antes de
  la carga (con lo que ya usaba la fila que se corrige).
- La respuesta del cálculo suma lo que la página necesita para los topes de los dos campos: lo que queda del mes de la fecha y de
  las acumuladas, antes de esta carga y con lo que ya usaba la que se corrige. Cómo viaja lo decide el plan; tiene que llegar
  también cuando las horas todavía no están elegidas (la página no puede armar los campos sin los topes).
- Una persona de planta que mande `horas_acumuladas`: se ignora (planta no tiene horas a favor).
- `GET /mi-espacio/licencias` y el segundo paso: la fila de una carga con acumuladas lo dice (sección 10).

## 8. El uso autorizado de contrato

- La página ya no lo ofrece en contrato: el botón de la tarjeta abre «Cargar licencia» (sección 10).
- En producción no hay ninguno cargado (03/11/2026). Por las dudas, los que haya siguen contando como salida de las acumuladas,
  se ven en la lista y se corrigen o se borran con su formulario de siempre. El servidor los sigue aceptando de contrato (una
  página vieja). No hay migración de datos.
- Planta no cambia: «Registrar un uso autorizado» de un franco no utilizado sigue igual.

## 9. La nota en Word

Solo cambia la de «Horas a favor» que usa acumuladas. Las demás, también la de horas a favor sin acumuladas, quedan como están.

- **Del mes y acumuladas:** «Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de siete (7) horas a favor
  el día viernes 6 de noviembre de 2026: seis horas y media (6,5) correspondientes a las horas extras realizadas en octubre de
  2026 y media hora (0,5) de horas extras acumuladas de meses anteriores.»
- **Solo acumuladas:** «… el usufructo de una hora y media (1,5) de horas extras acumuladas de meses anteriores el día lunes 9 de
  noviembre de 2026.»
- Las horas con las palabras de hoy (`textoDeHoras`: «una (1) hora», «media hora (0,5)», «una hora y media (1,5)», …) y
  «correspondiente» o «correspondientes» como hoy (`correspondientesALasHoras`, con la parte del mes).
- Con días tildados «Sumar a {mes anterior}» (spec 2026-10-30, 7), el paréntesis de hoy va después del mes de las horas: «… a
  las horas extras realizadas en octubre de 2026 (incluidas las del lunes 2 de noviembre de 2026, sumadas a octubre) y media
  hora (0,5) de horas extras acumuladas de meses anteriores.» Solo nombra días del mes de la licencia, como hoy.
- El nombre del archivo, la fecha y la firma no cambian.

## 10. Lo que se ve en el resto de Mi espacio (contrato)

- **Pestaña Horas extras, la tarjeta:** «Horas acumuladas», con el total a la derecha sin año («1,5 horas»), de dónde quedan
  (cada mes, del más nuevo al más viejo, «Noviembre 2026 · 2 horas · de las extras de octubre», y «Del saldo inicial»), la nota
  «No vencen: quedan hasta que las uses.» y «Si te autorizan a tomarlas, sumalas en «Cargar licencia», con las horas a favor del
  mes o solas: se descuentan primero las más viejas.» con el botón **«Usar horas acumuladas»**, que abre «Cargar licencia» con
  «Horas a favor» (el foco vuelve al botón al cerrar). Sin acumuladas: «No tenés horas acumuladas.» y sin botón. La tarjeta no
  cambia con el año elegido arriba: es la cuenta de hoy.
- **La tabla de los meses:** la situación de un mes que terminó con horas sin usar dice «1,5 h pasaron a acumuladas» (en gris,
  como hoy «no utilizadas previamente»).
- **Resumen:** la pastilla gris del final dice «1,5 · Horas acumuladas · De meses anteriores» («1 · Hora acumulada»). La opción
  del tipo, como en la sección 5. «Vence pronto» y el email de vencimiento no cambian: las acumuladas no vencen, así que no
  avisan.
- **«Mis vacaciones y saldos»:** el campo de contrato se llama «Horas acumuladas» (sigue en el concepto
  `horas_no_utilizadas`, de 0 a 200, de a media hora).
- **Licencias, la fila:** una carga con acumuladas dice sus horas y, debajo, en el detalle: «6,5 de noviembre y 0,5
  acumuladas» o «Todas acumuladas». La de hoy, sin acumuladas, no cambia. La insignia sigue siendo «Horas a favor».
- **El segundo paso** (la nota a la vista) muestra la fila así y la nota de la sección 9.
- La fila del saldo inicial en Licencias: «Tenías 1,5 horas acumuladas.».

## 11. Lo que no cambia

- Planta entera: los francos, lo no utilizado por año con su reinicio, su uso autorizado y sus textos.
- La planilla, «Sumar al mes anterior», cómo se cuentan las horas extras y las horas a favor del mes (vencen al final de su mes de
  uso y avisan como hoy).
- Las demás licencias, las vacaciones, los días restituidos y la regla de un día, una licencia.
- Configuración, las Notas Digitales, la agenda y la corrida de las 8:15 (salvo que el email no nombra las acumuladas, como
  hoy).

## 12. Antiobjetivos

- Que un día de 7 horas armado con acumuladas no cuente como día entero (no pase a Configuración o no se vea en «Hoy no
  están»).
- Que una hora se cuente dos veces: como hora a favor de su mes y como acumulada, o en dos cargas.
- Que el formulario ofrezca un tope que no es el de la fecha elegida, o que guarde algo que después aparece como faltante sin que
  nada haya cambiado.
- Que algo de planta cambie.
- Que una pestaña abierta con la página anterior guarde mal (sin `horas_acumuladas`, todo del mes, como hoy).
- Un nombre real o un dato real del caso en el repositorio (la maqueta y los tests, con datos inventados).
- Textos con «perdiste», «vencieron» o un reproche para las acumuladas: no vencen.

## 13. Lo que queda para el plan (decisiones del constructor, para revisar)

Lo que ya decidió el constructor del diseño, para que el usuario lo revise al leer:

- `horas` sigue siendo el total del día y la parte acumulada va en una columna nueva (sección 6).
- La tarjeta de las acumuladas no cambia con el año elegido (sección 10).
- Los usos autorizados de contrato que pudiera haber siguen contando y el servidor los acepta (sección 8).
- El paréntesis de «Sumar al mes anterior» en la nota va después del mes de las horas (sección 9).
- El arreglo del «Te quedan 0» vale para todo tipo con la misma contradicción (sección 5).
- Los textos nuevos que no dictó el usuario: los del cálculo, el faltante, la tarjeta, la pastilla, la fila y «pasaron a
  acumuladas».

Lo que decide el plan:

- Cómo se llama y qué forma tiene la cuenta nueva en el `Calculo` (por ejemplo, `acumuladas`, al lado de `noUtilizadas`, que
  queda solo para planta) y qué consumidores cambian: `previoDe`, `usoAutorizadoDe`, `noUtilizadasDeLaTabla`, `faltantesDe`,
  `mensajeDeLaCarga`, `textoDeLoQueQueda`, `quedaDelTipo`, la fila de la lista y la nota.
- La clave y los textos del faltante de la sección 4, y el mensaje de lo que no alcanza (`textoSinAcumuladas`).
- Cómo viajan los topes de los dos campos (sección 7) y cómo los pide la página antes de tener las horas.
- Las copias del navegador y sus tests de paridad (los mensajes nuevos en `MENSAJES_FORMULARIOS`, la validación de los dos
  campos en `erroresDeLicencia`, el cuerpo en `cuerpoDeLicencia`), y `VERSION_MI_ESPACIO` en `'20261221'`.
- Los estilos de los dos campos (los de la maqueta, `.mq-dos`, pasados a `.me-` en el `<style>` de `mi-espacio.html`, con los
  tokens `--sg-*`), también en el teléfono.
- Actualizar `CLAUDE.md` (las secciones de Mi espacio, la base de datos y el despliegue) y el README si nombra el uso autorizado de
  contrato.

## 14. Pruebas

- Reglas (puras): la cuenta con el saldo inicial en otro año que el del arranque, dos años seguidos sin reinicio, los meses de
  antes del arranque, «las de hoy» (un mes que termina mañana no suma hoy), las más viejas primero, el faltante, una carga del mes
  y acumuladas (los dos lados descuentan lo suyo, nunca dos veces), la corrección de una carga que ya usaba acumuladas, el uso
  autorizado viejo de contrato que sigue contando y planta sin ningún cambio (sus tests de hoy, sin tocar).
- La validación de `horas_acumuladas` en sus bordes, y un cuerpo sin la clave igual a hoy.
- La API con Docker: el caso de la maqueta (6,5 + 0,5 el 06/11 se guarda, pasa a Configuración y queda 1 hora), 6,5 + 1,5 (no:
  pasa de 7), 7 del mes (el error de hoy), solo acumuladas, otro mes, lo ajeno, el doble envío, una carga a futuro con «las de
  hoy» y una carga tarde en un mes que ya terminó (sale de su mes, baja las acumuladas, nunca cuenta dos veces y, si lo que
  sobraba ya se usó como acumuladas, no se ofrece).
- La nota y el Word: los dos textos de la sección 9 al pie de la letra, con «Sumar al mes anterior», y el Word igual a la vista.
- La página en el `vm` (las paridades, los dos campos, los topes que llegan, el total, los errores en su campo, el cálculo sin
  «Te quedan 0» con un error, la tarjeta y su botón) y `paginas.test.js` (la versión).
- `schema.test.js`: la columna, la migración dos veces y la vuelta atrás.

## 15. Despliegue

Después del kit de los días restituidos (main cd44547, ya en producción): `migracion-mi-espacio-horas-acumuladas.sql` en
phpMyAdmin, con su verificación; después los archivos y Restart. Sin cron, variables de entorno ni Run NPM Install. Después
(Ctrl+F5), solo mirar: con una persona de contrato, la tarjeta «Horas acumuladas» y «Cargar licencia» → «Horas a favor» con los
dos campos, sin guardar nada. La vuelta atrás: los archivos anteriores y Restart, y después el rollback.
