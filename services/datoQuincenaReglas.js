/**
 * El dato de la quincena (spec 2026-11-07-dato-quincena): las reglas puras del archivo de las ediciones de Datito, sin pool
 * ni Date local (hoy llega por parámetro, `hoyArgentina()` en el servidor). Las validaciones, el token y el año de la lista
 * no tiran error con ninguna entrada: dan los errores de sus campos, 'rechazado' o `{ valido: false }`; las fechas y las
 * horas, '—' o null. Lo demás (la clave, los tamaños, las filas, los avisos, el recibo, lo que se copia, la lista y el
 * detalle) recibe una edición ya validada, o lo guardado de una, y no la vuelve a revisar: con otra cosa puede tirar.
 *
 * `validarEdicion` mira la forma de la edición (sección 5) menos lo que depende de las partes recibidas: del manifiesto, solo
 * su forma. Cada error es `{ campo, mensaje }`, con la ruta y un mensaje fijo que no repite lo que llegó, hasta 50.
 * `validarAdjuntos` mira los valores del manifiesto y el contenido de las partes, y `erroresDeLaEdicion` junta las dos con
 * el mismo tope. La huella del paquete (sección 6) y el token (sección 12) también son puros: solo `crypto`.
 *
 * Los textos y las filas (secciones 7 y 9) los arma el servidor y la página los imprime tal cual: las fechas y las horas en
 * Argentina, la foto del RPAD de cada propuesta, la propuesta y el borrador para copiar, las filas que se guardan, los avisos
 * y el recibo. Lo mismo las lecturas (sección 9): el año de la lista, cada edición de la lista, el detalle y el nombre y el
 * Content-Type de cada descarga.
 *
 * De la spec 2026-11-12-dato-quincena-correo (11, 12 y 14): el SVG de la infografía (`esSvg`, su tope y su renglón en la huella),
 * el tipo de un evento de la agenda (la efeméride), el número de edición y las partes de la fecha de la tarjeta, y el nombre del
 * bot en una sola constante (`NOMBRE_DEL_BOT`).
 *
 * Del contrato v1.3 (spec 2026-11-14-dato-quincena-v1-3): las etiquetas Efemeride y Repite, la repetición opcional de cada
 * propuesta (`repeticion`) con su coherencia, y lo que depende de lo archivado (la edición previa y si cita el dataset), que nunca
 * frena una edición: da avisos en el recibo (`fechasPrevias` y `avisosDeLaEdicion`) y el enlace del detalle.
 *
 * Del contrato v1.4 (spec 2026-11-18-dato-quincena-propuestas-datasets): las propuestas de datasets nuevos (`propuestas_datasets`),
 * opcionales como la repetición, con sus repetidos y su coherencia entre el valor, el riesgo y la anonimización; y, en el detalle, su
 * prioridad (la matriz de valor y riesgo) y sus textos, calculados al leer de la edición archivada.
 */
import crypto from 'node:crypto';
import { esFechaIso, sumarDias, ahoraArgentina, formatoLargo, formatoCorto } from './notasDigitalesCalendario.js';
import { enLista } from './miEspacioReglas.js';
import { RPAD_URL } from './emailTemplates.js';

// El nombre del bot en todo lo que arma el servidor (spec 2026-11-12-dato-quincena-correo, 14): es provisorio, así que está en
// una sola constante, que usan también las ediciones ya archivadas
export const NOMBRE_DEL_BOT = 'Datito';

// El tope de cada parte del multipart y el del pedido entero (la suma más el margen del multipart), en bytes (sección 4). El del
// SVG, 1 MB: lo sugirió el bot, cuyo SVG pesa unos 7 KB (spec 2026-11-12-dato-quincena-correo, 11)
export const TOPES = Object.freeze({
  metadata: 256 * 1024, infografia_png: 5 * 1024 * 1024, correo_texto: 256 * 1024, calculos: 256 * 1024,
  infografia_svg: 1024 * 1024
});
export const TOPE_DEL_PEDIDO = 7 * 1024 * 1024;

