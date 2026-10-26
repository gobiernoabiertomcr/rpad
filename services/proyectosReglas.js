/**
 * Proyectos (spec 2026-10-25-proyectos, sección 9): las reglas de proyectos, hitos y logros, puras (sin pool ni Date
 * local: hoy llega por parámetro, `hoyArgentina()` en el servidor). Las fechas son texto 'AAAA-MM-DD' y se comparan como
 * texto. Ninguna función tira error: una entrada rara da los errores de sus campos, null, '' o 'ninguno'.
 *
 * La usan el controlador (`controllers/proyectosController.js`: las validaciones, `evidenciaTipo` e `idPositivo`), que
 * además chequea en la base que las áreas existan, y las subidas (`config/upload.js`: `nombreDeArchivo`). La página (`public/js/proyectos.js`)
 * tiene copias de los mensajes, los largos y las listas, atadas por tests de paridad: si cambia uno acá, cambia allá.
 */
import { esFechaIso } from './notasDigitalesCalendario.js';

export const ESTADOS_PROYECTO = Object.freeze(['idea', 'en_curso', 'completado', 'suspendido']);
export const PRIORIDADES = Object.freeze(['alta', 'media', 'baja']);
export const CATEGORIAS = Object.freeze(['tecnologia', 'normativa', 'difusion']);

// Las 25 claves de ICON_SELECTOR_MAP de public/js/main.js, en su orden (atadas por un test que lee main.js)
export const ICONOS_PROYECTO = Object.freeze([
  'bar-chart-3', 'clipboard-list', 'database', 'file-text', 'shield', 'globe', 'users', 'building-2', 'folder', 'code',
  'book-open', 'target', 'flag', 'award', 'briefcase', 'lock', 'eye', 'zap', 'lightbulb', 'file-search', 'pie-chart',
  'megaphone', 'calendar', 'settings', 'mail'
]);

// Largo máximo de cada texto, en caracteres, sin los espacios de los extremos (los varchar de la base)
export const LARGOS = Object.freeze({ nombre: 200, responsable: 150, enlace: 500, titulo: 200, evidencia: 500 });

// La fecha más vieja que se acepta para la elevación de un proyecto y para un hito
export const FECHA_MINIMA = '2000-01-01';

// Los mensajes de cada campo, los mismos en el servidor y en la página
export const MENSAJES_PROYECTOS = Object.freeze({
  nombre: 'Escribí el nombre del proyecto.', nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
  estado: 'El estado no es válido.', prioridad: 'La prioridad no es válida.', categoria: 'La categoría no es válida.',
  fechaInicio: 'La fecha de elevación no es válida.',
  responsable: 'El autor o responsable puede tener hasta 150 caracteres.',
  enlace: 'El enlace tiene que empezar con http:// o https://.', enlaceLargo: 'El enlace puede tener hasta 500 caracteres.',
  color: 'El color no es válido.', icono: 'El ícono no es válido.', areas: 'Elegí áreas que existan.',
  titulo: 'Escribí el título del hito.', tituloLargo: 'El título puede tener hasta 200 caracteres.',
  fecha: 'Elegí la fecha del hito.', fechaInvalida: 'La fecha del hito no es válida.',
  evidencia: 'El enlace de la evidencia tiene que empezar con http:// o https://.',
  evidenciaLarga: 'El enlace de la evidencia puede tener hasta 500 caracteres.',
  sinDatos: 'No hay datos para guardar.'
});

// Los valores de un proyecto nuevo que no los trae (los DEFAULT de la tabla)
const POR_DEFECTO = Object.freeze({ estado: 'idea', prioridad: 'media', categoria: 'tecnologia' });

const COLOR = /^#[0-9a-fA-F]{6}$/;
// Lo mismo que `Utils.esUrlSegura` del navegador
const ENLACE = /^https?:\/\//i;
const ID = /^[1-9]\d{0,9}$/;

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// Caracteres de un texto, como los cuenta el varchar de la base (no las unidades de UTF-16 de `length`)
const caracteres = (texto) => Array.from(texto).length;

// Un texto libre recortado en los extremos, o null si está vacío. Lo que no es un texto cuenta como vacío
const recortado = (valor) => {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto === '' ? null : texto;
};

// Vacío: no vino, null o un texto de espacios. Un campo con formato (fecha, enlace, color, ícono, una lista) que trae
// otra cosa que no es un texto no está vacío: es un error
const esVacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

// El texto recortado de un campo con formato, o null si no es un texto (que no va a pasar su formato)
const textoDeFormato = (valor) => (typeof valor === 'string' ? valor.trim() : null);

// Si la clave vino en la entrada (una clave con undefined es como si no viniera, igual que en un cuerpo JSON)
const presente = (fuente, clave) => Object.hasOwn(fuente, clave) && fuente[clave] !== undefined;

