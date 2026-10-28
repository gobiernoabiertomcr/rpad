# Mi espacio: de qué licencia salen los días de unas vacaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada carga de vacaciones siga con la licencia que empezó a usar aunque pase su vencimiento, y que lo que ya no se puede usar se diga «Perdés …» y salga de lo disponible.

**Architecture:** Todo pasa en dos funciones puras: `repartoDeVacaciones` de `services/miEspacioReglas.js` (el reparto por carga y los `perdidos`) y la bajada del Resumen en `services/miEspacioResumen.js`. Todo lo demás (el modal, «N disponibles», la frase y la regla, «Vence pronto» y el email de vencimiento) lee `disponibles` y los textos del servidor, y cambia solo. Sin SQL, sin cambios en la página.

**Tech Stack:** Node 22 con ES Modules, `node:test`, MariaDB solo para la prueba de la API.

**Spec:** `docs/superpowers/specs/2026-10-27-mi-espacio-dias-de-vacaciones-design.md`

## Global Constraints

- Los textos, al pie de la letra de la spec (punto 2.6 y la tabla del punto 3): «Perdés 2 de la 2024 (vencen el 31/12/2026).», «Perdés 1 de la 2024 (vence el 31/12/2026).», «… y 1 de la 2025 (vence el 31/12/2027).».
- Con un solo año se mantiene «Salen de la licencia 2024, la más vieja.».
- Las funciones de las reglas son puras: sin pool ni `Date` local, fechas `'AAAA-MM-DD'`, y ninguna tira error.
- Español en el código, los comentarios y los tests. Los comentarios, con la densidad del archivo.
- El repo es público: en los tests, personas inventadas, sin nombres reales ni datos de la base.
- Subagentes con Opus y una revisión por tarea.
- Nunca un email real ni `/api/cron/*`. No se escribe en `datospublicos_mcr_rpad`: la base de la rama es `rpad_rama_dias_vacaciones`.
- La suite completa, siempre con el candado `C:\Users\Mariano\.rpad-suite.lock`, antes y después.

## Review Focus

1. Una carga que empieza en un día no hábil (sábado 26/12/2026 al 08/01/2027): empieza a usar la 2024 en su primer día hábil, el 28/12, y la sigue en enero. Test en la Task 2.
2. Corregir una carga ya guardada para que cruce el 31/12 (el `PUT` reemplaza la fila en el estado de después): el reparto y el texto son los de la carga nueva. Lo cubre el test de la API de la Task 4, que usa el mismo `evaluarLicencia` del alta y de la corrección.
3. Con hoy después del vencimiento y la carga que cruzó el año ya en curso (hoy, el 04/01/2027, con la del 21/12 al 10/01): el reparto no cambia, y la 2024 da 0 de `disponibles` y 0 de `perdidos`. Test en la Task 3.
4. Otra licencia de Mi espacio que ocupa los días hábiles que quedan antes del vencimiento (la atención médica del 21/12 al 31/12): «Perdés 10». Test en la Task 3.
5. Una carga anterior cargada después de una que cruza el año: le saca días a la de diciembre y «Perdés» desaparece. Tests en las Tasks 2 y 3.

---

### Task 1: La rama con el main de horas extras

Esta la hace el controlador, no un subagente. Empieza cuando la coordinadora pasa el hash de main con «Mi espacio: mejoras en la carga de horas extras».

**Files:** ninguno del código. Se crean `.env` del worktree (ignorado por git) y la base `rpad_rama_dias_vacaciones`.

- [ ] **Step 1: Traer main**

Run: `git -C C:/git/rpad/.claude/worktrees/conteo-vacaciones-2c84aa merge <hash>`
Expected: sin conflictos (la rama solo tiene la spec y este plan).

- [ ] **Step 2: Ver si horas extras tocó lo que cambia este plan**

Run: `git -C <worktree> diff 2aa394a <hash> -- services/miEspacioReglas.js services/miEspacioResumen.js | grep -nE "repartoDeVacaciones|textoDelReparto|habilitadoAl|ordinariasDe|tanqueDeVacaciones|bajadaDe|titularDe|venceProntoDe|avisosDeVencimiento"`
Expected: nada. Si algo aparece, ajustá las Tasks 2 a 4 a la forma nueva antes de seguir, y anotá el ajuste acá.

- [ ] **Step 3: El entorno**

