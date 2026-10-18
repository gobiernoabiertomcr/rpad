// Selección de datasets para avisos y reiteraciones (base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb, query } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, crearArea } from './notas-fixtures.js';
import { formatoCorto, hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';
import { sumarMeses, vencimientoDelMes } from '../services/fechasDatasetReglas.js';

let base, datos, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_notas_datos');
  process.env.DB_NAME = base.nombre;
  datos = await import('../services/notasDigitalesDatos.js');
});

after(async () => {
  await (await import('../config/database.js')).default.end();
  await cerrarDb();
  // borrar() rechaza la base que está en DB_NAME: se restaura la real antes de borrar la de prueba
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

beforeEach(() => limpiarBase());

const ids = (lista) => lista.map(d => d.id);

describe('seleccionarParaAviso', () => {
  it('toma los que vencen dentro de la ventana, ordenados por vencimiento, y deja afuera los vencidos', async () => {
    const enVentana = await crearDataset({ vencimiento: '2026-12-31' });
    const justo60 = await crearDataset({ vencimiento: '2027-01-01' });
    await crearDataset({ vencimiento: '2027-02-01' }); // fuera de la ventana y de otro mes
    await crearDataset({ vencimiento: '2026-09-30' }); // vencido: va a la reiteración
    const resultado = await datos.seleccionarParaAviso('interna', '2026-11-02');
    assert.deepEqual(ids(resultado), [enVentana, justo60]);
    assert.equal(resultado[0].vencimiento, '2026-12-31');
  });

  // 40 días (pedido del usuario el 16/10/2026; antes 30): el circuito administrativo de la gestión externa es largo
  it('respeta la ventana de 40 días de la gestión externa y separa por gestión', async () => {
    const externa = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-30' });
    assert.deepEqual(await datos.seleccionarParaAviso('externa', '2026-10-20'), []);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-10-21')), [externa]);
  });

  it('excluye eventuales, inactivos y sin fecha', async () => {
    await crearDataset({ vencimiento: '2026-11-30', frecuencia: 'Eventual' });
    await crearDataset({ vencimiento: '2026-11-30', activo: 0 });
    await crearDataset({ vencimiento: null });
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2026-11-02'), []);
  });

  it('un vencimiento con la fecha cero de MariaDB (sql_mode no estricto) no entra en avisos ni en reiteraciones', async () => {
    const cero = await crearDataset({ vencimiento: '2026-11-30' });
    await query("UPDATE datasets SET proxima_actualizacion = '0000-00-00' WHERE id = ?", [cero]);
    assert.equal((await query("SELECT DATE_FORMAT(proxima_actualizacion, '%Y-%m-%d') AS v FROM datasets WHERE id = ?", [cero]))[0].v, '0000-00-00');
    // Antes salía en la reiteración como vencido sin aviso, con "Vencido hace NaN días"
    assert.deepEqual(await datos.seleccionarParaReiteracion('interna', '2026-11-02'), []);
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2026-11-02'), []);
    assert.equal(await datos.aperturaDelProximoAviso('interna', '2026-11-02'), null);
  });

  it('un aviso (aunque haya fallado) bloquea un segundo aviso del mismo vencimiento; una prueba no', async () => {
    const avisado = await crearDataset({ vencimiento: '2026-12-31' });
    const fallido = await crearDataset({ vencimiento: '2026-12-31' });
    const conPrueba = await crearDataset({ vencimiento: '2026-12-31' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id: avisado, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-02', numero: 2, estado: 'fallida', datasets: [{ id: fallido, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-02', esPrueba: 1, datasets: [{ id: conPrueba, vencimiento: '2026-12-31' }] });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-03')), [conPrueba]);
  });

  it('si cambia el vencimiento, vuelve a estar disponible para aviso', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-15' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id, vencimiento: '2026-11-30' }] });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-03')), [id]);
  });
});

describe('avisos solo a vencer (14/10/2026)', () => {
  it('el aviso no toma vencidos, aunque nunca hayan tenido aviso', async () => {
    const vencido = await crearDataset({ gestion: 'interna', vencimiento: '2026-09-30' });
    const aVencer = await crearDataset({ gestion: 'interna', vencimiento: '2026-11-30' });
    const seleccionados = ids(await datos.seleccionarParaAviso('interna', '2026-10-14'));
    assert.ok(seleccionados.includes(aVencer));
    assert.ok(!seleccionados.includes(vencido));
  });

  it('un dataset que vence hoy todavía entra en el aviso', async () => {
    const hoy = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-14' });
    assert.ok((await datos.seleccionarParaAviso('externa', '2026-10-14')).some(d => d.id === hoy));
  });

  it('un vencido del mismo mes que uno a vencer no lo arrastra al aviso: se queda para la reiteración', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2026-11-01' });
    const aVencer = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-11-02')), [aVencer]);
  });
});

