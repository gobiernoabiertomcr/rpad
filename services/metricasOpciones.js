// Las opciones de la pestaña Métricas (spec 2026-10-24-metricas-y-reportes, 1.5 a 1.7 y 3): qué años se pueden ver y cómo (en vivo,
// o de su foto del 31/12, con el aviso de la foto que falta), de qué año toca sacar la foto, y los parámetros de un pedido leídos con
// tolerancia. Lo usan la API de métricas y su PDF (controllers/metricasController.js) y la foto (services/metricasFoto.js), que así
// reintenta justo lo que dice el aviso. Puro: sin base de datos ni Date local (las fechas son 'AAAA-MM-DD'); ninguna función tira.
import { ESTADISTICOS, DIAS, GESTIONES, PRIMER_ANIO } from './metricasReglas.js';
import { esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';

// Desde qué día del año ('MM-DD') se saca la foto del año anterior: el 10 de enero, para que entren los datos del año que se
// registran en los primeros días de enero (lo decidió el usuario)
export const DIA_DE_LA_FOTO = '01-10';

const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

// Los años de `desde` a `hasta`, los dos incluidos ([] si `hasta` es anterior)
const aniosEntre = (desde, hasta) => Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);

// Los años con foto, como un Set de números (lo que no es una lista, ninguno)
const conjuntoDeFotos = (aniosConFoto) => new Set(Array.isArray(aniosConFoto) ? aniosConFoto.map(Number) : []);

// El día desde el que se saca la foto de `anio`: el 10/01 del año siguiente
const diaDeLaFoto = (anio) => `${anio + 1}-${DIA_DE_LA_FOTO}`;

// El aviso de un año cerrado sin foto en `hoy` (Ruling 17): hasta el 10/01 del año siguiente inclusive, «La foto de 2026 se saca el
// 10/01/2027»; después (una corrida no pudo sacarla), «La foto de 2026 todavía no se sacó: se reintenta en la próxima corrida.»
// (fotoQueToca la vuelve a intentar en cada corrida, de la más vieja a la más nueva)
const avisoDeLaFoto = (anio, hoy) => (hoy <= diaDeLaFoto(anio)
  ? `La foto de ${anio} se saca el ${formatoCorto(diaDeLaFoto(anio))}`
  : `La foto de ${anio} todavía no se sacó: se reintenta en la próxima corrida.`);

// Cómo se ve `anio` en `hoy`: { al, en_vivo, aviso_foto }, o null si ese año no tiene métricas (anterior a PRIMER_ANIO o futuro).
// El de hoy, en vivo al día de hoy; uno cerrado con foto (`conFoto`, un Set), de su foto al 31/12; uno cerrado sin foto, en vivo al
// 31/12, con el aviso de la foto (Ruling 17: nunca desaparece).
const periodoDe = (anio, hoy, conFoto) => {
  const actual = Number(hoy.slice(0, 4));
  if (!Number.isInteger(anio) || anio < PRIMER_ANIO || anio > actual) return null;
  if (anio === actual) return { al: hoy, en_vivo: true, aviso_foto: null };
  const al = `${anio}-12-31`;
  if (conFoto.has(anio)) return { al, en_vivo: false, aviso_foto: null };
  return { al, en_vivo: true, aviso_foto: avisoDeLaFoto(anio, hoy) };
};

// Los años que se pueden ver en `hoy` ('AAAA-MM-DD'): siempre de PRIMER_ANIO (2026) al de hoy, del más viejo al más nuevo (Ruling 17:
// uno cerrado sin foto se ve en vivo). [] si `hoy` no es una fecha.
export const aniosDeMetricas = ({ hoy } = {}) => (esFechaIso(hoy) ? aniosEntre(PRIMER_ANIO, Number(hoy.slice(0, 4))) : []);

// Lo que dice el botón del Informe anual de un año sin foto en `hoy` (Ruling 34): hasta el día de la foto inclusive (también el del año
// en curso), «Disponible desde el 10/01/2027»; después (la corrida no pudo sacarla), el aviso de la pestaña Métricas (avisoDeLaFoto)
const avisoDelInforme = (anio, hoy) => (hoy <= diaDeLaFoto(anio) ? `Disponible desde el ${formatoCorto(diaDeLaFoto(anio))}` : avisoDeLaFoto(anio, hoy));

