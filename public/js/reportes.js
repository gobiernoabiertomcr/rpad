/**
 * Métricas y Reportes - RPAD (spec 2026-10-24-metricas-y-reportes, 1.4 a 1.7, 2 y 6)
 * Dos pestañas con hash, como Correos: Métricas (la inicial; #metricas) y Reportes (#reportes).
 * Métricas dibuja lo que manda GET /api/metricas: la barra (el año, «Mediana | Promedio», «Días hábiles | Días corridos», los casos
 * y el PDF), la franja de lo destildado, el índice de la página, el circuito de cada gestión, la cinta del recorrido típico y la lista
 * de casos, donde se destilda un dataset; debajo, los resultados del año, el contexto (el índice mes a mes y la antigüedad de los
 * vencidos), el trabajo del RPAD (con las métricas manuales y el CSV de Gestión, su API de siempre), las áreas y los temas (el ranking
 * de Gestión) y «Para completar» (con «Cargar nota DGMIT», que abre el formulario del Seguimiento). Lo elegido viaja en la URL
 * (?anio=&estadistico=&dias=&gestion=&sin=12,45#reportes) y no se guarda; la serie del trabajo por mes y el agrupado de los datasets,
 * tampoco (son de la página).
 * La página no recalcula ninguna regla: las cifras, sus textos (también los plurales y lo que dice cuando no hay casos), los en curso,
 * la cinta (con sus x, sus rótulos y sus anclajes) y los textos de los casos los manda el servidor (services/metricasReglas.js y
 * metricasCinta.js); acá solo se dibujan. Las fechas se leen como texto (Utils.fechaCorta). Todo texto que llega del servidor pasa
 * por Utils.escapeHtml, y un número se escribe con String (un 0 es «0»: Utils.escapeHtml(0) da '').
 * Al cargarse el archivo solo declara: lo que arma HTML es puro (tests/reportes-frontend.test.js lo carga en un vm) y lo que toca
 * el DOM o la API va aparte, al final. La pestaña Reportes conserva, por ahora, las cuatro tarjetas de siempre (al final del archivo).
 */

// Todos los roles con sesión la ven; sin sesión, al login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  iniciarReportes();
});

// =====================================================
// Constantes
// =====================================================

// Los selectores (spec, 1.7 y 2.2): el primero de cada uno es el de entrada
const ESTADISTICOS = [['mediana', 'Mediana'], ['promedio', 'Promedio']];
const DIAS = [['habiles', 'Días hábiles'], ['corridos', 'Días corridos']];
const GESTIONES = [['externa', 'Gestión externa'], ['interna', 'Gestión interna']];
const PESTANAS = ['metricas', 'reportes'];
// Lo que se ve al entrar, sin parámetros: el año en curso (`anio` null: el servidor sabe cuál es), mediana, días hábiles, la gestión
// externa, todos los datasets y la pestaña Métricas
const ESTADO_POR_DEFECTO = Object.freeze({ anio: null, estadistico: 'mediana', dias: 'habiles', gestion: 'externa', sin: Object.freeze([]), pestana: 'metricas' });

const BAJADA = 'Cuánto tarda cada paso del circuito, desde el aviso del RPAD hasta la carga en el portal, y los reportes en PDF.';
const BAJADA_DE_LOS_DIAS = {
  habiles: 'Los días son hábiles: de lunes a viernes, sin los feriados nacionales fijos.',
  corridos: 'Los días son corridos: todos los días del calendario.'
};
const NOMBRE_DE_LOS_DIAS = { habiles: 'días hábiles', corridos: 'días corridos' };

// Los nodos del circuito (spec, 2.2): quién es, qué hace y su color (lo de la DGMIT en violeta, el Portal en verde)
const NODOS = {
  rpad: ['RPAD', 'Datos Públicos avisa', ''],
  da: ['DGMIT y Dirección Administrativa', 'Mandan la nota formal', 'dgmit'],
  dit: ['DGMIT y Dirección de Investigación Territorial', 'Hacen el relevamiento', 'dgmit'],
  area: ['Área responsable', 'Prepara los datos', ''],
  ddpc: ['Datos Públicos', 'Limpia y estructura', ''],
  portal: ['Portal', 'Datos publicados', 'fin']
};
// El circuito de cada gestión: cada nodo con la clave del tramo que sale de él hacia el siguiente (la flecha se busca por esa clave
// entre los tramos del servidor, no por su lugar en la lista); el último nodo, sin tramo
const CIRCUITO_DE_LA_GESTION = {
  externa: [['rpad', 'aviso'], ['da', 'tramite'], ['area', 'respuesta'], ['ddpc', 'carga'], ['portal', null]],
  interna: [['rpad', 'aviso'], ['dit', 'produccion'], ['ddpc', 'carga'], ['portal', null]]
};

const ORIENTATIVO = 'con tan pocos casos, es orientativo';
const SE_CUENTA_HASTA = 'Se cuenta hasta que se registra la actualización.';

// La cinta: todo llega con ella (las x, la línea del eje, las alturas, los textos y los anclajes); estas listas solo dicen qué se
// puede escribir en un atributo
const ANCLAJES = ['start', 'middle', 'end'];
const COLORES = ['tinta', 'violeta', 'verde'];
const TIPOS_DE_MARCA = ['aviso', 'nota', 'datos', 'carga', 'datos-y-carga'];
// Qué es cada hito, para el <title> de su marca (en minúscula: se juntan con «y») y la leyenda
const NOMBRES_DE_LOS_HITOS = {
  aviso: 'aviso del RPAD',
  nota: 'nota DGMIT recibida por el área',
  datos: { externa: 'datos entregados', interna: 'relevamiento entregado' },
  carga: 'carga en el portal'
};
const LEYENDA_DE_LA_CINTA = ['aviso', 'nota', 'datos', 'carga', 'datos-y-carga', 'rayado'];
const LEYENDA_FIJA = { 'datos-y-carga': 'Entrega y carga juntas', rayado: 'Después del vencimiento' };

const ICONO_DESCARGA = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';

// =====================================================
// Ayudantes (puros)
// =====================================================

function comoLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

// Un texto del servidor, escapado; lo que no es un texto ni un número, vacío (nunca «null» ni «undefined»)
function escaparTexto(texto) {
  return typeof texto === 'string' || typeof texto === 'number' ? Utils.escapeHtml(String(texto)) : '';
}

// El primero de `validos` ([clave, texto]) que coincide con `valor`, o el de entrada
function elegido(valor, validos) {
  return validos.some(([clave]) => clave === valor) ? valor : validos[0][0];
}

// Una coordenada con dos decimales (alcanza para el dibujo y achica el SVG); lo que no es un número, 0
function coordenada(valor) {
  return Number.isFinite(valor) ? String(Math.round(valor * 100) / 100) : '0';
}

function esNumero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

// dd/mm/aaaa del texto 'AAAA-MM-DD' (o '—')
function fecha(valor) {
  return Utils.fechaCorta(typeof valor === 'string' ? valor : null);
}

