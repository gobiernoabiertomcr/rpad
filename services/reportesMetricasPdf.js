// El PDF «Métricas del año» (spec 2026-10-24-metricas-y-reportes, 5 y 2): lo mismo que la pestaña Métricas para el año elegido, con el
// diseño de los anexos (5.1; maqueta 6-reportes-datos-reales.html), en A4 apaisado (spec 2026-11-05-metricas-pdf-apaisado). Son cuatro partes, cada una
// desde una hoja nueva:
// 1. el circuito de cada gestión, con su solapa y su panel;
// 2. los resultados del año, «Cómo se cuenta» y, si hay, los casos destildados;
// 3. el contexto (el índice mes a mes y la antigüedad de los vencidos) y el trabajo del RPAD;
// 4. el ranking de áreas y los datasets por tema y por frecuencia.
// La hoja 1 va con los días corridos primero, con cualquiera de los dos selectores; las otras siguen lo elegido (spec 2026-11-06-metricas-anticipacion-y-corridos, 6).
// La píldora dice el estadístico y lo destildado («Mediana en días corridos y hábiles · con todos los datasets»); el pie,
// «Métricas del RPAD · AAAA · Hoja k de N». Dibuja con la base de los reportes (reportesPdfBase.js) lo que manda el servidor: los datos
// de metricasDe (controllers/metricasController.js, los de GET /api/metricas) con los mismos textos que imprime la pestaña
// (public/js/reportes.js). No recalcula ninguna regla. Las cintas del recorrido típico están solo en la pestaña: sus cifras ya están en
// el circuito (spec 2026-11-05-metricas-pdf-apaisado). Puro: sin pool (los tests lo llaman sin base).
// El Informe anual (services/reportesInformeAnualPdf.js) repite las cuatro partes con los mismos dibujantes (dibujarElCircuito,
// dibujarLosResultados, elementosDelContexto, elementosDelTrabajo, dibujarLasAreas y dibujarParte).
import {
  COLOR, IZQUIERDA, HOJA_APAISADA, NORMAL, NEGRITA, ASCENDENTE, DESCENDENTE, desdeBase, ajustar, escribir, renglon, filete
} from './notasDigitalesAnexo.js';
import { mesYAnio } from './notasDigitalesCalendario.js';
import { COLORES, VIOLETA } from './seguimientoPdf.js';
import { ESTADISTICOS, DIAS, GESTIONES, TOTALES_DEL_TRABAJO, sinLosDestildados, textoEnCursoDeLosDos } from './metricasReglas.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, dibujarJuntos, prepararTitulo, prepararPildora, prepararTarjetas, prepararSeccion,
  prepararParrafo, prepararRecuadro, prepararTabla, nuevoFlujo, fechaCorta, ENTRE, anchoDelRecuadroEn, limiteDe, esObjeto, objeto, lista, esNumero, texto
} from './reportesPdfBase.js';

// La hoja de este PDF y del Informe anual (spec 2026-11-05-metricas-pdf-apaisado, 4): A4 apaisado. Lo que dibujan los otros reportes sigue en
// la vertical
const HOJA = HOJA_APAISADA;
const CONTENIDO = HOJA.contenido;
const ANCHO_DEL_RECUADRO = anchoDelRecuadroEn(HOJA);

// Letras (en puntos)
const LETRA = {
  aclaracion: 8.4, rotuloDeGestion: 6.6, columna: 10, heroe: 26, heroeMin: 14, de: 9, texto: 8.4, mini: 8.4, barra: 8.4, pie: 7.4, notaDeColumna: 7.6, indice: 7
};
// La letra del circuito, de mayor a menor (spec 2026-11-05-metricas-pdf-apaisado, 5): va la más grande con la que las dos gestiones entran en
// la hoja, la misma en las dos. Hay escalones porque una tarjeta crece tres renglones cuando se cargan las notas DGMIT («Respuesta del área»
// pasa a tener cifra y sigue con sus en curso): sin ellos, la interna se iría a otra hoja, y el usuario las quiere juntas
const LETRAS_DEL_CIRCUITO = Object.freeze([
  Object.freeze({ nodo: 11, nodoRol: 8.4, cifra: 21, cifraMin: 11, unidad: 9.2, vacio: 12, vacioMin: 8.6, debajo: 8.6, orientativo: 8.4, nombre: 11, chico: 8.6, insignia: 8 }),
  Object.freeze({ nodo: 10.4, nodoRol: 8, cifra: 19, cifraMin: 10, unidad: 8.6, vacio: 10.8, vacioMin: 8, debajo: 8.3, orientativo: 8, nombre: 10.2, chico: 8.3, insignia: 7.6 }),
  Object.freeze({ nodo: 9.8, nodoRol: 7.5, cifra: 17, cifraMin: 10, unidad: 8, vacio: 10, vacioMin: 7.6, debajo: 7.7, orientativo: 7.5, nombre: 9.4, chico: 7.7, insignia: 7 })
]);

const OJO = ASCENDENTE + DESCENDENTE;
const VERDE = COLORES.verde;
const AMBAR = COLORES.ambar;
// La barra de la antigüedad de los vencidos, en ámbar (la de la pantalla: .mt-barras i.ambar)
const BARRA_AMBAR = '#E2B23A';

// Los textos fijos de la pestaña (public/reportes.html y public/js/reportes.js): la página los escribe en su HTML y en reportes.js, y el
// PDF los toma de acá (también las funciones de abajo que arman lo mismo que la pestaña: textoDelDesglose, textoDeLoQueFalta,
// textoDeDondeSale, textoDelMesManual y textoSinManuales). tests/reportes-frontend.test.js comprueba que son los
// de la pestaña: si cambia uno allá, falla
export const TEXTOS_DE_LA_PESTANA = Object.freeze({
  estadisticos: Object.freeze({ mediana: 'Mediana', promedio: 'Promedio' }),
  dias: Object.freeze({ habiles: 'días hábiles', corridos: 'días corridos' }),
  bajada: Object.freeze({
    habiles: 'Los días son hábiles: de lunes a viernes, sin feriados ni días no laborables.',
    corridos: 'Los días son corridos: todos los días del calendario.'
  }),
  pieDelCircuito: 'Con «Mediana», el número grande es el del medio: en la mitad de los casos, ese número o menos. Con «Promedio» o «Días corridos», cada cifra lo dice debajo.',
  orientativo: 'con tan pocos casos, es orientativo',
  seCuentaHasta: 'Se cuenta hasta que se registra la actualización.',
  // Las dos puntas de la línea del cajón «Aviso anticipado»
  anticipacion: Object.freeze({ desde: 'aviso', hasta: 'vencimiento' }),
  // Lo que hace cada nodo del circuito
  roles: Object.freeze({
    rpad: 'Datos Públicos avisa', da: 'Mandan la nota formal', dit: 'Hacen el relevamiento', area: 'Prepara los datos',
    ddpc: 'Limpia y estructura', portal: 'Datos publicados'
  }),
  titulos: Object.freeze({
    resultados: 'Resultados del año', aTiempo: 'Actualizados a tiempo', cobertura: 'Cobertura del aviso', reiteraciones: 'Reiteraciones por ciclo',
    contexto: 'Contexto', indice: 'Índice de actualización, mes a mes', antiguedad: 'Antigüedad de los vencidos', trabajo: 'El trabajo del RPAD',
    porMes: 'Por mes', manuales: 'Métricas manuales (las carga administración)', auditoria: 'Doble verificación', ranking: 'Ranking de áreas',
    areas: 'Áreas y temas'
  }),
  bajadaDeResultados: (anio) => `Lo que dejó el circuito en ${anio}, con las dos gestiones juntas.`,
  bajadaDelTrabajo: (anio) => `Lo que hizo el sistema y el equipo de Datos Públicos en ${anio}.`,
  aTiempo: 'Cargados en el portal hasta el día del vencimiento.',
  gruposDelRpad: Object.freeze([['ninguna', 'Ninguna'], ['una', '1'], ['dos_o_mas', '2 o más']]),
  gruposDeLaDgmit: Object.freeze([['ninguna', 'Ninguna'], ['una_o_mas', '1 o más']]),
  pieDeLasReiteraciones: 'Del RPAD a la DGMIT, los avisos de cada ciclo después del aviso de la regla (o del primero, si se avisó ya vencido); de la DGMIT al área, las notas DGMIT de reiteración.',
  pieDelIndice: 'Es el índice de la portada: al día (actualizados y próximos a vencer) sobre los que tienen vencimiento. Un punto por el primer día de cada mes, y el último, el de hoy (en un año cerrado, el 31/12).',
  antiguedad: Object.freeze(['Menos de 3 meses', 'De 3 a 12 meses', 'Más de un año']),
  pieDeLaAntiguedad: 'Por días corridos desde el vencimiento. Los eventuales y los sin fecha no tienen vencimiento.',
  series: Object.freeze([['avisos', 'Avisos y notas'], ['actualizaciones', 'Actualizaciones'], ['auditados', 'Cambios auditados']]),
  tiposManuales: Object.freeze({
    reuniones_capacitaciones: 'Reuniones y capacitaciones', consultas_atendidas: 'Consultas atendidas', notas_enviadas: 'Notas enviadas fuera del RPAD'
  }),
  pieDeLaAuditoria: 'De la propuesta a la revisión, en tiempo corrido.',
  sinAreas: 'Sin datos de áreas',
  alDia: 'Al día sobre los que tienen vencimiento'
});
const T = TEXTOS_DE_LA_PESTANA;
// Lo que el PDF suma a la pestaña, que lo dice con su diseño: las siglas de los nodos (la hoja no tiene lugar para los nombres
// enteros) y desde cuándo cuenta un tramo
const SIGLAS = 'En los circuitos, DA es la Dirección Administrativa; DIT, la Dirección de Investigación Territorial, y DDPC, la Dirección de Datos Públicos y Comunicación.';
const EN_EL_ANIO = 'Un tramo cuenta en el año en que terminó; el aviso, en el año de su vencimiento.';
// La unidad de la hoja 1 con las dos vistas: lo dice la solapa y la píldora. La pestaña no lo tiene: sigue lo elegido
const LOS_DOS = 'días corridos y hábiles';
// Los títulos de las hojas; el del contexto lo usa también el Informe anual (services/reportesInformeAnualPdf.js)
const TITULO_DEL_CIRCUITO = 'El circuito, del aviso del RPAD a la carga en el portal';
export const TITULO_DEL_CONTEXTO = 'El contexto y el trabajo del RPAD';

