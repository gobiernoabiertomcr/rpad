// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 2, 3.1 a 3.8 y 4): las constantes, los textos,
// las reglas de las vacaciones (las dos mitades, el vencimiento y la licencia más vieja primero), lo que suma cada licencia
// contra su tope del año, la validación de una carga, y las horas extras con los francos compensatorios (planta), las horas
// a favor (contrato) y lo no utilizado previamente, contadas en días hábiles con los feriados y desde el arranque.
// Puras, sin base, sobre los casos de tests/fixtures/mi-espacio-casos.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODALIDADES, modalidadDe, TEXTO_MODALIDAD, TIPOS_LICENCIA, TIPOS_POR_MODALIDAD, NOMBRES_TIPO, DIAS_VACACIONES,
  DIAS_ESTUDIOS, DIAS_POR_EXAMEN, TOPES, JORNADA, LARGO_NOTA, MENSAJES_MI_ESPACIO,
  textoRango, textoNoEstudia, textoSuperpuesta, textoSinHabilitados, textoTope, textoSinFranco, textoSinHorasAFavor,
  textoSinNoUtilizadas, textoHorarioSuperpuesto, textoSaldo, textoAutorizadaSinDias,
  AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN, AVISO_NOTAS_DE_HOY, AVISO_SIN_PERSONA_A_CARGO,
  textoSuperpuestaConConfiguracion, textoNoPaso, textoYaNoCubierta, textoEnConfiguracion, textoUnida,
  textoSigueEnConfiguracion, TEXTO_TAMBIEN_EN_CONFIGURACION, TEXTO_NO_SE_COPIA, TEXTO_ANULADA_POR_ADMINISTRACION,
  TEXTO_NO_DIA_ENTERO,
  mitadesDe, habilitaciones, venceLaLicencia, anioVigente, ordinariasDe, diasQueDescuentan, repartoDeVacaciones,
  textoDelReparto, rangoDeFechas, esDiaEntero, topeDe, usoDeLosTopes, validarLicencia,
  horasDe, mesMas, horasPorMes, validarHorasExtras, francosDe, horasAFavorDe, noUtilizadasDe
} from '../services/miEspacioReglas.js';
import { HOY, SIN_FERIADOS, PLANTA, CONTRATO } from './fixtures/mi-espacio-casos.js';

// Unas vacaciones (las de los casos tienen ids del 1 al 6: las de los tests, desde el 100)
const vacaciones = (id, desde, hasta) => ({ id, tipo: 'vacaciones', desde, hasta, horas: null });

// El estado de un caso con más licencias (una copia: los casos están congelados)
const conLicencias = (estado, ...licencias) => ({ ...estado, licencias: [...estado.licencias, ...licencias] });

// Los saldos de vacaciones, por año: { 2024: 3, 2025: 0 }
const saldosDeVacaciones = (porAnio) =>
  Object.entries(porAnio).map(([anio, cantidad]) => ({ concepto: 'vacaciones', anio: Number(anio), cantidad }));

// Solo vacaciones y PLANTA.anios (2026 con 20 días), con el arranque y los saldos de vacaciones que se pidan
const soloVacaciones = (arranque, porAnio, ...licencias) => ({
  ...PLANTA.estado, arranque, saldos: saldosDeVacaciones(porAnio), licencias
});

const ordinaria = (reparto, anio) => reparto.ordinarias.find((o) => o.anio === anio);

// Lo que cuenta cada ordinaria a hoy
const aHoy = (reparto) => reparto.ordinarias.map(({ anio, habilitado, por_habilitar, usados, cargados, disponibles }) =>
  ({ anio, habilitado, por_habilitar, usados, cargados, disponibles }));

const disponibles = (reparto) => reparto.ordinarias.reduce((suma, o) => suma + o.disponibles, 0);

describe('las constantes', () => {
  it('las modalidades salen del vínculo, y su texto también', () => {
    assert.deepEqual(MODALIDADES, ['planta', 'contrato']);
    assert.equal(modalidadDe('planta_permanente'), 'planta');
    assert.equal(modalidadDe('planta_politica'), 'planta');
    assert.equal(modalidadDe('contrato'), 'contrato');
    for (const otro of [null, undefined, '', 'planta', 'otro', 3, {}]) assert.equal(modalidadDe(otro), null);
    assert.deepEqual(TEXTO_MODALIDAD, {
      planta_permanente: 'Planta permanente', planta_politica: 'Planta política', contrato: 'Contrato'
    });
  });

  it('los tipos de licencia, los de cada modalidad y sus nombres', () => {
    assert.deepEqual(TIPOS_LICENCIA, [
      'vacaciones', 'franquicia', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'horas_a_favor',
      'uso_autorizado'
    ]);
    assert.deepEqual(TIPOS_POR_MODALIDAD, {
      planta: ['vacaciones', 'franquicia', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'franco', 'uso_autorizado'],
      contrato: ['vacaciones', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'horas_a_favor', 'uso_autorizado']
    });
    assert.deepEqual(NOMBRES_TIPO, {
      vacaciones: 'Vacaciones', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
      medica_extraordinaria: 'Médica extraordinaria', familiar: 'Atención del grupo familiar', franco: 'Franco compensatorio',
      horas_a_favor: 'Horas a favor', uso_autorizado: 'Uso autorizado'
    });
  });

  it('los días, los topes y los largos', () => {
    assert.deepEqual(DIAS_VACACIONES, [10, 15, 20, 25, 30]);
    assert.deepEqual(DIAS_ESTUDIOS, { universitario: 15, secundario: 10 });
    assert.equal(DIAS_POR_EXAMEN, 3);
    assert.deepEqual(TOPES, { franquicia: 42, medica: 25, familiar: 25 });
    assert.equal(JORNADA, 7);
    assert.equal(LARGO_NOTA, 200);
  });

  it('están congeladas', () => {
    for (const constante of [
      MODALIDADES, TEXTO_MODALIDAD, TIPOS_LICENCIA, TIPOS_POR_MODALIDAD, TIPOS_POR_MODALIDAD.planta,
      TIPOS_POR_MODALIDAD.contrato, NOMBRES_TIPO, DIAS_VACACIONES, DIAS_ESTUDIOS, TOPES, MENSAJES_MI_ESPACIO
    ]) assert.ok(Object.isFrozen(constante));
  });
});

describe('los textos', () => {
  it('MENSAJES_MI_ESPACIO, tal cual', () => {
    assert.deepEqual(MENSAJES_MI_ESPACIO, {
      sinModalidad: 'Pedile a administración que cargue tu modalidad (planta permanente, planta política o contrato) en Configuración → Usuarios.',
      sinArranque: 'Para empezar, completá «Mis vacaciones y saldos».',
      tipo: 'Elegí el tipo de licencia.',
      fecha: 'Elegí una fecha válida.',
      hastaAntes: 'La licencia no puede terminar antes de empezar.',
      unDia: 'Esta licencia es de un solo día.',
      sinDiasHabiles: 'Entre esas fechas no hay ningún día hábil.',
      diaNoHabil: 'Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado.',
      porExamen: 'Cada examen es de 1 a 3 días hábiles.',
      horasEnteras: 'Las franquicias se toman por hora entera, de 1 a 7.',
      horasMedias: 'Las horas van de a media hora, de 0,5 a 7.',
      nota: 'La nota puede tener hasta 200 caracteres.',
      horario: 'Elegí de qué hora a qué hora, de a media hora.',
      diasVacaciones: 'Elegí 10, 15, 20, 25 o 30 días.',
      estudios: 'Elegí universitaria, secundaria o «No estudio».',
      anio: 'Elegí un año válido.',
      saldoMedias: 'Escribí las horas de a media hora.',
      noEncontrada: 'Licencia no encontrada',
      noEncontradas: 'Horas extras no encontradas',
      yaEmpezo: 'Ya empezó: no se puede borrar',
      soloHasta: 'Ya empezó: solo podés cambiar hasta cuándo.',
      fechasFijas: 'Ya terminó: las fechas quedan fijas.',
      autorizadoSoloVacaciones: 'Solo las vacaciones dejan persona a cargo.',
      tipoFijo: 'Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.'
    });
  });

  it('las funciones de texto de las cargas', () => {
    assert.equal(textoRango('2024-01-01', '2027-12-31'), 'La fecha tiene que ser del 01/01/2024 al 31/12/2027.');
    assert.equal(textoNoEstudia(2026), 'En 2026 elegiste «No estudio»: cambialo en «Mis vacaciones y saldos».');
    assert.equal(textoSuperpuesta('2026-11-05'), 'Ya tenés una licencia cargada el 05/11/2026: corregí la que ya está.');
    assert.equal(textoSinHabilitados('2026-06-15'),
      'No te alcanzan los días habilitados: para el 15/06/2026 no te queda ninguno.');
    assert.equal(textoSinFranco('2027-02'), 'En febrero de 2027 no tenés francos para usar.');
    assert.equal(textoHorarioSuperpuesto('19:00', '22:00'), 'Se superpone con las horas extras de 19:00 a 22:00 de ese día.');
    assert.equal(textoSaldo(30), 'Escribí un número de 0 a 30.');
    assert.equal(textoAutorizadaSinDias('2026-10-26', '2026-11-10'),
      'Sos la persona autorizada del firmante del 26/10/2026 al 10/11/2026, y con esta licencia no te quedaría ningún día '
      + 'hábil para presentar las notas. Hablalo con el firmante antes de cargarla.');
  });

  it('textoTope: con el tope de cada tipo, y el de estudios, el de ese año', () => {
    assert.equal(textoTope('medica', 2026), 'Con esta licencia pasarías los 25 días de atención médica de 2026.');
    assert.equal(textoTope('familiar', 2026), 'Con esta licencia pasarías los 25 días de atención del grupo familiar de 2026.');
    assert.equal(textoTope('franquicia', 2026), 'Con esta licencia pasarías las 42 horas de franquicia de 2026.');
    assert.equal(textoTope('estudios', 2026, 15), 'Con esta licencia pasarías los 15 días de licencia por estudios de 2026.');
    assert.equal(textoTope('estudios', 2027, 10), 'Con esta licencia pasarías los 10 días de licencia por estudios de 2027.');
    // Sin tope no hay texto: la extraordinaria no tiene, y el de estudios depende del año
    assert.equal(textoTope('medica_extraordinaria', 2026), '');
    assert.equal(textoTope('estudios', 2026), '');
  });

  it('textoSinHorasAFavor y textoSinNoUtilizadas, con lo que queda', () => {
    assert.equal(textoSinHorasAFavor('2026-11', 1.5), 'En noviembre de 2026 te quedan 1,5 horas a favor.');
    assert.equal(textoSinHorasAFavor('2026-11', 0), 'En noviembre de 2026 no te quedan horas a favor.');
    assert.equal(textoSinHorasAFavor('2026-11', 1), 'En noviembre de 2026 te queda 1 hora a favor.');
    assert.equal(textoSinNoUtilizadas('contrato', 2026, 2), 'En 2026 te quedan 2 horas no utilizadas previamente.');
    assert.equal(textoSinNoUtilizadas('contrato', 2026, 6.5), 'En 2026 te quedan 6,5 horas no utilizadas previamente.');
    assert.equal(textoSinNoUtilizadas('contrato', 2026, 1), 'En 2026 te queda 1 hora no utilizada previamente.');
    assert.equal(textoSinNoUtilizadas('contrato', 2026, 0), 'En 2026 no te quedan horas no utilizadas previamente.');
    assert.equal(textoSinNoUtilizadas('planta', 2026, 0), 'En 2026 no tenés francos no utilizados previamente.');
    assert.equal(textoSinNoUtilizadas(null, 2026, 0), '');
  });

  it('los textos del paso a Configuración', () => {
    assert.equal(AVISO_DEL_PASO, 'Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible '
      + 'para auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo '
      + 'no pasa.');
    assert.equal(AVISO_DEL_PASO_SUPERADMIN, 'Los avisos al superadmin se guardan y te llegan en un resumen a la vuelta.');
    assert.equal(AVISO_NOTAS_DE_HOY, 'Las notas de hoy ya salieron a las 8:15 con tu firma.');
    assert.equal(AVISO_SIN_PERSONA_A_CARGO,
      'Sin persona a cargo: esos días no se generan Notas Digitales y lo que venza se reitera cuando vuelvas.');
    assert.equal(textoSuperpuestaConConfiguracion('2026-11-03', '2026-11-05'),
      'Se superpone con una licencia de Configuración del 03/11 al 05/11: revisala con administración');
    assert.equal(textoNoPaso('La licencia puede durar como máximo 365 días'),
      'No pasó a Configuración: La licencia puede durar como máximo 365 días');
    assert.equal(textoYaNoCubierta('2026-11-03', '2026-11-05'),
      'Ya no está cubierta en Configuración del 03/11 al 05/11: revisala con administración.');
    assert.equal(textoEnConfiguracion('2026-11-03', '2026-11-05'), 'En Configuración: del 03/11 al 05/11.');
    assert.equal(textoUnida('2026-11-02', '2026-11-13'), 'Ya estaba en Configuración → Licencias, del 02/11 al 13/11.');
    assert.equal(textoSigueEnConfiguracion('2026-11-03', '2026-11-03'),
      'Sigue en Configuración del 03/11 al 03/11: ya empezó y no se pudo anular.');
    assert.equal(TEXTO_TAMBIEN_EN_CONFIGURACION, 'También en Configuración → Licencias.');
    assert.equal(TEXTO_NO_SE_COPIA, 'Administración la cambió en Configuración: lo que corrijas acá ya no se copia.');
    assert.equal(TEXTO_ANULADA_POR_ADMINISTRACION, 'Administración la anuló en Configuración: queda solo acá.');
    assert.equal(TEXTO_NO_DIA_ENTERO, 'No es el día entero: no pasa a Configuración');
  });
});

