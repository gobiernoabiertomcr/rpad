# Mi espacio: de qué licencia salen los días de unas vacaciones

Spec 2026-10-27-mi-espacio-dias-de-vacaciones. Cambia la regla del reparto de la spec 2026-10-26-mi-espacio-licencias-y-horas
(3.1, «El reparto se hace día por día…»). Todo lo demás de esa spec sigue igual.

## 1. Lo que vio el usuario (27/10/2026)

Probando «Cargar licencia» con unas vacaciones de diciembre a enero, el aviso azul del modal partía la licencia más vieja en
el 31/12. Una persona de planta (hoy, el 27/10/2026) tenía disponibles 15 días de la licencia 2024 (vence el 31/12/2026), 20
de la 2025 y 10 de la 2026, más otros 10 de la 2026 que se habilitan el 1/1/2027. Con unas vacaciones del 16/12/2026 al
10/01/2027, el modal decía:

> 16 días hábiles de 26 corridos. Salen de las licencias 2024 (11 días) y 2025 (5 días), las más viejas. Te quedan 29 días:
> 4 de la 2024 (vencen el 31/12/2026), 15 de la 2025 y 10 de la 2026.

Los días de diciembre salían de la 2024 y los de enero, de la 2025. El usuario explicó que eso está mal: «para usufructuarlas,
cuando tengo el total de la licencia de un año (o el saldo) se tiene que usar primero todo». Lo correcto era «Salen de las
licencias 2024 (15 días) y 2025 (1 día)».

No es un error de programación. Las reglas hacen lo que decía la spec, que repartía día por día: cada día hábil salía de la
licencia más vieja que *ese día* estuviera habilitada y no vencida. Al llegar el 1/1, la 2024 ya estaba vencida para los días
de enero. Lo que cambia es la regla.

## 2. La regla nueva (decisiones del usuario, 27/10/2026)

1. **El vencimiento mira el día en que se empieza a usar la licencia, no cada día.** En palabras del usuario: «una licencia
   que se vence el 31/12, puedo comenzar a usufructuarla el último día hábil de diciembre y corre hasta el año que viene».
   Una carga de vacaciones que empieza a usar la licencia 2024 a más tardar el 31/12/2026 la sigue usando en enero de 2027,
   hasta que se le terminan los días o hasta que termina la carga.
2. **Cada carga es una licencia aparte.** «Cuando se pide una licencia ordinaria se pide N días. Se pide de una vez, no de a
   dos partes (aunque sean días hábiles consecutivos).» Una carga que empieza desde el primer día hábil posterior al
   vencimiento (el 04/01/2027, en el ejemplo) ya no puede usar esa licencia: «tiene que ser LICENCIA 2025 en adelante. Lo 2024
   se perdió». Dos cargas seguidas (21/12–31/12 y 04/01–10/01) no se juntan: la de enero ya no usa la 2024.
3. **Dentro de una carga, la más vieja primero, sin partirla.** Los días hábiles de una carga salen, en orden, de la licencia
   que la carga está usando. Cuando a esa licencia no le quedan días habilitados, el día siguiente sale de la más vieja que *ese
   día* esté habilitada, no vencida y con días libres (como hasta ahora). La habilitación se sigue mirando día por día: la
   segunda mitad que se habilita el 1/1 sirve para los días de enero.
4. **Las cargas se reparten en el orden de sus fechas.** La primera que empieza toma primero (dos licencias de Mi espacio no
   comparten días). Como hasta ahora, nada se guarda: cargar después unas vacaciones anteriores cambia de qué licencia salen
   las siguientes.
5. **«Perdés».** Lo que queda de una licencia se pierde si, desde hoy y después del final de la última carga que la usa (sin
   ninguna, desde hoy), ya no queda ningún día hábil libre hasta su vencimiento. Un día libre es un día hábil, con los
   feriados de la tabla, que no está dentro de ninguna licencia de Mi espacio, de cualquier tipo. Esos días ya no están
   disponibles: no cuentan en «Te quedan», ni en «N disponibles» de la opción de «Cargar licencia», ni en la frase y la regla
   del Resumen, ni en «Vence pronto», ni en el email de vencimiento. Mientras quede un día libre antes del vencimiento, siguen
   disponibles, porque una carga que empiece ese día los puede usar todos («Si me quedan 10 días de licencia 2024, puedo
   usarlos desde el 30/12/2026 hasta enero»).
6. **El texto de «Perdés», el mismo en el modal y en el Resumen.** El usuario lo eligió así, a sabiendas de que la spec
   anterior pedía que nada dijera «perdiste» (esta decisión la reemplaza solo para esto):
   - en el aviso del modal, después de «Te quedan …»: «Perdés 2 de la 2024 (vencen el 31/12/2026).»; con 1, «Perdés 1 de la
     2024 (vence el 31/12/2026).»; con dos licencias, «Perdés 2 de la 2024 (vencen el 31/12/2026) y 1 de la 2025 (vence el
     31/12/2027).»; sin nada disponible, «No te quedan días disponibles. Perdés 7 de la 2024 (vencen el 31/12/2026).»;
   - en el Resumen, la misma oración al final de la bajada de la frase, en ámbar (como la licencia que vence en el año).
     No es una capa de la regla: esos días no se pueden usar.

## 3. Ejemplos

Con la persona del punto 1: hoy es el 27/10/2026, que es también su arranque. Los feriados son los 9 fijos, que entre el
16/12/2026 y el 10/01/2027 son el 25/12 y el 1/1. Los primeros tres ejemplos son los que dio el usuario. Cada texto es el aviso
del modal sin «N días hábiles de M corridos.».

