/**
 * El correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 5, 6, 8, 10 y 13): el paso de las corridas de las
 * 8:05 y de las 14:00, sin Tarea Cron propia, y lo que muestra Correos → Estado.
 * - Con su propio candado (`rpad_dato_quincena_correo`), ni el de las Notas ni el del aviso diario: con otra corrida en marcha,
 *   termina «ocupada» sin escribir nada, y no es un error.
 * - Las programadas sin filas van a `decidirCorrida`: apagado, todas quedan no enviadas (también un día no hábil); un día hábil
 *   con el envío prendido, sale la más nueva y las demás quedan «mas_nueva» o «vieja». Sin poder leer los feriados
 *   (`calendario.error`), no sale nada: lo que espera sale en la corrida siguiente.
 * - La que sale arma una fila por persona con la lista de ese momento (envioInicial). Después, en esa y en toda edición vigente
 *   con personas pendientes o en reintento (un día hábil y con el envío prendido), cada persona se mira con lo de ese momento (de
 *   licencia, inactiva o sin email válido no recibe y no gasta un intento; Ruling 10), se reserva y se le manda. Una edición que
 *   dejó de estar vigente con personas abiertas ya no les manda: cierra (Ruling 9), cualquier día.
 * - Nunca dos veces, a lo sumo una: cada mail se reserva con un UPDATE condicionado (pendiente o fallida, con intentos por
 *   delante) y se manda solo si la reserva es de esta corrida. Una reserva sin terminar (un corte, un transporte que tira) no se
 *   repite: pudo haber salido.
 * - Un mail por persona, siempre con `to: [email]` y `from: remitente()`: sin destinatario, sendEmail manda a las casillas por
 *   defecto de la DGMIT. El texto del transporte no va a la base, al resultado ni a la consola: puede traer la dirección.
 * - `correoDelDatoQuincenaAislado` **nunca rechaza**. Anota cada corrida en la fila 1 de dato_quincena_correo_config.
 * «Reenviar» y «Enviarme una prueba» (spec, 9), de administración, van con el mismo candado (si una corrida está mandando,
 * «ocupado») y el mismo mail: salen en el momento, cualquier día y con el envío como esté, a lo sumo una vez cada uno (su fila
 * se anota «enviando» antes de mandarlo). Un reenvío solo de una regular cuyo envío automático terminó (sePuedeReenviar, mirado
 * con el candado tomado: nunca se cruza con la corrida) y a personas de la lista de hoy; después, el estado de la edición se
 * recalcula como en la corrida. Una prueba no cuenta para nada.
 * Los momentos se escriben con `ahoraArgentina()`, nunca NOW() de la base.
 */
import { conBloqueo } from './notasDigitales.js';
import { sendEmail, remitente } from './emailService.js';
import { datoQuincenaTemplate, CID_INFOGRAFIA } from './emailTemplates.js';
import { emailValido } from './usuariosReglas.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';
import { deLicenciaOficial } from './miEspacioEventosDiarioDatos.js';
import { leerEdicion, leerArchivo, edicionesPreviasSinFallar } from './datoQuincenaDatos.js';
import { detalleDeLaEdicion, fechasPrevias } from './datoQuincenaReglas.js';
import {
  MENSAJES_CORREO, decidirCorrida, envioInicial, estaVigente, estadoDeLaEdicion, modeloDelMail, textoDelResultadoDelCorreo,
  textoDeLaCorridaDelCorreo, alertasDelCorreo, personasSinLlegar, sePuedeReenviar
} from './datoQuincenaCorreoReglas.js';
import {
  leerConfig, correoDe, enviosDe, programadasSinEnvios, marcarNoEnviada, armarElEnvio, edicionesConEnviosAbiertos,
  personasPorMandar, reservarEnvio, terminarEnvio, apartarEnvio, guardarElEstado, anotarInicioDeLaCorrida, anotarFinDeLaCorrida,
  leerLaCorrida, ultimaEdicionQueSalio, listaDeHoy, contactosDe, anotarEnvioAMano
} from './datoQuincenaCorreoDatos.js';

export const BLOQUEO_DATO_QUINCENA = 'rpad_dato_quincena_correo';