describe('las mitades y el vencimiento', () => {
  it('mitadesDe: con un número impar, la primera es la mayor', () => {
    assert.deepEqual(mitadesDe(15), [8, 7]);
    assert.deepEqual(mitadesDe(25), [13, 12]);
    assert.deepEqual(mitadesDe(20), [10, 10]);
    assert.deepEqual(mitadesDe(30), [15, 15]);
  });

  it('habilitaciones: el 1/7 del año y el 1/1 del siguiente', () => {
    assert.deepEqual(habilitaciones(2026), ['2026-07-01', '2027-01-01']);
  });

  it('venceLaLicencia: el 31/12 de dos años después', () => {
    assert.equal(venceLaLicencia(2024), '2026-12-31');
    assert.equal(venceLaLicencia(2025), '2027-12-31');
  });

  it('anioVigente: la fila del año o la del anterior más cercano', () => {
    const anios = [{ anio: 2025, dias_vacaciones: 15, estudios: 'secundario' }];
    assert.deepEqual(anioVigente(anios, 2027), { anio: 2025, dias_vacaciones: 15, estudios: 'secundario' });
    assert.deepEqual(anioVigente(anios, 2025), { anio: 2025, dias_vacaciones: 15, estudios: 'secundario' });
    assert.equal(anioVigente(anios, 2024), null);
    assert.equal(anioVigente([], 2026), null);
    const dos = [...anios, { anio: 2026, dias_vacaciones: 20, estudios: null }];
    assert.deepEqual(anioVigente(dos, 2027), { anio: 2026, dias_vacaciones: 20, estudios: null });
  });
});

describe('las licencias ordinarias', () => {
  it('PLANTA: del año del arranque − 2 al de hoy + 1; las anteriores al arranque, de su saldo', () => {
    assert.deepEqual(ordinariasDe(PLANTA.estado, HOY), [
      { anio: 2024, total: 8, mitades: [{ dias: 8, habilita: '2026-10-26' }], vence: '2026-12-31', desde_saldo: true },
      { anio: 2025, total: 20, mitades: [{ dias: 20, habilita: '2026-10-26' }], vence: '2027-12-31', desde_saldo: true },
      {
        anio: 2026, total: 20, mitades: [{ dias: 10, habilita: '2026-10-26' }, { dias: 10, habilita: '2027-01-01' }],
        vence: '2028-12-31', desde_saldo: true
      },
      {
        anio: 2027, total: 20, mitades: [{ dias: 10, habilita: '2027-07-01' }, { dias: 10, habilita: '2028-01-01' }],
        vence: '2029-12-31', desde_saldo: false
      }
    ]);
  });

  it('sin arranque no hay ninguna', () => {
    assert.deepEqual(ordinariasDe({ ...PLANTA.estado, arranque: null }, HOY), []);
  });

  it('la licencia 2026 de 20 días habilita 10 el 1/7/2026 y 10 el 1/1/2027', () => {
    const estado = soloVacaciones('2026-01-02', {});
    const julio = repartoDeVacaciones(estado, { hoy: '2026-07-01', feriados: SIN_FERIADOS });
    assert.equal(ordinaria(julio, 2026).habilitado, 10);
    assert.equal(ordinaria(julio, 2026).por_habilitar, 10);
    const enero = repartoDeVacaciones(estado, { hoy: '2027-01-01', feriados: SIN_FERIADOS });
    assert.equal(ordinaria(enero, 2026).habilitado, 20);
    assert.equal(ordinaria(enero, 2026).por_habilitar, 0);
  });

  it('el arranque con la primera mitad habilitada: la del año empieza con su saldo', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    const delAnio = ordinaria(reparto, 2026);
    assert.equal(delAnio.habilitado, 10);
    assert.equal(delAnio.por_habilitar, 10);
    assert.equal(delAnio.desde_saldo, true);

    // Con el arranque antes del 1/7, la del año no tiene saldo: se arma con mitadesDe(20)
    const marzo = ordinariasDe({ ...PLANTA.estado, arranque: '2026-03-02' }, HOY).find((o) => o.anio === 2026);
    assert.deepEqual(marzo, {
      anio: 2026, total: 20, mitades: [{ dias: 10, habilita: '2026-07-01' }, { dias: 10, habilita: '2027-01-01' }],
      vence: '2028-12-31', desde_saldo: false
    });
  });
});