describe('seleccionarParaAviso: agrupamiento por mes de vencimiento', () => {
  it('externa, 30/01 y 31/01: el 20/12 no sale nada y el 21/12 salen los dos juntos', async () => {
    const del30 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    const del31 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    assert.deepEqual(await datos.seleccionarParaAviso('externa', '2026-12-20'), []);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-12-21')), [del30, del31]);
  });

  it('interna, 29/03 y 31/03: salen los dos juntos el 28/01', async () => {
    const del29 = await crearDataset({ vencimiento: '2027-03-29' });
    const del31 = await crearDataset({ vencimiento: '2027-03-31' });
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2027-01-27'), []);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2027-01-28')), [del29, del31]);
  });

  it('interna, 15/03 y 31/03: salen los dos juntos el 14/01', async () => {
    const del15 = await crearDataset({ vencimiento: '2027-03-15' });
    const del31 = await crearDataset({ vencimiento: '2027-03-31' });
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2027-01-13'), []);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2027-01-14')), [del15, del31]);
  });

  it('no mezcla meses distintos: el día que se abre enero no entra febrero', async () => {
    const del30 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    const del31 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    const febrero = await crearDataset({ gestion: 'externa', vencimiento: '2027-02-28' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-12-21')), [del30, del31]);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2027-01-19')), [del30, del31, febrero]);
  });

  it('no mezcla gestiones: un mes abierto para la interna no abre ese mes para la externa', async () => {
    const interna15 = await crearDataset({ vencimiento: '2027-01-15' });
    const interna31 = await crearDataset({ vencimiento: '2027-01-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-16')), [interna15, interna31]);
    // El 16/12 la ventana externa llega al 25/01, donde solo vence un dataset de la interna
    assert.deepEqual(await datos.seleccionarParaAviso('externa', '2026-12-16'), []);
  });

  it('un dataset del mismo mes que otro ya avisado entra en la corrida siguiente aunque no esté en la ventana', async () => {
    const avisado = await crearDataset({ vencimiento: '2027-03-29' });
    await crearNota({ fecha: '2027-01-28', numero: 1, datasets: [{ id: avisado, vencimiento: '2027-03-29' }] });
    const nuevo = await crearDataset({ vencimiento: '2027-03-31' });
    // El 29/01 la ventana interna llega al 30/03: el 31/03 entra porque marzo ya se abrió con el 29/03
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2027-01-29')), [nuevo]);
  });
});

