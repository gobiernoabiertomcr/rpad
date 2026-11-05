// Pestaña Áreas de Configuración (spec 2026-10-24-configuracion, 4 y 6): la tabla de las áreas responsables, sus filtros, el aviso
// de las áreas a las que no les llega el aviso de los 40 días y los modales para cargar, editar y borrar un área.
// Lo que arma HTML y lo que calcula es puro y va primero; lo que toca el DOM o la API, al final. Al cargarse solo declara
// (tests/areas-frontend.test.js lo carga en un vm). En configuracion.html va después de usuarios.js: sus nombres de nivel superior
// no se repiten con los de config.js, auth.js, main.js, api.js ni usuarios.js (un let o un const repetido rompe el segundo script
// entero, y una function repetida pisa la otra). Escucha sus clics dentro de #vista-areas y de sus dos modales, con sus propios
// atributos (data-filtro-area, data-editar-area, data-borrar-area, data-cerrar-area y data-cerrar-borrar).

// =====================================================
// El estado de la pestaña
// =====================================================
let areasLista = null;            // las áreas de la vista de administración; null = todavía no llegaron o no se pudieron ver
let pedidoDeAreas = null;         // el pedido en curso: abrir la pestaña dos veces mientras llega la respuesta hace un solo pedido
let turnoDeAreas = 0;             // solo se pinta la respuesta del último pedido
let filtroArea = 'todas';
let avisoDeAreasPintado = null;   // el texto del aviso que está en la página (es role="status": no se repinta si no cambió)
let areaAbierta = null;           // el área del modal; null = un alta
let origenDelModalArea = null;    // el botón que abrió el modal del área
let idDelBorradoArea = null;      // el área que se pide borrar
let origenDelBorradoArea = null;  // el botón que abrió la confirmación ("Borrar el área", en el pie del modal del área)

// =====================================================
// Las constantes
// =====================================================
const TEXTO_AMBITO = Object.freeze({ municipal: 'Municipal', externo: 'Fuera del municipio' });

// Copia de MENSAJES_AREA.nombre (services/areasReglas.js), atada por un test de paridad: el navegador controla el nombre antes de
// enviar, con el mismo mensaje que el servidor
const MENSAJE_NOMBRE_AREA = 'Escribí el nombre del área.';
// La lista llegó sin la marca de la vista de administración, o un guardado o un borrado respondió 401 o 403 (spec 4.2 bis)
const MENSAJE_SESION_AREAS = 'Tu sesión ya no permite ver las áreas. Volvé a ingresar.';
const ENLACE_SESION_AREAS = 'Volvé a ingresar.';
const MENSAJE_ERROR_AREAS = 'No se pudieron cargar las áreas. Probá de nuevo en unos minutos.';

// El campo de un error del servidor → el id de su input; el error va en `${id}-error`. El del ámbito son los dos radios
// name="a-ambito", con su error (a-ambito-error) debajo de las dos opciones. Un campo que no está acá va al aviso de arriba
const CAMPO_DEL_ERROR_AREA = Object.freeze({
  nombre: 'a-nombre',
  email_principal: 'a-email-principal',
  email_secundario: 'a-email-secundario',
  email_contacto: 'a-contacto-email',
  ambito: 'a-ambito'
});

// Los 12 campos del formulario: el del área y el id de su control
const CAMPOS_DEL_FORMULARIO_AREA = Object.freeze([
  ['nombre', 'a-nombre'], ['articulo', 'a-articulo'], ['area_superior', 'a-superior'], ['articulo_superior', 'a-articulo-superior'],
  ['ambito', 'a-ambito'], ['email_principal', 'a-email-principal'], ['email_secundario', 'a-email-secundario'],
  ['telefono_area', 'a-telefono'], ['celular_area', 'a-celular'], ['nombre_contacto', 'a-contacto'],
  ['telefono_contacto', 'a-contacto-telefono'], ['email_contacto', 'a-contacto-email']
]);

const SPINNER_AREAS = '<div class="loading"><div class="spinner"></div></div>';
const NADA_AREA = '<span style="color: var(--suave)">—</span>';

