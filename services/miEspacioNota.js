/**
 * Mi espacio, la nota de licencia (spec 2026-10-27-mi-espacio-licencia-word, secciones 2 y 4): la nota en papel que cada
 * persona le presenta al Director General de Modernización e Investigación Territorial para pedir una licencia, armada con lo
 * que la licencia tiene al pedirla. Pura (sin pool ni Date local: las fechas son texto 'AAAA-MM-DD' y la fecha de la nota
 * llega por parámetro, el día de la última vez que se guardó la licencia). Ninguna función tira error: una entrada rara da
 * `{ error }` (`notaDeLicencia`) o '' (los textos y la hoja).
 *
 * La nota se arma una sola vez como estructura (`notaDeLicencia`) y de ahí salen la vista del segundo paso (`htmlDeLaNota`,
 * escapada acá mismo) y el Word (`services/miEspacioNotaWord.js`): la vista y el Word no pueden decir cosas distintas.
 * Los días se cuentan en días hábiles con los feriados (`diasHabilesDe` de `services/feriadosReglas.js`, con el Set de
 * `contextoDe`), como la lista: «a partir del día» es el primer día hábil, y con uno solo va «el día», en singular.
 *
 * `notaDeLicencia` da `{ nota }` o `{ error }`, con `error` una clave de `MENSAJES_NOTA`: 'sinNota' (el uso autorizado o un
 * tipo que no tiene nota), 'sinDiasHabiles' (una licencia de días sin ningún día hábil: un feriado cargado después cayó
 * sobre ella) o 'error' (una licencia, una fecha o una persona que no sirven: no puede salir de la base).
 */
import { diasHabilesDe, diaDeLaSemana } from './feriadosReglas.js';
import { esFechaIso, formatoCorto, formatoLargo } from './notasDigitalesCalendario.js';
import { RENGLON_FIRMA_CONTRATADO, escapeHtml } from './notasDigitalesContenido.js';
import { TIPOS_LICENCIA, MESES_HASTA_EL_FRANCO, MESES_HASTA_LAS_HORAS, mesMas, mesEnFrase } from './miEspacioReglas.js';

// Los tipos que tienen nota: todos menos el uso autorizado (decisión del usuario, «por ahora»), en el orden de TIPOS_LICENCIA
export const TIPOS_CON_NOTA = Object.freeze(TIPOS_LICENCIA.filter((tipo) => tipo !== 'uso_autorizado'));

// Cómo se nombra cada tipo en el archivo: «Nota de licencia - <tipo> - <desde>.docx»
export const NOMBRES_DEL_ARCHIVO = Object.freeze({
  vacaciones: 'Licencia anual ordinaria', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
  familiar: 'Atención del grupo familiar', medica_extraordinaria: 'Médica extraordinaria', franco: 'Franco compensatorio',
  horas_a_favor: 'Horas a favor'
});

// Los mensajes de las rutas, por la clave del error de notaDeLicencia (sinNota es un 404, sinDiasHabiles un 409 y error un 500)
export const MENSAJES_NOTA = Object.freeze({
  sinNota: 'Esta licencia no tiene nota.',
  sinDiasHabiles: 'Entre esas fechas ya no hay ningún día hábil: corregí la licencia para bajar la nota.',
  error: 'Error al armar la nota'
});

// Lo fijo de la nota (sin nombres de personas: si cambia la autoridad o el cargo, se cambia acá)
const LUGAR = 'Comodoro Rivadavia';
const DESTINATARIO = Object.freeze(['Al Señor Director General de', 'Modernización e Investigación Territorial']);
const SD = `S${' '.repeat(15)}/${' '.repeat(15)}D`;
const SALUDO = 'De mi mayor consideración:';
const PIDO = 'Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar ';
const CIERRE = 'Sin otro particular, saludo a Ud. atentamente.';
// La línea sobre la que se firma: la misma en la vista y en el Word (services/miEspacioNotaWord.js la importa de acá)
export const LINEA_DE_LA_FIRMA = '_'.repeat(30);

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
// Un texto recortado; lo que no es un texto, ''
const textoDe = (valor) => (typeof valor === 'string' ? valor.trim() : '');

