/**
 * Las reglas de un área (spec 2026-10-24-configuracion, 5.2 y 5.3): la validación del alta y de la edición, los mensajes y
 * el texto de por qué no se puede borrar. Puras (sin pool ni Date) y ninguna tira error: una entrada rara da el error de su
 * campo.
 *
 * La usa la API (`controllers/areasController.js`), que además busca en la base el nombre repetido (con
 * MENSAJES_AREA.nombreRepetido) y valida el ámbito (`AMBITOS` y `MENSAJE_AMBITO`, del Generador de Notas: acá no se toca).
 * La pestaña Áreas de Configuración copia el mensaje del nombre, atado por un test de paridad.
 */
import { PATRON_EMAIL } from './usuariosReglas.js';

// Los mensajes de cada campo, los mismos en el servidor y en la pestaña Áreas
export const MENSAJES_AREA = Object.freeze({
  nombre: 'Escribí el nombre del área.',
  nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
  nombreRepetido: 'Ya hay un área con ese nombre.',
  articulo: 'Elegí el artículo: la o el.',
  email: 'Revisá el email: no parece una dirección válida.',
  emailLargo: 'El email puede tener hasta 150 caracteres.',
  largo: (n) => `Puede tener hasta ${n} caracteres.`,
  enUso: 'No se puede borrar el área: tiene datasets asociados. Primero hay que pasarlos a otra área.',
  noEncontrada: 'Área no encontrada'
});

// Largo máximo de cada texto: el de su varchar en la tabla areas
export const LARGOS_AREA = Object.freeze({
  nombre: 200, area_superior: 300, email_principal: 150, email_secundario: 150, email_contacto: 150,
  telefono_area: 50, celular_area: 50, telefono_contacto: 50, nombre_contacto: 150
});

// Los datos de contacto de un área, que solo ve administración: en la fila del área y en la de cada dataset
export const CAMPOS_DE_CONTACTO_AREA = Object.freeze([
  'email_principal', 'email_secundario', 'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto',
  'email_contacto'
]);
export const CAMPOS_DE_CONTACTO_DATASET = Object.freeze([
  'area_email_principal', 'area_email_secundario', 'area_telefono', 'area_celular', 'area_contacto_nombre',
  'area_contacto_telefono', 'area_contacto_email'
]);

// Una copia del objeto sin esas claves (el original no cambia). Lo que no es un objeto vuelve tal cual
export const sinCampos = (objeto, campos) => {
  if (objeto === null || typeof objeto !== 'object') return objeto;
  const afuera = new Set(Array.isArray(campos) ? campos : []);
  return Object.fromEntries(Object.entries(objeto).filter(([clave]) => !afuera.has(clave)));
};

const ARTICULOS = Object.freeze(['la', 'el']);
const EMAILS = new Set(['email_principal', 'email_secundario', 'email_contacto']);

// Los campos, en el orden del formulario: el primer error que se informa es el del primero de esta lista
const ORDEN = Object.freeze([
  'nombre', 'articulo', 'area_superior', 'articulo_superior', 'email_principal', 'email_secundario', 'telefono_area',
  'celular_area', 'nombre_contacto', 'telefono_contacto', 'email_contacto'
]);

// Caracteres de un texto, como los cuenta el varchar de la base (no las unidades de UTF-16 de `length`)
const caracteres = (texto) => Array.from(texto).length;

// Un texto opcional, normalizado: recortado en los extremos (los espacios del medio quedan); '', solo espacios y null son
// null. Lo que no es un texto cuenta como vacío
const textoOpcional = (valor) => {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  return recortado === '' ? null : recortado;
};

// El nombre: obligatorio, recortado y hasta 200 caracteres. Lo que no es un texto cuenta como vacío
const normalizarNombre = (valor) => {
  const recortado = textoOpcional(valor);
  if (recortado === null) return { mensaje: MENSAJES_AREA.nombre };
  if (caracteres(recortado) > LARGOS_AREA.nombre) return { mensaje: MENSAJES_AREA.nombreLargo };
  return { valor: recortado };
};

// Un artículo: 'la' o 'el' (recortado). El de la dependencia acepta además null, '' y solo espacios, que quedan null
const normalizarArticulo = (valor, aceptaVacio) => {
  const recortado = typeof valor === 'string' ? valor.trim() : valor;
  if (aceptaVacio && (recortado === null || recortado === '')) return { valor: null };
  if (ARTICULOS.includes(recortado)) return { valor: recortado };
  return { mensaje: MENSAJES_AREA.articulo };
};