// Los años de aniosDeMetricas en `hoy` con su foto, para la tarjeta del Informe anual (spec 5, Para presentar, punto 2), que así no la
// deduce: [{ anio, con_foto, aviso_informe }], del más viejo al más nuevo. `con_foto`: si el año está en `aniosConFoto`;
// `aviso_informe`: lo que dice el botón deshabilitado mientras no la tiene (avisoDelInforme), o null con foto. [] si `hoy` no es una
// fecha.
export const fotosDeMetricas = ({ hoy, aniosConFoto } = {}) => {
  const conFoto = conjuntoDeFotos(aniosConFoto);
  return aniosDeMetricas({ hoy }).map((anio) => (conFoto.has(anio)
    ? { anio, con_foto: true, aviso_informe: null }
    : { anio, con_foto: false, aviso_informe: avisoDelInforme(anio, hoy) }));
};

// De qué año toca sacar la foto en `hoy` (Ruling 18), con los años que ya la tienen (`aniosConFoto`): el más viejo de los años
// cerrados desde PRIMER_ANIO cuyo 10/01 ya llegó y que todavía no la tienen, { anio, falta: true }: si una corrida no pudo sacarla,
// la siguiente la reintenta, aunque haya pasado más de un año, de a una por corrida. Si no falta ninguna, { anio, falta: false } con
// el último de esos años (ya tiene la suya). null si todavía no llegó el 10/01 de ningún año desde PRIMER_ANIO, o si `hoy` no es una
// fecha.
export const fotoQueToca = ({ hoy, aniosConFoto } = {}) => {
  if (!esFechaIso(hoy)) return null;
  const conFoto = conjuntoDeFotos(aniosConFoto);
  const cerrados = aniosEntre(PRIMER_ANIO, Number(hoy.slice(0, 4)) - 1).filter((anio) => diaDeLaFoto(anio) <= hoy);
  if (cerrados.length === 0) return null;
  const falta = cerrados.find((anio) => !conFoto.has(anio));
  return falta === undefined ? { anio: cerrados.at(-1), falta: false } : { anio: falta, falta: true };
};

// El año pedido: un entero, o un texto de cuatro dígitos; si no, null (vale el de entrada)
const anioPedido = (valor) => {
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : null;
  return typeof valor === 'string' && /^\d{4}$/.test(valor) ? Number(valor) : null;
};

// Uno de `validos` si `valor` lo es; si no, el primero (el de entrada). Un parámetro repetido en la URL llega como lista: no sirve
const elegido = (valor, validos) => (validos.includes(valor) ? valor : validos[0]);

// Los destildados (spec 1.5, `?sin=12,45`): los enteros positivos escritos solo con dígitos (como el id del Seguimiento: '0', '-2',
// '1.5' y '1e3' no lo son), sin repetidos y en el orden pedido. Acepta el texto separado por comas o, si el parámetro se repitió en la
// URL, la lista de textos; lo demás se ignora.
const destildadosDe = (valor) => {
  const textos = (Array.isArray(valor) ? valor : [valor]).filter((texto) => typeof texto === 'string').flatMap((texto) => texto.split(','));
  const ids = textos.map((texto) => texto.trim()).filter((texto) => /^\d+$/.test(texto)).map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)];
};

// Las opciones de un pedido de métricas (`query`: los parámetros de la URL, los de req.query), leídas con tolerancia (Review Focus 2
// del plan): lo que no sirve cae al de entrada (el año de hoy, mediana, días hábiles y gestión externa) o se ignora (un destildado que
// no es un entero positivo). `hoy`: 'AAAA-MM-DD'; `aniosConFoto`: los años con foto. Devuelve { anio, al, en_vivo, aviso_foto,
// estadistico, dias, gestion, sin }: `al`, el día al que se calcula (hoy, o el 31/12 de un año cerrado); `en_vivo`, si se calcula con
// la base de hoy (false: sale de la foto); `aviso_foto`, el aviso de un año cerrado que todavía no tiene foto (si no, null); `sin`, los
// destildados (en un año con foto, ninguno: la foto se calculó con todos). null si el año pedido no tiene métricas (anterior a 2026 o
// futuro: el 404) o si `hoy` no es una fecha.
export const opcionesDeMetricas = (query, { hoy, aniosConFoto } = {}) => {
  if (!esFechaIso(hoy)) return null;
  const q = objeto(query);
  const anio = anioPedido(q.anio) ?? Number(hoy.slice(0, 4));
  const periodo = periodoDe(anio, hoy, conjuntoDeFotos(aniosConFoto));
  if (periodo === null) return null;
  return {
    anio, ...periodo,
    estadistico: elegido(q.estadistico, ESTADISTICOS), dias: elegido(q.dias, DIAS), gestion: elegido(q.gestion, GESTIONES),
    sin: periodo.en_vivo ? destildadosDe(q.sin) : []
  };
};
