/**
 * El dato de la quincena - RPAD (spec 2026-11-07-dato-quincena, 9, 10 y 11)
 * El archivo de las ediciones que manda Grok Bot, de solo lectura, para todos los roles con sesión: la lista de un año (sin ?id=;
 * ?anio=AAAA elige el año), con la infografía en miniatura, y el detalle de una edición (?id=N), con la infografía y los archivos a
 * un costado y la agenda y las propuestas al otro. La principal va abierta y las otras, cerradas; las notas para validar, siempre a
 * la vista; y tres «Copiar» por propuesta (el texto para redes, el borrador y la propuesta entera).
 * El servidor arma todos los textos (las fechas, la marca del piloto, la llegada, el correo, la cantidad, el resto, la foto del RPAD,
 * los tamaños y lo que se copia: GET /api/dato-quincena/ediciones y /ediciones/:id) y la página los imprime tal cual: no recalcula
 * nada. Todo texto del servidor pasa por Utils.escapeHtml (también en los data-, alt y aria-label), un número se escribe con String
 * (Utils.escapeHtml(0) da '') y una dirección de afuera solo es un enlace si empieza con https://, con rel="noopener noreferrer".
 * Al cargarse el archivo solo declara y engancha DOMContentLoaded: lo que arma HTML es puro y recibe los datos por parámetro
 * (tests/dato-quincena-frontend.test.js lo carga en un vm, después del main.js y del api.js de verdad, como la página); lo que toca
 * el DOM o la API va aparte, al final (iniciarDatoQuincena): las cargas (API.pedirJson), las imágenes desde un blob:
 * (API.pedirArchivo + URL.createObjectURL, liberadas al cambiar de año y al salir), «Ver» en un modal con textContent, «Descargar»
 * con el nombre que manda el servidor (API.pedirArchivo no da el Content-Disposition) y «Copiar». Los eventos van delegados en
 * #dq-contenido y en el modal, que no se vuelven a dibujar; lo que cambia se anuncia en #dq-anuncio.
 */

// =====================================================
// Constantes
// =====================================================

const PAGINA_DATO_QUINCENA = 'dato-quincena.html';
// Los años que acepta el servidor (spec 9: un anio que no es un entero de 2000 a 2100 da 400)
const ANIO_MINIMO_DQ = 2000;
const ANIO_MAXIMO_DQ = 2100;

const MENSAJES_COPIAR = Object.freeze({ copiado: 'Copiado', fallo: 'No se pudo copiar: seleccioná el texto.' });
// «Copiado» queda dos segundos (spec 10); el aviso de que no se pudo, un poco más, para que dé tiempo a leerlo
const DURACION_COPIADO = 2000;
const DURACION_FALLO = 5000;

// Los textos de los estados de la página (spec 10)
const TEXTOS_DEL_ESTADO = Object.freeze({
  cargando: 'Cargando…',
  error: 'No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.',
  vacio: 'Todavía no llegó ninguna edición. Grok Bot manda cada una después de enviar su correo.',
  noExiste: 'No existe esa edición.'
});
const TEXTO_TODAS_LAS_EDICIONES = 'Todas las ediciones';

// Las etiquetas de una propuesta: «Principal» en tinta, «Agenda» en cielo y «Validar» en sol con un ícono (nunca solo el color)
const CLASE_DE_LA_ETIQUETA = Object.freeze({ Principal: 'dq-et-principal', Agenda: 'dq-et-agenda', Validar: 'dq-et-validar' });

// Los campos de texto de la propuesta completa, en el orden de la sección 9 (el mismo de «Copiar la propuesta»); después van el texto
// para redes, los puntos centrales, el borrador y las fuentes
const CAMPOS_DE_TEXTO = Object.freeze([
  ['calculo', 'Cómo se calculó'],
  ['contexto_historico', 'Contexto histórico'],
  ['por_que_hoy', 'Por qué hoy'],
  ['angulo', 'Ángulo'],
  ['idea_placa', 'Idea de placa']
]);

