// El PDF «Informe anual» (spec 2026-10-24-metricas-y-reportes, 5, Para presentar, punto 2, y 3), en A4 apaisado (spec 2026-11-05-metricas-pdf-apaisado, 6):
// solo para un año con foto, y todo sale de la foto del 31/12 (services/metricasFoto.js), que no se recalcula nunca, con la combinación por defecto
// (mediana en días hábiles; la hoja 1, en días corridos y hábiles) y todos los datasets (una foto no se destilda). Son cinco partes, cada
// una desde una hoja nueva:
// 1. el circuito de cada gestión;
// 2. los resultados del año y «Cómo se cuenta»;
// 3. el contexto (el índice mes a mes y la antigüedad de los vencidos) y el trabajo del RPAD, sin las métricas manuales (no están en la
//    foto: las carga administración y se pueden cambiar después);
// 4. áreas y temas (el ranking y los datasets por tema y por frecuencia, de lo que guarda la foto);
// 5. la comparación con la foto del año anterior (comparacionDe: los números de las dos fotos, con sus textos, y la diferencia), si la hay; y los
//    logros del año, los hitos de Herramientas → Proyectos con fecha en el año, por proyecto (logrosPorProyecto), cada uno con su fecha, su
//    título y su descripción, en dos columnas. El primer año, sin nada con qué comparar, la hoja se llama «Logros del año» y lleva la píldora
//    «Primer año con foto».
// Las partes 1 a 4 son las de Métricas del año: se arman con sus dibujantes (services/reportesMetricasPdf.js), sin copiarlos. El pie dice
// «Informe anual AAAA · Hoja k de N». Dibuja con la base de los reportes (reportesPdfBase.js) lo que le pasa el controlador
// (controllers/reportesController.js, que lee las dos fotos y los hitos). Puro: sin pool (los tests lo llaman sin base).
import { COLOR, IZQUIERDA, HOJA_APAISADA, NORMAL, NEGRITA, ASCENDENTE, ajustar, escribir, filete, renglon } from './notasDigitalesAnexo.js';
import { esFechaIso } from './notasDigitalesCalendario.js';
import { ESTADISTICOS, DIAS, TOTALES_DEL_TRABAJO } from './metricasReglas.js';
import {
  TEXTOS_DE_LA_PESTANA as T, TITULO_DEL_CONTEXTO, dibujarElCircuito, dibujarLosResultados, elementosDelContexto, elementosDelTrabajo, dibujarLasAreas,
  dibujarParte, tituloConDerecha, ponerArribaALaDerecha
} from './reportesMetricasPdf.js';
import {
  nuevoReporte, cerrarReporte, dibujarJuntos, lugarPara, nuevoFlujo, anchoDeColumna, prepararTitulo, prepararPildora, prepararSeccion, prepararParrafo, prepararTabla,
  fechaCorta, ENTRE, esObjeto, objeto, lista, esNumero, texto
} from './reportesPdfBase.js';

// Los textos fijos del Informe. Los hitos sin proyecto («Logros del Área») son los de la pestaña «Logros del área» de Herramientas →
// Proyectos (public/js/proyectos.js). Los datasets de estado desconocido (un ciclo sin el vencimiento guardado: no se sabe qué
// próxima regía) no tienen nombre en la pantalla: su fila de la comparación se llama «Sin dato del vencimiento»
export const TEXTOS_DEL_INFORME = Object.freeze({
  // El del año cerrado: el de la pestaña dice también «el de hoy», que acá no va (spec 2026-11-05-metricas-pdf-apaisado, 6)
  pieDelIndice: 'Es el índice de la portada: al día (actualizados y próximos a vencer) sobre los que tienen vencimiento. Un punto por el primer día de cada mes, y el último, el 31/12.',
  primerAnio: 'Primer año con foto',
  comparacion: (anio) => `Comparación con ${anio - 1}`,
  lasFotos: (anterior, actual) => `Las fotos del ${fechaCorta(anterior)} y del ${fechaCorta(actual)}`,
  alCierre: 'Al 31/12',
  sinDatoDelVencimiento: 'Sin dato del vencimiento',
  diferencia: 'Diferencia',
  queEsLaDiferencia: (anio) => `Diferencia: ${anio} menos ${anio - 1}; en los porcentajes, en puntos.`,
  logros: 'Logros del año',
  deDondeSalenLosLogros: (anio) => `Los hitos de ${anio} cargados en Proyectos`,
  sinProyecto: 'Logros del Área',
  sinHitos: (anio) => `Sin hitos registrados en ${anio}.`
});
const TX = TEXTOS_DEL_INFORME;

