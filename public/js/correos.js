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
// Un registro de actualización (POST /datasets/:id/actualizar) es una edición con la marca registro_actualizacion, que el
// detalle de la nota trae en cada cambio: es una "Actualización", como en la nota y en Mi Perfil (spec
// 2026-10-17-fechas-datasets, 9)
const tipoDeCambioDeNota = (c) => (c.tipo_cambio === 'editar' && c.registro_actualizacion === true
  ? 'Actualización'
  : TIPO_DE_CAMBIO[c.tipo_cambio] ?? c.tipo_cambio);
// Un cambio incluido en una nota de auditoría, para el detalle de la nota
const textoCambioDeNota = (c) => `${tipoDeCambioDeNota(c)}: ${c.titulo ?? 'Sin título'} `
  + `(${c.seccion === 'nuevo' ? 'nuevo' : 'reiterado'}${c.estado === 'pendiente' ? '' : `, ${c.estado}`})`;
// La nota de auditoría en el Estado (spec 10.4)
const textoAuditoria = (a) => (!a || a.canal_nota === 0
  ? 'Auditoría de cambios: no hay cambios para pedir por nota.'
  : `Auditoría de cambios: ${a.canal_nota} cambio(s) para pedir por nota; próxima nota de auditoría: ${fecha(a.proxima)}.`);
// Días sin auditor en el Estado (spec 9.5): cambios que hoy no tienen a nadie que pueda auditarlos, o '' si no hay
const textoSinQuienAudite = (a) => {
  const n = a?.sin_quien_audite ?? 0;
  if (!(n > 0)) return '';
  return n === 1 ? 'Hoy 1 cambio no tiene ningún auditor ni editor de respaldo disponible.' : `Hoy ${n} cambios no tienen ningún auditor ni editor de respaldo disponible.`;
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
// Los tipos de nota que llevan anexo (el de la reiteración, desde spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5) y el nombre
// del archivo de su vista previa: el del aviso, como siempre; el de la reiteración, con el tipo
const TIPOS_CON_ANEXO = ['aviso', 'reiteracion'];
const nombreAnexoVistaPrevia = (tipo, gestion) => `Anexo-vista-previa-${tipo === 'aviso' ? '' : `${tipo}-`}${gestion}.pdf`;
// Máximo de notas que devuelve la API del libro (las más recientes)
const LIMITE_LIBRO = 500;

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

  // La barra y la pestaña inicial se ven enseguida; el hash de la dirección (el botón atrás, un enlace a #estado) cambia de pestaña
  conectarPestanas();
  mostrarPestana(pestanaInicial(location.hash));
  window.addEventListener('hashchange', () => mostrarPestana(pestanaInicial(location.hash)));

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
  document.getElementById('modal-nota').addEventListener('mousedown', presionEnVelo);
  document.getElementById('modal-nota').addEventListener('click', clicAfueraDeLaNota);
  document.getElementById('modal-confirmar-aceptar').addEventListener('click', () => cerrarConfirmacion(true));
  document.getElementById('modal-confirmar-cancelar').addEventListener('click', () => cerrarConfirmacion(false));
  document.getElementById('modal-confirmar').addEventListener('mousedown', presionEnVelo);
  document.getElementById('modal-confirmar').addEventListener('click', clicAfueraDeLaConfirmacion);
  document.addEventListener('keydown', teclaEnPagina);

  actualizarBotonAnexo();
  actualizarSelectorGestion();
  inicializarFiltros();
  cargarEstado();
  cargarConfiguracion();
  cargarLibro();
});

// =====================================================
// PESTAÑAS (spec 2026-10-17-correos-pestanas, 4)
// =====================================================
const PESTANAS_DE_CORREOS = ['libro', 'estado', 'pruebas', 'configuracion'];

