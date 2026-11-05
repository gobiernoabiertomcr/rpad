# Mi espacio sin el paso obligatorio de los saldos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una persona con modalidad y sin saldo inicial entre a Mi espacio sin que se le abra el formulario, vea la bienvenida, use la Agenda, y sepa que Licencias y Horas extras piden primero los saldos.

**Architecture:** sin migración y sin tocar ninguna regla: el servidor sigue frenando las cargas. `miEspacioResumen.js` suma claves solo sin arranque, con los textos (Ruling 19). El resto es la página.

**Tech Stack:** Node 22, vanilla JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-04-mi-espacio-sin-saldos-design.md` (aprobada el 04/11/2026; el usuario aprobó este plan el 04/11/2026). La maqueta: `docs/superpowers/specs/2026-11-04-mi-espacio-sin-saldos-mockups/`. El executor lee las dos, y `docs/temas/mi-espacio.md` y `docs/temas/frontend.md`.

## Global Constraints

- **Esta feature va después de `claude/agenda-aviso-y-dependencia-e474f8`, y el código no empieza hasta que la coordinadora dé el turno** (orden del usuario, 04/11/2026). Con el turno: traer main (`sync_with_base_branch`), escanearlo y contrastar este plan con lo que trajo, y seguir las líneas de la coordinadora. Se pisan `public/js/mi-espacio.js`, `public/mi-espacio.html` y el `?v=`: se ubica todo por el nombre de la función; los números de línea de este plan son de hoy y solo orientan.
- **Al traer main,** si trajo una migración, correrla en la base local antes de la suite (`tests/schema.test.js` y `tests/permisos.test.js` leen la base del `.env`).
- **`VERSION_MI_ESPACIO`:** la siguiente a la que deje main (hoy `'20261223'`), en `tests/paginas.test.js` y `public/mi-espacio.html`.
- **No se cambia `services/miEspacioReglas.js` ni `controllers/miEspacioController.js`.** Si una tarea parece pedirlo, frenar y preguntar.
- **Con arranque, nada cambia:** las claves nuevas no aparecen, y ningún test de una persona con arranque se toca.
- `abrir_saldos`, `mensaje: sinArranque`, `htmlSinArranque`, `TEXTO_SIN_ARRANQUE` y los cuatro frenos de la página (`abrirLicencia`, `abrirUso`, `abrirHorasExtras`, `abrirPlanilla`) **quedan**.
- Los textos, los de la spec, al pie de la letra.
- Nombres inventados siempre. Ningún email real. Nunca `docker compose` desde un worktree.
- `npm test` completo antes y después de cada tarea, una sola suite a la vez; el `.env` copiado del checkout principal, sin mostrarlo.
- Commit y push de la rama después de cada tarea. Comentarios y nombres en español.

## Review Focus

1. Una persona con arranque: las mismas respuestas de la API y el mismo dibujo.
2. Sin arranque, ningún camino abre el formulario solo, en ningún hash, y ninguno deja cargar algo.
3. El movimiento: la banda de bienvenida no consume `pagina.bandaAnimada`, y la de verdad se mueve al guardar.
4. El foco: al cerrar el formulario vuelve al botón que lo abrió, también desde Horas extras.
5. Tras guardar los saldos: los botones de arriba aparecen, y Licencias y Horas extras muestran sus listas sin recargar la página. (Si justo falla `GET /resumen` al volver a pedir, los de arriba siguen ocultos hasta el próximo Resumen: las tarjetas traen los suyos, y se acepta.)
6. Todo texto del servidor pasa por `esc`.

---

## Task 1: Los datos (servidor)

**Files:** `services/miEspacioResumen.js`, `tests/mi-espacio-resumen.test.js`, `tests/mi-espacio-api.test.js`

- [ ] **Tests primero**, en `tests/mi-espacio-resumen.test.js` (junto a los de sin arranque, hoy cerca de 846-852):
  - planta y contrato sin arranque: `sin_saldos` con `encabezado`, `saludo` y `texto` exactos; siguen `abrir_saldos: true`, `mensaje`, `tanques: null`, `tipos: []` y `hoy_y_manana`;
  - sin nombre: `saludo` «Hola»;
  - sin un hoy válido: sin la clave;
  - con arranque y sin modalidad: sin la clave. El test de las claves del Resumen (cerca de 133) no cambia;
  - `titular.encabezado` con arranque, igual que antes;
  - `filasDeLicencias` y `tablaDeHorasExtras` sin arranque: `sin_saldos.texto` exacto; con arranque y sin modalidad, sin la clave. El de las claves de la lista (cerca de 863) no cambia.
- [ ] Un test de `tests/mi-espacio-api.test.js` (cerca de 414-420): `GET /resumen`, `GET /licencias` y `GET /horas-extras` de una persona sin arranque traen `sin_saldos`, y `POST /licencias` sigue dando 400 con `sinArranque`.
- [ ] Correr: fallan por falta de la clave.
- [ ] **`miEspacioResumen.js`:**
  - constantes `TEXTO_DE_LA_BIENVENIDA`, `TEXTO_SIN_SALDOS_LICENCIAS` y `TEXTO_SIN_SALDOS_HORAS`;
  - `encabezadoDelDia(hoy, modalidad)`, sacada de `titularDe`, con el mismo resultado;
  - `bienvenidaDe(deHoy, quien, resumen.modalidad)`: el objeto de la spec. **Ojo:** el local `modalidad` de `resumenDe` es la clave en texto; `encabezadoDelDia` necesita `resumen.modalidad`, `{ clave, texto }`, como `titularDe`: con el local, `minuscula(undefined)` tira y `GET /resumen` da 500. `nombreCorto` se importa de `./miEspacioReglas.js`;
  - en `resumenDe`, la rama de sin arranque: `sin_saldos` solo con `deHoy !== null`;
  - en `filasDeLicencias` (también en el retorno de `elAnio === null`, sin la clave) y en `tablaDeHorasExtras`: `sin_saldos` solo con modalidad válida y sin arranque (`esFechaIso`).
- [ ] Actualizar el JSDoc de `resumenDe`, `filasDeLicencias` y `tablaDeHorasExtras`.
- [ ] `node --test tests/mi-espacio-resumen.test.js`, `npm test` y commit: `feat(mi-espacio): la bienvenida sin saldos, como datos`.

## Task 2: La página

**Files:** `public/js/mi-espacio.js`, `public/mi-espacio.html`, `tests/mi-espacio-frontend.test.js`, `tests/paginas.test.js`

- [ ] **Tests primero**, en `tests/mi-espacio-frontend.test.js`:
  - **Se cambian** los que fijan la apertura sola o el Resumen de hoy con `resumenDel` real. Para encontrarlos todos después de traer main, `grep -nE "conSaldosParaArrancar|arranque: null|abierto\('modal-saldos'\)" tests/mi-espacio-frontend.test.js`. Hoy son:
    - 515-520: `resumenDel` llama al `resumenDe` real, así que trae `sin_saldos`: espera `htmlDeLaBienvenida(sinArranque)`, y `htmlSinArranque()` con `{ ...sinArranque, sin_saldos: undefined }`;
    - 2608-2613: bienvenida y `btn-cargar-licencia.hidden` true;
    - 2806-2840: se abre con el botón; 2825 pasa a mirar `.me-banda-bienvenida` y 2834 a `.me-regla` (con `.me-banda`, pasaría con la bienvenida y no probaría nada);
    - el ayudante nuevo `abrirLosSaldos(pagina)`, que toca `[data-abrir="saldos"]` de `vista-resumen` y hace `correr()`, en los tests que usan `conSaldosParaArrancar` (un `responder` del fetch: él no conoce la página) después de `iniciar()`: 2810, 4827, 4845, 5293, 5339, 5366, 5514 y 5580;
    - 2824, 4848, 5303, 5326-5331, 5510-5533, 5599-5606 y 9657-9669, uno por uno: los que clickean el botón oculto de arriba siguen probando el freno, que queda.
  - **No se cambian:** 207-214 y 3062 (`htmlSinArranque` y su paridad), y los que usan `sinArranque` como error de ejemplo (4751, 9358, 9419, 9473, 9525-9542).
  - **Se agregan:**
    - `htmlDeLaBienvenida`: encabezado, saludo, texto, botón con `data-abrir="saldos"`, «Hoy y mañana» y clases; escapa; sin regla ni números;
    - `htmlDelResumen`: con `abrir_saldos` y `sin_saldos`, la bienvenida; con `abrir_saldos` solo, `htmlSinArranque()`;
    - al entrar sin arranque, con `#resumen`, `#licencias`, `#horas` y `#agenda`: ningún modal abierto;
    - `btn-cargar-licencia` y `btn-cargar-horas` ocultos sin arranque, visibles con arranque y, al guardar los saldos, visibles;
    - `htmlDeListaDeLicencias` y `htmlDeHorasExtras` (planta y contrato) con `sin_saldos`: solo el aviso, sin selector, filtros, tabla ni botones de carga;
    - `htmlDelAvisoDeSaldos(TEXTO_SIN_ARRANQUE) === htmlSinArranque()`;
    - el botón del aviso abre el formulario desde Licencias y desde Horas extras y el foco vuelve a él al cerrar;
    - «Lo completo después» sin arranque, «Cancelar» con arranque;
    - `animarLaBanda` con la bienvenida no marca `bandaAnimada`.
