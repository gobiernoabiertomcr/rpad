// Servicio de API
const API = {
  // === DATASETS ===
  async getDatasets(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.tema) params.append('tema', filtros.tema);
    if (filtros.frecuencia) params.append('frecuencia', filtros.frecuencia);
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

    const url = `${CONFIG.API_URL}/datasets${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  },

  async getDataset(id) {
    const response = await fetch(`${CONFIG.API_URL}/datasets/${id}`);
    const data = await response.json();
    return data.data;
  },

  async getEstadisticas() {
    const response = await fetch(`${CONFIG.API_URL}/datasets/estadisticas`);
    const data = await response.json();
    return data.data;
  },

  async createDataset(dataset) {
    const response = await fetch(`${CONFIG.API_URL}/datasets`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(dataset)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al crear dataset');
    return data.data;
  },

  async updateDataset(id, dataset) {
    const response = await fetch(`${CONFIG.API_URL}/datasets/${id}`, {
      method: 'PUT',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(dataset)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al actualizar dataset');
    return data.data;
  },

  async deleteDataset(id) {
    const response = await fetch(`${CONFIG.API_URL}/datasets/${id}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al eliminar dataset');
    return data;
  },

async registrarActualizacion(id, datos = {}) {
  const response = await fetch(`${CONFIG.API_URL}/datasets/${id}/actualizar`, {
    method: 'POST',
    headers: Auth.getAuthHeaders(),
    body: JSON.stringify(datos)
  });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al registrar actualización');
    return data.data;
  },

  // === CATÁLOGOS ===
  async getTemas() {
    const response = await fetch(`${CONFIG.API_URL}/catalogos/temas`);
    const data = await response.json();
    return data.data || [];
  },

  async getFrecuencias() {
    const response = await fetch(`${CONFIG.API_URL}/catalogos/frecuencias`);
    const data = await response.json();
    return data.data || [];
  },

  async getFormatos() {
    const response = await fetch(`${CONFIG.API_URL}/catalogos/formatos`);
    const data = await response.json();
    return data.data || [];
  },

  // === ÁREAS ===
  async getAreas() {
    const response = await fetch(`${CONFIG.API_URL}/areas`);
    const data = await response.json();
    return data.data || [];
  },

  async getArea(id) {
    const response = await fetch(`${CONFIG.API_URL}/areas/${id}`);
    const data = await response.json();
    return data.data;
  },

  async createArea(area) {
    const response = await fetch(`${CONFIG.API_URL}/areas`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(area)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al crear área');
    return data.data;
  },

  async updateArea(id, area) {
    const response = await fetch(`${CONFIG.API_URL}/areas/${id}`, {
      method: 'PUT',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(area)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al actualizar área');
    return data.data;
  },

  async deleteArea(id) {
    const response = await fetch(`${CONFIG.API_URL}/areas/${id}`, {
      method: 'DELETE',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al eliminar área');
    return data;
  },

  // === ANDINO (Portal de Datos Abiertos) ===
  async fetchFromAndino(url) {
    const response = await fetch(`${CONFIG.API_URL}/andino/fetch?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al consultar el portal');
    return data.data;
  },

  // === NOTIFICACIONES ===
  async verificarSmtp() {
    const response = await fetch(`${CONFIG.API_URL}/notificaciones/verificar-smtp`, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    return data;
  },

  async previewNotificacion(tipo) {
    const response = await fetch(`${CONFIG.API_URL}/notificaciones/preview/${tipo}`, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al generar preview');
    }
    return await response.text();
  },

  // Pedido JSON autenticado: lanza un Error con el mensaje del servidor si falla
  async pedirJson(metodo, ruta, body) {
    const response = await fetch(`${CONFIG.API_URL}${ruta}`, {
      method: metodo,
      headers: Auth.getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Error ${response.status}`);
      error.status = response.status;
      error.campo = data.campo;
      throw error;
    }
    return data;
  },

  async pedirArchivo(ruta) {
    const response = await fetch(`${CONFIG.API_URL}${ruta}`, { headers: Auth.getAuthHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Error ${response.status}`);
    }
    return response.blob();
  },

  async enviarPruebaAvisoArea() {
    return this.pedirJson('POST', '/notificaciones/prueba-area');
  },

  // === USUARIOS (panel) ===
  async getUsuarios() {
    return (await this.pedirJson('GET', '/usuarios')).data;
  },

  async getUsuario(id) {
    return (await this.pedirJson('GET', `/usuarios/${id}`)).data;
  },

  // Las acciones devuelven la respuesta completa: la pantalla muestra el message del servidor
  async crearUsuario(datos) {
    return this.pedirJson('POST', '/usuarios', datos);
  },

  async actualizarUsuario(id, datos) {
    return this.pedirJson('PUT', `/usuarios/${id}`, datos);
  },

  async desactivarUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/desactivar`);
  },

  async reactivarUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/reactivar`);
  },

  async enviarAccesoUsuario(id) {
    return this.pedirJson('POST', `/usuarios/${id}/enviar-acceso`);
  },

  // === LICENCIAS (spec 2026-10-15-dias-habiles-licencias-auditoria, 5) ===
  async getLicencias(incluirPasadas = false) {
    return (await this.pedirJson('GET', `/usuarios/licencias${incluirPasadas ? '?incluir_pasadas=1' : ''}`)).data;
  },

  async crearLicencia(datos) {
    return this.pedirJson('POST', '/usuarios/licencias', datos);
  },

  async editarLicencia(id, datos) {
    return this.pedirJson('PUT', `/usuarios/licencias/${id}`, datos);
  },

  async anularLicencia(id) {
    return this.pedirJson('POST', `/usuarios/licencias/${id}/anular`);
  },

  // Períodos sin ningún auditor disponible. params: { desde, hasta, usuario_id?, excluir? } (simula esa licencia, sin
  // guardarla); sin params, de hoy a hoy + 60 días. Devuelve [{ desde, hasta, vuelve, respaldo: [nombres] }]
  async getSinAuditor(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, valor]) => valor !== '' && valor != null)).toString();
    return (await this.pedirJson('GET', `/usuarios/licencias/sin-auditor${query ? `?${query}` : ''}`)).data.periodos;
  },

  // === MI FIRMA (spec 6.1) ===
  async getMiFirma() {
    return (await this.pedirJson('GET', '/auth/profile/firma')).data;
  },

  async guardarMiFirma(datos) {
    return this.pedirJson('PUT', '/auth/profile/firma', datos);
  },

  async getImagenMiFirma() {
    return this.pedirArchivo('/auth/profile/firma/imagen');
  },

  // === NOTAS DIGITALES ===
  async getEstadoNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/estado')).data;
  },

  async getLibroNotas(filtros = {}) {
    const params = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== '' && valor != null));
    const query = params.toString();
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales${query ? `?${query}` : ''}`)).data;
  },

  async getNota(id) {
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales/${id}`)).data;
  },

  async getNotaPdf(id) {
    return this.pedirArchivo(`/notificaciones/notas-digitales/${id}/pdf`);
  },

  // Anexo guardado de un aviso, como Blob
  async getNotaAnexo(id) {
    return this.pedirArchivo(`/notificaciones/notas-digitales/${id}/anexo`);
  },

  async reintentarNota(id) {
    return this.pedirJson('POST', `/notificaciones/notas-digitales/${id}/reintentar`);
  },

  async previewNota(tipo, gestion) {
    const query = new URLSearchParams({ tipo, gestion }).toString();
    return (await this.pedirJson('GET', `/notificaciones/notas-digitales/preview?${query}`)).data;
  },

  // PDF de la vista previa (N° XX, con el membrete y la firma cargados), como Blob
  async previewNotaPdf(tipo, gestion) {
    const query = new URLSearchParams({ tipo, gestion }).toString();
    return this.pedirArchivo(`/notificaciones/notas-digitales/preview/pdf?${query}`);
  },

  // Anexo del aviso de la vista previa (N° XX), como Blob
  async previewNotaAnexo(gestion) {
    const query = new URLSearchParams({ gestion }).toString();
    return this.pedirArchivo(`/notificaciones/notas-digitales/preview/anexo?${query}`);
  },

  async enviarPruebaNota(tipo, gestion) {
    return this.pedirJson('POST', '/notificaciones/notas-digitales/prueba', { tipo, gestion });
  },

  async getConfigNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/config')).data;
  },

  async guardarConfigNotas(datos) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config', datos);
  },

  async subirFirmaNotas(imagen, mime) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config/firma', { imagen, mime });
  },

  async getFirmaNotas() {
    return this.pedirArchivo('/notificaciones/notas-digitales/config/firma');
  },

  async subirMembreteNotas(imagen, mime) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config/membrete', { imagen, mime });
  },

  async getMembreteNotas() {
    return this.pedirArchivo('/notificaciones/notas-digitales/config/membrete');
  },

  // Firmante titular de las notas (spec 6.2)
  async getFirmantesNotas() {
    return (await this.pedirJson('GET', '/notificaciones/notas-digitales/config/firmantes')).data;
  },

  async elegirFirmanteNotas(usuarioId) {
    return this.pedirJson('PUT', '/notificaciones/notas-digitales/config/firmante', { usuario_id: usuarioId });
  },

  // === PERFIL ===
  async getProfile() {
    const response = await fetch(`${CONFIG.API_URL}/auth/profile`, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al obtener perfil');
    return data.data.user;
  },

  async updateProfile(datos) {
    const response = await fetch(`${CONFIG.API_URL}/auth/profile`, {
      method: 'PUT',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(datos)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al actualizar perfil');
    return data.data.user;
  },

  // === CAMBIOS PENDIENTES ===
  async getContadorPendientes() {
  const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/contador?_t=${Date.now()}`, {
    method: 'GET',
    headers: Auth.getAuthHeaders(),
    cache: 'no-store'
  });
    const data = await response.json();
    if (!response.ok) return { cantidad: 0 };
    return data.data;
  },

  async getCambiosPendientesParaRevisar(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.tipo) params.append('tipo', filtros.tipo);
  if (filtros.usuario) params.append('usuario', filtros.usuario);
  if (filtros.estado) params.append('estado', filtros.estado);
  params.append('_t', Date.now()); // Cache buster

  const url = `${CONFIG.API_URL}/cambios-pendientes/para-revisar?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: Auth.getAuthHeaders(),
    cache: 'no-store'
  });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al obtener cambios pendientes');
    return data.data;
  },

  async getMisCambios(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.estado) params.append('estado', filtros.estado);
  params.append('_t', Date.now()); // Cache buster

  const url = `${CONFIG.API_URL}/cambios-pendientes/mis-cambios?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: Auth.getAuthHeaders(),
    cache: 'no-store'
  });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al obtener mis cambios');
    return data.data;
  },

  async getCambioPendiente(id) {
    const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/${id}`, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al obtener cambio pendiente');
    return data.data;
  },

  async getDatasetsConPendientes() {
    const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/datasets-bloqueados?_t=${Date.now()}`, {
        method: 'GET',
        headers: Auth.getAuthHeaders(),
        cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) return [];
    return data.data;
  },

  async verificarDatasetBloqueado(datasetId) {
    const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/verificar/${datasetId}`, {
      method: 'GET',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) return { bloqueado: false };
    return data.data;
  },

  async aprobarCambio(id) {
    const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/${id}/aprobar`, {
      method: 'POST',
      headers: Auth.getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al aprobar cambio');
    return data;
  },

  async rechazarCambio(id, comentario) {
    const response = await fetch(`${CONFIG.API_URL}/cambios-pendientes/${id}/rechazar`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({ comentario })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al rechazar cambio');
    return data;
  },

  // === REPORTES PDF ===
  // El token viaja en el header Authorization (descargarPDF), nunca en la URL
  getReporteEstadoGeneralUrl() {
    return `${CONFIG.API_URL}/reportes/estado-general`;
  },

  getReporteHistorialUrl(desde, hasta) {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const query = params.toString();
    return `${CONFIG.API_URL}/reportes/historial-notificaciones${query ? `?${query}` : ''}`;
  },

  getReportePorAreaUrl(areaId) {
    return `${CONFIG.API_URL}/reportes/por-area/${areaId}`;
  },

  getReporteCumplimientoUrl(periodo) {
    return `${CONFIG.API_URL}/reportes/cumplimiento?periodo=${periodo}`;
  },

  // === NOTAS DOCX ===
  async generarNota(datos) {
    const response = await fetch(`${CONFIG.API_URL}/notas/generar`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify(datos)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al generar la nota');
    }
    return await response.blob();
  }
};

// === UTILIDADES ===
const Utils = {
  // Formatear fecha
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },

  // Calcular estado del dataset
  // Ahora considera tipo_gestion para diferenciar 'atrasado' de 'sin-respuesta'
  calcularEstado(proximaActualizacion, frecuenciaDias, tipoGestion = 'externa') {
    if (frecuenciaDias === null) return 'actualizado'; // Eventual
    if (!proximaActualizacion) return 'sin-fecha';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const proxima = new Date(proximaActualizacion);
    proxima.setHours(0, 0, 0, 0);

    const diffDias = Math.floor((proxima - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      // Dataset vencido: diferenciar según tipo de gestión
      return tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta';
    }
    if (diffDias <= 60) return 'proximo';
    return 'actualizado';
  },

  // Días restantes o de atraso
  getDiasRestantes(proximaActualizacion) {
    if (!proximaActualizacion) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const proxima = new Date(proximaActualizacion);
    proxima.setHours(0, 0, 0, 0);
    return Math.floor((proxima - hoy) / (1000 * 60 * 60 * 24));
  },

  // Texto del estado (versión corta para badges)
  getEstadoTexto(estado) {
    const textos = {
      'actualizado': 'Actualizado',
      'proximo': 'Próximo a vencer',
      'atrasado': 'Atrasado',
      'sin-respuesta': 'Sin respuesta',
      'sin-fecha': 'Sin fecha'
    };
    return textos[estado] || estado;
  },

  // Texto del estado (versión larga para detalle)
  getEstadoTextoLargo(estado) {
    const textos = {
      'actualizado': 'Actualizado',
      'proximo': 'Próximo a vencer',
      'atrasado': 'Atrasado',
      'sin-respuesta': 'Sin respuesta del área responsable',
      'sin-fecha': 'Sin fecha programada'
    };
    return textos[estado] || estado;
  },

  // Clase CSS del estado
  getEstadoClase(estado) {
    const clases = {
      'actualizado': 'badge-success',
      'proximo': 'badge-warning',
      'atrasado': 'badge-danger',
      'sin-respuesta': 'badge-sin-respuesta',
      'sin-fecha': 'badge-secondary'
    };
    return clases[estado] || 'badge-secondary';
  },

  // Texto del tipo de gestión
  getTipoGestionTexto(tipoGestion) {
    const textos = {
      'interna': 'Interna (DGMIT)',
      'externa': 'Externa (otra área)'
    };
    return textos[tipoGestion] || tipoGestion;
  },

  // Usuario sugerido con el patrón del RPAD: iniciales de los nombres + último apellido, en mayúsculas y
  // sin tildes. Si ya existe, le agrega un número (spec 8.4)
  sugerirUsername(nombreCompleto, existentes = []) {
    const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];
    const palabras = String(nombreCompleto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z\s]/g, ' ')
      .split(/\s+/)
      .filter(palabra => palabra && !PARTICULAS.includes(palabra.toLowerCase()));
    if (palabras.length === 0) return '';
    const ultima = palabras[palabras.length - 1];
    const base = (palabras.slice(0, -1).map(palabra => palabra[0]).join('') + ultima).toUpperCase().slice(0, 48);
    const usados = new Set(existentes.map(usuario => String(usuario).toUpperCase()));
    if (!usados.has(base)) return base;
    let numero = 2;
    while (usados.has(`${base}${numero}`)) numero++;
    return `${base}${numero}`;
  },

  // Cargo para mostrar: con contrato, "Cumple funciones de … (sin designación formal)" (spec 12.2)
  textoCargo(cargo, vinculo) {
    if (!cargo) return '';
    return vinculo === 'contrato' ? `Cumple funciones de ${cargo} (sin designación formal)` : cargo;
  },

  textoVinculo(vinculo) {
    return { planta_permanente: 'Planta permanente', planta_politica: 'Planta política', contrato: 'Contrato' }[vinculo] || '';
  },

  // Escapar HTML (también comillas, así sirve dentro de atributos)
  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Texto como argumento de un handler inline: onclick="f(${Utils.jsArg(nombre)})".
  // La función recibe el valor exacto aunque tenga comillas, barras o HTML
  jsArg(valor) {
    return this.escapeHtml(JSON.stringify(String(valor ?? '')));
  },

  // ¿Es una URL http/https? Rechaza javascript:, data:, etc.
  esUrlSegura(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
  },

  // URL lista para un href dentro de HTML, o null si no es http/https
  safeUrl(url) {
    if (!this.esUrlSegura(url)) return null;
    return this.escapeHtml(url.trim());
  },

  // Truncar texto
  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  // Obtener parámetros de URL
  getUrlParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  },

  // Mostrar mensaje de error
  showError(message) {
    const container = document.getElementById('message-container');
    if (container) {
      container.innerHTML = `<div class="alert alert-error">${this.escapeHtml(message)}</div>`;
      setTimeout(() => container.innerHTML = '', 5000);
    } else {
      alert(message);
    }
  },

  // Mostrar mensaje de éxito
  showSuccess(message) {
    const container = document.getElementById('message-container');
    if (container) {
      container.innerHTML = `<div class="alert alert-success">${this.escapeHtml(message)}</div>`;
      setTimeout(() => container.innerHTML = '', 5000);
    }
  }
};
