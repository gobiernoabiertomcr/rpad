/**
 * Generador de Notas (spec 2026-10-24-generador-de-notas, sección 4): el contenido de la nota de la DGMIT a un área, interna
 * (a la Subsecretaría de Modernización y Transparencia, para que gestione ante un área del municipio) o externa (directo al
 * organismo), solicitud o reiteración. Puro: sin pool, sin Express y sin Date local; la fecha llega como texto 'AAAA-MM-DD'.
 *
 * Una sola fuente: la nota se arma una vez, como una lista de bloques, y de esa lista salen las dos salidas, la vista previa
 * (`renderHtmlDeBloques`, acá) y el Word (`renderDocx`, `services/notasWord.js`). Así no pueden decir cosas distintas. El Word
 * de una Nota Digital (`services/notasDigitalesWord.js`) arma los mismos bloques a partir de su HTML guardado.
 *
 * Los textos son los de la spec (4.2 interna, 4.3 externa, 4.4 reiteración y 4.5 la tabla), al pie de la letra. Los textos de
 * las áreas salen tal como están en la base (spec, sección 2). "de" + "el" es "del" y "a" + "el" es "al" (decisión del plan:
 * "dependiente del Ministerio…", "Al Instituto…"); "ante el" no se contrae.
 *
 * Las letras van en medios puntos y los espacios en twips (20 por punto), como los pide la librería `docx`. En el HTML, las dos
 * van en `em`, relativas a la letra del cuerpo (LETRA.cuerpo): la página de la vista previa le da a la hoja la letra que quiera
 * (achicada o en grande) y todo guarda la proporción del Word. Los bordes y el relleno de las celdas los pone la página, con la
 * clase `nota-tabla`.
 */
import { formatoLargo } from './notasDigitalesCalendario.js';
import { escapeHtml, QUE_SE_SOLICITA_POR_DEFECTO } from './notasDigitalesContenido.js';

/**
 * Un pedazo de texto con su formato.
 * @typedef {Object} Parte
 * @property {string} texto
 * @property {boolean} [negrita]
 * @property {boolean} [subrayado]
 * @property {boolean} [cursiva]
 * @property {boolean} [salto] Un renglón nuevo antes del texto (un <br> en el HTML).
 * @property {number} [letra] La letra en medios puntos (24 = 12 pt). Sin letra, la del párrafo o la de su celda.
 */

/**
 * Una celda de una tabla.
 * @typedef {Object} Celda
 * @property {Parte[]} partes
 * @property {number} [abarca] Cuántas columnas ocupa (colspan). Sin abarca, una.
 * @property {'gris'} [fondo] El fondo gris claro del encabezado.
 * @property {number} [letra] La letra de toda la celda, en medios puntos.
 */

/**
 * Una fila de una tabla.
 * @typedef {Object} Fila
 * @property {true} [encabezado] La fila de títulos (en el Word se repite arriba de cada hoja).
 * @property {Celda[]} celdas
 */

/**
 * Un párrafo. Los espacios, en twips; sin ellos, 0.
 * @typedef {Object} BloqueParrafo
 * @property {'parrafo'} tipo
 * @property {'izquierda'|'derecha'|'centro'|'justificado'} alinear
 * @property {Parte[]} partes
 * @property {number} [antes] El espacio antes del párrafo, en twips.
 * @property {number} [despues] El espacio después del párrafo, en twips.
 */

/**
 * Una tabla con bordes finos negros.
 * @typedef {Object} BloqueTabla
 * @property {'tabla'} tipo
 * @property {number[]} anchos Proporciones del ancho de cada columna, que suman 100.
 * @property {Fila[]} filas
 */

/**
 * Una lista con viñetas: cada ítem, sus partes.
 * @typedef {Object} BloqueLista
 * @property {'lista'} tipo
 * @property {Parte[][]} items
 */

/**
 * El espacio en blanco para firmar a mano: una firma (la nota de la DGMIT, siempre) o dos lado a lado (una Nota Digital
 * presentada por la persona autorizada durante la licencia del firmante).
 * @typedef {Object} BloqueFirma
 * @property {'firma'} tipo
 * @property {1|2} columnas
 */

/** @typedef {BloqueParrafo|BloqueTabla|BloqueLista|BloqueFirma} Bloque */