describe('seleccionarParaReiteracion', () => {
  it('toma los avisados hace 20 días o más que siguen con el mismo vencimiento', async () => {
    const hace29 = await crearDataset({ vencimiento: '2026-12-31' });
    const hace20 = await crearDataset({ vencimiento: '2026-12-31' });
    const hace11 = await crearDataset({ vencimiento: '2027-01-19' });
    const avisoFallido = await crearDataset({ vencimiento: '2026-11-30' });
    const actualizado = await crearDataset({ vencimiento: '2027-10-31' });
    await crearNota({ fecha: '2026-11-02', numero: 1, datasets: [{ id: hace29, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-11', numero: 2, datasets: [{ id: hace20, vencimiento: '2026-12-31' }] });
    await crearNota({ fecha: '2026-11-20', numero: 3, datasets: [{ id: hace11, vencimiento: '2027-01-19' }] });
    await crearNota({ fecha: '2026-10-01', numero: 4, estado: 'fallida', datasets: [{ id: avisoFallido, vencimiento: '2026-11-30' }] });
    await crearNota({ fecha: '2026-10-01', numero: 5, datasets: [{ id: actualizado, vencimiento: '2026-10-31' }] });

    const resultado = await datos.seleccionarParaReiteracion('interna', '2026-12-01');
    assert.deepEqual(ids(resultado).sort(), [hace29, hace20].sort());
    const primero = resultado.find(d => d.id === hace29);
    assert.deepEqual(primero.informado, { numero: 1, anio: 2026, fecha: '2026-11-02' });
    assert.equal(primero.reiteraciones, 0);
  });

  it('un aviso del 13/10/2026 entra en la reiteración del 02/11/2026 (20 días); uno del 14/10/2026 no', async () => {
    const del13 = await crearDataset({ vencimiento: '2026-12-12' });
    const del14 = await crearDataset({ vencimiento: '2026-12-13' });
    await crearNota({ fecha: '2026-10-13', numero: 1, datasets: [{ id: del13, vencimiento: '2026-12-12' }] });
    await crearNota({ fecha: '2026-10-14', numero: 2, datasets: [{ id: del14, vencimiento: '2026-12-13' }] });
    assert.deepEqual(ids(await datos.seleccionarParaReiteracion('interna', '2026-11-02')), [del13]);
  });

  it('cuenta solo las reiteraciones enviadas del mismo ciclo', async () => {
    const id = await crearDataset({ vencimiento: '2026-10-31' });
    await crearNota({ fecha: '2026-09-01', numero: 1, datasets: [{ id, vencimiento: '2026-10-31' }] });
    await crearNota({ tipo: 'reiteracion', fecha: '2026-10-01', numero: 2, datasets: [{ id, vencimiento: '2026-10-31' }] });
    await crearNota({ tipo: 'reiteracion', fecha: '2026-11-02', numero: 3, estado: 'fallida', datasets: [{ id, vencimiento: '2026-10-31', seccion: 'vencido' }] });
    const [dataset] = await datos.seleccionarParaReiteracion('interna', '2026-12-01');
    assert.equal(dataset.reiteraciones, 1);
  });

  // Aviso en su fecha con autorizado (spec 2026-10-15, 7.6): el dataset tiene dos filas de aviso en el mismo vencimiento, y
  // sin agrupar la consulta lo devolvería dos veces (y la reiteración no podría guardarlo: clave (nota_id, dataset_id))
  describe('un dataset con dos avisos (el adelantado y el de su fecha)', () => {
    const VENCE = '2027-01-31';
    const avisar = (id, fecha, numero, opciones = {}) => crearNota({
      gestion: 'externa', fecha, numero, datasets: [{ id, vencimiento: VENCE, cuentaDesde: '2026-12-22' }], ...opciones
    });

    it('da una fila por dataset, con los dos avisos en informado', async () => {
      const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
      // El de su fecha se carga primero: el orden sale de la fecha del aviso, no del orden en que se guardaron
      await avisar(id, '2026-12-22', 11);
      await avisar(id, '2026-12-09', 10);
      const filas = await datos.seleccionarParaReiteracion('externa', '2027-02-01');
      assert.equal(filas.length, 1);
      assert.equal(filas[0].id, id);
      assert.deepEqual(filas[0].informado, {
        numero: 10, anio: 2026, fecha: '2026-12-09', tambien: [{ numero: 11, anio: 2026, fecha: '2026-12-22' }]
      });
      assert.equal(filas[0].reiteraciones, 0);
      assert.ok(filas[0].pedido.texto);
    });

    it('con la misma fecha, el orden es el de la nota; solo cuentan los avisos enviados', async () => {
      const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
      await avisar(id, '2026-12-09', 10);
      await avisar(id, '2026-12-22', 11);
      await avisar(id, '2026-12-22', 12);
      await avisar(id, '2026-12-23', 13, { estado: 'fallida' });
      const [fila] = await datos.seleccionarParaReiteracion('externa', '2027-02-01');
      assert.deepEqual(fila.informado, {
        numero: 10, anio: 2026, fecha: '2026-12-09',
        tambien: [{ numero: 11, anio: 2026, fecha: '2026-12-22' }, { numero: 12, anio: 2026, fecha: '2026-12-22' }]
      });
    });

    it('mantiene el orden por vencimiento y título entre datasets, y el de un solo aviso queda sin "tambien"', async () => {
      const doble = await crearDataset({ titulo: 'A doble', gestion: 'externa', vencimiento: VENCE });
      const simple = await crearDataset({ titulo: 'B simple', gestion: 'externa', vencimiento: VENCE });
      const anterior = await crearDataset({ titulo: 'C doble anterior', gestion: 'externa', vencimiento: '2027-01-30' });
      await avisar(doble, '2026-12-09', 10);
      await avisar(simple, '2026-12-09', 14);
      await avisar(doble, '2026-12-22', 11);
      await crearNota({ gestion: 'externa', fecha: '2026-12-09', numero: 12, datasets: [{ id: anterior, vencimiento: '2027-01-30' }] });
      await crearNota({ gestion: 'externa', fecha: '2026-12-22', numero: 13, datasets: [{ id: anterior, vencimiento: '2027-01-30' }] });

      const filas = await datos.seleccionarParaReiteracion('externa', '2027-02-01');
      assert.deepEqual(ids(filas), [anterior, doble, simple]);
      assert.deepEqual(filas[2].informado, { numero: 14, anio: 2026, fecha: '2026-12-09' });
      assert.equal('tambien' in filas[2].informado, false);
      assert.deepEqual(filas[1].informado.tambien, [{ numero: 11, anio: 2026, fecha: '2026-12-22' }]);
      assert.deepEqual(filas[0].informado.tambien, [{ numero: 13, anio: 2026, fecha: '2026-12-22' }]);
    });

    it('un aviso de otro vencimiento (el ciclo anterior) no se suma', async () => {
      const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
      await crearNota({ gestion: 'externa', fecha: '2026-01-05', numero: 1, datasets: [{ id, vencimiento: '2026-01-31' }] });
      await avisar(id, '2026-12-09', 10);
      const [fila] = await datos.seleccionarParaReiteracion('externa', '2027-02-01');
      assert.deepEqual(fila.informado, { numero: 10, anio: 2026, fecha: '2026-12-09' });
    });
  });
});

// Aviso en su fecha con autorizado (spec 2026-10-15, 7.6): los datasets que se avisaron por adelantado en la víspera de la
// licencia del titular y todavía no tuvieron su aviso en su fecha. Lo que decide si sale hoy (día <= hoy) lo hacen la
// corrida y el Estado: esta selección no filtra por hoy.
describe('pendientesEnSuFecha', () => {
  const LICENCIA = { desde: '2026-12-10', hasta: '2027-01-08' };
  const HOY = '2026-12-22';
  const VENCE = '2027-01-31';
  // Un aviso por dataset: cada nota lleva un número propio (único por año), salvo que el test pida uno
  let numeroSiguiente = 100;
  const adelantar = (id, { fecha = '2026-12-09', numero = numeroSiguiente++, cuentaDesde = '2026-12-22', vencimiento = VENCE, ...opciones } = {}) => crearNota({
    gestion: 'externa', fecha, numero: opciones.esPrueba ? null : numero, datasets: [{ id, vencimiento, cuentaDesde }], ...opciones
  });
  const pendientes = (ausencias = [], gestion = 'externa') => datos.pendientesEnSuFecha(gestion, HOY, LICENCIA, ausencias);

  it('devuelve el dataset adelantado con su nota, su cuenta_desde y su día', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(id, { numero: 10 });
    const filas = await pendientes();
    assert.equal(filas.length, 1);
    assert.equal(filas[0].id, id);
    assert.equal(filas[0].vencimiento, VENCE);
    assert.equal(filas[0].cuenta_desde, '2026-12-22');
    assert.equal(filas[0].dia_en_su_fecha, '2026-12-22');
    assert.deepEqual(filas[0].adelantado, { numero: 10, anio: 2026, fecha: '2026-12-09' });
    assert.ok(filas[0].pedido.texto);
  });

  it('no devuelve el que ya tuvo su aviso en su fecha (otra fila de aviso del mismo vencimiento, de cualquier estado)', async () => {
    const enviado = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    const fallido = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    const enPrueba = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(enviado);
    await adelantar(enviado, { fecha: '2026-12-22' });
    await adelantar(fallido);
    await adelantar(fallido, { fecha: '2026-12-22', estado: 'fallida' });
    await adelantar(enPrueba);
    await adelantar(enPrueba, { fecha: '2026-12-22', esPrueba: 1 }); // una prueba no cuenta
    assert.deepEqual(ids(await pendientes()), [enPrueba]);
  });

  // El conteo de "una sola fila de aviso" es por vencimiento: la historia de un dataset (avisos de ciclos anteriores) no lo saca.
  // Si el conteo perdiera ese filtro, ningún dataset con historia tendría aviso en su fecha
  it('un aviso de un ciclo anterior no cuenta: el dataset con historia entra con el aviso adelantado del vencimiento actual', async () => {
    const conHistoria = await crearDataset({ titulo: 'A con historia', gestion: 'externa', vencimiento: VENCE });
    const sinHistoria = await crearDataset({ titulo: 'B sin historia', gestion: 'externa', vencimiento: VENCE });
    // El aviso del ciclo anterior (vencía el 31/01/2026), enviado en su fecha normal, sin cuenta_desde
    await adelantar(conHistoria, { fecha: '2025-12-22', vencimiento: '2026-01-31', cuentaDesde: null });
    await adelantar(conHistoria);
    await adelantar(sinHistoria);
    const filas = await pendientes();
    assert.deepEqual(ids(filas), [conHistoria, sinHistoria]);
    // El adelantado es el del vencimiento actual, no el del ciclo anterior
    assert.deepEqual(filas[0].adelantado, { numero: filas[0].adelantado.numero, anio: 2026, fecha: '2026-12-09' });
    assert.equal(filas[0].cuenta_desde, '2026-12-22');
    // Y si el del ciclo actual ya tuvo su aviso en su fecha, deja de entrar aunque tenga historia
    await adelantar(conHistoria, { fecha: '2026-12-22' });
    assert.deepEqual(ids(await pendientes()), [sinHistoria]);
  });

  it('el aviso adelantado cuenta en cualquier estado (enviado, pendiente o fallido)', async () => {
    const enviado = await crearDataset({ titulo: 'A enviado', gestion: 'externa', vencimiento: VENCE });
    const pendiente = await crearDataset({ titulo: 'B pendiente', gestion: 'externa', vencimiento: VENCE });
    const fallido = await crearDataset({ titulo: 'C fallido', gestion: 'externa', vencimiento: VENCE });
    await adelantar(enviado);
    await adelantar(pendiente, { estado: 'pendiente' });
    await adelantar(fallido, { estado: 'fallida' });
    assert.deepEqual(ids(await pendientes()), [enviado, pendiente, fallido]);
  });

  it('no devuelve el que se actualizó (cambió su vencimiento)', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(id);
    await query("UPDATE datasets SET proxima_actualizacion = '2028-01-31' WHERE id = ?", [id]);
    assert.deepEqual(await pendientes(), []);
  });

  it('no devuelve una cuenta_desde fuera de la licencia, ni un aviso sin cuenta_desde', async () => {
    const despues = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    const antes = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    const normal = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(despues, { cuentaDesde: '2027-01-11' });
    await adelantar(antes, { cuentaDesde: '2026-12-09' });
    await adelantar(normal, { cuentaDesde: null });
    assert.deepEqual(await pendientes(), []);
    // Los dos extremos de la licencia entran
    const primero = await crearDataset({ titulo: 'A primero', gestion: 'externa', vencimiento: VENCE });
    const ultimo = await crearDataset({ titulo: 'B último', gestion: 'externa', vencimiento: VENCE });
    await adelantar(primero, { cuentaDesde: LICENCIA.desde });
    await adelantar(ultimo, { cuentaDesde: LICENCIA.hasta });
    assert.deepEqual(ids(await pendientes()), [primero, ultimo]);
  });

  it('ignora los avisos de prueba', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(id, { esPrueba: 1 });
    assert.deepEqual(await pendientes(), []);
  });

  it('con la persona autorizada de licencia el 22/12, el día es el 18/12', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(id);
    const [fila] = await pendientes([{ desde: '2026-12-21', hasta: '2026-12-23' }]);
    assert.equal(fila.id, id);
    assert.equal(fila.cuenta_desde, '2026-12-22');
    assert.equal(fila.dia_en_su_fecha, '2026-12-18');
  });

  it('descarta el que la persona autorizada no puede presentar en ningún día de la licencia', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    await adelantar(id);
    assert.deepEqual(await pendientes([{ desde: '2026-12-10', hasta: '2026-12-23' }]), []);
  });

  it('no filtra por hoy: devuelve también el que le toca más adelante, y lo que pasó', async () => {
    const mas = await crearDataset({ titulo: 'A más adelante', gestion: 'externa', vencimiento: VENCE });
    const ya = await crearDataset({ titulo: 'B ya pasó', gestion: 'externa', vencimiento: VENCE });
    await adelantar(mas, { cuentaDesde: '2026-12-30' });
    await adelantar(ya, { cuentaDesde: '2026-12-14' });
    const filas = await pendientes();
    assert.deepEqual(filas.map(f => [f.id, f.dia_en_su_fecha]), [[mas, '2026-12-30'], [ya, '2026-12-14']]);
  });

  it('separa por gestión y deja afuera los inactivos, los eventuales y los vencidos', async () => {
    const externo = await crearDataset({ gestion: 'externa', vencimiento: VENCE });
    const interno = await crearDataset({ gestion: 'interna', vencimiento: VENCE });
    const inactivo = await crearDataset({ gestion: 'externa', vencimiento: VENCE, activo: 0 });
    const eventual = await crearDataset({ gestion: 'externa', vencimiento: VENCE, frecuencia: 'Eventual' });
    const vencido = await crearDataset({ gestion: 'externa', vencimiento: '2026-12-21' });
    for (const id of [externo, interno, inactivo, eventual]) await adelantar(id);
    await adelantar(vencido, { vencimiento: '2026-12-21' });
    assert.deepEqual(ids(await pendientes()), [externo]);
    assert.deepEqual(ids(await pendientes([], 'interna')), [interno]);
  });

  it('un dataset que vence hoy todavía entra', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: HOY });
    await adelantar(id, { vencimiento: HOY });
    assert.deepEqual(ids(await pendientes()), [id]);
  });

  it('ordena por vencimiento y título, y trae el pedido calculado con hoy', async () => {
    const tardio = await crearDataset({ titulo: 'A tardío', gestion: 'externa', vencimiento: '2027-02-28' });
    const segundo = await crearDataset({ titulo: 'C mismo mes', gestion: 'externa', vencimiento: VENCE });
    const primero = await crearDataset({ titulo: 'B mismo mes', gestion: 'externa', vencimiento: VENCE });
    await adelantar(tardio, { vencimiento: '2027-02-28' });
    await adelantar(segundo);
    await adelantar(primero);
    const filas = await pendientes();
    assert.deepEqual(ids(filas), [primero, segundo, tardio]);
    // Externa anual sin Datos al: el acumulado del año del corte (el fin del mes anterior al vencimiento)
    assert.deepEqual(filas.map(f => [f.tipo_pedido, f.meses, f.pedido.texto]), [
      ['acumulado', 12, 'Del 01/01/2026 al 31/12/2026'], ['acumulado', 12, 'Del 01/01/2026 al 31/12/2026'],
      ['acumulado', 12, 'Del 01/01/2027 al 31/01/2027']
    ]);
  });
});

