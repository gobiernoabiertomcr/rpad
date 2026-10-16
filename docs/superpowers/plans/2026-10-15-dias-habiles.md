# Entrega 1: recordatorios solo en días hábiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el email de cambios pendientes y el aviso a las áreas (40 días) salgan solo en días hábiles, sin perder ningún aviso y **sin romper nada de lo que hoy funciona**.

**Architecture:** El calendario hábil ya existe (`services/notasDigitalesCalendario.js`, el de las Notas Digitales). Se le agrega `rangoDeAviso(hoy, dias)`, que dice qué vencimientos avisa un día hábil (incluidos los de los días no hábiles que siguen). La lógica de los dos avisos sale del controlador a un servicio nuevo, `services/avisosDiariosService.js`, que recibe la fecha (`hoy`) como parámetro para poder probarla con fechas fijas, igual que el motor de Notas Digitales. El controlador queda como capa HTTP y le pasa `hoyArgentina()`.

**Tech Stack:** Node 22 en producción (24 en desarrollo), Express 4, ES Modules, MariaDB 10.11 (mysql2/promise), Nodemailer, `node:test` contra Docker (MariaDB + Mailpit).

**Spec:** `docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md`, sección 4 (y 4.4 para los crons). Los números de sección que se citan ("spec 4.2") son de esa spec.

## Global Constraints

- **Regla principal del usuario: no romper nada de lo implementado.** Antes de empezar se guarda una línea de base de `npm test` (Task 0). **Cada tarea termina corriendo la suite completa** y comparándola con la línea de base: no puede aparecer ninguna falla nueva. Si una falla existía en la línea de base, se informa y no se toca.
- Se trabaja en la rama `feat/dias-habiles`, nunca en `main`.
- Node 22 en producción: no usar APIs que no existan en Node 22. ES Modules, `async/await`, arrow functions, español en nombres, comentarios y textos.
- SQL siempre parametrizado con `?`.
- Respuestas de la API: `{ success, data?, error?, message? }`. **Compatibilidad:** las respuestas existentes solo suman campos; no se quita ni se renombra ninguno.
- **Hoy** es siempre la fecha de Argentina (`hoyArgentina()`), nunca `CURDATE()` (spec 3).
- **El repositorio es público:** ningún nombre de persona, email personal ni dato de `database/privado/`. Los tests usan datos inventados con dominio `@rpad.test`.
- **Antes de correr cualquier test:** `grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env` tiene que mostrar `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1` y `DB_HOST=127.0.0.1`. Si no, no se corre nada: la base local es una copia de producción con emails reales.
- **No se agregan dependencias de npm.** Esta entrega no tiene migración.
- **Textos exactos:**
  - Respuesta del cron de cambios pendientes en un día no hábil: `Hoy no es día hábil: no se envían recordatorios.`
  - Confirmación del interruptor en Correos: `¿Activar el envío automático? Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.`
- **Commits:** mensajes en español con el estilo del repo (`feat:`, `fix:`, `test:`, `docs:`), terminados con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Cada `git add` nombra archivos concretos: nunca `git add -A` ni `git add .`.

## Review Focus

1. **Un fin de semana largo.** El jueves anterior a un viernes feriado tiene que avisar los vencimientos de jueves, viernes, sábado y domingo + 40, y ninguno dos veces el lunes. → test de continuidad de `rangoDeAviso` en la Task 1.
2. **Los tests existentes del email de cambios pendientes corren por HTTP con la fecha real.** Un sábado ya no hay email: tienen que saltearse ese día (con el motivo) y no fallar. Lo nuevo se prueba con fechas fijas. → Task 2.
3. **La vista previa y la prueba del aviso a las áreas un sábado.** No pueden quedar siempre con el ejemplo: usan la selección del próximo día hábil. → test en la Task 2.
4. **La corrida diaria un día no hábil.** El aviso a las áreas no envía nada, las Notas Digitales siguen decidiendo solas (ya lo hacen) y la respuesta conserva todos sus campos. → test en `tests/notas-api.test.js` (Task 2), sobre su base de prueba: nunca contra la copia local, que tiene el envío automático activo.
5. **El servidor con otra zona horaria.** Producción y la base pueden estar en UTC: la fecha del aviso a las áreas sale de `hoyArgentina()`, no de `CURDATE()`. → la consulta recibe las fechas como parámetros (Task 2).

---

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `services/notasDigitalesCalendario.js` | 1 | `rangoDeAviso(hoy, dias)` |
| `tests/notas-calendario.test.js` | 1 | Tests de `rangoDeAviso` |
| `services/avisosDiariosService.js` (nuevo) | 2 | Aviso a las áreas y email de cambios pendientes, con fecha inyectable |
| `controllers/notificacionesController.js` | 2 | Capa HTTP: usa el servicio con `hoyArgentina()` |
| `tests/avisos-diarios.test.js` (nuevo) | 2 | Tests con fechas fijas sobre una base de prueba |
| `tests/notificaciones.test.js` | 2 | Los tests HTTP de cambios pendientes dependen del día |
| `tests/notas-api.test.js` | 2 | Corrida diaria: forma de la respuesta y vista previa en la base de prueba |
| `public/js/correos.js`, `public/correos.html` | 3 | Texto "08:15" y versión del script |
| `README.md`, `CLAUDE.md` | 3 | Crons 8:15 y 14:00, regla de días hábiles |

---

## Task 0: Preparación y línea de base

Esta tarea no cambia código.

**Files:** ninguno versionado.

- [ ] **Step 1: Crear la rama**