// =====================================================
// Lo puro
// =====================================================

// Un dato como texto recortado ('' si no hay). Un número va con String: nunca se pierde el 0
const textoDeArea = (valor) => (valor === null || valor === undefined ? '' : String(valor).trim());
// Un dato como lo guarda el servidor: recortado, y lo vacío ('', solo espacios o null) en null
const valorDeArea = (valor) => textoDeArea(valor) || null;
// Todo texto dinámico pasa por escapeHtml (un número, con String: escapeHtml(0) daría '')
const escArea = (valor) => Utils.escapeHtml(valor === null || valor === undefined ? '' : String(valor));
// Para buscar: sin tildes ni mayúsculas
const sinTildesArea = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pluralArea = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// Una cuenta del servidor: lo que no es un entero positivo cuenta como 0
const cuentaDeArea = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 0;
};
// Las áreas de una lista (lo que no es un objeto se descarta: un dato raro no rompe la pestaña)
const listaDeAreas = (areas) => (Array.isArray(areas) ? areas.filter((a) => a !== null && typeof a === 'object') : []);
// Los artículos, como los arma la nota del Generador (articuloDe y deArticulo de services/notasGeneradorContenido.js): 'el' es
// "el" (y "de" + "el", "del"); cualquier otro valor, también null (el "—" del selector), es "la" ("de la")
const articuloDelArea = (articulo) => (articulo === 'el' ? 'el' : 'la');
const deArticuloArea = (articulo) => (articulo === 'el' ? 'del' : 'de la');

// Cómo se nombra el área en las notas, con el mismo armado que la nota del Generador: «la Dirección …, dependiente de la
// Secretaría …» («…, dependiente del Ministerio …» con 'el'; sin artículo, "de la"). Sin dependencia, solo el nombre; con el
// nombre vacío, «la …»
const comoSeNombra = (area) => {
  const { articulo, nombre, articulo_superior, area_superior } = area ?? {};
  const base = `${articuloDelArea(articulo)} ${textoDeArea(nombre) || '…'}`;
  const superior = textoDeArea(area_superior);
  return superior ? `${base}, dependiente ${deArticuloArea(articulo_superior)} ${superior}` : base;
};

// "Depende de la Secretaría …" ("Depende del …" con 'el', "de la" sin artículo) o "Sin dependencia cargada", debajo del nombre en
// la tabla
const textoDependenciaArea = (area) => {
  const superior = textoDeArea(area.area_superior);
  return superior ? `Depende ${deArticuloArea(area.articulo_superior)} ${superior}` : 'Sin dependencia cargada';
};

// Sin email principal ni secundario
const sinEmail = (area) => !textoDeArea(area?.email_principal) && !textoDeArea(area?.email_secundario);
// Sin email y con algún dataset que recibe el email de los 40 días (activo, de gestión externa, que requiere nota y con
// vencimiento: la cuenta la hace el servidor)
const sinAvisoDe40 = (area) => sinEmail(area) && cuentaDeArea(area?.datasets_externos_con_nota) > 0;
// Todos sus datasets: los activos y los dados de baja
const datasetsEnTotal = (area) => cuentaDeArea(area?.cantidad_datasets) + cuentaDeArea(area?.datasets_dados_de_baja);

const FILTROS_AREA = Object.freeze([
  { clave: 'todas', texto: 'Todas', pasa: () => true },
  { clave: 'municipal', texto: 'Municipales', pasa: (a) => a.ambito === 'municipal' },
  { clave: 'externo', texto: 'Fuera del municipio', pasa: (a) => a.ambito === 'externo' },
  { clave: 'sin-email', texto: 'Sin email', pasa: (a) => sinEmail(a) },
  // Es un filtro de datasets: no cuenta los cambios pendientes que la usan
  { clave: 'sin-datasets', texto: 'Sin datasets', pasa: (a) => datasetsEnTotal(a) === 0 }
]);

// El filtro de una clave; una desconocida es "Todas"
const filtroAreaDe = (clave) => FILTROS_AREA.find((f) => f.clave === clave) ?? FILTROS_AREA[0];

