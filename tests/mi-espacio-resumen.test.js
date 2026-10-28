// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 3.9, 7 y 8): el panel como datos. El Resumen
// «Titular» (spec 2026-10-27-mi-espacio-resumen, sección 4: la frase de la banda, Vence pronto en una línea, los tanques, las
// pastillas y las opciones de «Cargar licencia»), la lista de licencias de un año, las tablas de horas extras y el próximo
// feriado, con todos sus números y sus textos: la página los imprime tal cual (Ruling 19). Puras, sin base, sobre los casos
// de tests/fixtures/mi-espacio-casos.js y sin feriados de la tabla.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroTexto, diaCorto, diaLargo, mesEnFrase, mesTitulo, resumenDe, filasDeLicencias, tablaDeHorasExtras, proximoFeriadoDe,
  planillaDelMes, paraRevisarDe, otrosAniosDe, textoDeLaListaDe
} from '../services/miEspacioResumen.js';
import * as reglas from '../services/miEspacioReglas.js';
import { NOMBRES_DE_LOS_FIJOS, feriadosDelRango } from '../services/feriadosReglas.js';
import { HOY, SIN_FERIADOS, PLANTA, CONTRATO } from './fixtures/mi-espacio-casos.js';

const { calcular, MENSAJES_MI_ESPACIO, horasPorMesDeSalidas, NOMBRES_TIPO } = reglas;

const HOY_Y_MANANA = Object.freeze({ ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null });

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

// Las horas extras que tenía CONTRATO antes de la planilla (los mismos días y totales que sus salidas: 10,5 en septiembre y 4
// en octubre). Desde la planilla, CONTRATO tiene solo sus salidas: estas sirven para la persona de contrato que pasó a planta
const HORAS_EXTRAS_DE_CONTRATO = Object.freeze([
  { id: 1, fecha: '2026-09-10', desde: '18:00', hasta: '22:00' }, { id: 2, fecha: '2026-09-17', desde: '18:00', hasta: '22:00' },
  { id: 3, fecha: '2026-09-24', desde: '18:00', hasta: '20:30' }, { id: 4, fecha: '2026-10-21', desde: '18:00', hasta: '22:00' }
]);

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

// La planilla de contrato (spec 2026-10-27-mi-espacio-horas, secciones 3, 4, 5 y 8). Hoy es el martes 27/10/2026, como en la
// maqueta. El lunes 12/10 es feriado (de la tabla) y el sábado 17/10, uno inventado para los tests: un sábado que además es
// feriado (Review Focus 2). Los feriados, con los 9 fijos, del rango entero de la planilla
const HOY_PLANILLA = '2026-10-27';
const FERIADO_DIVERSIDAD = Object.freeze({
  ...FERIADO_SOBERANIA, id: 2, fecha: '2026-10-12', nombre: 'Día del Respeto a la Diversidad Cultural'
});
const FERIADO_EN_SABADO = Object.freeze({
  ...FERIADO_SOBERANIA, id: 3, fecha: '2026-10-17', nombre: 'Feriado de prueba en sábado', tipo: 'municipal'
});
const FILAS_PLANILLA = Object.freeze([FERIADO_DIVERSIDAD, FERIADO_EN_SABADO]);
const feriadosDe = (filas) => feriadosDelRango(filas, '2024-01-01', '2027-12-31');
const FERIADOS_PLANILLA = feriadosDe(FILAS_PLANILLA);

// Una salida de la planilla (las de CONTRATO tienen ids del 1 al 4: las de los tests, desde el 10)
const salidaDe = (id, fecha, salida, entrada = null, nota = null) => ({ id, fecha, entrada, salida, nota });
// Las de octubre de la maqueta, con las de CONTRATO (el 21/10, salida a las 19:00: 4 h). Octubre suma 16 horas
const SALIDAS_DE_OCTUBRE = Object.freeze([
  salidaDe(10, '2026-10-05', '16:20', '08:02'), // 1,5 h: la entrada no cuenta
  salidaDe(11, '2026-10-09', '17:16'), // 2,5 h, en un día de licencia de día entero: sigue sumando, con su aviso
  salidaDe(12, '2026-10-12', '12:10', '09:21', 'Guardia de la mesa de datos'), // feriado, de la entrada a la salida: 2,5 h
  salidaDe(13, '2026-10-16', '15:05', '07:58'), // 0: no llega a media hora
  salidaDe(14, '2026-10-20', '13:02'), // 0, un día con 2 h a favor
  salidaDe(15, '2026-10-24', '13:20', '09:00', 'Relevamiento en el barrio'), // sábado, de la entrada a la salida: 4,5 h
  salidaDe(16, '2026-10-26', '15:47') // 1 h
]);
const ESTADO_PLANILLA = Object.freeze({ ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, ...SALIDAS_DE_OCTUBRE] });

const planillaDel = (estado = ESTADO_PLANILLA,
  { mes = '2026-10', hoy = HOY_PLANILLA, feriados = FERIADOS_PLANILLA, filas = FILAS_PLANILLA } = {}) =>
  planillaDelMes(estado, calcular(estado, { hoy, feriados }), { mes, hoy, feriados, filasFeriados: filas });
