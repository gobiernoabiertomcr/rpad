/**
 * El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 4 y 5), puro: sin pool ni `Date`, con el momento y el
 * calendario por parámetro. El mail sale a las 14:00 de un día hábil y, a los superiores de quien cargó algo después, a las 8:05 del
 * día del evento. En el código no se llama «agenda» a secas: es otra cosa que la Agenda de pedidos de Reportes.
 */
import { esFechaIso, sumarDias } from './notasDigitalesCalendario.js';
import { diaLargo } from './miEspacioResumen.js';
import { cuandoFue, itemDeEvento, listaConY } from './miEspacioEventosReglas.js';
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

/**
 * Los días que cubre el mail de las 14:00 (spec, 5.3): de mañana al próximo día hábil inclusive, cada uno. Un viernes trae el sábado, el
 * domingo y el lunes; antes de un feriado, también ese feriado.
 */
export const diasDelAviso = (hoy, calendario) => {
  const hasta = calendario.proximoDiaHabil(sumarDias(hoy, 1));
  const dias = [];
  for (let dia = sumarDias(hoy, 1); dia <= hasta; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
};

// La clave de lo que ya se le informó a una persona de un evento para una fecha
export const claveDeInformado = (eventoId, usuarioId, fecha) => `${eventoId}|${usuarioId}|${fecha}`;

// Un Público se distingue antes que nada, aunque los datos vinieran mal (con `compartido` también)
const esPublico = (evento) => evento.publico === true;
const conMinuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

// Lo que dice debajo de un evento propio: de quién es o quién lo ve, con el texto del servidor (itemDeEvento, que es una sola fuente)
const marcaDe = (evento, contexto) => {
  const { quien_texto: quien } = itemDeEvento(evento, contexto);
  if (esPublico(evento)) return quien;
  return evento.compartido === true ? `Laboral, ${conMinuscula(quien)}` : 'Solo vos lo ves';
};

/**
 * Lo que recibe una persona en un aviso (spec 2026-11-04-agenda-aviso-y-dependencia, 5.2 a 5.4), o null si no le toca ningún mail.
 * `persona` y `usuarios` son las filas de `usuariosDelAviso`; `eventos`, los de `eventosDelAviso`, de hoy a la última fecha del aviso, por
 * fecha y hora; `informados`, un Set de `claveDeInformado`; `momento`, 'tarde' (14:00) o 'manana' (8:05); `ahora`, 'AAAA-MM-DD HH:MM[:SS]'.
 * Devuelve `{ propios, gente, informa, dias, soloHoy }`:
 * - `propios`, solo con la casilla: los que creó, de los tres tipos, y los Laborales de otra persona en los que está (haber apagado su
 *   recordatorio no los saca), `{ fecha, desde, titulo, detalle, marca }`;
 * - `gente`, siempre: los Públicos de quien tiene a esta persona en su cadena, sean o no de los que marcó, `{ fecha, desde, hasta, texto,
 *   nuevo }`. De un Público de otra persona, **ni el título ni el detalle: acá no se leen**, y por eso los Públicos ajenos se separan
 *   antes de hacer nada más con el evento. Uno que no es de su gente no entra, aunque se lo muestren: a quien solo fue elegida no le llega
 *   nada;
 * - `informa`: lo que queda informado si el mail sale, `{ evento_id, fecha }`.
 * A las 14:00 trae los días de `diasDelAviso` y, a un superior, los rezagados de hoy. A las 8:05, solo si tiene un rezagado: entonces trae
 * todo hoy, con `nuevo` en lo sin informar. Un rezagado es un Público de su gente, de hoy, sin informar, publicado antes de hoy (o sin dato:
 * los de antes de esta entrega) y que no empezó: lo que se carga y se realiza en el mismo día no pasa por la agenda.
 */
export const mailDeLaPersona = ({ persona, eventos, informados, momento, ahora, calendario, usuarios }) => {
  const hoy = ahora.slice(0, 10);
  const hora = ahora.slice(11, 16);
  const activos = usuarios.filter((fila) => fila.activo).map((fila) => ({ id: fila.id, nombre: fila.nombre_completo }));
  const contexto = { usuarioId: persona.id, ahora, feriados: new Set(), usuarios: activos };
  const dias = momento === 'tarde' ? diasDelAviso(hoy, calendario) : [hoy];
  const enLosDias = new Set(dias);
  const sinInformar = (evento) => !informados.has(claveDeInformado(evento.id, persona.id, evento.fecha));

  const gente = [];
  const propios = [];
  const rezagados = [];
  for (const evento of eventos) {
    if (esPublico(evento) && evento.creado_por !== persona.id) {
      if (!evento.creador_activo || !superioresDe(evento.creado_por, usuarios).some((fila) => fila.id === persona.id)) continue;
      const rezagado = evento.fecha === hoy && sinInformar(evento) && evento.desde > hora
        && (evento.publicado_at === null || evento.publicado_at.slice(0, 10) < hoy);
      const item = {
        evento_id: evento.id, fecha: evento.fecha, desde: evento.desde, hasta: evento.hasta,
        texto: `${nombreCorto({ id: evento.creado_por, nombre: evento.creador }, activos)}: ${evento.texto_publico}`,
        nuevo: momento === 'tarde' ? rezagado : sinInformar(evento)
      };
      if (rezagado) rezagados.push(item);
      if (rezagado || enLosDias.has(evento.fecha)) gente.push(item);
      continue;
    }
    if (!persona.eventos_por_mail || !enLosDias.has(evento.fecha)) continue;
    const esSuyo = evento.creado_por === persona.id;
    const estaEnElLaboral = evento.compartido === true
      && (evento.para_todos === true || evento.personas.some((fila) => fila.id === persona.id));
    if (!esSuyo && !estaEnElLaboral) continue;
    propios.push({
      evento_id: evento.id, fecha: evento.fecha, desde: evento.desde, hasta: evento.hasta, titulo: evento.titulo, detalle: evento.detalle,
      marca: marcaDe(evento, contexto)
    });
  }

  if (momento === 'manana' && rezagados.length === 0) return null;
  if (propios.length === 0 && gente.length === 0) return null;
  return {
    propios, gente, dias,
    soloHoy: momento === 'manana' || (propios.length === 0 && gente.every((item) => item.fecha === hoy)),
    informa: gente.map((item) => ({ evento_id: item.evento_id, fecha: item.fecha }))
  };
};

// El resultado de una corrida, para Correos → Estado: «Enviados: 3.», «Día no hábil: no se manda.», con « Fallidos: 1.» y « Errores: …»
const LARGO_DEL_RESULTADO = 1000;
export const textoDelResultadoDelDiario = ({ dia_habil: diaHabil, enviados = 0, fallidos = 0, errores = [] }) => {
  const partes = [diaHabil === false ? 'Día no hábil: no se manda.' : `Enviados: ${enviados}.`];
  if (fallidos > 0) partes.push(`Fallidos: ${fallidos}.`);
  if (errores.length > 0) {
    partes.push(`Errores: ${errores.map(({ usuario_id: id, error }) => (id ? `persona ${id}: ${error}` : error)).join('; ')}`);
  }
  return partes.join(' ').slice(0, LARGO_DEL_RESULTADO);
};

// La línea de Correos → Estado (spec, 6). `corrida`: la de `leerCorridaDelDiario`, o null
export const textoDeLaCorridaDelDiario = (corrida, ahora) => {
  if (corrida === null || corrida === undefined) return 'Aviso diario de la agenda: sin registro todavía.';
  const cuando = cuandoFue(corrida.inicio, ahora);
  if (corrida.en_curso === true) return `Aviso diario de la agenda: corrida en curso, desde ${cuando}.`;
  const linea = `Aviso diario de la agenda: última corrida ${cuando}.`;
  return typeof corrida.resultado === 'string' && corrida.resultado !== '' ? `${linea} ${corrida.resultado}` : linea;
};

// La alerta de Correos → Estado, si la última corrida terminó con errores
export const alertasDeLaCorridaDelDiario = (corrida, ahora) => (corrida?.con_errores === true ? [{
  tipo: 'diario-con-errores', nivel: 'error',
  mensaje: `La última corrida del aviso diario de la agenda (${cuandoFue(corrida.inicio, ahora)}) terminó con errores: ${corrida.resultado ?? 'sin detalle'}`
}] : []);

export const alertaSinEstadoDelDiario = () => ({
  tipo: 'diario-sin-estado', nivel: 'advertencia', mensaje: 'No se pudo leer la última corrida del aviso diario de la agenda.'
});
