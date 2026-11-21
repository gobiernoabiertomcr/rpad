// El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 5, 6 y 10): cuándo sale cada edición, qué decide
// una corrida, el estado de la edición, la línea del detalle, la pastilla de la tarjeta, el envío del recibo, el texto de cada
// persona, el resumen de administración, las próximas ediciones y el modelo del mail. Puro: sin base ni Date local; hoy, ahora y
// el calendario (el de la precarga de feriados de 2026 y 2027) llegan por parámetro. Las personas y los textos son inventados.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_DE_VIGENCIA, MAXIMO_DE_INTENTOS, HORA_DE_LA_MANANA, HORA_DE_LA_TARDE, CADENCIA, PRIMERA_EDICION, MENSAJES_CORREO,
  estaVigente, envioAlLlegar, decidirCorrida, proximaSalida, instanteDeSalida, estadoDeLaEdicion, reenvioATodaLaLista,
  lineaDelCorreo, pastillaDelEnvio, envioDelRecibo, envioInicial, textoDeLaPersona, resumenDelCorreo, textoDelReenvio,
  sePuedeReenviar, proximasEdiciones, modeloDelMail, textoDelResultadoDelCorreo, textoDeLaCorridaDelCorreo, alertasDelCorreo,
  alertaSinEstadoDelCorreo, personasSinLlegar, listaDePersonas, aQuienReenviar, textoDeLaLicencia, textoDelEnvioAMano,
  textoDelInterruptor, textoDeLaListaGuardada, textoDeLosQueReciben, CUANTAS_EN_MI_ESPACIO, datoQuincenaEnMiEspacio
} from '../services/datoQuincenaCorreoReglas.js';
import { detalleDeLaEdicion, NOMBRE_DEL_BOT } from '../services/datoQuincenaReglas.js';
import { datoQuincenaTemplate } from '../services/emailTemplates.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { FILAS_PRECARGA } from './fixtures/feriados-precarga.js';
import {
  edicionDePrueba, pilotoDePrueba, efemerideDePrueba, repeticionDePrueba, propuestasDatasetsDePrueba, propuestaDatasetDePrueba
} from './dato-quincena-fixtures.js';

// El calendario de la precarga: el lunes 09/11/2026 y el lunes 23/11/2026 son feriados, el 07/12 no laborable y el 08/12 fijo
const CALENDARIO = calendarioCon(FILAS_PRECARGA);
// El mismo, como lo da leerCalendario cuando la tabla no se pudo leer
const CALENDARIO_CAIDO = calendarioCon([], { origen: 'fijos', error: 'No se pudo leer la tabla de feriados.' });

// Las filas automáticas de un envío, como las lee la consulta (las horas con DATE_FORMAT, en hora argentina)
const enviado = (usuario_id, enviado_at = '2026-11-10 08:05:12') => ({ usuario_id, estado: 'enviado', intentos: 1, enviado_at });
const fallido = (usuario_id, intentos) => ({ usuario_id, estado: 'fallido', intentos, enviado_at: null });
const conEstado = (usuario_id, estado, intentos = 0) => ({ usuario_id, estado, intentos, enviado_at: null });
const reenvio = (usuario_id, enviado_at, estado = 'enviado') => ({ usuario_id, tipo: 'reenvio', estado, enviado_at });
const enLaLista = (usuario_id, agregado_at = '2026-11-01 09:00:00') => ({ usuario_id, agregado_at });

const correo = (estado, motivo = null, enviada_at = null) => ({ estado, motivo, enviada_at });
const DEL_BOT = Object.freeze({ estado: 'enviado', enviado_at: '2026-11-09T08:00:00-03:00' });

// Una hora que no se puede leer: lo que da mysql2 si una consulta olvida el DATE_FORMAT (un Date), o ninguna (null). Cambia solo
// el texto (sin la hora), nunca lo que pasó
const SIN_LEER = Object.freeze([['un Date', () => new Date(Date.UTC(2026, 10, 10, 11, 5, 12))], ['null', () => null]]);

// Los parámetros de la línea y de la pastilla: una regular del 23/11/2026 todavía sin correo, a las 7:40 de ese lunes
const base = (cambios = {}) => ({
  tipo: 'regular', fecha_edicion: '2026-11-23', correo: correo('programada'), envios: [], reenvios: [], lista: [],
  correoDelBot: null, envioActivo: true, ahora: '2026-11-23 07:40:00', calendario: CALENDARIO, ...cambios
});
// Una edición del 09/11 que salió el martes 10/11 a las 8:05
const salida = (envios, cambios = {}) => base({ fecha_edicion: '2026-11-09', ahora: '2026-11-12 10:00:00', envios, ...cambios });

const linea = (cambios) => lineaDelCorreo(base(cambios));
const pastilla = (cambios, admin = false) => pastillaDelEnvio({ ...base(cambios), admin });

// Las palabras que el sistema no usa (CLAUDE.md, «Lenguaje y nombres»)
const PROHIBIDAS = /tardanza|demora|atraso|sin respuesta|sin entregar|no mandó/i;

describe('las constantes', () => {
  it('la vigencia, los intentos, las horas de las corridas, la cadencia y la primera edición', () => {
    assert.equal(DIAS_DE_VIGENCIA, 13);
    assert.equal(MAXIMO_DE_INTENTOS, 3);
    assert.equal(HORA_DE_LA_MANANA, '08:05');
    assert.equal(HORA_DE_LA_TARDE, '14:00');
    assert.equal(CADENCIA, 14);
    assert.equal(PRIMERA_EDICION, '2026-11-09');
  });

  it('los mensajes de las rutas y de la corrida, al pie de la letra', () => {
    assert.deepEqual(MENSAJES_CORREO, {
      noExiste: 'No existe esa edición.',
      listaInvalida: 'La lista de personas no es válida.',
      aQuien: 'Elegí a quién reenviarla: a todas las personas de la lista o a una de ellas.',
      noEstaEnLaLista: 'Esa persona no está en la lista: se reenvía solo a quienes lo reciben.',
      soloRegulares: 'Solo se reenvían las ediciones regulares: a un piloto se le puede mandar una prueba.',
      sinEmailPropio: 'Tu cuenta no tiene un email válido: no se puede mandar la prueba.',
      todaviaSeManda: 'Esta edición todavía se está mandando sola: se puede reenviar cuando termine.',
      ocupado: 'Ahora se está mandando el dato de la quincena. Probá de nuevo en unos minutos.',
      prueba: 'Te mandamos la prueba a tu casilla.',
      pruebaFallida: 'No se pudo mandar la prueba a tu casilla.',
      envioInvalido: 'Elegí si el envío automático queda prendido o apagado.',
      listaVacia: 'No hay nadie en la lista: las personas se suman en la pestaña Correo.',
      envioFallido: 'No se pudo enviar el mail.',
      sinEmail: 'No tenía un email válido.',
      inactiva: 'Ya no estaba activa.'
    });
    assert.ok(Object.isFrozen(MENSAJES_CORREO));
  });

  it('ningún mensaje usa las palabras que el sistema evita', () => {
    for (const texto of Object.values(MENSAJES_CORREO)) assert.doesNotMatch(texto, PROHIBIDAS);
  });
});

describe('estaVigente: de los últimos 13 días', () => {
  it('13 días antes de hoy sí; 14, no', () => {
    assert.equal(estaVigente('2026-11-10', '2026-11-23'), true);
    assert.equal(estaVigente('2026-11-09', '2026-11-23'), false);
  });

  it('la de hoy y una de mañana, sí', () => {
    assert.equal(estaVigente('2026-11-23', '2026-11-23'), true);
    assert.equal(estaVigente('2026-11-24', '2026-11-23'), true);
  });
});

describe('envioAlLlegar: lo que queda al llegar el POST (spec, 5)', () => {
  const llegada = (cambios) => envioAlLlegar({
    tipo: 'regular', fecha_edicion: '2026-11-23', envioActivo: true, hoy: '2026-11-23', ...cambios
  });

  it('una regular de hoy con el envío prendido queda programada', () => {
    assert.deepEqual(llegada(), { estado: 'programada' });
  });

  it('con el envío apagado queda no enviada, «apagado»; solo el true literal prende', () => {
    assert.deepEqual(llegada({ envioActivo: false }), { estado: 'no_enviada', motivo: 'apagado' });
    assert.deepEqual(llegada({ envioActivo: 1 }), { estado: 'no_enviada', motivo: 'apagado' });
    assert.deepEqual(llegada({ envioActivo: 'true' }), { estado: 'no_enviada', motivo: 'apagado' });
  });

  it('una de hace 14 días queda no enviada, «vieja»; una de hace 13, programada', () => {
    assert.deepEqual(llegada({ fecha_edicion: '2026-11-09' }), { estado: 'no_enviada', motivo: 'vieja' });
    assert.deepEqual(llegada({ fecha_edicion: '2026-11-10' }), { estado: 'programada' });
  });

  it('vieja y con el envío apagado: manda el interruptor, como en la corrida', () => {
    assert.deepEqual(llegada({ fecha_edicion: '2026-11-09', envioActivo: false }), { estado: 'no_enviada', motivo: 'apagado' });
  });

  it('una de mañana (la validación la acepta) queda programada', () => {
    assert.deepEqual(llegada({ fecha_edicion: '2026-11-24' }), { estado: 'programada' });
  });

  it('un piloto no tiene envío: null', () => {
    assert.equal(llegada({ tipo: 'piloto' }), null);
    assert.equal(llegada({ tipo: 'piloto', envioActivo: false }), null);
  });
});

describe('decidirCorrida: qué manda una corrida (spec, 5 y 8)', () => {
  const corrida = (cambios) => decidirCorrida({
    programadas: [], envioActivo: true, hoy: '2026-11-24', calendario: CALENDARIO, ...cambios
  });

  it('sin programadas, nada; lo que no es una lista cuenta como ninguna', () => {
    assert.deepEqual(corrida(), { mandar: null, noEnviar: [] });
    assert.deepEqual(corrida({ programadas: null }), { mandar: null, noEnviar: [] });
    assert.deepEqual(corrida({ programadas: null, envioActivo: false }), { mandar: null, noEnviar: [] });
  });

  it('dos programadas vigentes: sale la más nueva y la otra queda «mas_nueva»', () => {
    const programadas = [{ id: 7, fecha_edicion: '2026-11-23' }, { id: 5, fecha_edicion: '2026-11-12' }];
    assert.deepEqual(corrida({ programadas }), { mandar: 7, noEnviar: [{ id: 5, motivo: 'mas_nueva' }] });
    assert.deepEqual(corrida({ programadas: [...programadas].reverse() }), { mandar: 7, noEnviar: [{ id: 5, motivo: 'mas_nueva' }] });
  });

  it('con la misma fecha (solo un SQL a mano), sale la de id más alto', () => {
    const programadas = [{ id: 8, fecha_edicion: '2026-11-23' }, { id: 9, fecha_edicion: '2026-11-23' }];
    assert.deepEqual(corrida({ programadas }), { mandar: 9, noEnviar: [{ id: 8, motivo: 'mas_nueva' }] });
  });

  it('una de hace 14 días queda «vieja» y no sale', () => {
    assert.deepEqual(corrida({ programadas: [{ id: 3, fecha_edicion: '2026-11-10' }] }), {
      mandar: null, noEnviar: [{ id: 3, motivo: 'vieja' }]
    });
  });

  it('una vieja, una vigente y una de mañana: sale la vigente, la vieja no sale y la de mañana espera', () => {
    const programadas = [
      { id: 1, fecha_edicion: '2026-11-10' }, { id: 2, fecha_edicion: '2026-11-23' }, { id: 3, fecha_edicion: '2026-11-25' }
    ];
    assert.deepEqual(corrida({ programadas }), { mandar: 2, noEnviar: [{ id: 1, motivo: 'vieja' }] });
  });

  it('la de mañana sola espera', () => {
    assert.deepEqual(corrida({ programadas: [{ id: 4, fecha_edicion: '2026-11-25' }] }), { mandar: null, noEnviar: [] });
  });

  it('apagado, un sábado: todas quedan «apagado», también la de mañana', () => {
    const programadas = [{ id: 1, fecha_edicion: '2026-11-23' }, { id: 2, fecha_edicion: '2026-11-29' }];
    assert.deepEqual(corrida({ programadas, envioActivo: false, hoy: '2026-11-28' }), {
      mandar: null, noEnviar: [{ id: 1, motivo: 'apagado' }, { id: 2, motivo: 'apagado' }]
    });
  });

  it('apagado con la tabla de feriados caída: igual quedan «apagado»', () => {
    const programadas = [{ id: 1, fecha_edicion: '2026-11-23' }];
    assert.deepEqual(corrida({ programadas, envioActivo: false, calendario: CALENDARIO_CAIDO }), {
      mandar: null, noEnviar: [{ id: 1, motivo: 'apagado' }]
    });
  });

  it('un feriado no manda nada ni marca las viejas', () => {
    const programadas = [{ id: 1, fecha_edicion: '2026-11-23' }, { id: 2, fecha_edicion: '2026-11-02' }];
    assert.deepEqual(corrida({ programadas, hoy: '2026-11-23' }), { mandar: null, noEnviar: [] });
  });

  it('con la tabla de feriados caída (calendario.error), nada: lo deja para la corrida siguiente', () => {
    assert.deepEqual(corrida({ programadas: [{ id: 1, fecha_edicion: '2026-11-23' }], calendario: CALENDARIO_CAIDO }), {
      mandar: null, noEnviar: []
    });
  });

  it('no cambia la lista que recibe', () => {
    const programadas = [{ id: 7, fecha_edicion: '2026-11-23' }, { id: 5, fecha_edicion: '2026-11-12' }];
    const antes = structuredClone(programadas);
    corrida({ programadas });
    assert.deepEqual(programadas, antes);
  });
});

describe('proximaSalida: la corrida en que sale (spec, 2 y 6)', () => {
  const sale = (fecha_edicion, ahora) => proximaSalida({ fecha_edicion, ahora, calendario: CALENDARIO });

  it('llegada el lunes 23/11 (feriado) a las 7:40: el martes a las 8:05', () => {
    assert.equal(sale('2026-11-23', '2026-11-23 07:40:00'), '2026-11-24 08:05');
  });

  it('el martes 24/11 a las 8:10: ese día a las 14:00; a las 14:30, el miércoles a las 8:05', () => {
    assert.equal(sale('2026-11-23', '2026-11-24 08:10:00'), '2026-11-24 14:00');
    assert.equal(sale('2026-11-23', '2026-11-24 14:30:00'), '2026-11-25 08:05');
  });

  it('los bordes: antes de las 8:05, a las 8:05; desde las 8:05, a las 14:00; desde las 14:00, la mañana siguiente', () => {
    assert.equal(sale('2026-11-24', '2026-11-24 08:04:59'), '2026-11-24 08:05');
    assert.equal(sale('2026-11-24', '2026-11-24 08:05:00'), '2026-11-24 14:00');
    assert.equal(sale('2026-11-24', '2026-11-24 13:59:59'), '2026-11-24 14:00');
    assert.equal(sale('2026-11-24', '2026-11-24 14:00:00'), '2026-11-25 08:05');
  });

  it('la del 07/12 llegada el 07/12: el miércoles 09/12 a las 8:05 (el 07/12 no laborable y el 08/12 fijo)', () => {
    assert.equal(sale('2026-12-07', '2026-12-07 07:30:00'), '2026-12-09 08:05');
  });

  it('nunca antes de la fecha de la edición: una de mañana, con hoy hábil a las 7:00, sale mañana a las 8:05', () => {
    assert.equal(sale('2026-11-25', '2026-11-24 07:00:00'), '2026-11-25 08:05');
    assert.equal(sale('2026-12-07', '2026-12-04 10:00:00'), '2026-12-09 08:05');
  });

  it('un viernes después de las 14:00 y un sábado: el lunes hábil a las 8:05', () => {
    assert.equal(sale('2026-11-23', '2026-11-27 15:00:00'), '2026-11-30 08:05');
    assert.equal(sale('2026-11-23', '2026-11-28 09:00:00'), '2026-11-30 08:05');
  });
});

describe('instanteDeSalida', () => {
  it('el instante con la zona de Argentina', () => {
    assert.equal(instanteDeSalida('2026-11-24 08:05'), '2026-11-24T08:05:00-03:00');
    assert.equal(instanteDeSalida('2026-11-24 14:00'), '2026-11-24T14:00:00-03:00');
  });
});