// ¿El área coincide con la búsqueda (ya sin tildes ni mayúsculas)? Por nombre, dependencia, emails o persona de contacto
const coincideArea = (area, busqueda) => !busqueda || [
  area.nombre, area.area_superior, area.email_principal, area.email_secundario, area.nombre_contacto, area.email_contacto
].some((campo) => sinTildesArea(campo).includes(busqueda));

// Las áreas que se ven: las del filtro que coinciden con la búsqueda, en el orden que llegan
const areasVisibles = (areas, filtro, busqueda) => {
  const { pasa } = filtroAreaDe(filtro);
  const q = sinTildesArea(busqueda).trim();
  return listaDeAreas(areas).filter((a) => pasa(a) && coincideArea(a, q));
};

// Los filtros como botones, con la cantidad del total (no de lo que deja el buscador). "Sin datasets", solo si hay alguna o si es
// el elegido (así no desaparece el botón del filtro que se está mirando)
const htmlDeFiltrosArea = (areas, elegido) => {
  const lista = listaDeAreas(areas);
  return FILTROS_AREA
    .filter((f) => f.clave !== 'sin-datasets' || f.clave === elegido || lista.some((a) => f.pasa(a)))
    .map((f) => `<button type="button" class="ar-chip" data-filtro-area="${f.clave}" aria-pressed="${f.clave === elegido}">${escArea(f.texto)} <b>${String(lista.filter((a) => f.pasa(a)).length)}</b></button>`)
    .join('');
};

const htmlDeAmbitoArea = (area) => (typeof area.ambito === 'string' && Object.hasOwn(TEXTO_AMBITO, area.ambito)
  ? `<span class="ar-etq ${area.ambito}">${escArea(TEXTO_AMBITO[area.ambito])}</span>`
  : NADA_AREA);

// Los emails del área, uno por renglón; sin ninguno, la etiqueta: roja si le toca el aviso de los 40 días, gris si no
const htmlDeEmailsArea = (area) => {
  if (sinAvisoDe40(area)) return '<span class="ar-etq sin-aviso">Sin email: no recibe el aviso de los 40 días</span>';
  if (sinEmail(area)) return '<span class="ar-etq sin-email">Sin email</span>';
  return [area.email_principal, area.email_secundario].map(textoDeArea).filter(Boolean).map(escArea).join('<br>');
};

// La persona de contacto: el nombre y, más chico, el teléfono y el email ("Sin teléfono ni email"). Sin nombre pero con el
// teléfono o el email, "Sin nombre" y lo que hay. Sin ningún dato, "—"
const htmlDeContactoArea = (area) => {
  const nombre = textoDeArea(area.nombre_contacto);
  const datos = [area.telefono_contacto, area.email_contacto].map(textoDeArea).filter(Boolean);
  if (!nombre && datos.length === 0) return NADA_AREA;
  const quien = nombre ? escArea(nombre) : '<span style="color: var(--suave)">Sin nombre</span>';
  return `${quien}<small>${escArea(datos.join(' · ') || 'Sin teléfono ni email')}</small>`;
};

const htmlDeFilaArea = (area) => `
      <tr>
        <td class="t"><b>${escArea(area.nombre)}</b><small>${escArea(textoDependenciaArea(area))}</small></td>
        <td>${htmlDeAmbitoArea(area)}</td>
        <td>${htmlDeEmailsArea(area)}</td>
        <td>${htmlDeContactoArea(area)}</td>
        <td class="num">${String(cuentaDeArea(area.cantidad_datasets))}</td>
        <td class="accion"><button type="button" class="ar-btn ar-btn-borde ar-btn-chico" data-editar-area="${escArea(area.id)}" aria-label="Editar ${escArea(area.nombre)}">Editar</button></td>
      </tr>`;

// La tabla (la variante que eligió el usuario), dentro de un marco que se desplaza de costado en pantallas angostas
const htmlDeTablaAreas = (areas) => `
  <div class="ar-tabla-marco"><table class="ar-tabla">
    <thead><tr><th scope="col">Área y dependencia</th><th scope="col">Ámbito</th><th scope="col">Emails del área</th><th scope="col">Persona de contacto</th><th scope="col" class="num">Datasets</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
    <tbody>${listaDeAreas(areas).map(htmlDeFilaArea).join('')}
    </tbody>
  </table></div>`;