describe('reiteración: vencidos sin aviso', () => {
  it('entran sin esperar 20 días, con informado null', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    const fila = (await datos.seleccionarParaReiteracion('externa', '2026-11-02')).find(d => d.id === id);
    assert.ok(fila);
    assert.equal(fila.informado, null);
    assert.equal(fila.reiteraciones, 0);
  });

  it('no entran si todavía no vencieron, ni si tienen un aviso registrado (aunque haya fallado)', async () => {
    const aVencer = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    const conAvisoFallido = await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    await crearNota({ tipo: 'aviso', gestion: 'externa', fecha: '2026-10-01', numero: 90, estado: 'fallida',
      datasets: [{ id: conAvisoFallido, vencimiento: '2026-10-31' }] });
    const seleccionados = ids(await datos.seleccionarParaReiteracion('externa', '2026-11-02'));
    assert.ok(!seleccionados.includes(aVencer));
    assert.ok(!seleccionados.includes(conAvisoFallido));
  });

  it('cuenta las reiteraciones anteriores del mismo vencimiento', async () => {
    const id = await crearDataset({ gestion: 'interna', vencimiento: '2026-09-30' });
    await crearNota({ tipo: 'reiteracion', gestion: 'interna', fecha: '2026-10-01', numero: 91,
      datasets: [{ id, vencimiento: '2026-09-30', seccion: 'vencido' }] });
    const fila = (await datos.seleccionarParaReiteracion('interna', '2026-11-02')).find(d => d.id === id);
    assert.equal(fila.reiteraciones, 1);
    assert.equal(fila.informado, null);
  });

  it('el aviso de una prueba no cuenta como aviso: el vencido sigue entrando sin aviso previo', async () => {
    const id = await crearDataset({ vencimiento: '2026-10-31' });
    await crearNota({ fecha: '2026-10-01', esPrueba: 1, datasets: [{ id, vencimiento: '2026-10-31' }] });
    const fila = (await datos.seleccionarParaReiteracion('interna', '2026-11-02')).find(d => d.id === id);
    assert.ok(fila);
    assert.equal(fila.informado, null);
  });

  it('un vencido con aviso de hace menos de 20 días no entra por ninguna de las dos condiciones', async () => {
    const id = await crearDataset({ vencimiento: '2026-10-31' });
    await crearNota({ fecha: '2026-10-20', numero: 1, datasets: [{ id, vencimiento: '2026-10-31' }] });
    assert.deepEqual(await datos.seleccionarParaReiteracion('interna', '2026-11-02'), []);
  });

  it('junta en un solo resultado los avisados y los vencidos sin aviso, ordenados por vencimiento y título', async () => {
    const sinAviso = await crearDataset({ titulo: 'B sin aviso', vencimiento: '2026-10-15' });
    const conAviso = await crearDataset({ titulo: 'A con aviso', vencimiento: '2026-12-31' });
    const sinAvisoTardio = await crearDataset({ titulo: 'A sin aviso', vencimiento: '2026-10-31' });
    await crearNota({ fecha: '2026-10-05', numero: 7, datasets: [{ id: conAviso, vencimiento: '2026-12-31' }] });
    const resultado = await datos.seleccionarParaReiteracion('interna', '2026-11-02');
    assert.deepEqual(ids(resultado), [sinAviso, sinAvisoTardio, conAviso]);
    assert.deepEqual(resultado.map(d => d.informado), [null, null, { numero: 7, anio: 2026, fecha: '2026-10-05' }]);
  });
});