// Los textos fijos de lo que falla en una corrida: van al resultado (y de ahí a la respuesta de la corrida) y a lo anotado
const MENSAJE_SIN_FERIADOS = 'No se pudieron leer los feriados: el dato de la quincena no salió y sale en la corrida siguiente.';
const MENSAJE_EN_LA_CORRIDA = 'No se pudo completar el envío del dato de la quincena.';
const MENSAJE_SIN_PREPARAR_LA_EDICION = 'No se pudo preparar el mail de una edición.';
const MENSAJE_SIN_PREPARAR = 'No se pudo preparar el mail.';
const MENSAJE_SIN_CONFIRMAR = 'No se pudo confirmar si el mail salió.';
const MENSAJE_SIN_ANOTAR = 'El mail salió, pero no se pudo anotar.';

const sinNada = () => ({ ocupada: false, edicion: null, enviados: 0, fallidos: 0, licencia: 0, omitidos: 0, errores: [] });

// En la consola, solo el código y el mensaje: los errores de mysql2 traen la consulta armada con sus valores
const aLaConsola = (texto, error) => console.error(texto, error?.code ?? '', error?.message ?? error);

// Una falla de la corrida, que no es un envío que se reintenta: al resultado (con su persona, si es de una) y a lo anotado, que
// la muestra como corrida con errores en Correos → Estado
const problema = (resultado, nota, mensaje, usuarioId = null) => {
  resultado.errores.push({ usuario_id: usuarioId, error: mensaje });
  nota.problemas.push(mensaje);
};

/**
 * Lo que hace falta para el mail de una edición, una vez por corrida: la fecha, el detalle (el mismo de la página, sin la línea
 * del correo, con el enlace de cada repetición: spec 2026-11-14-dato-quincena-v1-3, 3) y los adjuntos con sus bytes y los
 * nombres del manifiesto: la infografía PNG en línea (con su cid) y como archivo, y el SVG si llegó. `conSvg` le dice a la
 * plantilla qué promete el pie de la infografía. Si las ediciones previas no se pueden leer, el mail sale igual, sin el enlace.
 */
const prepararLaEdicion = async (edicionId) => {
  const leida = await leerEdicion(edicionId);
  if (leida === null) throw new Error('La edición no existe');
  const edicion = JSON.parse(leida.fila.metadata);
  const previas = await edicionesPreviasSinFallar(fechasPrevias(edicion));
  const detalle = detalleDeLaEdicion({ ...leida, edicion, previas });
  const [png, svg] = await Promise.all([leerArchivo(edicionId, 'infografia_png'), leerArchivo(edicionId, 'infografia_svg')]);
  if (png.archivo == null) throw new Error('La edición no tiene la infografía');
  const { nombre, contenido } = png.archivo;
  const adjuntos = [
    { filename: nombre, content: contenido, contentType: 'image/png', cid: CID_INFOGRAFIA },
    { filename: nombre, content: contenido, contentType: 'image/png' }
  ];
  if (svg.archivo != null) {
    adjuntos.push({ filename: svg.archivo.nombre, content: svg.archivo.contenido, contentType: 'image/svg+xml' });
  }
  return { fecha_edicion: leida.fila.fecha_edicion, detalle, adjuntos, conSvg: svg.archivo != null };
};

// El mail de una persona, el mismo en la corrida, en un reenvío y en una prueba (con «[PRUEBA] » en el asunto): con su nombre
// de hoy y el pie de la infografía que promete el SVG solo si va adjunto
const mailPara = (edicion, nombreCompleto, { prueba = false } = {}) => datoQuincenaTemplate(
  modeloDelMail({ detalle: edicion.detalle, fecha_edicion: edicion.fecha_edicion, nombreCompleto, prueba }),
  { conSvg: edicion.conSvg }
);

// Un mail a una sola casilla: siempre con `to` (sin destinatario, sendEmail manda a las casillas de la DGMIT) y el remitente
const mandarElMail = (enviar, edicion, mail, email) => enviar({
  subject: mail.subject, html: mail.html, text: mail.text, to: [email], from: remitente(), attachments: edicion.adjuntos
});

/**
 * Manda la edición a cada persona que todavía la espera, con lo de ese momento (spec, 5; Review Focus 3): quien hoy está de
 * licencia oficial, inactiva o sin un email válido queda así, sin gastar un intento; a las demás se las reserva y se les manda,
 * con su nombre de hoy, a su email de hoy. Cada persona va aislada: una que falla no frena a las demás.
 */
