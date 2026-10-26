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
 * Los datos son los de GET /api/gestion/proyectos, GET /api/gestion/proyectos/:id y GET /api/gestion/timeline (los hitos de los
 * proyectos activos y los logros del área, que son los hitos sin proyecto): las fechas llegan como texto 'AAAA-MM-DD' (también el
 * `subido_el` de los archivos) y se leen como texto (nunca con new Date ni
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
