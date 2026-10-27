// Pestaña Feriados de Configuración (spec 2026-10-26-feriados, 4): los feriados y días no laborables de un año, los 9 fijos a la
// vista y sin editar, con el selector del año, los filtros por tipo y la tabla, y sus dos modales: el del feriado (#modal-feriado:
// cargar y corregir y, al corregir uno que se repite, «no rige» del año que se mira) y la confirmación de la baja
// (#modal-baja-feriado). Lo que arma HTML y lo que calcula es puro y va primero; lo que toca el DOM o la API, al final. Al cargarse
// solo declara (tests/feriados-frontend.test.js lo carga en un vm). En configuracion.html va después de areas.js: todos sus nombres
// de nivel superior llevan Feriado o Feriados y no se repiten con los de config.js, auth.js, main.js, api.js, usuarios.js ni
// areas.js (un let o un const repetido rompe el segundo script entero, y una function repetida pisa la otra). Escucha sus clics
// dentro de #vista-feriados, de sus dos modales y en #btn-nuevo-feriado (en el encabezado de la página), con sus propios atributos
// (data-anio-feriado, data-filtro-feriado, data-editar-feriado, data-cerrar-feriado y data-cerrar-baja-feriado), y su Escape cierra
// solo sus modales, primero el de la baja. La lista la manda el servidor ya armada (GET /api/feriados: las fechas, el día de la
// semana, el tipo y las aclaraciones); acá no se recalcula nada, y el modal corrige con la fecha guardada (fecha_guardada), nunca con
// la del año que se mira (en uno que se repite, lo dice debajo de la fecha: ayudaDeLaFechaFeriado). Debajo de la fecha dice también
// cuántas licencias de Mi espacio la incluyen (GET /feriados/afectadas, 300 ms después del último cambio de la fecha o de «Se
// repite» hecho por quien usa el modal; abrirlo no lo pide). Escribe con API.pedirJson (POST, PUT y DELETE de /feriados; api.js no
// cambió). #feriados-anuncio es la única región viva de la vista: lo que se vuelve a dibujar no lleva aria-live.

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
// El modal del feriado abierto, null si no hay: { feriado (el de la lista; null en un alta), original (valoresDelFeriado, y después
// de un guardado a medias, lo guardado), anio (el que se miraba al abrirlo: el de «no rige»), origen (el botón que lo abrió), id y
// vecinos (adónde va el foco si su «Editar» ya no está), guardando, cambio (algo ya se guardó), mensajes y avisos (los del servidor) }.
// Cada apertura es un objeto nuevo
let modalDelFeriado = null;
// La confirmación de la baja abierta, null si no hay: { modal (el del feriado), feriado, origen («Dar de baja»), enviando }
let bajaDelFeriado = null;
// Cuántas licencias de Mi espacio incluye la fecha del modal: el temporizador de la espera (null si no hay) y el turno (solo se
// escribe la respuesta del último pedido)
let temporizadorDeAfectadasFeriado = null;
let turnoDeAfectadasFeriado = 0;

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

// El mensaje de la sesión vencida (o un texto que lo incluye, como el de un guardado a medias), escapado y con "Volvé a ingresar."
// como link a login.html
const htmlDeSesionFeriados = (texto = MENSAJE_SESION_FERIADOS) => escFeriado(texto)
  .replace(escFeriado(ENLACE_SESION_FERIADOS), `<a href="login.html">${escFeriado(ENLACE_SESION_FERIADOS)}</a>`);

// =====================================================
// Los modales: lo puro
// =====================================================

// Un dato como texto ('' si no hay; un número, con String: el 0 es "0")
const textoFeriado = (valor) => (valor === null || valor === undefined ? '' : String(valor));
const esObjetoFeriado = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
// 'dd/mm/aaaa' de una fecha ya controlada
const fechaLargaFeriado = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

// Los campos del formulario que van en POST y PUT /feriados (el formulario entero), en el orden del servidor
const CAMPOS_DEL_FERIADO = Object.freeze(['fecha', 'nombre', 'tipo', 'trasladado_de', 'se_repite']);

// El campo de un error del servidor → el id de su control; el error va en `${id}-error`. El del tipo son los cuatro radios
// name="fe-tipo". Uno que no está acá (anio, rige, sin campo) va al aviso de arriba del modal (#feriado-error)
const CAMPO_DEL_ERROR_FERIADO = Object.freeze({
  fecha: 'fe-fecha', nombre: 'fe-nombre', tipo: 'fe-tipo', trasladado_de: 'fe-trasladado', se_repite: 'fe-se-repite', pasa_al: 'fe-pasa-al'
});

// La ayuda de cada tipo, debajo de su nombre (NOMBRES_TIPO_FERIADO) en las cuatro opciones del modal. La de «Nacional», la que pidió
// el usuario (26/10/2026)
const AYUDAS_TIPO_FERIADO = Object.freeze({
  nacional: 'Carnaval, Semana Santa, trasladables y extraordinarios',
  provincial: 'Feriado provincial',
  municipal: 'Feriado o asueto municipal',
  no_laborable: 'Jueves Santo, puentes y asuetos puntuales'
});

// Copia de FECHA_MINIMA_FERIADO (services/feriadosReglas.js), atada por un test de paridad: la fecha más vieja del modal; la última es
// el 31/12 del año siguiente al de hoy (fechaMaximaFeriado). El servidor valida igual
const FECHA_MINIMA_FERIADO = '2025-01-01';
const fechaMaximaFeriado = (hoy) => (esFechaFeriado(hoy) ? `${Number(hoy.slice(0, 4)) + 1}-12-31` : '');

// Un PUT, «no rige» o la baja de un feriado que mientras tanto se dio de baja (404), y un pedido que no llegó al servidor
const MENSAJE_YA_NO_ESTA_FERIADO = 'Ese feriado ya no está cargado: se dio de baja mientras tanto.';
const MENSAJE_SIN_CONEXION_FERIADO = 'No se pudo conectar con el servidor. Probá de nuevo en unos minutos.';

// Las cuatro opciones grandes del tipo (radios name="fe-tipo", obligatorios, como el ámbito del área): el nombre de
// NOMBRES_TIPO_FERIADO y su ayuda
const htmlDeTiposFeriado = () => Object.entries(NOMBRES_TIPO_FERIADO)
  .map(([valor, nombre]) => `<label class="ar-ambito"><input type="radio" name="fe-tipo" value="${valor}" required aria-describedby="fe-tipo-error"><span><b>${escFeriado(nombre)}</b><small>${escFeriado(AYUDAS_TIPO_FERIADO[valor])}</small></span></label>`)
  .join('');