// Va en la misma hoja que Métricas del año (spec 2026-11-05-metricas-pdf-apaisado, 4)
const CONTENIDO = HOJA_APAISADA.contenido;

// Letras (en puntos) y medidas de un hito: la columna de la fecha, el aire entre el título y la descripción y la línea fina debajo
// (en el medio del aire hasta lo que sigue). Debajo del nombre de un proyecto, ese aire
const LETRA = { proyecto: 9, fecha: 8, titulo: 8.5, descripcion: 8, deDondeSalen: 7.6 };
const HITO = { fecha: 62, bajoTitulo: 2, linea: ENTRE / 2 };
const BAJO_EL_NOMBRE = 6;
// Lo que va debajo de la píldora del primer año, a la derecha del título: su ancho y su y desde el título
const DE_DONDE_SALEN = { ancho: 240, sobre: 21 };
// El título de un hito va en hasta 3 líneas y su descripción en hasta 35 (si no entra, se corta con "…"): el nombre de su proyecto y el hito
// más alto entran debajo del título de la hoja, y así nunca queda un título solo en su hoja (spec 2026-11-05-metricas-pdf-apaisado, 6)
const LINEAS_DEL_TITULO = 3;
const LINEAS_DE_LA_DESCRIPCION = 35;

// (esObjeto, objeto, lista, esNumero y texto son los de la base de los reportes)
const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// =====================================================
// La comparación con la foto del año anterior
// =====================================================

// La diferencia entre dos números de las fotos, el del año menos el del anterior: «+3», «–2» (Helvetica no tiene el signo menos: una
// raya, como los números de la cinta) o «Igual»; con `puntos` (la de dos porcentajes), «+5 puntos», «–1 punto». Si falta uno, una raya
const diferenciaDe = (anterior, actual, puntos) => {
  if (!esNumero(anterior) || !esNumero(actual)) return '—';
  const d = actual - anterior;
  if (d === 0) return 'Igual';
  const n = Math.abs(d);
  return `${d > 0 ? '+' : '–'}${n}${puntos ? ` ${n === 1 ? 'punto' : 'puntos'}` : ''}`;
};

// Lo que dice cada foto en una fila: { valor (el número que se resta, o null), texto (lo que se escribe) }
// - un resultado del año: sin casos, lo que dice la foto («Sin actualizaciones registradas en 2025.»); si no, la cifra con el texto de
//   la foto al lado y el porcentaje de su medidor: «5 de 33 ciclos (15%)»;
const delResultado = (clave, cantidad) => (foto) => {
  const resultados = objeto(objeto(foto.vista).resultados);
  const textos = objeto(objeto(resultados.textos)[clave]);
  if (texto(textos.vacio)) return { valor: null, texto: texto(textos.vacio) };
  const n = objeto(resultados[clave])[cantidad];
  if (!esNumero(n)) return { valor: null, texto: '—' };
  const base = [String(n), texto(textos.de)].filter(Boolean).join(' ');
  return { valor: esNumero(textos.medidor) ? textos.medidor : null, texto: esNumero(textos.medidor) ? `${base} (${textos.medidor}%)` : base };
};
// - el índice al 31/12: el último punto del índice mes a mes de la foto, con su texto («Al 31/12/2026: 75% al día (3 de 4)»; sin índice,
//   por qué: «Al 31/12/2025: sin datasets con vencimiento»);
const delIndice = (foto) => {
  const punto = objeto(lista(objeto(foto.contexto).indice).filter(esObjeto).at(-1));
  return { valor: esNumero(punto.tasa) ? punto.tasa : null, texto: texto(punto.texto) || '—' };
};
// - una cuenta de la foto: cuántos había en un estado al 31/12 (contexto.estados) o un total del trabajo del año (trabajo)
const unNumero = (deDonde) => (foto) => {
  const n = deDonde(foto);
  return esNumero(n) ? { valor: n, texto: String(n) } : { valor: null, texto: '—' };
};
const delEstado = (clave) => unNumero((foto) => objeto(objeto(foto.contexto).estados)[clave]);
const delTrabajo = (clave) => unNumero((foto) => objeto(foto.trabajo)[clave]);

