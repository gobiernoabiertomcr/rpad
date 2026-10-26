// Las subidas de Proyectos (spec 2026-10-25-proyectos, 6 a 9): los documentos de un proyecto y los archivos de un hito o un logro.
// Van a uploads/proyectos/<id>/ y uploads/hitos/<id>/ (o a UPLOADS_DIR, si está: los tests usan una carpeta temporal), con un nombre
// único en el disco (un UUID con la extensión).
// La subida no deja archivos huérfanos ni escribe fuera de uploads/ (arreglos 2 y 3):
// - antes de multer, `prepararSubidaProyecto` y `prepararSubidaHito` (controllers/proyectosController.js) validan el id, que el proyecto
//   (activo) o el hito existan y que queden lugares, y dejan `req.subida = { id, carpeta, lugares }`, con la carpeta armada con el id
//   ya validado;
// - `subida(tipo)` arma multer en cada pedido con `limits.files` = los lugares que quedan: si vienen de más, multer corta y borra lo que
//   ya escribió (multer 1.4.5, make-middleware.js), igual que con un tipo no permitido o un archivo de más de 10 MB;
// - si después falla la transacción de los INSERT, el controlador borra los archivos escritos.
// Los límites, las extensiones y los mensajes se exportan para que la página (public/js/proyectos.js) los copie, atados por un test.
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { nombreDeArchivo } from '../services/proyectosReglas.js';

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

// Un error que se le muestra a quien subió: un 400 con su mensaje (el tipo de archivo)
class ErrorDeSubida extends Error {}

// Un error del disco (crear la carpeta o escribir el archivo): un 500 con un mensaje fijo; el error completo, solo en la consola
class ErrorDeDisco extends Error {}
const esDelDisco = (error) => error instanceof ErrorDeDisco || typeof error.syscall === 'string';

// El nombre original se arregla acá, la primera vez que multer da el archivo (de latin1 a UTF-8 y cortado en 255: nombreDeArchivo):
// así el mensaje de la extensión y lo que se guarda usan el mismo nombre. Después, la doble validación: la extensión y el MIME
const fileFilter = (req, file, cb) => {
  file.originalname = nombreDeArchivo(file.originalname);
  const extension = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONES.has(extension)) return cb(new ErrorDeSubida(mensajeTipoNoPermitido(extension)));
  if (!MIMES.has(file.mimetype)) return cb(new ErrorDeSubida(`MIME type no permitido: ${file.mimetype}`));
  cb(null, true);
};

/**
 * El middleware de multer de una subida (`tipo`: 'proyecto' o 'hito'), armado en cada pedido con lo que dejó prepararSubida…: la
 * carpeta (ya con el id validado) y los lugares que quedan como límite de archivos. Los errores salen en español: los de cantidad
 * (LIMIT_FILE_COUNT y LIMIT_UNEXPECTED_FILE), el del tamaño y el del tipo son 400; uno del disco, 500; un pedido mal armado, el 400
 * «Error de upload» de siempre. En todos, multer ya borró lo que había escrito.
 */
export const subida = (tipo) => {
  const { maximo, mensaje } = SUBIDAS[tipo];
  return (req, res, next) => {
    const { carpeta, lugares } = req.subida ?? {};
    if (typeof carpeta !== 'string' || !Number.isInteger(lugares) || lugares < 1 || lugares > maximo) {
      console.error(`Subida de ${tipo} sin preparar:`, req.subida);
      return res.status(500).json({ success: false, error: 'Error al subir archivos' });
    }
    const storage = multer.diskStorage({
      destination: (pedido, file, cb) => {
        try {
          cb(null, ensureUploadDir(carpeta));
        } catch (error) {
          cb(new ErrorDeDisco(error.message, { cause: error }));
        }
      },
      filename: (pedido, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
    });
    const leer = multer({ storage, fileFilter, limits: { fileSize: TAMANO_MAXIMO, files: lugares } }).array('archivos', lugares);
    leer(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, error: MENSAJE_TAMANO_MAXIMO });
        if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ success: false, error: mensaje });
        }
        return res.status(400).json({ success: false, error: `Error de upload: ${error.message}` });
      }
      if (error instanceof ErrorDeSubida) return res.status(400).json({ success: false, error: error.message });
      if (esDelDisco(error)) {
        console.error(`Error al guardar los archivos (${tipo}) en el disco:`, error);
        return res.status(500).json({ success: false, error: 'Error al subir archivos' });
      }
      // Un pedido que no se pudo leer (un multipart mal armado o cortado): como siempre, un 400
      return res.status(400).json({ success: false, error: `Error de upload: ${error.message}` });
    });
  };
};

export { UPLOADS_BASE };
