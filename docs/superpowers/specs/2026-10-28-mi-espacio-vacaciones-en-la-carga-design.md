# Mi espacio: las vacaciones al cargar una licencia (lo que se ve, no la regla)

Fecha: 28/10/2026. Sigue a `2026-10-26-mi-espacio-licencias-y-horas-design.md` (vacaciones y saldo inicial),
`2026-10-27-mi-espacio-dias-de-vacaciones-design.md` (el reparto por carga y «Perdés») y
`2026-10-28-mi-espacio-licencia-anulada-design.md`.

## 1. Por qué

El usuario revisó el cálculo de los días de vacaciones al cargar una licencia en `mi-espacio.html#licencias`. Las cuentas
dan bien: el reparto por carga, «Perdés», los topes y el paso a Configuración se comprobaron con agentes y con una
simulación sobre una copia del dump de producción del 28/10/2026 a las 16:14 (la app de verdad con el reloj adelantado del
28/10/2026 al 03/01/2028, tres personas, 133 capturas). **La regla no cambia.** Lo que confunde es lo que muestra la pantalla:
el modal y el Resumen cuentan solo lo de hoy, no avisan lo que una carga le hace a lo demás, y los errores no dicen hasta
dónde alcanza. El caso que lo disparó: una persona de planta con 15 días de la 2024, 20 de la 2025 y 10 de la 2026 carga
del 01/12/2026 al 05/02/2027 y el modal dice «No te quedan días disponibles»; parece un tope, pero el 1/1/2027 se le
habilitan 10 más y la carga puede llegar hasta el 24/02/2027.

## 2. Lo que no cambia (decisiones del usuario)

- **La regla del reparto** (por carga, en el orden de su primer día que descuenta; la licencia que una carga empezó a usar
  sigue aunque venza; si no, la más vieja habilitada, no vencida y con días) y **la de «Perdés»** (desde hoy y después de la
  última carga que usa esa licencia; spec del 27/10, punto 5). El usuario lo confirmó el 28/10/2026: «antes estaba bien la
  regla, funcionaba bien». Ejemplo que lo confirma: con los datos de arriba, una carga del 31/12/2026 de 30 días hábiles llega
  al 15/02/2027 y salen 15 de la 2024 y 15 de la 2025; no se pierde nada.
- **Solo la licencia ordinaria se acumula.** Franquicias, estudios, atención médica y grupo familiar vuelven a cero el 1/1
  (como hoy). Estudios y atención médica son extraordinarias: no hace falta usarlas y nada las recuerda.
- **El sistema no frena licencias**: todos los avisos nuevos son avisos, nunca bloquean un guardado. Lo único que sigue
  frenando es lo que ya frenaba (por ejemplo, no tener días habilitados para unas vacaciones).
- El navegador no recalcula nada (Ruling 19): números y textos los arma el servidor.
- Fuera de esta entrega: el borrado de una licencia del firmante después del día límite del tipo (punto 8 de la simulación),
  «0 horas a favor» de contrato y que el Resumen diga «Estás de vacaciones» el día que lo estás.

## 3. Lo que cambia

Los ejemplos usan a la persona de planta del punto 1 (15 de la 2024, 20 de la 2025, 20 por año en 2026, arranque el
27/10/2026, hoy 28/10/2026), salvo que se diga otra cosa.

### 3.1 «Te quedan» dice también lo que viene, y hasta dónde llega la carga

Hoy «Te quedan» (el modal y la opción del tipo) es lo habilitado a hoy menos lo cargado. Se suma lo que todavía no se
habilitó y no está asignado a ninguna carga: las mitades del 1/1 y el 1/7 que todavía no llegaron. Una sola función lo
calcula para todos los lugares; cada lugar elige qué fechas nombra (decisión de la sesión, ver 7):

- El Resumen («Otros N se habilitan el …») y la opción del tipo nombran solo las licencias de años hasta el de hoy, como
  ahora.
- El cálculo del modal nombra las fechas que caen entre hoy y el «Hasta» de la carga o su alcance (lo que sea más tarde),
  también las de la licencia del año siguiente (`ordinariasDe` llega hasta ella y el reparto la usa desde su 1/7): son las
  que explican hasta dónde llega esa carga.