```bash
git switch main && git switch -c feat/dias-habiles
```

- [ ] **Step 2: Verificar el entorno**

```bash
grep -E '^(SMTP_HOST|SMTP_PORT|RPAD_TESTS_DB_LOCAL|DB_HOST)=' .env
docker compose up -d && docker inspect -f '{{.State.Health.Status}}' rpad-db && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025/api/v1/info
ls node_modules/.bin/ >/dev/null && echo "node_modules ok" || npm ci
```

Expected: `DB_HOST=127.0.0.1`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `RPAD_TESTS_DB_LOCAL=1`; después `healthy`, `200` y `node_modules ok`.

- [ ] **Step 3: Línea de base de la suite completa**

```bash
mkdir -p .claude && npm test 2>&1 | tee .claude/linea-de-base-dias-habiles.txt | tail -12
```

Expected: el resumen final (`# pass N`, `# fail M`). Anotar N y M. Si `M > 0`, listar los tests que fallan (`grep -B1 '^not ok' .claude/linea-de-base-dias-habiles.txt`) y **avisar antes de seguir**: son fallas previas, no se arreglan en este plan. En adelante, "comparar con la línea de base" significa que el conjunto de tests que fallan no crece.

Sin commit.

---

## Task 1: `rangoDeAviso` en el calendario

**Files:**
- Modify: `services/notasDigitalesCalendario.js` (agregar una función al final)
- Test: `tests/notas-calendario.test.js` (agregar un `describe` al final)

**Interfaces:**
- Consumes: `esDiaHabil`, `proximoDiaHabil`, `sumarDias` (mismo archivo).
- Produces: `rangoDeAviso(hoy: 'AAAA-MM-DD', dias: number) → { desde: 'AAAA-MM-DD', hasta: 'AAAA-MM-DD' } | null`. `null` si `hoy` no es día hábil.

- [ ] **Step 1: Escribir los tests que fallan.** Agregar al final de `tests/notas-calendario.test.js`:

```js
describe('rangoDeAviso (spec 2026-10-15-dias-habiles-licencias-auditoria, 4.2)', () => {
  it('un día hábil seguido de otro hábil avisa solo su día + 40', () => {
    // miércoles 14/10/2026
    assert.deepEqual(cal.rangoDeAviso('2026-10-14', 40), { desde: '2026-11-23', hasta: '2026-11-23' });
  });

  it('un viernes avisa también lo del sábado y el domingo', () => {
    assert.deepEqual(cal.rangoDeAviso('2026-10-16', 40), { desde: '2026-11-25', hasta: '2026-11-27' });
  });

  it('el día antes de un feriado avisa también el del feriado', () => {
    // lunes 07/12/2026; el martes 08/12 es feriado
    assert.deepEqual(cal.rangoDeAviso('2026-12-07', 40), { desde: '2027-01-16', hasta: '2027-01-17' });
  });

  it('antes de un feriado pegado a un fin de semana avisa los cuatro días', () => {
    // jueves 24/12/2026; viernes 25 feriado, sábado y domingo
    assert.deepEqual(cal.rangoDeAviso('2026-12-24', 40), { desde: '2027-02-02', hasta: '2027-02-05' });
  });

  it('un día no hábil no avisa nada', () => {
    for (const fecha of ['2026-10-17', '2026-10-18', '2026-12-08', '2026-12-25', '2027-01-01']) {
      assert.equal(cal.rangoDeAviso(fecha, 40), null, fecha);
    }
  });

  it('los días hábiles seguidos cubren todos los vencimientos, sin huecos ni repetidos', () => {
    let anterior = null;
    for (let fecha = '2026-10-01'; fecha <= '2027-12-31'; fecha = cal.sumarDias(fecha, 1)) {
      const rango = cal.rangoDeAviso(fecha, 40);
      if (!rango) continue;
      assert.ok(rango.desde <= rango.hasta, fecha);
      if (anterior) assert.equal(rango.desde, cal.sumarDias(anterior.hasta, 1), `${fecha} sigue a ${anterior.hasta}`);
      anterior = rango;
    }
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/notas-calendario.test.js`
Expected: FAIL en los 6 tests nuevos con `cal.rangoDeAviso is not a function`.

- [ ] **Step 3: Implementar.** Agregar al final de `services/notasDigitalesCalendario.js`:

```js
// Vencimientos que avisa hoy un aviso que sale `dias` días antes y solo en días hábiles (spec
// 2026-10-15-dias-habiles-licencias-auditoria, 4.2): desde hoy + dias hasta el día anterior a (siguiente día hábil + dias).
// Así cada día hábil avisa también lo que habría caído en los días no hábiles que siguen: se anticipa, nunca se atrasa.
// null si hoy no es día hábil.
export const rangoDeAviso = (hoy, dias) => {
  if (!esDiaHabil(hoy)) return null;
  const siguiente = proximoDiaHabil(sumarDias(hoy, 1));
  return { desde: sumarDias(hoy, dias), hasta: sumarDias(siguiente, dias - 1) };
};
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `node --test tests/notas-calendario.test.js`
Expected: PASS, todos.

- [ ] **Step 5: Suite completa y comparación con la línea de base**

Run: `npm test 2>&1 | tail -12`
Expected: el mismo conjunto de fallas que la línea de base (ninguna nueva) y 6 tests más en verde.

- [ ] **Step 6: Commit**

```bash
git add services/notasDigitalesCalendario.js tests/notas-calendario.test.js
git commit -m "feat: rango de vencimientos que avisa un día hábil, con los de los días no hábiles que siguen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Servicio de avisos diarios con fecha inyectable