describe('estadoDeLaEdicion: de las filas automáticas (spec, 6)', () => {
  it('sin filas, null', () => {
    assert.equal(estadoDeLaEdicion([]), null);
  });

  it('todas enviadas: enviada', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), enviado(2)]), 'enviada');
  });

  it('las de licencia y las omitidas no cuentan para «enviada»', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), conEstado(2, 'licencia'), conEstado(3, 'omitido')]), 'enviada');
  });

  it('mientras alguna está pendiente o en reintento (fallido con menos de 3 intentos), null', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), conEstado(2, 'pendiente')]), null);
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 1)]), null);
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 2)]), null);
  });

  it('a alguna no le llegó después de los 3 intentos: parcial', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 3)]), 'parcial');
  });

  it('una que quedó «enviando» (sin confirmar) cuenta como parcial, aunque ninguna figure enviada', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), conEstado(2, 'enviando', 1)]), 'parcial');
    assert.equal(estadoDeLaEdicion([conEstado(1, 'enviando', 1)]), 'parcial');
  });

  it('a ninguna: fallida; también si nadie de la lista lo podía recibir', () => {
    assert.equal(estadoDeLaEdicion([fallido(1, 3), fallido(2, 3)]), 'fallida');
    assert.equal(estadoDeLaEdicion([conEstado(1, 'licencia'), conEstado(2, 'omitido')]), 'fallida');
  });

  // Ruling 9: los reintentos siguen solo mientras la edición está vigente; vencida, lo que quedaba abierto es definitivo
  it('una edición que ya no está vigente cierra: sus pendientes y sus reintentos cuentan como no le llegó', () => {
    const cerrada = { vigente: false };
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 1)], [], cerrada), 'parcial');
    assert.equal(estadoDeLaEdicion([enviado(1), conEstado(2, 'pendiente')], [], cerrada), 'parcial');
    assert.equal(estadoDeLaEdicion([fallido(1, 2), conEstado(2, 'pendiente')], [], cerrada), 'fallida');
    assert.equal(estadoDeLaEdicion([enviado(1), conEstado(2, 'licencia')], [], cerrada), 'enviada');
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 1)], [reenvio(2, '2026-12-14 10:12:30')], cerrada), 'enviada');
    assert.equal(estadoDeLaEdicion([], [], cerrada), null);
    // Sin la opción, o con otra cosa que false, como hasta ahora
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 1)], [], {}), null);
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 1)], [], { vigente: true }), null);
  });

  it('un reenvío que le llegó a quien había fallado deja de contar como falla (spec, 9)', () => {
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 3)], [reenvio(2, '2026-11-25 10:12:30')]), 'enviada');
    assert.equal(estadoDeLaEdicion([fallido(1, 3), fallido(2, 3)], [reenvio(2, '2026-11-25 10:12:30')]), 'parcial');
    assert.equal(estadoDeLaEdicion([enviado(1), fallido(2, 3)], [reenvio(2, '2026-11-25 10:12:30', 'fallido')]), 'parcial');
  });
});

describe('reenvioATodaLaLista: un reenvío que le llegó a toda la lista de ese momento (spec, 6)', () => {
  const LISTA = [enLaLista(1), enLaLista(2)];

  it('cuando los reenvíos enviados cubren a toda la lista: el momento en que la cubrieron', () => {
    const reenvios = [reenvio(2, '2026-11-25 10:12:31'), reenvio(1, '2026-11-25 10:12:30')];
    assert.deepEqual(reenvioATodaLaLista(reenvios, LISTA), { enviado_at: '2026-11-25 10:12:31' });
  });

  it('a una sola persona de dos, o con uno que falló, null', () => {
    assert.equal(reenvioATodaLaLista([reenvio(1, '2026-11-25 10:12:30')], LISTA), null);
    assert.equal(reenvioATodaLaLista([reenvio(1, '2026-11-25 10:12:30'), reenvio(2, '2026-11-25 10:12:31', 'fallido')], LISTA), null);
  });

  it('quien se sumó a la lista después del reenvío no cuenta', () => {
    const lista = [...LISTA, enLaLista(3, '2026-11-26 09:00:00')];
    const reenvios = [reenvio(1, '2026-11-25 10:12:30'), reenvio(2, '2026-11-25 10:12:31')];
    assert.deepEqual(reenvioATodaLaLista(reenvios, lista), { enviado_at: '2026-11-25 10:12:31' });
  });

  it('una persona sin la hora en que se sumó cuenta siempre', () => {
    const reenvios = [reenvio(1, '2026-11-25 10:12:30'), reenvio(2, '2026-11-25 10:12:31')];
    assert.equal(reenvioATodaLaLista(reenvios, [...LISTA, { usuario_id: 3 }]), null);
  });

  it('reenvíos con la hora sin leer: tienen que cubrir a toda la lista de hoy, y el momento queda null', () => {
    for (const [, hora] of SIN_LEER) {
      assert.deepEqual(reenvioATodaLaLista([reenvio(1, hora()), reenvio(2, hora())], LISTA), { enviado_at: null });
      assert.equal(reenvioATodaLaLista([reenvio(1, hora())], LISTA), null);
      assert.equal(reenvioATodaLaLista([reenvio(1, hora()), reenvio(2, hora())], [...LISTA, enLaLista(3, '2026-11-26 09:00:00')]), null);
    }
  });

  it('con una hora leída y otra sin leer, la cuenta usa las dos', () => {
    assert.deepEqual(reenvioATodaLaLista([reenvio(1, '2026-11-25 10:12:30'), reenvio(2, null)], LISTA), { enviado_at: null });
  });

  it('con la lista vacía, null', () => {
    assert.equal(reenvioATodaLaLista([reenvio(1, '2026-11-25 10:12:30')], []), null);
  });
});

describe('lineaDelCorreo y pastillaDelEnvio: lo que ven todos y la pastilla de la tarjeta (spec, 6)', () => {
  it('un piloto', () => {
    assert.equal(linea({ tipo: 'piloto', correo: null }), 'Los pilotos no se envían por correo.');
    assert.deepEqual(pastilla({ tipo: 'piloto', correo: null }), { tipo: 'piloto', texto: 'Piloto: no se envía' });
    assert.deepEqual(pastilla({ tipo: 'piloto', correo: null }, true), { tipo: 'piloto', texto: 'Piloto: no se envía' });
  });

  it('programada, el lunes 23/11 (feriado) a las 7:40: el martes', () => {
    assert.equal(linea(), 'Se envía el martes 24/11/2026 a las 8:05.');
    assert.deepEqual(pastilla(), { tipo: 'programada', texto: 'Sale el mar 24/11' });
    assert.deepEqual(pastilla({}, true), { tipo: 'programada', texto: 'Sale el mar 24/11' });
  });

  it('programada, un día hábil antes de las 8:05 y después', () => {
    const martes = { fecha_edicion: '2026-11-24' };
    assert.equal(linea({ ...martes, ahora: '2026-11-24 07:40:00' }), 'Se envía hoy a las 8:05.');
    assert.deepEqual(pastilla({ ...martes, ahora: '2026-11-24 07:40:00' }), { tipo: 'programada', texto: 'Sale hoy a las 8:05' });
    assert.equal(linea({ ...martes, ahora: '2026-11-24 08:10:00' }), 'Se envía hoy a las 14:00.');
    assert.deepEqual(pastilla({ ...martes, ahora: '2026-11-24 08:10:00' }), { tipo: 'programada', texto: 'Sale hoy a las 14:00' });
  });

  it('programada con el envío automático apagado: en espera', () => {
    assert.equal(linea({ envioActivo: false }), 'En espera: el envío automático está apagado.');
    assert.deepEqual(pastilla({ envioActivo: false }), { tipo: 'espera', texto: 'En espera' });
    assert.deepEqual(pastilla({ envioActivo: false }, true), { tipo: 'espera', texto: 'En espera' });
  });

  it('enviada: la hora del primer envío que salió, sin cero a la izquierda', () => {
    const p = salida([enviado(2, '2026-11-10 08:05:14'), enviado(1, '2026-11-10 08:05:12')], { correo: correo('enviada') });
    assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: false }), { tipo: 'enviada', texto: 'Enviada el mar 10/11' });
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'enviada', texto: 'Enviada el mar 10/11' });
    const tarde = salida([enviado(1, '2026-11-10 08:07:03')], { correo: correo('enviada') });
    assert.equal(lineaDelCorreo(tarde), 'Enviada por correo el martes 10/11/2026 a las 8:07.');
  });

  it('parcial: todos ven «enviada»; administración, «Enviada a 3 de 4»', () => {
    const p = salida([enviado(1), enviado(2), enviado(3), fallido(4, 3)], { correo: correo('parcial') });
    assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: false }), { tipo: 'enviada', texto: 'Enviada el mar 10/11' });
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'parcial', texto: 'Enviada a 3 de 4' });
  });

  it('parcial: M son todas las personas del envío, también las de licencia', () => {
    const p = salida([enviado(1), enviado(2), conEstado(3, 'licencia'), fallido(4, 3)], { correo: correo('parcial') });
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'parcial', texto: 'Enviada a 2 de 4' });
  });

  it('mientras quedan reintentos sigue «enviada» para todos; administración ve quiénes están en reintento', () => {
    const una = salida([enviado(1), enviado(2), enviado(3), fallido(4, 1)]);
    assert.equal(lineaDelCorreo(una), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
    assert.deepEqual(pastillaDelEnvio({ ...una, admin: false }), { tipo: 'enviada', texto: 'Enviada el mar 10/11' });
    assert.deepEqual(pastillaDelEnvio({ ...una, admin: true }), { tipo: 'parcial', texto: '1 persona en reintento' });
    const dos = salida([enviado(1), enviado(2), fallido(3, 2), fallido(4, 1)]);
    assert.deepEqual(pastillaDelEnvio({ ...dos, admin: true }), { tipo: 'parcial', texto: '2 personas en reintento' });
  });

  it('la primera corrida falló para todos: sale en la siguiente, o en espera si está apagado', () => {
    const p = base({ envios: [fallido(1, 1), fallido(2, 1)], ahora: '2026-11-24 09:00:00' });
    assert.equal(lineaDelCorreo(p), 'Se envía hoy a las 14:00.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'programada', texto: 'Sale hoy a las 14:00' });
    assert.equal(lineaDelCorreo({ ...p, envioActivo: false }), 'En espera: el envío automático está apagado.');
  });

  it('fallida', () => {
    const p = salida([fallido(1, 3), fallido(2, 3)], { correo: correo('fallida') });
    assert.equal(lineaDelCorreo(p), 'No se pudo enviar.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: false }), { tipo: 'fallida', texto: 'No se pudo enviar' });
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'fallida', texto: 'No se pudo enviar' });
  });

  it('nadie de la lista lo podía recibir (de licencia o sin email): no se envió', () => {
    const p = salida([conEstado(1, 'licencia'), conEstado(2, 'omitido')], { correo: correo('fallida') });
    assert.equal(lineaDelCorreo(p), 'No se envió: nadie de la lista estaba disponible.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'no_enviada', texto: 'No se envió' });
  });

  it('un corte dejó a todas «enviando»: sin confirmar', () => {
    const p = salida([conEstado(1, 'enviando', 1), conEstado(2, 'enviando', 1)], { correo: correo('parcial') });
    assert.equal(lineaDelCorreo(p), 'No se pudo confirmar el envío por correo.');
    assert.deepEqual(pastillaDelEnvio({ ...p, admin: false }), { tipo: 'parcial', texto: 'Sin confirmar' });
  });

  it('no enviada, con su motivo', () => {
    const casos = {
      apagado: 'No se envió: el envío automático estaba apagado.',
      vieja: 'No se envió: llegó con más de 13 días.',
      mas_nueva: 'No se envió: hay una edición más nueva.',
      sin_lista: 'No se envió: no había nadie en la lista.'
    };
    for (const [motivo, texto] of Object.entries(casos)) {
      assert.equal(linea({ correo: correo('no_enviada', motivo) }), texto);
      assert.deepEqual(pastilla({ correo: correo('no_enviada', motivo) }), { tipo: 'no_enviada', texto: 'No se envió' });
      assert.deepEqual(pastilla({ correo: correo('no_enviada', motivo) }, true), { tipo: 'no_enviada', texto: 'No se envió' });
    }
  });

  it('no enviada («apagado» o «vieja») y el bot mandó su correo: la línea del bot y su pastilla (la transición)', () => {
    for (const motivo of ['apagado', 'vieja']) {
      const cambios = { fecha_edicion: '2026-11-09', correo: correo('no_enviada', motivo), correoDelBot: DEL_BOT };
      assert.equal(linea(cambios), 'Correo enviado el 09/11/2026 a las 08:00, según Datito.');
      assert.deepEqual(pastilla(cambios), { tipo: 'enviada', texto: 'Enviada por Datito el lun 09/11' });
    }
  });

  it('no enviada por otro motivo: la línea del RPAD, aunque el bot haya mandado su correo', () => {
    const cambios = { correo: correo('no_enviada', 'mas_nueva'), correoDelBot: DEL_BOT };
    assert.equal(linea(cambios), 'No se envió: hay una edición más nueva.');
  });

  it('una edición sin envío (anterior a esta entrega): la línea del bot, con su pastilla solo si su correo salió', () => {
    const anterior = { fecha_edicion: '2026-11-09', correo: null };
    assert.equal(linea({ ...anterior, correoDelBot: DEL_BOT }), 'Correo enviado el 09/11/2026 a las 08:00, según Datito.');
    assert.deepEqual(pastilla({ ...anterior, correoDelBot: DEL_BOT }), { tipo: 'enviada', texto: 'Enviada por Datito el lun 09/11' });
    const sinHora = { estado: 'enviado', enviado_at: null };
    assert.equal(linea({ ...anterior, correoDelBot: sinHora }), 'Correo enviado según Datito, sin la hora.');
    assert.deepEqual(pastilla({ ...anterior, correoDelBot: sinHora }), { tipo: 'enviada', texto: 'Enviada por Datito' });
    const sinCorreo = { estado: 'no_enviado', enviado_at: null };
    assert.equal(linea({ ...anterior, correoDelBot: sinCorreo }), 'Datito archivó esta edición sin que saliera el correo.');
    assert.equal(pastilla({ ...anterior, correoDelBot: sinCorreo }), null);
    assert.equal(pastilla({ ...anterior, correoDelBot: sinCorreo }, true), null);
  });

  it('el bot en otra zona: la hora pasa a Argentina', () => {
    const cambios = { correo: null, correoDelBot: { estado: 'enviado', enviado_at: '2026-11-09T11:00:00Z' } };
    assert.deepEqual(pastilla(cambios), { tipo: 'enviada', texto: 'Enviada por Datito el lun 09/11' });
  });

  describe('reenviada a toda la lista, cuando el RPAD no la mandó solo (spec, 6)', () => {
    const REENVIOS = [reenvio(1, '2026-11-25 10:12:30'), reenvio(2, '2026-11-25 10:12:31')];
    const LISTA = [enLaLista(1), enLaLista(2)];
    const reenviada = (cambios) => ({ correo: correo('no_enviada', 'apagado'), reenvios: REENVIOS, lista: LISTA, ...cambios });

    it('una no enviada', () => {
      assert.equal(linea(reenviada()), 'Reenviada por correo el miércoles 25/11/2026 a las 10:12.');
      assert.deepEqual(pastilla(reenviada()), { tipo: 'enviada', texto: 'Reenviada el mié 25/11' });
      assert.deepEqual(pastilla(reenviada(), true), { tipo: 'enviada', texto: 'Reenviada el mié 25/11' });
    });

    it('gana sobre la línea del bot, una fallida y una edición sin envío', () => {
      assert.equal(linea(reenviada({ correoDelBot: DEL_BOT })), 'Reenviada por correo el miércoles 25/11/2026 a las 10:12.');
      assert.equal(linea(reenviada({ correo: correo('fallida'), envios: [fallido(1, 3), fallido(2, 3)] })),
        'Reenviada por correo el miércoles 25/11/2026 a las 10:12.');
      assert.equal(linea(reenviada({ correo: null, correoDelBot: DEL_BOT })),
        'Reenviada por correo el miércoles 25/11/2026 a las 10:12.');
    });

    it('si el RPAD la había mandado solo, sigue la línea de su envío', () => {
      const p = salida([enviado(1), fallido(2, 3)], { correo: correo('parcial'), reenvios: REENVIOS, lista: LISTA });
      assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
    });

    it('un reenvío a una sola persona no cambia la línea que ven todos', () => {
      const cambios = reenviada({ reenvios: [REENVIOS[0]] });
      assert.equal(linea(cambios), 'No se envió: el envío automático estaba apagado.');
      assert.deepEqual(pastilla(cambios), { tipo: 'no_enviada', texto: 'No se envió' });
    });
  });

  it('las filas mandan: con alguna enviada, «enviada», aunque la fila del correo diga otra cosa', () => {
    const p = salida([enviado(1), fallido(2, 1)], { correo: correo('no_enviada', 'apagado') });
    assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
  });

  describe('una hora sin leer (un Date o null) cambia solo el texto, nunca lo que pasó', () => {
    for (const [nombre, hora] of SIN_LEER) {
      it(`una fila enviada con ${nombre} en enviado_at: «Enviada por correo.» y «Enviada»`, () => {
        const p = salida([enviado(1, hora()), enviado(2, hora())], { correo: correo('enviada') });
        assert.equal(lineaDelCorreo(p), 'Enviada por correo.');
        assert.deepEqual(pastillaDelEnvio({ ...p, admin: false }), { tipo: 'enviada', texto: 'Enviada' });
        assert.deepEqual(pastillaDelEnvio({ ...p, admin: true }), { tipo: 'enviada', texto: 'Enviada' });
      });

      it(`parcial y en reintento con ${nombre}: administración ve lo mismo que con la hora`, () => {
        const parcial = salida([enviado(1, hora()), fallido(2, 3)], { correo: correo('parcial') });
        assert.equal(lineaDelCorreo(parcial), 'Enviada por correo.');
        assert.deepEqual(pastillaDelEnvio({ ...parcial, admin: false }), { tipo: 'enviada', texto: 'Enviada' });
        assert.deepEqual(pastillaDelEnvio({ ...parcial, admin: true }), { tipo: 'parcial', texto: 'Enviada a 1 de 2' });
        const reintento = salida([enviado(1, hora()), fallido(2, 1)]);
        assert.deepEqual(pastillaDelEnvio({ ...reintento, admin: true }), { tipo: 'parcial', texto: '1 persona en reintento' });
      });

      it(`sin filas, la edición guardada como enviada con ${nombre} en enviada_at: «Enviada por correo.»`, () => {
        assert.equal(lineaDelCorreo(salida([], { correo: correo('enviada', null, hora()) })), 'Enviada por correo.');
      });

      it(`un reenvío a toda la lista con ${nombre}: «Reenviada por correo.» y «Reenviada»`, () => {
        const cambios = {
          correo: correo('no_enviada', 'apagado'), reenvios: [reenvio(1, hora()), reenvio(2, hora())], lista: [enLaLista(1), enLaLista(2)]
        };
        assert.equal(linea(cambios), 'Reenviada por correo.');
        assert.deepEqual(pastilla(cambios), { tipo: 'enviada', texto: 'Reenviada' });
      });
    }

    it('con una hora leída y otra sin leer, la leída', () => {
      const p = salida([enviado(1, null), enviado(2, '2026-11-10 08:05:14')], { correo: correo('enviada') });
      assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
    });
  });

  it('sin la fila del primer envío, la hora guardada en el correo', () => {
    const p = salida([], { correo: correo('enviada', null, '2026-11-10 08:05:12') });
    assert.equal(lineaDelCorreo(p), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
  });

  it('ningún texto usa las palabras que el sistema evita', () => {
    const textos = [
      linea(), linea({ envioActivo: false }), linea({ correo: correo('no_enviada', 'vieja') }),
      lineaDelCorreo(salida([fallido(1, 3)], { correo: correo('fallida') })),
      lineaDelCorreo(salida([conEstado(1, 'enviando', 1)], { correo: correo('parcial') })),
      lineaDelCorreo(salida([conEstado(1, 'licencia')], { correo: correo('fallida') }))
    ];
    for (const texto of textos) assert.doesNotMatch(texto, PROHIBIDAS);
  });
});

describe('envioDelRecibo: el envío del 201 y del 200 (spec, 11)', () => {
  const recibo = (cambios) => {
    const { tipo, fecha_edicion, correo: c, envios, envioActivo, ahora, calendario } = base(cambios);
    return envioDelRecibo({ tipo, fecha_edicion, correo: c, envios, envioActivo, ahora, calendario });
  };

  it('programada: el instante de la corrida en que sale', () => {
    assert.deepEqual(recibo(), {
      estado: 'programada', programado_at: '2026-11-24T08:05:00-03:00', texto: 'Se envía el martes 24/11/2026 a las 8:05.'
    });
    assert.deepEqual(recibo({ fecha_edicion: '2026-11-24', ahora: '2026-11-24 08:20:00' }), {
      estado: 'programada', programado_at: '2026-11-24T14:00:00-03:00', texto: 'Se envía hoy a las 14:00.'
    });
  });

  it('no enviada al llegar: apagado o vieja', () => {
    assert.deepEqual(recibo({ correo: correo('no_enviada', 'apagado') }), {
      estado: 'no_enviada', programado_at: null, texto: 'No se envía por correo: el envío automático está apagado.'
    });
    assert.deepEqual(recibo({ correo: correo('no_enviada', 'vieja') }), {
      estado: 'no_enviada', programado_at: null, texto: 'No se envía por correo: tiene más de 13 días.'
    });
  });

  it('no enviada por una corrida: hay una más nueva o la lista estaba vacía', () => {
    assert.equal(recibo({ correo: correo('no_enviada', 'mas_nueva') }).texto, 'No se envía por correo: hay una edición más nueva.');
    assert.equal(recibo({ correo: correo('no_enviada', 'sin_lista') }).texto, 'No se envía por correo: no hay nadie en la lista.');
  });

  it('un 200 después del envío: «Enviada por correo el …»', () => {
    const enviada = {
      fecha_edicion: '2026-11-09', ahora: '2026-11-12 10:00:00', correo: correo('enviada'), envios: [enviado(1), enviado(2)]
    };
    assert.deepEqual(recibo(enviada), {
      estado: 'enviada', programado_at: null, texto: 'Enviada por correo el martes 10/11/2026 a las 8:05.'
    });
    assert.deepEqual(recibo({ ...enviada, correo: correo('programada'), envios: [enviado(1), fallido(2, 1)] }), {
      estado: 'enviada', programado_at: null, texto: 'Enviada por correo el martes 10/11/2026 a las 8:05.'
    });
    assert.deepEqual(recibo({ ...enviada, correo: correo('parcial'), envios: [enviado(1), fallido(2, 3)] }), {
      estado: 'parcial', programado_at: null, texto: 'Enviada por correo el martes 10/11/2026 a las 8:05.'
    });
    assert.deepEqual(recibo({ ...enviada, correo: correo('fallida'), envios: [fallido(1, 3)] }), {
      estado: 'fallida', programado_at: null, texto: 'No se pudo enviar.'
    });
  });

  it('con la hora del envío sin leer (un Date o null): el mismo estado y el texto sin la hora', () => {
    for (const [, hora] of SIN_LEER) {
      const enviada = { fecha_edicion: '2026-11-09', ahora: '2026-11-12 10:00:00', correo: correo('enviada') };
      assert.deepEqual(recibo({ ...enviada, envios: [enviado(1, hora()), enviado(2, hora())] }), {
        estado: 'enviada', programado_at: null, texto: 'Enviada por correo.'
      });
      assert.deepEqual(recibo({ ...enviada, correo: correo('parcial'), envios: [enviado(1, hora()), fallido(2, 3)] }), {
        estado: 'parcial', programado_at: null, texto: 'Enviada por correo.'
      });
    }
  });

  it('programada con el envío apagado después: en espera, sin instante', () => {
    assert.deepEqual(recibo({ envioActivo: false }), {
      estado: 'programada', programado_at: null, texto: 'En espera: el envío automático está apagado.'
    });
  });

  it('un piloto: el estado «piloto» y el texto de la sección 11, sin instante', () => {
    const piloto = { estado: 'piloto', programado_at: null, texto: 'Los pilotos no se envían por correo.' };
    assert.deepEqual(recibo({ tipo: 'piloto', correo: null }), piloto);
    assert.deepEqual(recibo({ tipo: 'piloto', correo: null, envioActivo: false }), piloto);
  });

  it('una regular sin fila de correo (después de esta entrega no pasa: toda regular la tiene al llegar): null', () => {
    assert.equal(recibo({ correo: null }), null);
  });
});

describe('envioInicial: la fila de cada persona al armar el envío (spec, 5)', () => {
  const inactiva = { estado: 'omitido', error: MENSAJES_CORREO.inactiva };
  const sinEmail = { estado: 'omitido', error: MENSAJES_CORREO.sinEmail };

  it('inactiva, sin un email válido, de licencia o pendiente, en ese orden', () => {
    assert.deepEqual(envioInicial({ activa: false, emailValido: false, deLicencia: true }), inactiva);
    assert.deepEqual(envioInicial({ activa: true, emailValido: false, deLicencia: true }), sinEmail);
    assert.deepEqual(envioInicial({ activa: true, emailValido: true, deLicencia: true }), { estado: 'licencia', error: null });
    assert.deepEqual(envioInicial({ activa: true, emailValido: true, deLicencia: false }), { estado: 'pendiente', error: null });
  });

  it('ante la duda no le llega: queda pendiente solo con activa y emailValido en true y deLicencia en false', () => {
    assert.deepEqual(envioInicial({ activa: 1, emailValido: true, deLicencia: false }), inactiva);
    assert.deepEqual(envioInicial({ activa: true, emailValido: 'si', deLicencia: false }), sinEmail);
    assert.deepEqual(envioInicial({ activa: true, emailValido: true, deLicencia: 0 }), { estado: 'licencia', error: null });
    assert.deepEqual(envioInicial({ activa: true, emailValido: true }), { estado: 'licencia', error: null });
  });
});

describe('textoDeLaPersona: el estado de cada persona en la caja del correo (spec, 12)', () => {
  it('cada estado, con su texto y si está mal', () => {
    assert.deepEqual(textoDeLaPersona(enviado(1)), { texto: 'Enviado el 10/11 a las 8:05', mal: false });
    assert.deepEqual(textoDeLaPersona(enviado(1, '2026-11-25 10:12:30')), { texto: 'Enviado el 25/11 a las 10:12', mal: false });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'licencia')), { texto: 'No se envió: de licencia', mal: true });
    assert.deepEqual(textoDeLaPersona({ ...conEstado(1, 'omitido'), error: MENSAJES_CORREO.sinEmail }),
      { texto: 'No se envió: no tenía un email válido', mal: true });
    assert.deepEqual(textoDeLaPersona({ ...conEstado(1, 'omitido'), error: MENSAJES_CORREO.inactiva }),
      { texto: 'No se envió: ya no estaba activa', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'omitido')), { texto: 'No se envió', mal: true });
    assert.deepEqual(textoDeLaPersona(fallido(1, 3)), { texto: 'No se pudo enviar (3 intentos)', mal: true });
    assert.deepEqual(textoDeLaPersona(fallido(1, 1)), { texto: 'En reintento (1 de 3)', mal: true });
    assert.deepEqual(textoDeLaPersona(fallido(1, 2)), { texto: 'En reintento (2 de 3)', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'enviando', 1)), { texto: 'Sin confirmar', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'pendiente')), { texto: 'Pendiente', mal: false });
  });

  it('en una edición que ya no está vigente, un reintento o una pendiente quedan «No se pudo enviar», con sus intentos (Ruling 9)', () => {
    const cerrada = { vigente: false };
    assert.deepEqual(textoDeLaPersona(fallido(1, 1), cerrada), { texto: 'No se pudo enviar (1 intento)', mal: true });
    assert.deepEqual(textoDeLaPersona(fallido(1, 2), cerrada), { texto: 'No se pudo enviar (2 intentos)', mal: true });
    assert.deepEqual(textoDeLaPersona(fallido(1, 3), cerrada), { texto: 'No se pudo enviar (3 intentos)', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'pendiente'), cerrada), { texto: 'No se pudo enviar (0 intentos)', mal: true });
    // Lo demás no cambia
    assert.deepEqual(textoDeLaPersona(enviado(1), cerrada), { texto: 'Enviado el 10/11 a las 8:05', mal: false });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'enviando', 1), cerrada), { texto: 'Sin confirmar', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'licencia'), cerrada), { texto: 'No se envió: de licencia', mal: true });
    assert.deepEqual(textoDeLaPersona(reenvio(1, null, 'fallido'), cerrada), { texto: 'No se pudo enviar', mal: true });
    // Vigente, o sin la opción, como hasta ahora
    assert.deepEqual(textoDeLaPersona(fallido(1, 1), { vigente: true }), { texto: 'En reintento (1 de 3)', mal: true });
    assert.deepEqual(textoDeLaPersona(conEstado(1, 'pendiente'), {}), { texto: 'Pendiente', mal: false });
  });

  it('un reenvío o una prueba que falló no se reintenta', () => {
    assert.deepEqual(textoDeLaPersona(reenvio(1, null, 'fallido')), { texto: 'No se pudo enviar', mal: true });
    const prueba = { tipo: 'prueba', estado: 'fallido', intentos: 1, enviado_at: null };
    assert.deepEqual(textoDeLaPersona(prueba), { texto: 'No se pudo enviar', mal: true });
    assert.deepEqual(textoDeLaPersona(reenvio(1, '2026-11-25 10:12:30')), { texto: 'Enviado el 25/11 a las 10:12', mal: false });
  });

  it('enviado con la hora sin leer (un Date o null): «Enviado», sin la hora', () => {
    for (const [, hora] of SIN_LEER) assert.deepEqual(textoDeLaPersona(enviado(1, hora())), { texto: 'Enviado', mal: false });
  });

  it('la fila de envioInicial da su texto', () => {
    const fila = (persona) => ({ ...envioInicial(persona), intentos: 0, enviado_at: null });
    const texto = (persona) => textoDeLaPersona(fila(persona)).texto;
    assert.equal(texto({ activa: false, emailValido: true, deLicencia: false }), 'No se envió: ya no estaba activa');
    assert.equal(texto({ activa: true, emailValido: false, deLicencia: false }), 'No se envió: no tenía un email válido');
    assert.equal(textoDeLaPersona(fila({ activa: true, emailValido: true, deLicencia: true })).texto, 'No se envió: de licencia');
  });
});