// Las partes del pedido, en el orden de la huella, y las que son archivos de la edición (las que describe el manifiesto). El SVG,
// opcional como los cálculos, va al final: la huella de un paquete sin SVG no cambia
export const PARTES = Object.freeze(['metadata', 'infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);
export const ARCHIVOS = Object.freeze(['infografia_png', 'correo_texto', 'calculos', 'infografia_svg']);

// La primera fecha de edición que se acepta y cuántos errores devuelve la validación como mucho
export const FECHA_MINIMA = '2026-11-01';
export const MAXIMO_DE_ERRORES = 50;

export const MENSAJES_VALIDACION = Object.freeze({
  edicion: 'La edición tiene que ser un objeto JSON.',
  objeto: 'Tiene que ser un objeto.',
  lista: 'Tiene que ser una lista.',
  falta: 'Falta esta clave: va siempre, aunque sea null.',
  sobra: 'Esta clave no está en el formato de la edición.',
  sobraOtra: 'Trae una clave que no está en el formato de la edición.',
  schemaVersion: 'La versión del formato tiene que ser 1.0.',
  agente: 'El agente tiene que ser dato-de-la-quincena.',
  fechaEdicion: 'La fecha de la edición tiene que ser un día AAAA-MM-DD que exista, desde el 01/11/2026 hasta mañana.',
  tipo: 'El tipo tiene que ser regular o piloto.',
  referenciaRegular: 'Una edición regular no lleva referencia de piloto: va null.',
  referenciaPiloto: 'La referencia de un piloto tiene que ser piloto-N, con N de 1 a 999 y sin ceros a la izquierda.',
  generadoAt: 'Una edición regular tiene que traer la hora en que se generó.',
  correoEstado: 'El estado del correo tiene que ser enviado o no_enviado.',
  enviadoAt: 'Una edición regular tiene que traer la hora en que salió el correo.',
  enviadoAtSinCorreo: 'Con el correo no enviado, la hora del correo va null.',
  texto: 'Tiene que ser un texto.',
  vacio: 'El texto no puede quedar vacío ni con solo espacios.',
  caracterNulo: 'El texto no puede llevar el carácter nulo.',
  hasta64: 'Puede tener hasta 64 caracteres.',
  hasta200: 'Puede tener hasta 200 caracteres.',
  hasta1000: 'Puede tener hasta 1000 caracteres.',
  hasta2000: 'Puede tener hasta 2000 caracteres.',
  hasta4000: 'Puede tener hasta 4000 caracteres.',
  hasta10000: 'Puede tener hasta 10000 caracteres.',
  hasta20000: 'Puede tener hasta 20000 caracteres.',
  fecha: 'Tiene que ser una fecha AAAA-MM-DD que exista.',
  instante: 'Tiene que ser un instante AAAA-MM-DDTHH:MM:SS, con hasta 9 decimales y Z o ±HH:MM al final, de un día que exista, '
    + 'desde el año 1900.',
  fechaOInstante: 'Tiene que ser una fecha AAAA-MM-DD o un instante con su zona.',
  direccion: 'Tiene que ser una dirección https:// válida, de hasta 2048 caracteres.',
  orden: 'Las propuestas van numeradas 1, 2, 3… en su orden, sin saltos.',
  etiqueta: 'Las etiquetas posibles son Principal, Validar, Agenda, Efemeride y Repite.',
  etiquetaRepetida: 'Esta etiqueta ya está en la propuesta.',
  principal: 'Exactamente una propuesta tiene que llevar la etiqueta Principal.',
  // La repetición (spec 2026-11-14-dato-quincena-v1-3, 1). Los dos de la coherencia los copia Datito tal cual: no se cambian
  motivoDeRepeticion: 'El motivo de una repetición tiene que ser datos_nuevos o hecho_actual.',
  alcanceDeRepeticion: 'El alcance de una repetición tiene que ser dataset o tema.',
  repiteSinRepeticion: 'La propuesta tiene la etiqueta Repite pero no tiene repeticion.',
  repeticionSinRepite: 'La propuesta tiene repeticion pero no tiene la etiqueta Repite.',
  // Las propuestas de datasets nuevos (spec 2026-11-18-dato-quincena-propuestas-datasets, 1). Los escribió Datito y los copia tal
  // cual en su chequeo: no se cambian
  propuestasDatasets: 'Puede haber como mucho 3 propuestas de datasets.',
  numeroDeDataset: 'Las propuestas de datasets se numeran desde 1 y sin saltos.',
  de5a120: 'Tiene que tener de 5 a 120 caracteres.',
  de20a600: 'Tiene que tener de 20 a 600 caracteres.',
  tituloDeDatasetRepetido: 'Hay dos propuestas de datasets con el mismo título.',
  origenes: 'Tiene que traer de 1 a 4 orígenes.',
  origen: 'Los orígenes posibles son Agenda, Noticias, Pedidos de acceso y Cruce de datasets.',
  origenRepetido: 'Este origen ya está en la propuesta.',
  datasetsRelacionados: 'Puede traer hasta 5 datasets relacionados.',
  slug: 'El slug tiene que tener de 2 a 100 caracteres: letras minúsculas sin tildes, números, - y _.',
  slugRepetido: 'Este dataset ya está en la lista.',
  valor: 'El valor tiene que ser Alto, Medio o Bajo.',
  riesgo: 'El riesgo tiene que ser Alto, Medio o Bajo.',
  bajoConAlto: 'Un dataset de valor bajo y riesgo alto no se propone (matriz de priorización).',
  formatoSugerido: 'El formato sugerido tiene que ser CSV, GeoJSON, JSON, KML o XML.',
  camposSugeridos: 'Tiene que traer de 3 a 15 campos sugeridos.',
  campoSugeridoRepetido: 'Este campo ya está en la lista.',
  sinAnonimizacion: 'Con riesgo Medio o Alto hace falta indicar la anonimización.',
  anonimizacionDeMas: 'Con riesgo Bajo, anonimizacion va en null.',
  fuentesDeDataset: 'Tiene que traer de 1 a 5 fuentes.',
  fuenteRepetida: 'Esta fuente ya está en la lista.',
  enteroPositivo: 'Tiene que ser un número entero positivo.',
  estado: 'Tiene que ser uno de los estados de GET /api/datasets.',
  diasParaVencer: 'Tiene que ser un número entero de -100000 a 100000.',
  sha256: 'Tiene que ser un SHA-256 en hexadecimal: 64 caracteres en minúsculas.',
  agenda: 'La agenda puede traer hasta 20 eventos.',
  tipoDeEvento: 'El tipo de un evento de la agenda tiene que ser evento o efemeride.',
  propuestas: 'La edición tiene que traer de 1 a 5 propuestas.',
  adjuntos: 'El manifiesto tiene que describir de 2 a 4 archivos.',
  puntosCentrales: 'Tiene que traer de 3 a 5 puntos centrales.',
  parrafos: 'El borrador tiene que traer 2 o 3 párrafos.',
  notasValidacion: 'Puede traer hasta 20 notas de validación.',
  fuentes: 'Tiene que traer de 1 a 20 fuentes.',
  campo: 'El campo tiene que ser infografia_png, correo_texto, calculos o infografia_svg.',
  campoRepetido: 'Este campo ya está en otra entrada del manifiesto.',
  sinParte: 'El pedido no trae la parte que describe esta entrada.',
  sinEntradaInfografia: 'El manifiesto no describe la parte infografia_png, que llegó en el pedido.',
  sinEntradaCorreo: 'El manifiesto no describe la parte correo_texto, que llegó en el pedido.',
  sinEntradaCalculos: 'El manifiesto no describe la parte calculos, que llegó en el pedido.',
  sinEntradaSvg: 'El manifiesto no describe la parte infografia_svg, que llegó en el pedido.',
  nombre: 'El nombre del archivo tiene que tener de 1 a 255 caracteres, sin /, \\ ni caracteres de control.',
  mime: 'El tipo tiene que ser image/png en la infografía, text/plain en el texto del correo, text/markdown o text/plain en '
    + 'los cálculos e image/svg+xml en la infografía editable.',
  bytesDistintos: 'No coincide con el tamaño de la parte recibida.',
  sha256Distinto: 'No coincide con el SHA-256 de la parte recibida.',
  png: 'La infografía tiene que ser un PNG completo, de 1 a 4096 píxeles de ancho y de alto.',
  svg: 'La infografía editable tiene que ser un SVG que empiece con <svg, sin scripts, sin foreignObject, sin atributos on… y '
    + 'sin referencias externas.',
  utf8: 'Tiene que ser un texto UTF-8 válido, sin el carácter nulo.'
});

const TIPOS = Object.freeze(['regular', 'piloto']);
// Efemeride va sin tilde, como la escribe el bot: el detalle la muestra «Efeméride» (ETIQUETAS_PARA_MOSTRAR)
const ETIQUETAS = Object.freeze(['Principal', 'Validar', 'Agenda', 'Efemeride', 'Repite']);
// Los estados de GET /api/datasets, como los manda la API
const ESTADOS = Object.freeze(['actualizado', 'proximo', 'atrasado', 'sin-respuesta', 'sin-fecha', 'eventual']);
const DIAS_PARA_VENCER = 100000;
const LARGO_DE_DIRECCION = 2048;

const REFERENCIA = /^piloto-[1-9]\d{0,2}$/;
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
// El año de un instante (sus cuatro primeras cifras), de 1900 en adelante: antes no es un dato creíble para estas
// ediciones, y un instante muy viejo se imprime roto con la hora histórica de Argentina (−3:53:48 hasta 1894: el
// 01/01/1000 a las 00:00 UTC cae en el año 999, que Intl no completa con ceros), para siempre, en el detalle de una
// edición que no se puede corregir
const ANIO_MINIMO_DEL_INSTANTE = 1900;
const SHA256 = /^[0-9a-f]{64}$/;
// Una clave de más con esta forma se nombra en la ruta; otra no se repite y el error va en el objeto que la trae
const CLAVE_NOMBRABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const caracteres = (texto) => Array.from(texto).length;
const unir = (ruta, clave) => (ruta === '' ? clave : `${ruta}.${clave}`);

const esInstante = (valor) => typeof valor === 'string' && INSTANTE.test(valor)
  && Number(valor.slice(0, 4)) >= ANIO_MINIMO_DEL_INSTANTE && esFechaIso(valor.slice(0, 10))
  && Number.isFinite(Date.parse(valor));

const esDireccion = (valor) => {
  if (typeof valor !== 'string' || !valor.startsWith('https://') || valor.includes('\u0000')
    || caracteres(valor) > LARGO_DE_DIRECCION) return false;
  try {
    new URL(valor);
    return true;
  } catch {
    return false;
  }
};

// Cada validador recibe (valor, ruta, agregar, indice) y agrega a lo sumo un error por valor, salvo las listas y los objetos

// Lo que todo texto mira antes de su largo: que sea un texto, que no quede vacío ni con solo espacios (si es obligatorio) y que no
// lleve el carácter nulo. La clave del mensaje, o null si pasa
const errorDeTexto = (valor, { obligatorio }) => {
  if (typeof valor !== 'string') return 'texto';
  if (obligatorio && valor.trim() === '') return 'vacio';
  if (valor.includes('\u0000')) return 'caracterNulo';
  return null;
};

// Un texto con tope. Obligatorio: no vacío ni con solo espacios. Con oNull, null también vale (y un texto vacío)
const texto = (tope, { oNull = false } = {}) => (valor, ruta, agregar) => {
  if (oNull && valor === null) return;
  const error = errorDeTexto(valor, { obligatorio: !oNull });
  if (error !== null) return agregar(ruta, error);
  if (caracteres(valor) > tope) agregar(ruta, `hasta${tope}`);
};

// Un texto obligatorio de minimo a maximo caracteres, contados tal como llegó (los espacios de los extremos también): si no, el
// mensaje que se pasa
const textoEntre = (minimo, maximo, mensaje) => (valor, ruta, agregar) => {
  const error = errorDeTexto(valor, { obligatorio: true });
  if (error !== null) return agregar(ruta, error);
  const largo = caracteres(valor);
  if (largo < minimo || largo > maximo) agregar(ruta, mensaje);
};

const unTexto = (valor, ruta, agregar) => {
  if (typeof valor !== 'string') agregar(ruta, 'texto');
};

const igual = (esperado, mensaje) => (valor, ruta, agregar) => {
  if (valor !== esperado) agregar(ruta, mensaje);
};

const unoDe = (opciones, mensaje, { oNull = false } = {}) => (valor, ruta, agregar) => {
  if (oNull && valor === null) return;
  if (!opciones.includes(valor)) agregar(ruta, mensaje);
};

const fecha = (valor, ruta, agregar) => {
  if (!esFechaIso(valor)) agregar(ruta, 'fecha');
};

// Un instante. Si es null y no puede serlo, el mensaje siNull
const instante = ({ oNull, siNull = 'instante' }) => (valor, ruta, agregar) => {
  if (valor === null) {
    if (!oNull) agregar(ruta, siNull);
    return;
  }
  if (!esInstante(valor)) agregar(ruta, 'instante');
};

const fechaOInstanteONull = (valor, ruta, agregar) => {
  if (valor !== null && !esFechaIso(valor) && !esInstante(valor)) agregar(ruta, 'fechaOInstante');
};

const direccion = (valor, ruta, agregar) => {
  if (!esDireccion(valor)) agregar(ruta, 'direccion');
};

const enteroPositivo = ({ oNull = false } = {}) => (valor, ruta, agregar) => {
  if (oNull && valor === null) return;
  if (!Number.isSafeInteger(valor) || valor <= 0) agregar(ruta, 'enteroPositivo');
};

const diasParaVencer = (valor, ruta, agregar) => {
  if (valor === null) return;
  if (!Number.isInteger(valor) || Math.abs(valor) > DIAS_PARA_VENCER) agregar(ruta, 'diasParaVencer');
};

const unSha256 = (valor, ruta, agregar) => {
  if (typeof valor !== 'string' || !SHA256.test(valor)) agregar(ruta, 'sha256');
};

// Una lista de minimo a maximo elementos (si no, el mensaje), cada uno con su validador y su ruta 'lista[i]'
const lista = (minimo, maximo, mensaje, elemento) => (valor, ruta, agregar) => {
  if (!Array.isArray(valor)) return agregar(ruta, 'lista');
  if (valor.length < minimo || valor.length > maximo) agregar(ruta, mensaje);
  valor.forEach((item, i) => elemento(item, `${ruta}[${i}]`, agregar, i));
};

// Un objeto cerrado: cada clave de la forma tiene que estar (undefined cuenta como que falta) y ninguna otra.
// forma es un objeto { clave: validador } o una función (valor, indice) que lo arma, para lo que depende de otra clave
const objeto = (forma) => (valor, ruta, agregar, indice) => {
  if (!esObjeto(valor)) return agregar(ruta, 'objeto');
  const claves = typeof forma === 'function' ? forma(valor, indice) : forma;
  for (const [clave, validar] of Object.entries(claves)) {
    const rutaDeLaClave = unir(ruta, clave);
    if (!Object.hasOwn(valor, clave) || valor[clave] === undefined) agregar(rutaDeLaClave, 'falta');
    else validar(valor[clave], rutaDeLaClave, agregar);
  }
  for (const clave of Object.keys(valor)) {
    if (Object.hasOwn(claves, clave)) continue;
    if (CLAVE_NOMBRABLE.test(clave)) agregar(unir(ruta, clave), 'sobra');
    else agregar(ruta, 'sobraOtra');
  }
};

// Si el valor pasa el validador, sin agregar ningún error
const pasa = (validar, valor) => {
  let sinErrores = true;
  validar(valor, '', () => {
    sinErrores = false;
  });
  return sinErrores;
};

// Una lista y, después de sus errores, sus repetidos: cada elemento cuyo valor ya apareció antes en la lista (el segundo de cada par
// y los que siguen) da el mensaje, en su ruta. Con clave, el valor es esa clave de cada elemento, y el error va en ella. Solo cuentan
// los valores que pasan su validador, así ninguno suma un segundo error; se comparan exactos o como los deja comparable
const sinRepetidos = (validarLista, { clave = null, validar, mensaje, comparable = (dato) => dato }) => (valor, ruta, agregar) => {
  validarLista(valor, ruta, agregar);
  if (!Array.isArray(valor)) return;
  const vistos = new Set();
  valor.forEach((elemento, i) => {
    if (clave !== null && !(esObjeto(elemento) && Object.hasOwn(elemento, clave))) return;
    const dato = clave === null ? elemento : elemento[clave];
    if (!pasa(validar, dato)) return;
    const comparado = comparable(dato);
    if (vistos.has(comparado)) agregar(clave === null ? `${ruta}[${i}]` : unir(`${ruta}[${i}]`, clave), mensaje);
    vistos.add(comparado);
  });
};

const etiquetas = (valor, ruta, agregar) => {
  if (!Array.isArray(valor)) return agregar(ruta, 'lista');
  const vistas = new Set();
  valor.forEach((etiqueta, i) => {
    if (!ETIQUETAS.includes(etiqueta)) agregar(`${ruta}[${i}]`, 'etiqueta');
    else if (vistas.has(etiqueta)) agregar(`${ruta}[${i}]`, 'etiquetaRepetida');
    vistas.add(etiqueta);
  });
};

const DATASET = Object.freeze({
  rpad_id: enteroPositivo({ oNull: true }),
  ckan_slug: texto(200, { oNull: true }),
  nombre: texto(200),
  url: direccion
});

const FOTO_DEL_RPAD = Object.freeze({
  estado: unoDe(ESTADOS, 'estado', { oNull: true }),
  datos_al: fechaOInstanteONull,
  ultima_actualizacion: fechaOInstanteONull,
  updated_at: instante({ oNull: true }),
  dias_para_vencer: diasParaVencer
});

const BORRADOR = Object.freeze({ titulo: texto(200), parrafos: lista(2, 3, 'parrafos', texto(10000)) });

const MOTIVOS_DE_REPETICION = Object.freeze(['datos_nuevos', 'hecho_actual']);
const ALCANCES_DE_REPETICION = Object.freeze(['dataset', 'tema']);
const FORMA_DE_LA_REPETICION = Object.freeze({
  fecha_edicion_previa: fecha,
  motivo: unoDe(MOTIVOS_DE_REPETICION, 'motivoDeRepeticion'),
  alcance: unoDe(ALCANCES_DE_REPETICION, 'alcanceDeRepeticion'),
  detalle: texto(1000)
});

// La repetición de una propuesta (spec 2026-11-14-dato-quincena-v1-3, 1): null o un objeto cerrado de cuatro claves. La fecha no se
// compara con lo archivado: eso es un aviso del recibo, nunca un 422
const repeticion = (valor, ruta, agregar) => {
  if (valor !== null) objeto(FORMA_DE_LA_REPETICION)(valor, ruta, agregar);
};

// La propuesta i va con el orden i + 1. repeticion es opcional, como tipo en la agenda: sin ella, la propuesta tiene la forma de
// antes (v1.2), así lo que el bot mandaba sigue valiendo y schema_version sigue en 1.0
const propuesta = (valor, indice) => ({
  orden: igual(indice + 1, 'orden'),
  titulo: texto(200),
  etiquetas,
  dataset: objeto(DATASET),
  rpad_snapshot: objeto(FOTO_DEL_RPAD),
  cifra_clave: texto(1000),
  calculo: texto(20000),
  contexto_historico: texto(20000),
  por_que_hoy: texto(10000),
  angulo: texto(10000),
  idea_placa: texto(10000),
  texto_redes: texto(10000),
  puntos_centrales: lista(3, 5, 'puntosCentrales', texto(2000)),
  borrador_nota: objeto(BORRADOR),
  notas_validacion: lista(0, 20, 'notasValidacion', texto(10000)),
  fuentes: lista(1, 20, 'fuentes', direccion),
  ...(Object.hasOwn(valor, 'repeticion') ? { repeticion } : {})
});

// La repetición de una propuesta, si es un objeto; si no (sin la clave, null u otra cosa), null
const repeticionDe = (unaPropuesta) => (Object.hasOwn(unaPropuesta, 'repeticion') && esObjeto(unaPropuesta.repeticion)
  ? unaPropuesta.repeticion
  : null);

// Una propuesta con su forma y, después de sus errores, la coherencia entre la etiqueta Repite y la repetición. Solo con una lista
// de etiquetas: un valor de repeticion que no es null ni un objeto ya tiene su error y no suma este
const propuestaCoherente = (valor, ruta, agregar, indice) => {
  objeto(propuesta)(valor, ruta, agregar, indice);
  if (!esObjeto(valor) || !Array.isArray(valor.etiquetas)) return;
  const valorDeRepeticion = Object.hasOwn(valor, 'repeticion') ? valor.repeticion : undefined;
  const conRepite = valor.etiquetas.includes('Repite');
  if (conRepite && (valorDeRepeticion === undefined || valorDeRepeticion === null)) {
    agregar(unir(ruta, 'repeticion'), 'repiteSinRepeticion');
  } else if (!conRepite && esObjeto(valorDeRepeticion)) {
    agregar(unir(ruta, 'etiquetas'), 'repeticionSinRepite');
  }
};

// Las propuestas y, si hay alguna, que exactamente una lleve Principal
const propuestas = (valor, ruta, agregar) => {
  lista(1, 5, 'propuestas', propuestaCoherente)(valor, ruta, agregar);
  if (!Array.isArray(valor) || valor.length === 0) return;
  const principales = valor.filter((p) => esObjeto(p) && Array.isArray(p.etiquetas) && p.etiquetas.includes('Principal'));
  if (principales.length !== 1) agregar(ruta, 'principal');
};

// Las propuestas de datasets nuevos (spec 2026-11-18-dato-quincena-propuestas-datasets, 1): los valores cerrados, como los escribe
// Datito, y el nombre de un dataset de CKAN, que admite el guion bajo
const ORIGENES = Object.freeze(['Agenda', 'Noticias', 'Pedidos de acceso', 'Cruce de datasets']);
const NIVELES = Object.freeze(['Alto', 'Medio', 'Bajo']);
const FORMATOS_SUGERIDOS = Object.freeze(['CSV', 'GeoJSON', 'JSON', 'KML', 'XML']);
const SLUG_DE_CKAN = /^[a-z0-9_-]{2,100}$/;

// El slug de un dataset del portal: un texto con la forma de los nombres de CKAN. Vacío, con espacios o con el carácter nulo no
// tiene esa forma: el mensaje del slug, que dice cuál es
const slugDeCkan = (valor, ruta, agregar) => {
  if (typeof valor !== 'string') return agregar(ruta, 'texto');
  if (!SLUG_DE_CKAN.test(valor)) agregar(ruta, 'slug');
};

// null o un texto de hasta 1000: a diferencia de texto(1000, { oNull: true }), uno vacío o con solo espacios no vale (la página y
// el mail nunca muestran una caja vacía)
const anonimizacion = (valor, ruta, agregar) => {
  if (valor !== null) texto(1000)(valor, ruta, agregar);
};

const tituloDeDataset = textoEntre(5, 120, 'de5a120');
const origen = unoDe(ORIGENES, 'origen');
const campoSugerido = texto(64);
const DATASET_RELACIONADO = Object.freeze({ ckan_slug: slugDeCkan, nombre: texto(200) });

// La propuesta de dataset i va con el número i + 1. Los orígenes, los slugs de los datasets relacionados, los campos y las fuentes,
// sin repetidos
const propuestaDataset = (_, indice) => ({
  numero: igual(indice + 1, 'numeroDeDataset'),
  titulo: tituloDeDataset,
  origenes: sinRepetidos(lista(1, 4, 'origenes', origen), { validar: origen, mensaje: 'origenRepetido' }),
  justificacion: textoEntre(20, 600, 'de20a600'),
  datasets_relacionados: sinRepetidos(lista(0, 5, 'datasetsRelacionados', objeto(DATASET_RELACIONADO)), {
    clave: 'ckan_slug', validar: slugDeCkan, mensaje: 'slugRepetido'
  }),
  valor: unoDe(NIVELES, 'valor'),
  riesgo: unoDe(NIVELES, 'riesgo'),
  formato_sugerido: unoDe(FORMATOS_SUGERIDOS, 'formatoSugerido'),
  campos_sugeridos: sinRepetidos(lista(3, 15, 'camposSugeridos', campoSugerido), {
    validar: campoSugerido, mensaje: 'campoSugeridoRepetido'
  }),
  anonimizacion,
  fuentes: sinRepetidos(lista(1, 5, 'fuentesDeDataset', direccion), { validar: direccion, mensaje: 'fuenteRepetida' })
});

// Una propuesta de dataset con su forma y, después de sus errores, la coherencia: solo con un valor y un riesgo válidos, y un solo
// error. Valor Bajo con riesgo Alto no se propone (la matriz de priorización), y la anonimización ya no se mira; si no, y solo si
// anonimizacion no tiene su propio error, va con riesgo Medio o Alto y no va con riesgo Bajo
const propuestaDatasetCoherente = (valor, ruta, agregar, indice) => {
  objeto(propuestaDataset)(valor, ruta, agregar, indice);
  if (!esObjeto(valor) || !NIVELES.includes(valor.valor) || !NIVELES.includes(valor.riesgo)) return;
  if (valor.valor === 'Bajo' && valor.riesgo === 'Alto') return agregar(unir(ruta, 'riesgo'), 'bajoConAlto');
  if (!Object.hasOwn(valor, 'anonimizacion') || !pasa(anonimizacion, valor.anonimizacion)) return;
  if (valor.riesgo !== 'Bajo' && valor.anonimizacion === null) agregar(unir(ruta, 'anonimizacion'), 'sinAnonimizacion');
  else if (valor.riesgo === 'Bajo' && valor.anonimizacion !== null) agregar(unir(ruta, 'anonimizacion'), 'anonimizacionDeMas');
};

// De 0 a 3 propuestas de datasets y, después de las suyas, los títulos repetidos, sin mirar las mayúsculas ni los espacios de los
// extremos (las tildes, sí)
const propuestasDatasets = sinRepetidos(lista(0, 3, 'propuestasDatasets', propuestaDatasetCoherente), {
  clave: 'titulo', validar: tituloDeDataset, mensaje: 'tituloDeDatasetRepetido', comparable: (titulo) => titulo.trim().toLowerCase()
});

const TIPOS_DE_EVENTO = Object.freeze(['evento', 'efemeride']);
const FORMA_DEL_EVENTO = Object.freeze({ titulo: texto(200), fecha, detalle: texto(4000), url: direccion });
const FORMA_DEL_EVENTO_CON_TIPO = Object.freeze({ ...FORMA_DEL_EVENTO, tipo: unoDe(TIPOS_DE_EVENTO, 'tipoDeEvento') });

// Un evento de la agenda. tipo es opcional (spec 2026-11-12-dato-quincena-correo, 11): sin él es un evento, con la forma de
// antes, así lo que el bot mandaba sigue valiendo y schema_version sigue en 1.0
const evento = (valor) => (Object.hasOwn(valor, 'tipo') ? FORMA_DEL_EVENTO_CON_TIPO : FORMA_DEL_EVENTO);

// Del manifiesto, solo la forma: los valores contra las partes los mira la validación de los adjuntos
const ENTRADA_DEL_MANIFIESTO = Object.freeze({
  campo: unTexto, nombre: unTexto, mime: unTexto, bytes: enteroPositivo(), sha256: unSha256
});

// Un día que existe, desde FECHA_MINIMA hasta mañana. Sin un hoy válido no pasa (no hay tope)
const fechaDeEdicion = (hoy) => (valor, ruta, agregar) => {
  if (!esFechaIso(valor) || !esFechaIso(hoy) || valor < FECHA_MINIMA || valor > sumarDias(hoy, 1)) {
    agregar(ruta, 'fechaEdicion');
  }
};

// En una regular, referencia_piloto es null; en un piloto, piloto-N. Con un tipo que no vale, null o piloto-N
const referenciaPiloto = (tipo) => (valor, ruta, agregar) => {
  if (tipo === 'regular') {
    if (valor !== null) agregar(ruta, 'referenciaRegular');
  } else if ((tipo === 'piloto' || valor !== null) && !(typeof valor === 'string' && REFERENCIA.test(valor))) {
    agregar(ruta, 'referenciaPiloto');
  }
};

// Datito archiva la edición aunque el correo no haya salido (decisión del usuario): 'no_enviado' lleva la hora en null
const ESTADOS_DEL_CORREO = Object.freeze(['enviado', 'no_enviado']);

// La hora del correo: null con el correo no enviado; con el correo enviado, un instante, que solo un piloto puede dejar en null.
// Con un estado que no vale no se sabe si hace falta: null o un instante, para que el bot no reciba un error que lo lleve a
// poner una hora
const horaDelCorreo = (estado, regular) => (valor, ruta, agregar) => {
  if (estado === 'no_enviado') {
    if (valor !== null) agregar(ruta, 'enviadoAtSinCorreo');
    return;
  }
  instante({ oNull: !(regular && estado === 'enviado'), siNull: 'enviadoAt' })(valor, ruta, agregar);
};

const edicion = (hoy) => objeto((valor) => {
  const regular = valor.tipo === 'regular';
  return {
    schema_version: igual('1.0', 'schemaVersion'),
    agente: igual('dato-de-la-quincena', 'agente'),
    fecha_edicion: fechaDeEdicion(hoy),
    tipo: unoDe(TIPOS, 'tipo'),
    referencia_piloto: referenciaPiloto(valor.tipo),
    titulo: texto(200),
    generado_at: instante({ oNull: !regular, siNull: 'generadoAt' }),
    correo: objeto((correo) => ({
      estado: unoDe(ESTADOS_DEL_CORREO, 'correoEstado'),
      enviado_at: horaDelCorreo(correo.estado, regular)
    })),
    nota_archivo: texto(4000, { oNull: true }),
    agenda: lista(0, 20, 'agenda', objeto(evento)),
    propuestas,
    // Opcional, como repeticion (contrato v1.4): sin la clave, la edición tiene la forma de la v1.3 y sigue valiendo, así el plan B de
    // Datito entra; schema_version sigue en 1.0
    ...(Object.hasOwn(valor, 'propuestas_datasets') ? { propuestas_datasets: propuestasDatasets } : {}),
    adjuntos: lista(2, 4, 'adjuntos', objeto(ENTRADA_DEL_MANIFIESTO))
  };
});

// La lista de errores y la función que le agrega uno, hasta MAXIMO_DE_ERRORES
const juntarErrores = () => {
  const errores = [];
  const agregar = (campo, clave) => {
    if (errores.length < MAXIMO_DE_ERRORES) errores.push({ campo, mensaje: MENSAJES_VALIDACION[clave] });
  };
  return { errores, agregar };
};

const revisarEdicion = (valor, hoy, agregar) => {
  if (!esObjeto(valor)) agregar('', 'edicion');
  else edicion(hoy)(valor, '', agregar);
};

/**
 * Los errores de forma de una edición (el JSON de metadata ya leído), en el orden de la edición y hasta MAXIMO_DE_ERRORES.
 * Lo que no es un objeto da un solo error, con el campo ''. [] si está bien.
 */
export const validarEdicion = (valor, opciones) => {
  const { errores, agregar } = juntarErrores();
  revisarEdicion(valor, opciones?.hoy, agregar);
  return errores;
};

// La clave de una edición ya validada (sección 6): dq:regular:AAAA-MM-DD o dq:piloto:AAAA-MM-DD:piloto-N
export const claveDeEdicion = ({ tipo, fecha_edicion, referencia_piloto }) => (tipo === 'piloto'
  ? `dq:piloto:${fecha_edicion}:${referencia_piloto}`
  : `dq:regular:${fecha_edicion}`);

// El SHA-256 en hexadecimal, en minúsculas
export const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// El IEND vacío con su CRC: el último bloque de todo PNG
const FIN_PNG = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
// La firma, el IHDR entero (largo, tipo, 13 bytes de datos y CRC) y el IEND: así ninguna lectura se sale del buffer
const LARGO_MINIMO_PNG = FIRMA_PNG.length + 4 + 4 + 13 + 4 + FIN_PNG.length;
const LADO_MAXIMO_PNG = 4096;

const ladoDePng = (lado) => lado >= 1 && lado <= LADO_MAXIMO_PNG;

// Un PNG (sección 5): la firma, un IHDR de 13 bytes al principio con ancho y alto de 1 a 4096, y el IEND al final. No se
// decodifica la imagen ni se miran los CRC
export const esPng = (buffer) => Buffer.isBuffer(buffer) && buffer.length >= LARGO_MINIMO_PNG
  && buffer.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)
  && buffer.readUInt32BE(8) === 13 && buffer.toString('latin1', 12, 16) === 'IHDR'
  && ladoDePng(buffer.readUInt32BE(16)) && ladoDePng(buffer.readUInt32BE(20))
  && buffer.subarray(-FIN_PNG.length).equals(FIN_PNG);

// El texto de un UTF-8 válido, con el BOM conservado, o null
const utf8 = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    return null;
  }
};

