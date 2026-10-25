/**
 * Perfil - RPAD
 * Mi Perfil en pestañas: Para revisar y Mis cambios (la gestión de cambios, solo quien administra), Mis datos y Mi firma
 */

// Si quien mira es personal contratado (usuarios.vinculo = 'contrato'): su firma lleva una muestra (cargarPerfil lo lee)
let perfilContratado = false;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // La barra y la pestaña inicial se ven enseguida, sin esperar los datos del perfil: alcanza con el rol guardado
  // (el servidor igual decide qué puede ver y hacer cada uno)
  const esAdmin = Auth.isAdmin();
  if (esAdmin) {
    // Quien administra ve las cuatro pestañas: revisar, sus cambios, sus datos y su firma
    document.getElementById('pestanas-perfil').hidden = false;
    conectarPestanas();
  }
  // Un lector solo tiene sus datos personales: sin barra de pestañas ni nada de la gestión de cambios
  mostrarPestana(pestanaInicial(location.hash, esAdmin));

  // Cargar datos del perfil
  await cargarPerfil();

  // Los formularios quedan conectados antes de cualquier carga larga
  setupEventos();

  // Cambiar de pestaña con el hash de la dirección (el botón atrás, un enlace a #mis-cambios)
  window.addEventListener('hashchange', () => mostrarPestana(pestanaInicial(location.hash, Auth.isAdmin())));

  if (esAdmin) {
    document.getElementById('form-firma').addEventListener('submit', guardarMiFirma);
    for (const id of ['firma-nombre', 'firma-cargo']) document.getElementById(id).addEventListener('input', actualizarMuestraFirma);
    document.getElementById('firma-archivo').addEventListener('change', mostrarImagenElegida);
    // Los controles de las listas de cambios se conectan solo acá: un lector no toca nada de la gestión de cambios
    conectarListasDeCambios();
    cargarMiFirma();
    await Promise.all([cargarCambiosParaRevisar(), cargarMisCambios()]);
    await actualizarCuentas();
  }
});

/**
 * Cargar datos del perfil
 */
async function cargarPerfil() {
  try {
    const user = await API.getProfile();
    document.getElementById('perfil-username').value = user.username;
    document.getElementById('perfil-nombre').value = user.nombre_completo;
    document.getElementById('perfil-email').value = user.email;

    // Cargo y vínculo: solo lectura, los actualiza un administrador desde el panel de usuarios
    const cargo = Utils.textoCargo(user.cargo, user.vinculo);
    const vinculo = Utils.textoVinculo(user.vinculo);
    document.getElementById('perfil-cargo').value = cargo;
    document.getElementById('perfil-cargo-grupo').style.display = cargo ? '' : 'none';
    document.getElementById('perfil-vinculo').value = vinculo;
    document.getElementById('perfil-vinculo-grupo').style.display = vinculo ? '' : 'none';
    perfilContratado = user.vinculo === 'contrato';
  } catch (error) {
    console.error('Error cargando perfil:', error);
    Utils.showError('Error al cargar datos del perfil');
  }
}

/**
 * Setup de eventos
 */
function setupEventos() {
  // Formulario de perfil
  document.getElementById('form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarPerfil();
  });

  // Formulario de contraseña
  document.getElementById('form-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    await cambiarPassword();
  });
}

// =====================================================
// PESTAÑAS
// =====================================================
// Muestra una pestaña y su panel, oculta las demás y deja el nombre en el hash (sin sumar una entrada al historial)
function mostrarPestana(nombre) {
  for (const otra of PESTANAS_DEL_PERFIL) {
    const activa = otra === nombre;
    const pestana = document.getElementById(`pestana-${otra}`);
    pestana.setAttribute('aria-selected', String(activa));
    pestana.tabIndex = activa ? 0 : -1;
    pestana.classList.toggle('activa', activa);
    document.getElementById(`vista-${otra}`).hidden = !activa;
  }
  history.replaceState(null, '', `#${nombre}`);
}

// Teclado en la barra: flechas (con vuelta), inicio y fin. Mueven el foco y activan la pestaña. Con Alt, Ctrl o Cmd son
// atajos del navegador (Alt+flecha izquierda vuelve atrás): no se tocan.
function teclaEnPestanas(evento) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const actual = PESTANAS_DEL_PERFIL.indexOf(evento.target.dataset?.vista);
  if (actual === -1) return;
  const ultima = PESTANAS_DEL_PERFIL.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault();
  mostrarPestana(PESTANAS_DEL_PERFIL[destino]);
  document.getElementById(`pestana-${PESTANAS_DEL_PERFIL[destino]}`).focus();
}

// El clic en cada pestaña y el teclado en la barra
function conectarPestanas() {
  for (const nombre of PESTANAS_DEL_PERFIL) {
    document.getElementById(`pestana-${nombre}`).addEventListener('click', () => mostrarPestana(nombre));
  }
  document.getElementById('pestanas-perfil').addEventListener('keydown', teclaEnPestanas);
}

/**
 * Guardar cambios del perfil
 */
async function guardarPerfil() {
  const btn = document.getElementById('btn-guardar-perfil');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const datos = {
      nombre_completo: document.getElementById('perfil-nombre').value.trim(),
      email: document.getElementById('perfil-email').value.trim()
    };

    const userActualizado = await API.updateProfile(datos);
    
    // Actualizar datos en localStorage
    const currentUser = Auth.getUser();
    currentUser.nombre_completo = userActualizado.nombre_completo;
    currentUser.email = userActualizado.email;
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(currentUser));
    
    Utils.showSuccess('Perfil actualizado correctamente');
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar Cambios';
  }
}

/**
 * Cambiar contraseña
 */