const mandarLaEdicion = async (edicionId, { ahora, licencias, enviar }, resultado, nota) => {
  const personas = await personasPorMandar(edicionId);
  if (personas.length === 0) return;
  let edicion;
  try {
    edicion = await prepararLaEdicion(edicionId);
  } catch (error) {
    // Nadie se reservó: sale en la corrida siguiente, sin gastar intentos
    aLaConsola(`Dato de la quincena: no se pudo preparar el mail de la edición ${edicionId}:`, error);
    problema(resultado, nota, MENSAJE_SIN_PREPARAR_LA_EDICION);
    return;
  }
  for (const persona of personas) {
    const hoyRecibe = envioInicial({
      activa: persona.activa, emailValido: emailValido(persona.email), deLicencia: licencias.has(persona.usuario_id)
    });
    if (hoyRecibe.estado !== 'pendiente') {
      if (await apartarEnvio(persona.id, hoyRecibe)) resultado[hoyRecibe.estado === 'licencia' ? 'licencia' : 'omitidos'] += 1;
      continue;
    }
    let mail;
    try {
      mail = mailPara(edicion, persona.nombre_completo);
    } catch (error) {
      aLaConsola(`Dato de la quincena: no se pudo armar el mail (edición ${edicionId}, persona ${persona.usuario_id}):`, error);
      problema(resultado, nota, MENSAJE_SIN_PREPARAR, persona.usuario_id);
      continue;
    }
    // La tomó otra corrida, o ya no se le puede mandar
    if (!(await reservarEnvio(persona.id, persona.email, ahora))) continue;

    let envio;
    try {
      envio = await mandarElMail(enviar, edicion, mail, persona.email);
    } catch (error) {
      // No se sabe si salió: queda reservada («Sin confirmar») y no se reintenta
      console.error(`Dato de la quincena: no se sabe si salió el mail (edición ${edicionId}, persona ${persona.usuario_id}).`,
        error?.code ?? '');
      problema(resultado, nota, MENSAJE_SIN_CONFIRMAR, persona.usuario_id);
      continue;
    }
    const salio = envio?.success === true;
    if (salio) resultado.enviados += 1;
    else {
      console.error(`Dato de la quincena: no se pudo enviar el mail (edición ${edicionId}, persona ${persona.usuario_id}).`);
      resultado.fallidos += 1;
      resultado.errores.push({ usuario_id: persona.usuario_id, error: MENSAJES_CORREO.envioFallido });
    }
    try {
      // La hora real del envío (spec, 5), no la del comienzo de la corrida
      await terminarEnvio(persona.id, { enviado: salio, ahora: ahoraArgentina(), error: MENSAJES_CORREO.envioFallido });
    } catch (error) {
      // Queda reservada y sin terminar: no se repite (pudo haber salido)
      aLaConsola(`Dato de la quincena: no se pudo anotar el mail (edición ${edicionId}, persona ${persona.usuario_id}):`, error);
      problema(resultado, nota, salio ? MENSAJE_SIN_ANOTAR : MENSAJE_SIN_CONFIRMAR, persona.usuario_id);
    }
  }
};

// El estado de la edición después de la corrida o de un reenvío: el de sus filas (con los reenvíos que le llegaron a alguien) o,
// mientras sigue saliendo, programada; y la hora del primer envío que salió. `vigente` en false la cierra (Ruling 9). `ahora`,
// la hora de la corrida; un reenvío pasa null y la de la última corrida no cambia
export const recalcular = async (edicionId, ahora, vigente = true) => {
  const filas = await enviosDe(edicionId);
  await guardarElEstado(edicionId, estadoDeLaEdicion(filas, filas, { vigente }) ?? 'programada', ahora);
};

