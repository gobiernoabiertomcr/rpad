// Correos: estado, libro de Notas Digitales, vista previa, configuración y aviso a las áreas
let configActual = null;

const CAMPOS_CONFIG = ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa',
  'para_auditoria', 'cc_auditoria', 'cco', 'casillas_prueba', 'firma_nombre', 'firma_cargo', 'membrete_pie'];
// Imágenes de la configuración: la firma y el banner del membrete se suben y se muestran igual.
// url: el blob URL de la vista previa que se está mostrando (se libera al reemplazarla u ocultarla).
const IMAGENES_CONFIG = {
  firma: {
    archivo: 'firma-archivo', vista: 'firma-vista', tiene: 'tiene_firma', nombre: 'La firma', guardada: 'Firma guardada',
    subir: (imagen, mime) => API.subirFirmaNotas(imagen, mime), obtener: () => API.getFirmaNotas(), url: null
  },
  membrete: {
    archivo: 'membrete-archivo', vista: 'membrete-vista', tiene: 'tiene_membrete', nombre: 'El banner del membrete',
    guardada: 'Membrete guardado', subir: (imagen, mime) => API.subirMembreteNotas(imagen, mime),
    obtener: () => API.getMembreteNotas(), url: null
  }
};
const ETIQUETAS = { aviso: 'Aviso', reiteracion: 'Reiteración', autorizacion: 'Autorización', auditoria: 'Auditoría', interna: 'Interna', externa: 'Externa', enviada: 'Enviada', fallida: 'Fallida', pendiente: 'Pendiente' };
// La nota de autorización no tiene gestión
const textoGestion = (gestion) => (gestion ? ETIQUETAS[gestion] : '—');
// Columna "Datasets" del libro: la nota de autorización no tiene; la de auditoría cuenta cambios (spec 2026-10-15, 10.4)
const celdaCantidad = (n) => {
  if (n.es_prueba || n.tipo === 'autorizacion') return '—';
  if (n.tipo === 'auditoria') return `${n.cantidad_cambios} cambio(s)`;
  return `${n.cantidad_datasets}${n.seccion_dataset ? ` (${n.seccion_dataset === 'vencido' ? 'vencido' : 'próximo'})` : ''}`;
};
const TIPO_DE_CAMBIO = { crear: 'Alta', editar: 'Modificación', eliminar: 'Baja' };
// Un cambio incluido en una nota de auditoría, para el detalle de la nota
const textoCambioDeNota = (c) => `${TIPO_DE_CAMBIO[c.tipo_cambio] ?? c.tipo_cambio}: ${c.titulo ?? 'Sin título'} `
  + `(${c.seccion === 'nuevo' ? 'nuevo' : 'reiterado'}${c.estado === 'pendiente' ? '' : `, ${c.estado}`})`;
// La nota de auditoría en el Estado (spec 10.4)
const textoAuditoria = (a) => (!a || a.canal_nota === 0
  ? 'Auditoría de cambios: no hay cambios para pedir por nota.'
  : `Auditoría de cambios: ${a.canal_nota} cambio(s) para pedir por nota; próxima nota de auditoría: ${fecha(a.proxima)}.`);
// Días sin auditor en el Estado (spec 9.5): cambios que hoy no tienen a nadie que pueda auditarlos, o '' si no hay
const textoSinQuienAudite = (a) => {
  const n = a?.sin_quien_audite ?? 0;
  if (!(n > 0)) return '';
  return n === 1 ? 'Hoy 1 cambio no tiene a nadie que pueda auditarlo.' : `Hoy ${n} cambios no tienen a nadie que pueda auditarlos.`;
};
// Próximos períodos sin ningún auditor disponible (a.periodos_sin_auditor: [{ desde, hasta, vuelve }]), o '' si no hay
const textoPeriodosSinAuditor = (a) => {
  const periodos = a?.periodos_sin_auditor ?? [];
  if (!periodos.length) return '';
  const detalle = periodos.map(p => `del ${fecha(p.desde)} al ${fecha(p.hasta)} (${p.vuelve ? `vuelve a haber auditor el ${fecha(p.vuelve)}` : 'sin fecha de vuelta'})`);
  return `Próximos días sin auditores disponibles: ${detalle.join('; ')}.`;
};
// Nombre del PDF de la vista previa: la nota de auditoría no tiene gestión
const nombreVistaPrevia = (tipo, gestion) => `Nota-Digital-vista-previa-${tipo}${tipo === 'auditoria' ? '' : `-${gestion}`}.pdf`;
// Máximo de notas que devuelve la API del libro (las más recientes)
const LIMITE_LIBRO = 500;
const CLASE_ESTADO = { enviada: 'badge-success', fallida: 'badge-danger', pendiente: 'badge-warning' };