// Los nodos del circuito (spec 2.2), con la sigla de quien es (la maqueta de los PDF) y qué hace: lo de la DGMIT en violeta, el Portal en
// verde y el resto en el acento (en el circuito de Métricas, el Área lleva COLOR_DEL_AREA; también los dibuja el Ciclo de vida del dato,
// services/reportesCicloDeVidaPdf.js)
export const NODOS = Object.freeze({
  rpad: { nombre: 'RPAD', rol: T.roles.rpad, color: COLOR.acento },
  da: { nombre: 'DGMIT y DA', rol: T.roles.da, color: VIOLETA },
  dit: { nombre: 'DGMIT y DIT', rol: T.roles.dit, color: VIOLETA },
  area: { nombre: 'Área', rol: T.roles.area, color: COLOR.acento },
  ddpc: { nombre: 'DDPC', rol: T.roles.ddpc, color: COLOR.acento },
  portal: { nombre: 'Portal', rol: T.roles.portal, color: VERDE }
});
// El circuito de cada gestión: cada nodo con la clave de su tramo (la etapa que le toca, debajo de él). El Portal va sin etapa y mide lo justo
// para su texto; las demás columnas son iguales dentro de cada gestión
const CIRCUITO_DE_LA_GESTION = Object.freeze({
  externa: { pasos: [['rpad', 'aviso'], ['da', 'tramite'], ['area', 'respuesta'], ['ddpc', 'carga'], ['portal', null]] },
  interna: { pasos: [['rpad', 'aviso'], ['dit', 'produccion'], ['ddpc', 'carga'], ['portal', null]] }
});
// La banda: el aire, el alto mínimo, la punta de cada flecha, lo que queda entre dos, el radio de las puntas redondeadas y el aire debajo.
// La etapa: el aire, el radio, lo que queda entre dos y lo que queda debajo del nombre y arriba de la insignia
const BANDA = { relleno: 3, alto: 28, punta: 7, luz: 2, radio: 4, bajo: 3 };
const ETAPA = { relleno: 4, radio: 4, separacion: 3, bajoNombre: 2, sobreInsignia: 3 };
// El Área tiene color propio en el circuito. No está en NODOS: si no, cambiaría el Ciclo de vida del dato, que también los dibuja
export const COLOR_DEL_AREA = '#1F6B73';
// Los colores de una etapa: el fondo y el borde de la tarjeta, el nombre y la cifra, y la insignia (su fondo y su letra). El recuadro ya es
// celeste: la tarjeta común va en blanco
const TONOS_DE_LA_ETAPA = Object.freeze({
  comun: { fondo: COLOR.blanco, borde: '#C9D7E6', tinta: COLOR.tinta, fondoInsignia: COLOR.acentoSuave, letraInsignia: COLOR.acento },
  dgmit: { fondo: '#F5F2FB', borde: '#D6CCEB', tinta: VIOLETA, fondoInsignia: '#E6DFF3', letraInsignia: VIOLETA },
  area: { fondo: '#F0F8F9', borde: '#BFDDE0', tinta: COLOR_DEL_AREA, fondoInsignia: '#D5ECEE', letraInsignia: COLOR_DEL_AREA }
});
// Una etapa sin cifra va en gris, con el borde punteado
const FONDO_SIN_CIFRA = '#F8F9FB';
// La línea del cajón «Aviso anticipado» (spec 2026-11-06-metricas-anticipacion-y-corridos, 7): el aire sobre ella, el alto que ocupa, el radio del punto, el del aro, su grueso y el aire
// entre los rótulos y el estadístico. Ese aire es el renglón en blanco de la maqueta: sin él, los rótulos se leen pegados al estadístico
const ANTICIPACION = { sobreLinea: 1, altoLinea: 12, punto: 2.8, aro: 3, grueso: 1.4, bajoRotulos: 4 };

// Cada gestión lleva una solapa con su nombre y un panel con su circuito (spec 2026-11-05-metricas-pdf-apaisado, 5): la externa, llena; la
// interna, hueca. Así se distinguen también impresas en blanco y negro. Van en COLOR.tinta, neutro: el azul, el violeta y los verdes dicen
// quién actúa. Las frases son del dibujo y no de la pestaña, que no las tiene: por eso no están en TEXTOS_DE_LA_PESTANA
const FRASES_DE_LA_GESTION = Object.freeze({
  externa: 'La DGMIT y la DA mandan la nota formal; el área prepara los datos.',
  interna: 'La DGMIT y la DIT hacen el relevamiento.'
});
const SOLAPA = { alto: 17, aire: 20, texto: 10, sobreTexto: 5.5, letra: 8.6, espaciado: 0.8, luz: 8, letraDeAlLado: 7.6, anchoDeLaDerecha: 160, radio: 4 };
const PANEL = { arriba: 6, abajo: 7, radio: 5, borde: 1.2 };
// El aire debajo de la externa, que separa las dos gestiones
const AIRE_ENTRE_GESTIONES = 18;
// El rótulo más largo («INFORME ANUAL · AÑO 2026, AL 31/12/2026») y su aire: la píldora de arriba a la derecha nunca lo toca
const LUGAR_DEL_ROTULO = 242;
// Lo que va a la derecha del título de la hoja 1, debajo de la píldora: de dónde sale un año cerrado
const DE_DONDE_SALE = { ancho: 245, letra: 7.2, sobre: 19 };
// La bajada a la derecha del título de los resultados
const BAJADA = { ancho: 330, letra: 8.4, sobre: 22 };

// Los resultados: tres columnas, con su separación; la lista de los que no tuvieron el aviso de la regla se corta en este alto (con
// muchísimos, «y N más.»: así los resultados entran siempre en una hoja)
const SEPARACION_COLUMNAS = 14;
const ANCHO_COLUMNA = (CONTENIDO - 2 * SEPARACION_COLUMNAS) / 3;
const ALTO_MAXIMO_DE_LA_LISTA = 260;

// El trabajo del RPAD: los cinco totales, en el orden de sus textos (TOTALES_DEL_TRABAJO de las reglas; las series por mes y los grupos
// de las reiteraciones, en T)
const TOTALES = Object.keys(TOTALES_DEL_TRABAJO);

// El gráfico del índice: el alto del área de los valores (de 0 a 100 %), el lugar de los rótulos del eje a la izquierda, el de los
// valores arriba, el de los meses abajo (en dos renglones si dos se pisan) y el aire a los costados del primer y del último mes
const GRAFICO = { alto: 100, izquierda: 24, arriba: 12, abajo: 20, aire: 10 };

// (esObjeto, objeto, lista, esNumero y texto son los de la base de los reportes)
const cuenta = (valor) => (esNumero(valor) ? String(valor) : '0');
const elegido = (valor, validos) => (validos.includes(valor) ? valor : validos[0]);

// =====================================================
// La píldora y lo de arriba
// =====================================================

// De qué vista se dibuja la hoja 1 (spec 2026-11-06-metricas-anticipacion-y-corridos, 6). `combinada`: si llegaron las dos, con las dos gestiones; entonces `tramos` es el
// circuito en días corridos y `habiles`, el mismo en días hábiles. Si no (una foto sin esa combinación), no tira: `tramos` es la vista elegida y `habiles`, null
const circuitoDeLaHoja = (d) => {
  const corridos = objeto(d.circuito_en_corridos);
  const habiles = objeto(d.circuito_en_habiles);
  const combinada = GESTIONES.every((gestion) => Array.isArray(corridos[gestion]) && Array.isArray(habiles[gestion]));
  return combinada ? { tramos: corridos, habiles, combinada } : { tramos: objeto(objeto(d.vista).circuito), habiles: null, combinada };
};

// Lo que dice la solapa de cada gestión: «Mediana en días corridos y hábiles», o lo elegido si no llegaron las dos vistas
const textoDeLaCombinacion = (d) =>
  `${T.estadisticos[elegido(d.estadistico, ESTADISTICOS)]} en ${circuitoDeLaHoja(d).combinada ? LOS_DOS : T.dias[elegido(d.dias, DIAS)]}`;

// Lo de la solapa y lo destildado (spec 1.5 y 1.7), con lo que manda el servidor (`datos`: { estadistico, dias, sin_titulos, circuito_en_corridos, circuito_en_habiles }):
// «Mediana en días corridos y hábiles · con todos los datasets» o «… · calculado sin 1 dataset: Parque Automotor». Lo destildado,
// con la leyenda de la franja de la pestaña (sinLosDestildados de las reglas: un solo armador del plural)
export const textoDeLaPildora = (datos) => {
  const d = objeto(datos);
  const sin = sinLosDestildados(d.sin_titulos);
  return `${textoDeLaCombinacion(d)} · ${sin === '' ? 'con todos los datasets' : `calculado ${sin}`}`;
};

// El rótulo de cada parte: «Métricas · año 2026, en curso» o, en un año cerrado, «Métricas · año 2026, al 31/12/2026»
const rotuloDelAnio = (d) => (lista(d.anios).at(-1) === d.anio
  ? `Métricas · año ${d.anio}, en curso`
  : `Métricas · año ${d.anio}, al ${fechaCorta(d.al)}`);

// De dónde sale un año cerrado (lo que dice la barra de la pestaña): el aviso de la foto que falta (del servidor) o la foto del 31/12;
// en vivo, nada
export const textoDeDondeSale = (datos) => {
  const d = objeto(datos);
  if (texto(d.aviso_foto)) return texto(d.aviso_foto);
  return d.en_vivo === false ? `Sale de la foto del ${fechaCorta(d.al)}, calculada con todos los datasets.` : '';
};

// El desglose de «Actualizados a tiempo» por gestión: «Externa: 4 de 27 · Interna: 1 de 6»
export const textoDelDesglose = (aTiempo) => {
  const a = objeto(aTiempo);
  return [['externa', 'Externa'], ['interna', 'Interna']]
    .map(([clave, nombre]) => `${nombre}: ${cuenta(lista(a[clave])[0])} de ${cuenta(lista(a[clave])[1])}`).join(' · ');
};

// Un vencimiento sin el aviso de la regla, en la cobertura: «Listado de Proveedores (vencimiento 31/01/2026), se avisó ya vencido»
export const textoDeLoQueFalta = (falta) => {
  const f = objeto(falta);
  return `${texto(f.titulo)} (vencimiento ${fechaCorta(f.venc)}), ${texto(f.motivo)}`;
};

// El mes de una métrica manual: «Marzo 2026»
export const textoDelMesManual = (mes, anio) => {
  const m = Number(mes);
  if (!Number.isInteger(m) || m < 1 || m > 12) return String(anio);
  const nombre = mesYAnio(`${anio}-${String(m).padStart(2, '0')}-01`);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
};