// Los números en letras, de 1 a 999 (con 0 a 29 en una palabra)
const HASTA_VEINTINUEVE = Object.freeze([
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce',
  'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
]);
const DECENAS = Object.freeze(['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']);
const CENTENAS = Object.freeze([
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos',
  'novecientos'
]);
const menorQueCien = (n) =>
  (n < 30 ? HASTA_VEINTINUEVE[n] : DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${HASTA_VEINTINUEVE[n % 10]}` : ''));

/**
 * Un número entero de 1 a 999 en letras, para ir delante de un sustantivo: el «uno» del final es «un» con uno masculino
 * (días: «un», «veintiún», «ciento un») y «una» con uno femenino (horas: «una», «veintiuna»); las centenas concuerdan
 * («doscientas»). `genero`: 'm' (o cualquier otro valor) o 'f'. Fuera de 1 a 999, o lo que no es un entero, ''.
 */
export const enLetras = (n, genero = 'm') => {
  if (!Number.isInteger(n) || n < 1 || n > 999) return '';
  if (n === 100) return 'cien';
  const femenino = genero === 'f';
  const centena = CENTENAS[Math.floor(n / 100)];
  const partes = [femenino ? centena.replace(/os$/, 'as') : centena, menorQueCien(n % 100)].filter(Boolean);
  const texto = partes.join(' ');
  if (femenino) return texto.replace(/uno$/, 'una');
  return texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
};

// Unas horas de a media hora, de 0,5 a 999,5; lo demás no
const sonHoras = (horas) => typeof horas === 'number' && Number.isInteger(horas * 2) && horas > 0 && horas < 1000;

/**
 * Las horas en letras y en números: «una (1) hora», «tres (3) horas», «media hora (0,5)», «una hora y media (1,5)», «dos horas
 * y media (2,5)». Lo que no son horas de a media hora (de 0,5 a 999,5), ''.
 */
export const textoDeHoras = (horas) => {
  if (!sonHoras(horas)) return '';
  const enteras = Math.floor(horas);
  const numero = String(horas).replace('.', ',');
  const palabra = enteras === 1 ? 'hora' : 'horas';
  if (enteras === horas) return `${enLetras(enteras, 'f')} (${numero}) ${palabra}`;
  if (enteras === 0) return `media hora (${numero})`;
  return `${enLetras(enteras, 'f')} ${palabra} y media (${numero})`;
};

// «correspondiente» concuerda con la palabra que dice textoDeHoras: «hora» en 0,5, 1 y 1,5, y «horas» desde 2
const correspondientesALasHoras = (horas) => (Math.floor(horas) >= 2 ? 'correspondientes' : 'correspondiente');

// Una cantidad de días hábiles: «un (1) día hábil», «nueve (9) días hábiles» ('' si pasa de 999)
const textoDeDias = (n) => {
  const letras = enLetras(n, 'm');
  if (!letras) return '';
  return `${letras} (${n}) ${n === 1 ? 'día hábil' : 'días hábiles'}`;
};

// «martes 3 de noviembre de 2026»
const conElDia = (fecha) => `${diaDeLaSemana(fecha)} ${formatoLargo(fecha)}`;

// Desde cuándo: con un solo día hábil, ese día; con más, el primero
const cuandoEmpieza = (dias) =>
  (dias.length === 1 ? `el día ${conElDia(dias[0])}` : `a partir del día ${conElDia(dias[0])}`);

// El mes de las horas extras, `meses` antes del de la fecha, cruzando el año: «octubre de 2026»; null si no se puede armar.
// Los meses son los de miEspacioReglas.js: el franco, MESES_HASTA_EL_FRANCO (dos: el de diciembre sale de las de octubre); las
// horas a favor, MESES_HASTA_LAS_HORAS (uno)
const mesDeLasHorasExtras = (fecha, meses) => {
  const mes = mesMas(fecha.slice(0, 7), -meses);
  return mes === null ? null : mesEnFrase(mes);
};

// «licencia por examen por dos (2) días hábiles, a partir del día …»
const porDias = (licencia, dias) => {
  const cantidad = textoDeDias(dias.length);
  return cantidad ? `${licencia} por ${cantidad}, ${cuandoEmpieza(dias)}.` : null;
};

// Lo que sigue a PIDO en cada tipo. Los de días reciben los días hábiles de la licencia (al menos uno); los de un día (la
// franquicia, el franco y las horas a favor) dicen su día, el desde, sin contar días. null si algo no se puede escribir
const CUERPOS = Object.freeze({
  vacaciones: ({ dias }) => {
    const cantidad = textoDeDias(dias.length);
    if (!cantidad) return null;
    const correspondientes = dias.length === 1 ? 'correspondiente' : 'correspondientes';
    return `el usufructo de ${cantidad} ${correspondientes} a mi licencia anual ordinaria, ${cuandoEmpieza(dias)}.`;
  },
  franquicia: ({ desde, horas }) => {
    const texto = textoDeHoras(horas);
    return texto ? `el usufructo de ${texto} de franquicia para trámites personales el día ${conElDia(desde)}.` : null;
  },
  estudios: ({ dias }) => porDias('licencia por examen', dias),
  medica: ({ dias }) => porDias('licencia por atención médica', dias),
  familiar: ({ dias }) => porDias('licencia por atención del grupo familiar', dias),
  medica_extraordinaria: ({ dias }) => porDias('licencia médica extraordinaria', dias),
  franco: ({ desde }) => {
    const mes = mesDeLasHorasExtras(desde, MESES_HASTA_EL_FRANCO);
    return mes ? 'el usufructo del franco compensatorio correspondiente a las horas extras realizadas en '
      + `${mes}, el día ${conElDia(desde)}.` : null;
  },
  horas_a_favor: ({ desde, horas }) => {
    const texto = textoDeHoras(horas);
    const mes = mesDeLasHorasExtras(desde, MESES_HASTA_LAS_HORAS);
    if (!texto || !mes) return null;
    return `el usufructo de ${texto} a favor, ${correspondientesALasHoras(horas)} a las horas extras realizadas en ${mes}, `
      + `el día ${conElDia(desde)}.`;
  }
});
// Los tipos que cuentan días hábiles; el resto es de un día
const TIPOS_DE_DIAS = Object.freeze(['vacaciones', 'estudios', 'medica', 'familiar', 'medica_extraordinaria']);

// La firma, de arriba abajo: el nombre, en un contratado el renglón chico del personal contratado (como en las Notas
// Digitales) y el cargo. Sin cargo, solo el nombre: «cumpliendo funciones de» necesita un cargo. Sin vínculo, como planta
const firmaDe = ({ nombre, cargo, vinculo }) => {
  if (!cargo) return [{ texto: nombre, chico: false }];
  return [
    { texto: nombre, chico: false },
    ...(vinculo === 'contrato' ? [{ texto: RENGLON_FIRMA_CONTRATADO, chico: true }] : []),
    { texto: cargo, chico: false }
  ];
};

/**
 * La nota de una licencia: `licencia` = { tipo, desde, hasta, horas } (las de `estado.licencias`, con las horas como
 * número), y en las opciones, `fecha` = 'AAAA-MM-DD' (el día de la última vez que se guardó la licencia), `persona` =
 * { nombre, cargo, vinculo } y `feriados`, el Set de `contextoDe` (lo que no es un Set cuenta solo los 9 fijos).
 * Da `{ nota }`, con `nota` = { fecha, destinatario: [string, string], sd, saludo, cuerpo, cierre, firma: [{ texto, chico }],
 * nombre } (`nombre`, el del archivo: «Nota de licencia - Licencia anual ordinaria - 2026-11-16.docx», con el desde), o
 * `{ error }` con una clave de MENSAJES_NOTA. Nunca tira.
 */
export const notaDeLicencia = (licencia, opciones) => {
  if (!esObjeto(licencia)) return { error: 'error' };
  const { tipo, desde, hasta, horas } = licencia;
  if (!TIPOS_CON_NOTA.includes(tipo)) return { error: 'sinNota' };
  const { fecha, persona, feriados } = esObjeto(opciones) ? opciones : {};
  if (!esFechaIso(fecha) || !esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde || !esObjeto(persona)) {
    return { error: 'error' };
  }
  const nombre = textoDe(persona.nombre);
  if (!nombre) return { error: 'error' };
  const dias = TIPOS_DE_DIAS.includes(tipo) ? diasHabilesDe(desde, hasta, feriados) : [];
  if (TIPOS_DE_DIAS.includes(tipo) && dias.length === 0) return { error: 'sinDiasHabiles' };
  const cuerpo = CUERPOS[tipo]({ desde, horas, dias });
  if (cuerpo === null) return { error: 'error' };
  return {
    nota: {
      fecha: `${LUGAR}, ${formatoLargo(fecha)}`,
      destinatario: [...DESTINATARIO],
      sd: SD,
      saludo: SALUDO,
      cuerpo: `${PIDO}${cuerpo}`,
      cierre: CIERRE,
      firma: firmaDe({ nombre, cargo: textoDe(persona.cargo), vinculo: persona.vinculo }),
      nombre: `Nota de licencia - ${NOMBRES_DEL_ARCHIVO[tipo]} - ${desde}.docx`
    }
  };
};

// Un renglón de la hoja, con el texto escapado; los vacíos son `<p></p>` (la hoja les da el alto de un renglón)
const renglon = (texto, clase = '') => `<p${clase ? ` class="${clase}"` : ''}>${escapeHtml(texto)}</p>`;
const vacios = (cuantos) => '<p></p>'.repeat(cuantos);

/**
 * La hoja de la nota para la vista del segundo paso, con todo texto escapado: la fecha a la derecha y dos renglones vacíos;
 * el destinatario, el «S / D» y uno vacío; el saludo y uno vacío; el cuerpo, con sangría y justificado, y uno vacío; el
 * cierre, con sangría, y cuatro vacíos; y la firma (la línea, el nombre, el renglón chico y el cargo). Las clases (`me-hoja`,
 * `me-hoja-texto`, `derecha`, `sangria`, `justificado`, `sd`, `firma` y `chico`) las dibuja el `<style>` de
 * mi-espacio.html. Con lo que no es una nota, ''.
 */
export const htmlDeLaNota = (nota) => {
  if (!esObjeto(nota)) return '';
  const firma = listaDe(nota.firma)
    .map((linea) => (esObjeto(linea) ? renglon(linea.texto, linea.chico === true ? 'chico' : '') : '')).join('');
  return '<div class="me-hoja"><div class="me-hoja-texto">'
    + renglon(nota.fecha, 'derecha') + vacios(2)
    + listaDe(nota.destinatario).map((linea) => renglon(linea)).join('') + renglon(nota.sd, 'sd') + vacios(1)
    + renglon(nota.saludo) + vacios(1)
    + renglon(nota.cuerpo, 'sangria justificado') + vacios(1)
    + renglon(nota.cierre, 'sangria') + vacios(4)
    + `<div class="firma">${renglon(LINEA_DE_LA_FIRMA)}${firma}</div>`
    + '</div></div>';
};

// El renglón que va arriba de la nota en el segundo paso, con la fecha de la nota; con lo que no es una fecha, ''
export const aclaracionDeLaNota = (fecha) => (esFechaIso(fecha)
  ? `Lleva la fecha del ${formatoCorto(fecha)}, la última vez que guardaste un cambio en la licencia. `
    + 'Se baja en Word, para imprimir y firmar.'
  : '');