describe('resumenDelCorreo: la primera línea de la caja del correo (spec, 6 y 12)', () => {
  const resumen = (envios, cambios = {}) => resumenDelCorreo({ tipo: 'regular', correo: correo('enviada'), envios, ...cambios });

  it('una que ya no está vigente no tiene personas en reintento: cerró (Ruling 9)', () => {
    assert.equal(resumen([enviado(1), fallido(2, 1)], { correo: correo('programada'), vigente: false }),
      'Enviada el martes 10/11/2026 a las 8:05, a 1 de 2 personas.');
    assert.equal(resumen([fallido(1, 1)], { correo: correo('programada'), vigente: false }), 'No se pudo enviar: no le llegó a nadie.');
    assert.equal(resumen([enviado(1), fallido(2, 1)], { correo: correo('programada') }),
      'Enviada el martes 10/11/2026 a las 8:05, a 1 de 2 personas. 1 persona en reintento.');
  });

  it('a todas, a una y a algunas', () => {
    assert.equal(resumen([enviado(1), enviado(2)]), 'Enviada el martes 10/11/2026 a las 8:05, a 2 personas.');
    assert.equal(resumen([enviado(1)]), 'Enviada el martes 10/11/2026 a las 8:05, a 1 persona.');
    assert.equal(resumen([enviado(1), enviado(2), conEstado(3, 'licencia'), fallido(4, 3)], { correo: correo('parcial') }),
      'Enviada el martes 10/11/2026 a las 8:05, a 2 de 4 personas.');
  });

  it('con reintentos', () => {
    assert.equal(resumen([enviado(1), enviado(2), enviado(3), fallido(4, 1)], { correo: correo('programada') }),
      'Enviada el martes 10/11/2026 a las 8:05, a 3 de 4 personas. 1 persona en reintento.');
    assert.equal(resumen([fallido(1, 1), fallido(2, 2)], { correo: correo('programada') }),
      'Todavía no le llegó a nadie. 2 personas en reintento.');
  });

  it('un reenvío que le llegó a quien había fallado cuenta', () => {
    assert.equal(resumen([enviado(1), fallido(2, 3)], { reenvios: [reenvio(2, '2026-11-25 10:12:30')] }),
      'Enviada el martes 10/11/2026 a las 8:05, a 2 personas.');
  });

  it('le llegó solo por un reenvío: lo dice porque ninguna fila automática salió, no por la hora', () => {
    assert.equal(resumen([fallido(1, 3), fallido(2, 3)], { correo: correo('parcial'), reenvios: [reenvio(2, '2026-11-25 10:12:30')] }),
      'Le llegó a 1 de 2 personas con un reenvío.');
  });

  it('con la hora del envío sin leer (un Date o null): sin la hora, y nunca «con un reenvío»', () => {
    for (const [, hora] of SIN_LEER) {
      assert.equal(resumen([enviado(1, hora()), enviado(2, hora())]), 'Enviada a 2 personas.');
      assert.equal(resumen([enviado(1, hora()), fallido(2, 3)], { correo: correo('parcial') }), 'Enviada a 1 de 2 personas.');
      assert.equal(resumen([enviado(1, hora()), fallido(2, 1)], { correo: correo('programada') }),
        'Enviada a 1 de 2 personas. 1 persona en reintento.');
    }
  });

  it('sin filas, la edición guardada como enviada: el texto de la línea, no «No se envió.»', () => {
    assert.equal(resumen([], { correo: correo('enviada', null, '2026-11-10 08:05:12') }),
      'Enviada por correo el martes 10/11/2026 a las 8:05.');
    assert.equal(resumen([], { correo: correo('enviada', null, null) }), 'Enviada por correo.');
  });

  it('a nadie', () => {
    assert.equal(resumen([fallido(1, 3), fallido(2, 3)], { correo: correo('fallida') }), 'No se pudo enviar: no le llegó a nadie.');
    assert.equal(resumen([conEstado(1, 'licencia'), conEstado(2, 'omitido')], { correo: correo('fallida') }),
      'No se envió: nadie de la lista estaba disponible.');
    assert.equal(resumen([conEstado(1, 'enviando', 1)], { correo: correo('parcial') }), 'No se pudo confirmar a quién le llegó.');
    assert.equal(resumen([conEstado(1, 'pendiente')], { correo: correo('programada') }), 'Todavía no le llegó a nadie.');
  });

  it('sin filas: programada, no enviada, sin envío y un piloto', () => {
    assert.equal(resumen([], { correo: correo('programada') }), 'Todavía no salió.');
    assert.equal(resumen([], { correo: correo('no_enviada', 'sin_lista') }), 'No se envió: no había nadie en la lista.');
    assert.equal(resumen([], { correo: correo('no_enviada', 'apagado') }), 'No se envió: el envío automático estaba apagado.');
    assert.equal(resumen([], { correo: null }), 'Sin envío automático: llegó antes de que el RPAD mandara el correo.');
    assert.equal(resumen([], { tipo: 'piloto', correo: null }), 'Los pilotos no se envían por correo.');
  });
});

