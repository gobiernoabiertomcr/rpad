/**
 * El dato de la quincena - RPAD (specs 2026-11-07-dato-quincena, 9, 10 y 11, y 2026-11-12-dato-quincena-correo, 12 y 13)
 * El archivo de las ediciones que arma Datito (el bot: NOMBRE_DEL_BOT), de solo lectura, para todos los roles con sesión: la lista
 * de un año (sin ?id=; ?anio=AAAA elige el año, &pagina=N la página de a 18), en tarjetas tipo diario con la pastilla del envío del
 * correo, y el detalle de una edición (?id=N), con la infografía y los archivos a un costado y la agenda y las propuestas al otro.
 * La principal va abierta y las otras, cerradas; las notas para validar y la repetición de otra edición (spec
 * 2026-11-14-dato-quincena-v1-3, 4), siempre a la vista; y tres «Copiar» por propuesta (el texto para redes, el borrador y la
 * propuesta entera).
 * Para la administración (Auth.isAdmin()) hay además dos pestañas, Ediciones y Correo (#correo en la dirección, junto a ?id, ?anio
 * y &pagina, que son de Ediciones): Correo tiene el interruptor del envío automático (se guarda al cambiarlo; al prenderlo,
 * pregunta), las próximas ediciones y quién lo recibe, con «Guardar»; y el detalle suma, debajo de «Archivos», la caja del correo
 * de la edición, con «Reenviar…» (un diálogo) y «Enviarme una prueba». Los demás roles no ven ni piden nada de eso.
 * El servidor arma todos los textos (las fechas, la marca del piloto, la llegada, el correo, la cantidad, el resto, la foto del RPAD,
 * los tamaños, lo que se copia, las próximas, los estados de cada persona y los avisos: GET /api/dato-quincena/ediciones,
 * /ediciones/:id, /correo y /ediciones/:id/correo) y la página los imprime tal cual: no recalcula nada. La única copia de una regla
 * es textoDeLosQueReciben, para contar mientras se tilda, atada por un test de paridad. Todo texto del servidor pasa por
 * Utils.escapeHtml (también en los data-, alt y aria-label), un número se escribe con String (Utils.escapeHtml(0) da '') y una
 * dirección de afuera solo es un enlace si empieza con https://, con rel="noopener noreferrer".
 * Al cargarse el archivo solo declara y engancha DOMContentLoaded: lo que arma HTML es puro y recibe los datos y quién mira por
 * parámetro (tests/dato-quincena-frontend.test.js lo carga en un vm, después del main.js y del api.js de verdad, como la página);
 * lo que toca el DOM o la API va aparte, al final (iniciarDatoQuincena): las cargas y los cambios (API.pedirJson: su error trae el
 * estado y el texto del servidor), la infografía desde un blob: (API.pedirArchivo + URL.createObjectURL, liberada al cambiar de
 * pestaña y al salir), «Ver» en un modal con textContent, «Descargar» con el nombre que manda el servidor (API.pedirArchivo no da
 * el Content-Disposition) y «Copiar». Los eventos van delegados en #dq-contenido, en las pestañas y en los dos diálogos, que no se
 * vuelven a dibujar; lo que cambia se anuncia en #dq-anuncio. Los botones que mandan algo quedan deshabilitados hasta la respuesta.
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
// El nombre del bot: el servidor tiene el suyo (NOMBRE_DEL_BOT) y la página, este; el HTML estático no lo nombra
const NOMBRE_DEL_BOT = 'Datito';
// De a cuántas ediciones se muestra la lista
const POR_PAGINA = 18;

const TEXTOS_DEL_ESTADO = Object.freeze({
  cargando: 'Cargando…',
  error: 'No se pudieron cargar las ediciones. Probá de nuevo en unos minutos.',
  errorCorreo: 'No se pudo cargar el correo. Probá de nuevo en unos minutos.',
  vacio: `Todavía no llegó ninguna edición. ${NOMBRE_DEL_BOT} manda cada una cada dos lunes.`,
  noExiste: 'No existe esa edición.'
});
const TEXTO_TODAS_LAS_EDICIONES = 'Todas las ediciones';

// Los títulos de la ventana: el de la página (la lista), el de la pestaña Correo y, en el detalle, la fecha delante
const TITULO_DQ = 'El dato de la quincena - RPAD';
const TITULO_CORREO_DQ = `Correo - ${TITULO_DQ}`;

// La pestaña Correo y la caja del correo del detalle (spec 2026-11-12-dato-quincena-correo, 9 y 13): los textos de la página. Lo
// que dice cómo está cada cosa lo arma el servidor; estos son la explicación fija y los avisos cuando el servidor no contesta
const TEXTO_CONFIRMAR_ENVIO = 'Desde ahora, cada edición regular que llegue sale por correo a la lista. ¿Prendemos el envío automático?';
const TEXTO_NOTA_DEL_REENVIO = 'Sale ahora, aunque hoy no sea día hábil, con el mismo asunto.';
const TEXTOS_DEL_CORREO = Object.freeze({
  sinProximas: 'No se pudieron estimar las próximas ediciones. Probá de nuevo en unos minutos.',
  errorDeLaCaja: 'No se pudo cargar el correo de esta edición. Probá de nuevo en unos minutos.',
  envio: 'No se pudo cambiar el envío automático. Probá de nuevo en unos minutos.',
  lista: 'No se pudo guardar la lista. Probá de nuevo en unos minutos.',
  reenvio: 'No se pudo reenviar la edición. Probá de nuevo en unos minutos.',
  prueba: 'No se pudo mandar la prueba. Probá de nuevo en unos minutos.'
});

// Las etiquetas de una propuesta: «Principal» en tinta, «Agenda» en cielo, «Validar» en sol con un ícono y «Repite» en blanco con
// borde y su ícono (nunca solo el color). «Efeméride» y cualquier otra, sin clase: el estilo neutro de .dq-etiqueta
const CLASE_DE_LA_ETIQUETA = Object.freeze({
  Principal: 'dq-et-principal', Agenda: 'dq-et-agenda', Validar: 'dq-et-validar', Repite: 'dq-et-repite'
});

// Los campos de texto de la propuesta completa, en el orden de la sección 9 (el mismo de «Copiar la propuesta»); después van el texto
// para redes, los puntos centrales, el borrador y las fuentes
const CAMPOS_DE_TEXTO = Object.freeze([
  ['calculo', 'Cómo se calculó'],
  ['contexto_historico', 'Contexto histórico'],
  ['por_que_hoy', 'Por qué hoy'],
  ['angulo', 'Ángulo'],
  ['idea_placa', 'Idea de placa']
]);

// Los íconos de Lucide, decorativos: triangle-alert (Validar), history (Repite y la caja de la repetición), chevron-right (la
// propuesta completa) y chevron-left (volver)
const ATRIBUTOS_DEL_ICONO = 'aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONO_VALIDAR = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const ICONO_REPITE = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`;
const ICONO_DE_LA_ETIQUETA = Object.freeze({ Validar: ICONO_VALIDAR, Repite: ICONO_REPITE });
const ICONO_ABRIR = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="m9 18 6-6-6-6"/></svg>`;
// Los íconos de la pastilla del envío (la maqueta aprobada): el texto dice qué pasó y el ícono lo acompaña, nunca solo el color
const ATRIBUTOS_PASTILLA = 'aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const ICONO_CHECK = `<svg ${ATRIBUTOS_PASTILLA}><path d="M20 6 9 17l-5-5"/></svg>`;
const ICONO_RELOJ = `<svg ${ATRIBUTOS_PASTILLA}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
const ICONO_AVISO = `<svg ${ATRIBUTOS_PASTILLA}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const ICONO_GUION = `<svg ${ATRIBUTOS_PASTILLA}><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>`;
const ICONO_DEL_ENVIO = Object.freeze({
  enviada: ICONO_CHECK, programada: ICONO_RELOJ, espera: ICONO_AVISO, parcial: ICONO_AVISO, fallida: ICONO_AVISO,
  no_enviada: ICONO_GUION, piloto: ICONO_GUION
});
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
 * Lo que pide la dirección: `{ id, anio, pagina, correo }`. El id, un entero positivo escrito con cifras (sin ceros adelante); el
 * año, cuatro cifras de 2000 a 2100; la página, un entero positivo (1 si no); el correo, solo con el #correo. Lo demás, null / 1 / false.
 */
