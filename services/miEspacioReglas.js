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
 * hasta }], salidas: [{ id, fecha, entrada, salida, nota }] }`. `arranque` es el día en que cargó su saldo inicial: en los
 * tipos con saldo inicial, lo anterior no descuenta (ya está en el saldo; spec, sección 4). Las horas extras son las de planta
 * (`francosDe`) y las salidas, las de la planilla de contrato (`horasAFavorDe`; spec 2026-10-27-mi-espacio-horas, sección 6):
 * cada modalidad lee solo las suyas. Un estado sin `salidas` cuenta como sin ninguna.
 *
 * Acá están las constantes y los textos de todo Mi espacio (los mensajes, los de las cargas y los del paso a
 * Configuración) y las vacaciones (spec, 3.1): cada año tiene su licencia, que se habilita en dos mitades (el 1/7 y el 1/1
 * del año siguiente) y vence el 31/12 de dos años después; cada carga de vacaciones sigue con la licencia que empezó a usar,
 * aunque pase su vencimiento, y después toma la más vieja que ese día esté habilitada, no vencida y con días libres, con las
 * cargas en el orden de sus fechas (`repartoDeVacaciones`, spec 2026-10-27-mi-espacio-dias-de-vacaciones), y lo que ya no
 * se puede empezar a usar antes de su vencimiento se pierde y se dice «Perdés …» (`textoDePerdidos`). Después, las
 * demás licencias (3.2 a 3.4): lo que suma cada una contra su tope del año (`usoDeLosTopes`), las horas de franquicia que
 * vencen el 31/12 y las que ya no entran en los días libres que quedan (`franquiciaQueVence`, con `diasLibresEntre`; spec
 * 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6) y la validación de una carga (`validarLicencia`, con la regla de 3.8:
 * dos licencias no comparten un día). Por último, las horas extras (3.5 a 3.7): la
 * validación de una carga (`validarHorasExtras`), la planilla de contrato (spec 2026-10-27-mi-espacio-horas: las horas de
 * una salida, `horasDeLaSalida`, el mes que se pide, `mesDeLaPlanilla`, la validación de un día, `validarSalida`, y las
 * salidas guardadas que dejaron de cerrar, `avisosDeSalidas`, que nunca frenan una carga), los francos compensatorios de
 * planta (`francosDe`), las horas a favor de contrato (`horasAFavorDe`, desde las salidas) y lo no utilizado previamente de
 * cada año (`noUtilizadasDe`). Al final, «Mis vacaciones y saldos» (los campos del saldo inicial y el año, sección 4), el
 * cálculo completo (`calcular`), lo guardado que dejó de cerrar (`faltantesDe`, 3.10) y la evaluación de una carga
 * (`evaluarLicencia`: una carga nueva que no cierra no se guarda, y lo que cierra avisa, sin frenarla, lo que hace perder y
 * las otras cargas a las que les cambia de dónde salen las vacaciones: `avisosDeLaCarga`, spec
 * 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2 y 3.4). Y el paso de las ausencias de día entero a Configuración →
 * Licencias (sección 6): qué se hace al cargar, corregir y borrar, lo que dice cada fila (`vinculoDe`, `pasoDeLaCarga`,
 * `pasoDeLaCorreccion`, `pasoDeLaBaja`, `textoDelVinculo`) y lo que el Resumen avisa para revisar (`revisionDelVinculo`, spec
 * 2026-10-28-mi-espacio-licencia-anulada). Por último, lo que ven los compañeros, «Hoy no están» (sección 7:
 * `ausenciasUnidas` y `ausentesDelRango`, sin el tipo, y los dos grupos de «Hoy y mañana», `ausentesDeHoyYManana`), con el
 * nombre de cada uno como lo ven los demás (`nombreCorto`: «Carla», o «Carla B.» si hay otra Carla; spec
 * 2026-10-28-mi-espacio-agenda-onda, 5.1), y lo que dice el email de vencimiento (sección 9: `avisosDeVencimiento`).
 * Los textos son planos: escaparlos le toca a quien los dibuja.
 */
import {
  diasHabilesDe, ultimoDiaHabilDelMesCon, proximoDiaHabilCon, restarDiasHabilesCon, diaDeLaSemana, esDiaHabilCon
} from './feriadosReglas.js';
import {
  diasEntre, esFechaIso, formatoCorto, sumarDias, FERIADOS_FIJOS, CALENDARIO_FIJO
} from './notasDigitalesCalendario.js';
import { puedeTenerLicencia, puedeAnularse, visperaDeLaLicencia } from './licenciasReglas.js';

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
// La planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, sección 3): la jornada termina a las 15:00 (la
// misma para todas las personas de contrato); en un día hábil una media hora vale desde su minuto 16 (pueden faltar hasta 14
// minutos) y en uno que no lo es, aunque falten hasta 10. Se guardan de a 100 días como mucho
export const SALIDA_DE_LA_JORNADA = '15:00';
export const TOLERANCIA_DIA_HABIL = 14;
export const TOLERANCIA_DIA_INHABIL = 10;
export const MAXIMO_DIAS_POR_GUARDADO = 100;

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
  tipoFijo: 'Ya sale la nota que informa quién queda a cargo: el tipo no se puede cambiar.',
  // Los de la planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, secciones 7 y 8)
  horaSalida: 'Escribí la hora como 16:45.',
  salidaQueCuenta: 'Falta la salida: es la que cuenta.',
  salidaFalta: 'Falta la salida.',
  entradaFeriado: 'En un feriado, poné también la entrada.',
  entradaFinde: 'En un sábado o domingo, poné también la entrada.',
  salidaAntes: 'La salida tiene que ser después de la entrada.',
  diaQueNoLlego: 'Ese día todavía no llegó.',
  diaDeLicencia: 'Ese día tenés una licencia de día entero: no se cargan horas.',
  sinDias: 'No hay cambios para guardar.',
  muchosDias: 'Guardá de a 100 días como mucho.',
  diaRepetido: 'Ese día está dos veces.',
  planillaSoloContrato: 'La planilla es para las personas de contrato.',
  contratoEnLaPlanilla: 'Las personas de contrato cargan sus horas en la planilla.',
  mes: 'Elegí un mes válido.'
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
// Un id que es un entero positivo, como número; lo demás (null, 0, lo que no es un id), null
const idPositivoONulo = (valor) => {
  const id = idDe(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};
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
// De qué día es la que se superpone (decisión del usuario, 27/10/2026): la del día anterior que pasa la medianoche o la del
// día siguiente con la que se pisa una que la pasa. Otro valor es el mismo día
const DIA_DEL_HORARIO = Object.freeze({ anterior: 'del día anterior', siguiente: 'del día siguiente' });
export const textoHorarioSuperpuesto = (desde, hasta, dia) =>
  `Se superpone con las horas extras de ${horaTexto(desde)} a ${horaTexto(hasta)} `
  + `${typeof dia === 'string' && Object.hasOwn(DIA_DEL_HORARIO, dia) ? DIA_DEL_HORARIO[dia] : 'de ese día'}.`;
export const textoSaldo = (maximo) => `Escribí un número de 0 a ${numeroTexto(maximo)}.`;

// Los textos del paso a Configuración → Licencias (spec, sección 6), tal cual: textoSuperpuestaConConfiguracion,
// textoNoPaso y TEXTO_NO_DIA_ENTERO no terminan en punto
export const AVISO_DEL_PASO = 'Las fechas pasan a Configuración → Licencias. Mientras dure, no contás como disponible para '
  + 'auditar y no te llegan los recordatorios de cambios para auditar ni los avisos de cambios sin auditor. El tipo no pasa.';
export const AVISO_DEL_PASO_SUPERADMIN = 'Los avisos al superadmin se guardan y te llegan en un resumen a la vuelta.';
export const AVISO_NOTAS_DE_HOY = 'Las notas de hoy ya salieron a las 8:15 con tu firma.';
export const AVISO_SIN_PERSONA_A_CARGO =
  'Sin persona a cargo: esos días no se generan Notas Digitales y lo que venza se reitera cuando vuelvas.';
// A la persona autorizada del firmante, por cada licencia de él con la que se pisa la suya: no la frena (decisión del usuario,
// 27/10/2026)
export const textoAutorizadaDelFirmante = (desde, hasta) =>
  `Sos la persona autorizada del firmante del ${fechaCorta(desde)} al ${fechaCorta(hasta)}: los días que no estés, no se `
  + 'presentan Notas Digitales.';
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
// Lo que quedó distinto en Configuración (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2 y 3.2): sin «Administración»,
// porque pudo haberlo hecho la misma persona
export const TEXTO_ANULADA_EN_CONFIGURACION = 'Se anuló en Configuración: acá sigue contando. Si ya no va, borrala.';
// Las fechas de Configuración en una frase de lo que quedó distinto: «del 04/01 al 08/01» o, de un día, «el 17/11» (ruling
// de la revisión final de la spec 2026-10-28-mi-espacio-licencia-anulada: «del 17/11 al 17/11» se lee mal). Lo que no es una
// fecha, la raya, como el resto de los textos del paso. Los textos de siempre (`textoYaNoCubierta`, `textoEnConfiguracion`, …)
// no la usan
export const fechasEnLaFrase = (desde, hasta) =>
  (esFechaIso(desde) && desde === hasta ? `el ${diaYMes(desde)}` : `del ${diaYMes(desde)} al ${diaYMes(hasta)}`);
export const textoRevisalaEnConfiguracion = (desde, hasta) =>
  `En Configuración quedó ${fechasEnLaFrase(desde, hasta)}: revisala.`;
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

// '1/7/2026': el día de una habilitación, sin ceros
const fechaSinCeros = (fecha) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}/${Number(fecha.slice(0, 4))}`;

/**
 * Cómo se habilita la licencia de un año con unos días de `DIAS_VACACIONES`, para «Mis vacaciones y saldos»: «Se habilitan
 * en dos mitades: 10 el 1/7/2026 y 10 el 1/1/2027 (con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años
 * después.» Las fechas son las de `habilitaciones` y las mitades, las de `mitadesDe` (con un número impar, la primera es la
 * mayor). Unos días que no son de `DIAS_VACACIONES`, o un año que no sirve, null.
 */