describe('aperturaDelProximoAviso', () => {
  const HOY = '2026-11-02';

  it('devuelve el primer vencimiento del mes más próximo con datasets sin aviso, sin límite de ventana', async () => {
    assert.equal(await datos.aperturaDelProximoAviso('externa', HOY), null);
    await crearDataset({ gestion: 'externa', vencimiento: '2027-06-30' });
    assert.equal(await datos.aperturaDelProximoAviso('externa', HOY), '2027-06-30');

    // Un mes con todos sus datasets avisados no cuenta
    const avisadoSolo = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-11-02', numero: 1, datasets: [{ id: avisadoSolo, vencimiento: '2026-11-30' }] });
    // En enero hay uno sin aviso: el mes se abre con el 30/01, que ya tiene aviso
    const avisado = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-12-31', numero: 2, datasets: [{ id: avisado, vencimiento: '2027-01-30' }] });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    // Los de la otra gestión no cuentan
    await crearDataset({ gestion: 'interna', vencimiento: '2027-01-02' });
    assert.equal(await datos.aperturaDelProximoAviso('externa', HOY), '2027-01-30');
  });

  it('ignora los vencidos: un mes que solo tiene vencidos sin aviso no abre un aviso', async () => {
    await crearDataset({ gestion: 'externa', vencimiento: '2026-09-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-10-31' });
    assert.equal(await datos.aperturaDelProximoAviso('externa', HOY), null);

    await crearDataset({ gestion: 'externa', vencimiento: '2027-03-31' });
    assert.equal(await datos.aperturaDelProximoAviso('externa', HOY), '2027-03-31');
  });

  it('un dataset que vence hoy todavía cuenta, y mañana ya no', async () => {
    await crearDataset({ gestion: 'interna', vencimiento: HOY });
    assert.equal(await datos.aperturaDelProximoAviso('interna', HOY), HOY);
    assert.equal(await datos.aperturaDelProximoAviso('interna', '2026-11-03'), null);
  });
});