async function cambiarPassword() {
  const passwordActual = document.getElementById('password-actual').value;
  const passwordNueva = document.getElementById('password-nueva').value;
  const passwordConfirmar = document.getElementById('password-confirmar').value;

  if (passwordNueva !== passwordConfirmar) {
    Utils.showError('Las contraseñas no coinciden');
    return;
  }

  const btn = document.getElementById('btn-cambiar-password');
  btn.disabled = true;
  btn.textContent = 'Cambiando...';

  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/change-password`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({
        currentPassword: passwordActual,
        newPassword: passwordNueva
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al cambiar contraseña');
    }

    // El servidor cierra las demás sesiones y devuelve un token nuevo para esta (spec 5.2)
    if (data.data?.token) {
      Auth.saveSession(data.data.token, Auth.getUser());
    }

    Utils.showSuccess('Contraseña cambiada correctamente');
    document.getElementById('form-password').reset();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cambiar Contraseña';
  }
}

// =====================================================
// GESTIÓN DE CAMBIOS: LISTAS (spec 2026-10-16-perfil-pestanas-gestion-cambios, 5 y 6)
// =====================================================
// Solo quien administra las carga y las toca (DOMContentLoaded). Cada lista guarda lo cargado y muestra de a 20 filas
// ("Ver 20 más" pagina del lado del cliente). `pedido` numera las cargas: si llega la respuesta de una carga vieja después
// de la de una más nueva (un cambio rápido de filtro), se descarta.
const FILAS_POR_TANDA = 20;
const vistaParaRevisar = { segmento: 'pendientes', cambios: [], visibles: FILAS_POR_TANDA, pedido: 0 };
const vistaMisCambios = { filtro: 'todos', pendientes: [], resueltos: [], visibles: FILAS_POR_TANDA, pedido: 0 };
const FILA_CARGANDO = '<li class="pf-cargando"><div class="loading"><div class="spinner"></div></div></li>';
const ERROR_DE_CARGA = 'No se pudieron cargar los cambios. Probá recargar la página.';

// Quién mira: si es editor (ve la marca de auditoría) y su id (lo propio no tiene botones)
function quienMira() {
  const usuario = Auth.getUser();
  return { esEditor: usuario?.rol === 'editor', idUsuario: Number(usuario?.id) };
}

// Las filas de una lista, de `desde` a `hasta`. En los pendientes de Para revisar, la primera va abierta.
function htmlDeFilas(cambios, modo, desde, hasta) {
  const quien = quienMira();
  return cambios.slice(desde, hasta)
    .map((cambio, i) => htmlDeFila(cambio, modo, { ...quien, abierto: modo === 'revisar' && desde + i === 0 }))
    .join('');
}

const modoDeParaRevisar = () => (vistaParaRevisar.segmento === 'pendientes' ? 'revisar' : 'revisado');

// Los cambios resueltos, los revisados más recientes primero (el servidor los manda por fecha de propuesta). Sin fecha de
// revisión van al final; a igual fecha quedan como vinieron.
function porRevisionReciente(cambios) {
  const momento = (cambio) => new Date(cambio.revisado_at).getTime() || 0;
  return [...cambios].sort((uno, otro) => momento(otro) - momento(uno));
}

/**
 * Para revisar: los cambios ajenos pendientes o, en Revisados, los ya aprobados o rechazados (por cualquiera).
 * conEspera: false al recargar después de aprobar o rechazar, así la lista no parpadea con la ruedita.
 */
async function cargarCambiosParaRevisar({ conEspera = true } = {}) {
  const lista = document.getElementById('lista-para-revisar');
  const mas = document.getElementById('mas-para-revisar');
  const tipo = document.getElementById('filtro-revisar-tipo').value;
  const pendientes = vistaParaRevisar.segmento === 'pendientes';
  const pedido = ++vistaParaRevisar.pedido;
  if (conEspera) {
    lista.innerHTML = FILA_CARGANDO;
    mas.hidden = true;
  }

  try {
    const cambios = await API.getCambiosPendientesParaRevisar({ tipo: tipo || null, estado: pendientes ? 'pendiente' : 'todos' });
    if (pedido !== vistaParaRevisar.pedido) return;
    vistaParaRevisar.cambios = pendientes ? cambios : porRevisionReciente(cambios.filter(cambio => cambio.estado !== 'pendiente'));
    const { cambios: aMostrar, visibles, segmento } = vistaParaRevisar;
    lista.innerHTML = aMostrar.length ? htmlDeFilas(aMostrar, modoDeParaRevisar(), 0, visibles) : htmlDeVacioParaRevisar(segmento, tipo);
    mas.hidden = aMostrar.length <= visibles;
  } catch (error) {
    if (pedido !== vistaParaRevisar.pedido) return;
    console.error('Error cargando cambios para revisar:', error);
    lista.innerHTML = htmlDeVacio(ERROR_DE_CARGA);
    mas.hidden = true;
  }
}

/**
 * Mis cambios: todos los propios en un solo pedido, separados en Esperando auditoría y Resueltos. La cuenta de la pestaña
 * sale de esta misma lista (actualizarCuentas).
 */
async function cargarMisCambios() {
  const pedido = ++vistaMisCambios.pedido;
  try {
    const cambios = await API.getMisCambios({ estado: 'todos' });
    if (pedido !== vistaMisCambios.pedido) return;
    vistaMisCambios.pendientes = cambios.filter(cambio => cambio.estado === 'pendiente');
    vistaMisCambios.resueltos = porRevisionReciente(cambios.filter(cambio => cambio.estado !== 'pendiente'));
    pintarMisCambios();
  } catch (error) {
    if (pedido !== vistaMisCambios.pedido) return;
    console.error('Error cargando mis cambios:', error);
    document.getElementById('grupo-mios-pendientes').hidden = true;
    document.getElementById('lista-mios-resueltos').innerHTML = htmlDeVacio(ERROR_DE_CARGA);
    document.getElementById('mas-mios').hidden = true;
  }
}

// Los resueltos propios con el filtro del selector (Todos, Aprobados o Rechazados)
function resueltosFiltrados() {
  const { resueltos, filtro } = vistaMisCambios;
  return filtro === 'todos' ? resueltos : resueltos.filter(cambio => cambio.estado === filtro);
}

function pintarMisCambios() {
  const { pendientes, resueltos, filtro, visibles } = vistaMisCambios;
  document.getElementById('grupo-mios-pendientes').hidden = pendientes.length === 0;
  document.getElementById('lista-mios-pendientes').innerHTML = htmlDeFilas(pendientes, 'mio', 0, pendientes.length);
  const filtrados = resueltosFiltrados();
  document.getElementById('lista-mios-resueltos').innerHTML = filtrados.length
    ? htmlDeFilas(filtrados, 'mio', 0, visibles)
    : htmlDeVacioMisCambios(filtro, pendientes.length + resueltos.length > 0);
  document.getElementById('mas-mios').hidden = filtrados.length <= visibles;
}

// "Ver 20 más": suma la próxima tanda al final de la lista (las filas que ya están quedan como estaban, abiertas o
// cerradas) y lleva el foco a la primera nueva
function agregarTanda(vista, cambios, modo, idLista, idBoton) {
  const desde = vista.visibles;
  vista.visibles += FILAS_POR_TANDA;
  const lista = document.getElementById(idLista);
  lista.insertAdjacentHTML('beforeend', htmlDeFilas(cambios, modo, desde, vista.visibles));
  document.getElementById(idBoton).hidden = cambios.length <= vista.visibles;
  lista.querySelectorAll('.pf-cambio-cabeza')[desde]?.focus();
}

// Abre o cierra la fila de esa cabecera
function desplegarFila(cabeza, abrir) {
  cabeza.setAttribute('aria-expanded', String(abrir));
  cabeza.closest('.pf-cambio').classList.toggle('abierto', abrir);
  document.getElementById(cabeza.getAttribute('aria-controls')).hidden = !abrir;
}

// Abre o cierra la fila cuya cabecera se tocó (clic delegado en cada lista)
function alternarFila(evento) {
  const cabeza = evento.target.closest('.pf-cambio-cabeza');
  if (!cabeza) return;
  desplegarFila(cabeza, cabeza.getAttribute('aria-expanded') !== 'true');
}

// Marca el botón elegido de un selector segmentado
function marcarSegmento(idSegmento, elegido) {
  for (const boton of document.getElementById(idSegmento).querySelectorAll('button')) {
    boton.setAttribute('aria-pressed', String(boton === elegido));
  }
}

// Los selectores, el filtro de tipo, "Ver 20 más" y el clic en las filas
function conectarListasDeCambios() {
  document.getElementById('segmento-revisar').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-segmento]');
    if (!boton || boton.dataset.segmento === vistaParaRevisar.segmento) return;
    vistaParaRevisar.segmento = boton.dataset.segmento === 'revisados' ? 'revisados' : 'pendientes';
    vistaParaRevisar.visibles = FILAS_POR_TANDA;
    marcarSegmento('segmento-revisar', boton);
    cargarCambiosParaRevisar();
  });
  document.getElementById('filtro-revisar-tipo').addEventListener('change', () => {
    vistaParaRevisar.visibles = FILAS_POR_TANDA;
    cargarCambiosParaRevisar();
  });
  document.getElementById('mas-para-revisar').addEventListener('click', () => {
    agregarTanda(vistaParaRevisar, vistaParaRevisar.cambios, modoDeParaRevisar(), 'lista-para-revisar', 'mas-para-revisar');
  });

  document.getElementById('segmento-mios').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-filtro]');
    if (!boton || !['todos', 'aprobado', 'rechazado'].includes(boton.dataset.filtro)) return;
    vistaMisCambios.filtro = boton.dataset.filtro;
    vistaMisCambios.visibles = FILAS_POR_TANDA;
    marcarSegmento('segmento-mios', boton);
    pintarMisCambios();
  });
  document.getElementById('mas-mios').addEventListener('click', () => {
    agregarTanda(vistaMisCambios, resueltosFiltrados(), 'mio', 'lista-mios-resueltos', 'mas-mios');
  });

  for (const id of ['lista-para-revisar', 'lista-mios-pendientes', 'lista-mios-resueltos']) {
    document.getElementById(id).addEventListener('click', alternarFila);
  }
}

/**
 * La cuenta de una pestaña: el número, o nada si no hay cambios
 */
function mostrarCuenta(id, cantidad) {
  const cuenta = document.getElementById(id);
  cuenta.textContent = cantidad > 0 ? String(cantidad) : '';
  cuenta.hidden = !(cantidad > 0);
}

/**
 * Las cuentas de las pestañas: Para revisar con el contador de la campana (los pendientes ajenos, sin el filtro de la
 * lista) y Mis cambios con los pendientes propios de la lista ya cargada (sin pedirla otra vez)
 */
async function actualizarCuentas() {
  mostrarCuenta('cuenta-mis-cambios', vistaMisCambios.pendientes.length);
  try {
    const { cantidad } = await API.getContadorPendientes();
    mostrarCuenta('cuenta-para-revisar', cantidad);
  } catch (error) {
    console.error('Error actualizando las cuentas:', error);
  }
}

// Después de aprobar o rechazar: las dos listas, las cuentas y la campana del encabezado (main.js)
async function recargarCambios() {
  await Promise.all([cargarCambiosParaRevisar({ conEspera: false }), cargarMisCambios()]);
  await actualizarCuentas();
  if (typeof cargarContadorNotificaciones === 'function') cargarContadorNotificaciones();
}

/**
 * Calcular tiempo relativo
 */
function calcularTiempoRelativo(fecha) {
  const ahora = new Date();
  const fechaCambio = new Date(fecha);
  const diffMs = ahora - fechaCambio;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
  if (diffDias < 30) return `Hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
  return Utils.formatDate(fecha);
}