// Los íconos de Lucide, decorativos: triangle-alert (Validar), chevron-right (la propuesta completa) y chevron-left (volver)
const ATRIBUTOS_DEL_ICONO = 'aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONO_VALIDAR = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const ICONO_ABRIR = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="m9 18 6-6-6-6"/></svg>`;
const ICONO_VOLVER = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="m15 18-6-6 6-6"/></svg>`;

// =====================================================
// Lo puro: la dirección y los enlaces
// =====================================================

const esc = (valor) => Utils.escapeHtml(valor);
// Un número del servidor (un id, un año, una cantidad) como texto: Utils.escapeHtml(0) da ''
const numeroComoTexto = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : esc(valor));
// Un id que sirve: un entero positivo; si no, null
const idDeEdicion = (valor) => (Number.isSafeInteger(valor) && valor > 0 ? valor : null);
const anioQueSirve = (valor) => (Number.isInteger(valor) && valor >= ANIO_MINIMO_DQ && valor <= ANIO_MAXIMO_DQ ? valor : null);

/**
 * Lo que pide la dirección: `{ id, anio }`. El id, un entero positivo escrito con cifras (sin ceros adelante); el año, cuatro
 * cifras de 2000 a 2100. Lo demás, null.
 */
function estadoDeLaUrl(search) {
  const parametros = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const textoDelId = parametros.get('id') ?? '';
  const textoDelAnio = parametros.get('anio') ?? '';
  return {
    id: /^[1-9]\d*$/.test(textoDelId) ? idDeEdicion(Number(textoDelId)) : null,
    anio: /^\d{4}$/.test(textoDelAnio) ? anioQueSirve(Number(textoDelAnio)) : null
  };
}

// La dirección de una vista: el detalle con su id, la lista de un año o la lista sola (el año más reciente)
function urlDeEstado({ id = null, anio = null } = {}) {
  if (idDeEdicion(id) !== null) return `${PAGINA_DATO_QUINCENA}?id=${String(id)}`;
  if (anioQueSirve(anio) !== null) return `${PAGINA_DATO_QUINCENA}?anio=${String(anio)}`;
  return PAGINA_DATO_QUINCENA;
}

// Una dirección de afuera solo se dibuja como enlace si empieza con https:// (spec 10)
function esEnlaceSeguro(url) {
  return typeof url === 'string' && url.startsWith('https://');
}

// La ruta de un archivo de una edición, para API.pedirArchivo (el JWT va en el encabezado, nunca en la dirección)
const rutaDelArchivo = (id, campo) => `/dato-quincena/ediciones/${String(id)}/archivos/${encodeURIComponent(String(campo ?? ''))}`;

// Un enlace de afuera que abre en otra pestaña
const enlaceDeAfuera = (url, contenido) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${contenido}</a>`;

const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
const htmlDeMarca = (marca) => (marca ? `<span class="dq-marca">${esc(marca)}</span>` : '');

// =====================================================
// Lo puro: los estados y la lista
// =====================================================

// Cargando, el error, el archivo vacío y una edición que no existe (con «Todas las ediciones»). Otro tipo, nada
function htmlDelEstado(tipo) {
  if (tipo === 'cargando') return `<p class="dq-estado" role="status">${TEXTOS_DEL_ESTADO.cargando}</p>`;
  if (tipo === 'error') return `<div class="dq-estado dq-error" role="alert"><p>${TEXTOS_DEL_ESTADO.error}</p></div>`;
  if (tipo === 'vacio') return `<p class="dq-estado">${TEXTOS_DEL_ESTADO.vacio}</p>`;
  if (tipo === 'no-existe') {
    return `<div class="dq-estado"><h2>${TEXTOS_DEL_ESTADO.noExiste}</h2>`
      + `<p><a class="dq-link" href="${PAGINA_DATO_QUINCENA}">${TEXTO_TODAS_LAS_EDICIONES}</a></p></div>`;
  }
  return '';
}

// Los años como botones con su cantidad, solo si hay más de uno; el elegido, marcado (aria-pressed y no solo el color)
function htmlDeAnios(anios, anio) {
  const validos = listaDe(anios).filter((fila) => anioQueSirve(fila?.anio) !== null);
  if (validos.length < 2) return '';
  const botones = validos.map((fila) => {
    const elegido = fila.anio === anio;
    return `<button type="button" class="dq-chip${elegido ? ' dq-activo' : ''}" aria-pressed="${elegido}" data-anio="${String(fila.anio)}">`
      + `${String(fila.anio)} <b>${numeroComoTexto(fila.cantidad)}</b></button>`;
  }).join('');
  return `<div class="dq-anios" role="group" aria-label="Año">${botones}</div>`;
}

