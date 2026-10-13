// Selección de datasets para avisos y reiteraciones (base de prueba propia)
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, cerrarDb } from './helpers.js';
import { crearDataset, crearNota, crearEmailViejo, limpiarBase, crearArea } from './notas-fixtures.js';

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
  it('toma los que vencen dentro de la ventana y los vencidos, ordenados por vencimiento', async () => {
    const enVentana = await crearDataset({ vencimiento: '2026-12-31' });
    const justo60 = await crearDataset({ vencimiento: '2027-01-01' });
    await crearDataset({ vencimiento: '2027-02-01' }); // fuera de la ventana y de otro mes
    const vencido = await crearDataset({ vencimiento: '2026-09-30' });
    const resultado = await datos.seleccionarParaAviso('interna', '2026-11-02');
    assert.deepEqual(ids(resultado), [vencido, enVentana, justo60]);
    assert.equal(resultado[0].vencimiento, '2026-09-30');
  });

  it('respeta la ventana de 30 días de la gestión externa y separa por gestión', async () => {
    const externa = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearDataset({ gestion: 'externa', vencimiento: '2026-12-31' });
    await crearDataset({ gestion: 'interna', vencimiento: '2026-11-30' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-11-02')), [externa]);
  });

  it('excluye eventuales, inactivos y sin fecha', async () => {
    await crearDataset({ vencimiento: '2026-11-30', frecuencia: 'Eventual' });
    await crearDataset({ vencimiento: '2026-11-30', activo: 0 });
    await crearDataset({ vencimiento: null });
    assert.deepEqual(await datos.seleccionarParaAviso('interna', '2026-11-02'), []);
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

describe('seleccionarParaAviso: agrupamiento por mes de vencimiento', () => {
  it('externa, 30/01 y 31/01: el 30/12 no sale nada y el 31/12 salen los dos juntos', async () => {
    const del30 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    const del31 = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    assert.deepEqual(await datos.seleccionarParaAviso('externa', '2026-12-30'), []);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-12-31')), [del30, del31]);
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
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2026-12-31')), [del30, del31]);
    assert.deepEqual(ids(await datos.seleccionarParaAviso('externa', '2027-01-29')), [del30, del31, febrero]);
  });

  it('no mezcla gestiones: un mes abierto para la interna no abre ese mes para la externa', async () => {
    const interna15 = await crearDataset({ vencimiento: '2027-01-15' });
    const interna31 = await crearDataset({ vencimiento: '2027-01-31' });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    assert.deepEqual(ids(await datos.seleccionarParaAviso('interna', '2026-11-16')), [interna15, interna31]);
    // El 16/12 la ventana externa llega al 15/01, donde solo vence un dataset de la interna
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
});

describe('aperturaDelProximoAviso', () => {
  it('devuelve el primer vencimiento del mes más próximo con datasets sin aviso, sin límite de ventana', async () => {
    assert.equal(await datos.aperturaDelProximoAviso('externa'), null);
    await crearDataset({ gestion: 'externa', vencimiento: '2027-06-30' });
    assert.equal(await datos.aperturaDelProximoAviso('externa'), '2027-06-30');

    // Un mes con todos sus datasets avisados no cuenta
    const avisadoSolo = await crearDataset({ gestion: 'externa', vencimiento: '2026-11-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-11-02', numero: 1, datasets: [{ id: avisadoSolo, vencimiento: '2026-11-30' }] });
    // En enero hay uno sin aviso: el mes se abre con el 30/01, que ya tiene aviso
    const avisado = await crearDataset({ gestion: 'externa', vencimiento: '2027-01-30' });
    await crearNota({ gestion: 'externa', fecha: '2026-12-31', numero: 2, datasets: [{ id: avisado, vencimiento: '2027-01-30' }] });
    await crearDataset({ gestion: 'externa', vencimiento: '2027-01-31' });
    // Los de la otra gestión no cuentan
    await crearDataset({ gestion: 'interna', vencimiento: '2027-01-02' });
    assert.equal(await datos.aperturaDelProximoAviso('externa'), '2027-01-30');
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

describe('areasDe', () => {
  it('devuelve las áreas pedidas ordenadas por nombre', async () => {
    const b = await crearArea({ nombre: 'B Área', email_principal: 'b@rpad.test' });
    const a = await crearArea({ nombre: 'A Área' });
    const resultado = await datos.areasDe([b, a]);
    assert.deepEqual(resultado.map(r => r.nombre), ['A Área', 'B Área']);
    assert.equal(resultado[1].email_principal, 'b@rpad.test');
  });
});
