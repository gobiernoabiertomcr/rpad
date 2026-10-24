// Reglas de las métricas (spec 2026-10-24-metricas-y-reportes, secciones 1.1 a 1.3): cómo se cuentan los días, la cifra de un
// tramo y un caso por ciclo de cada dataset, con sus hitos. Funciones puras, sin base de datos ni Date local: las fechas son strings
// 'AAAA-MM-DD' y los momentos 'AAAA-MM-DD HH:MM:SS' en hora argentina, como en services/seguimientoReglas.js. De ahí se reutilizan los
// ciclos (ciclosDe) y a qué ciclo pertenece cada aviso (cicloDelAviso) y cada nota DGMIT (notasDgmitPorCiclo): las métricas y el
// Seguimiento ubican todo en el mismo ciclo. Las fuentes son las de services/seguimientoDatos.js (fuentesDe). Ninguna función tira
// error: con datos raros devuelven null o una lista vacía, o ignoran lo que no pueden leer.
import { esFechaIso, diasEntre, diasHabilesTranscurridos, sumarDias } from './notasDigitalesCalendario.js';
import { REGISTRO_DESDE, QUE_PEDIA, diaDe, ciclosDe, cicloDelAviso, notasDgmitPorCiclo } from './seguimientoReglas.js';
import { normalizarRequiereNota, requiereNotaResultante } from './requiereNotaReglas.js';
import { ORIGENES_DATOS } from './registroReglas.js';

// Los selectores de la página (spec, 1.7): el primero de cada uno es el de entrada
export const ESTADISTICOS = Object.freeze(['mediana', 'promedio']);
export const DIAS = Object.freeze(['habiles', 'corridos']);

// Cuántos días corridos antes del vencimiento sale el aviso de la regla: 40 en externa y 60 en interna (spec, 1.2)
export const VENTANA_DE_LA_REGLA = Object.freeze({ externa: 40, interna: 60 });

// Desde cuándo hay registro de los envíos (el primer email registrado es del 06/12/2025): un aviso de la regla que tocaba antes no
// se pudo registrar
export const INICIO_DEL_REGISTRO = REGISTRO_DESDE.envios;