**Files:**
- Create: `services/avisosDiariosService.js`
- Modify: `controllers/notificacionesController.js`
- Create: `tests/avisos-diarios.test.js`
- Modify: `tests/notificaciones.test.js`
- Modify: `tests/notas-api.test.js`

**Interfaces:**
- Consumes: `rangoDeAviso`, `esDiaHabil`, `proximoDiaHabil`, `hoyArgentina` (`services/notasDigitalesCalendario.js`); `sendEmail`, `sendEmailToArea` (`services/emailService.js`); `areaAviso40dias`, `cambiosPendientesTemplate` (`services/emailTemplates.js`).
- Produces (las usa la entrega 3, que reemplaza el email de cambios pendientes):
  - `DIAS_AVISO_AREAS = 40`
  - `datasetsExternosPorArea(fecha) → Promise<Array<area con datasets>>` (vacío si `fecha` no es día hábil)
  - `enviarAvisoAreas({ hoy }) → Promise<{ dia_habil, enviados: [], errores: [], sin_datasets: boolean }>`
  - `cambiosPendientesParaAdmin(adminId) → Promise<Array>`
  - `enviarCambiosPendientes({ hoy }) → Promise<{ fecha, dia_habil, enviados: [], sinPendientes: [], errores: [] }>`

- [ ] **Step 1: Escribir los tests que fallan.** Crear `tests/avisos-diarios.test.js`:

```js
// Avisos diarios que no son Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, sección 4):
// aviso a las áreas y email de cambios pendientes, con fechas fijas sobre una base de prueba + Mailpit
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { crearBaseDePrueba, cerrarDb, query, mailpit } from './helpers.js';
import { crearArea, crearDataset, asegurarBaseDePrueba } from './notas-fixtures.js';

let base, servicio, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_avisos_diarios');
  process.env.DB_NAME = base.nombre;
  process.env.EMAIL_SOLO_A = '';
  servicio = await import('../services/avisosDiariosService.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(async () => {
  await asegurarBaseDePrueba();
  await query('DELETE FROM cambios_pendientes');
  await query('DELETE FROM notificaciones_log');
  await query('DELETE FROM datasets');
  await query('DELETE FROM areas');
  await query('DELETE FROM usuarios');
  await mailpit.vaciar();
});

const sufijo = () => crypto.randomBytes(3).toString('hex');
const para = (mensajes, email) => mensajes.filter(m => m.To.some(t => t.Address === email));

const crearUsuario = async (rol) => {
  const username = `t_${rol}_${sufijo()}`;
  const email = `${username}@rpad.test`;
  const resultado = await query(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, 'x', ?, ?, ?, 1)`,
    [username, `Prueba ${rol}`, email, rol]
  );
  return { id: resultado.insertId, username, email };
};

const proponerCambio = (usuarioId, titulo) => query(
  "INSERT INTO cambios_pendientes (tipo_cambio, dataset_id, datos_nuevos, usuario_id) VALUES ('crear', NULL, ?, ?)",
  [JSON.stringify({ titulo }), usuarioId]
);

describe('aviso a las áreas (spec 4.2)', () => {
  const prepararArea = async () => {
    const email = `area_${sufijo()}@rpad.test`;
    const areaId = await crearArea({ email_principal: email });
    return { areaId, email };
  };

  it('un viernes avisa también lo que vence el sábado y el domingo + 40', async () => {
    const { areaId, email } = await prepararArea();
    // viernes 16/10/2026: avisa los vencimientos del 25 al 27/11/2026
    for (const vencimiento of ['2026-11-25', '2026-11-26', '2026-11-27']) {
      await crearDataset({ gestion: 'externa', vencimiento, areaId, titulo: `Vence ${vencimiento}` });
    }
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-28', areaId, titulo: 'Vence el lunes' });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.equal(resultado.enviados.length, 1);
    assert.equal(resultado.enviados[0].cantidad, 3);
    const mensajes = para(await mailpit.esperar(m => m.To.some(t => t.Address === email)), email);
    assert.equal(mensajes.length, 1);
    const [log] = await query("SELECT datasets_ids, success FROM notificaciones_log WHERE tipo = 'area-aviso-40'");
    assert.equal(log.datasets_ids.split(',').length, 3);
    assert.equal(Number(log.success), 1);
  });

  it('un sábado no envía nada', async () => {
    const { areaId, email } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });

    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-17' });

    assert.deepEqual(resultado, { dia_habil: false, enviados: [], errores: [], sin_datasets: true });
    assert.equal(para(await mailpit.mensajes(), email).length, 0);
    assert.equal((await query('SELECT COUNT(*) AS n FROM notificaciones_log'))[0].n, 0);
  });

  it('un jueves común no avisa lo que vence el sábado + 40', async () => {
    const { areaId } = await prepararArea();
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-26', areaId });
    const resultado = await servicio.enviarAvisoAreas({ hoy: '2026-10-15' });
    assert.equal(resultado.enviados.length, 0);
    assert.equal(resultado.sin_datasets, true);
  });

  it('la gestión interna y las áreas sin email quedan afuera, como antes', async () => {
    const { areaId } = await prepararArea();
    const sinEmail = await crearArea();
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-25', areaId });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-25', areaId: sinEmail });
    assert.deepEqual(await servicio.datasetsExternosPorArea('2026-10-16'), []);
  });
});