// El aviso de arriba: cuántas áreas no reciben el aviso de los 40 días por no tener email; '' si no hay ninguna
const textoAvisoSinEmail = (areas) => {
  const n = listaDeAreas(areas).filter(sinAvisoDe40).length;
  if (n === 0) return '';
  return n === 1
    ? '1 área con datasets de gestión externa no tiene email cargado: no le llega el aviso de los 40 días.'
    : `${n} áreas con datasets de gestión externa no tienen email cargado: no les llega el aviso de los 40 días.`;
};

// El pie del modal, a la izquierda: en un alta, "Se guarda al confirmar."; un área sin datasets (activos o dados de baja) ni
// cambios pendientes que la usen se puede borrar; si no, por qué no
const textoPieDelArea = (area) => {
  if (!area) return { borrar: false, texto: 'Se guarda al confirmar.' };
  const total = datasetsEnTotal(area);
  if (total > 0) {
    return { borrar: false, texto: `Tiene ${pluralArea(total, 'dataset', 'datasets')}: para borrarla, primero hay que ${total === 1 ? 'pasarlo' : 'pasarlos'} a otra área.` };
  }
  const pendientes = cuentaDeArea(area.cambios_pendientes_que_la_usan);
  if (pendientes === 1) return { borrar: false, texto: 'Un cambio pendiente la usa: para borrarla, primero hay que aprobarlo o rechazarlo.' };
  if (pendientes > 1) return { borrar: false, texto: `${pendientes} cambios pendientes la usan: para borrarla, primero hay que aprobarlos o rechazarlos.` };
  return { borrar: true, texto: '' };
};

// Los 12 campos del formulario, normalizados como los guarda el servidor (que valida igual): recortados y lo vacío en null. El
// nombre queda como texto ('' si está vacío) para el control de antes de enviar. `leerCampo(id)` da el valor de cada control
const datosDelFormularioArea = (leerCampo) => Object.fromEntries(CAMPOS_DEL_FORMULARIO_AREA.map(([campo, id]) => {
  const valor = typeof leerCampo === 'function' ? leerCampo(id) : '';
  return [campo, campo === 'nombre' ? textoDeArea(valor) : valorDeArea(valor)];
}));

// Lo que cambió respecto del área que se abrió: solo eso se manda al editar (spec 4.2). '' y null son lo mismo, y los espacios de
// los extremos no cuentan: así un formulario abierto con datos incompletos nunca pisa con NULL lo guardado
const cambiosDelArea = (datos, area) => {
  const nuevos = datos !== null && typeof datos === 'object' ? datos : {};
  const guardada = area !== null && typeof area === 'object' ? area : {};
  const cambios = {};
  for (const [campo] of CAMPOS_DEL_FORMULARIO_AREA) {
    if (!Object.hasOwn(nuevos, campo)) continue;
    const valor = valorDeArea(nuevos[campo]);
    if (valor !== valorDeArea(guardada[campo])) cambios[campo] = valor;
  }
  return cambios;
};

// ¿Es la vista de administración? La marca la pone la API (`vista: 'administracion'`): no se deduce porque falte un campo
const esVistaDeAdministracion = (respuesta) => respuesta !== null && typeof respuesta === 'object'
  && respuesta.success === true && respuesta.vista === 'administracion' && Array.isArray(respuesta.data);

// El mensaje de la sesión, con "Volvé a ingresar." como link a login.html
const htmlDeSesionAreas = () => escArea(MENSAJE_SESION_AREAS)
  .replace(escArea(ENLACE_SESION_AREAS), `<a href="login.html">${escArea(ENLACE_SESION_AREAS)}</a>`);

// Un guardado o un borrado que la sesión ya no permite
const esFallaDeSesionArea = (falla) => falla?.status === 401 || falla?.status === 403;

