// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 3.9, 7 y 8): el panel como datos. El Resumen
// «Niveles» (Vence pronto, los tanques, las pastillas y las opciones de «Cargar licencia»), la lista de licencias de un año,
// las tablas de horas extras y el próximo feriado, con todos sus números y sus textos: la página los imprime tal cual
// (Ruling 19). Puras, sin base, sobre los casos de tests/fixtures/mi-espacio-casos.js y sin feriados de la tabla.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroTexto, diaCorto, diaLargo, mesEnFrase, mesTitulo, resumenDe, filasDeLicencias, tablaDeHorasExtras, proximoFeriadoDe
} from '../services/miEspacioResumen.js';
import * as reglas from '../services/miEspacioReglas.js';
import { NOMBRES_DE_LOS_FIJOS } from '../services/feriadosReglas.js';
import { HOY, SIN_FERIADOS, PLANTA, CONTRATO } from './fixtures/mi-espacio-casos.js';

const { calcular, MENSAJES_MI_ESPACIO } = reglas;

const HOY_Y_MANANA = Object.freeze({ ausentes: [], proximo_feriado: null });

const calculoDe = (estado, hoy = HOY) => calcular(estado, { hoy, feriados: SIN_FERIADOS });

// El Resumen de un caso, con otro estado, otro hoy u otra persona si hace falta (los casos están congelados)
const resumenDel = (caso, { estado = caso.estado, hoy = HOY, persona = caso.persona, hoyYManana = HOY_Y_MANANA } = {}) =>
  resumenDe({ persona, estado, calculo: calculoDe(estado, hoy), hoy, feriados: SIN_FERIADOS, hoyYManana });

const filasDel = (caso, { estado = caso.estado, hoy = HOY, anio = 2026, persona = caso.persona, vinculos } = {}) =>
  filasDeLicencias(estado, calculoDe(estado, hoy), { anio, hoy, persona, vinculos, feriados: SIN_FERIADOS });

const tablaDel = (caso, { estado = caso.estado, hoy = HOY, anio = 2026 } = {}) =>
  tablaDeHorasExtras(estado, calculoDe(estado, hoy), { anio, hoy, feriados: SIN_FERIADOS });

const conLicencias = (estado, ...licencias) => ({ ...estado, licencias: [...estado.licencias, ...licencias] });
const licencia = (id, tipo, desde, hasta = desde, horas = null) => ({ id, tipo, desde, hasta, horas });

// Ningún undefined ni NaN, en ningún nivel: todo número es un número y todo texto, un texto
const sinHuecos = (valor, camino = 'raíz') => {
  assert.notEqual(valor, undefined, `${camino} es undefined`);
  if (typeof valor === 'number') assert.ok(Number.isFinite(valor), `${camino} no es un número finito`);
  if (valor !== null && typeof valor === 'object') {
    for (const [clave, otro] of Object.entries(valor)) sinHuecos(otro, `${camino}.${clave}`);
  }
};

const FERIADO_SOBERANIA = Object.freeze({
  id: 1, fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional', tipo: 'nacional', trasladado_de: null,
  se_repite: 0, hasta_anio: null, activo: 1, no_rige: []
});

describe('los formatos', () => {
  it('numeroTexto y mesEnFrase son los de las reglas, no una copia', () => {
    assert.equal(numeroTexto, reglas.numeroTexto);
    assert.equal(mesEnFrase, reglas.mesEnFrase);
    assert.equal(numeroTexto(10.5), '10,5');
    assert.equal(numeroTexto(7), '7');
    assert.equal(mesEnFrase('2026-10'), 'octubre de 2026');
  });

  it('diaCorto: el día abreviado con mayúscula y la fecha entera', () => {
    assert.equal(diaCorto('2026-10-23'), 'Vie 23/10/2026');
    assert.equal(diaCorto('2026-10-14'), 'Mié 14/10/2026');
    assert.equal(diaCorto('2026-10-31'), 'Sáb 31/10/2026');
    assert.equal(diaCorto('2026-11-01'), 'Dom 01/11/2026');
    assert.equal(diaCorto('2026-10-26'), 'Lun 26/10/2026');
  });

  it('diaLargo: el día entero en minúscula y el día y el mes', () => {
    assert.equal(diaLargo('2026-10-30'), 'viernes 30/10');
    assert.equal(diaLargo('2026-10-28'), 'miércoles 28/10');
    assert.equal(diaLargo('2026-12-31'), 'jueves 31/12');
  });

  it('mesTitulo: el mes con mayúscula y el año', () => {
    assert.equal(mesTitulo('2026-10'), 'Octubre 2026');
    assert.equal(mesTitulo('2027-01'), 'Enero 2027');
  });

  it('lo que no es una fecha o un mes da la raya', () => {
    for (const raro of [undefined, null, '', 'x', '2026-13', '2026-02-30', 3, {}, []]) {
      assert.equal(diaCorto(raro), '—');
      assert.equal(diaLargo(raro), '—');
      assert.equal(mesTitulo(raro), '—');
    }
  });
});