// Lo de la corrida con el candado tomado. `nota` junta lo que se anota: por qué no salió nada y lo que falló en la corrida
const correr = async ({ hoy, ahora, calendario, enviar }, resultado, nota) => {
  const { envioActivo } = await leerConfig();
  const programadas = await programadasSinEnvios();
  const { mandar, noEnviar } = decidirCorrida({ programadas, envioActivo, hoy, calendario });
  for (const { id, motivo } of noEnviar) await marcarNoEnviada(id, motivo, ahora);
  // Ruling 9: las que dejaron de estar vigentes con personas abiertas ya no salen; se cierran una vez (siguen «programada» hasta
  // acá), cualquier día y con el envío como esté. Sus filas no cambian: lo que se muestra las lee cerradas por la fecha
  const abiertas = await edicionesConEnviosAbiertos();
  for (const { id } of abiertas.filter((una) => una.estado === 'programada' && !estaVigente(una.fecha_edicion, hoy))) {
    await recalcular(id, ahora, false);
  }
  if (envioActivo !== true) {
    nota.motivo = 'apagado';
    return;
  }
  if (calendario.error !== null) {
    nota.motivo = 'sin_feriados';
    resultado.errores.push({ usuario_id: null, error: MENSAJE_SIN_FERIADOS });
    return;
  }
  if (!calendario.esDiaHabil(hoy)) {
    nota.motivo = 'no_habil';
    return;
  }

  const licencias = await deLicenciaOficial(hoy);
  if (mandar !== null) {
    resultado.edicion = mandar;
    const decidir = ({ usuario_id, email, activa }) => envioInicial({
      activa, emailValido: emailValido(email), deLicencia: licencias.has(usuario_id)
    });
    const armado = await armarElEnvio(mandar, { ahora, decidir });
    if (armado === 'sin_lista') nota.motivo = 'sin_lista';
    if (armado === 'armada') {
      const filas = await enviosDe(mandar);
      resultado.licencia += filas.filter((fila) => fila.estado === 'licencia').length;
      resultado.omitidos += filas.filter((fila) => fila.estado === 'omitido').length;
      await recalcular(mandar, ahora);
    }
  }
  // Las vigentes con personas abiertas: la que se acaba de armar y las que siguen con reintentos
  for (const { id } of (await edicionesConEnviosAbiertos()).filter((una) => estaVigente(una.fecha_edicion, hoy))) {
    await mandarLaEdicion(id, { ahora, licencias, enviar }, resultado, nota);
    await recalcular(id, ahora);
  }
};

const anotarInicio = async (ahora) => {
  try {
    await anotarInicioDeLaCorrida(ahora);
  } catch (error) {
    aLaConsola('No se pudo anotar el inicio de la corrida del dato de la quincena:', error);
  }
};

const anotarFin = async (inicio, resultado, nota) => {
  try {
    await anotarFinDeLaCorrida(inicio, {
      fin: ahoraArgentina(),
      resultado: textoDelResultadoDelCorreo({
        motivo: nota.motivo, enviados: resultado.enviados, fallidos: resultado.fallidos, problemas: nota.problemas
      }),
      // Un envío que falló no es un error de la corrida: se reintenta, y el aviso de esa persona llega después del tercer intento
      conErrores: nota.motivo === 'sin_feriados' || nota.problemas.length > 0
    });
  } catch (error) {
    aLaConsola('No se pudo anotar el fin de la corrida del dato de la quincena:', error);
  }
};

/**
 * Una corrida del correo del dato de la quincena, el día `hoy` ('AAAA-MM-DD') en el momento `ahora` ('AAAA-MM-DD HH:MM:SS' de
 * Argentina), con el `calendario` de la corrida que la llama (una sola lectura de la tabla). `enviar`: sendEmail (los tests le
 * pasan uno que falla). Devuelve `{ ocupada, edicion, enviados, fallidos, licencia, omitidos, errores }`, con `errores`
 * `[{ usuario_id, error }]` (textos fijos) y `edicion` la que empezó a salir en esta corrida, o null. `licencia` y `omitidos`
 * cuentan las personas que en esta corrida quedaron así. Tira solo si no se puede tomar el candado: por eso se llama con
 * `correoDelDatoQuincenaAislado`.
 */
export const ejecutarCorreoDelDatoQuincena = async ({
  ahora = ahoraArgentina(), hoy = ahora.slice(0, 10), calendario, enviar = sendEmail
}) => {
  const corrida = await conBloqueo(async () => {
    const resultado = sinNada();
    const nota = { motivo: null, problemas: [] };
    await anotarInicio(ahora);
    try {
      await correr({ hoy, ahora, calendario, enviar }, resultado, nota);
    } catch (error) {
      aLaConsola('Error en el correo del dato de la quincena:', error);
      problema(resultado, nota, MENSAJE_EN_LA_CORRIDA);
    }
    await anotarFin(ahora, resultado, nota);
    return resultado;
  }, BLOQUEO_DATO_QUINCENA);
  return corrida.ocupado ? { ...sinNada(), ocupada: true } : corrida.resultado;
};

