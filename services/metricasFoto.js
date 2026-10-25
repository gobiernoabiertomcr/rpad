// La foto del 31/12 (spec 2026-10-24-metricas-y-reportes, 3): las métricas de un año, calculadas una sola vez «al 31/12» y
// guardadas en metricas_fotos, que no se modifican nunca. La saca sola la corrida de las 8:15 (ejecutarNotificacionesDiarias, un
// paso aislado después de las Notas Digitales): la primera con hoy ≥ 10/01 del año siguiente, sea o no día hábil. Se guarda con un
// INSERT IGNORE por año, así una segunda corrida (o dos a la vez) no la pisa. La API de métricas y el Informe anual la leen
// (leerFoto, aniosConFoto) en lugar de recalcular el año con la base de hoy.
//
// datos (un JSON): { version, casos, contexto, trabajo, areas, generada }
// - version: VERSION_DE_LA_FOTO, la forma de estos datos;
// - casos: los casos de casosDe (la forma de siempre) que tocan el año (casosQueTocanElAnio): con ellos, vistaDe del año da lo
//   mismo que con todos, con cualquier estadístico y días, así que la pestaña Métricas arma el año con la misma vistaDe;
// - contexto: { indice, antiguedad }, de indiceMesAMes y antiguedadDeVencidos al 31/12 (con el reloj del RPAD: el estado según las
//   aprobaciones, como lo mostraba la portada esa noche);
// - trabajo: el trabajo del RPAD (trabajoDelAnio) con cada estadístico, { mediana, promedio }: la doble verificación sigue a
//   mediana o promedio (spec, 1.7) y un año con foto se puede ver con cualquiera de los dos;
// - areas: areasYTemas al 31/12;
// - generada: cuándo se sacó, 'AAAA-MM-DD HH:MM:SS' en hora argentina.
// Todo se calcula con hoy = 31/12 y con todos los datasets (nunca destildados): cuenta lo que tiene fecha del año aunque se haya
// registrado entre el 1/1 y el 10/1 (por ejemplo, una carga del 30/12 aprobada el 05/01), y nada de lo que pasó después del 31/12.
import pool from '../config/database.js';
import { fuentesDe } from './seguimientoDatos.js';
import {
  ESTADISTICOS, PRIMER_ANIO, casosDe, casosQueTocanElAnio, indiceMesAMes, antiguedadDeVencidos, trabajoDelAnio, areasYTemas
} from './metricasReglas.js';
import { ahoraArgentina, esFechaIso, hoyArgentina } from './notasDigitalesCalendario.js';

// Desde qué día del año ('MM-DD') se saca la foto del año anterior: el 10 de enero, para que entren los datos del año que se
// registran en los primeros días de enero (lo decidió el usuario)
export const DIA_DE_LA_FOTO = '01-10';

// La forma de `datos`: una foto vieja se lee por su versión
export const VERSION_DE_LA_FOTO = 1;

// Los datos de la foto de `anio` al 31/12, con las fuentes de todos los datasets (el Map de fuentesDe). No toca la base.
// `generada`: el momento en que se saca.
export const datosDeLaFoto = (fuentesPorDataset, { anio, generada }) => {
  const al = `${anio}-12-31`;
  const casos = casosDe(fuentesPorDataset, { hoy: al });
  return {
    version: VERSION_DE_LA_FOTO,
    casos: casosQueTocanElAnio(casos, { anio, al }),
    contexto: {
      indice: indiceMesAMes(fuentesPorDataset, { anio, al }),
      antiguedad: antiguedadDeVencidos(fuentesPorDataset, { anio, al })
    },
    trabajo: Object.fromEntries(ESTADISTICOS.map((estadistico) =>
      [estadistico, trabajoDelAnio(fuentesPorDataset, casos, { anio, al, estadistico })])),
    areas: areasYTemas(fuentesPorDataset, { anio, al }),
    generada
  };
};

// El año del que toca sacar la foto en `hoy` ('AAAA-MM-DD'), o null: el anterior, desde el 10/01, y nunca uno anterior al primer
// año de las métricas (PRIMER_ANIO: en 2026 no hay foto de 2025 que sacar)
const anioDeLaFoto = (hoy) => {
  if (!esFechaIso(hoy) || hoy.slice(5) < DIA_DE_LA_FOTO) return null;
  const anio = Number(hoy.slice(0, 4)) - 1;
  return anio >= PRIMER_ANIO ? anio : null;
};

const hayFoto = async (anio) => {
  const [filas] = await pool.query('SELECT 1 FROM metricas_fotos WHERE anio = ?', [anio]);
  return filas.length > 0;
};

// Saca la foto del año anterior si corresponde: { anio, sacada: true } si la guardó; { anio, ya: true } si ya estaba (también si
// otra corrida la guardó mientras esta la calculaba: el INSERT IGNORE no la pisa); null si hoy no toca (antes del 10/01, o un año
// anterior a PRIMER_ANIO). Tira si algo falla (leer las fuentes o guardar): la corrida lo registra y la saca al día siguiente.
export const sacarFotoSiCorresponde = async ({ hoy = hoyArgentina() } = {}) => {
  const anio = anioDeLaFoto(hoy);
  if (anio === null) return null;
  if (await hayFoto(anio)) return { anio, ya: true };
  const datos = datosDeLaFoto(await fuentesDe(null), { anio, generada: ahoraArgentina() });
  const [resultado] = await pool.query(
    'INSERT IGNORE INTO metricas_fotos (anio, al, datos) VALUES (?, ?, ?)', [anio, `${anio}-12-31`, JSON.stringify(datos)]
  );
  return resultado.affectedRows === 1 ? { anio, sacada: true } : { anio, ya: true };
};

// `datos` leído de la base. Tira si no es una foto de esta versión (un JSON roto o de otra forma): una foto que no se puede leer no
// puede pasar por «todavía no hay foto»
const datosLeidos = (valor, anio) => {
  const texto = Buffer.isBuffer(valor) ? valor.toString('utf8') : valor;
  let datos = null;
  try {
    datos = typeof texto === 'string' ? JSON.parse(texto) : texto;
  } catch {
    datos = null;
  }
  if (!datos || typeof datos !== 'object' || datos.version !== VERSION_DE_LA_FOTO || !Array.isArray(datos.casos)) {
    throw new Error(`La foto de ${anio} no se puede leer`);
  }
  return datos;
};

// La foto de `anio`: { anio, al ('AAAA-12-31'), datos }, o null si no hay (o si `anio` no es un entero)
export const leerFoto = async (anio) => {
  const numero = Number(anio);
  if (anio === null || anio === '' || !Number.isInteger(numero)) return null;
  const [[fila]] = await pool.query(
    "SELECT anio, DATE_FORMAT(al, '%Y-%m-%d') al, datos FROM metricas_fotos WHERE anio = ?", [numero]
  );
  if (!fila) return null;
  return { anio: Number(fila.anio), al: fila.al, datos: datosLeidos(fila.datos, numero) };
};

// Los años con foto, del más viejo al más nuevo
export const aniosConFoto = async () => {
  const [filas] = await pool.query('SELECT anio FROM metricas_fotos ORDER BY anio');
  return filas.map((fila) => Number(fila.anio));
};
