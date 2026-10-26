// Pestaña Feriados de Configuración (spec 2026-10-26-feriados, 4): los feriados y días no laborables de un año, los 9 fijos a la
// vista y sin editar, con el selector del año, los filtros por tipo y la tabla (la carga, la corrección, «no rige» y la baja van en
// el modal del feriado, abrirModalFeriado). Lo que arma HTML y lo que calcula es puro y va primero; lo que toca el DOM o la API, al
// final. Al cargarse solo declara (tests/feriados-frontend.test.js lo carga en un vm). En configuracion.html va después de areas.js:
// todos sus nombres de nivel superior llevan Feriado o Feriados y no se repiten con los de config.js, auth.js, main.js, api.js,
// usuarios.js ni areas.js (un let o un const repetido rompe el segundo script entero, y una function repetida pisa la otra). Escucha
// sus clics dentro de #vista-feriados y en #btn-nuevo-feriado (en el encabezado de la página), con sus propios atributos
// (data-anio-feriado, data-filtro-feriado y data-editar-feriado). La lista la manda el servidor ya armada (GET /api/feriados: las
// fechas, el día de la semana, el tipo y las aclaraciones); acá no se recalcula nada. #feriados-anuncio es la única región viva: lo
// que se vuelve a dibujar no lleva aria-live.

// =====================================================
// El estado de la pestaña
// =====================================================
const feriadosPorAnio = new Map();     // año → { anio, anios, feriados } de GET /api/feriados: cada año se pide una sola vez
let anioFeriados = null;               // el año que se mira; null = todavía ninguno (el primer pedido va sin año: el en curso del servidor)
let aniosDeFeriados = [];              // los años del selector, de la última respuesta (para dibujarlo mientras llega otro año)
let datosDibujadosFeriados = null;     // los datos de la tabla que está en la página; null = ninguna (cargando, error o sesión vencida)
let pedidoDeFeriados = null;           // { anio, turno, promesa }, el pedido en curso: abrir la pestaña dos veces hace un solo pedido
let turnoDeFeriados = 0;               // solo se dibuja la respuesta del último pedido
let filtroFeriado = 'todos';
const htmlEscritoFeriados = new Map(); // el HTML escrito en el selector y en los filtros: solo se reescriben si cambió (no pierden el foco)

// =====================================================
// Las constantes
// =====================================================

// Copia de MENSAJES_FERIADO (services/feriadosReglas.js), atada por un test de paridad: el modal avisa en el momento con los mismos
// mensajes que el servidor (que valida igual)
const MENSAJES_FERIADO = Object.freeze({
  fecha: 'La fecha tiene que ser del 01/01/2025 al 31/12 del año que viene.',
  nombre: 'Escribí el nombre del feriado.',
  nombreLargo: 'El nombre puede tener hasta 150 caracteres.',
  tipo: 'Elegí el tipo de feriado.',
  trasladado: 'La fecha original tiene que ser otra fecha del mismo año.',
  repite29: 'Un feriado del 29 de febrero no puede repetirse todos los años.',
  despuesDeLaBaja: 'La fecha tiene que ser anterior al año desde el que se dio de baja.',
  anio: 'Elegí un año válido.',
  rige: 'Indicá si ese año rige.',
  pasaAl: 'La fecha a la que se pasó tiene que ser del mismo año.',
  desde: 'Elegí desde qué año deja de regir.',
  noSeRepite: 'Este feriado no se repite: se corrige o se da de baja entero.',
  noEncontrado: 'Feriado no encontrado'
});

// Copia de NOMBRES_TIPO_FERIADO (services/feriadosReglas.js), atada por un test de paridad: los rótulos de las opciones del tipo en
// el modal (la tabla muestra el tipo_nombre que manda el servidor)
const NOMBRES_TIPO_FERIADO = Object.freeze({
  nacional: 'Nacional', provincial: 'De Chubut', municipal: 'De Comodoro', no_laborable: 'No laborable'
});

// Los días de diaDeLaSemana (services/feriadosReglas.js), en el orden de getUTCDay
const DIAS_DE_LA_SEMANA_FERIADOS = Object.freeze(['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']);

// Los filtros, en su orden: la clave es el `tipo` de la lista ('fijo' en los 9 del sistema) y 'todos'
const FILTROS_FERIADO = Object.freeze([
  ['todos', 'Todos'], ['nacional', 'Nacionales'], ['provincial', 'De Chubut'], ['municipal', 'De Comodoro'],
  ['no_laborable', 'No laborables'], ['fijo', 'Fijos del sistema']
].map((filtro) => Object.freeze(filtro)));