- [ ] **`mi-espacio.js`:**
  - `htmlDelAvisoDeSaldos(texto)`, y `htmlSinArranque` la llama;
  - `htmlDeLaBienvenida(resumen)` y su rama en `htmlDelResumen`;
  - `htmlDeListaDeLicencias` y `htmlDeHorasExtras`: el aviso con `sin_saldos`, antes que nada y después de `esObjeto`;
  - `pintarResumen`: fuera la apertura; los dos botones `hidden` con `!conModalidad || resumen.abrir_saldos === true`;
  - fuera `saldosAbiertosSolos` de `pagina`;
  - `alTocarHoras`: atiende `data-abrir="saldos"`, como `alTocarLicencias`;
  - `animarLaBanda`, sin `:not` (el DOM falso de los tests no lo entiende y tira): `const banda = vista.querySelector('.me-banda'); if (pagina.bandaAnimada || vista.hidden || !banda || banda.classList.contains('me-banda-bienvenida')) return;`;
  - `abrirSaldos`: el rótulo de `porId('modal-saldos').querySelector('.modal-footer [data-cerrar]')`, cuando llega `saldo`;
  - corregir los comentarios que dicen que se abre solo o que los botones van con la modalidad cargada (cerca de 49-50, 525, 3266, 3432, 3470 y 3478; en `mi-espacio.html`, 971-972). Los de los frenos (4668 y 5586) quedan: el freno sigue.