function estadoDeLaUrl(search, hash = '') {
  const parametros = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const textoDelId = parametros.get('id') ?? '';
  const textoDelAnio = parametros.get('anio') ?? '';
  const textoDeLaPagina = parametros.get('pagina') ?? '';
  const pagina = /^[1-9]\d{0,8}$/.test(textoDeLaPagina) ? Number(textoDeLaPagina) : 1;
  return {
    id: /^[1-9]\d*$/.test(textoDelId) ? idDeEdicion(Number(textoDelId)) : null,
    anio: /^\d{4}$/.test(textoDelAnio) ? anioQueSirve(Number(textoDelAnio)) : null,
    pagina,
    correo: String(hash ?? '') === '#correo'
  };
}

// La dirección de una vista: lo que pide Ediciones (el detalle con su id, la lista de un año con su página desde la 2, o la lista
// sola) y, en la pestaña Correo, #correo al final (spec 2026-11-12-dato-quincena-correo, 13: así volver a Ediciones vuelve a lo mismo)
function urlDeEstado({ id = null, anio = null, pagina = 1, correo = false } = {}) {
  const hash = correo === true ? '#correo' : '';
  if (idDeEdicion(id) !== null) return `${PAGINA_DATO_QUINCENA}?id=${String(id)}${hash}`;
  if (anioQueSirve(anio) !== null) {
    const dePagina = Number.isSafeInteger(pagina) && pagina > 1 ? `&pagina=${String(pagina)}` : '';
    return `${PAGINA_DATO_QUINCENA}?anio=${String(anio)}${dePagina}${hash}`;
  }
  return `${PAGINA_DATO_QUINCENA}${hash}`;
}

// Una dirección de afuera solo se dibuja como enlace si empieza con https:// (spec 10)
function esEnlaceSeguro(url) {
  return typeof url === 'string' && url.startsWith('https://');
}

// La ruta de un archivo de una edición, para API.pedirArchivo (el JWT va en el encabezado, nunca en la dirección)
const rutaDelArchivo = (id, campo) => `/dato-quincena/ediciones/${String(id)}/archivos/${encodeURIComponent(String(campo ?? ''))}`;

