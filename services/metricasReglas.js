// Reglas de las métricas (spec 2026-10-24-metricas-y-reportes, secciones 1.1 a 1.7 y 2.2): cómo se cuentan los días, la cifra de un
// tramo, un caso por ciclo de cada dataset, con sus hitos (casosDe), y lo que la pestaña Métricas muestra de esos casos: el circuito,
// los resultados del año, la lista de casos y «Para completar» (vistaDe), y cuáles guarda la foto del 31/12 (casosQueTocanElAnio).
// Además, el resto de la pestaña: el índice de actualización mes a mes (indiceMesAMes), los estados de un día (estadosAl), la
// antigüedad de los vencidos (antiguedadDeVencidos), los tres juntos (contextoDelAnio), el trabajo del RPAD (trabajoDelAnio) y las
// áreas y los temas (areasYTemas).
// Funciones puras, sin base de datos ni Date local: las fechas son strings 'AAAA-MM-DD' y los momentos 'AAAA-MM-DD HH:MM:SS' en hora
// argentina, como en services/seguimientoReglas.js. De ahí se reutilizan los ciclos (ciclosDe) y a qué ciclo pertenece cada aviso
// (cicloDelAviso) y cada nota DGMIT (notasDgmitPorCiclo): las métricas y el Seguimiento ubican todo en el mismo ciclo, y cuentan los
// mismos avisos (esEmailADgmit, esNotaEnviada y momentoDeEnvioDeNota). Las fuentes son las de services/seguimientoDatos.js
// (fuentesDe). Ninguna función tira error: con datos raros devuelven null o una lista vacía, o ignoran lo que no pueden leer.
import {
  esFechaIso, diasEntre, diasHabilesTranscurridos, sumarDias, proximoDiaHabil, formatoCorto, VENTANA_DIAS
} from './notasDigitalesCalendario.js';
import {
  REGISTRO_DESDE, FALTABAN, diaDe, momentoDe, segundosDe, ciclosDe, cicloDelAviso, notasDgmitPorCiclo, esEmailADgmit, esNotaEnviada,
  momentoDeEnvioDeNota, numeroDeNota, unirAlta
} from './seguimientoReglas.js';
import { estadoDelDataset, tasaDeActualizacion, cumplimientoPorArea } from './fechasDatasetReglas.js';
import { normalizarRequiereNota, requiereNotaResultante } from './requiereNotaReglas.js';
import { ORIGENES_DATOS, textoOrigen } from './registroReglas.js';
import { TEXTO_TIPO_NOTA_DGMIT } from './notasDgmitReglas.js';

// Los selectores de la página (spec, 1.7): el primero de cada uno es el de entrada
export const ESTADISTICOS = Object.freeze(['mediana', 'promedio']);
export const DIAS = Object.freeze(['habiles', 'corridos']);
// La gestión del circuito y de su cinta (spec, 2.2)
export const GESTIONES = Object.freeze(['externa', 'interna']);

// Cuántos días corridos antes del vencimiento sale el aviso de la regla: 40 en externa y 60 en interna (spec, 1.2). Es la ventana de
// las Notas Digitales, VENTANA_DIAS del calendario (Ruling 30: una sola fuente, congelada)
export const VENTANA_DE_LA_REGLA = VENTANA_DIAS;

// Desde cuándo hay registro de los envíos (el primer email registrado es del 06/12/2025): un aviso de la regla que tocaba antes no
// se pudo registrar
export const INICIO_DEL_REGISTRO = REGISTRO_DESDE.envios;

// El primer año de las métricas (spec, 1.6): el selector empieza en 2026 y no hay foto de un año anterior (lo de diciembre de 2025
// cuenta si terminó en 2026)
export const PRIMER_ANIO = 2026;

