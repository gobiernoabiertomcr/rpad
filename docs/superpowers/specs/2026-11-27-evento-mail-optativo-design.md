# «Yo y quienes elija» con el aviso por mail optativo

Fecha: 27/11/2026.
Decisiones del usuario del 27/11/2026, en dos rondas, mirando una maqueta navegable sobre su Mi espacio real (una copia de la base, fuera del repo).
Los textos van al pie de la letra. Las personas de los ejemplos son inventadas: Micaela depende de Federico, que depende de Graciela.

Sigue a `2026-10-29-mi-espacio-evento-publico-design.md` y a `2026-11-04-agenda-aviso-y-dependencia-design.md`: lo que acá no se dice, sigue como dicen ellas.
Cambia una decisión de la del 04/11 (sección 10).

## 1. Por qué

El usuario cargó unos eventos personales como Personal (Privado), «Solo yo», porque en «Yo y quienes elija» a la persona de la que depende le llega siempre un mail.
Pidió, con sus palabras: «me gustaría poder configurarlos como "Yo y quienes elija" pero que avisar por mail en la primera opción sea optativo».

Quiere que las personas que marca lo vean en su agenda, con el texto corto, y elegir en cada evento si a su cadena le llega el mail.

**Objetivos:** un tilde por evento en el recuadro «Aviso por mail» de «Yo y quienes elija»; apagado, a nadie de la cadena le llega ningún mail por ese evento, y quienes están marcados lo siguen viendo en su agenda como «Micaela: Fuera de la oficina».

**No objetivos:** cambiar quién ve qué en la agenda; cambiar el Privado o el Laboral; cambiar la casilla «Recibir mi agenda por mail»; mandar un mail que deshaga uno que ya salió.

**Antiobjetivos:** que un evento con el tilde apagado le llegue a alguien de la cadena por cualquier camino (el mail de las 14:00, el de las 8:05 o el grupo «Hoy»); que un evento que ya existe deje de avisar sin que nadie lo apague; que una pestaña con la página anterior prenda o apague el tilde sin querer; que el formulario, el aviso al guardar o la ayuda prometan un mail que no va a salir; que el título o el detalle de un Público lleguen a otra persona; que un nombre real, un título real o un dato de producción queden en el repo.

## 2. Lo que decidió el usuario

| Tema | Decisión |
|---|---|
| El tilde | Una casilla en el recuadro «Aviso por mail»: el título de hoy pasa a ser el rótulo de la casilla. Debajo siguen las iniciales y el nombre corto de la cadena y la frase de cuándo llega. |
| De entrada | En un evento nuevo, **prendido**. Los eventos que ya existen siguen mandando el mail. |
| La frase, apagado | «De quien dependés: no le va a llegar ningún mail por este evento.» (con varias personas: «De quienes dependés: no les va a llegar ningún mail por este evento.»). Los chips de la cadena, en gris. |
| El aviso al guardar, apagado | «Evento guardado. {quien_texto} en su agenda, sin aviso por mail.» (en un cambio, «Evento cambiado.»). |
| Prenderlo tarde | Prender el tilde cuenta como cargar el evento en ese momento, igual que hoy un Privado que pasa a Público: después de las 14:00 del día hábil anterior, sale a las 8:05 del día; para hoy, no sale. Coincide con lo que dice la frase. |
| Apagarlo tarde | Lo que salió, salió: no se manda nada para deshacerlo (tampoco hoy hay mails por cambios ni borrados). Desde ahí no aparece en ningún mail más. Si se vuelve a prender para la misma fecha, no se repite. El formulario no dice si ya salió. |
| Dónde se ve | Una insignia gris «Sin aviso por mail» en Próximos y en el día elegido, al lado de «Lo ve Federico como «…»»; y en «Hoy y mañana» del Resumen, «Hoy · lo ve Federico como «…», sin aviso por mail». Tu propio mail de la agenda no cambia. |
| La ayuda de las personas, apagado | Sin la parte del mail: «Federico ya está en la lista, porque dependés de esa persona. Si le sacás la marca, no lo ve en su agenda.». Sin la marca, solo la primera oración de siempre. |
| Configuración | La ayuda de «Depende de» suma «salvo los que cargue sin aviso por mail». |

## 3. Cómo se construye (enfoques)