// Un enlace de afuera que abre en otra pestaña
const enlaceDeAfuera = (url, contenido) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${contenido}</a>`;

// La bajada de la página: la escribe el script para que el HTML estático no nombre al bot
function textoDeLaBajada() {
  return `Las propuestas de comunicación que arma ${NOMBRE_DEL_BOT} cada dos lunes, tal como llegaron. `
    + 'Son internas: guardarlas acá no las aprueba ni las publica. El RPAD las manda por correo a las personas de la lista.';
}

const listaDe = (valor) => (Array.isArray(valor) ? valor : []);
const htmlDeMarca = (marca) => (marca ? `<span class="dq-marca">${esc(marca)}</span>` : '');

// =====================================================
// Lo puro: los estados y la lista
// =====================================================

// Cargando, el error (el de las ediciones y el de la pestaña Correo), el archivo vacío y una edición que no existe (con «Todas las
// ediciones»). Otro tipo, nada
function htmlDelEstado(tipo) {
  if (tipo === 'cargando') return `<p class="dq-estado" role="status">${TEXTOS_DEL_ESTADO.cargando}</p>`;
  if (tipo === 'error') return `<div class="dq-estado dq-error" role="alert"><p>${TEXTOS_DEL_ESTADO.error}</p></div>`;
  if (tipo === 'error-correo') return `<div class="dq-estado dq-error" role="alert"><p>${TEXTOS_DEL_ESTADO.errorCorreo}</p></div>`;
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

// La página `pedida` de las ediciones: una fuera de rango (o que no es un entero positivo) va a la última que existe / a la primera.
// `desde` y `hasta` son posiciones de 1 en adelante (0 sin ediciones), para «Mostrando 1–18 de 27»
function paginaDeEdiciones(ediciones, pedida) {
  const todas = listaDe(ediciones);
  const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
  const pagina = Number.isSafeInteger(pedida) && pedida > 0 ? Math.min(pedida, paginas) : (pedida === Infinity ? paginas : 1);
  const inicio = (pagina - 1) * POR_PAGINA;
  const visibles = todas.slice(inicio, inicio + POR_PAGINA);
  return { pagina, paginas, desde: visibles.length > 0 ? inicio + 1 : 0, hasta: inicio + visibles.length, total: todas.length, visibles };
}

// «Anterior», «Página 1 de 2» con «Mostrando 1–18 de 27» y «Siguiente». Con una sola página, nada
function htmlDePaginasDeEdiciones({ pagina, paginas, desde, hasta, total } = {}) {
  if (!(paginas > 1)) return '';
  const boton = (destino, texto, apagado) => (apagado
    ? `<button type="button" class="dq-btn dq-btn-borde dq-pag" disabled>${texto}</button>`
    : `<button type="button" class="dq-btn dq-btn-borde dq-pag" data-pagina="${String(destino)}">${texto}</button>`);
  return '<nav class="dq-paginas" aria-label="Páginas de las ediciones">'
    + `${boton(pagina - 1, 'Anterior', pagina <= 1)}`
    + `<span class="dq-pagina-texto">Página ${numeroComoTexto(pagina)} de ${numeroComoTexto(paginas)}`
    + `<small>Mostrando ${numeroComoTexto(desde)}–${numeroComoTexto(hasta)} de ${numeroComoTexto(total)}</small></span>`
    + `${boton(pagina + 1, 'Siguiente', pagina >= paginas)}</nav>`;
}

// La pastilla del envío del correo: el texto es del servidor; la clase y el ícono, solo de los tipos que se conocen. Sin envío, nada
function htmlDeLaPastilla(envio) {
  if (envio === null || typeof envio !== 'object') return '';
  const conocido = typeof envio.tipo === 'string' && Object.hasOwn(ICONO_DEL_ENVIO, envio.tipo);
  return `<span class="dq-envio${conocido ? ` dq-envio-${envio.tipo}` : ''}">${conocido ? ICONO_DEL_ENVIO[envio.tipo] : ''}${esc(envio.texto)}</span>`;
}

/**
 * Una edición de la lista, «tipo diario»: «El dato de la quincena» con el N.º (o la marca de un piloto) y la doble línea, la fecha en tres
 * renglones, la cantidad, el título de la principal y la pastilla del envío. El enlace está en la fecha y se estira a toda la tarjeta
 * (::after): un solo enlace. Con un id que no sirve, sin enlace. Entre los renglones de la fecha va un espacio (la grilla no lo
 * dibuja): copiada o leída en voz alta dice «Lunes 16 de noviembre de 2026», no «Lunes16 de noviembrede 2026».
 */
function htmlDeTarjeta(item) {
  const id = idDeEdicion(item?.id);
  const partes = item?.fecha_partes;
  const fecha = partes !== null && typeof partes === 'object'
    ? `<span class="dq-fd-dia">${esc(partes.dia)}</span> <span class="dq-fd-fecha">${esc(partes.fecha)}</span> <span class="dq-fd-anio">${esc(partes.anio)}</span>`
    : `<span class="dq-fd-fecha">${esc(item?.fecha_texto)}</span>`;
  const numero = item?.marca
    ? htmlDeMarca(item.marca)
    : (item?.numero ? `<span class="dq-numero">${esc(item.numero)}</span>` : '');
  const pastilla = htmlDeLaPastilla(item?.envio);
  return '<li class="dq-tarjeta">'
    + `<p class="dq-cabecera-diario"><span>El dato de la quincena</span>${numero}</p>`
    + `<h3 class="dq-fecha-diario">${id === null ? `<span class="dq-tarjeta-enlace">${fecha}</span>` : `<a class="dq-tarjeta-enlace" href="${esc(urlDeEstado({ id }))}">${fecha}</a>`}</h3>`
    + `${item?.cantidad ? `<p class="dq-cuantas-prop">${esc(item.cantidad)}</p>` : ''}`
    + `<p class="dq-principal-diario">${esc(item?.principal?.titulo)}</p>`
    + `${pastilla ? `<div class="dq-tarjeta-pie">${pastilla}</div>` : ''}`
    + '</li>';
}

// Las pestañas de la administración: Ediciones y Correo (una `activa`; otra cosa es Ediciones). Solo se llama con Auth.isAdmin()
function htmlDePestanas(activa) {
  const pestana = (clave, texto) => {
    const elegida = clave === (activa === 'correo' ? 'correo' : 'ediciones');
    return `<button type="button" class="dq-pestana${elegida ? ' dq-activa' : ''}" role="tab" id="dq-tab-${clave}" aria-selected="${elegida}" aria-controls="dq-contenido"${elegida ? '' : ' tabindex="-1"'} data-pestana="${clave}">${texto}</button>`;
  };
  return `<div class="dq-pestanas" role="tablist" aria-label="El dato de la quincena">${pestana('ediciones', 'Ediciones')}${pestana('correo', 'Correo')}</div>`;
}

// La lista de un año: los años (si hay más de uno) con «Ediciones de 2026: 27», las tarjetas de la página pedida y las páginas;
// sin ediciones, el vacío
function htmlDeLaLista(datos, pagina = 1) {
  const ediciones = listaDe(datos?.ediciones);
  if (ediciones.length === 0) return htmlDelEstado('vacio');
  const vista = paginaDeEdiciones(ediciones, pagina);
  const cuantas = datos?.anio === null || datos?.anio === undefined
    ? ''
    : `<p class="dq-cuantas">Ediciones de ${numeroComoTexto(datos.anio)}: ${numeroComoTexto(vista.total)}</p>`;
  return `<div class="dq-lista-arriba" id="dq-lista-arriba" tabindex="-1">${htmlDeAnios(datos?.anios, datos?.anio)}${cuantas}</div>`
    + `<ol class="dq-tarjetas">${vista.visibles.map((item) => htmlDeTarjeta(item)).join('')}</ol>${htmlDePaginasDeEdiciones(vista)}`;
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
    const etiqueta = typeof evento?.etiqueta === 'string' && evento.etiqueta !== ''
      ? ` <span class="dq-etiqueta-agenda">${esc(evento.etiqueta)}</span>`
      : '';
    return `<li><span class="dq-dia">${esc(evento?.fecha_texto)}</span>`
      + `<span class="dq-evento"><b>${esc(evento?.titulo)}</b>${etiqueta} <span>${esc(evento?.detalle)}</span>${enlace}</span></li>`;
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
  const icono = typeof etiqueta === 'string' && Object.hasOwn(ICONO_DE_LA_ETIQUETA, etiqueta) ? ICONO_DE_LA_ETIQUETA[etiqueta] : '';
  return `<span class="dq-etiqueta${clase}">${icono}${esc(etiqueta)}</span>`;
};

/**
 * La repetición de otra edición (spec 2026-11-14-dato-quincena-v1-3, 4), tal como la arma el servidor: el ícono y el texto en
 * negrita, como enlace al detalle de esa edición solo con un id que sirve, y abajo el motivo. Sin repetición (null, sin la clave o
 * algo que no es un objeto), nada.
 */
function htmlDeLaRepeticion(repeticion) {
  if (repeticion === null || typeof repeticion !== 'object') return '';
  const id = idDeEdicion(repeticion.id_edicion);
  const texto = id === null ? esc(repeticion.texto) : `<a href="${PAGINA_DATO_QUINCENA}?id=${String(id)}">${esc(repeticion.texto)}</a>`;
  return `<div class="dq-repite"><p class="dq-repite-texto">${ICONO_REPITE}<b>${texto}</b></p>`
    + `<p class="dq-repite-motivo">${esc(repeticion.motivo)}</p></div>`;
}

// Un «Copiar» con el texto tal como llega del servidor. Su nombre (aria-label) dice qué copia: hay tres por propuesta y el texto del
// botón cambia a «Copiado» (lo anuncia #dq-anuncio)
const htmlDeCopiar = (texto, nombre, { rotulo = 'Copiar', clase = 'dq-link dq-copiar' } = {}) => `<button type="button" class="${clase}" data-copiar="${esc(texto)}" aria-label="${esc(nombre)}">${rotulo}</button>`;

// Un campo de la propuesta completa: su título (con un «Copiar» al lado, si lo lleva) y su contenido
const htmlDeCampo = (titulo, contenido, copiar = '') => `<div class="dq-campo"><div class="dq-campo-cabeza"><h5>${titulo}</h5>${copiar}</div>${contenido}</div>`;
// Un texto del servidor, con sus saltos de línea (los muestra white-space: pre-line)
const htmlDeTexto = (texto) => `<p class="dq-texto">${esc(texto)}</p>`;

/**
 * Una propuesta: el número y las etiquetas, el título, la cifra, el dataset (con enlace a su página solo con id_enlace, y «en el
 * portal» siempre, con enlace si es https://), la foto del RPAD y, si hay, la repetición de otra edición y «Para validar antes de
 * publicar», siempre a la vista.
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
    + htmlDeLaRepeticion(p.repeticion)
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

// La llegada, el correo y la cantidad, tal como los manda el servidor; el punto después de la cantidad lo pone la página (la maqueta
// dice «5 propuestas.»). Es el renglón que se vuelve a dibujar con la línea nueva después de un reenvío o una prueba
function htmlDelRecibo(detalle) {
  const d = detalle ?? {};
  const conTexto = (texto) => typeof texto === 'string' && texto !== '';
  return [d.llegada, d.correo].filter(conTexto).map(esc)
    .concat(conTexto(d.cantidad) ? [`${esc(d.cantidad)}.`] : []).join(' ');
}

// El lugar de la caja del correo en el detalle de la administración, con «Cargando…» hasta que llega (sin ids: la caja que llega
// trae los suyos)
const LUGAR_DE_LA_CAJA_DEL_CORREO = '<div id="dq-envio-lugar"><section class="dq-envio-caja" aria-label="Correo"><h3>Correo</h3>'
  + `<p>${TEXTOS_DEL_ESTADO.cargando}</p></section></div>`;

/**
 * El detalle de una edición: «Todas las ediciones», la fecha grande con la marca, el título, la llegada, el correo y la cantidad, y
 * la nota de archivo si hay (una vacía o de solo espacios no va). A un costado, la infografía (un lugar que la parte del DOM llena
 * desde un blob:) y los archivos; al otro, la agenda (si hay) y las propuestas. Para la administración (`admin`, el true literal),
 * debajo de «Archivos», el lugar de la caja del correo, que la parte del DOM pide y llena; con ella, el costado ya no queda fijo al
 * bajar (sería más alto que la pantalla y sus botones quedarían fuera de la vista).
 */
function htmlDelDetalle(detalle, { admin = false } = {}) {
  const d = detalle ?? {};
  const id = idDeEdicion(d.id);
  const conCorreo = admin === true && id !== null;
  const propuestas = listaDe(d.propuestas);
  const principal = propuestas.find((p) => p?.principal === true) ?? propuestas[0];
  const alternativo = principal?.titulo ? `Infografía de la propuesta principal: ${principal.titulo}` : 'Infografía de la propuesta principal';
  const infografia = id === null
    ? ''
    : `<div class="dq-infografia" data-infografia="${esc(rutaDelArchivo(id, 'infografia_png'))}" data-alt="${esc(alternativo)}"></div>`
      + '<p class="dq-infografia-pie">La infografía de la propuesta principal.</p>';
  const lateral = conCorreo
    ? '<aside class="dq-lateral dq-lateral-con-correo" aria-label="Infografía, archivos y correo">'
    : '<aside class="dq-lateral" aria-label="Infografía y archivos">';
  const nota = typeof d.nota_archivo === 'string' && d.nota_archivo.trim() !== ''
    ? `<p class="dq-nota-archivo"><b>Nota de ${esc(NOMBRE_DEL_BOT)}:</b> ${esc(d.nota_archivo)}</p>`
    : '';
  return `<p class="dq-volver-caja"><a class="dq-link dq-volver" href="${PAGINA_DATO_QUINCENA}">${ICONO_VOLVER}${TEXTO_TODAS_LAS_EDICIONES}</a></p>`
    + '<div class="dq-cabecera">'
    + `<h2 class="dq-fecha">${esc(d.fecha_texto)}${htmlDeMarca(d.marca || d.numero)}</h2>`
    + `<p class="dq-titulo-paquete">${esc(d.titulo)}</p>`
    + `<p class="dq-recibo">${htmlDelRecibo(d)}</p>`
    + nota
    + '</div>'
    + '<div class="dq-detalle">'
    + `${lateral}${infografia}${htmlDeArchivos(d.archivos, id)}${conCorreo ? LUGAR_DE_LA_CAJA_DEL_CORREO : ''}</aside>`
    + '<div class="dq-columna">'
    + htmlDeLaAgenda(d.agenda)
    + '<section aria-labelledby="dq-propuestas-titulo"><h3 class="dq-seccion-titulo" id="dq-propuestas-titulo">Las propuestas</h3>'
    + `<ol class="dq-propuestas">${propuestas.map((propuesta) => htmlDePropuesta(propuesta)).join('')}</ol></section>`
    + '</div></div>';
}

// =====================================================
// Lo puro: la pestaña Correo, la caja del correo del detalle y el diálogo de «Reenviar» (spec 2026-11-12-dato-quincena-correo, 13)
// =====================================================

// La copia del navegador de textoDeLosQueReciben (services/datoQuincenaCorreoReglas.js): el pie de «Quién lo recibe» mientras se
// tilda, antes de guardar. Al cargar, el pie es el del servidor (reciben_texto). Atada por un test de paridad
function textoDeLosQueReciben(cantidad) {
  if (cantidad === 0) return 'Todavía no lo recibe nadie.';
  return cantidad === 1 ? 'Lo recibe 1 persona.' : `Lo reciben ${String(cantidad)} personas.`;
}

// Lo que dice el interruptor al lado (el estado también lo da la casilla: role="switch", prendida o no)
const textoDelInterruptorDq = (activo) => `Envío automático ${activo === true ? 'prendido' : 'apagado'}`;

// Las próximas ediciones con los textos del servidor; la que se corre (con motivo), marcada: el texto dice por qué. Sin ninguna (el
// servidor no pudo leer el calendario), lo dice
function htmlDeLasProximas(proximas) {
  const lista = listaDe(proximas);
  if (lista.length === 0) return `<p class="dq-suave">${TEXTOS_DEL_CORREO.sinProximas}</p>`;
  const filas = lista.map((proxima) => `<li><b>Edición del ${esc(proxima?.edicion_texto)}</b>`
    + `<span${proxima?.motivo ? ' class="dq-corrida"' : ''}>${esc(proxima?.texto)}</span></li>`).join('');
  return `<ul class="dq-proximas">${filas}</ul>`;
}

// Una persona activa en la tabla de «Quién lo recibe»: su nombre con el cargo y, si está de licencia hoy, hasta cuándo; el rol; el
// correo; y su casilla. Sin un id que sirva, sin casilla (no habría a quién guardar)
function htmlDePersonaDelCorreo(persona) {
  const p = persona ?? {};
  const id = idDeEdicion(p.id);
  const nombre = esc(p.nombre);
  const cargo = typeof p.cargo === 'string' && p.cargo !== '' ? `<small>${esc(p.cargo)}</small>` : '';
  const licencia = typeof p.licencia === 'string' && p.licencia !== '' ? `<small class="dq-licencia">${esc(p.licencia)}</small>` : '';
  const casilla = id === null
    ? ''
    : `<input type="checkbox" data-usuario="${String(id)}" aria-label="${nombre} recibe el mail"${p.recibe === true ? ' checked' : ''}>`;
  return `<tr><td>${nombre}${cargo}${licencia}</td><td>${esc(p.rol)}</td><td class="dq-col-correo">${esc(p.email)}</td>`
    + `<td class="dq-col-recibe">${casilla}</td></tr>`;
}

/**
 * La pestaña Correo (GET /dato-quincena/correo): «Envío por correo», con el interruptor «Envío automático» (prendido solo con el
 * true literal), la regla, lo que pasa apagado y «Las próximas ediciones»; y «Quién lo recibe», con la tabla de las personas
 * activas, el pie del servidor («Lo recibe 1 persona.») y «Guardar».
 */
function htmlDelCorreo(datos) {
  const d = datos ?? {};
  const activo = d.envio_activo === true;
  const filas = listaDe(d.personas).map(htmlDePersonaDelCorreo).join('');
  return '<div class="dq-correo">'
    + '<section class="dq-caja" aria-labelledby="dq-auto-titulo">'
    + '<div class="dq-caja-cabeza"><h2 id="dq-auto-titulo">Envío por correo</h2>'
    + `<label class="dq-switch" for="dq-envio-activo"><input type="checkbox" id="dq-envio-activo" role="switch" aria-label="Envío automático"${activo ? ' checked' : ''}>`
    + `<span id="dq-envio-estado">${textoDelInterruptorDq(activo)}</span></label></div>`
    + '<p>Cada edición regular sale por correo, con el asunto «Dato de la Quincena» y su fecha, a las <b>8:05 del primer día hábil</b> '
    + 'en que ya está en el RPAD. Si llega después de las 8:05 de un día hábil, sale a las 14:00. Los pilotos no se envían.</p>'
    + '<p class="dq-suave">Apagado, las ediciones se siguen guardando acá y no sale ningún mail.</p>'
    + `<h3 class="dq-caja-subtitulo">Las próximas ediciones</h3>${htmlDeLasProximas(d.proximas)}`
    + '<p class="dq-suave dq-calendario">Con el calendario de días hábiles del RPAD: los 9 feriados fijos y los de Configuración → Feriados.</p>'
    + '</section>'
    + '<section class="dq-caja" aria-labelledby="dq-quien-titulo">'
    + '<div class="dq-caja-cabeza"><h2 id="dq-quien-titulo">Quién lo recibe</h2></div>'
    + '<p>A cada persona le llega su propio mail, a la casilla de su cuenta. Si ese día está de licencia, no le llega.</p>'
    + '<div class="dq-tabla-caja"><table class="dq-tabla" aria-labelledby="dq-quien-titulo"><thead><tr><th scope="col">Persona</th><th scope="col">Rol</th>'
    + '<th scope="col" class="dq-col-correo">Correo</th><th scope="col" class="dq-col-recibe">Lo recibe</th></tr></thead>'
    + `<tbody>${filas}</tbody></table></div>`
    + `<div class="dq-correo-pie"><p class="dq-suave" id="dq-cuantas-reciben">${esc(d.reciben_texto)}</p>`
    + '<button type="button" class="dq-btn dq-btn-tinta" data-guardar-lista>Guardar</button></div>'
    + '</section></div>';
}

/**
 * La caja «Correo» del detalle, para la administración (GET /dato-quincena/ediciones/:id/correo): el resumen; una fila por persona
 * del envío automático, con su estado (la que no lo recibió, en ámbar: el texto dice qué pasó); los reenvíos y las pruebas; y los
 * botones: «Reenviar…» solo con se_puede_reenviar (el true literal) y «Enviarme una prueba» siempre. Sin datos, el error, sin botones.
 */
function htmlDeLaCajaDelCorreo(datos) {
  const abre = '<section class="dq-envio-caja" aria-labelledby="dq-caja-correo-titulo"><h3 id="dq-caja-correo-titulo">Correo</h3>';
  if (datos === null || typeof datos !== 'object') return `${abre}<p>${TEXTOS_DEL_CORREO.errorDeLaCaja}</p></section>`;
  const personas = listaDe(datos.personas);
  const filas = personas.length === 0
    ? ''
    : `<ul class="dq-envio-personas">${personas.map((persona) => `<li><span>${esc(persona?.nombre)}</span>`
      + `<small>${persona?.mal === true ? `<span class="dq-mal">${esc(persona?.texto)}</span>` : esc(persona?.texto)}</small></li>`).join('')}</ul>`;
  const reenvios = listaDe(datos.reenvios);
  const aMano = reenvios.length === 0 ? '' : `<ul class="dq-envio-a-mano">${reenvios.map((fila) => `<li>${esc(fila?.texto)}</li>`).join('')}</ul>`;
  const reenviar = datos.se_puede_reenviar === true
    ? '<button type="button" class="dq-btn dq-btn-borde dq-btn-chico" data-reenviar aria-haspopup="dialog">Reenviar…</button>'
    : '';
  return `${abre}<p>${esc(datos.resumen)}</p>${filas}${aMano}`
    + `<div class="dq-envio-acciones">${reenviar}<button type="button" class="dq-btn dq-btn-borde dq-btn-chico" data-prueba>Enviarme una prueba</button></div>`
    + '</section>';
}

/**
 * El cuerpo del diálogo de «Reenviar» (lista_de_hoy, `[{ id, nombre }]`): «A todas las personas que hoy lo reciben (N)», elegida, o
 * «A una persona:» con la lista; y que sale en el momento. Sin nadie en la lista, solo «a todas (0)»: el servidor dice que está vacía.
 */
function htmlDelReenvio(lista) {
  const personas = listaDe(lista).filter((persona) => idDeEdicion(persona?.id) !== null);
  const todas = '<label><input type="radio" name="dq-a" value="todas" checked> '
    + `<span>A todas las personas que hoy lo reciben (${String(personas.length)})</span></label>`;
  const una = personas.length === 0
    ? ''
    : '<label><input type="radio" name="dq-a" value="una"> <span id="dq-reenvio-una">A una persona:</span></label>'
      + '<select id="dq-reenvio-persona" aria-labelledby="dq-reenvio-una">'
      + `${personas.map((persona) => `<option value="${String(persona.id)}">${esc(persona.nombre)}</option>`).join('')}</select>`;
  return `<fieldset class="dq-opciones"><legend class="visualmente-oculto">A quién se reenvía</legend>${todas}${una}</fieldset>`
    + `<p class="dq-reenvio-nota">${TEXTO_NOTA_DEL_REENVIO}</p>`;
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

// El estado de la página. `pedido` numera las cargas: una respuesta que llega después de otra más nueva se descarta. `admin` es de
// Auth.isAdmin() al arrancar; `pestana`, la que se ve; `detalle` y `caja`, la edición abierta y su caja del correo; `reenvio`, el
// diálogo abierto
const vistaDatoQuincena = {
  pedido: 0, anio: null, pagina: 1, cargando: false, datos: null, imagenes: new Set(), modal: null,
  admin: false, pestana: 'ediciones', detalle: null, caja: null, reenvio: null
};

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

// Un aviso de la página (showToast no escapa: todo texto se escapa, también los del servidor) y lo mismo en la región viva
function avisarDq(mensaje, tipo) {
  if (typeof mensaje !== 'string' || mensaje === '') return;
  if (typeof showToast === 'function') showToast(Utils.escapeHtml(mensaje), tipo);
  anunciarDatoQuincena(mensaje);
}
const avisarErrorDatoQuincena = (mensaje) => avisarDq(mensaje, 'error');

// El texto de un error de API.pedirJson: el del servidor si contestó con uno (trae el estado); si no (la red, o una respuesta que
// no es la de la API: «Error 500»), el fijo de la operación
function mensajeDelErrorDq(error, fijo) {
  const mensaje = error?.message;
  return typeof error?.status === 'number' && typeof mensaje === 'string' && mensaje !== '' && !/^Error \d+$/.test(mensaje) ? mensaje : fijo;
}

// Si el foco se perdió (quedó en el cuerpo de la página): un control deshabilitado lo suelta
const focoPerdidoDq = () => {
  const activo = typeof document !== 'undefined' ? document.activeElement : null;
  return activo === null || activo === undefined || activo === document.body;
};

// Deshabilita el botón mientras dura el pedido (un doble clic manda un solo pedido). Al deshabilitarlo el navegador le saca el foco:
// si lo tenía y no se fue a otro lado (un diálogo que cerró lo devuelve a su botón), vuelve a él
async function conBotonBloqueadoDq(boton, tarea) {
  if (boton.disabled) return;
  const teniaFoco = typeof document !== 'undefined' && document.activeElement === boton;
  boton.disabled = true;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
    if (teniaFoco && boton.isConnected !== false && focoPerdidoDq()) boton.focus?.();
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

// La lista de un año (null: el más reciente), en la página pedida (una fuera de rango va a la última). Un año pedido sin ediciones, con
// otros que sí tienen, vuelve a la lista sola. Al cambiar de año con un botón, sin «Cargando…» y con el foco en el botón del año nuevo
async function cargarListaDq(anio, { desdeBoton = false, pagina = 1 } = {}) {
  const pedido = ++vistaDatoQuincena.pedido;
  vistaDatoQuincena.cargando = true;
  document.title = TITULO_DQ;
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
    vistaDatoQuincena.datos = datos;
    vistaDatoQuincena.cargando = false;
    dibujarListaDq(pagina);
    // La dirección se escribe si se pidió un año o una página (la lista sola queda como está)
    if (anio !== null || pagina !== 1) escribirUrlDeLaListaDq();
    if (desdeBoton) elementoDq('dq-contenido').querySelector(`button[data-anio="${String(datos.anio)}"]`)?.focus();
  } catch (error) {
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (error?.status === 401) {
      vistaDatoQuincena.cargando = false;
      irAlLoginDesdeDatoQuincena();
      return;
    }
    console.error('Error cargando las ediciones:', error);
    vistaDatoQuincena.cargando = false;
    dibujarDatoQuincena(htmlDelEstado('error'));
  }
}

// Dibuja la página `pedida` de la lista ya cargada (sin volver a pedirla); una fuera de rango queda en la última que existe
function dibujarListaDq(pedida) {
  const datos = vistaDatoQuincena.datos;
  const vista = paginaDeEdiciones(datos.ediciones, pedida);
  vistaDatoQuincena.pagina = vista.pagina;
  dibujarDatoQuincena(htmlDeLaLista(datos, vista.pagina));
}

// La dirección con el año y la página que se ven (la página 1 no lleva &pagina=)
function escribirUrlDeLaListaDq() {
  const { datos, pagina } = vistaDatoQuincena;
  window.history?.replaceState?.(null, '', urlDeEstado({ anio: datos.anio, pagina }));
}

// El detalle de una edición. Un 404 es «No existe esa edición.»; otro error, el error. Para la administración, después pide su caja
// del correo (solo ella la pide)
async function cargarDetalleDq(id) {
  const pedido = ++vistaDatoQuincena.pedido;
  vistaDatoQuincena.detalle = null;
  vistaDatoQuincena.caja = null;
  document.title = TITULO_DQ;
  dibujarDatoQuincena(htmlDelEstado('cargando'));
  try {
    const detalle = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}`))?.data;
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (detalle === null || typeof detalle !== 'object' || idDeEdicion(detalle.id) === null) throw new TypeError('La respuesta no es una edición');
    dibujarDatoQuincena(htmlDelDetalle(detalle, { admin: vistaDatoQuincena.admin }));
    vistaDatoQuincena.detalle = detalle;
    if (typeof detalle.fecha_texto === 'string') document.title = `${detalle.fecha_texto} - ${TITULO_DQ}`;
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
    return;
  }
  if (vistaDatoQuincena.admin) await cargarCajaDelCorreoDq(vistaDatoQuincena.detalle.id);
}

