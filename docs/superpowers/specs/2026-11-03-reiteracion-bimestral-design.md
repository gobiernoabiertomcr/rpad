# La reiteración de las Notas Digitales pasa a ser bimestral

Fecha: 03/11/2026. Decisiones del usuario del 03/11/2026. Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

El usuario lo pidió así: «Hoy la reiteración de los datasets sale por correo electrónico una vez por mes el primer día hábil del
mes, tanto para gestiones internas como externas. Me gustaría cambiar eso y que en vez de mensual sea bimestral: que las notas de
reiteración salgan en enero, marzo, mayo, julio, septiembre y noviembre.» Y aclaró: «Lo de unir los mails de gestiones internas y
externas descartalo.»

Cada gestión sigue con su nota. Lo único que cambia es en qué meses salen.

**No cambian:** los avisos, sus fechas y la regla de los 20 días; la nota de auditoría y su reiteración de 5 días hábiles; el
contenido de las notas, sus anexos y su Word; quién las recibe; los reintentos; lo ya enviado.

Antiobjetivos: que una reiteración salga en un mes par; que Correos → Estado, la vista previa o la prueba anuncien otra cosa que lo
que va a salir; que un mes par frene la nota de auditoría, un aviso o un reintento; que un test pase en noviembre y falle en
diciembre.

## 2. Lo que pasa hoy

Comprobado con main 3949aae y la copia de producción del 03/11/2026:

- La corrida de las 8:15 evalúa la reiteración una vez por mes y por gestión (`correrPasos`, paso 3, `services/notasDigitales.js`).
  La marca `reiteracion_evaluada_interna` y `_externa` de `notas_digitales_config` guarda el último mes evaluado (`AAAA-MM`). Se
  escribe si se generó (aunque el envío haya fallado) o si no había datasets; con una excepción no se escribe, y la próxima corrida
  del mismo mes reintenta. `notas_digitales.periodo` protege contra un duplicado del mismo mes.
- `proximasFechas` anuncia la próxima: el primer día con notas desde el 1° del mes siguiente, si el mes ya se evaluó, o desde hoy. De
  ahí salen Correos → Estado, la vista previa y la prueba (`diaDeVistaPrevia`).
- Las reiteraciones de noviembre ya salieron el 03/11/2026 a las 8:15 (Notas 6/26 y 7/26). Las marcas dicen `2026-11`. Con el código
  de hoy, la próxima sería el martes 01/12/2026.
- `periodo` se escribe en `generarNota` y solo lo lee la guarda de la corrida. El Seguimiento, Métricas y los reportes cuentan las
  notas que salieron: ninguna regla ni ventana supone una por mes.
- Ninguna nota, anexo ni Word dice nada de la frecuencia.

## 3. La regla

**Una reiteración solo se genera en un período cuyo mes es enero, marzo, mayo, julio, septiembre o noviembre.** Es el primer día con
notas de ese mes, como hoy. En 2027, con los feriados que hay cargados: 04/01 (el 01/01 es feriado y el 2 y el 3 son fin de semana),
01/03, 03/05 (el 01/05 es feriado y sábado), 01/07, 01/09 y 02/11 (el 01/11 es feriado).

Dentro de un mes que toca, todo sigue igual: una evaluación por mes y por gestión, y si hoy no se pudo generar, la próxima corrida del
mismo mes vuelve a intentar.

En un mes que no toca, la corrida salta solo ese paso: los reintentos, los avisos, la nota de autorización y la nota de auditoría
salen igual. Una reiteración que quedó fallida en enero se sigue reintentando en febrero, porque ya está generada y numerada.

Rige desde que se despliega, sin fecha en el código: el mes par que encuentre no genera nada. Si se despliega antes del martes
01/12/2026, la próxima reiteración es la del lunes 04/01/2027. Si llega después, la de diciembre habrá salido como siempre, sin
perjuicio; hay que corregir entonces el mes de la aclaración de la sección 6.