/** Lo mismo, en el momento de la llamada (o `ahora`), pero nunca rechaza: lo que falle va a `errores`, con un texto fijo. */
export const correoDelDatoQuincenaAislado = async (calendario, { ahora = ahoraArgentina() } = {}) => {
  try {
    return await ejecutarCorreoDelDatoQuincena({ ahora, calendario });
  } catch (error) {
    aLaConsola('Error en el correo del dato de la quincena:', error);
    return { ...sinNada(), errores: [{ usuario_id: null, error: MENSAJE_EN_LA_CORRIDA }] };
  }
};

/**
 * Lo que muestra Correos → Estado (spec, 13), en el momento `ahora`: `{ texto, alertas }`, la línea de la última corrida y sus
 * avisos (una corrida con errores y la última edición que salió sola que no le llegó a alguien: después de los 3 intentos o,
 * si ya no está vigente, con los que tuvo). Tira si la base falla: el controlador de Correos lo convierte en una advertencia.
 */
export const estadoDelCorreoDelDatoQuincena = async ({ ahora = ahoraArgentina() } = {}) => {
  const [corrida, ultima] = await Promise.all([leerLaCorrida(BLOQUEO_DATO_QUINCENA), ultimaEdicionQueSalio()]);
  const sinLlegar = ultima === null ? null : {
    fecha_edicion: ultima.fecha_edicion,
    personas: personasSinLlegar({
      fecha_edicion: ultima.fecha_edicion, envios: await enviosDe(ultima.id), hoy: ahora.slice(0, 10)
    })
  };
  return { texto: textoDeLaCorridaDelCorreo(corrida), alertas: alertasDelCorreo({ corrida, sinLlegar }) };
};

// «Reenviar» y «Enviarme una prueba» (spec, 9)

/**
 * Manda a mano el mail de una edición a una persona (`{ usuario_id, nombre_completo, email }`, con lo de hoy), como reenvío o
 * prueba (`tipo`): su fila se anota antes de mandarlo, «enviando», y después queda enviada o fallida (el texto fijo, nunca el del
 * transporte); sin un email válido, «omitido» y no sale. Si no se sabe qué pasó (un transporte que tira), queda sin confirmar.
 * Resuelve true solo si salió. No tira por el mail: sí si no se puede anotar antes de mandarlo (entonces no sale).
 */
const mandarAMano = async (edicionId, edicion, persona, { tipo, creadoPor, ahora, enviar }) => {
  const fila = { edicionId, usuarioId: persona.usuario_id, email: persona.email ?? '', tipo, creadoPor, ahora };
  const cual = `${tipo === 'prueba' ? 'la prueba' : 'el reenvío'} (edición ${edicionId}, persona ${persona.usuario_id})`;
  if (!emailValido(persona.email)) {
    await anotarEnvioAMano({ ...fila, estado: 'omitido', intentos: 0, error: MENSAJES_CORREO.sinEmail });
    return false;
  }
  const mail = mailPara(edicion, persona.nombre_completo, { prueba: tipo === 'prueba' });
  const envioId = await anotarEnvioAMano({ ...fila, estado: 'enviando', intentos: 1, error: null });
  let envio;
  try {
    envio = await mandarElMail(enviar, edicion, mail, persona.email);
  } catch (error) {
    console.error(`Dato de la quincena: no se sabe si salió ${cual}.`, error?.code ?? '');
    return false;
  }
  const salio = envio?.success === true;
  if (!salio) console.error(`Dato de la quincena: no se pudo enviar ${cual}.`);
  try {
    await terminarEnvio(envioId, { enviado: salio, ahora: ahoraArgentina(), error: MENSAJES_CORREO.envioFallido });
  } catch (error) {
    // Queda «enviando»: sin confirmar, y nunca se repite solo
    aLaConsola(`Dato de la quincena: no se pudo anotar ${cual}:`, error);
  }
  return salio;
};

const rechazado = (motivo) => ({ estado: 'rechazado', motivo });

