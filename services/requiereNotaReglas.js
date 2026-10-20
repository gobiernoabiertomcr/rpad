/**
 * «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.1 y 1.3): las reglas del dato, puras (sin
 * pool ni Date; ninguna depende del reloj).
 *
 * datasets.requiere_nota: 1 = Sí (la DGMIT tiene que mandarle una nota formal al área), 0 = No (los datos se obtienen de
 * la fuente, sin nota) y NULL = sin dato. En gestión interna es siempre NULL.
 *
 * Ojo: 0 es un valor, no "falta". Sobre este campo nunca se usa `x || null`: siempre `??`.
 */

// Lo que responde el servidor (y copia el formulario del navegador) cuando un dataset externo queda sin el dato
export const MENSAJE_FALTA_REQUIERE_NOTA = 'Indicá si el dataset requiere nota DGMIT.';

/**
 * Lo que llegó en el pedido, como 0, 1, null (sin dato) o undefined (el campo no vino). Acepta 1, true y '1' como Sí; 0,
 * false y '0' como No; null y '' como sin dato. Cualquier otro valor tira TypeError (el controlador responde 400).
 */
export const normalizarRequiereNota = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  if (valor === 1 || valor === true || valor === '1') return 1;
  if (valor === 0 || valor === false || valor === '0') return 0;
  throw new TypeError('requiere_nota tiene que ser 1 (Sí), 0 (No) o vacío');
};

/**
 * El valor que queda guardado: NULL si la gestión es interna; si no, el valor (0, 1 o NULL si no hay dato). Recibe el valor
 * ya normalizado.
 */
export const requiereNotaResultante = ({ gestion, valor }) => (gestion === 'interna' ? null : (valor ?? null));

/**
 * El texto con que se muestra el dato: 'Sí', 'No' o sinDato (por defecto la raya; el Seguimiento pasa 'Sin dato'). Nunca
 * tira: un valor que no es 0 ni 1 cuenta como sin dato.
 */
export const textoRequiereNota = (valor, sinDato = '—') => {
  let normalizado;
  try {
    normalizado = normalizarRequiereNota(valor);
  } catch {
    return sinDato;
  }
  if (normalizado === 1) return 'Sí';
  if (normalizado === 0) return 'No';
  return sinDato;
};
