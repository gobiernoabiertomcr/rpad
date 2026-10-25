// La agenda de pedidos como datos (spec 2026-10-24-metricas-y-reportes, 5, punto 6): qué vence en los próximos 3, 6 o 12 meses, mes
// por mes, con las dos gestiones o una sola, para que la DGMIT y la Dirección Administrativa planifiquen. Un vencimiento por dataset:
// la próxima actual, sin proyectar las siguientes. Los vencidos van aparte, al principio: son los que se siguen pidiendo. Sin los
// eventuales ni los sin fecha. El estado es el de estadoDelDataset, el mismo de todo el sitio (el día del vencimiento todavía es un
// próximo). Cada fila lleva el área, la frecuencia como en las notas (frecuenciaEnNota con el tipo de pedido efectivo), «Requiere nota
// DGMIT» en los externos (textoRequiereNota), los datos que se van a pedir (el pedido de GET /datasets: pedido con hoy y el tipo
// efectivo; en un vencido, el de R7, como la reiteración) y el día aproximado del aviso del RPAD según la regla
// (fechaDeAvisoPorRegla; en un vencido, null: el de la regla ya pasó y lo que sigue es la reiteración, Ruling 27).
// Lo usan el controlador (controllers/reportesController.js, GET /api/reportes/agenda) y el PDF (services/reportesAgendaPdf.js). Puro:
// sin base de datos ni Date local (las fechas son 'AAAA-MM-DD' y hoy llega por parámetro), y solo importa módulos puros; ninguna
// función tira. VENTANA_DIAS es la del calendario (Ruling 30), la misma con que las Notas Digitales mandan el aviso: así la agenda dice
// el día que usa el envío.
import { esFechaIso, sumarDias, proximoDiaHabil, VENTANA_DIAS } from './notasDigitalesCalendario.js';
import { estadoDelDataset, pedido, tipoEfectivo, frecuenciaEnNota, sumarMeses, vencimientoDelMes } from './fechasDatasetReglas.js';
import { textoRequiereNota } from './requiereNotaReglas.js';

// Cuántos meses puede mirar la agenda (el primero, el de hoy) y cuántos mira si no se pide uno de estos
export const MESES_DE_LA_AGENDA = Object.freeze([3, 6, 12]);
export const MESES_POR_DEFECTO = 6;
// Qué gestiones muestra: las dos, o una sola
export const GESTIONES_DE_LA_AGENDA = Object.freeze(['ambas', 'externa', 'interna']);

const objeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const lista = (valor) => (Array.isArray(valor) ? valor : []);
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const textoDe = (valor) => (typeof valor === 'string' ? valor : '');

// Las opciones de GET /api/reportes/agenda?meses=&gestion= (los parámetros de la URL, los de req.query), leídas con tolerancia: los
// meses, 3, 6 o 12 (un número o su texto); la gestión, 'ambas', 'externa' o 'interna'. Lo demás (también un parámetro repetido, que
// llega como lista) cae a 6 meses y a las dos gestiones.
export const opcionesDeAgenda = (query) => {
  const { meses, gestion } = objeto(query) ? query : {};
  return {
    meses: MESES_DE_LA_AGENDA.find((n) => meses === n || meses === String(n)) ?? MESES_POR_DEFECTO,
    gestion: GESTIONES_DE_LA_AGENDA.includes(gestion) ? gestion : 'ambas'
  };
};

// El día aproximado del aviso del RPAD para un vencimiento según la regla: VENTANA_DIAS días corridos antes (40 en gestión externa y
// 60 en interna) o, si ese día no es hábil, el hábil siguiente (proximoDiaHabil: el mismo día si es hábil), como el día desde el que
// las Notas Digitales cuentan un aviso (cuenta_desde). 'AAAA-MM-DD', o null si el vencimiento no es una fecha o la gestión no es una
// de las dos.
export const fechaDeAvisoPorRegla = (vencimiento, gestion) => {
  if (!esFechaIso(vencimiento) || typeof gestion !== 'string' || !Object.hasOwn(VENTANA_DIAS, gestion)) return null;
  return proximoDiaHabil(sumarDias(vencimiento, -VENTANA_DIAS[gestion]));
};