// Un día de la planilla, de los días o de los sábados y domingos para sumar
const diaDe = (planilla, fecha) => [...planilla.dias, ...planilla.fines_de_semana].find((dia) => dia.fecha === fecha);
// La tabla de horas extras con feriados
const tablaConFeriados = (estado, { hoy = HOY_PLANILLA, feriados = FERIADOS_PLANILLA } = {}) =>
  tablaDeHorasExtras(estado, calcular(estado, { hoy, feriados }), { anio: 2026, hoy, feriados });

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
      'modalidad', 'anio', 'al_texto', 'mensaje', 'abrir_saldos', 'persona', 'marca', 'vence_pronto', 'faltantes',
      'para_revisar', 'tanques', 'titular', 'pastillas', 'extraordinaria', 'tipos', 'hoy_y_manana'
    ]);
    assert.deepEqual(resumen.modalidad, { clave: 'planta', texto: 'Planta permanente' });
    assert.equal(resumen.anio, 2026);
    assert.equal(resumen.al_texto, 'Al lunes 26/10/2026');
    assert.equal(resumen.mensaje, null);
    assert.equal(resumen.abrir_saldos, false);
    assert.deepEqual(resumen.persona, { nombre: 'Laura Gómez', ve_companeros: true, audita: true, es_superadmin: false });
    assert.deepEqual(resumen.faltantes, []);
  });

  it('Vence pronto: el franco de octubre y los días de la licencia 2024, por fecha, cada uno con su línea', () => {
    const resumen = resumenDel(PLANTA);
    assert.equal(resumen.marca, true);
    assert.deepEqual(resumen.vence_pronto, [
      {
        fecha: '2026-10-30', dia: '30', mes: 'oct', titulo: '1 franco compensatorio de octubre',
        texto: 'Vence el viernes 30/10, en 4 días.', accion: { texto: 'Cargarlo', tipo: 'franco' }
      },
      {
        fecha: '2026-12-31', dia: '31', mes: 'dic', titulo: '3 días de la licencia 2024',
        texto: 'Vencen el jueves 31/12, en 66 días.', accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' }
      }
    ]);
    for (const cosa of resumen.vence_pronto) {
      assert.deepEqual(Object.keys(cosa), ['fecha', 'dia', 'mes', 'titulo', 'texto', 'accion']);
    }
  });

  it('Vence pronto con dos francos sin usar: en plural', () => {
    // Sin el franco del 23/10, los dos de agosto quedan sin usar
    const estado = { ...PLANTA.estado, licencias: PLANTA.estado.licencias.filter((fila) => fila.tipo !== 'franco') };
    const [franco] = resumenDel(PLANTA, { estado }).vence_pronto;
    assert.equal(franco.titulo, '2 francos compensatorios de octubre');
    assert.equal(franco.texto, 'Vencen el viernes 30/10, en 4 días.');
    assert.deepEqual(franco.accion, { texto: 'Cargarlos', tipo: 'franco' });
  });

  it('Vence pronto según los días corridos que faltan: mañana, hoy y ya pasó, en singular o en plural', () => {
    const textos = (hoy, estado = PLANTA.estado) =>
      resumenDel(PLANTA, { estado, hoy }).vence_pronto.map(({ titulo, texto }) => [titulo, texto]);
    assert.deepEqual(textos('2026-10-29'), [
      ['1 franco compensatorio de octubre', 'Vence mañana.'],
      ['3 días de la licencia 2024', 'Vencen el jueves 31/12, en 63 días.']
    ]);
    assert.deepEqual(textos('2026-10-30')[0], ['1 franco compensatorio de octubre', 'Vence hoy.']);
    // El sábado 31/10 el franco ya venció el viernes, pero sigue en la lista hasta que termina el mes
    assert.deepEqual(textos('2026-10-31')[0], ['1 franco compensatorio de octubre', 'Venció el viernes 30/10.']);
    const dosFrancos = { ...PLANTA.estado, licencias: PLANTA.estado.licencias.filter((fila) => fila.tipo !== 'franco') };
    assert.deepEqual(textos('2026-10-31', dosFrancos)[0], ['2 francos compensatorios de octubre', 'Vencieron el viernes 30/10.']);
    // El franco de diciembre y los días de la licencia 2024 vencen el mismo jueves 31/12
    assert.deepEqual(textos('2026-12-30'), [
      ['1 franco compensatorio de diciembre', 'Vence mañana.'], ['3 días de la licencia 2024', 'Vencen mañana.']
    ]);
    assert.deepEqual(textos('2026-12-31'), [
      ['1 franco compensatorio de diciembre', 'Vence hoy.'], ['3 días de la licencia 2024', 'Vencen hoy.']
    ]);
  });

  it('Vence pronto con 1 día de la licencia que vence: en singular', () => {
    const estado = { ...PLANTA.estado, saldos: PLANTA.estado.saldos.map((saldo) =>
      (saldo.concepto === 'vacaciones' && saldo.anio === 2024 ? { ...saldo, cantidad: 6 } : saldo)) };
    const licencia2024 = resumenDel(PLANTA, { estado }).vence_pronto.find((cosa) => cosa.accion.tipo === 'vacaciones');
    assert.deepEqual([licencia2024.titulo, licencia2024.texto],
      ['1 día de la licencia 2024', 'Vence el jueves 31/12, en 66 días.']);
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

  it('la médica extraordinaria, en una línea corta', () => {
    assert.equal(resumenDel(PLANTA).extraordinaria, 'Atención médica extraordinaria: sin tope. No usaste en 2026.');
    const tres = conLicencias(PLANTA.estado, licencia(100, 'medica_extraordinaria', '2026-11-10', '2026-11-12'));
    assert.equal(resumenDel(PLANTA, { estado: tres }).extraordinaria,
      'Atención médica extraordinaria: sin tope. Usaste 3 días en 2026.');
    const uno = conLicencias(PLANTA.estado, licencia(100, 'medica_extraordinaria', '2026-11-10'));
    assert.equal(resumenDel(PLANTA, { estado: uno }).extraordinaria,
      'Atención médica extraordinaria: sin tope. Usaste 1 día en 2026.');
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
    const hoyYManana = {
      ausentes_hoy: [{ nombre: 'Martín Ríos' }], ausentes_manana: [{ nombre: 'Diego Fernández' }],
      proximo_feriado: { fecha: '2026-11-23' }
    };
    assert.deepEqual(resumenDel(PLANTA, { hoyYManana }).hoy_y_manana, hoyYManana);
    assert.deepEqual(resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado),
      hoy: HOY, feriados: SIN_FERIADOS }).hoy_y_manana, { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null });
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
      fecha: '2026-10-30', dia: '30', mes: 'oct', titulo: '1,5 horas a favor de octubre',
      texto: 'Vencen el viernes 30/10, en 4 días.', accion: { texto: 'Usarlas', tipo: 'horas_a_favor' }
    }]);
  });

  it('Vence pronto con 1 hora a favor: en singular', () => {
    const estado = conLicencias(CONTRATO.estado, licencia(100, 'horas_a_favor', '2026-10-28', '2026-10-28', 0.5));
    assert.deepEqual(resumenDel(CONTRATO, { estado }).vence_pronto.map(({ titulo, texto, accion }) => [titulo, texto, accion]), [
      ['1 hora a favor de octubre', 'Vence el viernes 30/10, en 4 días.', { texto: 'Usarla', tipo: 'horas_a_favor' }]
    ]);
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

  it('los avisos de las salidas, al final de los faltantes (spec 2026-10-27-mi-espacio-horas, sección 7)', () => {
    // Una salida del 21/10 con vacaciones cargadas después, y una de más de horas a favor en enero de 2027
    const estado = conLicencias(CONTRATO.estado, licencia(100, 'vacaciones', '2026-10-21'),
      licencia(101, 'horas_a_favor', '2027-01-04', '2027-01-04', 1));
    assert.deepEqual(resumenDel(CONTRATO, { estado }).faltantes, [
      'Revisá tus horas a favor de enero de 2027: cargaste 1 hora y no corresponde ninguna.',
      'Revisá tus horas extras del miércoles 21/10: ese día tenés una licencia de día entero.'
    ]);
    // Sin avisos (un cálculo de antes, sin la clave), solo los faltantes
    const calculo = calculoDe(estado);
    const { avisosDeSalidas: _sinAvisos, ...sinLaClave } = calculo;
    assert.deepEqual(resumenDe({ persona: CONTRATO.persona, estado, calculo: sinLaClave, hoy: HOY, feriados: SIN_FERIADOS })
      .faltantes, ['Revisá tus horas a favor de enero de 2027: cargaste 1 hora y no corresponde ninguna.']);
    // Lo que no es un aviso con su texto no va
    const raros = { ...calculo, avisosDeSalidas: [null, 3, { texto: 5 }, ...calculo.avisosDeSalidas] };
    assert.deepEqual(resumenDe({ persona: CONTRATO.persona, estado, calculo: raros, hoy: HOY, feriados: SIN_FERIADOS })
      .faltantes, resumenDel(CONTRATO, { estado }).faltantes);
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

describe('la banda «Titular»', () => {
  const saldosDeVacaciones = (dias) => PLANTA.estado.saldos.map((saldo) =>
    (saldo.concepto === 'vacaciones' && Object.hasOwn(dias, saldo.anio) ? { ...saldo, cantidad: dias[saldo.anio] } : saldo));
  const sinVacaciones = PLANTA.estado.licencias.filter((fila) => fila.tipo !== 'vacaciones');
  // Un cálculo de PLANTA con las ordinarias cambiadas (para las cantidades que el reparto no da con licencias de 10 a 30 días)
  const conOrdinarias = (cambio) => {
    const calculo = calculoDe(PLANTA.estado);
    return { ...calculo, reparto: { ...calculo.reparto, ordinarias: calculo.reparto.ordinarias.map(cambio) } };
  };
  const titularCon = (calculo) => resumenDe({
    persona: PLANTA.persona, estado: PLANTA.estado, calculo, hoy: HOY, feriados: SIN_FERIADOS, hoyYManana: HOY_Y_MANANA
  }).titular;

  it('PLANTA: el día y la modalidad, la frase partida alrededor del número y la bajada, con lo que vence primero', () => {
    assert.deepEqual(resumenDel(PLANTA).titular, {
      encabezado: 'Lunes 26 de octubre, planta permanente', antes: 'Te quedan', cifra: '33', despues: 'días de vacaciones',
      bajada: [
        { texto: '3 vencen el jueves 31/12.', vence: true },
        { texto: '5 ya están cargados para noviembre.', vence: false, anio: 2026 },
        { texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false }
      ]
    });
  });

  it('CONTRATO: sin licencia que venza ni nada cargado, solo lo que se habilita', () => {
    assert.deepEqual(resumenDel(CONTRATO).titular, {
      encabezado: 'Lunes 26 de octubre, contrato', antes: 'Te quedan', cifra: '13', despues: 'días de vacaciones',
      bajada: [{ texto: 'Otros 7 se habilitan el 1/1/2027.', vence: false }]
    });
  });

  it('el encabezado: el día de la semana con mayúscula, el día sin cero, el mes y la modalidad en minúscula', () => {
    const politica = resumenDel(PLANTA, { persona: { ...PLANTA.persona, vinculo: 'planta_politica' } });
    assert.equal(politica.titular.encabezado, 'Lunes 26 de octubre, planta política');
    assert.equal(resumenDel(PLANTA, { hoy: '2026-11-03' }).titular.encabezado, 'Martes 3 de noviembre, planta permanente');
  });

  it('con 1 día disponible: «Te queda», en singular', () => {
    const estado = { ...PLANTA.estado, saldos: saldosDeVacaciones({ 2024: 1, 2025: 0, 2026: 0 }), licencias: sinVacaciones };
    assert.deepEqual(resumenDel(PLANTA, { estado }).titular, {
      encabezado: 'Lunes 26 de octubre, planta permanente', antes: 'Te queda', cifra: '1', despues: 'día de vacaciones',
      bajada: [
        { texto: '1 vence el jueves 31/12.', vence: true }, { texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false }
      ]
    });
  });

  it('con 0: «No te quedan días de vacaciones», sin número, y lo que se habilita sin «Otros»', () => {
    // Con el arranque el 01/09, unas vacaciones ya tomadas del 02/09 al 23/10 consumen todo lo habilitado (38 días hábiles)
    const estado = { ...PLANTA.estado, arranque: '2026-09-01', licencias: [...sinVacaciones,
      licencia(100, 'vacaciones', '2026-09-02', '2026-10-23')] };
    const resumen = resumenDel(PLANTA, { estado });
    assert.equal(resumen.tanques.vacaciones.numero, 0);
    assert.deepEqual(resumen.faltantes, []);
    assert.deepEqual(resumen.titular, {
      encabezado: 'Lunes 26 de octubre, planta permanente', antes: 'No te quedan días de vacaciones', cifra: '', despues: '',
      bajada: [{ texto: '10 se habilitan el 1/1/2027.', vence: false }]
    });
  });

  it('1 que vence y 1 cargado: en singular', () => {
    const estado = { ...PLANTA.estado, saldos: saldosDeVacaciones({ 2024: 2 }),
      licencias: [...sinVacaciones, licencia(6, 'vacaciones', '2026-11-03')] };
    assert.deepEqual(resumenDel(PLANTA, { estado }).titular.bajada, [
      { texto: '1 vence el jueves 31/12.', vence: true },
      { texto: '1 ya está cargado para noviembre.', vence: false, anio: 2026 },
      { texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false }
    ]);
  });

  it('los meses y las fechas de la bajada son los de las notas de las capas', () => {
    const conDiciembre = conLicencias(PLANTA.estado, licencia(100, 'vacaciones', '2026-12-14', '2026-12-15'));
    const { tanques, titular } = resumenDel(PLANTA, { estado: conDiciembre });
    assert.equal(tanques.vacaciones.capas.find((capa) => capa.clase === 'cargadas').nota, 'Cargados para noviembre y diciembre');
    assert.deepEqual(titular.bajada.map((oracion) => oracion.texto), [
      '1 vence el jueves 31/12.', '7 ya están cargados para noviembre y diciembre.', 'Otros 10 se habilitan el 1/1/2027.'
    ]);

    // Con el arranque en marzo, la 2026 todavía no habilitó nada: sus dos mitades están por habilitar
    const marzo = { ...PLANTA.estado, arranque: '2026-03-02', licencias: [] };
    const resumen = resumenDe({
      persona: PLANTA.persona, estado: marzo, calculo: calculoDe(marzo, '2026-03-10'), hoy: '2026-03-10',
      feriados: SIN_FERIADOS, hoyYManana: HOY_Y_MANANA
    });
    assert.deepEqual(resumen.titular, {
      encabezado: 'Martes 10 de marzo, planta permanente', antes: 'Te quedan', cifra: '28', despues: 'días de vacaciones',
      bajada: [
        { texto: '8 vencen el jueves 31/12.', vence: true },
        { texto: 'Otros 20 se habilitan el 1/7/2026 y el 1/1/2027.', vence: false }
      ]
    });
  });

  it('1 por habilitar: «Otro 1 se habilita…» y, con la cifra en 0, «1 se habilita…»', () => {
    const uno = titularCon(conOrdinarias((ordinaria) =>
      (ordinaria.anio === 2026 ? { ...ordinaria, por_habilitar: 1 } : ordinaria)));
    assert.deepEqual(uno.bajada.at(-1), { texto: 'Otro 1 se habilita el 1/1/2027.', vence: false });
    const sinDias = titularCon(conOrdinarias((ordinaria) => ({
      ...ordinaria, disponibles: 0, cargados: 0, por_habilitar: ordinaria.anio === 2026 ? 1 : 0
    })));
    assert.deepEqual(sinDias, {
      encabezado: 'Lunes 26 de octubre, planta permanente', antes: 'No te quedan días de vacaciones', cifra: '', despues: '',
      bajada: [{ texto: '1 se habilita el 1/1/2027.', vence: false }]
    });
  });

  it('sin nada que vence, cargado ni por habilitar, la bajada va vacía', () => {
    const nada = titularCon(conOrdinarias((ordinaria) => ({ ...ordinaria, disponibles: 0, cargados: 0, por_habilitar: 0 })));
    assert.deepEqual(nada.bajada, []);
    assert.equal(nada.antes, 'No te quedan días de vacaciones');
  });

  it('«Perdés …» al final de la bajada, en ámbar, y fuera de lo disponible (spec 2026-10-27-mi-espacio-dias-de-vacaciones)', () => {
    // La persona de la spec: 15 de la 2024, 20 de la 2025 y 10 de la 2026, con 20 días en 2026. Las vacaciones del 21/12 al
    // 10/01 usan 13 de la 2024 y los 2 que quedan ya no se pueden empezar a usar antes del 31/12
    const conCarga = (desde, hasta) => ({ ...PLANTA.estado, saldos: saldosDeVacaciones({ 2024: 15, 2025: 20, 2026: 10 }),
      licencias: [...sinVacaciones, licencia(100, 'vacaciones', desde, hasta)] });
    const cruza = conCarga('2026-12-21', '2027-01-10');
    const resumen = resumenDel(PLANTA, { estado: cruza });
    assert.deepEqual([resumen.titular.antes, resumen.titular.cifra, resumen.titular.despues],
      ['Te quedan', '30', 'días de vacaciones']);
    assert.deepEqual(resumen.titular.bajada, [
      { texto: '13 ya están cargados para diciembre y enero de 2027.', vence: false, anio: 2026 },
      { texto: 'Otros 10 se habilitan el 1/1/2027.', vence: false },
      { texto: 'Perdés 2 de la 2024 (vencen el 31/12/2026).', vence: true }
    ]);
    // No es una capa de la regla: esos días no se pueden usar
    assert.equal(resumen.tanques.vacaciones.capas.some((capa) => capa.clase === 'vence'), false);
    assert.equal(resumen.tipos.find((opcion) => opcion.tipo === 'vacaciones').queda_texto, '30 disponibles');
    // Desde el 1/10 «Vence pronto» avisa la licencia que vence en el año, pero no los días que se pierden
    const diciembre = resumenDel(PLANTA, { estado: cruza, hoy: '2026-12-01' });
    assert.equal(diciembre.vence_pronto.some((cosa) => cosa.titulo.includes('licencia 2024')), false);

    // Con las del 14/12 al 18/12, el 21/12 queda libre: los 10 que quedan vencen, y no se pierde nada
    const semana = resumenDel(PLANTA, { estado: conCarga('2026-12-14', '2026-12-18') });
    assert.deepEqual(semana.titular.bajada[0], { texto: '10 vencen el jueves 31/12.', vence: true });
    assert.equal(semana.titular.bajada.some((oracion) => oracion.texto.includes('Perdés')), false);
    // Y el 01/12 «Vence pronto» sí los avisa
    const semanaDiciembre = resumenDel(PLANTA, { estado: conCarga('2026-12-14', '2026-12-18'), hoy: '2026-12-01' });
    assert.equal(semanaDiciembre.vence_pronto.some((cosa) => cosa.titulo === '10 días de la licencia 2024'), true);
  });

  it('sin modalidad, sin arranque o sin un hoy válido, no hay banda', () => {
    const sinModalidad = { ...PLANTA.estado, modalidad: null };
    assert.equal(resumenDel(PLANTA, { estado: sinModalidad, persona: { ...PLANTA.persona, vinculo: null } }).titular, null);
    assert.equal(resumenDel(PLANTA, { estado: { ...PLANTA.estado, arranque: null } }).titular, null);
    assert.equal(resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado) }).titular, null);
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
    assert.deepEqual(Object.keys(lista), ['anio', 'anios', 'filtros', 'licencias', 'saldo_inicial', 'otros_anios']);
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
      configuracion: null, puede_borrar: true, solo_hasta: false, fechas_fijas: false, en_configuracion: null
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
    // Con el nombre corto de contextoDe (spec 2026-10-28-mi-espacio-agenda-onda, 5.1), el nombre como lo ven los demás; sin
    // él, el completo (como arriba)
    const conCorto = filasDel(PLANTA, { estado, persona: { ...PLANTA.persona, nombre_corto: 'Laura' } }).licencias;
    assert.equal(conCorto.find((fila) => fila.id === 102).mostrar_texto, 'Tus compañeros ven «Laura no está».');
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

  // Lo que necesita el formulario para corregir una creada: la persona a cargo que ya tiene y el id de su licencia de
  // Configuración (el excluir del aviso de los días sin auditor)
  it('la persona a cargo y el id de Configuración de una creada salen de los vínculos', () => {
    const vinculos = new Map([
      [6, { configuracion: null, puede_borrar: true, en_configuracion: { licencia_id: 40, autorizado_id: 3 } }],
      [5, { configuracion: null, puede_borrar: true, en_configuracion: { licencia_id: 41, autorizado_id: null } }],
      [4, { configuracion: null, puede_borrar: true, en_configuracion: null }]
    ]);
    const filas = filasDel(PLANTA, { vinculos }).licencias;
    assert.deepEqual(filas.slice(0, 4).map((fila) => fila.en_configuracion),
      [{ licencia_id: 40, autorizado_id: 3 }, { licencia_id: 41, autorizado_id: null }, null, null]);
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
    // Con las horas extras que tenía CONTRATO antes de la planilla (en planta, las salidas no cuentan)
    const estado = { ...CONTRATO.estado, modalidad: 'planta', horasExtras: HORAS_EXTRAS_DE_CONTRATO };
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

// Lo que quedó distinto en Configuración, para revisar en el Resumen (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1,
// 3.2 y 3.5). Los vínculos son los de `vinculosDeLaLista`: un Map del id de cada fila (número) a su `revision`, o null
describe('para revisar (spec 2026-10-28-mi-espacio-licencia-anulada)', () => {
  // Las de la persona de la spec, sumadas a PLANTA (sin pisarse con sus licencias): una creada anulada de antes que cruza el
  // año, una creada cuya licencia de Configuración quedó más corta y dos que empiezan el mismo día (el orden, por id)
  const ESTADO = conLicencias(PLANTA.estado,
    licencia(101, 'medica', '2027-01-18', '2027-01-29'),
    licencia(100, 'vacaciones', '2026-12-28', '2027-01-08'),
    licencia(103, 'medica', '2026-11-16'),
    licencia(102, 'familiar', '2026-11-16', '2026-11-18'));
  const revision = (motivo, desde = null, hasta = null) => ({ configuracion: null, revision: { motivo, desde, hasta } });
  // En otro orden que el de las fechas: el que vale es el de las fechas
  const VINCULOS = new Map([
    [101, revision('fechas', '2027-01-18', '2027-01-22')],
    [103, revision('anulada')],
    [100, revision('anulada')],
    [102, revision('sin_cubrir', '2026-11-18', '2026-11-18')],
    // Con vínculo y sin nada para revisar, sin vínculo (la 5) y uno de una fila que no está (dada de baja): no van
    [6, { configuracion: null, revision: null }],
    [999, revision('anulada')]
  ]);
  const ESPERADO = Object.freeze([
    {
      licencia_id: 102, anio: 2026,
      texto: 'Revisá tu licencia del 16/11 al 18/11/2026: ya no está cubierta en Configuración el 18/11.',
      enlace: 'Ver en Licencias de 2026'
    },
    {
      licencia_id: 103, anio: 2026,
      texto: 'Revisá tu licencia del lunes 16/11/2026: se anuló en Configuración y acá sigue contando.',
      enlace: 'Ver en Licencias de 2026'
    },
    {
      licencia_id: 100, anio: 2026,
      texto: 'Revisá tu licencia del 28/12/2026 al 08/01/2027: se anuló en Configuración y acá sigue contando.',
      enlace: 'Ver en Licencias de 2026'
    },
    {
      licencia_id: 101, anio: 2027,
      texto: 'Revisá tu licencia del 18/01 al 29/01/2027: en Configuración quedó del 18/01 al 22/01.',
      enlace: 'Ver en Licencias de 2027'
    }
  ]);

  it('cada motivo con su texto, ordenadas por desde y después por id; el año es el del desde (la que cruza el año, 2026)', () => {
    assert.deepEqual(paraRevisarDe(ESTADO, VINCULOS), ESPERADO);
  });

  it('las fechas de cada una son las de su fila en la lista; las de un día, con el día de la semana en minúscula', () => {
    const lista = [2026, 2027].flatMap((anio) => filasDel(PLANTA, { estado: ESTADO, anio }).licencias);
    for (const { licencia_id: id, texto } of paraRevisarDe(ESTADO, VINCULOS)) {
      const fila = lista.find((otra) => otra.id === id);
      if (fila.desde === fila.hasta) {
        // La lista sigue diciendo «Lun 16/11/2026»; en la frase, la abreviatura en mayúscula se leería mal
        assert.equal(fila.fechas_texto, 'Lun 16/11/2026');
        assert.ok(texto.startsWith('Revisá tu licencia del lunes 16/11/2026: '), texto);
      } else {
        assert.ok(texto.startsWith(`Revisá tu licencia del ${fila.fechas_texto}: `), texto);
      }
    }
  });

  // Ruling de la revisión final: de un día, la licencia de Mi espacio va con el día de la semana en minúscula («del lunes
  // 16/11/2026») y las fechas de Configuración, «el 17/11» (no «del 17/11 al 17/11»); con un rango, como siempre
  it('de un día: la licencia con el día de la semana y las fechas de Configuración con «el»', () => {
    const estado = conLicencias(PLANTA.estado,
      licencia(110, 'medica', '2026-11-16'),
      licencia(111, 'familiar', '2026-11-18'),
      licencia(112, 'medica', '2026-11-23', '2026-11-25'),
      licencia(113, 'familiar', '2026-11-30', '2026-12-02'));
    const vinculos = new Map([
      [110, revision('fechas', '2026-11-17', '2026-11-17')],
      [111, revision('sin_cubrir', '2026-11-18', '2026-11-18')],
      [112, revision('fechas', '2026-11-24', '2026-11-24')],
      [113, revision('sin_cubrir', '2026-12-01', '2026-12-02')]
    ]);
    assert.deepEqual(paraRevisarDe(estado, vinculos).map(({ texto }) => texto), [
      'Revisá tu licencia del lunes 16/11/2026: en Configuración quedó el 17/11.',
      'Revisá tu licencia del miércoles 18/11/2026: ya no está cubierta en Configuración el 18/11.',
      'Revisá tu licencia del 23/11 al 25/11/2026: en Configuración quedó el 24/11.',
      'Revisá tu licencia del 30/11 al 02/12/2026: ya no está cubierta en Configuración del 01/12 al 02/12.'
    ]);
  });

  it('con los vínculos de verdad (`vinculosDeLaLista`): una creada que en Configuración quedó más corta', () => {
    const conVinculo = { ...licencia(100, 'medica', '2027-01-04', '2027-01-15'), licencia_oficial_id: 40, oficial: 'creada' };
    const estado = conLicencias(PLANTA.estado, conVinculo);
    const oficiales = new Map([[40, { id: 40, desde: '2027-01-04', hasta: '2027-01-08', anulada: 0, autorizado_id: null }]]);
    const vinculos = reglas.vinculosDeLaLista(estado.licencias, { oficiales, tocadas: new Set(), hoy: HOY, puedeTener: true });
    assert.deepEqual(paraRevisarDe(estado, vinculos), [{
      licencia_id: 100, anio: 2027, texto: 'Revisá tu licencia del 04/01 al 15/01/2027: en Configuración quedó del 04/01 al 08/01.',
      enlace: 'Ver en Licencias de 2027'
    }]);
    // Con las mismas fechas en las dos, nada para revisar
    const iguales = new Map([[40, { ...oficiales.get(40), hasta: '2027-01-15' }]]);
    assert.deepEqual(paraRevisarDe(estado,
      reglas.vinculosDeLaLista(estado.licencias, { oficiales: iguales, tocadas: new Set(), hoy: HOY, puedeTener: true })), []);
  });

  it('sin vínculos que sean un Map, o sin nada para revisar, []', () => {
    for (const raro of [undefined, null, {}, [], [[101, revision('anulada')]], 'x', 3]) {
      assert.deepEqual(paraRevisarDe(ESTADO, raro), [], String(raro));
    }
    assert.deepEqual(paraRevisarDe(ESTADO, new Map()), []);
    assert.deepEqual(paraRevisarDe(PLANTA.estado, new Map([[6, { revision: null }], [5, {}], [4, 'x']])), []);
    // Un motivo que no es ninguno de los tres no va
    assert.deepEqual(paraRevisarDe(ESTADO, new Map([[101, revision('otro', '2027-01-18', '2027-01-22')]])), []);
    for (const raro of [undefined, null, {}, [], 'x']) assert.deepEqual(paraRevisarDe(raro, VINCULOS), []);
  });

  it('el Resumen las trae en `para_revisar`, que no es un faltante', () => {
    const resumen = resumenDe({
      persona: PLANTA.persona, estado: ESTADO, calculo: calculoDe(ESTADO), hoy: HOY, feriados: SIN_FERIADOS,
      hoyYManana: HOY_Y_MANANA, vinculos: VINCULOS
    });
    assert.deepEqual(resumen.para_revisar, ESPERADO);
    assert.ok(resumen.faltantes.every((faltante) => !faltante.startsWith('Revisá tu licencia')), resumen.faltantes.join(' | '));
    // La marca de la pestaña es la de «Vence pronto», no la de lo que hay para revisar
    assert.equal(resumen.marca, resumen.vence_pronto.length > 0);
    sinHuecos(resumen);
  });

  it('sin vínculos, sin arranque o sin modalidad, `para_revisar` es []', () => {
    const resumen = (estado, vinculos, persona = PLANTA.persona) => resumenDe({
      persona, estado, calculo: calculoDe(estado), hoy: HOY, feriados: SIN_FERIADOS, hoyYManana: HOY_Y_MANANA, vinculos
    });
    assert.deepEqual(resumen(ESTADO).para_revisar, []);
    assert.deepEqual(resumen({ ...ESTADO, arranque: null }, VINCULOS).para_revisar, []);
    assert.deepEqual(resumen({ ...ESTADO, modalidad: null }, VINCULOS, { ...PLANTA.persona, vinculo: null }).para_revisar, []);
    assert.deepEqual(resumenDe({ persona: PLANTA.persona, estado: ESTADO, calculo: calculoDe(ESTADO), vinculos: VINCULOS })
      .para_revisar, []);
    assert.deepEqual(resumenDe(undefined).para_revisar, []);
  });
});

// La oración de lo cargado de la bajada lleva a la lista de Licencias del año de lo primero cargado (spec
// 2026-10-28-mi-espacio-licencia-anulada, 2.3 y 3.5)
describe('el año de lo cargado en la bajada', () => {
  const sinVacaciones = PLANTA.estado.licencias.filter((fila) => fila.tipo !== 'vacaciones');
  const bajadaDe = (estado) => resumenDel(PLANTA, { estado }).titular.bajada;

  it('cargadas en noviembre de 2026 y en enero de 2027: 2026; solo en enero: 2027', () => {
    const conEnero = conLicencias(PLANTA.estado, licencia(100, 'vacaciones', '2027-01-11', '2027-01-12'));
    assert.deepEqual(bajadaDe(conEnero)[1], {
      texto: '7 ya están cargados para noviembre y enero de 2027.', vence: false, anio: 2026
    });
    const soloEnero = { ...PLANTA.estado, licencias: [...sinVacaciones, licencia(100, 'vacaciones', '2027-01-11', '2027-01-12')] };
    assert.deepEqual(bajadaDe(soloEnero)[1], { texto: '2 ya están cargados para enero de 2027.', vence: false, anio: 2027 });
  });

  it('las demás oraciones no llevan `anio`', () => {
    for (const oracion of bajadaDe(PLANTA.estado)) {
      assert.equal(Object.hasOwn(oracion, 'anio'), oracion.texto.includes('cargad'), oracion.texto);
    }
    assert.ok(resumenDel(CONTRATO).titular.bajada.every((oracion) => !Object.hasOwn(oracion, 'anio')));
  });
});

// Las licencias de otros años que todavía no terminaron, debajo de la lista (spec 2026-10-28-mi-espacio-licencia-anulada, 2.3
// y 3.4). Con PLANTA (arranque el 26/10/2026), los años del selector son de 2024 a 2027
describe('otros años de la lista', () => {
  const ANIOS = [2024, 2025, 2026, 2027];
  const otros = (licencias, anio = 2026, hoy = HOY, anios = ANIOS) => otrosAniosDe(licencias, { anio, anios, hoy });
  const ENERO = licencia(100, 'vacaciones', '2027-01-11', '2027-01-12');

  it('viendo 2026, una de enero de 2027', () => {
    assert.deepEqual(otros([...PLANTA.estado.licencias, ENERO]),
      [{ anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }]);
  });

  it('dos, en plural', () => {
    assert.deepEqual(otros([ENERO, licencia(101, 'medica', '2027-03-01', '2027-03-02')]),
      [{ anio: 2027, cantidad: 2, texto: 'También tenés 2 licencias cargadas en 2027.' }]);
  });

  it('una que cruza el año ya está en la lista que se ve: no se anuncia, ni en 2026 ni en 2027', () => {
    const cruza = [licencia(100, 'vacaciones', '2026-12-28', '2027-01-05')];
    assert.deepEqual(otros(cruza, 2026), []);
    assert.deepEqual(otros(cruza, 2027), []);
  });

  it('lo terminado de otro año es historia: no se anuncia; lo que termina hoy, sí', () => {
    assert.deepEqual(otros([licencia(100, 'medica', '2025-03-03', '2025-03-05')]), []);
    assert.deepEqual(otros([licencia(100, 'medica', '2026-10-20', '2026-10-26')], 2025),
      [{ anio: 2026, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2026.' }]);
    assert.deepEqual(otros([licencia(100, 'medica', '2026-10-20', '2026-10-25')], 2025), []);
  });

  it('una de 2027 a 2028, viendo 2026: solo en 2027, el año de su desde', () => {
    assert.deepEqual(otros([licencia(100, 'vacaciones', '2027-12-27', '2028-01-04')]),
      [{ anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }]);
  });

  it('un año que no está en el selector no se anuncia', () => {
    assert.deepEqual(otros([licencia(100, 'medica', '2028-02-01', '2028-02-02')]), []);
    assert.deepEqual(otros([ENERO], 2026, HOY, [2024, 2025, 2026]), []);
  });

  it('cuenta lo que mostraría la lista de ese año: también un uso autorizado y lo de la otra modalidad', () => {
    assert.deepEqual(otros([
      licencia(100, 'uso_autorizado', '2027-02-01', '2027-02-01', 7), licencia(101, 'horas_a_favor', '2027-02-02', '2027-02-02', 2)
    ]), [{ anio: 2027, cantidad: 2, texto: 'También tenés 2 licencias cargadas en 2027.' }]);
  });

  it('por año; viendo 2025 o 2027, lo que viene de 2026', () => {
    const licencias = [...PLANTA.estado.licencias, ENERO];
    assert.deepEqual(otros(licencias, 2025), [
      { anio: 2026, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2026.' },
      { anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }
    ]);
    assert.deepEqual(otros(licencias, 2027), [{ anio: 2026, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2026.' }]);
  });

  it('sin año que se muestra, sin hoy o con licencias que no sirven, []', () => {
    assert.deepEqual(otros([ENERO], null), []);
    assert.deepEqual(otros([ENERO], 2026, null), []);
    assert.deepEqual(otros([ENERO], 2026, HOY, null), []);
    assert.deepEqual(otros([null, 'x', { id: 1, tipo: 'otro', desde: '2027-01-04', hasta: '2027-01-05' },
      { id: 2, tipo: 'medica', desde: '2027-01-08', hasta: '2027-01-04' }, { id: 3, tipo: 'medica', desde: 'x', hasta: 'y' }]), []);
    assert.deepEqual(otros(undefined), []);
  });

  it('la lista los trae en `otros_anios`', () => {
    const estado = conLicencias(PLANTA.estado, ENERO);
    assert.deepEqual(filasDel(PLANTA, { estado }).otros_anios,
      [{ anio: 2027, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2027.' }]);
    assert.deepEqual(filasDel(PLANTA).otros_anios, []);
    // El año como texto (el de la dirección)
    assert.deepEqual(filasDel(PLANTA, { estado, anio: '2027' }).otros_anios,
      [{ anio: 2026, cantidad: 1, texto: 'También tenés 1 licencia cargada en 2026.' }]);
    // Sin hoy ni año, la lista vacía: tampoco otros años
    assert.deepEqual(filasDeLicencias(estado, calculoDe(estado), { anio: 'x', persona: PLANTA.persona }).otros_anios, []);
  });
});

// En qué lista quedó una licencia, en el segundo paso de «Cargar licencia» (spec 2026-10-28-mi-espacio-licencia-anulada, 2.3)
describe('el año de la lista en el segundo paso', () => {
  it('solo si no es el año de hoy', () => {
    assert.equal(textoDeLaListaDe('2026-11-03', HOY), null);
    assert.equal(textoDeLaListaDe('2027-01-04', HOY), 'Está en la lista de 2027.');
    assert.equal(textoDeLaListaDe('2025-12-29', '2026-01-05'), 'Está en la lista de 2025.');
  });

  it('con algo que no es una fecha, null', () => {
    for (const raro of [undefined, null, '', 'x', '2027-1-4', 20270104, {}, []]) {
      assert.equal(textoDeLaListaDe(raro, HOY), null, String(raro));
      assert.equal(textoDeLaListaDe('2027-01-04', raro), null, String(raro));
    }
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
      {
        id: 13, fecha: '2026-10-22', fecha_texto: 'Jue 22/10', desde: '19:00', hasta: '22:00', horario: '19:00 a 22:00',
        horas_texto: '3 horas', nota: null
      },
      {
        id: 12, fecha: '2026-10-14', fecha_texto: 'Mié 14/10', desde: '17:00', hasta: '21:00', horario: '17:00 a 21:00',
        horas_texto: '4 horas', nota: null
      },
      {
        id: 11, fecha: '2026-10-06', fecha_texto: 'Mar 06/10', desde: '18:00', hasta: '21:30', horario: '18:00 a 21:30',
        horas_texto: '3,5 horas', nota: null
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
        mes: '2026-10', mes_texto: 'Octubre 2026', horas_texto: '4 h', a_favor_texto: 'Noviembre 2026',
        a_favor_detalle: '4 horas', usadas_texto: '—', usadas_detalle: '', estado: 'sumando', situacion: 'El mes sigue sumando'
      },
      {
        mes: '2026-09', mes_texto: 'Septiembre 2026', horas_texto: '10,5 h', a_favor_texto: 'Octubre 2026',
        a_favor_detalle: '1 día de franco y 3,5 horas', usadas_texto: '9 h', usadas_detalle: '09/10: 7 h · 20/10: 2 h',
        estado: 'en_uso', situacion: '1,5 h para usar hasta el 30/10'
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
    const agosto = {
      ...CONTRATO.estado,
      salidas: [...CONTRATO.estado.salidas, { id: 10, fecha: '2026-08-05', entrada: null, salida: '18:00', nota: null }]
    };
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

  // Spec 2026-10-27-mi-espacio-horas, sección 5: el día por día sale de las salidas de la planilla
  it('el día por día sale de las salidas, de la más nueva a la más vieja, con el total de cada mes', () => {
    const tabla = tablaDel(CONTRATO);
    assert.deepEqual(Object.keys(tabla.dias_por_mes), ['2026-10', '2026-09']);
    assert.deepEqual(tabla.dias_por_mes['2026-10'], [{
      id: 4, fecha: '2026-10-21', fecha_texto: 'Mié 21/10', tipo_texto: '', horario: 'Salida 19:00', entrada_texto: '', horas: 4,
      horas_texto: '4 h', cero: false, nota: null, aviso: null
    }]);
    assert.deepEqual(tabla.dias_por_mes['2026-09'].map(({ id, fecha, horario, horas, horas_texto }) =>
      [id, fecha, horario, horas, horas_texto]), [
      [3, '2026-09-24', 'Salida 17:30', 2.5, '2,5 h'], [2, '2026-09-17', 'Salida 19:00', 4, '4 h'],
      [1, '2026-09-10', 'Salida 19:00', 4, '4 h']
    ]);
    assert.deepEqual(tabla.totales_por_mes, { '2026-10': '4 horas', '2026-09': '10,5 horas' });
    // Otro año, sin salidas: nada
    assert.deepEqual(tablaDel(CONTRATO, { anio: 2025 }).dias_por_mes, {});
  });

  it('el día por día: el feriado y el sábado de la entrada a la salida, la entrada de un día hábil, los que dan 0 y los avisos', () => {
    const tabla = tablaConFeriados(ESTADO_PLANILLA);
    const octubre = tabla.dias_por_mes['2026-10'];
    assert.deepEqual(octubre.map((dia) => dia.fecha), [
      '2026-10-26', '2026-10-24', '2026-10-21', '2026-10-20', '2026-10-16', '2026-10-12', '2026-10-09', '2026-10-05'
    ]);
    const delDia = (fecha) => octubre.find((dia) => dia.fecha === fecha);
    assert.deepEqual(delDia('2026-10-05'), {
      id: 10, fecha: '2026-10-05', fecha_texto: 'Lun 05/10', tipo_texto: '', horario: 'Salida 16:20',
      entrada_texto: 'Entrada 08:02', horas: 1.5, horas_texto: '1,5 h', cero: false, nota: null, aviso: null
    });
    assert.deepEqual(delDia('2026-10-12'), {
      id: 12, fecha: '2026-10-12', fecha_texto: 'Lun 12/10', tipo_texto: 'Feriado', horario: 'De 09:21 a 12:10',
      entrada_texto: '', horas: 2.5, horas_texto: '2,5 h', cero: false, nota: 'Guardia de la mesa de datos', aviso: null
    });
    assert.deepEqual(delDia('2026-10-24'), {
      id: 15, fecha: '2026-10-24', fecha_texto: 'Sáb 24/10', tipo_texto: 'Sábado', horario: 'De 09:00 a 13:20',
      entrada_texto: '', horas: 4.5, horas_texto: '4,5 h', cero: false, nota: 'Relevamiento en el barrio', aviso: null
    });
    // Los que dan 0, en gris: «0» y `cero` (también con la entrada de un día hábil, que no cuenta)
    assert.deepEqual([delDia('2026-10-16'), delDia('2026-10-20')].map(({ entrada_texto, horas, horas_texto, cero }) =>
      [entrada_texto, horas, horas_texto, cero]), [['Entrada 07:58', 0, '0', true], ['', 0, '0', true]]);
    // Un día de licencia de día entero: la salida sigue sumando, con su aviso
    assert.deepEqual([delDia('2026-10-09').horas, delDia('2026-10-09').aviso],
      [2.5, 'Ese día tenés una licencia de día entero: revisá esta salida.']);
    assert.equal(tabla.totales_por_mes['2026-10'], '16 horas');
    const mes = tabla.meses.find((uno) => uno.mes === '2026-10');
    assert.deepEqual([mes.horas_texto, mes.a_favor_texto, mes.a_favor_detalle], ['16 h', 'Noviembre 2026', '2 días de franco y 2 horas']);

    // El 21/10 pasa a ser feriado (cargado después): sin entrada no suma, y lo dice su aviso; un domingo, de la entrada a la salida
    const filas = [...FILAS_PLANILLA, { ...FERIADO_DIVERSIDAD, id: 4, fecha: '2026-10-21', nombre: 'Feriado cargado después' }];
    const domingo = { ...ESTADO_PLANILLA, salidas: [...ESTADO_PLANILLA.salidas, salidaDe(17, '2026-10-25', '11:00', '10:00')] };
    const conFeriado = tablaConFeriados(domingo, { feriados: feriadosDe(filas) });
    const del21 = conFeriado.dias_por_mes['2026-10'].find((dia) => dia.fecha === '2026-10-21');
    assert.deepEqual(del21, {
      id: 4, fecha: '2026-10-21', fecha_texto: 'Mié 21/10', tipo_texto: 'Feriado', horario: 'Salida 19:00', entrada_texto: '',
      horas: null, horas_texto: '', cero: false, nota: null, aviso: 'Ahora es feriado: falta la entrada.'
    });
    const del25 = conFeriado.dias_por_mes['2026-10'].find((dia) => dia.fecha === '2026-10-25');
    assert.deepEqual([del25.tipo_texto, del25.horario, del25.horas_texto], ['Domingo', 'De 10:00 a 11:00', '1 h']);
    assert.equal(conFeriado.totales_por_mes['2026-10'], '13 horas');
  });

  it('cada mes dice debajo de «A favor en» lo mismo en días de franco; las horas extras de planta no cuentan en contrato', () => {
    // 21 horas (4 + 3 + 7 + 7) son 3 días de franco, sin horas sueltas
    const estado = { ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, salidaDe(10, '2026-10-22', '18:00'),
      salidaDe(11, '2026-10-23', '22:00'), salidaDe(12, '2026-10-26', '22:00')] };
    assert.equal(tablaDel(CONTRATO, { estado }).meses.find((mes) => mes.mes === '2026-10').a_favor_detalle,
      '3 días de franco');
    // Unas horas extras de la tabla de planta (de cuando era de planta) no van en el día por día ni en los totales
    const conHorasExtras = { ...CONTRATO.estado, horasExtras: [{ id: 1, fecha: '2026-10-06', desde: '18:00', hasta: '21:30' }] };
    assert.deepEqual(tablaDel(CONTRATO, { estado: conHorasExtras }), tablaDel(CONTRATO));
  });

  it('planta no cambia: sus horas extras, sin a_favor_detalle, y las salidas no cuentan', () => {
    const conSalidas = { ...PLANTA.estado, salidas: SALIDAS_DE_OCTUBRE };
    assert.deepEqual(tablaDel(PLANTA, { estado: conSalidas }), tablaDel(PLANTA));
    assert.ok(tablaDel(PLANTA).meses.every((mes) => !('a_favor_detalle' in mes)));
    assert.deepEqual(Object.keys(tablaDel(PLANTA).dias_por_mes['2026-10'][0]),
      ['id', 'fecha', 'fecha_texto', 'desde', 'hasta', 'horario', 'horas_texto', 'nota']);
  });
});

describe('la planilla de un mes (spec 2026-10-27-mi-espacio-horas, secciones 3, 4 y 8)', () => {
  const CLAVES_DEL_DIA = ['fecha', 'fecha_texto', 'fecha_larga', 'tipo', 'feriado', 'finde_texto', 'licencia', 'futuro', 'hoy',
    'entrada', 'salida', 'nota', 'horas', 'horas_texto', 'aviso'];

  it('octubre: la cabeza, los días hábiles con los feriados de lunes a viernes, los sábados y domingos y la suma', () => {
    const planilla = planillaDel();
    assert.deepEqual(Object.keys(planilla),
      ['modalidad', 'mes', 'mes_texto', 'hoy', 'anterior', 'siguiente', 'dias', 'fines_de_semana', 'suma']);
    assert.deepEqual([planilla.modalidad, planilla.mes, planilla.mes_texto, planilla.hoy],
      ['contrato', '2026-10', 'Octubre 2026', '2026-10-27']);
    // Los días hábiles de octubre, el feriado del 12/10 y el sábado 24/10, que tiene una salida
    assert.deepEqual(planilla.dias.map((dia) => dia.fecha), [
      '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12',
      '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'
    ]);
    // Los demás sábados y domingos hasta hoy, para «Sumar el día» (el 31/10 todavía no llegó)
    assert.deepEqual(planilla.fines_de_semana.map((dia) => dia.fecha), [
      '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18', '2026-10-25'
    ]);
    for (const dia of [...planilla.dias, ...planilla.fines_de_semana]) assert.deepEqual(Object.keys(dia), CLAVES_DEL_DIA, dia.fecha);
    // La suma: 1,5 + 2,5 + 2,5 + 0 + 0 + 4 + 4,5 + 1, la misma de las horas a favor
    assert.deepEqual(planilla.suma,
      { horas: 16, cifra: '16', texto: 'En noviembre vas a tener 2 días de franco y 2 horas a favor.' });
    assert.equal(planilla.suma.horas, horasPorMesDeSalidas(ESTADO_PLANILLA.salidas, FERIADOS_PLANILLA).get('2026-10'));
    assert.equal(planilla.suma.horas, planilla.dias.reduce((suma, dia) => suma + (dia.horas ?? 0), 0));
  });

  it('un día hábil: la salida cuenta desde las 15:00 y la entrada no cuenta; sin salida, sin horas', () => {
    const planilla = planillaDel();
    assert.deepEqual(diaDe(planilla, '2026-10-05'), {
      fecha: '2026-10-05', fecha_texto: 'Lun 05/10', fecha_larga: 'lunes 05/10', tipo: 'habil', feriado: null,
      finde_texto: null, licencia: null, futuro: false, hoy: false, entrada: '08:02', salida: '16:20', nota: null, horas: 1.5,
      horas_texto: '1,5 h', aviso: null
    });
    assert.deepEqual(diaDe(planilla, '2026-10-06'), {
      fecha: '2026-10-06', fecha_texto: 'Mar 06/10', fecha_larga: 'martes 06/10', tipo: 'habil', feriado: null,
      finde_texto: null, licencia: null, futuro: false, hoy: false, entrada: null, salida: null, nota: null, horas: null,
      horas_texto: '', aviso: null
    });
    // No llega a media hora: «0»; una hora, «1 h»
    assert.deepEqual([diaDe(planilla, '2026-10-16').horas, diaDe(planilla, '2026-10-16').horas_texto], [0, '0']);
    assert.deepEqual([diaDe(planilla, '2026-10-26').horas, diaDe(planilla, '2026-10-26').horas_texto], [1, '1 h']);
  });

  it('el feriado del 12/10, con su nombre, cuenta de la entrada a la salida', () => {
    assert.deepEqual(diaDe(planillaDel(), '2026-10-12'), {
      fecha: '2026-10-12', fecha_texto: 'Lun 12/10', fecha_larga: 'lunes 12/10', tipo: 'feriado',
      feriado: 'Día del Respeto a la Diversidad Cultural', finde_texto: null, licencia: null, futuro: false, hoy: false,
      entrada: '09:21', salida: '12:10', nota: 'Guardia de la mesa de datos', horas: 2.5, horas_texto: '2,5 h', aviso: null
    });
  });

  it('las licencias: la de día entero con su tipo (y una salida de antes, con su aviso); la de unas horas, con su etiqueta', () => {
    // El tipo de una de día entero es el de la insignia de su fila en la lista de licencias (NOMBRES_TIPO); las de horas, su texto
    const planilla = planillaDel();
    // Las horas a favor de 7 horas del 9/10: el día entero, con la salida guardada de antes, que sigue sumando
    const del9 = diaDe(planilla, '2026-10-09');
    assert.deepEqual(del9.licencia, { texto: 'Horas a favor, el día entero', entera: true });
    assert.deepEqual([del9.salida, del9.horas, del9.horas_texto, del9.aviso],
      ['17:16', 2.5, '2,5 h', 'Ese día tenés una licencia de día entero: revisá esta salida.']);
    // Los estudios del 13 al 15/10 (anteriores al arranque: igual son días de licencia)
    for (const fecha of ['2026-10-13', '2026-10-14', '2026-10-15']) {
      assert.deepEqual(diaDe(planilla, fecha).licencia, { texto: NOMBRES_TIPO.estudios, entera: true }, fecha);
    }
    // Las 2 horas a favor del 20/10: se carga normal
    const del20 = diaDe(planilla, '2026-10-20');
    assert.deepEqual([del20.licencia, del20.horas_texto, del20.aviso], [{ texto: '2 h a favor', entera: false }, '0', null]);
    // El grupo familiar del 30/10, que todavía no llegó
    assert.deepEqual([diaDe(planilla, '2026-10-30').licencia, diaDe(planilla, '2026-10-30').futuro],
      [{ texto: NOMBRES_TIPO.familiar, entera: true }, true]);
    assert.equal(NOMBRES_TIPO.familiar, 'Atención del grupo familiar');
    // El mismo texto que la insignia de esa licencia en la lista de licencias
    assert.equal(diaDe(planilla, '2026-10-30').licencia.texto,
      filasDel(CONTRATO, { estado: ESTADO_PLANILLA }).licencias.find((fila) => fila.id === 4).tipo_nombre);
    // Sin licencia, null
    assert.equal(diaDe(planilla, '2026-10-21').licencia, null);

    // Los demás tipos, en septiembre (el 1/9 es martes): vacaciones que cruzan un fin de semana, la médica, la
    // extraordinaria, un uso autorizado de 7 horas (con las horas como texto, el DECIMAL de la base) y uno de 3, y 1,5 h a
    // favor. La franquicia y el franco no son de contrato: no se muestran
    const estado = conLicencias(CONTRATO.estado,
      licencia(100, 'medica', '2026-09-01'), licencia(101, 'medica_extraordinaria', '2026-09-02'),
      licencia(102, 'uso_autorizado', '2026-09-03', '2026-09-03', '7.0'),
      licencia(103, 'uso_autorizado', '2026-09-04', '2026-09-04', 3),
      licencia(104, 'horas_a_favor', '2026-09-07', '2026-09-07', 1.5),
      licencia(105, 'franquicia', '2026-09-08', '2026-09-08', 7), licencia(106, 'franco', '2026-09-09'),
      licencia(107, 'vacaciones', '2026-09-11', '2026-09-14'));
    const septiembre = planillaDel(estado, { mes: '2026-09' });
    const licenciaDel = (fecha) => diaDe(septiembre, fecha).licencia;
    assert.deepEqual(licenciaDel('2026-09-01'), { texto: NOMBRES_TIPO.medica, entera: true });
    assert.deepEqual(licenciaDel('2026-09-02'), { texto: NOMBRES_TIPO.medica_extraordinaria, entera: true });
    assert.equal(NOMBRES_TIPO.medica_extraordinaria, 'Médica extraordinaria');
    assert.deepEqual(licenciaDel('2026-09-03'), { texto: 'Uso autorizado, el día entero', entera: true });
    assert.deepEqual(licenciaDel('2026-09-04'), { texto: 'Uso autorizado, 3 h', entera: false });
    assert.deepEqual(licenciaDel('2026-09-07'), { texto: '1,5 h a favor', entera: false });
    assert.equal(licenciaDel('2026-09-08'), null);
    assert.equal(licenciaDel('2026-09-09'), null);
    assert.deepEqual(licenciaDel('2026-09-11'), { texto: NOMBRES_TIPO.vacaciones, entera: true });
    assert.deepEqual(licenciaDel('2026-09-14'), { texto: NOMBRES_TIPO.vacaciones, entera: true });
    // El sábado y el domingo del medio de las vacaciones no son días de licencia
    assert.equal(licenciaDel('2026-09-12'), null);
    assert.equal(licenciaDel('2026-09-13'), null);
  });

  it('hoy lleva su marca y se carga; los días que todavía no llegaron, futuro', () => {
    const planilla = planillaDel();
    const marcas = (fecha) => [diaDe(planilla, fecha).hoy, diaDe(planilla, fecha).futuro];
    assert.deepEqual(marcas('2026-10-26'), [false, false]);
    assert.deepEqual(marcas('2026-10-27'), [true, false]);
    for (const fecha of ['2026-10-28', '2026-10-29', '2026-10-30']) assert.deepEqual(marcas(fecha), [false, true], fecha);
    assert.equal(planilla.dias.filter((dia) => dia.futuro).length, 3);
    // En un mes que ya pasó, ninguno
    assert.ok(planillaDel(ESTADO_PLANILLA, { mes: '2026-09' }).dias.every((dia) => !dia.futuro && !dia.hoy));
  });

  it('los sábados y domingos: con una salida, en los días; sin nada y hasta hoy, para sumar; un sábado feriado, con su nombre (Review Focus 2)', () => {
    const planilla = planillaDel();
    assert.deepEqual(diaDe(planilla, '2026-10-24'), {
      fecha: '2026-10-24', fecha_texto: 'Sáb 24/10', fecha_larga: 'sábado 24/10', tipo: 'finde', feriado: null,
      finde_texto: 'Sábado', licencia: null, futuro: false, hoy: false, entrada: '09:00', salida: '13:20',
      nota: 'Relevamiento en el barrio', horas: 4.5, horas_texto: '4,5 h', aviso: null
    });
    // El sábado 17/10 es feriado: va con los sábados y domingos para sumar, con `tipo: 'feriado'` y su nombre
    assert.deepEqual(planilla.fines_de_semana.find((dia) => dia.fecha === '2026-10-17'), {
      fecha: '2026-10-17', fecha_texto: 'Sáb 17/10', fecha_larga: 'sábado 17/10', tipo: 'feriado',
      feriado: 'Feriado de prueba en sábado', finde_texto: 'Sábado', licencia: null, futuro: false, hoy: false, entrada: null,
      salida: null, nota: null, horas: null, horas_texto: '', aviso: null
    });
    const del18 = planilla.fines_de_semana.find((dia) => dia.fecha === '2026-10-18');
    assert.deepEqual([del18.tipo, del18.feriado, del18.finde_texto], ['finde', null, 'Domingo']);

    // Con una salida, el sábado feriado pasa a los días y cuenta de la entrada a la salida: 3 horas más
    const conSabado = { ...ESTADO_PLANILLA, salidas: [...ESTADO_PLANILLA.salidas, salidaDe(17, '2026-10-17', '12:00', '09:00')] };
    const otra = planillaDel(conSabado);
    const sabado = otra.dias.find((dia) => dia.fecha === '2026-10-17');
    assert.deepEqual([sabado.tipo, sabado.feriado, sabado.finde_texto, sabado.horas, sabado.horas_texto],
      ['feriado', 'Feriado de prueba en sábado', 'Sábado', 3, '3 h']);
    assert.ok(!otra.fines_de_semana.some((dia) => dia.fecha === '2026-10-17'));
    assert.equal(otra.suma.horas, 19);

    // En un mes que ya pasó, todos los sábados y domingos sin nada; si hoy es sábado, ese sábado también
    assert.deepEqual(planillaDel(ESTADO_PLANILLA, { mes: '2026-09' }).fines_de_semana.map((dia) => dia.fecha), [
      '2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13', '2026-09-19', '2026-09-20', '2026-09-26', '2026-09-27'
    ]);
    const unSabado = planillaDel(CONTRATO.estado, { hoy: '2026-10-24' });
    assert.deepEqual(unSabado.fines_de_semana.map((dia) => dia.fecha).slice(-2), ['2026-10-18', '2026-10-24']);
    assert.equal(diaDe(unSabado, '2026-10-24').hoy, true);
    assert.equal(unSabado.dias.at(-1).fecha, '2026-10-30');
  });

  it('una salida que dejó de cerrar: el día que pasó a ser feriado sin entrada no suma y lleva su aviso', () => {
    const filas = [...FILAS_PLANILLA, { ...FERIADO_DIVERSIDAD, id: 4, fecha: '2026-10-21', nombre: 'Feriado cargado después' }];
    const planilla = planillaDel(ESTADO_PLANILLA, { feriados: feriadosDe(filas), filas });
    assert.deepEqual(diaDe(planilla, '2026-10-21'), {
      fecha: '2026-10-21', fecha_texto: 'Mié 21/10', fecha_larga: 'miércoles 21/10', tipo: 'feriado',
      feriado: 'Feriado cargado después', finde_texto: null, licencia: null, futuro: false, hoy: false, entrada: null,
      salida: '19:00', nota: null, horas: null, horas_texto: '', aviso: 'Ahora es feriado: falta la entrada.'
    });
    assert.equal(planilla.suma.horas, 12);
  });

  it('los nombres de los feriados: los 9 fijos, el primero de la lista si hay dos el mismo día y, sin nombre, «Feriado»', () => {
    // Mayo de 2026: el 1/5 (viernes) y el 25/5 (lunes), fijos, también sin feriados en la tabla
    const mayo = planillaDel(CONTRATO.estado, { mes: '2026-05', feriados: SIN_FERIADOS, filas: [] });
    for (const fecha of ['2026-05-01', '2026-05-25']) {
      assert.deepEqual([diaDe(mayo, fecha).tipo, diaDe(mayo, fecha).feriado], ['feriado', NOMBRES_DE_LOS_FIJOS[fecha.slice(5)]]);
    }
    // Uno de la tabla el mismo día que un fijo: el fijo va primero
    const otro = { ...FERIADO_DIVERSIDAD, id: 5, fecha: '2026-05-25', nombre: 'Otro feriado el mismo día' };
    assert.equal(diaDe(planillaDel(CONTRATO.estado, { mes: '2026-05', feriados: feriadosDe([otro]), filas: [otro] }),
      '2026-05-25').feriado, NOMBRES_DE_LOS_FIJOS['05-25']);
    // Un feriado del Set del que no llegó la fila (los dos salen de la misma tabla: no debería pasar)
    const sinFila = planillaDel(ESTADO_PLANILLA, { feriados: new Set([...FERIADOS_PLANILLA, '2026-10-22']) });
    assert.deepEqual([diaDe(sinFila, '2026-10-22').tipo, diaDe(sinFila, '2026-10-22').feriado], ['feriado', 'Feriado']);
    // Un día hábil no tiene nombre de feriado
    assert.equal(diaDe(planillaDel(), '2026-10-22').feriado, null);
  });

  it('anterior y siguiente: null en el primer mes del rango y en el de hoy; sin mes, el de hoy', () => {
    const navegacion = (mes) => {
      const planilla = planillaDel(ESTADO_PLANILLA, { mes });
      return [planilla.mes, planilla.anterior, planilla.siguiente];
    };
    assert.deepEqual(navegacion('2026-10'), ['2026-10', '2026-09', null]);
    assert.deepEqual(navegacion('2026-09'), ['2026-09', '2026-08', '2026-10']);
    assert.deepEqual(navegacion('2026-01'), ['2026-01', '2025-12', '2026-02']);
    assert.deepEqual(navegacion('2024-01'), ['2024-01', null, '2024-02']);
    assert.deepEqual(navegacion(undefined), ['2026-10', '2026-09', null]);
    assert.deepEqual(navegacion(''), ['2026-10', '2026-09', null]);
  });

  it('la suma: un mes que ya pasó, uno sin horas y el en curso sin horas', () => {
    assert.deepEqual(planillaDel(ESTADO_PLANILLA, { mes: '2026-09' }).suma,
      { horas: 10.5, cifra: '10,5', texto: 'En octubre tuviste 1 día de franco y 3,5 horas a favor.' });
    assert.deepEqual(planillaDel(ESTADO_PLANILLA, { mes: '2026-08' }).suma,
      { horas: 0, cifra: '0', texto: 'En agosto no hiciste horas extras.' });
    const sinHoras = { horas: 0, cifra: '0', texto: 'Todavía no sumaste horas extras en octubre.' };
    assert.deepEqual(planillaDel({ ...CONTRATO.estado, salidas: [] }).suma, sinHoras);
    // Un estado sin la clave de las salidas, igual
    const sinSalidas = { ...CONTRATO.estado };
    delete sinSalidas.salidas;
    assert.deepEqual(planillaDel(sinSalidas).suma, sinHoras);
  });

  it('fuera de contrato, con un mes que no sirve o sin un hoy válido, null', () => {
    assert.equal(planillaDel(PLANTA.estado), null);
    assert.equal(planillaDel({ ...CONTRATO.estado, modalidad: null }), null);
    for (const mes of ['2026-11', '2023-12', '2026-13', '2026-1', '2026-10-01', ['2026-10'], 202610]) {
      assert.equal(planillaDel(ESTADO_PLANILLA, { mes }), null, JSON.stringify(mes));
    }
    for (const hoy of [undefined, null, '', 'x', '2026-02-30']) {
      assert.equal(planillaDelMes(ESTADO_PLANILLA, calculoDe(ESTADO_PLANILLA), { mes: '2026-10', hoy }), null, String(hoy));
    }
    for (const raro of [undefined, null, '', 'x', 3, []]) assert.equal(planillaDelMes(raro, null, { hoy: HOY_PLANILLA }), null);
    assert.equal(planillaDelMes(ESTADO_PLANILLA, null, undefined), null);
  });

  it('pasada por JSON queda igual: todo número es un número y todo texto, un texto', () => {
    const planilla = planillaDel();
    sinHuecos(planilla);
    assert.deepEqual(JSON.parse(JSON.stringify(planilla)), planilla);
    sinHuecos(planillaDel(ESTADO_PLANILLA, { mes: '2024-01' }));
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
        tablaDeHorasExtras({ ...CONTRATO.estado, salidas: [valor, { id: valor, fecha: '2026-10-01', salida: valor, entrada: valor,
          nota: valor }, { fecha: valor, salida: '16:00' }] }, calculoDe(CONTRATO.estado), { hoy: HOY, feriados: valor });
        planillaDelMes(valor, valor, valor);
        planillaDelMes(CONTRATO.estado, valor, { mes: valor, hoy: HOY_PLANILLA, feriados: valor, filasFeriados: valor });
        planillaDelMes({ ...CONTRATO.estado, salidas: [valor, { fecha: '2026-10-05', salida: valor, entrada: valor, nota: valor }],
          licencias: [valor, { tipo: 'horas_a_favor', desde: valor, hasta: valor, horas: valor },
            { tipo: 'uso_autorizado', desde: '2026-10-05', hasta: '2026-10-05', horas: valor }] },
        calculoDe(CONTRATO.estado), { hoy: HOY_PLANILLA, filasFeriados: [valor, { fecha: valor, activo: 1 }] });
        proximoFeriadoDe(valor, valor);
        proximoFeriadoDe([valor, { fecha: valor, activo: 1 }], HOY);
        resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado), hoy: HOY, vinculos: valor });
        paraRevisarDe(valor, valor);
        paraRevisarDe(PLANTA.estado, new Map([[6, valor], [5, { revision: valor }], [4, { revision: { motivo: valor } }]]));
        otrosAniosDe(valor, valor);
        otrosAniosDe([valor, { id: valor, tipo: 'medica', desde: valor, hasta: valor }], { anio: valor, anios: valor, hoy: valor });
        otrosAniosDe(PLANTA.estado.licencias, { anio: 2025, anios: [valor, 2026], hoy: HOY });
        textoDeLaListaDe(valor, valor);
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
    const planilla = planillaDelMes(ESTADO_PLANILLA, roto, { hoy: HOY_PLANILLA, feriados: FERIADOS_PLANILLA, filasFeriados: [] });
    sinHuecos(planilla);
    // Sin los avisos del cálculo, ningún día lleva aviso
    assert.ok(planilla.dias.every((dia) => dia.aviso === null));
  });

  it('sin un hoy válido, un Resumen sin nada que calcular', () => {
    const resumen = resumenDe({ persona: PLANTA.persona, estado: PLANTA.estado, calculo: calculoDe(PLANTA.estado) });
    assert.equal(resumen.anio, null);
    assert.equal(resumen.al_texto, '');
    assert.equal(resumen.tanques, null);
    sinHuecos(resumen);
  });
});
