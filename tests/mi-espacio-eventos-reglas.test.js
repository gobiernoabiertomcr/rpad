// La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 4, 5 y 7): la validación de un evento, el
// momento en que sale su recordatorio con los feriados (nunca en un día que no es hábil), los textos de cuándo es y cuándo
// sale, y quién recibe qué: los recordatorios de una corrida (con los atrasados) y los emails de un guardado. También lo
// demás de la agenda (tus licencias, los compañeros que no están y los feriados) y los eventos de «Hoy y mañana». Puras, sin
// base. Hoy es el lunes 26/10/2026.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDATORIOS, RECORDATORIO_POR_DEFECTO, TEXTO_RECORDATORIO, AVISO_CORTO, LARGO_TITULO_EVENTO, LARGO_DETALLE_EVENTO,
  FECHA_MINIMA_EVENTO, ROLES_QUE_COMPARTEN, DIAS_DE_PROXIMOS, VENTANA_DE_LA_CORRIDA, MINUTOS_SIN_CORRER, BLOQUEO_EVENTOS,
  MINUTOS_A_TIEMPO, HORA_DE_LOS_ATRASADOS, HORA_DE_CIERRE_DE_LOS_ATRASADOS, MENSAJES_EVENTO,
  fechaMaximaEvento, textoRangoEvento, validarEvento, momentoDelAviso, textoDelAviso, cuandoDelEvento,
  cuandoCortoDelEvento, cuandoEsElEvento, cuandoFue, textoDelEvento, listaConY, inicialesDe,
  recordatoriosQueTocan, cambioQueAvisa, emailsDelGuardado, validarAvisoDelEvento, avisoDe, personasDelPedido, itemDeEvento,
  itemDeLicencia, itemDeAusencia, itemsDeFeriados, eventosDeHoyYManana, textoDelResultadoDeEventos,
  textoDeLaCorridaDeEventos, alertasDeLaCorridaDeEventos, alertaSinEstadoDeEventos
} from '../services/miEspacioEventosReglas.js';
import { esAdmin } from '../services/usuariosReglas.js';

const HOY = '2026-10-26';
const RANGO = 'La fecha tiene que ser del 01/01/2025 al 26/10/2028.';