1. **Una columna por evento, `mi_espacio_eventos.aviso_por_mail`, prendida de entrada** (elegido, decisión de la sesión que el usuario aprobó con la spec): el pedido es por evento, los que ya existen quedan prendidos sin tocar datos, y el corte va en un solo lugar del aviso diario.
2. Una preferencia por persona: descartada, el usuario la quiere en cada evento.
3. Que a la cadena le llegue solo si está marcada en «Quiénes lo ven en su agenda»: descartada, deshace la separación del 04/11 entre el mail y la agenda («aca estamos mezclando») y no deja que alguien marcado lo vea sin mail.

## 4. El formulario

En «¿Quién lo ve?» → «Yo y quienes elija», solo si quien carga depende de alguien (si no, como hoy, no hay recuadro):

```
┌──────────────────────────────────────────────┐
│ [✓] Aviso por mail                           │
│     (FR) Federico  (GP) Graciela             │
│     De quienes dependés: les llega la        │
│     notificación por mail el jueves 05/11    │
│     a las 14:00.                             │
└──────────────────────────────────────────────┘
```

- La casilla reemplaza al ícono del mail, en la misma columna; «Aviso por mail», en negrita, es su rótulo (un clic en el texto la cambia).
- **Prendida**, todo como hoy: la frase es la del servidor (`GET /mi-espacio/eventos/aviso-de-la-cadena`), que cambia con la fecha y la hora.
- **Apagada**, los chips en gris (fondo transparente, borde punteado y texto `--sg-suave`; el color nunca es lo único: también la frase) y la frase de la sección 2.
  Esa frase es del navegador, como las otras frases fijas del formulario: no depende de la fecha.
  Mientras está apagada no hace falta pedir el cuándo; se puede seguir pidiendo igual, para tenerlo al prenderla.
- La casilla tiene foco visible, se maneja con el teclado y lleva `aria-describedby` a la frase. Al tocarla, el foco se queda en ella aunque se redibuje el recuadro.
- **Lo que guarda:** el valor de la casilla viaja en el cuerpo del guardado como `aviso_por_mail` (booleano), solo en un Público (sección 5).
- **Un evento nuevo** arranca prendido. **Uno que se edita**, con lo que tiene (`aviso_por_mail` del ítem; si no viene, prendido).
  Cambiar de tipo y volver no lo toca: la casilla es del formulario mientras esté abierto.
- **La ayuda de las personas, apagada** (sección 2): con todas las de la cadena marcadas, «Federico ya está en la lista, porque dependés de esa persona. Si le sacás la marca, no lo ve en su agenda.» o «Federico y Graciela ya están en la lista, porque dependés de esas personas. Si les sacás la marca, no lo ven en su agenda.»; si no, solo «Lo ven en su agenda y en el Resumen, solo con el texto corto. Por marcarlas acá, no les llega ningún mail.».
  Prendida, como hoy.
- La preselección de la cadena en un evento nuevo (`marcarLosSuperiores`) no cambia: es de la agenda, no del mail.

## 5. El guardado y la API

### 5.1 El cuerpo y la validación

- `POST` y `PUT /mi-espacio/eventos` aceptan `aviso_por_mail` en un Público.
- **Solo el `false` literal lo apaga y solo el `true` literal lo prende.**
  Sin la clave, o con otra cosa (`'false'`, `0`, null): en un alta, prendido; en un cambio de un evento que ya era Público, **lo que tenía**; en un cambio de un Privado o un Laboral a Público, prendido.
  Así una pestaña con la página anterior (que no la manda) no prende ni apaga nada: es la regla de «un cuerpo sin `depende_de` no lo toca».
  No hay mensaje de error nuevo: ningún valor da 400 (decisión de la sesión: es una casilla, no un dato que se escriba).
- Un Privado y un Laboral ignoran lo que llegue y se guardan con `aviso_por_mail` 1, como `texto_publico` queda NULL: si después pasa a Público, arranca prendido.
- `validarEvento` devuelve `aviso_por_mail` en `datos`: `true`, `false` o `null` («no vino») en un Público, y `true` en los demás; el controlador resuelve el `null` con el evento de antes.

### 5.2 `publicado_at`

Hoy se escribe con `ahoraArgentina()` cuando un evento queda Público siendo nuevo, cuando pasa a Público y cuando un Público cambia de fecha.
**Se suma: cuando el tilde pasa de apagado a prendido**, aunque no cambie la fecha (decisión del usuario, «prenderlo cuenta como cargarlo en ese momento»).
Apagarlo no lo toca.

