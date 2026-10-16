// Panel de usuarios (spec 2026-10-15-usuarios-superadmin, sección 12.2):
// lista agrupada por rol, alta, edición, acceso (links y activación) e historial
let usuarios = [];
let resumen = { aprobadores_activos: 0, minimo: 2 };
let abierto = null;          // usuario del modal; null = alta
let usernameTocado = false;  // si se escribió el usuario a mano, la sugerencia no lo pisa

const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Admin', lector: 'Lector' };
const ACCION_LICENCIA = { licencia_cargada: 'Licencia cargada', licencia_editada: 'Licencia modificada', licencia_anulada: 'Licencia anulada' };
const TEXTO_ACCION = {
  alta: 'Alta del usuario',
  edicion: 'Edición de datos',
  cambio_rol: 'Cambio de rol',
  desactivacion: 'Desactivación',
  reactivacion: 'Reactivación',
  invitacion_enviada: 'Invitación enviada',
  recuperacion_enviada: 'Link para restablecer la contraseña',
  contrasena_establecida: 'Eligió su contraseña',
  contrasena_cambiada: 'Cambió su contraseña desde Mi Perfil',
  perfil_editado: 'Editó su perfil',
  ...ACCION_LICENCIA
};
const NOMBRE_CAMPO = { nombre_completo: 'Nombre', username: 'Usuario', email: 'Email', cargo: 'Cargo', vinculo: 'Vínculo' };
const CAMPO_A_INPUT = { nombre_completo: 'u-nombre', username: 'u-username', email: 'u-email', rol: 'u-rol', cargo: 'u-cargo', vinculo: 'u-vinculo' };

// Licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)
let datosLicencias = { hoy: '', firmante_titular_id: null, soy_titular: false, licencias: [], usuarios: [], autorizables: [] };
let licenciaAbierta = null;   // licencia del modal; null = alta
const TEXTO_ESTADO_LICENCIA = { futura: 'Próxima', en_curso: 'En curso', pasada: 'Terminada', anulada: 'Anulada' };

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita corrimientos de zona horaria)
const fechaCorta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const textoPeriodo = ({ desde, hasta }) => `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
const etiquetaLicencia = (l) => {
  if (!l) return '';
  return l.en_curso
    ? `<span class="etiqueta etiqueta-licencia">De licencia hasta ${esc(fechaCorta(l.hasta).slice(0, 5))}</span>`
    : `<span class="etiqueta etiqueta-licencia-proxima">Licencia desde ${esc(fechaCorta(l.desde).slice(0, 5))}</span>`;
};
// Efecto de la licencia del firmante titular en las notas (spec 7.2 y 7.3)
const efectoEnNotas = (licencia, autorizadoNombre) => {
  const cuando = licencia?.vispera ? `el ${fechaCorta(licencia.vispera)}` : 'el último día hábil anterior';
  return autorizadoNombre
    ? `Los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15), en una nota que comunica la autorización a ${autorizadoNombre}. Durante la licencia, ${autorizadoNombre} presenta las demás notas con las dos firmas, citando esa nota.`
    : `Sin persona autorizada: los avisos que tocarían durante la licencia salen por adelantado ${cuando} (corrida de las 8:15) y las reiteraciones se postergan a la vuelta. Cargá la licencia antes de ese día.`;
};

const esc = (texto) => Utils.escapeHtml(texto == null ? '' : String(texto));
const avisar = (mensaje, tipo = 'info') => showToast(esc(mensaje), tipo);
const esAprobador = (u) => u.rol === 'admin' || u.rol === 'superadmin';
const soyYo = (u) => Boolean(u) && u.id === Auth.getUser()?.id;
const sinTildes = (texto) => String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;
const leer = (id) => document.getElementById(id).value.trim();
const escribir = (id, valor) => { document.getElementById(id).value = valor ?? ''; };

// "hoy 09:12", "ayer 18:40", "hace 5 días", una fecha (más de 30 días) o "Sin registro"
const textoIngreso = (iso) => {
  if (!iso) return 'Sin registro';
  const fecha = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 86400000);
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (dias <= 0) return `hoy ${hora}`;
  if (dias === 1) return `ayer ${hora}`;
  if (dias <= 30) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-AR');
};
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '');

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (!Auth.isAdmin()) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('buscar-usuario').addEventListener('input', renderLista);
  document.getElementById('btn-nuevo-usuario').addEventListener('click', () => abrirModal(null));
  document.querySelector('main').addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-ver]');
    if (boton) verUsuario(Number(boton.dataset.ver));
    const editar = evento.target.closest('[data-licencia]');
    if (editar) abrirModalLicencia(datosLicencias.licencias.find(l => l.id === Number(editar.dataset.licencia)) ?? null);
  });
  document.getElementById('form-usuario').addEventListener('submit', guardarUsuario);
  document.getElementById('u-nombre').addEventListener('input', sugerirUsuario);
  document.getElementById('u-username').addEventListener('input', (evento) => {
    usernameTocado = evento.target.value.trim() !== '';
  });
  document.getElementById('btn-enviar-acceso').addEventListener('click', enviarAcceso);
  document.getElementById('btn-cambiar-estado').addEventListener('click', cambiarEstado);
  document.getElementById('btn-cancelar-usuario').addEventListener('click', cerrarModal);
  document.getElementById('modal-usuario-cerrar').addEventListener('click', cerrarModal);
  document.getElementById('usuario-pestanas').addEventListener('click', (evento) => {
    const pestana = evento.target.closest('[data-pestana]');
    if (pestana) mostrarPestana(pestana.dataset.pestana);
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && document.getElementById('modal-usuario').classList.contains('active')) cerrarModal();
    if (evento.key === 'Escape' && document.getElementById('modal-licencia').classList.contains('active')) cerrarModalLicencia();
  });

  document.getElementById('pagina-pestanas').addEventListener('click', (evento) => {
    const pestana = evento.target.closest('[data-vista]');
    if (pestana) mostrarVista(pestana.dataset.vista);
  });
  document.getElementById('btn-nueva-licencia').addEventListener('click', () => abrirModalLicencia(null));
  document.getElementById('grupo-licencias-pasadas').addEventListener('toggle', cargarLicenciasPasadas);
  document.getElementById('form-licencia').addEventListener('submit', guardarLicencia);
  document.getElementById('l-usuario').addEventListener('change', prepararAutorizado);
  document.getElementById('l-autorizado').addEventListener('change', actualizarEfecto);
  document.getElementById('btn-anular-licencia').addEventListener('click', anularLicencia);
  document.getElementById('btn-cancelar-licencia').addEventListener('click', cerrarModalLicencia);
  document.getElementById('modal-licencia-cerrar').addEventListener('click', cerrarModalLicencia);

  cargarUsuarios();
});

// =====================================================
// LISTA
// =====================================================
async function cargarUsuarios() {
  try {
    ({ usuarios, resumen } = await API.getUsuarios());
    renderLista();
  } catch (error) {
    document.getElementById('lista-aprobadores').innerHTML = `<p class="lista-vacia">No se pudo cargar la lista: ${esc(error.message)}</p>`;
  }
}

const etiquetasDe = (u) => [
  `<span class="etiqueta rol-${esc(u.rol)}">${esc(TEXTO_ROL[u.rol] || u.rol)}</span>`,
  etiquetaLicencia(u.licencia),
  u.vinculo === 'contrato' ? '<span class="etiqueta etiqueta-contrato">Contrato</span>' : '',
  u.estado === 'invitacion_pendiente'
    ? `<span class="etiqueta etiqueta-pendiente" title="${esc(u.invitacion_vence ? `Vence ${fechaHora(u.invitacion_vence)}` : 'Sin link vigente: reenviá la invitación')}">Invitación pendiente</span>`
    : '',
  u.email_valido ? '' : '<span class="etiqueta etiqueta-sin-email">Sin email</span>'
].join('');

const filaUsuario = (u) => {
  const cargo = Utils.textoCargo(u.cargo, u.vinculo);
  const vinculo = u.vinculo && u.vinculo !== 'contrato' ? Utils.textoVinculo(u.vinculo) : '';
  return `
    <article class="fila-usuario${u.estado === 'desactivado' ? ' fila-desactivada' : ''}">
      <div class="usuario-avatar rol-${esc(u.rol)}" aria-hidden="true">${esc(getInitials(u.nombre_completo))}</div>
      <div class="usuario-datos">
        <div class="usuario-nombre"><strong>${esc(u.nombre_completo)}</strong>${etiquetasDe(u)}</div>
        <div class="usuario-detalle">
          <span class="usuario-username">${esc(u.username)}</span>
          ${cargo ? `<span>${esc(cargo)}</span>` : ''}
          ${vinculo ? `<span class="text-muted">${esc(vinculo)}</span>` : ''}
        </div>
        <div class="usuario-ingreso text-muted">Último ingreso: ${esc(textoIngreso(u.ultimo_ingreso))}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-ver="${esc(u.id)}" aria-label="Ver a ${esc(u.nombre_completo)}">Ver</button>
    </article>`;
};

const pintar = (id, lista, vacio) => {
  document.getElementById(id).innerHTML = lista.length > 0
    ? lista.map(filaUsuario).join('')
    : `<p class="lista-vacia">${esc(vacio)}</p>`;
};

// El superadmin primero; después, por nombre
const ordenAprobadores = (a, b) =>
  (b.rol === 'superadmin') - (a.rol === 'superadmin') || a.nombre_completo.localeCompare(b.nombre_completo, 'es');

function renderLista() {
  const texto = sinTildes(document.getElementById('buscar-usuario').value.trim());
  const coincide = (u) => !texto || [u.nombre_completo, u.username, u.cargo, u.email].some(v => sinTildes(v).includes(texto));
  const visibles = usuarios.filter(coincide);
  const vigentes = visibles.filter(u => u.estado !== 'desactivado');

  pintar('lista-aprobadores', vigentes.filter(esAprobador).sort(ordenAprobadores),
    texto ? 'Ningún aprobador coincide con la búsqueda.' : 'Todavía no hay aprobadores.');
  pintar('lista-lectores', vigentes.filter(u => !esAprobador(u)),
    texto ? 'Ningún usuario de solo lectura coincide con la búsqueda.' : 'No hay usuarios de solo lectura.');
  pintar('lista-desactivados', visibles.filter(u => u.estado === 'desactivado'), 'No hay usuarios desactivados.');

  const lectores = usuarios.filter(u => u.estado !== 'desactivado' && !esAprobador(u)).length;
  document.getElementById('contador-lectores').textContent = plural(lectores, 'activo', 'activos');
  document.getElementById('contador-desactivados').textContent = String(usuarios.filter(u => u.estado === 'desactivado').length);
  renderResumenAprobadores();
}

// Encabezado de aprobadores: iniciales de quienes pueden aprobar hoy y el contador contra el mínimo (spec 12.2)
function renderResumenAprobadores() {
  const activos = usuarios.filter(u => esAprobador(u) && u.estado === 'activo').sort(ordenAprobadores);
  const { aprobadores_activos: cantidad, minimo } = resumen;
  const contenedor = document.getElementById('aprobadores-resumen');
  const enElMinimo = cantidad <= minimo;
  contenedor.classList.toggle('en-el-minimo', enElMinimo);
  contenedor.title = enElMinimo ? 'No se puede sacar a ningún aprobador más: la doble verificación necesita al menos 2.' : '';
  contenedor.innerHTML = `
    <div class="aprobadores-iniciales" aria-hidden="true">
      ${activos.map(u => `<span class="usuario-avatar mini rol-${esc(u.rol)}" title="${esc(u.nombre_completo)}">${esc(getInitials(u.nombre_completo))}</span>`).join('')}
    </div>
    <span class="aprobadores-contador">${esc(plural(cantidad, 'activo', 'activos'))} (mínimo ${esc(minimo)})</span>`;
}

// =====================================================
// MODAL
// =====================================================
async function verUsuario(id) {
  try {
    abrirModal(await API.getUsuario(id));
  } catch (error) {
    avisar(error.message, 'error');
  }
}

function abrirModal(u) {
  abierto = u;
  usernameTocado = Boolean(u);
  limpiarErrores();
  const protegida = Boolean(u) && u.rol === 'superadmin' && !soyYo(u);
  const superadminPropio = Boolean(u) && u.rol === 'superadmin' && soyYo(u);

  document.getElementById('modal-usuario-titulo').textContent = u ? u.nombre_completo : 'Nuevo usuario';
  document.getElementById('modal-usuario-etiquetas').innerHTML = u ? etiquetasDe(u) : '';
  document.getElementById('usuario-pestanas').hidden = !u;
  document.getElementById('aviso-protegida').hidden = !protegida;

  escribir('u-nombre', u?.nombre_completo);
  escribir('u-username', u?.username);
  escribir('u-email', u?.email);
  escribir('u-cargo', u?.cargo);
  document.getElementById('u-vinculo').value = u?.vinculo || '';
  const selectRol = document.getElementById('u-rol');
  selectRol.querySelector('option[value="superadmin"]').hidden = !(u && u.rol === 'superadmin');
  selectRol.value = u?.rol || 'lector';

  for (const id of Object.values(CAMPO_A_INPUT)) document.getElementById(id).disabled = protegida;
  selectRol.disabled = protegida || superadminPropio;
  document.getElementById('acciones-form').hidden = protegida;
  document.getElementById('btn-guardar-usuario').textContent = u ? 'Guardar cambios' : 'Crear usuario';

  renderAcceso(u, { protegida, superadminPropio });
  renderHistorial(u?.historial || []);
  mostrarPestana('datos');
  document.getElementById('modal-usuario').classList.add('active');
  // El overlay entra con una transición de visibility: hasta que termina, el campo no acepta foco (igual que areas.js)
  if (!protegida) setTimeout(() => document.getElementById('u-nombre').focus(), 100);
}

function cerrarModal() {
  document.getElementById('modal-usuario').classList.remove('active');
  abierto = null;
}

function mostrarPestana(nombre) {
  document.querySelectorAll('#usuario-pestanas .usuario-pestana').forEach(boton => {
    const activa = boton.dataset.pestana === nombre;
    boton.classList.toggle('activa', activa);
    boton.setAttribute('aria-selected', String(activa));
  });
  document.getElementById('pestana-datos').hidden = nombre !== 'datos';
  document.getElementById('pestana-historial').hidden = nombre !== 'historial';
}

function renderAcceso(u, { protegida, superadminPropio }) {
  const bloque = document.getElementById('bloque-acceso');
  bloque.hidden = !u || protegida;
  if (!u || protegida) return;

  const detalle = [`Último ingreso: ${textoIngreso(u.ultimo_ingreso)}`];
  if (u.estado === 'invitacion_pendiente') {
    detalle.push(u.invitacion_vence ? `Invitación pendiente, vence ${fechaHora(u.invitacion_vence)}` : 'Invitación pendiente, sin link vigente');
  }
  if (u.estado === 'desactivado') detalle.push('Desactivado: no puede ingresar');
  // Cada parte pierde su punto final ("p. m.") para no terminar en ".."
  document.getElementById('acceso-detalle').textContent = `${detalle.map(parte => parte.replace(/\.$/, '')).join('. ')}.`;

  const enviar = document.getElementById('btn-enviar-acceso');
  enviar.textContent = u.estado === 'invitacion_pendiente' ? 'Reenviar invitación' : 'Enviar link para restablecer la contraseña';
  enviar.disabled = u.estado === 'desactivado' || !u.email_valido;
  document.getElementById('acceso-nota').textContent = !u.email_valido
    ? 'No tiene un email válido: cargale uno y guardá antes de enviarle un link.'
    : u.estado === 'desactivado' ? 'Reactivalo para poder enviarle un link.' : '';

  const estado = document.getElementById('btn-cambiar-estado');
  estado.hidden = superadminPropio;
  estado.textContent = u.estado === 'desactivado' ? 'Reactivar' : 'Desactivar';
  estado.className = `btn ${u.estado === 'desactivado' ? 'btn-secondary' : 'btn-danger'}`;
}

function sugerirUsuario() {
  if (abierto || usernameTocado) return;
  escribir('u-username', Utils.sugerirUsername(leer('u-nombre'), usuarios.map(u => u.username)));
}

// =====================================================
// ACCIONES
// =====================================================
async function guardarUsuario(evento) {
  evento.preventDefault();
  limpiarErrores();
  const datos = {
    nombre_completo: leer('u-nombre'),
    username: leer('u-username'),
    email: leer('u-email'),
    cargo: leer('u-cargo'),
    vinculo: document.getElementById('u-vinculo').value || null
  };
  const selectRol = document.getElementById('u-rol');
  if (!selectRol.disabled) datos.rol = selectRol.value;

  // Confirmación al cambiar un rol, y en especial el propio (spec 8.5)
  if (abierto && datos.rol && datos.rol !== abierto.rol) {
    const texto = soyYo(abierto)
      ? 'Vas a perder el acceso de administrador en este momento. ¿Continuar?'
      : datos.rol === 'admin'
        ? `${abierto.nombre_completo} va a pasar a Admin: podrá proponer y aprobar cambios. ¿Continuar?`
        : `${abierto.nombre_completo} va a pasar a Lector: deja de poder proponer y aprobar cambios. ¿Continuar?`;
    if (!confirm(texto)) return;
  }

  const boton = document.getElementById('btn-guardar-usuario');
  boton.disabled = true;
  try {
    if (abierto) {
      const res = await API.actualizarUsuario(abierto.id, datos);
      avisar(res.message || 'Cambios guardados', 'success');
      if (soyYo(abierto) && datos.rol === 'lector') {
        window.location.href = 'index.html';
        return;
      }
    } else {
      const res = await API.crearUsuario(datos);
      avisar(res.message, res.data.email_enviado ? 'success' : 'warning');
    }
    cerrarModal();
    await cargarUsuarios();
  } catch (error) {
    mostrarError(error);
  } finally {
    boton.disabled = false;
  }
}

const MENSAJE_SIN_GUARDAR = 'Guardá los cambios antes de continuar.';

// Los datos de un usuario como los guarda el servidor, para comparar el formulario con lo guardado
const normalizados = ({ nombre, username, email, cargo, vinculo }) => ({
  nombre: String(nombre ?? '').trim(),
  username: String(username ?? '').trim().toUpperCase(),
  email: String(email ?? '').trim().toLowerCase(),
  cargo: String(cargo ?? '').trim() || null,
  vinculo: vinculo || null
});

// ¿El formulario del usuario abierto tiene cambios sin guardar? (en el alta no aplica)
function hayCambiosSinGuardar() {
  if (!abierto) return false;
  const guardado = normalizados({
    nombre: abierto.nombre_completo, username: abierto.username, email: abierto.email, cargo: abierto.cargo, vinculo: abierto.vinculo
  });
  const formulario = normalizados({
    nombre: leer('u-nombre'), username: leer('u-username'), email: leer('u-email'), cargo: leer('u-cargo'),
    vinculo: document.getElementById('u-vinculo').value
  });
  return Object.keys(guardado).some(campo => guardado[campo] !== formulario[campo]);
}

// Enviar un link o cambiar el estado vuelve a abrir al usuario con lo guardado: los cambios del formulario se perderían
function bloqueadoPorCambiosSinGuardar() {
  limpiarErrores();
  if (!hayCambiosSinGuardar()) return false;
  mostrarError({ message: MENSAJE_SIN_GUARDAR });
  return true;
}

async function enviarAcceso() {
  if (bloqueadoPorCambiosSinGuardar()) return;
  const boton = document.getElementById('btn-enviar-acceso');
  boton.disabled = true;
  try {
    const res = await API.enviarAccesoUsuario(abierto.id);
    avisar(res.message, res.data.email_enviado ? 'success' : 'warning');
    await recargarAbierto();
  } catch (error) {
    mostrarError(error);
    boton.disabled = false;
  }
}

async function cambiarEstado() {
  if (bloqueadoPorCambiosSinGuardar()) return;
  const u = abierto;
  const desactivar = u.estado !== 'desactivado';
  if (desactivar) {
    const partes = [soyYo(u)
      ? 'Vas a desactivar tu propia cuenta y perder el acceso en este momento.'
      : `${u.nombre_completo} no va a poder ingresar al RPAD y se cerrarán sus sesiones.`];
    if (u.cambios_pendientes_propuestos > 0) {
      partes.push(`Tiene ${plural(u.cambios_pendientes_propuestos, 'cambio pendiente', 'cambios pendientes')} que otros admins todavía pueden aprobar o rechazar.`);
    }
    if (!confirm(`${partes.join('\n\n')}\n\n¿Desactivar?`)) return;
  }
  try {
    const res = desactivar ? await API.desactivarUsuario(u.id) : await API.reactivarUsuario(u.id);
    avisar(res.message, 'success');
    if (desactivar && soyYo(u)) {
      Auth.logout();
      return;
    }
    await recargarAbierto();
  } catch (error) {
    mostrarError(error);
  }
}

async function recargarAbierto() {
  const id = abierto?.id;
  await cargarUsuarios();
  if (id) abrirModal(await API.getUsuario(id));
}

// =====================================================
// ERRORES E HISTORIAL
// =====================================================
function limpiarErrores() {
  document.getElementById('usuario-error').hidden = true;
  document.querySelectorAll('#form-usuario .campo-error').forEach(nodo => nodo.remove());
  document.querySelectorAll('#form-usuario [aria-invalid]').forEach(nodo => {
    nodo.removeAttribute('aria-invalid');
    nodo.removeAttribute('aria-describedby');
  });
}

// Con campo, el mensaje va debajo del input; si no, arriba del formulario
function mostrarError(error) {
  const input = error.campo && document.getElementById(CAMPO_A_INPUT[error.campo]);
  if (input) {
    const mensaje = document.createElement('p');
    mensaje.className = 'campo-error';
    mensaje.id = `${input.id}-error`;
    mensaje.textContent = error.message;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', mensaje.id);
    input.insertAdjacentElement('afterend', mensaje);
    mostrarPestana('datos');
    input.focus();
    return;
  }
  const caja = document.getElementById('usuario-error');
  caja.textContent = error.message;
  caja.hidden = false;
}

const textoValor = (campo, valor) => {
  if (valor === null || valor === '') return '(vacío)';
  return campo === 'vinculo' ? Utils.textoVinculo(valor) : valor;
};

function describirDetalle({ accion, detalle }) {
  const d = detalle || {};
  if (accion === 'alta') return `Rol inicial: ${TEXTO_ROL[d.rol] || d.rol}`;
  if (accion === 'cambio_rol') return `${TEXTO_ROL[d.antes] || d.antes} → ${TEXTO_ROL[d.despues] || d.despues}`;
  if (d.campos) {
    return Object.entries(d.campos)
      .map(([campo, cambio]) => `${NOMBRE_CAMPO[campo] || campo}: ${textoValor(campo, cambio.antes)} → ${textoValor(campo, cambio.despues)}`)
      .join('; ');
  }
  if (accion === 'desactivacion' && d.cambios_pendientes) {
    return `Tenía ${plural(d.cambios_pendientes, 'cambio pendiente', 'cambios pendientes')}`;
  }
  if ('email_enviado' in d) return d.email_enviado ? 'Email enviado' : `No se pudo enviar el email${d.error ? `: ${d.error}` : ''}`;
  if (accion in ACCION_LICENCIA && d.despues) return `${textoPeriodo(d.antes)} → ${textoPeriodo(d.despues)}`;
  if (accion in ACCION_LICENCIA && d.desde) return textoPeriodo(d);
  return '';
}

function renderHistorial(historial) {
  const lista = document.getElementById('historial-usuario');
  if (historial.length === 0) {
    lista.innerHTML = '<li class="text-muted">Sin movimientos registrados.</li>';
    return;
  }
  lista.innerHTML = historial.map(h => {
    const detalle = describirDetalle(h);
    const quien = h.actor_id ? `${h.actor_nombre} (${h.actor_username})` : 'Pedido desde la pantalla de ingreso';
    return `
      <li>
        <div class="historial-cabecera"><strong>${esc(TEXTO_ACCION[h.accion] || h.accion)}</strong><time datetime="${esc(h.created_at)}">${esc(fechaHora(h.created_at))}</time></div>
        <div class="text-muted">${esc(quien)}</div>
        ${detalle ? `<div>${esc(detalle)}</div>` : ''}
      </li>`;
  }).join('');
}

// =====================================================
// LICENCIAS (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)
// =====================================================
function mostrarVista(nombre) {
  document.querySelectorAll('#pagina-pestanas [data-vista]').forEach(boton => {
    const activa = boton.dataset.vista === nombre;
    boton.classList.toggle('activa', activa);
    boton.setAttribute('aria-selected', String(activa));
  });
  document.getElementById('vista-usuarios').hidden = nombre !== 'usuarios';
  document.getElementById('vista-licencias').hidden = nombre !== 'licencias';
  document.getElementById('btn-nuevo-usuario').hidden = nombre !== 'usuarios';
  if (nombre === 'licencias') cargarLicencias();
}

async function cargarLicencias() {
  try {
    datosLicencias = await API.getLicencias();
    const vigentes = datosLicencias.licencias.filter(l => l.estado === 'futura' || l.estado === 'en_curso');
    document.getElementById('lista-licencias').innerHTML = vigentes.length
      ? vigentes.map(filaLicencia).join('')
      : '<p class="lista-vacia">No hay licencias en curso ni próximas.</p>';
  } catch (error) {
    document.getElementById('lista-licencias').innerHTML = `<p class="lista-vacia">No se pudieron cargar las licencias: ${esc(error.message)}</p>`;
  }
}

async function cargarLicenciasPasadas() {
  if (!document.getElementById('grupo-licencias-pasadas').open) return;
  const lista = document.getElementById('lista-licencias-pasadas');
  try {
    const todas = await API.getLicencias(true);
    const pasadas = todas.licencias.filter(l => l.estado === 'pasada' || l.estado === 'anulada').reverse();
    lista.innerHTML = pasadas.length ? pasadas.map(filaLicencia).join('') : '<p class="lista-vacia">No hay licencias terminadas ni anuladas.</p>';
  } catch (error) {
    lista.innerHTML = `<p class="lista-vacia">No se pudieron cargar: ${esc(error.message)}</p>`;
  }
}

const filaLicencia = (l) => {
  const esTitular = l.usuario_id === datosLicencias.firmante_titular_id;
  const vigente = l.estado === 'futura' || l.estado === 'en_curso';
  const detalle = [textoPeriodo(l), TEXTO_ESTADO_LICENCIA[l.estado], l.creado_por_nombre ? `Cargó ${l.creado_por_nombre}` : ''].filter(Boolean);
  return `
    <article class="fila-usuario${vigente ? '' : ' fila-desactivada'}">
      <div class="usuario-avatar" aria-hidden="true">${esc(getInitials(l.usuario_nombre))}</div>
      <div class="usuario-datos">
        <div class="usuario-nombre"><strong>${esc(l.usuario_nombre)}</strong>${esTitular ? '<span class="etiqueta rol-superadmin">Firma las notas</span>' : ''}</div>
        <div class="usuario-detalle">${detalle.map(d => `<span>${esc(d)}</span>`).join('')}</div>
        ${esTitular && vigente ? `<div class="usuario-ingreso text-muted">${esc(efectoEnNotas(l, l.autorizado_nombre))}</div>` : ''}
      </div>
      ${vigente ? `<button type="button" class="btn btn-secondary btn-sm" data-licencia="${esc(l.id)}" aria-label="Editar la licencia de ${esc(l.usuario_nombre)}">Editar</button>` : ''}
    </article>`;
};

function abrirModalLicencia(l) {
  licenciaAbierta = l;
  limpiarErrorLicencia();
  document.getElementById('modal-licencia-titulo').textContent = l ? `Licencia de ${l.usuario_nombre}` : 'Nueva licencia';
  const selector = document.getElementById('l-usuario');
  const opciones = datosLicencias.usuarios.map(u => ({ id: u.id, nombre: u.nombre_completo }));
  if (l && !opciones.some(o => o.id === l.usuario_id)) opciones.push({ id: l.usuario_id, nombre: l.usuario_nombre });
  selector.innerHTML = opciones.map(o => `<option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join('');
  if (l) selector.value = String(l.usuario_id);
  selector.disabled = Boolean(l);
  escribir('l-desde', l?.desde);
  escribir('l-hasta', l?.hasta);
  document.getElementById('l-desde').disabled = l?.estado === 'en_curso';
  document.getElementById('btn-anular-licencia').hidden = !l || l.desde < datosLicencias.hoy;
  prepararAutorizado();
  document.getElementById('modal-licencia').classList.add('active');
}

