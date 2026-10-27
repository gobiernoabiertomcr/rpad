/**
 * Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas): las reglas de las licencias y las horas extras de cada persona,
 * puras (sin pool ni Date local: las fechas son texto 'AAAA-MM-DD' y se comparan como texto, las horas 'HH:MM', y hoy llega
 * por parámetro, `hoyArgentina()` en el servidor). Ninguna función tira error: una entrada rara da null, '', una lista vacía
 * o un Map vacío. Todo se cuenta en días hábiles con los feriados (`diasHabilesDe` de `services/feriadosReglas.js`, con el
 * Set de los feriados del rango) y se recalcula cada vez: un feriado nuevo corrige lo ya cargado.
 *
 * El `Estado` es lo que cargó la persona, solo las filas activas:
 * `{ modalidad: 'planta' | 'contrato' | null, arranque: 'AAAA-MM-DD' | null, anios: [{ anio, dias_vacaciones, estudios }],
 * saldos: [{ concepto, anio, cantidad }], licencias: [{ id, tipo, desde, hasta, horas }], horasExtras: [{ id, fecha, desde,
 * hasta }] }`. `arranque` es el día en que cargó su saldo inicial: en los tipos con saldo inicial, lo anterior no descuenta
 * (ya está en el saldo; spec, sección 4).
 *
 * Acá están las constantes y los textos de todo Mi espacio (los mensajes, los de las cargas y los del paso a
 * Configuración) y las vacaciones (spec, 3.1): cada año tiene su licencia, que se habilita en dos mitades (el 1/7 y el 1/1
 * del año siguiente) y vence el 31/12 de dos años después; cada día hábil de unas vacaciones sale de la licencia más vieja
 * que ese día esté habilitada, no vencida y con días libres (`repartoDeVacaciones`). Después, las demás licencias (3.2 a
 * 3.4): lo que suma cada una contra su tope del año (`usoDeLosTopes`) y la validación de una carga (`validarLicencia`, con
 * la regla de 3.8: dos licencias no comparten un día). Los textos son planos: escaparlos le toca a quien los dibuja.
 */