/**
 * Los valores del formulario de un feriado de la lista (null: un alta, todo vacío), con la forma de valoresDelFormularioFeriado más
 * su id, su primer año y su hasta_anio. La fecha y el trasladado son los guardados (fecha_guardada y trasladado_de_guardado), nunca los
 * del año que se mira: en uno que se repite, esos están proyectados al año, y corregir con ellos movería su primer año. «No rige»
 * viene marcado si ese año no rige. El primer año (el de la fecha guardada) y hasta_anio son los extremos de «Dar de baja».
 */
const valoresDelFeriado = (feriado) => {
  const f = esObjetoFeriado(feriado) ? feriado : {};
  const fecha = esFechaFeriado(f.fecha_guardada) ? f.fecha_guardada : '';
  const seRepite = Number(f.se_repite) === 1;
  return {
    id: esIdDeFeriado(f.id) ? Number(f.id) : null,
    fecha,
    nombre: textoFeriado(f.nombre),
    tipo: typeof f.tipo === 'string' && Object.hasOwn(NOMBRES_TIPO_FERIADO, f.tipo) ? f.tipo : '',
    trasladado_de: esFechaFeriado(f.trasladado_de_guardado) ? f.trasladado_de_guardado : '',
    se_repite: seRepite,
    no_rige: seRepite && f.rige === false,
    pasa_al: '',
    primer_anio: fecha ? Number(fecha.slice(0, 4)) : null,
    hasta_anio: Number.isInteger(f.hasta_anio) ? f.hasta_anio : null
  };
};

// Los errores de los obligatorios (fecha, nombre y tipo), { campo: mensaje } en ese orden, con los mensajes del servidor. El rango de
// la fecha, el largo del nombre, el trasladado y el 29/02 que se repite los controla el servidor (sus errores van a su campo)
const erroresDelFeriado = (valores) => {
  const v = esObjetoFeriado(valores) ? valores : {};
  const errores = {};
  if (!esFechaFeriado(v.fecha)) errores.fecha = MENSAJES_FERIADO.fecha;
  if (textoFeriado(v.nombre).trim() === '') errores.nombre = MENSAJES_FERIADO.nombre;
  if (typeof v.tipo !== 'string' || !Object.hasOwn(NOMBRES_TIPO_FERIADO, v.tipo)) errores.tipo = MENSAJES_FERIADO.tipo;
  return errores;
};

// El cuerpo de POST y PUT /feriados: el formulario entero, con el nombre recortado, el trasladado vacío como null y «se repite» como
// true o false
const cuerpoDelFeriado = (valores) => {
  const v = esObjetoFeriado(valores) ? valores : {};
  return {
    fecha: textoFeriado(v.fecha), nombre: textoFeriado(v.nombre).trim(), tipo: textoFeriado(v.tipo),
    trasladado_de: textoFeriado(v.trasladado_de) || null, se_repite: v.se_repite === true
  };
};

/**
 * Los pedidos de «Guardar»: [{ metodo, ruta, cuerpo }], 0, 1 o 2, en este orden.
 * - Un alta (`original` null): POST /feriados con el formulario.
 * - Una corrección: PUT /feriados/:id con el formulario entero si cambió algún campo (`original`, lo que tenía al abrir o lo último
 *   guardado: así un «Guardar» después de un guardado a medias no repite lo que ya salió).
 * - Después, en uno que se repite y que sigue repitiéndose, «no rige» del año que se mira (`anio`): PUT /feriados/:id/rige con
 *   { anio, rige, pasa_al } si la casilla cambió o si sigue marcada y se cargó un «Se pasó al» (vacío es null; sin «no rige», null).
 */
const pedidosDelGuardadoFeriado = (valores, original, anio) => {
  const cuerpo = cuerpoDelFeriado(valores);
  if (!esObjetoFeriado(original)) return [{ metodo: 'POST', ruta: '/feriados', cuerpo }];
  if (!esIdDeFeriado(original.id)) return [];
  const pedidos = [];
  const antes = cuerpoDelFeriado(original);
  if (CAMPOS_DEL_FERIADO.some((campo) => cuerpo[campo] !== antes[campo])) {
    pedidos.push({ metodo: 'PUT', ruta: `/feriados/${original.id}`, cuerpo });
  }
  if (original.se_repite === true && cuerpo.se_repite && esAnioFeriado(anio)) {
    const noRige = valores?.no_rige === true;
    const pasaAl = noRige ? textoFeriado(valores?.pasa_al) || null : null;
    if (noRige !== (original.no_rige === true) || pasaAl !== null) {
      pedidos.push({ metodo: 'PUT', ruta: `/feriados/${original.id}/rige`, cuerpo: { anio, rige: !noRige, pasa_al: pasaAl } });
    }
  }
  return pedidos;
};

// El feriado del modal después de un PUT que salió bien (un guardado a medias: los campos sí, «no rige» no): una copia con lo que
// quedó guardado (la fecha, el nombre, el tipo, «se repite» y el trasladado), así el título, la pregunta de la baja y sus años dicen lo
// mismo que el servidor. Lo que no es un feriado vuelve tal cual
const conLoGuardadoFeriado = (feriado, valores) => {
  if (!esObjetoFeriado(feriado)) return feriado;
  const cuerpo = cuerpoDelFeriado(valores);
  return {
    ...feriado, fecha_guardada: cuerpo.fecha, nombre: cuerpo.nombre, tipo: cuerpo.tipo, se_repite: cuerpo.se_repite ? 1 : 0,
    trasladado_de_guardado: cuerpo.trasladado_de
  };
};

// El título del modal, texto plano (va con textContent): «Nuevo feriado» o «Editar «<nombre>»»
const tituloDelModalFeriado = (feriado) => (esObjetoFeriado(feriado)
  ? `Editar «${valoresDelFeriado(feriado).nombre}»`
  : 'Nuevo feriado');

