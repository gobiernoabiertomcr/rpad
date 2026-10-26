/**
 * Proyectos - RPAD (spec 2026-10-25-proyectos, 1, 2 y 10)
 * La página que reemplaza a Gestión: los proyectos de la Dirección de Datos Públicos y Comunicación, con sus hitos y documentos, y
 * los logros del área, en tres pestañas (Proyectos, Línea de tiempo y Logros del área) y el detalle de cada proyecto (?id=N).
 * La pestaña Proyectos dibuja un carril por proyecto sobre una ventana de 3 años que se corre con flechas: cada hito es un punto en
 * su fecha (los que se pisan, a menos de 15 px, se juntan en uno con la cantidad), los que quedan fuera de la ventana se cuentan en
 * el borde y «Resaltar un año» pinta la columna de ese año y dice cuántos hitos salen en su Informe anual. Los filtros (el buscador,
 * el estado y la categoría), la ventana y el año resaltado viajan en la dirección
 * (?estado=en_curso&categoria=difusion&busqueda=indice&anios=2025&resaltar=2025#proyectos; `anios` es el último año de la ventana).
 * El detalle (spec 3) muestra la ficha, la cinta del recorrido (un SVG como la del Seguimiento: los hitos y la fecha de elevación sobre
 * los años del proyecto, con las etiquetas en hasta 3 filas sin pisarse), los hitos como filas que se despliegan y los documentos; la
 * Línea de tiempo (spec 4) agrupa los hitos por año y Logros del área (spec 5) lista los hitos sin proyecto. Los botones de los
 * archivos (Ver, Descargar y, para administración, Eliminar) y de los hitos solo llevan data-*: los usa la parte del DOM.
 * Los formularios (spec 6 y 9): lo que precarga cada uno (valoresDelProyecto, valoresDelHito), sus errores (erroresDelProyecto y
 * erroresDelHito, los mismos que validarProyecto y validarHito del servidor, con copias de sus mensajes y sus largos atadas por tests
 * de paridad), el color (la paleta de 10, con «Color actual» si el del proyecto no está), el ícono, las áreas y la muestra; los
 * archivos que se eligen (problemaDeArchivo: la extensión, los 10 MB y la cantidad de config/upload.js, y los repetidos) y su lista;
 * la vista previa y los textos de las confirmaciones. Los modales están en proyectos.html.
 * Los datos son los de GET /api/gestion/proyectos, GET /api/gestion/proyectos/:id y GET /api/gestion/timeline (los hitos de los
 * proyectos activos y los logros del área, que son los hitos sin proyecto): las fechas llegan como texto 'AAAA-MM-DD' (también el
 * `subido_el` de los archivos) y se leen como texto (nunca con new Date ni
 * toISOString); los días se cuentan con Date.UTC sobre sus partes. «Hoy» es Utils.hoyEnArgentina(), que recibe por parámetro todo
 * lo puro. Todo texto del servidor pasa por Utils.escapeHtml (también en los title), un color solo llega a un style si es #RRGGBB y
 * un número se escribe con String (Utils.escapeHtml(0) da '').
 * Al cargarse el archivo solo declara: lo que arma HTML es puro y recibe quién mira por parámetro (tests/proyectos-frontend.test.js
 * lo carga en un vm, después del main.js de verdad —getIconSvg e ICON_SELECTOR_MAP— y del api.js de verdad —Utils—, como la página);
 * lo que toca el DOM o la API va aparte, al final (iniciarProyectos, enganchado a DOMContentLoaded): las cargas (API.pedirJson), las
 * pestañas, los filtros con la dirección (history.replaceState), el ancho de la pista (ResizeObserver), las filas, los modales, los
 * guardados (el botón deshabilitado hasta la respuesta), las subidas (fetch + FormData, sin Content-Type), las descargas y la vista
 * previa (API.pedirArchivo) y las confirmaciones. Los eventos van delegados en contenedores fijos: volver a dibujar no engancha nada, y
 * el foco vuelve al control que se usó. Lo que cambia se anuncia en #pr-anuncio, la región viva que no se vuelve a dibujar.
 */

// =====================================================
// Constantes
// =====================================================

// Los estados, las categorías y las prioridades de un proyecto (las listas de services/proyectosReglas.js), con sus textos
const TEXTO_ESTADO = Object.freeze({ en_curso: 'En curso', idea: 'Idea', completado: 'Completado', suspendido: 'Suspendido' });
const TEXTO_ESTADO_PLURAL = Object.freeze({ en_curso: 'En curso', idea: 'Ideas', completado: 'Completados', suspendido: 'Suspendidos' });
// El orden de los carriles y de los chips del estado (spec 2.1)
const ORDEN_ESTADOS = Object.freeze(['en_curso', 'idea', 'completado', 'suspendido']);
const CLASE_DEL_ESTADO = Object.freeze({ en_curso: 'pr-en-curso', idea: 'pr-idea', completado: 'pr-completado', suspendido: 'pr-suspendido' });
const TEXTO_CATEGORIA = Object.freeze({ tecnologia: 'Tecnología', normativa: 'Normativa', difusion: 'Difusión' });
const TEXTO_PRIORIDAD = Object.freeze({ alta: 'Alta', media: 'Media', baja: 'Baja' });

// La ventana de los carriles: siempre 3 años (spec 2.2, decisión del usuario)
const ANIOS_VENTANA = 3;
// Dos puntos de un carril a menos de su diámetro (15 px) se juntan en uno (spec 2.1)
const DIAMETRO_DEL_PUNTO = 15;
// El ancho de una pista en la computadora, mientras la página no midió la de verdad
const ANCHO_DE_PISTA_POR_DEFECTO = 600;
// El color de un proyecto que no tiene uno válido (una edición puede dejarlo vacío): el azul tinta, el primero de la paleta
const COLOR_POR_DEFECTO = '#1A365D';

// La cinta del recorrido de un proyecto (spec 3): un espacio de 1000 de ancho con la línea útil de x = 30 a x = 970, como la cinta
// del Seguimiento. Las etiquetas (el título, cortado a 34 caracteres con «…», y la fecha debajo) van en hasta 3 filas sin pisarse,
// con 10 de aire, y se miden con 6,3 unidades por letra (10 letras como mínimo: el ancho de «dd/mm/aaaa»); una que pasaría de 990
// va a la izquierda de su marca
const CINTA = Object.freeze({
  inicio: 30, fin: 970, alto: 186, eje: 126, filasY: Object.freeze([94, 61, 28]),
  largoEtiqueta: 34, anchoPorLetra: 6.3, letrasMinimas: 10, aire: 10, bordeIzquierdo: 10, bordeDerecho: 990,
  // Los números de los años, a 36 unidades como mínimo: con más años, una marca por año y el número cada tantos
  separacionDeAnios: 36
});
const TEXTO_SIN_CINTA = 'Sin hitos ni fecha de elevación: la cinta se dibuja cuando haya alguno.';

const ICONO_BUSCAR = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const ICONO_ABRIR = '<svg aria-hidden="true" focusable="false" class="abrir" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const ICONO_MAS = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
const ICONO_SUBIR = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>';
const ICONO_EXTERNO = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
const FLECHA_IZQUIERDA = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
const FLECHA_DERECHA = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

// =====================================================
// Ayudantes
// =====================================================

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const comoLista = (valor) => (Array.isArray(valor) ? valor : []);
const tieneClave = (mapa, clave) => typeof clave === 'string' && Object.hasOwn(mapa, clave);
// Un texto escapado para el HTML (un número también: Utils.escapeHtml(0) daría '')
const esc = (valor) => Utils.escapeHtml(valor === null || valor === undefined ? '' : String(valor));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// Para buscar: sin tildes, en minúsculas y sin los espacios de los extremos (como textoParaBuscar de seguimiento.js)
const textoParaBuscar = (texto) => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Un año escrito con cuatro dígitos, de 1000 a 9999, o null
const anioValido = (texto) => {
  const anio = /^\d{4}$/.test(String(texto ?? '')) ? Number(texto) : null;
  return anio !== null && anio >= 1000 ? anio : null;
};
// El año de una fecha 'AAAA-MM-DD' (número), o null si no es una fecha que existe
const anioDeLaFecha = (fecha) => {
  const valida = Utils.soloFecha(fecha);
  return valida ? Number(valida.slice(0, 4)) : null;
};
// El año de hoy; si `hoy` no sirve, el de hoy en Argentina
const anioDeHoy = (hoy) => anioDeLaFecha(hoy) ?? Number(Utils.hoyEnArgentina().slice(0, 4));
// El día de una fecha 'AAAA-MM-DD', contado desde el 1/1/1970 (sobre sus partes, sin la zona horaria)
const diaDe = (fecha) => Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10))) / 86400000;
// Una posición en % de la pista, con tres decimales
const redondear = (valor) => Math.round(valor * 1000) / 1000;
// Dónde cae `fecha` en la pista de `desde` a `hasta` (del 1/1 de uno al 31/12 del otro), en %
const posicionEnLaPista = (fecha, desde, hasta) => {
  const inicio = diaDe(`${desde}-01-01`);
  return redondear(((diaDe(fecha) - inicio) / (diaDe(`${hasta + 1}-01-01`) - inicio)) * 100);
};
// Los hitos con una fecha que existe (la fecha recortada a 'AAAA-MM-DD'), por fecha y después por id
const hitosConFecha = (hitos) => comoLista(hitos)
  .filter(esObjeto)
  .map((hito) => ({ hito, fecha: Utils.soloFecha(hito.fecha) }))
  .filter(({ fecha }) => fecha !== null)
  .sort((a, b) => a.fecha.localeCompare(b.fecha) || (Number(a.hito.id) || 0) - (Number(b.hito.id) || 0));
const esLogro = (hito) => hito.proyecto_id === null || hito.proyecto_id === undefined;

// El color de un proyecto, solo si es #RRGGBB (lo único que llega a un style)
const colorDelProyecto = (proyecto) => (typeof proyecto?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(proyecto.color) ? proyecto.color : COLOR_POR_DEFECTO);

// El ícono de un proyecto (los de ICON_SELECTOR_MAP de main.js; uno que no está, el de siempre), decorativo
const iconoSvg = (nombre, tamano = 20) => {
  const clave = tieneClave(ICON_SELECTOR_MAP, nombre) ? nombre : 'clipboard-list';
  return String(getIconSvg(clave, tamano) ?? '').replace('<svg', '<svg aria-hidden="true" focusable="false"');
};

// La insignia del estado, con su cuadradito (el estado nunca va solo por color)
const htmlDeInsignia = (estado) => (tieneClave(TEXTO_ESTADO, estado)
  ? `<span class="pr-insignia ${CLASE_DEL_ESTADO[estado]}">${esc(TEXTO_ESTADO[estado])}</span>`
  : `<span class="pr-insignia">${esc(estado)}</span>`);
const textoDeCategoria = (categoria) => (tieneClave(TEXTO_CATEGORIA, categoria) ? TEXTO_CATEGORIA[categoria] : String(categoria ?? ''));

// El cuadrado del proyecto: su color y su ícono
const htmlDelCuadrado = (proyecto, clase = '') => `<span class="pr-tile${clase ? ` ${clase}` : ''}" style="--c:${colorDelProyecto(proyecto)}">${iconoSvg(proyecto?.icono)}</span>`;

// =====================================================
// La dirección (spec 2.4)
// =====================================================

const ESTADO_DE_ENTRADA = Object.freeze({ busqueda: '', estado: 'todos', categoria: 'todas', resaltar: null });

// Lo elegido en la lista a partir de la dirección (`search`: location.search, con o sin el «?»; un fragmento se ignora). Lo que no
// sirve cae al de entrada: sin búsqueda, todos los estados y las categorías, la ventana que termina en el año de hoy y sin resaltar.
// `anios` es un número (el último año de la ventana); `resaltar`, el año como texto, solo si está en esa ventana
function estadoDeLaUrl(search, hoy) {
  const texto = typeof search === 'string' ? search : '';
  const corte = texto.indexOf('#');
  const parametros = new URLSearchParams((corte === -1 ? texto : texto.slice(0, corte)).replace(/^\?/, ''));
  const estado = parametros.get('estado');
  const categoria = parametros.get('categoria');
  const anios = anioValido(parametros.get('anios')) ?? anioDeHoy(hoy);
  const resaltar = anioValido(parametros.get('resaltar'));
  return {
    busqueda: parametros.get('busqueda') ?? ESTADO_DE_ENTRADA.busqueda,
    estado: ORDEN_ESTADOS.includes(estado) ? estado : ESTADO_DE_ENTRADA.estado,
    categoria: tieneClave(TEXTO_CATEGORIA, categoria) ? categoria : ESTADO_DE_ENTRADA.categoria,
    anios,
    resaltar: resaltar !== null && resaltar <= anios && resaltar > anios - ANIOS_VENTANA ? String(resaltar) : ESTADO_DE_ENTRADA.resaltar
  };
}

// La dirección de `estado` (lo que va después del nombre de la página): solo lo que no es de entrada, en el orden estado, categoria,
// busqueda, anios y resaltar; '' si todo es de entrada. Los valores van codificados (URLSearchParams)
function urlDeEstado(estado, hoy) {
  const e = esObjeto(estado) ? estado : {};
  const pares = [];
  if (ORDEN_ESTADOS.includes(e.estado)) pares.push(['estado', e.estado]);
  if (tieneClave(TEXTO_CATEGORIA, e.categoria)) pares.push(['categoria', e.categoria]);
  if (typeof e.busqueda === 'string' && e.busqueda.trim() !== '') pares.push(['busqueda', e.busqueda]);
  const anios = anioValido(e.anios);
  if (anios !== null && anios !== anioDeHoy(hoy)) pares.push(['anios', String(anios)]);
  const resaltar = anioValido(e.resaltar);
  if (resaltar !== null) pares.push(['resaltar', String(resaltar)]);
  return pares.length ? `?${new URLSearchParams(pares).toString()}` : '';
}

// La dirección del detalle de un proyecto desde la lista: los filtros de la lista y el id (así «Ver todos los proyectos» y Atrás
// la dejan como estaba). Sin filtros, `?id=7`
const urlDelProyecto = (id, estado, hoy) => {
  const lista = urlDeEstado(estado, hoy);
  return `${lista}${lista ? '&' : '?'}id=${encodeURIComponent(String(id ?? ''))}`;
};

// El estado con la ventana dentro de los años con hitos (`extremos`, de extremosDeAnios) y sin el año resaltado si quedó afuera
// (spec 2.2: al correr la ventana, el resaltado que queda afuera vuelve a «Ninguno»)
function estadoConVentana(estado, extremos) {
  const ventana = ventanaDe(Number(estado?.anios), extremos);
  const resaltar = anioValido(estado?.resaltar);
  return {
    ...estado,
    anios: ventana.hasta,
    resaltar: resaltar !== null && resaltar >= ventana.desde && resaltar <= ventana.hasta ? String(resaltar) : null
  };
}

// «Ver todos los proyectos» (spec 2.5): limpia los filtros (la búsqueda, el estado y la categoría); la ventana y el resaltado quedan
function sinFiltros(estado) {
  return { ...estado, busqueda: ESTADO_DE_ENTRADA.busqueda, estado: ESTADO_DE_ENTRADA.estado, categoria: ESTADO_DE_ENTRADA.categoria };
}

// El año resaltado de la dirección, tal como viene (el año como texto, o null), sin mirar la ventana: estadoDeLaUrl lo deja afuera si
// no cae en la ventana que termina en `anios`, pero esa ventana puede no ser la que se ve (la de entrada se corrige con los hitos)
function resaltarDeLaUrl(search) {
  const texto = typeof search === 'string' ? search : '';
  const corte = texto.indexOf('#');
  const anio = anioValido(new URLSearchParams((corte === -1 ? texto : texto.slice(0, corte)).replace(/^\?/, '')).get('resaltar'));
  return anio === null ? null : String(anio);
}

// Lo elegido en la lista al abrir la página: lo de la dirección, con la ventana corregida a los años con hitos (`extremos`) y el año
// resaltado si cae en esa ventana. Con `?resaltar=2027` y la ventana de entrada corregida a 2025-2027, el 2027 queda resaltado
function estadoDeLaLista(search, hoy, extremos) {
  return estadoConVentana({ ...estadoDeLaUrl(search, hoy), resaltar: resaltarDeLaUrl(search) }, extremos);
}

// Lo elegido en la lista, leído en el detalle (sin los años con hitos, que el detalle no pide): el año resaltado viaja tal cual, así
// «Ver todos los proyectos» vuelve con él y la lista lo corrige
function estadoDelDetalle(search, hoy) {
  return { ...estadoDeLaUrl(search, hoy), resaltar: resaltarDeLaUrl(search) };
}

// El estado con la ventana de entrada escrita como la de entrada (el año de hoy). Si la ventana que termina hoy no se puede (los hitos
// obligan a otra: estadoConVentana), la de entrada es la corregida, y la dirección no la escribe: nadie la eligió
function conAniosDeEntrada(estado, extremos, hoy) {
  const deEntrada = estadoConVentana(estadoDeLaUrl('', hoy), extremos).anios;
  return esObjeto(estado) && Number(estado.anios) === deEntrada ? { ...estado, anios: anioDeHoy(hoy) } : { ...estado };
}

// La dirección de la lista (la de urlDeEstado), con la ventana de entrada sin escribir aunque la hayan corregido los hitos
function urlDeLaLista(estado, extremos, hoy) {
  return urlDeEstado(conAniosDeEntrada(estado, extremos, hoy), hoy);
}