// Las tres tablas de la comparación, con sus filas: { rotulo, de (de dónde sale lo de cada foto), puntos (si la diferencia es de dos
// porcentajes), siHay (la fila va solo si alguna de las dos fotos tiene más de 0) }. Los estados al 31/12 son los de estadosAl (las
// tarjetas del Estado general de ese día; los vencidos juntan a los dos estados vencidos) y, con los de estado desconocido, suman los
// datasets en el registro; los totales del trabajo, los de sus tarjetas, nombrados con su plural
const TABLAS_DE_LA_COMPARACION = [
  {
    titulo: T.titulos.resultados,
    filas: [
      { rotulo: T.titulos.aTiempo, de: delResultado('a_tiempo', 'a_tiempo'), puntos: true },
      { rotulo: T.titulos.cobertura, de: delResultado('cobertura', 'si'), puntos: true }
    ]
  },
  {
    titulo: TX.alCierre,
    filas: [
      { rotulo: 'Índice de actualización', de: delIndice, puntos: true }, { rotulo: 'Datasets en el registro', de: delEstado('total') },
      { rotulo: 'Actualizados', de: delEstado('actualizado') }, { rotulo: 'Próximos a vencer', de: delEstado('proximo') },
      { rotulo: 'Vencidos', de: delEstado('vencidos') }, { rotulo: 'Eventuales', de: delEstado('eventual') },
      { rotulo: 'Sin fecha', de: delEstado('sin_fecha') }, { rotulo: TX.sinDatoDelVencimiento, de: delEstado('desconocido'), siHay: true }
    ]
  },
  {
    titulo: T.titulos.trabajo,
    filas: Object.entries(TOTALES_DEL_TRABAJO).map(([clave, [, plural]]) => ({ rotulo: conMayuscula(plural), de: delTrabajo(clave) }))
  }
];

// La comparación de la foto del año (`actual`) con la del anterior (`anterior`), las dos como las lee el Informe (deLaFoto): lo que dice
// cada foto, con sus textos, y la diferencia (solo se resta: no se calcula nada nuevo). Tres tablas, [{ titulo, filas: [[rótulo, lo del
// año anterior, lo del año, la diferencia]] }]: los resultados del año, los estados al 31/12 con el índice y el trabajo del RPAD. Lo que
// una foto no tiene, una raya. Nunca tira.
export const comparacionDe = (anterior, actual) => TABLAS_DE_LA_COMPARACION.map(({ titulo, filas }) => ({
  titulo,
  filas: filas.map(({ rotulo, de, puntos = false, siHay = false }) => {
    const antes = de(objeto(anterior));
    const ahora = de(objeto(actual));
    if (siHay && !(antes.valor > 0) && !(ahora.valor > 0)) return null;
    return [rotulo, antes.texto, ahora.texto, diferenciaDe(antes.valor, ahora.valor, puntos)];
  }).filter(Boolean)
}));

// Los grupos de la comparación (los de dibujarParte): la cabeza de la sección con sus tres tablas (con los dos años en las columnas) y qué es
// la diferencia, que viaja con la última fila de la última tabla (nunca queda sola arriba de una hoja)
const elementosDeLaComparacion = (doc, anterior, actual) => {
  const { anio } = actual;
  const alAnterior = esFechaIso(anterior?.al) ? anterior.al : `${anio - 1}-12-31`;
  const seccion = prepararSeccion(doc, { titulo: TX.comparacion(anio), derecha: TX.lasFotos(alAnterior, actual.al) });
  const tablas = comparacionDe(anterior, actual);
  const [primera, ...resto] = tablas.map(({ titulo, filas }, i) => prepararTabla(doc, {
    columnas: [{ titulo, ancho: 2.7 }, { titulo: String(anio - 1), ancho: 1.75 }, { titulo: String(anio), ancho: 1.75 }, { titulo: TX.diferencia, ancho: 1 }],
    filas,
    aclaracion: i === tablas.length - 1 ? prepararParrafo(doc, TX.queEsLaDiferencia(anio)) : null
  }));
  return [[seccion, primera], ...resto.map((tabla) => [tabla])];
};

// =====================================================
// Los logros del año
// =====================================================

const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);

// Los hitos del año agrupados por proyecto. `hitos`: los de proyecto_hitos con fecha en el año, como los lee el controlador ([{ proyecto_id,
// proyecto (su nombre), fecha: 'AAAA-MM-DD', titulo, descripcion }], los proyectos en el orden de Herramientas → Proyectos). Cada proyecto
// en el orden en que llegan, con sus hitos por fecha (y en el orden en que llegan los del mismo día); los hitos sin proyecto (los logros
// del área), juntos al final. La descripción vacía, o solo con espacios, queda vacía. [{ proyecto, hitos: [{ fecha, titulo, descripcion }]
// }], [] sin hitos. Nunca tira.
export const logrosPorProyecto = (hitos) => {
  const proyectos = new Map();
  const delArea = [];
  for (const h of lista(hitos).filter(esObjeto)) {
    const hito = { fecha: texto(h.fecha), titulo: texto(h.titulo), descripcion: texto(h.descripcion).trim() };
    if (h.proyecto_id === null || h.proyecto_id === undefined) {
      delArea.push(hito);
      continue;
    }
    if (!proyectos.has(h.proyecto_id)) proyectos.set(h.proyecto_id, { proyecto: texto(h.proyecto), hitos: [] });
    proyectos.get(h.proyecto_id).hitos.push(hito);
  }
  const grupos = [...proyectos.values(), ...(delArea.length ? [{ proyecto: TX.sinProyecto, hitos: delArea }] : [])];
  return grupos.map(({ proyecto, hitos: deLaLista }) => ({ proyecto, hitos: [...deLaLista].sort(porFecha) }));
};