// Una edición de la lista: la miniatura (un lugar que la parte del DOM llena desde un blob:), la fecha con la marca, el título y la
// cifra de la principal y el resto. Con un id que no sirve, sin enlace ni miniatura
function htmlDeFila(item) {
  const id = idDeEdicion(item?.id);
  const principal = item?.principal ?? {};
  const mini = id === null
    ? '<span class="dq-mini" aria-hidden="true"></span>'
    : `<span class="dq-mini" aria-hidden="true" data-mini="${esc(rutaDelArchivo(id, 'infografia_png'))}"></span>`;
  const cuerpo = `<span class="dq-fila-cuerpo">`
    + `<span class="dq-fila-fecha">${esc(item?.fecha_texto)}${htmlDeMarca(item?.marca)}</span>`
    + `<span class="dq-fila-titulo">${esc(principal.titulo)}</span>`
    + `<span class="dq-fila-cifra">${esc(principal.cifra_clave)}</span>`
    + `${item?.resto ? `<span class="dq-fila-resto">${esc(item.resto)}</span>` : ''}`
    + '</span>';
  return id === null
    ? `<li class="dq-fila"><div class="dq-fila-enlace">${mini}${cuerpo}</div></li>`
    : `<li class="dq-fila"><a class="dq-fila-enlace" href="${esc(urlDeEstado({ id }))}">${mini}${cuerpo}</a></li>`;
}

// La lista de un año: los años (si hay más de uno) y una fila por edición, en el orden del servidor; sin ediciones, el vacío
function htmlDeLaLista(datos) {
  const ediciones = listaDe(datos?.ediciones);
  const cuerpo = ediciones.length > 0
    ? `<ol class="dq-lista">${ediciones.map((item) => htmlDeFila(item)).join('')}</ol>`
    : htmlDelEstado('vacio');
  return `${htmlDeAnios(datos?.anios, datos?.anio)}${cuerpo}`;
}

// =====================================================
// Lo puro: el detalle
// =====================================================

// La agenda de la quincena: la fecha, el título, el detalle y, si es https://, el enlace. Sin eventos, nada
function htmlDeLaAgenda(agenda) {
  const eventos = listaDe(agenda);
  if (eventos.length === 0) return '';
  const filas = eventos.map((evento) => {
    const enlace = esEnlaceSeguro(evento?.url)
      ? ` ${enlaceDeAfuera(evento.url, `Ver<span class="visualmente-oculto"> ${esc(evento?.titulo)}</span>`)}`
      : '';
    return `<li><span class="dq-dia">${esc(evento?.fecha_texto)}</span>`
      + `<span class="dq-evento"><b>${esc(evento?.titulo)}</b> <span>${esc(evento?.detalle)}</span>${enlace}</span></li>`;
  }).join('');
  return '<section class="dq-agenda" aria-labelledby="dq-agenda-titulo">'
    + `<h3 class="dq-seccion-titulo" id="dq-agenda-titulo">Agenda de la quincena</h3><ul>${filas}</ul></section>`;
}

// La foto del RPAD de ese día, cada fila { rotulo, valor } tal como la arma el servidor. Sin filas, nada
function htmlDeLaFoto(foto) {
  const filas = listaDe(foto);
  if (filas.length === 0) return '';
  return `<dl class="dq-foto">${filas.map((fila) => `<div><dt>${esc(fila?.rotulo)}</dt><dd>${esc(fila?.valor)}</dd></div>`).join('')}</dl>`;
}

const htmlDeEtiqueta = (etiqueta) => {
  const clase = typeof etiqueta === 'string' && Object.hasOwn(CLASE_DE_LA_ETIQUETA, etiqueta) ? ` ${CLASE_DE_LA_ETIQUETA[etiqueta]}` : '';
  return `<span class="dq-etiqueta${clase}">${etiqueta === 'Validar' ? ICONO_VALIDAR : ''}${esc(etiqueta)}</span>`;
};

// Un «Copiar» con el texto tal como llega del servidor. Su nombre (aria-label) dice qué copia: hay tres por propuesta y el texto del
// botón cambia a «Copiado» (lo anuncia #dq-anuncio)
const htmlDeCopiar = (texto, nombre, { rotulo = 'Copiar', clase = 'dq-link dq-copiar' } = {}) => `<button type="button" class="${clase}" data-copiar="${esc(texto)}" aria-label="${esc(nombre)}">${rotulo}</button>`;