/**
 * La ayuda debajo de la fecha al corregir uno que se repite (lo guardado: su se_repite), texto plano (va con textContent): la fecha
 * del modal es la de su primer año, no la del año que se mira, y corregirla mueve todos los años, también los anteriores (spec,
 * antiobjetivo: que corregir un año cambie los anteriores sin querer). «Es la fecha de su primer año (2026): corregirla cambia todos
 * los años.» y, con «no rige» a la vista (`anioNoRige`, el año que se mira), « Si solo en 2027 se corrió, marcá «En 2027 no rige».».
 * '' en un alta, en uno que no se repite o sin una fecha guardada.
 */
const ayudaDeLaFechaFeriado = (feriado, anioNoRige = null) => {
  if (!esObjetoFeriado(feriado) || !esIdDeFeriado(feriado.id)) return '';
  const { se_repite: seRepite, primer_anio: primero } = valoresDelFeriado(feriado);
  if (!seRepite || primero === null) return '';
  const ayuda = `Es la fecha de su primer año (${primero}): corregirla cambia todos los años.`;
  return esAnioFeriado(anioNoRige) ? `${ayuda} Si solo en ${anioNoRige} se corrió, marcá «En ${anioNoRige} no rige».` : ayuda;
};

// El aria-describedby de la fecha (`actual`, los ids que ya tiene) con la ayuda (fe-fecha-ayuda) o sin ella y con las licencias
// afectadas (fe-fecha-afectadas) o sin ellas: cada una, según `conAyuda` y `conAfectadas`, o como estaba si es undefined. Van en el
// orden en que se ven, la ayuda y después las afectadas, antes del error; los demás ids quedan como estaban
const describedbyDeLaFechaFeriado = (actual, conAyuda, conAfectadas) => {
  const ids = textoFeriado(actual).split(/\s+/).filter((id) => id !== '');
  const nuevos = [['fe-fecha-ayuda', conAyuda], ['fe-fecha-afectadas', conAfectadas]]
    .filter(([id, con]) => (con === undefined ? ids.includes(id) : Boolean(con))).map(([id]) => id);
  const resto = ids.filter((id) => id !== 'fe-fecha-ayuda' && id !== 'fe-fecha-afectadas');
  const error = resto.indexOf('fe-fecha-error');
  resto.splice(error === -1 ? resto.length : error, 0, ...nuevos);
  return resto.join(' ');
};

// La espera después del último cambio de la fecha o de «Se repite» antes de pedir cuántas licencias de Mi espacio la incluyen
const ESPERA_AFECTADAS_FERIADO = 300;

// Debajo de la fecha, texto plano (va con textContent): cuántas licencias de Mi espacio incluyen el feriado, con lo que manda GET
// /api/feriados/afectadas. Con 0, o con lo que no es una cantidad, nada
const textoDeAfectadasFeriado = (cantidad) => {
  if (!Number.isInteger(cantidad) || cantidad <= 0) return '';
  return cantidad === 1
    ? '1 licencia cargada lo incluye: sus días hábiles se recalculan.'
    : `${String(cantidad)} licencias cargadas lo incluyen: sus días hábiles se recalculan.`;
};

// GET /feriados/afectadas con la fecha y «se repite» del modal y, al corregir, el id del feriado (su baja y sus años que no rigen los
// pone el servidor); null sin una fecha (a medias o vacía): no se pide nada
const rutaDeAfectadasFeriado = (fecha, seRepite, id) => {
  if (!esFechaFeriado(fecha)) return null;
  const ruta = `/feriados/afectadas?fecha=${fecha}&se_repite=${seRepite === true ? '1' : '0'}`;
  return esIdDeFeriado(id) ? `${ruta}&id=${String(id)}` : ruta;
};

// El aviso de un guardado que salió bien: los mensajes del servidor y después sus avisos (fin de semana, ya hay uno ese día), cada uno
// con su punto. Texto plano
const textoDelGuardadoFeriado = (mensajes, avisos) => [...(Array.isArray(mensajes) ? mensajes : []), ...(Array.isArray(avisos) ? avisos : [])]
  .filter((texto) => typeof texto === 'string').map((texto) => texto.trim()).filter(Boolean)
  .map((texto) => (/[.!?]$/.test(texto) ? texto : `${texto}.`))
  .join(' ');

// Los campos se guardaron y «no rige» no: «El feriado se guardó, pero «no rige» no: <motivo>.» (el motivo, sin su punto final)
const textoDelGuardadoAMediasFeriado = (motivo) => {
  const razon = textoFeriado(motivo).trim().replace(/[.\s]+$/, '') || MENSAJE_SIN_CONEXION_FERIADO.replace(/\.$/, '');
  return `El feriado se guardó, pero «no rige» no: ${razon}.`;
};

/**
 * Los años del selector de «Dar de baja» de uno que se repite: de su primer año (el de la fecha guardada) a su hasta_anio o, si sigue,
 * al año siguiente al de hoy (el último que muestra la pestaña). Uno que no se repite se da de baja entero: [].
 */
const aniosDeLaBajaFeriado = (feriado, hoy) => {
  const { se_repite: seRepite, primer_anio: primero, hasta_anio: hasta } = valoresDelFeriado(feriado);
  const tope = esFechaFeriado(hoy) ? Number(hoy.slice(0, 4)) + 1 : null;
  if (!seRepite || primero === null || tope === null) return [];
  const ultimo = Math.max(primero, hasta !== null && hasta < tope ? hasta : tope);
  const anios = [];
  for (let anio = primero; anio <= ultimo; anio++) anios.push(anio);
  return anios;
};

// El año elegido de entrada: el que se mira, dentro de los del selector; sin uno que sirva, el último (el que menos da de baja). null
// sin años
const anioDeLaBajaPorDefectoFeriado = (anios, anio) => {
  const lista = (Array.isArray(anios) ? anios : []).filter(esAnioFeriado);
  if (lista.length === 0) return null;
  if (!esAnioFeriado(anio)) return lista[lista.length - 1];
  return Math.min(Math.max(anio, lista[0]), lista[lista.length - 1]);
};

const htmlDeAniosDeLaBajaFeriado = (anios, elegido) => (Array.isArray(anios) ? anios : []).filter(esAnioFeriado)
  .map((anio) => `<option value="${String(anio)}"${anio === elegido ? ' selected' : ''}>${String(anio)}</option>`)
  .join('');

/**
 * La pregunta de la baja, texto plano (va con textContent). Uno que no se repite, con su día: «¿Dar de baja «Carnaval» del lunes
 * 16/02/2026? Deja de contar como día no hábil.» Uno que se repite, según `desde`: «… Deja de regir desde 2027. Los años anteriores
 * no cambian.» o, desde su primer año (o uno anterior), «… Se da de baja entero.»
 */
