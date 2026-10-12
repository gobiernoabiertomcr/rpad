// Correos: estado, libro de Notas Digitales, vista previa, configuración y aviso a las áreas
let configActual = null;

const CAMPOS_CONFIG = ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa',
  'cco', 'casillas_prueba', 'firma_nombre', 'firma_cargo'];
const ETIQUETAS = { aviso: 'Aviso', reiteracion: 'Reiteración', interna: 'Interna', externa: 'Externa', enviada: 'Enviada', fallida: 'Fallida', pendiente: 'Pendiente' };
const CLASE_ESTADO = { enviada: 'badge-success', fallida: 'badge-danger', pendiente: 'badge-warning' };

// Los mensajes del servidor se escapan: showToast inserta HTML
const avisar = (mensaje, tipo = 'info') => showToast(Utils.escapeHtml(mensaje), tipo);
// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita corrimientos de zona horaria)
const fecha = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }
  if (!Auth.isAdmin()) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('btn-verificar-smtp').addEventListener('click', verificarConexionSMTP);
  document.getElementById('envio-activo').addEventListener('change', cambiarEnvioAutomatico);
  ['filtro-anio', 'filtro-tipo', 'filtro-gestion', 'filtro-estado', 'filtro-dataset', 'filtro-pruebas']
    .forEach(id => document.getElementById(id).addEventListener('change', cargarLibro));
  document.getElementById('libro-cuerpo').addEventListener('click', accionDelLibro);
  document.getElementById('btn-preview').addEventListener('click', verVistaPrevia);
  document.getElementById('btn-prueba').addEventListener('click', enviarmePrueba);
  document.getElementById('form-config').addEventListener('submit', guardarConfiguracion);
  document.getElementById('firma-archivo').addEventListener('change', subirFirma);
  document.getElementById('btn-preview-area').addEventListener('click', verVistaPreviaArea);
  document.getElementById('btn-prueba-area').addEventListener('click', enviarmePruebaArea);
  document.getElementById('modal-nota-cerrar').addEventListener('click', cerrarModalNota);

  inicializarFiltros();
  cargarEstado();
  cargarConfiguracion();
  cargarLibro();
});

// =====================================================
// ESTADO
// =====================================================
async function verificarConexionSMTP() {
  const estado = document.getElementById('smtp-status');
  estado.className = 'smtp-status checking';
  estado.textContent = 'Verificando…';
  try {
    const res = await API.verificarSmtp();
    estado.className = `smtp-status ${res.success ? 'success' : 'error'}`;
    estado.textContent = res.success ? 'Conexión OK' : `Error: ${res.error || 'sin detalle'}${res.code ? ` (${res.code})` : ''}`;
  } catch (error) {
    estado.className = 'smtp-status error';
    estado.textContent = `Error: ${error.message}`;
  }
}

async function cargarEstado() {
  try {
    const estado = await API.getEstadoNotas();
    document.getElementById('envio-activo').checked = estado.envio_activo;
    const texto = document.getElementById('envio-activo-texto');
    texto.textContent = estado.envio_activo ? 'Activado' : 'Desactivado';
    texto.className = `badge ${estado.envio_activo ? 'badge-success' : 'badge-secondary'}`;

    const alertas = [];
    if (estado.configuracion_faltante.length) {
      alertas.push(`Configuración incompleta: falta ${estado.configuracion_faltante.join(', ')}. Sin esto no se envían notas.`);
    }
    if (estado.fallidas > 0) {
      alertas.push(`Hay ${estado.fallidas} nota(s) que no se pudieron enviar. Revisalas en el libro con el filtro "Fallida".`);
    }
    document.getElementById('nd-alertas').innerHTML = alertas.map(a => `<div class="nd-alerta">${Utils.escapeHtml(a)}</div>`).join('');

    const nombres = { interna: 'Gestión interna', externa: 'Gestión externa' };
    document.getElementById('nd-proximas').innerHTML = Object.entries(estado.proximas).map(([gestion, p]) => `
      <div class="nd-proxima">
        <strong>${nombres[gestion]}</strong><br>
        Próximo aviso: ${p.aviso ? `${fecha(p.aviso.fecha)} (${p.aviso.cantidad} dataset/s)` : 'sin datasets pendientes'}<br>
        Próxima reiteración: ${fecha(p.reiteracion.fecha)} (${p.reiteracion.cantidad} dataset/s)
      </div>`).join('');
  } catch (error) {
    avisar(`No se pudo cargar el estado: ${error.message}`, 'error');
  }
}

