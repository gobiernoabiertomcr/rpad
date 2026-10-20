// La cinta del Seguimiento del dataset como datos (spec 2026-10-20-seguimiento-dataset-design, "La cinta"): lo que después dibujan
// la pantalla (SVG) y el PDF (PDFKit) con los mismos números. Función pura, sin base de datos ni Date local para "hoy": las fechas
// son strings 'AAAA-MM-DD' y los días se cuentan con Date.UTC. Las coordenadas están en un espacio de 1000 de ancho, con la línea
// útil de x = 30 a x = 970. No dibuja nada: ni el hueco de 1,5 entre un ciclo y el siguiente ni el tamaño de los íconos están
// acá (los pone quien dibuja); los tramos van con las x exactas de sus fechas. Ninguna función tira error: con datos raros
// ignora lo que no puede leer.
import { esFechaIso, formatoCorto } from './notasDigitalesCalendario.js';

const DIA_EN_MS = 86400000;
const X_INICIAL = 30;
const X_FINAL = 970;
const ANCHO_UTIL = X_FINAL - X_INICIAL;
// Cada marca de la banda ocupa 11 a cada lado: el texto no la pisa
const MEDIA_MARCA = 11;
// Lo que se suma al ancho de las letras para dejar aire a los lados de un texto
const AIRE_DEL_TEXTO = 10;
// "Todavía no estaba en el RPAD" solo si el tramo anterior al alta mide más que esto
const LARGO_PARA_TEXTO_ANTES = 260;
// Si un vencimiento queda a menos de esto de "hoy", sus etiquetas chocan y "hoy" baja un renglón
const DISTANCIA_QUE_CHOCA = 62;
// Un tramo más corto que esto no se ve: no se informa
const LARGO_MINIMO_DEL_TRAMO = 0.2;
// Pantalla: marcas a menos de 11 se juntan y las letras miden 6,6. El PDF usa 12 y 8,4 (opciones de cintaDe)
const SEPARACION_POR_DEFECTO = 11;
const LETRA_POR_DEFECTO = 6.6;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// En qué fila va cada tipo de marca. Quedan afuera 'auditoria' y 'baja' (la baja corta la banda, no es una marca)
const FILA_DEL_TIPO = Object.freeze({
  nota: 'arriba', email: 'arriba',
  alta: 'banda', act: 'banda', actp: 'banda', cambio: 'banda', cambiop: 'banda',
  area: 'abajo', rech: 'abajo'
});
const FILAS = ['arriba', 'banda', 'abajo'];

// Qué marca se dibuja cuando varias se juntan: la primera de esta lista
const PRIORIDAD = ['nota', 'email', 'act', 'actp', 'cambio', 'cambiop', 'alta', 'rech', 'area'];

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const numeroPositivo = (valor, porDefecto) => (Number.isFinite(valor) && valor > 0 ? valor : porDefecto);
const esMeses = (meses) => Number.isInteger(meses) && meses > 0;

// El número de un día (días desde 1970): 'AAAA-MM-DD' → número, sin Date local
const numeroDeDia = (dia) => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) / DIA_EN_MS;

// 'AAAA-MM-DD' de un día o de un momento 'AAAA-MM-DD HH:MM:SS', o null si no es un día que existe
const diaDeTexto = (valor) => {
  if (typeof valor !== 'string') return null;
  const dia = valor.slice(0, 10);
  return esFechaIso(dia) ? dia : null;
};

const dosCifras = (n) => String(n).padStart(2, '0');

// La ventana de la cinta: los 12 meses que terminan en el mes de hoy, del primer día del mes de hace 11 meses al último día del
// mes actual. { desde, hasta, meses: [{ desde, etiqueta, anio }] }; null si `hoy` no es un día que existe.
export const ventanaDe = (hoy) => {
  if (!esFechaIso(hoy)) return null;
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const meses = Array.from({ length: 12 }, (_, k) => {
    // El mes como índice año × 12 + mes (de 0 a 11): restar meses no pasa por setMonth
    const indice = anio * 12 + (mes - 1) - 11 + k;
    const anioDelMes = Math.floor(indice / 12);
    const mesDelAnio = indice % 12;
    return { desde: `${String(anioDelMes).padStart(4, '0')}-${dosCifras(mesDelAnio + 1)}-01`, etiqueta: MESES[mesDelAnio], anio: anioDelMes };
  });
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: meses[0].desde, hasta: `${hoy.slice(0, 7)}-${dosCifras(ultimoDia)}`, meses };
};