// Las opciones de validarProyecto y validarHito, también si no llegan o no son un objeto. Solo el true literal es parcial
const leerOpciones = (opciones) => {
  const { hoy, parcial } = esObjeto(opciones) ? opciones : {};
  return { hoy, parcial: parcial === true };
};

/**
 * El 31/12 de cinco años después del de hoy ('AAAA-12-31'): el tope de la fecha de elevación y de la de un hito (evita
 * que un año mal escrito, 2062 por 2026, estire la ventana de los carriles y la cinta). null si hoy no es una fecha.
 */
export const fechaMaxima = (hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = Number(hoy.slice(0, 4)) + 5;
  return anio > 9999 ? '9999-12-31' : `${anio}-12-31`;
};

// Una fecha 'AAAA-MM-DD' que existe, entre FECHA_MINIMA y fechaMaxima(hoy). Sin un hoy válido no pasa (no hay tope)
const fechaEnRango = (fecha, hoy) => {
  const maxima = fechaMaxima(hoy);
  return esFechaIso(fecha) && maxima !== null && fecha >= FECHA_MINIMA && fecha <= maxima;
};

/**
 * Un id de la base: un entero positivo de hasta 10 cifras, como texto de solo dígitos sin ceros adelante (el de una URL)
 * o como número. null si no lo es ('0', '-3', '1.5', '1e3', '..%2F', ' 12'): así un id raro nunca llega a una consulta
 * ni a una carpeta de uploads/.
 */
export const idPositivo = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const texto = String(valor);
  return ID.test(texto) ? Number(texto) : null;
};

// Las áreas: ids sin repetidos, en el orden recibido. null si no es un array o si algún elemento no es un id (no se
// descartan en silencio). Vacío o null es ninguna área. Los vistos van en un Set: tiempo lineal
const idsDeAreas = (valor) => {
  if (valor === null) return [];
  if (!Array.isArray(valor)) return null;
  const ids = [];
  const vistos = new Set();
  for (const elemento of valor) {
    const id = idPositivo(elemento);
    if (id === null) return null;
    if (!vistos.has(id)) {
      vistos.add(id);
      ids.push(id);
    }
  }
  return ids;
};

// Un texto obligatorio con largo máximo: { valor, mensaje }
const textoObligatorio = (valor, largo, mensajeVacio, mensajeLargo) => {
  const texto = recortado(valor);
  if (texto === null) return { valor: null, mensaje: mensajeVacio };
  if (caracteres(texto) > largo) return { valor: null, mensaje: mensajeLargo };
  return { valor: texto, mensaje: null };
};

// Un texto opcional con largo máximo: { valor, mensaje }; vacío es null
const textoOpcional = (valor, largo, mensajeLargo) => {
  const texto = recortado(valor);
  if (texto !== null && caracteres(texto) > largo) return { valor: null, mensaje: mensajeLargo };
  return { valor: texto, mensaje: null };
};

// Un enlace opcional: vacío (null), o http/https y hasta `largo` caracteres
const enlaceOpcional = (valor, largo, mensajeEsquema, mensajeLargo) => {
  if (esVacio(valor)) return { valor: null, mensaje: null };
  const texto = textoDeFormato(valor);
  if (texto === null || !ENLACE.test(texto)) return { valor: null, mensaje: mensajeEsquema };
  if (caracteres(texto) > largo) return { valor: null, mensaje: mensajeLargo };
  return { valor: texto, mensaje: null };
};

// Un valor opcional que tiene que cumplir `vale` (el color, el ícono): vacío es null
const conFormato = (valor, vale, mensaje) => {
  if (esVacio(valor)) return { valor: null, mensaje: null };
  const texto = textoDeFormato(valor);
  return texto !== null && vale(texto) ? { valor: texto, mensaje: null } : { valor: null, mensaje };
};

// Un valor de una lista (estado, prioridad, categoría). En un proyecto nuevo, el vacío (undefined, null o '') toma el
// valor por defecto; en una edición, una clave presente tiene que ser de la lista (la columna no admite null)
const deLaLista = (valor, lista, porDefecto, parcial, mensaje) => {
  if (esVacio(valor) && !parcial) return { valor: porDefecto, mensaje: null };
  const texto = textoDeFormato(valor);
  return texto !== null && lista.includes(texto) ? { valor: texto, mensaje: null } : { valor: null, mensaje };
};

// Una fecha en rango: vacía es `vacia` (null sin error, o el mensaje de la obligatoria); si no, 'AAAA-MM-DD' entre
// FECHA_MINIMA y fechaMaxima(hoy), o el mensaje de la inválida
const fechaDelCampo = (valor, hoy, vacia, mensajeInvalida) => {
  if (esVacio(valor)) return vacia;
  const fecha = textoDeFormato(valor);
  return fechaEnRango(fecha, hoy) ? { valor: fecha, mensaje: null } : { valor: null, mensaje: mensajeInvalida };
};