// Sin métricas manuales en el año: «Todavía no hay métricas manuales cargadas en 2026.»
export const textoSinManuales = (anio) => `Todavía no hay métricas manuales cargadas en ${anio}.`;

// =====================================================
// Piezas: lo que va adentro de un recuadro o de una columna ({ alto, dibujar(y, x) })
// =====================================================

// Un texto ajustado a `ancho` en hasta `lineas` líneas (se achica hasta `min`; si no entra, se corta con "…"). Sin texto, null
const pieza = (doc, valor, { ancho, tamano, min = tamano, fuente = NORMAL, color = COLOR.gris, lineas = 2 }) => {
  const t = texto(valor);
  if (!t) return null;
  const ajuste = ajustar(doc, t, { ancho, lineas, max: tamano, min, fuente });
  return { alto: ajuste.alto, dibujar: (y, x) => escribir(doc, ajuste, x, y, color) };
};

// Las piezas una debajo de la otra, con `entre` puntos entre cada dos (las null no van)
const apilar = (piezas, entre = 2) => {
  const hay = piezas.filter(Boolean);
  const alto = hay.reduce((total, p) => total + p.alto, 0) + entre * Math.max(0, hay.length - 1);
  return {
    alto,
    dibujar: (y, x) => {
      let yPieza = y;
      for (const p of hay) {
        p.dibujar(yPieza, x);
        yPieza += p.alto + entre;
      }
    }
  };
};

// Una pieza del ancho útil como elemento de la base (para dibujarJuntos): dibujar(y) → la y de lo que sigue
const comoElemento = (p) => ({
  alto: p.alto,
  dibujar: (y) => {
    p.dibujar(y, IZQUIERDA);
    return y + p.alto + ENTRE;
  }
});

// El contorno de un rectángulo redondeado, con líneas y curvas: las tarjetas del circuito y las insignias van
// adentro de otro dibujo, y un roundedRect sería, para el test de diagramación, un bloque encimado con su recuadro (la marca del
// Seguimiento tampoco lo usa). Devuelve el documento, para pintarlo. También lo usa el Ciclo de vida del dato
// (services/reportesCicloDeVidaPdf.js)
const KAPPA = 0.5523;
export const contorno = (doc, x, y, ancho, alto, radio) => {
  const r = Math.max(0, Math.min(radio, ancho / 2, alto / 2));
  const c = r * (1 - KAPPA);
  return doc.moveTo(x + r, y).lineTo(x + ancho - r, y).bezierCurveTo(x + ancho - c, y, x + ancho, y + c, x + ancho, y + r)
    .lineTo(x + ancho, y + alto - r).bezierCurveTo(x + ancho, y + alto - c, x + ancho - c, y + alto, x + ancho - r, y + alto)
    .lineTo(x + r, y + alto).bezierCurveTo(x + c, y + alto, x, y + alto - c, x, y + alto - r)
    .lineTo(x, y + r).bezierCurveTo(x, y + c, x + c, y, x + r, y).closePath();
};

// Un número grande con lo que va al lado en la misma línea de base («27» + «días hábiles», «5» + «de 33 ciclos»); si los dos no entran
// en `ancho`, lo de al lado va debajo (la unidad nunca se corta en dos renglones)
const piezaDeCifra = (doc, { numero, lado }, { ancho, tamano, min, tamanoLado, color, colorLado = COLOR.gris, fuenteLado = NEGRITA }) => {
  const grande = ajustar(doc, texto(numero), { ancho, lineas: 1, max: tamano, min, fuente: NEGRITA });
  const anchoGrande = doc.font(NEGRITA).fontSize(grande.tamano).widthOfString(grande.texto);
  const deLado = texto(lado);
  const chico = deLado ? ajustar(doc, deLado, { ancho, lineas: 2, max: tamanoLado, min: tamanoLado, fuente: fuenteLado }) : null;
  const anchoChico = chico ? doc.font(fuenteLado).fontSize(tamanoLado).widthOfString(chico.texto) : 0;
  const alLado = chico !== null && chico.alto <= doc.font(fuenteLado).fontSize(tamanoLado).currentLineHeight(true) + 0.01
    && anchoGrande + 2.5 + anchoChico <= ancho;
  const alto = grande.alto + (chico && !alLado ? chico.alto : 0);
  return {
    alto,
    dibujar: (y, x) => {
      escribir(doc, grande, x, y, color);
      if (!chico) return;
      if (alLado) {
        // En la misma línea de base que el número
        const base = y + ASCENDENTE * grande.tamano;
        escribir(doc, chico, x + anchoGrande + 2.5, base - ASCENDENTE * tamanoLado, colorLado);
      } else {
        escribir(doc, chico, x, y + grande.alto, colorLado);
      }
    }
  };
};

// La insignia de quién está a cargo de un tramo (nunca solo el color): el texto en negrita en una píldora del color de la etapa
const piezaDeInsignia = (doc, valor, { ancho, color, fondo, tamano }) => {
  const t = texto(valor);
  if (!t) return null;
  const alto = 10;
  const anchoTexto = Math.min(ancho - 8, doc.font(NEGRITA).fontSize(tamano).widthOfString(t) + 1);
  return {
    alto,
    dibujar: (y, x) => {
      doc.save();
      contorno(doc, x, y, anchoTexto + 8, alto, alto / 2).fill(fondo);
      doc.restore();
      renglon(doc, t, x + 4, y + (alto - ASCENDENTE * tamano) / 2, { ancho: anchoTexto, tamano, fuente: NEGRITA, color });
    }
  };
};

// Barras horizontales ([texto, cantidad], cada una relativa a la más larga), con el texto a la izquierda y la cantidad a la derecha
const piezaDeBarras = (doc, filas, { ancho, anchoTexto, color = COLOR.acento }) => {
  const valores = filas.map(([, n]) => (esNumero(n) ? n : 0));
  const maximo = Math.max(0, ...valores);
  const anchoCantidad = 22;
  const largo = ancho - anchoTexto - anchoCantidad - 8;
  const renglones = filas.map(([t], i) => {
    const etiqueta = ajustar(doc, texto(t), { ancho: anchoTexto, lineas: 2, max: LETRA.barra, min: LETRA.barra });
    return { etiqueta, valor: valores[i], alto: Math.max(etiqueta.alto, 9) + 3 };
  });
  return {
    alto: renglones.reduce((total, r) => total + r.alto, 0),
    dibujar: (y, x) => {
      let yRenglon = y;
      for (const r of renglones) {
        escribir(doc, r.etiqueta, x, yRenglon, COLOR.tinta);
        const centro = yRenglon + (ASCENDENTE * LETRA.barra) / 2;
        const largoBarra = maximo > 0 ? (r.valor * largo) / maximo : 0;
        if (largoBarra > 0) doc.rect(x + anchoTexto + 4, centro - 3.5, largoBarra, 7).fill(color);
        renglon(doc, String(r.valor), x + ancho - anchoCantidad, yRenglon, { ancho: anchoCantidad, tamano: LETRA.barra, fuente: NEGRITA, align: 'right' });
        yRenglon += r.alto;
      }
    }
  };
};

// El medidor: una barra fina con el porcentaje del servidor lleno (sin porcentaje, no va)
const piezaDeMedidor = (doc, porcentaje, ancho) => {
  if (!esNumero(porcentaje)) return null;
  const lleno = (Math.min(100, Math.max(0, porcentaje)) * ancho) / 100;
  return {
    alto: 4,
    dibujar: (y, x) => {
      doc.rect(x, y, ancho, 4).fill(COLOR.linea);
      if (lleno > 0) doc.rect(x, y, lleno, 4).fill(COLOR.acento);
    }
  };
};

// =====================================================
// El circuito
// =====================================================

// La forma de una banda: una flecha, con la muesca donde entra la anterior. La primera y la última van con las puntas redondeadas. Con
// líneas y curvas, como `contorno`: un roundedRect sería, para el test de diagramación, un bloque encimado con su recuadro
const contornoDeBanda = (doc, x, y, ancho, alto, { primera, ultima }) => {
  const r = BANDA.radio;
  const c = r * (1 - KAPPA);
  const p = BANDA.punta;
  const d = x + ancho;
  doc.moveTo(primera ? x + r : x, y);
  if (ultima) doc.lineTo(d - r, y).bezierCurveTo(d - c, y, d, y + c, d, y + r).lineTo(d, y + alto - r).bezierCurveTo(d, y + alto - c, d - c, y + alto, d - r, y + alto);
  else doc.lineTo(d - p, y).lineTo(d, y + alto / 2).lineTo(d - p, y + alto);
  if (primera) doc.lineTo(x + r, y + alto).bezierCurveTo(x + c, y + alto, x, y + alto - c, x, y + alto - r).lineTo(x, y + r).bezierCurveTo(x, y + c, x + c, y, x + r, y);
  else doc.lineTo(x, y + alto).lineTo(x + p, y + alto / 2);
  return doc.closePath();
};

// Una banda: la sigla de quién actúa y qué hace, en blanco sobre su color. `anchoColumna`: la flecha sale de ahí hasta la muesca de la
// siguiente
const bandaDe = (doc, clave, anchoColumna, { primera, ultima }, letra) => {
  const nodo = NODOS[clave];
  const izquierda = primera ? BANDA.relleno : BANDA.punta + BANDA.relleno;
  const derecha = ultima ? BANDA.relleno : BANDA.relleno + BANDA.luz;
  const anchoTexto = anchoColumna - izquierda - derecha;
  return {
    color: clave === 'area' ? COLOR_DEL_AREA : nodo.color,
    izquierda,
    ancho: ultima ? anchoColumna : anchoColumna + BANDA.punta - BANDA.luz,
    contenido: apilar([
      pieza(doc, nodo.nombre, { ancho: anchoTexto, tamano: letra.nodo, min: letra.nodo - 1.5, fuente: NEGRITA, color: COLOR.blanco, lineas: 2 }),
      pieza(doc, nodo.rol, { ancho: anchoTexto, tamano: letra.nodoRol, min: letra.nodoRol - 0.5, color: COLOR.blanco, lineas: 2 })
    ], 1)
  };
};

// «(53 días hábiles)»: la cifra del mismo tramo en días hábiles, con el texto y la unidad del servidor (spec 2026-11-06-metricas-anticipacion-y-corridos, 6). Nada si
// falta alguna de las dos o si las dos son «En el día»; con días corridos y 0 hábiles, «(En el día, en días hábiles)». `cifra` y `habil`: las cifras de vistaDe
export const textoDeHabiles = (cifra, habil) => {
  if (!esObjeto(cifra) || !esObjeto(habil)) return '';
  if (habil.en_el_dia === true) return cifra.en_el_dia === true ? '' : `(${texto(habil.texto)}, en días hábiles)`;
  return `(${texto(habil.texto)} ${texto(habil.unidad)})`;
};

