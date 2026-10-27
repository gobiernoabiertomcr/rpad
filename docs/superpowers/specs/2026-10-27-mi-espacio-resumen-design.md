# Mi espacio: el Resumen «Titular»

Fecha: 27/10/2026. **Estado: borrador, para que lo apruebe el usuario.** Salió de la exploración del 27/10/2026. El usuario vio el Resumen «Niveles» en producción (desplegado ese mismo día, main 71a301c) y pidió una versión «más moderna, con más animaciones o no sé: TU mirá». Se compararon cuatro maquetas y eligió **Titular**.

**Va después de la agenda** (la entrega 3, `2026-10-26-mi-espacio-agenda-design.md`), en una sesión nueva y con la misma metodología de siempre:
- la Task 1 del plan lee el main nuevo, con la agenda ya mergeada, y ajusta el plan;
- al final, merge, push y kit de despliegue.

**Maquetas:** están en `2026-10-27-mi-espacio-resumen-mockups/`.
- **Cómo se ven:** se abren con el preview `maquetas-resumen` (puerto 8766, `python -m http.server`). Usan la carcasa real, el `main.css` real y datos inventados. Hoy es el martes 27/10/2026.
- **La barra oscura de abajo** es de la maqueta, no del diseño. Elige la opción y el estado:
  - planta, como la captura del usuario;
  - contrato;
  - administración con quién no está y la agenda;
  - nada por vencer.
- **La opción 2 es la elegida.** Las otras tres quedan como registro: 1 Niveles vivos, 3 Horizonte y 4 Tablero.
- `?quieto=1` muestra la página sin movimiento.
- **La maqueta no guarda nada.** Donde no coincida con este documento, manda el documento.

## Por qué

El Resumen «Niveles» funciona, pero se ve como un panel de administración más. El usuario quiere que lo primero que vea cada persona al abrir Mi espacio sea claro y tenga vida.

Titular dice la cuenta que más importa en una frase grande: **«Te quedan 45 días de vacaciones»**. Debajo dibuja esos días como una regla partida por licencia. Lo que vence pronto queda al lado, en una línea corta. El resto va abajo, en silencio.

## Objetivos, no objetivos y antiobjetivos

**Objetivos**
- **Un Resumen nuevo con la misma información que hoy:** lo que vence pronto, las vacaciones por licencia, los topes del año, los francos o las horas a favor mes por mes, la médica extraordinaria y «Hoy y mañana». Cambia cómo se ve, no qué dice.
- **Textos cortos** (pedido del usuario: «explicaciones no tan grandes sino más cortas y entendibles»). Lo que vence dice solo cuándo vence y en cuántos días.
- **Un solo momento de movimiento al abrir:** el número de la frase sube mientras la regla se dibuja tramo por tramo, y después se llenan las líneas del resto.
- **Que conviva con la agenda:** «Hoy y mañana» muestra los eventos de hoy y de mañana, y el link «Ver la agenda».

**No objetivos**
- No cambian las reglas, los datos guardados ni la API, salvo los textos nuevos del Resumen (sección 4).
- No cambian las pestañas Licencias, Horas extras y Agenda, los formularios, el email de vencimiento, Configuración ni la carcasa.
- No se suma ninguna librería ni CDN: la CSP de `app.js` no lo permite.

**Antiobjetivos**
- **Que un número de la frase o de la regla diga otra cosa que el servidor.** La página dibuja lo que llega (Ruling 19); no cuenta días ni arma textos.
- **Que algo diga «perdiste» o «se perdieron».** Se dice «vence» o «vencen» (spec de licencias y horas, antiobjetivos).
- **Que el tipo de una licencia de otra persona aparezca en «Hoy y mañana».** Sigue diciendo solo «no está» y cuándo vuelve.
- **Que el movimiento moleste:** una sola vez, nada que se repita, y quieto con `prefers-reduced-motion`.
- **Que un lector de pantalla lea un número a medio contar.**

## 1. Qué no cambia