/**
 * «Reenviar» una edición (`edicion`: `{ id, tipo, fecha_edicion }`, de edicionDelCorreo) a todas las personas que hoy están en
 * la lista (`a` 'todas') o a una de ellas (su id), en el momento, aunque no sea día hábil, el envío automático esté apagado o la
 * persona esté de licencia: lo decide una persona (`creadoPor`). Con el candado de la corrida: si está mandando, `{ estado:
 * 'ocupado' }`. Ya con él, mira lo que puede haber cambiado: si el envío automático terminó (sePuedeReenviar, con la vigencia de
 * hoy) y la lista de hoy (listaDeHoy, la misma de «Reenviada…»). Si no se puede, `{ estado: 'rechazado', motivo }`, con la
 * clave de MENSAJES_CORREO ('soloRegulares', 'todaviaSeManda', 'noEstaEnLaLista' o 'listaVacia'), sin mandar ni anotar nada. Si
 * no, una fila 'reenvio' por persona y `{ estado: 'hecho', enviados, fallidos }`: una persona a la que no se le pudo armar el
 * mail o anotar la fila cuenta en `fallidos` y no frena a las demás (sin un 500 a mitad de camino, que al repetirlo duplicaría).
 * Una edición con envío automático recalcula su estado (a quien no le había llegado y ahora sí deja de contar como falla; una
 * que ya no está vigente cierra): una sin filas automáticas (no enviada, o archivada antes del correo) queda como estaba, y
 * nunca vuelve a programada. `enviar`: sendEmail.
 */
export const reenviar = async ({ edicion, a, creadoPor, ahora = ahoraArgentina(), enviar = sendEmail }) => {
  if (edicion.tipo !== 'regular') return rechazado('soloRegulares');
  const corrida = await conBloqueo(async () => {
    const [correo, envios, lista] = await Promise.all([correoDe(edicion.id), enviosDe(edicion.id), listaDeHoy()]);
    const vigente = estaVigente(edicion.fecha_edicion, ahora.slice(0, 10));
    const automaticas = envios.filter((fila) => fila.tipo === 'automatico');
    if (!sePuedeReenviar({ tipo: edicion.tipo, correo, envios: automaticas, vigente })) return rechazado('todaviaSeManda');
    const enLaLista = lista.map((persona) => persona.usuario_id);
    if (a !== 'todas' && !enLaLista.includes(a)) return rechazado('noEstaEnLaLista');
    const ids = a === 'todas' ? enLaLista : [a];
    if (ids.length === 0) return rechazado('listaVacia');

    const preparada = await prepararLaEdicion(edicion.id);
    const resultado = { estado: 'hecho', enviados: 0, fallidos: 0 };
    for (const persona of await contactosDe(ids)) {
      let salio = false;
      try {
        salio = await mandarAMano(edicion.id, preparada, persona, { tipo: 'reenvio', creadoPor, ahora, enviar });
      } catch (error) {
        // No se pudo armar su mail o anotar su fila antes de mandarlo: a ella no salió. Cuenta como falla y se sigue con las
        // demás, porque las de antes ya lo recibieron: un 500 haría que se repita y les llegue dos veces. En la consola, solo el
        // código: el error de la base puede traer la dirección
        console.error(`Dato de la quincena: no se pudo reenviar (edición ${edicion.id}, persona ${persona.usuario_id}).`,
          error?.code ?? '');
      }
      resultado[salio ? 'enviados' : 'fallidos'] += 1;
    }
    if (correo !== null && automaticas.length > 0) {
      try {
        await recalcular(edicion.id, null, vigente);
      } catch (error) {
        // Los mails ya salieron y sus filas están: lo que se muestra sale de ellas, y la corrida no mira este estado para mandar
        aLaConsola(`Dato de la quincena: no se pudo recalcular la edición ${edicion.id} después del reenvío:`, error);
      }
    }
    return resultado;
  }, BLOQUEO_DATO_QUINCENA);
  return corrida.ocupado ? { estado: 'ocupado' } : corrida.resultado;
};

/**
 * «Enviarme una prueba» de una edición (cualquiera, también un piloto, con el envío como esté) a quien la pide (`usuario`: `{ id,
 * nombre_completo, email }`), con «[PRUEBA] » delante del asunto. Con el candado de la corrida: `{ estado: 'ocupado' }` si está
 * mandando; si no, una fila 'prueba' (no cuenta para el estado) y `{ estado: 'hecho', enviado }`. `enviar`: sendEmail.
 */
export const mandarPrueba = async ({ edicion, usuario, ahora = ahoraArgentina(), enviar = sendEmail }) => {
  const corrida = await conBloqueo(async () => {
    const preparada = await prepararLaEdicion(edicion.id);
    const persona = { usuario_id: usuario.id, nombre_completo: usuario.nombre_completo, email: usuario.email };
    const enviado = await mandarAMano(edicion.id, preparada, persona, { tipo: 'prueba', creadoPor: usuario.id, ahora, enviar });
    return { estado: 'hecho', enviado };
  }, BLOQUEO_DATO_QUINCENA);
  return corrida.ocupado ? { estado: 'ocupado' } : corrida.resultado;
};