/**
 * Los campos de un proyecto, en el orden de sus errores. Cada uno recibe el valor crudo y devuelve { valor, mensaje }
 * (mensaje null si vale; el valor de un campo con error es null).
 */
const CAMPOS_DEL_PROYECTO = [
  ['nombre', (valor) => textoObligatorio(valor, LARGOS.nombre, MENSAJES_PROYECTOS.nombre, MENSAJES_PROYECTOS.nombreLargo)],
  ['descripcion', (valor) => ({ valor: recortado(valor), mensaje: null })],
  ['estado', (valor, { parcial }) => deLaLista(valor, ESTADOS_PROYECTO, POR_DEFECTO.estado, parcial, MENSAJES_PROYECTOS.estado)],
  ['prioridad', (valor, { parcial }) => deLaLista(valor, PRIORIDADES, POR_DEFECTO.prioridad, parcial, MENSAJES_PROYECTOS.prioridad)],
  ['categoria', (valor, { parcial }) => deLaLista(valor, CATEGORIAS, POR_DEFECTO.categoria, parcial, MENSAJES_PROYECTOS.categoria)],
  ['fecha_inicio', (valor, { hoy }) =>
    fechaDelCampo(valor, hoy, { valor: null, mensaje: null }, MENSAJES_PROYECTOS.fechaInicio)],
  ['responsable', (valor) => textoOpcional(valor, LARGOS.responsable, MENSAJES_PROYECTOS.responsable)],
  ['enlace_externo', (valor) => enlaceOpcional(valor, LARGOS.enlace, MENSAJES_PROYECTOS.enlace, MENSAJES_PROYECTOS.enlaceLargo)],
  ['color', (valor) => conFormato(valor, (texto) => COLOR.test(texto), MENSAJES_PROYECTOS.color)],
  ['icono', (valor) => conFormato(valor, (texto) => ICONOS_PROYECTO.includes(texto), MENSAJES_PROYECTOS.icono)],
  ['areas', (valor) => {
    const ids = valor === undefined ? [] : idsDeAreas(valor);
    return ids === null ? { valor: null, mensaje: MENSAJES_PROYECTOS.areas } : { valor: ids, mensaje: null };
  }]
];

/**
 * Los campos de un hito o un logro, en el orden de sus errores. `evidencia_tipo` no se recibe: lo deriva el servidor
 * (`evidenciaTipo`) al guardar el hito y al subir o borrar uno de sus archivos.
 */
const CAMPOS_DEL_HITO = [
  ['titulo', (valor) => textoObligatorio(valor, LARGOS.titulo, MENSAJES_PROYECTOS.titulo, MENSAJES_PROYECTOS.tituloLargo)],
  ['fecha', (valor, { hoy }) =>
    fechaDelCampo(valor, hoy, { valor: null, mensaje: MENSAJES_PROYECTOS.fecha }, MENSAJES_PROYECTOS.fechaInvalida)],
  ['descripcion', (valor) => ({ valor: recortado(valor), mensaje: null })],
  ['evidencia_url', (valor) => enlaceOpcional(valor, LARGOS.evidencia, MENSAJES_PROYECTOS.evidencia, MENSAJES_PROYECTOS.evidenciaLarga)]
];

/**
 * Recorre los campos y arma { datos, errores }. Sin parcial, todos los campos (los que faltan se validan como vacíos);
 * con parcial, solo los presentes, y si no hay ninguno, el error sinDatos (campo null).
 */
const validar = (campos, entrada, opciones) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const { hoy, parcial } = leerOpciones(opciones);
  const datos = {};
  const errores = [];
  for (const [campo, regla] of campos) {
    if (parcial && !presente(fuente, campo)) continue;
    const valor = presente(fuente, campo) ? fuente[campo] : undefined;
    const resultado = regla(valor, { hoy, parcial });
    datos[campo] = resultado.valor;
    if (resultado.mensaje) errores.push({ campo, mensaje: resultado.mensaje });
  }
  if (parcial && Object.keys(datos).length === 0) errores.push({ campo: null, mensaje: MENSAJES_PROYECTOS.sinDatos });
  return { datos, errores };
};