// =====================================================
// DOM y API
// =====================================================
const porIdArea = (id) => document.getElementById(id);
const radiosDelAmbitoArea = () => [...document.querySelectorAll('input[name="a-ambito"]')];
// Los controles de un campo con error: el input o, en el ámbito, los dos radios
const controlesDelErrorArea = (id) => (id === 'a-ambito' ? radiosDelAmbitoArea() : [porIdArea(id)].filter(Boolean));
const leerCampoArea = (id) => (id === 'a-ambito'
  ? (document.querySelector('input[name="a-ambito"]:checked')?.value ?? '')
  : (porIdArea(id)?.value ?? ''));
const buscarAreaPorId = (id) => listaDeAreas(areasLista).find((a) => String(a.id) === String(id)) ?? null;
// showToast inserta HTML: el mensaje del servidor se escapa
const avisarArea = (mensaje) => showToast(escArea(mensaje), 'success');

// La lista: se pide la primera vez que se abre la pestaña (usuarios.js la llama al mostrar Áreas) y, con `forzar`, después de
// guardar o borrar. Mientras no se fuerce, abrir la pestaña otra vez no la vuelve a pedir
async function cargarAreas(forzar = false) {
  if (!forzar && areasLista) return pintarAreas();
  if (!forzar && pedidoDeAreas) return pedidoDeAreas;
  const turno = ++turnoDeAreas;
  if (!areasLista) porIdArea('areas-lista').innerHTML = SPINNER_AREAS;
  const pedido = pedirAreas(turno);
  pedidoDeAreas = pedido;
  try {
    await pedido;
  } finally {
    if (pedidoDeAreas === pedido) pedidoDeAreas = null;
  }
}

// Pide la lista y la pinta, si nadie la pidió después (`turno`). Sin la marca de la vista de administración, el aviso de la
// sesión; si falla el pedido o el dibujo, el error: nunca una lista vacía
async function pedirAreas(turno) {
  let respuesta = null;
  let falla = null;
  try {
    respuesta = await API.pedirJson('GET', '/areas');
  } catch (error) {
    falla = error ?? new Error('');
  }
  if (turno !== turnoDeAreas) return;
  if (falla) {
    if (esFallaDeSesionArea(falla)) pintarSinSesionAreas();
    else pintarErrorAreas();
    return;
  }
  if (!esVistaDeAdministracion(respuesta)) {
    pintarSinSesionAreas();
    return;
  }
  areasLista = listaDeAreas(respuesta.data);
  try {
    pintarAreas();
  } catch (error) {
    console.error('Error dibujando las áreas:', error);
    pintarErrorAreas();
  }
}

function pintarAreas() {
  if (!areasLista) return;
  const areas = listaDeAreas(areasLista);
  const visibles = areasVisibles(areas, filtroArea, porIdArea('buscar-area')?.value ?? '');
  porIdArea('areas-contador').textContent = pluralArea(areas.length, 'área', 'áreas');
  porIdArea('areas-filtros').innerHTML = htmlDeFiltrosArea(areas, filtroArea);
  pintarAvisoDeAreas(textoAvisoSinEmail(areas));
  porIdArea('areas-lista').innerHTML = visibles.length > 0 ? htmlDeTablaAreas(visibles) : '';
  porIdArea('areas-vacio').hidden = visibles.length > 0;
  porIdArea('btn-nueva-area').disabled = false;
}

// El aviso de las áreas sin email, con el botón que elige el filtro "Sin email". Solo se vuelve a escribir si cambió el texto
function pintarAvisoDeAreas(texto) {
  const caja = porIdArea('areas-aviso');
  caja.hidden = !texto;
  if (texto === avisoDeAreasPintado) return;
  avisoDeAreasPintado = texto;
  caja.innerHTML = texto
    ? `<span>${escArea(texto)}</span><button type="button" data-filtro-area="sin-email">Ver las áreas sin email</button>`
    : '';
}

// En lugar de la tabla, un aviso: sin tabla, sin filtros, sin contador y sin el aviso de los 40 días
function pintarEstadoDeAreas(html) {
  areasLista = null;
  porIdArea('areas-lista').innerHTML = html;
  porIdArea('areas-contador').textContent = '';
  porIdArea('areas-filtros').innerHTML = '';
  pintarAvisoDeAreas('');
  porIdArea('areas-vacio').hidden = true;
}