// La pestaña con la que abre Correos: la del hash si existe (con o sin el #), y si no, el Libro de Notas Digitales
function pestanaInicial(hash) {
  const pedida = String(hash ?? '').replace(/^#/, '');
  return PESTANAS_DE_CORREOS.includes(pedida) ? pedida : 'libro';
}

// Muestra una pestaña y su panel, oculta las demás y deja el nombre en el hash (sin sumar una entrada al historial)
function mostrarPestana(nombre) {
  for (const otra of PESTANAS_DE_CORREOS) {
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
  const actual = PESTANAS_DE_CORREOS.indexOf(evento.target.dataset?.vista);
  if (actual === -1) return;
  const ultima = PESTANAS_DE_CORREOS.length - 1;
  let destino;
  if (evento.key === 'ArrowRight') destino = actual === ultima ? 0 : actual + 1;
  else if (evento.key === 'ArrowLeft') destino = actual === 0 ? ultima : actual - 1;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = ultima;
  else return;
  evento.preventDefault();
  mostrarPestana(PESTANAS_DE_CORREOS[destino]);
  document.getElementById(`pestana-${PESTANAS_DE_CORREOS[destino]}`).focus();
}

// El clic en cada pestaña y el teclado en la barra
function conectarPestanas() {
  for (const nombre of PESTANAS_DE_CORREOS) {
    document.getElementById(`pestana-${nombre}`).addEventListener('click', () => mostrarPestana(nombre));
  }
  document.getElementById('pestanas-correos').addEventListener('keydown', teclaEnPestanas);
}

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

// El punto de la pestaña Estado: 'error' si alguna alerta no es una advertencia; si no, 'advertencia' si hay alguna advertencia o
// cambios que hoy no tienen a nadie que los audite (#nd-sin-quien-audite); si no, '' (sin punto)
function marcaDelEstado(alertas, auditoria) {
  if (alertas.some(a => a.nivel !== 'advertencia')) return 'error';
  if (alertas.some(a => a.nivel === 'advertencia') || textoSinQuienAudite(auditoria) !== '') return 'advertencia';
  return '';
}

// El HTML de las alertas que está pintado en #nd-alertas, o null si todavía no se pintó ninguna
let alertasPintadas = null;

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
    // #nd-alertas es una región en vivo (aria-live): si se reescribe con lo mismo, el lector de pantalla repite todas las alertas.
    // Solo se escribe si cambió; se compara con lo último que se pintó y no con el innerHTML del elemento, porque el navegador lo
    // devuelve normalizado (las comillas de &quot; y &#39; vuelven a ser " y ') y nunca daría igual.
    const htmlDeAlertas = alertas
      .map(a => `<div class="nd-alerta${a.nivel === 'advertencia' ? ' nd-advertencia' : ''}">${Utils.escapeHtml(a.mensaje)}</div>`)
      .join('');
    if (htmlDeAlertas !== alertasPintadas) {
      document.getElementById('nd-alertas').innerHTML = htmlDeAlertas;
      alertasPintadas = htmlDeAlertas;
    }
    document.getElementById('nd-ultima-corrida').textContent = textoUltimaCorrida(estado.ultima_corrida);
    // Los recordatorios de la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 5): la línea la arma el servidor; sin
    // estado.eventos (no la pudo leer, o una respuesta de antes) queda oculta. Sus alertas ya vienen en estado.alertas
    const eventos = document.getElementById('nd-eventos');
    eventos.textContent = typeof estado.eventos?.texto === 'string' ? estado.eventos.texto : '';
    eventos.hidden = eventos.textContent === '';
    const licencia = document.getElementById('nd-licencia');
    licencia.textContent = textoLicenciaFirmante(estado.licencia_firmante);
    licencia.hidden = !estado.licencia_firmante;
    document.getElementById('nd-auditoria').textContent = textoAuditoria(estado.auditoria);
    for (const [id, texto] of [['nd-sin-quien-audite', textoSinQuienAudite(estado.auditoria)], ['nd-periodos-sin-auditor', textoPeriodosSinAuditor(estado.auditoria)]]) {
      const linea = document.getElementById(id);
      linea.textContent = texto;
      linea.hidden = !texto;
    }
    // El punto de la pestaña Estado, con lo mismo que acaba de dibujar: así ninguna alerta queda escondida detrás de otra pestaña
    const marca = marcaDelEstado(alertas, estado.auditoria);
    document.getElementById('marca-estado-error').hidden = marca !== 'error';
    document.getElementById('marca-estado-advertencia').hidden = marca !== 'advertencia';

    const nombres = { interna: 'Gestión interna', externa: 'Gestión externa' };
    document.getElementById('nd-proximas').innerHTML = Object.entries(estado.proximas).map(([gestion, p]) =>
      `<div class="co-proxima"><h3>${nombres[gestion]}</h3><dl>`
      + `<dt>Próximo aviso</dt><dd>${p.aviso ? `${Utils.escapeHtml(fecha(p.aviso.fecha))} · ${cantidadDeDatasets(p.aviso.cantidad)}` : 'sin datasets pendientes'}</dd>`
      + `<dt>Próxima reiteración</dt><dd>${p.reiteracion.cantidad > 0 ? `${Utils.escapeHtml(fecha(p.reiteracion.fecha))} · ${cantidadDeDatasets(p.reiteracion.cantidad)}` : 'sin datasets pendientes'}</dd>`
      + '</dl></div>').join('');
  } catch (error) {
    avisar(`No se pudo cargar el estado: ${error.message}`, 'error');
  }
}

