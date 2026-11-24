/**
 * El dato de la quincena - RPAD (specs 2026-11-07-dato-quincena, 9, 10 y 11, 2026-11-12-dato-quincena-correo, 12 y 13,
 * 2026-11-18-dato-quincena-detalle-pestanas, 2026-11-21-dato-quincena-principal-equipo y 2026-11-23-dato-quincena-principal-votacion)
 * El archivo de las ediciones que arma Datito (el bot: NOMBRE_DEL_BOT), de solo lectura, para todos los roles con sesión: la lista
 * de un año (sin ?id=; ?anio=AAAA elige el año, &pagina=N la página de a 18), en tarjetas tipo diario con la pastilla del envío del
 * correo, y el detalle de una edición (?id=N), en una hoja «tipo diario» con tres pestañas, dibujadas juntas y con la elegida a la
 * vista: General (la principal, la infografía, la agenda en sus grupos, los archivos y el aviso de los datasets nuevos), Propuestas (un
 * índice y una propuesta por vez, con anterior y siguiente) y Datasets nuevos (solo si la edición trae la clave). &vista= elige la
 * pestaña y &propuesta=K, en Propuestas, la propuesta de orden K; cambiar de pestaña o de propuesta reemplaza la dirección (sin sumar
 * al historial).
 * Las notas para validar y la repetición de otra edición (spec 2026-11-14-dato-quincena-v1-3, 4), siempre a la vista; y tres
 * «Copiar» por propuesta (el texto para redes, el borrador y la propuesta entera).
 * Las dos principales (spec 2026-11-21-dato-quincena-principal-equipo, 4): la portada de General es la de Datito (con su infografía) y
 * arriba va la franja de la del equipo; el índice de Propuestas las marca a las dos, la propuesta que se ve lleva sus pastillas y, sin
 * &propuesta=, se abre la del equipo (si no hay, la de Datito). La del equipo se vota (spec 2026-11-23-dato-quincena-principal-votacion,
 * 4): quien está en la lista de esa edición (puede_votar, de cualquier rol) ordena las propuestas en el diálogo «Tu orden», tocándolas
 * en orden (PUT …/voto), desde la franja o desde cada propuesta; después, la edición se vuelve a pedir y a dibujar en el lugar. La franja
 * dice cómo va la votación y, cerrada, la que ganó, cómo y los votos; la tarjeta de la lista, hasta cuándo se vota y si falta su voto.
 * Una edición de antes muestra lo que se eligió a mano, sin botones.
 * Para la administración (Auth.isAdmin()) hay además dos pestañas de página, Ediciones y «Envío y votación» (#correo en la dirección,
 * junto a ?id, &vista, &propuesta, ?anio y &pagina, que son de Ediciones): esa pestaña tiene el interruptor del envío automático (se
 * guarda al cambiarlo; al prenderlo, pregunta), las próximas ediciones, la regla de la votación y «Las personas», con «Recibe el mail»,
 * «Vota» y un solo «Guardar»; y General suma, al final, la caja del correo de la edición, con «Reenviar…» (un diálogo) y «Enviarme una
 * prueba». Los demás roles no ven ni piden nada de eso.
 * El servidor arma todos los textos (las fechas, la marca del piloto, la llegada, el correo, la cantidad, el resto, la foto del RPAD,
 * los tamaños, lo que se copia, las próximas, los estados de cada persona y los avisos: GET /api/dato-quincena/ediciones,
 * /ediciones/:id, /correo y /ediciones/:id/correo) y la página los imprime tal cual: no recalcula nada. Las únicas copias de una regla
 * son textoDeLosQueReciben y textoDeLosQueVotan, para contar mientras se tilda, atadas por tests de paridad; el puesto de cada propuesta
 * mientras se toca en «Tu orden» es de la página, porque todavía no se guardó. Todo texto del servidor pasa por
 * Utils.escapeHtml (también en los data-, alt y aria-label), un número se escribe con String (Utils.escapeHtml(0) da '') y una
 * dirección de afuera solo es un enlace si empieza con https://, con rel="noopener noreferrer".
 * Al cargarse el archivo solo declara y engancha DOMContentLoaded: lo que arma HTML es puro y recibe los datos y quién mira por
 * parámetro (tests/dato-quincena-frontend.test.js lo carga en un vm, después del main.js y del api.js de verdad, como la página);
 * lo que toca el DOM o la API va aparte, al final (iniciarDatoQuincena): las cargas y los cambios (API.pedirJson: su error trae el
 * estado y el texto del servidor), la infografía desde un blob: (API.pedirArchivo + URL.createObjectURL, liberada al pasar a
 * «Envío y votación» y al salir), «Ver» en un modal con textContent, «Descargar» con el nombre que manda el servidor (API.pedirArchivo no da
 * el Content-Disposition) y «Copiar». Los eventos van delegados en #dq-contenido, en las pestañas y en los diálogos, que no se
 * vuelven a dibujar; lo que cambia se anuncia en #dq-anuncio (y, en «Tu orden», en la suya). Los botones que mandan algo quedan
 * deshabilitados hasta la respuesta.
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
// El rótulo de la ficha de la cifra clave (spec 2026-11-23-dato-quincena-detalle-visual): un texto fijo de la página, como «Ángulo»
const TEXTO_CIFRA_CLAVE = 'La cifra clave';

// Las pestañas de una edición (spec 2026-11-18-dato-quincena-detalle-pestanas, 1 y 2): su clave, la de &vista=, y su texto.
// «Datasets nuevos» solo va si la edición trae la clave propuestas_datasets
const VISTAS_DE_LA_EDICION = Object.freeze(['general', 'propuestas', 'datasets']);
const TEXTO_DE_LA_VISTA = Object.freeze({ general: 'General', propuestas: 'Propuestas', datasets: 'Datasets nuevos' });
// Los botones de General llevan el texto del servidor (ver_propuestas y ver_datasets_nuevos); estos, solo si no llega (un servidor
// de antes, durante el despliegue o con una vuelta atrás)
const TEXTO_VER_PROPUESTAS = 'Ver las propuestas';
const TEXTO_VER_DATASETS_NUEVOS = 'Ver los datasets nuevos';

// Los títulos de la ventana: el de la página (la lista), el de la pestaña «Envío y votación» y, en el detalle, la fecha delante
const TITULO_DQ = 'El dato de la quincena - RPAD';
const TITULO_CORREO_DQ = `Envío y votación - ${TITULO_DQ}`;

// La pestaña «Envío y votación» y la caja del correo del detalle (spec 2026-11-12-dato-quincena-correo, 9 y 13): los textos de la página. Lo
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

// La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 4): los textos de los botones, del diálogo
// «Tu orden» y de los rótulos son de la página; lo que dice cómo va la votación (el resumen, la participación, el cierre, el orden de
// quien mira, el texto del diálogo, cómo ganó, la regla y los votos) lo arma el servidor. «Te faltan N.», «Te falta 1.» y «Listo: ya
// están las N.» los arma la página con la cuenta de lo que se tocó (textoDeLoQueFaltaTocar)
const TEXTOS_DEL_VOTO = Object.freeze({
  votar: 'Votar',
  cambiar: 'Cambiar mi orden',
  guardar: 'Guardar mi orden',
  deNuevo: 'Empezar de nuevo',
  faltaTuVoto: 'Falta tu voto',
  noEstas: 'Votan las personas de la lista que arma administración.',
  verLosVotos: 'Ver los votos',
  gano: 'Ganó',
  tuOrden: 'Tu orden',
  primero: 'Tocá primero la que más querés trabajar.',
  error: 'No se pudo guardar tu orden. Probá de nuevo en unos minutos.'
});
// El enlace de la franja a la principal del equipo en Propuestas (la elegida a mano en una edición de antes, o la que ganó)
const TEXTO_VER_LA_PROPUESTA = 'Ver la propuesta';
// Lo que decía la página de la principal antes de la del equipo: solo con un servidor de antes (un detalle sin principal_datito)
const PRINCIPAL_DE_ANTES = Object.freeze({
  rotulo: 'La principal', pastilla: 'Principal', marca: 'Principal', infografia_pie: 'La infografía de la propuesta principal.',
  infografia_alt: 'Infografía de la propuesta principal'
});

// Las etiquetas de una propuesta: «Principal» en tinta, «Agenda» en cielo, «Validar» en sol con un ícono y «Repite» en blanco con
// borde y su ícono (nunca solo el color). «Efeméride» y cualquier otra, sin clase: el estilo neutro de .dq-etiqueta
const CLASE_DE_LA_ETIQUETA = Object.freeze({
  Principal: 'dq-et-principal', Agenda: 'dq-et-agenda', Validar: 'dq-et-validar', Repite: 'dq-et-repite'
});

// Los íconos de Lucide, decorativos: triangle-alert (Validar), history (Repite y la caja de la repetición), chevron-right (los plegados
// y «Siguiente») y chevron-left (volver y «Anterior»)
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
// Las dos principales, decorativos (el texto siempre dice cuál es): users (el equipo) y bot (Datito); y star, el del rótulo de la
// tarjeta, que es uno solo para las dos (el rótulo dice de quién es)
const ICONO_EQUIPO = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICONO_DATITO = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
const ICONO_ESTRELLA = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`;

// =====================================================
// Lo puro: la dirección y los enlaces
// =====================================================

const esc = (valor) => Utils.escapeHtml(valor);
// Un número del servidor (un id, un año, una cantidad) como texto: Utils.escapeHtml(0) da ''
const numeroComoTexto = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : esc(valor));
// Un id que sirve: un entero positivo; si no, null
const idDeEdicion = (valor) => (Number.isSafeInteger(valor) && valor > 0 ? valor : null);
const anioQueSirve = (valor) => (Number.isInteger(valor) && valor >= ANIO_MINIMO_DQ && valor <= ANIO_MAXIMO_DQ ? valor : null);

// Una vista de la edición que sirve: una de la lista cerrada; si no, null
const vistaQueSirve = (valor) => (typeof valor === 'string' && VISTAS_DE_LA_EDICION.includes(valor) ? valor : null);

/**
 * Lo que pide la dirección: `{ id, anio, pagina, correo, vista, propuesta }`. El id y la propuesta, un entero positivo escrito con
 * cifras (sin ceros adelante); el año, cuatro cifras de 2000 a 2100; la página, un entero positivo (1 si no); el correo, solo con el
 * #correo; la vista, una de VISTAS_DE_LA_EDICION. Lo demás, null / 1 / false. La propuesta se lee sola: la página la usa solo en
 * Propuestas (spec 2026-11-18-dato-quincena-detalle-pestanas, 1).
 */
function estadoDeLaUrl(search, hash = '') {
  const parametros = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const textoDelId = parametros.get('id') ?? '';
  const textoDelAnio = parametros.get('anio') ?? '';
  const textoDeLaPagina = parametros.get('pagina') ?? '';
  const textoDeLaPropuesta = parametros.get('propuesta') ?? '';
  const pagina = /^[1-9]\d{0,8}$/.test(textoDeLaPagina) ? Number(textoDeLaPagina) : 1;
  return {
    id: /^[1-9]\d*$/.test(textoDelId) ? idDeEdicion(Number(textoDelId)) : null,
    anio: /^\d{4}$/.test(textoDelAnio) ? anioQueSirve(Number(textoDelAnio)) : null,
    pagina,
    correo: String(hash ?? '') === '#correo',
    vista: vistaQueSirve(parametros.get('vista')),
    propuesta: /^[1-9]\d*$/.test(textoDeLaPropuesta) ? idDeEdicion(Number(textoDeLaPropuesta)) : null
  };
}