describe('email de cambios pendientes (spec 4.1)', () => {
  it('en un día hábil le llega al otro admin y no al que propuso', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio de prueba en día hábil');

    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-16' });

    assert.equal(resultado.dia_habil, true);
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
    assert.equal(para(await mailpit.esperar(m => m.To.some(t => t.Address === b.email)), b.email).length, 1);
    assert.equal(para(await mailpit.mensajes(), a.email).length, 0);
  });

  for (const [fecha, descripcion] of [['2026-10-17', 'sábado'], ['2026-10-18', 'domingo'], ['2026-12-08', 'feriado fijo']]) {
    it(`un ${descripcion} no envía nada`, async () => {
      const a = await crearUsuario('admin');
      const b = await crearUsuario('admin');
      await proponerCambio(a.id, 'Cambio de prueba en día no hábil');

      const resultado = await servicio.enviarCambiosPendientes({ hoy: fecha });

      assert.equal(resultado.dia_habil, false);
      assert.deepEqual(resultado.enviados, []);
      assert.deepEqual(resultado.errores, []);
      assert.equal(para(await mailpit.mensajes(), b.email).length, 0);
    });
  }

  it('un feriado trasladable es día hábil: el email sale', async () => {
    const a = await crearUsuario('admin');
    const b = await crearUsuario('admin');
    await proponerCambio(a.id, 'Cambio en feriado trasladable');
    // lunes 12/10/2026 (Día del Respeto a la Diversidad Cultural, trasladable)
    const resultado = await servicio.enviarCambiosPendientes({ hoy: '2026-10-12' });
    assert.deepEqual(resultado.enviados.map(e => e.email), [b.email]);
  });
});
```

Agregar en `tests/notificaciones.test.js`, debajo de los imports existentes:

```js
import { esDiaHabil, hoyArgentina } from '../services/notasDigitalesCalendario.js';