const textoDeLaBajaFeriado = (feriado, desde) => {
  const { nombre, fecha, se_repite: seRepite, primer_anio: primero } = valoresDelFeriado(feriado);
  if (!seRepite) {
    const cuando = fecha ? ` del ${diaDeLaSemanaFeriado(fecha)} ${fechaLargaFeriado(fecha)}` : '';
    return `¿Dar de baja «${nombre}»${cuando}? Deja de contar como día no hábil.`;
  }
  const anio = Number(desde);
  if (!Number.isInteger(anio) || primero === null || anio <= primero) return `¿Dar de baja «${nombre}»? Se da de baja entero.`;
  return `¿Dar de baja «${nombre}»? Deja de regir desde ${anio}. Los años anteriores no cambian.`;
};

// DELETE /feriados/:id: con ?desde=AAAA en uno que se repite; null sin un id
const rutaDeLaBajaFeriado = (feriado, desde) => {
  const { id, se_repite: seRepite } = valoresDelFeriado(feriado);
  if (id === null) return null;
  const anio = textoFeriado(desde);
  return seRepite && /^\d{4}$/.test(anio) ? `/feriados/${id}?desde=${anio}` : `/feriados/${id}`;
};

// Los ids del que sigue y del anterior a `id` entre los que se editan de una lista (los fijos no): adónde va el foco si, después de
// guardar o dar de baja, su «Editar» ya no está en la tabla
const vecinosDelFeriado = (feriados, id) => {
  const editables = listaDeFeriados(feriados).filter((f) => f.fijo !== true && esIdDeFeriado(f.id)).map((f) => String(f.id));
  const lugar = editables.indexOf(String(id));
  if (lugar === -1) return [];
  return [editables[lugar + 1], editables[lugar - 1]].filter((vecino) => vecino !== undefined);
};

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
// (así sus filtros andan mientras llega la respuesta; su «Editar» no los usa: espera la lista nueva, editarDeLaListaFeriado).
// undefined si no hay
function datosALaVistaFeriados() {
  if (anioFeriados === null) return undefined;
  return feriadosPorAnio.get(anioFeriados)
    ?? (datosDibujadosFeriados?.anio === anioFeriados ? datosDibujadosFeriados : undefined);
}

// Los feriados del año que se mira: se pide cada año la primera vez (usuarios.js la llama al mostrar Feriados, y elegir un año
// también) y, con `forzar`, otra vez (después de guardar: se descartan todos los años, porque uno que se repite cambia en todos;
// la tabla que se ve queda, con sus filtros, hasta que llega la nueva, y su «Editar» la espera). Mientras no se fuerce, volver a
// un año ya pedido no lo pide de nuevo
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

// «Editar»: el modal con el feriado de la lista. Mientras la lista se vuelve a pedir con forzar (después de guardar o dar de baja), la
// tabla que se ve tiene los datos de antes: abrir el modal con ellos y guardar (el PUT manda el formulario entero) desharía la
// corrección. Entonces espera la lista nueva y abre con su fila, con su «Editar» nuevo como origen; si no llegó, si ya no está, si
// mientras tanto se abrió otro modal o si se eligió otro año u otra pestaña (#vista-feriados oculta), no abre nada
async function editarDeLaListaFeriado(id, boton) {
  if (!esIdDeFeriado(id)) return;
  let origen = boton;
  if (pedidoDeFeriados && anioFeriados !== null && !feriadosPorAnio.has(anioFeriados)) {
    const anio = anioFeriados;
    await pedidoDeFeriados.promesa;
    if (anioFeriados !== anio || porIdFeriado('vista-feriados')?.hidden === true) return;
    if (!feriadosPorAnio.has(anio) || modalDelFeriado !== null || bajaDelFeriado !== null) return;
    origen = porIdFeriado('feriados-lista')?.querySelector?.(`[data-editar-feriado="${id}"]`) ?? boton;
  }
  const feriado = feriadoDeLaLista(id);
  if (feriado) abrirModalFeriado(feriado, origen);
}

// =====================================================
// Los modales: DOM y API
// =====================================================
const radiosDelTipoFeriado = () => [...document.querySelectorAll('input[name="fe-tipo"]')];
// Los controles de un campo con error: el input o, en el tipo, los cuatro radios
const controlesDelErrorFeriado = (id) => (id === 'fe-tipo' ? radiosDelTipoFeriado() : [porIdFeriado(id)].filter(Boolean));
// «Se pasó al» solo está a la vista con «no rige» abierto y marcado: si no, su error va al aviso de arriba
const campoOcultoFeriado = (id) => id === 'fe-pasa-al'
  && (porIdFeriado('fe-anio')?.hidden !== false || porIdFeriado('fe-pasa-al-grupo')?.hidden !== false);
// El motivo de una falla: el mensaje del servidor; con la sesión vencida, el de la pestaña; sin respuesta, el de la conexión
const mensajeDeFallaFeriado = (falla) => {
  if (falla?.status === 401) return MENSAJE_SESION_FERIADOS;
  return falla?.status ? textoFeriado(falla.message) : MENSAJE_SIN_CONEXION_FERIADO;
};
// Un guardado o una baja en camino: mientras tanto no se abre otro modal ni otra confirmación
const seEstaEnviandoFeriado = () => modalDelFeriado?.guardando === true || bajaDelFeriado?.enviando === true;
// Un aviso de la página: el toast (showToast inserta HTML: se escapa) y, como el toast no se anuncia, lo mismo en #feriados-anuncio
function avisarFeriados(texto, tipo) {
  showToast(escFeriado(texto), tipo);
  anunciarFeriados(texto);
}

// Lo que tiene el formulario, con la forma de valoresDelFeriado (sin el id ni los años de la baja)
function valoresDelFormularioFeriado() {
  const valor = (id) => textoFeriado(porIdFeriado(id)?.value);
  return {
    fecha: valor('fe-fecha'), nombre: valor('fe-nombre'),
    tipo: radiosDelTipoFeriado().find((radio) => radio.checked)?.value ?? '',
    trasladado_de: valor('fe-trasladado'), se_repite: porIdFeriado('fe-se-repite')?.checked === true,
    no_rige: porIdFeriado('fe-no-rige')?.checked === true, pasa_al: valor('fe-pasa-al')
  };
}

