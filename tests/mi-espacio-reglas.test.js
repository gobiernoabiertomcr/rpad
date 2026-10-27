// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 2, 3.1 y 4): las constantes, los textos y las reglas
// de las vacaciones (las dos mitades, el vencimiento y la licencia más vieja primero), contadas en días hábiles con los
// feriados y desde el arranque. Puras, sin base, sobre los casos de tests/fixtures/mi-espacio-casos.js.
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
  textoDelReparto
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
      'Salen de la licencia 2024, la más vieja. Te queda 1 día, de la 2024 (vence el 31/12/2026).');
  });

  it('sin días que salgan de una licencia, no hay texto', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    assert.equal(textoDelReparto(reparto, 999), '');
    assert.equal(textoDe(PLANTA.estado, vacaciones(100, '2026-10-21', '2026-10-23')), '');
  });
});

describe('nada tira', () => {
  const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];

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
});
