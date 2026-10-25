// El PDF «Avisos del RPAD» (spec 2026-10-24-metricas-y-reportes, 5, Para trabajar; reemplaza al Historial de notificaciones): la
// constancia de cada aviso del RPAD de un período. Van los emails viejos, a la DGMIT y al área, y las Notas Digitales de aviso y de
// reiteración, cada uno con su fecha, qué fue (el título de su movimiento en el Seguimiento: tituloDeEmail y tituloDeNotaADgmit), su
// gestión, sus datasets y cómo terminó el envío (las palabras del Seguimiento: ESTADO_DE_NOTA y RESULTADO_DE_EMAIL). Arriba, los
// totales, que cuentan como aviso solo lo que se envió, con la regla del Seguimiento (esEmailADgmit, esEmailAlArea y esNotaEnviada);
// lo que no salió va en la tabla con su estado y una línea dice cuántos son. No van las direcciones de email ni el texto técnico de los
// errores (avisosDelPeriodo no los copia), ni las notas de prueba, ni las de auditoría y autorización, que no son avisos del pedido de
// datos. Pie: «Avisos del RPAD · Hoja k de N».
// Lo arma el controlador (controllers/reportesController.js), que lee la base y le pasa a avisosDelPeriodo los emails y las notas del
// período; dibuja con la base de los reportes (reportesPdfBase.js). Puro: sin pool (los tests lo llaman sin base).
import {
  diaDe, momentoDe, tituloDeEmail, tituloDeNotaADgmit, ESTADO_DE_NOTA, RESULTADO_DE_EMAIL, esEmailADgmit, esEmailAlArea, esNotaEnviada
} from './seguimientoReglas.js';
import { COLOR } from './notasDigitalesAnexo.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, prepararTitulo, prepararPildora, prepararTarjetas, prepararParrafo, prepararSeccion,
  prepararTabla, dibujarJuntos, fechaCorta, esObjeto, objeto, lista
} from './reportesPdfBase.js';

const TITULO = 'Avisos del RPAD';
const pieDe = (k, n) => `${TITULO} · Hoja ${k} de ${n}`;

// Las columnas de la tabla: la parte del ancho útil de cada una («Email a DGMIT: resumen mensual de vencidos», el qué fue más largo, y
// «Pendiente de envío» en su insignia entran en una línea; los datasets, en hasta cuatro, y si no entran se cortan con «…»)
const COLUMNAS = [
  { titulo: 'Fecha', ancho: 47 }, { titulo: 'Qué fue', ancho: 174 }, { titulo: 'Gestión', ancho: 35 }, { titulo: 'Datasets', ancho: 172 },
  { titulo: 'Estado', ancho: 82 }
];
const TEXTO_GESTION = { externa: 'Externa', interna: 'Interna' };
// La insignia de cada envío, con los colores de los estados del Seguimiento (INSIGNIAS de la base): el que salió, como un actualizado
// (verde); el pendiente, como un próximo a vencer (amarillo); el que no se pudo enviar, como un vencido (rojo)
const INSIGNIA_DEL_ENVIO = { enviado: 'actualizado', pendiente: 'proximo', fallido: 'vencido' };
const ACLARACION = 'Los emails a la DGMIT y al área y las Notas Digitales de aviso y de reiteración del período, con los textos del '
  + 'Seguimiento. Los totales cuentan lo que se envió. No van las direcciones de email, las notas de prueba ni las de auditoría y de '
  + 'autorización, que no son avisos del pedido de datos.';
// Lo que no salió (los pendientes y los que no se pudieron enviar), debajo de los totales; sin ninguno, no va
const textoSinSalir = (n) => (n === 1 ? 'Además, 1 envío no salió: figura en la tabla con su estado.'
  : `Además, ${n} envíos no salieron: figuran en la tabla con su estado.`);
// La celda de los datasets: sus títulos separados por coma, con la cantidad adelante si son dos o más («24 datasets: …», como decía el
// Historial: si la celda se corta con «…», la cantidad queda); sin ninguno que se pueda nombrar, "—"
const textoDeDatasets = (titulos) => (titulos.length === 0 ? '—'
  : titulos.length === 1 ? titulos[0] : `${titulos.length} datasets: ${titulos.join(', ')}`);