// Un campo de la propuesta completa: su título (con un «Copiar» al lado, si lo lleva) y su contenido
const htmlDeCampo = (titulo, contenido, copiar = '') => `<div class="dq-campo"><div class="dq-campo-cabeza"><h5>${titulo}</h5>${copiar}</div>${contenido}</div>`;
// Un texto del servidor, con sus saltos de línea (los muestra white-space: pre-line)
const htmlDeTexto = (texto) => `<p class="dq-texto">${esc(texto)}</p>`;

/**
 * Una propuesta: el número y las etiquetas, el título, la cifra, el dataset (con enlace a su página solo con id_enlace, y «en el
 * portal» siempre, con enlace si es https://), la foto del RPAD y, si hay, «Para validar antes de publicar», siempre a la vista.
 * Después, en un <details> (abierto en la principal), la propuesta completa en el orden de la sección 9, y al pie, «Copiar la
 * propuesta».
 */
function htmlDePropuesta(propuesta) {
  const p = propuesta ?? {};
  const principal = p.principal === true;
  const dataset = p.dataset ?? {};
  const idDelDataset = idDeEdicion(dataset.id_enlace);
  const nombre = idDelDataset === null ? esc(dataset.nombre) : `<a href="dataset.html?id=${String(idDelDataset)}">${esc(dataset.nombre)}</a>`;
  const portal = esEnlaceSeguro(dataset.url) ? enlaceDeAfuera(dataset.url, 'en el portal') : 'en el portal';
  const notas = listaDe(p.notas_validacion);
  const validar = notas.length > 0
    ? `<div class="dq-validar"><h5>${ICONO_VALIDAR}Para validar antes de publicar</h5><ul>${notas.map((nota) => `<li>${esc(nota)}</li>`).join('')}</ul></div>`
    : '';
  const borrador = p.borrador_nota ?? {};
  // «Copiar la propuesta (Propuesta 1)»: el de la propuesta entera nombra cuál, con el orden_texto del servidor, y empieza con el texto
  // que se ve (WCAG 2.5.3: quien maneja la página con la voz dice lo que lee)
  const copiarLaPropuesta = typeof p.orden_texto === 'string' && p.orden_texto !== ''
    ? `Copiar la propuesta (${p.orden_texto})`
    : 'Copiar la propuesta';
  const fuentes = listaDe(p.fuentes).map((url) => `<li>${esEnlaceSeguro(url) ? enlaceDeAfuera(url, esc(url)) : esc(url)}</li>`).join('');
  const campos = [
    ...CAMPOS_DE_TEXTO.map(([clave, titulo]) => htmlDeCampo(titulo, htmlDeTexto(p[clave]))),
    htmlDeCampo('Texto para redes', `<div class="dq-redes">${htmlDeTexto(p.texto_redes)}</div>`, htmlDeCopiar(p.texto_redes, 'Copiar el texto para redes')),
    htmlDeCampo('Puntos centrales', `<ul>${listaDe(p.puntos_centrales).map((punto) => `<li>${esc(punto)}</li>`).join('')}</ul>`),
    htmlDeCampo('Borrador de nota', `<div class="dq-nota"><p class="dq-nota-titulo">${esc(borrador.titulo)}</p>${listaDe(borrador.parrafos).map(htmlDeTexto).join('')}</div>`,
      htmlDeCopiar(p.borrador_para_copiar, 'Copiar el borrador')),
    htmlDeCampo('Fuentes', `<ul>${fuentes}</ul>`)
  ].join('');
  return `<li class="dq-propuesta${principal ? ' dq-principal' : ''}">`
    + `<div class="dq-prop-arriba"><span class="dq-orden">${esc(p.orden_texto)}</span>${listaDe(p.etiquetas).map(htmlDeEtiqueta).join('')}</div>`
    + `<h4 class="dq-prop-titulo">${esc(p.titulo)}</h4>`
    + `<p class="dq-cifra">${esc(p.cifra_clave)}</p>`
    + `<p class="dq-dataset">Dataset: ${nombre} · ${portal}</p>`
    + htmlDeLaFoto(p.foto)
    + validar
    + `<details class="dq-completa"${principal ? ' open' : ''}><summary>${ICONO_ABRIR}<span>${principal ? 'La propuesta completa' : 'Ver la propuesta completa'}</span></summary>`
    + `<div class="dq-campos">${campos}</div></details>`
    + `<p class="dq-copiar-todo">${htmlDeCopiar(p.para_copiar, copiarLaPropuesta, { rotulo: 'Copiar la propuesta', clase: 'dq-btn dq-btn-borde dq-btn-chico dq-copiar' })}</p>`
    + '</li>';
}

