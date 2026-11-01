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
  textoRango, textoNoEstudia, textoSuperpuesta, textoSinHabilitados, textoHastaDondeAlcanza, textoSinNingunDia,
  textoFaltanEnOtraCarga, textoTope, textoSinFranco, textoSinHorasAFavor,
  textoSinNoUtilizadas, textoHorarioSuperpuesto, textoSaldo, textoSaldoDelArranque, textoSaldoDeLosDias, textoSaldoSinDias,
  textoAutorizadaDelFirmante,
  AVISO_DEL_PASO, AVISO_DEL_PASO_SUPERADMIN, AVISO_NOTAS_DE_HOY, AVISO_SIN_PERSONA_A_CARGO,
  textoSuperpuestaConConfiguracion, textoNoPaso, textoYaNoCubierta, textoEnConfiguracion, textoUnida,
  textoSigueEnConfiguracion, TEXTO_TAMBIEN_EN_CONFIGURACION, TEXTO_NO_SE_COPIA, TEXTO_ANULADA_EN_CONFIGURACION,
  textoRevisalaEnConfiguracion, TEXTO_NO_DIA_ENTERO,
  mitadesDe, habilitaciones, venceLaLicencia, textoDeLasMitades, anioVigente, ordinariasDe, diasQueDescuentan, repartoDeVacaciones,
  textoDelReparto, textoDePerdidos, rangoDeFechas, esDiaEntero, topeDe, usoDeLosTopes, validarLicencia,
  horasDe, mesMas, horasPorMes, validarHorasExtras, francosDe, horasAFavorDe, noUtilizadasDe,
  TEXTO_ANTES_DEL_ARRANQUE, camposDelSaldoInicial, validarSaldoInicial, validarAnio, fueraDeLaModalidad, calcular,
  faltantesDe, problemaDeLaCarga, evaluarLicencia,
  vinculoDe, textoDelVinculo, revisionDelVinculo, limiteParaCambiarTipo, pasoDeLaCarga, pasoDeLaCorreccion, pasoDeLaBaja,
  vinculosDeLaLista,
  pasoPrevistoDe, ausenciasUnidas, textoNoEsta, nombreCorto, textoDeLaVuelta, ausentesDelRango, ausentesDeHoyYManana,
  avisosDeVencimiento,
  SALIDA_DE_LA_JORNADA, TOLERANCIA_DIA_HABIL, TOLERANCIA_DIA_INHABIL, MAXIMO_DIAS_POR_GUARDADO, horaSalidaValida, tipoDeDia,
  horasDeLaSalida, horasPorMesDeSalidas, enDiasDeFranco, textoDeLaSumaDelMes, licenciaDeDiaEnteroEn, validarSalida,
  avisosDeSalidas, mesDeLaPlanilla, porHabilitarDe, alcanceDeLaCarga, diasLibresEntre, diasLibresDelMes, franquiciaQueVence,
  textoDePerdidosConLaCarga, textoDelFrancoSinDiasLibres, textoDeLasHorasSinDiasLibres, textoDeLaFranquiciaPerdida,
  textoDelReacomodo, textoDeLosDiasHabiles, mesDeLaSalida, repartoDelMes, textoDeLoQueSeMueve,
  TIPOS_CON_PERSONA_A_CARGO, dejaPersonaACargo, restituiblesDe, diasDeLaCarga,
  PLAZO_DE_RESTITUCION_EN_MESES, plazoDeRestitucion, casoDeRestitucion, fechasDeLosAsuetos, restitucionesDe,
  textoDesdeDeLosRestituidos, hastaDeLosRestituidos, primerDiaDeLosRestituidos, validarRestituidos,
  textoDelCalculoDeRestituidos, textoDeLaAyudaDeRestituidos, textoDelHastaDeRestituidos, grupoDeLosRestituidos,
  grupoDeLaRestitucion, TIPOS_CON_RESTITUIBLES,
  textoDelAvisoDeRestitucion, textoDelBotonDeRestitucion, textoDeLaFilaDeRestitucion, bajadaDeRestituciones,
  tituloDeRestitucionQueVence, partesDelEmailDeRestitucion, recuadroDeLaRestitucion, mensajeDeLaRestitucionPedida,
  MENSAJE_RESTITUCION_BORRADA
} from '../services/miEspacioReglas.js';
import { feriadosDelRango, calendarioCon } from '../services/feriadosReglas.js';
import { sumarDias } from '../services/notasDigitalesCalendario.js';
import { HOY, SIN_FERIADOS, PLANTA, CONTRATO, JULIETA, ASUETOS } from './fixtures/mi-espacio-casos.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';

// El calendario con la precarga de 2026 y 2027 (spec 2026-10-27-feriados-en-notas, 1): el 07/12/2026 no es laborable, y el 08/02
// y el 09/02/2027 son Carnaval
const CAL = calendarioCon(FILAS_PRECARGA);

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

// La persona de la spec 2026-10-27-mi-espacio-dias-de-vacaciones (punto 1): 15 días de la 2024, 20 de la 2025 y 10 de la
// 2026, más los 10 de la 2026 que se habilitan el 1/1/2027
const PERSONA = Object.freeze({ 2024: 15, 2025: 20, 2026: 10 });

// El texto del reparto de una carga, con el arranque y hoy el 26/10/2026 y sin feriados de la tabla
const textoDeLaCarga = (saldos, filas, id) =>
  textoDelReparto(repartoDeVacaciones(soloVacaciones('2026-10-26', saldos, ...filas),
    { hoy: HOY, feriados: SIN_FERIADOS }), id);

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
    // Los días restituidos (spec 2026-10-31-mi-espacio-dias-restituidos, 6): al final del enum, y en las dos modalidades justo
    // después de las vacaciones
    assert.deepEqual(TIPOS_LICENCIA, [
      'vacaciones', 'franquicia', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'horas_a_favor',
      'uso_autorizado', 'restituidos'
    ]);
    assert.deepEqual(TIPOS_POR_MODALIDAD, {
      planta: ['vacaciones', 'restituidos', 'franquicia', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'franco',
        'uso_autorizado'],
      contrato: ['vacaciones', 'restituidos', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'horas_a_favor',
        'uso_autorizado']
    });
    assert.deepEqual(NOMBRES_TIPO, {
      vacaciones: 'Vacaciones', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
      medica_extraordinaria: 'Médica extraordinaria', familiar: 'Atención del grupo familiar', franco: 'Franco compensatorio',
      horas_a_favor: 'Horas a favor', uso_autorizado: 'Uso autorizado', restituidos: 'Días restituidos'
    });
    assert.deepEqual(Object.keys(NOMBRES_TIPO).sort(), [...TIPOS_LICENCIA].sort());
  });

  it('los tipos que dejan persona a cargo del firmante titular: las vacaciones y los días restituidos', () => {
    assert.deepEqual(TIPOS_CON_PERSONA_A_CARGO, ['vacaciones', 'restituidos']);
    for (const tipo of TIPOS_CON_PERSONA_A_CARGO) assert.equal(dejaPersonaACargo(tipo), true, tipo);
    for (const otro of [...TIPOS_LICENCIA.filter((tipo) => !TIPOS_CON_PERSONA_A_CARGO.includes(tipo)), undefined, null, '',
      'Vacaciones', ['vacaciones'], {}, 3]) {
      assert.equal(dejaPersonaACargo(otro), false, String(otro));
    }
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
      TIPOS_POR_MODALIDAD.contrato, NOMBRES_TIPO, DIAS_VACACIONES, DIAS_ESTUDIOS, TOPES, MENSAJES_MI_ESPACIO,
      TIPOS_CON_PERSONA_A_CARGO
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
      tipoFijo: 'Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.',
      horaSalida: 'Escribí la hora como 16:45.',
      salidaQueCuenta: 'Falta la salida: es la que cuenta.',
      salidaFalta: 'Falta la salida.',
      entradaFeriado: 'En un feriado, poné también la entrada.',
      entradaFinde: 'En un sábado o domingo, poné también la entrada.',
      salidaAntes: 'La salida tiene que ser después de la entrada.',
      diaQueNoLlego: 'Ese día todavía no llegó.',
      diaDeLicencia: 'Ese día tenés una licencia de día entero: no se cargan horas.',
      sinDias: 'No hay cambios para guardar.',
      muchosDias: 'Guardá de a 100 días como mucho.',
      diaRepetido: 'Ese día está dos veces.',
      planillaSoloContrato: 'La planilla es para las personas de contrato.',
      contratoEnLaPlanilla: 'Las personas de contrato cargan sus horas en la planilla.',
      mes: 'Elegí un mes válido.',
      alMesAnterior: 'Elegí si este día suma al mes anterior.',
      restituidosFijo: 'Los días restituidos no cambian de tipo.',
      restitucionInvalida: 'Elegí qué días restituidos querés cargar.',
      grupoNoPorRestituir: 'Esos días ya no están para restituir.',
      grupoEsParaRestituir: 'Esos días no se toman: pedí la restitución.',
      grupoEsParaTomar: 'Esos días se toman: cargalos como «Días restituidos».',
      restitucionNoEncontrada: 'Restitución no encontrada',
      restitucionVencida: 'Ya pasó el plazo: la restitución no se puede borrar.'
    });
  });

  it('las funciones de texto de las cargas', () => {
    assert.equal(textoRango('2024-01-01', '2027-12-31'), 'La fecha tiene que ser del 01/01/2024 al 31/12/2027.');
    assert.equal(textoNoEstudia(2026), 'En 2026 elegiste «No estudio»: cambialo en «Mis vacaciones y saldos».');
    assert.equal(textoSuperpuesta('2026-11-05'), 'Ya tenés una licencia cargada el 05/11/2026: corregí la que ya está.');
    assert.equal(textoSinHabilitados('2026-06-15'),
      'No te alcanzan los días habilitados: para el 15/06/2026 no te queda ninguno.');
    // Los errores de días de una carga (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3)
    assert.equal(textoHastaDondeAlcanza('2027-02-24'),
      'No te alcanzan los días habilitados: esta licencia puede llegar hasta el 24/02/2027.');
    assert.equal(textoSinNingunDia('2027-06-21'), 'No te alcanzan los días habilitados para el 21/06/2027.');
    assert.equal(textoSinNingunDia('2027-06-21', null), 'No te alcanzan los días habilitados para el 21/06/2027.');
    assert.equal(textoSinNingunDia('2027-06-21', { fecha: '2027-07-01', anio: 2027, dias: 5 }),
      'No te alcanzan los días habilitados para el 21/06/2027. El 1/7/2027 se habilitan 5 más de la 2027.');
    // Con 1, «se habilita»; una habilitación que no sirve no va
    assert.equal(textoSinNingunDia('2027-06-21', { fecha: '2027-07-01', anio: 2027, dias: 1 }),
      'No te alcanzan los días habilitados para el 21/06/2027. El 1/7/2027 se habilita 1 más de la 2027.');
    assert.equal(textoSinNingunDia('2027-06-21', { fecha: 'x', anio: 2027, dias: 5 }),
      'No te alcanzan los días habilitados para el 21/06/2027.');
    assert.equal(textoSinNingunDia('2027-06-21', { fecha: '2027-07-01', anio: 2027, dias: 0 }),
      'No te alcanzan los días habilitados para el 21/06/2027.');
    // Las fechas de la otra carga como en la lista: el año solo al final si los dos son del mismo; si no, los dos
    assert.equal(textoFaltanEnOtraCarga('2027-01-04', '2027-01-22', '2027-01-20'),
      'Con estos días, a tus vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.');
    assert.equal(textoFaltanEnOtraCarga('2026-12-28', '2027-01-08', '2027-01-04'),
      'Con estos días, a tus vacaciones del 28/12/2026 al 08/01/2027 les faltan días desde el 04/01/2027.');
    // De un solo día, sin «desde»: el día que falta es ese mismo
    assert.equal(textoFaltanEnOtraCarga('2027-01-04', '2027-01-04', '2027-01-04'),
      'Con estos días, a tus vacaciones del 04/01/2027 les faltan días.');
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
    assert.equal(TEXTO_NO_DIA_ENTERO, 'No es el día entero: no pasa a Configuración');
  });

  // Spec 2026-10-28-mi-espacio-licencia-anulada (2.2 y 3.2): sin «Administración», porque pudo haber sido la misma persona
  it('los textos de lo que quedó distinto en Configuración', () => {
    assert.equal(TEXTO_ANULADA_EN_CONFIGURACION, 'Se anuló en Configuración: acá sigue contando. Si ya no va, borrala.');
    assert.equal(textoRevisalaEnConfiguracion('2027-01-04', '2027-01-08'),
      'En Configuración quedó del 04/01 al 08/01: revisala.');
    assert.equal(textoRevisalaEnConfiguracion('2026-12-28', '2027-01-08'),
      'En Configuración quedó del 28/12 al 08/01: revisala.');
    // De un día, «el 17/11», no «del 17/11 al 17/11» (ruling de la revisión final de la spec); los textos de siempre no cambian
    assert.equal(textoRevisalaEnConfiguracion('2026-11-17', '2026-11-17'), 'En Configuración quedó el 17/11: revisala.');
    assert.equal(textoYaNoCubierta('2026-11-18', '2026-11-18'),
      'Ya no está cubierta en Configuración del 18/11 al 18/11: revisala con administración.');
    assert.equal(textoEnConfiguracion('2026-11-17', '2026-11-17'), 'En Configuración: del 17/11 al 17/11.');
    // Lo que no es una fecha, la raya (como el resto de los textos del paso), también si las dos son iguales
    assert.equal(textoRevisalaEnConfiguracion(null, 'x'), 'En Configuración quedó del — al —: revisala.');
    assert.equal(textoRevisalaEnConfiguracion(null, null), 'En Configuración quedó del — al —: revisala.');
    assert.equal(textoRevisalaEnConfiguracion('x', 'x'), 'En Configuración quedó del — al —: revisala.');
  });

  // Spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2 y 3.4: lo que avisa el cálculo de una carga, sin frenarla
  it('los avisos de lo que una carga hace perder o reacomoda', () => {
    const ordinaria2024 = (perdidos) => ({ anio: 2024, perdidos, vence: '2026-12-31' });
    // Los días de vacaciones: la diferencia, como «Perdés …», con «vence» en singular solo con 1
    assert.equal(textoDePerdidosConLaCarga([ordinaria2024(3)]),
      'Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).');
    assert.equal(textoDePerdidosConLaCarga([ordinaria2024(1)]),
      'Con esta licencia perdés 1 de la 2024 (vence el 31/12/2026).');
    assert.equal(textoDePerdidosConLaCarga([ordinaria2024(3), { anio: 2025, perdidos: 0, vence: '2027-12-31' },
      { anio: 2026, perdidos: 5, vence: '2028-12-31' }]),
    'Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026) y 5 de la 2026 (vencen el 31/12/2028).');
    // Sin ninguna con perdidos, ''; «Perdés …» no cambió
    assert.equal(textoDePerdidosConLaCarga([ordinaria2024(0)]), '');
    assert.equal(textoDePerdidosConLaCarga(null), '');
    assert.equal(textoDePerdidos([ordinaria2024(3)]), 'Perdés 3 de la 2024 (vencen el 31/12/2026).');
    // El franco y las horas a favor de un mes, con el último día del mes (no el último hábil)
    assert.equal(textoDelFrancoSinDiasLibres(1, '2026-12'),
      'Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.');
    assert.equal(textoDelFrancoSinDiasLibres(2, '2026-12'),
      'Tus 2 francos de diciembre se quedan sin días libres: vencen el 31/12/2026.');
    assert.equal(textoDelFrancoSinDiasLibres(1, '2027-02'),
      'Tu franco de febrero se queda sin días libres: vence el 28/02/2027.');
    assert.equal(textoDeLasHorasSinDiasLibres(3, '2026-12'),
      'Tus 3 horas a favor de diciembre se quedan sin días libres: vencen el 31/12/2026.');
    assert.equal(textoDeLasHorasSinDiasLibres(1.5, '2026-11'),
      'Tus 1,5 horas a favor de noviembre se quedan sin días libres: vencen el 30/11/2026.');
    assert.equal(textoDeLasHorasSinDiasLibres(1, '2028-02'),
      'Tu hora a favor de febrero se queda sin días libres: vence el 29/02/2028.');
    // Un mes que no es un mes, la raya
    assert.equal(textoDelFrancoSinDiasLibres(1, 'x'), 'Tu franco de — se queda sin días libres: vence el —.');
    // La franquicia, como el email de vencimiento
    assert.equal(textoDeLaFranquiciaPerdida(8, '2026-12-31'),
      'Con esta licencia perdés 8 horas de franquicia (vencen el 31/12/2026).');
    assert.equal(textoDeLaFranquiciaPerdida(1, '2026-12-31'),
      'Con esta licencia perdés 1 hora de franquicia (vence el 31/12/2026).');
    // Las otras cargas, con sus fechas como en la lista
    assert.equal(textoDelReacomodo('2027-01-04', '2027-01-22', [{ anio: 2025, dias: 5 }, { anio: 2026, dias: 10 }]),
      'Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de las licencias 2025 (5 días) y '
      + '2026 (10 días).');
    assert.equal(textoDelReacomodo('2027-01-04', '2027-01-22', [{ anio: 2025, dias: 15 }]),
      'Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de la licencia 2025.');
    assert.equal(textoDelReacomodo('2026-12-28', '2027-01-08', [{ anio: 2025, dias: 1 }, { anio: 2026, dias: 8 }]),
      'Esta carga cambia de dónde salen tus vacaciones del 28/12/2026 al 08/01/2027: ahora de las licencias 2025 (1 día) y '
      + '2026 (8 días).');
    assert.equal(textoDelReacomodo('2027-01-04', '2027-01-04', [{ anio: 2025, dias: 1 }]),
      'Esta carga cambia de dónde salen tus vacaciones del 04/01/2027: ahora de la licencia 2025.');
    // Sin ninguna licencia, no hay qué decir
    assert.equal(textoDelReacomodo('2027-01-04', '2027-01-22', []), '');
    assert.equal(textoDelReacomodo('2027-01-04', '2027-01-22', null), '');
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

  // En el año del arranque, con el arranque desde el 1/7 (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8 y 7, decisión
  // 3), la primera mitad es el saldo que se escribe en «De la AAAA»: el texto lo dice sin número, y la segunda, con el suyo
  it('textoDeLasMitades: en el año del arranque, desde el 1/7, la primera mitad es lo que se pone en «De la AAAA»', () => {
    const arranque = '2026-10-27';
    assert.equal(textoDeLasMitades(2026, 20, { arranque }),
      'La primera mitad es lo que pongas en «De la 2026», más abajo. El 1/1/2027 se habilitan 10.');
    // La segunda mitad, la de mitadesDe: con un número impar, la menor
    const segunda = (dias) => textoDeLasMitades(2026, dias, { arranque }).split('. ')[1];
    assert.deepEqual(DIAS_VACACIONES.map(segunda), [
      'El 1/1/2027 se habilitan 5.', 'El 1/1/2027 se habilitan 7.', 'El 1/1/2027 se habilitan 10.',
      'El 1/1/2027 se habilitan 12.', 'El 1/1/2027 se habilitan 15.'
    ]);
    // El 1/7 justo ya es desde el 1/7; el año y los días de un pedido, como texto, también
    assert.equal(textoDeLasMitades(2026, 20, { arranque: '2026-07-01' }), textoDeLasMitades(2026, 20, { arranque }));
    assert.equal(textoDeLasMitades('2026', '20', { arranque }), textoDeLasMitades(2026, 20, { arranque }));
    assert.equal(textoDeLasMitades(2027, 15, { arranque: '2027-12-31' }),
      'La primera mitad es lo que pongas en «De la 2027», más abajo. El 1/1/2028 se habilitan 7.');
  });

  it('textoDeLasMitades: con el arranque antes del 1/7, en otro año o sin un arranque que sirva, el texto de siempre', () => {
    const deSiempre = textoDeLasMitades(2026, 20);
    for (const arranque of ['2026-03-10', '2026-06-30', '2026-01-01']) {
      assert.equal(textoDeLasMitades(2026, 20, { arranque }), deSiempre, arranque);
    }
    // Los demás años, como siempre, aunque el arranque sea del 1/7 en adelante
    assert.equal(textoDeLasMitades(2025, 20, { arranque: '2026-10-27' }), textoDeLasMitades(2025, 20));
    assert.equal(textoDeLasMitades(2027, 20, { arranque: '2026-10-27' }), textoDeLasMitades(2027, 20));
    for (const opciones of [undefined, null, {}, { arranque: null }, { arranque: '2026-02-30' }, { arranque: '27/10/2026' },
      { arranque: 20261027 }, 'x', [], Object.create(null)]) {
      assert.equal(textoDeLasMitades(2026, 20, opciones), deSiempre, String(opciones?.arranque ?? typeof opciones));
    }
    // Sin unos días de DIAS_VACACIONES o sin un año, null igual
    assert.equal(textoDeLasMitades(2026, 12, { arranque: '2026-10-27' }), null);
    assert.equal(textoDeLasMitades('abc', 20, { arranque: '2026-10-27' }), null);
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

  it('la más vieja primero', () => {
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

  it('una carga que cruza un vencimiento sigue con la que empezó: la 2024 se termina el 04/01', () => {
    // El 01/01 es feriado fijo: la 2024 da el 30/12, el 31/12 y el 04/01, aunque vence el 31/12; el 05/01, la 2026
    const fiestas = vacaciones(100, '2026-12-30', '2027-01-05');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 3, 2025: 0, 2026: 10 }, fiestas),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 3 }, { anio: 2026, dias: 1 }]);
  });

  it('una carga que empieza en diciembre sigue con la 2024 en enero (spec 2026-10-27, punto 3)', () => {
    const casos = [
      ['2026-12-16', '2027-01-10', [{ anio: 2024, dias: 15 }, { anio: 2025, dias: 1 }]],
      ['2026-12-21', '2027-01-10', [{ anio: 2024, dias: 13 }]],
      ['2026-12-23', '2027-01-05', [{ anio: 2024, dias: 8 }]],
      ['2026-12-26', '2027-01-08', [{ anio: 2024, dias: 9 }]] // empieza un sábado: usa la 2024 desde el lunes 28/12
    ];
    for (const [desde, hasta, esperado] of casos) {
      const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
        vacaciones(100, desde, hasta)), { hoy: HOY, feriados: SIN_FERIADOS });
      assert.deepEqual(reparto.porFila.get(100), esperado, `${desde} al ${hasta}`);
      assert.equal(reparto.sinCubrir.size, 0);
    }
  });

  it('dos cargas seguidas no se juntan: la que empieza en enero ya no usa la 2024', () => {
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
      vacaciones(100, '2026-12-21', '2026-12-31'), vacaciones(101, '2027-01-04', '2027-01-10')),
    { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 8 }]);
    assert.deepEqual(reparto.porFila.get(101), [{ anio: 2025, dias: 5 }]);
  });

  it('las cargas se reparten en el orden de sus fechas, no del id', () => {
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 15, 2025: 20, 2026: 10 },
      vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')),
    { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(101), [{ anio: 2024, dias: 2 }]);
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 13 }]);
    // Con 14 en la 2024, la de diciembre (primera por fecha) toma 2 y a la otra le quedan 12: el 08/01 sale de la 2025.
    // Por id, la del 21/12 tomaría 13 y la de diciembre partiría el 02/12 en la 2025
    const justos = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 14, 2025: 20, 2026: 10 },
      vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')),
    { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(justos.porFila.get(101), [{ anio: 2024, dias: 2 }]);
    assert.deepEqual(justos.porFila.get(100), [{ anio: 2024, dias: 12 }, { anio: 2025, dias: 1 }]);
  });

  it('el vencimiento se mira en el primer día que descuenta, no en el desde', () => {
    // Del 31/12/2026 al 08/01/2027: el 31/12 y del 4 al 8/1 (el 1/1 es feriado fijo), todos de la 2024
    const fiestas = vacaciones(100, '2026-12-31', '2027-01-08');
    const conElUltimo = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, fiestas),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(conElUltimo.porFila.get(100), [{ anio: 2024, dias: 6 }]);
    // Con el 31/12 feriado, el primer día que descuenta es el 04/01, ya vencida la 2024: salen de la 2025
    const sinElUltimo = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, fiestas),
      { hoy: HOY, feriados: new Set(['2026-12-31']) });
    assert.deepEqual(sinElUltimo.porFila.get(100), [{ anio: 2025, dias: 5 }]);
  });

  it('sin días de la que venía usando ni otra habilitada, el día queda sin cubrir y la carga sigue después', () => {
    // La 2024 con 3: 28, 29 y 30/12. El 31/12 no hay ninguna. Desde el 1/1/2027, la segunda mitad de la 2026
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', { 2024: 3, 2025: 0, 2026: 0 },
      vacaciones(100, '2026-12-28', '2027-01-08')), { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 3 }, { anio: 2026, dias: 5 }]);
    assert.deepEqual(reparto.sinCubrir.get(100), ['2026-12-31']);
  });

  it('los textos de la spec 2026-10-27 (punto 3)', () => {
    const casos = [
      [[vacaciones(100, '2026-12-16', '2027-01-10')], 100, 'Salen de las licencias 2024 (15 días) y 2025 (1 día), las más '
        + 'viejas. Te quedan 29 días: 19 de la 2025 y 10 de la 2026.'],
      [[vacaciones(100, '2026-12-21', '2027-01-10')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de '
        + 'la 2025 y 10 de la 2026. Perdés 2 de la 2024 (vencen el 31/12/2026).'],
      [[vacaciones(100, '2026-12-23', '2027-01-05')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de '
        + 'la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026).'],
      [[vacaciones(100, '2026-12-14', '2026-12-18')], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 40 días: 10 de '
        + 'la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.'],
      // Sin «la más vieja»: a la 2024 le quedan 7, aunque se pierdan (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.9)
      [[vacaciones(100, '2026-12-21', '2026-12-31'), vacaciones(101, '2027-01-04', '2027-01-10')], 101, 'Salen de la licencia '
        + '2025. Te quedan 25 días: 15 de la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026).'],
      [[vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')], 101, 'Salen de la licencia '
        + '2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026.'],
      [[vacaciones(100, '2026-12-14', '2026-12-18'), { id: 102, tipo: 'medica', desde: '2026-12-21', hasta: '2026-12-31',
        horas: null }], 100, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la 2026. '
        + 'Perdés 10 de la 2024 (vencen el 31/12/2026).']
    ];
    for (const [filas, id, esperado] of casos) assert.equal(textoDeLaCarga(PERSONA, filas, id), esperado);
  });

  it('los perdidos salen de lo disponible; con un día libre antes del vencimiento, no se pierden', () => {
    const cruza = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2027-01-10')),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual([ordinaria(cruza, 2024).disponibles, ordinaria(cruza, 2024).perdidos], [0, 2]);
    assert.equal(ordinaria(cruza, 2025).perdidos, 0);
    assert.equal(disponibles(cruza), 30);
    // Termina el miércoles 30/12: el 31/12 todavía se puede empezar otra carga con lo que queda de la 2024
    const antes = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2026-12-30')),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual([ordinaria(antes, 2024).disponibles, ordinaria(antes, 2024).perdidos], [8, 0]);
    // Con el 31/12 feriado, ya no queda ningún día libre: se pierden los 8
    const conFeriado = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2026-12-30')),
      { hoy: HOY, feriados: new Set(['2026-12-31']) });
    assert.deepEqual([ordinaria(conFeriado, 2024).disponibles, ordinaria(conFeriado, 2024).perdidos], [0, 8]);
  });

  it('el día libre se busca saltando de licencia en licencia: encadenadas, con un hueco, que se pisan o una dentro de otra', () => {
    // Las vacaciones del 14/12 al 18/12 usan 5 de la 2024 y le quedan 10; después, otras licencias del 21/12 en adelante
    const conLaSemana = (...otras) => {
      const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-14', '2026-12-18'),
        ...otras), { hoy: HOY, feriados: SIN_FERIADOS });
      return [ordinaria(reparto, 2024).disponibles, ordinaria(reparto, 2024).perdidos];
    };
    const medica = (desde, hasta) => ({ id: 102, tipo: 'medica', desde, hasta, horas: null });
    const familiar = (desde, hasta) => ({ id: 103, tipo: 'familiar', desde, hasta, horas: null });
    // Encadenadas sin un día hábil libre entre las dos (el 25/12 es feriado fijo; el 26 y el 27, fin de semana)
    assert.deepEqual(conLaSemana(medica('2026-12-21', '2026-12-24'), familiar('2026-12-28', '2026-12-31')), [0, 10]);
    // Con un hueco hábil, el jueves 24/12 libre: una carga que empiece ese día usa los 10
    assert.deepEqual(conLaSemana(medica('2026-12-21', '2026-12-23'), familiar('2026-12-28', '2026-12-31')), [10, 0]);
    // Dos que se pisan
    assert.deepEqual(conLaSemana(medica('2026-12-21', '2026-12-29'), familiar('2026-12-28', '2026-12-31')), [0, 10]);
    // Una dentro de la otra, en los dos órdenes de la lista: después de un salto, la búsqueda vuelve a mirar
    assert.deepEqual(conLaSemana(familiar('2026-12-21', '2026-12-23'), medica('2026-12-21', '2026-12-31')), [0, 10]);
    assert.deepEqual(conLaSemana(medica('2026-12-21', '2026-12-31'), familiar('2026-12-22', '2026-12-23')), [0, 10]);
  });

  it('sin ninguna carga que la use, el día libre se busca desde hoy', () => {
    // Hoy el 31/12/2026, un jueves libre: la 2024 sigue disponible; con una atención médica ese día, se pierde entera
    const libre = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA), { hoy: '2026-12-31', feriados: SIN_FERIADOS });
    assert.deepEqual([ordinaria(libre, 2024).disponibles, ordinaria(libre, 2024).perdidos], [15, 0]);
    const ocupado = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA,
      { id: 102, tipo: 'medica', desde: '2026-12-31', hasta: '2026-12-31', horas: null }),
    { hoy: '2026-12-31', feriados: SIN_FERIADOS });
    assert.deepEqual([ordinaria(ocupado, 2024).disponibles, ordinaria(ocupado, 2024).perdidos], [0, 15]);
  });

  it('una carga anterior cargada después le saca días a la que cruza el año, y ya no se pierde nada', () => {
    const sola = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2027-01-10')),
      { hoy: HOY, feriados: SIN_FERIADOS });
    assert.equal(ordinaria(sola, 2024).perdidos, 2);
    const conLaAnterior = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA,
      vacaciones(100, '2026-12-21', '2027-01-10'), vacaciones(101, '2026-12-01', '2026-12-02')),
    { hoy: HOY, feriados: SIN_FERIADOS });
    assert.deepEqual([ordinaria(conLaAnterior, 2024).disponibles, ordinaria(conLaAnterior, 2024).perdidos], [0, 0]);
  });

  it('una licencia ya vencida a hoy no tiene perdidos, y la carga que cruzó el año no cambia', () => {
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2027-01-10')),
      { hoy: '2027-01-04', feriados: SIN_FERIADOS });
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2024, dias: 13 }]);
    assert.deepEqual([ordinaria(reparto, 2024).disponibles, ordinaria(reparto, 2024).perdidos], [0, 0]);
  });

  it('sin nada disponible: «No te quedan días disponibles.» y después lo que se pierde', () => {
    assert.equal(textoDeLaCarga({ 2024: 15, 2025: 0, 2026: 0 }, [vacaciones(100, '2026-12-23', '2027-01-05')], 100),
      'Salen de la licencia 2024, la más vieja. No te quedan días disponibles. Perdés 7 de la 2024 (vencen el 31/12/2026).');
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

// Los días restituibles (spec 2026-10-31-mi-espacio-dias-restituidos, 4): con Julieta, cuyas vacaciones del 11/12/2026 al
// 08/01/2027 incluyen los asuetos del 24 y el 31/12/2026, cargados después (la foto los guarda)
describe('los días restituibles de una carga (spec 2026-10-31-mi-espacio-dias-restituidos, 4)', () => {
  const ESTADO = JULIETA.estado;
  const [VACACIONES_DE_JULIETA] = ESTADO.licencias;
  const LOS_DOS = ['2026-12-24', '2026-12-31'];
  // Una fila de la foto (las de JULIETA tienen ids 1 y 2: las de los tests, desde el 10)
  const fotoDe = (id, licenciaId, fecha, extra = {}) =>
    ({ id, licencia_id: licenciaId, feriado_id: 1, fecha, tanda: null, restitucion_id: null, ...extra });
  const conFoto = (restituibles, licencias = ESTADO.licencias) => ({ ...ESTADO, restituibles, licencias });
  // Sin foto: el asueto ya estaba cuando se cargaron las vacaciones
  const sinFoto = conFoto([]);

  it('restituiblesDe: los días de la foto que la carga sigue incluyendo y que hoy no son hábiles, por fecha', () => {
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, ESTADO, ASUETOS), LOS_DOS);
    // En otro orden, repetidos o con los ids como texto, lo mismo
    const desordenada = conFoto([fotoDe(10, '1', '2026-12-31'), fotoDe(11, 1, '2026-12-24'), fotoDe(12, 1, '2026-12-31')]);
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, desordenada, ASUETOS), LOS_DOS);
    assert.deepEqual(restituiblesDe({ ...VACACIONES_DE_JULIETA, id: '1' }, ESTADO, ASUETOS), LOS_DOS);
    // La tanda y el pedido no cambian qué días son restituibles (los grupos los arma restitucionesDe)
    const pedida = conFoto(ESTADO.restituibles.map((fila) => ({ ...fila, tanda: 0, restitucion_id: 5 })));
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, pedida, ASUETOS), LOS_DOS);
  });

  it('un día que volvió a ser hábil (el asueto se dio de baja o ese año no rige) ya no se restituye', () => {
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, ESTADO, new Set(['2026-12-31'])), ['2026-12-31']);
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, ESTADO, SIN_FERIADOS), []);
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, ESTADO, undefined), []);
  });

  it('un día que la carga ya no incluye (las vacaciones se acortaron) ya no se restituye', () => {
    assert.deepEqual(restituiblesDe({ ...VACACIONES_DE_JULIETA, hasta: '2026-12-23' }, ESTADO, ASUETOS), []);
    assert.deepEqual(restituiblesDe({ ...VACACIONES_DE_JULIETA, hasta: '2026-12-28' }, ESTADO, ASUETOS), ['2026-12-24']);
    assert.deepEqual(restituiblesDe({ ...VACACIONES_DE_JULIETA, desde: '2026-12-28' }, ESTADO, ASUETOS), ['2026-12-31']);
  });

  it('solo los días que un feriado de la tabla dejó de hacer hábiles: una fila en un sábado o en un fijo no suma', () => {
    // El sábado 26/12 y el viernes 25/12 (Navidad, uno de los 9 fijos) no eran hábiles: la foto no los guarda, y si estuvieran
    // no sumarían, aunque estén en el Set de los feriados
    const conFinde = conFoto([...ESTADO.restituibles, fotoDe(10, 1, '2026-12-26'), fotoDe(11, 1, '2026-12-25')]);
    for (const feriados of [ASUETOS, new Set([...ASUETOS, '2026-12-25', '2026-12-26'])]) {
      assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, conFinde, feriados), LOS_DOS);
      assert.equal(diasDeLaCarga(VACACIONES_DE_JULIETA, conFinde, feriados).length, 19);
    }
  });

  it('en las vacaciones, solo del arranque en adelante (sin arranque, ninguno)', () => {
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, { ...ESTADO, arranque: '2026-12-28' }, ASUETOS), ['2026-12-31']);
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, { ...ESTADO, arranque: '2026-12-24' }, ASUETOS), LOS_DOS);
    assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, { ...ESTADO, arranque: null }, ASUETOS), []);
  });

  it('solo los de esa carga, y solo en las vacaciones y en los días restituidos', () => {
    // Otra carga con las mismas fechas no tiene foto
    assert.deepEqual(restituiblesDe(vacaciones(10, '2026-12-11', '2027-01-08'), ESTADO, ASUETOS), []);
    // Una atención médica con foto (no pasa: la foto es solo de vacaciones y de días restituidos) se recalcula como siempre
    const medica = { id: 11, tipo: 'medica', desde: '2026-12-21', hasta: '2026-12-24', horas: null };
    const conMedica = conFoto([fotoDe(10, 11, '2026-12-24')], [medica]);
    assert.deepEqual(restituiblesDe(medica, conMedica, ASUETOS), []);
    assert.deepEqual(diasDeLaCarga(medica, conMedica, ASUETOS), ['2026-12-21', '2026-12-22', '2026-12-23']);
    // Una carga de días restituidos (la recursión: spec, 4); no es un tipo con saldo inicial, así que no mira el arranque
    const restituidos = { id: 12, tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13', horas: null };
    const conAsueto = new Set([...ASUETOS, '2027-04-12']);
    const recursiva = conFoto([...ESTADO.restituibles, fotoDe(10, 12, '2027-04-12')], [VACACIONES_DE_JULIETA, restituidos]);
    assert.deepEqual(restituiblesDe(restituidos, recursiva, conAsueto), ['2027-04-12']);
    assert.deepEqual(restituiblesDe(restituidos, { ...recursiva, arranque: '2027-05-03' }, conAsueto), ['2027-04-12']);
    assert.deepEqual(diasDeLaCarga(restituidos, recursiva, conAsueto), ['2027-04-12', '2027-04-13']);
  });

  it('una fila sin id, un tipo desconocido o lo que no es un estado: ninguno, sin tirar', () => {
    const { id, ...sinId } = VACACIONES_DE_JULIETA;
    assert.equal(id, 1);
    for (const fila of [sinId, { ...VACACIONES_DE_JULIETA, id: null }, { ...VACACIONES_DE_JULIETA, id: 0 },
      { ...VACACIONES_DE_JULIETA, id: 'x' }, { ...VACACIONES_DE_JULIETA, tipo: 'otro' },
      { ...VACACIONES_DE_JULIETA, desde: '2026-02-30' }, undefined, null, 'x', [], 3]) {
      assert.deepEqual(restituiblesDe(fila, ESTADO, ASUETOS), [], JSON.stringify(fila));
    }
    for (const estado of [undefined, null, '', 'x', 3, [], {}, { ...ESTADO, restituibles: 'x' },
      { ...ESTADO, restituibles: [null, 3, 'x', {}, fotoDe(10, 1, '24/12/2026'), fotoDe(11, null, '2026-12-24')] }]) {
      assert.deepEqual(restituiblesDe(VACACIONES_DE_JULIETA, estado, ASUETOS), [], JSON.stringify(estado));
    }
    for (const raro of [undefined, null, 'x', [], 3, {}]) {
      assert.deepEqual(diasDeLaCarga(raro, ESTADO, ASUETOS), [], JSON.stringify(raro));
      assert.doesNotThrow(() => diasDeLaCarga(VACACIONES_DE_JULIETA, raro, raro));
    }
  });

  it('diasDeLaCarga: los días hábiles más los restituibles, por fecha y sin repetir', () => {
    const dias = diasDeLaCarga(VACACIONES_DE_JULIETA, ESTADO, ASUETOS);
    assert.equal(dias.length, 19);
    assert.ok(dias.includes('2026-12-24') && dias.includes('2026-12-31'));
    assert.deepEqual(dias, [...dias].sort());
    assert.equal(new Set(dias).size, dias.length);
    // Sin foto, los días hábiles (como siempre); sin los asuetos, los mismos 19 (son hábiles)
    assert.equal(diasDeLaCarga(VACACIONES_DE_JULIETA, sinFoto, ASUETOS).length, 17);
    assert.deepEqual(diasDeLaCarga(VACACIONES_DE_JULIETA, ESTADO, SIN_FERIADOS), dias);
  });

  // Review Focus 1: las vacaciones conservan sus días. Sin foto (el asueto ya estaba), todo se recalcula como siempre
  it('las vacaciones conservan sus 19 días: diasQueDescuentan, el reparto y la licencia de cada día (porFecha)', () => {
    assert.equal(diasQueDescuentan(VACACIONES_DE_JULIETA, sinFoto, SIN_FERIADOS).length, 19);
    assert.equal(diasQueDescuentan(VACACIONES_DE_JULIETA, sinFoto, ASUETOS).length, 17);
    const dias = diasQueDescuentan(VACACIONES_DE_JULIETA, ESTADO, ASUETOS);
    assert.deepEqual(dias, diasDeLaCarga(VACACIONES_DE_JULIETA, ESTADO, ASUETOS));
    assert.equal(dias.length, 19);

    const reparto = repartoDeVacaciones(ESTADO, { hoy: '2027-01-11', feriados: ASUETOS });
    assert.deepEqual(reparto.porFila.get(1), [{ anio: 2024, dias: 19 }]);
    assert.equal(reparto.sinCubrir.size, 0);
    const porFecha = reparto.porFecha.get(1);
    assert.ok(porFecha instanceof Map);
    assert.deepEqual([...porFecha.keys()], dias);
    assert.equal(porFecha.get('2026-12-24'), 2024);
    assert.equal(porFecha.get('2026-12-31'), 2024);
    assert.ok([...porFecha.values()].every((anio) => anio === 2024));
    // Con el id de la fila como texto (el de un pedido), los Map van con el id como número, con los mismos 19 días
    const conIdDeTexto = conFoto(ESTADO.restituibles, [{ ...VACACIONES_DE_JULIETA, id: '1' }]);
    const delTexto = repartoDeVacaciones(conIdDeTexto, { hoy: '2027-01-11', feriados: ASUETOS });
    assert.deepEqual(delTexto.porFila.get(1), [{ anio: 2024, dias: 19 }]);
    assert.ok(delTexto.porFecha.get(1) instanceof Map);
    assert.deepEqual([...delTexto.porFecha.get(1)], [...porFecha]);
    assert.equal(delTexto.porFila.has('1'), false);
    // Sin foto, el reparto de siempre: 17 días de la 2024
    const sinLaFoto = repartoDeVacaciones(sinFoto, { hoy: '2027-01-11', feriados: ASUETOS });
    assert.deepEqual(sinLaFoto.porFila.get(1), [{ anio: 2024, dias: 17 }]);
    assert.equal(sinLaFoto.porFecha.get(1).size, 17);
    assert.equal(sinLaFoto.porFecha.get(1).has('2026-12-24'), false);
  });

  it('porFecha: los días sin cubrir no están, y una carga sin días tiene su Map vacío', () => {
    // Con 10 de la 2025 y nada de la 2026 hasta el 1/1: la 2025 cubre hasta el 24/12, del 28/12 al 31/12 no queda ninguna y
    // en enero, la 2026
    const otrasLicencias = { ...ESTADO, saldos: saldosDeVacaciones({ 2024: 0, 2025: 10, 2026: 0 }) };
    const reparto = repartoDeVacaciones(otrasLicencias, { hoy: '2027-01-11', feriados: ASUETOS });
    const porFecha = reparto.porFecha.get(1);
    assert.deepEqual(reparto.sinCubrir.get(1), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    assert.equal(porFecha.size, 15);
    for (const fecha of reparto.sinCubrir.get(1)) assert.equal(porFecha.has(fecha), false, fecha);
    assert.equal(porFecha.get('2026-12-24'), 2025);
    assert.equal(porFecha.get('2027-01-04'), 2026);
    // Antes del arranque no descuenta: sin días, sin ninguna fecha
    const antes = repartoDeVacaciones({ ...ESTADO, arranque: '2027-02-01' }, { hoy: '2027-01-11', feriados: ASUETOS });
    assert.equal(antes.porFecha.get(1).size, 0);
    assert.equal(repartoDeVacaciones(null).porFecha.size, 0);
  });

  it('sin faltantes ni «Perdés», con hoy el 22/12/2026 (antes del vencimiento de la 2024) y al volver, el 11/01/2027', () => {
    const calculo = calcular(ESTADO, { hoy: '2026-12-22', feriados: ASUETOS });
    assert.deepEqual(calculo.faltantes, []);
    assert.equal(textoDePerdidos(calculo.reparto.ordinarias), '');
    assert.equal(ordinaria(calculo.reparto, 2024).perdidos, 0);
    assert.deepEqual(calcular(ESTADO, { hoy: '2027-01-11', feriados: ASUETOS }).faltantes, []);
    // Sin foto, los 2 días que libera el asueto se perderían (como hasta ahora)
    const sinLaFoto = calcular(sinFoto, { hoy: '2026-12-22', feriados: ASUETOS });
    assert.equal(textoDePerdidos(sinLaFoto.reparto.ordinarias), 'Perdés 2 de la 2024 (vencen el 31/12/2026).');
  });

  it('el cálculo de «Cargar licencia» de las mismas vacaciones sigue diciendo 19 días', () => {
    const { error, vista } = evaluarLicencia(ESTADO, { tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' },
      { hoy: '2026-12-22', feriados: ASUETOS, editadaId: 1 });
    assert.equal(error, null);
    assert.equal(vista.dias_habiles, 19);
    assert.equal(vista.texto_dias, '19 días hábiles de 29 corridos');
    assert.match(vista.texto_reparto, /^Salen de la licencia 2024/);
    assert.ok(!vista.texto_reparto.includes('Perdés'), vista.texto_reparto);
    // Sin foto, 17
    const sinLaFoto = evaluarLicencia(sinFoto, { tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' },
      { hoy: '2026-12-22', feriados: ASUETOS, editadaId: 1 });
    assert.equal(sinLaFoto.vista.texto_dias, '17 días hábiles de 29 corridos');
  });

  it('validarLicencia: los días restituidos no se cargan por acá; una corrección de un día restituible tiene días', () => {
    const contexto = { hoy: '2026-12-22', estado: ESTADO, feriados: ASUETOS };
    const tipo = { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipo };
    const restituidos = { tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13' };
    for (const extra of [{}, { uso_autorizado: true }, { editadaId: 1 }, { estado: { ...ESTADO, modalidad: 'contrato' } }]) {
      assert.deepEqual(validarLicencia(restituidos, { ...contexto, ...extra }).error, tipo, JSON.stringify(extra));
    }
    // Unas vacaciones de un solo día, el 24/12, cargadas antes del asueto
    const deUnDia = vacaciones(10, '2026-12-24', '2026-12-24');
    const estado = conFoto([fotoDe(10, 10, '2026-12-24')], [deUnDia]);
    const entrada = { tipo: 'vacaciones', desde: '2026-12-24', hasta: '2026-12-24', nota: 'Turno' };
    for (const editadaId of [10, '10']) {
      const corregida = validarLicencia(entrada, { ...contexto, estado, editadaId });
      assert.equal(corregida.error, null, String(editadaId));
      assert.equal(corregida.datos.nota, 'Turno');
    }
    // Una carga nueva ese día no tiene días hábiles: la foto es de la carga guardada
    assert.deepEqual(validarLicencia(entrada, { ...contexto, estado: { ...estado, licencias: [] } }).error,
      { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.sinDiasHabiles });
    // Ni una corrección de otra carga
    assert.deepEqual(validarLicencia(entrada, { ...contexto, estado, editadaId: 11 }).error,
      { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.sinDiasHabiles });
  });
});

// Los grupos de los días por restituir (spec 2026-10-31-mi-espacio-dias-restituidos, 4, con las decisiones del constructor del
// plan: las tandas se sellan al pedir y el primer asueto de una tanda es el más temprano de sus días por restituir y de sus
// pedidos activos). Con Julieta: sus vacaciones del 11/12/2026 al 08/01/2027 salen todas de la 2024 (vence el 31/12/2026), y
// los asuetos del 24 y el 31/12/2026 se cargaron después
describe('los días restituidos: el plazo, el caso, los grupos y las tandas (spec 2026-10-31-mi-espacio-dias-restituidos, 4)', () => {
  const ESTADO = JULIETA.estado;
  const [VACACIONES_DE_JULIETA] = ESTADO.licencias;
  const VUELVE = '2027-01-11';
  const LOS_DOS = ['2026-12-24', '2026-12-31'];
  const DE_JULIETA = Object.freeze({ tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' });
  // Una fila de la foto (las de JULIETA tienen ids 1 y 2: las de los tests, desde el 10), un pedido (desde el 10) y una
  // carga de días restituidos (desde el 20)
  const fotoDe = (id, licenciaId, fecha, extra = {}) =>
    ({ id, licencia_id: licenciaId, feriado_id: 1, fecha, tanda: null, restitucion_id: null, ...extra });
  const pedidoDe = (id, extra = {}) => ({
    id, licencia_id: 1, anio: 2025, caso: 'restituir', dias: 2, primer_asueto: '2026-12-24', tanda: 0, fecha: '2027-01-11',
    carga_id: null, activo: 1, licencia: { ...DE_JULIETA, activo: 1 }, ...extra
  });
  const restituidos = (id, desde, hasta) => ({ id, tipo: 'restituidos', desde, hasta, horas: null });
  // La foto de Julieta sellada en una tanda y enlazada a un pedido (o sin pedido, con null)
  const fotoSellada = (restitucionId, tanda = 0) =>
    ESTADO.restituibles.map((fila) => ({ ...fila, tanda, restitucion_id: restitucionId }));
  const con = (cambios) => ({ ...ESTADO, ...cambios });
  // La variante B (spec, 5): las mismas vacaciones, con 20 de la 2025 y sin saldo de la 2024
  const VARIANTE_B = con({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 20, 2026: 10 }) });
  const gruposDe = (estado, hoy = VUELVE, feriados = ASUETOS) => restitucionesDe(estado, { hoy, feriados });
  // Lo que distingue a los grupos, para compararlos en una línea
  const resumido = (grupos) => grupos.map(({ clave, caso, situacion, fechas, primer_asueto, plazo }) =>
    [clave, caso, situacion, fechas, primer_asueto, plazo]);
  // El grupo de Julieta al volver: los 2 días de la 2024, que vence antes del plazo (caso A)
  const GRUPO_DE_JULIETA = Object.freeze({
    clave: '1-2024-0', licencia_id: 1, anio: 2024, tanda: 0, caso: 'tomar', dias: 2, fechas: LOS_DOS,
    primer_asueto: '2026-12-24', plazo: '2027-04-30', situacion: 'por_restituir', restitucion_id: null, carga_id: null,
    fecha_pedido: null, revisar: '', carga: DE_JULIETA
  });

  it('plazoDeRestitucion: el último día hábil del mes que está 4 meses después del primer asueto', () => {
    assert.equal(PLAZO_DE_RESTITUCION_EN_MESES, 4);
    assert.equal(plazoDeRestitucion('2026-12-24', ASUETOS), '2027-04-30');
    assert.equal(plazoDeRestitucion('2026-12-01', SIN_FERIADOS), '2027-04-30');
    // El 30/04/2026 es feriado provincial («Plebiscito de 1902», en la precarga)
    const plebiscito = FILAS_PRECARGA.filter((fila) => fila.fecha === '2026-04-30');
    assert.equal(plebiscito.length, 1);
    const conPlebiscito = feriadosDelRango(plebiscito, '2026-01-01', '2026-12-31');
    assert.equal(plazoDeRestitucion('2025-12-24', conPlebiscito), '2026-04-29');
    assert.equal(plazoDeRestitucion('2025-12-24', SIN_FERIADOS), '2026-04-30');
    // Julio de 2027 termina un sábado; febrero de 2028 tiene 29 días
    assert.equal(plazoDeRestitucion('2027-03-12', SIN_FERIADOS), '2027-07-30');
    assert.equal(plazoDeRestitucion('2027-10-31', SIN_FERIADOS), '2028-02-29');
    // Un feriado cargado en el último día lo corre al hábil anterior
    assert.equal(plazoDeRestitucion('2026-12-24', new Set([...ASUETOS, '2027-04-30'])), '2027-04-29');
    for (const raro of [undefined, null, '', 'x', 3, [], {}, '2026-02-30', '24/12/2026']) {
      assert.equal(plazoDeRestitucion(raro, ASUETOS), null, JSON.stringify(raro));
    }
  });

  it('casoDeRestitucion: tomarlos si la licencia vence antes del plazo; si no (también el mismo día), restituirlos', () => {
    assert.equal(casoDeRestitucion(2024, '2027-04-30'), 'tomar');
    assert.equal(casoDeRestitucion(2025, '2027-04-30'), 'restituir');
    // Con un asueto del 15/10/2027 el plazo es el 29/02/2028, después del vencimiento de la 2025
    assert.equal(plazoDeRestitucion('2027-10-15', SIN_FERIADOS), '2028-02-29');
    assert.equal(casoDeRestitucion(2025, '2028-02-29'), 'tomar');
    // El borde: vence el mismo día que el plazo
    assert.equal(casoDeRestitucion(2024, '2026-12-31'), 'restituir');
    assert.equal(casoDeRestitucion('2024', '2027-04-30'), 'tomar');
    for (const raro of [undefined, null, '', 'x', [], {}, 2024.5, '24']) {
      assert.equal(casoDeRestitucion(raro, '2027-04-30'), null, JSON.stringify(raro));
      assert.equal(casoDeRestitucion(2024, raro), null, JSON.stringify(raro));
    }
  });

  it('fechasDeLosAsuetos: los días de un mismo mes van solos y el último de cada mes (o de cada año) con su fecha', () => {
    assert.equal(fechasDeLosAsuetos(LOS_DOS), '24 y el 31/12/2026');
    assert.equal(fechasDeLosAsuetos(LOS_DOS, { conMes: true }), '24/12 y el 31/12/2026');
    const cuatro = ['2025-12-24', '2025-12-26', '2025-12-31', '2026-01-02'];
    assert.equal(fechasDeLosAsuetos(cuatro), '24, el 26, el 31/12/2025 y el 02/01/2026');
    assert.equal(fechasDeLosAsuetos(cuatro, { conMes: true }), '24/12, el 26/12, el 31/12/2025 y el 02/01/2026');
    // Dos meses del mismo año
    assert.equal(fechasDeLosAsuetos(['2026-11-30', '2026-12-24']), '30/11/2026 y el 24/12/2026');
    assert.equal(fechasDeLosAsuetos(['2026-11-30', '2026-12-24'], { conMes: true }), '30/11 y el 24/12/2026');
    // Una sola, con su fecha entera en las dos formas
    assert.equal(fechasDeLosAsuetos(['2026-12-24']), '24/12/2026');
    assert.equal(fechasDeLosAsuetos(['2026-12-24'], { conMes: true }), '24/12/2026');
    // Desordenadas, repetidas o con algo que no es una fecha, lo mismo
    assert.equal(fechasDeLosAsuetos(['2026-12-31', 'x', '2026-12-24', '2026-12-31', null]), '24 y el 31/12/2026');
    assert.equal(fechasDeLosAsuetos(LOS_DOS, { conMes: 'sí' }), '24 y el 31/12/2026');
    for (const raro of [undefined, null, '', 'x', 3, [], {}, ['x']]) assert.equal(fechasDeLosAsuetos(raro), '');
  });

  it('Julieta, al volver: un grupo por restituir del caso A, con los 2 días de la 2024 y su plazo', () => {
    assert.deepEqual(gruposDe(ESTADO), [GRUPO_DE_JULIETA]);
    // El día en que se cargaron los asuetos, y hasta el plazo inclusive, lo mismo
    assert.deepEqual(gruposDe(ESTADO, '2026-12-22'), [GRUPO_DE_JULIETA]);
    assert.deepEqual(gruposDe(ESTADO, '2027-04-30'), [GRUPO_DE_JULIETA]);
    // Pasado el plazo sin pedir nada, se pierden
    assert.deepEqual(gruposDe(ESTADO, '2027-05-03'), [{ ...GRUPO_DE_JULIETA, situacion: 'perdida' }]);
    // Con el reparto de calcular, lo mismo que calculándolo
    const opciones = { hoy: VUELVE, feriados: ASUETOS };
    const reparto = repartoDeVacaciones(ESTADO, opciones);
    assert.deepEqual(restitucionesDe(ESTADO, { ...opciones, reparto }), [GRUPO_DE_JULIETA]);
    const calculo = calcular(ESTADO, opciones);
    assert.deepEqual(calculo.restituciones, [GRUPO_DE_JULIETA]);
    assert.deepEqual(calculo.restituciones, restitucionesDe(ESTADO, { ...opciones, reparto: calculo.reparto }));
    // Sin foto (el asueto ya estaba cuando se cargaron las vacaciones), nada
    assert.deepEqual(gruposDe(con({ restituibles: [] })), []);
  });

  it('la variante B: los días de la 2025 vencen después del plazo, así que se pide la restitución', () => {
    assert.deepEqual(gruposDe(VARIANTE_B), [{ ...GRUPO_DE_JULIETA, clave: '1-2025-0', anio: 2025, caso: 'restituir' }]);
  });

  it('dos licencias de origen en la misma tanda: un grupo por licencia, con el plazo del primer asueto', () => {
    // 12 de la 2024 y 7 de la 2025: el 24/12 sale de la 2024 y el 31/12, de la 2025
    const dosLicencias = con({ saldos: saldosDeVacaciones({ 2024: 12, 2025: 15, 2026: 10 }) });
    assert.deepEqual(resumido(gruposDe(dosLicencias)), [
      ['1-2024-0', 'tomar', 'por_restituir', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2025-0', 'restituir', 'por_restituir', ['2026-12-31'], '2026-12-24', '2027-04-30']
    ]);
    // Con los asuetos del 24/12 y del 04/01/2027: el del 04/01 solo tendría plazo el 31/05/2027, pero es de la misma tanda
    const feriados = new Set(['2026-12-24', '2027-01-04']);
    const conEnero = { ...dosLicencias, restituibles: [ESTADO.restituibles[0], fotoDe(10, 1, '2027-01-04')] };
    assert.deepEqual(resumido(gruposDe(conEnero, VUELVE, feriados)), [
      ['1-2024-0', 'tomar', 'por_restituir', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2025-0', 'restituir', 'por_restituir', ['2027-01-04'], '2026-12-24', '2027-04-30']
    ]);
    assert.equal(plazoDeRestitucion('2027-01-04', feriados), '2027-05-31');
  });

  it('pedir una de las dos licencias no le cambia el plazo a la otra (decisión 11)', () => {
    const feriados = new Set(['2026-12-24', '2027-01-04']);
    const hoy = '2027-02-05';
    // Dos del caso B: 12 de la 2025 (hasta el 29/12, con el 24/12) y 7 de la 2026 (desde el 30/12, con el 04/01)
    const dosB = con({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 12, 2026: 10 }) });
    const sinPedir = { ...dosB, restituibles: [ESTADO.restituibles[0], fotoDe(10, 1, '2027-01-04')] };
    assert.deepEqual(resumido(gruposDe(sinPedir, hoy, feriados)), [
      ['1-2025-0', 'restituir', 'por_restituir', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2026-0', 'restituir', 'por_restituir', ['2027-01-04'], '2026-12-24', '2027-04-30']
    ]);
    // Pedida la de la 2025 (la foto se selló en la tanda 0 y su día quedó enlazado), la de la 2026 conserva el plazo del 24/12
    const pedidaLa2025 = {
      ...dosB,
      restituibles: [{ ...ESTADO.restituibles[0], tanda: 0, restitucion_id: 10 }, fotoDe(10, 1, '2027-01-04', { tanda: 0 })],
      restituciones: [pedidoDe(10, { dias: 1, fecha: '2027-02-01' })]
    };
    const grupos = gruposDe(pedidaLa2025, hoy, feriados);
    assert.deepEqual(resumido(grupos), [
      ['1-2025-0', 'restituir', 'pedida', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2026-0', 'restituir', 'por_restituir', ['2027-01-04'], '2026-12-24', '2027-04-30']
    ]);
    assert.deepEqual(grupos[0], {
      clave: '1-2025-0', licencia_id: 1, anio: 2025, tanda: 0, caso: 'restituir', dias: 1, fechas: ['2026-12-24'],
      primer_asueto: '2026-12-24', plazo: '2027-04-30', situacion: 'pedida', restitucion_id: 10, carga_id: null,
      fecha_pedido: '2027-02-01', revisar: '', carga: DE_JULIETA
    });

    // Lo mismo con una del caso A: cargados los días de la 2024, la de la 2025 conserva el plazo del 24/12
    const dosLicencias = con({
      saldos: saldosDeVacaciones({ 2024: 12, 2025: 15, 2026: 10 }),
      licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-12', '2027-04-12')],
      restituibles: [{ ...ESTADO.restituibles[0], tanda: 0, restitucion_id: 10 }, fotoDe(10, 1, '2027-01-04', { tanda: 0 })],
      restituciones: [pedidoDe(10, { anio: 2024, caso: 'tomar', dias: 1, fecha: '2027-02-01', carga_id: 20 })]
    });
    const conLaCarga = gruposDe(dosLicencias, hoy, feriados);
    assert.deepEqual(resumido(conLaCarga), [
      ['1-2024-0', 'tomar', 'cargada', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2025-0', 'restituir', 'por_restituir', ['2027-01-04'], '2026-12-24', '2027-04-30']
    ]);
    assert.deepEqual([conLaCarga[0].restitucion_id, conLaCarga[0].carga_id, conLaCarga[0].fecha_pedido], [10, 20, '2027-02-01']);
  });

  it('otro asueto después de pedir arma una tanda nueva, con su propio plazo (decisión 12)', () => {
    const feriados = new Set([...ASUETOS, '2027-01-04']);
    // La variante B con la restitución pedida el 11/01; el asueto del 04/01 se cargó después (su foto quedó abierta)
    const estado = {
      ...VARIANTE_B,
      restituibles: [...fotoSellada(10), fotoDe(12, 1, '2027-01-04')],
      restituciones: [pedidoDe(10)]
    };
    const grupos = gruposDe(estado, '2027-01-20', feriados);
    assert.deepEqual(resumido(grupos), [
      ['1-2025-0', 'restituir', 'pedida', LOS_DOS, '2026-12-24', '2027-04-30'],
      ['1-2025-1', 'restituir', 'por_restituir', ['2027-01-04'], '2027-01-04', '2027-05-31']
    ]);
    assert.deepEqual(grupos.map((grupo) => grupo.tanda), [0, 1]);
  });

  it('borrar el pedido devuelve sus días a «por restituir» con su plazo de siempre, y sigue separando las tandas', () => {
    const feriados = new Set([...ASUETOS, '2027-01-04']);
    // El pedido dado de baja: sus días quedaron sellados en la tanda 0, sin pedido; el del 04/01 sigue abierto
    const estado = {
      ...VARIANTE_B,
      restituibles: [...fotoSellada(null), fotoDe(12, 1, '2027-01-04')],
      restituciones: [pedidoDe(10, { activo: 0 })]
    };
    assert.deepEqual(resumido(gruposDe(estado, '2027-01-20', feriados)), [
      ['1-2025-0', 'restituir', 'por_restituir', LOS_DOS, '2026-12-24', '2027-04-30'],
      ['1-2025-1', 'restituir', 'por_restituir', ['2027-01-04'], '2027-01-04', '2027-05-31']
    ]);
    // Sin el otro asueto: el grupo de siempre; con la foto todavía enlazada al pedido dado de baja, lo mismo
    const borrado = { ...VARIANTE_B, restituibles: fotoSellada(null), restituciones: [pedidoDe(10, { activo: 0 })] };
    const esperado = [['1-2025-0', 'restituir', 'por_restituir', LOS_DOS, '2026-12-24', '2027-04-30']];
    assert.deepEqual(resumido(gruposDe(borrado, '2027-01-20')), esperado);
    assert.deepEqual(resumido(gruposDe({ ...borrado, restituibles: fotoSellada(10) }, '2027-01-20')), esperado);
    // Pasado el plazo, perdidos
    assert.deepEqual(gruposDe(borrado, '2027-05-03').map((grupo) => grupo.situacion), ['perdida']);
  });

  it('un pedido del caso A cuya carga de días restituidos ya no está activa cuenta como suelto', () => {
    const pedidoA = pedidoDe(10, { anio: 2024, caso: 'tomar', fecha: '2027-02-01', carga_id: 20 });
    const conLaCarga = con({
      licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-12', '2027-04-13')],
      restituibles: fotoSellada(10),
      restituciones: [pedidoA]
    });
    assert.deepEqual(resumido(gruposDe(conLaCarga, '2027-02-05')),
      [['1-2024-0', 'tomar', 'cargada', LOS_DOS, '2026-12-24', '2027-04-30']]);
    // Sin la carga (la anularon en Configuración, o algo la dio de baja sin soltar el pedido): por restituir hasta el plazo
    const sinLaCarga = { ...conLaCarga, licencias: [VACACIONES_DE_JULIETA] };
    assert.deepEqual(gruposDe(sinLaCarga, '2027-02-05'), [GRUPO_DE_JULIETA]);
    assert.deepEqual(gruposDe(sinLaCarga, '2027-05-03'), [{ ...GRUPO_DE_JULIETA, situacion: 'perdida' }]);
    // Un pedido A sin carga, lo mismo
    const sinCargaId = { ...sinLaCarga, restituciones: [{ ...pedidoA, carga_id: null }] };
    assert.deepEqual(gruposDe(sinCargaId, '2027-02-05'), [GRUPO_DE_JULIETA]);
  });

  it('los cambios antes de pedir se acomodan solos: acortar, alargar, borrar, la baja del asueto y «no rige»', () => {
    // Acortadas al 28/12, el 31/12 ya no está
    const acortadas = { ...VACACIONES_DE_JULIETA, hasta: '2026-12-28' };
    const [delAcortado] = gruposDe(con({ licencias: [acortadas] }));
    assert.deepEqual([delAcortado.fechas, delAcortado.dias, delAcortado.carga.hasta], [['2026-12-24'], 1, '2026-12-28']);
    // Alargadas hasta un feriado que ya estaba (sin foto): ese día no se restituye
    const alargadas = { ...VACACIONES_DE_JULIETA, hasta: '2027-01-15' };
    assert.deepEqual(resumido(gruposDe(con({ licencias: [alargadas] }), VUELVE, new Set([...ASUETOS, '2027-01-12']))),
      [['1-2024-0', 'tomar', 'por_restituir', LOS_DOS, '2026-12-24', '2027-04-30']]);
    // Borradas, nada
    assert.deepEqual(gruposDe(con({ licencias: [] })), []);
    // El asueto del 31/12 dado de baja: queda el 24/12 (y al revés, con el del 24/12 que ese año no rige, el 31/12)
    assert.deepEqual(resumido(gruposDe(ESTADO, VUELVE, new Set(['2026-12-24']))),
      [['1-2024-0', 'tomar', 'por_restituir', ['2026-12-24'], '2026-12-24', '2027-04-30']]);
    assert.deepEqual(resumido(gruposDe(ESTADO, VUELVE, new Set(['2026-12-31']))),
      [['1-2024-0', 'tomar', 'por_restituir', ['2026-12-31'], '2026-12-31', '2027-04-30']]);
    assert.deepEqual(gruposDe(ESTADO, VUELVE, SIN_FERIADOS), []);
    // Una carga anterior al arranque, de otra persona (otro id) o de otro tipo, nada
    assert.deepEqual(gruposDe(con({ arranque: '2027-01-11' })), []);
    assert.deepEqual(gruposDe(con({ restituibles: ESTADO.restituibles.map((fila) => ({ ...fila, licencia_id: 9 })) })), []);
    const medica = { ...VACACIONES_DE_JULIETA, tipo: 'medica' };
    assert.deepEqual(gruposDe(con({ licencias: [medica] })), []);
  });

  it('ya pedidos, quedan como están y el texto dice qué revisar, en orden', () => {
    const hoy = '2027-01-20';
    const pedida = { ...VARIANTE_B, restituibles: fotoSellada(10), restituciones: [pedidoDe(10)] };
    const revisarDe = (estado, feriados = ASUETOS) => {
      const grupos = gruposDe(estado, hoy, feriados);
      assert.deepEqual(grupos.map((grupo) => [grupo.situacion, grupo.fechas]), [['pedida', LOS_DOS]]);
      return grupos[0].revisar;
    };
    assert.equal(revisarDe(pedida), '');
    // Las vacaciones ya no están cargadas (la carga, la del pedido)
    const borradas = { ...pedida, licencias: [] };
    assert.equal(revisarDe(borradas),
      'Revisá tus días restituidos: las vacaciones del 11/12/2026 al 08/01/2027 ya no están cargadas.');
    assert.deepEqual(gruposDe(borradas, hoy)[0].carga, DE_JULIETA);
    // Una fecha quedó fuera de las vacaciones
    const hasta28 = { ...pedida, licencias: [{ ...VACACIONES_DE_JULIETA, hasta: '2026-12-28' }] };
    assert.equal(revisarDe(hasta28), 'Revisá tus días restituidos: tus vacaciones ya no incluyen el 31/12/2026.');
    const hasta23 = { ...pedida, licencias: [{ ...VACACIONES_DE_JULIETA, hasta: '2026-12-23' }] };
    assert.equal(revisarDe(hasta23), 'Revisá tus días restituidos: tus vacaciones ya no incluyen el 24/12 y el 31/12/2026.');
    // Volvió a ser hábil
    assert.equal(revisarDe(pedida, new Set(['2026-12-31'])),
      'Revisá tus días restituidos: el asueto del 24/12/2026 se dio de baja.');
    assert.equal(revisarDe(pedida, SIN_FERIADOS),
      'Revisá tus días restituidos: los asuetos del 24/12 y el 31/12/2026 se dieron de baja.');
    // El primero que haya, en ese orden
    assert.equal(revisarDe(borradas, SIN_FERIADOS),
      'Revisá tus días restituidos: las vacaciones del 11/12/2026 al 08/01/2027 ya no están cargadas.');
    assert.equal(revisarDe(hasta28, SIN_FERIADOS),
      'Revisá tus días restituidos: tus vacaciones ya no incluyen el 31/12/2026.');
    // El plazo se recalcula con los feriados de hoy
    assert.equal(gruposDe(pedida, hoy, new Set([...ASUETOS, '2027-04-30']))[0].plazo, '2027-04-29');
  });

  it('un pedido B que ya pasó su plazo no lleva «Revisá…» (no se puede borrar); una carga A, sí', () => {
    const pedida = { ...VARIANTE_B, restituibles: fotoSellada(10), restituciones: [pedidoDe(10)] };
    const revisarDe = (estado, hoy, feriados) => gruposDe(estado, hoy, feriados).map(({ situacion, revisar }) =>
      [situacion, revisar]);
    // Hasta el plazo inclusive, el texto; desde el día siguiente, nada, sea cual sea el problema
    assert.deepEqual(revisarDe(pedida, '2027-04-30', SIN_FERIADOS),
      [['pedida', 'Revisá tus días restituidos: los asuetos del 24/12 y el 31/12/2026 se dieron de baja.']]);
    for (const estado of [pedida, { ...pedida, licencias: [] }]) {
      for (const feriados of [ASUETOS, SIN_FERIADOS]) {
        assert.deepEqual(revisarDe(estado, '2027-05-03', feriados), [['pedida', '']]);
      }
    }
    // Una carga A se puede borrar o corregir siempre: el texto sigue después del plazo
    const cargada = con({
      licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-12', '2027-04-13')],
      restituibles: fotoSellada(10),
      restituciones: [pedidoDe(10, { anio: 2024, caso: 'tomar', fecha: '2027-02-01', carga_id: 20 })]
    });
    assert.deepEqual(revisarDe(cargada, '2027-05-03', new Set(['2026-12-31'])),
      [['cargada', 'Revisá tus días restituidos: el asueto del 24/12/2026 se dio de baja.']]);
  });

  it('la recursión: un asueto que cae en una carga de días restituidos arma su grupo, siempre del caso A (Review Focus 7)', () => {
    const hoy = '2027-04-08';
    const feriados = new Set([...ASUETOS, '2027-04-12']);
    const cargaA = restituidos(20, '2027-04-12', '2027-04-13');
    const pedidoA = pedidoDe(10, { anio: 2024, caso: 'tomar', fecha: '2027-02-01', carga_id: 20 });
    const estado = con({
      licencias: [VACACIONES_DE_JULIETA, cargaA],
      restituibles: [...fotoSellada(10), fotoDe(12, 20, '2027-04-12')],
      restituciones: [pedidoA]
    });
    const grupos = gruposDe(estado, hoy, feriados);
    assert.deepEqual(resumido(grupos), [
      ['1-2024-0', 'tomar', 'cargada', LOS_DOS, '2026-12-24', '2027-04-30'],
      ['20-2024-0', 'tomar', 'por_restituir', ['2027-04-12'], '2027-04-12', '2027-08-31']
    ]);
    assert.deepEqual(grupos[1].carga, { tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13' });
    assert.deepEqual([grupos[1].licencia_id, grupos[1].anio, grupos[1].dias, grupos[1].revisar], [20, 2024, 1, '']);
    // Siempre A, aunque el año de su pedido venciera después del plazo
    const conLa2025 = { ...estado, restituciones: [{ ...pedidoA, anio: 2025 }] };
    assert.equal(casoDeRestitucion(2025, '2027-08-31'), 'restituir');
    assert.deepEqual(gruposDe(conLa2025, hoy, feriados).map(({ clave, caso }) => [clave, caso]),
      [['1-2025-0', 'tomar'], ['20-2025-0', 'tomar']]);

    // Pedida también (cargada en otra carga de días restituidos) y después corrida o borrada: el «Revisá…» de esos días
    const cargaB = restituidos(21, '2027-05-03', '2027-05-03');
    const pedidoB = pedidoDe(11, {
      licencia_id: 20, anio: 2024, caso: 'tomar', dias: 1, primer_asueto: '2027-04-12', fecha: '2027-04-08', carga_id: 21,
      licencia: { tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13', activo: 1 }
    });
    const ambas = {
      ...estado,
      licencias: [VACACIONES_DE_JULIETA, cargaA, cargaB],
      restituibles: [...fotoSellada(10), fotoDe(12, 20, '2027-04-12', { tanda: 0, restitucion_id: 11 })],
      restituciones: [pedidoA, pedidoB]
    };
    const deAmbas = gruposDe(ambas, hoy, feriados);
    assert.deepEqual(resumido(deAmbas), [
      ['1-2024-0', 'tomar', 'cargada', LOS_DOS, '2026-12-24', '2027-04-30'],
      ['20-2024-0', 'tomar', 'cargada', ['2027-04-12'], '2027-04-12', '2027-08-31']
    ]);
    const corrida = { ...ambas, licencias: [VACACIONES_DE_JULIETA, { ...cargaA, desde: '2027-04-13', hasta: '2027-04-14' }, cargaB] };
    assert.equal(gruposDe(corrida, hoy, feriados)[1].revisar,
      'Revisá tus días restituidos: tus días restituidos ya no incluyen el 12/04/2027.');
    // Borrada la primera carga, su pedido queda suelto (sus días vuelven a estar por restituir) y el de la recursión avisa
    const borrada = { ...ambas, licencias: [VACACIONES_DE_JULIETA, cargaB] };
    const deLaBorrada = gruposDe(borrada, hoy, feriados);
    assert.deepEqual(resumido(deLaBorrada), [
      ['1-2024-0', 'tomar', 'por_restituir', LOS_DOS, '2026-12-24', '2027-04-30'],
      ['20-2024-0', 'tomar', 'cargada', ['2027-04-12'], '2027-04-12', '2027-08-31']
    ]);
    assert.equal(deLaBorrada[1].revisar,
      'Revisá tus días restituidos: los días restituidos del 12/04 al 13/04/2027 ya no están cargados.');

    // Una carga de días restituidos sin su pedido activo no sabe de qué licencia es: no arma grupo
    const sinPedido = { ...estado, restituciones: [{ ...pedidoA, activo: 0 }] };
    assert.deepEqual(gruposDe(sinPedido, hoy, feriados).map(({ clave }) => clave), ['1-2024-0']);
  });

  it('un día de la foto que el reparto no cubre no forma grupo, pero cuenta para el primer asueto de su tanda', () => {
    // Con 10 de la 2025: la 2025 cubre hasta el 24/12 y del 28/12 al 31/12 no queda ninguna
    const sinCubrir = con({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 10, 2026: 0 }) });
    assert.deepEqual(resumido(gruposDe(sinCubrir)),
      [['1-2025-0', 'restituir', 'por_restituir', ['2026-12-24'], '2026-12-24', '2027-04-30']]);
    // Con los asuetos del 31/12 (sin cubrir) y del 04/01 (de la 2026, que se habilita el 1/1): el plazo es el del 31/12, así
    // corregir el saldo nunca acorta un plazo
    const feriados = new Set(['2026-12-31', '2027-01-04']);
    const conEnero = { ...sinCubrir, restituibles: [ESTADO.restituibles[1], fotoDe(10, 1, '2027-01-04')] };
    assert.deepEqual(repartoDeVacaciones(conEnero, { hoy: VUELVE, feriados }).sinCubrir.get(1),
      ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    assert.deepEqual(resumido(gruposDe(conEnero, VUELVE, feriados)),
      [['1-2026-0', 'restituir', 'por_restituir', ['2027-01-04'], '2026-12-31', '2027-04-30']]);
    assert.equal(plazoDeRestitucion('2027-01-04', feriados), '2027-05-31');
  });

  it('la mitad del caso B: lo pedido vuelve a su licencia el día del pedido, y las vacaciones siguen con sus 19 días', () => {
    const hoy = '2027-04-05';
    const aHoy = { hoy, feriados: ASUETOS };
    const pedida = { ...VARIANTE_B, restituibles: fotoSellada(10), restituciones: [pedidoDe(10, { fecha: '2027-04-01' })] };
    const ordinarias = ordinariasDe(pedida, hoy);
    assert.deepEqual(ordinarias.find((o) => o.anio === 2025), {
      anio: 2025, total: 22,
      mitades: [{ dias: 20, habilita: '2026-11-02' }, { dias: 2, habilita: '2027-04-01', licencia_id: 1 }],
      vence: '2027-12-31', desde_saldo: true
    });
    // Las demás no cambian
    assert.deepEqual(ordinarias.filter((o) => o.anio !== 2025), ordinariasDe(VARIANTE_B, hoy).filter((o) => o.anio !== 2025));
    // «Te quedan» pasa de 21 a 23: la 2025, de 1 a 3
    const antes = repartoDeVacaciones(VARIANTE_B, aHoy);
    const despues = repartoDeVacaciones(pedida, aHoy);
    assert.deepEqual([disponibles(antes), ordinaria(antes, 2025).disponibles], [21, 1]);
    assert.deepEqual([disponibles(despues), ordinaria(despues, 2025).disponibles], [23, 3]);
    assert.equal(ordinaria(despues, 2025).por_habilitar, 0);
    assert.match(textoDelReparto(despues, 1), /Te quedan 23 días: 3 de la 2025 \(vencen el 31\/12\/2027\) y 20 de la 2026\./);
    // Las vacaciones originales siguen con sus 19 días, de la 2025
    assert.deepEqual(despues.porFila.get(1), [{ anio: 2025, dias: 19 }]);
    assert.equal(diasQueDescuentan(VACACIONES_DE_JULIETA, pedida, ASUETOS).length, 19);
    assert.equal(calcular(pedida, aHoy).restituciones[0].situacion, 'pedida');
    // Un pedido dado de baja, del caso A o con días, una fecha o un año que no sirven no suma nada
    for (const otro of [{ activo: 0 }, { caso: 'tomar', carga_id: 20 }, { dias: 0 }, { dias: 'x' }, { fecha: null },
      { fecha: '01/04/2027' }, { anio: 2019 }]) {
      const estado = { ...pedida, restituciones: [pedidoDe(10, { fecha: '2027-04-01', ...otro })] };
      assert.deepEqual(ordinariasDe(estado, hoy), ordinariasDe(VARIANTE_B, hoy), JSON.stringify(otro));
    }
  });

  it('la mitad del caso B no la usa su propia carga: pedida antes de que terminen las vacaciones, vuelve justo a su licencia', () => {
    // 13 de la 2025 y 10 de la 2026: el 24/12 sale de la 2025 y el 31/12, de la 2026. Los asuetos se cargaron el 22/12 y la
    // restitución de la 2025 (el 24/12) se pidió el 23/12, con las vacaciones todavía en curso
    const feriados = ASUETOS;
    const dosB = con({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 13, 2026: 10 }) });
    const antes = repartoDeVacaciones(dosB, { hoy: '2026-12-22', feriados });
    assert.deepEqual([antes.porFecha.get(1).get('2026-12-24'), antes.porFecha.get(1).get('2026-12-31')], [2025, 2026]);
    const pedida = {
      ...dosB,
      restituibles: [{ ...ESTADO.restituibles[0], tanda: 0, restitucion_id: 10 }, { ...ESTADO.restituibles[1], tanda: 0 }],
      restituciones: [pedidoDe(10, { dias: 1, fecha: '2026-12-23' })]
    };
    const despues = repartoDeVacaciones(pedida, { hoy: VUELVE, feriados });
    // Las vacaciones no absorben la mitad: el 31/12 sigue en la 2026 y la 2025 queda con el día que volvió
    assert.deepEqual([despues.porFecha.get(1).get('2026-12-24'), despues.porFecha.get(1).get('2026-12-31')], [2025, 2026]);
    assert.deepEqual(despues.porFila.get(1), [{ anio: 2025, dias: 13 }, { anio: 2026, dias: 6 }]);
    assert.deepEqual([ordinaria(despues, 2025).disponibles, ordinaria(despues, 2026).disponibles], [1, 14]);
    // Un grupo por clave: la 2025, pedida, y la 2026, por restituir con el plazo del 24/12
    const grupos = gruposDe(pedida, VUELVE, feriados);
    assert.deepEqual(resumido(grupos), [
      ['1-2025-0', 'restituir', 'pedida', ['2026-12-24'], '2026-12-24', '2027-04-30'],
      ['1-2026-0', 'restituir', 'por_restituir', ['2026-12-31'], '2026-12-24', '2027-04-30']
    ]);
    assert.equal(new Set(grupos.map(({ clave }) => clave)).size, grupos.length);
    // Otra carga sí la usa: unas vacaciones de un día en febrero salen del día que volvió a la 2025
    const conFebrero = { ...pedida, licencias: [...pedida.licencias, vacaciones(30, '2027-02-01', '2027-02-01')] };
    const deFebrero = repartoDeVacaciones(conFebrero, { hoy: VUELVE, feriados });
    assert.deepEqual(deFebrero.porFila.get(30), [{ anio: 2025, dias: 1 }]);
    assert.deepEqual(deFebrero.porFila.get(1), despues.porFila.get(1));
    assert.equal(ordinaria(deFebrero, 2025).disponibles, 0);
  });

  it('un pedido del caso B cuya carga ya no está no suma su mitad: sus días ya volvieron con la baja', () => {
    const hoy = '2027-04-05';
    const pedida = { ...VARIANTE_B, restituibles: fotoSellada(10), restituciones: [pedidoDe(10, { fecha: '2027-04-01' })] };
    // La persona borró las vacaciones (o administración las anuló en Configuración): los 19 días ya volvieron a la 2025, así
    // que «Te quedan» es 40 (20 de la 2025 y 20 de la 2026), sin los 2 del pedido
    const sinLasVacaciones = { ...pedida, licencias: [] };
    assert.deepEqual(ordinariasDe(sinLasVacaciones, hoy), ordinariasDe({ ...VARIANTE_B, licencias: [] }, hoy));
    const reparto = repartoDeVacaciones(sinLasVacaciones, { hoy, feriados: ASUETOS });
    assert.deepEqual([disponibles(reparto), ordinaria(reparto, 2025).disponibles], [40, 20]);
    // Con las vacaciones pasadas a otro tipo, lo mismo: ya no es una carga con días restituibles
    const otroTipo = { ...pedida, licencias: [{ ...VACACIONES_DE_JULIETA, tipo: 'medica' }] };
    assert.equal(ordinariasDe(otroTipo, hoy).find((o) => o.anio === 2025).total, 20);
    // Con las vacaciones, la mitad sigue (como siempre); el id de la carga, también como texto
    assert.equal(ordinariasDe(pedida, hoy).find((o) => o.anio === 2025).total, 22);
    const conIdDeTexto = { ...pedida, restituciones: [pedidoDe(10, { fecha: '2027-04-01', licencia_id: '1' })] };
    assert.equal(ordinariasDe(conIdDeTexto, hoy).find((o) => o.anio === 2025).total, 22);
    // El pedido sigue pedido, con su «Revisá…» mientras no pasó el plazo; después, sin él
    const [grupo] = gruposDe(sinLasVacaciones, hoy);
    assert.deepEqual([grupo.situacion, grupo.revisar], ['pedida',
      'Revisá tus días restituidos: las vacaciones del 11/12/2026 al 08/01/2027 ya no están cargadas.']);
    assert.deepEqual(gruposDe(sinLasVacaciones, '2027-05-03').map((otro) => [otro.situacion, otro.revisar]), [['pedida', '']]);
  });

  it('nada frena (Review Focus 4): un grupo por restituir o perdido no es un faltante ni frena una carga', () => {
    for (const hoy of [VUELVE, '2027-05-03']) {
      const opciones = { hoy, feriados: ASUETOS };
      const antes = calcular(ESTADO, opciones);
      assert.equal(antes.restituciones.length, 1, hoy);
      assert.deepEqual(antes.faltantes, [], hoy);
      const entrada = { tipo: 'medica', desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 2) };
      const despues = calcular(con({ licencias: [...ESTADO.licencias, { id: 20, ...entrada, horas: null }] }), opciones);
      assert.equal(problemaDeLaCarga(antes, despues), null, hoy);
      assert.equal(evaluarLicencia(ESTADO, entrada, opciones).error, null, hoy);
    }
  });

  it('nada tira: lo que no es un estado, unas opciones raras o filas raras', () => {
    const opciones = { hoy: VUELVE, feriados: ASUETOS };
    for (const raro of [undefined, null, '', 'x', 3, [], {}]) {
      assert.deepEqual(restitucionesDe(raro, opciones), [], JSON.stringify(raro));
      // Sin un hoy válido, ninguno
      assert.deepEqual(restitucionesDe(ESTADO, raro), [], JSON.stringify(raro));
      assert.deepEqual(restitucionesDe(ESTADO, { feriados: ASUETOS, hoy: raro }), [], JSON.stringify(raro));
      assert.doesNotThrow(() => restitucionesDe(ESTADO, { hoy: VUELVE, feriados: raro }));
      // Un reparto que no es un reparto se calcula
      assert.deepEqual(restitucionesDe(ESTADO, { ...opciones, reparto: raro }), [GRUPO_DE_JULIETA], JSON.stringify(raro));
      assert.doesNotThrow(() =>
        restitucionesDe({ ...ESTADO, restituibles: raro, restituciones: raro, licencias: raro }, opciones));
      assert.doesNotThrow(() => ordinariasDe({ ...ESTADO, restituciones: raro }, VUELVE));
    }
    // Sin modalidad, ninguno (como todo lo demás de Mi espacio)
    assert.deepEqual(gruposDe({ ...ESTADO, modalidad: null }), []);
    // Las filas raras no cuentan
    const raras = con({
      restituibles: [null, 3, 'x', {}, ...ESTADO.restituibles, fotoDe(10, 1, 'x'), fotoDe(11, 'x', '2026-12-24')],
      restituciones: [null, 3, 'x', {}, { id: 'x', activo: 1, caso: 'restituir' }]
    });
    assert.deepEqual(gruposDe(raras), [GRUPO_DE_JULIETA]);
    assert.deepEqual(ordinariasDe(raras, VUELVE), ordinariasDe(ESTADO, VUELVE));
  });
});

describe('la carga de los días restituidos, caso A (spec 2026-10-31-mi-espacio-dias-restituidos, 4, 7 y 9)', () => {
  const ESTADO = JULIETA.estado;
  const [VACACIONES_DE_JULIETA] = ESTADO.licencias;
  const VUELVE = '2027-01-11';
  const A_LA_VUELTA = Object.freeze({ hoy: VUELVE, feriados: ASUETOS });
  // El 05/02/2027, con los días de la 2024 ya cargados (CARGADA)
  const EN_FEBRERO = Object.freeze({ hoy: '2027-02-05', feriados: ASUETOS });
  const DE_LA_2024 = Object.freeze({ licencia_id: 1, anio: 2024, tanda: 0 });
  const DE_JULIETA = Object.freeze({ tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' });
  // Una fila de la foto, un pedido (desde el 10) y una carga de días restituidos (desde el 20), como en los grupos
  const fotoDe = (id, licenciaId, fecha, extra = {}) =>
    ({ id, licencia_id: licenciaId, feriado_id: 1, fecha, tanda: null, restitucion_id: null, ...extra });
  const pedidoA = (id, extra = {}) => ({
    id, licencia_id: 1, anio: 2024, caso: 'tomar', dias: 2, primer_asueto: '2026-12-24', tanda: 0, fecha: '2027-02-01',
    carga_id: 20, activo: 1, licencia: { ...DE_JULIETA, activo: 1 }, ...extra
  });
  const restituidos = (id, desde, hasta) => ({ id, tipo: 'restituidos', desde, hasta, horas: null });
  const fotoSellada = (restitucionId) => ESTADO.restituibles.map((fila) => ({ ...fila, tanda: 0, restitucion_id: restitucionId }));
  // Julieta con los días de la 2024 ya cargados del lunes 12/04 al martes 13/04/2027
  const CARGADA = Object.freeze({
    ...ESTADO,
    licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-12', '2027-04-13')],
    restituibles: fotoSellada(10),
    restituciones: [pedidoA(10)]
  });
  // La variante B (spec, 5): las mismas vacaciones, con 20 de la 2025 y sin saldo de la 2024
  const VARIANTE_B = Object.freeze({ ...ESTADO, saldos: saldosDeVacaciones({ 2024: 0, 2025: 20, 2026: 10 }) });

  const gruposDe = (estado, opciones = A_LA_VUELTA) => calcular(estado, opciones).restituciones;
  const [GRUPO] = gruposDe(ESTADO);
  const validar = (entrada, estado = ESTADO, opciones = A_LA_VUELTA) =>
    validarRestituidos(entrada, { ...opciones, estado, grupos: gruposDe(estado, opciones) });
  const alta = (desde, extra = {}) => ({ tipo: 'restituidos', restitucion: DE_LA_2024, desde, ...extra });
  const datosDe = (desde, hasta, extra = {}) =>
    ({ tipo: 'restituidos', desde, hasta, horas: null, mostrar: 1, nota: null, restitucion: DE_LA_2024, ...extra });
  const bien = (desde, hasta, extra) => ({ datos: datosDe(desde, hasta, extra), error: null });
  const mal = (campo, mensaje) => ({ datos: null, error: { campo, mensaje } });
  const DESDE_FUERA = textoDesdeDeLosRestituidos('2027-01-11', '2027-04-30');
  const CALCULO_DE_JULIETA = 'Son los días restituidos de la licencia 2024, por los asuetos del 24/12 y el 31/12/2026.';
  const evaluar = (estado, entrada, opciones = A_LA_VUELTA) => evaluarLicencia(estado, entrada, opciones);

  it('el grupo de Julieta, al volver, es el de los 2 días de la 2024 (caso A)', () => {
    assert.deepEqual([GRUPO.clave, GRUPO.caso, GRUPO.situacion, GRUPO.dias, GRUPO.plazo], ['1-2024-0', 'tomar', 'por_restituir',
      2, '2027-04-30']);
  });

  it('los mensajes y los textos del cálculo, la ayuda y el «Hasta», en plural y en singular', () => {
    assert.equal(MENSAJES_MI_ESPACIO.restituidosFijo, 'Los días restituidos no cambian de tipo.');
    assert.equal(MENSAJES_MI_ESPACIO.restitucionInvalida, 'Elegí qué días restituidos querés cargar.');
    assert.equal(MENSAJES_MI_ESPACIO.grupoNoPorRestituir, 'Esos días ya no están para restituir.');
    assert.equal(MENSAJES_MI_ESPACIO.grupoEsParaRestituir, 'Esos días no se toman: pedí la restitución.');
    assert.equal(MENSAJES_MI_ESPACIO.grupoEsParaTomar, 'Esos días se toman: cargalos como «Días restituidos».');
    assert.equal(MENSAJES_MI_ESPACIO.restitucionNoEncontrada, 'Restitución no encontrada');
    assert.equal(MENSAJES_MI_ESPACIO.restitucionVencida, 'Ya pasó el plazo: la restitución no se puede borrar.');
    assert.equal(DESDE_FUERA, 'Elegí un día del 11/01/2027 al 30/04/2027.');

    // Los de la maqueta (MQ.T.calculoA y MQ.T.ayudaFechasA), copiados acá
    assert.equal(textoDelCalculoDeRestituidos(GRUPO), CALCULO_DE_JULIETA);
    assert.equal(textoDeLaAyudaDeRestituidos(GRUPO, ASUETOS), 'Los 2 días van juntos: elegí desde cuándo y Mi espacio pone el '
      + '«Hasta». Podés empezar del 11/01/2027 al viernes 30/04/2027.');
    assert.equal(textoDelHastaDeRestituidos(2), 'Lo pone Mi espacio: 2 días hábiles.');
    // Con un solo día
    const unDia = { ...GRUPO, dias: 1, fechas: ['2026-12-24'] };
    assert.equal(textoDelCalculoDeRestituidos(unDia), 'Es el día restituido de la licencia 2024, por el asueto del 24/12/2026.');
    assert.equal(textoDeLaAyudaDeRestituidos(unDia, ASUETOS),
      'Es 1 día: elegí cuándo y Mi espacio pone el «Hasta». Podés tomarlo del 11/01/2027 al viernes 30/04/2027.');
    assert.equal(textoDelHastaDeRestituidos(1), 'Lo pone Mi espacio: 1 día hábil.');
    // Con tres, que cruzan el año
    const tres = { ...GRUPO, dias: 3, fechas: ['2026-12-24', '2026-12-31', '2027-01-04'] };
    assert.equal(textoDelCalculoDeRestituidos(tres),
      'Son los días restituidos de la licencia 2024, por los asuetos del 24/12, el 31/12/2026 y el 04/01/2027.');
    assert.equal(textoDelHastaDeRestituidos(3), 'Lo pone Mi espacio: 3 días hábiles.');
    // Con unas vacaciones que terminan el jueves 30/12/2026: después del asueto del 31/12, el 1/1 y el fin de semana, el 04/01
    const hasta30 = { ...GRUPO, carga: { ...DE_JULIETA, hasta: '2026-12-30' } };
    assert.match(textoDeLaAyudaDeRestituidos(hasta30, ASUETOS), /Podés empezar del 04\/01\/2027 al viernes 30\/04\/2027\.$/);
    // Lo que no es un grupo, ''
    for (const raro of [undefined, null, '', 'x', 3, []]) {
      assert.equal(textoDelCalculoDeRestituidos(raro), '', JSON.stringify(raro));
      assert.equal(textoDeLaAyudaDeRestituidos(raro, ASUETOS), '', JSON.stringify(raro));
    }
  });

  it('hastaDeLosRestituidos: el día número N contando desde «Desde» los días hábiles y los restituibles', () => {
    // Desde el lunes 12/04/2027, el segundo es el martes; uno solo, el mismo lunes
    assert.equal(hastaDeLosRestituidos('2027-04-12', 2, ASUETOS), '2027-04-13');
    assert.equal(hastaDeLosRestituidos('2027-04-12', 1, ASUETOS), '2027-04-12');
    // Desde un sábado, el fin de semana no cuenta
    assert.equal(hastaDeLosRestituidos('2027-04-10', 2, ASUETOS), '2027-04-13');
    assert.equal(hastaDeLosRestituidos('2027-04-10', 1, ASUETOS), '2027-04-12');
    // Cruzando un feriado de la tabla, uno de los 9 fijos (el miércoles 24/03/2027) o el fin de semana
    assert.equal(hastaDeLosRestituidos('2027-04-28', 2, new Set(['2027-04-29'])), '2027-04-30');
    assert.equal(hastaDeLosRestituidos('2027-03-23', 2, SIN_FERIADOS), '2027-03-25');
    assert.equal(hastaDeLosRestituidos('2027-04-30', 2, ASUETOS), '2027-05-03');
    // Con los restituibles de la carga que se corrige: el día del asueto cuenta
    assert.equal(hastaDeLosRestituidos('2027-04-12', 2, new Set(['2027-04-13'])), '2027-04-14');
    assert.equal(hastaDeLosRestituidos('2027-04-12', 2, new Set(['2027-04-13']), ['2027-04-13']), '2027-04-13');
    assert.equal(hastaDeLosRestituidos('2027-04-12', 2, new Set(['2027-04-13']), ['2027-04-13', 'x', null]), '2027-04-13');
    // Un restituible anterior a «Desde» no cuenta
    assert.equal(hastaDeLosRestituidos('2027-04-14', 1, new Set(['2027-04-13']), ['2027-04-13']), '2027-04-14');
    // Los feriados que no son un Set, como sin feriados
    assert.equal(hastaDeLosRestituidos('2027-04-12', 2, undefined), '2027-04-13');
    // A lo sumo 366 vueltas: del 12/04/2027 al 11/04/2028 hay 258 días hábiles (260 de lunes a viernes, menos los 4 fijos que
    // caen de lunes a viernes, más los dos últimos); con uno más, null. Una entrada que no sirve, también null
    assert.equal(hastaDeLosRestituidos('2027-04-12', 258, SIN_FERIADOS), '2028-04-11');
    assert.equal(hastaDeLosRestituidos('2027-04-12', 259, SIN_FERIADOS), null);
    for (const raro of [undefined, null, '', 'x', 0, -1, 1.5, NaN, [], {}]) {
      assert.equal(hastaDeLosRestituidos('2027-04-12', raro, ASUETOS), null, JSON.stringify(raro));
      assert.equal(hastaDeLosRestituidos(raro, 2, ASUETOS), null, JSON.stringify(raro));
      assert.doesNotThrow(() => hastaDeLosRestituidos('2027-04-12', 2, raro, raro));
    }
    assert.equal(hastaDeLosRestituidos('9999-12-31', 2, SIN_FERIADOS), null);
  });

  it('primerDiaDeLosRestituidos: el primer día hábil después del fin de su carga', () => {
    assert.equal(primerDiaDeLosRestituidos(GRUPO, ASUETOS), '2027-01-11');
    assert.equal(primerDiaDeLosRestituidos({ ...GRUPO, carga: { ...DE_JULIETA, hasta: '2026-12-30' } }, ASUETOS), '2027-01-04');
    assert.equal(primerDiaDeLosRestituidos({ ...GRUPO, carga: { ...DE_JULIETA, hasta: '2026-12-30' } }, SIN_FERIADOS),
      '2026-12-31');
    for (const raro of [undefined, null, '', 'x', 3, [], {}, { carga: null }, { carga: { hasta: 'x' } }]) {
      assert.equal(primerDiaDeLosRestituidos(raro, ASUETOS), null, JSON.stringify(raro));
    }
  });

  it('validarRestituidos, el alta: «Desde» va del primer día hábil después de las vacaciones al plazo, y el «Hasta» lo pone Mi espacio', () => {
    assert.deepEqual(validar(alta('2027-04-12')), bien('2027-04-12', '2027-04-13'));
    // El primer día hábil después de las vacaciones (el lunes 11/01) y el plazo entran; con el plazo, termina después
    assert.deepEqual(validar(alta('2027-01-11')), bien('2027-01-11', '2027-01-12'));
    assert.deepEqual(validar(alta('2027-04-30')), bien('2027-04-30', '2027-05-03'));
    // El último día de las vacaciones, el fin de semana que las sigue (lo que dicen la ayuda y el error) y el día después del
    // plazo, no
    for (const desde of ['2027-01-08', '2027-01-09', '2027-01-10', '2026-12-20', '2027-05-01']) {
      assert.deepEqual(validar(alta(desde)), mal('desde', DESDE_FUERA), desde);
    }
    // Una fecha que no es una fecha, o fuera del rango (del 01/01/2025 al 31/12/2028)
    for (const raro of [undefined, null, '', 'x', '2027-02-30', '12/04/2027', 3]) {
      assert.deepEqual(validar(alta(raro)), mal('desde', MENSAJES_MI_ESPACIO.fecha), JSON.stringify(raro));
    }
    assert.deepEqual(validar(alta('2029-01-05')), mal('desde', textoRango('2025-01-01', '2028-12-31')));
    // Un «Hasta» que se sale del rango, con un grupo armado a mano: también en «Desde»
    const aFinDeAnio = { ...GRUPO, carga: { ...DE_JULIETA, desde: '2028-12-11', hasta: '2028-12-20' }, plazo: '2029-04-30' };
    assert.deepEqual(validarRestituidos(alta('2028-12-29'), { ...A_LA_VUELTA, estado: ESTADO, grupos: [aFinDeAnio] }),
      mal('desde', textoRango('2025-01-01', '2028-12-31')));
    assert.deepEqual(validarRestituidos(alta('2028-12-27'), { ...A_LA_VUELTA, estado: ESTADO, grupos: [aFinDeAnio] }),
      bien('2028-12-27', '2028-12-28'));
    // El «Hasta» que llega no cuenta: lo pone Mi espacio
    assert.deepEqual(validar(alta('2027-04-12', { hasta: '2027-04-30' })), bien('2027-04-12', '2027-04-13'));
  });

  it('validarRestituidos: el grupo tiene que estar por restituir y ser del caso A', () => {
    // Pasado el plazo, perdido
    assert.equal(gruposDe(ESTADO, { ...A_LA_VUELTA, hoy: '2027-05-03' })[0].situacion, 'perdida');
    assert.deepEqual(validar(alta('2027-05-05'), ESTADO, { ...A_LA_VUELTA, hoy: '2027-05-03' }),
      mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir));
    // Del caso B: se pide la restitución
    assert.deepEqual(validar(alta('2027-04-12', { restitucion: { licencia_id: 1, anio: 2025, tanda: 0 } }), VARIANTE_B),
      mal('tipo', MENSAJES_MI_ESPACIO.grupoEsParaRestituir));
    // Otro grupo, otra tanda u otra carga, que no está
    for (const restitucion of [{ licencia_id: 1, anio: 2024, tanda: 1 }, { licencia_id: 1, anio: 2025, tanda: 0 },
      { licencia_id: 9, anio: 2024, tanda: 0 }, { licencia_id: 1, anio: 24, tanda: 0 }]) {
      assert.deepEqual(validar(alta('2027-04-12', { restitucion })), mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir),
        JSON.stringify(restitucion));
    }
    // Ya cargados: no se cargan dos veces
    assert.deepEqual(validar(alta('2027-04-19'), CARGADA, EN_FEBRERO), mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir));
    // Con la misma clave, un pedido activo y un grupo por restituir: cuenta el que está por restituir
    const pedida = { ...GRUPO, situacion: 'cargada', restitucion_id: 10, carga_id: 20 };
    const conLosDos = (grupos) => validarRestituidos(alta('2027-04-12'), { ...A_LA_VUELTA, estado: ESTADO, grupos });
    assert.deepEqual(conLosDos([pedida, GRUPO]), bien('2027-04-12', '2027-04-13'));
    assert.deepEqual(conLosDos([pedida]), mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir));
    // Uno sin caso (sin plazo) no se carga
    assert.deepEqual(conLosDos([{ ...GRUPO, caso: null }]), mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir));
    // Una restitución que no es un objeto con los tres enteros
    for (const restitucion of [undefined, null, '', 'x', 3, [], {}, { licencia_id: 1, anio: 2024 },
      { licencia_id: 0, anio: 2024, tanda: 0 }, { licencia_id: 'x', anio: 2024, tanda: 0 }, { licencia_id: 1, anio: 2024.5, tanda: 0 },
      { licencia_id: 1, anio: 2024, tanda: -1 }, { licencia_id: 1, anio: 2024, tanda: 0.5 }, { licencia_id: 1, anio: 2024, tanda: '' },
      { licencia_id: 1, anio: 2024, tanda: true }]) {
      assert.deepEqual(validar(alta('2027-04-12', { restitucion })), mal('tipo', MENSAJES_MI_ESPACIO.restitucionInvalida),
        JSON.stringify(restitucion));
    }
    // Los ids como texto (los de un formulario) valen
    assert.deepEqual(validar(alta('2027-04-12', { restitucion: { licencia_id: '1', anio: '2024', tanda: '0' } })),
      bien('2027-04-12', '2027-04-13'));
    // El grupo va antes que «Desde»
    assert.deepEqual(validar(alta('x', { restitucion: null })), mal('tipo', MENSAJES_MI_ESPACIO.restitucionInvalida));
  });

  it('grupoDeLosRestituidos: en el alta, el por restituir de esa clave; al corregir, el cargado de esa carga', () => {
    const cargado = { ...GRUPO, situacion: 'cargada', restitucion_id: 10, carga_id: 20 };
    const perdido = { ...GRUPO, situacion: 'perdida' };
    const deB = { ...GRUPO, clave: '1-2025-0', anio: 2025, caso: 'restituir' };
    // El alta: por la clave y por la situación (con la misma clave, un pedido activo o uno perdido no cuentan)
    assert.deepEqual(grupoDeLosRestituidos([cargado, perdido, GRUPO], { restitucion: DE_LA_2024 }, null), { grupo: GRUPO });
    assert.deepEqual(grupoDeLosRestituidos([cargado, perdido], { restitucion: DE_LA_2024 }), { error: 'grupoNoPorRestituir' });
    assert.deepEqual(grupoDeLosRestituidos([GRUPO], { restitucion: { licencia_id: '1', anio: '2024', tanda: '0' } }),
      { grupo: GRUPO });
    assert.deepEqual(grupoDeLosRestituidos([GRUPO, deB], { restitucion: { licencia_id: 1, anio: 2025, tanda: 0 } }),
      { error: 'grupoEsParaRestituir' });
    assert.deepEqual(grupoDeLosRestituidos([{ ...GRUPO, caso: null }], { restitucion: DE_LA_2024 }),
      { error: 'grupoNoPorRestituir' });
    assert.deepEqual(grupoDeLosRestituidos([GRUPO], { restitucion: { licencia_id: 1, anio: 2024 } }),
      { error: 'restitucionInvalida' });
    // La corrección: el cargado de esa carga, sin mirar la restitución que llegue
    assert.deepEqual(grupoDeLosRestituidos([GRUPO, cargado], { restitucion: { licencia_id: 9, anio: 1, tanda: 9 } }, 20),
      { grupo: cargado });
    assert.deepEqual(grupoDeLosRestituidos([GRUPO, cargado], {}, '20'), { grupo: cargado });
    for (const editadaId of [21, 1, 'x', 0]) {
      assert.deepEqual(grupoDeLosRestituidos([GRUPO, cargado], { restitucion: DE_LA_2024 }, editadaId),
        { error: 'grupoNoPorRestituir' }, JSON.stringify(editadaId));
    }
    // Lo que no es una lista o una entrada no tira
    for (const raro of [undefined, null, '', 'x', 3, {}, [null, 3, 'x']]) {
      assert.deepEqual(grupoDeLosRestituidos(raro, { restitucion: DE_LA_2024 }), { error: 'grupoNoPorRestituir' },
        JSON.stringify(raro));
      assert.deepEqual(grupoDeLosRestituidos([GRUPO], raro), { error: 'restitucionInvalida' }, JSON.stringify(raro));
    }
    // Los tipos con días restituibles, los que comparte con la nota en Word
    assert.deepEqual(TIPOS_CON_RESTITUIBLES, ['vacaciones', 'restituidos']);
    assert.ok(Object.isFrozen(TIPOS_CON_RESTITUIBLES));
  });

  it('grupoDeLaRestitucion: el por restituir del caso B de esa clave; uno del caso A, grupoEsParaTomar', () => {
    const [DE_B] = gruposDe(VARIANTE_B);
    assert.deepEqual([DE_B.clave, DE_B.caso, DE_B.situacion], ['1-2025-0', 'restituir', 'por_restituir']);
    const DE_LA_2025 = Object.freeze({ licencia_id: 1, anio: 2025, tanda: 0 });
    const pedida = { ...DE_B, situacion: 'pedida', restitucion_id: 10 };
    const perdida = { ...DE_B, situacion: 'perdida' };
    // Por la clave y por la situación (con la misma clave, uno pedido o uno perdido no cuentan); los ids como texto valen
    assert.deepEqual(grupoDeLaRestitucion([pedida, perdida, DE_B], DE_LA_2025), { grupo: DE_B });
    assert.deepEqual(grupoDeLaRestitucion([DE_B], { licencia_id: '1', anio: '2025', tanda: '0' }), { grupo: DE_B });
    assert.deepEqual(grupoDeLaRestitucion([pedida, perdida], DE_LA_2025), { error: 'grupoNoPorRestituir' });
    assert.deepEqual(grupoDeLaRestitucion([DE_B], { ...DE_LA_2025, tanda: 1 }), { error: 'grupoNoPorRestituir' });
    // Uno del caso A se carga como «Días restituidos»; uno sin caso no está para restituir
    assert.deepEqual(grupoDeLaRestitucion([GRUPO, DE_B], DE_LA_2024), { error: 'grupoEsParaTomar' });
    assert.deepEqual(grupoDeLaRestitucion([{ ...DE_B, caso: null }], DE_LA_2025), { error: 'grupoNoPorRestituir' });
    // Una restitución que no sirve (sin los tres enteros, una tanda negativa, una lista) no es ningún grupo; nada tira
    for (const restitucion of [undefined, null, '', 'x', 3, [], {}, { licencia_id: 1, anio: 2025 },
      { licencia_id: 'abc', anio: 2025, tanda: 0 }, { licencia_id: 1, anio: 2025, tanda: -1 },
      { licencia_id: ['1'], anio: '2025', tanda: '0' }]) {
      assert.deepEqual(grupoDeLaRestitucion([DE_B], restitucion), { error: 'grupoNoPorRestituir' }, JSON.stringify(restitucion));
    }
    for (const raro of [undefined, null, '', 'x', 3, {}, [null, 3, 'x']]) {
      assert.deepEqual(grupoDeLaRestitucion(raro, DE_LA_2025), { error: 'grupoNoPorRestituir' }, JSON.stringify(raro));
    }
  });

  it('validarRestituidos: la nota, «Mostrar» y que no se superponga con otra licencia', () => {
    assert.deepEqual(validar(alta('2027-04-12', { nota: '  Con la nota  ', mostrar: false })),
      bien('2027-04-12', '2027-04-13', { nota: 'Con la nota', mostrar: 0 }));
    assert.deepEqual(validar(alta('2027-04-12', { nota: '   ', mostrar: '0' })), bien('2027-04-12', '2027-04-13', { mostrar: 0 }));
    assert.deepEqual(validar(alta('2027-04-12', { nota: 'x'.repeat(201) })), mal('nota', MENSAJES_MI_ESPACIO.nota));
    // Con una atención médica el martes 13/04, en «Desde», con la primera fecha en común (después de la nota)
    const conMedica = { ...ESTADO, licencias: [VACACIONES_DE_JULIETA, { id: 30, tipo: 'medica', desde: '2027-04-13',
      hasta: '2027-04-13', horas: null }] };
    assert.deepEqual(validar(alta('2027-04-12'), conMedica), mal('desde', textoSuperpuesta('2027-04-13')));
    assert.deepEqual(validar(alta('2027-04-12', { nota: 'x'.repeat(201) }), conMedica), mal('nota', MENSAJES_MI_ESPACIO.nota));
    assert.deepEqual(validar(alta('2027-04-14'), conMedica), bien('2027-04-14', '2027-04-15'));
  });

  it('validarRestituidos, la corrección: la de su carga; sin cambiar «Desde», conserva el «Hasta»; si lo cambia, lo recalcula', () => {
    const corregir = (entrada, estado = CARGADA, feriados = ASUETOS) =>
      validar(entrada, estado, { ...EN_FEBRERO, feriados, editadaId: 20 });
    // La restitución que llegue no cuenta: es la de su carga
    assert.deepEqual(corregir({ desde: '2027-04-12', nota: 'Trámite' }), bien('2027-04-12', '2027-04-13', { nota: 'Trámite' }));
    assert.deepEqual(corregir({ desde: '2027-04-19', restitucion: { licencia_id: 9, anio: 2030, tanda: 4 } }),
      bien('2027-04-19', '2027-04-20'));
    assert.deepEqual(validar({ desde: '2027-04-19' }, CARGADA, { ...EN_FEBRERO, editadaId: '20' }), bien('2027-04-19', '2027-04-20'));
    // Cambiando «Desde», el «Hasta» se cuenta de nuevo, también con un feriado en el medio
    assert.deepEqual(corregir({ desde: '2027-04-19' }, CARGADA, new Set([...ASUETOS, '2027-04-20'])),
      bien('2027-04-19', '2027-04-21'));

    // Sin cambiar «Desde», el «Hasta» también se vuelve a contar, con los días restituibles de la carga. La conservación: con
    // un asueto cargado después en el martes 13/04 (con su foto), el 13/04 sigue siendo suyo y la carga queda igual
    const conAsueto = { ...CARGADA, restituibles: [...CARGADA.restituibles, fotoDe(12, 20, '2027-04-13')] };
    assert.deepEqual(corregir({ desde: '2027-04-12', nota: 'Trámite' }, conAsueto, new Set([...ASUETOS, '2027-04-13'])),
      bien('2027-04-12', '2027-04-13', { nota: 'Trámite' }));
    // Y con un feriado que ya estaba al cargarla (el viernes 16/04, sin foto: la carga del jueves 15/04 llegó al lunes 19/04)
    // mientras sigue, también queda igual
    const del15 = { ...CARGADA, licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-15', '2027-04-19')] };
    const con16 = new Set([...ASUETOS, '2027-04-16']);
    assert.deepEqual(corregir({ desde: '2027-04-15' }, del15, con16), bien('2027-04-15', '2027-04-19'));
    // El recálculo: dado de baja ese feriado, el 16/04 vuelve a ser hábil y cambiar la nota deja la carga en sus 2 días
    assert.deepEqual(corregir({ desde: '2027-04-15', nota: 'Trámite' }, del15),
      bien('2027-04-15', '2027-04-16', { nota: 'Trámite' }));
    // Salvo que la carga ya haya terminado: sus fechas quedan fijas en Configuración, y el «Hasta» guardado no cambia
    assert.deepEqual(validar({ desde: '2027-04-15', nota: 'Trámite' }, del15, { hoy: '2027-05-10', feriados: ASUETOS,
      editadaId: 20 }), bien('2027-04-15', '2027-04-19', { nota: 'Trámite' }));

    // Sin cambiar «Desde», sus bordes no se vuelven a mirar: la carga desde el viernes 30/04/2027 (el plazo) y después un
    // feriado nuevo ese día, con su foto, que corre el plazo al jueves 29/04. Cambiar la nota pasa, con el mismo «Hasta»
    const con30 = new Set([...ASUETOS, '2027-04-30']);
    const del30 = {
      ...CARGADA,
      licencias: [VACACIONES_DE_JULIETA, restituidos(20, '2027-04-30', '2027-05-03')],
      restituibles: [...CARGADA.restituibles, fotoDe(12, 20, '2027-04-30')]
    };
    assert.equal(gruposDe(del30, { ...EN_FEBRERO, feriados: con30 })[0].plazo, '2027-04-29');
    assert.deepEqual(corregir({ desde: '2027-04-30', nota: 'Trámite' }, del30, con30),
      bien('2027-04-30', '2027-05-03', { nota: 'Trámite' }));
    // Moverla al 30/04 desde otro día, no: el plazo ya es el 29/04
    assert.deepEqual(corregir({ desde: '2027-04-30' }, CARGADA, con30),
      mal('desde', textoDesdeDeLosRestituidos('2027-01-11', '2027-04-29')));
    // Los bordes de «Desde» y la superposición, como en el alta (la carga que se corrige no cuenta)
    assert.deepEqual(corregir({ desde: '2027-01-08' }), mal('desde', DESDE_FUERA));
    assert.deepEqual(corregir({ desde: '2027-05-01' }), mal('desde', DESDE_FUERA));
    assert.deepEqual(corregir({ desde: '2027-04-13' }), bien('2027-04-13', '2027-04-14'));
    // Otra carga, una que no existe o una que no es de días restituidos: no hay grupo cargado
    for (const editadaId of [21, 1, 'x']) {
      assert.deepEqual(validar({ desde: '2027-04-19' }, CARGADA, { ...EN_FEBRERO, editadaId }),
        mal('tipo', MENSAJES_MI_ESPACIO.grupoNoPorRestituir), JSON.stringify(editadaId));
    }
  });

  it('evaluarLicencia del alta: la vista de la maqueta, con el «Hasta» que pone Mi espacio', () => {
    const maqueta = { hoy: '2027-04-01', feriados: ASUETOS };
    const vista = (hasta, textoDias = '2 días hábiles') => ({
      dias_habiles: 2, texto_dias: textoDias, texto_reparto: CALCULO_DE_JULIETA, queda_texto: '', antes_del_arranque: false,
      texto_antes_del_arranque: '', avisos: [], hasta
    });
    assert.deepEqual(evaluar(ESTADO, alta('2027-04-12'), maqueta),
      { datos: datosDe('2027-04-12', '2027-04-13'), error: null, vista: vista('2027-04-13') });
    // Desde un sábado: 2 días hábiles de 4 corridos
    assert.deepEqual(evaluar(ESTADO, alta('2027-04-10'), maqueta),
      { datos: datosDe('2027-04-10', '2027-04-13'), error: null, vista: vista('2027-04-13', '2 días hábiles de 4 corridos') });
    // Con el controlador: editadaId null en el alta
    assert.deepEqual(evaluar(ESTADO, alta('2027-04-12'), { ...maqueta, editadaId: null }).datos, datosDe('2027-04-12', '2027-04-13'));
    // Los errores de validarRestituidos pasan tal cual, sin vista
    assert.deepEqual(evaluar(ESTADO, alta('2027-05-03'), maqueta), { ...mal('desde', DESDE_FUERA), vista: null });
    assert.deepEqual(evaluar(VARIANTE_B, alta('2027-04-12', { restitucion: { licencia_id: 1, anio: 2025, tanda: 0 } }), maqueta),
      { ...mal('tipo', MENSAJES_MI_ESPACIO.grupoEsParaRestituir), vista: null });
    // validarLicencia sigue sin aceptarlos por el camino de siempre
    assert.deepEqual(validarLicencia(alta('2027-04-12', { hasta: '2027-04-13' }), { ...maqueta, estado: ESTADO }),
      mal('tipo', MENSAJES_MI_ESPACIO.tipo));
  });

  it('evaluarLicencia del alta: lo que la carga hace perder se avisa, como en cualquier otra, sin frenarla', () => {
    // Otra variante inventada: vacaciones del 11/10 al 22/10/2027, de la 2025, y asuetos el 14 y el 15/10/2027 cargados después.
    // El plazo es el 29/02/2028, después del vencimiento de la 2025 (caso A). El 20/12/2027, con una atención médica hasta el
    // 29/12, quedan dos días libres antes del 31/12: cargar los días restituidos ahí hace perder lo que queda de la 2025 y
    // horas de franquicia
    const asuetos = new Set(['2027-10-14', '2027-10-15']);
    const estado = {
      ...ESTADO,
      saldos: saldosDeVacaciones({ 2024: 0, 2025: 15, 2026: 0 }),
      licencias: [vacaciones(1, '2027-10-11', '2027-10-22'),
        { id: 30, tipo: 'medica', desde: '2027-12-20', hasta: '2027-12-29', horas: null }],
      restituibles: [fotoDe(1, 1, '2027-10-14'), fotoDe(2, 1, '2027-10-15')],
      restituciones: []
    };
    const opciones = { hoy: '2027-12-20', feriados: asuetos };
    const [grupo] = gruposDe(estado, opciones);
    assert.deepEqual([grupo.clave, grupo.caso, grupo.situacion, grupo.plazo], ['1-2025-0', 'tomar', 'por_restituir', '2028-02-29']);
    const restitucion = { licencia_id: 1, anio: 2025, tanda: 0 };
    const { datos, error, vista } = evaluar(estado, alta('2027-12-30', { restitucion }), opciones);
    assert.equal(error, null);
    assert.deepEqual(datos, datosDe('2027-12-30', '2027-12-31', { restitucion }));
    assert.deepEqual(vista.avisos, [
      'Con esta licencia perdés 5 de la 2025 (vencen el 31/12/2027).',
      'Con esta licencia perdés 14 horas de franquicia (vencen el 31/12/2027).'
    ]);
    assert.equal(vista.texto_reparto,
      'Son los días restituidos de la licencia 2025, por los asuetos del 14/10 y el 15/10/2027.');
  });

  it('evaluarLicencia de la corrección: cambia «Desde» y el «Hasta» se recalcula', () => {
    const corregir = (entrada, opciones = {}) => evaluar(CARGADA, entrada, { ...EN_FEBRERO, editadaId: 20, ...opciones });
    const { datos, error, vista } = corregir({ tipo: 'restituidos', desde: '2027-04-19', nota: 'Trámite' });
    assert.equal(error, null);
    assert.deepEqual(datos, datosDe('2027-04-19', '2027-04-20', { nota: 'Trámite' }));
    assert.deepEqual(vista, {
      dias_habiles: 2, texto_dias: '2 días hábiles', texto_reparto: CALCULO_DE_JULIETA, queda_texto: '',
      antes_del_arranque: false, texto_antes_del_arranque: '', avisos: [], hasta: '2027-04-20'
    });
    // Sin cambiar «Desde», el «Hasta» guardado
    assert.equal(corregir({ tipo: 'restituidos', desde: '2027-04-12', mostrar: 0 }).datos.hasta, '2027-04-13');
    // Superpuesta con otra licencia
    const conMedica = { ...CARGADA, licencias: [...CARGADA.licencias, { id: 30, tipo: 'medica', desde: '2027-04-20',
      hasta: '2027-04-20', horas: null }] };
    assert.deepEqual(evaluar(conMedica, { tipo: 'restituidos', desde: '2027-04-19' }, { ...EN_FEBRERO, editadaId: 20 }),
      { ...mal('desde', textoSuperpuesta('2027-04-20')), vista: null });
  });

  it('restituidosFijo: una carga de días restituidos no cambia de tipo, y ninguna otra pasa a serlo', () => {
    const fijo = { ...mal('tipo', MENSAJES_MI_ESPACIO.restituidosFijo), vista: null };
    assert.deepEqual(evaluar(CARGADA, { tipo: 'vacaciones', desde: '2027-04-12', hasta: '2027-04-13' },
      { ...EN_FEBRERO, editadaId: 20 }), fijo);
    assert.deepEqual(evaluar(CARGADA, { desde: '2027-04-12', hasta: '2027-04-13' }, { ...EN_FEBRERO, editadaId: '20' }), fijo);
    assert.deepEqual(evaluar(CARGADA, alta('2027-04-19'), { ...EN_FEBRERO, editadaId: 1 }), fijo);
    // Antes, la modalidad y el arranque
    assert.deepEqual(evaluar({ ...CARGADA, arranque: null }, { tipo: 'vacaciones', desde: '2027-04-12', hasta: '2027-04-13' },
      { ...EN_FEBRERO, editadaId: 20 }), { ...mal(null, MENSAJES_MI_ESPACIO.sinArranque), vista: null });
    assert.deepEqual(evaluar({ ...ESTADO, modalidad: null }, alta('2027-04-12')),
      { ...mal(null, MENSAJES_MI_ESPACIO.sinModalidad), vista: null });
    // Las vacaciones de Julieta se siguen corrigiendo como siempre
    assert.equal(evaluar(CARGADA, { tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' },
      { ...EN_FEBRERO, editadaId: 1 }).error, null);
  });

  it('la recursión: los días de un asueto que cayó en una carga de días restituidos se cargan igual (Review Focus 7)', () => {
    // El asueto del lunes 12/04/2027 cayó en la carga de los días de la 2024 (del 12/04 al 13/04)
    const opciones = { hoy: '2027-04-08', feriados: new Set([...ASUETOS, '2027-04-12']) };
    const estado = { ...CARGADA, restituibles: [...CARGADA.restituibles, fotoDe(12, 20, '2027-04-12')] };
    const grupos = gruposDe(estado, opciones);
    const recursivo = grupos.find((grupo) => grupo.licencia_id === 20);
    assert.deepEqual([recursivo.clave, recursivo.caso, recursivo.situacion, recursivo.plazo],
      ['20-2024-0', 'tomar', 'por_restituir', '2027-08-31']);
    // La carga de los días restituidos conserva sus 2 días
    assert.equal(diasDeLaCarga(estado.licencias[1], estado, opciones.feriados).length, 2);
    const restitucion = { licencia_id: 20, anio: 2024, tanda: 0 };
    assert.equal(textoDeLaAyudaDeRestituidos(recursivo, opciones.feriados),
      'Es 1 día: elegí cuándo y Mi espacio pone el «Hasta». Podés tomarlo del 14/04/2027 al martes 31/08/2027.');
    assert.deepEqual(evaluar(estado, alta('2027-04-14', { restitucion }), opciones), {
      datos: datosDe('2027-04-14', '2027-04-14', { restitucion }),
      error: null,
      vista: {
        dias_habiles: 1, texto_dias: '1 día hábil',
        texto_reparto: 'Es el día restituido de la licencia 2024, por el asueto del 12/04/2027.', queda_texto: '',
        antes_del_arranque: false, texto_antes_del_arranque: '', avisos: [], hasta: '2027-04-14'
      }
    });
    // Antes del fin de su carga, no
    assert.deepEqual(validar(alta('2027-04-13', { restitucion }), estado, opciones),
      mal('desde', textoDesdeDeLosRestituidos('2027-04-14', '2027-08-31')));

    // Corregir la carga del 12/04 al 13/04 para que empiece el 13/04: el 12/04 queda afuera y vuelve a contarse el hábil
    const corregir = (entrada, otro = estado, feriados = opciones.feriados) =>
      evaluar(otro, { tipo: 'restituidos', ...entrada }, { ...opciones, feriados, editadaId: 20 });
    assert.equal(corregir({ desde: '2027-04-13' }).datos.hasta, '2027-04-14');
    // Con la foto de un asueto del martes 13/04 en la carga que se corrige, moverla al 13/04 lo cuenta como suyo
    const feriados13 = new Set([...ASUETOS, '2027-04-13']);
    const conEl13 = { ...CARGADA, restituibles: [...CARGADA.restituibles, fotoDe(12, 20, '2027-04-13')] };
    const corrida = corregir({ desde: '2027-04-13' }, conEl13, feriados13);
    assert.equal(corrida.datos.hasta, '2027-04-14');
    assert.equal(corrida.vista.dias_habiles, 2);
    assert.equal(corrida.vista.texto_dias, '2 días hábiles');
  });

  it('nada tira: entradas, contextos y grupos raros', () => {
    for (const raro of [undefined, null, '', 'x', 3, [], {}, NaN]) {
      assert.deepEqual(validarRestituidos(raro, raro), mal('tipo', MENSAJES_MI_ESPACIO.restitucionInvalida),
        JSON.stringify(raro));
      assert.doesNotThrow(() => validarRestituidos(alta('2027-04-12'), { ...A_LA_VUELTA, estado: raro, grupos: [GRUPO] }));
      assert.doesNotThrow(() => validarRestituidos(alta('2027-04-12'), { ...A_LA_VUELTA, estado: ESTADO, grupos: raro }));
      assert.doesNotThrow(() => validarRestituidos(alta('2027-04-12'), { hoy: raro, estado: ESTADO, grupos: [GRUPO] }));
      assert.doesNotThrow(() => validarRestituidos(alta('2027-04-12'), { ...A_LA_VUELTA, estado: ESTADO,
        grupos: [raro, { ...GRUPO, carga: raro, plazo: raro, fechas: raro, dias: raro }] }));
      assert.doesNotThrow(() => validarRestituidos(alta('2027-04-12'), { ...A_LA_VUELTA, estado: ESTADO, grupos: [GRUPO],
        editadaId: raro }));
      assert.doesNotThrow(() => evaluarLicencia(ESTADO, alta('2027-04-12', { restitucion: raro }), A_LA_VUELTA));
      assert.doesNotThrow(() => evaluarLicencia(ESTADO, alta(raro), { ...A_LA_VUELTA, editadaId: raro }));
      assert.doesNotThrow(() => evaluarLicencia(raro, alta('2027-04-12'), raro));
      assert.doesNotThrow(() => textoDelHastaDeRestituidos(raro));
      assert.doesNotThrow(() => textoDesdeDeLosRestituidos(raro, raro));
    }
    // Sin un hoy válido, el rango no existe
    assert.deepEqual(validarRestituidos(alta('2027-04-12'), { hoy: 'x', estado: ESTADO, grupos: [GRUPO] }),
      mal('desde', MENSAJES_MI_ESPACIO.fecha));
    assert.equal(textoDesdeDeLosRestituidos(null, 'x'), 'Elegí un día del — al —.');
  });
});

describe('los textos de los días restituidos y sus avisos (spec 2026-10-31-mi-espacio-dias-restituidos, 5, 7, 9 y 10)', () => {
  const ESTADO = JULIETA.estado;
  const [VACACIONES_DE_JULIETA] = ESTADO.licencias;
  const VUELVE = '2027-01-11';
  const DE_JULIETA = Object.freeze({ tipo: 'vacaciones', desde: '2026-12-11', hasta: '2027-01-08' });
  // Los textos de la maqueta (window.MQ.T de docs/superpowers/specs/2026-10-31-mi-espacio-dias-restituidos-mockups/datos.js),
  // copiados a mano
  const T = Object.freeze({
    avisoA: 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: tenés 2 días restituidos de la licencia 2024. Como '
      + 'esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, con la nota al Director '
      + 'General. Si no, se pierden.',
    bajadaA: 'Además, 2 restituidos de la 2024: empezá a tomarlos a más tardar el viernes 30/04.',
    venceTituloA: '2 días restituidos de la 2024',
    botonA: 'Cargar los días restituidos',
    filaA: '2 días por restituir (asuetos del 24/12 y el 31/12/2026): empezá a tomarlos a más tardar el 30/04/2027.',
    filaCargados: 'Los 2 días restituidos están cargados del 12/04 al 13/04/2027.',
    filaPerdidos: '2 días por restituir: se perdieron el 30/04/2027.',
    avisoB: 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: podés pedir que te restituyan 2 días a tu licencia '
      + '2025. Pedilo con la nota al Director General a más tardar el viernes 30/04/2027. Si no, se pierden.',
    bajadaB: 'Además, 2 por restituir: pedí la restitución a más tardar el viernes 30/04.',
    venceTituloB: '2 días para restituir a la 2025',
    botonB: 'Pedir la restitución',
    filaB: '2 días por restituir a la licencia 2025 (asuetos del 24/12 y el 31/12/2026): pedí la restitución a más tardar el '
      + '30/04/2027.',
    filaPedida: 'Restitución pedida el 01/04/2027: los 2 días volvieron a la licencia 2025.',
    modalB: '<b>2 días hábiles vuelven a tu licencia 2025</b> (vence el 31/12/2027), por los asuetos del 24/12 y el '
      + '31/12/2026. Al pedirla se arma la nota al Director General y los días vuelven enseguida.'
  });
  // Los tres párrafos del email de la maqueta (email.html), con las negritas en <strong>
  const EMAIL_A = Object.freeze([
    'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés <strong>2 días '
      + 'restituidos de la licencia 2024</strong>.',
    'Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el <strong>viernes 30/04/2027</strong>, con la '
      + 'nota al Director General. Si no, se pierden.',
    'En Mi espacio podés cargarlos y bajar la nota en Word.'
  ]);

  // Una fila de la foto, un pedido (desde el 10) y una carga de días restituidos (desde el 20), como en los grupos
  const fotoDe = (id, licenciaId, fecha, extra = {}) =>
    ({ id, licencia_id: licenciaId, feriado_id: 1, fecha, tanda: null, restitucion_id: null, ...extra });
  const pedidoDe = (id, extra = {}) => ({
    id, licencia_id: 1, anio: 2025, caso: 'restituir', dias: 2, primer_asueto: '2026-12-24', tanda: 0, fecha: '2027-04-01',
    carga_id: null, activo: 1, licencia: { ...DE_JULIETA, activo: 1 }, ...extra
  });
  const restituidos = (id, desde, hasta) => ({ id, tipo: 'restituidos', desde, hasta, horas: null });
  const fotoSellada = (restitucionId) => ESTADO.restituibles.map((fila) => ({ ...fila, tanda: 0, restitucion_id: restitucionId }));
  const con = (cambios) => ({ ...ESTADO, ...cambios });
  // La variante B (spec, 5): las mismas vacaciones, con 20 de la 2025 y sin saldo de la 2024
  const VARIANTE_B = con({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 20, 2026: 10 }) });
  // Con un solo asueto en la foto (el del 24/12): un día por restituir
  const UN_DIA = con({ restituibles: [ESTADO.restituibles[0]] });
  const UN_DIA_B = { ...VARIANTE_B, restituibles: [ESTADO.restituibles[0]] };
  // Julieta con los días de la 2024 ya cargados del lunes 12/04 al martes 13/04/2027
  const CARGA_A = Object.freeze(restituidos(20, '2027-04-12', '2027-04-13'));
  const CARGADA = con({
    licencias: [VACACIONES_DE_JULIETA, CARGA_A],
    restituibles: fotoSellada(10),
    restituciones: [pedidoDe(10, { anio: 2024, caso: 'tomar', fecha: '2027-02-01', carga_id: 20 })]
  });
  // La variante B con la restitución pedida el 01/04/2027
  const PEDIDA = { ...VARIANTE_B, restituibles: fotoSellada(10), restituciones: [pedidoDe(10)] };
  // La recursión: con los días cargados, asuetos el lunes 12/04 (y el martes 13/04) en la carga de días restituidos
  const RECURSION_UNO = { ...CARGADA, restituibles: [...CARGADA.restituibles, fotoDe(12, 20, '2027-04-12')] };
  const RECURSION_DOS = { ...RECURSION_UNO, restituibles: [...RECURSION_UNO.restituibles, fotoDe(13, 20, '2027-04-13')] };
  const ASUETOS_DE_ABRIL = new Set([...ASUETOS, '2027-04-12', '2027-04-13']);

  // Los grupos de un estado en un día (los de calcular), y el primero por restituir
  const gruposDe = (estado, hoy = VUELVE, feriados = ASUETOS) => calcular(estado, { hoy, feriados }).restituciones;
  const porRestituirDe = (estado, hoy = VUELVE, feriados = ASUETOS) =>
    gruposDe(estado, hoy, feriados).find((grupo) => grupo.situacion === 'por_restituir');
  const GRUPO_A = porRestituirDe(ESTADO);
  const GRUPO_B = porRestituirDe(VARIANTE_B);
  const GRUPO_A_UNO = porRestituirDe(UN_DIA);
  const GRUPO_B_UNO = porRestituirDe(UN_DIA_B);
  const [GRUPO_CARGADO] = gruposDe(CARGADA, '2027-04-14');
  const [GRUPO_PEDIDO] = gruposDe(PEDIDA, '2027-04-01');
  const [GRUPO_PERDIDO] = gruposDe(ESTADO, '2027-05-03');
  const GRUPO_RECURSION_UNO = porRestituirDe(RECURSION_UNO, '2027-04-14', ASUETOS_DE_ABRIL);
  const GRUPO_RECURSION_DOS = porRestituirDe(RECURSION_DOS, '2027-04-14', ASUETOS_DE_ABRIL);
  // Las partes de un párrafo en texto (sin las negritas) y en HTML (con <strong>)
  const enTexto = (partes) => partes.map((parte) => (typeof parte === 'string' ? parte : parte.negrita)).join('');
  const enHtml = (partes) => partes.map((parte) => (typeof parte === 'string' ? parte : `<strong>${parte.negrita}</strong>`))
    .join('');
  const RAROS = [undefined, null, '', 'x', 0, 3, NaN, [], {}];
  // Lo que no sirve en un campo de un grupo (un 3 es un año, un id o unos días válidos)
  const NO_SIRVEN = [undefined, null, '', 'x', -1, 1.5, NaN, [], {}];

  it('los grupos de los momentos de la maqueta', () => {
    assert.deepEqual([GRUPO_A.clave, GRUPO_A.caso, GRUPO_A.dias, GRUPO_A.plazo], ['1-2024-0', 'tomar', 2, '2027-04-30']);
    assert.deepEqual([GRUPO_B.clave, GRUPO_B.caso, GRUPO_B.dias], ['1-2025-0', 'restituir', 2]);
    assert.deepEqual([GRUPO_A_UNO.dias, GRUPO_A_UNO.fechas, GRUPO_B_UNO.dias, GRUPO_B_UNO.caso],
      [1, ['2026-12-24'], 1, 'restituir']);
    assert.deepEqual([GRUPO_CARGADO.situacion, GRUPO_PEDIDO.situacion, GRUPO_PERDIDO.situacion], ['cargada', 'pedida', 'perdida']);
    assert.deepEqual([GRUPO_RECURSION_UNO.clave, GRUPO_RECURSION_UNO.caso, GRUPO_RECURSION_UNO.plazo, GRUPO_RECURSION_UNO.carga],
      ['20-2024-0', 'tomar', '2027-08-31', { tipo: 'restituidos', desde: '2027-04-12', hasta: '2027-04-13' }]);
    assert.deepEqual(GRUPO_RECURSION_DOS.fechas, ['2027-04-12', '2027-04-13']);
  });

  it('el aviso del Resumen: el caso A desde el 01/01, con la licencia ya vencida, como en la maqueta', () => {
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A, VUELVE), T.avisoA);
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A, '2027-01-01'), T.avisoA);
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A, '2027-04-30'), T.avisoA);
  });

  it('el aviso A hasta el vencimiento de la licencia, inclusive: «vence el 31/12/2026, antes del plazo» (decisión 3)', () => {
    const antes = 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: tenés 2 días restituidos de la licencia 2024. '
      + 'Como esa licencia vence el 31/12/2026, antes del plazo, tomalos todos juntos, empezando a más tardar el viernes '
      + '30/04/2027, con la nota al Director General. Si no, se pierden.';
    assert.equal(textoDelAvisoDeRestitucion(porRestituirDe(ESTADO, '2026-12-22'), '2026-12-22'), antes);
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A, '2026-12-31'), antes);
    // Sin un hoy que sirva, el de la licencia ya vencida
    for (const raro of RAROS) assert.equal(textoDelAvisoDeRestitucion(GRUPO_A, raro), T.avisoA, JSON.stringify(raro));
  });

  it('el aviso B y los de un solo día', () => {
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_B, VUELVE), T.avisoB);
    // El caso B no depende del día
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_B, '2026-12-22'), T.avisoB);
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A_UNO, VUELVE), 'El asueto del 24/12/2026 cayó en tus vacaciones: tenés '
      + '1 día restituido de la licencia 2024. Como esa licencia ya venció, tomalo a más tardar el viernes 30/04/2027, con la '
      + 'nota al Director General. Si no, se pierde.');
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_A_UNO, '2026-12-22'), 'El asueto del 24/12/2026 cayó en tus vacaciones: '
      + 'tenés 1 día restituido de la licencia 2024. Como esa licencia vence el 31/12/2026, antes del plazo, tomalo a más tardar '
      + 'el viernes 30/04/2027, con la nota al Director General. Si no, se pierde.');
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_B_UNO, VUELVE), 'El asueto del 24/12/2026 cayó en tus vacaciones: podés '
      + 'pedir que te restituyan 1 día a tu licencia 2025. Pedilo con la nota al Director General a más tardar el viernes '
      + '30/04/2027. Si no, se pierde.');
  });

  it('el aviso de la recursión: los asuetos cayeron en tus días restituidos', () => {
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_RECURSION_UNO, '2027-04-14'), 'El asueto del 12/04/2027 cayó en tus días '
      + 'restituidos: tenés 1 día restituido de la licencia 2024. Como esa licencia ya venció, tomalo a más tardar el martes '
      + '31/08/2027, con la nota al Director General. Si no, se pierde.');
    assert.equal(textoDelAvisoDeRestitucion(GRUPO_RECURSION_DOS, '2027-04-14'), 'Los asuetos del 12 y el 13/04/2027 cayeron en '
      + 'tus días restituidos: tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, '
      + 'empezando a más tardar el martes 31/08/2027, con la nota al Director General. Si no, se pierden.');
  });

  it('el botón del aviso', () => {
    assert.equal(textoDelBotonDeRestitucion(GRUPO_A), T.botonA);
    assert.equal(textoDelBotonDeRestitucion(GRUPO_A_UNO), 'Cargar el día restituido');
    assert.equal(textoDelBotonDeRestitucion(GRUPO_B), T.botonB);
    assert.equal(textoDelBotonDeRestitucion(GRUPO_B_UNO), T.botonB);
    assert.equal(textoDelBotonDeRestitucion(GRUPO_RECURSION_UNO), 'Cargar el día restituido');
  });

  it('la línea de la fila, por restituir: el caso A y el B, en plural y en singular', () => {
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_A), T.filaA);
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_A_UNO),
      '1 día por restituir (asueto del 24/12/2026): tomalo a más tardar el 30/04/2027.');
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_B), T.filaB);
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_B_UNO),
      '1 día por restituir a la licencia 2025 (asueto del 24/12/2026): pedí la restitución a más tardar el 30/04/2027.');
    // La carga que se pase no cambia nada
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_A, CARGA_A), T.filaA);
  });

  it('la línea de la fila, cargada, pedida y perdida', () => {
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_CARGADO, CARGA_A), T.filaCargados);
    assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_CARGADO, dias: 1, fechas: ['2026-12-24'] },
      restituidos(20, '2027-04-12', '2027-04-12')), 'El día restituido está cargado el 12/04/2027.');
    // Una carga de un día que empieza un sábado y termina el lunes dice sus dos fechas
    assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_CARGADO, dias: 1, fechas: ['2026-12-24'] },
      restituidos(20, '2027-04-10', '2027-04-12')), 'El día restituido está cargado del 10/04 al 12/04/2027.');
    // Sin la carga (o con algo que no tiene fechas), sin fechas
    for (const raro of [undefined, null, 'x', {}, { desde: 'x', hasta: 'y' }]) {
      assert.equal(textoDeLaFilaDeRestitucion(GRUPO_CARGADO, raro), 'Los 2 días restituidos están cargados.', JSON.stringify(raro));
    }
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_PEDIDO), T.filaPedida);
    assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_PEDIDO, dias: 1, fechas: ['2026-12-24'] }),
      'Restitución pedida el 01/04/2027: el día volvió a la licencia 2025.');
    assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_PEDIDO, fecha_pedido: null }),
      'Restitución pedida: los 2 días volvieron a la licencia 2025.');
    assert.equal(textoDeLaFilaDeRestitucion(GRUPO_PERDIDO), T.filaPerdidos);
    assert.equal(textoDeLaFilaDeRestitucion(gruposDe(UN_DIA, '2027-05-03')[0]), '1 día por restituir: se perdió el 30/04/2027.');
    // Una perdida del caso B dice lo mismo
    assert.equal(textoDeLaFilaDeRestitucion(gruposDe(VARIANTE_B, '2027-05-03')[0]), T.filaPerdidos);
  });

  it('la oración de la banda: juntos por caso y plazo, en ámbar los últimos 30 días corridos (decisión 7)', () => {
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A], VUELVE), [{ texto: T.bajadaA, vence: false }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(ESTADO, '2027-03-30'), '2027-03-30'), [{ texto: T.bajadaA, vence: false }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(ESTADO, '2027-03-31'), '2027-03-31'), [{ texto: T.bajadaA, vence: true }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(ESTADO, '2027-04-30'), '2027-04-30'), [{ texto: T.bajadaA, vence: true }]);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_B], VUELVE), [{ texto: T.bajadaB, vence: false }]);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A_UNO], VUELVE),
      [{ texto: 'Además, 1 restituido de la 2024: tomalo a más tardar el viernes 30/04.', vence: false }]);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_B_UNO], VUELVE),
      [{ texto: 'Además, 1 por restituir: pedí la restitución a más tardar el viernes 30/04.', vence: false }]);
  });

  it('la oración de la banda con dos licencias: las del caso A juntas, y las del B aparte', () => {
    // Dos grupos del caso A con el mismo plazo, de la 2024 y de la 2025 (desordenados)
    const de2025 = { ...GRUPO_A_UNO, clave: '1-2025-0', anio: 2025, fechas: ['2026-12-31'] };
    assert.deepEqual(bajadaDeRestituciones([de2025, GRUPO_A], VUELVE), [{
      texto: 'Además, 2 restituidos de la 2024 y 1 de la 2025: empezá a tomarlos a más tardar el viernes 30/04.', vence: false
    }]);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A_UNO, de2025], VUELVE), [{
      texto: 'Además, 1 restituido de la 2024 y 1 de la 2025: empezá a tomarlos a más tardar el viernes 30/04.', vence: false
    }]);
    // La misma licencia en dos cargas se suma
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A, { ...GRUPO_A_UNO, clave: '7-2024-0', licencia_id: 7 }], VUELVE),
      [{ texto: 'Además, 3 restituidos de la 2024: empezá a tomarlos a más tardar el viernes 30/04.', vence: false }]);
    // Julieta con 12 de la 2024: el 24/12 sale de la 2024 (caso A) y el 31/12, de la 2025 (caso B), con el mismo plazo
    const dosLicencias = con({ saldos: saldosDeVacaciones({ 2024: 12, 2025: 15, 2026: 10 }) });
    assert.deepEqual(bajadaDeRestituciones(gruposDe(dosLicencias), VUELVE), [
      { texto: 'Además, 1 restituido de la 2024: tomalo a más tardar el viernes 30/04.', vence: false },
      { texto: 'Además, 1 por restituir: pedí la restitución a más tardar el viernes 30/04.', vence: false }
    ]);
    // Dos del caso B con el mismo plazo se suman
    assert.deepEqual(bajadaDeRestituciones([GRUPO_B, { ...GRUPO_B_UNO, clave: '1-2026-0', anio: 2026 }], VUELVE),
      [{ texto: 'Además, 3 por restituir: pedí la restitución a más tardar el viernes 30/04.', vence: false }]);
    // Con otro plazo, otra oración, por plazo (y la del plazo más cercano, en ámbar)
    const deMayo = { ...GRUPO_A, clave: '7-2024-1', licencia_id: 7, tanda: 1, plazo: '2027-05-31' };
    assert.deepEqual(bajadaDeRestituciones([deMayo, GRUPO_A], '2027-04-15'), [
      { texto: T.bajadaA, vence: true },
      { texto: 'Además, 2 restituidos de la 2024: empezá a tomarlos a más tardar el lunes 31/05.', vence: false }
    ]);
  });

  it('la oración de la banda: con el plazo en otro año que hoy, la fecha lleva el año', () => {
    // El 22/12/2026, el día de los asuetos, el plazo es del año siguiente
    const delAsueto = '2026-12-22';
    assert.deepEqual(bajadaDeRestituciones(gruposDe(ESTADO, delAsueto), delAsueto), [{
      texto: 'Además, 2 restituidos de la 2024: empezá a tomarlos a más tardar el viernes 30/04/2027.', vence: false
    }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(VARIANTE_B, delAsueto), delAsueto), [{
      texto: 'Además, 2 por restituir: pedí la restitución a más tardar el viernes 30/04/2027.', vence: false
    }]);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A_UNO], delAsueto),
      [{ texto: 'Además, 1 restituido de la 2024: tomalo a más tardar el viernes 30/04/2027.', vence: false }]);
    // El 01/04/2027, del mismo año: sin el año
    const enAbril = '2027-04-01';
    assert.deepEqual(bajadaDeRestituciones(gruposDe(ESTADO, enAbril), enAbril), [{ texto: T.bajadaA, vence: true }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(VARIANTE_B, enAbril), enAbril), [{ texto: T.bajadaB, vence: true }]);
  });

  it('la oración de la banda: solo lo que está por restituir, hasta el plazo inclusive', () => {
    assert.deepEqual(bajadaDeRestituciones([GRUPO_CARGADO, GRUPO_PEDIDO, GRUPO_PERDIDO], VUELVE), []);
    // Un grupo por restituir que ya pasó su plazo (calculado otro día) no va; en el plazo, sí
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A, GRUPO_B], '2027-05-03'), []);
    assert.deepEqual(bajadaDeRestituciones([GRUPO_A], '2027-04-30'), [{ texto: T.bajadaA, vence: true }]);
    assert.deepEqual(bajadaDeRestituciones(gruposDe(CARGADA, '2027-04-14'), '2027-04-14'), []);
    assert.deepEqual(bajadaDeRestituciones([], VUELVE), []);
    for (const raro of RAROS) {
      assert.deepEqual(bajadaDeRestituciones(raro, VUELVE), [], JSON.stringify(raro));
      assert.deepEqual(bajadaDeRestituciones([GRUPO_A], raro), [], JSON.stringify(raro));
    }
    for (const raro of NO_SIRVEN) {
      assert.deepEqual(bajadaDeRestituciones([raro, { ...GRUPO_A, plazo: raro }, { ...GRUPO_A, caso: raro },
        { ...GRUPO_A, dias: raro }, { ...GRUPO_A, anio: raro }], VUELVE), [], JSON.stringify(raro));
    }
  });

  it('el título de «Vence pronto»', () => {
    assert.equal(tituloDeRestitucionQueVence(GRUPO_A), T.venceTituloA);
    assert.equal(tituloDeRestitucionQueVence(GRUPO_B), T.venceTituloB);
    assert.equal(tituloDeRestitucionQueVence(GRUPO_A_UNO), '1 día restituido de la 2024');
    assert.equal(tituloDeRestitucionQueVence(GRUPO_B_UNO), '1 día para restituir a la 2025');
  });

  it('los párrafos del email del caso A, como en la maqueta, con las negritas aparte', () => {
    const partes = partesDelEmailDeRestitucion(GRUPO_A, VUELVE);
    assert.deepEqual(partes, [
      ['Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés ',
        { negrita: '2 días restituidos de la licencia 2024' }, '.'],
      ['Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el ', { negrita: 'viernes 30/04/2027' },
        ', con la nota al Director General. Si no, se pierden.'],
      ['En Mi espacio podés cargarlos y bajar la nota en Word.']
    ]);
    assert.deepEqual(partes.map(enHtml), EMAIL_A);
    // Los dos primeros, sin las vacaciones, son el aviso del Resumen (decisión 16: el email las nombra; el aviso, no)
    assert.equal(`${enTexto(partes[0]).replace(' del 11/12/2026 al 08/01/2027', '')} ${enTexto(partes[1])}`, T.avisoA);
    // Hasta el vencimiento de la licencia, «vence el … antes del plazo»
    assert.deepEqual(partesDelEmailDeRestitucion(GRUPO_A, '2026-12-22')[1], ['Como esa licencia vence el 31/12/2026, antes '
      + 'del plazo, tomalos todos juntos, empezando a más tardar el ', { negrita: 'viernes 30/04/2027' },
    ', con la nota al Director General. Si no, se pierden.']);
  });

  it('los párrafos del email del caso B, de un solo día y de la recursión', () => {
    assert.deepEqual(partesDelEmailDeRestitucion(GRUPO_B, VUELVE), [
      ['Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: podés pedir que te '
        + 'restituyan ', { negrita: '2 días a tu licencia 2025' }, '.'],
      ['Pedilo con la nota al Director General a más tardar el ', { negrita: 'viernes 30/04/2027' },
        '. Si no, se pierden.'],
      ['En Mi espacio podés pedirla y bajar la nota en Word.']
    ]);
    assert.deepEqual(partesDelEmailDeRestitucion(GRUPO_A_UNO, VUELVE), [
      ['El asueto del 24/12/2026 cayó en tus vacaciones del 11/12/2026 al 08/01/2027: tenés ',
        { negrita: '1 día restituido de la licencia 2024' }, '.'],
      ['Como esa licencia ya venció, tomalo a más tardar el ', { negrita: 'viernes 30/04/2027' },
        ', con la nota al Director General. Si no, se pierde.'],
      ['En Mi espacio podés cargarlo y bajar la nota en Word.']
    ]);
    assert.deepEqual(partesDelEmailDeRestitucion(GRUPO_B_UNO, VUELVE), [
      ['El asueto del 24/12/2026 cayó en tus vacaciones del 11/12/2026 al 08/01/2027: podés pedir que te restituyan ',
        { negrita: '1 día a tu licencia 2025' }, '.'],
      ['Pedilo con la nota al Director General a más tardar el ', { negrita: 'viernes 30/04/2027' }, '. Si no, se pierde.'],
      ['En Mi espacio podés pedirla y bajar la nota en Word.']
    ]);
    assert.deepEqual(partesDelEmailDeRestitucion(GRUPO_RECURSION_UNO, '2027-04-14')[0], [
      'El asueto del 12/04/2027 cayó en tus días restituidos del 12/04 al 13/04/2027: tenés ',
      { negrita: '1 día restituido de la licencia 2024' }, '.'
    ]);
    // Sin las fechas de la carga, sin «del … al …»
    assert.equal(enTexto(partesDelEmailDeRestitucion({ ...GRUPO_A, carga: { tipo: 'vacaciones', desde: null, hasta: null } },
      VUELVE)[0]), 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones: tenés 2 días restituidos de la licencia 2024.');
  });

  it('el recuadro del modal B y los mensajes del pedido', () => {
    const recuadro = recuadroDeLaRestitucion(GRUPO_B);
    assert.deepEqual(recuadro, {
      resaltado: '2 días hábiles vuelven a tu licencia 2025',
      resto: ' (vence el 31/12/2027), por los asuetos del 24/12 y el 31/12/2026. Al pedirla se arma la nota al Director '
        + 'General y los días vuelven enseguida.'
    });
    assert.equal(`<b>${recuadro.resaltado}</b>${recuadro.resto}`, T.modalB);
    assert.deepEqual(recuadroDeLaRestitucion(GRUPO_B_UNO), {
      resaltado: '1 día hábil vuelve a tu licencia 2025',
      resto: ' (vence el 31/12/2027), por el asueto del 24/12/2026. Al pedirla se arma la nota al Director General y el día '
        + 'vuelve enseguida.'
    });
    assert.equal(mensajeDeLaRestitucionPedida(GRUPO_B), 'Restitución pedida: los 2 días volvieron a tu licencia 2025.');
    assert.equal(mensajeDeLaRestitucionPedida(GRUPO_B_UNO), 'Restitución pedida: el día volvió a tu licencia 2025.');
    assert.equal(MENSAJE_RESTITUCION_BORRADA, 'Pedido de restitución borrado: los días vuelven a estar por restituir.');
  });

  it('ningún texto habla de tardanza, demora ni reproches', () => {
    const textos = [
      ...[GRUPO_A, GRUPO_B, GRUPO_A_UNO, GRUPO_B_UNO, GRUPO_RECURSION_DOS].flatMap((grupo) => [
        textoDelAvisoDeRestitucion(grupo, VUELVE), textoDelBotonDeRestitucion(grupo), textoDeLaFilaDeRestitucion(grupo),
        tituloDeRestitucionQueVence(grupo), ...partesDelEmailDeRestitucion(grupo, VUELVE).map(enTexto),
        ...Object.values(recuadroDeLaRestitucion(grupo)), mensajeDeLaRestitucionPedida(grupo)
      ]),
      ...[GRUPO_CARGADO, GRUPO_PEDIDO, GRUPO_PERDIDO].map((grupo) => textoDeLaFilaDeRestitucion(grupo, CARGA_A)),
      ...bajadaDeRestituciones([GRUPO_A, GRUPO_B], VUELVE).map(({ texto }) => texto), MENSAJE_RESTITUCION_BORRADA
    ];
    for (const texto of textos) {
      assert.ok(texto.length > 0);
      assert.doesNotMatch(texto, /tardanza|demora|atraso|undefined|null|NaN|—/i, texto);
    }
  });

  it('lo que no es un grupo (o un caso o una situación que no se conocen) da textos vacíos, y nada tira', () => {
    for (const raro of RAROS) {
      for (const grupo of [raro, { ...GRUPO_A, caso: raro }]) {
        assert.equal(textoDelAvisoDeRestitucion(grupo, VUELVE), '', JSON.stringify(grupo));
        assert.equal(textoDelBotonDeRestitucion(grupo), '', JSON.stringify(grupo));
        assert.equal(tituloDeRestitucionQueVence(grupo), '', JSON.stringify(grupo));
        assert.deepEqual(partesDelEmailDeRestitucion(grupo, VUELVE), [], JSON.stringify(grupo));
      }
      assert.equal(textoDeLaFilaDeRestitucion(raro), '', JSON.stringify(raro));
      assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_A, situacion: raro }), '', JSON.stringify(raro));
      assert.equal(textoDeLaFilaDeRestitucion({ ...GRUPO_A, caso: raro }), '', JSON.stringify(raro));
      for (const grupo of [raro, { ...GRUPO_B, caso: raro }]) {
        assert.deepEqual(recuadroDeLaRestitucion(grupo), { resaltado: '', resto: '' }, JSON.stringify(grupo));
        assert.equal(mensajeDeLaRestitucionPedida(grupo), '', JSON.stringify(grupo));
      }
      // Un grupo con las partes raras no tira
      const torcido = { ...GRUPO_A, fechas: raro, dias: raro, anio: raro, plazo: raro, carga: raro, fecha_pedido: raro };
      for (const situacion of ['por_restituir', 'cargada', 'pedida', 'perdida']) {
        for (const caso of ['tomar', 'restituir']) {
          const grupo = { ...torcido, situacion, caso };
          assert.doesNotThrow(() => {
            textoDelAvisoDeRestitucion(grupo, raro);
            textoDelBotonDeRestitucion(grupo);
            textoDeLaFilaDeRestitucion(grupo, raro);
            tituloDeRestitucionQueVence(grupo);
            partesDelEmailDeRestitucion(grupo, raro);
            recuadroDeLaRestitucion(grupo);
            mensajeDeLaRestitucionPedida(grupo);
            bajadaDeRestituciones([grupo], VUELVE);
          }, JSON.stringify(grupo));
        }
      }
    }
  });

  describe('avisosDeVencimiento: los dos avisos de cada grupo por restituir', () => {
    // Como la corrida (services/miEspacioAvisos.js)
    const avisosDe = (estado, hoy, feriados = ASUETOS) => avisosDeVencimiento(calcular(estado, { hoy, feriados }),
      { hoy, feriados, modalidad: estado.modalidad, ocupadas: estado.licencias });
    const avisoDe = (grupo, hoy, numero) => ({
      clave: `restitucion-${grupo.clave}-${numero}`,
      texto: partesDelEmailDeRestitucion(grupo, hoy).map(enTexto).join(' '),
      restitucion: { grupo: grupo.clave, partes: partesDelEmailDeRestitucion(grupo, hoy), primero: numero === 1 }
    });

    it('el lunes 11/01/2027, al volver, solo el primero, con el texto del email', () => {
      assert.deepEqual(avisosDe(ESTADO, VUELVE), [avisoDe(GRUPO_A, VUELVE, 1)]);
      const [aviso] = avisosDe(ESTADO, VUELVE);
      assert.equal(aviso.clave, 'restitucion-1-2024-0-1');
      assert.equal(aviso.texto, 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: '
        + 'tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más '
        + 'tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierden. En Mi espacio podés cargarlos y '
        + 'bajar la nota en Word.');
      assert.deepEqual(aviso.restitucion.partes.map(enHtml), EMAIL_A);
      // Desde el día en que aparece (el de los asuetos, con la licencia todavía sin vencer)
      const grupoDel22 = porRestituirDe(ESTADO, '2026-12-22');
      assert.deepEqual(avisosDe(ESTADO, '2026-12-22'), [avisoDe(grupoDel22, '2026-12-22', 1)]);
    });

    it('el segundo, desde 5 días hábiles antes del plazo: el viernes 23/04/2027 los dos, hasta el plazo', () => {
      const claves = (hoy, estado = ESTADO, feriados = ASUETOS) => avisosDe(estado, hoy, feriados).map((aviso) => aviso.clave);
      assert.deepEqual(claves('2027-04-22'), ['restitucion-1-2024-0-1']);
      assert.deepEqual(avisosDe(ESTADO, '2027-04-23'), [avisoDe(GRUPO_A, '2027-04-23', 1), avisoDe(GRUPO_A, '2027-04-23', 2)]);
      assert.deepEqual(claves('2027-04-30'), ['restitucion-1-2024-0-1', 'restitucion-1-2024-0-2']);
      // Pasado el plazo, ninguno
      assert.deepEqual(claves('2027-05-01'), []);
      assert.deepEqual(claves('2027-05-03'), []);
      // Con un feriado el martes 27/04, el segundo empieza el jueves 22/04
      const conFeriado = new Set([...ASUETOS, '2027-04-27']);
      assert.deepEqual(claves('2027-04-21', ESTADO, conFeriado), ['restitucion-1-2024-0-1']);
      assert.deepEqual(claves('2027-04-22', ESTADO, conFeriado), ['restitucion-1-2024-0-1', 'restitucion-1-2024-0-2']);
      // El caso B, con su texto
      assert.deepEqual(avisosDe(VARIANTE_B, '2027-04-23'),
        [avisoDe(GRUPO_B, '2027-04-23', 1), avisoDe(GRUPO_B, '2027-04-23', 2)]);
    });

    it('sin grupos pedidos, cargados ni perdidos', () => {
      assert.deepEqual(avisosDe(PEDIDA, '2027-04-23'), []);
      assert.deepEqual(avisosDe(CARGADA, '2027-04-23'), []);
      assert.deepEqual(avisosDe(con({ restituibles: [] }), VUELVE), []);
      const hoy = '2027-04-23';
      const calculo = calcular(ESTADO, { hoy, feriados: ASUETOS });
      const opciones = { hoy, feriados: ASUETOS, modalidad: 'planta' };
      assert.deepEqual(avisosDeVencimiento({ ...calculo, restituciones: [GRUPO_CARGADO, GRUPO_PEDIDO, GRUPO_PERDIDO] }, opciones),
        []);
      // Un grupo por restituir que ya pasó su plazo (el cálculo es de otro día), tampoco
      assert.deepEqual(avisosDeVencimiento(calculo, { ...opciones, hoy: '2027-05-03' }), []);
    });

    it('después de lo de antes, por plazo; las claves entran en varchar(40)', () => {
      const hoy = '2026-12-01';
      const calculo = calcular(PLANTA.estado, { hoy, feriados: SIN_FERIADOS });
      const deMayo = { ...GRUPO_A, clave: '7-2024-1', licencia_id: 7, tanda: 1, plazo: '2027-05-31' };
      const avisos = avisosDeVencimiento({ ...calculo, restituciones: [deMayo, GRUPO_A] },
        { hoy, feriados: SIN_FERIADOS, modalidad: 'planta', ocupadas: PLANTA.estado.licencias });
      assert.deepEqual(avisos.map((aviso) => aviso.clave),
        ['franquicia-2026', 'licencia-2024', 'restitucion-1-2024-0-1', 'restitucion-7-2024-1-1']);
      // La clave sale del grupo (la carga, el año y la tanda), con los números más grandes de sus columnas
      const grande = { ...GRUPO_A, clave: '2147483647-2024-32767', licencia_id: 2147483647, tanda: 32767 };
      const [aviso] = avisosDeVencimiento({ restituciones: [grande] }, { hoy: VUELVE, feriados: ASUETOS });
      assert.equal(aviso.clave, 'restitucion-2147483647-2024-32767-1');
      assert.ok(aviso.clave.length <= 40);
      assert.ok(`${aviso.clave.slice(0, -1)}2`.length <= 40);
      assert.equal(aviso.restitucion.grupo, '2147483647-2024-32767');
    });

    it('nada tira con grupos raros', () => {
      for (const raro of NO_SIRVEN) {
        const restituciones = [raro, { ...GRUPO_A, situacion: 'por_restituir', plazo: raro },
          { ...GRUPO_A, licencia_id: raro }, { ...GRUPO_A, anio: raro }, { ...GRUPO_A, tanda: raro }, { ...GRUPO_A, caso: raro }];
        assert.deepEqual(avisosDeVencimiento({ restituciones }, { hoy: VUELVE, feriados: raro }), [], JSON.stringify(raro));
        assert.deepEqual(avisosDeVencimiento({ restituciones: raro }, { hoy: VUELVE, feriados: ASUETOS }), [],
          JSON.stringify(raro));
      }
    });
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

  it('textoDePerdidos: «vence» con 1, varias en una lista y nada sin perdidos', () => {
    assert.equal(textoDePerdidos([{ anio: 2024, perdidos: 1, vence: '2026-12-31' }]),
      'Perdés 1 de la 2024 (vence el 31/12/2026).');
    assert.equal(textoDePerdidos([
      { anio: 2024, perdidos: 2, vence: '2026-12-31' }, { anio: 2025, perdidos: 1, vence: '2027-12-31' },
      { anio: 2026, perdidos: 0, vence: '2028-12-31' }, null
    ]), 'Perdés 2 de la 2024 (vencen el 31/12/2026) y 1 de la 2025 (vence el 31/12/2027).');
    for (const sinNada of [[], null, undefined, 'x', [{ anio: 2024, perdidos: 0 }], [{ anio: 2024 }], [7, 'x', []]]) {
      assert.equal(textoDePerdidos(sinNada), '', String(sinNada));
    }
  });

  it('sin días que salgan de una licencia, no hay texto', () => {
    const reparto = repartoDeVacaciones(PLANTA.estado, { hoy: HOY, feriados: SIN_FERIADOS });
    assert.equal(textoDelReparto(reparto, 999), '');
    assert.equal(textoDe(PLANTA.estado, vacaciones(100, '2026-10-21', '2026-10-23')), '');
  });

  // «la más vieja» solo cuando es cierto (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.9): si queda una licencia
  // más vieja que la primera que usa la carga, no vencida y con días (disponibles o que se pierden), no va
  it('«la más vieja»: no va si queda una más vieja con días; una carga de enero no usa la 2024, que sigue con sus 15', () => {
    assert.equal(textoDeLaCarga(PERSONA, [vacaciones(100, '2027-01-04', '2027-01-08')], 100),
      'Salen de la licencia 2025. Te quedan 40 días: 15 de la 2024 (vencen el 31/12/2026), 15 de la 2025 y 10 de la 2026.');
    assert.equal(textoDeLaCarga(PERSONA, [vacaciones(100, '2027-01-04', '2027-02-05')], 100),
      'Salen de las licencias 2025 (20 días) y 2026 (5 días). Te quedan 20 días: 15 de la 2024 (vencen el 31/12/2026) y 5 '
      + 'de la 2026.');
  });

  it('«la más vieja»: tampoco si a la más vieja solo le quedan días que se pierden', () => {
    // La de diciembre deja 7 de la 2024 sin ningún día libre hasta el 31/12: la de enero ya no puede usarlos, pero quedan
    assert.equal(textoDeLaCarga(PERSONA, [vacaciones(100, '2026-12-21', '2026-12-31'),
      vacaciones(101, '2027-01-04', '2027-01-10')], 101),
    'Salen de la licencia 2025. Te quedan 25 días: 15 de la 2025 y 10 de la 2026. Perdés 7 de la 2024 (vencen el 31/12/2026).');
  });

  it('«la más vieja»: sí con la más vieja vencida a hoy o sin días', () => {
    // El 04/01/2027 la 2024 ya venció: la 2025 es la más vieja
    const enero = repartoDeVacaciones(soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2027-01-04', '2027-01-08')),
      { hoy: '2027-01-04', feriados: SIN_FERIADOS });
    assert.equal(textoDelReparto(enero, 100),
      'Salen de la licencia 2025, la más vieja. Te quedan 35 días: 15 de la 2025 (vencen el 31/12/2027) y 20 de la 2026.');
    // Sin días de la 2024 (CONTRATO la tiene en 0), la 2025 también es la más vieja
    assert.equal(textoDe(CONTRATO.estado, vacaciones(100, '2026-11-03', '2026-11-09')),
      'Salen de la licencia 2025, la más vieja. Te quedan 8 días, todos de la 2026.');
    // Una más vieja ya vencida no cuenta, aunque traiga días (un reparto armado a mano)
    const aMano = {
      hoy: '2027-01-04', porFila: new Map([[1, [{ anio: 2025, dias: 2 }]]]), sinCubrir: new Map(),
      ordinarias: [{ anio: 2024, vence: '2026-12-31', disponibles: 3, perdidos: 1 },
        { anio: 2025, vence: '2027-12-31', disponibles: 0, perdidos: 0 }]
    };
    assert.ok(textoDelReparto(aMano, 1).startsWith('Salen de la licencia 2025, la más vieja.'));
    // Y una más nueva con días no cambia nada
    assert.ok(textoDelReparto({ ...aMano, ordinarias: [{ anio: 2026, vence: '2028-12-31', disponibles: 4, perdidos: 0 }] }, 1)
      .startsWith('Salen de la licencia 2025, la más vieja.'));
  });
});

describe('textoDeLosDiasHabiles (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.9)', () => {
  it('los hábiles y, si son menos, de cuántos corridos: la misma forma en el cálculo, la lista y el segundo paso', () => {
    assert.equal(textoDeLosDiasHabiles(18, 26), '18 días hábiles de 26 corridos');
    assert.equal(textoDeLosDiasHabiles(1, 3), '1 día hábil de 3 corridos');
    assert.equal(textoDeLosDiasHabiles(5, 5), '5 días hábiles');
    assert.equal(textoDeLosDiasHabiles(1, 1), '1 día hábil');
  });
});

describe('el rango de fechas y el día entero', () => {
  it('rangoDeFechas: del 01/01 de dos años antes al 31/12 del año siguiente', () => {
    assert.deepEqual(rangoDeFechas('2026-10-26'), { desde: '2024-01-01', hasta: '2027-12-31' });
    assert.deepEqual(rangoDeFechas('2027-01-01'), { desde: '2025-01-01', hasta: '2028-12-31' });
    for (const hoy of [null, undefined, '', '2026-02-30', 20261026]) assert.equal(rangoDeFechas(hoy), null);
  });

  it('esDiaEntero: los de días enteros, y los de horas con 7', () => {
    for (const tipo of ['vacaciones', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'restituidos']) {
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

// Una salida de la planilla de contrato (spec 2026-10-27-mi-espacio-horas; las de los casos tienen ids del 1 al 4: las de
// los tests, desde el 100). En un día hábil cuenta la salida desde las 15:00
const salida = (id, fecha, hora, entrada = null) => ({ id, fecha, entrada, salida: hora, nota: null });

// Un estado de contrato solo con salidas y sus usos, con el arranque de los casos: contrato lee solo las salidas
const conSalidas = (salidas, licencias = [], cambios = {}) => ({
  modalidad: 'contrato', arranque: HOY, anios: [], saldos: [], licencias, horasExtras: [], salidas, ...cambios
});

// Las salidas con los totales de los ejemplos del usuario: 10,5 en octubre (3,5 + 4 + 3), 7,5 en noviembre (4 + 3,5) y
// 6,5 en diciembre de 2026 (4 + 2,5)
const SALIDAS_DEL_USUARIO = [
  salida(100, '2026-10-06', '18:30'), salida(101, '2026-10-14', '19:00'), salida(102, '2026-10-22', '18:00'),
  salida(103, '2026-11-05', '19:00'), salida(104, '2026-11-12', '18:30'),
  salida(105, '2026-12-03', '19:00'), salida(106, '2026-12-10', '17:30')
];

// Las horas extras que tenía el caso CONTRATO antes de la planilla (los mismos días y los mismos totales que sus salidas: 10,5
// en septiembre y 4 en octubre). Desde la planilla, CONTRATO tiene solo sus salidas: estas sirven para ver que en planta (una
// persona de contrato que pasó a planta) sus horas extras dan francos, y que en contrato no cuentan
const HORAS_EXTRAS_DE_CONTRATO = [
  extra(1, '2026-09-10', '18:00', '22:00'), extra(2, '2026-09-17', '18:00', '22:00'), extra(3, '2026-09-24', '18:00', '20:30'),
  extra(4, '2026-10-21', '18:00', '22:00')
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

// La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 3, 4 y 7): cada día, la salida (y la
// entrada, obligatoria en un día que no es hábil), contada de a media hora con su tolerancia
describe('las salidas de contrato', () => {
  it('las constantes', () => {
    assert.equal(SALIDA_DE_LA_JORNADA, '15:00');
    assert.equal(TOLERANCIA_DIA_HABIL, 14);
    assert.equal(TOLERANCIA_DIA_INHABIL, 10);
    assert.equal(MAXIMO_DIAS_POR_GUARDADO, 100);
  });

  it('horaSalidaValida: HH:MM de un día, con cualquier minuto', () => {
    for (const hora of ['00:00', '08:02', '15:00', '16:46', '23:59']) assert.equal(horaSalidaValida(hora), true, hora);
    for (const hora of ['24:00', '9:05', '16:46:00', '25:00', '16:60', ' 16:46', '16:46 ', '1646', 1646, '', null, undefined,
      {}, []]) {
      assert.equal(horaSalidaValida(hora), false, String(hora));
    }
  });

  it('tipoDeDia: hábil, feriado (también un sábado o domingo que lo es, y los fijos) o sábado y domingo', () => {
    assert.equal(tipoDeDia('2026-10-26', SIN_FERIADOS), 'habil');
    assert.equal(tipoDeDia('2026-10-24', SIN_FERIADOS), 'finde');
    assert.equal(tipoDeDia('2026-10-25', SIN_FERIADOS), 'finde');
    const feriados = new Set(['2026-10-12', '2026-10-24']);
    assert.equal(tipoDeDia('2026-10-12', feriados), 'feriado');
    assert.equal(tipoDeDia('2026-10-12', SIN_FERIADOS), 'habil');
    // Un sábado que además es feriado
    assert.equal(tipoDeDia('2026-10-24', feriados), 'feriado');
    // Los 9 fijos: con el Set de feriadosDelRango y aunque el Set no los tenga (el 01/05/2027 cae sábado)
    assert.equal(tipoDeDia('2026-05-25', feriadosDelRango([], '2026-01-01', '2026-12-31')), 'feriado');
    assert.equal(tipoDeDia('2026-05-25', SIN_FERIADOS), 'feriado');
    assert.equal(tipoDeDia('2027-05-01', SIN_FERIADOS), 'feriado');
    // Un segundo parámetro que no es un Set no suma feriados
    assert.equal(tipoDeDia('2026-10-12', ['2026-10-12']), 'habil');
    for (const fecha of [undefined, null, '', 'x', '2026-02-30', '26/10/2026', 20261026, {}]) {
      assert.equal(tipoDeDia(fecha, SIN_FERIADOS), null, String(fecha));
    }
  });

  // Los 19 renglones del CSV del usuario (mayo de 2026: todos días hábiles), más el 15:14
  const CSV = [['2026-05-04', '15:15', 0], ['2026-05-05', '15:16', 0.5], ['2026-05-06', '15:27', 0.5],
    ['2026-05-07', '15:28', 0.5], ['2026-05-08', '15:29', 0.5], ['2026-05-11', '15:44', 0.5], ['2026-05-12', '15:45', 0.5],
    ['2026-05-13', '15:46', 1], ['2026-05-14', '15:47', 1], ['2026-05-15', '16:00', 1], ['2026-05-18', '16:14', 1],
    ['2026-05-19', '16:15', 1], ['2026-05-20', '16:16', 1.5], ['2026-05-21', '16:45', 1.5], ['2026-05-22', '16:46', 2],
    ['2026-05-26', '16:47', 2], ['2026-05-27', '17:01', 2], ['2026-05-28', '17:15', 2], ['2026-05-29', '17:16', 2.5],
    ['2026-05-04', '15:14', 0]];

  it('un día hábil cuenta la salida desde las 15:00, con la media hora desde el minuto 16 (el CSV del usuario)', () => {
    for (const [fecha, salida, horas] of CSV) assert.equal(horasDeLaSalida({ fecha, salida }, SIN_FERIADOS), horas, salida);
    // La entrada no cuenta
    assert.equal(horasDeLaSalida({ fecha: '2026-05-04', entrada: '07:00', salida: '15:16' }, SIN_FERIADOS), 0.5);
    // Una salida antes de las 15:00 da 0
    assert.equal(horasDeLaSalida({ fecha: '2026-05-04', salida: '13:02' }, SIN_FERIADOS), 0);
    // Con la entrada, la salida tiene que ser después (también en un día hábil)
    assert.equal(horasDeLaSalida({ fecha: '2026-05-04', entrada: '16:00', salida: '16:00' }, SIN_FERIADOS), null);
    assert.equal(horasDeLaSalida({ fecha: '2026-05-04', entrada: '16:30', salida: '16:20' }, SIN_FERIADOS), null);
  });

  it('un feriado, sábado o domingo cuenta de la entrada a la salida con 10 minutos de tolerancia (los ejemplos del usuario)', () => {
    const sab = '2026-10-24';
    for (const [entrada, salida, horas] of [['09:19', '12:10', 3], ['09:20', '12:10', 3], ['09:21', '12:10', 2.5],
      ['08:09', '15:00', 7], ['08:10', '15:00', 7], ['08:11', '15:00', 6.5], ['10:00', '11:19', 1], ['10:00', '11:20', 1.5],
      ['10:00', '11:49', 1.5], ['10:00', '11:50', 2], ['10:00', '11:21', 1.5], ['10:00', '11:51', 2], ['10:00', '10:19', 0],
      ['10:00', '10:20', 0.5]]) {
      assert.equal(horasDeLaSalida({ fecha: sab, entrada, salida }, SIN_FERIADOS), horas, `${entrada}-${salida}`);
    }
    // Un domingo, igual
    assert.equal(horasDeLaSalida({ fecha: '2026-10-25', entrada: '09:00', salida: '13:20' }, SIN_FERIADOS), 4.5);
    const feriados = new Set(['2026-10-12']);
    // Siempre desde la entrada: a las 07:40 cuenta desde las 07:40
    assert.equal(horasDeLaSalida({ fecha: '2026-10-12', entrada: '07:40', salida: '09:10' }, feriados), 1.5);
    // Sin entrada, null
    assert.equal(horasDeLaSalida({ fecha: '2026-10-12', salida: '16:46' }, feriados), null);
    assert.equal(horasDeLaSalida({ fecha: '2026-10-12', entrada: '', salida: '16:46' }, feriados), null);
    assert.equal(horasDeLaSalida({ fecha: '2026-10-12', entrada: '9:05', salida: '16:46' }, feriados), null);
    // Al revés o igual, null
    assert.equal(horasDeLaSalida({ fecha: sab, entrada: '12:00', salida: '11:00' }, SIN_FERIADOS), null);
    assert.equal(horasDeLaSalida({ fecha: sab, entrada: '12:00', salida: '12:00' }, SIN_FERIADOS), null);
    // Un feriado fijo (el 25/05), con el Set de feriadosDelRango
    assert.equal(horasDeLaSalida({ fecha: '2026-05-25', entrada: '09:00', salida: '10:00' },
      feriadosDelRango([], '2026-01-01', '2026-12-31')), 1);
    // Un feriado dado de baja (el Set sin la fecha): el día es hábil y cuenta la salida desde las 15:00
    assert.equal(horasDeLaSalida({ fecha: '2026-10-12', salida: '16:46' }, SIN_FERIADOS), 2);
  });

  it('horasDeLaSalida: sin una salida o una fecha válidas, null', () => {
    for (const salida of [undefined, null, '', '16:46:00', '9:05', '25:00', 1646]) {
      assert.equal(horasDeLaSalida({ fecha: '2026-05-04', salida }, SIN_FERIADOS), null, String(salida));
      assert.equal(horasDeLaSalida({ fecha: '2026-10-24', entrada: '09:00', salida }, SIN_FERIADOS), null, String(salida));
    }
    for (const fecha of [undefined, '', '2026-02-30', 'x']) {
      assert.equal(horasDeLaSalida({ fecha, salida: '16:46' }, SIN_FERIADOS), null, String(fecha));
    }
    assert.equal(horasDeLaSalida(null, SIN_FERIADOS), null);
    assert.equal(horasDeLaSalida('2026-05-04', SIN_FERIADOS), null);
  });

  it('horasPorMesDeSalidas: cada día en el mes de su fecha, ordenados; lo que da null no suma', () => {
    const feriados = new Set(['2026-10-12']);
    const salidas = [
      { id: 1, fecha: '2026-10-05', entrada: '08:02', salida: '16:20', nota: null }, // 1,5
      { id: 2, fecha: '2026-10-12', entrada: '09:21', salida: '12:10', nota: null }, // feriado: 2,5
      { id: 3, fecha: '2026-10-13', entrada: null, salida: '15:10', nota: null }, // 0
      { id: 4, fecha: '2026-09-30', entrada: null, salida: '19:00', nota: null }, // 4
      { id: 5, fecha: '2026-10-24', entrada: null, salida: '13:20', nota: null }, // sábado sin entrada: null
      { id: 6, fecha: '2026-08-03', entrada: null, salida: '15:05', nota: null } // 0: el mes queda, con 0
    ];
    assert.deepEqual([...horasPorMesDeSalidas(salidas, feriados)], [['2026-08', 0], ['2026-09', 4], ['2026-10', 4]]);
    // Sin el feriado, el 12/10 es hábil: 12:10 da 0
    assert.deepEqual([...horasPorMesDeSalidas(salidas, SIN_FERIADOS)], [['2026-08', 0], ['2026-09', 4], ['2026-10', 1.5]]);
    // Las filas que no sirven no suman
    assert.deepEqual([...horasPorMesDeSalidas([null, 3, {}, { fecha: '2026-02-30', salida: '19:00' },
      { fecha: '2026-11-02', salida: '19:00:00' }, { fecha: '2026-11-03', salida: '16:46' }], SIN_FERIADOS)], [['2026-11', 2]]);
    assert.deepEqual([...horasPorMesDeSalidas(null, SIN_FERIADOS)], []);
  });

  it('enDiasDeFranco: 7 horas son un día', () => {
    assert.equal(enDiasDeFranco(18.5), '2 días de franco y 4,5 horas');
    assert.equal(enDiasDeFranco(18), '2 días de franco y 4 horas');
    assert.equal(enDiasDeFranco(21), '3 días de franco');
    assert.equal(enDiasDeFranco(20.5), '2 días de franco y 6,5 horas');
    assert.equal(enDiasDeFranco(14), '2 días de franco');
    assert.equal(enDiasDeFranco(8), '1 día de franco y 1 hora');
    assert.equal(enDiasDeFranco(7), '1 día de franco');
    assert.equal(enDiasDeFranco(4.5), '4,5 horas');
    assert.equal(enDiasDeFranco(1), '1 hora');
    assert.equal(enDiasDeFranco(0.5), '0,5 horas');
    for (const nada of [0, -3, NaN, Infinity, '18.5', null, undefined, {}]) assert.equal(enDiasDeFranco(nada), '', String(nada));
  });

  it('textoDeLaSumaDelMes', () => {
    assert.equal(textoDeLaSumaDelMes('2026-10', 18.5, '2026-10-27'),
      'En noviembre vas a tener 2 días de franco y 4,5 horas a favor.');
    assert.equal(textoDeLaSumaDelMes('2026-10', 18, '2026-10-27'), 'En noviembre vas a tener 2 días de franco y 4 horas a favor.');
    assert.equal(textoDeLaSumaDelMes('2026-09', 10.5, '2026-10-27'), 'En octubre tenés 1 día de franco y 3,5 horas a favor.');
    // Solo días: sin «a favor»
    assert.equal(textoDeLaSumaDelMes('2026-12', 21, '2026-12-10'), 'En enero vas a tener 3 días de franco.');
    assert.equal(textoDeLaSumaDelMes('2026-09', 7, '2026-10-27'), 'En octubre tenés 1 día de franco.');
    // Solo horas
    assert.equal(textoDeLaSumaDelMes('2026-10', 4.5, '2026-10-27'), 'En noviembre vas a tener 4,5 horas a favor.');
    assert.equal(textoDeLaSumaDelMes('2026-10', 1, '2026-10-27'), 'En noviembre vas a tener 1 hora a favor.');
    // Sin horas: el mes es el de las horas
    assert.equal(textoDeLaSumaDelMes('2026-10', 0, '2026-10-27'), 'Todavía no sumaste horas extras en octubre.');
    assert.equal(textoDeLaSumaDelMes('2026-09', 0, '2026-10-27'), 'En septiembre no hiciste horas extras.');
    // Sin un mes o un hoy válidos, ''
    for (const raro of [undefined, null, '', '2026-13', '2026-1', '2026-10-01', 202610]) {
      assert.equal(textoDeLaSumaDelMes(raro, 4, '2026-10-27'), '', String(raro));
    }
    for (const raro of [undefined, null, '', '2026-10', '2026-02-30', 20261027]) {
      assert.equal(textoDeLaSumaDelMes('2026-10', 4, raro), '', String(raro));
    }
  });

  it('mesDeLaPlanilla: sin mes, el de hoy; uno del primero del rango al de hoy, ese; lo demás, null', () => {
    const hoy = '2026-10-27';
    // Sin valor, el mes de hoy
    for (const sinValor of [undefined, null, '']) assert.equal(mesDeLaPlanilla(sinValor, hoy), '2026-10', String(sinValor));
    // Del primer mes de rangoDeFechas (enero de hace dos años) al de hoy
    assert.equal(mesDeLaPlanilla('2026-10', hoy), '2026-10');
    assert.equal(mesDeLaPlanilla('2026-09', hoy), '2026-09');
    assert.equal(mesDeLaPlanilla('2024-01', hoy), '2024-01');
    assert.equal(rangoDeFechas(hoy).desde.slice(0, 7), '2024-01');
    // El mes que viene, el anterior al rango y uno de hace tres años
    assert.equal(mesDeLaPlanilla('2026-11', hoy), null);
    assert.equal(mesDeLaPlanilla('2023-12', hoy), null);
    assert.equal(mesDeLaPlanilla('2023-10', hoy), null);
    // Lo que no es un mes 'AAAA-MM' (también una lista: el parámetro repetido, como lo da Express)
    for (const raro of ['2026-13', '2026-00', '2026-1', '2026-10-01', ' 2026-10', '2026-10 ', ['2026-10'], 202610, {}, true,
      'x']) {
      assert.equal(mesDeLaPlanilla(raro, hoy), null, JSON.stringify(raro));
    }
    // Sin un hoy válido, null (también sin mes)
    for (const raro of [undefined, null, '', '2026-10', '2026-02-30']) {
      assert.equal(mesDeLaPlanilla('2026-10', raro), null, String(raro));
      assert.equal(mesDeLaPlanilla(undefined, raro), null, String(raro));
    }
    // El 1/1, el mes en curso es enero y el rango arranca dos años antes
    assert.equal(mesDeLaPlanilla(undefined, '2027-01-01'), '2027-01');
    assert.equal(mesDeLaPlanilla('2025-01', '2027-01-01'), '2025-01');
    assert.equal(mesDeLaPlanilla('2024-12', '2027-01-01'), null);
  });

  it('licenciaDeDiaEnteroEn: una licencia de día entero de la modalidad, en un día hábil', () => {
    const feriados = new Set(['2026-10-12']);
    const vacaciones = { id: 1, tipo: 'vacaciones', desde: '2026-10-09', hasta: '2026-10-13', horas: null };
    const estado = {
      modalidad: 'contrato',
      licencias: [
        vacaciones,
        { id: 2, tipo: 'horas_a_favor', desde: '2026-10-22', hasta: '2026-10-22', horas: 7 },
        { id: 3, tipo: 'horas_a_favor', desde: '2026-10-23', hasta: '2026-10-23', horas: 2 },
        { id: 4, tipo: 'franco', desde: '2026-10-21', hasta: '2026-10-21', horas: null },
        { id: 5, tipo: 'uso_autorizado', desde: '2026-10-20', hasta: '2026-10-20', horas: '7.0' }
      ]
    };
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-09', feriados), vacaciones);
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-13', feriados), vacaciones);
    // El sábado y el domingo de las vacaciones, y el feriado del medio, no son días de licencia
    for (const fecha of ['2026-10-10', '2026-10-11', '2026-10-12']) assert.equal(licenciaDeDiaEnteroEn(estado, fecha, feriados), null);
    // Sin el feriado, el 12/10 sí
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-12', SIN_FERIADOS), vacaciones);
    // Las horas a favor de 7 horas son el día entero (también con las horas como texto, el DECIMAL de la base); las de 2, no
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-22', feriados).id, 2);
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-20', feriados).id, 5);
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-23', feriados), null);
    // Un franco no es de contrato (fueraDeLaModalidad); en planta, sí
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-21', feriados), null);
    assert.equal(licenciaDeDiaEnteroEn({ ...estado, modalidad: 'planta' }, '2026-10-21', feriados).id, 4);
    // Fuera de las fechas, nada
    assert.equal(licenciaDeDiaEnteroEn(estado, '2026-10-14', feriados), null);
    // Una licencia anterior al arranque también es un día de licencia (los estudios del 13/10 de CONTRATO)
    assert.equal(licenciaDeDiaEnteroEn(CONTRATO.estado, '2026-10-14', SIN_FERIADOS).tipo, 'estudios');
    assert.equal(licenciaDeDiaEnteroEn(CONTRATO.estado, '2026-10-09', SIN_FERIADOS).id, 1);
    assert.equal(licenciaDeDiaEnteroEn(CONTRATO.estado, '2026-10-20', SIN_FERIADOS), null);
    // Sin un estado o una fecha válidos, null
    for (const raro of [undefined, null, '', 'x', 3, {}, []]) {
      assert.equal(licenciaDeDiaEnteroEn(raro, '2026-10-09', feriados), null, String(raro));
      assert.equal(licenciaDeDiaEnteroEn(estado, raro, feriados), null, String(raro));
    }
  });

  describe('validarSalida', () => {
    // Hoy es el martes 27/10/2026. El 12/10 es feriado; el 24/10 y el 25/10, sábado y domingo
    const HOY_SALIDAS = '2026-10-27';
    const FERIADOS = new Set(['2026-10-12']);
    const ESTADO = {
      modalidad: 'contrato',
      arranque: '2026-10-26',
      licencias: [
        { id: 1, tipo: 'vacaciones', desde: '2026-10-16', hasta: '2026-10-19', horas: null },
        { id: 2, tipo: 'horas_a_favor', desde: '2026-10-22', hasta: '2026-10-22', horas: 7 },
        { id: 3, tipo: 'horas_a_favor', desde: '2026-10-23', hasta: '2026-10-23', horas: 2 },
        { id: 4, tipo: 'franco', desde: '2026-10-21', hasta: '2026-10-21', horas: null }
      ],
      salidas: []
    };
    const validar = (dia, contexto = {}) => validarSalida(dia, { hoy: HOY_SALIDAS, estado: ESTADO, feriados: FERIADOS, ...contexto });
    const errorDe = (dia, contexto) => validar(dia, contexto).error;
    const error = (campo, mensaje) => ({ campo, mensaje });

    it('un día correcto: los datos, con la nota recortada y borrar en false', () => {
      assert.deepEqual(validar({ fecha: '2026-10-26', entrada: '08:02', salida: '16:20', nota: '  Cierre de mes  ' }), {
        datos: { fecha: '2026-10-26', entrada: '08:02', salida: '16:20', nota: 'Cierre de mes', al_mes_anterior: null, borrar: false },
        error: null
      });
      // La entrada y la nota vacías son null
      for (const vacia of [undefined, null, '', '   ']) {
        assert.deepEqual(validar({ fecha: '2026-10-26', entrada: vacia, salida: '16:20', nota: vacia }).datos,
          { fecha: '2026-10-26', entrada: null, salida: '16:20', nota: null, al_mes_anterior: null, borrar: false }, String(vacia));
      }
      // Hoy se carga; una salida antes de las 15:00 también (da 0)
      assert.equal(errorDe({ fecha: HOY_SALIDAS, salida: '16:46' }), null);
      assert.equal(errorDe({ fecha: '2026-10-26', salida: '13:02' }), null);
      // Un feriado y un sábado con entrada
      assert.deepEqual(validar({ fecha: '2026-10-12', entrada: '09:21', salida: '12:10' }).datos,
        { fecha: '2026-10-12', entrada: '09:21', salida: '12:10', nota: null, al_mes_anterior: null, borrar: false });
      assert.equal(errorDe({ fecha: '2026-10-24', entrada: '09:00', salida: '13:20' }), null);
    });

    it('primero, el formato de la fecha', () => {
      for (const mala of [undefined, null, '', '2026-02-30', '27/10/2026', 20261027]) {
        assert.deepEqual(validar({ fecha: mala, salida: '16:46' }), { datos: null, error: error('fecha', MENSAJES_MI_ESPACIO.fecha) },
          String(mala));
        // También vacío: sin una fecha no hay qué borrar
        assert.deepEqual(errorDe({ fecha: mala }), error('fecha', MENSAJES_MI_ESPACIO.fecha), String(mala));
      }
      assert.deepEqual(validarSalida(null, null), { datos: null, error: error('fecha', MENSAJES_MI_ESPACIO.fecha) });
    });

    it('un día vacío es un borrado y pasa siempre: un día que no llegó, de licencia o fuera del rango', () => {
      const borrado = (fecha) => ({
        datos: { fecha, entrada: null, salida: null, nota: null, al_mes_anterior: false, borrar: true }, error: null
      });
      assert.deepEqual(validar({ fecha: '2026-10-26' }), borrado('2026-10-26'));
      assert.deepEqual(validar({ fecha: '2026-10-28', entrada: '', salida: null, nota: '   ' }), borrado('2026-10-28'));
      assert.deepEqual(validar({ fecha: '2026-10-19', entrada: null, salida: '', nota: '' }), borrado('2026-10-19'));
      assert.deepEqual(validar({ fecha: '2023-12-31' }), borrado('2023-12-31'));
      // Aunque hoy no sirva
      assert.deepEqual(validar({ fecha: '2026-10-26' }, { hoy: null }), borrado('2026-10-26'));
    });

    it('1. la fecha: del 01/01 de dos años antes a hoy', () => {
      assert.deepEqual(errorDe({ fecha: '2026-10-28', salida: '16:46' }), error('fecha', MENSAJES_MI_ESPACIO.diaQueNoLlego));
      assert.deepEqual(errorDe({ fecha: '2028-01-01', salida: '16:46' }), error('fecha', MENSAJES_MI_ESPACIO.diaQueNoLlego));
      assert.deepEqual(errorDe({ fecha: '2023-12-31', salida: '16:46' }), error('fecha', textoRango('2024-01-01', '2026-10-27')));
      assert.equal(errorDe({ fecha: '2024-01-02', salida: '16:46' }), null);
      // Sin un hoy válido no pasa ninguna fecha
      assert.deepEqual(errorDe({ fecha: '2026-10-26', salida: '16:46' }, { hoy: null }), error('fecha', MENSAJES_MI_ESPACIO.fecha));
    });

    it('2. la fecha: un día de licencia de día entero no carga horas', () => {
      const deLicencia = error('fecha', MENSAJES_MI_ESPACIO.diaDeLicencia);
      assert.deepEqual(errorDe({ fecha: '2026-10-16', salida: '16:46' }), deLicencia);
      assert.deepEqual(errorDe({ fecha: '2026-10-19', entrada: '08:00', salida: '16:46', nota: 'x' }), deLicencia);
      // Las horas a favor de 7 horas son el día entero; las de 2, no
      assert.deepEqual(errorDe({ fecha: '2026-10-22', salida: '16:46' }), deLicencia);
      assert.equal(errorDe({ fecha: '2026-10-23', salida: '16:46' }), null);
      // El sábado de las vacaciones no es de licencia: se carga como un sábado
      assert.equal(errorDe({ fecha: '2026-10-17', entrada: '09:00', salida: '12:00' }), null);
      // Un franco no es de contrato: no cuenta
      assert.equal(errorDe({ fecha: '2026-10-21', salida: '16:46' }), null);
    });

    it('3. las horas: HH:MM, en su campo', () => {
      for (const mala of ['16:46:00', '9:05', '25:00', '24:00', '16:60', ' 16:46', 1646, {}]) {
        assert.deepEqual(errorDe({ fecha: '2026-10-26', salida: mala }), error('salida', MENSAJES_MI_ESPACIO.horaSalida),
          String(mala));
        assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: mala, salida: '16:46' }),
          error('entrada', MENSAJES_MI_ESPACIO.horaSalida), String(mala));
      }
      // La entrada primero
      assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: '9:05', salida: '25:00' }),
        error('entrada', MENSAJES_MI_ESPACIO.horaSalida));
    });

    it('4. la salida: obligatoria si hay entrada o nota', () => {
      const queCuenta = error('salida', MENSAJES_MI_ESPACIO.salidaQueCuenta);
      const falta = error('salida', MENSAJES_MI_ESPACIO.salidaFalta);
      assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: '08:00' }), queCuenta);
      assert.deepEqual(errorDe({ fecha: '2026-10-26', nota: 'Cierre de mes' }), queCuenta);
      assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: '08:00', salida: '  ' }), queCuenta);
      assert.deepEqual(errorDe({ fecha: '2026-10-12', entrada: '09:00' }), falta);
      assert.deepEqual(errorDe({ fecha: '2026-10-24', nota: 'Mudanza' }), falta);
    });

    it('5. la entrada: obligatoria en un día que no es hábil', () => {
      assert.deepEqual(errorDe({ fecha: '2026-10-12', salida: '12:10' }), error('entrada', MENSAJES_MI_ESPACIO.entradaFeriado));
      assert.deepEqual(errorDe({ fecha: '2026-10-24', salida: '12:10' }), error('entrada', MENSAJES_MI_ESPACIO.entradaFinde));
      assert.deepEqual(errorDe({ fecha: '2026-10-25', salida: '12:10' }), error('entrada', MENSAJES_MI_ESPACIO.entradaFinde));
      // Un feriado fijo (el 09/07), con el Set de feriadosDelRango
      assert.deepEqual(errorDe({ fecha: '2026-07-09', salida: '12:10' },
        { feriados: feriadosDelRango([], '2026-01-01', '2026-12-31') }), error('entrada', MENSAJES_MI_ESPACIO.entradaFeriado));
      // Un sábado que además es feriado es un feriado
      assert.deepEqual(errorDe({ fecha: '2026-10-24', salida: '12:10' }, { feriados: new Set(['2026-10-24']) }),
        error('entrada', MENSAJES_MI_ESPACIO.entradaFeriado));
      // En un día hábil, no
      assert.equal(errorDe({ fecha: '2026-10-26', salida: '16:46' }), null);
    });

    it('6. la salida: después de la entrada, también en un día hábil', () => {
      const antes = error('salida', MENSAJES_MI_ESPACIO.salidaAntes);
      assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: '16:00', salida: '15:59' }), antes);
      assert.deepEqual(errorDe({ fecha: '2026-10-26', entrada: '16:00', salida: '16:00' }), antes);
      assert.deepEqual(errorDe({ fecha: '2026-10-24', entrada: '12:00', salida: '11:00' }), antes);
      assert.deepEqual(errorDe({ fecha: '2026-10-12', entrada: '12:00', salida: '12:00' }), antes);
    });

    it('7. la nota: recortada, de hasta 200 caracteres contados con Array.from', () => {
      assert.deepEqual(errorDe({ fecha: '2026-10-26', salida: '16:46', nota: 'x'.repeat(201) }),
        error('nota', MENSAJES_MI_ESPACIO.nota));
      assert.equal(validar({ fecha: '2026-10-26', salida: '16:46', nota: '\u{1F600}'.repeat(200) }).datos.nota,
        '\u{1F600}'.repeat(200));
      assert.equal(validar({ fecha: '2026-10-26', salida: '16:46', nota: `  ${'x'.repeat(200)}  ` }).datos.nota, 'x'.repeat(200));
    });

    it('el orden: la fecha, la licencia, las horas, la salida que falta, la entrada que falta, el orden y la nota', () => {
      const nota = 'x'.repeat(201);
      assert.equal(errorDe({ fecha: '2026-10-28', entrada: '9:05', nota }).mensaje, MENSAJES_MI_ESPACIO.diaQueNoLlego);
      assert.equal(errorDe({ fecha: '2026-10-19', entrada: '9:05', nota }).mensaje, MENSAJES_MI_ESPACIO.diaDeLicencia);
      assert.equal(errorDe({ fecha: '2026-10-24', entrada: '9:05', salida: '25:00', nota }).campo, 'entrada');
      assert.deepEqual(errorDe({ fecha: '2026-10-24', salida: '25:00', nota }), error('salida', MENSAJES_MI_ESPACIO.horaSalida));
      assert.deepEqual(errorDe({ fecha: '2026-10-24', nota }), error('salida', MENSAJES_MI_ESPACIO.salidaFalta));
      assert.deepEqual(errorDe({ fecha: '2026-10-24', salida: '11:00', nota }), error('entrada', MENSAJES_MI_ESPACIO.entradaFinde));
      assert.deepEqual(errorDe({ fecha: '2026-10-24', entrada: '12:00', salida: '11:00', nota }),
        error('salida', MENSAJES_MI_ESPACIO.salidaAntes));
      assert.deepEqual(errorDe({ fecha: '2026-10-24', entrada: '10:00', salida: '11:00', nota }),
        error('nota', MENSAJES_MI_ESPACIO.nota));
    });
  });

  it('nada tira', () => {
    const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z'), Object.create(null),
      Symbol('x')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        horaSalidaValida(valor);
        tipoDeDia(valor, valor);
        tipoDeDia('2026-10-26', valor);
        horasDeLaSalida(valor, valor);
        horasDeLaSalida({ fecha: valor, entrada: valor, salida: valor }, valor);
        horasDeLaSalida({ fecha: '2026-10-24', entrada: valor, salida: '12:00' }, valor);
        horasPorMesDeSalidas(valor, valor);
        horasPorMesDeSalidas([valor, { fecha: '2026-10-26', salida: valor }], valor);
        enDiasDeFranco(valor);
        textoDeLaSumaDelMes(valor, valor, valor);
        textoDeLaSumaDelMes('2026-10', valor, '2026-10-27');
        mesDeLaPlanilla(valor, valor);
        mesDeLaPlanilla(valor, '2026-10-27');
        licenciaDeDiaEnteroEn(valor, valor, valor);
        licenciaDeDiaEnteroEn({ modalidad: valor, licencias: [valor, { tipo: 'vacaciones', desde: valor, hasta: valor }] },
          '2026-10-26', valor);
        validarSalida(valor, valor);
        validarSalida({ fecha: '2026-10-26', entrada: valor, salida: valor, nota: valor }, valor);
        validarSalida({ fecha: '2026-10-26', entrada: valor, salida: '16:46', nota: valor },
          { hoy: '2026-10-27', estado: valor, feriados: valor });
        validarSalida({ fecha: '2026-10-26', salida: '16:46' },
          { hoy: '2026-10-27', estado: { modalidad: 'contrato', licencias: [valor, { tipo: valor, desde: valor }] } });
      }, typeof valor);
    }
    assert.deepEqual([...horasPorMesDeSalidas(undefined)], []);
  });
});

// Sumar las horas de un día al mes anterior (spec 2026-10-30-mi-espacio-horas-mes-anterior, secciones 3 y 4): un día de la
// planilla con `al_mes_anterior` suma sus horas al mes anterior al de su fecha. Los datos son inventados, los de la maqueta:
// enero de 2027 suma 5,5 h; el martes 02/02 sale a las 16:20 (1,5 h) y suma a enero; el miércoles 03/02 sale a las 15:50 (1 h)
describe('sumar al mes anterior', () => {
  const FERIADOS = new Set();
  const ENERO = [
    { id: 1, fecha: '2027-01-05', entrada: null, salida: '17:30', nota: null }, // 2,5
    { id: 2, fecha: '2027-01-12', entrada: null, salida: '18:00', nota: null } // 3
  ];
  const DEL_02 = { id: 3, fecha: '2027-02-02', entrada: null, salida: '16:20', nota: null, al_mes_anterior: true }; // 1,5
  const DEL_03 = { id: 4, fecha: '2027-02-03', entrada: null, salida: '15:50', nota: null }; // 1
  // Desordenadas: las listas del reparto van por fecha
  const SALIDAS = [DEL_03, ...ENERO, DEL_02];
  // Hoy es el miércoles 03/02/2027
  const CONTEXTO = { hoy: '2027-02-03', estado: { modalidad: 'contrato', licencias: [], salidas: [] }, feriados: FERIADOS };

  it('mesDeLaSalida: el mes de su fecha o, tildada (solo el true literal), el anterior', () => {
    assert.equal(mesDeLaSalida({ fecha: '2027-02-02', al_mes_anterior: true }), '2027-01');
    for (const marca of [false, undefined, 'true', 1, null]) {
      assert.equal(mesDeLaSalida({ fecha: '2027-02-02', al_mes_anterior: marca }), '2027-02', String(marca));
    }
    assert.equal(mesDeLaSalida({ fecha: '2027-02-02' }), '2027-02');
    // Enero suma a diciembre del año anterior
    assert.equal(mesDeLaSalida({ fecha: '2027-01-05', al_mes_anterior: true }), '2026-12');
    // Sin una fecha válida, null
    for (const fila of [{ fecha: 'x' }, { fecha: '2027-02-30', al_mes_anterior: true }, {}, null, '2027-02-02', []]) {
      assert.equal(mesDeLaSalida(fila), null, JSON.stringify(fila));
    }
  });

  it('horasPorMesDeSalidas: un día tildado suma al mes anterior', () => {
    assert.deepEqual([...horasPorMesDeSalidas(SALIDAS, FERIADOS)], [['2027-01', 7], ['2027-02', 1]]);
    // Sin el tilde, cada día en su mes
    const sinTilde = SALIDAS.map((fila) => ({ ...fila, al_mes_anterior: false }));
    assert.deepEqual([...horasPorMesDeSalidas(sinTilde, FERIADOS)], [['2027-01', 5.5], ['2027-02', 2.5]]);
  });

  it('no se cuentan dos veces: la suma de los meses es la de las horas de cada día', () => {
    const todasTildadas = SALIDAS.map((fila) => ({ ...fila, al_mes_anterior: true }));
    assert.deepEqual([...horasPorMesDeSalidas(todasTildadas, FERIADOS)], [['2026-12', 5.5], ['2027-01', 2.5]]);
    for (const salidas of [SALIDAS, todasTildadas]) {
      const delMapa = [...horasPorMesDeSalidas(salidas, FERIADOS).values()].reduce((suma, horas) => suma + horas, 0);
      const deLosDias = salidas.reduce((suma, fila) => suma + horasDeLaSalida(fila, FERIADOS), 0);
      assert.equal(delMapa, deLosDias);
      assert.equal(delMapa, 8);
    }
  });

  it('repartoDelMes: lo propio sin los tildados, lo que entra del mes siguiente y lo que se va', () => {
    assert.deepEqual(repartoDelMes(SALIDAS, '2027-01', FERIADOS),
      { propias: 5.5, entran: [{ fecha: '2027-02-02', horas: 1.5, fila: DEL_02 }], van: [] });
    assert.deepEqual(repartoDelMes(SALIDAS, '2027-02', FERIADOS),
      { propias: 1, entran: [], van: [{ fecha: '2027-02-02', horas: 1.5, fila: DEL_02 }] });
    // Un tildado sin horas (un sábado sin entrada) va en las listas con null y no suma
    const sabado = { id: 5, fecha: '2027-02-06', entrada: null, salida: '13:00', nota: null, al_mes_anterior: true };
    const otroTildado = { id: 6, fecha: '2027-02-04', entrada: null, salida: '17:00', nota: null, al_mes_anterior: true }; // 2
    const conMas = [sabado, ...SALIDAS, otroTildado];
    assert.deepEqual(repartoDelMes(conMas, '2027-01', FERIADOS), {
      propias: 5.5,
      entran: [{ fecha: '2027-02-02', horas: 1.5, fila: DEL_02 }, { fecha: '2027-02-04', horas: 2, fila: otroTildado },
        { fecha: '2027-02-06', horas: null, fila: sabado }],
      van: []
    });
    assert.deepEqual(repartoDelMes(conMas, '2027-02', FERIADOS).van.map(({ fecha }) => fecha),
      ['2027-02-02', '2027-02-04', '2027-02-06']);
    // Lo propio y lo que entra es lo que da horasPorMesDeSalidas
    for (const salidas of [SALIDAS, conMas, SALIDAS.map((fila) => ({ ...fila, al_mes_anterior: true }))]) {
      const porMes = horasPorMesDeSalidas(salidas, FERIADOS);
      for (const mes of ['2026-12', '2027-01', '2027-02', '2027-03']) {
        const { propias, entran } = repartoDelMes(salidas, mes, FERIADOS);
        assert.equal(propias + entran.reduce((suma, { horas }) => suma + (horas ?? 0), 0), porMes.get(mes) ?? 0, mes);
      }
    }
    // Con un mes que no sirve, nada
    for (const mes of [undefined, null, '', '2027-13', '2027-02-02', 202702]) {
      assert.deepEqual(repartoDelMes(SALIDAS, mes, FERIADOS), { propias: 0, entran: [], van: [] }, String(mes));
    }
    assert.deepEqual(repartoDelMes(null, '2027-01', FERIADOS), { propias: 0, entran: [], van: [] });
  });

  it('textoDeLoQueSeMueve: lo que entra del mes siguiente y lo que se va al anterior', () => {
    const enero = repartoDelMes(SALIDAS, '2027-01', FERIADOS);
    const febrero = repartoDelMes(SALIDAS, '2027-02', FERIADOS);
    assert.equal(textoDeLoQueSeMueve('2027-01', enero.entran, enero.van), 'Incluye 1,5 h de febrero.');
    assert.equal(textoDeLoQueSeMueve('2027-02', febrero.entran, febrero.van), '1,5 h del martes 02/02 suman a enero.');
    // Con 1 h, «suma»
    assert.equal(textoDeLoQueSeMueve('2027-02', [], [{ fecha: '2027-02-02', horas: 1 }]), '1 h del martes 02/02 suma a enero.');
    // Dos días y tres o más
    assert.equal(textoDeLoQueSeMueve('2027-02', [], [{ fecha: '2027-02-02', horas: 1.5 }, { fecha: '2027-02-04', horas: 2 }]),
      '3,5 h del martes 02/02 y del jueves 04/02 suman a enero.');
    assert.equal(textoDeLoQueSeMueve('2027-02', [],
      [{ fecha: '2027-02-02', horas: 1.5 }, { fecha: '2027-02-03', horas: 1 }, { fecha: '2027-02-04', horas: 1.5 }]),
    '4 h de 3 días suman a enero.');
    // Un mes que recibe y da: las dos frases, separadas por un espacio
    assert.equal(textoDeLoQueSeMueve('2027-02', [{ fecha: '2027-03-02', horas: 2 }], [{ fecha: '2027-02-02', horas: 1.5 }]),
      'Incluye 2 h de marzo. 1,5 h del martes 02/02 suman a enero.');
    // Diciembre recibe de enero y enero da a diciembre
    assert.equal(textoDeLoQueSeMueve('2026-12', [{ fecha: '2027-01-05', horas: 2.5 }], []), 'Incluye 2,5 h de enero.');
    assert.equal(textoDeLoQueSeMueve('2027-01', [], [{ fecha: '2027-01-05', horas: 2.5 }]), '2,5 h del martes 05/01 suman a diciembre.');
    // Un tildado con 0 h (o sin horas) no cuenta
    assert.equal(textoDeLoQueSeMueve('2027-02', [{ fecha: '2027-03-02', horas: 0 }], [{ fecha: '2027-02-02', horas: 0 }]), '');
    assert.equal(textoDeLoQueSeMueve('2027-02', [], [{ fecha: '2027-02-02', horas: 0 }, { fecha: '2027-02-03', horas: 1 }]),
      '1 h del miércoles 03/02 suma a enero.');
    assert.equal(textoDeLoQueSeMueve('2027-02', [{ fecha: '2027-03-06', horas: null }], [{ fecha: '2027-02-06', horas: null }]), '');
    // Sin nada, ''
    assert.equal(textoDeLoQueSeMueve('2027-02', [], []), '');
    assert.equal(textoDeLoQueSeMueve('2027-02', null, undefined), '');
    // Con un mes que no sirve, ''
    assert.equal(textoDeLoQueSeMueve('2027-13', [{ fecha: '2027-03-02', horas: 2 }], [{ fecha: '2027-02-02', horas: 1.5 }]), '');
  });

  it('textoDeLaSumaDelMes: el verbo mira el mes en que se usan las horas', () => {
    // El mes de uso es el de hoy: «tenés»
    assert.equal(textoDeLaSumaDelMes('2027-01', 7, '2027-02-03'), 'En febrero tenés 1 día de franco.');
    // Ya pasó: «tuviste»
    assert.equal(textoDeLaSumaDelMes('2027-01', 7, '2027-03-01'), 'En febrero tuviste 1 día de franco.');
    // Todavía no llegó: «vas a tener»
    assert.equal(textoDeLaSumaDelMes('2027-02', 1, '2027-02-03'), 'En marzo vas a tener 1 hora a favor.');
    // Sin horas, como antes: mira el mes de las horas
    assert.equal(textoDeLaSumaDelMes('2027-01', 0, '2027-02-03'), 'En enero no hiciste horas extras.');
    assert.equal(textoDeLaSumaDelMes('2027-02', 0, '2027-02-03'), 'Todavía no sumaste horas extras en febrero.');
  });

  describe('validarSalida', () => {
    const validar = (dia) => validarSalida(dia, CONTEXTO);

    it('el tilde: true o false literal, ese; sin la clave, null (se conserva lo guardado)', () => {
      assert.equal(validar({ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: true }).datos.al_mes_anterior, true);
      assert.equal(validar({ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: false }).datos.al_mes_anterior, false);
      assert.equal(validar({ fecha: '2027-02-02', salida: '16:20' }).datos.al_mes_anterior, null);
      assert.equal(validar({ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: undefined }).datos.al_mes_anterior, null);
      assert.deepEqual(validar({ fecha: '2027-02-02', entrada: '08:00', salida: '16:20', nota: 'Cierre', al_mes_anterior: true }), {
        datos: { fecha: '2027-02-02', entrada: '08:00', salida: '16:20', nota: 'Cierre', al_mes_anterior: true, borrar: false },
        error: null
      });
    });

    it('un borrado deja el tilde en false', () => {
      assert.deepEqual(validar({ fecha: '2027-02-02', al_mes_anterior: true }), {
        datos: { fecha: '2027-02-02', entrada: null, salida: null, nota: null, al_mes_anterior: false, borrar: true }, error: null
      });
      assert.equal(validar({ fecha: '2027-02-02', al_mes_anterior: 'si' }).datos.al_mes_anterior, false);
    });

    it('otro valor da el error del tilde, que va al final', () => {
      const delTilde = { campo: 'al_mes_anterior', mensaje: 'Elegí si este día suma al mes anterior.' };
      assert.equal(MENSAJES_MI_ESPACIO.alMesAnterior, 'Elegí si este día suma al mes anterior.');
      for (const valor of ['si', 'true', 1, 0, null, {}, []]) {
        assert.deepEqual(validar({ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: valor }),
          { datos: null, error: delTilde }, JSON.stringify(valor));
      }
      // Con la salida mal, el de la salida; con la nota larga, el de la nota
      assert.deepEqual(validar({ fecha: '2027-02-02', salida: '25:00', al_mes_anterior: 'si' }).error,
        { campo: 'salida', mensaje: MENSAJES_MI_ESPACIO.horaSalida });
      assert.deepEqual(validar({ fecha: '2027-02-02', salida: '16:20', nota: 'x'.repeat(201), al_mes_anterior: 'si' }).error,
        { campo: 'nota', mensaje: MENSAJES_MI_ESPACIO.nota });
      assert.deepEqual(validar({ fecha: '2027-02-04', salida: '16:20', al_mes_anterior: 'si' }).error,
        { campo: 'fecha', mensaje: MENSAJES_MI_ESPACIO.diaQueNoLlego });
    });
  });

  it('nada tira', () => {
    const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], Object.create(null), Symbol('x')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        mesDeLaSalida(valor);
        mesDeLaSalida({ fecha: valor, al_mes_anterior: valor });
        repartoDelMes(valor, valor, valor);
        repartoDelMes([valor, { fecha: '2027-02-02', salida: valor, al_mes_anterior: valor }], '2027-01', valor);
        textoDeLoQueSeMueve(valor, valor, valor);
        textoDeLoQueSeMueve('2027-02', [valor, { fecha: valor, horas: valor }], [valor, { fecha: valor, horas: valor }]);
        validarSalida({ fecha: '2027-02-02', salida: '16:20', al_mes_anterior: valor }, CONTEXTO);
      }, typeof valor);
    }
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

  it('no miran las salidas de la planilla de contrato: planta sigue con sus horas extras', () => {
    // Con salidas y sin horas extras, ningún franco
    assert.deepEqual(francosDe({ ...conHoras('planta', []), salidas: SALIDAS_DEL_USUARIO }, A_HOY), []);
    // Con sus horas extras, las salidas no suman nada
    assert.deepEqual(francosDe({ ...PLANTA.estado, salidas: SALIDAS_DEL_USUARIO }, A_HOY), francosDe(PLANTA.estado, A_HOY));
  });
});

describe('las horas a favor (contrato)', () => {
  it('los ejemplos del usuario', () => {
    const usos = [uso(100, 'horas_a_favor', '2026-11-03', 7), uso(101, 'horas_a_favor', '2026-11-10', 2),
      uso(102, 'horas_a_favor', '2026-11-17', 1.5)];
    const horas = horasAFavorDe(conSalidas(SALIDAS_DEL_USUARIO, usos), A_HOY);
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
      ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, salida(100, '2026-08-20', '18:00')]
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

  it('salen de las salidas (spec 2026-10-27-mi-espacio-horas): octubre, con un feriado, da 5 horas a favor en noviembre', () => {
    const feriados = new Set(['2026-10-12', '2026-10-16']);
    const salidas = [
      salida(100, '2026-10-05', '16:20', '08:02'), // hábil: 1,5 (la entrada no cuenta)
      salida(101, '2026-10-07', '15:46'), // hábil: 1
      salida(102, '2026-10-12', '12:10', '09:21') // feriado: de la entrada a la salida, 169 minutos, 2,5
    ];
    const octubre = (estado, opciones = { hoy: HOY, feriados }) => delMes(horasAFavorDe(estado, opciones), '2026-10');
    assert.deepEqual(octubre(conSalidas(salidas)), {
      mes_trabajado: '2026-10', horas: 5, mes_de_uso: '2026-11', a_favor: 5, usos: [], usadas: 0, disponibles: 5,
      no_utilizadas: 0, antes_del_arranque: false, ultimo_dia_habil: '2026-11-30', termino: false
    });
    // Un feriado sin entrada no suma (no se puede contar: lo dice su aviso)
    assert.equal(octubre(conSalidas([...salidas, salida(103, '2026-10-16', '19:00')])).a_favor, 5);
    // Una salida en un día de vacaciones sí suma (sigue sumando hasta que se la quita: lo dice su aviso)
    const enVacaciones = conSalidas([...salidas, salida(104, '2026-10-08', '19:00')],
      [vacaciones(200, '2026-10-08', '2026-10-08')]);
    assert.equal(octubre(enVacaciones).a_favor, 9);
    // Sin los feriados (dados de baja), el 12/10 es hábil y cuenta la salida desde las 15:00: 12:10 da 0
    assert.equal(octubre(conSalidas(salidas), A_HOY).a_favor, 2.5);
  });

  it('los ejemplos del usuario en salidas dan lo mismo que en horas extras; las horas extras de planta no cuentan', () => {
    // Los mismos totales por mes, también en el caso CONTRATO (contra las horas extras que tenía antes de la planilla)
    assert.deepEqual([...horasPorMesDeSalidas(SALIDAS_DEL_USUARIO, SIN_FERIADOS)], [...horasPorMes(EJEMPLOS_DEL_USUARIO)]);
    assert.deepEqual([...horasPorMesDeSalidas(CONTRATO.estado.salidas, SIN_FERIADOS)],
      [...horasPorMes(HORAS_EXTRAS_DE_CONTRATO)]);
    // Desde la planilla, el caso CONTRATO tiene solo sus salidas
    assert.ok(!('horasExtras' in CONTRATO.estado));
    const usos = [uso(100, 'horas_a_favor', '2026-11-03', 7), uso(101, 'horas_a_favor', '2026-11-10', 2)];
    assert.deepEqual(horasAFavorDe(conSalidas(SALIDAS_DEL_USUARIO, usos), A_HOY).map(({ mes_trabajado, a_favor, usadas }) =>
      [mes_trabajado, a_favor, usadas]), [['2026-10', 10.5, 9], ['2026-11', 7.5, 0], ['2026-12', 6.5, 0]]);
    // En contrato, unas horas extras de la tabla de planta (de cuando era de planta) no son horas a favor
    assert.deepEqual(horasAFavorDe(conHoras('contrato', EJEMPLOS_DEL_USUARIO), A_HOY), []);
    // Un estado sin la clave cuenta como sin salidas
    const { salidas: _sinSalidas, ...sinLaClave } = conSalidas(SALIDAS_DEL_USUARIO);
    assert.deepEqual(horasAFavorDe(sinLaClave, A_HOY), []);
  });

  it('un mes cuyas salidas suman 0 no deja fila; con un uso en su mes de uso, sí, con 0 a favor (Ruling 5)', () => {
    // Septiembre: salidas antes de las 15:16, que dan 0
    const septiembre = conSalidas([salida(100, '2026-09-08', '15:10'), salida(101, '2026-09-09', '15:15')]);
    assert.deepEqual(horasAFavorDe(septiembre, A_HOY), []);
    const conUso = conSalidas(septiembre.salidas, [uso(200, 'horas_a_favor', '2026-10-27', 1)]);
    assert.deepEqual(horasAFavorDe(conUso, A_HOY), [{
      mes_trabajado: '2026-09', horas: 0, mes_de_uso: '2026-10', a_favor: 0, usos: [{ id: 200, fecha: '2026-10-27', horas: 1 }],
      usadas: 1, disponibles: 0, no_utilizadas: 0, antes_del_arranque: false, ultimo_dia_habil: '2026-10-30', termino: false
    }]);
  });
});

// Las salidas guardadas que dejaron de cerrar porque cambió algo después (spec 2026-10-27-mi-espacio-horas, sección 7):
// avisos que nunca frenan una carga. El lunes 12/10/2026 pasó a ser feriado; el viernes 09/10 tiene unas vacaciones
describe('los avisos de las salidas', () => {
  const FERIADOS = new Set(['2026-10-12']);
  const SALIDAS = [
    salida(100, '2026-10-12', '19:00'), // pasó a ser feriado y no tiene entrada: no suma
    salida(101, '2026-10-09', '19:00'), // con vacaciones cargadas después: sigue sumando
    salida(102, '2026-10-24', '13:00'), // sábado sin entrada (cargada por fuera de la planilla)
    salida(103, '2026-10-25', '13:00', '09:00'), // domingo con entrada: bien
    salida(104, '2026-10-21', '19:00') // hábil: bien
  ];
  const ESTADO = conSalidas(SALIDAS, [vacaciones(200, '2026-10-09', '2026-10-09')]);
  const LICENCIA = {
    clave: 'salida:2026-10-09', fecha: '2026-10-09',
    texto: 'Revisá tus horas extras del viernes 09/10: ese día tenés una licencia de día entero.',
    aviso: 'Ese día tenés una licencia de día entero: revisá esta salida.'
  };
  const FERIADO = {
    clave: 'salida:2026-10-12', fecha: '2026-10-12',
    texto: 'Revisá tus horas extras del lunes 12/10: ahora es feriado y falta la entrada.',
    aviso: 'Ahora es feriado: falta la entrada.'
  };
  const SABADO = {
    clave: 'salida:2026-10-24', fecha: '2026-10-24',
    texto: 'Revisá tus horas extras del sábado 24/10: es sábado y falta la entrada.',
    aviso: 'Es sábado: falta la entrada.'
  };

  it('un día que pasó a ser feriado sin entrada, un sábado sin entrada y un día con licencia de día entero, por fecha', () => {
    assert.deepEqual(avisosDeSalidas(ESTADO, FERIADOS), [LICENCIA, FERIADO, SABADO]);
    // La de la licencia sigue sumando y la del feriado, no: octubre da 4 (09/10) + 4 (21/10) + 4 (el domingo, de 09:00 a 13:00)
    assert.equal(delMes(horasAFavorDe(ESTADO, { hoy: HOY, feriados: FERIADOS }), '2026-10').a_favor, 12);
  });

  it('un domingo sin entrada', () => {
    assert.deepEqual(avisosDeSalidas(conSalidas([salida(100, '2026-10-18', '13:00')]), FERIADOS), [{
      clave: 'salida:2026-10-18', fecha: '2026-10-18',
      texto: 'Revisá tus horas extras del domingo 18/10: es domingo y falta la entrada.', aviso: 'Es domingo: falta la entrada.'
    }]);
  });

  it('un feriado dado de baja no deja aviso: el día pasa a ser hábil y cuenta la salida desde las 15:00', () => {
    assert.deepEqual(avisosDeSalidas(ESTADO, SIN_FERIADOS), [LICENCIA, SABADO]);
    // El 12/10 suma 4 (19:00): 16 en octubre
    assert.equal(delMes(horasAFavorDe(ESTADO, A_HOY), '2026-10').a_favor, 16);
  });

  it('una licencia que no es de día entero o de la otra modalidad no deja aviso; las 7 horas a favor, sí', () => {
    const delDia = [salida(104, '2026-10-21', '19:00')];
    assert.deepEqual(avisosDeSalidas(conSalidas(delDia, [uso(200, 'horas_a_favor', '2026-10-21', 2)]), FERIADOS), []);
    // Un franco es de planta: en contrato no es un día de licencia
    assert.deepEqual(avisosDeSalidas(conSalidas(delDia, [uso(200, 'franco', '2026-10-21')]), FERIADOS), []);
    // Las 7 horas a favor son el día entero
    assert.deepEqual(avisosDeSalidas(conSalidas(delDia, [uso(200, 'horas_a_favor', '2026-10-21', 7)]), FERIADOS)
      .map((aviso) => aviso.clave), ['salida:2026-10-21']);
  });

  it('solo en contrato; sin salidas, nada', () => {
    assert.deepEqual(avisosDeSalidas({ ...ESTADO, modalidad: 'planta' }, FERIADOS), []);
    assert.deepEqual(avisosDeSalidas({ ...ESTADO, modalidad: null }, FERIADOS), []);
    assert.deepEqual(avisosDeSalidas(CONTRATO.estado, SIN_FERIADOS), []);
    assert.deepEqual(avisosDeSalidas(conSalidas([]), FERIADOS), []);
    const { salidas: _sinSalidas, ...sinLaClave } = ESTADO;
    assert.deepEqual(avisosDeSalidas(sinLaClave, FERIADOS), []);
  });

  it('nada tira: lo que no es una salida no deja aviso', () => {
    for (const valor of [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')]) {
      assert.deepEqual(avisosDeSalidas(valor, valor), [], String(valor));
      assert.deepEqual(avisosDeSalidas(conSalidas([valor, { fecha: valor, salida: valor, entrada: valor }]), FERIADOS), [],
        String(valor));
      assert.doesNotThrow(() => avisosDeSalidas({ ...ESTADO, licencias: [valor], salidas: valor }, valor), String(valor));
    }
  });
});

describe('lo no utilizado previamente', () => {
  // Un estado de contrato con el arranque del 02/03/2026 y el saldo de horas no utilizadas de 2026
  const contratoDesdeMarzo = (saldo, salidas, licencias = []) => conSalidas(salidas, licencias, {
    arranque: '2026-03-02', saldos: [{ concepto: 'horas_no_utilizadas', anio: 2026, cantidad: saldo }]
  });
  // 3 horas extras en mayo (la salida a las 18:00): 3 a favor en junio, que nadie usó
  const MAYO = salida(100, '2026-05-12', '18:00');

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
    const estado = conSalidas([salida(100, '2026-12-10', '18:00')]);
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
      ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, salida(100, '2026-08-20', '18:00')]
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
    const estado = contratoDesdeMarzo(1, [salida(101, '2026-03-10', '17:00'), MAYO],
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
    // CONTRATO que pasó a planta: sus horas a favor y su saldo de horas no cuentan; sus horas extras (las de antes de la
    // planilla) dan francos
    const aPlanta = { ...CONTRATO.estado, modalidad: 'planta', horasExtras: HORAS_EXTRAS_DE_CONTRATO };
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
        paso: 1, ayuda: 'De 0 a 30, el máximo de una licencia.'
      },
      {
        clave: 'vacaciones-2025', concepto: 'vacaciones', anio: 2025, rotulo: 'De la 2025', maximo: 30, paso: 1,
        ayuda: 'De 0 a 30, el máximo de una licencia.'
      },
      {
        clave: 'vacaciones-2026', concepto: 'vacaciones', anio: 2026, rotulo: 'De la 2026', maximo: 10, paso: 1,
        ayuda: 'De 0 a 10: lo que se habilitó de la 2026 hasta hoy.'
      },
      {
        clave: 'franquicias', concepto: 'franquicias', anio: 2026, rotulo: 'Horas de franquicia', maximo: 42, paso: 1,
        ayuda: ''
      },
      { clave: 'estudios', concepto: 'estudios', anio: 2026, rotulo: 'Días de estudios', maximo: 15, paso: 1, ayuda: '' },
      { clave: 'medica', concepto: 'medica', anio: 2026, rotulo: 'Días de atención médica', maximo: 25, paso: 1, ayuda: '' },
      { clave: 'familiar', concepto: 'familiar', anio: 2026, rotulo: 'Días de grupo familiar', maximo: 25, paso: 1, ayuda: '' }
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
      maximo: 200, paso: 0.5, ayuda: ''
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

  // Cada tope dice de dónde sale (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8): el del año del arranque, lo
  // habilitado; uno anterior con sus días cargados, esos días; sin días cargados, el máximo de una licencia; los demás, nada
  it('la ayuda de cada campo: de dónde sale su máximo', () => {
    const ayudas = (arranque, anios, modalidad = 'planta') => Object.fromEntries(
      camposDelSaldoInicial({ modalidad, arranque, anios }).map(({ clave, ayuda }) => [clave, ayuda]));
    // 15 días en 2026 (la primera mitad, 8), 20 en 2025 y nada en 2024
    assert.deepEqual(ayudas('2026-10-27', [
      { anio: 2025, dias_vacaciones: 20, estudios: null }, { anio: 2026, dias_vacaciones: 15, estudios: 'universitario' }
    ]), {
      'vacaciones-2024': 'De 0 a 30, el máximo de una licencia.',
      'vacaciones-2025': 'De 0 a 20: los días de la 2025.',
      'vacaciones-2026': 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.',
      franquicias: '', estudios: '', medica: '', familiar: ''
    });
    // Los días de un año anterior que valen heredados también son sus días; en contrato, igual, y sus horas sin ayuda
    assert.deepEqual(ayudas('2026-03-10', [{ anio: 2024, dias_vacaciones: 25, estudios: null }], 'contrato'), {
      'vacaciones-2024': 'De 0 a 25: los días de la 2024.',
      'vacaciones-2025': 'De 0 a 25: los días de la 2025.',
      medica: '', familiar: '', horas_no_utilizadas: ''
    });
    // Sin ningún año cargado, el del arranque con la primera mitad de 30
    assert.equal(ayudas('2026-07-01', [])['vacaciones-2026'], 'De 0 a 15: lo que se habilitó de la 2026 hasta hoy.');
    // Las tres ayudas como funciones; un año que no sirve, la raya
    assert.equal(textoSaldoDelArranque(8, 2026), 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.');
    assert.equal(textoSaldoDeLosDias(20, 2025), 'De 0 a 20: los días de la 2025.');
    assert.equal(textoSaldoSinDias(30), 'De 0 a 30, el máximo de una licencia.');
    assert.equal(textoSaldoDeLosDias(20, 'x'), 'De 0 a 20: los días de la —.');
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
      { datos: null, error: { campo: 'vacaciones-2025', mensaje: 'De 0 a 30, el máximo de una licencia.' } });
    for (const vacio of [null, '', '  ', 'x', true, [3]]) {
      assert.deepEqual(validar({ ...SALDOS_PLANTA, medica: vacio }).error, { campo: 'medica', mensaje: textoSaldo(25) });
    }
    assert.deepEqual(validarSaldoInicial({}, CAMPOS).error,
      { campo: 'vacaciones-2024', mensaje: 'De 0 a 30, el máximo de una licencia.' });
  });

  it('de 0 al máximo, en días enteros', () => {
    assert.deepEqual(validar({ ...SALDOS_PLANTA, 'vacaciones-2026': 11 }).error,
      { campo: 'vacaciones-2026', mensaje: 'De 0 a 10: lo que se habilitó de la 2026 hasta hoy.' });
    assert.deepEqual(validar({ ...SALDOS_PLANTA, franquicias: 2.5 }).error, { campo: 'franquicias', mensaje: textoSaldo(42) });
    assert.deepEqual(validar({ ...SALDOS_PLANTA, familiar: -1 }).error, { campo: 'familiar', mensaje: textoSaldo(25) });
    assert.equal(validar({ ...SALDOS_PLANTA, 'vacaciones-2026': 0, franquicias: 42 }).error, null);
  });

  // El error de un campo con ayuda es su ayuda (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.8): dice de dónde sale el
  // tope. Sin ayuda (vacía, solo espacios o lo que no es un texto), textoSaldo con su máximo, como siempre
  it('el error de un campo con ayuda es su ayuda; sin ayuda, textoSaldo', () => {
    const campos = camposDelSaldoInicial({ modalidad: 'planta', arranque: '2026-10-27', anios: [
      { anio: 2025, dias_vacaciones: 20, estudios: null }, { anio: 2026, dias_vacaciones: 15, estudios: null }
    ] });
    const llenos = Object.fromEntries(campos.map(({ clave }) => [clave, 0]));
    const error = (clave, valor, lista = campos) => validarSaldoInicial({ saldos: { ...llenos, [clave]: valor } }, lista).error;
    assert.deepEqual(error('vacaciones-2026', 9),
      { campo: 'vacaciones-2026', mensaje: 'De 0 a 8: lo que se habilitó de la 2026 hasta hoy.' });
    assert.deepEqual(error('vacaciones-2025', 21), { campo: 'vacaciones-2025', mensaje: 'De 0 a 20: los días de la 2025.' });
    assert.deepEqual(error('vacaciones-2024', -1),
      { campo: 'vacaciones-2024', mensaje: 'De 0 a 30, el máximo de una licencia.' });
    // Un número que no es entero, también con la ayuda
    assert.deepEqual(error('vacaciones-2025', 2.5), { campo: 'vacaciones-2025', mensaje: 'De 0 a 20: los días de la 2025.' });
    assert.equal(error('vacaciones-2025', 20), null);
    assert.deepEqual(error('medica', 26), { campo: 'medica', mensaje: textoSaldo(25) });
    for (const ayuda of ['', '   ', null, 7, undefined]) {
      const sinAyuda = campos.map((campo) => (campo.clave === 'vacaciones-2025' ? { ...campo, ayuda } : campo));
      assert.deepEqual(error('vacaciones-2025', 21, sinAyuda), { campo: 'vacaciones-2025', mensaje: textoSaldo(20) },
        String(ayuda));
    }
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
    assert.deepEqual(Object.keys(calculo),
      ['reparto', 'topes', 'franquicia', 'francos', 'horasAFavor', 'noUtilizadas', 'faltantes', 'avisosDeSalidas',
        'restituciones']);
    assert.deepEqual(calculo.reparto, repartoDeVacaciones(PLANTA.estado, A_HOY));
    assert.deepEqual(calculo.topes, usoDeLosTopes(PLANTA.estado, { feriados: SIN_FERIADOS }));
    // Las 42 horas de franquicia menos las 17 del saldo inicial (spec 2026-10-28, 3.6)
    assert.deepEqual(calculo.franquicia, { quedan: 25, perdidas: 0, disponibles: 25 });
    assert.deepEqual(calculo.francos, francosDe(PLANTA.estado, A_HOY));
    assert.deepEqual(calculo.horasAFavor, []);
    assert.deepEqual(calculo.noUtilizadas, { 2026: noUtilizadasDe(PLANTA.estado, 2026, A_HOY) });
    assert.deepEqual(calculo.faltantes, []);
    assert.deepEqual(calculo.avisosDeSalidas, []);
    assert.deepEqual(calculo.restituciones, []);
  });

  it('CONTRATO a hoy: las horas a favor y las horas no utilizadas', () => {
    const calculo = calcular(CONTRATO.estado, A_HOY);
    assert.deepEqual(calculo.topes, usoDeLosTopes(CONTRATO.estado, { feriados: SIN_FERIADOS }));
    assert.deepEqual(calculo.francos, []);
    assert.deepEqual(calculo.horasAFavor, horasAFavorDe(CONTRATO.estado, A_HOY));
    assert.equal(calculo.noUtilizadas[2026].quedan, 6.5);
    assert.deepEqual(calculo.faltantes, []);
    assert.deepEqual(calculo.avisosDeSalidas, []);
  });

  it('los avisos de las salidas van aparte, nunca en los faltantes (así no frenan ninguna carga)', () => {
    // El 12/10 pasó a ser feriado y su salida no tiene entrada; el 21/10, unas vacaciones cargadas después
    const feriados = new Set(['2026-10-12']);
    const estado = {
      ...CONTRATO.estado,
      licencias: [...CONTRATO.estado.licencias, vacaciones(100, '2026-10-21', '2026-10-21')],
      salidas: [...CONTRATO.estado.salidas, salida(100, '2026-10-12', '19:00')]
    };
    const calculo = calcular(estado, { hoy: HOY, feriados });
    assert.equal(calculo.faltantes.some((faltante) => faltante.clave.startsWith('salida:')), false);
    assert.deepEqual(calculo.avisosDeSalidas.map((aviso) => aviso.clave), ['salida:2026-10-12', 'salida:2026-10-21']);
    assert.deepEqual(calculo.avisosDeSalidas, avisosDeSalidas(estado, feriados));
  });

  it('lo no utilizado de cada año con algo: hoy, el arranque, los meses de uso y los usos autorizados', () => {
    // Las horas de diciembre se usan en enero de 2027
    const diciembre = conSalidas([salida(100, '2026-12-10', '18:00')]);
    assert.deepEqual(Object.keys(calcular(diciembre, { hoy: '2027-02-15', feriados: SIN_FERIADOS }).noUtilizadas),
      ['2026', '2027']);
    // Un uso autorizado de 2025, en planta (cuenta también antes del arranque)
    const usoViejo = conHoras('planta', [], [uso(200, 'uso_autorizado', '2025-11-04', 7)]);
    assert.deepEqual(Object.keys(calcular(usoViejo, A_HOY).noUtilizadas), ['2025', '2026']);
    // Sin modalidad, ninguno
    assert.deepEqual(calcular({ ...PLANTA.estado, modalidad: null }, A_HOY).noUtilizadas, {});
  });

  it('una modalidad que cambia (Review Focus 1): las horas a favor de CONTRATO, en planta, no cuentan en nada', () => {
    // Con las horas extras que tenía antes de la planilla (las salidas no cuentan en planta)
    const aPlanta = { ...CONTRATO.estado, modalidad: 'planta', horasExtras: HORAS_EXTRAS_DE_CONTRATO };
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

  it('una licencia de la otra modalidad no cuenta, pero ocupa su día: no es un día libre para no perder los días', () => {
    // Planta, con 15 de la 2024: las vacaciones del 21/12 al 30/12 usan 7 y el 31/12 tiene unas horas a favor de contrato,
    // que no cuentan en planta pero no dejan cargar nada ese día (`validarLicencia`): los 8 que quedan se pierden
    const aFavor = { id: 103, tipo: 'horas_a_favor', desde: '2026-12-31', hasta: '2026-12-31', horas: 2 };
    const estado = soloVacaciones('2026-10-26', PERSONA, vacaciones(100, '2026-12-21', '2026-12-30'), aFavor);
    assert.equal(fueraDeLaModalidad(aFavor, 'planta'), true);
    const { reparto } = calcular(estado, A_HOY);
    assert.deepEqual([ordinaria(reparto, 2024).disponibles, ordinaria(reparto, 2024).perdidos], [0, 8]);
    // El reparto usa las ocupadas que le llegan; sin ellas, las licencias del estado
    const deLaModalidad = { ...estado, licencias: [vacaciones(100, '2026-12-21', '2026-12-30')] };
    const conOcupadas = repartoDeVacaciones(deLaModalidad, { ...A_HOY, ocupadas: estado.licencias });
    assert.equal(ordinaria(conOcupadas, 2024).perdidos, 8);
    assert.equal(ordinaria(repartoDeVacaciones(deLaModalidad, A_HOY), 2024).perdidos, 0);
  });

  it('sin un hoy válido, nada', () => {
    const calculo = calcular(PLANTA.estado, { feriados: SIN_FERIADOS });
    assert.deepEqual(calculo.reparto.ordinarias, []);
    assert.equal(calculo.reparto.sinCubrir.size, 0);
    assert.deepEqual([calculo.topes, calculo.franquicia, calculo.francos, calculo.horasAFavor, calculo.noUtilizadas,
      calculo.faltantes, calculo.avisosDeSalidas, calculo.restituciones], [[], null, [], [], {}, [], [], []]);
    assert.deepEqual(calcular(JULIETA.estado, { feriados: ASUETOS }).restituciones, []);
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
    const diciembre = conSalidas(SALIDAS_DEL_USUARIO, [
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
    // Sin saldo de la 2026, su segunda mitad se habilita el 1/1/2027 (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3:
    // sin ningún día, el error va en «Desde» y dice lo que se habilita después)
    const estado = soloVacaciones('2026-10-26', { 2024: 0, 2025: 0, 2026: 0 });
    assert.deepEqual(evaluar(estado, { tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-04' }).error,
      { campo: 'desde', mensaje: 'No te alcanzan los días habilitados para el 03/11/2026. El 1/1/2027 se habilitan 10 más de la '
        + '2026.' });
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
    // Es la misma carga: el error va en «Hasta» y dice hasta dónde puede llegar (spec 2026-10-28, 3.3), el «Hasta» guardado,
    // que no agranda el faltante que ya tenía
    assert.deepEqual(evaluar(estado, { ...entrada, hasta: '2027-06-17' }, { editadaId: 100 }).error,
      { campo: 'hasta', mensaje: textoHastaDondeAlcanza('2027-06-16') });
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
    // El error dice cuáles y desde cuándo les faltan, en «Hasta» (spec 2026-10-28, 3.3)
    assert.deepEqual(evaluar(estado, { tipo: 'vacaciones', desde: '2027-05-03', hasta: '2027-05-05' }).error,
      { campo: 'hasta', mensaje: textoFaltanEnOtraCarga('2027-06-01', '2027-06-14', '2027-06-10') });
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
          queda_texto: '', antes_del_arranque: false, texto_antes_del_arranque: '', avisos: []
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

  it('unas vacaciones en un día con una salida guardada no se frenan: la salida queda como aviso (spec horas, 7)', () => {
    // Hoy, el lunes 26/10, CONTRATO ya cargó su salida de las 19:00; después carga vacaciones para ese mismo día
    const estado = { ...CONTRATO.estado, salidas: [...CONTRATO.estado.salidas, salida(100, '2026-10-26', '19:00')] };
    const entrada = { tipo: 'vacaciones', desde: '2026-10-26', hasta: '2026-10-26' };
    const { datos, error } = evaluar(estado, entrada);
    assert.equal(error, null);
    assert.deepEqual([datos.tipo, datos.desde, datos.hasta], ['vacaciones', '2026-10-26', '2026-10-26']);
    // Con la licencia, la salida da un aviso (y sigue sumando), sin ningún faltante
    const conLaLicencia = conLicencias(estado, { id: 100, ...datos });
    const calculo = calcular(conLaLicencia, A_HOY);
    assert.deepEqual(calculo.avisosDeSalidas.map((aviso) => aviso.clave), ['salida:2026-10-26']);
    assert.deepEqual(calculo.faltantes, []);
    // Una corrección de una licencia que ya tenía el aviso tampoco se frena
    assert.equal(evaluar(conLaLicencia, { ...entrada, nota: 'Trámite' }, { editadaId: 100 }).error, null);
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
      texto_antes_del_arranque: TEXTO_ANTES_DEL_ARRANQUE, avisos: []
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

describe('lo por habilitar y el alcance (spec 2026-10-28, 3.1)', () => {
  // La persona de planta de la spec 2026-10-28-mi-espacio-vacaciones-en-la-carga (punto 1): 15 días de la 2024, 20 de la 2025
  // y 10 de la 2026 en el saldo, 20 días por año, el arranque el 27/10/2026 y hoy el 28/10/2026, con la precarga de los
  // feriados (el 07/12/2026 no es laborable, el 08 y el 09/02/2027 son Carnaval y el 23/02/2027, el aniversario de la ciudad)
  const HOY_DE_LA_CARGA = '2026-10-28';
  const A_LA_CARGA = Object.freeze({
    hoy: HOY_DE_LA_CARGA, feriados: feriadosDelRango(FILAS_PRECARGA, '2024-01-01', '2028-12-31')
  });
  const persona = (...licencias) => soloVacaciones('2026-10-27', PERSONA, ...licencias);
  const pedido = (desde, hasta) => ({ tipo: 'vacaciones', desde, hasta });
  const evaluar = (estado, entrada, editadaId) => evaluarLicencia(estado, entrada, { ...A_LA_CARGA, editadaId });

  // El «Hasta» más lejano que se guarda, probando uno por uno desde el desde hasta el último día del rango
  const fuerzaBruta = (estado, entrada, editadaId) => {
    const tope = rangoDeFechas(HOY_DE_LA_CARGA).hasta;
    let ultimo = null;
    for (let hasta = entrada.desde; hasta <= tope; hasta = sumarDias(hasta, 1)) {
      if (evaluar(estado, { ...entrada, hasta }, editadaId).error === null) ultimo = hasta;
    }
    return ultimo;
  };

  it('porHabilitarDe sin cargas: el 1/1/2027 de la 2026 y las dos mitades de la 2027', () => {
    const reparto = repartoDeVacaciones(persona(), A_LA_CARGA);
    assert.deepEqual(porHabilitarDe(reparto.ordinarias, HOY_DE_LA_CARGA), [
      { fecha: '2027-01-01', anio: 2026, dias: 10 },
      { fecha: '2027-07-01', anio: 2027, dias: 10 },
      { fecha: '2028-01-01', anio: 2027, dias: 10 }
    ]);
  });

  it('porHabilitarDe: lo ya asignado de más consume primero la mitad más temprana', () => {
    // Sin saldo: del 05/07 al 30/07/2027 son 18 días hábiles (el 09/07 es fijo y el 28/07, la Gesta galesa), 10 de la
    // segunda mitad de la 2026 y 8 de la primera de la 2027
    const julio = vacaciones(100, '2027-07-05', '2027-07-30');
    const reparto = repartoDeVacaciones(soloVacaciones('2026-10-27', { 2024: 0, 2025: 0, 2026: 0 }, julio), A_LA_CARGA);
    assert.deepEqual(reparto.porFila.get(100), [{ anio: 2026, dias: 10 }, { anio: 2027, dias: 8 }]);
    assert.deepEqual(porHabilitarDe(reparto.ordinarias, HOY_DE_LA_CARGA), [
      { fecha: '2027-07-01', anio: 2027, dias: 2 },
      { fecha: '2028-01-01', anio: 2027, dias: 10 }
    ]);
    // Con 13 asignados de más, la primera mitad queda en 0 (no va) y a la segunda le quedan 7
    const mitades = [{ dias: 10, habilita: '2027-07-01' }, { dias: 10, habilita: '2028-01-01' }];
    assert.deepEqual(porHabilitarDe([{ anio: 2027, mitades, por_habilitar: 7 }], HOY_DE_LA_CARGA),
      [{ fecha: '2028-01-01', anio: 2027, dias: 7 }]);
    // Una mitad ya habilitada a hoy no cuenta: el 01/07/2027, la del 1/7 ya está
    assert.deepEqual(porHabilitarDe([{ anio: 2027, mitades, por_habilitar: 10 }], '2027-07-01'),
      [{ fecha: '2028-01-01', anio: 2027, dias: 10 }]);
  });

  it('porHabilitarDe: por fecha y después por año', () => {
    const ordinarias = [
      { anio: 2027, mitades: [{ dias: 4, habilita: '2027-01-01' }], por_habilitar: 4 },
      { anio: 2026, mitades: [{ dias: 5, habilita: '2027-01-01' }, { dias: 3, habilita: '2026-12-01' }], por_habilitar: 8 }
    ];
    assert.deepEqual(porHabilitarDe(ordinarias, HOY_DE_LA_CARGA), [
      { fecha: '2026-12-01', anio: 2026, dias: 3 },
      { fecha: '2027-01-01', anio: 2026, dias: 5 },
      { fecha: '2027-01-01', anio: 2027, dias: 4 }
    ]);
  });

  it('del 01/12/2026 al 05/02/2027: no quedan días hoy, el 1/1 se habilitan 10 más y puede llegar hasta el 24/02/2027', () => {
    const { datos, error, vista } = evaluar(persona(), pedido('2026-12-01', '2027-02-05'));
    assert.equal(error, null);
    assert.equal(datos.hasta, '2027-02-05');
    assert.equal(vista.texto_dias, '45 días hábiles de 67 corridos');
    assert.equal(vista.texto_reparto, 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más '
      + 'viejas. No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026: esta licencia puede llegar '
      + 'hasta el 24/02/2027.');
  });

  it('del 01/12/2026 al 24/02/2027: ya no hay nada por habilitar hasta su hasta, ni alcance', () => {
    const { error, vista } = evaluar(persona(), pedido('2026-12-01', '2027-02-24'));
    assert.equal(error, null);
    assert.equal(vista.texto_reparto, 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (20 días), las más '
      + 'viejas. No te quedan días disponibles.');
  });

  // «No te quedan días disponibles hoy.» va cuando hay algo por habilitar de las licencias hasta el año de hoy (lo mismo que nombra
  // la opción del tipo, «· 10 más el 1/1»), aunque su fecha quede después del «Hasta» y no se nombre (la revisión final de la spec,
  // 3.1). Del arranque al 31/12/2026 hay 42 días hábiles: para que una carga que termina antes del 1/1/2027 use todo lo
  // habilitado, otra guardada, del 01/01 al 06/01/2027, usa los otros 3 de la primera mitad de la 2026. La segunda (10 días, el
  // 1/1/2027) queda sin asignar, y el 1/1 está dentro de la guardada: esta no puede llegar más allá de su hasta
  it('del 27/10 al 31/12/2026, con lo habilitado usado: «No te quedan días disponibles hoy.», sin nombrar el 1/1/2027', () => {
    const { error, vista } = evaluar(persona(vacaciones(100, '2027-01-01', '2027-01-06')), pedido('2026-10-27', '2026-12-31'));
    assert.equal(error, null);
    assert.equal(alcanceDeLaCarga(persona(vacaciones(100, '2027-01-01', '2027-01-06')), pedido('2026-10-27', '2026-12-31'),
      A_LA_CARGA), '2026-12-31');
    assert.equal(vista.texto_reparto, 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (7 días), las más viejas. '
      + 'No te quedan días disponibles hoy.');
    // Del 01/12/2026 al 24/02/2027 los 20 de la 2026 ya están asignados, y la 2027 es del año siguiente: sin «hoy»
    assert.equal(evaluar(persona(), pedido('2026-12-01', '2027-02-24')).vista.texto_reparto, 'Salen de las licencias 2024 '
      + '(15 días), 2025 (20 días) y 2026 (20 días), las más viejas. No te quedan días disponibles.');
  });

  it('textoDelReparto con hayPorHabilitar: «hoy» sin nombrar nada; solo con el true literal', () => {
    const reparto = repartoDeVacaciones(persona(vacaciones(100, '2026-12-01', '2027-02-05')), A_LA_CARGA);
    const salen = 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más viejas. ';
    const enero = { fecha: '2027-01-01', anio: 2026, dias: 10 };
    assert.equal(textoDelReparto(reparto, 100, { habilitaciones: [], alcance: null, hasta: '2026-12-31', hayPorHabilitar: true }),
      `${salen}No te quedan días disponibles hoy.`);
    // Lo que pasa del hasta sigue sin nombrarse
    assert.equal(textoDelReparto(reparto, 100,
      { habilitaciones: [enero], alcance: null, hasta: '2026-12-31', hayPorHabilitar: true }), `${salen}No te quedan días disponibles hoy.`);
    for (const valor of [false, 1, 'true', null, undefined]) {
      assert.equal(textoDelReparto(reparto, 100, { habilitaciones: [], alcance: null, hasta: '2026-12-31', hayPorHabilitar: valor }),
        `${salen}No te quedan días disponibles.`, String(valor));
    }
    // Con algo que nombrar, «hoy» va igual
    assert.equal(textoDelReparto(reparto, 100, { habilitaciones: [enero], alcance: null, hasta: null, hayPorHabilitar: false }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026.`);
  });

  it('del 16/11 al 30/11/2026: lo que se habilita después de su hasta no se nombra', () => {
    const { error, vista } = evaluar(persona(), pedido('2026-11-16', '2026-11-30'));
    assert.equal(error, null);
    assert.equal(vista.texto_reparto, 'Salen de la licencia 2024, la más vieja. Te quedan 35 días: 5 de la 2024 (vencen el '
      + '31/12/2026), 20 de la 2025 y 10 de la 2026.');
  });

  it('una carga que llega al 1/7/2027 nombra las dos fechas', () => {
    // La de diciembre (guardada) usa los 15 de la 2024; esta, 5 de la 2025: la mitad del 1/1/2027 de la 2026 sigue sin
    // asignar, y el 1/7/2027 se habilita la primera de la 2027
    const { error, vista } = evaluar(persona(vacaciones(100, '2026-12-01', '2026-12-23')), pedido('2027-06-28', '2027-07-02'));
    assert.equal(error, null);
    assert.equal(vista.texto_reparto, 'Salen de la licencia 2025, la más vieja. Te quedan 25 días: 15 de la 2025 y 10 de la '
      + '2026. El 1/1/2027 se habilitan 10 más de la 2026 y el 1/7/2027, 10 de la 2027.');
  });

  it('alcanceDeLaCarga, como la fuerza bruta: sin cargas, desde el 01/12/2026 llega al 24/02/2027', () => {
    const entrada = pedido('2026-12-01', '2026-12-01');
    assert.equal(alcanceDeLaCarga(persona(), entrada, A_LA_CARGA), '2027-02-24');
    assert.equal(fuerzaBruta(persona(), entrada), '2027-02-24');
    // Un desde en sábado: se busca desde el primer día hábil, el lunes 30/11. El último día con licencia es el lunes
    // 22/02/2027, y el martes 23 es feriado: el «Hasta» más lejano que se guarda es el 23
    const sabado = pedido('2026-11-28', '2026-11-28');
    assert.equal(alcanceDeLaCarga(persona(), sabado, A_LA_CARGA), fuerzaBruta(persona(), sabado));
    assert.equal(alcanceDeLaCarga(persona(), sabado, A_LA_CARGA), '2027-02-23');
  });

  it('alcanceDeLaCarga, como la fuerza bruta: otra carga guardada en marzo de 2027 deja menos', () => {
    // Las de marzo (10 días hábiles) ya no pueden usar la 2024: esta tiene que dejarles 10 de la 2025 y la 2026, y llega a
    // 45 días hábiles, hasta el viernes 05/02/2027. Después vienen el fin de semana y Carnaval: el «Hasta» más lejano que se
    // guarda es el martes 09/02
    const estado = persona(vacaciones(100, '2027-03-01', '2027-03-12'));
    const entrada = pedido('2026-12-01', '2026-12-01');
    assert.equal(alcanceDeLaCarga(estado, entrada, A_LA_CARGA), '2027-02-09');
    assert.equal(fuerzaBruta(estado, entrada), '2027-02-09');
    // Sin la de marzo llegaba al 24/02/2027. Con ella, del 01/12 al 05/02 los 20 de la 2026 ya están asignados (10 a esta y
    // 10 a la de marzo): no queda nada que se habilite para nombrar, y un alcance solo de fin de semana y feriados no se dice
    assert.equal(evaluar(estado, pedido('2026-12-01', '2027-02-05')).vista.texto_reparto, 'Salen de las licencias 2024 '
      + '(15 días), 2025 (20 días) y 2026 (10 días), las más viejas. No te quedan días disponibles.');
  });

  it('alcanceDeLaCarga, como la fuerza bruta: una corrección no choca consigo misma', () => {
    const estado = persona(vacaciones(101, '2026-12-01', '2027-01-15'));
    const entrada = pedido('2026-12-01', '2027-01-15');
    assert.equal(alcanceDeLaCarga(estado, entrada, { ...A_LA_CARGA, editadaId: 101 }), '2027-02-24');
    assert.equal(fuerzaBruta(estado, entrada, 101), '2027-02-24');
    // El id como texto, como llega en un pedido
    assert.equal(alcanceDeLaCarga(estado, entrada, { ...A_LA_CARGA, editadaId: '101' }), '2027-02-24');
    // Como carga nueva, se superpone con la guardada desde el primer día
    assert.equal(alcanceDeLaCarga(estado, entrada, A_LA_CARGA), null);
    assert.equal(fuerzaBruta(estado, entrada), null);
  });

  it('alcanceDeLaCarga, como la fuerza bruta: un desde sin ningún día habilitado da null', () => {
    // La guardada usa todo hasta el 24/02/2027: el 01/06/2027 la 2025 y la 2026 no tienen días y la 2027 todavía no se habilita
    const estado = persona(vacaciones(100, '2026-12-01', '2027-02-24'));
    const entrada = pedido('2027-06-01', '2027-06-01');
    assert.equal(alcanceDeLaCarga(estado, entrada, A_LA_CARGA), null);
    assert.equal(fuerzaBruta(estado, entrada), null);
  });

  it('alcanceDeLaCarga no pasa del último día del rango', () => {
    // Con mucho saldo, todo el rango entra: el 31/12/2027
    const holgado = soloVacaciones('2026-10-27', { 2024: 0, 2025: 0, 2026: 300 });
    assert.equal(alcanceDeLaCarga(holgado, pedido('2027-11-01', '2027-11-01'), A_LA_CARGA), rangoDeFechas(HOY_DE_LA_CARGA).hasta);
  });

  it('textoDelReparto sin extras da lo de antes; con extras vacíos, también', () => {
    const reparto = repartoDeVacaciones(persona(vacaciones(100, '2026-12-01', '2027-02-05')), A_LA_CARGA);
    const antes = 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más viejas. No te quedan días '
      + 'disponibles.';
    assert.equal(textoDelReparto(reparto, 100), antes);
    for (const extras of [undefined, null, {}, { habilitaciones: [] }, 'x', 3]) {
      assert.equal(textoDelReparto(reparto, 100, extras), antes, String(extras));
    }
    // Un alcance sin nada que se habilite no se nombra (la oración del alcance es la de las habilitaciones)
    assert.equal(textoDelReparto(reparto, 100, { habilitaciones: [], alcance: '2027-02-24', hasta: '2027-02-05' }), antes);
  });

  it('textoDelReparto con extras: una, dos o tres fechas, el singular, el alcance y lo que pasa de la fecha tope', () => {
    const reparto = repartoDeVacaciones(persona(vacaciones(100, '2026-12-01', '2027-02-05')), A_LA_CARGA);
    const salen = 'Salen de las licencias 2024 (15 días), 2025 (20 días) y 2026 (10 días), las más viejas. ';
    const enero = { fecha: '2027-01-01', anio: 2026, dias: 10 };
    const julio = { fecha: '2027-07-01', anio: 2027, dias: 10 };
    const proximoEnero = { fecha: '2028-01-01', anio: 2027, dias: 10 };
    const texto = (extras) => textoDelReparto(reparto, 100, extras);
    assert.equal(texto({ habilitaciones: [enero], alcance: null, hasta: null }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026.`);
    assert.equal(texto({ habilitaciones: [enero, julio], alcance: null, hasta: null }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026 y el 1/7/2027, 10 de la 2027.`);
    assert.equal(texto({ habilitaciones: [enero, julio, proximoEnero], alcance: null, hasta: null }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026, el 1/7/2027, 10 de la 2027 y `
      + 'el 1/1/2028, 10 de la 2027.');
    // Con 1, «se habilita»
    assert.equal(texto({ habilitaciones: [{ ...enero, dias: 1 }, julio], alcance: null, hasta: null }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilita 1 más de la 2026 y el 1/7/2027, 10 de la 2027.`);
    // El alcance, solo si es posterior al hasta; y lo que se habilita después del hasta o del alcance no se nombra
    assert.equal(texto({ habilitaciones: [enero, julio], alcance: '2027-02-24', hasta: '2027-02-05' }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026: esta licencia puede llegar hasta `
      + 'el 24/02/2027.');
    assert.equal(texto({ habilitaciones: [enero, julio], alcance: '2027-02-05', hasta: '2027-02-05' }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026.`);
    assert.equal(texto({ habilitaciones: [enero], alcance: null, hasta: '2026-12-31' }),
      `${salen}No te quedan días disponibles.`);
    // Las que no sirven se saltean
    assert.equal(texto({ habilitaciones: [null, { fecha: 'x', anio: 2026, dias: 3 }, { ...julio, dias: 0 }, enero] }),
      `${salen}No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026.`);
  });

  it('con días disponibles, lo que se habilita va después de «Te quedan …» y antes de «Perdés …»', () => {
    // Del 21/12/2026 al 10/01/2027: «Perdés 2 de la 2024» (spec 2026-10-27, punto 3); el 1/1/2027 cae adentro
    const { error, vista } = evaluar(persona(), pedido('2026-12-21', '2027-01-10'));
    assert.equal(error, null);
    assert.equal(vista.texto_reparto, 'Salen de la licencia 2024, la más vieja. Te quedan 30 días: 20 de la 2025 y 10 de la '
      + '2026. El 1/1/2027 se habilitan 10 más de la 2026. Perdés 2 de la 2024 (vencen el 31/12/2026).');
  });

  it('nada tira con entradas raras', () => {
    const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        porHabilitarDe(valor, HOY_DE_LA_CARGA);
        porHabilitarDe([valor, { anio: valor, mitades: valor, por_habilitar: valor }, { mitades: [valor] }], valor);
        alcanceDeLaCarga(valor, valor, valor);
        alcanceDeLaCarga(persona(), { tipo: 'vacaciones', desde: valor }, A_LA_CARGA);
        alcanceDeLaCarga(persona(), pedido('2026-12-01', '2026-12-01'), { hoy: valor, feriados: valor, editadaId: valor });
        textoDelReparto(repartoDeVacaciones(persona(vacaciones(100, '2026-12-01', '2027-02-05')), A_LA_CARGA), 100,
          { habilitaciones: valor, alcance: valor, hasta: valor });
      });
      assert.deepEqual(porHabilitarDe(valor, HOY_DE_LA_CARGA), []);
      assert.deepEqual(porHabilitarDe([{ anio: 2027, mitades: [{ dias: 10, habilita: '2027-07-01' }], por_habilitar: 10 }],
        valor), []);
      assert.equal(alcanceDeLaCarga(valor, pedido('2026-12-01', '2026-12-01'), A_LA_CARGA), null);
      assert.equal(alcanceDeLaCarga(persona(), pedido('2026-12-01', '2026-12-01'), { hoy: valor }), null);
    }
  });
});

describe('los errores de días dicen hasta dónde alcanza (spec 2026-10-28, 3.3)', () => {
  // Hoy el 28/10/2026, con la precarga de los feriados (el 07/12/2026 no es laborable, el 08 y el 09/02/2027 son Carnaval y
  // el 23/02/2027, el aniversario de la ciudad)
  const HOY_DE_LA_CARGA = '2026-10-28';
  const A_LA_CARGA = Object.freeze({
    hoy: HOY_DE_LA_CARGA, feriados: feriadosDelRango(FILAS_PRECARGA, '2024-01-01', '2028-12-31')
  });
  const pedido = (desde, hasta) => ({ tipo: 'vacaciones', desde, hasta });
  const evaluar = (estado, entrada, editadaId) => evaluarLicencia(estado, entrada, { ...A_LA_CARGA, editadaId });
  // La persona de planta de la spec (punto 1): 15 días de la 2024, 20 de la 2025 y 10 de la 2026, 20 por año
  const persona = (...licencias) => soloVacaciones('2026-10-27', PERSONA, ...licencias);
  // Una persona inventada de contrato con 10 días por año: 0 de la 2024, 7 de la 2025 y 5 de la 2026 en el saldo (la otra
  // mitad de la 2026 se habilita el 1/1/2027), con el arranque hoy
  const deContrato = (...licencias) => ({
    ...CONTRATO.estado, arranque: HOY_DE_LA_CARGA, anios: [{ anio: 2026, dias_vacaciones: 10, estudios: null }],
    saldos: saldosDeVacaciones({ 2024: 0, 2025: 7, 2026: 5 }), licencias
  });
  // Las de enero de la persona de contrato: 15 días hábiles, 7 de la 2025 y 8 de la 2026
  const ENERO = vacaciones(100, '2027-01-04', '2027-01-22');

  it('esta carga se queda corta: el error va en «Hasta» y dice hasta dónde puede llegar', () => {
    // Del 01/12/2026 al 26/02/2027 son 57 días hábiles y le alcanzan 55: el alcance de 3.1
    const { datos, error, vista } = evaluar(persona(), pedido('2026-12-01', '2027-02-26'));
    assert.equal(datos, null);
    assert.deepEqual(error,
      { campo: 'hasta', mensaje: 'No te alcanzan los días habilitados: esta licencia puede llegar hasta el 24/02/2027.' });
    assert.equal(alcanceDeLaCarga(persona(), pedido('2026-12-01', '2027-02-26'), A_LA_CARGA), '2027-02-24');
    // El recuadro muestra solo los días, sin el reparto: esta carga no se guarda
    assert.equal(vista.texto_dias, '57 días hábiles de 88 corridos');
    assert.equal(vista.texto_reparto, '');
    assert.equal(vista.dias_habiles, 57);
    // Hasta el alcance, se guarda
    assert.equal(evaluar(persona(), pedido('2026-12-01', '2027-02-24')).error, null);
  });

  it('otra carga guardada se queda sin días: sus fechas y desde cuándo le faltan', () => {
    // Las de diciembre van antes en el orden: se llevan 5 de la 2025, y a las de enero les alcanzan 12 de sus 15 días
    const { datos, error, vista } = evaluar(deContrato(ENERO), pedido('2026-12-14', '2026-12-18'));
    assert.equal(datos, null);
    assert.deepEqual(error, {
      campo: 'hasta',
      mensaje: 'Con estos días, a tus vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.'
    });
    assert.equal(vista.texto_dias, '5 días hábiles');
    assert.equal(vista.texto_reparto, '');
    // Sin las de enero, se guarda
    assert.equal(evaluar(deContrato(), pedido('2026-12-14', '2026-12-18')).error, null);
  });

  it('… de dos años, con los dos años; de un día, sin «desde»', () => {
    // Del 28/12/2026 al 15/01/2027 son 14 días hábiles: con las de diciembre, les alcanzan los 12 primeros
    const dosAnios = deContrato(vacaciones(101, '2026-12-28', '2027-01-15'));
    assert.deepEqual(evaluar(dosAnios, pedido('2026-12-14', '2026-12-18')).error,
      { campo: 'hasta', mensaje: textoFaltanEnOtraCarga('2026-12-28', '2027-01-15', '2027-01-14') });
    assert.equal(textoFaltanEnOtraCarga('2026-12-28', '2027-01-15', '2027-01-14'),
      'Con estos días, a tus vacaciones del 28/12/2026 al 15/01/2027 les faltan días desde el 14/01/2027.');
    // Las de enero se llevan los 17 días hasta el 1/7/2027: al 22/06/2027 no le queda ninguno
    const unDia = deContrato(vacaciones(102, '2027-06-22', '2027-06-22'));
    assert.deepEqual(evaluar(unDia, pedido('2027-01-04', '2027-01-26')).error,
      { campo: 'hasta', mensaje: 'Con estos días, a tus vacaciones del 22/06/2027 les faltan días.' });
  });

  it('al corregir esa misma carga alargándola, el error es el de esta carga, nunca el de otra', () => {
    // Las de enero hasta el 29/01/2027 son 20 días hábiles y le alcanzan 17: hasta el 26/01
    const estado = deContrato(ENERO);
    const esperado = { campo: 'hasta', mensaje: textoHastaDondeAlcanza('2027-01-26') };
    assert.deepEqual(evaluar(estado, pedido('2027-01-04', '2027-01-29'), 100).error, esperado);
    // El id como texto, como llega en un pedido
    assert.deepEqual(evaluar(estado, pedido('2027-01-04', '2027-01-29'), '100').error, esperado);
    assert.equal(evaluar(estado, pedido('2027-01-04', '2027-01-26'), 100).error, null);
    assert.equal(evaluar(estado, pedido('2027-01-04', '2027-01-29'), 100).vista.texto_reparto, '');
  });

  it('esta carga sin ningún día: en «Desde», con lo que se habilita después', () => {
    // Las de enero se llevan los 17 días: el 22/06/2027 no queda ninguno, y el 1/7/2027 se habilita la mitad de la 2027
    const estado = deContrato(vacaciones(100, '2027-01-04', '2027-01-26'));
    const { datos, error, vista } = evaluar(estado, pedido('2027-06-22', '2027-06-25'));
    assert.equal(datos, null);
    assert.deepEqual(error,
      { campo: 'desde', mensaje: textoSinNingunDia('2027-06-22', { fecha: '2027-07-01', anio: 2027, dias: 5 }) });
    assert.equal(error.mensaje,
      'No te alcanzan los días habilitados para el 22/06/2027. El 1/7/2027 se habilitan 5 más de la 2027.');
    assert.equal(vista.texto_dias, '4 días hábiles');
    assert.equal(vista.texto_reparto, '');
    assert.equal(alcanceDeLaCarga(estado, pedido('2027-06-22', '2027-06-25'), A_LA_CARGA), null);
    // Desde un feriado (el 21/06/2027 es Güemes, trasladado), el día que falta es el primero que descuenta
    assert.deepEqual(evaluar(estado, pedido('2027-06-21', '2027-06-25')).error, error);
  });

  it('… lo que se habilita después es lo que queda sin esta carga', () => {
    // Del 22/06 al 02/07/2027: el 01/07 y el 02/07 ya salen de la mitad de la 2027 que se habilita el 1/7, pero esta carga no
    // se guarda: se habilitan 5, no los 3 que le dejaría
    const estado = deContrato(vacaciones(100, '2027-01-04', '2027-01-26'));
    assert.deepEqual(evaluar(estado, pedido('2027-06-22', '2027-07-02')).error, {
      campo: 'desde',
      mensaje: 'No te alcanzan los días habilitados para el 22/06/2027. El 1/7/2027 se habilitan 5 más de la 2027.'
    });
  });

  it('los errores que no son de días no cambian', () => {
    // Se superpone con una guardada: lo de siempre, de validarLicencia, sin vista
    const { error, vista } = evaluar(deContrato(ENERO), pedido('2027-01-20', '2027-01-27'));
    assert.deepEqual(error, { campo: 'desde', mensaje: textoSuperpuesta('2027-01-20') });
    assert.equal(vista, null);
    // Un tope que se pasa, también como siempre
    const conMedica = conSaldo(deContrato(), 'medica', 24);
    assert.deepEqual(evaluar(conMedica, { tipo: 'medica', desde: '2026-11-16', hasta: '2026-11-17' }).error,
      { campo: 'desde', mensaje: textoTope('medica', 2026) });
  });

  it('nada tira con entradas raras', () => {
    const raros = [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        evaluar(deContrato(ENERO), pedido('2026-12-14', '2026-12-18'), valor);
        evaluar(deContrato(ENERO), pedido('2027-01-04', '2027-01-29'), valor);
        evaluarLicencia(deContrato(ENERO), pedido('2026-12-14', '2026-12-18'), { hoy: HOY_DE_LA_CARGA, feriados: valor });
      });
    }
  });
});

describe('los días libres y la franquicia que vence (spec 2026-10-28, 3.6)', () => {
  // La precarga de los feriados de 2026: el lunes 07/12 no es laborable (y el martes 08/12 es uno de los 9 fijos)
  const CON_LA_PRECARGA = feriadosDelRango(FILAS_PRECARGA, '2026-01-01', '2027-12-31');
  // Unas horas a favor de contrato: en planta no cuentan, pero ocupan su día
  const horasAFavor = (id, fecha) => ({ id, tipo: 'horas_a_favor', desde: fecha, hasta: fecha, horas: 2 });
  const franquicia = (id, fecha, horas) => ({ id, tipo: 'franquicia', desde: fecha, hasta: fecha, horas });
  // PLANTA con 20 horas de franquicia usadas en 2026 en el saldo inicial (las dos de antes del arranque no descuentan): le
  // quedan 22
  const CON_22 = Object.freeze({
    ...PLANTA.estado,
    saldos: PLANTA.estado.saldos.map((saldo) => (saldo.concepto === 'franquicias' ? { ...saldo, cantidad: 20 } : saldo))
  });
  // El lunes 28/12/2026: hasta el jueves 31/12 hay 4 días hábiles
  const FIN_DE_ANIO = '2026-12-28';
  const queVence = (estado, hoy = FIN_DE_ANIO, feriados = SIN_FERIADOS) =>
    franquiciaQueVence(estado, calcular(estado, { hoy, feriados }), { hoy, feriados, ocupadas: estado.licencias });

  it('diasLibresEntre: los días hábiles con los feriados, fuera de toda licencia, con los dos extremos', () => {
    // Del jueves 03/12 al viernes 11/12/2026: el sábado, el domingo, el 07 (de la tabla) y el 08 (fijo) no son hábiles
    assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', [], CON_LA_PRECARGA), 5);
    // Sin la tabla, el 07 es hábil
    assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', [], SIN_FERIADOS), 6);
    // Unas horas a favor de contrato ocupan su día, también en planta: dos licencias no comparten un día
    assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', [horasAFavor(103, '2026-12-10')], CON_LA_PRECARGA), 4);
    // Unas vacaciones del 09 al 10 y otra que empieza antes del rango y lo toca el 03: quedan el 04 y el 11
    assert.equal(diasLibresEntre('2026-12-03', '2026-12-11',
      [vacaciones(100, '2026-12-09', '2026-12-10'), vacaciones(101, '2026-11-30', '2026-12-03')], CON_LA_PRECARGA), 2);
    // Una franquicia de 2 horas también ocupa su día
    assert.equal(diasLibresEntre('2026-12-11', '2026-12-11', [franquicia(104, '2026-12-11', 2)], CON_LA_PRECARGA), 0);
    // Un día hábil libre, un fin de semana y un feriado de la tabla
    assert.equal(diasLibresEntre('2026-12-11', '2026-12-11', [], CON_LA_PRECARGA), 1);
    assert.equal(diasLibresEntre('2026-12-05', '2026-12-06', [], CON_LA_PRECARGA), 0);
    assert.equal(diasLibresEntre('2026-12-07', '2026-12-07', [], CON_LA_PRECARGA), 0);
  });

  it('diasLibresEntre: hasta antes que desde, fechas que no son fechas, ocupadas o feriados raros', () => {
    assert.equal(diasLibresEntre('2026-12-11', '2026-12-03', [], SIN_FERIADOS), 0);
    for (const valor of [undefined, null, '', 'x', 0, NaN, {}, [], '2026-02-30', new Date('2026-12-03T12:00:00Z')]) {
      assert.equal(diasLibresEntre(valor, '2026-12-11', [], SIN_FERIADOS), 0, String(valor));
      assert.equal(diasLibresEntre('2026-12-03', valor, [], SIN_FERIADOS), 0, String(valor));
      // Unas ocupadas que no son una lista, o filas que no son licencias con fechas, no ocupan nada
      assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', valor, SIN_FERIADOS), 6, String(valor));
      const raras = [valor, { desde: valor, hasta: '2026-12-10' }];
      assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', raras, SIN_FERIADOS), 6, String(valor));
      // Unos feriados que no son un Set no sacan ningún día
      assert.equal(diasLibresEntre('2026-12-03', '2026-12-11', [], valor), 6, String(valor));
    }
  });

  it('diasLibresDelMes: el mes entero, también los días que ya pasaron (spec 2026-10-28, 3.7 y 7.2)', () => {
    // Diciembre de 2026: 21 días hábiles con los 9 fijos (el 08 y el 25) y 20 con la precarga (el 07)
    assert.equal(diasLibresDelMes('2026-12', [], SIN_FERIADOS), 21);
    assert.equal(diasLibresDelMes('2026-12', [], CON_LA_PRECARGA), 20);
    // Unas vacaciones que tapan todo el mes no dejan ninguno; desde el 02/12, queda el martes 01/12
    assert.equal(diasLibresDelMes('2026-12', [vacaciones(100, '2026-12-01', '2026-12-31')], SIN_FERIADOS), 0);
    assert.equal(diasLibresDelMes('2026-12', [vacaciones(100, '2026-12-02', '2026-12-31')], SIN_FERIADOS), 1);
    // Unas horas a favor de contrato o una franquicia de 2 horas también ocupan su día
    const tapado = [vacaciones(100, '2026-12-02', '2026-12-31')];
    assert.equal(diasLibresDelMes('2026-12', [...tapado, horasAFavor(101, '2026-12-01')], SIN_FERIADOS), 0);
    assert.equal(diasLibresDelMes('2026-12', [...tapado, franquicia(101, '2026-12-01', 2)], SIN_FERIADOS), 0);
    // Hasta el último día del mes: el 29/02 en un año bisiesto
    assert.equal(diasLibresDelMes('2028-02', [vacaciones(100, '2028-02-01', '2028-02-28')], SIN_FERIADOS), 1);
    // Lo que no es un mes, 0
    for (const valor of [undefined, null, '', 'x', '2026-13', '2026-12-01', 2026, {}, []]) {
      assert.equal(diasLibresDelMes(valor, [], SIN_FERIADOS), 0, String(valor));
    }
  });

  it('franquiciaQueVence: con 22 horas y 4 días libres hasta el 31/12, no se pierde nada', () => {
    assert.deepEqual(queVence(CON_22), { quedan: 22, perdidas: 0, disponibles: 22 });
  });

  it('franquiciaQueVence: con 2 días libres entran 14 horas y se pierden 8', () => {
    assert.deepEqual(queVence(conLicencias(CON_22, vacaciones(100, '2026-12-28', '2026-12-29'))),
      { quedan: 22, perdidas: 8, disponibles: 14 });
  });

  it('franquiciaQueVence: sin ningún día libre se pierden las 22', () => {
    assert.deepEqual(queVence(conLicencias(CON_22, vacaciones(100, '2026-12-28', '2026-12-31'))),
      { quedan: 22, perdidas: 22, disponibles: 0 });
  });

  it('franquiciaQueVence: una franquicia cargada descuenta sus horas y ocupa su día', () => {
    // 3 horas el 28/12: quedan 19, con 3 días libres (21 horas): no se pierde nada
    assert.deepEqual(queVence(conLicencias(CON_22, franquicia(100, '2026-12-28', 3))),
      { quedan: 19, perdidas: 0, disponibles: 19 });
    // 7 horas el 28/12 y vacaciones el 29 y el 30: quedan 15, con un solo día libre
    const conSiete = conLicencias(CON_22, franquicia(100, '2026-12-28', 7), vacaciones(101, '2026-12-29', '2026-12-30'));
    assert.deepEqual(queVence(conSiete), { quedan: 15, perdidas: 8, disponibles: 7 });
    // Lo que se pasa del tope no da una cantidad negativa
    const pasada = {
      ...CON_22, saldos: CON_22.saldos.map((saldo) => (saldo.concepto === 'franquicias' ? { ...saldo, cantidad: 42 } : saldo))
    };
    assert.deepEqual(queVence(conLicencias(pasada, franquicia(100, '2026-12-28', 3))),
      { quedan: 0, perdidas: 0, disponibles: 0 });
  });

  it('las perdidas son las de la cuenta con todos los días libres hasta el 31/12, día por día', () => {
    // Quedan 15 (con 7 cargadas el 22/12): hacen falta 3 días libres; el 29/12 hay justo 3, y desde el 30/12, menos
    const estado = conLicencias(CON_22, vacaciones(100, '2026-12-14', '2026-12-18'), franquicia(101, '2026-12-22', 7));
    const perdidasPorDia = [];
    for (let hoy = '2026-11-20'; hoy <= '2026-12-31'; hoy = sumarDias(hoy, 1)) {
      const { quedan, perdidas, disponibles } = queVence(estado, hoy);
      const libres = diasLibresEntre(hoy, '2026-12-31', estado.licencias, SIN_FERIADOS);
      assert.equal(perdidas, Math.max(0, quedan - JORNADA * libres), hoy);
      assert.equal(disponibles, quedan - perdidas, hoy);
      if (perdidas > 0) perdidasPorDia.push([hoy, perdidas]);
    }
    assert.deepEqual(perdidasPorDia, [['2026-12-30', 1], ['2026-12-31', 8]]);
  });

  it('calcular suma la franquicia, con las mismas ocupadas que el reparto: una licencia de la otra modalidad ocupa su día', () => {
    // Las vacaciones del 28 y el 29 y unas horas a favor de contrato el 31: queda libre solo el 30
    const estado = conLicencias(CON_22, vacaciones(100, '2026-12-28', '2026-12-29'), horasAFavor(103, '2026-12-31'));
    assert.equal(fueraDeLaModalidad(estado.licencias.at(-1), 'planta'), true);
    const calculo = calcular(estado, { hoy: FIN_DE_ANIO, feriados: SIN_FERIADOS });
    assert.deepEqual(calculo.franquicia, { quedan: 22, perdidas: 15, disponibles: 7 });
    assert.deepEqual(calculo.franquicia, queVence(estado));
    // Con los feriados de la tabla: desde el viernes 04/12 y con vacaciones del 09/12 al 31/12, quedan libres el 04 y el lunes
    // 07 (el 08 es fijo); con la precarga, el 07 no es laborable y queda uno solo
    const diciembre = conLicencias(CON_22, vacaciones(100, '2026-12-09', '2026-12-31'));
    assert.deepEqual(calcular(diciembre, { hoy: '2026-12-04', feriados: SIN_FERIADOS }).franquicia,
      { quedan: 22, perdidas: 8, disponibles: 14 });
    assert.deepEqual(calcular(diciembre, { hoy: '2026-12-04', feriados: CON_LA_PRECARGA }).franquicia,
      { quedan: 22, perdidas: 15, disponibles: 7 });
  });

  it('el año de hoy: el 1/1 cuenta la franquicia del año nuevo, entera', () => {
    assert.deepEqual(queVence(CON_22, '2027-01-04'), { quedan: 42, perdidas: 0, disponibles: 42 });
    // Lo cargado en 2027 no descuenta de la de 2026
    assert.deepEqual(queVence(conLicencias(CON_22, franquicia(100, '2027-01-05', 7))),
      { quedan: 22, perdidas: 0, disponibles: 22 });
  });

  it('en contrato, sin modalidad o sin un hoy válido, null', () => {
    assert.equal(queVence(CONTRATO.estado, HOY), null);
    assert.equal(calcular(CONTRATO.estado, A_HOY).franquicia, null);
    assert.equal(queVence({ ...CON_22, modalidad: null }), null);
    assert.equal(calcular({ ...CON_22, modalidad: null }, A_HOY).franquicia, null);
    assert.equal(franquiciaQueVence(CON_22, calcular(CON_22, A_HOY), { feriados: SIN_FERIADOS }), null);
    assert.equal(calcular(CON_22, { feriados: SIN_FERIADOS }).franquicia, null);
  });

  it('sin el cálculo o sin las ocupadas, lo de lo cargado', () => {
    const estado = conLicencias(CON_22, vacaciones(100, '2026-12-28', '2026-12-29'));
    const opciones = { hoy: FIN_DE_ANIO, feriados: SIN_FERIADOS };
    assert.deepEqual(franquiciaQueVence(estado, null, opciones), queVence(estado));
    assert.deepEqual(franquiciaQueVence(estado, calcular(estado, opciones), opciones), queVence(estado));
  });

  it('nada tira', () => {
    for (const valor of [undefined, null, '', 'x', 0, -3, NaN, {}, [], new Date('2026-12-28T12:00:00Z')]) {
      assert.doesNotThrow(() => {
        franquiciaQueVence(valor, valor, valor);
        franquiciaQueVence(CON_22, valor, { hoy: FIN_DE_ANIO, feriados: valor, ocupadas: valor });
        franquiciaQueVence({ ...CON_22, saldos: valor, licencias: [valor] }, { topes: [valor] }, { hoy: FIN_DE_ANIO });
        diasLibresEntre(valor, valor, valor, valor);
      }, String(valor));
    }
  });
});

describe('lo que una carga hace perder o reacomoda (spec 2026-10-28, 3.2 y 3.4)', () => {
  // Con la precarga de los feriados (el 07/12/2026 no es laborable y el 08/12 y el 25/12 son de los 9 fijos)
  const FERIADOS = feriadosDelRango(FILAS_PRECARGA, '2024-01-01', '2028-12-31');
  const evaluar = (estado, entrada, hoy, editadaId) => evaluarLicencia(estado, entrada, { hoy, feriados: FERIADOS, editadaId });
  const avisosDe = (estado, entrada, hoy, editadaId) => evaluar(estado, entrada, hoy, editadaId).vista.avisos;
  const pedido = (tipo, desde, hasta) => ({ tipo, desde, hasta });
  const MEDIADOS_DE_DICIEMBRE = '2026-12-15';
  // Las 42 horas de franquicia de 2026, ya usadas: así la carga no hace perder horas de franquicia
  const franquiciaUsada = { concepto: 'franquicias', anio: 2026, cantidad: 42 };
  // La persona inventada de la spec (3.2), de planta: solo 3 días de la 2024 (la 2026, 20 días: la segunda mitad se habilita
  // el 1/1/2027), 2 días de atención médica usados en 2026 y, de entrada, la franquicia ya usada y sin horas extras
  const conTres = (cambios = {}) => ({
    modalidad: 'planta', arranque: '2026-10-27', anios: [{ anio: 2026, dias_vacaciones: 20, estudios: null }],
    saldos: [...saldosDeVacaciones({ 2024: 3, 2025: 0, 2026: 0 }), { concepto: 'medica', anio: 2026, cantidad: 2 },
      franquiciaUsada],
    licencias: [], horasExtras: [], salidas: [], ...cambios
  });

  it('una atención médica que tapa los días que quedaban: «Con esta licencia perdés …», y se guarda igual', () => {
    const { datos, error, vista } = evaluar(conTres(), pedido('medica', '2026-12-15', '2026-12-31'), MEDIADOS_DE_DICIEMBRE);
    assert.equal(error, null);
    assert.notEqual(datos, null);
    assert.equal(vista.texto_dias, '12 días hábiles de 17 corridos');
    assert.equal(vista.queda_texto, 'Te quedan 11 de 25.');
    assert.deepEqual(vista.avisos, ['Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).']);
    // Con un día libre antes del 31/12 (el jueves 31), nada se pierde
    assert.deepEqual(avisosDe(conTres(), pedido('medica', '2026-12-15', '2026-12-30'), MEDIADOS_DE_DICIEMBRE), []);
    // Lo que ya se perdía no se vuelve a decir: solo lo que esta carga hace perder
    const yaPerdidos = conTres({ licencias: [{ id: 100, ...pedido('medica', '2026-12-15', '2026-12-31'), horas: null }] });
    assert.deepEqual(avisosDe(yaPerdidos, pedido('familiar', '2027-01-04', '2027-01-05'), MEDIADOS_DE_DICIEMBRE), []);
  });

  it('dos licencias que se pierden van juntas; con 1, «vence»', () => {
    // 3 de la 2024 y 5 de la 2025: una extraordinaria hasta el 31/12/2027 tapa los días libres de las dos
    const conDos = conTres({ saldos: [...saldosDeVacaciones({ 2024: 3, 2025: 5, 2026: 0 }), franquiciaUsada] });
    assert.deepEqual(avisosDe(conDos, pedido('medica_extraordinaria', '2026-12-15', '2027-12-31'), MEDIADOS_DE_DICIEMBRE), [
      'Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026) y 5 de la 2025 (vencen el 31/12/2027).'
    ]);
    const conUno = conTres({ saldos: [...saldosDeVacaciones({ 2024: 1, 2025: 0, 2026: 0 }), franquiciaUsada] });
    assert.deepEqual(avisosDe(conUno, pedido('familiar', '2026-12-15', '2026-12-31'), MEDIADOS_DE_DICIEMBRE),
      ['Con esta licencia perdés 1 de la 2024 (vence el 31/12/2026).']);
  });

  it('en el modal de vacaciones no va: el reparto ya dice «Perdés …» con el total', () => {
    // 5 de la 2024 y una atención médica del 18/12 al 31/12: unas vacaciones del 15/12 al 17/12 usan 3 y pierden 2
    const estado = conTres({
      saldos: [...saldosDeVacaciones({ 2024: 5, 2025: 0, 2026: 0 }), franquiciaUsada],
      licencias: [{ id: 100, ...pedido('medica', '2026-12-18', '2026-12-31'), horas: null }]
    });
    const { error, vista } = evaluar(estado, pedido('vacaciones', '2026-12-15', '2026-12-17'), MEDIADOS_DE_DICIEMBRE);
    assert.equal(error, null);
    assert.ok(vista.texto_reparto.endsWith('Perdés 2 de la 2024 (vencen el 31/12/2026).'), vista.texto_reparto);
    assert.deepEqual(vista.avisos, []);
    // Los mismos días como atención del grupo familiar: no usan la 2024, que se pierde entera
    assert.deepEqual(avisosDe(estado, pedido('familiar', '2026-12-15', '2026-12-17'), MEDIADOS_DE_DICIEMBRE),
      ['Con esta licencia perdés 5 de la 2024 (vencen el 31/12/2026).']);
  });

  it('el franco de un mes que se queda sin días libres, con el último día del mes', () => {
    // La persona de planta de la spec (punto 1), hoy el 28/10/2026: 10,5 horas extras en octubre dan un franco para diciembre
    const HOY_DE_LA_CARGA = '2026-10-28';
    const octubre = (horasExtras) => ({ ...soloVacaciones('2026-10-27', PERSONA), horasExtras });
    const unFranco = octubre([extra(100, '2026-10-06', '18:00', '21:30'), extra(101, '2026-10-14', '17:00', '21:00'),
      extra(102, '2026-10-22', '19:00', '22:00')]);
    assert.deepEqual(avisosDe(unFranco, pedido('vacaciones', '2026-12-01', '2026-12-31'), HOY_DE_LA_CARGA),
      ['Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.']);
    // Con el 31/12 libre, el franco todavía entra
    assert.deepEqual(avisosDe(unFranco, pedido('vacaciones', '2026-12-01', '2026-12-30'), HOY_DE_LA_CARGA), []);
    // 14 horas dan dos francos
    const dosFrancos = octubre([extra(100, '2026-10-06', '14:00', '21:00'), extra(101, '2026-10-13', '14:00', '21:00')]);
    assert.deepEqual(avisosDe(dosFrancos, pedido('vacaciones', '2026-12-01', '2026-12-31'), HOY_DE_LA_CARGA),
      ['Tus 2 francos de diciembre se quedan sin días libres: vencen el 31/12/2026.']);
  });

  it('… el mes entero cuenta, también los días que ya pasaron; y si ya no tenía días libres, no se dice', () => {
    // Hoy el 15/12: del 01/12 al 14/12 hay días libres, porque un franco se puede registrar después
    const estado = conTres({ horasExtras: [extra(100, '2026-10-06', '14:00', '21:00')] });
    assert.deepEqual(avisosDe(estado, pedido('medica', '2026-12-15', '2026-12-31'), MEDIADOS_DE_DICIEMBRE),
      ['Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).']);
    // Con todo diciembre tapado de antes, el franco ya no tenía días libres: otra carga no lo dice
    const tapado = conTres({
      horasExtras: [extra(100, '2026-10-06', '14:00', '21:00')],
      licencias: [{ id: 101, ...pedido('medica_extraordinaria', '2026-12-01', '2026-12-31'), horas: null }]
    });
    assert.deepEqual(avisosDe(tapado, pedido('familiar', '2027-01-04', '2027-01-05'), MEDIADOS_DE_DICIEMBRE), []);
  });

  it('… y el franco que la carga usa no se queda sin días: lo que queda es lo que avisa', () => {
    // Dos francos para diciembre y todo el mes tapado menos el 31/12: cargar un franco ese día deja el otro sin días (sin días
    // de la 2024, que también se perderían)
    const estado = conTres({
      saldos: [...saldosDeVacaciones({ 2024: 0, 2025: 0, 2026: 0 }), franquiciaUsada],
      horasExtras: [extra(100, '2026-10-06', '14:00', '21:00'), extra(101, '2026-10-13', '14:00', '21:00')],
      licencias: [{ id: 102, ...pedido('medica_extraordinaria', '2026-12-01', '2026-12-30'), horas: null }]
    });
    assert.deepEqual(avisosDe(estado, { tipo: 'franco', desde: '2026-12-31' }, MEDIADOS_DE_DICIEMBRE),
      ['Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.']);
    // Con un solo franco, cargarlo el 31/12 lo usa: no queda nada sin días
    const unoSolo = { ...estado, horasExtras: [extra(100, '2026-10-06', '14:00', '21:00')] };
    assert.deepEqual(avisosDe(unoSolo, { tipo: 'franco', desde: '2026-12-31' }, MEDIADOS_DE_DICIEMBRE), []);
  });

  it('las horas a favor de un mes que se quedan sin días libres (contrato)', () => {
    // Una persona inventada de contrato con 3 horas extras en noviembre (dos salidas a las 16:30): 3 horas a favor en diciembre
    const estado = {
      ...CONTRATO.estado, arranque: '2026-10-28', anios: [{ anio: 2026, dias_vacaciones: 10, estudios: null }],
      saldos: saldosDeVacaciones({ 2024: 0, 2025: 7, 2026: 5 }), licencias: [],
      salidas: [salida(100, '2026-11-03', '16:30'), salida(101, '2026-11-04', '16:30')]
    };
    assert.deepEqual(avisosDe(estado, pedido('medica_extraordinaria', '2026-12-01', '2026-12-31'), '2026-12-01'),
      ['Tus 3 horas a favor de diciembre se quedan sin días libres: vencen el 31/12/2026.']);
    assert.deepEqual(avisosDe(estado, pedido('medica_extraordinaria', '2026-12-01', '2026-12-30'), '2026-12-01'), []);
  });

  it('las horas de franquicia que la carga hace perder', () => {
    // Sin la franquicia usada: quedan las 42 horas, y del 15/12 al 31/12 no queda ningún día libre
    const estado = conTres({ saldos: saldosDeVacaciones({ 2024: 0, 2025: 0, 2026: 0 }) });
    assert.deepEqual(avisosDe(estado, pedido('medica', '2026-12-15', '2026-12-31'), MEDIADOS_DE_DICIEMBRE),
      ['Con esta licencia perdés 42 horas de franquicia (vencen el 31/12/2026).']);
    // Con tres días libres (21 horas), la diferencia: 21
    assert.deepEqual(avisosDe(estado, pedido('medica', '2026-12-15', '2026-12-28'), MEDIADOS_DE_DICIEMBRE),
      ['Con esta licencia perdés 21 horas de franquicia (vencen el 31/12/2026).']);
  });

  it('cada aviso en su orden: las vacaciones, el franco, la franquicia y las otras cargas', () => {
    // Planta, hoy el 15/12: 3 de la 2024 y 5 de la 2025, un franco para diciembre (10,5 horas extras en octubre) y las 42
    // horas de franquicia. Unas vacaciones del 01/12 al 04/12 (3 de la 2024 y 1 de la 2025) y otras del 04/01 al 08/01/2027
    // (4 de la 2025 y 1 de la 2026) pasan a ser una atención médica de todo diciembre
    const estado = conTres({
      saldos: saldosDeVacaciones({ 2024: 3, 2025: 5, 2026: 0 }),
      horasExtras: [extra(100, '2026-10-06', '18:00', '21:30'), extra(101, '2026-10-14', '17:00', '21:00'),
        extra(102, '2026-10-22', '19:00', '22:00')],
      licencias: [vacaciones(200, '2026-12-01', '2026-12-04'), vacaciones(201, '2027-01-04', '2027-01-08')]
    });
    const { datos, error, vista } = evaluar(estado, pedido('medica', '2026-12-01', '2026-12-31'), MEDIADOS_DE_DICIEMBRE, 200);
    assert.equal(error, null);
    assert.notEqual(datos, null);
    assert.deepEqual(vista.avisos, [
      'Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).',
      'Tu franco de diciembre se queda sin días libres: vence el 31/12/2026.',
      'Con esta licencia perdés 42 horas de franquicia (vencen el 31/12/2026).',
      'Esta carga cambia de dónde salen tus vacaciones del 04/01 al 08/01/2027: ahora de la licencia 2025.'
    ]);
  });

  describe('las otras cargas que se reacomodan (3.4)', () => {
    // La persona inventada de contrato de la spec 3.3, hoy el 28/10/2026: 0 de la 2024, 7 de la 2025 y 5 de la 2026 en el
    // saldo, 10 días por año (la otra mitad de la 2026 se habilita el 1/1/2027 y la primera de la 2027, el 1/7/2027)
    const HOY_DE_LA_CARGA = '2026-10-28';
    const deContrato = (...licencias) => ({
      ...CONTRATO.estado, arranque: HOY_DE_LA_CARGA, anios: [{ anio: 2026, dias_vacaciones: 10, estudios: null }],
      saldos: saldosDeVacaciones({ 2024: 0, 2025: 7, 2026: 5 }), licencias
    });
    // Enero, 15 días hábiles (7 de la 2025 y 8 de la 2026), y julio, 5 (los 2 que quedan de la 2026 y 3 de la 2027)
    const ENERO = vacaciones(100, '2027-01-04', '2027-01-22');
    const JULIO = vacaciones(101, '2027-07-01', '2027-07-07');
    const ENERO_Y_JULIO = deContrato(JULIO, ENERO);

    it('una carga de diciembre les cambia de dónde salen a enero y a julio: una oración por cada una, en el orden de sus fechas',
      () => {
        const { datos, error, vista } = evaluar(ENERO_Y_JULIO, pedido('vacaciones', '2026-12-28', '2026-12-29'),
          HOY_DE_LA_CARGA);
        assert.equal(error, null);
        assert.notEqual(datos, null);
        assert.deepEqual(vista.avisos, [
          'Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de las licencias 2025 (5 días) y '
            + '2026 (10 días).',
          'Esta carga cambia de dónde salen tus vacaciones del 01/07 al 07/07/2027: ahora de la licencia 2027.'
        ]);
      });

    it('una carga que no les cambia nada no dice nada', () => {
      // Del 01/12/2027, después de las dos: salen de lo que queda
      assert.deepEqual(avisosDe(ENERO_Y_JULIO, pedido('vacaciones', '2027-12-01', '2027-12-02'), HOY_DE_LA_CARGA), []);
      // Al corregir una sin cambiarle nada, tampoco (también con el id como texto, como llega en un pedido)
      assert.deepEqual(avisosDe(ENERO_Y_JULIO, pedido('vacaciones', '2027-01-04', '2027-01-22'), HOY_DE_LA_CARGA, 100), []);
      assert.deepEqual(avisosDe(ENERO_Y_JULIO, pedido('vacaciones', '2027-01-04', '2027-01-22'), HOY_DE_LA_CARGA, '100'), []);
    });

    it('al corregir, la propia nunca se nombra: solo las otras', () => {
      // Enero un día más corta: le deja un día de la 2026 a julio
      const esperado = ['Esta carga cambia de dónde salen tus vacaciones del 01/07 al 07/07/2027: ahora de las licencias 2026 '
        + '(3 días) y 2027 (2 días).'];
      assert.deepEqual(avisosDe(ENERO_Y_JULIO, pedido('vacaciones', '2027-01-04', '2027-01-21'), HOY_DE_LA_CARGA, 100), esperado);
      assert.deepEqual(avisosDe(ENERO_Y_JULIO, pedido('vacaciones', '2027-01-04', '2027-01-21'), HOY_DE_LA_CARGA, '100'),
        esperado);
    });

    it('con un error de días, ningún aviso: la carga no se guarda', () => {
      // Las de diciembre van antes en el orden y a las de enero les faltan días (spec 3.3)
      const { datos, error, vista } = evaluar(deContrato(ENERO), pedido('vacaciones', '2026-12-14', '2026-12-18'),
        HOY_DE_LA_CARGA);
      assert.equal(datos, null);
      assert.equal(error.campo, 'hasta');
      assert.deepEqual(vista.avisos, []);
    });

    it('nada tira con entradas raras', () => {
      for (const valor of [undefined, null, '', 'x', 0, -3, 2.5, NaN, {}, [], new Date('2026-10-26T12:00:00Z')]) {
        assert.doesNotThrow(() => {
          const { vista } = evaluar(ENERO_Y_JULIO, pedido('vacaciones', '2026-12-28', '2026-12-29'), HOY_DE_LA_CARGA, valor);
          assert.ok(vista === null || Array.isArray(vista.avisos), String(valor));
          evaluarLicencia(ENERO_Y_JULIO, pedido('vacaciones', '2026-12-28', '2026-12-29'),
            { hoy: HOY_DE_LA_CARGA, feriados: valor });
          evaluarLicencia({ ...ENERO_Y_JULIO, licencias: [valor, ...ENERO_Y_JULIO.licencias] },
            pedido('vacaciones', '2026-12-28', '2026-12-29'), { hoy: HOY_DE_LA_CARGA, feriados: FERIADOS });
        }, String(valor));
      }
    });
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
    assert.equal(vacio.porFecha.size, 0);
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
        textoHastaDondeAlcanza(valor);
        textoSinNingunDia(valor, valor);
        textoSinNingunDia(valor, { fecha: valor, anio: valor, dias: valor });
        textoFaltanEnOtraCarga(valor, valor, valor);
        textoTope(valor, valor, valor);
        textoSinFranco(valor);
        textoSinHorasAFavor(valor, valor);
        textoSinNoUtilizadas(valor, valor, valor);
        textoHorarioSuperpuesto(valor, valor, valor);
        textoSaldo(valor);
        textoSaldoDelArranque(valor, valor);
        textoSaldoDeLosDias(valor, valor);
        textoSaldoSinDias(valor);
        textoDeLasMitades(2026, 20, valor);
        textoDeLasMitades(2026, 20, { arranque: valor });
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
        validarSaldoInicial({ saldos: { 'vacaciones-2025': 99 } },
          [{ clave: 'vacaciones-2025', maximo: 20, paso: 1, ayuda: valor }]);
        validarAnio(valor, valor, valor);
        validarAnio(2026, { dias_vacaciones: valor, estudios: valor }, HOY);
        fueraDeLaModalidad(valor, valor);
        fueraDeLaModalidad({ tipo: 'uso_autorizado', horas: valor }, 'planta');
        calcular(valor, valor);
        calcular(PLANTA.estado, { hoy: valor, feriados: valor });
        calcular({ ...PLANTA.estado, modalidad: valor }, A_HOY);
        calcular({ ...CONTRATO.estado, licencias: [valor, ...CONTRATO.estado.licencias], saldos: [valor] }, A_HOY);
        calcular({ ...CONTRATO.estado, salidas: valor }, A_HOY);
        calcular({ ...CONTRATO.estado, salidas: [valor, { id: valor, fecha: valor, entrada: valor, salida: valor }] }, A_HOY);
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

    // Spec 2026-10-28-mi-espacio-licencia-anulada, 2.2 y 3.3: comparando las fechas de la fila con las de Configuración, también
    // si las cambió la misma persona (la que cambió otra persona sigue con su texto: ya dice las fechas)
    it('una creada con otras fechas en Configuración: para revisar, salvo que otro aviso ya lo explique', () => {
      // La fila, del 02/11 al 06/11; la de Configuración, del 03/11 al 05/11
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial, { desde: '2026-11-02', hasta: '2026-11-06' }),
        opciones), { texto: textoRevisalaEnConfiguracion('2026-11-03', '2026-11-05'), insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial, { hasta: '2026-11-04' }), opciones),
        { texto: 'En Configuración quedó del 03/11 al 05/11: revisala.', insignia: 'aviso' });
      // La de Configuración, de un día: «el 03/11» (una franquicia de 7 horas es de día entero)
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial: oficialDe(7, '2026-11-03', '2026-11-03') },
        franquicia('2026-11-04', 7, { licencia_oficial_id: 7, oficial: 'creada' }), opciones),
      { texto: 'En Configuración quedó el 03/11: revisala.', insignia: 'aviso' });
      // Que terminó en Configuración: la fila lo sigue diciendo
      const terminada = oficialDe(7, '2026-10-19', '2026-10-21');
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial: terminada }, creadaDe(terminada, { hasta: '2026-10-23' }),
        opciones), { texto: textoRevisalaEnConfiguracion('2026-10-19', '2026-10-21'), insignia: 'aviso' });
      // De quien hoy no puede tener licencia, como siempre (lo de Configuración ya no tiene efecto)
      for (const puedeTener of [false, undefined, 'true', 1]) {
        assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial, { hasta: '2026-11-06' }),
          { ...opciones, puedeTener }), { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' }, String(puedeTener));
      }
      // Una corrección que no se pudo copiar ya dice dónde quedó y por qué
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial, { hasta: '2026-11-06' }),
        { ...opciones, sinPasar: 'Se superpone con otra licencia' }), {
        texto: `${textoEnConfiguracion('2026-11-03', '2026-11-05')} ${textoNoPaso('Se superpone con otra licencia')}`,
        insignia: 'aviso'
      });
      // Una que dejó de ser de día entero ya dice que sigue en Configuración
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, franquicia('2026-11-04', 3), opciones),
        { texto: textoSigueEnConfiguracion('2026-11-03', '2026-11-05'), insignia: 'aviso' });
      // Unas fechas de la fila que no sirven no se comparan
      assert.deepEqual(textoDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial, { desde: 'x' }), opciones),
        { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' });
    });

    it('administración la cambió; anulada en Configuración, sin decir quién', () => {
      assert.deepEqual(textoDelVinculo({ estado: 'creada_cambiada', oficial }, filaDe(), opciones),
        { texto: `${textoEnConfiguracion('2026-11-03', '2026-11-05')} ${TEXTO_NO_SE_COPIA}`, insignia: 'aviso' });
      assert.deepEqual(textoDelVinculo({ estado: 'creada_anulada', oficial: { ...oficial, anulada: 1 } }, filaDe(), opciones),
        { texto: TEXTO_ANULADA_EN_CONFIGURACION, insignia: 'aviso' });
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

  // Lo que el Resumen avisa para revisar (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1, 3.2 y 3.3): solo lo que
  // todavía se puede resolver. Hoy es el lunes 26/10/2026
  describe('revisionDelVinculo', () => {
    const opciones = { hoy: HOY, sinPasar: null, puedeTener: true };
    // El día anterior a HOY: el borde de «termina hoy», que todavía se resuelve
    const AYER = '2026-10-25';
    // La de Configuración, del 02/11 al 04/11; la fila, del 02/11 al 06/11
    const oficial = oficialDe(7, '2026-11-02', '2026-11-04');
    const conOtroHasta = creadaDe(oficial, { hasta: '2026-11-06' });

    it('una creada con otras fechas en Configuración: con las de Configuración, la cambie quien la cambie', () => {
      const fechas = { motivo: 'fechas', desde: '2026-11-02', hasta: '2026-11-04' };
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta, opciones), fechas);
      assert.deepEqual(revisionDelVinculo({ estado: 'creada_cambiada', oficial }, conOtroHasta, opciones), fechas);
      // Otro desde
      const corrida = oficialDe(7, '2026-11-03', '2026-11-06');
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial: corrida }, creadaDe(corrida, { desde: '2026-11-02' }),
        opciones), { motivo: 'fechas', desde: '2026-11-03', hasta: '2026-11-06' });
      // La de Configuración termina hoy: todavía se resuelve
      const terminaHoy = oficialDe(7, '2026-10-20', HOY);
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial: terminaHoy }, creadaDe(terminaHoy, { hasta: '2026-10-28' }),
        opciones), { motivo: 'fechas', desde: '2026-10-20', hasta: HOY });
      // La de Mi espacio ya terminó, pero la de Configuración no: corregir la fila a sus fechas lo resuelve
      const sigue = oficialDe(7, '2026-10-19', '2026-10-28');
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial: sigue }, creadaDe(sigue, { hasta: '2026-10-23' }), opciones),
        { motivo: 'fechas', desde: '2026-10-19', hasta: '2026-10-28' });
      // Una franquicia de 7 horas es de día entero
      const unDia = oficialDe(7, '2026-11-03', '2026-11-03');
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial: unDia }, franquicia('2026-11-04', 7,
        { licencia_oficial_id: 7, oficial: 'creada' }), opciones), { motivo: 'fechas', desde: '2026-11-03', hasta: '2026-11-03' });
    });

    it('una creada: nada, con las mismas fechas o si otro aviso de la fila ya lo explica', () => {
      assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, creadaDe(oficial), opciones), null);
      assert.equal(revisionDelVinculo({ estado: 'creada_cambiada', oficial }, creadaDe(oficial), opciones), null);
      // Con el motivo de una corrección que no se pudo copiar
      assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta,
        { ...opciones, sinPasar: 'Se superpone con otra licencia' }), null);
      // Uno que es solo espacios no es un motivo
      assert.deepEqual(revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta, { ...opciones, sinPasar: '  ' }),
        { motivo: 'fechas', desde: '2026-11-02', hasta: '2026-11-04' });
      // Una que dejó de ser de día entero (queda en Configuración con sus fechas: no se podría resolver)
      assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, franquicia('2026-11-03', 3), opciones), null);
      // De quien hoy no puede tener licencia
      for (const puedeTener of [false, undefined, 'true', 1]) {
        assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta, { ...opciones, puedeTener }), null,
          String(puedeTener));
      }
      // La de Configuración ya terminó: las fechas de una creada quedan fijas (Review Focus 4)
      const terminada = oficialDe(7, '2026-10-19', '2026-10-23');
      assert.equal(revisionDelVinculo({ estado: 'creada', oficial: terminada }, creadaDe(terminada, { hasta: '2026-10-28' }),
        opciones), null);
      assert.equal(revisionDelVinculo({ estado: 'creada_cambiada', oficial: terminada },
        creadaDe(terminada, { hasta: '2026-10-21' }), opciones), null);
      // La de Configuración terminó ayer, aunque la de Mi espacio siga: tampoco
      const terminoAyer = oficialDe(7, '2026-10-19', AYER);
      for (const estado of ['creada', 'creada_cambiada']) {
        assert.equal(revisionDelVinculo({ estado, oficial: terminoAyer }, creadaDe(terminoAyer, { hasta: '2026-10-28' }),
          opciones), null, estado);
      }
    });

    it('una creada anulada de antes, mientras la de Mi espacio no terminó', () => {
      const anulada = { ...oficial, anulada: 1 };
      const vinculo = vinculoDe(creadaDe(oficial), anulada, false);
      assert.equal(vinculo.estado, 'creada_anulada');
      const paraRevisar = { motivo: 'anulada', desde: null, hasta: null };
      assert.deepEqual(revisionDelVinculo(vinculo, creadaDe(oficial), opciones), paraRevisar);
      // La que termina hoy, también
      assert.deepEqual(revisionDelVinculo(vinculo, creadaDe(oficial, { desde: '2026-10-19', hasta: HOY }), opciones), paraRevisar);
      // Ni el motivo ni el rol la cambian: sigue contando hasta que la persona la borre
      assert.deepEqual(revisionDelVinculo(vinculo, creadaDe(oficial), { ...opciones, sinPasar: 'Otro motivo', puedeTener: false }),
        paraRevisar);
      // La que ya terminó, no (Review Focus 4), tampoco la que terminó ayer
      assert.equal(revisionDelVinculo(vinculo, creadaDe(oficial, { desde: '2026-10-19', hasta: '2026-10-23' }), opciones), null);
      assert.equal(revisionDelVinculo(vinculo, creadaDe(oficial, { desde: '2026-10-19', hasta: AYER }), opciones), null);
    });

    it('una unida sin cubrir, mientras la de Mi espacio no terminó, con los días fuera', () => {
      const larga = oficialDe(12, '2026-11-02', '2026-11-13');
      const acortada = oficialDe(12, '2026-11-02', '2026-11-04');
      const fila = unidaDe(larga);
      const vinculo = vinculoDe(fila, acortada, false);
      assert.equal(vinculo.estado, 'unida_sin_cubrir');
      assert.deepEqual(revisionDelVinculo(vinculo, fila, opciones), { motivo: 'sin_cubrir', desde: '2026-11-05', hasta: '2026-11-06' });
      // Anulada: toda la fila
      assert.deepEqual(revisionDelVinculo(vinculoDe(fila, { ...larga, anulada: 1 }, true), fila, opciones),
        { motivo: 'sin_cubrir', desde: '2026-11-02', hasta: '2026-11-06' });
      // La que termina hoy, sí; la que ya terminó, no
      const deHoy = unidaDe(larga, { desde: '2026-10-22', hasta: HOY });
      const sinCubrirHoy = vinculoDe(deHoy, oficialDe(12, '2026-10-19', '2026-10-23'), false);
      assert.deepEqual(revisionDelVinculo(sinCubrirHoy, deHoy, opciones), { motivo: 'sin_cubrir', desde: '2026-10-24', hasta: HOY });
      const pasada = unidaDe(larga, { desde: '2026-10-19', hasta: '2026-10-23' });
      assert.equal(revisionDelVinculo(vinculoDe(pasada, oficialDe(12, '2026-10-19', '2026-10-20'), false), pasada, opciones), null);
      // La que terminó ayer, tampoco (sigue sin cubrir: es por la fecha)
      const deAyer = unidaDe(larga, { desde: '2026-10-19', hasta: AYER });
      const sinCubrirAyer = vinculoDe(deAyer, oficialDe(12, '2026-10-19', '2026-10-20'), false);
      assert.deepEqual(sinCubrirAyer.sin_cubrir, { desde: '2026-10-21', hasta: AYER });
      assert.equal(revisionDelVinculo(sinCubrirAyer, deAyer, opciones), null);
      // Sin los días fuera, no
      assert.equal(revisionDelVinculo({ ...vinculo, sin_cubrir: null }, fila, opciones), null);
    });

    it('una unida cubierta y sin vínculo, nada', () => {
      const larga = oficialDe(12, '2026-11-02', '2026-11-13');
      assert.equal(revisionDelVinculo(vinculoDe(unidaDe(larga), larga, false), unidaDe(larga), opciones), null);
      assert.equal(revisionDelVinculo({ estado: 'ninguno', oficial: null }, filaDe(), opciones), null);
      assert.equal(revisionDelVinculo({ estado: 'ninguno', oficial: null }, filaDe(),
        { ...opciones, sinPasar: textoSuperpuestaConConfiguracion('2026-11-03', '2026-11-05') }), null);
      assert.equal(revisionDelVinculo({ estado: 'otro', oficial }, conOtroHasta, opciones), null);
    });

    it('sin un hoy que sirva, nada; y nunca tira', () => {
      const anulada = { ...oficial, anulada: 1 };
      for (const hoy of [undefined, null, '', '2026-02-30', 20261026, new Date('2026-10-26T12:00:00Z')]) {
        assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta, { ...opciones, hoy }), null, String(hoy));
        assert.equal(revisionDelVinculo({ estado: 'creada_anulada', oficial: anulada }, creadaDe(oficial), { ...opciones, hoy }),
          null, String(hoy));
      }
      const raros = [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
      for (const valor of raros) {
        assert.doesNotThrow(() => {
          assert.equal(revisionDelVinculo(valor, valor, valor), null);
          assert.equal(revisionDelVinculo({ estado: 'creada', oficial: valor }, conOtroHasta, opciones), null);
          assert.equal(revisionDelVinculo({ estado: 'creada', oficial }, valor, opciones), null);
          assert.equal(revisionDelVinculo({ estado: 'creada_anulada', oficial: anulada }, valor, opciones), null);
          assert.equal(revisionDelVinculo({ estado: 'unida_sin_cubrir', oficial, sin_cubrir: valor }, filaDe(), opciones), null);
          revisionDelVinculo({ estado: 'creada', oficial }, conOtroHasta, valor);
        }, String(valor));
      }
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

    it('con la tabla (spec 2026-10-27-feriados-en-notas, 4): los feriados de Configuración → Feriados tampoco son hábiles', () => {
      // El lunes 07/12 no es laborable y el martes 08/12 es feriado: desde el miércoles 09/12, el jueves 03/12
      assert.equal(limiteParaCambiarTipo('2026-12-09', CAL), '2026-12-03');
      // El lunes 08/02 y el martes 09/02/2027 son Carnaval: desde el miércoles 10/02, el jueves 04/02
      assert.equal(limiteParaCambiarTipo('2027-02-10', CAL), '2027-02-04');
      for (const raro of [null, undefined, '', '2026-02-30', 3, {}]) assert.equal(limiteParaCambiarTipo(raro, CAL), null);
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
        puede_borrar: false, solo_hasta: false, fechas_fijas: true, en_configuracion: { licencia_id: 7, autorizado_id: null },
        revision: null
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

    it('los días restituidos dejan persona a cargo, como las vacaciones (spec 2026-10-31-mi-espacio-dias-restituidos, 7)', () => {
      // Desde el lunes 02/11, con persona a cargo: el límite para cambiar el tipo es el jueves 29/10
      const oficial = oficialDe(7, '2026-11-02', '2026-11-06', { autorizado_id: 3 });
      const vinculo = { estado: 'creada', oficial };
      const despuesDelLimite = { personaACargo: true, hoy: '2026-10-30' };
      const deVacaciones = creadaDe(oficial);
      const deRestituidos = creadaDe(oficial, { tipo: 'restituidos' });
      // Siguen con su tipo: no pierden la persona, cualquier día
      assert.deepEqual(correccion(deVacaciones, { ...deVacaciones, nota: 'x' }, vinculo, despuesDelLimite), { accion: 'nada' });
      assert.deepEqual(correccion(deRestituidos, { ...deRestituidos, nota: 'x' }, vinculo, despuesDelLimite), { accion: 'nada' });
      // A un tipo que no deja persona a cargo, la pierden, como las vacaciones
      const aMedica = { ...deRestituidos, tipo: 'medica' };
      assert.deepEqual(correccion(deRestituidos, aMedica, vinculo, despuesDelLimite),
        { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } });
      assert.deepEqual(correccion(deRestituidos, aMedica, vinculo, { ...despuesDelLimite, hoy: '2026-10-29' }),
        { accion: 'cambiar', sin_persona_a_cargo: true });
    });

    it('con la tabla, el límite cuenta los feriados de Configuración → Feriados (spec 2026-10-27-feriados-en-notas, 4)', () => {
      // Unas vacaciones desde el miércoles 09/12 con persona a cargo, que pasan a una médica el viernes 04/12
      const oficial = oficialDe(7, '2026-12-09', '2026-12-18', { autorizado_id: 3 });
      const anterior = creadaDe(oficial);
      const vinculo = { estado: 'creada', oficial };
      const aMedica = { ...anterior, tipo: 'medica' };
      const elViernes = { personaACargo: true, hoy: '2026-12-04' };
      // Con la tabla, el lunes 07/12 no es hábil: el límite es el jueves 03/12, y el 04/12 ya sale la nota de la víspera
      assert.deepEqual(correccion(anterior, aMedica, vinculo, { ...elViernes, calendario: CAL }),
        { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } });
      assert.deepEqual(correccion(anterior, aMedica, vinculo, { ...elViernes, hoy: '2026-12-03', calendario: CAL }),
        { accion: 'cambiar', sin_persona_a_cargo: true });
      // Sin el calendario, los 9 fijos: el límite es el viernes 04/12, inclusive
      assert.deepEqual(correccion(anterior, aMedica, vinculo, elViernes), { accion: 'cambiar', sin_persona_a_cargo: true });
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
        configuracion: creada, puede_borrar: true, solo_hasta: false, fechas_fijas: false, en_configuracion: enConfiguracion(7),
        revision: null
      });
      assert.deepEqual(vinculos.get(2), {
        configuracion: creada, puede_borrar: false, solo_hasta: true, fechas_fijas: false, en_configuracion: enConfiguracion(8),
        revision: null
      });
      assert.deepEqual(vinculos.get(3), {
        configuracion: creada, puede_borrar: false, solo_hasta: false, fechas_fijas: true, en_configuracion: enConfiguracion(9),
        revision: null
      });
      assert.deepEqual(vinculos.get(4), {
        configuracion: { texto: TEXTO_NO_DIA_ENTERO, insignia: 'aviso' }, puede_borrar: true, solo_hasta: false,
        fechas_fijas: false, en_configuracion: null, revision: null
      });
      // Sin nada para decir, no está
      assert.equal(vinculos.has(5), false);
      // Una que administración cambió: ya no se corrige en Configuración desde acá, sin en_configuracion; quedó con otro hasta,
      // así que el Resumen avisa para revisar
      assert.deepEqual(vinculos.get(6), {
        configuracion: { texto: `${textoEnConfiguracion('2026-11-23', '2026-11-25')} ${TEXTO_NO_SE_COPIA}`, insignia: 'aviso' },
        puede_borrar: true, solo_hasta: false, fechas_fijas: false, en_configuracion: null,
        revision: { motivo: 'fechas', desde: '2026-11-23', hasta: '2026-11-25' }
      });
      // La que empieza hoy: el desde queda fijo, pero todavía se borra
      assert.deepEqual(vinculos.get(7), {
        configuracion: creada, puede_borrar: true, solo_hasta: true, fechas_fijas: false, en_configuracion: enConfiguracion(11),
        revision: null
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

    // Spec 2026-10-28-mi-espacio-licencia-anulada (2.2, 3.1, 3.2 y 3.3): lo que la fila dice siempre y lo que el Resumen avisa
    // mientras se pueda resolver (Review Focus 4)
    it('cada una con lo que hay para revisar, con el hoy de las opciones', () => {
      const cambiada = oficialDe(7, '2026-11-02', '2026-11-04');
      const deOtro = oficialDe(8, '2026-11-09', '2026-11-12');
      const anulada = oficialDe(9, '2026-11-16', '2026-11-20', { anulada: 1 });
      const anuladaTerminada = oficialDe(10, '2026-10-19', '2026-10-23', { anulada: 1 });
      const acortada = oficialDe(11, '2026-11-23', '2026-11-24');
      const terminada = oficialDe(12, '2026-10-12', '2026-10-14');
      const acortadaTerminada = oficialDe(13, '2026-10-05', '2026-10-06');
      const filas = [
        creadaDe(cambiada, { id: 1, hasta: '2026-11-06' }),
        creadaDe(deOtro, { id: 2, hasta: '2026-11-13' }),
        creadaDe(anulada, { id: 3 }),
        creadaDe(anuladaTerminada, { id: 4 }),
        unidaDe(acortada, { id: 5, desde: '2026-11-23', hasta: '2026-11-26' }),
        creadaDe(terminada, { id: 6, hasta: '2026-10-16' }),
        unidaDe(acortadaTerminada, { id: 7, desde: '2026-10-05', hasta: '2026-10-09' }),
        creadaDe(oficialDe(14, '2026-11-30', '2026-12-04'), { id: 8 })
      ];
      const oficiales = new Map([cambiada, deOtro, anulada, anuladaTerminada, acortada, terminada, acortadaTerminada,
        oficialDe(14, '2026-11-30', '2026-12-04')].map((oficial) => [oficial.id, oficial]));
      const opciones = { oficiales, tocadas: new Set([8]), hoy: HOY, puedeTener: true };
      const vinculos = vinculosDeLaLista(filas, opciones);
      const deCada = (id) => [vinculos.get(id).configuracion, vinculos.get(id).revision];
      const aviso = (texto) => ({ texto, insignia: 'aviso' });

      assert.deepEqual(deCada(1), [aviso(textoRevisalaEnConfiguracion('2026-11-02', '2026-11-04')),
        { motivo: 'fechas', desde: '2026-11-02', hasta: '2026-11-04' }]);
      assert.deepEqual(deCada(2), [aviso(`${textoEnConfiguracion('2026-11-09', '2026-11-12')} ${TEXTO_NO_SE_COPIA}`),
        { motivo: 'fechas', desde: '2026-11-09', hasta: '2026-11-12' }]);
      assert.deepEqual(deCada(3), [aviso(TEXTO_ANULADA_EN_CONFIGURACION), { motivo: 'anulada', desde: null, hasta: null }]);
      assert.deepEqual(deCada(5), [aviso(textoYaNoCubierta('2026-11-25', '2026-11-26')),
        { motivo: 'sin_cubrir', desde: '2026-11-25', hasta: '2026-11-26' }]);
      // Lo que ya no se puede resolver: la fila lo dice, el Resumen no
      assert.deepEqual(deCada(4), [aviso(TEXTO_ANULADA_EN_CONFIGURACION), null]);
      assert.deepEqual(deCada(6), [aviso(textoRevisalaEnConfiguracion('2026-10-12', '2026-10-14')), null]);
      assert.deepEqual(deCada(7), [aviso(textoYaNoCubierta('2026-10-07', '2026-10-09')), null]);
      // Con las mismas fechas, nada para revisar
      assert.deepEqual(deCada(8), [{ texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' }, null]);

      // Sin un hoy que sirva, nada para revisar (los textos de la fila no dependen de hoy)
      const sinHoy = vinculosDeLaLista(filas, { ...opciones, hoy: undefined });
      assert.deepEqual([...sinHoy.values()].map((vinculo) => vinculo.revision), filas.map(() => null));
      assert.deepEqual([...sinHoy.values()].map((vinculo) => vinculo.configuracion),
        [...vinculos.values()].map((vinculo) => vinculo.configuracion));
      // De quien hoy no puede tener licencia, las fechas cambiadas no se avisan; lo anulado y lo sin cubrir, sí
      const sinRol = vinculosDeLaLista(filas, { ...opciones, puedeTener: false });
      assert.deepEqual([1, 2, 3, 5].map((id) => sinRol.get(id).revision?.motivo ?? null), [null, null, 'anulada', 'sin_cubrir']);
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
        firmante: {
          soy_titular: true, puede_autorizar: true, vispera: '2026-10-30', sin_anticipo: false, sin_dias_habiles: false,
          notas_de_hoy: false
        },
        sin_pasar_previsto: null
      });
      const hoyMismo = previsto({
        soyTitular: true, notasDeHoy: true, fila: filaDe({ tipo: 'medica', desde: HOY, hasta: '2026-10-28' })
      });
      assert.deepEqual(hoyMismo.avisos, [AVISO_DEL_PASO, AVISO_NOTAS_DE_HOY, AVISO_SIN_PERSONA_A_CARGO]);
      assert.deepEqual(hoyMismo.firmante, {
        soy_titular: true, puede_autorizar: false, vispera: '2026-10-23', sin_anticipo: false, sin_dias_habiles: false,
        notas_de_hoy: true
      });
    });

    it('al firmante titular, los días restituidos son vacaciones: dejan persona a cargo (spec 2026-10-31-mi-espacio-dias-restituidos, 7)',
      () => {
        const restituidos = filaDe({ tipo: 'restituidos' });
        const deRestituidos = previsto({ soyTitular: true, fila: restituidos });
        assert.deepEqual(deRestituidos, previsto({ soyTitular: true }));
        assert.deepEqual(deRestituidos.avisos, [AVISO_DEL_PASO]);
        assert.equal(deRestituidos.firmante.puede_autorizar, true);
        // Pasan a Configuración como cualquier ausencia de día entero
        assert.equal(previsto({ fila: restituidos }).pasa, true);
      });

    it('al firmante titular: la víspera con la tabla, sin anticipo y las notas de hoy (spec 2026-10-27-feriados-en-notas, 4)', () => {
      const marcas = ({ vispera, sin_anticipo: sinAnticipo, sin_dias_habiles: sinDiasHabiles }) => [vispera, sinAnticipo, sinDiasHabiles];
      const delNueve = filaDe({ desde: '2026-12-09', hasta: '2026-12-18' });
      // Con la tabla, el lunes 07/12 no es laborable y el martes 08/12 es feriado: la víspera es el viernes 04/12
      assert.deepEqual(marcas(previsto({ soyTitular: true, fila: delNueve, calendario: CAL }).firmante),
        ['2026-12-04', false, false]);
      // Con los 9 fijos (sin el calendario), el lunes 07/12
      assert.deepEqual(marcas(previsto({ soyTitular: true, fila: delNueve }).firmante), ['2026-12-07', false, false]);
      // Si otra licencia suya incluye ese viernes, empieza a continuación de ella: sin anticipo
      const delTitular = [{ id: 9, desde: '2026-11-30', hasta: '2026-12-04', anulada: 0, autorizado_id: null }];
      assert.deepEqual(marcas(previsto({ soyTitular: true, fila: delNueve, calendario: CAL, delTitular }).firmante),
        [null, true, false]);
      // Una anulada no cuenta
      assert.deepEqual(marcas(previsto({
        soyTitular: true, fila: delNueve, calendario: CAL, delTitular: [{ ...delTitular[0], anulada: 1 }]
      }).firmante), ['2026-12-04', false, false]);
      // Una sin días hábiles (el 07/12 y el 08/12): la forma de Configuración, aunque desde Mi espacio no se pueda cargar
      assert.deepEqual(marcas(previsto({
        soyTitular: true, fila: filaDe({ desde: '2026-12-07', hasta: '2026-12-08' }), calendario: CAL
      }).firmante), [null, false, true]);

      // «Las notas de hoy ya salieron…» solo si hoy salieron notas con su firma, y notas_de_hoy lo sigue
      const deHoy = filaDe({ desde: HOY, hasta: '2026-10-30' });
      for (const notasDeHoy of [true, false, undefined, 1, 'true']) {
        const conNotas = notasDeHoy === true;
        const resultado = previsto({ soyTitular: true, fila: deHoy, notasDeHoy });
        assert.equal(resultado.avisos.includes(AVISO_NOTAS_DE_HOY), conNotas, String(notasDeHoy));
        assert.equal(resultado.firmante.notas_de_hoy, conNotas, String(notasDeHoy));
      }
      // Una que empieza después de hoy, nunca
      const futura = previsto({ soyTitular: true, notasDeHoy: true });
      assert.deepEqual([futura.avisos.includes(AVISO_NOTAS_DE_HOY), futura.firmante.notas_de_hoy], [false, false]);
      // A quien no es el titular, tampoco
      assert.deepEqual(previsto({ fila: deHoy, notasDeHoy: true }).avisos, [AVISO_DEL_PASO]);
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
        pasoPrevistoDe({
          paso: { accion: 'crear' }, fila: filaDe(), rol: 'admin', hoy: HOY, soyTitular: true, delTitular: valor, notasDeHoy: valor
        });
        pasoPrevistoDe({ paso: { accion: 'crear' }, fila: filaDe(), rol: 'admin', hoy: HOY, soyTitular: true, delTitular: [valor] });
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

// El nombre de los compañeros (spec 2026-10-28-mi-espacio-agenda-onda, 5.1): el primer nombre; si otra persona de la
// administración activa tiene el mismo, con la inicial del último apellido; si aun así se repite, el nombre completo
describe('nombreCorto', () => {
  const ADMIN = [
    { id: 1, nombre: 'Andrea Paula Molina' }, { id: 4, nombre: 'Julián Esteban Ferreyra' },
    { id: 2, nombre: 'Carla Inés Benítez' }
  ];
  const CON_OTRA = [...ADMIN, { id: 9, nombre: 'Carla Ríos' }];
  const MISMA_INICIAL = [...ADMIN, { id: 9, nombre: 'Carla Bustos' }];

  it('el primer nombre, si nadie más de la administración lo tiene (ella misma no cuenta)', () => {
    assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, ADMIN), 'Carla');
    assert.equal(nombreCorto({ id: 1, nombre: 'Andrea Paula Molina' }, CON_OTRA), 'Andrea');
  });

  it('con otra del mismo nombre, la inicial del último apellido; con la misma inicial, el nombre completo', () => {
    assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, CON_OTRA), 'Carla B.');
    assert.equal(nombreCorto({ id: 9, nombre: 'Carla Ríos' }, CON_OTRA), 'Carla R.');
    assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, MISMA_INICIAL), 'Carla Inés Benítez');
    assert.equal(nombreCorto({ id: 9, nombre: 'Carla Bustos' }, MISMA_INICIAL), 'Carla Bustos');
  });

  it('sin tildes ni mayúsculas: «Matías» y «matias» son el mismo primer nombre, y «Benítez» y «benitez», la misma inicial',
    () => {
      assert.equal(nombreCorto({ id: 5, nombre: 'Matías Paz' }, [{ id: 5, nombre: 'Matías Paz' }, { id: 6, nombre: 'matias Sosa' }]),
        'Matías P.');
      assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, [...ADMIN, { id: 9, nombre: 'carla benitez' }]),
        'Carla Inés Benítez');
    });

  it('quien no está en la lista (dejó de ser administración) se compara contra la lista', () => {
    assert.equal(nombreCorto({ id: 7, nombre: 'Carla Vera' }, CON_OTRA), 'Carla V.');
    assert.equal(nombreCorto({ id: 7, nombre: 'Tomás Quiroga' }, ADMIN), 'Tomás');
  });

  it('los espacios de más no cuentan; sin un nombre, \'\'; sin una lista, el primer nombre', () => {
    assert.equal(nombreCorto({ id: 2, nombre: '  Carla   Inés  Benítez ' }, ADMIN), 'Carla');
    assert.equal(nombreCorto({ id: 2, nombre: '  Carla   Inés  Benítez ' }, MISMA_INICIAL), 'Carla Inés Benítez');
    assert.equal(nombreCorto({ id: 2, nombre: null }, ADMIN), '');
    assert.equal(nombreCorto({ id: 2, nombre: '   ' }, ADMIN), '');
    assert.equal(nombreCorto(null, ADMIN), '');
    assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, null), 'Carla');
    // Una sola palabra es todo el nombre: no hay un apellido del que sacar la inicial
    assert.equal(nombreCorto({ id: 7, nombre: 'Carla' }, CON_OTRA), 'Carla');
  });

  it('nada tira, tampoco con personas raras en la lista', () => {
    const raros = [undefined, null, '', 'x', 0, NaN, {}, [], new Date('2026-10-26T12:00:00Z')];
    for (const valor of raros) {
      assert.doesNotThrow(() => {
        nombreCorto(valor, valor);
        nombreCorto({ id: valor, nombre: valor }, [valor, { id: valor, nombre: valor }, ...ADMIN]);
        nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, [valor, { id: 9, nombre: valor }]);
      }, String(valor));
    }
    assert.equal(nombreCorto({ id: 2, nombre: 'Carla Inés Benítez' }, [null, 'x', { id: 9, nombre: 3 }, ...ADMIN]), 'Carla');
  });
});

// El email de vencimiento (spec, sección 9): lo que está en su tramo. El franco o las horas a favor del mes de hoy, desde 5
// días hábiles antes del último día hábil del mes hasta ese día; los días de la licencia que vence el 31/12, desde el primer
// día hábil de diciembre. En octubre de 2026 el último día hábil es el viernes 30/10 y el tramo arranca el viernes 23/10
describe('avisosDeVencimiento', () => {
  // Como la corrida: con todas las licencias del estado como ocupadas (services/miEspacioAvisos.js)
  const avisos = (caso, hoy, feriados = SIN_FERIADOS, estado = caso.estado) =>
    avisosDeVencimiento(calcular(estado, { hoy, feriados }),
      { hoy, feriados, modalidad: estado.modalidad, ocupadas: estado.licencias });
  const FRANCO_DE_OCTUBRE = {
    clave: 'franco-2026-10',
    texto: 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.'
  };
  const LICENCIA_2024 = { clave: 'licencia-2024', texto: 'Tenés 3 días de la licencia 2024: vence el 31/12/2026.' };
  // Las 42 horas de franquicia de PLANTA menos las 17 del saldo inicial (spec 2026-10-28, 3.6)
  const FRANQUICIA_2026 = { clave: 'franquicia-2026', texto: 'Tenés 25 horas de franquicia: vencen el 31/12/2026.' };

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
    // Con la franquicia antes (spec 2026-10-28, 3.6)
    assert.deepEqual(avisos(PLANTA, '2026-12-01'), [FRANQUICIA_2026, LICENCIA_2024]);
    // El 23/12 entra también el franco de diciembre (el 25/12 es feriado: el tramo va del 23/12 al jueves 31/12), primero
    assert.deepEqual(avisos(PLANTA, '2026-12-23'), [
      { clave: 'franco-2026-12', texto: 'Tenés 1 franco compensatorio para usar en diciembre: el último día hábil es el jueves 31/12.' },
      FRANQUICIA_2026,
      LICENCIA_2024
    ]);
    assert.deepEqual(avisos(PLANTA, '2026-12-31').map((aviso) => aviso.clave),
      ['franco-2026-12', 'franquicia-2026', 'licencia-2024']);
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
      [FRANQUICIA_2026, { clave: 'licencia-2024', texto: 'Tenés 1 día de la licencia 2024: vence el 31/12/2026.' }]);
  });

  it('solo lo que queda: sin disponibles, o de la otra modalidad, nada', () => {
    // El franco de octubre usado (dos francos cargados en octubre)
    const usado = conLicencias(PLANTA.estado, { id: 100, tipo: 'franco', desde: '2026-10-27', hasta: '2026-10-27', horas: null });
    assert.deepEqual(avisos(PLANTA, '2026-10-26', SIN_FERIADOS, usado), []);
    // Las vacaciones de la 2024 cargadas en diciembre ya no se avisan
    const cargadas = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-14', '2026-12-16'));
    assert.deepEqual(avisos(PLANTA, '2026-12-01', SIN_FERIADOS, cargadas), [FRANQUICIA_2026]);
    // Con otra modalidad, el franco no se avisa
    const hoy = '2026-10-26';
    assert.deepEqual(avisosDeVencimiento(calcular(PLANTA.estado, { hoy, feriados: SIN_FERIADOS }),
      { hoy, feriados: SIN_FERIADOS, modalidad: 'contrato' }), []);
  });

  describe('las horas de franquicia (spec 2026-10-28, 3.6)', () => {
    // PLANTA con otro saldo inicial de franquicias (17 en el caso), y más licencias si hacen falta
    const conSaldo = (horas, ...licencias) => conLicencias({
      ...PLANTA.estado,
      saldos: PLANTA.estado.saldos.map((saldo) => (saldo.concepto === 'franquicias' ? { ...saldo, cantidad: horas } : saldo))
    }, ...licencias);
    const franquicias = (hoy, estado, feriados = SIN_FERIADOS) => avisos(PLANTA, hoy, feriados, estado)
      .filter((aviso) => aviso.clave.startsWith('franquicia-'));
    const conHoras = (horas) => ({
      clave: 'franquicia-2026', texto: `Tenés ${horas} horas de franquicia: vencen el 31/12/2026.`
    });

    it('desde el primer día hábil de diciembre hasta el 31/12: el 01/12 sí; el 30/11 y el 01/01, no', () => {
      assert.deepEqual(franquicias('2026-11-30', conSaldo(20)), []);
      assert.deepEqual(franquicias('2026-12-01', conSaldo(20)), [conHoras(22)]);
      assert.deepEqual(franquicias('2026-12-31', conSaldo(20)).map((aviso) => aviso.clave), ['franquicia-2026']);
      // El 1/1 es la del año nuevo, que todavía no se avisa
      assert.deepEqual(avisos(PLANTA, '2027-01-01', SIN_FERIADOS, conSaldo(20)), []);
      // Con el martes 01/12 feriado, el primer día hábil es el miércoles 02/12
      const conElPrimero = new Set(['2026-12-01']);
      assert.deepEqual(franquicias('2026-12-01', conSaldo(20), conElPrimero), []);
      assert.deepEqual(avisos(PLANTA, '2026-12-02', conElPrimero, conSaldo(20)).map((aviso) => aviso.clave),
        ['franquicia-2026', 'licencia-2024']);
    });

    it('lo que queda, con «hora» y «vence» en singular solo con 1', () => {
      assert.deepEqual(franquicias('2026-12-01', conSaldo(41)),
        [{ clave: 'franquicia-2026', texto: 'Tenés 1 hora de franquicia: vence el 31/12/2026.' }]);
      assert.deepEqual(franquicias('2026-12-01', conSaldo(41.5)), [conHoras('0,5')]);
      // Una franquicia cargada en diciembre descuenta sus horas
      const delCatorce = { id: 100, tipo: 'franquicia', desde: '2026-12-14', hasta: '2026-12-14', horas: 7 };
      assert.deepEqual(franquicias('2026-12-01', conSaldo(20, delCatorce)), [conHoras(15)]);
    });

    it('solo lo que todavía se puede usar: sin las horas que se pierden, y nada con disponibles en 0', () => {
      // El lunes 28/12 con vacaciones el 28 y el 29: de las 22, entran 14 en el 30 y el 31
      assert.deepEqual(franquicias('2026-12-28', conSaldo(20, vacaciones(100, '2026-12-28', '2026-12-29'))), [conHoras(14)]);
      // Sin ningún día libre hasta el 31/12, todas se pierden: no se avisa
      assert.deepEqual(franquicias('2026-12-28', conSaldo(20, vacaciones(100, '2026-12-28', '2026-12-31'))), []);
      // Sin horas que queden, tampoco
      assert.deepEqual(franquicias('2026-12-01', conSaldo(42)), []);
    });

    it('en contrato, o con un cálculo de planta y la modalidad de contrato, nunca', () => {
      assert.deepEqual(avisos(CONTRATO, '2026-12-01').filter((aviso) => aviso.clave.startsWith('franquicia-')), []);
      const hoy = '2026-12-01';
      assert.equal(avisosDeVencimiento(calcular(PLANTA.estado, { hoy, feriados: SIN_FERIADOS }),
        { hoy, feriados: SIN_FERIADOS, modalidad: 'contrato' }).some((aviso) => aviso.clave.startsWith('franquicia-')), false);
    });
  });

  describe('el franco o las horas a favor sin ningún día libre en su mes (spec 2026-10-28, 3.7)', () => {
    const FRANCO_DE_DICIEMBRE = {
      clave: 'franco-2026-12',
      texto: 'Tenés 1 franco compensatorio para usar en diciembre: el último día hábil es el jueves 31/12.'
    };
    const claves = (lista) => lista.map((aviso) => aviso.clave);

    it('el 23/12, con vacaciones que tapan todo diciembre, el email no nombra el franco', () => {
      const estado = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-01', '2026-12-31'));
      assert.equal(claves(avisos(PLANTA, '2026-12-23', SIN_FERIADOS, estado)).includes('franco-2026-12'), false);
      // Sin esas vacaciones, sí
      assert.deepEqual(avisos(PLANTA, '2026-12-23')[0], FRANCO_DE_DICIEMBRE);
    });

    it('un día libre del mes que ya pasó alcanza: un franco tomado se puede registrar después', () => {
      // El martes 01/12 quedó libre
      const estado = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-02', '2026-12-31'));
      assert.deepEqual(avisos(PLANTA, '2026-12-23', SIN_FERIADOS, estado)[0], FRANCO_DE_DICIEMBRE);
    });

    it('ese día libre no cuenta si es feriado o lo ocupa otra licencia, de cualquier tipo y de cualquier modalidad', () => {
      const tapado = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-02', '2026-12-31'));
      assert.equal(claves(avisos(PLANTA, '2026-12-23', new Set(['2026-12-01']), tapado)).includes('franco-2026-12'), false);
      // Una franquicia de 2 horas
      const conFranquicia = conLicencias(tapado,
        { id: 101, tipo: 'franquicia', desde: '2026-12-01', hasta: '2026-12-01', horas: 2 });
      assert.equal(claves(avisos(PLANTA, '2026-12-23', SIN_FERIADOS, conFranquicia)).includes('franco-2026-12'), false);
      // Unas horas a favor, que en planta no cuentan pero ocupan su día
      const deContrato = conLicencias(tapado,
        { id: 101, tipo: 'horas_a_favor', desde: '2026-12-01', hasta: '2026-12-01', horas: 2 });
      assert.equal(claves(avisos(PLANTA, '2026-12-23', SIN_FERIADOS, deContrato)).includes('franco-2026-12'), false);
    });

    it('las horas a favor de contrato, igual', () => {
      // Las 4 horas de la salida del 21/10, para usar en noviembre. El tramo va del lunes 23/11 al lunes 30/11
      const HORAS_DE_NOVIEMBRE = {
        clave: 'horas-2026-11', texto: 'Tenés 4 horas a favor para usar en noviembre: el último día hábil es el lunes 30/11.'
      };
      assert.deepEqual(avisos(CONTRATO, '2026-11-23'), [HORAS_DE_NOVIEMBRE]);
      const tapado = conLicencias(CONTRATO.estado, vacaciones(100, '2026-11-02', '2026-11-30'));
      assert.deepEqual(avisos(CONTRATO, '2026-11-23', SIN_FERIADOS, tapado), []);
      // Con el lunes 02/11 libre, sí
      const conUnDia = conLicencias(CONTRATO.estado, vacaciones(100, '2026-11-03', '2026-11-30'));
      assert.deepEqual(avisos(CONTRATO, '2026-11-23', SIN_FERIADOS, conUnDia), [HORAS_DE_NOVIEMBRE]);
    });

    it('sin las ocupadas, ninguna licencia ocupa un día', () => {
      const estado = conLicencias(PLANTA.estado, vacaciones(100, '2026-12-01', '2026-12-31'));
      const hoy = '2026-12-23';
      const calculo = calcular(estado, { hoy, feriados: SIN_FERIADOS });
      for (const ocupadas of [undefined, null, 'x', {}]) {
        assert.deepEqual(avisosDeVencimiento(calculo, { hoy, feriados: SIN_FERIADOS, modalidad: 'planta', ocupadas })[0],
          FRANCO_DE_DICIEMBRE, String(ocupadas));
      }
    });
  });

  it('los días de la licencia 2024 que se pierden no se avisan (spec 2026-10-27, punto 2.5)', () => {
    const hoy = '2026-12-01';
    const delDia = (...filas) => avisosDeVencimiento(calcular(soloVacaciones('2026-10-26', PERSONA, ...filas),
      { hoy, feriados: SIN_FERIADOS }), { hoy, feriados: SIN_FERIADOS, modalidad: 'planta' });
    // La que cruza el año deja 2 de la 2024 sin ningún día libre antes del 31/12
    assert.equal(delDia(vacaciones(100, '2026-12-21', '2027-01-10')).some((aviso) => aviso.clave === 'licencia-2024'), false);
    // Del 14/12 al 18/12 quedan 10, con días libres para usarlos
    assert.deepEqual(delDia(vacaciones(100, '2026-12-14', '2026-12-18')).filter((aviso) => aviso.clave === 'licencia-2024'),
      [{ clave: 'licencia-2024', texto: 'Tenés 10 días de la licencia 2024: vence el 31/12/2026.' }]);
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
