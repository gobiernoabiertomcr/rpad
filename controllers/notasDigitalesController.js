// API de Notas Digitales para la pantalla de Correos (solo admins).
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 9)
import pool from '../config/database.js';
import * as notas from '../services/notasDigitales.js';
import { obtenerConfig, configuracionCompleta } from '../services/notasDigitalesDatos.js';
import {
  validarImagenFirma, validarImagenMembrete, ImagenInvalida, caracteresNoEscribibles, pieEntraEnUnaLinea
} from '../services/notasDigitalesPdf.js';
import { listaDeCorreos } from '../services/emailService.js';
import { decodificarImagenSubida, ImagenSubidaInvalida } from '../services/imagenesSubidas.js';
import { firmaDeUsuario } from '../services/firmasService.js';

const TIPOS = ['aviso', 'reiteracion'];
// El libro también filtra las notas de autorización y las de auditoría (spec 2026-10-15, 7.2 y 10.4)
const TIPOS_LIBRO = [...TIPOS, 'autorizacion', 'auditoria'];
const GESTIONES = ['interna', 'externa'];
const ESTADOS = ['pendiente', 'enviada', 'fallida'];
const EMAIL_VALIDO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
// Imágenes de la configuración: columnas (texto fijo del código), validador y mensajes
const IMAGENES = {
  firma: {
    imagen: 'firma_imagen', mime: 'firma_mime', validar: validarImagenFirma,
    tipoInvalido: 'La firma debe ser una imagen PNG o JPEG', guardada: 'Firma guardada', falta: 'No hay firma cargada',
    errorGuardar: 'Error al guardar la firma', errorObtener: 'Error al obtener la firma'
  },
  membrete: {
    imagen: 'membrete_imagen', mime: 'membrete_mime', validar: validarImagenMembrete,
    tipoInvalido: 'El banner del membrete debe ser una imagen PNG o JPEG', guardada: 'Membrete guardado', falta: 'No hay membrete cargado',
    errorGuardar: 'Error al guardar el membrete', errorObtener: 'Error al obtener el membrete'
  }
};
// Listas de direcciones: true = obligatoria
const LISTAS = {
  para_interna: true, para_externa: true, cc_interna: false, cc_externa: false, cco: false, casillas_prueba: false,
  para_auditoria: true, cc_auditoria: false
};
// Textos que van al PDF: largo máximo. Se guardan en NFC y sin caracteres que Helvetica no puede escribir.
// membrete_pie vacío = PDF sin pie del membrete; si no, tiene que entrar en una línea con letra de 7 puntos.
const TEXTOS = { linea_cc_interna: 200, linea_cc_externa: 200, firma_nombre: 150, firma_cargo: 200, membrete_pie: 300 };

const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Tipo y gestión de la vista previa y la prueba: un aviso o una reiteración con su gestión, o la nota de auditoría, que no
// tiene gestión (spec 2026-10-15, 10.4). null si no son válidos.
const notaPedida = ({ tipo, gestion } = {}) => {
  if (tipo === 'auditoria') return { tipo, gestion: null };
  return TIPOS.includes(tipo) && GESTIONES.includes(gestion) ? { tipo, gestion } : null;
};

// Firmante titular para la pantalla (spec 2026-10-15, 6.2), o null
const datosFirmante = async (usuarioId) => {
  if (!usuarioId) return null;
  const [[fila]] = await pool.query(
    `SELECT u.id, u.nombre_completo, f.nombre, f.cargo, (f.imagen IS NOT NULL) AS tiene_imagen
     FROM usuarios u LEFT JOIN usuarios_firmas f ON f.usuario_id = u.id WHERE u.id = ?`, [usuarioId]
  );
  return fila ? { ...fila, tiene_imagen: Boolean(fila.tiene_imagen) } : null;
};

