// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 2, 3.1 a 3.10 y 4): las constantes, los textos,
// las reglas de las vacaciones (las dos mitades, el vencimiento y la licencia más vieja primero), lo que suma cada licencia
// contra su tope del año, la validación de una carga, y las horas extras con los francos compensatorios (planta), las horas
// a favor (contrato) y lo no utilizado previamente, contadas en días hábiles con los feriados y desde el arranque. Después,
// «Mis vacaciones y saldos» (los campos del saldo inicial y el año), el cálculo completo, los faltantes y lo que frena una
// carga. Al final, el paso a Configuración y «Hoy no están» (sección 7). Puras, sin base, sobre los casos de
// tests/fixtures/mi-espacio-casos.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODALIDADES, modalidadDe, TEXTO_MODALIDAD, TIPOS_LICENCIA, TIPOS_POR_MODALIDAD, NOMBRES_TIPO, DIAS_VACACIONES,
  DIAS_ESTUDIOS, DIAS_POR_EXAMEN, TOPES, JORNADA, LARGO_NOTA, MENSAJES_MI_ESPACIO,
  textoRango, textoNoEstudia, textoSuperpuesta, textoSinHabilitados, textoTope, textoSinFranco, textoSinHorasAFavor,
  textoSinNoUtilizadas, textoHorarioSuperpuesto, textoSaldo, textoAutorizadaDelFirmante,
  AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN, AVISO_NOTAS_DE_HOY, AVISO_SIN_PERSONA_A_CARGO,
  textoSuperpuestaConConfiguracion, textoNoPaso, textoYaNoCubierta, textoEnConfiguracion, textoUnida,
  textoSigueEnConfiguracion, TEXTO_TAMBIEN_EN_CONFIGURACION, TEXTO_NO_SE_COPIA, TEXTO_ANULADA_POR_ADMINISTRACION,
  TEXTO_NO_DIA_ENTERO,
  mitadesDe, habilitaciones, venceLaLicencia, textoDeLasMitades, anioVigente, ordinariasDe, diasQueDescuentan, repartoDeVacaciones,
  textoDelReparto, rangoDeFechas, esDiaEntero, topeDe, usoDeLosTopes, validarLicencia,
  horasDe, mesMas, horasPorMes, validarHorasExtras, francosDe, horasAFavorDe, noUtilizadasDe,
  TEXTO_ANTES_DEL_ARRANQUE, camposDelSaldoInicial, validarSaldoInicial, validarAnio, fueraDeLaModalidad, calcular,
  faltantesDe, problemaDeLaCarga, evaluarLicencia,
  vinculoDe, textoDelVinculo, limiteParaCambiarTipo, pasoDeLaCarga, pasoDeLaCorreccion, pasoDeLaBaja, vinculosDeLaLista,
  pasoPrevistoDe, ausenciasUnidas, textoNoEsta, textoDeLaVuelta, ausentesDelRango, ausentesDeHoyYManana, avisosDeVencimiento
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
    assert.equal(textoHorarioSuperpuesto('22:00', '02:00', 'anterior'),
      'Se superpone con las horas extras de 22:00 a 02:00 del día anterior.');
    assert.equal(textoHorarioSuperpuesto('01:00', '03:00', 'siguiente'),
      'Se superpone con las horas extras de 01:00 a 03:00 del día siguiente.');
    // Otro valor es el mismo día
    assert.equal(textoHorarioSuperpuesto('19:00', '22:00', 'x'), textoHorarioSuperpuesto('19:00', '22:00'));
    assert.equal(textoHorarioSuperpuesto('19:00', '22:00', 'toString'), textoHorarioSuperpuesto('19:00', '22:00'));
    assert.equal(textoSaldo(30), 'Escribí un número de 0 a 30.');
    // Decisión del usuario (27/10/2026): el aviso que no frena a la persona autorizada del firmante
    assert.equal(textoAutorizadaDelFirmante('2026-12-01', '2026-12-18'),
      'Sos la persona autorizada del firmante del 01/12/2026 al 18/12/2026: los días que no estés, no se presentan Notas '
      + 'Digitales.');
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

  it('textoDeLasMitades: las mitades de los días con las fechas de las habilitaciones, sin ceros', () => {
    assert.equal(textoDeLasMitades(2026, 20), 'Se habilitan en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; '
      + 'con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.');
    const comienzo = (anio, dias) => textoDeLasMitades(anio, dias).split(' (')[0];
    assert.equal(comienzo(2024, 15), 'Se habilitan en dos mitades: 8 el 1/7/2024 y 7 el 1/1/2025');
    assert.equal(comienzo(2027, 25), 'Se habilitan en dos mitades: 13 el 1/7/2027 y 12 el 1/1/2028');
    assert.equal(comienzo(2026, 10), 'Se habilitan en dos mitades: 5 el 1/7/2026 y 5 el 1/1/2027');
    assert.equal(comienzo(2026, 30), 'Se habilitan en dos mitades: 15 el 1/7/2026 y 15 el 1/1/2027');
    // El de la base o el de un pedido, como texto, también
    assert.equal(textoDeLasMitades('2026', '20'), textoDeLasMitades(2026, 20));
  });

  it('textoDeLasMitades: sin unos días de DIAS_VACACIONES o sin un año, null', () => {
    for (const dias of [undefined, null, 0, 12, 20.5, '', 'veinte', [20]]) {
      assert.equal(textoDeLasMitades(2026, dias), null, String(dias));
    }
    for (const anio of [undefined, null, 'abc', 2026.5, 0]) assert.equal(textoDeLasMitades(anio, 20), null, String(anio));
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

  // Decisión del usuario (27/10/2026): la hora de 01:00 a 02:00 no se cuenta dos veces
  it('se superpone con la del día anterior que pasa la medianoche', () => {
    const estado = conHoras('planta', [extra(100, '2026-10-26', '22:00', '02:00')]);
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-27', desde: '01:00', hasta: '03:00' }, { estado })),
      { campo: 'desde', mensaje: 'Se superpone con las horas extras de 22:00 a 02:00 del día anterior.' });
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-27', desde: '00:00', hasta: '00:30' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('22:00', '02:00', 'anterior') });
    // El borde: la del día anterior termina a las 02:00 y esta empieza a las 02:00
    assert.equal(errorDe(validar({ fecha: '2026-10-27', desde: '02:00', hasta: '03:00' }, { estado })), null);
    // La que se corrige no cuenta (con el id como número o como texto)
    assert.equal(errorDe(validar({ fecha: '2026-10-27', desde: '01:00', hasta: '03:00' }, { estado, editadaId: 100 })), null);
    assert.equal(errorDe(validar({ fecha: '2026-10-27', desde: '01:00', hasta: '03:00' }, { estado, editadaId: '100' })),
      null);
    // Una del día anterior que no pasa la medianoche, o de dos días antes, no cuenta
    const sinPasar = conHoras('planta', [extra(100, '2026-10-26', '20:00', '23:30'), extra(101, '2026-10-25', '22:00', '06:00')]);
    assert.equal(errorDe(validar({ fecha: '2026-10-27', desde: '00:00', hasta: '03:00' }, { estado: sinPasar })), null);
  });

  it('una que pasa la medianoche se superpone con el comienzo de la del día siguiente', () => {
    const estado = conHoras('planta', [extra(100, '2026-10-27', '01:00', '03:00')]);
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-26', desde: '22:00', hasta: '02:00' }, { estado })),
      { campo: 'desde', mensaje: 'Se superpone con las horas extras de 01:00 a 03:00 del día siguiente.' });
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-26', desde: '22:00', hasta: '02:00' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('01:00', '03:00', 'siguiente') });
    // El borde: esta termina a las 02:00 y la del día siguiente empieza a las 02:00
    const alBorde = conHoras('planta', [extra(100, '2026-10-27', '02:00', '03:00')]);
    assert.equal(errorDe(validar({ fecha: '2026-10-26', desde: '22:00', hasta: '02:00' }, { estado: alBorde })), null);
    // La que se corrige no cuenta
    assert.equal(errorDe(validar({ fecha: '2026-10-26', desde: '22:00', hasta: '02:00' }, { estado, editadaId: 100 })), null);
    // Sin pasar la medianoche, la del día siguiente no cuenta
    assert.equal(errorDe(validar({ fecha: '2026-10-26', desde: '20:00', hasta: '23:30' }, { estado })), null);
  });

  it('entre el día anterior, el mismo día y el siguiente, la que empieza primero', () => {
    const estado = conHoras('planta', [
      extra(102, '2026-10-28', '00:00', '01:00'), extra(101, '2026-10-27', '01:30', '02:30'),
      extra(100, '2026-10-26', '23:00', '02:00')
    ]);
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-27', desde: '01:00', hasta: '03:00' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('23:00', '02:00', 'anterior') });
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-27', desde: '22:00', hasta: '04:00' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('00:00', '01:00', 'siguiente') });
    // Y la del mismo día gana a la del siguiente
    assert.deepEqual(errorDe(validar({ fecha: '2026-10-27', desde: '02:00', hasta: '00:30' }, { estado })),
      { campo: 'desde', mensaje: textoHorarioSuperpuesto('01:30', '02:30') });
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

// Una licencia nueva (las de los casos tienen ids del 1 al 6: las de los tests, desde el 100)
const nueva = (tipo, desde, hasta = desde, horas = null) => ({ id: 100, tipo, desde, hasta, horas });

// El estado de un caso con el saldo inicial de un concepto (no de vacaciones) cambiado, en el año del arranque
const conSaldo = (estado, concepto, cantidad) => ({
  ...estado,
  saldos: [...estado.saldos.filter((saldo) => saldo.concepto !== concepto), { concepto, anio: 2026, cantidad }]
});

// Los saldos de «Para arrancar» de los dos casos, como los manda el modal
const SALDOS_PLANTA = {
  'vacaciones-2024': 8, 'vacaciones-2025': 20, 'vacaciones-2026': 10, franquicias: 17, estudios: 6, medica: 3, familiar: 2
};
const SALDOS_CONTRATO = {
  'vacaciones-2024': 0, 'vacaciones-2025': 5, 'vacaciones-2026': 8, estudios: 3, medica: 0, familiar: 3,
  horas_no_utilizadas: 6.5
};

describe('«Mis vacaciones y saldos»: los campos del saldo inicial', () => {
  it('PLANTA: las tres licencias, las franquicias, los estudios, la médica y el grupo familiar', () => {
    assert.deepEqual(camposDelSaldoInicial(PLANTA.estado), [
      {
        clave: 'vacaciones-2024', concepto: 'vacaciones', anio: 2024, rotulo: 'Sin usar de la licencia 2024', maximo: 30,
        paso: 1
      },
      { clave: 'vacaciones-2025', concepto: 'vacaciones', anio: 2025, rotulo: 'De la 2025', maximo: 30, paso: 1 },
      { clave: 'vacaciones-2026', concepto: 'vacaciones', anio: 2026, rotulo: 'De la 2026', maximo: 10, paso: 1 },
      { clave: 'franquicias', concepto: 'franquicias', anio: 2026, rotulo: 'Horas de franquicia', maximo: 42, paso: 1 },
      { clave: 'estudios', concepto: 'estudios', anio: 2026, rotulo: 'Días de estudios', maximo: 15, paso: 1 },
      { clave: 'medica', concepto: 'medica', anio: 2026, rotulo: 'Días de atención médica', maximo: 25, paso: 1 },
      { clave: 'familiar', concepto: 'familiar', anio: 2026, rotulo: 'Días de grupo familiar', maximo: 25, paso: 1 }
    ]);
  });

  it('con el arranque antes del 1/7, la licencia del año no va', () => {
    const claves = (arranque) => camposDelSaldoInicial({ ...PLANTA.estado, arranque }).map((campo) => campo.clave);
    assert.deepEqual(claves('2026-03-02'),
      ['vacaciones-2024', 'vacaciones-2025', 'franquicias', 'estudios', 'medica', 'familiar']);
    assert.equal(claves('2026-06-30').includes('vacaciones-2026'), false);
    // El 1/7 ya está habilitada la primera mitad
    assert.equal(claves('2026-07-01').includes('vacaciones-2026'), true);
  });

  it('en contrato, las horas no utilizadas de a media hora, y sin franquicias', () => {
    const campos = camposDelSaldoInicial(CONTRATO.estado);
    assert.deepEqual(campos.map((campo) => campo.clave), [
      'vacaciones-2024', 'vacaciones-2025', 'vacaciones-2026', 'estudios', 'medica', 'familiar', 'horas_no_utilizadas'
    ]);
    assert.deepEqual(campos.at(-1), {
      clave: 'horas_no_utilizadas', concepto: 'horas_no_utilizadas', anio: 2026, rotulo: 'Horas no utilizadas previamente',
      maximo: 200, paso: 0.5
    });
    // 15 días: la primera mitad es 8; y secundaria, 10 días de estudios
    assert.equal(campos.find((campo) => campo.clave === 'vacaciones-2026').maximo, 8);
    assert.equal(campos.find((campo) => campo.clave === 'estudios').maximo, 10);
  });

  it('con «No estudio», sin estudios', () => {
    const noEstudia = { ...PLANTA.estado, anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }] };
    assert.equal(camposDelSaldoInicial(noEstudia).some((campo) => campo.clave === 'estudios'), false);
  });

  it('el máximo de cada licencia: los días vigentes de ese año, o 30', () => {
    const anios = [{ anio: 2025, dias_vacaciones: 15, estudios: null }, { anio: 2026, dias_vacaciones: 25, estudios: null }];
    assert.deepEqual(camposDelSaldoInicial({ modalidad: 'planta', arranque: HOY, anios })
      .filter((campo) => campo.concepto === 'vacaciones').map(({ clave, maximo }) => [clave, maximo]),
    [['vacaciones-2024', 30], ['vacaciones-2025', 15], ['vacaciones-2026', 13]]);
    // Sin ningún año cargado, 30, y la primera mitad, 15
    assert.equal(camposDelSaldoInicial({ modalidad: 'planta', arranque: HOY, anios: [] })
      .find((campo) => campo.clave === 'vacaciones-2026').maximo, 15);
  });

  it('sin una modalidad o un arranque válidos, ninguno', () => {
    assert.deepEqual(camposDelSaldoInicial({ ...PLANTA.estado, modalidad: null }), []);
    assert.deepEqual(camposDelSaldoInicial({ ...PLANTA.estado, arranque: null }), []);
    assert.deepEqual(camposDelSaldoInicial(null), []);
  });
});