async function cambiarEnvioAutomatico(evento) {
  const activar = evento.target.checked;
  if (activar && !confirm('¿Activar el envío automático? Desde la próxima corrida diaria (08:00) se enviarán Notas Digitales reales a los destinatarios configurados.')) {
    evento.target.checked = false;
    return;
  }
  try {
    await API.guardarConfigNotas({ envio_activo: activar });
    avisar(activar ? 'Envío automático activado' : 'Envío automático desactivado', 'success');
  } catch (error) {
    evento.target.checked = !activar;
    avisar(error.message, 'error');
  }
  cargarEstado();
}

// =====================================================
// LIBRO
// =====================================================
function inicializarFiltros() {
  const selectorAnio = document.getElementById('filtro-anio');
  for (let anio = new Date().getFullYear(); anio >= 2026; anio--) {
    selectorAnio.insertAdjacentHTML('beforeend', `<option value="${anio}">${anio}</option>`);
  }
  API.getDatasets()
    .then((datasets) => {
      const opciones = datasets.slice()
        .sort((a, b) => a.titulo.localeCompare(b.titulo))
        .map(d => `<option value="${d.id}">${Utils.escapeHtml(d.titulo)}</option>`)
        .join('');
      document.getElementById('filtro-dataset').insertAdjacentHTML('beforeend', opciones);
    })
    .catch(() => {});
}

const numeroDe = (nota) => (nota.es_prueba ? 'PRUEBA' : `${nota.numero}/${String(nota.anio).slice(-2)}`);

