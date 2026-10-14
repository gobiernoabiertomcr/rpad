/**
 * Perfil - RPAD
 * Lógica para gestión de perfil y cambios pendientes
 */

let cambioSeleccionado = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Cargar datos del perfil
  await cargarPerfil();

  // Mostrar sección de cambios solo para admins
  if (Auth.isAdmin()) {
    document.getElementById('seccion-cambios').style.display = 'block';
    await cargarMisCambios();
    await cargarCambiosParaRevisar();
    await actualizarBadges();
  }

  // Setup eventos
  setupEventos();
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

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      // Activar tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Mostrar contenido
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });

  // Filtros
  document.getElementById('filtro-mis-estado').addEventListener('change', cargarMisCambios);
  document.getElementById('filtro-revisar-tipo').addEventListener('change', cargarCambiosParaRevisar);
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

    Utils.showSuccess('Contraseña cambiada correctamente');
    document.getElementById('form-password').reset();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cambiar Contraseña';
  }
}

/**
 * Cargar mis cambios propuestos
 */
async function cargarMisCambios() {
  const container = document.getElementById('lista-mis-cambios');
  const estado = document.getElementById('filtro-mis-estado').value;

  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const cambios = await API.getMisCambios({ estado: estado !== 'todos' ? estado : null });
    
    if (cambios.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--gray-300);"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M2 8v8"/><path d="M22 8v8"/></svg>
          <p class="text-muted">No tienes cambios ${estado !== 'todos' ? estado + 's' : ''}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = cambios.map(c => renderCambioCard(c, false)).join('');
  } catch (error) {
    console.error('Error cargando mis cambios:', error);
    container.innerHTML = '<p class="text-danger">Error al cargar cambios</p>';
  }
}

/**
 * Cargar cambios para revisar (de otros usuarios)
 */