// "1 dataset" o "N datasets": la cantidad de las próximas notas del Estado
function cantidadDeDatasets(n) {
  return n === 1 ? '1 dataset' : `${n} datasets`;
}

function textoUltimaCorrida(corrida) {
  if (!corrida) return 'Última corrida diaria: sin registro todavía.';
  if (corrida.en_curso) return `Corrida diaria en curso (empezó el ${fechaHora(corrida.inicio)}).`;
  if (!corrida.fin) return `Última corrida diaria: empezó el ${fechaHora(corrida.inicio)} y no terminó.`;
  return `Última corrida diaria: ${fechaHora(corrida.inicio)} – ${corrida.resultado}`;
}

async function cambiarEnvioAutomatico(evento) {
  const activar = evento.target.checked;
  // Al activar se pregunta; si no se confirma (Cancelar, Escape o clic afuera), el interruptor vuelve a apagado y no se guarda nada
  if (activar && !(await confirmar({
    titulo: '¿Activar el envío automático?',
    texto: 'Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.',
    accion: 'Activar'
  }))) {
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
      cuerpo.innerHTML = '<tr><td colspan="8" class="co-sin-filas">No hay notas con estos filtros.</td></tr>';
      return;
    }
    // La API corta en las 500 más recientes: se avisa que puede haber más
    limite.hidden = notas.length < LIMITE_LIBRO;
    cuerpo.innerHTML = notas.map(filaDelLibro).join('');
  } catch (error) {
    cuerpo.innerHTML = `<tr><td colspan="8" class="co-sin-filas">${Utils.escapeHtml(error.message)}</td></tr>`;
  }
}