// La cifra con los hábiles pegados abajo (spec 2026-11-06-metricas-anticipacion-y-corridos, 6): se les resta lo que la cifra deja debajo de su letra y se suma después de ellos.
// Así el aire queda antes del estadístico y la tarjeta mide lo mismo que con las dos piezas apiladas. `abajo`: la pieza de los hábiles (sin ella, la cifra sola)
export const grupoDeLaCifra = (grande, abajo, letra) => {
  if (!abajo) return grande;
  const subir = letra.cifra * 0.2;
  return {
    alto: grande.alto + abajo.alto + 1,
    dibujar: (y, x) => {
      grande.dibujar(y, x);
      abajo.dibujar(y + grande.alto - subir, x);
    }
  };
};

// La línea del cajón del aviso: un dibujo fijo, que no mide los días. Empieza en un punto lleno y termina en un aro con fondo blanco, con su borde adentro de `ancho`.
// Va con moveTo y lineTo: un rect fino sería, para el test de diagramación, una línea que cruza la tarjeta
const piezaDeLaLinea = (doc, ancho, color) => ({
  alto: ANTICIPACION.sobreLinea + ANTICIPACION.altoLinea,
  dibujar: (y, x) => {
    const yLinea = y + ANTICIPACION.sobreLinea + ANTICIPACION.altoLinea / 2;
    const xPunto = x + ANTICIPACION.punto;
    const xAro = x + ancho - ANTICIPACION.aro - ANTICIPACION.grueso / 2;
    doc.save();
    doc.lineWidth(ANTICIPACION.grueso);
    doc.moveTo(xPunto, yLinea).lineTo(xAro, yLinea).stroke(color);
    doc.circle(xPunto, yLinea, ANTICIPACION.punto).fill(color);
    doc.circle(xAro, yLinea, ANTICIPACION.aro).fillAndStroke(COLOR.blanco, color);
    doc.restore();
  }
});

// «aviso» debajo de una punta de la línea y «vencimiento» debajo de la otra, medido para terminar en el borde, con el aire que los separa del estadístico
const piezaDeLosRotulos = (doc, ancho, tamano) => {
  const rotulo = (valor) => pieza(doc, valor, { ancho, tamano, lineas: 1 });
  const [desde, hasta] = [rotulo(T.anticipacion.desde), rotulo(T.anticipacion.hasta)];
  const anchoHasta = doc.font(NORMAL).fontSize(tamano).widthOfString(T.anticipacion.hasta);
  return {
    alto: desde.alto + ANTICIPACION.bajoRotulos,
    dibujar: (y, x) => {
      desde.dibujar(y, x);
      hasta.dibujar(y, x + ancho - anchoHasta);
    }
  };
};

// El cuerpo del cajón «Aviso anticipado» (spec 2026-11-06-metricas-anticipacion-y-corridos, 7), la única etapa donde más días es mejor: pegados, el número solo (su unidad está en la frase), la frase del
// servidor y los hábiles; después el aire que la cifra deja debajo, la línea, sus rótulos, el estadístico y el orientativo. Todo se mide antes de dibujarse, para que LETRAS_DEL_CIRCUITO elija el escalón.
// `habil`: la cifra del mismo tramo en días hábiles (sin ella, sin paréntesis)
const cuerpoDeLaAnticipacion = (doc, { tramo, cifra, habil, ancho, letra, tono, chico }) => apilar([
  grupoDeLaCifra(
    pieza(doc, cifra.texto, { ancho, tamano: letra.cifra, min: letra.cifraMin, fuente: NEGRITA, color: tono.tinta, lineas: 1 }),
    apilar([
      pieza(doc, tramo.anticipacion_texto, { ancho, tamano: letra.unidad, fuente: NEGRITA, lineas: 2 }),
      chico(textoDeHabiles(cifra, habil), { fuente: NEGRITA, color: tono.tinta, tamano: letra.debajo, lineas: 1 })
    ], 0),
    letra
  ),
  piezaDeLaLinea(doc, ancho, tono.tinta),
  piezaDeLosRotulos(doc, ancho, letra.chico - 0.8),
  chico(cifra.debajo, { fuente: NEGRITA, tamano: letra.debajo, lineas: 2 }),
  cifra.orientativo === true ? chico(T.orientativo, { fuente: NEGRITA, color: AMBAR, tamano: letra.orientativo }) : null
], 1);

// La etapa de un tramo (un Tramo de vistaDe), con lo que manda el servidor, como htmlDeFlecha de la pestaña: el nombre arriba; la cifra con
// su unidad al lado, debajo los días hábiles entre paréntesis y el estadístico con los ciclos («83» + «días corridos», «(53 días hábiles)», «mediana de 32 ciclos»; con 0, «En el día» y «mediana en
// días corridos», con los ciclos más abajo), «con tan pocos casos, es orientativo» o, sin cifra, por qué (`vacio.titulo`); «desde → hasta»,
// los pendientes de carga de la DGMIT, los en curso, con las dos unidades (con «Se cuenta hasta que se registra la actualización.») y, al pie, la insignia de
// quién está a cargo. Con `anticipacion_texto`, el cuerpo es el de cuerpoDeLaAnticipacion. Lo de la DGMIT en violeta y lo del área en su color; sin cifra, el borde punteado. `habil`: el mismo tramo en días hábiles, o null (entonces, sin paréntesis y con la frase de
// los en curso de `tramo`); `estadistico`: el que se pidió
const etapaDe = (doc, clave, tramo, ancho, letra, { habil, estadistico }) => {
  const t = objeto(tramo);
  const h = objeto(habil);
  const cifra = esObjeto(t.cifra) ? t.cifra : null;
  const vacio = cifra === null && esObjeto(t.vacio) ? t.vacio : null;
  const dgmit = t.dgmit === true;
  const tono = dgmit ? TONOS_DE_LA_ETAPA.dgmit : clave === 'respuesta' ? TONOS_DE_LA_ETAPA.area : TONOS_DE_LA_ETAPA.comun;
  const anchoTexto = ancho - 2 * ETAPA.relleno;
  const chico = (valor, { color = COLOR.gris, fuente = NORMAL, lineas = 3, tamano = letra.chico } = {}) =>
    pieza(doc, valor, { ancho: anchoTexto, tamano, fuente, color, lineas });
  const deLaDgmit = t.clave === 'tramite';
  let pendientes = null;
  if (vacio && texto(vacio.texto)) {
    pendientes = chico(vacio.texto, deLaDgmit ? { color: VIOLETA, fuente: NEGRITA, lineas: 5 } : { lineas: 5 });
  } else if (texto(t.pendientes_texto)) {
    pendientes = chico(t.pendientes_texto, { color: VIOLETA, fuente: NEGRITA, lineas: 5 });
  }
  const textoEnCurso = esObjeto(t.en_curso) ? textoEnCursoDeLosDos(t.en_curso, esObjeto(h.en_curso) ? h.en_curso : null, estadistico) : '';
  const enCurso = texto(textoEnCurso) ? [chico(textoEnCurso, { color: AMBAR, fuente: NEGRITA, lineas: 6 }), chico(T.seCuentaHasta)] : [];
  return {
    tono,
    punteada: cifra === null,
    nombre: pieza(doc, t.nombre, { ancho: anchoTexto, tamano: letra.nombre, fuente: NEGRITA, color: tono.tinta, lineas: 2 }),
    cuerpo: cifra && texto(cifra.texto) && texto(t.anticipacion_texto) ? cuerpoDeLaAnticipacion(doc, { tramo: t, cifra, habil: h.cifra, ancho: anchoTexto, letra, tono, chico }) : apilar([
      cifra
        ? grupoDeLaCifra(
          piezaDeCifra(doc, { numero: cifra.texto, lado: cifra.unidad }, {
            ancho: anchoTexto, tamano: letra.cifra, min: letra.cifraMin, tamanoLado: letra.unidad, color: tono.tinta
          }),
          chico(textoDeHabiles(cifra, h.cifra), { fuente: NEGRITA, color: tono.tinta, tamano: letra.debajo, lineas: 1 }),
          letra
        )
        : pieza(doc, vacio?.titulo, { ancho: anchoTexto, tamano: letra.vacio, min: letra.vacioMin, fuente: NEGRITA, color: COLOR.gris, lineas: 3 }),
      cifra ? chico(cifra.debajo, { fuente: NEGRITA, color: dgmit ? VIOLETA : COLOR.gris, tamano: letra.debajo, lineas: 2 }) : null,
      cifra?.orientativo === true ? chico(T.orientativo, { fuente: NEGRITA, color: AMBAR, tamano: letra.orientativo }) : null,
      chico(t.desde_hasta, { lineas: 2 }),
      cifra?.en_el_dia === true ? chico(cifra.ciclos_texto, { color: COLOR.tinta, fuente: NEGRITA, lineas: 1 }) : null,
      pendientes,
      ...enCurso
    ], 1),
    insignia: piezaDeInsignia(doc, t.responsable, { ancho: anchoTexto, color: tono.letraInsignia, fondo: tono.fondoInsignia, tamano: letra.insignia })
  };
};