### 3.1 Un mes que toca y se pierde

**Decisión del usuario: espera al próximo mes que toca.** Una reiteración nunca sale en un mes par, tampoco a la vuelta de una licencia.

- Licencia del firmante sin persona autorizada del 21/12/2026 al 05/02/2027: no hay notas en todo enero. La vuelta es en febrero, así
  que la próxima reiteración es la del 01/03/2027.
- Licencia del 28/12/2026 al 15/01/2027: la vuelta, el 18/01, cae en enero y ese mes no se evaluó. Sale el 18/01.
- Licencia del 10/01/2027 al 20/01/2027, con enero ya evaluado el 04/01: la licencia no toca ninguna reiteración. La próxima sigue
  siendo el 01/03.
- Vale igual si el «Envío automático» estuvo apagado o la configuración incompleta durante todo el mes, y si la generación falló en
  todas las corridas del mes.

### 3.2 La marca

**Decisión del usuario: en un mes que no toca no se escribe nada.** La marca conserva lo que quiere decir: el último mes evaluado. En
diciembre de 2026 sigue diciendo `2026-11`.

La consecuencia, también decidida: si hay que volver al código anterior en la mitad de un mes par, la corrida siguiente genera la
reiteración de ese mes, porque el código mensual la generaría. El kit lo advierte y trae un SQL opcional que escribe la marca de ese
mes en las dos gestiones, para el que no la quiera.

### 3.3 Sin tablas ni columnas

No hay SQL en el despliegue. `periodo` sigue valiendo como el mes de la nota.

## 4. Lo que anuncia el sistema

**La próxima reiteración** (`proximasFechas`): desde el mismo punto de partida que hoy (el 1° del mes siguiente si el mes ya se evaluó;
si no, hoy), el primer día con notas. Si cae en un mes que no toca, se vuelve a buscar desde el 1° del mes siguiente, hasta dar con uno
que toca. Esa búsqueda tiene que mirar el resultado y no el punto de partida:

| Hoy | Marca | Licencia | Próxima reiteración |
|---|---|---|---|
| Mar 15/12/2026 | 2026-11 | | Lun 04/01/2027 |
| Lun 04/01/2027, antes de la corrida | 2026-11 | | Lun 04/01/2027 |
| Lun 04/01/2027, después de la corrida | 2027-01 | | Lun 01/03/2027 |
| Sáb 30/01/2027, sin evaluar enero | 2026-11 | | Lun 01/03/2027 (el primer día con notas sería el 01/02, par) |
| Vie 15/01/2027 | 2026-11 | Del 21/12 al 05/02, sin autorizada | Lun 01/03/2027 (el primer día con notas sería el 10/02, par) |
| Lun 01/02/2027 | 2027-01 | | Lun 01/03/2027 |

**La vista previa y la prueba** no cambian de código: muestran lo que dice `proximasFechas` (`diaDeVistaPrevia`), con `otro_dia` y `motivo`
como hoy. En diciembre, la vista previa de una reiteración muestra la del 04/01/2027 y dice «Esta nota no sale hoy: así saldría el
04/01/2027.». La prueba dice «Prueba enviada a … (como saldría el 04/01/2027)». «Con la marca sin escribir, la del mismo día» sigue
valiendo en un día hábil de un mes que toca.

**La cantidad** de Correos → Estado es lo que se seleccionaría ese día con los datos de hoy, como siempre. Ahora proyecta hasta dos
meses, así que es un piso: un dataset que todavía no tuvo su aviso no cuenta y puede sumarse.

La pantalla no cambia: «Próxima reiteración» sigue diciendo la fecha y la cantidad que manda el servidor.

## 5. Los textos que cambian

**Decisión del usuario: un texto general, sin fecha.** La fecha exacta está en «Próxima reiteración», en Correos → Estado.

`public/correos.html`, «Cómo funcionan» (lo demás del párrafo no cambia):