// Un evento válido (el martes 27/10/2026 de 10:00 a 11:00), con lo que cambia cada caso
const evento = (datos) => ({ titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', ...datos });
const validar = (datos) => validarEvento(evento(datos), HOY);
const errorDe = (datos) => validar(datos).error;
const datosDe = (datos) => {
  const { datos: resultado, error } = validar(datos);
  assert.equal(error, null);
  return resultado;
};

// Un texto de n caracteres que en UTF-16 ocupa el doble: Array.from cuenta 1 por emoji
const emojis = (n) => '😀'.repeat(n);

describe('los valores de la agenda', () => {
  it('los recordatorios, en el orden del formulario, con sus textos', () => {
    assert.deepEqual(RECORDATORIOS, ['1h', '2h', 'dia_anterior', 'ninguno']);
    assert.equal(RECORDATORIO_POR_DEFECTO, '2h');
    assert.deepEqual(TEXTO_RECORDATORIO, {
      '1h': '1 hora antes', '2h': '2 horas antes', dia_anterior: 'El día hábil anterior', ninguno: 'Sin aviso'
    });
    assert.deepEqual(AVISO_CORTO, {
      '1h': 'Aviso 1 h antes', '2h': 'Aviso 2 h antes', dia_anterior: 'Aviso el día hábil anterior', ninguno: 'Sin aviso'
    });
    assert.deepEqual(Object.keys(TEXTO_RECORDATORIO), RECORDATORIOS);
    assert.deepEqual(Object.keys(AVISO_CORTO), RECORDATORIOS);
  });

  it('los largos, la fecha mínima, los próximos y los de la corrida', () => {
    assert.equal(LARGO_TITULO_EVENTO, 150);
    assert.equal(LARGO_DETALLE_EVENTO, 1000);
    assert.equal(FECHA_MINIMA_EVENTO, '2025-01-01');
    assert.equal(DIAS_DE_PROXIMOS, 30);
    assert.equal(VENTANA_DE_LA_CORRIDA, 15);
    assert.equal(MINUTOS_SIN_CORRER, 60);
    assert.equal(BLOQUEO_EVENTOS, 'rpad_mi_espacio_eventos');
    assert.equal(MINUTOS_A_TIEMPO, 30);
    assert.equal(HORA_DE_LOS_ATRASADOS, '07:00');
    assert.equal(HORA_DE_CIERRE_DE_LOS_ATRASADOS, '20:00');
  });

  it('ROLES_QUE_COMPARTEN son los de administración (esAdmin)', () => {
    assert.deepEqual(ROLES_QUE_COMPARTEN, ['superadmin', 'admin', 'editor']);
    assert.deepEqual(ROLES_QUE_COMPARTEN, ['superadmin', 'admin', 'editor', 'colaborador', 'lector'].filter(esAdmin));
  });

  it('los mensajes, escritos a mano', () => {
    assert.deepEqual(MENSAJES_EVENTO, {
      titulo: 'Escribí qué es el evento.',
      tituloLargo: 'El título puede tener hasta 150 caracteres.',
      desde: 'Elegí a qué hora empieza.',
      hasta: 'La hora de fin tiene que ser después de la de inicio, el mismo día.',
      detalle: 'El detalle puede tener hasta 1000 caracteres.',
      personas: 'Elegí con quién lo compartís, o «Todos».',
      personasInvalidas: 'Solo podés compartirlo con las personas de la lista.',
      recordatorio: 'Elegí cuándo te llega el recordatorio.',
      sinPermiso: 'No tenés permiso para compartir eventos.',
      noEncontrado: 'Evento no encontrado',
      miRecordatorio: 'Elegí si querés el recordatorio.',
      esTuyo: 'El recordatorio de tu evento se cambia en el evento.'
    });
  });

  it('las listas y los mensajes no se pueden modificar', () => {
    for (const valor of [RECORDATORIOS, TEXTO_RECORDATORIO, AVISO_CORTO, ROLES_QUE_COMPARTEN, MENSAJES_EVENTO]) {
      assert.ok(Object.isFrozen(valor));
    }
  });

  it('fechaMaximaEvento: el mismo día dos años después (un 29/02 da el 28/02)', () => {
    assert.equal(fechaMaximaEvento('2026-10-26'), '2028-10-26');
    assert.equal(fechaMaximaEvento('2028-02-29'), '2030-02-28');
    assert.equal(fechaMaximaEvento('2026-12-31'), '2028-12-31');
    assert.equal(fechaMaximaEvento('2026-01-01'), '2028-01-01');
    for (const hoy of [null, undefined, '', '2026-02-30', '26/10/2026', 20261026]) {
      assert.equal(fechaMaximaEvento(hoy), null, String(hoy));
    }
  });

  it('textoRangoEvento: del 01/01/2025 al tope', () => {
    assert.equal(textoRangoEvento(fechaMaximaEvento(HOY)), RANGO);
    assert.equal(textoRangoEvento('2030-02-28'), 'La fecha tiene que ser del 01/01/2025 al 28/02/2030.');
  });
});

describe('validarEvento', () => {
  it('un evento válido: los datos, con los de entrada', () => {
    assert.deepEqual(validar({}), {
      datos: {
        titulo: 'Reunión de equipo', detalle: null, fecha: '2026-10-27', desde: '10:00', hasta: '11:00',
        compartido: false, para_todos: false, personas: [], recordatorio: '2h'
      },
      error: null
    });
  });

  it('el título: recortado, obligatorio y de hasta 150 caracteres (contados con Array.from)', () => {
    assert.equal(datosDe({ titulo: '  Turno médico  ' }).titulo, 'Turno médico');
    for (const titulo of ['', '   ', '\n\t ', undefined, null, 42, ['Reunión'], { texto: 'Reunión' }]) {
      assert.deepEqual(errorDe({ titulo }), { campo: 'titulo', mensaje: MENSAJES_EVENTO.titulo }, String(titulo));
    }
    assert.equal(datosDe({ titulo: emojis(150) }).titulo, emojis(150));
    assert.equal(datosDe({ titulo: `  ${emojis(150)}  ` }).titulo, emojis(150));
    assert.deepEqual(errorDe({ titulo: emojis(151) }), { campo: 'titulo', mensaje: MENSAJES_EVENTO.tituloLargo });
    assert.equal(datosDe({ titulo: 'a'.repeat(150) }).titulo.length, 150);
    assert.deepEqual(errorDe({ titulo: 'a'.repeat(151) }), { campo: 'titulo', mensaje: MENSAJES_EVENTO.tituloLargo });
  });

  it('la fecha: del 01/01/2025 a dos años después de hoy, cualquier día', () => {
    for (const fecha of ['2024-12-31', '2026-02-30', '2028-10-27', null, undefined, '', '27/10/2026', 20261027, '2026-10-27 10:00']) {
      assert.deepEqual(errorDe({ fecha }), { campo: 'fecha', mensaje: RANGO }, String(fecha));
    }
    // Los bordes, un sábado, un domingo y un feriado fijo
    for (const fecha of ['2025-01-01', '2028-10-26', '2026-10-31', '2026-11-01', '2026-12-25', '2026-10-26']) {
      assert.equal(datosDe({ fecha }).fecha, fecha);
    }
  });

  it('la fecha: sin un hoy válido no pasa ninguna', () => {
    for (const hoy of [null, undefined, '2026-02-30']) {
      assert.equal(validarEvento(evento(), hoy).error.campo, 'fecha', String(hoy));
    }
  });

  it('desde: obligatoria, HH:MM de 00:00 a 23:59', () => {
    for (const desde of ['24:00', '9:00', '10:00:00', '10:60', '', null, undefined, 1000, ['10:00'], '10h00', ' 10:00']) {
      assert.deepEqual(errorDe({ desde, hasta: null }), { campo: 'desde', mensaje: MENSAJES_EVENTO.desde }, String(desde));
    }
    assert.equal(datosDe({ desde: '00:00', hasta: null }).desde, '00:00');
    assert.equal(datosDe({ desde: '23:59', hasta: null }).desde, '23:59');
  });

  it('hasta: opcional (vacía, null o sin ella es null); si viene, HH:MM y después de desde', () => {
    assert.equal(datosDe({ hasta: '' }).hasta, null);
    assert.equal(datosDe({ hasta: null }).hasta, null);
    assert.equal(datosDe({ hasta: undefined }).hasta, null);
    const sinHasta = evento();
    delete sinHasta.hasta;
    assert.equal(validarEvento(sinHasta, HOY).datos.hasta, null);

    assert.equal(datosDe({ hasta: '10:01' }).hasta, '10:01');
    assert.equal(datosDe({ desde: '00:00', hasta: '23:59' }).hasta, '23:59');
    for (const hasta of ['10:00', '09:59', '00:00', '24:00', '9:30', '11:00:00', '   ', 1100, ['11:00']]) {
      assert.deepEqual(errorDe({ hasta }), { campo: 'hasta', mensaje: MENSAJES_EVENTO.hasta }, String(hasta));
    }
  });

  it('el detalle: recortado, vacío es null, de hasta 1000 caracteres', () => {
    assert.equal(datosDe({ detalle: '  Sala de reuniones del 2.º piso.\n' }).detalle, 'Sala de reuniones del 2.º piso.');
    assert.equal(datosDe({ detalle: 'Primera línea.\nSegunda línea.' }).detalle, 'Primera línea.\nSegunda línea.');
    for (const detalle of ['', '   \n ', null, undefined, 42, ['texto']]) {
      assert.equal(datosDe({ detalle }).detalle, null, String(detalle));
    }
    assert.equal(datosDe({ detalle: emojis(1000) }).detalle, emojis(1000));
    assert.deepEqual(errorDe({ detalle: emojis(1001) }), { campo: 'detalle', mensaje: MENSAJES_EVENTO.detalle });
    assert.deepEqual(errorDe({ detalle: 'a'.repeat(1001) }), { campo: 'detalle', mensaje: MENSAJES_EVENTO.detalle });
  });

  it('compartido con personas: ids positivos, sin repetidos y en el orden recibido', () => {
    assert.deepEqual(datosDe({ compartido: true, personas: [3, 3, 5] }), {
      ...datosDe({}), compartido: true, para_todos: false, personas: [3, 5]
    });
    assert.deepEqual(datosDe({ compartido: true, personas: ['7', 2, '7'] }).personas, [7, 2]);
  });

  it('compartido sin personas: «Elegí con quién…»; con un id que no sirve: «Solo podés compartirlo…»', () => {
    for (const personas of [[], undefined, null, 'todos', 3]) {
      assert.deepEqual(errorDe({ compartido: true, personas }), { campo: 'personas', mensaje: MENSAJES_EVENTO.personas },
        String(personas));
    }
    for (const personas of [[0], ['abc'], [3, -1], [1.5], ['1e3'], ['03'], [null], [true], [3, {}]]) {
      assert.deepEqual(errorDe({ compartido: true, personas }),
        { campo: 'personas', mensaje: MENSAJES_EVENTO.personasInvalidas }, JSON.stringify(personas));
    }
  });

  it('para todos: solo con compartido, y sin lista de personas', () => {
    assert.deepEqual(datosDe({ compartido: true, para_todos: true }), {
      ...datosDe({}), compartido: true, para_todos: true, personas: []
    });
    // «Todos» es una marca: las personas que vengan no se guardan
    assert.deepEqual(datosDe({ compartido: true, para_todos: true, personas: [3, 5] }).personas, []);
    assert.deepEqual(datosDe({ compartido: true, para_todos: true, personas: ['abc'] }).personas, []);
    // Sin compartido, para_todos es false
    const sinCompartir = datosDe({ para_todos: true, personas: [3] });
    assert.equal(sinCompartir.compartido, false);
    assert.equal(sinCompartir.para_todos, false);
    assert.deepEqual(sinCompartir.personas, []);
  });

  it('compartido y para_todos: solo el true literal', () => {
    for (const compartido of ['true', 1, '1', 'si', {}, false, null]) {
      const datos = datosDe({ compartido, para_todos: true, personas: [3] });
      assert.equal(datos.compartido, false, String(compartido));
      assert.equal(datos.para_todos, false, String(compartido));
      assert.deepEqual(datos.personas, [], String(compartido));
    }
    for (const paraTodos of ['true', 1, '1']) {
      const datos = datosDe({ compartido: true, para_todos: paraTodos, personas: [3] });
      assert.equal(datos.para_todos, false, String(paraTodos));
      assert.deepEqual(datos.personas, [3], String(paraTodos));
    }
  });

  it('el recordatorio: sin él, 2 horas antes; fuera de la lista, error', () => {
    assert.equal(datosDe({}).recordatorio, '2h');
    assert.equal(datosDe({ recordatorio: undefined }).recordatorio, '2h');
    assert.equal(datosDe({ recordatorio: null }).recordatorio, '2h');
    for (const recordatorio of RECORDATORIOS) assert.equal(datosDe({ recordatorio }).recordatorio, recordatorio);
    for (const recordatorio of ['otro', '15m', '', '1H', 2, ['2h'], {}]) {
      assert.deepEqual(errorDe({ recordatorio }), { campo: 'recordatorio', mensaje: MENSAJES_EVENTO.recordatorio },
        String(recordatorio));
    }
  });

  it('los controles van en orden: título, fecha, desde, hasta, detalle, personas y recordatorio', () => {
    const malo = {
      titulo: ' ', fecha: '2024-12-31', desde: '24:00', hasta: '09:00', detalle: emojis(1001), compartido: true,
      personas: [], recordatorio: 'otro'
    };
    const orden = ['titulo', 'fecha', 'desde', 'hasta', 'detalle', 'personas', 'recordatorio'];
    const arreglos = [
      { titulo: 'Reunión de equipo' }, { fecha: '2026-10-27' }, { desde: '10:00' }, { hasta: '11:00' }, { detalle: null },
      { personas: [3] }, { recordatorio: '1h' }
    ];
    let entrada = { ...malo };
    orden.forEach((campo, i) => {
      assert.equal(validarEvento(entrada, HOY).error.campo, campo);
      assert.equal(validarEvento(entrada, HOY).datos, null);
      entrada = { ...entrada, ...arreglos[i] };
    });
    assert.equal(validarEvento(entrada, HOY).error, null);
  });

  it('nada tira: una entrada que no es un objeto da el error del título', () => {
    for (const entrada of [null, undefined, 'evento', 42, [], true]) {
      const resultado = validarEvento(entrada, HOY);
      assert.equal(resultado.datos, null);
      assert.deepEqual(resultado.error, { campo: 'titulo', mensaje: MENSAJES_EVENTO.titulo }, String(entrada));
    }
    assert.doesNotThrow(() => validarEvento(evento({ personas: [Symbol('x')], compartido: true }), HOY));
  });
});

describe('momentoDelAviso', () => {
  const momento = (datos, feriados) => momentoDelAviso({ fecha: '2026-10-27', desde: '10:00', recordatorio: '2h', ...datos },
    feriados);

  it('2 horas y 1 hora antes, el mismo día hábil', () => {
    assert.equal(momento({ recordatorio: '2h' }), '2026-10-27 08:00');
    assert.equal(momento({ recordatorio: '1h' }), '2026-10-27 09:00');
    assert.equal(momento({ recordatorio: '1h', desde: '10:45' }), '2026-10-27 09:45');
    assert.equal(momento({ recordatorio: '2h', desde: '02:00' }), '2026-10-27 00:00');
  });

  it('el día hábil anterior, a la misma hora: el lunes avisa el viernes, o el jueves si el viernes es feriado', () => {
    assert.equal(momento({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }), '2026-10-30 10:00');
    assert.equal(momento({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }, new Set(['2026-10-30'])),
      '2026-10-29 10:00');
    assert.equal(momento({ fecha: '2026-10-28', desde: '15:30', recordatorio: 'dia_anterior' }), '2026-10-27 15:30');
  });

  it('un aviso que cae en un día que no es hábil pasa al día hábil anterior, a la misma hora', () => {
    // 2 horas antes de un sábado y de un domingo
    assert.equal(momento({ fecha: '2026-10-31', recordatorio: '2h' }), '2026-10-30 08:00');
    assert.equal(momento({ fecha: '2026-11-01', recordatorio: '2h' }), '2026-10-30 08:00');
    // Con un feriado de la tabla el día del evento
    assert.equal(momento({ fecha: '2026-11-03', recordatorio: '2h' }, new Set(['2026-11-03'])), '2026-11-02 08:00');
    // El día hábil anterior de un sábado es el viernes
    assert.equal(momento({ fecha: '2026-10-31', recordatorio: 'dia_anterior' }), '2026-10-30 10:00');
  });

  it('una hora antes de las 00:30 de un lunes cae el domingo: pasa al viernes a las 23:30', () => {
    assert.equal(momento({ fecha: '2026-11-02', desde: '00:30', recordatorio: '1h' }), '2026-10-30 23:30');
    // De un martes, el lunes a la noche, que es hábil
    assert.equal(momento({ fecha: '2026-10-27', desde: '01:30', recordatorio: '2h' }), '2026-10-26 23:30');
    assert.equal(momento({ fecha: '2026-10-27', desde: '00:00', recordatorio: '1h' }), '2026-10-26 23:00');
  });

  it('el cambio de mes y de año', () => {
    assert.equal(momento({ fecha: '2026-02-02', recordatorio: 'dia_anterior' }), '2026-01-30 10:00');
    assert.equal(momento({ fecha: '2026-11-01', desde: '00:30', recordatorio: '1h' }), '2026-10-30 23:30');
    // El 01/01 es feriado fijo: el lunes 04/01/2027 avisa el jueves 31/12/2026
    assert.equal(momento({ fecha: '2027-01-04', recordatorio: 'dia_anterior' }), '2026-12-31 10:00');
    assert.equal(momento({ fecha: '2027-01-01', desde: '01:00', recordatorio: '2h' }), '2026-12-31 23:00');
  });

  it('un segundo parámetro que no es un Set no saca ningún día', () => {
    for (const feriados of [undefined, null, ['2026-10-30'], {}]) {
      assert.equal(momento({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }, feriados), '2026-10-30 10:00');
    }
  });

  it('null sin aviso o con algo que no sirve', () => {
    assert.equal(momento({ recordatorio: 'ninguno' }), null);
    assert.equal(momento({ fecha: '2026-02-30' }), null);
    assert.equal(momento({ desde: '25:00' }), null);
    assert.equal(momento({ desde: '10:00:00' }), null);
    assert.equal(momento({ desde: 1000 }), null);
    for (const recordatorio of [undefined, null, 'otro', '', ['2h'], '1H']) {
      assert.equal(momento({ recordatorio }), null, String(recordatorio));
    }
    for (const entrada of [null, undefined, 'evento', 42, []]) assert.equal(momentoDelAviso(entrada, new Set()), null);
  });
});

describe('textoDelAviso', () => {
  const MANANA_A_LAS_7 = '2026-10-27 07:00:00';
  const texto = (datos, ahora = MANANA_A_LAS_7, feriados = new Set()) =>
    textoDelAviso({ fecha: '2026-10-27', desde: '10:00', recordatorio: '2h', ...datos }, { ahora, feriados });

  it('cuándo sale: hoy, mañana o el día, con la hora', () => {
    assert.equal(texto({}), '2 horas antes (hoy a las 08:00)');
    assert.equal(texto({ fecha: '2026-10-28', recordatorio: '1h' }), '1 hora antes (mañana a las 09:00)');
    assert.equal(texto({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }),
      'El día hábil anterior (el viernes 30/10 a las 10:00)');
  });

  it('con los feriados', () => {
    assert.equal(texto({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }, MANANA_A_LAS_7, new Set(['2026-10-30'])),
      'El día hábil anterior (el jueves 29/10 a las 10:00)');
  });

  it('justo a la hora del aviso todavía dice cuándo sale', () => {
    assert.equal(texto({}, '2026-10-27 08:00:00'), '2 horas antes (hoy a las 08:00)');
  });

  it('pasada la hora del aviso, y con el evento empezado', () => {
    assert.equal(texto({}, '2026-10-27 09:00:00'),
      '2 horas antes (ya pasó esa hora: sale con el próximo envío, si es antes del evento)');
    assert.equal(texto({}, '2026-10-27 09:59:59'),
      '2 horas antes (ya pasó esa hora: sale con el próximo envío, si es antes del evento)');
    assert.equal(texto({}, '2026-10-27 10:00:00'), '2 horas antes (el evento ya empezó)');
    assert.equal(texto({}, '2026-10-27 15:00:00'), '2 horas antes (el evento ya empezó)');
    assert.equal(texto({}, '2026-11-02 08:00:00'), '2 horas antes (el evento ya empezó)');
  });

  it('ahora puede venir sin los segundos', () => {
    assert.equal(texto({}, '2026-10-27 07:00'), '2 horas antes (hoy a las 08:00)');
  });

  it('sin aviso', () => {
    assert.equal(texto({ recordatorio: 'ninguno' }), 'Sin aviso');
    assert.equal(texto({ recordatorio: 'ninguno' }, null), 'Sin aviso');
  });

  it('nada tira: sin un ahora o una fecha que sirvan, el texto del recordatorio solo; sin recordatorio, vacío', () => {
    assert.equal(texto({}, null), '2 horas antes');
    assert.equal(texto({}, '27/10/2026 07:00'), '2 horas antes');
    assert.equal(texto({}, '2026-10-27T07:00:00'), '2 horas antes');
    assert.equal(texto({ fecha: '2026-02-30' }), '2 horas antes');
    assert.equal(textoDelAviso({ fecha: '2026-10-27', desde: '10:00', recordatorio: 'dia_anterior' }), 'El día hábil anterior');
    assert.equal(texto({ recordatorio: 'otro' }), '');
    for (const entrada of [null, undefined, 42, 'evento']) {
      assert.equal(typeof textoDelAviso(entrada, null), 'string');
      assert.equal(typeof textoDelAviso(entrada, { ahora: MANANA_A_LAS_7 }), 'string');
    }
  });
});

describe('los cuándo', () => {
  it('cuandoDelEvento: con hora de fin, «de … a …»; sin ella, «a las …»', () => {
    assert.equal(cuandoDelEvento(evento()), 'martes 27/10/2026 de 10:00 a 11:00');
    assert.equal(cuandoDelEvento(evento({ hasta: null })), 'martes 27/10/2026 a las 10:00');
    assert.equal(cuandoDelEvento(evento({ hasta: '' })), 'martes 27/10/2026 a las 10:00');
    assert.equal(cuandoDelEvento(evento({ fecha: '2026-10-28', desde: '15:30', hasta: undefined })),
      'miércoles 28/10/2026 a las 15:30');
  });

  it('cuandoCortoDelEvento: siempre «a las …»', () => {
    assert.equal(cuandoCortoDelEvento(evento()), 'martes 27/10/2026 a las 10:00');
    assert.equal(cuandoCortoDelEvento(evento({ hasta: null })), 'martes 27/10/2026 a las 10:00');
  });

  it('cuandoEsElEvento: hoy, mañana o el día', () => {
    assert.equal(cuandoEsElEvento(evento(), '2026-10-27'), 'Hoy a las 10:00');
    assert.equal(cuandoEsElEvento(evento(), '2026-10-26'), 'Mañana a las 10:00');
    assert.equal(cuandoEsElEvento(evento({ fecha: '2026-11-02' }), '2026-10-27'), 'El lunes 02/11 a las 10:00');
    assert.equal(cuandoEsElEvento(evento({ fecha: '2027-01-01', desde: '01:00' }), '2026-12-31'), 'Mañana a las 01:00');
    assert.equal(cuandoEsElEvento(evento(), null), 'El martes 27/10 a las 10:00');
  });

  it('cuandoFue: hoy, ayer o la fecha, con la hora', () => {
    assert.equal(cuandoFue('2026-10-27 10:30:15', '2026-10-27 11:00:00'), 'hoy a las 10:30');
    assert.equal(cuandoFue('2026-10-26 23:30:00', '2026-10-27 08:00:00'), 'ayer a las 23:30');
    assert.equal(cuandoFue('2026-10-23 10:30:00', '2026-10-27 08:00:00'), 'el 23/10/2026 a las 10:30');
    assert.equal(cuandoFue('2026-12-31 23:30', '2027-01-01 00:10'), 'ayer a las 23:30');
    assert.equal(cuandoFue('2026-10-23 10:30:00', null), 'el 23/10/2026 a las 10:30');
  });

  it('textoDelEvento: el título y cuándo', () => {
    assert.equal(textoDelEvento(evento()), 'Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00');
    assert.equal(textoDelEvento(evento({ hasta: null })), 'Reunión de equipo, martes 27/10/2026 a las 10:00');
  });

  it('nada tira: con lo que no sirve, la raya', () => {
    for (const entrada of [null, undefined, 42, 'evento', {}, evento({ fecha: '2026-02-30' }), evento({ desde: '9:00' })]) {
      assert.equal(cuandoDelEvento(entrada), '—');
      assert.equal(cuandoCortoDelEvento(entrada), '—');
      assert.equal(cuandoEsElEvento(entrada, HOY), '—');
    }
    for (const momento of [null, undefined, 42, '', '2026-02-30 10:00', '2026-10-27 25:00', '2026-10-27T10:00:00']) {
      assert.equal(cuandoFue(momento, '2026-10-27 11:00:00'), '—', String(momento));
    }
    for (const entrada of [null, undefined, 42, {}]) assert.equal(typeof textoDelEvento(entrada), 'string');
    assert.equal(textoDelEvento(evento({ titulo: null })), 'martes 27/10/2026 de 10:00 a 11:00');
  });
});

describe('listaConY e inicialesDe', () => {
  it('listaConY: uno, dos y tres', () => {
    assert.equal(listaConY(['Test adminA']), 'Test adminA');
    assert.equal(listaConY(['vos', 'Test adminB']), 'vos y Test adminB');
    assert.equal(listaConY(['vos', 'Test adminB', 'Persona de Prueba']), 'vos, Test adminB y Persona de Prueba');
    assert.equal(listaConY([]), '');
  });

  it('inicialesDe: la primera letra de la primera y de la última palabra, en mayúscula', () => {
    assert.equal(inicialesDe('Persona de Prueba'), 'PP');
    assert.equal(inicialesDe('Test adminA'), 'TA');
    assert.equal(inicialesDe('  test   de   prueba  '), 'TP');
    assert.equal(inicialesDe('Prueba'), 'P');
    assert.equal(inicialesDe('ángel úrsula'), 'ÁÚ');
    assert.equal(inicialesDe('😀 Prueba'), '😀P');
  });

  it('nada tira', () => {
    for (const valor of [null, undefined, 42, {}, '']) {
      assert.equal(listaConY(valor), '', String(valor));
      assert.equal(inicialesDe(valor), '', String(valor));
    }
    assert.equal(inicialesDe('   '), '');
  });
});

describe('recordatoriosQueTocan', () => {
  // El martes 03/11/2026 a las 10:00, con «2 horas antes» (aviso a las 08:00): la persona 1 lo creó y la 2 está invitada
  const PARA = '2026-11-03 10:00';
  const CREADOR = Object.freeze({ usuario_id: 1, email: 'creador@rpad.test', sin_recordatorio: 0 });
  const INVITADA = Object.freeze({ usuario_id: 2, email: 'invitada@rpad.test', sin_recordatorio: 0 });
  const eventoDePrueba = (datos) => ({
    id: 7, fecha: '2026-11-03', desde: '10:00', recordatorio: '2h', destinatarios: [CREADOR, INVITADA], envios: [], ...datos
  });
  const tocan = (eventos, ahora, feriados = new Set()) => recordatoriosQueTocan(eventos, { ahora, feriados });
  // Los ids de las personas a las que les toca un evento armado con eventoDePrueba(datos), a las `ahora`
  const quienes = (datos, ahora, feriados) => tocan([eventoDePrueba(datos)], ahora, feriados).map((uno) => uno.usuario_id);
  const envio = (usuarioId, datos) => ({ usuario_id: usuarioId, para: PARA, success: 1, terminado: true, ...datos });

  it('a las 07:59, nadie; a las 08:00 y a las 09:30, las dos, con el inicio del evento; a las 10:00, nadie', () => {
    const LAS_DOS = [
      { evento_id: 7, usuario_id: 1, email: 'creador@rpad.test', para: PARA, reintento: false },
      { evento_id: 7, usuario_id: 2, email: 'invitada@rpad.test', para: PARA, reintento: false }
    ];
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 07:59:59'), []);
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 08:00:00'), LAS_DOS);
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 09:30:00'), LAS_DOS);
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 09:59:59'), LAS_DOS);
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 10:00:00'), []);
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 15:00:00'), []);
    // ahora puede venir sin los segundos
    assert.deepEqual(tocan([eventoDePrueba()], '2026-11-03 08:00'), LAS_DOS);
  });

  it('a quien apagó su recordatorio no le toca', () => {
    for (const apagado of [1, true, '1']) {
      assert.deepEqual(quienes({ destinatarios: [CREADOR, { ...INVITADA, sin_recordatorio: apagado }] }, '2026-11-03 08:00'),
        [1], String(apagado));
    }
    for (const prendido of [0, false, null, undefined]) {
      assert.deepEqual(quienes({ destinatarios: [CREADOR, { ...INVITADA, sin_recordatorio: prendido }] }, '2026-11-03 08:00'),
        [1, 2], String(prendido));
    }
  });

  it('un evento sin aviso no le toca a nadie', () => {
    assert.deepEqual(quienes({ recordatorio: 'ninguno' }, '2026-11-03 09:00'), []);
  });

  it('cambiado de hora: con el recordatorio de las 10:00 ya enviado y el evento a las 15:00, sale otra vez a las 13:00', () => {
    const enviados = [envio(1), envio(2)];
    assert.deepEqual(quienes({ envios: enviados }, '2026-11-03 09:00'), []);
    assert.deepEqual(tocan([eventoDePrueba({ desde: '15:00', envios: enviados })], '2026-11-03 13:00:00'), [
      { evento_id: 7, usuario_id: 1, email: 'creador@rpad.test', para: '2026-11-03 15:00', reintento: false },
      { evento_id: 7, usuario_id: 2, email: 'invitada@rpad.test', para: '2026-11-03 15:00', reintento: false }
    ]);
    // Con un solo envío de antes, a la otra también: lo de antes no cuenta para la hora nueva
    assert.deepEqual(quienes({ desde: '15:00', envios: [envio(1)] }, '2026-11-03 13:00'), [1, 2]);
  });

  it('uno que falló y terminó vuelve, con reintento; uno que salió o una reserva sin terminar, no', () => {
    assert.deepEqual(tocan([eventoDePrueba({ envios: [envio(2, { success: 0 })] })], '2026-11-03 08:30:00'), [
      { evento_id: 7, usuario_id: 1, email: 'creador@rpad.test', para: PARA, reintento: false },
      { evento_id: 7, usuario_id: 2, email: 'invitada@rpad.test', para: PARA, reintento: true }
    ]);
    assert.deepEqual(quienes({ envios: [envio(2, { success: false, terminado: 1 })] }, '2026-11-03 08:30'), [1, 2]);
    // Sin terminar (enviado_at NULL: la reserva de otra corrida, que pudo haber salido), no
    for (const terminado of [false, 0, null, undefined]) {
      assert.deepEqual(quienes({ envios: [envio(2, { success: 0, terminado })] }, '2026-11-03 08:30'), [1], String(terminado));
    }
    // Uno que salió, no; y con un success que no es ni sí ni no, tampoco (no se repite)
    for (const success of [1, true, null, undefined, 'raro']) {
      assert.deepEqual(quienes({ envios: [envio(2, { success })] }, '2026-11-03 08:30'), [1], String(success));
    }
    // Un fallido del evento en otra hora no es un reintento: es la hora nueva
    assert.equal(tocan([eventoDePrueba({ envios: [envio(2, { success: 0, para: '2026-11-03 09:00' })] })],
      '2026-11-03 08:30')[1].reintento, false);
    // El reintento también espera la franja de los atrasados, y nunca después del inicio
    assert.deepEqual(quienes({ envios: [envio(2, { success: 0 })] }, '2026-11-03 09:30'), [1, 2]);
    assert.deepEqual(quienes({ envios: [envio(2, { success: 0 })] }, '2026-11-03 10:00'), []);
  });

  it('solo cuentan los envíos de recordatorio: una invitación con el mismo para no lo frena', () => {
    assert.deepEqual(quienes({ envios: [envio(2, { tipo: 'invitacion' }), envio(1, { tipo: 'cambio' })] },
      '2026-11-03 08:00'), [1, 2]);
    assert.deepEqual(quienes({ envios: [envio(2, { tipo: 'recordatorio' })] }, '2026-11-03 08:00'), [1]);
    assert.deepEqual(quienes({ envios: [envio(2, { tipo: null })] }, '2026-11-03 08:00'), [1]);
  });

  it('un día no hábil: el sábado, nada; con un feriado el día del aviso, nada, y el aviso pasa al día hábil anterior', () => {
    // El sábado 31/10 a las 12:00 con «1 hora antes»: el aviso es el viernes 30/10 a las 11:00
    const sabado = { fecha: '2026-10-31', desde: '12:00', recordatorio: '1h' };
    assert.deepEqual(quienes(sabado, '2026-10-31 11:00'), []);
    assert.deepEqual(quienes(sabado, '2026-10-30 11:00'), [1, 2]);
    // Con un feriado el 03/11, ese día nada, y el aviso de las 08:00 sale el lunes 02/11 a las 08:00
    const feriado = new Set(['2026-11-03']);
    assert.deepEqual(quienes({}, '2026-11-03 08:00', feriado), []);
    assert.deepEqual(quienes({}, '2026-11-03 09:30', feriado), []);
    assert.deepEqual(quienes({}, '2026-11-02 07:59', feriado), []);
    assert.deepEqual(quienes({}, '2026-11-02 08:00', feriado), [1, 2]);
    // Un domingo, aunque el aviso ya haya pasado y el evento no haya empezado
    assert.deepEqual(quienes({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }, '2026-11-01 12:00'), []);
  });

  it('a quien no tiene un email que sirva no le toca', () => {
    for (const email of [null, undefined, '', 'sin-arroba', 'con espacio@rpad.test', `${'a'.repeat(92)}@rpad.test`, 42]) {
      assert.deepEqual(quienes({ destinatarios: [CREADOR, { ...INVITADA, email }] }, '2026-11-03 08:00'), [1], String(email));
    }
  });

  describe('los atrasados: más de 30 minutos desde su aviso, solo de 07:00 a 20:00 de un día hábil', () => {
    it('el lunes 02/11 a las 10:00 con el día hábil anterior (aviso el viernes 30/10 a las 10:00)', () => {
      const lunes = { fecha: '2026-11-02', desde: '10:00', recordatorio: 'dia_anterior' };
      assert.deepEqual(quienes(lunes, '2026-10-30 09:59'), []);
      assert.deepEqual(quienes(lunes, '2026-10-30 10:00'), [1, 2]);
      // El fin de semana no es hábil
      assert.deepEqual(quienes(lunes, '2026-10-31 10:00'), []);
      assert.deepEqual(quienes(lunes, '2026-11-01 10:00'), []);
      // El lunes, atrasado: a las 00:00 y a las 06:30 nada; a las 07:00, sí
      assert.deepEqual(quienes(lunes, '2026-11-02 00:00:00'), []);
      assert.deepEqual(quienes(lunes, '2026-11-02 06:30:00'), []);
      assert.deepEqual(quienes(lunes, '2026-11-02 06:59:59'), []);
      assert.deepEqual(quienes(lunes, '2026-11-02 07:00:00'), [1, 2]);
      assert.deepEqual(quienes(lunes, '2026-11-02 09:30:00'), [1, 2]);
      assert.deepEqual(quienes(lunes, '2026-11-02 10:00:00'), []);
    });

    it('el martes 03/11 a las 08:00 con «2 horas antes» sale a las 06:00: está a tiempo', () => {
      const temprano = { desde: '08:00', recordatorio: '2h' };
      assert.deepEqual(quienes(temprano, '2026-11-03 05:59'), []);
      assert.deepEqual(quienes(temprano, '2026-11-03 06:00'), [1, 2]);
    });

    it('el martes 03/11 a las 08:00 con el día hábil anterior (aviso el lunes 02/11 a las 08:00)', () => {
      const martes = { desde: '08:00', recordatorio: 'dia_anterior' };
      // Atrasado y fuera de la franja: el lunes a las 22:30, nada; el martes a las 07:00, sí
      assert.deepEqual(quienes(martes, '2026-11-02 22:30'), []);
      assert.deepEqual(quienes(martes, '2026-11-03 00:00'), []);
      assert.deepEqual(quienes(martes, '2026-11-03 06:30'), []);
      assert.deepEqual(quienes(martes, '2026-11-03 07:00'), [1, 2]);
      assert.deepEqual(quienes(martes, '2026-11-03 07:30'), [1, 2]);
      assert.deepEqual(quienes(martes, '2026-11-03 08:00'), []);
    });

    it('el miércoles 04/11 a las 10:00 con el día hábil anterior (aviso el martes 03/11 a las 10:00)', () => {
      const miercoles = { fecha: '2026-11-04', desde: '10:00', recordatorio: 'dia_anterior' };
      assert.deepEqual(quienes(miercoles, '2026-11-03 15:30'), [1, 2]);
      assert.deepEqual(quienes(miercoles, '2026-11-03 19:30'), [1, 2]);
      assert.deepEqual(quienes(miercoles, '2026-11-03 19:59:59'), [1, 2]);
      assert.deepEqual(quienes(miercoles, '2026-11-03 20:00'), []);
      assert.deepEqual(quienes(miercoles, '2026-11-03 23:30'), []);
      assert.deepEqual(quienes(miercoles, '2026-11-04 06:30'), []);
      assert.deepEqual(quienes(miercoles, '2026-11-04 07:00'), [1, 2]);
    });

    it('a los 30 minutos justos todavía está a tiempo; a los 31, es atrasado', () => {
      // Aviso a las 06:00, antes de la franja
      const temprano = { desde: '08:00', recordatorio: '2h' };
      assert.deepEqual(quienes(temprano, '2026-11-03 06:30'), [1, 2]);
      assert.deepEqual(quienes(temprano, '2026-11-03 06:30:59'), [1, 2]);
      assert.deepEqual(quienes(temprano, '2026-11-03 06:31'), []);
      assert.deepEqual(quienes(temprano, '2026-11-03 07:00'), [1, 2]);
      // Aviso a las 20:00, al cierre de la franja
      const tarde = { desde: '22:00', recordatorio: '2h' };
      assert.deepEqual(quienes(tarde, '2026-11-03 19:59'), []);
      assert.deepEqual(quienes(tarde, '2026-11-03 20:00'), [1, 2]);
      assert.deepEqual(quienes(tarde, '2026-11-03 20:30'), [1, 2]);
      assert.deepEqual(quienes(tarde, '2026-11-03 20:31'), []);
      assert.deepEqual(quienes(tarde, '2026-11-03 21:30'), []);
    });

    it('los minutos cruzan días: el aviso del lunes a las 23:30 está a tiempo hasta el martes a las 00:00', () => {
      // El martes 03/11 a las 00:30 con «1 hora antes»: el aviso es el lunes 02/11 a las 23:30
      const medianoche = { desde: '00:30', recordatorio: '1h' };
      assert.deepEqual(quienes(medianoche, '2026-11-02 23:29'), []);
      assert.deepEqual(quienes(medianoche, '2026-11-02 23:30'), [1, 2]);
      assert.deepEqual(quienes(medianoche, '2026-11-03 00:00'), [1, 2]);
      assert.deepEqual(quienes(medianoche, '2026-11-03 00:01'), []);
      assert.deepEqual(quienes(medianoche, '2026-11-03 00:29'), []);
      // Cruzan meses: el martes 01/12 a las 00:30 con «1 hora antes» avisa el lunes 30/11 a las 23:30
      const mes = { fecha: '2026-12-01', desde: '00:30', recordatorio: '1h' };
      assert.deepEqual(quienes(mes, '2026-12-01 00:00'), [1, 2]);
      assert.deepEqual(quienes(mes, '2026-12-01 00:01'), []);
      // Y años: el lunes 04/01/2027 a las 10:00 con el día hábil anterior avisa el jueves 31/12/2026 a las 10:00 (el 01/01
      // es feriado): el lunes, atrasado, a las 06:30 nada y a las 07:00 sí
      const anio = { fecha: '2027-01-04', desde: '10:00', recordatorio: 'dia_anterior' };
      assert.deepEqual(quienes(anio, '2026-12-31 10:00'), [1, 2]);
      assert.deepEqual(quienes(anio, '2027-01-01 10:00'), []);
      assert.deepEqual(quienes(anio, '2027-01-04 06:30'), []);
      assert.deepEqual(quienes(anio, '2027-01-04 07:00'), [1, 2]);
    });
  });

  it('por evento y por persona, cada una una vez', () => {
    const otro = (id, destinatarios) => eventoDePrueba({ id, destinatarios });
    const uno = (usuarioId) => ({ usuario_id: usuarioId, email: `persona${usuarioId}@rpad.test`, sin_recordatorio: 0 });
    const resultado = tocan([otro(9, [uno(5), uno(2)]), otro(4, [uno(8), uno(3), uno(8)])], '2026-11-03 08:00');
    assert.deepEqual(resultado.map(({ evento_id: e, usuario_id: u }) => [e, u]), [[4, 3], [4, 8], [9, 2], [9, 5]]);
    // Un id que llega como texto se da como número
    assert.deepEqual(tocan([eventoDePrueba({ id: '7', destinatarios: [{ ...INVITADA, usuario_id: '2' }] })],
      '2026-11-03 08:00'), [{ evento_id: 7, usuario_id: 2, email: 'invitada@rpad.test', para: PARA, reintento: false }]);
  });

  it('nada tira: lo que no sirve no toca', () => {
    for (const eventos of [null, undefined, 'eventos', 42, {}]) assert.deepEqual(tocan(eventos, '2026-11-03 08:00'), []);
    for (const ahora of [null, undefined, '', '2026-11-03', '2026-11-03T08:00:00', '03/11/2026 08:00', '2026-11-03 25:00']) {
      assert.deepEqual(tocan([eventoDePrueba()], ahora), [], String(ahora));
    }
    for (const contexto of [null, undefined, 'contexto', 42]) {
      assert.deepEqual(recordatoriosQueTocan([eventoDePrueba()], contexto), []);
    }
    // Sin feriados (o con algo que no es un Set), no saca ningún día
    assert.equal(recordatoriosQueTocan([eventoDePrueba()], { ahora: '2026-11-03 08:00' }).length, 2);
    assert.equal(tocan([eventoDePrueba()], '2026-11-03 08:00', ['2026-11-03']).length, 2);
    const raros = [
      null, 42, 'evento', eventoDePrueba({ id: 0 }), eventoDePrueba({ id: 'abc' }), eventoDePrueba({ fecha: '2026-02-30' }),
      eventoDePrueba({ desde: '10:00:00' }), eventoDePrueba({ recordatorio: 'otro' }),
      eventoDePrueba({ destinatarios: null }),
      eventoDePrueba({ destinatarios: [null, 42, { usuario_id: 0, email: 'cero@rpad.test' }] })
    ];
    assert.deepEqual(tocan(raros, '2026-11-03 08:00'), []);
    // Los envíos raros no frenan a nadie
    assert.deepEqual(quienes({ envios: null }, '2026-11-03 08:00'), [1, 2]);
    const enviosRaros = [null, 42, 'envio', { usuario_id: 'abc', para: PARA, success: 1 }];
    assert.deepEqual(quienes({ envios: enviosRaros }, '2026-11-03 08:00'), [1, 2]);
  });
});

// Lo que dice la última corrida de los recordatorios (mi_espacio_eventos_corridas.resultado, en Correos → Estado) y el mensaje
// de la respuesta del cron
describe('textoDelResultadoDeEventos', () => {
  const resultado = (datos) => ({ dia_habil: true, enviados: 0, fallidos: 0, errores: [], ...datos });

  it('un día no hábil: «Día no hábil: no se mandan recordatorios.»', () => {
    assert.equal(textoDelResultadoDeEventos(resultado({ dia_habil: false })), 'Día no hábil: no se mandan recordatorios.');
  });

  it('los enviados y, si hubo, los fallidos', () => {
    assert.equal(textoDelResultadoDeEventos(resultado({ enviados: 2, fallidos: 1 })), 'Recordatorios enviados: 2. Fallidos: 1.');
    assert.equal(textoDelResultadoDeEventos(resultado({ enviados: 2 })), 'Recordatorios enviados: 2.');
    assert.equal(textoDelResultadoDeEventos(resultado({ enviados: 1 })), 'Recordatorios enviados: 1.');
    assert.equal(textoDelResultadoDeEventos(resultado({ fallidos: 3 })), 'Recordatorios enviados: 0. Fallidos: 3.');
    assert.equal(textoDelResultadoDeEventos(resultado()), 'Recordatorios enviados: 0.');
  });

  it('con un error: « Errores: …», cada uno con su evento y su persona, separados por «; »', () => {
    const conUno = resultado({ enviados: 1, errores: [{ evento_id: 12, usuario_id: 4, error: 'Falla simulada' }] });
    assert.equal(textoDelResultadoDeEventos(conUno), 'Recordatorios enviados: 1. Errores: evento 12, persona 4: Falla simulada');
    // Uno de toda la corrida (sin evento ni persona) va con su mensaje solo; sin un mensaje, «sin detalle»
    const conDos = resultado({
      enviados: 2, fallidos: 1,
      errores: [
        { evento_id: 12, usuario_id: 4, error: 'Falla simulada' },
        { evento_id: null, usuario_id: null, error: 'La base no responde' },
        { evento_id: 7, usuario_id: null, error: '' }
      ]
    });
    assert.equal(textoDelResultadoDeEventos(conDos), 'Recordatorios enviados: 2. Fallidos: 1. Errores: evento 12, persona 4: '
      + 'Falla simulada; La base no responde; evento 7: sin detalle');
    // Sin saber si el día es hábil (la corrida falló antes de leer los feriados), las cuentas y el error
    assert.equal(textoDelResultadoDeEventos(resultado({ dia_habil: null, errores: [{ error: 'La base no responde' }] })),
      'Recordatorios enviados: 0. Errores: La base no responde');
  });

  it('cortado a 1000 caracteres, contados con Array.from', () => {
    const largo = resultado({ errores: [{ evento_id: 1, usuario_id: 2, error: '😀'.repeat(2000) }] });
    const texto = textoDelResultadoDeEventos(largo);
    assert.equal(Array.from(texto).length, 1000);
    assert.ok(texto.startsWith('Recordatorios enviados: 0. Errores: evento 1, persona 2: 😀'));
    assert.ok(texto.endsWith('😀'));
  });

  it('nada tira: lo que no es un resultado cuenta como sin nada; los errores raros no cuentan', () => {
    for (const raro of [undefined, null, 42, 'x', []]) assert.equal(textoDelResultadoDeEventos(raro), 'Recordatorios enviados: 0.');
    assert.equal(textoDelResultadoDeEventos(resultado({ enviados: -1, fallidos: 'dos', errores: [null, 42, 'x'] })),
      'Recordatorios enviados: 0.');
  });
});

// Correos → Estado (spec, sección 5): la línea de la última corrida y sus alertas. La corrida es la de leerCorridaDeEventos
// ({ inicio, fin, resultado, con_errores, en_curso }, los momentos sin los segundos). Ahora es el lunes 26/10/2026 a las 10:45
describe('la última corrida de los recordatorios en Correos → Estado', () => {
  const AHORA = '2026-10-26 10:45:12';
  const SABADO = '2026-10-31 10:45:00';
  const NO_HABIL = 'Día no hábil: no se mandan recordatorios.';
  const CON_ERRORES = 'Recordatorios enviados: 1. Fallidos: 1. Errores: evento 12, persona 4: Falla simulada';
  // Una corrida que terminó hoy a las 10:30 sin errores, con lo que cambia cada caso
  const corrida = (datos) => ({
    inicio: '2026-10-26 10:30', fin: '2026-10-26 10:30', resultado: 'Recordatorios enviados: 2.', con_errores: false,
    en_curso: false, ...datos
  });
  const desde = (inicio, datos) => corrida({ inicio, fin: inicio, ...datos });
  const alertas = (deLaCorrida, ahora = AHORA, feriados = new Set()) =>
    alertasDeLaCorridaDeEventos(deLaCorrida, { ahora, feriados });
  const sinCorrida = (cuando) => ({
    tipo: 'eventos-sin-corrida', nivel: 'error',
    mensaje: `Los recordatorios de la agenda no corren desde ${cuando}: revisá la Tarea Cron de /api/cron/eventos.`
  });
  const NINGUNA = Object.freeze({
    tipo: 'eventos-sin-corrida', nivel: 'error',
    mensaje: 'No hay registro de ninguna corrida de los recordatorios de la agenda: revisá la Tarea Cron de /api/cron/eventos.'
  });
  const interrumpida = (cuando) => ({
    tipo: 'eventos-interrumpida', nivel: 'error',
    mensaje: `La corrida de los recordatorios de la agenda que empezó ${cuando} no terminó.`
  });

  describe('textoDeLaCorridaDeEventos: la línea', () => {
    it('la última corrida, hoy, ayer o el 23/10/2026, con lo que dijo', () => {
      assert.equal(textoDeLaCorridaDeEventos(corrida(), AHORA),
        'Recordatorios de la agenda: última corrida hoy a las 10:30. Recordatorios enviados: 2.');
      assert.equal(textoDeLaCorridaDeEventos(desde('2026-10-25 23:30', { resultado: NO_HABIL }), AHORA),
        'Recordatorios de la agenda: última corrida ayer a las 23:30. Día no hábil: no se mandan recordatorios.');
      assert.equal(textoDeLaCorridaDeEventos(desde('2026-10-23 10:30'), AHORA),
        'Recordatorios de la agenda: última corrida el 23/10/2026 a las 10:30. Recordatorios enviados: 2.');
      assert.equal(textoDeLaCorridaDeEventos(corrida({ con_errores: true, resultado: CON_ERRORES }), AHORA),
        `Recordatorios de la agenda: última corrida hoy a las 10:30. ${CON_ERRORES}`);
    });

    it('en curso: «corrida en curso, desde hoy a las 10:30.»', () => {
      assert.equal(textoDeLaCorridaDeEventos(corrida({ fin: null, resultado: null, en_curso: true }), AHORA),
        'Recordatorios de la agenda: corrida en curso, desde hoy a las 10:30.');
      assert.equal(textoDeLaCorridaDeEventos(desde('2026-10-25 23:30', { fin: null, resultado: null, en_curso: true }), AHORA),
        'Recordatorios de la agenda: corrida en curso, desde ayer a las 23:30.');
    });

    it('sin corrida: «sin registro todavía.»', () => {
      for (const nada of [null, undefined, 42, 'x', [], {}, { inicio: null }, corrida({ inicio: '2026-02-30 10:30' })]) {
        assert.equal(textoDeLaCorridaDeEventos(nada, AHORA), 'Recordatorios de la agenda: sin registro todavía.',
          JSON.stringify(nada));
      }
    });

    it('una que no terminó y no está en curso (se interrumpió) dice solo cuándo empezó: la alerta dice lo demás', () => {
      assert.equal(textoDeLaCorridaDeEventos(corrida({ fin: null, resultado: null }), AHORA),
        'Recordatorios de la agenda: última corrida hoy a las 10:30.');
    });

    it('sin un ahora válido, la fecha', () => {
      for (const ahora of [undefined, null, 'ahora', '2026-02-30 10:45']) {
        assert.equal(textoDeLaCorridaDeEventos(corrida(), ahora),
          'Recordatorios de la agenda: última corrida el 26/10/2026 a las 10:30. Recordatorios enviados: 2.', String(ahora));
      }
    });
  });

  describe('alertasDeLaCorridaDeEventos', () => {
    it('el lunes 26/10/2026 a las 10:45: con la última a las 10:30, ninguna; a las 09:30, eventos-sin-corrida', () => {
      assert.deepEqual(alertas(corrida()), []);
      assert.deepEqual(alertas(desde('2026-10-26 09:30')), [sinCorrida('hoy a las 09:30')]);
    });

    it('«más de 60 minutos» desde el inicio: 60 justos todavía no; 61, sí. Los minutos cruzan días', () => {
      assert.equal(MINUTOS_SIN_CORRER, 60);
      assert.deepEqual(alertas(desde('2026-10-26 09:45')), []);
      assert.deepEqual(alertas(desde('2026-10-26 09:44')), [sinCorrida('hoy a las 09:44')]);
      // El lunes a las 00:20, la del domingo a las 23:30 (la Tarea Cron llama todos los días) está a tiempo
      assert.deepEqual(alertas(desde('2026-10-25 23:30', { resultado: NO_HABIL }), '2026-10-26 00:20:00'), []);
      assert.deepEqual(alertas(desde('2026-10-25 23:00', { resultado: NO_HABIL }), '2026-10-26 00:20:00'),
        [sinCorrida('ayer a las 23:00')]);
      assert.deepEqual(alertas(desde('2026-10-23 10:30')), [sinCorrida('el 23/10/2026 a las 10:30')]);
    });

    it('el sábado 31/10/2026 y un feriado, ninguna: aunque no corra desde hace días o no haya ninguna', () => {
      assert.deepEqual(alertas(desde('2026-10-23 10:30'), SABADO), []);
      assert.deepEqual(alertas(null, SABADO), []);
      assert.deepEqual(alertas(desde('2026-10-23 10:30'), AHORA, new Set(['2026-10-26'])), []);
      assert.deepEqual(alertas(null, AHORA, new Set(['2026-10-26'])), []);
      // Un feriado de otro día no cambia nada
      assert.deepEqual(alertas(null, AHORA, new Set(['2026-10-27'])), [NINGUNA]);
    });

    it('sin corrida en un día hábil: «No hay registro de ninguna corrida …»', () => {
      for (const nada of [null, undefined, {}, corrida({ inicio: 'x' })]) assert.deepEqual(alertas(nada), [NINGUNA]);
    });

    it('con errores: eventos-con-errores, con lo que dijo la corrida (también un sábado)', () => {
      const conErrores = corrida({ con_errores: true, resultado: CON_ERRORES });
      const alerta = {
        tipo: 'eventos-con-errores', nivel: 'error',
        mensaje: `La última corrida de los recordatorios de la agenda (hoy a las 10:30) terminó con errores: ${CON_ERRORES}`
      };
      assert.deepEqual(alertas(conErrores), [alerta]);
      assert.deepEqual(alertas(desde('2026-10-31 10:30', { con_errores: true, resultado: CON_ERRORES }), SABADO), [alerta]);
      // Y vieja, en un día hábil: las dos, primero la de los errores
      assert.deepEqual(alertas(desde('2026-10-26 09:30', { con_errores: true, resultado: CON_ERRORES })), [
        { ...alerta, mensaje: alerta.mensaje.replace('10:30', '09:30') }, sinCorrida('hoy a las 09:30')
      ]);
      // Sin un resultado que diga algo, «sin detalle»
      assert.deepEqual(alertas(corrida({ con_errores: true, resultado: null })), [{
        ...alerta, mensaje: 'La última corrida de los recordatorios de la agenda (hoy a las 10:30) terminó con errores: sin detalle'
      }]);
    });

    it('sin fin ni en_curso: eventos-interrumpida; en curso, ninguna mientras no pase la hora', () => {
      assert.deepEqual(alertas(corrida({ fin: null, resultado: null })), [interrumpida('hoy a las 10:30')]);
      assert.deepEqual(alertas(corrida({ fin: null, resultado: null, en_curso: true })), []);
      // Vieja: interrumpida y sin corrida; en curso desde hace más de una hora (las que siguen terminan «ocupadas» sin anotar
      // nada), sin corrida
      assert.deepEqual(alertas(desde('2026-10-26 09:30', { fin: null, resultado: null })),
        [interrumpida('hoy a las 09:30'), sinCorrida('hoy a las 09:30')]);
      assert.deepEqual(alertas(desde('2026-10-26 09:30', { fin: null, resultado: null, en_curso: true })),
        [sinCorrida('hoy a las 09:30')]);
      // Un sábado, solo la interrumpida
      assert.deepEqual(alertas(desde('2026-10-23 10:30', { fin: null, resultado: null }), SABADO),
        [interrumpida('el 23/10/2026 a las 10:30')]);
    });

    it('nada tira: sin un ahora no se sabe si el día es hábil (sin eventos-sin-corrida); los feriados raros no sacan días', () => {
      for (const contexto of [undefined, null, 42, {}, { ahora: 'x' }, { ahora: '2026-02-30 10:45' }]) {
        assert.deepEqual(alertasDeLaCorridaDeEventos(null, contexto), [], JSON.stringify(contexto));
        assert.deepEqual(alertasDeLaCorridaDeEventos(desde('2026-10-23 10:30'), contexto), [], JSON.stringify(contexto));
      }
      assert.deepEqual(alertasDeLaCorridaDeEventos(corrida({ con_errores: true, resultado: CON_ERRORES }), {}), [{
        tipo: 'eventos-con-errores', nivel: 'error',
        mensaje: `La última corrida de los recordatorios de la agenda (el 26/10/2026 a las 10:30) terminó con errores: ${CON_ERRORES}`
      }]);
      for (const feriados of [undefined, null, ['2026-10-26'], '2026-10-26']) {
        assert.deepEqual(alertasDeLaCorridaDeEventos(null, { ahora: AHORA, feriados }), [NINGUNA], String(feriados));
      }
      // Un inicio después de ahora (otro reloj) no es «más de 60 minutos»
      assert.deepEqual(alertas(desde('2026-10-26 12:00')), []);
    });
  });

  it('alertaSinEstadoDeEventos: la advertencia cuando no se pudo leer la corrida, una nueva cada vez', () => {
    const alerta = alertaSinEstadoDeEventos();
    assert.deepEqual(alerta, {
      tipo: 'eventos-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida de los recordatorios de la agenda.'
    });
    alerta.mensaje = 'otra cosa';
    assert.equal(alertaSinEstadoDeEventos().mensaje, 'No se pudo leer la última corrida de los recordatorios de la agenda.');
  });
});

describe('cambioQueAvisa', () => {
  const ANTES = Object.freeze({
    titulo: 'Reunión de equipo', detalle: 'Sala 1.', fecha: '2026-11-03', desde: '10:00', hasta: '11:00', recordatorio: '2h',
    compartido: true, para_todos: false, personas: [2, 3]
  });

  it('avisa si cambió el título, la fecha, la hora de inicio o la de fin', () => {
    for (const cambio of [
      { titulo: 'Reunión de área' }, { fecha: '2026-11-04' }, { desde: '10:30' }, { hasta: '12:00' }, { hasta: null },
      { hasta: '' }
    ]) {
      assert.equal(cambioQueAvisa(ANTES, { ...ANTES, ...cambio }), true, JSON.stringify(cambio));
    }
    assert.equal(cambioQueAvisa({ ...ANTES, hasta: null }, { ...ANTES, hasta: '11:00' }), true);
  });

  it('no avisa si cambió solo el detalle, el recordatorio o las personas', () => {
    assert.equal(cambioQueAvisa(ANTES, { ...ANTES }), false);
    for (const cambio of [
      { detalle: 'Sala 2.' }, { detalle: null }, { recordatorio: 'ninguno' }, { personas: [4] }, { para_todos: true },
      { compartido: false }
    ]) {
      assert.equal(cambioQueAvisa(ANTES, { ...ANTES, ...cambio }), false, JSON.stringify(cambio));
    }
  });

  it('sin hora de fin: null, vacía o que no venga son lo mismo', () => {
    const sinHasta = { ...ANTES };
    delete sinHasta.hasta;
    for (const hasta of [null, '', undefined]) {
      assert.equal(cambioQueAvisa({ ...ANTES, hasta: null }, { ...ANTES, hasta }), false, String(hasta));
      assert.equal(cambioQueAvisa(sinHasta, { ...ANTES, hasta }), false, String(hasta));
    }
  });

  it('nada tira: si alguno no es un objeto, false', () => {
    for (const valor of [null, undefined, 42, 'evento', []]) {
      assert.equal(cambioQueAvisa(valor, ANTES), false);
      assert.equal(cambioQueAvisa(ANTES, valor), false);
    }
  });
});

describe('emailsDelGuardado', () => {
  // El martes 03/11/2026 de 10:00 a 11:00, de la persona 1; hoy es el martes 27/10/2026
  const AHORA = '2026-10-27 10:00:00';
  const EVENTO = Object.freeze({
    id: 7, creado_por: 1, titulo: 'Reunión de equipo', detalle: null, fecha: '2026-11-03', desde: '10:00', hasta: '11:00',
    recordatorio: '2h'
  });
  const NINGUNO = Object.freeze({ invitacion: [], cambio: [], cancelacion: [] });
  const guardado = (datos) => emailsDelGuardado({
    antes: EVENTO, despues: EVENTO, audienciaAntes: [], audienciaDespues: [], ahora: AHORA, ...datos
  });

  it('el alta invita a la audiencia', () => {
    assert.deepEqual(guardado({ antes: null, audienciaDespues: [2, 3] }), { invitacion: [2, 3], cambio: [], cancelacion: [] });
    // Un evento personal no le manda nada a nadie
    assert.deepEqual(guardado({ antes: null, audienciaDespues: [] }), NINGUNO);
  });

  it('un cambio de hora invita a los que entran y les avisa a los que siguen; a los que salen, nada', () => {
    const otraHora = { ...EVENTO, desde: '11:00', hasta: '12:00' };
    assert.deepEqual(guardado({ despues: otraHora, audienciaAntes: [2, 3], audienciaDespues: [3, 4] }),
      { invitacion: [4], cambio: [3], cancelacion: [] });
    // Otro título, otra fecha o sin hora de fin, lo mismo
    for (const cambio of [{ titulo: 'Reunión de área' }, { fecha: '2026-11-04' }, { hasta: null }]) {
      assert.deepEqual(guardado({ despues: { ...EVENTO, ...cambio }, audienciaAntes: [2, 3], audienciaDespues: [3, 4] }),
        { invitacion: [4], cambio: [3], cancelacion: [] }, JSON.stringify(cambio));
    }
  });

  it('un cambio que no toca la fecha, la hora ni el título no les avisa a los que siguen', () => {
    for (const cambio of [{ detalle: 'Sala 2.' }, { recordatorio: 'ninguno' }, {}]) {
      const despues = { ...EVENTO, ...cambio };
      assert.deepEqual(guardado({ despues, audienciaAntes: [2, 3], audienciaDespues: [2, 3] }), NINGUNO,
        JSON.stringify(cambio));
      // Los que entran se invitan igual
      assert.deepEqual(guardado({ despues, audienciaAntes: [2, 3], audienciaDespues: [3, 4] }),
        { invitacion: [4], cambio: [], cancelacion: [] }, JSON.stringify(cambio));
    }
  });

  it('a quien se saca, nada: también si pasa a «Solo yo»', () => {
    const otraHora = { ...EVENTO, desde: '11:00' };
    assert.deepEqual(guardado({ despues: otraHora, audienciaAntes: [2, 3], audienciaDespues: [] }), NINGUNO);
    assert.deepEqual(guardado({ despues: otraHora, audienciaAntes: [2, 3], audienciaDespues: [3] }),
      { invitacion: [], cambio: [3], cancelacion: [] });
  });

  it('la baja le avisa a la audiencia que se canceló', () => {
    assert.deepEqual(guardado({ despues: null, audienciaAntes: [2, 3], audienciaDespues: [4] }),
      { invitacion: [], cambio: [], cancelacion: [2, 3] });
    assert.deepEqual(guardado({ despues: null, audienciaAntes: [] }), NINGUNO);
  });

  it('uno que ya empezó: nada (el de después; en una baja, el de antes)', () => {
    const ayer = { ...EVENTO, fecha: '2026-10-26' };
    assert.deepEqual(guardado({ antes: null, despues: ayer, audienciaDespues: [2, 3] }), NINGUNO);
    assert.deepEqual(guardado({ antes: ayer, despues: { ...ayer, desde: '11:00' }, audienciaAntes: [2, 3],
      audienciaDespues: [3, 4] }), NINGUNO);
    assert.deepEqual(guardado({ antes: ayer, despues: null, audienciaAntes: [2, 3] }), NINGUNO);
    // Justo a la hora de inicio ya empezó; un segundo antes, todavía no
    const hoy = { ...EVENTO, fecha: '2026-10-27' };
    assert.deepEqual(guardado({ antes: null, despues: hoy, audienciaDespues: [2], ahora: '2026-10-27 10:00:00' }), NINGUNO);
    assert.deepEqual(guardado({ antes: null, despues: hoy, audienciaDespues: [2], ahora: '2026-10-27 09:59:59' }),
      { invitacion: [2], cambio: [], cancelacion: [] });
    // Pasado a una fecha que todavía no llegó, cuenta el de después; pasado al de ayer, nada
    assert.deepEqual(guardado({ antes: ayer, despues: EVENTO, audienciaAntes: [2, 3], audienciaDespues: [3, 4] }),
      { invitacion: [4], cambio: [3], cancelacion: [] });
    assert.deepEqual(guardado({ antes: EVENTO, despues: ayer, audienciaAntes: [2, 3], audienciaDespues: [3, 4] }), NINGUNO);
  });

  it('quien lo creó nunca está; los ids, sin repetidos y de menor a mayor', () => {
    assert.deepEqual(guardado({ antes: null, audienciaDespues: [3, 1, 2, 3] }),
      { invitacion: [2, 3], cambio: [], cancelacion: [] });
    assert.deepEqual(guardado({ despues: null, audienciaAntes: [1, 2] }), { invitacion: [], cambio: [], cancelacion: [2] });
    // La audiencia puede venir como las personas de audienciaDe, con su id (también como texto)
    const personas = [{ id: 12, nombre: 'Persona de Prueba', email: 'p@rpad.test' }, { id: '4', nombre: 'Test adminB' }];
    assert.deepEqual(guardado({ antes: null, audienciaDespues: personas }),
      { invitacion: [4, 12], cambio: [], cancelacion: [] });
  });

  it('nada tira: sin un ahora o un evento que sirvan, nadie', () => {
    for (const entrada of [null, undefined, 42, 'guardado', []]) assert.deepEqual(emailsDelGuardado(entrada), NINGUNO);
    for (const ahora of [null, undefined, '', '2026-10-27', '2026-10-27T10:00:00']) {
      assert.deepEqual(guardado({ antes: null, audienciaDespues: [2], ahora }), NINGUNO, String(ahora));
    }
    assert.deepEqual(guardado({ antes: null, despues: null, audienciaDespues: [2] }), NINGUNO);
    for (const despues of [{ ...EVENTO, fecha: '2026-02-30' }, { ...EVENTO, desde: '9:00' }, 42, 'evento']) {
      assert.deepEqual(guardado({ antes: null, despues, audienciaDespues: [2] }), NINGUNO, JSON.stringify(despues));
    }
    // Una audiencia que no es una lista es nadie, y lo que no es un id no cuenta
    assert.deepEqual(guardado({ antes: null, audienciaDespues: null }), NINGUNO);
    assert.deepEqual(guardado({ antes: null, audienciaDespues: [0, 'abc', null, {}, { id: -2 }, 1.5, 5] }),
      { invitacion: [5], cambio: [], cancelacion: [] });
  });
});

describe('validarAvisoDelEvento', () => {
  const aviso = (datos) => validarAvisoDelEvento({ fecha: '2026-11-02', desde: '10:00', recordatorio: 'dia_anterior', ...datos },
    HOY);

  it('la fecha, la hora y el recordatorio del pedido; sin recordatorio (o null), el de entrada', () => {
    assert.deepEqual(aviso({}), { datos: { fecha: '2026-11-02', desde: '10:00', recordatorio: 'dia_anterior' }, error: null });
    assert.equal(aviso({ recordatorio: undefined }).datos.recordatorio, '2h');
    assert.equal(aviso({ recordatorio: null }).datos.recordatorio, '2h');
    // El título y lo demás del evento no se piden ni se devuelven
    assert.deepEqual(Object.keys(aviso({ titulo: '', hasta: '09:00' }).datos), ['fecha', 'desde', 'recordatorio']);
  });

  it('cada dato que no sirve da el error de su campo, con los mensajes de validarEvento y en su orden', () => {
    for (const fecha of ['abc', '2026-02-30', '2024-12-31', '2028-10-27', undefined, ['2026-11-02']]) {
      assert.deepEqual(aviso({ fecha }), { datos: null, error: { campo: 'fecha', mensaje: RANGO } }, String(fecha));
    }
    for (const desde of ['9:00', '10:00:00', '24:00', '', undefined, 1000]) {
      assert.deepEqual(aviso({ desde }), { datos: null, error: { campo: 'desde', mensaje: MENSAJES_EVENTO.desde } },
        String(desde));
    }
    for (const recordatorio of ['otro', '', '1H', ['2h']]) {
      assert.deepEqual(aviso({ recordatorio }),
        { datos: null, error: { campo: 'recordatorio', mensaje: MENSAJES_EVENTO.recordatorio } }, String(recordatorio));
    }
    // La fecha va antes que la hora, y la hora antes que el recordatorio
    assert.equal(aviso({ fecha: 'abc', desde: '9:00', recordatorio: 'otro' }).error.campo, 'fecha');
    assert.equal(aviso({ desde: '9:00', recordatorio: 'otro' }).error.campo, 'desde');
  });

  it('nada tira: lo que no es un objeto cuenta como {} (y sin un hoy válido no pasa ninguna fecha)', () => {
    for (const entrada of [null, undefined, 42, 'aviso', []]) {
      assert.equal(validarAvisoDelEvento(entrada, HOY).error.campo, 'fecha');
    }
    assert.equal(validarAvisoDelEvento({ fecha: '2026-11-02', desde: '10:00' }, 'hoy').error.campo, 'fecha');
  });
});

describe('avisoDe', () => {
  const AHORA = '2026-10-26 09:00:00';

  it('el momento, el texto y el corto del recordatorio, con los feriados', () => {
    const evento = { fecha: '2026-11-02', desde: '10:00', recordatorio: 'dia_anterior' };
    assert.deepEqual(avisoDe(evento, { ahora: AHORA, feriados: new Set() }), {
      momento: '2026-10-30 10:00', texto: 'El día hábil anterior (el viernes 30/10 a las 10:00)',
      corto: 'Aviso el día hábil anterior'
    });
    assert.deepEqual(avisoDe(evento, { ahora: AHORA, feriados: new Set(['2026-10-30']) }), {
      momento: '2026-10-29 10:00', texto: 'El día hábil anterior (el jueves 29/10 a las 10:00)',
      corto: 'Aviso el día hábil anterior'
    });
  });

  it('sin aviso, momento null', () => {
    assert.deepEqual(avisoDe({ fecha: '2026-10-27', desde: '10:00', recordatorio: 'ninguno' }, { ahora: AHORA }),
      { momento: null, texto: 'Sin aviso', corto: 'Sin aviso' });
  });

  it('nada tira: con algo que no sirve, momento null y los textos vacíos', () => {
    for (const evento of [null, undefined, 42, {}, { fecha: '2026-10-27', desde: '10:00', recordatorio: 'otro' }]) {
      assert.deepEqual(avisoDe(evento, { ahora: AHORA }), { momento: null, texto: '', corto: '' }, JSON.stringify(evento));
    }
    assert.deepEqual(avisoDe({ fecha: '2026-10-27', desde: '10:00', recordatorio: '2h' }),
      { momento: '2026-10-27 08:00', texto: '2 horas antes', corto: 'Aviso 2 h antes' });
  });
});

describe('personasDelPedido', () => {
  const pedido = (pedidas, permitidas = [2, 3, 4]) => personasDelPedido(pedidas, { usuarioId: 1, permitidas });

  it('las elegidas, en su orden, si todas se pueden elegir; el id propio se saca sin error', () => {
    assert.deepEqual(pedido([3, 2]), { personas: [3, 2], error: null });
    assert.deepEqual(pedido([1, 4]), { personas: [4], error: null });
    assert.deepEqual(pedido([2, 2, 3]), { personas: [2, 3], error: null });
    assert.deepEqual(pedido([3], new Set([3])), { personas: [3], error: null });
  });

  it('una que no se puede elegir, personasInvalidas; sin ninguna (o solo con la propia), personas', () => {
    const invalidas = { personas: null, error: { campo: 'personas', mensaje: MENSAJES_EVENTO.personasInvalidas } };
    const ninguna = { personas: null, error: { campo: 'personas', mensaje: MENSAJES_EVENTO.personas } };
    assert.deepEqual(pedido([2, 9]), invalidas);
    assert.deepEqual(pedido([2, 'x']), invalidas);
    assert.deepEqual(pedido([2], []), invalidas);
    assert.deepEqual(pedido([1]), ninguna);
    assert.deepEqual(pedido([]), ninguna);
  });

  it('nada tira: sin una lista, ninguna; sin permitidas, ninguna se puede elegir', () => {
    for (const pedidas of [null, undefined, 42, 'personas']) {
      assert.equal(personasDelPedido(pedidas, { usuarioId: 1, permitidas: [2] }).error.mensaje, MENSAJES_EVENTO.personas);
    }
    assert.equal(personasDelPedido([2]).error.mensaje, MENSAJES_EVENTO.personasInvalidas);
    assert.equal(personasDelPedido([2], { usuarioId: 1, permitidas: 'todos' }).error.mensaje,
      MENSAJES_EVENTO.personasInvalidas);
  });
});

describe('itemDeEvento', () => {
  const AHORA = '2026-10-26 09:00:00';
  // Un evento de Laura (id 1), como lo devuelven los datos (services/miEspacioEventosDatos.js)
  const evento = (datos) => ({
    id: 5, creado_por: 1, creador: 'Laura Gómez', titulo: 'Reunión de equipo', detalle: null, fecha: '2026-10-27',
    desde: '10:00', hasta: '11:00', compartido: false, para_todos: false, recordatorio: '2h', personas: [], ...datos
  });
  const item = (datos, usuarioId = 1, feriados = new Set()) =>
    itemDeEvento(evento(datos), { usuarioId, ahora: AHORA, feriados });
  const persona = (id, nombre, sinRecordatorio = false) => ({ id, nombre, sin_recordatorio: sinRecordatorio });
  const CUATRO = [persona(2, 'Martín Ríos'), persona(3, 'Sofía Paz'), persona(4, 'Carla Benítez'),
    persona(6, 'Diego Fernández', true)];
  const CLAVES_DEL_MIO = ['id', 'titulo', 'detalle', 'fecha', 'desde', 'hasta', 'es_mio', 'compartido', 'para_todos', 'creador',
    'personas', 'personas_ids', 'recordatorio', 'recordatorio_texto', 'mi_recordatorio', 'aviso', 'quien_texto'];
  const CLAVES_DEL_AJENO = ['id', 'titulo', 'detalle', 'fecha', 'desde', 'hasta', 'es_mio', 'compartido', 'para_todos', 'creador',
    'personas', 'recordatorio', 'recordatorio_texto', 'mi_recordatorio', 'aviso', 'quien_texto', 'quien_largo'];

  // Sin la administración (como acá: `item` no la pasa), el nombre corto de cada uno es su primer nombre
  it('uno personal: «Solo vos», con su recordatorio y cuándo sale', () => {
    assert.deepEqual(item({}), {
      id: 5, titulo: 'Reunión de equipo', detalle: null, fecha: '2026-10-27', desde: '10:00', hasta: '11:00', es_mio: true,
      compartido: false, para_todos: false, creador: 'Laura', personas: [], personas_ids: [], recordatorio: '2h',
      recordatorio_texto: '2 horas antes', mi_recordatorio: '2h',
      aviso: { momento: '2026-10-27 08:00', texto: '2 horas antes (mañana a las 08:00)', corto: 'Aviso 2 h antes' },
      quien_texto: 'Solo vos'
    });
    assert.deepEqual(Object.keys(item({})), CLAVES_DEL_MIO);
  });

  it('uno propio compartido: «Con <nombre>», «Con 4 personas» o «Con todos», con los nombres completos y los ids', () => {
    const uno = item({ compartido: true, personas: [persona(2, 'Martín Ríos')] });
    assert.equal(uno.quien_texto, 'Con Martín');
    assert.deepEqual(uno.personas, ['Martín Ríos']);
    assert.deepEqual(uno.personas_ids, [2]);
    const cuatro = item({ compartido: true, personas: CUATRO });
    assert.equal(cuatro.quien_texto, 'Con 4 personas');
    assert.deepEqual(cuatro.personas, ['Martín Ríos', 'Sofía Paz', 'Carla Benítez', 'Diego Fernández']);
    assert.deepEqual(cuatro.personas_ids, [2, 3, 4, 6]);
    // El recordatorio que apagó una invitada no cambia el de quien lo creó
    assert.equal(cuatro.mi_recordatorio, '2h');
    // Con «Todos», las filas son solo las de quienes apagaron su recordatorio: no son personas elegidas
    const todos = item({ compartido: true, para_todos: true, personas: [persona(6, 'Diego Fernández', true)] });
    assert.equal(todos.quien_texto, 'Con todos');
    assert.deepEqual(todos.personas, []);
    assert.deepEqual(todos.personas_ids, []);
    assert.equal(todos.para_todos, true);
    assert.deepEqual(Object.keys(todos), CLAVES_DEL_MIO);
  });

  it('uno ajeno: «De <creador>» y quién está, con vos primero; sin los ids', () => {
    const ajeno = item({ compartido: true, personas: [persona(3, 'Sofía Paz'), persona(2, 'Martín Ríos'),
      persona(4, 'Carla Benítez')] }, 2);
    assert.equal(ajeno.es_mio, false);
    assert.equal(ajeno.creador, 'Laura');
    assert.equal(ajeno.quien_texto, 'De Laura');
    assert.equal(ajeno.quien_largo, 'Lo creó Laura. Están: vos, Sofía y Carla.');
    assert.deepEqual(ajeno.personas, ['Sofía Paz', 'Martín Ríos', 'Carla Benítez']);
    assert.deepEqual(Object.keys(ajeno), CLAVES_DEL_AJENO);
    assert.equal(item({ compartido: true, personas: [persona(2, 'Martín Ríos')] }, 2).quien_largo,
      'Lo creó Laura. Están: vos.');
    // Para todos
    const todos = item({ compartido: true, para_todos: true, personas: [persona(6, 'Diego Fernández', true)] }, 2);
    assert.equal(todos.quien_largo, 'Lo creó Laura. Es para todos.');
    assert.equal(todos.quien_texto, 'De Laura');
    assert.deepEqual(todos.personas, []);
  });

  // El nombre corto (spec 2026-10-28-mi-espacio-agenda-onda, 5.1 y decisiones 9.3, 9.4 y 9.13): quien lo creó y quién está,
  // como los ven los compañeros (nombreCorto, contra toda la administración activa, no solo la del evento); `personas`
  // sigue con los nombres completos (el formulario los usa al lado de los de la lista para compartir). Quien mira es Andrea
  describe('con la administración: el nombre corto', () => {
    const ANDREA = Object.freeze({ id: 1, nombre: 'Andrea Paula Molina' });
    const CARLA_B = Object.freeze({ id: 2, nombre: 'Carla Inés Benítez' });
    const JULIAN = Object.freeze({ id: 4, nombre: 'Julián Esteban Ferreyra' });
    const CARLA_R = Object.freeze({ id: 9, nombre: 'Carla Ríos' });
    const ADMINISTRACION = Object.freeze([ANDREA, CARLA_B, JULIAN]);
    const CON_CARLA_RIOS = Object.freeze([...ADMINISTRACION, CARLA_R]);
    const invitada = ({ id, nombre }) => persona(id, nombre);
    // Un evento de `quien` (`{ id, nombre }`), compartido con `invitadas`, como lo ve Andrea con esa administración
    const comoLoVeAndrea = (quien, invitadas, administracion = ADMINISTRACION, cambios = {}) => itemDeEvento(
      evento({ creado_por: quien.id, creador: quien.nombre, compartido: true, personas: invitadas.map(invitada), ...cambios }),
      { usuarioId: ANDREA.id, ahora: AHORA, feriados: new Set(), administracion }
    );

    it('uno ajeno de Julián: «Julián», «De Julián» y «Lo creó Julián. Están: vos y Carla.»; personas, completos', () => {
      const ajeno = comoLoVeAndrea(JULIAN, [ANDREA, CARLA_B]);
      assert.equal(ajeno.creador, 'Julián');
      assert.equal(ajeno.quien_texto, 'De Julián');
      assert.equal(ajeno.quien_largo, 'Lo creó Julián. Están: vos y Carla.');
      assert.deepEqual(ajeno.personas, ['Andrea Paula Molina', 'Carla Inés Benítez']);
      assert.deepEqual(Object.keys(ajeno), CLAVES_DEL_AJENO);
      const paraTodos = comoLoVeAndrea(JULIAN, [], ADMINISTRACION, { para_todos: true });
      assert.equal(paraTodos.quien_texto, 'De Julián');
      assert.equal(paraTodos.quien_largo, 'Lo creó Julián. Es para todos.');
    });

    it('uno propio con una persona: «Con Carla»; con dos, «Con 2 personas»; personas, completos', () => {
      const conCarla = comoLoVeAndrea(ANDREA, [CARLA_B]);
      assert.equal(conCarla.es_mio, true);
      assert.equal(conCarla.quien_texto, 'Con Carla');
      assert.equal(conCarla.creador, 'Andrea');
      assert.deepEqual(conCarla.personas, ['Carla Inés Benítez']);
      assert.deepEqual(conCarla.personas_ids, [2]);
      assert.deepEqual(Object.keys(conCarla), CLAVES_DEL_MIO);
      const conDos = comoLoVeAndrea(ANDREA, [CARLA_B, JULIAN]);
      assert.equal(conDos.quien_texto, 'Con 2 personas');
      assert.deepEqual(conDos.personas, ['Carla Inés Benítez', 'Julián Esteban Ferreyra']);
      assert.equal(comoLoVeAndrea(ANDREA, [], ADMINISTRACION, { para_todos: true }).quien_texto, 'Con todos');
    });

    it('con Carla Ríos en la administración: «Carla B.» y «Carla R.», también si no está en el evento', () => {
      assert.equal(comoLoVeAndrea(JULIAN, [ANDREA, CARLA_B, CARLA_R], CON_CARLA_RIOS).quien_largo,
        'Lo creó Julián. Están: vos, Carla B. y Carla R.');
      // La lista es la de toda la administración: Carla Ríos no está en el evento y Carla Benítez sigue siendo «Carla B.»
      assert.equal(comoLoVeAndrea(JULIAN, [ANDREA, CARLA_B], CON_CARLA_RIOS).quien_largo,
        'Lo creó Julián. Están: vos y Carla B.');
      assert.equal(comoLoVeAndrea(ANDREA, [CARLA_B], CON_CARLA_RIOS).quien_texto, 'Con Carla B.');
      // Quien lo creó, también
      const deCarlaRios = comoLoVeAndrea(CARLA_R, [ANDREA, CARLA_B, JULIAN], CON_CARLA_RIOS);
      assert.equal(deCarlaRios.creador, 'Carla R.');
      assert.equal(deCarlaRios.quien_texto, 'De Carla R.');
      assert.equal(deCarlaRios.quien_largo, 'Lo creó Carla R. Están: vos, Carla B. y Julián.');
    });

    it('quien ya no es de administración se compara igual contra la lista: Carla Bustos, Tomás', () => {
      // Carla Bustos tiene la inicial de Carla Benítez: el nombre completo
      const deCarlaBustos = comoLoVeAndrea({ id: 7, nombre: 'Carla Bustos' }, [ANDREA, { id: 8, nombre: 'Tomás Quiroga' }]);
      assert.equal(deCarlaBustos.creador, 'Carla Bustos');
      assert.equal(deCarlaBustos.quien_largo, 'Lo creó Carla Bustos. Están: vos y Tomás.');
    });

    it('sin la administración (una llamada de antes), o con algo que no es una lista: el primer nombre, sin tirar', () => {
      const deJulian = evento({ creado_por: JULIAN.id, creador: JULIAN.nombre, compartido: true,
        personas: [ANDREA, CARLA_B, CARLA_R].map(invitada) });
      const deAndrea = evento({ creado_por: ANDREA.id, creador: ANDREA.nombre, compartido: true, personas: [invitada(CARLA_R)] });
      const contextos = [{ usuarioId: ANDREA.id, ahora: AHORA },
        ...[null, undefined, 'x', 42, {}].map((administracion) => ({ usuarioId: ANDREA.id, ahora: AHORA, administracion }))];
      for (const contexto of contextos) {
        const ajeno = itemDeEvento(deJulian, contexto);
        assert.equal(ajeno.creador, 'Julián', String(contexto.administracion));
        assert.equal(ajeno.quien_texto, 'De Julián', String(contexto.administracion));
        assert.equal(ajeno.quien_largo, 'Lo creó Julián. Están: vos, Carla y Carla.', String(contexto.administracion));
        assert.equal(itemDeEvento(deAndrea, contexto).quien_texto, 'Con Carla', String(contexto.administracion));
      }
    });

    it('el punto de una inicial cierra la oración: «Lo creó Carla R.», sin dos puntos', () => {
      assert.equal(comoLoVeAndrea(CARLA_R, [ANDREA], CON_CARLA_RIOS).quien_largo, 'Lo creó Carla R. Están: vos.');
      assert.equal(comoLoVeAndrea(CARLA_R, [], CON_CARLA_RIOS, { para_todos: true }).quien_largo,
        'Lo creó Carla R. Es para todos.');
      // Sin ninguna persona (la API no lo da: es la última rama del texto), solo quien lo creó
      assert.equal(comoLoVeAndrea(CARLA_R, [], CON_CARLA_RIOS).quien_largo, 'Lo creó Carla R.');
      // Y la lista que termina en una inicial
      assert.equal(comoLoVeAndrea(JULIAN, [ANDREA, CARLA_R], CON_CARLA_RIOS).quien_largo, 'Lo creó Julián. Están: vos y Carla R.');
    });

    it('sin nombre: quien lo creó es null y la raya en los textos; una sola persona sin nombre, «Con 1 persona»', () => {
      for (const creador of [null, '', '   ', 42]) {
        const ajeno = comoLoVeAndrea({ id: JULIAN.id, nombre: creador }, [ANDREA]);
        assert.equal(ajeno.creador, null, String(creador));
        assert.equal(ajeno.quien_texto, 'De —', String(creador));
        assert.equal(ajeno.quien_largo, 'Lo creó —. Están: vos.', String(creador));
      }
      assert.equal(comoLoVeAndrea(ANDREA, [{ id: 2, nombre: null }]).quien_texto, 'Con 1 persona');
    });
  });

  it('mi recordatorio: ninguno si lo apagué, y el aviso va sobre él; el recordatorio del evento no cambia', () => {
    const apagado = item({ compartido: true, personas: [persona(2, 'Martín Ríos', true)] }, 2);
    assert.equal(apagado.recordatorio, '2h');
    assert.equal(apagado.recordatorio_texto, '2 horas antes');
    assert.equal(apagado.mi_recordatorio, 'ninguno');
    assert.deepEqual(apagado.aviso, { momento: null, texto: 'Sin aviso', corto: 'Sin aviso' });
    // Con una fila que dice 1 (como llega de un tinyint), también
    assert.equal(item({ compartido: true, personas: [persona(2, 'Martín Ríos', 1)] }, 2).mi_recordatorio, 'ninguno');
    // En uno para todos, con la fila de quien lo apagó
    assert.equal(item({ compartido: true, para_todos: true, personas: [persona(2, 'Martín Ríos', true)] }, 2).mi_recordatorio,
      'ninguno');
    // Sin la fila (para todos, sin apagarlo) o prendido, el del evento
    assert.equal(item({ compartido: true, para_todos: true, recordatorio: '1h' }, 2).mi_recordatorio, '1h');
    assert.equal(item({ compartido: true, personas: [persona(2, 'Martín Ríos')], recordatorio: 'dia_anterior' }, 2)
      .aviso.momento, '2026-10-26 10:00');
  });

  it('el aviso con los feriados: el día hábil anterior de un lunes con el viernes feriado es el jueves', () => {
    const lunes = item({ fecha: '2026-11-02', recordatorio: 'dia_anterior' }, 1, new Set(['2026-10-30']));
    assert.deepEqual(lunes.aviso, {
      momento: '2026-10-29 10:00', texto: 'El día hábil anterior (el jueves 29/10 a las 10:00)',
      corto: 'Aviso el día hábil anterior'
    });
  });

  it('nada tira: con algo que no sirve, lo que se pueda y la raya donde iba quien lo creó', () => {
    for (const entrada of [null, undefined, 42, 'evento', []]) {
      const resultado = itemDeEvento(entrada, { usuarioId: 1, ahora: AHORA });
      assert.equal(resultado.id, null);
      assert.equal(resultado.es_mio, false);
      assert.equal(resultado.quien_texto, 'De —');
      assert.deepEqual(resultado.personas, []);
    }
    assert.equal(itemDeEvento(evento({})).es_mio, false);
    assert.equal(itemDeEvento(evento({}), null).quien_texto, 'De Laura');
    // Sin quien lo creó (un creado_por en NULL): la raya
    assert.equal(item({ creado_por: null, creador: null, compartido: true, personas: [persona(2, 'Martín Ríos')] }, 2)
      .quien_largo, 'Lo creó —. Están: vos.');
    // Personas raras no cuentan
    assert.deepEqual(item({ compartido: true, personas: [null, 'x', { id: 'abc' }, persona(3, 'Sofía Paz')] }).personas_ids,
      [3]);
  });
});

// Lo demás de la agenda (spec, secciones 6 y 7): lo que se ve en el mes y en Próximos además de los eventos
describe('itemDeLicencia', () => {
  const NOVIEMBRE = { desde: '2026-11-01', hasta: '2026-11-30', feriados: new Set() };
  const licencia = (datos) => ({ id: 7, tipo: 'vacaciones', desde: '2026-10-26', hasta: '2026-11-06', horas: null, ...datos });
  const CLAVES = ['id', 'tipo', 'desde', 'hasta', 'texto', 'hasta_texto', 'dias'];

  it('«Franquicia, 2 h», de un día, sin hasta_texto y con su día', () => {
    const franquicia = itemDeLicencia(licencia({ tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: 2 }),
      NOVIEMBRE);
    assert.deepEqual(franquicia, {
      id: 7, tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', texto: 'Franquicia, 2 h', hasta_texto: '',
      dias: ['2026-11-04']
    });
    assert.deepEqual(Object.keys(franquicia), CLAVES);
    // Las horas con coma; las de la base llegan como texto ('7.5') o ya convertidas
    assert.equal(itemDeLicencia(licencia({ tipo: 'franquicia', desde: '2026-11-04', hasta: '2026-11-04', horas: '7.5' }),
      NOVIEMBRE).texto, 'Franquicia, 7,5 h');
    assert.equal(itemDeLicencia(licencia({ tipo: 'horas_a_favor', desde: '2026-11-04', hasta: '2026-11-04', horas: 3 }),
      NOVIEMBRE).texto, 'Horas a favor, 3 h');
    // Sin horas, solo el nombre del tipo
    assert.equal(itemDeLicencia(licencia({ tipo: 'franco', desde: '2026-11-04', hasta: '2026-11-04' }), NOVIEMBRE).texto,
      'Franco compensatorio');
  });

  it('vacaciones del 26/10 al 06/11 pedidas de noviembre: sus hábiles de noviembre, sin el feriado; «Hasta el viernes 06/11»',
    () => {
      const sinFeriado = itemDeLicencia(licencia({}), NOVIEMBRE);
      assert.deepEqual(sinFeriado, {
        id: 7, tipo: 'vacaciones', desde: '2026-10-26', hasta: '2026-11-06', texto: 'Vacaciones',
        hasta_texto: 'Hasta el viernes 06/11', dias: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
      });
      const conFeriado = itemDeLicencia(licencia({}), { ...NOVIEMBRE, feriados: new Set(['2026-11-03']) });
      assert.deepEqual(conFeriado.dias, ['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06']);
      // Entera: el desde y el hasta son los suyos, aunque pasen del rango
      assert.deepEqual([conFeriado.desde, conFeriado.hasta], ['2026-10-26', '2026-11-06']);
      // Pedidas de octubre: sus días hábiles de octubre
      assert.deepEqual(itemDeLicencia(licencia({}), { desde: '2026-10-01', hasta: '2026-10-31', feriados: new Set() }).dias,
        ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    });

  it('nada tira: con algo que no sirve, sin id, sin tipo, sin textos y sin días', () => {
    for (const entrada of [null, undefined, 42, 'licencia', []]) {
      assert.deepEqual(itemDeLicencia(entrada, NOVIEMBRE),
        { id: null, tipo: null, desde: null, hasta: null, texto: '', hasta_texto: '', dias: [] });
    }
    // Un rango que no es un rango: sin días
    for (const opciones of [null, undefined, {}, { desde: 'abc', hasta: '2026-11-30' },
      { desde: '2026-11-30', hasta: '2026-11-01' }]) {
      assert.deepEqual(itemDeLicencia(licencia({}), opciones).dias, []);
    }
    // Un tipo que no es de la lista: sin texto; unas horas que no son un número, sin las horas
    assert.equal(itemDeLicencia(licencia({ tipo: 'otro' }), NOVIEMBRE).texto, '');
    assert.equal(itemDeLicencia(licencia({ tipo: 'otro' }), NOVIEMBRE).tipo, null);
    assert.equal(itemDeLicencia(licencia({ tipo: 'franquicia', horas: 'x' }), NOVIEMBRE).texto, 'Franquicia');
  });
});

describe('itemDeAusencia', () => {
  const NOVIEMBRE = { desde: '2026-11-01', hasta: '2026-11-30', feriados: new Set(['2026-11-03']) };
  // Como la da ausentesPara (ausentesDelRango), con lo que nunca tiene que pasar
  const ausencia = (datos) => ({
    usuario_id: 9, nombre: 'Martín Ríos', desde: '2026-10-26', hasta: '2026-11-06', vuelve: '2026-11-09',
    texto: 'Martín Ríos no está', vuelve_texto: 'Vuelve el lunes 09/11', tipo: 'medica', nota: 'Turno', id: 4, ...datos
  });

  it('exactamente sus seis claves: nunca el tipo, la nota ni un id', () => {
    const item = itemDeAusencia(ausencia({}), NOVIEMBRE);
    assert.deepEqual(item, {
      nombre: 'Martín Ríos', desde: '2026-10-26', hasta: '2026-11-06', texto: 'Martín Ríos no está',
      hasta_texto: 'Hasta el viernes 06/11', dias: ['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06']
    });
    assert.deepEqual(Object.keys(item), ['nombre', 'desde', 'hasta', 'texto', 'hasta_texto', 'dias']);
    const texto = JSON.stringify(item);
    for (const nada of ['medica', 'Turno', 'usuario_id', 'vuelve']) assert.ok(!texto.includes(nada), nada);
  });

  it('de un día, sin hasta_texto', () => {
    const item = itemDeAusencia(ausencia({ desde: '2026-11-04', hasta: '2026-11-04' }), NOVIEMBRE);
    assert.equal(item.hasta_texto, '');
    assert.deepEqual(item.dias, ['2026-11-04']);
  });

  it('nada tira', () => {
    for (const entrada of [null, undefined, 42, 'x', []]) {
      assert.deepEqual(itemDeAusencia(entrada, NOVIEMBRE),
        { nombre: '', desde: null, hasta: null, texto: ' no está', hasta_texto: '', dias: [] });
    }
    assert.deepEqual(itemDeAusencia(ausencia({}), null).dias, []);
  });
});

describe('itemsDeFeriados', () => {
  // Las filas de filasDeFeriados (services/feriadosDatos.js)
  const fila = (datos) => ({
    id: 1, fecha: '2026-12-13', nombre: 'Feriado de prueba', tipo: 'municipal', trasladado_de: null, se_repite: 0,
    hasta_anio: null, activo: 1, no_rige: [], ...datos
  });
  const FILAS = [
    // Un domingo: va igual
    fila({ id: 1, fecha: '2026-12-13', nombre: 'Aniversario de prueba' }),
    // Se repite y en 2026 no rige
    fila({ id: 2, fecha: '2025-12-24', nombre: 'Nochebuena de prueba', se_repite: 1, no_rige: [2026] }),
    // El mismo nombre que el fijo, el mismo día: uno solo
    fila({ id: 3, fecha: '2026-12-25', nombre: 'Navidad', tipo: 'nacional' }),
    // Otro nombre el mismo día que un fijo: los dos
    fila({ id: 4, fecha: '2026-12-08', nombre: 'Día de prueba' }),
    fila({ id: 5, fecha: '2026-11-23', nombre: 'Fuera del rango' }),
    fila({ id: 6, fecha: '2026-12-31', nombre: 'Dado de baja', activo: 0 })
  ];
  const feriado = (fecha, nombre) => ({ fecha, nombre, texto: `Feriado: ${nombre}` });

  it('de diciembre a enero: el 08/12, el 25/12 y el 01/01, los de la tabla que rigen y ninguno que no rige', () => {
    assert.deepEqual(itemsDeFeriados(FILAS, '2026-12-01', '2027-01-31'), [
      feriado('2026-12-08', 'Inmaculada Concepción de María'),
      feriado('2026-12-08', 'Día de prueba'),
      feriado('2026-12-13', 'Aniversario de prueba'),
      feriado('2026-12-25', 'Navidad'),
      feriado('2027-01-01', 'Año Nuevo')
    ]);
  });

  it('uno que se repite va los años en que rige; solo los del rango, los dos días incluidos', () => {
    const lista = itemsDeFeriados(FILAS, '2025-12-24', '2026-12-24');
    assert.deepEqual(lista.filter((item) => item.nombre === 'Nochebuena de prueba'),
      [feriado('2025-12-24', 'Nochebuena de prueba')]);
    assert.deepEqual(lista.at(0), feriado('2025-12-24', 'Nochebuena de prueba'));
    assert.deepEqual(lista.at(-1), feriado('2026-12-13', 'Aniversario de prueba'));
    assert.deepEqual(itemsDeFeriados(FILAS, '2026-12-08', '2026-12-08'),
      [feriado('2026-12-08', 'Inmaculada Concepción de María'), feriado('2026-12-08', 'Día de prueba')]);
  });

  it('sin filas, los fijos; nada tira', () => {
    assert.deepEqual(itemsDeFeriados(null, '2026-12-01', '2026-12-31'),
      [feriado('2026-12-08', 'Inmaculada Concepción de María'), feriado('2026-12-25', 'Navidad')]);
    for (const [desde, hasta] of [['abc', '2026-12-31'], ['2026-12-31', '2026-12-01'], [undefined, undefined],
      ['2026-02-30', '2026-03-31']]) {
      assert.deepEqual(itemsDeFeriados(FILAS, desde, hasta), []);
    }
  });
});

describe('eventosDeHoyYManana', () => {
  // Como los da itemDeEvento
  const item = (datos) => ({
    id: 1, titulo: 'Evento', fecha: HOY, desde: '10:00', hasta: null, es_mio: true, compartido: false, quien_texto: 'Solo vos',
    ...datos
  });
  const ITEMS = [
    item({ id: 1, titulo: 'De ayer', fecha: '2026-10-25' }),
    item({ id: 2, titulo: 'Reunión de equipo', fecha: '2026-10-27', compartido: true, quien_texto: 'Con 4 personas' }),
    item({ id: 3, titulo: 'Llamar a Vialidad por el TMDA', desde: '12:00' }),
    item({ id: 4, titulo: 'Entrega del informe trimestral', fecha: '2026-10-28', es_mio: false, compartido: true,
      quien_texto: 'De Martín Ríos' }),
    item({ id: 5, titulo: 'Capacitación', desde: '09:00', es_mio: false, compartido: true, quien_texto: 'De Laura Gómez' }),
    item({ id: 6, titulo: 'Mesa con Catastro', fecha: '2026-10-27', desde: '09:30', compartido: true, quien_texto: 'Con todos' })
  ];

  it('los de hoy y los de mañana, por día y hora, con «Hoy · …» y «Mañana · …»; ni ayer ni pasado mañana', () => {
    const eventos = eventosDeHoyYManana(ITEMS, HOY);
    assert.deepEqual(eventos, [
      {
        id: 5, hora: '09:00', titulo: 'Capacitación', compartido: true, detalle: 'Hoy · de Laura Gómez', dia: 'hoy',
        quien: 'de Laura Gómez'
      },
      {
        id: 3, hora: '12:00', titulo: 'Llamar a Vialidad por el TMDA', compartido: false, detalle: 'Hoy · solo vos', dia: 'hoy',
        quien: 'solo vos'
      },
      {
        id: 6, hora: '09:30', titulo: 'Mesa con Catastro', compartido: true, detalle: 'Mañana · con todos', dia: 'manana',
        quien: 'con todos'
      },
      {
        id: 2, hora: '10:00', titulo: 'Reunión de equipo', compartido: true, detalle: 'Mañana · con 4 personas', dia: 'manana',
        quien: 'con 4 personas'
      }
    ]);
    for (const evento of eventos) {
      assert.deepEqual(Object.keys(evento), ['id', 'hora', 'titulo', 'compartido', 'detalle', 'dia', 'quien']);
    }
  });

  it('nada tira: sin una lista o sin un hoy, ninguno; lo que no es un evento no cuenta', () => {
    for (const items of [null, undefined, 42, 'x', {}]) assert.deepEqual(eventosDeHoyYManana(items, HOY), []);
    for (const hoy of [null, undefined, 'abc', '2026-02-30']) assert.deepEqual(eventosDeHoyYManana(ITEMS, hoy), []);
    assert.deepEqual(eventosDeHoyYManana([null, 'x', 42, [], item({ id: 3, quien_texto: undefined })], HOY),
      [{ id: 3, hora: '10:00', titulo: 'Evento', compartido: false, detalle: 'Hoy', dia: 'hoy', quien: '' }]);
  });

  // Decisión del usuario (27/10/2026; spec 2026-10-27-mi-espacio-resumen, 4.4): los de hoy que ya terminaron no van
  it('con ahora, los de hoy que ya terminaron no van; los de mañana, todos', () => {
    const ids = (lista, ahora) => eventosDeHoyYManana(lista, HOY, ahora).map((evento) => evento.id);
    // A las 10:00, la Capacitación de las 09:00 (sin hora de fin) ya terminó; el llamado de las 12:00 todavía no. Los de
    // mañana van todos, aunque su hora ya haya pasado hoy (la Mesa con Catastro es a las 09:30)
    assert.deepEqual(ids(ITEMS, `${HOY} 10:00:00`), [3, 6, 2]);
    // Con hora de fin: de 09:00 a 10:00 a las 10:00 todavía va, a las 10:01 ya no; de 09:00 a 11:00, sí
    const conFin = [item({ id: 7, desde: '09:00', hasta: '10:00' }), item({ id: 8, desde: '09:00', hasta: '11:00' })];
    assert.deepEqual(ids(conFin, `${HOY} 10:00:00`), [7, 8]);
    assert.deepEqual(ids(conFin, `${HOY} 10:01:00`), [8]);
    // A las 23:59, de hoy ninguno; de mañana, todos
    assert.deepEqual(ids(ITEMS, `${HOY} 23:59:00`), [6, 2]);
    // Una hora de fin que no es una hora cuenta como sin ella (el fin es el inicio); sin ninguna hora, no se sabe si terminó: va
    const raros = [item({ id: 9, desde: '09:00', hasta: '25:00' }), item({ id: 10, desde: 'x', hasta: null })];
    assert.deepEqual(ids(raros, `${HOY} 10:00:00`), [10]);
  });

  it('sin ahora, con uno que no sirve o de otro día, van todos', () => {
    const todos = [5, 3, 6, 2];
    for (const ahora of [undefined, null, 'x', 42, '', `${HOY}`, `${HOY} 25:00:00`, '2026-10-25 10:00:00', '2026-10-27 10:00:00',
      '2026-02-30 10:00:00']) {
      assert.deepEqual(eventosDeHoyYManana(ITEMS, HOY, ahora).map((evento) => evento.id), todos, String(ahora));
    }
    assert.deepEqual(eventosDeHoyYManana(ITEMS, HOY).map((evento) => evento.id), todos);
  });
});
