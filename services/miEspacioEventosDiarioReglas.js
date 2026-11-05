/**
 * El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 4 y 5), puro: sin pool ni `Date`, con el momento y el
 * calendario por parámetro. El mail sale a las 14:00 de un día hábil y, a los superiores de quien cargó algo después, a las 8:05 del
 * día del evento. En el código no se llama «agenda» a secas: es otra cosa que la Agenda de pedidos de Reportes.
 */
import { esFechaIso } from './notasDigitalesCalendario.js';
import { diaLargo } from './miEspacioResumen.js';
import { listaConY } from './miEspacioEventosReglas.js';
import { nombreCorto } from './miEspacioReglas.js';
import { superioresDe } from './usuariosReglas.js';

export const HORA_DE_LA_TARDE = '14:00';
export const HORA_DE_LA_MANANA = '08:05';
export const MENSAJE_EVENTOS_POR_MAIL = 'Elegí si querés recibir tu agenda por mail.';

const noLlega = (motivo) => ({ llega: false, motivo });

/**
 * Cuándo se entera un superior de un Público con esa fecha, cargado ahora (spec, 2.3 y 5.4): `{ llega: true, cuando }` o
 * `{ llega: false, motivo }`. `ahora`, 'AAAA-MM-DD HH:MM[:SS]' de Argentina. Sin una fecha, el genérico. Lo que se carga para el mismo
 * día no pasa por la agenda; un sábado o un feriado, solo si todavía no salió el aviso que lo cubre; y uno que empieza antes de las 8:05
 * del día, después de las 14:00 del anterior, no llega a tiempo. Hoy puede no ser hábil (un sábado, para el lunes): el día hábil anterior
 * queda antes de hoy y sale a las 8:05.
 */
export const cuandoLlegaElAviso = ({ fecha, desde = null, ahora, calendario }) => {
  if (!esFechaIso(fecha)) return { llega: true, cuando: 'el día hábil anterior a las 14:00' };
  const hoy = ahora.slice(0, 10);
  if (fecha === hoy) return noLlega('como es para hoy');
  if (fecha < hoy) return noLlega('como ya pasó');
  const anterior = calendario.diaHabilAnterior(fecha);
  if (anterior > hoy) return { llega: true, cuando: `el ${diaLargo(anterior)} a las 14:00` };
  if (anterior === hoy && ahora.slice(11, 16) < HORA_DE_LA_TARDE) return { llega: true, cuando: 'hoy a las 14:00' };
  if (!calendario.esDiaHabil(fecha)) return noLlega('como ya salió el aviso de ese día');
  if (typeof desde === 'string' && desde <= HORA_DE_LA_MANANA) return noLlega('como empieza antes de las 8:05');
  return { llega: true, cuando: `el ${diaLargo(fecha)} a las 8:05` };
};

/**
 * Lo que dice el formulario debajo de quienes reciben el mail, en singular o en plural: «De quienes dependés: les llega la notificación
 * por mail el jueves 05/11 a las 14:00.» o «De quien dependés: como es para hoy, no le llega ningún mail.». Sin nadie, ''.
 */
export const fraseDelAviso = (aviso, cantidad) => {
  if (!Number.isInteger(cantidad) || cantidad < 1) return '';
  const uno = cantidad === 1;
  const quienes = uno ? 'De quien dependés' : 'De quienes dependés';
  return aviso.llega
    ? `${quienes}: ${uno ? 'le llega' : 'les llega'} la notificación por mail ${aviso.cuando}.`
    : `${quienes}: ${aviso.motivo}, ${uno ? 'no le llega' : 'no les llega'} ningún mail.`;
};

/**
 * Los nombres cortos de las personas activas de las que depende alguien, de la más cercana a la más lejana, contra todos los usuarios
 * activos. `usuarios`: las filas de `usuariosDelAviso`.
 */
export const superioresConNombre = (id, usuarios) => {
  const activos = usuarios.filter((fila) => fila.activo).map((fila) => ({ id: fila.id, nombre: fila.nombre_completo }));
  return superioresDe(id, usuarios).map((fila) => ({ id: fila.id, nombre_corto: nombreCorto({ id: fila.id, nombre: fila.nombre_completo }, activos) }));
};

/**
 * El aviso de un guardado (spec, 2.5): «Evento guardado. Solo vos lo ves.», «Evento guardado. Lo ven Lucía y Tomás como «…» en su agenda, y
 * a Federico y Graciela les llega antes del evento.» o «Evento guardado. Con Federico.». `verbo`: 'guardado' o 'cambiado'; `quienTexto`,
 * el de itemDeEvento; `superiores`, los nombres cortos, y `aviso`, el de cuandoLlegaElAviso: sin nadie, o si no llega, no se nombra a nadie.
 */
export const mensajeDelGuardado = ({ tipo, verbo, quienTexto, superiores = [], aviso = null }) => {
  const inicio = `Evento ${verbo}.`;
  if (tipo === 'privado') return `${inicio} Solo vos lo ves.`;
  // El punto de una inicial («Con Test e.») ya cierra la oración
  if (tipo !== 'publico') return `${inicio} ${quienTexto}${quienTexto.endsWith('.') ? '' : '.'}`;
  if (superiores.length === 0 || aviso?.llega !== true) return `${inicio} ${quienTexto} en su agenda.`;
  return `${inicio} ${quienTexto} en su agenda, y a ${listaConY(superiores)} ${superiores.length === 1 ? 'le llega' : 'les llega'} antes del evento.`;
};

// El aviso de la casilla «Recibir mi agenda por mail» (spec, 2.7), con la segunda oración solo si alguien depende de esa persona
export const mensajeDeLaCasilla = ({ recibir, alguienDepende }) => {
  if (recibir) return 'Te va a llegar tu agenda por mail.';
  return alguienDepende
    ? 'Ya no te llega tu agenda por mail. Lo de quienes dependen de vos te llega igual.'
    : 'Ya no te llega tu agenda por mail.';
};