// Los meses de la agenda ('AAAA-MM'): del de hoy a hoy + meses − 1, contando el actual. [] si hoy no es una fecha.
export const mesesDeLaAgenda = (hoy, meses) => {
  const delMes = vencimientoDelMes(hoy);
  if (delMes === null) return [];
  return Array.from({ length: meses }, (_, i) => sumarMeses(delMes, i)).filter((fin) => fin !== null).map((fin) => fin.slice(0, 7));
};

// Una fila de la agenda: el dataset (`d`, como lo lee el controlador) con lo que se le va a pedir para su vencimiento. `vencido`: si
// es de los vencidos (sin fecha de aviso)
const filaDe = (d, hoy, vencido) => {
  const meses = d.frecuencia_meses ?? null;
  const tipo = tipoEfectivo({ tipo_pedido: d.tipo_pedido, tipo_gestion: d.tipo_gestion, meses });
  const datosAl = esFechaIso(d.datos_al) ? d.datos_al : null;
  return {
    titulo: d.titulo ?? null,
    area: d.area ?? null,
    gestion: d.tipo_gestion ?? null,
    frecuencia: frecuenciaEnNota({ frecuencia: d.frecuencia, tipo, meses }) ?? null,
    // «Requiere nota DGMIT» es de los externos: en un interno, vacío (el 0 es un valor: «No»)
    requiere_nota_texto: d.tipo_gestion === 'externa' ? textoRequiereNota(d.requiere_nota) : '',
    datos_solicitados: pedido({ vencimiento: d.proxima, tipo, datosAl, meses, hoy })?.texto ?? null,
    aviso_aprox: vencido ? null : fechaDeAvisoPorRegla(d.proxima, d.tipo_gestion),
    vencimiento: d.proxima
  };
};

// Por vencimiento, área y título
const porVencimiento = (a, b) => comparar(a.vencimiento, b.vencimiento)
  || textoDe(a.area).localeCompare(textoDe(b.area), 'es') || textoDe(a.titulo).localeCompare(textoDe(b.titulo), 'es');

/**
 * La agenda de `datasets` (los activos, cada uno { titulo, area, tipo_gestion, frecuencia, frecuencia_meses, proxima, datos_al,
 * tipo_pedido, requiere_nota }: el área y la frecuencia por su nombre, los meses de la frecuencia (null es eventual), la próxima actual
 * y «Datos al» como 'AAAA-MM-DD' (o null), el tipo de pedido guardado y «Requiere nota DGMIT», 1, 0 o null). `hoy`: 'AAAA-MM-DD';
 * `meses` y `gestion`, los de opcionesDeAgenda (lo que no sirve, 6 y las dos gestiones).
 * Devuelve { vencidos: Fila[], meses: [{ mes: 'AAAA-MM', filas: Fila[] }] }: los vencidos (atrasados y sin respuesta, según
 * estadoDelDataset) y, de los demás, los que vencen en los meses de la agenda, cada mes con al menos uno (un mes sin vencimientos no
 * va), todos por vencimiento, área y título. Fila = { titulo, area, gestion, frecuencia, requiere_nota_texto, datos_solicitados,
 * aviso_aprox ('AAAA-MM-DD' o null), vencimiento }. Con un hoy que no es una fecha, las dos listas vacías.
 */
export const agendaDe = (datasets, { hoy, meses, gestion } = {}) => {
  if (!esFechaIso(hoy)) return { vencidos: [], meses: [] };
  const opciones = opcionesDeAgenda({ meses, gestion });
  const porMes = new Map(mesesDeLaAgenda(hoy, opciones.meses).map((mes) => [mes, []]));
  const vencidos = [];
  for (const d of lista(datasets).filter(objeto)) {
    if (opciones.gestion !== 'ambas' && d.tipo_gestion !== opciones.gestion) continue;
    const { estado } = estadoDelDataset({ proxima: d.proxima, meses: d.frecuencia_meses ?? null, tipoGestion: d.tipo_gestion, hoy });
    if (estado === 'atrasado' || estado === 'sin-respuesta') vencidos.push(filaDe(d, hoy, true));
    else if (estado === 'actualizado' || estado === 'proximo') porMes.get(d.proxima.slice(0, 7))?.push(filaDe(d, hoy, false));
  }
  return {
    vencidos: vencidos.sort(porVencimiento),
    meses: [...porMes].filter(([, filas]) => filas.length > 0).map(([mes, filas]) => ({ mes, filas: filas.sort(porVencimiento) }))
  };
};