- La base: copiá `datospublicos_mcr_rpad` en `rpad_rama_dias_vacaciones`, dentro del contenedor `rpad-db`. Para eso usá `mariadb-dump` y `mariadb`, con la clave de root de `DB_ROOT_PASSWORD` del `.env` de `C:\git\rpad`. Después dale a `DB_USER` del `.env` permiso sobre la copia.
- El `.env` del worktree: copiá el de `C:\git\rpad`, con `DB_NAME=rpad_rama_dias_vacaciones`.
- `node_modules`: un junction a `C:\git\rpad\node_modules`, con `cmd /c mklink /J`. Se saca en la Task 5 con `cmd /c rmdir`, que borra el junction y no lo de adentro.
- La base local tiene que tener la migración de horas extras (`migracion-mi-espacio-horas.sql`): si falta, la tiene que haber corrido la sesión de horas extras con el OK del usuario. Si no está, preguntale a la coordinadora.

- [ ] **Step 4: La suite de antes**

Run: el script `suite.sh <etiqueta>` del scratchpad, con el candado, sobre el worktree.
Expected: 0 fallas. Anotá los totales para compararlos al final.

---

### Task 2: El reparto por carga

**Files:**
- Modify: `services/miEspacioReglas.js`, `repartoDeVacaciones` (el bucle de los días y su comentario)
- Test: `tests/mi-espacio-reglas.test.js`, `describe('el reparto de las vacaciones')`

**Interfaces:**
- Produces: `repartoDeVacaciones(estado, { hoy, feriados })` con la misma forma de siempre (`{ hoy, ordinarias, porFila, sinCubrir }`). Solo cambia de qué licencia sale cada día.

Los tests usan la persona de la spec con los ayudantes del archivo: `soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 }, ...filas)`, con 20 días en 2026; si `soloVacaciones` no los da, armá el estado con esos datos. Usan `vacaciones(id, desde, hasta)`, `HOY` (26/10/2026) y `SIN_FERIADOS`. Que el arranque y hoy sean el 26 y no el 27 no cambia ningún resultado.

- [ ] **Step 1: Los tests que fallan**

Dentro de `describe('el reparto de las vacaciones')`, renombrá «la más vieja, día por día» a «la más vieja primero» (sus aserciones no cambian). Después agregá:

```js
it('una carga que empieza en diciembre sigue con la 2024 en enero (spec 2026-10-27, punto 3)', () => {
  const casos = [
    ['2026-12-16', '2027-01-10', [{ anio: 2024, dias: 15 }, { anio: 2025, dias: 1 }]],
    ['2026-12-21', '2027-01-10', [{ anio: 2024, dias: 13 }]],
    ['2026-12-23', '2027-01-05', [{ anio: 2024, dias: 8 }]],
    ['2026-12-26', '2027-01-08', [{ anio: 2024, dias: 9 }]] // empieza un sábado: usa la 2024 desde el lunes 28/12
  ];
  for (const [desde, hasta, esperado] of casos) {
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
      vacaciones(100, desde, hasta)), { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), esperado, `${desde} al ${hasta}`);
    assert.equal(reparto.sinCubrir.size, 0);
  }
});

it('dos cargas seguidas no se juntan: la que empieza en enero ya no usa la 2024', () => {
  const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
    vacaciones(100, '2026-12-21', '2026-12-31'), vacaciones(101, '2027-01-04', '2027-01-10')),
  { hoy: HOY, feriados: SIN_FERIADOS });
  assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 8 }]);
  assert.deepEqual(reparto.porFila.get(101), [{ anio: 2025, dias: 5 }]);
});

it('las cargas se reparten en el orden de sus fechas, no del id', () => {
  const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
    vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')),
  { hoy: HOY, feriados: SIN_FERIADOS });
  assert.deepEqual(reparto.porFila.get(101), [{ anio: 2024, dias: 2 }]);
  assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 13 }]);
});

it('sin días de la que venía usando ni otra habilitada, el día queda sin cubrir y la carga sigue después', () => {
  // La 2024 con 3: 28, 29 y 30/12. El 31/12 no hay ninguna. Desde el 1/1/2027, la segunda mitad de la 2026
  const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 3, 2025: 0, 2026: 0 },
    vacaciones(100, '2026-12-28', '2027-01-08')), { hoy: HOY, feriados: SIN_FERIADOS });
  assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 3 }, { anio: 2026, dias: 5 }]);
  assert.deepEqual(reparto.sinCubrir.get(100), ['2026-12-31']);
});
```