/**
 * Los archivos de la edición, en el orden del servidor: «Descargar» en cada uno (guarda con el nombre que manda el servidor) y «Ver»
 * en los que se pueden ver (el texto del correo y los cálculos). Sin un id que sirva, nada: no hay a dónde pedirlos.
 */
function htmlDeArchivos(archivos, id) {
  const lista = listaDe(archivos);
  const idDeLaEdicion = idDeEdicion(id);
  if (lista.length === 0 || idDeLaEdicion === null) return '';
  const filas = lista.map((archivo) => {
    const rotulo = esc(archivo?.rotulo);
    const datos = `data-ruta="${esc(rutaDelArchivo(idDeLaEdicion, archivo?.campo))}" data-nombre="${esc(archivo?.nombre)}"`;
    const ver = archivo?.se_puede_ver === true
      ? `<button type="button" class="dq-link" data-ver ${datos} data-rotulo="${rotulo}" aria-label="Ver ${rotulo}">Ver</button>`
      : '';
    return `<li><span class="dq-archivo">${rotulo} <small>${esc(archivo?.detalle)}</small></span>`
      + `<span class="dq-acciones">${ver}<button type="button" class="dq-link" data-descargar ${datos} aria-label="Descargar ${rotulo}">Descargar</button></span></li>`;
  }).join('');
  return `<section class="dq-archivos" aria-labelledby="dq-archivos-titulo"><h3 id="dq-archivos-titulo">Archivos</h3><ul>${filas}</ul></section>`;
}

/**
 * El detalle de una edición: «Todas las ediciones», la fecha grande con la marca, el título, la llegada, el correo y la cantidad, y
 * la nota de archivo si hay (una vacía o de solo espacios no va). A un costado, la infografía (un lugar que la parte del DOM llena
 * desde un blob:) y los archivos; al otro, la agenda (si hay) y las propuestas.
 */
function htmlDelDetalle(detalle) {
  const d = detalle ?? {};
  const id = idDeEdicion(d.id);
  const propuestas = listaDe(d.propuestas);
  const principal = propuestas.find((p) => p?.principal === true) ?? propuestas[0];
  const alternativo = principal?.titulo ? `Infografía de la propuesta principal: ${principal.titulo}` : 'Infografía de la propuesta principal';
  const infografia = id === null
    ? ''
    : `<div class="dq-infografia" data-infografia="${esc(rutaDelArchivo(id, 'infografia_png'))}" data-alt="${esc(alternativo)}"></div>`
      + '<p class="dq-infografia-pie">La infografía de la propuesta principal.</p>';
  // La llegada, el correo y la cantidad, tal como los manda el servidor; el punto después de la cantidad lo pone la página (la maqueta
  // dice «5 propuestas.»)
  const conTexto = (texto) => typeof texto === 'string' && texto !== '';
  const recibo = [d.llegada, d.correo].filter(conTexto).map(esc)
    .concat(conTexto(d.cantidad) ? [`${esc(d.cantidad)}.`] : []).join(' ');
  const nota = typeof d.nota_archivo === 'string' && d.nota_archivo.trim() !== ''
    ? `<p class="dq-nota-archivo"><b>Nota de Grok Bot:</b> ${esc(d.nota_archivo)}</p>`
    : '';
  return `<p class="dq-volver-caja"><a class="dq-link dq-volver" href="${PAGINA_DATO_QUINCENA}">${ICONO_VOLVER}${TEXTO_TODAS_LAS_EDICIONES}</a></p>`
    + '<div class="dq-cabecera">'
    + `<h2 class="dq-fecha">${esc(d.fecha_texto)}${htmlDeMarca(d.marca)}</h2>`
    + `<p class="dq-titulo-paquete">${esc(d.titulo)}</p>`
    + `<p class="dq-recibo">${recibo}</p>`
    + nota
    + '</div>'
    + '<div class="dq-detalle">'
    + `<aside class="dq-lateral" aria-label="Infografía y archivos">${infografia}${htmlDeArchivos(d.archivos, id)}</aside>`
    + '<div class="dq-columna">'
    + htmlDeLaAgenda(d.agenda)
    + '<section aria-labelledby="dq-propuestas-titulo"><h3 class="dq-seccion-titulo" id="dq-propuestas-titulo">Las propuestas</h3>'
    + `<ol class="dq-propuestas">${propuestas.map((propuesta) => htmlDePropuesta(propuesta)).join('')}</ol></section>`
    + '</div></div>';
}