describe('el Resumen de PLANTA', () => {
  it('arriba: la modalidad, el año, el día y quién mira', () => {
    const resumen = resumenDel(PLANTA);
    assert.deepEqual(Object.keys(resumen), [
      'modalidad', 'anio', 'al_texto', 'mensaje', 'abrir_saldos', 'persona', 'marca', 'vence_pronto', 'faltantes', 'tanques',
      'pastillas', 'extraordinaria', 'tipos', 'hoy_y_manana'
    ]);
    assert.deepEqual(resumen.modalidad, { clave: 'planta', texto: 'Planta permanente' });
    assert.equal(resumen.anio, 2026);
    assert.equal(resumen.al_texto, 'Al lunes 26/10/2026');
    assert.equal(resumen.mensaje, null);
    assert.equal(resumen.abrir_saldos, false);
    assert.deepEqual(resumen.persona, { nombre: 'Laura Gómez', ve_companeros: true, audita: true, es_superadmin: false });
    assert.deepEqual(resumen.faltantes, []);
  });

  it('Vence pronto: el franco de octubre y los días de la licencia 2024, por fecha', () => {
    const resumen = resumenDel(PLANTA);
    assert.equal(resumen.marca, true);
    assert.deepEqual(resumen.vence_pronto, [
      {
        fecha: '2026-10-30', dia: '30', mes: 'oct', cuando: 'Viernes 30/10', titulo: '1 franco compensatorio de octubre',
        detalle: 'Es el último día hábil del mes. Si no lo usás, queda como no utilizado previamente.',
        accion: { texto: 'Cargarlo', tipo: 'franco' }
      },
      {
        fecha: '2026-12-31', dia: '31', mes: 'dic', cuando: 'Jueves 31/12', titulo: '3 días de la licencia 2024',
        detalle: 'Ese día vence la licencia 2024.', accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' }
      }
    ]);
  });

  it('Vence pronto con dos francos sin usar: en plural', () => {
    // Sin el franco del 23/10, los dos de agosto quedan sin usar
    const estado = { ...PLANTA.estado, licencias: PLANTA.estado.licencias.filter((fila) => fila.tipo !== 'franco') };
    const [franco] = resumenDel(PLANTA, { estado }).vence_pronto;
    assert.equal(franco.titulo, '2 francos compensatorios de octubre');
    assert.equal(franco.detalle, 'Es el último día hábil del mes. Si no los usás, quedan como no utilizados previamente.');
    assert.deepEqual(franco.accion, { texto: 'Cargarlos', tipo: 'franco' });
  });

  it('el franco de octubre ya usado no está en Vence pronto', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'));
    const resumen = resumenDel(PLANTA, { estado });
    assert.deepEqual(resumen.vence_pronto.map((cosa) => cosa.titulo), ['3 días de la licencia 2024']);
  });

  it('los tanques: las vacaciones por capas, y los demás', () => {
    const { tanques } = resumenDel(PLANTA);
    assert.deepEqual(tanques.vacaciones, {
      numero: 33, unidad: 'días', pie: 'de 3 licencias', capacidad: 48,
      aria: 'Vacaciones: 33 días hábiles disponibles. Ver tus licencias',
      capas: [
        { clase: 'vence', n: 3, nombre: 'Licencia 2024', nota: 'Vence el 31/12/2026' },
        { clase: 'tinta', n: 20, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027' },
        { clase: 'medio', n: 10, nombre: 'Licencia 2026', nota: 'La primera mitad' },
        { clase: 'cargadas', n: 5, nombre: 'Cargados', nota: 'Cargados para noviembre' },
        { clase: 'por_habilitar', n: 10, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027' }
      ]
    });
    assert.deepEqual(tanques.otros, [
      {
        clave: 'franquicia', nombre: 'Franquicias', numero: '25', unidad: 'horas', de: 'de 42 horas', valor: 25, total: 42,
        vence: false, pestana: 'licencias', aria: 'Franquicias: quedan 25 de 42 horas. Ver tus licencias'
      },
      {
        clave: 'estudios', nombre: 'Estudios', numero: '9', unidad: 'días', de: 'de 15 días', valor: 9, total: 15,
        vence: false, pestana: 'licencias', aria: 'Estudios: quedan 9 de 15 días. Ver tus licencias'
      },
      {
        clave: 'medica', nombre: 'Atención médica', numero: '22', unidad: 'días', de: 'de 25 días', valor: 22, total: 25,
        vence: false, pestana: 'licencias', aria: 'Atención médica: quedan 22 de 25 días. Ver tus licencias'
      },
      {
        clave: 'familiar', nombre: 'Grupo familiar', numero: '23', unidad: 'días', de: 'de 25 días', valor: 23, total: 25,
        vence: false, pestana: 'licencias', aria: 'Grupo familiar: quedan 23 de 25 días. Ver tus licencias'
      }
    ]);
  });

  it('el tanque de vacaciones deja afuera la licencia del año que viene', () => {
    // La 2027 (de ordinariasDe) tiene sus 20 días por habilitar: no están ni en las capas ni en la capacidad
    const { vacaciones } = resumenDel(PLANTA).tanques;
    assert.equal(vacaciones.capacidad, vacaciones.capas.reduce((suma, capa) => suma + capa.n, 0));
    assert.ok(!vacaciones.capas.some((capa) => capa.nombre === 'Licencia 2027'));
  });

  it('cargados en dos meses, y por habilitar en dos fechas', () => {
    const conDiciembre = conLicencias(PLANTA.estado, licencia(100, 'vacaciones', '2026-12-14', '2026-12-15'));
    const capas = resumenDel(PLANTA, { estado: conDiciembre }).tanques.vacaciones.capas;
    assert.deepEqual(capas.find((capa) => capa.clase === 'cargadas'),
      { clase: 'cargadas', n: 7, nombre: 'Cargados', nota: 'Cargados para noviembre y diciembre' });
    // Los dos días de diciembre salen de la 2024, que vence este año
    assert.deepEqual(capas.find((capa) => capa.clase === 'vence'),
      { clase: 'vence', n: 1, nombre: 'Licencia 2024', nota: 'Vence el 31/12/2026' });

    // Con el arranque en marzo, la 2026 todavía no habilitó nada: sus dos mitades están por habilitar
    const marzo = { ...PLANTA.estado, arranque: '2026-03-02', licencias: [] };
    const resumen = resumenDe({
      persona: PLANTA.persona, estado: marzo, calculo: calculoDe(marzo, '2026-03-10'), hoy: '2026-03-10',
      feriados: SIN_FERIADOS, hoyYManana: HOY_Y_MANANA
    });
    assert.deepEqual(resumen.tanques.vacaciones.capas.at(-1),
      { clase: 'por_habilitar', n: 20, nombre: 'Todavía no', nota: 'Se habilitan el 1/7/2026 y el 1/1/2027' });
  });

  it('los meses de lo cargado: solo lo de después de hoy que sale de alguna licencia', () => {
    // Con el arranque el 01/09: unas ya tomadas en septiembre, unas de febrero a marzo de 2027 (42 días hábiles, y hay 40:
    // los dos últimos quedan sin cubrir) y unas en mayo de 2027, sin nada habilitado
    const estado = conLicencias({ ...PLANTA.estado, arranque: '2026-09-01' },
      licencia(100, 'vacaciones', '2026-09-28', '2026-09-29'),
      licencia(101, 'vacaciones', '2027-02-01', '2027-03-31'),
      licencia(102, 'vacaciones', '2027-05-03', '2027-05-04'));
    const cargadas = resumenDel(PLANTA, { estado }).tanques.vacaciones.capas.find((capa) => capa.clase === 'cargadas');
    assert.deepEqual(cargadas,
      { clase: 'cargadas', n: 45, nombre: 'Cargados', nota: 'Cargados para noviembre, febrero de 2027 y marzo de 2027' });
  });

  it('las pastillas: los francos de este mes a dos más, y lo no utilizado', () => {
    assert.deepEqual(resumenDel(PLANTA).pastillas, {
      titulo: 'Francos compensatorios',
      meses: [
        { numero: '1', mes: 'Octubre', nota: 'Hasta el viernes 30/10', estado: 'vence' },
        { numero: '1', mes: 'Noviembre', nota: 'Por las horas de septiembre', estado: 'disponible' },
        { numero: '1', mes: 'Diciembre', nota: 'Octubre sigue sumando', estado: 'pendiente' }
      ],
      previo: { numero: '1', titulo: 'Agosto', nota: 'No utilizado previamente' }
    });
  });

  it('una pastilla del mes con todo usado, y un mes sin francos que no va', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'));
    const [octubre] = resumenDel(PLANTA, { estado }).pastillas.meses;
    assert.deepEqual(octubre, { numero: '0', mes: 'Octubre', nota: 'Todos usados', estado: 'disponible' });
    // El 02/11: noviembre (por septiembre) y diciembre (por octubre). Enero de 2027 sería por noviembre, que todavía no
    // tiene horas: sin francos, no va
    const pastillas = resumenDel(PLANTA, { hoy: '2026-11-02' }).pastillas.meses;
    assert.deepEqual(pastillas.map(({ mes, estado }) => [mes, estado]),
      [['Noviembre', 'vence'], ['Diciembre', 'disponible']]);
    assert.equal(pastillas[1].nota, 'Por las horas de octubre');
  });

  it('la médica extraordinaria', () => {
    assert.equal(resumenDel(PLANTA).extraordinaria,
      'Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.');
    const tres = conLicencias(PLANTA.estado, licencia(100, 'medica_extraordinaria', '2026-11-10', '2026-11-12'));
    assert.equal(resumenDel(PLANTA, { estado: tres }).extraordinaria,
      'Atención médica extraordinaria: sin tope y aparte de los 25 días. Usaste 3 días en 2026.');
    const uno = conLicencias(PLANTA.estado, licencia(100, 'medica_extraordinaria', '2026-11-10'));
    assert.equal(resumenDel(PLANTA, { estado: uno }).extraordinaria,
      'Atención médica extraordinaria: sin tope y aparte de los 25 días. Usaste 1 día en 2026.');
  });

  it('los tipos de «Cargar licencia», con lo que queda, sin el uso autorizado', () => {
    assert.deepEqual(resumenDel(PLANTA).tipos, [
      { tipo: 'vacaciones', nombre: 'Vacaciones', queda_texto: '33 disponibles' },
      { tipo: 'franquicia', nombre: 'Franquicia', queda_texto: 'Quedan 25 h de 42' },
      { tipo: 'estudios', nombre: 'Estudios', queda_texto: 'Quedan 9 de 15' },
      { tipo: 'medica', nombre: 'Atención médica', queda_texto: 'Quedan 22 de 25' },
      { tipo: 'familiar', nombre: 'Grupo familiar', queda_texto: 'Quedan 23 de 25' },
      { tipo: 'medica_extraordinaria', nombre: 'Médica extraordinaria', queda_texto: 'Sin tope' },
      { tipo: 'franco', nombre: 'Franco compensatorio', queda_texto: '1 para octubre' }
    ]);
  });

  it('con «No estudio», ni el tanque ni la opción de estudios', () => {
    const estado = { ...PLANTA.estado, anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }] };
    const resumen = resumenDel(PLANTA, { estado });
    assert.deepEqual(resumen.tanques.otros.map((tanque) => tanque.clave), ['franquicia', 'medica', 'familiar']);
    assert.ok(!resumen.tipos.some((opcion) => opcion.tipo === 'estudios'));
  });

  it('el franco de la opción: el primer mes con francos para usar', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'));
    const franco = resumenDel(PLANTA, { estado }).tipos.find((opcion) => opcion.tipo === 'franco');
    assert.equal(franco.queda_texto, '1 para noviembre');
    const sinHoras = { ...PLANTA.estado, horasExtras: [] };
    assert.equal(resumenDel(PLANTA, { estado: sinHoras }).tipos.find((opcion) => opcion.tipo === 'franco').queda_texto,
      'Ninguno para usar');
  });

  it('los faltantes, con su texto neutro', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2027-02-01'));
    assert.deepEqual(resumenDel(PLANTA, { estado }).faltantes,
      ['Revisá tus francos de febrero de 2027: cargaste 1 y no corresponde ninguno.']);
  });

  it('«Hoy y mañana» es el que llega', () => {
    const hoyYManana = { ausentes: [{ nombre: 'Martín Ríos' }], proximo_feriado: { fecha: '2026-11-23' } };
    assert.deepEqual(resumenDel(PLANTA, { hoyYManana }).hoy_y_manana, hoyYManana);
    assert.deepEqual(resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado),
      hoy: HOY, feriados: SIN_FERIADOS }).hoy_y_manana, { ausentes: [], proximo_feriado: null });
  });
});