function mostrarNoExisteDq() {
  dibujarDatoQuincena(htmlDelEstado('no-existe'));
  document.title = `No existe esa edición - ${TITULO_DQ}`;
}

// Lo que pide la pestaña Ediciones según la dirección (`search`): con ?id, el detalle (un id que no es un entero positivo, «No existe
// esa edición.» sin pedirlo); sin él, la lista del año de ?anio (o el más reciente) en la página de &pagina
function cargarEdicionesDq(search) {
  const texto = String(search ?? '');
  const estado = estadoDeLaUrl(texto);
  if (new URLSearchParams(texto.replace(/^\?/, '')).has('id')) {
    if (estado.id !== null) return cargarDetalleDq(estado.id);
    vistaDatoQuincena.pedido += 1;
    mostrarNoExisteDq();
    return Promise.resolve();
  }
  return cargarListaDq(estado.anio, { pagina: estado.pagina });
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

// Libera las URL de las imágenes (la infografía del detalle: al cambiar de pestaña y al salir de la página)
function liberarImagenesDq() {
  for (const url of vistaDatoQuincena.imagenes) URL.revokeObjectURL(url);
  vistaDatoQuincena.imagenes.clear();
}

// ---- Los clics y los cambios, delegados en #dq-contenido ----

function alTocarDq(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.closest !== 'function') return;
  let boton;
  if ((boton = objetivo.closest('button[data-anio]'))) elegirAnioDq(boton);
  else if ((boton = objetivo.closest('button[data-pagina]'))) irAPaginaDq(boton);
  else if ((boton = objetivo.closest('button[data-copiar]'))) copiarTexto(boton, boton.dataset.copiar ?? '');
  else if ((boton = objetivo.closest('button[data-ver]'))) verArchivoDq(boton);
  else if ((boton = objetivo.closest('button[data-descargar]'))) descargarArchivoDq(boton);
  // Lo que sigue solo existe para la administración (la pestaña Correo y la caja del detalle)
  else if ((boton = objetivo.closest('button[data-guardar-lista]'))) guardarListaDq(boton);
  else if ((boton = objetivo.closest('button[data-reenviar]'))) abrirReenvioDq(boton);
  else if ((boton = objetivo.closest('button[data-prueba]'))) mandarPruebaDq(boton);
}