- [ ] **`mi-espacio.html`:** sin ids nuevos ni cambios en el botón de cancelar (`tests/paginas.test.js` fija su texto y los ids de cada modal); en el `<style>`, `.me-banda-bienvenida .me-frase-bajada { max-width: 62ch; }` y `.me-banda-bienvenida .sg-btn { margin-top: 14px; }`; el `?v=`.
- [ ] Comprobar que `data-abrir` del botón del aviso esté en `IDENTIDADES_DEL_FOCO` (lo está) y que `.me-banda-cuerpo.sin-vence` sin regla no deje hueco: comparar con la maqueta.
- [ ] **`tests/paginas.test.js`:** subir `VERSION_MI_ESPACIO`.
- [ ] `node --test tests/mi-espacio-frontend.test.js tests/paginas.test.js`, `npm test` y commit: `feat(mi-espacio): se entra sin el paso de los saldos`.

## Task 3: El documento

**Files:** `docs/temas/mi-espacio.md`

- [ ] La línea del saldo inicial («el modal se abre solo…»), la de `resumenDe` y la del final de «la página» («con vínculo y sin arranque…»), con lo vigente: la bienvenida, el aviso de las dos pestañas, los botones ocultos, «Lo completo después» y la decisión con su motivo: «Sin saldos no se carga nada: decisión del usuario, 04/11/2026, para no tocar las reglas».
- [ ] Respetar los topes de `tests/documentos.test.js`, un renglón por oración.
- [ ] `npm test` y commit: `docs(mi-espacio): el paso de los saldos ya no es obligatorio`.