- En el cálculo del modal, después de «Te quedan …» (o de «No te quedan días disponibles hoy.»), una oración por fecha:
  «El 1/1/2027 se habilitan 10 más de la 2026.». Con dos fechas: «El 1/1/2027 se habilitan 10 más de la 2026 y el 1/7/2027,
  10 de la 2027.». Sin nada que nombrar, no va.
- «No te quedan días disponibles.» pasa a «No te quedan días disponibles hoy.» cuando hay algo por habilitar (sin nada por
  habilitar queda como está).
- **Hasta dónde llega**: cuando la carga deja «Te quedan» en 0 hoy y podría seguir más allá de su «Hasta» gracias a lo que se
  habilita después, se suma «esta licencia puede llegar hasta el 24/02/2027.» (la misma oración: «El 1/1/2027 se habilitan 10
  más de la 2026: esta licencia puede llegar hasta el 24/02/2027.»). El alcance es el último «Hasta» posible para ese
  «Desde» sin que aparezca un faltante nuevo (ni en esta carga ni en otra), con los feriados, y nunca después del último día
  que acepta `validarLicencia`. Se calcula en el servidor (la factibilidad crece o se mantiene al acortar: sirve una búsqueda
  binaria sobre los días).
- La opción «Vacaciones» del tipo: «45 disponibles · 10 más el 1/1» (la fecha corta, sin el año; con dos fechas, la primera).
  Sin nada por habilitar, como hoy.

Ejemplo, del 01/12/2026 al 05/02/2027 (el que confundió al usuario):

> **45 días hábiles de 67 corridos.** Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más viejas.
> No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026: esta licencia puede llegar hasta el
> 24/02/2027.

### 3.2 Cualquier licencia avisa antes de guardar lo que hace perder

Con la regla de «Perdés» de siempre, se compara el cálculo sin la carga y con ella (como ya hace `evaluarLicencia` con los
faltantes). Si la carga hace perder algo que antes no se perdía, el cálculo del modal lo dice, para **cualquier tipo**:

- Días de vacaciones: «Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).» (la diferencia, no el total; con 1,
  «perdés 1 de la 2024 (vence …)»). En el modal de vacaciones esta oración no va: ahí ya está el «Perdés …» de siempre, con el
  total.
- El franco compensatorio del mes (planta) o las horas a favor del mes (contrato) que se quedan sin ningún día libre en su mes:
  «Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.» / «Tus 3 horas a favor de diciembre se quedan sin
  días libres: vencen el 31/12/2026.». Un día libre es un día hábil de ese mes, también uno que ya pasó, fuera de toda
  licencia de Mi espacio: un franco se puede registrar en un día pasado del mes (como ya lo permite «Vence pronto» después
  del último día hábil; decisión de la sesión, ver 7).
- Las horas de franquicia que se pierden (3.6): «Con esta licencia perdés 8 horas de franquicia (vencen el 31/12/2026).».

Va en el recuadro del cálculo, en ámbar, después del resto. No frena el guardado. El segundo paso no lo repite.

Ejemplo (otra persona: 3 días de la 2024; hoy 15/12/2026; carga atención médica del 15/12 al 31/12):

> **12 días hábiles de 17 corridos.** Te quedan 11 de 25. Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).

### 3.3 Los errores dicen hasta dónde alcanza

Cuando unas vacaciones no se pueden guardar por falta de días habilitados:

- El error va debajo de «Hasta» (hoy va debajo de «Desde»), salvo que la carga no tenga ni el primer día, que va debajo de
  «Desde».
- Si la que se queda sin días es esta carga: «No te alcanzan los días habilitados: esta licencia puede llegar hasta el
  24/02/2027.» (el alcance de 3.1). Sin ningún día posible: «No te alcanzan los días habilitados para el 21/06/2027.» y, si
  después de ese día se habilita algo: «El 1/7/2027 se habilitan 5 más de la 2027.».
- Si la que se queda sin días es otra carga ya guardada (la nueva va antes en el orden y le toma días): «Con estos días, a tus
  vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.» (las fechas de la otra carga como en la lista).
- Con un error, el recuadro del cálculo muestra solo los días («57 días hábiles de 88 corridos.»), sin el reparto («Salen de
  …»), porque esa carga no se guarda (hoy enumera 55 de 57 sin decir que faltan 2).

### 3.4 Una carga nueva avisa si cambia de dónde salen otras

