// Reglas del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset, "Las fuentes y los movimientos"): funciones puras,
// probadas con los casos reales anonimizados de tests/seguimiento-casos.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';
import {
  REGISTRO_DESDE, ASUNTOS_EMAIL, QUE_PEDIA, FALTABAN, diaDe, nombreCorto, unirAlta, movimientosDe,
  ciclosDe, cicloDelAviso, avisosDelCiclo, ultimoAviso, hitosDe, estadoDeSeguimiento, circuitoDe,
  seguimientoDe, resumenParaLista, nombreDelPdf, disposicionDeAdjunto, sinErroresTecnicos, notaDgmitDelCiclo, conNotasDgmitEditables,
  notasDgmitPorCiclo
} from '../services/seguimientoReglas.js';
import { cintaDe } from '../services/seguimientoCinta.js';

const f = (id) => ({ ...CASOS[id], catalogos: CATALOGOS });
// Fuentes del caso 52 con un cambio, un registro o un aviso más
const con = (id, extra) => {
  const base = f(id);
  return { ...base, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, [...base[k], ...v]])) };
};
const cambio = (datos) => ({
  id: 60, tipo: 'editar', estado: 'aprobado', creado: '2026-03-02 10:00:00', revisado: '2026-03-02 11:00:00',
  propuso: 'Ana María Uno', reviso: 'Bruno Pablo Dos', motivo: null, nuevos: {}, anteriores: {}, dataset_id: 52, ...datos
});

describe('constantes', () => {
  it('desde cuándo hay registro, congelado', () => {
    assert.deepEqual(REGISTRO_DESDE, { envios: '2025-12-06', cambios: '2026-01-26' });
    assert.ok(Object.isFrozen(REGISTRO_DESDE));
  });
  it('los textos fijos de los emails retirados, congelados', () => {
    assert.ok(Object.isFrozen(ASUNTOS_EMAIL) && Object.isFrozen(QUE_PEDIA) && Object.isFrozen(FALTABAN));
    assert.equal(ASUNTOS_EMAIL['externo-vencido'], 'Resumen Mensual: Sin Respuesta (Externos)');
    assert.equal(ASUNTOS_EMAIL['interno-vencido'], 'Resumen Mensual: Datasets Atrasados (Internos)');
    assert.equal(ASUNTOS_EMAIL['area-aviso-40'], 'Aviso: Solicitud próxima de actualización de datos');
    assert.deepEqual(Object.keys(ASUNTOS_EMAIL).sort(), ['area-aviso-40', 'externo-40', 'externo-5', 'externo-60',
      'externo-vencido', 'interno-30', 'interno-60', 'interno-vencido']);
    assert.deepEqual(Object.keys(QUE_PEDIA).sort(), Object.keys(ASUNTOS_EMAIL).filter((t) => t !== 'area-aviso-40').sort());
    assert.deepEqual(FALTABAN, { 'externo-60': 60, 'externo-40': 40, 'externo-5': 5, 'interno-60': 60, 'interno-30': 30 });
  });
  it('nada de los textos propios dice "sin entregar", "sin respuesta" ni "atrasado"', () => {
    for (const tipo of Object.keys(QUE_PEDIA)) assert.doesNotMatch(QUE_PEDIA[tipo], /sin entregar|sin respuesta|atrasad/i);
  });
});

describe('nombreCorto', () => {
  it('primer nombre y último apellido', () => {
    assert.equal(nombreCorto('Elena Noelia Cuatro'), 'Elena Cuatro');
    assert.equal(nombreCorto('  Ana  María  Uno '), 'Ana Uno');
    assert.equal(nombreCorto('Test adminA'), 'Test adminA');
    assert.equal(nombreCorto(null), null);
  });
  it('con una palabra va completo; vacío o algo que no es texto, null', () => {
    assert.equal(nombreCorto('Ana'), 'Ana');
    assert.equal(nombreCorto('   '), null);
    assert.equal(nombreCorto(''), null);
    assert.equal(nombreCorto(undefined), null);
    assert.equal(nombreCorto(42), null);
  });
  it('con cuatro palabras, el primero y el último, sin tocar las tildes', () => {
    assert.equal(nombreCorto('María José de la Fuente'), 'María Fuente');
  });
});

describe('diaDe', () => {
  it('corta las fechas de los JSON viejos', () => {
    assert.equal(diaDe('2025-07-31T03:00:00.000Z'), '2025-07-31');
    assert.equal(diaDe('2026-02-30'), null);
    assert.equal(diaDe(null), null);
  });
  it('acepta el día solo y rechaza lo que no es una fecha', () => {
    assert.equal(diaDe('2026-10-20'), '2026-10-20');
    assert.equal(diaDe('2026-10-20 08:15:00'), '2026-10-20');
    assert.equal(diaDe(''), null);
    assert.equal(diaDe('ayer'), null);
    assert.equal(diaDe(undefined), null);
    assert.equal(diaDe(20261020), null);
    assert.equal(diaDe({}), null);
  });
});

describe('unirAlta', () => {
  it('por título y a ≤ 5 s; si el título cambió, solo por la hora', () => {
    assert.equal(unirAlta(CASOS[81].dataset, CASOS[81].altasSinDataset).id, 50);
    const otra = { ...CASOS[81].altasSinDataset[0], nuevos: { titulo: 'Otro título' } };
    assert.equal(unirAlta(CASOS[81].dataset, [otra]).id, 50);
    assert.equal(unirAlta(CASOS[81].dataset, [{ ...otra, revisado: '2026-10-19 10:29:30' }]), null);
  });
  it('entre varias, primero la del mismo título, aunque otra esté más cerca', () => {
    const { dataset, altasSinDataset } = CASOS[81];
    const mismoTitulo = { ...altasSinDataset[0], id: 70, revisado: '2026-10-19 10:29:21' };
    const otraMasCerca = { ...altasSinDataset[0], id: 71, nuevos: { titulo: 'Otro título' } };
    assert.equal(unirAlta(dataset, [otraMasCerca, mismoTitulo]).id, 70);
  });
  it('sin título igual, la más cercana a la hora del alta', () => {
    const { dataset, altasSinDataset } = CASOS[81];
    const lejos = { ...altasSinDataset[0], id: 72, nuevos: { titulo: 'A' }, revisado: '2026-10-19 10:29:21' };
    const cerca = { ...altasSinDataset[0], id: 73, nuevos: { titulo: 'B' }, revisado: '2026-10-19 10:29:16' };
    assert.equal(unirAlta(dataset, [lejos, cerca]).id, 73);
  });
  it('los 5 s valen para los dos lados y el límite entra', () => {
    const { dataset, altasSinDataset } = CASOS[81];
    assert.equal(unirAlta(dataset, [{ ...altasSinDataset[0], revisado: '2026-10-19 10:29:22' }]).id, 50);
    assert.equal(unirAlta(dataset, [{ ...altasSinDataset[0], revisado: '2026-10-19 10:29:12' }]).id, 50);
    assert.equal(unirAlta(dataset, [{ ...altasSinDataset[0], revisado: '2026-10-19 10:29:23' }]), null);
  });
  it('cruza la medianoche: la diferencia es exacta', () => {
    const dataset = { titulo: 'X', alta: '2026-10-19 23:59:58' };
    assert.equal(unirAlta(dataset, [{ id: 1, nuevos: { titulo: 'X' }, revisado: '2026-10-20 00:00:02' }]).id, 1);
  });
  it('sin altas, sin hora o con datos raros: null, sin error', () => {
    assert.equal(unirAlta(CASOS[81].dataset, []), null);
    assert.equal(unirAlta(CASOS[81].dataset, null), null);
    assert.equal(unirAlta(CASOS[81].dataset, undefined), null);
    assert.equal(unirAlta(null, CASOS[81].altasSinDataset), null);
    assert.equal(unirAlta({ ...CASOS[81].dataset, alta: null }, CASOS[81].altasSinDataset), null);
    assert.equal(unirAlta(CASOS[81].dataset, [{ id: 1, nuevos: null, revisado: null }]), null);
  });
});