function pintarSinSesionAreas() {
  pintarEstadoDeAreas(`<p class="aviso aviso-error">${htmlDeSesionAreas()}</p>`);
  porIdArea('btn-nueva-area').disabled = true;
}

function pintarErrorAreas() {
  pintarEstadoDeAreas(`<p class="aviso aviso-error">${escArea(MENSAJE_ERROR_AREAS)}</p>`);
}

// Un clic en un filtro (o en el botón del aviso) lo elige; el foco queda en su botón, que se volvió a dibujar
function elegirFiltroArea(clave) {
  filtroArea = filtroAreaDe(clave).clave;
  pintarAreas();
  porIdArea('areas-filtros').querySelector(`[data-filtro-area="${filtroArea}"]`)?.focus();
}

// El foco vuelve al botón que abrió el modal. Si la lista se volvió a dibujar, al "Editar" nuevo de la misma área; si ya no está
// (se borró), al buscador
function devolverFocoArea(origen) {
  if (origen && origen.isConnected !== false) {
    origen.focus?.();
    return;
  }
  const id = origen?.dataset?.editarArea;
  const nuevo = /^\d+$/.test(id ?? '') ? document.querySelector(`[data-editar-area="${id}"]`) : null;
  (nuevo ?? porIdArea('buscar-area'))?.focus?.();
}

function actualizarLecturaArea() {
  porIdArea('a-lectura').textContent = comoSeNombra({
    articulo: leerCampoArea('a-articulo'), nombre: leerCampoArea('a-nombre'),
    articulo_superior: leerCampoArea('a-articulo-superior'), area_superior: leerCampoArea('a-superior')
  });
}

function limpiarErroresArea() {
  const caja = porIdArea('area-error');
  caja.textContent = '';
  caja.hidden = true;
  for (const id of Object.values(CAMPO_DEL_ERROR_AREA)) {
    const error = porIdArea(`${id}-error`);
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
    controlesDelErrorArea(id).forEach((control) => control.removeAttribute('aria-invalid'));
  }
}

// Un error con campo va debajo del campo (aria-invalid y el foco al campo; en el ámbito, al radio elegido o al primero); uno sin
// campo, o de un campo sin lugar propio, al aviso de arriba del cuerpo. Devuelve true si fue a un campo
function mostrarErrorArea(mensaje, campo) {
  const id = typeof campo === 'string' && Object.hasOwn(CAMPO_DEL_ERROR_AREA, campo) ? CAMPO_DEL_ERROR_AREA[campo] : null;
  const error = id ? porIdArea(`${id}-error`) : null;
  const controles = id ? controlesDelErrorArea(id) : [];
  if (!error || controles.length === 0) {
    const caja = porIdArea('area-error');
    caja.textContent = mensaje;
    caja.hidden = false;
    return false;
  }
  error.textContent = mensaje;
  error.hidden = false;
  controles.forEach((control) => control.setAttribute('aria-invalid', 'true'));
  (controles.find((control) => control.checked) ?? controles[0]).focus();
  return true;
}

// El mensaje de la sesión en el aviso de un modal (con el link a login.html)
function mostrarSesionEnModalArea(idCaja) {
  const caja = porIdArea(idCaja);
  caja.innerHTML = htmlDeSesionAreas();
  caja.hidden = false;
}

function pintarPieDelArea() {
  const { borrar, texto } = textoPieDelArea(areaAbierta);
  porIdArea('area-pie-izquierda').innerHTML = borrar
    ? `<button type="button" class="ar-boton-texto" data-borrar-area="${escArea(areaAbierta.id)}">Borrar el área</button>`
    : `<small>${escArea(texto)}</small>`;
}