describe('validarSaldoInicial', () => {
  const CAMPOS = camposDelSaldoInicial(PLANTA.estado);
  const validar = (saldos, campos = CAMPOS) => validarSaldoInicial({ saldos }, campos);

  it('una fila por campo, en su orden', () => {
    assert.deepEqual(validar(SALDOS_PLANTA), { datos: PLANTA.estado.saldos, error: null });
    assert.deepEqual(validar(SALDOS_CONTRATO, camposDelSaldoInicial(CONTRATO.estado)),
      { datos: CONTRATO.estado.saldos, error: null });
    // Un número como texto sirve, y lo que no es un campo no se guarda
    assert.deepEqual(validar({ ...SALDOS_PLANTA, medica: '3', otra: 5 }), { datos: PLANTA.estado.saldos, error: null });
  });

  it('cada clave es obligatoria, y el error va en su clave', () => {
    assert.deepEqual(validar({ ...SALDOS_PLANTA, 'vacaciones-2025': undefined }),
      { datos: null, error: { campo: 'vacaciones-2025', mensaje: textoSaldo(30) } });
    for (const vacio of [null, '', '  ', 'x', true, [3]]) {
      assert.deepEqual(validar({ ...SALDOS_PLANTA, medica: vacio }).error, { campo: 'medica', mensaje: textoSaldo(25) });
    }
    assert.deepEqual(validarSaldoInicial({}, CAMPOS).error, { campo: 'vacaciones-2024', mensaje: textoSaldo(30) });
  });

  it('de 0 al máximo, en días enteros', () => {
    assert.deepEqual(validar({ ...SALDOS_PLANTA, 'vacaciones-2026': 11 }).error,
      { campo: 'vacaciones-2026', mensaje: 'Escribí un número de 0 a 10.' });
    assert.deepEqual(validar({ ...SALDOS_PLANTA, franquicias: 2.5 }).error, { campo: 'franquicias', mensaje: textoSaldo(42) });
    assert.deepEqual(validar({ ...SALDOS_PLANTA, familiar: -1 }).error, { campo: 'familiar', mensaje: textoSaldo(25) });
    assert.equal(validar({ ...SALDOS_PLANTA, 'vacaciones-2026': 0, franquicias: 42 }).error, null);
  });

  it('las horas no utilizadas, de a media hora', () => {
    const campos = camposDelSaldoInicial(CONTRATO.estado);
    assert.equal(validar({ ...SALDOS_CONTRATO, horas_no_utilizadas: 6.5 }, campos).error, null);
    assert.equal(validar({ ...SALDOS_CONTRATO, horas_no_utilizadas: '6.5' }, campos).error, null);
    assert.deepEqual(validar({ ...SALDOS_CONTRATO, horas_no_utilizadas: 6.25 }, campos).error,
      { campo: 'horas_no_utilizadas', mensaje: MENSAJES_MI_ESPACIO.saldoMedias });
    assert.deepEqual(validar({ ...SALDOS_CONTRATO, horas_no_utilizadas: 200.5 }, campos).error,
      { campo: 'horas_no_utilizadas', mensaje: textoSaldo(200) });
  });
});

describe('validarAnio', () => {
  it('los días y los estudios de un año', () => {
    assert.deepEqual(validarAnio(2026, { dias_vacaciones: 15, estudios: 'secundario' }, HOY),
      { datos: { anio: 2026, dias_vacaciones: 15, estudios: 'secundario' }, error: null });
    // El año de la dirección llega como texto, y los días pueden llegar como texto
    assert.deepEqual(validarAnio('2027', { dias_vacaciones: '20', estudios: null }, HOY).datos,
      { anio: 2027, dias_vacaciones: 20, estudios: null });
  });

  it('el año, de dos años antes al siguiente', () => {
    const anio = { campo: 'anio', mensaje: MENSAJES_MI_ESPACIO.anio };
    const dias = { dias_vacaciones: 20, estudios: null };
    assert.equal(validarAnio(2024, dias, HOY).error, null);
    for (const malo of [2023, 2028, 'abc', '26', null, 2026.5]) assert.deepEqual(validarAnio(malo, dias, HOY).error, anio);
    // Sin un hoy válido, ninguno
    assert.deepEqual(validarAnio(2026, dias, null).error, anio);
  });

  it('los días, uno de los de la antigüedad', () => {
    for (const malo of [12, 0, 35, undefined, null, 'x']) {
      assert.deepEqual(validarAnio(2026, { dias_vacaciones: malo, estudios: null }, HOY).error,
        { campo: 'dias_vacaciones', mensaje: MENSAJES_MI_ESPACIO.diasVacaciones });
    }
  });

  it('los estudios: universitaria, secundaria o «No estudio» (null)', () => {
    for (const malo of ['otro', '', undefined, 'toString', 1]) {
      assert.deepEqual(validarAnio(2026, { dias_vacaciones: 20, estudios: malo }, HOY).error,
        { campo: 'estudios', mensaje: MENSAJES_MI_ESPACIO.estudios });
    }
  });
});

describe('fueraDeLaModalidad', () => {
  it('los tipos de la otra modalidad', () => {
    assert.equal(fueraDeLaModalidad(nueva('franquicia', '2026-11-10', '2026-11-10', 3), 'contrato'), true);
    assert.equal(fueraDeLaModalidad(nueva('franco', '2026-11-10'), 'contrato'), true);
    assert.equal(fueraDeLaModalidad(nueva('horas_a_favor', '2026-11-10', '2026-11-10', 2), 'planta'), true);
    for (const tipo of ['vacaciones', 'estudios', 'medica', 'medica_extraordinaria', 'familiar']) {
      assert.equal(fueraDeLaModalidad(nueva(tipo, '2026-11-10'), 'planta'), false, tipo);
      assert.equal(fueraDeLaModalidad(nueva(tipo, '2026-11-10'), 'contrato'), false, tipo);
    }
  });

  it('en planta, un uso autorizado que no es de 7 horas viene de contrato', () => {
    assert.equal(fueraDeLaModalidad(nueva('uso_autorizado', '2026-11-10', '2026-11-10', 2.5), 'planta'), true);
    assert.equal(fueraDeLaModalidad(nueva('uso_autorizado', '2026-11-10', '2026-11-10', 7), 'planta'), false);
    // El DECIMAL llega de la base como texto
    assert.equal(fueraDeLaModalidad(nueva('uso_autorizado', '2026-11-10', '2026-11-10', '7.0'), 'planta'), false);
    assert.equal(fueraDeLaModalidad(nueva('uso_autorizado', '2026-11-10', '2026-11-10', 2.5), 'contrato'), false);
  });

  it('sin una modalidad, ninguna corresponde; un tipo desconocido, tampoco', () => {
    assert.equal(fueraDeLaModalidad(nueva('vacaciones', '2026-11-10'), null), true);
    assert.equal(fueraDeLaModalidad(nueva('otro', '2026-11-10'), 'planta'), true);
    assert.equal(fueraDeLaModalidad(null, 'planta'), true);
  });
});

describe('calcular', () => {
  it('PLANTA a hoy: el reparto, los topes, los francos y lo no utilizado, sin faltantes', () => {
    const calculo = calcular(PLANTA.estado, A_HOY);
    assert.deepEqual(Object.keys(calculo), ['reparto', 'topes', 'francos', 'horasAFavor', 'noUtilizadas', 'faltantes']);
    assert.deepEqual(calculo.reparto, repartoDeVacaciones(PLANTA.estado, A_HOY));
    assert.deepEqual(calculo.topes, usoDeLosTopes(PLANTA.estado, { feriados: SIN_FERIADOS }));
    assert.deepEqual(calculo.francos, francosDe(PLANTA.estado, A_HOY));
    assert.deepEqual(calculo.horasAFavor, []);
    assert.deepEqual(calculo.noUtilizadas, { 2026: noUtilizadasDe(PLANTA.estado, 2026, A_HOY) });
    assert.deepEqual(calculo.faltantes, []);
  });

  it('CONTRATO a hoy: las horas a favor y las horas no utilizadas', () => {
    const calculo = calcular(CONTRATO.estado, A_HOY);
    assert.deepEqual(calculo.topes, usoDeLosTopes(CONTRATO.estado, { feriados: SIN_FERIADOS }));
    assert.deepEqual(calculo.francos, []);
    assert.deepEqual(calculo.horasAFavor, horasAFavorDe(CONTRATO.estado, A_HOY));
    assert.equal(calculo.noUtilizadas[2026].quedan, 6.5);
    assert.deepEqual(calculo.faltantes, []);
  });

  it('lo no utilizado de cada año con algo: hoy, el arranque, los meses de uso y los usos autorizados', () => {
    // Las horas de diciembre se usan en enero de 2027
    const diciembre = conHoras('contrato', [extra(100, '2026-12-10', '18:00', '21:00')]);
    assert.deepEqual(Object.keys(calcular(diciembre, { hoy: '2027-02-15', feriados: SIN_FERIADOS }).noUtilizadas),
      ['2026', '2027']);
    // Un uso autorizado de 2025, en planta (cuenta también antes del arranque)
    const usoViejo = conHoras('planta', [], [uso(200, 'uso_autorizado', '2025-11-04', 7)]);
    assert.deepEqual(Object.keys(calcular(usoViejo, A_HOY).noUtilizadas), ['2025', '2026']);
    // Sin modalidad, ninguno
    assert.deepEqual(calcular({ ...PLANTA.estado, modalidad: null }, A_HOY).noUtilizadas, {});
  });

  it('una modalidad que cambia (Review Focus 1): las horas a favor de CONTRATO, en planta, no cuentan en nada', () => {
    const aPlanta = { ...CONTRATO.estado, modalidad: 'planta' };
    let calculo;
    assert.doesNotThrow(() => { calculo = calcular(aPlanta, A_HOY); });
    const aFavor = CONTRATO.estado.licencias.filter((fila) => fila.tipo === 'horas_a_favor');
    assert.equal(aFavor.length, 2);
    for (const fila of aFavor) assert.equal(fueraDeLaModalidad(fila, 'planta'), true);
    // Sus horas extras dan francos, pero ninguna fila los usa; el saldo de horas no utilizadas tampoco cuenta
    assert.deepEqual(calculo.horasAFavor, []);
    assert.deepEqual(calculo.francos.map((mes) => [mes.mes_trabajado, mes.francos, mes.usos.length]),
      [['2026-09', 1, 0], ['2026-10', 0, 0]]);
    assert.deepEqual(calculo.noUtilizadas[2026],
      { anio: 2026, unidad: 'francos', saldo: { cantidad: 0, quedan: 0 }, meses: [], usos: [], quedan: 0 });
    assert.deepEqual(calculo.topes.map((tope) => tope.tipo), ['estudios', 'medica', 'familiar']);
    assert.deepEqual(calculo.faltantes, []);

    // Un uso autorizado de contrato (2,5 horas) tampoco cuenta en planta
    const conUso = conLicencias(aPlanta, uso(100, 'uso_autorizado', '2026-10-27', 2.5));
    assert.equal(fueraDeLaModalidad(conUso.licencias.at(-1), 'planta'), true);
    assert.deepEqual(calcular(conUso, A_HOY).noUtilizadas[2026].usos, []);
    assert.deepEqual(calcular(conUso, A_HOY).faltantes, []);

    // Al revés, PLANTA en contrato: su franco y su saldo de franquicias no cuentan
    const aContrato = calcular({ ...PLANTA.estado, modalidad: 'contrato' }, A_HOY);
    assert.deepEqual(aContrato.francos, []);
    assert.equal(aContrato.topes.some((tope) => tope.tipo === 'franquicia'), false);
    assert.deepEqual(aContrato.faltantes, []);
  });

  it('sin un hoy válido, nada', () => {
    const calculo = calcular(PLANTA.estado, { feriados: SIN_FERIADOS });
    assert.deepEqual(calculo.reparto.ordinarias, []);
    assert.equal(calculo.reparto.sinCubrir.size, 0);
    assert.deepEqual([calculo.topes, calculo.francos, calculo.horasAFavor, calculo.noUtilizadas, calculo.faltantes],
      [[], [], [], {}, []]);
  });
});