describe('movimientosDe: los casos reales', () => {
  it('52: los 16 movimientos, del más nuevo al más viejo', () => {
    const m = movimientosDe(f(52));
    assert.equal(m.length, 16);
    assert.deepEqual([m[0].fecha, m[0].titulo, m[0].detalle, m[0].quien],
      ['2026-10-13', 'Nota Digital N° 2/26 a DGMIT', 'Aviso de gestión externa, sección vencidos: vencía el 31/07/2026.', ['Envío automático']]);
    const act = m.find((x) => x.extra.cambio_id === 7);
    assert.deepEqual([act.tipo, act.fecha, act.detalle, act.quien],
      ['act', '2026-02-04', 'Cargado en el portal el 04/02/2026. Próxima: 31/07/2026. Cambio #7.', ['Propuso Ana Uno', 'Aprobó Bruno Dos']]);
    const rech = m.find((x) => x.extra.cambio_id === 6);
    assert.equal(rech.detalle, 'Cargado en el portal el 04/02/2026. Próxima: 03/08/2026. Motivo: "Mal la fecha". Cambio #6.');
    assert.deepEqual(rech.quien, ['Propuso Bruno Dos', 'Rechazó Ana Uno']);
    assert.equal(m.find((x) => x.tipo === 'area').detalle, 'A la Dirección General de Relaciones Laborales.');
    assert.equal(m.find((x) => x.momento === '2026-07-26 08:00:05').detalle, 'Faltaban 5 días. Junto con otros 5 datasets.');
    assert.equal(m.find((x) => x.momento === '2026-10-01 08:00:06').titulo, 'Email a DGMIT: resumen mensual de vencidos');
    assert.deepEqual(m.at(-2).detalle, 'Cargado en el portal el 17/12/2025. Registro anterior a la doble verificación.');
    assert.deepEqual([m.at(-1).titulo, m.at(-1).detalle, m.at(-1).quien], ['Alta en el RPAD', 'Carga inicial del registro.', []]);
  });

  it('81: la nota pide lo guardado y la firma; el alta por el cambio #50', () => {
    const [nota, alta] = movimientosDe(f(81));
    assert.equal(nota.detalle, 'Aviso de gestión externa, próximos a vencer: vence el 31/10/2026. Pide: Vigente al 30/09/2026.');
    assert.deepEqual(nota.quien, ['Envío automático', 'Firmó Bruno Dos']);
    assert.deepEqual([alta.detalle, alta.quien], ['Cambio #50.', ['Propuso Bruno Dos', 'Aprobó Carla Tres']]);
  });

  it('10: cambio en la ficha con próxima y frecuencia', () => {
    const c14 = movimientosDe(f(10)).find((x) => x.extra.cambio_id === 14);
    assert.deepEqual([c14.tipo, c14.fecha, c14.detalle],
      ['cambio', '2026-02-25', 'Próxima: 31/07/2026 a 31/05/2026. Frecuencia: Cada medio año a Cuatrimestralmente. Cambio #14.']);
  });

  it('1: la actualización pendiente', () => {
    const p = movimientosDe(f(1)).find((x) => x.extra.cambio_id === 51);
    assert.deepEqual([p.tipo, p.titulo, p.fecha, p.quien], ['actp', 'Actualización pendiente de aprobación', '2026-10-19', ['Propuso Bruno Dos']]);
    assert.equal(p.detalle, 'Cargado en el portal el 19/10/2026. Datos al 31/12/2026. Recibido el 19/10/2026. Próxima: 31/01/2027. Cambio #51.');
  });

  // El origen de los datos (spec 2026-10-24-metricas-y-reportes, 4): viaja en el cambio junto con «Recibido el» y se dice con su
  // texto corto (textoOrigen); en gestión interna viaja vacío y no se dice
  it('el movimiento de una actualización con origen dice «Origen de los datos: Fuente pública»', () => {
    const registro = (id, origen, anteriores = {}) => cambio({
      id, revisado: '2026-10-20 12:00:00',
      nuevos: { ultima_actualizacion: '2026-10-20', proxima_actualizacion: '2027-01-31', recibido_el: '2026-10-15', origen_datos: origen, registro_actualizacion: true },
      anteriores: { ultima_actualizacion: '2026-02-04', proxima_actualizacion: '2026-07-31', ...anteriores }
    });
    const movs = movimientosDe(con(52, { cambios: [registro(60, 'fuente_publica'), registro(61, 'area'), registro(62, null),
      registro(63, 'area', { origen_datos: 'area' }), registro(64, 'otro')] }));
    const de = (id) => movs.find((m) => m.extra.cambio_id === id);
    assert.equal(de(60).tipo, 'act');
    assert.equal(de(60).detalle,
      'Cargado en el portal el 20/10/2026. Recibido el 15/10/2026. Origen de los datos: Fuente pública. Próxima: 31/01/2027. Cambio #60.');
    assert.deepEqual(de(60).extra.campos.map((c) => c.campo), ['Cargado en el portal', 'Recibido el', 'Origen de los datos', 'Próxima actualización']);
    assert.deepEqual(de(60).extra.campos[2], { campo: 'Origen de los datos', antes: '—', despues: 'Fuente pública' });
    assert.equal(de(61).detalle,
      'Cargado en el portal el 20/10/2026. Recibido el 15/10/2026. Origen de los datos: Los entregó el área. Próxima: 31/01/2027. Cambio #61.');
    // Vacío (gestión interna), el mismo que tenía o un valor que no es un origen: no se dice
    for (const id of [62, 63, 64]) {
      assert.equal(de(id).detalle, `Cargado en el portal el 20/10/2026. Recibido el 15/10/2026. Próxima: 31/01/2027. Cambio #${id}.`, `cambio ${id}`);
      assert.ok(!de(id).extra.campos.some((c) => c.campo === 'Origen de los datos'), `cambio ${id}`);
    }
  });

  it('lenguaje neutro: ningún título, detalle ni quién dice "sin entregar", "sin respuesta" ni "atrasado"', () => {
    for (const id of Object.keys(CASOS)) {
      for (const m of movimientosDe(f(id))) {
        for (const texto of [m.titulo, m.detalle, ...m.quien]) assert.doesNotMatch(texto, /sin entregar|sin respuesta|atrasad/i, `caso ${id}: ${texto}`);
      }
    }
  });

  it('los 12 casos: la forma de cada movimiento y el orden', () => {
    const FILTROS = { nota: 'avisos', email: 'avisos', area: 'area', act: 'actualizaciones', cambio: 'cambios', rech: 'propuestas',
      actp: 'propuestas', cambiop: 'propuestas', auditoria: 'auditoria', alta: 'altas', baja: 'altas' };
    for (const id of Object.keys(CASOS)) {
      const m = movimientosDe(f(id));
      assert.ok(m.length > 0, `caso ${id}`);
      for (const x of m) {
        assert.equal(x.filtro, FILTROS[x.tipo], `caso ${id}: ${x.tipo}`);
        assert.match(x.fecha, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(x.momento, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        assert.equal(typeof x.titulo, 'string');
        assert.equal(typeof x.detalle, 'string');
        assert.ok(Array.isArray(x.quien));
        assert.equal(typeof x.extra, 'object');
      }
      for (let i = 1; i < m.length; i++) {
        const a = m[i - 1]; const b = m[i];
        assert.ok(a.fecha > b.fecha || (a.fecha === b.fecha && a.momento >= b.momento), `caso ${id}: orden en ${i}`);
      }
    }
  });

  it('cada caso termina con su alta (la carga inicial, o el cambio que la propuso)', () => {
    for (const id of Object.keys(CASOS)) {
      const altas = movimientosDe(f(id)).filter((x) => x.tipo === 'alta');
      assert.equal(altas.length, 1, `caso ${id}`);
      assert.equal(altas[0].titulo, 'Alta en el RPAD');
      assert.equal(altas[0].momento, CASOS[id].dataset.alta);
    }
  });

  it('no se modifican las fuentes', () => {
    const fuentes = f(52);
    const antes = JSON.stringify(fuentes);
    movimientosDe(fuentes);
    assert.equal(JSON.stringify(fuentes), antes);
  });
});

describe('movimientosDe: casos sintéticos sobre el 52', () => {
  it('un historial con cambio_id no aparece', () => {
    const m = movimientosDe(con(52, { historial: [{ fecha: '2026-03-01', creado: '2026-03-01 10:00:00', usuario: 'Ana María Uno', cambio_id: 9 }] }));
    assert.equal(m.length, 16);
    assert.equal(m.some((x) => x.fecha === '2026-03-01'), false);
  });

  it('un historial repetido por fecha se muestra una sola vez', () => {
    const m = movimientosDe(con(52, { historial: [{ fecha: '2025-12-17', creado: '2025-12-17 09:30:00', usuario: 'Bruno Pablo Dos', cambio_id: null }] }));
    assert.equal(m.length, 16);
    const h = m.filter((x) => x.detalle.endsWith('Registro anterior a la doble verificación.'));
    assert.equal(h.length, 1);
    assert.deepEqual(h[0].quien, ['Ana Uno']);
    assert.equal(h[0].momento, '2025-12-17 08:54:29');
  });

  it('un historial sin usuario no tiene quién', () => {
    const m = movimientosDe(con(52, { historial: [{ fecha: '2026-03-01', creado: '2026-03-01 10:00:00', usuario: null, cambio_id: null }] }));
    const h = m.find((x) => x.fecha === '2026-03-01');
    assert.deepEqual([h.tipo, h.titulo, h.quien, h.momento], ['act', 'Actualización registrada', [], '2026-03-01 10:00:00']);
  });

  it('un email con success: false dice que no se pudo enviar', () => {
    const fuentes = f(52);
    fuentes.emails = [{ ...fuentes.emails[2], success: false, error: 'timeout' }];
    const [e] = movimientosDe(fuentes).filter((x) => x.tipo === 'email');
    assert.equal(e.detalle, 'No se pudo enviar.');
    assert.equal(e.extra.success, false);
    assert.equal(e.extra.error, 'timeout');
    assert.deepEqual(e.quien, ['Sistema']);
  });

  it('el email a DGMIT: título, "Faltaban N días", solo este dataset y otro dataset', () => {
    const base = f(52);
    const email = (id, tipo, cantidad) => ({ ...base.emails[2], id, tipo, cantidad, enviado: `2026-04-0${id % 9 + 1} 08:00:00` });
    base.emails = [email(1, 'externo-60', 1), email(2, 'interno-30', 2), email(3, 'externo-40', 3), email(4, 'interno-vencido', 1), email(5, 'interno-60', 2), email(6, 'interno-vencido', 4)];
    const porId = (id) => movimientosDe(base).find((x) => x.tipo === 'email' && x.momento === base.emails.find((e) => e.id === id).enviado);
    assert.equal(porId(1).titulo, 'Email a DGMIT: redacción de notas');
    assert.equal(porId(1).detalle, 'Faltaban 60 días. Solo este dataset.');
    assert.equal(porId(2).titulo, 'Email a DGMIT: vence en 1 mes');
    assert.equal(porId(2).detalle, 'Faltaban 30 días. Junto con otro dataset.');
    assert.equal(porId(3).titulo, 'Email a DGMIT: distribución de notas');
    assert.equal(porId(3).detalle, 'Faltaban 40 días. Junto con otros 2 datasets.');
    assert.equal(porId(4).detalle, 'Solo este dataset.');
    assert.equal(porId(5).titulo, 'Email a DGMIT: planificación (60 días)');
    assert.equal(porId(6).detalle, 'Junto con otros 3 datasets.');
  });

  it('el email a DGMIT lleva el asunto original en extra', () => {
    const e = movimientosDe(f(52)).find((x) => x.momento === '2026-10-01 08:00:06');
    assert.deepEqual(e.extra, {
      asunto: 'Resumen Mensual: Sin Respuesta (Externos)', destinatarios: 'correo1@rpad.test,correo2@rpad.test,correo3@rpad.test',
      enviado: '2026-10-01 08:00:06', success: true, error: null
    });
    assert.equal(e.filtro, 'avisos');
  });

  it('un email de un tipo que no se conoce no entra', () => {
    const fuentes = f(52);
    fuentes.emails = [{ ...fuentes.emails[2], tipo: 'otro-tipo' }];
    assert.equal(movimientosDe(fuentes).filter((x) => x.tipo === 'email' || x.tipo === 'area').length, 0);
  });

  it('el email al área: el artículo, sin área, fallido y el asunto', () => {
    const base = f(52);
    const area = base.emails.find((e) => e.tipo === 'area-aviso-40');
    base.emails = [area, { ...area, id: 90, enviado: '2026-06-22 08:00:00', area_articulo: 'el', area: 'Ente Autárquico Comodoro Deportes' },
      { ...area, id: 91, enviado: '2026-06-23 08:00:00', area: null, area_articulo: null },
      { ...area, id: 92, enviado: '2026-06-24 08:00:00', success: false }];
    const m = movimientosDe(base).filter((x) => x.tipo === 'area');
    const por = (momento) => m.find((x) => x.momento === momento);
    assert.equal(por(area.enviado).titulo, 'Email al área: anticipo de la nota formal');
    assert.equal(por(area.enviado).detalle, 'A la Dirección General de Relaciones Laborales.');
    assert.equal(por(area.enviado).extra.asunto, 'Aviso: Solicitud próxima de actualización de datos - Dirección General de Relaciones Laborales');
    assert.equal(por('2026-06-22 08:00:00').detalle, 'Al Ente Autárquico Comodoro Deportes.');
    assert.equal(por('2026-06-23 08:00:00').detalle, 'Al área.');
    assert.equal(por('2026-06-24 08:00:00').detalle, 'No se pudo enviar.');
    assert.equal(por('2026-06-24 08:00:00').extra.success, false);
    assert.deepEqual(por(area.enviado).quien, ['Sistema']);
    assert.equal(por(area.enviado).filtro, 'area');
  });

  it('una nota pendiente termina en "Pendiente de envío." y una fallida en "No se pudo enviar."', () => {
    const base = f(52);
    const nota = { ...base.notas[0], id: 9, numero: 5, estado: 'pendiente', enviada: null, fecha: '2026-10-19', vencimiento: '2026-10-31', seccion: 'proximo' };
    const pendiente = movimientosDe({ ...base, notas: [nota] }).find((x) => x.tipo === 'nota');
    assert.equal(pendiente.detalle, 'Aviso de gestión externa, próximos a vencer: vence el 31/10/2026. Pendiente de envío.');
    assert.equal(pendiente.momento, '2026-10-19 00:00:00');
    assert.equal(pendiente.extra.estado, 'pendiente');
    const fallida = movimientosDe({ ...base, notas: [{ ...nota, estado: 'fallida' }] }).find((x) => x.tipo === 'nota');
    assert.equal(fallida.detalle, 'Aviso de gestión externa, próximos a vencer: vence el 31/10/2026. No se pudo enviar.');
  });

  it('la nota: el momento del envío, "Pide", "Generada por" y el extra', () => {
    const base = f(52);
    const nota = { ...base.notas[0], id: 11, numero: 7, anio: 2026, tipo: 'aviso', gestion: 'interna', fecha: '2026-10-19', estado: 'enviada',
      enviada: '2026-10-19 08:15:09', seccion: 'proximo', vencimiento: '2026-10-19', datos_solicitados: 'Del 01/01/2026 al 31/12/2026',
      creado_por: 'Carla Inés Tres', firmante: null };
    const n = movimientosDe({ ...base, notas: [nota] }).find((x) => x.tipo === 'nota');
    assert.equal(n.titulo, 'Nota Digital N° 7/26 a DGMIT');
    assert.equal(n.detalle, 'Aviso de gestión interna, próximos a vencer: vence el 19/10/2026. Pide: Del 01/01/2026 al 31/12/2026.');
    assert.deepEqual(n.quien, ['Generada por Carla Tres']);
    assert.equal(n.momento, '2026-10-19 08:15:09');
    assert.equal(n.filtro, 'avisos');
    assert.deepEqual(n.extra, { nota_id: 11, numero: 7, anio: 2026, vencimiento: '2026-10-19', datos_solicitados: 'Del 01/01/2026 al 31/12/2026',
      para: nota.para, cc: nota.cc, enviada: '2026-10-19 08:15:09', estado: 'enviada' });
  });

  it('la reiteración: "vencía" si el vencimiento es anterior a la nota, "vence" si no', () => {
    const base = f(52);
    const nota = { ...base.notas[0], id: 12, numero: 4, tipo: 'reiteracion', fecha: '2026-10-19', seccion: 'vencido', vencimiento: '2026-09-30' };
    const vencia = movimientosDe({ ...base, notas: [nota] }).find((x) => x.tipo === 'nota');
    assert.equal(vencia.detalle, 'Reiteración de gestión externa: vencía el 30/09/2026.');
    const vence = movimientosDe({ ...base, notas: [{ ...nota, vencimiento: '2026-10-19' }] }).find((x) => x.tipo === 'nota');
    assert.equal(vence.detalle, 'Reiteración de gestión externa: vence el 19/10/2026.');
  });

  it('una nota que no es aviso ni reiteración no entra como Nota a DGMIT', () => {
    const base = f(52);
    const m = movimientosDe({ ...base, notas: [{ ...base.notas[0], tipo: 'autorizacion' }] });
    assert.equal(m.some((x) => x.tipo === 'nota'), false);
  });

  it('una auditoría da su título, su detalle y quién', () => {
    const m = movimientosDe(con(52, { auditorias: [{ id: 30, numero: 5, anio: 2026, fecha: '2026-10-20', estado: 'enviada', cambio_id: 51, seccion: 'nuevo' }] }));
    const a = m.find((x) => x.tipo === 'auditoria');
    assert.equal(a.titulo, 'Nota Digital N° 5/26 de auditoría');
    assert.equal(a.detalle, 'Pidió auditar el cambio #51.');
    assert.deepEqual(a.quien, ['Envío automático']);
    assert.equal(a.filtro, 'auditoria');
    assert.deepEqual(a.extra, { nota_id: 30, cambio_id: 51 });
    assert.equal(a.fecha, '2026-10-20');
    assert.equal(a.momento, '2026-10-20 00:00:00');
    assert.equal(m[0], a);
    const r = movimientosDe(con(52, { auditorias: [{ id: 31, numero: 6, anio: 2026, fecha: '2026-10-20', estado: 'enviada', cambio_id: 51, seccion: 'reiterado' }] }))
      .find((x) => x.tipo === 'auditoria');
    assert.equal(r.detalle, 'Pidió auditar el cambio #51 (reiterado).');
  });

  it('una auditoría pendiente o fallida lo dice, como una nota, y quién sale como en la Nota Digital a DGMIT', () => {
    const auditoria = (datos) => movimientosDe(con(52, { auditorias: [{ id: 32, numero: 7, anio: 2026, fecha: '2026-10-20', estado: 'enviada',
      cambio_id: 51, seccion: 'nuevo', creado_por: null, firmante: null, ...datos }] })).find((x) => x.tipo === 'auditoria');
    assert.equal(auditoria({ estado: 'pendiente' }).detalle, 'Pidió auditar el cambio #51. Pendiente de envío.');
    assert.equal(auditoria({ estado: 'fallida', seccion: 'reiterado' }).detalle, 'Pidió auditar el cambio #51 (reiterado). No se pudo enviar.');
    assert.equal(auditoria({}).detalle, 'Pidió auditar el cambio #51.');
    assert.deepEqual(auditoria({}).quien, ['Envío automático']);
    assert.deepEqual(auditoria({ firmante: 'Bruno Pablo Dos' }).quien, ['Envío automático', 'Firmó Bruno Dos']);
    assert.deepEqual(auditoria({ creado_por: 'Carla Inés Tres', firmante: 'Bruno Pablo Dos' }).quien, ['Generada por Carla Tres', 'Firmó Bruno Dos']);
    // Sin los campos (como en los casos reales, que no tienen auditorías), envío automático
    assert.deepEqual(movimientosDe(con(52, { auditorias: [{ id: 33, numero: 8, anio: 2026, fecha: '2026-10-20', estado: 'enviada', cambio_id: 51,
      seccion: 'nuevo' }] })).find((x) => x.tipo === 'auditoria').quien, ['Envío automático']);
  });

  it('una auditoría pendiente o fallida tampoco es un aviso del ciclo', () => {
    const fuentes = solo({ proxima: '2026-10-31' }, { auditorias: [{ id: 34, numero: 9, anio: 2026, fecha: '2026-10-15', estado: 'pendiente', cambio_id: 51,
      seccion: 'nuevo', creado_por: null, firmante: null }] });
    const ciclos = ciclosDe(fuentes, HOY);
    assert.equal(avisosDelCiclo(fuentes, ciclos, ciclos.length - 1).total, 0);
    assert.equal(ultimoAviso(fuentes), null);
  });

  it('un eliminar aprobado da "Baja del RPAD"', () => {
    const m = movimientosDe(con(52, { cambios: [cambio({ id: 61, tipo: 'eliminar', nuevos: {}, anteriores: {} })] }));
    const b = m.find((x) => x.extra.cambio_id === 61);
    assert.deepEqual([b.tipo, b.titulo, b.detalle, b.fecha, b.momento, b.filtro], ['baja', 'Baja del RPAD', 'Cambio #61.', '2026-03-02', '2026-03-02 11:00:00', 'altas']);
    assert.deepEqual(b.quien, ['Propuso Ana Uno', 'Aprobó Bruno Dos']);
  });

  it('un eliminar rechazado y uno pendiente', () => {
    const rech = movimientosDe(con(52, { cambios: [cambio({ id: 62, tipo: 'eliminar', estado: 'rechazado', motivo: 'Todavía se usa' })] }))
      .find((x) => x.extra.cambio_id === 62);
    assert.deepEqual([rech.tipo, rech.titulo, rech.detalle], ['rech', 'Propuesta rechazada', 'Pedía dar de baja el dataset. Motivo: "Todavía se usa". Cambio #62.']);
    const pend = movimientosDe(con(52, { cambios: [cambio({ id: 63, tipo: 'eliminar', estado: 'pendiente', revisado: null, reviso: null })] }))
      .find((x) => x.extra.cambio_id === 63);
    assert.deepEqual([pend.tipo, pend.titulo, pend.fecha, pend.momento, pend.quien, pend.filtro],
      ['cambiop', 'Baja pendiente de aprobación', '2026-03-02', '2026-03-02 10:00:00', ['Propuso Ana Uno'], 'propuestas']);
    assert.match(pend.detalle, /Cambio #63\.$/);
  });

  it('un rechazado sin motivo no dice "Motivo"', () => {
    const r = movimientosDe(con(52, { cambios: [cambio({ id: 64, estado: 'rechazado', motivo: null, nuevos: { datos_al: '2026-06-30' }, anteriores: { datos_al: '2025-12-31' } })] }))
      .find((x) => x.extra.cambio_id === 64);
    assert.equal(r.detalle, 'Datos al 30/06/2026. Cambio #64.');
    assert.deepEqual(r.quien, ['Propuso Ana Uno', 'Rechazó Bruno Dos']);
  });

  it('un pendiente que no cambia la carga es un cambio pendiente', () => {
    const p = movimientosDe(con(52, { cambios: [cambio({ id: 65, estado: 'pendiente', revisado: null, reviso: null,
      nuevos: { observaciones: 'Hay una nueva' }, anteriores: { observaciones: null } })] })).find((x) => x.extra.cambio_id === 65);
    assert.deepEqual([p.tipo, p.titulo, p.detalle, p.filtro], ['cambiop', 'Cambio pendiente de aprobación', 'Cambió: observaciones. Cambio #65.', 'propuestas']);
    assert.equal(p.extra.revisado, null);
    assert.equal(p.extra.creado, '2026-03-02 10:00:00');
  });

  it('solo cuentan los campos que están en nuevos y difieren de anteriores', () => {
    const m = movimientosDe(con(52, { cambios: [cambio({ id: 66,
      nuevos: { datos_al: '2025-12-31', tema_principal_id: 4, observaciones: null, notas: 'algo', registro_actualizacion: true, formatos: [2, 1] },
      anteriores: { datos_al: '2025-12-31T03:00:00.000Z', tema_principal_id: '4', observaciones: '', formatos: [1, 2], titulo: 'No está en nuevos' } })] }));
    const c = m.find((x) => x.extra.cambio_id === 66);
    assert.equal(c.detalle, 'Cambio #66.');
    assert.deepEqual(c.extra.campos, []);
  });

  it('"Cambió:" junta los rótulos en minúscula, en el orden de la lista', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 67,
      nuevos: { formatos: [1, 3], tema_secundario_id: 2, tipo_gestion: 'interna', tipo_pedido: 'acumulado', observaciones: 'Nueva', que_se_solicita: 'Otro',
        url_dataset: 'https://x.test/a', descripcion: 'Nueva descripción', titulo: 'Nuevo título', tema_principal_id: 5 },
      anteriores: { formatos: [1, 2], tema_secundario_id: null, tipo_gestion: 'externa', tipo_pedido: 'foto', observaciones: null, que_se_solicita: 'Uno',
        url_dataset: 'https://x.test/b', descripcion: 'Vieja', titulo: 'Título', tema_principal_id: 4 } })] })).find((x) => x.extra.cambio_id === 67);
    assert.equal(c.detalle, 'Cambió: título, descripción, URL en el portal, qué se solicita, observaciones, tipo de pedido, gestión, tema principal, tema secundario, formatos. Cambio #67.');
    assert.deepEqual(c.extra.campos.map((x) => x.campo), ['Título', 'Descripción', 'URL en el portal', 'Qué se solicita', 'Observaciones', 'Tipo de pedido',
      'Gestión', 'Tema principal', 'Tema secundario', 'Formatos']);
    const por = Object.fromEntries(c.extra.campos.map((x) => [x.campo, x]));
    assert.deepEqual(por['Título'], { campo: 'Título', antes: 'Título', despues: 'Nuevo título' });
    assert.deepEqual(por.Observaciones, { campo: 'Observaciones', antes: '—', despues: 'Nueva' });
    assert.deepEqual(por['Tema principal'], { campo: 'Tema principal', antes: '4', despues: '5' });
    assert.deepEqual(por.Formatos, { campo: 'Formatos', antes: '1, 2', despues: '1, 3' });
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.3): de la base llega 0 o 1; el 0 es un valor
  it('un cambio de solo requiere_nota dice «Cambió: requiere nota DGMIT» con de Sí a No', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 72, nuevos: { requiere_nota: 0 }, anteriores: { requiere_nota: 1 } })] }))
      .find((x) => x.extra.cambio_id === 72);
    assert.equal(c.detalle, 'Cambió: requiere nota DGMIT. Cambio #72.');
    assert.deepEqual(c.extra.campos, [{ campo: 'Requiere nota DGMIT', antes: 'Sí', despues: 'No' }]);
    assert.equal(c.tipo, 'cambio');
  });

  it('requiere_nota: de — a Sí y de Sí a — (sin dato es la raya, como los demás campos del movimiento); si no cambia (1 contra "1"), no es un cambio', () => {
    const campos = (anterior, nuevo, id) => movimientosDe(con(52, { cambios: [cambio({ id, nuevos: { requiere_nota: nuevo }, anteriores: { requiere_nota: anterior } })] }))
      .find((x) => x.extra.cambio_id === id).extra.campos;
    assert.deepEqual(campos(null, 1, 73), [{ campo: 'Requiere nota DGMIT', antes: '—', despues: 'Sí' }]);
    assert.deepEqual(campos(1, null, 74), [{ campo: 'Requiere nota DGMIT', antes: 'Sí', despues: '—' }]);
    assert.deepEqual(campos(undefined, 0, 79), [{ campo: 'Requiere nota DGMIT', antes: '—', despues: 'No' }]);
    assert.ok(!JSON.stringify(campos(null, 1, 80)).includes('Sin dato'));
    assert.deepEqual(campos(0, 1, 75), [{ campo: 'Requiere nota DGMIT', antes: 'No', despues: 'Sí' }]);
    assert.deepEqual(campos(1, '1', 76), []);
    assert.deepEqual(campos(0, false, 77), []);
  });

  it('«requiere nota DGMIT» va después de la gestión y antes de los temas en «Cambió:»', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 78,
      nuevos: { tema_principal_id: 5, requiere_nota: 0, tipo_gestion: 'interna', tipo_pedido: 'acumulado', observaciones: 'Nueva' },
      anteriores: { tema_principal_id: 4, requiere_nota: 1, tipo_gestion: 'externa', tipo_pedido: 'foto', observaciones: null } })] }))
      .find((x) => x.extra.cambio_id === 78);
    assert.equal(c.detalle, 'Cambió: observaciones, tipo de pedido, gestión, requiere nota DGMIT, tema principal. Cambio #78.');
    assert.deepEqual(c.extra.campos.map((x) => x.campo), ['Observaciones', 'Tipo de pedido', 'Gestión', 'Requiere nota DGMIT', 'Tema principal']);
  });

  it('con los catálogos de temas y formatos, el antes y el después dicen los nombres (los formatos, en orden alfabético)', () => {
    const catalogos = { ...CATALOGOS, temas: { 2: 'Economía', 4: 'Salud', 5: 'Ambiente' }, formatos: { 1: 'XLSX', 2: 'CSV', 3: 'JSON' } };
    const fuentes = { ...con(52, { cambios: [cambio({ id: 68,
      nuevos: { tema_principal_id: 5, tema_secundario_id: '2', formatos: [3, 1, 9] },
      anteriores: { tema_principal_id: 4, tema_secundario_id: null, formatos: ['2', 1] } })] }), catalogos };
    const c = movimientosDe(fuentes).find((x) => x.extra.cambio_id === 68);
    assert.equal(c.detalle, 'Cambió: tema principal, tema secundario, formatos. Cambio #68.');
    assert.deepEqual(c.extra.campos, [
      { campo: 'Tema principal', antes: 'Salud', despues: 'Ambiente' },
      { campo: 'Tema secundario', antes: '—', despues: 'Economía' },
      // Un id que no está en el catálogo queda como id
      { campo: 'Formatos', antes: 'CSV, XLSX', despues: '9, JSON, XLSX' }
    ]);
  });

  it('un cambio mezcla frases propias con "Cambió:" al final', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 68,
      nuevos: { titulo: 'Nuevo', area_id: 20, frecuencia_id: 6, datos_al: '2026-06-30' },
      anteriores: { titulo: 'Viejo', area_id: 19, frecuencia_id: 5, datos_al: '2025-12-31' } })] })).find((x) => x.extra.cambio_id === 68);
    assert.equal(c.detalle, 'Datos al 30/06/2026. Frecuencia: Cada medio año a Anualmente. Área: Dirección General de Relaciones Laborales a Dirección General de Servicios Administrativos. Cambió: título. Cambio #68.');
    assert.deepEqual(c.extra.campos, [
      { campo: 'Datos al', antes: '31/12/2025', despues: '30/06/2026' },
      { campo: 'Frecuencia', antes: 'Cada medio año', despues: 'Anualmente' },
      { campo: 'Área responsable', antes: 'Dirección General de Relaciones Laborales', despues: 'Dirección General de Servicios Administrativos' },
      { campo: 'Título', antes: 'Viejo', despues: 'Nuevo' }
    ]);
    assert.equal(c.tipo, 'cambio');
    assert.equal(c.fecha, '2026-03-02');
  });

  it('la próxima: si cambió la carga, solo la nueva; si no, de una a otra', () => {
    const carga = movimientosDe(con(52, { cambios: [cambio({ id: 69, nuevos: { ultima_actualizacion: '2026-03-01', proxima_actualizacion: '2027-01-31' },
      anteriores: { ultima_actualizacion: '2026-02-04T03:00:00.000Z', proxima_actualizacion: '2026-07-31T03:00:00.000Z' } })] })).find((x) => x.extra.cambio_id === 69);
    assert.equal(carga.detalle, 'Cargado en el portal el 01/03/2026. Próxima: 31/01/2027. Cambio #69.');
    assert.deepEqual(carga.extra.campos, [
      { campo: 'Cargado en el portal', antes: '04/02/2026', despues: '01/03/2026' },
      { campo: 'Próxima actualización', antes: '31/07/2026', despues: '31/01/2027' }
    ]);
    assert.deepEqual([carga.tipo, carga.fecha, carga.momento, carga.filtro], ['act', '2026-03-01', '2026-03-02 11:00:00', 'actualizaciones']);
    const sola = movimientosDe(con(52, { cambios: [cambio({ id: 70, nuevos: { proxima_actualizacion: '2026-09-30' }, anteriores: { proxima_actualizacion: '2026-07-31' } })] }))
      .find((x) => x.extra.cambio_id === 70);
    assert.equal(sola.detalle, 'Próxima: 31/07/2026 a 30/09/2026. Cambio #70.');
  });

  it('una carga con el mismo día no la mueve: es un cambio en la ficha, el día de la aprobación', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 71, nuevos: { ultima_actualizacion: '2026-02-04' }, anteriores: { ultima_actualizacion: '2026-02-04T03:00:00.000Z' } })] }))
      .find((x) => x.extra.cambio_id === 71);
    assert.deepEqual([c.tipo, c.fecha, c.titulo], ['cambio', '2026-03-02', 'Cambio en la ficha']);
  });

  it('el extra de un cambio trae el momento de la propuesta y el de la revisión', () => {
    const c = movimientosDe(f(52)).find((x) => x.extra.cambio_id === 7);
    assert.equal(c.extra.creado, '2026-02-04 09:57:46');
    assert.equal(c.extra.revisado, '2026-02-04 09:58:15');
    assert.equal(c.momento, '2026-02-04 09:58:15');
    assert.equal(c.filtro, 'actualizaciones');
    assert.deepEqual(c.extra.campos, [
      { campo: 'Cargado en el portal', antes: '17/12/2025', despues: '04/02/2026' },
      { campo: 'Próxima actualización', antes: '31/01/2026', despues: '31/07/2026' }
    ]);
  });

  it('el extra del alta y del historial', () => {
    const m = movimientosDe(f(81));
    assert.deepEqual(m.at(-1).extra, { cambio_id: 50 });
    assert.equal(m.at(-1).filtro, 'altas');
    const sin = movimientosDe(f(52));
    assert.deepEqual(sin.at(-1).extra, { cambio_id: null });
    const h = sin.at(-2);
    assert.deepEqual([h.tipo, h.filtro, h.fecha, h.momento, h.quien, h.extra.cambio_id], ['act', 'actualizaciones', '2025-12-17', '2025-12-17 08:54:29', ['Ana Uno'], null]);
  });

  it('el orden: la fecha, después el momento y después el id, de mayor a menor', () => {
    const base = f(52);
    base.cambios = [
      cambio({ id: 80, estado: 'rechazado', revisado: '2026-11-02 09:00:00', creado: '2026-11-02 08:00:00', nuevos: { datos_al: '2026-06-30' } }),
      cambio({ id: 82, estado: 'rechazado', revisado: '2026-11-02 09:00:00', creado: '2026-11-02 08:00:00', nuevos: { datos_al: '2026-06-30' } }),
      cambio({ id: 81, estado: 'rechazado', revisado: '2026-11-02 09:00:00', creado: '2026-11-02 08:00:00', nuevos: { datos_al: '2026-06-30' } }),
      cambio({ id: 83, estado: 'rechazado', revisado: '2026-11-02 13:00:00', creado: '2026-11-02 08:00:00', nuevos: { datos_al: '2026-06-30' } }),
      cambio({ id: 84, estado: 'aprobado', revisado: '2026-11-02 07:00:00', creado: '2026-11-01 08:00:00', nuevos: { ultima_actualizacion: '2026-11-03' }, anteriores: { ultima_actualizacion: '2026-02-04' } })
    ];
    base.emails = []; base.notas = []; base.historial = [];
    const ids = movimientosDe(base).map((x) => x.extra.cambio_id);
    assert.deepEqual(ids.slice(0, 5), [84, 83, 82, 81, 80]);
  });
});