// Abre el modal: con un área, para editarla; con null, un alta (artículo "la" y ámbito Municipal, el valor por defecto de la
// columna). El foco va al nombre; al cerrar, vuelve a `origen`
function abrirModalArea(area, origen) {
  areaAbierta = area ?? null;
  origenDelModalArea = origen ?? document.activeElement ?? null;
  limpiarErroresArea();
  const valor = (campo, porDefecto = '') => String((areaAbierta ? areaAbierta[campo] : null) ?? porDefecto);
  porIdArea('modal-area-titulo').textContent = areaAbierta ? 'Editar área' : 'Nueva área';
  for (const [campo, id] of CAMPOS_DEL_FORMULARIO_AREA) {
    if (id !== 'a-ambito') porIdArea(id).value = valor(campo, campo === 'articulo' ? 'la' : '');
  }
  const ambito = valor('ambito', 'municipal');
  radiosDelAmbitoArea().forEach((radio) => { radio.checked = radio.value === ambito; });
  pintarPieDelArea();
  actualizarLecturaArea();
  porIdArea('area-guardar').disabled = false;
  porIdArea('modal-area').classList.add('active');
  setTimeout(() => porIdArea('a-nombre').focus(), 100);
}

function cerrarModalArea() {
  porIdArea('modal-area').classList.remove('active');
  const origen = origenDelModalArea;
  areaAbierta = null;
  origenDelModalArea = null;
  devolverFocoArea(origen);
}

// Guardar: el nombre se controla antes de enviar. En un alta se mandan los 12 campos; al editar, solo lo que cambió, y sin ningún
// cambio se cierra sin pedir nada. Un error del servidor queda en el modal; un 401 o un 403, el mensaje de la sesión, y la lista
// no se vuelve a pedir. Si sale bien: el aviso del servidor, se cierra y se vuelve a pedir la lista
async function guardarArea() {
  const boton = porIdArea('area-guardar');
  if (boton.disabled) return;
  limpiarErroresArea();
  const datos = datosDelFormularioArea(leerCampoArea);
  if (!datos.nombre) {
    mostrarErrorArea(MENSAJE_NOMBRE_AREA, 'nombre');
    return;
  }
  const editada = areaAbierta;
  const cuerpo = editada ? cambiosDelArea(datos, editada) : datos;
  if (editada && Object.keys(cuerpo).length === 0) {
    cerrarModalArea();
    return;
  }

  let respuesta = null;
  let falla = null;
  boton.disabled = true;
  try {
    respuesta = editada
      ? await API.pedirJson('PUT', `/areas/${encodeURIComponent(editada.id)}`, cuerpo)
      : await API.pedirJson('POST', '/areas', cuerpo);
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    boton.disabled = false;
  }

  if (falla) {
    if (esFallaDeSesionArea(falla)) {
      mostrarSesionEnModalArea('area-error');
      boton.focus();
    } else if (!mostrarErrorArea(falla.message, falla.campo)) {
      boton.focus();
    }
    return;
  }

  avisarArea(respuesta?.message || (editada ? 'Área actualizada correctamente' : 'Área creada correctamente'));
  const origen = origenDelModalArea;
  cerrarModalArea();
  await cargarAreas(true);
  devolverFocoArea(origen);
}

// "Borrar el área" (en el pie del modal, solo sin datasets ni cambios pendientes): la confirmación, con el foco en "Cancelar"
function pedirBorradoArea(id, origen) {
  const area = buscarAreaPorId(id) ?? (areaAbierta && String(areaAbierta.id) === String(id) ? areaAbierta : null);
  if (!area) return;
  idDelBorradoArea = area.id;
  origenDelBorradoArea = origen ?? document.activeElement ?? null;
  porIdArea('borrar-area-texto').textContent =
    `¿Borrar el área «${textoDeArea(area.nombre)}»? No tiene datasets. Se borra del todo y no se puede deshacer.`;
  const error = porIdArea('borrar-area-error');
  error.textContent = '';
  error.hidden = true;
  porIdArea('borrar-area-confirmar').disabled = false;
  const modal = porIdArea('modal-borrar-area');
  modal.classList.add('active');
  setTimeout(() => {
    const cancelar = modal.querySelector('.modal-footer [data-cerrar-borrar]') ?? modal.querySelector('[data-cerrar-borrar]');
    cancelar?.focus();
  }, 100);
}