// =====================================================
// «Copiar»
// =====================================================

/**
 * Copia `texto` tal cual. Si copia, el botón dice «Copiado» dos segundos y lo anuncia #dq-anuncio; sin portapapeles (o sin su
 * writeText) o si falla, dice que no se pudo (el texto de la página se puede seleccionar igual) y vuelve al rato. El texto original
 * del botón se guarda la primera vez: un segundo clic mientras dice «Copiado» no lo pierde. Nunca tira; devuelve si copió.
 */
async function copiarTexto(boton, texto, { portapapeles = globalThis.navigator?.clipboard, esperar = setTimeout } = {}) {
  if (boton.dataset && boton.dataset.rotulo === undefined) boton.dataset.rotulo = boton.textContent;
  const original = boton.dataset?.rotulo ?? boton.textContent;
  let copio = false;
  try {
    if (typeof portapapeles?.writeText !== 'function') throw new Error('Sin portapapeles');
    await portapapeles.writeText(String(texto ?? ''));
    copio = true;
  } catch {
    copio = false;
  }
  const mensaje = copio ? MENSAJES_COPIAR.copiado : MENSAJES_COPIAR.fallo;
  boton.textContent = mensaje;
  anunciarDatoQuincena(mensaje);
  esperar(() => { boton.textContent = original; }, copio ? DURACION_COPIADO : DURACION_FALLO);
  return copio;
}

// La región viva de la página (#dq-anuncio, fuera de lo que se vuelve a dibujar). Un texto igual al anterior se cambia apenas (un
// espacio duro al final), para que se vuelva a anunciar
function anunciarDatoQuincena(texto) {
  const region = typeof document !== 'undefined' ? document.getElementById('dq-anuncio') : null;
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// =====================================================
// La página (DOM y API)
// =====================================================

// El estado de la página. `pedido` numera las cargas: una respuesta que llega después de otra más nueva se descarta
const vistaDatoQuincena = { pedido: 0, anio: null, imagenes: new Set(), modal: null };

const elementoDq = (id) => document.getElementById(id);

// Dibuja en #dq-contenido (el contenedor fijo, con los eventos delegados)
function dibujarDatoQuincena(html) {
  elementoDq('dq-contenido').innerHTML = html;
}

// La sesión venció: se cierra y al login
function irAlLoginDesdeDatoQuincena() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}
// API.pedirArchivo no dice el estado: ahí cuenta un token vencido
const sesionVencidaEnArchivo = () => typeof Auth.isTokenExpired === 'function' && Auth.isTokenExpired() === true;

// Un error de la página, en un aviso (showToast no escapa: el texto es fijo y se escapa igual) y en la región viva
function avisarErrorDatoQuincena(mensaje) {
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), 'error');
  anunciarDatoQuincena(mensaje);
}

// Deshabilita el botón mientras dura el pedido (un doble clic manda un solo pedido)
async function conBotonBloqueadoDq(boton, tarea) {
  if (boton.disabled) return;
  boton.disabled = true;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
  }
}

// Descarga un Blob con ese nombre de archivo y libera su URL (copiado de proyectos.js)
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---- Las cargas ----