// Una fila del libro (spec 2026-10-17-correos-pestanas, 6). Los botones llevan data-accion, data-id y data-archivo: los lee accionDelLibro.
// Lo que va en un atributo (clases, title, nombres de archivo) también se escapa.
function filaDelLibro(n) {
  const esc = (texto) => Utils.escapeHtml(texto);
  const archivo = n.es_prueba ? `Nota-Digital-PRUEBA-${n.id}.pdf` : `Nota-Digital-${n.numero}-${String(n.anio).slice(-2)}.pdf`;
  const archivoAnexo = `Anexo-${archivo}`;
  // El Word de la nota (spec 2026-10-24-generador-de-notas, 6): el mismo nombre que el PDF, con .docx
  const archivoWord = archivo.replace(/\.pdf$/, '.docx');
  const detalleEstado = n.ultimo_error || n.respuesta_smtp || '';
  return `<tr>
    <td><span class="co-numero">${numeroDe(n)}</span></td>
    <td class="co-fecha">${fecha(n.fecha)}</td>
    <td><span class="co-chip ${esc(n.tipo)}">${ETIQUETAS[n.tipo]}</span></td>
    <td>${n.gestion ? `<span class="co-gestion">${textoGestion(n.gestion)}</span>` : textoGestion(n.gestion)}</td>
    <td class="co-cant">${celdaCantidad(n)}</td>
    <td class="co-para ocultable">${esc(n.para)}${n.cc ? `<small>CC: ${esc(n.cc)}</small>` : ''}</td>
    <td><span class="co-estado"><span class="co-pastilla ${esc(n.estado)}" title="${esc(detalleEstado)}">${ETIQUETAS[n.estado]}</span>${n.enviada_at ? `<small>${esc(fechaHora(n.enviada_at))}</small>` : ''}</span></td>
    <td><div class="co-acciones">
      <button type="button" class="co-btn" data-accion="ver" data-id="${n.id}">Ver</button>
      <button type="button" class="co-btn" data-accion="pdf" data-id="${n.id}" data-archivo="${esc(archivo)}">PDF</button>
      <button type="button" class="co-btn" data-accion="word" data-id="${n.id}" data-archivo="${esc(archivoWord)}">Word</button>
      ${n.tiene_anexo ? `<button type="button" class="co-btn" data-accion="anexo" data-id="${n.id}" data-archivo="${esc(archivoAnexo)}">Anexo</button>` : ''}
      ${n.estado !== 'enviada' ? `<button type="button" class="co-btn reintentar" data-accion="reintentar" data-id="${n.id}">Reintentar</button>` : ''}
    </div></td>
  </tr>`;
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
    } else if (boton.dataset.accion === 'word') {
      descargarBlob(await API.pedirArchivo(`/notificaciones/notas-digitales/${id}/word`), boton.dataset.archivo);
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

// Lo que dice arriba de la vista previa. Con `motivo`, hoy no se generan notas y lo que se muestra es la nota de la próxima
// corrida con notas (spec 2026-10-15, 7.7): lo avisa en su propia línea y la segunda línea habla de ese día, no de hoy
function textoDeVistaPrevia({ ejemplo, tipo, cantidad, asunto, fecha: f, motivo }) {
  const unidad = tipo === 'auditoria' ? 'cambio(s)' : 'dataset(s)';
  const texto = ejemplo
    ? `${motivo ? 'Ese día no saldría' : 'Hoy no saldría'} ninguna nota de este tipo: se muestran datos de ejemplo.`
    : `Con los datos de hoy${motivo ? ', ese día' : ''} esta nota incluiría ${cantidad} ${unidad}. Asunto: ${asunto}`;
  return motivo ? `Hoy no se generan notas (${motivo}): así saldría el ${fecha(f)}.
${texto}` : texto;
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
      aviso.textContent = textoDeVistaPrevia({ ...vista, tipo });
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

// El anexo existe en los avisos y las reiteraciones: con una auditoría (o con un pedido en curso) el botón queda deshabilitado
function actualizarBotonAnexo() {
  const llevaAnexo = TIPOS_CON_ANEXO.includes(document.getElementById('preview-tipo').value);
  const boton = document.getElementById('btn-preview-anexo');
  boton.disabled = !llevaAnexo || anexoEnCurso;
  boton.title = llevaAnexo ? '' : 'La nota de auditoría no lleva anexo';
}

// La nota de auditoría no tiene gestión: el selector de gestión se deshabilita mientras está elegida
function actualizarSelectorGestion() {
  document.getElementById('preview-gestion').disabled = document.getElementById('preview-tipo').value === 'auditoria';
}

// El anexo de la vista previa (N° XX) del tipo y la gestión elegidos: el del aviso o el de la reiteración
async function verAnexoDeVistaPrevia() {
  if (anexoEnCurso) return;
  anexoEnCurso = true;
  try {
    await conBotonBloqueado(document.getElementById('btn-preview-anexo'), async () => {
      const { tipo, gestion } = tipoYGestion();
      try {
        descargarBlob(await API.previewNotaAnexo(gestion, tipo), nombreAnexoVistaPrevia(tipo, gestion));
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
  if (!(await confirmar({
    titulo: '¿Enviarte una prueba?',
    texto: 'Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas.',
    accion: 'Enviar prueba'
  }))) return;
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
    // Si la persona autorizada falta el día que se mira (cualquier día de la licencia, también hasta el final), hasta
    // cuándo (esos días no se generan notas)
    const autorizado = l.autorizado_de_licencia_hasta ? `${l.autorizado} (de licencia hasta el ${fecha(l.autorizado_de_licencia_hasta)})` : l.autorizado;
    return l.en_curso
      ? `Licencia del firmante ${periodo}: ${autorizado} presenta las notas por autorización, con las dos firmas${nota}.`
      : `Licencia del firmante ${periodo}: los avisos se anticipan el ${fecha(l.vispera)} con la autorización a ${autorizado}, que durante la licencia presenta las demás notas y vuelve a presentar cada aviso en su fecha.`;
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
  if (!(await confirmar({
    titulo: '¿Enviarte una prueba?',
    texto: 'Se enviará el aviso a áreas marcado como PRUEBA solo a las casillas de prueba.',
    accion: 'Enviar prueba'
  }))) return;
  await conBotonBloqueado(document.getElementById('btn-prueba-area'), async () => {
    try {
      const resultado = await API.enviarPruebaAvisoArea();
      avisar(resultado.message, 'success');
    } catch (error) {
      avisar(error.message, 'error');
    }
  });
}

// =====================================================
// CONFIRMACIÓN Y VENTANAS (spec 2026-10-17-correos-pestanas, 9)
// =====================================================
// La confirmación abierta, o null. resolver contesta la promesa de confirmar; origen es quien tenía el foco al abrirla.
let confirmacionPendiente = null;

// Pregunta con la ventana propia (#modal-confirmar) en lugar del cuadro del navegador. Resuelve true si se acepta y false si se
// cancela (botón, Escape o clic afuera). Si ya había una abierta, esa se cancela antes de abrir la nueva.
function confirmar({ titulo, texto, accion }) {
  cerrarConfirmacion(false);
  return new Promise((resolver) => {
    document.getElementById('modal-confirmar-titulo').textContent = titulo;
    document.getElementById('modal-confirmar-texto').textContent = texto;
    document.getElementById('modal-confirmar-aceptar').textContent = accion;
    confirmacionPendiente = { resolver, origen: document.activeElement };
    document.getElementById('modal-confirmar').classList.add('active');
    document.getElementById('modal-confirmar-aceptar').focus();
  });
}

// Cierra la confirmación abierta, devuelve el foco a quien la abrió y contesta el pedido. Sin confirmación abierta no hace nada.
function cerrarConfirmacion(aceptada) {
  if (!confirmacionPendiente) return;
  const { resolver, origen } = confirmacionPendiente;
  confirmacionPendiente = null;
  document.getElementById('modal-confirmar').classList.remove('active');
  origen?.focus?.();
  resolver(aceptada === true);
}

// El teclado de la página. Con la confirmación abierta:
// - Enter o espacio sostenidos (evento.repeat) se frenan: el que se repite caería sobre el botón enfocado de la ventana y la aceptaría
//   sin que nadie la haya leído (por ejemplo, un Enter mantenido sobre "Enviarme una prueba").
// - Tab no sale de la ventana: el foco se queda entre Cancelar y el botón de la acción.
// Escape cierra lo de más arriba: la confirmación si está abierta y, si no, la ventana de "Ver". Con el foco dentro del iframe de la
// nota, Escape no llega a la página (se cierra con la X o con un clic afuera).
function teclaEnPagina(evento) {
  if (confirmacionPendiente) {
    if (evento.repeat && (evento.key === 'Enter' || evento.key === ' ')) evento.preventDefault();
    else if (evento.key === 'Tab') retenerFocoEnConfirmacion(evento);
  }
  if (evento.key !== 'Escape') return;
  if (confirmacionPendiente) cerrarConfirmacion(false);
  else if (document.getElementById('modal-nota').classList.contains('active')) cerrarModalNota();
}

// Mantiene el foco entre los dos botones de la confirmación. Entre ellos Tab se deja: el navegador sabe moverse de uno a otro. Solo se
// interviene en los bordes (Shift+Tab en Cancelar, Tab en la acción) y si el foco está en cualquier otro lado, que va a la acción.
function retenerFocoEnConfirmacion(evento) {
  const cancelar = document.getElementById('modal-confirmar-cancelar');
  const aceptar = document.getElementById('modal-confirmar-aceptar');
  const enfocado = document.activeElement;
  if (enfocado === cancelar && evento.shiftKey) aceptar.focus();
  else if (enfocado === aceptar && !evento.shiftKey) cancelar.focus();
  else if (enfocado !== cancelar && enfocado !== aceptar) aceptar.focus();
  else return;
  evento.preventDefault();
}

// El velo (el fondo) de la ventana donde empezó la última presión del mouse, o null si empezó en otro lado (adentro de la ventana o en
// la página). Cuando se suelta el botón sobre un lugar distinto del que se apretó, el navegador manda el clic al ancestro común: apretar
// adentro de la ventana y soltar sobre el velo (por ejemplo, al seleccionar texto de la nota) llega como un clic sobre el velo.
let veloPresionado = null;

// mousedown de cada velo: anota si la presión empezó en el propio velo
function presionEnVelo(evento) {
  veloPresionado = evento.target === evento.currentTarget ? evento.currentTarget : null;
}

// ¿Es un clic afuera de verdad? Solo si la presión empezó en este mismo velo, el clic cae en el propio velo (y no en algo de adentro) y
// no es el segundo clic o posterior de un doble clic (evento.detail > 1: el doble clic en "Ver" no cierra la nota que acaba de abrir).
// Consume la presión anotada: cada presión vale para un solo clic.
function esClicAfuera(evento) {
  const empezoEnElVelo = veloPresionado !== null && veloPresionado === evento.currentTarget;
  veloPresionado = null;
  return empezoEnElVelo && evento.target === evento.currentTarget && !(evento.detail > 1);
}

function clicAfueraDeLaNota(evento) {
  if (esClicAfuera(evento)) cerrarModalNota();
}

function clicAfueraDeLaConfirmacion(evento) {
  if (esClicAfuera(evento)) cerrarConfirmacion(false);
}
