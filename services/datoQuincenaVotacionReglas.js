/**
 * La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, decisiones y sección 2): las reglas
 * puras del cierre, los votos vigentes, los puntos y el desempate. Sin pool ni Date local: ahora ('AAAA-MM-DD HH:MM:SS', de
 * `ahoraArgentina()`) y el calendario (el de `leerCalendario` o `calendarioCon`) llegan por parámetro, y nadie acá importa los
 * días hábiles fijos. Las horas van en hora argentina; `recibida_at` llega como segundos UNIX (UNIX_TIMESTAMP).
 */
import { sumarDias, formatoCorto } from './notasDigitalesCalendario.js';
import { diaDeLaSemana } from './feriadosReglas.js';
import { horaArgentina, NOMBRE_DEL_BOT, principalDeDatito, principalGuardadaDeDatito } from './datoQuincenaReglas.js';
import { HORA_DE_LA_MANANA } from './datoQuincenaCorreoReglas.js';

export const HORA_DEL_CIERRE = '12:00';
export const HORA_DEL_SELLADO = '14:00';
// Cómo se nombra un voto de una persona cuya cuenta ya no existe
export const NOMBRE_SIN_CUENTA = 'Una persona que ya no está';

export const MENSAJES_VOTACION = Object.freeze({
  noSeVota: 'Esta edición no se vota.',
  noEstas: 'No estás en la lista de quienes votan esta edición.',
  cerro: 'La votación ya cerró.',
  orden: 'Ordená todas las propuestas de la edición.',
  alGuardar: 'No se pudo guardar tu orden. Probá de nuevo en unos minutos.',
  ahoraSeVota: 'La principal del equipo ahora se vota: volvé a cargar la página.'
});

/** 'AAAA-MM-DD HH:MM' en Argentina de unos segundos UNIX, o null si no es un instante. */
export const llegadaDe = (recibida_ts) => {
  if (recibida_ts === null || recibida_ts === undefined) return null;
  const hora = horaArgentina(recibida_ts);
  if (!hora) return null;
  return `${hora.iso.slice(0, 10)} ${hora.hora}`;
};

/**
 * El cierre: el primer día hábil desde el mayor entre la fecha de la edición y el día de la llegada (y si llegó ese día a las
 * 8:05 o después, desde el siguiente), a las 12:00.
 */
export const cierreDeLaVotacion = ({ fecha_edicion, llegada, calendario }) => {
  const dia = llegada.slice(0, 10);
  let desde = fecha_edicion > dia ? fecha_edicion : dia;
  if (desde === dia && llegada.slice(11, 16) >= HORA_DE_LA_MANANA) desde = sumarDias(desde, 1);
  return `${calendario.proximoDiaHabil(desde)} ${HORA_DEL_CIERRE}`;
};

/** Si se puede votar: sellada, cerrada; sin sellar y sin calendario, abierta y sin cierre; si no, hasta el cierre calculado. */
export const estadoDeLaVotacion = ({ cierre_at, fecha_edicion, llegada, ahora, calendario }) => {
  if (cierre_at) return { abierta: false, cierre: String(cierre_at).slice(0, 16), sin_calendario: false };
  if (calendario.error !== null) return { abierta: true, cierre: null, sin_calendario: true };
  const cierre = cierreDeLaVotacion({ fecha_edicion, llegada, calendario });
  return { abierta: ahora.slice(0, 16) < cierre, cierre, sin_calendario: false };
};

/**
 * El estado de una votación tal como la lee `leerVotaciones` (`cierre_at` como texto o null, `fecha_edicion` y `recibida_ts`, los
 * segundos UNIX de la llegada), con `ahora` y el calendario del pedido. Sin una llegada que se pueda leer (solo con un SQL a mano) y
 * sin sellar, el cierre no se sabe: como sin calendario, abierta, sin cierre y sin voto que se guarde.
 */
export const estadoDeLaVotacionLeida = ({ cierre_at, fecha_edicion, recibida_ts }, { ahora, calendario }) => {
  const llegada = llegadaDe(recibida_ts);
  if (!cierre_at && llegada === null) return { abierta: true, cierre: null, sin_calendario: true };
  return estadoDeLaVotacion({ cierre_at, fecha_edicion, llegada, ahora, calendario });
};

// Si la lista es una permutación exacta de `ordenes` (enteros seguros, sin repetir)
const esPermutacion = (lista, ordenes) => Array.isArray(lista)
  && lista.length === ordenes.length
  && lista.every((o) => Number.isSafeInteger(o))
  && new Set(lista).size === lista.length
  && ordenes.every((o) => lista.includes(o));