// Los mensajes del servidor se escapan: showToast inserta HTML
const avisar = (mensaje, tipo = 'info') => showToast(Utils.escapeHtml(mensaje), tipo);
// Deshabilita el botón mientras dura el pedido: evita vistas previas y pruebas duplicadas por clics repetidos
const conBotonBloqueado = async (boton, tarea) => {
  boton.disabled = true;
  try {
    await tarea();
  } finally {
    boton.disabled = false;
  }
};
// Descarga un Blob con ese nombre de archivo y libera su URL
const descargarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// 'AAAA-MM-DD' → 'dd/mm/aaaa' sin pasar por Date (evita corrimientos de zona horaria)
const fecha = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
// 'AAAA-MM-DD HH:MM' → 'dd/mm/aaaa HH:MM'
const fechaHora = (texto) => `${fecha(texto)} ${texto.slice(11, 16)}`;

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
  ['preview-tipo', 'preview-gestion'].forEach(id => document.getElementById(id).addEventListener('change', ocultarVistaPrevia));
  document.getElementById('btn-preview').addEventListener('click', verVistaPrevia);
  document.getElementById('btn-preview-pdf').addEventListener('click', verPdfDeVistaPrevia);
  document.getElementById('btn-preview-anexo').addEventListener('click', verAnexoDeVistaPrevia);
  document.getElementById('preview-tipo').addEventListener('change', actualizarBotonAnexo);
  document.getElementById('preview-tipo').addEventListener('change', actualizarSelectorGestion);
  document.getElementById('btn-prueba').addEventListener('click', enviarmePrueba);
  document.getElementById('form-config').addEventListener('submit', guardarConfiguracion);
  document.getElementById('firmante').addEventListener('change', elegirFirmante);
  Object.entries(IMAGENES_CONFIG).forEach(([clave, imagen]) => {
    document.getElementById(imagen.archivo).addEventListener('change', evento => subirImagen(clave, evento));
  });
  document.getElementById('btn-preview-area').addEventListener('click', verVistaPreviaArea);
  document.getElementById('btn-prueba-area').addEventListener('click', enviarmePruebaArea);
  document.getElementById('modal-nota-cerrar').addEventListener('click', cerrarModalNota);

  actualizarBotonAnexo();
  actualizarSelectorGestion();
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
      alertas.push({ nivel: 'error', mensaje: `Configuración incompleta: falta ${estado.configuracion_faltante.join(', ')}. Sin esto no se envían notas.` });
    }
    if (estado.fallidas > 0) {
      alertas.push({ nivel: 'error', mensaje: `Hay ${estado.fallidas} nota(s) que no se pudieron enviar. Revisalas en el libro con el filtro "Fallida".` });
    }
    // Las del servidor: corrida con errores o interrumpida, cron que no llama
    alertas.push(...(estado.alertas ?? []));
    document.getElementById('nd-alertas').innerHTML = alertas
      .map(a => `<div class="nd-alerta${a.nivel === 'advertencia' ? ' nd-advertencia' : ''}">${Utils.escapeHtml(a.mensaje)}</div>`)
      .join('');
    document.getElementById('nd-ultima-corrida').textContent = textoUltimaCorrida(estado.ultima_corrida);
    const licencia = document.getElementById('nd-licencia');
    licencia.textContent = textoLicenciaFirmante(estado.licencia_firmante);
    licencia.hidden = !estado.licencia_firmante;
    document.getElementById('nd-auditoria').textContent = textoAuditoria(estado.auditoria);
    for (const [id, texto] of [['nd-sin-quien-audite', textoSinQuienAudite(estado.auditoria)], ['nd-periodos-sin-auditor', textoPeriodosSinAuditor(estado.auditoria)]]) {
      const linea = document.getElementById(id);
      linea.textContent = texto;
      linea.hidden = !texto;
    }

    const nombres = { interna: 'Gestión interna', externa: 'Gestión externa' };
    document.getElementById('nd-proximas').innerHTML = Object.entries(estado.proximas).map(([gestion, p]) => `
      <div class="nd-proxima">
        <strong>${nombres[gestion]}</strong><br>
        Próximo aviso: ${p.aviso ? `${fecha(p.aviso.fecha)} (${p.aviso.cantidad} dataset/s)` : 'sin datasets pendientes'}<br>
        Próxima reiteración: ${p.reiteracion.cantidad > 0 ? `${fecha(p.reiteracion.fecha)} (${p.reiteracion.cantidad} dataset/s)` : 'sin datasets pendientes'}
      </div>`).join('');
  } catch (error) {
    avisar(`No se pudo cargar el estado: ${error.message}`, 'error');
  }
}