// Un hito, del ancho de una columna: la fecha a la izquierda, en el acento, y a su lado el título en negrita y, debajo, la descripción (si
// tiene), con una línea fina debajo. Una pieza del flujo: { alto, dibujar(y, x) }, con el aire de la base medido adentro
const prepararHito = (doc, hito, anchoDeLaColumna) => {
  const ancho = anchoDeLaColumna - HITO.fecha;
  const fecha = ajustar(doc, fechaCorta(hito.fecha), { ancho: HITO.fecha - 8, lineas: 1, max: LETRA.fecha, fuente: NEGRITA });
  const titulo = ajustar(doc, texto(hito.titulo) || '—', { ancho, lineas: LINEAS_DEL_TITULO, max: LETRA.titulo, fuente: NEGRITA });
  const descripcion = texto(hito.descripcion)
    ? ajustar(doc, hito.descripcion, { ancho, lineas: LINEAS_DE_LA_DESCRIPCION, max: LETRA.descripcion, fuente: NORMAL })
    : null;
  // La fecha, en la misma línea de base que la primera línea del título
  const bajarFecha = ASCENDENTE * (LETRA.titulo - LETRA.fecha);
  const alto = Math.max(bajarFecha + fecha.alto, titulo.alto + (descripcion ? HITO.bajoTitulo + descripcion.alto : 0));
  return {
    alto: alto + ENTRE,
    dibujar: (y, x) => {
      escribir(doc, fecha, x, y + bajarFecha, COLOR.acento);
      escribir(doc, titulo, x + HITO.fecha, y, COLOR.tinta);
      if (descripcion) escribir(doc, descripcion, x + HITO.fecha, y + titulo.alto + HITO.bajoTitulo, COLOR.gris);
      filete(doc, x, y + alto + HITO.linea, anchoDeLaColumna);
    }
  };
};

// Los logros desde y, en dos columnas (spec 2026-11-05-metricas-pdf-apaisado, 6): cada proyecto con su nombre en negrita y sus hitos. El nombre viaja con
// el primer hito y, si los hitos de un proyecto siguen en otra columna o en otra hoja, se repite arriba. Con `conCabeza`, la cabeza de la sección, de todo
// el ancho, viaja con el primer proyecto (el primer año no la lleva: repetiría el título de la hoja). Sin hitos, «Sin hitos registrados en AAAA.».
const dibujarLogros = (doc, y, logros, anio, { conCabeza }) => {
  const seccion = conCabeza ? prepararSeccion(doc, { titulo: TX.logros, derecha: TX.deDondeSalenLosLogros(anio) }) : null;
  const grupos = lista(logros).filter((grupo) => esObjeto(grupo) && lista(grupo.hitos).some(esObjeto));
  if (grupos.length === 0) {
    const sinHitos = prepararParrafo(doc, TX.sinHitos(anio), { color: COLOR.tinta });
    dibujarJuntos(doc, y, seccion ? [seccion, sinHitos] : [sinHitos]);
    return;
  }
  const anchoDeLaColumna = anchoDeColumna(doc);
  const piezas = grupos.map((grupo) => {
    const parrafo = prepararParrafo(doc, texto(grupo.proyecto), { ancho: anchoDeLaColumna, tamano: LETRA.proyecto, fuente: NEGRITA, color: COLOR.tinta, lineas: 2 });
    const nombre = { alto: parrafo.alto + BAJO_EL_NOMBRE, dibujar: (yNombre, x) => parrafo.dibujar(yNombre, x) };
    const [primero, ...resto] = grupo.hitos.filter(esObjeto).map((h) => prepararHito(doc, h, anchoDeLaColumna));
    const juntos = {
      alto: nombre.alto + primero.alto,
      dibujar: (yJuntos, x) => {
        nombre.dibujar(yJuntos, x);
        primero.dibujar(yJuntos + nombre.alto, x);
      }
    };
    return { nombre, juntos, resto };
  });
  const yFlujo = seccion ? seccion.dibujar(lugarPara(doc, y, seccion.alto + ENTRE + piezas[0].juntos.alto)) : y;
  const flujo = nuevoFlujo(doc, yFlujo);
  for (const { nombre, juntos, resto } of piezas) {
    flujo.cabeza(nombre);
    flujo.poner(juntos, { sinCabeza: true });
    resto.forEach((hito) => flujo.poner(hito));
  }
};