Por qué alcanza: un rezagado de las 8:05 es «sin informar, de hoy, con `publicado_at` anterior a hoy». Prendido hoy para hoy, `publicado_at` es hoy y no sale, como dice la frase («como es para hoy, no le llega ningún mail»). Prendido hoy después de las 14:00 para mañana, mañana es rezagado y sale a las 8:05.

### 5.3 El mensaje al guardar

`mensajeDelGuardado` recibe el tilde. En un Público con la cadena y el tilde apagado: «Evento {guardado|cambiado}. {quien_texto} en su agenda, sin aviso por mail.», aunque la fecha no llegara en ningún aviso.
Sin nadie de quien dependa, como hoy: «Evento guardado. {quien_texto} en su agenda.» (no vio ningún tilde).
Con el tilde prendido, como hoy.

### 5.4 Lo que devuelve

- El ítem de un Público **propio** (`itemDeEvento`) suma `aviso_por_mail` (booleano), después de `texto_publico`.
- El ítem recortado de un Público de otra persona **no** lo trae: sigue siendo el literal de siempre.
- `GET /mi-espacio/eventos/aviso-de-la-cadena` no cambia.

## 6. El aviso diario

- `eventosDelAviso` trae `aviso_por_mail` de cada evento (prendido salvo un 0 de la base).
- En `mailDeLaPersona`, un Público de otra persona con `aviso_por_mail === false` **no entra a lo de su gente**: ni a las 14:00, ni a las 8:05, ni al grupo «Hoy», ni cuenta como rezagado. No se marca como informado.
  El corte va en la rama del Público ajeno, junto a `creador_activo`, y no lee nada más del evento: los tests con getters que tiran en `titulo`, `detalle`, `personas` y `vistas` siguen pasando.
- **Lo propio no cambia:** quien lo cargó, con la casilla «Recibir mi agenda por mail», lo sigue recibiendo con su marca de siempre.
- Lo ya informado queda: si se apaga y se vuelve a prender para la misma fecha, no se repite.

## 7. Dónde se ve en la página

- **Próximos y el día elegido:** un Público tuyo con el tilde apagado suma la insignia gris `me-insignia gris` «Sin aviso por mail», después de «Lo ve Federico como «…»». La insignia la decide `aviso_por_mail === false` del ítem; el texto es del navegador.
- **El Resumen, «Hoy y mañana»:** el servidor suma «, sin aviso por mail» al `quien` de un Público propio con el tilde apagado: `quien` «lo ve Federico como «Fuera de la oficina», sin aviso por mail» y `detalle` «Hoy · lo ve Federico como «Fuera de la oficina», sin aviso por mail».
- La grilla del mes, la leyenda y el detalle de un evento ajeno no cambian.

## 8. Configuración

La ayuda de «Depende de» (`#u-depende-ayuda` de `configuracion.html`) pasa a decir:

> A esta persona y a quien esté más arriba les llega por mail el texto corto de los eventos que quien depende de ellas deja a la vista de otros, salvo los que cargue sin aviso por mail. No ven nada más de su Mi espacio.

## 9. La base

Migración `migracion-mi-espacio-evento-aviso-por-mail.sql`, fila 41 de `docs/temas/despliegue.md`, aditiva y repetible, antes que el código; también en `database/schema.sql`:

- `mi_espacio_eventos.aviso_por_mail` `tinyint(1) NOT NULL DEFAULT 1`, después de `publicado_at` (`ADD COLUMN IF NOT EXISTS … AFTER publicado_at`). Todos los eventos que ya existen quedan en 1.

El código anterior anda con la columna: no la lee y lo que guarda queda en 1.
El código nuevo sin la columna da «Unknown column» en toda la agenda: por eso la migración va antes.

Vuelta atrás, `rollback-mi-espacio-evento-aviso-por-mail.sql`, después de volver a los archivos anteriores: borra la columna. **Los eventos que tenían el tilde apagado vuelven a mandar el mail a la cadena**: lo dice el encabezado, con la consulta para listarlos antes (`SELECT id, creado_por, fecha FROM mi_espacio_eventos WHERE aviso_por_mail = 0 AND activo = 1`).
Si también se deshace el aviso diario, va antes que `rollback-mi-espacio-eventos-diario.sql`: las vueltas atrás van de la más nueva a la más vieja.

## 10. Lo que cambia de las specs anteriores