describe('los faltantes', () => {
  const faltantesDelEstado = (estado, opciones = A_HOY) => faltantesDe(calcular(estado, opciones));
  const textos = (estado, opciones) => faltantesDelEstado(estado, opciones).map((faltante) => faltante.texto);
  // 12 días hábiles en junio de 2027, con la licencia 2026 de 20 días
  const JUNIO = vacaciones(100, '2027-06-01', '2027-06-16');

  it('corregir el saldo inicial deja un faltante', () => {
    assert.equal(diasQueDescuentan(JUNIO, PLANTA.estado, SIN_FERIADOS).length, 12);
    assert.deepEqual(faltantesDelEstado(soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 10 }, JUNIO)), []);
    assert.deepEqual(faltantesDelEstado(soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 }, JUNIO)), [{
      clave: 'vacaciones:100', campo: 'desde', medida: 2,
      texto: 'Revisá tus vacaciones: para el 15/06/2027 faltan 2 días habilitados.',
      mensaje: 'No te alcanzan los días habilitados: para el 15/06/2027 no te queda ninguno.'
    }]);
    // faltantesDe sobre el cálculo da lo mismo que su `faltantes`
    const calculo = calcular(soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 }, JUNIO), A_HOY);
    assert.deepEqual(faltantesDe(calculo), calculo.faltantes);
  });

  it('dar de baja un feriado', () => {
    // PLANTA con 4 días sin usar de la 2024 y ninguno de las otras: el 09/11 de sus vacaciones queda sin cubrir
    const estado = {
      ...PLANTA.estado,
      saldos: [...saldosDeVacaciones({ 2024: 4, 2025: 0, 2026: 0 }),
        ...PLANTA.estado.saldos.filter((saldo) => saldo.concepto !== 'vacaciones')]
    };
    assert.deepEqual(faltantesDelEstado(estado, { hoy: HOY, feriados: new Set(['2026-11-09']) }), []);
    assert.deepEqual(textos(estado), ['Revisá tus vacaciones: para el 09/11/2026 falta 1 día habilitado.']);
  });

  it('un tope que se pasa: en días, y las franquicias en horas', () => {
    const conDos = (tipo) => conLicencias(conSaldo(PLANTA.estado, tipo, tipo === 'estudios' ? 15 : 25),
      nueva(tipo, '2026-11-16', '2026-11-17'));
    assert.deepEqual(faltantesDelEstado(conDos('medica')), [{
      clave: 'tope:medica:2026', campo: 'desde', medida: 27,
      texto: 'Revisá tu atención médica de 2026: suman 27 días y el tope es 25.',
      mensaje: 'Con esta licencia pasarías los 25 días de atención médica de 2026.'
    }]);
    assert.deepEqual(textos(conDos('familiar')),
      ['Revisá tu atención del grupo familiar de 2026: suman 27 días y el tope es 25.']);
    assert.deepEqual(textos(conDos('estudios')), ['Revisá tu licencia por estudios de 2026: suman 17 días y el tope es 15.']);
    const franquicias = faltantesDelEstado(conLicencias(conSaldo(PLANTA.estado, 'franquicias', 42),
      nueva('franquicia', '2026-11-10', '2026-11-10', 3)));
    assert.deepEqual(franquicias, [{
      clave: 'tope:franquicia:2026', campo: 'horas', medida: 45,
      texto: 'Revisá tus franquicias de 2026: suman 45 horas y el tope es 42.',
      mensaje: 'Con esta licencia pasarías las 42 horas de franquicia de 2026.'
    }]);
    // Lo anterior al arranque no suma: no deja faltante
    assert.deepEqual(faltantesDelEstado(conLicencias(conSaldo(PLANTA.estado, 'medica', 25),
      nueva('medica', '2026-10-19', '2026-10-20'))), []);
    // «No estudio» no tiene tope: no hay faltante
    const noEstudia = { ...conDos('estudios'), anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }] };
    assert.deepEqual(faltantesDelEstado(noEstudia), []);
  });

  it('los francos de más, en su mes de uso', () => {
    assert.deepEqual(faltantesDelEstado(conLicencias(PLANTA.estado, uso(100, 'franco', '2026-11-02'),
      uso(101, 'franco', '2026-11-03'))), [{
      clave: 'franco:2026-11', campo: 'desde', medida: 1,
      texto: 'Revisá tus francos de noviembre de 2026: cargaste 2 y corresponde 1.',
      mensaje: 'En noviembre de 2026 no tenés francos para usar.'
    }]);
    assert.deepEqual(textos(conLicencias(PLANTA.estado, uso(100, 'franco', '2027-02-01'))),
      ['Revisá tus francos de febrero de 2027: cargaste 1 y no corresponde ninguno.']);
    assert.deepEqual(textos(conLicencias(PLANTA.estado, uso(100, 'franco', '2026-10-27'), uso(101, 'franco', '2026-10-28'))),
      ['Revisá tus francos de octubre de 2026: cargaste 3 y corresponden 2.']);
  });

  it('las horas a favor de más, en su mes de uso', () => {
    const diciembre = conHoras('contrato', EJEMPLOS_DEL_USUARIO, [
      uso(100, 'horas_a_favor', '2026-12-01', 7), uso(101, 'horas_a_favor', '2026-12-02', 2)
    ]);
    assert.deepEqual(faltantesDelEstado(diciembre), [{
      clave: 'horas:2026-12', campo: 'horas', medida: 1.5,
      texto: 'Revisá tus horas a favor de diciembre de 2026: cargaste 9 horas y corresponden 7,5.',
      mensaje: 'En diciembre de 2026 no te quedan horas a favor.'
    }]);
    assert.deepEqual(textos(conLicencias(CONTRATO.estado, uso(100, 'horas_a_favor', '2027-01-04', 1))),
      ['Revisá tus horas a favor de enero de 2027: cargaste 1 hora y no corresponde ninguna.']);
  });

  it('los usos autorizados de más: horas en contrato, francos en planta', () => {
    assert.deepEqual(faltantesDelEstado(conLicencias(CONTRATO.estado, uso(100, 'uso_autorizado', '2026-10-27', 7),
      uso(101, 'uso_autorizado', '2026-10-28', 1))), [{
      clave: 'uso:2026', campo: 'horas', medida: 1.5,
      texto: 'Revisá tus usos autorizados de 2026: cargaste 8 horas y había 6,5.',
      mensaje: 'En 2026 no te quedan horas no utilizadas previamente.'
    }]);
    // PLANTA tenía 1: el franco de junio, sin usar en agosto
    assert.deepEqual(faltantesDelEstado(conLicencias(PLANTA.estado, uso(100, 'uso_autorizado', '2026-10-27', 7),
      uso(101, 'uso_autorizado', '2026-10-28', 7))), [{
      clave: 'uso:2026', campo: 'desde', medida: 1,
      texto: 'Revisá tus usos autorizados de 2026: cargaste 2 francos y había 1.',
      mensaje: 'En 2026 no tenés francos no utilizados previamente.'
    }]);
    assert.deepEqual(textos(conHoras('planta', [], [uso(200, 'uso_autorizado', '2025-11-04', 7)])),
      ['Revisá tus usos autorizados de 2025: cargaste 1 franco y no había ninguno.']);
  });

  it('el orden: las vacaciones, los topes, los francos y los usos', () => {
    const estado = conLicencias({
      ...conSaldo(PLANTA.estado, 'medica', 25),
      saldos: [...saldosDeVacaciones({ 2024: 4, 2025: 0, 2026: 0 }),
        ...conSaldo(PLANTA.estado, 'medica', 25).saldos.filter((saldo) => saldo.concepto !== 'vacaciones')]
    }, uso(103, 'uso_autorizado', '2026-10-28', 7), uso(102, 'uso_autorizado', '2026-10-27', 7),
    uso(101, 'franco', '2027-02-01'), nueva('medica', '2026-11-16', '2026-11-17'));
    assert.deepEqual(faltantesDelEstado(estado).map((faltante) => faltante.clave),
      ['vacaciones:6', 'tope:medica:2026', 'franco:2027-02', 'uso:2026']);
  });

  it('sin un cálculo, ninguno', () => {
    assert.deepEqual(faltantesDe(null), []);
    assert.deepEqual(faltantesDe({}), []);
  });
});

