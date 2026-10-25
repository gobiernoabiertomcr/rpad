// El PDF «Agenda de pedidos» (spec 2026-10-24-metricas-y-reportes, 5, Para trabajar, punto 6): qué vence en los próximos 3, 6 o 12
// meses, mes por mes, con las dos gestiones o una sola, para que la DGMIT y la Dirección Administrativa planifiquen. Arriba, el
// período, la gestión, los totales (los vencidos y lo que vence en el período) y cómo se arma; después, aparte y primero, los vencidos
// («Vencidos: se siguen pidiendo») y cada mes con vencimientos («Noviembre de 2026», con cuántos son y cuándo vencen), cada uno con su
// tabla: Conjunto de datos, Área, Gestión (solo con las dos), Frecuencia, Requiere nota DGMIT (no en la interna), Datos solicitados y
// Aviso aprox. (en los vencidos, «—»: Ruling 27). Una tabla que sigue en otra hoja repite arriba la cabeza de su sección. Sin nada que
// mostrar, lo dice. Pie: «Agenda de pedidos · Hoja k de N». Nada se lee como un reproche o un control: la agenda es para planificar.
// Dibuja con la base de los reportes (reportesPdfBase.js) la agenda de services/reportesAgenda.js (agendaDe), que arma el controlador
// (controllers/reportesController.js) con lo que lee de la base. Puro: sin pool (los tests lo llaman sin base).
import { COLOR } from './notasDigitalesAnexo.js';
import { mesYAnio, formatoCorto } from './notasDigitalesCalendario.js';
import { VENTANA_DIAS } from './notasDigitalesDatos.js';
import { mesesDeLaAgenda, opcionesDeAgenda } from './reportesAgenda.js';
import {
  nuevoReporte, agregarHoja, cerrarReporte, prepararTitulo, prepararPildora, prepararTarjetas, prepararParrafo, prepararSeccion,
  prepararTabla, dibujarJuntos, fechaCorta
} from './reportesPdfBase.js';

const TITULO = 'Agenda de pedidos';
const pieDe = (k, n) => `${TITULO} · Hoja ${k} de ${n}`;
const TITULO_DE_LOS_VENCIDOS = 'Vencidos: se siguen pidiendo';
const PILDORA = { ambas: 'Las dos gestiones', externa: 'Gestión externa', interna: 'Gestión interna' };
const TEXTO_GESTION = { externa: 'Externa', interna: 'Interna' };

// Las columnas de cada gestión: [clave, título, la parte del ancho útil]. La frecuencia más larga, «Cuatrimestralmente», una fecha y
// «Externa» entran en una línea; «Requiere nota DGMIT», en dos. Con una sola gestión no va la de la gestión, y en la interna tampoco la
// de «Requiere nota DGMIT» (es de los externos: en un interno, vacía)
const COLUMNAS = {
  ambas: [['titulo', 'Conjunto de datos', 116], ['area', 'Área', 100], ['gestion', 'Gestión', 36], ['frecuencia', 'Frecuencia', 78],
    ['requiere', 'Requiere nota DGMIT', 48], ['datos', 'Datos solicitados', 84], ['aviso', 'Aviso aprox.', 48]],
  externa: [['titulo', 'Conjunto de datos', 134], ['area', 'Área', 116], ['frecuencia', 'Frecuencia', 78],
    ['requiere', 'Requiere nota DGMIT', 48], ['datos', 'Datos solicitados', 86], ['aviso', 'Aviso aprox.', 48]],
  interna: [['titulo', 'Conjunto de datos', 150], ['area', 'Área', 132], ['frecuencia', 'Frecuencia', 78],
    ['datos', 'Datos solicitados', 102], ['aviso', 'Aviso aprox.', 48]]
};
// Lo que va en cada celda de una fila de agendaDe (sin dato, "—"; «Requiere nota DGMIT» de un interno, vacía)
const CELDA = {
  titulo: (f) => f.titulo || '—',
  area: (f) => f.area || '—',
  gestion: (f) => (Object.hasOwn(TEXTO_GESTION, f.gestion) ? TEXTO_GESTION[f.gestion] : '—'),
  frecuencia: (f) => f.frecuencia || '—',
  requiere: (f) => f.requiere_nota_texto ?? '',
  datos: (f) => f.datos_solicitados || '—',
  aviso: (f) => fechaCorta(f.aviso_aprox)
};

const lista = (valor) => (Array.isArray(valor) ? valor : []);
const nombreDelMes = (mes) => mesYAnio(`${mes}-01`).split(' ')[0];