// =====================================================
// El PDF
// =====================================================

// El Informe anual. `foto`: la del año, como la lee el controlador ({ anio, al, estadistico, dias } y lo de deLaFoto,
// controllers/metricasController.js: vista, contexto, trabajo y áreas; y circuito_en_corridos y circuito_en_habiles; las cintas no van); `anterior`: lo mismo de la foto del año
// anterior, o null (sin foto: «Primer año con foto»); `logros`: los de logrosPorProyecto. `generado`: { momento: 'AAAA-MM-DD HH:MM:SS'
// (hora argentina; su día va en el encabezado), por: nombre corto o null } (el pie).
export const renderInformeAnual = async ({ foto, anterior = null, logros = [] }, { generado }) => {
  const f = objeto(foto);
  const anio = Number.isInteger(f.anio) ? f.anio : Number(texto(f.al).slice(0, 4));
  const al = esFechaIso(f.al) ? f.al : `${anio}-12-31`;
  const estadistico = ESTADISTICOS.includes(f.estadistico) ? f.estadistico : ESTADISTICOS[0];
  // Sin `dias`, los corridos (los de COMBINACION_DEL_INFORME, controllers/reportesController.js), no DIAS[0], que son los hábiles
  const dias = DIAS.includes(f.dias) ? f.dias : 'corridos';
  const nombre = `Informe anual ${anio}`;
  const doc = nuevoReporte({ titulo: `Informe anual del RPAD ${anio}`, hoja: HOJA_APAISADA });
  const hoja = { derecha: nombre, fecha: texto(generado?.momento).slice(0, 10) };
  const titulo = (t) => prepararTitulo(doc, { rotulo: `Informe anual · año ${anio}, al ${fechaCorta(al)}`, titulo: t });
  // Sale de la foto, que no se destilda: la píldora dice «con todos los datasets» y debajo, «Sale de la foto del 31/12/AAAA…»
  const datos = { ...f, anio, al, en_vivo: false, aviso_foto: null, sin_titulos: [] };

  // 1. El circuito de las dos gestiones, los resultados y «Cómo se cuenta» (los de Métricas del año, sin destildados: una foto no se destilda)
  dibujarElCircuito(doc, hoja, datos, { estadistico, dias, titulo });
  dibujarLosResultados(doc, hoja, datos, { anio, titulo, conDestildados: false });

  // 2. El contexto y el trabajo del RPAD (los de Métricas del año, sin las métricas manuales)
  dibujarParte(doc, hoja, titulo(TITULO_DEL_CONTEXTO), [
    ...elementosDelContexto(doc, objeto(f.contexto), objeto(f.trabajo), { pieDelIndice: TX.pieDelIndice }),
    ...elementosDelTrabajo(doc, objeto(f.trabajo), [], anio, { conManuales: false })
  ]);

  // 3. Áreas y temas (los de Métricas del año), de lo que guarda la foto
  dibujarLasAreas(doc, hoja, f.areas, { titulo });

  // 4. La comparación con el año anterior y los logros del año; el primer año no hay con qué comparar: solo los logros
  if (esObjeto(anterior)) {
    const y = dibujarParte(doc, hoja, titulo(`${TX.comparacion(anio)} y logros del año`), elementosDeLaComparacion(doc, anterior, { ...f, anio, al }));
    dibujarLogros(doc, y, logros, anio, { conCabeza: true });
  } else {
    const pildora = prepararPildora(doc, TX.primerAnio);
    const cabezal = tituloConDerecha(titulo(TX.logros), (y) => {
      ponerArribaALaDerecha(pildora, y);
      renglon(doc, TX.deDondeSalenLosLogros(anio), IZQUIERDA + CONTENIDO - DE_DONDE_SALEN.ancho, y + DE_DONDE_SALEN.sobre, {
        ancho: DE_DONDE_SALEN.ancho, tamano: LETRA.deDondeSalen, color: COLOR.gris, align: 'right'
      });
    });
    dibujarLogros(doc, dibujarParte(doc, hoja, cabezal, []), logros, anio, { conCabeza: false });
  }

  return cerrarReporte(doc, { generado, pieDe: (k, n) => `${nombre} · Hoja ${k} de ${n}` });
};