describe('sePuedeReenviar: solo una regular cuyo envío automático terminó (spec, 9)', () => {
  const puede = (cambios) => sePuedeReenviar({ tipo: 'regular', correo: correo('enviada'), envios: [enviado(1)], ...cambios });

  it('una que salió, una no enviada y una sin envío (anterior a esta entrega), sí', () => {
    assert.equal(puede(), true);
    assert.equal(puede({ correo: correo('parcial'), envios: [enviado(1), fallido(2, 3)] }), true);
    assert.equal(puede({ correo: correo('fallida'), envios: [fallido(1, 3)] }), true);
    assert.equal(puede({ correo: correo('no_enviada', 'apagado'), envios: [] }), true);
    assert.equal(puede({ correo: null, envios: [] }), true);
  });

  it('programada, o con alguna persona pendiente o en reintento, no', () => {
    assert.equal(puede({ correo: correo('programada'), envios: [] }), false);
    assert.equal(puede({ correo: correo('programada'), envios: [enviado(1), conEstado(2, 'pendiente')] }), false);
    assert.equal(puede({ correo: correo('programada'), envios: [enviado(1), fallido(2, 1)] }), false);
  });

  it('una que quedó «enviando» por un corte, sí: no se reintenta, y reenviarla es la forma de que le llegue', () => {
    assert.equal(puede({ correo: correo('parcial'), envios: [enviado(1), conEstado(2, 'enviando', 1)] }), true);
  });

  it('un piloto, no: se le manda una prueba', () => {
    assert.equal(puede({ tipo: 'piloto', correo: null, envios: [] }), false);
    assert.equal(puede({ tipo: 'piloto', correo: null, envios: [], vigente: false }), false);
  });

  it('una que ya no está vigente, sí, aunque le quedaran reintentos o pendientes: ya no sale sola (Ruling 9)', () => {
    assert.equal(puede({ correo: correo('programada'), envios: [enviado(1), fallido(2, 1)], vigente: false }), true);
    assert.equal(puede({ correo: correo('programada'), envios: [enviado(1), conEstado(2, 'pendiente')], vigente: false }), true);
    // Una programada sin filas que ya no está vigente tampoco sale sola: la corrida la deja «vieja»
    assert.equal(puede({ correo: correo('programada'), envios: [], vigente: false }), true);
    assert.equal(puede({ correo: correo('programada'), envios: [enviado(1), fallido(2, 1)], vigente: true }), false);
  });
});

describe('textoDelReenvio: la respuesta de «Reenviar» (spec, 9)', () => {
  it('a todas, a algunas y a ninguna', () => {
    assert.equal(textoDelReenvio({ enviados: 4, fallidos: 0 }), 'Se reenvió a 4 personas.');
    assert.equal(textoDelReenvio({ enviados: 1, fallidos: 0 }), 'Se reenvió a 1 persona.');
    assert.equal(textoDelReenvio({ enviados: 3, fallidos: 1 }), 'Se reenvió a 3 de 4 personas: a 1 no le llegó.');
    assert.equal(textoDelReenvio({ enviados: 2, fallidos: 2 }), 'Se reenvió a 2 de 4 personas: a 2 no les llegó.');
    assert.equal(textoDelReenvio({ enviados: 0, fallidos: 1 }), 'No se pudo reenviar: no le llegó a nadie.');
  });
});

describe('las rutas de administración: lo que validan y los textos que arman (spec, 9 y 12)', () => {
  it('listaDePersonas: ids positivos sin repetir, como números o como texto de dígitos; otra cosa, null', () => {
    assert.deepEqual(listaDePersonas([3, 1, '7']), [3, 1, 7]);
    assert.deepEqual(listaDePersonas([]), []);
    for (const valor of [undefined, null, 'x', 5, {}, [1, 1], [1, '1'], [0], [-1], [1.5], ['1e3'], [' 2'], [true], [null], [[1]]]) {
      assert.equal(listaDePersonas(valor), null, JSON.stringify(valor));
    }
  });

  it('aQuienReenviar: «todas» o el id de una persona; otra cosa, null', () => {
    assert.equal(aQuienReenviar('todas'), 'todas');
    assert.equal(aQuienReenviar(12), 12);
    assert.equal(aQuienReenviar('12'), 12);
    for (const valor of [undefined, null, 'Todas', 'todos', 0, -3, 1.5, true, [], {}]) {
      assert.equal(aQuienReenviar(valor), null, JSON.stringify(valor));
    }
  });

  it('textoDeLaLicencia: hasta qué día, con el año solo si no es el de hoy', () => {
    assert.equal(textoDeLaLicencia('2026-11-30', '2026-11-12'), 'De licencia hasta el 30/11');
    assert.equal(textoDeLaLicencia('2027-01-05', '2026-12-20'), 'De licencia hasta el 05/01/2027');
    assert.equal(textoDeLaLicencia(null, '2026-11-12'), null);
  });

  it('textoDelEnvioAMano: cada reenvío y cada prueba, con su persona y su hora', () => {
    const fila = (cambios) => ({
      tipo: 'reenvio', estado: 'enviado', nombre: 'PruebaDos Ejemplo', enviado_at: '2026-11-25 10:12:30',
      creado_at: '2026-11-25 10:12:00', error: null, ...cambios
    });
    assert.equal(textoDelEnvioAMano(fila()), 'Reenviada a PruebaDos Ejemplo el 25/11 a las 10:12.');
    assert.equal(textoDelEnvioAMano(fila({ tipo: 'prueba' })), 'Prueba enviada a PruebaDos Ejemplo el 25/11 a las 10:12.');
    assert.equal(textoDelEnvioAMano(fila({ estado: 'fallido', enviado_at: null, creado_at: '2026-11-25 09:05:00' })),
      'No se pudo reenviar a PruebaDos Ejemplo el 25/11 a las 9:05.');
    assert.equal(textoDelEnvioAMano(fila({ tipo: 'prueba', estado: 'fallido', enviado_at: null })),
      'No se pudo enviar la prueba a PruebaDos Ejemplo el 25/11 a las 10:12.');
    assert.equal(textoDelEnvioAMano(fila({ estado: 'omitido', enviado_at: null, error: MENSAJES_CORREO.sinEmail })),
      'No se pudo reenviar a PruebaDos Ejemplo el 25/11 a las 10:12: no tenía un email válido.');
    assert.equal(textoDelEnvioAMano(fila({ estado: 'enviando', enviado_at: null })),
      'No se pudo confirmar el reenvío a PruebaDos Ejemplo del 25/11 a las 10:12.');
    assert.equal(textoDelEnvioAMano(fila({ tipo: 'prueba', estado: 'enviando', enviado_at: null })),
      'No se pudo confirmar la prueba a PruebaDos Ejemplo del 25/11 a las 10:12.');
    // Sin una hora que se pueda leer, sin la hora
    assert.equal(textoDelEnvioAMano(fila({ enviado_at: null, creado_at: null })), 'Reenviada a PruebaDos Ejemplo.');
    assert.equal(textoDelEnvioAMano(fila({ estado: 'enviando', enviado_at: null, creado_at: new Date() })),
      'No se pudo confirmar el reenvío a PruebaDos Ejemplo.');
  });

  it('textoDelInterruptor y textoDeLaListaGuardada', () => {
    assert.equal(textoDelInterruptor(true), 'El envío automático quedó prendido.');
    assert.equal(textoDelInterruptor(false), 'El envío automático quedó apagado.');
    assert.equal(textoDeLaListaGuardada(0), 'Se guardó la lista: no lo recibe nadie.');
    assert.equal(textoDeLaListaGuardada(1), 'Se guardó la lista: lo recibe 1 persona.');
    assert.equal(textoDeLaListaGuardada(4), 'Se guardó la lista: lo reciben 4 personas.');
  });

  // El pie de «Quién lo recibe» (spec, 13): la página tiene una copia para contar mientras se tilda, atada por un test de paridad
  it('textoDeLosQueReciben: «Lo recibe 1 persona.», «Lo reciben N personas.» y, sin nadie, «Todavía no lo recibe nadie.»', () => {
    assert.equal(textoDeLosQueReciben(0), 'Todavía no lo recibe nadie.');
    assert.equal(textoDeLosQueReciben(1), 'Lo recibe 1 persona.');
    assert.equal(textoDeLosQueReciben(2), 'Lo reciben 2 personas.');
    assert.equal(textoDeLosQueReciben(18), 'Lo reciben 18 personas.');
  });

  it('ningún texto usa las palabras que el sistema evita', () => {
    const textos = [textoDelInterruptor(true), textoDelInterruptor(false), textoDeLaListaGuardada(0), textoDeLaListaGuardada(2),
      textoDeLosQueReciben(0), textoDeLosQueReciben(1), textoDeLosQueReciben(3),
      ...['enviado', 'fallido', 'omitido', 'enviando'].flatMap((estado) => ['reenvio', 'prueba'].map((tipo) => textoDelEnvioAMano({
        tipo, estado, nombre: 'PruebaUno Ejemplo', enviado_at: null, creado_at: '2026-11-25 10:12:00', error: null
      })))];
    for (const texto of textos) assert.doesNotMatch(texto, PROHIBIDAS);
  });
});

describe('proximasEdiciones: la serie cada 14 días (spec, 12)', () => {
  const proximas = (cambios) => proximasEdiciones({
    ultimaRegular: '2026-11-09', hoy: '2026-11-12', calendario: CALENDARIO, filasDeFeriados: FILAS_PRECARGA, ...cambios
  });
  const ESPERADAS = [
    {
      edicion: '2026-11-23', sale: '2026-11-24',
      motivo: 'no es hábil el lunes 23/11, Día de la Soberanía Nacional',
      edicion_texto: 'lunes 23/11/2026',
      texto: 'Sale el martes 24/11/2026 a las 8:05: no es hábil el lunes 23/11, Día de la Soberanía Nacional.'
    },
    {
      edicion: '2026-12-07', sale: '2026-12-09',
      motivo: 'no son hábiles el lunes 07/12, Día no laborable con fines turísticos y el martes 08/12, Inmaculada Concepción de María',
      edicion_texto: 'lunes 07/12/2026',
      texto: 'Sale el miércoles 09/12/2026 a las 8:05: no son hábiles el lunes 07/12, Día no laborable con fines turísticos y el '
        + 'martes 08/12, Inmaculada Concepción de María.'
    },
    { edicion: '2026-12-21', sale: '2026-12-21', motivo: null, edicion_texto: 'lunes 21/12/2026', texto: 'Sale ese día a las 8:05.' },
    { edicion: '2027-01-04', sale: '2027-01-04', motivo: null, edicion_texto: 'lunes 04/01/2027', texto: 'Sale ese día a las 8:05.' }
  ];

  it('desde la del 09/11 con hoy 12/11: las cuatro que siguen, con sus motivos', () => {
    assert.deepEqual(proximas(), ESPERADAS);
  });

  it('sin ninguna regular, desde el 09/11/2026', () => {
    assert.deepEqual(proximas({ ultimaRegular: null }), ESPERADAS);
    assert.deepEqual(proximas({ ultimaRegular: null, hoy: '2026-11-09', cantidad: 1 }), [{
      edicion: '2026-11-09', sale: '2026-11-10',
      motivo: 'no es hábil el lunes 09/11, Visita de Su Santidad el Papa León XIV',
      edicion_texto: 'lunes 09/11/2026',
      texto: 'Sale el martes 10/11/2026 a las 8:05: no es hábil el lunes 09/11, Visita de Su Santidad el Papa León XIV.'
    }]);
  });

  it('la última regular ya llegó: la serie sigue 14 días después, aunque sea hoy', () => {
    assert.deepEqual(proximas({ ultimaRegular: '2026-11-23', hoy: '2026-11-23' }).map((p) => p.edicion),
      ['2026-12-07', '2026-12-21', '2027-01-04', '2027-01-18']);
  });

  it('si el bot dejó de mandar, las que son hoy o después', () => {
    assert.deepEqual(proximas({ hoy: '2027-01-05', cantidad: 2 }).map((p) => p.edicion), ['2027-01-18', '2027-02-01']);
    assert.deepEqual(proximas({ hoy: '2026-11-23', cantidad: 1 }).map((p) => p.edicion), ['2026-11-23']);
  });

  it('con la tabla de feriados caída, ninguna', () => {
    assert.deepEqual(proximas({ calendario: CALENDARIO_CAIDO }), []);
  });
});

