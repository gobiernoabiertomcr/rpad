// Feriados (spec 2026-10-26-feriados, sección 3): los días no hábiles que no son los 9 fijos, para la pestaña Feriados de
// Configuración y para Mi espacio. GET /api/feriados lo lee cualquier rol con sesión (authMiddleware).
// Las reglas son puras (services/feriadosReglas.js) y las consultas, de solo lectura, están en services/feriadosDatos.js. Hoy es
// hoyArgentina(). Respuestas { success, data?, error?, campo? }.
import { hoyArgentina } from '../services/notasDigitalesCalendario.js';
import { MENSAJES_FERIADO, feriadosDelAnio, aniosDelSelector } from '../services/feriadosReglas.js';
import { filasDeFeriados } from '../services/feriadosDatos.js';

// Los años que se pueden pedir en GET /api/feriados
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

// El año del pedido como número: sin `anio` (o vacío), el en curso; un texto de cuatro cifras de ANIO_MINIMO a ANIO_MAXIMO, ese
// año; cualquier otra cosa ('abc', '1999', '2026.5', ' 2026', un `anio` repetido, que Express da como lista), null (400)
const anioDelPedido = (valor, hoy) => {
  if (valor === undefined || valor === '') return Number(hoy.slice(0, 4));
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) return null;
  const anio = Number(valor);
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? anio : null;
};

// GET /api/feriados?anio=AAAA: los feriados del año (los 9 fijos y los de la tabla, tal como los arma feriadosDelAnio) y los años
// del selector de la pestaña
export const listarFeriados = async (req, res) => {
  const hoy = hoyArgentina();
  const anio = anioDelPedido(req.query.anio, hoy);
  if (anio === null) return res.status(400).json({ success: false, error: MENSAJES_FERIADO.anio, campo: 'anio' });
  try {
    const filas = await filasDeFeriados();
    res.json({ success: true, data: { anio, anios: aniosDelSelector(filas, hoy), feriados: feriadosDelAnio(filas, anio) } });
  } catch (error) {
    console.error('Error obteniendo los feriados:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los feriados' });
  }
};