// El circuito de una gestión (spec 2026-11-05-circuito-diseno, 7), del ancho de adentro de un recuadro: arriba, la banda de flechas con
// quién actúa; debajo de cada una, la etapa que le toca. Los nombres de las etapas y sus cifras quedan a la misma altura y las tarjetas
// tienen el mismo alto. `tramos`: los de vistaDe para la gestión; `enHabiles`: los mismos en días hábiles (sin ellos, sin paréntesis)
const piezaDelCircuito = (doc, tramos, gestion, letra, { enHabiles, estadistico }) => {
  const { pasos } = CIRCUITO_DE_LA_GESTION[gestion];
  const anchoDelPortal = Math.max(
    doc.font(NEGRITA).fontSize(letra.nodo).widthOfString(NODOS.portal.nombre),
    doc.font(NORMAL).fontSize(letra.nodoRol).widthOfString(NODOS.portal.rol)
  ) + BANDA.punta + 2 * BANDA.relleno + 1.5;
  const unidad = (ANCHO_DEL_RECUADRO - anchoDelPortal) / pasos.filter(([, clave]) => clave !== null).length;
  const tramoDe = (clave) => lista(tramos).find((t) => esObjeto(t) && t.clave === clave) ?? null;
  const habilDe = (clave) => lista(enHabiles).find((t) => esObjeto(t) && t.clave === clave) ?? null;
  const columnas = [];
  let x = 0;
  pasos.forEach(([nodo, clave], i) => {
    const ancho = clave === null ? anchoDelPortal : unidad;
    const lugar = { primera: i === 0, ultima: clave === null };
    columnas.push({ x, ancho, lugar, banda: bandaDe(doc, nodo, ancho, lugar, letra), etapa: clave === null ? null : etapaDe(doc, clave, tramoDe(clave), ancho - ETAPA.separacion, letra, { habil: habilDe(clave), estadistico }) });
    x += ancho;
  });
  const etapas = columnas.filter((c) => c.etapa).map((c) => c.etapa);
  const altoBanda = Math.max(BANDA.alto, ...columnas.map((c) => c.banda.contenido.alto + 2 * BANDA.relleno));
  const altoNombre = Math.max(0, ...etapas.map((e) => e.nombre?.alto ?? 0));
  const altoCuerpo = Math.max(0, ...etapas.map((e) => e.cuerpo.alto));
  const altoInsignia = Math.max(0, ...etapas.map((e) => e.insignia?.alto ?? 0));
  const altoEtapa = 2 * ETAPA.relleno + altoNombre + ETAPA.bajoNombre + altoCuerpo + ETAPA.sobreInsignia + altoInsignia;
  return {
    alto: altoBanda + BANDA.bajo + altoEtapa,
    dibujar: (y, x0) => {
      for (const c of columnas) {
        const xc = x0 + c.x;
        doc.save();
        contornoDeBanda(doc, xc, y, c.banda.ancho, altoBanda, c.lugar).fill(c.banda.color);
        doc.restore();
        c.banda.contenido.dibujar(y + (altoBanda - c.banda.contenido.alto) / 2, xc + c.banda.izquierda);
        if (!c.etapa) continue;
        const e = c.etapa;
        const yEtapa = y + altoBanda + BANDA.bajo;
        const anchoEtapa = c.ancho - ETAPA.separacion;
        doc.save();
        contorno(doc, xc, yEtapa, anchoEtapa, altoEtapa, ETAPA.radio).fill(e.punteada ? FONDO_SIN_CIFRA : e.tono.fondo);
        doc.restore();
        doc.save();
        doc.lineWidth(0.7);
        if (e.punteada) doc.dash(3, { space: 2 });
        contorno(doc, xc, yEtapa, anchoEtapa, altoEtapa, ETAPA.radio).stroke(e.punteada ? COLOR.grisClaro : e.tono.borde);
        doc.restore();
        const xTexto = xc + ETAPA.relleno;
        e.nombre?.dibujar(yEtapa + ETAPA.relleno, xTexto);
        e.cuerpo.dibujar(yEtapa + ETAPA.relleno + altoNombre + ETAPA.bajoNombre, xTexto);
        e.insignia?.dibujar(yEtapa + altoEtapa - ETAPA.relleno - e.insignia.alto, xTexto);
      }
    }
  };
};

// Las aclaraciones de una gestión, las del servidor (los avisados ya vencidos y, en la externa, los resueltos con una fuente pública y los de
// datasets que no requieren nota DGMIT; las vacías no van). Van en «Cómo se cuenta», en la hoja de los resultados, y no debajo del circuito:
// así la hoja 1 lleva la letra más grande. No se sacan del PDF: son lo único que avisa que hay ciclos que no cuentan en una cifra
const aclaracionesDe = (circuito, gestion) => {
  const a = objeto(objeto(circuito.aclaraciones)[gestion]);
  return [a.ya_vencidos, a.fuente_publica, a.no_requieren_nota].map((x) => texto(objeto(x).texto)).filter(Boolean);
};

// El recuadro de una gestión (spec 2026-11-05-metricas-pdf-apaisado, 5): la solapa, con su nombre, su frase a la derecha y la combinación sobre el
// margen, y debajo el panel con el circuito. `contenido`: la pieza del circuito, del ancho ANCHO_DEL_RECUADRO. El panel es un roundedRect, para que
// el test de diagramación controle que nada cruza su borde; la solapa, un contorno. El aire debajo de la externa no cuenta en `alto`: no hace falta
// que entre en la hoja, si no sigue nada
const prepararGestion = (doc, { gestion, combinacion, contenido }) => {
  const llena = gestion === 'externa';
  const nombre = `Gestión ${gestion}`.toUpperCase();
  const altoDelPanel = PANEL.arriba + contenido.alto + PANEL.abajo;
  const alto = SOLAPA.alto + altoDelPanel;
  const medio = PANEL.borde / 2;
  return {
    alto,
    dibujar: (y) => {
      const anchoDeLaSolapa = doc.font(NEGRITA).fontSize(SOLAPA.letra).widthOfString(nombre, { characterSpacing: SOLAPA.espaciado }) + SOLAPA.aire;
      const yPanel = y + SOLAPA.alto;
      const yTexto = y + SOLAPA.sobreTexto;
      // La solapa nace del panel: la esquina del panel debajo de ella es recta (se tapa la curva) y su borde de abajo no se ve
      const x = llena ? IZQUIERDA : IZQUIERDA + medio;
      const d = x + anchoDeLaSolapa;
      const r = SOLAPA.radio;
      const c = r * (1 - KAPPA);
      const arriba = llena ? y : y + medio;
      const contornoDeLaSolapa = (yAbajo) => doc.moveTo(x, yAbajo).lineTo(x, arriba + r).bezierCurveTo(x, arriba + c, x + c, arriba, x + r, arriba)
        .lineTo(d - r, arriba).bezierCurveTo(d - c, arriba, d, arriba + c, d, arriba + r).lineTo(d, yPanel);
      const tapaLaEsquina = [[x, yPanel], [x + PANEL.radio, yPanel], [x + PANEL.radio, yPanel + PANEL.radio], [x, yPanel + PANEL.radio]];
      doc.save();
      if (llena) {
        doc.roundedRect(IZQUIERDA, yPanel, CONTENIDO, altoDelPanel, PANEL.radio).fill(COLOR.acentoSuave);
        doc.polygon(...tapaLaEsquina).fill(COLOR.acentoSuave);
        contornoDeLaSolapa(yPanel).closePath().fill(COLOR.tinta);
      } else {
        doc.lineWidth(PANEL.borde);
        doc.roundedRect(x, yPanel, CONTENIDO - PANEL.borde, altoDelPanel, PANEL.radio).fillAndStroke(COLOR.blanco, COLOR.tinta);
        doc.polygon(...tapaLaEsquina.map(([px, py], i) => [i === 0 || i === 3 ? px - medio : px, i < 2 ? py - PANEL.borde : py])).fill(COLOR.blanco);
        doc.polygon([x, yPanel - PANEL.borde], [d - medio, yPanel - PANEL.borde], [d - medio, yPanel + PANEL.borde], [x, yPanel + PANEL.borde]).fill(COLOR.blanco);
        contornoDeLaSolapa(yPanel + PANEL.radio).stroke(COLOR.tinta);
      }
      doc.restore();
      renglon(doc, nombre, IZQUIERDA + SOLAPA.texto, yTexto, {
        ancho: anchoDeLaSolapa, tamano: SOLAPA.letra, fuente: NEGRITA, color: llena ? COLOR.blanco : COLOR.tinta, espaciado: SOLAPA.espaciado
      });
      const xFrase = IZQUIERDA + anchoDeLaSolapa + SOLAPA.luz;
      const anchoDeLaFrase = CONTENIDO - anchoDeLaSolapa - SOLAPA.luz - SOLAPA.anchoDeLaDerecha;
      renglon(doc, FRASES_DE_LA_GESTION[gestion], xFrase, yTexto, { ancho: anchoDeLaFrase, tamano: SOLAPA.letraDeAlLado, color: COLOR.gris });
      renglon(doc, combinacion, IZQUIERDA + CONTENIDO - SOLAPA.anchoDeLaDerecha, yTexto, {
        ancho: SOLAPA.anchoDeLaDerecha, tamano: SOLAPA.letraDeAlLado, color: COLOR.gris, align: 'right'
      });
      contenido.dibujar(yPanel + PANEL.arriba, IZQUIERDA + (CONTENIDO - ANCHO_DEL_RECUADRO) / 2);
      return y + alto + (llena ? AIRE_ENTRE_GESTIONES : ENTRE);
    }
  };
};

// =====================================================
// Los resultados del año (las tres tarjetas de la pestaña, en tres columnas)
// =====================================================

const tituloDeColumna = (doc, t) => pieza(doc, t, { ancho: ANCHO_COLUMNA, tamano: LETRA.columna, fuente: NEGRITA, color: COLOR.tinta, lineas: 1 });
const textoDeColumna = (doc, t, { color = COLOR.tinta, tamano = LETRA.texto, lineas = 6 } = {}) => pieza(doc, t, { ancho: ANCHO_COLUMNA, tamano, color, lineas });
const heroe = (doc, valor, de) => piezaDeCifra(doc, { numero: cuenta(valor), lado: de }, {
  ancho: ANCHO_COLUMNA, tamano: LETRA.heroe, min: LETRA.heroeMin, tamanoLado: LETRA.de, color: COLOR.tinta, fuenteLado: NORMAL
});

// Actualizados a tiempo: «5 de 33 ciclos» con el medidor, qué es estar a tiempo, cuánto después se cargaron los otros y el desglose por
// gestión; sin casos, el texto del servidor
const columnaATiempo = (doc, a, t) => {
  const titulo = tituloDeColumna(doc, T.titulos.aTiempo);
  if (texto(t.vacio)) return apilar([titulo, textoDeColumna(doc, t.vacio, { color: COLOR.gris })], 5);
  const despues = texto(objeto(a.despues).texto);
  return apilar([
    titulo, heroe(doc, a.a_tiempo, t.de), piezaDeMedidor(doc, t.medidor, ANCHO_COLUMNA),
    textoDeColumna(doc, despues ? `${T.aTiempo} ${despues}` : T.aTiempo), textoDeColumna(doc, textoDelDesglose(a), { color: COLOR.gris })
  ], 4);
};