describe('el Resumen de CONTRATO', () => {
  it('los tanques: las vacaciones sin la 2024, y las horas a favor de este mes', () => {
    const resumen = resumenDel(CONTRATO);
    assert.deepEqual(resumen.modalidad, { clave: 'contrato', texto: 'Contrato' });
    assert.deepEqual(resumen.tanques.vacaciones, {
      numero: 13, unidad: 'días', pie: 'de 2 licencias', capacidad: 20,
      aria: 'Vacaciones: 13 días hábiles disponibles. Ver tus licencias',
      capas: [
        { clase: 'tinta', n: 5, nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027' },
        { clase: 'medio', n: 8, nombre: 'Licencia 2026', nota: 'La primera mitad' },
        { clase: 'por_habilitar', n: 7, nombre: 'Todavía no', nota: 'Se habilitan el 1/1/2027' }
      ]
    });
    const [horas, ...resto] = resumen.tanques.otros;
    assert.deepEqual(horas, {
      clave: 'horas_a_favor', nombre: 'Horas a favor', numero: '1,5', unidad: 'horas', de: 'de 10,5 en octubre',
      valor: 1.5, total: 10.5, vence: true, pestana: 'horas',
      aria: 'Horas a favor: quedan 1,5 de 10,5 horas en octubre. Ver tus horas extras'
    });
    assert.deepEqual(resto.map(({ clave, numero, de }) => [clave, numero, de]), [
      ['estudios', '7', 'de 10 días'], ['medica', '25', 'de 25 días'], ['familiar', '21', 'de 25 días']
    ]);
  });

  it('las pastillas: las horas a favor de este mes y del siguiente', () => {
    assert.deepEqual(resumenDel(CONTRATO).pastillas, {
      titulo: 'Horas a favor',
      meses: [
        { numero: '1,5', mes: 'Octubre', nota: 'De 10,5, hasta el viernes 30/10', estado: 'vence' },
        { numero: '4', mes: 'Noviembre', nota: 'Octubre sigue sumando', estado: 'pendiente' }
      ],
      previo: { numero: '6,5', titulo: 'Horas de 2026', nota: 'No utilizadas previamente' }
    });
  });

  it('Vence pronto: solo las horas a favor de octubre (de la 2024 no queda nada)', () => {
    const resumen = resumenDel(CONTRATO);
    assert.equal(resumen.marca, true);
    assert.deepEqual(resumen.vence_pronto, [{
      fecha: '2026-10-30', dia: '30', mes: 'oct', cuando: 'Viernes 30/10', titulo: '1,5 horas a favor de octubre',
      detalle: 'Es el último día hábil del mes. Lo que no uses pasa a horas no utilizadas previamente.',
      accion: { texto: 'Usarlas', tipo: 'horas_a_favor' }
    }]);
  });

  it('la lectora no ve a sus compañeros ni audita', () => {
    assert.deepEqual(resumenDel(CONTRATO).persona,
      { nombre: 'Sofía Paz', ve_companeros: false, audita: false, es_superadmin: false });
  });

  it('los tipos de contrato: horas a favor en lugar de franquicia y franco', () => {
    assert.deepEqual(resumenDel(CONTRATO).tipos.map(({ tipo, queda_texto }) => [tipo, queda_texto]), [
      ['vacaciones', '13 disponibles'], ['estudios', 'Quedan 7 de 10'], ['medica', 'Quedan 25 de 25'],
      ['familiar', 'Quedan 21 de 25'], ['medica_extraordinaria', 'Sin tope'], ['horas_a_favor', 'Quedan 1,5 h en octubre']
    ]);
  });

  it('sin horas a favor que queden: ni Vence pronto ni el ámbar', () => {
    const estado = conLicencias(CONTRATO.estado, licencia(100, 'horas_a_favor', '2026-10-28', '2026-10-28', 1.5));
    const resumen = resumenDel(CONTRATO, { estado });
    assert.deepEqual(resumen.vence_pronto, []);
    assert.equal(resumen.marca, false);
    assert.equal(resumen.tanques.otros[0].vence, false);
    assert.deepEqual(resumen.pastillas.meses[0], { numero: '0', mes: 'Octubre', nota: 'Todas usadas', estado: 'disponible' });
  });
});

describe('Vence pronto, desde el 1/10', () => {
  // Con el arranque el 01/09, la licencia 2024 ya tiene días disponibles en septiembre
  const estado = { ...PLANTA.estado, arranque: '2026-09-01' };

  it('el 30/09 no trae la licencia 2024; el 01/10, sí', () => {
    const titulos = (hoy) => resumenDel(PLANTA, { estado, hoy }).vence_pronto.map((cosa) => cosa.titulo);
    assert.ok(!titulos('2026-09-30').includes('3 días de la licencia 2024'));
    assert.deepEqual(titulos('2026-10-01'), ['1 franco compensatorio de octubre', '3 días de la licencia 2024']);
  });

  it('PLANTA tal cual, el 30/09, tampoco', () => {
    assert.ok(!resumenDel(PLANTA, { hoy: '2026-09-30' }).vence_pronto.some((cosa) => cosa.accion.tipo === 'vacaciones'));
  });

  it('sin días disponibles de la licencia que vence, no va', () => {
    const sinDias = { ...PLANTA.estado, saldos: PLANTA.estado.saldos.map((saldo) =>
      (saldo.concepto === 'vacaciones' && saldo.anio === 2024 ? { ...saldo, cantidad: 5 } : saldo)) };
    assert.ok(!resumenDel(PLANTA, { estado: sinDias }).vence_pronto.some((cosa) => cosa.accion.tipo === 'vacaciones'));
  });
});

describe('sin modalidad y sin arranque', () => {
  it('sin modalidad: el mensaje, sin tanques ni nada para cargar', () => {
    const estado = { ...PLANTA.estado, modalidad: null };
    const resumen = resumenDel(PLANTA, { estado, persona: { ...PLANTA.persona, vinculo: null } });
    assert.equal(resumen.modalidad, null);
    assert.equal(resumen.mensaje, MENSAJES_MI_ESPACIO.sinModalidad);
    assert.equal(resumen.abrir_saldos, false);
    assert.equal(resumen.tanques, null);
    assert.equal(resumen.pastillas, null);
    assert.deepEqual(resumen.vence_pronto, []);
    assert.deepEqual(resumen.tipos, []);
    assert.equal(resumen.marca, false);
    assert.equal(resumen.al_texto, 'Al lunes 26/10/2026');
  });

  it('con modalidad y sin arranque: abrir «Mis vacaciones y saldos»', () => {
    const estado = { ...PLANTA.estado, arranque: null };
    const resumen = resumenDel(PLANTA, { estado });
    assert.deepEqual(resumen.modalidad, { clave: 'planta', texto: 'Planta permanente' });
    assert.equal(resumen.abrir_saldos, true);
    assert.equal(resumen.mensaje, MENSAJES_MI_ESPACIO.sinArranque);
    assert.equal(resumen.tanques, null);
  });

  it('con arranque, no se abre', () => {
    assert.equal(resumenDel(CONTRATO).abrir_saldos, false);
  });
});

describe('la lista de licencias', () => {
  it('PLANTA en 2026: los años, los filtros y el orden', () => {
    const lista = filasDel(PLANTA);
    assert.deepEqual(Object.keys(lista), ['anio', 'anios', 'filtros', 'licencias', 'saldo_inicial']);
    assert.equal(lista.anio, 2026);
    assert.deepEqual(lista.anios, [2024, 2025, 2026, 2027]);
    assert.deepEqual(lista.filtros.map(({ tipo, cantidad }) => [tipo, cantidad]),
      [['todas', 6], ['vacaciones', 1], ['franquicia', 2], ['estudios', 1], ['medica', 1], ['franco', 1]]);
    assert.deepEqual(lista.filtros.map((filtro) => filtro.nombre),
      ['Todas', 'Vacaciones', 'Franquicias', 'Estudios', 'Atención médica', 'Francos']);
    assert.deepEqual(lista.licencias.map((fila) => fila.id), [6, 5, 4, 3, 2, 1]);
  });

  it('la primera fila, entera: las vacaciones de noviembre', () => {
    assert.deepEqual(filasDel(PLANTA).licencias[0], {
      id: 6, tipo: 'vacaciones', tipo_nombre: 'Vacaciones', desde: '2026-11-03', hasta: '2026-11-09', horas: null,
      fechas_texto: '03/11 al 09/11/2026', cantidad_texto: '7 días corridos, 5 hábiles', proxima: true,
      de_licencias_texto: 'De la licencia 2024.', antes_del_arranque: false, fuera_de_la_modalidad: false,
      no_cuenta_texto: '', nota: null, mostrar: true, mostrar_texto: 'Tus compañeros ven «Laura Gómez no está».',
      configuracion: null, puede_borrar: true, solo_hasta: false, fechas_fijas: false
    });
  });

  it('las fechas y las cantidades de cada fila', () => {
    assert.deepEqual(filasDel(PLANTA).licencias.map((fila) => [fila.fechas_texto, fila.cantidad_texto, fila.proxima]), [
      ['03/11 al 09/11/2026', '7 días corridos, 5 hábiles', true],
      ['Vie 23/10/2026', '1 día', false],
      ['Jue 15/10/2026', '2 horas', false],
      ['01/10 al 02/10/2026', '2 días hábiles', false],
      ['21/09 al 23/09/2026', '3 días hábiles', false],
      ['Lun 14/09/2026', '7 horas, el día entero', false]
    ]);
    const contrato = filasDel(CONTRATO).licencias;
    assert.deepEqual(contrato.map((fila) => [fila.fechas_texto, fila.cantidad_texto]), [
      ['Vie 30/10/2026', '1 día hábil'], ['Mar 20/10/2026', '2 horas'], ['13/10 al 15/10/2026', '3 días hábiles'],
      ['Vie 09/10/2026', '7 horas, el día entero']
    ]);
    assert.equal(contrato[0].tipo_nombre, 'Atención del grupo familiar');
  });

  it('lo anterior al saldo inicial queda como historia', () => {
    const filas = filasDel(PLANTA).licencias;
    const franquicia = filas.find((fila) => fila.id === 4);
    assert.equal(franquicia.antes_del_arranque, true);
    assert.equal(franquicia.no_cuenta_texto, 'Antes del saldo inicial: no descuenta');
    assert.deepEqual(filas.filter((fila) => fila.antes_del_arranque).map((fila) => fila.id), [4, 3, 2, 1]);
    // El franco no tiene saldo inicial: cuenta aunque sea anterior
    assert.equal(filas.find((fila) => fila.id === 5).antes_del_arranque, false);
  });

  it('una licencia que cruza el arranque cuenta', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'medica', '2026-10-19', '2026-10-27'));
    const cruza = filasDel(PLANTA, { estado }).licencias.find((fila) => fila.id === 100);
    assert.equal(cruza.antes_del_arranque, false);
    assert.equal(cruza.cantidad_texto, '9 días corridos, 7 hábiles');
  });

  it('con los feriados: una licencia posterior al arranque cuyo día pasó a ser feriado no es historia', () => {
    const feriados = new Set(['2026-11-10', '2026-11-17']);
    const estado = conLicencias(PLANTA.estado, licencia(100, 'medica', '2026-11-10'),
      licencia(101, 'familiar', '2026-11-16', '2026-11-18'));
    const filas = filasDeLicencias(estado, calcular(estado, { hoy: HOY, feriados }),
      { anio: 2026, hoy: HOY, persona: PLANTA.persona, feriados }).licencias;
    const feriado = filas.find((fila) => fila.id === 100);
    assert.deepEqual([feriado.antes_del_arranque, feriado.no_cuenta_texto, feriado.cantidad_texto],
      [false, '', '1 día corrido, 0 hábiles']);
    assert.equal(filas.find((fila) => fila.id === 101).cantidad_texto, '3 días corridos, 2 hábiles');
  });

  it('las vacaciones de dos licencias', () => {
    // Con la 2024 en 3, las del 03/11 al 09/11 toman 3 de la 2024 y 2 de la 2025
    const estado = { ...PLANTA.estado, saldos: PLANTA.estado.saldos.map((saldo) =>
      (saldo.concepto === 'vacaciones' && saldo.anio === 2024 ? { ...saldo, cantidad: 3 } : saldo)) };
    assert.equal(filasDel(PLANTA, { estado }).licencias[0].de_licencias_texto,
      'De las licencias 2024 (3 días) y 2025 (2 días).');
  });

  it('«Tus compañeros ven…»: solo administración, en las de día entero que no terminaron y con «Mostrar»', () => {
    const estado = conLicencias(PLANTA.estado,
      { ...licencia(100, 'medica', '2026-11-16', '2026-11-17'), mostrar: 0, nota: 'Control' },
      licencia(101, 'franquicia', '2026-11-18', '2026-11-18', 3),
      licencia(102, 'franquicia', '2026-11-19', '2026-11-19', 7));
    const filas = filasDel(PLANTA, { estado }).licencias;
    const de = (id) => filas.find((fila) => fila.id === id);
    assert.equal(de(100).mostrar, false);
    assert.equal(de(100).mostrar_texto, '');
    assert.equal(de(100).nota, 'Control');
    assert.equal(de(101).mostrar_texto, '');
    assert.equal(de(102).mostrar_texto, 'Tus compañeros ven «Laura Gómez no está».');
    // La del 23/10 ya pasó
    assert.equal(de(5).mostrar_texto, '');
    // La lectora no tiene la casilla
    assert.ok(filasDel(CONTRATO).licencias.every((fila) => fila.mostrar_texto === ''));
  });

  it('lo de Configuración sale de los vínculos', () => {
    const vinculos = new Map([[6, {
      configuracion: { texto: 'También en Configuración → Licencias.', insignia: 'Creada' },
      puede_borrar: false, solo_hasta: true, fechas_fijas: false
    }]]);
    const [primera, segunda] = filasDel(PLANTA, { vinculos }).licencias;
    assert.deepEqual(
      [primera.configuracion, primera.puede_borrar, primera.solo_hasta, primera.fechas_fijas],
      [{ texto: 'También en Configuración → Licencias.', insignia: 'Creada' }, false, true, false]);
    assert.deepEqual([segunda.configuracion, segunda.puede_borrar, segunda.solo_hasta, segunda.fechas_fijas],
      [null, true, false, false]);
  });

  it('el saldo inicial, en el año del arranque', () => {
    assert.deepEqual(filasDel(PLANTA).saldo_inicial, {
      fecha: '2026-10-26', titulo: 'Saldo inicial 2026', cargado_texto: 'Cargado el 26/10/2026',
      texto: 'Antes de empezar con Mi espacio: de vacaciones, quedaban 8 días de la licencia 2024, 20 de la 2025 y 10 de '
        + 'la 2026. En 2026 ya habías usado 17 horas de franquicia, 6 días de estudios, 3 de atención médica y 2 de atención '
        + 'del grupo familiar.'
    });
    assert.equal(filasDel(CONTRATO).saldo_inicial.texto,
      'Antes de empezar con Mi espacio: de vacaciones, quedaban 5 días de la licencia 2025 y 8 de la 2026. En 2026 ya '
      + 'habías usado 3 días de estudios y 3 de atención del grupo familiar. Tenías 6,5 horas no utilizadas previamente.');
    assert.equal(filasDel(PLANTA, { anio: 2025 }).saldo_inicial, null);
  });

  it('el saldo inicial sin nada usado y con un solo día', () => {
    const estado = {
      ...PLANTA.estado,
      saldos: [{ concepto: 'vacaciones', anio: 2025, cantidad: 1 }, { concepto: 'medica', anio: 2026, cantidad: 0 }]
    };
    assert.equal(filasDel(PLANTA, { estado }).saldo_inicial.texto,
      'Antes de empezar con Mi espacio: de vacaciones, quedaba 1 día de la licencia 2025.');
    assert.equal(filasDel(PLANTA, { estado: { ...PLANTA.estado, saldos: [] } }).saldo_inicial.texto,
      'Antes de empezar con Mi espacio: de vacaciones, no te quedaba ningún día.');
  });

  it('otro año: sus filas y sus filtros (una que cruza el 31/12 va en los dos)', () => {
    const estado = conLicencias(PLANTA.estado, licencia(100, 'vacaciones', '2026-12-28', '2027-01-05'));
    const de2027 = filasDel(PLANTA, { estado, anio: 2027 });
    assert.equal(de2027.anio, 2027);
    assert.deepEqual(de2027.filtros, [
      { tipo: 'todas', nombre: 'Todas', cantidad: 1 }, { tipo: 'vacaciones', nombre: 'Vacaciones', cantidad: 1 }
    ]);
    assert.equal(de2027.licencias[0].fechas_texto, '28/12/2026 al 05/01/2027');
    assert.ok(filasDel(PLANTA, { estado }).licencias.some((fila) => fila.id === 100));
    assert.deepEqual(filasDel(PLANTA, { anio: 2025 }).filtros, [{ tipo: 'todas', nombre: 'Todas', cantidad: 0 }]);
    // El año como texto (el de la dirección) y uno que no sirve, el de hoy
    assert.equal(filasDel(PLANTA, { anio: '2027' }).anio, 2027);
    assert.equal(filasDel(PLANTA, { anio: 'x' }).anio, 2026);
  });

  it('fuera de la modalidad (Review Focus 1): CONTRATO pasado a planta lista sus horas a favor en gris', () => {
    const estado = { ...CONTRATO.estado, modalidad: 'planta' };
    const filas = filasDel(CONTRATO, { estado }).licencias;
    const horas = filas.filter((fila) => fila.tipo === 'horas_a_favor');
    assert.equal(horas.length, 2);
    for (const fila of horas) {
      assert.equal(fila.fuera_de_la_modalidad, true);
      assert.equal(fila.no_cuenta_texto, 'No corresponde a tu modalidad actual: no cuenta.');
    }
    assert.deepEqual(horas.map((fila) => fila.cantidad_texto), ['2 horas', '7 horas, el día entero']);
    assert.ok(filas.filter((fila) => fila.tipo !== 'horas_a_favor').every((fila) => !fila.fuera_de_la_modalidad));
    // Y en el Resumen no cuentan: no hay horas a favor, y las horas extras son de planta (la modalidad nueva se aplica a
    // todo: las 10,5 de septiembre dan un franco para noviembre)
    const resumen = resumenDel(CONTRATO, { estado });
    assert.equal(resumen.tanques.otros[0].clave, 'franquicia');
    assert.equal(resumen.pastillas.titulo, 'Francos compensatorios');
    assert.deepEqual(resumen.pastillas.meses,
      [{ numero: '1', mes: 'Noviembre', nota: 'Por las horas de septiembre', estado: 'disponible' }]);
    assert.ok(!resumen.vence_pronto.some((cosa) => cosa.accion.tipo === 'horas_a_favor'));
    assert.deepEqual(resumen.modalidad, { clave: 'planta', texto: 'Planta' });
  });

  it('un uso autorizado de planta es un día; uno de contrato, horas', () => {
    const planta = conLicencias(PLANTA.estado, licencia(100, 'uso_autorizado', '2026-11-16', '2026-11-16', 7));
    assert.equal(filasDel(PLANTA, { estado: planta }).licencias.find((fila) => fila.id === 100).cantidad_texto, '1 día');
    const contrato = conLicencias(CONTRATO.estado, licencia(100, 'uso_autorizado', '2026-11-16', '2026-11-16', 2.5));
    assert.equal(filasDel(CONTRATO, { estado: contrato }).licencias.find((fila) => fila.id === 100).cantidad_texto,
      '2,5 horas');
    const lista = filasDel(PLANTA, { estado: planta });
    assert.deepEqual(lista.filtros.find((filtro) => filtro.tipo === 'uso_autorizado'),
      { tipo: 'uso_autorizado', nombre: 'Usos autorizados', cantidad: 1 });
  });
});

