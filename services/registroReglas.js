/**
 * «Registrar actualización» (spec 2026-10-24-metricas-y-reportes, sección 4): las reglas del registro, puras (sin pool ni
 * Date; ninguna depende del reloj).
 *
 * El origen de los datos, solo en gestión externa: 'area' (los entregó el área) o 'fuente_publica' (Datos Públicos los
 * obtuvo de una fuente pública: el digesto, el Boletín Oficial, la web de Vialidad…). En gestión interna no se pregunta:
 * siempre entregan la DGMIT y la DIT. Viaja en el cambio (`datos_nuevos.origen_datos`) junto con `recibido_el`.
 */

export const ORIGENES_DATOS = Object.freeze(['area', 'fuente_publica']);

// Las opciones del modal «¿Quién entregó los datos?»
export const OPCIONES_ORIGEN = Object.freeze({
  area: 'Los entregó el área',
  fuente_publica: 'Los obtuvo Datos Públicos de una fuente pública'
});

// El texto corto: la comparación de Mi Perfil y el detalle del movimiento del Seguimiento
export const TEXTO_ORIGEN = Object.freeze({
  area: 'Los entregó el área',
  fuente_publica: 'Fuente pública'
});

// Lo que responde el servidor (y copia el formulario del navegador) cuando falta la fecha o, en externa, el origen
export const MENSAJE_FALTA_RECIBIDO = 'Indicá cuándo se recibieron los datos.';
export const MENSAJE_FALTA_ORIGEN = 'Indicá quién entregó los datos.';

// Una edición del formulario que cambia a la vez «Cargado en el portal» y la próxima: eso es registrar una actualización
export const MENSAJE_EDICION_REGISTRA = 'Para registrar una actualización, usá «Registrar actualización».';

/**
 * Lo que llegó en el pedido, como 'area', 'fuente_publica' o null (sin dato: null, undefined y ''). Cualquier otro valor tira
 * TypeError (el controlador responde 400), como normalizarRequiereNota.
 */
export const normalizarOrigen = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  if (ORIGENES_DATOS.includes(valor)) return valor;
  throw new TypeError("origen_datos tiene que ser 'area', 'fuente_publica' o vacío");
};

/**
 * El origen que el modal trae elegido (se puede cambiar): la fuente pública en un externo con «Requiere nota DGMIT: No»; si
 * no, ninguno. Ojo: el 0 es un valor y se compara con ===.
 */
export const origenSugerido = ({ tipo_gestion, requiere_nota } = {}) =>
  (tipo_gestion === 'externa' && requiere_nota === 0 ? 'fuente_publica' : null);

// Cómo se llama la fecha: «Obtenido el» si los datos salieron de una fuente pública; si no, «Recibido el»
export const rotuloDeLaFecha = (origen) => (origen === 'fuente_publica' ? 'Obtenido el' : 'Recibido el');

/**
 * El texto con que se muestra el origen (TEXTO_ORIGEN) o sinDato (por defecto, la raya). Nunca tira: un valor que no es un
 * origen cuenta como sin dato.
 */
export const textoOrigen = (valor, sinDato = '—') =>
  (ORIGENES_DATOS.includes(valor) ? TEXTO_ORIGEN[valor] : sinDato);