// El interruptor y las casillas de la pestaña Correo (solo la administración los tiene)
function alCambiarDq(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.matches !== 'function') return;
  if (objetivo.id === 'dq-envio-activo') cambiarEnvioDq(objetivo);
  else if (objetivo.matches('input[data-usuario]')) contarLosQueRecibenDq();
}

// Otro año: la dirección lo guarda (sin sumar al historial), vuelve a la página 1 y se pide su lista
function elegirAnioDq(boton) {
  const anio = anioQueSirve(Number(boton.dataset.anio));
  if (anio === null || anio === vistaDatoQuincena.anio) return;
  window.history?.replaceState?.(null, '', urlDeEstado({ anio }));
  cargarListaDq(anio, { desdeBoton: true, pagina: 1 });
}

// Otra página de la misma lista: se vuelve a dibujar, se anuncia «Página 2 de 2» y el foco queda en el botón del mismo sentido
// (si ya no puede ir más lejos, en el otro)
function irAPaginaDq(boton) {
  const destino = Number(boton.dataset.pagina);
  // Mientras llega la lista de otro año, la página que se ve es la del año viejo: no se cambia
  if (!Number.isSafeInteger(destino) || destino < 1 || !vistaDatoQuincena.datos || vistaDatoQuincena.cargando) return;
  dibujarListaDq(destino);
  escribirUrlDeLaListaDq();
  const contenido = elementoDq('dq-contenido');
  anunciarDatoQuincena(contenido.querySelector('.dq-pagina-texto')?.firstChild?.textContent ?? '');
  // El foco al principio de la lista (los botones de abajo se vuelven a dibujar) y la lista debajo del encabezado fijo
  const arriba = elementoDq('dq-lista-arriba');
  if (!arriba) return;
  arriba.focus({ preventScroll: true });
  const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  arriba.scrollIntoView?.({ behavior: sinMovimiento ? 'instant' : 'smooth', block: 'start' });
}

