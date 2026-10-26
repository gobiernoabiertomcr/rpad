/**
 * Proyectos - RPAD (spec 2026-10-25-proyectos, 1, 2 y 10)
 * La página que reemplaza a Gestión: los proyectos de la Dirección de Datos Públicos y Comunicación, con sus hitos y documentos, y
 * los logros del área, en tres pestañas (Proyectos, Línea de tiempo y Logros del área) y el detalle de cada proyecto (?id=N).
 * La pestaña Proyectos dibuja un carril por proyecto sobre una ventana de 3 años que se corre con flechas: cada hito es un punto en
 * su fecha (los que se pisan, a menos de 15 px, se juntan en uno con la cantidad), los que quedan fuera de la ventana se cuentan en
 * el borde y «Resaltar un año» pinta la columna de ese año y dice cuántos hitos salen en su Informe anual. Los filtros (el buscador,
 * el estado y la categoría), la ventana y el año resaltado viajan en la dirección
 * (?estado=en_curso&categoria=difusion&busqueda=indice&anios=2025&resaltar=2025#proyectos; `anios` es el último año de la ventana).
 * Los datos son los de GET /api/gestion/proyectos y GET /api/gestion/timeline (los hitos de los proyectos activos y los logros del
 * área, que son los hitos sin proyecto): las fechas llegan como texto 'AAAA-MM-DD' y se leen como texto (nunca con new Date ni
 * toISOString); los días se cuentan con Date.UTC sobre sus partes. «Hoy» es Utils.hoyEnArgentina(), que recibe por parámetro todo
 * lo puro. Todo texto del servidor pasa por Utils.escapeHtml (también en los title), un color solo llega a un style si es #RRGGBB y
 * un número se escribe con String (Utils.escapeHtml(0) da '').
 * Al cargarse el archivo solo declara: lo que arma HTML es puro y recibe quién mira por parámetro (tests/proyectos-frontend.test.js
 * lo carga en un vm, después del main.js de verdad —getIconSvg e ICON_SELECTOR_MAP— y del api.js de verdad —Utils—, como la página);
 * lo que toca el DOM o la API va aparte, al final.
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

const ICONO_BUSCAR = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
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
  const contexto = { ventana, hoy, anchoPx, resaltar, estado };
  const carriles = elegidos.map((proyecto) => htmlDeCarril(proyecto, porProyecto.get(proyecto.id) ?? [], contexto)).join('');
  return `${frase}<div class="pr-tarjeta"><div class="pr-carriles">${htmlDelEje(ventana, hoy)}`
    + `<ul class="pr-lista-carriles" role="list" aria-label="Proyectos">${carriles}${htmlDelCarrilDeLogros(lista.filter(esLogro), contexto)}</ul>`
    + `</div>${htmlDeLeyenda(resaltar)}</div>`;
}