Las cargas se reparten en el orden de sus fechas: una carga nueva anterior a otras ya guardadas les cambia de qué licencia
salen. La regla sigue igual; el cálculo del modal lo dice antes de guardar, una oración por carga que cambia:

> Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de las licencias 2025 (5 días) y 2026 (10
> días).

Vale al cargar y al corregir; no al borrar. No frena. Si cambia más de una, una oración por cada una, en el orden de sus fechas.

### 3.5 El ámbar de «vencen el 31/12» del Resumen, desde el 1/10

En la bajada del Resumen, la oración de la licencia que vence en el año («12 vencen el viernes 31/12.») va en ámbar (y con el
día de la semana, sin el año) solo desde el 1/10 de ese año, como «Vence pronto». Antes, va en el color de la frase y con el
año: «12 vencen el 31/12/2027.». «Perdés …» sigue en ámbar siempre.

### 3.6 La franquicia se recuerda como las vacaciones (solo planta)

Las horas de franquicia que no se usan se pierden el 31/12. Se tratan como la licencia ordinaria que vence:

- «Vence pronto», desde el 1/10: «22 horas de franquicia», con «Vencen el jueves 31/12, en 64 días.» y el botón «Cargar
  franquicia» (abre «Cargar licencia» con ese tipo).
- El email de vencimiento, desde el primer día hábil de diciembre, una vez (clave `franquicia-AAAA` en `mi_espacio_avisos`,
  que es `varchar(40)`: no hace falta SQL): «Tenés 22 horas de franquicia: vencen el 31/12/2026.».
- «Perdés»: las horas que ya no entran en los días libres que quedan (un día libre: un día hábil desde hoy hasta el 31/12 fuera
  de toda licencia de Mi espacio; en cada uno entran hasta 7 horas). Perdidas = máx(0, quedan − 7 × días libres). Las perdidas
  no cuentan en «Vence pronto» ni en el email; el Resumen las dice debajo de «Franquicias» en «El resto de AAAA», en ámbar:
  «Perdés 8 horas (vencen el 31/12/2026).».
- Lo que queda es lo de siempre: 42 menos lo usado y lo cargado del año.

### 3.7 «Vence pronto» no ofrece lo que no se puede cargar

Si el franco del mes o las horas a favor del mes no tienen ningún día libre (3.2), «Vence pronto» las sigue mostrando, sin el
botón, con «No te quedan días libres este mes para usarlo.» («usarlas», en las horas), y el email de vencimiento no las
nombra (como la franquicia perdida). La franquicia sin días libres ya es toda «Perdés» y no aparece.

### 3.8 «Mis vacaciones y saldos» explica sus números

- En el año del arranque, con el arranque desde el 1/7, la primera mitad de ese año es el saldo que se escribió en «De la
  AAAA». El texto de las mitades lo dice, sin número (el campo está en el mismo modal y se puede estar escribiendo; decisión
  de la sesión, ver 7): «La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 10.» (en
  lugar de «10 el 1/7/2026 y 10 el 1/1/2027», que promete algo que no pasa). Los demás años, como hoy.
- Cada tope del saldo inicial dice de dónde sale, en la ayuda del campo y en su error: «De 0 a 8: lo que se habilitó de la
  2026 hasta hoy.»; un año anterior con sus días cargados, «De 0 a 20: los días de la 2025.»; sin días cargados, «De 0 a 30,
  el máximo de una licencia.».

### 3.9 Textos chicos de las vacaciones

- «la más vieja» / «las más viejas» solo cuando es cierto: si después del reparto queda alguna licencia más vieja, no vencida
  y con días, no va (hoy una carga de enero dice «Salen de la licencia 2025, la más vieja» y quedan días de la 2024).
- Una sola forma para los días: «18 días hábiles de 26 corridos» (la del modal) también en la lista, en el segundo paso y
  donde hoy dice «26 días corridos, 18 hábiles».
- Los meses de lo cargado en la bajada del Resumen, agrupados por año: «34 ya están cargados para diciembre y para enero y
  febrero de 2027.» (hoy «diciembre, enero de 2027 y febrero de 2027»). El link de 65a79f8 sigue llevando al año del primer
  mes.
- La regla del Resumen cuenta en «cargados» solo los días de las licencias que muestra (los años hasta el de hoy). Hoy
  «22 ya están cargados» puede sumar días que salen de la licencia del año siguiente, que no aparece en ninguna otra parte.