Cambiá el test «una carga que cruza un vencimiento…»:
- el título pasa a «una carga que cruza un vencimiento sigue con la que empezó: la 2024 se termina el 04/01»;
- lo esperado pasa a `[{ anio: 2024, dias: 3 }, { anio: 2026, dias: 1 }]`.

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test --test-name-pattern="reparto" tests/mi-espacio-reglas.test.js`
Expected: FAIL en los nuevos y en el que cruza un vencimiento, porque hoy da `2024: 11, 2025: 5` y `2024: 2, 2026: 2`. Los demás, PASS.

- [ ] **Step 3: El reparto por carga, en `repartoDeVacaciones`**

En lugar de juntar todos los días y ordenarlos por fecha, armá una lista de filas de vacaciones, cada una con su `id` (`idDe`), su `hasta` y sus días de `diasQueDescuentan`. Ordenalas por el primer día y después por id; las filas sin días no asignan nada.

Recorré cada fila con una licencia `actual`, que arranca en null en cada fila:

```js
const libresAl = (ordinaria, fecha) => habilitadoAl(ordinaria, fecha) - asignados.get(ordinaria.anio).length;
// en cada día de la fila: sigue con la que ya empezó aunque haya vencido; si no le quedan, la más vieja vigente ese día
if (actual === null || libresAl(actual, fecha) <= 0) {
  actual = ordinarias.find((ordinaria) => fecha <= ordinaria.vence && libresAl(ordinaria, fecha) > 0) ?? null;
}
```

Con `actual` en null, el día va a `sinCubrir`, como antes. Guardá también, por año, el `hasta` más tardío de las filas que le asignaron algún día: lo usa la Task 3 (por ejemplo, un `Map` `ultimoUso`).

Reescribí el comentario de la función con la regla de la spec 2026-10-27: por carga, la que se empezó a usar sigue hasta terminarse, y las cargas van en el orden de sus fechas.

- [ ] **Step 4: Correr el archivo entero**

Run: `node --test tests/mi-espacio-reglas.test.js tests/mi-espacio-resumen.test.js`
Expected: PASS. Si falla otro test que dependía del reparto día por día, mirá si su caso cruza un vencimiento. Si lo cruza, corregí lo esperado con la regla nueva y anotalo en el commit; si no, es un error del cambio.

- [ ] **Step 5: Commit**

```bash
git add services/miEspacioReglas.js tests/mi-espacio-reglas.test.js
git commit -m "feat(dias-de-vacaciones): cada carga sigue con la licencia que empezó a usar, aunque pase su vencimiento"
```

---

### Task 3: «Perdés»

**Files:**
- Modify: `services/miEspacioReglas.js`: `repartoDeVacaciones` (los `perdidos`), `textoDelReparto` y la nueva `textoDePerdidos`
- Test: `tests/mi-espacio-reglas.test.js` (`describe('el reparto de las vacaciones')`, `describe('textoDelReparto')` y los de `avisosDeVencimiento`)

**Interfaces:**
- Consumes: el `ultimoUso` por año de la Task 2.
- Produces:
  - cada ordinaria de `repartoDeVacaciones(...).ordinarias` suma `perdidos` (un entero de 0 en adelante), y `disponibles` ya no los cuenta;
  - `export const textoDePerdidos = (ordinarias) => string`: 'Perdés 2 de la 2024 (vencen el 31/12/2026).' o '' si no hay ninguna con `perdidos > 0`. Las entradas que no son objetos se saltean. La usa también la Task 4.

- [ ] **Step 1: Los tests que fallan**

Con el mismo estado de la Task 2, y un ayudante local `textoDeLaCarga(saldos, filas, id)` que devuelve `textoDelReparto(repartoDeVacaciones(soloVacaciones('2026-10-26', saldos, ...filas), { hoy: HOY, feriados: SIN_FERIADOS }), id)`, agregá:

```js
const PERSONA = { 2024: 15, 2025: 20, 2026: 10 };
it('los textos de la spec 2026-10-27 (punto 3)', () => {
  const casos = [
    [[vacaciones(100, '2026-12-16', '2027-01-10')], 100, 'Salen de las licencias 2024 (15 días) y 2025 (1 día), las más '
      + 'viejas. Te quedan 29 días: 19 de la 2025 y 10 de la 2026.'],
    [[vacaciones(100, '2026-12-21', '2027-01-10')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de '
      + 'la 2025 y 10 de la 2026. Perdés 2 de la 2024 (vencen el 31/12/2026).'],
    [[vacaciones(100, '2026-12-23', '2027-01-05')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de '
      + 'la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026).'],
    [[vacaciones(100, '2026-12-14', '2026-12-18')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 40 días: 10 de '
      + 'la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.'],
    [[vacaciones(100, '2026-12-21', '2026-12-31'), vacaciones(101, '2027-01-04', '2027-01-10')], 101, 'Salen de la licencia '
      + '2025, la más vieja. Te quedan 25 días: 15 de la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026).'],
    [[vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')], 101, 'Salen de la licencia '
      + '2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026.'],
    [[vacaciones(100, '2026-12-14', '2026-12-18'), { id: 102, tipo: 'medica', desde: '2026-12-21', hasta: '2026-12-31',
      horas: null }], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. '
      + 'Perdés 10 de la 2024 (vencen el 31/12/2026).']
  ];
  for (const [filas, id, esperado] of casos) assert.equal(textoDeLaCarga(PERSONA, filas, id), esperado);
});

it('los perdidos salen de lo disponible; con un día libre antes del vencimiento, no se pierden', () => {
  const cruza = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2027-01-10')),
    { hoy: HOY, feriados: SIN_FERIADOS });
  assert.deepEqual([ordinaria(cruza, 2024).disponibles, ordinaria(cruza, 2024).perdidos], [0, 2]);
  assert.equal(ordinaria(cruza, 2025).perdidos, 0);
  // Termina el miércoles 30/12: el 31/12 todavía se puede empezar otra carga con lo que queda de la 2024
  const antes = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2026-12-30')),
    { hoy: HOY, feriados: SIN_FERIADOS });
  assert.deepEqual([ordinaria(antes, 2024).disponibles, ordinaria(antes, 2024).perdidos], [8, 0]);
});

it('una licencia ya vencida a hoy no tiene perdidos, y la carga que cruzó el año no cambia', () => {
  const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2027-01-10')),
    { hoy: '2027-01-04', feriados: SIN_FERIADOS });
  assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 13 }]);
  assert.deepEqual([ordinaria(reparto, 2024).disponibles, ordinaria(reparto, 2024).perdidos], [0, 0]);
});