> Reiteración el primer día hábil de enero, marzo, mayo, julio, septiembre y noviembre para los datasets avisados hace 20 días o más que
> siguen pendientes.

`efectoEnNotas`, en `public/js/usuarios.js` y su copia en `public/js/mi-espacio.js`:

- Licencia en curso, sin persona autorizada:
  > Licencia en curso sin persona autorizada: no se generan notas hasta la vuelta. Lo que toque avisar sale el primer día hábil después
  > de la licencia. La reiteración que toque, ese día si es un mes de reiteración; si no, en el próximo.
- A continuación de otra licencia, sin persona autorizada:
  > Empieza a continuación de otra licencia: los avisos no se adelantan. Lo que toque avisar sale el primer día hábil después de la
  > licencia. La reiteración que toque, ese día si es un mes de reiteración; si no, en el próximo.
- Licencia futura, sin persona autorizada:
  > Sin persona autorizada: los avisos que tocarían durante la licencia salen por adelantado el 04/12 (corrida de las 8:15). La
  > reiteración que toque durante la licencia sale a la vuelta, si es un mes de reiteración; si no, en el próximo. Cargá la licencia
  > antes de ese día.

`textoLicenciaFirmante`, en `public/js/correos.js`, siempre sin persona autorizada:

- Futura:
  > Licencia del firmante del 05/02/2027 al 20/02/2027, sin autorizado: los avisos se anticipan el 04/02/2027 y las notas vuelven el
  > 22/02/2027. La reiteración que toque sale ese día si es un mes de reiteración; si no, en el próximo.
- En curso:
  > Licencia del firmante del 05/02/2027 al 20/02/2027, sin autorizado: no se generan notas hasta la vuelta, el 22/02/2027. La reiteración
  > que toque sale ese día si es un mes de reiteración; si no, en el próximo.
- A continuación de otra licencia:
  > Licencia del firmante del 05/02/2027 al 20/02/2027, sin autorizado: empieza a continuación de otra licencia, así que los avisos no se
  > adelantan y las notas vuelven el 22/02/2027. La reiteración que toque sale ese día si es un mes de reiteración; si no, en el próximo.

`AVISO_SIN_PERSONA_A_CARGO`, en `services/miEspacioReglas.js`:

> Sin persona a cargo: esos días no se generan Notas Digitales y lo que venza entra en la próxima reiteración.

**No cambian:** «Próxima reiteración», «Esta nota no sale hoy: así saldría el…», «Cómo saldría en la próxima corrida con notas…» (el
aviso de abajo dice qué día es), los textos con persona autorizada, y la «reiteración» de la auditoría, de las notas DGMIT y del Generador de
Notas, que son otra cosa.

## 6. Métricas: la aclaración

**Decisión del usuario: se suma.** Con menos notas va a haber más ciclos con «Ninguna» reiteración del RPAD a la DGMIT, sin que nada haya
mejorado.

> Desde diciembre de 2026, la reiteración sale cada dos meses.

Va debajo de «Del RPAD a la DGMIT», en «Reiteraciones por ciclo», en la pestaña Métricas y en los PDF que dibujan los resultados (Métricas
del año y el Informe anual). La arma el servidor, en `textos.reiteraciones.aclaracion`, el campo donde ya viaja la de los emails viejos: si
van las dos, una detrás de la otra, primero la de los emails. Va siempre que haya ciclos (sin ciclos, `aclaracion` sigue en null). La página
y los PDF imprimen ese campo: `public/js/reportes.js` no cambia.

La foto del 31/12/2026 todavía no existe (0 filas en `metricas_fotos`): se saca el 10/01/2027 con la aclaración adentro. Esta entrega va antes
de esa fecha porque el plazo real es el 01/12.

Ninguna otra cifra de Métricas cambia de regla.

## 7. Lo que el usuario sabe que pasa