async function cargarCambiosParaRevisar() {
  const container = document.getElementById('lista-para-revisar');
  const tipo = document.getElementById('filtro-revisar-tipo').value;

  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const cambios = await API.getCambiosPendientesParaRevisar({ 
      tipo: tipo || null,
      estado: 'pendiente'
    });
    
    if (cambios.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            <p class="text-muted">No hay cambios pendientes de revisión</p>
            </div>
            `;
      return;
    }

    container.innerHTML = cambios.map(c => renderCambioCard(c, true)).join('');
  } catch (error) {
    console.error('Error cargando cambios para revisar:', error);
    container.innerHTML = '<p class="text-danger">Error al cargar cambios</p>';
  }
}

/**
 * Actualizar badges de contadores
 */
async function actualizarBadges() {
  try {
    // Badge de "Para Revisar"
    const { cantidad } = await API.getContadorPendientes();
    const badgeRevisar = document.getElementById('badge-para-revisar');
    const badgeNav = document.getElementById('nav-badge-admin');
    
    if (cantidad > 0) {
      badgeRevisar.textContent = cantidad;
      badgeRevisar.style.display = 'inline';
    } else {
      badgeRevisar.style.display = 'none';
    }

    // Badge de "Mis Cambios" (pendientes)
    const misCambios = await API.getMisCambios({ estado: 'pendiente' });
    const badgeMis = document.getElementById('badge-mis-cambios');
    if (misCambios.length > 0) {
      badgeMis.textContent = misCambios.length;
      badgeMis.style.display = 'inline';
    } else {
      badgeMis.style.display = 'none';
    }
  } catch (error) {
    console.error('Error actualizando badges:', error);
  }
}

/**
 * Renderizar tarjeta de cambio
 */
function renderCambioCard(cambio, mostrarAcciones) {
  const tipoTexto = {
    'crear': 'Creación',
    'editar': 'Edición',
    'eliminar': 'Eliminación'
  };

  const titulo = cambio.tipo_cambio === 'crear' 
    ? cambio.datos_nuevos?.titulo || 'Nuevo dataset'
    : cambio.dataset_titulo || 'Dataset';

  const tiempoRelativo = calcularTiempoRelativo(cambio.created_at);

  let estadoHtml = '';
  if (cambio.estado === 'aprobado') {
    estadoHtml = `<span class="badge-estado aprobado">✓ Aprobado</span>`;
  } else if (cambio.estado === 'rechazado') {
    estadoHtml = `<span class="badge-estado rechazado">✗ Rechazado</span>`;
  } else {
    estadoHtml = `<span class="badge-estado pendiente">⏳ Pendiente</span>`;
  }

  // Acciones: si requiere revisión mostrar "Revisar", sino "Ver detalle"
  let accionesHtml = '';
  if (mostrarAcciones && cambio.estado === 'pendiente') {
    accionesHtml = `
      <div class="cambio-card-actions">
        <button class="btn btn-sm btn-primary" onclick="verDetalle(${cambio.id})">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          Revisar
        </button>
      </div>
    `;
  } else {
    accionesHtml = `
      <div class="cambio-card-actions">
        <button class="btn btn-sm btn-secondary" onclick="verDetalle(${cambio.id})">Ver detalle</button>
      </div>
    `;
  }

  let infoAdicional = '';
  if (cambio.estado === 'rechazado' && cambio.comentario_rechazo) {
    infoAdicional = `
      <div class="alert alert-error" style="margin-top: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem;">
        <strong>Motivo:</strong> ${Utils.escapeHtml(cambio.comentario_rechazo)}
      </div>
    `;
  }
  
  if (cambio.estado !== 'pendiente' && cambio.revisor_nombre) {
    infoAdicional += `
      <div class="text-small text-muted" style="margin-top: 0.25rem;">
        Revisado por: ${Utils.escapeHtml(cambio.revisor_nombre)}
      </div>
    `;
  }

  return `
    <div class="cambio-card ${cambio.tipo_cambio}">
      <div class="cambio-card-header">
        <div>
          <span class="badge-tipo ${cambio.tipo_cambio}">${tipoTexto[cambio.tipo_cambio]}</span>
          ${estadoHtml}
        </div>
        <span class="tiempo-relativo">${tiempoRelativo}</span>
      </div>
      <div class="cambio-card-title">${Utils.escapeHtml(titulo)}</div>
      <div class="cambio-card-meta">
        ${mostrarAcciones ? `Propuesto por: ${Utils.escapeHtml(cambio.usuario_nombre || cambio.usuario_username)}` : ''}
      </div>
      ${infoAdicional}
      ${accionesHtml}
    </div>
  `;
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
 * Ver detalle de un cambio
 */
async function verDetalle(id) {
  try {
    const cambio = await API.getCambioPendiente(id);
    cambioSeleccionado = cambio;

    const modal = document.getElementById('modal-detalle');
    const titulo = document.getElementById('modal-detalle-titulo');
    const contenido = document.getElementById('modal-detalle-contenido');
    const footer = document.getElementById('modal-detalle-footer');

    const tipoTexto = {
      'crear': 'Creación de Dataset',
      'editar': 'Edición de Dataset',
      'eliminar': 'Eliminación de Dataset'
    };

    titulo.textContent = tipoTexto[cambio.tipo_cambio];

    // Renderizar comparador
    contenido.innerHTML = renderComparador(cambio);

// Botones del footer
    // Comparar como números para evitar problemas de tipo (string vs number)
    const esPropioCambio = Number(cambio.usuario_id) === Number(Auth.getUser()?.id);
    if (cambio.estado === 'pendiente' && !esPropioCambio) {
      footer.innerHTML = `
        <button class="btn btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>
        <button class="btn btn-danger" onclick="cerrarModalDetalle(); abrirModalRechazo(${cambio.id})">✗ Rechazar</button>
        <button class="btn btn-success" onclick="aprobarCambio(${cambio.id})">✓ Aprobar</button>
      `;
    } else {
      footer.innerHTML = `<button class="btn btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>`;
    }

    modal.classList.add('active');
  } catch (error) {
    Utils.showError('Error al cargar detalle del cambio');
  }
}

