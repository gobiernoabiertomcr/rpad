/**
 * Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 6): el paso de las ausencias de día entero a
 * Configuración → Licencias, dentro de la transacción en que se carga, se corrige o se borra la licencia de Mi espacio (quien
 * llama la abre, con bloquearUsuarios como primera sentencia, y la confirma o la deshace). Lo que se hace lo deciden las
 * reglas puras (`pasoDeLaCarga`, `pasoDeLaCorreccion` y `pasoDeLaBaja` de services/miEspacioReglas.js); acá se lee lo que
 * necesitan y se escribe con el servicio de Configuración (services/licenciasOficialesService.js), con la persona como actor:
 * el historial queda en usuarios_auditoria como siempre y nunca sale el aviso al superadmin (el cambio es de la misma persona).
 *
 * `aplicarCarga`, `aplicarCorreccion` y `aplicarBaja` devuelven lo que se guarda en la fila de Mi espacio,
 * `{ licencia_oficial_id, oficial, sin_pasar, avisos }`, o `{ error: { status, campo, mensaje } }`, que deshace todo. Un
 * rechazo de Configuración se lee así:
 * - uno en `autorizado_id` (la persona a cargo no sirve): su status y su mensaje; no se guarda nada;
 * - cualquier otro: la fila se guarda igual, sin pasar, con el mensaje en `sin_pasar` (cortado a 200 caracteres).
 * La licencia de la persona autorizada del firmante pasa como cualquier otra, aunque no le quede ningún día hábil de la del
 * firmante (decisión del usuario, 27/10/2026): el cálculo previo se lo avisa (`textoAutorizadaDelFirmante`), sin frenarla.
 */
import pool from '../config/database.js';
import { cargarLicencia, cambiarLicencia, anularLicenciaDe, firmanteTitular } from './licenciasOficialesService.js';
import { puedeTenerLicencia } from './licenciasReglas.js';
import { oficialesDe, tocadasPorOtros, oficialesQueSeCruzan, delFirmanteComoAutorizada } from './miEspacioDatos.js';
import {
  TEXTO_NO_SE_COPIA, vinculoDe, pasoDeLaCarga, pasoDeLaCorreccion, pasoDeLaBaja, vinculosDeLaLista, pasoPrevistoDe
} from './miEspacioReglas.js';

// sin_pasar es un varchar(200): se corta contando caracteres (Array.from), no unidades de UTF-16
const LARGO_SIN_PASAR = 200;
const cortado = (texto) => Array.from(String(texto)).slice(0, LARGO_SIN_PASAR).join('');

const sinVinculo = (sinPasar = null) => ({ licencia_oficial_id: null, oficial: null, sin_pasar: sinPasar, avisos: [] });

// Un rechazo de Configuración: { error } si frena todo, o { sin_pasar } si la fila se guarda igual, sin pasar
const segunElRechazo = (rechazo) => {
  if (rechazo.campo === 'autorizado_id') {
    return { error: { status: rechazo.status, campo: 'autorizado_id', mensaje: rechazo.error } };
  }
  return { sin_pasar: cortado(rechazo.error) };
};

// Lo que hace el paso de una fila nueva, o de una corregida que se trata como nueva (el de `pasoDeLaCarga`)
const aplicarPaso = async (conexion, paso, { persona, fila, hoy, autorizadoId }) => {
  if (paso.accion === 'unir') return { licencia_oficial_id: paso.oficial.id, oficial: 'unida', sin_pasar: null, avisos: [] };
  if (paso.accion === 'avisar') return sinVinculo(cortado(paso.sin_pasar));
  if (paso.accion !== 'crear') return sinVinculo();
  const { licencia, rechazo } = await cargarLicencia(conexion, {
    usuarioId: persona.id, desde: fila.desde, hasta: fila.hasta, autorizadoId: autorizadoId ?? null, actorId: persona.id, hoy
  });
  if (!rechazo) return { licencia_oficial_id: licencia.id, oficial: 'creada', sin_pasar: null, avisos: [] };
  const { error, sin_pasar: sinPasar } = segunElRechazo(rechazo);
  return error ? { error } : sinVinculo(sinPasar);
};

/**
 * El paso de una licencia nueva (`fila`, ya validada, todavía sin guardar), con la persona leída bajo el bloqueo (su rol de
 * este momento). `autorizadoId`: la persona a cargo (solo en las vacaciones del titular: Configuración lo controla).
 */