- **Se reitera más tarde lo que vence a fin de un mes impar:** son 38 de los 50 datasets que vencen hasta diciembre de 2027. La primera
  reiteración después de vencer cae unos 30 días más tarde que hoy. Los 17 externos que vencen el 31/01/2027 tienen su aviso el 22/12/2026,
  no llegan a los 20 días el 04/01/2027 y se reiteran el 01/03/2027 (29 días después de vencer); hoy sería el 01/02/2027.
- **Lo que vence a fin de un mes par** se reitera como hoy, al día siguiente de vencer o a los pocos días. Lo interno de mes par pierde la
  reiteración previa al vencimiento que tiene hoy.
- **El peor caso con aviso** es de unos 35 días después de vencer. **Un vencido sin ningún aviso** (un alta ya vencida) espera hasta 63
  días la próxima corrida que toca, contra 34 hoy.
- **Una licencia sin persona autorizada que cubre un mes que toca** puede dejar unos cuatro meses sin reiteración (del 03/11/2026 al
  01/03/2027, en el ejemplo).
- **El aviso en su fecha con persona autorizada:** lo que ya cumplió 20 días y «lo informa la reiteración» (`yaTocaReiterar`) espera al próximo
  mes que toca, igual que todo lo demás. Nunca queda afuera para siempre.
- **Una generación que falla todas las corridas de un mes que toca** no se reintenta hasta el próximo. El Estado lo muestra mientras dure, como
  cualquier corrida con errores, hasta la primera corrida del mes siguiente.
- **Notas por año:** de 24 a 12 (de 12 a 6 por gestión). La serie por mes de «El trabajo del RPAD» queda en serrucho.

## 8. Los tests

Hay unos 24 que esperan una reiteración en un mes par, y dos que dependen del reloj real y pasarían hoy y fallarían en diciembre
(`tests/notas-motor.test.js`, `HOY`; `tests/notas-api.test.js`, «preview/anexo?tipo=reiteracion»). Se fijan en una fecha o se blindan, y se
comprueban con el reloj en diciembre y en febrero.

Lo nuevo: la regla pura en los 12 meses y con lo que no es un período; la corrida en un mes par (sin nota, sin email, sin error, sin gastar un
número y sin tocar la marca, con el aviso, la auditoría y el reintento de una fallida saliendo igual); el mes que toca, con el cambio de año; el
borde de los 20 días (avisado el 15/12, entra el 04/01; avisado el 16/12, espera a marzo); enero sin corridas; una falla que se reintenta solo
dentro de su mes; la licencia sin persona autorizada de la sección 3.1; la tabla de la sección 4 en el Estado, con «lo anunciado se cumple»; la
vista previa y la prueba en un mes par; los textos, con su paridad; y la aclaración de Métricas.

## 9. La simulación

Obligatoria antes del merge (toca corridas y notas), con una copia de producción, sin envíos reales y con el método de las anteriores: la copia con
prefijo propio, el reloj simulado, la barrera de red, los emails a archivos y los candados con nombres propios. Dos corridas, 3949aae y la rama, del
04/11/2026 a mayo de 2027, a las 8:15 y a las 14:00, y una variante con la licencia de la sección 3.1.

Lo esperado: solo desaparecen las reiteraciones de diciembre, febrero y abril, y se corren los números del libro. Los avisos y las auditorías son los
mismos, en los mismos días, con los mismos datasets. Lo que anuncia el Estado es lo que sale. Sin errores ni intentos de red.

## 10. El despliegue

Sin SQL, sin Tarea Cron, sin variables de entorno y sin Run NPM Install: los archivos y Restart, fuera del horario de los crons, **antes del martes
01/12/2026**. Después, Correos → Estado dice «Próxima reiteración 04/01/2027» en las dos gestiones.

La vuelta atrás: los archivos de 3949aae y Restart. En un mes par, la corrida siguiente genera la reiteración de ese mes; si no se la quiere, el SQL
opcional del kit antes de las 8:15.