// Las pestañas de la lista (spec 1), en su orden: el fragmento de la dirección. Otro fragmento (#metricas, el link viejo) es Proyectos
const PESTANAS = Object.freeze(['proyectos', 'linea', 'logros']);
function pestanaDeHash(hash) {
  const nombre = String(hash ?? '').replace(/^#/, '');
  return PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
}

// =====================================================
// La ventana de 3 años (spec 2.2)
// =====================================================

// El año más viejo con algún hito o fecha de elevación, y el más nuevo entre el de hoy y el del último hito. Sin fechas, el de hoy
function extremosDeAnios(proyectos, hitos, hoy) {
  const deHoy = anioDeHoy(hoy);
  const elevaciones = comoLista(proyectos).filter(esObjeto).map((p) => anioDeLaFecha(p.fecha_inicio)).filter((a) => a !== null);
  const deLosHitos = hitosConFecha(hitos).map(({ fecha }) => Number(fecha.slice(0, 4)));
  const max = Math.max(deHoy, ...deLosHitos);
  const min = Math.min(max, ...elevaciones, ...deLosHitos);
  return { min, max };
}

// La ventana que termina en `fin`: el final queda entre el primero posible (el más viejo en la primera ventana, sin pasarse del
// último) y el último. `anterior` y `siguiente` dicen si hay años hacia cada lado (si no, esa flecha queda deshabilitada)
function ventanaDe(fin, extremos) {
  const max = Number(extremos?.max);
  const min = Number(extremos?.min);
  const ultimo = Number.isFinite(max) ? max : anioDeHoy(null);
  const primero = Math.min(Number.isFinite(min) ? min + ANIOS_VENTANA - 1 : ultimo, ultimo);
  const hasta = Number.isFinite(fin) ? Math.min(Math.max(Math.trunc(fin), primero), ultimo) : ultimo;
  return { desde: hasta - ANIOS_VENTANA + 1, hasta, anterior: hasta > primero, siguiente: hasta < ultimo };
}

// El año resaltado de `estado`, solo si está en `ventana` (texto), o null
const anioResaltado = (estado, ventana) => {
  const anio = anioValido(estado?.resaltar);
  return anio !== null && anio >= ventana.desde && anio <= ventana.hasta ? String(anio) : null;
};

// =====================================================
// Los filtros y el orden (spec 2 y 2.1)
// =====================================================

// ¿`proyecto` pasa los filtros de `estado`? `sin` deja afuera uno de los grupos ('estado' o 'categoria'), para contar ese grupo
const pasaLosFiltros = (proyecto, estado, sin = null) => {
  const buscado = textoParaBuscar(estado?.busqueda);
  if (buscado && ![proyecto.nombre, proyecto.descripcion, proyecto.responsable].some((texto) => textoParaBuscar(texto).includes(buscado))) return false;
  if (sin !== 'estado' && ORDEN_ESTADOS.includes(estado?.estado) && proyecto.estado !== estado.estado) return false;
  if (sin !== 'categoria' && tieneClave(TEXTO_CATEGORIA, estado?.categoria) && proyecto.categoria !== estado.categoria) return false;
  return true;
};

// Los proyectos que dejan los filtros: el buscador (sin tildes ni mayúsculas, en el nombre, la descripción y el responsable), el
// estado y la categoría. En el orden en que llegan
function filtrarProyectos(proyectos, estado) {
  return comoLista(proyectos).filter(esObjeto).filter((proyecto) => pasaLosFiltros(proyecto, estado));
}

// Los hitos de cada año, todos (sin los filtros de la lista: el Informe anual no tiene filtros): { '2025': 7, … }
const hitosPorAnio = (hitos) => {
  const cantidades = {};
  for (const { fecha } of hitosConFecha(hitos)) cantidades[fecha.slice(0, 4)] = (cantidades[fecha.slice(0, 4)] ?? 0) + 1;
  return cantidades;
};

// Las cantidades de los chips: cada grupo cuenta lo que dejan los otros filtros (como en Datasets). `sinFiltros`, lo mismo sin
// ningún filtro (un chip aparece si hay algún proyecto en él o si está elegido), y `anio`, los hitos de cada año (de `hitos`)
function cantidadesDeFiltros(proyectos, estado, hitos = []) {
  const lista = comoLista(proyectos).filter(esObjeto);
  const contar = (sin, conFiltros) => {
    const quedan = conFiltros ? lista.filter((p) => pasaLosFiltros(p, estado, sin)) : lista;
    return sin === 'estado'
      ? Object.fromEntries([['todos', quedan.length], ...ORDEN_ESTADOS.map((e) => [e, quedan.filter((p) => p.estado === e).length])])
      : Object.fromEntries([['todas', quedan.length], ...Object.keys(TEXTO_CATEGORIA).map((c) => [c, quedan.filter((p) => p.categoria === c).length])]);
  };
  return {
    estado: contar('estado', true),
    categoria: contar('categoria', true),
    sinFiltros: { estado: contar('estado', false), categoria: contar('categoria', false) },
    anio: hitosPorAnio(hitos)
  };
}

// La fecha del último hito cumplido (fecha hasta hoy) de cada proyecto: Map id → 'AAAA-MM-DD'
const ultimosCumplidos = (hitos, hoy) => {
  const ultimos = new Map();
  for (const { hito, fecha } of hitosConFecha(hitos)) {
    if (!esLogro(hito) && fecha <= hoy) ultimos.set(hito.proyecto_id, fecha);
  }
  return ultimos;
};

// Los carriles en orden (spec 2.1): por estado (En curso, Idea, Completado, Suspendido; uno desconocido al final), después por el
// hito cumplido más reciente (el más nuevo primero; sin ninguno, después) y por nombre. Una lista nueva
function ordenarProyectos(proyectos, hitos, hoy) {
  const ultimos = ultimosCumplidos(hitos, typeof hoy === 'string' ? hoy : Utils.hoyEnArgentina());
  const lugar = (estado) => (ORDEN_ESTADOS.includes(estado) ? ORDEN_ESTADOS.indexOf(estado) : ORDEN_ESTADOS.length);
  return comoLista(proyectos).filter(esObjeto).slice().sort((a, b) => lugar(a.estado) - lugar(b.estado)
    || (ultimos.get(b.id) ?? '').localeCompare(ultimos.get(a.id) ?? '')
    || String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es'));
}

// =====================================================
// Los puntos de un carril (spec 2.1 y 2.2)
// =====================================================

// Los hitos de un carril en la pista de `desde` a `hasta`, de `anchoPx` píxeles: cada punto con su posición (`x`, en % de la
// pista), cuántos hitos junta, si es previsto (solo si todos sus hitos lo son: fecha posterior a `hoy`), sus títulos («dd/mm/aaaa:
// título», para el title) y sus años; `antes` y `despues`, los hitos que quedan fuera de la ventana; `tramo`, la línea del primer
// al último hito que entran en la ventana (null con menos de dos). Los puntos a menos de 15 px del anterior (de su posición, que es
// el promedio de los que junta) se juntan: dos puntos que quedan separados están siempre a 15 px o más
function puntosDelCarril(hitos, opciones) {
  const { desde, hasta, hoy, anchoPx } = esObjeto(opciones) ? opciones : {};
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || hasta < desde) return { puntos: [], antes: 0, despues: 0, tramo: null };
  const ancho = Number.isFinite(anchoPx) && anchoPx > 0 ? anchoPx : ANCHO_DE_PISTA_POR_DEFECTO;
  const umbral = (DIAMETRO_DEL_PUNTO / ancho) * 100;
  const inicio = `${desde}-01-01`;
  const fin = `${hasta}-12-31`;
  const todos = hitosConFecha(hitos);
  const adentro = todos.filter(({ fecha }) => fecha >= inicio && fecha <= fin);
  const grupos = [];
  for (const { hito, fecha } of adentro) {
    const x = posicionEnLaPista(fecha, desde, hasta);
    const titulo = `${Utils.fechaCorta(fecha)}: ${String(hito.titulo ?? '')}`;
    const futuro = typeof hoy === 'string' && fecha > hoy;
    const ultimo = grupos.at(-1);
    if (ultimo && x - ultimo.x < umbral) {
      ultimo.xs.push(x);
      ultimo.x = redondear(ultimo.xs.reduce((suma, valor) => suma + valor, 0) / ultimo.xs.length);
      ultimo.cantidad += 1;
      ultimo.futuro = ultimo.futuro && futuro;
      ultimo.titulos.push(titulo);
      if (!ultimo.anios.includes(fecha.slice(0, 4))) ultimo.anios.push(fecha.slice(0, 4));
    } else {
      grupos.push({ x, xs: [x], cantidad: 1, futuro, titulos: [titulo], anios: [fecha.slice(0, 4)] });
    }
  }
  const primero = adentro[0];
  const ultimo = adentro.at(-1);
  return {
    puntos: grupos.map(({ xs: _xs, ...punto }) => punto),
    antes: todos.filter(({ fecha }) => fecha < inicio).length,
    despues: todos.filter(({ fecha }) => fecha > fin).length,
    tramo: adentro.length > 1 && primero.fecha < ultimo.fecha
      ? { x1: posicionEnLaPista(primero.fecha, desde, hasta), x2: posicionEnLaPista(ultimo.fecha, desde, hasta) }
      : null
  };
}

// =====================================================
// La frase del año resaltado (spec 2.3)
// =====================================================

// «En 2025: 7 hitos de 4 proyectos y 1 logro del área. Son los que salen en el Informe anual de 2025.»: todos los hitos del año
// (los de los proyectos y los logros, que son hitos sin proyecto), sin los filtros de la lista. Sin logros, la primera oración
// termina en «… de 4 proyectos.»; solo con logros, «En 2026: 2 logros del área.»; sin ninguno, «En 2020 no hay hitos.». '' si
// `anio` no es un año
function fraseDelAnio(anio, hitos) {
  const elAnio = anioValido(anio);
  if (elAnio === null) return '';
  const delAnio = hitosConFecha(hitos).filter(({ fecha }) => fecha.startsWith(`${elAnio}-`)).map(({ hito }) => hito);
  const logros = delAnio.filter(esLogro).length;
  const deProyectos = delAnio.filter((hito) => !esLogro(hito));
  const proyectos = new Set(deProyectos.map((hito) => hito.proyecto_id)).size;
  if (!delAnio.length) return `En ${elAnio} no hay hitos.`;
  const textoLogros = plural(logros, 'logro del área', 'logros del área');
  const cuenta = deProyectos.length
    ? `${plural(delAnio.length, 'hito', 'hitos')} de ${plural(proyectos, 'proyecto', 'proyectos')}${logros ? ` y ${textoLogros}` : ''}`
    : textoLogros;
  return `En ${elAnio}: ${cuenta}. Son los que salen en el Informe anual de ${elAnio}.`;
}

// =====================================================
// El HTML de los filtros
// =====================================================

const htmlDeChip = (grupo, valor, texto, pulsado, cantidad = null) =>
  `<button type="button" class="sg-chip" data-grupo="${grupo}" data-valor="${esc(valor)}" aria-pressed="${pulsado ? 'true' : 'false'}">${esc(texto)}${cantidad === null ? '' : ` <b>${String(Number(cantidad) || 0)}</b>`}</button>`;

// Las flechas de la ventana (spec 2.2): a los costados del texto «2024 a 2026», cada una con su aria-label y deshabilitada si no hay
// años hacia su lado. Si todo entra en 3 años, sin flechas: queda el texto (en el teléfono no hay fila de años)
const htmlDeFlechas = (ventana) => {
  const texto = `${ventana.desde} a ${ventana.hasta}`;
  if (!ventana.anterior && !ventana.siguiente) return `<span class="pr-flechas-texto solo">${texto}</span>`;
  const flecha = (paso, habilitada, icono) => `<button type="button" class="pr-flecha" data-correr="${paso}" aria-label="Ver ${ventana.desde + paso} a ${ventana.hasta + paso}"${habilitada ? '' : ' disabled'}>${icono}</button>`;
  return `<div class="pr-flechas" role="group" aria-label="Años que se ven">${flecha(-1, ventana.anterior, FLECHA_IZQUIERDA)}<span class="pr-flechas-texto" aria-live="polite">${texto}</span>${flecha(1, ventana.siguiente, FLECHA_DERECHA)}</div>`;
};

// Los filtros de la pestaña Proyectos (spec 2): el buscador, los chips del estado y de la categoría (con su cantidad; un chip
// aparece si hay algún proyecto en él o si está elegido), las flechas de la ventana y «Resaltar un año» («Ninguno» y los 3 años de
// la ventana, cada uno con todos sus hitos). `cantidades`, de cantidadesDeFiltros; `ventana`, de ventanaDe
function htmlDeFiltros(estado, cantidades, ventanaDada) {
  const e = esObjeto(estado) ? estado : {};
  const c = esObjeto(cantidades) ? cantidades : {};
  // Sin una ventana que sirva, la que termina en el año elegido, sin flechas
  const ventana = esObjeto(ventanaDada) && Number.isInteger(ventanaDada.desde) && Number.isInteger(ventanaDada.hasta)
    ? ventanaDada
    : ventanaDe(Number(e.anios), { min: Number(e.anios), max: Number(e.anios) });
  const cuenta = (grupo, clave) => Number(c[grupo]?.[clave]) || 0;
  const existe = (grupo, clave) => Number(c.sinFiltros?.[grupo]?.[clave]) > 0;
  const estadoElegido = ORDEN_ESTADOS.includes(e.estado) ? e.estado : 'todos';
  const categoriaElegida = tieneClave(TEXTO_CATEGORIA, e.categoria) ? e.categoria : 'todas';
  const estados = ORDEN_ESTADOS.filter((valor) => existe('estado', valor) || valor === estadoElegido)
    .map((valor) => htmlDeChip('estado', valor, TEXTO_ESTADO_PLURAL[valor], valor === estadoElegido, cuenta('estado', valor)));
  const categorias = Object.keys(TEXTO_CATEGORIA).filter((valor) => existe('categoria', valor) || valor === categoriaElegida)
    .map((valor) => htmlDeChip('categoria', valor, TEXTO_CATEGORIA[valor], valor === categoriaElegida, cuenta('categoria', valor)));
  const resaltado = anioResaltado(e, ventana);
  const anios = [];
  for (let anio = ventana.desde; anio <= ventana.hasta; anio += 1) {
    anios.push(htmlDeChip('resaltar', String(anio), String(anio), resaltado === String(anio), Number(c.anio?.[String(anio)]) || 0));
  }
  return `<div class="pr-filtros">`
    + `<div class="pr-campo">${ICONO_BUSCAR}<input type="search" id="pr-buscar" placeholder="Buscá un proyecto" aria-label="Buscar un proyecto por nombre, descripción o autor" value="${esc(e.busqueda)}" autocomplete="off"></div>`
    + `<div class="sg-chips" role="group" aria-label="Estado">${htmlDeChip('estado', 'todos', 'Todos', estadoElegido === 'todos', cuenta('estado', 'todos'))}${estados.join('')}</div>`
    + `</div><div class="pr-filtros">`
    + `<div class="pr-grupo-filtro" role="group" aria-label="Categoría"><span class="pr-filtro-rotulo" aria-hidden="true">Categoría</span>${htmlDeChip('categoria', 'todas', 'Todas', categoriaElegida === 'todas', cuenta('categoria', 'todas'))}${categorias.join('')}</div>`
    + htmlDeFlechas(ventana)
    + `<div class="pr-grupo-filtro" role="group" aria-label="Resaltar un año"><span class="pr-filtro-rotulo" aria-hidden="true">Resaltar un año</span>${htmlDeChip('resaltar', 'ninguno', 'Ninguno', resaltado === null)}${anios.join('')}</div>`
    + `</div>`;
}

// =====================================================
// El HTML de los carriles (spec 2.1, 2.3 y 2.5)
// =====================================================

// El texto oculto de un carril, para lectores de pantalla: «5 hitos, del 01/08/2021 al 14/08/2025», «1 hito, el 10/03/2025» o
// «sin hitos todavía» (con `uno`/`varios`/`ninguno`: los del renglón de los logros)
const resumenDelCarril = (hitos, uno = 'hito', varios = 'hitos', ninguno = 'sin hitos todavía') => {
  const fechas = hitosConFecha(hitos).map(({ fecha }) => fecha);
  if (!fechas.length) return ninguno;
  return fechas.length === 1
    ? `${plural(1, uno, varios)}, el ${Utils.fechaCorta(fechas[0])}`
    : `${plural(fechas.length, uno, varios)}, del ${Utils.fechaCorta(fechas[0])} al ${Utils.fechaCorta(fechas.at(-1))}`;
};

// La pista de un carril: las líneas de cada 1 de enero, la columna del año resaltado, la línea de hoy, el tramo, los puntos (los de
// los otros años, apagados si hay un año resaltado), «Sin hitos todavía» y las píldoras de los que quedaron fuera de la ventana
const htmlDePista = (hitos, { ventana, hoy, anchoPx, resaltar, color, logro, sinHitos }) => {
  const { desde, hasta } = ventana;
  const { puntos, antes, despues, tramo } = puntosDelCarril(hitos, { desde, hasta, hoy, anchoPx });
  const partes = [];
  if (resaltar) {
    const izquierda = posicionEnLaPista(`${resaltar}-01-01`, desde, hasta);
    partes.push(`<span class="resalta" style="left:${izquierda}%;width:${redondear(posicionEnLaPista(`${Number(resaltar) + 1}-01-01`, desde, hasta) - izquierda)}%"></span>`);
  }
  for (let anio = desde; anio <= hasta; anio += 1) partes.push(`<span class="anio" style="left:${posicionEnLaPista(`${anio}-01-01`, desde, hasta)}%"></span>`);
  const deHoy = Utils.soloFecha(hoy);
  if (deHoy && deHoy >= `${desde}-01-01` && deHoy <= `${hasta}-12-31`) partes.push(`<span class="linea-hoy" style="left:${posicionEnLaPista(deHoy, desde, hasta)}%"></span>`);
  if (tramo) partes.push(`<span class="tramo" style="left:${tramo.x1}%;width:${redondear(tramo.x2 - tramo.x1)}%"></span>`);
  for (const punto of puntos) {
    const clases = ['punto', logro ? 'logro' : '', punto.futuro ? 'futuro' : '', punto.cantidad > 1 ? 'grupo' : '',
      resaltar && !punto.anios.includes(resaltar) ? 'apagado' : ''].filter(Boolean).join(' ');
    partes.push(`<span class="${clases}" style="left:${punto.x}%" title="${esc(punto.titulos.join('\n'))}">${punto.cantidad > 1 ? `<b>${String(punto.cantidad)}</b>` : ''}</span>`);
  }
  if (!hitosConFecha(hitos).length) partes.push(`<span class="sin">${esc(sinHitos)}</span>`);
  if (antes) partes.push(`<span class="fuera izq" title="${plural(antes, 'hito', 'hitos')} antes de ${desde}">${String(antes)} antes</span>`);
  if (despues) partes.push(`<span class="fuera der" title="${plural(despues, 'hito', 'hitos')} después de ${hasta}">${String(despues)} después</span>`);
  return `<span class="pr-pista" aria-hidden="true" style="--c:${color}">${partes.join('')}</span>`;
};

// El carril de un proyecto: todo el renglón es un link a su detalle, con los filtros de la lista en la dirección
const htmlDeCarril = (proyecto, hitos, contexto) => {
  const pista = htmlDePista(hitos, { ...contexto, color: colorDelProyecto(proyecto), logro: false, sinHitos: 'Sin hitos todavía' });
  return `<li><a class="pr-carril" href="${esc(urlDelProyecto(proyecto.id, contexto.estado, contexto.hoy))}">`
    + `<span class="pr-carril-nombre">${htmlDelCuadrado(proyecto)}<span class="pr-carril-texto"><b class="pr-nombre">${esc(proyecto.nombre)}</b>`
    + `<small>${htmlDeInsignia(proyecto.estado)}<span>${esc(textoDeCategoria(proyecto.categoria))}</span></small></span></span>`
    + `${pista}<span class="visualmente-oculto">: ${esc(resumenDelCarril(hitos))}</span></a></li>`;
};

// El renglón de los logros del área (los hitos sin proyecto), al final: lleva a la pestaña Logros del área
const htmlDelCarrilDeLogros = (logros, contexto) => {
  const pista = htmlDePista(logros, { ...contexto, color: COLOR_POR_DEFECTO, logro: true, sinHitos: 'Sin logros todavía' });
  return `<li><a class="pr-carril logros" href="#logros" data-ir-a="logros">`
    + `<span class="pr-carril-nombre"><span class="pr-tile logro">${iconoSvg('award')}</span><span class="pr-carril-texto"><b class="pr-nombre">Logros del área</b>`
    + `<small><span>Hitos que no son de un proyecto</span></small></span></span>`
    + `${pista}<span class="visualmente-oculto">: ${esc(resumenDelCarril(logros, 'logro', 'logros', 'sin logros todavía'))}</span></a></li>`;
};

// Los años de la ventana, arriba de los carriles (el de hoy, marcado)
const htmlDelEje = (ventana, hoy) => {
  const deHoy = anioDeLaFecha(hoy);
  const anios = [];
  for (let anio = ventana.desde; anio <= ventana.hasta; anio += 1) {
    const centro = redondear((posicionEnLaPista(`${anio}-01-01`, ventana.desde, ventana.hasta) + posicionEnLaPista(`${anio + 1}-01-01`, ventana.desde, ventana.hasta)) / 2);
    anios.push(`<span${anio === deHoy ? ' class="hoy"' : ''} style="left:${centro}%">${anio}</span>`);
  }
  return `<div class="pr-eje" aria-hidden="true"><span></span><span class="pr-eje-anios">${anios.join('')}</span></div>`;
};

// La leyenda (spec 2.1): con un año resaltado, suma el año
const htmlDeLeyenda = (resaltar) => `<div class="pr-leyenda" aria-hidden="true">`
  + '<span><i class="pr-mk"></i>Hito cumplido (con el color del proyecto)</span><span><i class="pr-mk futuro"></i>Hito previsto</span>'
  + '<span><i class="pr-mk logro"></i>Logro del área</span><span><i class="pr-mk hoy"></i>Hoy</span>'
  + '<span><b class="pr-mk-fuera">1 antes</b>Hitos fuera de los años elegidos</span>'
  + `${resaltar ? `<span><i class="pr-mk resalta"></i>${resaltar}</span>` : ''}</div>`;

// La pestaña Proyectos debajo de los filtros: la frase del año resaltado (si hay uno), un carril por proyecto de los que dejan los
// filtros, en orden, con los años arriba, el renglón de los logros al final y la leyenda; o los vacíos de la spec, 2.5. `proyectos`
// son todos (los filtra y los ordena acá) y `hitos`, los del timeline (los de cada proyecto, por su proyecto_id, y los logros, sin
// proyecto). La ventana sale de `estado.anios`, corregida a los años con hitos. `anchoPx`, el ancho de una pista (medido en el DOM);
// `esAdmin`, solo el true literal
function htmlDeCarriles(proyectos, hitos, opciones) {
  const { estado: elegido, hoy, anchoPx, esAdmin } = esObjeto(opciones) ? opciones : {};
  const todos = comoLista(proyectos).filter(esObjeto);
  const lista = comoLista(hitos).filter(esObjeto);
  if (!todos.length) {
    return `<div class="pr-vacio-caja"><p>Todavía no hay proyectos.${esAdmin === true ? ' Cargá el primero con «Nuevo proyecto».' : ''}</p></div>`;
  }
  const extremos = extremosDeAnios(todos, lista, hoy);
  const estado = estadoConVentana(estadoDeLaUrl(urlDeEstado(elegido, hoy), hoy), extremos);
  const ventana = ventanaDe(estado.anios, extremos);
  const resaltar = anioResaltado(estado, ventana);
  const frase = resaltar ? `<p class="pr-resumen-anio" role="status">${esc(fraseDelAnio(resaltar, lista))}</p>` : '';
  const elegidos = ordenarProyectos(filtrarProyectos(todos, estado), lista, hoy);
  if (!elegidos.length) {
    return `${frase}<div class="pr-vacio-caja"><p role="status">Ningún proyecto coincide con lo que buscaste.</p>`
      + '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-limpiar>Ver todos los proyectos</button></div>';
  }
  const porProyecto = new Map();
  for (const hito of lista) {
    if (esLogro(hito)) continue;
    if (!porProyecto.has(hito.proyecto_id)) porProyecto.set(hito.proyecto_id, []);
    porProyecto.get(hito.proyecto_id).push(hito);
  }
  // Los links de los carriles llevan los filtros de la lista, sin escribir la ventana de entrada aunque la hayan corregido los hitos
  const contexto = { ventana, hoy, anchoPx, resaltar, estado: conAniosDeEntrada(estado, extremos, hoy) };
  const carriles =elegidos.map((proyecto) => htmlDeCarril(proyecto, porProyecto.get(proyecto.id) ?? [], contexto)).join('');
  return `${frase}<div class="pr-tarjeta"><div class="pr-carriles">${htmlDelEje(ventana, hoy)}`
    + `<ul class="pr-lista-carriles" role="list" aria-label="Proyectos">${carriles}${htmlDelCarrilDeLogros(lista.filter(esLogro), contexto)}</ul>`
    + `</div>${htmlDeLeyenda(resaltar)}</div>`;
}

// =====================================================
// Ayudantes del detalle, la línea de tiempo y los logros
// =====================================================

// «Hoy» de lo puro: la fecha recibida, si sirve; si no, la de hoy en Argentina
const hoyDe = (hoy) => Utils.soloFecha(hoy) ?? Utils.hoyEnArgentina();
// Un id entero positivo como texto (lo único que llega a un data-* o a una dirección de la API), o null
const idEntero = (valor) => {
  const numero = typeof valor === 'number' ? valor : (typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN);
  return Number.isSafeInteger(numero) && numero > 0 ? String(numero) : null;
};
// Un texto sin los espacios de los extremos ('' si no hay nada)
const textoLimpio = (valor) => String(valor ?? '').trim();
// Las de una lista, o la cantidad que manda la API si no vino la lista
const cantidadDe = (lista, cantidad) => (Array.isArray(lista) ? lista.filter(esObjeto).length : Math.max(0, Math.trunc(Number(cantidad)) || 0));
// Los hitos del más nuevo al más viejo (por fecha, como texto, y después por id). Una lista nueva
const delMasNuevo = (hitos) => comoLista(hitos).filter(esObjeto).slice()
  .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) || (Number(b.id) || 0) - (Number(a.id) || 0));

