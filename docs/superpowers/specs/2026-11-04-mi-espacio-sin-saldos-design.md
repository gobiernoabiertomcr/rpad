# Mi espacio sin el paso obligatorio de los saldos

Fecha: 04/11/2026. Decisiones del usuario del 04/11/2026; el usuario aprobó este diseño el 04/11/2026.
La maqueta, con personas inventadas, está en `docs/superpowers/specs/2026-11-04-mi-espacio-sin-saldos-mockups/` (`python3 -m http.server` en esa carpeta; la barra de abajo cambia de persona y de situación).
Lo que se ve y los contratos van acá; los textos, al pie de la letra.

## 1. Por qué

El pedido, con palabras del usuario: «Hoy para entrar en MI ESPACIO, si o si es necesario cargar los saldos. Esto ya lo habiamos hablado creo, de que nos de la opcion de que lo cargamos luego y que el resumen aparezca en blanco o sin resumen.»

Y, al ver lo que implicaba cargar licencias sin saldos: «Mi principal preocupacion es no romper nada y complicarla. Sino la opcion mas simple es que cuando alguien entra te aparezca la bienvenida y te diga que para usar MI ESPACIO, LICENCIAS, HORAS EXTRAS primero tenes que cargar los saldos... y que lo unico que tenes habilitado es la agenda.»

El paso viene de la spec 2026-10-26-mi-espacio-licencias-y-horas, sección 4: «La primera vez que una persona entra a Mi espacio, con su modalidad cargada, se abre solo el modal».

## 2. Lo que pasa hoy

Con modalidad y sin arranque (`mi_espacio_arranque`):

- El formulario «Mis vacaciones y saldos» se abre solo en cada carga de la página, sobre cualquier pestaña, también `#agenda` (`pintarResumen`; `saldosAbiertosSolos` vive en memoria).
- El Resumen dice «Para empezar, completá «Mis vacaciones y saldos».» y no muestra «Hoy y mañana», que el servidor ya manda.
- Licencias y Horas extras se ven vacías, con sus botones de carga, que abren el formulario de saldos (`abrirLicencia`, `abrirUso`, `abrirHorasExtras`, `abrirPlanilla`).
- La Agenda funciona.
- El servidor ya frena toda carga (`evaluarLaCarga`, `frenoDeLasHorasExtras`), y eso **no cambia**.

## 3. Decisiones del usuario

1. **Sin saldos, lo único habilitado es la Agenda** y el Resumen con la bienvenida. Licencias y Horas extras piden primero los saldos. No se puede cargar nada sin ellos.
2. **La bienvenida es el saludo en el Resumen,** en la banda celeste, con «Hola, Lucía». Sin ventana emergente: no hay nada nuevo que guardar.
3. **El formulario no se abre solo, nunca.** Se abre con su botón.
4. **Licencias y Horas extras se pueden abrir,** y en lugar de la lista dicen por qué no hay nada, con el botón «Mis vacaciones y saldos».
5. **«Cargar licencia» y «Cargar horas extras» de arriba se ocultan** sin saldos. «Nuevo evento» queda.
6. **El formulario sigue pidiendo todo junto.** Sin arranque, «Cancelar» dice «Lo completo después».

## 4. Lo que no cambia

- Las reglas: `services/miEspacioReglas.js` no cambia nada de lo que calcula, valida o frena. Los frenos de `evaluarLaCarga` y `frenoDeLasHorasExtras`, las horas acumuladas, la foto de los asuetos, el paso a Configuración, «Hoy no están» y el email de vencimiento, tal como están.
- Quien tiene arranque: ninguna respuesta de la API cambia. Las claves nuevas van solo sin arranque.
- Sin modalidad: el mensaje de siempre.
- `PUT /mi-espacio/saldo-inicial`, `PUT /mi-espacio/anio/:anio` y lo que pide el formulario.
- `abrir_saldos`: sigue llegando con el mismo valor, y los cuatro frenos de la página quedan, como red de seguridad de cualquier camino que se abra sin los botones.
- La base: sin migración.

## 5. Los contratos nuevos

### `resumenDe`

Con modalidad, sin arranque y con un hoy válido, a lo de hoy (`mensaje: sinArranque`, `abrir_saldos: true`, `hoy_y_manana`) suma:

```
sin_saldos: {
  encabezado: 'Miércoles 4 de noviembre, planta permanente',
  saludo: 'Hola, Lucía',
  texto: 'Para usar todas las funcionalidades de Mi espacio, primero tenés que cargar tus saldos. Mientras tanto, podés usar la Agenda.'
}
```