// La configuración sin las imágenes: solo si están cargadas. Con firmante titular, la firma es la suya.
const configPublica = async ({ firma_imagen, membrete_imagen, ...resto }) => {
  const firmante = await datosFirmante(resto.firmante_usuario_id);
  return {
    ...resto,
    envio_activo: Boolean(resto.envio_activo),
    tiene_firma: firmante ? firmante.tiene_imagen : Boolean(firma_imagen),
    tiene_membrete: Boolean(membrete_imagen),
    firmante
  };
};

// Lista de direcciones que llega en el cuerpo: texto separado por comas, array de textos o null (lista vacía).
// Cualquier otro tipo devuelve null (inválido): no se convierte a texto para no guardar "5" o "[object Object]".
const correosDelCuerpo = (valor) => {
  if (valor === null) return [];
  if (typeof valor === 'string') return listaDeCorreos(valor);
  if (Array.isArray(valor) && valor.every(elemento => typeof elemento === 'string')) return listaDeCorreos(valor);
  return null;
};

export const listarNotas = async (req, res) => {
  try {
    const { anio, tipo, gestion, estado, dataset_id, incluir_pruebas } = req.query;
    const condiciones = [];
    const parametros = [];
    if (incluir_pruebas !== '1') condiciones.push('n.es_prueba = 0');
    if (idDe(anio)) { condiciones.push('YEAR(n.fecha) = ?'); parametros.push(Number(anio)); }
    if (TIPOS_LIBRO.includes(tipo)) { condiciones.push('n.tipo = ?'); parametros.push(tipo); }
    if (GESTIONES.includes(gestion)) { condiciones.push('n.gestion = ?'); parametros.push(gestion); }
    if (ESTADOS.includes(estado)) { condiciones.push('n.estado = ?'); parametros.push(estado); }
    const datasetId = idDe(dataset_id);
    if (datasetId) {
      condiciones.push('EXISTS (SELECT 1 FROM notas_digitales_datasets x WHERE x.nota_id = n.id AND x.dataset_id = ?)');
      parametros.push(datasetId);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const [filas] = await pool.query(
      `SELECT n.id, n.numero, n.anio, n.tipo, n.gestion, DATE_FORMAT(n.fecha, '%Y-%m-%d') AS fecha, n.es_prueba,
              n.asunto, n.para, n.cc, n.cco, n.estado, n.intentos, n.ultimo_error, n.respuesta_smtp,
              DATE_FORMAT(n.enviada_at, '%Y-%m-%d %H:%i') AS enviada_at,
              (SELECT COUNT(*) FROM notas_digitales_datasets c WHERE c.nota_id = n.id) AS cantidad_datasets,
              (SELECT COUNT(*) FROM notas_digitales_cambios k WHERE k.nota_id = n.id) AS cantidad_cambios,
              (n.anexo_pdf IS NOT NULL) AS tiene_anexo
              ${datasetId ? ', (SELECT s.seccion FROM notas_digitales_datasets s WHERE s.nota_id = n.id AND s.dataset_id = ?) AS seccion_dataset' : ''}
       FROM notas_digitales n ${where}
       ORDER BY n.fecha DESC, n.id DESC
       LIMIT 500`,
      datasetId ? [datasetId, ...parametros] : parametros
    );
    res.json({ success: true, data: filas.map(fila => ({ ...fila, tiene_anexo: Boolean(fila.tiene_anexo) })) });
  } catch (error) {
    errorInterno(res, 'Error al obtener el libro de notas', error);
  }
};

export const obtenerNota = async (req, res) => {
  try {
    const id = idDe(req.params.id);
    const [[nota]] = await pool.query(
      `SELECT id, numero, anio, tipo, gestion, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, es_prueba, asunto, para, cc, cco,
              html, estado, intentos, ultimo_error, message_id, respuesta_smtp, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i') AS enviada_at,
              (anexo_pdf IS NOT NULL) AS tiene_anexo
       FROM notas_digitales WHERE id = ?`, [id]
    );
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    // Con lo que pidió la nota de cada dataset (spec 2026-10-17-fechas-datasets, 9); en las notas de antes de esa etapa, null
    const [datasets] = await pool.query(
      `SELECT x.dataset_id, d.titulo, x.seccion, DATE_FORMAT(x.vencimiento, '%Y-%m-%d') AS vencimiento,
              DATE_FORMAT(x.datos_desde, '%Y-%m-%d') AS datos_desde, DATE_FORMAT(x.datos_hasta, '%Y-%m-%d') AS datos_hasta,
              x.datos_solicitados
       FROM notas_digitales_datasets x JOIN datasets d ON d.id = x.dataset_id
       WHERE x.nota_id = ? ORDER BY x.vencimiento, d.titulo`, [id]
    );
    // Los cambios que incluye una nota de auditoría (spec 2026-10-15, 10.4). El título es el del dataset o, en un alta, el
    // propuesto (se arma acá y no con COALESCE en SQL: datos_nuevos tiene otra intercalación que datasets.titulo)
    const [filasCambios] = await pool.query(
      `SELECT k.cambio_id, k.seccion, cp.tipo_cambio, cp.estado, d.titulo AS dataset_titulo, cp.datos_nuevos
       FROM notas_digitales_cambios k
       JOIN cambios_pendientes cp ON cp.id = k.cambio_id
       LEFT JOIN datasets d ON d.id = cp.dataset_id
       WHERE k.nota_id = ? ORDER BY k.seccion, cp.created_at, cp.id`, [id]
    );
    const cambios = filasCambios.map(({ dataset_titulo: tituloDataset, datos_nuevos: datosNuevos, ...cambio }) => ({
      ...cambio,
      titulo: tituloDataset ?? (typeof datosNuevos === 'string' ? JSON.parse(datosNuevos) : datosNuevos)?.titulo ?? null
    }));
    res.json({ success: true, data: { ...nota, tiene_anexo: Boolean(nota.tiene_anexo), datasets, cambios } });
  } catch (error) {
    errorInterno(res, 'Error al obtener la nota', error);
  }
};

export const descargarPdf = async (req, res) => {
  try {
    const [[nota]] = await pool.query('SELECT numero, anio, es_prueba, pdf FROM notas_digitales WHERE id = ?', [idDe(req.params.id)]);
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    const archivo = nota.es_prueba ? 'Nota-Digital-PRUEBA.pdf' : `Nota-Digital-${nota.numero}-${String(nota.anio).slice(-2)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.send(nota.pdf);
  } catch (error) {
    errorInterno(res, 'Error al descargar el PDF', error);
  }
};

// El anexo guardado de un aviso (las reiteraciones no tienen)
export const descargarAnexo = async (req, res) => {
  try {
    const id = idDe(req.params.id);
    const [[nota]] = await pool.query('SELECT numero, anio, es_prueba, anexo_pdf FROM notas_digitales WHERE id = ?', [id]);
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    if (!nota.anexo_pdf) return res.status(404).json({ success: false, error: 'La nota no tiene anexo' });
    const archivo = nota.es_prueba ? `Anexo-Nota-Digital-PRUEBA-${id}.pdf` : `Anexo-Nota-Digital-${nota.numero}-${String(nota.anio).slice(-2)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.send(nota.anexo_pdf);
  } catch (error) {
    errorInterno(res, 'Error al descargar el anexo', error);
  }
};

export const reintentarNota = async (req, res) => {
  try {
    const [[nota]] = await pool.query('SELECT id, estado FROM notas_digitales WHERE id = ?', [idDe(req.params.id)]);
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    if (nota.estado === 'enviada') return res.status(400).json({ success: false, error: 'La nota ya fue enviada' });
    // Comparte el bloqueo con la corrida diaria: si hay una en curso, no se envía para no duplicar la nota
    const resultado = await notas.reintentarNota(nota.id);
    if (resultado.enCurso) return res.status(409).json({ success: false, error: resultado.error });
    if (!resultado.success) return res.status(502).json({ success: false, error: `No se pudo enviar: ${resultado.error}` });
    res.json({ success: true, message: 'Nota enviada', data: { estado: 'enviada' } });
  } catch (error) {
    errorInterno(res, 'Error al reintentar la nota', error);
  }
};

export const verEstado = async (req, res) => {
  try {
    res.json({ success: true, data: await notas.estadoNotas() });
  } catch (error) {
    errorInterno(res, 'Error al obtener el estado de las notas', error);
  }
};

export const verPreview = async (req, res) => {
  try {
    const pedida = notaPedida(req.query);
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    res.json({ success: true, data: await notas.previewNota(pedida) });
  } catch (error) {
    errorInterno(res, 'Error al generar la vista previa', error);
  }
};

// El PDF de la vista previa (N° XX, con el membrete y la firma cargados): no se guarda ni se envía
export const verPreviewPdf = async (req, res) => {
  try {
    const pedida = notaPedida(req.query);
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    const pdf = await notas.previewPdf(pedida);
    const nombre = `Nota-Digital-vista-previa-${pedida.tipo}${pedida.gestion ? `-${pedida.gestion}` : ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.send(pdf);
  } catch (error) {
    // Una firma o un banner guardados que no se pueden leer: el admin los reemplaza en Configuración
    if (error instanceof ImagenInvalida) return res.status(400).json({ success: false, error: error.message });
    errorInterno(res, 'Error al generar el PDF de la vista previa', error);
  }
};

// El anexo del aviso de la vista previa (N° XX): no se guarda ni se envía. Solo los avisos llevan anexo.
export const verPreviewAnexo = async (req, res) => {
  try {
    const { gestion } = req.query;
    if (!GESTIONES.includes(gestion)) {
      return res.status(400).json({ success: false, error: 'Gestión inválida' });
    }
    const pdf = await notas.previewAnexo({ gestion });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Anexo-vista-previa-${gestion}.pdf"`);
    res.send(pdf);
  } catch (error) {
    errorInterno(res, 'Error al generar el anexo de la vista previa', error);
  }
};

export const enviarPrueba = async (req, res) => {
  try {
    const pedida = notaPedida(req.body ?? {});
    if (!pedida) return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    const resultado = await notas.enviarPrueba({ ...pedida, usuarioId: req.user?.userId ?? null });
    if (!resultado.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${resultado.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${resultado.destinatarios.join(', ')}${resultado.ejemplo ? ' (con datos de ejemplo)' : ''}`,
      data: { id: resultado.id, ejemplo: resultado.ejemplo, destinatarios: resultado.destinatarios }
    });
  } catch (error) {
    // Sin casillas de prueba o con una firma o un banner guardados que no se pueden leer: el admin lo corrige en Configuración
    if (error instanceof notas.ErrorDeUso || error instanceof ImagenInvalida) {
      return res.status(400).json({ success: false, error: error.message });
    }
    errorInterno(res, 'Error al enviar la prueba', error);
  }
};

export const verConfig = async (req, res) => {
  try {
    res.json({ success: true, data: await configPublica(await obtenerConfig()) });
  } catch (error) {
    errorInterno(res, 'Error al obtener la configuración', error);
  }
};

export const guardarConfig = async (req, res) => {
  try {
    const cuerpo = req.body ?? {};
    const cambios = {};
    const errores = [];

    for (const [campo, obligatoria] of Object.entries(LISTAS)) {
      if (cuerpo[campo] === undefined) continue;
      const correos = correosDelCuerpo(cuerpo[campo]);
      if (correos === null) {
        errores.push(`${campo}: debe ser un texto con direcciones separadas por coma`);
        continue;
      }
      const invalidos = correos.filter(c => !EMAIL_VALIDO.test(c));
      if (invalidos.length) errores.push(`${campo}: direcciones inválidas (${invalidos.join(', ')})`);
      else if (obligatoria && correos.length === 0) errores.push(`${campo}: debe tener al menos una dirección`);
      else if (correos.join(', ').length > 500) errores.push(`${campo}: demasiadas direcciones`);
      else cambios[campo] = correos.join(', ');
    }
    for (const [campo, maximo] of Object.entries(TEXTOS)) {
      const valor = cuerpo[campo];
      if (valor === undefined) continue;
      // null equivale a vacío; cualquier otro valor que no sea texto se rechaza (String(null) guardaría "null")
      if (valor !== null && typeof valor !== 'string') {
        errores.push(`${campo}: debe ser un texto`);
        continue;
      }
      // Todos estos textos van al PDF: se guardan en NFC (un acento descompuesto, típico al pegar desde macOS, se
      // escribiría mal) y se rechazan los caracteres que Helvetica no puede escribir (☎, →, emojis…)
      const texto = (valor ?? '').normalize('NFC').trim();
      const noEscribibles = caracteresNoEscribibles(texto);
      if (texto.length > maximo) errores.push(`${campo}: máximo ${maximo} caracteres`);
      else if (noEscribibles.length) errores.push(`${campo}: caracteres que el PDF no puede escribir: ${noEscribibles.join(' ')}`);
      else if (campo === 'membrete_pie' && !pieEntraEnUnaLinea(texto)) {
        errores.push('membrete_pie: no entra en una línea al pie del PDF ni con la letra más chica (7 puntos); acortalo');
      } else cambios[campo] = texto;
    }
    if (cuerpo.envio_activo !== undefined) {
      cambios.envio_activo = [true, 1, '1', 'true'].includes(cuerpo.envio_activo) ? 1 : 0;
    }

    if (errores.length) return res.status(400).json({ success: false, error: errores.join('. ') });
    if (Object.keys(cambios).length === 0) return res.status(400).json({ success: false, error: 'No hay cambios para guardar' });

    const resultante = { ...(await obtenerConfig()), ...cambios };
    const faltan = configuracionCompleta(resultante, await firmaDeUsuario(resultante.firmante_usuario_id));
    if (resultante.envio_activo && faltan.length) {
      return res.status(400).json({ success: false, error: `No se puede activar el envío automático: falta ${faltan.join(', ')}` });
    }

    // Las columnas salen de LISTAS, TEXTOS y envio_activo: listas fijas del código
    const columnas = Object.keys(cambios);
    await pool.query(
      `UPDATE notas_digitales_config SET ${columnas.map(c => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = 1`,
      [...Object.values(cambios), req.user?.userId ?? null]
    );
    res.json({ success: true, message: 'Configuración guardada', data: await configPublica(await obtenerConfig()) });
  } catch (error) {
    errorInterno(res, 'Error al guardar la configuración', error);
  }
};

// PUT de una imagen de la configuración (firma o banner del membrete): { imagen: base64 o data URL, mime }
const subirImagen = (uso) => async (req, res) => {
  const definicion = IMAGENES[uso];
  // Todo el cuerpo del handler va dentro del try: Express 4 no atrapa los rechazos de un handler async
  // y una excepción sin atrapar tumbaría el proceso.
  try {
    // Con firmante titular elegido, la firma de las notas es la de su Mi Perfil (spec 2026-10-15, 6.2)
    if (uso === 'firma' && (await obtenerConfig()).firmante_usuario_id) {
      return res.status(409).json({ success: false, error: 'Con un firmante titular elegido, la firma se carga en su Mi Perfil.' });
    }
    let datos;
    try {
      datos = decodificarImagenSubida(req.body ?? {}, definicion);
    } catch (error) {
      if (error instanceof ImagenSubidaInvalida) return res.status(400).json({ success: false, error: error.message });
      throw error;
    }
    // Las columnas salen de IMAGENES, texto fijo del código
    await pool.query(`UPDATE notas_digitales_config SET ${definicion.imagen} = ?, ${definicion.mime} = ?, updated_by = ? WHERE id = 1`,
      [datos, req.body.mime, req.user?.userId ?? null]);
    res.json({ success: true, message: definicion.guardada });
  } catch (error) {
    errorInterno(res, definicion.errorGuardar, error);
  }
};

// GET de una imagen de la configuración, para la vista previa de la pantalla (404 si no hay). Con firmante titular, la
// firma es la de su Mi Perfil.
const verImagen = (uso) => async (req, res) => {
  const definicion = IMAGENES[uso];
  try {
    const guardada = await obtenerConfig();
    const fuente = uso === 'firma' && guardada.firmante_usuario_id
      ? await firmaDeUsuario(guardada.firmante_usuario_id)
      : { imagen: guardada[definicion.imagen], mime: guardada[definicion.mime] };
    if (!fuente?.imagen) return res.status(404).json({ success: false, error: definicion.falta });
    res.setHeader('Content-Type', fuente.mime || 'image/png');
    res.send(fuente.imagen);
  } catch (error) {
    errorInterno(res, definicion.errorObtener, error);
  }
};

export const subirFirma = subirImagen('firma');
export const verFirma = verImagen('firma');
export const subirMembrete = subirImagen('membrete');
export const verMembrete = verImagen('membrete');

// GET /config/firmantes: quiénes pueden ser firmante titular (spec 2026-10-15, 6.2): superadmin o admins activos con su
// firma cargada en Mi Perfil
export const listarFirmantes = async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT u.id, u.nombre_completo, u.rol, f.nombre, f.cargo, (f.imagen IS NOT NULL) AS tiene_imagen
       FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
       WHERE u.rol IN ('superadmin', 'admin') AND u.activo = TRUE
       ORDER BY u.nombre_completo`
    );
    res.json({ success: true, data: filas.map(f => ({ ...f, tiene_imagen: Boolean(f.tiene_imagen) })) });
  } catch (error) {
    errorInterno(res, 'Error al obtener los firmantes', error);
  }
};

// PUT /config/firmante: { usuario_id } o { usuario_id: null } para volver a la firma de Correos. Solo el superadmin.
export const elegirFirmante = async (req, res) => {
  try {
    if (req.user?.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin elige al firmante titular.' });
    }
    const crudo = req.body?.usuario_id;
    const usuarioId = crudo === null || crudo === '' || crudo === undefined ? null : idDe(crudo);
    if (crudo !== null && crudo !== '' && crudo !== undefined && !usuarioId) {
      return res.status(400).json({ success: false, error: 'Firmante inválido' });
    }
    if (usuarioId) {
      const [[candidato]] = await pool.query(
        `SELECT u.id FROM usuarios u JOIN usuarios_firmas f ON f.usuario_id = u.id
         WHERE u.id = ? AND u.rol IN ('superadmin', 'admin') AND u.activo = TRUE`, [usuarioId]
      );
      if (!candidato) {
        return res.status(400).json({ success: false, error: 'El firmante titular tiene que ser el superadmin o un admin activo, con su firma cargada en Mi Perfil.' });
      }
    }
    const resultante = { ...(await obtenerConfig()), firmante_usuario_id: usuarioId };
    const faltan = configuracionCompleta(resultante, await firmaDeUsuario(usuarioId));
    if (resultante.envio_activo && faltan.length) {
      return res.status(400).json({ success: false, error: `No se puede con el envío automático activo: faltaría ${faltan.join(', ')}` });
    }
    await pool.query('UPDATE notas_digitales_config SET firmante_usuario_id = ?, updated_by = ? WHERE id = 1', [usuarioId, req.user.userId]);
    res.json({
      success: true,
      message: usuarioId ? 'Firmante titular elegido' : 'Las notas vuelven a usar la firma cargada en Correos',
      data: await configPublica(await obtenerConfig())
    });
  } catch (error) {
    errorInterno(res, 'Error al elegir el firmante titular', error);
  }
};