// El cron usa la fecha real: los tests de envío corren solo en días hábiles (los de fechas fijas están en
// tests/avisos-diarios.test.js) y el de día no hábil, solo los fines de semana y feriados
const HOY_ES_HABIL = esDiaHabil(hoyArgentina());
const SOLO_HABIL = { skip: HOY_ES_HABIL ? false : 'hoy no es día hábil: lo cubre tests/avisos-diarios.test.js' };
const SOLO_NO_HABIL = { skip: HOY_ES_HABIL ? 'hoy es día hábil: lo cubre tests/avisos-diarios.test.js' : false };
```

En el `describe('email de cambios pendientes', …)` existente, pasar `SOLO_HABIL` como segundo argumento de los dos `it` que ya están (sin tocar su cuerpo):

```js
  it('le llega al otro admin con el cambio propuesto, y no al que lo propuso', SOLO_HABIL, async () => {
```

```js
  it('no le llega a un admin con la invitación pendiente: todavía no puede ingresar ni aprobar', SOLO_HABIL, async () => {
```

Y agregar al final de ese mismo `describe`:

```js
  it('en un día no hábil el cron responde 200 sin enviar nada', SOLO_NO_HABIL, async () => {
    await mailpit.vaciar();
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Hoy no es día hábil: no se envían recordatorios.');
    assert.equal(res.body.data.dia_habil, false);
    assert.deepEqual(res.body.data.enviados, []);
  });
```

**`tests/notas-api.test.js`** (servidor real contra su propia base de prueba; la corrida diaria **no** se prueba contra la copia local de producción, que tiene el envío automático activo y generaría notas numeradas):

(a) En el `describe('corrida diaria', …)`, el test `'un error en el aviso a las áreas no saltea las Notas Digitales, que dejan registrada la corrida'` hoy dice "Vale cualquier día". Desde esta entrega, en un día no hábil el aviso a las áreas no consulta la base, así que la columna renombrada no produce el error que el test busca. Cambiar su comentario y su encabezado, sin tocar el resto del cuerpo:

```js
  // Solo en días hábiles: en un día no hábil el aviso a las áreas no consulta la base (spec 2026-10-15, 4.2)
  it('un error en el aviso a las áreas no saltea las Notas Digitales, que dejan registrada la corrida', async (t) => {
    if (!esDiaHabil(hoy)) return t.skip('hoy no es día hábil');
```

(b) Agregar al final de ese mismo `describe('corrida diaria', …)`:

```js
  // Vale cualquier día: la base de prueba está vacía y no se genera ninguna nota
  it('la respuesta conserva sus campos y suma dia_habil (spec 2026-10-15, 4.2)', async () => {
    const res = await api.get('/cron/notificaciones', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const campo of ['fecha', 'enviados', 'errores', 'sinDatasets', 'notasDigitales', 'dia_habil']) {
      assert.ok(campo in res.body.data, `falta ${campo}`);
    }
    assert.equal(res.body.data.dia_habil, esDiaHabil(hoy));
    assert.deepEqual(res.body.data.sinDatasets, ['area-aviso-40']);
  });
```

(c) En el `describe('aviso a las áreas', …)`, agregar:

```js
  it('la vista previa responde cualquier día: usa la selección del próximo día hábil o el ejemplo', async () => {
    const res = await api.get('/notificaciones/preview/area-aviso-40', comoAdmin());
    assert.equal(res.status, 200);
    assert.match(res.body, /Dirección de Ejemplo/);
  });
```

(La base de prueba no tiene datasets externos: la vista previa tiene que caer en el área de ejemplo, también un sábado.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `node --test tests/avisos-diarios.test.js`
Expected: FAIL: `Cannot find module '../services/avisosDiariosService.js'`.

Run: `node --test tests/notificaciones.test.js tests/notas-api.test.js`
Expected: FAIL en `la respuesta conserva sus campos y suma dia_habil` (falta `dia_habil`). En un día hábil, el de día no hábil de `notificaciones.test.js` aparece como `# SKIP`; en un día no hábil, FAIL también en `en un día no hábil el cron responde 200 sin enviar nada`, y los dos de envío y el del error en el aviso a las áreas aparecen como `# SKIP`.

- [ ] **Step 3: Crear el servicio** `services/avisosDiariosService.js`. La consulta, el agrupado y el registro en `notificaciones_log` son los de hoy (`controllers/notificacionesController.js:12-100` y `:102-150`), con dos cambios: el rango de fechas sale de `rangoDeAviso` y la fecha llega como parámetro.

```js
// Avisos diarios por email que no son Notas Digitales: el aviso directo a las áreas (40 días antes) y el email de
// cambios pendientes a los administradores. Salen solo en días hábiles y la fecha se recibe como parámetro, para
// poder probarlos con cualquier día.
// Spec: docs/superpowers/specs/2026-10-15-dias-habiles-licencias-auditoria-design.md (sección 4)
import pool from '../config/database.js';
import { sendEmail, sendEmailToArea } from './emailService.js';
import * as templates from './emailTemplates.js';
import { esDiaHabil, rangoDeAviso } from './notasDigitalesCalendario.js';

export const DIAS_AVISO_AREAS = 40;

/**
 * Datasets externos que avisa en esa fecha el aviso a las áreas, agrupados por área (solo áreas con email).
 * Un día hábil avisa los vencimientos de fecha + 40 y los de los días no hábiles que siguen (spec 4.2).
 * Fuera de un día hábil no hay nada que avisar.
 */
export const datasetsExternosPorArea = async (fecha) => {
  const rango = rangoDeAviso(fecha, DIAS_AVISO_AREAS);
  if (!rango) return [];
  const [rows] = await pool.execute(
    `SELECT d.id, d.titulo, d.url_dataset, d.proxima_actualizacion, d.area_id,
            f.nombre AS frecuencia_nombre,
            a.nombre AS area_nombre, a.area_superior, a.email_principal, a.email_secundario,
            a.telefono_area, a.celular_area, a.nombre_contacto, a.telefono_contacto, a.email_contacto
     FROM datasets d
     JOIN frecuencias f ON d.frecuencia_id = f.id
     JOIN areas a ON d.area_id = a.id
     WHERE d.activo = TRUE
       AND d.tipo_gestion = 'externa'
       AND d.proxima_actualizacion BETWEEN ? AND ?
       AND f.dias IS NOT NULL
       AND (a.email_principal IS NOT NULL OR a.email_secundario IS NOT NULL)
     ORDER BY a.nombre ASC, d.titulo ASC`,
    [rango.desde, rango.hasta]
  );

  // Agrupar por área
  const porArea = {};
  rows.forEach(d => {
    if (!porArea[d.area_id]) {
      porArea[d.area_id] = {
        area_id: d.area_id,
        area_nombre: d.area_nombre,
        area_superior: d.area_superior,
        email_principal: d.email_principal,
        email_secundario: d.email_secundario,
        telefono_area: d.telefono_area,
        celular_area: d.celular_area,
        nombre_contacto: d.nombre_contacto,
        telefono_contacto: d.telefono_contacto,
        email_contacto: d.email_contacto,
        datasets: []
      };
    }
    porArea[d.area_id].datasets.push({
      id: d.id,
      titulo: d.titulo,
      url_dataset: d.url_dataset,
      proxima_actualizacion: d.proxima_actualizacion,
      frecuencia_nombre: d.frecuencia_nombre
    });
  });

  return Object.values(porArea);
};

// Registra una notificación en el log de la BD (un error acá no corta el envío)
const logNotificacion = async (tipo, areaId, destinatarios, datasetsIds, success, errorMessage = null) => {
  try {
    await pool.execute(
      `INSERT INTO notificaciones_log (tipo, area_id, destinatarios, datasets_ids, cantidad_datasets, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo, areaId, destinatarios, datasetsIds.join(','), datasetsIds.length, success ? 1 : 0, errorMessage]
    );
  } catch (error) {
    console.error('Error guardando log de notificación:', error);
  }
};

/**
 * Aviso directo a las áreas de gestión externa (spec 4.2). Devuelve qué se envió:
 * { dia_habil, enviados: [{ tipo, area, cantidad }], errores: [{ tipo, area, error }], sin_datasets }
 */
export const enviarAvisoAreas = async ({ hoy }) => {
  const resultado = { dia_habil: esDiaHabil(hoy), enviados: [], errores: [], sin_datasets: true };
  if (!resultado.dia_habil) return resultado;

  const areas = await datasetsExternosPorArea(hoy);
  resultado.sin_datasets = areas.length === 0;
  for (const areaData of areas) {
    const { subject, html } = templates.areaAviso40dias(areaData);
    const destinatarios = [areaData.email_principal, areaData.email_secundario].filter(Boolean);
    const envio = await sendEmailToArea({ subject, html, to: destinatarios });
    const datasetsIds = areaData.datasets.map(d => d.id);
    await logNotificacion('area-aviso-40', areaData.area_id, destinatarios.join(','), datasetsIds, envio.success, envio.error);
    if (envio.success) {
      resultado.enviados.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, cantidad: areaData.datasets.length });
    } else {
      resultado.errores.push({ tipo: 'area-aviso-40', area: areaData.area_nombre, error: envio.error });
    }
  }
  return resultado;
};

/**
 * Cambios pendientes que puede revisar un admin (excluye los propios)
 * @param {number} adminId - ID del admin que va a revisar
 */
export const cambiosPendientesParaAdmin = async (adminId) => {
  const [rows] = await pool.execute(
    `SELECT
       cp.id,
       cp.tipo_cambio,
       cp.dataset_id,
       cp.datos_nuevos,
       cp.usuario_id,
       cp.created_at,
       d.titulo AS dataset_titulo,
       u.username AS usuario_username,
       u.nombre_completo AS usuario_nombre,
       CASE
         WHEN TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()) < 60 THEN CONCAT('Hace ', TIMESTAMPDIFF(MINUTE, cp.created_at, NOW()), ' minutos')
         WHEN TIMESTAMPDIFF(HOUR, cp.created_at, NOW()) < 24 THEN CONCAT('Hace ', TIMESTAMPDIFF(HOUR, cp.created_at, NOW()), ' horas')
         ELSE CONCAT('Hace ', TIMESTAMPDIFF(DAY, cp.created_at, NOW()), ' dias')
       END AS tiempo_pendiente
     FROM cambios_pendientes cp
     JOIN usuarios u ON cp.usuario_id = u.id
     LEFT JOIN datasets d ON cp.dataset_id = d.id
     WHERE cp.estado = 'pendiente'
       AND cp.usuario_id != ?
     ORDER BY cp.created_at ASC`,
    [adminId]
  );

  // Parsear datos_nuevos JSON
  return rows.map(row => ({
    ...row,
    datos_nuevos: typeof row.datos_nuevos === 'string' ? JSON.parse(row.datos_nuevos) : row.datos_nuevos
  }));
};

// Admins activos con email que ya pueden ingresar y aprobar (con contraseña definida)
const adminsConEmail = async () => {
  const [rows] = await pool.execute(
    `SELECT id, username, nombre_completo, email
     FROM usuarios
     WHERE rol IN ('admin', 'superadmin') AND activo = TRUE AND email IS NOT NULL AND password_hash IS NOT NULL`
  );
  return rows;
};

/**
 * Email de cambios pendientes (spec 4.1): a cada admin, los cambios que puede revisar. Solo en días hábiles.
 * { fecha, dia_habil, enviados: [{ admin, email, cantidadPendientes }], sinPendientes: [username], errores: [{ admin, error }] }
 */
export const enviarCambiosPendientes = async ({ hoy }) => {
  const resultados = { fecha: new Date().toISOString(), dia_habil: esDiaHabil(hoy), enviados: [], sinPendientes: [], errores: [] };
  if (!resultados.dia_habil) return resultados;

  for (const admin of await adminsConEmail()) {
    const cambiosPendientes = await cambiosPendientesParaAdmin(admin.id);
    if (cambiosPendientes.length === 0) {
      resultados.sinPendientes.push(admin.username);
      continue;
    }
    const { subject, html } = templates.cambiosPendientesTemplate(cambiosPendientes);
    const envio = await sendEmail({ subject, html, to: [admin.email] });
    if (envio.success) {
      resultados.enviados.push({ admin: admin.username, email: admin.email, cantidadPendientes: cambiosPendientes.length });
    } else {
      resultados.errores.push({ admin: admin.username, error: envio.error });
    }
  }
  return resultados;
};
```

- [ ] **Step 4: Usar el servicio desde el controlador** `controllers/notificacionesController.js`.

(a) Imports: reemplazar las líneas 1-6 por:

```js
import { sendEmailToArea, verifyConnection, listaDeCorreos } from '../services/emailService.js';
import * as templates from '../services/emailTemplates.js';
import { ejecutarNotasDigitales } from '../services/notasDigitales.js';
import { obtenerConfig } from '../services/notasDigitalesDatos.js';
import { hoyArgentina, proximoDiaHabil } from '../services/notasDigitalesCalendario.js';
import {
  datasetsExternosPorArea, enviarAvisoAreas, cambiosPendientesParaAdmin, enviarCambiosPendientes
} from '../services/avisosDiariosService.js';
```

(Se va el import de `pool`: el controlador ya no consulta la base directamente. Verificar con `grep -n "pool" controllers/notificacionesController.js` que no quede ningún uso.)

(b) Borrar `getDatasetsExternosPorArea` (líneas 8-59), `logNotificacion` (79-100), `getCambiosPendientesParaAdmin` (102-138) y `getAdminsConEmail` (140-150). `AREA_DE_EJEMPLO` (61-77) se queda.

(c) Agregar, después de `AREA_DE_EJEMPLO`:

```js
// La vista previa y la prueba del aviso a las áreas muestran lo que saldría en la próxima corrida posible (hoy, si es
// día hábil): un sábado, lo del lunes en lugar de nada
const fechaDelProximoAviso = () => proximoDiaHabil(hoyArgentina());
```

(d) Reemplazar `ejecutarNotificacionesDiarias` por:

```js
/**
 * Proceso diario (cron de las 8:15): aviso directo a las áreas y Notas Digitales
 */
export const ejecutarNotificacionesDiarias = async (req, res) => {
  const hoy = hoyArgentina();
  const resultados = { fecha: new Date().toISOString(), enviados: [], errores: [], sinDatasets: [], notasDigitales: null, dia_habil: null };

  try {
    // Aviso directo a las áreas de gestión externa (40 días antes, solo en días hábiles). Va aislado: un error acá
    // no saltea las Notas Digitales
    try {
      const aviso = await enviarAvisoAreas({ hoy });
      resultados.dia_habil = aviso.dia_habil;
      resultados.enviados.push(...aviso.enviados);
      resultados.errores.push(...aviso.errores);
      if (aviso.sin_datasets) resultados.sinDatasets.push('area-aviso-40');
    } catch (error) {
      console.error('Error en el aviso a las áreas:', error);
      resultados.errores.push({ tipo: 'area-aviso-40', error: 'Error ejecutando el aviso a las áreas' });
    }

    // Notas Digitales (reemplazan los avisos de gestión interna y externa). Deciden solas si hoy es día hábil.
    // creado_por: el admin que pidió la corrida; el cron no tiene req.user y queda en NULL
    try {
      resultados.notasDigitales = await ejecutarNotasDigitales({ hoy, usuarioId: req.user?.userId ?? null });
      if (resultados.notasDigitales.fallidas > 0) {
        resultados.errores.push({ tipo: 'notas-digitales', error: `${resultados.notasDigitales.fallidas} nota(s) no se pudieron enviar` });
      }
      // Pasos que fallaron con una excepción: también quedan en la última corrida que muestra Correos > Estado
      for (const fallo of resultados.notasDigitales.errores ?? []) {
        resultados.errores.push({ tipo: 'notas-digitales', paso: fallo.tipo, gestion: fallo.gestion, id: fallo.id, error: fallo.mensaje });
      }
    } catch (error) {
      console.error('Error en Notas Digitales:', error);
      resultados.errores.push({ tipo: 'notas-digitales', error: 'Error ejecutando Notas Digitales' });
    }

    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success ? 'Proceso completado.' : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });
  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).json({ success: false, error: 'Error ejecutando notificaciones' });
  }
};
```

Si `enviarAvisoAreas` lanza una excepción, `dia_habil` queda en `null`: en ese caso se completa con el calendario para que el campo siempre tenga un booleano. Agregar justo después del `catch` del aviso a las áreas:

```js
    resultados.dia_habil ??= esDiaHabil(hoy);