describe('datoQuincenaEnMiEspacio: las fechas de la agenda de Mi espacio (spec 2026-11-14-dato-quincena-en-mi-espacio)', () => {
  const enMiEspacio = (cambios = {}) => datoQuincenaEnMiEspacio({
    envioActivo: true, ultima: null, ahora: '2026-11-14 18:12:00', calendario: CALENDARIO, filasDeFeriados: FILAS_PRECARGA, ...cambios
  });
  const ultimaDel = (fecha_edicion, correoDeLa, envios = []) => ({ fecha_edicion, correo: correoDeLa, envios });
  const SOBERANIA = 'Edición del lunes 23/11: no es hábil el lunes 23/11, Día de la Soberanía Nacional.';
  const fechas = (items) => items.map(({ fecha }) => fecha);
  // Lo que cambia de un caso a otro: el texto de la casilla y el title se miran entero en el primero
  const resumen = ({ fecha, hora, nombre, detalle }) => ({ fecha, hora, nombre, detalle });
  const SERIE_DESDE_EL_24_11 = ['2026-11-24', '2026-12-09', '2026-12-21', '2027-01-04', '2027-01-18'];
  const SERIE_DESDE_EL_09_12 = ['2026-12-09', '2026-12-21', '2027-01-04', '2027-01-18', '2027-02-01'];
  // La del 23/11 que salió sola el martes 24/11 a las 8:05
  const salioEl24 = ultimaDel('2026-11-23', correo('enviada'), [enviado(1, '2026-11-24 08:05:12')]);

  it('CUANTAS_EN_MI_ESPACIO: cinco fechas a lo sumo', () => {
    assert.equal(CUANTAS_EN_MI_ESPACIO, 5);
  });

  it('desdeLaSalida: el martes 24/11 la serie sigue con la del lunes 23/11, que sale ese día; sin la opción, como la pestaña Correo', () => {
    const delMartes = (cambios) => proximasEdiciones({
      ultimaRegular: '2026-11-09', hoy: '2026-11-24', calendario: CALENDARIO, filasDeFeriados: FILAS_PRECARGA, cantidad: 1, ...cambios
    });
    assert.equal(delMartes({ desdeLaSalida: true })[0].edicion, '2026-11-23');
    assert.equal(delMartes({ desdeLaSalida: true })[0].sale, '2026-11-24');
    assert.equal(delMartes()[0].edicion, '2026-12-07');
    assert.equal(delMartes({ desdeLaSalida: false })[0].edicion, '2026-12-07');
    // El miércoles 25/11 la del 23/11 ya salió: la serie salta también con la opción
    assert.equal(delMartes({ hoy: '2026-11-25', desdeLaSalida: true })[0].edicion, '2026-12-07');
  });

  it('con el envío automático apagado, ninguna', () => {
    assert.deepEqual(enMiEspacio({ envioActivo: false }), []);
    // Solo el true literal lo prende
    assert.deepEqual(enMiEspacio({ envioActivo: 'true' }), []);
    assert.deepEqual(enMiEspacio({ envioActivo: false, ultima: ultimaDel('2026-11-23', correo('programada')),
      ahora: '2026-11-24 07:40:00' }), []);
  });

  it('con la tabla de feriados caída, ninguna', () => {
    assert.deepEqual(enMiEspacio({ calendario: CALENDARIO_CAIDO }), []);
    assert.deepEqual(enMiEspacio({ calendario: CALENDARIO_CAIDO, ultima: ultimaDel('2026-11-23', correo('programada')),
      ahora: '2026-11-24 07:40:00' }), []);
  });

  it('sin ninguna regular, el sábado 14/11: las cinco de la serie desde el 09/11/2026, el día en que salen, a las 08:05', () => {
    const items = enMiEspacio();
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_24_11);
    assert.deepEqual(items[0], {
      fecha: '2026-11-24',
      hora: '08:05',
      texto: 'Dato de la quincena',
      nombre: 'Sale el dato de la quincena',
      titulo: `Sale el dato de la quincena, a las 08:05. ${SOBERANIA}`,
      detalle: SOBERANIA
    });
    assert.deepEqual(resumen(items[1]), {
      fecha: '2026-12-09', hora: '08:05', nombre: 'Sale el dato de la quincena',
      detalle: 'Edición del lunes 07/12: no son hábiles el lunes 07/12, Día no laborable con fines turísticos y el martes 08/12, '
        + 'Inmaculada Concepción de María.'
    });
    assert.deepEqual(items[2], {
      fecha: '2026-12-21',
      hora: '08:05',
      texto: 'Dato de la quincena',
      nombre: 'Sale el dato de la quincena',
      titulo: 'Sale el dato de la quincena, a las 08:05. Edición del lunes 21/12.',
      detalle: 'Edición del lunes 21/12.'
    });
    assert.deepEqual(resumen(items[3]), {
      fecha: '2027-01-04', hora: '08:05', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 04/01.'
    });
  });

  it('una regular sin correo del RPAD (anterior al envío): no va, y la serie sigue desde ella', () => {
    assert.deepEqual(fechas(enMiEspacio({ ultima: ultimaDel('2026-11-09', null) })), SERIE_DESDE_EL_24_11);
  });

  it('una fecha que no se puede leer cuenta como sin ninguna regular', () => {
    assert.deepEqual(enMiEspacio({ ultima: ultimaDel(null, correo('programada')) }), enMiEspacio());
    assert.deepEqual(enMiEspacio({ ultima: ultimaDel('23/11/2026', correo('programada')) }), enMiEspacio());
  });

  it('la del 23/11 ya llegó, el martes 24/11 a las 07:40: sale ese día a las 08:05, con el motivo de la serie', () => {
    const items = enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('programada')), ahora: '2026-11-24 07:40:00' });
    assert.deepEqual(resumen(items[0]), {
      fecha: '2026-11-24', hora: '08:05', nombre: 'Sale el dato de la quincena', detalle: SOBERANIA
    });
    assert.equal(items[0].titulo, `Sale el dato de la quincena, a las 08:05. ${SOBERANIA}`);
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_24_11);
    assert.equal(items.length, CUANTAS_EN_MI_ESPACIO);
  });

  it('la del 23/11 salió hoy a las 08:05: «Salió…», con la hora de su primer envío, hasta que termina el día', () => {
    const items = enMiEspacio({ ultima: salioEl24, ahora: '2026-11-24 10:30:00' });
    assert.deepEqual(resumen(items[0]), {
      fecha: '2026-11-24', hora: '08:05', nombre: 'Salió el dato de la quincena', detalle: SOBERANIA
    });
    assert.equal(items[0].texto, 'Dato de la quincena');
    assert.equal(items[0].titulo, `Salió el dato de la quincena, a las 08:05. ${SOBERANIA}`);
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_24_11);
    assert.deepEqual(fechas(enMiEspacio({ ultima: salioEl24, ahora: '2026-11-24 23:59:59' })), SERIE_DESDE_EL_24_11);
  });

  it('la hora es la del primer envío que salió: el de las 14:00 de un reintento no la cambia', () => {
    const ultima = ultimaDel('2026-11-23', correo('enviada'), [
      enviado(2, '2026-11-24 14:00:40'), enviado(1, '2026-11-24 08:05:12'), fallido(3, 2)
    ]);
    const [primero] = enMiEspacio({ ultima, ahora: '2026-11-24 15:00:00' });
    assert.deepEqual(resumen(primero), {
      fecha: '2026-11-24', hora: '08:05', nombre: 'Salió el dato de la quincena', detalle: SOBERANIA
    });
  });

  it('la misma, el miércoles 25/11: ya salió ayer y no va', () => {
    const items = enMiEspacio({ ultima: salioEl24, ahora: '2026-11-25 08:00:00' });
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_09_12);
    assert.ok(items.every(({ nombre }) => nombre === 'Sale el dato de la quincena'));
  });

  it('enviada sin una hora que se pueda leer: no va (no se sabe si fue hoy)', () => {
    const ultima = ultimaDel('2026-11-23', correo('enviada'), [{ usuario_id: 1, estado: 'enviado', intentos: 1, enviado_at: null }]);
    assert.deepEqual(fechas(enMiEspacio({ ultima, ahora: '2026-11-24 10:30:00' })), SERIE_DESDE_EL_09_12);
  });

  it('la del 21/12 programada, a las 10:30 de ese lunes: sale a las 14:00, como dice su pastilla', () => {
    const ultima = ultimaDel('2026-12-21', correo('programada'));
    const [primero] = enMiEspacio({ ultima, ahora: '2026-12-21 10:30:00' });
    assert.deepEqual(resumen(primero), {
      fecha: '2026-12-21', hora: '14:00', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 21/12.'
    });
    assert.equal(primero.titulo, 'Sale el dato de la quincena, a las 14:00. Edición del lunes 21/12.');
    assert.equal(pastilla({ fecha_edicion: '2026-12-21', ahora: '2026-12-21 10:30:00' }).texto, 'Sale hoy a las 14:00');
  });

  it('la del 21/12 en reintento a las 10:30: sale con la próxima corrida, a las 14:00', () => {
    const ultima = ultimaDel('2026-12-21', correo('programada'), [fallido(1, 1)]);
    assert.deepEqual(resumen(enMiEspacio({ ultima, ahora: '2026-12-21 10:30:00' })[0]), {
      fecha: '2026-12-21', hora: '14:00', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 21/12.'
    });
  });

  it('la del 21/12 a las 15:00: sale el martes 22/12 a las 08:05, otro día que el de la serie, sin motivo', () => {
    const esperado = {
      fecha: '2026-12-22', hora: '08:05', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 21/12.'
    };
    const programada = enMiEspacio({ ultima: ultimaDel('2026-12-21', correo('programada')), ahora: '2026-12-21 15:00:00' });
    assert.deepEqual(resumen(programada[0]), esperado);
    assert.deepEqual(fechas(programada), ['2026-12-22', '2027-01-04', '2027-01-18', '2027-02-01', '2027-02-15']);
    const enReintento = enMiEspacio({
      ultima: ultimaDel('2026-12-21', correo('programada'), [fallido(1, 1)]), ahora: '2026-12-21 15:00:00'
    });
    assert.deepEqual(resumen(enReintento[0]), esperado);
  });

  it('la del 23/11 que llegó el martes 24/11 después de las 14:00: sale el 25/11, sin el motivo del feriado', () => {
    const [primero] = enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('programada')), ahora: '2026-11-24 14:30:00' });
    assert.deepEqual(resumen(primero), {
      fecha: '2026-11-25', hora: '08:05', nombre: 'Sale el dato de la quincena', detalle: 'Edición del lunes 23/11.'
    });
  });

  // Con las corridas paradas, una programada puede quedar fuera de los 13 días el día en que saldría: la corrida de ese día la da
  // por vieja (decidirCorrida) y no sale. La vigencia se mira contra el día de la salida, no contra hoy
  it('la del 23/11 programada, sin filas, el domingo 06/12 a las 10:00 (su día 13): saldría el 09/12, fuera de los 13 días, y no va', () => {
    const items = enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('programada')), ahora: '2026-12-06 10:00:00' });
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_09_12);
    // El 09/12, una sola: la del 07/12, con su motivo
    assert.deepEqual(items.filter(({ fecha }) => fecha === '2026-12-09').map(resumen), [{
      fecha: '2026-12-09', hora: '08:05', nombre: 'Sale el dato de la quincena',
      detalle: 'Edición del lunes 07/12: no son hábiles el lunes 07/12, Día no laborable con fines turísticos y el martes 08/12, '
        + 'Inmaculada Concepción de María.'
    }]);
    // También en reintento: con la edición vencida, la corrida no reintenta
    const enReintento = enMiEspacio({
      ultima: ultimaDel('2026-11-23', correo('programada'), [fallido(1, 1)]), ahora: '2026-12-06 10:00:00'
    });
    assert.deepEqual(fechas(enReintento), SERIE_DESDE_EL_09_12);
    // La corrida del 09/12 la da por vieja
    assert.deepEqual(decidirCorrida({
      programadas: [{ id: 1, fecha_edicion: '2026-11-23' }], envioActivo: true, hoy: '2026-12-09', calendario: CALENDARIO
    }), { mandar: null, noEnviar: [{ id: 1, motivo: 'vieja' }] });
  });

  it('el día 13 de vigencia: antes de las 14:00 sale ese día; después, la salida del día siguiente cae fuera y no va', () => {
    // Una regular del viernes 20/11 (la regla no mira el día de la semana): el jueves 03/12, hábil, es su día 13
    const ultima = ultimaDel('2026-11-20', correo('programada'));
    assert.deepEqual(resumen(enMiEspacio({ ultima, ahora: '2026-12-03 10:00:00' })[0]), {
      fecha: '2026-12-03', hora: '14:00', nombre: 'Sale el dato de la quincena', detalle: 'Edición del viernes 20/11.'
    });
    const despues = enMiEspacio({ ultima, ahora: '2026-12-03 15:00:00' });
    assert.ok(despues.every(({ detalle }) => detalle !== 'Edición del viernes 20/11.'), JSON.stringify(despues));
    assert.deepEqual(fechas(despues), ['2026-12-04', '2026-12-18', '2027-01-04', '2027-01-15', '2027-01-29']);
    // Las corridas dicen lo mismo: la del 03/12 la manda y la del 04/12 la da por vieja
    const corrida = (hoy) => decidirCorrida({
      programadas: [{ id: 1, fecha_edicion: '2026-11-20' }], envioActivo: true, hoy, calendario: CALENDARIO
    });
    assert.deepEqual(corrida('2026-12-03'), { mandar: 1, noEnviar: [] });
    assert.deepEqual(corrida('2026-12-04'), { mandar: null, noEnviar: [{ id: 1, motivo: 'vieja' }] });
  });

  it('una no enviada no va: la serie sigue', () => {
    const items = enMiEspacio({
      ultima: ultimaDel('2026-11-23', correo('no_enviada', 'sin_lista')), ahora: '2026-11-24 10:30:00'
    });
    assert.deepEqual(fechas(items), SERIE_DESDE_EL_09_12);
  });

  it('una que no le llegó a nadie no va', () => {
    const ultima = ultimaDel('2026-11-23', correo('programada'), [fallido(1, MAXIMO_DE_INTENTOS)]);
    assert.deepEqual(fechas(enMiEspacio({ ultima, ahora: '2026-11-25 10:30:00' })), SERIE_DESDE_EL_09_12);
  });

  it('por fecha y a lo sumo cinco, en todos los casos', () => {
    const casos = [
      enMiEspacio(),
      enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('programada')), ahora: '2026-11-24 07:40:00' }),
      enMiEspacio({ ultima: salioEl24, ahora: '2026-11-24 10:30:00' }),
      enMiEspacio({ ultima: ultimaDel('2026-12-21', correo('programada')), ahora: '2026-12-21 15:00:00' })
    ];
    for (const items of casos) {
      assert.equal(items.length, CUANTAS_EN_MI_ESPACIO);
      assert.deepEqual(fechas(items), [...fechas(items)].sort());
    }
  });

  it('ningún texto usa las palabras que el sistema no usa', () => {
    const textos = [
      enMiEspacio(),
      enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('programada')), ahora: '2026-11-24 07:40:00' }),
      enMiEspacio({ ultima: salioEl24, ahora: '2026-11-24 10:30:00' }),
      enMiEspacio({ ultima: salioEl24, ahora: '2026-11-25 08:00:00' }),
      enMiEspacio({ ultima: ultimaDel('2026-12-21', correo('programada')), ahora: '2026-12-21 10:30:00' }),
      enMiEspacio({ ultima: ultimaDel('2026-12-21', correo('programada'), [fallido(1, 1)]), ahora: '2026-12-21 15:00:00' }),
      enMiEspacio({ ultima: ultimaDel('2026-11-23', correo('no_enviada', 'sin_lista')), ahora: '2026-11-24 10:30:00' })
    ].flat().flatMap(({ texto, nombre, titulo, detalle }) => [texto, nombre, titulo, detalle]);
    for (const texto of textos) {
      assert.doesNotMatch(texto, PROHIBIDAS);
      assert.doesNotMatch(texto, /\btarde\b/i);
    }
  });
});

describe('modeloDelMail: lo que recibe la plantilla (spec, 10)', () => {
  const fila = (cambios = {}) => ({
    id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
    titulo: 'El dato de la quincena: edición de prueba', metadata: '{}', recibida_ts: 1793618040, numero: 1, ...cambios
  });
  const detalleDe = (edicion, cambios) => detalleDeLaEdicion({
    fila: fila(cambios), edicion, guardadas: [{ orden: 1, dataset_id: 1, dataset_activo: true }], adjuntos: []
  });
  const URL_DE_PRUEBA = 'https://rpad.ejemplo.test/dato-quincena.html?id=12';
  const modelo = (cambios = {}) => modeloDelMail({
    detalle: detalleDe(edicionDePrueba()), fecha_edicion: '2026-11-02', nombreCompleto: 'Persona Uno Ejemplo', url: URL_DE_PRUEBA,
    prueba: false, ...cambios
  });

  it('el asunto, el título, el número, la bajada, el primer nombre y la dirección', () => {
    const m = modelo();
    assert.equal(m.asunto, 'Dato de la Quincena - 02/11/2026');
    assert.equal(m.titulo, 'Dato de la Quincena - 02/11/2026');
    assert.equal(m.numero, 'Edición N.º 1');
    assert.equal(m.bajada, '2 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.');
    assert.equal(m.primerNombre, 'Persona');
    assert.equal(m.url, URL_DE_PRUEBA);
    assert.deepEqual(Object.keys(m), [
      'asunto', 'primerNombre', 'titulo', 'numero', 'bajada', 'aclaracion', 'recuadro', 'agenda_grupos', 'propuestas',
      'propuestas_datasets', 'url', 'nombreDelBot'
    ]);
  });

  // spec 2026-11-21-dato-quincena-principal-equipo, 5: la frase de la principal, con el nombre de NOMBRE_DEL_BOT (la plantilla no
  // lo nombra), y el recuadro con el botón al RPAD. Fijos: no leen la elección del equipo, así que la corrida, un reintento, un
  // reenvío y la prueba salen iguales antes y después de que el equipo elija
  it('la frase de la principal y el recuadro: fijos, con el nombre del bot', () => {
    const m = modelo();
    assert.equal(m.aclaracion, 'La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.');
    assert.equal(m.aclaracion,
      `La principal de este correo es la que marcó ${NOMBRE_DEL_BOT}: la del equipo se elige y se ve en el RPAD.`);
    assert.equal(m.recuadro, true);
    for (const cambios of [{ prueba: true }, { nombreCompleto: null }]) {
      assert.equal(modelo(cambios).aclaracion, m.aclaracion, JSON.stringify(cambios));
      assert.equal(modelo(cambios).recuadro, true, JSON.stringify(cambios));
    }
    const piloto = detalleDe(pilotoDePrueba(), { tipo: 'piloto', referencia_piloto: 'piloto-4', numero: null });
    assert.equal(modelo({ detalle: piloto, prueba: true }).aclaracion, m.aclaracion);
  });

  // Review Focus 4 del plan 2026-11-21-dato-quincena-principal-equipo: lo que el detalle suma para la página (las dos principales)
  // no entra al modelo. El detalle armado con una elección del equipo da el mismo modelo que el armado sin ella
  it('el modelo no lee la principal del equipo: con una elegida, el mismo modelo', () => {
    const base = { fila: fila(), guardadas: [{ orden: 1, dataset_id: 1, dataset_activo: true }], adjuntos: [] };
    const sinElegir = detalleDeLaEdicion({ ...base, edicion: edicionDePrueba() });
    const elegida = detalleDeLaEdicion({
      ...base, edicion: edicionDePrueba(), eleccion: { orden: 2, nombre: 'Persona Inventada', elegida_at: '2026-11-23 10:12:00' }
    });
    // La elección sí llegó al detalle: la del equipo es otra que la de Datito
    assert.equal(elegida.principal_equipo.orden, 2);
    assert.equal(elegida.principal_equipo.coincide, false);
    assert.notDeepEqual(elegida.principal_equipo, sinElegir.principal_equipo);
    assert.deepEqual(modelo({ detalle: elegida }), modelo({ detalle: sinElegir }));
  });

  // El nombre del bot vive solo en NOMBRE_DEL_BOT (spec, 2.10): la plantilla lo recibe en el modelo para la nota del pie
  it('el nombre del bot, el de NOMBRE_DEL_BOT', () => {
    assert.equal(modelo().nombreDelBot, NOMBRE_DEL_BOT);
  });

  it('una prueba lleva «[PRUEBA] » delante del asunto, no del título', () => {
    const m = modelo({ prueba: true });
    assert.equal(m.asunto, '[PRUEBA] Dato de la Quincena - 02/11/2026');
    assert.equal(m.titulo, 'Dato de la Quincena - 02/11/2026');
  });

  it('el primer nombre, sin espacios de más; sin nombre, null', () => {
    assert.equal(modelo({ nombreCompleto: '  Persona   Dos ' }).primerNombre, 'Persona');
    assert.equal(modelo({ nombreCompleto: '' }).primerNombre, null);
    assert.equal(modelo({ nombreCompleto: null }).primerNombre, null);
  });

  it('las propuestas en su orden, con su franja «Propuesta N de M» y la principal marcada', () => {
    const { propuestas } = modelo();
    assert.deepEqual(propuestas.map((p) => [p.franja, p.principal]), [['Propuesta 1 de 2', true], ['Propuesta 2 de 2', false]]);
    const detalle = detalleDe(edicionDePrueba());
    const { para_copiar, borrador_para_copiar, orden_texto, orden, ...resto } = detalle.propuestas[0];
    assert.deepEqual(propuestas[0], { franja: 'Propuesta 1 de 2', ...resto });
  });

  // spec 2026-11-18-dato-quincena-detalle-pestanas, 6: el detalle suma `orden` en cada propuesta (para la dirección y el índice de
  // la página) y el mail lo deja afuera, como `orden_texto`: el modelo de las propuestas no cambia
  it('las propuestas del modelo, con las claves de siempre: sin orden, orden_texto ni lo que se copia', () => {
    const detalle = detalleDe(edicionDePrueba());
    assert.deepEqual(detalle.propuestas.map((p) => p.orden), [1, 2]);
    for (const propuesta of modelo({ detalle }).propuestas) {
      assert.deepEqual(Object.keys(propuesta), [
        'franja', 'etiquetas', 'principal', 'titulo', 'cifra_clave', 'dataset', 'foto', 'repeticion', 'notas_validacion', 'calculo',
        'contexto_historico', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes', 'puntos_centrales', 'borrador_nota', 'fuentes'
      ]);
    }
  });

  // spec 2026-11-14-dato-quincena-agenda-grupos: el mail muestra la agenda en sus grupos, como la página; la lista sin agrupar no va
  it('la agenda en sus grupos, tal como los arma el detalle', () => {
    const edicion = edicionDePrueba();
    edicion.agenda.push(efemerideDePrueba());
    const detalle = detalleDe(edicion);
    assert.deepEqual(modelo({ detalle }).agenda_grupos, detalle.agenda_grupos);
    assert.deepEqual(modelo({ detalle }).agenda_grupos.map((grupo) => grupo.titulo), ['Lo que viene', 'Efemérides']);
    assert.ok(!Object.hasOwn(modelo({ detalle }), 'agenda'));
  });

  it('una sola propuesta: «1 propuesta de comunicación…»', () => {
    const edicion = edicionDePrueba();
    edicion.propuestas = edicion.propuestas.slice(0, 1);
    assert.equal(modelo({ detalle: detalleDe(edicion) }).bajada,
      '1 propuesta de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.');
  });

  it('un piloto (solo una prueba): en lugar del número, su marca', () => {
    const detalle = detalleDe(pilotoDePrueba(), { tipo: 'piloto', referencia_piloto: 'piloto-4', numero: null });
    assert.equal(modelo({ detalle, prueba: true }).numero, 'Piloto 4');
  });

  // spec 2026-11-14-dato-quincena-v1-3, 5: el modelo copia cada propuesta del detalle, así que la repetición llega sola
  it('la repetición y las etiquetas para mostrar llegan solas, como las arma el detalle', () => {
    const edicion = edicionDePrueba({ fecha_edicion: '2026-11-16' });
    edicion.propuestas[0].etiquetas.push('Repite');
    edicion.propuestas[0].repeticion = repeticionDePrueba();
    edicion.propuestas[1].etiquetas = ['Efemeride'];
    const detalle = detalleDeLaEdicion({
      fila: fila(), edicion, guardadas: [], adjuntos: [], previas: new Map([['2026-11-02', { id: 12, rpad_ids: [1, 2] }]])
    });
    const { propuestas } = modelo({ detalle });
    assert.deepEqual(propuestas[0].repeticion, {
      texto: 'Repite el dataset de la edición del 02/11/2026.',
      motivo: 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.',
      id_edicion: 12
    });
    assert.equal(propuestas[1].repeticion, null);
    assert.deepEqual(propuestas.map((p) => p.etiquetas), [['Principal', 'Validar', 'Repite'], ['Efeméride']]);
    assert.deepEqual(modelo().propuestas.map((p) => p.repeticion), [null, null]);
  });

  // spec 2026-11-18-dato-quincena-propuestas-datasets, 6: la lista del detalle, con la franja «Dataset nuevo N de M» primero en
  // cada una; null si la edición no trae la clave (todas las archivadas antes de la v1.4 y las v1.3)
  it('las propuestas de datasets: null sin la clave; si no, la lista del detalle con su franja «Dataset nuevo N de M» primero', () => {
    assert.equal(modelo().propuestas_datasets, null);
    const detalle = detalleDe(edicionDePrueba({ propuestas_datasets: propuestasDatasetsDePrueba() }));
    const { propuestas_datasets: lista } = modelo({ detalle });
    assert.deepEqual(lista.map((propuesta) => propuesta.franja), ['Dataset nuevo 1 de 3', 'Dataset nuevo 2 de 3', 'Dataset nuevo 3 de 3']);
    lista.forEach((propuesta, i) => {
      assert.deepEqual(Object.keys(propuesta), ['franja', ...Object.keys(detalle.propuestas_datasets[i])]);
      const { franja, ...resto } = propuesta;
      assert.deepEqual(resto, detalle.propuestas_datasets[i]);
    });
    const una = detalleDe(edicionDePrueba({ propuestas_datasets: [propuestaDatasetDePrueba()] }));
    assert.equal(modelo({ detalle: una }).propuestas_datasets[0].franja, 'Dataset nuevo 1 de 1');
    assert.deepEqual(modelo({ detalle: detalleDe(edicionDePrueba({ propuestas_datasets: [] })) }).propuestas_datasets, []);
  });

  it('las propuestas de datasets: un detalle sin la clave o con algo que no es una lista da null, sin tirar', () => {
    for (const valor of [undefined, null, 'tres', 3, {}, { length: 1 }]) {
      const detalle = detalleDe(edicionDePrueba());
      if (valor === undefined) delete detalle.propuestas_datasets;
      else detalle.propuestas_datasets = valor;
      assert.equal(modelo({ detalle }).propuestas_datasets, null, String(valor));
    }
  });

  it('no cambia el detalle que recibe', () => {
    const detalle = detalleDe(edicionDePrueba());
    const antes = structuredClone(detalle);
    const m = modelo({ detalle });
    m.propuestas[0].fuentes.push('otra');
    m.agenda_grupos[0].eventos.push({});
    m.agenda_grupos.push({});
    assert.deepEqual(detalle, antes);
    // Ni las propuestas de datasets: el modelo las copia
    const conDatasets = detalleDe(edicionDePrueba({ propuestas_datasets: propuestasDatasetsDePrueba() }));
    const antesConDatasets = structuredClone(conDatasets);
    const otro = modelo({ detalle: conDatasets });
    otro.propuestas_datasets[0].campos.push('otro');
    otro.propuestas_datasets[0].prioridad.clave = 'evaluar';
    otro.propuestas_datasets[0].datasets_relacionados[0].nombre = 'Otro';
    otro.propuestas_datasets.push({});
    assert.deepEqual(conDatasets, antesConDatasets);
  });
});