function cerrarModalLicencia() {
  document.getElementById('modal-licencia').classList.remove('active');
  licenciaAbierta = null;
}

// La persona autorizada: solo en la licencia del firmante titular, y solo la elige el titular (spec 6.3)
function prepararAutorizado() {
  const usuarioId = Number(document.getElementById('l-usuario').value);
  const esTitular = usuarioId === datosLicencias.firmante_titular_id;
  const puedeAutorizar = esTitular && datosLicencias.soy_titular;
  document.getElementById('grupo-autorizado').hidden = !puedeAutorizar;
  if (puedeAutorizar) {
    const selector = document.getElementById('l-autorizado');
    selector.innerHTML = ['<option value="">Nadie: se anticipan los avisos</option>',
      ...datosLicencias.autorizables.map(a => `<option value="${esc(a.id)}">${esc(a.nombre_completo)}</option>`)].join('');
    selector.value = licenciaAbierta?.autorizado_id ? String(licenciaAbierta.autorizado_id) : '';
  }
  actualizarEfecto();
}

function actualizarEfecto() {
  const usuarioId = Number(document.getElementById('l-usuario').value);
  const efecto = document.getElementById('licencia-efecto');
  efecto.hidden = usuarioId !== datosLicencias.firmante_titular_id;
  if (efecto.hidden) return;
  const elegido = document.getElementById('grupo-autorizado').hidden
    ? licenciaAbierta?.autorizado_nombre
    : datosLicencias.autorizables.find(a => String(a.id) === document.getElementById('l-autorizado').value)?.nombre_completo;
  efecto.textContent = efectoEnNotas(licenciaAbierta, elegido ?? null);
}