/**
 * Formatear valor para mostrar
 */
function formatearValor(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor);
}

/**
 * Formatear fecha ISO a dd/mm/aaaa
 */
function formatearFechaComparador(valor) {
  if (!valor || valor === '-') return valor;

  // Detectar si parece fecha ISO (2025-09-25T03:00:00.000Z o 2025-09-25)
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
  if (isoPattern.test(valor)) {
    const fecha = new Date(valor);
    if (!isNaN(fecha.getTime())) {
      // Usar UTC para evitar problemas de timezone
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const anio = fecha.getUTCFullYear();
      return `${dia}/${mes}/${anio}`;
    }
  }

  return valor;
}

// =====================================================
// GESTIÓN DE CAMBIOS: APROBAR Y RECHAZAR EN LA FILA (spec 2026-10-16-perfil-pestanas-gestion-cambios, 5)
// =====================================================
// Los nombres aprobarCambio y abrirModalRechazo vienen de cuando abrían un modal (los fijan los tests): ahora abren la
// confirmación y el motivo dentro de la fila. El servidor vuelve a validar todo al aprobar o rechazar.

// Las aprobaciones que esperan confirmación, por id. "Sí, aprobar" aparece donde estaba Aprobar, deshabilitado, y se
// habilita pasado un momento (su `lista` pasa a true): así un doble clic en Aprobar no aprueba sin confirmar.
const confirmacionesDeAprobacion = new Map();
const ESPERA_PARA_CONFIRMAR_MS = 500;
// Cuánto se ve el resultado en la fila antes de recargar las listas
const ESPERA_DEL_RESULTADO_MS = 1500;
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Lo escrito en los rechazos que el servidor no aceptó, por id: si el cambio sigue pendiente, vuelve al campo del motivo
const motivosSinEnviar = new Map();

// Lo que pasó al aprobar o rechazar, para los lectores de pantalla (la región fija #anuncio-cambios de la página)
function anunciar(texto) {
  const region = document.getElementById('anuncio-cambios');
  if (region) region.textContent = texto;
}

// Desplaza la página lo justo para que se vea el elemento; con movimiento reducido, sin animación
function llevarALaVista(elemento) {
  const reducido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  elemento?.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
}

// Un error al aprobar o rechazar: el mensaje de la página, que puede haber quedado arriba, fuera de la vista, se trae a la vista
function mostrarErrorDeAccion(mensaje) {
  Utils.showError(mensaje);
  llevarALaVista(document.getElementById('message-container'));
}

// Después de aprobar o rechazar y recargar: el foco va a la primera fila de Para revisar o, si quedó vacía, a la lista.
// Después de un error, con { preventScroll: true }: el mensaje queda a la vista.
function enfocarParaRevisar(opciones) {
  const lista = document.getElementById('lista-para-revisar');
  (lista.querySelector('.pf-cambio-cabeza') ?? lista).focus(opciones);
}

// Primer paso de aprobar: en lugar de los botones, la pregunta con [Cancelar] [Sí, aprobar], un grupo que la pregunta describe.
// Sin responsabilidad (spec 2026-10-20-editor-sin-responsabilidad), la pregunta lo dice, el aviso de la fila también describe
// los botones y el pedido guarda lo que la fila mostró, para mandarlo al confirmar
function aprobarCambio(id) {
  const n = Number(id);
  const acciones = document.getElementById(`acciones-${n}`);
  if (!acciones) return;
  const sinResponsabilidad = auditaSinResponsabilidad(n);
  const pedido = { lista: false, sinResponsabilidad };
  confirmacionesDeAprobacion.set(n, pedido);
  const pregunta = sinResponsabilidad
    ? '¿Aprobar sin responsabilidad por la auditoría? El cambio se aplica al dataset ahora.'
    : '¿Aprobar? El cambio se aplica al dataset ahora.';
  const descriptos = sinResponsabilidad ? `pregunta-${n} aviso-${n}` : `pregunta-${n}`;
  acciones.setAttribute('role', 'group');
  acciones.setAttribute('aria-label', 'Confirmar la aprobación');
  acciones.innerHTML = `<span class="pf-pregunta" id="pregunta-${n}">${pregunta}</span>`
    + `<button type="button" class="pf-btn pf-btn-quieto" id="cancelar-${n}" aria-describedby="${descriptos}" onclick="cancelarAccion(${n})">Cancelar</button>`
    + `<button type="button" class="pf-btn pf-btn-aprobar" id="confirmar-${n}" aria-describedby="${descriptos}" disabled onclick="confirmarAprobacion(${n})">${ICONO_APROBADO}Sí, aprobar</button>`;
  document.getElementById(`cancelar-${n}`).focus();
  setTimeout(() => {
    // Si mientras tanto se canceló o se volvió a pedir, esta espera ya no cuenta
    if (confirmacionesDeAprobacion.get(n) !== pedido) return;
    pedido.lista = true;
    const confirmar = document.getElementById(`confirmar-${n}`);
    if (confirmar) confirmar.disabled = false;
  }, ESPERA_PARA_CONFIRMAR_MS);
}

// Deshabilita los controles de una parte de la fila mientras se espera al servidor
function deshabilitarControles(idContenedor) {
  for (const control of document.getElementById(idContenedor)?.querySelectorAll('button, textarea') ?? []) control.disabled = true;
}

// El resultado en lugar de la fila, hasta que se recargan las listas
function mostrarResultado(id, resultado, texto) {
  const fila = document.getElementById(`cuerpo-${id}`)?.closest('.pf-cambio');
  if (!fila) return;
  const icono = resultado === 'aprobado' ? ICONO_APROBADO : ICONO_RECHAZADO;
  fila.innerHTML = `<div class="pf-hecho ${resultado}" role="status">${icono}<span>${texto}</span></div>`;
}

// Segundo paso de aprobar: "Sí, aprobar", con lo que la fila mostró (sin_responsabilidad): el servidor responde 409 si ya no
// es lo que corresponde
async function confirmarAprobacion(id) {
  const n = Number(id);
  const pedido = confirmacionesDeAprobacion.get(n);
  if (!pedido?.lista) return;
  confirmacionesDeAprobacion.delete(n);
  deshabilitarControles(`acciones-${n}`);
  anunciar('');

  try {
    await API.pedirJson('POST', `/cambios-pendientes/${n}/aprobar`, { sin_responsabilidad: pedido.sinResponsabilidad });
  } catch (error) {
    // Ya lo resolvió otra persona (404), es propio o no le corresponde (403), no se pudo (400) o la situación cambió (409):
    // el mensaje del servidor. Con el 409, la fila vuelve a abrirse con lo que corresponde ahora
    mostrarErrorDeAccion(error.message);
    await recargarCambios();
    if (!(error.status === 409 && reabrirFila(n))) enfocarParaRevisar({ preventScroll: true });
    anunciar(error.message);
    return;
  }
  mostrarResultado(n, 'aprobado', 'Aprobado. El cambio ya está aplicado en el dataset.');
  Utils.showSuccess('Cambio aprobado correctamente');
  await esperar(ESPERA_DEL_RESULTADO_MS);
  await recargarCambios();
  enfocarParaRevisar();
  anunciar('Cambio aprobado correctamente');
}

// Rechazar: abre debajo del pie el motivo (obligatorio) con [Cancelar] [Rechazar cambio]
function abrirModalRechazo(id) {
  const n = Number(id);
  const acciones = document.getElementById(`acciones-${n}`);
  const cuerpo = document.getElementById(`cuerpo-${n}`);
  if (!acciones || !cuerpo) return;
  if (!document.getElementById(`rechazo-${n}`)) {
    // Sin responsabilidad, el aviso de la fila describe el motivo
    const descripto = auditaSinResponsabilidad(n) ? ` aria-describedby="aviso-${n}"` : '';
    cuerpo.insertAdjacentHTML('beforeend', `<div class="pf-rechazo" id="rechazo-${n}">`
      + `<label for="motivo-${n}">Motivo del rechazo</label>`
      + `<textarea id="motivo-${n}"${descripto} placeholder="Quien lo propuso lo va a ver en Mis cambios."></textarea>`
      + '<div class="pf-botones">'
      + `<button type="button" class="pf-btn pf-btn-quieto" onclick="cancelarAccion(${n})">Cancelar</button>`
      + `<button type="button" class="pf-btn pf-btn-rechazar" onclick="confirmarRechazo(${n})">${ICONO_RECHAZADO}Rechazar cambio</button>`
      + '</div></div>');
    // Lo escrito en un rechazo que no se pudo enviar vuelve al campo
    document.getElementById(`motivo-${n}`).value = motivosSinEnviar.get(n) ?? '';
  }
  acciones.hidden = true;
  document.getElementById(`motivo-${n}`).focus();
}