describe('lo que frena una carga', () => {
  const evaluar = (estado, entrada, opciones = {}) =>
    evaluarLicencia(estado, entrada, { hoy: HOY, feriados: SIN_FERIADOS, ...opciones });
  const JUNIO = vacaciones(100, '2027-06-01', '2027-06-16');

  it('unas vacaciones sin días habilitados', () => {
    // Sin saldo de la 2026, su segunda mitad se habilita el 1/1/2027
    const estado = soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 });
    assert.deepEqual(evaluar(estado, { tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-04' }).error,
      { campo: 'desde', mensaje: 'No te alcanzan los días habilitados: para el 03/11/2026 no te queda ninguno.' });
    assert.equal(evaluar(estado, { tipo: 'vacaciones', desde: '2027-01-04', hasta: '2027-01-05' }).error, null);
  });

  it('un tope que se pasa: la atención médica, en desde', () => {
    const estado = conSaldo(PLANTA.estado, 'medica', 23);
    const problema = { campo: 'desde', mensaje: 'Con esta licencia pasarías los 25 días de atención médica de 2026.' };
    assert.deepEqual(problemaDeLaCarga(calcular(estado, A_HOY),
      calcular(conLicencias(estado, nueva('medica', '2026-11-16', '2026-11-18')), A_HOY)), problema);
    assert.deepEqual(evaluar(estado, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' }).error, problema);
    // Con dos días no pasa
    assert.equal(evaluar(estado, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-17' }).error, null);
  });

  it('… las franquicias, en horas', () => {
    assert.deepEqual(evaluar(conSaldo(PLANTA.estado, 'franquicias', 40),
      { tipo: 'franquicia', desde: '2026-11-10', horas: 3 }).error,
    { campo: 'horas', mensaje: 'Con esta licencia pasarías las 42 horas de franquicia de 2026.' });
  });

  it('… los estudios, con el tope de la carrera del año', () => {
    const { error } = evaluar(conSaldo(PLANTA.estado, 'estudios', 13),
      { tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-18' });
    assert.deepEqual(error, { campo: 'desde', mensaje: textoTope('estudios', 2026, 15) });
    assert.equal(error.mensaje, 'Con esta licencia pasarías los 15 días de licencia por estudios de 2026.');
  });

  it('un franco en un mes sin francos', () => {
    assert.deepEqual(evaluar(PLANTA.estado, { tipo: 'franco', desde: '2027-02-01' }).error,
      { campo: 'desde', mensaje: 'En febrero de 2027 no tenés francos para usar.' });
    // En octubre quedaba uno
    assert.equal(evaluar(PLANTA.estado, { tipo: 'franco', desde: '2026-10-30' }).error, null);
  });

  it('horas a favor de más: lo que quedaba para esta carga', () => {
    assert.deepEqual(evaluar(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-29', horas: 2 }).error,
      { campo: 'horas', mensaje: 'En octubre de 2026 te quedan 1,5 horas a favor.' });
    assert.equal(evaluar(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-29', horas: 1.5 }).error, null);
    // Al corregir la del 20/10 (2 horas), cuenta también lo que ya usaba: le quedan 3,5
    assert.deepEqual(evaluar(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-20', horas: 4 }, { editadaId: 3 }).error,
      { campo: 'horas', mensaje: 'En octubre de 2026 te quedan 3,5 horas a favor.' });
    assert.equal(evaluar(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-20', horas: 3.5 }, { editadaId: '3' }).error,
      null);
  });

  it('usos autorizados de más', () => {
    assert.deepEqual(evaluar(CONTRATO.estado, { tipo: 'uso_autorizado', desde: '2026-10-27', horas: 7 },
      { uso_autorizado: true }).error, { campo: 'horas', mensaje: 'En 2026 te quedan 6,5 horas no utilizadas previamente.' });
    // PLANTA tiene un franco no utilizado: el primero pasa, el segundo no
    const conUno = conLicencias(PLANTA.estado, uso(100, 'uso_autorizado', '2026-10-27', 7));
    assert.equal(evaluar(PLANTA.estado, { tipo: 'uso_autorizado', desde: '2026-10-27' }, { uso_autorizado: true }).error,
      null);
    assert.deepEqual(evaluar(conUno, { tipo: 'uso_autorizado', desde: '2026-10-28' }, { uso_autorizado: true }).error,
      { campo: 'desde', mensaje: 'En 2026 no tenés francos no utilizados previamente.' });
  });

  it('corregir otro campo de una fila en faltante no frena; agrandar el faltante, sí', () => {
    const estado = soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 }, JUNIO);
    const entrada = { tipo: 'vacaciones', desde: '2027-06-01', hasta: '2027-06-16', nota: 'Otra nota' };
    const { datos, error } = evaluar(estado, entrada, { editadaId: 100 });
    assert.equal(error, null);
    assert.equal(datos.nota, 'Otra nota');
    assert.deepEqual(evaluar(estado, { ...entrada, hasta: '2027-06-17' }, { editadaId: 100 }).error,
      { campo: 'desde', mensaje: textoSinHabilitados('2027-06-15') });
  });

  it('un faltante que ya estaba no frena una carga que no lo toca', () => {
    const estado = soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 }, JUNIO);
    assert.equal(evaluar(estado, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' }).error, null);
    const calculo = calcular(estado, A_HOY);
    assert.equal(problemaDeLaCarga(calculo, calculo), null);
  });

  it('unas vacaciones nuevas que dejan sin cubrir otras ya cargadas', () => {
    // Los 10 días hábiles del 01/06 al 14/06/2027 salen justo de la segunda mitad de la 2026: unas de mayo se llevan 3, y
    // el 10/06 queda sin cubrir
    const estado = soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 }, vacaciones(100, '2027-06-01', '2027-06-14'));
    assert.equal(evaluar(estado, { tipo: 'medica', desde: '2027-05-03', hasta: '2027-05-05' }).error, null);
    assert.deepEqual(evaluar(estado, { tipo: 'vacaciones', desde: '2027-05-03', hasta: '2027-05-05' }).error,
      { campo: 'desde', mensaje: textoSinHabilitados('2027-06-10') });
  });
});

describe('evaluarLicencia', () => {
  const evaluar = (estado, entrada, opciones = {}) =>
    evaluarLicencia(estado, entrada, { hoy: HOY, feriados: SIN_FERIADOS, ...opciones });
  const vistaDe = (estado, entrada, opciones) => evaluar(estado, entrada, opciones).vista;

  it('PLANTA: corregir las vacaciones de noviembre', () => {
    assert.deepEqual(evaluar(PLANTA.estado, { tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-09' }, { editadaId: 6 }),
      {
        datos: { tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-09', horas: null, mostrar: 1, nota: null },
        error: null,
        vista: {
          dias_habiles: 5, texto_dias: '5 días hábiles de 7 corridos',
          texto_reparto: 'Salen de la licencia 2024, la más vieja. Te quedan 33 días: 3 de la 2024 (vencen el 31/12/2026), '
            + '20 de la 2025 y 10 de la 2026.',
          queda_texto: '', antes_del_arranque: false, texto_antes_del_arranque: ''
        }
      });
    // Unas nuevas, todavía sin id
    assert.equal(vistaDe(PLANTA.estado, { tipo: 'vacaciones', desde: '2026-11-10', hasta: '2026-11-16' }).texto_reparto,
      'Salen de las licencias 2024 (3 días) y 2025 (2 días), las más viejas. Te quedan 28 días: 18 de la 2025 y 10 de la 2026.');
  });

  it('sin modalidad o sin arranque, con campo null, antes que todo lo demás', () => {
    const frenada = (mensaje) => ({ datos: null, error: { campo: null, mensaje }, vista: null });
    const medica = { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' };
    assert.deepEqual(evaluar({ ...PLANTA.estado, arranque: null }, medica), frenada(MENSAJES_MI_ESPACIO.sinArranque));
    assert.deepEqual(evaluar({ ...PLANTA.estado, modalidad: null, arranque: null }, medica),
      frenada(MENSAJES_MI_ESPACIO.sinModalidad));
    assert.deepEqual(evaluar({ ...PLANTA.estado, modalidad: 'otra' }, { tipo: 'x' }), frenada(MENSAJES_MI_ESPACIO.sinModalidad));
    // Sin arranque no se puede controlar «No estudio»: frena antes
    const noEstudia = { ...PLANTA.estado, arranque: null, anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }] };
    assert.deepEqual(evaluar(noEstudia, { tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-17' }),
      frenada(MENSAJES_MI_ESPACIO.sinArranque));
  });

  it('los errores de validarLicencia pasan tal cual, sin vista', () => {
    assert.deepEqual(evaluar(PLANTA.estado, { tipo: 'otro', desde: '2026-11-16' }),
      { datos: null, error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo }, vista: null });
    // El uso autorizado, solo desde su formulario
    assert.equal(evaluar(PLANTA.estado, { tipo: 'uso_autorizado', desde: '2026-10-27' }).error.campo, 'tipo');
    assert.equal(evaluar(PLANTA.estado, { tipo: 'uso_autorizado', desde: '2026-10-27' }, { uso_autorizado: true }).error,
      null);
  });

  it('los días: hábiles, de tantos corridos, o en horas', () => {
    const textoDias = (estado, entrada, opciones) => vistaDe(estado, entrada, opciones).texto_dias;
    assert.equal(textoDias(PLANTA.estado, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' }), '3 días hábiles');
    // Del viernes al lunes
    assert.equal(textoDias(PLANTA.estado, { tipo: 'medica', desde: '2026-11-13', hasta: '2026-11-16' }),
      '2 días hábiles de 4 corridos');
    assert.equal(vistaDe(PLANTA.estado, { tipo: 'medica', desde: '2026-11-13', hasta: '2026-11-16' }).dias_habiles, 2);
    assert.equal(textoDias(PLANTA.estado, { tipo: 'franco', desde: '2026-10-30' }), '1 día hábil');
    assert.equal(textoDias(PLANTA.estado, { tipo: 'franquicia', desde: '2026-11-10', horas: 3 }), '3 horas');
    assert.equal(textoDias(PLANTA.estado, { tipo: 'franquicia', desde: '2026-11-10', horas: 1 }), '1 hora');
    assert.equal(textoDias(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-28', horas: 1.5 }), '1,5 horas');
    // En planta, un uso autorizado es un franco: el día entero
    assert.equal(textoDias(PLANTA.estado, { tipo: 'uso_autorizado', desde: '2026-10-27' }, { uso_autorizado: true }),
      '1 día hábil');
  });

  it('lo que queda, después de esta carga', () => {
    const queda = (estado, entrada, opciones) => vistaDe(estado, entrada, opciones).queda_texto;
    assert.equal(queda(PLANTA.estado, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' }), 'Te quedan 19 de 25.');
    assert.equal(queda(PLANTA.estado, { tipo: 'familiar', desde: '2026-11-16', hasta: '2026-11-16' }), 'Te quedan 22 de 25.');
    assert.equal(queda(PLANTA.estado, { tipo: 'estudios', desde: '2026-11-16', hasta: '2026-11-18' }), 'Te quedan 6 de 15.');
    assert.equal(queda(PLANTA.estado, { tipo: 'franquicia', desde: '2026-11-10', horas: 2 }),
      'Te quedan 23 de 42 horas de franquicia.');
    assert.equal(queda(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-28', horas: 1.5 }),
      'Usás 1,5 horas a favor de octubre. Te quedan 0.');
    assert.equal(queda(CONTRATO.estado, { tipo: 'horas_a_favor', desde: '2026-10-28', horas: 0.5 }),
      'Usás 0,5 horas a favor de octubre. Te quedan 1.');
    assert.equal(queda(PLANTA.estado, { tipo: 'franco', desde: '2026-10-30' }),
      'Usás el franco de octubre, por las horas extras de agosto. Es el día entero.');
    assert.equal(queda(CONTRATO.estado, { tipo: 'uso_autorizado', desde: '2026-11-06', horas: 3 }, { uso_autorizado: true }),
      'Quedan 3,5 horas no utilizadas previamente. Se descuentan primero las más viejas.');
    assert.equal(queda(PLANTA.estado, { tipo: 'uso_autorizado', desde: '2026-10-27' }, { uso_autorizado: true }),
      'No quedan francos no utilizados previamente. Se descuentan primero los más viejos.');
    // La extraordinaria no tiene tope, y las vacaciones lo dicen en el reparto
    assert.equal(queda(PLANTA.estado, { tipo: 'medica_extraordinaria', desde: '2026-11-16', hasta: '2026-11-20' }), '');
    assert.equal(queda(PLANTA.estado, { tipo: 'vacaciones', desde: '2026-11-16', hasta: '2026-11-18' }), '');
  });

  it('con una carga que no cierra, el error y la vista', () => {
    const { datos, error, vista } = evaluar(conSaldo(PLANTA.estado, 'medica', 23),
      { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-18' });
    assert.equal(datos, null);
    assert.equal(error.campo, 'desde');
    assert.equal(vista.texto_dias, '3 días hábiles');
    assert.equal(vista.queda_texto, 'Te quedan 0 de 25.');
  });

  it('lo anterior al arranque queda como historia y no descuenta', () => {
    assert.equal(TEXTO_ANTES_DEL_ARRANQUE, 'Es anterior al saldo inicial: queda como historia y no descuenta.');
    assert.deepEqual(vistaDe(PLANTA.estado, { tipo: 'medica', desde: '2026-10-19', hasta: '2026-10-20' }), {
      dias_habiles: 2, texto_dias: '2 días hábiles', texto_reparto: '', queda_texto: '', antes_del_arranque: true,
      texto_antes_del_arranque: TEXTO_ANTES_DEL_ARRANQUE
    });
    // Una que cruza el arranque descuenta desde el arranque: no es historia (sin las licencias de PLANTA, que tiene un
    // franco el 23/10)
    const cruza = vistaDe({ ...PLANTA.estado, licencias: [] }, { tipo: 'medica', desde: '2026-10-19', hasta: '2026-10-27' });
    assert.equal(cruza.antes_del_arranque, false);
    assert.equal(cruza.texto_dias, '7 días hábiles de 9 corridos');
    // Te quedan 25 − (3 del saldo + el 26 y el 27)
    assert.equal(cruza.queda_texto, 'Te quedan 20 de 25.');
    // Los francos no tienen saldo inicial: nunca son historia
    assert.equal(vistaDe(conHoras('planta', [extra(100, '2026-08-04', '18:00', '01:00')]),
      { tipo: 'franco', desde: '2026-10-19' }).antes_del_arranque, false);
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
        textoHorarioSuperpuesto(valor, valor, valor);
        textoSaldo(valor);
        textoAutorizadaDelFirmante(valor, valor);
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

  it('el saldo inicial, el año, el cálculo, los faltantes y la evaluación con entradas raras', () => {
    const campos = camposDelSaldoInicial(PLANTA.estado);
    for (const valor of [...raros, Object.create(null), Symbol('x')]) {
      assert.doesNotThrow(() => {
        camposDelSaldoInicial(valor);
        camposDelSaldoInicial({ modalidad: 'planta', arranque: HOY, anios: valor });
        camposDelSaldoInicial({ modalidad: 'contrato', arranque: HOY, anios: [valor, { anio: 2026, dias_vacaciones: valor }] });
        validarSaldoInicial(valor, valor);
        validarSaldoInicial({ saldos: valor }, campos);
        validarSaldoInicial({ saldos: { ...SALDOS_PLANTA, franquicias: valor } }, campos);
        validarSaldoInicial({ saldos: SALDOS_PLANTA }, [valor, { clave: valor, maximo: valor, paso: valor }]);
        validarAnio(valor, valor, valor);
        validarAnio(2026, { dias_vacaciones: valor, estudios: valor }, HOY);
        fueraDeLaModalidad(valor, valor);
        fueraDeLaModalidad({ tipo: 'uso_autorizado', horas: valor }, 'planta');
        calcular(valor, valor);
        calcular(PLANTA.estado, { hoy: valor, feriados: valor });
        calcular({ ...PLANTA.estado, modalidad: valor }, A_HOY);
        calcular({ ...CONTRATO.estado, licencias: [valor, ...CONTRATO.estado.licencias], saldos: [valor] }, A_HOY);
        faltantesDe(valor);
        faltantesDe({
          reparto: valor, topes: [valor, { tipo: 'medica', anio: valor, usados: valor, tope: valor },
            { tipo: 'medica', anio: valor, usados: 30, tope: 25 }],
          francos: [valor, { mes_de_uso: valor, usos: valor, francos: valor }],
          horasAFavor: [valor, { mes_de_uso: '2026-10', usadas: valor, a_favor: valor }],
          noUtilizadas: { 2026: valor, 2027: { anio: valor, unidad: 'horas', saldo: valor, meses: valor, usos: [valor] } }
        });
        problemaDeLaCarga(valor, valor, valor);
        problemaDeLaCarga(calcular(PLANTA.estado, A_HOY), { faltantes: [valor, { clave: valor, medida: valor }] }, valor);
        problemaDeLaCarga({ horasAFavor: valor, noUtilizadas: valor },
          { faltantes: [{ clave: 'horas:2026-10', campo: 'horas', medida: 1, mensaje: '' }] }, valor);
        evaluarLicencia(valor, valor, valor);
        evaluarLicencia(PLANTA.estado, valor, { hoy: HOY, feriados: valor, editadaId: valor });
        evaluarLicencia(PLANTA.estado, { tipo: 'franquicia', desde: '2026-11-10', horas: valor, nota: valor },
          { hoy: HOY, feriados: valor, editadaId: valor });
      }, typeof valor);
    }
    assert.deepEqual(validarSaldoInicial(null, null), { datos: [], error: null });
    assert.equal(problemaDeLaCarga(null, null), null);
  });
});

// El paso a Configuración → Licencias (spec, sección 6). Hoy es el lunes 26/10/2026; «ya empezó» quiere decir antes de hoy
describe('el paso a Configuración', () => {
  // Una licencia de Configuración y una fila de Mi espacio (por defecto, unas vacaciones del 02/11 al 06/11, sin vínculo)
  const oficialDe = (id, desde, hasta, extra = {}) => ({ id, desde, hasta, anulada: 0, autorizado_id: null, ...extra });
  const filaDe = (extra = {}) => ({
    id: 100, tipo: 'vacaciones', desde: '2026-11-02', hasta: '2026-11-06', horas: null, nota: null, mostrar: 1,
    licencia_oficial_id: null, oficial: null, sin_pasar: null, ...extra
  });
  const creadaDe = (oficial, extra = {}) =>
    filaDe({ desde: oficial.desde, hasta: oficial.hasta, licencia_oficial_id: oficial.id, oficial: 'creada', ...extra });
  const unidaDe = (oficial, extra = {}) => filaDe({ licencia_oficial_id: oficial.id, oficial: 'unida', ...extra });
  const franquicia = (fecha, horas, extra = {}) => filaDe({ tipo: 'franquicia', desde: fecha, hasta: fecha, horas, ...extra });

  describe('vinculoDe', () => {
    it('sin licencia de Configuración, o con otra que no es la suya, ninguno', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      assert.deepEqual(vinculoDe(filaDe(), null, false), { estado: 'ninguno', oficial: null });
      assert.deepEqual(vinculoDe(creadaDe(oficial), undefined, false), { estado: 'ninguno', oficial: null });
      assert.deepEqual(vinculoDe(creadaDe(oficial), oficialDe(8, '2026-11-02', '2026-11-06'), false),
        { estado: 'ninguno', oficial: null });
      assert.deepEqual(vinculoDe(creadaDe(oficial, { oficial: null }), oficial, false), { estado: 'ninguno', oficial: null });
    });

    it('una creada: la maneja Mi espacio, la cambió administración o la anuló', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      assert.deepEqual(vinculoDe(creadaDe(oficial), oficial, false), { estado: 'creada', oficial });
      assert.deepEqual(vinculoDe(creadaDe(oficial), oficial, true), { estado: 'creada_cambiada', oficial });
      // La anulación manda, la haya hecho quien la haya hecho
      const anulada = { ...oficial, anulada: 1 };
      assert.deepEqual(vinculoDe(creadaDe(oficial), anulada, true), { estado: 'creada_anulada', oficial: anulada });
      assert.deepEqual(vinculoDe(creadaDe(oficial), anulada, false), { estado: 'creada_anulada', oficial: anulada });
      // El id de la base como texto también sirve
      assert.equal(vinculoDe(creadaDe(oficial, { licencia_oficial_id: '7' }), oficial, false).estado, 'creada');
    });

    it('una unida: cubierta, o sin cubrir del primer al último día de la fila fuera de la de Configuración', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-13');
      assert.deepEqual(vinculoDe(unidaDe(oficial), oficial, false), { estado: 'unida', oficial });
      // Acortada: le falta el final
      const acortada = oficialDe(7, '2026-11-02', '2026-11-04');
      assert.deepEqual(vinculoDe(unidaDe(oficial), acortada, false),
        { estado: 'unida_sin_cubrir', oficial: acortada, sin_cubrir: { desde: '2026-11-05', hasta: '2026-11-06' } });
      // Corrida hacia adelante: le falta el principio
      const corrida = oficialDe(7, '2026-11-04', '2026-11-13');
      assert.deepEqual(vinculoDe(unidaDe(oficial), corrida, false).sin_cubrir, { desde: '2026-11-02', hasta: '2026-11-03' });
      // Más corta de los dos lados: del primero al último día fuera
      const adentro = oficialDe(7, '2026-11-03', '2026-11-04');
      assert.deepEqual(vinculoDe(unidaDe(oficial), adentro, false).sin_cubrir, { desde: '2026-11-02', hasta: '2026-11-06' });
      // Anulada, o sin ningún día en común: toda la fila
      assert.deepEqual(vinculoDe(unidaDe(oficial), { ...oficial, anulada: 1 }, false).sin_cubrir,
        { desde: '2026-11-02', hasta: '2026-11-06' });
      assert.deepEqual(vinculoDe(unidaDe(oficial), oficialDe(7, '2026-11-09', '2026-11-13'), false).sin_cubrir,
        { desde: '2026-11-02', hasta: '2026-11-06' });
      // Una unida no la cambia nadie de Mi espacio: que otros la hayan tocado no importa
      assert.equal(vinculoDe(unidaDe(oficial), oficial, true).estado, 'unida');
    });
  });

  describe('textoDelVinculo', () => {
    const opciones = { hoy: HOY, sinPasar: null, puedeTener: true };
    const oficial = oficialDe(7, '2026-11-03', '2026-11-05');

    it('una creada: también en Configuración; si dejó de ser de día entero, sigue; si no se copió, en Configuración y por qué', () => {
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial), opciones),
        { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' });
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, franquicia('2026-11-03', 3), opciones),
        { texto: textoSigueEnConfiguracion('2026-11-03', '2026-11-05'), insignia: 'aviso' });
      // El motivo pierde su punto final: los textos del paso no lo llevan
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial),
        { ...opciones, sinPasar: 'La fecha de fin tiene que ser ayer o posterior, y no anterior al inicio.' }), {
        texto: 'En Configuración: del 03/11 al 05/11. No pasó a Configuración: La fecha de fin tiene que ser ayer o posterior, '
          + 'y no anterior al inicio',
        insignia: 'aviso'
      });
    });

    it('administración la cambió o la anuló', () => {
      assert.deepEqual(textoDelVinculo({ estado: 'creada_cambiada', oficial }, filaDe(), opciones),
        { texto: `${textoEnConfiguracion('2026-11-03', '2026-11-05')} ${TEXTO_NO_SE_COPIA}`, insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo({ estado: 'creada_anulada', oficial: { ...oficial, anulada: 1 } }, filaDe(), opciones),
        { texto: TEXTO_ANULADA_POR_ADMINISTRACION, insignia: 'aviso' });
    });

    it('una unida, cubierta o no', () => {
      assert.deepEqual(textoDelVinculo({ estado: 'unida', oficial }, filaDe(), opciones),
        { texto: textoUnida('2026-11-03', '2026-11-05'), insignia: 'unida' });
      assert.deepEqual(textoDelVinculo({
        estado: 'unida_sin_cubrir', oficial, sin_cubrir: { desde: '2026-11-02', hasta: '2026-11-02' }
      }, filaDe(), opciones), { texto: textoYaNoCubierta('2026-11-02', '2026-11-02'), insignia: 'aviso' });
    });

    it('sin vínculo: el motivo por el que no pasó; menos de 7 horas, de quien puede tener licencia, que no es el día entero', () => {
      const ninguno = { estado: 'ninguno', oficial: null };
      const superpuesta = textoSuperpuestaConConfiguracion('2026-11-03', '2026-11-05');
      assert.deepEqual(textoDelVinculo(ninguno, filaDe(), { ...opciones, sinPasar: superpuesta }),
        { texto: textoNoPaso(superpuesta), insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo(ninguno, filaDe(),
        { ...opciones, sinPasar: 'Se superpone con otra licencia (del 03/11/2026 al 05/11/2026).' }),
      { texto: 'No pasó a Configuración: Se superpone con otra licencia (del 03/11/2026 al 05/11/2026)', insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo(ninguno, franquicia('2026-11-03', 3), opciones),
        { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo(ninguno,
        filaDe({ tipo: 'horas_a_favor', desde: '2026-10-15', hasta: '2026-10-15', horas: 2 }), opciones),
      { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' });
      // De un lector, una franquicia no dice nada; ni unas vacaciones sin vínculo ni motivo, ni una franquicia de 7 horas
      assert.equal(textoDelVinculo(ninguno, franquicia('2026-11-03', 3), { ...opciones, puedeTener: false }), null);
      assert.equal(textoDelVinculo(ninguno, filaDe(), opciones), null);
      assert.equal(textoDelVinculo(ninguno, franquicia('2026-11-03', 7), opciones), null);
    });
  });

  describe('limiteParaCambiarTipo', () => {
    it('dos días hábiles antes de empezar, con los 9 feriados fijos', () => {
      // Desde un lunes, el jueves anterior
      assert.equal(limiteParaCambiarTipo('2026-11-02'), '2026-10-29');
      // El lunes de Carnaval (08/02/2027) no es un feriado fijo: cuenta como hábil
      assert.equal(limiteParaCambiarTipo('2027-02-10'), '2027-02-08');
      assert.equal(limiteParaCambiarTipo('2027-02-09'), '2027-02-05');
      // El 08/12 sí lo es
      assert.equal(limiteParaCambiarTipo('2026-12-09'), '2026-12-04');
      for (const raro of [null, undefined, '', '2026-02-30', 3, {}]) assert.equal(limiteParaCambiarTipo(raro), null);
    });
  });

  describe('pasoDeLaCarga', () => {
    const carga = (fila, extra = {}) => pasoDeLaCarga({ fila, rol: 'admin', hoy: HOY, cruzadas: [], ...extra });

    it('pasa lo de día entero que termina hoy o después, de quien puede tener licencia', () => {
      assert.deepEqual(carga(filaDe()), { accion: 'crear' });
      assert.deepEqual(carga(franquicia('2026-11-03', 7)), { accion: 'crear' });
      assert.deepEqual(carga(filaDe({ tipo: 'medica', desde: HOY, hasta: HOY })), { accion: 'crear' });
      // Cruza el arranque (o el día de hoy): pasa si termina hoy o después (Review Focus 4)
      assert.deepEqual(carga(filaDe({ tipo: 'medica', desde: '2026-10-23', hasta: '2026-10-29' })), { accion: 'crear' });
      for (const rol of ['superadmin', 'editor']) assert.deepEqual(carga(filaDe(), { rol }), { accion: 'crear' });
    });

    it('no pasa: un lector o un colaborador, menos de 7 horas, o lo que ya terminó', () => {
      for (const rol of ['lector', 'colaborador', null]) assert.deepEqual(carga(filaDe(), { rol }), { accion: 'nada' });
      assert.deepEqual(carga(franquicia('2026-11-03', 3)), { accion: 'nada' });
      assert.deepEqual(carga(filaDe({ tipo: 'medica', desde: '2026-10-19', hasta: '2026-10-23' })), { accion: 'nada' });
    });

    it('cubierta por una de Configuración, se une; superpuesta en parte, avisa con la primera', () => {
      const larga = oficialDe(7, '2026-11-02', '2026-11-13');
      assert.deepEqual(carga(filaDe({ desde: '2026-11-04', hasta: '2026-11-05' }), { cruzadas: [larga] }),
        { accion: 'unir', oficial: larga });
      const despues = oficialDe(8, '2026-11-05', '2026-11-13');
      const antes = oficialDe(9, '2026-10-28', '2026-11-03');
      assert.deepEqual(carga(filaDe(), { cruzadas: [despues, antes] }),
        { accion: 'avisar', sin_pasar: textoSuperpuestaConConfiguracion('2026-10-28', '2026-11-03') });
      // Una anulada no cuenta
      assert.deepEqual(carga(filaDe(), { cruzadas: [{ ...larga, anulada: 1 }] }), { accion: 'crear' });
      // Una que cubre gana a una que se superpone
      assert.deepEqual(carga(filaDe(), { cruzadas: [antes, larga] }), { accion: 'unir', oficial: larga });
    });
  });

  describe('pasoDeLaCorreccion', () => {
    const correccion = (anterior, fila, vinculo, extra = {}) => pasoDeLaCorreccion({
      anterior, fila, vinculo, rol: 'admin', hoy: HOY, cruzadas: [], autorizadoCambia: false, personaACargo: false, ...extra
    });

    it('una creada que todavía no empezó sigue a Configuración', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      const anterior = creadaDe(oficial);
      const vinculo = { estado: 'creada', oficial };
      assert.deepEqual(correccion(anterior, { ...anterior, desde: '2026-11-03' }, vinculo), { accion: 'cambiar' });
      // El tipo, la nota y «Mostrar» no tocan Configuración
      assert.deepEqual(correccion(anterior, { ...anterior, tipo: 'medica', nota: 'x', mostrar: 0 }, vinculo), { accion: 'nada' });
      // La persona autorizada sí
      assert.deepEqual(correccion(anterior, anterior, vinculo, { autorizadoCambia: true }), { accion: 'cambiar' });
    });

    it('las fechas siguen a Configuración: desde hoy o antes, solo el hasta; la terminada, nada; la de hoy todavía se borra', () => {
      // Una que empieza hoy está en curso para Configuración (validarEdicion): el desde queda fijo, pero se anula
      const deHoy = oficialDe(7, HOY, '2026-10-30');
      const deHoyVinculo = { estado: 'creada', oficial: deHoy };
      assert.deepEqual(correccion(creadaDe(deHoy), filaDe({ desde: '2026-10-27', hasta: '2026-10-30' }), deHoyVinculo),
        { error: { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.soloHasta } });
      assert.deepEqual(correccion(creadaDe(deHoy), filaDe({ desde: HOY, hasta: '2026-11-04' }), deHoyVinculo),
        { accion: 'cambiar' });
      assert.deepEqual(pasoDeLaBaja({ vinculo: deHoyVinculo, hoy: HOY }), { accion: 'anular' });
      // Una que todavía no empezó, entera
      const deManana = oficialDe(7, '2026-10-27', '2026-10-30');
      assert.deepEqual(correccion(creadaDe(deManana), filaDe({ desde: '2026-10-28', hasta: '2026-10-30' }),
        { estado: 'creada', oficial: deManana }), { accion: 'cambiar' });
      const enCurso = oficialDe(7, '2026-10-23', '2026-10-29');
      const vinculo = { estado: 'creada', oficial: enCurso };
      assert.deepEqual(correccion(creadaDe(enCurso), filaDe({ desde: '2026-10-22', hasta: '2026-10-29' }), vinculo),
        { error: { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.soloHasta } });
      assert.deepEqual(correccion(creadaDe(enCurso), filaDe({ desde: '2026-10-23', hasta: '2026-11-04' }), vinculo),
        { accion: 'cambiar' });
      const terminada = oficialDe(7, '2026-10-19', '2026-10-23');
      const fija = { estado: 'creada', oficial: terminada };
      assert.deepEqual(correccion(creadaDe(terminada), filaDe({ desde: '2026-10-19', hasta: '2026-10-22' }), fija),
        { error: { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.fechasFijas } });
      assert.deepEqual(correccion(creadaDe(terminada), filaDe({ desde: '2026-10-20', hasta: '2026-10-23' }), fija),
        { error: { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.fechasFijas } });
      // Sin cambiar las fechas, una terminada se corrige igual (el tipo, la nota)
      assert.deepEqual(correccion(creadaDe(terminada), creadaDe(terminada, { tipo: 'medica' }), fija), { accion: 'nada' });
    });

    it('una creada cuya copia no pasó: sin cambiar las fechas se corrige siempre; los límites, con las de Configuración', () => {
      // La de Configuración terminó el 23/10; la fila quedó del 19/10 al 22/10 con el motivo
      const terminada = oficialDe(7, '2026-10-19', '2026-10-23');
      const vinculo = { estado: 'creada', oficial: terminada };
      const anterior = creadaDe(terminada, { hasta: '2026-10-22', sin_pasar: 'La fecha de fin tiene que ser ayer o posterior' });
      assert.deepEqual(correccion(anterior, { ...anterior, nota: 'Turno' }, vinculo), { accion: 'nada' });
      assert.deepEqual(correccion(anterior, { ...anterior, tipo: 'familiar', mostrar: 0 }, vinculo), { accion: 'nada' });
      // Volver a las fechas de Configuración no le cambia nada; otras, no se puede
      assert.deepEqual(correccion(anterior, { ...anterior, hasta: '2026-10-23' }, vinculo), { accion: 'nada' });
      assert.deepEqual(correccion(anterior, { ...anterior, hasta: '2026-10-21' }, vinculo),
        { error: { campo: 'hasta', mensaje: MENSAJES_MI_ESPACIO.fechasFijas } });
      assert.deepEqual(vinculosDeLaLista([{ ...anterior, id: 1 }], { oficiales: new Map([[7, terminada]]), hoy: HOY,
        puedeTener: true }).get(1), {
        configuracion: {
          texto: `${textoEnConfiguracion('2026-10-19', '2026-10-23')} ${textoNoPaso('La fecha de fin tiene que ser ayer o posterior')}`,
          insignia: 'aviso'
        },
        puede_borrar: false, solo_hasta: false, fechas_fijas: true, en_configuracion: { licencia_id: 7, autorizado_id: null }
      });

      // En curso en Configuración desde el 23/10; la fila quedó desde el 21/10
      const enCurso = oficialDe(7, '2026-10-23', '2026-10-29');
      const enCursoVinculo = { estado: 'creada', oficial: enCurso };
      const corrida = creadaDe(enCurso, { desde: '2026-10-21', sin_pasar: 'Se superpone con otra licencia' });
      assert.deepEqual(correccion(corrida, { ...corrida, nota: 'Turno' }, enCursoVinculo), { accion: 'nada' });
      // Solo el hasta: se intenta (Configuración dirá si lo acepta); el desde, solo de vuelta al de Configuración
      assert.deepEqual(correccion(corrida, { ...corrida, hasta: '2026-11-03' }, enCursoVinculo), { accion: 'cambiar' });
      assert.deepEqual(correccion(corrida, { ...corrida, desde: '2026-10-22' }, enCursoVinculo),
        { error: { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.soloHasta } });
      assert.deepEqual(correccion(corrida, { ...corrida, desde: '2026-10-23', hasta: '2026-11-03' }, enCursoVinculo),
        { accion: 'cambiar' });
      assert.deepEqual(correccion(corrida, { ...corrida, desde: '2026-10-23' }, enCursoVinculo), { accion: 'nada' });
    });

    it('una creada que todavía no empezó, corregida toda al pasado: se anula en Configuración', () => {
      const futura = oficialDe(7, '2026-11-02', '2026-11-06');
      assert.deepEqual(correccion(creadaDe(futura), filaDe({ desde: '2026-10-19', hasta: '2026-10-21' }),
        { estado: 'creada', oficial: futura }), { accion: 'anular' });
      const deHoy = oficialDe(7, HOY, HOY);
      assert.deepEqual(correccion(creadaDe(deHoy), filaDe({ tipo: 'medica', desde: '2026-10-22', hasta: '2026-10-23' }),
        { estado: 'creada', oficial: deHoy }), { accion: 'anular' });
      // Hasta ayer, una que ya empezó no se anula: Configuración dirá si se puede cortar
      const enCurso = oficialDe(7, '2026-10-23', '2026-10-29');
      assert.deepEqual(correccion(creadaDe(enCurso), filaDe({ desde: '2026-10-23', hasta: '2026-10-25' }),
        { estado: 'creada', oficial: enCurso }), { accion: 'cambiar' });
    });

    it('la franquicia de 7 horas que pasa a 3: se anula antes de empezar (también si empieza hoy) y queda después', () => {
      const deManana = oficialDe(7, '2026-10-27', '2026-10-27');
      assert.deepEqual(correccion(franquicia('2026-10-27', 7), franquicia('2026-10-27', 3),
        { estado: 'creada', oficial: deManana }), { accion: 'anular' });
      const deHoy = oficialDe(7, HOY, HOY);
      assert.deepEqual(correccion(franquicia(HOY, 7), franquicia(HOY, 3), { estado: 'creada', oficial: deHoy }),
        { accion: 'anular' });
      const deAyer = oficialDe(7, '2026-10-23', '2026-10-23');
      assert.deepEqual(correccion(franquicia('2026-10-23', 7), franquicia('2026-10-23', 3),
        { estado: 'creada', oficial: deAyer }), { accion: 'quedar' });
      // Y si ya no es de día entero, una nueva corrección no la mueve: queda
      assert.deepEqual(correccion(franquicia('2026-10-23', 3), franquicia('2026-10-22', 3),
        { estado: 'creada', oficial: deAyer }), { accion: 'quedar' });
    });

    it('administración la cambió o la anuló: nada', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      for (const estado of ['creada_cambiada', 'creada_anulada']) {
        assert.deepEqual(correccion(creadaDe(oficial), filaDe({ desde: '2026-11-09', hasta: '2026-11-10' }),
          { estado, oficial }), { accion: 'nada' }, estado);
        assert.deepEqual(correccion(creadaDe(oficial), franquicia('2026-11-03', 3), { estado, oficial }), { accion: 'nada' });
      }
    });

    it('una unida: cubierta y de día entero, nada; corrida fuera de la de administración, se suelta y pasa como nueva', () => {
      const larga = oficialDe(7, '2026-11-02', '2026-11-13');
      const anterior = unidaDe(larga, { desde: '2026-11-04', hasta: '2026-11-05' });
      const vinculo = { estado: 'unida', oficial: larga };
      assert.deepEqual(correccion(anterior, { ...anterior, desde: '2026-11-03', tipo: 'medica' }, vinculo,
        { cruzadas: [larga] }), { accion: 'nada' });
      assert.deepEqual(correccion(anterior, filaDe({ desde: '2026-11-16', hasta: '2026-11-17' }), vinculo),
        { accion: 'soltar', luego: { accion: 'crear' } });
      assert.deepEqual(correccion(anterior, filaDe({ desde: '2026-11-12', hasta: '2026-11-17' }), vinculo,
        { cruzadas: [larga] }),
      { accion: 'soltar', luego: { accion: 'avisar', sin_pasar: textoSuperpuestaConConfiguracion('2026-11-02', '2026-11-13') } });
      assert.deepEqual(correccion(anterior, franquicia('2026-11-04', 3), vinculo, { cruzadas: [larga] }),
        { accion: 'soltar', luego: { accion: 'nada' } });
      // Si administración la acortó y la corrección la deja adentro, vuelve a estar cubierta
      const acortada = oficialDe(7, '2026-11-02', '2026-11-04');
      assert.deepEqual(correccion(anterior, { ...anterior, hasta: '2026-11-04' },
        { estado: 'unida_sin_cubrir', oficial: acortada, sin_cubrir: { desde: '2026-11-05', hasta: '2026-11-05' } }),
      { accion: 'nada' });
    });

    it('sin vínculo, como una carga', () => {
      const ninguno = { estado: 'ninguno', oficial: null };
      assert.deepEqual(correccion(filaDe(), filaDe({ hasta: '2026-11-09' }), ninguno), { accion: 'crear' });
      assert.deepEqual(correccion(franquicia('2026-11-03', 3), franquicia('2026-11-03', 7), ninguno), { accion: 'crear' });
      assert.deepEqual(correccion(filaDe(), filaDe(), ninguno, { rol: 'lector' }), { accion: 'nada' });
    });

    it('un lector, siempre nada: también con una creada de cuando era admin', () => {
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      for (const estado of ['creada', 'unida']) {
        const vinculo = { estado, oficial };
        assert.deepEqual(correccion(creadaDe(oficial), filaDe({ hasta: '2026-11-09' }), vinculo, { rol: 'lector' }),
          { accion: 'nada' });
        assert.deepEqual(correccion(creadaDe(oficial), franquicia('2026-11-03', 3), vinculo, { rol: 'lector' }),
          { accion: 'nada' });
      }
    });

    it('las vacaciones del titular con persona a cargo cambian de tipo hasta 2 días hábiles antes, y pierden la persona a cargo',
      () => {
        // Desde el lunes 02/11: el límite es el jueves 29/10, inclusive
        const oficial = oficialDe(7, '2026-11-02', '2026-11-06', { autorizado_id: 3 });
        const anterior = creadaDe(oficial);
        const vinculo = { estado: 'creada', oficial };
        const aMedica = { ...anterior, tipo: 'medica' };
        const conPersona = { personaACargo: true };
        assert.deepEqual(correccion(anterior, aMedica, vinculo, { ...conPersona, hoy: '2026-10-29' }),
          { accion: 'cambiar', sin_persona_a_cargo: true });
        assert.deepEqual(correccion(anterior, aMedica, vinculo, { ...conPersona, hoy: '2026-10-30' }),
          { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } });
        // Con otras fechas también, hasta el límite
        assert.deepEqual(correccion(anterior, { ...aMedica, hasta: '2026-11-04' }, vinculo, { ...conPersona, hoy: '2026-10-28' }),
          { accion: 'cambiar', sin_persona_a_cargo: true });
        // A un tipo que no es de día entero, antes del límite: se anula
        assert.deepEqual(correccion(anterior, franquicia('2026-11-02', 3), vinculo, { ...conPersona, hoy: '2026-10-29' }),
          { accion: 'anular' });
        // El Carnaval cuenta como día hábil: desde el miércoles 10/02/2027, el límite es el lunes 08/02
        const enCarnaval = oficialDe(7, '2027-02-10', '2027-02-12', { autorizado_id: 3 });
        const deCarnaval = creadaDe(enCarnaval);
        const vinculoCarnaval = { estado: 'creada', oficial: enCarnaval };
        const deCarnavalAMedica = { ...deCarnaval, tipo: 'medica' };
        assert.deepEqual(correccion(deCarnaval, deCarnavalAMedica, vinculoCarnaval, { ...conPersona, hoy: '2027-02-08' }),
          { accion: 'cambiar', sin_persona_a_cargo: true });
        assert.deepEqual(correccion(deCarnaval, deCarnavalAMedica, vinculoCarnaval, { ...conPersona, hoy: '2027-02-09' }),
          { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } });
        // Sin persona a cargo (u otra persona), el tipo cambia cualquier día sin tocar Configuración
        assert.deepEqual(correccion(anterior, aMedica, vinculo, { hoy: '2026-10-30' }), { accion: 'nada' });
        // Vacaciones que siguen siendo vacaciones, cualquier día
        assert.deepEqual(correccion(anterior, { ...anterior, nota: 'x' }, vinculo, { ...conPersona, hoy: '2026-10-30' }),
          { accion: 'nada' });
      });
  });

  describe('pasoDeLaBaja', () => {
    const baja = (oficial) => pasoDeLaBaja({ vinculo: { estado: 'creada', oficial }, hoy: HOY });

    it('una creada se anula si todavía no empezó o empieza hoy; si empezó antes, no se borra', () => {
      assert.deepEqual(baja(oficialDe(7, '2026-11-02', '2026-11-06')), { accion: 'anular' });
      assert.deepEqual(baja(oficialDe(7, HOY, '2026-11-06')), { accion: 'anular' });
      assert.deepEqual(baja(oficialDe(7, '2026-10-25', '2026-11-06')),
        { error: { status: 409, campo: null, mensaje: MENSAJES_MI_ESPACIO.yaEmpezo } });
    });

    it('lo demás se borra sin tocar Configuración', () => {
      const oficial = oficialDe(7, '2026-10-19', '2026-11-06');
      for (const estado of ['ninguno', 'creada_cambiada', 'creada_anulada', 'unida', 'unida_sin_cubrir']) {
        assert.deepEqual(pasoDeLaBaja({ vinculo: { estado, oficial }, hoy: HOY }), { accion: 'nada' }, estado);
      }
    });
  });

  describe('vinculosDeLaLista', () => {
    it('cada fila con su texto y, una creada, lo que se puede hacer con sus fechas', () => {
      const futura = oficialDe(7, '2026-11-02', '2026-11-06');
      const enCurso = oficialDe(8, '2026-10-23', '2026-10-29');
      const terminada = oficialDe(9, '2026-10-19', '2026-10-21');
      const filas = [
        creadaDe(futura, { id: 1 }),
        creadaDe(enCurso, { id: '2' }),
        creadaDe(terminada, { id: 3 }),
        franquicia('2026-11-10', 3, { id: 4 }),
        filaDe({ id: 5, desde: '2026-11-16', hasta: '2026-11-16' }),
        creadaDe(futura, { id: 6, licencia_oficial_id: 10, desde: '2026-11-23', hasta: '2026-11-24' }),
        creadaDe(oficialDe(11, HOY, '2026-10-28'), { id: 7 })
      ];
      const oficiales = new Map([[7, futura], [8, enCurso], [9, terminada], [10, oficialDe(10, '2026-11-23', '2026-11-25')],
        [11, oficialDe(11, HOY, '2026-10-28')]]);
      const vinculos = vinculosDeLaLista(filas, { oficiales, tocadas: new Set([10]), hoy: HOY, puedeTener: true });
      const creada = { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' };
      const enConfiguracion = (licenciaId) => ({ licencia_id: licenciaId, autorizado_id: null });
      assert.deepEqual(vinculos.get(1), {
        configuracion: creada, puede_borrar: true, solo_hasta: false, fechas_fijas: false, en_configuracion: enConfiguracion(7)
      });
      assert.deepEqual(vinculos.get(2), {
        configuracion: creada, puede_borrar: false, solo_hasta: true, fechas_fijas: false, en_configuracion: enConfiguracion(8)
      });
      assert.deepEqual(vinculos.get(3), {
        configuracion: creada, puede_borrar: false, solo_hasta: false, fechas_fijas: true, en_configuracion: enConfiguracion(9)
      });
      assert.deepEqual(vinculos.get(4), {
        configuracion: { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' }, puede_borrar: true, solo_hasta: false,
        fechas_fijas: false, en_configuracion: null
      });
      // Sin nada para decir, no está
      assert.equal(vinculos.has(5), false);
      // Una que administración cambió: ya no se corrige en Configuración desde acá, sin en_configuracion
      assert.deepEqual(vinculos.get(6), {
        configuracion: { texto: `${textoEnConfiguracion('2026-11-23', '2026-11-25')} ${TEXTO_NO_SE_COPIA}`, insignia: 'aviso' },
        puede_borrar: true, solo_hasta: false, fechas_fijas: false, en_configuracion: null
      });
      // La que empieza hoy: el desde queda fijo, pero todavía se borra
      assert.deepEqual(vinculos.get(7), {
        configuracion: creada, puede_borrar: true, solo_hasta: true, fechas_fijas: false, en_configuracion: enConfiguracion(11)
      });
      assert.deepEqual([...vinculos.keys()].sort(), [1, 2, 3, 4, 6, 7]);
    });

    // El formulario precarga la persona a cargo y manda autorizado_id solo si se cambió (Ruling de la Task 17)
    it('una creada con persona a cargo dice quién es; una unida no da su id de Configuración', () => {
      const conPersona = oficialDe(7, '2026-11-02', '2026-11-06', { autorizado_id: 3 });
      const deAdministracion = oficialDe(12, '2026-11-09', '2026-11-20', { autorizado_id: 4 });
      const vinculos = vinculosDeLaLista(
        [creadaDe(conPersona, { id: 1 }), unidaDe(deAdministracion, { id: 2, desde: '2026-11-10', hasta: '2026-11-11' })],
        { oficiales: new Map([[7, conPersona], [12, deAdministracion]]), tocadas: new Set(), hoy: HOY, puedeTener: true }
      );
      assert.deepEqual(vinculos.get(1).en_configuracion, { licencia_id: 7, autorizado_id: 3 });
      assert.equal(vinculos.get(2).en_configuracion, null);
    });
  });

  describe('pasoPrevistoDe', () => {
    const previsto = (extra = {}) => pasoPrevistoDe({
      paso: { accion: 'crear' }, vinculo: { estado: 'ninguno', oficial: null }, fila: filaDe(), rol: 'admin', hoy: HOY,
      soyTitular: false, ...extra
    });

    it('lo que pasa avisa antes de guardar; al superadmin le suma lo suyo', () => {
      assert.deepEqual(previsto(), { pasa: true, avisos: [AVISO_DEL_PASO], firmante: null, sin_pasar_previsto: null });
      assert.deepEqual(previsto({ rol: 'superadmin' }).avisos, [AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN]);
      // Una creada que sigue igual, o que cambia, sigue en Configuración
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06');
      assert.equal(previsto({ paso: { accion: 'nada' }, vinculo: { estado: 'creada', oficial } }).pasa, true);
      assert.equal(previsto({ paso: { accion: 'cambiar' }, vinculo: { estado: 'creada', oficial } }).pasa, true);
      assert.equal(previsto({ paso: { accion: 'soltar', luego: { accion: 'crear' } }, vinculo: { estado: 'unida', oficial } })
        .pasa, true);
    });

    it('lo que no pasa no avisa; unida o superpuesta, dice qué va a quedar', () => {
      const vacio = { pasa: false, avisos: [], firmante: null, sin_pasar_previsto: null };
      assert.deepEqual(previsto({ paso: { accion: 'nada' } }), vacio);
      assert.deepEqual(previsto({ paso: { accion: 'nada' }, rol: 'lector' }), vacio);
      assert.deepEqual(previsto({ paso: { accion: 'anular' }, vinculo: { estado: 'creada', oficial: oficialDe(7, HOY, HOY) } }),
        vacio);
      const larga = oficialDe(7, '2026-11-02', '2026-11-13');
      assert.deepEqual(previsto({ paso: { accion: 'unir', oficial: larga } }),
        { ...vacio, sin_pasar_previsto: textoUnida('2026-11-02', '2026-11-13') });
      const superpuesta = textoSuperpuestaConConfiguracion('2026-11-02', '2026-11-13');
      assert.deepEqual(previsto({ paso: { accion: 'soltar', luego: { accion: 'avisar', sin_pasar: superpuesta } } }),
        { ...vacio, sin_pasar_previsto: superpuesta });
    });

    it('al firmante titular: la víspera, las notas de hoy y, fuera de las vacaciones, que no queda nadie a cargo', () => {
      assert.deepEqual(previsto({ soyTitular: true }), {
        pasa: true, avisos: [AVISO_DEL_PASO],
        firmante: { soy_titular: true, puede_autorizar: true, vispera: '2026-10-30', notas_de_hoy: false },
        sin_pasar_previsto: null
      });
      const hoyMismo = previsto({ soyTitular: true, fila: filaDe({ tipo: 'medica', desde: HOY, hasta: '2026-10-28' }) });
      assert.deepEqual(hoyMismo.avisos, [AVISO_DEL_PASO, AVISO_NOTAS_DE_HOY, AVISO_SIN_PERSONA_A_CARGO]);
      assert.deepEqual(hoyMismo.firmante, { soy_titular: true, puede_autorizar: false, vispera: '2026-10-23', notas_de_hoy: true });
    });

    // Decisión del usuario (27/10/2026): la persona autorizada del firmante no se frena; se le avisa, una línea por cada
    // licencia del firmante que se pisa con la suya y que todavía no terminó, por fecha
    it('a la persona autorizada del firmante, una línea por cada licencia del firmante que se pisa, sin frenarla', () => {
      // La fila, del 02/11 al 06/11
      const comoAutorizada = [
        { desde: '2026-11-06', hasta: '2026-11-20' }, { desde: '2026-10-19', hasta: '2026-11-02' },
        { desde: '2026-11-09', hasta: '2026-11-13' }, { desde: '2026-10-01', hasta: '2026-10-23' }
      ];
      assert.deepEqual(previsto({ comoAutorizada }), {
        pasa: true, firmante: null, sin_pasar_previsto: null,
        avisos: [AVISO_DEL_PASO, textoAutorizadaDelFirmante('2026-10-19', '2026-11-02'),
          textoAutorizadaDelFirmante('2026-11-06', '2026-11-20')]
      });
      assert.deepEqual(previsto({ rol: 'superadmin', comoAutorizada }).avisos.slice(0, 2), [AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN]);
      // Una que ya terminó no (una corrección que arranca antes de hoy); sin ninguna, ni la lista, nada
      const enCurso = filaDe({ tipo: 'medica', desde: '2026-10-20', hasta: '2026-10-30' });
      assert.deepEqual(previsto({ fila: enCurso, comoAutorizada: [{ desde: '2026-10-19', hasta: '2026-10-23' }] }).avisos,
        [AVISO_DEL_PASO]);
      assert.deepEqual(previsto({ fila: enCurso, comoAutorizada: [{ desde: '2026-10-19', hasta: HOY }] }).avisos,
        [AVISO_DEL_PASO, textoAutorizadaDelFirmante('2026-10-19', HOY)]);
      assert.deepEqual(previsto({ comoAutorizada: [] }).avisos, [AVISO_DEL_PASO]);
      assert.deepEqual(previsto({ comoAutorizada: 'x' }).avisos, [AVISO_DEL_PASO]);
      assert.deepEqual(previsto({ comoAutorizada: [null, { desde: 'x', hasta: '2026-11-03' }, { desde: '2026-11-03' }] }).avisos,
        [AVISO_DEL_PASO]);
      // Lo que no pasa no avisa
      assert.deepEqual(previsto({ paso: { accion: 'nada' }, comoAutorizada }).avisos, []);
    });
  });

  it('nada tira', () => {
    const raros = [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        vinculoDe(valor, valor, valor);
        vinculoDe({ oficial: 'unida', licencia_oficial_id: 1, desde: valor }, { id: 1, desde: valor, hasta: valor }, valor);
        textoDelVinculo(valor, valor, valor);
        textoDelVinculo({ estado: 'creada', oficial: valor }, valor, { sinPasar: valor });
        textoDelVinculo({ estado: 'unida_sin_cubrir', oficial: oficialDe(1, HOY, HOY), sin_cubrir: valor }, valor, valor);
        limiteParaCambiarTipo(valor);
        pasoDeLaCarga(valor);
        pasoDeLaCarga({ fila: valor, rol: 'admin', hoy: valor, cruzadas: [valor] });
        pasoDeLaCorreccion(valor);
        pasoDeLaCorreccion({ anterior: valor, fila: filaDe(), vinculo: { estado: 'creada', oficial: valor }, rol: 'admin', hoy: HOY });
        pasoDeLaCorreccion({ anterior: valor, fila: valor, vinculo: { estado: 'unida', oficial: oficialDe(1, HOY, HOY) },
          rol: 'admin', hoy: valor, cruzadas: valor, personaACargo: true });
        pasoDeLaBaja(valor);
        pasoDeLaBaja({ vinculo: { estado: 'creada', oficial: valor }, hoy: valor });
        vinculosDeLaLista(valor, valor);
        vinculosDeLaLista([valor, filaDe({ id: valor })], { oficiales: valor, tocadas: valor, hoy: valor });
        pasoPrevistoDe(valor);
        pasoPrevistoDe({ paso: valor, vinculo: valor, fila: valor, rol: valor, hoy: valor, soyTitular: valor, comoAutorizada: valor });
        pasoPrevistoDe({ paso: { accion: 'crear' }, fila: filaDe(), rol: 'admin', hoy: HOY, comoAutorizada: [valor] });
      }, String(valor));
    }
    assert.deepEqual(pasoDeLaCarga(null), { accion: 'nada' });
    assert.deepEqual(pasoDeLaBaja(null), { accion: 'nada' });
    assert.equal(vinculosDeLaLista(null).size, 0);
  });
});

describe('«Hoy no están»', () => {
  const fila = (usuarioId, nombre, desde, hasta, extra = {}) => ({ usuario_id: usuarioId, nombre, desde, hasta, ...extra });
  const unida = (usuarioId, nombre, desde, hasta, vuelve) => ({ usuario_id: usuarioId, nombre, desde, hasta, vuelve });

  it('junta unas vacaciones del 26/10 al 30/10/2026 con una médica del 02/11 al 03/11: vuelve el 04/11, o el 05/11 si el 04 es feriado',
    () => {
      // Desordenadas y con el tipo y la nota, que no pasan
      const filas = [
        fila(7, 'Laura Gómez', '2026-11-02', '2026-11-03', { tipo: 'medica', nota: 'Turno' }),
        fila(7, 'Laura Gómez', '2026-10-26', '2026-10-30', { tipo: 'vacaciones', horas: null })
      ];
      assert.deepEqual(ausenciasUnidas(filas, SIN_FERIADOS),
        [unida(7, 'Laura Gómez', '2026-10-26', '2026-11-03', '2026-11-04')]);
      assert.deepEqual(ausenciasUnidas(filas, new Set(['2026-11-04'])),
        [unida(7, 'Laura Gómez', '2026-10-26', '2026-11-03', '2026-11-05')]);
    });

  it('un día hábil libre en el medio las deja separadas; un feriado del Set, no; una dentro de otra no la alarga', () => {
    const separadas = [fila(7, 'Laura Gómez', '2026-10-26', '2026-10-29'), fila(7, 'Laura Gómez', '2026-11-02', '2026-11-03')];
    assert.deepEqual(ausenciasUnidas(separadas, SIN_FERIADOS), [
      unida(7, 'Laura Gómez', '2026-10-26', '2026-10-29', '2026-10-30'),
      unida(7, 'Laura Gómez', '2026-11-02', '2026-11-03', '2026-11-04')
    ]);
    // El viernes 30/10 feriado: ya no queda ningún día hábil entre las dos
    assert.deepEqual(ausenciasUnidas(separadas, new Set(['2026-10-30'])),
      [unida(7, 'Laura Gómez', '2026-10-26', '2026-11-03', '2026-11-04')]);
    const adentro = [fila(7, 'Laura Gómez', '2026-10-26', '2026-10-30'), fila(7, 'Laura Gómez', '2026-10-27', '2026-10-28')];
    assert.deepEqual(ausenciasUnidas(adentro, SIN_FERIADOS), [unida(7, 'Laura Gómez', '2026-10-26', '2026-10-30', '2026-11-02')]);
  });

  it('la vuelta saltea los 9 fijos aunque el Set no los traiga: del jueves 24/12/2026 vuelve el lunes 28/12', () => {
    assert.deepEqual(ausenciasUnidas([fila(7, 'Laura Gómez', '2026-12-21', '2026-12-24')], SIN_FERIADOS),
      [unida(7, 'Laura Gómez', '2026-12-21', '2026-12-24', '2026-12-28')]);
  });

  it('cada persona por su lado, por desde y después por nombre; las filas que no sirven no cuentan', () => {
    const filas = [
      fila(9, 'Martín Ríos', '2026-10-27', '2026-10-27'),
      fila(3, 'Sofía Paz', '2026-10-28', '2026-10-28'),
      // El id como texto es la misma persona
      fila('7', 'Laura Gómez', '2026-10-28', '2026-10-28'),
      fila(7, 'Laura Gómez', '2026-10-27', '2026-10-27'),
      fila(null, 'Sin id', '2026-10-27', '2026-10-27'),
      // Un id vacío (Number('') es 0), el 0 y uno negativo no son una persona
      fila('', 'Id vacío', '2026-10-27', '2026-10-27'),
      fila(0, 'Id cero', '2026-10-27', '2026-10-27'),
      fila(-7, 'Id negativo', '2026-10-27', '2026-10-27'),
      fila(4, 'Al revés', '2026-10-28', '2026-10-27'),
      fila(5, 'Sin fecha', '2026-02-30', '2026-03-02'),
      null,
      'x'
    ];
    assert.deepEqual(ausenciasUnidas(filas, SIN_FERIADOS), [
      unida(7, 'Laura Gómez', '2026-10-27', '2026-10-28', '2026-10-29'),
      unida(9, 'Martín Ríos', '2026-10-27', '2026-10-27', '2026-10-28'),
      unida(3, 'Sofía Paz', '2026-10-28', '2026-10-28', '2026-10-29')
    ]);
  });

  it('los textos: «Martín Ríos no está» y «Vuelve el lunes 02/11»', () => {
    assert.equal(textoNoEsta('Martín Ríos'), 'Martín Ríos no está');
    assert.equal(textoDeLaVuelta('2026-11-02'), 'Vuelve el lunes 02/11');
    assert.equal(textoDeLaVuelta('2026-11-04'), 'Vuelve el miércoles 04/11');
    assert.equal(textoDeLaVuelta(null), null);
    assert.equal(textoDeLaVuelta('2026-02-30'), null);
  });

  it('ausentesDelRango: las que tocan el rango, con sus textos y nada más (ni el id)', () => {
    const unidas = [
      unida(7, 'Laura Gómez', '2026-10-26', '2026-10-27', '2026-10-28'),
      unida(9, 'Martín Ríos', '2026-10-26', '2026-11-03', '2026-11-04'),
      unida(3, 'Sofía Paz', '2026-10-30', '2026-10-30', '2026-11-02')
    ];
    const ausentes = ausentesDelRango(unidas, '2026-10-28', '2026-10-29');
    assert.deepEqual(ausentes, [{
      nombre: 'Martín Ríos', desde: '2026-10-26', hasta: '2026-11-03', vuelve: '2026-11-04', texto: 'Martín Ríos no está',
      vuelve_texto: 'Vuelve el miércoles 04/11'
    }]);
    assert.deepEqual(Object.keys(ausentes[0]), ['nombre', 'desde', 'hasta', 'vuelve', 'texto', 'vuelve_texto']);
    // Los bordes cuentan
    assert.deepEqual(ausentesDelRango(unidas, '2026-10-27', '2026-10-30').map((ausente) => ausente.nombre),
      ['Laura Gómez', 'Martín Ríos', 'Sofía Paz']);
    assert.deepEqual(ausentesDelRango(unidas, '2026-10-30', '2026-10-28'), []);
  });

  // Decisión del usuario (27/10/2026): «Hoy no están» y «Mañana no están», por separado
  it('ausentesDeHoyYManana: en hoy, los que ya empezaron (también de hoy a pasado mañana); en mañana, los que empiezan mañana',
    () => {
      // Hoy es el lunes 26/10/2026 y mañana, el martes 27/10
      const unidas = [
        unida(7, 'Laura Gómez', '2026-10-21', '2026-10-26', '2026-10-27'),
        unida(9, 'Martín Ríos', '2026-10-26', '2026-10-28', '2026-10-29'),
        unida(3, 'Diego Fernández', '2026-10-27', '2026-10-27', '2026-10-28'),
        unida(4, 'Carla Benítez', '2026-10-27', '2026-11-03', '2026-11-04')
      ];
      const ausentes = ausentesDelRango(unidas, '2026-10-26', '2026-10-27');
      const grupos = ausentesDeHoyYManana(ausentes, '2026-10-26');
      assert.deepEqual(Object.keys(grupos), ['ausentes_hoy', 'ausentes_manana']);
      assert.deepEqual(grupos.ausentes_hoy, [ausentes[0], ausentes[1]]);
      assert.deepEqual(grupos.ausentes_manana, [ausentes[2], ausentes[3]]);
      // Cada uno con las seis claves de siempre, en su orden
      for (const ausente of [...grupos.ausentes_hoy, ...grupos.ausentes_manana]) {
        assert.deepEqual(Object.keys(ausente), ['nombre', 'desde', 'hasta', 'vuelve', 'texto', 'vuelve_texto']);
      }
      // Quien falta hoy y mañana va solo en hoy, con su vuelta
      assert.deepEqual(grupos.ausentes_hoy.map((ausente) => [ausente.nombre, ausente.vuelve_texto]),
        [['Laura Gómez', 'Vuelve el martes 27/10'], ['Martín Ríos', 'Vuelve el jueves 29/10']]);
    });

  it('ausentesDeHoyYManana: lo que no toca hoy ni mañana no va; tampoco el tipo ni la nota; mañana es el día siguiente corrido',
    () => {
      const ausente = (desde, hasta, extra = {}) => ({
        nombre: 'Laura Gómez', desde, hasta, vuelve: null, texto: 'Laura Gómez no está', vuelve_texto: null, ...extra
      });
      const lista = [ausente('2026-10-20', '2026-10-23'), ausente('2026-10-28', '2026-10-28'), ausente('2026-10-27', '2026-10-26'),
        ausente('2026-02-30', '2026-10-27'), null, 'x', ausente('2026-10-26', '2026-10-26', { tipo: 'medica', nota: 'Turno', id: 4 })];
      assert.deepEqual(ausentesDeHoyYManana(lista, '2026-10-26'),
        { ausentes_hoy: [ausente('2026-10-26', '2026-10-26')], ausentes_manana: [] });
      // Un viernes: mañana es el sábado
      assert.deepEqual(ausentesDeHoyYManana([ausente('2026-10-31', '2026-11-02')], '2026-10-30'),
        { ausentes_hoy: [], ausentes_manana: [ausente('2026-10-31', '2026-11-02')] });
    });

  it('ausentesDeHoyYManana: sin un hoy válido o sin una lista, los dos grupos vacíos', () => {
    for (const raro of [undefined, null, '', 'x', 0, {}, '2026-02-30']) {
      assert.deepEqual(ausentesDeHoyYManana([{ nombre: 'Laura Gómez', desde: '2026-10-26', hasta: '2026-10-26' }], raro),
        { ausentes_hoy: [], ausentes_manana: [] }, String(raro));
      assert.deepEqual(ausentesDeHoyYManana(raro, '2026-10-26'), { ausentes_hoy: [], ausentes_manana: [] }, String(raro));
    }
  });

  it('nada tira', () => {
    const raros = [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        ausenciasUnidas(valor, valor);
        ausenciasUnidas([valor, fila(7, valor, '2026-10-26', '2026-10-26')], valor);
        ausenciasUnidas([fila(7, 'Laura Gómez', '9999-12-30', '9999-12-31')], valor);
        textoNoEsta(valor);
        textoDeLaVuelta(valor);
        ausentesDelRango(valor, valor, valor);
        ausentesDelRango([valor, unida(7, valor, '2026-10-26', '2026-10-26', valor)], '2026-10-26', '2026-10-26');
        ausentesDeHoyYManana(valor, valor);
        ausentesDeHoyYManana([valor, unida(7, valor, '2026-10-26', '2026-10-26', valor)], '2026-10-26');
        ausentesDeHoyYManana([unida(7, 'Laura Gómez', '9999-12-31', '9999-12-31', null)], '9999-12-31');
      }, String(valor));
    }
    assert.deepEqual(ausenciasUnidas(null, null), []);
    // Sin un día hábil después (el fin del calendario), la vuelta es null
    assert.deepEqual(ausenciasUnidas([fila(7, 'Laura Gómez', '9999-12-30', '9999-12-31')], SIN_FERIADOS),
      [unida(7, 'Laura Gómez', '9999-12-30', '9999-12-31', null)]);
  });
});

// El email de vencimiento (spec, sección 9): lo que está en su tramo. El franco o las horas a favor del mes de hoy, desde 5
// días hábiles antes del último día hábil del mes hasta ese día; los días de la licencia que vence el 31/12, desde el primer
// día hábil de diciembre. En octubre de 2026 el último día hábil es el viernes 30/10 y el tramo arranca el viernes 23/10
describe('avisosDeVencimiento', () => {
  const avisos = (caso, hoy, feriados = SIN_FERIADOS, estado = caso.estado) =>
    avisosDeVencimiento(calcular(estado, { hoy, feriados }), { hoy, feriados, modalidad: estado.modalidad });
  const FRANCO_DE_OCTUBRE = {
    clave: 'franco-2026-10',
    texto: 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.'
  };
  const LICENCIA_2024 = { clave: 'licencia-2024', texto: 'Tenés 3 días de la licencia 2024: vence el 31/12/2026.' };

  it('PLANTA: el franco de octubre sale del 23/10 al 30/10, el último día hábil del mes', () => {
    assert.deepEqual(avisos(PLANTA, '2026-10-22'), []);
    assert.deepEqual(avisos(PLANTA, '2026-10-23'), [FRANCO_DE_OCTUBRE]);
    assert.deepEqual(avisos(PLANTA, '2026-10-30'), [FRANCO_DE_OCTUBRE]);
    // El sábado 31/10 ya pasó el último día hábil; en noviembre, el franco de noviembre todavía no está en su tramo
    assert.deepEqual(avisos(PLANTA, '2026-10-31'), []);
    assert.deepEqual(avisos(PLANTA, '2026-11-02'), []);
  });

  it('PLANTA: los días de la licencia 2024 salen desde el primer día hábil de diciembre', () => {
    // El 30/11 la licencia todavía no: solo el franco de noviembre, en su último día hábil
    assert.deepEqual(avisos(PLANTA, '2026-11-30').map((aviso) => aviso.clave), ['franco-2026-11']);
    assert.deepEqual(avisos(PLANTA, '2026-12-01'), [LICENCIA_2024]);
    // El 23/12 entra también el franco de diciembre (el 25/12 es feriado: el tramo va del 23/12 al jueves 31/12), primero
    assert.deepEqual(avisos(PLANTA, '2026-12-23'), [
      { clave: 'franco-2026-12', texto: 'Tenés 1 franco compensatorio para usar en diciembre: el último día hábil es el jueves 31/12.' },
      LICENCIA_2024
    ]);
    assert.deepEqual(avisos(PLANTA, '2026-12-31').map((aviso) => aviso.clave), ['franco-2026-12', 'licencia-2024']);
    // En enero ya venció: la del año anterior al de hoy − 2 no se avisa
    assert.deepEqual(avisos(PLANTA, '2027-01-04'), []);
  });

  it('CONTRATO: las horas a favor de octubre, con «hora» en singular solo con 1', () => {
    assert.deepEqual(avisos(CONTRATO, '2026-10-26'), [{
      clave: 'horas-2026-10',
      texto: 'Tenés 1,5 horas a favor para usar en octubre: el último día hábil es el viernes 30/10.'
    }]);
    const media = conLicencias(CONTRATO.estado, { id: 100, tipo: 'horas_a_favor', desde: '2026-10-27', hasta: '2026-10-27', horas: 0.5 });
    assert.deepEqual(avisos(CONTRATO, '2026-10-26', SIN_FERIADOS, media), [{
      clave: 'horas-2026-10', texto: 'Tenés 1 hora a favor para usar en octubre: el último día hábil es el viernes 30/10.'
    }]);
    // Sin días de la licencia 2024 (su saldo es 0), en diciembre no hay nada que avisar
    assert.deepEqual(avisos(CONTRATO, '2026-12-01'), []);
  });

  it('con los feriados: el último día hábil, el tramo, el plural y «1 día»', () => {
    // El viernes 30/10 feriado: el último es el jueves 29/10 y el tramo arranca el jueves 22/10
    assert.deepEqual(avisos(PLANTA, '2026-10-22', new Set(['2026-10-30'])), [{
      clave: 'franco-2026-10', texto: 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el jueves 29/10.'
    }]);
    // El viernes 23/10 feriado: el franco de ese día no descuenta y quedan los 2
    assert.deepEqual(avisos(PLANTA, '2026-10-22', new Set(['2026-10-23'])), [{
      clave: 'franco-2026-10', texto: 'Tenés 2 francos compensatorios para usar en octubre: el último día hábil es el viernes 30/10.'
    }]);
    // Dos días más de vacaciones salen de la 2024: le queda 1
    const conMas = conLicencias(PLANTA.estado, vacaciones(100, '2026-11-10', '2026-11-11'));
    assert.deepEqual(avisos(PLANTA, '2026-12-01', SIN_FERIADOS, conMas),
      [{ clave: 'licencia-2024', texto: 'Tenés 1 día de la licencia 2024: vence el 31/12/2026.' }]);
  });

  it('solo lo que queda: sin disponibles, o de la otra modalidad, nada', () => {
    // El franco de octubre usado (dos francos cargados en octubre)
    const usado = conLicencias(PLANTA.estado, { id: 100, tipo: 'franco', desde: '2026-10-27', hasta: '2026-10-27', horas: null });
    assert.deepEqual(avisos(PLANTA, '2026-10-26', SIN_FERIADOS, usado), []);
    // Las vacaciones de la 2024 cargadas en diciembre ya no se avisan
    const cargadas = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-14', '2026-12-16'));
    assert.deepEqual(avisos(PLANTA, '2026-12-01', SIN_FERIADOS, cargadas), []);
    // Con otra modalidad, el franco no se avisa
    const hoy = '2026-10-26';
    assert.deepEqual(avisosDeVencimiento(calcular(PLANTA.estado, { hoy, feriados: SIN_FERIADOS }),
      { hoy, feriados: SIN_FERIADOS, modalidad: 'contrato' }), []);
  });

  it('nada tira', () => {
    const raros = [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.deepEqual(avisosDeVencimiento(valor, valor), [], String(valor));
      assert.deepEqual(avisosDeVencimiento(valor, { hoy: '2026-10-26', feriados: valor, modalidad: 'planta' }), [], String(valor));
      const calculo = calcular(PLANTA.estado, { hoy: '2026-10-26', feriados: SIN_FERIADOS });
      assert.doesNotThrow(() => avisosDeVencimiento(calculo, { hoy: valor, feriados: valor, modalidad: valor }), String(valor));
      assert.doesNotThrow(() => avisosDeVencimiento({ francos: [valor], horasAFavor: valor, reparto: { ordinarias: [valor] } },
        { hoy: '2026-12-01', feriados: SIN_FERIADOS, modalidad: 'planta' }), String(valor));
    }
  });
});