// Las letras de la nota, en medios puntos: Arial 12 en el cuerpo, 10 en la tabla y 9 en el "Qué se solicita" (spec 4.1)
export const LETRA = Object.freeze({ cuerpo: 24, tabla: 20, queSeSolicita: 18 });
// Proporciones de las tres columnas de la tabla: Conjunto de datos, Frecuencia y Datos solicitados (los de la maqueta)
export const ANCHOS_TABLA = Object.freeze([38, 24, 38]);
// "Datos solicitados" de un dataset sin pedido (eventual o sin fecha): spec 4.5
export const INFORMACION_SIN_PEDIDO = 'Información actualizada disponible';
// Los espacios después de cada párrafo, en twips: los de la maqueta y los del Word de antes del generador (100 a 400).
// - renglon: entre el REF y el número de la nota.
// - parrafo: después de cada párrafo del cuerpo.
// - trasLaTabla: antes del párrafo que sigue a la tabla (en Word la tabla no deja espacio debajo).
// - bloque: después del número, del destinatario, de la fecha y de PRESENTE (externa), y antes del remitente.
// Solo el párrafo que sigue a la tabla lleva espacio antes: en Word los dos espacios se suman y en el HTML se superponen, así
// que cada separación la pone uno solo de los dos párrafos.
export const ESPACIO = Object.freeze({ renglon: 100, parrafo: 200, trasLaTabla: 240, bloque: 400 });

// ---------------------------------------------------------------------------------------------------------------------------
// Los textos (spec 4.2 a 4.5)
// ---------------------------------------------------------------------------------------------------------------------------

const REF = 'Solicitud de datos para el Portal de Datos Abiertos Municipal';
const REF_REITERACION = `Reiteración – ${REF}`;
const SUBSECRETARIA = 'SUBSECRETARÍA DE MODERNIZACIÓN Y TRANSPARENCIA';
const REMITENTE = 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL';
const FORMATO = 'preferiblemente en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso:';
const CORREO_DATOS = 'datospublicos@comodoro.gov.ar';
const CORREO_MIT = 'mit@comodoro.gov.ar';
const ORDENANZA = 'conforme a lo establecido en la Ordenanza N° 17.662/23.';

// Interna (4.2): el primer párrafo, después del área y su dependencia
const PEDIDO_INTERNA = {
  solicitud: { verbo: 'gestionar', objeto: `la remisión de la siguiente información, ${FORMATO}` },
  reiteracion: { verbo: 'reiterar', objeto: `el pedido de la siguiente información, ${FORMATO}` }
};
const JUSTIFICACION = 'Justificación:';
const PARRAFO_ORDENANZA = 'Dicha solicitud se enmarca en el cumplimiento de la Ordenanza N° 17.662/23, que establece la necesidad de garantizar que los datos publicados en el portal de datos abiertos, datos.comodoro.gov.ar, mantengan su valor. Motivo por el cual resulta fundamental mantener actualizada la información disponible en el mencionado sitio.';
const CORREOS_INTERNA_FIN = '. Los mismos, una vez recibidos, serán publicados en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza, garantizando su disponibilidad en formatos abiertos y reutilizables para generar valor económico y social.';

// Externa (4.3)
const PRESENTE = 'PRESENTE';
const SALUDO = 'De nuestra consideración:';
const PRIMERO_EXTERNA = {
  solicitud: `Nos dirigimos a Uds. a fin de solicitarles tengan a bien brindar la siguiente información, ${FORMATO}`,
  reiteracion: `Nos dirigimos nuevamente a Uds. a fin de reiterar la solicitud de la siguiente información, ${FORMATO}`
};
const MOTIVA_INICIO = 'Motiva dicha solicitud la necesidad de actualizar y publicar los datasets disponibles en la página oficial de Datos Abiertos de la Municipalidad de Comodoro Rivadavia (';
const PORTAL = 'datos.comodoro.gov.ar';
const MOTIVA_FIN = '), en cumplimiento de la Ordenanza N° 17.662/23 y los principios de transparencia y acceso a la información pública que sustentan nuestras políticas de gobierno abierto.';
const QUEDAMOS = 'Quedamos a disposición para coordinar los detalles técnicos o administrativos necesarios.';
const DESPEDIDA = 'Sin más, saludamos a Uds. atentamente.';

// La tabla (4.5)
const COLUMNAS = ['Conjunto de datos', 'Frecuencia', 'Datos solicitados'];
const QUE_SE_SOLICITA = 'Qué se solicita:';

// ---------------------------------------------------------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------------------------------------------------------

const parrafo = (alinear, partes, espacios = {}) => ({ tipo: 'parrafo', alinear, partes, ...espacios });
const texto = (valor) => String(valor ?? '').trim();