// El color de la insignia de cada tipo (un tipo desconocido va sin color)
const CLASE_DEL_TIPO_FERIADO = Object.freeze({
  nacional: 'fe-etq-nacional', provincial: 'fe-etq-provincial', municipal: 'fe-etq-municipal', no_laborable: 'fe-etq-no-laborable',
  fijo: 'fe-etq-fijo'
});

const TITULO_FERIADOS = 'Feriados y días no laborables';
const MENSAJE_ERROR_FERIADOS = 'No se pudieron cargar los feriados. Probá de nuevo en unos minutos.';
// GET /api/feriados lo lee cualquier rol con sesión: solo una sesión vencida (401) lo frena
const MENSAJE_SESION_FERIADOS = 'Tu sesión venció. Volvé a ingresar.';
const ENLACE_SESION_FERIADOS = 'Volvé a ingresar.';
const SPINNER_FERIADOS = '<div class="loading"><div class="spinner"></div></div>';

// =====================================================
// Lo puro
// =====================================================

// Todo texto del servidor pasa por escapeHtml (un número, con String: escapeHtml(0) daría '')
const escFeriado = (valor) => Utils.escapeHtml(valor === null || valor === undefined ? '' : String(valor));
// Los feriados de una lista (lo que no es un objeto se descarta: un dato raro no rompe la pestaña)
const listaDeFeriados = (feriados) => (Array.isArray(feriados)
  ? feriados.filter((f) => f !== null && typeof f === 'object' && !Array.isArray(f))
  : []);
// Un texto 'AAAA-MM-DD' de un día que existe (como esFechaIso del servidor)
const esFechaFeriado = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Utils.soloFecha(valor) === valor;
// Un año de cuatro cifras, como número
const esAnioFeriado = (valor) => Number.isInteger(valor) && valor >= 1000 && valor <= 9999;
// El id de un feriado de la tabla: un entero positivo (los fijos no tienen)
const esIdDeFeriado = (valor) => (typeof valor === 'number' || typeof valor === 'string') && /^[1-9]\d*$/.test(String(valor));