describe('antecedentesDe', () => {
  it('cuenta los emails viejos exitosos del ciclo actual de los tipos reemplazados', async () => {
    const id = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31', ultima: '2025-12-31' });
    const otro = await crearDataset({ gestion: 'externa', vencimiento: '2026-07-31' });
    await crearEmailViejo({ tipo: 'externo-vencido', datasetIds: [otro, id], enviado: '2026-01-01 08:00:00' });
    await crearEmailViejo({ tipo: 'interno-60', datasetIds: [id], enviado: '2026-10-01 08:00:00' });
    await crearEmailViejo({ tipo: 'area-aviso-40', datasetIds: [id], enviado: '2026-05-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-5', datasetIds: [id], enviado: '2025-11-01 08:00:00' });
    await crearEmailViejo({ tipo: 'externo-40', datasetIds: [id], enviado: '2026-03-01 08:00:00', success: 0 });

    const antecedentes = await datos.antecedentesDe([id, otro]);
    assert.deepEqual(antecedentes.get(id), { cantidad: 2, primera: '2026-01-01', ultima: '2026-10-01' });
    assert.deepEqual(antecedentes.get(otro), { cantidad: 1, primera: '2026-01-01', ultima: '2026-01-01' });
  });

  it('sin datasets devuelve un mapa vacío', async () => {
    assert.equal((await datos.antecedentesDe([])).size, 0);
  });
});