// Los emails viejos que eran el aviso de la regla (los demás de QUE_PEDIA también son avisos a la DGMIT, pero no el de la regla)
const EMAILS_DE_LA_REGLA = Object.freeze(['externo-40', 'interno-60']);

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const objeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// 'AAAA-MM-DD HH:MM:SS' o null: la misma lectura que hace seguimientoReglas.js (que no la exporta), para ordenar los avisos y
// pasárselos a cicloDelAviso
const momentoDe = (valor) => {
  if (typeof valor !== 'string') return null;
  const partes = valor.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return partes && esFechaIso(partes[1]) ? `${partes[1]} ${partes[2]}` : null;
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

// Los avisos del RPAD a la DGMIT de cada ciclo (una lista por ciclo, en el orden de `ciclos`), cada lista por momento y después por
// id: los emails a la DGMIT (los de QUE_PEDIA; también los que no se pudieron enviar, con `enviado` false) y las Notas Digitales de
// aviso y de reiteración enviadas. Cada uno va al ciclo que dice cicloDelAviso, como en el Seguimiento (avisosDelCiclo): el email,
// por el momento del envío; la nota, por su vencimiento (y, si hace falta, por cuándo se envió: `enviada`, o el día de la nota a
// las 00:00). `regla`: si es de la clase del aviso de la regla, el email de 40 o de 60 días o la Nota Digital de aviso en la sección
// de próximos a vencer. Lo de después de `hoy` no entra: todavía no pasó (la foto del año se calcula al 31/12).
const avisosPorCiclo = (fuentes, ciclos, hoy) => {
  const porCiclo = ciclos.map(() => []);
  const sumar = (momento, vencimiento, aviso) => {
    if (momento === null || momento.slice(0, 10) > hoy) return;
    porCiclo[cicloDelAviso(ciclos, momento, vencimiento)].push({ ...aviso, momento, dia: momento.slice(0, 10) });
  };
  for (const email of lista(fuentes.emails)) {
    if (!email || typeof email !== 'object' || !Object.hasOwn(QUE_PEDIA, email.tipo)) continue;
    sumar(momentoDe(email.enviado), null, { id: Number(email.id) || 0, enviado: Boolean(email.success), regla: EMAILS_DE_LA_REGLA.includes(email.tipo) });
  }
  for (const nota of lista(fuentes.notas)) {
    if (!nota || typeof nota !== 'object' || (nota.tipo !== 'aviso' && nota.tipo !== 'reiteracion') || nota.estado !== 'enviada') continue;
    const fecha = diaDe(nota.fecha);
    sumar(momentoDe(nota.enviada) ?? (fecha === null ? null : `${fecha} 00:00:00`), nota.vencimiento ?? null,
      { id: Number(nota.id) || 0, enviado: true, regla: nota.tipo === 'aviso' && nota.seccion === 'proximo' });
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

// El motivo por el que no hubo aviso de la regla en un ciclo que se podía avisar a tiempo, si su fecha ya llegó: 'email-fallido' si
// hubo un email de la regla que no se pudo enviar; 'alta-cercana' si el dataset se dio de alta el mismo día de la regla, después de
// las 00:00 (pudo_avisar ya dejó afuera un alta posterior a ese día); si no, 'sin-aviso'.
const motivoSinAviso = (avisos, deLaRegla, fechaRegla, altaMomento) => {
  if (avisos.some((a) => !a.enviado && deLaRegla(a))) return 'email-fallido';
  if (altaMomento !== null && altaMomento > `${fechaRegla} 00:00:00`) return 'alta-cercana';
  return 'sin-aviso';
};

// El caso de un ciclo (ver casosDe). `avisos`: los del ciclo (avisosPorCiclo); `notasDgmit`: las suyas (notasDgmitPorCiclo);
// `cerro`: el cambio que lo cerró, o null
const casoDelCiclo = (datos, ciclo, avisos, notasDgmit, cerro, hoy) => {
  const { dataset, gestion, requiereNota, alta } = datos;
  const venc = esFechaIso(ciclo.venc) ? ciclo.venc : null;
  const enviados = avisos.filter((a) => a.enviado);
  const avisosRpad = enviados.map((a) => a.dia);
  const primerAviso = avisosRpad[0] ?? null;
  const deLaRegla = (a) => a.regla && venc !== null && a.dia <= venc;
  const avisoRegla = enviados.find(deLaRegla)?.dia ?? null;
  const fechaRegla = venc === null ? null : sumarDias(venc, -VENTANA_DE_LA_REGLA[gestion]);
  const pudoAvisar = fechaRegla !== null && fechaRegla >= INICIO_DEL_REGISTRO && (alta.dia === null || fechaRegla >= alta.dia);
  // Avisado ya vencido: el RPAD no pudo avisarlo a tiempo y su primer aviso llegó después del vencimiento (spec, 1.2)
  const heredado = avisoRegla === null && primerAviso !== null && venc !== null && primerAviso > venc && !pudoAvisar;
  const inicioTramos = heredado ? primerAviso : avisoRegla;
  const motivo = pudoAvisar && avisoRegla === null && fechaRegla <= hoy ? motivoSinAviso(avisos, deLaRegla, fechaRegla, alta.momento) : null;
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
    reiteraciones_rpad: inicioTramos === null ? null : avisosRpad.filter((dia) => dia > inicioTramos).length
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
    alta: { dia: diaDe(dataset.alta), momento: momentoDe(dataset.alta) }
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
//   motivo_sin_aviso (ver motivoSinAviso; solo si pudo_avisar, sin aviso de la regla y con fecha_regla ≤ hoy; si no, null);
// - la nota DGMIT: nota_dgmit ({ numero, tipo, recibida } de la primera vigente del ciclo, o null) y reiteraciones_dgmit (cuántas
//   del ciclo son reiteraciones);
// - la actualización que lo cerró: recibido (su «Recibido el»), origen ('area' o 'fuente_publica'; null en interna), carga (el
//   «Cargado en el portal»: el cierre de un ciclo cerrado por actualización) y cambio_id (el cambio que lo cerró, también si fue una
//   reprogramación; null si lo cerró una actualización simple, la baja, o si está abierto). Una reprogramación no tiene recibido,
//   origen ni carga;
// - avisos_rpad (los días de los avisos del ciclo a la DGMIT, los mismos que cuenta avisosDelCiclo, de la más vieja a la más
//   nueva) y reiteraciones_rpad (cuántos son de un día posterior a inicio_tramos; null si no hay inicio_tramos).
// Con un Map que no es un Map o un `hoy` que no es una fecha, [].
export const casosDe = (fuentesPorDataset, opciones) => {
  const hoy = objeto(opciones).hoy;
  if (!(fuentesPorDataset instanceof Map) || !esFechaIso(hoy)) return [];
  return [...fuentesPorDataset.values()].flatMap((fuentes) => casosDelDataset(fuentes, hoy));
};