// «Nuevo feriado» (feriado null) y «Editar» (un feriado de la lista) abren el modal: los campos con valoresDelFeriado (la fecha
// guardada, no la del año), «no rige» del año que se mira solo al corregir uno que se repite y «Dar de baja» solo al corregir. El foco
// va a la fecha; al cerrarse, vuelve a `origen` (o, si la tabla se volvió a dibujar, a su «Editar» nuevo). Mientras se guarda o se da
// de baja, no abre nada: la respuesta que llega es del modal que ya está, y no tiene que cerrar ni escribir en otro
function abrirModalFeriado(feriado, origen) {
  const modal = porIdFeriado('modal-feriado');
  if (!modal || seEstaEnviandoFeriado()) return;
  const editado = esObjetoFeriado(feriado) && esIdDeFeriado(feriado.id) ? feriado : null;
  const valores = valoresDelFeriado(editado);
  const anio = anioFeriados;
  const sesion = {
    feriado: editado, original: editado ? valores : null, anio, origen: origen ?? document.activeElement ?? null, id: valores.id,
    vecinos: editado ? vecinosDelFeriado(feriadosVisibles(datosALaVistaFeriados()?.feriados, filtroFeriado), valores.id) : [],
    guardando: false, cambio: false, mensajes: [], avisos: []
  };
  modalDelFeriado = sesion;
  limpiarErroresFeriado();
  porIdFeriado('modal-feriado-titulo').textContent = tituloDelModalFeriado(editado);
  const maxima = fechaMaximaFeriado(Utils.hoyEnArgentina());
  for (const id of ['fe-fecha', 'fe-trasladado']) {
    porIdFeriado(id).min = FECHA_MINIMA_FERIADO;
    porIdFeriado(id).max = maxima;
  }
  porIdFeriado('fe-fecha').value = valores.fecha;
  porIdFeriado('fe-nombre').value = valores.nombre;
  radiosDelTipoFeriado().forEach((radio) => { radio.checked = radio.value === valores.tipo; });
  porIdFeriado('fe-trasladado').value = valores.trasladado_de;
  porIdFeriado('fe-se-repite').checked = valores.se_repite;
  const conAnio = editado !== null && valores.se_repite && esAnioFeriado(anio);
  porIdFeriado('fe-no-rige-texto').textContent = conAnio ? `En ${anio} no rige` : '';
  porIdFeriado('fe-no-rige').checked = conAnio && valores.no_rige;
  const pasaAl = porIdFeriado('fe-pasa-al');
  pasaAl.value = '';
  pasaAl.min = conAnio ? `${anio}-01-01` : '';
  pasaAl.max = conAnio ? `${anio}-12-31` : '';
  porIdFeriado('fe-baja').hidden = editado === null;
  bloquearModalFeriado(false);
  // Sin las licencias afectadas de otra apertura: abrirlo no las pide (solo un cambio de la fecha o de «Se repite»)
  cancelarAfectadasFeriado();
  actualizarDiaFeriado();
  actualizarSeccionDelAnioFeriado();
  modal.classList.add('active');
  setTimeout(() => {
    if (modalDelFeriado === sesion) porIdFeriado('fe-fecha').focus();
  }, 100);
}

// El día de la semana al lado de la fecha (vacío con una fecha a medias)
function actualizarDiaFeriado() {
  const dia = porIdFeriado('fe-fecha-dia');
  if (dia) dia.textContent = diaDeLaSemanaFeriado(porIdFeriado('fe-fecha')?.value) ?? '';
}

// Un cambio de la fecha hecho por quien usa el modal: su día al lado y, después de la espera, las licencias que la incluyen
function alCambiarLaFechaFeriado() {
  actualizarDiaFeriado();
  programarAfectadasFeriado();
}

// Un cambio de «Se repite» hecho por quien usa el modal: «no rige» y la ayuda de la fecha y, después de la espera, las licencias
function alCambiarSeRepiteFeriado() {
  actualizarSeccionDelAnioFeriado();
  programarAfectadasFeriado();
}

// Las licencias afectadas debajo de la fecha (textoDeAfectadasFeriado; '' la esconde), atadas a la fecha por su aria-describedby
// solo mientras se ven
function mostrarAfectadasFeriado(texto) {
  const leyenda = porIdFeriado('fe-fecha-afectadas');
  const fecha = porIdFeriado('fe-fecha');
  if (!leyenda || !fecha) return;
  leyenda.textContent = texto;
  leyenda.hidden = texto === '';
  fecha.setAttribute('aria-describedby', describedbyDeLaFechaFeriado(fecha.getAttribute('aria-describedby'), undefined, texto !== ''));
}

// Lo pendiente ya no se escribe (el temporizador se cancela y la respuesta que todavía no llegó se descarta) y la cantidad de antes
// se va: es la de otra fecha, o de otra apertura
function cancelarAfectadasFeriado() {
  clearTimeout(temporizadorDeAfectadasFeriado);
  temporizadorDeAfectadasFeriado = null;
  turnoDeAfectadasFeriado++;
  mostrarAfectadasFeriado('');
}

// Después de un cambio: la cantidad de antes se va y, ESPERA_AFECTADAS_FERIADO ms después del último cambio, se pide la de ahora
function programarAfectadasFeriado() {
  cancelarAfectadasFeriado();
  const sesion = modalDelFeriado;
  if (!sesion) return;
  const turno = turnoDeAfectadasFeriado;
  temporizadorDeAfectadasFeriado = setTimeout(() => pedirAfectadasFeriado(sesion, turno), ESPERA_AFECTADAS_FERIADO);
}

// Pide cuántas licencias incluyen la fecha y «se repite» que tiene el modal ahora (sin una fecha, nada) y las muestra, si es la
// respuesta del último pedido y el modal sigue siendo el mismo
async function pedirAfectadasFeriado(sesion, turno) {
  temporizadorDeAfectadasFeriado = null;
  const ruta = rutaDeAfectadasFeriado(porIdFeriado('fe-fecha')?.value, porIdFeriado('fe-se-repite')?.checked === true, sesion.id);
  if (ruta === null) return;
  let cantidad = null;
  try {
    cantidad = (await API.pedirJson('GET', ruta))?.data?.licencias_afectadas;
  } catch {
    // Si el pedido falla, no se muestra nada: es un aviso, no frena el guardado
  }
  if (turno !== turnoDeAfectadasFeriado || modalDelFeriado !== sesion) return;
  mostrarAfectadasFeriado(textoDeAfectadasFeriado(cantidad));
}