describe('diasQueDescuentan', () => {
  it('de lunes a lunes son 6 días hábiles', () => {
    assert.deepEqual(diasQueDescuentan(vacaciones(100, '2026-10-26', '2026-11-02'), PLANTA.estado, SIN_FERIADOS),
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02']);
  });

  it('antes del arranque no descuenta', () => {
    assert.deepEqual(diasQueDescuentan(vacaciones(100, '2026-10-21', '2026-10-23'), PLANTA.estado, SIN_FERIADOS), []);
  });

  it('una que cruza el arranque descuenta desde el arranque, ese día incluido', () => {
    assert.deepEqual(diasQueDescuentan(vacaciones(100, '2026-10-22', '2026-10-27'), PLANTA.estado, SIN_FERIADOS),
      ['2026-10-26', '2026-10-27']);
  });

  it('solo los tipos con saldo inicial se cortan en el arranque', () => {
    const el = (tipo, estado) => diasQueDescuentan({ id: 100, tipo, desde: '2026-10-23', hasta: '2026-10-23', horas: 7 },
      estado, SIN_FERIADOS);
    for (const tipo of ['vacaciones', 'franquicia', 'estudios', 'medica', 'familiar']) assert.deepEqual(el(tipo, PLANTA.estado), []);
    for (const tipo of ['franco', 'medica_extraordinaria', 'uso_autorizado']) {
      assert.deepEqual(el(tipo, PLANTA.estado), ['2026-10-23'], tipo);
    }
    assert.deepEqual(el('horas_a_favor', CONTRATO.estado), ['2026-10-23']);
    // En contrato, el uso autorizado sale del saldo inicial de horas no utilizadas
    assert.deepEqual(el('uso_autorizado', CONTRATO.estado), []);
  });

  it('los feriados no descuentan', () => {
    assert.deepEqual(diasQueDescuentan(vacaciones(100, '2026-11-06', '2026-11-10'), PLANTA.estado, new Set(['2026-11-09'])),
      ['2026-11-06', '2026-11-10']);
  });
});

describe('el reparto de las vacaciones', () => {
  it('solo días habilitados', () => {
    const mayo = vacaciones(100, '2026-05-11', '2026-05-15');
    const julio = vacaciones(101, '2026-07-06', '2026-07-10');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-01-02', { 2024: 0, 2025: 0 }, mayo, julio),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.sinCubrir.get(100), ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15']);
    assert.deepEqual(reparto.porFila.get(100), []);
    // El 09/07 es feriado fijo: son 4 días hábiles, de la 2026
    assert.deepEqual(reparto.porFila.get(101), [{ anio: 2026, dias: 4 }]);
    assert.equal(reparto.sinCubrir.has(101), false);
  });

  it('la más vieja, día por día', () => {
    const junio = vacaciones(100, '2026-06-10', '2026-06-16');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-01-02', { 2025: 3 }, junio), { hoy: HOY, feriados: SIN_FERIADOS });
    // El 10, el 11 y el 12 salen de la 2025; la primera mitad de la 2026 se habilita el 1/7
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2025, dias: 3 }]);
    assert.deepEqual(reparto.sinCubrir.get(100), ['2026-06-15', '2026-06-16']);
  });

  it('PLANTA: las vacaciones de noviembre salen de la 2024', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(6), [{ anio: 2024, dias: 5 }]);
    assert.equal(reparto.sinCubrir.size, 0);
    assert.deepEqual(aHoy(reparto), [
      { anio: 2024, habilitado: 8, por_habilitar: 0, usados: 0, cargados: 5, disponibles: 3 },
      { anio: 2025, habilitado: 20, por_habilitar: 0, usados: 0, cargados: 0, disponibles: 20 },
      { anio: 2026, habilitado: 10, por_habilitar: 10, usados: 0, cargados: 0, disponibles: 10 },
      { anio: 2027, habilitado: 0, por_habilitar: 20, usados: 0, cargados: 0, disponibles: 0 }
    ]);
    assert.equal(textoDelReparto(reparto, 6), 'Salen de la licencia 2024, la más vieja. Te quedan 33 días: 3 de la 2024 '
      + '(vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.');
  });

  it('usados y cargados se separan por hoy', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: '2026-11-05', feriados: SIN_FERIADOS });
    const vieja = ordinaria(reparto, 2024);
    assert.equal(vieja.usados, 3);
    assert.equal(vieja.cargados, 2);
    assert.equal(vieja.disponibles, 3);
  });

  it('los feriados en el medio', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: new Set(['2026-11-09']) });
    assert.deepEqual(reparto.porFila.get(6), [{ anio: 2024, dias: 4 }]);
    assert.equal(disponibles(reparto), 34);
  });

  it('una carga que cruza un vencimiento: el 01/01 es feriado fijo y la 2024 vence el 31/12', () => {
    const fiestas = vacaciones(100, '2026-12-30', '2027-01-05');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 3, 2025: 0, 2026: 10 }, fiestas),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 2 }, { anio: 2026, dias: 2 }]);
  });

  it('lo cargado a futuro de la mitad que todavía no se habilitó sale de lo que falta habilitar', () => {
    // 12 días hábiles en enero de 2027: los 10 del saldo de la 2026 y 2 de su segunda mitad, que se habilita el 1/1/2027
    const enero = vacaciones(100, '2027-01-04', '2027-01-19');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 10 }, enero),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2026, dias: 12 }]);
    assert.deepEqual(aHoy(reparto).find((o) => o.anio === 2026),
      { anio: 2026, habilitado: 10, por_habilitar: 8, usados: 0, cargados: 12, disponibles: 0 });
  });

  it('una licencia vencida no tiene disponibles', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: '2027-01-04', feriados: SIN_FERIADOS });
    assert.equal(ordinaria(reparto, 2024).disponibles, 0);
    assert.equal(ordinaria(reparto, 2026).disponibles, 20);
  });
});

describe('textoDelReparto', () => {
  const textoDe = (estado, fila, feriados = SIN_FERIADOS) =>
    textoDelReparto(repartoDeVacaciones(conLicencias(estado, fila), { hoy: HOY, feriados }), fila.id);

  it('CONTRATO: 5 días hábiles desde el 03/11/2026 salen de la 2025', () => {
    assert.equal(textoDe(CONTRATO.estado, vacaciones(100, '2026-11-03', '2026-11-09')),
      'Salen de la licencia 2025, la más vieja. Te quedan 8 días, todos de la 2026.');
  });

  it('de varias licencias, con los días de cada una', () => {
    // Las de PLANTA son de la 2024; estas, 3 de la 2024 y 2 de la 2025
    assert.equal(textoDe(PLANTA.estado, vacaciones(100, '2026-11-10', '2026-11-16')),
      'Salen de las licencias 2024 (3 días) y 2025 (2 días), las más viejas. Te quedan 28 días: 18 de la 2025 y 10 de la 2026.');
    assert.equal(textoDe(CONTRATO.estado, vacaciones(100, '2026-11-03', '2026-11-19')),
      'Salen de las licencias 2025 (5 días) y 2026 (8 días), las más viejas. No te quedan días disponibles.');
  });

  it('con un solo día en la que vence este año, «vence»', () => {
    // Las de PLANTA dejan 3 de la 2024: estas usan 2
    assert.equal(textoDe(PLANTA.estado, vacaciones(100, '2026-11-10', '2026-11-11')),
      'Salen de la licencia 2024, la más vieja. Te quedan 31 días: 1 de la 2024 (vence el 31/12/2026), 20 de la 2025 y 10 '
      + 'de la 2026.');
  });

  it('con una sola licencia que vence este año', () => {
    const estado = soloVacaciones('2026-10-26', { 2024: 8, 2025: 0, 2026: 0 });
    assert.equal(textoDe(estado, vacaciones(100, '2026-11-03', '2026-11-09')),
      'Salen de la licencia 2024, la más vieja. Te quedan 3 días, todos de la 2024 (vencen el 31/12/2026).');
    const unoSolo = soloVacaciones('2026-10-26', { 2024: 6, 2025: 0, 2026: 0 });
    assert.equal(textoDe(unoSolo, vacaciones(100, '2026-11-03', '2026-11-09')),
      'Salen de la licencia 2024, la más vieja. Te queda 1 día de la 2024 (vence el 31/12/2026).');
  });

  it('el id se busca como número: el de un pedido llega como texto', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    assert.equal(textoDelReparto(reparto, '6'), textoDelReparto(reparto, 6));
    assert.notEqual(textoDelReparto(reparto, '6'), '');
    // Una fila con el id como texto queda con su id como número
    const conTexto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 8, 2025: 0, 2026: 0 },
      vacaciones('100', '2026-11-03', '2026-11-09'), vacaciones('101', '2026-11-10', '2026-11-16')),
    { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(conTexto.porFila.get(100), [{ anio: 2024, dias: 5 }]);
    assert.deepEqual(conTexto.porFila.get(101), [{ anio: 2024, dias: 3 }]);
    assert.deepEqual(conTexto.sinCubrir.get(101), ['2026-11-13', '2026-11-16']);
    assert.equal(conTexto.porFila.has('100'), false);
  });

  it('sin días que salgan de una licencia, no hay texto', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    assert.equal(textoDelReparto(reparto, 999), '');
    assert.equal(textoDe(PLANTA.estado, vacaciones(100, '2026-10-21', '2026-10-23')), '');
  });
});