// El dominio (con su puerto, sin el usuario) de una dirección http o https, en minúsculas; null si no es http o https o no tiene.
// Sin URL: con una expresión regular sobre el texto (la barra invertida corta como la normal, como en el navegador)
const dominioDe = (url) => {
  if (!Utils.esUrlSegura(url)) return null;
  const autoridad = /^https?:\/\/([^/?#\\]*)/i.exec(url.trim())?.[1] ?? '';
  return autoridad.slice(autoridad.lastIndexOf('@') + 1).toLowerCase() || null;
};

// El tamaño de un archivo: «90 KB» (1 como mínimo) o, desde 1 MB, «1,4 MB»; '' si no es un número
const tamanoDeArchivo = (bytes) => {
  const numero = typeof bytes === 'number' || (typeof bytes === 'string' && bytes.trim() !== '') ? Number(bytes) : NaN;
  if (!Number.isFinite(numero) || numero < 0) return '';
  return numero >= 1048576 ? `${(numero / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(numero / 1024))} KB`;
};
// La extensión del nombre de un archivo, en mayúsculas y hasta 4 letras (PDF, DOCX…); '' si no tiene
const extensionDe = (nombre) => {
  const texto = String(nombre ?? '');
  const punto = texto.lastIndexOf('.');
  return punto > 0 && punto < texto.length - 1 ? Array.from(texto.slice(punto + 1)).slice(0, 4).join('').toUpperCase() : '';
};
// «Ver» abre la vista previa: solo las imágenes y los PDF (spec 6)
const sePuedeVer = (mime) => typeof mime === 'string' && (/^image\//i.test(mime) || mime.toLowerCase() === 'application/pdf');

// =====================================================
// La ficha de un proyecto (spec 3)
// =====================================================

// El texto del enlace de un proyecto, según su dominio: «Abrir en GitHub» (github.com), «Abrir el borrador» (docs.google.com o
// drive.google.com) o «Abrir el enlace»; null si no es http o https (entonces el enlace no se dibuja)
function textoDelEnlace(url) {
  const dominio = dominioDe(url);
  if (dominio === null) return null;
  const host = dominio.replace(/:\d*$/, '');
  if (host === 'github.com' || host.endsWith('.github.com')) return 'Abrir en GitHub';
  if (host === 'docs.google.com' || host === 'drive.google.com') return 'Abrir el borrador';
  return 'Abrir el enlace';
}

// La ficha (spec 3): el cuadrado grande con su color y su ícono, el nombre y debajo la insignia del estado y la categoría; la
// descripción completa; a la derecha, las acciones (el enlace del proyecto, si es http o https, y para administración «Editar el
// proyecto» y «Eliminar», con data-* para la parte del DOM); y la fila de datos, con «—» en los vacíos. `esAdmin`, solo el true literal
function htmlDeFicha(proyecto, opciones) {
  const p = esObjeto(proyecto) ? proyecto : {};
  const esAdmin = opciones?.esAdmin === true;
  const id = idEntero(p.id);
  const enlace = textoDelEnlace(p.enlace_externo);
  const categoria = textoDeCategoria(p.categoria);
  const descripcion = textoLimpio(p.descripcion);
  const acciones = (enlace ? `<a class="sg-btn sg-btn-borde" href="${esc(p.enlace_externo.trim())}" target="_blank" rel="noopener">${ICONO_EXTERNO}${esc(enlace)}</a>` : '')
    + (esAdmin && id ? `<button type="button" class="sg-btn sg-btn-borde" data-editar-proyecto="${id}">Editar el proyecto</button>`
      + `<button type="button" class="sg-btn sg-btn-rojo-borde" data-eliminar-proyecto="${id}">Eliminar</button>` : '');
  const areas = comoLista(p.areas).filter(esObjeto).map((area) => textoLimpio(area.nombre)).filter(Boolean).join(', ');
  const datos = [
    ['Prioridad', tieneClave(TEXTO_PRIORIDAD, p.prioridad) ? TEXTO_PRIORIDAD[p.prioridad] : Utils.SIN_DATO],
    ['Fecha de elevación', Utils.fechaCorta(p.fecha_inicio)],
    ['Autor o responsable', textoLimpio(p.responsable) || Utils.SIN_DATO],
    ['Áreas', areas || Utils.SIN_DATO],
    ['Hitos', String(cantidadDe(p.hitos, p.cantidad_hitos))],
    ['Documentos', String(cantidadDe(p.documentos, p.cantidad_documentos))]
  ];
  return '<div class="pr-tarjeta"><div class="pr-ficha">'
    + `<div><div class="pr-ficha-titulo">${htmlDelCuadrado(p, 'grande')}<div><h2 class="pr-titulo">${esc(p.nombre)}</h2>`
    + `<div class="etiquetas">${htmlDeInsignia(p.estado)}${categoria ? `<span class="pr-etq">${esc(categoria)}</span>` : ''}</div></div></div>`
    + `${descripcion ? `<p class="desc">${esc(descripcion)}</p>` : ''}</div>`
    + `${acciones ? `<div class="pr-acciones">${acciones}</div>` : ''}`
    + `<dl class="pr-datos">${datos.map(([rotulo, valor]) => `<div class="pr-dato"><dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd></div>`).join('')}</dl>`
    + '</div></div>';
}

// =====================================================
// La cinta del recorrido (spec 3)
// =====================================================

// La x de `fecha` en la cinta de `desde` a `hasta` (del 1/1 de uno al 31/12 del otro): de 30 a 970, con dos decimales. Los días se
// cuentan sobre el texto (diaDe), sin la zona horaria
const xEnLaCinta = (fecha, desde, hasta) => {
  const inicio = diaDe(`${desde}-01-01`);
  const proporcion = (diaDe(fecha) - inicio) / (diaDe(`${hasta + 1}-01-01`) - inicio);
  return Math.round((CINTA.inicio + proporcion * (CINTA.fin - CINTA.inicio)) * 100) / 100;
};
const dosDecimales = (valor) => Math.round(valor * 100) / 100;
// La etiqueta de un evento: el texto cortado a 34 caracteres con «…» (contados con Array.from: un emoji es uno)
const etiquetaCorta = (texto) => {
  const letras = Array.from(String(texto ?? ''));
  return letras.length > CINTA.largoEtiqueta ? `${letras.slice(0, CINTA.largoEtiqueta - 1).join('')}…` : letras.join('');
};
// El ancho de una etiqueta: 6,3 unidades por letra, con 10 letras como mínimo (la fecha de debajo)
const anchoDeEtiqueta = (etiqueta) => dosDecimales(Math.max(Array.from(etiqueta).length, CINTA.letrasMinimas) * CINTA.anchoPorLetra);

// La cinta del recorrido de un proyecto (spec 3), como datos: la pantalla la dibuja con svgDeCinta. Los eventos son los hitos (un
// rombo: 'hecho' si la fecha ya llegó, 'futuro' si es posterior a `hoy`) y la fecha de elevación ('elev', con el texto «Elevación»),
// por fecha (el mismo día, la elevación primero). El eje va del 1/1 del año del primer evento al 31/12 del mayor entre el año de hoy y
// el del último evento, con 2 años como mínimo (`desde` y `hasta`); `meses`, si son 3 años o menos (una marca por mes); `anios`, la
// x de cada 1 de enero. La banda: celeste de `x1` (el primer evento) a `x2` (hoy, o el último evento si ya pasó; nunca antes de `x1`)
// y clara de `x2` a `x3` (el último evento, si es posterior a hoy; si no, null). `hoyX`, la línea de hoy (null si hoy queda fuera del
// eje: un proyecto que empieza después del año que viene). Cada evento con su `x`, su `etiqueta`, su `ancho`, su `fila` (0 la más
// cercana al eje, hasta 2; null si no entra sin pisar otra con 10 de aire) y `xTexto` (donde empieza; null sin fila). Toda x queda
// entre 30 y 970. null sin hitos ni fecha de elevación (con una fecha que sirva)
function cintaDelProyecto(proyecto, hoyDado) {
  if (!esObjeto(proyecto)) return null;
  const hoy = hoyDe(hoyDado);
  const eventos = hitosConFecha(proyecto.hitos)
    .map(({ hito, fecha }) => ({ fecha, tipo: fecha > hoy ? 'futuro' : 'hecho', texto: String(hito.titulo ?? '') }));
  const elevacion = Utils.soloFecha(proyecto.fecha_inicio);
  if (elevacion) eventos.push({ fecha: elevacion, tipo: 'elev', texto: 'Elevación' });
  if (!eventos.length) return null;
  const primeroLaElevacion = (evento) => (evento.tipo === 'elev' ? -1 : 0);
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || primeroLaElevacion(a) - primeroLaElevacion(b));
  const primero = eventos[0].fecha;
  const ultimo = eventos.at(-1).fecha;
  const hasta = Math.max(Number(hoy.slice(0, 4)), Number(ultimo.slice(0, 4)));
  const desde = Math.min(Number(primero.slice(0, 4)), hasta - 1);
  const x = (fecha) => xEnLaCinta(fecha, desde, hasta);
  const anios = [];
  for (let anio = desde; anio <= hasta; anio += 1) anios.push({ anio, x: x(`${anio}-01-01`) });
  const x1 = x(primero);
  const banda = { x1, x2: Math.max(x1, x(hoy < ultimo ? hoy : ultimo)), x3: ultimo > hoy ? x(ultimo) : null };
  // Las etiquetas, en orden: cada una en la primera fila donde no pisa a ninguna (con 10 de aire)
  const filas = CINTA.filasY.map(() => []);
  const conEtiquetas = eventos.map((evento) => {
    const xEvento = x(evento.fecha);
    const etiqueta = etiquetaCorta(evento.texto);
    const ancho = anchoDeEtiqueta(etiqueta);
    let izquierda = xEvento - 4;
    if (izquierda + ancho > CINTA.bordeDerecho) izquierda = xEvento + 4 - ancho;
    izquierda = dosDecimales(Math.max(CINTA.bordeIzquierdo, izquierda));
    const fila = filas.findIndex((ocupadas) => ocupadas.every(([a, b]) => izquierda >= b + CINTA.aire || a >= izquierda + ancho + CINTA.aire));
    if (fila !== -1) filas[fila].push([izquierda, izquierda + ancho]);
    return { x: xEvento, fecha: evento.fecha, tipo: evento.tipo, texto: evento.texto, etiqueta, ancho, fila: fila === -1 ? null : fila, xTexto: fila === -1 ? null : izquierda };
  });
  const hoyEnElEje = hoy >= `${desde}-01-01` && hoy <= `${hasta}-12-31`;
  return { desde, hasta, meses: hasta - desde <= 2, anios, banda, hoyX: hoyEnElEje ? x(hoy) : null, eventos: conEtiquetas };
}

const LEYENDA_DE_LA_CINTA = '<div class="pr-leyenda" aria-hidden="true"><span><i class="pr-mk-hito"></i>Hito cumplido</span>'
  + '<span><i class="pr-mk-hito futuro"></i>Hito previsto</span><span><i class="pr-mk futuro"></i>Elevación</span><span><i class="pr-mk hoy"></i>Hoy</span></div>';

// El SVG de la cinta (con los números de cintaDelProyecto), en su marco con desplazamiento (en el teléfono conserva unos 640 px), y
// la leyenda. Las marcas de los años (con su número; con muchos años, el número cada tantos para que no se pisen) y de los meses (con
// 3 años o menos), la banda, la línea de hoy, las etiquetas que entran (con
// su fecha y una guía a su marca) y las marcas, cada una con su title «dd/mm/aaaa: título» (también la que no tiene etiqueta). El
// SVG es una imagen con su rótulo, «Recorrido de <titulo>: N hitos». Sin cinta (null), el texto de la spec, sin leyenda
function svgDeCinta(cinta, titulo) {
  if (!esObjeto(cinta) || !Array.isArray(cinta.eventos) || !cinta.eventos.length) return `<p class="pr-vacio">${esc(TEXTO_SIN_CINTA)}</p>`;
  const { desde, hasta, banda } = cinta;
  const y = CINTA.eje;
  const partes = [];
  const anios = comoLista(cinta.anios);
  // Cada cuántos años va el número (1 con pocos años; con una ventana larga, los números no se pisan)
  const paso = Math.max(1, Math.ceil(CINTA.separacionDeAnios / ((CINTA.fin - CINTA.inicio) / Math.max(1, anios.length))));
  anios.forEach(({ anio, x }, i) => {
    const siguiente = anios[i + 1]?.x ?? CINTA.fin;
    partes.push(`<line class="eje" x1="${x}" x2="${x}" y1="${y - 14}" y2="${y + 14}"/>`);
    if (i % paso === 0) partes.push(`<text class="anio" x="${dosDecimales((x + siguiente) / 2)}" y="${y + 34}">${String(Number(anio))}</text>`);
    if (!cinta.meses) return;
    for (let mes = 2; mes <= 12; mes += 1) {
      const xMes = xEnLaCinta(`${anio}-${String(mes).padStart(2, '0')}-01`, desde, hasta);
      partes.push(`<line class="eje mes" x1="${xMes}" x2="${xMes}" y1="${y - 6}" y2="${y + 6}"/>`);
    }
  });
  const anchoVida = Math.max(4, banda.x2 - banda.x1);
  partes.push(`<rect class="vida" x="${dosDecimales(Math.min(banda.x1, CINTA.fin - anchoVida))}" y="${y - 7}" width="${dosDecimales(anchoVida)}" height="14" rx="3"/>`);
  if (banda.x3 !== null && banda.x3 > banda.x2) partes.push(`<rect class="porvenir" x="${banda.x2}" y="${y - 7}" width="${dosDecimales(banda.x3 - banda.x2)}" height="14" rx="3"/>`);
  if (cinta.hoyX !== null) partes.push(`<line class="l-hoy" x1="${cinta.hoyX}" x2="${cinta.hoyX}" y1="${y - 22}" y2="${y + 16}"/><text class="hoy" x="${cinta.hoyX}" y="${y + 52}">Hoy</text>`);
  // Primero todas las guías y después las etiquetas (con un halo blanco, .etq): la guía de una fila de arriba no tacha el texto de
  // una de abajo
  const conEtiqueta = cinta.eventos.filter((evento) => evento.fila !== null);
  for (const evento of conEtiqueta) partes.push(`<line class="guia" x1="${evento.x}" x2="${evento.x}" y1="${CINTA.filasY[evento.fila] + 11}" y2="${y - 9}"/>`);
  for (const evento of conEtiqueta) {
    const yFila = CINTA.filasY[evento.fila];
    partes.push(`<text class="etq" x="${evento.xTexto}" y="${yFila - 6}">${esc(evento.etiqueta)}</text>`
      + `<text class="etq-f" x="${evento.xTexto}" y="${yFila + 7}">${Utils.fechaCorta(evento.fecha)}</text>`);
  }
  // Las marcas: los rombos y, encima, la elevación (un círculo hueco: se ve aunque caiga el mismo día que un hito)
  const title = (evento) => `<title>${esc(`${Utils.fechaCorta(evento.fecha)}: ${evento.texto}`)}</title>`;
  for (const evento of cinta.eventos.filter((e) => e.tipo !== 'elev')) {
    partes.push(`<rect class="${evento.tipo === 'futuro' ? 'h-futuro' : 'h-hecho'}" x="${dosDecimales(evento.x - 7)}" y="${y - 7}" width="14" height="14" rx="2" transform="rotate(45 ${evento.x} ${y})">${title(evento)}</rect>`);
  }
  for (const evento of cinta.eventos.filter((e) => e.tipo === 'elev')) partes.push(`<circle class="h-elev" cx="${evento.x}" cy="${y}" r="6.5">${title(evento)}</circle>`);
  const hitos = cinta.eventos.filter((evento) => evento.tipo !== 'elev').length;
  const rotulo = `Recorrido de ${textoLimpio(titulo) || 'este proyecto'}: ${plural(hitos, 'hito', 'hitos')}`;
  return `<div class="pr-cinta-marco"><svg class="pr-cinta" viewBox="0 0 1000 ${CINTA.alto}" role="img" aria-label="${esc(rotulo)}">${partes.join('')}</svg></div>${LEYENDA_DE_LA_CINTA}`;
}

// =====================================================
// Las filas de los hitos y los archivos (spec 3 a 6)
// =====================================================

// Los archivos de un hito o los documentos de un proyecto (spec 3 y 6): cada uno con el recuadro de la extensión, el nombre, el
// tamaño y «Subido el dd/mm/aaaa» (de `subido_el`, Ruling R3), y sus botones: «Ver» (solo imágenes y PDF), «Descargar» (todos los
// roles: el lector y el colaborador también bajan) y «Eliminar» (solo administración). Los botones no hacen nada solos: llevan en
// data-* lo que necesita la parte del DOM (la acción, la dirección de la API de la lista —`base`: /gestion/hitos/N/archivos o
// /gestion/proyectos/N/documentos—, el id, el nombre y el MIME). Sin `base` o sin un id que sirva, el archivo se lista sin botones.
// Sin archivos, ''
function htmlDeArchivos(archivos, opciones) {
  const lista = comoLista(archivos).filter(esObjeto);
  if (!lista.length) return '';
  const esAdmin = opciones?.esAdmin === true;
  const base = typeof opciones?.base === 'string' && opciones.base !== '' ? opciones.base : null;
  const filas = lista.map((archivo) => {
    const nombre = String(archivo.nombre_archivo ?? '');
    const id = idEntero(archivo.id);
    const detalle = [tamanoDeArchivo(archivo.tamano), Utils.soloFecha(archivo.subido_el) ? `Subido el ${Utils.fechaCorta(archivo.subido_el)}` : ''].filter(Boolean).join('. ');
    const datos = `data-base="${esc(base)}" data-id="${id}" data-nombre="${esc(nombre)}" data-mime="${esc(archivo.mime_type)}"`;
    const boton = (accion, texto, clase = 'sg-link') => `<button type="button" class="${clase}" data-archivo="${accion}" ${datos} aria-label="${esc(`${texto} ${nombre}`.trim())}">${texto}</button>`;
    const botones = base && id
      ? (sePuedeVer(archivo.mime_type) ? boton('ver', 'Ver') : '') + boton('descargar', 'Descargar') + (esAdmin ? boton('eliminar', 'Eliminar', 'sg-link rojo') : '')
      : '';
    return `<li class="pr-archivo"><span class="pr-ext" aria-hidden="true">${esc(extensionDe(nombre))}</span>`
      + `<span><span class="n">${esc(nombre)}</span>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span>`
      + `${botones ? `<span class="acc">${botones}</span>` : ''}</li>`;
  });
  return `<ul class="pr-archivos">${filas.join('')}</ul>`;
}

// El proyecto de un hito: el recibido o, en la línea de tiempo, el que arman los campos del timeline; null para un logro
const proyectoDelHito = (hito, proyecto) => {
  if (esLogro(hito)) return null;
  if (esObjeto(proyecto)) return proyecto;
  return { id: hito.proyecto_id, nombre: hito.proyecto_nombre, color: hito.proyecto_color, icono: hito.proyecto_icono };
};

// La fila de un hito o un logro, que se despliega como los movimientos del Seguimiento (spec 3, 4 y 5): un botón con aria-expanded y
// aria-controls (el id del cuerpo: hito-<prefijo>-<id>, con `prefijo` 'd' en el detalle, 'l' en la línea de tiempo y 'g' en los
// logros, porque la línea de tiempo y los logros están en la misma página) con la fecha, la marca, el título (con «Previsto» si la
// fecha es posterior a `hoy`), debajo la primera línea de la descripción (en la línea de tiempo, `conProyecto`: el nombre del
// proyecto o «Logro del área», y la marca es el cuadradito del color del proyecto o la de logro), a la derecha «Enlace» o «N archivos»
// y el chevron. El cuerpo, oculto: el link al proyecto (en la línea de tiempo, con los filtros de la lista de `estado`), la
// descripción completa, «Ver la evidencia» (solo http o https, con su dominio), los archivos y, para administración, «Editar el hito»
// (o «el logro»), «Subir archivos» y «Eliminar», con data-* para la parte del DOM
function htmlDeHito(hito, opciones) {
  if (!esObjeto(hito)) return '';
  const { conProyecto, proyecto, esAdmin, hoy: hoyDado, prefijo, estado } = esObjeto(opciones) ? opciones : {};
  const hoy = hoyDe(hoyDado);
  const admin = esAdmin === true;
  const enLaLinea = conProyecto === true;
  const delProyecto = proyectoDelHito(hito, proyecto);
  const tipo = delProyecto ? 'hito' : 'logro';
  const id = idEntero(hito.id);
  const lugar = typeof prefijo === 'string' && /^[a-z]+$/.test(prefijo) ? prefijo : (enLaLinea ? 'l' : 'd');
  const idDelCuerpo = `hito-${lugar}-${id ?? '0'}`;
  const fecha = Utils.soloFecha(hito.fecha);
  const futuro = fecha !== null && fecha > hoy;
  const titulo = String(hito.titulo ?? '');
  const descripcion = textoLimpio(hito.descripcion);
  const enlace = dominioDe(hito.evidencia_url) === null ? null : hito.evidencia_url.trim();
  const archivos = comoLista(hito.archivos).filter(esObjeto);
  const evidencia = [enlace ? 'Enlace' : '', archivos.length ? plural(archivos.length, 'archivo', 'archivos') : ''].filter(Boolean).join(' y ');
  const marca = enLaLinea
    ? (delProyecto ? `<span class="pr-tile chico marca" style="--c:${colorDelProyecto(delProyecto)}" aria-hidden="true"></span>` : '<span class="pr-tile chico logro marca" aria-hidden="true"></span>')
    : `<i class="pr-mk-hito marca${futuro ? ' futuro' : ''}" aria-hidden="true"></i>`;
  const debajo = enLaLinea ? (delProyecto ? String(delProyecto.nombre ?? '') : 'Logro del área') : descripcion.split(/\r?\n/)[0];
  const fila = `<button type="button" class="pr-fila" aria-expanded="false" aria-controls="${idDelCuerpo}">`
    + `<span class="f">${Utils.fechaCorta(hito.fecha)}</span>${marca}`
    + `<span><span class="q">${esc(titulo)}</span>${futuro ? '<span class="pr-futuro-etq">Previsto</span>' : ''}<span class="d">${esc(debajo)}</span></span>`
    + `<span class="p">${esc(evidencia)}</span>${ICONO_ABRIR}</button>`;
  const contenido = [];
  if (descripcion) contenido.push(`<p class="desc">${esc(descripcion)}</p>`);
  if (enlace) contenido.push(`<p><a class="sg-link" href="${esc(enlace)}" target="_blank" rel="noopener">Ver la evidencia</a> <small class="pr-host">(${esc(dominioDe(enlace))})</small></p>`);
  contenido.push(htmlDeArchivos(archivos, { esAdmin: admin, base: id ? `/gestion/hitos/${id}/archivos` : null }));
  const cuerpo = [
    enLaLinea && delProyecto && idEntero(delProyecto.id) ? `<p><a class="sg-link" href="${esc(urlDelProyecto(idEntero(delProyecto.id), estado, hoy))}">${esc(delProyecto.nombre)}</a></p>` : '',
    contenido.join('') || '<p class="pr-vacio">Sin descripción, enlace ni archivos.</p>',
    admin && id ? '<div class="acciones">'
      + `<button type="button" class="sg-link" data-editar-hito="${id}" aria-label="${esc(`Editar el ${tipo} ${titulo}`.trim())}">Editar el ${tipo}</button>`
      + `<button type="button" class="sg-link" data-subir-archivos="${id}" aria-label="${esc(`Subir archivos al ${tipo} ${titulo}`.trim())}">Subir archivos</button>`
      + `<button type="button" class="sg-link rojo" data-eliminar-hito="${id}" aria-label="${esc(`Eliminar el ${tipo} ${titulo}`.trim())}">Eliminar</button></div>` : ''
  ].join('');
  return `<li class="pr-mov">${fila}<div class="pr-cuerpo" id="${idDelCuerpo}" hidden>${cuerpo}</div></li>`;
}

// =====================================================
// El detalle de un proyecto (spec 3)
// =====================================================

// Los documentos (spec 3): «Subir documentos» para administración (data-subir-documentos) y, si no, «N documentos»; la lista (con
// htmlDeArchivos) o «Este proyecto no tiene documentos.», y para administración, debajo, el límite
function htmlDeDocumentos(proyecto, opciones) {
  const p = esObjeto(proyecto) ? proyecto : {};
  const esAdmin = opciones?.esAdmin === true;
  const id = idEntero(p.id);
  const documentos = comoLista(p.documentos).filter(esObjeto);
  const cabeza = esAdmin && id
    ? `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-subir-documentos="${id}">${ICONO_SUBIR}Subir documentos</button>`
    : `<span>${plural(cantidadDe(p.documentos, p.cantidad_documentos), 'documento', 'documentos')}</span>`;
  return `<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Documentos</h3>${cabeza}</div>`
    + (documentos.length ? htmlDeArchivos(documentos, { esAdmin, base: id ? `/gestion/proyectos/${id}/documentos` : null }) : '<p class="pr-vacio">Este proyecto no tiene documentos.</p>')
    + (esAdmin ? '<p class="pr-vacio pr-nota">Hasta 10 documentos de 10 MB cada uno.</p>' : '')
    + '</div>';
}

// Los hitos del detalle (spec 3): «Nuevo hito» para administración y, si no, «N hitos»; las filas del más nuevo al más viejo, o la
// explicación de qué es un hito (con «Cargar el primer hito» para administración)
const htmlDeHitosDelProyecto = (p, { esAdmin, hoy }) => {
  const id = idEntero(p.id);
  const hitos = delMasNuevo(p.hitos);
  const cabeza = esAdmin && id
    ? `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-hito="${id}">${ICONO_MAS}Nuevo hito</button>`
    : `<span>${plural(hitos.length, 'hito', 'hitos')}</span>`;
  const cuerpo = hitos.length
    ? `<ul class="pr-movs pr-compacta">${hitos.map((hito) => htmlDeHito(hito, { conProyecto: false, proyecto: p, esAdmin, hoy, prefijo: 'd' })).join('')}</ul>`
    : '<div class="pr-vacio-caja"><p>Este proyecto todavía no tiene hitos. Un hito es un paso cumplido o previsto: una elevación, un lanzamiento, una presentación.</p>'
      + `${esAdmin && id ? `<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-hito="${id}">${ICONO_MAS}Cargar el primer hito</button>` : ''}</div>`;
  return `<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Hitos</h3>${cabeza}</div>${cuerpo}</div>`;
};

// El detalle de un proyecto (spec 3; `proyecto`, el de GET /gestion/proyectos/:id, con sus hitos y sus documentos): el link «Ver
// todos los proyectos», que vuelve a la lista con los filtros de `estado` (los de la dirección del detalle, estadoDeLaUrl); la ficha;
// la tarjeta «Recorrido», con «N hitos» y la cinta; y las dos columnas, los hitos y los documentos. `esAdmin`, solo el true literal
function htmlDeDetalle(proyecto, opciones) {
  const p = esObjeto(proyecto) ? proyecto : {};
  const { esAdmin, hoy: hoyDado, estado } = esObjeto(opciones) ? opciones : {};
  const hoy = hoyDe(hoyDado);
  const admin = esAdmin === true;
  return `<a class="pr-volver" href="${esc(`proyectos.html${urlDeEstado(estado, hoy)}`)}">Ver todos los proyectos</a>`
    + htmlDeFicha(p, { esAdmin: admin })
    + `<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Recorrido</h3><span>${plural(cantidadDe(p.hitos, p.cantidad_hitos), 'hito', 'hitos')}</span></div>`
    + `${svgDeCinta(cintaDelProyecto(p, hoy), p.nombre)}</div>`
    + `<div class="pr-dos">${htmlDeHitosDelProyecto(p, { esAdmin: admin, hoy })}${htmlDeDocumentos(p, { esAdmin: admin })}</div>`;
}

// =====================================================
// La línea de tiempo (spec 4) y los logros del área (spec 5)
// =====================================================

const FILTROS_DE_LA_LINEA = Object.freeze({ todos: 'Todos', proyectos: 'De los proyectos', logros: 'Logros del área' });

// La pestaña Línea de tiempo (spec 4; `hitos`, los del timeline): los chips «Todos», «De los proyectos» y «Logros del área», con su
// cantidad (data-grupo="linea"; un filtro que no sirve es «Todos»), y los hitos agrupados por año, del más nuevo al más viejo, cada
// año con su título y «N hitos» (en el año de hoy, «N hitos, hasta hoy y lo previsto»), con las filas de htmlDeHito. Sin paginación.
// Sin hitos con el filtro, «No hay hitos con este filtro.». `estado`, los filtros de la lista, para los links a los proyectos
function htmlDeLinea(hitos, opciones) {
  const { filtro, hoy: hoyDado, esAdmin, estado } = esObjeto(opciones) ? opciones : {};
  const hoy = hoyDe(hoyDado);
  const admin = esAdmin === true;
  const elegido = tieneClave(FILTROS_DE_LA_LINEA, filtro) ? filtro : 'todos';
  const todos = hitosConFecha(hitos);
  const pasa = (valor, hito) => valor === 'todos' || (valor === 'logros') === esLogro(hito);
  const chips = Object.keys(FILTROS_DE_LA_LINEA)
    .map((valor) => htmlDeChip('linea', valor, FILTROS_DE_LA_LINEA[valor], valor === elegido, todos.filter(({ hito }) => pasa(valor, hito)).length)).join('');
  const porAnio = new Map();
  for (const { hito, fecha } of todos.filter(({ hito }) => pasa(elegido, hito)).reverse()) {
    const anio = fecha.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio).push(hito);
  }
  const anios = [...porAnio].map(([anio, delAnio]) => `<div class="pr-anio"><h2 id="linea-${anio}">${anio}</h2>`
    + `<small>${plural(delAnio.length, 'hito', 'hitos')}${anio === hoy.slice(0, 4) ? ', hasta hoy y lo previsto' : ''}</small></div>`
    + `<ul class="pr-movs" aria-labelledby="linea-${anio}">${delAnio.map((hito) => htmlDeHito(hito, { conProyecto: true, esAdmin: admin, hoy, prefijo: 'l', estado })).join('')}</ul>`);
  return `<div class="pr-filtros"><div class="sg-chips" role="group" aria-label="Qué hitos">${chips}</div></div>`
    + `<div class="pr-tarjeta">${anios.join('') || '<p class="pr-vacio">No hay hitos con este filtro.</p>'}</div>`;
}

// La pestaña Logros del área (spec 5; `hitos`, los del timeline: los logros son los que no tienen proyecto): el título, la
// explicación y, para administración, «Registrar un logro» (data-nuevo-logro); los logros como filas de hitos, del más nuevo al
// más viejo, o «Todavía no hay logros del área.»
function htmlDeLogros(hitos, opciones) {
  const { esAdmin, hoy: hoyDado } = esObjeto(opciones) ? opciones : {};
  const hoy = hoyDe(hoyDado);
  const admin = esAdmin === true;
  const logros = delMasNuevo(comoLista(hitos).filter(esObjeto).filter(esLogro));
  return '<div class="pr-tarjeta"><div class="pr-cabeza"><div><h2 class="pr-h">Logros del área</h2>'
    + '<p class="pr-explica">Los logros que no son parte de un proyecto: un premio, una presentación, un convenio. Salen en el Informe anual, al final de los logros del año.</p></div>'
    + `${admin ? `<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-logro>${ICONO_MAS}Registrar un logro</button>` : ''}</div>`
    + (logros.length
      ? `<ul class="pr-movs">${logros.map((hito) => htmlDeHito(hito, { conProyecto: false, esAdmin: admin, hoy, prefijo: 'g' })).join('')}</ul>`
      : '<div class="pr-vacio-caja"><p>Todavía no hay logros del área.</p></div>')
    + '</div>';
}

// =====================================================
// Formularios, archivos y confirmaciones (spec 6 y 9)
// =====================================================

// Copias de services/proyectosReglas.js, atadas por tests de paridad (tests/proyectos-frontend.test.js): si cambia una allá, cambia
// acá. Solo avisan en el momento: el servidor valida igual
const ESTADOS = Object.freeze(['idea', 'en_curso', 'completado', 'suspendido']);
const PRIORIDADES = Object.freeze(['alta', 'media', 'baja']);
const CATEGORIAS = Object.freeze(['tecnologia', 'normativa', 'difusion']);
// Las 25 claves de ICON_SELECTOR_MAP de main.js, en su orden (ICONOS_PROYECTO del servidor)
const ICONOS = Object.freeze([
  'bar-chart-3', 'clipboard-list', 'database', 'file-text', 'shield', 'globe', 'users', 'building-2', 'folder', 'code',
  'book-open', 'target', 'flag', 'award', 'briefcase', 'lock', 'eye', 'zap', 'lightbulb', 'file-search', 'pie-chart',
  'megaphone', 'calendar', 'settings', 'mail'
]);
const LARGOS_PROYECTOS = Object.freeze({ nombre: 200, responsable: 150, enlace: 500, titulo: 200, evidencia: 500 });
const FECHA_MINIMA_PROYECTOS = '2000-01-01';
const MENSAJES_PROYECTOS = Object.freeze({
  nombre: 'Escribí el nombre del proyecto.', nombreLargo: 'El nombre puede tener hasta 200 caracteres.',
  estado: 'El estado no es válido.', prioridad: 'La prioridad no es válida.', categoria: 'La categoría no es válida.',
  fechaInicio: 'La fecha de elevación no es válida.',
  responsable: 'El autor o responsable puede tener hasta 150 caracteres.',
  enlace: 'El enlace tiene que empezar con http:// o https://.', enlaceLargo: 'El enlace puede tener hasta 500 caracteres.',
  color: 'El color no es válido.', icono: 'El ícono no es válido.', areas: 'Elegí áreas que existan.',
  titulo: 'Escribí el título del hito.', tituloLargo: 'El título puede tener hasta 200 caracteres.',
  fecha: 'Elegí la fecha del hito.', fechaInvalida: 'La fecha del hito no es válida.',
  evidencia: 'El enlace de la evidencia tiene que empezar con http:// o https://.',
  evidenciaLarga: 'El enlace de la evidencia puede tener hasta 500 caracteres.',
  sinDatos: 'No hay datos para guardar.'
});

// Copias de config/upload.js, atadas por tests de paridad: las extensiones, los 10 MB, los máximos y los mismos mensajes que el servidor
const EXTENSIONES_PERMITIDAS = Object.freeze([
  '.pdf', '.docx', '.xlsx', '.csv', '.odt', '.ods', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.rar', '.7z'
]);
const TAMANO_MAXIMO = 10 * 1024 * 1024;
const MAXIMO_POR_HITO = 3;
const MAXIMO_POR_PROYECTO = 10;
const MENSAJE_MAXIMO_POR_HITO = 'Podés subir hasta 3 archivos por hito.';
const MENSAJE_MAXIMO_POR_PROYECTO = 'Podés subir hasta 10 documentos por proyecto.';
const MENSAJE_TAMANO_MAXIMO = 'El archivo excede el tamaño máximo de 10 MB';
const mensajeTipoNoPermitido = (extension) => `Tipo de archivo no permitido: ${extension}`;
// Solo del navegador (spec 6: el servidor no rechaza nombres repetidos, los guarda con un nombre único en el disco)
const textoArchivoRepetido = (nombre) => `Ya hay un archivo llamado ${nombre}.`;

// La paleta de los proyectos (spec 6): 10 colores donde el ícono blanco se lee (contraste de 3:1 o más), en este orden
const PALETA = Object.freeze([
  ['#1A365D', 'Azul tinta'], ['#0950C6', 'Azul oscuro'], ['#3B82F6', 'Azul'], ['#2B7AB8', 'Celeste'], ['#0E7490', 'Petróleo'],
  ['#2E6B4C', 'Verde'], ['#F45000', 'Naranja'], ['#CC0066', 'Magenta'], ['#6D4BA8', 'Violeta'], ['#56677F', 'Gris']
].map(([color, nombre]) => Object.freeze({ color, nombre })));
const TEXTO_COLOR_ACTUAL = 'Color actual';

// El nombre de cada ícono, en castellano: el rótulo de su opción (los lectores de pantalla no leen el dibujo)
const NOMBRE_DEL_ICONO = Object.freeze({
  'bar-chart-3': 'Gráfico de barras', 'clipboard-list': 'Lista de tareas', database: 'Base de datos', 'file-text': 'Documento',
  shield: 'Escudo', globe: 'Mundo', users: 'Personas', 'building-2': 'Edificio', folder: 'Carpeta', code: 'Código',
  'book-open': 'Libro abierto', target: 'Objetivo', flag: 'Bandera', award: 'Premio', briefcase: 'Maletín', lock: 'Candado',
  eye: 'Ojo', zap: 'Rayo', lightbulb: 'Lamparita', 'file-search': 'Documento con lupa', 'pie-chart': 'Gráfico de torta',
  megaphone: 'Megáfono', calendar: 'Calendario', settings: 'Engranaje', mail: 'Sobre'
});
// El ícono de un proyecto nuevo (el de la maqueta) y el que dibuja iconoSvg para uno que no conoce
const ICONO_DE_UN_PROYECTO_NUEVO = 'folder';
const ICONO_DESCONOCIDO = 'clipboard-list';

// Los campos de cada formulario, con los nombres del servidor (los de `campo` en sus errores: { campo, mensaje }), y el id del
// control que recibe el foco y aria-invalid (en un grupo de opciones, su fieldset). El de su error es `${id}-error`
const CAMPOS_DEL_FORMULARIO = Object.freeze({
  proyecto: Object.freeze({
    nombre: 'p-nombre', descripcion: 'p-descripcion', estado: 'p-estado', prioridad: 'p-prioridad', categoria: 'p-categoria',
    fecha_inicio: 'p-fecha-inicio', responsable: 'p-responsable', enlace_externo: 'p-enlace-externo', color: 'p-color', icono: 'p-icono',
    areas: 'p-areas'
  }),
  hito: Object.freeze({ titulo: 'h-titulo', fecha: 'h-fecha', descripcion: 'h-descripcion', evidencia_url: 'h-evidencia-url' })
});

// --- La validación: la de validarProyecto y validarHito, campo por campo y en el mismo orden ---

const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;
// Lo mismo que Utils.esUrlSegura
const ENLACE_HTTP = /^https?:\/\//i;
// Un id de la base, como idPositivo del servidor: un entero positivo de hasta 10 cifras sin ceros adelante, como texto o como número
const ID_DE_LA_BASE = /^[1-9]\d{0,9}$/;

// Caracteres de un texto, como los cuenta el varchar de la base (no las unidades de UTF-16 de `length`: un emoji es uno)
const caracteresDe = (texto) => Array.from(texto).length;
// Un texto libre recortado, o null si está vacío; lo que no es un texto cuenta como vacío
const recortadoONulo = (valor) => {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto === '' ? null : texto;
};
// Vacío: no vino, null o un texto de espacios. Un campo con formato que trae otra cosa que no es un texto no está vacío: es un error
const esCampoVacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
// El texto recortado de un campo con formato, o null si no es un texto (que no va a pasar su formato)
const textoDeCampo = (valor) => (typeof valor === 'string' ? valor.trim() : null);
// Una fecha 'AAAA-MM-DD' que existe, exactamente así (como esFechaIso del servidor)
const esFechaDeTexto = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Utils.soloFecha(valor) === valor;
const esIdDeLaBase = (valor) => (typeof valor === 'string' || typeof valor === 'number') && ID_DE_LA_BASE.test(String(valor));

// El 31/12 de cinco años después del de hoy ('AAAA-12-31'), el tope de las fechas (copia de fechaMaxima del servidor: va también al
// max de los campos de fecha); null si hoy no es una fecha
function fechaMaxima(hoy) {
  if (!esFechaDeTexto(hoy)) return null;
  const anio = Number(hoy.slice(0, 4)) + 5;
  return anio > 9999 ? '9999-12-31' : `${anio}-12-31`;
}
// Una fecha entre el 01/01/2000 y fechaMaxima(hoy). Sin un hoy válido no pasa (no hay tope), como en el servidor
const fechaDentroDelRango = (fecha, hoy) => {
  const maxima = fechaMaxima(hoy);
  return esFechaDeTexto(fecha) && maxima !== null && fecha >= FECHA_MINIMA_PROYECTOS && fecha <= maxima;
};

// Cada regla recibe el valor crudo (y hoy) y devuelve el mensaje de su error, o null
const errorDeTextoObligatorio = (valor, largo, mensajeVacio, mensajeLargo) => {
  const texto = recortadoONulo(valor);
  if (texto === null) return mensajeVacio;
  return caracteresDe(texto) > largo ? mensajeLargo : null;
};
const errorDeTextoOpcional = (valor, largo, mensajeLargo) => {
  const texto = recortadoONulo(valor);
  return texto !== null && caracteresDe(texto) > largo ? mensajeLargo : null;
};
const errorDeEnlace = (valor, largo, mensajeEsquema, mensajeLargo) => {
  if (esCampoVacio(valor)) return null;
  const texto = textoDeCampo(valor);
  if (texto === null || !ENLACE_HTTP.test(texto)) return mensajeEsquema;
  return caracteresDe(texto) > largo ? mensajeLargo : null;
};
// Un valor con formato (el color, el ícono) o de una lista (estado, prioridad, categoría): vacío no es un error (en una lista, toma el
// valor por defecto, como en un proyecto nuevo del servidor)
const errorDeFormato = (valor, vale, mensaje) => {
  if (esCampoVacio(valor)) return null;
  const texto = textoDeCampo(valor);
  return texto !== null && vale(texto) ? null : mensaje;
};
const errorDeFecha = (valor, hoy, mensajeVacia, mensajeInvalida) => {
  if (esCampoVacio(valor)) return mensajeVacia;
  return fechaDentroDelRango(textoDeCampo(valor), hoy) ? null : mensajeInvalida;
};
// Las áreas: no vienen, null o una lista de ids (vacía es ninguna). Se recorre con Array.from, como el for…of del servidor: un hueco de
// una lista rala es un undefined, y es un error (every lo saltearía)
const errorDeAreas = (valor) => (valor === undefined || valor === null || (Array.isArray(valor) && Array.from(valor).every(esIdDeLaBase)) ? null : MENSAJES_PROYECTOS.areas);

// Los campos que pueden dar error, en el orden de los errores del servidor (la descripción nunca da)
const REGLAS_DEL_PROYECTO = Object.freeze([
  ['nombre', (valor) => errorDeTextoObligatorio(valor, LARGOS_PROYECTOS.nombre, MENSAJES_PROYECTOS.nombre, MENSAJES_PROYECTOS.nombreLargo)],
  ['estado', (valor) => errorDeFormato(valor, (texto) => ESTADOS.includes(texto), MENSAJES_PROYECTOS.estado)],
  ['prioridad', (valor) => errorDeFormato(valor, (texto) => PRIORIDADES.includes(texto), MENSAJES_PROYECTOS.prioridad)],
  ['categoria', (valor) => errorDeFormato(valor, (texto) => CATEGORIAS.includes(texto), MENSAJES_PROYECTOS.categoria)],
  ['fecha_inicio', (valor, hoy) => errorDeFecha(valor, hoy, null, MENSAJES_PROYECTOS.fechaInicio)],
  ['responsable', (valor) => errorDeTextoOpcional(valor, LARGOS_PROYECTOS.responsable, MENSAJES_PROYECTOS.responsable)],
  ['enlace_externo', (valor) => errorDeEnlace(valor, LARGOS_PROYECTOS.enlace, MENSAJES_PROYECTOS.enlace, MENSAJES_PROYECTOS.enlaceLargo)],
  ['color', (valor) => errorDeFormato(valor, (texto) => COLOR_HEX.test(texto), MENSAJES_PROYECTOS.color)],
  ['icono', (valor) => errorDeFormato(valor, (texto) => ICONOS.includes(texto), MENSAJES_PROYECTOS.icono)],
  ['areas', errorDeAreas]
]);
const REGLAS_DEL_HITO = Object.freeze([
  ['titulo', (valor) => errorDeTextoObligatorio(valor, LARGOS_PROYECTOS.titulo, MENSAJES_PROYECTOS.titulo, MENSAJES_PROYECTOS.tituloLargo)],
  ['fecha', (valor, hoy) => errorDeFecha(valor, hoy, MENSAJES_PROYECTOS.fecha, MENSAJES_PROYECTOS.fechaInvalida)],
  ['evidencia_url', (valor) => errorDeEnlace(valor, LARGOS_PROYECTOS.evidencia, MENSAJES_PROYECTOS.evidencia, MENSAJES_PROYECTOS.evidenciaLarga)]
]);

const erroresDe = (reglas, valores, hoy) => {
  const fuente = esObjeto(valores) ? valores : {};
  const errores = [];
  for (const [campo, regla] of reglas) {
    const mensaje = regla(Object.hasOwn(fuente, campo) ? fuente[campo] : undefined, hoy);
    if (mensaje) errores.push({ campo, mensaje });
  }
  return errores;
};

// Los errores de un proyecto (los valores del formulario, con los nombres del servidor: los de valoresDelProyecto) contra hoy
// ('AAAA-MM-DD'): [{ campo, mensaje }], los mismos y en el mismo orden que validarProyecto(valores, { hoy }).errores (el alta: un
// estado, una prioridad o una categoría vacíos toman el de entrada). Sin un hoy válido, una fecha cargada no pasa. [] si vale
function erroresDelProyecto(valores, hoy) {
  return erroresDe(REGLAS_DEL_PROYECTO, valores, hoy);
}

// Los errores de un hito o un logro ({ titulo, fecha, descripcion, evidencia_url }) contra hoy: los de validarHito(valores, { hoy })
function erroresDelHito(valores, hoy) {
  return erroresDe(REGLAS_DEL_HITO, valores, hoy);
}

// --- Los archivos ---

// La extensión de un nombre, en minúsculas, como la lee el servidor (path.extname: desde el último punto del nombre; sin punto, o
// solo con el del principio de un nombre como «.pdf», no hay extensión)
const extensionDelNombre = (nombre) => {
  const base = String(nombre ?? '').split('/').pop();
  const punto = base.lastIndexOf('.');
  return punto <= 0 || base === '..' ? '' : base.slice(punto).toLowerCase();
};
// Un nombre para compararlo: el mismo texto aunque llegue con otra normalización (macOS entrega «ó» como «o» + tilde)
const nombreComparable = (nombre) => String(nombre ?? '').normalize('NFC');

// El problema de un archivo elegido (`archivo`: un File, { name, size }) antes de enviarlo, o null si se puede sumar. `tipo`: 'hito'
// (hasta 3) o 'proyecto' (hasta 10 documentos; otro valor cuenta como hito, el límite más chico); `existentes`, los nombres de los
// que ya tiene el hito o el proyecto, y `elegidos`, los de la misma tanda. Controla, en este orden y con los mensajes del servidor, la
// extensión, los 10 MB y la cantidad (existentes + elegidos + este); y después, solo en el navegador, los repetidos: «Ya hay un
// archivo llamado <nombre>.». Es texto, no HTML: la página lo pone con textContent
function problemaDeArchivo(archivo, opciones) {
  const { name, size } = esObjeto(archivo) ? archivo : {};
  const nombre = typeof name === 'string' ? name : '';
  const { tipo, existentes, elegidos } = esObjeto(opciones) ? opciones : {};
  const delProyecto = tipo === 'proyecto';
  const extension = extensionDelNombre(nombre);
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) return mensajeTipoNoPermitido(extension);
  if (!(typeof size === 'number' && size >= 0 && size <= TAMANO_MAXIMO)) return MENSAJE_TAMANO_MAXIMO;
  const ya = comoLista(existentes);
  const tanda = comoLista(elegidos);
  if (ya.length + tanda.length + 1 > (delProyecto ? MAXIMO_POR_PROYECTO : MAXIMO_POR_HITO)) {
    return delProyecto ? MENSAJE_MAXIMO_POR_PROYECTO : MENSAJE_MAXIMO_POR_HITO;
  }
  const buscado = nombreComparable(nombre);
  return [...ya, ...tanda].some((otro) => nombreComparable(otro) === buscado) ? textoArchivoRepetido(nombre) : null;
}