import { diasHabilesDe } from './feriadosReglas.js';
import { esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';

// La modalidad sale del vínculo de la persona (spec, sección 1): las dos plantas tienen las mismas licencias
export const MODALIDADES = Object.freeze(['planta', 'contrato']);
const MODALIDAD_DEL_VINCULO = Object.freeze({ planta_permanente: 'planta', planta_politica: 'planta', contrato: 'contrato' });
export const modalidadDe = (vinculo) =>
  (typeof vinculo === 'string' && Object.hasOwn(MODALIDAD_DEL_VINCULO, vinculo) ? MODALIDAD_DEL_VINCULO[vinculo] : null);
// Cómo se muestra, por vínculo
export const TEXTO_MODALIDAD = Object.freeze({
  planta_permanente: 'Planta permanente', planta_politica: 'Planta política', contrato: 'Contrato'
});

// Los tipos, en el orden del enum de mi_espacio_licencias
export const TIPOS_LICENCIA = Object.freeze([
  'vacaciones', 'franquicia', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco', 'horas_a_favor',
  'uso_autorizado'
]);
// Los de cada modalidad, en el orden de «Cargar licencia» (uso_autorizado no se ofrece ahí: tiene su propio formulario)
export const TIPOS_POR_MODALIDAD = Object.freeze({
  planta: Object.freeze([
    'vacaciones', 'franquicia', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'franco', 'uso_autorizado'
  ]),
  contrato: Object.freeze([
    'vacaciones', 'estudios', 'medica', 'familiar', 'medica_extraordinaria', 'horas_a_favor', 'uso_autorizado'
  ])
});
export const NOMBRES_TIPO = Object.freeze({
  vacaciones: 'Vacaciones', franquicia: 'Franquicia', estudios: 'Estudios', medica: 'Atención médica',
  medica_extraordinaria: 'Médica extraordinaria', familiar: 'Atención del grupo familiar', franco: 'Franco compensatorio',
  horas_a_favor: 'Horas a favor', uso_autorizado: 'Uso autorizado'
});

// Los días de vacaciones que se eligen por año, según la antigüedad
export const DIAS_VACACIONES = Object.freeze([10, 15, 20, 25, 30]);
// Los días de estudios del año, según la carrera, y los de cada examen
export const DIAS_ESTUDIOS = Object.freeze({ universitario: 15, secundario: 10 });
export const DIAS_POR_EXAMEN = 3;
// Los topes del año calendario: la franquicia en horas, el resto en días hábiles
export const TOPES = Object.freeze({ franquicia: 42, medica: 25, familiar: 25 });
// Las horas de un día entero, y las horas extras de un mes que dan un franco
export const JORNADA = 7;
// El largo de una nota, en caracteres contados con Array.from (el varchar(200) de la base)
export const LARGO_NOTA = 200;

// Los mensajes de cada error, los mismos en el servidor y en la página
export const MENSAJES_MI_ESPACIO = Object.freeze({
  sinModalidad: 'Pedile a administración que cargue tu modalidad (planta permanente, planta política o contrato) en Configuración → Usuarios.',
  sinArranque: 'Para empezar, completá «Mis vacaciones y saldos».',
  tipo: 'Elegí el tipo de licencia.',
  fecha: 'Elegí una fecha válida.',
  hastaAntes: 'La licencia no puede terminar antes de empezar.',
  unDia: 'Esta licencia es de un solo día.',
  sinDiasHabiles: 'Entre esas fechas no hay ningún día hábil.',
  diaNoHabil: 'Ese día no es hábil: elegí un día de lunes a viernes que no sea feriado.',
  porExamen: 'Cada examen es de 1 a 3 días hábiles.',
  horasEnteras: 'Las franquicias se toman por hora entera, de 1 a 7.',
  horasMedias: 'Las horas van de a media hora, de 0,5 a 7.',
  nota: 'La nota puede tener hasta 200 caracteres.',
  horario: 'Elegí de qué hora a qué hora, de a media hora.',
  diasVacaciones: 'Elegí 10, 15, 20, 25 o 30 días.',
  estudios: 'Elegí universitaria, secundaria o «No estudio».',
  anio: 'Elegí un año válido.',
  saldoMedias: 'Escribí las horas de a media hora.',
  noEncontrada: 'Licencia no encontrada',
  noEncontradas: 'Horas extras no encontradas',
  yaEmpezo: 'Ya empezó: no se puede borrar',
  soloHasta: 'Ya empezó: solo podés cambiar hasta cuándo.',
  fechasFijas: 'Ya terminó: las fechas quedan fijas.',
  autorizadoSoloVacaciones: 'Solo las vacaciones dejan persona a cargo.',
  tipoFijo: 'Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.'
});

const MESES = Object.freeze([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]);

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
// Un número del pedido o de la base: un número, o un texto que lo es ('7', '2.5', el '7.0' de un DECIMAL); lo demás
// (vacío, booleanos, listas, objetos), NaN
const numeroDe = (valor) => {
  if (typeof valor === 'number') return valor;
  return typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN;
};
// Un id como número (el de la base llega como número; el de un pedido, como texto): lo que no es ninguno de los dos, NaN
const idDe = (valor) => (typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN);
const anioDe = (fecha) => Number(fecha.slice(0, 4));
// Un año con el que se puede armar una fecha de dos años después: un entero de 1 a 9997, o un texto de cuatro cifras
const anioValido = (valor) => {
  const anio = typeof valor === 'string' && /^\d{4}$/.test(valor) ? Number(valor) : valor;
  return Number.isInteger(anio) && anio >= 1 && anio <= 9997 ? anio : null;
};
const fechaDe = (anio, mesYDia) => `${String(anio).padStart(4, '0')}-${mesYDia}`;

// Lo que va en un texto (la raya si no sirve): '05/11/2026', '05/11', 'febrero de 2027', '2026' y los números con coma ('10,5')
const fechaCorta = (fecha) => (esFechaIso(fecha) ? formatoCorto(fecha) : '—');
const diaYMes = (fecha) => (esFechaIso(fecha) ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : '—');
const mesEnFrase = (mes) => {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return '—';
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
};
const anioTexto = (anio) => {
  const valido = anioValido(anio);
  return valido === null ? '—' : String(valido);
};
const numeroTexto = (valor) => {
  const numero = Math.round(Number(valor) * 10) / 10;
  return Number.isFinite(numero) ? String(numero).replace('.', ',') : '—';
};
const horaTexto = (hora) => (typeof hora === 'string' && /^\d{2}:\d{2}$/.test(hora) ? hora : '—');
// Lo que queda de unas horas: ninguna (0, o lo que no es un número) va con «no te quedan», y una, en singular
const esUna = (cantidad) => Number(cantidad) === 1;
const ninguna = (cantidad) => !(Number(cantidad) > 0);
const diasTexto = (dias) => `${numeroTexto(dias)} ${Number(dias) === 1 ? 'día' : 'días'}`;
// 'a', 'a y b' o 'a, b y c'
const enLista = (partes) => (partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`);

// Los textos de las cargas (los que dependen de una fecha, un año o una cantidad)
export const textoRango = (desde, hasta) => `La fecha tiene que ser del ${fechaCorta(desde)} al ${fechaCorta(hasta)}.`;
export const textoNoEstudia = (anio) =>
  `En ${anioTexto(anio)} elegiste «No estudio»: cambialo en «Mis vacaciones y saldos».`;
export const textoSuperpuesta = (fecha) => `Ya tenés una licencia cargada el ${fechaCorta(fecha)}: corregí la que ya está.`;
export const textoSinHabilitados = (fecha) =>
  `No te alcanzan los días habilitados: para el ${fechaCorta(fecha)} no te queda ninguno.`;

const TOPE_EN_TEXTO = Object.freeze({
  medica: (tope) => `los ${tope} días de atención médica`,
  familiar: (tope) => `los ${tope} días de atención del grupo familiar`,
  estudios: (tope) => `los ${tope} días de licencia por estudios`,
  franquicia: (tope) => `las ${tope} horas de franquicia`
});
/**
 * «Con esta licencia pasarías los 25 días de atención médica de 2026.» El tope es el de `TOPES`; el de estudios depende de la
 * carrera de ese año, así que llega en `tope` (sin él, ''). Un tipo sin tope (la extraordinaria) da ''.
 */
export const textoTope = (tipo, anio, tope) => {
  if (typeof tipo !== 'string' || !Object.hasOwn(TOPE_EN_TEXTO, tipo)) return '';
  const cuanto = tope ?? (Object.hasOwn(TOPES, tipo) ? TOPES[tipo] : null);
  if (!(Number(cuanto) > 0)) return '';
  return `Con esta licencia pasarías ${TOPE_EN_TEXTO[tipo](numeroTexto(cuanto))} de ${anioTexto(anio)}.`;
};

// `mes` es 'AAAA-MM'
export const textoSinFranco = (mes) => `En ${mesEnFrase(mes)} no tenés francos para usar.`;
export const textoSinHorasAFavor = (mes, quedan) => {
  if (ninguna(quedan)) return `En ${mesEnFrase(mes)} no te quedan horas a favor.`;
  if (esUna(quedan)) return `En ${mesEnFrase(mes)} te queda 1 hora a favor.`;
  return `En ${mesEnFrase(mes)} te quedan ${numeroTexto(quedan)} horas a favor.`;
};
// En planta, un uso autorizado es un franco entero: el texto es el de no tener ninguno
export const textoSinNoUtilizadas = (modalidad, anio, quedan) => {
  const enElAnio = `En ${anioTexto(anio)}`;
  if (modalidad === 'planta') return `${enElAnio} no tenés francos no utilizados previamente.`;
  if (modalidad !== 'contrato') return '';
  if (ninguna(quedan)) return `${enElAnio} no te quedan horas no utilizadas previamente.`;
  if (esUna(quedan)) return `${enElAnio} te queda 1 hora no utilizada previamente.`;
  return `${enElAnio} te quedan ${numeroTexto(quedan)} horas no utilizadas previamente.`;
};
export const textoHorarioSuperpuesto = (desde, hasta) =>
  `Se superpone con las horas extras de ${horaTexto(desde)} a ${horaTexto(hasta)} de ese día.`;
export const textoSaldo = (maximo) => `Escribí un número de 0 a ${numeroTexto(maximo)}.`;
export const textoAutorizadaSinDias = (desde, hasta) =>
  `Sos la persona autorizada del firmante del ${fechaCorta(desde)} al ${fechaCorta(hasta)}, y con esta licencia no te `
  + 'quedaría ningún día hábil para presentar las notas. Hablalo con el firmante antes de cargarla.';

// Los textos del paso a Configuración → Licencias (spec, sección 6), tal cual: textoSuperpuestaConConfiguracion,
// textoNoPaso y TEXTO_NO_DIA_ENTERO no terminan en punto
export const AVISO_DEL_PASO = 'Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para '
  + 'auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa.';
export const AVISO_DEL_PASO_SUPERADMIN = 'Los avisos al superadmin se guardan y te llegan en un resumen a la vuelta.';
export const AVISO_NOTAS_DE_HOY = 'Las notas de hoy ya salieron a las 8:15 con tu firma.';
export const AVISO_SIN_PERSONA_A_CARGO =
  'Sin persona a cargo: esos días no se generan Notas Digitales y lo que venza se reitera cuando vuelvas.';
export const textoSuperpuestaConConfiguracion = (desde, hasta) =>
  `Se superpone con una licencia de Configuración del ${diaYMes(desde)} al ${diaYMes(hasta)}: revisala con administración`;
export const textoNoPaso = (motivo) => `No pasó a Configuración: ${typeof motivo === 'string' ? motivo : ''}`;
export const textoYaNoCubierta = (desde, hasta) =>
  `Ya no está cubierta en Configuración del ${diaYMes(desde)} al ${diaYMes(hasta)}: revisala con administración.`;
export const textoEnConfiguracion = (desde, hasta) => `En Configuración: del ${diaYMes(desde)} al ${diaYMes(hasta)}.`;
export const textoUnida = (desde, hasta) =>
  `Ya estaba en Configuración → Licencias, del ${diaYMes(desde)} al ${diaYMes(hasta)}.`;
export const textoSigueEnConfiguracion = (desde, hasta) =>
  `Sigue en Configuración del ${diaYMes(desde)} al ${diaYMes(hasta)}: ya empezó y no se pudo anular.`;
export const TEXTO_TAMBIEN_EN_CONFIGURACION = 'También en Configuración → Licencias.';
export const TEXTO_NO_SE_COPIA = 'Administración la cambió en Configuración: lo que corrijas acá ya no se copia.';
export const TEXTO_ANULADA_POR_ADMINISTRACION = 'Administración la anuló en Configuración: queda solo acá.';
export const TEXTO_NO_DIA_ENTERO = 'No es el día entero: no pasa a Configuración';

// Las dos mitades en que se habilita una licencia ordinaria: con un número impar, la primera es la mayor (15 son 8 y 7).
// Lo que no es un entero de 0 en adelante da [0, 0]
export const mitadesDe = (dias) => {
  const total = typeof dias === 'number' || typeof dias === 'string' ? Number(dias) : NaN;
  if (!Number.isInteger(total) || total < 0) return [0, 0];
  return [Math.ceil(total / 2), Math.floor(total / 2)];
};

// Cuándo se habilita cada mitad de la licencia de un año: el 1/7 de ese año y el 1/1 del siguiente (null si no es un año)
export const habilitaciones = (anio) => {
  const valido = anioValido(anio);
  return valido === null ? null : [fechaDe(valido, '07-01'), fechaDe(valido + 1, '01-01')];
};

// El 31/12 de dos años después: la licencia 2024 vence el 31/12/2026 (null si no es un año)
export const venceLaLicencia = (anio) => {
  const valido = anioValido(anio);
  return valido === null ? null : fechaDe(valido + 2, '12-31');
};

/**
 * Los días de vacaciones y los estudios que valen para un año: la fila de ese año o, si no los eligió, la del año anterior
 * más cercano (spec, 3.1). `{ anio, dias_vacaciones, estudios }` (estudios es 'universitario', 'secundario' o null), o null
 * si no hay ninguna de ese año o de antes.
 */
export const anioVigente = (anios, anio) => {
  const buscado = anioValido(anio);
  if (buscado === null) return null;
  let elegida = null;
  for (const fila of listaDe(anios)) {
    if (!esObjeto(fila)) continue;
    const suyo = Number(fila.anio);
    if (!Number.isInteger(suyo) || suyo > buscado || (elegida !== null && suyo <= elegida.anio)) continue;
    const dias = Number(fila.dias_vacaciones);
    elegida = {
      anio: suyo,
      dias_vacaciones: Number.isFinite(dias) ? dias : 0,
      estudios: typeof fila.estudios === 'string' && Object.hasOwn(DIAS_ESTUDIOS, fila.estudios) ? fila.estudios : null
    };
  }
  return elegida;
};

// El saldo inicial de vacaciones de un año, en días enteros (sin la fila, 0)
const saldoDeVacaciones = (estado, anio) => {
  const fila = listaDe(estado.saldos).find((saldo) =>
    esObjeto(saldo) && saldo.concepto === 'vacaciones' && Number(saldo.anio) === anio);
  const cantidad = Math.floor(Number(fila?.cantidad));
  return Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
};

/**
 * Las licencias ordinarias de la persona, de la más vieja a la más nueva: `[{ anio, total, mitades: [{ dias, habilita }],
 * vence, desde_saldo }]`, de (año del arranque − 2) a (año de hoy + 1), las vacaciones que se pueden cargar. `total` es la
 * suma de las mitades. Sin arranque o sin un hoy válido, [].
 * - Una anterior al año del arranque es solo su saldo inicial, habilitado el día del arranque (`desde_saldo`).
 * - La del año del arranque, con el arranque desde el 1/7: la primera mitad es su saldo inicial (lo que quedaba sin usar de
 *   lo habilitado), también desde el arranque, y la segunda, la de `mitadesDe`.
 * - El resto, con los días del año vigente (`anioVigente`) en sus dos mitades.
 */
export const ordinariasDe = (estado, hoy) => {
  if (!esObjeto(estado) || !esFechaIso(estado.arranque) || !esFechaIso(hoy)) return [];
  const { arranque } = estado;
  const anioDelArranque = anioDe(arranque);
  const ordinarias = [];
  for (let anio = anioDelArranque - 2; anio <= anioDe(hoy) + 1; anio++) {
    const fechas = habilitaciones(anio);
    if (fechas === null) continue;
    const [primera, segunda] = mitadesDe(anioVigente(estado.anios, anio)?.dias_vacaciones);
    const delSaldo = { dias: saldoDeVacaciones(estado, anio), habilita: arranque };
    let mitades = [delSaldo];
    const segundaMitad = { dias: segunda, habilita: fechas[1] };
    if (anio === anioDelArranque && arranque >= fechas[0]) mitades = [delSaldo, segundaMitad];
    else if (anio >= anioDelArranque) mitades = [{ dias: primera, habilita: fechas[0] }, segundaMitad];
    ordinarias.push({
      anio, total: mitades.reduce((suma, mitad) => suma + mitad.dias, 0), mitades, vence: venceLaLicencia(anio),
      desde_saldo: mitades[0] === delSaldo
    });
  }
  return ordinarias;
};

// Los tipos con saldo inicial: lo anterior al arranque ya está en el saldo (en contrato, también el uso autorizado, que sale
// de las horas no utilizadas previamente)
const TIPOS_CON_SALDO = Object.freeze(['vacaciones', 'franquicia', 'estudios', 'medica', 'familiar']);
const tieneSaldoInicial = (tipo, modalidad) =>
  TIPOS_CON_SALDO.includes(tipo) || (tipo === 'uso_autorizado' && modalidad === 'contrato');

/**
 * Los días que descuenta una licencia: sus días hábiles con los feriados. En los tipos con saldo inicial, solo desde el
 * arranque, ese día incluido (sin arranque, ninguno: todavía no hay saldo). Un tipo desconocido o unas fechas que no son
 * fechas, [].
 */
export const diasQueDescuentan = (fila, estado, feriados) => {
  if (!esObjeto(fila) || !TIPOS_LICENCIA.includes(fila.tipo)) return [];
  const dias = diasHabilesDe(fila.desde, fila.hasta, feriados);
  const datos = esObjeto(estado) ? estado : {};
  if (!tieneSaldoInicial(fila.tipo, datos.modalidad)) return dias;
  return esFechaIso(datos.arranque) ? dias.filter((dia) => dia >= datos.arranque) : [];
};

const compararTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const habilitadoAl = (ordinaria, fecha) =>
  ordinaria.mitades.reduce((suma, mitad) => suma + (mitad.habilita <= fecha ? mitad.dias : 0), 0);

/**
 * El reparto de las vacaciones (spec, 3.1): cada día hábil que descuenta, en el orden de las fechas (y del id), sale de la
 * licencia más vieja que ese día esté habilitada (la suma de sus mitades habilitadas hasta ese día menos lo ya asignado), no
 * vencida y con días libres; si no hay ninguna, queda sin cubrir. Devuelve `{ hoy, ordinarias, porFila, sinCubrir }`:
 * - `ordinarias`: las de `ordinariasDe`, cada una con lo de hoy: `habilitado` (sus mitades habilitadas hasta hoy),
 *   `por_habilitar` (el resto, menos lo cargado a futuro de lo que todavía no se habilitó), `usados` (asignados hasta hoy),
 *   `cargados` (asignados después de hoy) y `disponibles` (lo habilitado que no se asignó; 0 si ya venció).
 * - `porFila`: un Map de cada id de vacaciones a `[{ anio, dias }]`, por año (una sin días que descuenten, []). El id va
 *   como número (`idDe`): así se busca también con el de un pedido, que llega como texto.
 * - `sinCubrir`: un Map del id (también como número) a sus días sin cubrir, solo de las que tienen alguno.
 * - `hoy`: el de las opciones, o null (`textoDelReparto` lo usa para saber qué licencia vence este año).
 */
export const repartoDeVacaciones = (estado, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  const datos = esObjeto(estado) ? estado : {};
  const ordinarias = ordinariasDe(datos, hoy);
  const asignados = new Map(ordinarias.map((ordinaria) => [ordinaria.anio, []]));
  const contadosPorFila = new Map();
  const sinCubrir = new Map();

  const dias = [];
  for (const fila of listaDe(datos.licencias)) {
    if (!esObjeto(fila) || fila.tipo !== 'vacaciones') continue;
    const id = idDe(fila.id);
    contadosPorFila.set(id, new Map());
    for (const fecha of diasQueDescuentan(fila, datos, feriados)) dias.push({ fecha, id });
  }
  dias.sort((a, b) => compararTexto(a.fecha, b.fecha) || (a.id || 0) - (b.id || 0));

  for (const { fecha, id } of dias) {
    const elegida = ordinarias.find((ordinaria) =>
      fecha <= ordinaria.vence && habilitadoAl(ordinaria, fecha) - asignados.get(ordinaria.anio).length > 0);
    if (elegida === undefined) {
      if (!sinCubrir.has(id)) sinCubrir.set(id, []);
      sinCubrir.get(id).push(fecha);
      continue;
    }
    asignados.get(elegida.anio).push(fecha);
    const deLaFila = contadosPorFila.get(id);
    deLaFila.set(elegida.anio, (deLaFila.get(elegida.anio) ?? 0) + 1);
  }

  const porFila = new Map([...contadosPorFila].map(([id, deLaFila]) =>
    [id, [...deLaFila].sort(([a], [b]) => a - b).map(([anio, cantidad]) => ({ anio, dias: cantidad }))]));

  return {
    hoy: esFechaIso(hoy) ? hoy : null,
    ordinarias: ordinarias.map((ordinaria) => {
      const suyos = asignados.get(ordinaria.anio);
      const habilitado = habilitadoAl(ordinaria, hoy);
      const usados = suyos.filter((fecha) => fecha <= hoy).length;
      return {
        ...ordinaria,
        habilitado,
        por_habilitar: ordinaria.total - habilitado - Math.max(0, suyos.length - habilitado),
        usados,
        cargados: suyos.length - usados,
        disponibles: ordinaria.vence < hoy ? 0 : Math.max(0, habilitado - suyos.length)
      };
    }),
    porFila,
    sinCubrir
  };
};

/**
 * De qué licencia salen los días de unas vacaciones y lo que queda (spec, 3.1): «Salen de la licencia 2024, la más vieja.
 * Te quedan 33 días: 3 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.» Con varias, «Salen de las
 * licencias 2024 (3 días) y 2025 (2 días), las más viejas.»; lo que queda son los disponibles de hoy, con «(vencen el …)»
 * («vence», con uno) en la que vence el 31/12 del año de hoy, «, todos de la 2026» si es una sola, o «No te quedan días
 * disponibles.». Sin días de esa fila que salgan de una licencia (antes del arranque, sin cubrir o un id que no está), ''.
 */
export const textoDelReparto = (reparto, filaId) => {
  if (!esObjeto(reparto) || !(reparto.porFila instanceof Map)) return '';
  const partes = listaDe(reparto.porFila.get(idDe(filaId))).filter(esObjeto);
  if (partes.length === 0) return '';
  const salen = partes.length === 1
    ? `Salen de la licencia ${partes[0].anio}, la más vieja.`
    : `Salen de las licencias ${enLista(partes.map(({ anio, dias }) => `${anio} (${diasTexto(dias)})`))}, las más viejas.`;

  const venceEsteAnio = esFechaIso(reparto.hoy) ? fechaDe(anioDe(reparto.hoy), '12-31') : null;
  const conDias = listaDe(reparto.ordinarias).filter((ordinaria) => esObjeto(ordinaria) && ordinaria.disponibles > 0);
  const deLa = ({ anio, disponibles, vence }) => {
    if (vence !== venceEsteAnio) return `de la ${anio}`;
    return `de la ${anio} (${disponibles === 1 ? 'vence' : 'vencen'} el ${fechaCorta(vence)})`;
  };
  const total = conDias.reduce((suma, ordinaria) => suma + ordinaria.disponibles, 0);
  let quedan;
  if (conDias.length === 0) quedan = 'No te quedan días disponibles.';
  else if (conDias.length > 1) {
    quedan = `Te quedan ${diasTexto(total)}: ${enLista(conDias.map((o) => `${numeroTexto(o.disponibles)} ${deLa(o)}`))}.`;
  } else if (total === 1) quedan = `Te queda 1 día ${deLa(conDias[0])}.`;
  else quedan = `Te quedan ${diasTexto(total)}, todos ${deLa(conDias[0])}.`;
  return `${salen} ${quedan}`;
};

// El rango de fechas de una licencia o de unas horas extras: del 01/01 de dos años antes al 31/12 del año siguiente
// (`{ desde, hasta }`), o null si hoy no es una fecha
export const rangoDeFechas = (hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = anioDe(hoy);
  const rango = { desde: fechaDe(anio - 2, '01-01'), hasta: fechaDe(anio + 1, '12-31') };
  return esFechaIso(rango.desde) && esFechaIso(rango.hasta) ? rango : null;
};

// Las ausencias de día completo (spec, sección 6): las licencias de días enteros, y las de horas con la jornada entera
const TIPOS_DE_DIA_ENTERO = Object.freeze([
  'vacaciones', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco'
]);
const TIPOS_POR_HORAS = Object.freeze(['franquicia', 'horas_a_favor', 'uso_autorizado']);
export const esDiaEntero = (fila) => esObjeto(fila) && (TIPOS_DE_DIA_ENTERO.includes(fila.tipo)
  || (TIPOS_POR_HORAS.includes(fila.tipo) && numeroDe(fila.horas) === JORNADA));

/**
 * El tope del año de un tipo: las 42 horas de franquicia, los 25 días de atención médica y de grupo familiar, y en estudios
 * los de la carrera de ese año (la de `anioVigente`: 15 universitaria y 10 secundaria). null con «No estudio» o sin ningún
 * año cargado, en la médica extraordinaria (no tiene) y en cualquier otro tipo.
 */
export const topeDe = (tipo, anio, anios) => {
  if (tipo === 'estudios') {
    const carrera = anioVigente(anios, anio)?.estudios ?? null;
    return carrera === null ? null : DIAS_ESTUDIOS[carrera];
  }
  return typeof tipo === 'string' && Object.hasOwn(TOPES, tipo) ? TOPES[tipo] : null;
};

// Los tipos que se cuentan por año, en el orden del Resumen (la extraordinaria no tiene tope, pero se cuenta igual: «Usaste
// 3 días en 2026.»), y el tipo de cada concepto del saldo inicial
const TIPOS_CON_TOPE = Object.freeze(['franquicia', 'estudios', 'medica', 'familiar', 'medica_extraordinaria']);
const TIPO_DEL_SALDO = Object.freeze({
  franquicias: 'franquicia', estudios: 'estudios', medica: 'medica', familiar: 'familiar'
});

/**
 * Lo que suma cada tipo con tope en cada año (spec, 3.2 a 3.4): `[{ tipo, anio, usados, tope }]`, por tipo (en el orden de
 * `TIPOS_CON_TOPE`) y por año. Cada día que descuenta (`diasQueDescuentan`: en los tipos con saldo inicial, desde el
 * arranque) cuenta en su año: un día, o sus horas en la franquicia. El saldo inicial de cada tipo suma en el año del
 * arranque. Va cada tipo y año con algún día o con su saldo cargado (aunque sea 0); `tope` es el de `topeDe`. Comparar
 * `usados` con `tope` le toca a quien lo usa. Sin un estado, [].
 */
export const usoDeLosTopes = (estado, opciones) => {
  if (!esObjeto(estado)) return [];
  const { feriados } = esObjeto(opciones) ? opciones : {};
  const usados = new Map(TIPOS_CON_TOPE.map((tipo) => [tipo, new Map()]));
  const sumar = (tipo, anio, cantidad) => usados.get(tipo).set(anio, (usados.get(tipo).get(anio) ?? 0) + cantidad);
  // Lo que no es un número positivo no suma
  const positivo = (valor) => {
    const numero = numeroDe(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  };

  if (esFechaIso(estado.arranque)) {
    const anio = anioDe(estado.arranque);
    for (const saldo of listaDe(estado.saldos)) {
      if (!esObjeto(saldo) || numeroDe(saldo.anio) !== anio) continue;
      const { concepto } = saldo;
      if (typeof concepto === 'string' && Object.hasOwn(TIPO_DEL_SALDO, concepto)) {
        sumar(TIPO_DEL_SALDO[concepto], anio, positivo(saldo.cantidad));
      }
    }
  }
  for (const fila of listaDe(estado.licencias)) {
    if (!esObjeto(fila) || !usados.has(fila.tipo)) continue;
    const porDia = fila.tipo === 'franquicia' ? positivo(fila.horas) : 1;
    for (const dia of diasQueDescuentan(fila, estado, feriados)) sumar(fila.tipo, anioDe(dia), porDia);
  }

  return TIPOS_CON_TOPE.flatMap((tipo) => [...usados.get(tipo)]
    .sort(([a], [b]) => a - b)
    .map(([anio, cantidad]) => ({ tipo, anio, usados: cantidad, tope: topeDe(tipo, anio, estado.anios) })));
};

// Los tipos de un solo día: desde y hasta son el mismo
const TIPOS_DE_UN_DIA = Object.freeze(['franquicia', 'franco', 'horas_a_favor', 'uso_autorizado']);
// Vacío: no vino, null o un texto de espacios
const esVacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
const rechazo = (campo, mensaje) => ({ datos: null, error: { campo, mensaje } });

// Las horas de una carga: `{ horas }`, o `{ error }` con la clave de su mensaje
const horasDeLaCarga = (tipo, valor, modalidad) => {
  // En planta, un uso autorizado es un franco: el día entero
  if (tipo === 'uso_autorizado' && modalidad === 'planta') return { horas: JORNADA };
  const horas = numeroDe(valor);
  if (tipo === 'franquicia') {
    return Number.isInteger(horas) && horas >= 1 && horas <= JORNADA ? { horas } : { error: 'horasEnteras' };
  }
  if (tipo === 'horas_a_favor' || tipo === 'uso_autorizado') {
    return Number.isInteger(horas * 2) && horas >= 0.5 && horas <= JORNADA ? { horas } : { error: 'horasMedias' };
  }
  return { horas: null };
};

// La primera fecha que [desde, hasta] comparte con otra licencia cargada (no con la que se corrige), o null
const primeraFechaEnComun = (licencias, desde, hasta, editadaId) => {
  const editada = idDe(editadaId);
  let primera = null;
  for (const fila of listaDe(licencias)) {
    if (!esObjeto(fila) || idDe(fila.id) === editada || !esFechaIso(fila.desde) || !esFechaIso(fila.hasta)) continue;
    if (fila.hasta < fila.desde || fila.desde > hasta || fila.hasta < desde) continue;
    const enComun = fila.desde > desde ? fila.desde : desde;
    if (primera === null || enComun < primera) primera = enComun;
  }
  return primera;
};

/**
 * Valida una licencia, el cuerpo de un alta o de una corrección. El contexto es `{ hoy, estado, feriados, editadaId,
 * uso_autorizado }` (`editadaId`, el id de la que se corrige, como número o como texto). Devuelve `{ datos, error }`:
 * `error` es null, o `{ campo, mensaje }` del primero que no sirve, y entonces `datos` es null; si no, `datos` es
 * `{ tipo, desde, hasta, horas, mostrar, nota }`. Los controles, en este orden:
 * 1. el tipo, uno de la modalidad del estado; `uso_autorizado`, solo desde su formulario (`uso_autorizado: true`);
 * 2. las fechas: el formato (`fecha`, en su campo), el rango de `rangoDeFechas` (`textoRango`), que hasta no sea anterior
 *    a desde (`hastaAntes`) y, en los de un día, que sean el mismo (sin hasta, toma desde; otro, `unDia` en `hasta`);
 * 3. los días hábiles, con los feriados: ninguno da `sinDiasHabiles`, o `diaNoHabil` en los de un día (en `desde`);
 * 4. las horas: en la franquicia, enteras de 1 a 7 (`horasEnteras`); en las horas a favor y el uso autorizado de contrato,
 *    de 0,5 a 7 de a media hora (`horasMedias`); en el uso autorizado de planta, siempre 7; en el resto, null;
 * 5. la nota: recortada, de hasta 200 caracteres contados con Array.from (vacía, o lo que no es un texto, es null);
 * 6. que no comparta un día con otra licencia cargada (spec, 3.8): `textoSuperpuesta` con la primera fecha en común, en
 *    `desde`;
 * 7. en estudios, de 1 a 3 días hábiles (`porExamen`, en `hasta`), y que los días que descuentan sean de años en que
 *    estudia (`textoNoEstudia`, en `tipo`): lo anterior al arranque queda como historia y no se controla.
 * `mostrar` es 1 salvo con false, 0 o '0'. Los topes no se controlan acá: los compara `problemaDeLaCarga` con lo cargado.
 * Sin un hoy válido no pasa ninguna fecha; una entrada o un contexto que no son objetos cuentan como `{}`.
 */
export const validarLicencia = (entrada, contexto) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const { hoy, estado, feriados, editadaId, uso_autorizado: desdeSuFormulario } = esObjeto(contexto) ? contexto : {};
  const datos = esObjeto(estado) ? estado : {};
  const { modalidad } = datos;
  const { tipo, desde } = fuente;

  const tipos = typeof modalidad === 'string' && Object.hasOwn(TIPOS_POR_MODALIDAD, modalidad)
    ? TIPOS_POR_MODALIDAD[modalidad] : [];
  if (!tipos.includes(tipo) || (tipo === 'uso_autorizado' && desdeSuFormulario !== true)) {
    return rechazo('tipo', MENSAJES_MI_ESPACIO.tipo);
  }

  const deUnDia = TIPOS_DE_UN_DIA.includes(tipo);
  const hasta = deUnDia && esVacio(fuente.hasta) ? desde : fuente.hasta;
  if (!esFechaIso(desde)) return rechazo('desde', MENSAJES_MI_ESPACIO.fecha);
  if (!esFechaIso(hasta)) return rechazo('hasta', MENSAJES_MI_ESPACIO.fecha);
  const rango = rangoDeFechas(hoy);
  if (rango === null) return rechazo('desde', MENSAJES_MI_ESPACIO.fecha);
  const fueraDelRango = (fecha) => fecha < rango.desde || fecha > rango.hasta;
  if (fueraDelRango(desde)) return rechazo('desde', textoRango(rango.desde, rango.hasta));
  if (fueraDelRango(hasta)) return rechazo('hasta', textoRango(rango.desde, rango.hasta));
  if (hasta < desde) return rechazo('hasta', MENSAJES_MI_ESPACIO.hastaAntes);
  if (deUnDia && hasta !== desde) return rechazo('hasta', MENSAJES_MI_ESPACIO.unDia);

  // Con las dos fechas en el rango, contar los días hábiles no da más de cuatro años de vueltas
  const dias = diasHabilesDe(desde, hasta, feriados);
  if (dias.length === 0) {
    return rechazo('desde', deUnDia ? MENSAJES_MI_ESPACIO.diaNoHabil : MENSAJES_MI_ESPACIO.sinDiasHabiles);
  }

  const { horas, error: errorDeLasHoras } = horasDeLaCarga(tipo, fuente.horas, modalidad);
  if (errorDeLasHoras) return rechazo('horas', MENSAJES_MI_ESPACIO[errorDeLasHoras]);

  const nota = typeof fuente.nota === 'string' ? fuente.nota.trim() : '';
  if (Array.from(nota).length > LARGO_NOTA) return rechazo('nota', MENSAJES_MI_ESPACIO.nota);

  const enComun = primeraFechaEnComun(datos.licencias, desde, hasta, editadaId);
  if (enComun !== null) return rechazo('desde', textoSuperpuesta(enComun));

  if (tipo === 'estudios') {
    if (dias.length > DIAS_POR_EXAMEN) return rechazo('hasta', MENSAJES_MI_ESPACIO.porExamen);
    const sinCarrera = diasQueDescuentan({ tipo, desde, hasta }, datos, feriados).map(anioDe)
      .find((anio) => topeDe('estudios', anio, datos.anios) === null);
    if (sinCarrera !== undefined) return rechazo('tipo', textoNoEstudia(sinCarrera));
  }

  const mostrar = [false, 0, '0'].includes(fuente.mostrar) ? 0 : 1;
  return { datos: { tipo, desde, hasta, horas, mostrar, nota: nota === '' ? null : nota }, error: null };
};
