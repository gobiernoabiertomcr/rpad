/**
 * La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 3).
 *
 * `votar`, el PUT de cualquier rol con sesión (authMiddleware): el permiso es estar en la foto de la edición, no el rol. Los controles,
 * cada uno antes del siguiente: 404 si el id no pasa idPositivo o la edición no existe (antes de mirar el cuerpo), 409 si la edición no
 * se vota, 403 si quien pide no está en la foto, 409 si ya cerró y 400 si el orden no tiene cada propuesta una sola vez. El calendario
 * se lee una vez; sin él (o sin una llegada que se pueda leer) y sin sellar, el cierre no se sabe y el voto no se guarda (500). El
 * cierre se vuelve a mirar adentro de la transacción, con la hora del voto y los votos de ese momento: la votación cierra a las 12:00 o
 * cuando votaron todos (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado), y un voto que llega después del que la cerró da 409.
 *
 * Lo que `ver` y `listar` (datoQuincenaController.js) les pasan a detalleDeLaEdicion y a itemDeLaLista lo arman `votacionParaElDetalle` y
 * `votacionParaLaLista`, puras, en datoQuincenaVotacionReglas.js.
 *
 * Un 500 dice un mensaje fijo y, en la consola, solo el código y el mensaje del error.
 */
import { ahoraArgentina } from '../services/notasDigitalesCalendario.js';
import { leerCalendario } from '../services/feriadosDatos.js';
import { idPositivo } from '../services/proyectosReglas.js';
import { MENSAJES_CORREO } from '../services/datoQuincenaCorreoReglas.js';
import { edicionDelCorreo } from '../services/datoQuincenaCorreoDatos.js';
import { MENSAJES_VOTACION, estadoDeLaVotacionLeida, ordenDelVoto, mensajeDelVoto } from '../services/datoQuincenaVotacionReglas.js';
import { leerVotaciones, guardarVoto } from '../services/datoQuincenaVotacionDatos.js';

// Un rechazo con su mensaje fijo de MENSAJES_VOTACION; el 404, el de todas las rutas de una edición
const rechazar = (res, status, clave) => res.status(status).json({ success: false, error: MENSAJES_VOTACION[clave] });
const noExiste = (res) => res.status(404).json({ success: false, error: MENSAJES_CORREO.noExiste });

// Sin el calendario (o sin una llegada que se pueda leer) y sin sellar, el cierre no se sabe con certeza: el voto no se guarda
const sinCierre = () => Object.assign(new Error('Sin el calendario no se sabe el cierre de la votación'), { code: 'SIN_CALENDARIO' });

/**
 * PUT /api/dato-quincena/ediciones/:id/voto (`{ orden: [2, 1, 4, 3] }`, el `orden` de cada propuesta, de la más querida a la menos).
 * Con los controles de arriba, guarda el orden en una fila nueva si no es el último de esa persona (guardarVoto) y responde 200 con
 * `{ cambio }` y «Guardamos tu orden. Lo podés cambiar hasta el martes 24/11 a las 12:00, o hasta que voten todas las personas de la
 * lista.», «Tu orden ya era ese.» o, si su voto completó la foto, «Guardamos tu orden. Votaron todos: la votación cerró.».
 */
export const votar = async (req, res) => {
  const id = idPositivo(req.params.id);
  if (id === null) return noExiste(res);
  try {
    const [edicion, votaciones, calendario] = await Promise.all([edicionDelCorreo(id), leerVotaciones([id]), leerCalendario()]);
    if (edicion === null) return noExiste(res);
    const votacion = votaciones.get(id);
    if (votacion === undefined) return rechazar(res, 409, 'noSeVota');
    const usuarioId = req.user.userId;
    if (!votacion.personas.some((persona) => persona.usuario_id === usuarioId)) return rechazar(res, 403, 'noEstas');
    const estado = estadoDeLaVotacionLeida(votacion, { ahora: ahoraArgentina(), calendario });
    if (!estado.abierta) return rechazar(res, 409, 'cerro');
    const orden = ordenDelVoto(req.body?.orden, votacion.ordenes);
    if (orden === null) return rechazar(res, 400, 'orden');
    if (estado.sin_calendario) throw sinCierre();

    // Adentro de la transacción, con la votación bloqueada: la foto, los votos y las propuestas de ese momento, y la hora del voto
    // (`ahora`). Sellada, a las 12:00 o porque votaron todos, cerrada; sin cierre, no se guarda
    const estaCerrada = (leida) => {
      const enEseMomento = estadoDeLaVotacionLeida(leida, { ahora: leida.ahora, calendario });
      if (enEseMomento.abierta && enEseMomento.sin_calendario) throw sinCierre();
      return !enEseMomento.abierta;
    };
    const guardado = await guardarVoto({ edicionId: id, usuarioId, orden, estaCerrada });
    if (!guardado.votacion) return rechazar(res, 409, 'noSeVota');
    if (!guardado.persona) return rechazar(res, 403, 'noEstas');
    if (guardado.cerrada) return rechazar(res, 409, 'cerro');
    const { cambio, cerro } = guardado;
    res.json({ success: true, data: { cambio }, message: mensajeDelVoto({ cambio, cierre: estado.cierre, cerro }) });
  } catch (error) {
    console.error(MENSAJES_VOTACION.alGuardar, error?.code ?? '', error?.message ?? '');
    if (!res.headersSent) res.status(500).json({ success: false, error: MENSAJES_VOTACION.alGuardar });
  }
};