// Cobertura del aviso: «34 de 35 vencimientos» con el medidor, qué es estar avisado y los que faltan, con su vencimiento y su motivo
// (si son muchísimos, los que entran y «y N más.»); sin vencimientos, el texto del servidor
const columnaDeCobertura = (doc, c, t) => {
  const titulo = tituloDeColumna(doc, T.titulos.cobertura);
  if (texto(t.vacio)) return apilar([titulo, textoDeColumna(doc, t.vacio, { color: COLOR.gris })], 5);
  const faltan = lista(c.faltan).filter(esObjeto);
  const items = [];
  let alto = 0;
  for (const [i, f] of faltan.entries()) {
    const item = textoDeColumna(doc, textoDeLoQueFalta(f), { lineas: 3 });
    if (alto + item.alto > ALTO_MAXIMO_DE_LA_LISTA && i < faltan.length - 1) {
      items.push(textoDeColumna(doc, `y ${faltan.length - i} más.`, { color: COLOR.gris }));
      break;
    }
    items.push(item);
    alto += item.alto + 3;
  }
  return apilar([
    titulo, heroe(doc, c.si, t.de), piezaDeMedidor(doc, t.medidor, ANCHO_COLUMNA), textoDeColumna(doc, t.regla),
    ...(items.length && texto(t.faltan) ? [textoDeColumna(doc, t.faltan, { color: COLOR.gris }), apilar(items, 3)] : [])
  ], 4);
};

// Reiteraciones por ciclo: del RPAD a la DGMIT (Ninguna, 1 y 2 o más) y de la DGMIT al área (Ninguna y 1 o más), cada grupo con su
// título del servidor y, sin nada que mostrar, por qué; debajo de las del RPAD, la aclaración de los emails viejos si el servidor la manda
const columnaDeReiteraciones = (doc, r, t) => {
  const rpad = objeto(r.rpad);
  const dgmit = esObjeto(r.dgmit) ? r.dgmit : null;
  const mini = (valor, color) => pieza(doc, valor, { ancho: ANCHO_COLUMNA, tamano: LETRA.mini, fuente: NEGRITA, color, lineas: 2 });
  const barras = (grupos, datos) => piezaDeBarras(doc, grupos.map(([clave, nombre]) => [nombre, datos[clave]]), { ancho: ANCHO_COLUMNA, anchoTexto: 42 });
  const delRpad = texto(t.rpad_vacio) ? textoDeColumna(doc, t.rpad_vacio, { color: COLOR.gris }) : barras(T.gruposDelRpad, rpad);
  const deLaDgmit = texto(t.dgmit_vacio) || dgmit === null ? textoDeColumna(doc, t.dgmit_vacio, { color: COLOR.gris }) : barras(T.gruposDeLaDgmit, dgmit);
  return apilar([
    tituloDeColumna(doc, T.titulos.reiteraciones),
    mini(t.rpad, COLOR.tinta), delRpad, textoDeColumna(doc, t.aclaracion, { color: COLOR.gris, tamano: LETRA.notaDeColumna }),
    mini(t.dgmit, VIOLETA), deLaDgmit, textoDeColumna(doc, T.pieDeLasReiteraciones, { color: COLOR.gris, tamano: LETRA.notaDeColumna })
  ], 4);
};

// Los resultados del año (vista.resultados), con las dos gestiones juntas: tres columnas, cada una con una línea fina arriba
const piezaDeResultados = (doc, resultados) => {
  const textos = objeto(resultados.textos);
  const columnas = [
    columnaATiempo(doc, objeto(resultados.a_tiempo), objeto(textos.a_tiempo)),
    columnaDeCobertura(doc, objeto(resultados.cobertura), objeto(textos.cobertura)),
    columnaDeReiteraciones(doc, objeto(resultados.reiteraciones), objeto(textos.reiteraciones))
  ];
  const sobre = 6;
  return {
    alto: sobre + Math.max(...columnas.map((c) => c.alto)),
    dibujar: (y, x) => columnas.forEach((columna, i) => {
      const xColumna = x + i * (ANCHO_COLUMNA + SEPARACION_COLUMNAS);
      filete(doc, xColumna, y, ANCHO_COLUMNA);
      columna.dibujar(y + sobre, xColumna);
    })
  };
};

// =====================================================
// Los casos destildados
// =====================================================

// Una fecha con, debajo, lo que dice el servidor (los textos que no están vacíos, con « · »)
const celdaDeFecha = (dia, textos) => {
  const debajo = textos.map(texto).filter(Boolean).join(' · ');
  return debajo ? `${fechaCorta(dia)}\n${debajo}` : fechaCorta(dia);
};

// Las líneas de una celda de los destildados: la fecha y, debajo, la frase del servidor («221 días hábiles desde que se recibió», con
// su origen o lo que fue el aviso), que no se corta (spec 2026-11-05-metricas-frase-en-los-casos, 9). Con 5, un título y un área largos
// ya se cortan. Las de las otras tablas, las de siempre
const LINEAS_DE_LOS_DESTILDADOS = 6;

// Los casos destildados (los ciclos de los datasets que no cuentan: vista.casos con `contar` false), de las dos gestiones, con las
// columnas de la lista de casos de la pestaña y la gestión; sin destildados, nada
const elementosDeLosDestildados = (doc, vista) => {
  const filas = lista(vista.casos).filter((fila) => esObjeto(fila) && fila.contar === false);
  if (filas.length === 0) return [];
  const tabla = prepararTabla(doc, {
    lineas: LINEAS_DE_LOS_DESTILDADOS,
    columnas: [
      { titulo: 'Dataset', ancho: 2.9 }, { titulo: 'Gestión', ancho: 0.95 }, { titulo: 'Vencimiento', ancho: 1.15 }, { titulo: 'Aviso', ancho: 2 },
      { titulo: 'Nota DGMIT', ancho: 1.35 }, { titulo: 'Recibido el', ancho: 1.45 }, { titulo: 'Carga', ancho: 1.1 }
    ],
    filas: filas.map((fila) => {
      const aviso = objeto(fila.aviso);
      const nota = objeto(fila.nota);
      const recibido = objeto(fila.recibido);
      const carga = objeto(fila.carga);
      const debajoDeLaNota = [nota.tipo, nota.texto].map(texto).filter(Boolean).join(' · ');
      const celdaDeNota = texto(nota.numero) ? [texto(nota.numero), debajoDeLaNota].filter(Boolean).join('\n')
        : ['—', texto(nota.texto)].filter(Boolean).join('\n');
      return [
        [texto(fila.titulo), texto(fila.area)].filter(Boolean).join('\n'),
        fila.gestion === 'interna' ? 'Interna' : 'Externa',
        fechaCorta(fila.vencimiento),
        celdaDeFecha(aviso.fecha, [aviso.texto, aviso.que]),
        fila.gestion === 'interna' ? '—' : celdaDeNota,
        celdaDeFecha(recibido.fecha, [recibido.texto, recibido.origen]),
        celdaDeFecha(carga.fecha, [carga.texto])
      ];
    })
  });
  return [[prepararSeccion(doc, { titulo: `Los casos destildados (${filas.length})`, derecha: 'No cuentan en ninguna cifra de este PDF' }), tabla]];
};

// =====================================================
// El contexto
// =====================================================

// El índice de actualización mes a mes (contexto.indice) como gráfico de línea, una sola serie: un punto por cada día que manda el
// servidor (el primero de cada mes y hoy), los que no tienen tasa no se dibujan y cortan la línea. El PDF no tiene el mouse de la
// pestaña: cada punto lleva su valor arriba (si se pisaría con el de al lado, va el más nuevo) y debajo su mes (si se pisa con el
// anterior, un renglón más abajo)
const piezaDelIndice = (doc, indice, anchoDelGrafico) => {
  const puntos = lista(indice).filter((p) => esObjeto(p) && typeof p.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dia));
  const conTasa = puntos.filter((p) => esNumero(p.tasa));
  if (conTasa.length === 0) return null;
  const alto = GRAFICO.arriba + GRAFICO.alto + GRAFICO.abajo;
  return {
    alto,
    dibujar: (y, x) => {
      const x0 = x + GRAFICO.izquierda;
      const x1 = x + anchoDelGrafico;
      const xDelDia = (dia) => x0 + GRAFICO.aire
        + ((Number(dia.slice(5, 7)) - 1 + (Number(dia.slice(8, 10)) - 1) / 31) / 12) * (x1 - x0 - 2 * GRAFICO.aire);
      const cero = y + GRAFICO.arriba + GRAFICO.alto;
      const yDe = (tasa) => cero - (Math.min(100, Math.max(0, tasa)) * GRAFICO.alto) / 100;
      for (const valor of [0, 25, 50, 75, 100]) {
        doc.save();
        doc.lineWidth(valor === 0 ? 0.8 : 0.5).moveTo(x0, yDe(valor)).lineTo(x1, yDe(valor)).stroke(valor === 0 ? COLOR.grisClaro : COLOR.linea);
        doc.restore();
        renglon(doc, `${valor}%`, x, desdeBase(yDe(valor) + (ASCENDENTE * LETRA.indice) / 2, LETRA.indice),
          { ancho: GRAFICO.izquierda - 4, tamano: LETRA.indice, color: COLOR.gris, align: 'right' });
      }
      // La línea, cortada donde falta un valor
      const tramos = [[]];
      for (const p of puntos) {
        if (esNumero(p.tasa)) tramos.at(-1).push(p);
        else if (tramos.at(-1).length) tramos.push([]);
      }
      for (const tramo of tramos.filter((t) => t.length > 1)) {
        doc.save();
        doc.lineWidth(1.6).moveTo(xDelDia(tramo[0].dia), yDe(tramo[0].tasa));
        for (const p of tramo.slice(1)) doc.lineTo(xDelDia(p.dia), yDe(p.tasa));
        doc.stroke(COLOR.acento);
        doc.restore();
      }
      const ultimo = conTasa.at(-1);
      for (const p of conTasa) doc.circle(xDelDia(p.dia), yDe(p.tasa), p === ultimo ? 3.2 : 2.4).fill(COLOR.acento);
      // Los valores, del más nuevo al más viejo: uno que se pisaría con uno ya escrito no va
      const escritos = [];
      for (const p of [...conTasa].reverse()) {
        const valor = `${p.tasa}%`;
        const ancho = doc.font(NEGRITA).fontSize(LETRA.indice).widthOfString(valor) + 1;
        const cx = xDelDia(p.dia);
        const caja = [cx - ancho / 2, cx + ancho / 2, yDe(p.tasa) - 4 - OJO * LETRA.indice, yDe(p.tasa) - 4];
        if (escritos.some(([a, b, c, d]) => caja[0] < b + 2 && a < caja[1] + 2 && caja[2] < d && c < caja[3])) continue;
        escritos.push(caja);
        renglon(doc, valor, caja[0], caja[2], { ancho, tamano: LETRA.indice, fuente: NEGRITA, color: COLOR.tinta, align: 'center' });
      }
      // Los meses (y «hoy»)
      let anterior = null;
      for (const p of puntos) {
        const etiqueta = texto(p.etiqueta);
        if (!etiqueta) continue;
        const ancho = doc.font(NORMAL).fontSize(LETRA.indice).widthOfString(etiqueta) + 1;
        const cx = xDelDia(p.dia);
        const abajo = anterior !== null && !anterior.abajo && cx - ancho / 2 < anterior.fin + 2;
        renglon(doc, etiqueta, cx - ancho / 2, cero + 4 + (abajo ? OJO * LETRA.indice + 2 : 0), { ancho, tamano: LETRA.indice, color: COLOR.gris, align: 'center' });
        anterior = { fin: cx + ancho / 2, abajo };
      }
    }
  };
};