describe('movimientosDe: datos raros', () => {
  it('sin nada, solo la carga inicial', () => {
    const m = movimientosDe({ dataset: { ...CASOS[52].dataset }, altasSinDataset: [], cambios: [], historial: [], emails: [], notas: [], auditorias: [], catalogos: CATALOGOS });
    assert.equal(m.length, 1);
    assert.equal(m[0].tipo, 'alta');
  });

  it('con las listas ausentes o nulas no tira error', () => {
    assert.doesNotThrow(() => movimientosDe({ dataset: CASOS[52].dataset }));
    assert.doesNotThrow(() => movimientosDe({ dataset: CASOS[52].dataset, cambios: null, emails: null, notas: null, auditorias: null, historial: null, altasSinDataset: null, catalogos: null }));
    assert.deepEqual(movimientosDe({}), []);
    assert.deepEqual(movimientosDe(null), []);
  });

  it('fechas raras: una carga null, una próxima que no es fin de mes y un id que no está en el catálogo no tiran error', () => {
    const c = movimientosDe(con(52, { cambios: [cambio({ id: 90,
      nuevos: { ultima_actualizacion: null, proxima_actualizacion: '2027-03-29', area_id: 999, frecuencia_id: null },
      anteriores: { ultima_actualizacion: '2026-02-04', proxima_actualizacion: null, area_id: 19, frecuencia_id: 5 } })] })).find((x) => x.extra.cambio_id === 90);
    assert.equal(c.tipo, 'act');
    assert.match(c.fecha, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(c.detalle, /Próxima: 29\/03\/2027\./);
    assert.match(c.detalle, /Área: Dirección General de Relaciones Laborales a 999\./);
    assert.match(c.detalle, /Cambio #90\.$/);
  });

  it('un alta el mismo día que hoy y una carga inicial sin hora no tiran error', () => {
    const fuentes = f(81);
    fuentes.dataset = { ...fuentes.dataset, alta: '2026-10-20 08:00:00' };
    assert.doesNotThrow(() => movimientosDe(fuentes));
    const sinHora = f(52);
    sinHora.dataset = { ...sinHora.dataset, alta: null };
    assert.doesNotThrow(() => movimientosDe(sinHora));
    assert.equal(movimientosDe(sinHora).some((x) => x.tipo === 'alta'), false);
  });

  it('los textos con comillas, raya o etiquetas pasan tal cual: escapar es cosa de quien dibuja', () => {
    const r = movimientosDe(con(52, { cambios: [cambio({ id: 91, estado: 'rechazado', motivo: 'Dice "<b>x</b>" — raya', nuevos: { titulo: '<i>Nuevo</i>' }, anteriores: { titulo: 'Viejo' } })] }))
      .find((x) => x.extra.cambio_id === 91);
    assert.equal(r.detalle, 'Cambió: título. Motivo: "Dice "<b>x</b>" — raya". Cambio #91.');
    assert.equal(r.extra.campos[0].despues, '<i>Nuevo</i>');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Ciclos, avisos, hitos, estado y circuito
// ---------------------------------------------------------------------------------------------------------------------

// Los valores reales de los casos al 20/10/2026: por ciclo, [vencimiento, cierre, cómo se cerró, días que estuvo vencido]. Las
// actualizaciones simples de diciembre de 2025 (historial sin cambio_id) cierran un ciclo cuyo vencimiento no quedó registrado
// (null), salvo las que después se deshicieron (1, 9, 10 y 61: la tanda del 17/12/2025, cuya carga volvió atrás)
const SIMPLE_17 = [null, '2025-12-17', 'actualizacion', 0];
const SIMPLE_16 = [null, '2025-12-16', 'actualizacion', 0];
const CICLOS = {
  52: [SIMPLE_17, ['2026-01-31', '2026-02-04', 'actualizacion', 4], ['2026-07-31', null, null, 81]],
  9: [['2025-01-31', '2026-03-13', 'actualizacion', 406], ['2026-04-30', '2026-10-09', 'actualizacion', 162], ['2027-01-31', null, null, 0]],
  10: [['2026-01-31', '2026-02-18', 'actualizacion', 18], ['2026-05-31', '2026-05-22', 'actualizacion', 0], ['2026-07-31', '2026-09-25', 'actualizacion', 56],
    ['2026-10-31', '2026-10-13', 'actualizacion', 0], ['2027-01-31', null, null, 0]],
  42: [['2026-03-31', '2026-04-06', 'reprogramacion', 6], ['2027-04-30', null, null, 0]],
  38: [['2026-03-31', '2026-02-12', 'actualizacion', 0], ['2026-09-30', '2026-10-02', 'actualizacion', 2], ['2027-03-31', null, null, 0]],
  1: [['2026-01-31', null, null, 262]], 11: [['2024-01-31', null, null, 993]], 26: [['2025-03-31', null, null, 568]],
  33: [['2026-01-31', null, null, 262]], 81: [['2026-10-31', null, null, 0]], 61: [['2026-01-31', null, null, 262]],
  58: [SIMPLE_16, ['2026-11-30', null, null, 0]], 25: [SIMPLE_16, ['2027-11-30', null, null, 0]]
};
// Los avisos del ciclo abierto de cada caso. En 58 y 25, los emails de vencido del 06/12 y el 10/12/2025 son del ciclo de antes de
// la actualización simple del 16/12/2025: no cuentan
const ABIERTO = { 52: { emails: 5, notas: ['2/26'], alArea: ['2026-06-21'] }, 9: { emails: 0, notas: [], alArea: [] }, 10: { emails: 0, notas: [], alArea: [] },
  42: { emails: 0, notas: [], alArea: [] }, 1: { emails: 10, notas: ['2/26'], alArea: [] }, 11: { emails: 11, notas: ['2/26'], alArea: [] },
  33: { emails: 5, notas: ['2/26'], alArea: [] }, 61: { emails: 6, notas: ['2/26'], alArea: ['2025-12-22', '2026-06-21'] }, 81: { emails: 0, notas: ['3/26'], alArea: [] },
  58: { emails: 1, notas: [], alArea: [] }, 25: { emails: 0, notas: [], alArea: [] } };

const resumen = (id) => ciclosDe(f(id), HOY).map((c) => [c.venc, c.cierre, c.como, c.diasVencido]);
const abiertoDe = (id) => {
  const ciclos = ciclosDe(f(id), HOY);
  const { emails, notas, alArea } = avisosDelCiclo(f(id), ciclos, ciclos.length - 1);
  return { emails, notas, alArea };
};
// Fuentes de un dataset (por defecto, el del caso 52) sin más que su próxima, para armar ciclos a mano
const solo = (dataset, extra = {}) => ({
  dataset: { ...CASOS[52].dataset, ...dataset }, altasSinDataset: [], cambios: [], historial: [], emails: [], notas: [], auditorias: [], catalogos: CATALOGOS, ...extra
});
const email = (datos) => ({ id: 900, tipo: 'externo-5', enviado: '2026-10-05 08:00:00', success: true, cantidad: 1, area: null, area_articulo: null, destinatarios: null, error: null, ...datos });
const nota = (datos) => ({
  id: 900, numero: 5, anio: 2026, tipo: 'aviso', gestion: 'externa', fecha: '2026-10-15', estado: 'enviada', enviada: '2026-10-15 08:15:00',
  para: null, cc: null, seccion: 'proximo', vencimiento: '2026-10-31', datos_solicitados: null, creado_por: null, firmante: null, ...datos
});
// Una actualización: carga y próxima nuevas, aprobada en `revisado`
const actualizacion = (id, revisado, carga, proxima, anterior) => cambio({ id, revisado, nuevos: { ultima_actualizacion: carga, proxima_actualizacion: proxima },
  anteriores: { ultima_actualizacion: anterior.carga, proxima_actualizacion: anterior.proxima } });

describe('ciclosDe', () => {
  for (const [id, esperado] of Object.entries(CICLOS)) {
    it(`caso ${id}: vencimiento, cierre, cómo se cerró y días vencido`, () => {
      assert.deepEqual(resumen(id), esperado);
    });
  }

  it('sin ciclos: eventual (sin meses) y sin fecha (sin próxima)', () => {
    assert.equal(ciclosDe(f(66), HOY), null);
    assert.equal(ciclosDe(solo({ proxima: null }), HOY), null);
    assert.equal(ciclosDe(solo({ meses: 0 }), HOY), null);
    assert.equal(ciclosDe(solo({ meses: 1.5 }), HOY), null);
    assert.equal(ciclosDe(solo({ meses: '6' }), HOY), null);
    assert.equal(ciclosDe({}, HOY), null);
    assert.equal(ciclosDe(null, HOY), null);
  });

  it('cada ciclo trae inicio, desde, hasta y origen: el primero empieza en el alta y cada uno en la actualización que cerró el anterior', () => {
    const simple = CASOS[52].historial[0].creado;
    const [viejo, primero, abierto] = ciclosDe(f(52), HOY);
    assert.deepEqual(viejo, { inicio: '2025-12-01', venc: null, cierre: '2025-12-17', como: 'actualizacion',
      desde: '2025-12-01 21:51:48', hasta: simple, origen: 'alta', diasVencido: 0 });
    assert.deepEqual(primero, { inicio: '2025-12-17', venc: '2026-01-31', cierre: '2026-02-04', como: 'actualizacion',
      desde: simple, hasta: '2026-02-04 09:58:15', origen: 'actualizacion', diasVencido: 4 });
    assert.deepEqual(abierto, { inicio: '2026-02-04', venc: '2026-07-31', cierre: null, como: null,
      desde: '2026-02-04 09:58:15', hasta: null, origen: 'actualizacion', diasVencido: 81 });
  });

  it('el origen de cada ciclo: el alta, una actualización o una reprogramación después de vencer', () => {
    assert.deepEqual(ciclosDe(f(11), HOY).map((c) => c.origen), ['alta']);
    assert.deepEqual(ciclosDe(f(42), HOY).map((c) => c.origen), ['alta', 'reprogramacion']);
    assert.deepEqual(ciclosDe(f(38), HOY).map((c) => c.origen), ['alta', 'actualizacion', 'actualizacion']);
  });

  it('un ciclo cerrado por reprogramación lleva la próxima nueva', () => {
    const [cerrado, abierto] = ciclosDe(f(42), HOY);
    assert.equal(cerrado.como, 'reprogramacion');
    assert.equal(cerrado.nueva, '2027-04-30');
    assert.equal(cerrado.cierre, cerrado.hasta.slice(0, 10));
    assert.equal(abierto.inicio, '2026-04-06');
    assert.equal(abierto.desde, cerrado.hasta);
    assert.equal('nueva' in abierto, false);
  });

  it('el vencimiento del ciclo abierto es siempre la próxima actual, aunque el último cambio la haya dejado en otra', () => {
    assert.equal(ciclosDe(f(9), HOY).at(-1).venc, '2027-01-31');
  });

  // El caso 9 tiene la próxima corregida por SQL: su último cambio la dejó en el 31/12/2026 y hoy es el 31/01/2027. El cambio
  // siguiente trae en sus datos anteriores el 31/01/2027, y se mide contra esa fecha, no contra la que dejó el cambio de antes.
  const nueveCon = (datos, dataset = {}) => ({ ...f(9), dataset: { ...CASOS[9].dataset, ...dataset },
    cambios: [...CASOS[9].cambios, cambio({ dataset_id: 9, ...datos })] });

  it('el registro siguiente a una próxima corregida por SQL cierra el ciclo con la próxima anterior de ese cambio', () => {
    const fuentes = nueveCon({ id: 300, creado: '2027-02-04 10:00:00', revisado: '2027-02-05 10:00:00',
      nuevos: { ultima_actualizacion: '2027-02-03', proxima_actualizacion: '2027-07-31', registro_actualizacion: true },
      anteriores: { ultima_actualizacion: '2026-10-09', proxima_actualizacion: '2027-01-31' } }, { proxima: '2027-07-31' });
    const hoy = '2027-02-10';
    const ciclos = ciclosDe(fuentes, hoy);
    const cerrado = ciclos.at(-2);
    assert.deepEqual([cerrado.venc, cerrado.cierre, cerrado.como, cerrado.diasVencido], ['2027-01-31', '2027-02-03', 'actualizacion', 3]);
    assert.deepEqual(ciclos.at(-1).venc, '2027-07-31');
    assert.deepEqual(hitosDe(ciclos, hoy)[0], { fecha: '2027-01-31', tipo: 'actualizado',
      texto: 'Venció. Actualizado el 03/02/2027, 3 días después del vencimiento' });
  });

  it('una edición que no toca la próxima, después de una próxima corregida por SQL, no reprograma ni cierra nada', () => {
    const fuentes = nueveCon({ id: 301, creado: '2027-01-14 10:00:00', revisado: '2027-01-15 10:00:00',
      nuevos: { descripcion: 'Nueva descripción', proxima_actualizacion: '2027-01-31' },
      anteriores: { descripcion: 'Descripción anterior', proxima_actualizacion: '2027-01-31' } });
    const hoy = '2027-01-20';
    const ciclos = ciclosDe(fuentes, hoy);
    assert.equal(ciclos.some((c) => c.como === 'reprogramacion'), false);
    assert.deepEqual(ciclos.map((c) => [c.venc, c.cierre, c.como]), CICLOS[9].map(([venc, cierre, como]) => [venc, cierre, como]));
    assert.equal(seguimientoDe(fuentes, hoy).hitos.some((h) => h.tipo === 'reprogramado' || /Reprogramado/.test(h.texto)), false);
  });

  it('una reprogramación antes de vencer mueve la próxima dentro del mismo ciclo', () => {
    const fuentes = solo({ proxima: '2026-12-31', alta: '2026-01-10 09:00:00' }, { cambios: [cambio({
      id: 70, revisado: '2026-02-01 10:00:00', nuevos: { proxima_actualizacion: '2026-12-31' }, anteriores: { proxima_actualizacion: '2026-06-30' } })] });
    const ciclos = ciclosDe(fuentes, HOY);
    assert.equal(ciclos.length, 1);
    assert.deepEqual([ciclos[0].venc, ciclos[0].cierre, ciclos[0].diasVencido], ['2026-12-31', null, 0]);
  });

  it('una reprogramación después de vencer cierra el ciclo "reprogramado" en el día de la aprobación', () => {
    const fuentes = solo({ proxima: '2026-12-31', alta: '2026-01-10 09:00:00' }, { cambios: [cambio({
      id: 70, revisado: '2026-07-10 10:00:00', nuevos: { proxima_actualizacion: '2026-12-31' }, anteriores: { proxima_actualizacion: '2026-06-30' } })] });
    assert.deepEqual(ciclosDe(fuentes, HOY).map((c) => [c.venc, c.cierre, c.como, c.diasVencido]),
      [['2026-06-30', '2026-07-10', 'reprogramacion', 10], ['2026-12-31', null, null, 0]]);
  });

  it('una aprobación el mismo día del vencimiento todavía es "antes de vencer"', () => {
    const fuentes = solo({ proxima: '2026-12-31', alta: '2026-01-10 09:00:00' }, { cambios: [cambio({
      id: 70, revisado: '2026-06-30 10:00:00', nuevos: { proxima_actualizacion: '2026-12-31' }, anteriores: { proxima_actualizacion: '2026-06-30' } })] });
    assert.equal(ciclosDe(fuentes, HOY).length, 1);
  });

  it('un cambio que solo cambia "Cargado en el portal" no cierra el ciclo', () => {
    const fuentes = solo({ proxima: '2026-12-31', alta: '2026-01-10 09:00:00' }, { cambios: [cambio({ id: 70, revisado: '2026-03-01 10:00:00',
      nuevos: { ultima_actualizacion: '2026-03-01' }, anteriores: { ultima_actualizacion: '2026-01-05', proxima_actualizacion: '2026-12-31' } })] });
    assert.equal(ciclosDe(fuentes, HOY).length, 1);
  });

  it('los cambios se ordenan por el momento de la aprobación y después por id, no por cómo vienen', () => {
    const a = actualizacion(71, '2026-03-01 10:00:00', '2026-02-20', '2026-08-31', { carga: '2026-01-05', proxima: '2026-02-28' });
    const b = actualizacion(70, '2026-09-05 10:00:00', '2026-09-04', '2027-02-28', { carga: '2026-02-20', proxima: '2026-08-31' });
    const base = { proxima: '2027-02-28', alta: '2026-01-02 09:00:00' };
    const derecho = ciclosDe(solo(base, { cambios: [a, b] }), HOY);
    assert.deepEqual(ciclosDe(solo(base, { cambios: [b, a] }), HOY), derecho);
    assert.deepEqual(derecho.map((c) => [c.venc, c.cierre, c.diasVencido]), [['2026-02-28', '2026-02-20', 0], ['2026-08-31', '2026-09-04', 4], ['2027-02-28', null, 0]]);
  });

  it('solo cuentan los cambios editar aprobados: los pendientes y los rechazados no abren ni cierran ciclos', () => {
    const nuevos = { ultima_actualizacion: '2026-03-01', proxima_actualizacion: '2027-06-30' };
    const anteriores = { ultima_actualizacion: '2026-01-05', proxima_actualizacion: '2026-12-31' };
    const fuentes = solo({ proxima: '2026-12-31', alta: '2026-01-10 09:00:00' }, { cambios: [
      cambio({ id: 70, estado: 'rechazado', nuevos, anteriores }), cambio({ id: 71, estado: 'pendiente', revisado: null, nuevos, anteriores })] });
    assert.equal(ciclosDe(fuentes, HOY).length, 1);
  });

  it('una baja aprobada cierra el ciclo abierto como "baja", en su momento', () => {
    const fuentes = solo({ proxima: '2026-07-31', activo: false }, { cambios: [...CASOS[52].cambios,
      cambio({ id: 95, tipo: 'eliminar', creado: '2026-09-01 10:00:00', revisado: '2026-09-02 11:00:00' })] });
    const abierto = ciclosDe(fuentes, HOY).at(-1);
    assert.deepEqual([abierto.venc, abierto.cierre, abierto.como, abierto.hasta, abierto.diasVencido], ['2026-07-31', '2026-09-02', 'baja', '2026-09-02 11:00:00', 33]);
  });

  it('una baja pendiente no cierra nada', () => {
    const fuentes = solo({ proxima: '2026-07-31' }, { cambios: [cambio({ id: 95, tipo: 'eliminar', estado: 'pendiente', revisado: null })] });
    assert.equal(ciclosDe(fuentes, HOY).at(-1).como, null);
  });

  it('fechas raras: sin "Cargado en el portal" ni "Datos al", y un alta de hoy a las 9, no tiran error', () => {
    const sinFechas = f(38);
    sinFechas.dataset = { ...sinFechas.dataset, ultima: null, datos_al: null };
    assert.doesNotThrow(() => circuitoDe(sinFechas, ciclosDe(sinFechas, HOY), HOY));
    assert.equal(ciclosDe(sinFechas, HOY).length, 3);
    const deHoy = f(38);
    deHoy.dataset = { ...deHoy.dataset, alta: `${HOY} 09:00:00` };
    assert.doesNotThrow(() => circuitoDe(deHoy, ciclosDe(deHoy, HOY), HOY));
    assert.ok(Array.isArray(ciclosDe(deHoy, HOY)));
  });

  it('una próxima que no es fin de mes, una carga null, un alta sin fecha y listas ausentes no tiran error', () => {
    const fuentes = con(52, { cambios: [cambio({ id: 90, nuevos: { ultima_actualizacion: null, proxima_actualizacion: '2027-03-29' },
      anteriores: { ultima_actualizacion: '2026-02-04', proxima_actualizacion: null } })] });
    assert.doesNotThrow(() => ciclosDe(fuentes, HOY));
    assert.doesNotThrow(() => ciclosDe({ dataset: CASOS[52].dataset, cambios: null }, HOY));
    assert.equal(ciclosDe({ dataset: CASOS[52].dataset }, HOY).length, 1);
    assert.doesNotThrow(() => ciclosDe(solo({ alta: null }), HOY));
    assert.equal(ciclosDe(f(52), 'hoy'), null);
  });
});

// Antes de la doble verificación (diciembre de 2025), el botón de actualizar movía la carga y la próxima en el momento y dejaba una
// fila en el historial sin cambio_id; la próxima anterior no quedó guardada en ningún lado
describe('ciclosDe: actualizaciones anteriores a la doble verificación (historial sin cambio_id)', () => {
  const simple = (fecha, creado = `${fecha} 10:00:00`, cambio_id = null) => ({ fecha, creado, usuario: 'Ana María Uno', cambio_id });

  it('58 y 25: la actualización del 16/12/2025 cierra el ciclo y los emails de vencido de antes quedan en el ciclo viejo', () => {
    const c58 = ciclosDe(f(58), HOY);
    assert.equal(avisosDelCiclo(f(58), c58, 0).emails, 2);
    assert.equal(avisosDelCiclo(f(58), c58, 1).emails, 1);
    assert.deepEqual([c58[1].inicio, c58[1].desde, c58[1].origen], ['2025-12-16', CASOS[58].historial[0].creado, 'actualizacion']);
    const c25 = ciclosDe(f(25), HOY);
    assert.equal(avisosDelCiclo(f(25), c25, 0).emails, 2);
    assert.equal(avisosDelCiclo(f(25), c25, 1).total, 0);
  });

  it('varias el mismo día cuentan como una: 25 tiene dos el 16/12/2025 y un solo corte', () => {
    assert.equal(CASOS[25].historial.length, 2);
    assert.equal(ciclosDe(f(25), HOY).length, 2);
  });

  it('en días distintos cada una cierra un ciclo, y un aviso de entre las dos queda en el del medio', () => {
    const fuentes = solo({ proxima: '2026-11-30', alta: '2025-12-01 09:00:00' }, {
      historial: [simple('2025-12-16'), simple('2025-12-15')],
      emails: [email({ id: 1, tipo: 'externo-vencido', enviado: '2025-12-15 12:00:00' }), email({ id: 2, tipo: 'externo-60', enviado: '2026-10-01 08:00:00' })]
    });
    const ciclos = ciclosDe(fuentes, HOY);
    assert.deepEqual(ciclos.map((c) => [c.inicio, c.venc, c.cierre, c.origen]), [['2025-12-01', null, '2025-12-15', 'alta'],
      ['2025-12-15', null, '2025-12-16', 'actualizacion'], ['2025-12-16', '2026-11-30', null, 'actualizacion']]);
    assert.deepEqual([0, 1, 2].map((i) => avisosDelCiclo(fuentes, ciclos, i).emails), [0, 1, 1]);
  });

  it('una fila del historial con cambio_id es la del cambio: no corta nada', () => {
    const fuentes = solo({ proxima: '2026-11-30', alta: '2025-12-01 09:00:00' }, { historial: [simple('2026-03-10', '2026-03-10 10:00:00', 77)] });
    assert.equal(ciclosDe(fuentes, HOY).length, 1);
  });

  it('después de un cambio aprobado, el ciclo que cierra conoce su vencimiento y cuánto estuvo vencido', () => {
    const fuentes = solo({ proxima: '2026-11-30', alta: '2026-01-10 09:00:00', ultima: '2026-06-10' }, {
      cambios: [actualizacion(71, '2026-02-01 10:00:00', '2026-02-01', '2026-05-31', { carga: '2026-01-10', proxima: '2026-03-31' })],
      historial: [simple('2026-06-10')]
    });
    const ciclos = ciclosDe(fuentes, HOY);
    assert.deepEqual(ciclos.map((c) => [c.venc, c.cierre, c.como, c.diasVencido, c.origen]), [['2026-03-31', '2026-02-01', 'actualizacion', 0, 'alta'],
      ['2026-05-31', '2026-06-10', 'actualizacion', 10, 'actualizacion'], ['2026-11-30', null, null, 0, 'actualizacion']]);
    assert.deepEqual(hitosDe(ciclos, HOY)[0], { fecha: '2026-05-31', tipo: 'actualizado', texto: 'Venció. Actualizado el 10/06/2026, 10 días después del vencimiento' });
  });

  it('un ciclo sin vencimiento conocido no tiene días vencido ni hito', () => {
    const ciclos = ciclosDe(f(58), HOY);
    assert.equal(ciclos[0].diasVencido, 0);
    assert.deepEqual(hitosDe(ciclos, HOY), []);
  });

  it('sin alta conocida, lo de antes de la primera simple no se conoce: el primer ciclo es el que ella abre', () => {
    const ciclos = ciclosDe(solo({ proxima: '2026-11-30', alta: null }, { historial: [simple('2025-12-16')] }), HOY);
    assert.deepEqual(ciclos.map((c) => [c.inicio, c.venc, c.cierre, c.origen]), [['2025-12-16', '2026-11-30', null, 'actualizacion']]);
    // sin simples, como siempre: el primer ciclo empieza en el vencimiento
    assert.deepEqual(ciclosDe(solo({ proxima: '2026-11-30', alta: null }), HOY).map((c) => [c.inicio, c.venc]), [['2026-11-30', '2026-11-30']]);
  });

  it('una que después se deshizo no corta el ciclo: 1 y 61 (la carga de hoy es anterior) y 9 y 10 (la del cambio siguiente)', () => {
    for (const id of [1, 61, 9, 10]) assert.equal(ciclosDe(f(id), HOY)[0].origen, 'alta', `caso ${id}`);
    const alta1 = CASOS[1].dataset.alta.slice(0, 10).split('-').reverse().join('/');
    assert.equal(circuitoDe(f(1), ciclosDe(f(1), HOY), HOY).desde.texto, `Desde el alta del ${alta1}`);
    // la de 52 quedó: el cambio siguiente (#7) trae como carga anterior el 17/12/2025
    assert.equal(ciclosDe(f(52), HOY)[1].inicio, '2025-12-17');
  });

  it('se deshizo si la carga que sigue (la anterior del cambio aprobado siguiente que la trae, o la de hoy) es de antes', () => {
    const fuentesCon = (ultima, cambios = []) => solo({ proxima: '2026-11-30', alta: '2025-12-01 09:00:00', ultima }, { historial: [simple('2025-12-16')], cambios });
    const cuantos = (ultima, cambios) => ciclosDe(fuentesCon(ultima, cambios), HOY).length;
    assert.equal(cuantos('2025-07-31'), 1);
    assert.equal(cuantos('2025-12-16'), 2);
    assert.equal(cuantos('2026-03-04'), 2);
    assert.equal(cuantos(null), 2, 'sin carga conocida, cuenta');
    const siguiente = (carga) => [actualizacion(82, '2026-03-05 10:00:00', '2026-03-04', '2026-11-30', { carga, proxima: '2026-02-28' })];
    assert.equal(cuantos('2026-03-04', siguiente('2025-07-31')), 2, 'deshecha: solo el cambio siguiente cierra un ciclo');
    assert.equal(ciclosDe(fuentesCon('2026-03-04', siguiente('2025-07-31')), HOY)[0].inicio, '2025-12-01');
    assert.equal(cuantos('2026-03-04', siguiente('2025-12-16')), 3, 'quedó: tres ciclos');
  });

  it('el vencimiento inicial sale solo de los cambios de antes de la primera simple', () => {
    const fuentes = solo({ proxima: '2026-08-31', alta: '2025-11-01 09:00:00', ultima: '2026-03-04' }, {
      cambios: [cambio({ id: 80, creado: '2025-11-20 09:00:00', revisado: '2025-11-20 10:00:00', nuevos: { descripcion: 'Nueva' }, anteriores: { descripcion: 'Vieja' } }),
        actualizacion(81, '2026-03-05 10:00:00', '2026-03-04', '2026-08-31', { carga: '2025-12-16', proxima: '2026-02-28' })],
      historial: [simple('2025-12-16')]
    });
    assert.deepEqual(ciclosDe(fuentes, HOY).map((c) => [c.venc, c.cierre, c.como]), [[null, '2025-12-16', 'actualizacion'],
      ['2026-02-28', '2026-03-04', 'actualizacion'], ['2026-08-31', null, null]]);
  });

  it('un cambio sin próxima anterior después de una simple: el ciclo cierra sin vencimiento conocido y no tira error', () => {
    const fuentes = solo({ proxima: '2026-08-31', alta: '2025-12-01 09:00:00', ultima: '2026-03-04' }, {
      cambios: [cambio({ id: 83, revisado: '2026-03-05 10:00:00', nuevos: { ultima_actualizacion: '2026-03-04', proxima_actualizacion: '2026-08-31' }, anteriores: {} })],
      historial: [simple('2025-12-16')]
    });
    assert.deepEqual(ciclosDe(fuentes, HOY).map((c) => [c.venc, c.cierre, c.como, c.diasVencido]), [[null, '2025-12-16', 'actualizacion', 0],
      [null, '2026-03-04', 'actualizacion', 0], ['2026-08-31', null, null, 50]]);
    assert.doesNotThrow(() => seguimientoDe(fuentes, HOY));
  });

  it('el mismo día, un aviso de antes del registro de la simple es del ciclo viejo y uno desde ese momento, del nuevo', () => {
    const fuentes = solo({ proxima: '2026-11-30', alta: '2025-12-01 09:00:00' }, {
      historial: [simple('2025-12-16', '2025-12-16 11:00:00')],
      emails: [email({ id: 1, tipo: 'externo-vencido', enviado: '2025-12-16 10:59:59' }), email({ id: 2, tipo: 'externo-vencido', enviado: '2025-12-16 11:00:00' })]
    });
    const ciclos = ciclosDe(fuentes, HOY);
    assert.deepEqual([0, 1].map((i) => avisosDelCiclo(fuentes, ciclos, i).emails), [1, 1]);
  });

  it('con datos raros en el historial no tira error y los ignora', () => {
    const fuentes = solo({ proxima: '2026-11-30', alta: '2025-12-01 09:00:00' }, { historial: [null, 'x', { fecha: 'mal', cambio_id: null }, { creado: '2025-12-16 10:00:00' }] });
    assert.doesNotThrow(() => ciclosDe(fuentes, HOY));
    assert.equal(ciclosDe(fuentes, HOY).length, 1);
    assert.doesNotThrow(() => seguimientoDe({ ...fuentes, historial: 'no es una lista' }, HOY));
  });
});

describe('cicloDelAviso', () => {
  const ciclos = ciclosDe(f(10), HOY);

  it('con vencimiento, el ciclo que lo tiene', () => {
    assert.equal(cicloDelAviso(ciclos, '2026-10-13 14:00:00', '2026-10-31'), 3);
    assert.equal(cicloDelAviso(ciclos, '2026-10-13 14:00:00', '2027-01-31'), 4);
  });
  it('sin vencimiento, o con uno que ningún ciclo tiene, el ciclo que regía en el momento', () => {
    assert.equal(cicloDelAviso(ciclos, '2026-02-10 08:00:00'), 0);
    assert.equal(cicloDelAviso(ciclos, '2026-10-20 08:00:00'), 4);
    assert.equal(cicloDelAviso(ciclos, '2026-10-20 08:00:00', '2030-01-31'), 4);
    assert.equal(cicloDelAviso(ciclos, '2026-03-10 08:00:00', null), 1);
  });
  it('los límites: el ciclo empieza en su "desde" y termina justo antes de su "hasta"', () => {
    const [uno, dos] = ciclos;
    assert.equal(cicloDelAviso(ciclos, uno.desde), 0);
    assert.equal(cicloDelAviso(ciclos, uno.hasta), 1);
    assert.equal(cicloDelAviso(ciclos, dos.desde), 1);
  });
  it('si varios ciclos tienen el vencimiento, el que contiene el momento; si ninguno, el último de ellos', () => {
    const repetidos = [
      { venc: '2026-05-31', desde: '2026-01-01 00:00:00', hasta: '2026-03-01 10:00:00' },
      { venc: '2026-05-31', desde: '2026-03-01 10:00:00', hasta: '2026-04-01 10:00:00' },
      { venc: '2026-05-31', desde: '2026-04-01 10:00:00', hasta: null }
    ];
    assert.equal(cicloDelAviso(repetidos, '2026-03-15 09:00:00', '2026-05-31'), 1);
    assert.equal(cicloDelAviso(repetidos, '2026-04-01 10:00:00', '2026-05-31'), 2);
    assert.equal(cicloDelAviso(repetidos, '2025-12-01 09:00:00', '2026-05-31'), 2);
  });
  it('si ningún ciclo contiene el momento, el primero; sin ciclos o con datos raros, 0', () => {
    assert.equal(cicloDelAviso(ciclos, '2020-01-01 00:00:00'), 0);
    assert.equal(cicloDelAviso([], '2026-10-01 08:00:00'), 0);
    assert.equal(cicloDelAviso(null, '2026-10-01 08:00:00', '2026-10-31'), 0);
    assert.equal(cicloDelAviso(ciclos, null), 0);
  });
});

describe('avisosDelCiclo', () => {
  for (const [id, esperado] of Object.entries(ABIERTO)) {
    it(`caso ${id}: los avisos del ciclo abierto`, () => {
      assert.deepEqual(abiertoDe(id), esperado);
      const ciclos = ciclosDe(f(id), HOY);
      const { emails, notas, total } = avisosDelCiclo(f(id), ciclos, ciclos.length - 1);
      assert.equal(total, emails + notas.length);
    });
  }

  it('las notas del caso 10 y del caso 9 van al ciclo de su vencimiento, no al abierto', () => {
    const c10 = ciclosDe(f(10), HOY);
    assert.deepEqual(avisosDelCiclo(f(10), c10, 3).notas, ['2/26']);
    assert.equal(avisosDelCiclo(f(10), c10, 4).total, 0);
    const c9 = ciclosDe(f(9), HOY);
    assert.deepEqual(avisosDelCiclo(f(9), c9, 1).notas, ['2/26']);
  });

  it('el caso 42: los emails de antes del 06/04 son del ciclo vencido (el del 26/03 falló y no cuenta), y el email al área también', () => {
    const primero = avisosDelCiclo(f(42), ciclosDe(f(42), HOY), 0);
    assert.equal(primero.emails, 3);
    assert.deepEqual(primero.alArea, ['2026-02-19']);
  });

  it('los emails fallidos, los tipos desconocidos y las notas sin enviar no cuentan', () => {
    const fuentes = solo({ proxima: '2026-10-31' }, {
      emails: [email({ id: 1 }), email({ id: 2, success: false }), email({ id: 3, tipo: 'otro' }), email({ id: 4, tipo: 'area-aviso-40', success: false }),
        email({ id: 5, tipo: 'area-aviso-40', enviado: '2026-09-21 08:00:00' })],
      notas: [nota({ id: 1 }), nota({ id: 2, estado: 'pendiente', enviada: null }), nota({ id: 3, estado: 'fallida', enviada: null }), nota({ id: 4, tipo: 'auditoria' })]
    });
    assert.deepEqual(avisosDelCiclo(fuentes, ciclosDe(fuentes, HOY), 0), { emails: 1, notas: ['5/26'], alArea: ['2026-09-21'], total: 2, ultimo: '2026-10-15' });
  });

  it('las notas salen por orden de envío y las reiteraciones cuentan', () => {
    const fuentes = solo({ proxima: '2026-10-31' }, { notas: [
      nota({ id: 2, numero: 9, tipo: 'reiteracion', enviada: '2026-10-19 08:15:00', fecha: '2026-10-19' }),
      nota({ id: 1, numero: 7, enviada: '2026-10-05 08:15:00', fecha: '2026-10-05' })] });
    assert.deepEqual(avisosDelCiclo(fuentes, ciclosDe(fuentes, HOY), 0).notas, ['7/26', '9/26']);
  });

  it('sin ciclos, con un índice que no existe o con listas ausentes: ceros', () => {
    const vacio = { emails: 0, notas: [], alArea: [], total: 0, ultimo: null };
    assert.deepEqual(avisosDelCiclo(f(66), null, 0), vacio);
    assert.deepEqual(avisosDelCiclo(f(52), ciclosDe(f(52), HOY), 7), vacio);
    assert.deepEqual(avisosDelCiclo({ dataset: CASOS[52].dataset }, ciclosDe({ dataset: CASOS[52].dataset }, HOY), 0), vacio);
    assert.deepEqual(avisosDelCiclo(null, [], 0), vacio);
  });
});

describe('ultimoAviso', () => {
  it('la fecha del email o de la nota enviada más reciente, de cualquier ciclo', () => {
    assert.equal(ultimoAviso(f(52)), '2026-10-13');
    assert.equal(ultimoAviso(f(81)), '2026-10-20');
  });
  it('un email posterior a la última nota gana; los del área, los fallidos y las notas sin enviar o de auditoría no cuentan', () => {
    assert.equal(ultimoAviso(con(52, { emails: [email({ id: 70, enviado: '2026-10-17 08:00:00' })] })), '2026-10-17');
    assert.equal(ultimoAviso(con(52, { emails: [email({ id: 71, tipo: 'area-aviso-40', enviado: '2026-10-19 08:00:00' }),
      email({ id: 72, success: false, enviado: '2026-10-19 08:00:00' })] })), '2026-10-13');
    assert.equal(ultimoAviso(con(52, { notas: [nota({ id: 73, estado: 'pendiente', enviada: null, fecha: '2026-10-19' }),
      nota({ id: 74, tipo: 'auditoria', enviada: '2026-10-19 08:00:00', fecha: '2026-10-19' })] })), '2026-10-13');
  });
  it('sin avisos, null', () => {
    assert.equal(ultimoAviso(solo({})), null);
    assert.equal(ultimoAviso({}), null);
    assert.equal(ultimoAviso(null), null);
  });
});

describe('hitosDe', () => {
  it('el caso 42: venció y se reprogramó después', () => {
    assert.deepEqual(hitosDe(ciclosDe(f(42), HOY), HOY),
      [{ fecha: '2026-03-31', tipo: 'reprogramado', texto: 'Venció. Reprogramado el 06/04/2026 al 30/04/2027' }]);
  });
  it('el caso 52: del más nuevo al más viejo', () => {
    assert.deepEqual(hitosDe(ciclosDe(f(52), HOY), HOY), [
      { fecha: '2026-07-31', tipo: 'vencio', texto: 'Venció' },
      { fecha: '2026-01-31', tipo: 'actualizado', texto: 'Venció. Actualizado el 04/02/2026, 4 días después del vencimiento' }
    ]);
  });
  it('los ciclos que se cerraron antes de vencer no dejan hito, ni el abierto que todavía no venció', () => {
    assert.deepEqual(hitosDe(ciclosDe(f(10), HOY), HOY).map((h) => [h.fecha, h.tipo]), [['2026-07-31', 'actualizado'], ['2026-01-31', 'actualizado']]);
    assert.deepEqual(hitosDe(ciclosDe(f(81), HOY), HOY), []);
    assert.deepEqual(hitosDe(ciclosDe(f(38), HOY), HOY).map((h) => h.fecha), ['2026-09-30']);
  });
  it('en singular: "1 día después del vencimiento"', () => {
    const fuentes = solo({ proxima: '2027-01-31', alta: '2026-01-02 09:00:00' }, { cambios: [
      actualizacion(70, '2026-03-02 10:00:00', '2026-02-01', '2027-01-31', { carga: '2025-12-20', proxima: '2026-01-31' })] });
    assert.equal(hitosDe(ciclosDe(fuentes, HOY), HOY)[0].texto, 'Venció. Actualizado el 01/02/2026, 1 día después del vencimiento');
  });
  it('un vencido de siempre (caso 11) y un abierto que vence hoy', () => {
    assert.deepEqual(hitosDe(ciclosDe(f(11), HOY), HOY), [{ fecha: '2024-01-31', tipo: 'vencio', texto: 'Venció' }]);
    const venceHoy = solo({ proxima: HOY });
    assert.deepEqual(hitosDe(ciclosDe(venceHoy, HOY), HOY), []);
    assert.deepEqual(hitosDe(ciclosDe(venceHoy, '2026-10-21'), '2026-10-21'), [{ fecha: HOY, tipo: 'vencio', texto: 'Venció' }]);
  });
  it('una baja después del vencimiento deja el hito "Venció"; si fue antes de vencer, no', () => {
    const baja = (revisado) => solo({ proxima: '2026-07-31', activo: false }, { cambios: [cambio({ id: 95, tipo: 'eliminar', revisado })] });
    assert.deepEqual(hitosDe(ciclosDe(baja('2026-09-02 11:00:00'), HOY), HOY), [{ fecha: '2026-07-31', tipo: 'vencio', texto: 'Venció' }]);
    assert.deepEqual(hitosDe(ciclosDe(baja('2026-06-02 11:00:00'), HOY), HOY), []);
  });
  it('con el mismo vencimiento en dos ciclos, primero el más nuevo', () => {
    const ciclos = [{ venc: '2026-05-31', cierre: '2026-06-10', como: 'reprogramacion', nueva: '2026-05-31', diasVencido: 10 },
      { venc: '2026-05-31', cierre: null, como: null, diasVencido: 142 }];
    assert.deepEqual(hitosDe(ciclos, HOY).map((h) => h.tipo), ['vencio', 'reprogramado']);
  });
  it('sin ciclos, una lista vacía', () => {
    assert.deepEqual(hitosDe(null, HOY), []);
    assert.deepEqual(hitosDe(ciclosDe(f(66), HOY), HOY), []);
  });
});

describe('estadoDeSeguimiento', () => {
  it('vencido: los dos estados vencidos se dicen "Vencido", con los días en negativo', () => {
    assert.deepEqual(estadoDeSeguimiento(f(52).dataset, HOY), { estado: 'vencido', texto: 'Vencido', dias: -81 });
    assert.deepEqual(estadoDeSeguimiento(f(26).dataset, HOY), { estado: 'vencido', texto: 'Vencido', dias: -568 });
  });
  it('próximo, actualizado, eventual y sin fecha', () => {
    assert.deepEqual(estadoDeSeguimiento(f(81).dataset, HOY), { estado: 'proximo', texto: 'Próximo a vencer', dias: 11 });
    assert.deepEqual(estadoDeSeguimiento(f(38).dataset, HOY), { estado: 'actualizado', texto: 'Actualizado', dias: 162 });
    assert.deepEqual(estadoDeSeguimiento(f(66).dataset, HOY), { estado: 'eventual', texto: 'Eventual', dias: null });
    assert.deepEqual(estadoDeSeguimiento({ ...f(52).dataset, proxima: null }, HOY), { estado: 'sin-fecha', texto: 'Sin fecha', dias: null });
  });
  it('dado de baja', () => {
    const baja = estadoDeSeguimiento({ ...f(52).dataset, activo: false }, HOY);
    assert.equal(baja.estado, 'baja');
    assert.equal(baja.texto, 'Dado de baja');
  });
  it('con datos raros no tira error', () => {
    assert.doesNotThrow(() => estadoDeSeguimiento({}, HOY));
    assert.doesNotThrow(() => estadoDeSeguimiento(null, HOY));
    assert.doesNotThrow(() => estadoDeSeguimiento(f(52).dataset, undefined));
  });
});

describe('circuitoDe', () => {
  const circuito = (id, fuentes = f(id), hoy = HOY) => circuitoDe(fuentes, ciclosDe(fuentes, hoy), hoy);

  it('caso 52, externa: 6 avisos, vencido hace 81 días y un email al área', () => {
    const c = circuito(52);
    assert.deepEqual(c.nodoMedio, { nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' });
    assert.deepEqual(c.tramoFuera, { titulo: 'Nota formal', texto: 'Pendiente de carga', registrada: false, nota: null, tituloPdf: 'Nota formal', textoPdf: 'Pendiente de carga' });
    assert.deepEqual(c.avisos, { titulo: '6 avisos', texto: '5 emails y la Nota Digital N° 2/26' });
    assert.deepEqual(c.area, { nombre: 'Dirección General de Relaciones Laborales', texto: 'Vencido hace 81 días', vencido: true });
    assert.deepEqual(c.alArea, {
      fechas: ['2026-06-21'],
      texto: 'Además, el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.',
      textoPdf: 'Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.'
    });
    assert.deepEqual(c.vencimiento, { fecha: '2026-07-31', texto: 'Vencimiento del 31/07/2026' });
  });

  it('desde cuándo se cuentan los avisos: el inicio del ciclo abierto y cómo empezó', () => {
    const alta11 = CASOS[11].dataset.alta.slice(0, 10).split('-').reverse().join('/');
    assert.deepEqual(circuito(52).desde, { fecha: '2026-02-04', origen: 'actualizacion', texto: 'Desde la actualización del 04/02/2026' });
    assert.deepEqual(circuito(58).desde, { fecha: '2025-12-16', origen: 'actualizacion', texto: 'Desde la actualización del 16/12/2025' });
    assert.deepEqual(circuito(42).desde, { fecha: '2026-04-06', origen: 'reprogramacion', texto: 'Desde la reprogramación del 06/04/2026' });
    assert.deepEqual(circuito(11).desde, { fecha: CASOS[11].dataset.alta.slice(0, 10), origen: 'alta', texto: `Desde el alta del ${alta11}` });
    assert.equal(circuito(66).desde, null);
    const sinAlta = solo({ alta: null });
    assert.equal(circuitoDe(sinAlta, ciclosDe(sinAlta, HOY), HOY).desde, null);
  });

  it('caso 81: un aviso, una nota y vence en 11 días; sin email al área', () => {
    const c = circuito(81);
    assert.equal(c.avisos.titulo, '1 aviso');
    assert.equal(c.avisos.texto, 'La Nota Digital N° 3/26');
    assert.deepEqual(c.area, { nombre: 'Dirección General de Sueldos', texto: 'Vence en 11 días', vencido: false });
    assert.equal(c.alArea.texto, null);
    assert.deepEqual(c.alArea.fechas, []);
    assert.equal(c.alArea.textoPdf, 'Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.');
  });

  it('caso 38, interna: el nodo de Investigación Territorial, el relevamiento y nada para el área', () => {
    const c = circuito(38);
    assert.deepEqual(c.nodoMedio, { nombre: 'DGMIT y Dirección de Investigación Territorial', rol: 'Hacen el relevamiento' });
    assert.deepEqual(c.tramoFuera, { titulo: 'Relevamiento', texto: 'Por fuera del RPAD: no queda registrado', registrada: false, nota: null,
      tituloPdf: 'Relevamiento', textoPdf: 'Por fuera del RPAD: no queda registrado' });
    assert.equal(c.alArea, null);
  });

  it('caso 10: sin avisos en el ciclo abierto', () => {
    const c = circuito(10);
    assert.equal(c.avisos.titulo, 'Sin avisos');
    assert.equal(c.avisos.texto, 'Todavía no hizo falta');
  });

  it('sin avisos con el ciclo abierto ya vencido: "Todavía no se envió ningún aviso"; el día del vencimiento, todavía no hizo falta', () => {
    assert.deepEqual(circuito(0, solo({ proxima: '2026-09-30' })).avisos, { titulo: 'Sin avisos', texto: 'Todavía no se envió ningún aviso' });
    assert.deepEqual(circuito(0, solo({ proxima: '2026-10-19' })).avisos, { titulo: 'Sin avisos', texto: 'Todavía no se envió ningún aviso' });
    assert.deepEqual(circuito(0, solo({ proxima: HOY })).avisos, { titulo: 'Sin avisos', texto: 'Todavía no hizo falta' });
    // Con avisos, el texto de siempre aunque esté vencido
    assert.equal(circuito(0, solo({ proxima: '2026-09-30' }, { emails: [email({ id: 1, enviado: '2026-09-25 08:00:00' })] })).avisos.texto, '1 email');
  });

  it('caso 61: dos emails al área, con "el a y el b"', () => {
    assert.equal(circuito(61).alArea.texto,
      'Además, el 22/12/2025 y el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.');
  });

  it('con tres fechas: "el a, el b y el c"', () => {
    const c = circuito(61, con(61, { emails: [email({ id: 80, tipo: 'area-aviso-40', enviado: '2026-09-21 08:00:00' })] }));
    assert.equal(c.alArea.texto,
      'Además, el 22/12/2025, el 21/06/2026 y el 21/09/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.');
  });

  it('si el email al área salió dos veces el mismo día, la fecha se dice una sola vez', () => {
    const fuentes = solo({ proxima: '2026-10-31' }, { emails: [email({ id: 1, tipo: 'area-aviso-40', enviado: '2026-09-21 08:00:00' }),
      email({ id: 2, tipo: 'area-aviso-40', enviado: '2026-09-21 10:00:00' })] });
    const c = circuito(0, fuentes);
    assert.deepEqual(c.alArea.fechas, ['2026-09-21']);
    assert.match(c.alArea.texto, /^Además, el 21\/09\/2026 el RPAD/);
  });

  it('el texto de los avisos: singular, plural, solo emails, varias notas', () => {
    const avisos = (extra) => circuito(0, solo({ proxima: '2026-10-31' }, extra)).avisos;
    assert.deepEqual(avisos({ emails: [email({ id: 1 })] }), { titulo: '1 aviso', texto: '1 email' });
    assert.deepEqual(avisos({ emails: [email({ id: 1 }), email({ id: 2 })] }), { titulo: '2 avisos', texto: '2 emails' });
    assert.deepEqual(avisos({ emails: [email({ id: 1 })], notas: [nota({ id: 1 })] }), { titulo: '2 avisos', texto: '1 email y la Nota Digital N° 5/26' });
    const dos = avisos({ notas: [nota({ id: 1, numero: 5, enviada: '2026-10-05 08:15:00' }), nota({ id: 2, numero: 6, enviada: '2026-10-10 08:15:00' })] });
    assert.deepEqual(dos, { titulo: '2 avisos', texto: 'Las Notas Digitales N° 5/26 y 6/26' });
    const tres = avisos({ emails: [email({ id: 1 })], notas: [nota({ id: 1, numero: 5, enviada: '2026-10-05 08:15:00' }),
      nota({ id: 2, numero: 6, enviada: '2026-10-10 08:15:00' }), nota({ id: 3, numero: 7, enviada: '2026-10-12 08:15:00' })] });
    assert.deepEqual(tres, { titulo: '4 avisos', texto: '1 email y las Notas Digitales N° 5/26, 6/26 y 7/26' });
  });

  it('eventual (caso 66) y sin fecha: sin vencimiento', () => {
    const eventual = circuito(66);
    assert.deepEqual(eventual.avisos, { titulo: 'Sin avisos', texto: 'Sin vencimiento' });
    assert.deepEqual(eventual.area, { nombre: CASOS[66].dataset.area, texto: 'Sin vencimiento', vencido: false });
    assert.equal(eventual.vencimiento, null);
    assert.equal(eventual.nodoMedio.nombre, 'DGMIT y Dirección de Investigación Territorial');
    const sinFecha = circuito(0, solo({ proxima: null }));
    assert.deepEqual(sinFecha.avisos, { titulo: 'Sin avisos', texto: 'Sin vencimiento' });
    assert.equal(sinFecha.area.texto, 'Sin vencimiento');
    assert.equal(sinFecha.area.vencido, false);
    assert.equal(sinFecha.vencimiento, null);
    assert.equal(sinFecha.alArea.texto, null);
  });

  it('dado de baja: el área dice "Dado de baja" y no está vencida', () => {
    const fuentes = solo({ proxima: '2026-07-31', activo: false }, { cambios: [cambio({ id: 95, tipo: 'eliminar', revisado: '2026-09-02 11:00:00' })] });
    const c = circuito(0, fuentes);
    assert.deepEqual(c.area, { nombre: CASOS[52].dataset.area, texto: 'Dado de baja', vencido: false });
    assert.deepEqual(c.vencimiento, { fecha: '2026-07-31', texto: 'Vencimiento del 31/07/2026' });
  });

  it('el texto del área: vence hoy, vence en 1 día, vencido hace 1 día', () => {
    const area = (proxima) => circuito(0, solo({ proxima })).area;
    assert.deepEqual(area(HOY), { nombre: CASOS[52].dataset.area, texto: 'Vence hoy', vencido: false });
    assert.equal(area('2026-10-21').texto, 'Vence en 1 día');
    assert.equal(area('2026-10-19').texto, 'Vencido hace 1 día');
    assert.equal(area('2026-10-19').vencido, true);
    assert.equal(area('2026-10-01').texto, 'Vencido hace 19 días');
  });

  it('ningún texto del circuito dice "sin entregar", "sin respuesta" ni "atrasado"', () => {
    for (const id of Object.keys(CASOS)) {
      const c = circuito(id);
      assert.doesNotMatch(JSON.stringify([c.nodoMedio, c.tramoFuera, c.avisos, c.area.texto, c.alArea, c.vencimiento]), /sin entregar|sin respuesta|atrasad/i, `caso ${id}`);
    }
  });

  it('si no le pasan los ciclos, los arma', () => {
    assert.deepEqual(circuitoDe(f(52), undefined, HOY), circuito(52));
  });

  it('con datos raros no tira error', () => {
    assert.doesNotThrow(() => circuitoDe({ dataset: CASOS[52].dataset }, null, HOY));
    assert.doesNotThrow(() => circuitoDe({ dataset: CASOS[52].dataset }, [], HOY));
    assert.doesNotThrow(() => circuitoDe(null, null, HOY));
  });
});

// «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7): con «No» no hay nota formal, y el renglón «Al área»
// no se dibuja (alArea null) salvo que el RPAD ya le haya mandado al área el email de los 40 días en el ciclo abierto
describe('circuitoDe: requiere nota DGMIT', () => {
  const circuito = (fuentes) => circuitoDe(fuentes, ciclosDe(fuentes, HOY), HOY);
  const externo = (requiere_nota, extra = {}, dataset = {}) => solo({ proxima: '2026-10-31', tipo_gestion: 'externa', requiere_nota, ...dataset }, extra);
  const SIN_NOTA = {
    nodoMedio: { nombre: 'DGMIT y Dirección Administrativa', rol: 'No hace falta nota formal' },
    tramoFuera: { titulo: 'Sin nota formal', texto: 'Los datos se obtienen de la fuente', registrada: false, nota: null,
      tituloPdf: 'Sin nota formal', textoPdf: 'Los datos se obtienen de la fuente' }
  };
  const CON_NOTA = {
    nodoMedio: { nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' },
    tramoFuera: { titulo: 'Nota formal', texto: 'Todavía no hizo falta', registrada: false, nota: null, tituloPdf: 'Nota formal', textoPdf: 'Todavía no hizo falta' }
  };

  it('circuito de un externo con No y sin emails al área: textos sin nota formal y alArea null', () => {
    const c = circuito(externo(0));
    assert.deepEqual(c.nodoMedio, SIN_NOTA.nodoMedio);
    assert.deepEqual(c.tramoFuera, SIN_NOTA.tramoFuera);
    assert.equal(c.alArea, null);
    // Lo demás es lo de siempre: los avisos a DGMIT, el área y el vencimiento
    const conSi = circuito(externo(1));
    assert.deepEqual(c.avisos, conSi.avisos);
    assert.deepEqual(c.area, conSi.area);
    assert.deepEqual(c.vencimiento, conSi.vencimiento);
    assert.deepEqual(c.vencimiento, { fecha: '2026-10-31', texto: 'Vencimiento del 31/10/2026' });
  });

  it('circuito de un externo con No y un email al área en el ciclo: alArea con sus fechas', () => {
    const emails = [email({ id: 1, tipo: 'area-aviso-40', enviado: '2026-09-21 08:00:00' })];
    const c = circuito(externo(0, { emails }));
    assert.deepEqual(c.nodoMedio, SIN_NOTA.nodoMedio);
    assert.deepEqual(c.tramoFuera, SIN_NOTA.tramoFuera);
    assert.deepEqual(c.alArea, {
      fechas: ['2026-09-21'],
      texto: 'Además, el 21/09/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.',
      textoPdf: 'Al área: el 21/09/2026 el RPAD le anticipó por email que iba a recibir una nota formal.'
    });
    assert.deepEqual(c.alArea, circuito(externo(1, { emails })).alArea);
  });

  it('con No, el caso 52 real (un email al área el 21/06/2026) conserva su renglón «Al área»', () => {
    const fuentes = { ...f(52), dataset: { ...CASOS[52].dataset, requiere_nota: 0 } };
    const c = circuito(fuentes);
    assert.deepEqual(c.alArea.fechas, ['2026-06-21']);
    assert.match(c.alArea.textoPdf, /^Al área: el 21\/06\/2026 el RPAD le anticipó por email/);
    assert.deepEqual(c.nodoMedio, SIN_NOTA.nodoMedio);
    assert.deepEqual(c.tramoFuera, SIN_NOTA.tramoFuera);
  });

  it('con No, un email al área que falló o que es de un ciclo anterior no cuenta: alArea null', () => {
    const fallido = circuito(externo(0, { emails: [email({ id: 1, tipo: 'area-aviso-40', success: false, enviado: '2026-09-21 08:00:00' })] }));
    assert.equal(fallido.alArea, null);
    // El email del 05/01/2026 es del ciclo que vencía el 31/01/2026, cerrado por la actualización aprobada el 02/03/2026
    const anterior = solo({ proxima: '2027-01-31', tipo_gestion: 'externa', requiere_nota: 0, alta: '2026-01-02 09:00:00' }, {
      cambios: [actualizacion(70, '2026-03-02 10:00:00', '2026-02-01', '2027-01-31', { carga: '2025-12-20', proxima: '2026-01-31' })],
      emails: [email({ id: 1, tipo: 'area-aviso-40', enviado: '2026-01-05 08:00:00' })]
    });
    assert.equal(circuito(anterior).alArea, null);
    // Con «Sí», en cambio, el renglón «todavía no se le envió» sigue estando
    const conSi = circuito({ ...anterior, dataset: { ...anterior.dataset, requiere_nota: 1 } });
    assert.deepEqual(conSi.alArea.fechas, []);
    assert.match(conSi.alArea.textoPdf, /todavía no se le envió el email que anticipa la nota formal/);
  });

  it('con No, lo que nunca aparece es «todavía no se le envió el email»', () => {
    for (const id of [10, 81, 52, 61, 1, 42]) {
      const c = circuito({ ...f(id), dataset: { ...CASOS[id].dataset, requiere_nota: 0 } });
      assert.doesNotMatch(JSON.stringify(c), /todavía no se le envió/, `caso ${id}`);
    }
  });

  it('circuito con NULL o Sí: como hoy', () => {
    for (const valor of [1, null, undefined]) {
      const c = circuito(externo(valor));
      assert.deepEqual(c.nodoMedio, CON_NOTA.nodoMedio, String(valor));
      assert.deepEqual(c.tramoFuera, CON_NOTA.tramoFuera, String(valor));
      assert.deepEqual(c.alArea.fechas, [], String(valor));
      assert.equal(c.alArea.texto, null, String(valor));
      assert.equal(c.alArea.textoPdf, 'Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.', String(valor));
    }
    // Los casos reales (todos sin dato) son idénticos con null y con Sí
    for (const id of Object.keys(CASOS)) {
      const conSi = circuito({ ...f(id), dataset: { ...CASOS[id].dataset, requiere_nota: 1 } });
      assert.deepEqual(conSi, circuito(f(id)), `caso ${id}`);
    }
  });

  it('un valor que no es Sí ni No cuenta como sin dato: el circuito de siempre', () => {
    for (const raro of ['si', 2, {}, NaN, '']) assert.deepEqual(circuito(externo(raro)).nodoMedio, CON_NOTA.nodoMedio, String(raro));
  });

  it('la gestión interna no cambia aunque el dataset traiga un 0', () => {
    const interna = circuito({ ...f(38), dataset: { ...CASOS[38].dataset, requiere_nota: 0 } });
    assert.deepEqual(interna, circuito(f(38)));
    assert.deepEqual(interna.nodoMedio, { nombre: 'DGMIT y Dirección de Investigación Territorial', rol: 'Hacen el relevamiento' });
    assert.deepEqual(interna.tramoFuera, { titulo: 'Relevamiento', texto: 'Por fuera del RPAD: no queda registrado', registrada: false, nota: null,
      tituloPdf: 'Relevamiento', textoPdf: 'Por fuera del RPAD: no queda registrado' });
    assert.equal(interna.alArea, null);
  });

  it('con No, ni los textos del circuito dicen «sin entregar», «sin respuesta» ni «atrasado»', () => {
    for (const id of Object.keys(CASOS)) {
      const c = circuito({ ...f(id), dataset: { ...CASOS[id].dataset, requiere_nota: 0 } });
      assert.doesNotMatch(JSON.stringify([c.nodoMedio, c.tramoFuera, c.avisos, c.area.texto, c.alArea, c.vencimiento]), /sin entregar|sin respuesta|atrasad/i, `caso ${id}`);
    }
  });

  it('seguimientoDe lleva el circuito con No', () => {
    const s = seguimientoDe({ ...f(81), dataset: { ...CASOS[81].dataset, requiere_nota: 0 } }, HOY);
    assert.deepEqual(s.circuito.nodoMedio, SIN_NOTA.nodoMedio);
    assert.equal(s.circuito.alArea, null);
    assert.equal(s.ficha.requiere_nota, 0);
  });
});

describe('seguimientoDe', () => {
  it('el caso 52: ficha, movimientos, hitos, cinta y registro', () => {
    const s = seguimientoDe(f(52), HOY);
    assert.deepEqual(Object.keys(s), ['ficha', 'circuito', 'cinta', 'movimientos', 'hitos', 'registro']);
    assert.equal(s.ficha.pedido, 'Vigente al 30/06/2026');
    assert.equal(s.ficha.estado.texto, 'Vencido');
    assert.equal(s.movimientos.length, 16);
    assert.ok(s.hitos.length > 0);
    assert.ok(s.cinta.marcas.length > 0);
    assert.deepEqual(s.registro, { envios: '2025-12-06', cambios: '2026-01-26' });
  });

  it('la ficha trae lo que muestran la pantalla y el PDF', () => {
    const { dataset } = CASOS[52];
    assert.deepEqual(seguimientoDe(f(52), HOY).ficha, {
      id: 52, titulo: dataset.titulo, area: dataset.area, area_superior: dataset.area_superior, tipo_gestion: 'externa',
      requiere_nota: null, frecuencia: 'Cada medio año', datos_al: '2025-12-31', ultima: '2026-02-04', proxima: '2026-07-31',
      pedido: 'Vigente al 30/06/2026', url_dataset: dataset.url_dataset,
      estado: estadoDeSeguimiento(dataset, HOY), activo: true, baja: null
    });
  });

  // «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.7): la ficha lo devuelve tal cual (1, 0 o null);
  // el 0 es un valor, no un vacío; en gestión interna es null
  it('ficha: requiere_nota de un externo es 1, 0 o null (el 0 se conserva) y se queda con lo que dice el dataset', () => {
    const ficha = (valor) => seguimientoDe({ ...f(52), dataset: { ...CASOS[52].dataset, requiere_nota: valor } }, HOY).ficha;
    assert.equal(ficha(1).requiere_nota, 1);
    assert.equal(ficha(0).requiere_nota, 0);
    assert.equal(ficha(null).requiere_nota, null);
    assert.equal(ficha(undefined).requiere_nota, null);
    // Tal como lo da la base o un cuerpo viejo: 1 y 0 de texto o booleanos
    assert.equal(ficha('0').requiere_nota, 0);
    assert.equal(ficha(true).requiere_nota, 1);
    // Algo que no es Sí ni No es sin dato; no tira error
    for (const raro of ['si', 2, -1, {}, NaN, '']) assert.equal(ficha(raro).requiere_nota, null, String(raro));
  });

  it('ficha: requiere_nota de un interno es null, aunque el dataset traiga un valor', () => {
    const ficha = (valor) => seguimientoDe({ ...f(38), dataset: { ...CASOS[38].dataset, requiere_nota: valor } }, HOY).ficha;
    for (const valor of [1, 0, null]) assert.equal(ficha(valor).requiere_nota, null, String(valor));
    assert.equal(seguimientoDe(f(66), HOY).ficha.requiere_nota, null);
  });

  it('el circuito, los hitos y los movimientos son los de las reglas sueltas', () => {
    for (const id of Object.keys(CASOS)) {
      const fuentes = f(id);
      const s = seguimientoDe(fuentes, HOY);
      const ciclos = ciclosDe(fuentes, HOY);
      assert.deepEqual(s.circuito, circuitoDe(fuentes, ciclos, HOY), `caso ${id}`);
      assert.deepEqual(s.hitos, hitosDe(ciclos, HOY), `caso ${id}`);
      assert.deepEqual(s.movimientos, movimientosDe(fuentes), `caso ${id}`);
    }
  });

  it('la cinta usa las opciones que le pasan (el PDF: 12 y 8,4) y por defecto las de la pantalla', () => {
    // El caso 9 es el único de los 12 donde las opciones del PDF cambian la cinta: con el 52 el test pasaría aunque no se pasaran
    const fuentes = f(9);
    const pdf = { separacion: 12, letra: 8.4 };
    const cinta = (extra) => cintaDe({ fuentes, ciclos: ciclosDe(fuentes, HOY), movimientos: movimientosDe(fuentes), hoy: HOY, ...extra });
    assert.notDeepEqual(cinta(), cinta(pdf), 'el caso 9 tiene que distinguir las dos opciones');
    assert.deepEqual(seguimientoDe(fuentes, HOY).cinta, cinta());
    assert.deepEqual(seguimientoDe(fuentes, HOY, {}).cinta, cinta());
    assert.deepEqual(seguimientoDe(fuentes, HOY, pdf).cinta, cinta(pdf));
    assert.notDeepEqual(seguimientoDe(fuentes, HOY, pdf).cinta, seguimientoDe(fuentes, HOY).cinta);
  });

  it('el pedido sale del tipo de pedido efectivo del dataset', () => {
    const conTipo = (tipo_pedido) => ({ ...f(52), dataset: { ...CASOS[52].dataset, tipo_pedido } });
    assert.equal(seguimientoDe(conTipo('edicion'), HOY).ficha.pedido, 'Próxima edición disponible');
    assert.equal(seguimientoDe(conTipo('eventual'), HOY).ficha.pedido, null);
  });

  it('un dataset dado de baja no tiene pedido: ya no se le pide nada', () => {
    const baja = { ...f(52), dataset: { ...CASOS[52].dataset, activo: false } };
    assert.equal(seguimientoDe(baja, HOY).ficha.pedido, null);
    assert.equal(seguimientoDe(baja, HOY).ficha.proxima, '2026-07-31');
  });

  it('url_dataset: solo http y https', () => {
    const con = (url_dataset) => seguimientoDe({ ...f(52), dataset: { ...CASOS[52].dataset, url_dataset } }, HOY).ficha.url_dataset;
    assert.equal(con('javascript:alert(1)'), null);
    assert.equal(con('JavaScript:alert(1)'), null);
    assert.equal(con('data:text/html,<b>x</b>'), null);
    assert.equal(con('ftp://datos.example/x'), null);
    assert.equal(con('/relativa'), null);
    assert.equal(con(''), null);
    assert.equal(con(null), null);
    assert.equal(con('https://datos.example/x'), 'https://datos.example/x');
    assert.equal(con('http://datos.example/x'), 'http://datos.example/x');
  });

  it('baja: el día de la baja aprobada; una pendiente o rechazada no cuenta', () => {
    const baja = (extra) => cambio({ id: 95, tipo: 'eliminar', revisado: '2026-09-02 11:00:00', ...extra });
    const ficha = (cambios) => seguimientoDe({ ...f(52), dataset: { ...CASOS[52].dataset, activo: false }, cambios: [...CASOS[52].cambios, ...cambios] }, HOY).ficha;
    assert.equal(ficha([baja()]).baja, '2026-09-02');
    assert.equal(ficha([baja()]).estado.texto, 'Dado de baja');
    assert.equal(ficha([baja({ estado: 'pendiente', revisado: null })]).baja, null);
    assert.equal(ficha([baja({ estado: 'rechazado' })]).baja, null);
    assert.equal(seguimientoDe(f(52), HOY).ficha.baja, null);
  });

  it('eventual (66): sin hitos, sin pedido y sin vencimiento', () => {
    const s = seguimientoDe(f(66), HOY);
    assert.equal(s.ficha.estado.estado, 'eventual');
    assert.equal(s.ficha.pedido, null);
    assert.equal(s.hitos.length, 0);
    assert.equal(s.circuito.vencimiento, null);
    assert.ok(s.cinta);
  });

  it('los 12 casos: ningún texto dice "sin entregar", "sin respuesta" ni "atrasado"', () => {
    for (const id of Object.keys(CASOS)) {
      const s = seguimientoDe(f(id), HOY);
      assert.doesNotMatch(JSON.stringify([s.ficha.estado, s.circuito, s.hitos]), /sin entregar|sin respuesta|atrasad/i, `caso ${id}`);
    }
  });

  it('con datos raros no tira error', () => {
    assert.doesNotThrow(() => seguimientoDe(null, HOY));
    assert.doesNotThrow(() => seguimientoDe({}, HOY));
    assert.doesNotThrow(() => seguimientoDe({ dataset: CASOS[52].dataset }, HOY));
    assert.doesNotThrow(() => seguimientoDe(f(52), 'mañana'));
    assert.doesNotThrow(() => seguimientoDe(f(52), HOY, null));
    assert.doesNotThrow(() => seguimientoDe({ ...f(52), dataset: { ...CASOS[52].dataset, ultima: null, datos_al: null, proxima: '2027-03-29' } }, HOY));
    assert.doesNotThrow(() => seguimientoDe({ ...f(52), dataset: { ...CASOS[52].dataset, alta: `${HOY} 09:00:00` } }, HOY));
  });
});

describe('resumenParaLista', () => {
  it('el caso 1: avisos del ciclo abierto, último aviso y propuesta pendiente', () => {
    const r = resumenParaLista(f(1), HOY);
    assert.deepEqual(r.avisos, { total: 11, emails: 10, notas: 1 });
    assert.equal(r.pendiente, true);
    assert.equal(r.ultimo_aviso, '2026-10-13');
  });

  it('trae lo mínimo de la fila, con el estado como clave corta', () => {
    const { dataset } = CASOS[52];
    const r = resumenParaLista(f(52), HOY);
    assert.deepEqual(Object.keys(r), ['id', 'titulo', 'area', 'tipo_gestion', 'requiere_nota', 'activo', 'estado', 'dias', 'proxima', 'avisos',
      'ultimo_aviso', 'nota_dgmit', 'pendiente']);
    assert.equal(r.id, 52);
    assert.equal(r.titulo, dataset.titulo);
    assert.equal(r.area, dataset.area);
    assert.equal(r.tipo_gestion, 'externa');
    assert.equal(r.activo, true);
    assert.equal(r.estado, 'vencido');
    assert.equal(r.dias, -81);
    assert.equal(r.proxima, '2026-07-31');
  });

  it('los avisos son los del ciclo abierto: emails + notas', () => {
    for (const id of Object.keys(CASOS)) {
      const fuentes = f(id);
      const ciclos = ciclosDe(fuentes, HOY);
      const r = resumenParaLista(fuentes, HOY);
      if (ciclos === null) { assert.deepEqual(r.avisos, { total: 0, emails: 0, notas: 0 }, `caso ${id}`); continue; }
      const abierto = avisosDelCiclo(fuentes, ciclos, ciclos.length - 1);
      assert.deepEqual(r.avisos, { total: abierto.emails + abierto.notas.length, emails: abierto.emails, notas: abierto.notas.length }, `caso ${id}`);
      assert.equal(r.avisos.total, r.avisos.emails + r.avisos.notas, `caso ${id}`);
      assert.equal(r.ultimo_aviso, abierto.ultimo, `caso ${id}`);
    }
  });

  it('el último aviso es el del ciclo abierto, como la cuenta: sin avisos en el ciclo, null', () => {
    assert.equal(resumenParaLista(f(58), HOY).ultimo_aviso, '2026-10-01');
    assert.equal(resumenParaLista(f(25), HOY).ultimo_aviso, null);
    assert.equal(ultimoAviso(f(25)), '2025-12-10');
    // 10 se actualizó el 13/10/2026: los avisos de antes son de otro ciclo
    assert.equal(resumenParaLista(f(10), HOY).ultimo_aviso, null);
    assert.equal(resumenParaLista(f(66), HOY).ultimo_aviso, null);
  });

  it('eventual y sin fecha: avisos en cero', () => {
    assert.deepEqual(resumenParaLista(f(66), HOY).avisos, { total: 0, emails: 0, notas: 0 });
    const sinFecha = resumenParaLista({ ...f(52), dataset: { ...CASOS[52].dataset, proxima: null } }, HOY);
    assert.deepEqual(sinFecha.avisos, { total: 0, emails: 0, notas: 0 });
    assert.equal(sinFecha.estado, 'sin-fecha');
    assert.equal(sinFecha.dias, null);
    assert.equal(sinFecha.proxima, null);
  });

  it('los vencidos de los 12 casos son 1, 11, 26, 33, 52 y 61', () => {
    const vencidos = Object.keys(CASOS).filter((id) => resumenParaLista(f(id), HOY).estado === 'vencido').map(Number).sort((a, b) => a - b);
    assert.deepEqual(vencidos, [1, 11, 26, 33, 52, 61]);
  });

  it('pendiente: solo si algún cambio del dataset está pendiente', () => {
    const sinPendientes = CASOS[52].cambios.filter((c) => c.estado !== 'pendiente');
    const con = (estado) => resumenParaLista({ ...f(52), cambios: [...sinPendientes, cambio({ id: 97, estado })] }, HOY).pendiente;
    assert.equal(con('pendiente'), true);
    assert.equal(con('aprobado'), false);
    assert.equal(con('rechazado'), false);
  });

  it('un dado de baja figura como baja', () => {
    const r = resumenParaLista({ ...f(52), dataset: { ...CASOS[52].dataset, activo: false } }, HOY);
    assert.equal(r.activo, false);
    assert.equal(r.estado, 'baja');
    assert.equal(r.dias, null);
  });

  it('con datos raros no tira error', () => {
    assert.doesNotThrow(() => resumenParaLista(null, HOY));
    assert.doesNotThrow(() => resumenParaLista({}, HOY));
    assert.doesNotThrow(() => resumenParaLista({ dataset: CASOS[52].dataset }, 'mañana'));
  });
});

describe('sinErroresTecnicos', () => {
  // El 52 con un email a DGMIT y uno al área que no se pudieron enviar, con el texto técnico del error
  const conFallidos = () => {
    const base = f(52);
    const dgmit = base.emails.find((e) => e.tipo !== 'area-aviso-40');
    const area = base.emails.find((e) => e.tipo === 'area-aviso-40');
    return { ...base, emails: [{ ...dgmit, success: false, error: 'connect ECONNREFUSED 10.0.0.1:587' }, { ...area, success: false, error: 'Greeting never received' }] };
  };

  it('deja en null el error de los emails a DGMIT y al área; el detalle sigue diciendo "No se pudo enviar."', () => {
    const s = seguimientoDe(conFallidos(), HOY);
    const limpio = sinErroresTecnicos(s);
    const emails = limpio.movimientos.filter((m) => m.tipo === 'email' || m.tipo === 'area');
    assert.deepEqual(emails.map((m) => [m.tipo, m.detalle, m.extra.success, m.extra.error]).sort(),
      [['area', 'No se pudo enviar.', false, null], ['email', 'No se pudo enviar.', false, null]]);
  });

  it('el resto queda igual y no toca el seguimiento que recibe', () => {
    const s = seguimientoDe(conFallidos(), HOY);
    const antes = structuredClone(s);
    const limpio = sinErroresTecnicos(s);
    assert.deepEqual(s, antes);
    assert.ok(s.movimientos.some((m) => m.extra?.error), 'el original conserva los errores');
    const sinError = (m) => ({ ...m, extra: { ...m.extra, error: null } });
    assert.deepEqual(limpio.movimientos, s.movimientos.map((m) => (m.tipo === 'email' || m.tipo === 'area' ? sinError(m) : m)));
    assert.deepEqual({ ...limpio, movimientos: [] }, { ...s, movimientos: [] });
  });

  it('con datos raros no tira error', () => {
    assert.equal(sinErroresTecnicos(null), null);
    assert.deepEqual(sinErroresTecnicos({}), {});
    assert.deepEqual(sinErroresTecnicos({ movimientos: [null, { tipo: 'email' }, { tipo: 'area', extra: null }] }),
      { movimientos: [null, { tipo: 'email' }, { tipo: 'area', extra: null }] });
  });
});

describe('nombreDelPdf y disposicionDeAdjunto', () => {
  it('el nombre: Seguimiento - título - día.pdf', () => {
    assert.equal(nombreDelPdf('Directores Generales', '2026-10-20'), 'Seguimiento - Directores Generales - 2026-10-20.pdf');
  });

  it('un título con tilde, raya, comillas y <b>: el encabezado queda en ASCII y el nombre completo viaja codificado', () => {
    const cabecera = disposicionDeAdjunto(nombreDelPdf('Áreas – "género" <b>', '2026-10-20'));
    assert.doesNotMatch(cabecera, /[^\x20-\x7e]/);
    assert.ok(cabecera.includes('filename="Seguimiento - Areas _ _genero_ <b> - 2026-10-20.pdf"'), cabecera);
    assert.ok(cabecera.includes("filename*=UTF-8''Seguimiento%20-%20%C3%81reas%20%E2%80%93%20%22g%C3%A9nero%22%20%3Cb%3E%20-%202026-10-20.pdf"), cabecera);
    assert.ok(cabecera.startsWith('attachment; filename="'));
  });

  it('la barra invertida, el salto de línea y la ñ no rompen el encabezado', () => {
    const cabecera = disposicionDeAdjunto('a\\b\r\nSet-Cookie: x=1 ñ.pdf');
    assert.doesNotMatch(cabecera, /[^\x20-\x7e]/);
    assert.ok(cabecera.includes('filename="a_b__Set-Cookie: x=1 n.pdf"'), cabecera);
    assert.ok(cabecera.includes("filename*=UTF-8''a%5Cb%0D%0ASet-Cookie%3A%20x%3D1%20%C3%B1.pdf"), cabecera);
  });

  it('el apóstrofo, los paréntesis y el asterisco también se codifican (RFC 5987)', () => {
    const cabecera = disposicionDeAdjunto("Datos (2025) 'a' *.pdf");
    assert.ok(cabecera.includes("filename*=UTF-8''Datos%20%282025%29%20%27a%27%20%2A.pdf"), cabecera);
  });

  it('con algo que no es texto o con un sustituto suelto no tira error', () => {
    assert.doesNotThrow(() => disposicionDeAdjunto(undefined));
    assert.doesNotThrow(() => disposicionDeAdjunto(null));
    assert.doesNotThrow(() => disposicionDeAdjunto('uno\ud800dos.pdf'));
    assert.doesNotMatch(disposicionDeAdjunto('uno\ud800dos.pdf'), /[^\x20-\x7e]/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Notas DGMIT (spec 2026-10-24-notas-dgmit, 5 y 6): las notas que la DGMIT le manda al área, cargadas a mano
// ---------------------------------------------------------------------------------------------------------------------

// Una nota DGMIT como la da fuentesDe: `por` y los `por` del historial con el nombre completo
const notaDgmit = (datos) => ({
  id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00',
  por: 'Diego Martín Cuatro', por_id: 7, datasets: [{ id: 58, titulo: 'Áreas específicas de género' }], historial: [], ...datos
});
// Las fuentes de un caso con sus notas DGMIT y, si hace falta, algo del dataset cambiado
const conNotasDgmit = (id, notasDgmit, dataset = {}) => ({ ...f(id), dataset: { ...CASOS[id].dataset, ...dataset }, notasDgmit });
const deTipo = (movimientos, tipo) => movimientos.filter((m) => m.tipo === tipo);
// El 52 dado de baja (vencido y con avisos en el ciclo abierto)
const baja52 = () => ({ ...f(52), dataset: { ...CASOS[52].dataset, activo: false },
  cambios: [...CASOS[52].cambios, cambio({ id: 95, tipo: 'eliminar', revisado: '2026-09-02 11:00:00' })] });
// El tramo sin nota DGMIT: los textos del PDF son los de la pantalla
const tramoSinNota = (texto, titulo = 'Nota formal') => ({ titulo, texto, registrada: false, nota: null, tituloPdf: titulo, textoPdf: texto });

describe('movimientosDe: notas DGMIT', () => {
  const HOTELERIA = { id: 25, titulo: 'Hotelería en Comodoro Rivadavia' };
  const PRESUPUESTO = { id: 1, titulo: 'Presupuesto Municipal' };
  const PROPIO = { id: 58, titulo: 'Áreas específicas de género' };

  it('movimiento dgmit: título, detalle con los otros datasets, quién y extra', () => {
    const historial = [{ accion: 'correccion', motivo: 'Faltaba un dataset', por: 'Elena Noelia Cuatro', momento: '2026-10-17 10:00:00' }];
    const movs = movimientosDe(conNotasDgmit(58, [notaDgmit({ datasets: [PROPIO, HOTELERIA, PRESUPUESTO], historial })]), HOY);
    const dgmit = deTipo(movs, 'dgmit');
    assert.equal(dgmit.length, 1);
    assert.deepEqual(dgmit[0], {
      tipo: 'dgmit', filtro: 'dgmit', fecha: '2026-10-15', momento: '2026-10-15 00:00:00',
      titulo: 'Nota DGMIT N° 156/26 al área: solicitud',
      detalle: 'Recibida por el área el 15/10/2026. La misma nota pide también Hotelería en Comodoro Rivadavia y Presupuesto Municipal.',
      quien: ['Cargó Diego Cuatro'],
      extra: {
        nota_id: 1, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: '2026-10-16 09:30:00',
        por: 'Diego Cuatro', por_id: 7, area: CASOS[58].dataset.area, datasets: [PROPIO, HOTELERIA, PRESUPUESTO],
        historial: [{ accion: 'correccion', motivo: 'Faltaba un dataset', por: 'Elena Cuatro', momento: '2026-10-17 10:00:00' }]
      }
    });
    // Es el más nuevo del 58 (el email anterior es del 01/10/2026)
    assert.equal(movs[0].tipo, 'dgmit');
  });

  it('reiteración, sin otros datasets, con uno o con tres, y sin nombre de quien la cargó', () => {
    const uno = (datos) => deTipo(movimientosDe(conNotasDgmit(58, [notaDgmit(datos)]), HOY), 'dgmit')[0];
    const r = uno({ tipo: 'reiteracion', por: null, por_id: null });
    assert.equal(r.titulo, 'Nota DGMIT N° 156/26 al área: reiteración');
    assert.equal(r.detalle, 'Recibida por el área el 15/10/2026.');
    assert.deepEqual(r.quien, []);
    assert.equal(r.extra.por, null);
    assert.equal(r.extra.por_id, null);
    assert.equal(uno({ datasets: [HOTELERIA, PROPIO] }).detalle, 'Recibida por el área el 15/10/2026. La misma nota pide también Hotelería en Comodoro Rivadavia.');
    const tres = uno({ datasets: [PROPIO, HOTELERIA, PRESUPUESTO, { id: 9, titulo: 'Pedidos de Acceso a la Información Pública' }] });
    assert.equal(tres.detalle, 'Recibida por el área el 15/10/2026. La misma nota pide también Hotelería en Comodoro Rivadavia, Presupuesto Municipal y Pedidos de Acceso a la Información Pública.');
    // El número y el nombre, recortados
    const espacios = uno({ numero: '  156/26 ', por: '  Diego  Martín   Cuatro ' });
    assert.equal(espacios.titulo, 'Nota DGMIT N° 156/26 al área: solicitud');
    assert.deepEqual(espacios.quien, ['Cargó Diego Cuatro']);
  });

  it('el orden: por la fecha de recepción; el mismo día, después de lo que tiene hora', () => {
    // El email a DGMIT del 58 salió el 01/10/2026 a las 08:00:05
    const movs = movimientosDe(conNotasDgmit(58, [notaDgmit({ recibida: '2026-10-01' })]), HOY);
    assert.deepEqual(movs.slice(0, 2).map((m) => m.tipo), ['email', 'dgmit']);
    const dos = movimientosDe(conNotasDgmit(58, [notaDgmit({ id: 1, recibida: '2026-09-01' }), notaDgmit({ id: 2, numero: '157/26', recibida: '2026-10-10' })]), HOY);
    assert.deepEqual(deTipo(dos, 'dgmit').map((m) => m.extra.nota_id), [2, 1]);
  });

  it('la anulada: detalle con «Anulada el … por …: motivo» y extra.anulada', () => {
    const anulacion = { accion: 'anulacion', motivo: 'Se cargó dos veces', por: 'Elena Noelia Cuatro', momento: '2026-10-18 09:30:00' };
    const correccion = { accion: 'correccion', motivo: 'Otra fecha', por: 'Diego Martín Cuatro', momento: '2026-10-17 10:00:00' };
    const uno = (datos) => deTipo(movimientosDe(conNotasDgmit(58, [notaDgmit({ anulada: true, ...datos })]), HOY), 'dgmit')[0];
    const m = uno({ historial: [anulacion, correccion] });
    assert.equal(m.detalle, 'Recibida por el área el 15/10/2026. Anulada el 18/10/2026 por Elena Cuatro: Se cargó dos veces.');
    assert.equal(m.extra.anulada, true);
    assert.equal(m.titulo, 'Nota DGMIT N° 156/26 al área: solicitud');
    assert.deepEqual(m.extra.historial.map((h) => [h.accion, h.por]), [['anulacion', 'Elena Cuatro'], ['correccion', 'Diego Cuatro']]);
    // Si el motivo ya termina en punto no se repite; con otros datasets, la anulación va al final
    assert.equal(uno({ datasets: [PROPIO, HOTELERIA], historial: [{ ...anulacion, motivo: 'Era de otro dataset.' }] }).detalle,
      'Recibida por el área el 15/10/2026. La misma nota pide también Hotelería en Comodoro Rivadavia. Anulada el 18/10/2026 por Elena Cuatro: Era de otro dataset.');
    assert.match(uno({ historial: [{ ...anulacion, motivo: '¿Era otra nota?' }] }).detalle, /Elena Cuatro: ¿Era otra nota\?$/);
    // Sin nombre de quien la anuló, sin motivo, o sin la fila de la anulación
    assert.equal(uno({ historial: [{ ...anulacion, por: null }] }).detalle, 'Recibida por el área el 15/10/2026. Anulada el 18/10/2026: Se cargó dos veces.');
    assert.equal(uno({ historial: [{ ...anulacion, motivo: null }] }).detalle, 'Recibida por el área el 15/10/2026. Anulada el 18/10/2026 por Elena Cuatro.');
    assert.equal(uno({ historial: [correccion] }).detalle, 'Recibida por el área el 15/10/2026. Anulada.');
    // Una que no está anulada no lo dice aunque traiga correcciones
    assert.equal(uno({ anulada: false, historial: [correccion] }).detalle, 'Recibida por el área el 15/10/2026.');
  });

  it('una nota con recibida posterior a hoy no aparece', () => {
    const fuentes = conNotasDgmit(58, [notaDgmit({ id: 1, recibida: HOY }), notaDgmit({ id: 2, numero: '157/26', recibida: '2026-10-21' }),
      notaDgmit({ id: 3, numero: '158/26', recibida: '2026-10-05', anulada: true })]);
    // Las anuladas sí aparecen (la pantalla las tacha)
    assert.deepEqual(deTipo(movimientosDe(fuentes, HOY), 'dgmit').map((m) => m.extra.nota_id), [1, 3]);
    // Sin hoy (o con uno que no es una fecha) no se filtra
    assert.deepEqual(deTipo(movimientosDe(fuentes), 'dgmit').map((m) => m.extra.nota_id), [2, 1, 3]);
    assert.deepEqual(deTipo(movimientosDe(fuentes, 'mañana'), 'dgmit').map((m) => m.extra.nota_id), [2, 1, 3]);
    // seguimientoDe le pasa hoy
    assert.deepEqual(deTipo(seguimientoDe(fuentes, HOY).movimientos, 'dgmit').map((m) => m.extra.nota_id), [1, 3]);
  });

  it('una fuente sin notasDgmit es como una lista vacía', () => {
    // `solo` arma las fuentes sin notasDgmit a propósito (como las de antes de las notas DGMIT)
    const sinLista = solo({ proxima: '2026-09-30' }, { emails: [email({ id: 1, enviado: '2026-09-25 08:00:00' })] });
    assert.equal(Object.hasOwn(sinLista, 'notasDgmit'), false);
    const vacia = { ...sinLista, notasDgmit: [] };
    for (const fuentes of [sinLista, { ...sinLista, notasDgmit: null }, { ...sinLista, notasDgmit: 'x' }]) {
      assert.doesNotThrow(() => seguimientoDe(fuentes, HOY));
      assert.deepEqual(movimientosDe(fuentes, HOY), movimientosDe(vacia, HOY));
      assert.deepEqual(seguimientoDe(fuentes, HOY), seguimientoDe(vacia, HOY));
      assert.deepEqual(resumenParaLista(fuentes, HOY), resumenParaLista(vacia, HOY));
      assert.equal(notaDgmitDelCiclo(fuentes, ciclosDe(fuentes, HOY), HOY), null);
    }
    assert.deepEqual(seguimientoDe(sinLista, HOY).circuito.tramoFuera, tramoSinNota('Pendiente de carga'));
  });

  it('las notas DGMIT con datos raros se ignoran, sin error', () => {
    const raras = [null, 'x', {}, notaDgmit({ id: 2, recibida: '2026-02-30' }), notaDgmit({ id: 3, tipo: 'otra' }), notaDgmit({ id: 4, numero: '  ' }),
      notaDgmit({ id: 5, recibida: null }), notaDgmit({ id: 6, datasets: null, historial: null, cargada: 'ayer', por: 42 }),
      notaDgmit({ id: 7, anulada: true, datasets: [null, { id: 9 }, PROPIO], historial: [null, 'x', { accion: 'anulacion', motivo: '', por: null, momento: null }] })];
    const fuentes = conNotasDgmit(58, raras);
    assert.doesNotThrow(() => seguimientoDe(fuentes, HOY));
    assert.doesNotThrow(() => resumenParaLista(fuentes, HOY));
    const movs = deTipo(seguimientoDe(fuentes, HOY).movimientos, 'dgmit');
    assert.deepEqual(movs.map((m) => m.extra.nota_id), [7, 6]);
    assert.equal(movs[1].detalle, 'Recibida por el área el 15/10/2026.');
    assert.deepEqual([movs[1].extra.cargada, movs[1].extra.por, movs[1].extra.datasets, movs[1].extra.historial], [null, null, [], []]);
    assert.equal(movs[0].detalle, 'Recibida por el área el 15/10/2026. Anulada.');
    assert.equal(notaDgmitDelCiclo(fuentes, ciclosDe(fuentes, HOY), HOY).numero, '156/26');
  });
});

describe('notaDgmitDelCiclo', () => {
  it('notaDgmitDelCiclo: la más reciente del ciclo abierto; una de un ciclo anterior no cuenta', () => {
    // 52: el ciclo abierto empieza con la actualización aprobada el 04/02/2026 a las 09:58:15
    const notas = [
      notaDgmit({ id: 1, numero: '10/26', recibida: '2026-01-20' }),
      notaDgmit({ id: 2, numero: '40/26', recibida: '2026-03-10' }),
      notaDgmit({ id: 3, numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' }),
      notaDgmit({ id: 4, numero: '95/26', recibida: '2026-09-01', anulada: true }),
      notaDgmit({ id: 5, numero: '99/26', recibida: '2026-10-21' })
    ];
    const del = (lista) => {
      const fuentes = conNotasDgmit(52, lista);
      return notaDgmitDelCiclo(fuentes, ciclosDe(fuentes, HOY), HOY);
    };
    assert.deepEqual(del(notas), { numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' });
    assert.deepEqual(del([...notas].reverse()), { numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' });
    // La del ciclo anterior, la anulada y la posterior a hoy no cuentan
    assert.equal(del([notas[0], notas[3], notas[4]]), null);
    // La misma recibida: la cargada después; la misma carga: la de id mayor
    const mismoDia = [notaDgmit({ id: 7, numero: 'A', recibida: '2026-08-15', cargada: '2026-08-16 11:00:00' }),
      notaDgmit({ id: 6, numero: 'B', recibida: '2026-08-15', cargada: '2026-08-16 10:00:00' })];
    assert.equal(del(mismoDia).numero, 'A');
    const mismaCarga = [notaDgmit({ id: 9, numero: 'D', recibida: '2026-08-15' }), notaDgmit({ id: 8, numero: 'C', recibida: '2026-08-15' })];
    assert.equal(del(mismaCarga).numero, 'D');
    assert.equal(del([...mismaCarga].reverse()).numero, 'D');
  });

  it('una nota recibida el mismo día de la aprobación que cerró el ciclo va al ciclo anterior', () => {
    // 52: la actualización que cerró el ciclo anterior se aprobó el 04/02/2026 a las 09:58:15
    const ese = conNotasDgmit(52, [notaDgmit({ recibida: '2026-02-04' })]);
    const ciclos = ciclosDe(ese, HOY);
    assert.equal(cicloDelAviso(ciclos, '2026-02-04 00:00:00'), ciclos.length - 2);
    assert.equal(notaDgmitDelCiclo(ese, ciclos, HOY), null);
    assert.equal(circuitoDe(ese, ciclos, HOY).tramoFuera.texto, 'Pendiente de carga');
    // Al día siguiente ya es del ciclo abierto
    const siguiente = conNotasDgmit(52, [notaDgmit({ recibida: '2026-02-05' })]);
    assert.deepEqual(notaDgmitDelCiclo(siguiente, ciclosDe(siguiente, HOY), HOY), { numero: '156/26', tipo: 'solicitud', recibida: '2026-02-05' });
    // También con una actualización anterior a la doble verificación: la del 58, el 16/12/2025 a las 11:47:48
    const simple = conNotasDgmit(58, [notaDgmit({ recibida: '2025-12-16' })]);
    assert.equal(notaDgmitDelCiclo(simple, ciclosDe(simple, HOY), HOY), null);
    const despues = conNotasDgmit(58, [notaDgmit({ recibida: '2025-12-17' })]);
    assert.equal(notaDgmitDelCiclo(despues, ciclosDe(despues, HOY), HOY).recibida, '2025-12-17');
  });

  // R7 (revisión final): si ningún ciclo regía el día en que el área recibió la nota, cicloDelAviso cae en el ciclo 0, que con un solo
  // ciclo es el abierto. En ese camino la nota cuenta para el ciclo abierto solo si no es anterior a la última carga en el portal
  it('un solo ciclo con alta conocida: una nota anterior al alta y a la última carga no es del ciclo abierto', () => {
    // Sin cambios: un solo ciclo, desde el alta del 01/02/2026; la última carga en el portal, el 04/02/2026; vencido desde el 31/07/2026
    const fuentes = (notas, dataset = {}) => ({ ...solo({ alta: '2026-02-01 10:00:00', proxima: '2026-07-31', ultima: '2026-02-04', ...dataset }), notasDgmit: notas });
    const del = (notas, dataset) => {
      const conNotas = fuentes(notas, dataset);
      return notaDgmitDelCiclo(conNotas, ciclosDe(conNotas, HOY), HOY);
    };
    const vieja = notaDgmit({ recibida: '2025-03-01' });
    const conVieja = fuentes([vieja]);
    const ciclos = ciclosDe(conVieja, HOY);
    assert.equal(ciclos.length, 1);
    // cicloDelAviso no cambia: sin un ciclo que rija ese día, el 0
    assert.equal(cicloDelAviso(ciclos, '2025-03-01 00:00:00'), 0);
    assert.equal(notaDgmitDelCiclo(conVieja, ciclos, HOY), null);
    // El circuito (pantalla, PDF y anexo) y la lista (y con ella la pista de solicitud repetida) siguen sin nota
    assert.deepEqual(circuitoDe(conVieja, ciclos, HOY).tramoFuera, tramoSinNota('Pendiente de carga'));
    assert.deepEqual(seguimientoDe(conVieja, HOY).circuito.tramoFuera, tramoSinNota('Pendiente de carga'));
    assert.equal(resumenParaLista(conVieja, HOY).nota_dgmit, null);
    // Una del ciclo (el camino de siempre) cuenta, aunque también esté la vieja
    const delCiclo = notaDgmit({ id: 2, numero: '40/26', recibida: '2026-03-10' });
    assert.deepEqual(del([vieja, delCiclo]), { numero: '40/26', tipo: 'solicitud', recibida: '2026-03-10' });
    assert.deepEqual(resumenParaLista(fuentes([vieja, delCiclo]), HOY).nota_dgmit, { numero: '40/26', tipo: 'solicitud', recibida: '2026-03-10' });
    // Anterior al alta pero no a la última carga (cargado antes de entrar al RPAD): cuenta
    const esperada = { numero: '156/26', tipo: 'solicitud', recibida: '2025-03-01' };
    assert.deepEqual(del([vieja], { ultima: '2024-12-31' }), esperada);
    assert.deepEqual(del([vieja], { ultima: '2025-03-01' }), esperada);
    // Sin última carga, o con una que no es una fecha: cuenta (como antes)
    assert.deepEqual(del([vieja], { ultima: null }), esperada);
    assert.deepEqual(del([vieja], { ultima: 'ayer' }), esperada);
  });

  it('un solo ciclo sin alta conocida (empieza en su vencimiento): cuenta una nota desde la última carga; una anterior, no', () => {
    // Sin alta y sin cambios: el único ciclo empieza el día de su vencimiento (31/07/2026); la última carga, el 04/02/2026
    const fuentes = (notas) => ({ ...solo({ alta: null, proxima: '2026-07-31', ultima: '2026-02-04' }), notasDgmit: notas });
    const del = (notas) => {
      const conNotas = fuentes(notas);
      return notaDgmitDelCiclo(conNotas, ciclosDe(conNotas, HOY), HOY);
    };
    const ciclos = ciclosDe(fuentes([]), HOY);
    assert.equal(ciclos.length, 1);
    assert.equal(ciclos[0].desde, '2026-07-31 00:00:00');
    // Anterior a la última carga: ya la respondió esa carga (o una anterior)
    const vieja = notaDgmit({ id: 1, numero: '5/26', recibida: '2026-01-10' });
    assert.equal(del([vieja]), null);
    assert.equal(resumenParaLista(fuentes([vieja]), HOY).nota_dgmit, null);
    assert.deepEqual(circuitoDe(fuentes([vieja]), ciclos, HOY).tramoFuera, tramoSinNota('Pendiente de carga'));
    // El mismo día de la última carga o después, antes del vencimiento (ningún ciclo rige todavía): cuenta
    assert.deepEqual(del([notaDgmit({ recibida: '2026-02-04' })]), { numero: '156/26', tipo: 'solicitud', recibida: '2026-02-04' });
    const antesDelVencimiento = notaDgmit({ id: 2, numero: '60/26', recibida: '2026-06-15' });
    assert.deepEqual(del([vieja, antesDelVencimiento]), { numero: '60/26', tipo: 'solicitud', recibida: '2026-06-15' });
    assert.equal(circuitoDe(fuentes([vieja, antesDelVencimiento]), ciclos, HOY).tramoFuera.texto, 'Solicitud recibida por el área el 15/06/2026, hace 127 días');
    assert.deepEqual(resumenParaLista(fuentes([vieja, antesDelVencimiento]), HOY).nota_dgmit, { numero: '60/26', tipo: 'solicitud', recibida: '2026-06-15' });
    // Desde el vencimiento, el ciclo rige: el camino de siempre
    assert.deepEqual(del([vieja, notaDgmit({ id: 3, numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' })]),
      { numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' });
  });

  it('sin ciclos: la vigente más reciente', () => {
    const notas = [notaDgmit({ id: 1, numero: '5/25', recibida: '2025-06-10' }), notaDgmit({ id: 2, numero: '7/26', recibida: '2026-03-01' }),
      notaDgmit({ id: 3, numero: '8/26', recibida: '2026-05-01', anulada: true }), notaDgmit({ id: 4, numero: '9/26', recibida: '2026-10-25' })];
    // 66: eventual
    const eventual = conNotasDgmit(66, notas);
    assert.equal(ciclosDe(eventual, HOY), null);
    const esperada = { numero: '7/26', tipo: 'solicitud', recibida: '2026-03-01' };
    assert.deepEqual(notaDgmitDelCiclo(eventual, null, HOY), esperada);
    assert.deepEqual(notaDgmitDelCiclo(eventual, [], HOY), esperada);
    assert.deepEqual(notaDgmitDelCiclo(eventual, undefined, HOY), esperada);
    // Un externo sin fecha: igual, y el circuito la muestra
    const sinFecha = conNotasDgmit(58, notas, { proxima: null });
    assert.equal(ciclosDe(sinFecha, HOY), null);
    assert.deepEqual(notaDgmitDelCiclo(sinFecha, null, HOY), esperada);
    assert.equal(circuitoDe(sinFecha, null, HOY).tramoFuera.titulo, 'Nota DGMIT N° 7/26');
    // Sin vigentes, o con datos raros: null
    assert.equal(notaDgmitDelCiclo(conNotasDgmit(66, [notas[2], notas[3]]), null, HOY), null);
    assert.equal(notaDgmitDelCiclo(conNotasDgmit(66, []), null, HOY), null);
    assert.equal(notaDgmitDelCiclo(null, null, HOY), null);
    assert.equal(notaDgmitDelCiclo({}, 'x', HOY), null);
    assert.equal(notaDgmitDelCiclo(eventual, null, 'mañana'), null);
  });
});

// Las notas DGMIT de cada ciclo (spec 2026-10-24-metricas-y-reportes, 1.2: las métricas tienen que ubicar cada nota en el mismo ciclo
// que el Seguimiento). La regla es la de notaDgmitDelCiclo para todos los ciclos: el que regía el día en que el área la recibió, a las
// 00:00 (cicloDelAviso), y R7 solo en el camino del ciclo 0 cuando es el abierto
describe('notasDgmitPorCiclo', () => {
  // La nota como la lee el Seguimiento
  const leida = (n) => ({ id: n.id, numero: n.numero, tipo: n.tipo, recibida: n.recibida, anulada: false, cargada: n.cargada });
  const ids = (porCiclo) => porCiclo.map((notas) => notas.map((n) => n.id));
  // Para cada ciclo, la lista; y notaDgmitDelCiclo es la última de la lista del último ciclo
  const porCicloDe = (fuentes) => {
    const ciclos = ciclosDe(fuentes, HOY);
    const porCiclo = notasDgmitPorCiclo(fuentes, ciclos, HOY);
    assert.equal(porCiclo.length, ciclos.length);
    const ultima = porCiclo.at(-1).at(-1);
    assert.deepEqual(notaDgmitDelCiclo(fuentes, ciclos, HOY), ultima ? { numero: ultima.numero, tipo: ultima.tipo, recibida: ultima.recibida } : null);
    return porCiclo;
  };

  it('notasDgmitPorCiclo pone cada nota en el ciclo de notaDgmitDelCiclo', () => {
    // 52: tres ciclos; el segundo se abrió el 17/12/2025 a las 08:54:29 y el abierto, el 04/02/2026 a las 09:58:15
    const notas = [
      notaDgmit({ id: 1, numero: '10/26', recibida: '2026-01-20' }),
      notaDgmit({ id: 2, numero: '40/26', recibida: '2026-03-10' }),
      notaDgmit({ id: 3, numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' }),
      notaDgmit({ id: 4, numero: '95/26', recibida: '2026-09-01', anulada: true }),
      notaDgmit({ id: 5, numero: '99/26', recibida: '2026-10-21' }),
      notaDgmit({ id: 6, numero: '3/25', recibida: '2025-12-10' }),
      // El mismo día de la aprobación que cerró el segundo ciclo: es del segundo
      notaDgmit({ id: 7, numero: '12/26', recibida: '2026-02-04' }),
      // Anterior al alta: ningún ciclo regía y cicloDelAviso da el 0, que con tres ciclos no es el abierto (R7 no interviene)
      notaDgmit({ id: 8, numero: '1/25', recibida: '2025-11-15' })
    ];
    const porCiclo = porCicloDe(conNotasDgmit(52, notas));
    // La anulada y la posterior a hoy no son de ninguno; cada lista, por recibida
    assert.deepEqual(ids(porCiclo), [[8, 6], [1, 7], [2, 3]]);
    assert.deepEqual(porCiclo[2], [leida(notas[1]), leida(notas[2])]);
    // El orden de las fuentes no importa
    assert.deepEqual(notasDgmitPorCiclo(conNotasDgmit(52, [...notas].reverse()), ciclosDe(conNotasDgmit(52, notas), HOY), HOY), porCiclo);
    // Cada nota, en el ciclo que dice cicloDelAviso
    const ciclos = ciclosDe(conNotasDgmit(52, notas), HOY);
    porCiclo.forEach((lista, i) => lista.forEach((n) => assert.equal(cicloDelAviso(ciclos, `${n.recibida} 00:00:00`), i, n.numero)));

    // 58: la actualización anterior a la doble verificación, el 16/12/2025 a las 11:47:48, cierra el primero
    assert.deepEqual(ids(porCicloDe(conNotasDgmit(58, [notaDgmit({ id: 1, recibida: '2025-12-16' }), notaDgmit({ id: 2, recibida: '2025-12-17' })]))),
      [[1], [2]]);
    // 10: cinco ciclos; cada nota en el que regía (las aprobaciones fueron el 22/05, el 28/09 y el 14/10, de mañana)
    const del10 = [['2026-03-01', 1], ['2026-05-22', 2], ['2026-09-28', 3], ['2026-10-14', 4], ['2026-10-15', 5]]
      .map(([recibida, id]) => notaDgmit({ id, numero: `${id}/26`, recibida }));
    assert.deepEqual(ids(porCicloDe(conNotasDgmit(10, del10))), [[], [1, 2], [3], [4], [5]]);
    // Sin notas, una lista vacía por ciclo
    assert.deepEqual(porCicloDe(conNotasDgmit(52, [])), [[], [], []]);
  });

  it('notasDgmitPorCiclo: la misma recibida, por la carga y después por id (el orden de notaDgmitDelCiclo)', () => {
    const mismoDia = [notaDgmit({ id: 7, numero: 'A', recibida: '2026-08-15', cargada: '2026-08-16 11:00:00' }),
      notaDgmit({ id: 6, numero: 'B', recibida: '2026-08-15', cargada: '2026-08-16 10:00:00' }),
      // Cargada antes pero con id mayor: va primero
      notaDgmit({ id: 9, numero: 'E', recibida: '2026-08-15', cargada: '2026-08-16 09:00:00' })];
    assert.deepEqual(ids(porCicloDe(conNotasDgmit(52, mismoDia))), [[], [], [9, 6, 7]]);
    const mismaCarga = [notaDgmit({ id: 9, numero: 'D', recibida: '2026-08-15' }), notaDgmit({ id: 8, numero: 'C', recibida: '2026-08-15' })];
    assert.deepEqual(ids(porCicloDe(conNotasDgmit(52, mismaCarga))), [[], [], [8, 9]]);
  });

  it('notasDgmitPorCiclo: R7 en un solo ciclo, y sin ciclos ninguna lista', () => {
    // Un solo ciclo, desde el alta del 01/02/2026; la última carga en el portal, el 04/02/2026
    const conAlta = (notas, dataset = {}) => ({ ...solo({ alta: '2026-02-01 10:00:00', proxima: '2026-07-31', ultima: '2026-02-04', ...dataset }), notasDgmit: notas });
    const vieja = notaDgmit({ id: 1, numero: '5/25', recibida: '2025-03-01' });
    const delCiclo = notaDgmit({ id: 2, numero: '40/26', recibida: '2026-03-10' });
    // Anterior al alta y a la última carga: de ningún ciclo
    assert.deepEqual(ids(porCicloDe(conAlta([vieja, delCiclo]))), [[2]]);
    // Anterior al alta pero no a la última carga, o sin última carga: del ciclo abierto
    assert.deepEqual(ids(porCicloDe(conAlta([vieja, delCiclo], { ultima: '2024-12-31' }))), [[1, 2]]);
    assert.deepEqual(ids(porCicloDe(conAlta([vieja], { ultima: null }))), [[1]]);
    // Sin alta conocida: el único ciclo empieza en su vencimiento (31/07/2026)
    const sinAlta = (notas) => ({ ...solo({ alta: null, proxima: '2026-07-31', ultima: '2026-02-04' }), notasDgmit: notas });
    const notas = [notaDgmit({ id: 1, recibida: '2026-01-10' }), notaDgmit({ id: 2, recibida: '2026-02-04' }),
      notaDgmit({ id: 3, recibida: '2026-06-15' }), notaDgmit({ id: 4, recibida: '2026-08-15' })];
    assert.deepEqual(ids(porCicloDe(sinAlta(notas))), [[2, 3, 4]]);

    // Sin ciclos (eventual o sin fecha): ninguna lista; notaDgmitDelCiclo sigue con la vigente más reciente
    const eventual = conNotasDgmit(66, notas);
    for (const ciclos of [null, undefined, [], 'x']) assert.deepEqual(notasDgmitPorCiclo(eventual, ciclos, HOY), [], String(ciclos));
    // Fuentes o un hoy raros: una lista vacía por ciclo
    const ciclos52 = ciclosDe(f(52), HOY);
    for (const fuentes of [null, undefined, 'x', {}]) assert.deepEqual(notasDgmitPorCiclo(fuentes, ciclos52, HOY), [[], [], []]);
    assert.deepEqual(notasDgmitPorCiclo(conNotasDgmit(52, notas), ciclos52, 'mañana'), [[], [], []]);
    // Notas con datos raros: se ignoran, sin error
    const raras = [null, 'x', {}, notaDgmit({ id: 2, recibida: '2026-02-30' }), notaDgmit({ id: 3, tipo: 'otra' }), notaDgmit({ id: 4, numero: '  ' }),
      notaDgmit({ id: 5, recibida: null }), notaDgmit({ id: 6, cargada: 'ayer' }), notaDgmit({ id: 7, anulada: true })];
    assert.deepEqual(porCicloDe(conNotasDgmit(58, raras)),
      [[], [{ id: 6, numero: '156/26', tipo: 'solicitud', recibida: '2026-10-15', anulada: false, cargada: null }]]);
  });

  it('notasDgmitPorCiclo no modifica las fuentes ni los ciclos', () => {
    const fuentes = conNotasDgmit(52, [notaDgmit({ id: 1, recibida: '2026-03-10' }), notaDgmit({ id: 2, recibida: '2026-01-20' })]);
    const ciclos = ciclosDe(fuentes, HOY);
    const [antes, ciclosAntes] = [JSON.stringify(fuentes), JSON.stringify(ciclos)];
    notasDgmitPorCiclo(fuentes, ciclos, HOY);
    assert.equal(JSON.stringify(fuentes), antes);
    assert.equal(JSON.stringify(ciclos), ciclosAntes);
  });
});

describe('circuitoDe: notas DGMIT', () => {
  const circuito = (fuentes, opciones, hoy = HOY) => circuitoDe(fuentes, ciclosDe(fuentes, hoy), hoy, opciones);

  it('circuito con nota: textos de pantalla y PDF, registrada, hace N días (hoy, 1 día, N días)', () => {
    const c = circuito(conNotasDgmit(58, [notaDgmit({ recibida: HOY })]));
    assert.deepEqual(c.tramoFuera, {
      titulo: 'Nota DGMIT N° 156/26', texto: 'Solicitud recibida por el área el 20/10/2026, hoy', registrada: true,
      nota: { numero: '156/26', tipo: 'solicitud', recibida: '2026-10-20' }, tituloPdf: 'Nota DGMIT', textoPdf: 'Solicitud 156/26. Recibida el 20/10/2026'
    });
    assert.deepEqual(c.nodoMedio, { nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' });
    const texto = (recibida, tipo = 'solicitud') => circuito(conNotasDgmit(58, [notaDgmit({ recibida, tipo })])).tramoFuera.texto;
    assert.equal(texto('2026-10-19'), 'Solicitud recibida por el área el 19/10/2026, hace 1 día');
    assert.equal(texto('2026-10-10'), 'Solicitud recibida por el área el 10/10/2026, hace 10 días');
    // Los días se cuentan de calendario, cruzando meses y años
    assert.equal(texto('2025-12-20', 'reiteracion'), 'Reiteración recibida por el área el 20/12/2025, hace 304 días');
    const r = circuito(conNotasDgmit(58, [notaDgmit({ numero: '160/26', tipo: 'reiteracion', recibida: '2026-10-10' })])).tramoFuera;
    assert.deepEqual([r.titulo, r.tituloPdf, r.textoPdf, r.registrada], ['Nota DGMIT N° 160/26', 'Nota DGMIT', 'Reiteración 160/26. Recibida el 10/10/2026', true]);
    assert.deepEqual(r.nota, { numero: '160/26', tipo: 'reiteracion', recibida: '2026-10-10' });
    // Los avisos, el área, el vencimiento y desde cuándo se cuentan no cambian
    const sin = circuito(f(58));
    assert.deepEqual([c.avisos, c.area, c.vencimiento, c.desde], [sin.avisos, sin.area, sin.vencimiento, sin.desde]);
    // El texto no reprocha nada
    assert.doesNotMatch(JSON.stringify(c), /sin entregar|sin respuesta|atrasad|no mandó|no envió la nota/i);
  });

  it('circuito sin nota: Pendiente de carga (58), Todavía no hizo falta (25), Ya no se pide (dado de baja)', () => {
    // 58: el RPAD ya avisó en el ciclo abierto (un email el 01/10/2026)
    assert.deepEqual(circuito(f(58)).tramoFuera, tramoSinNota('Pendiente de carga'));
    // 25: sin avisos en el ciclo abierto y vence en 2027
    assert.deepEqual(circuito(f(25)).tramoFuera, tramoSinNota('Todavía no hizo falta'));
    // Vencido aunque no haya avisos: ya hacía falta; el día del vencimiento, todavía no
    assert.deepEqual(circuito(solo({ proxima: '2026-09-30' })).tramoFuera, tramoSinNota('Pendiente de carga'));
    assert.deepEqual(circuito(solo({ proxima: HOY })).tramoFuera, tramoSinNota('Todavía no hizo falta'));
    // 52: vencido y con avisos
    assert.deepEqual(circuito(f(52)).tramoFuera, tramoSinNota('Pendiente de carga'));
    // Sin ciclos (un eventual externo con emails, o sin fecha): todavía no hizo falta
    assert.deepEqual(circuito(conNotasDgmit(66, [], { tipo_gestion: 'externa' })).tramoFuera, tramoSinNota('Todavía no hizo falta'));
    assert.deepEqual(circuito(solo({ proxima: null })).tramoFuera, tramoSinNota('Todavía no hizo falta'));
    // Dado de baja, aunque estuviera vencido y con avisos
    assert.deepEqual(circuito(baja52()).tramoFuera, tramoSinNota('Ya no se pide'));
    // Una anulada, una posterior a hoy o una de un ciclo anterior no es la nota del ciclo
    const noCuentan = [notaDgmit({ id: 1, anulada: true }), notaDgmit({ id: 2, recibida: '2026-10-21' }), notaDgmit({ id: 3, recibida: '2025-12-10' })];
    assert.deepEqual(circuito(conNotasDgmit(58, noCuentan)).tramoFuera, tramoSinNota('Pendiente de carga'));
  });

  it('circuito en el anexo sin nota: La manda la DGMIT al área; con nota, la nota', () => {
    const anexo = { anexo: true };
    for (const [nombre, fuentes] of [['58', f(58)], ['25', f(25)], ['52', f(52)], ['vencido', solo({ proxima: '2026-09-30' })], ['baja', baja52()],
      ['eventual', conNotasDgmit(66, [], { tipo_gestion: 'externa' })]]) {
      const c = circuito(fuentes, anexo);
      assert.deepEqual(c.tramoFuera, tramoSinNota('La manda la DGMIT al área'), nombre);
      assert.doesNotMatch(JSON.stringify(c), /Pendiente de carga|Ya no se pide/, nombre);
      // Lo demás es lo de la pantalla
      const pantalla = circuito(fuentes);
      assert.deepEqual({ ...c, tramoFuera: null }, { ...pantalla, tramoFuera: null }, nombre);
    }
    // Con nota, el anexo la muestra como la pantalla
    const conNota = conNotasDgmit(58, [notaDgmit({ recibida: '2026-10-10' })]);
    assert.deepEqual(circuito(conNota, anexo), circuito(conNota));
    // Con «No» y sin nota, también en el anexo: sin nota formal
    assert.deepEqual(circuito(conNotasDgmit(81, [], { requiere_nota: 0 }), anexo).tramoFuera, tramoSinNota('Los datos se obtienen de la fuente', 'Sin nota formal'));
    // La gestión interna, como siempre
    assert.deepEqual(circuito(f(26), anexo), circuito(f(26)));
    // seguimientoDe le pasa la opción a circuitoDe
    assert.deepEqual(seguimientoDe(f(58), HOY, {}, anexo).circuito.tramoFuera, tramoSinNota('La manda la DGMIT al área'));
    assert.equal(seguimientoDe(f(58), HOY).circuito.tramoFuera.texto, 'Pendiente de carga');
    assert.equal(seguimientoDe(f(58), HOY, {}, null).circuito.tramoFuera.texto, 'Pendiente de carga');
    // Sin la opción, o con algo raro, es la pantalla
    for (const raras of [undefined, null, {}, 5, { anexo: false }]) assert.equal(circuito(f(58), raras).tramoFuera.texto, 'Pendiente de carga', String(raras));
  });

  it('externo con No: sin nota como hoy; con nota, el tramo de la nota, el nodo medio Mandan la nota formal al área y alArea con la nota', () => {
    const sin = circuito(conNotasDgmit(81, [], { requiere_nota: 0 }));
    assert.deepEqual(sin.nodoMedio, { nombre: 'DGMIT y Dirección Administrativa', rol: 'No hace falta nota formal' });
    assert.deepEqual(sin.tramoFuera, tramoSinNota('Los datos se obtienen de la fuente', 'Sin nota formal'));
    assert.equal(sin.alArea, null);
    const nota = notaDgmit({ numero: '160/26', recibida: HOY, datasets: [{ id: 81, titulo: CASOS[81].dataset.titulo }] });
    const con = circuito(conNotasDgmit(81, [nota], { requiere_nota: 0 }));
    assert.deepEqual(con.nodoMedio, { nombre: 'DGMIT y Dirección Administrativa', rol: 'Mandan la nota formal al área' });
    assert.deepEqual(con.tramoFuera, {
      titulo: 'Nota DGMIT N° 160/26', texto: 'Solicitud recibida por el área el 20/10/2026, hoy', registrada: true,
      nota: { numero: '160/26', tipo: 'solicitud', recibida: '2026-10-20' }, tituloPdf: 'Nota DGMIT', textoPdf: 'Solicitud 160/26. Recibida el 20/10/2026'
    });
    assert.deepEqual(con.alArea, { fechas: [], texto: null, textoPdf: 'Al área: el 20/10/2026 recibió la nota DGMIT N° 160/26 (solicitud), que pide los datos de este dataset.' });
    assert.deepEqual([con.avisos, con.area, con.vencimiento, con.desde], [sin.avisos, sin.area, sin.vencimiento, sin.desde]);
    // Con «Sí» y la misma nota, el mismo circuito
    assert.deepEqual(circuito(conNotasDgmit(81, [nota], { requiere_nota: 1 })), con);
  });

  it('alArea.textoPdf con nota y sin nota', () => {
    // 52: un email al área el 21/06/2026 en el ciclo abierto. La pantalla lo sigue diciendo; el PDF dice la nota
    const sin = circuito(f(52)).alArea;
    assert.equal(sin.textoPdf, 'Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.');
    const con = circuito(conNotasDgmit(52, [notaDgmit({ numero: '120/26', tipo: 'reiteracion', recibida: '2026-08-10' })])).alArea;
    assert.deepEqual(con, { fechas: ['2026-06-21'], texto: sin.texto,
      textoPdf: 'Al área: el 10/08/2026 recibió la nota DGMIT N° 120/26 (reiteración), que pide los datos de este dataset.' });
    // 58: sin emails al área en el ciclo
    assert.equal(circuito(f(58)).alArea.textoPdf, 'Al área: en este ciclo todavía no se le envió el email que anticipa la nota formal.');
    assert.deepEqual(circuito(conNotasDgmit(58, [notaDgmit()])).alArea,
      { fechas: [], texto: null, textoPdf: 'Al área: el 15/10/2026 recibió la nota DGMIT N° 156/26 (solicitud), que pide los datos de este dataset.' });
    // Una nota de un ciclo anterior no cambia el renglón
    assert.deepEqual(circuito(conNotasDgmit(52, [notaDgmit({ recibida: '2026-01-20' })])).alArea, sin);
  });

  it('gestión interna: el circuito no cambia (salvo las claves nuevas)', () => {
    const c = circuito(f(26));
    assert.deepEqual(c.tramoFuera, tramoSinNota('Por fuera del RPAD: no queda registrado', 'Relevamiento'));
    assert.deepEqual(c.nodoMedio, { nombre: 'DGMIT y Dirección de Investigación Territorial', rol: 'Hacen el relevamiento' });
    assert.equal(c.alArea, null);
    // Aunque tenga una nota DGMIT (de cuando era de gestión externa)
    assert.deepEqual(circuito(conNotasDgmit(26, [notaDgmit({ recibida: '2026-10-01' })])), c);
    const eventual = circuito(f(66));
    assert.deepEqual(eventual.tramoFuera, tramoSinNota('Por fuera del RPAD: no queda registrado', 'Relevamiento'));
    assert.deepEqual(circuito(conNotasDgmit(66, [notaDgmit()])), eventual);
  });

  it('una nota DGMIT no cambia avisosDelCiclo, ciclos, hitos ni estado', () => {
    const notas = [notaDgmit({ id: 1, recibida: '2026-01-20' }), notaDgmit({ id: 2, numero: '157/26', recibida: '2026-08-15' }),
      notaDgmit({ id: 3, numero: '158/26', recibida: HOY, anulada: true }), notaDgmit({ id: 4, numero: '159/26', recibida: '2026-10-21' })];
    for (const id of [58, 52, 25, 81, 26, 66, 1, 10]) {
      const sin = f(id);
      const con = conNotasDgmit(id, notas);
      const ciclos = ciclosDe(sin, HOY);
      assert.deepEqual(ciclosDe(con, HOY), ciclos, `caso ${id}`);
      for (let i = 0; i < (ciclos?.length ?? 0); i++) assert.deepEqual(avisosDelCiclo(con, ciclos, i), avisosDelCiclo(sin, ciclos, i), `caso ${id}, ciclo ${i}`);
      assert.deepEqual(hitosDe(ciclosDe(con, HOY), HOY), hitosDe(ciclos, HOY), `caso ${id}`);
      assert.deepEqual(estadoDeSeguimiento(con.dataset, HOY), estadoDeSeguimiento(sin.dataset, HOY), `caso ${id}`);
      assert.equal(ultimoAviso(con), ultimoAviso(sin), `caso ${id}`);
      const s = { con: seguimientoDe(con, HOY), sin: seguimientoDe(sin, HOY) };
      assert.deepEqual([s.con.ficha, s.con.hitos, s.con.circuito.avisos, s.con.circuito.area], [s.sin.ficha, s.sin.hitos, s.sin.circuito.avisos, s.sin.circuito.area], `caso ${id}`);
      // Los demás movimientos son los mismos
      assert.deepEqual(s.con.movimientos.filter((m) => m.tipo !== 'dgmit'), s.sin.movimientos, `caso ${id}`);
      const r = { con: resumenParaLista(con, HOY), sin: resumenParaLista(sin, HOY) };
      assert.deepEqual({ ...r.con, nota_dgmit: null }, { ...r.sin, nota_dgmit: null }, `caso ${id}`);
    }
  });
});

describe('resumenParaLista y conNotasDgmitEditables: notas DGMIT', () => {
  it('resumenParaLista: requiere_nota y nota_dgmit', () => {
    const r58 = resumenParaLista(f(58), HOY);
    assert.equal(r58.requiere_nota, null);
    assert.equal(r58.nota_dgmit, null);
    for (const [valor, esperado] of [[1, 1], [0, 0], ['0', 0], ['1', 1], [null, null], ['si', null]]) {
      assert.equal(resumenParaLista(conNotasDgmit(58, [], { requiere_nota: valor }), HOY).requiere_nota, esperado, String(valor));
    }
    // En gestión interna, siempre null
    assert.equal(resumenParaLista(conNotasDgmit(26, [], { requiere_nota: 1 }), HOY).requiere_nota, null);
    // La nota del ciclo abierto (la misma que notaDgmitDelCiclo)
    const notas = [notaDgmit({ id: 1, numero: '10/26', recibida: '2026-01-20' }), notaDgmit({ id: 2, numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' })];
    const fuentes = conNotasDgmit(52, notas);
    assert.deepEqual(resumenParaLista(fuentes, HOY).nota_dgmit, { numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' });
    assert.deepEqual(resumenParaLista(fuentes, HOY).nota_dgmit, notaDgmitDelCiclo(fuentes, ciclosDe(fuentes, HOY), HOY));
    assert.equal(resumenParaLista(conNotasDgmit(52, [notas[0]]), HOY).nota_dgmit, null);
    // Sin ciclos, la vigente más reciente
    assert.deepEqual(resumenParaLista(conNotasDgmit(66, notas), HOY).nota_dgmit, { numero: '90/26', tipo: 'reiteracion', recibida: '2026-08-15' });
    // Con datos raros no tira error
    assert.doesNotThrow(() => resumenParaLista({ dataset: CASOS[52].dataset, notasDgmit: [null, {}] }, HOY));
    assert.equal(resumenParaLista(null, HOY).nota_dgmit, null);
    assert.equal(resumenParaLista(null, HOY).requiere_nota, null);
  });

  it('conNotasDgmitEditables: quien la cargó y administración sí, otro no; saca por_id; no toca el original', () => {
    const s = seguimientoDe(conNotasDgmit(58, [notaDgmit({ id: 1, por_id: 7 }),
      notaDgmit({ id: 2, numero: '157/26', recibida: '2026-10-10', por: null, por_id: null })]), HOY);
    const antes = structuredClone(s);
    const dgmit = (seguimiento) => deTipo(seguimiento.movimientos, 'dgmit');
    const editables = (quien) => dgmit(conNotasDgmitEditables(s, quien)).map((m) => [m.extra.nota_id, m.extra.editable]);
    assert.deepEqual(editables({ usuarioId: 7, administracion: false }), [[1, true], [2, false]]);
    assert.deepEqual(editables({ usuarioId: 8, administracion: false }), [[1, false], [2, false]]);
    assert.deepEqual(editables({ usuarioId: 8, administracion: true }), [[1, true], [2, true]]);
    // Sin usuario, una nota sin quién la cargó no es de nadie
    assert.deepEqual(editables({ usuarioId: null, administracion: false }), [[1, false], [2, false]]);
    assert.deepEqual(editables({ administracion: false }), [[1, false], [2, false]]);
    assert.deepEqual(editables(undefined), [[1, false], [2, false]]);
    assert.deepEqual(editables(null), [[1, false], [2, false]]);
    // Falla cerrado: administración es solo el true literal; otro valor "verdadero" no da permiso sobre la nota de otro
    for (const administracion of ['si', 'true', 1, {}, [], 'admin']) {
      assert.deepEqual(editables({ usuarioId: 8, administracion }), [[1, false], [2, false]], JSON.stringify(administracion));
      assert.deepEqual(editables({ usuarioId: 7, administracion }), [[1, true], [2, false]], JSON.stringify(administracion));
    }
    // Saca por_id; lo demás del movimiento queda igual
    const r = conNotasDgmitEditables(s, { usuarioId: 7, administracion: false });
    assert.ok(dgmit(r).every((m) => !Object.hasOwn(m.extra, 'por_id')));
    const comoAntes = (m) => {
      if (m.tipo !== 'dgmit') return m;
      const { editable: _editable, ...extra } = m.extra;
      return { ...m, extra };
    };
    const sinPorId = (m) => {
      if (m.tipo !== 'dgmit') return m;
      const { por_id: _porId, ...extra } = m.extra;
      return { ...m, extra };
    };
    assert.deepEqual(r.movimientos.map(comoAntes), s.movimientos.map(sinPorId));
    assert.deepEqual({ ...r, movimientos: [] }, { ...s, movimientos: [] });
    // El original no cambia
    assert.deepEqual(s, antes);
    assert.ok(dgmit(s).every((m) => Object.hasOwn(m.extra, 'por_id') && !Object.hasOwn(m.extra, 'editable')));
    // Con datos raros no tira error
    assert.equal(conNotasDgmitEditables(null, {}), null);
    assert.deepEqual(conNotasDgmitEditables({}, {}), {});
    const raros = { movimientos: [null, { tipo: 'dgmit' }, { tipo: 'dgmit', extra: null }] };
    assert.deepEqual(conNotasDgmitEditables(raros, { administracion: true }), { movimientos: [null, { tipo: 'dgmit' }, { tipo: 'dgmit', extra: null }] });
  });
});