// El texto de lo que estuvo vencido un ciclo, o null si no lo estuvo:
// - cerrado: "Estuvo vencido N días";
// - abierto: "Vencido hace N días", o "Vencido desde el dd/mm/aaaa (hace N días)" si el vencimiento es anterior a la ventana.
// `ciclo`: { venc, cierre, diasVencido }; `desdeVentana`: el primer día de la ventana. Con "1 día" en singular.
export const textoDeVencido = (ciclo, desdeVentana) => {
  const dias = ciclo?.diasVencido;
  if (!(dias > 0)) return null;
  const cantidad = `${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (esFechaIso(ciclo.cierre)) return `Estuvo vencido ${cantidad}`;
  return ciclo.venc < desdeVentana ? `Vencido desde el ${formatoCorto(ciclo.venc)} (hace ${cantidad})` : `Vencido hace ${cantidad}`;
};

// "Nota 3/26", o null si la nota no trae número o año
const etiquetaDeNota = (movimiento) => {
  const { numero, anio } = movimiento.extra ?? {};
  if (numero === null || numero === undefined || anio === null || anio === undefined) return null;
  return `Nota ${numero}/${String(anio).slice(-2)}`;
};

// Las marcas que van en la cinta: las notas enviadas, los emails que salieron, y los movimientos de la ficha (no la auditoría, que
// no es de este dataset, ni la baja, que corta la banda).
const vaEnLaCinta = (movimiento) => {
  if (!Object.hasOwn(FILA_DEL_TIPO, movimiento.tipo)) return false;
  if (movimiento.tipo === 'nota') return movimiento.extra?.estado === 'enviada';
  if (movimiento.tipo === 'email' || movimiento.tipo === 'area') return Boolean(movimiento.extra?.success);
  return true;
};

// El centro del hueco libre más grande de [a, b] una vez descontado lo que ocupa cada marca (±MEDIA_MARCA), o null si no hay uno
// de `ancho` o más. Si hay dos iguales, el de la izquierda.
const centroDelHueco = (a, b, ancho, xsDeLasMarcas) => {
  const ocupados = xsDeLasMarcas.map((x) => [x - MEDIA_MARCA, x + MEDIA_MARCA]).sort((p, q) => p[0] - q[0]);
  let mejor = null;
  const probar = (izquierda, derecha) => {
    if (derecha - izquierda >= ancho && (mejor === null || derecha - izquierda > mejor.derecha - mejor.izquierda)) mejor = { izquierda, derecha };
  };
  let libreDesde = a;
  for (const [desde, hasta] of ocupados) {
    probar(libreDesde, Math.min(desde, b));
    libreDesde = Math.max(libreDesde, hasta);
  }
  probar(libreDesde, b);
  return mejor === null ? null : (mejor.izquierda + mejor.derecha) / 2;
};

// Los días de las bajas que hay entre los movimientos, de la más vieja a la más nueva
const diasDeBaja = (movimientos) => lista(movimientos)
  .filter((m) => m && typeof m === 'object' && m.tipo === 'baja' && esFechaIso(m.fecha))
  .map((m) => m.fecha)
  .sort(comparar);

// La cinta de un dataset, con todo lo que hace falta para dibujarla igual en la pantalla y en el PDF:
//   { meses: [{ x0, x1, etiqueta, anio }],                                  // el año, solo en el primero y en enero
//     tramos: [{ x0, x1, tipo: 'antes'|'ciclo'|'vencido'|'futuro'|'eventual' }],
//     textos: [{ x, texto, tipo: 'vencido'|'eventual'|'antes' }],           // x: el centro del texto
//     vencimientos: [{ x, texto: 'vence 31/07' }],
//     marcas: [{ x, fila: 'arriba'|'banda'|'abajo', tipo, cantidad, etiqueta, detalle }],
//     hoy: { x, renglon: 1|2 } }
// `fuentes`: el dataset (`alta`, `meses`, `proxima`); `ciclos`: los de `ciclosDe` (null si no tiene); `movimientos`: los de
// `movimientosDe`; `hoy`: 'AAAA-MM-DD' (hoyArgentina()); `separacion`: a cuánto se juntan las marcas de una misma fila; `letra`:
// cuánto mide una letra, para saber si entra un texto. null si `hoy` no es un día que existe.
export const cintaDe = (opciones) => {
  const { fuentes, ciclos, movimientos, hoy } = opciones ?? {};
  const separacion = numeroPositivo(opciones?.separacion, SEPARACION_POR_DEFECTO);
  const letra = numeroPositivo(opciones?.letra, LETRA_POR_DEFECTO);
  const ventana = ventanaDe(hoy);
  if (!ventana) return null;

  const inicio = numeroDeDia(ventana.desde);
  const dias = numeroDeDia(ventana.hasta) - inicio + 1;
  // El borde izquierdo del número de día `n` (sin el medio día)
  const xDeBorde = (n) => X_INICIAL + ((n - inicio) / dias) * ANCHO_UTIL;
  // El centro del día: x = 30 + (n(día) + 0,5 − n(inicio)) / días de la ventana × 940
  const xDe = (dia) => xDeBorde(numeroDeDia(dia) + 0.5);
  const recorte = (x) => Math.max(X_INICIAL, Math.min(X_FINAL, x));
  const enLaVentana = (dia) => numeroDeDia(dia) >= inicio && numeroDeDia(dia) < inicio + dias;
  const xHoy = xDe(hoy);

  const meses = ventana.meses.map((mes, i) => ({
    x0: xDeBorde(numeroDeDia(mes.desde)),
    x1: i < ventana.meses.length - 1 ? xDeBorde(numeroDeDia(ventana.meses[i + 1].desde)) : X_FINAL,
    etiqueta: mes.etiqueta,
    anio: i === 0 || mes.desde.slice(5, 7) === '01' ? mes.anio : null
  }));

  // Marcas: por fila, de la más vieja a la más nueva, y las que caen a menos de `separacion` del primero del grupo se juntan
  const eventos = lista(movimientos)
    .filter((m) => m && typeof m === 'object' && esFechaIso(m.fecha) && vaEnLaCinta(m) && enLaVentana(m.fecha))
    .sort((a, b) => comparar(a.fecha, b.fecha) || comparar(String(a.momento ?? ''), String(b.momento ?? '')));
  const marcas = FILAS.flatMap((fila) => {
    const grupos = [];
    for (const evento of eventos.filter((m) => FILA_DEL_TIPO[m.tipo] === fila)) {
      const x = xDe(evento.fecha);
      const grupo = grupos[grupos.length - 1];
      if (grupo && x - grupo.x0 < separacion) { grupo.items.push(evento); grupo.x1 = x; } else grupos.push({ x0: x, x1: x, items: [evento] });
    }
    return grupos.map((grupo) => {
      const tipo = grupo.items.map((m) => m.tipo).sort((a, b) => PRIORIDAD.indexOf(a) - PRIORIDAD.indexOf(b))[0];
      const etiquetas = grupo.items.filter((m) => m.tipo === 'nota').map(etiquetaDeNota).filter(Boolean);
      return {
        x: (grupo.x0 + grupo.x1) / 2,
        fila,
        tipo,
        cantidad: grupo.items.length,
        etiqueta: etiquetas.length ? etiquetas.join(' y ') : null,
        detalle: grupo.items.map((m) => `${formatoCorto(m.fecha)}: ${String(m.titulo ?? '')}`)
      };
    });
  });
  const xsDeLaBanda = marcas.filter((m) => m.fila === 'banda').map((m) => m.x);

  const tramos = [];
  const agregarTramo = (x0, x1, tipo) => { if (x1 - x0 > LARGO_MINIMO_DEL_TRAMO) tramos.push({ x0, x1, tipo }); };
  const textos = [];
  // El texto va en el hueco libre más grande de la banda dentro de [x0, x1]; si no entra, no va
  const agregarTexto = (x0, x1, texto, tipo) => {
    const x = centroDelHueco(x0, x1, texto.length * letra + AIRE_DEL_TEXTO, xsDeLaBanda);
    if (x !== null) textos.push({ x, texto, tipo });
  };

  const dataset = fuentes?.dataset && typeof fuentes.dataset === 'object' ? fuentes.dataset : {};
  const alta = diaDeTexto(dataset.alta);
  const altaEnLaVentana = alta !== null && enLaVentana(alta);
  if (altaEnLaVentana) {
    const xAlta = xDe(alta);
    agregarTramo(X_INICIAL, xAlta, 'antes');
    if (xAlta - X_INICIAL > LARGO_PARA_TEXTO_ANTES) textos.push({ x: (X_INICIAL + xAlta) / 2, texto: 'Todavía no estaba en el RPAD', tipo: 'antes' });
  }

  const vencimientos = [];
  const ciclosValidos = lista(ciclos).filter((c) => c && typeof c === 'object' && esFechaIso(c.inicio) && esFechaIso(c.venc));
  if (ciclosValidos.length === 0) {
    // Sin ciclos (frecuencia eventual, o sin próxima): una banda gris del alta (o del inicio de la ventana) a hoy; si lo dieron de
    // baja, hasta la baja
    const bajas = diasDeBaja(movimientos);
    const fin = bajas.length ? bajas[bajas.length - 1] : hoy;
    const x0 = alta === null ? X_INICIAL : recorte(xDe(alta));
    const x1 = recorte(xDe(fin));
    agregarTramo(x0, x1, 'eventual');
    const tieneMeses = esMeses(dataset.meses);
    const sinProxima = diaDeTexto(dataset.proxima) === null;
    agregarTexto(x0, x1, tieneMeses && sinProxima ? 'Sin fecha de próxima actualización' : 'Frecuencia eventual: sin vencimiento', 'eventual');
  } else {
    const textosDeVencido = [];
    for (const ciclo of ciclosValidos) {
      const cierre = esFechaIso(ciclo.cierre) ? ciclo.cierre : null;
      const fin = cierre ?? hoy;
      const vencidoEnDias = Number.isFinite(ciclo.diasVencido) ? ciclo.diasVencido : Math.max(0, numeroDeDia(fin) - numeroDeDia(ciclo.venc));
      const xInicio = recorte(xDe(ciclo.inicio));
      const xVenc = xDe(ciclo.venc);
      const xFin = recorte(xDe(fin));
      // El ciclo rige hasta que vence o hasta que se cierra, lo que pase primero
      agregarTramo(xInicio, Math.min(recorte(xVenc), xFin), 'ciclo');
      if (vencidoEnDias > 0) {
        const xDesde = Math.max(recorte(xVenc), xInicio);
        agregarTramo(xDesde, xFin, 'vencido');
        const texto = textoDeVencido({ venc: ciclo.venc, cierre, diasVencido: vencidoEnDias }, ventana.desde);
        if (xFin - xDesde > LARGO_MINIMO_DEL_TRAMO && texto !== null) textosDeVencido.push({ x0: xDesde, x1: xFin, texto });
      }
      // En el ciclo abierto, de hoy al vencimiento
      if (cierre === null && numeroDeDia(ciclo.venc) > numeroDeDia(hoy)) agregarTramo(xHoy, recorte(xVenc), 'futuro');
      if (enLaVentana(ciclo.venc) && (cierre === null || cierre >= ciclo.venc)) {
        vencimientos.push({ x: xVenc, texto: `vence ${formatoCorto(ciclo.venc).slice(0, 5)}` });
      }
    }
    for (const { x0, x1, texto } of textosDeVencido) agregarTexto(x0, x1, texto, 'vencido');
  }

  const renglon = vencimientos.some((v) => Math.abs(v.x - xHoy) < DISTANCIA_QUE_CHOCA) ? 2 : 1;
  return { meses, tramos, textos, vencimientos, marcas, hoy: { x: xHoy, renglon } };
};