export const textoDeLasMitades = (anio, dias) => {
  const fechas = habilitaciones(anio);
  const total = numeroDe(dias);
  if (fechas === null || !DIAS_VACACIONES.includes(total)) return null;
  const [primera, segunda] = mitadesDe(total);
  return `Se habilitan en dos mitades: ${primera} el ${fechaSinCeros(fechas[0])} y ${segunda} el ${fechaSinCeros(fechas[1])} `
    + '(con 15, 8 y 7; con 25, 13 y 12). Cada licencia vence el 31/12 de dos años después.';
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
 * El reparto de las vacaciones (spec 2026-10-27-mi-espacio-dias-de-vacaciones, que cambia la de 3.1): por carga. Cada fila
 * de vacaciones es un pedido aparte (no se junta con la que la sigue), y las filas se reparten en el orden de su primer día
 * que descuenta (y del id): la primera que empieza toma primero. Dentro de una fila, cada día hábil sale de la licencia que
 * la fila ya empezó a usar, aunque haya pasado su vencimiento, mientras le queden días habilitados ese día (la suma de sus
 * mitades habilitadas hasta ese día menos lo ya asignado); cuando no le quedan, o en el primer día, de la más vieja que ese
 * día esté habilitada, no vencida y con días libres; si no hay ninguna, el día queda sin cubrir y el siguiente vuelve a
 * buscar. Así, una carga que empieza a usar la 2024 a más tardar el 31/12/2026 la sigue usando en enero, y una que
 * empieza el 04/01/2027, ya no.
 * Devuelve `{ hoy, ordinarias, porFila, sinCubrir }`:
 * - `ordinarias`: las de `ordinariasDe`, cada una con lo de hoy: `habilitado` (sus mitades habilitadas hasta hoy),
 *   `por_habilitar` (el resto, menos lo cargado a futuro de lo que todavía no se habilitó), `usados` (asignados hasta hoy),
 *   `cargados` (asignados después de hoy), `perdidos` y `disponibles` (lo habilitado que no se asignó, menos los perdidos;
 *   0 si ya venció). `perdidos` (spec 2026-10-27, 2.5) es todo lo que queda sin asignar de una licencia no vencida cuando,
 *   desde hoy y después del hasta de la última fila que la usó (sin ninguna, desde hoy), ya no queda ningún día libre hasta
 *   su vencimiento: un día hábil, con los feriados, fuera de toda licencia de Mi espacio, de cualquier tipo y de cualquier
 *   modalidad (`opciones.ocupadas`, la lista entera que le pasa `calcular`; sin ella, las del estado). Mientras quede uno,
 *   nada se pierde: una carga que empiece ese día la sigue usando después del vencimiento.
 * - `porFila`: un Map de cada id de vacaciones a `[{ anio, dias }]`, por año (una sin días que descuenten, []). El id va
 *   como número (`idDe`): así se busca también con el de un pedido, que llega como texto.
 * - `sinCubrir`: un Map del id (también como número) a sus días sin cubrir, solo de las que tienen alguno.
 * - `hoy`: el de las opciones, o null (`textoDelReparto` lo usa para saber qué licencia vence este año).
 */
export const repartoDeVacaciones = (estado, opciones) => {
  const { hoy, feriados, ocupadas: todas } = esObjeto(opciones) ? opciones : {};
  const datos = esObjeto(estado) ? estado : {};
  const ordinarias = ordinariasDe(datos, hoy);
  const asignados = new Map(ordinarias.map((ordinaria) => [ordinaria.anio, []]));
  const contadosPorFila = new Map();
  const sinCubrir = new Map();

  // Las filas con sus días, en el orden de su primer día (y del id); las que no tienen días no asignan nada
  const filas = [];
  for (const fila of listaDe(datos.licencias)) {
    if (!esObjeto(fila) || fila.tipo !== 'vacaciones') continue;
    const id = idDe(fila.id);
    contadosPorFila.set(id, new Map());
    const dias = diasQueDescuentan(fila, datos, feriados);
    if (dias.length > 0) filas.push({ id, hasta: fila.hasta, dias });
  }
  filas.sort((a, b) => compararTexto(a.dias[0], b.dias[0]) || (a.id || 0) - (b.id || 0));

  // Lo que le queda habilitado a una licencia un día; y, por año, el hasta más tardío de las filas que la usaron
  const libresAl = (ordinaria, fecha) => habilitadoAl(ordinaria, fecha) - asignados.get(ordinaria.anio).length;
  const ultimoUso = new Map();
  for (const { id, hasta, dias } of filas) {
    let actual = null;
    for (const fecha of dias) {
      // Sigue con la que ya empezó aunque haya vencido; si no le quedan, la más vieja vigente ese día
      if (actual === null || libresAl(actual, fecha) <= 0) {
        actual = ordinarias.find((ordinaria) => fecha <= ordinaria.vence && libresAl(ordinaria, fecha) > 0) ?? null;
      }
      if (actual === null) {
        if (!sinCubrir.has(id)) sinCubrir.set(id, []);
        sinCubrir.get(id).push(fecha);
        continue;
      }
      asignados.get(actual.anio).push(fecha);
      const deLaFila = contadosPorFila.get(id);
      deLaFila.set(actual.anio, (deLaFila.get(actual.anio) ?? 0) + 1);
      const previo = ultimoUso.get(actual.anio);
      if (previo === undefined || hasta > previo) ultimoUso.set(actual.anio, hasta);
    }
  }

  const porFila = new Map([...contadosPorFila].map(([id, deLaFila]) =>
    [id, [...deLaFila].sort(([a], [b]) => a - b).map(([anio, cantidad]) => ({ anio, dias: cantidad }))]));

  // Si queda un día libre de la fecha al tope: el primer día hábil fuera de toda licencia de Mi espacio (de cualquier tipo y
  // de cualquier modalidad: las de `opciones.ocupadas`, si llegan, o las del estado); los días dentro de una se saltean de una
  // vez, hasta el día después de su hasta
  const ocupadas = listaDe(Array.isArray(todas) ? todas : datos.licencias).filter((fila) =>
    esObjeto(fila) && esFechaIso(fila.desde) && esFechaIso(fila.hasta));
  const hayDiaLibre = (desde, tope) => {
    let dia = proximoDiaHabilCon(desde, feriados);
    while (dia !== null && dia <= tope) {
      const encima = ocupadas.filter((fila) => fila.desde <= dia && dia <= fila.hasta);
      if (encima.length === 0) return true;
      const hasta = encima.reduce((ultimo, fila) => (fila.hasta > ultimo ? fila.hasta : ultimo), dia);
      dia = proximoDiaHabilCon(sumarDias(hasta, 1), feriados);
    }
    return false;
  };

  return {
    hoy: esFechaIso(hoy) ? hoy : null,
    ordinarias: ordinarias.map((ordinaria) => {
      const suyos = asignados.get(ordinaria.anio);
      const habilitado = habilitadoAl(ordinaria, hoy);
      const usados = suyos.filter((fecha) => fecha <= hoy).length;
      const quedan = ordinaria.vence < hoy ? 0 : Math.max(0, habilitado - suyos.length);
      // El día libre se busca desde hoy o, si es más tarde, desde el día después de la última fila que la usó
      const ultimo = ultimoUso.get(ordinaria.anio);
      const despues = esFechaIso(ultimo) ? sumarDias(ultimo, 1) : hoy;
      const perdidos = quedan > 0 && !hayDiaLibre(despues > hoy ? despues : hoy, ordinaria.vence) ? quedan : 0;
      return {
        ...ordinaria,
        habilitado,
        por_habilitar: ordinaria.total - habilitado - Math.max(0, suyos.length - habilitado),
        usados,
        cargados: suyos.length - usados,
        disponibles: quedan - perdidos,
        perdidos
      };
    }),
    porFila,
    sinCubrir
  };
};

// «2 de la 2024 (vencen el 31/12/2026) y 1 de la 2025 (vence el 31/12/2027)», de las ordinarias con `perdidos` mayor que 0;
// sin ninguna, ''
const perdidosEnLista = (ordinarias) => enLista(listaDe(ordinarias)
  .filter((ordinaria) => esObjeto(ordinaria) && numeroDe(ordinaria.perdidos) > 0)
  .map(({ anio, perdidos, vence }) =>
    `${numeroTexto(perdidos)} de la ${anioTexto(anio)} (${esUna(perdidos) ? 'vence' : 'vencen'} el ${fechaCorta(vence)})`));

/**
 * Lo que se pierde de las vacaciones (spec 2026-10-27-mi-espacio-dias-de-vacaciones, 2.6), el mismo texto en el aviso del
 * modal y en la bajada del Resumen: «Perdés 2 de la 2024 (vencen el 31/12/2026) y 1 de la 2025 (vence el 31/12/2027).», de
 * las ordinarias con `perdidos` mayor que 0, en el orden de la lista («vence», con uno). Las entradas que no son objetos se
 * saltean; sin ninguna con perdidos, ''.
 */
export const textoDePerdidos = (ordinarias) => {
  const lista = perdidosEnLista(ordinarias);
  return lista === '' ? '' : `Perdés ${lista}.`;
};

// Lo que una carga hace perder (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2), los avisos del cálculo de
// «Cargar licencia» (`avisosDeLaCarga`):
// - los días de vacaciones, con las ordinarias de la diferencia (como `textoDePerdidos`): «Con esta licencia perdés 3 de
//   la 2024 (vencen el 31/12/2026).»; sin ninguna, '';
// - el franco o las horas a favor de un mes 'AAAA-MM' que se quedan sin ningún día libre, con el último día del mes (no
//   el último hábil: un franco tomado se puede registrar después): «Tu franco de diciembre se queda sin días libres: vence
//   el 31/12/2026.» («Tus 2 francos de diciembre se quedan …: vencen …») y «Tus 3 horas a favor de diciembre se quedan
//   sin días libres: vencen el 31/12/2026.» («Tu hora a favor …», con 1);
// - las horas de franquicia: «Con esta licencia perdés 8 horas de franquicia (vencen el 31/12/2026).» (con 1, «1 hora
//   … vence»).
export const textoDePerdidosConLaCarga = (ordinarias) => {
  const lista = perdidosEnLista(ordinarias);
  return lista === '' ? '' : `Con esta licencia perdés ${lista}.`;
};
// El último día de un mes 'AAAA-MM' (el 28 o el 29 de febrero, según el año), o null si no es un mes
const ultimoDiaDelMes = (mes) => {
  if (!esMes(mes)) return null;
  const siguiente = mesMas(mes, 1);
  return siguiente === null ? `${mes}-31` : sumarDias(`${siguiente}-01`, -1);
};
export const textoDelFrancoSinDiasLibres = (cantidad, mes) => {
  const vence = fechaCorta(ultimoDiaDelMes(mes));
  return esUna(cantidad)
    ? `Tu franco de ${nombreDelMes(mes)} se queda sin días libres: vence el ${vence}.`
    : `Tus ${numeroTexto(cantidad)} francos de ${nombreDelMes(mes)} se quedan sin días libres: vencen el ${vence}.`;
};
export const textoDeLasHorasSinDiasLibres = (horas, mes) => {
  const vence = fechaCorta(ultimoDiaDelMes(mes));
  return esUna(horas)
    ? `Tu hora a favor de ${nombreDelMes(mes)} se queda sin días libres: vence el ${vence}.`
    : `Tus ${numeroTexto(horas)} horas a favor de ${nombreDelMes(mes)} se quedan sin días libres: vencen el ${vence}.`;
};
export const textoDeLaFranquiciaPerdida = (horas, vence) => `Con esta licencia perdés ${textoDeHoras(horas)} de franquicia `
  + `(${esUna(horas) ? 'vence' : 'vencen'} el ${fechaCorta(vence)}).`;

/**
 * Lo que todavía no se habilitó de cada licencia ordinaria y no está asignado a ninguna carga (spec
 * 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.1): `[{ fecha, anio, dias }]`, una entrada por cada mitad que se habilita
 * después de hoy, con su parte del `por_habilitar` de la ordinaria. Lo ya asignado de más (lo cargado a futuro de lo que
 * todavía no se habilitó) consume primero la mitad más temprana: con 13 de más en la 2027, la del 1/7/2027 queda en 0 y a la
 * del 1/1/2028 le quedan 7. Solo las entradas con días, por fecha y después por año. Es una sola cuenta para todos los
 * lugares, y cada uno elige qué fechas nombra. Recibe las `ordinarias` de `repartoDeVacaciones` tal cual, con el mismo hoy;
 * sin un hoy válido, []. Una ordinaria sin un año, o con un `por_habilitar` que no es un número, no suma nada.
 */
export const porHabilitarDe = (ordinarias, hoy) => {
  if (!esFechaIso(hoy)) return [];
  const entradas = [];
  for (const ordinaria of listaDe(ordinarias)) {
    if (!esObjeto(ordinaria)) continue;
    const anio = anioValido(ordinaria.anio);
    const porHabilitar = numeroDe(ordinaria.por_habilitar);
    if (anio === null || !Number.isFinite(porHabilitar)) continue;
    const futuras = listaDe(ordinaria.mitades)
      .filter((mitad) => esObjeto(mitad) && esFechaIso(mitad.habilita) && mitad.habilita > hoy
        && Number.isInteger(numeroDe(mitad.dias)) && numeroDe(mitad.dias) > 0)
      .map((mitad) => ({ habilita: mitad.habilita, dias: numeroDe(mitad.dias) }))
      .sort((a, b) => compararTexto(a.habilita, b.habilita));
    // Lo asignado de más es lo que falta habilitar menos lo que queda por habilitar
    let deMas = Math.max(0, futuras.reduce((suma, mitad) => suma + mitad.dias, 0) - porHabilitar);
    for (const { habilita, dias } of futuras) {
      const consumidos = Math.min(dias, deMas);
      deMas -= consumidos;
      if (dias > consumidos) entradas.push({ fecha: habilita, anio, dias: dias - consumidos });
    }
  }
  return entradas.sort((a, b) => compararTexto(a.fecha, b.fecha) || a.anio - b.anio);
};

// Lo que nombra el cálculo de una carga de lo que se habilita después (los `extras` de `textoDelReparto`): las habilitaciones
// que sirven, hasta el hasta de la carga o su alcance; el alcance, solo si es una fecha posterior al hasta. Sin extras, nada
const habilitacionesQueSeNombran = (extras) => {
  if (!esObjeto(extras)) return { habilitaciones: [], alcance: null };
  const hasta = esFechaIso(extras.hasta) ? extras.hasta : null;
  const alcance = esFechaIso(extras.alcance) && (hasta === null || extras.alcance > hasta) ? extras.alcance : null;
  const tope = alcance ?? hasta;
  const habilitaciones = listaDe(extras.habilitaciones).filter((habilitacion) => esObjeto(habilitacion)
    && esFechaIso(habilitacion.fecha) && anioValido(habilitacion.anio) !== null && numeroDe(habilitacion.dias) > 0
    && (tope === null || habilitacion.fecha <= tope));
  return { habilitaciones, alcance };
};

// «El 1/1/2027 se habilitan 10 más de la 2026 y el 1/7/2027, 10 de la 2027.» («se habilita», con 1 en la primera); con el
// alcance, el punto final es «: esta licencia puede llegar hasta el 24/02/2027.». Sin ninguna habilitación, '' (el alcance
// va en la misma oración: solo se nombra con lo que se habilita)
const textoDeLasHabilitaciones = (habilitaciones, alcance) => {
  if (habilitaciones.length === 0) return '';
  const [primera, ...resto] = habilitaciones;
  const partes = [
    `El ${fechaSinCeros(primera.fecha)} ${esUna(primera.dias) ? 'se habilita' : 'se habilitan'} `
      + `${numeroTexto(primera.dias)} más de la ${anioTexto(primera.anio)}`,
    ...resto.map(({ fecha, anio, dias }) => `el ${fechaSinCeros(fecha)}, ${numeroTexto(dias)} de la ${anioTexto(anio)}`)
  ];
  return `${enLista(partes)}${alcance === null ? '.' : `: esta licencia puede llegar hasta el ${fechaCorta(alcance)}.`}`;
};

// Los errores de días de unas vacaciones (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3), los que arma
// `evaluarLicencia` en lugar de `textoSinHabilitados` (que sigue siendo el `mensaje` de los faltantes):
// - la que se queda corta es esta carga y entra hasta su alcance: «No te alcanzan los días habilitados: esta licencia puede
//   llegar hasta el 24/02/2027.»;
// - esta carga, sin ningún día: «No te alcanzan los días habilitados para el 21/06/2027.» y, con lo primero que se habilita
//   después (una entrada de `porHabilitarDe`), « El 1/7/2027 se habilitan 5 más de la 2027.» (una que no sirve, no va);
// - otra carga guardada: «Con estos días, a tus vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.», con
//   sus fechas como en la lista (`fechasDeLaCarga`) y su primer día sin cubrir; de un día, sin «desde»: «… del 04/01/2027
//   les faltan días.».
export const textoHastaDondeAlcanza = (alcance) =>
  `No te alcanzan los días habilitados: esta licencia puede llegar hasta el ${fechaCorta(alcance)}.`;
export const textoSinNingunDia = (fecha, habilitacion) => {
  const { habilitaciones } = habilitacionesQueSeNombran({ habilitaciones: [habilitacion] });
  return [`No te alcanzan los días habilitados para el ${fechaCorta(fecha)}.`, textoDeLasHabilitaciones(habilitaciones, null)]
    .filter((parte) => parte !== '').join(' ');
};
// Las fechas de una carga como en la lista: «del 04/01 al 22/01/2027» (el año solo al final si los dos son del mismo),
// «del 28/12/2026 al 08/01/2027» o, de un día, «del 04/01/2027»
const fechasDeLaCarga = (desde, hasta) => {
  if (esFechaIso(desde) && desde === hasta) return `del ${fechaCorta(desde)}`;
  const mismoAnio = esFechaIso(desde) && esFechaIso(hasta) && anioDe(desde) === anioDe(hasta);
  return `del ${mismoAnio ? diaYMes(desde) : fechaCorta(desde)} al ${fechaCorta(hasta)}`;
};
export const textoFaltanEnOtraCarga = (desde, hasta, dia) => {
  const deUnDia = esFechaIso(desde) && desde === hasta;
  return `Con estos días, a tus vacaciones ${fechasDeLaCarga(desde, hasta)} les faltan días`
    + `${deUnDia ? '' : ` desde el ${fechaCorta(dia)}`}.`;
};

// Otra carga de vacaciones guardada a la que esta le cambia de dónde salen los días (spec
// 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.4), con sus fechas como en la lista y sus partes nuevas (las de `porFila`):
// «Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de las licencias 2025 (5 días) y 2026 (10
// días).» o, de una sola licencia, «… ahora de la licencia 2025.». Sin ninguna parte, ''
export const textoDelReacomodo = (desde, hasta, partes) => {
  const suyas = listaDe(partes).filter(esObjeto);
  if (suyas.length === 0) return '';
  const deDonde = suyas.length === 1
    ? `de la licencia ${anioTexto(suyas[0].anio)}`
    : `de las licencias ${enLista(suyas.map(({ anio, dias }) => `${anioTexto(anio)} (${diasTexto(dias)})`))}`;
  return `Esta carga cambia de dónde salen tus vacaciones ${fechasDeLaCarga(desde, hasta)}: ahora ${deDonde}.`;
};

/**
 * De qué licencia salen los días de unas vacaciones y lo que queda (spec, 3.1): «Salen de la licencia 2024, la más vieja.
 * Te quedan 33 días: 3 de la 2024 (vencen el 31/12/2026), 20 de la 2025 y 10 de la 2026.» Con varias, «Salen de las
 * licencias 2024 (3 días) y 2025 (2 días), las más viejas.»; lo que queda son los disponibles de hoy, con «(vencen el …)»
 * («vence», con uno) en la que vence el 31/12 del año de hoy, «, todos de la 2026» si es una sola, o «No te quedan días
 * disponibles.». Después, si algo se pierde, `textoDePerdidos`: «… y 10 de la 2026. Perdés 2 de la 2024 (vencen el
 * 31/12/2026).» (spec 2026-10-27, 2.6). Sin días de esa fila que salgan de una licencia (antes del arranque, sin cubrir o un
 * id que no está), ''.
 * `extras` (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.1; opcional: sin él, el texto de siempre) es `{
 * habilitaciones, alcance, hasta }`: lo que se habilita después (las entradas de `porHabilitarDe`, en ese orden), el alcance
 * de la carga (`alcanceDeLaCarga`) y su hasta. Se nombran las habilitaciones hasta el hasta o el alcance (lo que sea más
 * tarde), después de lo que queda y antes de lo que se pierde: «… No te quedan días disponibles hoy. El 1/1/2027 se habilitan
 * 10 más de la 2026: esta licencia puede llegar hasta el 24/02/2027.» («hoy», solo si hay alguna que nombrar; el alcance,
 * solo si es posterior al hasta).
 */
export const textoDelReparto = (reparto, filaId, extras) => {
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
  const { habilitaciones, alcance } = habilitacionesQueSeNombran(extras);
  let quedan;
  if (conDias.length === 0) {
    quedan = habilitaciones.length > 0 ? 'No te quedan días disponibles hoy.' : 'No te quedan días disponibles.';
  } else if (conDias.length > 1) {
    quedan = `Te quedan ${diasTexto(total)}: ${enLista(conDias.map((o) => `${numeroTexto(o.disponibles)} ${deLa(o)}`))}.`;
  } else if (total === 1) quedan = `Te queda 1 día ${deLa(conDias[0])}.`;
  else quedan = `Te quedan ${diasTexto(total)}, todos ${deLa(conDias[0])}.`;
  return [salen, quedan, textoDeLasHabilitaciones(habilitaciones, alcance), textoDePerdidos(reparto.ordinarias)]
    .filter((parte) => parte !== '').join(' ');
};

// El rango de fechas de una licencia o de unas horas extras: del 01/01 de dos años antes al 31/12 del año siguiente
// (`{ desde, hasta }`), o null si hoy no es una fecha
export const rangoDeFechas = (hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = anioDe(hoy);
  const rango = { desde: fechaDe(anio - 2, '01-01'), hasta: fechaDe(anio + 1, '12-31') };
  return esFechaIso(rango.desde) && esFechaIso(rango.hasta) ? rango : null;
};

// Las ausencias de día completo (spec, sección 6): las licencias de días enteros, y las de horas con la jornada entera (de
// TIPOS_POR_HORAS, public/js/mi-espacio.js tiene una copia, TIPOS_CON_HORAS, atada por un test de paridad)
const TIPOS_DE_DIA_ENTERO = Object.freeze([
  'vacaciones', 'estudios', 'medica', 'medica_extraordinaria', 'familiar', 'franco'
]);
export const TIPOS_POR_HORAS = Object.freeze(['franquicia', 'horas_a_favor', 'uso_autorizado']);
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

// Los días libres de desde a hasta (los de `diasLibresEntre`), contados de a uno: con un `tope`, deja de contar al llegar a él
// (a la franquicia le alcanza con saber si hay los que necesita, y así no recorre el año entero en cada cálculo)
const contarDiasLibres = (desde, hasta, ocupadas, feriados, tope = Infinity) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return 0;
  // Solo las que tocan el rango
  const encima = listaDe(ocupadas).filter((fila) => esObjeto(fila) && esFechaIso(fila.desde) && esFechaIso(fila.hasta)
    && fila.desde <= hasta && desde <= fila.hasta);
  let libres = 0;
  // Se cuentan los días, no se compara el texto (como `diasHabilesDe`: después del 9999-12-31, sumarDias da '+010000-01')
  const total = diasEntre(desde, hasta) + 1;
  for (let i = 0, dia = desde; i < total && libres < tope; i++, dia = sumarDias(dia, 1)) {
    if (esDiaHabilCon(dia, feriados) && !encima.some((fila) => fila.desde <= dia && dia <= fila.hasta)) libres += 1;
  }
  return libres;
};