describe('el rango de fechas y el día entero', () => {
  it('rangoDeFechas: del 01/01 de dos años antes al 31/12 del año siguiente', () => {
    assert.deepEqual(rangoDeFechas('2026-10-26'), { desde: '2024-01-01', hasta: '2027-12-31' });
    assert.deepEqual(rangoDeFechas('2027-01-01'), { desde: '2025-01-01', hasta: '2028-12-31' });
    for (const hoy of [null, undefined, '', '2026-02-30', 20261026]) assert.equal(rangoDeFechas(hoy), null);
  });

  it('esDiaEntero: los de días enteros, y los de horas con 7', () => {
    for (const tipo of ['vacaciones', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco']) {
      assert.equal(esDiaEntero({ tipo, horas: null }), true, tipo);
    }
    assert.equal(esDiaEntero({ tipo: 'franquicia', horas: 7 }), true);
    assert.equal(esDiaEntero({ tipo: 'franquicia', horas: 3 }), false);
    assert.equal(esDiaEntero({ tipo: 'horas_a_favor', horas: 7 }), true);
    assert.equal(esDiaEntero({ tipo: 'horas_a_favor', horas: 6.5 }), false);
    assert.equal(esDiaEntero({ tipo: 'uso_autorizado', horas: 7 }), true);
    // El DECIMAL llega de la base como texto
    assert.equal(esDiaEntero({ tipo: 'franquicia', horas: '7.0' }), true);
    assert.equal(esDiaEntero({ tipo: 'franquicia', horas: null }), false);
    // Un tipo que no es de Mi espacio nunca es día entero
    assert.equal(esDiaEntero({ tipo: 'otro', horas: 7 }), false);
    for (const raro of [null, undefined, 'franco', 7, []]) assert.equal(esDiaEntero(raro), false);
  });
});

describe('los topes', () => {
  // Una licencia más (las de los casos tienen ids del 1 al 6: las de los tests, desde el 100)
  const licencia = (tipo, desde, hasta, horas = null) => ({ id: 100, tipo, desde, hasta, horas });
  const usoDe = (topes, tipo, anio) => topes.find((tope) => tope.tipo === tipo && tope.anio === anio);

  it('topeDe: el de cada tipo, y el de estudios, según la carrera del año', () => {
    assert.equal(topeDe('franquicia', 2026, PLANTA.estado.anios), 42);
    assert.equal(topeDe('medica', 2026, PLANTA.estado.anios), 25);
    assert.equal(topeDe('familiar', 2026, PLANTA.estado.anios), 25);
    assert.equal(topeDe('estudios', 2026, PLANTA.estado.anios), 15);
    assert.equal(topeDe('estudios', 2026, CONTRATO.estado.anios), 10);
    // El año siguiente hereda la carrera; uno sin ningún año cargado, o con «No estudio», no tiene
    assert.equal(topeDe('estudios', 2027, PLANTA.estado.anios), 15);
    assert.equal(topeDe('estudios', 2025, PLANTA.estado.anios), null);
    assert.equal(topeDe('estudios', 2026, [{ anio: 2026, dias_vacaciones: 20, estudios: null }]), null);
    assert.equal(topeDe('medica_extraordinaria', 2026, PLANTA.estado.anios), null);
    for (const tipo of ['vacaciones', 'franco', 'otro', 'toString', '__proto__', null]) {
      assert.equal(topeDe(tipo, 2026, PLANTA.estado.anios), null);
    }
  });

  it('PLANTA: lo de antes del arranque no suma, el saldo inicial sí', () => {
    assert.deepEqual(usoDeLosTopes(PLANTA.estado, { feriados: SIN_FERIADOS }), [
      { tipo: 'franquicia', anio: 2026, usados: 17, tope: 42 },
      { tipo: 'estudios', anio: 2026, usados: 6, tope: 15 },
      { tipo: 'medica', anio: 2026, usados: 3, tope: 25 },
      { tipo: 'familiar', anio: 2026, usados: 2, tope: 25 }
    ]);
  });

  it('las franquicias se cuentan en horas', () => {
    const estado = conLicencias(PLANTA.estado, licencia('franquicia', '2026-11-10', '2026-11-10', 3),
      { ...licencia('franquicia', '2026-11-11', '2026-11-11', '2.0'), id: 101 });
    assert.equal(usoDe(usoDeLosTopes(estado, { feriados: SIN_FERIADOS }), 'franquicia', 2026).usados, 22);
  });

  it('cruza el año: cada día en el suyo', () => {
    const estado = { ...PLANTA.estado, saldos: [], licencias: [licencia('medica', '2026-12-28', '2027-01-05')] };
    // El 01/01 es feriado fijo, y el 02 y el 03, fin de semana
    assert.deepEqual(usoDeLosTopes(estado, { feriados: SIN_FERIADOS }), [
      { tipo: 'medica', anio: 2026, usados: 4, tope: 25 },
      { tipo: 'medica', anio: 2027, usados: 2, tope: 25 }
    ]);
  });

  it('cruza el arranque: solo cuentan los días desde el arranque', () => {
    const estado = conLicencias(PLANTA.estado, licencia('medica', '2026-10-23', '2026-10-28'));
    // El 23/10 es anterior al arranque: suma el 26, el 27 y el 28 a los 3 del saldo
    assert.equal(usoDe(usoDeLosTopes(estado, { feriados: SIN_FERIADOS }), 'medica', 2026).usados, 6);
  });

  it('la extraordinaria se cuenta, sin tope; los feriados no cuentan', () => {
    const estado = conLicencias(PLANTA.estado, licencia('medica_extraordinaria', '2026-11-16', '2026-11-20'));
    assert.deepEqual(usoDe(usoDeLosTopes(estado, { feriados: new Set(['2026-11-18']) }), 'medica_extraordinaria', 2026),
      { tipo: 'medica_extraordinaria', anio: 2026, usados: 4, tope: null });
  });

  it('el tope de estudios es el de la carrera de cada año', () => {
    const estado = {
      ...CONTRATO.estado,
      anios: [...CONTRATO.estado.anios, { anio: 2027, dias_vacaciones: 15, estudios: 'universitario' }],
      licencias: [licencia('estudios', '2027-03-01', '2027-03-02')]
    };
    assert.deepEqual(usoDeLosTopes(estado, { feriados: SIN_FERIADOS }).filter((tope) => tope.tipo === 'estudios'), [
      { tipo: 'estudios', anio: 2026, usados: 3, tope: 10 },
      { tipo: 'estudios', anio: 2027, usados: 2, tope: 15 }
    ]);
  });
});

describe('validarLicencia', () => {
  const validar = (entrada, contexto = {}) =>
    validarLicencia(entrada, { hoy: HOY, estado: PLANTA.estado, feriados: SIN_FERIADOS, ...contexto });
  const enContrato = (entrada, contexto = {}) => validar(entrada, { estado: CONTRATO.estado, ...contexto });
  const errorDe = (resultado) => resultado.error;
  const sinErrores = (resultado) => {
    assert.equal(resultado.error, null);
    return resultado.datos;
  };

  it('una carga que sirve: los datos, con la nota recortada', () => {
    assert.deepEqual(validar({ tipo: 'franquicia', desde: '2026-11-10', hasta: '2026-11-10', horas: 3, nota: '  Trámite  ' }),
      {
        datos: { tipo: 'franquicia', desde: '2026-11-10', hasta: '2026-11-10', horas: 3, mostrar: 1, nota: 'Trámite' },
        error: null
      });
    assert.deepEqual(sinErrores(validar({ tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-20', horas: 4, nota: '   ' })),
      { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-20', horas: null, mostrar: 1, nota: null });
  });

  it('el tipo: el de la modalidad, y el uso autorizado solo desde su formulario', () => {
    const tipo = { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo };
    assert.deepEqual(errorDe(enContrato({ tipo: 'franquicia', desde: '2026-11-10', horas: 3 })), tipo);
    assert.deepEqual(errorDe(validar({ tipo: 'horas_a_favor', desde: '2026-11-10', horas: 3 })), tipo);
    for (const otro of [undefined, null, '', 'otro', 'toString', '__proto__', 3]) {
      assert.deepEqual(errorDe(validar({ tipo: otro, desde: '2026-11-10', hasta: '2026-11-10' })), tipo);
    }
    assert.deepEqual(errorDe(validar({ tipo: 'uso_autorizado', desde: '2026-11-10' })), tipo);
    assert.deepEqual(errorDe(validar({ tipo: 'uso_autorizado', desde: '2026-11-10' }, { uso_autorizado: 'true' })), tipo);
    assert.equal(errorDe(validar({ tipo: 'uso_autorizado', desde: '2026-11-10' }, { uso_autorizado: true })), null);
    // Sin modalidad no hay ningún tipo
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-10', hasta: '2026-11-10' },
      { estado: { ...PLANTA.estado, modalidad: null } })), tipo);
  });

  it('las fechas: el formato, el rango, el orden y los de un día', () => {
    const fecha = MENSAJES_MI_ESPACIO.fecha;
    const rango = textoRango('2024-01-01', '2027-12-31');
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-02-30', hasta: '2026-11-10' })),
      { campo: 'desde', mensaje: fecha });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-10' })), { campo: 'hasta', mensaje: fecha });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-10', hasta: '10/11/2026' })),
      { campo: 'hasta', mensaje: fecha });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2023-12-31', hasta: '2024-01-02' })),
      { campo: 'desde', mensaje: rango });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2027-12-31', hasta: '2028-01-03' })),
      { campo: 'hasta', mensaje: rango });
    assert.equal(errorDe(validar({ tipo: 'medica', desde: '2024-01-02', hasta: '2024-01-02' })), null);
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-12', hasta: '2026-11-10' })),
      { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.hastaAntes });
    // Los de un día: sin hasta, el mismo día; con otro, unDia
    assert.equal(sinErrores(validar({ tipo: 'franco', desde: '2026-11-10', hasta: '' })).hasta, '2026-11-10');
    assert.equal(sinErrores(validar({ tipo: 'franco', desde: '2026-11-10' })).hasta, '2026-11-10');
    assert.deepEqual(errorDe(validar({ tipo: 'franco', desde: '2026-11-10', hasta: '2026-11-11' })),
      { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.unDia });
    assert.deepEqual(errorDe(enContrato({ tipo: 'horas_a_favor', desde: '2026-11-10', hasta: '2026-11-12', horas: 2 })),
      { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.unDia });
    // Sin un hoy válido no hay rango: ninguna fecha pasa
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-10', hasta: '2026-11-10' }, { hoy: null })),
      { campo: 'desde', mensaje: fecha });
  });

  it('los días hábiles: sinDiasHabiles, o diaNoHabil en los de un día', () => {
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-10-31', hasta: '2026-11-01' })),
      { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.sinDiasHabiles });
    assert.deepEqual(errorDe(validar({ tipo: 'franquicia', desde: '2026-10-31', horas: 2 })),
      { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.diaNoHabil });
    // Un feriado de la tabla tampoco es hábil
    assert.deepEqual(errorDe(validar({ tipo: 'franquicia', desde: '2026-11-10', horas: 2 },
      { feriados: new Set(['2026-11-10']) })), { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.diaNoHabil });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-23', hasta: '2026-11-23' },
      { feriados: new Set(['2026-11-23']) })), { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.sinDiasHabiles });
  });

  it('las horas: franquicias enteras, de a media hora en contrato, 7 en el uso autorizado de planta', () => {
    const enteras = { campo: 'horas', mensaje: MENSAJES_MI_ESPACIO.horasEnteras };
    const medias = { campo: 'horas', mensaje: MENSAJES_MI_ESPACIO.horasMedias };
    const franquicia = (horas) => validar({ tipo: 'franquicia', desde: '2026-11-10', horas });
    const aFavor = (horas) => enContrato({ tipo: 'horas_a_favor', desde: '2026-11-10', horas });
    for (const horas of [2.5, 8, 0, -1, undefined, null, '', 'x', true, [3], { horas: 3 }]) {
      assert.deepEqual(errorDe(franquicia(horas)), enteras, String(horas));
    }
    assert.equal(sinErrores(franquicia(1)).horas, 1);
    assert.equal(sinErrores(franquicia('7')).horas, 7);
    for (const horas of [2.25, 7.5, 0, 0.25, undefined, null, '', 'x', false, [2]]) {
      assert.deepEqual(errorDe(aFavor(horas)), medias, String(horas));
    }
    assert.equal(sinErrores(aFavor(0.5)).horas, 0.5);
    assert.equal(sinErrores(aFavor('2.5')).horas, 2.5);
    assert.equal(sinErrores(aFavor(7)).horas, 7);
    const usoEnContrato = (horas) =>
      enContrato({ tipo: 'uso_autorizado', desde: '2026-11-10', horas }, { uso_autorizado: true });
    assert.deepEqual(errorDe(usoEnContrato(7.5)), medias);
    assert.equal(sinErrores(usoEnContrato(3.5)).horas, 3.5);
    // En planta un uso autorizado es un franco entero: siempre 7, llegue lo que llegue
    for (const horas of [undefined, null, 3, 'x']) {
      assert.equal(sinErrores(validar({ tipo: 'uso_autorizado', desde: '2026-11-10', horas }, { uso_autorizado: true }))
        .horas, 7);
    }
    // Los de días enteros no llevan horas
    assert.equal(sinErrores(validar({ tipo: 'franco', desde: '2026-11-10', horas: 3 })).horas, null);
  });

  it('la nota: hasta 200 caracteres, contados de a uno', () => {
    const nota = (texto) => validar({ tipo: 'franco', desde: '2026-11-10', nota: texto });
    assert.deepEqual(errorDe(nota('a'.repeat(201))), { campo: 'nota', mensaje: MENSAJES_MI_ESPACIO.nota });
    assert.equal(sinErrores(nota('a'.repeat(200))).nota, 'a'.repeat(200));
    // 200 emojis son 400 unidades de UTF-16, pero 200 caracteres
    assert.equal(sinErrores(nota('😀'.repeat(200))).nota, '😀'.repeat(200));
    assert.deepEqual(errorDe(nota('😀'.repeat(201))), { campo: 'nota', mensaje: MENSAJES_MI_ESPACIO.nota });
    // Se cuenta recortada; vacía, o lo que no es un texto, es null
    assert.equal(sinErrores(nota(` ${'a'.repeat(200)} `)).nota, 'a'.repeat(200));
    for (const vacia of [undefined, null, '', '   ', 5, {}]) assert.equal(sinErrores(nota(vacia)).nota, null);
  });

  it('mostrar es 1 salvo con false, 0 o «0»', () => {
    const mostrar = (valor) => sinErrores(validar({ tipo: 'franco', desde: '2026-11-10', mostrar: valor })).mostrar;
    for (const valor of [false, 0, '0']) assert.equal(mostrar(valor), 0, String(valor));
    for (const valor of [undefined, null, true, 1, '1', 'no', '']) assert.equal(mostrar(valor), 1, String(valor));
  });

  it('dos licencias no comparten un día, salvo la que se corrige', () => {
    const superpuesta = { campo: 'desde', mensaje: 'Ya tenés una licencia cargada el 05/11/2026: corregí la que ya está.' };
    const franquicia = { tipo: 'franquicia', desde: '2026-11-05', horas: 2 };
    assert.deepEqual(errorDe(validar(franquicia)), superpuesta);
    assert.equal(errorDe(validar(franquicia, { editadaId: 6 })), null);
    assert.equal(errorDe(validar(franquicia, { editadaId: '6' })), null);
    assert.deepEqual(errorDe(validar(franquicia, { editadaId: 5 })), superpuesta);
    // Con la primera fecha en común: el franco del 23/10, antes que las vacaciones del 03/11
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-10-20', hasta: '2026-11-04' })),
      { campo: 'desde', mensaje: textoSuperpuesta('2026-10-23') });
    assert.deepEqual(errorDe(validar({ tipo: 'medica', desde: '2026-11-09', hasta: '2026-11-13' })),
      { campo: 'desde', mensaje: textoSuperpuesta('2026-11-09') });
    // Pegadas no se superponen
    assert.equal(errorDe(validar({ tipo: 'medica', desde: '2026-11-10', hasta: '2026-11-13' })), null);
  });

  it('estudios: de 1 a 3 días hábiles, y solo en un año en que estudia', () => {
    assert.equal(errorDe(validar({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-18' })), null);
    assert.deepEqual(errorDe(validar({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-19' })),
      { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.porExamen });
    // Del viernes al martes: 3 días hábiles
    assert.equal(errorDe(validar({ tipo: 'estudios', desde: '2026-11-13', hasta: '2026-11-17' })), null);
    const noEstudia = { ...PLANTA.estado, anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }] };
    assert.deepEqual(errorDe(validar({ tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17' }, { estado: noEstudia })),
      { campo: 'tipo', mensaje: textoNoEstudia(2026) });
    // Lo anterior al arranque queda como historia: se carga aunque ese año no tenga la carrera elegida
    assert.equal(errorDe(validar({ tipo: 'estudios', desde: '2025-11-10', hasta: '2025-11-11' })), null);
  });

  it('el orden de los controles', () => {
    // El tipo antes que las fechas, las fechas antes que las horas, las horas antes que la nota y la superposición
    assert.equal(errorDe(enContrato({ tipo: 'franquicia', desde: 'x', horas: 9 })).campo, 'tipo');
    assert.equal(errorDe(validar({ tipo: 'franquicia', desde: 'x', horas: 9 })).campo, 'desde');
    assert.equal(errorDe(validar({ tipo: 'franquicia', desde: '2026-10-31', horas: 9 })).mensaje,
      MENSAJES_MI_ESPACIO.diaNoHabil);
    assert.equal(errorDe(validar({ tipo: 'franquicia', desde: '2026-11-05', horas: 9, nota: 'a'.repeat(201) })).campo,
      'horas');
    assert.equal(errorDe(validar({ tipo: 'franquicia', desde: '2026-11-05', horas: 2, nota: 'a'.repeat(201) })).campo,
      'nota');
    // La superposición antes que los de estudios
    assert.deepEqual(errorDe(validar({ tipo: 'estudios', desde: '2026-11-05', hasta: '2026-11-11' })),
      { campo: 'desde', mensaje: textoSuperpuesta('2026-11-05') });
  });
});

// Unas horas extras y un uso (las de los casos tienen ids del 1 al 13: las de los tests, desde el 100)
const extra = (id, fecha, desde, hasta) => ({ id, fecha, desde, hasta });
const uso = (id, tipo, fecha, horas = null) => ({ id, tipo, desde: fecha, hasta: fecha, horas });

// Un estado solo con horas extras y sus usos, con el arranque de los casos
const conHoras = (modalidad, horasExtras, licencias = [], cambios = {}) => ({
  modalidad, arranque: HOY, anios: [], saldos: [], licencias, horasExtras, ...cambios
});

// Las horas extras de los ejemplos del usuario: 10,5 en octubre, 7,5 en noviembre y 6,5 en diciembre de 2026
const EJEMPLOS_DEL_USUARIO = [
  extra(100, '2026-10-06', '18:00', '21:30'), extra(101, '2026-10-14', '17:00', '21:00'),
  extra(102, '2026-10-22', '19:00', '22:00'),
  extra(103, '2026-11-05', '18:00', '22:00'), extra(104, '2026-11-12', '18:00', '21:30'),
  extra(105, '2026-12-03', '18:00', '22:00'), extra(106, '2026-12-10', '18:00', '20:30')
];

const delMes = (meses, mesTrabajado) => meses.find((mes) => mes.mes_trabajado === mesTrabajado);
const A_HOY = { hoy: HOY, feriados: SIN_FERIADOS };

describe('las horas extras', () => {
  it('horasDe: de a media hora; si pasa la medianoche, +24 h', () => {
    assert.equal(horasDe('19:00', '22:00'), 3);
    assert.equal(horasDe('18:00', '21:30'), 3.5);
    assert.equal(horasDe('22:00', '01:30'), 3.5);
    assert.equal(horasDe('23:30', '00:00'), 0.5);
    assert.equal(horasDe('00:00', '23:30'), 23.5);
    assert.equal(horasDe('10:15', '11:00'), null);
    assert.equal(horasDe('10:00', '10:15'), null);
    assert.equal(horasDe('10:00', '10:00'), null);
    // Lo que no es 'HH:MM' de un día: el TIME de la base se corta antes
    for (const [desde, hasta] of [['9:00', '10:00'], ['24:00', '01:00'], ['19:00:00', '22:00:00'], [null, '10:00'],
      ['10:00', undefined], [1900, 2200]]) {
      assert.equal(horasDe(desde, hasta), null, `${desde} ${hasta}`);
    }
  });

  it('mesMas: suma meses sobre el índice año × 12 + mes', () => {
    assert.equal(mesMas('2026-10', 2), '2026-12');
    assert.equal(mesMas('2026-11', 2), '2027-01');
    assert.equal(mesMas('2026-12', 1), '2027-01');
    assert.equal(mesMas('2027-01', -2), '2026-11');
    assert.equal(mesMas('2026-10', 0), '2026-10');
    assert.equal(mesMas('2026-10', 24), '2028-10');
    for (const [mes, n] of [['2026-13', 1], ['2026-1', 1], ['2026-10-01', 1], [null, 1], ['2026-10', 1.5], ['2026-10', '1'],
      ['2026-10', NaN], ['9999-12', 1], ['0001-01', -1]]) {
      assert.equal(mesMas(mes, n), null, `${mes} ${n}`);
    }
  });

  it('horasPorMes: cada fila en el mes de su fecha, también si pasa la medianoche', () => {
    assert.deepEqual([...horasPorMes(PLANTA.estado.horasExtras)],
      [['2026-06', 7], ['2026-07', 5], ['2026-08', 14], ['2026-09', 7.5], ['2026-10', 10.5]]);
    // El 31/10 de 22:00 a 01:30 cuenta entero en octubre
    assert.deepEqual([...horasPorMes([extra(100, '2026-10-31', '22:00', '01:30'), extra(101, '2026-11-02', '18:00', '19:00')])],
      [['2026-10', 3.5], ['2026-11', 1]]);
    // Las filas que no sirven no suman
    assert.deepEqual([...horasPorMes([null, 3, {}, extra(100, '2026-02-30', '18:00', '19:00'),
      extra(101, '2026-10-05', '10:15', '11:00'), extra(102, '2026-10-06', '18:00', '19:00')])], [['2026-10', 1]]);
    assert.deepEqual([...horasPorMes(null)], []);
  });
});

describe('validarHorasExtras', () => {
  const validar = (entrada, contexto = {}) => validarHorasExtras(entrada, { hoy: HOY, estado: PLANTA.estado, ...contexto });
  const errorDe = (resultado) => resultado.error;

  it('cualquier día vale: un sábado y un feriado', () => {
    assert.deepEqual(validar({ fecha: '2026-10-31', desde: '19:00', hasta: '22:00' }),
      { datos: { fecha: '2026-10-31', desde: '19:00', hasta: '22:00', nota: null }, error: null });
    assert.equal(errorDe(validar({ fecha: '2026-12-25', desde: '09:00', hasta: '13:00' })), null);
    // Y pasar la medianoche
    assert.equal(errorDe(validar({ fecha: '2026-10-31', desde: '22:00', hasta: '01:30' })), null);
  });

  it('la fecha: el formato y el rango', () => {
    const fecha = { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.fecha };
    for (const mala of [undefined, '', '2026-02-30', '31/10/2026']) {
      assert.deepEqual(errorDe(validar({ fecha: mala, desde: '19:00', hasta: '22:00' })), fecha);
    }
    assert.deepEqual(errorDe(validar({ fecha: '2023-12-31', desde: '19:00', hasta: '22:00' })),
      { campo: 'fecha', mensaje: textoRango('2024-01-01', '2027-12-31') });
    assert.deepEqual(errorDe(validar({ fecha: '2028-01-01', desde: '19:00', hasta: '22:00' })),
      { campo: 'fecha', mensaje: textoRango('2024-01-01', '2027-12-31') });
    // Sin un hoy válido no pasa ninguna fecha
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-31', desde: '19:00', hasta: '22:00' }, { hoy: null })), fecha);
  });

  it('el horario, de a media hora, en desde', () => {
    const horario = { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.horario };
    assert.deepEqual(errorDe(validar({ fecha: '2026-11-03', desde: '10:15', hasta: '11:00' })), horario);
    assert.deepEqual(errorDe(validar({ fecha: '2026-11-03', desde: '10:00', hasta: '10:00' })), horario);
    assert.deepEqual(errorDe(validar({ fecha: '2026-11-03', desde: '10:00' })), horario);
    assert.deepEqual(errorDe(validar({ fecha: '2026-11-03', desde: '10:00:00', hasta: '11:00:00' })), horario);
  });

  it('la nota: recortada, de hasta 200 caracteres contados con Array.from', () => {
    const nota = { campo: 'nota', mensaje: MENSAJES_MI_ESPACIO.nota };
    assert.deepEqual(errorDe(validar({ fecha: '2026-11-03', desde: '18:00', hasta: '20:00', nota: 'x'.repeat(201) })), nota);
    assert.equal(validar({ fecha: '2026-11-03', desde: '18:00', hasta: '20:00', nota: '\u{1F600}'.repeat(200) }).datos.nota,
      '\u{1F600}'.repeat(200));
    assert.equal(validar({ fecha: '2026-11-03', desde: '18:00', hasta: '20:00', nota: '  Cierre de mes  ' }).datos.nota,
      'Cierre de mes');
    assert.equal(validar({ fecha: '2026-11-03', desde: '18:00', hasta: '20:00', nota: '   ' }).datos.nota, null);
  });

  it('no se superpone con otra del mismo día', () => {
    // PLANTA tiene el 22/10 de 19:00 a 22:00
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00' })),
      { campo: 'desde', mensaje: 'Se superpone con las horas extras de 19:00 a 22:00 de ese día.' });
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-22', desde: '21:30', hasta: '01:00' })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('19:00', '22:00') });
    // Pegadas no se superponen, y la que se corrige no cuenta (con el id como número o como texto)
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '22:00', hasta: '23:00' })), null);
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '17:00', hasta: '19:00' })), null);
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00' }, { editadaId: 13 })), null);
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00' }, { editadaId: '13' })), null);
    // Otro día no cuenta
    assert.equal(errorDe(validar({ fecha: '2026-10-23', desde: '20:00', hasta: '21:00' })), null);
  });

  it('una que pasa la medianoche ocupa hasta el día siguiente de su fecha', () => {
    const estado = conHoras('planta', [extra(100, '2026-10-23', '22:00', '01:30')]);
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-23', desde: '23:00', hasta: '23:30' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('22:00', '01:30') });
    // A la 01:00 del mismo día todavía no empezó
    assert.equal(errorDe(validar({ fecha: '2026-10-23', desde: '01:00', hasta: '02:00' }, { estado })), null);
  });

  it('con dos que se superponen, la que empieza primero', () => {
    const estado = conHoras('planta', [extra(101, '2026-10-23', '20:00', '22:00'), extra(100, '2026-10-23', '18:00', '19:00')]);
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-23', desde: '18:30', hasta: '21:00' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('18:00', '19:00') });
  });

  it('el orden: la fecha, el horario, la nota y la superposición', () => {
    assert.equal(errorDe(validar({ fecha: 'x', desde: '10:15', nota: 'x'.repeat(201) })).campo, 'fecha');
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '10:15', nota: 'x'.repeat(201) })).campo, 'desde');
    assert.equal(errorDe(validar({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00', nota: 'x'.repeat(201) })).campo,
      'nota');
  });
});