// «No rige» se ve al corregir uno que se repite mientras «Se repite» siga tildado; «Se pasó al», con «no rige» marcado
function actualizarSeccionDelAnioFeriado() {
  const sesion = modalDelFeriado;
  const seccion = porIdFeriado('fe-anio');
  if (!seccion) return;
  seccion.hidden = !(sesion?.original?.se_repite === true && esAnioFeriado(sesion.anio)
    && porIdFeriado('fe-se-repite')?.checked === true);
  porIdFeriado('fe-pasa-al-grupo').hidden = porIdFeriado('fe-no-rige')?.checked !== true;
  actualizarAyudaDeLaFechaFeriado();
}

// La ayuda debajo de la fecha (ayudaDeLaFechaFeriado), con lo guardado del feriado del modal y, si «no rige» está a la vista, el año
// que se mira; atada a la fecha por su aria-describedby solo mientras se ve
function actualizarAyudaDeLaFechaFeriado() {
  const ayuda = porIdFeriado('fe-fecha-ayuda');
  const fecha = porIdFeriado('fe-fecha');
  if (!ayuda || !fecha) return;
  const sesion = modalDelFeriado;
  const conNoRige = porIdFeriado('fe-anio')?.hidden === false;
  const texto = sesion ? ayudaDeLaFechaFeriado(sesion.feriado, conNoRige ? sesion.anio : null) : '';
  ayuda.textContent = texto;
  ayuda.hidden = texto === '';
  fecha.setAttribute('aria-describedby', describedbyDeLaFechaFeriado(fecha.getAttribute('aria-describedby'), texto !== ''));
}

// Mientras se guarda: «Guardar», «Dar de baja», la × y «Cancelar» deshabilitados (el modal no se cierra: cerrarModalFeriado)
function bloquearModalFeriado(bloqueado) {
  for (const id of ['fe-guardar', 'fe-baja']) {
    const boton = porIdFeriado(id);
    if (boton) boton.disabled = bloqueado;
  }
  for (const boton of porIdFeriado('modal-feriado')?.querySelectorAll?.('[data-cerrar-feriado]') ?? []) boton.disabled = bloqueado;
}

function limpiarErroresFeriado() {
  const caja = porIdFeriado('feriado-error');
  caja.textContent = '';
  caja.hidden = true;
  for (const id of Object.values(CAMPO_DEL_ERROR_FERIADO)) {
    const error = porIdFeriado(`${id}-error`);
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
    controlesDelErrorFeriado(id).forEach((control) => control.removeAttribute('aria-invalid'));
  }
}

// El aviso de arriba del modal (un error sin campo, o el de un guardado a medias), texto plano
function mostrarAvisoDelModalFeriado(texto) {
  const caja = porIdFeriado('feriado-error');
  caja.textContent = texto;
  caja.hidden = false;
}

// El error de un campo: su mensaje debajo y aria-invalid en su control (en el tipo, en los cuatro radios). Devuelve los controles, o
// null si el campo no tiene lugar propio (o no está a la vista)
function ponerErrorFeriado(campo, mensaje) {
  const id = typeof campo === 'string' && Object.hasOwn(CAMPO_DEL_ERROR_FERIADO, campo) ? CAMPO_DEL_ERROR_FERIADO[campo] : null;
  const error = id ? porIdFeriado(`${id}-error`) : null;
  const controles = id && !campoOcultoFeriado(id) ? controlesDelErrorFeriado(id) : [];
  if (!error || controles.length === 0) return null;
  error.textContent = mensaje;
  error.hidden = false;
  controles.forEach((control) => control.setAttribute('aria-invalid', 'true'));
  return controles;
}

// El foco al campo con error: en el tipo, al radio elegido o al primero
const enfocarControlesFeriado = (controles) => (controles.find((control) => control.checked) ?? controles[0]).focus();

// Los errores de antes de enviar ({ campo: mensaje }): todos a la vez, con el foco en el primero. true si hubo alguno
function mostrarErroresFeriado(errores) {
  let primero = null;
  for (const [campo, mensaje] of Object.entries(errores)) {
    const controles = ponerErrorFeriado(campo, mensaje);
    if (!controles) mostrarAvisoDelModalFeriado(mensaje);
    primero ??= controles;
  }
  if (primero) enfocarControlesFeriado(primero);
  return Object.keys(errores).length > 0;
}

// Un error del servidor: con campo, debajo de su campo, con el foco ahí; sin campo (o en anio o rige), en el aviso de arriba. true si
// fue a un campo
function mostrarErrorFeriado(mensaje, campo) {
  const controles = ponerErrorFeriado(campo, mensaje);
  if (!controles) {
    mostrarAvisoDelModalFeriado(mensaje);
    return false;
  }
  enfocarControlesFeriado(controles);
  return true;
}

// El foco vuelve a `origen` (el botón que abrió el modal); si la tabla se volvió a dibujar, al «Editar» nuevo del mismo feriado o, si
// ya no está, al de uno de al lado (`vecinos`); si no, a «Nuevo feriado»
function devolverFocoFeriado({ origen, id, vecinos }) {
  if (origen && origen.isConnected !== false) {
    origen.focus?.();
    return;
  }
  const lista = porIdFeriado('feriados-lista');
  for (const candidato of [id, ...vecinos]) {
    const boton = esIdDeFeriado(candidato) ? lista?.querySelector?.(`[data-editar-feriado="${candidato}"]`) : null;
    if (boton) {
      boton.focus?.();
      return;
    }
  }
  porIdFeriado('btn-nuevo-feriado')?.focus?.();
}

// Después de guardar o dar de baja: la lista otra vez (con forzar: el feriado cambió en todos los años que toca) y, si no se abrió
// otro modal mientras tanto, el foco de vuelta
async function recargarFeriadosYEnfocar(sesion) {
  await cargarFeriados(true);
  if (modalDelFeriado === null && bajaDelFeriado === null) devolverFocoFeriado(sesion);
}

// Cierra el modal; si es el abierto, las licencias afectadas que estaban por pedirse o por llegar ya no se escriben
function terminarModalFeriado(sesion) {
  porIdFeriado('modal-feriado').classList.remove('active');
  if (modalDelFeriado !== sesion) return;
  modalDelFeriado = null;
  cancelarAfectadasFeriado();
}