- **Los mensajes de antes del Resumen:** sin modalidad, el mensaje del servidor; sin saldo inicial, la invitación a «Mis vacaciones y saldos», que se abre sola la primera vez.
- **Los faltantes:** el aviso ámbar, arriba de todo.
- **La marca ámbar** en la pestaña Resumen cuando hay algo en «Vence pronto».
- **Los tipos de «Cargar licencia»** y lo que queda de cada uno (`tipos`).
- **Los botones de «Vence pronto»:** abren «Cargar licencia» con su tipo, como hoy (`data-accion="cargar-licencia"` y `data-tipo`).
- **«Mis vacaciones y saldos»** sigue en el Resumen (`data-abrir="saldos"`).
- **Cada número del resto es un link a su pestaña,** con el `aria-label` del servidor, como cada tanque hoy. El foco va a la pestaña.
- **Lo que manda el servidor de los saldos:** las capas del tanque de vacaciones, los demás tanques, las pastillas y «Hoy y mañana», con los eventos de la agenda.

## 2. La pantalla

De arriba hacia abajo, dentro de la pestaña Resumen (maqueta, opción 2):

### 2.1 La banda

Un bloque celeste, `--sg-cielo` (#DCEEF5), con las esquinas de arriba redondeadas y abajo la ola de las páginas públicas: el mismo dibujo, en celeste, que cae sobre el fondo de la página. Ocupa todo el ancho. Lleva tres partes, en este orden en el HTML:

1. **La frase**
   - Arriba, en chico y en azul (`--sg-azul`), el día y la modalidad: «Martes 27 de octubre, planta permanente».
   - Después, el título de la pestaña (`h2`) en Bricolage Grotesque grande, de unos 3,4 rem en la compu, con `clamp`: «Te quedan **45** días de vacaciones». El número va más grueso, no en otro color.
   - Debajo, la bajada: una oración corta por cada cosa que explica la regla. La de lo que vence va en ámbar y negrita; ver 4.2.
2. **«Vence pronto»** (si hay algo). Cada cosa es una **entrada amarilla** (`--sg-sol`):
   - **a la izquierda, el talón:** el día grande y el mes, separado por una línea de puntos y con dos muescas, arriba y abajo;
   - **a la derecha:** el título en tinta («1 franco compensatorio de octubre»), una línea corta en ámbar («Vence el viernes 30/10, en 3 días.»: ver 4.1) y el botón, con fondo blanco.

   Va ordenada por fecha, como hoy.
3. **La regla**
   - **La barra:** de unos 46 px de alto, partida en un tramo por capa del tanque de vacaciones (las mismas capas, en el mismo orden). Cada tramo es proporcional a sus días.
   - **Un casillero por día:** cada tramo lleva una línea blanca fina entre día y día, y adentro su número, si entra. Un tramo muy angosto no muestra el número, que igual está en la lista.
   - **Los colores, los de hoy:**
     - la licencia que vence en el año, en `--sg-sol-borde`, con el número en tinta;
     - las otras, en tinta y en azul medio (#4C7AB0), con el número en blanco;
     - lo cargado a futuro, rayado;
     - lo que todavía no se habilita, punteado sobre blanco translúcido.
   - **Debajo, la lista de la regla:** cada tramo con su muestra de color, «Licencia 2024: 15» en negrita y su nota del servidor («Vence el 31/12/2026», «La primera mitad», «Se habilitan el 1/1/2027»). La que vence va en ámbar.

**Dónde va cada parte:**
- **En la compu** (más de 1000 px), dos columnas: a la izquierda la frase y debajo la regla; a la derecha, «Vence pronto», de unos 340 px.
- **Sin nada por vencer,** la frase y la regla ocupan todo el ancho.
- **En una columna** (1000 px o menos), en el orden del HTML: la frase, «Vence pronto» y la regla. Lo que vence sigue viéndose primero, como pidió el usuario en la charla del 26/10.

### 2.2 «El resto de 2026»

Sin tarjeta, sobre el fondo de la página.
- **La cabeza:** el título «El resto de 2026» (con el `anio`) y, a la derecha, «Al martes 27/10/2026» (`al_texto`) y el link «Mis vacaciones y saldos».
- **Los números:** uno por cada `tanques.otros`, en el orden del servidor, separados por una línea vertical. Son franquicias (u horas a favor en contrato), estudios (si estudia), atención médica y grupo familiar. Cada uno lleva:
  - el número grande, con la unidad al lado en chico;
  - el nombre y «de 42 horas» (`de`);
  - una línea de 6 px que se llena en la proporción `valor / total`.

  Uno que vence (`vence`, las horas a favor de contrato) va en ámbar: el número, el nombre y la línea. Cada número es un link a su pestaña (ver 1).
- **Los francos compensatorios** (o las horas a favor), en una línea: el título del servidor (`pastillas.titulo`) y una etiqueta por mes, «**1** Diciembre Octubre sigue sumando», con los textos tal como llegan.
  - La del mes que vence, amarilla.
  - La que sigue sumando, con borde punteado.
  - Lo no utilizado previamente, en gris.
  - Sin ningún mes ni nada no utilizado, la línea no va.
- **La médica extraordinaria,** en una línea chica y corta (ver 4.3).

### 2.3 «Hoy y mañana»

Al final, después de una línea, con su título. El usuario lo eligió abajo y en columnas.
- **Las columnas,** separadas por una línea vertical y sin tarjetas:
  - **Hoy:** los eventos de la agenda de hoy (la hora en negrita, el título y debajo «con todos», «solo vos»…) y, para quien ve a los compañeros, los que hoy no están («Julieta Arce no está» y debajo «Vuelve el martes 03/11»);
  - **Mañana:** lo mismo de mañana;
  - **Próximo feriado:** el día en negrita y el nombre debajo.
- **«Ver la agenda»** va al final de la última columna, si hay eventos.
- **Una columna sin nada no va.** Sin ninguna, la sección tampoco, como hoy.
- **En el teléfono,** una columna debajo de la otra, sin la línea.

### 2.4 El teléfono

- **Sin desplazamiento de costado** a 375 px.
- **La banda:**
  - los márgenes bajan a 16 px;
  - la frase se achica con su `clamp`;
  - la barra baja a 38 px de alto;
  - la lista de la regla pasa a una columna.
- **Los números del resto** van de a dos por fila.

## 3. El movimiento

- **Cuándo:** una sola vez, la primera vez que se ve el Resumen en esa carga de la página, con la misma regla que hoy tienen los tanques (`pagina.tanquesLlenos` y `llenarTanques`).
  - Si se vuelve a dibujar después de guardar algo, no se mueve.
  - Si el Resumen está oculto porque se abrió otra pestaña, espera a que se vea.
- **Qué pasa:**
  1. **La regla y la frase,** en unos 1,3 s. Los tramos se dibujan de izquierda a derecha, uno detrás del otro (`scaleX` desde la izquierda, cada uno con un tiempo proporcional a sus días). Al mismo tiempo, el número de la frase sube de 0 al suyo, y el número de cada tramo aparece cuando su tramo casi terminó.
  2. **Las líneas del resto,** a los 0,9 s. Se llenan de izquierda a derecha, una detrás de la otra, y sus números suben con ellas.
- **Con qué:** CSS, la Web Animations API (`element.animate`) y `requestAnimationFrame` para los números, sin librerías. Sin `requestAnimationFrame` (los tests), todo queda en su valor final.
- **Con `prefers-reduced-motion: reduce`,** nada se mueve: todo está en su valor desde el principio, sin el parpadeo de un cuadro vacío.
- **Lo que no se mueve:** «Vence pronto», «Hoy y mañana», la ola, y nada que dé vueltas o se repita.

## 4. Los textos nuevos del servidor

Los arma `services/miEspacioResumen.js` (`resumenDe`); la página los imprime tal cual (Ruling 19). Lo que hoy existe y no se nombra acá sigue igual.

### 4.1 Lo que vence: una línea

Cada cosa de `vence_pronto` cambia `cuando` y `detalle` por **`texto`**, una línea que se arma con lo que vence y cuántos días corridos faltan desde hoy (en hora argentina) hasta su fecha:
- **Faltan 2 días o más:** «Vence el viernes 30/10, en 3 días.» o «Vencen el jueves 31/12, en 65 días.». El día va con `diaLargo` y en minúscula.
- **Falta 1:** «Vence mañana.» o «Vencen mañana.».
- **Es hoy:** «Vence hoy.» o «Vencen hoy.».
- **Singular o plural, según la cantidad:**
  - 1 franco, 1 hora a favor o 1 día de licencia: «Vence»;
  - 2 francos, 1,5 horas o 15 días: «Vencen».

Decisión del usuario (27/10/2026): «Vence el…» para todo, para unificar. La explicación de «no utilizado previamente» sale del Resumen; sigue en la pestaña Horas extras. Se conservan `fecha`, `dia`, `mes`, `titulo` y `accion`. Nadie más usa `vence_pronto`: el email de vencimiento tiene sus propios textos.

### 4.2 La frase, la bajada y el encabezado de la banda

`resumenDe` suma `titular` cuando hay `tanques`: `{ encabezado, antes, cifra, despues, bajada }`.
- **`encabezado`:** el día largo, sin el año, y la modalidad en minúscula. Por ejemplo, «Martes 27 de octubre, planta permanente», «Martes 27 de octubre, planta política» o «Martes 27 de octubre, contrato».
- **`antes`, `cifra` y `despues`:** la frase partida alrededor del número de `tanques.vacaciones.numero`.
  - Con varios días: «Te quedan», '45' y «días de vacaciones».
  - Con 1: «Te queda», '1' y «día de vacaciones».
  - Con 0: `antes` es «No te quedan días de vacaciones», y `cifra` y `despues` son ''. La página no dibuja el número.
- **`bajada`:** una lista de oraciones, cada una `{ texto, vence }`. La página las une con un espacio, y la de `vence: true` va en ámbar y negrita. En este orden, solo las que hay:
  1. **La capa que vence en el año:** «15 vencen el jueves 31/12.» («1 vence el …»), con `vence: true`.
  2. **Lo cargado a futuro:** «5 ya están cargados para noviembre.» («1 ya está cargado para …»), con los mismos meses que la nota de la capa.
  3. **Lo que todavía no se habilita:** «Otros 10 se habilitan el 1/1/2027.» («Otro 1 se habilita el …»). Con la cifra en 0, sin «Otros»: «10 se habilitan el 1/1/2027.». Las fechas son las de la nota de la capa.

  Sin ninguna, la lista va vacía y no hay bajada.

### 4.3 La médica extraordinaria, más corta

`extraordinaria` pasa a «Atención médica extraordinaria: sin tope. No usaste en 2026.» («Usaste 1 día en 2026.», «Usaste 3 días en 2026.»). Sale «y aparte de los 25 días».

## 5. Accesibilidad

- **La banda** es una `section` con `aria-labelledby` en la frase.
- **«Vence pronto»** es una `aside` con su título (`h2`).
- **«El resto»** y **«Hoy y mañana»** son `section`, cada una con su `h2`.
- **El número de la frase que sube** va en un `span` con `aria-hidden="true"`, y al lado va el número final, oculto a la vista (`.visualmente-oculto`). Un lector de pantalla nunca lee un número a medio contar. En los números del resto alcanza con el `aria-label` del link.
- **La barra de la regla** es decorativa (`aria-hidden`). La lista de debajo dice lo mismo en texto.
- **El talón de cada entrada** es decorativo, porque su línea ya dice la fecha. El botón se describe con el título de lo que vence (`aria-describedby`), como hoy.
- **El foco visible** es el de la página: el anillo `--tinta` con halo `--sol-fuerte`.
- **El contraste,** 4,5:1 o más en todo el texto, también:
  - el ámbar sobre el sol y sobre el celeste;
  - el gris suave sobre el celeste;
  - el número en blanco del tramo azul medio, que es texto grande (1,2 rem en negrita) y llega a 4,45:1.

## 6. El código

- **`services/miEspacioResumen.js`:** los textos de la sección 4 (`titular`; `texto` en lugar de `cuando` y `detalle`; la extraordinaria corta), puros y con sus tests en `tests/mi-espacio-resumen.test.js`. Los tests que comparan esos campos se reescriben con los textos nuevos.
- **`public/js/mi-espacio.js`:** las funciones puras del Resumen se reemplazan; los nombres quedan para quien lo construye. Son:
  - `htmlDeVencePronto`, `svgDeTanque`, `htmlDeNivel`, `htmlDeLeyendaDeVacaciones`, `htmlDeTanques`, `htmlDePastillas`, `htmlDeLoQueTeQueda`, `htmlDeHoyYManana` (con los eventos de la agenda) y `htmlDelResumen`;
  - `TANQUE_GRANDE` y `TANQUE_CHICO` se van.

  `llenarTanques` pasa a ser lo que anima la banda (sección 3). Sigue la convención del archivo: lo que arma HTML es puro y va primero, todo texto pasa por `esc` y un número va con `String`. Los tests de `tests/mi-espacio-frontend.test.js` que miran el Resumen se reescriben con el HTML nuevo; los demás no cambian.
- **`public/mi-espacio.html`:** salen del `<style>` los estilos de los tanques y de las pastillas que ya no se usan, y entran los de la banda, la regla, las entradas, el resto y las columnas, con los tokens `--sg-*` (se suma `--sg-medio: #4C7AB0`). `VERSION_MI_ESPACIO` sube en `tests/paginas.test.js` y en el `?v=` del script. No se toca `main.css` ni la carcasa.
- **`CLAUDE.md`:** la descripción del Resumen en «Mi espacio» y en la convención de `mi-espacio.js` pasa de «Niveles» (tanques y pastillas) a «Titular».
- **La spec de licencias y horas** (`2026-10-26-mi-espacio-licencias-y-horas-design.md`, sección 8) suma una línea: el Resumen «Niveles» se reemplazó por «Titular» (esta spec).
- **Sin SQL, sin tablas y sin rutas nuevas.**
- **El despliegue:** subir los archivos y Restart. Va en el kit que sigue al de la agenda.

## 7. La agenda

Cuando se escribió esta spec, la agenda se estaba construyendo (rama `claude/mi-espacio-agenda-aedf9d`). Según su plan, Task 5 y Task 9:
- `hoy_y_manana` suma `eventos: [{ id, hora, titulo, compartido, detalle }]`;
- `htmlDeHoyYManana` suma los eventos y «Ver la agenda» (`href="#agenda"`);
- la página suma la pestaña Agenda y el botón «Nuevo evento».

Titular usa esos eventos como dice 2.3, sin cambiar su forma. La Task 1 de la implementación lee lo que la agenda dejó de verdad en el main y ajusta el plan:
- los nombres;
- qué trae cada evento;
- si «Hoy y mañana» cambió de forma;
- los tests de la agenda que miran «Hoy y mañana».

## Decisiones

**Del usuario (27/10/2026):**
- **Titular,** entre las cuatro maquetas (Niveles vivos, Titular, Horizonte y Tablero).
- **Textos más cortos y entendibles** en lo que vence, unificados con «Vence el…» / «Vencen el…».
- **El resto,** en números con una línea, no en tanques chicos.
- **«Hoy y mañana»,** abajo y en columnas.

**De Claude, a revisar al leer:**
- **La frase siempre habla de las vacaciones,** también en contrato. Lo urgente (las horas a favor que vencen) está en «Vence pronto», al lado.
- **La médica extraordinaria más corta** (4.3), por el mismo criterio de textos cortos.
- **Con 1 día o con 0, la frase cambia** (4.2). La bajada no dice «Otros» si la cifra es 0.
- **«Mis vacaciones y saldos»** pasa a la cabeza de «El resto de 2026», al lado de la fecha.
- **El día de hoy y la modalidad** van arriba de la frase, en lugar del renglón «Planta permanente · Año 2026». El año queda en «El resto de 2026».
- **El movimiento sigue la regla de hoy:** una vez por carga de la página y quieto con `prefers-reduced-motion`.

## Lo que queda para quien lo construye

- Los nombres de las funciones y de las clases, que la maqueta usa con el prefijo `o2-` y la página llevará con `me-`.
- Las medidas finas: el margen de la banda, el ancho de «Vence pronto» y el alto de la barra. La maqueta es la referencia.
- Las muescas del talón con `mask`. Un navegador que no las dibuje deja la entrada sin muescas, y no pasa nada.
- Cómo se arma la ola: el mismo dibujo de las páginas públicas, en `currentColor`.
