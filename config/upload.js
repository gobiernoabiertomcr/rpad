// Las subidas de Proyectos (spec 2026-10-25-proyectos, 6 a 9): los documentos de un proyecto y los archivos de un hito o un logro.
// Van a uploads/proyectos/<id>/ y uploads/hitos/<id>/ (o a UPLOADS_DIR, si está: los tests usan una carpeta temporal), con un nombre
// único en el disco (un UUID con la extensión).
// La subida no deja archivos huérfanos ni escribe fuera de uploads/ (arreglos 2 y 3):
// - antes de multer, `prepararSubidaProyecto` y `prepararSubidaHito` (controllers/proyectosController.js) validan el id, que el proyecto
//   (activo) o el hito existan y que queden lugares, y dejan `req.subida = { id, carpeta, lugares }`, con la carpeta armada con el id
//   ya validado;
// - `subida(tipo)` arma multer en cada pedido con `limits.files` = los lugares que quedan, un filtro y un almacén propios de ese pedido.
//   Multer solo no alcanza (multer 1.4.5, make-middleware.js): después de un error toma una sola vez la lista de lo que borra y sigue
//   recibiendo partes hasta que termina, así que un archivo que llegaba después se escribía (entero o a medias, con el archivo abierto).
//   Acá, después del primer error el filtro descarta todo lo que sigue sin escribirlo; el almacén anota cada archivo que empieza a
//   escribir y, si la subida falla, se borran todos: la carpeta queda exactamente como estaba (salvo que no existiera: queda vacía);
// - ante un error, el pedido se termina de leer antes de responder: si no, quien todavía estaba mandando recibía un corte de la conexión
//   en lugar del 400 con el motivo (la página lo muestra: «El hito se guardó, pero los archivos no se subieron: <motivo>.»);
// - si después falla la transacción de los INSERT, el controlador borra los archivos escritos.
// Los límites, las extensiones y los mensajes se exportan para que la página (public/js/proyectos.js) los copie, atados por un test.
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { nombreDeArchivo } from '../services/proyectosReglas.js';
import { TOPES, TOPE_DEL_PEDIDO, PARTES } from '../services/datoQuincenaReglas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// La carpeta de las subidas: UPLOADS_DIR (absoluta) si está, o uploads/ junto a la aplicación
const UPLOADS_BASE = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));
const BASE_CON_SEPARADOR = UPLOADS_BASE.endsWith(path.sep) ? UPLOADS_BASE : `${UPLOADS_BASE}${path.sep}`;

// Las extensiones y los tipos MIME permitidos, en el orden de siempre. Se valida la extensión y el MIME (doble control)
export const EXTENSIONES_PERMITIDAS = Object.freeze([
  '.pdf', '.docx', '.xlsx', '.csv', '.odt', '.ods',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip', '.rar', '.7z'
]);

export const MIMES_PERMITIDOS = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Los otros MIME con que llega un .csv (Ruling R15): Windows con Excel instalado lo manda como application/vnd.ms-excel; Linux y
  // Android, como text/x-csv, application/csv o text/comma-separated-values. Se sirven como adjunto y con nosniff: el riesgo es nulo
  'application/vnd.ms-excel',
  'text/x-csv',
  'application/csv',
  'text/comma-separated-values',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream' // Algunos navegadores mandan este; se acepta solo con una extensión permitida
]);

export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB por archivo
export const MAXIMO_POR_HITO = 3;
export const MAXIMO_POR_PROYECTO = 10;

// Los mensajes, los mismos en el servidor y en la página
export const MENSAJE_MAXIMO_POR_HITO = 'Podés subir hasta 3 archivos por hito.';
export const MENSAJE_MAXIMO_POR_PROYECTO = 'Podés subir hasta 10 documentos por proyecto.';
export const MENSAJE_TAMANO_MAXIMO = 'El archivo excede el tamaño máximo de 10 MB';
export const mensajeTipoNoPermitido = (extension) => `Tipo de archivo no permitido: ${extension}`;
// El MIME no se controla en el navegador (Ruling R15): este mensaje lo muestra la página tal como lo manda el servidor
export const mensajeMimeNoPermitido = (nombre) => `El tipo de archivo de ${nombre} no está permitido.`;
// Un pedido que no se pudo leer (un multipart mal armado o cortado, o uno que pasa los límites de multer en las partes o los campos)
export const MENSAJE_SUBIDA_ILEGIBLE = 'No se pudo leer la subida. Probá de nuevo.';
export const MENSAJE_ARCHIVO_FALTANTE = 'El archivo no está en el servidor.';