/** El voto como texto '2,1,4,3', o null si no es una permutación exacta de `ordenes`. */
export const ordenDelVoto = (valor, ordenes) => (esPermutacion(valor, ordenes) ? valor.join(',') : null);

/** El inverso de `ordenDelVoto`: la lista, o null si el texto no es una permutación de `ordenes`. */
export const ordenDeTexto = (texto, ordenes) => {
  if (typeof texto !== 'string' || !/^-?\d+(,-?\d+)*$/.test(texto)) return null;
  const lista = texto.split(',').map(Number);
  return esPermutacion(lista, ordenes) ? lista : null;
};

/** De cada persona, su voto de mayor id anterior al cierre y con un orden válido: Map persona_id -> lista. */
export const votosVigentes = ({ personas, votos, cierre, ordenes }) => {
  const vigentes = new Map();
  for (const { persona_id } of personas) {
    const propios = votos
      .filter((v) => v.persona_id === persona_id && (!cierre || String(v.votado_at).slice(0, 16) < cierre))
      .sort((a, b) => b.id - a.id);
    for (const v of propios) {
      const lista = ordenDeTexto(v.orden, ordenes);
      if (lista) { vigentes.set(persona_id, lista); break; }
    }
  }
  return vigentes;
};

/** Los puntos de cada propuesta (N - puesto + 1), la ganadora y cómo se decidió: 'nadie', 'puntos' o 'desempate'. */
export const resultadoDeLaVotacion = ({ ordenes, deDatito, votos }) => {
  const puntos = new Map(ordenes.map((o) => [o, 0]));
  for (const voto of votos) voto.forEach((o, i) => puntos.set(o, puntos.get(o) + ordenes.length - i));
  if (votos.length === 0) return { orden: deDatito, como: 'nadie', puntos, empatadas: [] };
  const maximo = Math.max(...puntos.values());
  const empatadas = [...puntos].filter(([, p]) => p === maximo).map(([o]) => o).sort((a, b) => a - b);
  if (empatadas.length === 1) return { orden: empatadas[0], como: 'puntos', puntos, empatadas };
  return { orden: empatadas.includes(deDatito) ? deDatito : empatadas[0], como: 'desempate', puntos, empatadas };
};

/** Si ya toca sellar: un día hábil, desde las 14:00 del día del cierre, con el calendario leído. */
export const debeSellar = ({ cierre, ahora, calendario }) => calendario.error === null
  && calendario.esDiaHabil(ahora.slice(0, 10))
  && ahora.slice(0, 16) >= `${cierre.slice(0, 10)} ${HORA_DEL_SELLADO}`;

export const textoDeLosQueVotan = (n) => {
  if (n === 0) return 'No vota nadie.';
  return n === 1 ? 'Vota 1 persona.' : `Votan ${n} personas.`;
};

export const textoDeLasListasGuardadas = ({ reciben, votan }) => {
  const quienReciben = reciben === 0 ? 'no lo recibe nadie' : reciben === 1 ? 'lo recibe 1 persona' : `lo reciben ${reciben} personas`;
  const quienVotan = votan === 0 ? 'no vota nadie' : votan === 1 ? 'vota 1' : `votan ${votan}`;
  return `Guardamos la lista: ${quienReciben} y ${quienVotan}.`;
};

const horaDe = (cierre) => cierre.slice(11, 16);
const diaMes = (cierre) => `${cierre.slice(8, 10)}/${cierre.slice(5, 7)}`;
export const cierreLargo = (cierre) => `el ${diaDeLaSemana(cierre.slice(0, 10))} ${formatoCorto(cierre.slice(0, 10))} a las ${horaDe(cierre)}`;
export const cierreMedio = (cierre) => `el ${diaDeLaSemana(cierre.slice(0, 10))} ${diaMes(cierre)} a las ${horaDe(cierre)}`;
export const cierreCorto = (cierre) => `${diaDeLaSemana(cierre.slice(0, 10)).slice(0, 3)} ${diaMes(cierre)} a las ${horaDe(cierre)}`;

/** El mensaje del PUT del voto (sección 3): hasta cuándo se puede cambiar el orden guardado, o que ya era ese. */
export const mensajeDelVoto = ({ cambio, cierre }) => (cambio
  ? `Guardamos tu orden. Lo podés cambiar hasta ${cierreMedio(cierre)}.`
  : 'Tu orden ya era ese.');

// ---------------------------------------------------------------------------------------------------------------------------
// Los textos de la votación (spec 2026-11-23-dato-quincena-principal-votacion, secciones 3, 5 y 6): los arma el servidor y las
// lecturas los imprimen tal cual (Ruling 19). Los votos crudos pasan siempre por votosVigentes antes de los puntos.
// ---------------------------------------------------------------------------------------------------------------------------