it('sin nada disponible: «No te quedan días disponibles.» y después lo que se pierde', () => {
  assert.equal(textoDeLaCarga({ 2024: 15, 2025: 0, 2026: 0 }, [vacaciones(100, '2026-12-23', '2027-01-05')], 100),
    'Salen de la licencia 2024, la más vieja. No te quedan días disponibles. Perdés 7 de la 2024 (vencen el 31/12/2026).');
});
```

En `describe('textoDelReparto')`, un test de `textoDePerdidos`:
- `[{ anio: 2024, perdidos: 1, vence: '2026-12-31' }]` da 'Perdés 1 de la 2024 (vence el 31/12/2026).';
- `[{ anio: 2024, perdidos: 2, vence: '2026-12-31' }, { anio: 2025, perdidos: 1, vence: '2027-12-31' }, { anio: 2026, perdidos: 0, vence: '2028-12-31' }, null]` da 'Perdés 2 de la 2024 (vencen el 31/12/2026) y 1 de la 2025 (vence el 31/12/2027).';
- `[]`, `null` y `[{ anio: 2024, perdidos: 0 }]` dan ''.

Junto a los tests de `avisosDeVencimiento`, uno nuevo, con `calcular(estado, { hoy: '2026-12-01', feriados: SIN_FERIADOS })` y `avisosDeVencimiento(calculo, { hoy: '2026-12-01', feriados: SIN_FERIADOS, modalidad: 'planta' })`:
- con la carga del 21/12 al 10/01 no hay ninguna clave `'licencia-2024'`;
- con la del 14/12 al 18/12 hay una, con `textoDeLaLicencia(10, 2024, '2026-12-31')`, o con el texto que arme el archivo para esa clave.

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `node --test --test-name-pattern="perdidos|Perdés|spec 2026-10-27|textoDePerdidos|vencida a hoy|sin nada disponible" tests/mi-espacio-reglas.test.js`
Expected: FAIL. `textoDePerdidos` no existe, y los textos dicen «2 de la 2024 (vencen el 31/12/2026)» dentro de «Te quedan».

- [ ] **Step 3: Los `perdidos` en `repartoDeVacaciones`**

Para cada ordinaria, `libres` es lo que hoy son los `disponibles`: 0 si `vence < hoy` y, si no, `max(0, habilitado − asignados)`. Si `libres > 0`:
- buscá un día libre desde `max(hoy, sumarDias(ultimoUso, 1))` hasta `vence`; sin `ultimoUso`, desde hoy;
- un día libre es el que da `proximoDiaHabilCon(fecha, feriados)` caminando y no está entre el `desde` y el `hasta` de ninguna licencia de `datos.licencias`, de cualquier tipo;
- sin ninguno (o con `proximoDiaHabilCon` en null), `perdidos = libres`; si no, 0.

`disponibles` pasa a ser `libres − perdidos`. Agregá `perdidos` al comentario de la función.

- [ ] **Step 4: `textoDePerdidos` y `textoDelReparto`**

`textoDePerdidos(ordinarias)`: 'Perdés ' + `enLista` de `${numeroTexto(perdidos)} de la ${anio} (${perdidos === 1 ? 'vence' : 'vencen'} el ${fechaCorta(vence)})`, en el orden de la lista, + '.'.

`textoDelReparto` suma `' ' + textoDePerdidos(reparto.ordinarias)` después de «Te quedan …» o de «No te quedan días disponibles.», solo si no es ''. Actualizá su comentario.

- [ ] **Step 5: Correr los dos archivos de reglas y del Resumen**

Run: `node --test tests/mi-espacio-reglas.test.js tests/mi-espacio-resumen.test.js tests/mi-espacio-frontend.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/miEspacioReglas.js tests/mi-espacio-reglas.test.js
git commit -m "feat(dias-de-vacaciones): «Perdés …» cuando ya no queda un día hábil libre antes del vencimiento"
```

---

### Task 4: El Resumen, la API y la documentación

**Files:**
- Modify: `services/miEspacioResumen.js`, `bajadaDe` y `titularDe` (y sus comentarios)
- Test: `tests/mi-espacio-resumen.test.js` y `tests/mi-espacio-api.test.js` (`describe('el cálculo previo')`)
- Modify: `CLAUDE.md` y `docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md` (una línea en 3.1)

**Interfaces:**
- Consumes: `textoDePerdidos(ordinarias)` de la Task 3, y `perdidos` y `disponibles` de cada ordinaria.

- [ ] **Step 1: El test del Resumen, que falla**

En `tests/mi-espacio-resumen.test.js`, armá el Resumen como los tests de la banda «Titular». La persona de planta tiene 15 días de la 2024, 20 de la 2025 y 10 de la 2026, con 20 días en 2026, y una carga del 21/12/2026 al 10/01/2027; hoy es el 26/10/2026, sin feriados de la tabla. Comprobá:
- `titular.antes`, `cifra` y `despues`: 'Te quedan', '30' y 'días de vacaciones';
- `titular.bajada`, en este orden: `{ texto: '13 ya están cargados para diciembre y enero de 2027.', vence: false }`, `{ texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false }` y `{ texto: 'Perdés 2 de la 2024 (vencen el 31/12/2026).', vence: true }`;
- las capas del tanque: ninguna con la clase `vence`;
- lo que queda de las vacaciones en `tipos`: '30 disponibles';
- `vence_pronto`, con hoy en '2026-12-01': ninguna entrada cuyo `titulo` diga «licencia 2024».

Con la carga del 14/12 al 18/12, en cambio, la bajada empieza con `{ texto: '10 vencen el jueves 31/12.', vence: true }` y no dice «Perdés».

- [ ] **Step 2: Correrlo y ver que falla**

Run: `node --test --test-name-pattern="Perdés" tests/mi-espacio-resumen.test.js`
Expected: FAIL, porque la bajada no tiene la oración de «Perdés». La cifra y las capas ya dan bien por la Task 3.

- [ ] **Step 3: La oración en la bajada**

`titularDe` le pasa a `bajadaDe` `textoDePerdidos(ordinariasDel(panel.cuenta))` (importada de `miEspacioReglas.js`). `bajadaDe` la suma al final como `{ texto, vence: true }`, solo si no es ''. Actualizá los dos comentarios. La página no cambia: imprime las oraciones de la bajada y pone en negrita las de `vence`.

- [ ] **Step 4: El test de la API**

En `describe('el cálculo previo')` de `tests/mi-espacio-api.test.js`:
- `listoParaCargar('adminA')`, `conSaldo('adminA', 'vacaciones', ANIO - 2, '3.0')` y `conSaldo('adminA', 'vacaciones', ANIO - 1, '10.0')`;
- desde es `diaHabilAnterior(`${ANIO + 1}-01-01`)`, el último día hábil del año (el `beforeEach` vacía la tabla de feriados);
- hasta es el cuarto día hábil de `ANIO + 1`, caminando con `proximoDiaHabil`. Así la carga tiene 5 días hábiles: 1 en diciembre y 4 en enero;
- `POST /mi-espacio/licencias/calculo` con `{ tipo: 'vacaciones', desde, hasta }`.

Lo esperado:
- `vista.texto_reparto` es `Salen de las licencias ${ANIO - 2} (3 días) y ${ANIO - 1} (2 días), las más viejas. Te quedan 8 días, todos de la ${ANIO - 1}.`;
- `data.error` es null.

Con la regla de antes daba `${ANIO - 2} (1 día) y ${ANIO - 1} (4 días)`.

Run: `node --test --test-name-pattern="cálculo previo" tests/mi-espacio-api.test.js`, con Docker y fuera del candado de otra suite.
Expected: PASS.

- [ ] **Step 5: La documentación**

`CLAUDE.md`, en «Mi espacio: licencias y horas extras»:
- en «Vacaciones (3.1; …)», cambiá «Cada día hábil de unas vacaciones sale de la licencia más vieja que ese día esté habilitada, no vencida y con días libres» por la regla por carga de la spec 2026-10-27-mi-espacio-dias-de-vacaciones:
  - la que se empezó a usar sigue hasta terminarse, aunque pase su vencimiento;
  - cada carga es aparte y van en el orden de sus fechas;
  - «Perdés N de la AAAA (vencen el …)» cuando ya no queda un día hábil libre antes del vencimiento, fuera de lo disponible. Sumá `perdidos` y `textoDePerdidos`;
- en la lista de antiobjetivos, después de «que algo diga «perdiste»», agregá «(salvo «Perdés …» de las vacaciones: decisión del usuario, 27/10/2026)»;
- en el Resumen «Titular», la bajada suma «Perdés …» al final, en ámbar;
- en los tests de la sección, los nuevos.

En la spec de 2026-10-26, al final del párrafo del reparto de 3.1, agregá una línea: «Cambiado el 27/10/2026: el reparto es por carga (spec 2026-10-27-mi-espacio-dias-de-vacaciones).».

- [ ] **Step 6: Commit**

```bash
git add services/miEspacioResumen.js tests/mi-espacio-resumen.test.js tests/mi-espacio-api.test.js CLAUDE.md docs/superpowers/specs/2026-10-26-mi-espacio-licencias-y-horas-design.md
git commit -m "feat(dias-de-vacaciones): «Perdés …» en el Resumen, la prueba de la API y la documentación"
```

---

### Task 5: El cierre

Lo hace el controlador.

- [ ] **Step 1: La revisión final de la rama**, con un revisor Opus sobre `git diff <main de la Task 1>..HEAD`, con la spec y este plan. Se corrige lo que encuentre, con su revisión.
- [ ] **Step 2: La suite completa**, con el candado. Expected: 0 fallas, y los tests de antes más los nuevos.
- [ ] **Step 3: Merge en main y push**, solo si todo dio bien: `git merge --no-ff` de la rama, con un mensaje que resuma la regla, y `git push origin main`.
- [ ] **Step 4: El kit `C:\Users\Mariano\Desktop\RPAD-deploy-dias-de-vacaciones`**, como el de `RPAD-deploy-mi-espacio-resumen`:
  - `archivos-dias-de-vacaciones/` con `services/miEspacioReglas.js` y `services/miEspacioResumen.js` del main nuevo, y su `.zip`;
  - `vuelta-atras/archivos-anteriores/` con los mismos dos archivos del main de la Task 1, y su `.zip`;
  - `PASOS.txt`: sin SQL, sin cron ni npm, subir los dos archivos y Restart, fuera del horario de los crons (8:15, 14:00 y las medias horas). Va después del kit de horas extras;
  - todo comparado byte a byte con `git show <commit>:<ruta>`, también lo que va dentro de los zip.
- [ ] **Step 5: La limpieza**:
  - borrar la base `rpad_rama_dias_vacaciones` y su permiso;
  - borrar el `.env` del worktree;
  - sacar el junction de `node_modules` con `cmd /c rmdir` y verificar que ya no está antes de cualquier `git worktree remove`.
- [ ] **Step 6: El traspaso y el aviso**:
  - el traspaso, en `mi-espacio-dias-de-vacaciones-cierre.md` de la carpeta de notas;
  - el aviso a la coordinadora con SendMessage: el merge, los tests de antes y de después, y el kit;
  - la memoria del proyecto, actualizada.
