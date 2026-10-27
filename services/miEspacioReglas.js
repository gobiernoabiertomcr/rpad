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
 * la regla de 3.8: dos licencias no comparten un día). Por último, las horas extras (3.5 a 3.7): la validación de una carga
 * (`validarHorasExtras`), los francos compensatorios de planta (`francosDe`), las horas a favor de contrato
 * (`horasAFavorDe`) y lo no utilizado previamente de cada año (`noUtilizadasDe`). Al final, «Mis vacaciones y saldos» (los
 * campos del saldo inicial y el año, sección 4), el cálculo completo (`calcular`), lo guardado que dejó de cerrar
 * (`faltantesDe`, 3.10) y la evaluación de una carga (`evaluarLicencia`: una carga nueva que no cierra no se guarda). Los
 * textos son planos: escaparlos le toca a quien los dibuja.
 */
import { diasHabilesDe, ultimoDiaHabilDelMesCon } from './feriadosReglas.js';
import { diasEntre, esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';

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
// Los tipos de una modalidad; sin una modalidad válida, ninguno
const tiposDeLaModalidad = (modalidad) =>
  (typeof modalidad === 'string' && Object.hasOwn(TIPOS_POR_MODALIDAD, modalidad) ? TIPOS_POR_MODALIDAD[modalidad] : []);
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
// Un mes 'AAAA-MM'
const esMes = (mes) => typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);