- `encabezado`: el mismo de `titularDe`, sacado a una función que usan los dos (con arranque, el titular no cambia).
- `saludo`: «Hola, » y `nombreCorto({ id, nombre: nombre_completo }, [])`, el primer nombre. Sin un nombre, «Hola».
- Sin un hoy válido, sin la clave `sin_saldos`; la página cae en la invitación de hoy.

### `filasDeLicencias` y `tablaDeHorasExtras`

Con modalidad y sin arranque, además de lo de hoy, `sin_saldos: { texto }`:

- Licencias: «Para usar Licencias, primero tenés que cargar tus saldos.»
- Horas extras: «Para usar Horas extras, primero tenés que cargar tus saldos.»

## 6. La página

### El Resumen

`htmlDelResumen`: con `abrir_saldos === true` y `sin_saldos` objeto, `htmlDeLaBienvenida(resumen)`; sin `sin_saldos`, `htmlSinArranque()`, como hoy.

`htmlDeLaBienvenida` es la banda celeste con su ola, sin regla ni «Vence pronto» y `sin-vence`:

- la clase `me-banda me-banda-bienvenida`, con `aria-labelledby="me-frase"`;
- `me-banda-dia` con el encabezado, `h2.me-frase#me-frase` con el saludo y `me-frase-bajada` con el texto;
- el botón «Mis vacaciones y saldos», `sg-btn sg-btn-tinta sg-btn-chico`, `data-abrir="saldos"`;
- debajo, `htmlDeHoyYManana` con `hoy_y_manana` y `persona.ve_companeros`.

`animarLaBanda` no se consume con esta banda (sale si la `.me-banda` que encuentra tiene `me-banda-bienvenida`): la de verdad se mueve la primera vez, al guardar los saldos.

### Al entrar

`pintarResumen` no abre el formulario: se van el bloque de la apertura y `saldosAbiertosSolos`.
`btn-cargar-licencia` y `btn-cargar-horas`: ocultos sin modalidad **o** con `abrir_saldos === true`.

### Licencias y Horas extras

`htmlDeListaDeLicencias` y `htmlDeHorasExtras`: con `sin_saldos` objeto, solo el aviso azul (`me-aviso me-aviso-azul`) con el texto del servidor y el botón, antes que cualquier otra cosa.
`htmlSinArranque` y este aviso comparten una función, `htmlDelAvisoDeSaldos(texto)`, y lo de `htmlSinArranque` no cambia.
`alTocarHoras` suma `data-abrir="saldos"`, que hoy no atiende (`alTocarResumen` y `alTocarLicencias` sí).

### El formulario

Al abrir (`abrirSaldos`), el botón de cancelar del pie (`.modal-footer [data-cerrar]`) dice «Lo completo después» si `saldo.arranque` es null, y «Cancelar» si no. El HTML del botón no cambia: `tests/paginas.test.js` fija su texto y los ids de cada modal.
Lo demás, igual. Al guardar, `volverAPedirTodo` trae todo y los botones de arriba aparecen.

## 7. Compatibilidad y despliegue

- Sin SQL propio: nada que hacer en phpMyAdmin. Va **después del kit de la agenda** (aviso diario, «Depende de», formulario de eventos), con su migración ya corrida: el `mi-espacio.js` de este kit lleva ese código.
- Una pestaña con la página anterior: las claves nuevas no le molestan y sigue abriendo el formulario, hasta que se recargue.
- Si por un momento llega la página nueva contra el servidor anterior: sin `sin_saldos`, la invitación de hoy y las listas vacías. No se rompe nada.
- `?v=` de `mi-espacio.js` sube.

## 8. Fuera de alcance, para más adelante

**Cargar licencias y horas sin saldos** se analizó y se dejó de lado por decisión del usuario, para no tocar reglas que andan.
Si se retoma, lo que hay que resolver: los textos que mentirían sin arranque (`vistaDe`, `franquiciaQueVence`), las horas acumuladas (una carga sin saldo no se podría corregir después), la foto de los asuetos (`fotosDelFeriado` saltea unas vacaciones sin arranque) y qué número se escribe al completar con cargas ya hechas.

También fuera: guardar los saldos por partes, la antigüedad automática y el resto del brainstorming archivado del 01/11.

## 9. Documentación

`docs/temas/mi-espacio.md`: el saldo inicial (ya no se abre solo) y la página (la bienvenida, las pestañas, los botones). Nada más: `CLAUDE.md` no cambia.