// Los artículos de un área (enum 'el' | 'la' en la base; sin dato, "la", el valor por defecto de la columna)
const esEl = (articulo) => articulo === 'el';
const articuloDe = (articulo) => (esEl(articulo) ? 'el' : 'la');
const deArticulo = (articulo) => (esEl(articulo) ? 'del' : 'de la');
const aArticulo = (articulo) => (esEl(articulo) ? 'Al' : 'A la');

// "Nota N°" y el número tal cual o, sin número, "____/AA" con el año de la fecha de la nota
const numeroDeLaNota = (numero, fecha) => texto(numero) || `____/${fecha.slice(2, 4)}`;

const bloquesDeRef = (reiteracion, numero, fecha) => [
  parrafo('derecha', [{ texto: 'REF.:', negrita: true }, { texto: ` "${reiteracion ? REF_REITERACION : REF}"` }], { despues: ESPACIO.renglon }),
  parrafo('derecha', [{ texto: 'Nota N°', negrita: true }, { texto: ` ${numeroDeLaNota(numero, fecha)}` }], { despues: ESPACIO.bloque })
];

const correos = (inicio, fin) => [
  { texto: inicio }, { texto: CORREO_DATOS, subrayado: true }, { texto: ' o ' }, { texto: CORREO_MIT, subrayado: true }, { texto: fin }
];

/**
 * Las notas anteriores que cita una reiteración: "Nota N° 97/26", "Notas N° 88/26 y N° 102/26", "Notas N° a, N° b y N° c".
 * Sin ninguna (o sin lista), null.
 * @param {string[]} numeros
 * @returns {string|null}
 */
export const textoDeNotasAnteriores = (numeros) => {
  if (!Array.isArray(numeros) || numeros.length === 0) return null;
  if (numeros.length === 1) return `Nota N° ${numeros[0]}`;
  const citas = numeros.map(n => `N° ${n}`);
  return `Notas ${citas.slice(0, -1).join(', ')} y ${citas.at(-1)}`;
};

// El párrafo de la reiteración, después de la tabla (4.4), igual en la interna y en la externa
const textoDeReiteracion = (anteriores) => {
  const citadas = textoDeNotasAnteriores(anteriores);
  const informacion = citadas ? `solicitada mediante ${citadas}` : 'correspondiente';
  return `La presente reiteración se debe a que, al día de la fecha, no se ha recibido la información ${informacion}, ${ORDENANZA}`;
};

// La tabla (4.5): el encabezado y, por cada dataset en el orden recibido, su fila y debajo la del "Qué se solicita"
const tablaDeDatasets = (datasets) => {
  const celda = (valor) => ({ partes: [{ texto: valor }], letra: LETRA.tabla });
  const encabezado = {
    encabezado: true,
    celdas: COLUMNAS.map(c => ({ partes: [{ texto: c, negrita: true }], fondo: 'gris', letra: LETRA.tabla }))
  };
  const filas = datasets.flatMap(d => [
    { celdas: [celda(String(d.titulo ?? '')), celda(String(d.frecuencia ?? '')), celda(texto(d.datosSolicitados) || INFORMACION_SIN_PEDIDO)] },
    {
      celdas: [{
        partes: [{ texto: QUE_SE_SOLICITA, cursiva: true }, { texto: ` ${texto(d.queSeSolicita) || QUE_SE_SOLICITA_POR_DEFECTO}` }],
        abarca: COLUMNAS.length,
        letra: LETRA.queSeSolicita
      }]
    }
  ]);
  return { tipo: 'tabla', anchos: [...ANCHOS_TABLA], filas: [encabezado, ...filas] };
};

// La tabla y, en una reiteración, su párrafo: el que sigue a la tabla deja el espacio de debajo de ella
const tablaYReiteracion = (datasets, reiteracion, anteriores) => [
  tablaDeDatasets(datasets),
  ...(reiteracion
    ? [parrafo('justificado', [{ texto: textoDeReiteracion(anteriores) }], { antes: ESPACIO.trasLaTabla, despues: ESPACIO.parrafo })]
    : [])
];
// El espacio antes del primer párrafo fijo que sigue a la tabla: solo si no lo pone el de la reiteración
const trasLaTabla = (reiteracion) => (reiteracion ? {} : { antes: ESPACIO.trasLaTabla });

// ---------------------------------------------------------------------------------------------------------------------------
// Las dos notas
// ---------------------------------------------------------------------------------------------------------------------------