describe('fichasDe', () => {
  const idDe = async (tabla, nombre) => (await query(`SELECT id FROM ${tabla} WHERE nombre = ?`, [nombre]))[0].id;

  it('devuelve la ficha completa de cada dataset para el anexo, con las fechas como AAAA-MM-DD', async () => {
    const area = await crearArea({
      nombre: 'Área de la ficha', area_superior: 'Secretaría de la ficha', email_principal: 'ficha@rpad.test',
      email_secundario: 'ficha2@rpad.test', telefono_area: '297 400-1111', celular_area: '297 15 400-2222',
      nombre_contacto: 'Persona de contacto', telefono_contacto: '297 400-3333', email_contacto: 'contacto@rpad.test'
    });
    const id = await crearDataset({
      titulo: 'Dataset con ficha', gestion: 'externa', vencimiento: '2026-11-30', ultima: '2025-11-30', areaId: area,
      url: 'https://datos.comodoro.gov.ar/dataset/ficha'
    });
    await query(
      `UPDATE datasets SET descripcion = ?, observaciones = ?, que_se_solicita = ?, tema_principal_id = ?, tema_secundario_id = ?,
         datos_al = ?, tipo_pedido = ?
       WHERE id = ?`,
      ['Descripción de la ficha.', 'Observación de la ficha.', 'Planilla con los registros del año.',
        await idDe('temas', 'Medio Ambiente'), await idDe('temas', 'Servicios Públicos'), '2025-10-31', 'acumulado', id]
    );
    // Cargados fuera de orden: la ficha los lista ordenados por nombre
    for (const formato of ['XLSX', 'CSV']) {
      await query('INSERT INTO dataset_formatos (dataset_id, formato_id) VALUES (?, ?)', [id, await idDe('formatos', formato)]);
    }

    const fichas = await datos.fichasDe([id]);
    assert.equal(fichas.size, 1);
    assert.deepEqual({ ...fichas.get(id) }, {
      id, titulo: 'Dataset con ficha', descripcion: 'Descripción de la ficha.', observaciones: 'Observación de la ficha.',
      url_dataset: 'https://datos.comodoro.gov.ar/dataset/ficha', tipo_gestion: 'externa', frecuencia_nombre: 'Anualmente',
      ultima_actualizacion: '2025-11-30', vencimiento: '2026-11-30',
      tema_principal: 'Medio Ambiente', tema_secundario: 'Servicios Públicos', formatos: 'CSV, XLSX',
      que_se_solicita: 'Planilla con los registros del año.',
      area_nombre: 'Área de la ficha', area_superior: 'Secretaría de la ficha', email_principal: 'ficha@rpad.test',
      email_secundario: 'ficha2@rpad.test', telefono_area: '297 400-1111', celular_area: '297 15 400-2222',
      nombre_contacto: 'Persona de contacto', telefono_contacto: '297 400-3333', email_contacto: 'contacto@rpad.test',
      // Sin el hoy de la nota, el pedido de ese vencimiento tal cual (sin R7), desde lo que falta después de Datos al
      meses: 12, datos_al: '2025-10-31', tipo_pedido: 'acumulado',
      pedido: { desde: '2025-11-01', hasta: '2026-10-31', texto: 'Del 01/11/2025 al 31/10/2026' }
    });
  });

  it('sin tema secundario, formatos, "qué se solicita" ni última actualización, esos campos vienen en null', async () => {
    const id = await crearDataset({ vencimiento: '2026-12-31' });
    const ficha = (await datos.fichasDe([id])).get(id);
    assert.equal(ficha.tipo_gestion, 'interna');
    assert.equal(ficha.vencimiento, '2026-12-31');
    for (const campo of ['tema_secundario', 'formatos', 'que_se_solicita', 'ultima_actualizacion', 'descripcion', 'observaciones', 'datos_al']) {
      assert.equal(ficha[campo], null, campo);
    }
    assert.ok(ficha.tema_principal);
  });

  it('devuelve una ficha por cada dataset pedido', async () => {
    const a = await crearDataset({ vencimiento: '2026-12-31' });
    const b = await crearDataset({ vencimiento: '2026-11-30' });
    await crearDataset({ vencimiento: '2026-11-30' }); // no pedido
    const fichas = await datos.fichasDe([a, b]);
    assert.deepEqual([...fichas.keys()].sort((x, y) => x - y), [a, b].sort((x, y) => x - y));
  });

  it('sin datasets devuelve un mapa vacío', async () => {
    const fichas = await datos.fichasDe([]);
    assert.ok(fichas instanceof Map);
    assert.equal(fichas.size, 0);
  });
});