// El texto de metadata, o null si no es UTF-8. El BOM queda como U+FEFF: así el JSON.parse del controlador falla (400)
export const textoDeMetadata = (buffer) => utf8(buffer);

// El texto del correo y los cálculos: UTF-8 válido, sin el carácter nulo
export const esTextoUtf8 = (buffer) => {
  const texto = utf8(buffer);
  return texto !== null && !texto.includes('\u0000');
};

const ESPACIOS_DE_XML = /[ \t\r\n]/;

// La primera posición desde i que no es un espacio de XML
const despuesDeLosEspacios = (texto, i) => {
  let j = i;
  while (j < texto.length && ESPACIOS_DE_XML.test(texto[j])) j += 1;
  return j;
};

// Si el primer elemento es <svg (seguido de un espacio o de >): delante, como mucho, espacios, una declaración <?xml …?> y
// comentarios <!-- … -->. Se lee de corrido, con indexOf y sin una expresión regular, para que 1 MB de comentarios o de espacios
// no la haga volver atrás
const empiezaConSvg = (texto) => {
  let i = despuesDeLosEspacios(texto, 0);
  if (texto.startsWith('<?xml', i) && ESPACIOS_DE_XML.test(texto[i + '<?xml'.length] ?? '')) {
    const fin = texto.indexOf('?>', i);
    if (fin === -1) return false;
    i = despuesDeLosEspacios(texto, fin + '?>'.length);
  }
  while (texto.startsWith('<!--', i)) {
    const fin = texto.indexOf('-->', i + '<!--'.length);
    if (fin === -1) return false;
    i = despuesDeLosEspacios(texto, fin + '-->'.length);
  }
  return texto.startsWith('<svg', i) && /^[ \t\r\n>]$/.test(texto[i + '<svg'.length] ?? '');
};