export const aplicarCarga = async (conexion, { persona, fila, hoy, autorizadoId = null }) => {
  const cruzadas = await oficialesQueSeCruzan(conexion, persona.id, fila.desde, fila.hasta);
  return aplicarPaso(conexion, pasoDeLaCarga({ fila, rol: persona.rol, hoy, cruzadas }), { persona, fila, hoy, autorizadoId });
};

// El vínculo de una fila guardada con su licencia de Configuración, leído con la conexión
const vinculoGuardado = async (conexion, persona, guardada) => {
  if (guardada.licencia_oficial_id === null) return vinculoDe(guardada, null, false);
  const oficial = (await oficialesDe([guardada.licencia_oficial_id], conexion)).get(guardada.licencia_oficial_id);
  const tocadas = await tocadasPorOtros(persona.id, conexion);
  return vinculoDe(guardada, oficial, tocadas.has(guardada.licencia_oficial_id));
};

// Lo que hace falta para corregir (y para el cálculo previo de una corrección): el vínculo y el paso. autorizadoPedido:
// undefined si el pedido no dice nada de la persona a cargo, null para «nadie» o un id
const planDeLaCorreccion = async (conexion, { persona, anterior, fila, hoy, autorizadoPedido }) => {
  const vinculo = await vinculoGuardado(conexion, persona, anterior);
  const cruzadas = await oficialesQueSeCruzan(conexion, persona.id, fila.desde, fila.hasta);
  const { oficial } = vinculo;
  const personaACargo = vinculo.estado === 'creada' && oficial.autorizado_id !== null
    && (await firmanteTitular(conexion)) === persona.id;
  const autorizadoCambia = oficial !== null && autorizadoPedido !== undefined && autorizadoPedido !== oficial.autorizado_id;
  const paso = pasoDeLaCorreccion({
    anterior, fila, vinculo, rol: persona.rol, hoy, cruzadas, autorizadoCambia, personaACargo
  });
  return { vinculo, paso };
};

/**
 * El paso de una corrección: `anterior` es la fila guardada (con su vínculo) y `fila`, la corregida, ya validada.
 * `autorizadoPedido`: undefined si el pedido no dice nada de la persona a cargo, null para «nadie» o un id. Una creada que
 * administración cambió responde además `avisos: [TEXTO_NO_SE_COPIA]`. Lo que queda como estaba (nada, o una creada que ya
 * empezó y no se pudo anular) conserva el vínculo; una creada que no se pudo copiar lo conserva con el motivo, hasta que una
 * corrección se copia o la deja con las fechas de Configuración.
 */
export const aplicarCorreccion = async (conexion, { persona, anterior, fila, hoy, autorizadoPedido }) => {
  const { vinculo, paso } = await planDeLaCorreccion(conexion, { persona, anterior, fila, hoy, autorizadoPedido });
  if (paso.error) return { error: { status: 400, ...paso.error } };
  if (vinculo.estado === 'ninguno') return aplicarPaso(conexion, paso, { persona, fila, hoy, autorizadoId: autorizadoPedido });
  const queda = {
    licencia_oficial_id: anterior.licencia_oficial_id, oficial: anterior.oficial, sin_pasar: anterior.sin_pasar,
    avisos: vinculo.estado === 'creada_cambiada' ? [TEXTO_NO_SE_COPIA] : []
  };
  if (paso.accion === 'soltar') {
    return aplicarPaso(conexion, paso.luego, { persona, fila, hoy, autorizadoId: autorizadoPedido });
  }
  if (paso.accion === 'anular') {
    const { rechazo } = await anularLicenciaDe(conexion, { licenciaId: vinculo.oficial.id, actorId: persona.id, hoy });
    // No pasa: la regla pura ya miró que se puede, con todos los usuarios bloqueados
    if (rechazo) throw new Error(`No se pudo anular la licencia ${vinculo.oficial.id} de Configuración: ${rechazo.error}`);
    return sinVinculo();
  }
  if (paso.accion === 'cambiar') {
    const { rechazo } = await cambiarLicencia(conexion, {
      licenciaId: vinculo.oficial.id, desde: fila.desde, hasta: fila.hasta, actorId: persona.id, hoy,
      autorizadoPedido: paso.sin_persona_a_cargo ? null : autorizadoPedido
    });
    if (!rechazo) return { ...queda, sin_pasar: null };
    const { error, sin_pasar: sinPasar } = segunElRechazo(rechazo);
    return error ? { error } : { ...queda, sin_pasar: sinPasar };
  }
  // Una creada que ya empezó y dejó de ser de día entero queda en Configuración: lo dice textoSigueEnConfiguracion
  if (paso.accion === 'quedar') return { ...queda, sin_pasar: null };
  // Una creada cuya copia no había pasado y que vuelve a las fechas de Configuración: ya no hay nada sin pasar
  const { oficial } = vinculo;
  if (vinculo.estado === 'creada' && fila.desde === oficial.desde && fila.hasta === oficial.hasta) {
    return { ...queda, sin_pasar: null };
  }
  return queda;
};