// Los archivos elegidos que todavía no se subieron (spec 6), cada uno con su extensión, su nombre, su tamaño y la × que lo quita
// (data-quitar: su lugar en `archivos`, la lista de File). '' sin ninguno
function htmlDePendientes(archivos) {
  const filas = comoLista(archivos).map((archivo, indice) => {
    if (!esObjeto(archivo)) return '';
    const nombre = String(archivo.name ?? '');
    const tamano = tamanoDeArchivo(archivo.size);
    return `<li class="pr-archivo"><span class="pr-ext" aria-hidden="true">${esc(extensionDe(nombre))}</span>`
      + `<span><span class="n">${esc(nombre)}</span>${tamano ? `<small>${esc(tamano)}</small>` : ''}</span>`
      + `<span class="acc"><button type="button" class="pr-quitar" data-quitar="${indice}" aria-label="${esc(`Quitar ${nombre}`)}">&times;</button></span></li>`;
  }).join('');
  return filas ? `<ul class="pr-archivos pr-pendientes" aria-label="Archivos para subir">${filas}</ul>` : '';
}

// La vista previa de un archivo (spec 6, «Ver»): la imagen en un <img> y el PDF en un <iframe>, solo desde un blob: (la CSP lo
// permite; lo arma la parte del DOM con lo que bajó API.pedirArchivo). '' con otra dirección o con otro tipo
function htmlDeVistaPrevia(url, archivo) {
  if (typeof url !== 'string' || !/^blob:/i.test(url)) return '';
  const { nombre, mime } = esObjeto(archivo) ? archivo : {};
  if (!sePuedeVer(mime)) return '';
  return /^image\//i.test(mime)
    ? `<img src="${esc(url)}" alt="${esc(nombre)}">`
    : `<iframe src="${esc(url)}" title="${esc(nombre)}"></iframe>`;
}