function textoUltimaCorrida(corrida) {
  if (!corrida) return 'Última corrida diaria: sin registro todavía.';
  if (corrida.en_curso) return `Corrida diaria en curso (empezó el ${fechaHora(corrida.inicio)}).`;
  if (!corrida.fin) return `Última corrida diaria: empezó el ${fechaHora(corrida.inicio)} y no terminó.`;
  return `Última corrida diaria: ${fechaHora(corrida.inicio)} – ${corrida.resultado}`;
}

async function cambiarEnvioAutomatico(evento) {
  const activar = evento.target.checked;
  if (activar && !confirm('¿Activar el envío automático? Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.')) {
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
  const limite = document.getElementById('libro-limite');
  limite.hidden = true;
  try {
    const notas = await API.getLibroNotas(filtros);
    if (!notas.length) {
      cuerpo.innerHTML = '<tr><td colspan="8">No hay notas con estos filtros.</td></tr>';
      return;
    }
    // La API corta en las 500 más recientes: se avisa que puede haber más
    limite.hidden = notas.length < LIMITE_LIBRO;
    cuerpo.innerHTML = notas.map((n) => {
      const archivo = n.es_prueba ? `Nota-Digital-PRUEBA-${n.id}.pdf` : `Nota-Digital-${n.numero}-${String(n.anio).slice(-2)}.pdf`;
      const archivoAnexo = `Anexo-${archivo}`;
      const detalleEstado = n.ultimo_error || n.respuesta_smtp || '';
      return `
      <tr>
        <td>${numeroDe(n)}</td>
        <td>${fecha(n.fecha)}</td>
        <td>${ETIQUETAS[n.tipo]}</td>
        <td>${textoGestion(n.gestion)}</td>
        <td>${celdaCantidad(n)}</td>
        <td>${Utils.escapeHtml(n.para)}${n.cc ? `<br><small>CC: ${Utils.escapeHtml(n.cc)}</small>` : ''}</td>
        <td>
          <span class="badge ${CLASE_ESTADO[n.estado]}" title="${Utils.escapeHtml(detalleEstado)}">${ETIQUETAS[n.estado]}</span>
          ${n.enviada_at ? `<br><small>${Utils.escapeHtml(n.enviada_at)}</small>` : ''}
        </td>
        <td>
          <div class="nd-acciones">
            <button type="button" class="btn btn-secondary btn-sm" data-accion="ver" data-id="${n.id}">Ver</button>
            <button type="button" class="btn btn-secondary btn-sm" data-accion="pdf" data-id="${n.id}" data-archivo="${Utils.escapeHtml(archivo)}">PDF</button>
            ${n.tiene_anexo ? `<button type="button" class="btn btn-secondary btn-sm" data-accion="anexo" data-id="${n.id}" data-archivo="${Utils.escapeHtml(archivoAnexo)}">Anexo</button>` : ''}
            ${n.estado !== 'enviada' ? `<button type="button" class="btn btn-outline btn-sm" data-accion="reintentar" data-id="${n.id}">Reintentar</button>` : ''}
          </div>
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
        `Estado: ${ETIQUETAS[nota.estado]} (${nota.intentos} intento/s)`,
        nota.respuesta_smtp ? `Servidor: ${nota.respuesta_smtp}` : ''
      ].filter(Boolean).join(' · ');
      // El error del último envío, visible también en pantallas táctiles (en el libro solo está en el tooltip)
      const errorNota = document.getElementById('modal-nota-error');
      errorNota.textContent = nota.ultimo_error ? `Último error: ${nota.ultimo_error}` : '';
      errorNota.hidden = !nota.ultimo_error;
      // Nota de auditoría: los cambios que incluye (spec 2026-10-15, 10.4)
      const cambios = document.getElementById('modal-nota-cambios');
      cambios.innerHTML = (nota.cambios ?? []).map(c => `<li>${Utils.escapeHtml(textoCambioDeNota(c))}</li>`).join('');
      cambios.hidden = !nota.cambios?.length;
      document.getElementById('modal-nota-marco').srcdoc = nota.html;
      document.getElementById('modal-nota').classList.add('active');
    } else if (boton.dataset.accion === 'pdf') {
      descargarBlob(await API.getNotaPdf(id), boton.dataset.archivo);
    } else if (boton.dataset.accion === 'anexo') {
      descargarBlob(await API.getNotaAnexo(id), boton.dataset.archivo);
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

// Al cambiar el tipo o la gestión, la vista previa anterior ya no corresponde: se oculta hasta pedir otra
function ocultarVistaPrevia() {
  document.getElementById('preview-aviso').hidden = true;
  document.getElementById('preview-marco').hidden = true;
}

function verVistaPrevia() {
  return conBotonBloqueado(document.getElementById('btn-preview'), async () => {
    const { tipo, gestion } = tipoYGestion();
    try {
      const vista = await API.previewNota(tipo, gestion);
      // Si mientras tanto cambió la selección, la respuesta ya no corresponde
      const actual = tipoYGestion();
      if (actual.tipo !== tipo || actual.gestion !== gestion) return;
      const aviso = document.getElementById('preview-aviso');
      aviso.hidden = false;
      aviso.textContent = vista.ejemplo
        ? 'Hoy no saldría ninguna nota de este tipo: se muestran datos de ejemplo.'
        : `Con los datos de hoy esta nota incluiría ${vista.cantidad} ${tipo === 'auditoria' ? 'cambio(s)' : 'dataset(s)'}. Asunto: ${vista.asunto}`;
      const marco = document.getElementById('preview-marco');
      marco.srcdoc = vista.html;
      marco.hidden = false;
    } catch (error) {
      avisar(error.message, 'error');
    }
  });
}

// El PDF de la vista previa, con el membrete y la firma cargados, para el tipo y la gestión elegidos
function verPdfDeVistaPrevia() {
  return conBotonBloqueado(document.getElementById('btn-preview-pdf'), async () => {
    const { tipo, gestion } = tipoYGestion();
    try {
      descargarBlob(await API.previewNotaPdf(tipo, gestion), nombreVistaPrevia(tipo, gestion));
    } catch (error) {
      avisar(error.message, 'error');
    }
  });
}

// Si hay un pedido del anexo en curso: mientras tanto el botón sigue deshabilitado aunque cambie el tipo
let anexoEnCurso = false;

// El anexo solo existe en los avisos: con una reiteración (o con un pedido en curso) el botón queda deshabilitado
function actualizarBotonAnexo() {
  const esAviso = document.getElementById('preview-tipo').value === 'aviso';
  const boton = document.getElementById('btn-preview-anexo');
  boton.disabled = !esAviso || anexoEnCurso;
  boton.title = esAviso ? '' : 'Solo los avisos llevan anexo';
}

// La nota de auditoría no tiene gestión: el selector de gestión se deshabilita mientras está elegida
function actualizarSelectorGestion() {
  document.getElementById('preview-gestion').disabled = document.getElementById('preview-tipo').value === 'auditoria';
}

// El anexo del aviso de la vista previa (N° XX) para la gestión elegida
async function verAnexoDeVistaPrevia() {
  if (anexoEnCurso) return;
  anexoEnCurso = true;
  try {
    await conBotonBloqueado(document.getElementById('btn-preview-anexo'), async () => {
      const { gestion } = tipoYGestion();
      try {
        descargarBlob(await API.previewNotaAnexo(gestion), `Anexo-vista-previa-${gestion}.pdf`);
      } catch (error) {
        avisar(error.message, 'error');
      }
    });
  } finally {
    anexoEnCurso = false;
    // conBotonBloqueado lo habilita al terminar: si mientras tanto se eligió una reiteración, vuelve a quedar deshabilitado
    actualizarBotonAnexo();
  }
}

async function enviarmePrueba() {
  const { tipo, gestion } = tipoYGestion();
  if (!confirm('Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas. ¿Continuar?')) return;
  await conBotonBloqueado(document.getElementById('btn-prueba'), async () => {
    try {
      const resultado = await API.enviarPruebaNota(tipo, gestion);
      avisar(resultado.message, 'success');
      cargarLibro();
    } catch (error) {
      avisar(error.message, 'error');
    }
  });
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
    Object.keys(IMAGENES_CONFIG).forEach(mostrarImagen);
    aplicarFirmante();
    cargarFirmantes();
  } catch (error) {
    avisar(`No se pudo cargar la configuración: ${error.message}`, 'error');
  }
}

// Con firmante titular elegido, la firma de las notas es la de su Mi Perfil: los campos de firma de esta pantalla muestran
// sus datos y no se editan (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.2)
function aplicarFirmante() {
  const firmante = configActual?.firmante ?? null;
  for (const id of ['firma_nombre', 'firma_cargo', 'firma-archivo']) document.getElementById(id).disabled = Boolean(firmante);
  if (firmante) {
    document.getElementById('firma_nombre').value = firmante.nombre ?? '';
    document.getElementById('firma_cargo').value = firmante.cargo ?? '';
  }
  document.getElementById('firma-ayuda').textContent = firmante
    ? `Firma ${firmante.nombre_completo}: el nombre, el cargo y la imagen se cambian en su Mi Perfil.`
    : '';
}

async function cargarFirmantes() {
  const selector = document.getElementById('firmante');
  try {
    const candidatos = await API.getFirmantesNotas();
    selector.innerHTML = ['<option value="">Nadie: la firma cargada en esta pantalla</option>',
      ...candidatos.map(c => `<option value="${c.id}">${Utils.escapeHtml(`${c.nombre_completo} (${c.nombre}, ${c.cargo})`)}</option>`)].join('');
    selector.value = configActual?.firmante_usuario_id ? String(configActual.firmante_usuario_id) : '';
    selector.disabled = !Auth.isSuperadmin();
    document.getElementById('firmante-ayuda').textContent = Auth.isSuperadmin()
      ? 'Aparecen el superadmin y los admins activos con su firma cargada en Mi Perfil.'
      : 'Lo elige el superadmin.';
  } catch (error) {
    avisar(`No se pudieron cargar los firmantes: ${error.message}`, 'error');
  }
}

async function elegirFirmante(evento) {
  const valor = evento.target.value;
  try {
    const res = await API.elegirFirmanteNotas(valor ? Number(valor) : null);
    avisar(res.message, 'success');
    cargarEstado();
  } catch (error) {
    avisar(error.message, 'error');
  }
  await cargarConfiguracion();
}

// Licencia del firmante para el Estado (spec 7.5)
function textoLicenciaFirmante(l) {
  if (!l) return '';
  const periodo = `del ${fecha(l.desde)} al ${fecha(l.hasta)}`;
  if (l.sin_dias_habiles) return `Licencia del firmante ${periodo}: no tiene días hábiles, las notas no cambian.`;
  if (l.autorizado) {
    const nota = l.nota_autorizacion ? ` (autorización comunicada en la Nota Digital N° ${l.nota_autorizacion.numero}/${String(l.nota_autorizacion.anio).slice(-2)})` : '';
    return l.en_curso
      ? `Licencia del firmante ${periodo}: ${l.autorizado} presenta las notas por autorización, con las dos firmas${nota}.`
      : `Licencia del firmante ${periodo}: los avisos se anticipan el ${fecha(l.vispera)} con la autorización a ${l.autorizado}, que presenta las demás notas durante la licencia.`;
  }
  const avisos = l.en_curso ? 'no se generan notas hasta la vuelta' : `los avisos se anticipan el ${fecha(l.vispera)}`;
  return `Licencia del firmante ${periodo}, sin autorizado: ${avisos} y las reiteraciones se postergan al ${fecha(l.vuelta)}.`;
}

// Libera el blob URL de la imagen mostrada antes de reemplazarla u ocultarla
function liberarUrlImagen(clave) {
  const imagen = IMAGENES_CONFIG[clave];
  if (imagen.url) URL.revokeObjectURL(imagen.url);
  imagen.url = null;
}

// Vista previa de la firma o del banner del membrete: oculta (de verdad, con hidden) si no hay imagen cargada
async function mostrarImagen(clave) {
  const { vista, tiene, obtener } = IMAGENES_CONFIG[clave];
  const elemento = document.getElementById(vista);
  if (!configActual?.[tiene]) {
    elemento.hidden = true;
    liberarUrlImagen(clave);
    return;
  }
  try {
    const blob = await obtener();
    liberarUrlImagen(clave);
    IMAGENES_CONFIG[clave].url = URL.createObjectURL(blob);
    elemento.src = IMAGENES_CONFIG[clave].url;
    elemento.hidden = false;
  } catch {
    elemento.hidden = true;
    liberarUrlImagen(clave);
  }
}

// Los campos del formulario que se guardan: los de la firma deshabilitados (con firmante titular) no se envían
function datosDelFormulario() {
  return Object.fromEntries(CAMPOS_CONFIG
    .filter(campo => !document.getElementById(campo).disabled)
    .map(campo => [campo, document.getElementById(campo).value]));
}

async function guardarConfiguracion(evento) {
  evento.preventDefault();
  const datos = datosDelFormulario();
  try {
    await API.guardarConfigNotas(datos);
    avisar('Configuración guardada', 'success');
    await cargarConfiguracion();
    cargarEstado();
  } catch (error) {
    avisar(error.message, 'error');
  }
}

// Sube la firma o el banner del membrete apenas se elige el archivo
function subirImagen(clave, evento) {
  const { nombre, guardada, tiene, subir } = IMAGENES_CONFIG[clave];
  const archivo = evento.target.files[0];
  if (!archivo) return;
  if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
    avisar(`${nombre} debe ser una imagen PNG o JPEG`, 'error');
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
      await subir(lector.result, archivo.type);
      avisar(guardada, 'success');
      // No se recarga el formulario: pisaría lo que se escribió y todavía no se guardó
      configActual = { ...configActual, [tiene]: true };
      mostrarImagen(clave);
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
  await conBotonBloqueado(document.getElementById('btn-prueba-area'), async () => {
    try {
      const resultado = await API.enviarPruebaAvisoArea();
      avisar(resultado.message, 'success');
    } catch (error) {
      avisar(error.message, 'error');
    }
  });
}