// El mes de una sección: «Noviembre de 2026»
const textoDelMes = (mes) => {
  const nombre = nombreDelMes(mes);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de ${mes.slice(0, 4)}`;
};

// Los meses de la agenda: «de octubre a diciembre de 2026», o «de octubre de 2026 a marzo de 2027» si cambia el año
const textoDelPeriodo = (meses) => {
  const [primero, ultimo] = [meses[0], meses.at(-1)];
  if (primero.slice(0, 4) === ultimo.slice(0, 4)) return `de ${nombreDelMes(primero)} a ${nombreDelMes(ultimo)} de ${ultimo.slice(0, 4)}`;
  return `de ${nombreDelMes(primero)} de ${primero.slice(0, 4)} a ${nombreDelMes(ultimo)} de ${ultimo.slice(0, 4)}`;
};

const cantidad = (n) => (n === 1 ? '1 dataset' : `${n} datasets`);

// Lo de la derecha de la cabeza de un mes: cuántos son y, si vencen el mismo día (las próximas son siempre fin de mes), cuándo
const derechaDelMes = (filas) => {
  const vencimientos = [...new Set(filas.map((f) => f.vencimiento))];
  if (vencimientos.length !== 1) return cantidad(filas.length);
  return `${cantidad(filas.length)} · ${filas.length === 1 ? 'vence' : 'vencen'} el ${fechaCorta(vencimientos[0])}`;
};

// Cuándo avisa el RPAD, según la regla (VENTANA_DIAS de las Notas Digitales, las que mandan el aviso)
const ventanaDe = (gestion) => (gestion === 'ambas'
  ? `${VENTANA_DIAS.externa} días corridos antes del vencimiento en gestión externa y ${VENTANA_DIAS.interna} en gestión interna`
  : `${VENTANA_DIAS[gestion]} días corridos antes del vencimiento`);

// Cómo se arma la agenda, debajo de los totales
const aclaracionDe = (gestion) => 'Un vencimiento por dataset: su próxima actualización, sin proyectar las siguientes. '
  + '«Datos solicitados» es lo que se va a pedir para ese vencimiento; en los vencidos, lo que se pide hoy. '
  + `«Aviso aprox.» es el día en que el RPAD le avisa a la DGMIT, según la regla: ${ventanaDe(gestion)} (si ese día no es hábil, el `
  + 'siguiente). En los vencidos no va: ese día ya pasó y se siguen pidiendo en las reiteraciones. No van los datasets de frecuencia '
  + 'eventual ni los que todavía no tienen fecha de próxima actualización.';

// Sin vencimientos en el período: «Ningún dataset vence de octubre de 2026 a marzo de 2027 y no hay vencidos.» (con una gestión, «Ningún
// dataset de gestión externa vence …»; con vencidos, sin «y no hay vencidos»)
const textoSinVencimientos = (periodo, gestion, hayVencidos) =>
  `Ningún dataset${gestion === 'ambas' ? '' : ` de gestión ${gestion}`} vence ${periodo}${hayVencidos ? '' : ' y no hay vencidos'}.`;

// Una sección: su cabeza (el título a la izquierda y `derecha` a la derecha) y la tabla de sus filas, que viajan juntas y, si la tabla
// sigue en otra hoja, la cabeza se repite arriba. Devuelve la y de lo que sigue.
const dibujarSeccion = (doc, y, { titulo, derecha, filas, columnas }) => {
  const cabeza = prepararSeccion(doc, { titulo, derecha });
  const tabla = prepararTabla(doc, {
    columnas: columnas.map(([, tituloDeColumna, ancho]) => ({ titulo: tituloDeColumna, ancho })),
    filas: filas.map((fila) => columnas.map(([clave]) => CELDA[clave](fila))),
    cabeza
  });
  return dibujarJuntos(doc, y, [cabeza, tabla]);
};

// El PDF. `meses` y `gestion`: las opciones de la agenda (opcionesDeAgenda: lo que no sirve, 6 meses y las dos gestiones); `agenda`: la
// de agendaDe con esas mismas opciones, { vencidos, meses: [{ mes, filas }] }. `hoy`: 'AAAA-MM-DD'; `generado`: { momento, por } (el
// pie).
export const renderAgenda = async ({ meses, gestion, agenda }, { hoy, generado }) => {
  const opciones = opcionesDeAgenda({ meses, gestion });
  const vencidos = lista(agenda?.vencidos);
  const porMes = lista(agenda?.meses).filter((m) => typeof m?.mes === 'string' && lista(m.filas).length > 0);
  const delPeriodo = mesesDeLaAgenda(hoy, opciones.meses);
  const periodo = delPeriodo.length > 0 ? textoDelPeriodo(delPeriodo) : '';
  const columnas = COLUMNAS[opciones.gestion];

  const doc = nuevoReporte({ titulo: TITULO });
  let y = agregarHoja(doc, { derecha: TITULO, fecha: hoy });
  y = prepararTitulo(doc, {
    rotulo: `${TITULO} · próximos ${opciones.meses} meses, al ${formatoCorto(hoy)}`, titulo: `Qué vence ${periodo}`
  }).dibujar(y);
  y = prepararPildora(doc, PILDORA[opciones.gestion]).dibujar(y);
  y = prepararTarjetas(doc, [
    { valor: vencidos.length, rotulo: TITULO_DE_LOS_VENCIDOS },
    { valor: porMes.reduce((total, m) => total + m.filas.length, 0), rotulo: `Vencen en los próximos ${opciones.meses} meses` }
  ]).dibujar(y);
  y = dibujarJuntos(doc, y, [prepararParrafo(doc, aclaracionDe(opciones.gestion))]);
  if (vencidos.length > 0) {
    y = dibujarSeccion(doc, y, { titulo: TITULO_DE_LOS_VENCIDOS, derecha: cantidad(vencidos.length), filas: vencidos, columnas });
  }
  for (const { mes, filas } of porMes) {
    y = dibujarSeccion(doc, y, { titulo: textoDelMes(mes), derecha: derechaDelMes(filas), filas, columnas });
  }
  if (porMes.length === 0) {
    const texto = textoSinVencimientos(periodo, opciones.gestion, vencidos.length > 0);
    dibujarJuntos(doc, y, [prepararParrafo(doc, texto, { color: COLOR.tinta })]);
  }
  return cerrarReporte(doc, { generado, pieDe });
};