// ---- Las pestañas (administración) ----

// Las pestañas se dibujan en #dq-pestanas, fuera de lo que se vuelve a dibujar; el panel que controlan es #dq-contenido, que pasa a
// ser su tabpanel, nombrado por la pestaña elegida
function dibujarPestanasDq(activa) {
  const lugar = elementoDq('dq-pestanas');
  if (lugar) lugar.innerHTML = htmlDePestanas(activa);
  const contenido = elementoDq('dq-contenido');
  contenido?.setAttribute?.('role', 'tabpanel');
  contenido?.setAttribute?.('aria-labelledby', `dq-tab-${activa === 'correo' ? 'correo' : 'ediciones'}`);
}

// Muestra una pestaña: Correo, o Ediciones con lo que pide la dirección (?id, ?anio, &pagina). La infografía de un detalle que se
// deja se libera
function mostrarPestanaDq(clave) {
  const pestana = clave === 'correo' ? 'correo' : 'ediciones';
  vistaDatoQuincena.pestana = pestana;
  liberarImagenesDq();
  dibujarPestanasDq(pestana);
  return pestana === 'correo' ? cargarCorreoDq() : cargarEdicionesDq(window.location?.search);
}

// Otra pestaña: la dirección conserva lo de Ediciones y suma o saca #correo (sin sumar al historial); el foco, en la elegida
function elegirPestanaDq(clave) {
  const correo = clave === 'correo';
  window.history?.replaceState?.(null, '', urlDeEstado({ ...estadoDeLaUrl(window.location?.search), correo }));
  const carga = mostrarPestanaDq(correo ? 'correo' : 'ediciones');
  elementoDq('dq-pestanas')?.querySelector('[aria-selected="true"]')?.focus();
  return carga;
}

