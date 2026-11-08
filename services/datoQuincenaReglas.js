/**
 * El dato de la quincena (spec 2026-11-07-dato-quincena): las reglas puras del archivo de las ediciones de Grok Bot, sin pool
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
 */
import crypto from 'node:crypto';
import { esFechaIso, sumarDias, ahoraArgentina, formatoLargo, formatoCorto } from './notasDigitalesCalendario.js';
import { enLista } from './miEspacioReglas.js';
import { RPAD_URL } from './emailTemplates.js';

// El tope de cada parte del multipart y el del pedido entero (la suma más el margen del multipart), en bytes (sección 4)
export const TOPES = Object.freeze({
  metadata: 256 * 1024, infografia_png: 5 * 1024 * 1024, correo_texto: 256 * 1024, calculos: 256 * 1024
});
export const TOPE_DEL_PEDIDO = 6 * 1024 * 1024;

// Las partes del pedido, en el orden de la huella, y las que son archivos de la edición (las que describe el manifiesto)
export const PARTES = Object.freeze(['metadata', 'infografia_png', 'correo_texto', 'calculos']);
export const ARCHIVOS = Object.freeze(['infografia_png', 'correo_texto', 'calculos']);

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
  etiqueta: 'Las etiquetas posibles son Principal, Validar y Agenda.',
  etiquetaRepetida: 'Esta etiqueta ya está en la propuesta.',
  principal: 'Exactamente una propuesta tiene que llevar la etiqueta Principal.',
  enteroPositivo: 'Tiene que ser un número entero positivo.',
  estado: 'Tiene que ser uno de los estados de GET /api/datasets.',
  diasParaVencer: 'Tiene que ser un número entero de -100000 a 100000.',
  sha256: 'Tiene que ser un SHA-256 en hexadecimal: 64 caracteres en minúsculas.',
  agenda: 'La agenda puede traer hasta 20 eventos.',
  propuestas: 'La edición tiene que traer de 1 a 5 propuestas.',
  adjuntos: 'El manifiesto tiene que describir 2 o 3 archivos.',
  puntosCentrales: 'Tiene que traer de 3 a 5 puntos centrales.',
  parrafos: 'El borrador tiene que traer 2 o 3 párrafos.',
  notasValidacion: 'Puede traer hasta 20 notas de validación.',
  fuentes: 'Tiene que traer de 1 a 20 fuentes.',
  campo: 'El campo tiene que ser infografia_png, correo_texto o calculos.',
  campoRepetido: 'Este campo ya está en otra entrada del manifiesto.',
  sinParte: 'El pedido no trae la parte que describe esta entrada.',
  sinEntradaInfografia: 'El manifiesto no describe la parte infografia_png, que llegó en el pedido.',
  sinEntradaCorreo: 'El manifiesto no describe la parte correo_texto, que llegó en el pedido.',
  sinEntradaCalculos: 'El manifiesto no describe la parte calculos, que llegó en el pedido.',
  nombre: 'El nombre del archivo tiene que tener de 1 a 255 caracteres, sin /, \\ ni caracteres de control.',
  mime: 'El tipo tiene que ser image/png en la infografía, text/plain en el texto del correo y text/markdown o text/plain en '
    + 'los cálculos.',
  bytesDistintos: 'No coincide con el tamaño de la parte recibida.',
  sha256Distinto: 'No coincide con el SHA-256 de la parte recibida.',
  png: 'La infografía tiene que ser un PNG completo, de 1 a 4096 píxeles de ancho y de alto.',
  utf8: 'Tiene que ser un texto UTF-8 válido, sin el carácter nulo.'
});

const TIPOS = Object.freeze(['regular', 'piloto']);
const ETIQUETAS = Object.freeze(['Principal', 'Validar', 'Agenda']);
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