describe('los francos compensatorios (planta)', () => {
  it('los ejemplos del usuario', () => {
    const francos = francosDe(conHoras('planta', EJEMPLOS_DEL_USUARIO), A_HOY);
    assert.deepEqual(francos.map(({ mes_trabajado, horas, francos: cuantos, mes_de_uso }) =>
      ({ mes_trabajado, horas, francos: cuantos, mes_de_uso })), [
      { mes_trabajado: '2026-10', horas: 10.5, francos: 1, mes_de_uso: '2026-12' },
      { mes_trabajado: '2026-11', horas: 7.5, francos: 1, mes_de_uso: '2027-01' },
      { mes_trabajado: '2026-12', horas: 6.5, francos: 0, mes_de_uso: '2027-02' }
    ]);
  });

  it('PLANTA a hoy', () => {
    const francos = francosDe(PLANTA.estado, A_HOY);
    assert.deepEqual(francos.map((mes) => mes.mes_trabajado), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    // El franco del 23/10 es anterior al arranque y cuenta igual: los francos no tienen saldo inicial
    assert.deepEqual(delMes(francos, '2026-08'), {
      mes_trabajado: '2026-08', horas: 14, francos: 2, mes_de_uso: '2026-10', usos: [{ id: 5, fecha: '2026-10-23' }],
      disponibles: 1, no_utilizados: 0, ultimo_dia_habil: '2026-10-30', termino: false
    });
    assert.deepEqual(delMes(francos, '2026-06'), {
      mes_trabajado: '2026-06', horas: 7, francos: 1, mes_de_uso: '2026-08', usos: [], disponibles: 0, no_utilizados: 1,
      ultimo_dia_habil: '2026-08-31', termino: true
    });
    assert.equal(delMes(francos, '2026-07').francos, 0);
    assert.equal(delMes(francos, '2026-07').no_utilizados, 0);
    // Los que todavía no empezaron: disponibles para su mes
    assert.deepEqual(delMes(francos, '2026-09'), {
      mes_trabajado: '2026-09', horas: 7.5, francos: 1, mes_de_uso: '2026-11', usos: [], disponibles: 1, no_utilizados: 0,
      ultimo_dia_habil: '2026-11-30', termino: false
    });
    assert.equal(delMes(francos, '2026-10').ultimo_dia_habil, '2026-12-31');
  });

  it('con los feriados: el último día hábil, y un franco que cae en un feriado nuevo no se usó', () => {
    const conFeriado = francosDe(PLANTA.estado, { hoy: HOY, feriados: new Set(['2026-10-30']) });
    assert.equal(delMes(conFeriado, '2026-08').ultimo_dia_habil, '2026-10-29');
    const sobreElFranco = francosDe(PLANTA.estado, { hoy: HOY, feriados: new Set(['2026-10-23']) });
    assert.deepEqual(delMes(sobreElFranco, '2026-08').usos, []);
    assert.equal(delMes(sobreElFranco, '2026-08').disponibles, 2);
  });

  it('un franco en un mes sin francos también va, para que se vea que sobra', () => {
    const francos = francosDe(conLicencias(PLANTA.estado, uso(100, 'franco', '2027-02-01')), A_HOY);
    assert.deepEqual(delMes(francos, '2026-12'), {
      mes_trabajado: '2026-12', horas: 0, francos: 0, mes_de_uso: '2027-02', usos: [{ id: 100, fecha: '2027-02-01' }],
      disponibles: 0, no_utilizados: 0, ultimo_dia_habil: '2027-02-26', termino: false
    });
  });

  it('más usos que francos: ninguno disponible', () => {
    const estado = conLicencias(PLANTA.estado, uso(101, 'franco', '2026-10-28'), uso(100, 'franco', '2026-10-27'));
    const agosto = delMes(francosDe(estado, A_HOY), '2026-08');
    assert.deepEqual(agosto.usos, [
      { id: 5, fecha: '2026-10-23' }, { id: 100, fecha: '2026-10-27' }, { id: 101, fecha: '2026-10-28' }
    ]);
    assert.equal(agosto.disponibles, 0);
  });

  it('solo en planta, y solo las filas franco', () => {
    assert.deepEqual(francosDe(CONTRATO.estado, A_HOY), []);
    assert.deepEqual(francosDe({ ...PLANTA.estado, modalidad: null }, A_HOY), []);
    // Unas horas a favor (de cuando era de contrato) no son francos
    const estado = conLicencias(PLANTA.estado, uso(100, 'horas_a_favor', '2026-10-27', 7));
    assert.deepEqual(francosDe(estado, A_HOY), francosDe(PLANTA.estado, A_HOY));
    // Sin un hoy válido no se sabe qué mes terminó
    assert.deepEqual(francosDe(PLANTA.estado, { feriados: SIN_FERIADOS }), []);
  });
});

describe('las horas a favor (contrato)', () => {
  it('los ejemplos del usuario', () => {
    const usos = [uso(100, 'horas_a_favor', '2026-11-03', 7), uso(101, 'horas_a_favor', '2026-11-10', 2),
      uso(102, 'horas_a_favor', '2026-11-17', 1.5)];
    const horas = horasAFavorDe(conHoras('contrato', EJEMPLOS_DEL_USUARIO, usos), A_HOY);
    assert.deepEqual(horas.map(({ mes_trabajado, horas: extras, mes_de_uso, a_favor, usadas, disponibles }) =>
      ({ mes_trabajado, horas: extras, mes_de_uso, a_favor, usadas, disponibles })), [
      { mes_trabajado: '2026-10', horas: 10.5, mes_de_uso: '2026-11', a_favor: 10.5, usadas: 10.5, disponibles: 0 },
      { mes_trabajado: '2026-11', horas: 7.5, mes_de_uso: '2026-12', a_favor: 7.5, usadas: 0, disponibles: 7.5 },
      { mes_trabajado: '2026-12', horas: 6.5, mes_de_uso: '2027-01', a_favor: 6.5, usadas: 0, disponibles: 6.5 }
    ]);
    assert.deepEqual(horas[0].usos, [
      { id: 100, fecha: '2026-11-03', horas: 7 }, { id: 101, fecha: '2026-11-10', horas: 2 },
      { id: 102, fecha: '2026-11-17', horas: 1.5 }
    ]);
  });

  it('CONTRATO a hoy', () => {
    assert.deepEqual(horasAFavorDe(CONTRATO.estado, A_HOY), [
      {
        mes_trabajado: '2026-09', horas: 10.5, mes_de_uso: '2026-10', a_favor: 10.5,
        usos: [{ id: 1, fecha: '2026-10-09', horas: 7 }, { id: 3, fecha: '2026-10-20', horas: 2 }], usadas: 9,
        disponibles: 1.5, no_utilizadas: 0, antes_del_arranque: false, ultimo_dia_habil: '2026-10-30', termino: false
      },
      {
        mes_trabajado: '2026-10', horas: 4, mes_de_uso: '2026-11', a_favor: 4, usos: [], usadas: 0, disponibles: 4,
        no_utilizadas: 0, antes_del_arranque: false, ultimo_dia_habil: '2026-11-30', termino: false
      }
    ]);
  });

  it('las horas del DECIMAL llegan como texto', () => {
    const estado = {
      ...CONTRATO.estado,
      licencias: CONTRATO.estado.licencias.map((fila) => (fila.horas === null ? fila : { ...fila, horas: fila.horas.toFixed(1) }))
    };
    assert.equal(delMes(horasAFavorDe(estado, A_HOY), '2026-09').usadas, 9);
  });

  it('cuando termina el mes, lo que queda pasa a no utilizado', () => {
    const septiembre = delMes(horasAFavorDe(CONTRATO.estado, { hoy: '2026-11-02', feriados: SIN_FERIADOS }), '2026-09');
    assert.equal(septiembre.termino, true);
    assert.equal(septiembre.disponibles, 0);
    assert.equal(septiembre.no_utilizadas, 1.5);
  });

  it('antes del arranque: el mes de uso terminó antes, y lo que quedó ya está en el saldo inicial', () => {
    const estado = conLicencias({
      ...CONTRATO.estado, horasExtras: [...CONTRATO.estado.horasExtras, extra(100, '2026-08-20', '18:00', '21:00')]
    }, uso(100, 'horas_a_favor', '2026-09-15', 1.5));
    const horas = horasAFavorDe(estado, A_HOY);
    assert.deepEqual(delMes(horas, '2026-08'), {
      mes_trabajado: '2026-08', horas: 3, mes_de_uso: '2026-09', a_favor: 3, usos: [{ id: 100, fecha: '2026-09-15', horas: 1.5 }],
      usadas: 1.5, disponibles: 0, no_utilizadas: 1.5, antes_del_arranque: true, ultimo_dia_habil: '2026-09-30', termino: true
    });
    // Octubre, el mes del arranque, no
    assert.equal(delMes(horas, '2026-09').antes_del_arranque, false);
  });

  it('solo en contrato, y solo las filas horas_a_favor', () => {
    assert.deepEqual(horasAFavorDe(PLANTA.estado, A_HOY), []);
    const estado = conLicencias(CONTRATO.estado, uso(100, 'franco', '2026-10-27'));
    assert.deepEqual(horasAFavorDe(estado, A_HOY), horasAFavorDe(CONTRATO.estado, A_HOY));
    assert.deepEqual(horasAFavorDe(CONTRATO.estado, { feriados: SIN_FERIADOS }), []);
  });
});

describe('lo no utilizado previamente', () => {
  // Un estado de contrato con el arranque del 02/03/2026 y el saldo de horas no utilizadas de 2026
  const contratoDesdeMarzo = (saldo, horasExtras, licencias = []) => conHoras('contrato', horasExtras, licencias, {
    arranque: '2026-03-02', saldos: [{ concepto: 'horas_no_utilizadas', anio: 2026, cantidad: saldo }]
  });
  // 3 horas extras en mayo: 3 a favor en junio, que nadie usó
  const MAYO = extra(100, '2026-05-12', '18:00', '21:00');

  it('PLANTA: el franco de junio, sin usar en agosto', () => {
    assert.deepEqual(noUtilizadasDe(PLANTA.estado, 2026, A_HOY), {
      anio: 2026, unidad: 'francos', saldo: { cantidad: 0, quedan: 0 },
      meses: [{ mes_de_uso: '2026-08', mes_trabajado: '2026-06', cantidad: 1, quedan: 1, antes_del_arranque: false }],
      usos: [], quedan: 1
    });
  });

  it('CONTRATO: el saldo inicial, solo en el año del arranque', () => {
    assert.deepEqual(noUtilizadasDe(CONTRATO.estado, 2026, A_HOY), {
      anio: 2026, unidad: 'horas', saldo: { cantidad: 6.5, quedan: 6.5 }, meses: [], usos: [], quedan: 6.5
    });
    assert.deepEqual(noUtilizadasDe(CONTRATO.estado, 2027, A_HOY).saldo, { cantidad: 0, quedan: 0 });
  });

  it('vuelve a cero el 1/1: lo de diciembre sin usar en enero es de 2027', () => {
    const estado = conHoras('contrato', [extra(100, '2026-12-10', '18:00', '21:00')]);
    const enFebrero = { hoy: '2027-02-15', feriados: SIN_FERIADOS };
    assert.deepEqual(noUtilizadasDe(estado, 2026, enFebrero).meses, []);
    assert.equal(noUtilizadasDe(estado, 2026, enFebrero).quedan, 0);
    assert.deepEqual(noUtilizadasDe(estado, 2027, enFebrero).meses,
      [{ mes_de_uso: '2027-01', mes_trabajado: '2026-12', cantidad: 3, quedan: 3, antes_del_arranque: false }]);
    assert.equal(noUtilizadasDe(estado, 2027, enFebrero).quedan, 3);
    // Mientras enero no termina, todavía no es no utilizado
    assert.deepEqual(noUtilizadasDe(estado, 2027, { hoy: '2027-01-29', feriados: SIN_FERIADOS }).meses, []);
  });

  it('antes del arranque: septiembre no suma, el saldo sí', () => {
    const estado = conLicencias({
      ...CONTRATO.estado, horasExtras: [...CONTRATO.estado.horasExtras, extra(100, '2026-08-20', '18:00', '21:00')]
    }, uso(100, 'horas_a_favor', '2026-09-15', 1.5));
    const resultado = noUtilizadasDe(estado, 2026, A_HOY);
    assert.deepEqual(resultado.meses,
      [{ mes_de_uso: '2026-09', mes_trabajado: '2026-08', cantidad: 1.5, quedan: 0, antes_del_arranque: true }]);
    assert.deepEqual(resultado.saldo, { cantidad: 6.5, quedan: 6.5 });
    assert.equal(resultado.quedan, 6.5);
    assert.equal(noUtilizadasDe(CONTRATO.estado, 2026, A_HOY).quedan, 6.5);
  });

  it('el uso autorizado, más viejas primero: primero el saldo y después los meses', () => {
    assert.deepEqual(noUtilizadasDe(contratoDesdeMarzo(1, [MAYO]), 2026, A_HOY), {
      anio: 2026, unidad: 'horas', saldo: { cantidad: 1, quedan: 1 },
      meses: [{ mes_de_uso: '2026-06', mes_trabajado: '2026-05', cantidad: 3, quedan: 3, antes_del_arranque: false }],
      usos: [], quedan: 4
    });
    const conUso = contratoDesdeMarzo(1, [MAYO], [uso(200, 'uso_autorizado', '2026-10-27', 2)]);
    assert.deepEqual(noUtilizadasDe(conUso, 2026, A_HOY), {
      anio: 2026, unidad: 'horas', saldo: { cantidad: 1, quedan: 0 },
      meses: [{ mes_de_uso: '2026-06', mes_trabajado: '2026-05', cantidad: 3, quedan: 2, antes_del_arranque: false }],
      usos: [{ id: 200, fecha: '2026-10-27', cantidad: 2 }], quedan: 2
    });
  });

  it('de los meses, también el más viejo primero', () => {
    const estado = contratoDesdeMarzo(1, [extra(101, '2026-03-10', '18:00', '20:00'), MAYO],
      [uso(200, 'uso_autorizado', '2026-10-27', 4)]);
    const resultado = noUtilizadasDe(estado, 2026, A_HOY);
    assert.deepEqual(resultado.meses.map(({ mes_de_uso, cantidad, quedan }) => ({ mes_de_uso, cantidad, quedan })),
      [{ mes_de_uso: '2026-04', cantidad: 2, quedan: 0 }, { mes_de_uso: '2026-06', cantidad: 3, quedan: 2 }]);
    assert.equal(resultado.saldo.quedan, 0);
    assert.equal(resultado.quedan, 2);
  });

  it('con más usos que lo que había, no queda nada (nunca negativo); el DECIMAL llega como texto', () => {
    const estado = contratoDesdeMarzo('1.0', [MAYO], [uso(200, 'uso_autorizado', '2026-10-27', '5.0')]);
    const resultado = noUtilizadasDe(estado, 2026, A_HOY);
    assert.deepEqual(resultado.saldo, { cantidad: 1, quedan: 0 });
    assert.equal(resultado.meses[0].quedan, 0);
    assert.deepEqual(resultado.usos, [{ id: 200, fecha: '2026-10-27', cantidad: 5 }]);
    assert.equal(resultado.quedan, 0);
  });

  it('en contrato, un uso anterior al arranque no descuenta (ya está en el saldo); uno de otro año, tampoco', () => {
    const antes = contratoDesdeMarzo(1, [MAYO], [uso(200, 'uso_autorizado', '2026-02-10', 2)]);
    assert.deepEqual(noUtilizadasDe(antes, 2026, A_HOY).usos, []);
    assert.equal(noUtilizadasDe(antes, 2026, A_HOY).quedan, 4);
    const otroAnio = contratoDesdeMarzo(1, [MAYO], [uso(200, 'uso_autorizado', '2027-01-05', 2)]);
    assert.equal(noUtilizadasDe(otroAnio, 2026, A_HOY).quedan, 4);
    assert.deepEqual(noUtilizadasDe(otroAnio, 2027, A_HOY).usos, [{ id: 200, fecha: '2027-01-05', cantidad: 2 }]);
  });

  it('uso autorizado en planta: un franco, también antes del arranque', () => {
    const conUso = conLicencias(PLANTA.estado, uso(100, 'uso_autorizado', '2026-10-26', 7));
    assert.deepEqual(noUtilizadasDe(conUso, 2026, A_HOY), {
      anio: 2026, unidad: 'francos', saldo: { cantidad: 0, quedan: 0 },
      meses: [{ mes_de_uso: '2026-08', mes_trabajado: '2026-06', cantidad: 1, quedan: 0, antes_del_arranque: false }],
      usos: [{ id: 100, fecha: '2026-10-26', cantidad: 1 }], quedan: 0
    });
    // Planta no tiene saldo de francos: un uso de antes del arranque también descuenta
    const antes = conLicencias(PLANTA.estado, uso(100, 'uso_autorizado', '2026-09-01', 7));
    assert.equal(noUtilizadasDe(antes, 2026, A_HOY).quedan, 0);
  });

  it('las filas de otra modalidad no cuentan', () => {
    // CONTRATO que pasó a planta: sus horas a favor y su saldo de horas no cuentan; sus horas extras dan francos
    const aPlanta = { ...CONTRATO.estado, modalidad: 'planta' };
    assert.deepEqual(noUtilizadasDe(aPlanta, 2026, A_HOY), {
      anio: 2026, unidad: 'francos', saldo: { cantidad: 0, quedan: 0 }, meses: [], usos: [], quedan: 0
    });
    assert.deepEqual(francosDe(aPlanta, A_HOY).map((mes) => [mes.mes_trabajado, mes.francos, mes.usos.length]),
      [['2026-09', 1, 0], ['2026-10', 0, 0]]);
    // PLANTA que pasó a contrato: su franco no es un uso de horas a favor
    const aContrato = { ...PLANTA.estado, modalidad: 'contrato' };
    assert.deepEqual(horasAFavorDe(aContrato, A_HOY).flatMap((mes) => mes.usos), []);
  });

  it('sin modalidad, sin un año o sin un hoy válidos, nada', () => {
    const vacio = (anio, unidad) => ({ anio, unidad, saldo: { cantidad: 0, quedan: 0 }, meses: [], usos: [], quedan: 0 });
    assert.deepEqual(noUtilizadasDe({ ...CONTRATO.estado, modalidad: null }, 2026, A_HOY), vacio(2026, null));
    assert.deepEqual(noUtilizadasDe(CONTRATO.estado, 'x', A_HOY), vacio(null, 'horas'));
    assert.deepEqual(noUtilizadasDe(CONTRATO.estado, 2026, { feriados: SIN_FERIADOS }), vacio(2026, 'horas'));
    // Un año como texto de cuatro cifras sirve
    assert.equal(noUtilizadasDe(CONTRATO.estado, '2026', A_HOY).quedan, 6.5);
  });
});

describe('nada tira', () => {
  const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];

  it('las demás licencias, los topes y la validación con entradas raras', () => {
    assert.deepEqual(validarLicencia(null, { hoy: HOY, estado: PLANTA.estado, feriados: SIN_FERIADOS }),
      { datos: null, error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo } });
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        rangoDeFechas(valor);
        esDiaEntero(valor);
        topeDe(valor, valor, valor);
        topeDe('estudios', valor, valor);
        usoDeLosTopes(valor, valor);
        usoDeLosTopes(PLANTA.estado, valor);
        usoDeLosTopes({ arranque: HOY, anios: valor, saldos: [valor], licencias: [valor, { tipo: 'medica', desde: valor }] });
        validarLicencia(valor, valor);
        validarLicencia({ tipo: 'medica', desde: '2026-11-10', hasta: '2026-11-10' },
          { hoy: HOY, estado: { modalidad: 'planta', anios: valor, licencias: [valor, { id: valor, desde: valor }] } });
        validarLicencia({ tipo: 'franquicia', desde: '2026-11-10', horas: valor, nota: valor, mostrar: valor },
          { hoy: HOY, estado: PLANTA.estado, feriados: valor, editadaId: valor });
      });
      assert.equal(validarLicencia(valor, valor).error.campo, 'tipo');
    }
    assert.deepEqual(usoDeLosTopes(null), []);
  });

  it('un estado vacío, null o con listas que no son listas', () => {
    for (const estado of [...raros, { arranque: HOY, anios: 'x', saldos: null, licencias: [null, 3, {}], horasExtras: 5 }]) {
      assert.doesNotThrow(() => {
        ordinariasDe(estado, HOY);
        const reparto = repartoDeVacaciones(estado, { hoy: HOY, feriados: SIN_FERIADOS });
        textoDelReparto(reparto, 1);
        diasQueDescuentan(vacaciones(1, '2026-11-03', '2026-11-09'), estado, SIN_FERIADOS);
      });
    }
    assert.deepEqual(ordinariasDe(null, HOY), []);
    const vacio = repartoDeVacaciones(null);
    assert.deepEqual(vacio.ordinarias, []);
    assert.equal(vacio.porFila.size, 0);
    assert.equal(vacio.sinCubrir.size, 0);
    assert.equal(textoDelReparto(null, 1), '');
    assert.equal(textoDelReparto({}, 1), '');
  });

  it('fechas que no son fechas', () => {
    for (const fecha of raros) {
      assert.deepEqual(ordinariasDe(PLANTA.estado, fecha), []);
      assert.deepEqual(diasQueDescuentan(vacaciones(1, fecha, '2026-11-09'), PLANTA.estado, SIN_FERIADOS), []);
      assert.deepEqual(ordinariasDe({ ...PLANTA.estado, arranque: fecha }, HOY), []);
      assert.doesNotThrow(() => repartoDeVacaciones(PLANTA.estado, { hoy: fecha, feriados: SIN_FERIADOS }));
      assert.doesNotThrow(() => repartoDeVacaciones(conLicencias(PLANTA.estado, vacaciones(100, fecha, fecha)),
        { hoy: HOY, feriados: SIN_FERIADOS }));
    }
    // Hasta antes que desde: ningún día
    assert.deepEqual(diasQueDescuentan(vacaciones(1, '2026-11-09', '2026-11-03'), PLANTA.estado, SIN_FERIADOS), []);
  });

  it('un tipo desconocido no descuenta nada', () => {
    for (const tipo of ['otro', null, undefined, 'toString', '__proto__']) {
      assert.deepEqual(diasQueDescuentan({ id: 1, tipo, desde: '2026-11-03', hasta: '2026-11-09' }, PLANTA.estado, SIN_FERIADOS),
        []);
    }
    assert.deepEqual(diasQueDescuentan(null, PLANTA.estado, SIN_FERIADOS), []);
  });

  it('las mitades, las habilitaciones, el vencimiento y el año vigente con entradas raras', () => {
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        mitadesDe(valor);
        habilitaciones(valor);
        venceLaLicencia(valor);
        anioVigente(valor, 2026);
        anioVigente([valor], valor);
      });
    }
    assert.deepEqual(mitadesDe(null), [0, 0]);
    assert.deepEqual(mitadesDe(-3), [0, 0]);
    assert.deepEqual(mitadesDe(2.5), [0, 0]);
    assert.equal(habilitaciones('x'), null);
    assert.equal(venceLaLicencia(null), null);
    assert.equal(anioVigente(null, 2026), null);
  });

  it('los textos con entradas raras', () => {
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        textoRango(valor, valor);
        textoNoEstudia(valor);
        textoSuperpuesta(valor);
        textoSinHabilitados(valor);
        textoTope(valor, valor, valor);
        textoSinFranco(valor);
        textoSinHorasAFavor(valor, valor);
        textoSinNoUtilizadas(valor, valor, valor);
        textoHorarioSuperpuesto(valor, valor);
        textoSaldo(valor);
        textoAutorizadaSinDias(valor, valor);
        textoSuperpuestaConConfiguracion(valor, valor);
        textoNoPaso(valor);
        textoYaNoCubierta(valor, valor);
        textoEnConfiguracion(valor, valor);
        textoUnida(valor, valor);
        textoSigueEnConfiguracion(valor, valor);
      });
    }
    assert.equal(textoSuperpuesta(null), 'Ya tenés una licencia cargada el —: corregí la que ya está.');
  });

  it('el año vigente y el saldo de vacaciones, con un objeto sin prototipo o un Symbol', () => {
    for (const valor of [Object.create(null), Symbol('x')]) {
      assert.doesNotThrow(() => {
        anioVigente([{ anio: valor, dias_vacaciones: valor, estudios: valor }], 2026);
        anioVigente([{ anio: 2026, dias_vacaciones: valor }], 2026);
        ordinariasDe({
          ...PLANTA.estado, anios: [{ anio: 2026, dias_vacaciones: valor }],
          saldos: [{ concepto: 'vacaciones', anio: valor, cantidad: 3 }, { concepto: 'vacaciones', anio: 2024, cantidad: valor }]
        }, HOY);
      }, typeof valor);
    }
    // Un año que no es un número no cuenta, y unos días que no son un número son 0
    assert.equal(anioVigente([{ anio: Object.create(null), dias_vacaciones: 20 }], 2026), null);
    assert.deepEqual(anioVigente([{ anio: 2026, dias_vacaciones: Object.create(null), estudios: null }], 2026),
      { anio: 2026, dias_vacaciones: 0, estudios: null });
    // Los de la base pueden llegar como texto
    assert.deepEqual(anioVigente([{ anio: '2025', dias_vacaciones: '15', estudios: 'secundario' }], 2026),
      { anio: 2025, dias_vacaciones: 15, estudios: 'secundario' });
    assert.equal(ordinariasDe({ ...PLANTA.estado, saldos: [{ concepto: 'vacaciones', anio: '2024', cantidad: '8.0' }] }, HOY)
      .find((o) => o.anio === 2024).total, 8);
  });

  it('las horas extras, los francos, las horas a favor y lo no utilizado con entradas raras', () => {
    for (const valor of [...raros, Object.create(null), Symbol('x')]) {
      assert.doesNotThrow(() => {
        horasDe(valor, valor);
        horasDe('19:00', valor);
        mesMas(valor, valor);
        mesMas('2026-10', valor);
        horasPorMes(valor);
        horasPorMes([valor, { fecha: valor, desde: valor, hasta: valor }, { fecha: '2026-10-22', desde: valor, hasta: '22:00' }]);
        validarHorasExtras(valor, valor);
        validarHorasExtras({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00', nota: valor },
          { hoy: HOY, estado: valor, editadaId: valor });
        validarHorasExtras({ fecha: '2026-10-22', desde: '20:00', hasta: '21:00' }, {
          hoy: HOY,
          estado: { horasExtras: [valor, { id: valor, fecha: '2026-10-22', desde: valor, hasta: valor }] }
        });
        for (const modalidad of ['planta', 'contrato']) {
          for (const arranque of [HOY, valor]) {
            const estado = {
              modalidad, arranque,
              saldos: [valor, { concepto: 'horas_no_utilizadas', anio: valor, cantidad: 1 },
                { concepto: 'horas_no_utilizadas', anio: 2026, cantidad: valor }],
              licencias: [
                valor, { id: valor, tipo: 'franco', desde: valor, hasta: valor },
                { id: valor, tipo: 'franco', desde: '2026-10-27', hasta: '2026-10-27' },
                { id: 1, tipo: 'horas_a_favor', desde: '2026-10-27', hasta: '2026-10-27', horas: valor },
                { id: 2, tipo: 'uso_autorizado', desde: '2026-10-28', hasta: '2026-10-28', horas: valor }
              ],
              horasExtras: [valor, { id: valor, fecha: '2026-08-04', desde: '18:00', hasta: '22:00' }]
            };
            francosDe(estado, { hoy: HOY, feriados: valor });
            horasAFavorDe(estado, { hoy: HOY, feriados: valor });
            noUtilizadasDe(estado, 2026, { hoy: HOY, feriados: valor });
            noUtilizadasDe(estado, valor, valor);
            francosDe({ ...estado, horasExtras: valor }, { hoy: valor });
          }
        }
        francosDe(valor, valor);
        horasAFavorDe(valor, valor);
        noUtilizadasDe(valor, valor, valor);
      }, typeof valor);
    }
    assert.deepEqual(francosDe(null), []);
    assert.deepEqual(horasAFavorDe(undefined), []);
    assert.equal(validarHorasExtras(null, null).error.campo, 'fecha');
  });
});