// Después de un rechazo que el servidor no aceptó y de recargar las listas: si el cambio sigue pendiente en Para revisar y
// quien mira lo puede auditar, vuelve a abrir su fila y el motivo, con lo que se había escrito. Si ya no está (lo resolvió
// otra persona) o ya no le corresponde, lo escrito se descarta. Devuelve si lo volvió a abrir.
function reabrirRechazo(n) {
  const cambio = vistaParaRevisar.cambios.find(otro => Number(otro.id) === n && otro.estado === 'pendiente');
  if (!cambio || !permisoDeAuditoria(cambio).puede) {
    motivosSinEnviar.delete(n);
    return false;
  }
  // Sin la fila a la vista (la lista no se pudo cargar), lo escrito queda guardado para la próxima vez que se abra el motivo
  const cabeza = document.getElementById(`cabeza-${n}`);
  if (!cabeza) return false;
  desplegarFila(cabeza, true);
  abrirModalRechazo(n);
  return true;
}

// Después de una aprobación que el servidor frenó porque la situación cambió (409) y de recargar las listas: si el cambio
// sigue pendiente en Para revisar, vuelve a abrir su fila, con el aviso (o sin él) de ahora. Devuelve si la abrió.
function reabrirFila(n) {
  const sigue = vistaParaRevisar.cambios.some(otro => Number(otro.id) === n && otro.estado === 'pendiente');
  const cabeza = document.getElementById(`cabeza-${n}`);
  if (!sigue || !cabeza) return false;
  desplegarFila(cabeza, true);
  cabeza.focus({ preventScroll: true });
  return true;
}

// "Rechazar cambio": sin motivo no se envía
async function confirmarRechazo(id) {
  const n = Number(id);
  const campo = document.getElementById(`motivo-${n}`);
  const escrito = String(campo?.value ?? '');
  const comentario = escrito.trim();
  if (!comentario) {
    mostrarErrorDeAccion('Debe proporcionar un motivo de rechazo');
    // El foco vuelve al motivo sin desplazar la página: el mensaje queda a la vista
    campo?.focus({ preventScroll: true });
    anunciar('Debe proporcionar un motivo de rechazo');
    return;
  }
  deshabilitarControles(`rechazo-${n}`);
  anunciar('');

  try {
    // Con lo que la fila muestra (sin_responsabilidad): el servidor responde 409 si ya no es lo que corresponde
    await API.pedirJson('POST', `/cambios-pendientes/${n}/rechazar`, { comentario, sin_responsabilidad: auditaSinResponsabilidad(n) });
  } catch (error) {
    motivosSinEnviar.set(n, escrito);
    mostrarErrorDeAccion(error.message);
    await recargarCambios();
    if (!reabrirRechazo(n)) enfocarParaRevisar({ preventScroll: true });
    anunciar(error.message);
    return;
  }
  motivosSinEnviar.delete(n);
  mostrarResultado(n, 'rechazado', 'Rechazado. Quien lo propuso ve el motivo en Mis cambios.');
  Utils.showSuccess('Cambio rechazado correctamente');
  await esperar(ESPERA_DEL_RESULTADO_MS);
  await recargarCambios();
  enfocarParaRevisar();
  anunciar('Cambio rechazado correctamente');
}

// Cancelar la confirmación de aprobar o el motivo del rechazo: vuelven los botones de la fila (y lo escrito se descarta)
function cancelarAccion(id) {
  const n = Number(id);
  confirmacionesDeAprobacion.delete(n);
  motivosSinEnviar.delete(n);
  document.getElementById(`rechazo-${n}`)?.remove();
  const acciones = document.getElementById(`acciones-${n}`);
  const cambio = vistaParaRevisar.cambios.find(otro => Number(otro.id) === n);
  if (!acciones || !cambio) return;
  acciones.removeAttribute('role');
  acciones.removeAttribute('aria-label');
  acciones.innerHTML = botonesDeAuditoria(n, permisoDeAuditoria(cambio));
  acciones.hidden = false;
  acciones.querySelector('button:not([disabled])')?.focus();
}

// =====================================================
// MI FIRMA (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1)
// =====================================================
let urlImagenFirma = null;

async function cargarMiFirma() {
  try {
    const firma = await API.getMiFirma();
    document.getElementById('firma-nombre').value = firma.nombre ?? '';
    document.getElementById('firma-cargo').value = firma.cargo ?? '';
    document.getElementById('firma-estado').textContent = firma.cargada
      ? 'Con esta firma salen las notas que firmás o presentás por autorización.'
      : 'Todavía no cargaste tu firma: se proponen tu nombre y tu cargo.';
    actualizarMuestraFirma();
    firmaTieneImagenGuardada = Boolean(firma.tiene_imagen);
    await mostrarImagenFirma(firmaTieneImagenGuardada);
  } catch (error) {
    Utils.showError(`No se pudo cargar tu firma: ${error.message}`);
  }
}

// Renglón que las notas agregan, más chico, entre el nombre y el cargo de la firma del personal contratado (pedido del
// usuario el 16/10/2026; es RENGLON_FIRMA_CONTRATADO de services/notasDigitalesContenido.js)
const RENGLON_FIRMA_CONTRATADO = 'Personal contratado, cumpliendo funciones de';

// Vista previa "Así sale en las notas", para todos (pedido del usuario el 16/10/2026), como la arma dibujarFirma del PDF:
// el nombre (en negrita) y el cargo (un punto menos); el personal contratado lleva entre los dos el renglón, el más chico
// (pedido del usuario el 21/10/2026; la letra de cada clase está en perfil.html). Sin nombre ni cargo, nada.
function muestraDeFirma(nombre, cargo, contratado) {
  if (!nombre && !cargo) return '';
  const renglon = (clase, texto) => `<div class="firma-muestra-${clase}">${Utils.escapeHtml(texto)}</div>`;
  return renglon('nombre', nombre) + (contratado ? renglon('chico', RENGLON_FIRMA_CONTRATADO) : '') + renglon('cargo', cargo);
}

// La muestra con lo que está escrito en los campos de la firma (se actualiza al escribir)
function actualizarMuestraFirma() {
  const muestra = document.getElementById('firma-muestra');
  muestra.innerHTML = muestraDeFirma(
    document.getElementById('firma-nombre').value.trim(), document.getElementById('firma-cargo').value.trim(), perfilContratado
  );
  muestra.hidden = !muestra.innerHTML;
}

// Si la firma guardada tiene imagen (cargarMiFirma): vuelve a la vista previa si se quita la imagen elegida
let firmaTieneImagenGuardada = false;

// La imagen de la vista previa: la URL de la imagen (guardada o elegida) o, sin imagen, el aviso de que la nota sale sin ella
function ponerImagenFirma(url) {
  const vista = document.getElementById('firma-vista');
  if (urlImagenFirma && urlImagenFirma !== url) URL.revokeObjectURL(urlImagenFirma);
  urlImagenFirma = url;
  if (url) vista.src = url;
  vista.hidden = !url;
  document.getElementById('firma-sin-imagen').hidden = Boolean(url);
}

async function mostrarImagenFirma(tiene) {
  ponerImagenFirma(null);
  if (!tiene) return;
  try {
    ponerImagenFirma(URL.createObjectURL(await API.getImagenMiFirma()));
  } catch {
    // sin vista previa de la imagen
  }
}

// La imagen elegida se ve en la vista previa antes de guardarla; si se quita (o no es PNG ni JPEG), vuelve la guardada
function mostrarImagenElegida() {
  const archivo = document.getElementById('firma-archivo').files[0];
  if (!archivo || !['image/png', 'image/jpeg'].includes(archivo.type)) return mostrarImagenFirma(firmaTieneImagenGuardada);
  ponerImagenFirma(URL.createObjectURL(archivo));
}

const leerComoDataUrl = (archivo) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
  lector.readAsDataURL(archivo);
});