// Un texto con tope. Obligatorio: no vacío ni con solo espacios. Con oNull, null también vale (y un texto vacío)
const texto = (tope, { oNull = false } = {}) => (valor, ruta, agregar) => {
  if (oNull && valor === null) return;
  if (typeof valor !== 'string') return agregar(ruta, 'texto');
  if (!oNull && valor.trim() === '') return agregar(ruta, 'vacio');
  if (valor.includes('\u0000')) return agregar(ruta, 'caracterNulo');
  if (caracteres(valor) > tope) agregar(ruta, `hasta${tope}`);
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

// La propuesta i va con el orden i + 1
const propuesta = (_, indice) => ({
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
  fuentes: lista(1, 20, 'fuentes', direccion)
});

// Las propuestas y, si hay alguna, que exactamente una lleve Principal
const propuestas = (valor, ruta, agregar) => {
  lista(1, 5, 'propuestas', objeto(propuesta))(valor, ruta, agregar);
  if (!Array.isArray(valor) || valor.length === 0) return;
  const principales = valor.filter((p) => esObjeto(p) && Array.isArray(p.etiquetas) && p.etiquetas.includes('Principal'));
  if (principales.length !== 1) agregar(ruta, 'principal');
};

const EVENTO = Object.freeze({ titulo: texto(200), fecha, detalle: texto(4000), url: direccion });

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

// Grok Bot archiva la edición aunque el correo no haya salido (decisión del usuario): 'no_enviado' lleva la hora en null
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
    agenda: lista(0, 20, 'agenda', objeto(EVENTO)),
    propuestas,
    adjuntos: lista(2, 3, 'adjuntos', objeto(ENTRADA_DEL_MANIFIESTO))
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

// Lo que se pide de cada archivo de la edición: los MIME que puede declarar su entrada, cómo se mira su contenido y los
// mensajes
const ARCHIVO = Object.freeze({
  infografia_png: { mimes: ['image/png'], contenido: esPng, otroContenido: 'png', sinEntrada: 'sinEntradaInfografia' },
  correo_texto: { mimes: ['text/plain'], contenido: esTextoUtf8, otroContenido: 'utf8', sinEntrada: 'sinEntradaCorreo' },
  calculos: {
    mimes: ['text/markdown', 'text/plain'], contenido: esTextoUtf8, otroContenido: 'utf8', sinEntrada: 'sinEntradaCalculos'
  }
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
 * Los errores del manifiesto (edicion.adjuntos) contra las partes recibidas, `{ infografia_png, correo_texto, calculos? }`:
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

// La huella del paquete (sección 6): el SHA-256 de un renglón por parte, en el orden de PARTES, con el SHA-256 de sus bytes
// o - si no llegó. No depende del orden en que llegaron
export const huellaDelPaquete = (partes) => sha256(PARTES
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

// 'Viernes 6 de noviembre de 2026': el día de la semana sale de las partes con Date.UTC, no del reloj local. Lo que no es
// una fecha que existe, '—'
export const fechaLarga = (iso) => {
  if (!esFechaIso(iso)) return '—';
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${DIAS_DE_LA_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()]} ${formatoLargo(iso)}`;
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
  if (estado === 'no_enviado') return 'Grok Bot archivó esta edición sin que saliera el correo.';
  const hora = horaArgentina(enviadoAt);
  return hora === null
    ? 'Correo enviado según Grok Bot, sin la hora.'
    : `Correo enviado el ${hora.fecha} a las ${hora.hora}, según Grok Bot.`;
};

// «1 propuesta» o «5 propuestas»
export const textoDeCantidad = (n) => (n === 1 ? '1 propuesta' : `${n} propuestas`);

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

// El borrador para copiar (sección 9): el título y sus párrafos, separados por un renglón en blanco
export const borradorParaCopiar = ({ titulo, parrafos }) => [titulo, ...parrafos].join('\n\n');

/**
 * La propuesta entera para copiar (sección 9), en texto plano: bloques separados por un renglón en blanco, los renglones de
 * un bloque con \n y los textos tal como llegaron. Sin etiquetas, el título va solo; sin notas de validación, ese bloque no
 * va. La foto va en un renglón, cada fila como «<rotulo> <valor>.».
 */
export const textoParaCopiar = (propuesta) => {
  const { titulo, etiquetas, dataset, notas_validacion: notas } = propuesta;
  return [
    etiquetas.length > 0 ? `${titulo} [${etiquetas.join(', ')}]` : titulo,
    propuesta.cifra_clave,
    `Dataset: ${dataset.nombre}\n${dataset.url}`,
    fotoDelDataset(propuesta.rpad_snapshot).map(({ rotulo, valor }) => `${rotulo} ${valor}.`).join(' '),
    ...(notas.length > 0 ? [bloqueConGuiones('Para validar antes de publicar', notas)] : []),
    `Cómo se calculó\n${propuesta.calculo}`,
    `Contexto histórico\n${propuesta.contexto_historico}`,
    `Por qué hoy\n${propuesta.por_que_hoy}`,
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
 * Los avisos del recibo (sección 7), en el orden de las propuestas: uno por cada propuesta que cita un dataset (rpad_id) y
 * quedó guardada sin enlace (dataset_id null en `guardadas = [{ orden, dataset_id }]`, las filas guardadas). Sirven igual
 * para el 201 y para el 200 de una repetida, que los arma de nuevo desde lo guardado.
 */
export const avisosDeLaEdicion = (edicion, guardadas) => {
  const enlaces = new Map(guardadas.map(({ orden, dataset_id }) => [orden, dataset_id ?? null]));
  return edicion.propuestas
    .filter((propuesta) => propuesta.dataset.rpad_id !== null && (enlaces.get(propuesta.orden) ?? null) === null)
    .map((propuesta) => textoDelAviso(propuesta.orden, propuesta.dataset.rpad_id));
};

/**
 * El recibo del 201 y del 200 (sección 7), de la edición guardada: `recibida_ts` son los segundos UNIX de recibida_at
 * (UNIX_TIMESTAMP), así el 201 y el 200 dicen lo mismo; `adjuntos`, sus archivos, que salen en el orden de ARCHIVOS y solo
 * con campo, bytes y sha256; `avisos`, los de avisosDeLaEdicion.
 */
export const reciboDe = ({ id, clave, tipo, fecha_edicion, huella, recibida_ts }, adjuntos, avisos, repetida) => ({
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
  avisos
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
  correo_texto: 'text/plain; charset=utf-8',
  calculos: 'text/plain; charset=utf-8',
  metadata: 'application/json; charset=utf-8'
});

/**
 * Una edición de la lista, de una fila de listarEdiciones: la fecha larga, la marca del piloto, el título y la cifra de la
 * principal, y el resto de las propuestas por el nombre de su dataset, en su orden. Sin ninguna marcada como principal (el POST
 * no lo deja pasar), la primera; sin propuestas (solo un SQL a mano), principal null.
 */
export const itemDeLaLista = ({ id, tipo, fecha_edicion, referencia_piloto, propuestas }) => {
  const enOrden = [...propuestas].sort((a, b) => a.orden - b.orden);
  const principal = enOrden.find((propuesta) => propuesta.principal) ?? enOrden[0] ?? null;
  return {
    id,
    fecha_texto: fechaLarga(fecha_edicion),
    marca: marcaDePiloto(tipo, referencia_piloto),
    principal: principal === null ? null : { titulo: principal.titulo, cifra_clave: principal.cifra_clave },
    resto: textoDelResto(enOrden.filter((propuesta) => propuesta !== principal).map((propuesta) => propuesta.dataset_nombre))
  };
};

// Cada archivo del detalle: su rótulo, lo que va antes del tamaño y si la página lo deja ver
const ARCHIVOS_DEL_DETALLE = Object.freeze({
  infografia_png: Object.freeze({ rotulo: 'Infografía', formato: 'PNG · ', se_puede_ver: false }),
  correo_texto: Object.freeze({ rotulo: 'Texto del correo', formato: '', se_puede_ver: true }),
  calculos: Object.freeze({ rotulo: 'Cálculos', formato: '', se_puede_ver: true }),
  metadata: Object.freeze({ rotulo: 'La edición completa', formato: 'JSON · ', se_puede_ver: false })
});

const archivoDelDetalle = (campo, nombre, bytes) => {
  const { rotulo, formato, se_puede_ver } = ARCHIVOS_DEL_DETALLE[campo];
  return { campo, rotulo, nombre, detalle: `${formato}${tamanoTexto(bytes)}`, se_puede_ver };
};

// Los bytes de metadata en UTF-8 (el texto guardado, que la descarga devuelve tal cual)
const bytesDeMetadata = (metadata) => (Buffer.isBuffer(metadata) ? metadata.length : Buffer.byteLength(String(metadata), 'utf8'));

// Una propuesta del detalle: sus textos como llegaron, la foto del RPAD, lo que se copia y el enlace al dataset (`enlaces`: el
// dataset_id de cada orden cuyo dataset existe y está activo)
const propuestaDelDetalle = (propuesta, enlaces) => ({
  orden_texto: `Propuesta ${propuesta.orden}`,
  etiquetas: [...propuesta.etiquetas],
  principal: propuesta.etiquetas.includes('Principal'),
  titulo: propuesta.titulo,
  cifra_clave: propuesta.cifra_clave,
  dataset: { nombre: propuesta.dataset.nombre, id_enlace: enlaces.get(propuesta.orden) ?? null, url: propuesta.dataset.url },
  foto: fotoDelDataset(propuesta.rpad_snapshot),
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

/**
 * El detalle de una edición (sección 9), de leerEdicion: `fila` (con `metadata`, el texto guardado, y `recibida_ts`, los
 * segundos UNIX de recibida_at), `edicion` (el JSON.parse de metadata, que hace el controlador), `guardadas` (`orden`,
 * `dataset_id` y `dataset_activo` de cada propuesta) y `adjuntos` (`campo`, `nombre` y `bytes`). Los textos ya armados: la
 * fecha, la marca, la llegada, el correo en hora argentina y la cantidad; la nota de archivo, null si está vacía o con solo
 * espacios; la agenda con su fecha dd/mm/aaaa; cada propuesta con `id_enlace` solo si su dataset existe y está activo; y los
 * archivos en el orden de ARCHIVOS, con la edición completa al final y el nombre de cada descarga.
 */
export const detalleDeLaEdicion = ({ fila, edicion, guardadas, adjuntos }) => {
  const enlaces = new Map(guardadas
    .filter((guardada) => guardada.dataset_activo === true && guardada.dataset_id !== null)
    .map((guardada) => [guardada.orden, guardada.dataset_id]));
  const nota = edicion.nota_archivo;
  return {
    id: fila.id,
    fecha_texto: fechaLarga(fila.fecha_edicion),
    marca: marcaDePiloto(fila.tipo, fila.referencia_piloto),
    titulo: fila.titulo,
    nota_archivo: typeof nota === 'string' && nota.trim() !== '' ? nota : null,
    llegada: textoDeLlegada(fila.recibida_ts),
    correo: textoDelCorreo(edicion.correo.enviado_at, edicion.correo.estado),
    cantidad: textoDeCantidad(edicion.propuestas.length),
    agenda: edicion.agenda.map(({ titulo, fecha, detalle, url }) => ({ fecha_texto: diaArgentino(fecha), titulo, detalle, url })),
    propuestas: edicion.propuestas.map((propuesta) => propuestaDelDetalle(propuesta, enlaces)),
    archivos: [
      ...ARCHIVOS.flatMap((campo) => adjuntos
        .filter((adjunto) => adjunto.campo === campo)
        .map((adjunto) => archivoDelDetalle(campo, adjunto.nombre, adjunto.bytes))),
      archivoDelDetalle('metadata', nombreDeLaEdicion(fila.clave), bytesDeMetadata(fila.metadata))
    ]
  };
};