// El #correo de la dirección cambió (un enlace, Atrás, la barra de direcciones): la pestaña lo sigue
function alCambiarElHashDq() {
  const clave = estadoDeLaUrl('', window.location?.hash).correo ? 'correo' : 'ediciones';
  if (clave === vistaDatoQuincena.pestana) return undefined;
  return mostrarPestanaDq(clave);
}

function alTocarPestanaDq(evento) {
  const boton = evento.target?.closest?.('button[data-pestana]');
  if (boton && boton.getAttribute('aria-selected') !== 'true') elegirPestanaDq(boton.dataset.pestana);
}

// Las flechas, Inicio y Fin cambian de pestaña (con solo dos, cualquiera lleva a la otra)
function alTeclearPestanaDq(evento) {
  const boton = evento.target?.closest?.('button[data-pestana]');
  if (!boton || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
  evento.preventDefault?.();
  const otra = boton.dataset.pestana === 'correo' ? 'ediciones' : 'correo';
  const destino = evento.key === 'Home' ? 'ediciones' : (evento.key === 'End' ? 'correo' : otra);
  if (destino !== boton.dataset.pestana) elegirPestanaDq(destino);
}

// ---- La pestaña Correo (administración) ----

// La configuración del correo (GET /dato-quincena/correo): el interruptor, las próximas y quién lo recibe. Si no llega, su error
async function cargarCorreoDq() {
  const pedido = ++vistaDatoQuincena.pedido;
  document.title = TITULO_CORREO_DQ;
  dibujarDatoQuincena(htmlDelEstado('cargando'));
  try {
    const datos = (await API.pedirJson('GET', '/dato-quincena/correo'))?.data;
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (!Array.isArray(datos?.personas) || !Array.isArray(datos?.proximas)) throw new TypeError('La respuesta no es la configuración del correo');
    dibujarDatoQuincena(htmlDelCorreo(datos));
  } catch (error) {
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    console.error('Error cargando el correo del dato de la quincena:', error);
    dibujarDatoQuincena(htmlDelEstado('error-correo'));
  }
}

// El interruptor y su texto
function ponerElInterruptorDq(casilla, activo) {
  casilla.checked = activo;
  const texto = elementoDq('dq-envio-estado');
  if (texto) texto.textContent = textoDelInterruptorDq(activo);
}

/**
 * El interruptor se guarda al cambiarlo. Al prenderlo pregunta (si no se confirma, vuelve a apagado sin pedir nada); al apagarlo,
 * no. Queda deshabilitado hasta la respuesta; si el PUT falla, vuelve a como estaba y avisa con el error del servidor.
 */
async function cambiarEnvioDq(casilla) {
  const prender = casilla.checked === true;
  if (prender && window.confirm?.(TEXTO_CONFIRMAR_ENVIO) !== true) {
    ponerElInterruptorDq(casilla, false);
    return;
  }
  const teniaFoco = document.activeElement === casilla;
  casilla.disabled = true;
  try {
    const respuesta = await API.pedirJson('PUT', '/dato-quincena/correo/envio', { activo: prender });
    const activo = respuesta?.data?.envio_activo;
    ponerElInterruptorDq(casilla, typeof activo === 'boolean' ? activo : prender);
    avisarDq(respuesta?.message, 'success');
  } catch (error) {
    ponerElInterruptorDq(casilla, !prender);
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    avisarErrorDatoQuincena(mensajeDelErrorDq(error, TEXTOS_DEL_CORREO.envio));
  } finally {
    casilla.disabled = false;
    if (teniaFoco && casilla.isConnected !== false && focoPerdidoDq()) casilla.focus?.();
  }
}

// Las casillas de «Lo recibe» de la tabla
const casillasDeLaListaDq = () => [...(elementoDq('dq-contenido')?.querySelectorAll('input[data-usuario]') ?? [])];

// El pie de «Quién lo recibe» mientras se tilda, con la copia de la regla (todavía no se guardó)
function contarLosQueRecibenDq() {
  const lugar = elementoDq('dq-cuantas-reciben');
  if (lugar) lugar.textContent = textoDeLosQueReciben(casillasDeLaListaDq().filter((casilla) => casilla.checked).length);
}

// «Guardar»: la lista entera, con los tildados (PUT …/correo/destinatarios); deshabilitado hasta la respuesta
function guardarListaDq(boton) {
  return conBotonBloqueadoDq(boton, async () => {
    const usuarios = casillasDeLaListaDq().filter((casilla) => casilla.checked)
      .map((casilla) => Number(casilla.dataset.usuario)).filter((id) => idDeEdicion(id) !== null);
    try {
      const respuesta = await API.pedirJson('PUT', '/dato-quincena/correo/destinatarios', { usuarios });
      avisarDq(respuesta?.message, 'success');
    } catch (error) {
      if (error?.status === 401) {
        irAlLoginDesdeDatoQuincena();
        return;
      }
      avisarErrorDatoQuincena(mensajeDelErrorDq(error, TEXTOS_DEL_CORREO.lista));
    }
  });
}

// ---- La caja del correo del detalle (administración) ----

/**
 * Pide la caja del correo de la edición `id` y la dibuja en su lugar (si no llega, el error en la caja). Con `conLinea`, también
 * vuelve a dibujar el renglón de la cabecera con la línea del correo que trae (después de un reenvío o una prueba). `foco`: los
 * botones a enfocar, el primero que esté (el que se apretó se volvió a dibujar). Si la página ya mostró otra cosa, no dibuja nada.
 */
async function cargarCajaDelCorreoDq(id, { conLinea = false, foco = [] } = {}) {
  const pedido = vistaDatoQuincena.pedido;
  const sigue = () => pedido === vistaDatoQuincena.pedido && vistaDatoQuincena.detalle?.id === id;
  let datos = null;
  try {
    datos = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}/correo`))?.data ?? null;
  } catch (error) {
    if (!sigue()) return;
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    console.error('Error cargando el correo de la edición:', error);
  }
  if (!sigue()) return;
  const lugar = elementoDq('dq-envio-lugar');
  if (!lugar) return;
  vistaDatoQuincena.caja = datos !== null && typeof datos === 'object' ? datos : null;
  lugar.innerHTML = htmlDeLaCajaDelCorreo(vistaDatoQuincena.caja);
  if (conLinea && typeof vistaDatoQuincena.caja?.linea === 'string') {
    vistaDatoQuincena.detalle = { ...vistaDatoQuincena.detalle, correo: vistaDatoQuincena.caja.linea };
    const recibo = elementoDq('dq-contenido')?.querySelector('.dq-recibo');
    if (recibo) recibo.innerHTML = htmlDelRecibo(vistaDatoQuincena.detalle);
  }
  for (const selector of foco) {
    const boton = lugar.querySelector?.(selector);
    if (boton) {
      boton.focus?.();
      break;
    }
  }
}

// «Enviarme una prueba»: a la casilla de quien la pide; deshabilitado hasta la respuesta, y después la caja de nuevo
function mandarPruebaDq(boton) {
  const id = idDeEdicion(vistaDatoQuincena.detalle?.id);
  if (id === null) return undefined;
  return conBotonBloqueadoDq(boton, async () => {
    let mensaje;
    let tipo = 'success';
    try {
      mensaje = (await API.pedirJson('POST', `/dato-quincena/ediciones/${String(id)}/prueba`))?.message;
    } catch (error) {
      if (error?.status === 401) {
        irAlLoginDesdeDatoQuincena();
        return;
      }
      tipo = 'error';
      mensaje = mensajeDelErrorDq(error, TEXTOS_DEL_CORREO.prueba);
    }
    avisarDq(mensaje, tipo);
    await cargarCajaDelCorreoDq(id, { conLinea: true, foco: ['button[data-prueba]'] });
  });
}

// ---- El diálogo de «Reenviar» (administración) ----

// Abre el diálogo con la lista de hoy de la caja; el foco, en la opción elegida (después de la transición del velo)
function abrirReenvioDq(boton) {
  const id = idDeEdicion(vistaDatoQuincena.detalle?.id);
  const caja = vistaDatoQuincena.caja;
  if (id === null || caja === null) return;
  elementoDq('dq-reenvio-cuerpo').innerHTML = htmlDelReenvio(caja.lista_de_hoy);
  const abierto = { id, volverA: boton };
  vistaDatoQuincena.reenvio = abierto;
  const modal = elementoDq('dq-reenvio');
  modal.classList.add('active');
  setTimeout(() => {
    if (vistaDatoQuincena.reenvio === abierto) modal.querySelector('input[name="dq-a"]:checked')?.focus?.();
  }, 100);
}

// Cierra el diálogo y el foco vuelve al botón que lo abrió
function cerrarReenvioDq() {
  const abierto = vistaDatoQuincena.reenvio;
  if (!abierto) return;
  vistaDatoQuincena.reenvio = null;
  elementoDq('dq-reenvio').classList.remove('active');
  if (abierto.volverA?.isConnected !== false) abierto.volverA?.focus?.();
}

// A quién: 'todas', o el id de la persona elegida (uno que no sirve va como null y el servidor dice que elija)
function aQuienDq() {
  if (elementoDq('dq-reenvio').querySelector('input[name="dq-a"]:checked')?.value !== 'una') return 'todas';
  return idDeEdicion(Number(elementoDq('dq-reenvio-persona')?.value));
}

/**
 * «Reenviar» del diálogo: POST …/reenvios con `{ a }`, deshabilitado hasta la respuesta. Con la respuesta (salió a todas, a algunas,
 * a nadie, o no se pudo), cierra el diálogo, avisa con el texto del servidor y vuelve a pedir la caja y la línea de la cabecera.
 */
function confirmarReenvioDq(boton) {
  const abierto = vistaDatoQuincena.reenvio;
  if (!abierto) return undefined;
  const a = aQuienDq();
  return conBotonBloqueadoDq(boton, async () => {
    let mensaje;
    let tipo = 'success';
    try {
      mensaje = (await API.pedirJson('POST', `/dato-quincena/ediciones/${String(abierto.id)}/reenvios`, { a }))?.message;
    } catch (error) {
      if (error?.status === 401) {
        irAlLoginDesdeDatoQuincena();
        return;
      }
      tipo = 'error';
      mensaje = mensajeDelErrorDq(error, TEXTOS_DEL_CORREO.reenvio);
    }
    if (vistaDatoQuincena.reenvio === abierto) cerrarReenvioDq();
    avisarDq(mensaje, tipo);
    await cargarCajaDelCorreoDq(abierto.id, { conLinea: true, foco: ['button[data-reenviar]', 'button[data-prueba]'] });
  });
}

// Cierran la ×, «Cancelar» (data-cerrar), Escape y el clic en el velo (si empezó en el velo); elegir una persona de la lista marca
// «A una persona»
function conectarReenvioDq() {
  const modal = elementoDq('dq-reenvio');
  let desdeElVelo = false;
  modal.addEventListener('mousedown', (evento) => {
    desdeElVelo = evento.target === modal;
  });
  modal.addEventListener('click', (evento) => {
    const cerrar = Boolean(evento.target?.closest?.('[data-cerrar]')) || (evento.target === modal && desdeElVelo);
    desdeElVelo = false;
    if (cerrar) cerrarReenvioDq();
    // Un clic en la lista (en Firefox, el clic cae en la opción) elige «A una persona», también si deja la que ya estaba
    else if (evento.target?.closest?.('#dq-reenvio-persona')) marcarUnaPersonaDq();
  });
  modal.addEventListener('change', (evento) => {
    if (evento.target?.id === 'dq-reenvio-persona') marcarUnaPersonaDq();
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || !vistaDatoQuincena.reenvio) return;
    evento.preventDefault?.();
    cerrarReenvioDq();
  });
  elementoDq('dq-reenvio-confirmar').addEventListener('click', (evento) => confirmarReenvioDq(evento.currentTarget));
}

function marcarUnaPersonaDq() {
  const una = elementoDq('dq-reenvio').querySelector('input[name="dq-a"][value="una"]');
  if (una) una.checked = true;
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

// Todos los roles con sesión ven las ediciones; sin sesión, al login. Sin ?id=, la lista (del año de ?anio=, o el más reciente); con
// ?id=N, el detalle (un id que no es un entero positivo, «No existe esa edición.» sin pedirlo). La administración tiene además las
// pestañas (#correo abre la de Correo, también junto a ?id o ?anio), la caja del correo del detalle y el diálogo de «Reenviar»; los
// demás roles no piden nada de eso (un #correo, lo ignoran)
function iniciarDatoQuincena() {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return undefined;
  }
  const contenido = elementoDq('dq-contenido');
  contenido.addEventListener('click', alTocarDq);
  conectarModalDq();
  // Al salir se liberan las imágenes; no si la página queda guardada para «Atrás» (volvería con las imágenes rotas)
  window.addEventListener('pagehide', (evento) => {
    if (!evento.persisted) liberarImagenesDq();
  });
  const bajada = elementoDq('dq-bajada');
  if (bajada) bajada.textContent = textoDeLaBajada();
  const admin = Auth.isAdmin?.() === true;
  vistaDatoQuincena.admin = admin;
  if (!admin) return cargarEdicionesDq(window.location.search);
  contenido.addEventListener('change', alCambiarDq);
  conectarReenvioDq();
  const pestanas = elementoDq('dq-pestanas');
  pestanas.addEventListener('click', alTocarPestanaDq);
  pestanas.addEventListener('keydown', alTeclearPestanaDq);
  window.addEventListener('hashchange', alCambiarElHashDq);
  return mostrarPestanaDq(estadoDeLaUrl('', window.location.hash).correo ? 'correo' : 'ediciones');
}

document.addEventListener('DOMContentLoaded', iniciarDatoQuincena);