async function guardarMiFirma(evento) {
  evento.preventDefault();
  const boton = document.getElementById('btn-guardar-firma');
  boton.disabled = true;
  try {
    const datos = {
      nombre: document.getElementById('firma-nombre').value.trim(),
      cargo: document.getElementById('firma-cargo').value.trim()
    };
    const archivo = document.getElementById('firma-archivo').files[0];
    if (archivo) {
      if (!['image/png', 'image/jpeg'].includes(archivo.type)) throw new Error('La firma debe ser una imagen PNG o JPEG');
      if (archivo.size > 500 * 1024) throw new Error('La imagen debe pesar como máximo 500 KB');
      datos.imagen = await leerComoDataUrl(archivo);
      datos.mime = archivo.type;
    }
    const res = await API.guardarMiFirma(datos);
    Utils.showSuccess(res.message);
    document.getElementById('firma-archivo').value = '';
    await cargarMiFirma();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    boton.disabled = false;
  }
}

// =====================================================
// AUDITAR UN CAMBIO (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
// =====================================================
// Lo que el servidor dice sobre si quien mira puede auditar el cambio ({ puede, respaldo, sin_responsabilidad, mensaje }).
// Si el detalle no trae el dato, falla cerrado: los botones quedan deshabilitados (el servidor igual decide al aprobar o
// rechazar)
function permisoDeAuditoria(cambio) {
  return cambio.auditoria ?? { puede: false, respaldo: false, sin_responsabilidad: false, mensaje: null };
}

// Si quien mira audita sin responsabilidad el cambio de la lista de Para revisar (spec 2026-10-20-editor-sin-responsabilidad):
// lo que la fila mostró, y lo que viaja con el pedido de aprobar o rechazar. Sin el cambio en la lista, no.
function auditaSinResponsabilidad(n) {
  const cambio = vistaParaRevisar.cambios.find(otro => Number(otro.id) === n);
  return cambio ? permisoDeAuditoria(cambio).sin_responsabilidad === true : false;
}

// Botones de un cambio pendiente ajeno, en el pie de su fila. permiso: { puede, sin_responsabilidad, mensaje } que manda el
// servidor; sin permiso, deshabilitados con el motivo; sin responsabilidad, descriptos por el aviso de la fila
function botonesDeAuditoria(id, permiso) {
  const n = Number(id);
  if (permiso.puede) {
    const descriptos = permiso.sin_responsabilidad ? ` aria-describedby="aviso-${n}"` : '';
    return `<button type="button" class="pf-btn pf-btn-rechazar"${descriptos} onclick="abrirModalRechazo(${n})">${ICONO_RECHAZADO}Rechazar</button>`
      + `<button type="button" class="pf-btn pf-btn-aprobar"${descriptos} onclick="aprobarCambio(${n})">${ICONO_APROBADO}Aprobar</button>`;
  }
  const motivo = Utils.escapeHtml(permiso.mensaje ?? '');
  return `<button type="button" class="pf-btn pf-btn-rechazar" disabled title="${motivo}">${ICONO_RECHAZADO}Rechazar</button>`
    + `<button type="button" class="pf-btn pf-btn-aprobar" disabled title="${motivo}">${ICONO_APROBADO}Aprobar</button>`;
}

// La nota ámbar de un cambio que quien mira no puede auditar, con el motivo del servidor, arriba del pie de la fila
function avisoNoCorresponde(mensaje) {
  return `<div class="pf-nota no-corresponde">${ICONO_ESCUDO}<span>${Utils.escapeHtml(mensaje)}</span></div>`;
}

// La nota ámbar de un cambio que quien mira audita sin responsabilidad, con el aviso del servidor, en el mismo lugar. Su id
// describe los botones, la confirmación y el motivo del rechazo
function notaSinResponsabilidad(id, mensaje) {
  return `<div class="pf-nota sin-responsabilidad" id="aviso-${Number(id)}">${ICONO_ESCUDO}<span>${Utils.escapeHtml(mensaje)}</span></div>`;
}

// Quién auditó un cambio: "Aprobado por …" o "Rechazado por …", con "(respaldo)" si lo auditó un editor porque no había
// auditores disponibles, o "(sin responsabilidad por la auditoría)" si lo auditó un editor habiendo auditores disponibles
function textoRevisor(cambio) {
  const accion = cambio.estado === 'aprobado' ? 'Aprobado' : 'Rechazado';
  const marca = Number(cambio.revisado_sin_responsabilidad) ? ' (sin responsabilidad por la auditoría)'
    : Number(cambio.revisado_como_respaldo) ? ' (respaldo)' : '';
  return `${accion} por ${cambio.revisor_nombre}${marca}`;
}

// =====================================================
// GESTIÓN DE CAMBIOS: PRESENTACIÓN
// =====================================================
// Funciones puras (no tocan el DOM) que arman lo que se ve de un cambio propuesto: el resumen de la fila cerrada, la
// comparación palabra por palabra de la fila abierta y la marca del editor. Todo dato que devuelven como HTML va escapado.

// Las etiquetas de campo que manda el servidor (campos_modificados, sin tildes) y cómo se muestran
const ETIQUETAS_DE_CAMPO = {
  'Titulo': 'Título',
  'Descripcion': 'Descripción',
  'Area Responsable': 'Área responsable',
  'Tema Principal': 'Tema principal',
  'Tema Secundario': 'Tema secundario',
  'Tipo de Gestion': 'Tipo de gestión',
  'Requiere nota DGMIT': 'Requiere nota DGMIT',
  'Ultima Actualizacion': 'Última actualización',
  'Proxima Actualizacion': 'Próxima actualización',
  'URL en Portal': 'URL en el portal',
  // Los rótulos de las fechas de los datasets (spec 2026-10-17-fechas-datasets, 10.1): el servidor ya los manda como se leen.
  // "Cargado en el portal" es la antigua "Ultima Actualizacion"; la clave registro_actualizacion es una marca, no un campo
  'Cargado en el portal': 'Cargado en el portal',
  'Datos al': 'Datos al',
  'Recibido el': 'Recibido el',
  'Tipo de pedido': 'Tipo de pedido',
  // El origen de los datos de un registro de actualización (spec 2026-10-24-metricas-y-reportes, 4): el servidor manda el
  // texto corto, «Los entregó el área» o «Fuente pública»
  'Origen de los datos': 'Origen de los datos'
};

// Etiquetas del servidor de los campos de texto largo: se comparan palabra por palabra
const CAMPOS_LARGOS = ['Descripcion', 'Observaciones', 'Qué se solicita'];

function etiquetaDeCampo(campo) {
  return Object.hasOwn(ETIQUETAS_DE_CAMPO, campo) ? ETIQUETAS_DE_CAMPO[campo] : campo;
}

// Un valor para mostrar: vacío si no hay (el servidor manda '-'), las fechas como dd/mm/aaaa
function textoDeValor(valor) {
  if (valor === null || valor === undefined || valor === '' || valor === '-') return '';
  if (typeof valor === 'string') return formatearValor(formatearFechaComparador(valor));
  return formatearValor(valor);
}

// Si los tokens del tramo que cambia (sin lo común del principio y del final) se multiplican más que esto, no se compara:
// sale todo quitado y todo agregado
const LIMITE_DE_COMPARACION = 250000;