// El contexto (spec 2.2; spec 2026-11-05-metricas-pdf-apaisado, 5), en dos columnas: a la izquierda, el índice mes a mes (con el valor de hoy a la
// derecha del título; si no hay nada que dibujar, lo que dice el servidor) con su pie; a la derecha, la antigüedad de los vencidos, en barras
// ámbar, y debajo la doble verificación, con los textos del servidor. Los grupos de dibujarParte (también los usa el Informe anual, que lleva su
// propio pie del índice: services/reportesInformeAnualPdf.js)
const CONTEXTO = { indice: 470, luz: 16, entre: 5, entreBloques: 12 };
export const elementosDelContexto = (doc, contexto, trabajo, { pieDelIndice = T.pieDelIndice } = {}) => {
  const indice = lista(contexto.indice).filter(esObjeto);
  const vacio = texto(contexto.indice_vacio);
  const anchoDerecha = CONTENIDO - CONTEXTO.indice - CONTEXTO.luz;
  const grafico = vacio ? null : piezaDelIndice(doc, indice, CONTEXTO.indice);
  const antiguedad = objeto(contexto.antiguedad);
  const textos = objeto(antiguedad.textos);
  const grupos = [antiguedad.menos_de_3_meses, antiguedad.de_3_a_12, antiguedad.mas_de_un_anio].map((n, i) => [T.antiguedad[i], n]);
  const delTrabajo = objeto(objeto(trabajo).textos);
  const izquierda = apilar([
    prepararSeccion(doc, { titulo: T.titulos.indice, derecha: texto(indice.at(-1)?.texto), ancho: CONTEXTO.indice }),
    grafico ?? pieza(doc, vacio || 'No hay datos para dibujar el índice.', { ancho: CONTEXTO.indice, tamano: LETRA.texto, color: COLOR.tinta, lineas: 4 }),
    pieza(doc, pieDelIndice, { ancho: CONTEXTO.indice, tamano: LETRA.pie, color: COLOR.gris, lineas: 3 })
  ], CONTEXTO.entre);
  const derecha = apilar([
    apilar([
      prepararSeccion(doc, { titulo: T.titulos.antiguedad, derecha: texto(textos.titulo), ancho: anchoDerecha }),
      piezaDeBarras(doc, grupos, { ancho: anchoDerecha, anchoTexto: 78, color: BARRA_AMBAR }),
      pieza(doc, textos.inicio, { ancho: anchoDerecha, tamano: LETRA.texto, color: COLOR.tinta, lineas: 3 }),
      pieza(doc, T.pieDeLaAntiguedad, { ancho: anchoDerecha, tamano: LETRA.pie, color: COLOR.gris, lineas: 3 })
    ], CONTEXTO.entre),
    apilar([
      prepararSeccion(doc, { titulo: T.titulos.auditoria, ancho: anchoDerecha }),
      pieza(doc, delTrabajo.auditoria, { ancho: anchoDerecha, tamano: LETRA.texto, color: COLOR.tinta, lineas: 3 }),
      pieza(doc, T.pieDeLaAuditoria, { ancho: anchoDerecha, tamano: LETRA.pie, color: COLOR.gris, lineas: 2 })
    ], CONTEXTO.entre)
  ], CONTEXTO.entreBloques);
  const alto = Math.max(izquierda.alto, derecha.alto);
  return [[{
    alto,
    dibujar: (y) => {
      izquierda.dibujar(y, IZQUIERDA);
      derecha.dibujar(y, IZQUIERDA + CONTEXTO.indice + CONTEXTO.luz);
      return y + alto + ENTRE;
    }
  }]];
};

// =====================================================
// El trabajo del RPAD
// =====================================================

// Las métricas manuales de Gestión del año (spec 2.2; las carga administración), como la pestaña (htmlDeMetricasManuales): una fila por
// métrica, con su tipo, su mes y su cantidad, en el orden en que llegan; las de otro año no van, y sin ninguna, lo dice
const elementoDeLasManuales = (doc, manuales, anio) => {
  const delAnio = lista(manuales).filter((m) => esObjeto(m) && Number(m.anio) === anio);
  if (delAnio.length === 0) return prepararParrafo(doc, textoSinManuales(anio), { color: COLOR.tinta });
  return prepararTabla(doc, {
    columnas: [{ titulo: 'Tipo', ancho: 3 }, { titulo: 'Mes', ancho: 2 }, { titulo: 'Cantidad', ancho: 1 }],
    filas: delAnio.map((m) => [
      Object.hasOwn(T.tiposManuales, m.tipo) ? T.tiposManuales[m.tipo] : texto(m.tipo), textoDelMesManual(m.mes, anio), cuenta(Number(m.cantidad))
    ])
  });
};

// Los cinco totales en tarjetas, con su texto del servidor (en singular o en plural); por mes, las tres series de la pestaña en una
// tabla (la pestaña muestra una por vez, con chips), con los meses que manda el servidor, y las métricas manuales. La doble verificación va
// con el contexto. Los grupos de dibujarParte. El Informe anual (services/reportesInformeAnualPdf.js) los dibuja sin las métricas manuales
// (`conManuales` false: no están en la foto del 31/12)
export const elementosDelTrabajo = (doc, trabajo, manuales, anio, { conManuales = true } = {}) => {
  const textos = objeto(trabajo.textos);
  const totales = objeto(textos.totales);
  const meses = lista(textos.meses).map(texto);
  const porMes = objeto(trabajo.por_mes);
  const tabla = prepararTabla(doc, {
    columnas: [{ titulo: '', ancho: 3.2 }, ...meses.map((mes) => ({ titulo: mes, ancho: 1 }))],
    filas: meses.length === 0 ? [] : T.series.map(([clave, nombre]) => [nombre, ...meses.map((_, i) => cuenta(lista(porMes[clave])[i]))])
  });
  return [
    [
      prepararSeccion(doc, { titulo: T.titulos.trabajo, derecha: T.bajadaDelTrabajo(anio) }),
      prepararTarjetas(doc, TOTALES.map((clave) => ({ valor: cuenta(trabajo[clave]), rotulo: texto(totales[clave]) })))
    ],
    ...(meses.length ? [[prepararSeccion(doc, { titulo: T.titulos.porMes }), tabla]] : []),
    ...(conManuales ? [[prepararSeccion(doc, { titulo: T.titulos.manuales }), elementoDeLasManuales(doc, manuales, anio)]] : [])
  ];
};

// =====================================================
// Áreas y temas
// =====================================================

// "83%", o una raya si no hay nada que medir (null: el área solo tiene eventuales; la de la pestaña)
const textoPorcentaje = (valor) => (esNumero(valor) ? `${valor}%` : '—');

// Lo que va en cada fila del ranking y en su encabezado (spec 2026-11-05-metricas-pdf-apaisado, 5). «Cumplimiento» en negrita mide unos 51 puntos
const RANKING = { letra: 7.6, letraDelEncabezado: 6.6, aire: 3.5, altoDelEncabezado: 13, lineas: 4, numero: 18, datasets: 122, alDia: 84, cumplimiento: 54 };
const COLUMNAS_DEL_RANKING = Object.freeze(['#', 'Área', 'Datasets', 'Al día', 'Cumplimiento']);
// Lo que queda debajo de los temas, antes de las frecuencias
const AIRE_ENTRE_BARRAS = 12;

// Las hojas de las áreas, que también dibuja el Informe anual: el ranking (la regla de cumplimientoPorArea, del servidor) en dos columnas, que sigue en
// otra hoja si hace falta, con su encabezado arriba de cada una, y los datasets por tema y por frecuencia en barras (la pestaña los muestra de a uno,
// con un chip), en la columna libre o en una hoja nueva; si una lista está vacía, lo que dice el servidor. `titulo(texto)`: el título de la hoja, con su rótulo
export const dibujarLasAreas = (doc, hoja, areas, { titulo }) => {
  const a = objeto(areas);
  const ranking = lista(a.ranking).filter(esObjeto);
  const vacios = objeto(a.vacios);
  const flujo = nuevoFlujo(doc, dibujarParte(doc, hoja, titulo(T.titulos.areas), [[prepararSeccion(doc, { titulo: T.titulos.ranking, derecha: T.alDia })]]));
  const { ancho } = flujo;
  const xs = [0, RANKING.numero, ancho - RANKING.datasets, ancho - RANKING.alDia, ancho - RANKING.cumplimiento];
  const celda = (valor, x, y, ancho_) => renglon(doc, valor, x, y, { ancho: ancho_, tamano: RANKING.letra });
  const fila = (area, i) => {
    const nombre = ajustar(doc, texto(area.area), { ancho: xs[2] - xs[1] - 6, lineas: RANKING.lineas, max: RANKING.letra, min: RANKING.letra });
    const alto = nombre.alto + 2 * RANKING.aire;
    return {
      alto,
      dibujar: (y, x) => {
        const yTexto = y + RANKING.aire;
        celda(String(i + 1), x + xs[0], yTexto, xs[1] - xs[0] - 2);
        escribir(doc, nombre, x + xs[1], yTexto, COLOR.tinta);
        celda(cuenta(area.total_datasets), x + xs[2], yTexto, xs[3] - xs[2] - 2);
        celda(cuenta(area.al_dia), x + xs[3], yTexto, xs[4] - xs[3] - 2);
        celda(textoPorcentaje(area.porcentaje), x + xs[4], yTexto, ancho - xs[4]);
        filete(doc, x, y + alto, ancho);
      }
    };
  };
  flujo.cabeza({
    alto: RANKING.altoDelEncabezado,
    dibujar: (y, x) => {
      COLUMNAS_DEL_RANKING.forEach((t, k) => renglon(doc, t, x + xs[k], y, {
        ancho: (xs[k + 1] ?? ancho) - xs[k] - (k === COLUMNAS_DEL_RANKING.length - 1 ? 0 : 2), tamano: RANKING.letraDelEncabezado, fuente: NEGRITA, color: COLOR.acento
      }));
      filete(doc, x, y + RANKING.altoDelEncabezado - 1, ancho, COLOR.grisClaro);
    }
  });
  if (ranking.length === 0) flujo.poner(pieza(doc, T.sinAreas, { ancho, tamano: LETRA.texto, color: COLOR.tinta, lineas: 2 }), { sinCabeza: true });
  ranking.forEach((area, i) => flujo.poner(fila(area, i)));
  const barras = (clave, tituloDeLaSeccion) => {
    const filas = lista(a[clave]).filter((f) => Array.isArray(f) && esNumero(f[1]));
    const cuerpo = texto(vacios[clave]) || filas.length === 0
      ? pieza(doc, texto(vacios[clave]) || 'Sin datasets.', { ancho, tamano: LETRA.texto, color: COLOR.tinta, lineas: 3 })
      : piezaDeBarras(doc, filas, { ancho, anchoTexto: 130 });
    return apilar([prepararSeccion(doc, { titulo: tituloDeLaSeccion, ancho }), cuerpo, { alto: AIRE_ENTRE_BARRAS - 5, dibujar: () => {} }], 5);
  };
  flujo.cabeza(null);
  flujo.saltarColumna();
  flujo.poner(barras('temas', 'Datasets por tema'));
  flujo.poner(barras('frecuencias', 'Datasets por frecuencia'));
};