// Cierra la confirmación y deja abierto el modal del área, con el foco en "Borrar el área"
function cerrarModalBorrarArea() {
  porIdArea('modal-borrar-area').classList.remove('active');
  const origen = origenDelBorradoArea;
  origenDelBorradoArea = null;
  idDelBorradoArea = null;
  if (porIdArea('modal-area').classList.contains('active')) devolverFocoArea(origen);
}

// Borrar de verdad: si el servidor lo rechaza (por ejemplo, porque mientras tanto se le asignó un dataset), el mensaje queda en
// la confirmación; un 401 o un 403, el de la sesión, y la lista no se vuelve a pedir. Si sale bien, se cierran los dos modales y
// se vuelve a pedir la lista
async function confirmarBorradoArea() {
  const boton = porIdArea('borrar-area-confirmar');
  if (boton.disabled || idDelBorradoArea === null) return;
  const caja = porIdArea('borrar-area-error');
  caja.textContent = '';
  caja.hidden = true;

  let respuesta = null;
  let falla = null;
  boton.disabled = true;
  try {
    respuesta = await API.pedirJson('DELETE', `/areas/${encodeURIComponent(idDelBorradoArea)}`);
  } catch (error) {
    falla = error ?? new Error('');
  } finally {
    boton.disabled = false;
  }

  if (falla) {
    if (esFallaDeSesionArea(falla)) {
      mostrarSesionEnModalArea('borrar-area-error');
    } else {
      caja.textContent = falla.message;
      caja.hidden = false;
    }
    boton.focus();
    return;
  }

  avisarArea(respuesta?.message || 'Área eliminada correctamente');
  const origen = origenDelModalArea;
  porIdArea('modal-borrar-area').classList.remove('active');
  origenDelBorradoArea = null;
  idDelBorradoArea = null;
  porIdArea('modal-area').classList.remove('active');
  areaAbierta = null;
  origenDelModalArea = null;
  await cargarAreas(true);
  devolverFocoArea(origen);
}

function alHacerClicEnAreas(evento) {
  const filtro = evento.target.closest('[data-filtro-area]');
  if (filtro) {
    elegirFiltroArea(filtro.dataset.filtroArea);
    return;
  }
  const editar = evento.target.closest('[data-editar-area]');
  if (editar) {
    const area = buscarAreaPorId(editar.dataset.editarArea);
    if (area) abrirModalArea(area, editar);
  }
}

function alHacerClicEnModalArea(evento) {
  if (evento.target.closest('[data-cerrar-area]')) {
    cerrarModalArea();
    return;
  }
  const borrar = evento.target.closest('[data-borrar-area]');
  if (borrar) pedirBorradoArea(borrar.dataset.borrarArea, borrar);
}

// Escape cierra solo los modales de esta pestaña: primero la confirmación de borrar y después el del área. Un clic en el velo no
// los cierra, como en Usuarios, para no perder lo escrito
function alApretarEscapeEnAreas(evento) {
  if (evento.key !== 'Escape') return;
  if (porIdArea('modal-borrar-area').classList.contains('active')) cerrarModalBorrarArea();
  else if (porIdArea('modal-area').classList.contains('active')) cerrarModalArea();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAdmin()) return;
  const vista = porIdArea('vista-areas');
  if (!vista) return;
  porIdArea('buscar-area').addEventListener('input', () => pintarAreas());
  porIdArea('btn-nueva-area').addEventListener('click', (evento) => abrirModalArea(null, evento.currentTarget));
  vista.addEventListener('click', alHacerClicEnAreas);
  porIdArea('modal-area').addEventListener('click', alHacerClicEnModalArea);
  porIdArea('modal-borrar-area').addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar-borrar]')) cerrarModalBorrarArea();
  });
  for (const id of ['a-nombre', 'a-articulo', 'a-superior', 'a-articulo-superior']) {
    porIdArea(id).addEventListener('input', actualizarLecturaArea);
  }
  porIdArea('area-guardar').addEventListener('click', guardarArea);
  porIdArea('borrar-area-confirmar').addEventListener('click', confirmarBorradoArea);
  document.addEventListener('keydown', alApretarEscapeEnAreas);
});