/**
 * Renderizar comparador antes/despues
 */
function renderComparador(cambio) {
  // Obtener URL del portal según el tipo de cambio
  let urlPortal = null;
  if (cambio.tipo_cambio === 'crear') {
    urlPortal = cambio.datos_nuevos?.url_dataset;
  } else if (cambio.tipo_cambio === 'editar') {
    // Preferir URL del dataset original, o la nueva si se modificó
    urlPortal = cambio.dataset_url || cambio.datos_nuevos?.url_dataset;
  } else if (cambio.tipo_cambio === 'eliminar') {
    urlPortal = cambio.datos_anteriores?.url_dataset || cambio.dataset_url;
  }

  // Generar link al portal si existe URL (solo http/https)
  const urlPortalSegura = Utils.safeUrl(urlPortal);
  const linkPortalHtml = urlPortalSegura ? `
    <a href="${urlPortalSegura}" target="_blank" rel="noopener noreferrer" class="link-portal-revision">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Ver en Portal de Datos Abiertos
    </a>
  ` : '';

  // Campos a mostrar para crear/eliminar (con nombres enriquecidos)
  const camposCrearEliminar = [
    { key: 'titulo', label: 'Titulo' },
    { key: 'descripcion', label: 'Descripcion' },
    { key: 'area_nombre', label: 'Area Responsable' },
    { key: 'frecuencia_nombre', label: 'Frecuencia' },
    { key: 'tema_principal_nombre', label: 'Tema Principal' },
    { key: 'tema_secundario_nombre', label: 'Tema Secundario' },
    { key: 'tipo_gestion', label: 'Tipo de Gestion' },
    { key: 'ultima_actualizacion', label: 'Ultima Actualizacion' },
    { key: 'proxima_actualizacion', label: 'Proxima Actualizacion' },
    { key: 'url_dataset', label: 'URL en Portal' },
    { key: 'que_se_solicita', label: 'Qué se solicita' },
    { key: 'formatos_nombres', label: 'Formatos' }
  ];

  const datos = cambio.datos_nuevos || cambio.datos_anteriores || {};

  // CASO: CREAR - mostrar todos los campos del nuevo dataset
  if (cambio.tipo_cambio === 'crear') {
    let html = '';
    camposCrearEliminar.forEach(campo => {
      const valor = formatearValor(datos[campo.key]);
      if (valor && valor !== '-') {
        html += `
          <div class="comparador-field">
            <div class="comparador-field-label">${campo.label}</div>
            <div class="comparador-field-value">${Utils.escapeHtml(valor)}</div>
          </div>
        `;
      }
    });

    return `
      ${linkPortalHtml}
      <div class="comparador-col despues" style="max-width: 100%;">
        <div class="comparador-title">Datos del nuevo dataset</div>
        ${html || '<p class="text-muted">Sin datos</p>'}
      </div>
    `;
  }

  // CASO: ELIMINAR - mostrar datos del dataset a eliminar
  if (cambio.tipo_cambio === 'eliminar') {
    const datosEliminar = cambio.datos_anteriores || {};
    let html = '';
    camposCrearEliminar.forEach(campo => {
      const valor = formatearValor(datosEliminar[campo.key]);
      if (valor && valor !== '-') {
        html += `
          <div class="comparador-field">
            <div class="comparador-field-label">${campo.label}</div>
            <div class="comparador-field-value">${Utils.escapeHtml(valor)}</div>
          </div>
        `;
      }
    });

   return `
      ${linkPortalHtml}
      <div class="comparador-col antes" style="max-width: 100%;">
        <div class="comparador-title">Dataset a eliminar</div>
        ${html || '<p class="text-muted">Sin datos</p>'}
      </div>
    `;
  }

  // CASO: EDITAR - mostrar SOLO los campos que cambiaron
  if (cambio.tipo_cambio === 'editar' && cambio.campos_modificados) {
    if (cambio.campos_modificados.length === 0) {
      return `
        <div class="alert alert-info">
          No se detectaron cambios en los campos principales.
        </div>
      `;
    }

    let htmlCambios = '';
    cambio.campos_modificados.forEach(mod => {
      htmlCambios += `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius);">
          <div style="font-weight: 600; font-size: 0.8125rem; color: var(--gray-600); margin-bottom: 0.5rem;">${Utils.escapeHtml(mod.campo)}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
                <div style="font-size: 0.6875rem; color: var(--danger); text-transform: uppercase; margin-bottom: 0.25rem;">Antes</div>
                <div style="font-size: 0.875rem; color: var(--gray-700); background: #fee2e2; padding: 0.375rem 0.5rem; border-radius: 4px;">${Utils.escapeHtml(formatearFechaComparador(mod.antes))}</div>
            </div>
            <div>
                <div style="font-size: 0.6875rem; color: var(--success); text-transform: uppercase; margin-bottom: 0.25rem;">Despues</div>
            <div style="font-size: 0.875rem; color: var(--gray-700); background: #dcfce7; padding: 0.375rem 0.5rem; border-radius: 4px;">${Utils.escapeHtml(formatearFechaComparador(mod.despues))}</div>
            </div>
          </div>
        </div>
      `;
    });

    return `
      ${linkPortalHtml}
      <div>
        <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 1rem;">
          Se modificaron <strong>${cambio.campos_modificados.length}</strong> campo${cambio.campos_modificados.length > 1 ? 's' : ''}:
        </p>
        ${htmlCambios}
      </div>
    `;
  }

  // Fallback si no hay campos_modificados (no deberia pasar)
  return `
    <div class="alert alert-warning">
      No se pudo determinar los cambios realizados.
    </div>
  `;
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

/**
 * Cerrar modal detalle
 */
function cerrarModalDetalle() {
  document.getElementById('modal-detalle').classList.remove('active');
  cambioSeleccionado = null;
}

/**
 * Abrir modal de rechazo
 */
function abrirModalRechazo(id) {
  cambioSeleccionado = { id };
  document.getElementById('rechazo-comentario').value = '';
  document.getElementById('modal-rechazo').classList.add('active');
}

/**
 * Cerrar modal de rechazo
 */
function cerrarModalRechazo() {
  document.getElementById('modal-rechazo').classList.remove('active');
}

/**
 * Confirmar rechazo
 */
async function confirmarRechazo() {
  const comentario = document.getElementById('rechazo-comentario').value.trim();
  
  if (!comentario) {
    Utils.showError('Debe proporcionar un motivo de rechazo');
    return;
  }

  const btn = document.getElementById('btn-confirmar-rechazo');
  btn.disabled = true;
  btn.textContent = 'Rechazando...';

  try {
    await API.rechazarCambio(cambioSeleccionado.id, comentario);
    cerrarModalRechazo();
    cerrarModalDetalle();
    
    // Forzar recarga de las listas con pequeño delay para asegurar que la BD se actualizó
    await new Promise(resolve => setTimeout(resolve, 100));
    await cargarCambiosParaRevisar();
    await cargarMisCambios();
    await actualizarBadges();
    
    Utils.showSuccess('Cambio rechazado correctamente');
  } catch (error) {
    console.error('Error al rechazar cambio:', error);
    Utils.showError(error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Rechazar';
  }
}
/**
 * Aprobar un cambio
 */
async function aprobarCambio(id) {
  if (!confirm('¿Está seguro de aprobar este cambio?')) return;

  try {
    await API.aprobarCambio(id);
    cerrarModalDetalle();
    
    // Forzar recarga de las listas con pequeño delay para asegurar que la BD se actualizó
    await new Promise(resolve => setTimeout(resolve, 100));
    await cargarCambiosParaRevisar();
    await cargarMisCambios();
    await actualizarBadges();
    
    Utils.showSuccess('Cambio aprobado correctamente');
  } catch (error) {
    console.error('Error al aprobar cambio:', error);
    Utils.showError(error.message);
  }
}