// «A», «A y B», «A, B y C»
function enumerar(textos) {
  if (textos.length <= 1) return textos[0] ?? '';
  return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1)}`;
}

function conMayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

// =====================================================
// El estado de la URL (puro)
// =====================================================

// Los destildados (spec 1.5, ?sin=12,45): como los lee el servidor (opcionesDeMetricas), los enteros positivos escritos solo con
// dígitos, sin repetidos y en el orden pedido
function idsDestildados(textos) {
  const ids = comoLista(textos).flatMap((texto) => String(texto ?? '').split(','))
    .map((texto) => texto.trim()).filter((texto) => /^\d+$/.test(texto)).map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)];
}

// Un año escrito con cuatro dígitos, de 1000 a 9999 (como lo lee el servidor: «0000» no es un año), o null
function anioDe(texto) {
  const anio = /^\d{4}$/.test(String(texto ?? '')) ? Number(texto) : null;
  return anio !== null && anio >= 1000 ? anio : null;
}

// Lo elegido en la página a partir de la dirección (`texto`: location.search + location.hash, con o sin el «?»). Lo que no sirve cae
// al de entrada (ESTADO_POR_DEFECTO) o se ignora. `anio`: un año (anioDe), o null (el en curso); la pestaña sale del hash
function estadoDeLaUrl(texto) {
  const completo = typeof texto === 'string' ? texto : '';
  const corte = completo.indexOf('#');
  const consulta = (corte === -1 ? completo : completo.slice(0, corte)).replace(/^\?/, '');
  const hash = corte === -1 ? '' : completo.slice(corte + 1);
  const parametros = new URLSearchParams(consulta);
  return {
    anio: anioDe(parametros.get('anio')),
    estadistico: elegido(parametros.get('estadistico'), ESTADISTICOS),
    dias: elegido(parametros.get('dias'), DIAS),
    gestion: elegido(parametros.get('gestion'), GESTIONES),
    sin: idsDestildados(parametros.getAll('sin')),
    pestana: PESTANAS.includes(hash) ? hash : ESTADO_POR_DEFECTO.pestana
  };
}

// Los parámetros de `estado` que no están en su valor por defecto, en este orden: [clave, valor]. `conGestion`: la gestión solo la
// usa la página (la API manda las dos)
function parametrosDe(estado, conGestion) {
  const e = esObjeto(estado) ? estado : ESTADO_POR_DEFECTO;
  const pares = [];
  if (Number.isInteger(e.anio) && anioDe(String(e.anio)) !== null) pares.push(['anio', String(e.anio)]);
  for (const [clave, validos] of [['estadistico', ESTADISTICOS], ['dias', DIAS], ...(conGestion ? [['gestion', GESTIONES]] : [])]) {
    const valor = elegido(e[clave], validos);
    if (valor !== validos[0][0]) pares.push([clave, valor]);
  }
  const sin = idsDestildados(comoLista(e.sin).map(String));
  if (sin.length) pares.push(['sin', sin.join(',')]);
  return pares;
}

// La dirección de `estado` (lo que va después del nombre de la página): omite lo que está en su valor por defecto, también la
// pestaña Métricas. '' si todo es el de entrada. Los valores son letras, dígitos y comas: se escriben tal cual
function urlDeEstado(estado) {
  const pares = parametrosDe(estado, true);
  const consulta = pares.length ? `?${pares.map(([clave, valor]) => `${clave}=${valor}`).join('&')}` : '';
  return `${consulta}${esObjeto(estado) && estado.pestana === 'reportes' ? '#reportes' : ''}`;
}

// La consulta de GET /api/metricas (y de su PDF), sin el «?»: el año, los selectores y los destildados
function consultaDeLaApi(estado) {
  return parametrosDe(estado, false).map(([clave, valor]) => `${clave}=${valor}`).join('&');
}

// El estado con un selector cambiado: `clave` 'anio', 'estadistico', 'dias' o 'gestion'; lo que no sirve no cambia nada. El año
// tiene que estar en `anios` (los que manda el servidor, del más viejo al en curso); el en curso vuelve a ser el de entrada (null)
function conSelector(estado, clave, valor, anios) {
  const validos = { estadistico: ESTADISTICOS, dias: DIAS, gestion: GESTIONES }[clave];
  if (validos) return validos.some(([v]) => v === valor) ? { ...estado, [clave]: valor } : { ...estado };
  if (clave !== 'anio') return { ...estado };
  const lista = comoLista(anios);
  const anio = anioDe(valor);
  if (anio === null || !lista.includes(anio)) return { ...estado };
  return { ...estado, anio: anio === lista.at(-1) ? null : anio };
}

// Los destildados con `id` cambiado: si estaba, vuelve a contar; si no, se suma al final. Lo que no es un id no cambia nada
function conDestildado(sin, id) {
  const lista = idsDestildados(comoLista(sin).map(String));
  const [elegidoId] = idsDestildados([String(id ?? '')]);
  if (elegidoId === undefined) return lista;
  return lista.includes(elegidoId) ? lista.filter((otro) => otro !== elegidoId) : [...lista, elegidoId];
}

// La bajada de la página, con cómo se cuentan los días
function textoDeLaBajada(dias) {
  return `${BAJADA} ${BAJADA_DE_LOS_DIAS[elegido(dias, DIAS)]}`;
}

// =====================================================
// La barra y la franja de lo destildado (puras)
// =====================================================

// Un chip de selector con aria-pressed
function htmlDeChip(selector, valor, texto, pulsado) {
  return `<button type="button" class="mt-chip" data-selector="${selector}" data-valor="${valor}" aria-pressed="${pulsado ? 'true' : 'false'}">${texto}</button>`;
}

function htmlDeChips(selector, opciones, actual, etiqueta) {
  return `<div class="mt-chips" role="group" aria-label="${etiqueta}">${opciones.map(([valor, texto]) => htmlDeChip(selector, valor, texto, valor === actual)).join('')}</div>`;
}

// Los chips de la gestión del circuito (van adentro de su tarjeta)
function htmlDeGestiones(gestion) {
  return htmlDeChips('gestion', GESTIONES, elegido(gestion, GESTIONES), 'Gestión del circuito');
}

// La barra de arriba (spec 2.1): el año (el en curso arriba, «2026 (en curso)», y debajo los anteriores), los dos selectores, el chip
// de los casos («todos» o «todos menos 1») y «Descargar PDF». Debajo, si el año no es el en curso, de dónde sale: el aviso de la foto
// que falta (el del servidor) o la foto del 31/12. `datos`: los de GET /api/metricas; `estado`: lo elegido
function htmlDeBarra(datos, estado) {
  const d = esObjeto(datos) ? datos : {};
  const e = esObjeto(estado) ? estado : ESTADO_POR_DEFECTO;
  const anios = comoLista(d.anios).filter(Number.isInteger);
  const enCurso = anios.at(-1);
  const actual = Number.isInteger(e.anio) ? e.anio : (enCurso ?? d.anio);
  const opciones = [...anios].reverse()
    .map((anio) => `<option value="${String(anio)}"${anio === actual ? ' selected' : ''}>${String(anio)}${anio === enCurso ? ' (en curso)' : ''}</option>`).join('');
  const destildados = comoLista(d.sin_titulos).filter((titulo) => typeof titulo === 'string').length;
  const casos = destildados === 0 ? 'todos' : `todos menos ${String(destildados)}`;
  let aviso = '';
  if (typeof d.aviso_foto === 'string' && d.aviso_foto) aviso = escaparTexto(d.aviso_foto);
  else if (d.en_vivo === false) aviso = `Sale de la foto del ${fecha(d.al)}, calculada con todos los datasets.`;
  return `<select id="mt-anio" class="mt-select" data-selector="anio" aria-label="Año">${opciones}</select>`
    + htmlDeChips('estadistico', ESTADISTICOS, elegido(e.estadistico, ESTADISTICOS), 'Cómo se resume cada tramo')
    + htmlDeChips('dias', DIAS, elegido(e.dias, DIAS), 'Cómo se cuentan los días')
    + `<button type="button" class="mt-chip" data-accion="casos" aria-controls="mt-casos">Casos: <b>${casos}</b></button>`
    + `<div class="mt-derecha"><button type="button" class="mt-btn mt-btn-tinta" data-accion="pdf">${ICONO_DESCARGA}Descargar PDF</button></div>`
    + (aviso ? `<p class="mt-aviso-foto" role="note">${aviso}</p>` : '');
}

// La franja ámbar de lo destildado (spec 1.5): «Calculado sin 1 dataset: Parque Automotor.» con el link «Volver a todos», que
// conserva lo demás elegido. Sin destildados que existan (`datos.sin_titulos`, del servidor), nada
function htmlDeFranjaSin(datos, estado = ESTADO_POR_DEFECTO) {
  const titulos = comoLista(esObjeto(datos) ? datos.sin_titulos : null).filter((titulo) => typeof titulo === 'string' && titulo);
  if (titulos.length === 0) return '';
  const cuantos = titulos.length === 1 ? '1 dataset' : `${String(titulos.length)} datasets`;
  const todos = `reportes.html${urlDeEstado({ ...(esObjeto(estado) ? estado : ESTADO_POR_DEFECTO), sin: [] })}`;
  return `<div class="mt-franja" role="status"><span>Calculado sin ${cuantos}: ${escaparTexto(titulos.join(', '))}.</span>`
    + `<a href="${todos}" class="mt-franja-link" data-accion="todos">Volver a todos</a></div>`;
}

// =====================================================
// El circuito (puro)
// =====================================================

// La flecha de un tramo (un Tramo de vistaDe), con lo que manda el servidor:
// - con cifra, el número con su unidad al lado («27» + «días hábiles»; sin «antes») y debajo el estadístico con la cantidad de ciclos
//   («mediana de 32 ciclos»); un 0 llega como «En el día» (`en_el_dia`), sin unidad, con «mediana en días hábiles» debajo, y la
//   cantidad de ciclos (`ciclos_texto`) va en el texto de la flecha; con 4 casos o menos, «con tan pocos casos, es orientativo»;
// - sin cifra, por qué (`vacio`: «Todavía no hay notas DGMIT cargadas» con los pendientes, «Sin datos todavía», «Sin casos en 2026»);
// - el nombre, la línea, «desde → hasta», los en curso (con «Se cuenta hasta que se registra la actualización.») y los pendientes de
//   carga de la DGMIT (el texto del vacío o, con cifra, `pendientes_texto`); al final, la insignia de quién está a cargo (nunca solo
//   el color). Lo de la DGMIT va en violeta. La página no compara números ni arma textos: los escribe como llegan.
function htmlDeFlecha(tramo) {
  if (!esObjeto(tramo)) return '<div class="mt-flecha vacia"><div class="l" aria-hidden="true"></div></div>';
  const cifra = esObjeto(tramo.cifra) ? tramo.cifra : null;
  const vacio = cifra === null && esObjeto(tramo.vacio) ? tramo.vacio : null;
  const clases = ['mt-flecha', tramo.dgmit === true ? 'dgmit' : '', cifra === null ? 'vacia' : ''].filter(Boolean).join(' ');
  const partes = [];
  if (cifra) {
    const unidad = escaparTexto(cifra.unidad);
    partes.push(`<span class="n">${escaparTexto(cifra.texto)}${unidad ? ` <small>${unidad}</small>` : ''}</span><span class="u">${escaparTexto(cifra.debajo)}</span>`);
    if (cifra.orientativo === true) partes.push(`<span class="o">${ORIENTATIVO}</span>`);
  } else {
    partes.push(`<span class="n">${escaparTexto(vacio?.titulo)}</span>`);
  }
  partes.push(`<span class="t">${escaparTexto(tramo.nombre)}</span><div class="l" aria-hidden="true"></div>`);
  if (escaparTexto(tramo.desde_hasta)) partes.push(`<span class="c">${escaparTexto(tramo.desde_hasta)}</span>`);
  if (cifra && cifra.en_el_dia === true && escaparTexto(cifra.ciclos_texto)) partes.push(`<span class="c"><b>${escaparTexto(cifra.ciclos_texto)}</b></span>`);
  const esDeLaDgmit = tramo.clave === 'tramite';
  if (vacio && escaparTexto(vacio.texto)) partes.push(`<span class="c${esDeLaDgmit ? ' pend' : ''}">${escaparTexto(vacio.texto)}</span>`);
  else if (escaparTexto(tramo.pendientes_texto)) partes.push(`<span class="c pend">${escaparTexto(tramo.pendientes_texto)}</span>`);
  if (esObjeto(tramo.en_curso) && escaparTexto(tramo.en_curso.texto)) {
    partes.push(`<span class="c curso">${escaparTexto(tramo.en_curso.texto)}</span><span class="c">${SE_CUENTA_HASTA}</span>`);
  }
  if (escaparTexto(tramo.responsable)) partes.push(`<span class="mt-resp">${escaparTexto(tramo.responsable)}</span>`);
  return `<div class="${clases}">${partes.join('')}</div>`;
}

function htmlDeNodo(clave) {
  const [nombre, rol, clase] = NODOS[clave];
  return `<div class="mt-nodo${clase ? ` ${clase}` : ''}"><span class="q">${nombre}</span><span class="r">${rol}</span></div>`;
}

// El circuito de una gestión (spec 2.2): los nodos y, entre cada dos, la flecha de su tramo (buscado por su clave entre los que manda
// el servidor; si falta, una flecha vacía), como en «Avisos del ciclo abierto» del Seguimiento. `vista`: la de GET /api/metricas; sin
// su circuito, nada
function htmlDeCircuito(vista, gestion) {
  const circuito = esObjeto(vista) && esObjeto(vista.circuito) ? vista.circuito : null;
  const g = elegido(gestion, GESTIONES);
  if (!circuito || !Array.isArray(circuito[g])) return '';
  const tramoDe = (clave) => circuito[g].find((tramo) => esObjeto(tramo) && tramo.clave === clave) ?? null;
  const partes = CIRCUITO_DE_LA_GESTION[g].map(([nodo, clave]) => htmlDeNodo(nodo) + (clave === null ? '' : htmlDeFlecha(tramoDe(clave))));
  return `<div class="mt-tramos ${g}" role="group" aria-label="El circuito de la gestión ${g}">${partes.join('')}</div>`;
}

// Las aclaraciones del circuito de la gestión, todas del servidor: los avisados ya vencidos y, en la externa, los resueltos con una
// fuente pública y los de datasets que no requieren nota DGMIT (las que no tienen ciclos llegan vacías y no van). Sin ninguna, nada
function htmlDeAclaraciones(vista, gestion) {
  const g = elegido(gestion, GESTIONES);
  const aclaraciones = esObjeto(vista) && esObjeto(vista.circuito) && esObjeto(vista.circuito.aclaraciones) ? vista.circuito.aclaraciones[g] : null;
  const delServidor = esObjeto(aclaraciones) ? [aclaraciones.ya_vencidos, aclaraciones.fuente_publica, aclaraciones.no_requieren_nota] : [];
  const textos = delServidor.map((a) => (esObjeto(a) ? escaparTexto(a.texto) : '')).filter(Boolean);
  if (textos.length === 0) return '';
  return `<div class="mt-directo"><span class="i" aria-hidden="true">i</span><div>${textos.map((texto) => `<p>${texto}</p>`).join('')}</div></div>`;
}

// =====================================================
// La cinta (pura)
// =====================================================

// Lo que junta una marca, en palabras («Datos entregados y carga en el portal»)
function nombreDeLaMarca(tipos, gestion) {
  const nombres = comoLista(tipos).map((tipo) => {
    const nombre = NOMBRES_DE_LOS_HITOS[tipo];
    return esObjeto(nombre) ? nombre[gestion] : nombre;
  }).filter((nombre) => typeof nombre === 'string');
  return conMayuscula(enumerar(nombres));
}

// El dibujo de una marca centrada en (cx, cy), como en la maqueta 7: el rombo del aviso, el cuadrado violeta de la nota DGMIT, el
// aro de los datos, el punto verde de la carga y, si la entrega y la carga van juntas, el punto verde con el aro azul
function iconoDeLaMarca(tipo, cx, cy) {
  const x = coordenada(cx);
  const y = coordenada(cy);
  switch (tipo) {
    case 'aviso': return `<rect x="${coordenada(cx - 7)}" y="${coordenada(cy - 7)}" width="14" height="14" transform="rotate(45 ${x} ${y})" class="i-aviso"/>`;
    case 'nota': return `<rect x="${coordenada(cx - 6)}" y="${coordenada(cy - 6)}" width="12" height="12" rx="3" class="i-nota"/>`;
    case 'datos': return `<circle cx="${x}" cy="${y}" r="6.5" class="i-datos"/>`;
    case 'carga': return `<circle cx="${x}" cy="${y}" r="7" class="i-carga"/>`;
    default: return `<circle cx="${x}" cy="${y}" r="8.5" class="i-datos-y-carga"/>`;
  }
}

// Un rectángulo de la cinta, de x0 a x1 (el ancho, con dos decimales)
function rectangulo(x0, x1, y, alto, extra) {
  return `<rect x="${coordenada(x0)}" y="${coordenada(y)}" width="${coordenada(x1 - x0)}" height="${coordenada(alto)}"${extra}`;
}

// La cinta del recorrido típico como SVG (spec 2.2), con los datos de cintaDeMetricas tal como llegan: las alturas (`alturas`), la
// línea del eje (`linea`; sin ella, no se inventa), los números del eje, la banda celeste, el rayado, el gris donde se corta la
// cadena (con su texto en el medio, el lugar que reserva el servidor), el vencimiento, los segmentos (cada uno con su <title>), las
// marcas (dibujadas en su x: la de un grupo, en la de su primera), los rótulos y el del eje con sus anclajes. Sin texto dentro de la
// banda. Lo que no se puede leer no se dibuja; sin cinta, nada. Los colores están en el <style> de reportes.html. `gestion`: para
// los nombres de las marcas
function svgDeCinta(cinta, gestion = 'externa') {
  if (!esObjeto(cinta) || !esObjeto(cinta.alturas) || !esNumero(cinta.ancho) || !esNumero(cinta.alto)) return '';
  const g = elegido(gestion, GESTIONES);
  const A = cinta.alturas;
  const banda = esObjeto(A.banda) ? A.banda : {};
  const conX = (valor) => esObjeto(valor) && esNumero(valor.x0) && esNumero(valor.x1);
  const partes = [];

  if (conX(cinta.linea)) {
    partes.push(`<line x1="${coordenada(cinta.linea.x0)}" y1="${coordenada(A.linea)}" x2="${coordenada(cinta.linea.x1)}" y2="${coordenada(A.linea)}" class="l-eje"/>`);
  }
  for (const tick of comoLista(cinta.ticks).filter((t) => esObjeto(t) && esNumero(t.x))) {
    partes.push(`<text x="${coordenada(tick.x)}" y="${coordenada(A.ticks)}" class="tick">${escaparTexto(tick.texto)}</text>`);
  }
  if (conX(cinta.banda)) partes.push(`${rectangulo(cinta.banda.x0, cinta.banda.x1, banda.y, banda.alto, '')} class="banda"/>`);
  if (conX(cinta.rayado)) partes.push(`${rectangulo(cinta.rayado.x0, cinta.rayado.x1, banda.y, banda.alto, '')} class="rayado"/>`);
  if (conX(cinta.gris)) {
    partes.push(`${rectangulo(cinta.gris.x0, cinta.gris.x1, banda.y, banda.alto, '')} class="gris"/>`);
    const texto = escaparTexto(cinta.gris.texto);
    if (texto) partes.push(`<text x="${coordenada((cinta.gris.x0 + cinta.gris.x1) / 2)}" y="${coordenada(A.textoDelGris)}" class="t-gris">${texto}</text>`);
  }
  const vencimiento = esObjeto(cinta.vencimiento) && esNumero(cinta.vencimiento.x) ? coordenada(cinta.vencimiento.x) : null;
  const lineaDelVencimiento = esObjeto(A.vencimiento) ? A.vencimiento : {};
  if (vencimiento !== null) {
    partes.push(`<line x1="${vencimiento}" y1="${coordenada(lineaDelVencimiento.desde)}" x2="${vencimiento}" y2="${coordenada(lineaDelVencimiento.hasta)}" class="l-vence"/>`);
    partes.push(`<text x="${vencimiento}" y="${coordenada(lineaDelVencimiento.texto)}" class="vence">vencimiento</text>`);
  }
  const segmentos = esObjeto(A.segmentos) ? A.segmentos : {};
  for (const s of comoLista(cinta.segmentos).filter(conX)) {
    partes.push(`${rectangulo(s.x0, s.x1, segmentos.y, segmentos.alto, ' rx="4"')} class="s-${elegidoDe(s.color, COLORES)}"><title>${escaparTexto(s.texto)}</title></rect>`);
  }
  for (const m of comoLista(cinta.marcas).filter((marca) => esObjeto(marca) && esNumero(marca.x) && TIPOS_DE_MARCA.includes(marca.tipo))) {
    partes.push(`<g class="marca m-${m.tipo}" data-x="${coordenada(m.x)}"><title>${escaparTexto(nombreDeLaMarca(m.tipos, g))}</title>${iconoDeLaMarca(m.tipo, m.x, A.marcas)}</g>`);
  }
  const conTexto = (r) => esObjeto(r) && esNumero(r.x) && esNumero(r.y) && escaparTexto(r.texto);
  for (const r of comoLista(cinta.rotulos).filter(conTexto)) {
    partes.push(`<text x="${coordenada(r.x)}" y="${coordenada(r.y)}" text-anchor="${elegidoDe(r.anclaje, ANCLAJES)}" class="rotulo r-${elegidoDe(r.color, COLORES)}">${escaparTexto(r.texto)}</text>`);
  }
  if (conTexto(cinta.eje)) {
    partes.push(`<text x="${coordenada(cinta.eje.x)}" y="${coordenada(cinta.eje.y)}" text-anchor="${elegidoDe(cinta.eje.anclaje, ANCLAJES)}" class="eje">${escaparTexto(cinta.eje.texto)}</text>`);
  }

  // El nombre del dibujo: los rótulos y los tramos, con los textos del servidor
  const descripcion = [...comoLista(cinta.rotulos).filter(conTexto).map((r) => r.texto), ...comoLista(cinta.segmentos).filter(conX).map((s) => s.texto)]
    .filter((texto) => typeof texto === 'string' && texto);
  const etiqueta = `Recorrido típico de un pedido de la gestión ${g}${descripcion.length ? `: ${descripcion.join('; ')}` : ''}`;
  return `<svg class="mt-cinta-svg" viewBox="0 0 ${coordenada(cinta.ancho)} ${coordenada(cinta.alto)}" role="img" aria-label="${escaparTexto(etiqueta)}" xmlns="http://www.w3.org/2000/svg">`
    + '<defs><pattern id="mt-rayado" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" class="r-fondo"/><rect width="3" height="7" class="r-raya"/></pattern></defs>'
    + `${partes.join('')}</svg>`;
}

// Uno de `validos` (una lista de textos) o el primero
function elegidoDe(valor, validos) {
  return validos.includes(valor) ? valor : validos[0];
}

// La leyenda de la cinta: solo lo que se dibuja (las marcas, como se dibujan, y el rayado), en un orden fijo
function htmlDeLeyendaDeCinta(cinta, gestion) {
  if (!esObjeto(cinta)) return '';
  const g = elegido(gestion, GESTIONES);
  const hay = new Set(comoLista(cinta.marcas).filter(esObjeto).map((marca) => marca.tipo));
  if (esObjeto(cinta.rayado)) hay.add('rayado');
  return LEYENDA_DE_LA_CINTA.filter((tipo) => hay.has(tipo))
    .map((tipo) => `<span><i class="mk mk-${tipo}" aria-hidden="true"></i>${LEYENDA_FIJA[tipo] ?? nombreDeLaMarca([tipo], g)}</span>`).join('');
}

// =====================================================
// Los casos (puros)
// =====================================================

function filasDeLaGestion(vista, gestion) {
  const g = elegido(gestion, GESTIONES);
  return comoLista(esObjeto(vista) ? vista.casos : null).filter((fila) => esObjeto(fila) && fila.gestion === g);
}

// «Los casos de 2026 (39)»: los de la gestión elegida
function textoDeLosCasos(vista, gestion, anio) {
  const cuantos = filasDeLaGestion(vista, gestion).length;
  return `Los casos${Number.isInteger(anio) ? ` de ${String(anio)}` : ''} (${String(cuantos)})`;
}

// Una fecha con, debajo, lo que dice el servidor (`textos`, los que no están vacíos, con « · »). `clase`: la del renglón de abajo
function celdaDeFecha(dia, textos, clase = '') {
  const debajo = textos.map(escaparTexto).filter(Boolean).join(' · ');
  return `<td>${fecha(dia)}${debajo ? `<span class="d${clase ? ` ${clase}` : ''}">${debajo}</span>` : ''}</td>`;
}

// Una fila de la lista de casos (una FilaDeCaso de vistaDe): la casilla «Contar» (destilda el dataset entero; deshabilitada en un año
// con foto), el dataset con su área, el vencimiento, el aviso, la nota DGMIT (solo en la externa) con su número y su tipo, «Recibido
// el» con el origen y la carga, cada fecha con los días del tramo o su estado debajo, como los manda el servidor. Un destildado
// (`contar` false) se ve tachado y en gris
function htmlDeFilaDeCaso(fila, i, { externa, editable }) {
  const id = Number.isSafeInteger(fila.dataset_id) && fila.dataset_id > 0 ? fila.dataset_id : null;
  const cuenta = fila.contar !== false;
  const titulo = escaparTexto(fila.titulo);
  const casilla = id === null ? ''
    : `<input type="checkbox" class="mt-contar" data-dataset="${String(id)}" data-fila="${String(i)}"${cuenta ? ' checked' : ''}${editable ? '' : ' disabled'} aria-label="Contar ${titulo}">`;
  const aviso = esObjeto(fila.aviso) ? fila.aviso : {};
  const nota = esObjeto(fila.nota) ? fila.nota : {};
  const recibido = esObjeto(fila.recibido) ? fila.recibido : {};
  const carga = esObjeto(fila.carga) ? fila.carga : {};
  const numero = escaparTexto(nota.numero);
  const celdaDeNota = numero
    ? `<td>${numero}${[nota.tipo, nota.texto].map(escaparTexto).filter(Boolean).length ? `<span class="d">${[nota.tipo, nota.texto].map(escaparTexto).filter(Boolean).join(' · ')}</span>` : ''}</td>`
    : `<td>${Utils.SIN_DATO}${escaparTexto(nota.texto) ? `<span class="d pend">${escaparTexto(nota.texto)}</span>` : ''}</td>`;
  const enCurso = typeof recibido.fecha !== 'string' && escaparTexto(recibido.texto) !== '';
  return `<tr${cuenta ? '' : ' class="fuera"'}><td>${casilla}</td><td class="t">${titulo}<small>${escaparTexto(fila.area)}</small></td>`
    + `<td>${fecha(fila.vencimiento)}</td>${celdaDeFecha(aviso.fecha, [aviso.texto, aviso.que])}${externa ? celdaDeNota : ''}`
    + `${celdaDeFecha(recibido.fecha, [recibido.texto, recibido.origen], enCurso ? 'curso' : '')}${celdaDeFecha(carga.fecha, [carga.texto])}</tr>`;
}

// La lista de casos de la gestión elegida (spec 2.2): una fila por ciclo del año, en el orden del servidor, y la aclaración de
// debajo (con los días elegidos y, en un año con foto, que no se destilda). `opciones`: { anio, editable } (editable: el año se
// calcula en vivo y se puede destildar)
function htmlDeCasos(vista, estado, { anio = null, editable = true } = {}) {
  const e = esObjeto(estado) ? estado : ESTADO_POR_DEFECTO;
  const g = elegido(e.gestion, GESTIONES);
  const filas = filasDeLaGestion(vista, g);
  const delAnio = Number.isInteger(anio) ? ` en ${String(anio)}` : '';
  if (filas.length === 0) return `<p class="mt-vacio">No hay casos de la gestión ${g}${delAnio}.</p>`;
  const externa = g === 'externa';
  const columnas = ['Contar', 'Dataset', 'Vencimiento', 'Aviso', ...(externa ? ['Nota DGMIT'] : []), 'Recibido el', 'Carga'];
  const destildar = editable
    ? 'Destildar un dataset lo saca de todas las cuentas de esta página y del PDF de Métricas, mientras la mirás; el link lo conserva. La foto del 31/12 siempre se saca con todos.'
    : 'La foto del 31/12 se calculó con todos los datasets: no se puede destildar.';
  return `<div class="mt-tabla-marco" tabindex="0" role="group" aria-label="Los casos"><table class="mt-tabla">`
    + `<thead><tr>${columnas.map((columna) => `<th scope="col">${columna}</th>`).join('')}</tr></thead>`
    + `<tbody>${filas.map((fila, i) => htmlDeFilaDeCaso(fila, i, { externa, editable })).join('')}</tbody></table></div>`
    + `<p class="mt-pie">Debajo de cada fecha, los ${NOMBRE_DE_LOS_DIAS[elegido(e.dias, DIAS)]} del tramo o su estado. ${destildar}</p>`;
}

// =====================================================
// El índice de la página (puro)
// =====================================================

// Las secciones de la pestaña, en el orden de la spec (2.1): cada una es la <section id="mt-seccion-…"> de reportes.html, con su
// título <h2 id="mt-titulo-…" tabindex="-1"> (el índice lleva el foco ahí)
const SECCIONES = [['circuito', 'El circuito'], ['resultados', 'Resultados del año'], ['contexto', 'Contexto'], ['trabajo', 'El trabajo del RPAD'],
  ['areas', 'Áreas y temas'], ['completar', 'Para completar']];

// «En esta página:» con un link a cada sección. El de «Para completar» lleva la cantidad que manda el servidor
// (vista.para_completar.total; «Para completar (0)» también); sin ella, sin número
function htmlDelIndiceDeLaPagina(vista) {
  const total = esObjeto(vista) && esObjeto(vista.para_completar) ? vista.para_completar.total : null;
  const links = SECCIONES.map(([clave, texto]) => {
    const conTotal = clave === 'completar' && Number.isInteger(total) ? `${texto} (${String(total)})` : texto;
    return `<a href="#mt-seccion-${clave}" data-ir="mt-titulo-${clave}">${conTotal}</a>`;
  });
  return `<span class="mt-indice-rotulo">En esta página:</span>${links.join('')}`;
}

// =====================================================
// Ayudantes de las secciones de abajo (puros)
// =====================================================

function objetoDe(valor) {
  return esObjeto(valor) ? valor : {};
}

// Una cantidad del servidor: un número se escribe con String (un 0 es «0»); lo que no es un número, «0»
function cuenta(valor) {
  return esNumero(valor) ? String(valor) : '0';
}

// El ancho (o el alto) de una barra o de un medidor, en %: un entero de 0 a 100; lo que no es un número, 0
function porciento(valor) {
  return esNumero(valor) ? String(Math.min(100, Math.max(0, Math.round(valor)))) : '0';
}

// Barras horizontales: [texto, cantidad], cada una relativa a la más larga (todas en 0 si ninguna tiene algo), con la cantidad al lado.
// `barra`: la clase de la barra ('ambar' en la antigüedad). Los textos se escapan (los temas y las frecuencias llegan del servidor)
function htmlDeBarras(filas, barra = '') {
  const valores = filas.map(([, n]) => (esNumero(n) ? n : 0));
  const maximo = Math.max(0, ...valores);
  return `<div class="mt-barras">${filas.map(([texto], i) => `<div><span>${escaparTexto(texto)}</span>`
    + `<i${barra ? ` class="${barra}"` : ''} aria-hidden="true" style="width:${porciento(maximo > 0 ? (valores[i] * 100) / maximo : 0)}%"></i>`
    + `<b>${String(valores[i])}</b></div>`).join('')}</div>`;
}

// Una tarjeta de una sección, con su título (h3) y, a la derecha, un texto o unos chips
function abrirTarjeta(id, titulo, derecha = '') {
  return `<section class="mt-tarjeta" aria-labelledby="${id}"><div class="mt-cabeza"><h3 id="${id}">${titulo}</h3>${derecha}</div>`;
}

// La cifra grande con lo que manda el servidor al lado («5» + «de 33 ciclos») y, debajo, el medidor (el porcentaje del servidor; sin
// él, no va)
function htmlDeCifra(valor, de, medidor) {
  return `<div class="mt-heroe">${cuenta(valor)} <small>${escaparTexto(de)}</small></div>`
    + (esNumero(medidor) ? `<div class="mt-medidor" aria-hidden="true"><i style="width:${porciento(medidor)}%"></i></div>` : '');
}

// =====================================================
// Los resultados del año (puros)
// =====================================================

const GRUPOS_DEL_RPAD = [['ninguna', 'Ninguna'], ['una', '1'], ['dos_o_mas', '2 o más']];
const GRUPOS_DE_LA_DGMIT = [['ninguna', 'Ninguna'], ['una_o_mas', '1 o más']];

// Actualizados a tiempo (spec 2.2): «5 de 33 ciclos» con el medidor, qué es estar a tiempo, cuánto después se cargaron los otros (el
// texto del servidor) y el desglose por gestión; sin casos, el texto del servidor
function htmlDeATiempo(a, t) {
  const abre = abrirTarjeta('mt-res-a-tiempo', 'Actualizados a tiempo');
  if (escaparTexto(t.vacio)) return `${abre}<p class="mt-vacio">${escaparTexto(t.vacio)}</p></section>`;
  const despues = escaparTexto(objetoDe(a.despues).texto);
  const desglose = [['externa', 'Externa'], ['interna', 'Interna']].map(([clave, texto]) => {
    const [aTiempo, total] = comoLista(a[clave]);
    return `${texto}: ${cuenta(aTiempo)} de ${cuenta(total)}`;
  }).join(' · ');
  return abre + htmlDeCifra(a.a_tiempo, t.de, t.medidor)
    + `<p class="mt-texto">Cargados en el portal hasta el día del vencimiento.${despues ? ` ${despues}` : ''}</p>`
    + `<p class="mt-texto s">${desglose}</p></section>`;
}

// Cobertura del aviso (spec 2.2): «34 de 35 vencimientos» con el medidor, qué es estar avisado (con los días de la regla, del
// servidor) y los que faltan, con su vencimiento y su motivo; sin vencimientos, el texto del servidor
function htmlDeCobertura(c, t) {
  const abre = abrirTarjeta('mt-res-cobertura', 'Cobertura del aviso');
  if (escaparTexto(t.vacio)) return `${abre}<p class="mt-vacio">${escaparTexto(t.vacio)}</p></section>`;
  const faltan = comoLista(c.faltan).filter(esObjeto);
  const lista = faltan.length && escaparTexto(t.faltan)
    ? `<p class="mt-texto s">${escaparTexto(t.faltan)}</p><ul class="mt-faltan">${faltan
      .map((f) => `<li>${escaparTexto(f.titulo)} (vencimiento ${fecha(f.venc)}), ${escaparTexto(f.motivo)}</li>`).join('')}</ul>`
    : '';
  return abre + htmlDeCifra(c.si, t.de, t.medidor) + `<p class="mt-texto">${escaparTexto(t.regla)}</p>${lista}</section>`;
}

// Reiteraciones por ciclo (spec 2.2), en dos grupos de barras: del RPAD a la DGMIT (Ninguna, 1 y 2 o más) y de la DGMIT al área
// (Ninguna y 1 o más), cada uno con su título del servidor; sin nada que mostrar, por qué (también del servidor)
function htmlDeReiteraciones(r, t) {
  const rpad = objetoDe(r.rpad);
  const dgmit = esObjeto(r.dgmit) ? r.dgmit : null;
  const vacio = (texto) => (escaparTexto(texto) ? `<p class="mt-vacio-caja">${escaparTexto(texto)}</p>` : '');
  const delRpad = escaparTexto(t.rpad_vacio) ? vacio(t.rpad_vacio) : htmlDeBarras(GRUPOS_DEL_RPAD.map(([clave, texto]) => [texto, rpad[clave]]));
  const deLaDgmit = escaparTexto(t.dgmit_vacio) || dgmit === null ? vacio(t.dgmit_vacio)
    : htmlDeBarras(GRUPOS_DE_LA_DGMIT.map(([clave, texto]) => [texto, dgmit[clave]]));
  return abrirTarjeta('mt-res-reiteraciones', 'Reiteraciones por ciclo')
    + `<h4 class="mt-mini">${escaparTexto(t.rpad)}</h4>${delRpad}<h4 class="mt-mini dgmit">${escaparTexto(t.dgmit)}</h4>${deLaDgmit}`
    + '<p class="mt-pie">Del RPAD a la DGMIT, los avisos de cada ciclo después del aviso de la regla (o del primero, si se avisó ya vencido); de la DGMIT al área, las notas DGMIT de reiteración.</p></section>';
}

// Los resultados del año, con las dos gestiones juntas (spec 2.2): las tres tarjetas, con los números y los textos del servidor
// (vista.resultados y sus textos). Sin resultados, nada
function htmlDeResultados(vista) {
  const r = esObjeto(vista) && esObjeto(vista.resultados) ? vista.resultados : null;
  if (r === null) return '';
  const textos = objetoDe(r.textos);
  return htmlDeATiempo(objetoDe(r.a_tiempo), objetoDe(textos.a_tiempo)) + htmlDeCobertura(objetoDe(r.cobertura), objetoDe(textos.cobertura))
    + htmlDeReiteraciones(objetoDe(r.reiteraciones), objetoDe(textos.reiteraciones));
}

// =====================================================
// El contexto (puro)
// =====================================================

// El dibujo del índice: un espacio de 600 × 220, con la línea útil de x = 50 a x = 580 (el año entero) y de y = 190 (0 %) a y = 20
// (100 %). La x de un día es la de su mes más lo que va del mes (alcanza para dibujar: los puntos son el primero de cada mes y hoy)
const INDICE_X = { desde: 50, ancho: 530 };
const INDICE_Y = { cero: 190, alto: 170 };
function xDelDia(dia) {
  return INDICE_X.desde + ((Number(dia.slice(5, 7)) - 1 + (Number(dia.slice(8, 10)) - 1) / 31) / 12) * INDICE_X.ancho;
}
function yDeLaTasa(tasa) {
  return INDICE_Y.cero - (Math.min(100, Math.max(0, tasa)) * INDICE_Y.alto) / 100;
}

// El índice de actualización mes a mes (spec 2.2) como SVG: una línea, una sola serie, sin leyenda, con los puntos que manda el servidor
// (contexto.indice). Un punto sin tasa no se dibuja y corta la línea (no se inventa); cada punto dibujado se alcanza con el teclado y
// lleva su valor en un <title> (el texto del servidor), que se ve al pasar el mouse o el foco; el primero, el más bajo y el último lo
// muestran siempre. Debajo, la etiqueta de cada punto (los meses y «hoy»); la última, si cae muy cerca de la anterior, un renglón más
// abajo. Sin ningún punto con tasa, nada. Los colores están en el <style> de reportes.html
function svgDeIndice(indice) {
  const puntos = comoLista(indice).filter((p) => esObjeto(p) && Utils.soloFecha(p.dia) !== null);
  const conTasa = puntos.filter((p) => esNumero(p.tasa));
  if (conTasa.length === 0) return '';
  const partes = [];
  for (const valor of [0, 25, 50, 75, 100]) {
    const y = yDeLaTasa(valor);
    partes.push(`<line x1="44" y1="${coordenada(y)}" x2="590" y2="${coordenada(y)}" class="${valor === 0 ? 'l-base' : 'l-grilla'}"/>`
      + `<text x="38" y="${coordenada(y + 4)}" class="eje-y">${String(valor)}%</text>`);
  }
  const tramos = [[]];
  for (const p of puntos) {
    if (esNumero(p.tasa)) tramos.at(-1).push(p);
    else if (tramos.at(-1).length) tramos.push([]);
  }
  for (const tramo of tramos.filter((t) => t.length > 1)) {
    partes.push(`<polyline points="${tramo.map((p) => `${coordenada(xDelDia(p.dia))},${coordenada(yDeLaTasa(p.tasa))}`).join(' ')}" class="linea"/>`);
  }
  puntos.forEach((p, i) => {
    const cerca = i > 0 && xDelDia(p.dia) - xDelDia(puntos[i - 1].dia) < 28;
    partes.push(`<text x="${coordenada(xDelDia(p.dia))}" y="${cerca ? '217' : '205'}" class="mes">${escaparTexto(p.etiqueta)}</text>`);
  });
  const primero = conTasa[0];
  const ultimo = conTasa.at(-1);
  const minimo = conTasa.reduce((menor, p) => (p.tasa < menor.tasa ? p : menor), primero);
  const lejos = (p) => [primero, ultimo].every((otro) => Math.abs(xDelDia(p.dia) - xDelDia(otro.dia)) >= 40);
  const fijos = new Set([primero, ultimo, ...(lejos(minimo) ? [minimo] : [])]);
  for (const p of conTasa) {
    const x = coordenada(xDelDia(p.dia));
    const y = yDeLaTasa(p.tasa);
    const texto = escaparTexto(p.texto);
    partes.push(`<g class="mt-punto${fijos.has(p) ? ' fijo' : ''}" tabindex="0" role="img" aria-label="${texto}"><title>${texto}</title>`
      + `<circle cx="${x}" cy="${coordenada(y)}" r="${p === ultimo ? '5.5' : '4.5'}"/>`
      + `<text x="${x}" y="${coordenada(y - 11)}" class="v">${escaparTexto(textoPorcentaje(p.tasa))}</text></g>`);
  }
  return '<svg class="mt-indice-svg" viewBox="0 0 600 220" role="group" aria-label="Índice de actualización, mes a mes" xmlns="http://www.w3.org/2000/svg">'
    + `${partes.join('')}</svg>`;
}

// La antigüedad de los vencidos (spec 2.2): barras horizontales en ámbar (menos de 3 meses, de 3 a 12 meses y más de un año), con
// los textos del servidor (los vencidos de hoy en la cabeza y los del 1/1 debajo). Sin antigüedad, nada
function htmlDeAntiguedad(antiguedad) {
  if (!esObjeto(antiguedad)) return '';
  const textos = objetoDe(antiguedad.textos);
  const titulo = escaparTexto(textos.titulo);
  const inicio = escaparTexto(textos.inicio);
  const grupos = [['Menos de 3 meses', antiguedad.menos_de_3_meses], ['De 3 a 12 meses', antiguedad.de_3_a_12], ['Más de un año', antiguedad.mas_de_un_anio]];
  return abrirTarjeta('mt-ctx-antiguedad', 'Antigüedad de los vencidos', titulo ? `<span>${titulo}</span>` : '')
    + htmlDeBarras(grupos, 'ambar') + (inicio ? `<p class="mt-texto">${inicio}</p>` : '')
    + '<p class="mt-pie">Por días corridos desde el vencimiento. Los eventuales y los sin fecha no tienen vencimiento.</p></section>';
}

// El contexto (spec 2.2): el índice mes a mes (con el valor de hoy en la cabeza y todos los valores también en una lista) y la
// antigüedad de los vencidos. Sin contexto, nada
function htmlDeContexto(contexto) {
  if (!esObjeto(contexto)) return '';
  const indice = comoLista(contexto.indice).filter(esObjeto);
  const svg = svgDeIndice(indice);
  const hoy = escaparTexto(indice.at(-1)?.texto);
  const valores = indice.map((p) => escaparTexto(p.texto)).filter(Boolean);
  return abrirTarjeta('mt-ctx-indice', 'Índice de actualización, mes a mes', hoy ? `<span>${hoy}</span>` : '')
    + (svg ? `<div class="mt-indice-marco">${svg}</div>` : '<p class="mt-vacio">No hay datos para dibujar el índice.</p>')
    + (valores.length ? `<details class="mt-valores"><summary>Ver los valores</summary><ul>${valores.map((v) => `<li>${v}</li>`).join('')}</ul></details>` : '')
    + '<p class="mt-pie">Es el índice de la portada: al día (actualizados y próximos a vencer) sobre los que tienen vencimiento. Un punto por el primer día de cada mes, y el último, el de hoy (en un año cerrado, el 31/12).</p></section>'
    + htmlDeAntiguedad(contexto.antiguedad);
}

// =====================================================
// El trabajo del RPAD (puro)
// =====================================================

// Los cinco totales, en este orden; las series del gráfico por mes (la primera es la de entrada)
const TOTALES_DEL_TRABAJO = ['avisos', 'actualizaciones', 'auditados', 'nuevos', 'fuente_publica'];
const SERIES = [['avisos', 'Avisos y notas'], ['actualizaciones', 'Actualizaciones'], ['auditados', 'Cambios auditados']];

// El trabajo del RPAD (spec 2.2): los cinco totales, cada uno con su texto del servidor (en singular o en plural), y las columnas por
// mes de la serie elegida (`estado.serie`), con chips para cambiarla. Los meses son los que manda el servidor (de enero al de hoy);
// cada columna, relativa a la más alta, con su valor arriba. Sin trabajo, nada
function htmlDeTrabajo(trabajo, estado = {}) {
  if (!esObjeto(trabajo)) return '';
  const textos = objetoDe(trabajo.textos);
  const totales = objetoDe(textos.totales);
  const serie = elegido(objetoDe(estado).serie, SERIES);
  const valores = comoLista(objetoDe(trabajo.por_mes)[serie]);
  const meses = comoLista(textos.meses).map((mes, i) => [mes, esNumero(valores[i]) ? valores[i] : 0]);
  const maximo = Math.max(0, ...meses.map(([, n]) => n));
  const nombre = SERIES.find(([clave]) => clave === serie)[1];
  return `<div class="mt-kpis">${TOTALES_DEL_TRABAJO.map((clave) => `<div><b>${cuenta(trabajo[clave])}</b><span>${escaparTexto(totales[clave])}</span></div>`).join('')}</div>`
    + `<div class="mt-cabeza mt-cabeza-mes"><h3 id="mt-titulo-por-mes">Por mes</h3>${htmlDeChips('serie', SERIES, serie, 'Qué se muestra por mes')}</div>`
    + `<div class="mt-columnas" role="group" aria-label="${nombre} por mes">${meses.map(([mes, n]) => '<div class="mt-columna">'
      + `<b>${String(n)}</b><i aria-hidden="true" style="height:${porciento(maximo > 0 ? (n * 100) / maximo : 0)}%"></i><span>${escaparTexto(mes)}</span></div>`).join('')}</div>`;
}

// Las métricas manuales de Gestión (la misma API, /gestion/metricas-manuales), con sus nombres
const TIPOS_DE_METRICA_MANUAL = {
  reuniones_capacitaciones: 'Reuniones y capacitaciones', consultas_atendidas: 'Consultas atendidas', notas_enviadas: 'Notas enviadas fuera del RPAD'
};

// Las métricas manuales del año `anio` (las de Gestión: la API manda las de los últimos meses), una por renglón, con su tipo, su mes y
// su cantidad; administración (`esAdmin`, solo el true literal) ve además el botón para eliminarla. Sin ninguna, lo dice
function htmlDeMetricasManuales(lista, { anio = null, esAdmin = false } = {}) {
  const delAnio = comoLista(lista).filter((m) => esObjeto(m) && Number(m.anio) === anio);
  if (delAnio.length === 0) return `<p class="mt-vacio-caja">Todavía no hay métricas manuales cargadas${Number.isInteger(anio) ? ` en ${String(anio)}` : ''}.</p>`;
  return `<ul class="mt-manuales">${delAnio.map((m) => {
    const tipo = Object.hasOwn(TIPOS_DE_METRICA_MANUAL, m.tipo) ? TIPOS_DE_METRICA_MANUAL[m.tipo] : escaparTexto(m.tipo);
    const mes = `${conMayuscula(Utils.nombreDeMes(Number(m.mes)))} ${String(Number(m.anio))}`;
    const id = Number.isSafeInteger(Number(m.id)) && Number(m.id) > 0 ? String(Number(m.id)) : null;
    const eliminar = esAdmin === true && id !== null
      ? `<button type="button" class="mt-eliminar" data-eliminar="${id}" aria-label="Eliminar ${tipo} de ${mes}">×</button>` : '';
    return `<li><span class="t">${tipo}</span><span class="p">${mes}</span><b>${cuenta(Number(m.cantidad))}</b>${eliminar}</li>`;
  }).join('')}</ul>`;
}

// =====================================================
// Áreas y temas (puros; textoPorcentaje y htmlDelRanking vienen de gestion.js, sin cambios)
// =====================================================

// "83%", o una raya si no hay nada que medir (null: solo eventuales, que no tienen vencimiento; Ruling 23)
function textoPorcentaje(valor) {
  return valor === null || valor === undefined ? '—' : `${valor}%`;
}

// La tabla del ranking de áreas (tests/reportes-frontend.test.js)
function htmlDelRanking(areas) {
  if (!areas || areas.length === 0) {
    return '<p style="color:var(--gray-500);font-size:0.9rem;">Sin datos de áreas</p>';
  }

  let html = `<table class="ranking-table">
    <thead><tr><th>#</th><th>Área</th><th>Datasets</th><th>Al día</th><th>Cumplimiento</th><th></th></tr></thead><tbody>`;

  areas.forEach((area, i) => {
    const porcentaje = Number.isFinite(area.porcentaje) ? area.porcentaje : null;
    const color = porcentaje === null ? 'var(--gray-300)' : porcentaje >= 80 ? '#10b981' : porcentaje >= 50 ? '#f59e0b' : '#ef4444';
    html += `<tr>
      <td>${i + 1}</td>
      <td>${Utils.escapeHtml(area.area)}</td>
      <td>${Number(area.total_datasets) || 0}</td>
      <td>${Number(area.al_dia) || 0}</td>
      <td>${textoPorcentaje(porcentaje)}</td>
      <td style="width:120px"><div class="progress-bar-container"><div class="progress-bar" style="width:${porcentaje ?? 0}%;background:${color}"></div></div></td>
    </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

const AGRUPAR = [['temas', 'Tema'], ['frecuencias', 'Frecuencia']];

// Áreas y temas (spec 2.2, lo que estaba en la pestaña Métricas de Gestión): el ranking de áreas (htmlDelRanking, con lo que manda el
// servidor: la regla de cumplimientoPorArea) y los datasets por tema o por frecuencia (`agrupar`) en barras horizontales, con un chip
// para cambiar entre los dos. Sin áreas, nada
function htmlDeAreas(areas, agrupar = 'temas') {
  if (!esObjeto(areas)) return '';
  const g = elegido(agrupar, AGRUPAR);
  const filas = comoLista(areas[g]).filter((fila) => Array.isArray(fila) && esNumero(fila[1]));
  return abrirTarjeta('mt-titulo-ranking', 'Ranking de áreas', '<span>Al día sobre los que tienen vencimiento</span>')
    + `<div class="mt-tabla-marco mt-ranking" tabindex="0" role="group" aria-label="Ranking de áreas">${htmlDelRanking(comoLista(areas.ranking).filter(esObjeto))}</div></section>`
    + abrirTarjeta('mt-titulo-temas', 'Datasets por tema y por frecuencia', htmlDeChips('agrupar', AGRUPAR, g, 'Agrupar los datasets por'))
    + (filas.length ? htmlDeBarras(filas) : '<p class="mt-vacio">Sin datasets.</p>') + '</section>';
}

// =====================================================
// «Para completar» (puro)
// =====================================================

// Un id de dataset que puede ir en una dirección (un entero positivo), o null
function idDeDataset(valor) {
  return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

// Una tarea de «Para completar»: el dataset con lo de debajo, qué pasó y el link
function htmlDeTarea(titulo, debajo, que, link) {
  return `<li class="mt-tarea"><span class="d"><b>${titulo}</b><small>${debajo}</small></span><span class="q">${que}</span>${link}</li>`;
}

// «Para completar» (spec 2.2), con lo que manda el servidor (vista.para_completar): las notas DGMIT pendientes de carga (el dataset, su
// área y cómo está el ciclo, y el aviso del RPAD con qué fue) y las actualizaciones sin «Recibido el» o sin origen (con un link al
// Seguimiento del dataset), cada grupo con su título y, vacío, su texto. El link «Cargar nota DGMIT» (al Seguimiento del dataset,
// #cargar-nota: abre el formulario con ese dataset) lo ve solo quien puede cargar (`puedeCargar`, el true literal de
// Auth.puedeCargarNotasDgmit()); el resto ve la lista sin el link. Sin «Para completar», nada
function htmlDeParaCompletar(vista, puedeCargar) {
  const pc = esObjeto(vista) && esObjeto(vista.para_completar) ? vista.para_completar : null;
  if (pc === null) return '';
  const textos = objetoDe(pc.textos);
  const deNota = (n) => {
    const titulo = escaparTexto(n.titulo);
    const id = idDeDataset(n.dataset_id);
    const que = typeof n.aviso === 'string' ? `Aviso del ${fecha(n.aviso)}${escaparTexto(n.que) ? ` (${escaparTexto(n.que)})` : ''}` : '';
    const link = puedeCargar === true && id !== null
      ? `<a href="seguimiento.html?id=${String(id)}#cargar-nota" aria-label="Cargar nota DGMIT: ${titulo}">Cargar nota DGMIT</a>` : '';
    return htmlDeTarea(titulo, [n.area, n.situacion].map(escaparTexto).filter(Boolean).join(' · '), que, link);
  };
  const deRecibido = (r) => {
    const titulo = escaparTexto(r.titulo);
    const id = idDeDataset(r.dataset_id);
    const gestion = escaparTexto(r.gestion);
    const que = typeof r.carga === 'string' ? `Cargada en el portal el ${fecha(r.carga)}` : '';
    const link = id !== null ? `<a href="seguimiento.html?id=${String(id)}" aria-label="Ver en el Seguimiento: ${titulo}">Ver en el Seguimiento</a>` : '';
    return htmlDeTarea(titulo, [gestion ? `gestión ${gestion}` : '', escaparTexto(r.falta_texto)].filter(Boolean).join(' · '), que, link);
  };
  const grupo = (titulo, vacio, filas, deFila) => {
    const lista = comoLista(filas).filter(esObjeto);
    const cuerpo = lista.length ? `<ul class="mt-tareas">${lista.map(deFila).join('')}</ul>`
      : (escaparTexto(vacio) ? `<p class="mt-vacio">${escaparTexto(vacio)}</p>` : '');
    return `<h3 class="mt-grupo">${escaparTexto(titulo)}</h3>${cuerpo}`;
  };
  return `<div class="mt-tarjeta mt-completar">${grupo(textos.notas, textos.notas_vacio, pc.notas, deNota)}`
    + grupo(textos.recibido, textos.recibido_vacio, pc.recibido, deRecibido)
    + '<p class="mt-pie">Las notas DGMIT se cargan desde el Seguimiento de cada dataset. Los «Recibido el» de las actualizaciones anteriores se completan con el Excel; en las nuevas, ya los pide «Registrar actualización».</p></div>';
}

// =====================================================
// La página (DOM y API)
// =====================================================

// Lo elegido, las métricas que llegaron, si la lista de casos está abierta, el número de pedido (una respuesta que llega después de
// otra más nueva se descarta), la serie del trabajo por mes, cómo se agrupan los datasets y las métricas manuales del año (con su
// propio número de pedido)
const pagina = {
  estado: { ...ESTADO_POR_DEFECTO }, datos: null, casosAbiertos: false, pedido: 0, serie: SERIES[0][0], agrupar: AGRUPAR[0][0],
  manuales: { anio: null, lista: [], pedido: 0 }
};

const porId = (id) => document.getElementById(id);

// Deshabilita el botón mientras dura el pedido (copiado de seguimiento.js)
const conBotonBloqueado = async (boton, tarea) => {
  boton.disabled = true;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
  }
};
// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de seguimiento.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Los mensajes del servidor se escapan: showToast inserta HTML
function avisarError(mensaje) {
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), 'error');
  else Utils.showError(mensaje);
}

function avisarExito(mensaje) {
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), 'success');
  else Utils.showSuccess(mensaje);
}

// Quién carga notas DGMIT lo dice auth.js (administración y el colaborador); solo cuenta el true literal (como en seguimiento.js)
function puedeCargarNotas() {
  return typeof Auth.puedeCargarNotasDgmit === 'function' && Auth.puedeCargarNotasDgmit() === true;
}

function iniciarReportes() {
  pagina.estado = estadoDeLaUrl(`${location.search}${location.hash}`);
  pagina.casosAbiertos = pagina.estado.sin.length > 0;
  conectarPestanas();
  conectarEventos();
  iniciarMetricasManuales();
  mostrarPestana(pagina.estado.pestana);
  // El hash de la dirección (el botón atrás, un enlace a #reportes) cambia de pestaña
  window.addEventListener('hashchange', () => mostrarPestana(estadoDeLaUrl(location.hash).pestana));
  porId('mt-bajada').textContent = textoDeLaBajada(pagina.estado.dias);
  cargarMetricas();
  iniciarTarjetasDeReportes();
}

// Lo elegido queda en la dirección, sin sumar una entrada al historial
function escribirLaUrl() {
  history.replaceState(null, '', `${location.pathname}${urlDeEstado(pagina.estado)}`);
}

// ---- Pestañas (el patrón de correos.js) ----

// Muestra una pestaña y su panel, oculta la otra y deja lo elegido en la dirección
function mostrarPestana(nombre) {
  pagina.estado.pestana = PESTANAS.includes(nombre) ? nombre : ESTADO_POR_DEFECTO.pestana;
  for (const otra of PESTANAS) {
    const activa = otra === pagina.estado.pestana;
    const pestana = porId(`pestana-${otra}`);
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    pestana.classList.toggle('activa', activa);
    porId(`vista-${otra}`).hidden = !activa;
  }
  escribirLaUrl();
}

// Teclado en la barra: flechas (con vuelta), inicio y fin. Mueven el foco y activan la pestaña. Con Alt, Ctrl o Cmd son atajos del
// navegador: no se tocan
function teclaEnPestanas(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const actual = PESTANAS.indexOf(evento.target.dataset?.vista);
  if (actual === -1) return;
  const ultima = PESTANAS.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault();
  mostrarPestana(PESTANAS[destino]);
  porId(`pestana-${PESTANAS[destino]}`).focus();
}

function conectarPestanas() {
  for (const nombre of PESTANAS) porId(`pestana-${nombre}`).addEventListener('click', () => mostrarPestana(nombre));
  porId('pestanas-reportes').addEventListener('keydown', teclaEnPestanas);
}

// ---- Métricas ----

function conectarEventos() {
  const barra = porId('mt-barra');
  barra.addEventListener('click', (evento) => {
    const chip = evento.target.closest('button[data-selector]');
    if (chip) {
      alCambiarSelector(chip.dataset.selector, chip.dataset.valor);
      return;
    }
    const accion = evento.target.closest('button[data-accion]')?.dataset.accion;
    if (accion === 'casos') abrirLosCasos();
    else if (accion === 'pdf') descargarPdfDeMetricas(evento.target.closest('button'));
  });
  barra.addEventListener('change', (evento) => {
    if (evento.target.matches('select[data-selector="anio"]')) alCambiarSelector('anio', evento.target.value);
  });
  porId('mt-gestiones').addEventListener('click', (evento) => {
    const chip = evento.target.closest('button[data-selector]');
    if (chip) alCambiarSelector(chip.dataset.selector, chip.dataset.valor);
  });
  porId('mt-franja').addEventListener('click', (evento) => {
    if (!evento.target.closest('a[data-accion="todos"]')) return;
    evento.preventDefault();
    volverATodos();
  });
  porId('mt-ver-casos').addEventListener('click', () => {
    pagina.casosAbiertos = !pagina.casosAbiertos;
    dibujarLosCasos(pagina.datos);
  });
  porId('mt-casos').addEventListener('change', (evento) => {
    const casilla = evento.target.closest('input.mt-contar');
    if (casilla) alDestildar(Number(casilla.dataset.dataset), casilla.checked);
  });
  // El índice de la página lleva a la sección y deja el foco en su título (sin tocar el hash: es el de las pestañas)
  porId('mt-indice').addEventListener('click', (evento) => {
    const link = evento.target.closest('a[data-ir]');
    const titulo = link ? porId(link.dataset.ir) : null;
    if (!titulo) return;
    evento.preventDefault();
    titulo.scrollIntoView({ block: 'start', behavior: 'smooth' });
    titulo.focus({ preventScroll: true });
  });
  // La serie del trabajo por mes y cómo se agrupan los datasets: solo se redibuja su tarjeta (no viajan en la URL)
  porId('mt-trabajo').addEventListener('click', (evento) => {
    const chip = evento.target.closest('button[data-selector="serie"]');
    if (!chip || !pagina.datos) return;
    pagina.serie = elegido(chip.dataset.valor, SERIES);
    conElFoco(porId('mt-trabajo'), htmlDeTrabajo(pagina.datos.trabajo, { serie: pagina.serie }));
  });
  porId('mt-areas').addEventListener('click', (evento) => {
    const chip = evento.target.closest('button[data-selector="agrupar"]');
    if (!chip || !pagina.datos) return;
    pagina.agrupar = elegido(chip.dataset.valor, AGRUPAR);
    conElFoco(porId('mt-areas'), htmlDeAreas(pagina.datos.areas, pagina.agrupar));
  });
  porId('mt-csv').addEventListener('click', (evento) => descargarCsv(evento.currentTarget));
}

// Uno solo de los estados de la pestaña: cargando, el error, sin datos (un año sin métricas) o el contenido. La franja de lo
// destildado va solo con el contenido (con el error o sin datos no hay números que aclarar); la barra, mientras haya métricas
// dibujadas
function mostrarEstadoDeMetricas(visible) {
  for (const id of ['mt-cargando', 'mt-error', 'mt-sin-datos', 'mt-contenido']) porId(id).hidden = id !== visible;
  porId('mt-franja').hidden = visible !== 'mt-contenido';
  porId('mt-barra').hidden = pagina.datos === null;
}

// Lo que llega son las métricas (con su vista y sus casos), no otra respuesta
function sonMetricas(datos) {
  return esObjeto(datos) && esObjeto(datos.vista) && esObjeto(datos.vista.circuito) && Array.isArray(datos.vista.casos) && Array.isArray(datos.anios);
}

// GET /api/metricas con lo elegido. Con métricas ya dibujadas, quedan a la vista (atenuadas) hasta que llegan las nuevas. Un 404 es
// un año sin métricas; otro error, el aviso de error. El dibujo va dentro del mismo try: si un dato raro lo rompe, queda el aviso de
// error y no «Cargando…» para siempre. Las métricas nuevas pasan a ser las de la página recién cuando se dibujaron enteras
async function cargarMetricas() {
  const pedido = ++pagina.pedido;
  const contenido = porId('mt-contenido');
  if (pagina.datos === null) mostrarEstadoDeMetricas('mt-cargando');
  contenido.setAttribute('aria-busy', 'true');
  contenido.classList.add('actualizando');
  try {
    const consulta = consultaDeLaApi(pagina.estado);
    const datos = (await API.pedirJson('GET', `/metricas?${consulta}`))?.data;
    if (pedido !== pagina.pedido) return;
    if (!sonMetricas(datos)) throw new TypeError('La respuesta no son las métricas');
    dibujarMetricas(datos);
    pagina.datos = datos;
    mostrarEstadoDeMetricas('mt-contenido');
  } catch (error) {
    if (pedido !== pagina.pedido) return;
    if (error?.status === 404) {
      pagina.datos = null;
      mostrarEstadoDeMetricas('mt-sin-datos');
      return;
    }
    console.error('Error cargando las métricas:', error);
    mostrarEstadoDeMetricas('mt-error');
  } finally {
    if (pedido === pagina.pedido) {
      contenido.removeAttribute('aria-busy');
      contenido.classList.remove('actualizando');
    }
  }
}

// Dibuja `html` en `contenedor` y, si el foco estaba en un control de adentro, lo devuelve al mismo control (el mismo chip, la misma
// casilla de la misma fila)
function conElFoco(contenedor, html) {
  const activo = document.activeElement;
  let clave = null;
  if (activo && contenedor.contains(activo)) {
    const d = activo.dataset ?? {};
    if (d.selector) clave = d.valor ? `[data-selector="${d.selector}"][data-valor="${d.valor}"]` : `[data-selector="${d.selector}"]`;
    else if (d.fila) clave = `[data-fila="${d.fila}"]`;
    else if (d.accion) clave = `[data-accion="${d.accion}"]`;
  }
  contenedor.innerHTML = html;
  if (clave) contenedor.querySelector(clave)?.focus();
}

function dibujarLaBarra(datos) {
  conElFoco(porId('mt-barra'), htmlDeBarra(datos, pagina.estado));
}

// Todo lo de la pestaña con `datos` (las métricas que llegaron)
function dibujarMetricas(datos) {
  porId('mt-bajada').textContent = textoDeLaBajada(pagina.estado.dias);
  dibujarLaBarra(datos);
  porId('mt-franja').innerHTML = htmlDeFranjaSin(datos, pagina.estado);
  porId('mt-indice').innerHTML = htmlDelIndiceDeLaPagina(datos.vista);
  dibujarElCircuito(datos);
  dibujarLosCasos(datos);
  dibujarLasSeccionesDeAbajo(datos);
}

// Los resultados, el contexto, el trabajo del RPAD, las áreas y «Para completar». Las métricas manuales se piden aparte, solo cuando
// cambia el año
function dibujarLasSeccionesDeAbajo(datos) {
  const anio = Number.isInteger(datos.anio) ? ` en ${String(datos.anio)}` : '';
  porId('mt-bajada-resultados').textContent = `Lo que dejó el circuito${anio}, con las dos gestiones juntas.`;
  porId('mt-resultados').innerHTML = htmlDeResultados(datos.vista);
  porId('mt-contexto').innerHTML = htmlDeContexto(datos.contexto);
  porId('mt-bajada-trabajo').textContent = `Lo que hizo el sistema y el equipo de Datos Públicos${anio}.`;
  conElFoco(porId('mt-trabajo'), htmlDeTrabajo(datos.trabajo, { serie: pagina.serie }));
  const auditoria = esObjeto(datos.trabajo) ? objetoDe(datos.trabajo.textos).auditoria : null;
  porId('mt-auditoria').textContent = typeof auditoria === 'string' ? auditoria : '';
  conElFoco(porId('mt-areas'), htmlDeAreas(datos.areas, pagina.agrupar));
  porId('mt-completar').innerHTML = htmlDeParaCompletar(datos.vista, puedeCargarNotas());
  if (Number.isInteger(datos.anio) && pagina.manuales.anio !== datos.anio) cargarMetricasManuales(datos.anio);
}

// El circuito, la cinta y las aclaraciones de la gestión elegida
function dibujarElCircuito(datos) {
  const { estado } = pagina;
  const cinta = esObjeto(datos.cinta) && esObjeto(datos.cinta[estado.gestion]) ? datos.cinta[estado.gestion] : null;
  conElFoco(porId('mt-gestiones'), htmlDeGestiones(estado.gestion));
  porId('mt-circuito').innerHTML = htmlDeCircuito(datos.vista, estado.gestion);
  porId('mt-cinta').innerHTML = svgDeCinta(cinta, estado.gestion);
  porId('mt-cinta').hidden = cinta === null;
  porId('mt-leyenda').innerHTML = htmlDeLeyendaDeCinta(cinta, estado.gestion);
  porId('mt-aclaracion-cinta').textContent = typeof cinta?.aclaracion === 'string' ? cinta.aclaracion : '';
  porId('mt-aclaraciones').innerHTML = htmlDeAclaraciones(datos.vista, estado.gestion);
}

function dibujarLosCasos(datos) {
  const { estado } = pagina;
  if (!datos) return;
  const boton = porId('mt-ver-casos');
  porId('mt-titulo-casos').textContent = textoDeLosCasos(datos.vista, estado.gestion, datos.anio);
  conElFoco(porId('mt-casos'), htmlDeCasos(datos.vista, estado, { anio: datos.anio, editable: datos.en_vivo === true }));
  porId('mt-casos').hidden = !pagina.casosAbiertos;
  boton.textContent = pagina.casosAbiertos ? 'Ocultar los casos' : 'Ver los casos';
  boton.setAttribute('aria-expanded', String(pagina.casosAbiertos));
}

// El chip «Casos: …»: abre la lista de casos y la trae a la vista
function abrirLosCasos() {
  pagina.casosAbiertos = true;
  dibujarLosCasos(pagina.datos);
  porId('mt-titulo-casos').scrollIntoView({ block: 'start', behavior: 'smooth' });
  porId('mt-ver-casos').focus({ preventScroll: true });
}

// Un selector: la gestión solo cambia el circuito y los casos (las métricas traen las dos); el resto vuelve a pedir las métricas.
// La barra se redibuja enseguida con lo elegido y otra vez cuando llegan los números
function alCambiarSelector(clave, valor) {
  const nuevo = conSelector(pagina.estado, clave, valor, pagina.datos?.anios);
  if (urlDeEstado(nuevo) === urlDeEstado(pagina.estado)) return;
  pagina.estado = nuevo;
  escribirLaUrl();
  if (!pagina.datos) return;
  if (clave === 'gestion') {
    dibujarElCircuito(pagina.datos);
    dibujarLosCasos(pagina.datos);
    return;
  }
  porId('mt-bajada').textContent = textoDeLaBajada(pagina.estado.dias);
  dibujarLaBarra(pagina.datos);
  cargarMetricas();
}

// La casilla «Contar» de una fila: destilda (o vuelve a contar) el dataset entero, en todas sus filas, y vuelve a pedir las métricas
function alDestildar(datasetId, contar) {
  const sin = conDestildado(pagina.estado.sin, datasetId);
  if (sin.includes(datasetId) === (contar !== false)) return;
  pagina.estado = { ...pagina.estado, sin };
  escribirLaUrl();
  for (const casilla of porId('mt-casos').querySelectorAll(`input.mt-contar[data-dataset="${datasetId}"]`)) casilla.checked = contar !== false;
  cargarMetricas();
}

// «Volver a todos»: sin destildados
function volverATodos() {
  pagina.estado = { ...pagina.estado, sin: [] };
  escribirLaUrl();
  cargarMetricas();
}

// El PDF de Métricas con lo elegido, con el JWT en el encabezado (API.pedirArchivo), nunca en la URL
async function descargarPdfDeMetricas(boton) {
  if (!boton || !pagina.datos) return;
  const consulta = consultaDeLaApi(pagina.estado);
  await conBotonBloqueado(boton, async () => {
    try {
      const blob = await API.pedirArchivo(`/metricas/pdf${consulta ? `?${consulta}` : ''}`);
      descargarBlob(blob, `Metricas-RPAD-${String(pagina.datos.anio)}.pdf`);
    } catch (error) {
      avisarError(`No se pudo descargar el PDF: ${error.message}`);
    }
  });
}

// El CSV de métricas de Gestión, el de siempre (/gestion/metricas/csv, los últimos 12 meses), con el JWT en el encabezado
async function descargarCsv(boton) {
  await conBotonBloqueado(boton, async () => {
    try {
      const blob = await API.pedirArchivo('/gestion/metricas/csv');
      descargarBlob(blob, `metricas-${Utils.hoyEnArgentina()}.csv`);
    } catch (error) {
      avisarError(`No se pudo descargar el CSV: ${error.message}`);
    }
  });
}

// ---- Las métricas manuales (la API de Gestión; las carga administración) ----

// «Cargar el mes» y su formulario, solo para administración (el servidor valida igual: adminOnly)
function iniciarMetricasManuales() {
  const abrir = porId('mt-manual-abrir');
  abrir.hidden = !Auth.isAdmin();
  if (abrir.hidden) return;
  abrir.addEventListener('click', () => (porId('mt-manual-form').hidden ? abrirFormularioManual() : cerrarFormularioManual()));
  porId('mt-manual-cancelar').addEventListener('click', cerrarFormularioManual);
  porId('mt-manual-form').addEventListener('submit', guardarMetricaManual);
  porId('mt-manuales').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-eliminar]');
    if (boton) eliminarMetricaManual(boton);
  });
}

// El formulario abre con el mes de hoy (en Argentina), como en Gestión
function abrirFormularioManual() {
  const hoy = Utils.hoyEnArgentina();
  porId('mt-manual-anio').value = String(Number(hoy.slice(0, 4)));
  porId('mt-manual-mes').value = String(Number(hoy.slice(5, 7)));
  porId('mt-manual-cantidad').value = '0';
  porId('mt-manual-form').hidden = false;
  porId('mt-manual-abrir').setAttribute('aria-expanded', 'true');
  porId('mt-manual-tipo').focus();
}

function cerrarFormularioManual() {
  porId('mt-manual-form').hidden = true;
  const abrir = porId('mt-manual-abrir');
  abrir.setAttribute('aria-expanded', 'false');
  abrir.focus();
}

// Las métricas manuales del año `anio`: la API de Gestión manda las de los últimos N meses, así que se piden desde enero de ese año y la
// página se queda con las del año. Un error lo dice en su lugar (el resto de la pestaña sigue)
async function cargarMetricasManuales(anio) {
  const pedido = ++pagina.manuales.pedido;
  pagina.manuales.anio = anio;
  const hoy = Utils.hoyEnArgentina();
  const meses = Math.max(1, (Number(hoy.slice(0, 4)) - anio) * 12 + Number(hoy.slice(5, 7)) - 1);
  try {
    const lista = (await API.pedirJson('GET', `/gestion/metricas-manuales?meses=${String(meses)}`))?.data;
    if (pedido !== pagina.manuales.pedido) return;
    pagina.manuales.lista = Array.isArray(lista) ? lista : [];
    porId('mt-manuales').innerHTML = htmlDeMetricasManuales(pagina.manuales.lista, { anio, esAdmin: Auth.isAdmin() });
  } catch (error) {
    if (pedido !== pagina.manuales.pedido) return;
    console.error('Error cargando las métricas manuales:', error);
    pagina.manuales.anio = null;
    porId('mt-manuales').innerHTML = '<p class="mt-vacio-caja">No se pudieron cargar las métricas manuales.</p>';
  }
}

// Guarda el mes (si ya estaba cargado, la API lo reemplaza) y vuelve a pedir la lista
async function guardarMetricaManual(evento) {
  evento.preventDefault();
  const tipo = porId('mt-manual-tipo').value;
  const anio = parseInt(porId('mt-manual-anio').value, 10);
  const mes = parseInt(porId('mt-manual-mes').value, 10);
  const cantidad = parseInt(porId('mt-manual-cantidad').value, 10);
  if (Number.isNaN(cantidad) || cantidad < 0) {
    avisarError('La cantidad debe ser un número positivo');
    porId('mt-manual-cantidad').focus();
    return;
  }
  await conBotonBloqueado(porId('mt-manual-guardar'), async () => {
    try {
      const respuesta = await API.pedirJson('POST', '/gestion/metricas-manuales', { tipo, anio, mes, cantidad });
      avisarExito(respuesta?.message || 'Métrica guardada');
      porId('mt-manual-cantidad').value = '0';
      if (Number.isInteger(pagina.datos?.anio)) await cargarMetricasManuales(pagina.datos.anio);
    } catch (error) {
      avisarError(error.message || 'Error al guardar métrica');
    }
  });
}

async function eliminarMetricaManual(boton) {
  if (!confirm('¿Eliminar esta métrica?')) return;
  await conBotonBloqueado(boton, async () => {
    try {
      await API.pedirJson('DELETE', `/gestion/metricas-manuales/${encodeURIComponent(boton.dataset.eliminar)}`);
      avisarExito('Métrica eliminada');
      if (Number.isInteger(pagina.datos?.anio)) await cargarMetricasManuales(pagina.datos.anio);
      // El botón ya no está: el foco va a «Cargar el mes»
      porId('mt-manual-abrir').focus();
    } catch (error) {
      avisarError(error.message || 'Error al eliminar métrica');
    }
  });
}

// =====================================================
// La pestaña Reportes: las cuatro tarjetas de siempre (DOM y API)
// =====================================================

// Las áreas del selector y las fechas por defecto del historial (los últimos 30 días)
async function iniciarTarjetasDeReportes() {
  await cargarAreas();
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hoy.getDate() - 30);
  document.getElementById('historial-hasta').value = hoy.toISOString().split('T')[0];
  document.getElementById('historial-desde').value = hace30Dias.toISOString().split('T')[0];
}

/**
 * Cargar áreas en el select
 */
async function cargarAreas() {
  try {
    const areas = await API.getAreas();
    const select = document.getElementById('area-select');

    select.innerHTML = '<option value="">Seleccionar área...</option>';

    // Ordenar alfabéticamente
    areas.sort((a, b) => a.nombre.localeCompare(b.nombre));

    areas.forEach(area => {
      const option = document.createElement('option');
      option.value = area.id;
      option.textContent = area.nombre;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error cargando áreas:', error);
    Utils.showError('Error al cargar las áreas');
  }
}

/**
 * Generar reporte de estado general
 */
function generarReporteEstadoGeneral() {
  const url = API.getReporteEstadoGeneralUrl();
  descargarPDF(url, 'estado-general');
}

/**
 * Generar reporte de historial de notificaciones
 */
function generarReporteHistorial() {
  const desde = document.getElementById('historial-desde').value;
  const hasta = document.getElementById('historial-hasta').value;

  const url = API.getReporteHistorialUrl(desde, hasta);
  descargarPDF(url, 'historial-notificaciones');
}

/**
 * Generar reporte por área
 */
function generarReportePorArea() {
  const areaId = document.getElementById('area-select').value;

  if (!areaId) {
    Utils.showError('Por favor seleccione un área');
    return;
  }

  const url = API.getReportePorAreaUrl(areaId);
  descargarPDF(url, `reporte-area-${areaId}`);
}

/**
 * Generar reporte de cumplimiento
 */
function generarReporteCumplimiento() {
  const periodo = document.getElementById('periodo-select').value;
  const url = API.getReporteCumplimientoUrl(periodo);
  descargarPDF(url, `cumplimiento-${periodo}`);
}

/**
 * Descargar PDF desde URL
 */
async function descargarPDF(url, nombre) {
  try {
    // Mostrar loading
    Utils.showSuccess('Generando reporte...');

    const response = await fetch(url, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al generar el reporte');
    }

    // Obtener el blob del PDF
    const blob = await response.blob();

    // Crear link de descarga
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${nombre}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    Utils.showSuccess('Reporte generado exitosamente');

  } catch (error) {
    console.error('Error generando reporte:', error);
    Utils.showError(error.message || 'Error al generar el reporte');
  }
}