const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Los títulos de los datasets de un aviso, en orden alfabético, sin vacíos
const titulosDe = (datasets) => lista(datasets).filter((t) => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
  .sort((a, b) => a.localeCompare(b, 'es'));

// Un email registrado (notificaciones_log) como aviso, o null si no lo es (un tipo que no se conoce) o no tiene momento. La gestión
// sale del tipo: los internos a la DGMIT, interna; los externos y el de los 40 días al área, externa. Se envió si lo dice la regla del
// Seguimiento (a la DGMIT o al área)
const avisoDeEmail = (email) => {
  const momento = momentoDe(email.enviado);
  const que = tituloDeEmail(email.tipo);
  if (momento === null || que === null) return null;
  const enviado = esEmailADgmit(email) || esEmailAlArea(email);
  return {
    fecha: momento.slice(0, 10), momento, clase: email.tipo === 'area-aviso-40' ? 'area' : 'dgmit', que,
    gestion: email.tipo.startsWith('interno-') ? 'interna' : 'externa', datasets: titulosDe(email.datasets),
    envio: enviado ? 'enviado' : 'fallido', estado: enviado ? RESULTADO_DE_EMAIL.enviado : RESULTADO_DE_EMAIL.fallido
  };
};

// Una Nota Digital como aviso, o null si no lo es: solo las de aviso y de reiteración que no son de prueba, con su fecha y uno de los
// tres estados de la tabla. Dentro de su día va por el momento del envío (la que no salió, a las 00:00), como en el Seguimiento. Se
// envió si lo dice la regla del Seguimiento (esNotaEnviada); si no, quedó pendiente o falló.
const ENVIO_DE_LA_NOTA = { pendiente: 'pendiente', fallida: 'fallido' };
const avisoDeNota = (nota) => {
  const fecha = diaDe(nota.fecha);
  const esAviso = nota.tipo === 'aviso' || nota.tipo === 'reiteracion';
  if (fecha === null || !esAviso || Boolean(Number(nota.es_prueba)) || !Object.hasOwn(ESTADO_DE_NOTA, nota.estado)) return null;
  return {
    fecha, momento: momentoDe(nota.enviada) ?? `${fecha} 00:00:00`, clase: 'nota', que: tituloDeNotaADgmit(nota),
    gestion: Object.hasOwn(TEXTO_GESTION, nota.gestion) ? nota.gestion : null, datasets: titulosDe(nota.datasets),
    envio: esNotaEnviada(nota) ? 'enviado' : ENVIO_DE_LA_NOTA[nota.estado], estado: ESTADO_DE_NOTA[nota.estado]
  };
};

// Los avisos del período, del más viejo al más nuevo (por fecha, después por momento: emails y notas juntos). `fuentes`: { emails,
// notas }, lo que lee el controlador, cada email { tipo, enviado ('AAAA-MM-DD HH:MM:SS' en hora argentina), success, datasets } y cada
// nota { numero, anio, tipo, gestion, fecha ('AAAA-MM-DD'), estado, enviada, es_prueba, datasets }, con los títulos en `datasets`. El
// período, { desde, hasta } ('AAAA-MM-DD'), con los dos días adentro (la fecha de un email es la de Argentina). Cada aviso: { fecha,
// clase ('dgmit', 'area' o 'nota'), que, gestion ('externa', 'interna' o null), datasets, envio ('enviado', 'pendiente' o 'fallido'),
// estado (su texto) }: nada más de lo leído (ni las direcciones ni el error). Nunca tira: lo que no se puede leer no va.
export const avisosDelPeriodo = (fuentes, { desde, hasta }) => {
  const { emails, notas } = objeto(fuentes);
  const avisos = [
    ...lista(emails).filter(esObjeto).map(avisoDeEmail),
    ...lista(notas).filter(esObjeto).map(avisoDeNota)
  ].filter((aviso) => aviso !== null && aviso.fecha >= desde && aviso.fecha <= hasta);
  return avisos.sort((a, b) => comparar(a.fecha, b.fecha) || comparar(a.momento, b.momento))
    .map(({ momento, ...aviso }) => aviso);
};

// Los totales: de lo que se envió, cuántos hay de cada clase (los tres suman el total) y de cada gestión; aparte, cuántos no salieron
// (los pendientes y los que no se pudieron enviar)
const totalesDe = (avisos) => {
  const enviados = avisos.filter((a) => a.envio === 'enviado');
  const cuantos = (condicion) => enviados.filter(condicion).length;
  return {
    total: enviados.length, dgmit: cuantos((a) => a.clase === 'dgmit'), area: cuantos((a) => a.clase === 'area'),
    notas: cuantos((a) => a.clase === 'nota'), externa: cuantos((a) => a.gestion === 'externa'),
    interna: cuantos((a) => a.gestion === 'interna'), sinSalir: avisos.length - enviados.length
  };
};

const tituloDe = (total) => (total === 0 ? 'Ningún aviso del RPAD en el período'
  : total === 1 ? '1 aviso del RPAD en el período' : `${total} avisos del RPAD en el período`);

// El PDF. `periodo`: { desde, hasta, avisos }, con los avisos de avisosDelPeriodo. `hoy`: 'AAAA-MM-DD'; `generado`: { momento, por }
// (el pie). Sin ninguno enviado, el título dice que no hubo avisos y no va la píldora; sin ninguna fila, tampoco la tabla.
export const renderAvisos = async ({ desde, hasta, avisos }, { hoy, generado }) => {
  const filas = lista(avisos);
  const t = totalesDe(filas);
  const doc = nuevoReporte({ titulo: TITULO });
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = prepararTitulo(doc, { rotulo: `${TITULO} · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`, titulo: tituloDe(t.total) }).dibujar(y);
  if (t.total > 0) y = prepararPildora(doc, `${t.externa} de gestión externa y ${t.interna} de gestión interna`).dibujar(y);
  y = prepararTarjetas(doc, [
    { valor: t.total, rotulo: 'Total de avisos' },
    { valor: t.dgmit, rotulo: 'Emails a DGMIT' },
    { valor: t.area, rotulo: 'Emails al área' },
    { valor: t.notas, rotulo: 'Notas Digitales' }
  ]).dibujar(y);
  if (t.sinSalir > 0) y = prepararParrafo(doc, textoSinSalir(t.sinSalir), { color: COLOR.tinta }).dibujar(y);
  y = prepararParrafo(doc, ACLARACION).dibujar(y);
  if (filas.length > 0) {
    // La cabeza de la sección viaja con el encabezado de la tabla y su primera fila
    dibujarJuntos(doc, y, [
      prepararSeccion(doc, { titulo: 'Avisos del período', derecha: 'Del más viejo al más nuevo' }),
      prepararTabla(doc, {
        columnas: COLUMNAS,
        filas: filas.map((a) => [fechaCorta(a.fecha), a.que, TEXTO_GESTION[a.gestion] ?? '—', textoDeDatasets(a.datasets), a.estado]),
        estados: filas.map((a) => INSIGNIA_DEL_ENVIO[a.envio])
      })
    ]);
  }
  return cerrarReporte(doc, { generado, pieDe });
};