// Interna (4.2, con los cambios de la reiteración de 4.4)
const notaInterna = ({ reiteracion, fecha, numero, anteriores, area, datasets }) => {
  const dependencia = texto(area.area_superior);
  const { verbo, objeto } = PEDIDO_INTERNA[reiteracion ? 'reiteracion' : 'solicitud'];
  const deQuien = dependencia ? `, dependiente ${deArticulo(area.articulo_superior)} ${dependencia}, ` : ', ';
  return [
    ...bloquesDeRef(reiteracion, numero, fecha),
    parrafo('izquierda', [{ texto: SUBSECRETARIA, negrita: true, subrayado: true }], { despues: ESPACIO.bloque }),
    parrafo('justificado', [
      { texto: `Solicito a Ud. tenga a bien ${verbo} ante ${articuloDe(area.articulo)} ` },
      { texto: texto(area.nombre), negrita: true },
      { texto: `${deQuien}${objeto}` }
    ], { despues: ESPACIO.parrafo }),
    ...tablaYReiteracion(datasets, reiteracion, anteriores),
    parrafo('izquierda', [{ texto: JUSTIFICACION, negrita: true }], { ...trasLaTabla(reiteracion), despues: ESPACIO.parrafo }),
    parrafo('justificado', [{ texto: PARRAFO_ORDENANZA }], { despues: ESPACIO.parrafo }),
    parrafo('justificado', correos('Los datos solicitados pueden ser remitidos a los correos electrónicos ', CORREOS_INTERNA_FIN), { despues: ESPACIO.bloque }),
    parrafo('izquierda', [{ texto: REMITENTE, negrita: true, subrayado: true }, { texto: `, ${formatoLargo(fecha)}.` }]),
    { tipo: 'firma', columnas: 1 }
  ];
};

// Externa (4.3, con los cambios de la reiteración de 4.4)
const notaExterna = ({ reiteracion, fecha, numero, anteriores, area, datasets }) => [
  parrafo('derecha', [{ texto: `Comodoro Rivadavia, ${formatoLargo(fecha)}` }], { despues: ESPACIO.bloque }),
  parrafo('izquierda', [{ texto: aArticulo(area.articulo) }]),
  parrafo('izquierda', [{ texto: texto(area.nombre), negrita: true, subrayado: true }]),
  parrafo('izquierda', [{ texto: PRESENTE, negrita: true, subrayado: true }], { despues: ESPACIO.bloque }),
  ...bloquesDeRef(reiteracion, numero, fecha),
  parrafo('izquierda', [{ texto: SALUDO }], { despues: ESPACIO.parrafo }),
  parrafo('justificado', [{ texto: PRIMERO_EXTERNA[reiteracion ? 'reiteracion' : 'solicitud'] }], { despues: ESPACIO.parrafo }),
  ...tablaYReiteracion(datasets, reiteracion, anteriores),
  parrafo('justificado', [{ texto: MOTIVA_INICIO }, { texto: PORTAL, subrayado: true }, { texto: MOTIVA_FIN }], { ...trasLaTabla(reiteracion), despues: ESPACIO.parrafo }),
  parrafo('justificado', correos('Los datos pueden ser remitidos a los correos electrónicos ', '.'), { despues: ESPACIO.parrafo }),
  parrafo('izquierda', [{ texto: QUEDAMOS }], { despues: ESPACIO.parrafo }),
  parrafo('izquierda', [{ texto: DESPEDIDA }], { despues: ESPACIO.bloque }),
  parrafo('izquierda', [{ texto: REMITENTE, negrita: true, subrayado: true }]),
  { tipo: 'firma', columnas: 1 }
];

/**
 * La nota de la DGMIT como bloques. Los datos ya vienen validados (`validarPedidoDeNota` y la base) y los datasets, en el
 * orden de la tabla (`ordenDeLosDatasets`): acá no se ordena ni se recalcula nada.
 * @param {Object} nota
 * @param {'interna'|'externa'} nota.tipo
 * @param {'solicitud'|'reiteracion'} nota.pedido
 * @param {string} nota.fecha 'AAAA-MM-DD'
 * @param {string|null} nota.numero Sin número, "____/AA".
 * @param {string[]} [nota.anteriores] Los números de las notas anteriores (solo los cita una reiteración).
 * @param {{ nombre: string, articulo: 'el'|'la', area_superior: string|null, articulo_superior: 'el'|'la'|null }} nota.area
 * @param {{ titulo: string, frecuencia: string, datosSolicitados: string|null, queSeSolicita: string|null }[]} nota.datasets
 *   `frecuencia` es `frecuenciaEnNota`; `datosSolicitados`, el texto del pedido (null sin pedido: INFORMACION_SIN_PEDIDO);
 *   `queSeSolicita` vacío, el texto por defecto de las Notas Digitales.
 * @returns {Bloque[]}
 */