// Copia de diaDeLaSemana (services/feriadosReglas.js), atada por un test de paridad: 'lunes', …, 'domingo', o null si no es una
// fecha. Para el día al lado de la fecha del modal (la tabla usa el dia_semana del servidor). Mediodía UTC, como el calendario
const diaDeLaSemanaFeriado = (fecha) => (esFechaFeriado(fecha)
  ? DIAS_DE_LA_SEMANA_FERIADOS[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
  : null);

// La fecha de la tabla: «Lun 16/02», con el día que manda el servidor (sin un día que sirva, «16/02»); sin una fecha, «—»
const fechaCortaFeriado = (feriado) => {
  const { fecha, dia_semana: dia } = feriado ?? {};
  if (!esFechaFeriado(fecha)) return '—';
  const diaYMes = `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  return DIAS_DE_LA_SEMANA_FERIADOS.includes(dia) ? `${dia.charAt(0).toUpperCase()}${dia.slice(1, 3)} ${diaYMes}` : diaYMes;
};

// El nombre accesible de «Editar», texto plano: «Editar Carnaval, lunes 16/02», con la fecha del año que se mira (dos feriados
// pueden llamarse igual: los dos días de Carnaval, o el día al que se pasó uno que se repite). Sin un día que sirva, «Editar
// Carnaval, 16/02»; sin una fecha, «Editar Carnaval»
const rotuloDeEditarFeriado = (feriado) => {
  const { fecha, dia_semana: dia, nombre } = feriado ?? {};
  const base = `Editar ${nombre === null || nombre === undefined ? '' : String(nombre)}`;
  if (!esFechaFeriado(fecha)) return base;
  const diaYMes = `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  return `${base}, ${DIAS_DE_LA_SEMANA_FERIADOS.includes(dia) ? `${dia} ${diaYMes}` : diaYMes}`;
};

// El filtro de una clave; una desconocida es 'todos'
const filtroFeriadoDe = (clave) => (FILTROS_FERIADO.some(([cada]) => cada === clave) ? clave : 'todos');

// Los feriados que deja un filtro, en el orden de la lista
const feriadosVisibles = (feriados, filtro) => {
  const clave = filtroFeriadoDe(filtro);
  const lista = listaDeFeriados(feriados);
  return clave === 'todos' ? lista : lista.filter((f) => f.tipo === clave);
};

// Cuántos deja cada filtro: { todos, nacional, provincial, municipal, no_laborable, fijo }. Uno que ese año no rige cuenta (está en
// la lista)
const cantidadesDeFiltrosFeriado = (feriados) => {
  const lista = listaDeFeriados(feriados);
  return Object.fromEntries(FILTROS_FERIADO.map(([clave]) => [clave, feriadosVisibles(lista, clave).length]));
};

// Los filtros como botones, con su cantidad (todos, también los que dan 0) y aria-pressed en el elegido
const htmlDeFiltrosFeriado = (feriados, filtro) => {
  const elegido = filtroFeriadoDe(filtro);
  const cantidades = cantidadesDeFiltrosFeriado(feriados);
  return FILTROS_FERIADO
    .map(([clave, texto]) => `<button type="button" class="ar-chip" data-filtro-feriado="${clave}" aria-pressed="${clave === elegido}">${escFeriado(texto)} <b>${String(cantidades[clave])}</b></button>`)
    .join('');
};

// Los años del selector, de menor a mayor y sin repetidos: los de la API (el en curso, el siguiente y los anteriores con feriados) y
// el que se mira, aunque no venga
const aniosDelSelectorFeriado = (anios, anio) => {
  const lista = (Array.isArray(anios) ? anios : []).filter(esAnioFeriado);
  if (esAnioFeriado(anio)) lista.push(anio);
  return [...new Set(lista)].sort((a, b) => a - b);
};

// El selector del año: un botón por año, con aria-pressed en el que se mira
const htmlDelSelectorDeAnioFeriado = (anios, anio) => aniosDelSelectorFeriado(anios, anio)
  .map((cada) => `<button type="button" class="fe-anio" data-anio-feriado="${String(cada)}" aria-pressed="${cada === anio}">${String(cada)}</button>`)
  .join('');

// «Feriados y días no laborables de 2026»; sin un año, sin él
const tituloDeFeriados = (anio) => (esAnioFeriado(anio) ? `${TITULO_FERIADOS} de ${anio}` : TITULO_FERIADOS);
// Un filtro sin ninguno (el de los fijos y «Todos» nunca quedan vacíos)
const textoVacioFeriados = (anio) => (esAnioFeriado(anio)
  ? `No hay ninguno de este tipo cargado para ${anio}.`
  : 'No hay ninguno de este tipo cargado.');

const htmlDeLaFechaFeriado = (feriado) => (esFechaFeriado(feriado.fecha)
  ? `<time datetime="${escFeriado(feriado.fecha)}">${escFeriado(fechaCortaFeriado(feriado))}</time>`
  : '—');

// El tipo, con su insignia: el texto es el tipo_nombre del servidor («Fijo del sistema» en los 9)
const htmlDelTipoFeriado = (feriado) => {
  const clase = typeof feriado.tipo === 'string' && Object.hasOwn(CLASE_DEL_TIPO_FERIADO, feriado.tipo)
    ? ` ${CLASE_DEL_TIPO_FERIADO[feriado.tipo]}`
    : '';
  return `<span class="ar-etq${clase}">${escFeriado(feriado.tipo_nombre)}</span>`;
};

// Una fila: la fecha con el día, el nombre con sus aclaraciones debajo, el tipo, si se repite y «Editar». Los fijos van en gris
// (fe-fijo) y sin botón; uno que ese año no rige, tachado (fe-no-rige), con «Este año no rige» entre sus aclaraciones
const htmlDeFilaFeriado = (feriado) => {
  const fijo = feriado.fijo === true;
  const clases = [fijo ? 'fe-fijo' : '', feriado.rige === false ? 'fe-no-rige' : ''].filter(Boolean).join(' ');
  const aclaraciones = (Array.isArray(feriado.aclaraciones) ? feriado.aclaraciones : [])
    .map((aclaracion) => `<small>${escFeriado(aclaracion)}</small>`).join('');
  const editar = !fijo && esIdDeFeriado(feriado.id)
    ? `<button type="button" class="ar-btn ar-btn-borde ar-btn-chico" data-editar-feriado="${escFeriado(feriado.id)}" aria-label="${escFeriado(rotuloDeEditarFeriado(feriado))}">Editar</button>`
    : '';
  return `
      <tr${clases ? ` class="${clases}"` : ''}>
        <td class="fe-fecha">${htmlDeLaFechaFeriado(feriado)}</td>
        <td class="t"><b class="fe-nombre">${escFeriado(feriado.nombre)}</b>${aclaraciones}</td>
        <td>${htmlDelTipoFeriado(feriado)}</td>
        <td class="fe-repite">${Number(feriado.se_repite) === 1 ? 'Todos los años' : '—'}</td>
        <td class="accion">${editar}</td>
      </tr>`;
};

// La tabla, como la de Áreas: dentro de un marco que se desplaza de costado en pantallas angostas
const htmlDeTablaFeriados = (feriados) => `
  <div class="ar-tabla-marco"><table class="ar-tabla fe-tabla">
    <thead><tr><th scope="col">Fecha</th><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Se repite</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
    <tbody>${listaDeFeriados(feriados).map(htmlDeFilaFeriado).join('')}
    </tbody>
  </table></div>`;

// Lo que sirve de la respuesta de GET /api/feriados: { anio, anios, feriados }, o null si no es la de la API o es de otro año que el
// pedido (`anioPedido`; null: el primer pedido, sin año)
const datosDeFeriados = (respuesta, anioPedido = null) => {
  const datos = respuesta?.data;
  if (respuesta?.success !== true || datos === null || typeof datos !== 'object') return null;
  if (!esAnioFeriado(datos.anio) || !Array.isArray(datos.feriados)) return null;
  if (anioPedido !== null && datos.anio !== anioPedido) return null;
  return { anio: datos.anio, anios: aniosDelSelectorFeriado(datos.anios, datos.anio), feriados: listaDeFeriados(datos.feriados) };
};

// El mensaje de la sesión vencida, con "Volvé a ingresar." como link a login.html
const htmlDeSesionFeriados = () => escFeriado(MENSAJE_SESION_FERIADOS)
  .replace(escFeriado(ENLACE_SESION_FERIADOS), `<a href="login.html">${escFeriado(ENLACE_SESION_FERIADOS)}</a>`);

// =====================================================
// DOM y API
// =====================================================
const porIdFeriado = (id) => document.getElementById(id);

// La región viva de la pestaña (#feriados-anuncio, fuera de lo que se vuelve a dibujar). Un texto igual al anterior se cambia apenas
// (un espacio duro al final), para que se vuelva a anunciar
function anunciarFeriados(texto) {
  const region = porIdFeriado('feriados-anuncio');
  if (!region || !texto) return;
  region.textContent = region.textContent === texto ? `${texto} ` : texto;
}

// Escribe los botones del selector o de los filtros solo si cambiaron. Si el foco estaba en uno de ellos, pasa al botón nuevo con el
// mismo valor de `atributo` (escribir el HTML los vuelve a crear)
function escribirBotonesFeriados(id, html, atributo) {
  const contenedor = porIdFeriado(id);
  if (!contenedor || htmlEscritoFeriados.get(id) === html) return;
  const activo = document.activeElement;
  const valor = activo && activo !== contenedor && contenedor.contains?.(activo) ? activo.getAttribute?.(atributo) : null;
  contenedor.innerHTML = html;
  htmlEscritoFeriados.set(id, html);
  if (typeof valor === 'string' && /^[\w-]+$/.test(valor)) contenedor.querySelector(`[${atributo}="${valor}"]`)?.focus();
}

// Los datos del año que se mira: los pedidos o, mientras se vuelven a pedir con `forzar`, los de la tabla que sigue en la página
// (así sus filtros y sus «Editar» andan mientras llega la respuesta). undefined si no hay
function datosALaVistaFeriados() {
  if (anioFeriados === null) return undefined;
  return feriadosPorAnio.get(anioFeriados)
    ?? (datosDibujadosFeriados?.anio === anioFeriados ? datosDibujadosFeriados : undefined);
}

// Los feriados del año que se mira: se pide cada año la primera vez (usuarios.js la llama al mostrar Feriados, y elegir un año
// también) y, con `forzar`, otra vez (después de guardar: se descartan todos los años, porque uno que se repite cambia en todos;
// la tabla que se ve queda, con sus filtros y sus «Editar», hasta que llega la nueva). Mientras no se fuerce, volver a un año ya
// pedido no lo pide de nuevo
async function cargarFeriados(forzar = false) {
  const anio = anioFeriados;
  if (forzar) {
    feriadosPorAnio.clear();
  } else if (anio !== null && feriadosPorAnio.has(anio)) {
    // Una respuesta de otro año que todavía no llegó ya no se dibuja
    turnoDeFeriados++;
    return dibujarOAvisarFeriados();
  } else if (pedidoDeFeriados && pedidoDeFeriados.anio === anio && pedidoDeFeriados.turno === turnoDeFeriados) {
    return pedidoDeFeriados.promesa;
  }
  const turno = ++turnoDeFeriados;
  // Con forzar, la tabla que se ve queda hasta que llega la nueva
  if (anio === null || datosDibujadosFeriados?.anio !== anio) pintarCargandoFeriados(anio);
  const promesa = pedirFeriados(turno, anio);
  pedidoDeFeriados = { anio, turno, promesa };
  try {
    await promesa;
  } finally {
    if (pedidoDeFeriados?.promesa === promesa) pedidoDeFeriados = null;
  }
}

// Pide el año (null: sin año, el en curso del servidor) y lo dibuja, si nadie pidió otra cosa después (`turno`). Si falla el pedido o
// la respuesta no es la de la API, el error; con un 401, el de la sesión: nunca una tabla vacía
async function pedirFeriados(turno, anio) {
  let respuesta = null;
  let falla = null;
  try {
    respuesta = await API.pedirJson('GET', anio === null ? '/feriados' : `/feriados?anio=${anio}`);
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (turno !== turnoDeFeriados) return;
  if (falla) {
    if (falla.status === 401) pintarSinSesionFeriados();
    else pintarErrorFeriados();
    return;
  }
  const datos = datosDeFeriados(respuesta, anio);
  if (!datos) {
    pintarErrorFeriados();
    return;
  }
  feriadosPorAnio.set(datos.anio, datos);
  aniosDeFeriados = datos.anios;
  anioFeriados = datos.anio;
  dibujarOAvisarFeriados();
}

// El año que se mira, ya pedido: el título, el selector, los filtros, la tabla de lo que deja el filtro (o el vacío)
function dibujarFeriados() {
  const datos = datosALaVistaFeriados();
  if (!datos) return;
  const visibles = feriadosVisibles(datos.feriados, filtroFeriado);
  porIdFeriado('titulo-feriados').textContent = tituloDeFeriados(datos.anio);
  escribirBotonesFeriados('feriados-anio', htmlDelSelectorDeAnioFeriado(datos.anios, datos.anio), 'data-anio-feriado');
  escribirBotonesFeriados('feriados-filtros', htmlDeFiltrosFeriado(datos.feriados, filtroFeriado), 'data-filtro-feriado');
  porIdFeriado('feriados-lista').innerHTML = visibles.length > 0 ? htmlDeTablaFeriados(visibles) : '';
  const vacio = porIdFeriado('feriados-vacio');
  vacio.textContent = textoVacioFeriados(datos.anio);
  vacio.hidden = visibles.length > 0;
  datosDibujadosFeriados = datos;
  porIdFeriado('btn-nuevo-feriado').disabled = false;
}

// Si el dibujo falla con un dato raro, el error en lugar de una tabla a medias
function dibujarOAvisarFeriados() {
  try {
    dibujarFeriados();
  } catch (error) {
    console.error('Error dibujando los feriados:', error);
    pintarErrorFeriados();
  }
}

// Mientras llega un año: el título y el selector con ese año, el spinner y sin filtros (las cantidades serían las del año anterior)
function pintarCargandoFeriados(anio) {
  porIdFeriado('titulo-feriados').textContent = tituloDeFeriados(anio);
  escribirBotonesFeriados('feriados-anio', htmlDelSelectorDeAnioFeriado(aniosDeFeriados, anio), 'data-anio-feriado');
  pintarEstadoFeriados(SPINNER_FERIADOS);
}

// En lugar de la tabla, `html`: sin filtros ni vacío y, con `sinAnios`, tampoco el selector
function pintarEstadoFeriados(html, sinAnios = false) {
  datosDibujadosFeriados = null;
  porIdFeriado('feriados-lista').innerHTML = html;
  escribirBotonesFeriados('feriados-filtros', '', 'data-filtro-feriado');
  if (sinAnios) escribirBotonesFeriados('feriados-anio', '', 'data-anio-feriado');
  porIdFeriado('feriados-vacio').hidden = true;
}

// El error, anunciado; el selector queda para elegir otro año (o el mismo, que se vuelve a pedir)
function pintarErrorFeriados() {
  pintarEstadoFeriados(`<p class="aviso aviso-error">${escFeriado(MENSAJE_ERROR_FERIADOS)}</p>`);
  anunciarFeriados(MENSAJE_ERROR_FERIADOS);
}

// La sesión vencida: el mensaje con el link a login.html, sin selector y con «Nuevo feriado» deshabilitado
function pintarSinSesionFeriados() {
  pintarEstadoFeriados(`<p class="aviso aviso-error">${htmlDeSesionFeriados()}</p>`, true);
  porIdFeriado('btn-nuevo-feriado').disabled = true;
  anunciarFeriados(MENSAJE_SESION_FERIADOS);
}

// Un clic en un año del selector: lo muestra (pidiéndolo si hace falta) con el foco en su botón y, al llegar, anuncia el título (o
// el vacío, si el filtro elegido no deja ninguno). El año que ya se ve no hace nada; uno que falló se vuelve a pedir
async function elegirAnioFeriado(valor) {
  if (!/^\d{4}$/.test(String(valor ?? ''))) return;
  const anio = Number(valor);
  if (anio === anioFeriados && feriadosPorAnio.has(anio)) return;
  anioFeriados = anio;
  const carga = cargarFeriados();
  porIdFeriado('feriados-anio')?.querySelector(`[data-anio-feriado="${anio}"]`)?.focus();
  await carga;
  const datos = feriadosPorAnio.get(anio);
  if (anioFeriados !== anio || !datos) return;
  anunciarFeriados(feriadosVisibles(datos.feriados, filtroFeriado).length > 0 ? tituloDeFeriados(anio) : textoVacioFeriados(anio));
}

// Un clic en un filtro lo elige (para todos los años); el foco queda en su botón, que se volvió a dibujar. Si no deja ninguno, el
// vacío se anuncia (con resultados no: el botón ya dice que está elegido)
function elegirFiltroFeriado(clave) {
  filtroFeriado = filtroFeriadoDe(clave);
  const datos = datosALaVistaFeriados();
  if (!datos) return;
  dibujarOAvisarFeriados();
  porIdFeriado('feriados-filtros')?.querySelector(`[data-filtro-feriado="${filtroFeriado}"]`)?.focus();
  if (feriadosVisibles(datos.feriados, filtroFeriado).length === 0) anunciarFeriados(textoVacioFeriados(datos.anio));
}

// Un feriado de la tabla del año que se mira, por su id (los fijos no se editan: no tienen id); null si no está
function feriadoDeLaLista(id) {
  return listaDeFeriados(datosALaVistaFeriados()?.feriados)
    .find((f) => f.fijo !== true && esIdDeFeriado(f.id) && String(f.id) === String(id)) ?? null;
}

// «Nuevo feriado» (feriado null) y «Editar» (un feriado de la lista) abren el modal del feriado; al cerrarse, el foco vuelve a
// `origen`. El modal (cargar, corregir, «no rige» y la baja) se suma después: hasta entonces, no hace nada
function abrirModalFeriado(feriado, origen) {}

function alHacerClicEnFeriados(evento) {
  const anio = evento.target.closest('[data-anio-feriado]');
  if (anio) {
    elegirAnioFeriado(anio.dataset.anioFeriado);
    return;
  }
  const filtro = evento.target.closest('[data-filtro-feriado]');
  if (filtro) {
    elegirFiltroFeriado(filtro.dataset.filtroFeriado);
    return;
  }
  const editar = evento.target.closest('[data-editar-feriado]');
  if (editar) {
    const feriado = feriadoDeLaLista(editar.dataset.editarFeriado);
    if (feriado) abrirModalFeriado(feriado, editar);
  }
}

// Solo administración (el true literal: usuarios.js ya mandó al resto a la portada); los clics, delegados en la vista
function iniciarFeriados() {
  if (Auth.isAdmin() !== true) return;
  const vista = porIdFeriado('vista-feriados');
  if (!vista) return;
  vista.addEventListener('click', alHacerClicEnFeriados);
  porIdFeriado('btn-nuevo-feriado')?.addEventListener('click', (evento) => abrirModalFeriado(null, evento.currentTarget));
}

document.addEventListener('DOMContentLoaded', iniciarFeriados);