// El pedido depende del día (R7): las fechas se arman desde el hoy real y los textos esperados, con formatoCorto (Ruling 7)
describe('datos solicitados de cada dataset (spec 2026-10-17-fechas-datasets, 9)', () => {
  const HOY = hoyArgentina();
  // Vence a fin del mes de mañana, entre hoy y hoy + 31 días: entra en la ventana del aviso de las dos gestiones. Con el
  // mes de hoy, un 29/02 vencería el 28/02 (febrero va siempre en 28) y ya estaría vencido
  const VENCE = vencimientoDelMes(sumarDias(HOY, 1));
  // Trimestral vencido hace dos ciclos: el último vencimiento que ya pasó es el fin del mes pasado (R7)
  const VENCIDO = sumarMeses(HOY, -7);
  const primeroDelMes = (iso) => `${iso.slice(0, 8)}01`;
  const periodo = (desde, hasta) => ({ desde, hasta, texto: `Del ${formatoCorto(desde)} al ${formatoCorto(hasta)}` });
  const delPedido = ({ meses, datos_al: datosAl, tipo_pedido: tipo, pedido }) => ({ meses, datos_al: datosAl, tipo_pedido: tipo, pedido });
  // Un trimestral acumulado con los datos publicados muy atrás: se pide desde el mes siguiente a Datos al
  const trimestral = (titulo, vencimiento) => crearDataset({
    titulo, gestion: 'externa', frecuencia: 'Trimestralmente', vencimiento, tipoPedido: 'acumulado', datosAl: sumarMeses(vencimiento, -16)
  });

  it('el aviso trae de cada dataset la frecuencia en meses, Datos al, el tipo de pedido efectivo y el pedido de hoy', async () => {
    const acumulado = await trimestral('A acumulado', VENCE);
    const foto = await crearDataset({ titulo: 'B foto sugerida', gestion: 'externa', frecuencia: 'Cada dos años', vencimiento: VENCE });
    const sinPedido = await crearDataset({ titulo: 'C eventual', gestion: 'externa', vencimiento: VENCE, tipoPedido: 'eventual' });
    const fechaCero = await crearDataset({ titulo: 'D Datos al cero', gestion: 'externa', vencimiento: VENCE, tipoPedido: 'acumulado' });
    await query("UPDATE datasets SET datos_al = '0000-00-00' WHERE id = ?", [fechaCero]);
    const relevamiento = await crearDataset({ titulo: 'E relevamiento sugerido', vencimiento: VENCE });

    const corte = sumarMeses(VENCE, -1);
    const externos = new Map((await datos.seleccionarParaAviso('externa', HOY)).map(d => [d.id, d]));
    assert.deepEqual(delPedido(externos.get(acumulado)), {
      meses: 3, datos_al: sumarMeses(VENCE, -16), tipo_pedido: 'acumulado', pedido: periodo(primeroDelMes(sumarMeses(VENCE, -15)), corte)
    });
    // Sin tipo guardado, el sugerido: externa de más de 12 meses → foto
    assert.deepEqual(delPedido(externos.get(foto)), {
      meses: 24, datos_al: null, tipo_pedido: 'foto', pedido: { desde: corte, hasta: corte, texto: `Vigente al ${formatoCorto(corte)}` }
    });
    assert.deepEqual(delPedido(externos.get(sinPedido)), { meses: 12, datos_al: null, tipo_pedido: 'eventual', pedido: null });
    // '0000-00-00' no es una fecha: sin Datos al, el acumulado del año del corte
    assert.deepEqual(delPedido(externos.get(fechaCero)), {
      meses: 12, datos_al: null, tipo_pedido: 'acumulado', pedido: periodo(`${corte.slice(0, 4)}-01-01`, corte)
    });
    const [interno] = await datos.seleccionarParaAviso('interna', HOY);
    assert.equal(interno.id, relevamiento);
    assert.deepEqual(delPedido(interno), {
      meses: 12, datos_al: null, tipo_pedido: 'relevamiento', pedido: { desde: null, hasta: null, texto: 'Relevamiento actualizado' }
    });
  });

  it('la reiteración recalcula el pedido con R7, con aviso previo o sin él: pide hasta el último corte cerrado, no lo del aviso', async () => {
    const sinAviso = await trimestral('A sin aviso', VENCIDO);
    const avisado = await trimestral('B avisado', VENCIDO);
    // Un aviso de antes de esta etapa, guardado sin los datos solicitados
    await crearNota({ gestion: 'externa', fecha: sumarDias(VENCIDO, -30), numero: 1, datasets: [{ id: avisado, vencimiento: VENCIDO }] });

    const filas = await datos.seleccionarParaReiteracion('externa', HOY);
    assert.deepEqual(ids(filas), [sinAviso, avisado]);
    assert.deepEqual(filas.map(f => f.informado?.numero ?? null), [null, 1]);
    // El aviso pedía hasta el corte de su vencimiento; hoy ya pasaron dos ciclos y se pide hasta el fin del mes anterior al pasado
    const esperado = periodo(primeroDelMes(sumarMeses(VENCIDO, -15)), sumarMeses(HOY, -2));
    assert.notEqual(esperado.hasta, sumarMeses(VENCIDO, -1));
    for (const fila of filas) assert.deepEqual(delPedido(fila), { meses: 3, datos_al: sumarMeses(VENCIDO, -16), tipo_pedido: 'acumulado', pedido: esperado });
  });

  it('la ficha calcula el pedido con el hoy de la nota (R7); sin hoy, el de ese vencimiento tal cual', async () => {
    const id = await trimestral('Ficha vencida', VENCIDO);
    const desde = primeroDelMes(sumarMeses(VENCIDO, -15));
    assert.deepEqual((await datos.fichasDe([id], HOY)).get(id).pedido, periodo(desde, sumarMeses(HOY, -2)));
    assert.deepEqual((await datos.fichasDe([id])).get(id).pedido, periodo(desde, sumarMeses(VENCIDO, -1)));
  });
});

describe('areasDe', () => {
  it('devuelve las áreas pedidas ordenadas por nombre', async () => {
    const b = await crearArea({ nombre: 'B Área', email_principal: 'b@rpad.test' });
    const a = await crearArea({ nombre: 'A Área' });
    const resultado = await datos.areasDe([b, a]);
    assert.deepEqual(resultado.map(r => r.nombre), ['A Área', 'B Área']);
    assert.equal(resultado[1].email_principal, 'b@rpad.test');
  });
});