const EXTENSIONES = new Set(EXTENSIONES_PERMITIDAS);
const MIMES = new Set(MIMES_PERMITIDOS);

// Lo de cada tipo de subida: el campo del formulario es siempre «archivos»
const SUBIDAS = Object.freeze({
  proyecto: Object.freeze({ maximo: MAXIMO_POR_PROYECTO, mensaje: MENSAJE_MAXIMO_POR_PROYECTO }),
  hito: Object.freeze({ maximo: MAXIMO_POR_HITO, mensaje: MENSAJE_MAXIMO_POR_HITO })
});

/**
 * La ruta absoluta de `relativa` dentro de la carpeta de las subidas, o null si queda afuera (o es la carpeta misma): compara con el
 * separador al final, así «uploads-otra» no pasa por «uploads». Lo que no es un texto, o trae un carácter nulo, da null.
 */
export const rutaSegura = (relativa) => {
  if (typeof relativa !== 'string' || relativa === '' || relativa.includes('\0')) return null;
  const ruta = path.resolve(UPLOADS_BASE, relativa);
  return ruta.startsWith(BASE_CON_SEPARADOR) ? ruta : null;
};

// Crea (si no existe) una carpeta dentro de la de las subidas y devuelve su ruta absoluta. Tira si queda afuera
export const ensureUploadDir = (subpath) => {
  const dir = rutaSegura(subpath);
  if (dir === null) throw new Error('La carpeta queda fuera de la de las subidas');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// El campo del formulario que trae los archivos
const CAMPO = 'archivos';

// Un error que se le muestra a quien subió: un 400 con su mensaje (el tipo de archivo)
class ErrorDeSubida extends Error {}

// Un error del disco (crear la carpeta o escribir el archivo): un 500 con un mensaje fijo; el error completo, solo en la consola
class ErrorDeDisco extends Error {}
const esDelDisco = (error) => error instanceof ErrorDeDisco || typeof error.syscall === 'string';

/**
 * Responde [status, cuerpo] cuando el pedido terminó de llegar: lo que sigue llegando se lee y se descarta. Si se responde con el cuerpo
 * sin leer, quien todavía está mandando archivos puede recibir un corte de la conexión en lugar de la respuesta. Si quien subía cortó,
 * no hay a quién responder. Lo usan las respuestas de error de una subida, también las de prepararSubida… (antes de leer nada).
 */
export const responderAlTerminarDeLeer = (req, res, status, cuerpo) => {
  const responder = () => {
    if (!res.headersSent) res.status(status).json(cuerpo);
  };
  if (req.readableEnded) return responder();
  req.once('end', responder);
  req.resume();
};

// Un Content-Length que se puede comparar (Node ya rechaza uno mal formado; esto es solo por las dudas)
const CONTENT_LENGTH = /^\d{1,16}$/;

/**
 * Responde [status, cuerpo] a un pedido que todavía no se leyó y puede ser de un desconocido: el 429, el 401 y el 503 del dato
 * de la quincena, y los 400 y 413 de su lectura. Con un Content-Length de hasta TOPE_DEL_PEDIDO, como responderAlTerminarDeLeer
 * (se termina de leer y se responde, así quien mandaba recibe la respuesta y no un corte). Sin Content-Length (chunked) o con
 * uno mayor, no se lee sin fin: se responde enseguida con Connection: close (Node cierra la conexión al terminar la respuesta) y
 * lo que llegue mientras tanto se descarta.
 */
export const responderAntesDeLeer = (req, res, status, cuerpo) => {
  const largo = req.headers['content-length'];
  if (typeof largo === 'string' && CONTENT_LENGTH.test(largo) && Number(largo) <= TOPE_DEL_PEDIDO) {
    return responderAlTerminarDeLeer(req, res, status, cuerpo);
  }
  if (!res.headersSent) res.set('Connection', 'close').status(status).json(cuerpo);
  req.resume();
};

/**
 * El filtro de un pedido. Después del primer error (este u otro: `estado.fallo`), descarta sin escribir todo lo que sigue llegando
 * (`cb(null, false)`: multer lo lee y lo tira). Si no, arregla el nombre original una sola vez, la primera vez que multer da el archivo (de
 * latin1 a UTF-8 y cortado en 255: nombreDeArchivo; así el mensaje de la extensión y lo que se guarda usan el mismo nombre), y controla
 * el campo (otro campo es LIMIT_UNEXPECTED_FILE, como lo daría multer), la extensión y el MIME.
 */
const filtroDe = (estado) => (req, file, cb) => {
  if (estado.fallo) return cb(null, false);
  const rechazar = (error) => {
    estado.fallo = true;
    cb(error);
  };
  file.originalname = nombreDeArchivo(file.originalname);
  if (file.fieldname !== CAMPO) return rechazar(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  const extension = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONES.has(extension)) return rechazar(new ErrorDeSubida(mensajeTipoNoPermitido(extension)));
  if (!MIMES.has(file.mimetype)) return rechazar(new ErrorDeSubida(mensajeMimeNoPermitido(file.originalname)));
  cb(null, true);
};

/**
 * El almacén de multer de un pedido (como diskStorage, con un nombre único: un UUID con la extensión). Anota en `estado.escritos` cada
 * archivo antes de empezar a escribirlo, así una subida que falla los borra todos, también uno que multer no llegó a anotar. Un archivo
 * que pasa los 10 MB o un error del disco prenden `estado.fallo` (lo que sigue se descarta). Si el archivo que llega se corta (un error del
 * pedido), cierra lo que estaba escribiendo: multer ya cuenta ese error y no espera a este almacén.
 */
const almacenDe = (carpeta, estado) => ({
  _handleFile: (req, file, cb) => {
    let destino;
    try {
      destino = ensureUploadDir(carpeta);
    } catch (error) {
      estado.fallo = true;
      file.stream.resume();
      return cb(new ErrorDeDisco(error.message, { cause: error }));
    }
    const filename = `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
    const ruta = path.join(destino, filename);
    estado.escritos.push(ruta);
    const salida = fs.createWriteStream(ruta);
    let respondido = false;
    const terminar = (error, info) => {
      if (respondido) return;
      respondido = true;
      cb(error, info);
    };
    file.stream.once('limit', () => {
      estado.fallo = true;
    });
    file.stream.once('error', () => {
      estado.fallo = true;
      respondido = true;
      salida.destroy();
    });
    salida.once('error', (error) => {
      estado.fallo = true;
      file.stream.unpipe(salida);
      file.stream.resume();
      terminar(new ErrorDeDisco(error.message, { cause: error }));
    });
    salida.once('finish', () => terminar(null, { destination: destino, filename, path: ruta, size: salida.bytesWritten }));
    file.stream.pipe(salida);
  },
  _removeFile: (req, file, cb) => {
    fs.rm(file.path, { force: true }, cb);
  }
});

// Borra del disco los archivos que empezó a escribir un pedido (rutas armadas por el almacén, dentro de la carpeta de las subidas). Si no
// están, no pasa nada; otro error se registra
const borrarEscritos = (rutas) => Promise.all(rutas.map((ruta) => fs.promises.rm(ruta, { force: true }).catch((error) => {
  console.error(`No se pudo borrar ${ruta} del disco:`, error);
})));

// El [status, cuerpo] de un error de multer, en español. Un pedido que no se pudo leer es un 400 con MENSAJE_SUBIDA_ILEGIBLE (el texto de
// multer o de busboy, en inglés, solo en la consola)
const respuestaDeError = (error, tipo, mensaje) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return [400, { success: false, error: MENSAJE_TAMANO_MAXIMO }];
  if (error instanceof multer.MulterError && (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE')) {
    return [400, { success: false, error: mensaje }];
  }
  if (error instanceof ErrorDeSubida) return [400, { success: false, error: error.message }];
  if (esDelDisco(error)) {
    console.error(`Error al guardar los archivos (${tipo}) en el disco:`, error);
    return [500, { success: false, error: 'Error al subir archivos' }];
  }
  console.error(`Subida de ${tipo} que no se pudo leer:`, error?.message ?? error);
  return [400, { success: false, error: MENSAJE_SUBIDA_ILEGIBLE }];
};

/**
 * El middleware de multer de una subida (`tipo`: 'proyecto' o 'hito'), armado en cada pedido con lo que dejó prepararSubida…: la
 * carpeta (ya con el id validado) y los lugares que quedan como límite de archivos (busboy no entrega los de más). Los errores salen en
 * español: los de cantidad (LIMIT_FILE_COUNT y un archivo en otro campo, LIMIT_UNEXPECTED_FILE), el del tamaño, el de la extensión, el
 * del MIME y un pedido que no se pudo leer son 400; uno del disco, 500. Ante cualquier error: se borra todo lo que este pedido empezó a
 * escribir, se termina de leer el pedido y se responde.
 */
export const subida = (tipo) => {
  const { maximo, mensaje } = SUBIDAS[tipo];
  return (req, res, next) => {
    const { carpeta, lugares } = req.subida ?? {};
    if (typeof carpeta !== 'string' || !Number.isInteger(lugares) || lugares < 1 || lugares > maximo) {
      console.error(`Subida de ${tipo} sin preparar:`, req.subida);
      return responderAlTerminarDeLeer(req, res, 500, { success: false, error: 'Error al subir archivos' });
    }
    const estado = { fallo: false, escritos: [] };
    // .any(): el campo y la cantidad los controlan el filtro y limits.files (con .array, multer rechazaba un archivo de otro campo antes
    // del filtro, y el filtro no se enteraba del error)
    const leer = multer({
      storage: almacenDe(carpeta, estado), fileFilter: filtroDe(estado), limits: { fileSize: TAMANO_MAXIMO, files: lugares }
    }).any();
    leer(req, res, async (error) => {
      if (!error) return next();
      estado.fallo = true;
      await borrarEscritos(estado.escritos);
      const [status, cuerpo] = respuestaDeError(error, tipo, mensaje);
      responderAlTerminarDeLeer(req, res, status, cuerpo);
    });
  };
};

// El PDF firmado de una Nota Digital (spec 2026-11-03-notas-firma-digital, 4.5): un solo archivo, en memoria (va a la base), de hasta 10 MB.
// Cuál es lo decide su contenido: ni el nombre ni el MIME cuentan. Los errores, en español, como los de arriba
export const MENSAJE_UN_SOLO_PDF = 'Subí un solo PDF por nota.';
const leerNotaFirmada = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANO_MAXIMO, files: 1 } }).single('archivo');
export const subidaDeNotaFirmada = (req, res, next) => {
  leerNotaFirmada(req, res, (error) => {
    if (!error) return next();
    const [status, cuerpo] = respuestaDeError(error, 'nota firmada', MENSAJE_UN_SOLO_PDF);
    responderAlTerminarDeLeer(req, res, status, cuerpo);
  });
};

// =====================================================
// El dato de la quincena (spec 2026-11-07-dato-quincena, 4 y 7): el POST de Grok Bot, un multipart de hasta cuatro partes, en
// memoria (van a la base)
// =====================================================

// Las partes que tienen que llegar, en el orden en que se nombra la que falta, y cómo se nombra el tope de cada una (sección 4)
const OBLIGATORIAS = Object.freeze(['metadata', 'infografia_png', 'correo_texto']);
const TOPE_EN_TEXTO = Object.freeze({ metadata: '256 KB', infografia_png: '5 MB', correo_texto: '256 KB', calculos: '256 KB' });

const noSePudoLeer = (motivo) => `No se pudo leer la edición: ${motivo}.`;
const superaSuTope = (parte) => `La parte ${parte} supera el tamaño permitido (${TOPE_EN_TEXTO[parte]}).`;

// [status, error, motivo corto para la consola] de un error de multer o de busboy. Su texto (en inglés) no se repite
const rechazoDeLaLectura = (error) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE' && PARTES.includes(error.field)) return [413, superaSuTope(error.field), 'tope'];
    if (error.code === 'LIMIT_FIELD_COUNT') return [400, noSePudoLeer('todas las partes van como archivo'), 'campo de texto'];
    if (error.code === 'LIMIT_PART_COUNT' || error.code === 'LIMIT_FILE_COUNT') {
      return [400, noSePudoLeer('sobran partes'), 'sobran partes'];
    }
  }
  return [400, noSePudoLeer('el pedido está mal armado'), 'mal armado'];
};

// [status, error, motivo] de lo que se leyó sin errores de multer (`partes`, un Map del nombre a sus bytes), o null si sirve.
// El primero que valga: una parte con otro nombre, una repetida, una obligatoria que falta, una que pasa su tope
const rechazoDeLasPartes = (estado, partes) => {
  if (estado.otra) return [400, noSePudoLeer('una parte no corresponde'), 'otra parte'];
  if (estado.repetida !== null) return [400, noSePudoLeer(`la parte ${estado.repetida} llegó dos veces`), 'parte repetida'];
  const falta = OBLIGATORIAS.find((parte) => !partes.has(parte));
  if (falta !== undefined) return [400, noSePudoLeer(`falta la parte ${falta}`), 'falta una parte'];
  const grande = PARTES.find((parte) => partes.has(parte) && partes.get(parte).length > TOPES[parte]);
  if (grande !== undefined) return [413, superaSuTope(grande), 'tope'];
  return null;
};

// El nombre de parte más largo que se mira: uno más largo es «otra», como uno que no es de PARTES
const LARGO_MAXIMO_DEL_NOMBRE = 100;
const esNombreDeParte = (nombre) => typeof nombre === 'string' && nombre.length > 0 && nombre.length <= LARGO_MAXIMO_DEL_NOMBRE
  && PARTES.includes(nombre);

// El filtro de un pedido: anota en su estado una parte con otro nombre o una repetida (la primera) y la descarta sin guardarla
// (multer no da error: lee la parte y la tira); deja pasar la primera de cada nombre de PARTES. Una parte sin name o con
// name="" llega con el nombre undefined: también es «otra»
const filtroDelDatoQuincena = (estado) => (req, file, cb) => {
  const { fieldname } = file;
  if (!esNombreDeParte(fieldname)) {
    estado.otra = true;
  } else if (estado.vistas.has(fieldname)) {
    estado.repetida ??= fieldname;
  } else {
    estado.vistas.add(fieldname);
    return cb(null, true);
  }
  cb(null, false);
};

/**
 * La lectura del POST del dato de la quincena (sección 4, paso 3 y 4), después del límite y del token. Sin un multipart/form-data,
 * 400. Si no, multer en memoria, armado en cada pedido (el estado del filtro es de este pedido): todas las partes como archivo
 * (fields: 0), hasta 4 y de hasta 5 MB cada una. Después, el primero que valga de los motivos de rechazoDeLaLectura y de
 * rechazoDeLasPartes, con su 400 o su 413. Si todo sirve, deja `req.partes = { metadata, infografia_png, correo_texto,
 * calculos? }`, cada una un Buffer.
 *
 * `parts` es 5 y no 4: busboy 1.6 avisa partsLimit al terminar la parte número `parts`, no al pasarla, así que con 4 un pedido
 * con las cuatro partes daba LIMIT_PART_COUNT. Con 5, una quinta parte siempre es un error: de archivos (files: 4), de campos
 * (fields: 0) o de partes, si no es ninguna de las dos.
 *
 * Sin fieldNameSize, a propósito: busboy entrega sin nombre una parte sin name o con name="", y multer 1.4.5 mide ese nombre
 * con fieldNameSize dentro del flujo de busboy, donde el TypeError tira el proceso entero. El largo lo mira el filtro.
 */
export const subidaDelDatoQuincena = (req, res, next) => {
  const rechazar = ([status, error, motivo]) => {
    console.warn(`Dato de la quincena: ${status} (${motivo})`);
    responderAntesDeLeer(req, res, status, { success: false, error });
  };
  if (!req.is('multipart/form-data')) return rechazar([400, noSePudoLeer('el pedido no es multipart/form-data'), 'no es multipart']);
  const estado = { otra: false, repetida: null, vistas: new Set() };
  const leer = multer({
    storage: multer.memoryStorage(),
    limits: { fields: 0, files: PARTES.length, parts: PARTES.length + 1, fileSize: TOPES.infografia_png },
    fileFilter: filtroDelDatoQuincena(estado)
  }).any();
  leer(req, res, (error) => {
    if (error) return rechazar(rechazoDeLaLectura(error));
    const partes = new Map((req.files ?? []).map((archivo) => [archivo.fieldname, archivo.buffer]));
    const rechazo = rechazoDeLasPartes(estado, partes);
    if (rechazo !== null) return rechazar(rechazo);
    req.partes = Object.fromEntries(partes);
    next();
  });
};

export { UPLOADS_BASE };