// La × y «Cancelar» (y Escape): nunca mientras se guarda. Si algo ya se guardó (un guardado a medias), la lista se vuelve a pedir
function cerrarModalFeriado() {
  const sesion = modalDelFeriado;
  if (!sesion || sesion.guardando) return;
  terminarModalFeriado(sesion);
  devolverFocoFeriado(sesion);
  if (sesion.cambio) recargarFeriadosYEnfocar(sesion);
}

/**
 * «Guardar»: los obligatorios se controlan antes de enviar; sin cambios, se cierra sin pedir nada. Si no, los pedidos de
 * pedidosDelGuardadoFeriado, uno detrás del otro, con «Guardar» deshabilitado y el modal sin cerrarse hasta la respuesta.
 * - Todo bien: se cierra, el aviso del servidor con sus avisos y la lista otra vez (con forzar).
 * - Un 404 (se dio de baja mientras tanto): se cierra, avisa y vuelve a pedir la lista.
 * - El primero bien y el segundo no: queda abierto con «El feriado se guardó, pero «no rige» no: <motivo>.» (y, con un 400 con
 *   campo, ese campo marcado), y lo guardado pasa a ser el original (el próximo «Guardar» no lo repite) y el feriado del modal.
 * - Otro error: con campo, en su campo; sin campo, en el aviso de arriba (con la sesión vencida, con el link a login.html).
 */
async function guardarFeriado() {
  const sesion = modalDelFeriado;
  const boton = porIdFeriado('fe-guardar');
  if (!sesion || sesion.guardando || !boton || boton.disabled) return;
  limpiarErroresFeriado();
  const valores = valoresDelFormularioFeriado();
  if (mostrarErroresFeriado(erroresDelFeriado(valores))) return;
  const pedidos = pedidosDelGuardadoFeriado(valores, sesion.original, sesion.anio);
  if (pedidos.length === 0) {
    cerrarModalFeriado();
    return;
  }

  let hechos = 0;
  let falla = null;
  sesion.guardando = true;
  bloquearModalFeriado(true);
  try {
    for (const pedido of pedidos) {
      const respuesta = await API.pedirJson(pedido.metodo, pedido.ruta, pedido.cuerpo);
      hechos++;
      sesion.cambio = true;
      sesion.mensajes.push(respuesta?.message);
      if (Array.isArray(respuesta?.avisos)) sesion.avisos.push(...respuesta.avisos);
      // Los campos ya guardados son el nuevo original (el próximo «Guardar» no los vuelve a mandar) y el feriado del modal pasa a
      // tenerlos (el título, la pregunta de la baja y sus años, como en el servidor)
      if (sesion.original && Object.hasOwn(pedido.cuerpo, 'fecha')) {
        sesion.original = { ...sesion.original, ...Object.fromEntries(CAMPOS_DEL_FERIADO.map((campo) => [campo, valores[campo]])) };
        sesion.feriado = conLoGuardadoFeriado(sesion.feriado, valores);
        if (modalDelFeriado === sesion) {
          porIdFeriado('modal-feriado-titulo').textContent = tituloDelModalFeriado(sesion.feriado);
          actualizarAyudaDeLaFechaFeriado();
        }
      }
    }
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    sesion.guardando = false;
    bloquearModalFeriado(false);
  }

  if (falla?.status === 404) {
    terminarModalFeriado(sesion);
    avisarFeriados(MENSAJE_YA_NO_ESTA_FERIADO, 'error');
    devolverFocoFeriado(sesion);
    await recargarFeriadosYEnfocar(sesion);
    return;
  }
  if (falla && hechos > 0) {
    // Arriba, que los campos se guardaron y «no rige» no (con la sesión vencida, con el link a login.html); un 400 con campo marca
    // además ese campo, con el foco ahí
    const texto = textoDelGuardadoAMediasFeriado(mensajeDeFallaFeriado(falla));
    if (falla.status === 401) {
      const caja = porIdFeriado('feriado-error');
      caja.innerHTML = htmlDeSesionFeriados(texto);
      caja.hidden = false;
    } else {
      mostrarAvisoDelModalFeriado(texto);
    }
    const controles = falla.status === 400 ? ponerErrorFeriado(falla.campo, textoFeriado(falla.message)) : null;
    if (controles) enfocarControlesFeriado(controles);
    else boton.focus();
    return;
  }
  if (falla) {
    if (falla.status === 401) {
      const caja = porIdFeriado('feriado-error');
      caja.innerHTML = htmlDeSesionFeriados();
      caja.hidden = false;
      boton.focus();
    } else if (!mostrarErrorFeriado(mensajeDeFallaFeriado(falla), falla.campo)) {
      boton.focus();
    }
    return;
  }
  terminarModalFeriado(sesion);
  // Con avisos del servidor (fin de semana, ya hay uno ese día), el toast de advertencia: en uno verde se perderían
  const conAvisos = textoDelGuardadoFeriado([], sesion.avisos) !== '';
  avisarFeriados(textoDelGuardadoFeriado(sesion.mensajes, sesion.avisos) || 'Feriado guardado.', conAvisos ? 'warning' : 'success');
  devolverFocoFeriado(sesion);
  await recargarFeriadosYEnfocar(sesion);
}

// «Dar de baja» (en el pie, al corregir): la confirmación. En uno que se repite, desde qué año (de entrada, el que se mira), con el
// foco en el selector; en uno que no, con el foco en «Cancelar». Nunca mientras se guarda o se da de baja
function abrirModalBajaFeriado(origen) {
  const sesion = modalDelFeriado;
  const modal = porIdFeriado('modal-baja-feriado');
  if (!modal || !sesion?.feriado || seEstaEnviandoFeriado()) return;
  const anios = aniosDeLaBajaFeriado(sesion.feriado, Utils.hoyEnArgentina());
  const desde = anioDeLaBajaPorDefectoFeriado(anios, sesion.anio);
  const baja = { modal: sesion, feriado: sesion.feriado, origen: origen ?? document.activeElement ?? null, enviando: false };
  bajaDelFeriado = baja;
  const grupo = porIdFeriado('baja-feriado-desde-grupo');
  const selector = porIdFeriado('baja-feriado-desde');
  grupo.hidden = anios.length === 0;
  selector.innerHTML = htmlDeAniosDeLaBajaFeriado(anios, desde);
  selector.value = desde === null ? '' : String(desde);
  porIdFeriado('baja-feriado-texto').textContent = textoDeLaBajaFeriado(sesion.feriado, desde);
  const error = porIdFeriado('baja-feriado-error');
  error.textContent = '';
  error.hidden = true;
  porIdFeriado('baja-feriado-confirmar').disabled = false;
  modal.classList.add('active');
  setTimeout(() => {
    if (bajaDelFeriado === baja) (grupo.hidden ? porIdFeriado('baja-feriado-cancelar') : selector).focus();
  }, 100);
}