/**
 * Cuántos días libres hay de `desde` a `hasta`, los dos incluidos (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2,
 * 3.6 y 3.7): los días hábiles con los feriados (`esDiaHabilCon`) que no caen dentro de ninguna fila de `ocupadas`
 * (`{ desde, hasta }`: las licencias de Mi espacio de cualquier tipo y de cualquier modalidad, las mismas que `calcular` le
 * pasa al reparto). Dos licencias no comparten un día: una franquicia de 2 horas también ocupa el suyo. Una fila sin sus dos
 * fechas no ocupa nada. Con hasta antes que desde, o alguna que no es una fecha, 0.
 */
export const diasLibresEntre = (desde, hasta, ocupadas, feriados) => contarDiasLibres(desde, hasta, ocupadas, feriados);

/**
 * Las horas de franquicia del año de hoy, que vencen el 31/12 (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6), solo
 * en planta: `{ quedan, perdidas, disponibles }`. `quedan` es lo de siempre: las 42 horas menos lo usado y lo cargado del año
 * de hoy (lo de `usoDeLosTopes`: `calculo.topes` o, sin él, el de lo cargado), nunca menos de 0. En cada día libre de hoy al
 * 31/12 (`diasLibresEntre`, con `opciones.ocupadas` o, sin ellas, las licencias del estado) entran hasta 7 horas (`JORNADA`),
 * y lo que no entra se pierde: `perdidas` = máx(0, quedan − 7 × días libres), y `disponibles` es lo que queda. Las perdidas
 * no cuentan en «Vence pronto» ni en el email de vencimiento. En contrato, sin modalidad o sin un hoy válido, null.
 */
export const franquiciaQueVence = (estado, calculo, opciones) => {
  const { hoy, feriados, ocupadas } = esObjeto(opciones) ? opciones : {};
  if (!esObjeto(estado) || estado.modalidad !== 'planta' || !esFechaIso(hoy)) return null;
  const anio = anioDe(hoy);
  const topes = esObjeto(calculo) && Array.isArray(calculo.topes) ? calculo.topes : usoDeLosTopes(estado, { feriados });
  const usados = numeroDe(topes.find((uso) => esObjeto(uso) && uso.tipo === 'franquicia' && uso.anio === anio)?.usados);
  const quedan = Math.max(0, TOPES.franquicia - (Number.isFinite(usados) ? usados : 0));
  // Los días libres hacen falta solo hasta que entra todo lo que queda: con esos, no se pierde nada
  const libres = contarDiasLibres(hoy, fechaDe(anio, '12-31'), Array.isArray(ocupadas) ? ocupadas : estado.licencias, feriados,
    Math.ceil(quedan / JORNADA));
  const perdidas = Math.max(0, quedan - JORNADA * libres);
  return { quedan, perdidas, disponibles: quedan - perdidas };
};

// Los tipos de un solo día: desde y hasta son el mismo (public/js/mi-espacio.js tiene una copia, atada por un test de paridad)
export const TIPOS_DE_UN_DIA = Object.freeze(['franquicia', 'franco', 'horas_a_favor', 'uso_autorizado']);
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
export const MESES_HASTA_EL_FRANCO = 2;
export const MESES_HASTA_LAS_HORAS = 1;
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