async function cargarLibro() {
  const cuerpo = document.getElementById('libro-cuerpo');
  const filtros = {
    anio: document.getElementById('filtro-anio').value,
    tipo: document.getElementById('filtro-tipo').value,
    gestion: document.getElementById('filtro-gestion').value,
    estado: document.getElementById('filtro-estado').value,
    dataset_id: document.getElementById('filtro-dataset').value,
    incluir_pruebas: document.getElementById('filtro-pruebas').checked ? '1' : ''
  };
  try {
    const notas = await API.getLibroNotas(filtros);
    if (!notas.length) {
      cuerpo.innerHTML = '<tr><td colspan="8">No hay notas con estos filtros.</td></tr>';
      return;
    }
    cuerpo.innerHTML = notas.map((n) => {
      const archivo = n.es_prueba ? `Nota-Digital-PRUEBA-${n.id}.pdf` : `Nota-Digital-${n.numero}-${String(n.anio).slice(-2)}.pdf`;
      const detalleEstado = n.ultimo_error || n.respuesta_smtp || '';
      return `
      <tr>
        <td>${numeroDe(n)}</td>
        <td>${fecha(n.fecha)}</td>
        <td>${ETIQUETAS[n.tipo]}</td>
        <td>${ETIQUETAS[n.gestion]}</td>
        <td>${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}</td>
        <td>${Utils.escapeHtml(n.para)}${n.cc ? `<br><small>CC: ${Utils.escapeHtml(n.cc)}</small>` : ''}</td>
        <td>
          <span class="badge ${CLASE_ESTADO[n.estado]}" title="${Utils.escapeHtml(detalleEstado)}">${ETIQUETAS[n.estado]}</span>
          ${n.enviada_at ? `<br><small>${Utils.escapeHtml(n.enviada_at)}</small>` : ''}
        </td>
        <td class="nd-acciones">
          <button type="button" class="btn btn-secondary btn-sm" data-accion="ver" data-id="${n.id}">Ver</button>
          <button type="button" class="btn btn-secondary btn-sm" data-accion="pdf" data-id="${n.id}" data-archivo="${Utils.escapeHtml(archivo)}">PDF</button>
          ${n.estado !== 'enviada' ? `<button type="button" class="btn btn-outline btn-sm" data-accion="reintentar" data-id="${n.id}">Reintentar</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    cuerpo.innerHTML = `<tr><td colspan="8">${Utils.escapeHtml(error.message)}</td></tr>`;
  }
}

async function accionDelLibro(evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);
  try {
    if (boton.dataset.accion === 'ver') {
      const nota = await API.getNota(id);
      document.getElementById('modal-nota-titulo').textContent = nota.asunto;
      document.getElementById('modal-nota-datos').textContent = [
        `Para: ${nota.para}`,
        nota.cc ? `CC: ${nota.cc}` : '',
        nota.cco ? `CCO: ${nota.cco}` : '',
        nota.respuesta_smtp ? `Servidor: ${nota.respuesta_smtp}` : ''
      ].filter(Boolean).join(' · ');
      document.getElementById('modal-nota-marco').srcdoc = nota.html;
      document.getElementById('modal-nota').classList.add('active');
    } else if (boton.dataset.accion === 'pdf') {
      const url = URL.createObjectURL(await API.getNotaPdf(id));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = boton.dataset.archivo;
      enlace.click();
      URL.revokeObjectURL(url);
    } else if (boton.dataset.accion === 'reintentar') {
      boton.disabled = true;
      const resultado = await API.reintentarNota(id);
      avisar(resultado.message, 'success');
    }
  } catch (error) {
    avisar(error.message, 'error');
  } finally {
    if (boton.dataset.accion === 'reintentar') {
      cargarLibro();
      cargarEstado();
    }
  }
}

function cerrarModalNota() {
  document.getElementById('modal-nota').classList.remove('active');
  document.getElementById('modal-nota-marco').srcdoc = '';
}

// =====================================================
// VISTA PREVIA Y PRUEBA
// =====================================================
const tipoYGestion = () => ({
  tipo: document.getElementById('preview-tipo').value,
  gestion: document.getElementById('preview-gestion').value
});

async function verVistaPrevia() {
  const { tipo, gestion } = tipoYGestion();
  try {
    const vista = await API.previewNota(tipo, gestion);
    const aviso = document.getElementById('preview-aviso');
    aviso.hidden = false;
    aviso.textContent = vista.ejemplo
      ? 'Hoy no saldría ninguna nota de este tipo: se muestran datos de ejemplo.'
      : `Con los datos de hoy esta nota incluiría ${vista.cantidad} dataset(s). Asunto: ${vista.asunto}`;
    const marco = document.getElementById('preview-marco');
    marco.srcdoc = vista.html;
    marco.hidden = false;
  } catch (error) {
    avisar(error.message, 'error');
  }
}

async function enviarmePrueba() {
  const { tipo, gestion } = tipoYGestion();
  if (!confirm('Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas. ¿Continuar?')) return;
  try {
    const resultado = await API.enviarPruebaNota(tipo, gestion);
    avisar(resultado.message, 'success');
    cargarLibro();
  } catch (error) {
    avisar(error.message, 'error');
  }
}

// =====================================================
// CONFIGURACIÓN
// =====================================================
async function cargarConfiguracion() {
  try {
    configActual = await API.getConfigNotas();
    CAMPOS_CONFIG.forEach((campo) => {
      document.getElementById(campo).value = configActual[campo] ?? '';
    });
    mostrarFirma();
  } catch (error) {
    avisar(`No se pudo cargar la configuración: ${error.message}`, 'error');
  }
}

async function mostrarFirma() {
  const imagen = document.getElementById('firma-vista');
  if (!configActual?.tiene_firma) {
    imagen.hidden = true;
    return;
  }
  try {
    imagen.src = URL.createObjectURL(await API.getFirmaNotas());
    imagen.hidden = false;
  } catch {
    imagen.hidden = true;
  }
}

async function guardarConfiguracion(evento) {
  evento.preventDefault();
  const datos = Object.fromEntries(CAMPOS_CONFIG.map(campo => [campo, document.getElementById(campo).value]));
  try {
    await API.guardarConfigNotas(datos);
    avisar('Configuración guardada', 'success');
    await cargarConfiguracion();
    cargarEstado();
  } catch (error) {
    avisar(error.message, 'error');
  }
}

function subirFirma(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
    avisar('La firma debe ser una imagen PNG o JPEG', 'error');
    evento.target.value = '';
    return;
  }
  if (archivo.size > 500 * 1024) {
    avisar('La imagen debe pesar como máximo 500 KB', 'error');
    evento.target.value = '';
    return;
  }
  const lector = new FileReader();
  lector.onload = async () => {
    try {
      await API.subirFirmaNotas(lector.result, archivo.type);
      avisar('Firma guardada', 'success');
      await cargarConfiguracion();
      cargarEstado();
    } catch (error) {
      avisar(error.message, 'error');
    }
    evento.target.value = '';
  };
  lector.readAsDataURL(archivo);
}

// =====================================================
// AVISO A LAS ÁREAS
// =====================================================
async function verVistaPreviaArea() {
  try {
    const marco = document.getElementById('preview-area-marco');
    marco.srcdoc = await API.previewNotificacion('area-aviso-40');
    marco.hidden = false;
  } catch (error) {
    avisar(error.message, 'error');
  }
}

async function enviarmePruebaArea() {
  if (!confirm('Se enviará el aviso a áreas marcado como PRUEBA solo a las casillas de prueba. ¿Continuar?')) return;
  try {
    const resultado = await API.enviarPruebaAvisoArea();
    avisar(resultado.message, 'success');
  } catch (error) {
    avisar(error.message, 'error');
  }
}