// Lo que un SVG no puede traer en ningún lugar, sin distinguir mayúsculas: un script, un foreignObject (HTML adentro), un
// atributo de evento (on… = ), un @import, y un href (también xlink:href) o un url( cuyo valor, con espacios y comillas
// opcionales, no empieza con # (una referencia a su propio #id). Y, para que esas reglas no se esquiven con lo que XML permite:
// el script o el foreignObject con un prefijo (<x:script), el espacio de nombres de HTML (un <iframe> o un <script> de HTML sin
// foreignObject) y una animación que cambia un href o un on… (attributeName="href"). Un texto que solo se parece a esto también
// se rechaza.
// Ninguna tiene dos cuantificadores seguidos que puedan tomar los mismos caracteres: los espacios y la comilla opcional van como
// \s*(?:["']\s*)? y no como \s*["']?\s*, que se reparte un tramo de espacios de n² maneras (1 MB de espacios después de href=
// trababa el servidor media hora). No [\s"']*: aceptaría href="'#a"
const PROHIBIDO_EN_SVG = Object.freeze([
  /<([\w.-]+:)?script/i,
  /<([\w.-]+:)?foreignobject/i,
  /http:\/\/www\.w3\.org\/1999\/xhtml/i,
  /[\s"'/]on\w+\s*=/i,
  /attributename\s*=\s*(?:["']\s*)?([\w.-]+:)?(href|on\w+)/i,
  /@import/i,
  /href\s*=(?!\s*(?:["']\s*)?#)/i,
  /url\((?!\s*(?:["']\s*)?#)/i
]);

// Las cinco entidades de XML
const ENTIDADES_DE_XML = Object.freeze({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" });
const MAXIMO_PUNTO_DE_CODIGO = 0x10ffff;

// El texto con las referencias de carácter (&#N; y &#xH;) y las cinco entidades decodificadas una vez, como lo lee un lector
// de XML: así una referencia externa no se esconde con un carácter escrito como entidad (url( con &#114; en lugar de la r).
// Una referencia a un carácter que no existe queda como está
const decodificarEntidades = (texto) => texto.replace(
  /&#[xX]([0-9a-fA-F]+);|&#([0-9]+);|&(lt|gt|amp|quot|apos);/g,
  (original, hexadecimal, decimal, nombre) => {
    if (nombre !== undefined) return ENTIDADES_DE_XML[nombre];
    const punto = hexadecimal !== undefined ? parseInt(hexadecimal, 16) : Number(decimal);
    return punto <= MAXIMO_PUNTO_DE_CODIGO ? String.fromCodePoint(punto) : original;
  }
);

/**
 * La infografía editable (spec 2026-11-12-dato-quincena-correo, 11): el RPAD no la dibuja nunca (la adjunta a un mail y la deja
 * descargar), pero igual tiene que ser un SVG sin scripts ni referencias externas. UTF-8 válido, sin el carácter nulo ni el BOM
 * al principio; el primer elemento, <svg (empiezaConSvg); y nada de PROHIBIDO_EN_SVG en el texto con las entidades
 * decodificadas. No se lee como XML: es un control conservador, que puede rechazar un texto que solo se parece a lo prohibido.
 */
export const esSvg = (buffer) => {
  const texto = utf8(buffer);
  if (texto === null || texto.includes('\u0000') || texto.startsWith('\uFEFF') || !empiezaConSvg(texto)) return false;
  const decodificado = decodificarEntidades(texto);
  return !PROHIBIDO_EN_SVG.some((prohibido) => prohibido.test(decodificado));
};

// Lo que se pide de cada archivo de la edición: los MIME que puede declarar su entrada, cómo se mira su contenido y los
// mensajes
const ARCHIVO = Object.freeze({
  infografia_png: { mimes: ['image/png'], contenido: esPng, otroContenido: 'png', sinEntrada: 'sinEntradaInfografia' },
  correo_texto: { mimes: ['text/plain'], contenido: esTextoUtf8, otroContenido: 'utf8', sinEntrada: 'sinEntradaCorreo' },
  calculos: {
    mimes: ['text/markdown', 'text/plain'], contenido: esTextoUtf8, otroContenido: 'utf8', sinEntrada: 'sinEntradaCalculos'
  },
  infografia_svg: { mimes: ['image/svg+xml'], contenido: esSvg, otroContenido: 'svg', sinEntrada: 'sinEntradaSvg' }
});

const LARGO_DEL_NOMBRE = 255;
const NOMBRE_PROHIBIDO = /[\/\\\p{Cc}]/u;

const esNombreDeArchivo = (nombre) => {
  const largo = caracteres(nombre);
  return largo >= 1 && largo <= LARGO_DEL_NOMBRE && !NOMBRE_PROHIBIDO.test(nombre);
};

// Los valores del manifiesto contra las partes recibidas. Lo que no tiene su forma (un elemento que no es un objeto, un
// valor que no es un texto, bytes o sha256 raros) ya lo informa validarEdicion y no se repite. Una entrada con un campo
// desconocido o repetido solo da ese error y el de su nombre: no se sabe con qué parte comparar lo demás
const revisarAdjuntos = (adjuntos, partes, agregar) => {
  if (!Array.isArray(adjuntos)) return;
  const recibidas = new Map(ARCHIVOS.filter((campo) => Buffer.isBuffer(partes?.[campo])).map((campo) => [campo, partes[campo]]));
  const descritos = new Set();
  adjuntos.forEach((entrada, i) => {
    if (!esObjeto(entrada)) return;
    const ruta = `adjuntos[${i}]`;
    const { campo, nombre, mime, bytes, sha256: huella } = entrada;
    const conocido = ARCHIVOS.includes(campo);
    const primero = conocido && !descritos.has(campo);
    if (typeof campo === 'string') {
      if (!conocido) agregar(`${ruta}.campo`, 'campo');
      else if (!primero) agregar(`${ruta}.campo`, 'campoRepetido');
      else if (!recibidas.has(campo)) agregar(`${ruta}.campo`, 'sinParte');
    }
    if (conocido) descritos.add(campo);
    if (typeof nombre === 'string' && !esNombreDeArchivo(nombre)) agregar(`${ruta}.nombre`, 'nombre');
    if (!primero) return;
    if (typeof mime === 'string' && !ARCHIVO[campo].mimes.includes(mime)) agregar(`${ruta}.mime`, 'mime');
    const parte = recibidas.get(campo);
    if (parte === undefined) return;
    if (Number.isSafeInteger(bytes) && bytes > 0 && bytes !== parte.length) agregar(`${ruta}.bytes`, 'bytesDistintos');
    if (typeof huella === 'string' && SHA256.test(huella) && huella !== sha256(parte)) {
      agregar(`${ruta}.sha256`, 'sha256Distinto');
    }
  });
  for (const [campo, parte] of recibidas) {
    if (!descritos.has(campo)) agregar('adjuntos', ARCHIVO[campo].sinEntrada);
    if (!ARCHIVO[campo].contenido(parte)) agregar(campo, ARCHIVO[campo].otroContenido);
  }
};

/**
 * Los errores del manifiesto (edicion.adjuntos) contra las partes recibidas, `{ infografia_png, correo_texto, calculos?,
 * infografia_svg? }`:
 * primero cada entrada (campo, nombre, mime, bytes y sha256), después cada parte que no tiene entrada (campo 'adjuntos') o
 * cuyo contenido no es el que corresponde (campo, el nombre de la parte). Hasta MAXIMO_DE_ERRORES; [] si coinciden.
 */
export const validarAdjuntos = (adjuntos, partes) => {
  const { errores, agregar } = juntarErrores();
  revisarAdjuntos(adjuntos, partes, agregar);
  return errores;
};

// Todos los errores de una edición recibida: los de la forma y después los de las partes, con un solo tope
export const erroresDeLaEdicion = (valor, partes, opciones) => {
  const { errores, agregar } = juntarErrores();
  revisarEdicion(valor, opciones?.hoy, agregar);
  if (esObjeto(valor)) revisarAdjuntos(valor.adjuntos, partes, agregar);
  return errores;
};

// Las partes cuyo renglón va en la huella solo si llegaron (spec 2026-11-12-dato-quincena-correo, 11): así un paquete sin SVG
// tiene la huella de antes del SVG, y reenviar algo ya archivado sigue dando 200 y no 409
const SOLO_SI_LLEGO = Object.freeze(['infografia_svg']);

// La huella del paquete (sección 6): el SHA-256 de un renglón por parte, en el orden de PARTES, con el SHA-256 de sus bytes
// o - si no llegó; el SVG, sin renglón si no llegó. No depende del orden en que llegaron
export const huellaDelPaquete = (partes) => sha256(PARTES
  .filter((parte) => !SOLO_SI_LLEGO.includes(parte) || Buffer.isBuffer(partes?.[parte]))
  .map((parte) => `${parte}:${Buffer.isBuffer(partes?.[parte]) ? sha256(partes[parte]) : '-'}\n`)
  .join(''));

const HUELLA_DEL_TOKEN = /^[0-9a-f]{64}$/i;
const ESQUEMA_DEL_TOKEN = 'Bearer ';
const LARGO_DEL_TOKEN = 512;

/**
 * El token del bot (sección 12) contra la huella configurada (DATO_QUINCENA_TOKEN_SHA256): 'apagado' si la huella no son 64
 * caracteres hexadecimales; 'rechazado' si el encabezado no es `Bearer ` y un token de 1 a 512 caracteres, o si el SHA-256
 * del token no es la huella; 'aceptado' si lo es. Compara a tiempo constante, dos buffers de 32 bytes.
 */
export const estadoDelToken = (authorization, huellaConfigurada) => {
  if (typeof huellaConfigurada !== 'string' || !HUELLA_DEL_TOKEN.test(huellaConfigurada)) return 'apagado';
  if (typeof authorization !== 'string' || !authorization.startsWith(ESQUEMA_DEL_TOKEN)) return 'rechazado';
  const token = authorization.slice(ESQUEMA_DEL_TOKEN.length);
  const largo = caracteres(token);
  if (largo < 1 || largo > LARGO_DEL_TOKEN) return 'rechazado';
  const recibida = Buffer.from(sha256(token), 'hex');
  const esperada = Buffer.from(huellaConfigurada.toLowerCase(), 'hex');
  return crypto.timingSafeEqual(recibida, esperada) ? 'aceptado' : 'rechazado';
};

// Los textos y las filas (secciones 7 y 9): los arma el servidor y la página los imprime tal cual

const DIAS_DE_LA_SEMANA = Object.freeze(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);

// 'Viernes' de una fecha 'AAAA-MM-DD' que existe: sale de las partes con Date.UTC, no del reloj local
const diaDeLaSemana = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return DIAS_DE_LA_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
};

// 'Viernes 6 de noviembre de 2026'. Lo que no es una fecha que existe, '—'
export const fechaLarga = (iso) => (esFechaIso(iso) ? `${diaDeLaSemana(iso)} ${formatoLargo(iso)}` : '—');

// La fecha de la tarjeta en tres renglones (spec 2026-11-12-dato-quincena-correo, 12): { dia: 'Lunes', fecha: '9 de noviembre',
// anio: 'de 2026' }, las partes de fechaLarga. Lo que no es una fecha que existe, null
const partesDeLaFecha = (iso) => {
  if (!esFechaIso(iso)) return null;
  const largo = formatoLargo(iso);
  const corte = largo.lastIndexOf(' de ');
  return { dia: diaDeLaSemana(iso), fecha: largo.slice(0, corte), anio: largo.slice(corte + 1) };
};

// 'Piloto N' en un piloto con su referencia piloto-N; null en una regular
export const marcaDePiloto = (tipo, referencia) => (tipo === 'piloto' && typeof referencia === 'string'
  && REFERENCIA.test(referencia) ? `Piloto ${referencia.slice('piloto-'.length)}` : null);

// Argentina no cambia la hora
const ZONA_ARGENTINA = '-03:00';
// Segundos UNIX en texto, como los puede dar la base (UNIX_TIMESTAMP)
const SEGUNDOS_UNIX = /^\d+(\.\d+)?$/;

// Los milisegundos de unos segundos UNIX (un número o un texto de cifras) o de un instante RFC 3339. NaN si no es ninguno
const milisegundosDe = (valor) => {
  if (typeof valor === 'number') return valor * 1000;
  if (typeof valor !== 'string') return NaN;
  return SEGUNDOS_UNIX.test(valor) ? Number(valor) * 1000 : Date.parse(valor);
};

/**
 * La fecha y la hora en Argentina de unos segundos UNIX (UNIX_TIMESTAMP de un TIMESTAMP) o de un instante RFC 3339 con
 * cualquier zona, siempre por ahoraArgentina: `{ fecha: 'dd/mm/aaaa', hora: 'HH:MM', iso: 'AAAA-MM-DDTHH:MM:SS-03:00' }`.
 * null si no es un instante.
 */
export const horaArgentina = (instanteOUnix) => {
  const instante = new Date(milisegundosDe(instanteOUnix));
  if (Number.isNaN(instante.getTime())) return null;
  const momento = ahoraArgentina(instante);
  const dia = momento.slice(0, 10);
  return { fecha: formatoCorto(dia), hora: momento.slice(11, 16), iso: `${dia}T${momento.slice(11, 19)}${ZONA_ARGENTINA}` };
};

// 'dd/mm/aaaa': una fecha 'AAAA-MM-DD' tal cual y un instante, su día en Argentina. Otra cosa (null), '—'
export const diaArgentino = (fechaOInstante) => {
  if (esFechaIso(fechaOInstante)) return formatoCorto(fechaOInstante);
  if (esInstante(fechaOInstante)) return horaArgentina(fechaOInstante).fecha;
  return '—';
};

// «Llegó al RPAD el 23/11/2026 a las 08:14.», de los segundos UNIX de recibida_at. null si no es un instante
export const textoDeLlegada = (unix) => {
  const hora = horaArgentina(unix);
  return hora === null ? null : `Llegó al RPAD el ${hora.fecha} a las ${hora.hora}.`;
};

// El correo del bot, con la hora pasada a Argentina sea cual sea la zona que mandó; sin enviado_at, sin la hora. Sin el correo,
// un texto que sigue siendo cierto aunque el correo salga después: la edición guardada no cambia
export const textoDelCorreo = (enviadoAt, estado) => {
  if (estado === 'no_enviado') return `${NOMBRE_DEL_BOT} archivó esta edición sin que saliera el correo.`;
  const hora = horaArgentina(enviadoAt);
  return hora === null
    ? `Correo enviado según ${NOMBRE_DEL_BOT}, sin la hora.`
    : `Correo enviado el ${hora.fecha} a las ${hora.hora}, según ${NOMBRE_DEL_BOT}.`;
};

// «1 propuesta» o «5 propuestas»
export const textoDeCantidad = (n) => (n === 1 ? '1 propuesta' : `${n} propuestas`);

// El número de una edición regular (spec 2026-11-12-dato-quincena-correo, 12), «N.º 3», de lo que contó la consulta: cuántas
// regulares hay con su fecha o antes. Lo que no es un entero positivo (null en un piloto), null
export const textoDelNumero = (n) => (Number.isSafeInteger(n) && n > 0 ? `N.º ${n}` : null);

// El resto de las propuestas de una edición en la lista, por el nombre de su dataset: «Y 3 propuestas más: A, B y C.».
// Sin ninguna, null
export const textoDelResto = (nombres) => (Array.isArray(nombres) && nombres.length > 0
  ? `Y ${textoDeCantidad(nombres.length)} más: ${enLista(nombres)}.`
  : null);

const KB = 1024;
const MB = 1024 * 1024;

// «97 KB», redondeado hacia arriba; desde 1 MB, en MB con un decimal y coma, también hacia arriba («1,5 MB»). En décimas
// enteras: bytes * 10 / MB es exacta (MB es una potencia de 2)
export const tamanoTexto = (bytes) => {
  if (bytes < MB) return `${Math.ceil(bytes / KB)} KB`;
  const decimas = Math.ceil((bytes * 10) / MB);
  return `${Math.floor(decimas / 10)},${decimas % 10} MB`;
};

// El estado de GET /api/datasets como lo muestra el archivo. atrasado y sin-respuesta son «Vencido»: CLAUDE.md no admite
// «Sin respuesta» en lo nuevo (el sitio público todavía lo usa) y el atraso muchas veces no depende del área
const TEXTO_DEL_ESTADO = Object.freeze({
  actualizado: 'Actualizado', proximo: 'Próximo a vencer', atrasado: 'Vencido', 'sin-respuesta': 'Vencido',
  'sin-fecha': 'Sin fecha', eventual: 'Eventual'
});

const textoDelEstado = (estado) => (typeof estado === 'string' && Object.hasOwn(TEXTO_DEL_ESTADO, estado)
  ? TEXTO_DEL_ESTADO[estado]
  : 'Sin dato');

const textoDeDias = (dias) => (dias === 1 ? '1 día' : `${dias} días`);

/**
 * La foto del RPAD de ese día (sección 9), tal como la mandó el bot, en filas `{ rotulo, valor }`: el estado (siempre; «Sin
 * dato» si no vino), «Datos al» y «Última actualización» (el día en Argentina o «—») y, si vino dias_para_vencer, «Próxima
 * en» (0 o más) o «Venció hace» (negativo). updated_at no se muestra.
 */
export const fotoDelDataset = (snapshot) => {
  const { estado, datos_al, ultima_actualizacion, dias_para_vencer: dias } = snapshot ?? {};
  const filas = [
    { rotulo: 'En el RPAD ese día:', valor: textoDelEstado(estado) },
    { rotulo: 'Datos al', valor: diaArgentino(datos_al) },
    { rotulo: 'Última actualización', valor: diaArgentino(ultima_actualizacion) }
  ];
  if (Number.isInteger(dias)) {
    filas.push(dias >= 0
      ? { rotulo: 'Próxima en', valor: textoDeDias(dias) }
      : { rotulo: 'Venció hace', valor: textoDeDias(-dias) });
  }
  return filas;
};

// Un bloque con su título y un renglón «- » por elemento
const bloqueConGuiones = (titulo, elementos) => [titulo, ...elementos.map((elemento) => `- ${elemento}`)].join('\n');

// Cómo se muestra cada etiqueta (spec 2026-11-14-dato-quincena-v1-3, 3): el bot escribe Efemeride sin tilde; las demás, igual
const ETIQUETAS_PARA_MOSTRAR = Object.freeze({ Efemeride: 'Efeméride' });
const etiquetaParaMostrar = (etiqueta) => (Object.hasOwn(ETIQUETAS_PARA_MOSTRAR, etiqueta) ? ETIQUETAS_PARA_MOSTRAR[etiqueta] : etiqueta);

const TEXTO_DEL_ALCANCE = Object.freeze({ dataset: 'el dataset', tema: 'el tema' });
const TEXTO_DEL_MOTIVO = Object.freeze({ datos_nuevos: 'Datos nuevos', hecho_actual: 'Hecho actual' });

// Los dos textos de una repetición ya validada: «Repite el dataset de la edición del 02/11/2026.» y «Datos nuevos: <detalle>», con
// el detalle tal como llegó
const textosDeLaRepeticion = ({ fecha_edicion_previa: fechaPrevia, motivo, alcance, detalle }) => ({
  texto: `Repite ${TEXTO_DEL_ALCANCE[alcance]} de la edición del ${formatoCorto(fechaPrevia)}.`,
  motivo: `${TEXTO_DEL_MOTIVO[motivo]}: ${detalle}`
});

// El borrador para copiar (sección 9): el título y sus párrafos, separados por un renglón en blanco
export const borradorParaCopiar = ({ titulo, parrafos }) => [titulo, ...parrafos].join('\n\n');

/**
 * La propuesta entera para copiar (sección 9), en texto plano: bloques separados por un renglón en blanco, los renglones de
 * un bloque con \n y los textos tal como llegaron. Sin etiquetas, el título va solo; sin notas de validación, ese bloque no
 * va. La foto va en un renglón, cada fila como «<rotulo> <valor>.».
 * Del contrato v1.3 (spec 2026-11-14-dato-quincena-v1-3, 3): las etiquetas van como se muestran («Efeméride») y, con repetición,
 * su bloque («<texto>\n<motivo>») va después de la foto y antes de «Para validar antes de publicar».
 */
export const textoParaCopiar = (propuesta) => {
  const { titulo, etiquetas, dataset, notas_validacion: notas } = propuesta;
  const repeticionDeLaPropuesta = repeticionDe(propuesta);
  const repetida = repeticionDeLaPropuesta === null ? null : textosDeLaRepeticion(repeticionDeLaPropuesta);
  return [
    etiquetas.length > 0 ? `${titulo} [${etiquetas.map(etiquetaParaMostrar).join(', ')}]` : titulo,
    propuesta.cifra_clave,
    `Dataset: ${dataset.nombre}\n${dataset.url}`,
    fotoDelDataset(propuesta.rpad_snapshot).map(({ rotulo, valor }) => `${rotulo} ${valor}.`).join(' '),
    ...(repetida === null ? [] : [`${repetida.texto}\n${repetida.motivo}`]),
    ...(notas.length > 0 ? [bloqueConGuiones('Para validar antes de publicar', notas)] : []),
    `Cómo se calculó\n${propuesta.calculo}`,
    `Contexto histórico\n${propuesta.contexto_historico}`,
    `Por qué es noticia\n${propuesta.por_que_hoy}`,
    `Ángulo\n${propuesta.angulo}`,
    `Idea de placa\n${propuesta.idea_placa}`,
    `Texto para redes\n${propuesta.texto_redes}`,
    bloqueConGuiones('Puntos centrales', propuesta.puntos_centrales),
    `Borrador de nota\n${borradorParaCopiar(propuesta.borrador_nota)}`,
    ['Fuentes', ...propuesta.fuentes].join('\n')
  ].join('\n\n');
};

/**
 * Las filas de dato_quincena_propuestas de una edición ya validada (sección 8), en su orden: `principal` es 1 en la que
 * lleva la etiqueta y `rpad_id` es el que citó el bot (el guardado lo pasa a dataset_id solo si está en datasets).
 */
export const filasDeLaEdicion = (edicion) => edicion.propuestas.map((propuesta) => ({
  orden: propuesta.orden,
  titulo: propuesta.titulo,
  cifra_clave: propuesta.cifra_clave,
  principal: propuesta.etiquetas.includes('Principal') ? 1 : 0,
  rpad_id: propuesta.dataset.rpad_id,
  dataset_nombre: propuesta.dataset.nombre
}));

const textoDelAviso = (orden, rpadId) =>
  `La propuesta ${orden} cita el dataset ${rpadId}, que no está en el RPAD: se guardó sin enlace.`;

/**
 * Las fechas de las ediciones que repiten las propuestas de una edición ya validada (spec 2026-11-14-dato-quincena-v1-3, 2): las
 * `fecha_edicion_previa` de las repeticiones que son un objeto y anteriores a `fecha_edicion`, sin repetir y en el orden de las
 * propuestas. Son las que lee leerEdicionesPrevias (services/datoQuincenaDatos.js): una igual o posterior nunca se enlaza.
 */
export const fechasPrevias = (edicion) => [...new Set(edicion.propuestas
  .map(repeticionDe)
  .filter((repeticionDeLaPropuesta) => repeticionDeLaPropuesta !== null
    && repeticionDeLaPropuesta.fecha_edicion_previa < edicion.fecha_edicion)
  .map((repeticionDeLaPropuesta) => repeticionDeLaPropuesta.fecha_edicion_previa))];

// El aviso de la repetición de una propuesta, si tiene uno: la edición previa no es anterior, no está en el RPAD (una regular de
// esa fecha, en `previas`) o, si repite el dataset, no lo cita. [] o un aviso; con `previas` null (no se pudieron leer), ninguno
const avisoDeLaRepeticion = (propuesta, fechaDeLaEdicion, previas) => {
  const repeticionDeLaPropuesta = repeticionDe(propuesta);
  if (repeticionDeLaPropuesta === null || previas === null) return [];
  const { orden } = propuesta;
  const fechaPrevia = repeticionDeLaPropuesta.fecha_edicion_previa;
  const dia = formatoCorto(fechaPrevia);
  if (fechaPrevia >= fechaDeLaEdicion) {
    return [`La propuesta ${orden} repite la edición del ${dia}, que no es anterior a esta: se guardó sin enlace.`];
  }
  const previa = previas.get(fechaPrevia);
  if (previa === undefined) return [`La propuesta ${orden} repite la edición del ${dia}, que no está en el RPAD: se guardó sin enlace.`];
  const rpadId = propuesta.dataset.rpad_id;
  if (repeticionDeLaPropuesta.alcance === 'dataset' && rpadId !== null && !previa.rpad_ids.includes(rpadId)) {
    return [`La propuesta ${orden} repite el dataset ${rpadId} de la edición del ${dia}, pero esa edición no lo tiene.`];
  }
  return [];
};

/**
 * Los avisos del recibo (sección 7), en el orden de las propuestas: uno por cada propuesta que cita un dataset (rpad_id) y
 * quedó guardada sin enlace (dataset_id null en `guardadas = [{ orden, dataset_id }]`, las filas guardadas). Sirven igual
 * para el 201 y para el 200 de una repetida, que los arma de nuevo desde lo guardado.
 * Del contrato v1.3 (spec 2026-11-14-dato-quincena-v1-3, 2): después del de su dataset, el de la repetición de cada propuesta
 * (avisoDeLaRepeticion), con `previas`, el Map de fecha a `{ id, rpad_ids }` de leerEdicionesPrevias. Sin él (un Map vacío), es
 * como si no hubiera ediciones previas: el controlador siempre lo pasa. Con null (edicionesPreviasSinFallar: no se pudieron leer),
 * ningún aviso de la repetición, ni siquiera el de una fecha que no es anterior: los del dataset, sí. Un aviso que dependa de lo
 * archivado podría ser falso, y el 200 de una repetida los arma de nuevo cuando se puedan leer.
 */
export const avisosDeLaEdicion = (edicion, guardadas, previas = new Map()) => {
  const enlaces = new Map(guardadas.map(({ orden, dataset_id }) => [orden, dataset_id ?? null]));
  return edicion.propuestas.flatMap((propuesta) => [
    ...(propuesta.dataset.rpad_id !== null && (enlaces.get(propuesta.orden) ?? null) === null
      ? [textoDelAviso(propuesta.orden, propuesta.dataset.rpad_id)]
      : []),
    ...avisoDeLaRepeticion(propuesta, edicion.fecha_edicion, previas)
  ]);
};

/**
 * El recibo del 201 y del 200 (sección 7), de la edición guardada: `recibida_ts` son los segundos UNIX de recibida_at
 * (UNIX_TIMESTAMP), así el 201 y el 200 dicen lo mismo; `adjuntos`, sus archivos, que salen en el orden de ARCHIVOS y solo
 * con campo, bytes y sha256; `avisos`, los de avisosDeLaEdicion; y `envio` (spec 2026-11-12-dato-quincena-correo, 11), el de
 * envioDelRecibo, que arma el controlador con el estado de ese momento (`{ estado, programado_at, texto }`, o null en una
 * regular sin fila de correo).
 */
export const reciboDe = ({ id, clave, tipo, fecha_edicion, huella, recibida_ts }, adjuntos, avisos, repetida, envio) => ({
  id,
  clave,
  tipo,
  fecha_edicion,
  huella,
  recibida_at: horaArgentina(recibida_ts)?.iso ?? null,
  repetida: repetida === true,
  adjuntos: ARCHIVOS.flatMap((campo) => adjuntos
    .filter((adjunto) => adjunto.campo === campo)
    .map(({ bytes, sha256: huellaDelArchivo }) => ({ campo, bytes, sha256: huellaDelArchivo }))),
  url: `${RPAD_URL}/dato-quincena.html?id=${id}`,
  avisos,
  envio: envio ?? null
});

// Las lecturas (sección 9): la lista, el detalle y las descargas, con los textos ya armados

const ANIO_DE_LA_LISTA = /^\d{4}$/;
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

/**
 * El año de la lista, de `req.query.anio`: sin él, válido y null (la lista toma el más reciente con ediciones); un entero de
 * 2000 a 2100 escrito con cuatro cifras, ese año. Otra cosa (otro texto, una lista o un objeto de la query) no es válida.
 * `{ valido, anio }`.
 */
export const anioDeLaLista = (valor) => {
  if (valor === undefined) return { valido: true, anio: null };
  const anio = typeof valor === 'string' && ANIO_DE_LA_LISTA.test(valor) ? Number(valor) : NaN;
  return anio >= ANIO_MINIMO && anio <= ANIO_MAXIMO ? { valido: true, anio } : { valido: false, anio: null };
};

// El nombre de la descarga de la edición completa: dato-quincena-<la clave sin dq: y con - en lugar de :>.json
export const nombreDeLaEdicion = (clave) => `dato-quincena-${clave.replace(/^dq:/, '').replaceAll(':', '-')}.json`;

// El Content-Type de cada descarga, fijo por campo y no el MIME del manifiesto: los cálculos en Markdown también van como texto
export const TIPO_DE_DESCARGA = Object.freeze({
  infografia_png: 'image/png',
  infografia_svg: 'image/svg+xml',
  correo_texto: 'text/plain; charset=utf-8',
  calculos: 'text/plain; charset=utf-8',
  metadata: 'application/json; charset=utf-8'
});

// El número de la edición, de lo que contó la consulta (numero): solo una regular lo tiene, aunque la fila de un piloto
// traiga uno
const numeroDe = ({ tipo, numero }) => (tipo === 'regular' ? textoDelNumero(numero) : null);

// Los rótulos de las dos principales (spec 2026-11-21-dato-quincena-principal-equipo, 3): la de Datito es la que marcó el bot (la
// columna principal, o la etiqueta del JSON); la del equipo, la que eligió administración, que vive en su propia tabla
const PRINCIPAL_DEL_EQUIPO = 'Principal del equipo';
const PRINCIPAL_DE_DATITO = `Principal de ${NOMBRE_DEL_BOT}`;

/**
 * Una edición de la lista, de una fila de listarEdiciones: la fecha larga, la marca del piloto, el título y la cifra de la
 * principal, y el resto de las propuestas por el nombre de su dataset, en su orden. Sin ninguna marcada como principal (el POST
 * no lo deja pasar), la primera; sin propuestas (solo un SQL a mano), principal null. Para la tarjeta (spec
 * 2026-11-12-dato-quincena-correo, 12): el número de una regular, de `numero` de la fila (cuántas regulares hay con su fecha o
 * antes), la fecha en partes, la cantidad de propuestas y `envio`, la pastilla del envío que arma el controlador con
 * pastillaDelEnvio y lo de quien pide (`{ tipo, texto }`, o null si no lleva).
 * La principal que cuenta (spec 2026-11-21-dato-quincena-principal-equipo, 3): la del equipo, si eligió (`orden_del_equipo` de la
 * fila, el orden de la elección vigente; null o sin la clave, no eligió), y si no, la de Datito, con su `rotulo`. Un orden que la
 * edición no tiene (solo con un SQL a mano: la FK no lo deja) cuenta como sin elegir. El resto, sin la que se muestra.
 */
export const itemDeLaLista = (fila, envio = null) => {
  const { id, tipo, fecha_edicion, referencia_piloto, propuestas } = fila;
  const enOrden = [...propuestas].sort((a, b) => a.orden - b.orden);
  const delEquipo = enOrden.find((propuesta) => propuesta.orden === fila.orden_del_equipo) ?? null;
  const principal = delEquipo ?? enOrden.find((propuesta) => propuesta.principal) ?? enOrden[0] ?? null;
  return {
    id,
    fecha_texto: fechaLarga(fecha_edicion),
    marca: marcaDePiloto(tipo, referencia_piloto),
    principal: principal === null ? null : {
      titulo: principal.titulo,
      cifra_clave: principal.cifra_clave,
      rotulo: delEquipo === null ? PRINCIPAL_DE_DATITO : PRINCIPAL_DEL_EQUIPO
    },
    resto: textoDelResto(enOrden.filter((propuesta) => propuesta !== principal).map((propuesta) => propuesta.dataset_nombre)),
    numero: numeroDe(fila),
    fecha_partes: partesDeLaFecha(fecha_edicion),
    cantidad: textoDeCantidad(propuestas.length),
    envio: envio ?? null
  };
};

// Cada archivo del detalle, en su orden (el SVG después de la infografía y la edición completa al final): su rótulo, lo que va
// antes del tamaño y si la página lo deja ver. El SVG no se ve: el RPAD no lo dibuja nunca
const ARCHIVOS_DEL_DETALLE = Object.freeze({
  infografia_png: Object.freeze({ rotulo: 'Infografía', formato: 'PNG · ', se_puede_ver: false }),
  infografia_svg: Object.freeze({ rotulo: 'Infografía editable', formato: 'SVG · ', se_puede_ver: false }),
  correo_texto: Object.freeze({ rotulo: 'Texto del correo', formato: '', se_puede_ver: true }),
  calculos: Object.freeze({ rotulo: 'Cálculos', formato: '', se_puede_ver: true }),
  metadata: Object.freeze({ rotulo: 'La edición completa', formato: 'JSON · ', se_puede_ver: false })
});
const ORDEN_DE_LOS_ARCHIVOS_DEL_DETALLE = Object.freeze(Object.keys(ARCHIVOS_DEL_DETALLE).filter((campo) => campo !== 'metadata'));

// La etiqueta de un evento de la agenda: «Efeméride» o null (un evento, con tipo o sin él)
const etiquetaDelEvento = (tipo) => (tipo === 'efemeride' ? 'Efeméride' : null);

// Los grupos de la agenda (spec 2026-11-14-dato-quincena-agenda-grupos), en este orden y con estos títulos (decisión del
// usuario). Un evento es uno sin tipo o con tipo evento; una efeméride va a su grupo cualquiera sea su fecha
const esEfemeride = (evento) => evento.tipo === 'efemeride';
const GRUPOS_DE_LA_AGENDA = Object.freeze([
  Object.freeze({ titulo: 'Lo que pasó', es: (evento, fechaDeLaEdicion) => !esEfemeride(evento) && evento.fecha < fechaDeLaEdicion }),
  Object.freeze({ titulo: 'Lo que viene', es: (evento, fechaDeLaEdicion) => !esEfemeride(evento) && evento.fecha >= fechaDeLaEdicion }),
  Object.freeze({ titulo: 'Efemérides', es: esEfemeride })
]);

/**
 * La agenda de una edición ya validada en sus grupos (spec 2026-11-14-dato-quincena-agenda-grupos), con lo que ya trae cada
 * evento y la fecha de la edición ('AAAA-MM-DD', por parámetro): «Lo que pasó» (los eventos anteriores a la edición), «Lo que
 * viene» (los del día de la edición o después) y «Efemérides». Cada grupo `{ titulo, eventos }`, por fecha de la más vieja a la
 * más nueva y, con la misma fecha, en el orden en que llegaron; cada evento `{ fecha_texto, titulo, detalle, url }`, sin etiqueta:
 * el título del grupo ya la dice. Un grupo vacío no va; sin eventos, una lista vacía. No cambia la agenda que recibe.
 */
export const gruposDeLaAgenda = (agenda, fechaDeLaEdicion) => GRUPOS_DE_LA_AGENDA
  .map(({ titulo, es }) => ({
    titulo,
    eventos: agenda
      .filter((evento) => es(evento, fechaDeLaEdicion))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : Number(a.fecha > b.fecha)))
      .map(({ fecha, titulo: delEvento, detalle, url }) => ({ fecha_texto: diaArgentino(fecha), titulo: delEvento, detalle, url }))
  }))
  .filter((grupo) => grupo.eventos.length > 0);

const archivoDelDetalle = (campo, nombre, bytes) => {
  const { rotulo, formato, se_puede_ver } = ARCHIVOS_DEL_DETALLE[campo];
  return { campo, rotulo, nombre, detalle: `${formato}${tamanoTexto(bytes)}`, se_puede_ver };
};

// Los bytes de metadata en UTF-8 (el texto guardado, que la descarga devuelve tal cual)
const bytesDeMetadata = (metadata) => (Buffer.isBuffer(metadata) ? metadata.length : Buffer.byteLength(String(metadata), 'utf8'));

// La repetición de una propuesta en el detalle (spec 2026-11-14-dato-quincena-v1-3, 3): null sin ella; si no, sus dos textos y
// `id_edicion`, el id de la regular de esa fecha solo si está en `previas` y es anterior a la edición (si no, null)
const repeticionDelDetalle = (propuesta, fechaDeLaEdicion, previas) => {
  const repeticionDeLaPropuesta = repeticionDe(propuesta);
  if (repeticionDeLaPropuesta === null) return null;
  const fechaPrevia = repeticionDeLaPropuesta.fecha_edicion_previa;
  const previa = fechaPrevia < fechaDeLaEdicion ? previas.get(fechaPrevia) : undefined;
  return { ...textosDeLaRepeticion(repeticionDeLaPropuesta), id_edicion: previa?.id ?? null };
};

// Una propuesta del detalle: su orden (el número del JSON, que usan la dirección y el índice de la página; el mail lo deja afuera),
// sus textos como llegaron, las etiquetas como se muestran, la foto del RPAD, la repetición, lo que se copia y el enlace al dataset
// (`enlaces`: el dataset_id de cada orden cuyo dataset existe y está activo). principal mira el valor del JSON
const propuestaDelDetalle = (propuesta, enlaces, fechaDeLaEdicion, previas) => ({
  orden: propuesta.orden,
  orden_texto: `Propuesta ${propuesta.orden}`,
  etiquetas: propuesta.etiquetas.map(etiquetaParaMostrar),
  principal: propuesta.etiquetas.includes('Principal'),
  titulo: propuesta.titulo,
  cifra_clave: propuesta.cifra_clave,
  dataset: { nombre: propuesta.dataset.nombre, id_enlace: enlaces.get(propuesta.orden) ?? null, url: propuesta.dataset.url },
  foto: fotoDelDataset(propuesta.rpad_snapshot),
  repeticion: repeticionDelDetalle(propuesta, fechaDeLaEdicion, previas),
  notas_validacion: [...propuesta.notas_validacion],
  calculo: propuesta.calculo,
  contexto_historico: propuesta.contexto_historico,
  por_que_hoy: propuesta.por_que_hoy,
  angulo: propuesta.angulo,
  idea_placa: propuesta.idea_placa,
  texto_redes: propuesta.texto_redes,
  puntos_centrales: [...propuesta.puntos_centrales],
  borrador_nota: { titulo: propuesta.borrador_nota.titulo, parrafos: [...propuesta.borrador_nota.parrafos] },
  fuentes: [...propuesta.fuentes],
  para_copiar: textoParaCopiar(propuesta),
  borrador_para_copiar: borradorParaCopiar(propuesta.borrador_nota)
});

// La prioridad de una propuesta de dataset (spec 2026-11-18-dato-quincena-propuestas-datasets, 2): la matriz de valor y riesgo de la
// Guía Práctica de Apertura de Datos, por valor y después por riesgo. Valor Medio con riesgo Alto da «Evaluar riesgos»: lo decidió el
// usuario, porque el borrador de Datito no lo cubría. Valor Bajo con riesgo Alto no llega (el POST lo rechaza): evaluar. Datito copia
// la misma tabla en su chequeo: si cambia, cambia en los dos lados
const TEXTO_DE_LA_PRIORIDAD = Object.freeze({
  alta: 'Prioridad alta',
  si_hay_recursos: 'Publicar si hay recursos',
  evaluar: 'Evaluar riesgos'
});
const MATRIZ_DE_PRIORIDAD = Object.freeze({
  Alto: Object.freeze({ Bajo: 'alta', Medio: 'evaluar', Alto: 'evaluar' }),
  Medio: Object.freeze({ Bajo: 'si_hay_recursos', Medio: 'si_hay_recursos', Alto: 'evaluar' }),
  Bajo: Object.freeze({ Bajo: 'si_hay_recursos', Medio: 'si_hay_recursos', Alto: 'evaluar' })
});

/**
 * La prioridad de un valor y un riesgo ('Alto', 'Medio' o 'Bajo'): `{ clave, texto }`, con la clave `alta`, `si_hay_recursos` o
 * `evaluar` (la página y el mail eligen el color por la clave, nunca por el texto). No se guarda: se calcula al mostrar, de la
 * edición archivada. Un valor o un riesgo que no es de la tabla (no pasa el POST) da evaluar, sin tirar.
 */
export const prioridadDeDataset = (valor, riesgo) => {
  const clave = NIVELES.includes(valor) && NIVELES.includes(riesgo) ? MATRIZ_DE_PRIORIDAD[valor][riesgo] : 'evaluar';
  return { clave, texto: TEXTO_DE_LA_PRIORIDAD[clave] };
};

// La matriz de la pestaña Datasets nuevos (spec 2026-11-18-dato-quincena-detalle-pestanas, 6): riesgo en filas y valor en columnas,
// en este orden. El rótulo de cada zona va en una sola celda, la de la maqueta aprobada (riesgo, valor); en las demás, la página lo
// pone como texto oculto
const RIESGOS_DE_LA_MATRIZ = Object.freeze(['Alto', 'Medio', 'Bajo']);
const VALORES_DE_LA_MATRIZ = Object.freeze(['Bajo', 'Medio', 'Alto']);
const CELDAS_CON_ROTULO = Object.freeze(['Alto Bajo', 'Alto Alto', 'Medio Bajo', 'Bajo Alto']);

/**
 * Las 9 celdas de la matriz de valor y riesgo, en su orden (riesgo Alto, Medio y Bajo; en cada uno, valor Bajo, Medio y Alto), cada
 * una `{ valor, riesgo, clave, texto, con_rotulo }`, con la prioridad de `prioridadDeDataset`. Valor Bajo con riesgo Alto no se
 * propone (el POST lo rechaza): `no_se_propone`, «No se propone». La página la dibuja tal cual: no copia la tabla. Cada vez una lista
 * nueva.
 */
export const matrizDePrioridad = () => RIESGOS_DE_LA_MATRIZ.flatMap((riesgo) => VALORES_DE_LA_MATRIZ.map((valor) => ({
  valor,
  riesgo,
  ...(valor === 'Bajo' && riesgo === 'Alto' ? { clave: 'no_se_propone', texto: 'No se propone' } : prioridadDeDataset(valor, riesgo)),
  con_rotulo: CELDAS_CON_ROTULO.includes(`${riesgo} ${valor}`)
})));

// La dirección de un dataset del portal: se arma solo con el slug, que el POST ya validó (letras minúsculas, números, - y _)
const DATASET_DEL_PORTAL = 'https://datos.comodoro.gov.ar/dataset/';

/**
 * Las propuestas de datasets nuevos de una edición ya validada, para el detalle (spec 2026-11-18-dato-quincena-propuestas-datasets,
 * 4): null si la edición no trae la clave (todas las archivadas antes de la v1.4 y las v1.3), [] si llegó vacía y, si no, cada una
 * con sus textos ya armados: «Dataset nuevo N», la prioridad (`prioridadDeDataset`), «Valor alto · Riesgo bajo» con los dos en
 * minúscula y cada dataset relacionado `{ nombre, url }`, con la dirección del portal y su slug. El número, el valor y el riesgo,
 * como llegaron, para el marcador de la matriz (spec 2026-11-18-dato-quincena-detalle-pestanas, 6). Los demás textos, como llegaron
 * (el HTML lo escapa quien imprime). No cambia la edición: las listas y los objetos son copias.
 */
export const propuestasDatasetsDelDetalle = (edicion) => (Array.isArray(edicion.propuestas_datasets)
  ? edicion.propuestas_datasets.map((propuesta) => ({
    numero: propuesta.numero,
    numero_texto: `Dataset nuevo ${propuesta.numero}`,
    titulo: propuesta.titulo,
    origenes: [...propuesta.origenes],
    justificacion: propuesta.justificacion,
    prioridad: prioridadDeDataset(propuesta.valor, propuesta.riesgo),
    valor: propuesta.valor,
    riesgo: propuesta.riesgo,
    valor_y_riesgo: `Valor ${propuesta.valor.toLowerCase()} · Riesgo ${propuesta.riesgo.toLowerCase()}`,
    formato: propuesta.formato_sugerido,
    campos: [...propuesta.campos_sugeridos],
    anonimizacion: propuesta.anonimizacion,
    datasets_relacionados: propuesta.datasets_relacionados.map(({ ckan_slug, nombre }) => ({
      nombre, url: `${DATASET_DEL_PORTAL}${ckan_slug}`
    })),
    fuentes: [...propuesta.fuentes]
  }))
  : null);

// Los textos de las pestañas del detalle (spec 2026-11-18-dato-quincena-detalle-pestanas, 6), con su plural: el botón de la principal
// a Propuestas; y el aviso de General a Datasets nuevos y su botón, null sin datasets nuevos (sin la clave, n es null, o con [])
const textoDeVerPropuestas = (n) => (n === 1 ? 'Ver la propuesta' : `Ver las ${n} propuestas`);
const hayDatasetsNuevos = (n) => Number.isSafeInteger(n) && n > 0;
const avisoDeDatasetsNuevos = (n) => {
  if (!hayDatasetsNuevos(n)) return null;
  return n === 1
    ? `${NOMBRE_DEL_BOT} propone 1 dataset nuevo para abrir.`
    : `${NOMBRE_DEL_BOT} propone ${n} datasets nuevos para abrir.`;
};
const textoDeVerDatasetsNuevos = (n) => {
  if (!hayDatasetsNuevos(n)) return null;
  return n === 1 ? 'Ver el dataset nuevo' : 'Ver los datasets nuevos';
};

// La principal de Datito de una edición ya validada (spec 2026-11-21-dato-quincena-principal-equipo, 3): la que lleva la etiqueta
// Principal en el JSON (el POST deja una sola) o, si ninguna, la primera; sin propuestas (solo con un SQL a mano), null
const principalDeDatito = (propuestas) => propuestas.find((propuesta) => propuesta.etiquetas.includes('Principal'))
  ?? propuestas[0] ?? null;

// Lo de la principal de Datito en el detalle: su orden y sus textos (el rótulo de la portada, la pastilla de la propuesta, la marca del
// índice, y el pie y el alt de la infografía, que es la suya), con el nombre del bot. null sin propuestas
const principalDatitoDelDetalle = (propuesta) => (propuesta === null ? null : {
  orden: propuesta.orden,
  rotulo: `La principal de ${NOMBRE_DEL_BOT}`,
  pastilla: PRINCIPAL_DE_DATITO,
  marca: NOMBRE_DEL_BOT,
  infografia_pie: `La infografía de la principal de ${NOMBRE_DEL_BOT}.`,
  infografia_alt: `Infografía de la principal de ${NOMBRE_DEL_BOT}: ${propuesta.titulo}`
});

// «La eligió Persona Inventada el 23/11/2026 a las 10:12.», de la elección vigente: el nombre_completo de quien eligió (sin la cuenta,
// que se borró, «el equipo») y `elegida_at`, 'AAAA-MM-DD HH:MM:SS' ya en hora argentina (se guardó con ahoraArgentina), cortada como
// texto
const quienEligio = ({ nombre, elegida_at }) => {
  const quien = typeof nombre === 'string' && nombre.trim() !== '' ? nombre : 'el equipo';
  return `La eligió ${quien} el ${formatoCorto(elegida_at.slice(0, 10))} a las ${elegida_at.slice(11, 16)}.`;
};

/**
 * Lo de la principal del equipo en el detalle (spec 2026-11-21-dato-quincena-principal-equipo, 3), de la elección vigente
 * (`eleccion`, `{ orden, nombre, elegida_at }` de leerPrincipalDelEquipo, o null) y de la principal de Datito: el orden elegido, si
 * coincide con la de Datito, los rótulos, el resumen de la franja, la cifra (solo si es otra) y quién y cuándo. Sin elegir, o con un
 * orden que la edición no tiene (solo con un SQL a mano: la FK no lo deja), «todavía no la eligió.», sin cifra ni quién.
 */
const principalEquipoDelDetalle = (propuestas, deDatito, eleccion) => {
  const elegida = eleccion === null || eleccion === undefined
    ? null
    : propuestas.find((propuesta) => propuesta.orden === eleccion.orden) ?? null;
  const rotulos = { rotulo: PRINCIPAL_DEL_EQUIPO, pastilla: PRINCIPAL_DEL_EQUIPO, marca: 'Equipo' };
  if (elegida === null) {
    return { orden: null, coincide: false, ...rotulos, resumen: 'todavía no la eligió.', cifra_clave: null, quien: null };
  }
  const coincide = elegida === deDatito;
  return {
    orden: elegida.orden,
    coincide,
    ...rotulos,
    resumen: coincide
      ? `la misma de ${NOMBRE_DEL_BOT} (propuesta ${elegida.orden}).`
      : `Propuesta ${elegida.orden} · ${elegida.titulo}`,
    cifra_clave: coincide ? null : elegida.cifra_clave,
    quien: quienEligio(eleccion)
  };
};

// Los textos fijos del PUT de la principal del equipo (spec 2026-11-21-dato-quincena-principal-equipo, 2): un orden que no es el de
// una propuesta de la edición (400) y el 500. El 404 es el de las lecturas, «No existe esa edición.»
export const MENSAJES_PRINCIPAL_EQUIPO = Object.freeze({
  orden: 'Elegí una de las propuestas de la edición.',
  alGuardar: 'Error al guardar la principal del equipo'
});

/**
 * El mensaje de la elección guardada (spec 2026-11-21-dato-quincena-principal-equipo, 2): «Quedó…» si cambió y «… ya era…» si no;
 * «la de Datito» si el orden es el de la principal de Datito (`coincide`) y si no, «la propuesta N».
 */
export const mensajeDeLaEleccion = ({ orden, coincide, cambio }) => {
  const cual = coincide ? `de ${NOMBRE_DEL_BOT}` : `propuesta ${orden}`;
  return cambio ? `Quedó la ${cual} como principal del equipo.` : `La ${cual} ya era la principal del equipo.`;
};

// El orden más alto que puede tener una propuesta guardada: dato_quincena_propuestas.orden es un tinyint unsigned
const ORDEN_MAXIMO = 255;

// El `orden` del cuerpo del PUT: un número entero de 1 a ORDEN_MAXIMO, tal cual; otra cosa (un texto como '2', un 0, un decimal,
// null o nada), null. Si es el de una propuesta de la edición lo mira la base
export const ordenDeLaEleccion = (valor) => (Number.isSafeInteger(valor) && valor >= 1 && valor <= ORDEN_MAXIMO ? valor : null);

/**
 * El detalle de una edición (sección 9), de leerEdicion: `fila` (con `metadata`, el texto guardado, `recibida_ts`, los
 * segundos UNIX de recibida_at, y `numero`, cuántas regulares hay con su fecha o antes), `edicion` (el JSON.parse de metadata,
 * que hace el controlador), `guardadas` (`orden`, `dataset_id` y `dataset_activo` de cada propuesta) y `adjuntos` (`campo`,
 * `nombre` y `bytes`). Los textos ya armados: la fecha, la marca, el número de una regular, la llegada, el correo en hora
 * argentina y la cantidad; la nota de archivo, null si está vacía o con solo espacios; la agenda con su fecha dd/mm/aaaa y la
 * etiqueta de una efeméride, en el orden en que llegó (para una pestaña abierta con la página anterior), y `agenda_grupos`, la
 * misma agenda en sus grupos (gruposDeLaAgenda, con la fecha de la edición), que imprimen la página y el mail; cada propuesta con
 * `id_enlace` solo si su dataset existe y está activo; después, las propuestas de datasets (propuestasDatasetsDelDetalle: null sin
 * la clave); lo de las pestañas de la página (spec 2026-11-18-dato-quincena-detalle-pestanas, 6): la matriz (null sin la clave),
 * las cantidades, «Ver las N propuestas» y el aviso de los datasets nuevos con su botón (null sin la clave o con la lista vacía);
 * y los archivos en el orden de ARCHIVOS_DEL_DETALLE, con la edición completa al final y el nombre de cada descarga.
 * `correo` es `lineaDelCorreo`, la línea del envío del RPAD que arma el controlador (spec 2026-11-12-dato-quincena-correo, 6),
 * tal cual. Sin ella, la del correo del bot (textoDelCorreo): el modelo del mail arma el detalle y no la usa.
 * `previas` (spec 2026-11-14-dato-quincena-v1-3, 3) es el Map de leerEdicionesPrevias(fechasPrevias(edicion)), que leen `ver` y el
 * mail: da el id de la edición que repite cada propuesta. Sin él o con null (no se pudieron leer), ninguna repetición lleva enlace.
 * Al final, las dos principales (spec 2026-11-21-dato-quincena-principal-equipo, 3): `principal_datito` (principalDatitoDelDetalle) y
 * `principal_equipo` (principalEquipoDelDetalle), con `eleccion`, la elección vigente de leerPrincipalDelEquipo, que lee y pasa solo
 * el controlador `ver`: el mail no la pasa, y sin ella la del equipo sale sin elegir. `propuestas` no cambia: cada una sigue con la
 * principal de Datito.
 */
export const detalleDeLaEdicion = ({ fila, edicion, guardadas, adjuntos, lineaDelCorreo, previas, eleccion = null }) => {
  const lasPrevias = previas ?? new Map();
  const deDatito = principalDeDatito(edicion.propuestas);
  const enlaces = new Map(guardadas
    .filter((guardada) => guardada.dataset_activo === true && guardada.dataset_id !== null)
    .map((guardada) => [guardada.orden, guardada.dataset_id]));
  const nota = edicion.nota_archivo;
  const propuestasDatasets = propuestasDatasetsDelDetalle(edicion);
  const datasetsNuevos = propuestasDatasets === null ? null : propuestasDatasets.length;
  return {
    id: fila.id,
    fecha_texto: fechaLarga(fila.fecha_edicion),
    marca: marcaDePiloto(fila.tipo, fila.referencia_piloto),
    numero: numeroDe(fila),
    titulo: fila.titulo,
    nota_archivo: typeof nota === 'string' && nota.trim() !== '' ? nota : null,
    llegada: textoDeLlegada(fila.recibida_ts),
    correo: typeof lineaDelCorreo === 'string'
      ? lineaDelCorreo
      : textoDelCorreo(edicion.correo.enviado_at, edicion.correo.estado),
    cantidad: textoDeCantidad(edicion.propuestas.length),
    agenda: edicion.agenda.map(({ titulo, fecha, detalle, url, tipo }) => ({
      fecha_texto: diaArgentino(fecha), titulo, detalle, url, etiqueta: etiquetaDelEvento(tipo)
    })),
    agenda_grupos: gruposDeLaAgenda(edicion.agenda, edicion.fecha_edicion),
    propuestas: edicion.propuestas.map((propuesta) => propuestaDelDetalle(propuesta, enlaces, edicion.fecha_edicion, lasPrevias)),
    propuestas_datasets: propuestasDatasets,
    matriz_de_prioridad: propuestasDatasets === null ? null : matrizDePrioridad(),
    cantidades: { propuestas: edicion.propuestas.length, datasets_nuevos: datasetsNuevos },
    ver_propuestas: textoDeVerPropuestas(edicion.propuestas.length),
    aviso_datasets_nuevos: avisoDeDatasetsNuevos(datasetsNuevos),
    ver_datasets_nuevos: textoDeVerDatasetsNuevos(datasetsNuevos),
    archivos: [
      ...ORDEN_DE_LOS_ARCHIVOS_DEL_DETALLE.flatMap((campo) => adjuntos
        .filter((adjunto) => adjunto.campo === campo)
        .map((adjunto) => archivoDelDetalle(campo, adjunto.nombre, adjunto.bytes))),
      archivoDelDetalle('metadata', nombreDeLaEdicion(fila.clave), bytesDeMetadata(fila.metadata))
    ],
    principal_datito: principalDatitoDelDetalle(deDatito),
    principal_equipo: principalEquipoDelDetalle(edicion.propuestas, deDatito, eleccion)
  };
};