function actualizarTextoDeLaBajaFeriado() {
  if (!bajaDelFeriado) return;
  porIdFeriado('baja-feriado-texto').textContent = textoDeLaBajaFeriado(bajaDelFeriado.feriado, porIdFeriado('baja-feriado-desde').value);
}

function terminarModalBajaFeriado(baja) {
  porIdFeriado('modal-baja-feriado').classList.remove('active');
  if (bajaDelFeriado === baja) bajaDelFeriado = null;
}

// Cierra la confirmación (nunca mientras se envía) y deja abierto el modal del feriado, con el foco en «Dar de baja»
function cerrarModalBajaFeriado() {
  const baja = bajaDelFeriado;
  if (!baja || baja.enviando) return;
  terminarModalBajaFeriado(baja);
  if (porIdFeriado('modal-feriado').classList.contains('active')) baja.origen?.focus?.();
}

// Dar de baja de verdad (DELETE, con ?desde= en uno que se repite), con «Dar de baja» deshabilitado hasta la respuesta. Si sale bien,
// o si el feriado ya no estaba (404), se cierran los dos modales, se avisa y se vuelve a pedir la lista; otro error queda en la
// confirmación
async function confirmarBajaFeriado() {
  const baja = bajaDelFeriado;
  const boton = porIdFeriado('baja-feriado-confirmar');
  if (!baja || baja.enviando || !boton || boton.disabled) return;
  const conDesde = porIdFeriado('baja-feriado-desde-grupo').hidden === false;
  const ruta = rutaDeLaBajaFeriado(baja.feriado, conDesde ? porIdFeriado('baja-feriado-desde').value : null);
  if (!ruta) return;
  const caja = porIdFeriado('baja-feriado-error');
  caja.textContent = '';
  caja.hidden = true;

  let respuesta = null;
  let falla = null;
  baja.enviando = true;
  boton.disabled = true;
  try {
    respuesta = await API.pedirJson('DELETE', ruta);
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    baja.enviando = false;
    boton.disabled = false;
  }

  if (falla && falla.status !== 404) {
    if (falla.status === 401) caja.innerHTML = htmlDeSesionFeriados();
    else caja.textContent = mensajeDeFallaFeriado(falla);
    caja.hidden = false;
    boton.focus();
    return;
  }
  const sesion = baja.modal;
  terminarModalBajaFeriado(baja);
  terminarModalFeriado(sesion);
  avisarFeriados(falla ? MENSAJE_YA_NO_ESTA_FERIADO : textoFeriado(respuesta?.message) || 'Feriado dado de baja.', falla ? 'error' : 'success');
  devolverFocoFeriado(sesion);
  await recargarFeriadosYEnfocar(sesion);
}

// La × y «Cancelar» de cada modal (data-cerrar-feriado y data-cerrar-baja-feriado). Un clic en el velo no cierra, como en Áreas, para
// no perder lo escrito
function alHacerClicEnModalFeriado(evento) {
  if (evento.target?.closest?.('[data-cerrar-feriado]')) cerrarModalFeriado();
}

function alHacerClicEnModalBajaFeriado(evento) {
  if (evento.target?.closest?.('[data-cerrar-baja-feriado]')) cerrarModalBajaFeriado();
}

// Escape cierra solo los modales de esta pestaña: primero la confirmación de la baja y después el del feriado
function alApretarEscapeEnFeriados(evento) {
  if (evento.key !== 'Escape') return;
  if (porIdFeriado('modal-baja-feriado')?.classList.contains('active')) cerrarModalBajaFeriado();
  else if (porIdFeriado('modal-feriado')?.classList.contains('active')) cerrarModalFeriado();
}

// Los cuatro tipos y los oyentes de los dos modales (los campos que cambian algo al escribir, los botones y Escape)
function iniciarModalesFeriado() {
  const modal = porIdFeriado('modal-feriado');
  const baja = porIdFeriado('modal-baja-feriado');
  if (!modal || !baja) return;
  porIdFeriado('fe-tipo-opciones').innerHTML = htmlDeTiposFeriado();
  modal.addEventListener('click', alHacerClicEnModalFeriado);
  baja.addEventListener('click', alHacerClicEnModalBajaFeriado);
  porIdFeriado('fe-fecha').addEventListener('input', alCambiarLaFechaFeriado);
  porIdFeriado('fe-fecha').addEventListener('change', alCambiarLaFechaFeriado);
  porIdFeriado('fe-se-repite').addEventListener('change', alCambiarSeRepiteFeriado);
  porIdFeriado('fe-no-rige').addEventListener('change', actualizarSeccionDelAnioFeriado);
  porIdFeriado('fe-guardar').addEventListener('click', guardarFeriado);
  porIdFeriado('fe-baja').addEventListener('click', (evento) => abrirModalBajaFeriado(evento.currentTarget));
  porIdFeriado('baja-feriado-desde').addEventListener('change', actualizarTextoDeLaBajaFeriado);
  porIdFeriado('baja-feriado-confirmar').addEventListener('click', confirmarBajaFeriado);
  document.addEventListener('keydown', alApretarEscapeEnFeriados);
}

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
  if (editar) editarDeLaListaFeriado(editar.dataset.editarFeriado, editar);
}

// Solo administración (el true literal: usuarios.js ya mandó al resto a la portada); los clics, delegados en la vista y en cada
// modal
function iniciarFeriados() {
  if (Auth.isAdmin() !== true) return;
  const vista = porIdFeriado('vista-feriados');
  if (!vista) return;
  vista.addEventListener('click', alHacerClicEnFeriados);
  porIdFeriado('btn-nuevo-feriado')?.addEventListener('click', (evento) => abrirModalFeriado(null, evento.currentTarget));
  iniciarModalesFeriado();
}

document.addEventListener('DOMContentLoaded', iniciarFeriados);