| Vacaciones | Reparto | Texto |
|---|---|---|
| 16/12/2026 – 10/01/2027 (16 días) | 2024: 15, 2025: 1 | Salen de las licencias 2024 (15 días) y 2025 (1 día), las más viejas. Te quedan 29 días: 19 de la 2025 y 10 de la 2026. |
| 21/12/2026 – 10/01/2027 (13 días) | 2024: 13 | Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. Perdés 2 de la 2024 (vencen el 31/12/2026). |
| 23/12/2026 – 05/01/2027 (8 días) | 2024: 8 | Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026). |
| 14/12/2026 – 18/12/2026 (5 días) | 2024: 5 | Salen de la licencia 2024, la más vieja. Te quedan 40 días: 10 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026. |
| 21/12–31/12/2026 y después 04/01–10/01/2027, dos cargas | la primera, 2024: 8; la segunda, 2025: 5 | La segunda: Salen de la licencia 2025, la más vieja. Te quedan 25 días: 15 de la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026). |
| 21/12/2026 – 10/01/2027 ya cargada, y después 01/12–02/12/2026 | la nueva, 2024: 2; la de diciembre, 2024: 13 | La nueva: Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. |
| 14/12–18/12/2026, con una atención médica del 21/12 al 31/12 | 2024: 5 | Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. Perdés 10 de la 2024 (vencen el 31/12/2026). |

Con la del 21/12 al 10/01 cargada, el Resumen dice: «Te quedan 30 días de vacaciones». La bajada es «13 ya están cargados
para diciembre y enero de 2027. Otros 10 se habilitan el 1/1/2027. Perdés 2 de la 2024 (vencen el 31/12/2026).», y la opción
de «Cargar licencia», «Vacaciones, 30 disponibles». Desde el 1/10, «Vence pronto» no muestra la licencia 2024, y el email del
1/12 no la avisa.

Con un solo año, el texto sigue siendo el de siempre, «Salen de la licencia 2024, la más vieja.», sin la cantidad: los días ya
están en «N días hábiles». En sus ejemplos, el usuario escribió «Salen de las licencias 2024 (13 días), las más viejas»;
se dejó el texto de siempre porque dice lo mismo y no rompe nada.

## 4. Lo que no cambia

- Las mitades (1/7 y 1/1), el vencimiento (31/12 de dos años después), el saldo inicial y lo anterior al arranque.
- El freno de una carga que no cierra («No te alcanzan los días habilitados: para el … no te queda ninguno.»), cuando un día de
  la carga no tiene ninguna licencia. Con la regla nueva hay menos días sin cubrir, porque los de enero siguen con la licencia
  de diciembre.
- «Te quedan» se sigue calculando a hoy: no suma la mitad que se habilita después de hoy, aunque caiga dentro de la carga.
- El paso a Configuración → Licencias: pasan las fechas de la carga, tal cual.
- La nota en Word: no dice de qué licencias salen los días.
- La página: imprime los textos del servidor y no cambia (no hace falta subir `VERSION_MI_ESPACIO`).
- Sin SQL, sin migraciones, sin cron. Nada de esto se guarda en la base: al desplegar, lo que ya está cargado se recalcula
  solo con la regla nueva.

## 5. Lo que se vio y queda para después (fuera de esta spec)

Los agentes que relevaron el código encontraron otras cosas. Ninguna es la que vio el usuario, y quedan anotadas:

1. «Te quedan» es lo habilitado a hoy menos todo lo cargado. Por eso puede dar menos de lo que de verdad se puede cargar: no
   suma la mitad que se habilita después de hoy, pero sí resta lo que se carga de ella.
2. Cuando una carga deja sin cubrir días de otra ya guardada, el error de «No te alcanzan los días habilitados» nombra una
   fecha de la otra licencia, no de la que se carga.
3. Con un error, el modal igual muestra el reparto, que no menciona los días sin cubrir.
4. La misma cantidad se escribe de dos maneras: «16 días hábiles de 26 corridos» en el modal y «26 días corridos, 16 hábiles»
   en la lista.
5. Configuración → Licencias cuenta con los 9 fijos y Mi espacio, con la tabla de feriados. Lo trata la sesión «Feriados en las
   Notas Digitales».

## 6. Tests

- `tests/mi-espacio-reglas.test.js`, puro, con la persona del punto 1: un estado inventado, sin nombres. Tiene que probar:
  - cada fila de la tabla del punto 3, con su reparto (`porFila`), sus `disponibles` y `perdidos` y el texto exacto;
  - el test de antes «una carga que cruza un vencimiento» (del 30/12/2026 al 05/01/2027, con la 2024 en 3, la 2025 en 0 y la
    2026 con un saldo de 10), que pasa de `2024: 2, 2026: 2` a `2024: 3, 2026: 1`;
  - una licencia ya vencida a hoy, que no tiene `perdidos` (ya es 0 de `disponibles`);
  - el singular y dos licencias perdidas en el mismo texto;
  - `avisosDeVencimiento` el 01/12/2026, sin la licencia 2024 cuando sus días se pierden.
- `tests/mi-espacio-resumen.test.js`, puro: la frase, la bajada con «Perdés …» al final y en ámbar, «Vence pronto» sin la
  licencia 2024 y «30 disponibles».
- `tests/mi-espacio-api.test.js` (Docker): el cálculo de unas vacaciones que empiezan el último día hábil del año y siguen en
  enero, que salen enteras de la licencia que vence ese año.