```

y sumar `esDiaHabil` al import del calendario: `import { hoyArgentina, proximoDiaHabil, esDiaHabil } from '../services/notasDigitalesCalendario.js';`.

(e) En `pruebaAvisoArea` y en `previewEmail`, reemplazar `await getDatasetsExternosPorArea(40)` por `await datasetsExternosPorArea(fechaDelProximoAviso())` (son dos líneas: hoy en las líneas 217 y 254).

(f) Reemplazar `ejecutarNotificacionCambiosPendientes` por:

```js
/**
 * Ejecuta notificación de cambios pendientes
 * Llamado por cron (14:00); solo envía en días hábiles (spec 4.1)
 * Envía email a cada admin con los cambios que puede revisar (excluye los propios)
 */
export const ejecutarNotificacionCambiosPendientes = async (req, res) => {
  try {
    const resultados = await enviarCambiosPendientes({ hoy: hoyArgentina() });
    if (!resultados.dia_habil) {
      return res.json({ success: true, message: 'Hoy no es día hábil: no se envían recordatorios.', data: resultados });
    }
    const success = resultados.errores.length === 0;
    res.status(success ? 200 : 207).json({
      success,
      message: success
        ? `Notificaciones enviadas a ${resultados.enviados.length} admins.`
        : `Proceso completado con ${resultados.errores.length} errores.`,
      data: resultados
    });
  } catch (error) {
    console.error('Error en notificación de cambios pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando notificación de cambios pendientes',
      details: error.message
    });
  }
};
```

(g) En `previewCambiosPendientes`, reemplazar `await getCambiosPendientesParaAdmin(userId)` por `await cambiosPendientesParaAdmin(userId)`. El resto de la función no cambia.

- [ ] **Step 5: Correr los tests de la tarea**

Run: `node --test tests/avisos-diarios.test.js tests/notificaciones.test.js tests/notas-api.test.js`
Expected: PASS. Según el día, aparecen como `# SKIP` los de envío y el del error en el aviso a las áreas (día no hábil) o el de día no hábil (día hábil).

