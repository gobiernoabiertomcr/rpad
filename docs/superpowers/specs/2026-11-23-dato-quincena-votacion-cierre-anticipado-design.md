# El dato de la quincena: la votación cierra cuando votaron todos

Fecha: 23/11/2026. Base: main ed2e70b (en producción desde el 23/11).
Anexo de `docs/superpowers/specs/2026-11-23-dato-quincena-principal-votacion-design.md`: lo que no se dice acá sigue como está ahí.

## Por qué

- Hoy la votación queda abierta hasta las 12:00 del día del mail aunque ya hayan votado todas las personas de la lista.
- El usuario quiere saber la principal antes, para empezar a trabajarla, y que el voto quede firme una vez que votaron todos.
  El mail del resultado no estaba entre los motivos.

## La regla (decisiones del usuario)

- La votación cierra en lo que pase primero: las 12:00 del día del mail (el cierre de siempre) o el momento en que vota la última persona de la foto de esa edición.
- Mientras falte alguien, cada persona cambia su orden cuando quiera, como hoy.
- «Votaron todos» es toda la foto de la edición: quien no puede votar (de licencia, con la cuenta desactivada o borrada) cuenta igual, así que si no vota, cierra a las 12:00.
  Una foto vacía nunca cierra antes: termina en «nadie votó» a las 12:00, como hoy.
- A quien es la única que falta votar se le avisa en el diálogo, antes de guardar: «Sos la última persona en votar: al guardar, la votación cierra y nadie puede cambiar su orden.».
  Quien ya votó y cambia su orden mientras falta otra persona no ve el aviso.

## Enfoque (decisión del usuario)

- Elegido: se calcula al leer, como el resto de la votación: el cierre anticipado sale de los votos guardados, sin migración ni columna nueva.
  Los votos solo se agregan, así que una vez que votaron todos queda así para siempre: no se puede reabrir.
- Descartado: anotar el cierre en una columna cuando vota la última. Pedía otra migración en producción para algo que ya dicen los votos.

## El detalle

- El voto que cierra es el que completa la foto: el primer voto válido de la última persona que faltaba.
  Cuenta él y los anteriores; ningún voto posterior cuenta, y el servidor los rechaza con el 409 de siempre, «La votación ya cerró.».
  Mi decisión: para que el orden de los votos y el del cierre no se crucen por segundos, la hora del voto se toma con la fila de la votación ya bloqueada, la misma hora con la que se mira el cierre; y qué votos cuentan se decide por el orden en que se guardaron (el `id`), no solo por la hora.
- La hora del cierre anticipado es la de ese voto.
  El sellado guarda esa hora en `cierre_at`.
- El sellado y el mail del resultado no cambian de horario: a las 14:00 del día del cierre de siempre (el del mail de la edición), solo un día hábil.
  Si votaron todos la noche anterior, la página ya muestra la ganadora y el mail llega igual a las 14:00 de ese día.
- Los textos (los arma el servidor):
  - cerrada por todos, `cierre`: «La votación cerró el lunes 23/11/2026 a las 21:40, cuando votaron todos.»; en la franja y en el mail;
  - el `message` del voto que cierra: «Guardamos tu orden. Votaron todos: la votación cerró.»;
  - el aviso del diálogo, una clave nueva de `votacion` (`aviso_de_cierre`, null salvo para quien es la única que falta): el texto de arriba.
- La página: el aviso va arriba de «Guardar mi orden», en el diálogo; después de guardar el último voto, la edición se redibuja cerrada (la ganadora, «Ver los votos»).
- Mi espacio y la lista no cambian de regla: el ítem «Votá la principal» desaparece al cerrar y la tarjeta muestra la ganadora, también cuando cierra antes.

## No cambia

- El cierre de las 12:00, el desempate, los puntos, la foto al llegar, el mail de la edición y el contrato con Datito.
- La votación de la edición del 23/11 sigue con la regla de hoy: este cambio se despliega después de su sellado (el martes 24/11 a las 14:00).

## Despliegue

- Sin SQL. Archivos y Restart, contra ed2e70b; `dato-quincena.js?v=` sube (el aviso del diálogo).
- Después del martes 24/11 a las 14:10 y antes del lunes 07/12.

## Lo que queda al implementador

- Dónde vive el cálculo del cierre anticipado (las reglas puras de la votación) y cómo lo usan el detalle, la lista, Mi espacio, el voto y el sellado.
- Los tests de cada caso: cierra al votar la última; un cambio después da 409; un cambio mientras falta alguien sigue valiendo; foto vacía; alguien que no vota; el aviso solo para la última; dos votos a la vez que completan la foto.