/**
 * El paso de una baja (`fila`, la guardada): una creada que todavía no empezó (o empieza hoy) anula la de Configuración; una
 * que empezó antes de hoy no se borra (409 `yaEmpezo`). Lo demás se borra sin tocar Configuración.
 */
export const aplicarBaja = async (conexion, { persona, fila, hoy }) => {
  const vinculo = await vinculoGuardado(conexion, persona, fila);
  const paso = pasoDeLaBaja({ vinculo, hoy });
  if (paso.error) return { error: paso.error };
  if (paso.accion === 'anular') {
    const { rechazo } = await anularLicenciaDe(conexion, { licenciaId: vinculo.oficial.id, actorId: persona.id, hoy });
    if (rechazo) throw new Error(`No se pudo anular la licencia ${vinculo.oficial.id} de Configuración: ${rechazo.error}`);
  }
  return { licencia_oficial_id: fila.licencia_oficial_id, oficial: fila.oficial, sin_pasar: fila.sin_pasar, avisos: [] };
};

/**
 * Lo que el cálculo previo de «Cargar licencia» dice del paso, sin escribir nada: `{ paso, error }`, con el `paso` de
 * `pasoPrevistoDe` y el error de la corrección (`tipoFijo`, `soloHasta`, `fechasFijas`: `{ campo, mensaje }`) o null.
 * `anterior`: la fila guardada que se corrige, o null en una carga. Lee del pool (o de la conexión que se pase), también
 * las licencias del firmante en las que la persona es la autorizada y que se pisan con la fila (`comoAutorizada`).
 */
export const pasoPrevisto = async ({ persona, anterior, fila, hoy }, conexion = pool) => {
  const titular = await firmanteTitular(conexion);
  const soyTitular = titular === persona.id;
  // Quien no puede tener licencia nunca pasa: no hace falta leerlas
  const comoAutorizada = puedeTenerLicencia(persona.rol)
    ? await delFirmanteComoAutorizada(conexion, titular, persona.id, fila.desde, fila.hasta) : [];
  const comun = { fila, rol: persona.rol, hoy, soyTitular, comoAutorizada };
  if (!anterior) {
    const cruzadas = await oficialesQueSeCruzan(conexion, persona.id, fila.desde, fila.hasta);
    const paso = pasoDeLaCarga({ fila, rol: persona.rol, hoy, cruzadas });
    return { paso: pasoPrevistoDe({ ...comun, paso, vinculo: null }), error: null };
  }
  const { vinculo, paso } = await planDeLaCorreccion(conexion, { persona, anterior, fila, hoy, autorizadoPedido: undefined });
  return { paso: pasoPrevistoDe({ ...comun, paso: paso.error ? {} : paso, vinculo }), error: paso.error ?? null };
};

/**
 * Los vínculos de la lista de la persona (`vinculosDeLaLista`), con sus licencias de Configuración y las que otra persona
 * editó o anuló, leídas del pool.
 * @returns {Promise<Map<number, object>>}
 */
export const vinculosDe = async (persona, estado, hoy) => {
  const ids = estado.licencias.map((fila) => fila.licencia_oficial_id).filter((id) => id !== null);
  const oficiales = await oficialesDe(ids);
  const tocadas = ids.length > 0 ? await tocadasPorOtros(persona.id) : new Set();
  return vinculosDeLaLista(estado.licencias, { oficiales, tocadas, hoy, puedeTener: puedeTenerLicencia(persona.rol) });
};