// Las horas extras que se superponen con las que empiezan en `inicio` (minutos desde las 00:00 de la fecha) y duran
// `horas`, sin las que se corrigen: `{ inicio, desde, hasta, dia }` de la que empieza primero, o null. Una que pasa la
// medianoche ocupa hasta esa hora del día siguiente, así que se miran también la del día anterior y la del siguiente
// (decisión del usuario, 27/10/2026; `dia`: 'anterior', 'mismo' o 'siguiente'; un horario dura menos de 24 horas, así que
// no hace falta mirar más lejos); dos pegadas no se superponen
const primeraSuperpuesta = (horasExtras, fecha, inicio, horas, editadaId) => {
  const editada = idDe(editadaId);
  const fin = inicio + horas * 60;
  const dias = new Map([[sumarDias(fecha, -1), ['anterior', -24 * 60]], [fecha, ['mismo', 0]],
    [sumarDias(fecha, 1), ['siguiente', 24 * 60]]]);
  let primera = null;
  for (const fila of listaDe(horasExtras)) {
    if (!esObjeto(fila) || !dias.has(fila.fecha) || idDe(fila.id) === editada) continue;
    const suyas = horasDe(fila.desde, fila.hasta);
    if (suyas === null) continue;
    const [dia, corrimiento] = dias.get(fila.fecha);
    const suyoInicio = minutosDe(fila.desde) + corrimiento;
    if (suyoInicio >= fin || inicio >= suyoInicio + suyas * 60) continue;
    if (primera === null || suyoInicio < primera.inicio) {
      primera = { inicio: suyoInicio, desde: fila.desde, hasta: fila.hasta, dia };
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
 * 4. que no se superponga con otras del mismo día, con la del día anterior que pasa la medianoche ni, si esta la pasa, con
 *    el comienzo de la del día siguiente (`primeraSuperpuesta`): `textoHorarioSuperpuesto` con la que empieza primero y su
 *    día, en `desde`.
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
  if (otra !== null) return rechazo('desde', textoHorarioSuperpuesto(otra.desde, otra.hasta, otra.dia));

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

// La planilla de contrato (spec 2026-10-27-mi-espacio-horas, secciones 3 y 7): cada día, una salida y, si se quiere, la
// entrada. En un día hábil cuenta solo la salida, desde las 15:00; en un feriado, un sábado o un domingo, la entrada es
// obligatoria y cuenta de la entrada a la salida. Las horas no se guardan: se calculan con los feriados del momento.

const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// Una hora 'HH:MM' de un día, con cualquier minuto (de 00:00 a 23:59): «16:46:00», «9:05» o «25:00» no lo son
export const horaSalidaValida = (hora) => typeof hora === 'string' && PATRON_HORA.test(hora);
// La hora en minutos desde las 00:00, o null si no es una hora de `horaSalidaValida` (minutosDe acepta solo :00 y :30)
const minutosDeLaHora = (hora) => (horaSalidaValida(hora) ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null);

/**
 * El tipo de un día para la planilla: 'habil' (de lunes a viernes, que no es feriado: `esDiaHabilCon`), 'feriado' (uno del
 * Set o de los 9 fijos, aunque caiga sábado o domingo) o 'finde' (un sábado o un domingo que no es feriado). null si no es
 * una fecha. Un segundo parámetro que no es un Set no suma feriados (los fijos siguen siéndolo).
 */
export const tipoDeDia = (fecha, feriados) => {
  if (!esFechaIso(fecha)) return null;
  if (esDiaHabilCon(fecha, feriados)) return 'habil';
  const enElSet = feriados instanceof Set && feriados.has(fecha);
  // No es hábil: o es feriado (del Set o fijo) o es sábado o domingo
  return enElSet || FERIADOS_FIJOS.includes(fecha.slice(5)) ? 'feriado' : 'finde';
};

/**
 * Las horas extras de un día de la planilla (spec, sección 3), de a 0,5, o null:
 * - en un día hábil, los minutos después de las 15:00 (`SALIDA_DE_LA_JORNADA`; antes, 0), con una media hora desde su minuto
 *   16: `floor((minutos + 14) / 30) / 2`. La entrada no cuenta;
 * - en un feriado, un sábado o un domingo, los minutos de la entrada a la salida, con 10 de tolerancia:
 *   `floor((minutos + 10) / 30) / 2`.
 * null sin una fecha o una salida válidas (`horaSalidaValida`), en un día que no es hábil sin una entrada válida, o con una
 * entrada válida y la salida antes o igual que ella (también en un día hábil). Nunca tira.
 */
export const horasDeLaSalida = (dia, feriados) => {
  if (!esObjeto(dia)) return null;
  const tipo = tipoDeDia(dia.fecha, feriados);
  const salida = minutosDeLaHora(dia.salida);
  if (tipo === null || salida === null) return null;
  const entrada = minutosDeLaHora(dia.entrada);
  if (entrada !== null && salida <= entrada) return null;
  if (tipo === 'habil') {
    const minutos = Math.max(0, salida - minutosDeLaHora(SALIDA_DE_LA_JORNADA));
    return Math.floor((minutos + TOLERANCIA_DIA_HABIL) / 30) / 2;
  }
  if (entrada === null) return null;
  return Math.floor((salida - entrada + TOLERANCIA_DIA_INHABIL) / 30) / 2;
};

// Las horas extras de cada mes de la planilla ('AAAA-MM' → horas), de los meses más viejos a los más nuevos, como
// `horasPorMes`: cada día en el mes de su fecha. Lo que da null no suma (un día que da 0 deja su mes, con 0)
export const horasPorMesDeSalidas = (salidas, feriados) => {
  const porMes = new Map();
  for (const fila of listaDe(salidas)) {
    const horas = horasDeLaSalida(fila, feriados);
    if (horas === null) continue;
    const mes = fila.fecha.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + horas);
  }
  return new Map([...porMes].sort(([a], [b]) => compararTexto(a, b)));
};

// Unas horas en días de franco (cada 7, `JORNADA`) y las horas que sobran, con un decimal: `{ dias, resto }`; con lo que no
// es un número positivo, `{ dias: 0, resto: 0 }`
const diasYHorasDe = (horas) => {
  if (typeof horas !== 'number' || !Number.isFinite(horas) || horas <= 0) return { dias: 0, resto: 0 };
  const total = Math.round(horas * 10) / 10;
  const dias = Math.floor(total / JORNADA);
  return { dias, resto: Math.round((total - dias * JORNADA) * 10) / 10 };
};

/**
 * Unas horas dichas en días de franco (spec, sección 3): cada 7 horas (`JORNADA`) son un día y lo que sobra, horas: «2 días
 * de franco y 4,5 horas», «3 días de franco», «4,5 horas», «1 día de franco», «1 hora» (singular solo con 1). '' con 0 o con
 * lo que no es un número positivo.
 */
export const enDiasDeFranco = (horas) => {
  const { dias, resto } = diasYHorasDe(horas);
  const enDias = dias > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'} de franco` : '';
  const enHoras = resto > 0 ? textoDeHoras(resto) : '';
  return [enDias, enHoras].filter((parte) => parte !== '').join(' y ');
};

/**
 * La frase de la banda de la planilla (spec, sección 4), plana: lo que suman las horas de `mes` ('AAAA-MM') en el mes
 * siguiente, en minúscula y sin año. En el mes de hoy (o uno posterior), «En noviembre vas a tener 2 días de franco y 4,5
 * horas a favor.»; en uno que ya pasó, «En octubre tuviste 1 día de franco y 3,5 horas a favor.»; «a favor» va solo con
 * horas sueltas («En enero vas a tener 3 días de franco.»). Sin horas, con el mes de las horas: «Todavía no sumaste horas
 * extras en octubre.» o «En septiembre no hiciste horas extras.». Sin un mes o un hoy válidos, ''.
 */
export const textoDeLaSumaDelMes = (mes, horas, hoy) => {
  if (!esMes(mes) || !esFechaIso(hoy)) return '';
  const paso = mes < hoy.slice(0, 7);
  const enDias = enDiasDeFranco(horas);
  if (enDias === '') {
    return paso ? `En ${nombreDelMes(mes)} no hiciste horas extras.`
      : `Todavía no sumaste horas extras en ${nombreDelMes(mes)}.`;
  }
  const siguiente = mesMas(mes, MESES_HASTA_LAS_HORAS);
  if (siguiente === null) return '';
  const aFavor = diasYHorasDe(horas).resto > 0 ? ' a favor' : '';
  return `En ${nombreDelMes(siguiente)} ${paso ? 'tuviste' : 'vas a tener'} ${enDias}${aFavor}.`;
};

/**
 * El mes de la planilla que se pide (`GET /api/mi-espacio/salidas?mes=`; spec 2026-10-27-mi-espacio-horas, sección 8), como
 * 'AAAA-MM', o null: sin valor (no vino, null o ''), el mes de hoy; un mes 'AAAA-MM' del primero de `rangoDeFechas` (enero de
 * hace dos años) al de hoy, ese. Cualquier otra cosa (otro formato, un mes que todavía no llegó o anterior al rango, una lista
 * —el parámetro repetido, como lo da Express—), null. Sin un hoy válido, null.
 */
export const mesDeLaPlanilla = (valor, hoy) => {
  const rango = rangoDeFechas(hoy);
  if (rango === null) return null;
  const deHoy = hoy.slice(0, 7);
  if (valor === undefined || valor === null || valor === '') return deHoy;
  return esMes(valor) && valor >= rango.desde.slice(0, 7) && valor <= deHoy ? valor : null;
};

/**
 * La licencia de día entero de Mi espacio que tiene la persona ese día, o null: una del estado (solo las activas) que cubre la
 * fecha (`desde ≤ fecha ≤ hasta`), de día entero (`esDiaEntero`: también las horas a favor o el uso autorizado de 7 horas), de
 * la modalidad de hoy (no `fueraDeLaModalidad`) y con la fecha hábil (`esDiaHabilCon`: el sábado, el domingo o el feriado del
 * medio de unas vacaciones no son de licencia). Cuenta también una anterior al arranque: ese día no estuvo. Sin un estado o
 * una fecha válidos, null.
 */
export const licenciaDeDiaEnteroEn = (estado, fecha, feriados) => {
  if (!esObjeto(estado) || !esDiaHabilCon(fecha, feriados)) return null;
  return listaDe(estado.licencias).find((fila) => esObjeto(fila) && esFechaIso(fila.desde) && esFechaIso(fila.hasta)
    && fila.desde <= fecha && fecha <= fila.hasta && esDiaEntero(fila) && !fueraDeLaModalidad(fila, estado.modalidad))
    ?? null;
};

/**
 * Valida un día de la planilla, `{ fecha, entrada, salida, nota }`. El contexto es `{ hoy, estado, feriados }`. Devuelve
 * `{ datos, error }`, como `validarLicencia`: `datos` es `{ fecha, entrada, salida, nota, borrar }` (la entrada y la nota
 * vacías, null). Primero, el formato de la fecha (`fecha`); después, un día con la entrada, la salida y la nota vacías es un
 * borrado (`borrar: true`, con todo en null) y pasa siempre (también un día que no llegó, uno de licencia o uno fuera del
 * rango: así se puede quitar cualquier salida guardada). Si no, en este orden (spec, sección 7):
 * 1. la fecha, del 01/01 de dos años antes (`rangoDeFechas`) a hoy: antes, `textoRango` hasta hoy; después,
 *    `diaQueNoLlego`, los dos en `fecha`;
 * 2. que no sea un día de licencia de día entero (`licenciaDeDiaEnteroEn`): `diaDeLicencia`, en `fecha`;
 * 3. las horas, 'HH:MM' (`horaSalidaValida`): `horaSalida` en `entrada` o en `salida`, la entrada primero;
 * 4. la salida, obligatoria (hay entrada o nota): en un día hábil `salidaQueCuenta` y en uno que no lo es `salidaFalta`;
 * 5. la entrada, obligatoria en un día que no es hábil: `entradaFeriado` o `entradaFinde`;
 * 6. si hay entrada, la salida después de ella (también en un día hábil): `salidaAntes`, en `salida`;
 * 7. la nota: recortada, de hasta 200 caracteres contados con Array.from (lo que no es un texto es vacío).
 * Vacía es no venir, null o un texto de espacios. Las horas no se recortan. Sin un hoy válido no pasa ninguna fecha (salvo un
 * borrado); un día o un contexto que no son objetos cuentan como `{}`. La modalidad y el arranque los controla quien la llama.
 */
export const validarSalida = (dia, contexto) => {
  const fuente = esObjeto(dia) ? dia : {};
  const { hoy, estado, feriados } = esObjeto(contexto) ? contexto : {};
  const { fecha, entrada, salida } = fuente;
  if (!esFechaIso(fecha)) return rechazo('fecha', MENSAJES_MI_ESPACIO.fecha);

  const nota = typeof fuente.nota === 'string' ? fuente.nota.trim() : '';
  const sinEntrada = esVacio(entrada);
  const sinSalida = esVacio(salida);
  if (sinEntrada && sinSalida && nota === '') {
    return { datos: { fecha, entrada: null, salida: null, nota: null, borrar: true }, error: null };
  }

  const rango = rangoDeFechas(hoy);
  if (rango === null) return rechazo('fecha', MENSAJES_MI_ESPACIO.fecha);
  if (fecha < rango.desde) return rechazo('fecha', textoRango(rango.desde, hoy));
  if (fecha > hoy) return rechazo('fecha', MENSAJES_MI_ESPACIO.diaQueNoLlego);
  if (licenciaDeDiaEnteroEn(estado, fecha, feriados) !== null) return rechazo('fecha', MENSAJES_MI_ESPACIO.diaDeLicencia);

  if (!sinEntrada && !horaSalidaValida(entrada)) return rechazo('entrada', MENSAJES_MI_ESPACIO.horaSalida);
  if (!sinSalida && !horaSalidaValida(salida)) return rechazo('salida', MENSAJES_MI_ESPACIO.horaSalida);

  const tipo = tipoDeDia(fecha, feriados);
  if (sinSalida) {
    return rechazo('salida', tipo === 'habil' ? MENSAJES_MI_ESPACIO.salidaQueCuenta : MENSAJES_MI_ESPACIO.salidaFalta);
  }
  if (tipo !== 'habil' && sinEntrada) {
    return rechazo('entrada', tipo === 'feriado' ? MENSAJES_MI_ESPACIO.entradaFeriado : MENSAJES_MI_ESPACIO.entradaFinde);
  }
  if (!sinEntrada && minutosDeLaHora(salida) <= minutosDeLaHora(entrada)) {
    return rechazo('salida', MENSAJES_MI_ESPACIO.salidaAntes);
  }
  if (Array.from(nota).length > LARGO_NOTA) return rechazo('nota', MENSAJES_MI_ESPACIO.nota);

  return {
    datos: { fecha, entrada: sinEntrada ? null : entrada, salida, nota: nota === '' ? null : nota, borrar: false },
    error: null
  };
};

// Lo que dice cada aviso de una salida que dejó de cerrar: el día de la semana del día que no es hábil
const NO_HABIL_EN_TEXTO = Object.freeze({ feriado: 'ahora es feriado', sabado: 'es sábado', domingo: 'es domingo' });
const NO_HABIL_EN_AVISO = Object.freeze({ feriado: 'Ahora es feriado', sabado: 'Es sábado', domingo: 'Es domingo' });
const AVISO_SALIDA_EN_LICENCIA = 'Ese día tenés una licencia de día entero: revisá esta salida.';
// «del lunes 12/10»
const delDia = (fecha) => `del ${diaDeLaSemana(fecha)} ${diaYMes(fecha)}`;

/**
 * Las salidas guardadas que dejaron de cerrar porque cambió algo después (spec 2026-10-27-mi-espacio-horas, sección 7 y
 * decisión 2): `[{ clave: 'salida:AAAA-MM-DD', fecha, texto, aviso }]`, por fecha, a lo sumo uno por día. `texto` va al
 * final de los faltantes del Resumen y `aviso`, en la fila de la planilla. **Nunca frenan una carga**: `calcular` los
 * devuelve aparte (`avisosDeSalidas`), no en los faltantes, así `problemaDeLaCarga` no los ve y una licencia nunca se rechaza
 * por una salida. Dos casos:
 * - un día que no es hábil (`tipoDeDia`: pasó a ser feriado, o un sábado o un domingo cargado por fuera de la planilla) sin
 *   una entrada válida: «Revisá tus horas extras del lunes 12/10: ahora es feriado y falta la entrada.» («es sábado», «es
 *   domingo»). Esa salida no suma (`horasDeLaSalida` da null) hasta que se pone la entrada;
 * - un día con una licencia de día entero (`licenciaDeDiaEnteroEn`, cargada después): «Revisá tus horas extras del viernes
 *   09/10: ese día tenés una licencia de día entero.». Esa salida sigue sumando hasta que se la quita.
 * La baja de un feriado no deja aviso: el día pasa a ser hábil y cuenta la salida desde las 15:00. Solo en contrato, y solo
 * con una fecha y una salida válidas (lo demás no es una salida). Fuera de contrato o sin un estado, [].
 */
export const avisosDeSalidas = (estado, feriados) => {
  if (!esObjeto(estado) || estado.modalidad !== 'contrato') return [];
  const avisos = new Map();
  for (const fila of listaDe(estado.salidas)) {
    if (!esObjeto(fila) || !esFechaIso(fila.fecha) || !horaSalidaValida(fila.salida) || avisos.has(fila.fecha)) continue;
    const { fecha } = fila;
    const tipo = tipoDeDia(fecha, feriados);
    if (tipo !== 'habil' && !horaSalidaValida(fila.entrada)) {
      const cual = tipo === 'feriado' ? 'feriado' : diaDeLaSemana(fecha) === 'sábado' ? 'sabado' : 'domingo';
      avisos.set(fecha, {
        clave: `salida:${fecha}`, fecha,
        texto: `Revisá tus horas extras ${delDia(fecha)}: ${NO_HABIL_EN_TEXTO[cual]} y falta la entrada.`,
        aviso: `${NO_HABIL_EN_AVISO[cual]}: falta la entrada.`
      });
    } else if (licenciaDeDiaEnteroEn(estado, fecha, feriados) !== null) {
      avisos.set(fecha, {
        clave: `salida:${fecha}`, fecha,
        texto: `Revisá tus horas extras ${delDia(fecha)}: ese día tenés una licencia de día entero.`,
        aviso: AVISO_SALIDA_EN_LICENCIA
      });
    }
  }
  return [...avisos.values()].sort((a, b) => compararTexto(a.fecha, b.fecha));
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

// Los meses trabajados, de los más viejos a los más nuevos: los que tienen horas (`horas`, un Map 'AAAA-MM' → horas, el de
// `horasPorMes` o el de `horasPorMesDeSalidas`) y los que corresponden a un mes de uso con usos (así se ve también un uso de
// más), cada uno con sus horas, su mes de uso (`distancia` meses después) y los usos de ese mes
const mesesTrabajados = (horas, usos, distancia) => {
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
  return mesesTrabajados(horasPorMes(estado.horasExtras), usos, MESES_HASTA_EL_FRANCO).map((mes) => {
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
 * - `a_favor`: las horas extras del mes trabajado, para usar el mes siguiente (`mes_de_uso`). Salen de las salidas de la
 *   planilla (`horasPorMesDeSalidas`, con los feriados; spec 2026-10-27-mi-espacio-horas), no de las horas extras de planta.
 *   Un mes cuyas salidas suman 0 es como un mes sin horas extras: queda una fila solo si su mes de uso tiene usos. `usos`:
 *   las filas `horas_a_favor` de ese mes, con cualquier fecha (no tienen saldo inicial), y `usadas`, su suma.
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
  const horas = new Map([...horasPorMesDeSalidas(estado.salidas, feriados)].filter(([, delMes]) => delMes > 0));
  return mesesTrabajados(horas, usos, MESES_HASTA_LAS_HORAS).map((mes) => {
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
 * `{ reparto, topes, franquicia, francos, horasAFavor, noUtilizadas, faltantes, avisosDeSalidas }`.
 * - `reparto`: el de `repartoDeVacaciones`, con todas las licencias como ocupadas (`ocupadas`): una de la otra modalidad no
 *   cuenta, pero ocupa su día y no deja cargar nada ahí, así que no es un día libre para «Perdés».
 * - `topes`: el de `usoDeLosTopes`, solo con los tipos de la modalidad (el saldo de franquicias no cuenta en contrato).
 * - `franquicia`: el de `franquiciaQueVence` (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6), con esos topes y las
 *   mismas ocupadas que el reparto; null en contrato.
 * - `francos` y `horasAFavor`: los de `francosDe` y `horasAFavorDe` (cada uno, [] en la otra modalidad).
 * - `noUtilizadas`: `{ [anio]: noUtilizadasDe }` de cada año con algo que mirar: el de hoy, el del arranque, el de cada mes
 *   de uso y el de cada uso autorizado. Sin modalidad, {}.
 * - `faltantes`: los de `faltantesDe`.
 * - `avisosDeSalidas`: los de `avisosDeSalidas` (solo en contrato). Van aparte y nunca en `faltantes`: así
 *   `problemaDeLaCarga` no los ve y una licencia nunca se frena por una salida.
 * Sin un hoy válido, todo vacío: sin hoy no hay ninguna licencia habilitada, y todas las vacaciones quedarían sin cubrir.
 */
export const calcular = (estado, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  if (!esFechaIso(hoy)) {
    return {
      reparto: repartoDeVacaciones(null), topes: [], franquicia: null, francos: [], horasAFavor: [], noUtilizadas: {},
      faltantes: [], avisosDeSalidas: []
    };
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

  // Las licencias de la otra modalidad no cuentan, pero ocupan sus días: no son un día libre para «Perdés» (ni para las
  // vacaciones ni para la franquicia)
  const ocupadas = listaDe(datos.licencias);
  const topes = usoDeLosTopes(deLaModalidad, { feriados }).filter((uso) => tipos.includes(uso.tipo));
  const calculo = {
    reparto: repartoDeVacaciones(deLaModalidad, { ...conHoy, ocupadas }),
    topes,
    franquicia: franquiciaQueVence(datos, { topes }, { ...conHoy, ocupadas }),
    francos,
    horasAFavor,
    noUtilizadas: Object.fromEntries([...anios].sort((a, b) => a - b)
      .map((anio) => [anio, noUtilizadasDe(deLaModalidad, anio, conHoy)]))
  };
  return { ...calculo, faltantes: faltantesDe(calculo), avisosDeSalidas: avisosDeSalidas(deLaModalidad, feriados) };
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

// Lo que frena una carga con el faltante que lo da (`evaluarLaCarga` necesita su clave para reescribir los errores de días):
// `{ faltante, problema }`, los dos null si nada frena
const loQueFrena = (antes, despues, filaId) => {
  const previos = new Map(faltantesComparables(antes).map(({ clave, medida }) => [clave, medida]));
  const nuevo = faltantesComparables(despues).find(({ clave, medida }) => !previos.has(clave) || medida > previos.get(clave));
  if (nuevo === undefined) return { faltante: null, problema: null };
  return { faltante: nuevo, problema: { campo: nuevo.campo ?? null, mensaje: mensajeDeLaCarga(nuevo, antes, filaId) } };
};

/**
 * Lo que frena una carga (spec, 3.10): el primer faltante de `despues` que no está en `antes` o que mide más que en `antes`.
 * Un faltante que ya estaba no frena una carga que no lo agranda: se puede corregir otra cosa de una fila en faltante.
 * `antes` y `despues` son dos `Calculo` (`calcular`): el de lo cargado y el de lo cargado con la licencia nueva o corregida.
 * Devuelve `{ campo, mensaje }` (`campo` es `desde` en días y francos, y `horas` en horas), o null. En las horas a favor y
 * los usos autorizados, el mensaje dice lo que quedaba antes de la carga; con `filaId`, el id de la licencia que se
 * corrige, cuenta también lo que esa fila ya usaba.
 */
export const problemaDeLaCarga = (antes, despues, filaId) => loQueFrena(antes, despues, filaId).problema;

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

/**
 * La evaluación de una carga sin la vista (los pasos 1 a 3 de `evaluarLicencia`): `{ datos, error, fila, conLaFila, antes,
 * despues, faltante }`. `fila` es la licencia validada con el id de la que se corrige, `conLaFila`, el estado con ella
 * (reemplaza a la corregida), `antes`, el `Calculo` de lo cargado (al corregir, con la versión guardada de la fila), y
 * `despues`, el de lo cargado con ella; los cuatro son null si frena en los pasos 1 o 2. `faltante` es el que frena la carga
 * en el paso 3 (el de `problemaDeLaCarga`, con su clave), o null. El parámetro `antes` es ese `Calculo`, si quien llama ya lo
 * tiene (`alcanceDeLaCarga` prueba muchos «Hasta» con el mismo); si no, se calcula. La vista y los errores de días que dicen
 * hasta dónde alcanza no van acá: piden el alcance, que vuelve a evaluar la carga.
 */
const evaluarLaCarga = (estado, entrada, opciones, antes) => {
  const datosDelEstado = esObjeto(estado) ? estado : {};
  const { hoy, feriados, editadaId, uso_autorizado: usoAutorizado } = esObjeto(opciones) ? opciones : {};
  const frenada = (error) => ({ datos: null, error, fila: null, conLaFila: null, antes: null, despues: null, faltante: null });
  if (!MODALIDADES.includes(datosDelEstado.modalidad)) {
    return frenada({ campo: null, mensaje: MENSAJES_MI_ESPACIO.sinModalidad });
  }
  if (!esFechaIso(datosDelEstado.arranque)) return frenada({ campo: null, mensaje: MENSAJES_MI_ESPACIO.sinArranque });

  const { datos, error } = validarLicencia(entrada,
    { hoy, estado: datosDelEstado, feriados, editadaId, uso_autorizado: usoAutorizado });
  if (error) return frenada(error);

  const editada = idDe(editadaId);
  const fila = { id: editadaId, ...datos };
  const conLaFila = {
    ...datosDelEstado,
    licencias: [...listaDe(datosDelEstado.licencias).filter((otra) => !esObjeto(otra) || idDe(otra.id) !== editada), fila]
  };
  const despues = calcular(conLaFila, { hoy, feriados });
  const loCargado = antes ?? calcular(datosDelEstado, { hoy, feriados });
  const { faltante, problema } = loQueFrena(loCargado, despues, editadaId);
  return { datos: problema === null ? datos : null, error: problema, fila, conLaFila, antes: loCargado, despues, faltante };
};

/**
 * Hasta dónde puede llegar una carga (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.1): el «Hasta» más lejano, del
 * primer día hábil desde `fila.desde` (con los feriados) al último día del rango (`rangoDeFechas(hoy).hasta`), con el que
 * `evaluarLicencia(estado, { ...fila, hasta }, opciones)` no da error: ni de la validación (por ejemplo, otra licencia
 * cargada más adelante) ni un faltante nuevo, en esta carga o en otra (`problemaDeLaCarga`). Es exactamente el «Hasta» más
 * lejano que se puede guardar. `opciones` son las de `evaluarLicencia`, `{ hoy, feriados, editadaId }` (con `editadaId`, la
 * carga reemplaza a la que se corrige). null si ni el primer día hábil entra, o con un estado, una fila o un hoy que no
 * sirven.
 * Alargar una carga nunca la hace entrar: los días de antes se reparten igual y los que se suman solo agregan días sin
 * cubrir, en ella o en las que vienen después, y superposiciones. Así que la búsqueda es binaria sobre los días corridos, con
 * el `Calculo` de lo cargado una sola vez.
 */
export const alcanceDeLaCarga = (estado, fila, opciones) => {
  const { hoy, feriados } = esObjeto(opciones) ? opciones : {};
  const rango = rangoDeFechas(hoy);
  if (!esObjeto(fila) || !esFechaIso(fila.desde) || rango === null) return null;
  const primero = proximoDiaHabilCon(fila.desde, feriados);
  if (primero === null || primero > rango.hasta) return null;
  const antes = calcular(estado, { hoy, feriados });
  const entra = (hasta) => evaluarLaCarga(estado, { ...fila, hasta }, opciones, antes).error === null;
  if (!entra(primero)) return null;
  // En días corridos desde el primero: el de `entraHasta` entra y el de `noEntraDesde` no (al principio, el día después del
  // rango)
  let entraHasta = 0;
  let noEntraDesde = diasEntre(primero, rango.hasta) + 1;
  while (noEntraDesde - entraHasta > 1) {
    const medio = Math.floor((entraHasta + noEntraDesde) / 2);
    if (entra(sumarDias(primero, medio))) entraHasta = medio;
    else noEntraDesde = medio;
  }
  return sumarDias(primero, entraHasta);
};

/**
 * El error de una carga que frena por días de vacaciones sin cubrir (un faltante `vacaciones:<id>`), como lo dice la spec
 * 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3; con otro faltante, o sin ninguno, null (el error queda como lo dio
 * `problemaDeLaCarga`). Recibe el faltante que frena y lo de `evaluarLaCarga` (la fila, el estado con ella y su `Calculo`,
 * `despues`), con el estado de antes y las opciones de `evaluarLicencia`. Quién se queda sin días lo dice el id del faltante:
 * - esta carga (el id de la fila: el de la que se corrige o, en una nueva, el de una fila sin id): en «Hasta», hasta dónde
 *   puede llegar (`alcanceDeLaCarga`, `textoHastaDondeAlcanza`); si ni su primer día hábil entra, en «Desde», el primer día
 *   que le falta y lo primero que se habilita después (`textoSinNingunDia`), de lo cargado sin esta carga: no se guarda, así
 *   que lo que se habilita es lo que le quedaría a ella;
 * - otra carga guardada (esta va antes en el orden y le toma días): en «Hasta», sus fechas y su primer día sin cubrir
 *   (`textoFaltanEnOtraCarga`).
 * Los faltantes y el Resumen no cambian: siguen con `textoSinHabilitados`.
 */
const errorDeDias = (faltante, { estado, fila, conLaFila, despues, opciones }) => {
  if (faltante === null || !faltante.clave.startsWith('vacaciones:')) return null;
  const sinCubrir = [...despues.reparto.sinCubrir].find(([id]) => `vacaciones:${id}` === faltante.clave);
  const primero = sinCubrir === undefined ? undefined : listaDe(sinCubrir[1]).find(esFechaIso);
  if (primero === undefined) return null;
  const [id] = sinCubrir;

  if (Object.is(id, idDe(fila.id))) {
    const alcance = alcanceDeLaCarga(estado, fila, opciones);
    if (alcance !== null) return { campo: 'hasta', mensaje: textoHastaDondeAlcanza(alcance) };
    const sinLaCarga = { ...conLaFila, licencias: conLaFila.licencias.filter((otra) => otra !== fila) };
    const { ordinarias } = repartoDeVacaciones(sinLaCarga, opciones);
    const despuesDelDia = porHabilitarDe(ordinarias, opciones.hoy).find(({ fecha }) => fecha > primero);
    return { campo: 'desde', mensaje: textoSinNingunDia(primero, despuesDelDia) };
  }

  const otra = conLaFila.licencias.find((licencia) =>
    esObjeto(licencia) && licencia.tipo === 'vacaciones' && idDe(licencia.id) === id);
  return otra === undefined ? null : { campo: 'hasta', mensaje: textoFaltanEnOtraCarga(otra.desde, otra.hasta, primero) };
};

// Lo que suma el cálculo de unas vacaciones (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.1), los `extras` de
// `textoDelReparto`: lo que se habilita después de hoy (`porHabilitarDe`) hasta el hasta de la carga o su alcance, y el
// alcance (`alcanceDeLaCarga`), solo si la carga deja los disponibles de hoy en 0 y puede llegar más allá de su hasta. Sin
// días que salgan de una licencia, el texto no va: null
const extrasDelReparto = (fila, calculo, { estado, opciones }) => {
  const { ordinarias, porFila } = calculo.reparto;
  if (listaDe(porFila.get(idDe(fila.id))).length === 0) return null;
  const sinDisponibles = ordinarias.every((ordinaria) => !(ordinaria.disponibles > 0));
  const alcance = sinDisponibles ? alcanceDeLaCarga(estado, fila, opciones) : null;
  const llega = alcance !== null && alcance > fila.hasta ? alcance : null;
  const tope = llega ?? fila.hasta;
  return {
    habilitaciones: porHabilitarDe(ordinarias, opciones.hoy).filter(({ fecha }) => fecha <= tope),
    alcance: llega,
    hasta: fila.hasta
  };
};

/**
 * Los días libres de un mes 'AAAA-MM' (los de `diasLibresEntre`), todo el mes, del 1° al último día, también los que ya
 * pasaron (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2, 3.7 y 7.2: un franco tomado se puede registrar después).
 * Es la única cuenta del día libre de un franco o de unas horas a favor: la usan el aviso de la carga (`avisosDeLaCarga`),
 * «Vence pronto» del Resumen y el email de vencimiento (`avisosDeVencimiento`). Con algo que no es un mes, 0.
 */
export const diasLibresDelMes = (mes, ocupadas, feriados) =>
  diasLibresEntre(`${mes}-01`, ultimoDiaDelMes(mes), ocupadas, feriados);
// Si dos repartos de una fila (los de `porFila`) son el mismo: los mismos años, con los mismos días
const mismasPartes = (unas, otras) => unas.length === otras.length
  && unas.every((parte, i) => esObjeto(parte) && esObjeto(otras[i]) && parte.anio === otras[i].anio
    && parte.dias === otras[i].dias);

/**
 * Lo que una carga le hace a lo demás (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2 y 3.4), los `avisos` de la
 * vista: una lista de textos planos que nunca frenan el guardado. Compara `antes` (el `Calculo` de lo cargado; al corregir,
 * con la versión guardada de la fila) con `despues` (el de lo cargado con esta carga), en este orden:
 * 1. los días de vacaciones que la carga hace perder: la diferencia de los `perdidos` de cada ordinaria
 *    (`textoDePerdidosConLaCarga`), salvo si la carga es de vacaciones: su reparto ya dice «Perdés …» con el total;
 * 2. el franco (planta) o las horas a favor (contrato) de cada mes de uso, desde el de hoy, que se quedan sin ningún día
 *    libre en su mes: tenían disponibles y algún día libre en el mes entero (también los días que ya pasaron: un franco
 *    tomado se puede registrar después; `diasLibresDelMes`, con todas las licencias, como el reparto) y con la carga ninguno.
 *    La cantidad es lo que sigue disponible con la carga: un franco que la carga usa no se queda sin días;
 * 3. las horas de franquicia que la carga hace perder (planta: la diferencia de las `perdidas` de `franquiciaQueVence`);
 * 4. las otras cargas de vacaciones guardadas a las que les cambia de dónde salen los días (su `porFila`), en el orden de sus
 *    fechas, con sus partes nuevas (`textoDelReacomodo`). La propia (la nueva o la que se corrige) nunca se nombra.
 * `contexto` es el de `vistaDe`: `{ estado, antes, opciones }`.
 */
const avisosDeLaCarga = (fila, conLaFila, despues, { estado, antes, opciones }) => {
  const { hoy, feriados } = opciones;
  const avisos = [];

  if (fila.tipo !== 'vacaciones') {
    const previos = new Map(antes.reparto.ordinarias.map(({ anio, perdidos }) => [anio, perdidos]));
    avisos.push(textoDePerdidosConLaCarga(despues.reparto.ordinarias.map((ordinaria) =>
      ({ ...ordinaria, perdidos: ordinaria.perdidos - (previos.get(ordinaria.anio) ?? 0) }))));
  }

  if (esFechaIso(hoy)) {
    const deHoy = hoy.slice(0, 7);
    const ocupadasAntes = listaDe(esObjeto(estado) ? estado.licencias : []);
    const meses = [
      [despues.francos, antes.francos, textoDelFrancoSinDiasLibres],
      [despues.horasAFavor, antes.horasAFavor, textoDeLasHorasSinDiasLibres]
    ];
    for (const [conLaCarga, sinLaCarga, texto] of meses) {
      for (const { mes_de_uso: mes, disponibles } of conLaCarga) {
        if (mes < deHoy || !(disponibles > 0)) continue;
        const previo = sinLaCarga.find((otro) => otro.mes_de_uso === mes);
        if (previo === undefined || !(previo.disponibles > 0)) continue;
        const teniaDiasLibres = diasLibresDelMes(mes, ocupadasAntes, feriados) > 0;
        if (teniaDiasLibres && diasLibresDelMes(mes, conLaFila.licencias, feriados) === 0) avisos.push(texto(disponibles, mes));
      }
    }

    const { franquicia: previa } = antes;
    const { franquicia } = despues;
    if (esObjeto(previa) && esObjeto(franquicia) && franquicia.perdidas > previa.perdidas) {
      avisos.push(textoDeLaFranquiciaPerdida(franquicia.perdidas - previa.perdidas, fechaDe(anioDe(hoy), '12-31')));
    }
  }

  // Las otras: las vacaciones guardadas (con un id), sin la propia (la nueva no tiene id; la corregida tiene el suyo)
  const propia = idDe(fila.id);
  const otras = conLaFila.licencias
    .filter((otra) => esObjeto(otra) && otra.tipo === 'vacaciones' && idPositivoONulo(otra.id) !== null
      && idDe(otra.id) !== propia)
    .sort((a, b) => compararTexto(a.desde, b.desde) || compararTexto(a.hasta, b.hasta) || idDe(a.id) - idDe(b.id));
  for (const otra of otras) {
    const id = idDe(otra.id);
    const ahora = listaDe(despues.reparto.porFila.get(id));
    if (mismasPartes(listaDe(antes.reparto.porFila.get(id)), ahora)) continue;
    avisos.push(textoDelReacomodo(otra.desde, otra.hasta, ahora));
  }

  return avisos.filter((aviso) => aviso !== '');
};

// Lo que muestra el cálculo de «Cargar licencia» de una fila ya validada, con el estado y el `Calculo` de lo cargado con
// ella. `contexto` es `{ estado, antes, opciones, conError }`: el estado de antes de la carga, su `Calculo` y las opciones de
// `evaluarLicencia`, para lo que se habilita después y el alcance de unas vacaciones (`extrasDelReparto`) y para lo que la
// carga le hace a lo demás (`avisosDeLaCarga`), y si la carga tiene un error. Con un error la carga no se guarda (spec
// 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3): la vista dice solo los días, sin el reparto ni nada de lo que la carga
// le haría a lo demás (`avisos`, vacía)
const vistaDe = (fila, conLaFila, calculo, contexto) => {
  const { feriados } = contexto.opciones;
  const habiles = diasHabilesDe(fila.desde, fila.hasta, feriados).length;
  const descuentan = diasQueDescuentan(fila, conLaFila, feriados);
  const antesDelArranque = tieneSaldoInicial(fila.tipo, conLaFila.modalidad) && descuentan.length === 0;
  return {
    dias_habiles: habiles,
    texto_dias: textoDeLosDias(fila, conLaFila.modalidad, habiles),
    texto_reparto: fila.tipo === 'vacaciones' && !contexto.conError
      ? textoDelReparto(calculo.reparto, fila.id, extrasDelReparto(fila, calculo, contexto))
      : '',
    queda_texto: antesDelArranque ? '' : textoDeLoQueQueda(fila, conLaFila.modalidad, calculo, descuentan),
    antes_del_arranque: antesDelArranque,
    texto_antes_del_arranque: antesDelArranque ? TEXTO_ANTES_DEL_ARRANQUE : '',
    avisos: contexto.conError ? [] : avisosDeLaCarga(fila, conLaFila, calculo, contexto)
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
 *    reemplaza a la guardada): un faltante nuevo, o más grande, frena la carga. Si son días de vacaciones sin cubrir, el
 *    error dice hasta dónde alcanza (`errorDeDias`, spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.3): en «Hasta»,
 *    «No te alcanzan los días habilitados: esta licencia puede llegar hasta el 24/02/2027.» o, si le faltan a otra carga ya
 *    guardada, «Con estos días, a tus vacaciones del 04/01 al 22/01/2027 les faltan días desde el 20/01/2027.»; en «Desde»,
 *    si a esta no le alcanza ni el primer día, «No te alcanzan los días habilitados para el 21/06/2027. El 1/7/2027 se
 *    habilitan 5 más de la 2027.».
 * Con un error, `datos` es null. `vista` es null en los pasos 1 y 2; si no, `{ dias_habiles, texto_dias, texto_reparto,
 * queda_texto, antes_del_arranque, texto_antes_del_arranque, avisos }`, con lo cargado con esta licencia:
 * - `texto_dias`: «5 días hábiles» o «5 días hábiles de 7 corridos»; en horas, «2 horas»;
 * - `texto_reparto`: en las vacaciones, el de `textoDelReparto`, con lo que se habilita después hasta su hasta o su alcance
 *   y, si deja los disponibles de hoy en 0, hasta dónde puede llegar (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.1:
 *   «… No te quedan días disponibles hoy. El 1/1/2027 se habilitan 10 más de la 2026: esta licencia puede llegar hasta el
 *   24/02/2027.»); con un error (3.3: la carga no se guarda, solo van los días) y en los demás tipos, '';
 * - `queda_texto`: «Te quedan 22 de 25.», «Te quedan 23 de 42 horas de franquicia.», «Usás 1,5 horas a favor de octubre.
 *   Te quedan 0.», la del franco de su mes o lo no utilizado que queda; '' en las vacaciones, la extraordinaria y lo
 *   anterior al arranque;
 * - `antes_del_arranque`: un tipo con saldo inicial cuyos días son todos anteriores al arranque, con
 *   `texto_antes_del_arranque` (`TEXTO_ANTES_DEL_ARRANQUE`; si no, '');
 * - `avisos` (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.2 y 3.4): lo que esta carga le hace a lo demás, comparado
 *   con lo cargado sin ella (`avisosDeLaCarga`), siempre una lista de textos planos que no frenan el guardado: los días de
 *   vacaciones que hace perder («Con esta licencia perdés 3 de la 2024 (vencen el 31/12/2026).», salvo en unas vacaciones),
 *   el franco o las horas a favor de un mes que se quedan sin días libres («Tu franco de diciembre se queda sin días libres:
 *   vence el 31/12/2026.»), las horas de franquicia que hace perder y las otras cargas de vacaciones a las que les cambia de
 *   dónde salen («Esta carga cambia de dónde salen tus vacaciones del 04/01 al 22/01/2027: ahora de la licencia 2025.»);
 *   con un error, [].
 */
export const evaluarLicencia = (estado, entrada, opciones) => {
  const carga = evaluarLaCarga(estado, entrada, opciones);
  const { datos, fila, conLaFila, antes, despues, faltante } = carga;
  if (fila === null) return { datos, error: carga.error, vista: null };
  const lasOpciones = esObjeto(opciones) ? opciones : {};
  const error = errorDeDias(faltante, { estado, fila, conLaFila, despues, opciones: lasOpciones }) ?? carga.error;
  const contexto = { estado, antes, opciones: lasOpciones, conError: error !== null };
  return { datos, error, vista: vistaDe(fila, conLaFila, despues, contexto) };
};

// El paso a Configuración → Licencias (spec, sección 6). Las ausencias de día entero (`esDiaEntero`) de quien puede tener
// licencia (`puedeTenerLicencia`: superadmin, admin y editor) pasan a `usuarios_licencias`, solo con las fechas, si terminan
// hoy o después. Una licencia de Configuración llega como `{ id, desde, hasta, anulada, autorizado_id }`. La fila de Mi
// espacio guarda cómo quedó (`licencia_oficial_id`, `oficial`: 'creada' o 'unida', y `sin_pasar`, el motivo por el que no
// pasó). Acá se decide qué hacer; lo hace services/miEspacioPaso.js, con el servicio de Configuración.

const esOficial = (oficial) => esObjeto(oficial) && esFechaIso(oficial.desde) && esFechaIso(oficial.hasta);
const estaAnulada = (oficial) => Boolean(Number(oficial.anulada));
const conFechas = (fila) => esObjeto(fila) && esFechaIso(fila.desde) && esFechaIso(fila.hasta) && fila.desde <= fila.hasta;
// La licencia de Configuración, sin anular, cubre todas las fechas de la fila
const cubre = (oficial, fila) => !estaAnulada(oficial) && oficial.desde <= fila.desde && fila.hasta <= oficial.hasta;

// El primer y el último día de la fila que la licencia de Configuración no cubre: toda la fila si está anulada o no tienen
// ningún día en común
const sinCubrirDe = (fila, oficial) => {
  if (estaAnulada(oficial) || oficial.hasta < fila.desde || oficial.desde > fila.hasta) {
    return { desde: fila.desde, hasta: fila.hasta };
  }
  return {
    desde: fila.desde < oficial.desde ? fila.desde : sumarDias(oficial.hasta, 1),
    hasta: fila.hasta > oficial.hasta ? fila.hasta : sumarDias(oficial.desde, -1)
  };
};

/**
 * Cómo está una fila de Mi espacio con su licencia de Configuración (la de `fila.licencia_oficial_id`, o nada):
 * `{ estado, oficial, sin_cubrir? }`. `tocadaPorOtros`: otra persona editó o anuló esa licencia en Configuración (true).
 * - `'ninguno'` (con `oficial: null`): no tiene, o no es la suya;
 * - una creada (Mi espacio la creó): `'creada'`, la maneja Mi espacio; `'creada_cambiada'`, administración la editó;
 *   `'creada_anulada'`, está anulada. Desde la spec 2026-10-28-mi-espacio-licencia-anulada (2.1 y 3b), anularla en
 *   Configuración da de baja también la fila creada, salvo la que en Mi espacio ya empezó antes de hoy: las creadas anuladas
 *   son esa y las que quedaron anuladas antes de ese cambio;
 * - una unida (ya había una de administración que la cubría): `'unida'`, si todavía la cubre; si no, `'unida_sin_cubrir'`,
 *   con `sin_cubrir: { desde, hasta }`, el primer y el último día de la fila fuera de ella (toda la fila, si está anulada).
 */
export const vinculoDe = (fila, oficial, tocadaPorOtros) => {
  if (!esObjeto(fila) || !['creada', 'unida'].includes(fila.oficial) || !esOficial(oficial)
    || idDe(fila.licencia_oficial_id) !== idDe(oficial.id)) {
    return { estado: 'ninguno', oficial: null };
  }
  if (fila.oficial === 'creada') {
    if (estaAnulada(oficial)) return { estado: 'creada_anulada', oficial };
    return { estado: tocadaPorOtros === true ? 'creada_cambiada' : 'creada', oficial };
  }
  if (!conFechas(fila) || cubre(oficial, fila)) return { estado: 'unida', oficial };
  return { estado: 'unida_sin_cubrir', oficial, sin_cubrir: sinCubrirDe(fila, oficial) };
};

// El motivo por el que no pasó, sin su punto final (los de Configuración a veces lo llevan; los textos del paso, no), o null
const motivoDe = (sinPasar) => {
  if (typeof sinPasar !== 'string' || sinPasar.trim() === '') return null;
  return sinPasar.trim().replace(/\.$/, '');
};

// La fila (con fechas que sirven) y su licencia de Configuración no tienen las mismas fechas
const conOtrasFechas = (fila, oficial) =>
  conFechas(fila) && (fila.desde !== oficial.desde || fila.hasta !== oficial.hasta);

// Una creada con otras fechas en Configuración que ningún otro aviso de la fila explica: sin un motivo guardado (`sinPasar`),
// de día entero y de quien hoy puede tener licencia (`puedeTener`, solo el `true` literal). La regla de `textoDelVinculo` (la
// fila) y de `revisionDelVinculo` (el Resumen, que además pide que la de Configuración no haya terminado)
const otrasFechasParaRevisar = (fila, oficial, { sinPasar, puedeTener }) =>
  motivoDe(sinPasar) === null && esDiaEntero(fila) && puedeTener === true && conOtrasFechas(fila, oficial);

/**
 * Lo que dice una fila de la lista sobre Configuración (`vinculo`, el de `vinculoDe`): `{ texto, insignia }` o null. La
 * insignia es 'creada' o 'unida' si está en Configuración como corresponde, y 'aviso' si no está o hay algo para revisar.
 * Las opciones son `{ sinPasar, puedeTener }`: el motivo guardado y si la persona puede tener licencia hoy. La fila lo dice
 * siempre, también lo que ya no se puede resolver (lo que avisa el Resumen, en cambio, es `revisionDelVinculo`).
 * - creada: si una corrección no se pudo copiar (`sinPasar`), dónde quedó en Configuración y por qué no pasó; si dejó de ser
 *   de día entero, `textoSigueEnConfiguracion`; si en Configuración quedó con otras fechas (la cambió la misma persona: spec
 *   2026-10-28-mi-espacio-licencia-anulada, 2.2 y 3.3), de quien hoy puede tener licencia, `textoRevisalaEnConfiguracion`
 *   con las de Configuración; si no, `TEXTO_TAMBIEN_EN_CONFIGURACION`;
 * - creada que administración cambió, `textoEnConfiguracion` y `TEXTO_NO_SE_COPIA` (ya dice las fechas); anulada en
 *   Configuración, `TEXTO_ANULADA_EN_CONFIGURACION` (sin decir quién: pudo ser la misma persona);
 * - unida, `textoUnida`; sin cubrir, `textoYaNoCubierta`;
 * - sin vínculo: `textoNoPaso` con el motivo; una de horas que no llega a la jornada, de quien puede tener licencia,
 *   `TEXTO_NO_DIA_ENTERO`; si no, null.
 */
export const textoDelVinculo = (vinculo, fila, opciones) => {
  const { sinPasar, puedeTener } = esObjeto(opciones) ? opciones : {};
  const motivo = motivoDe(sinPasar);
  const { estado, oficial } = esObjeto(vinculo) ? vinculo : {};
  const aviso = (texto) => ({ texto, insignia: 'aviso' });
  if (esOficial(oficial)) {
    const enConfiguracion = textoEnConfiguracion(oficial.desde, oficial.hasta);
    if (estado === 'creada') {
      if (motivo !== null) return aviso(`${enConfiguracion} ${textoNoPaso(motivo)}`);
      if (!esDiaEntero(fila)) return aviso(textoSigueEnConfiguracion(oficial.desde, oficial.hasta));
      if (otrasFechasParaRevisar(fila, oficial, { sinPasar, puedeTener })) {
        return aviso(textoRevisalaEnConfiguracion(oficial.desde, oficial.hasta));
      }
      return { texto: TEXTO_TAMBIEN_EN_CONFIGURACION, insignia: 'creada' };
    }
    if (estado === 'creada_cambiada') return aviso(`${enConfiguracion} ${TEXTO_NO_SE_COPIA}`);
    if (estado === 'creada_anulada') return aviso(TEXTO_ANULADA_EN_CONFIGURACION);
    if (estado === 'unida') return { texto: textoUnida(oficial.desde, oficial.hasta), insignia: 'unida' };
    if (estado === 'unida_sin_cubrir' && conFechas(vinculo.sin_cubrir)) {
      return aviso(textoYaNoCubierta(vinculo.sin_cubrir.desde, vinculo.sin_cubrir.hasta));
    }
  }
  if (motivo !== null) return aviso(textoNoPaso(motivo));
  if (puedeTener === true && esObjeto(fila) && TIPOS_POR_HORAS.includes(fila.tipo) && !esDiaEntero(fila)) {
    return aviso(TEXTO_NO_DIA_ENTERO);
  }
  return null;
};

/**
 * Lo que el Resumen avisa para revisar de una fila (spec 2026-10-28-mi-espacio-licencia-anulada, 2.2, 3.1, 3.2 y 3.3):
 * `{ motivo, desde, hasta }` o null. Solo lo que todavía se puede resolver (la fila, `textoDelVinculo`, lo dice siempre), y
 * nunca frena nada: no es un faltante. Las opciones son `{ sinPasar, puedeTener, hoy }`, como las de `textoDelVinculo` más
 * hoy (sin un hoy que sirva, null).
 * - `'fechas'`, con las fechas de Configuración: una creada (también la que cambió otra persona) cuya licencia de
 *   Configuración quedó con otras fechas, mientras esa licencia no terminó (después, las fechas de una creada quedan fijas),
 *   salvo que otro aviso de la fila ya lo explique: un motivo guardado (`sinPasar`), que haya dejado de ser de día entero o
 *   de quien hoy no puede tener licencia;
 * - `'anulada'` (sin fechas): una creada anulada en Configuración, mientras la de Mi espacio no terminó;
 * - `'sin_cubrir'`, con los días fuera (`vinculo.sin_cubrir`): una unida que ya no está cubierta, mientras la de Mi espacio
 *   no terminó.
 */
export const revisionDelVinculo = (vinculo, fila, opciones) => {
  const { sinPasar, puedeTener, hoy } = esObjeto(opciones) ? opciones : {};
  if (!esFechaIso(hoy) || !esObjeto(vinculo) || !esOficial(vinculo.oficial)) return null;
  const { estado, oficial } = vinculo;
  if (estado === 'creada' || estado === 'creada_cambiada') {
    const paraRevisar = otrasFechasParaRevisar(fila, oficial, { sinPasar, puedeTener }) && oficial.hasta >= hoy;
    return paraRevisar ? { motivo: 'fechas', desde: oficial.desde, hasta: oficial.hasta } : null;
  }
  const sigue = conFechas(fila) && fila.hasta >= hoy;
  if (estado === 'creada_anulada') return sigue ? { motivo: 'anulada', desde: null, hasta: null } : null;
  if (estado === 'unida_sin_cubrir' && sigue && conFechas(vinculo.sin_cubrir)) {
    return { motivo: 'sin_cubrir', desde: vinculo.sin_cubrir.desde, hasta: vinculo.sin_cubrir.hasta };
  }
  return null;
};

/**
 * El último día en que el firmante titular puede cambiar el tipo de unas vacaciones con persona a cargo: 2 días hábiles
 * antes de que empiecen, inclusive (respuesta del usuario, 26/10/2026), con el calendario de las Notas Digitales (spec
 * 2026-10-27-feriados-en-notas, 4: los 9 fijos y los de la tabla; sin él, los 9 fijos): el día hábil anterior sale la nota
 * que adelanta los datasets e informa quién queda a cargo. null si `desde` no es una fecha, o si el calendario no encuentra
 * un día hábil (el RangeError del tope). Un calendario mal armado es un error de programación y tira.
 */
export const limiteParaCambiarTipo = (desde, calendario = CALENDARIO_FIJO) => {
  if (!esFechaIso(desde)) return null;
  try {
    return calendario.diaHabilAnterior(calendario.diaHabilAnterior(desde));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
};

/**
 * Qué pasa con una fila nueva (o con una corregida que se trata como nueva), con el rol de este momento y las licencias de
 * Configuración de la persona que se cruzan con sus fechas (`cruzadas`; las anuladas no cuentan):
 * - `{ accion: 'nada' }`: el rol no puede tener licencia, no es de día entero o terminó antes de hoy;
 * - `{ accion: 'unir', oficial }`: una la cubre entera (no se crea otra);
 * - `{ accion: 'avisar', sin_pasar }`: se superpone en parte, con `textoSuperpuestaConConfiguracion` de la primera;
 * - `{ accion: 'crear' }`.
 */
export const pasoDeLaCarga = (entrada) => {
  const { fila, rol, hoy, cruzadas } = esObjeto(entrada) ? entrada : {};
  if (!puedeTenerLicencia(rol) || !esDiaEntero(fila) || !conFechas(fila) || !esFechaIso(hoy) || fila.hasta < hoy) {
    return { accion: 'nada' };
  }
  const otras = listaDe(cruzadas)
    .filter((oficial) => esOficial(oficial) && !estaAnulada(oficial) && oficial.desde <= fila.hasta
      && oficial.hasta >= fila.desde)
    .sort((a, b) => compararTexto(a.desde, b.desde) || compararTexto(a.hasta, b.hasta));
  const queLaCubre = otras.find((oficial) => cubre(oficial, fila));
  if (queLaCubre) return { accion: 'unir', oficial: queLaCubre };
  if (otras.length > 0) {
    return { accion: 'avisar', sin_pasar: textoSuperpuestaConConfiguracion(otras[0].desde, otras[0].hasta) };
  }
  return { accion: 'crear' };
};

const ESTADOS_CON_OFICIAL = Object.freeze(['creada', 'creada_cambiada', 'creada_anulada', 'unida', 'unida_sin_cubrir']);

/**
 * Qué pasa con Configuración al corregir una fila (`anterior`, la guardada; `fila`, la corregida, ya validada; `vinculo`, el
 * de `vinculoDe`). `autorizadoCambia`: el pedido cambia la persona a cargo; `personaACargo`: la persona es el firmante
 * titular y su licencia de Configuración deja a alguien a cargo; `calendario`: el de las Notas Digitales, para
 * `limiteParaCambiarTipo` (sin él, los 9 fijos). Devuelve `{ accion }`, o `{ error: { campo, mensaje } }`:
 * - sin vínculo, lo de `pasoDeLaCarga`; un rol que no puede tener licencia, siempre `'nada'`;
 * - una creada sigue a la de Configuración. Si la corrección cambia las fechas se mira contra la fila guardada (`anterior`);
 *   hasta dónde se pueden cambiar, con las fechas de Configuración (son las mismas, salvo que una copia anterior no haya
 *   pasado):
 *   - unas vacaciones con persona a cargo que pasan a otro tipo: después de `limiteParaCambiarTipo`, el error `tipoFijo` en
 *     `tipo`; hasta ese día, el cambio le saca la persona a cargo (`sin_persona_a_cargo: true` en `'cambiar'`);
 *   - si no es de día entero, `'anular'` si todavía se puede anular (`puedeAnularse`: empieza hoy o después); si no,
 *     `'quedar'`;
 *   - con otras fechas, que no son las de Configuración: si la corregida termina antes de hoy y la de Configuración todavía
 *     se puede anular, `'anular'`; si la de Configuración terminó antes de hoy, `fechasFijas` (en el campo que cambia); si
 *     empieza hoy o antes y se mueve el desde, `soloHasta` en `desde` (como `validarEdicion`, que con el desde de hoy ya la
 *     da en curso); si no, `'cambiar'`;
 *   - sin cambiar las fechas nunca hay un error de fechas: si cambia la persona a cargo (o la pierde), `'cambiar'`; si no,
 *     `'nada'` (el tipo, la nota y «Mostrar» se cambian siempre, sin tocar Configuración);
 * - una creada que administración cambió o anuló: `'nada'`;
 * - una unida que sigue cubierta y de día entero: `'nada'`; si no, `{ accion: 'soltar', luego }`, con `luego` el
 *   `pasoDeLaCarga` de la corregida.
 */
export const pasoDeLaCorreccion = (entrada) => {
  const {
    anterior, fila, vinculo, rol, hoy, cruzadas, autorizadoCambia, personaACargo, calendario = CALENDARIO_FIJO
  } = esObjeto(entrada) ? entrada : {};
  const { estado, oficial } = esObjeto(vinculo) ? vinculo : {};
  if (!esOficial(oficial) || !ESTADOS_CON_OFICIAL.includes(estado)) return pasoDeLaCarga({ fila, rol, hoy, cruzadas });
  if (!puedeTenerLicencia(rol) || !conFechas(fila) || !esFechaIso(hoy)) return { accion: 'nada' };
  if (estado === 'unida' || estado === 'unida_sin_cubrir') {
    if (esDiaEntero(fila) && cubre(oficial, fila)) return { accion: 'nada' };
    return { accion: 'soltar', luego: pasoDeLaCarga({ fila, rol, hoy, cruzadas }) };
  }
  if (estado !== 'creada') return { accion: 'nada' };

  const pierdeLaPersona = personaACargo === true && esObjeto(anterior) && anterior.tipo === 'vacaciones'
    && fila.tipo !== 'vacaciones';
  if (pierdeLaPersona && hoy > limiteParaCambiarTipo(oficial.desde, calendario)) {
    return { error: { campo: 'tipo', mensaje: MENSAJES_MI_ESPACIO.tipoFijo } };
  }
  if (!esDiaEntero(fila)) return { accion: puedeAnularse(oficial, hoy) ? 'anular' : 'quedar' };
  const cambiar = pierdeLaPersona ? { accion: 'cambiar', sin_persona_a_cargo: true } : { accion: 'cambiar' };
  // Si la corrección cambia las fechas, contra la fila guardada (o la de Configuración, si la guardada no sirve). Volver a las
  // de Configuración no le cambia nada a Configuración
  const guardada = conFechas(anterior) ? anterior : oficial;
  const otroDesde = fila.desde !== guardada.desde;
  const comoEnConfiguracion = fila.desde === oficial.desde && fila.hasta === oficial.hasta;
  if ((otroDesde || fila.hasta !== guardada.hasta) && !comoEnConfiguracion) {
    if (fila.hasta < hoy && puedeAnularse(oficial, hoy)) return { accion: 'anular' };
    if (oficial.hasta < hoy) {
      return { error: { campo: otroDesde ? 'desde' : 'hasta', mensaje: MENSAJES_MI_ESPACIO.fechasFijas } };
    }
    if (oficial.desde <= hoy && otroDesde && fila.desde !== oficial.desde) {
      return { error: { campo: 'desde', mensaje: MENSAJES_MI_ESPACIO.soloHasta } };
    }
    return cambiar;
  }
  return pierdeLaPersona || autorizadoCambia === true ? cambiar : { accion: 'nada' };
};

/**
 * Qué pasa con Configuración al borrar una fila: una creada se anula si todavía se puede (`puedeAnularse`: empieza hoy o
 * después); si empezó antes de hoy, no se borra (`{ error: { status: 409, campo: null, mensaje: yaEmpezo } }`). Lo demás
 * (una unida, una que administración cambió o anuló, sin vínculo) se borra sin tocar Configuración: `{ accion: 'nada' }`.
 */
export const pasoDeLaBaja = (entrada) => {
  const { vinculo, hoy } = esObjeto(entrada) ? entrada : {};
  if (!esObjeto(vinculo) || vinculo.estado !== 'creada' || !esOficial(vinculo.oficial)) return { accion: 'nada' };
  if (puedeAnularse(vinculo.oficial, hoy)) return { accion: 'anular' };
  return { error: { status: 409, campo: null, mensaje: MENSAJES_MI_ESPACIO.yaEmpezo } };
};

/**
 * Los vínculos de la lista (`filasDeLicencias`): un Map del id de cada fila (número) a `{ configuracion, puede_borrar,
 * solo_hasta, fechas_fijas, en_configuracion, revision }`, solo de las que tienen algo para decir o son creadas.
 * `configuracion` es el de `textoDelVinculo` y `revision`, el de `revisionDelVinculo` con el `hoy` de las opciones (lo que
 * el Resumen avisa para revisar, o null); `puede_borrar`, `solo_hasta` y `fechas_fijas` son los de una creada (de día
 * entero, las fechas), con las fechas de Configuración, como `pasoDeLaBaja` y `pasoDeLaCorreccion`: se borra si empieza
 * hoy o después, el desde queda fijo si empieza hoy o antes y las fechas, si terminó antes de hoy. Las demás se borran y se
 * corrigen libres. Las opciones son `{ oficiales, tocadas, hoy, puedeTener }`: las licencias de Configuración por id
 * (Map), los ids que otra persona editó o anuló (Set) y si la persona puede tener licencia hoy. `en_configuracion` es, de
 * una creada, lo que necesita el formulario para corregirla: `{ licencia_id, autorizado_id }`, el id de su licencia de
 * Configuración (el `excluir` del aviso de los días sin auditor) y su persona a cargo (o null); de las demás, null.
 */
export const vinculosDeLaLista = (licencias, opciones) => {
  const { oficiales, tocadas, hoy, puedeTener } = esObjeto(opciones) ? opciones : {};
  const vinculos = new Map();
  for (const fila of listaDe(licencias)) {
    if (!esObjeto(fila) || !Number.isInteger(idDe(fila.id))) continue;
    const oficialId = idDe(fila.licencia_oficial_id);
    const vinculo = vinculoDe(fila, oficiales instanceof Map ? oficiales.get(oficialId) : undefined,
      tocadas instanceof Set && tocadas.has(oficialId));
    const delVinculo = { sinPasar: fila.sin_pasar, puedeTener };
    const configuracion = textoDelVinculo(vinculo, fila, delVinculo);
    const creada = vinculo.estado === 'creada';
    if (configuracion === null && !creada) continue;
    const fechasDeLaCreada = creada && esDiaEntero(fila) && esFechaIso(hoy);
    vinculos.set(idDe(fila.id), {
      configuracion,
      puede_borrar: pasoDeLaBaja({ vinculo, hoy }).error === undefined,
      solo_hasta: fechasDeLaCreada && vinculo.oficial.desde <= hoy && vinculo.oficial.hasta >= hoy,
      fechas_fijas: fechasDeLaCreada && vinculo.oficial.hasta < hoy,
      en_configuracion: creada
        ? { licencia_id: idDe(vinculo.oficial.id), autorizado_id: idPositivoONulo(vinculo.oficial.autorizado_id) } : null,
      revision: revisionDelVinculo(vinculo, fila, { ...delVinculo, hoy })
    });
  }
  return vinculos;
};

/**
 * Lo que el cálculo previo de «Cargar licencia» dice del paso (`data.paso`), con el `paso` de `pasoDeLaCarga` o de
 * `pasoDeLaCorreccion`, el `vinculo` de la fila guardada (en una carga, ninguno) y la fila validada:
 * `{ pasa, avisos, firmante, sin_pasar_previsto }`.
 * - `pasa`: las fechas quedan en Configuración como creada: se crea o se cambia la licencia, o una creada sigue igual;
 * - `avisos` (solo si pasa): `AVISO_DEL_PASO`; al superadmin, `AVISO_DEL_PASO_SUPERADMIN`; al titular, `AVISO_NOTAS_DE_HOY`
 *   si empieza hoy o antes y hoy ya salió alguna nota con su firma (`notasDeHoy`, solo el `true` literal: spec
 *   2026-10-27-feriados-en-notas, 4), y `AVISO_SIN_PERSONA_A_CARGO` si no son vacaciones (solo las vacaciones dejan persona a
 *   cargo);
 *   a la persona autorizada del firmante, `textoAutorizadaDelFirmante` por cada una de `comoAutorizada` (las licencias del
 *   firmante en las que es la autorizada, `[{ desde, hasta }]`) que se pisa con la fila y no terminó antes de hoy, por fecha
 *   (decisión del usuario, 27/10/2026: no la frena);
 * - `firmante` (solo al titular, y si pasa): `{ soy_titular, puede_autorizar (las vacaciones), vispera, sin_anticipo,
 *   sin_dias_habiles, notas_de_hoy }`, con `vispera`, `sin_anticipo` y `sin_dias_habiles` de `visperaDeLaLicencia` con las
 *   demás licencias de Configuración del titular (`delTitular`, sin la que sigue a esta fila) y el `calendario` (sin él, los 9
 *   fijos), como Configuración, y `notas_de_hoy` cuando va `AVISO_NOTAS_DE_HOY`; si no, null;
 * - `sin_pasar_previsto`: si se une, `textoUnida`; si se superpone en parte, el motivo; si no, null.
 */
export const pasoPrevistoDe = (entrada) => {
  const {
    paso, vinculo, fila, rol, hoy, soyTitular, comoAutorizada, delTitular, notasDeHoy, calendario = CALENDARIO_FIJO
  } = esObjeto(entrada) ? entrada : {};
  const delPaso = esObjeto(paso) ? paso : {};
  const efectivo = delPaso.accion === 'soltar' && esObjeto(delPaso.luego) ? delPaso.luego : delPaso;
  const sigueCreada = esObjeto(vinculo) && vinculo.estado === 'creada' && efectivo.accion === 'nada';
  const pasa = puedeTenerLicencia(rol) && esDiaEntero(fila) && conFechas(fila) && esFechaIso(hoy)
    && (efectivo.accion === 'crear' || efectivo.accion === 'cambiar' || sigueCreada);
  let sinPasarPrevisto = null;
  if (efectivo.accion === 'unir' && esOficial(efectivo.oficial)) {
    sinPasarPrevisto = textoUnida(efectivo.oficial.desde, efectivo.oficial.hasta);
  } else if (efectivo.accion === 'avisar' && typeof efectivo.sin_pasar === 'string') {
    sinPasarPrevisto = efectivo.sin_pasar;
  }
  if (!pasa) return { pasa: false, avisos: [], firmante: null, sin_pasar_previsto: sinPasarPrevisto };
  const titular = soyTitular === true;
  // Las notas de hoy ya salieron con su firma: solo si hoy salió alguna (spec 2026-10-27-feriados-en-notas, 4)
  const deHoy = fila.desde <= hoy && notasDeHoy === true;
  const avisos = [AVISO_DEL_PASO];
  if (rol === 'superadmin') avisos.push(AVISO_DEL_PASO_SUPERADMIN);
  if (titular && deHoy) avisos.push(AVISO_NOTAS_DE_HOY);
  if (titular && fila.tipo !== 'vacaciones') avisos.push(AVISO_SIN_PERSONA_A_CARGO);
  listaDe(comoAutorizada)
    .filter((delFirmante) => esOficial(delFirmante) && delFirmante.desde <= fila.hasta && delFirmante.hasta >= fila.desde
      && delFirmante.hasta >= hoy)
    .sort((a, b) => compararTexto(a.desde, b.desde) || compararTexto(a.hasta, b.hasta))
    .forEach((delFirmante) => avisos.push(textoAutorizadaDelFirmante(delFirmante.desde, delFirmante.hasta)));
  const firmante = titular ? {
    soy_titular: true, puede_autorizar: fila.tipo === 'vacaciones', ...visperaDeLaLicencia(fila, delTitular, calendario),
    notas_de_hoy: deHoy
  } : null;
  return { pasa: true, avisos, firmante, sin_pasar_previsto: sinPasarPrevisto };
};

// «Hoy no están» (spec, sección 7): lo que ven los compañeros de las ausencias de día entero de cada uno, sin el tipo ni la
// nota: «Laura no está» (con el nombre corto, `nombreCorto`) y «Vuelve el lunes 02/11»
export const textoNoEsta = (nombre) => `${typeof nombre === 'string' ? nombre : ''} no está`;
export const textoDeLaVuelta = (fecha) => (esFechaIso(fecha) ? `Vuelve el ${diaDeLaSemana(fecha)} ${diaYMes(fecha)}` : null);

// Las palabras de un nombre, sin los espacios de más; lo que no es un texto, ninguna
const palabrasDe = (nombre) => (typeof nombre === 'string' ? nombre.trim().split(/\s+/).filter(Boolean) : []);
// Una palabra para comparar: sin tildes (ni otras marcas) y en minúscula, «Matías» y «matias» son la misma
const paraComparar = (palabra) => palabra.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// La primera letra de una palabra (Array.from: una letra fuera del plano básico es una sola)
const inicialDe = (palabra) => Array.from(palabra)[0] ?? '';

/**
 * El nombre de una persona como la ven sus compañeros (spec 2026-10-28-mi-espacio-agenda-onda, 5.1): `persona` es
 * `{ id, nombre }` (el nombre completo) y `administracion`, la administración activa (`[{ id, nombre }]`, la de
 * `administracionActiva` de services/miEspacioDatos.js), contra la que se compara: la de todo el sistema, no la del mes, así
 * el nombre de alguien no cambia de un mes a otro. El primer nombre («Carla»); si otra persona de la lista (otro id: la
 * persona misma no cuenta, y quien no está en la lista se compara igual) tiene el mismo primer nombre, sin mayúsculas ni
 * tildes, con la inicial del último apellido y un punto («Carla B.»); si alguna de esas tiene además la misma inicial, el
 * nombre completo. Los espacios de más no cuentan, y un nombre de una sola palabra es esa palabra. Sin un nombre, ''. Pura;
 * nunca tira.
 */
export const nombreCorto = (persona, administracion) => {
  const palabras = palabrasDe(esObjeto(persona) ? persona.nombre : null);
  if (palabras.length === 0) return '';
  const [primera] = palabras;
  if (palabras.length === 1) return primera;
  const ultima = palabras[palabras.length - 1];
  const id = idDe(persona.id);
  const mismoNombre = listaDe(administracion)
    .filter((otra) => esObjeto(otra) && idDe(otra.id) !== id)
    .map((otra) => palabrasDe(otra.nombre))
    .filter((otras) => otras.length > 0 && paraComparar(otras[0]) === paraComparar(primera));
  if (mismoNombre.length === 0) return primera;
  const inicial = inicialDe(paraComparar(ultima));
  if (mismoNombre.some((otras) => inicialDe(paraComparar(otras[otras.length - 1])) === inicial)) return palabras.join(' ');
  return `${primera} ${inicialDe(ultima)}.`;
};

/**
 * Las ausencias de cada persona (`filas`: `[{ usuario_id, nombre, desde, hasta }]`), con las seguidas o separadas solo por
 * días no hábiles (los 9 fijos y los feriados del Set) unidas en una, como `unirAusencias` de Configuración:
 * `[{ usuario_id, nombre, desde, hasta, vuelve }]`, por desde, nombre y usuario_id. `vuelve` es el primer día hábil después
 * del hasta (`proximoDiaHabilCon`), o null si no hay. Solo esas claves: aunque las filas traigan el tipo o la nota, no
 * pasan. Las filas sin un usuario_id entero positivo o sin unas fechas en orden no cuentan.
 */
export const ausenciasUnidas = (filas, feriados) => {
  const porPersona = new Map();
  for (const fila of listaDe(filas)) {
    const usuarioId = esObjeto(fila) ? idDe(fila.usuario_id) : NaN;
    // Una persona es un entero positivo: '' (Number('') es 0), el 0 y los negativos no
    if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !conFechas(fila)) continue;
    if (!porPersona.has(usuarioId)) porPersona.set(usuarioId, []);
    porPersona.get(usuarioId).push(fila);
  }
  const vueltaDe = (hasta) => proximoDiaHabilCon(sumarDias(hasta, 1), feriados);
  const unidas = [];
  for (const [usuarioId, propias] of porPersona) {
    const nombre = typeof propias[0].nombre === 'string' ? propias[0].nombre : '';
    let actual = null;
    for (const { desde, hasta } of [...propias].sort((a, b) => compararTexto(a.desde, b.desde))) {
      // Se une si empieza, a más tardar, el día en que volvería de la anterior: no queda ningún día hábil libre en el medio
      if (actual !== null && desde <= (vueltaDe(actual.hasta) ?? actual.hasta)) {
        if (hasta > actual.hasta) actual.hasta = hasta;
      } else {
        actual = { usuario_id: usuarioId, nombre, desde, hasta };
        unidas.push(actual);
      }
    }
  }
  return unidas
    .map((ausencia) => ({ ...ausencia, vuelve: vueltaDe(ausencia.hasta) }))
    .sort((a, b) => compararTexto(a.desde, b.desde) || a.nombre.localeCompare(b.nombre, 'es') || a.usuario_id - b.usuario_id);
};

/**
 * Las ausencias unidas (`ausenciasUnidas`) que tocan [desde, hasta], como las ve la API (`GET /api/mi-espacio/ausentes` y
 * «Hoy y mañana» del Resumen): `[{ nombre, desde, hasta, vuelve, texto, vuelve_texto }]`, en el orden recibido, enteras
 * (con su desde y su hasta aunque pasen del rango). Nunca el tipo, la nota ni un id. Con un rango que no es un rango, [].
 */
export const ausentesDelRango = (unidas, desde, hasta) => {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || hasta < desde) return [];
  return listaDe(unidas)
    .filter((ausencia) => conFechas(ausencia) && ausencia.desde <= hasta && ausencia.hasta >= desde)
    .map((ausencia) => {
      const vuelve = esFechaIso(ausencia.vuelve) ? ausencia.vuelve : null;
      const nombre = typeof ausencia.nombre === 'string' ? ausencia.nombre : '';
      return {
        nombre, desde: ausencia.desde, hasta: ausencia.hasta, vuelve, texto: textoNoEsta(nombre),
        vuelve_texto: textoDeLaVuelta(vuelve)
      };
    });
};

/**
 * «Hoy y mañana» del Resumen, en dos grupos (decisión del usuario, 27/10/2026): de `ausentes` (los de `ausentesDelRango` de hoy
 * a mañana), `{ ausentes_hoy, ausentes_manana }`. En hoy, los que hoy no están (desde <= hoy <= hasta), con su vuelta; en
 * mañana, los que empiezan mañana (el día siguiente corrido) y hoy están. Quien falta hoy y mañana va solo en hoy. Cada uno con
 * las seis claves de `ausentesDelRango`, en el orden recibido: nunca el tipo, la nota ni un id. Sin un hoy válido, los dos vacíos.
 */
export const ausentesDeHoyYManana = (ausentes, hoy) => {
  const grupos = { ausentes_hoy: [], ausentes_manana: [] };
  if (!esFechaIso(hoy)) return grupos;
  const manana = sumarDias(hoy, 1);
  for (const ausente of listaDe(ausentes)) {
    if (!conFechas(ausente)) continue;
    const { nombre, desde, hasta, vuelve, texto, vuelve_texto: vuelveTexto } = ausente;
    const delGrupo = { nombre, desde, hasta, vuelve, texto, vuelve_texto: vuelveTexto };
    if (desde <= hoy && hoy <= hasta) grupos.ausentes_hoy.push(delGrupo);
    else if (desde === manana) grupos.ausentes_manana.push(delGrupo);
  }
  return grupos;
};

// El email de vencimiento (spec, sección 9): el franco o las horas a favor del mes de hoy se avisan desde 5 días hábiles antes
// del último día hábil del mes, y las horas de franquicia y los días de la licencia que vencen el 31/12, desde el primer día
// hábil de diciembre
const DIAS_HABILES_ANTES_DEL_ULTIMO = 5;
const DESDE_EL_AVISO_DE_LA_LICENCIA = '12-01';

// «el viernes 30/10»
const elDia = (fecha) => `el ${diaDeLaSemana(fecha)} ${diaYMes(fecha)}`;
const textoDelFranco = (cantidad, mes, ultimo) => `Tenés ${numeroTexto(cantidad)} `
  + `${esUna(cantidad) ? 'franco compensatorio' : 'francos compensatorios'} para usar en ${nombreDelMes(mes)}: el último día `
  + `hábil es ${elDia(ultimo)}.`;
const textoDeLasHorasAFavor = (cantidad, mes, ultimo) =>
  `Tenés ${textoDeHoras(cantidad)} a favor para usar en ${nombreDelMes(mes)}: el último día hábil es ${elDia(ultimo)}.`;
const textoDeLaLicencia = (dias, anio, vence) => `Tenés ${diasTexto(dias)} de la licencia ${anio}: vence el ${fechaCorta(vence)}.`;
// «Tenés 22 horas de franquicia: vencen el 31/12/2026.» (con 1, «1 hora … vence»)
const textoDeLaFranquicia = (horas, vence) =>
  `Tenés ${textoDeHoras(horas)} de franquicia: ${esUna(horas) ? 'vence' : 'vencen'} el ${fechaCorta(vence)}.`;

/**
 * Lo que dice el email de vencimiento (spec, sección 9): lo que vence pronto y hoy está en su tramo, `[{ clave, texto }]`, por
 * fecha. La clave es la que la corrida anota en `mi_espacio_avisos`, así cada cosa se avisa una sola vez.
 * - `franco-AAAA-MM` en planta y `horas-AAAA-MM` en contrato: lo que queda (`disponibles`) del franco o de las horas a favor
 *   del mes de hoy, desde 5 días hábiles antes del último día hábil del mes (`restarDiasHabilesCon`) hasta ese día
 *   (`ultimoDiaHabilDelMesCon`), con los feriados. Sin ningún día libre en todo el mes (`diasLibresDelMes`, con
 *   `opciones.ocupadas`: todas las licencias de Mi espacio, de cualquier tipo y de cualquier modalidad, como el reparto), no
 *   se nombra: ya no se puede usar (spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.7). Sin `ocupadas`, ninguna licencia
 *   ocupa un día.
 * - `franquicia-AAAA`, solo en planta: las horas de franquicia del año que todavía entran en algún día libre (`disponibles` de
 *   `calculo.franquicia`, sin las perdidas; spec 2026-10-28-mi-espacio-vacaciones-en-la-carga, 3.6), desde el primer día
 *   hábil de diciembre hasta el 31/12: «Tenés 22 horas de franquicia: vencen el 31/12/2026.».
 * - `licencia-AAAA`: los días disponibles de la licencia ordinaria que vence el 31/12 de este año (la de dos años antes),
 *   desde el primer día hábil de diciembre (`proximoDiaHabilCon`) hasta el 31/12.
 * `calculo` es el de `calcular` con ese hoy y esos feriados. Nunca dice el tipo de una licencia médica: solo vacaciones,
 * francos y horas. Sin un cálculo o un hoy válidos, []; sin una modalidad, solo la licencia.
 */
export const avisosDeVencimiento = (calculo, opciones) => {
  const { hoy, feriados, modalidad, ocupadas } = esObjeto(opciones) ? opciones : {};
  if (!esObjeto(calculo) || !esFechaIso(hoy)) return [];
  const avisos = [];

  const mes = hoy.slice(0, 7);
  const ultimo = ultimoDiaHabilDelMesCon(mes, feriados);
  const desde = ultimo === null ? null : restarDiasHabilesCon(ultimo, DIAS_HABILES_ANTES_DEL_ULTIMO, feriados);
  const planta = modalidad === 'planta';
  if (desde !== null && desde <= hoy && hoy <= ultimo && (planta || modalidad === 'contrato')) {
    const delMes = listaDe(planta ? calculo.francos : calculo.horasAFavor)
      .find((fila) => esObjeto(fila) && fila.mes_de_uso === mes);
    const quedan = numeroDe(delMes?.disponibles);
    if (quedan > 0 && diasLibresDelMes(mes, listaDe(ocupadas), feriados) > 0) {
      avisos.push(planta
        ? { clave: `franco-${mes}`, texto: textoDelFranco(quedan, mes, ultimo) }
        : { clave: `horas-${mes}`, texto: textoDeLasHorasAFavor(quedan, mes, ultimo) });
    }
  }

  const finDelAnio = fechaDe(anioDe(hoy), '12-31');
  const inicio = proximoDiaHabilCon(fechaDe(anioDe(hoy), DESDE_EL_AVISO_DE_LA_LICENCIA), feriados);
  if (inicio !== null && inicio <= hoy && hoy <= finDelAnio) {
    // Las horas de franquicia que todavía entran en algún día libre (las perdidas no se avisan), solo en planta
    const horas = planta && esObjeto(calculo.franquicia) ? numeroDe(calculo.franquicia.disponibles) : NaN;
    if (horas > 0) avisos.push({ clave: `franquicia-${anioDe(hoy)}`, texto: textoDeLaFranquicia(horas, finDelAnio) });
    const vieja = listaDe(esObjeto(calculo.reparto) ? calculo.reparto.ordinarias : []).find((ordinaria) =>
      esObjeto(ordinaria) && Number.isInteger(ordinaria.anio) && ordinaria.vence === finDelAnio);
    const dias = numeroDe(vieja?.disponibles);
    if (dias > 0) avisos.push({ clave: `licencia-${vieja.anio}`, texto: textoDeLaLicencia(dias, vieja.anio, finDelAnio) });
  }
  return avisos;
};