// --- Los formularios ---

// El texto de un dato (lo que no es un texto, '')
const textoDelDato = (valor) => (typeof valor === 'string' ? valor : '');

// Lo que precarga el formulario del proyecto (spec 6), con los nombres del servidor: el de `proyecto` o, sin él (null), uno nuevo
// (Idea, Media, Tecnología, el azul tinta y la carpeta). La fecha, como texto 'AAAA-MM-DD' (o ''); las áreas, como ids de texto. El
// color se conserva tal cual (también uno fuera de la paleta o en minúsculas: guardar sin tocarlo no lo cambia); uno que no es
// #RRGGBB, y el ícono que no está, son los que dibuja la lista para ellos (el azul tinta y clipboard-list)
function valoresDelProyecto(proyecto) {
  const p = esObjeto(proyecto) ? proyecto : null;
  const deLaLista = (valor, lista, porDefecto) => (lista.includes(valor) ? valor : porDefecto);
  const areas = comoLista(p?.areas).map((area) => idEntero(esObjeto(area) ? area.id : area)).filter((id) => id !== null);
  return {
    nombre: textoDelDato(p?.nombre),
    descripcion: textoDelDato(p?.descripcion),
    estado: deLaLista(p?.estado, ESTADOS, 'idea'),
    prioridad: deLaLista(p?.prioridad, PRIORIDADES, 'media'),
    categoria: deLaLista(p?.categoria, CATEGORIAS, 'tecnologia'),
    fecha_inicio: Utils.soloFecha(p?.fecha_inicio) ?? '',
    responsable: textoDelDato(p?.responsable),
    enlace_externo: textoDelDato(p?.enlace_externo),
    color: p ? colorDelProyecto(p) : COLOR_POR_DEFECTO,
    icono: p ? deLaLista(p.icono, ICONOS, ICONO_DESCONOCIDO) : ICONO_DE_UN_PROYECTO_NUEVO,
    areas: [...new Set(areas)]
  };
}

// Lo que precarga el formulario de un hito o un logro: el de `hito` o, sin él, uno nuevo con la fecha de hoy (`hoy`; si no sirve, el
// de hoy en Argentina). La fecha, como texto 'AAAA-MM-DD'
function valoresDelHito(hito, hoy) {
  const h = esObjeto(hito) ? hito : null;
  return {
    titulo: textoDelDato(h?.titulo),
    fecha: h ? (Utils.soloFecha(h.fecha) ?? '') : hoyDe(hoy),
    descripcion: textoDelDato(h?.descripcion),
    evidencia_url: textoDelDato(h?.evidencia_url)
  };
}

// Los textos del modal del proyecto: «Nuevo proyecto» o «Editar <nombre>», y el botón. Texto, no HTML (van con textContent)
function textosDelModalDeProyecto(proyecto) {
  return {
    titulo: esObjeto(proyecto) ? `Editar ${textoLimpio(proyecto.nombre)}` : 'Nuevo proyecto',
    boton: 'Guardar el proyecto'
  };
}

// Los textos del modal de un hito o un logro (spec 6): el título («Nuevo hito», «Editar el hito», «Registrar un logro del área» o
// «Editar el logro»), de quién es («Del proyecto X. …» o «Un logro que no es parte de un proyecto. …») y el botón. Es un logro el hito
// sin proyecto o, sin hito, si no hay `proyecto`. El nombre del proyecto, el de `proyecto` o el que trae el hito de la línea de tiempo.
// Texto, no HTML (van con textContent)
function textosDelModalDeHito(opciones) {
  const { proyecto, hito } = esObjeto(opciones) ? opciones : {};
  const h = esObjeto(hito) ? hito : null;
  const logro = h ? esLogro(h) : !esObjeto(proyecto);
  const nombre = textoLimpio(esObjeto(proyecto) ? proyecto.nombre : h?.proyecto_nombre);
  const sale = 'Sale en el Informe anual del año de su fecha.';
  return {
    titulo: logro ? (h ? 'Editar el logro' : 'Registrar un logro del área') : (h ? 'Editar el hito' : 'Nuevo hito'),
    de: logro ? `Un logro que no es parte de un proyecto. ${sale}` : `Del proyecto${nombre ? ` ${nombre}` : ''}. ${sale}`,
    boton: logro ? 'Guardar el logro' : 'Guardar el hito',
    logro
  };
}

// Los colores del proyecto (spec 6), como opciones de radio (name="p-color"): los 10 de la paleta y, si `actual` es un #RRGGBB que no
// está en ella, primero «Color actual», elegido (nada se cambia solo). La opción elegida lleva el color tal cual llegó, también uno de
// la paleta escrito en minúsculas. Lo que no es #RRGGBB nunca llega al style: es el azul tinta, el que dibuja la lista
function htmlDeColores(actual) {
  const elegido = typeof actual === 'string' && COLOR_HEX.test(actual) ? actual : COLOR_POR_DEFECTO;
  const esElElegido = (color) => color.toLowerCase() === elegido.toLowerCase();
  const opciones = PALETA.some(({ color }) => esElElegido(color)) ? PALETA : [{ color: elegido, nombre: TEXTO_COLOR_ACTUAL }, ...PALETA];
  return opciones.map(({ color, nombre }) => {
    const valor = esElElegido(color) ? elegido : color;
    return `<label class="pr-color" style="--c:${esc(valor)}" title="${esc(nombre)}"><input type="radio" name="p-color" value="${esc(valor)}" aria-label="${esc(nombre)}" aria-describedby="p-color-error"${esElElegido(color) ? ' checked' : ''}></label>`;
  }).join('');
}

// Los 25 íconos (spec 6), como opciones de radio (name="p-icono"), cada uno con su nombre en castellano y su dibujo (decorativo). Elige
// `actual` o, si no está, el que dibuja la lista para un ícono que no conoce (clipboard-list)
function htmlDeIconos(actual) {
  const elegido = ICONOS.includes(actual) ? actual : ICONO_DESCONOCIDO;
  return ICONOS.map((clave) => {
    const nombre = NOMBRE_DEL_ICONO[clave];
    return `<label class="pr-icono" title="${esc(nombre)}"><input type="radio" name="p-icono" value="${esc(clave)}" aria-label="${esc(nombre)}" aria-describedby="p-icono-error"${clave === elegido ? ' checked' : ''}>${iconoSvg(clave)}</label>`;
  }).join('');
}

// Las áreas del proyecto (spec 6), casillas con desplazamiento (name="p-areas"): una por área de `areas` (las de GET /api/areas,
// { id, nombre }), marcadas las de `elegidas` (ids, como los de valoresDelProyecto). Sin áreas, lo dice
function htmlDeAreas(areas, elegidas) {
  const marcadas = new Set(comoLista(elegidas).map(idEntero).filter((id) => id !== null));
  const filas = comoLista(areas).filter(esObjeto).map((area) => ({ id: idEntero(area.id), nombre: area.nombre })).filter(({ id }) => id !== null);
  if (!filas.length) return '<p class="pr-vacio">No hay áreas cargadas.</p>';
  return filas.map(({ id, nombre }) => `<label class="pr-area"><input type="checkbox" name="p-areas" value="${id}" aria-describedby="p-areas-error"${marcadas.has(id) ? ' checked' : ''}>${esc(nombre)}</label>`).join('');
}

// La muestra de cómo se ve el cuadrado en la lista (spec 6): el cuadrado grande con el color y el ícono de `valores` y el nombre (sin
// nombre, «Así se ve en la lista»)
function htmlDeMuestra(valores) {
  const v = esObjeto(valores) ? valores : {};
  return `${htmlDelCuadrado({ color: v.color, icono: v.icono }, 'grande')}<span class="pr-muestra-texto"><b>${esc(textoLimpio(v.nombre) || 'Así se ve en la lista')}</b>`
    + '<small>El color y el ícono identifican al proyecto en la lista y en la línea de tiempo.</small></span>';
}

// --- Las confirmaciones (spec 6) ---

// El texto del modal de confirmación (spec 6), con la concordancia resuelta. `tipo` y `datos`:
// - 'proyecto', el proyecto como lo manda la API: el detalle (con sus listas `hitos` y `documentos`) o el de la lista (con
//   `cantidad_hitos` y `cantidad_documentos`), contados con cantidadDe, como la ficha: «¿Eliminar el proyecto X? Deja de verse en la
//   lista, en la línea de tiempo y en el Informe anual, con 5 hitos y 2 documentos.» (solo lo que tiene; sin ninguno, termina en
//   «Informe anual.»);
// - 'hito' o 'logro', el hito con su lista `archivos`: «¿Eliminar el hito X?», con « Se borra también su archivo.» o « Se borran
//   también sus N archivos.» si tiene;
// - 'archivo', { nombre }: «¿Eliminar X?».
// Texto, no HTML: va con textContent. '' con otro tipo
function textoDeConfirmacion(tipo, datos) {
  const d = esObjeto(datos) ? datos : {};
  if (tipo === 'proyecto') {
    const hitos = cantidadDe(d.hitos, d.cantidad_hitos);
    const documentos = cantidadDe(d.documentos, d.cantidad_documentos);
    const con = [hitos ? plural(hitos, 'hito', 'hitos') : '', documentos ? plural(documentos, 'documento', 'documentos') : ''].filter(Boolean);
    return `¿Eliminar el proyecto ${textoLimpio(d.nombre)}? Deja de verse en la lista, en la línea de tiempo y en el Informe anual${con.length ? `, con ${con.join(' y ')}` : ''}.`;
  }
  if (tipo === 'hito' || tipo === 'logro') {
    const archivos = cantidadDe(d.archivos);
    const tambien = archivos === 1 ? ' Se borra también su archivo.' : (archivos > 1 ? ` Se borran también sus ${archivos} archivos.` : '');
    return `¿Eliminar el ${tipo} ${textoLimpio(d.titulo)}?${tambien}`;
  }
  if (tipo === 'archivo') return `¿Eliminar ${textoLimpio(d.nombre)}?`;
  return '';
}

// =====================================================
// Lo puro de la página: las pestañas, el detalle, los archivos y las subidas
// =====================================================

// Las cantidades de las pestañas (spec 1): los proyectos activos (los que manda la API), todos los hitos (los mismos que cuenta el chip
// «Todos» de la línea de tiempo) y los logros del área
function cantidadesDeLasPestanas(proyectos, hitos) {
  return {
    proyectos: comoLista(proyectos).filter(esObjeto).length,
    linea: hitosConFecha(hitos).length,
    logros: comoLista(hitos).filter(esObjeto).filter(esLogro).length
  };
}