// =====================================================
// El PDF
// =====================================================

// Una parte del PDF desde una hoja nueva: el título de la parte va junto con su primer grupo, y después cada grupo de elementos, uno
// debajo del otro y cada uno junto en una hoja (dibujarJuntos: una sección con lo primero que le sigue). Devuelve la y de lo que sigue
// (el Informe anual dibuja los logros debajo)
export const dibujarParte = (doc, hoja, titulo, grupos) => {
  const [primero = [], ...resto] = grupos;
  return [[titulo, ...primero], ...resto].reduce((yGrupo, grupo) => dibujarJuntos(doc, yGrupo, grupo), agregarHoja(doc, hoja));
};

// El elemento del título de una hoja con lo que va arriba a la derecha: `dibujarDerecha(y)` recibe la y del título. También lo usa el Informe anual
export const tituloConDerecha = (elTitulo, dibujarDerecha) => ({
  alto: elTitulo.alto,
  dibujar: (y) => {
    dibujarDerecha(y);
    return elTitulo.dibujar(y);
  }
});

// La píldora arriba a la derecha, en la línea del rótulo, sobre el margen
export const ponerArribaALaDerecha = (pildora, y) => pildora.dibujar(y - 6, IZQUIERDA + CONTENIDO - pildora.ancho);

// La hoja del circuito (spec 2026-11-05-metricas-pdf-apaisado, 5), que también dibuja el Informe anual: el título, la píldora con la combinación y lo
// destildado, de dónde sale un año cerrado y los recuadros de las dos gestiones, con la letra más grande con la que entran en la hoja. Si con la más
// chica tampoco entran, la interna pasa entera a la hoja siguiente. Es igual con los dos selectores: primero los días corridos (circuitoDeLaHoja; spec
// 2026-11-06-metricas-anticipacion-y-corridos, 6). `datos`: los de renderMetricasDelAnio; `estadistico` y `dias`, ya leídos;
// `titulo(texto)`: el título de la hoja, con su rótulo
export const dibujarElCircuito = (doc, hoja, datos, { estadistico, dias, titulo }) => {
  const d = objeto(datos);
  const conLosSelectores = { ...d, estadistico, dias };
  const { tramos, habiles } = circuitoDeLaHoja(d);
  const combinacion = textoDeLaCombinacion(conLosSelectores);
  const destildados = lista(d.sin_titulos).some((t) => typeof t === 'string' && t);
  const pildora = prepararPildora(doc, textoDeLaPildora(conLosSelectores), {
    tono: destildados ? 'sol' : 'azul', anchoMaximo: CONTENIDO - LUGAR_DEL_ROTULO
  });
  const origen = textoDeDondeSale(d);
  const deDondeSale = origen ? ajustar(doc, origen, {
    ancho: DE_DONDE_SALE.ancho, lineas: 2, max: DE_DONDE_SALE.letra, min: DE_DONDE_SALE.letra, opciones: { align: 'right' }
  }) : null;
  const cabezal = tituloConDerecha(titulo(TITULO_DEL_CIRCUITO), (y) => {
    ponerArribaALaDerecha(pildora, y);
    if (deDondeSale) escribir(doc, deDondeSale, IZQUIERDA + CONTENIDO - DE_DONDE_SALE.ancho, y + DE_DONDE_SALE.sobre, COLOR.tinta);
  });
  const gestiones = GESTIONES.filter((gestion) => Array.isArray(tramos[gestion]));
  const recuadrosCon = (letra) => gestiones.map((gestion) => prepararGestion(doc, {
    gestion, combinacion, contenido: piezaDelCircuito(doc, tramos[gestion], gestion, letra, { enHabiles: objeto(habiles)[gestion], estadistico })
  }));
  const yHoja = agregarHoja(doc, hoja);
  const entran = (recuadros) => yHoja + cabezal.alto + ENTRE
    + recuadros.reduce((total, r, i) => total + r.alto + (i < recuadros.length - 1 ? AIRE_ENTRE_GESTIONES : 0), 0) <= limiteDe(doc);
  const recuadros = LETRAS_DEL_CIRCUITO.map(recuadrosCon).find(entran) ?? recuadrosCon(LETRAS_DEL_CIRCUITO.at(-1));
  const [primero, ...resto] = recuadros;
  return resto.reduce((y, recuadro) => dibujarJuntos(doc, y, [recuadro]), dibujarJuntos(doc, yHoja, primero ? [cabezal, primero] : [cabezal]));
};

// «Cómo se cuenta»: el texto de siempre y, debajo, los comentarios de cada gestión, con su nombre. Una gestión sin comentarios no lleva su nombre
const prepararComoSeCuenta = (doc, circuito, dias) => {
  const deLaGestion = (gestion) => {
    const textos = aclaracionesDe(circuito, gestion);
    if (textos.length === 0) return null;
    return apilar([
      pieza(doc, `Gestión ${gestion}`.toUpperCase(), { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.rotuloDeGestion, fuente: NEGRITA, color: COLOR.tinta, lineas: 1 }),
      ...textos.map((t) => pieza(doc, t, { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.aclaracion, color: COLOR.gris, lineas: 4 }))
    ], 2);
  };
  return prepararRecuadro(doc, {
    rotulo: 'Cómo se cuenta',
    contenido: apilar([
      prepararParrafo(doc, `${T.bajada[dias]} ${T.pieDelCircuito} ${EN_EL_ANIO} ${SIGLAS}`, { ancho: ANCHO_DEL_RECUADRO, tamano: LETRA.aclaracion }),
      ...GESTIONES.map(deLaGestion)
    ], 7)
  }, { tono: 'gris' });
};

// La hoja de los resultados, que también dibuja el Informe anual: el título con su bajada, las tres columnas, «Cómo se cuenta» y, con `conDestildados`, los
// casos destildados. Si «Cómo se cuenta» no entra debajo de los resultados, pasa a la hoja siguiente con el título repetido: no viaja con ellos porque
// juntos pueden no entrar en una hoja, y un grupo más alto que una hoja se saldría. `titulo(texto)`: el título de la hoja, con su rótulo
export const dibujarLosResultados = (doc, hoja, datos, { anio, dias, titulo, conDestildados }) => {
  const d = objeto(datos);
  const vista = objeto(d.vista);
  const cabezal = tituloConDerecha(titulo(T.titulos.resultados), (y) => renglon(doc, T.bajadaDeResultados(anio), IZQUIERDA + CONTENIDO - BAJADA.ancho, y + BAJADA.sobre, {
    ancho: BAJADA.ancho, tamano: BAJADA.letra, color: COLOR.gris, align: 'right'
  }));
  const yResultados = dibujarParte(doc, hoja, cabezal, esObjeto(vista.resultados) ? [[comoElemento(piezaDeResultados(doc, vista.resultados))]] : []);
  const como = prepararComoSeCuenta(doc, objeto(vista.circuito), dias);
  const yComo = yResultados + como.alto <= limiteDe(doc) ? como.dibujar(yResultados) : dibujarParte(doc, hoja, titulo(T.titulos.resultados), [[como]]);
  return (conDestildados ? elementosDeLosDestildados(doc, vista) : []).reduce((y, grupo) => dibujarJuntos(doc, y, grupo), yComo);
};

// El PDF de Métricas del año. `datos`: lo de metricasDe (controllers/metricasController.js: anio, al, en_vivo, aviso_foto, anios, vista,
// cinta, contexto, trabajo, areas y sin_titulos) más la combinación con que se pidió (`estadistico` y `dias`, las de la consulta), el circuito
// en las dos unidades, para la hoja 1 (`circuito_en_corridos` y `circuito_en_habiles`, que GET /api/metricas no manda) y las
// métricas manuales de Gestión del año (`manuales`: [{ tipo, anio, mes, cantidad }], que no son de metricasDe); `generado`: { momento: 'AAAA-MM-DD HH:MM:SS' (hora argentina; su día va en el encabezado), por: nombre corto o null } (el pie).
export const renderMetricasDelAnio = async (datos, { generado }) => {
  const d = objeto(datos);
  const anio = Number.isInteger(d.anio) ? d.anio : Number(texto(d.al).slice(0, 4));
  const estadistico = elegido(d.estadistico, ESTADISTICOS);
  const dias = elegido(d.dias, DIAS);
  const nombre = `Métricas del RPAD · ${anio}`;
  const doc = nuevoReporte({ titulo: `Métricas del RPAD ${anio}`, hoja: HOJA });
  const hoja = { derecha: nombre, fecha: texto(generado?.momento).slice(0, 10) };
  const rotulo = rotuloDelAnio({ ...d, anio });
  const titulo = (t) => prepararTitulo(doc, { rotulo, titulo: t });

  // 1. El circuito de las dos gestiones
  dibujarElCircuito(doc, hoja, d, { estadistico, dias, titulo });

  // 2. Los resultados, «Cómo se cuenta» y los casos destildados
  dibujarLosResultados(doc, hoja, d, { anio, dias, titulo, conDestildados: true });

  // 3. El contexto y el trabajo del RPAD
  dibujarParte(doc, hoja, titulo(TITULO_DEL_CONTEXTO), [
    ...elementosDelContexto(doc, objeto(d.contexto), objeto(d.trabajo)),
    ...elementosDelTrabajo(doc, objeto(d.trabajo), d.manuales, anio)
  ]);

  // 4. Áreas y temas
  dibujarLasAreas(doc, hoja, d.areas, { titulo });

  return cerrarReporte(doc, { generado, pieDe: (k, n) => `${nombre} · Hoja ${k} de ${n}` });
};