async function guardarLicencia(evento) {
  evento.preventDefault();
  limpiarErrorLicencia();
  const datos = { desde: document.getElementById('l-desde').value, hasta: document.getElementById('l-hasta').value };
  if (!document.getElementById('grupo-autorizado').hidden) datos.autorizado_id = document.getElementById('l-autorizado').value || null;
  const boton = document.getElementById('btn-guardar-licencia');
  boton.disabled = true;
  try {
    const res = licenciaAbierta
      ? await API.editarLicencia(licenciaAbierta.id, datos)
      : await API.crearLicencia({ ...datos, usuario_id: Number(document.getElementById('l-usuario').value) });
    avisar(res.message, 'success');
    cerrarModalLicencia();
    await Promise.all([cargarLicencias(), cargarUsuarios()]);
  } catch (error) {
    mostrarErrorLicencia(error);
  } finally {
    boton.disabled = false;
  }
}

async function anularLicencia() {
  const l = licenciaAbierta;
  if (!l || !confirm(`¿Anular la licencia de ${l.usuario_nombre} (${textoPeriodo(l).toLowerCase()})?`)) return;
  try {
    const res = await API.anularLicencia(l.id);
    avisar(res.message, 'success');
    cerrarModalLicencia();
    await Promise.all([cargarLicencias(), cargarUsuarios()]);
  } catch (error) {
    mostrarErrorLicencia(error);
  }
}

function limpiarErrorLicencia() {
  document.getElementById('licencia-error').hidden = true;
}

function mostrarErrorLicencia(error) {
  const caja = document.getElementById('licencia-error');
  caja.textContent = error.message;
  caja.hidden = false;
}