// '1.º', '2.º'…
const puesto = (n) => `${n}.º`;

// «A», «A y B», «A, B y C»
const unir = (nombres) => (nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`);

const nombreDe = (persona) => persona.nombre ?? NOMBRE_SIN_CUENTA;

// «lunes 23/11» de una fecha 'AAAA-MM-DD'
const diaCorto = (fecha) => `${diaDeLaSemana(fecha)} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

// La fila de la foto de quien mira, o null. Sin quien mira (null: el mail del resultado) no es nadie, tampoco una cuenta borrada
// (`usuario_id` null)
const personaDe = (personas, quienMira) => (quienMira === null ? null : personas.find((p) => p.usuario_id === quienMira) ?? null);

/** Cómo se llama la participación (lo mismo para todos): quiénes votaron y quiénes faltan, con los plurales de cada caso. */
const participacionDe = ({ abierta, votaron, faltan }) => {
  const total = votaron.length + faltan.length;
  if (total === 0) return 'No había nadie en la lista para votar.';
  if (abierta) {
    if (votaron.length === 0) return `Todavía no votó nadie de ${total}.`;
    if (faltan.length === 0) return `Ya ${votaron.length === 1 ? 'votó' : 'votaron'} ${votaron.length} de ${total}.`;
    const quienes = `Ya ${votaron.length === 1 ? 'votó' : 'votaron'} ${votaron.length} de ${total}: ${unir(votaron)}.`;
    return faltan.length === 1
      ? `${quienes} Falta el voto de ${faltan[0]}.`
      : `${quienes} Faltan los votos de ${unir(faltan)}.`;
  }
  if (votaron.length === 0) return `No votó nadie de ${total}.`;
  const cuantos = `${votaron.length === 1 ? 'Votó' : 'Votaron'} ${votaron.length} de ${total}`;
  if (faltan.length === 0) return `${cuantos}.`;
  return `${cuantos}: ${faltan.length === 1 ? 'no votó' : 'no votaron'} ${unir(faltan)}.`;
};

const reglaDeLosPuntos = (n) => `Cada puesto da puntos: con ${n} ${n === 1 ? 'propuesta' : 'propuestas'}, el 1.º da ${n} y el último, 1. `
  + `Si empatan, gana la de ${NOMBRE_DEL_BOT}; si no está entre las empatadas, la de número más bajo.`;

// El resultado de una votación cerrada: la ganadora, cómo ganó, su texto, la regla y la tabla de los votos
const resultadoDelDetalle = ({ propuestas, deDatito, personas, vigentes }) => {
  const ordenes = propuestas.map((p) => p.orden);
  const votaron = personas.filter((p) => vigentes.has(p.persona_id));
  const { orden, como, puntos, empatadas } = resultadoDeLaVotacion({ ordenes, deDatito, votos: votaron.map((p) => vigentes.get(p.persona_id)) });
  const ordenadas = [...propuestas].sort((a, b) => puntos.get(b.orden) - puntos.get(a.orden)
    || (a.orden === orden ? -1 : b.orden === orden ? 1 : a.orden - b.orden));
  const maximo = puntos.get(ordenadas[0].orden);
  let texto;
  if (como === 'nadie') texto = `Nadie votó: quedó la de ${NOMBRE_DEL_BOT}.`;
  else if (como === 'puntos') {
    texto = ordenadas.length === 1
      ? `Ganó por puntos: ${maximo}.`
      : `Ganó por puntos: ${maximo}, contra ${puntos.get(ordenadas[1].orden)} de la que siguió.`;
  } else {
    const otras = empatadas.filter((o) => o !== orden).map((o) => `la ${o}`);
    texto = `Ganó por desempate: empató con ${unir(otras)}, con ${maximo} puntos, y `
      + `${orden === deDatito ? `es la de ${NOMBRE_DEL_BOT}.` : 'tiene el número más bajo.'}`;
  }
  return {
    orden,
    como,
    texto,
    regla: reglaDeLosPuntos(propuestas.length),
    tabla: votaron.length === 0 ? null : {
      votantes: votaron.map(nombreDe),
      filas: ordenadas.map((p) => ({
        orden: p.orden,
        texto: `Propuesta ${p.orden} · ${p.titulo}`,
        de_datito: p.orden === deDatito,
        puestos: votaron.map((persona) => puesto(vigentes.get(persona.persona_id).indexOf(p.orden) + 1)),
        puntos: puntos.get(p.orden),
        gana: p.orden === orden
      }))
    }
  };
};

/**
 * La votación en el detalle (sección 3, «El detalle»): `propuestas` `[{ orden, titulo }]` en el orden de la edición, `deDatito` su
 * orden, `estado` el de estadoDeLaVotacion, `personas` `[{ persona_id, usuario_id, nombre }]` en el orden de la foto (`nombre` null si la
 * cuenta se borró), `votos` las filas crudas de dato_quincena_votos y `quienMira` el userId (null: nadie de la foto, como en el mail).
 * Lo de quien mira (`puede_votar`, `falta_tu_voto`, `tu_orden`, `dialogo`) es de cada persona; lo demás, igual para todos.
 */
export const votacionDelDetalle = ({ propuestas, deDatito, estado, personas, votos, quienMira }) => {
  const ordenes = propuestas.map((p) => p.orden);
  const vigentes = votosVigentes({ personas, votos, cierre: estado.cierre, ordenes });
  const yo = personaDe(personas, quienMira);
  const votaron = personas.filter((p) => vigentes.has(p.persona_id)).map(nombreDe);
  const faltan = personas.filter((p) => !vigentes.has(p.persona_id)).map(nombreDe);
  const miOrden = yo === null ? null : vigentes.get(yo.persona_id) ?? null;
  const puedeVotar = estado.abierta && !estado.sin_calendario && yo !== null;
  const tituloDe = (orden) => propuestas.find((p) => p.orden === orden).titulo;
  let cierre;
  if (estado.sin_calendario) cierre = 'No se pudo leer el calendario: el cierre se confirma en unos minutos.';
  else if (estado.abierta) cierre = `Se vota hasta ${cierreLargo(estado.cierre)}.`;
  else cierre = `La votación cerró ${cierreLargo(estado.cierre)}.`;
  let resumen = null;
  if (estado.abierta) resumen = estado.sin_calendario ? 'se está votando.' : `se vota hasta ${cierreMedio(estado.cierre)}.`;
  return {
    estado: estado.abierta ? 'abierta' : 'cerrada',
    resumen,
    cierre,
    participacion: participacionDe({ abierta: estado.abierta, votaron, faltan }),
    puede_votar: puedeVotar,
    falta_tu_voto: puedeVotar && miOrden === null,
    tu_orden: estado.abierta && miOrden !== null
      ? miOrden.map((orden, i) => ({ puesto: puesto(i + 1), orden, texto: `Propuesta ${orden} · ${tituloDe(orden)}` }))
      : null,
    dialogo: puedeVotar
      ? `Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. Lo podés cambiar hasta ${cierreMedio(estado.cierre)}.`
      : null,
    resultado: estado.abierta ? null : resultadoDelDetalle({ propuestas, deDatito, personas, vigentes })
  };
};

/** La votación en la tarjeta de la lista: null si cerró; abierta, hasta cuándo y si le falta votar a quien mira. */
export const votacionDeLaLista = ({ estado, personas, votos, quienMira, ordenes }) => {
  if (!estado.abierta) return null;
  const vigentes = votosVigentes({ personas, votos, cierre: estado.cierre, ordenes });
  const yo = personaDe(personas, quienMira);
  return {
    texto: estado.sin_calendario ? 'Se está votando' : `Se vota hasta el ${cierreCorto(estado.cierre)}`,
    falta_tu_voto: !estado.sin_calendario && yo !== null && !vigentes.has(yo.persona_id)
  };
};

/**
 * La votación del detalle (votacionDelDetalle), de lo leído de leerVotaciones para esa edición (`votacion`, o undefined en una de antes:
 * null), la edición guardada (`edicion`, el JSON: sus propuestas en su orden y la de Datito) y quien mira, con `ahora` y el calendario
 * del pedido. La usan `ver` (datoQuincenaController.js) y el mail del resultado (datoQuincenaVotacion.js): el mail cuenta lo mismo que la
 * página.
 */
export const votacionParaElDetalle = ({ votacion, edicion, quienMira, ahora, calendario }) => {
  if (votacion === undefined || votacion === null) return null;
  return votacionDelDetalle({
    propuestas: edicion.propuestas.map(({ orden, titulo }) => ({ orden, titulo })),
    deDatito: principalDeDatito(edicion.propuestas)?.orden ?? null,
    estado: estadoDeLaVotacionLeida(votacion, { ahora, calendario }),
    personas: votacion.personas,
    votos: votacion.votos,
    quienMira
  });
};

/**
 * Lo que itemDeLaLista lee de la votación (`{ abierta, orden_ganadora, de_la_lista }`), de lo leído de leerVotaciones para esa edición
 * (o null en una de antes: null), sus propuestas guardadas (con `principal`, para la de Datito) y quien mira. Cerrada, la ganadora sale
 * de los votos vigentes, como en el detalle; abierta, no hay ganadora. La usa `listar` (datoQuincenaController.js).
 */
export const votacionParaLaLista = ({ votacion, propuestas, quienMira, ahora, calendario }) => {
  if (votacion === undefined || votacion === null) return null;
  const { personas, votos, ordenes } = votacion;
  const estado = estadoDeLaVotacionLeida(votacion, { ahora, calendario });
  let ordenGanadora = null;
  if (!estado.abierta) {
    const vigentes = votosVigentes({ personas, votos, cierre: estado.cierre, ordenes });
    ordenGanadora = resultadoDeLaVotacion({
      ordenes, deDatito: principalGuardadaDeDatito(propuestas)?.orden ?? null, votos: [...vigentes.values()]
    }).orden;
  }
  return {
    abierta: estado.abierta,
    orden_ganadora: ordenGanadora,
    de_la_lista: votacionDeLaLista({ estado, personas, votos, quienMira, ordenes })
  };
};

/**
 * Lo que la agenda de Mi espacio suma el día del cierre (sección 5): de cada votación abierta y con cierre (`votaciones`, una por
 * edición: `{ edicion_id, fecha_edicion, estado, personas, votos, ordenes }`) en la que `usuarioId` está en la foto y todavía no votó,
 * un ítem con el día del cierre dentro de `desde`–`hasta` ('AAAA-MM-DD'). Sin calendario no hay cierre y no hay ítem.
 */
export const itemsDeLaVotacionEnMiEspacio = ({ votaciones, usuarioId, desde, hasta }) => votaciones.flatMap((v) => {
  if (!v.estado.abierta || v.estado.cierre === null) return [];
  const fecha = v.estado.cierre.slice(0, 10);
  if (fecha < desde || fecha > hasta) return [];
  const yo = personaDe(v.personas, usuarioId);
  if (yo === null) return [];
  const vigentes = votosVigentes({ personas: v.personas, votos: v.votos, cierre: v.estado.cierre, ordenes: v.ordenes });
  if (vigentes.has(yo.persona_id)) return [];
  const hora = horaDe(v.estado.cierre);
  const texto = 'Votá la principal del dato de la quincena';
  const detalle = `Edición del ${diaCorto(v.fecha_edicion)}.`;
  return [{
    fecha,
    hora: `Hasta ${hora}`,
    texto,
    nombre: texto,
    titulo: `${texto}. ${detalle} Cierra a las ${hora}.`,
    detalle,
    enlace: `dato-quincena.html?id=${v.edicion_id}`
  }];
});

/**
 * El modelo del mail del resultado (sección 6) para la plantilla: el asunto (con el año), el título del cuerpo (sin el año, como la
 * maqueta que aprobó el usuario), el saludo con el primer nombre, la ganadora con su título y su cifra clave, y los textos de la
 * `votacion` ya cerrada (`votacionDelDetalle`). `propuestas` trae `cifra_clave`.
 */
export const modeloDelMailDeLaVotacion = ({ edicion, propuestas, deDatito, votacion, nombreCompleto, url }) => {
  if (votacion?.resultado === null || votacion?.resultado === undefined) throw new Error('La votación todavía no cerró.');
  const fecha = `${diaDeLaSemana(edicion.fecha_edicion)} ${formatoCorto(edicion.fecha_edicion)}`;
  const primerNombre = String(nombreCompleto ?? '').trim().split(/\s+/)[0];
  const gano = propuestas.find((p) => p.orden === votacion.resultado.orden);
  return {
    asunto: `La principal del equipo del ${fecha}`,
    titulo: `La principal del equipo del ${diaCorto(edicion.fecha_edicion)}`,
    saludo: primerNombre === '' ? 'Hola:' : `Hola, ${primerNombre}:`,
    edicion: `El dato de la quincena del ${fecha}`,
    intro: `Cerró la votación de El dato de la quincena del ${fecha}. La principal del equipo es esta:`,
    ganadora: { orden: gano.orden, titulo: gano.titulo, cifra_clave: gano.cifra_clave, de_datito: gano.orden === deDatito },
    resultado: votacion.resultado.texto,
    participacion: votacion.participacion,
    cierre: votacion.cierre,
    tabla: votacion.resultado.tabla,
    regla: votacion.resultado.regla,
    boton: { texto: 'Ver la edición en el RPAD', url },
    nota: 'Te llega porque sos de administración del RPAD. Votan las personas con «Vota» tildado en la pestaña Envío y votación.'
  };
};