// El mail que sale de ese modelo (spec, 10; la plantilla está en services/emailTemplates.js y el diseño del HTML, en
// tests/email-diseno.test.js): el texto plano lo arma el servidor con lo mismo, no el correo_texto del bot
describe('datoQuincenaTemplate: el texto plano y el nombre del bot', () => {
  const fila = {
    id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
    titulo: 'El dato de la quincena: edición de prueba', metadata: '{}', recibida_ts: 1793618040, numero: 1
  };
  // La edición de prueba con la efeméride sumada a su agenda
  const modelo = (cambios = {}) => {
    const edicion = edicionDePrueba();
    edicion.agenda.push(efemerideDePrueba());
    const detalle = detalleDeLaEdicion({ fila, edicion, guardadas: [{ orden: 1, dataset_id: 1, dataset_activo: true }], adjuntos: [] });
    return modeloDelMail({
      detalle, fecha_edicion: '2026-11-02', nombreCompleto: 'Persona Uno Ejemplo',
      url: 'https://rpad.ejemplo.test/dato-quincena.html?id=12', prueba: false, ...cambios
    });
  };

  const TEXTO = [
    'Buen día, Persona.',
    '',
    'Dato de la Quincena - 02/11/2026',
    'Edición N.º 1',
    '2 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.',
    'La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.',
    '',
    'Esta edición se lee mejor en el RPAD: https://rpad.ejemplo.test/dato-quincena.html?id=12',
    '',
    'La infografía de la propuesta principal. Va adjunta en PNG y en SVG (para editarla).',
    '',
    'Agenda de la quincena',
    'Lo que viene',
    '10/11/2026 · Evento de prueba',
    'Un evento inventado para las pruebas.',
    'https://datos.ejemplo.gob.ar/agenda/evento-de-prueba',
    '',
    'Efemérides',
    '20/11/2026 · Efeméride de prueba',
    'Una efeméride inventada para las pruebas.',
    'https://datos.ejemplo.gob.ar/agenda/efemeride-de-prueba',
    '',
    'Propuesta 1 de 2 (principal)',
    'Un título inventado [Validar]',
    '1.234 casos · septiembre de 2026',
    '',
    'Dataset: Dataset de prueba A',
    'https://datos.ejemplo.gob.ar/dataset/prueba-a',
    'En el RPAD ese día: Actualizado. Datos al 30/09/2026. Última actualización 30/10/2026. Próxima en 29 días.',
    '',
    'Para validar antes de publicar',
    '- Primera nota.',
    '- Segunda nota.',
    '',
    'Por qué hoy',
    'Una razón inventada para publicarlo hoy.',
    '',
    'Ángulo',
    'Un ángulo inventado.',
    '',
    'Idea de placa',
    'Una idea de placa inventada.',
    '',
    'Texto para redes',
    'Un texto para redes inventado.',
    'Con un segundo renglón.',
    '',
    'Puntos centrales',
    '- Primer punto inventado.',
    '- Segundo punto inventado.',
    '- Tercer punto inventado.',
    '',
    'Borrador de nota',
    'Un borrador inventado',
    '',
    'Primer párrafo inventado.',
    '',
    'Segundo párrafo inventado.',
    '',
    'Fuentes',
    'https://datos.ejemplo.gob.ar/a.csv',
    'https://datos.ejemplo.gob.ar/b.csv',
    '',
    'Propuesta 2 de 2',
    'Otro título inventado [Agenda]',
    '56 casos · septiembre de 2026',
    '',
    'Dataset: Dataset de prueba B',
    'https://datos.ejemplo.gob.ar/dataset/prueba-b',
    'En el RPAD ese día: Próximo a vencer. Datos al —. Última actualización 03/06/2026. Próxima en 4 días.',
    '',
    'Por qué hoy',
    'Otra razón inventada.',
    '',
    'Ángulo',
    'Otro ángulo inventado.',
    '',
    'Idea de placa',
    'Otra placa inventada.',
    '',
    'Texto para redes',
    'Otro texto para redes inventado.',
    '',
    'Puntos centrales',
    '- Un punto.',
    '- Otro punto.',
    '- Un tercer punto.',
    '',
    'Borrador de nota',
    'Otro borrador inventado',
    '',
    'Un párrafo.',
    '',
    'Otro párrafo.',
    '',
    'Un tercer párrafo.',
    '',
    'Fuentes',
    'https://datos.ejemplo.gob.ar/c.csv',
    '',
    'Ver la edición en el RPAD: https://rpad.ejemplo.test/dato-quincena.html?id=12',
    '',
    'En el RPAD también están el texto del correo de Datito, los cálculos y la edición completa. Te llega porque estás en la '
      + 'lista del dato de la quincena; para dejar de recibirlo, avisale a la Dirección.'
  ].join('\n');

  it('empieza con «Buen día, Persona.», cada propuesta con su franja y cada campo con su título, sin HTML', () => {
    const { subject, text } = datoQuincenaTemplate(modelo(), { conSvg: true });
    assert.equal(subject, 'Dato de la Quincena - 02/11/2026');
    assert.ok(text.startsWith('Buen día, Persona.\n'));
    assert.equal(text.split('Propuesta 1 de 2 (principal)').length - 1, 1);
    assert.ok(!text.includes('Propuesta 2 de 2 (principal)'));
    assert.doesNotMatch(text, /<\/?[a-z][^>]*>|&(amp|lt|gt|quot|nbsp);/i);
    assert.equal(text, TEXTO);
  });

  // spec 2026-11-21-dato-quincena-principal-equipo, 5: la frase, en el bloque del título, debajo de la bajada; el recuadro, en un
  // bloque propio después del del título, con la misma dirección del final. Sin las dos claves, el texto de antes
  it('la frase debajo de la bajada y el recuadro en su bloque, con la dirección del final; sin las claves, el texto de antes', () => {
    const { text } = datoQuincenaTemplate(modelo(), { conSvg: true });
    const FRASE = 'La principal de este correo es la que marcó Datito: la del equipo se elige y se ve en el RPAD.';
    const RECUADRO = 'Esta edición se lee mejor en el RPAD: https://rpad.ejemplo.test/dato-quincena.html?id=12';
    assert.ok(text.includes(`ni publicadas.\n${FRASE}\n\n${RECUADRO}\n\nLa infografía`));
    assert.equal(text.split('https://rpad.ejemplo.test/dato-quincena.html?id=12').length - 1, 2);
    const m = modelo();
    delete m.aclaracion;
    delete m.recuadro;
    assert.equal(datoQuincenaTemplate(m, { conSvg: true }).text, TEXTO.replace(`\n${FRASE}`, '').replace(`${RECUADRO}\n\n`, ''));
  });

  it('sin SVG, el pie de la infografía no lo nombra; sin nombre, «Buen día.»; una prueba lleva «[PRUEBA] » en el asunto', () => {
    const { subject, text } = datoQuincenaTemplate(modelo({ nombreCompleto: null, prueba: true }));
    assert.equal(subject, '[PRUEBA] Dato de la Quincena - 02/11/2026');
    assert.ok(text.startsWith('Buen día.\n\nDato de la Quincena - 02/11/2026\n'));
    assert.ok(text.includes('\nLa infografía de la propuesta principal. Va adjunta en PNG.\n'));
  });

  it('sin agenda no va el bloque; un piloto lleva su marca en lugar del número', () => {
    const m = modelo();
    m.agenda_grupos = [];
    m.numero = 'Piloto 4';
    const { text } = datoQuincenaTemplate(m, { conSvg: true });
    assert.ok(!text.includes('Agenda de la quincena'));
    assert.ok(text.includes('02/11/2026\nPiloto 4\n2 propuestas'));
    assert.ok(text.includes('(para editarla).\n\nPropuesta 1 de 2 (principal)\n'));
  });

  it('una dirección que no es https:// no va en el dataset ni en la agenda; en las fuentes, como llegó', () => {
    const m = modelo();
    m.agenda_grupos[0].eventos[0].url = 'http://datos.ejemplo.gob.ar/agenda';
    m.propuestas[0].dataset.url = 'http://datos.ejemplo.gob.ar/dataset';
    m.propuestas[0].fuentes = ['http://datos.ejemplo.gob.ar/a.csv'];
    const { text } = datoQuincenaTemplate(m, { conSvg: true });
    assert.ok(text.includes('Lo que viene\n10/11/2026 · Evento de prueba\nUn evento inventado para las pruebas.\n\nEfemérides\n'));
    assert.ok(text.includes('Dataset: Dataset de prueba A\nEn el RPAD ese día:'));
    assert.ok(text.includes('Fuentes\nhttp://datos.ejemplo.gob.ar/a.csv\n'));
  });

  // spec 2026-11-14-dato-quincena-v1-3, 5: el bloque de la repetición, «<texto>\n<motivo>», en el mismo lugar que en el HTML:
  // después del dataset y la foto, antes de «Para validar»; las etiquetas, como se muestran
  it('con repetición: su bloque después del dataset y la foto, y las etiquetas como se muestran; sin ella, el texto de siempre', () => {
    const m = modelo();
    m.propuestas[0].etiquetas = ['Principal', 'Validar', 'Repite'];
    m.propuestas[0].repeticion = {
      texto: 'Repite el dataset de la edición del 02/11/2026.', motivo: 'Datos nuevos: Uno.\nDos.', id_edicion: 12
    };
    m.propuestas[1].etiquetas = ['Agenda', 'Efeméride'];
    const { text } = datoQuincenaTemplate(m, { conSvg: true });
    assert.equal(text, TEXTO
      .replace('Un título inventado [Validar]', 'Un título inventado [Validar, Repite]')
      .replace('Próxima en 29 días.\n\nPara validar', 'Próxima en 29 días.\n\nRepite el dataset de la edición del 02/11/2026.\n'
        + 'Datos nuevos: Uno.\nDos.\n\nPara validar')
      .replace('Otro título inventado [Agenda]', 'Otro título inventado [Agenda, Efeméride]'));
    // Sin un id, el mismo texto: el texto plano no lleva el enlace
    m.propuestas[0].repeticion.id_edicion = null;
    assert.equal(datoQuincenaTemplate(m, { conSvg: true }).text, text);
    // Sin notas para validar, antes de «Por qué hoy»
    m.propuestas[0].notas_validacion = [];
    assert.ok(datoQuincenaTemplate(m, { conSvg: true }).text.includes('Próxima en 29 días.\n\nRepite el dataset de la edición del '
      + '02/11/2026.\nDatos nuevos: Uno.\nDos.\n\nPor qué hoy\n'));
    assert.equal(datoQuincenaTemplate(modelo(), { conSvg: true }).text, TEXTO);
  });

  // spec 2026-11-14-dato-quincena-agenda-grupos: el título de cada grupo en su renglón y sus eventos debajo, por fecha, sin la
  // etiqueta «Efeméride» (el título del grupo ya lo dice); los grupos, en su orden y separados por un renglón en blanco
  it('la agenda en sus tres grupos: cada título en su renglón, sus eventos debajo y sin etiquetas', () => {
    const edicion = edicionDePrueba({
      fecha_edicion: '2026-11-16',
      agenda: [
        { titulo: 'Lo que viene después', fecha: '2026-11-25', detalle: 'Uno inventado.', url: 'https://datos.ejemplo.gob.ar/v2' },
        { ...efemerideDePrueba() },
        { titulo: 'Lo que viene antes', fecha: '2026-11-16', detalle: '', url: 'https://datos.ejemplo.gob.ar/v1', tipo: 'evento' },
        { titulo: 'Lo que pasó', fecha: '2026-11-10', detalle: 'Otro inventado.', url: 'http://datos.ejemplo.gob.ar/p' }
      ]
    });
    const detalle = detalleDeLaEdicion({ fila: { ...fila, fecha_edicion: '2026-11-16' }, edicion, guardadas: [], adjuntos: [] });
    const { text } = datoQuincenaTemplate(modelo({ detalle, fecha_edicion: '2026-11-16' }), { conSvg: true });
    assert.ok(text.includes([
      '(para editarla).',
      '',
      'Agenda de la quincena',
      'Lo que pasó',
      '10/11/2026 · Lo que pasó',
      'Otro inventado.',
      '',
      'Lo que viene',
      '16/11/2026 · Lo que viene antes',
      'https://datos.ejemplo.gob.ar/v1',
      '',
      '25/11/2026 · Lo que viene después',
      'Uno inventado.',
      'https://datos.ejemplo.gob.ar/v2',
      '',
      'Efemérides',
      '20/11/2026 · Efeméride de prueba',
      'Una efeméride inventada para las pruebas.',
      'https://datos.ejemplo.gob.ar/agenda/efemeride-de-prueba',
      '',
      'Propuesta 1 de 2 (principal)'
    ].join('\n')), text);
    assert.ok(!text.includes('(Efeméride)'));
  });

  // La plantilla no nombra al bot: la nota del pie dice el nombre que trae el modelo (modeloDelMail pone el de NOMBRE_DEL_BOT)
  it('la nota del pie nombra al bot con el nombre del modelo, en el HTML y en el texto', () => {
    const m = modelo();
    m.nombreDelBot = 'Bot de prueba';
    const { html, text } = datoQuincenaTemplate(m, { conSvg: true });
    const nota = 'En el RPAD también están el texto del correo de Bot de prueba, los cálculos y la edición completa.';
    assert.ok(html.includes(nota));
    assert.ok(text.includes(nota));
    assert.ok(!html.includes(`correo de ${NOMBRE_DEL_BOT}`) && !text.includes(`correo de ${NOMBRE_DEL_BOT}`));
  });
});

