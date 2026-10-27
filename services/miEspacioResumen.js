/**
 * Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, secciones 3.9, 7 y 8): el panel como datos. De lo cargado (el
 * `Estado`), su `Calculo` (`calcular` de services/miEspacioReglas.js), hoy y los feriados salen el Resumen «Titular»
 * (`resumenDe`; spec 2026-10-27-mi-espacio-resumen, sección 4: la frase de la banda, lo que vence en una línea y la médica
 * extraordinaria corta), la lista de licencias de un año (`filasDeLicencias`) y las tablas de horas extras
 * (`tablaDeHorasExtras`), con todos sus números y sus textos: la página los imprime tal cual y no recalcula nada (Ruling 19).
 * También el próximo feriado de «Hoy y mañana» (`proximoFeriadoDe`).
 *
 * Puras (sin pool ni Date local: las fechas son texto 'AAAA-MM-DD' y los meses, 'AAAA-MM'). Ninguna función tira: una
 * entrada rara da null, '', '—', una lista vacía o un objeto vacío. Todo número va como número y todo texto, como texto
 * plano: escaparlo le toca a quien lo dibuja. Nada dice «perdiste»: lo que no se usó a tiempo es «no utilizado
 * previamente» (spec, antiobjetivos).
 */
import { diaDeLaSemana, diasHabilesDe, feriadosDelAnio, proximoDiaHabilCon } from './feriadosReglas.js';
import { diasEntre, esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';
import { esAdmin, esAuditor } from './usuariosReglas.js';
import {
  MENSAJES_MI_ESPACIO, MODALIDADES, TEXTO_MODALIDAD, TIPOS_LICENCIA, TIPOS_POR_MODALIDAD, NOMBRES_TIPO, JORNADA,
  numeroTexto, mesEnFrase, nombreDelMes, diaYMes, enLista, modalidadDe, mesMas, topeDe, diasQueDescuentan, esDiaEntero,
  fueraDeLaModalidad, tieneSaldoInicial, horasDe, textoSinNoUtilizadas
} from './miEspacioReglas.js';

// Los dos formatos que ya estaban en las reglas: el panel los usa sin copiarlos
export { numeroTexto, mesEnFrase };

const MESES_CORTOS = Object.freeze(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
const textoDe = (valor) => (typeof valor === 'string' ? valor : '');
// Un número de un cálculo o de la base (el '8.0' de un DECIMAL); lo que no es un número finito, 0
const cantidadDe = (valor) => {
  const numero = typeof valor === 'number' ? valor : (typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN);
  return Number.isFinite(numero) ? numero : 0;
};
// Un id como número (el de la base llega como número; el de un pedido, como texto): lo que no es ninguno de los dos, NaN
const idDe = (valor) => (typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN);
const anioDe = (fecha) => Number(fecha.slice(0, 4));
// El año de la lista o de la tabla: un entero de cuatro cifras, o un texto de cuatro cifras (el de la dirección); si no, null
const anioPedido = (valor) => {
  const anio = typeof valor === 'string' && /^\d{4}$/.test(valor) ? Number(valor) : valor;
  return Number.isInteger(anio) && anio >= 1000 && anio <= 9998 ? anio : null;
};
const compararTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const minuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);
// '1 día', '3 días', '1,5 horas': la cantidad con su unidad, en singular solo con 1
const conUnidad = (cantidad, una, varias) => `${numeroTexto(cantidad)} ${cantidad === 1 ? una : varias}`;
const fechaCorta = (fecha) => (esFechaIso(fecha) ? formatoCorto(fecha) : '—');
// '1/1/2027': el día de una habilitación, sin ceros, como en las reglas de las mitades
const fechaSinCeros = (fecha) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}/${fecha.slice(0, 4)}`;

// Los formatos de fechas y meses (`diaDeLaSemana` da el día en minúscula y con tilde: 'miércoles'). Lo que no es una fecha o
// un mes da la raya
const abreviado = (fecha) => mayuscula(diaDeLaSemana(fecha).slice(0, 3));
// 'Vie 23/10/2026'
export const diaCorto = (fecha) => (esFechaIso(fecha) ? `${abreviado(fecha)} ${formatoCorto(fecha)}` : '—');
// 'Jue 22/10': el de cada día de horas extras, sin el año
const diaCortoSinAnio = (fecha) => (esFechaIso(fecha) ? `${abreviado(fecha)} ${diaYMes(fecha)}` : '—');
// 'viernes 30/10'
export const diaLargo = (fecha) => (esFechaIso(fecha) ? `${diaDeLaSemana(fecha)} ${diaYMes(fecha)}` : '—');
// 'Octubre 2026'
export const mesTitulo = (mes) => {
  const nombre = nombreDelMes(mes);
  return nombre === '—' ? '—' : `${mayuscula(nombre)} ${mes.slice(0, 4)}`;
};

// Cómo se muestra la modalidad: el texto del vínculo (Planta permanente, Planta política o Contrato) si es el de la modalidad
const textoDeLaModalidad = (vinculo, modalidad) =>
  (modalidadDe(vinculo) === modalidad ? TEXTO_MODALIDAD[vinculo] : mayuscula(modalidad));

// Las ordinarias del reparto, con su año
const ordinariasDel = (cuenta) => listaDe(esObjeto(cuenta.reparto) ? cuenta.reparto.ordinarias : [])
  .filter((ordinaria) => esObjeto(ordinaria) && Number.isInteger(ordinaria.anio));
// La fila de los francos o de las horas a favor de un mes de uso, o null
const delMesDeUso = (lista, mes) => listaDe(lista).find((fila) => esObjeto(fila) && fila.mes_de_uso === mes) ?? null;
// Lo que suma un tipo con tope en un año (`usoDeLosTopes`), o 0
const usadosDe = (cuenta, tipo, anio) => cantidadDe(listaDe(cuenta.topes)
  .find((uso) => esObjeto(uso) && uso.tipo === tipo && uso.anio === anio)?.usados);
// Lo no utilizado previamente de un año (`noUtilizadasDe`), o null
const noUtilizadasDel = (cuenta, anio) => (esObjeto(cuenta.noUtilizadas) && Object.hasOwn(cuenta.noUtilizadas, anio)
  && esObjeto(cuenta.noUtilizadas[anio]) ? cuenta.noUtilizadas[anio] : null);

// «Vence pronto» (spec, 3.9; la línea de cada cosa, spec 2026-10-27-mi-espacio-resumen, 4.1)
// Desde qué día del año se avisa la licencia que vence el 31/12
const AVISO_DE_LA_LICENCIA = '10-01';

// La línea de lo que vence, según los días corridos de hoy a su fecha: «Vence el viernes 30/10, en 4 días.», «Vence mañana.»,
// «Vence hoy.» o, si ya pasó (el franco o las horas a favor del mes después de su último día hábil, que siguen en la lista
// hasta que termina el mes), «Venció el viernes 30/10.». En singular solo con una cantidad de 1 (1 franco, 1 hora o 1 día);
// si no, «Vencen» y «Vencieron». «Venció» es neutro, como «vence»: nunca «perdiste»
const textoDeLoQueVence = (fecha, cantidad, hoy) => {
  const una = cantidad === 1;
  const faltan = diasEntre(hoy, fecha);
  if (faltan < 0) return `${una ? 'Venció' : 'Vencieron'} el ${diaLargo(fecha)}.`;
  const vence = una ? 'Vence' : 'Vencen';
  if (faltan === 0) return `${vence} hoy.`;
  if (faltan === 1) return `${vence} mañana.`;
  return `${vence} el ${diaLargo(fecha)}, en ${faltan} días.`;
};

// Una cosa de «Vence pronto»: `{ fecha, dia, mes, titulo, texto, accion }` (el día y el mes, del talón; `accion`, el botón que
// la resuelve)
const cosaQueVence = ({ fecha, cantidad, titulo, accion }, hoy) => ({
  fecha, dia: String(Number(fecha.slice(8, 10))), mes: MESES_CORTOS[Number(fecha.slice(5, 7)) - 1], titulo,
  texto: textoDeLoQueVence(fecha, cantidad, hoy), accion
});

/**
 * Lo que vence pronto, por fecha: el franco (en planta) o las horas a favor (en contrato) del mes en curso que siguen sin
 * usar, en su último día hábil (hasta que termina el mes: una licencia ya pasada se puede cargar igual), y, desde el 1/10,
 * los días disponibles de la licencia ordinaria que vence el 31/12 de este año.
 */
const venceProntoDe = ({ modalidad, hoy, mes, cuenta }) => {
  const lista = [];
  const planta = modalidad === 'planta';
  const delMes = delMesDeUso(planta ? cuenta.francos : cuenta.horasAFavor, mes);
  const quedan = cantidadDe(delMes?.disponibles);
  if (quedan > 0 && esFechaIso(delMes.ultimo_dia_habil)) {
    const titulo = planta
      ? `${conUnidad(quedan, 'franco compensatorio', 'francos compensatorios')} de ${nombreDelMes(mes)}`
      : `${conUnidad(quedan, 'hora', 'horas')} a favor de ${nombreDelMes(mes)}`;
    const accion = planta
      ? { texto: quedan === 1 ? 'Cargarlo' : 'Cargarlos', tipo: 'franco' }
      : { texto: quedan === 1 ? 'Usarla' : 'Usarlas', tipo: 'horas_a_favor' };
    lista.push(cosaQueVence({ fecha: delMes.ultimo_dia_habil, cantidad: quedan, titulo, accion }, hoy));
  }

  const anio = hoy.slice(0, 4);
  const finDelAnio = `${anio}-12-31`;
  if (hoy >= `${anio}-${AVISO_DE_LA_LICENCIA}`) {
    const vieja = ordinariasDel(cuenta).find((ordinaria) =>
      ordinaria.vence === finDelAnio && cantidadDe(ordinaria.disponibles) > 0);
    if (vieja !== undefined) {
      const dias = cantidadDe(vieja.disponibles);
      lista.push(cosaQueVence({
        fecha: finDelAnio, cantidad: dias, titulo: `${conUnidad(dias, 'día', 'días')} de la licencia ${vieja.anio}`,
        accion: { texto: 'Cargar vacaciones', tipo: 'vacaciones' }
      }, hoy));
    }
  }
  return lista.sort((a, b) => compararTexto(a.fecha, b.fecha));
};

// Los meses ('AAAA-MM') de los días de vacaciones cargados a futuro: los que descuentan después de hoy y salen de alguna
// licencia (sin los que quedaron sin cubrir), los mismos que el reparto cuenta como `cargados`
const mesesCargados = ({ hoy, datos, cuenta, feriados }) => {
  const reparto = esObjeto(cuenta.reparto) ? cuenta.reparto : {};
  const sinCubrir = reparto.sinCubrir instanceof Map ? reparto.sinCubrir : new Map();
  const meses = new Set();
  for (const fila of listaDe(datos.licencias)) {
    if (!esObjeto(fila) || fila.tipo !== 'vacaciones') continue;
    const sinDias = listaDe(sinCubrir.get(idDe(fila.id)));
    for (const dia of diasQueDescuentan(fila, datos, feriados)) {
      if (dia > hoy && !sinDias.includes(dia)) meses.add(dia.slice(0, 7));
    }
  }
  return [...meses].sort(compararTexto);
};

/**
 * El tanque de vacaciones: `{ numero, unidad, pie, capacidad, aria, capas }`. Las capas van de abajo hacia arriba: las
 * licencias con días disponibles (la que vence este año, `vence`; las demás alternan `tinta` y `medio`; la nota es su
 * vencimiento o «La primera mitad» si la segunda todavía no se habilitó), lo cargado a futuro (`cargadas`) y lo que todavía
 * no se habilita (`por_habilitar`), estas dos si no son 0. Las licencias de los años que vienen (`ordinariasDe` llega hasta
 * la del año siguiente, sin nada habilitado) no están en el tanque; lo cargado de cualquiera, sí. La capacidad es la suma de
 * las capas.
 */
const tanqueDeVacaciones = (panel) => {
  const { hoy, anio } = panel;
  const finDelAnio = `${hoy.slice(0, 4)}-12-31`;
  const ordinarias = ordinariasDel(panel.cuenta);
  const hastaEsteAnio = ordinarias.filter((ordinaria) => ordinaria.anio <= anio);
  const conDias = hastaEsteAnio.filter((ordinaria) => cantidadDe(ordinaria.disponibles) > 0);

  let alternadas = 0;
  const capas = conDias.map((ordinaria) => {
    let clase = 'vence';
    if (ordinaria.vence !== finDelAnio) clase = alternadas++ % 2 === 0 ? 'tinta' : 'medio';
    const nota = cantidadDe(ordinaria.habilitado) < cantidadDe(ordinaria.total)
      ? 'La primera mitad' : `Vence el ${fechaCorta(ordinaria.vence)}`;
    return { clase, n: cantidadDe(ordinaria.disponibles), nombre: `Licencia ${ordinaria.anio}`, nota };
  });

  const cargados = ordinarias.reduce((suma, ordinaria) => suma + Math.max(0, cantidadDe(ordinaria.cargados)), 0);
  if (cargados > 0) {
    // El mes con su año si no es el de hoy: «Cargados para diciembre y enero de 2027»
    const meses = mesesCargados(panel).map((mes) => (anioDe(mes) === anio ? nombreDelMes(mes) : mesEnFrase(mes)));
    const cargadosPara = cargados === 1 ? 'Cargado' : 'Cargados';
    capas.push({
      clase: 'cargadas', n: cargados, nombre: 'Cargados',
      nota: meses.length === 0 ? cargadosPara : `${cargadosPara} para ${enLista(meses)}`
    });
  }

  const porHabilitar = hastaEsteAnio.reduce((suma, ordinaria) => suma + Math.max(0, cantidadDe(ordinaria.por_habilitar)), 0);
  if (porHabilitar > 0) {
    const fechas = [...new Set(hastaEsteAnio.filter((ordinaria) => cantidadDe(ordinaria.por_habilitar) > 0)
      .flatMap((ordinaria) => listaDe(ordinaria.mitades))
      .filter((mitad) => esObjeto(mitad) && esFechaIso(mitad.habilita) && mitad.habilita > hoy && cantidadDe(mitad.dias) > 0)
      .map((mitad) => mitad.habilita))].sort(compararTexto);
    const seHabilitan = porHabilitar === 1 ? 'Se habilita' : 'Se habilitan';
    capas.push({
      clase: 'por_habilitar', n: porHabilitar, nombre: 'Todavía no',
      nota: fechas.length === 0
        ? seHabilitan : `${seHabilitan} ${enLista(fechas.map((fecha) => `el ${fechaSinCeros(fecha)}`))}`
    });
  }

  const numero = conDias.reduce((suma, ordinaria) => suma + cantidadDe(ordinaria.disponibles), 0);
  return {
    numero,
    unidad: numero === 1 ? 'día' : 'días',
    pie: conDias.length === 0 ? 'Sin días disponibles' : `de ${conUnidad(conDias.length, 'licencia', 'licencias')}`,
    capacidad: capas.reduce((suma, capa) => suma + capa.n, 0),
    aria: `Vacaciones: ${conUnidad(numero, 'día hábil disponible', 'días hábiles disponibles')}. Ver tus licencias`,
    capas
  };
};

// La banda «Titular» (spec 2026-10-27-mi-espacio-resumen, 4.2)

/**
 * La bajada de la frase: una oración `{ texto, vence }` por cada capa del tanque de vacaciones que explica la regla, en este
 * orden y solo las que hay: la licencia que vence en el año («3 vencen el jueves 31/12.», `vence`: en ámbar en la página), lo
 * cargado a futuro («5 ya están cargados para noviembre.») y lo que todavía no se habilita («Otros 10 se habilitan el
 * 1/1/2027.»; sin «Otros» si la frase no tiene días). Los días son los de cada capa y los meses y las fechas, los de su nota,
 * que dice lo mismo con mayúscula («Cargados para noviembre», «Se habilitan el 1/1/2027»): no se vuelven a calcular. La capa
 * `vence` es la de la licencia que vence el 31/12 de este año. En singular solo con 1. Sin ninguna, [].
 */
const bajadaDe = ({ numero, capas }, hoy) => {
  const capa = (clase) => capas.find((una) => una.clase === clase);
  const bajada = [];
  const vence = capa('vence');
  if (vence !== undefined) {
    const vencen = vence.n === 1 ? 'vence' : 'vencen';
    bajada.push({ texto: `${numeroTexto(vence.n)} ${vencen} el ${diaLargo(`${hoy.slice(0, 4)}-12-31`)}.`, vence: true });
  }
  const cargadas = capa('cargadas');
  if (cargadas !== undefined) {
    const estan = cargadas.n === 1 ? 'ya está' : 'ya están';
    bajada.push({ texto: `${numeroTexto(cargadas.n)} ${estan} ${minuscula(cargadas.nota)}.`, vence: false });
  }
  const porHabilitar = capa('por_habilitar');
  if (porHabilitar !== undefined) {
    let otros = '';
    if (numero > 0) otros = porHabilitar.n === 1 ? 'Otro ' : 'Otros ';
    bajada.push({ texto: `${otros}${numeroTexto(porHabilitar.n)} ${minuscula(porHabilitar.nota)}.`, vence: false });
  }
  return bajada;
};

/**
 * La frase de la banda: `{ encabezado, antes, cifra, despues, bajada }`. `encabezado` es el día de hoy sin el año y la
 * modalidad en minúscula («Lunes 26 de octubre, planta permanente»); `antes`, `cifra` y `despues`, la frase partida alrededor
 * de los días de vacaciones disponibles (los del tanque): «Te quedan», '33' y «días de vacaciones»; con 1, «Te queda», '1' y
 * «día de vacaciones»; con 0, «No te quedan días de vacaciones», '' y '' (la página no dibuja el número).
 */
const titularDe = ({ hoy }, modalidad, vacaciones) => {
  const { numero } = vacaciones;
  let frase = ['No te quedan días de vacaciones', '', ''];
  if (numero === 1) frase = ['Te queda', '1', 'día de vacaciones'];
  else if (numero > 0) frase = ['Te quedan', numeroTexto(numero), 'días de vacaciones'];
  const [antes, cifra, despues] = frase;
  return {
    encabezado: `${mayuscula(diaDeLaSemana(hoy))} ${Number(hoy.slice(8, 10))} de ${nombreDelMes(hoy.slice(0, 7))}, `
      + minuscula(modalidad.texto),
    antes,
    cifra,
    despues,
    bajada: bajadaDe(vacaciones, hoy)
  };
};

// Los demás tanques (spec, sección 8)
const NOMBRES_DE_LOS_TANQUES = Object.freeze({
  franquicia: 'Franquicias', estudios: 'Estudios', medica: 'Atención médica', familiar: 'Grupo familiar'
});

// El de un tipo con tope del año: lo que queda de las 42 horas de franquicia, de los días de estudios de la carrera y de los
// 25 días de atención médica y de grupo familiar
const tanqueDeTope = (tipo, { anio, datos, cuenta }) => {
  const total = cantidadDe(topeDe(tipo, anio, datos.anios));
  const valor = Math.max(0, total - usadosDe(cuenta, tipo, anio));
  const [una, varias] = tipo === 'franquicia' ? ['hora', 'horas'] : ['día', 'días'];
  const nombre = NOMBRES_DE_LOS_TANQUES[tipo];
  return {
    clave: tipo, nombre, numero: numeroTexto(valor), unidad: valor === 1 ? una : varias,
    de: `de ${numeroTexto(total)} ${varias}`, valor, total, vence: false, pestana: 'licencias',
    aria: `${nombre}: ${valor === 1 ? 'queda' : 'quedan'} ${numeroTexto(valor)} de ${numeroTexto(total)} ${varias}. `
      + 'Ver tus licencias'
  };
};

// El de contrato en lugar de las franquicias: las horas a favor de este mes, en ámbar si quedan (vencen al final del mes)
const tanqueDeHoras = ({ mes, cuenta }) => {
  const delMes = delMesDeUso(cuenta.horasAFavor, mes);
  const valor = cantidadDe(delMes?.disponibles);
  const total = cantidadDe(delMes?.a_favor);
  const enElMes = `en ${nombreDelMes(mes)}`;
  return {
    clave: 'horas_a_favor', nombre: 'Horas a favor', numero: numeroTexto(valor), unidad: valor === 1 ? 'hora' : 'horas',
    de: `de ${numeroTexto(total)} ${enElMes}`, valor, total, vence: valor > 0, pestana: 'horas',
    aria: `Horas a favor: ${valor === 1 ? 'queda' : 'quedan'} ${numeroTexto(valor)} de ${numeroTexto(total)} horas `
      + `${enElMes}. Ver tus horas extras`
  };
};

// Con «No estudio» en el año, la licencia por estudios no tiene tope: no hay tanque ni se ofrece el tipo
const estudiaEsteAnio = ({ anio, datos }) => topeDe('estudios', anio, datos.anios) !== null;

const otrosTanques = (panel) => [
  panel.modalidad === 'planta' ? tanqueDeTope('franquicia', panel) : tanqueDeHoras(panel),
  ...(estudiaEsteAnio(panel) ? [tanqueDeTope('estudios', panel)] : []),
  tanqueDeTope('medica', panel),
  tanqueDeTope('familiar', panel)
];

// Una pastilla: el franco o las horas a favor de un mes de uso. `pendiente` si su mes trabajado todavía suma, `vence` si es
// el del mes en curso y le queda algo, y si no, `disponible`
const pastilla = (fila, planta, mes) => {
  const quedan = cantidadDe(fila.disponibles);
  const base = { numero: numeroTexto(quedan), mes: mayuscula(nombreDelMes(fila.mes_de_uso)) };
  const trabajado = textoDe(fila.mes_trabajado);
  if (trabajado >= mes) return { ...base, nota: `${mayuscula(nombreDelMes(trabajado))} sigue sumando`, estado: 'pendiente' };
  if (fila.mes_de_uso !== mes) return { ...base, nota: `Por las horas de ${nombreDelMes(trabajado)}`, estado: 'disponible' };
  if (quedan === 0) return { ...base, nota: planta ? 'Todos usados' : 'Todas usadas', estado: 'disponible' };
  const hasta = `hasta el ${diaLargo(fila.ultimo_dia_habil)}`;
  return {
    ...base, nota: planta ? mayuscula(hasta) : `De ${numeroTexto(cantidadDe(fila.a_favor))}, ${hasta}`, estado: 'vence'
  };
};

// Lo no utilizado previamente de este año, en gris al final de las pastillas: el mes del que viene si es uno solo, o el año
const previoDe = (planta, anio, cuenta) => {
  const delAnio = noUtilizadasDel(cuenta, anio);
  const quedan = cantidadDe(delAnio?.quedan);
  if (quedan <= 0) return null;
  const meses = listaDe(delAnio.meses).filter((mes) => esObjeto(mes) && cantidadDe(mes.quedan) > 0);
  const delSaldo = esObjeto(delAnio.saldo) && cantidadDe(delAnio.saldo.quedan) > 0;
  const titulo = !delSaldo && meses.length === 1
    ? mayuscula(nombreDelMes(meses[0].mes_de_uso)) : `${planta ? 'Francos' : 'Horas'} de ${anio}`;
  const [uno, varios] = planta
    ? ['No utilizado previamente', 'No utilizados previamente']
    : ['No utilizada previamente', 'No utilizadas previamente'];
  return { numero: numeroTexto(quedan), titulo, nota: quedan === 1 ? uno : varios };
};

/**
 * Las pastillas de debajo de los tanques: `{ titulo, meses: [{ numero, mes, nota, estado }], previo }`. En planta, los
 * francos de los meses de uso de este mes a dos más, los que tienen alguno; en contrato, las horas a favor de este mes y
 * del siguiente, las que tienen alguna. `previo` es lo no utilizado previamente del año, o null.
 */
const pastillasDe = ({ modalidad, mes, anio, cuenta }) => {
  const planta = modalidad === 'planta';
  const lista = listaDe(planta ? cuenta.francos : cuenta.horasAFavor).filter(esObjeto);
  const meses = (planta ? [0, 1, 2] : [0, 1])
    .map((cuantos) => lista.find((fila) => fila.mes_de_uso === mesMas(mes, cuantos)))
    .filter((fila) => fila !== undefined && cantidadDe(planta ? fila.francos : fila.a_favor) > 0)
    .map((fila) => pastilla(fila, planta, mes));
  return { titulo: planta ? 'Francos compensatorios' : 'Horas a favor', meses, previo: previoDe(planta, anio, cuenta) };
};

// La médica extraordinaria, en una línea corta (spec 2026-10-27-mi-espacio-resumen, 4.3)
const textoDeLaExtraordinaria = ({ anio, cuenta }) => {
  const usados = usadosDe(cuenta, 'medica_extraordinaria', anio);
  const enElAnio = usados > 0 ? `Usaste ${conUnidad(usados, 'día', 'días')} en ${anio}.` : `No usaste en ${anio}.`;
  return `Atención médica extraordinaria: sin tope. ${enElAnio}`;
};

// Los nombres de las opciones de «Cargar licencia» (los de la maqueta)
const NOMBRES_DE_LAS_OPCIONES = Object.freeze({ ...NOMBRES_TIPO, familiar: 'Grupo familiar' });

// Lo que queda de cada tipo, debajo de su opción: «33 disponibles», «Quedan 25 h de 42», «Quedan 9 de 15», «Sin tope», «1
// para octubre» (el primer mes de uso, desde este, con francos para usar) y «Quedan 1,5 h en octubre»
const quedaDelTipo = (tipo, panel, tanques) => {
  if (tipo === 'vacaciones') return conUnidad(tanques.vacaciones.numero, 'disponible', 'disponibles');
  if (tipo === 'medica_extraordinaria') return 'Sin tope';
  if (tipo === 'franco') {
    const conFrancos = listaDe(panel.cuenta.francos).find((fila) => esObjeto(fila)
      && typeof fila.mes_de_uso === 'string' && fila.mes_de_uso >= panel.mes && cantidadDe(fila.disponibles) > 0);
    if (conFrancos === undefined) return 'Ninguno para usar';
    return `${numeroTexto(cantidadDe(conFrancos.disponibles))} para ${nombreDelMes(conFrancos.mes_de_uso)}`;
  }
  const tanque = tanques.otros.find((otro) => otro.clave === tipo);
  if (tanque === undefined) return '';
  const queda = tanque.valor === 1 ? 'Queda' : 'Quedan';
  if (tipo === 'horas_a_favor') return `${queda} ${tanque.numero} h en ${nombreDelMes(panel.mes)}`;
  return `${queda} ${tanque.numero}${tipo === 'franquicia' ? ' h' : ''} de ${numeroTexto(tanque.total)}`;
};

// Las opciones de «Cargar licencia»: los tipos de la modalidad, sin el uso autorizado (tiene su propio formulario) ni, con
// «No estudio», los estudios
const tiposDe = (panel, tanques) => TIPOS_POR_MODALIDAD[panel.modalidad]
  .filter((tipo) => tipo !== 'uso_autorizado' && (tipo !== 'estudios' || estudiaEsteAnio(panel)))
  .map((tipo) => ({ tipo, nombre: NOMBRES_DE_LAS_OPCIONES[tipo], queda_texto: quedaDelTipo(tipo, panel, tanques) }));

/**
 * El Resumen «Titular» (spec, secciones 3.9 y 8, y spec 2026-10-27-mi-espacio-resumen, sección 4), todo lo de
 * `GET /api/mi-espacio/resumen`. Recibe `{ persona, estado, calculo, hoy, feriados, hoyYManana }`: `persona` es `{ id,
 * nombre_completo, rol, vinculo }`, `calculo` el de `calcular` con ese hoy y esos feriados, y `hoyYManana` lo que arma quien
 * lo llama (`{ ausentes_hoy, ausentes_manana, proximo_feriado, eventos }`), que va tal cual.
 * Devuelve `{ modalidad: { clave, texto } | null, anio, al_texto, mensaje, abrir_saldos, persona: { nombre, ve_companeros,
 * audita, es_superadmin }, marca, vence_pronto, faltantes, tanques: { vacaciones, otros } | null, titular, pastillas,
 * extraordinaria, tipos, hoy_y_manana }`:
 * - sin modalidad, `mensaje` es `sinModalidad` y no hay nada que mostrar ni cargar;
 * - con modalidad y sin arranque, `mensaje` es `sinArranque` y `abrir_saldos` es true (se abre «Mis vacaciones y saldos»);
 * - si no, `marca` dice si hay algo en `vence_pronto` (cada cosa `{ fecha, dia, mes, titulo, texto, accion }`, con su línea en
 *   `texto`: «Vence el viernes 30/10, en 4 días.»), `faltantes` son los textos de `faltantesDe`, `titular` es la frase de la
 *   banda (`{ encabezado, antes, cifra, despues, bajada: [{ texto, vence }] }`; null sin tanques), `extraordinaria` la línea
 *   corta de la médica extraordinaria y `tipos`, las opciones de «Cargar licencia» con lo que queda de cada una.
 * `ve_companeros` es `esAdmin` (los compañeros son administración: spec, sección 7) y `audita`, `esAuditor`.
 */
export const resumenDe = (entrada) => {
  const { persona, estado, calculo, hoy, feriados, hoyYManana } = esObjeto(entrada) ? entrada : {};
  const quien = esObjeto(persona) ? persona : {};
  const datos = esObjeto(estado) ? estado : {};
  const modalidad = MODALIDADES.includes(datos.modalidad) ? datos.modalidad : null;
  const deHoy = esFechaIso(hoy) ? hoy : null;

  const resumen = {
    modalidad: modalidad === null ? null : { clave: modalidad, texto: textoDeLaModalidad(quien.vinculo, modalidad) },
    anio: deHoy === null ? null : anioDe(deHoy),
    al_texto: deHoy === null ? '' : `Al ${diaDeLaSemana(deHoy)} ${formatoCorto(deHoy)}`,
    mensaje: null,
    abrir_saldos: false,
    persona: {
      nombre: textoDe(quien.nombre_completo), ve_companeros: esAdmin(quien.rol), audita: esAuditor(quien.rol),
      es_superadmin: quien.rol === 'superadmin'
    },
    marca: false,
    vence_pronto: [],
    faltantes: [],
    tanques: null,
    titular: null,
    pastillas: null,
    extraordinaria: null,
    tipos: [],
    hoy_y_manana: esObjeto(hoyYManana) ? { ...hoyYManana } : { ausentes_hoy: [], ausentes_manana: [], proximo_feriado: null }
  };
  if (modalidad === null) return { ...resumen, mensaje: MENSAJES_MI_ESPACIO.sinModalidad };
  if (!esFechaIso(datos.arranque)) return { ...resumen, mensaje: MENSAJES_MI_ESPACIO.sinArranque, abrir_saldos: true };
  if (deHoy === null) return resumen;

  const panel = {
    modalidad, hoy: deHoy, anio: anioDe(deHoy), mes: deHoy.slice(0, 7), datos,
    cuenta: esObjeto(calculo) ? calculo : {}, feriados
  };
  const vencePronto = venceProntoDe(panel);
  const tanques = { vacaciones: tanqueDeVacaciones(panel), otros: otrosTanques(panel) };
  return {
    ...resumen,
    marca: vencePronto.length > 0,
    vence_pronto: vencePronto,
    faltantes: listaDe(panel.cuenta.faltantes)
      .filter((faltante) => esObjeto(faltante) && typeof faltante.texto === 'string').map((faltante) => faltante.texto),
    tanques,
    titular: titularDe(panel, resumen.modalidad, tanques.vacaciones),
    pastillas: pastillasDe(panel),
    extraordinaria: textoDeLaExtraordinaria(panel),
    tipos: tiposDe(panel, tanques)
  };
};

// La lista de licencias (spec, sección 8)
const NOMBRES_DE_LOS_FILTROS = Object.freeze({
  ...NOMBRES_TIPO, franquicia: 'Franquicias', franco: 'Francos', uso_autorizado: 'Usos autorizados',
  familiar: 'Grupo familiar'
});
const TEXTO_FUERA_DE_LA_MODALIDAD = 'No corresponde a tu modalidad actual: no cuenta.';
const TEXTO_ANTES_DEL_SALDO = 'Antes del saldo inicial: no descuenta';

// Los años del selector: de dos antes del arranque (o de hoy, sin arranque) al siguiente al de hoy
const aniosDelSelector = (arranque, hoy) => {
  if (hoy === null) return [];
  const anios = [];
  for (let anio = anioDe(esFechaIso(arranque) ? arranque : hoy) - 2; anio <= anioDe(hoy) + 1; anio++) anios.push(anio);
  return anios;
};

// '03/11 al 09/11/2026', '28/12/2026 al 05/01/2027' o, de un día, 'Vie 23/10/2026'
const textoDeLasFechas = (desde, hasta) => {
  if (desde === hasta) return diaCorto(desde);
  return `${desde.slice(0, 4) === hasta.slice(0, 4) ? diaYMes(desde) : formatoCorto(desde)} al ${formatoCorto(hasta)}`;
};

// '7 días corridos, 5 hábiles', '2 días hábiles', '1 día' (un franco o un uso autorizado de planta, que es un franco), '2
// horas' o '7 horas, el día entero'
const textoDeLaCantidad = ({ tipo, desde, hasta }, horas, { modalidad, fuera, feriados }) => {
  const enHoras = tipo === 'franquicia' || tipo === 'horas_a_favor'
    || (tipo === 'uso_autorizado' && (modalidad !== 'planta' || fuera));
  if (enHoras) {
    if (horas === null) return '';
    return horas === JORNADA ? `${numeroTexto(horas)} horas, el día entero` : conUnidad(horas, 'hora', 'horas');
  }
  if (tipo === 'franco' || tipo === 'uso_autorizado') return '1 día';
  const habiles = diasHabilesDe(desde, hasta, feriados).length;
  const corridos = diasEntre(desde, hasta) + 1;
  if (corridos === habiles) return conUnidad(habiles, 'día hábil', 'días hábiles');
  return `${conUnidad(corridos, 'día corrido', 'días corridos')}, ${conUnidad(habiles, 'hábil', 'hábiles')}`;
};

// De qué licencia salen unas vacaciones: 'De la licencia 2024.' o 'De las licencias 2024 (3 días) y 2025 (2 días).'; sin
// días que salgan de alguna, ''
const textoDeLasLicencias = (reparto, id) => {
  const porFila = esObjeto(reparto) && reparto.porFila instanceof Map ? reparto.porFila : new Map();
  const partes = listaDe(porFila.get(idDe(id))).filter((parte) => esObjeto(parte) && Number.isInteger(parte.anio));
  if (partes.length === 0) return '';
  if (partes.length === 1) return `De la licencia ${partes[0].anio}.`;
  return `De las licencias ${enLista(partes.map(({ anio, dias }) =>
    `${anio} (${conUnidad(cantidadDe(dias), 'día', 'días')})`))}.`;
};

/**
 * Una fila de la lista. Lo de Configuración sale del vínculo de la fila (Task 10: `{ configuracion: { texto, insignia } |
 * null, puede_borrar, solo_hasta, fechas_fijas, en_configuracion }`); sin vínculo, null, true, false, false y null.
 * `en_configuracion` (`{ licencia_id, autorizado_id }`, solo de una creada) es lo que necesita el formulario para corregirla:
 * la persona a cargo que ya tiene y el id de su licencia de Configuración (la lista es siempre la de su dueño). «Tus
 * compañeros ven…» va solo para administración (`esAdmin`: los únicos que tienen la casilla), con «Mostrar», en una ausencia
 * de día entero que todavía no terminó.
 */
const filaDeLicencia = (fila, { datos, cuenta, hoy, persona, vinculos, feriados }) => {
  const { tipo, desde, hasta } = fila;
  const { modalidad, arranque } = datos;
  const fuera = fueraDeLaModalidad(fila, modalidad);
  const antes = esFechaIso(arranque) && tieneSaldoInicial(tipo, modalidad) && desde < arranque
    && diasQueDescuentan(fila, datos, feriados).length === 0;
  const horas = typeof fila.horas === 'number' || typeof fila.horas === 'string' ? cantidadDe(fila.horas) : null;
  const mostrar = ![0, '0', false].includes(fila.mostrar);
  const vinculo = vinculos.get(idDe(fila.id));
  const conVinculo = esObjeto(vinculo);
  const configuracion = conVinculo && esObjeto(vinculo.configuracion) ? vinculo.configuracion : null;
  return {
    id: fila.id ?? null,
    tipo,
    tipo_nombre: NOMBRES_TIPO[tipo],
    desde,
    hasta,
    horas,
    fechas_texto: textoDeLasFechas(desde, hasta),
    cantidad_texto: textoDeLaCantidad(fila, horas, { modalidad, fuera, feriados }),
    proxima: hoy !== null && desde > hoy,
    de_licencias_texto: tipo === 'vacaciones' ? textoDeLasLicencias(cuenta.reparto, fila.id) : '',
    antes_del_arranque: antes,
    fuera_de_la_modalidad: fuera,
    no_cuenta_texto: fuera ? TEXTO_FUERA_DE_LA_MODALIDAD : (antes ? TEXTO_ANTES_DEL_SALDO : ''),
    nota: typeof fila.nota === 'string' && fila.nota.trim() !== '' ? fila.nota : null,
    mostrar,
    mostrar_texto: esAdmin(persona.rol) && mostrar && esDiaEntero(fila) && hoy !== null && hasta >= hoy
      ? `Tus compañeros ven «${textoDe(persona.nombre_completo)} no está».` : '',
    configuracion: configuracion === null ? null : {
      texto: textoDe(configuracion.texto),
      insignia: typeof configuracion.insignia === 'string' ? configuracion.insignia : null
    },
    puede_borrar: !conVinculo || vinculo.puede_borrar !== false,
    solo_hasta: conVinculo && vinculo.solo_hasta === true,
    fechas_fijas: conVinculo && vinculo.fechas_fijas === true,
    en_configuracion: conVinculo && esObjeto(vinculo.en_configuracion) ? {
      licencia_id: vinculo.en_configuracion.licencia_id ?? null, autorizado_id: vinculo.en_configuracion.autorizado_id ?? null
    } : null
  };
};

// Lo que ya se había usado en el año del arranque, en el orden del modal; el primero en días lleva la unidad: «6 días de
// estudios, 3 de atención médica»
const USADOS_EN_DIAS = Object.freeze([
  ['estudios', 'de estudios'], ['medica', 'de atención médica'], ['familiar', 'de atención del grupo familiar']
]);

/**
 * El saldo inicial al final de la lista del año del arranque (en los demás años, null): `{ fecha, titulo, cargado_texto,
 * texto }`. El texto dice lo que quedaba de cada licencia ordinaria, lo que ya se había usado en el año (en planta, las
 * franquicias) y, en contrato, las horas no utilizadas previamente; lo que es 0 no se nombra.
 */
const saldoInicialDe = ({ arranque, modalidad, saldos }, anio) => {
  if (!esFechaIso(arranque) || anioDe(arranque) !== anio) return null;
  const filas = listaDe(saldos).filter(esObjeto);
  const cantidad = (concepto) => cantidadDe(filas.find((fila) =>
    fila.concepto === concepto && cantidadDe(fila.anio) === anio)?.cantidad);

  const vacaciones = filas.filter((fila) => fila.concepto === 'vacaciones' && cantidadDe(fila.cantidad) > 0)
    .map((fila) => ({ anio: cantidadDe(fila.anio), dias: cantidadDe(fila.cantidad) }))
    .sort((a, b) => a.anio - b.anio);
  const partes = vacaciones.map(({ anio: delAnio, dias }, i) =>
    (i === 0 ? `${conUnidad(dias, 'día', 'días')} de la licencia ${delAnio}` : `${numeroTexto(dias)} de la ${delAnio}`));
  const quedaba = vacaciones.length === 1 && vacaciones[0].dias === 1 ? 'quedaba' : 'quedaban';
  let texto = 'Antes de empezar con Mi espacio: de vacaciones, '
    + (partes.length === 0 ? 'no te quedaba ningún día.' : `${quedaba} ${enLista(partes)}.`);

  const usados = [];
  const franquicias = modalidad === 'planta' ? cantidad('franquicias') : 0;
  if (franquicias > 0) usados.push(`${conUnidad(franquicias, 'hora', 'horas')} de franquicia`);
  let enDias = 0;
  for (const [concepto, deQue] of USADOS_EN_DIAS) {
    const dias = cantidad(concepto);
    if (dias <= 0) continue;
    usados.push(`${enDias++ === 0 ? conUnidad(dias, 'día', 'días') : numeroTexto(dias)} ${deQue}`);
  }
  if (usados.length > 0) texto += ` En ${anio} ya habías usado ${enLista(usados)}.`;
  const horas = modalidad === 'contrato' ? cantidad('horas_no_utilizadas') : 0;
  if (horas > 0) texto += ` Tenías ${conUnidad(horas, 'hora no utilizada', 'horas no utilizadas')} previamente.`;

  return { fecha: arranque, titulo: `Saldo inicial ${anio}`, cargado_texto: `Cargado el ${formatoCorto(arranque)}`, texto };
};

/**
 * La pestaña Licencias de un año (`GET /api/mi-espacio/licencias?anio=`): `{ anio, anios, filtros, licencias,
 * saldo_inicial }`. Las opciones son `{ anio, hoy, persona, vinculos, feriados }` (`anio`, un entero o un texto de cuatro
 * cifras; si no sirve, el de hoy; `feriados`, el Set del cálculo, para contar los días hábiles de cada fila).
 * - `anios`: los del selector, de dos antes del arranque al siguiente al de hoy.
 * - `filtros`: «Todas» y cada tipo con filas en el año, con su cantidad, en plural donde hace falta (Franquicias, Francos,
 *   Usos autorizados, Grupo familiar).
 * - `licencias`: las que tocan el año (una que cruza el 31/12 va en los dos), de la más nueva a la más vieja. Lo anterior al
 *   arranque en un tipo con saldo inicial va con `antes_del_arranque` y lo que no corresponde a la modalidad, con
 *   `fuera_de_la_modalidad` (Review Focus 1): las dos se ven en gris, con su motivo en `no_cuenta_texto`.
 */
export const filasDeLicencias = (estado, calculo, opciones) => {
  const datos = esObjeto(estado) ? estado : {};
  const { anio, hoy, persona, vinculos, feriados } = esObjeto(opciones) ? opciones : {};
  const deHoy = esFechaIso(hoy) ? hoy : null;
  const elAnio = anioPedido(anio) ?? (deHoy === null ? null : anioDe(deHoy));
  const anios = aniosDelSelector(datos.arranque, deHoy);
  if (elAnio === null) {
    return {
      anio: null, anios, filtros: [{ tipo: 'todas', nombre: 'Todas', cantidad: 0 }], licencias: [], saldo_inicial: null
    };
  }

  const primero = `${elAnio}-01-01`;
  const ultimo = `${elAnio}-12-31`;
  const delAnio = listaDe(datos.licencias)
    .filter((fila) => esObjeto(fila) && TIPOS_LICENCIA.includes(fila.tipo) && esFechaIso(fila.desde)
      && esFechaIso(fila.hasta) && fila.desde <= fila.hasta && fila.desde <= ultimo && fila.hasta >= primero)
    .sort((a, b) => compararTexto(b.desde, a.desde) || compararTexto(b.hasta, a.hasta)
      || cantidadDe(idDe(b.id)) - cantidadDe(idDe(a.id)));

  const contexto = {
    datos, cuenta: esObjeto(calculo) ? calculo : {}, hoy: deHoy, persona: esObjeto(persona) ? persona : {},
    vinculos: vinculos instanceof Map ? vinculos : new Map(), feriados
  };
  const filtros = TIPOS_LICENCIA
    .map((tipo) => ({
      tipo, nombre: NOMBRES_DE_LOS_FILTROS[tipo], cantidad: delAnio.filter((fila) => fila.tipo === tipo).length
    }))
    .filter((filtro) => filtro.cantidad > 0);
  return {
    anio: elAnio,
    anios,
    filtros: [{ tipo: 'todas', nombre: 'Todas', cantidad: delAnio.length }, ...filtros],
    licencias: delAnio.map((fila) => filaDeLicencia(fila, contexto)),
    saldo_inicial: saldoInicialDe(datos, elAnio)
  };
};

// Las tablas de horas extras (spec, sección 8)

// La situación de un mes trabajado, `[estado, texto]`: el estado es para el color. En planta, «Disponible desde el 02/11»
// dice el primer día hábil del mes de uso, y un mes con francos usados y sin usar los dice los dos
const situacionDeLosFrancos = (fila, francos, mesDeHoy, feriados) => {
  if (fila.mes_trabajado >= mesDeHoy) return ['sumando', 'El mes sigue sumando'];
  if (francos === 0) return ['sin_franco', 'No llega a 7 horas: no genera franco'];
  const mesDeUso = textoDe(fila.mes_de_uso);
  if (mesDeUso > mesDeHoy) {
    return ['proximo', `Disponible desde el ${diaYMes(proximoDiaHabilCon(`${mesDeUso}-01`, feriados))}`];
  }
  const usos = listaDe(fila.usos).filter((uso) => esObjeto(uso) && esFechaIso(uso.fecha));
  const cuando = enLista(usos.map((uso) => `el ${diaYMes(uso.fecha)}`));
  const usados = usos.length === 0 ? null : `${usos.length} ${usos.length === 1 ? 'usado' : 'usados'} ${cuando}`;
  if (mesDeUso === mesDeHoy) {
    const quedan = cantidadDe(fila.disponibles);
    if (quedan === 0) return ['usados', 'Todos usados'];
    const paraUsar = `${numeroTexto(quedan)} para usar hasta el ${diaYMes(fila.ultimo_dia_habil)}`;
    return ['en_uso', usados === null ? paraUsar : `${usados} · ${paraUsar}`];
  }
  const sinUsar = cantidadDe(fila.no_utilizados);
  if (sinUsar === 0) return ['usados', 'Todos usados'];
  const noUtilizados = sinUsar === 1 ? 'no utilizado previamente' : 'no utilizados previamente';
  return ['no_utilizado', usados === null ? mayuscula(noUtilizados) : `${usados} · ${numeroTexto(sinUsar)} ${noUtilizados}`];
};

const situacionDeLasHoras = (fila, mesDeHoy) => {
  if (fila.mes_trabajado >= mesDeHoy) return ['sumando', 'El mes sigue sumando'];
  if (textoDe(fila.mes_de_uso) >= mesDeHoy) {
    const quedan = cantidadDe(fila.disponibles);
    if (quedan === 0) return ['usadas', 'Todas usadas'];
    return ['en_uso', `${numeroTexto(quedan)} h para usar hasta el ${diaYMes(fila.ultimo_dia_habil)}`];
  }
  const sinUsar = cantidadDe(fila.no_utilizadas);
  if (sinUsar === 0) return ['usadas', 'Todas usadas'];
  if (fila.antes_del_arranque === true) return ['antes_del_arranque', 'Antes del saldo inicial: está en el saldo'];
  return ['no_utilizadas', `${numeroTexto(sinUsar)} h ${sinUsar === 1 ? 'no utilizada' : 'no utilizadas'} previamente`];
};

// El uso autorizado (spec, 3.5 y 3.6): se puede registrar si queda algo no utilizado previamente en el año
const usoAutorizadoDe = (modalidad, anio, cuenta) => {
  const quedan = cantidadDe(noUtilizadasDel(cuenta, anio)?.quedan);
  if (quedan <= 0) return { puede: false, texto: textoSinNoUtilizadas(modalidad, anio, 0) };
  if (modalidad === 'contrato') {
    return {
      puede: true, texto: 'Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas.'
    };
  }
  return {
    puede: true,
    texto: `Tenés ${conUnidad(quedan, 'franco no utilizado', 'francos no utilizados')} previamente en ${anio}. `
      + `Si te autorizan a ${quedan === 1 ? 'tomarlo' : 'tomarlos'}, registrá un uso autorizado.`
  };
};

// «Horas no utilizadas previamente» de contrato: lo que queda de cada mes, del más nuevo al más viejo, y del saldo inicial
const noUtilizadasDeLaTabla = (anio, cuenta) => {
  const delAnio = noUtilizadasDel(cuenta, anio);
  const filas = listaDe(delAnio?.meses).filter((mes) => esObjeto(mes) && cantidadDe(mes.quedan) > 0)
    .sort((a, b) => compararTexto(textoDe(b.mes_de_uso), textoDe(a.mes_de_uso)))
    .map((mes) => ({
      titulo: mesTitulo(mes.mes_de_uso), texto: conUnidad(cantidadDe(mes.quedan), 'hora', 'horas'),
      detalle: `de las extras de ${nombreDelMes(mes.mes_trabajado)}`
    }));
  const delSaldo = esObjeto(delAnio?.saldo) ? cantidadDe(delAnio.saldo.quedan) : 0;
  if (delSaldo > 0) filas.push({ titulo: 'Del saldo inicial', texto: conUnidad(delSaldo, 'hora', 'horas'), detalle: '' });
  return {
    total_texto: `${conUnidad(cantidadDe(delAnio?.quedan), 'hora', 'horas')} en ${anio}`,
    filas,
    uso_autorizado: usoAutorizadoDe('contrato', anio, cuenta)
  };
};

/**
 * La pestaña Horas extras de un año (`GET /api/mi-espacio/horas-extras?anio=`). Las opciones son `{ anio, hoy, feriados }`
 * (`anio`, como en `filasDeLicencias`). Todas llevan `{ modalidad, anio, anios, meses, dias_por_mes, totales_por_mes,
 * mes_en_curso }`: `meses` son los meses trabajados del año con horas (uno sin horas, que está en el cálculo solo porque su
 * mes de uso tiene usos, no va: ese uso de más ya es un faltante), del más nuevo al más viejo, cada uno con `estado` (para
 * el color de su situación) y `situacion`; `dias_por_mes`, las horas extras de cada mes, de la más nueva a la más vieja
 * (`{ id, fecha, fecha_texto, desde, hasta, horario, horas_texto, nota }`: desde y hasta, para corregirlas);
 * `totales_por_mes`, las horas de cada mes ('10,5 horas'); y `mes_en_curso`, el de hoy si es de ese año (si no, null).
 * - En planta, cada mes es `{ mes, mes_texto, horas_texto, dias_texto, francos, uso_texto, estado, situacion }`, más
 *   `uso_autorizado: { puede, texto }`.
 * - En contrato, `{ mes, mes_texto, horas_texto, a_favor_texto, usadas_texto, usadas_detalle, estado, situacion }`, más
 *   `no_utilizadas: { total_texto, filas: [{ titulo, texto, detalle }], uso_autorizado }`.
 * Sin modalidad, `modalidad` es null y lo demás va vacío.
 */
export const tablaDeHorasExtras = (estado, calculo, opciones) => {
  const datos = esObjeto(estado) ? estado : {};
  const cuenta = esObjeto(calculo) ? calculo : {};
  const { anio, hoy, feriados } = esObjeto(opciones) ? opciones : {};
  const deHoy = esFechaIso(hoy) ? hoy : null;
  const elAnio = anioPedido(anio) ?? (deHoy === null ? null : anioDe(deHoy));
  const modalidad = MODALIDADES.includes(datos.modalidad) && deHoy !== null && elAnio !== null ? datos.modalidad : null;
  const tabla = {
    modalidad,
    anio: elAnio,
    anios: aniosDelSelector(datos.arranque, deHoy),
    meses: [],
    dias_por_mes: {},
    totales_por_mes: {},
    mes_en_curso: deHoy !== null && anioDe(deHoy) === elAnio ? deHoy.slice(0, 7) : null
  };
  if (modalidad === null) return tabla;

  const delAnio = `${elAnio}-`;
  const horasExtras = listaDe(datos.horasExtras)
    .filter((fila) => esObjeto(fila) && esFechaIso(fila.fecha) && fila.fecha.startsWith(delAnio)
      && horasDe(fila.desde, fila.hasta) !== null)
    .sort((a, b) => compararTexto(b.fecha, a.fecha) || compararTexto(b.desde, a.desde)
      || cantidadDe(idDe(b.id)) - cantidadDe(idDe(a.id)));
  const horasDelMes = new Map();
  for (const fila of horasExtras) {
    const mes = fila.fecha.slice(0, 7);
    const horas = horasDe(fila.desde, fila.hasta);
    if (!Object.hasOwn(tabla.dias_por_mes, mes)) tabla.dias_por_mes[mes] = [];
    tabla.dias_por_mes[mes].push({
      id: fila.id ?? null, fecha: fila.fecha, fecha_texto: diaCortoSinAnio(fila.fecha), desde: fila.desde, hasta: fila.hasta,
      horario: `${fila.desde} a ${fila.hasta}`, horas_texto: conUnidad(horas, 'hora', 'horas'),
      nota: typeof fila.nota === 'string' && fila.nota.trim() !== '' ? fila.nota : null
    });
    horasDelMes.set(mes, (horasDelMes.get(mes) ?? 0) + horas);
  }
  for (const [mes, horas] of horasDelMes) tabla.totales_por_mes[mes] = conUnidad(horas, 'hora', 'horas');
  const diasDelMes = (mes) => new Set(listaDe(tabla.dias_por_mes[mes]).map((dia) => dia.fecha)).size;

  const mesDeHoy = deHoy.slice(0, 7);
  const trabajados = listaDe(modalidad === 'planta' ? cuenta.francos : cuenta.horasAFavor)
    .filter((fila) => esObjeto(fila) && typeof fila.mes_trabajado === 'string' && fila.mes_trabajado.startsWith(delAnio)
      && cantidadDe(fila.horas) > 0)
    .sort((a, b) => compararTexto(b.mes_trabajado, a.mes_trabajado));

  if (modalidad === 'planta') {
    tabla.meses = trabajados.map((fila) => {
      const francos = cantidadDe(fila.francos);
      const [estadoDelMes, situacion] = situacionDeLosFrancos(fila, francos, mesDeHoy, feriados);
      return {
        mes: fila.mes_trabajado, mes_texto: mesTitulo(fila.mes_trabajado),
        horas_texto: `${numeroTexto(cantidadDe(fila.horas))} h`,
        dias_texto: conUnidad(diasDelMes(fila.mes_trabajado), 'día', 'días'), francos,
        uso_texto: francos > 0 ? mesTitulo(fila.mes_de_uso) : '—', estado: estadoDelMes, situacion
      };
    });
    return { ...tabla, uso_autorizado: usoAutorizadoDe('planta', elAnio, cuenta) };
  }

  tabla.meses = trabajados.map((fila) => {
    const usos = listaDe(fila.usos).filter((uso) => esObjeto(uso) && esFechaIso(uso.fecha));
    const usadas = cantidadDe(fila.usadas);
    const [estadoDelMes, situacion] = situacionDeLasHoras(fila, mesDeHoy);
    return {
      mes: fila.mes_trabajado, mes_texto: mesTitulo(fila.mes_trabajado),
      horas_texto: `${numeroTexto(cantidadDe(fila.horas))} h`, a_favor_texto: mesTitulo(fila.mes_de_uso),
      usadas_texto: usadas > 0 ? `${numeroTexto(usadas)} h` : '—',
      usadas_detalle: usos.map((uso) => `${diaYMes(uso.fecha)}: ${numeroTexto(cantidadDe(uso.horas))} h`).join(' · '),
      estado: estadoDelMes, situacion
    };
  });
  return { ...tabla, no_utilizadas: noUtilizadasDeLaTabla(elAnio, cuenta) };
};

/**
 * El próximo feriado de «Hoy y mañana»: el primero después de hoy que rige y cae de lunes a viernes (uno en un fin de semana
 * no cambia nada), de este año o del siguiente, con los 9 fijos y los de la tabla (`feriadosDelAnio`). `{ fecha, cuando:
 * 'Lunes 23/11', nombre }`, o null sin un hoy válido.
 */
export const proximoFeriadoDe = (filasFeriados, hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = anioDe(hoy);
  for (const delAnio of [anio, anio + 1]) {
    const proximo = feriadosDelAnio(filasFeriados, delAnio).find((feriado) => feriado.rige && feriado.fecha > hoy
      && feriado.dia_semana !== 'sábado' && feriado.dia_semana !== 'domingo');
    if (proximo !== undefined) {
      return { fecha: proximo.fecha, cuando: mayuscula(diaLargo(proximo.fecha)), nombre: proximo.nombre };
    }
  }
  return null;
};