- En la regla, un tramo de un solo día muestra su número (achicando la letra si hace falta).

## 4. Dónde va (para el que planifica)

- Reglas, puras: `services/miEspacioReglas.js` (el alcance, lo por habilitar sin asignar, la comparación de perdidos y de
  franco u horas antes y después de la carga, la franquicia que vence y sus perdidas, los cambios de origen de otras cargas,
  `textoDelReparto`, `textoSinHabilitados` y su campo, `avisosDeVencimiento`), `services/miEspacioResumen.js` (la opción del
  tipo, la bajada, «Vence pronto», la regla, «El resto», los textos de las mitades y los topes), `services/emailTemplates.js`
  si el renglón de la franquicia lo necesita.
- `controllers/miEspacioController.js` (`calcularLicencia` y el guardado: el `vista` nuevo y el campo del error).
- `public/js/mi-espacio.js` y `public/mi-espacio.html`: dibujar lo nuevo que manda el servidor (el ámbar del aviso en el
  cálculo, el error en «Hasta», «Vence pronto» sin botón, «Perdés» de la franquicia en «El resto»). Sube
  `VERSION_MI_ESPACIO`. Las copias del navegador que cambien siguen atadas por sus tests de paridad.
- Sin SQL, sin cron nuevo, sin variables de entorno, sin npm.
- Tests: los puros de reglas y Resumen (cada texto de arriba con sus singulares, plurales y bordes: el 1/10, el 1/1, el 1/7,
  el 31/12, sin nada por habilitar), los de la página en el `vm`, `mi-espacio-api.test.js` y `mi-espacio-avisos.test.js`
  (el email de la franquicia) con Docker, y `paginas.test.js` (la versión). Nombres inventados en todo.
- CLAUDE.md: la sección «Mi espacio: licencias y horas extras» y la convención de `mi-espacio.js`.

## 5. Orden y despliegue

- La implementación espera el pase de la coordinadora: antes van «una agenda con más onda» (toca `mi-espacio.js`,
  `mi-espacio.html` y el Resumen) y «Métricas: Redacción y entrega de la nota». El plan empieza leyendo ese main y ajustándose.
- El kit (`RPAD-deploy-mi-espacio-vacaciones-licencia`) lleva también los archivos de «Redacción y entrega de la nota», y la
  vuelta atrás se arma contra el merge de la agenda. Tiene que estar en producción **antes del 10/01/2027** (ese día se saca la
  foto de Métricas de 2026).

## 6. Antiobjetivos

- Cambiar la regla del reparto o la de «Perdés».
- Que un aviso nuevo frene una licencia.
- Que la pantalla diga un número y el guardado haga otra cosa (el alcance de 3.1 tiene que ser exactamente el «Hasta» más
  lejano que se puede guardar).
- Que el navegador recalcule algo.
- Nombres reales en el repo.

## 7. Decisiones de la sesión (para que el usuario las revise)

El usuario eligió qué arreglar y los textos de 3.1 y 3.5; estas las decidió la sesión, después de la revisión de la spec:

1. **Las fechas que nombra cada lugar (3.1).** Una sola cuenta de lo por habilitar; el Resumen y la opción del tipo nombran
   solo las licencias hasta el año de hoy (como ahora), y el modal nombra las que caen hasta el «Hasta» o el alcance de la
   carga, también las de la licencia del año siguiente: así el alcance es exacto y la oración lo explica.
2. **Los días libres de un franco o unas horas a favor (3.2 y 3.7)** cuentan todo el mes, también los días que ya pasaron,
   porque un franco tomado se puede registrar después; sin ninguno, tampoco sale su email.
3. **El texto de las mitades del año del arranque (3.8)** no lleva el número del saldo: el campo está en el mismo modal.
4. **En el modal de vacaciones no va «Con esta licencia perdés …» (3.2)**: ya está el «Perdés …» de siempre.
5. **Con un error de días, el recuadro muestra solo los días, sin el reparto (3.3).**
6. **El aviso de las cargas que cambian de origen (3.4)** va al cargar y al corregir, no al borrar.
7. **«Vence pronto» de la franquicia** abre «Cargar licencia» con ese tipo; sus perdidas se ven en «El resto de AAAA».