## Task 4: La simulación con cuentas reales (pedido del usuario)

Con las cuentas de dos personas reales, sin cargar nada: lo único que tienen que poder usar es la Agenda. Los nombres y los ids están en `~/rpad-notas/mi-espacio-sin-saldos-simulacion.md`, **nunca en el repo**: una es administración en planta y la otra, lector en contrato, las dos sin saldos.

- [ ] **La copia.** Con main ya traído, una base nueva, `rpad_sim_sin_saldos`, copiada de `datospublicos_mcr_rpad` (copia de producción, de solo lectura: no se escribe en ella, y producción no se toca), con las migraciones que falten. Confirmar con un `COUNT` que las dos cuentas siguen sin arranque ni cargas; si no, frenar y preguntar.
- [ ] **Sin leer lo privado.** Antes de entrar, en la copia, sin leerlos: `titulo`, `detalle` y `texto_publico` de `mi_espacio_eventos` a un texto genérico («Evento»). Así «Hoy y mañana» y la Agenda muestran la cantidad y las horas, no el contenido.
- [ ] **Las contraseñas** (el usuario lo autorizó, 04/11/2026). Una al azar por cuenta, generada por un script en el scratchpad, con su hash bcrypt solo en la copia. No se muestran en el chat ni van a un archivo del repo.
- [ ] **El servidor.** El de este worktree contra la copia (`DB_NAME` en su entorno), en un puerto libre, con el correo a Mailpit y sin correr ningún cron.
- [ ] **El recorrido, con cada cuenta**, entrando por el login real en el navegador, sin guardar nada:
  1. Entrar a Mi espacio: no se abre ningún formulario, tampoco al recargar ni entrando directo a `#licencias`, `#horas` y `#agenda`.
  2. Resumen: el saludo con su nombre, el texto, el botón y «Hoy y mañana»; sin números de saldos. La cuenta de administración ve a los compañeros que no están; la de lector, no.
  3. Licencias y Horas extras: solo el aviso con su botón. Sin listas, sin selector y sin botones de carga.
  4. Arriba: solo «Nuevo evento».
  5. El botón abre «Mis vacaciones y saldos» y «Lo completo después» lo cierra, sin guardar. El foco vuelve al botón.
  6. Agenda: se ve el mes, se cambia de mes y «Nuevo evento» abre el formulario; se cierra sin guardar.
  7. Compu y teléfono; en el teléfono, que `focus()` no desplace la página de más. Consola sin errores. Ningún pedido `POST`, `PUT` ni `DELETE` a `/api/mi-espacio`, salvo el login.
- [ ] **Al final, los controles:** las filas de `mi_espacio_*` de las dos cuentas, iguales a las de antes (`COUNT`); ningún correo nuevo en Mailpit.
- [ ] **El informe**, en `~/rpad-notas/mi-espacio-sin-saldos-simulacion-cierre.md`, con lo que pasó en cada paso y lo que se vio distinto. Las capturas, también afuera del repo: llevan datos reales.
- [ ] Parar el servidor y borrar `rpad_sim_sin_saldos` (ahí están las contraseñas de prueba). Mostrarle el resultado al usuario antes de seguir.

## Task 5: Revisión y entrega

- [ ] Revisión final con un agente que no vio cómo se armó, con el Review Focus.
- [ ] Merge en main y push si todo da verde. Kit sin SQL propio, para desplegar **después del kit de la agenda** (lo dice su `PASOS.txt`): `services/miEspacioResumen.js`, `public/js/mi-espacio.js` y `public/mi-espacio.html`. El despliegue es del usuario.