// El título de la ventana en el detalle (spec 3): «<nombre> - Proyectos - RPAD». Texto, no HTML (va a document.title)
function tituloDelDetalle(proyecto) {
  return `${textoLimpio(esObjeto(proyecto) ? proyecto.nombre : '') || 'Proyecto'} - Proyectos - RPAD`;
}

// El link a la lista desde un estado del detalle (con los filtros de la lista)
const htmlDelLinkALaLista = (estado, hoy) =>
  `<p><a class="pr-volver" href="${esc(`proyectos.html${urlDeEstado(estado, hoy)}`)}">Ver todos los proyectos</a></p>`;

// El detalle que no se encontró (spec 3): un id que no es un entero positivo, que no existe o de un proyecto dado de baja. Con su h2 y
// el link a la lista (la página conserva su h1 «Proyectos»)
function htmlDeNoEncontrado(estado, hoy) {
  return '<div class="pr-estado"><h2>Proyecto no encontrado</h2><p>No hay ningún proyecto con ese número.</p>'
    + `${htmlDelLinkALaLista(estado, hoy)}</div>`;
}

// El detalle que no se pudo cargar (spec 3), con su h2
function htmlDeErrorDelDetalle(estado, hoy) {
  return '<div class="pr-estado pr-error" role="alert"><h2>No se pudo cargar el proyecto</h2><p>Probá de nuevo en unos minutos.</p>'
    + `${htmlDelLinkALaLista(estado, hoy)}</div>`;
}

// La dirección de la API de un archivo (`base`, la de su lista, de los data-* de htmlDeArchivos, y su id): solo la de los archivos de un
// hito o la de los documentos de un proyecto, con ids enteros positivos; null si no
function rutaDelArchivo(base, id) {
  const archivo = idEntero(id);
  const valida = typeof base === 'string' && /^\/gestion\/(?:hitos\/[1-9]\d*\/archivos|proyectos\/[1-9]\d*\/documentos)$/.test(base);
  return valida && archivo ? `${base}/${archivo}` : null;
}

// El aviso de un hito (o un logro) que se guardó con archivos que no se subieron (spec 6): «El hito se guardó, pero los archivos no se
// subieron: <motivo>.» (el motivo, el mensaje del servidor, sin su punto final). Texto, no HTML (va con textContent)
function textoDeSubidaFallida(logro, motivo) {
  const razon = String(motivo ?? '').trim().replace(/[.\s]+$/, '') || 'no se pudo conectar con el servidor';
  return `${logro === true ? 'El logro' : 'El hito'} se guardó, pero los archivos no se subieron: ${razon}.`;
}

// Los problemas de los archivos elegidos, en un solo texto: cada uno termina en punto
function textoDeProblemas(problemas) {
  return comoLista(problemas).map((texto) => String(texto ?? '').trim()).filter(Boolean)
    .map((texto) => (/[.!?]$/.test(texto) ? texto : `${texto}.`)).join(' ');
}

// El aviso de un guardado que salió bien: los mensajes del servidor (el del hito y el de la subida), unidos
function textoDeGuardado(...mensajes) {
  return mensajes.map((texto) => String(texto ?? '').trim().replace(/\.+$/, '')).filter(Boolean).join('. ');
}

// =====================================================
// La página (DOM y API)
// =====================================================

// Todos los roles con sesión la ven; sin sesión, al login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  iniciarProyectos();
});

// El estado de la página. `pedido` numera las cargas: una respuesta que llega después de otra más nueva se descarta
const pagina = {
  hoy: '', esAdmin: false, modo: 'lista', pedido: 0,
  // La lista: los proyectos y los hitos del timeline, los años con hitos, lo elegido, la pestaña, el filtro de la línea de tiempo y si
  // los filtros la dejaron vacía
  proyectos: [], hitos: [], extremos: null, estado: null, pestana: PESTANAS[0], filtroLinea: 'todos', vacio: false,
  // El ancho de una pista de los carriles, medido en el DOM
  anchoPx: ANCHO_DE_PISTA_POR_DEFECTO,
  // El detalle: el id, el proyecto y lo elegido en la lista (de la dirección del detalle)
  idDetalle: null, detalle: null, estadoDelDetalle: null,
  // Las áreas del formulario del proyecto (GET /areas, una vez): null hasta que llegan
  areas: null
};
// El modal abierto (uno a la vez): su id, el botón que lo abrió (y cómo encontrarlo si se volvió a dibujar) y qué hacer al cerrarlo
let modalAbierto = null;
// Cada apertura de un formulario o de una confirmación es un objeto nuevo: una respuesta que llega con otro abierto no lo toca
let formProyecto = null;
let formHito = null;
let confirmacion = null;
// Adónde va lo elegido en el selector de archivos de la página («Subir documentos», «Subir archivos» de un hito)
let subidaDirecta = null;
let temporizadorDeMedida = null;
// El pedido de las áreas del formulario del proyecto, mientras está en camino
let promesaDeAreas = null;

const porId = (id) => document.getElementById(id);
const MODALES = Object.freeze(['modal-proyecto', 'modal-hito', 'modal-confirmar', 'modal-vista-previa']);
const ESTADOS_DE_LA_PAGINA = Object.freeze({ cargando: 'pr-cargando', error: 'pr-error', lista: 'pr-vista-lista', detalle: 'pr-vista-detalle' });
// Los grupos de opciones del formulario del proyecto: el error va al grupo (role="radiogroup") y el foco, a la opción elegida
const GRUPOS_DE_OPCIONES = Object.freeze(['estado', 'color', 'icono']);
const TEXTO_SIN_RESULTADOS = 'Ningún proyecto coincide con lo que buscaste.';