- [ ] **Step 6: Suite completa y comparación con la línea de base**

Run: `npm test 2>&1 | tail -12`
Expected: ninguna falla nueva respecto de la línea de base.

- [ ] **Step 7: Commit**

```bash
git add services/avisosDiariosService.js controllers/notificacionesController.js tests/avisos-diarios.test.js tests/notificaciones.test.js tests/notas-api.test.js
git commit -m "feat: el aviso a las áreas y el email de cambios pendientes salen solo en días hábiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Textos, crons y documentación

**Files:**
- Modify: `public/js/correos.js:145`
- Modify: `public/correos.html:540`
- Modify: `README.md` (sección "Configurar Cron Job" y la línea 227)
- Modify: `CLAUDE.md` (sección "Arquitectura clave")

- [ ] **Step 1: Texto del interruptor.** En `public/js/correos.js`, reemplazar `(08:00)` por `(08:15)` en el `confirm` de `cambiarEnvioAutomatico`, de modo que el texto quede exactamente:

```js
  if (activar && !confirm('¿Activar el envío automático? Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.')) {
```

- [ ] **Step 2: Versión del script** en `public/correos.html`: `js/correos.js?v=20261019` → `js/correos.js?v=20261020`.

- [ ] **Step 3: README.**

(a) Línea 227: `la corrida de las 08:00 sin errores` → `la corrida de las 08:15 sin errores`.

(b) Reemplazar la sección `## Configurar Cron Job (Notificaciones automáticas)` completa (desde ese título hasta el `---` anterior a `## API Endpoints`) por:

```markdown
## Configurar Cron Job (Notificaciones automáticas)

### 1. Verificar que funciona manualmente

```
https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET
https://tu-dominio.com/api/cron/cambios-pendientes?secret=TU_CRON_SECRET
```

### 2. Configurar en cPanel → Tareas Cron

| Minuto | Hora | Día | Mes | Día semana | Comando |
|--------|------|-----|-----|------------|---------|
| 15 | 8 | * | * | * | `curl -s "https://tu-dominio.com/api/cron/notificaciones?secret=TU_CRON_SECRET" > /dev/null` |
| 0 | 14 | * | * | * | `curl -s "https://tu-dominio.com/api/cron/cambios-pendientes?secret=TU_CRON_SECRET" > /dev/null` |

Los dos corren todos los días: cPanel no conoce los feriados y el sistema decide. **Todos los recordatorios automáticos salen solo en días hábiles**: de lunes a viernes, sin los feriados nacionales de fecha fija (01/01, 24/03, 02/04, 01/05, 25/05, 20/06, 09/07, 08/12 y 25/12). Los feriados trasladables cuentan como hábiles.

El de las **8:15** envía el aviso directo a las áreas y las **Notas Digitales**:

- **Aviso a las áreas**: email a las áreas de gestión externa 40 días antes del vencimiento. Cada día hábil avisa también lo que vence 40 días después de los días no hábiles que siguen (un viernes avisa lo del viernes, el sábado y el domingo): se anticipa, nunca se atrasa.
- **Aviso**: gestión interna 60 días antes del vencimiento y gestión externa 30 días antes, junto con los demás datasets de esa gestión que vencen el mismo mes. Informa **solo datasets a vencer** (todavía no vencidos) y se envía con dos PDF: la nota y el **anexo** (una hoja A4 por dataset).
- **Reiteración**: primer día hábil de cada mes, para los datasets avisados hace 20 días o más que siguen pendientes y para los vencidos que nunca tuvieron aviso (con "Sin aviso previo"). Lleva solo el PDF de la nota, sin anexo.
- Cada nota se numera (`Nota Digital N° 12/26`), se envía con su PDF adjunto (el aviso, también con el anexo) y queda en el libro de la pantalla de Correos, donde se descargan ambos PDF (botones "PDF" y "Anexo").
- La salida del cron se descarta (`> /dev/null`): el resultado de cada corrida queda en Correos → Estado ("Última corrida diaria"), con una alerta si terminó con errores, si se interrumpió o si el cron dejó de llamar.
- El envío automático arranca **desactivado**: se activa desde Correos cuando la configuración (destinatarios y firma) está completa.

El de las **14:00** envía a cada administrador el email con los cambios pendientes de aprobación que puede revisar (nunca los propios).

```

- [ ] **Step 4: CLAUDE.md.** En `## Arquitectura clave`, después del bloque `### Estados de dataset`, agregar:

```markdown
### Recordatorios automáticos
- Salen solo en días hábiles: lunes a viernes sin los 9 feriados nacionales fijos (`esDiaHabil` en `services/notasDigitalesCalendario.js`). Hoy = `hoyArgentina()`, nunca `CURDATE()`.
- Cron 8:15 (`/api/cron/notificaciones`): aviso a las áreas (`services/avisosDiariosService.js`) y Notas Digitales (`services/notasDigitales.js`).
- Cron 14:00 (`/api/cron/cambios-pendientes`): email de cambios pendientes a los admins.
```

- [ ] **Step 5: Suite completa y comparación con la línea de base**

Run: `npm test 2>&1 | tail -12`
Expected: ninguna falla nueva.

- [ ] **Step 6: Commit**

```bash
git add public/js/correos.js public/correos.html README.md CLAUDE.md
git commit -m "docs: crons a las 8:15 y 14:00 y recordatorios solo en días hábiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Cierre (lo hace quien coordina, después de la revisión final)

- [ ] **Step 1:** Suite completa en la rama: ninguna falla nueva respecto de la línea de base.
- [ ] **Step 2:** Recorrido manual en el navegador (app local con `npm start`): Correos → Estado carga, "Aviso a las áreas" → vista previa y prueba (la prueba va a las casillas de prueba configuradas en la base local, que llegan a Mailpit).
- [ ] **Step 3:** Merge en `main` según lo que elija el usuario (superpowers:finishing-a-development-branch).
- [ ] **Step 4: Kit de despliegue** en el Escritorio, carpeta `RPAD-deploy-dias-habiles` (fuera del repo):
  - `1-archivos-rpad-dias-habiles.zip`, armado con `git archive` desde `main` con exactamente estos archivos: `controllers/notificacionesController.js`, `services/avisosDiariosService.js`, `services/notasDigitalesCalendario.js`, `public/js/correos.js`, `public/correos.html`. Verificar que son idénticos a `main` (ignorando CRLF).
  - `PASOS.txt`: (1) backup del Administrador de archivos: comprimir `controllers`, `services` y `public` dentro de `/home/datospublicos/rpad`; (2) cargar el zip en `/home/datospublicos/rpad` y extraerlo ahí mismo; (3) Setup Node.js App → Restart (no hace falta Run NPM Install ni migración); (4) Tareas Cron: el de `notificaciones` a minuto 15 hora 8, y el de `cambios-pendientes` a minuto 0 hora 14; (5) verificar: Correos → Estado sin alertas nuevas y, el primer día hábil, la corrida de las 8:15 en "Última corrida diaria". Rollback: extraer el zip del backup y Restart.