// Palabras, espacios y signos de puntuación como tokens separados, para que "semestral." no se pegue al punto
const palabrasDeTexto = (texto) => texto.split(/(\s+|[,.;:()¿?¡!"])/).filter(token => token);

// Compara dos tramos de tokens con la subsecuencia común más larga y va sumando los segmentos con `agregar`. Ante una
// diferencia, primero va lo quitado. Si un lado está vacío o los tramos son demasiado grandes, no compara: todo lo de
// antes quitado y todo lo de después agregado.
function compararTramos(a, d, agregar) {
  if (a.length === 0 || d.length === 0 || a.length * d.length > LIMITE_DE_COMPARACION) {
    agregar('-', a.join(''));
    agregar('+', d.join(''));
    return;
  }

  // largo[i][j]: tokens en común, en orden, entre a[i..] y d[j..]
  const largo = Array.from({ length: a.length + 1 }, () => new Array(d.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = d.length - 1; j >= 0; j--) {
      largo[i][j] = a[i] === d[j] ? largo[i + 1][j + 1] + 1 : Math.max(largo[i + 1][j], largo[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < a.length && j < d.length) {
    if (a[i] === d[j]) {
      agregar('=', a[i]);
      i++;
      j++;
    } else if (largo[i + 1][j] >= largo[i][j + 1]) {
      agregar('-', a[i++]);
    } else {
      agregar('+', d[j++]);
    }
  }
  while (i < a.length) agregar('-', a[i++]);
  while (j < d.length) agregar('+', d[j++]);
}

// Limpieza para que se lea mejor: un igual hecho solo de espacios entre dos cambios se suma al cambio (a lo quitado y a lo
// agregado), así cada bloque de cambio queda como un solo quitado seguido de un solo agregado (o solo uno de los dos), en
// lugar de alternar palabra por palabra. Lo quitado + lo igual sigue dando el texto de antes; lo agregado + lo igual, el de
// después.
function unirCambiosSeparadosPorEspacios(segmentos) {
  const limpios = [];
  let bloque = null;
  const cerrarBloque = () => {
    if (bloque?.quitado) limpios.push({ tipo: '-', texto: bloque.quitado });
    if (bloque?.agregado) limpios.push({ tipo: '+', texto: bloque.agregado });
    bloque = null;
  };
  segmentos.forEach((segmento, i) => {
    if (segmento.tipo === '-' || segmento.tipo === '+') {
      bloque ??= { quitado: '', agregado: '' };
      bloque[segmento.tipo === '-' ? 'quitado' : 'agregado'] += segmento.texto;
      return;
    }
    const siguiente = segmentos[i + 1];
    if (bloque && siguiente && siguiente.tipo !== '=' && /^\s+$/.test(segmento.texto)) {
      bloque.quitado += segmento.texto;
      bloque.agregado += segmento.texto;
      return;
    }
    cerrarBloque();
    limpios.push(segmento);
  });
  cerrarBloque();
  return limpios;
}

// Comparación palabra por palabra. Devuelve segmentos { tipo, texto }: '=' sin cambios, '-' quitado, '+' agregado.
// Antes de comparar recorta los tokens iguales del principio y del final: la comparación (y su tope) es solo del tramo
// del medio, así un texto largo con un cambio chico marca solo ese cambio. Al final, los espacios entre cambios se suman al
// cambio (unirCambiosSeparadosPorEspacios).
function diffPalabras(antes, despues) {
  const a = palabrasDeTexto(String(antes ?? ''));
  const d = palabrasDeTexto(String(despues ?? ''));

  let prefijo = 0;
  while (prefijo < a.length && prefijo < d.length && a[prefijo] === d[prefijo]) prefijo++;
  let sufijo = 0;
  while (sufijo < a.length - prefijo && sufijo < d.length - prefijo && a[a.length - 1 - sufijo] === d[d.length - 1 - sufijo]) sufijo++;

  const segmentos = [];
  const agregar = (tipo, texto) => {
    if (!texto) return;
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.texto += texto;
    else segmentos.push({ tipo, texto });
  };
  agregar('=', a.slice(0, prefijo).join(''));
  compararTramos(a.slice(prefijo, a.length - sufijo), d.slice(prefijo, d.length - sufijo), agregar);
  agregar('=', a.slice(a.length - sufijo).join(''));
  return unirCambiosSeparadosPorEspacios(segmentos);
}

// Los segmentos de diffPalabras como HTML: lo quitado en <del>, lo agregado en <ins>, todo escapado
function htmlDeDiff(segmentos) {
  return segmentos.map(({ tipo, texto }) => {
    const html = Utils.escapeHtml(texto);
    if (tipo === '-') return `<del>${html}</del>`;
    if (tipo === '+') return `<ins>${html}</ins>`;
    return html;
  }).join('');
}

// "A", "A y B", "A, B y C"
function listaDeNombres(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

// Título del dataset al que se refiere el cambio (texto plano; quien lo muestre lo escapa)
function tituloDelCambio(cambio) {
  const nuevo = cambio.datos_nuevos?.titulo;
  if (cambio.tipo_cambio === 'crear' && nuevo) return nuevo;
  return cambio.dataset_titulo || cambio.datos_anteriores?.titulo || nuevo || 'Dataset';
}

// Hasta cuántos caracteres puede tener cada valor para que el resumen diga "de A a B"
const LARGO_MAXIMO_EN_RESUMEN = 40;

const negritaDeCampo = (campo) => `<b>${Utils.escapeHtml(etiquetaDeCampo(campo))}</b>`;
const valorEnResumen = (valor) => Utils.escapeHtml(textoDeValor(valor) || 'vacío');

// El resumen de una edición. Un solo campo corto: "Frecuencia de A a B" (con ", y N campos más" si hay más); si no, solo
// los nombres de los campos que cambian
function resumenDeEdicion(lista) {
  // Un elemento nulo en la lista del servidor no rompe el resumen
  const campos = Array.isArray(lista) ? lista.filter(Boolean) : [];
  if (campos.length === 0) return 'Sin cambios en los campos principales';
  const [primero] = campos;
  const antes = textoDeValor(primero.antes);
  const despues = textoDeValor(primero.despues);
  const cabe = !CAMPOS_LARGOS.includes(primero.campo) && antes.length <= LARGO_MAXIMO_EN_RESUMEN && despues.length <= LARGO_MAXIMO_EN_RESUMEN;
  if (cabe) {
    const otros = campos.length - 1;
    const resto = otros > 0 ? `, y ${otros} campo${otros > 1 ? 's' : ''} más` : '';
    return `${negritaDeCampo(primero.campo)} de ${valorEnResumen(primero.antes)} a ${valorEnResumen(primero.despues)}${resto}`;
  }
  if (campos.length === 1) return `Cambia ${negritaDeCampo(primero.campo)}`;
  if (campos.length === 2) return `Cambia ${negritaDeCampo(primero.campo)} y ${negritaDeCampo(campos[1].campo)}`;
  return `Cambia ${negritaDeCampo(primero.campo)}, ${negritaDeCampo(campos[1].campo)} y ${campos.length - 2} más`;
}

// El resumen de un dataset nuevo: "Dataset nuevo de Ambiente, anualmente", con lo que haya del área y la frecuencia
function resumenDeCreacion(datos) {
  const area = datos?.area_nombre ? ` de ${Utils.escapeHtml(datos.area_nombre)}` : '';
  const frecuencia = datos?.frecuencia_nombre ? `, ${Utils.escapeHtml(String(datos.frecuencia_nombre).toLowerCase())}` : '';
  return `Dataset nuevo${area}${frecuencia}`;
}

// Un registro de actualización (POST /datasets/:id/actualizar) es una edición que lleva la marca registro_actualizacion en
// los datos nuevos. La marca no es un campo del dataset: no se compara ni se muestra, solo da el título del cambio.
const esRegistroDeActualizacion = (cambio) => cambio.tipo_cambio === 'editar' && cambio.datos_nuevos?.registro_actualizacion === true;

// Lo que dice la fila cerrada de un cambio, como HTML escapado
function resumenDelCambio(cambio) {
  if (cambio.tipo_cambio === 'crear') return resumenDeCreacion(cambio.datos_nuevos);
  if (cambio.tipo_cambio === 'eliminar') return 'Se quita del registro';
  if (esRegistroDeActualizacion(cambio)) return 'Actualización registrada';
  if (cambio.tipo_cambio === 'editar') return resumenDeEdicion(cambio.campos_modificados);
  return '';
}

// Escudo de Lucide, para la marca del editor (quiénes lo auditan o la pastilla de respaldo)
const ICONO_ESCUDO = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';

// Lo que ve un editor en un cambio pendiente: si lo puede auditar de respaldo o quiénes lo auditan (también cuando lo puede
// auditar sin responsabilidad). Sin marca (cadena vacía) para quien no es editor, para un cambio ya resuelto, si el servidor
// no mandó la auditoría o si no hay a quién nombrar.
function marcaDeAuditoria(cambio, esEditor) {
  const auditoria = cambio.auditoria;
  if (!esEditor || cambio.estado !== 'pendiente' || !auditoria) return '';
  if (auditoria.puede && auditoria.respaldo) {
    return `<span class="pf-marca pf-marca-respaldo">${ICONO_ESCUDO}Podés auditarlo de respaldo</span>`;
  }
  const nombres = (auditoria.auditan ?? []).map(nombre => Utils.escapeHtml(nombre));
  return nombres.length ? `<span class="pf-marca">${ICONO_ESCUDO}Lo auditan ${listaDeNombres(nombres)}</span>` : '';
}

const PESTANAS_DEL_PERFIL = ['para-revisar', 'mis-cambios', 'mis-datos', 'mi-firma'];

// La pestaña con la que abre Mi Perfil: la del hash si existe, y si no, la de revisar para quien administra. Quien no
// administra solo tiene sus datos personales.
function pestanaInicial(hash, esAdmin) {
  if (!esAdmin) return 'mis-datos';
  const pedida = String(hash ?? '').replace(/^#/, '');
  return PESTANAS_DEL_PERFIL.includes(pedida) ? pedida : 'para-revisar';
}

// Un cambio pendiente está demorado si hace más de 2 días que se propuso
const DEMORA_EN_MS = 2 * 24 * 60 * 60 * 1000;
function estaDemorado(fecha, ahora = Date.now()) {
  return ahora - new Date(fecha).getTime() > DEMORA_EN_MS;
}

// =====================================================
// GESTIÓN DE CAMBIOS: LA FILA Y LA COMPARACIÓN (spec 2026-10-16-perfil-pestanas-gestion-cambios, 5 y 6)
// =====================================================
// Funciones puras: arman el HTML de un cambio con los datos de la lista (no piden el detalle) y con lo que reciben de
// quien mira (esEditor, idUsuario); no leen Auth ni tocan el DOM. Todo dato pasa por Utils.escapeHtml y todo link por
// Utils.safeUrl.

// Iconos de Lucide (sin emojis)
const ICONO_FLECHA = '<svg class="pf-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const ICONO_APROBADO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICONO_RECHAZADO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const ICONO_PORTAL = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
const ICONO_ALERTA = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

// La etiqueta de cada tipo: las mismas palabras que los emails
const ETIQUETAS_DE_TIPO = { crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar' };
const RESULTADOS = { aprobado: 'Aprobado', rechazado: 'Rechazado' };

// «Requiere nota DGMIT» en un alta o una baja: de la base llega 1 (Sí) o 0 (No) como número, y el 0 es un valor, no un vacío.
// Copia mínima de textoRequiereNota (services/requiereNotaReglas.js, atada por un test de paridad); sin dato, o con cualquier
// otro valor, queda vacío y el renglón no se lista. Solo se usa para este campo: en los demás, un 0 es el texto que es.
function textoDeRequiereNota(valor) {
  if (valor === 1 || valor === true || valor === '1') return 'Sí';
  if (valor === 0 || valor === false || valor === '0') return 'No';
  return '';
}

// Los campos de un alta o de una baja, en el orden de siempre, con la etiqueta del servidor (se muestran con
// etiquetaDeCampo). Los valores con nombre (área, frecuencia, temas, formatos) vienen enriquecidos de la lista. `texto`: cómo se
// escribe el valor (por defecto, textoDeValor).
const CAMPOS_DE_ALTA_Y_BAJA = [
  { clave: 'titulo', campo: 'Titulo' },
  { clave: 'descripcion', campo: 'Descripcion' },
  { clave: 'area_nombre', campo: 'Area Responsable' },
  { clave: 'frecuencia_nombre', campo: 'Frecuencia' },
  { clave: 'tema_principal_nombre', campo: 'Tema Principal' },
  { clave: 'tema_secundario_nombre', campo: 'Tema Secundario' },
  { clave: 'tipo_gestion', campo: 'Tipo de Gestion' },
  { clave: 'requiere_nota', campo: 'Requiere nota DGMIT', texto: textoDeRequiereNota },
  { clave: 'tipo_pedido_nombre', campo: 'Tipo de pedido' },
  { clave: 'datos_al', campo: 'Datos al' },
  { clave: 'ultima_actualizacion', campo: 'Cargado en el portal' },
  { clave: 'proxima_actualizacion', campo: 'Proxima Actualizacion' },
  { clave: 'url_dataset', campo: 'URL en Portal' },
  { clave: 'observaciones', campo: 'Observaciones' },
  { clave: 'que_se_solicita', campo: 'Qué se solicita' },
  { clave: 'formatos_nombres', campo: 'Formatos' }
];

const VALOR_VACIO = '<span class="pf-vacio">vacío</span>';

// La etiqueta que manda el servidor para la próxima actualización
const CAMPO_PROXIMA = 'Proxima Actualizacion';

// Febrero va siempre en 28, también en los años bisiestos (spec 2026-10-17-fechas-datasets, R1)
const DIAS_DE_CADA_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// 'AAAA-MM-DD', con o sin la hora que trae una fecha leída de la base ('2026-05-31T03:00:00.000Z'): cuenta el día
const FECHA_CON_DIA = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;

// ¿Es el texto 'AAAA-MM-DD' el último día de un mes? Pura. Es una copia mínima de esFinDeMes (services/fechasDatasetReglas.js)
// y, con las de admin-fechas.js, una de las pocas reglas de fechas que se copian al navegador. Solo sirve para marcar
// (marcaDeFinDeMes): el servidor es el que no deja aprobar una fecha que no es fin de mes. Lo que no es una fecha da false.
function esFinDeMesTexto(iso) {
  const partes = typeof iso === 'string' ? FECHA_CON_DIA.exec(iso) : null;
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  return anio >= 1 && mes >= 1 && mes <= 12 && dia === DIAS_DE_CADA_MES[mes - 1];
}

// La señal para quien audita (ya como HTML): una fecha nueva que no es el último día de un mes. Vacía si lo es o si no es una
// fecha (por ejemplo, '-' cuando se vació la próxima).
function marcaDeFinDeMes(valor) {
  if (typeof valor !== 'string' || !FECHA_CON_DIA.test(valor) || esFinDeMesTexto(valor)) return '';
  return `<span class="pf-fecha-aviso">${ICONO_ALERTA}No es el último día del mes</span>`;
}

// Un campo editado: en los textos largos, palabra por palabra en un solo párrafo; en el resto, el valor viejo tachado y el
// nuevo resaltado, uno al lado del otro. La próxima nueva que no es fin de mes lleva la marca.
function htmlDeCampoEditado({ campo, antes, despues }) {
  const textoAntes = textoDeValor(antes);
  const textoDespues = textoDeValor(despues);
  if (CAMPOS_LARGOS.includes(campo)) return `<div class="pf-texto-largo">${htmlDeDiff(diffPalabras(textoAntes, textoDespues))}</div>`;
  const viejo = textoAntes ? Utils.escapeHtml(textoAntes) : VALOR_VACIO;
  const nuevo = textoDespues ? Utils.escapeHtml(textoDespues) : VALOR_VACIO;
  const marca = campo === CAMPO_PROXIMA ? marcaDeFinDeMes(despues) : '';
  return `<div class="pf-par"><del>${viejo}</del><ins>${nuevo}</ins>${marca}</div>`;
}

// La comparación "control de cambios" de la fila abierta. Editar: los campos que cambian. Crear: los campos no vacíos del
// dataset nuevo. Eliminar: los del dataset que se quita, con la nota de que queda inactivo.
function htmlDeComparacion(cambio) {
  if (cambio.tipo_cambio === 'crear' || cambio.tipo_cambio === 'eliminar') {
    const datos = (cambio.tipo_cambio === 'crear' ? cambio.datos_nuevos : cambio.datos_anteriores) ?? {};
    // En un alta, la próxima que no es fin de mes lleva la marca (en una baja no: no es un valor nuevo)
    const filas = CAMPOS_DE_ALTA_Y_BAJA
      .map(({ clave, campo, texto = textoDeValor }) => ({
        campo, valor: texto(datos[clave]), marca: cambio.tipo_cambio === 'crear' && campo === CAMPO_PROXIMA ? marcaDeFinDeMes(datos[clave]) : ''
      }))
      .filter(({ valor }) => valor)
      .map(({ campo, valor, marca }) => `<dt>${Utils.escapeHtml(etiquetaDeCampo(campo))}</dt><dd>${Utils.escapeHtml(valor)}${marca ? ` ${marca}` : ''}</dd>`)
      .join('');
    const lista = filas ? `<dl class="pf-diff">${filas}</dl>` : '<p class="pf-sin-campos">Sin datos.</p>';
    if (cambio.tipo_cambio === 'crear') return lista;
    return `${lista}<div class="pf-nota baja">${ICONO_ALERTA}<span>Al aprobarlo, el dataset deja de figurar en el registro. No se borra: queda inactivo.</span></div>`;
  }

  // Como en el resumen, un elemento nulo de la lista no rompe la comparación
  const campos = Array.isArray(cambio.campos_modificados) ? cambio.campos_modificados.filter(Boolean) : [];
  if (campos.length === 0) return '<p class="pf-sin-campos">No se detectaron cambios en los campos principales.</p>';
  const filas = campos.map(campo => `<dt>${Utils.escapeHtml(etiquetaDeCampo(campo.campo))}</dt><dd>${htmlDeCampoEditado(campo)}</dd>`).join('');
  return `<dl class="pf-diff">${filas}</dl>`;
}

// "dd/mm/aaaa, hh:mm" de una fecha del servidor, en la hora de quien mira
function fechaYHora(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  return `${Utils.formatDate(valor)}, ${hora}`;
}

// "Propuesto hace 2 horas" (pasados 30 días, "Propuesto el dd/mm/aaaa")
function propuestoHace(fecha) {
  const tiempo = calcularTiempoRelativo(fecha);
  return tiempo.startsWith('Hace') ? `Propuesto ${tiempo.toLowerCase()}` : `Propuesto el ${tiempo}`;
}

// El link al portal: en un alta, el del dataset nuevo; en una baja, el del dataset que se quita; en una edición, el nuevo
// o, si no, el del dataset. Ya escapado, o null si no es http/https.
function urlDelPortal(cambio) {
  let url;
  if (cambio.tipo_cambio === 'crear') url = cambio.datos_nuevos?.url_dataset;
  else if (cambio.tipo_cambio === 'eliminar') url = cambio.datos_anteriores?.url_dataset || cambio.dataset_url;
  else url = cambio.datos_nuevos?.url_dataset || cambio.dataset_url;
  return Utils.safeUrl(url);
}

// "Aprobado" o "Rechazado", con su ícono (sin emojis)
function htmlDeResultado(estado) {
  if (!Object.hasOwn(RESULTADOS, estado)) return `<span class="pf-resultado">${Utils.escapeHtml(estado)}</span>`;
  const icono = estado === 'aprobado' ? ICONO_APROBADO : ICONO_RECHAZADO;
  return `<span class="pf-resultado ${estado}">${icono}${RESULTADOS[estado]}</span>`;
}

// A la derecha de la cabecera: en Para revisar, quién lo propuso y cuándo (en ámbar pasados 2 días); en un pendiente propio,
// "Propuesto hace …"; resuelto, el resultado y la fecha de la revisión
function htmlDelLado(cambio, modo, quienPropuso) {
  if (cambio.estado === 'pendiente') {
    if (modo === 'mio') return `<span class="pf-cambio-quien"><span class="pf-cuando">${Utils.escapeHtml(propuestoHace(cambio.created_at))}</span></span>`;
    const demora = estaDemorado(cambio.created_at) ? ' demora' : '';
    return `<span class="pf-cambio-quien"><span class="pf-nombre">${quienPropuso}</span>`
      + `<span class="pf-cuando${demora}">${Utils.escapeHtml(calcularTiempoRelativo(cambio.created_at))}</span></span>`;
  }
  const fecha = cambio.revisado_at ? `<span class="pf-cuando">${Utils.escapeHtml(Utils.formatDate(cambio.revisado_at))}</span>` : '';
  return `<span class="pf-cambio-quien">${htmlDeResultado(cambio.estado)}${fecha}</span>`;
}

// El pie de la fila abierta: quién lo propuso y cuándo, quién lo revisó (si ya se resolvió) y el link al portal
function htmlDelPie(cambio, modo, quienPropuso) {
  const cuando = fechaYHora(cambio.created_at);
  const por = modo !== 'mio' && quienPropuso ? ` por ${quienPropuso}` : '';
  let html = `<span>Propuesto${por}${cuando ? ` el ${Utils.escapeHtml(cuando)}` : ''}</span>`;
  if (cambio.estado !== 'pendiente') {
    const resultado = Object.hasOwn(RESULTADOS, cambio.estado) ? RESULTADOS[cambio.estado] : cambio.estado;
    const revisor = cambio.revisor_nombre ? textoRevisor(cambio) : resultado;
    const fecha = cambio.revisado_at ? ` el ${Utils.formatDate(cambio.revisado_at)}` : '';
    html += `<span>${Utils.escapeHtml(`${revisor}${fecha}`)}</span>`;
  }
  const url = urlDelPortal(cambio);
  if (url) html += `<a href="${url}" target="_blank" rel="noopener noreferrer">${ICONO_PORTAL}Ver en el portal</a>`;
  return html;
}

/**
 * La fila de un cambio: la cabecera (un botón que la abre y la cierra) y el cuerpo, con la comparación, las notas y el pie.
 * modo: 'revisar' (pendiente ajeno, en Para revisar), 'revisado' (ajeno resuelto) o 'mio' (en Mis cambios).
 * Los botones de aprobar y rechazar van solo en Para revisar, en un cambio pendiente que no es de quien mira, y salen del
 * permiso que manda el servidor (sin el dato, deshabilitados). En Mis cambios nunca hay botones. Sin saber quién mira
 * (idUsuario inválido), tampoco.
 */
function htmlDeFila(cambio, modo, { abierto = false, esEditor = false, idUsuario = NaN } = {}) {
  const id = Number(cambio.id);
  const tipo = Object.hasOwn(ETIQUETAS_DE_TIPO, cambio.tipo_cambio) ? cambio.tipo_cambio : null;
  const pendiente = cambio.estado === 'pendiente';
  const quienPropuso = Utils.escapeHtml(cambio.usuario_nombre || cambio.usuario_username || '');
  const yo = Number(idUsuario);
  const propio = !(yo > 0) || Number(cambio.usuario_id) === yo;
  const conBotones = modo === 'revisar' && pendiente && !propio;
  const permiso = permisoDeAuditoria(cambio);

  const etiqueta = tipo
    ? `<span class="pf-tipo pf-tipo-${tipo}">${ETIQUETAS_DE_TIPO[tipo]}</span>`
    : `<span class="pf-tipo">${Utils.escapeHtml(cambio.tipo_cambio)}</span>`;
  const propuesto = modo === 'revisado' && quienPropuso ? `<span class="pf-cambio-propuesto">Propuesto por ${quienPropuso}</span>` : '';
  const motivo = cambio.estado === 'rechazado' && cambio.comentario_rechazo
    ? `<div class="pf-nota motivo"><span><b>Motivo del rechazo:</b> ${Utils.escapeHtml(cambio.comentario_rechazo)}</span></div>`
    : '';
  let aviso = '';
  if (conBotones && permiso.mensaje) {
    if (permiso.sin_responsabilidad) aviso = notaSinResponsabilidad(id, permiso.mensaje);
    else if (!permiso.puede) aviso = avisoNoCorresponde(permiso.mensaje);
  }
  const botones = conBotones ? `<div class="pf-botones" id="acciones-${id}">${botonesDeAuditoria(id, permiso)}</div>` : '';

  return `<li class="pf-cambio${pendiente ? '' : ' resuelto'}${abierto ? ' abierto' : ''}" data-id="${id}">
    <button type="button" class="pf-cambio-cabeza" id="cabeza-${id}" aria-expanded="${Boolean(abierto)}" aria-controls="cuerpo-${id}">
      ${etiqueta}
      <span class="pf-cambio-texto">
        <span class="pf-cambio-titulo">${Utils.escapeHtml(tituloDelCambio(cambio))}</span>
        <span class="pf-cambio-resumen">${resumenDelCambio(cambio)}</span>
        ${marcaDeAuditoria(cambio, esEditor)}${propuesto}
      </span>
      ${htmlDelLado(cambio, modo, quienPropuso)}
      ${ICONO_FLECHA}
    </button>
    <div class="pf-cambio-cuerpo" id="cuerpo-${id}"${abierto ? '' : ' hidden'}>
      ${htmlDeComparacion(cambio)}${motivo}${aviso}
      <div class="pf-acciones">
        <div class="pf-acciones-info">${htmlDelPie(cambio, modo, quienPropuso)}</div>
        ${botones}
      </div>
    </div>
  </li>`;
}

// Una lista vacía (o que no se pudo cargar): qué pasa y, si hace falta, una línea más
const htmlDeVacio = (titulo, detalle = '') => `<li class="pf-vacia"><strong>${titulo}</strong>${detalle}</li>`;

// Para revisar vacía: con un filtro de tipo, dice cuál está puesto
function htmlDeVacioParaRevisar(segmento, tipo) {
  if (Object.hasOwn(ETIQUETAS_DE_TIPO, tipo ?? '')) return htmlDeVacio(`No hay cambios de tipo ${ETIQUETAS_DE_TIPO[tipo]}.`);
  if (segmento === 'revisados') return htmlDeVacio('Todavía no hay cambios revisados.');
  return htmlDeVacio('No hay cambios esperando revisión.', 'Cuando alguien proponga uno, aparece acá.');
}

// Resueltos propios vacíos: si no hay ningún cambio propio, o el texto del filtro
function htmlDeVacioMisCambios(filtro, hayPropios) {
  if (!hayPropios) return htmlDeVacio('Todavía no propusiste cambios.');
  if (filtro === 'aprobado') return htmlDeVacio('No hay cambios aprobados.');
  if (filtro === 'rechazado') return htmlDeVacio('No hay cambios rechazados.');
  return htmlDeVacio('Todavía no hay cambios resueltos.');
}