1. **«Apaga solo lo propio: lo que le llega como jefe no se apaga, para que el objetivo no dependa de una casilla»** (04/11, 2.7 y 5.2): la casilla de quien recibe sigue igual, pero el mail a la cadena ahora depende del tilde de **quien carga** el evento.
   Motivo: el objetivo del 04/11 era que los jefes se enteren de lo que su gente deja a la vista, y el usuario ahora quiere poder dejar algo a la vista de quien elige (su agenda) sin avisarle a la cadena por mail.
   Quien recibe sigue sin poder apagar lo de su gente; quien carga decide, evento por evento, y la página lo dice en el formulario, al guardar, en Próximos y en el Resumen.
2. **«No depende de a quién marcó quien lo cargó»** (04/11, 5.2) sigue valiendo: el tilde es otra cosa que las marcas de la agenda.

## 11. Lo que no cambia

- El Privado y el Laboral, sus mails y sus frases.
- Quién ve un Público en su agenda, cómo lo ve y su orden.
- El recordatorio de un Público: le llega solo a quien lo cargó.
- La casilla «Recibir mi agenda por mail» y lo que le llega a quien lo cargó.
- `GET /mi-espacio/eventos/aviso-de-la-cadena`, `cuandoLlegaElAviso` y `fraseDelAviso`.

## 12. Pruebas

- **Reglas:** `validarEvento` con el tilde (`true`, `false`, sin la clave, `'false'`, `0`, null; en un Privado y un Laboral, `true` siempre) y el deepEqual de `datos`; `mensajeDelGuardado` con el tilde apagado, con y sin cadena, y con un aviso que no llega; `itemDeEvento` (las claves del Público propio suman `aviso_por_mail`; el ajeno, igual); `eventosDeHoyYManana` con el sufijo.
- **El aviso diario, puro:** un Público de la gente con el tilde apagado no entra a las 14:00, a las 8:05, al grupo «Hoy» ni dispara un mail de las 8:05; lo propio sí sale; los getters que tiran siguen pasando; un evento sin la clave (los fixtures de hoy) cuenta como prendido.
- **La API, con la base de prueba:** el alta apagada guarda 0; un cambio sin la clave conserva; un Privado que llega con `false` guarda 1; pasar de Privado a Público sin la clave, 1; `publicado_at` se reescribe al prenderlo (aunque no cambie la fecha) y no al apagarlo; el mensaje.
- **La corrida, con Mailpit:** un jefe no recibe el texto de un Público con el tilde apagado; con otro Público prendido el mismo día, recibe solo ese.
- **Página:** la casilla (prendida en uno nuevo, la del ítem al editar), la frase apagada en singular y en plural, los chips en gris, el foco, el cuerpo con y sin `aviso_por_mail` por tipo (deepEqual y orden de claves), la ayuda de las personas, la insignia de Próximos y del día elegido, y el id nuevo en la lista de `tests/paginas.test.js`; la ayuda nueva de Configuración.
- **Esquema:** la columna en `tests/schema.test.js`, con su rollback.
- `npm test` completo antes y después.

## 13. Despliegue

Kit `RPAD-deploy-mi-espacio-evento-aviso-por-mail` contra f94b2aa (producción hoy).
`PASOS.txt` empieza comprobando `mi-espacio.js?v=20261234`, lo que dejó f94b2aa.
Orden: migración en phpMyAdmin, archivos, Restart. Sin Tarea Cron nueva y sin `npm install`.
Ventana: fuera de las 8:05 y las 14:00, de los minutos :00 y :30 (los recordatorios), de las rutinas de Datito y de los lunes a la mañana.
Después del despliegue, el usuario cambia sus eventos a «Yo y quienes elija» desde la página, con el tilde apagado: no hay SQL de datos.

## 14. Lo que queda a quien lo construya

- El HTML exacto del recuadro (dónde vive la casilla respecto de `#ev-tipo-ayuda`, que hoy es un `<p>` descrito por el grupo del tipo), cuidando que el grupo siga describiéndose con la frase y que la casilla no quede dentro de un párrafo que se lee como descripción.
- Los nombres de las constantes del navegador (la frase apagada, la insignia) y de los parámetros nuevos.
- Subir `?v=` de `mi-espacio.js` y su constante en `tests/paginas.test.js`.
- Actualizar `docs/temas/mi-espacio-evento-publico.md`, `mi-espacio-aviso-diario.md`, `mi-espacio-agenda.md` (el Resumen), `base-de-datos.md`, `configuracion.md` y `despliegue.md`.
