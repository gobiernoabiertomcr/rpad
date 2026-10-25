// El PDF «Datos para completar» (spec 2026-10-24-metricas-y-reportes, 5, Para trabajar, punto 7, y 2.2): lo mismo que la sección «Para
// completar» de la pestaña Métricas, la vista.para_completar del año en curso, en vivo, que arma el servidor (metricasDe, la de GET
// /api/metricas): las notas DGMIT pendientes de carga y las actualizaciones sin «Recibido el» o sin el origen de los datos, cada grupo
// con su título y, sin ninguna, su vacío, los dos del servidor (Ruling 19), y una fila por tarea con los textos que imprime la pestaña
// (htmlDeParaCompletar, public/js/reportes.js): el dataset, lo de debajo (el área y cómo está el ciclo, o la gestión y qué falta) y qué
// pasó (el aviso del RPAD, o la carga). Sin links, porque es un PDF: en su lugar, el pie de la pestaña dice dónde se completa cada dato.
// Una tabla que sigue en otra hoja repite arriba el título de su grupo. Pie: «Datos para completar · Hoja k de N».
// Dibuja con la base de los reportes (reportesPdfBase.js) lo que le pasa el controlador (controllers/reportesController.js). Puro: sin
// pool (los tests lo llaman sin base).
import { COLOR, NEGRITA } from './notasDigitalesAnexo.js';
import { formatoCorto } from './notasDigitalesCalendario.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, prepararTitulo, prepararParrafo, prepararTabla, dibujarJuntos, fechaCorta
} from './reportesPdfBase.js';

const TITULO = 'Datos para completar';
const pieDe = (k, n) => `${TITULO} · Hoja ${k} de ${n}`;

// Los textos fijos de la pestaña (la bajada de la sección, en public/reportes.html, y su pie, en public/js/reportes.js): el PDF los toma
// de acá, como los de las funciones de abajo, que arman lo mismo que la pestaña. tests/reportes-frontend.test.js comprueba que son los
// de la pestaña: si cambia uno allá, falla
export const TEXTOS_DE_PARA_COMPLETAR = Object.freeze({
  bajada: 'Con estos datos, las métricas quedan completas.',
  pie: 'Las notas DGMIT se cargan desde el Seguimiento de cada dataset. Los «Recibido el» de las actualizaciones anteriores se completan '
    + 'con el Excel; en las nuevas, ya los pide «Registrar actualización».'
});

const LETRA_DEL_GRUPO = 9;

const objeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const lista = (valor) => (Array.isArray(valor) ? valor.filter(objeto) : []);
// Un texto del servidor; lo que no es un texto ni un número, vacío (como escaparTexto de la pestaña)
const texto = (valor) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '');

// Lo de debajo de una nota DGMIT pendiente: su área y cómo está el ciclo («Secretaría … · ciclo abierto»)
export const debajoDeLaNota = (nota) => [nota?.area, nota?.situacion].map(texto).filter(Boolean).join(' · ');
// El aviso del RPAD de una nota DGMIT pendiente, con qué fue: «Aviso del 21/10/2026 (Nota Digital 4/26)»; sin aviso, vacío
export const queDeLaNota = (nota) => (typeof nota?.aviso === 'string'
  ? `Aviso del ${fechaCorta(nota.aviso)}${texto(nota.que) ? ` (${texto(nota.que)})` : ''}` : '');
// Lo de debajo de una actualización: su gestión y qué le falta («gestión externa · Falta «Recibido el»»)
export const debajoDelRecibido = (recibido) => [texto(recibido?.gestion) ? `gestión ${texto(recibido.gestion)}` : '', texto(recibido?.falta_texto)]
  .filter(Boolean).join(' · ');
// La carga de una actualización: «Cargada en el portal el 16/03/2026»; sin carga, vacío
export const queDelRecibido = (recibido) => (typeof recibido?.carga === 'string' ? `Cargada en el portal el ${fechaCorta(recibido.carga)}` : '');

// Los dos grupos, en el orden de la pestaña: de dónde salen sus filas, su título y su vacío (claves de para_completar y de sus textos),
// sus columnas ([título, la parte del ancho útil]) y las celdas de cada fila (sin dato, "—")
const GRUPOS = [
  {
    filas: 'notas', titulo: 'notas', vacio: 'notas_vacio',
    columnas: [['Conjunto de datos', 160], ['Área y ciclo', 190], ['Aviso del RPAD', 160]],
    celdas: (n) => [texto(n.titulo) || '—', debajoDeLaNota(n) || '—', queDeLaNota(n) || '—']
  },
  {
    filas: 'recibido', titulo: 'recibido', vacio: 'recibido_vacio',
    columnas: [['Conjunto de datos', 200], ['Gestión y qué falta', 170], ['Carga en el portal', 140]],
    celdas: (r) => [texto(r.titulo) || '—', debajoDelRecibido(r) || '—', queDelRecibido(r) || '—']
  }
];

const tituloDe = (total) => (total === 0 ? 'No hay datos para completar'
  : total === 1 ? '1 dato para completar' : `${total} datos para completar`);

// Un grupo desde y: su título (en negrita) con su tabla, que viajan juntos y, si la tabla sigue en otra hoja, el título se repite
// arriba; sin filas, el título con su vacío. Sin título ni filas (un «Para completar» sin textos), nada. Devuelve la y de lo que sigue.
const dibujarGrupo = (doc, y, grupo, { filas, textos }) => {
  const titulo = texto(textos[grupo.titulo]);
  if (titulo === '' && filas.length === 0) return y;
  const cabeza = prepararParrafo(doc, titulo, { tamano: LETRA_DEL_GRUPO, fuente: NEGRITA, color: COLOR.tinta });
  if (filas.length === 0) return dibujarJuntos(doc, y, [cabeza, prepararParrafo(doc, texto(textos[grupo.vacio]))]);
  const tabla = prepararTabla(doc, {
    columnas: grupo.columnas.map(([tituloDeColumna, ancho]) => ({ titulo: tituloDeColumna, ancho })), filas: filas.map(grupo.celdas), cabeza
  });
  return dibujarJuntos(doc, y, [cabeza, tabla]);
};

// El PDF. `anio`: el de las métricas (el de hoy); `para_completar`: la vista.para_completar de ese año ({ notas, recibido, total, textos },
// paraCompletarDe de services/metricasReglas.js). `hoy`: 'AAAA-MM-DD'; `generado`: { momento, por } (el pie). Sin «Para completar», o con
// datos raros, no tira: no hay nada para completar.
export const renderParaCompletar = async ({ anio, para_completar: paraCompletar }, { hoy, generado }) => {
  const pc = objeto(paraCompletar) ? paraCompletar : {};
  const textos = objeto(pc.textos) ? pc.textos : {};
  const filas = { notas: lista(pc.notas), recibido: lista(pc.recibido) };
  const doc = nuevoReporte({ titulo: TITULO });
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = prepararTitulo(doc, {
    rotulo: `${TITULO} · métricas de ${texto(anio)}, al ${formatoCorto(hoy)}`, titulo: tituloDe(filas.notas.length + filas.recibido.length)
  }).dibujar(y);
  y = prepararParrafo(doc, TEXTOS_DE_PARA_COMPLETAR.bajada).dibujar(y);
  for (const grupo of GRUPOS) y = dibujarGrupo(doc, y, grupo, { filas: filas[grupo.filas], textos });
  dibujarJuntos(doc, y, [prepararParrafo(doc, TEXTOS_DE_PARA_COMPLETAR.pie)]);
  return cerrarReporte(doc, { generado, pieDe });
};