// La lista de un año (null: el más reciente). Un año pedido sin ediciones, con otros que sí tienen, vuelve a la lista sola. Al
// cambiar de año con un botón, sin «Cargando…» y con el foco en el botón del año nuevo
async function cargarListaDq(anio, { desdeBoton = false } = {}) {
  const pedido = ++vistaDatoQuincena.pedido;
  if (!desdeBoton) dibujarDatoQuincena(htmlDelEstado('cargando'));
  try {
    const consulta = anio === null ? '' : `?anio=${String(anio)}`;
    const datos = (await API.pedirJson('GET', `/dato-quincena/ediciones${consulta}`))?.data;
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (!Array.isArray(datos?.anios) || !Array.isArray(datos?.ediciones)) throw new TypeError('La respuesta no es la lista de ediciones');
    if (anio !== null && datos.ediciones.length === 0 && datos.anios.length > 0) {
      window.history?.replaceState?.(null, '', urlDeEstado({}));
      await cargarListaDq(null, { desdeBoton });
      return;
    }
    vistaDatoQuincena.anio = datos.anio;
    liberarImagenesDq();
    dibujarDatoQuincena(htmlDeLaLista(datos));
    if (desdeBoton) elementoDq('dq-contenido').querySelector(`button[data-anio="${String(datos.anio)}"]`)?.focus();
    for (const lugar of elementoDq('dq-contenido').querySelectorAll('[data-mini]')) ponerImagenDq(lugar, lugar.dataset.mini, 'dq-mini', '');
  } catch (error) {
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    console.error('Error cargando las ediciones:', error);
    liberarImagenesDq();
    dibujarDatoQuincena(htmlDelEstado('error'));
  }
}