describe('la tabla de horas extras de planta', () => {
  it('los meses trabajados, del más nuevo al más viejo, con los textos de la maqueta', () => {
    const tabla = tablaDel(PLANTA);
    assert.equal(tabla.modalidad, 'planta');
    assert.equal(tabla.anio, 2026);
    assert.deepEqual(tabla.anios, [2024, 2025, 2026, 2027]);
    assert.equal(tabla.mes_en_curso, '2026-10');
    assert.deepEqual(tabla.meses, [
      {
        mes: '2026-10', mes_texto: 'Octubre 2026', horas_texto: '10,5 h', dias_texto: '3 días', francos: 1,
        uso_texto: 'Diciembre 2026', estado: 'sumando', situacion: 'El mes sigue sumando'
      },
      {
        mes: '2026-09', mes_texto: 'Septiembre 2026', horas_texto: '7,5 h', dias_texto: '2 días', francos: 1,
        uso_texto: 'Noviembre 2026', estado: 'proximo', situacion: 'Disponible desde el 02/11'
      },
      {
        mes: '2026-08', mes_texto: 'Agosto 2026', horas_texto: '14 h', dias_texto: '4 días', francos: 2,
        uso_texto: 'Octubre 2026', estado: 'en_uso', situacion: '1 usado el 23/10 · 1 para usar hasta el 30/10'
      },
      {
        mes: '2026-07', mes_texto: 'Julio 2026', horas_texto: '5 h', dias_texto: '2 días', francos: 0, uso_texto: '—',
        estado: 'sin_franco', situacion: 'No llega a 7 horas: no genera franco'
      },
      {
        mes: '2026-06', mes_texto: 'Junio 2026', horas_texto: '7 h', dias_texto: '2 días', francos: 1,
        uso_texto: 'Agosto 2026', estado: 'no_utilizado', situacion: 'No utilizado previamente'
      }
    ]);
    assert.deepEqual(tabla.uso_autorizado, {
      puede: true,
      texto: 'Tenés 1 franco no utilizado previamente en 2026. Si te autorizan a tomarlo, registrá un uso autorizado.'
    });
  });

  it('el mes día por día, del más nuevo al más viejo', () => {
    const tabla = tablaDel(PLANTA);
    assert.deepEqual(Object.keys(tabla.dias_por_mes), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06']);
    assert.deepEqual(tabla.dias_por_mes['2026-10'], [
      { id: 13, fecha: '2026-10-22', fecha_texto: 'Jue 22/10', horario: '19:00 a 22:00', horas_texto: '3 horas', nota: null },
      { id: 12, fecha: '2026-10-14', fecha_texto: 'Mié 14/10', horario: '17:00 a 21:00', horas_texto: '4 horas', nota: null },
      {
        id: 11, fecha: '2026-10-06', fecha_texto: 'Mar 06/10', horario: '18:00 a 21:30', horas_texto: '3,5 horas',
        nota: null
      }
    ]);
    assert.equal(tabla.totales_por_mes['2026-10'], '10,5 horas');
    assert.equal(tabla.totales_por_mes['2026-08'], '14 horas');
  });

  it('cuando termina el mes de uso, y todos usados', () => {
    const noviembre = tablaDel(PLANTA, { hoy: '2026-11-02' }).meses.find((mes) => mes.mes === '2026-08');
    assert.deepEqual([noviembre.estado, noviembre.situacion],
      ['no_utilizado', '1 usado el 23/10 · 1 no utilizado previamente']);
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2026-10-27'));
    const usados = tablaDel(PLANTA, { estado }).meses.find((mes) => mes.mes === '2026-08');
    assert.deepEqual([usados.estado, usados.situacion], ['usados', 'Todos usados']);
    assert.equal(tablaDel(PLANTA, { estado, hoy: '2026-11-02' }).meses.find((mes) => mes.mes === '2026-08').situacion,
      'Todos usados');
    // Con dos sin usar y ninguno cargado
    const sinFranco = { ...PLANTA.estado, licencias: [] };
    assert.equal(tablaDel(PLANTA, { estado: sinFranco, hoy: '2026-11-02' }).meses
      .find((mes) => mes.mes === '2026-08').situacion, 'No utilizados previamente');
    // Sin nada no utilizado en el año, no hay uso autorizado
    const sinJunio = { ...PLANTA.estado, horasExtras: PLANTA.estado.horasExtras.filter((fila) => fila.id > 2) };
    assert.deepEqual(tablaDel(PLANTA, { estado: sinJunio }).uso_autorizado,
      { puede: false, texto: 'En 2026 no tenés francos no utilizados previamente.' });
  });

  it('un mes trabajado sin horas (solo un uso de más) no va en la tabla', () => {
    // Un franco en enero de 2027 corresponde a noviembre de 2026, que no tiene horas: es un faltante, no una fila
    const estado = conLicencias(PLANTA.estado, licencia(100, 'franco', '2027-01-05'));
    const tabla = tablaDel(PLANTA, { estado });
    assert.ok(!tabla.meses.some((mes) => mes.mes === '2026-11'));
    assert.ok(calculoDe(estado).francos.some((mes) => mes.mes_trabajado === '2026-11' && mes.horas === 0));
  });

  it('otro año: sus meses, y sin mes en curso', () => {
    const tabla = tablaDel(PLANTA, { anio: 2025 });
    assert.deepEqual(tabla.meses, []);
    assert.deepEqual(tabla.dias_por_mes, {});
    assert.equal(tabla.mes_en_curso, null);
  });

  it('las notas de las horas extras', () => {
    const estado = { ...PLANTA.estado, horasExtras: [{ id: 1, fecha: '2026-10-06', desde: '18:00', hasta: '21:30',
      nota: 'Cierre del informe' }] };
    assert.equal(tablaDel(PLANTA, { estado }).dias_por_mes['2026-10'][0].nota, 'Cierre del informe');
  });
});

describe('la tabla de horas extras de contrato', () => {
  it('los meses, con las horas a favor y las usadas', () => {
    const tabla = tablaDel(CONTRATO);
    assert.equal(tabla.modalidad, 'contrato');
    assert.deepEqual(tabla.meses, [
      {
        mes: '2026-10', mes_texto: 'Octubre 2026', horas_texto: '4 h', a_favor_texto: 'Noviembre 2026', usadas_texto: '—',
        usadas_detalle: '', estado: 'sumando', situacion: 'El mes sigue sumando'
      },
      {
        mes: '2026-09', mes_texto: 'Septiembre 2026', horas_texto: '10,5 h', a_favor_texto: 'Octubre 2026',
        usadas_texto: '9 h', usadas_detalle: '09/10: 7 h · 20/10: 2 h', estado: 'en_uso',
        situacion: '1,5 h para usar hasta el 30/10'
      }
    ]);
    assert.ok(!('uso_autorizado' in tabla));
  });

  it('las horas no utilizadas previamente', () => {
    assert.deepEqual(tablaDel(CONTRATO).no_utilizadas, {
      total_texto: '6,5 horas en 2026',
      filas: [{ titulo: 'Del saldo inicial', texto: '6,5 horas', detalle: '' }],
      uso_autorizado: {
        puede: true, texto: 'Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas.'
      }
    });
  });

  it('cuando termina el mes de uso, lo que quedó pasa a no utilizadas', () => {
    const tabla = tablaDel(CONTRATO, { hoy: '2026-11-02' });
    const septiembre = tabla.meses.find((mes) => mes.mes === '2026-09');
    assert.deepEqual([septiembre.estado, septiembre.situacion], ['no_utilizadas', '1,5 h no utilizadas previamente']);
    assert.deepEqual(tabla.no_utilizadas.filas, [
      { titulo: 'Octubre 2026', texto: '1,5 horas', detalle: 'de las extras de septiembre' },
      { titulo: 'Del saldo inicial', texto: '6,5 horas', detalle: '' }
    ]);
    assert.equal(tabla.no_utilizadas.total_texto, '8 horas en 2026');
  });

  it('todas usadas, y lo de antes del arranque', () => {
    const usadas = conLicencias(CONTRATO.estado, licencia(100, 'horas_a_favor', '2026-10-28', '2026-10-28', 1.5));
    const septiembre = tablaDel(CONTRATO, { estado: usadas }).meses.find((mes) => mes.mes === '2026-09');
    assert.deepEqual([septiembre.estado, septiembre.situacion], ['usadas', 'Todas usadas']);
    // 3 horas en agosto, para usar en septiembre, antes del arranque del 26/10: lo que quedó ya está en el saldo
    const agosto = { ...CONTRATO.estado, horasExtras: [...CONTRATO.estado.horasExtras,
      { id: 10, fecha: '2026-08-05', desde: '18:00', hasta: '21:00' }] };
    const tabla = tablaDel(CONTRATO, { estado: agosto });
    const fila = tabla.meses.find((mes) => mes.mes === '2026-08');
    assert.deepEqual([fila.estado, fila.situacion], ['antes_del_arranque', 'Antes del saldo inicial: está en el saldo']);
    assert.deepEqual(tabla.no_utilizadas.filas, [{ titulo: 'Del saldo inicial', texto: '6,5 horas', detalle: '' }]);
  });

  it('sin nada no utilizado', () => {
    const estado = { ...CONTRATO.estado, saldos: CONTRATO.estado.saldos.filter((s) => s.concepto !== 'horas_no_utilizadas') };
    assert.deepEqual(tablaDel(CONTRATO, { estado }).no_utilizadas, {
      total_texto: '0 horas en 2026', filas: [],
      uso_autorizado: { puede: false, texto: 'En 2026 no te quedan horas no utilizadas previamente.' }
    });
  });

  it('sin modalidad, la tabla vacía', () => {
    const tabla = tablaDel(CONTRATO, { estado: { ...CONTRATO.estado, modalidad: null } });
    assert.equal(tabla.modalidad, null);
    assert.deepEqual(tabla.meses, []);
    assert.deepEqual(tabla.dias_por_mes, {});
  });
});

describe('el próximo feriado', () => {
  it('el próximo que rige y cae de lunes a viernes', () => {
    assert.deepEqual(proximoFeriadoDe([FERIADO_SOBERANIA], HOY),
      { fecha: '2026-11-23', cuando: 'Lunes 23/11', nombre: 'Día de la Soberanía Nacional' });
  });

  it('uno que cae domingo se saltea', () => {
    const domingo = { ...FERIADO_SOBERANIA, id: 2, fecha: '2026-11-01', nombre: 'Uno en domingo' };
    assert.equal(proximoFeriadoDe([domingo, FERIADO_SOBERANIA], HOY).fecha, '2026-11-23');
  });

  it('sin feriados en la tabla, el próximo fijo; y del año siguiente', () => {
    assert.deepEqual(proximoFeriadoDe([], HOY),
      { fecha: '2026-12-08', cuando: 'Martes 08/12', nombre: NOMBRES_DE_LOS_FIJOS['12-08'] });
    assert.deepEqual(proximoFeriadoDe([], '2026-12-26'),
      { fecha: '2027-01-01', cuando: 'Viernes 01/01', nombre: NOMBRES_DE_LOS_FIJOS['01-01'] });
  });

  it('uno que ese año no rige no cuenta, y hoy no es «el próximo»', () => {
    const noRige = { ...FERIADO_SOBERANIA, se_repite: 1, no_rige: [2026] };
    assert.equal(proximoFeriadoDe([noRige], HOY).fecha, '2026-12-08');
    assert.equal(proximoFeriadoDe([FERIADO_SOBERANIA], '2026-11-23').fecha, '2026-12-08');
  });

  it('sin un hoy válido, null', () => {
    for (const raro of [undefined, null, '', 'x', 3]) assert.equal(proximoFeriadoDe([FERIADO_SOBERANIA], raro), null);
  });
});

describe('todo número es un número y todo texto, un texto', () => {
  it('en el Resumen, la lista y las tablas de los dos casos', () => {
    for (const caso of [PLANTA, CONTRATO]) {
      sinHuecos(resumenDel(caso));
      sinHuecos(filasDel(caso));
      sinHuecos(tablaDel(caso));
      sinHuecos(tablaDel(caso, { hoy: '2026-12-15' }));
      sinHuecos(resumenDel(caso, { hoy: '2026-12-15' }));
    }
  });
});

describe('nada tira', () => {
  const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z'), Symbol('x'),
    Object.create(null)];

  it('con entradas raras', () => {
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        diaCorto(valor);
        diaLargo(valor);
        mesEnFrase(valor);
        mesTitulo(valor);
        resumenDe(valor);
        resumenDe({ persona: valor, estado: valor, calculo: valor, hoy: valor, feriados: valor, hoyYManana: valor });
        resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: valor, hoy: HOY, feriados: valor });
        resumenDe({ persona: valor, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado), hoy: HOY });
        filasDeLicencias(valor, valor, valor);
        filasDeLicencias(PLANTA.estado, valor, { anio: valor, hoy: HOY, persona: valor, vinculos: valor, feriados: valor });
        filasDeLicencias({ ...PLANTA.estado, licencias: [valor, { id: valor, tipo: 'vacaciones', desde: valor }],
          saldos: [valor] }, calculoDe(PLANTA.estado), { hoy: HOY });
        tablaDeHorasExtras(valor, valor, valor);
        tablaDeHorasExtras(PLANTA.estado, valor, { anio: valor, hoy: HOY, feriados: valor });
        tablaDeHorasExtras({ ...CONTRATO.estado, horasExtras: [valor, { id: valor, fecha: '2026-10-01', desde: valor }] },
          calculoDe(CONTRATO.estado), { hoy: HOY });
        proximoFeriadoDe(valor, valor);
        proximoFeriadoDe([valor, { fecha: valor, activo: 1 }], HOY);
      });
    }
  });

  it('un cálculo con partes que no son lo que deberían', () => {
    const roto = {
      reparto: {
        ordinarias: [null, { anio: 'x' }, { anio: 2024, disponibles: 'x', mitades: 3 }], porFila: [], sinCubrir: {}
      },
      topes: [null, 3], francos: [null, { mes_de_uso: 3, usos: 'x' }], horasAFavor: 'x',
      noUtilizadas: { 2026: { meses: [null], saldo: 4, quedan: 'x' } }, faltantes: [null, { texto: 3 }, { texto: 'Uno' }]
    };
    for (const caso of [PLANTA, CONTRATO]) {
      const resumen = resumenDe({
        persona: caso.persona, estado: caso.estado, calculo: roto, hoy: HOY, feriados: SIN_FERIADOS
      });
      sinHuecos(resumen);
      assert.deepEqual(resumen.faltantes, ['Uno']);
      sinHuecos(filasDeLicencias(caso.estado, roto, { anio: 2026, hoy: HOY, persona: caso.persona, feriados: SIN_FERIADOS }));
      sinHuecos(tablaDeHorasExtras(caso.estado, roto, { anio: 2026, hoy: HOY, feriados: SIN_FERIADOS }));
    }
  });

  it('sin un hoy válido, un Resumen sin nada que calcular', () => {
    const resumen = resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado) });
    assert.equal(resumen.anio, null);
    assert.equal(resumen.al_texto, '');
    assert.equal(resumen.tanques, null);
    sinHuecos(resumen);
  });
});
