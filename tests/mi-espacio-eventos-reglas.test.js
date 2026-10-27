// La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, secciones 1, 5 y 7): la validación de un evento, el momento
// en que sale su recordatorio con los feriados (nunca en un día que no es hábil) y los textos de cuándo es y cuándo sale.
// Puras, sin base. Hoy es el lunes 26/10/2026.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDATORIOS, RECORDATORIO_POR_DEFECTO, TEXTO_RECORDATORIO, AVISO_CORTO, LARGO_TITULO_EVENTO, LARGO_DETALLE_EVENTO,
  FECHA_MINIMA_EVENTO, ROLES_QUE_COMPARTEN, DIAS_DE_PROXIMOS, VENTANA_DE_LA_CORRIDA, MINUTOS_SIN_CORRER, BLOQUEO_EVENTOS,
  MINUTOS_A_TIEMPO, HORA_DE_LOS_ATRASADOS, HORA_DE_CIERRE_DE_LOS_ATRASADOS, MENSAJES_EVENTO,
  fechaMaximaEvento, textoRangoEvento, validarEvento, momentoDelAviso, textoDelAviso, cuandoDelEvento,
  cuandoCortoDelEvento, cuandoEsElEvento, cuandoFue, textoDelEvento, listaConY, inicialesDe
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