export const construirNotaDgmit = ({ tipo, pedido, fecha, numero = null, anteriores = [], area, datasets }) => {
  const datos = { reiteracion: pedido === 'reiteracion', fecha, numero, anteriores, area, datasets };
  return tipo === 'externa' ? notaExterna(datos) : notaInterna(datos);
};

// ---------------------------------------------------------------------------------------------------------------------------
// La vista previa
// ---------------------------------------------------------------------------------------------------------------------------

const ALINEACION = { izquierda: 'left', derecha: 'right', centro: 'center', justificado: 'justify' };
// Una medida relativa a la letra del cuerpo, con tres decimales como mucho ("0.833em"); 0, sin unidad
const enEm = (valor) => (valor ? `${Number(valor.toFixed(3))}em` : '0');
// Twips → em de la letra del cuerpo (20 twips por punto; la letra del cuerpo, en medios puntos)
const espacioEnEm = (twips) => enEm((twips ?? 0) / 20 / (LETRA.cuerpo / 2));

// Una parte, escapada, dentro de un contexto con la letra `base` (medios puntos)
const htmlDeParte = (parte, base) => {
  let html = escapeHtml(parte.texto);
  if (parte.cursiva) html = `<i>${html}</i>`;
  if (parte.subrayado) html = `<u>${html}</u>`;
  if (parte.negrita) html = `<b>${html}</b>`;
  if (parte.letra && parte.letra !== base) html = `<span style="font-size:${enEm(parte.letra / base)}">${html}</span>`;
  return `${parte.salto ? '<br>' : ''}${html}`;
};
const htmlDePartes = (partes, base = LETRA.cuerpo) => partes.map(p => htmlDeParte(p, base)).join('');

const htmlDeCelda = (celda, encabezado) => {
  const etiqueta = encabezado ? 'th' : 'td';
  const atributos = [encabezado ? ' scope="col"' : '', celda.abarca > 1 ? ` colspan="${celda.abarca}"` : ''].join('');
  const estilos = [
    celda.letra && celda.letra !== LETRA.cuerpo ? `font-size:${enEm(celda.letra / LETRA.cuerpo)}` : '',
    celda.fondo === 'gris' ? 'background:#d9d9d9' : ''
  ].filter(Boolean).join(';');
  return `<${etiqueta}${atributos}${estilos ? ` style="${estilos}"` : ''}>${htmlDePartes(celda.partes, celda.letra ?? LETRA.cuerpo)}</${etiqueta}>`;
};

const HTML_DE_BLOQUE = {
  parrafo: (b) => `<p style="text-align:${ALINEACION[b.alinear] ?? 'left'};margin:${espacioEnEm(b.antes)} 0 ${espacioEnEm(b.despues)}">${htmlDePartes(b.partes)}</p>`,
  tabla: (b) => {
    const columnas = b.anchos.map(a => `<col style="width:${a}%">`).join('');
    const filas = b.filas.map(f => `<tr>${f.celdas.map(c => htmlDeCelda(c, f.encabezado === true)).join('')}</tr>`).join('');
    return `<table class="nota-tabla"><colgroup>${columnas}</colgroup>${filas}</table>`;
  },
  lista: (b) => `<ul>${b.items.map(partes => `<li>${htmlDePartes(partes)}</li>`).join('')}</ul>`,
  // El espacio en blanco para firmar (una o dos firmas): su alto lo da la página
  firma: () => '<div class="nota-firma"></div>'
};

/**
 * El HTML de la vista previa: el cuerpo de la nota, sin la hoja (el membrete, la marca de agua y el pie los pone la página).
 * Todo el texto va escapado.
 * @param {Bloque[]} bloques
 * @returns {string}
 */
export const renderHtmlDeBloques = (bloques) => bloques.map(b => HTML_DE_BLOQUE[b.tipo](b)).join('\n');

/**
 * El nombre del Word (spec 4.6): "Nota interna - Secretaría de Cultura - 2026-10-24.docx", con "reiteracion" si lo es.
 * @param {{ tipo: 'interna'|'externa', pedido: 'solicitud'|'reiteracion', area: string, fecha: string }} datos
 * @returns {string}
 */
export const nombreDelWord = ({ tipo, pedido, area, fecha }) => `Nota ${tipo}${pedido === 'reiteracion' ? ' reiteracion' : ''} - ${area} - ${fecha}.docx`;