// spec 2026-11-18-dato-quincena-propuestas-datasets, 6: la sección «Propuestas de datasets nuevos», después de las propuestas y
// antes del botón, en el HTML y en el texto. Sin la clave, nada: tests/dato-quincena-resguardo.test.js compara ese mail, byte por
// byte, con el de main 8784663. Las propuestas son las inventadas de propuestasDatasetsDePrueba, una de cada prioridad
describe('datoQuincenaTemplate: las propuestas de datasets nuevos (contrato v1.4)', () => {
  const fila = {
    id: 12, clave: 'dq:regular:2026-11-02', tipo: 'regular', fecha_edicion: '2026-11-02', referencia_piloto: null,
    titulo: 'El dato de la quincena: edición de prueba', metadata: '{}', recibida_ts: 1793618040, numero: 1
  };
  // El modelo de la edición de prueba con `propuestas_datasets`; sin argumento, sin la clave
  const modelo = (...lista) => {
    const edicion = edicionDePrueba(lista.length === 0 ? {} : { propuestas_datasets: lista[0] });
    const detalle = detalleDeLaEdicion({ fila, edicion, guardadas: [{ orden: 1, dataset_id: 1, dataset_activo: true }], adjuntos: [] });
    return modeloDelMail({
      detalle, fecha_edicion: '2026-11-02', nombreCompleto: 'Persona Uno Ejemplo',
      url: 'https://rpad.ejemplo.test/dato-quincena.html?id=12', prueba: false
    });
  };
  const mail = (m) => datoQuincenaTemplate(m, { conSvg: true });
  const SIN = mail(modelo());
  const TITULO = 'Propuestas de datasets nuevos';
  const VACIA = 'Esta quincena no hay propuestas de datasets.';
  const BOTON = 'Ver la edición en el RPAD';
  const RAYA = '\n          </tr>';
  const veces = (texto, parte) => texto.split(parte).length - 1;
  // La fila del marco que trae la sección, y el HTML sin ella: tiene que ser el de siempre
  const filaDeLaSeccion = (html) => {
    const titulo = html.indexOf(`>${TITULO}</h3>`);
    return html.slice(html.lastIndexOf('\n          <tr>', titulo), html.indexOf(RAYA, titulo) + RAYA.length);
  };
  const sinLaSeccion = (html) => html.replace(filaDeLaSeccion(html), '');
  // Cada tarjeta, de su franja a la siguiente
  const tarjetasDe = (html) => filaDeLaSeccion(html).split('>Dataset nuevo ').slice(1);
  // Que cada parte esté en ese orden en el texto
  const enOrden = (texto, partes) => {
    const lugares = partes.map((parte) => texto.indexOf(parte));
    assert.ok(lugares.every((lugar) => lugar >= 0), `faltan: ${partes.filter((_, i) => lugares[i] < 0).join(' | ')}`);
    assert.deepEqual([...lugares].sort((a, b) => a - b), lugares, partes.join(' | '));
  };
  // El mail desde la infografía: el botón del recuadro al RPAD, arriba (spec 2026-11-21-dato-quincena-principal-equipo, 5), queda
  // afuera, y el que sigue a la sección es el del final
  const desdeLaInfografia = (html) => html.slice(html.indexOf('<img src="cid:'));
  const PASTILLA_NEUTRA = 'background-color: #E4E9EF; color: #2B3A4A; font-size: 12px; font-weight: 600; padding: 2px 10px; '
    + 'border-radius: 10px;';
  const pastillaNeutra = (texto) => `<span style="display: inline-block; margin: 0 6px 6px 0; ${PASTILLA_NEUTRA}">${texto}</span>`;
  const ENLACES = '<p style="margin: 0; color: #2B3A4A; font-size: 13px; line-height: 1.6; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;">';
  const CAMPOS = '<p style="margin: 0; color: #2B3A4A; font-size: 13px; line-height: 1.7; font-family: Consolas, Menlo, monospace; '
    + 'word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;">';
  const enlace = (url, texto) => `<a href="${url}" style="color: #3E6B96; text-decoration: none;">${texto}</a>`;
  const JUSTIFICACION = 'Una justificación inventada: el tema aparece en la agenda de prueba y en dos pedidos de acceso inventados.';
  const PORTAL = 'https://datos.comodoro.gov.ar/dataset/';
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
  const ESCAPADO = '&lt;b&gt;x&lt;/b&gt;';

  it('sin la clave (null), ninguna sección: ni su título en el HTML ni nada en el texto', () => {
    assert.equal(modelo().propuestas_datasets, null);
    assert.ok(!SIN.html.includes(TITULO) && !SIN.text.includes(TITULO));
    assert.ok(!SIN.html.includes('Dataset nuevo') && !SIN.text.includes('Dataset nuevo'));
    // Un modelo sin la clave o con algo que no es una lista: lo mismo
    for (const valor of [undefined, 'tres', 3, {}]) {
      const m = modelo();
      if (valor === undefined) delete m.propuestas_datasets;
      else m.propuestas_datasets = valor;
      const otro = mail(m);
      assert.equal(otro.html, SIN.html, String(valor));
      assert.equal(otro.text, SIN.text, String(valor));
    }
  });

  // Ola final de la revisión de las pestañas: `numero`, `valor` y `riesgo` son de la página (la matriz y los marcadores); el mail no los dibuja
  it('el mail es el mismo sin `numero`, `valor` ni `riesgo` en cada dataset', () => {
    const con = modelo(propuestasDatasetsDePrueba());
    assert.ok(con.propuestas_datasets.length > 0);
    const sin = structuredClone(con);
    sin.propuestas_datasets = sin.propuestas_datasets.map(({ numero: _n, valor: _v, riesgo: _r, ...resto }) => resto);
    assert.ok(con.propuestas_datasets.some((p) => 'numero' in p || 'valor' in p || 'riesgo' in p));
    const a = mail(con);
    const b = mail(sin);
    assert.equal(a.subject, b.subject);
    assert.equal(a.html, b.html);
    assert.equal(a.text, b.text);
  });

  it('con []: el título y la línea, después de la última propuesta y antes del botón, en el HTML y en el texto', () => {
    const { subject, html, text } = mail(modelo([]));
    assert.equal(subject, SIN.subject);
    assert.ok(html.includes(`<h3 style="margin: 0 0 10px 0; color: #1F3A5F; font-size: 14px; font-weight: 600;">${TITULO}</h3>`
      + `<p style="margin: 0; color: #2B3A4A; font-size: 14px; line-height: 1.6;">${VACIA}</p>`));
    // Una fila más del marco, entre la de las propuestas y la del botón: el resto, igual que sin la clave
    assert.equal(sinLaSeccion(html), SIN.html);
    enOrden(desdeLaInfografia(html), [enlace('https://datos.ejemplo.gob.ar/c.csv', 'https://datos.ejemplo.gob.ar/c.csv'),
      `>${TITULO}</h3>`, `>${VACIA}</p>`, `>${BOTON}</a>`]);
    assert.ok(!html.includes('Dataset nuevo'));
    assert.equal(text, SIN.text.replace(`\n\n${BOTON}: `, `\n\n${TITULO}\n${VACIA}\n\n${BOTON}: `));
    assert.ok(text.includes(`Fuentes\nhttps://datos.ejemplo.gob.ar/c.csv\n\n${TITULO}\n${VACIA}\n\n${BOTON}: https://rpad.ejemplo.test/`));
  });

  it('con tres: una tarjeta por propuesta, en su orden, con su franja verde clara y 16 px entre una y otra', () => {
    const { html } = mail(modelo(propuestasDatasetsDePrueba()));
    assert.equal(sinLaSeccion(html), SIN.html);
    const franja = (n) => '<td bgcolor="#EEF6F1" style="padding: 8px 16px; background-color: #EEF6F1; border-bottom: 1px solid #D5E9DD;">'
      + `<span style="color: #2E6B4C; font-size: 13px; font-weight: 700;">Dataset nuevo ${n} de 3</span></td>`;
    enOrden(desdeLaInfografia(html), [enlace('https://datos.ejemplo.gob.ar/c.csv', 'https://datos.ejemplo.gob.ar/c.csv'),
      `>${TITULO}</h3>`, franja(1), franja(2), franja(3), `>${BOTON}</a>`]);
    assert.ok(!html.includes(VACIA));
    assert.equal(veces(html, 'bgcolor="#EEF6F1"'), 3);
    // Cada una en una tarjeta blanca con el borde de las propuestas que no son la principal
    const tarjeta = 'background-color: #FFFFFF; border: 1px solid #E1EAF3; border-radius: 6px; border-collapse: separate; '
      + 'border-spacing: 0; overflow: hidden;';
    assert.equal(veces(html, tarjeta) - veces(SIN.html, tarjeta), 3);
    // 16 px entre una tarjeta y otra, con una fila de alto fijo (Outlook)
    assert.equal(veces(html, '<td height="16" style="height: 16px; font-size: 0; line-height: 0;">&nbsp;</td>'), 2);
    assert.equal(tarjetasDe(html).length, 3);
  });

  it('cada tarjeta: los orígenes en pastillas neutras, el título, la prioridad con su color y su eje, y los campos en su orden', () => {
    const [una, dos, tres] = tarjetasDe(mail(modelo(propuestasDatasetsDePrueba())).html);
    // La prioridad, en negrita (700, como en la maqueta aprobada); las demás pastillas, en 600
    const prioridad = (fondo, color, texto, eje) => `<p style="margin: 8px 0 0 0;"><span style="display: inline-block; margin: 0 8px 0 0; `
      + `background-color: ${fondo}; color: ${color}; font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 10px;">`
      + `${texto}</span><span style="color: #5A7391; font-size: 12px;">${eje}</span></p>`;
    const titulo = (texto) => `<h2 style="margin: 0; color: #1F3A5F; font-size: 16px; font-weight: 600; line-height: 1.3;">${texto}</h2>`;
    const campo = (rotulo, html) => `<h3 style="margin: 14px 0 4px 0; color: #1F3A5F; font-size: 14px; font-weight: 600;">${rotulo}</h3>${html}`;
    const parrafo = (texto) => `<p style="margin: 0; color: #2B3A4A; font-size: 14px; line-height: 1.6;">${texto}</p>`;
    const comunes = (formato) => [
      campo('Por qué abrirlo', parrafo(JUSTIFICACION)),
      campo('Formato sugerido', parrafo(formato)),
      campo('Campos sugeridos', `${CAMPOS}fecha, barrio, cantidad</p>`)
    ];
    enOrden(una, [
      '1 de 3</span>', `<p style="margin: 0 0 6px 0;">${pastillaNeutra('Agenda')}${pastillaNeutra('Pedidos de acceso')}</p>`,
      titulo('Un dataset nuevo inventado'), prioridad('#DDF1E6', '#2E6B4C', 'Prioridad alta', 'Valor alto · Riesgo bajo'),
      ...comunes('CSV'), '>Datasets relacionados en el portal</h3>', '>Fuentes</h3>'
    ]);
    enOrden(dos, [
      '2 de 3</span>', pastillaNeutra('Noticias'), titulo('Otro dataset nuevo inventado'),
      prioridad('#DCEAF7', '#24507A', 'Publicar si hay recursos', 'Valor medio · Riesgo medio'), ...comunes('GeoJSON'),
      '<strong>Cómo anonimizar</strong>', '>Fuentes</h3>'
    ]);
    enOrden(tres, [
      '3 de 3</span>',
      ['Cruce de datasets', 'Pedidos de acceso', 'Agenda', 'Noticias'].map(pastillaNeutra).join(''),
      titulo('Un tercer dataset nuevo inventado'), prioridad('#FBF1DC', '#7A5A14', 'Evaluar riesgos', 'Valor alto · Riesgo alto'),
      ...comunes('JSON'), '<strong>Cómo anonimizar</strong>', '>Datasets relacionados en el portal</h3>', '>Fuentes</h3>'
    ]);
    // «Agenda» es un origen: neutra, no en el celeste de la etiqueta de una propuesta
    for (const tarjeta of [una, dos, tres]) assert.ok(!tarjeta.includes('background-color: #E3EEF8; color: #1F3A5F;'));
  });

  it('la anonimización, en el aviso ámbar, solo en las que la traen (riesgo Medio o Alto), con sus saltos de línea', () => {
    const [una, dos, tres] = tarjetasDe(mail(modelo(propuestasDatasetsDePrueba())).html);
    const aviso = (texto) => new RegExp('<td style="padding: 12px 0 0 0;">\\s*<table [^>]*style="width: 100%; background-color: #FBF1DC; '
      + 'border: 1px solid #F0DDB0; border-radius: 6px;[^>]*>(\\s*<(tr|td)[^>]*>)*\\s*<p style="margin: 0; color: #7A5A14; font-size: 14px; '
      + `line-height: 1\\.6;"><strong>Cómo anonimizar</strong><br>${texto.replace(/[.]/g, '\\.')}</p>`);
    assert.ok(!una.includes('Cómo anonimizar') && !una.includes('#FBF1DC; border: 1px solid #F0DDB0'));
    assert.match(dos, aviso('Agrupar por barrio, sin direcciones exactas.'));
    assert.match(tres, aviso('Contar por mes y por zona.<br>Nunca por persona.'));
  });

  it('los datasets relacionados (si hay) y las fuentes, como enlaces https://', () => {
    const [una, dos, tres] = tarjetasDe(mail(modelo(propuestasDatasetsDePrueba())).html);
    const relacionados = `${ENLACES}${enlace(`${PORTAL}prueba-a`, 'Dataset de prueba A')}<br>`
      + `${enlace(`${PORTAL}prueba_relacionada-2`, 'Dataset relacionado de prueba')}</p>`;
    const fuente = 'https://datos.ejemplo.gob.ar/fuentes/dataset-nuevo-de-prueba.csv';
    assert.ok(una.includes(`>Datasets relacionados en el portal</h3>${relacionados}`));
    assert.ok(una.includes(`>Fuentes</h3>${ENLACES}${enlace(fuente, fuente)}</p>`));
    assert.ok(!dos.includes('Datasets relacionados en el portal'));
    assert.ok(dos.includes(`>Fuentes</h3>${ENLACES}${enlace(fuente, fuente)}</p>`));
    assert.ok(tres.includes(`>Datasets relacionados en el portal</h3>${relacionados}`));
    const cinco = [0, 1, 2, 3, 4].map((i) => `https://datos.ejemplo.gob.ar/${i}.csv`);
    assert.ok(tres.includes(`>Fuentes</h3>${ENLACES}${cinco.map((url) => enlace(url, url)).join('<br>')}</p>`));
  });

  it('el texto plano: el mismo bloque, en el mismo lugar, con las tarjetas en su orden', () => {
    const { text } = mail(modelo(propuestasDatasetsDePrueba()));
    const relacionados = [
      'Datasets relacionados en el portal',
      `- Dataset de prueba A: ${PORTAL}prueba-a`,
      `- Dataset relacionado de prueba: ${PORTAL}prueba_relacionada-2`
    ];
    const bloque = [
      TITULO,
      '',
      'Dataset nuevo 1 de 3',
      'Un dataset nuevo inventado [Agenda, Pedidos de acceso]',
      'Prioridad alta (Valor alto · Riesgo bajo)',
      'Por qué abrirlo',
      JUSTIFICACION,
      'Formato sugerido: CSV',
      'Campos sugeridos: fecha, barrio, cantidad',
      ...relacionados,
      'Fuentes',
      'https://datos.ejemplo.gob.ar/fuentes/dataset-nuevo-de-prueba.csv',
      '',
      'Dataset nuevo 2 de 3',
      'Otro dataset nuevo inventado [Noticias]',
      'Publicar si hay recursos (Valor medio · Riesgo medio)',
      'Por qué abrirlo',
      JUSTIFICACION,
      'Formato sugerido: GeoJSON',
      'Campos sugeridos: fecha, barrio, cantidad',
      'Cómo anonimizar',
      'Agrupar por barrio, sin direcciones exactas.',
      'Fuentes',
      'https://datos.ejemplo.gob.ar/fuentes/dataset-nuevo-de-prueba.csv',
      '',
      'Dataset nuevo 3 de 3',
      'Un tercer dataset nuevo inventado [Cruce de datasets, Pedidos de acceso, Agenda, Noticias]',
      'Evaluar riesgos (Valor alto · Riesgo alto)',
      'Por qué abrirlo',
      JUSTIFICACION,
      'Formato sugerido: JSON',
      'Campos sugeridos: fecha, barrio, cantidad',
      'Cómo anonimizar',
      'Contar por mes y por zona.',
      'Nunca por persona.',
      ...relacionados,
      'Fuentes',
      ...[0, 1, 2, 3, 4].map((i) => `https://datos.ejemplo.gob.ar/${i}.csv`)
    ].join('\n');
    assert.equal(text, SIN.text.replace(`\n\n${BOTON}: `, `\n\n${bloque}\n\n${BOTON}: `));
    assert.doesNotMatch(text, /<\/?[a-z][^>]*>|&(amp|lt|gt|quot|nbsp);/i);
  });

  // Review Focus 1: los saltos de línea de la justificación (y de la anonimización, arriba) salen como <br> en el HTML y quedan
  // en el texto
  it('Review Focus 1: una justificación con saltos de línea sale con <br> en el HTML y con sus saltos en el texto', () => {
    const m = modelo(propuestasDatasetsDePrueba());
    m.propuestas_datasets[0].justificacion = 'Primer renglón inventado.\nSegundo renglón.\r\nTercer renglón.';
    const { html, text } = mail(m);
    assert.ok(tarjetasDe(html)[0].includes('>Por qué abrirlo</h3><p style="margin: 0; color: #2B3A4A; font-size: 14px; '
      + 'line-height: 1.6;">Primer renglón inventado.<br>Segundo renglón.<br>Tercer renglón.</p>'));
    assert.ok(text.includes('Por qué abrirlo\nPrimer renglón inventado.\nSegundo renglón.\r\nTercer renglón.\nFormato sugerido: CSV'));
  });

  // Review Focus 2: un texto largo sin espacios (un campo de 64, un slug de 100, una fuente larga) no rompe el ancho del mail
  it('Review Focus 2: los campos y los enlaces llevan word-break: break-word', () => {
    const m = modelo(propuestasDatasetsDePrueba());
    const largo = 'c'.repeat(64);
    const slug = 's'.repeat(100);
    const fuente = `https://datos.ejemplo.gob.ar/${'f'.repeat(1900)}.csv`;
    m.propuestas_datasets[0].campos = [largo, 'barrio', 'cantidad'];
    m.propuestas_datasets[0].datasets_relacionados = [{ nombre: slug, url: `${PORTAL}${slug}` }];
    m.propuestas_datasets[0].fuentes = [fuente];
    const { html } = mail(m);
    const [una] = tarjetasDe(html);
    assert.ok(una.includes(`${CAMPOS}${largo}, barrio, cantidad</p>`));
    assert.ok(una.includes(`>Datasets relacionados en el portal</h3>${ENLACES}${enlace(`${PORTAL}${slug}`, slug)}</p>`));
    assert.ok(una.includes(`>Fuentes</h3>${ENLACES}${enlace(fuente, fuente)}</p>`));
    // Los campos de las tres y sus listas de enlaces: 3 de campos, 2 de relacionados y 3 de fuentes. El mail de siempre no lo usa
    assert.equal(veces(html, 'word-break: break-word'), 8);
    assert.ok(!SIN.html.includes('word-break: break-word'));
  });

  // Review Focus 4: lo que escribió Datito nunca entra como HTML. En el HTML, escapado una sola vez; en el texto, tal cual. Un
  // dataset relacionado o una fuente que no es https:// va sin enlace
  it('Review Focus 4: el HTML de cada texto sale escapado en el HTML y tal cual en el texto; javascript: no es un enlace', () => {
    const raro = '<b>x</b>';
    const conComillas = 'https://datos.ejemplo.gob.ar/a.csv?b="c"&d=<e>';
    const conComillasEscapada = 'https://datos.ejemplo.gob.ar/a.csv?b=&quot;c&quot;&amp;d=&lt;e&gt;';
    const m = modelo(propuestasDatasetsDePrueba());
    const [p] = m.propuestas_datasets;
    Object.assign(p, {
      franja: raro, titulo: raro, origenes: [raro, 'Agenda'], justificacion: `${raro}\n${raro}`, prioridad: { clave: 'alta', texto: raro },
      valor_y_riesgo: raro, formato: raro, campos: [raro, raro], anonimizacion: raro,
      datasets_relacionados: [{ nombre: raro, url: 'javascript:alert(1)' }, { nombre: raro, url: conComillas }],
      fuentes: ['javascript:alert(1)', raro, 'http://datos.ejemplo.gob.ar/sin-https.csv', conComillas]
    });
    const { html, text } = mail(m);
    assert.ok(!html.includes(raro));
    assert.ok(!html.includes('&amp;lt;'), 'escapado dos veces');
    // La franja, el origen, el título, la prioridad, el eje, la justificación (2), el formato, los campos (2), la anonimización,
    // los nombres de los relacionados (2) y la fuente
    assert.equal(veces(html, ESCAPADO), 14);
    assert.ok(!html.includes('href="javascript:') && !html.includes('href="http://'));
    // La franja ya no dice «Dataset nuevo 1 de 3»: se busca en toda la sección (las otras dos no traen nada de esto)
    const una = filaDeLaSeccion(html);
    assert.ok(una.includes(`>Datasets relacionados en el portal</h3>${ENLACES}${ESCAPADO}<br>${enlace(conComillasEscapada, ESCAPADO)}</p>`));
    assert.ok(una.includes(`>Fuentes</h3>${ENLACES}javascript:alert(1)<br>${ESCAPADO}<br>http://datos.ejemplo.gob.ar/sin-https.csv<br>`
      + `${enlace(conComillasEscapada, conComillasEscapada)}</p>`));
    assert.ok(una.includes(`${CAMPOS}${ESCAPADO}, ${ESCAPADO}</p>`));
    assert.ok(una.includes(`<strong>Cómo anonimizar</strong><br>${ESCAPADO}</p>`));
    // El texto plano, tal cual: un relacionado que no es https:// va sin su dirección; las fuentes, como llegaron
    assert.ok(text.includes([
      raro, `${raro} [${raro}, Agenda]`, `${raro} (${raro})`, 'Por qué abrirlo', raro, raro, `Formato sugerido: ${raro}`,
      `Campos sugeridos: ${raro}, ${raro}`, 'Cómo anonimizar', raro, 'Datasets relacionados en el portal', `- ${raro}`,
      `- ${raro}: ${conComillas}`, 'Fuentes', 'javascript:alert(1)', raro, 'http://datos.ejemplo.gob.ar/sin-https.csv', conComillas
    ].join('\n')), text);
  });

  it('con valores raros en el modelo no tira: una prioridad desconocida va en la pastilla neutra y lo que no es texto, vacío', () => {
    const m = modelo([]);
    m.propuestas_datasets = [
      null, 7, 'x',
      {
        franja: 'Dataset nuevo 4 de 6', prioridad: { clave: '__proto__', texto: 'Rara' }, origenes: 'Agenda', campos: null, titulo: 7,
        datasets_relacionados: [null, { nombre: 7, url: 7 }], fuentes: [7, null], anonimizacion: 7, justificacion: { a: 1 }
      },
      { franja: 'Dataset nuevo 5 de 6', prioridad: { clave: 'constructor', texto: 'Otra rara' }, anonimizacion: '   ' },
      { franja: 'Dataset nuevo 6 de 6', prioridad: 'alta', valor_y_riesgo: null, fuentes: 'https://datos.ejemplo.gob.ar/a.csv' }
    ];
    let correo;
    assert.doesNotThrow(() => { correo = mail(m); });
    const { html, text } = correo;
    const seccion = filaDeLaSeccion(html);
    const neutraEnNegrita = PASTILLA_NEUTRA.replace('font-weight: 600', 'font-weight: 700');
    assert.ok(seccion.includes(`<span style="display: inline-block; margin: 0 8px 0 0; ${neutraEnNegrita}">Rara</span>`));
    assert.ok(seccion.includes(`<span style="display: inline-block; margin: 0 8px 0 0; ${neutraEnNegrita}">Otra rara</span>`));
    assert.ok(!seccion.includes('Cómo anonimizar'), 'una anonimización que no es texto o es solo espacios no va');
    assert.equal(veces(seccion, '<td height="16"'), 5);
    for (const parte of [seccion, text]) assert.doesNotMatch(parte, /undefined|\[object|NaN/);
    assert.equal(sinLaSeccion(html), SIN.html);
  });

  it('sin emojis, en el HTML y en el texto', () => {
    const { html, text } = mail(modelo(propuestasDatasetsDePrueba()));
    assert.doesNotMatch(filaDeLaSeccion(html), EMOJI);
    assert.doesNotMatch(text, EMOJI);
    const vacia = mail(modelo([]));
    assert.doesNotMatch(filaDeLaSeccion(vacia.html), EMOJI);
    assert.doesNotMatch(vacia.text, EMOJI);
  });
});

// La corrida y Correos → Estado (spec, 8 y 13): lo que anota cada corrida, la línea del Estado y sus avisos
describe('textoDelResultadoDelCorreo: lo que anota una corrida', () => {
  it('lo que salió y lo que no se pudo enviar', () => {
    assert.equal(textoDelResultadoDelCorreo({ enviados: 4 }), 'mandó 4 mails.');
    assert.equal(textoDelResultadoDelCorreo({ enviados: 1 }), 'mandó 1 mail.');
    assert.equal(textoDelResultadoDelCorreo({ enviados: 3, fallidos: 1 }), 'mandó 3 mails y 1 no se pudo enviar.');
    assert.equal(textoDelResultadoDelCorreo({ enviados: 2, fallidos: 2 }), 'mandó 2 mails y 2 no se pudieron enviar.');
    assert.equal(textoDelResultadoDelCorreo({ fallidos: 1 }), 'no se pudo enviar 1 mail.');
    assert.equal(textoDelResultadoDelCorreo({ fallidos: 3 }), 'no se pudieron enviar 3 mails.');
    assert.equal(textoDelResultadoDelCorreo({}), 'no había nada para mandar.');
  });

  it('por qué no salió nada', () => {
    assert.equal(textoDelResultadoDelCorreo({ motivo: 'apagado' }), 'no salió nada, porque el envío automático está apagado.');
    assert.equal(textoDelResultadoDelCorreo({ motivo: 'no_habil' }), 'no salió nada, porque no era día hábil.');
    assert.equal(textoDelResultadoDelCorreo({ motivo: 'sin_feriados' }),
      'no salió nada, porque no se pudieron leer los feriados: lo que esperaba sale en la corrida siguiente.');
    assert.equal(textoDelResultadoDelCorreo({ motivo: 'sin_lista' }), 'no salió nada, porque no había nadie en la lista.');
  });

  it('los problemas de la corrida van detrás, una vez cada uno; sin nada enviado, «no se pudo completar»', () => {
    const problema = 'No se pudo preparar el mail de una edición.';
    assert.equal(textoDelResultadoDelCorreo({ problemas: [problema, problema] }), `no se pudo completar. ${problema}`);
    assert.equal(textoDelResultadoDelCorreo({ enviados: 2, problemas: [problema] }), `mandó 2 mails. ${problema}`);
  });

  it('cabe en la columna (500) y no usa las palabras que el sistema evita', () => {
    const largo = textoDelResultadoDelCorreo({ enviados: 1, problemas: Array.from({ length: 40 }, (_, i) => `Problema número ${i}.`) });
    assert.ok(largo.length <= 500);
    for (const motivo of [null, 'apagado', 'no_habil', 'sin_feriados', 'sin_lista']) {
      assert.doesNotMatch(textoDelResultadoDelCorreo({ motivo, enviados: 0, fallidos: 1 }), PROHIBIDAS);
    }
  });
});

describe('textoDeLaCorridaDelCorreo: la línea de Correos → Estado', () => {
  const corrida = (cambios = {}) => ({
    inicio: '2026-11-24 08:05', fin: '2026-11-24 08:06', resultado: 'mandó 4 mails.', con_errores: false, en_curso: false, ...cambios
  });

  it('la última corrida, con el día y la hora sin el cero, y su resultado', () => {
    assert.equal(textoDeLaCorridaDelCorreo(corrida()), 'El dato de la quincena: la última corrida fue el 24/11 a las 8:05: mandó 4 mails.');
    assert.equal(textoDeLaCorridaDelCorreo(corrida({ inicio: '2026-11-24 14:00', resultado: null })),
      'El dato de la quincena: la última corrida fue el 24/11 a las 14:00.');
  });

  it('sin registro, en curso y una que no terminó', () => {
    assert.equal(textoDeLaCorridaDelCorreo(null), 'El dato de la quincena: sin registro de corridas todavía.');
    assert.equal(textoDeLaCorridaDelCorreo(corrida({ fin: null, en_curso: true })),
      'El dato de la quincena: hay una corrida en curso, desde el 24/11 a las 8:05.');
    assert.equal(textoDeLaCorridaDelCorreo(corrida({ fin: null, resultado: null })),
      'El dato de la quincena: la última corrida, el 24/11 a las 8:05, no terminó.');
  });
});

describe('alertasDelCorreo: los avisos de Correos → Estado', () => {
  const corrida = (cambios = {}) => ({
    inicio: '2026-11-24 08:05', fin: '2026-11-24 08:06', resultado: 'mandó 4 mails.', con_errores: false, en_curso: false, ...cambios
  });

  it('sin errores ni nadie a quien no le llegó, ninguno', () => {
    assert.deepEqual(alertasDelCorreo({ corrida: corrida(), sinLlegar: null }), []);
    assert.deepEqual(alertasDelCorreo({ corrida: null, sinLlegar: null }), []);
    assert.deepEqual(alertasDelCorreo({ corrida: corrida(), sinLlegar: { fecha_edicion: '2026-11-23', personas: 0 } }), []);
  });

  it('una corrida con errores y una edición que no le llegó a alguien', () => {
    const conErrores = corrida({ con_errores: true, resultado: 'no se pudo completar. No se pudo preparar el mail de una edición.' });
    assert.deepEqual(alertasDelCorreo({ corrida: conErrores, sinLlegar: { fecha_edicion: '2026-11-23', personas: 2 } }), [
      {
        tipo: 'dato-quincena-con-errores', nivel: 'error',
        mensaje: 'La última corrida del dato de la quincena (el 24/11 a las 8:05) terminó con errores: no se pudo completar. No se '
          + 'pudo preparar el mail de una edición.'
      },
      {
        tipo: 'dato-quincena-no-llego', nivel: 'error',
        mensaje: 'El dato de la quincena del 23/11/2026 no les llegó a 2 personas: se les puede reenviar desde la edición.'
      }
    ]);
    assert.equal(alertasDelCorreo({ corrida: null, sinLlegar: { fecha_edicion: '2026-11-23', personas: 1 } })[0].mensaje,
      'El dato de la quincena del 23/11/2026 no le llegó a 1 persona: se le puede reenviar desde la edición.');
  });

  it('una corrida en curso no avisa errores de antes', () => {
    assert.deepEqual(alertasDelCorreo({ corrida: corrida({ fin: null, en_curso: true, con_errores: true }), sinLlegar: null }), []);
  });

  it('si no se pudo leer, una advertencia (el resto del Estado responde igual)', () => {
    assert.deepEqual(alertaSinEstadoDelCorreo(), {
      tipo: 'dato-quincena-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida del dato de la quincena.'
    });
  });
});

describe('lo que ven todos de una edición que ya no está vigente con reintentos abiertos (Ruling 9)', () => {
  // La del 09/11 salió el martes 10/11 a las 8:05 a una persona y a la otra le falló una vez; con el envío apagado, nadie la
  // reintentó. El viernes 20/11 todavía está vigente; el lunes 23/11 (hoy − 13 = 10/11) ya no
  const filas = [enviado(1), fallido(2, 1)];
  const deEseDia = (ahora, cambios = {}) => ({ ...salida(filas, { correo: correo('programada'), ahora, ...cambios }) });

  it('vigente: sigue en reintento para administración; vencida: «Enviada a 1 de 2»', () => {
    assert.deepEqual(pastillaDelEnvio({ ...deEseDia('2026-11-20 10:00:00'), admin: true }), { tipo: 'parcial', texto: '1 persona en reintento' });
    assert.deepEqual(pastillaDelEnvio({ ...deEseDia('2026-11-23 10:00:00'), admin: true }), { tipo: 'parcial', texto: 'Enviada a 1 de 2' });
    assert.deepEqual(pastillaDelEnvio({ ...deEseDia('2026-11-23 10:00:00'), admin: false }), { tipo: 'enviada', texto: 'Enviada el mar 10/11' });
    assert.equal(lineaDelCorreo(deEseDia('2026-11-23 10:00:00')), 'Enviada por correo el martes 10/11/2026 a las 8:05.');
  });

  it('a nadie le llegó y ya no está vigente: «No se pudo enviar.», no «Se envía…»', () => {
    const nada = (ahora) => salida([fallido(1, 1)], { correo: correo('programada'), ahora });
    assert.equal(lineaDelCorreo(nada('2026-11-20 10:00:00')), 'Se envía hoy a las 14:00.');
    assert.equal(lineaDelCorreo(nada('2026-11-23 10:00:00')), 'No se pudo enviar.');
    assert.deepEqual(pastillaDelEnvio({ ...nada('2026-11-23 10:00:00'), admin: true }), { tipo: 'fallida', texto: 'No se pudo enviar' });
    assert.deepEqual(envioDelRecibo(nada('2026-11-23 10:00:00')), { estado: 'fallida', programado_at: null, texto: 'No se pudo enviar.' });
  });
});

describe('personasSinLlegar: a cuántas no les llegó la última edición que salió sola (spec, 13; Ruling 9)', () => {
  const fila = (id, usuario_id, estado, intentos, tipo = 'automatico') => ({ id, usuario_id, tipo, estado, intentos, enviado_at: null });

  it('las fallidas con los 3 intentos, salvo que después un reenvío les haya llegado', () => {
    const envios = [fila(1, 1, 'enviado', 1), fila(2, 2, 'fallido', 3), fila(3, 3, 'fallido', 3), fila(4, 4, 'fallido', 1)];
    assert.equal(personasSinLlegar({ fecha_edicion: '2026-11-23', envios, hoy: '2026-11-25' }), 2);
    assert.equal(personasSinLlegar({ fecha_edicion: '2026-11-23', envios: [...envios, fila(5, 2, 'enviado', 1, 'reenvio')], hoy: '2026-11-25' }), 1);
    // Un reenvío que falló, una prueba o un reenvío a otra persona no cuentan
    assert.equal(personasSinLlegar({
      fecha_edicion: '2026-11-23', envios: [...envios, fila(5, 2, 'fallido', 1, 'reenvio'), fila(6, 3, 'enviado', 1, 'prueba'), fila(7, 1, 'enviado', 1, 'reenvio')],
      hoy: '2026-11-25'
    }), 2);
  });

  it('vencida, también las que quedaron en reintento o pendientes (Ruling 9); licencia, omitida y sin confirmar no cuentan', () => {
    const envios = [fila(1, 1, 'fallido', 1), fila(2, 2, 'pendiente', 0), fila(3, 3, 'licencia', 0), fila(4, 4, 'omitido', 0),
      fila(5, 5, 'enviando', 1), fila(6, 6, 'enviado', 1)];
    assert.equal(personasSinLlegar({ fecha_edicion: '2026-11-23', envios, hoy: '2026-12-06' }), 0, 'el 06/12 todavía está vigente');
    assert.equal(personasSinLlegar({ fecha_edicion: '2026-11-23', envios, hoy: '2026-12-07' }), 2);
  });
});