// Los emails viejos que eran el aviso de la regla (los demás de QUE_PEDIA también son avisos a la DGMIT, pero no el de la regla)
const EMAILS_DE_LA_REGLA = Object.freeze(['externo-40', 'interno-60']);

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Los textos que arma el servidor para la página (Ruling 19: la página los imprime): los meses cortos del eje, una fecha sin ceros a la
// izquierda (la spec dice «Al 1/1/2026 eran 20»), el porcentaje de un medidor (null sin total) y un singular o un plural
const MESES_CORTOS = Object.freeze(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);
const fechaSinCeros = (dia) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}/${dia.slice(0, 4)}`;
const porcentajeDe = (parte, total) => (total > 0 ? Math.round((parte * 100) / total) : null);
const enNumero = (n, singular, plural) => (n === 1 ? singular : plural);

// Lo destildado, en palabras (spec 1.5: la franja de la pestaña y la píldora del PDF de Métricas llevan la misma leyenda; revisión
// final, B-6): «sin 1 dataset: Parque Automotor», «sin 2 datasets: Parque Automotor, Pauta Publicitaria»; sin títulos, ''. `titulos`:
// los de los destildados que existen, en el orden pedido (sin_titulos de GET /api/metricas). La franja dice «Calculado sin …»
// (textoDeLaFranja) y la píldora, «Mediana en días hábiles · calculado sin …» (textoDeLaPildora, services/reportesMetricasPdf.js)
export const sinLosDestildados = (titulos) => {
  const cuales = lista(titulos).filter((titulo) => typeof titulo === 'string' && titulo !== '');
  if (cuales.length === 0) return '';
  return `sin ${cuales.length === 1 ? '1 dataset' : `${cuales.length} datasets`}: ${cuales.join(', ')}`;
};

// La franja ámbar de la pestaña (sin_texto de GET /api/metricas, que la página imprime tal cual): «Calculado sin 1 dataset: Parque
// Automotor.»; sin destildados, ''
export const textoDeLaFranja = (titulos) => {
  const sin = sinLosDestildados(titulos);
  return sin === '' ? '' : `Calculado ${sin}.`;
};

// ---------------------------------------------------------------------------------------------------------------------
// Días y cifras
// ---------------------------------------------------------------------------------------------------------------------

// Los días de un tramo, de `desde` a `hasta` (días o momentos, que cuentan por su día). `dias`: 'habiles' (los de entrada; también
// cualquier valor que no sea 'corridos'), con diasHabilesTranscurridos, que no cuenta el día de inicio y sí el de fin; o 'corridos',
// con diasEntre. Piso 0: si un hito llegó antes que el anterior, el tramo cuenta 0, nunca negativo (spec, 1.3). Una fecha que no se
// puede leer da null.
export const duracion = (desde, hasta, dias) => {
  const inicio = diaDe(desde);
  const fin = diaDe(hasta);
  if (inicio === null || fin === null) return null;
  return dias === 'corridos' ? Math.max(0, diasEntre(inicio, fin)) : diasHabilesTranscurridos(inicio, fin);
};

// La cifra de un tramo: { n, mediana, promedio }, los dos redondeados. Con un n par, la mediana es el promedio de las dos del medio,
// redondeado (spec, 1.4). Sin valores, los dos null. Lo que no es un número finito no cuenta. No modifica la lista.
export const cifraDe = (valores) => {
  const numeros = lista(valores).filter(Number.isFinite).sort((a, b) => a - b);
  const n = numeros.length;
  if (n === 0) return { n: 0, mediana: null, promedio: null };
  const medio = Math.floor(n / 2);
  const mediana = n % 2 === 1 ? numeros[medio] : (numeros[medio - 1] + numeros[medio]) / 2;
  return { n, mediana: Math.round(mediana), promedio: Math.round(numeros.reduce((suma, valor) => suma + valor, 0) / n) };
};

// La unidad que va al lado de la cifra, en singular solo con 1: 'día hábil', 'días hábiles', 'día corrido' o 'días corridos'.
// `dias` como en duracion (sin él, hábiles).
export const unidadDe = (valor, dias) => {
  const corridos = dias === 'corridos';
  if (valor === 1) return corridos ? 'día corrido' : 'día hábil';
  return corridos ? 'días corridos' : 'días hábiles';
};

// ---------------------------------------------------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------------------------------------------------

// «Requiere nota DGMIT» del dataset de hoy: 1 (Sí), 0 (No) o null (sin dato, y siempre en gestión interna), con las reglas de
// services/requiereNotaReglas.js; un valor que no se puede leer es sin dato. El 0 es un valor.
const requiereNotaDe = (dataset) => {
  try {
    return requiereNotaResultante({ gestion: dataset.tipo_gestion, valor: normalizarRequiereNota(dataset.requiere_nota) });
  } catch {
    return null;
  }
};

// Qué fue un email a la DGMIT, para la lista de casos y «Para completar»: 'email de 40 días' (los que salían a N días del
// vencimiento, FALTABAN) o 'email mensual de vencidos'
const queDelEmail = (tipo) => (Object.hasOwn(FALTABAN, tipo) ? `email de ${FALTABAN[tipo]} días` : 'email mensual de vencidos');

// Qué fue una Nota Digital: 'Nota Digital 4/26' o, si le falta el número o el año (los dos pueden ser NULL en la tabla), 'Nota Digital'
const tieneValor = (valor) => valor !== null && valor !== undefined && valor !== '';
const queDeLaNota = (nota) => (tieneValor(nota.numero) && tieneValor(nota.anio) ? `Nota Digital ${numeroDeNota(nota)}` : 'Nota Digital');

// Los avisos del RPAD a la DGMIT de cada ciclo (una lista por ciclo, en el orden de `ciclos`), cada lista por momento y después por
// id: los emails a la DGMIT que se enviaron y las Notas Digitales de aviso y de reiteración enviadas, con las mismas reglas que el
// Seguimiento (esEmailADgmit, esNotaEnviada y momentoDeEnvioDeNota), y además los emails de la regla que no se pudieron enviar
// (`enviado` false: solo sirven para el motivo 'email-fallido'). Cada uno va al ciclo que dice cicloDelAviso, como en avisosDelCiclo:
// el email, por el momento del envío; la nota, por su vencimiento (y, si hace falta, por cuándo se envió). `regla`: si es de la clase
// del aviso de la regla, el email de 40 o de 60 días o la Nota Digital de aviso en la sección de próximos a vencer. `que`: qué fue
// ('email de 40 días', 'Nota Digital 4/26'); `clase`: 'email' o 'nota'. Lo de después de `hoy` no entra: todavía no pasó (la foto del
// año se calcula al 31/12).
const avisosPorCiclo = (fuentes, ciclos, hoy) => {
  const porCiclo = ciclos.map(() => []);
  const sumar = (momento, vencimiento, aviso) => {
    if (momento === null || momento.slice(0, 10) > hoy) return;
    porCiclo[cicloDelAviso(ciclos, momento, vencimiento)].push({ ...aviso, momento, dia: momento.slice(0, 10) });
  };
  for (const email of lista(fuentes.emails)) {
    const enviado = esEmailADgmit(email);
    const esDeLaRegla = Boolean(email) && typeof email === 'object' && EMAILS_DE_LA_REGLA.includes(email.tipo);
    if (!enviado && !esDeLaRegla) continue;
    sumar(momentoDe(email.enviado), null, { id: Number(email.id) || 0, clase: 'email', enviado, regla: esDeLaRegla, que: queDelEmail(email.tipo) });
  }
  for (const nota of lista(fuentes.notas)) {
    if (!esNotaEnviada(nota)) continue;
    sumar(momentoDeEnvioDeNota(nota), nota.vencimiento ?? null, {
      id: Number(nota.id) || 0, clase: 'nota', enviado: true, regla: nota.tipo === 'aviso' && nota.seccion === 'proximo', que: queDeLaNota(nota)
    });
  }
  for (const avisos of porCiclo) avisos.sort((a, b) => comparar(a.momento, b.momento) || a.id - b.id);
  return porCiclo;
};

// El cambio que cerró un ciclo por actualización o por reprogramación: el 'editar' aprobado cuya aprobación es el `hasta` del ciclo
// (con dos en el mismo segundo, el de id menor). Las actualizaciones simples de diciembre de 2025 no tienen cambio; la baja y el
// ciclo abierto, tampoco.
const cambioQueCerro = (ediciones, ciclo) => {
  if ((ciclo.como !== 'actualizacion' && ciclo.como !== 'reprogramacion') || !ciclo.hasta) return null;
  return ediciones.find((c) => momentoDe(c.revisado) === ciclo.hasta) ?? null;
};

// El día en que sale el aviso de la regla: el de la regla (`fechaRegla`, el vencimiento menos VENTANA_DE_LA_REGLA días corridos) o, si
// no es hábil, el hábil siguiente (proximoDiaHabil: las Notas Digitales salen solo en días hábiles). Es el día de la Agenda de pedidos
// (fechaDeAvisoPorRegla, services/reportesAgenda.js; un test los ata) y del envío (cuenta_desde). null sin fecha de la regla
const diaDelAvisoDe = (fechaRegla) => (esFechaIso(fechaRegla) ? proximoDiaHabil(fechaRegla) : null);

// Si un ciclo ya tenía que haber tenido el aviso de la regla en `al` (revisión final, A-1 y A-2): el día del aviso (`diaDelAviso`) ya
// pasó y el ciclo regía en el RPAD ese día. El día del aviso cuenta recién al siguiente (la corrida de las 8:15 puede no haber salido),
// salvo que el aviso ya exista. Un ciclo que dejó de regir en el RPAD antes (`aprobado`: el día de la aprobación que lo cerró, no el de
// la carga; también la baja) no lo esperaba: su próxima ya no era esa; si dejó de regir ese mismo día, cuenta solo si lo tuvo (pudo
// aprobarse antes de las 8:15). Con el aviso de la regla (`avisoRegla`, también uno anticipado), siempre lo tuvo.
const esperabaElAviso = ({ diaDelAviso, aprobado, avisoRegla }, al) => {
  if (diaDelAviso === null || diaDelAviso > al) return false;
  if (avisoRegla !== null) return true;
  return diaDelAviso < (aprobado !== null && aprobado < al ? aprobado : al);
};

// El motivo por el que un ciclo no tuvo el aviso de la regla, para la lista de la cobertura (spec, 2.2: «se dio de alta con el
// vencimiento ya cerca», «el email no se pudo enviar», «se avisó ya vencido»). En este orden: 'email-fallido' si hubo un email de la
// regla del ciclo que no se pudo enviar; 'alta-cercana' si el dataset se dio de alta después de la fecha de la regla (por día);
// 'ya-vencido' si el primer aviso llegó después del vencimiento; si no, 'sin-aviso'.
const motivoSinAviso = ({ avisos, deLaRegla, fechaRegla, altaDia, primerAviso, venc }) => {
  if (avisos.some((a) => !a.enviado && deLaRegla(a))) return 'email-fallido';
  if (altaDia !== null && altaDia > fechaRegla) return 'alta-cercana';
  if (primerAviso !== null && primerAviso > venc) return 'ya-vencido';
  return 'sin-aviso';
};

// El caso de un ciclo (ver casosDe). `avisos`: los del ciclo (avisosPorCiclo); `notasDgmit`: las suyas (notasDgmitPorCiclo);
// `cerro`: el cambio que lo cerró, o null
const casoDelCiclo = (datos, ciclo, avisos, notasDgmit, cerro, hoy) => {
  const { dataset, gestion, requiereNota, altaDia } = datos;
  const venc = esFechaIso(ciclo.venc) ? ciclo.venc : null;
  const enviados = avisos.filter((a) => a.enviado);
  const avisosRpad = enviados.map((a) => a.dia);
  const primerAviso = avisosRpad[0] ?? null;
  const deLaRegla = (a) => a.regla && venc !== null && a.dia <= venc;
  const avisoRegla = enviados.find(deLaRegla)?.dia ?? null;
  // El aviso que muestran la lista de casos y «Para completar»: el de la regla o, si no lo hubo, el primero
  const avisoQueSeMuestra = enviados.find(deLaRegla) ?? enviados[0] ?? null;
  const fechaRegla = venc === null ? null : sumarDias(venc, -VENTANA_DE_LA_REGLA[gestion]);
  const pudoAvisar = fechaRegla !== null && fechaRegla >= INICIO_DEL_REGISTRO && (altaDia === null || fechaRegla >= altaDia);
  // Avisado ya vencido: el RPAD no pudo avisarlo a tiempo y su primer aviso llegó después del vencimiento (spec, 1.2)
  const heredado = avisoRegla === null && primerAviso !== null && venc !== null && primerAviso > venc && !pudoAvisar;
  const inicioTramos = heredado ? primerAviso : avisoRegla;
  // El motivo, en todo ciclo sin aviso de la regla que ya lo esperaba (esperabaElAviso), se pudiera avisar a tiempo o no (spec, 2.2)
  const esperaba = esperabaElAviso({ diaDelAviso: diaDelAvisoDe(fechaRegla), aprobado: diaDe(ciclo.hasta), avisoRegla }, hoy);
  const motivo = venc !== null && avisoRegla === null && esperaba
    ? motivoSinAviso({ avisos, deLaRegla, fechaRegla, altaDia, primerAviso, venc }) : null;
  // Los datos recibidos y su origen son de la actualización que cerró el ciclo: una reprogramación no recibió nada (spec, 1.2)
  const actualizacion = ciclo.como === 'actualizacion';
  const nuevos = actualizacion && cerro ? objeto(cerro.nuevos) : {};
  const origen = gestion === 'externa' && ORIGENES_DATOS.includes(nuevos.origen_datos) ? nuevos.origen_datos : null;
  const nota = notasDgmit[0] ?? null;
  return {
    dataset_id: dataset.id ?? null, titulo: dataset.titulo ?? null, area: dataset.area ?? null, gestion, requiere_nota: requiereNota,
    activo: dataset.activo !== false, tema: dataset.tema_principal ?? null,
    venc, inicio: ciclo.inicio ?? null, cierre: ciclo.cierre ?? null, como: ciclo.como ?? null, abierto: ciclo.como === null,
    aprobado: ciclo.hasta ?? null,
    aviso_regla: avisoRegla, primer_aviso: primerAviso, heredado, inicio_tramos: inicioTramos, fecha_regla: fechaRegla,
    pudo_avisar: pudoAvisar, motivo_sin_aviso: motivo,
    nota_dgmit: nota ? { numero: nota.numero, tipo: nota.tipo, recibida: nota.recibida } : null,
    reiteraciones_dgmit: notasDgmit.filter((n) => n.tipo === 'reiteracion').length,
    recibido: diaDe(nuevos.recibido_el), origen, carga: actualizacion ? ciclo.cierre ?? null : null, cambio_id: cerro?.id ?? null,
    avisos_rpad: avisosRpad,
    reiteraciones_rpad: inicioTramos === null ? null : avisosRpad.filter((dia) => dia > inicioTramos).length,
    alta: altaDia, aviso_que: avisoQueSeMuestra?.que ?? null, emails_rpad: enviados.filter((a) => a.clase === 'email').map((a) => a.dia)
  };
};

// Los casos de un dataset: uno por ciclo, en el orden de ciclosDe (sin ciclos, ninguno)
const casosDelDataset = (fuentes, hoy) => {
  const dataset = objeto(fuentes).dataset;
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return [];
  const ciclos = ciclosDe(fuentes, hoy);
  if (!Array.isArray(ciclos) || ciclos.length === 0) return [];
  const avisos = avisosPorCiclo(fuentes, ciclos, hoy);
  const notasDgmit = notasDgmitPorCiclo(fuentes, ciclos, hoy);
  const ediciones = lista(fuentes.cambios)
    .filter((c) => c && typeof c === 'object' && c.tipo === 'editar' && c.estado === 'aprobado' && momentoDe(c.revisado) !== null)
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  const datos = {
    dataset, gestion: dataset.tipo_gestion === 'interna' ? 'interna' : 'externa', requiereNota: requiereNotaDe(dataset),
    altaDia: diaDe(dataset.alta)
  };
  return ciclos.map((ciclo, i) => casoDelCiclo(datos, ciclo, avisos[i], notasDgmit[i] ?? [], cambioQueCerro(ediciones, ciclo), hoy));
};

// Un caso por ciclo de cada dataset (spec, 1.2), también los dados de baja (sus ciclos terminan en la baja) y los ciclos con `venc`
// null (los que cerró una actualización simple de diciembre de 2025: no cuentan en nada que necesite el vencimiento); nunca los
// eventuales ni los sin fecha, que no tienen ciclos. `fuentesPorDataset`: el Map<id, Fuentes> de fuentesDe; `hoy`: 'AAAA-MM-DD'. En el
// orden del Map y, en cada dataset, de sus ciclos. Cada caso:
// - del dataset, como está hoy: dataset_id, titulo, area, gestion ('externa' o 'interna'), requiere_nota (1, 0 o null; null en
//   interna), activo y tema (el principal);
// - del ciclo (ciclosDe): venc (null si no se conoce), inicio, cierre, como ('actualizacion', 'reprogramacion', 'baja' o null),
//   abierto (como null) y aprobado (el `hasta` del ciclo: el momento en que dejó de regir en el RPAD);
// - el aviso: aviso_regla (el día del primer aviso de la regla del ciclo con fecha ≤ venc: el email de 40 o 60 días que se envió, o
//   la Nota Digital de aviso en próximos a vencer), primer_aviso (el día del primer aviso del ciclo, de cualquier clase), fecha_regla
//   (venc − 40 o 60 días corridos), pudo_avisar (fecha_regla ≥ INICIO_DEL_REGISTRO y ≥ el día del alta), heredado (avisado ya
//   vencido: sin aviso de la regla, con el primer aviso después del venc y sin poder avisarse a tiempo), inicio_tramos (desde dónde
//   se cuentan los tramos que empiezan en el aviso: el primer aviso si es heredado; si no, el aviso de la regla o null) y
//   motivo_sin_aviso ('email-fallido', 'alta-cercana', 'ya-vencido' o 'sin-aviso': ver motivoSinAviso; en todo ciclo sin aviso de la
//   regla que ya lo esperaba, se pudiera avisar a tiempo o no: el día del aviso, el hábil desde fecha_regla, es anterior a hoy y el ciclo
//   todavía regía en el RPAD ese día, esperabaElAviso; si no, null, también con venc null);
// - la nota DGMIT: nota_dgmit ({ numero, tipo, recibida } de la primera vigente del ciclo, o null) y reiteraciones_dgmit (cuántas
//   del ciclo son reiteraciones);
// - la actualización que lo cerró: recibido (su «Recibido el»), origen ('area' o 'fuente_publica'; null en interna), carga (el
//   «Cargado en el portal»: el cierre de un ciclo cerrado por actualización) y cambio_id (el cambio que lo cerró, también si fue una
//   reprogramación; null si lo cerró una actualización simple, la baja, o si está abierto). Una reprogramación no tiene recibido,
//   origen ni carga;
// - avisos_rpad (los días de los avisos del ciclo a la DGMIT, los mismos que cuenta avisosDelCiclo, de la más vieja a la más
//   nueva) y reiteraciones_rpad (cuántos son de un día posterior a inicio_tramos; null, no 0, si no hay inicio_tramos: un ciclo
//   sin aviso de la regla que no se avisó ya vencido no cuenta en las reiteraciones);
// - para la vista (al final, para no mover las de antes): alta (el día del alta del dataset, o null: distingue «se dio de alta ya
//   vencido» en la cobertura), aviso_que (qué fue el aviso de la regla o, sin él, el primero del ciclo: 'email de 40 días',
//   'email mensual de vencidos', 'Nota Digital 4/26'; null sin avisos) y emails_rpad (los días de los avisos de avisos_rpad que fueron
//   emails a la DGMIT, los que salían hasta el 12/10/2026: para la aclaración de las reiteraciones).
// Con un Map que no es un Map o un `hoy` que no es una fecha, [].
export const casosDe = (fuentesPorDataset, opciones) => {
  const hoy = objeto(opciones).hoy;
  if (!(fuentesPorDataset instanceof Map) || !esFechaIso(hoy)) return [];
  return [...fuentesPorDataset.values()].flatMap((fuentes) => casosDelDataset(fuentes, hoy));
};

// ---------------------------------------------------------------------------------------------------------------------
// La vista: lo que muestra la pestaña Métricas (spec, 1.3 a 1.5, 1.7 y 2.2)
// ---------------------------------------------------------------------------------------------------------------------

// Los tramos del circuito (spec, 1.3), con los nombres neutros que eligió el usuario: el nombre, el texto de la flecha («desde →
// hasta»), quién está a cargo (la insignia) y si es de la DGMIT (va en violeta)
const TRAMOS = Object.freeze({
  aviso: Object.freeze({ nombre: 'Aviso anticipado', desde_hasta: 'Del aviso al vencimiento', responsable: 'DDPC', dgmit: false }),
  tramite: Object.freeze({ nombre: 'Trámite y entrega de la nota', desde_hasta: 'Del aviso a la nota en el área', responsable: 'DGMIT y DA', dgmit: true }),
  respuesta: Object.freeze({ nombre: 'Respuesta del área', desde_hasta: 'De la nota a la entrega', responsable: 'Área', dgmit: false }),
  produccion: Object.freeze({ nombre: 'Producción del relevamiento', desde_hasta: 'Del aviso a la entrega', responsable: 'DGMIT y DIT', dgmit: true }),
  carga: Object.freeze({ nombre: 'Preparación y carga', desde_hasta: 'De la entrega a la carga', responsable: 'DDPC', dgmit: false })
});

// Los tramos de cada gestión, en el orden del circuito
const TRAMOS_DE_LA_GESTION = Object.freeze({
  externa: Object.freeze(['aviso', 'tramite', 'respuesta', 'carga']),
  interna: Object.freeze(['aviso', 'produccion', 'carga'])
});

const NOMBRE_DE_LOS_DIAS = Object.freeze({ habiles: 'días hábiles', corridos: 'días corridos' });

// Mientras no haya ninguna nota DGMIT cargada en el RPAD (spec, 1.4): la DGMIT no tiene cifra («pendiente de carga», sin días) y el
// área todavía no se puede contar. La cinta (services/metricasCinta.js) lo usa para saber por qué se corta la cadena
export const SIN_NOTAS_DGMIT = 'Todavía no hay notas DGMIT cargadas';
const SIN_DATOS_DEL_AREA = Object.freeze({ titulo: 'Sin datos todavía', texto: 'Se empieza a contar cuando haya notas DGMIT cargadas' });

// Por qué un vencimiento no tuvo el aviso de la regla (los motivos de casosDe, en la lista de la cobertura y de los casos)
const MOTIVOS = Object.freeze({
  'email-fallido': 'el email no se pudo enviar',
  'alta-cercana': 'se dio de alta con el vencimiento ya cerca',
  'ya-vencido': 'se avisó ya vencido',
  'sin-aviso': 'sin el aviso de la regla'
});
const ALTA_YA_VENCIDO = 'se dio de alta ya vencido';

// Las opciones de vistaDe, leídas. `anio`: el pedido o, si no sirve, el de `al`; `al`: hoy en el año en curso y el 31/12 en uno
// cerrado (sin `al`, o con uno posterior al año, el 31/12); el estadístico y los días, los de entrada si no son válidos; `sin`: los
// dataset_id destildados. null si no hay año o si `al` es anterior a él.
const contextoDe = (opciones) => {
  const o = objeto(opciones);
  const pedido = typeof o.anio === 'number' || (typeof o.anio === 'string' && /^\d{4}$/.test(o.anio)) ? Number(o.anio) : NaN;
  const anio = Number.isInteger(pedido) && pedido >= 1000 && pedido <= 9999 ? pedido : esFechaIso(o.al) ? Number(o.al.slice(0, 4)) : null;
  if (anio === null) return null;
  const inicio = `${anio}-01-01`;
  const fin = `${anio}-12-31`;
  const al = esFechaIso(o.al) && o.al < fin ? o.al : fin;
  if (al < inicio) return null;
  const sin = Array.isArray(o.sin) || o.sin instanceof Set ? [...o.sin] : [];
  return {
    anio, inicio, fin, al,
    estadistico: ESTADISTICOS.includes(o.estadistico) ? o.estadistico : ESTADISTICOS[0],
    dias: DIAS.includes(o.dias) ? o.dias : DIAS[0],
    sin: new Set(sin.map(Number).filter(Number.isInteger))
  };
};

// Un caso de casosDe, leído para la vista: lo que no se puede leer no está, y lo que pasó después de `al` todavía no pasó (la foto
// al 31/12 se puede calcular con los casos de enero). `abierto`: si el ciclo estaba abierto en `al` (sigue abierto, o se cerró
// después); `aplicaNota`: si le corresponden los tramos de la DGMIT y del área (un externo con «Requiere nota» Sí o sin dato, o uno
// con nota DGMIT); `requiereNota`: si la nota se pide («Requiere nota» Sí o sin dato); `como` y `activo`, los del caso; `diaDelAviso`:
// el día hábil en que sale el aviso de la regla (diaDelAvisoDe); `aprobado`: el día en que el ciclo dejó de regir en el RPAD (o null).
const hechosDe = (caso, ctx) => {
  const yaPaso = (valor) => {
    const dia = diaDe(valor);
    return dia !== null && dia <= ctx.al ? dia : null;
  };
  const externa = caso.gestion !== 'interna';
  const nota = objeto(caso.nota_dgmit);
  const recibida = yaPaso(nota.recibida);
  const inicio = diaDe(caso.inicio);
  const cierre = diaDe(caso.cierre);
  const actualizacion = caso.como === 'actualizacion';
  return {
    caso, id: Number(caso.dataset_id), gestion: externa ? 'externa' : 'interna', externa,
    venc: esFechaIso(caso.venc) ? caso.venc : null,
    fechaRegla: diaDe(caso.fecha_regla),
    diaDelAviso: diaDelAvisoDe(diaDe(caso.fecha_regla)),
    aprobado: diaDe(caso.aprobado),
    avisoRegla: yaPaso(caso.aviso_regla),
    primerAviso: yaPaso(caso.primer_aviso),
    inicioTramos: yaPaso(caso.inicio_tramos),
    heredado: caso.heredado === true,
    avisos: lista(caso.avisos_rpad).map(diaDe).filter((dia) => dia !== null && dia <= ctx.al),
    emails: lista(caso.emails_rpad).map(diaDe).filter((dia) => dia !== null && dia <= ctx.al),
    nota: recibida === null ? null : { numero: nota.numero ?? null, tipo: nota.tipo, recibida },
    recibido: actualizacion ? yaPaso(caso.recibido) : null,
    carga: actualizacion ? yaPaso(caso.carga) : null,
    origen: externa && ORIGENES_DATOS.includes(caso.origen) ? caso.origen : null,
    actualizacion, cierre, como: caso.como ?? null, activo: caso.activo !== false,
    abierto: (inicio === null || inicio <= ctx.al) && (caso.abierto === true || (cierre !== null && cierre > ctx.al)),
    requiereNota: externa && caso.requiere_nota !== 0,
    aplicaNota: externa && (caso.requiere_nota !== 0 || recibida !== null)
  };
};

const enElAnio = (dia, ctx) => dia !== null && dia >= ctx.inicio && dia <= ctx.al;

// Lo que un caso aporta a cada tramo (spec, 1.3 y 1.4), con los días del selector: `terminados`, los días de cada tramo cuyo hito
// final cayó en el año (entre el 1/1 y `al`), y `enCurso`, los que lleva hasta `al` la respuesta o la producción que empezó y no
// terminó en un ciclo abierto a esa fecha, por clave; `pendiente`: un ciclo abierto de un externo con nota requerida, con algún aviso
// y sin nota DGMIT («pendiente de carga», sin días). El aviso anticipado se conoce entero cuando sale el aviso: cuenta en el año de su
// vencimiento, aunque sea posterior a `al`, y nunca está en curso. La preparación y carga tampoco: el sistema recién sabe que llegaron
// los datos cuando se registra la actualización. El piso de 0 es el de duracion. No mira lo destildado.
const medir = (h, ctx) => {
  const terminados = {};
  const enCurso = {};
  const sumar = (destino, clave, desde, hasta) => {
    const valor = duracion(desde, hasta, ctx.dias);
    if (valor !== null) destino[clave] = valor;
  };
  if (h.avisoRegla !== null && h.venc !== null && h.venc >= ctx.inicio && h.venc <= ctx.fin) sumar(terminados, 'aviso', h.avisoRegla, h.venc);
  // Externa: el trámite va del aviso (el de la regla o el primero, si se avisó ya vencido) a la nota DGMIT; la respuesta, de la
  // primera nota del ciclo a la entrega, salvo que los datos salieran de una fuente pública (no fue el área)
  if (h.aplicaNota && h.nota !== null) {
    if (h.inicioTramos !== null && enElAnio(h.nota.recibida, ctx)) sumar(terminados, 'tramite', h.inicioTramos, h.nota.recibida);
    if (h.origen !== 'fuente_publica') {
      if (h.recibido !== null) { if (enElAnio(h.recibido, ctx)) sumar(terminados, 'respuesta', h.nota.recibida, h.recibido); }
      else if (h.abierto) sumar(enCurso, 'respuesta', h.nota.recibida, ctx.al);
    }
  }
  // Interna: la producción del relevamiento va del aviso a la entrega
  if (!h.externa && h.inicioTramos !== null) {
    if (h.recibido !== null) { if (enElAnio(h.recibido, ctx)) sumar(terminados, 'produccion', h.inicioTramos, h.recibido); }
    else if (h.abierto) sumar(enCurso, 'produccion', h.inicioTramos, ctx.al);
  }
  if (h.recibido !== null && enElAnio(h.carga, ctx)) sumar(terminados, 'carga', h.recibido, h.carga);
  return { terminados, enCurso, pendiente: h.requiereNota && h.abierto && h.avisos.length > 0 && h.nota === null };
};

// La lista de casos lleva los ciclos con algún aviso o la carga en el año, y los que cuentan en algún tramo (la lista que hay detrás
// de los números)
const entraEnLaLista = (h, m, ctx) => h.avisos.some((dia) => dia >= ctx.inicio) || enElAnio(h.carga, ctx)
  || Object.keys(m.terminados).length > 0 || Object.keys(m.enCurso).length > 0 || m.pendiente;

// Una nota DGMIT pendiente de carga (spec, 2.2): un externo activo con nota requerida, avisado y sin nota DGMIT, en un ciclo abierto
// o en uno que se cerró en el año, hasta `al`, por una actualización con los datos del área o sin ese dato (uno resuelto con una fuente
// pública puede no haber tenido nota) o por una reprogramación (que no tiene origen: el trámite de la nota cuenta igual, spec 1.2).
// Uno cerrado por la baja, o de un dataset dado de baja, no: la nota DGMIT solo se carga en los datasets activos.
const CIERRES_CON_NOTA = Object.freeze(['actualizacion', 'reprogramacion']);
const notaPendiente = (h, ctx) => h.requiereNota && h.activo && h.nota === null && h.avisos.length > 0
  && (h.abierto || (CIERRES_CON_NOTA.includes(h.como) && enElAnio(h.cierre, ctx) && h.origen !== 'fuente_publica'));

// El aviso que se muestra de un ciclo: el de la regla o, si no lo hubo, el primero ({ dia, que }; sin aviso hasta `al`, null y '')
const avisoMostrado = (h) => {
  const dia = h.caso.aviso_regla != null ? h.avisoRegla : h.primerAviso;
  return { dia, que: dia !== null && typeof h.caso.aviso_que === 'string' ? h.caso.aviso_que : '' };
};

// El motivo de un vencimiento sin el aviso de la regla, en palabras (Ruling 7): uno dado de alta después de su vencimiento «se dio de
// alta ya vencido»; sin motivo, «sin el aviso de la regla»
const textoDelMotivo = (h) => {
  const motivo = h.caso.motivo_sin_aviso;
  const alta = diaDe(h.caso.alta);
  if (motivo === 'alta-cercana' && alta !== null && h.venc !== null && alta > h.venc) return ALTA_YA_VENCIDO;
  return Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo] : MOTIVOS['sin-aviso'];
};

// Por vencimiento (los que no lo tienen, al final), después por título y por dataset
const porVencimiento = (a, b) => comparar(a.venc ?? '9999-12-31', b.venc ?? '9999-12-31')
  || String(a.caso.titulo ?? '').localeCompare(String(b.caso.titulo ?? ''), 'es') || comparar(a.id, b.id);

const cantidadDeCiclos = (n) => (n === 1 ? '1 ciclo' : `${n} ciclos`);

// La cifra de un tramo con lo que se eligió en los selectores (spec, 1.4 y 1.7), o null sin casos. Un 0 es «En el día», sin unidad,
// con «mediana en días hábiles» debajo (la cantidad de ciclos va en el texto de la flecha); si no, la cifra con su unidad y «mediana
// de 32 ciclos». `ciclos`: la cantidad; `ciclos_texto`: la cantidad en palabras («23 ciclos», «1 ciclo»), que la página escribe en
// el texto de la flecha cuando la cifra es «En el día» (`en_el_dia`): la página no compara el valor ni arma el texto; `orientativo`:
// con 4 casos o menos.
const cifraDelTramo = (valores, ctx) => {
  const { n, ...estadisticos } = cifraDe(valores);
  if (n === 0) return null;
  const valor = estadisticos[ctx.estadistico];
  const cero = valor === 0;
  return {
    valor, texto: cero ? 'En el día' : String(valor), unidad: cero ? '' : unidadDe(valor, ctx.dias),
    debajo: cero ? `${ctx.estadistico} en ${NOMBRE_DE_LOS_DIAS[ctx.dias]}` : `${ctx.estadistico} de ${cantidadDeCiclos(n)}`,
    ciclos: n, ciclos_texto: cantidadDeCiclos(n), en_el_dia: cero, orientativo: n <= 4
  };
};

// Los que están en curso (spec, 1.4), con la unidad (con «Días corridos» el número solo no se entiende): «4 sin datos registrados
// todavía, hace 41 días hábiles (mediana)», «… hace 1 día corrido (promedio)»; con 0, «hace menos de 1 día hábil». null sin ninguno
const enCursoDelTramo = (valores, ctx) => {
  const { n, ...estadisticos } = cifraDe(valores);
  if (n === 0) return null;
  const valor = estadisticos[ctx.estadistico];
  const hace = valor === 0 ? `menos de 1 ${unidadDe(1, ctx.dias)}` : `${valor} ${unidadDe(valor, ctx.dias)}`;
  return { n, valor, texto: `${n} sin datos registrados todavía, hace ${hace} (${ctx.estadistico})` };
};

const notasPendientes = (n) => `${n} ${n === 1 ? 'nota pendiente' : 'notas pendientes'} de carga`;

// Un tramo del circuito: su cifra (o, sin ella, por qué está vacío), los que están en curso (la respuesta y la producción) y los
// pendientes de carga (la DGMIT), con su texto para la página (`pendientes_texto`: «3 notas pendientes de carga», «1 nota pendiente
// de carga»; null si no hay ninguno o si el tramo no es el de la DGMIT). `medidas`: las que cuentan (sin los destildados), de su
// gestión
const tramoDelCircuito = (clave, medidas, ctx, hayNotas) => {
  const de = (que) => medidas.map((m) => m[que][clave]).filter((valor) => valor !== undefined);
  const cifra = cifraDelTramo(de('terminados'), ctx);
  const pendientes = clave === 'tramite' ? medidas.filter((m) => m.pendiente).length : null;
  let vacio = null;
  if (!hayNotas && clave === 'tramite') vacio = { titulo: SIN_NOTAS_DGMIT, texto: notasPendientes(pendientes) };
  else if (!hayNotas && clave === 'respuesta') vacio = { ...SIN_DATOS_DEL_AREA };
  else if (cifra === null) vacio = { titulo: `Sin casos en ${ctx.anio}`, texto: '' };
  return {
    clave, ...TRAMOS[clave], cifra, vacio, en_curso: enCursoDelTramo(de('enCurso'), ctx), pendientes,
    pendientes_texto: pendientes > 0 ? notasPendientes(pendientes) : null
  };
};

const textoYaVencidos = (n) => {
  if (n === 0) return '';
  const resto = 'el resto de sus tramos se cuenta desde ese primer aviso.';
  return n === 1
    ? `1 ciclo se avisó cuando ya estaba vencido (venció antes de que existiera el aviso): no cuenta en la anticipación, y ${resto}`
    : `${n} ciclos se avisaron cuando ya estaban vencidos (vencieron antes de que existiera el aviso): no cuentan en la anticipación, y ${resto}`;
};

// Los ciclos de los externos con «Requiere nota DGMIT: No» y sin nota DGMIT (spec, 1.3: la página lo aclara): cuentan solo en la
// anticipación y en la carga
const textoNoRequierenNota = (n) => {
  if (n === 0) return '';
  return n === 1
    ? '1 ciclo es de un dataset que no requiere nota DGMIT: cuenta solo en el aviso anticipado y en la carga.'
    : `${n} ciclos son de datasets que no requieren nota DGMIT: cuentan solo en el aviso anticipado y en la carga.`;
};

const textoFuentePublica = (n) => {
  if (n === 0) return '';
  return n === 1
    ? '1 ciclo se resolvió con datos de una fuente pública: no cuenta en la respuesta del área.'
    : `${n} ciclos se resolvieron con datos de una fuente pública: no cuentan en la respuesta del área.`;
};

// «Los otros 28 se cargaron una mediana de 61 días hábiles después.» (spec, 2.2), o «El otro se cargó …» si es uno; sin ninguno a
// tiempo, «Los 3 se cargaron …» o «Se cargó …». Un 0 (después del vencimiento, sin que pasara un día hábil) es «menos de 1 día hábil».
const textoDeDespues = (n, valor, aTiempo, ctx) => {
  if (n === 0) return '';
  const cuanto = valor === 0 ? `menos de 1 ${unidadDe(1, ctx.dias)}` : `${valor} ${unidadDe(valor, ctx.dias)}`;
  if (n === 1) return `${aTiempo > 0 ? 'El otro se cargó' : 'Se cargó'} ${cuanto} después.`;
  const estadistico = ctx.estadistico === 'promedio' ? 'un promedio' : 'una mediana';
  return `${aTiempo > 0 ? 'Los otros' : 'Los'} ${n} se cargaron ${estadistico} de ${cuanto} después.`;
};

// Los resultados del año, con las dos gestiones juntas (spec, 2.2). `cuentan`: las medidas sin los destildados
const resultadosDe = (cuentan, ctx, hayNotas) => {
  // Actualizados a tiempo: los ciclos cerrados por actualización con la carga en el año y con vencimiento; a tiempo, hasta el día del
  // vencimiento
  const actualizados = cuentan.map((m) => m.h).filter((h) => h.actualizacion && h.venc !== null && enElAnio(h.carga, ctx));
  const aTiempo = (hechos) => hechos.filter((h) => h.carga <= h.venc).length;
  const deLaGestion = (gestion) => {
    const hechos = actualizados.filter((h) => h.gestion === gestion);
    return [aTiempo(hechos), hechos.length];
  };
  const { n: tarde, ...despues } = cifraDe(actualizados.filter((h) => h.carga > h.venc).map((h) => duracion(h.venc, h.carga, ctx.dias)));
  const valor = tarde === 0 ? null : despues[ctx.estadistico];

  // Cobertura (Ruling 5): los vencimientos del año que ya esperaban el aviso de la regla en `al` (esperabaElAviso: su día, el hábil
  // desde la fecha de la regla, ya pasó y el ciclo regía en el RPAD ese día; revisión final, A-1 y A-2), desde que hay registro de los
  // avisos; los cubiertos tuvieron el aviso de la regla antes de vencer
  const vencimientos = cuentan.map((m) => m.h).filter((h) => h.venc !== null && h.venc >= ctx.inicio && h.venc <= ctx.fin
    && h.fechaRegla !== null && h.fechaRegla >= INICIO_DEL_REGISTRO && esperabaElAviso(h, ctx.al));
  const faltan = vencimientos.filter((h) => h.avisoRegla === null).sort(porVencimiento)
    .map((h) => ({ titulo: h.caso.titulo ?? null, venc: h.venc, motivo: textoDelMotivo(h) }));

  // Reiteraciones: las de los ciclos que terminaron en el año y las de los abiertos a `al` (también en la foto al 31/12: los mismos que
  // el circuito muestra en curso), con los avisos hasta `al`. Sin inicio de los tramos (sin aviso de la regla ni avisado ya vencido) no
  // cuentan (Ruling 6)
  const delPeriodo = cuentan.map((m) => m.h).filter((h) => h.abierto || enElAnio(h.cierre, ctx));
  const contadosDelRpad = delPeriodo.filter((h) => h.caso.reiteraciones_rpad !== null && h.inicioTramos !== null);
  const delRpad = contadosDelRpad.map((h) => h.avisos.filter((dia) => dia > h.inicioTramos).length);
  const deLaDgmit = delPeriodo.filter((h) => h.externa && h.nota !== null).map((h) => Number(h.caso.reiteraciones_dgmit) || 0);

  const dgmit = hayNotas ? { ninguna: deLaDgmit.filter((n) => n === 0).length, una_o_mas: deLaDgmit.filter((n) => n > 0).length, total: deLaDgmit.length } : null;
  const cuentas = {
    aTiempo: aTiempo(actualizados), actualizados: actualizados.length, si: vencimientos.length - faltan.length, vencimientos: vencimientos.length,
    // La aclaración de los emails viejos va con una reiteración por email: uno posterior al inicio de los tramos (el de la regla, el de
    // 40 o 60 días, no lo es; revisión final, A-4)
    faltan: faltan.length, rpad: delRpad.length, dgmit, conEmails: contadosDelRpad.some((h) => h.emails.some((dia) => dia > h.inicioTramos))
  };
  return {
    a_tiempo: {
      a_tiempo: cuentas.aTiempo, total: cuentas.actualizados, externa: deLaGestion('externa'), interna: deLaGestion('interna'),
      despues: { valor, texto: textoDeDespues(tarde, valor, cuentas.aTiempo, ctx) }
    },
    cobertura: { si: cuentas.si, total: cuentas.vencimientos, faltan },
    reiteraciones: {
      rpad: {
        ninguna: delRpad.filter((n) => n === 0).length, una: delRpad.filter((n) => n === 1).length,
        dos_o_mas: delRpad.filter((n) => n >= 2).length, total: delRpad.length
      },
      dgmit
    },
    textos: textosDeResultados(cuentas, ctx)
  };
};

// Los textos de los resultados (Ruling 19: la página los imprime): lo que va al lado de la cifra («de 33 ciclos», «de 1 vencimiento»), el
// medidor (el porcentaje; null sin total) y lo de cuando no hay casos; en la cobertura, qué es estar avisado (con los días de la regla) y
// el título de los que faltan («El que falta:», «Los 2 que faltan:»); en las reiteraciones, el título de cada grupo con sus ciclos y, si
// no hay nada que mostrar, por qué (sin notas DGMIT: «Todavía no hay notas DGMIT cargadas.»); `aclaracion`, la de los emails viejos
// (Ruling 21), solo si alguno de los ciclos que cuentan del RPAD a la DGMIT tuvo una reiteración por email, un email a la DGMIT de un
// día posterior al inicio de sus tramos (si no, null)
const textosDeResultados = ({ aTiempo, actualizados, si, vencimientos, faltan, rpad, dgmit, conEmails }, ctx) => ({
  a_tiempo: {
    de: `de ${cantidadDeCiclos(actualizados)}`, medidor: porcentajeDe(aTiempo, actualizados),
    vacio: actualizados === 0 ? `Sin actualizaciones registradas en ${ctx.anio}.` : ''
  },
  cobertura: {
    de: `de ${vencimientos} ${enNumero(vencimientos, 'vencimiento', 'vencimientos')}`, medidor: porcentajeDe(si, vencimientos),
    regla: `El RPAD avisó con la anticipación de la regla (${VENTANA_DE_LA_REGLA.externa} días en externa, ${VENTANA_DE_LA_REGLA.interna} en interna).`,
    faltan: faltan === 0 ? '' : faltan === 1 ? 'El que falta:' : `Los ${faltan} que faltan:`,
    vacio: vencimientos === 0 ? `Sin vencimientos de ${ctx.anio} con la fecha del aviso ya cumplida.` : ''
  },
  reiteraciones: {
    rpad: `Del RPAD a la DGMIT (${cantidadDeCiclos(rpad)})`, rpad_vacio: rpad === 0 ? `Sin ciclos en ${ctx.anio}.` : '',
    dgmit: dgmit === null ? 'De la DGMIT al área' : `De la DGMIT al área (${cantidadDeCiclos(dgmit.total)})`,
    dgmit_vacio: dgmit === null ? `${SIN_NOTAS_DGMIT}.` : dgmit.total === 0 ? `Sin ciclos con nota DGMIT en ${ctx.anio}.` : '',
    aclaracion: conEmails ? ACLARACION_DE_LOS_EMAILS : null
  }
});

// Hasta el 12/10/2026 el RPAD avisaba por email: además del de 40 o 60 días, el de los 5 días y el resumen mensual de vencidos, que
// suman reiteraciones del RPAD a la DGMIT en los ciclos de entonces
const ACLARACION_DE_LOS_EMAILS = 'Hasta el 12/10, el email de los 5 días y el resumen mensual de vencidos se sumaban a cada ciclo.';

const textoDeDias = (valor) => (valor === null ? '' : valor === 0 ? 'en el día' : String(valor));

// Una fila de la lista de casos (spec, 2.2): cada fecha con, debajo, los días del tramo que termina ahí o su estado
const filaDe = (m, ctx) => {
  const { h } = m;
  const dias = (desde, hasta) => duracion(desde, hasta, ctx.dias);
  const aviso = avisoMostrado(h);
  let textoDelAviso = '';
  if (h.heredado && h.inicioTramos !== null) textoDelAviso = 'avisado ya vencido';
  else if (h.avisoRegla !== null && h.venc !== null) {
    const antes = dias(h.avisoRegla, h.venc);
    textoDelAviso = antes === null ? '' : antes === 0 ? 'el día del vencimiento' : `${antes} antes`;
  } else if (h.caso.aviso_regla == null && h.caso.motivo_sin_aviso != null && esperabaElAviso(h, ctx.al)) {
    textoDelAviso = textoDelMotivo(h);
  }
  const nota = h.nota !== null
    ? { numero: h.nota.numero, tipo: TEXTO_TIPO_NOTA_DGMIT[h.nota.tipo] ?? '', texto: h.inicioTramos === null ? '' : textoDeDias(dias(h.inicioTramos, h.nota.recibida)) }
    : { numero: null, tipo: '', texto: notaPendiente(h, ctx) ? 'pendiente de carga' : '' };
  let textoDeRecibido = '';
  if (h.recibido !== null) {
    if (h.aplicaNota && h.nota !== null && h.origen !== 'fuente_publica') textoDeRecibido = textoDeDias(dias(h.nota.recibida, h.recibido));
    else if (!h.externa && h.inicioTramos !== null) textoDeRecibido = textoDeDias(dias(h.inicioTramos, h.recibido));
  } else if (h.abierto) {
    const desde = h.externa && h.nota !== null ? h.nota.recibida : h.inicioTramos;
    const hace = desde === null ? null : dias(desde, ctx.al);
    textoDeRecibido = hace === null || hace === 0 ? 'en curso' : `en curso, hace ${hace}`;
  }
  return {
    dataset_id: h.caso.dataset_id ?? null, titulo: h.caso.titulo ?? null, area: h.caso.area ?? null, gestion: h.gestion,
    contar: m.contar, vencimiento: h.venc,
    aviso: { fecha: aviso.dia, texto: textoDelAviso, que: aviso.que },
    nota,
    recibido: { fecha: h.recibido, texto: textoDeRecibido, origen: h.recibido !== null || h.carga !== null ? textoOrigen(h.origen, '') : '' },
    carga: { fecha: h.carga, texto: h.carga !== null && h.recibido !== null ? textoDeDias(dias(h.recibido, h.carga)) : '' }
  };
};

// «Para completar» (spec, 2.2): lo que falta cargar para que las métricas queden completas. No cambia con lo destildado: no es una
// cuenta. `notas`: las notas DGMIT pendientes de carga (notaPendiente), primero las de los ciclos abiertos y cada grupo por
// vencimiento, con el aviso del RPAD que se muestra (`aviso`, su día, y `que`), en un ciclo cerrado por actualización la carga que
// lo cerró (en uno reprogramado, null) y cómo está el ciclo (`situacion`); `recibido`: las actualizaciones del
// año sin «Recibido el» o, en externa, sin origen, por la fecha de la carga (las simples de diciembre de 2025 no tienen cambio y no se
// pueden completar), con qué les falta (`falta` y `falta_texto`). `total`: las dos juntas; `textos`: el título de cada grupo y, sin
// ninguna, lo que dice la página.
const paraCompletarDe = (medidas, ctx) => {
  const hechos = medidas.map((m) => m.h);
  const notas = hechos.filter((h) => notaPendiente(h, ctx))
    .sort((a, b) => comparar(Number(b.abierto), Number(a.abierto)) || porVencimiento(a, b))
    .map((h) => {
      const aviso = avisoMostrado(h);
      return {
        dataset_id: h.caso.dataset_id ?? null, titulo: h.caso.titulo ?? null, area: h.caso.area ?? null, abierto: h.abierto,
        aviso: aviso.dia, que: aviso.que, carga: h.abierto ? null : h.carga, situacion: situacionDelCiclo(h)
      };
    });
  const recibido = hechos
    .filter((h) => h.actualizacion && h.caso.cambio_id != null && enElAnio(h.carga, ctx)
      && (diaDe(h.caso.recibido) === null || (h.externa && h.origen === null)))
    .sort((a, b) => comparar(a.carga, b.carga) || porVencimiento(a, b))
    .map((h) => {
      const falta = diaDe(h.caso.recibido) === null ? 'recibido' : 'origen';
      return { dataset_id: h.caso.dataset_id ?? null, titulo: h.caso.titulo ?? null, gestion: h.gestion, carga: h.carga, falta, falta_texto: FALTA[falta] };
    });
  const abiertas = notas.filter((n) => n.abierto).length;
  return {
    notas, recibido, total: notas.length + recibido.length,
    textos: {
      notas: textoDeNotasPendientes(abiertas, notas.length - abiertas, ctx.anio),
      notas_vacio: notas.length === 0 ? 'No hay notas DGMIT pendientes de carga.' : '',
      recibido: `Actualizaciones sin «Recibido el» o sin el origen de los datos (${recibido.length})`,
      recibido_vacio: recibido.length === 0 ? 'No hay actualizaciones sin «Recibido el» ni sin el origen de los datos.' : ''
    }
  };
};

// Qué le falta a una actualización de «Para completar»
const FALTA = Object.freeze({ recibido: 'Falta «Recibido el»', origen: 'Falta el origen de los datos' });

// Cómo está el ciclo de una nota DGMIT pendiente de carga: abierto, actualizado (el día de la carga) o reprogramado (el de la
// aprobación)
const situacionDelCiclo = (h) => {
  if (h.abierto) return 'ciclo abierto';
  if (h.carga !== null) return `actualizado el ${formatoCorto(h.carga)}`;
  if (h.como === 'reprogramacion' && h.cierre !== null) return `reprogramado el ${formatoCorto(h.cierre)}`;
  return 'ciclo cerrado';
};

// «Notas DGMIT pendientes de carga (26: 10 de ciclos abiertos y 16 de ciclos cerrados en 2026)»; de un solo grupo, «(10, de ciclos
// abiertos)»; sin ninguna, «(0)»
const textoDeNotasPendientes = (abiertas, cerradas, anio) => {
  const titulo = 'Notas DGMIT pendientes de carga';
  const partes = [
    ...(abiertas > 0 ? [[abiertas, enNumero(abiertas, 'un ciclo abierto', 'ciclos abiertos')]] : []),
    ...(cerradas > 0 ? [[cerradas, `${enNumero(cerradas, 'un ciclo cerrado', 'ciclos cerrados')} en ${anio}`]] : [])
  ];
  const total = abiertas + cerradas;
  if (partes.length === 2) return `${titulo} (${total}: ${partes.map(([n, de]) => `${n} de ${de}`).join(' y ')})`;
  if (partes.length === 1) return `${titulo} (${total}, de ${partes[0][1]})`;
  return `${titulo} (0)`;
};

// Todo lo que muestra la pestaña Métricas de un año, a partir de los casos de casosDe (o los de la foto del año: la misma función).
// `opciones`: { anio, al, estadistico, dias, sin }. `al` es hoy en el año en curso y el 31/12 en uno cerrado: lo que pasó después no
// cuenta. `estadistico` ('mediana' o 'promedio') y `dias` ('habiles' o 'corridos'): los selectores (los de entrada si no son
// válidos). `sin`: los dataset_id destildados, que no cuentan en ningún número (siguen en la lista de casos, con `contar` false, y en
// «Para completar»). Devuelve null si no hay año (ni `anio` ni `al` sirven) o si `al` es anterior a él. Nunca tira.
// Un tramo terminó en el año si su hito final cayó entre el 1/1 y `al`: el vencimiento (el aviso anticipado, que se conoce entero
// cuando sale el aviso, así que cuenta todo el año), la nota DGMIT recibida (el trámite), los datos recibidos (la respuesta y la
// producción) y la carga. Está en curso si empezó y no terminó en un ciclo abierto en `al` (solo la respuesta y la producción).
// - circuito: { externa: Tramo[4] (aviso, tramite, respuesta, carga), interna: Tramo[3] (aviso, produccion, carga), aclaraciones:
//   { externa: { ya_vencidos, fuente_publica, no_requieren_nota }, interna: { ya_vencidos } } }, cada aclaración { n, texto } ('' con
//   0; no_requieren_nota: los ciclos de externos con «Requiere nota» No y sin nota DGMIT). Tramo:
//   { clave, nombre, desde_hasta, responsable, dgmit, cifra, vacio, en_curso, pendientes, pendientes_texto }:
//   - cifra: { valor, texto, unidad, debajo, ciclos, ciclos_texto, en_el_dia, orientativo } (cifraDelTramo) o null; vacio:
//     { titulo, texto } si no hay cifra
//     (sin ninguna nota DGMIT vigente entre todos los casos, también destildados: «Todavía no hay notas DGMIT cargadas» con los
//     pendientes en la DGMIT y «Sin datos todavía» en el área; si no, «Sin casos en 2026»);
//   - en_curso: { n, valor, texto } o null (solo la respuesta y la producción); pendientes: los ciclos «pendientes de carga» (solo la
//     DGMIT; en los demás, null) y pendientes_texto, su texto (null sin ninguno y en los demás tramos).
//   Los tramos de la DGMIT y del área son de los externos con «Requiere nota» Sí o sin dato, o con una nota DGMIT; un ciclo con los
//   datos de una fuente pública no cuenta en la respuesta del área.
// - resultados: { a_tiempo: { a_tiempo, total, externa: [a, t], interna: [a, t], despues: { valor, texto } }, cobertura: { si, total,
//   faltan: [{ titulo, venc, motivo }] }, reiteraciones: { rpad: { ninguna, una, dos_o_mas, total }, dgmit: { ninguna, una_o_mas,
//   total } (null sin notas DGMIT) }, textos }. Las reiteraciones son las de los ciclos que terminaron en el año y las de los abiertos a
//   `al`. textos (textosDeResultados): { a_tiempo: { de, medidor, vacio }, cobertura: { de, medidor, regla, faltan, vacio },
//   reiteraciones: { rpad, rpad_vacio, dgmit, dgmit_vacio, aclaracion } }, lo que la página escribe tal cual.
// - casos: las filas de los ciclos de las dos gestiones (cada una con su `gestion`) con algún aviso o la carga en el año, o que cuentan
//   en algún tramo, por vencimiento: { dataset_id, titulo, area, gestion, contar, vencimiento, aviso: { fecha, texto, que }, nota:
//   { numero, tipo, texto }, recibido: { fecha, texto, origen }, carga: { fecha, texto } }. Los `texto` son lo de debajo de cada fecha:
//   los días del tramo que termina ahí ('27 antes' en el aviso, 'en el día' con 0), o su estado ('avisado ya vencido', el motivo sin
//   el aviso de la regla, 'pendiente de carga', 'en curso, hace 89').
// - para_completar: { notas: [{ dataset_id, titulo, area, abierto, aviso, que, carga, situacion }], recibido: [{ dataset_id, titulo,
//   gestion, carga, falta: 'recibido' | 'origen', falta_texto }], total, textos: { notas, notas_vacio, recibido, recibido_vacio } }
//   (paraCompletarDe; `total`, las dos listas juntas: el «Para completar (N)» del índice de la página).
// Las fechas van como 'AAAA-MM-DD' (o null), y los textos nunca son null.
export const vistaDe = (casos, opciones) => {
  const ctx = contextoDe(opciones);
  if (ctx === null) return null;
  const medidas = lista(casos).filter((caso) => caso && typeof caso === 'object' && !Array.isArray(caso)).map((caso) => {
    const h = hechosDe(caso, ctx);
    const m = { h, ...medir(h, ctx), contar: !ctx.sin.has(h.id) };
    return { ...m, enLista: entraEnLaLista(h, m, ctx) };
  });
  const cuentan = medidas.filter((m) => m.contar);
  const hayNotas = medidas.some((m) => m.h.nota !== null);
  const deLaGestion = (gestion) => cuentan.filter((m) => m.h.gestion === gestion);
  const yaVencidos = (gestion) => deLaGestion(gestion).filter((m) => m.enLista && m.h.heredado && m.h.inicioTramos !== null).length;
  const fuentePublica = deLaGestion('externa')
    .filter((m) => m.enLista && m.h.aplicaNota && m.h.origen === 'fuente_publica' && enElAnio(m.h.carga, ctx)).length;
  // Sin los tramos de la DGMIT y del área: «Requiere nota» No y sin nota DGMIT (con una nota, le corresponden igual)
  const noRequierenNota = deLaGestion('externa').filter((m) => m.enLista && !m.h.aplicaNota).length;
  const circuito = Object.fromEntries(Object.entries(TRAMOS_DE_LA_GESTION).map(([gestion, claves]) =>
    [gestion, claves.map((clave) => tramoDelCircuito(clave, deLaGestion(gestion), ctx, hayNotas))]));
  return {
    circuito: {
      ...circuito,
      aclaraciones: {
        externa: {
          ya_vencidos: { n: yaVencidos('externa'), texto: textoYaVencidos(yaVencidos('externa')) },
          fuente_publica: { n: fuentePublica, texto: textoFuentePublica(fuentePublica) },
          no_requieren_nota: { n: noRequierenNota, texto: textoNoRequierenNota(noRequierenNota) }
        },
        interna: { ya_vencidos: { n: yaVencidos('interna'), texto: textoYaVencidos(yaVencidos('interna')) } }
      }
    },
    resultados: resultadosDe(cuentan, ctx, hayNotas),
    casos: medidas.filter((m) => m.enLista).sort((a, b) => porVencimiento(a.h, b.h)).map((m) => filaDe(m, ctx)),
    para_completar: paraCompletarDe(medidas, ctx)
  };
};

// Los casos que tocan el año (los que guarda la foto del 31/12, spec 3): los que pueden cambiar algo de vistaDe en ese año, leídos
// como los lee ella (lo de después de `al` todavía no pasó). Un ciclo que vence en el año, que está abierto en `al`, que cerró en el
// año o que tiene un aviso, los datos recibidos o la carga en el año; y, además, uno con una nota DGMIT recibida hasta `al`, aunque
// sea de un año anterior: vistaDe mira si hay notas DGMIT entre todos los casos. Así vistaDe da lo mismo con estos casos que con
// todos, con cualquier estadístico, días y destildados. `opciones`: { anio, al } (como en vistaDe). En el orden de `casos`; [] si
// no hay año. Nunca tira.
export const casosQueTocanElAnio = (casos, opciones) => {
  const ctx = contextoDe(opciones);
  if (ctx === null) return [];
  return lista(casos).filter((caso) => {
    if (!caso || typeof caso !== 'object' || Array.isArray(caso)) return false;
    const h = hechosDe(caso, ctx);
    return (h.venc !== null && h.venc >= ctx.inicio && h.venc <= ctx.fin) || h.abierto || enElAnio(h.cierre, ctx)
      || h.avisos.some((dia) => dia >= ctx.inicio) || enElAnio(h.recibido, ctx) || enElAnio(h.carga, ctx) || h.nota !== null;
  });
};

// ---------------------------------------------------------------------------------------------------------------------
// Contexto, el trabajo del RPAD y áreas y temas (spec, 2.2)
// ---------------------------------------------------------------------------------------------------------------------

// Los estados de estadoDelDataset que están al día (actualizados y próximos a vencer: la tasa de la portada) y los vencidos
const AL_DIA = Object.freeze(['actualizado', 'proximo']);
const VENCIDOS = Object.freeze(['atrasado', 'sin-respuesta']);

// Un día no tiene índice si no se sabe el estado (un ciclo con venc null) de más de este porcentaje de los datasets que cuentan
const PORCENTAJE_SIN_ESTADO = 10;

// Los grupos de la antigüedad de los vencidos, en días corridos desde el vencimiento: menos de 90, de 90 a 365 y más de 365
const DIAS_DE_3_MESES = 90;
const DIAS_DE_UN_ANIO = 365;

// La doble verificación se dice en minutos hasta 119 y en horas desde 120
const MINUTOS_PARA_HORAS = 120;

// Un id entero positivo, o null
const idDe = (valor) => {
  const id = Number(valor);
  return valor !== null && valor !== '' && Number.isInteger(id) && id > 0 ? id : null;
};

// Las fuentes de los datasets que cuentan: los del Map de fuentesDe con un dataset, sin los destildados. Un Map que no es un Map, ninguno
const fuentesQueCuentan = (fuentesPorDataset, ctx) => {
  if (!(fuentesPorDataset instanceof Map)) return [];
  return [...fuentesPorDataset.values()].flatMap((fuentes) => {
    const dataset = objeto(fuentes).dataset;
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset) || ctx.sin.has(Number(dataset.id))) return [];
    return [{ fuentes, dataset }];
  });
};

// El momento de la baja de un dataset: la aprobación de la última baja aprobada (la misma que usa ciclosDe), o null
const bajaDe = (fuentes) => lista(fuentes.cambios)
  .filter((c) => c && typeof c === 'object' && c.tipo === 'eliminar' && c.estado === 'aprobado')
  .map((c) => momentoDe(c.revisado)).filter((momento) => momento !== null).sort().at(-1) ?? null;

// Los datasets que cuentan, leídos para saber en qué estado estaban cada día: el dataset, sus ciclos (ciclosDe con `al`; null si es
// eventual o sin fecha, que no tienen), el momento del alta, el de la baja y si está activo hoy
const datasetsDe = (fuentesPorDataset, ctx) => fuentesQueCuentan(fuentesPorDataset, ctx).map(({ fuentes, dataset }) => {
  const ciclos = ciclosDe(fuentes, ctx.al);
  return {
    dataset, ciclos: Array.isArray(ciclos) && ciclos.length > 0 ? ciclos : null, alta: momentoDe(dataset.alta), baja: bajaDe(fuentes),
    activo: dataset.activo !== false
  };
});

// El estado de un dataset al terminar `dia` (a las 23:59:59: lo que pasó ese día ya cuenta, como en la portada de esa noche), o null
// si ese día no contaba: todavía no se había dado de alta, ya se había dado de baja, o está inactivo sin la baja registrada (no se sabe
// desde cuándo). Es el de estadoDelDataset con la próxima que regía en el RPAD: el vencimiento del ciclo que regía en ese momento (de
// la aprobación que lo abrió a la que lo cerró, como en cicloDelAviso). Antes del primer ciclo (un dataset sin alta conocida), el
// primero; después del último (uno que figura activo aunque tenga una baja: se reactivó por fuera del sistema), el último, que vence
// en la próxima de hoy. Sin ciclos, el de la próxima del dataset ('eventual' o 'sin-fecha'). Con un ciclo sin venc (no se sabe qué
// próxima cumplía), { estado: 'desconocido' }. `indice`: el del ciclo (null sin ciclos), para saber qué pasó después.
const estadoEnElDia = (d, dia) => {
  const momento = `${dia} 23:59:59`;
  if (d.alta !== null && d.alta > momento) return null;
  if (!d.activo && (d.baja === null || d.baja <= momento)) return null;
  const datos = { meses: d.dataset.meses, tipoGestion: d.dataset.tipo_gestion, hoy: dia };
  if (d.ciclos === null) return { ...estadoDelDataset({ ...datos, proxima: d.dataset.proxima }), indice: null };
  let indice = d.ciclos.findIndex((ciclo) => ciclo.desde <= momento && (!ciclo.hasta || momento < ciclo.hasta));
  if (indice === -1) indice = momento < d.ciclos[0].desde ? 0 : d.ciclos.length - 1;
  const { venc } = d.ciclos[indice];
  if (venc === null) return { estado: 'desconocido', dias: null, indice };
  return { ...estadoDelDataset({ ...datos, proxima: venc }), indice };
};

// Los días del índice: el primero de cada mes del año hasta `al`, y `al` (una sola vez si es el primero de un mes)
const diasDelIndice = (ctx) => {
  const dias = Array.from({ length: 12 }, (_, i) => `${ctx.anio}-${String(i + 1).padStart(2, '0')}-01`).filter((dia) => dia <= ctx.al);
  return dias.at(-1) === ctx.al ? dias : [...dias, ctx.al];
};

// Los estados que puede tener un dataset un día (estadoEnElDia): los de estadoDelDataset y 'desconocido' (un ciclo con venc null)
const ESTADOS_DEL_DIA = Object.freeze(['actualizado', 'proximo', 'atrasado', 'sin-respuesta', 'sin-fecha', 'eventual', 'desconocido']);

// Cuántos de los datasets que contaban al terminar `dia` estaban en cada estado (los que ese día no contaban no están)
const cuentaDelDia = (datasets, dia) => {
  const cuenta = Object.fromEntries(ESTADOS_DEL_DIA.map((estado) => [estado, 0]));
  for (const d of datasets) {
    const { estado } = estadoEnElDia(d, dia) ?? {};
    if (Object.hasOwn(cuenta, estado)) cuenta[estado] += 1;
  }
  return cuenta;
};

// El índice de una cuenta del día: los al día sobre la base (los que contaban ese día, sin los eventuales; los sin fecha están en la
// base sin estar al día), con la misma cuenta que la portada (tasaDeActualizacion). Los de estado desconocido no están en ninguno de
// los dos: si son más del 10 % de los que contaban, no hay índice ({ tasa, al_dia, base } en null).
const indiceDeLaCuenta = (cuenta) => {
  const alDia = AL_DIA.reduce((suma, estado) => suma + cuenta[estado], 0);
  const base = ESTADOS_DEL_DIA.filter((estado) => estado !== 'eventual' && estado !== 'desconocido')
    .reduce((suma, estado) => suma + cuenta[estado], 0);
  if (cuenta.desconocido * 100 > PORCENTAJE_SIN_ESTADO * (base + cuenta.desconocido)) return { tasa: null, al_dia: null, base: null };
  return { tasa: tasaDeActualizacion({ alDia, total: base, eventuales: 0 }), al_dia: alDia, base };
};

// Un punto del índice: el índice de la cuenta de ese día y sus textos (Ruling 19: la página los imprime). `etiqueta`, la del eje: el mes
// ('ene'), y en el último punto, si no es el primero de un mes, 'hoy' (o '31/12' en un año cerrado). `texto`, el valor en palabras para
// la página (el <title> del punto, la cabeza de la tarjeta y la lista de los valores): «Al 1/3/2026: 82% al día (40 de 49)», «Hoy: …» o
// «Al 31/12/2026: …»; sin tasa, por qué («sin datasets con vencimiento», «sin datos suficientes para calcularlo»)
const puntoDelIndice = (datasets, dia, ctx) => {
  const punto = { dia, ...indiceDeLaCuenta(cuentaDelDia(datasets, dia)) };
  const ultimo = dia === ctx.al;
  const etiqueta = ultimo && !dia.endsWith('-01') ? (dia === ctx.fin ? '31/12' : 'hoy') : MESES_CORTOS[mesDe(dia)];
  const cuando = ultimo ? (ctx.al < ctx.fin ? 'Hoy' : `Al ${formatoCorto(dia)}`) : `Al ${fechaSinCeros(dia)}`;
  let valor = `${punto.tasa}% al día (${punto.al_dia} de ${punto.base})`;
  if (punto.tasa === null) valor = punto.base === null ? 'sin datos suficientes para calcularlo' : 'sin datasets con vencimiento';
  return { ...punto, etiqueta, texto: `${cuando}: ${valor}` };
};

// El índice de actualización mes a mes (spec, 2.2): el mismo de la portada, al día (actualizados y próximos a vencer) sobre el total
// sin los eventuales, reconstruido con los ciclos del Seguimiento. Un punto por el primer día de cada mes del año hasta `al`, y el
// último es `al` (hoy, o el 31/12 en un año cerrado): las próximas son siempre fin de mes y el día del vencimiento todavía está al
// día, así que tomado a fin de mes un vencimiento no se vería en el punto de su mes. Cada día cuenta un dataset si ya existía y seguía
// activo y no es eventual; está al día si el ciclo que regía ese día (en el RPAD, al terminar el día) vence ese día o después; uno sin
// ciclos (sin fecha) está en la base sin estar al día. El punto de hoy da lo mismo que tasaDeActualizacion con los datasets activos y
// su próxima de hoy. `opciones`: { anio, al, sin } (como en vistaDe; los destildados no cuentan). [{ dia, tasa, al_dia, base, etiqueta,
// texto }]: la tasa es un entero (%), o null sin ninguno con vencimiento (con al_dia y base en 0) o si no se sabe el estado de más del
// 10 % de los que cuentan ese día, por ciclos con venc null (con al_dia y base también en null: no se dibuja, en lugar de inventarse);
// etiqueta y texto, los de puntoDelIndice. [] si no hay año. Nunca tira.
export const indiceMesAMes = (fuentesPorDataset, opciones) => {
  const ctx = contextoDe(opciones);
  if (ctx === null) return [];
  const datasets = datasetsDe(fuentesPorDataset, ctx);
  return diasDelIndice(ctx).map((dia) => puntoDelIndice(datasets, dia, ctx));
};

// Cuántos datasets había en cada estado en `al` (spec, 3: lo que guarda la foto del 31/12, las tarjetas del Estado general de ese
// día), con el mismo estado y los mismos datasets que el índice (los que ya existían y seguían activos, sin los destildados):
// { dia, total, actualizado, proximo, atrasado, sin_respuesta, sin_fecha, eventual, desconocido, vencidos, al_dia, tasa }. `total`:
// todos los que contaban (los siete estados suman el total); `desconocido`: los de un ciclo con venc null (no se sabe qué próxima
// regía); `vencidos`: atrasados y sin respuesta; `al_dia` y `tasa`: los del punto del índice de ese día (la tasa de la portada;
// null, con al_dia null, si no se sabe el estado de más del 10 %, y null sin ninguno con vencimiento). `opciones`: { anio, al, sin }
// (como en vistaDe). null si no hay año. Nunca tira.
export const estadosAl = (fuentesPorDataset, opciones) => {
  const ctx = contextoDe(opciones);
  if (ctx === null) return null;
  const cuenta = cuentaDelDia(datasetsDe(fuentesPorDataset, ctx), ctx.al);
  const { tasa, al_dia: alDia } = indiceDeLaCuenta(cuenta);
  return {
    dia: ctx.al, total: ESTADOS_DEL_DIA.reduce((suma, estado) => suma + cuenta[estado], 0),
    actualizado: cuenta.actualizado, proximo: cuenta.proximo, atrasado: cuenta.atrasado, sin_respuesta: cuenta['sin-respuesta'],
    sin_fecha: cuenta['sin-fecha'], eventual: cuenta.eventual, desconocido: cuenta.desconocido,
    vencidos: VENCIDOS.reduce((suma, estado) => suma + cuenta[estado], 0), al_dia: alDia, tasa
  };
};

// ¿Se actualizó desde el ciclo `indice` hasta `al`? Si ese ciclo o alguno de los siguientes cerró por una actualización aprobada
// hasta `al` a las 23:59:59 (una reprogramación no es una actualización). Va con el reloj del RPAD, como el estado (Ruling 12): una
// carga del 30/12 aprobada el 05/01, al 31/12 todavía no se actualizó, igual que en estadoEnElDia
const seActualizo = (ciclos, indice, al) => ciclos.slice(indice)
  .some((ciclo) => ciclo.como === 'actualizacion' && typeof ciclo.hasta === 'string' && ciclo.hasta <= `${al} 23:59:59`);

// La antigüedad de los vencidos (spec, 2.2), con el mismo estado que el índice: los vencidos de `al` (atrasados y sin respuesta; los
// eventuales y los sin fecha no tienen vencimiento), por los días corridos desde el vencimiento: menos de 90, de 90 a 365 y más de
// 365. `al_inicio`: los vencidos al 1/1 del año y, de esos, cuántos se actualizaron hasta `al` (el ciclo que regía el 1/1, o uno
// siguiente, cerró por una actualización aprobada hasta `al`). `textos` (textosDeAntiguedad): lo que dice la página. `opciones`:
// { anio, al, sin }. { total, menos_de_3_meses, de_3_a_12, mas_de_un_anio, al_inicio: { total, actualizados }, textos: { titulo,
// inicio } }, todo en 0 (y los textos vacíos) si no hay año. Nunca tira.
export const antiguedadDeVencidos = (fuentesPorDataset, opciones) => {
  const resultado = {
    total: 0, menos_de_3_meses: 0, de_3_a_12: 0, mas_de_un_anio: 0, al_inicio: { total: 0, actualizados: 0 }, textos: { titulo: '', inicio: '' }
  };
  const ctx = contextoDe(opciones);
  if (ctx === null) return resultado;
  for (const d of datasetsDe(fuentesPorDataset, ctx)) {
    const hoy = estadoEnElDia(d, ctx.al);
    if (hoy !== null && VENCIDOS.includes(hoy.estado)) {
      const dias = -hoy.dias;
      resultado.total += 1;
      if (dias < DIAS_DE_3_MESES) resultado.menos_de_3_meses += 1;
      else if (dias <= DIAS_DE_UN_ANIO) resultado.de_3_a_12 += 1;
      else resultado.mas_de_un_anio += 1;
    }
    const alInicio = estadoEnElDia(d, ctx.inicio);
    if (alInicio !== null && VENCIDOS.includes(alInicio.estado)) {
      resultado.al_inicio.total += 1;
      if (seActualizo(d.ciclos, alInicio.indice, ctx.al)) resultado.al_inicio.actualizados += 1;
    }
  }
  resultado.textos = textosDeAntiguedad(resultado, ctx);
  return resultado;
};

// Los textos de la antigüedad (Ruling 19: la página los imprime): `titulo`, los vencidos de `al` («Hoy: 12 datasets vencidos», «Hoy: 1
// dataset vencido», «Hoy: ningún dataset vencido»; en un año cerrado, «Al 31/12/2026: …»), e `inicio`, los del 1/1 y cuántos se
// actualizaron («Al 1/1/2026 eran 20: de esos, 11 ya se actualizaron.», «… era 1: ya se actualizó.», «… no había datasets vencidos.»)
const textosDeAntiguedad = ({ total, al_inicio: alInicio }, ctx) => {
  const cuando = ctx.al < ctx.fin ? 'Hoy' : `Al ${formatoCorto(ctx.al)}`;
  const titulo = total === 0 ? `${cuando}: ningún dataset vencido` : `${cuando}: ${total} ${enNumero(total, 'dataset vencido', 'datasets vencidos')}`;
  const al1 = `Al 1/1/${ctx.anio}`;
  const { total: eran, actualizados } = alInicio;
  let inicio = `${al1} no había datasets vencidos.`;
  if (eran === 1) inicio = `${al1} era 1: ${actualizados === 1 ? 'ya se actualizó' : 'todavía no se actualizó'}.`;
  else if (eran > 1 && actualizados === 0) inicio = `${al1} eran ${eran}: todavía no se actualizó ninguno.`;
  else if (eran > 1) inicio = `${al1} eran ${eran}: de esos, ${actualizados} ya ${enNumero(actualizados, 'se actualizó', 'se actualizaron')}.`;
  return { titulo, inicio };
};

// El contexto de la pestaña (spec, 2.2), el de GET /api/metricas y el de la foto del 31/12: { indice (indiceMesAMes), indice_vacio,
// antiguedad (antiguedadDeVencidos), estados (estadosAl) }, con las mismas `opciones` ({ anio, al, sin }). `indice_vacio` (Ruling 19: la
// página lo imprime): «No hay datos para dibujar el índice.» si ningún punto tiene tasa; si no, null. Nunca tira.
export const contextoDelAnio = (fuentesPorDataset, opciones) => {
  const indice = indiceMesAMes(fuentesPorDataset, opciones);
  return {
    indice,
    indice_vacio: indice.some((punto) => punto.tasa !== null) ? null : 'No hay datos para dibujar el índice.',
    antiguedad: antiguedadDeVencidos(fuentesPorDataset, opciones),
    estados: estadosAl(fuentesPorDataset, opciones)
  };
};

// Los avisos del RPAD a la DGMIT de un dataset, los mismos que cuenta el Seguimiento: los emails a la DGMIT que se enviaron
// (esEmailADgmit) y las Notas Digitales de aviso y de reiteración enviadas (esNotaEnviada; las de prueba, fuentesDe no las trae), con
// una clave por aviso (un email y una nota pueden tener el mismo id: son dos avisos) y el día del envío. Uno sin id no se puede contar
// una sola vez: no va.
const avisosDelDataset = (fuentes) => [
  ...lista(fuentes.emails).filter(esEmailADgmit).map((e) => ({ que: 'email', id: idDe(e.id), dia: diaDe(momentoDe(e.enviado)) })),
  ...lista(fuentes.notas).filter(esNotaEnviada).map((n) => ({ que: 'nota', id: idDe(n.id), dia: diaDe(momentoDeEnvioDeNota(n)) }))
].filter((aviso) => aviso.id !== null && aviso.dia !== null).map(({ que, id, dia }) => ({ clave: `${que} ${id}`, dia }));

// Los cambios revisados (aprobados o rechazados) de un dataset: los suyos y su alta, unida por la hora como en el Seguimiento
// (unirAlta: un 'crear' aprobado queda sin dataset_id). { id, creado, revisado } con los momentos; uno sin id o sin el momento de la
// revisión no va.
const revisadosDelDataset = (fuentes, dataset) => {
  const alta = unirAlta(dataset, lista(fuentes.altasSinDataset));
  return [...lista(fuentes.cambios), ...(alta ? [alta] : [])]
    .filter((c) => c && typeof c === 'object' && (c.estado === 'aprobado' || c.estado === 'rechazado'))
    .map((c) => ({ id: idDe(c.id), creado: momentoDe(c.creado), revisado: momentoDe(c.revisado) }))
    .filter((c) => c.id !== null && c.revisado !== null);
};

// Cuánto tarda la doble verificación, en tiempo corrido: 'mediana de 3 minutos', 'de 1 minuto' o 'de menos de 1 minuto' hasta 119
// minutos, y desde 120, en horas redondeadas: 'promedio de 9 horas'. '' sin valor
const textoDeAuditoria = (minutos, estadistico) => {
  if (minutos === null) return '';
  if (minutos >= MINUTOS_PARA_HORAS) return `${estadistico} de ${Math.round(minutos / 60)} horas`;
  const cuanto = minutos === 0 ? 'menos de 1 minuto' : minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  return `${estadistico} de ${cuanto}`;
};

const doceMeses = () => Array(12).fill(0);
const mesDe = (dia) => Number(dia.slice(5, 7)) - 1;

// Qué es cada total del trabajo del RPAD, en singular (con 1) y en plural, en el orden de las tarjetas (el Informe anual, que compara
// los totales de dos años, nombra cada fila con el plural: services/reportesInformeAnualPdf.js)
export const TOTALES_DEL_TRABAJO = Object.freeze({
  avisos: Object.freeze(['aviso o nota a la DGMIT', 'avisos y notas a la DGMIT']),
  actualizaciones: Object.freeze(['actualización registrada', 'actualizaciones registradas']),
  auditados: Object.freeze(['cambio auditado (doble verificación)', 'cambios auditados (doble verificación)']),
  nuevos: Object.freeze(['dataset nuevo', 'datasets nuevos']),
  fuente_publica: Object.freeze(['pedido resuelto con una fuente pública', 'pedidos resueltos con una fuente pública'])
});
const textosDeTotales = (resultado) => Object.fromEntries(Object.entries(TOTALES_DEL_TRABAJO)
  .map(([clave, [uno, varios]]) => [clave, enNumero(resultado[clave], uno, varios)]));

// La doble verificación en una oración: «Un cambio propuesto se audita en una mediana de 3 minutos (50 cambios).», «… en un promedio de 9
// horas (1 cambio).»; sin cambios, «Sin cambios auditados en 2026.»
const oracionDeAuditoria = ({ texto, n }, ctx) => {
  if (n === 0) return `Sin cambios auditados en ${ctx.anio}.`;
  return `Un cambio propuesto se audita en ${ctx.estadistico === 'promedio' ? 'un' : 'una'} ${texto} (${n} ${enNumero(n, 'cambio', 'cambios')}).`;
};

// El trabajo del RPAD en el año, del 1/1 a `al` (spec, 2.2), con los datasets que cuentan (sin los destildados):
// - avisos: los avisos y las notas a la DGMIT (avisosDelDataset), cada uno una sola vez aunque trate de varios datasets (un email con
//   tres datasets cuenta una vez, y no cuenta si se destildan los tres), por el día del envío;
// - actualizaciones: los casos (casosDe) cerrados por una actualización cargada en el año, por la fecha de la carga;
// - auditados: los cambios revisados en el año (aprobados o rechazados, también las altas), cada uno una sola vez, por la revisión;
// - nuevos: los datasets dados de alta en el año (también los que después se dieron de baja: fueron trabajo del año);
// - fuente_publica: de esas actualizaciones, las resueltas con datos de una fuente pública, sin las de los datasets con «Requiere nota
//   DGMIT: No» (para ellos es lo normal);
// - por_mes: los avisos, las actualizaciones y los auditados de cada mes, de enero a diciembre (12 números; después de `al`, 0);
// - auditoria: cuánto tarda la doble verificación, de la propuesta a la revisión de los cambios auditados, en minutos corridos: { valor
//   (la mediana o el promedio, según `estadistico`, redondeado), texto (textoDeAuditoria), n } ({ null, '', 0 } sin cambios);
// - textos (Ruling 19: la página los imprime): totales (qué es cada total, en singular o en plural: TOTALES_DEL_TRABAJO), meses (los
//   del eje de por_mes, de enero al mes de `al`: 'ene', 'feb'…) y auditoria (oracionDeAuditoria).
// `opciones`: { anio, al, sin, estadistico } (como en vistaDe). Todo en 0 si no hay año (sin meses ni oración). Nunca tira.
export const trabajoDelAnio = (fuentesPorDataset, casos, opciones) => {
  const resultado = {
    avisos: 0, actualizaciones: 0, auditados: 0, nuevos: 0, fuente_publica: 0,
    por_mes: { avisos: doceMeses(), actualizaciones: doceMeses(), auditados: doceMeses() }, auditoria: { valor: null, texto: '', n: 0 }
  };
  const ctx = contextoDe(opciones);
  if (ctx === null) return { ...resultado, textos: { totales: textosDeTotales(resultado), meses: [], auditoria: '' } };
  const avisos = new Map();
  const revisados = new Map();
  for (const { fuentes, dataset } of fuentesQueCuentan(fuentesPorDataset, ctx)) {
    for (const aviso of avisosDelDataset(fuentes)) if (enElAnio(aviso.dia, ctx)) avisos.set(aviso.clave, aviso.dia);
    for (const cambio of revisadosDelDataset(fuentes, dataset)) if (enElAnio(cambio.revisado.slice(0, 10), ctx)) revisados.set(cambio.id, cambio);
    if (enElAnio(diaDe(dataset.alta), ctx)) resultado.nuevos += 1;
  }
  for (const dia of avisos.values()) resultado.por_mes.avisos[mesDe(dia)] += 1;
  for (const { revisado } of revisados.values()) resultado.por_mes.auditados[mesDe(revisado)] += 1;
  resultado.avisos = avisos.size;
  resultado.auditados = revisados.size;

  const actualizaciones = lista(casos).filter((c) => c && typeof c === 'object' && !ctx.sin.has(Number(c.dataset_id))
    && c.como === 'actualizacion' && enElAnio(diaDe(c.carga), ctx));
  for (const c of actualizaciones) resultado.por_mes.actualizaciones[mesDe(diaDe(c.carga))] += 1;
  resultado.actualizaciones = actualizaciones.length;
  resultado.fuente_publica = actualizaciones.filter((c) => c.origen === 'fuente_publica' && c.requiere_nota !== 0).length;

  const minutos = [...revisados.values()].flatMap(({ creado, revisado }) => {
    const desde = segundosDe(creado);
    const hasta = segundosDe(revisado);
    return desde === null || hasta === null ? [] : [Math.max(0, (hasta - desde) / 60)];
  });
  const { n, ...estadisticos } = cifraDe(minutos);
  const valor = n === 0 ? null : estadisticos[ctx.estadistico];
  resultado.auditoria = { valor, texto: textoDeAuditoria(valor, ctx.estadistico), n };
  resultado.textos = {
    totales: textosDeTotales(resultado), meses: MESES_CORTOS.slice(0, mesDe(ctx.al) + 1), auditoria: oracionDeAuditoria(resultado.auditoria, ctx)
  };
  return resultado;
};

// Por cantidad, de mayor a menor, y en un empate por nombre
const porCantidad = (conteo) => [...conteo].sort(([nombreA, a], [nombreB, b]) => b - a || nombreA.localeCompare(nombreB, 'es'));

// Áreas y temas (spec, 2.2: lo que estaba en la pestaña Métricas de Gestión), con los datasets que contaban en `al` (ya dados de alta y
// todavía activos; sin los destildados):
// - ranking: por área, con la regla de la tasa de cumplimiento de Gestión (una sola: cumplimientoPorArea) y con el estado del índice
//   en `al`: total_datasets (todos los del área, también los eventuales), al_dia (actualizados y próximos a vencer) y porcentaje
//   (tasaDeActualizacion: al día sobre el total sin los eventuales; null si el área solo tiene eventuales). De mayor a menor
//   porcentaje, el null al final, y en un empate por nombre. Uno de estado desconocido (un ciclo con venc null) no va;
// - temas y frecuencias: [nombre, cantidad] de los datasets por tema principal y por frecuencia, por cantidad y en un empate por
//   nombre (los que no tienen tema no van);
// - vacios (Ruling 19: la página lo imprime): { temas, frecuencias }, «Sin datasets.» si esa lista está vacía, o null.
// `opciones`: { al, sin } (el año sale de `al`). { ranking: [{ area, total_datasets, al_dia, porcentaje }], temas, frecuencias, vacios },
// con listas vacías si no hay `al`. Nunca tira.
export const areasYTemas = (fuentesPorDataset, opciones) => {
  const resultado = { ranking: [], temas: [], frecuencias: [], vacios: { temas: SIN_DATASETS, frecuencias: SIN_DATASETS } };
  const ctx = contextoDe(opciones);
  if (ctx === null) return resultado;
  const filas = [];
  const temas = new Map();
  const frecuencias = new Map();
  const sumar = (conteo, nombre) => { if (tieneValor(nombre)) conteo.set(String(nombre), (conteo.get(String(nombre)) ?? 0) + 1); };
  for (const d of datasetsDe(fuentesPorDataset, ctx)) {
    const estado = estadoEnElDia(d, ctx.al)?.estado;
    if (estado === undefined) continue;
    sumar(temas, d.dataset.tema_principal);
    sumar(frecuencias, d.dataset.frecuencia);
    // Uno de estado desconocido no va en el ranking; uno sin área, tampoco (cumplimientoPorArea)
    if (estado !== 'desconocido') filas.push({ area: d.dataset.area, estado });
  }
  resultado.ranking = cumplimientoPorArea(filas).ranking;
  resultado.temas = porCantidad(temas);
  resultado.frecuencias = porCantidad(frecuencias);
  resultado.vacios = { temas: resultado.temas.length ? null : SIN_DATASETS, frecuencias: resultado.frecuencias.length ? null : SIN_DATASETS };
  return resultado;
};

const SIN_DATASETS = 'Sin datasets.';
