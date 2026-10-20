// Reglas del Seguimiento del dataset (spec 2026-10-20-seguimiento-dataset, "Las fuentes y los movimientos"): funciones puras,
// probadas con los casos reales anonimizados de tests/seguimiento-casos.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, CATALOGOS, HOY_DE_LOS_CASOS as HOY } from './seguimiento-casos.js';
import {
  REGISTRO_DESDE, ASUNTOS_EMAIL, QUE_PEDIA, FALTABAN, diaDe, nombreCorto, unirAlta, movimientosDe,
  ciclosDe, cicloDelAviso, avisosDelCiclo, ultimoAviso, hitosDe, estadoDeSeguimiento, circuitoDe,
  seguimientoDe, resumenParaLista, nombreDelPdf, disposicionDeAdjunto, sinErroresTecnicos
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

// Los valores reales de los casos al 20/10/2026: por ciclo, [vencimiento, cierre, cómo se cerró, días que estuvo vencido]
const CICLOS = {
  52: [['2026-01-31', '2026-02-04', 'actualizacion', 4], ['2026-07-31', null, null, 81]],
  9: [['2025-01-31', '2026-03-13', 'actualizacion', 406], ['2026-04-30', '2026-10-09', 'actualizacion', 162], ['2027-01-31', null, null, 0]],
  10: [['2026-01-31', '2026-02-18', 'actualizacion', 18], ['2026-05-31', '2026-05-22', 'actualizacion', 0], ['2026-07-31', '2026-09-25', 'actualizacion', 56],
    ['2026-10-31', '2026-10-13', 'actualizacion', 0], ['2027-01-31', null, null, 0]],
  42: [['2026-03-31', '2026-04-06', 'reprogramacion', 6], ['2027-04-30', null, null, 0]],
  38: [['2026-03-31', '2026-02-12', 'actualizacion', 0], ['2026-09-30', '2026-10-02', 'actualizacion', 2], ['2027-03-31', null, null, 0]],
  1: [['2026-01-31', null, null, 262]], 11: [['2024-01-31', null, null, 993]], 26: [['2025-03-31', null, null, 568]],
  33: [['2026-01-31', null, null, 262]], 81: [['2026-10-31', null, null, 0]]
};
// Los avisos del ciclo abierto de cada caso
const ABIERTO = { 52: { emails: 5, notas: ['2/26'], alArea: ['2026-06-21'] }, 9: { emails: 0, notas: [], alArea: [] }, 10: { emails: 0, notas: [], alArea: [] },
  42: { emails: 0, notas: [], alArea: [] }, 1: { emails: 10, notas: ['2/26'], alArea: [] }, 11: { emails: 11, notas: ['2/26'], alArea: [] },
  33: { emails: 5, notas: ['2/26'], alArea: [] }, 61: { emails: 6, notas: ['2/26'], alArea: ['2025-12-22', '2026-06-21'] }, 81: { emails: 0, notas: ['3/26'], alArea: [] } };

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

  it('cada ciclo trae inicio, desde y hasta: el primero empieza en el alta y cada uno en la aprobación del anterior', () => {
    const [primero, abierto] = ciclosDe(f(52), HOY);
    assert.deepEqual(primero, { inicio: '2025-12-01', venc: '2026-01-31', cierre: '2026-02-04', como: 'actualizacion',
      desde: '2025-12-01 21:51:48', hasta: '2026-02-04 09:58:15', diasVencido: 4 });
    assert.deepEqual(abierto, { inicio: '2026-02-04', venc: '2026-07-31', cierre: null, como: null,
      desde: '2026-02-04 09:58:15', hasta: null, diasVencido: 81 });
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
    assert.deepEqual(avisosDelCiclo(fuentes, ciclosDe(fuentes, HOY), 0), { emails: 1, notas: ['5/26'], alArea: ['2026-09-21'], total: 2 });
  });

  it('las notas salen por orden de envío y las reiteraciones cuentan', () => {
    const fuentes = solo({ proxima: '2026-10-31' }, { notas: [
      nota({ id: 2, numero: 9, tipo: 'reiteracion', enviada: '2026-10-19 08:15:00', fecha: '2026-10-19' }),
      nota({ id: 1, numero: 7, enviada: '2026-10-05 08:15:00', fecha: '2026-10-05' })] });
    assert.deepEqual(avisosDelCiclo(fuentes, ciclosDe(fuentes, HOY), 0).notas, ['7/26', '9/26']);
  });

  it('sin ciclos, con un índice que no existe o con listas ausentes: ceros', () => {
    const vacio = { emails: 0, notas: [], alArea: [], total: 0 };
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
    assert.deepEqual(c.tramoFuera, { titulo: 'Nota formal', texto: 'Por fuera del RPAD: no queda registrada' });
    assert.deepEqual(c.avisos, { titulo: '6 avisos', texto: '5 emails y la Nota Digital N° 2/26' });
    assert.deepEqual(c.area, { nombre: 'Dirección General de Relaciones Laborales', texto: 'Vencido hace 81 días', vencido: true });
    assert.deepEqual(c.alArea, {
      fechas: ['2026-06-21'],
      texto: 'Además, el 21/06/2026 el RPAD le anticipó por email al área que iba a recibir una nota formal.',
      textoPdf: 'Al área: el 21/06/2026 el RPAD le anticipó por email que iba a recibir una nota formal.'
    });
    assert.deepEqual(c.vencimiento, { fecha: '2026-07-31', texto: 'Vencimiento del 31/07/2026' });
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
    assert.deepEqual(c.tramoFuera, { titulo: 'Relevamiento', texto: 'Por fuera del RPAD: no queda registrado' });
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
      frecuencia: 'Cada medio año', datos_al: '2025-12-31', ultima: '2026-02-04', proxima: '2026-07-31',
      pedido: 'Vigente al 30/06/2026', url_dataset: dataset.url_dataset,
      estado: estadoDeSeguimiento(dataset, HOY), activo: true, baja: null
    });
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
    assert.deepEqual(Object.keys(r), ['id', 'titulo', 'area', 'tipo_gestion', 'activo', 'estado', 'dias', 'proxima', 'avisos', 'ultimo_aviso', 'pendiente']);
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
      assert.equal(r.ultimo_aviso, ultimoAviso(fuentes), `caso ${id}`);
    }
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