/**
 * Valida un proyecto (el cuerpo del alta o de la edición) contra hoy ('AAAA-MM-DD').
 * Devuelve `{ datos, errores }`:
 * - `datos`: `{ nombre, descripcion, estado, prioridad, categoria, fecha_inicio, responsable, enlace_externo, color,
 *   icono, areas }`, con los textos recortados (vacío es null), el color tal cual (cualquier #RRGGBB, no solo los de la
 *   paleta) y las áreas como ids sin repetir, en el orden recibido. Un campo con error queda en null. Sin parcial, el
 *   estado, la prioridad y la categoría vacíos toman 'idea', 'media' y 'tecnologia'; el color vacío queda null (el
 *   controlador decide su valor por defecto). `orden`, `evidencia_tipo` y lo desconocido no se leen.
 * - `errores`: `[{ campo, mensaje }]`, uno por campo, en el orden nombre, estado, prioridad, categoría, fecha de
 *   elevación, responsable, enlace, color, ícono y áreas; `[]` si vale.
 * Con `parcial: true` (la edición) solo valida y devuelve las claves presentes: un `nombre` presente y vacío es un error,
 * y un estado, una prioridad o una categoría presentes tienen que ser de su lista. Sin ninguna clave que se pueda
 * guardar, `datos` es `{}` y el error es `{ campo: null, mensaje: MENSAJES_PROYECTOS.sinDatos }`.
 * Que las áreas existan lo chequea el controlador en la base.
 */
export const validarProyecto = (entrada, opciones) => validar(CAMPOS_DEL_PROYECTO, entrada, opciones);

/**
 * Valida un hito o un logro contra hoy ('AAAA-MM-DD'). Devuelve `{ datos: { titulo, fecha, descripcion, evidencia_url },
 * errores }`, con las mismas reglas que validarProyecto: el título y la fecha son obligatorios (con parcial, si vienen);
 * la fecha, del 01/01/2000 a fechaMaxima(hoy) (un hito previsto, posterior a hoy, vale); la evidencia, vacía o http/https.
 */
export const validarHito = (entrada, opciones) => validar(CAMPOS_DEL_HITO, entrada, opciones);

/**
 * El tipo de evidencia de un hito, derivado: 'url' con enlace, 'archivo' sin enlace y con archivos, y 'ninguno' sin
 * ninguna de las dos cosas. `cantidadArchivos` puede venir como número o como texto de dígitos (un COUNT).
 */
export const evidenciaTipo = (entrada) => {
  const { evidencia_url: enlace, cantidadArchivos: cantidad } = esObjeto(entrada) ? entrada : {};
  if (recortado(enlace) !== null) return 'url';
  const archivos = typeof cantidad === 'number' ? cantidad
    : typeof cantidad === 'string' && /^\d+$/.test(cantidad) ? Number(cantidad) : 0;
  return archivos > 0 ? 'archivo' : 'ninguno';
};

/**
 * El nombre original de un archivo subido. Multer (busboy) lo entrega leído como latin1: «presentación.pdf» llega como
 * «presentaciÃ³n.pdf». Se vuelve a leer como UTF-8; si el resultado trae U+FFFD (no era UTF-8 leído como latin1) o el
 * nombre tiene caracteres que latin1 no tiene, se devuelve el original. Lo que no es un texto da ''.
 */
export const nombreOriginal = (nombre) => {
  if (typeof nombre !== 'string') return '';
  if (/[^\u0000-\u00ff]/.test(nombre)) return nombre;
  const convertido = Buffer.from(nombre, 'latin1').toString('utf8');
  return convertido.includes('\uFFFD') ? nombre : convertido;
};

// El largo m\u00E1ximo del nombre de un archivo subido, en caracteres: la columna nombre_archivo es varchar(255)
export const LARGO_NOMBRE_ARCHIVO = 255;

/**
 * El nombre con el que se guarda un archivo subido: el de `nombreOriginal` y, si pasa de LARGO_NOMBRE_ARCHIVO caracteres
 * (contados con Array.from, como el varchar), cortado en ese largo conservando la extensi\u00F3n (Ruling R8: rechazar un archivo
 * por su nombre ser\u00EDa hostil, y sin cortarlo la base lo truncar\u00EDa en silencio, extensi\u00F3n incluida). La extensi\u00F3n es desde el
 * \u00FAltimo punto (no el primer car\u00E1cter); si no deja lugar para el nombre, solo se corta. Lo que no es un texto da ''.
 */
export const nombreDeArchivo = (nombre) => {
  const completo = nombreOriginal(nombre);
  const letras = Array.from(completo);
  if (letras.length <= LARGO_NOMBRE_ARCHIVO) return completo;
  const punto = completo.lastIndexOf('.');
  const extension = punto > 0 ? Array.from(completo.slice(punto)) : [];
  if (extension.length === 0 || extension.length >= LARGO_NOMBRE_ARCHIVO) return letras.slice(0, LARGO_NOMBRE_ARCHIVO).join('');
  return [...letras.slice(0, LARGO_NOMBRE_ARCHIVO - extension.length), ...extension].join('');
};

// El primer error de una validación, como lo responde la API (`{ error, campo }`), o null si no hay ninguno
export const primerError = (errores) => {
  if (!Array.isArray(errores) || errores.length === 0 || !esObjeto(errores[0])) return null;
  return { error: errores[0].mensaje, campo: errores[0].campo };
};