// El mensaje de un texto opcional ya normalizado que no sirve, o null. Vacío (null) siempre sirve. En los emails, el largo
// va antes que el formato: así la expresión nunca corre sobre un texto largo
const errorDeOpcional = (campo, valor) => {
  if (valor === null) return null;
  const largo = LARGOS_AREA[campo];
  if (EMAILS.has(campo)) {
    if (caracteres(valor) > largo) return MENSAJES_AREA.emailLargo;
    return PATRON_EMAIL.test(valor) ? null : MENSAJES_AREA.email;
  }
  return caracteres(valor) > largo ? MENSAJES_AREA.largo(largo) : null;
};

const rechazo = (campo, mensaje) => ({ datos: null, error: { mensaje, campo } });

/**
 * Valida un área: el cuerpo del alta (`anterior` null) o de la edición (`anterior`, la fila guardada).
 * Devuelve `{ datos, error }`:
 * - `error`: null, o `{ mensaje, campo }` del primer campo que no sirve (en el orden de ORDEN); entonces `datos` es null.
 * - `datos`: solo las claves que vinieron (un campo en undefined no viene), normalizadas: los textos recortados y los
 *   opcionales vacíos ('', solo espacios o null) en null. En el alta trae además `articulo: 'la'` si no vino.
 * El nombre y los artículos se validan siempre que vienen (el nombre es obligatorio en el alta). El formato y el largo del
 * resto, solo en el alta o si el valor cambia contra lo guardado (normalizado igual): un dato viejo no frena una edición que
 * no lo toca. El ámbito y cualquier otra clave no van en `datos`. Una entrada que no es un objeto cuenta como `{}`.
 */
export const validarArea = (entrada, anterior = null) => {
  const fuente = entrada !== null && typeof entrada === 'object' && !Array.isArray(entrada) ? entrada : {};
  const guardada = anterior !== null && typeof anterior === 'object' ? anterior : null;
  const esAlta = guardada === null;
  const datos = {};

  for (const campo of ORDEN) {
    const valor = fuente[campo];
    if (valor === undefined) {
      if (esAlta && campo === 'nombre') return rechazo(campo, MENSAJES_AREA.nombre);
      if (esAlta && campo === 'articulo') datos.articulo = 'la';
      continue;
    }

    if (campo === 'nombre' || campo === 'articulo' || campo === 'articulo_superior') {
      const resultado = campo === 'nombre'
        ? normalizarNombre(valor)
        : normalizarArticulo(valor, campo === 'articulo_superior');
      if (resultado.mensaje) return rechazo(campo, resultado.mensaje);
      datos[campo] = resultado.valor;
      continue;
    }

    const normalizado = textoOpcional(valor);
    const cambia = esAlta || normalizado !== textoOpcional(guardada[campo]);
    const mensaje = cambia ? errorDeOpcional(campo, normalizado) : null;
    if (mensaje) return rechazo(campo, mensaje);
    datos[campo] = normalizado;
  }

  return { datos, error: null };
};

// Un número de una cuenta de la base (número, texto o BigInt): lo que no es un entero no negativo cuenta como 0
const cuenta = (valor) => {
  let numero;
  try {
    numero = Number(valor);
  } catch {
    return 0;
  }
  return Number.isInteger(numero) && numero > 0 ? numero : 0;
};

/**
 * Por qué no se puede borrar un área, o null si se puede. Cuenta todos sus datasets (activos y dados de baja) y los
 * cambios pendientes que la eligen; si tiene datasets, manda el mensaje de los datasets.
 */
export const textoNoSePuedeBorrar = (cuentas) => {
  const { activos, deBaja, pendientes } = cuentas !== null && typeof cuentas === 'object' ? cuentas : {};
  const dadosDeBaja = cuenta(deBaja);
  const total = cuenta(activos) + dadosDeBaja;
  const enPendientes = cuenta(pendientes);

  if (total > 0) {
    const datasets = total === 1 ? '1 dataset' : `${total} datasets`;
    const deLaBaja = dadosDeBaja === 0 ? '' : ` (${dadosDeBaja} ${dadosDeBaja === 1 ? 'dado' : 'dados'} de baja)`;
    const pasarlos = total === 1 ? 'pasarlo' : 'pasarlos';
    return `No se puede borrar el área: tiene ${datasets}${deLaBaja}. Primero hay que ${pasarlos} a otra área.`;
  }
  if (enPendientes === 1) {
    return 'No se puede borrar el área: un cambio pendiente la usa. Primero hay que aprobarlo o rechazarlo.';
  }
  if (enPendientes > 1) {
    return `No se puede borrar el área: ${enPendientes} cambios pendientes la usan. Primero hay que aprobarlos o rechazarlos.`;
  }
  return null;
};