// Lo que va en un texto (la raya si no sirve): '05/11/2026', '05/11', 'octubre', 'febrero de 2027', '2026' y los números con
// coma ('10,5'). Los exportados los usa también el panel (services/miEspacioResumen.js), sin copiarlos
const fechaCorta = (fecha) => (esFechaIso(fecha) ? formatoCorto(fecha) : '—');
export const diaYMes = (fecha) => (esFechaIso(fecha) ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : '—');
export const nombreDelMes = (mes) => (esMes(mes) ? MESES[Number(mes.slice(5, 7)) - 1] : '—');
export const mesEnFrase = (mes) => (esMes(mes) ? `${nombreDelMes(mes)} de ${mes.slice(0, 4)}` : '—');
const anioTexto = (anio) => {
  const valido = anioValido(anio);
  return valido === null ? '—' : String(valido);
};
export const numeroTexto = (valor) => {
  const numero = Math.round(Number(valor) * 10) / 10;
  return Number.isFinite(numero) ? String(numero).replace('.', ',') : '—';
};
const horaTexto = (hora) => (typeof hora === 'string' && /^\d{2}:\d{2}$/.test(hora) ? hora : '—');
// Lo que queda de unas horas: ninguna (0, o lo que no es un número) va con «no te quedan», y una, en singular
const esUna = (cantidad) => Number(cantidad) === 1;
const ninguna = (cantidad) => !(Number(cantidad) > 0);
const diasTexto = (dias) => `${numeroTexto(dias)} ${Number(dias) === 1 ? 'día' : 'días'}`;
// Una cantidad de horas: '1 hora', '1,5 horas'
const textoDeHoras = (horas) => `${numeroTexto(horas)} ${esUna(horas) ? 'hora' : 'horas'}`;
// 'a', 'a y b' o 'a, b y c'
export const enLista = (partes) =>
  (partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`);

// Los textos de las cargas (los que dependen de una fecha, un año o una cantidad)
export const textoRango = (desde, hasta) => `La fecha tiene que ser del ${fechaCorta(desde)} al ${fechaCorta(hasta)}.`;
export const textoNoEstudia = (anio) =>
  `En ${anioTexto(anio)} elegiste «No estudio»: cambialo en «Mis vacaciones y saldos».`;
export const textoSuperpuesta = (fecha) => `Ya tenés una licencia cargada el ${fechaCorta(fecha)}: corregí la que ya está.`;
export const textoSinHabilitados = (fecha) =>
  `No te alcanzan los días habilitados: para el ${fechaCorta(fecha)} no te queda ninguno.`;
// El cálculo de una carga con fechas anteriores al arranque, en un tipo con saldo inicial (spec, sección 4)
export const TEXTO_ANTES_DEL_ARRANQUE = 'Es anterior al saldo inicial: queda como historia y no descuenta.';

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
    const suyo = numeroDe(fila.anio);
    if (!Number.isInteger(suyo) || suyo > buscado || (elegida !== null && suyo <= elegida.anio)) continue;
    const dias = numeroDe(fila.dias_vacaciones);
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
    esObjeto(saldo) && saldo.concepto === 'vacaciones' && numeroDe(saldo.anio) === anio);
  const cantidad = Math.floor(numeroDe(fila?.cantidad));
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
export const tieneSaldoInicial = (tipo, modalidad) =>
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
 * La modalidad y el arranque los controla antes quien la llama (`evaluarLicencia`): sin arranque, el control de «No estudio»
 * del paso 7 no mira ningún día.
 */
export const validarLicencia = (entrada, contexto) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const { hoy, estado, feriados, editadaId, uso_autorizado: desdeSuFormulario } = esObjeto(contexto) ? contexto : {};
  const datos = esObjeto(estado) ? estado : {};
  const { modalidad } = datos;
  const { tipo, desde } = fuente;

  if (!tiposDeLaModalidad(modalidad).includes(tipo) || (tipo === 'uso_autorizado' && desdeSuFormulario !== true)) {
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

// Las horas extras (spec, 3.5 a 3.7): se cargan con el día y el horario, de a media hora, y cuentan enteras en el día en que
// empezaron, también si pasan la medianoche. En planta, cada 7 horas de un mes dan un franco compensatorio para usar dos
// meses después, solo en ese mes; en contrato, cada hora es una hora a favor del mes siguiente. Lo que no se usó en su mes
// pasa a «no utilizado previamente», un acumulado del año del mes de uso que vuelve a cero el 1/1 y del que solo descuenta un
// uso autorizado. Las horas extras, los francos y las horas a favor no tienen saldo inicial (spec, sección 4): todo
// descuenta, con cualquier fecha.

// Cuántos meses después se usa lo de un mes trabajado: el franco, dos; las horas a favor, el siguiente
const MESES_HASTA_EL_FRANCO = 2;
const MESES_HASTA_LAS_HORAS = 1;
// En qué se cuenta lo no utilizado de cada modalidad
const UNIDAD_NO_UTILIZADA = Object.freeze({ planta: 'francos', contrato: 'horas' });

// Una hora 'HH:MM' de un día, en punto o y media, en minutos desde las 00:00 (null si no)
const minutosDe = (hora) => {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(hora)) return null;
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
};

// Las horas de un horario 'HH:MM' de a media hora; con hasta antes que desde, pasa la medianoche (+24 h). null si son
// iguales o alguna no es una hora en punto o y media (el TIME de la base, '19:00:00', se corta antes)
export const horasDe = (desde, hasta) => {
  const inicio = minutosDe(desde);
  const fin = minutosDe(hasta);
  if (inicio === null || fin === null || inicio === fin) return null;
  return ((fin > inicio ? fin : fin + 24 * 60) - inicio) / 60;
};

// 'AAAA-MM' más n meses (un entero, también negativo), sobre el índice año × 12 + mes. null si no es un mes, si n no es un
// entero o si el año queda fuera de 0001 a 9999
export const mesMas = (mes, n) => {
  if (!esMes(mes) || !Number.isInteger(n)) return null;
  const indice = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  const anio = Math.floor(indice / 12);
  if (anio < 1 || anio > 9999) return null;
  return `${String(anio).padStart(4, '0')}-${String((indice % 12) + 1).padStart(2, '0')}`;
};

// Las horas extras del mismo día que se superponen con las que empiezan en `inicio` (minutos desde las 00:00 de la fecha) y
// duran `horas`, sin las que se corrigen: `{ inicio, desde, hasta }` de la que empieza primero, o null. Una que pasa la
// medianoche ocupa hasta esa hora del día siguiente; dos pegadas no se superponen
const primeraSuperpuesta = (horasExtras, fecha, inicio, horas, editadaId) => {
  const editada = idDe(editadaId);
  const fin = inicio + horas * 60;
  let primera = null;
  for (const fila of listaDe(horasExtras)) {
    if (!esObjeto(fila) || fila.fecha !== fecha || idDe(fila.id) === editada) continue;
    const suyas = horasDe(fila.desde, fila.hasta);
    if (suyas === null) continue;
    const suyoInicio = minutosDe(fila.desde);
    if (suyoInicio >= fin || inicio >= suyoInicio + suyas * 60) continue;
    if (primera === null || suyoInicio < primera.inicio) {
      primera = { inicio: suyoInicio, desde: fila.desde, hasta: fila.hasta };
    }
  }
  return primera;
};

/**
 * Valida unas horas extras, el cuerpo de un alta o de una corrección. El contexto es `{ hoy, estado, editadaId }`
 * (`editadaId`, el id de las que se corrigen, como número o como texto). Devuelve `{ datos, error }`, como
 * `validarLicencia`: `datos` es `{ fecha, desde, hasta, nota }`. Los controles, en este orden:
 * 1. la fecha: el formato (`fecha`) y el rango de `rangoDeFechas` (`textoRango`), en `fecha`. Cualquier día vale, también un
 *    sábado o un feriado;
 * 2. el horario, de a media hora (`horasDe`; si no, `horario`, en `desde`);
 * 3. la nota: recortada, de hasta 200 caracteres contados con Array.from (vacía, o lo que no es un texto, es null);
 * 4. que no se superponga con otras del mismo día (`primeraSuperpuesta`): `textoHorarioSuperpuesto` con la que empieza
 *    primero, en `desde`.
 * Sin un hoy válido no pasa ninguna fecha; una entrada o un contexto que no son objetos cuentan como `{}`. La modalidad y el
 * arranque los controla quien la llama.
 */
export const validarHorasExtras = (entrada, contexto) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const { hoy, estado, editadaId } = esObjeto(contexto) ? contexto : {};
  const { fecha, desde, hasta } = fuente;

  if (!esFechaIso(fecha)) return rechazo('fecha', MENSAJES_MI_ESPACIO.fecha);
  const rango = rangoDeFechas(hoy);
  if (rango === null) return rechazo('fecha', MENSAJES_MI_ESPACIO.fecha);
  if (fecha < rango.desde || fecha > rango.hasta) return rechazo('fecha', textoRango(rango.desde, rango.hasta));

  const horas = horasDe(desde, hasta);
  if (horas === null) return rechazo('desde', MENSAJES_MI_ESPACIO.horario);

  const nota = typeof fuente.nota === 'string' ? fuente.nota.trim() : '';
  if (Array.from(nota).length > LARGO_NOTA) return rechazo('nota', MENSAJES_MI_ESPACIO.nota);

  const otra = primeraSuperpuesta(esObjeto(estado) ? estado.horasExtras : [], fecha, minutosDe(desde), horas, editadaId);
  if (otra !== null) return rechazo('desde', textoHorarioSuperpuesto(otra.desde, otra.hasta));

  return { datos: { fecha, desde, hasta, nota: nota === '' ? null : nota }, error: null };
};

// Las horas extras de cada mes ('AAAA-MM' → horas), de los meses más viejos a los más nuevos: cada fila cuenta entera en el
// mes de su fecha, también si pasa la medianoche. Las que no tienen una fecha y un horario válidos no suman
export const horasPorMes = (horasExtras) => {
  const porMes = new Map();
  for (const fila of listaDe(horasExtras)) {
    const horas = esObjeto(fila) && esFechaIso(fila.fecha) ? horasDe(fila.desde, fila.hasta) : null;
    if (horas === null) continue;
    const mes = fila.fecha.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + horas);
  }
  return new Map([...porMes].sort(([a], [b]) => compararTexto(a, b)));
};

// Si el mes 'AAAA-MM' ya terminó: hoy es posterior a su último día
const terminoElMes = (mes, hoy) => hoy.slice(0, 7) > mes;
const compararUsos = (a, b) => compararTexto(a.fecha, b.fecha) || (idDe(a.id) || 0) - (idDe(b.id) || 0);

// Los usos de un tipo ('franco', 'horas_a_favor' o 'uso_autorizado'), por mes ('AAAA-MM' → usos, por fecha): cada día que
// descuenta (`diasQueDescuentan`) va en su mes, con lo que arma `uso(fila, fecha)`; si da null, no cuenta
const usosPorMes = (estado, tipo, feriados, uso) => {
  const porMes = new Map();
  for (const fila of listaDe(estado.licencias)) {
    if (!esObjeto(fila) || fila.tipo !== tipo) continue;
    for (const fecha of diasQueDescuentan(fila, estado, feriados)) {
      const suyo = uso(fila, fecha);
      if (suyo === null) continue;
      const mes = fecha.slice(0, 7);
      if (!porMes.has(mes)) porMes.set(mes, []);
      porMes.get(mes).push(suyo);
    }
  }
  for (const usos of porMes.values()) usos.sort(compararUsos);
  return porMes;
};

// Los meses trabajados, de los más viejos a los más nuevos: los que tienen horas extras y los que corresponden a un mes de
// uso con usos (así se ve también un uso de más), cada uno con sus horas, su mes de uso (`distancia` meses después) y los
// usos de ese mes
const mesesTrabajados = (horasExtras, usos, distancia) => {
  const horas = horasPorMes(horasExtras);
  const meses = new Set(horas.keys());
  for (const mesDeUso of usos.keys()) {
    const trabajado = mesMas(mesDeUso, -distancia);
    if (trabajado !== null) meses.add(trabajado);
  }
  return [...meses].sort(compararTexto).flatMap((mesTrabajado) => {
    const mesDeUso = mesMas(mesTrabajado, distancia);
    if (mesDeUso === null) return [];
    return [{
      mes_trabajado: mesTrabajado, horas: horas.get(mesTrabajado) ?? 0, mes_de_uso: mesDeUso, usos: usos.get(mesDeUso) ?? []
    }];
  });
};

/**
 * Los francos compensatorios de planta (spec, 3.5), uno por mes trabajado (`mesesTrabajados`): `[{ mes_trabajado, horas,
 * francos, mes_de_uso, usos: [{ id, fecha }], disponibles, no_utilizados, ultimo_dia_habil, termino }]`.
 * - `francos`: uno cada 7 horas (`JORNADA`) del mes trabajado; las que no llegan no dan ninguno.
 * - `mes_de_uso`: dos meses después, el único en que se usan. `usos`: las filas `franco` de ese mes, una por día que
 *   descuenta, con cualquier fecha (no tienen saldo inicial).
 * - `termino`: si hoy ya pasó el mes de uso; `ultimo_dia_habil`: su último día hábil con los feriados.
 * - `disponibles`: los que quedan sin usar mientras el mes de uso no terminó; cuando termina, pasan a `no_utilizados`. Con
 *   más usos que francos, 0: lo de más lo mide quien lo usa.
 * Fuera de planta, sin un estado o sin un hoy válido, []. Las filas de contrato (unas horas a favor) no cuentan.
 */
export const francosDe = (estado, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  if (!esObjeto(estado) || estado.modalidad !== 'planta' || !esFechaIso(hoy)) return [];
  const usos = usosPorMes(estado, 'franco', feriados, (fila, fecha) => ({ id: fila.id, fecha }));
  return mesesTrabajados(estado.horasExtras, usos, MESES_HASTA_EL_FRANCO).map((mes) => {
    const francos = Math.floor(mes.horas / JORNADA);
    const termino = terminoElMes(mes.mes_de_uso, hoy);
    const quedan = Math.max(0, francos - mes.usos.length);
    return {
      mes_trabajado: mes.mes_trabajado, horas: mes.horas, francos, mes_de_uso: mes.mes_de_uso, usos: mes.usos,
      disponibles: termino ? 0 : quedan, no_utilizados: termino ? quedan : 0,
      ultimo_dia_habil: ultimoDiaHabilDelMesCon(mes.mes_de_uso, feriados), termino
    };
  });
};

/**
 * Las horas a favor de contrato (spec, 3.6), una fila por mes trabajado (`mesesTrabajados`): `[{ mes_trabajado, horas,
 * mes_de_uso, a_favor, usos: [{ id, fecha, horas }], usadas, disponibles, no_utilizadas, antes_del_arranque,
 * ultimo_dia_habil, termino }]`.
 * - `a_favor`: las horas extras del mes trabajado, para usar el mes siguiente (`mes_de_uso`). `usos`: las filas
 *   `horas_a_favor` de ese mes, con cualquier fecha (no tienen saldo inicial), y `usadas`, su suma.
 * - `termino`, `ultimo_dia_habil`, `disponibles` y `no_utilizadas`, como en los francos.
 * - `antes_del_arranque`: el mes de uso terminó antes del arranque, así que lo que quedó sin usar ya está en el saldo
 *   inicial de horas no utilizadas (`noUtilizadasDe` no lo suma).
 * Fuera de contrato, sin un estado o sin un hoy válido, []. Las filas de planta (los francos) no cuentan.
 */
export const horasAFavorDe = (estado, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  if (!esObjeto(estado) || estado.modalidad !== 'contrato' || !esFechaIso(hoy)) return [];
  const mesDelArranque = esFechaIso(estado.arranque) ? estado.arranque.slice(0, 7) : null;
  const usos = usosPorMes(estado, 'horas_a_favor', feriados, (fila, fecha) => {
    const horas = numeroDe(fila.horas);
    return Number.isFinite(horas) && horas > 0 ? { id: fila.id, fecha, horas } : null;
  });
  return mesesTrabajados(estado.horasExtras, usos, MESES_HASTA_LAS_HORAS).map((mes) => {
    const usadas = mes.usos.reduce((suma, uso) => suma + uso.horas, 0);
    const termino = terminoElMes(mes.mes_de_uso, hoy);
    const quedan = Math.max(0, mes.horas - usadas);
    return {
      mes_trabajado: mes.mes_trabajado, horas: mes.horas, mes_de_uso: mes.mes_de_uso, a_favor: mes.horas, usos: mes.usos,
      usadas, disponibles: termino ? 0 : quedan, no_utilizadas: termino ? quedan : 0,
      antes_del_arranque: mesDelArranque !== null && mes.mes_de_uso < mesDelArranque,
      ultimo_dia_habil: ultimoDiaHabilDelMesCon(mes.mes_de_uso, feriados), termino
    };
  });
};

// El saldo inicial de horas no utilizadas de un año: solo el del año del arranque (sin la fila o sin un número positivo, 0)
const saldoDeHorasNoUtilizadas = (estado, anio) => {
  if (!esFechaIso(estado.arranque) || anioDe(estado.arranque) !== anio) return 0;
  const fila = listaDe(estado.saldos).find((saldo) =>
    esObjeto(saldo) && saldo.concepto === 'horas_no_utilizadas' && numeroDe(saldo.anio) === anio);
  const cantidad = numeroDe(fila?.cantidad);
  return Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
};

/**
 * Lo no utilizado previamente de un año (spec, 3.5 y 3.6): lo que quedó sin usar en los meses de uso de ese año que ya
 * terminaron (vuelve a cero el 1/1) y lo que le descuentan los usos autorizados del año. Devuelve `{ anio, unidad,
 * saldo: { cantidad, quedan }, meses: [{ mes_de_uso, mes_trabajado, cantidad, quedan, antes_del_arranque }], usos: [{ id,
 * fecha, cantidad }], quedan }`:
 * - `unidad`: 'horas' en contrato y 'francos' en planta.
 * - `saldo`: el saldo inicial de horas no utilizadas, solo en contrato y en el año del arranque (si no,
 *   `{ cantidad: 0, quedan: 0 }`).
 * - `meses`: los meses de uso del año con algo sin usar (`cantidad`), de los más viejos a los más nuevos. Uno que terminó
 *   antes del arranque va con `antes_del_arranque` y `quedan` 0: lo suyo ya está en el saldo.
 * - `usos`: los usos autorizados del año, por fecha, uno por día que descuenta (en contrato, desde el arranque: lo anterior
 *   ya está en el saldo; en planta, todos), con sus horas o, en planta, un franco. Descuentan primero el saldo y después
 *   los meses, de los más viejos a los más nuevos; lo que no alcanza no deja nada en negativo (lo de más lo mide quien lo
 *   usa, con la `cantidad` del saldo y de los meses).
 * - `quedan`: lo que queda del saldo y de los meses.
 * Sin modalidad (`unidad` null), sin un año o sin un hoy válidos, todo en cero.
 */
export const noUtilizadasDe = (estado, anio, opciones) => {
  const datos = esObjeto(estado) ? estado : {};
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  const { modalidad } = datos;
  const elAnio = anioValido(anio);
  const unidad = typeof modalidad === 'string' && Object.hasOwn(UNIDAD_NO_UTILIZADA, modalidad)
    ? UNIDAD_NO_UTILIZADA[modalidad] : null;
  const resultado = { anio: elAnio, unidad, saldo: { cantidad: 0, quedan: 0 }, meses: [], usos: [], quedan: 0 };
  if (elAnio === null || unidad === null || !esFechaIso(hoy)) return resultado;

  const delAnio = (mes) => Number(mes.slice(0, 4)) === elAnio;
  const sinUsar = unidad === 'francos'
    ? francosDe(datos, { hoy, feriados }).map((mes) => ({ ...mes, cantidad: mes.no_utilizados, antes_del_arranque: false }))
    : horasAFavorDe(datos, { hoy, feriados }).map((mes) => ({ ...mes, cantidad: mes.no_utilizadas }));
  resultado.meses = sinUsar.filter((mes) => mes.cantidad > 0 && delAnio(mes.mes_de_uso))
    .map(({ mes_de_uso, mes_trabajado, cantidad, antes_del_arranque }) =>
      ({ mes_de_uso, mes_trabajado, cantidad, quedan: antes_del_arranque ? 0 : cantidad, antes_del_arranque }));
  if (unidad === 'horas') {
    const cantidad = saldoDeHorasNoUtilizadas(datos, elAnio);
    resultado.saldo = { cantidad, quedan: cantidad };
  }

  const usos = usosPorMes(datos, 'uso_autorizado', feriados, (fila, fecha) => {
    const cantidad = unidad === 'francos' ? 1 : numeroDe(fila.horas);
    return Number.isFinite(cantidad) && cantidad > 0 ? { id: fila.id, fecha, cantidad } : null;
  });
  resultado.usos = [...usos].filter(([mes]) => delAnio(mes)).flatMap(([, delMes]) => delMes).sort(compararUsos);

  let falta = resultado.usos.reduce((suma, uso) => suma + uso.cantidad, 0);
  for (const bolsa of [resultado.saldo, ...resultado.meses]) {
    const toma = Math.min(falta, bolsa.quedan);
    bolsa.quedan -= toma;
    falta -= toma;
  }
  resultado.quedan = [resultado.saldo, ...resultado.meses].reduce((suma, bolsa) => suma + bolsa.quedan, 0);
  return resultado;
};

// «Mis vacaciones y saldos» (spec, sección 4): los días de cada año y el saldo inicial, cómo estaban las cuentas el día del
// arranque. En los tipos con saldo inicial, lo anterior al arranque ya está ahí y no descuenta.

// Los días de una licencia de un año del que no se eligieron (ni de antes): el máximo de DIAS_VACACIONES
const DIAS_SIN_ELEGIR = 30;
// Lo más que se carga de horas no utilizadas previamente en el saldo inicial
const MAXIMO_NO_UTILIZADAS = 200;

/**
 * Los campos de «Para arrancar»: `[{ clave, concepto, anio, rotulo, maximo, paso }]`, en el orden del modal. `arranque` es
 * la fecha del arranque o, si todavía no hay, hoy; su año es A. `anio` es el de la licencia en las vacaciones y A en el
 * resto.
 * - Lo que quedaba sin usar de las licencias ordinarias no vencidas: `vacaciones-<A−2>` y `vacaciones-<A−1>`, hasta los
 *   días vigentes de ese año (`anioVigente`) o, si no hay, 30; y solo con el arranque desde el 1/7, cuando ya se habilitó
 *   la primera mitad, `vacaciones-<A>`, hasta esa mitad.
 * - Lo que ya se usó en el año: en planta, las horas de franquicia (42); los días de estudios, hasta el tope del año (no va
 *   con «No estudio»); y los de atención médica y de grupo familiar (25).
 * - En contrato, las horas no utilizadas previamente, hasta 200 y de a media hora (`paso` 0,5; el resto, 1).
 * Sin una modalidad o un arranque válidos, [].
 */
export const camposDelSaldoInicial = (datos) => {
  const { modalidad, arranque, anios } = esObjeto(datos) ? datos : {};
  if (!MODALIDADES.includes(modalidad) || !esFechaIso(arranque)) return [];
  const anio = anioDe(arranque);
  const campo = (clave, concepto, delAnio, rotulo, maximo, paso = 1) =>
    ({ clave, concepto, anio: delAnio, rotulo, maximo, paso });
  const deVacaciones = (delAnio, rotulo, maximo) => campo(`vacaciones-${delAnio}`, 'vacaciones', delAnio, rotulo, maximo);
  const diasDe = (delAnio) => {
    const dias = anioVigente(anios, delAnio)?.dias_vacaciones;
    return DIAS_VACACIONES.includes(dias) ? dias : DIAS_SIN_ELEGIR;
  };

  const campos = [
    deVacaciones(anio - 2, `Sin usar de la licencia ${anio - 2}`, diasDe(anio - 2)),
    deVacaciones(anio - 1, `De la ${anio - 1}`, diasDe(anio - 1))
  ];
  if (arranque >= fechaDe(anio, '07-01')) campos.push(deVacaciones(anio, `De la ${anio}`, mitadesDe(diasDe(anio))[0]));
  if (modalidad === 'planta') campos.push(campo('franquicias', 'franquicias', anio, 'Horas de franquicia', TOPES.franquicia));
  const estudios = topeDe('estudios', anio, anios);
  if (estudios !== null) campos.push(campo('estudios', 'estudios', anio, 'Días de estudios', estudios));
  campos.push(
    campo('medica', 'medica', anio, 'Días de atención médica', TOPES.medica),
    campo('familiar', 'familiar', anio, 'Días de grupo familiar', TOPES.familiar)
  );
  if (modalidad === 'contrato') {
    campos.push(campo('horas_no_utilizadas', 'horas_no_utilizadas', anio, 'Horas no utilizadas previamente',
      MAXIMO_NO_UTILIZADAS, 0.5));
  }
  return campos;
};

/**
 * Valida el saldo inicial (`PUT /saldo-inicial`): `entrada.saldos` trae un número por cada clave de `campos` (los de
 * `camposDelSaldoInicial`), de 0 a su máximo, entero o, con `paso` 0,5, de a media hora (un número como texto sirve:
 * '6.5'). Devuelve `{ datos, error }`: `datos` es `[{ concepto, anio, cantidad }]`, en el orden de los campos; `error`, null
 * o `{ campo: <la clave>, mensaje }` del primero que no sirve (`textoSaldo` con su máximo si falta, no es un número o se
 * pasa; `saldoMedias` si no es de a media hora), y entonces `datos` es null. Lo que no es un campo no se guarda.
 */
export const validarSaldoInicial = (entrada, campos) => {
  const saldos = esObjeto(entrada) && esObjeto(entrada.saldos) ? entrada.saldos : {};
  const datos = [];
  for (const campo of listaDe(campos)) {
    const maximo = esObjeto(campo) ? numeroDe(campo.maximo) : NaN;
    if (typeof campo?.clave !== 'string' || !Number.isFinite(maximo)) continue;
    const { clave, concepto, anio, paso } = campo;
    const cantidad = Object.hasOwn(saldos, clave) ? numeroDe(saldos[clave]) : NaN;
    if (!(cantidad >= 0 && cantidad <= maximo)) return rechazo(clave, textoSaldo(maximo));
    const enMedias = paso === 0.5;
    if (!Number.isInteger(enMedias ? cantidad * 2 : cantidad)) {
      return rechazo(clave, enMedias ? MENSAJES_MI_ESPACIO.saldoMedias : textoSaldo(maximo));
    }
    datos.push({ concepto, anio, cantidad });
  }
  return { datos, error: null };
};

/**
 * Valida los días y los estudios de un año (`PUT /anio/:anio`; el año, de la dirección: un entero o un texto de cuatro
 * cifras). Devuelve `{ datos: { anio, dias_vacaciones, estudios }, error }`, con los controles en este orden: el año, de dos
 * años antes al siguiente del de hoy (`anio`; sin un hoy válido, ninguno); los días, uno de `DIAS_VACACIONES`
 * (`diasVacaciones`, en `dias_vacaciones`); y los estudios, 'universitario', 'secundario' o null por «No estudio»
 * (`estudios`; que no lleguen también es un error).
 */
export const validarAnio = (anio, entrada, hoy) => {
  const fuente = esObjeto(entrada) ? entrada : {};
  const elAnio = anioValido(anio);
  const deHoy = esFechaIso(hoy) ? anioDe(hoy) : null;
  if (elAnio === null || deHoy === null || elAnio < deHoy - 2 || elAnio > deHoy + 1) {
    return rechazo('anio', MENSAJES_MI_ESPACIO.anio);
  }
  const dias = numeroDe(fuente.dias_vacaciones);
  if (!DIAS_VACACIONES.includes(dias)) return rechazo('dias_vacaciones', MENSAJES_MI_ESPACIO.diasVacaciones);
  const { estudios } = fuente;
  if (estudios !== null && !(typeof estudios === 'string' && Object.hasOwn(DIAS_ESTUDIOS, estudios))) {
    return rechazo('estudios', MENSAJES_MI_ESPACIO.estudios);
  }
  return { datos: { anio: elAnio, dias_vacaciones: dias, estudios }, error: null };
};

// El cálculo completo (spec, sección 3) y lo que deja de cerrar (3.10). Un cambio de modalidad se aplica a todo lo cargado
// (sección 1): lo que no corresponde a la de hoy se lista, pero no cuenta en nada.

/**
 * Si una fila no corresponde a la modalidad de hoy: su tipo no es de esa modalidad (la franquicia y el franco en contrato,
 * las horas a favor en planta) o, en planta, es un uso autorizado que no es de 7 horas (viene de contrato: en planta un uso
 * autorizado es siempre un franco entero). Sin una modalidad, ninguna corresponde; una fila que no es un objeto, tampoco.
 */
export const fueraDeLaModalidad = (fila, modalidad) => {
  if (!esObjeto(fila) || !tiposDeLaModalidad(modalidad).includes(fila.tipo)) return true;
  return modalidad === 'planta' && fila.tipo === 'uso_autorizado' && numeroDe(fila.horas) !== JORNADA;
};

/**
 * Todo lo que sale de lo cargado, sin las filas que no corresponden a la modalidad (`fueraDeLaModalidad`): el `Calculo`,
 * `{ reparto, topes, francos, horasAFavor, noUtilizadas, faltantes }`.
 * - `reparto`: el de `repartoDeVacaciones`.
 * - `topes`: el de `usoDeLosTopes`, solo con los tipos de la modalidad (el saldo de franquicias no cuenta en contrato).
 * - `francos` y `horasAFavor`: los de `francosDe` y `horasAFavorDe` (cada uno, [] en la otra modalidad).
 * - `noUtilizadas`: `{ [anio]: noUtilizadasDe }` de cada año con algo que mirar: el de hoy, el del arranque, el de cada mes
 *   de uso y el de cada uso autorizado. Sin modalidad, {}.
 * - `faltantes`: los de `faltantesDe`.
 * Sin un hoy válido, todo vacío: sin hoy no hay ninguna licencia habilitada, y todas las vacaciones quedarían sin cubrir.
 */
export const calcular = (estado, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  if (!esFechaIso(hoy)) {
    return { reparto: repartoDeVacaciones(null), topes: [], francos: [], horasAFavor: [], noUtilizadas: {}, faltantes: [] };
  }
  const datos = esObjeto(estado) ? estado : {};
  const { modalidad } = datos;
  const tipos = tiposDeLaModalidad(modalidad);
  const deLaModalidad = {
    ...datos, licencias: listaDe(datos.licencias).filter((fila) => !fueraDeLaModalidad(fila, modalidad))
  };
  const conHoy = { hoy, feriados };
  const francos = francosDe(deLaModalidad, conHoy);
  const horasAFavor = horasAFavorDe(deLaModalidad, conHoy);

  const anios = new Set();
  if (tipos.length > 0) {
    anios.add(anioDe(hoy));
    if (esFechaIso(datos.arranque)) anios.add(anioDe(datos.arranque));
    for (const mes of [...francos, ...horasAFavor]) anios.add(Number(mes.mes_de_uso.slice(0, 4)));
    for (const fila of deLaModalidad.licencias) {
      if (fila.tipo !== 'uso_autorizado') continue;
      for (const dia of diasQueDescuentan(fila, deLaModalidad, feriados)) anios.add(anioDe(dia));
    }
  }

  const calculo = {
    reparto: repartoDeVacaciones(deLaModalidad, conHoy),
    topes: usoDeLosTopes(deLaModalidad, { feriados }).filter((uso) => tipos.includes(uso.tipo)),
    francos,
    horasAFavor,
    noUtilizadas: Object.fromEntries([...anios].sort((a, b) => a - b)
      .map((anio) => [anio, noUtilizadasDe(deLaModalidad, anio, conHoy)]))
  };
  return { ...calculo, faltantes: faltantesDe(calculo) };
};

// Los textos de los faltantes del Resumen, neutros: «Revisá …»
const QUE_SE_REVISA = Object.freeze({
  franquicia: 'tus franquicias', estudios: 'tu licencia por estudios', medica: 'tu atención médica',
  familiar: 'tu atención del grupo familiar'
});
// 'corresponde 1', 'corresponden 7,5' o 'no corresponde ninguno'
const textoCorresponde = (cantidad, ninguno) => {
  if (ninguna(cantidad)) return `no corresponde ${ninguno}`;
  return `${esUna(cantidad) ? 'corresponde' : 'corresponden'} ${numeroTexto(cantidad)}`;
};
const textoFaltanteDeVacaciones = (fecha, dias) => `Revisá tus vacaciones: para el ${fechaCorta(fecha)} `
  + `${esUna(dias) ? 'falta 1 día habilitado' : `faltan ${numeroTexto(dias)} días habilitados`}.`;
const textoFaltanteDelTope = (tipo, anio, usados, tope) => `Revisá ${QUE_SE_REVISA[tipo]} de ${anioTexto(anio)}: suman `
  + `${numeroTexto(usados)} ${tipo === 'franquicia' ? 'horas' : 'días'} y el tope es ${numeroTexto(tope)}.`;
const textoFaltanteDeFrancos = (mes, cargados, francos) =>
  `Revisá tus francos de ${mesEnFrase(mes)}: cargaste ${numeroTexto(cargados)} y ${textoCorresponde(francos, 'ninguno')}.`;
const textoFaltanteDeHoras = (mes, usadas, aFavor) => `Revisá tus horas a favor de ${mesEnFrase(mes)}: cargaste `
  + `${textoDeHoras(usadas)} y ${textoCorresponde(aFavor, 'ninguna')}.`;
// En planta, con francos
const textoFaltanteDeUsos = (unidad, anio, cargado, habia) => {
  const enFrancos = unidad === 'francos';
  const cargaste = enFrancos ? `${numeroTexto(cargado)} ${esUna(cargado) ? 'franco' : 'francos'}` : textoDeHoras(cargado);
  const queHabia = ninguna(habia) ? `no había ${enFrancos ? 'ninguno' : 'ninguna'}` : `había ${numeroTexto(habia)}`;
  return `Revisá tus usos autorizados de ${anioTexto(anio)}: cargaste ${cargaste} y ${queHabia}.`;
};

// La modalidad de cada unidad de lo no utilizado (al revés de UNIDAD_NO_UTILIZADA)
const MODALIDAD_DE_LA_UNIDAD = Object.freeze({ francos: 'planta', horas: 'contrato' });
const unidadValida = (unidad) => typeof unidad === 'string' && Object.hasOwn(MODALIDAD_DE_LA_UNIDAD, unidad);
// Un número de un cálculo; lo que no es un número, 0
const cantidadDe = (valor) => {
  const numero = numeroDe(valor);
  return Number.isFinite(numero) ? numero : 0;
};
// Lo no utilizado de un año (un `noUtilizadasDe`): lo que había (el saldo y los meses que ya terminaron, sin los de antes del
// arranque, que ya están en el saldo) y lo que se cargó en usos autorizados
const habiaDe = (delAnio) => cantidadDe(esObjeto(delAnio.saldo) ? delAnio.saldo.cantidad : 0)
  + listaDe(delAnio.meses).reduce((suma, mes) =>
    suma + (esObjeto(mes) && !mes.antes_del_arranque ? cantidadDe(mes.cantidad) : 0), 0);
const cargadoDe = (delAnio) =>
  listaDe(delAnio.usos).reduce((suma, uso) => suma + (esObjeto(uso) ? cantidadDe(uso.cantidad) : 0), 0);
// Lo que suman los usos de la fila que se corrige (`valor`: 'horas' o 'cantidad'); sin una fila, 0
const propiosDe = (usos, filaId, valor) => {
  const id = idDe(filaId);
  return listaDe(usos).reduce((suma, uso) => suma + (esObjeto(uso) && idDe(uso.id) === id ? cantidadDe(uso[valor]) : 0), 0);
};
// Lo que queda para una carga, de las horas a favor de un mes y de lo no utilizado de un año: lo que había menos lo que usan
// las otras filas (la que se corrige, `filaId`, no cuenta); nunca menos de 0
const quedanDeLasHoras = (mes, filaId) =>
  Math.max(0, cantidadDe(mes.a_favor) - cantidadDe(mes.usadas) + propiosDe(mes.usos, filaId, 'horas'));
const quedanDeLoNoUtilizado = (delAnio, filaId) =>
  Math.max(0, habiaDe(delAnio) - cargadoDe(delAnio) + propiosDe(delAnio.usos, filaId, 'cantidad'));

/**
 * Lo guardado que dejó de cerrar (spec, 3.10): `[{ clave, campo, medida, texto, mensaje }]`. Los cambios posteriores (dar de
 * baja un feriado, bajar los días de un año, corregir el saldo inicial) no se frenan: lo que dejan sin cubrir queda como
 * faltante, con un texto neutro para el Resumen (`texto`) y el error que daría una carga (`mensaje`; `campo` es `desde` en
 * días y francos, y `horas` en horas). `medida` es lo que compara `problemaDeLaCarga`. En este orden:
 * - `vacaciones:<id>`: sus días sin cubrir, con el primero («para el 15/06/2027 faltan 2 días habilitados»), por fecha;
 * - `tope:<tipo>:<anio>`: lo que suma, si pasa el tope (sin tope, como con «No estudio», no hay faltante);
 * - `franco:<mes>`: los francos de más en ese mes de uso;
 * - `horas:<mes>`: las horas a favor de más en ese mes de uso;
 * - `uso:<anio>`: lo que suman los usos autorizados del año por encima de lo que había (el saldo y los meses que ya
 *   terminaron, sin los de antes del arranque, que ya están en el saldo).
 * En los dos últimos, `mensaje` dice lo que queda en ese cálculo (nada, si hay faltante): `problemaDeLaCarga` lo cambia por
 * lo que quedaba antes de la carga. Sin un cálculo, [].
 */
export const faltantesDe = (calculo) => {
  if (!esObjeto(calculo)) return [];
  const faltantes = [];

  const { reparto } = calculo;
  const sinCubrir = esObjeto(reparto) && reparto.sinCubrir instanceof Map ? reparto.sinCubrir : new Map();
  const vacaciones = [...sinCubrir].map(([id, dias]) => ({ id, dias: listaDe(dias).filter(esFechaIso) }))
    .filter(({ id, dias }) => typeof id === 'number' && dias.length > 0)
    .sort((a, b) => compararTexto(a.dias[0], b.dias[0]) || (a.id || 0) - (b.id || 0));
  for (const { id, dias } of vacaciones) {
    faltantes.push({
      clave: `vacaciones:${id}`, campo: 'desde', medida: dias.length,
      texto: textoFaltanteDeVacaciones(dias[0], dias.length), mensaje: textoSinHabilitados(dias[0])
    });
  }

  for (const uso of listaDe(calculo.topes)) {
    if (!esObjeto(uso) || typeof uso.tipo !== 'string' || !Object.hasOwn(QUE_SE_REVISA, uso.tipo)) continue;
    const usados = numeroDe(uso.usados);
    const tope = numeroDe(uso.tope);
    if (!(tope > 0) || !(usados > tope)) continue;
    faltantes.push({
      clave: `tope:${uso.tipo}:${anioTexto(uso.anio)}`, campo: uso.tipo === 'franquicia' ? 'horas' : 'desde',
      medida: usados, texto: textoFaltanteDelTope(uso.tipo, uso.anio, usados, tope),
      mensaje: textoTope(uso.tipo, uso.anio, tope)
    });
  }

  for (const mes of listaDe(calculo.francos)) {
    if (!esObjeto(mes) || !esMes(mes.mes_de_uso)) continue;
    const cargados = listaDe(mes.usos).length;
    const francos = cantidadDe(mes.francos);
    if (cargados <= francos) continue;
    faltantes.push({
      clave: `franco:${mes.mes_de_uso}`, campo: 'desde', medida: cargados - francos,
      texto: textoFaltanteDeFrancos(mes.mes_de_uso, cargados, francos), mensaje: textoSinFranco(mes.mes_de_uso)
    });
  }

  for (const mes of listaDe(calculo.horasAFavor)) {
    if (!esObjeto(mes) || !esMes(mes.mes_de_uso)) continue;
    const usadas = cantidadDe(mes.usadas);
    const aFavor = cantidadDe(mes.a_favor);
    if (usadas <= aFavor) continue;
    faltantes.push({
      clave: `horas:${mes.mes_de_uso}`, campo: 'horas', medida: usadas - aFavor,
      texto: textoFaltanteDeHoras(mes.mes_de_uso, usadas, aFavor),
      mensaje: textoSinHorasAFavor(mes.mes_de_uso, quedanDeLasHoras(mes))
    });
  }

  for (const delAnio of esObjeto(calculo.noUtilizadas) ? Object.values(calculo.noUtilizadas) : []) {
    if (!esObjeto(delAnio) || !unidadValida(delAnio.unidad)) continue;
    const anio = anioValido(delAnio.anio);
    const habia = habiaDe(delAnio);
    const cargado = cargadoDe(delAnio);
    if (anio === null || cargado <= habia) continue;
    faltantes.push({
      clave: `uso:${anio}`, campo: delAnio.unidad === 'horas' ? 'horas' : 'desde', medida: cargado - habia,
      texto: textoFaltanteDeUsos(delAnio.unidad, anio, cargado, habia),
      mensaje: textoSinNoUtilizadas(MODALIDAD_DE_LA_UNIDAD[delAnio.unidad], anio, quedanDeLoNoUtilizado(delAnio))
    });
  }
  return faltantes;
};

// Los faltantes de un cálculo que se pueden comparar, con la medida como número
const faltantesComparables = (calculo) => (esObjeto(calculo) ? listaDe(calculo.faltantes) : [])
  .filter((faltante) => esObjeto(faltante) && typeof faltante.clave === 'string')
  .map((faltante) => ({ ...faltante, medida: numeroDe(faltante.medida) }))
  .filter((faltante) => Number.isFinite(faltante.medida));

// El mensaje de un faltante como error de una carga: en las horas a favor y en los usos autorizados dice lo que quedaba
// antes de la carga (`antes`), con lo que ya usaba la fila que se corrige; el resto no depende de lo que había
const mensajeDeLaCarga = (faltante, antes, filaId) => {
  const separador = faltante.clave.indexOf(':');
  const tipo = faltante.clave.slice(0, separador);
  const cual = faltante.clave.slice(separador + 1);
  const calculo = esObjeto(antes) ? antes : {};
  if (tipo === 'horas') {
    const delMes = listaDe(calculo.horasAFavor).find((mes) => esObjeto(mes) && mes.mes_de_uso === cual);
    return textoSinHorasAFavor(cual, delMes === undefined ? 0 : quedanDeLasHoras(delMes, filaId));
  }
  if (tipo === 'uso' && esObjeto(calculo.noUtilizadas)) {
    const delAnio = Object.values(calculo.noUtilizadas)
      .find((otro) => esObjeto(otro) && unidadValida(otro.unidad) && otro.anio === Number(cual));
    if (delAnio !== undefined) {
      return textoSinNoUtilizadas(MODALIDAD_DE_LA_UNIDAD[delAnio.unidad], delAnio.anio,
        quedanDeLoNoUtilizado(delAnio, filaId));
    }
  }
  return faltante.mensaje;
};

/**
 * Lo que frena una carga (spec, 3.10): el primer faltante de `despues` que no está en `antes` o que mide más que en `antes`.
 * Un faltante que ya estaba no frena una carga que no lo agranda: se puede corregir otra cosa de una fila en faltante.
 * `antes` y `despues` son dos `Calculo` (`calcular`): el de lo cargado y el de lo cargado con la licencia nueva o corregida.
 * Devuelve `{ campo, mensaje }` (`campo` es `desde` en días y francos, y `horas` en horas), o null. En las horas a favor y
 * los usos autorizados, el mensaje dice lo que quedaba antes de la carga; con `filaId`, el id de la licencia que se
 * corrige, cuenta también lo que esa fila ya usaba.
 */
export const problemaDeLaCarga = (antes, despues, filaId) => {
  const previos = new Map(faltantesComparables(antes).map(({ clave, medida }) => [clave, medida]));
  const nuevo = faltantesComparables(despues).find(({ clave, medida }) => !previos.has(clave) || medida > previos.get(clave));
  return nuevo === undefined ? null : { campo: nuevo.campo ?? null, mensaje: mensajeDeLaCarga(nuevo, antes, filaId) };
};

// Las cargas que se cuentan en horas: la franquicia, las horas a favor y el uso autorizado de contrato (el de planta es un
// franco, el día entero)
const seCuentaEnHoras = (tipo, modalidad) =>
  tipo === 'franquicia' || tipo === 'horas_a_favor' || (tipo === 'uso_autorizado' && modalidad === 'contrato');

// «5 días hábiles», «5 días hábiles de 7 corridos» o, en horas, «2 horas»
const textoDeLosDias = (fila, modalidad, habiles) => {
  if (seCuentaEnHoras(fila.tipo, modalidad)) return textoDeHoras(fila.horas);
  const enHabiles = esUna(habiles) ? '1 día hábil' : `${numeroTexto(habiles)} días hábiles`;
  const corridos = diasEntre(fila.desde, fila.hasta) + 1;
  return corridos === habiles ? enHabiles : `${enHabiles} de ${numeroTexto(corridos)} corridos`;
};

// Lo que queda de lo no utilizado previamente después de un uso autorizado
const textoQuedanNoUtilizadas = (modalidad, quedan) => {
  const [una, varias, lasMasViejas] = modalidad === 'planta'
    ? ['franco no utilizado', 'francos no utilizados', 'los más viejos']
    : ['hora no utilizada', 'horas no utilizadas', 'las más viejas'];
  let queda = `Quedan ${numeroTexto(quedan)} ${varias} previamente.`;
  if (ninguna(quedan)) queda = `No quedan ${varias} previamente.`;
  else if (esUna(quedan)) queda = `Queda 1 ${una} previamente.`;
  return `${queda} Se descuentan primero ${lasMasViejas}.`;
};

// Lo que queda después de una carga, del tipo de la fila: con tope, el del año de su primer día que descuenta; las horas a
// favor y el franco, los de su mes; el uso autorizado, lo no utilizado de su año. Las vacaciones lo dicen en el reparto y
// la extraordinaria no tiene tope: ''
const textoDeLoQueQueda = (fila, modalidad, calculo, descuentan) => {
  const { tipo } = fila;
  const mes = fila.desde.slice(0, 7);
  if (Object.hasOwn(QUE_SE_REVISA, tipo)) {
    if (descuentan.length === 0) return '';
    const anio = anioDe(descuentan[0]);
    const uso = calculo.topes.find((otro) => otro.tipo === tipo && otro.anio === anio);
    if (uso === undefined || !(uso.tope > 0)) return '';
    const quedan = `Te quedan ${numeroTexto(Math.max(0, uso.tope - uso.usados))} de ${numeroTexto(uso.tope)}`;
    return tipo === 'franquicia' ? `${quedan} horas de franquicia.` : `${quedan}.`;
  }
  if (tipo === 'horas_a_favor') {
    const delMes = calculo.horasAFavor.find((otro) => otro.mes_de_uso === mes);
    const quedan = delMes === undefined ? 0 : quedanDeLasHoras(delMes);
    return `Usás ${textoDeHoras(fila.horas)} a favor de ${nombreDelMes(mes)}. Te quedan ${numeroTexto(quedan)}.`;
  }
  if (tipo === 'franco') {
    const delMes = calculo.francos.find((otro) => otro.mes_de_uso === mes);
    if (delMes === undefined || delMes.usos.length > delMes.francos) return '';
    return `Usás el franco de ${nombreDelMes(mes)}, por las horas extras de ${nombreDelMes(delMes.mes_trabajado)}. `
      + 'Es el día entero.';
  }
  if (tipo === 'uso_autorizado') {
    return textoQuedanNoUtilizadas(modalidad, calculo.noUtilizadas[anioDe(fila.desde)]?.quedan ?? 0);
  }
  return '';
};

// Lo que muestra el cálculo de «Cargar licencia» de una fila ya validada, con el `Calculo` de lo cargado con ella
const vistaDe = (fila, estado, calculo, feriados) => {
  const habiles = diasHabilesDe(fila.desde, fila.hasta, feriados).length;
  const descuentan = diasQueDescuentan(fila, estado, feriados);
  const antesDelArranque = tieneSaldoInicial(fila.tipo, estado.modalidad) && descuentan.length === 0;
  return {
    dias_habiles: habiles,
    texto_dias: textoDeLosDias(fila, estado.modalidad, habiles),
    texto_reparto: fila.tipo === 'vacaciones' ? textoDelReparto(calculo.reparto, fila.id) : '',
    queda_texto: antesDelArranque ? '' : textoDeLoQueQueda(fila, estado.modalidad, calculo, descuentan),
    antes_del_arranque: antesDelArranque,
    texto_antes_del_arranque: antesDelArranque ? TEXTO_ANTES_DEL_ARRANQUE : ''
  };
};

/**
 * Evalúa una licencia antes de guardarla (el alta, la corrección y el cálculo previo de «Cargar licencia»): `{ datos, error,
 * vista }`. Las opciones son las de `validarLicencia`: `{ hoy, feriados, editadaId, uso_autorizado }`. Los controles, en
 * este orden:
 * 1. la modalidad (`sinModalidad`) y el arranque (`sinArranque`), los dos con `campo: null` (sin arranque, `validarLicencia`
 *    no puede controlar «No estudio»);
 * 2. `validarLicencia`;
 * 3. `problemaDeLaCarga`, entre el `Calculo` de lo cargado y el de lo cargado con esta licencia (la corregida, `editadaId`,
 *    reemplaza a la guardada): un faltante nuevo, o más grande, frena la carga.
 * Con un error, `datos` es null. `vista` es null en los pasos 1 y 2; si no, `{ dias_habiles, texto_dias, texto_reparto,
 * queda_texto, antes_del_arranque, texto_antes_del_arranque }`, con lo cargado con esta licencia:
 * - `texto_dias`: «5 días hábiles» o «5 días hábiles de 7 corridos»; en horas, «2 horas»;
 * - `texto_reparto`: en las vacaciones, el de `textoDelReparto`; si no, '';
 * - `queda_texto`: «Te quedan 22 de 25.», «Te quedan 23 de 42 horas de franquicia.», «Usás 1,5 horas a favor de octubre.
 *   Te quedan 0.», la del franco de su mes o lo no utilizado que queda; '' en las vacaciones, la extraordinaria y lo
 *   anterior al arranque;
 * - `antes_del_arranque`: un tipo con saldo inicial cuyos días son todos anteriores al arranque, con
 *   `texto_antes_del_arranque` (`TEXTO_ANTES_DEL_ARRANQUE`; si no, '').
 */
export const evaluarLicencia = (estado, entrada, opciones) => {
  const datosDelEstado = esObjeto(estado) ? estado : {};
  const { hoy, feriados, editadaId, uso_autorizado: usoAutorizado } = esObjeto(opciones) ? opciones : {};
  const frenada = (mensaje) => ({ datos: null, error: { campo: null, mensaje }, vista: null });
  if (!MODALIDADES.includes(datosDelEstado.modalidad)) return frenada(MENSAJES_MI_ESPACIO.sinModalidad);
  if (!esFechaIso(datosDelEstado.arranque)) return frenada(MENSAJES_MI_ESPACIO.sinArranque);

  const { datos, error } = validarLicencia(entrada,
    { hoy, estado: datosDelEstado, feriados, editadaId, uso_autorizado: usoAutorizado });
  if (error) return { datos: null, error, vista: null };

  const editada = idDe(editadaId);
  const fila = { id: editadaId, ...datos };
  const conLaFila = {
    ...datosDelEstado,
    licencias: [...listaDe(datosDelEstado.licencias).filter((otra) => !esObjeto(otra) || idDe(otra.id) !== editada), fila]
  };
  const despues = calcular(conLaFila, { hoy, feriados });
  const problema = problemaDeLaCarga(calcular(datosDelEstado, { hoy, feriados }), despues, editadaId);
  return { datos: problema === null ? datos : null, error: problema, vista: vistaDe(fila, conLaFila, despues, feriados) };
};