// Deshabilita el botón mientras dura el pedido (como en seguimiento.js)
const conBotonBloqueado = async (boton, tarea) => {
  if (boton) boton.disabled = true;
  try {
    await tarea();
  } finally {
    if (boton) boton.disabled = false;
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

// La región viva de la página (#pr-anuncio, fuera de lo que se vuelve a dibujar): lo que se anuncia a los lectores de pantalla. Un
// texto igual al anterior se cambia apenas (un espacio duro al final), para que se vuelva a anunciar
function anunciar(texto) {
  const region = porId('pr-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto}\u00A0` : texto;
}

// Los avisos de la página (Utils.showSuccess y Utils.showError escapan el texto), también anunciados
function avisarExito(mensaje) {
  if (!mensaje) return;
  Utils.showSuccess(mensaje);
  anunciar(mensaje);
}
function avisarError(mensaje) {
  if (!mensaje) return;
  Utils.showError(mensaje);
  anunciar(mensaje);
}

// La sesión venció (401) en cualquier pedido: se cierra y al login. API.pedirArchivo no dice el estado: ahí cuenta un token vencido
function esSesionVencida(error) {
  return error?.status === 401;
}
function esSesionVencidaEnArchivo(error) {
  return esSesionVencida(error) || (typeof Auth.isTokenExpired === 'function' && Auth.isTokenExpired() === true);
}
function irAlLogin() {
  if (typeof Auth.clearSession === 'function') Auth.clearSession();
  window.location.href = 'login.html';
}

// El mensaje de un error del servidor; sin respuesta (sin conexión), uno propio
function mensajeDeFalla(error) {
  if (error?.status) return error.message || `Error ${error.status}`;
  return 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';
}

// =====================================================
// El arranque, las cargas y los estados
// =====================================================

// Sin ?id=, la lista (las tres pestañas); con ?id=N, el detalle de ese proyecto (un id que no es un entero positivo, el no encontrado,
// sin pedirlo). Devuelve la carga, para quien quiera esperarla
function iniciarProyectos() {
  pagina.hoy = Utils.hoyEnArgentina();
  pagina.esAdmin = typeof Auth.isAdmin === 'function' && Auth.isAdmin() === true;
  conectarEventos();
  const search = String(window.location.search ?? '');
  const parametros = new URLSearchParams(search.replace(/^\?/, ''));
  if (parametros.has('id')) {
    pagina.modo = 'detalle';
    pagina.estadoDelDetalle = estadoDelDetalle(search, pagina.hoy);
    porId('pr-nuevo').hidden = true;
    pagina.idDetalle = idEntero(parametros.get('id'));
    if (pagina.idDetalle === null) {
      mostrarNoEncontrado();
      return Promise.resolve();
    }
    return cargarDetalle();
  }
  pagina.modo = 'lista';
  porId('pr-nuevo').hidden = !pagina.esAdmin;
  // El link viejo de las métricas (gestion.html#metricas llega por la redirección): el aviso, y abre Proyectos
  porId('pr-aviso-metricas').hidden = window.location.hash !== '#metricas';
  pagina.pestana = pestanaDeHash(window.location.hash);
  return cargarLista({ inicial: true });
}

// Uno de los estados de la página a la vez: cargando, el error, la lista o el detalle
function mostrarEstado(cual) {
  for (const [nombre, id] of Object.entries(ESTADOS_DE_LA_PAGINA)) {
    const elemento = porId(id);
    if (elemento) elemento.hidden = nombre !== cual;
  }
}

// GET /gestion/proyectos y /gestion/timeline, en paralelo. La primera vez, «Cargando…» y lo elegido de la dirección; después (al volver
// a pedir la vista), sin «Cargando…» y con lo elegido de siempre. El dibujo va dentro del mismo try: si un dato raro lo rompe, queda el
// error y no «Cargando…» para siempre
async function cargarLista({ inicial = false } = {}) {
  const pedido = ++pagina.pedido;
  if (inicial) {
    porId('pr-cargando').textContent = 'Cargando los proyectos…';
    mostrarEstado('cargando');
  }
  try {
    const [deProyectos, deHitos] = await Promise.all([API.pedirJson('GET', '/gestion/proyectos'), API.pedirJson('GET', '/gestion/timeline')]);
    if (pedido !== pagina.pedido) return;
    const proyectos = deProyectos?.data;
    const hitos = deHitos?.data;
    if (!Array.isArray(proyectos) || !Array.isArray(hitos)) throw new TypeError('La respuesta no es la lista de proyectos');
    pagina.proyectos = proyectos;
    pagina.hitos = hitos;
    pagina.extremos = extremosDeAnios(proyectos, hitos, pagina.hoy);
    pagina.estado = inicial || !pagina.estado
      ? estadoDeLaLista(String(window.location.search ?? ''), pagina.hoy, pagina.extremos)
      : estadoConVentana(pagina.estado, pagina.extremos);
    pagina.vacio = proyectos.length > 0 && filtrarProyectos(proyectos, pagina.estado).length === 0;
    pagina.modo = 'lista';
    mostrarEstado('lista');
    dibujarLista();
    mostrarPestana(pagina.pestana);
    medirLaPista();
  } catch (error) {
    if (pedido !== pagina.pedido) return;
    if (esSesionVencida(error)) {
      irAlLogin();
      return;
    }
    console.error('Error cargando los proyectos:', error);
    if (inicial) mostrarEstado('error');
    else avisarError('No se pudieron volver a cargar los proyectos. Probá de nuevo en unos minutos.');
  }
}

// GET /gestion/proyectos/N. Un 404 es el no encontrado; otro error, el error del detalle (al volver a pedirlo, un aviso)
async function cargarDetalle({ recarga = false } = {}) {
  const pedido = ++pagina.pedido;
  if (!recarga) {
    porId('pr-cargando').textContent = 'Cargando el proyecto…';
    mostrarEstado('cargando');
  }
  try {
    const proyecto = (await API.pedirJson('GET', `/gestion/proyectos/${pagina.idDetalle}`))?.data;
    if (pedido !== pagina.pedido) return;
    if (!esObjeto(proyecto) || idEntero(proyecto.id) === null) throw new TypeError('La respuesta no es un proyecto');
    pagina.detalle = proyecto;
    mostrarEstado('detalle');
    dibujarDetalle();
  } catch (error) {
    if (pedido !== pagina.pedido) return;
    if (esSesionVencida(error)) {
      irAlLogin();
      return;
    }
    if (error?.status === 404) {
      mostrarNoEncontrado();
      return;
    }
    console.error('Error cargando el proyecto:', error);
    if (recarga) avisarError('No se pudo volver a cargar el proyecto. Probá de nuevo en unos minutos.');
    else mostrarErrorDelDetalle();
  }
}

function mostrarNoEncontrado() {
  pagina.detalle = null;
  porId('pr-vista-detalle').innerHTML = htmlDeNoEncontrado(pagina.estadoDelDetalle, pagina.hoy);
  mostrarEstado('detalle');
  document.title = 'Proyecto no encontrado - Proyectos - RPAD';
}

function mostrarErrorDelDetalle() {
  porId('pr-vista-detalle').innerHTML = htmlDeErrorDelDetalle(pagina.estadoDelDetalle, pagina.hoy);
  mostrarEstado('detalle');
  document.title = 'No se pudo cargar el proyecto - Proyectos - RPAD';
}

// Después de guardar, subir o borrar: la vista otra vez, sin «Cargando…» (lo nuevo se ve sin recargar la página)
function recargarVista() {
  return pagina.modo === 'detalle' ? cargarDetalle({ recarga: true }) : cargarLista();
}

// =====================================================
// El dibujo, con el foco y las filas abiertas conservados
// =====================================================

const esSeguroParaSelector = (texto) => typeof texto === 'string' && /^[\w\-/]*$/.test(texto);
// Los botones que se reconocen por un data-* con su id (los de la ficha, los hitos, los documentos y los logros)
const ATRIBUTOS_DE_FOCO = Object.freeze(['data-editar-proyecto', 'data-eliminar-proyecto', 'data-nuevo-hito', 'data-editar-hito',
  'data-subir-archivos', 'data-eliminar-hito', 'data-subir-documentos', 'data-nuevo-logro', 'data-limpiar', 'data-ir-a']);

// Cómo volver a encontrar `elemento` en el HTML que se vuelve a dibujar: { selector, otro (la otra flecha, si esta quedó deshabilitada),
// inicio y fin (el cursor del buscador) }, o null
function descriptorDeFoco(elemento) {
  if (!elemento || typeof elemento.getAttribute !== 'function') return null;
  const valor = (nombre) => elemento.getAttribute(nombre);
  if (elemento.id === 'pr-buscar') {
    return { selector: '#pr-buscar', inicio: elemento.selectionStart ?? null, fin: elemento.selectionEnd ?? null };
  }
  const grupo = valor('data-grupo');
  if (grupo !== null) {
    const opcion = valor('data-valor');
    return esSeguroParaSelector(grupo) && esSeguroParaSelector(opcion) ? { selector: `button[data-grupo="${grupo}"][data-valor="${opcion}"]` } : null;
  }
  const paso = valor('data-correr');
  if (paso === '-1' || paso === '1') return { selector: `button[data-correr="${paso}"]`, otro: `button[data-correr="${paso === '1' ? '-1' : '1'}"]` };
  const archivo = valor('data-archivo');
  if (archivo !== null) {
    const base = valor('data-base');
    const id = valor('data-id');
    return [archivo, base, id].every(esSeguroParaSelector) ? { selector: `button[data-archivo="${archivo}"][data-base="${base}"][data-id="${id}"]` } : null;
  }
  for (const nombre of ATRIBUTOS_DE_FOCO) {
    const dato = valor(nombre);
    if (dato !== null) return esSeguroParaSelector(dato) ? { selector: `[${nombre}="${dato}"]` } : null;
  }
  const controla = valor('aria-controls');
  if (controla !== null && elemento.classList?.contains('pr-fila')) {
    return esSeguroParaSelector(controla) ? { selector: `button.pr-fila[aria-controls="${controla}"]` } : null;
  }
  const href = valor('href');
  if (href !== null && elemento.classList?.contains('pr-carril') && !/["\\]/.test(href)) return { selector: `a.pr-carril[href="${href}"]` };
  return null;
}

// Pone el foco en lo que describe `descriptor` dentro de `contenedor` (una flecha que quedó deshabilitada, en la otra; el buscador, con
// el cursor donde estaba). true si lo encontró
function restaurarFoco(contenedor, descriptor) {
  if (!descriptor) return false;
  let destino = contenedor.querySelector(descriptor.selector);
  if (destino?.disabled && descriptor.otro) destino = contenedor.querySelector(descriptor.otro);
  if (!destino || destino.disabled) return false;
  destino.focus();
  if (descriptor.inicio !== undefined && descriptor.inicio !== null && typeof destino.setSelectionRange === 'function') {
    destino.setSelectionRange(descriptor.inicio, descriptor.fin ?? descriptor.inicio);
  }
  return true;
}

// Vuelve a dibujar `contenedor` con `html`: las filas que estaban abiertas siguen abiertas, y el foco vuelve al control que se usó
// (`foco`: un elemento o un selector) o, si no, al que lo tenía adentro del contenedor; si ya no está, a `respaldo()`
function redibujar(contenedor, html, { foco = null, respaldo = null } = {}) {
  const activo = document.activeElement;
  const adentro = Boolean(activo) && activo !== contenedor && typeof contenedor.contains === 'function' && contenedor.contains(activo);
  const usado = foco ?? (adentro ? activo : null);
  const descriptor = typeof usado === 'string' ? { selector: usado } : descriptorDeFoco(usado);
  const abiertas = Array.from(contenedor.querySelectorAll('button.pr-fila[aria-expanded="true"]'))
    .map((cabeza) => cabeza.getAttribute('aria-controls')).filter(esSeguroParaSelector);
  contenedor.innerHTML = html;
  for (const id of abiertas) {
    const cabeza = contenedor.querySelector(`button.pr-fila[aria-controls="${id}"]`);
    const cuerpo = cabeza ? porId(id) : null;
    if (!cuerpo) continue;
    cabeza.setAttribute('aria-expanded', 'true');
    cuerpo.hidden = false;
  }
  if (usado && !restaurarFoco(contenedor, descriptor)) respaldo?.()?.focus?.();
}

// El lugar del foco cuando el control que se usó ya no está: en el detalle, «Ver todos los proyectos»; en la lista, la pestaña elegida
function lugarDeRespaldo() {
  return pagina.modo === 'detalle' ? porId('pr-vista-detalle').querySelector('a.pr-volver') : porId(`tab-${pagina.pestana}`);
}

function dibujarLista() {
  dibujarProyectos();
  dibujarLinea();
  dibujarLogros();
  const cantidades = cantidadesDeLasPestanas(pagina.proyectos, pagina.hitos);
  for (const nombre of PESTANAS) porId(`cnt-${nombre}`).textContent = String(cantidades[nombre]);
}

// La pestaña Proyectos: los filtros (con sus cantidades y los hitos de cada año) y los carriles. Sin ningún proyecto, solo el vacío
function dibujarProyectos(opciones = {}) {
  const { proyectos, hitos, estado, extremos, hoy, anchoPx, esAdmin } = pagina;
  const filtros = proyectos.length ? htmlDeFiltros(estado, cantidadesDeFiltros(proyectos, estado, hitos), ventanaDe(estado.anios, extremos)) : '';
  redibujar(porId('panel-proyectos'), filtros + htmlDeCarriles(proyectos, hitos, { estado, hoy, anchoPx, esAdmin }), { respaldo: lugarDeRespaldo, ...opciones });
}

function dibujarLinea(opciones = {}) {
  const { hitos, filtroLinea, hoy, esAdmin, estado, extremos } = pagina;
  redibujar(porId('panel-linea'), htmlDeLinea(hitos, { filtro: filtroLinea, hoy, esAdmin, estado: conAniosDeEntrada(estado, extremos, hoy) }),
    { respaldo: lugarDeRespaldo, ...opciones });
}

function dibujarLogros() {
  redibujar(porId('panel-logros'), htmlDeLogros(pagina.hitos, { esAdmin: pagina.esAdmin, hoy: pagina.hoy }), { respaldo: lugarDeRespaldo });
}

function dibujarDetalle() {
  const contenedor = porId('pr-vista-detalle');
  redibujar(contenedor, htmlDeDetalle(pagina.detalle, { esAdmin: pagina.esAdmin, hoy: pagina.hoy, estado: pagina.estadoDelDetalle }), {
    respaldo: () => contenedor.querySelector('a.pr-volver')
  });
  document.title = tituloDelDetalle(pagina.detalle);
}

// Lo elegido en la lista queda en la dirección, sin sumar una entrada al historial (la pestaña Proyectos va sin fragmento)
function escribirLaUrl() {
  if (pagina.modo !== 'lista' || !pagina.estado) return;
  const fragmento = pagina.pestana === PESTANAS[0] ? '' : `#${pagina.pestana}`;
  window.history?.replaceState?.(null, '', `${window.location.pathname ?? ''}${urlDeLaLista(pagina.estado, pagina.extremos, pagina.hoy)}${fragmento}`);
}

// ---- El ancho de la pista: la función que junta los puntos es pura y recibe el ancho, que se mide acá ----

function medirLaPista() {
  if (pagina.modo !== 'lista' || pagina.pestana !== PESTANAS[0] || !pagina.estado) return;
  const pista = porId('panel-proyectos').querySelector('.pr-pista');
  const ancho = Math.round(Number(typeof pista?.getBoundingClientRect === 'function' ? pista.getBoundingClientRect().width : 0));
  if (!(ancho > 0) || ancho === pagina.anchoPx) return;
  pagina.anchoPx = ancho;
  dibujarProyectos();
}

// Con un pequeño retardo: una ventana que se arrastra no vuelve a dibujar los carriles en cada paso
function programarMedida() {
  clearTimeout(temporizadorDeMedida);
  temporizadorDeMedida = setTimeout(medirLaPista, 120);
}

function observarLaPista() {
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(programarMedida).observe(porId('panel-proyectos'));
    return;
  }
  window.addEventListener?.('resize', programarMedida);
}

// =====================================================
// Los eventos (delegados en contenedores fijos: volver a dibujar no engancha nada)
// =====================================================

function conectarEventos() {
  const nuevo = porId('pr-nuevo');
  nuevo.addEventListener('click', () => abrirFormularioDeProyecto(null, nuevo));
  for (const nombre of PESTANAS) {
    const pestana = porId(`tab-${nombre}`);
    pestana.addEventListener('click', () => mostrarPestana(nombre));
    pestana.addEventListener('keydown', teclaEnPestanas);
  }
  window.addEventListener?.('hashchange', alCambiarElFragmento);
  porId('pr-vista-lista').addEventListener('click', alTocar);
  porId('pr-vista-detalle').addEventListener('click', alTocar);
  const panel = porId('panel-proyectos');
  panel.addEventListener('input', alEscribirEnElBuscador);
  panel.addEventListener('compositionend', alEscribirEnElBuscador);
  porId('pr-elegir-archivos').addEventListener('change', alElegirArchivosParaSubir);
  conectarModales();
  observarLaPista();
}

// ---- Las pestañas (las de Métricas y Reportes) ----

function mostrarPestana(nombre) {
  pagina.pestana = PESTANAS.includes(nombre) ? nombre : PESTANAS[0];
  for (const otra of PESTANAS) {
    const activa = otra === pagina.pestana;
    const pestana = porId(`tab-${otra}`);
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    pestana.classList.toggle('activa', activa);
    porId(`panel-${otra}`).hidden = !activa;
  }
  escribirLaUrl();
  if (pagina.pestana === PESTANAS[0]) programarMedida();
}

// Teclado en la barra: flechas (con vuelta), Inicio y Fin. Mueven el foco y activan la pestaña. Con Alt, Ctrl o Cmd son atajos del
// navegador: no se tocan
function teclaEnPestanas(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const actual = PESTANAS.indexOf(evento.target?.dataset?.hash);
  if (actual === -1) return;
  const ultima = PESTANAS.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault?.();
  mostrarPestana(PESTANAS[destino]);
  porId(`tab-${PESTANAS[destino]}`).focus();
}

// Un fragmento escrito a mano (o el link viejo #metricas) cambia de pestaña
function alCambiarElFragmento() {
  if (pagina.modo !== 'lista') return;
  if (window.location.hash === '#metricas') porId('pr-aviso-metricas').hidden = false;
  mostrarPestana(pestanaDeHash(window.location.hash));
}

function irALaPestana(nombre) {
  mostrarPestana(nombre);
  porId(`tab-${pagina.pestana}`).focus();
}

// Un clic en la lista o en el detalle: los chips, las flechas, las acciones y las filas que se despliegan
function alTocar(evento) {
  const objetivo = evento.target;
  if (!objetivo || typeof objetivo.closest !== 'function') return;
  const de = (selector) => objetivo.closest(selector);
  let boton;
  if ((boton = de('button[data-grupo]'))) elegirChip(boton);
  else if ((boton = de('button[data-correr]'))) correrLaVentana(boton);
  else if ((boton = de('button[data-limpiar]'))) limpiarLosFiltros();
  else if ((boton = de('a[data-ir-a]'))) {
    evento.preventDefault?.();
    irALaPestana(boton.dataset.irA);
  } else if ((boton = de('button[data-archivo]'))) usarArchivo(boton);
  else if ((boton = de('button[data-editar-proyecto]'))) abrirFormularioDeProyecto(pagina.detalle, boton);
  else if ((boton = de('button[data-eliminar-proyecto]'))) confirmarEliminarProyecto(boton);
  else if ((boton = de('button[data-nuevo-hito]'))) abrirFormularioDeHito({ proyecto: pagina.detalle, hito: null }, boton);
  else if ((boton = de('button[data-nuevo-logro]'))) abrirFormularioDeHito({ proyecto: null, hito: null }, boton);
  else if ((boton = de('button[data-editar-hito]'))) editarHito(boton);
  else if ((boton = de('button[data-subir-archivos]'))) elegirArchivosDelHito(boton);
  else if ((boton = de('button[data-eliminar-hito]'))) confirmarEliminarHito(boton);
  else if ((boton = de('button[data-subir-documentos]'))) elegirDocumentos(boton);
  else if ((boton = de('button.pr-fila'))) alternarFila(boton);
}

// Abre o cierra la fila de un hito
function alternarFila(cabeza) {
  const abrir = cabeza.getAttribute('aria-expanded') !== 'true';
  cabeza.setAttribute('aria-expanded', String(abrir));
  const cuerpo = porId(cabeza.getAttribute('aria-controls'));
  if (cuerpo) cuerpo.hidden = !abrir;
}

// ---- Los filtros, las flechas y el resaltado de la pestaña Proyectos ----

// Si los filtros dejaron la lista vacía, se anuncia (una vez, al quedar vacía)
function anunciarSiQuedoVacia() {
  const vacio = pagina.proyectos.length > 0 && filtrarProyectos(pagina.proyectos, pagina.estado).length === 0;
  if (vacio && !pagina.vacio) anunciar(TEXTO_SIN_RESULTADOS);
  pagina.vacio = vacio;
}

function elegirChip(boton) {
  const grupo = boton.dataset.grupo;
  const valor = boton.dataset.valor;
  if (grupo === 'linea') {
    if (!tieneClave(FILTROS_DE_LA_LINEA, valor)) return;
    pagina.filtroLinea = valor;
    dibujarLinea({ foco: boton });
    return;
  }
  if (!pagina.estado) return;
  if (grupo === 'estado' && (valor === 'todos' || ORDEN_ESTADOS.includes(valor))) pagina.estado = { ...pagina.estado, estado: valor };
  else if (grupo === 'categoria' && (valor === 'todas' || tieneClave(TEXTO_CATEGORIA, valor))) pagina.estado = { ...pagina.estado, categoria: valor };
  else if (grupo === 'resaltar') {
    const ventana = ventanaDe(pagina.estado.anios, pagina.extremos);
    const anio = valor === 'ninguno' ? null : anioValido(valor);
    if (valor !== 'ninguno' && (anio === null || anio < ventana.desde || anio > ventana.hasta)) return;
    pagina.estado = { ...pagina.estado, resaltar: anio === null ? null : String(anio) };
  } else {
    return;
  }
  dibujarProyectos({ foco: boton });
  escribirLaUrl();
  if (grupo !== 'resaltar') anunciarSiQuedoVacia();
  else if (pagina.estado.resaltar) anunciar(fraseDelAnio(pagina.estado.resaltar, pagina.hitos));
}

// Una flecha corre la ventana un año; si el año resaltado queda afuera, vuelve a «Ninguno» (estadoConVentana)
function correrLaVentana(boton) {
  const paso = Number(boton.dataset.correr);
  if ((paso !== 1 && paso !== -1) || boton.disabled || !pagina.estado) return;
  pagina.estado = estadoConVentana({ ...pagina.estado, anios: pagina.estado.anios + paso }, pagina.extremos);
  dibujarProyectos({ foco: boton });
  escribirLaUrl();
  const ventana = ventanaDe(pagina.estado.anios, pagina.extremos);
  anunciar(`${ventana.desde} a ${ventana.hasta}`);
}

// «Ver todos los proyectos» del vacío: limpia los filtros y el foco va al buscador (el botón ya no está)
function limpiarLosFiltros() {
  if (!pagina.estado) return;
  pagina.estado = sinFiltros(pagina.estado);
  pagina.vacio = false;
  dibujarProyectos({ foco: '#pr-buscar' });
  escribirLaUrl();
}

// El buscador filtra en vivo (mientras se compone una letra con tilde, espera a que termine). El foco y el cursor quedan en el buscador
function alEscribirEnElBuscador(evento) {
  const campo = evento.target;
  if (!campo || campo.id !== 'pr-buscar' || !pagina.estado) return;
  if (evento.type === 'input' && evento.isComposing) return;
  const busqueda = String(campo.value ?? '');
  if (busqueda === pagina.estado.busqueda) return;
  pagina.estado = { ...pagina.estado, busqueda };
  dibujarProyectos({ foco: campo });
  escribirLaUrl();
  anunciarSiQuedoVacia();
}

// =====================================================
// Los modales (como los del Seguimiento)
// =====================================================

function conectarModales() {
  for (const id of MODALES) conectarCierre(porId(id));
  document.addEventListener('keydown', alApretarUnaTecla);
  const formularioDelProyecto = porId('form-proyecto');
  formularioDelProyecto.addEventListener('submit', (evento) => {
    evento.preventDefault?.();
    guardarProyecto();
  });
  formularioDelProyecto.addEventListener('change', alCambiarElFormularioDeProyecto);
  formularioDelProyecto.addEventListener('input', alEscribirEnElFormularioDeProyecto);
  const formularioDelHito = porId('form-hito');
  formularioDelHito.addEventListener('submit', (evento) => {
    evento.preventDefault?.();
    guardarHito();
  });
  formularioDelHito.addEventListener('input', alEscribirEnElFormularioDeHito);
  porId('h-elegir').addEventListener('click', () => porId('h-archivos').click());
  porId('h-archivos').addEventListener('change', () => {
    const campo = porId('h-archivos');
    sumarArchivosAlHito(Array.from(campo.files ?? []));
    campo.value = '';
  });
  conectarZonaParaSoltar(porId('h-soltar'));
  porId('h-pendientes').addEventListener('click', quitarPendiente);
  porId('modal-confirmar-si').addEventListener('click', confirmarLaEliminacion);
}

// Cierran la × y «Cancelar» (data-cerrar) y el clic en el velo, solo si empezó en el velo: soltar ahí una selección de texto que
// empezó en un campo no cierra el modal
function conectarCierre(modal) {
  let desdeElVelo = false;
  modal.addEventListener('mousedown', (evento) => {
    desdeElVelo = evento.target === modal;
  });
  modal.addEventListener('click', (evento) => {
    const cerrar = Boolean(evento.target?.closest?.('[data-cerrar]')) || (evento.target === modal && desdeElVelo);
    desdeElVelo = false;
    if (cerrar && modalAbierto?.id === modal.id) cerrarModal();
  });
}

// Escape cierra el modal abierto
function alApretarUnaTecla(evento) {
  if (evento.key !== 'Escape' || !modalAbierto) return;
  evento.preventDefault?.();
  cerrarModal();
}

// El error sin campo, dentro del modal (nunca detrás del velo)
function mostrarAvisoDelModal(id, mensaje) {
  const aviso = porId(`${id}-aviso`);
  aviso.textContent = mensaje ?? '';
  aviso.hidden = !mensaje;
}

// Abre el modal `id`: el foco va a `foco()` después de la transición del velo (hasta que termina, no deja enfocar, como en
// seguimiento.js) y, al cerrarlo, vuelve a `volverA` (o, si se volvió a dibujar, al que lo reemplazó)
function abrirModal(id, { volverA = null, foco = null, alCerrar = null } = {}) {
  if (modalAbierto) cerrarModal({ sinFoco: true });
  mostrarAvisoDelModal(id, '');
  porId(id).classList.add('active');
  const sesion = { id, volverA, descriptor: descriptorDeFoco(volverA), alCerrar };
  modalAbierto = sesion;
  setTimeout(() => {
    if (modalAbierto === sesion) foco?.()?.focus?.();
  }, 100);
}

function cerrarModal({ sinFoco = false } = {}) {
  const sesion = modalAbierto;
  if (!sesion) return;
  modalAbierto = null;
  porId(sesion.id).classList.remove('active');
  if (!sinFoco) devolverElFoco(sesion);
  sesion.alCerrar?.();
}

// El foco vuelve al botón que abrió el modal; si ya no está en la página (se volvió a dibujar), al que lo reemplazó; si no, al lugar de
// respaldo
function devolverElFoco({ volverA, descriptor }) {
  if (volverA && volverA.isConnected !== false) {
    volverA.focus?.();
    return;
  }
  const otro = descriptor ? document.querySelector(descriptor.selector) : null;
  (otro ?? lugarDeRespaldo())?.focus?.();
}

// ---- Los errores de los formularios ----

// Muestra (o saca, con null) el error de un campo: su párrafo y aria-invalid en el control (en estado, color e ícono, en el grupo, que
// es un radiogroup; en las áreas, en cada casilla). false si no es un campo del formulario
function ponerError(formulario, campo, mensaje) {
  const campos = CAMPOS_DEL_FORMULARIO[formulario];
  if (!campos || !tieneClave(campos, campo)) return false;
  const id = campos[campo];
  const parrafo = porId(`${id}-error`);
  if (parrafo) {
    parrafo.textContent = mensaje ?? '';
    parrafo.hidden = !mensaje;
  }
  const control = porId(id);
  const marcados = campo === 'areas' ? Array.from(control.querySelectorAll('input[name="p-areas"]')) : [control];
  for (const elemento of marcados) {
    if (mensaje) elemento.setAttribute('aria-invalid', 'true');
    else elemento.removeAttribute('aria-invalid');
  }
  return true;
}

// El foco al campo con error: en un grupo de opciones, a la elegida (o a la primera); en las áreas, a la primera casilla
function enfocarCampo(formulario, campo) {
  const control = porId(CAMPOS_DEL_FORMULARIO[formulario][campo]);
  let destino = control;
  if (GRUPOS_DE_OPCIONES.includes(campo)) destino = control.querySelector('input:checked') ?? control.querySelector('input') ?? control;
  else if (campo === 'areas') destino = control.querySelector('input') ?? control;
  destino.focus?.();
}

function limpiarErrores(formulario) {
  for (const campo of Object.keys(CAMPOS_DEL_FORMULARIO[formulario])) ponerError(formulario, campo, null);
}

// Todos los errores juntos (los campos sin error quedan limpios) y el foco al primero. true si hubo alguno
function mostrarErrores(formulario, errores) {
  limpiarErrores(formulario);
  for (const { campo, mensaje } of errores) ponerError(formulario, campo, mensaje);
  if (errores.length) enfocarCampo(formulario, errores[0].campo);
  return errores.length > 0;
}

// Un error del servidor al guardar: con campo, en ese campo; sin campo, dentro del modal (nunca detrás del velo), con el foco en el
// botón. Si el modal ya se cerró (o se abrió otro), un aviso de la página
function mostrarFallaDelFormulario(formulario, idDelModal, abierto, falla, boton) {
  const mensaje = mensajeDeFalla(falla);
  if (!abierto()) {
    avisarError(mensaje);
    return;
  }
  if (falla?.campo && ponerError(formulario, falla.campo, mensaje)) {
    enfocarCampo(formulario, falla.campo);
    return;
  }
  mostrarAvisoDelModal(idDelModal, mensaje);
  boton.focus?.();
}

// Una fecha a medio escribir en un <input type="date"> llega vacía: el navegador la marca como badInput
const fechaAMedias = (id) => porId(id)?.validity?.badInput === true;

// =====================================================
// El proyecto: nuevo y editar (spec 6)
// =====================================================

function abrirFormularioDeProyecto(proyecto, boton) {
  if (!pagina.esAdmin) return;
  const elegido = esObjeto(proyecto) && idEntero(proyecto.id) ? proyecto : null;
  const sesion = { proyecto: elegido, valores: valoresDelProyecto(elegido), guardando: false, cambio: false };
  formProyecto = sesion;
  const textos = textosDelModalDeProyecto(elegido);
  porId('modal-proyecto-titulo').textContent = textos.titulo;
  porId('p-guardar').textContent = textos.boton;
  const v = sesion.valores;
  porId('p-nombre').value = v.nombre;
  porId('p-descripcion').value = v.descripcion;
  porId('p-categoria').value = v.categoria;
  porId('p-prioridad').value = v.prioridad;
  const fecha = porId('p-fecha-inicio');
  fecha.value = v.fecha_inicio;
  fecha.max = fechaMaxima(pagina.hoy) ?? '';
  porId('p-responsable').value = v.responsable;
  porId('p-enlace-externo').value = v.enlace_externo;
  for (const radio of porId('p-estado').querySelectorAll('input[name="p-estado"]')) radio.checked = radio.value === v.estado;
  porId('p-colores').innerHTML = htmlDeColores(v.color);
  porId('p-iconos').innerHTML = htmlDeIconos(v.icono);
  porId('p-muestra').innerHTML = htmlDeMuestra(v);
  limpiarErrores('proyecto');
  abrirModal('modal-proyecto', {
    volverA: boton,
    foco: () => porId('p-nombre'),
    alCerrar: () => {
      if (sesion.cambio) recargarVista();
    }
  });
  dibujarAreasDelFormulario(sesion);
}

// Las áreas (GET /areas, una vez por página): mientras llegan, «Cargando las áreas…»; si no llegan, lo dice. Las del proyecto viajan
// igual al guardar (están en los valores del formulario): un error acá no se las saca
async function dibujarAreasDelFormulario(sesion) {
  const lista = porId('p-areas-lista');
  if (pagina.areas === null) {
    lista.innerHTML = '<p class="pr-vacio">Cargando las áreas…</p>';
    // Un solo pedido aunque el formulario se abra otra vez mientras tanto; si falla, la próxima vez se vuelve a pedir
    promesaDeAreas ??= API.pedirJson('GET', '/areas');
    try {
      const areas = (await promesaDeAreas)?.data;
      pagina.areas = Array.isArray(areas) ? areas : [];
    } catch (error) {
      promesaDeAreas = null;
      if (esSesionVencida(error)) {
        irAlLogin();
        return;
      }
      console.error('Error cargando las áreas:', error);
      if (formProyecto === sesion) lista.innerHTML = '<p class="pr-vacio">No se pudieron cargar las áreas.</p>';
      return;
    }
  }
  if (formProyecto === sesion) lista.innerHTML = htmlDeAreas(pagina.areas, sesion.valores.areas);
}

// Elegir un estado, un color, un ícono o un área: queda en los valores del formulario (y la muestra se actualiza)
function alCambiarElFormularioDeProyecto(evento) {
  const sesion = formProyecto;
  const campo = evento.target;
  if (!sesion || !campo) return;
  const v = sesion.valores;
  if (campo.name === 'p-estado' && ESTADOS.includes(campo.value)) {
    v.estado = campo.value;
    ponerError('proyecto', 'estado', null);
  } else if (campo.name === 'p-color' && COLOR_HEX.test(String(campo.value))) {
    v.color = campo.value;
    ponerError('proyecto', 'color', null);
  } else if (campo.name === 'p-icono' && ICONOS.includes(campo.value)) {
    v.icono = campo.value;
    ponerError('proyecto', 'icono', null);
  } else if (campo.name === 'p-areas') {
    const id = idEntero(campo.value);
    if (id === null) return;
    v.areas = campo.checked ? [...v.areas.filter((otro) => otro !== id), id] : v.areas.filter((otro) => otro !== id);
    ponerError('proyecto', 'areas', null);
  } else {
    return;
  }
  porId('p-muestra').innerHTML = htmlDeMuestra({ ...v, nombre: porId('p-nombre').value });
}

// Lo que se corrige deja de marcarse como error; el nombre se ve en la muestra
function alEscribirEnElFormularioDeProyecto(evento) {
  const id = evento.target?.id;
  const campo = Object.keys(CAMPOS_DEL_FORMULARIO.proyecto).find((clave) => CAMPOS_DEL_FORMULARIO.proyecto[clave] === id);
  if (campo) ponerError('proyecto', campo, null);
  if (id === 'p-nombre' && formProyecto) porId('p-muestra').innerHTML = htmlDeMuestra({ ...formProyecto.valores, nombre: evento.target.value });
}

function valoresDelFormularioDeProyecto(sesion) {
  return {
    nombre: porId('p-nombre').value,
    descripcion: porId('p-descripcion').value,
    estado: sesion.valores.estado,
    prioridad: porId('p-prioridad').value,
    categoria: porId('p-categoria').value,
    fecha_inicio: porId('p-fecha-inicio').value,
    responsable: porId('p-responsable').value,
    enlace_externo: porId('p-enlace-externo').value,
    color: sesion.valores.color,
    icono: sesion.valores.icono,
    areas: [...sesion.valores.areas]
  };
}

// Guardar: valida en el navegador (con los mensajes del servidor) y manda POST o PUT. El botón queda deshabilitado hasta la respuesta:
// un doble clic no crea dos proyectos. Si sale bien, el aviso del servidor, se cierra y se vuelve a pedir la vista
async function guardarProyecto() {
  const sesion = formProyecto;
  const boton = porId('p-guardar');
  if (!sesion || sesion.guardando || boton.disabled) return;
  const valores = valoresDelFormularioDeProyecto(sesion);
  const errores = erroresDelProyecto(valores, pagina.hoy);
  if (fechaAMedias('p-fecha-inicio') && !errores.some((e) => e.campo === 'fecha_inicio')) errores.push({ campo: 'fecha_inicio', mensaje: MENSAJES_PROYECTOS.fechaInicio });
  if (mostrarErrores('proyecto', errores)) return;
  mostrarAvisoDelModal('modal-proyecto', '');
  const id = sesion.proyecto ? idEntero(sesion.proyecto.id) : null;
  sesion.guardando = true;
  boton.disabled = true;
  let respuesta = null;
  let falla = null;
  try {
    respuesta = id ? await API.pedirJson('PUT', `/gestion/proyectos/${id}`, valores) : await API.pedirJson('POST', '/gestion/proyectos', valores);
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    sesion.guardando = false;
    boton.disabled = false;
  }
  const abierto = () => formProyecto === sesion && modalAbierto?.id === 'modal-proyecto';
  if (falla) {
    if (esSesionVencida(falla)) irAlLogin();
    else mostrarFallaDelFormulario('proyecto', 'modal-proyecto', abierto, falla, boton);
    return;
  }
  avisarExito(respuesta?.message || 'Proyecto guardado');
  sesion.cambio = true;
  if (abierto()) cerrarModal();
  else recargarVista();
}

// =====================================================
// El hito o el logro: nuevo y editar, con sus archivos (spec 6)
// =====================================================

// El hito de la vista con ese id: en el detalle, uno del proyecto; en la lista, uno del timeline
function hitoDeLaVista(id) {
  const lista = pagina.modo === 'detalle' ? comoLista(pagina.detalle?.hitos) : pagina.hitos;
  return id === null ? null : (lista.filter(esObjeto).find((hito) => idEntero(hito.id) === id) ?? null);
}

const nombresDeArchivos = (archivos) => comoLista(archivos).filter(esObjeto).map((archivo) => String(archivo.nombre_archivo ?? ''));

function editarHito(boton) {
  const hito = hitoDeLaVista(idEntero(boton.dataset.editarHito));
  if (hito) abrirFormularioDeHito({ proyecto: pagina.modo === 'detalle' ? pagina.detalle : null, hito }, boton);
}

function abrirFormularioDeHito({ proyecto, hito }, boton) {
  if (!pagina.esAdmin) return;
  const h = esObjeto(hito) ? hito : null;
  const p = esObjeto(proyecto) && idEntero(proyecto.id) ? proyecto : null;
  const textos = textosDelModalDeHito({ proyecto: p, hito: h });
  const sesion = {
    proyecto: p, hito: h, logro: textos.logro, hitoId: h ? idEntero(h.id) : null, enviados: null, mensaje: '',
    pendientes: [], existentes: nombresDeArchivos(h?.archivos), guardando: false, cambio: false
  };
  formHito = sesion;
  porId('modal-hito-titulo').textContent = textos.titulo;
  porId('h-de').textContent = textos.de;
  porId('h-guardar').textContent = textos.boton;
  const v = valoresDelHito(h, pagina.hoy);
  porId('h-titulo').value = v.titulo;
  const fecha = porId('h-fecha');
  fecha.value = v.fecha;
  fecha.max = fechaMaxima(pagina.hoy) ?? '';
  porId('h-descripcion').value = v.descripcion;
  porId('h-evidencia-url').value = v.evidencia_url;
  limpiarErrores('hito');
  ponerErrorDeArchivos('');
  dibujarPendientes();
  abrirModal('modal-hito', {
    volverA: boton,
    foco: () => porId('h-titulo'),
    alCerrar: () => {
      // Los pendientes se vacían al cerrar; si el hito ya se guardó (aunque los archivos no), la vista se vuelve a pedir
      sesion.pendientes = [];
      if (formHito === sesion) {
        dibujarPendientes();
        ponerErrorDeArchivos('');
        porId('h-soltar').classList.remove('arrastrando');
      }
      if (sesion.cambio) recargarVista();
    }
  });
}

function alEscribirEnElFormularioDeHito(evento) {
  const id = evento.target?.id;
  const campo = Object.keys(CAMPOS_DEL_FORMULARIO.hito).find((clave) => CAMPOS_DEL_FORMULARIO.hito[clave] === id);
  if (campo) ponerError('hito', campo, null);
}

function ponerErrorDeArchivos(texto) {
  const parrafo = porId('h-archivos-error');
  parrafo.textContent = texto;
  parrafo.hidden = !texto;
}

function dibujarPendientes() {
  porId('h-pendientes').innerHTML = htmlDePendientes(formHito?.pendientes ?? []);
}

// Los archivos elegidos (con «elegilos» o soltados): cada uno se controla antes de sumarlo (problemaDeArchivo: la extensión, los 10 MB,
// la cantidad contando los que ya tiene el hito, y los repetidos); los que no pasan no se suman y se dice por qué
function sumarArchivosAlHito(archivos) {
  const sesion = formHito;
  if (!sesion || modalAbierto?.id !== 'modal-hito') return;
  const problemas = [];
  for (const archivo of archivos) {
    const problema = problemaDeArchivo(archivo, { tipo: 'hito', existentes: sesion.existentes, elegidos: sesion.pendientes.map((otro) => otro.name) });
    if (problema) problemas.push(problema);
    else sesion.pendientes.push(archivo);
  }
  ponerErrorDeArchivos(textoDeProblemas(problemas));
  dibujarPendientes();
}

// La × de un pendiente lo quita; el foco pasa a la × que quedó en su lugar (o a «elegilos» si no quedó ninguna)
function quitarPendiente(evento) {
  const boton = evento.target?.closest?.('button[data-quitar]');
  const sesion = formHito;
  if (!boton || !sesion) return;
  const lugar = Number(boton.dataset.quitar);
  if (!Number.isInteger(lugar) || lugar < 0 || lugar >= sesion.pendientes.length) return;
  sesion.pendientes.splice(lugar, 1);
  ponerErrorDeArchivos('');
  dibujarPendientes();
  const quedan = Array.from(porId('h-pendientes').querySelectorAll('button[data-quitar]'));
  (quedan[Math.min(lugar, quedan.length - 1)] ?? porId('h-elegir')).focus?.();
}

// La zona para soltar archivos (con el teclado, «elegilos»)
function conectarZonaParaSoltar(zona) {
  zona.addEventListener('dragover', (evento) => {
    evento.preventDefault?.();
    zona.classList.add('arrastrando');
  });
  zona.addEventListener('dragleave', (evento) => {
    if (!evento.relatedTarget || typeof zona.contains !== 'function' || !zona.contains(evento.relatedTarget)) zona.classList.remove('arrastrando');
  });
  zona.addEventListener('drop', (evento) => {
    evento.preventDefault?.();
    zona.classList.remove('arrastrando');
    sumarArchivosAlHito(Array.from(evento.dataTransfer?.files ?? []));
  });
  // Un archivo soltado fuera de la zona, pero dentro del modal, no hace nada (el navegador lo abriría y se perdería el formulario)
  const modal = porId('modal-hito');
  for (const tipo of ['dragover', 'drop']) modal.addEventListener(tipo, (evento) => evento.preventDefault?.());
}

// Sube `archivos` a `ruta` (POST multipart, en el campo `archivos`), con el token en el encabezado y sin Content-Type: el navegador pone
// el del FormData, con su separador. Si falla, tira un Error con el mensaje del servidor y su `status`
async function subirArchivos(ruta, archivos) {
  const datos = new FormData();
  for (const archivo of archivos) datos.append('archivos', archivo, archivo.name);
  const { 'Content-Type': _tipo, ...encabezados } = Auth.getAuthHeaders();
  const respuesta = await fetch(`${CONFIG.API_URL}${ruta}`, { method: 'POST', headers: encabezados, body: datos });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return cuerpo;
}

const mismosValores = (a, b) => Object.keys(CAMPOS_DEL_FORMULARIO.hito).every((campo) => String(a?.[campo] ?? '') === String(b?.[campo] ?? ''));

function valoresDelFormularioDeHito() {
  return {
    titulo: porId('h-titulo').value,
    fecha: porId('h-fecha').value,
    descripcion: porId('h-descripcion').value,
    evidencia_url: porId('h-evidencia-url').value
  };
}

// Guarda el hito (POST o PUT) y devuelve la respuesta. Si ya se guardó en este modal y no cambió nada, no lo vuelve a mandar (null)
async function guardarElHito(sesion, valores) {
  if (sesion.hitoId && sesion.enviados && mismosValores(sesion.enviados, valores)) return null;
  let respuesta;
  if (sesion.hitoId) respuesta = await API.pedirJson('PUT', `/gestion/hitos/${sesion.hitoId}`, valores);
  else if (sesion.proyecto) respuesta = await API.pedirJson('POST', `/gestion/proyectos/${idEntero(sesion.proyecto.id)}/hitos`, valores);
  else respuesta = await API.pedirJson('POST', '/gestion/logros', valores);
  const id = sesion.hitoId ?? idEntero(respuesta?.data?.id);
  if (!id) throw Object.assign(new Error('La respuesta no trae el hito guardado.'), { status: 500 });
  Object.assign(sesion, { hitoId: id, enviados: { ...valores }, mensaje: respuesta?.message ?? '', cambio: true });
  return respuesta;
}

// Guardar: valida, guarda el hito y sube los pendientes. Si el hito se guardó y la subida falló, el modal queda abierto con el motivo
// y deja reintentar (sin volver a crear el hito); nunca dice «guardado» si algo falló. Si sale todo bien, el aviso del servidor, se
// cierra y se vuelve a pedir la vista
async function guardarHito() {
  const sesion = formHito;
  const boton = porId('h-guardar');
  if (!sesion || sesion.guardando || boton.disabled) return;
  const valores = valoresDelFormularioDeHito();
  const errores = erroresDelHito(valores, pagina.hoy);
  if (fechaAMedias('h-fecha') && !errores.some((e) => e.campo === 'fecha')) errores.push({ campo: 'fecha', mensaje: MENSAJES_PROYECTOS.fechaInvalida });
  if (mostrarErrores('hito', errores)) return;
  mostrarAvisoDelModal('modal-hito', '');
  const abierto = () => formHito === sesion && modalAbierto?.id === 'modal-hito';
  sesion.guardando = true;
  boton.disabled = true;
  let falla = null;
  let fallaDeLaSubida = null;
  let subida = '';
  try {
    await guardarElHito(sesion, valores);
    if (sesion.pendientes.length) {
      try {
        subida = (await subirArchivos(`/gestion/hitos/${sesion.hitoId}/archivos`, sesion.pendientes))?.message ?? '';
        sesion.pendientes = [];
      } catch (error) {
        fallaDeLaSubida = error ?? new Error('');
      }
    }
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    sesion.guardando = false;
    boton.disabled = false;
  }
  if (esSesionVencida(falla) || esSesionVencida(fallaDeLaSubida)) {
    irAlLogin();
    return;
  }
  if (falla) {
    mostrarFallaDelFormulario('hito', 'modal-hito', abierto, falla, boton);
    return;
  }
  if (fallaDeLaSubida) {
    const texto = textoDeSubidaFallida(sesion.logro, fallaDeLaSubida.status ? fallaDeLaSubida.message : mensajeDeFalla(fallaDeLaSubida));
    if (abierto()) {
      mostrarAvisoDelModal('modal-hito', texto);
      boton.focus?.();
    } else {
      avisarError(texto);
      recargarVista();
    }
    return;
  }
  avisarExito(textoDeGuardado(sesion.mensaje, subida) || 'Hito guardado');
  sesion.cambio = true;
  if (abierto()) cerrarModal();
  else recargarVista();
}

// =====================================================
// Subir, ver, descargar y borrar archivos (spec 6)
// =====================================================

// «Subir archivos» de un hito y «Subir documentos» de un proyecto abren el selector de la página
function elegirArchivosDelHito(boton) {
  const id = idEntero(boton.dataset.subirArchivos);
  const hito = hitoDeLaVista(id);
  if (!pagina.esAdmin || !hito) return;
  abrirSelectorDeArchivos({ ruta: `/gestion/hitos/${id}/archivos`, tipo: 'hito', existentes: nombresDeArchivos(hito.archivos), boton, cosa: 'archivos' });
}

function elegirDocumentos(boton) {
  const id = idEntero(boton.dataset.subirDocumentos);
  if (!pagina.esAdmin || !id || idEntero(pagina.detalle?.id) !== id) return;
  abrirSelectorDeArchivos({ ruta: `/gestion/proyectos/${id}/documentos`, tipo: 'proyecto', existentes: nombresDeArchivos(pagina.detalle.documentos), boton, cosa: 'documentos' });
}

function abrirSelectorDeArchivos(destino) {
  subidaDirecta = destino;
  const selector = porId('pr-elegir-archivos');
  selector.value = '';
  selector.click();
}

// Lo elegido en el selector: se controla todo antes de enviar (si alguno no pasa, no se sube ninguno y se dice por qué); la subida
// muestra su estado y avisa el resultado
async function alElegirArchivosParaSubir() {
  const selector = porId('pr-elegir-archivos');
  const destino = subidaDirecta;
  subidaDirecta = null;
  const archivos = Array.from(selector.files ?? []);
  selector.value = '';
  if (!destino || !archivos.length) return;
  const elegidos = [];
  const problemas = [];
  for (const archivo of archivos) {
    const problema = problemaDeArchivo(archivo, { tipo: destino.tipo, existentes: destino.existentes, elegidos: elegidos.map((otro) => otro.name) });
    if (problema) problemas.push(problema);
    else elegidos.push(archivo);
  }
  if (problemas.length) {
    avisarError(`No se subió ningún archivo. ${textoDeProblemas(problemas)}`);
    return;
  }
  const uno = destino.cosa === 'documentos' ? 'el documento' : 'el archivo';
  const estado = elegidos.length === 1 ? `Subiendo ${uno}…` : `Subiendo ${elegidos.length} ${destino.cosa}…`;
  const mensajes = porId('message-container');
  if (mensajes) mensajes.innerHTML = `<div class="alert">${esc(estado)}</div>`;
  anunciar(estado);
  let respuesta = null;
  let falla = null;
  await conBotonBloqueado(destino.boton, async () => {
    try {
      respuesta = await subirArchivos(destino.ruta, elegidos);
    } catch (error) {
      falla = error ?? new Error('');
    }
  });
  if (esSesionVencida(falla)) {
    irAlLogin();
    return;
  }
  if (falla) {
    avisarError(`No se subieron los archivos: ${(falla.status ? falla.message : mensajeDeFalla(falla)).replace(/[.\s]+$/, '')}.`);
    return;
  }
  avisarExito(respuesta?.message || 'Archivos subidos');
  await recargarVista();
}

// Ver, Descargar y Eliminar de un archivo o un documento (la dirección sale de sus data-*, validada)
function usarArchivo(boton) {
  const ruta = rutaDelArchivo(boton.dataset.base, boton.dataset.id);
  if (!ruta) return;
  const nombre = String(boton.dataset.nombre ?? '');
  const accion = boton.dataset.archivo;
  if (accion === 'descargar') descargarArchivo(boton, ruta, nombre);
  else if (accion === 'ver') verArchivo(boton, ruta, nombre, String(boton.dataset.mime ?? ''));
  else if (accion === 'eliminar') pedirConfirmacion({ texto: textoDeConfirmacion('archivo', { nombre }), boton, ejecutar: () => API.pedirJson('DELETE', ruta) });
}

// Con el JWT en el encabezado (API.pedirArchivo), nunca en la URL, y con el nombre original
async function descargarArchivo(boton, ruta, nombre) {
  await conBotonBloqueado(boton, async () => {
    try {
      descargarBlob(await API.pedirArchivo(`${ruta}/descargar`), nombre || 'archivo');
    } catch (error) {
      if (esSesionVencidaEnArchivo(error)) irAlLogin();
      else avisarError(`No se pudo descargar el archivo: ${error?.message ?? ''}`);
    }
  });
}

// La vista previa, desde un blob: (la imagen en un <img> y el PDF en un <iframe>); la URL se libera al cerrar el modal
async function verArchivo(boton, ruta, nombre, mime) {
  await conBotonBloqueado(boton, async () => {
    let blob;
    try {
      blob = await API.pedirArchivo(`${ruta}/descargar`);
    } catch (error) {
      if (esSesionVencidaEnArchivo(error)) irAlLogin();
      else avisarError(`No se pudo abrir el archivo: ${error?.message ?? ''}`);
      return;
    }
    // Sin su tipo, un PDF no se dibuja en el <iframe>
    if (!blob?.type && typeof Blob === 'function') blob = new Blob([blob], { type: mime });
    const url = URL.createObjectURL(blob);
    const html = htmlDeVistaPrevia(url, { nombre, mime });
    if (!html) {
      URL.revokeObjectURL(url);
      return;
    }
    porId('modal-vista-previa-titulo').textContent = nombre || 'Vista previa';
    porId('modal-vista-previa-cuerpo').innerHTML = html;
    abrirModal('modal-vista-previa', {
      volverA: boton,
      foco: () => porId('modal-vista-previa').querySelector('.modal-close'),
      alCerrar: () => {
        porId('modal-vista-previa-cuerpo').innerHTML = '';
        URL.revokeObjectURL(url);
      }
    });
  });
}

// =====================================================
// Las confirmaciones (spec 6: un modal chico, no confirm())
// =====================================================

// Abre la confirmación con `texto`; «Eliminar» corre `ejecutar` (el pedido) y, si sale bien, el aviso del servidor, se cierra y
// `alTerminar` (de entrada, volver a pedir la vista). El foco va a «Cancelar», que no borra nada
function pedirConfirmacion({ texto, boton, ejecutar, alTerminar = recargarVista }) {
  if (!pagina.esAdmin) return;
  confirmacion = { ejecutar, alTerminar, ocupado: false };
  porId('modal-confirmar-texto').textContent = texto;
  abrirModal('modal-confirmar', {
    volverA: boton,
    foco: () => porId('modal-confirmar').querySelector('.modal-footer [data-cerrar]') ?? porId('modal-confirmar-si')
  });
}

async function confirmarLaEliminacion() {
  const actual = confirmacion;
  const boton = porId('modal-confirmar-si');
  if (!actual || actual.ocupado || boton.disabled) return;
  mostrarAvisoDelModal('modal-confirmar', '');
  actual.ocupado = true;
  boton.disabled = true;
  let respuesta = null;
  let falla = null;
  try {
    respuesta = await actual.ejecutar();
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    actual.ocupado = false;
    boton.disabled = false;
  }
  const abierta = confirmacion === actual && modalAbierto?.id === 'modal-confirmar';
  if (falla) {
    if (esSesionVencida(falla)) irAlLogin();
    else if (abierta) {
      mostrarAvisoDelModal('modal-confirmar', mensajeDeFalla(falla));
      boton.focus?.();
    } else {
      avisarError(mensajeDeFalla(falla));
    }
    return;
  }
  avisarExito(respuesta?.message || 'Eliminado');
  if (abierta) cerrarModal();
  if (confirmacion === actual) confirmacion = null;
  await actual.alTerminar();
}

function confirmarEliminarProyecto(boton) {
  const proyecto = pagina.detalle;
  const id = idEntero(proyecto?.id);
  if (!id || idEntero(boton.dataset.eliminarProyecto) !== id) return;
  pedirConfirmacion({
    texto: textoDeConfirmacion('proyecto', proyecto),
    boton,
    ejecutar: () => API.pedirJson('DELETE', `/gestion/proyectos/${id}`),
    alTerminar: volverALaLista
  });
}

function confirmarEliminarHito(boton) {
  const id = idEntero(boton.dataset.eliminarHito);
  const hito = hitoDeLaVista(id);
  if (!hito) return;
  pedirConfirmacion({
    texto: textoDeConfirmacion(esLogro(hito) ? 'logro' : 'hito', hito),
    boton,
    ejecutar: () => API.pedirJson('DELETE', `/gestion/hitos/${id}`)
  });
}

// Un proyecto dado de baja ya no tiene detalle: la lista, con sus filtros, en la misma dirección (sin sumar una entrada al historial)
async function volverALaLista() {
  window.history?.replaceState?.(null, '', `${window.location.pathname ?? ''}${urlDeEstado(pagina.estadoDelDetalle, pagina.hoy)}`);
  document.title = 'Proyectos - RPAD';
  Object.assign(pagina, { modo: 'lista', detalle: null, idDetalle: null, pestana: PESTANAS[0], estado: null });
  porId('pr-vista-detalle').innerHTML = '';
  porId('pr-nuevo').hidden = !pagina.esAdmin;
  await cargarLista({ inicial: true });
  (pagina.esAdmin ? porId('pr-nuevo') : porId(`tab-${pagina.pestana}`))?.focus?.();
}
