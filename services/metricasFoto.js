// La foto del 31/12 (spec 2026-10-24-metricas-y-reportes, 3): las métricas de un año, calculadas una sola vez «al 31/12» y
// guardadas en metricas_fotos, que no se modifican nunca. La saca sola la corrida de las 8:15 (ejecutarNotificacionesDiarias, un
// paso aislado después de las Notas Digitales): la primera con hoy ≥ 10/01 del año siguiente, sea o no día hábil, y si no pudo, la
// siguiente (cada corrida saca la del año cerrado más viejo que falta: fotoQueToca, Ruling 18). Se guarda con un INSERT IGNORE por
// año, así una segunda corrida (o dos a la vez) no la pisa. La API de métricas y el Informe anual la leen (leerFoto, aniosConFoto)
// en lugar de recalcular el año con la base de hoy.
//
// datos (un JSON): { version, casos, vistas, cintas, contexto, trabajo, areas, generada }. Todos los números ya van calculados: quien
// lee la foto (la API de métricas, el Informe anual) no recalcula nada, así que un cambio posterior en las reglas no reescribe un año
// pasado. Se lee así: datos.vistas[clave], datos.cintas[clave], datos.trabajo[estadistico] y datos.contexto.
// - version: VERSION_DE_LA_FOTO, la forma de estos datos;
// - casos: los casos de casosDe (la forma de siempre) que tocan el año (casosQueTocanElAnio), para saber de dónde salió cada número
//   aunque después se corrija algo (con ellos, vistaDe del año da lo mismo que con todos);
// - vistas: vistaDe del año en las cuatro combinaciones de los selectores (spec, 1.7), por clave (claveDeLaVista: 'mediana-habiles',
//   'mediana-corridos', 'promedio-habiles' y 'promedio-corridos'), con todos los datasets (sin = []: una foto no se destilda);
// - cintas: la cinta del recorrido típico de cada combinación, por la misma clave: { externa, interna }, cada una la de
//   cintaDeMetricas (services/metricasCinta.js) con el circuito de esa vista (null si no se dibuja);
// - contexto: { indice, indice_vacio, antiguedad, estados }, de contextoDelAnio al 31/12 (con el reloj del RPAD: el
//   estado según las aprobaciones, como lo mostraba la portada esa noche); estados: cuántos había en cada estado, el total, los
//   vencidos y la tasa (las tarjetas del Estado general de ese día);
// - trabajo: el trabajo del RPAD (trabajoDelAnio) con cada estadístico, { mediana, promedio }: la doble verificación sigue a
//   mediana o promedio (spec, 1.7) y un año con foto se puede ver con cualquiera de los dos;
// - areas: areasYTemas al 31/12;
// - generada: cuándo se sacó, 'AAAA-MM-DD HH:MM:SS' en hora argentina.
// Todo se calcula con hoy = 31/12 y con todos los datasets (nunca destildados): cuenta lo que tiene fecha del año aunque se haya
// registrado entre el 1/1 y el 10/1 (por ejemplo, una carga del 30/12 aprobada el 05/01), y nada de lo que pasó después del 31/12.
import pool from '../config/database.js';
import { fuentesDe } from './seguimientoDatos.js';
import {
  ESTADISTICOS, DIAS, casosDe, casosQueTocanElAnio, vistaDe, contextoDelAnio, trabajoDelAnio, areasYTemas
} from './metricasReglas.js';
import { cintasDeLaVista } from './metricasCinta.js';
import { DIA_DE_LA_FOTO, fotoQueToca } from './metricasOpciones.js';
import { ahoraArgentina, hoyArgentina } from './notasDigitalesCalendario.js';

// Desde qué día del año ('MM-DD') se saca la foto del año anterior (el 10 de enero): vive en services/metricasOpciones.js, que es puro
export { DIA_DE_LA_FOTO };

// La forma de `datos`: una foto vieja se lee por su versión
export const VERSION_DE_LA_FOTO = 1;

// La clave de una combinación de los selectores en datos.vistas y datos.cintas: 'mediana-habiles', 'promedio-corridos'…
export const claveDeLaVista = (estadistico, dias) => `${estadistico}-${dias}`;

// Los datos de la foto de `anio` al 31/12, con las fuentes de todos los datasets (el Map de fuentesDe). No toca la base.
// `generada`: el momento en que se saca.
export const datosDeLaFoto = (fuentesPorDataset, { anio, generada }) => {
  const al = `${anio}-12-31`;
  const casos = casosDe(fuentesPorDataset, { hoy: al });
  const delAnio = casosQueTocanElAnio(casos, { anio, al });
  const vistas = {};
  const cintas = {};
  for (const estadistico of ESTADISTICOS) {
    for (const dias of DIAS) {
      const clave = claveDeLaVista(estadistico, dias);
      vistas[clave] = vistaDe(delAnio, { anio, al, estadistico, dias, sin: [] });
      cintas[clave] = cintasDeLaVista(vistas[clave], { estadistico, dias });
    }
  }
  return {
    version: VERSION_DE_LA_FOTO,
    casos: delAnio,
    vistas,
    cintas,
    contexto: contextoDelAnio(fuentesPorDataset, { anio, al }),
    trabajo: Object.fromEntries(ESTADISTICOS.map((estadistico) =>
      [estadistico, trabajoDelAnio(fuentesPorDataset, casos, { anio, al, estadistico })])),
    areas: areasYTemas(fuentesPorDataset, { anio, al }),
    generada
  };
};

// Saca la foto que corresponde (fotoQueToca, Ruling 18): la del año cerrado más viejo, desde PRIMER_ANIO, cuyo 10/01 ya llegó y que
// todavía no la tiene, una por corrida y siempre al 31/12 de ese año. { anio, sacada: true } si la guardó; { anio, ya: true } si no
// falta ninguna (con el último año que ya la tiene) o si otra corrida la guardó mientras esta la calculaba (el INSERT IGNORE no la
// pisa); null si hoy no toca (antes del 10/01 del primer año que la tiene que tener: en 2026 no hay foto de 2025 que sacar). Tira si
// algo falla (leer las fuentes o guardar): la corrida lo registra y la siguiente la vuelve a intentar.
export const sacarFotoSiCorresponde = async ({ hoy = hoyArgentina() } = {}) => {
  const toca = fotoQueToca({ hoy, aniosConFoto: await aniosConFoto() });
  if (toca === null) return null;
  const { anio } = toca;
  if (!toca.falta) return { anio, ya: true };
  const datos = datosDeLaFoto(await fuentesDe(null), { anio, generada: ahoraArgentina() });
  const [resultado] = await pool.query(
    'INSERT IGNORE INTO metricas_fotos (anio, al, datos) VALUES (?, ?, ?)', [anio, `${anio}-12-31`, JSON.stringify(datos)]
  );
  return resultado.affectedRows === 1 ? { anio, sacada: true } : { anio, ya: true };
};

// Las partes de `datos` que son objetos (además de `casos`, una lista)
const PARTES_DE_LA_FOTO = Object.freeze(['vistas', 'cintas', 'contexto', 'trabajo', 'areas']);
const esObjeto = (valor) => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

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
  if (!esObjeto(datos) || datos.version !== VERSION_DE_LA_FOTO || !Array.isArray(datos.casos)
    || !PARTES_DE_LA_FOTO.every((parte) => esObjeto(datos[parte]))) {
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