// La dirección de una vista: lo que pide Ediciones (el detalle con su id, la lista de un año con su página desde la 2, o la lista
// sola) y, en la pestaña Envío y votación, #correo al final (spec 2026-11-12-dato-quincena-correo, 13: así volver a Ediciones vuelve
// a lo mismo).
// El detalle suma &vista= si no es General y &propuesta= solo en Propuestas (spec 2026-11-18-dato-quincena-detalle-pestanas, 1)
function urlDeEstado({ id = null, anio = null, pagina = 1, correo = false, vista = null, propuesta = null } = {}) {
  const hash = correo === true ? '#correo' : '';
  if (idDeEdicion(id) !== null) {
    const deVista = vistaQueSirve(vista) !== null && vista !== 'general' ? `&vista=${vista}` : '';
    const dePropuesta = vista === 'propuestas' && idDeEdicion(propuesta) !== null ? `&propuesta=${String(propuesta)}` : '';
    return `${PAGINA_DATO_QUINCENA}?id=${String(id)}${deVista}${dePropuesta}${hash}`;
  }
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
const esObjetoDq = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const conTextoDq = (valor) => typeof valor === 'string' && valor !== '';
const htmlDeMarca = (marca) => (marca ? `<span class="dq-marca">${esc(marca)}</span>` : '');
// Al lado de «El dato de la quincena», en la tarjeta y en la cabecera del detalle: la marca de un piloto o el N.º de una regular
const htmlDelNumeroDiario = (edicion) => (edicion?.marca
  ? htmlDeMarca(edicion.marca)
  : (edicion?.numero ? `<span class="dq-numero">${esc(edicion.numero)}</span>` : ''));

// =====================================================
// Lo puro: los estados y la lista
// =====================================================

// Cargando, el error (el de las ediciones y el de la pestaña Envío y votación), el archivo vacío y una edición que no existe (con
// «Todas las ediciones»). Otro tipo, nada
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

// Las pastillas de una votación abierta en la tarjeta (spec 2026-11-23-dato-quincena-principal-votacion, 4): hasta cuándo se vota (con
// el reloj, como una edición programada) y, si a quien mira le falta votar (el true literal), «Falta tu voto» (con el triángulo, como una
// en espera). El texto dice siempre qué es: el color no es lo único. Sin votación abierta (null) o algo que no es un objeto, nada
function htmlDeLaVotacionEnLaTarjeta(votacion) {
  if (!esObjetoDq(votacion)) return '';
  return `<span class="dq-envio dq-envio-programada">${ICONO_RELOJ}${esc(votacion.texto)}</span>`
    + (votacion.falta_tu_voto === true ? `<span class="dq-envio dq-envio-espera">${ICONO_AVISO}${TEXTOS_DEL_VOTO.faltaTuVoto}</span>` : '');
}

/**
 * Una edición de la lista, «tipo diario»: «El dato de la quincena» con el N.º (o la marca de un piloto) y la doble línea, la fecha en tres
 * renglones, la cantidad, el rótulo de la principal que cuenta (la del equipo o la de Datito: lo dice el servidor; sin él, un servidor
 * de antes, no va), su título y, al pie, las pastillas de la votación abierta (si hay) y la del envío. El enlace está en la fecha y se estira a toda la tarjeta
 * (::after): un solo enlace. Con un id que no sirve, sin enlace. Entre los renglones de la fecha va un espacio (la grilla no lo
 * dibuja): copiada o leída en voz alta dice «Lunes 16 de noviembre de 2026», no «Lunes16 de noviembrede 2026».
 */
function htmlDeTarjeta(item) {
  const id = idDeEdicion(item?.id);
  const partes = item?.fecha_partes;
  const fecha = partes !== null && typeof partes === 'object'
    ? `<span class="dq-fd-dia">${esc(partes.dia)}</span> <span class="dq-fd-fecha">${esc(partes.fecha)}</span> <span class="dq-fd-anio">${esc(partes.anio)}</span>`
    : `<span class="dq-fd-fecha">${esc(item?.fecha_texto)}</span>`;
  const pie = htmlDeLaVotacionEnLaTarjeta(item?.votacion) + htmlDeLaPastilla(item?.envio);
  return '<li class="dq-tarjeta">'
    + `<p class="dq-cabecera-diario"><span>El dato de la quincena</span>${htmlDelNumeroDiario(item)}</p>`
    + `<h3 class="dq-fecha-diario">${id === null ? `<span class="dq-tarjeta-enlace">${fecha}</span>` : `<a class="dq-tarjeta-enlace" href="${esc(urlDeEstado({ id }))}">${fecha}</a>`}</h3>`
    + `${item?.cantidad ? `<p class="dq-cuantas-prop">${esc(item.cantidad)}</p>` : ''}`
    + `${conTextoDq(item?.principal?.rotulo) ? `<p class="dq-tarjeta-rotulo">${ICONO_ESTRELLA}${esc(item.principal.rotulo)}</p>` : ''}`
    + `<p class="dq-principal-diario">${esc(item?.principal?.titulo)}</p>`
    + `${pie ? `<div class="dq-tarjeta-pie">${pie}</div>` : ''}`
    + '</li>';
}

// Las pestañas de la administración: Ediciones y «Envío y votación» (la clave sigue siendo `correo`, como #correo en la dirección; una
// `activa`; otra cosa es Ediciones). Solo se llama con Auth.isAdmin()
function htmlDePestanas(activa) {
  const pestana = (clave, texto) => {
    const elegida = clave === (activa === 'correo' ? 'correo' : 'ediciones');
    return `<button type="button" class="dq-pestana${elegida ? ' dq-activa' : ''}" role="tab" id="dq-tab-${clave}" aria-selected="${elegida}" aria-controls="dq-contenido"${elegida ? '' : ' tabindex="-1"'} data-pestana="${clave}">${texto}</button>`;
  };
  return `<div class="dq-pestanas" role="tablist" aria-label="El dato de la quincena">${pestana('ediciones', 'Ediciones')}${pestana('correo', 'Envío y votación')}</div>`;
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

// Un evento de la agenda, un punto de su línea de tiempo: la fecha, el título, el detalle y, si es https://, el enlace. Entre las
// piezas va un espacio (la grilla no lo dibuja): copiado o leído en voz alta no queda todo pegado
function htmlDeEventoDeLaAgenda(evento) {
  const enlace = esEnlaceSeguro(evento?.url)
    ? ` ${enlaceDeAfuera(evento.url, `Ver<span class="visualmente-oculto"> ${esc(evento?.titulo)}</span>`)}`
    : '';
  return `<li><span class="dq-dia">${esc(evento?.fecha_texto)}</span> <b class="dq-evento-titulo">${esc(evento?.titulo)}</b> `
    + `<span class="dq-evento-detalle">${esc(evento?.detalle)}${enlace}</span></li>`;
}

// La agenda de la quincena en sus grupos (agenda_grupos del detalle, spec 2026-11-14-dato-quincena-agenda-grupos), en el orden
// en que los manda el servidor: cada grupo en su columna, con su título y sus eventos como una línea de tiempo corta (spec
// 2026-11-18-dato-quincena-detalle-pestanas, 3). Sin la pastilla «Efeméride»: el título del grupo ya lo dice. Un grupo sin eventos
// no va; sin ninguno, nada
function htmlDeLaAgenda(grupos) {
  const conEventos = listaDe(grupos).filter((grupo) => listaDe(grupo?.eventos).length > 0);
  if (conEventos.length === 0) return '';
  const columnas = conEventos.map((grupo) => `<div class="dq-agenda-col"><h4 class="dq-agenda-grupo">${esc(grupo.titulo)}</h4>`
    + `<ol class="dq-linea">${grupo.eventos.map(htmlDeEventoDeLaAgenda).join('')}</ol></div>`).join('');
  return '<section class="dq-agenda" aria-labelledby="dq-agenda-titulo">'
    + `<h3 class="dq-seccion-titulo" id="dq-agenda-titulo">Agenda de la quincena</h3><div class="dq-agenda-cols">${columnas}</div></section>`;
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
// Las etiquetas de la propuesta que se ve: «Principal» es la de Datito y se muestra con su `pastilla` («Principal de Datito», del
// servidor) y el ícono del bot; las demás, como siempre (spec 2026-11-21-dato-quincena-principal-equipo, 4)
const htmlDeEtiquetaConPastilla = (pastilla) => (etiqueta) => (etiqueta === 'Principal'
  ? `<span class="dq-etiqueta ${CLASE_DE_LA_ETIQUETA.Principal}">${ICONO_DATITO}${esc(pastilla)}</span>`
  : htmlDeEtiqueta(etiqueta));

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
const htmlDeCopiar = (texto, nombre, { rotulo = 'Copiar', clase } = {}) => `<button type="button" class="${clase}" data-copiar="${esc(texto)}" aria-label="${esc(nombre)}">${rotulo}</button>`;

// Un campo de una propuesta de dataset nuevo: su título (h5: el de la tarjeta es h4) y su contenido
const htmlDeCampo = (titulo, contenido) => `<div class="dq-campo"><div class="dq-campo-cabeza"><h5>${titulo}</h5></div>${contenido}</div>`;
// Un texto del servidor, con sus saltos de línea (los muestra white-space: pre-line)
const htmlDeTexto = (texto) => `<p class="dq-texto">${esc(texto)}</p>`;
// La cifra clave en su ficha (spec 2026-11-23-dato-quincena-detalle-visual), distinta del título: el rótulo fijo y el texto del servidor.
// `clase` es siempre un literal de la página: «dq-cifra» en la propuesta y «dq-principal-cifra» en General
function htmlDeLaCifra(texto, clase) {
  return `<div class="${clase}"><p class="dq-cifra-rotulo">${TEXTO_CIFRA_CLAVE}</p><p class="dq-cifra-texto">${esc(texto)}</p></div>`;
}

// El dataset de una propuesta: el nombre, con enlace a su página solo con id_enlace, y «en el portal», con enlace solo si es https://
function partesDelDataset(dataset) {
  const d = dataset ?? {};
  const id = idDeEdicion(d.id_enlace);
  return {
    nombre: id === null ? esc(d.nombre) : `<a href="dataset.html?id=${String(id)}">${esc(d.nombre)}</a>`,
    portal: esEnlaceSeguro(d.url) ? enlaceDeAfuera(d.url, 'en el portal') : 'en el portal'
  };
}

// Un campo de la propuesta que se ve: su título (h4: el de la propuesta es h3) y su contenido
const htmlDeCampoDeLaPropuesta = (titulo, contenido, clase = 'dq-campo') => `<div class="${clase}"><h4>${titulo}</h4>${contenido}</div>`;
// Lo que va plegado (el cálculo, el contexto y las fuentes): un <details> cerrado, con la flecha decorativa
const htmlDePlegado = (titulo, contenido) => `<details class="dq-plegado"><summary>${ICONO_ABRIR}<span>${titulo}</span></summary>`
  + `<div class="dq-plegado-cuerpo">${contenido}</div></details>`;

// «Anterior» o «Siguiente» (`sentido`): la propuesta vecina, `{ propuesta, orden }`, con su número y su título; sin vecina, nada. Entre el
// rótulo y el título va un espacio (la grilla no lo dibuja): el nombre se lee «Anterior Otro título», empezando con lo que se ve
function htmlDelPaso(vecina, sentido) {
  if (vecina === null || typeof vecina !== 'object') return '';
  const anterior = sentido === 'anterior';
  return `<button type="button" class="dq-paso dq-paso-${anterior ? 'anterior' : 'siguiente'}" data-ver-propuesta="${String(vecina.orden)}">`
    + `${anterior ? ICONO_VOLVER : ''}<span class="dq-paso-texto"><small>${anterior ? 'Anterior' : 'Siguiente'}</small> `
    + `<span class="dq-paso-titulo">${esc(vecina.propuesta?.titulo)}</span></span>${anterior ? '' : ICONO_ABRIR}</button>`;
}

/**
 * La propuesta que se ve en Propuestas (spec 2026-11-18-dato-quincena-detalle-pestanas, 4), en un <article> nombrado por su título:
 * arriba, el número, las etiquetas, el título (h3, el que recibe el foco al elegirla) y la cifra en su ficha; el dataset (con enlace a su página
 * solo con id_enlace, y «en el portal» siempre, con enlace si es https://) y la foto del RPAD en una tira; la repetición, si hay, y
 * «Para validar antes de publicar», siempre a la vista. En dos columnas, «Por qué es noticia», «Ángulo» y «Puntos centrales» | «Texto para
 * redes» con su «Copiar»; a lo ancho, el borrador con su «Copiar» y la idea de placa; plegados, el cálculo, el contexto y las fuentes;
 * al pie, «Copiar la propuesta» y `anterior` y `siguiente` (las vecinas, o null).
 * `principales` son las de principalesDeLaEdicion: arriba, la pastilla del equipo (si es la suya) y la de Datito en su etiqueta
 * «Principal». Con la `votacion` del detalle abierta (spec 2026-11-23-dato-quincena-principal-votacion, 4), «Tu N.º» si quien mira la
 * ordenó y, si puede votar, «Votar» o «Cambiar mi orden», que abren «Tu orden».
 */
function htmlDePropuesta(propuesta, { anterior = null, siguiente = null, principales = null, votacion = null } = {}) {
  const p = propuesta ?? {};
  const { nombre, portal } = partesDelDataset(p.dataset);
  const notas = listaDe(p.notas_validacion);
  const validar = notas.length > 0
    ? `<div class="dq-validar"><h4>${ICONO_VALIDAR}Para validar antes de publicar</h4><ul>${notas.map((nota) => `<li>${esc(nota)}</li>`).join('')}</ul></div>`
    : '';
  const borrador = p.borrador_nota ?? {};
  // «Copiar la propuesta (Propuesta 1)»: el de la propuesta entera nombra cuál, con el orden_texto del servidor, y empieza con el texto
  // que se ve (WCAG 2.5.3: quien maneja la página con la voz dice lo que lee)
  const copiarLaPropuesta = typeof p.orden_texto === 'string' && p.orden_texto !== ''
    ? `Copiar la propuesta (${p.orden_texto})`
    : 'Copiar la propuesta';
  const copiarChico = { clase: 'dq-btn dq-btn-borde dq-btn-chico dq-copiar' };
  const fuentes = listaDe(p.fuentes).map((url) => `<li>${esEnlaceSeguro(url) ? enlaceDeAfuera(url, esc(url)) : esc(url)}</li>`).join('');
  const pasos = htmlDelPaso(anterior, 'anterior') + htmlDelPaso(siguiente, 'siguiente');
  const datito = principales?.datito ?? null;
  const equipo = principales?.equipo ?? null;
  const orden = idDeEdicion(p.orden);
  const esDelEquipo = equipo !== null && orden !== null && equipo.orden === orden;
  const delEquipo = esDelEquipo ? `<span class="dq-etiqueta dq-et-equipo">${ICONO_EQUIPO}${esc(equipo.pastilla)}</span>` : '';
  const etiquetas = listaDe(p.etiquetas).map(htmlDeEtiquetaConPastilla(datito?.pastilla ?? PRINCIPAL_DE_ANTES.pastilla)).join('');
  const abierta = esObjetoDq(votacion) && votacion.estado === 'abierta' ? votacion : null;
  const puesto = abierta === null ? null : tuPuestoDe(abierta, orden);
  const tuyo = puesto === null ? '' : `<span class="dq-etiqueta dq-et-tuyo">${textoDeTuPuesto(puesto)}</span>`;
  const votar = abierta?.puede_votar === true ? htmlDelBotonDeVotar(abierta, 'dq-btn dq-btn-borde dq-btn-chico dq-votar-esta') : '';
  return '<article class="dq-propuesta" aria-labelledby="dq-propuesta-titulo">'
    + `<div class="dq-prop-arriba"><span class="dq-orden">${esc(p.orden_texto)}</span>${delEquipo}${etiquetas}${tuyo}${votar}</div>`
    + `<h3 class="dq-prop-titulo" id="dq-propuesta-titulo" tabindex="-1">${esc(p.titulo)}</h3>`
    + htmlDeLaCifra(p.cifra_clave, 'dq-cifra')
    + `<div class="dq-tira"><p class="dq-dataset"><span class="dq-tira-rotulo">Dataset:</span> ${nombre} · ${portal}</p>${htmlDeLaFoto(p.foto)}</div>`
    + htmlDeLaRepeticion(p.repeticion)
    + validar
    + '<div class="dq-dos"><div class="dq-dos-izq">'
    + htmlDeCampoDeLaPropuesta('Por qué es noticia', htmlDeTexto(p.por_que_hoy))
    + htmlDeCampoDeLaPropuesta('Ángulo', htmlDeTexto(p.angulo))
    + htmlDeCampoDeLaPropuesta('Puntos centrales', `<ul>${listaDe(p.puntos_centrales).map((punto) => `<li>${esc(punto)}</li>`).join('')}</ul>`)
    + '</div><div class="dq-redes">'
    + `<div class="dq-redes-cabeza"><h4>Texto para redes</h4>${htmlDeCopiar(p.texto_redes, 'Copiar el texto para redes', copiarChico)}</div>`
    + `<div class="dq-redes-post">${htmlDeTexto(p.texto_redes)}</div></div></div>`
    + '<div class="dq-borrador">'
    + `<div class="dq-borrador-cabeza"><h4>Borrador de nota</h4>${htmlDeCopiar(p.borrador_para_copiar, 'Copiar el borrador', copiarChico)}</div>`
    + `<div class="dq-borrador-cuerpo"><p class="dq-nota-titulo">${esc(borrador.titulo)}</p>${listaDe(borrador.parrafos).map(htmlDeTexto).join('')}</div></div>`
    + htmlDeCampoDeLaPropuesta('Idea de placa', htmlDeTexto(p.idea_placa), 'dq-campo dq-placa')
    + '<div class="dq-plegados">'
    + htmlDePlegado('Cómo se calculó', htmlDeTexto(p.calculo))
    + htmlDePlegado('Contexto histórico', htmlDeTexto(p.contexto_historico))
    + htmlDePlegado('Fuentes', `<ul>${fuentes}</ul>`)
    + '</div>'
    + `<footer class="dq-prop-pie"><p class="dq-copiar-todo">${htmlDeCopiar(p.para_copiar, copiarLaPropuesta, { rotulo: 'Copiar la propuesta', clase: 'dq-btn dq-btn-tinta dq-copiar' })}</p>`
    + (pasos ? `<nav class="dq-pasos" aria-label="Otras propuestas">${pasos}</nav>` : '')
    + '</footer></article>';
}

/**
 * Los archivos de la edición, en una fila y en el orden del servidor: «Descargar» en cada uno (guarda con el nombre que manda el
 * servidor) y «Ver» en los que se pueden ver (el texto del correo y los cálculos). Sin un id que sirva, nada: no hay a dónde pedirlos.
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
  return '<section class="dq-archivos" aria-labelledby="dq-archivos-titulo">'
    + `<h3 class="dq-seccion-titulo" id="dq-archivos-titulo">Archivos</h3><ul class="dq-archivos-fila">${filas}</ul></section>`;
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

// =====================================================
// Lo puro: las propuestas de datasets nuevos (spec 2026-11-18-dato-quincena-propuestas-datasets, 5)
// =====================================================
const TITULO_DATASETS_NUEVOS = 'Propuestas de datasets nuevos';
const SIN_DATASETS_NUEVOS = 'Esta quincena no hay propuestas de datasets.';
// La prioridad: su clase y su ícono salen de la clave del servidor (nunca del texto); el texto dice siempre la prioridad, así que el
// color no es lo único que la distingue. Lucide decorativos: check (alta), info (si hay recursos) y shield (evaluar)
const ICONO_CHECK_PRIORIDAD = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M20 6 9 17l-5-5"/></svg>`;
const ICONO_INFO_PRIORIDAD = `<svg ${ATRIBUTOS_DEL_ICONO}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
const ICONO_ESCUDO_PRIORIDAD = `<svg ${ATRIBUTOS_DEL_ICONO}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`;
const CLASE_DE_LA_PRIORIDAD = Object.freeze({ alta: 'dq-prio-alta', si_hay_recursos: 'dq-prio-si_hay_recursos', evaluar: 'dq-prio-evaluar' });
const ICONO_DE_LA_PRIORIDAD = Object.freeze({ alta: ICONO_CHECK_PRIORIDAD, si_hay_recursos: ICONO_INFO_PRIORIDAD, evaluar: ICONO_ESCUDO_PRIORIDAD });

// Una lista de enlaces: cada uno va con enlace solo si es https://; si no, su texto a secas
const htmlDeLosEnlaces = (lista) => `<ul>${lista.map(({ url, texto }) => `<li>${esEnlaceSeguro(url) ? enlaceDeAfuera(url, esc(texto)) : esc(texto)}</li>`).join('')}</ul>`;

// Una propuesta de dataset nuevo, tal como la arma el servidor: número y orígenes, título, prioridad con su valor y riesgo, y los
// campos. «Cómo anonimizar» y «Datasets relacionados» solo si hay
function htmlDeUnDatasetNuevo(propuesta, indice = 0) {
  const p = propuesta ?? {};
  const prioridad = htmlDeLaPrioridad(p.prioridad);
  const anonimizar = typeof p.anonimizacion === 'string' && p.anonimizacion !== ''
    ? `<div class="dq-validar dq-anonimizar"><h5>${ICONO_VALIDAR}Cómo anonimizar</h5>${htmlDeTexto(p.anonimizacion)}</div>`
    : '';
  const relacionados = listaDe(p.datasets_relacionados).map((r) => ({ url: r?.url, texto: r?.nombre }));
  const fuentes = listaDe(p.fuentes).map((url) => ({ url, texto: url }));
  const enlaces = (relacionados.length > 0 ? htmlDeCampo('Datasets relacionados en el portal', htmlDeLosEnlaces(relacionados)) : '') + htmlDeCampo('Fuentes', htmlDeLosEnlaces(fuentes));
  return `<li class="dq-nuevo" id="dq-nuevo-${String(indice)}">`
    + '<div class="dq-nuevo-cabeza">'
    + `<span class="dq-marcador dq-marcador-fijo dq-marcador-grande" aria-hidden="true">${String(numeroDelNuevo(p, indice))}</span>`
    + '<div class="dq-nuevo-encabezado">'
    + `<p class="dq-prop-arriba"><span class="dq-orden">${esc(p.numero_texto)}</span>${listaDe(p.origenes).map((o) => `<span class="dq-etiqueta">${esc(o)}</span>`).join('')}</p>`
    + `<h4 class="dq-nuevo-titulo" tabindex="-1">${esc(p.titulo)}</h4>`
    + `<p class="dq-cuad">${prioridad}<span class="dq-cuad-eje">${esc(p.valor_y_riesgo)}</span></p>`
    + '</div></div>'
    + '<div class="dq-nuevo-cuerpo">'
    + `<div class="dq-nuevo-porque"><h5 class="visualmente-oculto">Por qué abrirlo</h5>${htmlDeTexto(p.justificacion)}</div>`
    + '<div class="dq-nuevo-ficha">'
    + htmlDeCampo('Formato sugerido', `<p class="dq-formatos"><span class="dq-formato">${esc(p.formato)}</span></p>`)
    + htmlDeCampo('Campos sugeridos', `<ul class="dq-campos-min">${listaDe(p.campos).map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ul>`)
    + '</div>'
    + anonimizar
    + `<div class="dq-nuevo-enlaces">${enlaces}</div>`
    + '</div></li>';
}

// Las zonas de la matriz: la clase de cada clave del servidor (nunca del texto). «No se propone» va rayada además de su color
const CLASE_DE_LA_ZONA = Object.freeze({ alta: 'dq-zona-alta', si_hay_recursos: 'dq-zona-si_hay_recursos', evaluar: 'dq-zona-evaluar', no_se_propone: 'dq-zona-no' });
const NIVELES_DE_LA_MATRIZ = Object.freeze(['Alto', 'Medio', 'Bajo']);

// El número de un dataset nuevo en su marcador: el del servidor (`numero`) o, sin él, su posición desde 1
const numeroDelNuevo = (propuesta, indice) => (Number.isSafeInteger(propuesta?.numero) && propuesta.numero > 0 ? propuesta.numero : indice + 1);

// La prioridad de la lista: clase e ícono por la clave del servidor, y siempre su texto
function htmlDeLaPrioridad(prioridad) {
  const clave = prioridad?.clave;
  const conClave = typeof clave === 'string' && Object.hasOwn(CLASE_DE_LA_PRIORIDAD, clave);
  return `<span class="dq-etiqueta${conClave ? ` ${CLASE_DE_LA_PRIORIDAD[clave]}` : ''}">${conClave ? ICONO_DE_LA_PRIORIDAD[clave] : ''}${esc(prioridad?.texto)}</span>`;
}

// La matriz valor × riesgo de la guía: una tabla (filas, el riesgo de alto a bajo; columnas, el valor de bajo a alto) con las 9 celdas que
// manda el servidor, cada una con la clase de su zona; su texto se ve solo con `con_rotulo` y en las otras va oculto. Cada dataset es
// un botón con su número en la celda de su valor y su riesgo. Nunca se calcula una zona acá: sin `matriz_de_prioridad`, no hay matriz
function htmlDeLaMatriz(matriz, lista) {
  if (!Array.isArray(matriz) || matriz.length === 0) return '';
  const marcadoresDe = (celda) => lista.map((p, i) => ({ p, i })).filter(({ p }) => p?.valor === celda.valor && p?.riesgo === celda.riesgo)
    .map(({ p, i }) => `<button type="button" class="dq-marcador" data-ir-nuevo="${String(i)}" aria-label="${esc(p.numero_texto)}: ${esc(p.titulo)}">${String(numeroDelNuevo(p, i))}</button>`).join('');
  const filas = NIVELES_DE_LA_MATRIZ.map((riesgo) => {
    const celdas = ['Bajo', 'Medio', 'Alto'].map((valor) => {
      const celda = matriz.find((c) => c?.riesgo === riesgo && c?.valor === valor);
      if (!celda) return '<td class="dq-celda"></td>';
      const clase = typeof celda.clave === 'string' && Object.hasOwn(CLASE_DE_LA_ZONA, celda.clave) ? ` ${CLASE_DE_LA_ZONA[celda.clave]}` : '';
      const texto = `<span class="${celda.con_rotulo === true ? 'dq-zona-rotulo' : 'visualmente-oculto'}">${esc(celda.texto)}</span>`;
      const marcadores = marcadoresDe(celda);
      return `<td class="dq-celda${clase}">${texto}${marcadores ? `<span class="dq-marcadores">${marcadores}</span>` : ''}</td>`;
    }).join('');
    return `<tr><th scope="row">Riesgo ${riesgo.toLowerCase()}</th>${celdas}</tr>`;
  }).join('');
  return '<table class="dq-matriz"><caption class="visualmente-oculto">La matriz de valor y riesgo, con los datasets nuevos en su celda</caption>'
    + `<thead><tr><td></td>${['Bajo', 'Medio', 'Alto'].map((valor) => `<th scope="col">Valor ${valor.toLowerCase()}</th>`).join('')}</tr></thead>`
    + `<tbody>${filas}</tbody></table>`;
}

// La lista de al lado de la matriz: número, título, prioridad y eje; cada renglón lleva a su tarjeta
function htmlDeLaListaDeNuevos(lista) {
  return `<ol class="dq-nuevos-indice" aria-label="Los datasets nuevos">${lista.map((p, i) => `<li><button type="button" class="dq-nuevos-item" data-ir-nuevo="${String(i)}">`
    + `<span class="dq-marcador dq-marcador-fijo" aria-hidden="true">${String(numeroDelNuevo(p, i))}</span>`
    + `<span><span class="visualmente-oculto">${esc(p?.numero_texto)}: </span><span class="dq-nuevos-item-titulo">${esc(p?.titulo)}</span>`
    + `<span class="dq-cuad">${htmlDeLaPrioridad(p?.prioridad)}<span class="dq-cuad-eje">${esc(p?.valor_y_riesgo)}</span></span></span></button></li>`).join('')}</ol>`;
}

// null (la edición no trae la clave) o algo que no es una lista: nada. Lista vacía: el título y una línea. Si no, la matriz (si el servidor
// la manda) con la lista al lado y, debajo, una tarjeta por propuesta
function htmlDeLosDatasetsNuevos(lista, matriz = null) {
  if (!Array.isArray(lista)) return '';
  const titulo = `<h3 class="dq-seccion-titulo" id="dq-nuevos-titulo">${TITULO_DATASETS_NUEVOS}</h3>`;
  if (lista.length === 0) return `<section class="dq-nuevos" aria-labelledby="dq-nuevos-titulo">${titulo}<p class="dq-nuevos-vacia">${SIN_DATASETS_NUEVOS}</p></section>`;
  const tabla = htmlDeLaMatriz(matriz, lista);
  return `<section class="dq-nuevos" aria-labelledby="dq-nuevos-titulo">${titulo}`
    + `<div class="dq-matriz-caja${tabla === '' ? ' dq-matriz-sola' : ''}">${tabla === '' ? '' : `<div class="dq-matriz-lugar">${tabla}</div>`}${htmlDeLaListaDeNuevos(lista)}</div>`
    + `<ol class="dq-nuevos-lista">${lista.map(htmlDeUnDatasetNuevo).join('')}</ol></section>`;
}

// =====================================================
// Lo puro: la edición en pestañas (spec 2026-11-18-dato-quincena-detalle-pestanas, 1 a 3)
// =====================================================

// Las pestañas que tiene una edición, en su orden, con su cantidad (de `cantidades`, que manda el servidor): General, Propuestas y,
// si la edición trae la clave (también con []), Datasets nuevos. Sin cantidades (un servidor de antes) o con una que no es un entero
// de 0 en adelante, la cuenta es null y la pestaña va sin número
function pestanasDeLaEdicion(detalle) {
  const cantidades = detalle?.cantidades;
  const cuenta = (valor) => (Number.isSafeInteger(valor) && valor >= 0 ? valor : null);
  const pestanas = [{ clave: 'general', cuenta: null }, { clave: 'propuestas', cuenta: cuenta(cantidades?.propuestas) }];
  if (Array.isArray(detalle?.propuestas_datasets)) pestanas.push({ clave: 'datasets', cuenta: cuenta(cantidades?.datasets_nuevos) });
  return pestanas;
}

// La pestaña que se ve: la pedida, si la edición la tiene; si no (otra, Datasets nuevos sin la clave, o ninguna), General
function vistaElegida(detalle, vista) {
  return pestanasDeLaEdicion(detalle).some((pestana) => pestana.clave === vista) ? vista : 'general';
}

// La pestaña vecina de `actual` con una tecla: las flechas dan la vuelta, Inicio va a la primera y Fin a la última. Otra tecla, o una
// clave que no está, null
function vistaVecina(claves, actual, tecla) {
  const lista = listaDe(claves);
  const aqui = lista.indexOf(actual);
  if (aqui === -1) return null;
  if (tecla === 'Home') return lista[0];
  if (tecla === 'End') return lista[lista.length - 1];
  if (tecla === 'ArrowRight') return lista[(aqui + 1) % lista.length];
  if (tecla === 'ArrowLeft') return lista[(aqui - 1 + lista.length) % lista.length];
  return null;
}

// El número de una propuesta: su `orden` (el del JSON) o, en un detalle sin él (un servidor de antes), su posición desde 1
function ordenDeLaPropuesta(propuesta, indice) {
  return Number.isSafeInteger(propuesta?.orden) && propuesta.orden > 0 ? propuesta.orden : indice + 1;
}

// La propuesta pedida (&propuesta=K), si la edición tiene una con ese número; si no, null: se mira la principal
function propuestaElegida(detalle, propuesta) {
  if (idDeEdicion(propuesta) === null) return null;
  return listaDe(detalle?.propuestas).some((p, indice) => ordenDeLaPropuesta(p, indice) === propuesta) ? propuesta : null;
}

// La posición (desde 0) de la propuesta de orden `orden` (un entero positivo); si la edición no tiene una con ese número, -1
function posicionDelOrdenDq(detalle, orden) {
  if (idDeEdicion(orden) === null) return -1;
  return listaDe(detalle?.propuestas).findIndex((p, indice) => ordenDeLaPropuesta(p, indice) === orden);
}

/**
 * Las dos principales de la edición (spec 2026-11-21-dato-quincena-principal-equipo, 3), con los textos del servidor:
 * - `datito` (principal_datito): `{ orden, posicion, rotulo, pastilla, marca, infografia_pie, infografia_alt }`, la de su orden; sin
 *   principal_datito o con un orden que la edición no tiene (un servidor de antes), la marcada o, si ninguna, la primera, con los
 *   textos de antes;
 * - `equipo` (principal_equipo): `{ orden, posicion, rotulo, pastilla, marca, resumen, cifra_clave, quien }`, con `orden` y `posicion`
 *   en null si no eligió (o si eligió una que la edición no tiene); sin principal_equipo (un servidor de antes), null: ni franja, ni
 *   marca, ni botones.
 * Sin propuestas, las dos en null. La página no decide cuál es cuál: lo dice el servidor.
 */
function principalesDeLaEdicion(detalle) {
  const propuestas = listaDe(detalle?.propuestas);
  if (propuestas.length === 0) return { datito: null, equipo: null };
  const pd = esObjetoDq(detalle?.principal_datito) ? detalle.principal_datito : null;
  const pe = esObjetoDq(detalle?.principal_equipo) ? detalle.principal_equipo : null;
  const delServidor = posicionDelOrdenDq(detalle, pd?.orden);
  const posicion = delServidor !== -1 ? delServidor : Math.max(propuestas.findIndex((p) => p?.principal === true), 0);
  const textoDe = (clave) => (conTextoDq(pd?.[clave]) ? pd[clave] : PRINCIPAL_DE_ANTES[clave]);
  const titulo = propuestas[posicion]?.titulo;
  const datito = {
    orden: ordenDeLaPropuesta(propuestas[posicion], posicion),
    posicion,
    rotulo: textoDe('rotulo'),
    pastilla: textoDe('pastilla'),
    marca: textoDe('marca'),
    infografia_pie: textoDe('infografia_pie'),
    infografia_alt: conTextoDq(pd?.infografia_alt)
      ? pd.infografia_alt
      : (titulo ? `${PRINCIPAL_DE_ANTES.infografia_alt}: ${titulo}` : PRINCIPAL_DE_ANTES.infografia_alt)
  };
  if (pe === null) return { datito, equipo: null };
  const delEquipo = posicionDelOrdenDq(detalle, pe.orden);
  const equipo = {
    orden: delEquipo === -1 ? null : pe.orden,
    posicion: delEquipo === -1 ? null : delEquipo,
    rotulo: pe.rotulo,
    pastilla: pe.pastilla,
    marca: pe.marca,
    resumen: pe.resumen,
    cifra_clave: pe.cifra_clave,
    quien: pe.quien
  };
  return { datito, equipo };
}

// La posición (desde 0) de la propuesta de orden `propuesta`; si no hay una con ese número (o es null), la de la principal del equipo
// o, si no eligió, la de Datito (spec 2026-11-21-dato-quincena-principal-equipo, 4). Sin propuestas, null
function posicionDeLaPropuesta(detalle, propuesta) {
  const propuestas = listaDe(detalle?.propuestas);
  if (propuestas.length === 0) return null;
  const pedida = propuestas.findIndex((p, indice) => ordenDeLaPropuesta(p, indice) === propuesta);
  if (pedida !== -1) return pedida;
  const { datito, equipo } = principalesDeLaEdicion(detalle);
  return equipo?.posicion ?? datito.posicion;
}

// Las pestañas de la edición (role="tablist", spec 2): la elegida con aria-selected y en el orden del teclado; las otras, con
// tabindex="-1" (las flechas, Inicio y Fin van de una a otra). Cada una controla su panel y lleva su cantidad, si la hay, con un
// espacio antes: su nombre se lee «Propuestas 4»
function htmlDePestanasDeLaEdicion(detalle, elegida) {
  const botones = pestanasDeLaEdicion(detalle).map(({ clave, cuenta }) => {
    const es = clave === elegida;
    const numero = cuenta === null ? '' : ` <span class="dq-ed-cuenta">${String(cuenta)}</span>`;
    return `<button type="button" class="dq-ed-pestana" role="tab" id="dq-tab-${clave}" aria-selected="${es}" aria-controls="dq-panel-${clave}"`
      + `${es ? '' : ' tabindex="-1"'} data-vista="${clave}"><span>${TEXTO_DE_LA_VISTA[clave]}</span>${numero}</button>`;
  }).join('');
  return `<div class="dq-ed-pestanas" role="tablist" aria-label="La edición">${botones}</div>`;
}

// La cabecera «tipo diario», como la de las tarjetas de la lista: «El dato de la quincena» con el N.º o la marca, la fecha grande, el
// título del paquete (si hay) y, pegadas a la doble línea, las pestañas
function htmlDeLaCabeceraDeLaEdicion(detalle, elegida) {
  const d = detalle ?? {};
  const paquete = typeof d.titulo === 'string' && d.titulo !== '' ? `<p class="dq-ed-paquete">${esc(d.titulo)}</p>` : '';
  return '<header class="dq-ed-cabecera">'
    + `<p class="dq-mancheta"><span>El dato de la quincena</span>${htmlDelNumeroDiario(d)}</p>`
    + `<h2 class="dq-ed-fecha">${esc(d.fecha_texto)}</h2>${paquete}`
    + `${htmlDePestanasDeLaEdicion(d, elegida)}</header>`;
}

// Un panel de la edición, nombrado por su pestaña (tabindex="0": se llega con Tab aunque no tenga nada que enfocar); el que no se ve,
// con hidden
const htmlDelPanelDeLaEdicion = (clave, elegida, html) => `<div class="dq-ed-panel" role="tabpanel" id="dq-panel-${clave}" `
  + `aria-labelledby="dq-tab-${clave}" tabindex="0"${clave === elegida ? '' : ' hidden'}>${html}</div>`;

// La principal de Datito, en General, con el rótulo del servidor («La principal de Datito»): su título, sus etiquetas (sin «Principal»:
// ya lo dice arriba), su cifra en su ficha, su dataset y el botón que pasa a Propuestas, con el texto del servidor (ver_propuestas). Debajo, la nota
// de Datito (si hay) y el renglón del recibo, que va siempre: es el que se vuelve a dibujar después de un reenvío. Sin propuestas (no
// llega: el POST pide al menos una), solo eso
function htmlDeLaPrincipal(detalle, principal, rotulo = PRINCIPAL_DE_ANTES.rotulo) {
  const d = detalle ?? {};
  const nota = typeof d.nota_archivo === 'string' && d.nota_archivo.trim() !== ''
    ? `<p class="dq-nota-archivo"><b>Nota de ${esc(NOMBRE_DEL_BOT)}:</b> ${esc(d.nota_archivo)}</p>`
    : '';
  const pie = `<div class="dq-edicion-pie">${nota}<p class="dq-recibo">${htmlDelRecibo(d)}</p></div>`;
  if (principal === null || typeof principal !== 'object') return `<div class="dq-la-principal">${pie}</div>`;
  const { nombre, portal } = partesDelDataset(principal.dataset);
  const etiquetas = listaDe(principal.etiquetas).filter((etiqueta) => etiqueta !== 'Principal').map(htmlDeEtiqueta).join('');
  const ver = typeof d.ver_propuestas === 'string' && d.ver_propuestas !== '' ? d.ver_propuestas : TEXTO_VER_PROPUESTAS;
  return `<div class="dq-la-principal"><p class="dq-sobre">${esc(rotulo)}</p>`
    + `<h3 class="dq-principal-titulo">${esc(principal.titulo)}</h3>`
    + (etiquetas ? `<p class="dq-principal-etiquetas">${etiquetas}</p>` : '')
    + htmlDeLaCifra(principal.cifra_clave, 'dq-principal-cifra')
    + `<p class="dq-principal-dataset">Dataset: ${nombre} · ${portal}</p>`
    + `<p class="dq-ir"><button type="button" class="dq-btn dq-btn-tinta" data-ir-vista="propuestas">${esc(ver)}</button></p>`
    + `${pie}</div>`;
}

// La infografía de la principal de Datito (un solo PNG por edición), grande y con su pie: un lugar que la parte del DOM llena desde un
// blob: una sola vez (cambiar de pestaña no la vuelve a pedir). El pie y el texto alternativo son los de `datito` (los del servidor).
// Sin un id que sirva, nada: no hay a dónde pedirla
function htmlDeLaInfografia(detalle, datito) {
  const id = idDeEdicion(detalle?.id);
  if (id === null) return '';
  return '<figure class="dq-figura">'
    + `<div class="dq-infografia" data-infografia="${esc(rutaDelArchivo(id, 'infografia_png'))}" data-alt="${esc(datito?.infografia_alt ?? PRINCIPAL_DE_ANTES.infografia_alt)}"></div>`
    + `<figcaption class="dq-infografia-pie">${esc(datito?.infografia_pie ?? PRINCIPAL_DE_ANTES.infografia_pie)}</figcaption></figure>`;
}

// =====================================================
// Lo puro: la votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 4)
// =====================================================

// La votación del detalle, si es una que se conoce (abierta o cerrada); si no (null en una edición de antes, o algo raro), null
function votacionDe(detalle) {
  const votacion = detalle?.votacion;
  return esObjetoDq(votacion) && (votacion.estado === 'abierta' || votacion.estado === 'cerrada') ? votacion : null;
}

// El puesto que quien mira le dio a la propuesta de orden `orden` («1.º», del servidor, en tu_orden); si no la ordenó, null
function tuPuestoDe(votacion, orden) {
  const fila = listaDe(votacion?.tu_orden).find((item) => item?.orden === orden);
  return fila === undefined ? null : fila.puesto;
}
const textoDeTuPuesto = (puesto) => `Tu ${esc(puesto)}`;

// «Votar» o, si ya votó, «Cambiar mi orden»: abre «Tu orden». `clase` es siempre un literal de la página (el de la franja o el de la propuesta)
const htmlDelBotonDeVotar = (votacion, clase) => `<button type="button" class="${clase}" data-votar aria-haspopup="dialog">`
  + `${listaDe(votacion?.tu_orden).length > 0 ? TEXTOS_DEL_VOTO.cambiar : TEXTOS_DEL_VOTO.votar}</button>`;

// La marca de la de Datito en los votos y en «Tu orden»: el ícono del bot y su nombre, que se ven, y «(la de Datito)», que se lee
const htmlDeLaMarcaDeDatito = () => `<span class="dq-im dq-im-principal dq-im-chica">${ICONO_DATITO}<span aria-hidden="true">${esc(NOMBRE_DEL_BOT)}</span>`
  + `<span class="visualmente-oculto">(la de ${esc(NOMBRE_DEL_BOT)})</span></span>`;

// «Tu orden» de la franja abierta: el orden que guardó quien mira (tu_orden), con el puesto y el texto del servidor. Sin orden, nada
function htmlDeTuOrden(tuOrden) {
  const lista = listaDe(tuOrden);
  if (lista.length === 0) return '';
  return `<div class="dq-tu-orden"><p class="dq-tu-orden-titulo" id="dq-tu-orden-titulo">${TEXTOS_DEL_VOTO.tuOrden}</p><ol aria-labelledby="dq-tu-orden-titulo">`
    + `${lista.map((item) => `<li><b>${esc(item?.puesto)}</b> ${esc(item?.texto)}</li>`).join('')}</ol></div>`;
}

/**
 * Los votos de una votación cerrada (resultado.tabla del servidor): una tabla con una columna por persona que votó, entre «Propuesta» y
 * «Puntos», y una fila por propuesta, de más a menos puntos, con su texto como encabezado de la fila y la marca de la de Datito en la
 * suya. La ganadora va con fondo y «Ganó» con el tilde: no es solo el color. Sin tabla (nadie votó) o sin resultado, nada.
 */
function htmlDeLosVotos(resultado) {
  const tabla = resultado?.tabla;
  if (!esObjetoDq(tabla)) return '';
  const cabeza = `<tr><th scope="col">Propuesta</th>${listaDe(tabla.votantes).map((nombre) => `<th scope="col">${esc(nombre)}</th>`).join('')}`
    + '<th scope="col" class="dq-col-puntos">Puntos</th></tr>';
  const filas = listaDe(tabla.filas).map((fila) => {
    const gana = fila?.gana === true;
    return `<tr${gana ? ' class="dq-gana"' : ''}><th scope="row">${esc(fila?.texto)}${fila?.de_datito === true ? ` ${htmlDeLaMarcaDeDatito()}` : ''}</th>`
      + listaDe(fila?.puestos).map((puesto) => `<td>${esc(puesto)}</td>`).join('')
      + `<td class="dq-col-puntos"><b>${numeroComoTexto(fila?.puntos)}</b>${gana ? ` <span class="dq-gano">${ICONO_CHECK}${TEXTOS_DEL_VOTO.gano}</span>` : ''}</td></tr>`;
  }).join('');
  return '<div class="dq-tabla-caja"><table class="dq-tabla dq-tabla-votos">'
    + '<caption class="visualmente-oculto">El puesto que le dio cada persona a cada propuesta y sus puntos</caption>'
    + `<thead>${cabeza}</thead><tbody>${filas}</tbody></table></div>`;
}

// «Ver la propuesta»: un enlace a la principal del equipo en Propuestas (la elegida a mano o la que ganó). Sin una, o sin un id que sirva, nada
function htmlDeVerLaPrincipal(detalle, equipo) {
  const id = idDeEdicion(detalle?.id);
  if (equipo.orden === null || id === null) return '';
  return `<a class="dq-btn dq-btn-borde dq-btn-chico" href="${esc(urlDeEstado({ id, vista: 'propuestas', propuesta: equipo.orden }))}" `
    + `data-ver-principal="${String(equipo.orden)}">${TEXTO_VER_LA_PROPUESTA}</a>`;
}

/**
 * La franja de la principal del equipo, a lo ancho y arriba de la portada de General (spec 2026-11-23-dato-quincena-principal-votacion, 4,
 * sobre la maqueta B de la spec 2026-11-21-dato-quincena-principal-equipo), siempre con «Principal del equipo:» en negrita:
 * - abierta: el resumen de la votación («se vota hasta …»), la participación y, si quien mira ya votó, «Tu orden»; a la derecha, para
 *   quien puede votar (puede_votar, el true literal), «Falta tu voto» (si le falta) y «Votar» o «Cambiar mi orden»; si no, quiénes votan;
 * - cerrada: la ganadora (el resumen y la cifra de principal_equipo), cómo ganó en negrita, la participación con el cierre y, plegado,
 *   «Ver los votos» con la regla y la tabla (sin votos, no va); a la derecha, «Ver la propuesta»;
 * - una edición de antes (sin votación): lo que se eligió a mano, como antes, sin botones: el resumen, la cifra, quién y cuándo y, con una
 *   elegida, «Ver la propuesta».
 * Votar depende de estar en la lista de esa edición, no del rol: la franja es la misma para todos. Sin principal_equipo (un servidor de
 * antes) o sin propuestas, nada.
 */
function htmlDeLaFranja(detalle, { datito = null, equipo = null } = {}) {
  if (datito === null || equipo === null) return '';
  const votacion = votacionDe(detalle);
  const titulo = (resumen) => `<h3 class="dq-franja-titulo" id="dq-franja-titulo"><span class="dq-franja-rotulo">${ICONO_EQUIPO}<b>${esc(equipo.rotulo)}:</b></span> `
    + `${esc(resumen)}</h3>`;
  const franja = (clases, texto, acciones) => `<section class="dq-franja ${clases}" aria-labelledby="dq-franja-titulo"><div class="dq-franja-texto">${texto}</div>`
    + `${acciones ? `<div class="dq-franja-acciones">${acciones}</div>` : ''}</section>`;
  const cifra = conTextoDq(equipo.cifra_clave) ? `<p class="dq-franja-cifra">${esc(equipo.cifra_clave)}</p>` : '';
  const elegida = `dq-franja-${equipo.orden !== null ? 'elegida' : 'sin'}`;
  if (votacion?.estado === 'abierta') {
    const puede = votacion.puede_votar === true;
    const falta = puede && votacion.falta_tu_voto === true
      ? `<span class="dq-envio dq-envio-espera dq-falta-tu-voto">${ICONO_AVISO}${TEXTOS_DEL_VOTO.faltaTuVoto}</span>`
      : '';
    return franja('dq-franja-sin dq-franja-abierta', titulo(votacion.resumen)
      + `<p class="dq-franja-quien">${esc(votacion.participacion)}</p>`
      + (puede ? '' : `<p class="dq-franja-quien">${TEXTOS_DEL_VOTO.noEstas}</p>`)
      + htmlDeTuOrden(votacion.tu_orden),
    falta + (puede ? htmlDelBotonDeVotar(votacion, 'dq-btn dq-btn-tinta dq-btn-chico') : ''));
  }
  if (votacion?.estado === 'cerrada') {
    const resultado = esObjetoDq(votacion.resultado) ? votacion.resultado : {};
    const tabla = htmlDeLosVotos(resultado);
    const votos = tabla === ''
      ? ''
      : `<details class="dq-votos"><summary>${TEXTOS_DEL_VOTO.verLosVotos}</summary><p class="dq-votos-regla">${esc(resultado.regla)}</p>${tabla}</details>`;
    return franja(`${elegida} dq-franja-cerrada`, titulo(equipo.resumen) + cifra
      + (conTextoDq(resultado.texto) ? `<p class="dq-resultado">${esc(resultado.texto)}</p>` : '')
      + `<p class="dq-franja-quien">${[votacion.participacion, votacion.cierre].filter(conTextoDq).map(esc).join(' ')}</p>`
      + votos,
    htmlDeVerLaPrincipal(detalle, equipo));
  }
  const quien = conTextoDq(equipo.quien) ? `<p class="dq-franja-quien">${esc(equipo.quien)}</p>` : '';
  return franja(elegida, titulo(equipo.resumen) + cifra + quien, htmlDeVerLaPrincipal(detalle, equipo));
}

// El aviso de los datasets nuevos, con los textos del servidor (aviso_datasets_nuevos y ver_datasets_nuevos) y un botón a su pestaña.
// Sin aviso (null: sin la clave o con []) o sin la pestaña a la que lleva, nada
function htmlDelAvisoDeDatasetsNuevos(detalle) {
  const d = detalle ?? {};
  if (!Array.isArray(d.propuestas_datasets) || typeof d.aviso_datasets_nuevos !== 'string' || d.aviso_datasets_nuevos === '') return '';
  const ver = typeof d.ver_datasets_nuevos === 'string' && d.ver_datasets_nuevos !== '' ? d.ver_datasets_nuevos : TEXTO_VER_DATASETS_NUEVOS;
  return `<div class="dq-aviso-nuevos"><p>${esc(d.aviso_datasets_nuevos)}</p>`
    + `<button type="button" class="dq-btn dq-btn-borde" data-ir-vista="datasets">${esc(ver)}</button></div>`;
}

/**
 * General (spec 3): la franja de la principal del equipo (la misma para todos los roles); la principal de Datito y su infografía (en el teléfono, primero la principal:
 * el orden del HTML; en la computadora, la infografía a la izquierda), la agenda a lo ancho, los archivos en una fila, el aviso de los
 * datasets nuevos y, para la administración (`admin`, el true literal), el lugar de la caja del correo, que la parte del DOM pide y llena.
 */
function htmlDelPanelGeneral(detalle, { admin = false } = {}) {
  const d = detalle ?? {};
  const id = idDeEdicion(d.id);
  const principales = principalesDeLaEdicion(d);
  const { datito } = principales;
  const principal = datito === null ? null : d.propuestas[datito.posicion];
  return htmlDeLaFranja(d, principales)
    + `<div class="dq-portada">${htmlDeLaPrincipal(d, principal, datito?.rotulo)}${htmlDeLaInfografia(d, datito)}</div>`
    + htmlDeLaAgenda(d.agenda_grupos)
    + htmlDeArchivos(d.archivos, id)
    + htmlDelAvisoDeDatasetsNuevos(d)
    + (admin === true && id !== null ? `<div class="dq-correo-de-la-edicion">${LUGAR_DE_LA_CAJA_DEL_CORREO}</div>` : '');
}

// Una marca del índice de Propuestas, de una de las dos principales: el ícono y la marca corta («Equipo», «Datito»), que se ven, y la
// pastilla («Principal del equipo», «Principal de Datito»), que se lee (spec 2026-11-21-dato-quincena-principal-equipo, 4)
const htmlDeMarcaDeLaPrincipal = (clase, icono, principal) => `<span class="dq-im ${clase}">${icono}`
  + `<span aria-hidden="true">${esc(principal.marca)}</span><span class="visualmente-oculto">${esc(principal.pastilla)}</span></span>`;

/**
 * El índice de Propuestas (spec 4): cada propuesta con su número de orden, su título (dos renglones) y las marcas de las dos principales
 * (`principales`, de principalesDeLaEdicion: «Equipo» y «Datito», las dos en la misma si coinciden, cada una con su ícono) y «Para
 * validar» (la que trae la etiqueta Validar, con su ícono) y, con la `votacion` abierta, «Tu N.º» en las que ordenó quien mira (spec
 * 2026-11-23-dato-quincena-principal-votacion, 4). La que se ve (`elegida`, su posición) lleva aria-current; el CSS la marca
 * además con una barra, no solo con el color. El número se ve y no se lee: se lee el orden_texto del servidor («Propuesta 1:»), y sin
 * él, el número. Entre las piezas va un espacio (la grilla no lo dibuja), para que no se lean pegadas.
 */
function htmlDelIndiceDePropuestas(propuestas, elegida, { datito = null, equipo = null } = {}, votacion = null) {
  const abierta = esObjetoDq(votacion) && votacion.estado === 'abierta' ? votacion : null;
  const items = listaDe(propuestas).map((p, indice) => {
    const orden = ordenDeLaPropuesta(p, indice);
    const conTexto = typeof p?.orden_texto === 'string' && p.orden_texto !== '';
    const puesto = abierta === null ? null : tuPuestoDe(abierta, orden);
    const marcas = [
      equipo !== null && equipo.orden === orden ? htmlDeMarcaDeLaPrincipal('dq-im-equipo', ICONO_EQUIPO, equipo) : '',
      datito !== null && datito.orden === orden ? htmlDeMarcaDeLaPrincipal('dq-im-principal', ICONO_DATITO, datito) : '',
      (listaDe(p?.etiquetas).includes('Validar') || listaDe(p?.notas_validacion).length > 0) ? `<span class="dq-im dq-im-validar">${ICONO_VALIDAR}Para validar</span>` : '',
      puesto === null ? '' : `<span class="dq-im dq-im-tuyo">${textoDeTuPuesto(puesto)}</span>`
    ].filter(Boolean).join(' ');
    return `<li><button type="button" class="dq-indice-item" data-ver-propuesta="${String(orden)}"${indice === elegida ? ' aria-current="true"' : ''}>`
      + `<span class="dq-indice-num"${conTexto ? ' aria-hidden="true"' : ''}>${String(orden)}</span> <span class="dq-indice-cuerpo">`
      + `${conTexto ? `<span class="visualmente-oculto">${esc(p.orden_texto)}: </span>` : ''}<span class="dq-indice-titulo">${esc(p?.titulo)}</span>`
      + `${marcas ? ` <span class="dq-indice-marcas">${marcas}</span>` : ''}</span></button></li>`;
  }).join('');
  return `<nav class="dq-indice" aria-label="Las propuestas"><ol>${items}</ol></nav>`;
}

// La propuesta de orden `propuesta` (una que no está, o null: la del equipo o, si no hay, la de Datito), con sus vecinas para
// «Anterior» y «Siguiente» y, con la votación abierta, «Tu N.º» y el botón de votar. Es lo que la parte del DOM vuelve a dibujar en
// .dq-lectura al elegir otra. Sin propuestas, nada
function htmlDeLaPropuestaElegida(detalle, propuesta) {
  const propuestas = listaDe(detalle?.propuestas);
  const posicion = posicionDeLaPropuesta(detalle, propuesta);
  if (posicion === null) return '';
  const vecina = (indice) => (indice >= 0 && indice < propuestas.length ? { propuesta: propuestas[indice], orden: ordenDeLaPropuesta(propuestas[indice], indice) } : null);
  return htmlDePropuesta(propuestas[posicion], {
    anterior: vecina(posicion - 1), siguiente: vecina(posicion + 1), principales: principalesDeLaEdicion(detalle), votacion: votacionDe(detalle)
  });
}

// Propuestas (spec 4): el índice a la izquierda (en el teléfono, una fila de chips arriba) y, a la derecha, una propuesta por vez.
// `propuesta`, la que se mira, viene de propuestaElegida (un número de orden, o null: la del equipo o la de Datito). Sin propuestas, nada
function htmlDelPanelPropuestas(detalle, { propuesta = null } = {}) {
  const posicion = posicionDeLaPropuesta(detalle, propuesta);
  if (posicion === null) return '';
  return `<div class="dq-propuestas">${htmlDelIndiceDePropuestas(detalle.propuestas, posicion, principalesDeLaEdicion(detalle), votacionDe(detalle))}`
    + `<div class="dq-lectura">${htmlDeLaPropuestaElegida(detalle, propuesta)}</div></div>`;
}

// Datasets nuevos: las propuestas de datasets (solo se dibuja si la edición trae la clave)
function htmlDelPanelDatasets(detalle) {
  return htmlDeLosDatasetsNuevos(detalle?.propuestas_datasets, detalle?.matriz_de_prioridad);
}

/**
 * El detalle de una edición (spec 2): «Todas las ediciones» y una hoja con la cabecera, las pestañas y sus paneles, dibujados juntos:
 * el de `vista` a la vista (si la edición no lo tiene, General) y los otros con hidden; cambiar de pestaña no vuelve a dibujar nada.
 * `propuesta` es la que se mira en Propuestas (una que la edición no tiene, la del equipo o la de Datito); `admin`, el true literal, suma
 * a General el lugar de la caja del correo. Votar no depende del rol: lo dice la votación del detalle (puede_votar).
 */
function htmlDelDetalle(detalle, { admin = false, vista = null, propuesta = null } = {}) {
  const d = detalle ?? {};
  const elegida = vistaElegida(d, vista);
  const paneles = {
    general: () => htmlDelPanelGeneral(d, { admin }),
    propuestas: () => htmlDelPanelPropuestas(d, { propuesta: propuestaElegida(d, propuesta) }),
    datasets: () => htmlDelPanelDatasets(d)
  };
  return `<p class="dq-volver-caja"><a class="dq-link dq-volver" href="${PAGINA_DATO_QUINCENA}">${ICONO_VOLVER}${TEXTO_TODAS_LAS_EDICIONES}</a></p>`
    + `<div class="dq-hoja">${htmlDeLaCabeceraDeLaEdicion(d, elegida)}`
    + pestanasDeLaEdicion(d).map(({ clave }) => htmlDelPanelDeLaEdicion(clave, elegida, paneles[clave]())).join('')
    + '</div>';
}

// =====================================================
// Lo puro: la pestaña «Envío y votación», la caja del correo del detalle y el diálogo de «Reenviar» (spec
// 2026-11-12-dato-quincena-correo, 13, y spec 2026-11-23-dato-quincena-principal-votacion, 4)
// =====================================================

// La copia del navegador de textoDeLosQueReciben (services/datoQuincenaCorreoReglas.js): el pie de «Las personas» mientras se
// tilda «Recibe el mail», antes de guardar. Al cargar, el pie es el del servidor (reciben_texto). Atada por un test de paridad
function textoDeLosQueReciben(cantidad) {
  if (cantidad === 0) return 'Todavía no lo recibe nadie.';
  return cantidad === 1 ? 'Lo recibe 1 persona.' : `Lo reciben ${String(cantidad)} personas.`;
}

// La copia del navegador de textoDeLosQueVotan (services/datoQuincenaVotacionReglas.js): lo mismo con «Vota». Al cargar, el del
// servidor (votan_texto). Atada por un test de paridad
function textoDeLosQueVotan(cantidad) {
  if (cantidad === 0) return 'No vota nadie.';
  return cantidad === 1 ? 'Vota 1 persona.' : `Votan ${String(cantidad)} personas.`;
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

// Una persona activa en la tabla de «Las personas»: su nombre con el cargo y, si está de licencia hoy, hasta cuándo; el rol; el
// correo; y sus dos casillas, «Recibe el mail» y «Vota» (tildadas con el true literal). Sin un id que sirva, sin casillas (no habría a
// quién guardar)
function htmlDePersonaDelCorreo(persona) {
  const p = persona ?? {};
  const id = idDeEdicion(p.id);
  const nombre = esc(p.nombre);
  const cargo = typeof p.cargo === 'string' && p.cargo !== '' ? `<small>${esc(p.cargo)}</small>` : '';
  const licencia = typeof p.licencia === 'string' && p.licencia !== '' ? `<small class="dq-licencia">${esc(p.licencia)}</small>` : '';
  const casilla = (atributo, que, tildada) => (id === null
    ? ''
    : `<input type="checkbox" ${atributo}="${String(id)}" aria-label="${nombre} ${que}"${tildada === true ? ' checked' : ''}>`);
  return `<tr><td>${nombre}${cargo}${licencia}</td><td>${esc(p.rol)}</td><td class="dq-col-correo">${esc(p.email)}</td>`
    + `<td class="dq-col-recibe">${casilla('data-usuario', 'recibe el mail', p.recibe)}</td>`
    + `<td class="dq-col-vota">${casilla('data-vota', 'vota', p.vota)}</td></tr>`;
}

/**
 * La pestaña «Envío y votación» (GET /dato-quincena/correo): «Envío por correo», con el interruptor «Envío automático» (prendido solo
 * con el true literal), la regla, lo que pasa apagado y «Las próximas ediciones»; «La votación de la principal del equipo», la regla
 * en dos párrafos (spec 2026-11-23-dato-quincena-principal-votacion, 4, como la maqueta aprobada); y «Las personas», con qué es cada
 * casilla, la tabla de las personas activas con «Recibe el mail» y «Vota», el pie del servidor («Lo recibe 1 persona. Votan 3
 * personas.») y un solo «Guardar».
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
    + '<section class="dq-caja" aria-labelledby="dq-votacion-titulo">'
    + '<div class="dq-caja-cabeza"><h2 id="dq-votacion-titulo">La votación de la principal del equipo</h2></div>'
    + '<p>Cada edición se vota hasta las <b>12:00 del día en que sale el mail</b> (o del día hábil siguiente, si sale a las 14:00) '
    + 'o hasta que voten todas las personas de su lista, lo que pase primero. '
    + 'Cada persona que vota toca las propuestas de la que más quiere trabajar a la que menos: el 1.º puesto da tantos puntos como propuestas hay y el último, 1. '
    + `Gana la que suma más; si empatan, la de ${NOMBRE_DEL_BOT} o, si no está entre las empatadas, la de número más bajo. Si nadie vota, queda la de ${NOMBRE_DEL_BOT}.</p>`
    + '<p class="dq-suave">Hasta el cierre se ve quién votó; el orden de cada persona, después. A las 14:00 del día del cierre, administración recibe un mail '
    + 'con la que ganó (si ese día está de licencia, no le llega). Los pilotos se votan igual, sin ese mail.</p>'
    + '</section>'
    + '<section class="dq-caja" aria-labelledby="dq-quien-titulo">'
    + '<div class="dq-caja-cabeza"><h2 id="dq-quien-titulo">Las personas</h2></div>'
    + '<ul class="dq-que-es"><li><b>Recibe el mail:</b> a cada persona le llega su propio mail, a la casilla de su cuenta. Si ese día está de licencia, no le llega.</li>'
    + '<li><b>Vota:</b> ordena las propuestas de cada edición hasta el cierre. Puede ser de cualquier rol.</li></ul>'
    + '<div class="dq-tabla-caja"><table class="dq-tabla" aria-labelledby="dq-quien-titulo"><thead><tr><th scope="col">Persona</th><th scope="col">Rol</th>'
    + '<th scope="col" class="dq-col-correo">Correo</th><th scope="col" class="dq-col-recibe">Recibe el mail</th><th scope="col" class="dq-col-vota">Vota</th></tr></thead>'
    + `<tbody>${filas}</tbody></table></div>`
    + `<div class="dq-correo-pie"><p class="dq-suave"><span id="dq-cuantas-reciben">${esc(d.reciben_texto)}</span> `
    + `<span id="dq-cuantas-votan">${esc(d.votan_texto)}</span></p>`
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
// Lo puro: el diálogo «Tu orden» (spec 2026-11-23-dato-quincena-principal-votacion, 4, la forma B de la maqueta, «Tocar en orden»)
// =====================================================

// Lo que falta, debajo de las propuestas: sin ninguna tocada, por dónde empezar; después, cuántas faltan; con todas, listo. Lo arma la
// página porque es la cuenta de lo que se está tocando, que todavía no se guardó
function textoDeLoQueFaltaTocar(total, tocadas) {
  if (tocadas === 0) return TEXTOS_DEL_VOTO.primero;
  const faltan = total - tocadas;
  if (faltan <= 0) return total === 1 ? 'Listo: ya está la única.' : `Listo: ya están las ${String(total)}.`;
  return faltan === 1 ? 'Te falta 1.' : `Te faltan ${String(faltan)}.`;
}

// Tocar la propuesta de orden `orden`: sin puesto, toma el siguiente; con puesto, se lo saca y las de atrás suben. Devuelve una lista nueva
function tocadasDespuesDeTocar(tocadas, orden) {
  const lista = listaDe(tocadas);
  return lista.includes(orden) ? lista.filter((tocada) => tocada !== orden) : [...lista, orden];
}

// Con qué arranca el diálogo: sin voto, ninguna (así no empuja a dejar el orden de Datito); con voto, el suyo (tu_orden del servidor)
function tocadasAlAbrir(detalle) {
  return listaDe(votacionDe(detalle)?.tu_orden).map((item) => item?.orden).filter((orden) => posicionDelOrdenDq(detalle, orden) !== -1);
}

/**
 * El cuerpo de «Tu orden» con las propuestas tocadas (`tocadas`, sus `orden` en el orden en que se tocaron): una fila por propuesta, en
 * el orden de la edición, cada una un botón con aria-pressed, su puesto («1.º») o un punto si no lo tiene, «Propuesta N», el título y la
 * marca de la de Datito en la suya. Debajo, lo que falta y, si hay alguna tocada, «Empezar de nuevo». El texto de arriba (el del servidor,
 * votacion.dialogo) está fuera, en el HTML de la página. Sin propuestas, nada.
 */
function htmlDelDialogoDelVoto(detalle, tocadas) {
  const propuestas = listaDe(detalle?.propuestas);
  if (propuestas.length === 0) return '';
  const { datito } = principalesDeLaEdicion(detalle);
  const ordenes = propuestas.map((p, indice) => ordenDeLaPropuesta(p, indice));
  const validas = listaDe(tocadas).filter((orden) => ordenes.includes(orden));
  const filas = propuestas.map((p, indice) => {
    const orden = ordenes[indice];
    const lugar = validas.indexOf(orden);
    const tocada = lugar !== -1;
    const numero = conTextoDq(p?.orden_texto) ? esc(p.orden_texto) : `Propuesta ${String(orden)}`;
    const puesto = tocada ? `<span class="dq-pos">${String(lugar + 1)}.º</span>` : '<span class="dq-pos" aria-hidden="true">·</span>';
    return `<li><button type="button" class="dq-tocar${tocada ? ' dq-tocada' : ''}" data-tocar="${String(orden)}" aria-pressed="${tocada}">${puesto} `
      + `<span class="dq-tocar-tit"><b>${numero}</b> ${esc(p?.titulo)}${datito?.orden === orden ? ` ${htmlDeLaMarcaDeDatito()}` : ''}</span></button></li>`;
  }).join('');
  const deNuevo = validas.length > 0 ? `<button type="button" class="dq-link dq-de-nuevo" data-de-nuevo>${TEXTOS_DEL_VOTO.deNuevo}</button>` : '';
  return `<ul class="dq-tocar-lista">${filas}</ul>`
    + `<div class="dq-tocar-pie"><p class="dq-falta-tocar">${textoDeLoQueFaltaTocar(propuestas.length, validas.length)}</p>${deNuevo}</div>`;
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

// La región viva de la página (#dq-anuncio, fuera de lo que se vuelve a dibujar) u otra (`id`: la de «Tu orden», #dq-voto-anuncio, dentro
// del diálogo, porque con aria-modal lo de afuera no se anuncia). Un texto igual al anterior se cambia apenas (un espacio duro al final),
// para que se vuelva a anunciar
function anunciarDatoQuincena(texto, id = 'dq-anuncio') {
  const region = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// =====================================================
// La página (DOM y API)
// =====================================================

// El estado de la página. `pedido` numera las cargas: una respuesta que llega después de otra más nueva se descarta. `admin` es de
// Auth.isAdmin() al arrancar; `pestana`, la de página que se ve (Ediciones o Envío y votación); `detalle` y `caja`, la edición
// abierta y su caja del correo; `vista` y `propuesta`, la pestaña de la edición que se ve y la propuesta que se mira en Propuestas
// (null: la del equipo o la de Datito); `reenvio` y `voto`, los diálogos abiertos (`voto`: `{ volverA, tocadas }`, el botón que lo
// abrió y los `orden` en el orden en que se tocaron); `guardandoVoto`, mientras se guarda un orden (no se abre ninguno de los dos
// diálogos, no cambia lo tocado ni empieza otro guardado); `abriendoVoto`, mientras «Votar» vuelve a pedir la edición (no se abre
// ninguno de los dos diálogos)
const vistaDatoQuincena = {
  pedido: 0, anio: null, pagina: 1, cargando: false, datos: null, imagenes: new Set(), modal: null,
  admin: false, pestana: 'ediciones', detalle: null, caja: null, vista: 'general', propuesta: null, reenvio: null,
  voto: null, guardandoVoto: false, abriendoVoto: false
};
// Una cosa por vez: mientras se guarda un orden o «Votar» espera la edición, no se abre «Tu orden» ni «Reenviar…»
const votoOcupadoDq = () => vistaDatoQuincena.guardandoVoto === true || vistaDatoQuincena.abriendoVoto === true;

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

// El detalle de una edición, en la pestaña `vista` y con la `propuesta` que pide la dirección: una pestaña que la edición no tiene
// abre General, una propuesta que no tiene es la principal, y la dirección se corrige. Un 404 es «No existe esa edición.»; otro
// error, el error. Para la administración, después pide su caja del correo (solo ella la pide)
async function cargarDetalleDq(id, { vista = null, propuesta = null } = {}) {
  const pedido = ++vistaDatoQuincena.pedido;
  vistaDatoQuincena.detalle = null;
  vistaDatoQuincena.caja = null;
  document.title = TITULO_DQ;
  dibujarDatoQuincena(htmlDelEstado('cargando'));
  try {
    const detalle = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}`))?.data;
    if (pedido !== vistaDatoQuincena.pedido) return;
    if (detalle === null || typeof detalle !== 'object' || idDeEdicion(detalle.id) === null) throw new TypeError('La respuesta no es una edición');
    const elegida = vistaElegida(detalle, vista);
    const mirada = elegida === 'propuestas' ? propuestaElegida(detalle, propuesta) : null;
    dibujarDatoQuincena(htmlDelDetalle(detalle, { admin: vistaDatoQuincena.admin, vista: elegida, propuesta: mirada }));
    Object.assign(vistaDatoQuincena, { detalle, vista: elegida, propuesta: mirada });
    escribirUrlDeLaEdicionDq();
    if (elegida === 'propuestas') correrLaFilaHastaDq(renglonElegidoDq(), { suave: false });
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

// Lo que pide la pestaña Ediciones según la dirección (`search`): con ?id, el detalle en la pestaña de &vista y con la propuesta de
// &propuesta (un id que no es un entero positivo, «No existe esa edición.» sin pedirlo); sin él, la lista del año de ?anio (o el más
// reciente) en la página de &pagina
function cargarEdicionesDq(search) {
  const texto = String(search ?? '');
  const estado = estadoDeLaUrl(texto);
  if (new URLSearchParams(texto.replace(/^\?/, '')).has('id')) {
    if (estado.id !== null) return cargarDetalleDq(estado.id, { vista: estado.vista, propuesta: estado.propuesta });
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

// Libera las URL de las imágenes (la infografía del detalle: al pasar a Envío y votación y al salir de la página)
function liberarImagenesDq() {
  for (const url of vistaDatoQuincena.imagenes) URL.revokeObjectURL(url);
  vistaDatoQuincena.imagenes.clear();
}

// ---- Los clics y los cambios, delegados en #dq-contenido ----

function alTocarDq(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.closest !== 'function') return;
  let boton;
  if ((boton = objetivo.closest('button[data-vista]'))) elegirVistaDq(boton.dataset.vista);
  else if ((boton = objetivo.closest('button[data-ir-vista]'))) irAVistaDq(boton);
  else if ((boton = objetivo.closest('a[data-ver-principal]'))) verLaPrincipalDq(boton, evento);
  else if ((boton = objetivo.closest('button[data-ver-propuesta]'))) verPropuestaDq(boton);
  else if ((boton = objetivo.closest('button[data-ir-nuevo]'))) irANuevoDq(boton);
  else if ((boton = objetivo.closest('button[data-anio]'))) elegirAnioDq(boton);
  else if ((boton = objetivo.closest('button[data-pagina]'))) irAPaginaDq(boton);
  else if ((boton = objetivo.closest('button[data-copiar]'))) copiarTexto(boton, boton.dataset.copiar ?? '');
  else if ((boton = objetivo.closest('button[data-ver]'))) verArchivoDq(boton);
  else if ((boton = objetivo.closest('button[data-descargar]'))) descargarArchivoDq(boton);
  // «Votar» y «Cambiar mi orden», de la franja y de cada propuesta: para cualquier rol en la lista de esa edición
  else if ((boton = objetivo.closest('button[data-votar]'))) abrirElVotoDq(boton);
  // Lo que sigue solo existe para la administración (la pestaña «Envío y votación» y la caja del detalle)
  else if ((boton = objetivo.closest('button[data-guardar-lista]'))) guardarListaDq(boton);
  else if ((boton = objetivo.closest('button[data-reenviar]'))) abrirReenvioDq(boton);
  else if ((boton = objetivo.closest('button[data-prueba]'))) mandarPruebaDq(boton);
}

// El interruptor y las casillas de la pestaña «Envío y votación» (solo la administración los tiene)
function alCambiarDq(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.matches !== 'function') return;
  if (objetivo.id === 'dq-envio-activo') cambiarEnvioDq(objetivo);
  else if (objetivo.matches('input[data-usuario]')) contarLosQueRecibenDq();
  else if (objetivo.matches('input[data-vota]')) contarLosQueVotanDq();
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
  arriba.scrollIntoView?.({ behavior: sinMovimientoDq() ? 'instant' : 'smooth', block: 'start' });
}

// ---- Las pestañas de la edición (spec 2026-11-18-dato-quincena-detalle-pestanas, 1 y 2) ----

// La dirección del detalle con la pestaña y la propuesta que se ven, si cambió (sin sumar al historial: Atrás no recorre las
// pestañas). El #correo queda como estaba
function escribirUrlDeLaEdicionDq() {
  const { detalle, vista, propuesta } = vistaDatoQuincena;
  if (idDeEdicion(detalle?.id) === null) return;
  const correo = estadoDeLaUrl('', window.location?.hash).correo;
  const url = urlDeEstado({ id: detalle.id, vista, propuesta, correo });
  if (url !== `${PAGINA_DATO_QUINCENA}${window.location?.search ?? ''}${window.location?.hash ?? ''}`) window.history?.replaceState?.(null, '', url);
}

// Las pestañas de la edición que están en la página, en su orden
const pestanasDeLaHojaDq = () => [...(elementoDq('dq-contenido')?.querySelector('.dq-ed-pestanas')?.querySelectorAll('[role="tab"][data-vista]') ?? [])];

// Con movimiento reducido, nada se desliza
const sinMovimientoDq = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// Si `elemento` quedó arriba de la vista (las pestañas, después de un botón del final de General; la propuesta, después de «Siguiente»
// al pie de una larga), la página sube hasta él; si se ve, no se mueve
function llevarALaVistaDq(elemento) {
  const arriba = elemento?.getBoundingClientRect?.().top;
  const encabezado = document.querySelector?.('.header')?.getBoundingClientRect?.().bottom ?? 0;
  if (typeof arriba !== 'number' || arriba >= encabezado) return;
  elemento.scrollIntoView?.({ behavior: sinMovimientoDq() ? 'instant' : 'smooth', block: 'start' });
}

/**
 * Elige una pestaña de la edición: la marca (aria-selected, y solo ella en el orden del teclado), muestra su panel y esconde los otros
 * (nada se vuelve a dibujar ni a pedir: la infografía y los «Copiar» quedan como estaban), reemplaza la dirección, le pasa el foco y,
 * si quedó arriba de la vista, sube hasta ella. Una clave que la hoja no tiene no cambia nada (devuelve false).
 */
function elegirVistaDq(clave) {
  const pestanas = pestanasDeLaHojaDq();
  const elegida = pestanas.find((pestana) => pestana.dataset.vista === clave);
  if (!elegida || vistaDatoQuincena.detalle === null) return false;
  for (const pestana of pestanas) {
    const es = pestana === elegida;
    pestana.setAttribute('aria-selected', String(es));
    if (es) pestana.removeAttribute('tabindex');
    else pestana.setAttribute('tabindex', '-1');
  }
  for (const panel of elementoDq('dq-contenido').querySelectorAll('.dq-ed-panel')) panel.hidden = panel.id !== `dq-panel-${clave}`;
  if (clave === 'propuestas') correrLaFilaHastaDq(renglonElegidoDq(), { suave: false });
  vistaDatoQuincena.vista = clave;
  escribirUrlDeLaEdicionDq();
  elegida.focus?.({ preventScroll: true });
  correrLaFilaHastaDq(elegida);
  llevarALaVistaDq(elementoDq('dq-contenido').querySelector('.dq-ed-pestanas'));
  return true;
}

// Un botón de General que lleva a otra pestaña: «Ver las N propuestas» a Propuestas, en la principal (spec 3; si se miraba otra,
// vuelve a la principal), y el del aviso, a Datasets nuevos
function irAVistaDq(boton) {
  if (boton.dataset.irVista === 'propuestas') {
    vistaDatoQuincena.propuesta = null;
    mostrarPropuestaDq(null);
  }
  return elegirVistaDq(boton.dataset.irVista);
}

// Un marcador de la matriz o un renglón de la lista: lleva a la tarjeta de ese dataset (el foco a su título y la página sube hasta ella)
function irANuevoDq(boton) {
  const tarjeta = elementoDq(`dq-nuevo-${String(Number(boton.dataset.irNuevo))}`);
  if (!tarjeta) return false;
  tarjeta.querySelector?.('.dq-nuevo-titulo')?.focus?.({ preventScroll: true });
  tarjeta.scrollIntoView?.({ behavior: sinMovimientoDq() ? 'instant' : 'smooth', block: 'start' });
  return true;
}

// ---- Propuestas: una por vez (spec 2026-11-18-dato-quincena-detalle-pestanas, 4) ----

/**
 * Dibuja en .dq-lectura la propuesta de orden `propuesta` (null, o una que la edición no tiene: la principal) y la marca en el índice
 * (aria-current solo en ella), sin tocar el foco ni la dirección. El índice no se vuelve a dibujar: la fila de chips del teléfono no
 * pierde dónde estaba. Sin la lectura en la página o sin detalle, nada; si no, devuelve `{ orden, item }` (el renglón del índice).
 */
function mostrarPropuestaDq(propuesta) {
  const detalle = vistaDatoQuincena.detalle;
  const contenido = elementoDq('dq-contenido');
  const lectura = contenido?.querySelector('.dq-lectura');
  const posicion = posicionDeLaPropuesta(detalle, propuesta);
  if (detalle === null || !lectura || posicion === null) return null;
  const orden = ordenDeLaPropuesta(detalle.propuestas[posicion], posicion);
  lectura.innerHTML = htmlDeLaPropuestaElegida(detalle, propuesta);
  let item = null;
  for (const renglon of contenido.querySelectorAll('.dq-indice-item')) {
    if (Number(renglon.dataset.verPropuesta) === orden) {
      renglon.setAttribute('aria-current', 'true');
      item = renglon;
    } else {
      renglon.removeAttribute('aria-current');
    }
  }
  return { orden, item };
}

// En el teléfono el índice (y la fila de las pestañas, con el foco del teclado) corre de costado: si el elegido no se ve entero, la fila
// corre hasta él (en la computadora la lista no corre y el renglón siempre se ve; con el panel escondido, todo mide 0: no pasa nada). Al abrir la página o
// la pestaña, de una (`suave`: false)
function correrLaFilaHastaDq(item, { suave = true } = {}) {
  const fila = (item?.closest?.('ol') ?? item?.closest?.('[role="tablist"]'));
  const caja = fila?.getBoundingClientRect?.();
  const chip = item?.getBoundingClientRect?.();
  if (!caja || !chip) return;
  const comportamiento = suave && !sinMovimientoDq() ? 'smooth' : 'instant';
  if (chip.left < caja.left || chip.right > caja.right) fila.scrollTo?.({ left: fila.scrollLeft + chip.left - caja.left, behavior: comportamiento });
  // El índice fijo de la computadora tiene un alto tope: si el renglón elegido quedó fuera de su caja, la caja corre hasta él
  const indice = item.closest?.('.dq-indice');
  const marco = indice?.getBoundingClientRect?.();
  if (indice && marco && indice.scrollHeight > indice.clientHeight && (chip.top < marco.top || chip.bottom > marco.bottom)) {
    indice.scrollTo?.({ top: indice.scrollTop + chip.top - marco.top, behavior: comportamiento });
  }
}

// El renglón del índice de la propuesta que se ve
const renglonElegidoDq = () => elementoDq('dq-contenido')?.querySelector('.dq-indice-item[aria-current]') ?? null;

/**
 * Un renglón del índice, «Anterior» o «Siguiente»: muestra esa propuesta, la deja en la dirección (&propuesta=K, sin sumar al historial),
 * le pasa el foco a su título y, si quedó arriba de la vista, la página sube hasta ella. El foco va antes: un focus() después corta el
 * desplazamiento suave. Un número que la edición no tiene no cambia nada (devuelve false).
 */
function verPropuestaDq(boton) {
  const pedida = propuestaElegida(vistaDatoQuincena.detalle, Number(boton.dataset.verPropuesta));
  const mostrada = pedida === null ? null : mostrarPropuestaDq(pedida);
  if (mostrada === null) return false;
  vistaDatoQuincena.propuesta = mostrada.orden;
  escribirUrlDeLaEdicionDq();
  correrLaFilaHastaDq(mostrada.item);
  const lectura = elementoDq('dq-contenido').querySelector('.dq-lectura');
  lectura.querySelector('.dq-prop-titulo')?.focus?.({ preventScroll: true });
  llevarALaVistaDq(lectura);
  return true;
}

// Las flechas, Inicio y Fin en las pestañas de la edición: la elegida cambia con el foco, como en Ediciones y Envío y votación. Con
// Alt, Ctrl o Meta, nada (son atajos del navegador)
function alTeclearDq(evento) {
  const pestana = evento.target?.closest?.('[role="tab"][data-vista]');
  if (!pestana || evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const destino = vistaVecina(pestanasDeLaHojaDq().map((p) => p.dataset.vista), pestana.dataset.vista, evento.key);
  if (destino === null) return;
  evento.preventDefault?.();
  if (destino !== pestana.dataset.vista) elegirVistaDq(destino);
}

// ---- Las pestañas de página (administración) ----

// Las pestañas se dibujan en #dq-pestanas, fuera de lo que se vuelve a dibujar; el panel que controlan es #dq-contenido, que pasa a
// ser su tabpanel, nombrado por la pestaña elegida
function dibujarPestanasDq(activa) {
  const lugar = elementoDq('dq-pestanas');
  if (lugar) lugar.innerHTML = htmlDePestanas(activa);
  const contenido = elementoDq('dq-contenido');
  contenido?.setAttribute?.('role', 'tabpanel');
  contenido?.setAttribute?.('aria-labelledby', `dq-tab-${activa === 'correo' ? 'correo' : 'ediciones'}`);
}

// Muestra una pestaña: Envío y votación, o Ediciones con lo que pide la dirección (?id, ?anio, &pagina). La infografía de un detalle
// que se deja se libera
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

// ---- La pestaña «Envío y votación» (administración) ----

// La configuración del correo y de la votación (GET /dato-quincena/correo): el interruptor, las próximas y las personas. Si no llega, su error
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

// Las casillas de «Recibe el mail» y de «Vota» de la tabla
const casillasDeLaListaDq = () => [...(elementoDq('dq-contenido')?.querySelectorAll('input[data-usuario]') ?? [])];
const casillasDeLosQueVotanDq = () => [...(elementoDq('dq-contenido')?.querySelectorAll('input[data-vota]') ?? [])];
// Los ids tildados de unas casillas (`clave`, la del data-): uno que no sirve no va
const tildadosDq = (casillas, clave) => casillas.filter((casilla) => casilla.checked)
  .map((casilla) => Number(casilla.dataset[clave])).filter((id) => idDeEdicion(id) !== null);

// El pie de «Las personas» mientras se tilda, con las copias de las reglas (todavía no se guardó)
function contarLosQueRecibenDq() {
  const lugar = elementoDq('dq-cuantas-reciben');
  if (lugar) lugar.textContent = textoDeLosQueReciben(casillasDeLaListaDq().filter((casilla) => casilla.checked).length);
}
function contarLosQueVotanDq() {
  const lugar = elementoDq('dq-cuantas-votan');
  if (lugar) lugar.textContent = textoDeLosQueVotan(casillasDeLosQueVotanDq().filter((casilla) => casilla.checked).length);
}

// «Guardar»: las dos listas enteras, con los tildados (PUT …/correo/destinatarios con `usuarios` y `votantes`); deshabilitado hasta la respuesta
function guardarListaDq(boton) {
  return conBotonBloqueadoDq(boton, async () => {
    const usuarios = tildadosDq(casillasDeLaListaDq(), 'usuario');
    const votantes = tildadosDq(casillasDeLosQueVotanDq(), 'vota');
    try {
      const respuesta = await API.pedirJson('PUT', '/dato-quincena/correo/destinatarios', { usuarios, votantes });
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
 * vuelve a dibujar el renglón del recibo de General con la línea del correo que trae (después de un reenvío o una prueba). `foco`: los
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

// Abre el diálogo con la lista de hoy de la caja; el foco, en la opción elegida (después de la transición del velo). Mientras se
// guarda un orden, no abre: la edición se volvería a dibujar con el diálogo abierto y el foco iría a «Cambiar mi orden», detrás del velo
function abrirReenvioDq(boton) {
  const id = idDeEdicion(vistaDatoQuincena.detalle?.id);
  const caja = vistaDatoQuincena.caja;
  if (votoOcupadoDq() || id === null || caja === null) return;
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
 * a nadie, o no se pudo), cierra el diálogo, avisa con el texto del servidor y vuelve a pedir la caja y la línea del recibo.
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

// Cierran la ×, «Cancelar» (data-cerrar), Escape y el clic en el velo (si empezó en el velo); Tab no sale del diálogo; elegir una
// persona de la lista marca «A una persona»
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
    if (!vistaDatoQuincena.reenvio) return;
    if (evento.key === 'Escape') {
      evento.preventDefault?.();
      cerrarReenvioDq();
    } else if (evento.key === 'Tab') retenerFocoDq(evento, modal);
  });
  elementoDq('dq-reenvio-confirmar').addEventListener('click', (evento) => confirmarReenvioDq(evento.currentTarget));
}

function marcarUnaPersonaDq() {
  const una = elementoDq('dq-reenvio').querySelector('input[name="dq-a"][value="una"]');
  if (una) una.checked = true;
}

// Tab y Mayúscula+Tab no salen de un diálogo abierto (aria-modal), como en admin.js: entre sus controles se deja al navegador (que sabe
// moverse, también entre las opciones); solo se interviene en los bordes (Mayúscula+Tab en el primero, Tab en el último) y si el foco
// quedó afuera
function retenerFocoDq(evento, dialogo) {
  if (!dialogo) return;
  const enfocables = [...dialogo.querySelectorAll('button, select, input, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((elemento) => !elemento.disabled && elemento.getClientRects().length > 0);
  if (enfocables.length === 0) return;
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  const enfocado = document.activeElement;
  if (!dialogo.contains(enfocado)) (evento.shiftKey ? ultimo : primero).focus();
  else if (evento.shiftKey && enfocado === primero) ultimo.focus();
  else if (!evento.shiftKey && enfocado === ultimo) primero.focus();
  else return;
  evento.preventDefault?.();
}

// ---- La principal del equipo: «Ver la propuesta» y votar (spec 2026-11-23-dato-quincena-principal-votacion, 4) ----

/**
 * «Ver la propuesta» de la franja, un enlace a la principal del equipo en Propuestas: un clic común la muestra sin recargar, como «Ver
 * las N propuestas» (la pestaña con el foco, la dirección con &propuesta=K); con Ctrl, Meta, Mayúscula o Alt, o con otro botón, el
 * navegador sigue el enlace. Una propuesta que la edición no tiene, también (devuelve false).
 */
function verLaPrincipalDq(enlace, evento) {
  if ((evento?.button ?? 0) !== 0 || evento?.ctrlKey || evento?.metaKey || evento?.shiftKey || evento?.altKey) return false;
  const pedida = propuestaElegida(vistaDatoQuincena.detalle, Number(enlace.dataset.verPrincipal));
  if (pedida === null) return false;
  evento.preventDefault?.();
  vistaDatoQuincena.propuesta = pedida;
  mostrarPropuestaDq(pedida);
  return elegirVistaDq('propuestas');
}

// Después de guardar, el foco va a «Cambiar mi orden» del panel que se ve (el de la franja en General, el de la propuesta en Propuestas)
const FOCO_DESPUES_DE_VOTAR = 'button[data-votar]';
// Lo que dice que ya no se puede votar esa edición: 409 («La votación ya cerró.», «Esta edición no se vota.») y 403 («No estás en
// la lista…»). Con esos, el diálogo se cierra y la edición se vuelve a dibujar, sin «Votar»; con otro error (un 500, la red), se
// puede volver a probar
const YA_NO_SE_VOTA = Object.freeze([403, 409]);

/**
 * Guarda `orden` (los `orden` de todas las propuestas, de la más querida a la menos) como el voto de quien mira en la edición que se ve
 * (PUT …/voto con `{ orden }`), con el botón deshabilitado hasta la respuesta (un doble clic manda un solo pedido). Uno por vez: mientras
 * otro espera su respuesta, no hace nada. Si sale bien: `cerrar` (el diálogo cierra), la edición se vuelve a pedir y a dibujar en el
 * lugar, con el foco en «Cambiar mi orden», y el aviso dice lo del servidor. Si no, el error del servidor (o uno fijo), también en la
 * región viva del diálogo si está abierto (con aria-modal, la de la página no se anuncia); con un 403 o un 409, además, `cerrar` y la
 * edición se vuelve a pedir y a dibujar (el foco, en su pestaña); con otro, el diálogo queda abierto. Un 401, al login.
 */
function guardarElVotoDq(boton, orden, { cerrar = null } = {}) {
  const id = idDeEdicion(vistaDatoQuincena.detalle?.id);
  if (vistaDatoQuincena.guardandoVoto === true || id === null) return undefined;
  const pedido = vistaDatoQuincena.pedido;
  const sigue = () => pedido === vistaDatoQuincena.pedido && vistaDatoQuincena.detalle?.id === id;
  return conBotonBloqueadoDq(boton, async () => {
    vistaDatoQuincena.guardandoVoto = true;
    try {
      let respuesta;
      try {
        respuesta = await API.pedirJson('PUT', `/dato-quincena/ediciones/${String(id)}/voto`, { orden });
      } catch (error) {
        if (error?.status === 401) {
          irAlLoginDesdeDatoQuincena();
          return;
        }
        const mensaje = mensajeDelErrorDq(error, TEXTOS_DEL_VOTO.error);
        if (vistaDatoQuincena.voto !== null) anunciarDatoQuincena(mensaje, 'dq-voto-anuncio');
        const yaNoSeVota = YA_NO_SE_VOTA.includes(error?.status);
        // Primero se cierra: así la región de la página ya no está silenciada cuando el aviso la escribe
        if (yaNoSeVota && typeof cerrar === 'function') cerrar();
        avisarErrorDatoQuincena(mensaje);
        if (yaNoSeVota && sigue()) await redibujarElDetalleDq(id, { sigue, foco: FOCO_DESPUES_DE_VOTAR });
        return;
      }
      if (typeof cerrar === 'function') cerrar();
      if (sigue()) await redibujarElDetalleDq(id, { sigue, foco: FOCO_DESPUES_DE_VOTAR });
      avisarDq(respuesta?.message, respuesta?.data?.cambio === false ? 'info' : 'success');
    } finally {
      vistaDatoQuincena.guardandoVoto = false;
    }
  });
}

/**
 * Vuelve a pedir la edición `id` y la dibuja en el lugar, en la pestaña y la propuesta que se ven en ese momento, sin «Cargando…» (la
 * página no salta): la infografía es la misma imagen (no se vuelve a pedir) y la caja del correo, la que ya estaba (si no había
 * llegado, se vuelve a pedir). El foco va a `foco` dentro del panel que se ve; si no está, a su pestaña. Si mientras tanto la página
 * mostró otra cosa (`sigue`), no dibuja nada; si la edición no llega, la carga entera, con sus errores.
 */
async function redibujarElDetalleDq(id, { sigue, foco = null }) {
  let detalle = null;
  try {
    detalle = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}`))?.data ?? null;
  } catch (error) {
    if (!sigue()) return;
    if (error?.status === 401) {
      irAlLoginDesdeDatoQuincena();
      return;
    }
    console.error('Error volviendo a cargar la edición:', error);
  }
  if (!sigue()) return;
  if (!esLaEdicionDq(detalle, id)) {
    const { vista, propuesta } = vistaDatoQuincena;
    await cargarDetalleDq(id, { vista, propuesta });
    return;
  }
  await dibujarLaEdicionDeNuevoDq(id, detalle, { foco });
}

// Si lo que llegó es la edición `id`
const esLaEdicionDq = (detalle, id) => detalle !== null && typeof detalle === 'object' && idDeEdicion(detalle.id) === id;

// Dibuja `detalle`, la edición `id` recién pedida, en el lugar (como redibujarElDetalleDq, sin volver a pedirla), con el foco en `foco`
// dentro del panel que se ve o, si no está, en su pestaña
async function dibujarLaEdicionDeNuevoDq(id, detalle, { foco = null } = {}) {
  const { vista, propuesta, admin, caja } = vistaDatoQuincena;
  const contenido = elementoDq('dq-contenido');
  const imagen = contenido.querySelector('img.dq-infografia');
  vistaDatoQuincena.detalle = detalle;
  dibujarDatoQuincena(htmlDelDetalle(detalle, { admin, vista, propuesta }));
  const lugar = contenido.querySelector('[data-infografia]');
  if (lugar && imagen) {
    const copia = imagen.cloneNode();
    copia.alt = lugar.dataset.alt ?? '';
    lugar.replaceWith(copia);
  } else if (lugar) {
    ponerImagenDq(lugar, lugar.dataset.infografia, 'dq-infografia', lugar.dataset.alt ?? '');
  }
  if (vista === 'propuestas') correrLaFilaHastaDq(renglonElegidoDq(), { suave: false });
  const destino = (foco ? contenido.querySelector(`#dq-panel-${vista} ${foco}`) : null) ?? contenido.querySelector(`#dq-tab-${vista}`);
  destino?.focus?.();
  if (!admin) return;
  const lugarDeLaCaja = elementoDq('dq-envio-lugar');
  if (caja !== null && lugarDeLaCaja) lugarDeLaCaja.innerHTML = htmlDeLaCajaDelCorreo(caja);
  else await cargarCajaDelCorreoDq(id);
}

// ---- El diálogo «Tu orden» (cualquier rol en la lista de esa edición) ----

const cuantasPropuestasDq = () => listaDe(vistaDatoQuincena.detalle?.propuestas).length;

// «Guardar mi orden», habilitado solo con todas las propuestas tocadas y mientras no se guarda
function actualizarGuardarElVotoDq() {
  const guardar = elementoDq('dq-voto-guardar');
  const voto = vistaDatoQuincena.voto;
  if (guardar) guardar.disabled = vistaDatoQuincena.guardandoVoto === true || voto === null || voto.tocadas.length !== cuantasPropuestasDq();
}

// Dibuja el cuerpo del diálogo con lo tocado y actualiza «Guardar mi orden». Con `anunciar`, lo que falta va a la región viva del diálogo
// (el texto que se ve se vuelve a dibujar en cada toque, y uno recién puesto no se anuncia); con `foco`, el foco va a ese botón del cuerpo
function dibujarElVotoDq({ foco = null, anunciar = false } = {}) {
  const voto = vistaDatoQuincena.voto;
  const cuerpo = elementoDq('dq-voto-cuerpo');
  if (voto === null || !cuerpo) return;
  cuerpo.innerHTML = htmlDelDialogoDelVoto(vistaDatoQuincena.detalle, voto.tocadas);
  actualizarGuardarElVotoDq();
  if (anunciar) anunciarDatoQuincena(textoDeLoQueFaltaTocar(cuantasPropuestasDq(), voto.tocadas.length), 'dq-voto-anuncio');
  if (foco) cuerpo.querySelector?.(foco)?.focus?.();
}

// El aviso a la última persona en votar (votacion.aviso_de_cierre): con textContent, oculto si no viene
function ponerElAvisoDeCierreDq(modal, texto) {
  const aviso = elementoDq('dq-voto-aviso');
  const dialogo = modal.querySelector?.('[role="dialog"]');
  if (aviso) {
    aviso.textContent = texto;
    aviso.hidden = texto === '';
  }
  // El aviso se lee con el diálogo (aria-describedby) solo mientras se muestra; no es una región viva
  if (dialogo) dialogo.setAttribute('aria-describedby', texto === '' || !aviso ? 'dq-voto-texto' : 'dq-voto-texto dq-voto-aviso');
}

/**
 * «Votar» y «Cambiar mi orden»: primero vuelven a pedir la edición, porque la votación pudo cambiar desde que se dibujó (otra persona
 * votó, cerró o quien mira votó en otra pestaña), y abren «Tu orden» con la votación recién llegada (mostrarElVotoDq). Mientras espera,
 * el botón queda deshabilitado (un doble clic manda un solo pedido) y no se abre «Reenviar…» ni otro «Tu orden». Si ya no se puede
 * votar, la edición se vuelve a dibujar con lo que llegó y no abre; si el pedido falla, el error y no abre (un 401, al login); si
 * mientras tanto la página mostró otra cosa u otro diálogo se abrió, nada. Solo con la votación abierta y puede_votar (el true literal)
 * en lo que se ve; mientras se guarda un orden, mientras espera otra apertura o con el diálogo ya abierto, no hace nada.
 */
async function abrirElVotoDq(boton) {
  const id = idDeEdicion(vistaDatoQuincena.detalle?.id);
  const votacion = votacionDe(vistaDatoQuincena.detalle);
  if (votoOcupadoDq() || vistaDatoQuincena.voto !== null || id === null || !elementoDq('dq-voto')
    || votacion?.estado !== 'abierta' || votacion.puede_votar !== true) return;
  const pedido = vistaDatoQuincena.pedido;
  const sigue = () => pedido === vistaDatoQuincena.pedido && vistaDatoQuincena.detalle?.id === id;
  let detalle = null;
  vistaDatoQuincena.abriendoVoto = true;
  try {
    await conBotonBloqueadoDq(boton, async () => {
      detalle = await edicionParaVotarDq(id, sigue);
    });
  } finally {
    vistaDatoQuincena.abriendoVoto = false;
  }
  const otroDialogo = vistaDatoQuincena.voto !== null || vistaDatoQuincena.reenvio !== null || vistaDatoQuincena.modal !== null;
  if (detalle !== null && sigue() && !otroDialogo) mostrarElVotoDq(boton, detalle);
}

// La edición `id` recién pedida, si todavía se puede votar; si no, la dibuja en el lugar (sin «Votar»: el foco va a su pestaña) y da
// null. Si el pedido falla, avisa el error del servidor o TEXTOS_DEL_VOTO.error y da null (un 401, al login); si mientras tanto la
// página mostró otra cosa (`sigue`), null sin avisar
async function edicionParaVotarDq(id, sigue) {
  let detalle;
  try {
    detalle = (await API.pedirJson('GET', `/dato-quincena/ediciones/${String(id)}`))?.data;
  } catch (error) {
    if (!sigue()) return null;
    if (error?.status === 401) irAlLoginDesdeDatoQuincena();
    else avisarErrorDatoQuincena(mensajeDelErrorDq(error, TEXTOS_DEL_VOTO.error));
    return null;
  }
  if (!sigue()) return null;
  if (!esLaEdicionDq(detalle, id)) {
    avisarErrorDatoQuincena(TEXTOS_DEL_VOTO.error);
    return null;
  }
  const votacion = votacionDe(detalle);
  if (votacion?.estado === 'abierta' && votacion.puede_votar === true) return detalle;
  await dibujarLaEdicionDeNuevoDq(id, detalle, { foco: FOCO_DESPUES_DE_VOTAR });
  return null;
}

/**
 * Abre «Tu orden» con la votación de `detalle` (la recién pedida): su texto (votacion.dialogo), el aviso a la última persona en votar y,
 * sin voto, ninguna tocada; con voto, su orden. Las propuestas son las de la edición que se ve, que no cambian. El foco, en la primera
 * propuesta (después de la transición del velo); al cerrar, vuelve a `boton`.
 */
function mostrarElVotoDq(boton, detalle) {
  const votacion = votacionDe(detalle);
  const modal = elementoDq('dq-voto');
  if (!modal) return;
  const texto = elementoDq('dq-voto-texto');
  if (texto) texto.textContent = conTextoDq(votacion.dialogo) ? votacion.dialogo : '';
  ponerElAvisoDeCierreDq(modal, conTextoDq(votacion.aviso_de_cierre) ? votacion.aviso_de_cierre : '');
  const anuncio = elementoDq('dq-voto-anuncio');
  if (anuncio) anuncio.textContent = '';
  const abierto = { volverA: boton, tocadas: tocadasAlAbrir(detalle) };
  vistaDatoQuincena.voto = abierto;
  dibujarElVotoDq();
  modal.classList.add('active');
  setTimeout(() => {
    if (vistaDatoQuincena.voto === abierto) elementoDq('dq-voto-cuerpo')?.querySelector?.('button[data-tocar]')?.focus?.();
  }, 100);
}

// Cierra el diálogo; el foco vuelve al botón que lo abrió (después de guardar, o de un 403 o un 409, no: la edición se vuelve a
// dibujar y el foco va a «Cambiar mi orden» o, si ya no se vota, a la pestaña)
function cerrarElVotoDq({ devolverFoco = true } = {}) {
  const abierto = vistaDatoQuincena.voto;
  if (!abierto) return;
  vistaDatoQuincena.voto = null;
  elementoDq('dq-voto')?.classList.remove('active');
  if (devolverFoco && abierto.volverA?.isConnected !== false) abierto.volverA?.focus?.();
}

// Tocar una propuesta: sin puesto, toma el siguiente; con puesto, se lo saca y las de atrás suben. El foco sigue en ella. Una que la
// edición no tiene, o mientras se guarda, nada
function tocarEnElVotoDq(boton) {
  const voto = vistaDatoQuincena.voto;
  const orden = Number(boton.dataset?.tocar);
  if (voto === null || vistaDatoQuincena.guardandoVoto === true || posicionDelOrdenDq(vistaDatoQuincena.detalle, orden) === -1) return;
  voto.tocadas = tocadasDespuesDeTocar(voto.tocadas, orden);
  dibujarElVotoDq({ foco: `button[data-tocar="${String(orden)}"]`, anunciar: true });
}

// «Empezar de nuevo» saca todos los puestos; el foco, en la primera propuesta
function empezarElVotoDeNuevoDq() {
  const voto = vistaDatoQuincena.voto;
  if (voto === null || vistaDatoQuincena.guardandoVoto === true) return;
  voto.tocadas = [];
  dibujarElVotoDq({ foco: 'button[data-tocar]', anunciar: true });
}

// «Guardar mi orden»: lo tocado, con todas. Si sale bien, o si ya no se puede votar (403 o 409), el diálogo cierra; si no, queda
// abierto con el aviso del error. El foco no vuelve al botón que lo abrió: la edición se vuelve a dibujar y el foco va a su reemplazo
// o a la pestaña
function confirmarElVotoDq(boton) {
  const abierto = vistaDatoQuincena.voto;
  if (!abierto || abierto.tocadas.length !== cuantasPropuestasDq()) return undefined;
  return guardarElVotoDq(boton, [...abierto.tocadas], {
    cerrar: () => {
      if (vistaDatoQuincena.voto === abierto) cerrarElVotoDq({ devolverFoco: false });
    }
  });
}

// Cierran la ×, «Cancelar» (data-cerrar), Escape y el clic en el velo (si empezó en el velo); Tab no sale del diálogo; los toques y
// «Empezar de nuevo», delegados en el diálogo (el cuerpo se vuelve a dibujar)
function conectarElVotoDq() {
  const modal = elementoDq('dq-voto');
  if (!modal) return;
  let desdeElVelo = false;
  modal.addEventListener('mousedown', (evento) => {
    desdeElVelo = evento.target === modal;
  });
  modal.addEventListener('click', (evento) => {
    const objetivo = evento.target;
    const cerrar = Boolean(objetivo?.closest?.('[data-cerrar]')) || (objetivo === modal && desdeElVelo);
    desdeElVelo = false;
    let boton;
    if (cerrar) cerrarElVotoDq();
    else if ((boton = objetivo?.closest?.('button[data-tocar]'))) tocarEnElVotoDq(boton);
    else if (objetivo?.closest?.('button[data-de-nuevo]')) empezarElVotoDeNuevoDq();
  });
  document.addEventListener('keydown', (evento) => {
    if (!vistaDatoQuincena.voto) return;
    if (evento.key === 'Escape') {
      evento.preventDefault?.();
      cerrarElVotoDq();
    } else if (evento.key === 'Tab') retenerFocoDq(evento, modal);
  });
  elementoDq('dq-voto-guardar')?.addEventListener('click', (evento) => confirmarElVotoDq(evento.currentTarget));
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
// ?id=N, el detalle (un id que no es un entero positivo, «No existe esa edición.» sin pedirlo). Todos tienen el diálogo «Tu orden» (votar
// depende de estar en la lista de la edición, no del rol). La administración tiene además las pestañas (#correo abre la de «Envío y
// votación», también junto a ?id o ?anio), la caja del correo del detalle y el diálogo de «Reenviar»; los demás roles no piden nada de
// eso (un #correo, lo ignoran)
function iniciarDatoQuincena() {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return undefined;
  }
  const contenido = elementoDq('dq-contenido');
  contenido.addEventListener('click', alTocarDq);
  contenido.addEventListener('keydown', alTeclearDq);
  conectarModalDq();
  conectarElVotoDq();
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