// El detalle de una edición. Un 404 es «No existe esa edición.»; otro error, el error
async function cargarDetalleDq(id) {
  const pedido = ++vistaDatoQuincena.pedido;
  dibujarDatoQuincena(htmlDelEstado('cargando'));
  try {
    const detalle = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}`))?.data;
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (detalle === null || typeof detalle !== 'object' || idDeEdicion(detalle.id) === null) throw new TypeError('La respuesta no es una edición');
    dibujarDatoQuincena(htmlDelDetalle(detalle));
    if (typeof detalle.fecha_texto === 'string') document.title = `${detalle.fecha_texto} - El dato de la quincena - RPAD`;
    const lugar = elementoDq('dq-contenido').querySelector('[data-infografia]');
    if (lugar) ponerImagenDq(lugar, lugar.dataset.infografia, 'dq-infografia', lugar.dataset.alt ?? '');
  } catch (error) {
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    if (error?.status === 404) {
      mostrarNoExisteDq();
      return;
    }
    console.error('Error cargando la edición:', error);
    dibujarDatoQuincena(htmlDelEstado('error'));
  }
}

function mostrarNoExisteDq() {
  dibujarDatoQuincena(htmlDelEstado('no-existe'));
  document.title = 'No existe esa edición - El dato de la quincena - RPAD';
}

// ---- Las imágenes, desde un blob: ----

// Pide el PNG con el JWT en el encabezado y pone un <img> en el lugar, si todavía está en la página. Si falla, queda el lugar vacío
async function ponerImagenDq(lugar, ruta, clase, alternativo) {
  let blob;
  try {
    blob = await API.pedirArchivo(ruta);
  } catch {
    return;
  }
  if (!lugar.isConnected) return;
  const url = URL.createObjectURL(blob);
  vistaDatoQuincena.imagenes.add(url);
  const imagen = document.createElement('img');
  imagen.className = clase;
  imagen.alt = alternativo;
  imagen.src = url;
  lugar.replaceWith(imagen);
}

// Libera las URL de las imágenes (al cambiar de año y al salir de la página)
function liberarImagenesDq() {
  for (const url of vistaDatoQuincena.imagenes) URL.revokeObjectURL(url);
  vistaDatoQuincena.imagenes.clear();
}

// ---- Los clics, delegados en #dq-contenido ----

function alTocarDq(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.closest !== 'function') return;
  let boton;
  if ((boton = objetivo.closest('button[data-anio]'))) elegirAnioDq(boton);
  else if ((boton = objetivo.closest('button[data-copiar]'))) copiarTexto(boton, boton.dataset.copiar ?? '');
  else if ((boton = objetivo.closest('button[data-ver]'))) verArchivoDq(boton);
  else if ((boton = objetivo.closest('button[data-descargar]'))) descargarArchivoDq(boton);
}

// Otro año: la dirección lo guarda (sin sumar al historial) y se pide su lista
function elegirAnioDq(boton) {
  const anio = anioQueSirve(Number(boton.dataset.anio));
  if (anio === null || anio === vistaDatoQuincena.anio) return;
  window.history?.replaceState?.(null, '', urlDeEstado({ anio }));
  cargarListaDq(anio, { desdeBoton: true });
}

// «Descargar»: con el JWT en el encabezado y el nombre que manda el servidor
function descargarArchivoDq(boton) {
  return conBotonBloqueadoDq(boton, async () => {
    try {
      descargarBlob(await API.pedirArchivo(boton.dataset.ruta), boton.dataset.nombre || 'archivo');
    } catch {
      if (sesionVencidaEnArchivo()) irAlLoginDesdeDatoQuincena();
      else avisarErrorDatoQuincena('No se pudo descargar el archivo. Probá de nuevo en unos minutos.');
    }
  });
}

// «Ver»: el texto en el modal, puesto con textContent (nunca como HTML), y su «Descargar» baja lo mismo sin volver a pedirlo
function verArchivoDq(boton) {
  return conBotonBloqueadoDq(boton, async () => {
    let blob;
    let texto;
    try {
      blob = await API.pedirArchivo(boton.dataset.ruta);
      texto = await blob.text();
    } catch {
      if (sesionVencidaEnArchivo()) irAlLoginDesdeDatoQuincena();
      else avisarErrorDatoQuincena('No se pudo abrir el archivo. Probá de nuevo en unos minutos.');
      return;
    }
    abrirModalDq({ titulo: boton.dataset.rotulo ?? '', texto, blob, nombre: boton.dataset.nombre || 'archivo', volverA: boton });
  });
}

// ---- El modal de «Ver» (como los de Proyectos) ----

function abrirModalDq({ titulo, texto, blob, nombre, volverA }) {
  const modal = elementoDq('dq-modal');
  elementoDq('dq-modal-titulo').textContent = titulo;
  elementoDq('dq-modal-texto').textContent = texto;
  elementoDq('dq-modal-descargar').setAttribute('aria-label', `Descargar ${nombre}`);
  const abierto = { blob, nombre, volverA };
  vistaDatoQuincena.modal = abierto;
  modal.classList.add('active');
  // El foco, después de la transición del velo (hasta que termina, no deja enfocar)
  setTimeout(() => {
    if (vistaDatoQuincena.modal === abierto) modal.querySelector('.modal-close')?.focus();
  }, 100);
}

function cerrarModalDq() {
  const abierto = vistaDatoQuincena.modal;
  if (!abierto) return;
  vistaDatoQuincena.modal = null;
  elementoDq('dq-modal').classList.remove('active');
  elementoDq('dq-modal-texto').textContent = '';
  if (abierto.volverA?.isConnected !== false) abierto.volverA?.focus?.();
}

// Cierran la ×, «Cerrar» (data-cerrar), Escape y el clic en el velo, solo si empezó en el velo (soltar ahí una selección de texto que
// empezó en el modal no lo cierra)
function conectarModalDq() {
  const modal = elementoDq('dq-modal');
  let desdeElVelo = false;
  modal.addEventListener('mousedown', (evento) => {
    desdeElVelo = evento.target === modal;
  });
  modal.addEventListener('click', (evento) => {
    const cerrar = Boolean(evento.target?.closest?.('[data-cerrar]')) || (evento.target === modal && desdeElVelo);
    desdeElVelo = false;
    if (cerrar) cerrarModalDq();
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || !vistaDatoQuincena.modal) return;
    evento.preventDefault?.();
    cerrarModalDq();
  });
  elementoDq('dq-modal-descargar').addEventListener('click', () => {
    const abierto = vistaDatoQuincena.modal;
    if (abierto) descargarBlob(abierto.blob, abierto.nombre);
  });
}

// ---- El arranque ----

// Todos los roles con sesión ven la página entera; sin sesión, al login. Sin ?id=, la lista (del año de ?anio=, o el más reciente);
// con ?id=N, el detalle (un id que no es un entero positivo, «No existe esa edición.» sin pedirlo)
function iniciarDatoQuincena() {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return undefined;
  }
  elementoDq('dq-contenido').addEventListener('click', alTocarDq);
  conectarModalDq();
  // Al salir se liberan las imágenes; no si la página queda guardada para «Atrás» (volvería con las imágenes rotas)
  window.addEventListener('pagehide', (evento) => {
    if (!evento.persisted) liberarImagenesDq();
  });
  const search = String(window.location.search ?? '');
  const estado = estadoDeLaUrl(search);
  if (new URLSearchParams(search.replace(/^\?/, '')).has('id')) {
    if (estado.id === null) {
      mostrarNoExisteDq();
      return undefined;
    }
    return cargarDetalleDq(estado.id);
  }
  return cargarListaDq(estado.anio);
}

document.addEventListener('DOMContentLoaded', iniciarDatoQuincena);
