// API de Notas Digitales para la pantalla de Correos (solo admins).
// Spec: docs/superpowers/specs/2026-10-12-notas-digitales-design.md (sección 9)
import pool from '../config/database.js';
import * as notas from '../services/notasDigitales.js';
import { obtenerConfig } from '../services/notasDigitalesDatos.js';
import { listaDeCorreos } from '../services/emailService.js';

const TIPOS = ['aviso', 'reiteracion'];
const GESTIONES = ['interna', 'externa'];
const ESTADOS = ['pendiente', 'enviada', 'fallida'];
const EMAIL_VALIDO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const FIRMA_MAX_BYTES = 500 * 1024;
const FIRMAS = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
// Listas de direcciones: true = obligatoria
const LISTAS = { para_interna: true, para_externa: true, cc_interna: false, cc_externa: false, cco: false, casillas_prueba: false };
const TEXTOS = { linea_cc_interna: 200, linea_cc_externa: 200, firma_nombre: 150, firma_cargo: 200 };

const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

const idDe = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const configPublica = ({ firma_imagen, ...resto }) => ({
  ...resto, envio_activo: Boolean(resto.envio_activo), tiene_firma: Boolean(firma_imagen)
});

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
    if (TIPOS.includes(tipo)) { condiciones.push('n.tipo = ?'); parametros.push(tipo); }
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
              (SELECT COUNT(*) FROM notas_digitales_datasets c WHERE c.nota_id = n.id) AS cantidad_datasets
              ${datasetId ? ', (SELECT s.seccion FROM notas_digitales_datasets s WHERE s.nota_id = n.id AND s.dataset_id = ?) AS seccion_dataset' : ''}
       FROM notas_digitales n ${where}
       ORDER BY n.fecha DESC, n.id DESC
       LIMIT 500`,
      datasetId ? [datasetId, ...parametros] : parametros
    );
    res.json({ success: true, data: filas });
  } catch (error) {
    errorInterno(res, 'Error al obtener el libro de notas', error);
  }
};

export const obtenerNota = async (req, res) => {
  try {
    const id = idDe(req.params.id);
    const [[nota]] = await pool.query(
      `SELECT id, numero, anio, tipo, gestion, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, es_prueba, asunto, para, cc, cco,
              html, estado, intentos, ultimo_error, message_id, respuesta_smtp, DATE_FORMAT(enviada_at, '%Y-%m-%d %H:%i') AS enviada_at
       FROM notas_digitales WHERE id = ?`, [id]
    );
    if (!nota) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
    const [datasets] = await pool.query(
      `SELECT x.dataset_id, d.titulo, x.seccion, DATE_FORMAT(x.vencimiento, '%Y-%m-%d') AS vencimiento
       FROM notas_digitales_datasets x JOIN datasets d ON d.id = x.dataset_id
       WHERE x.nota_id = ? ORDER BY x.vencimiento, d.titulo`, [id]
    );
    res.json({ success: true, data: { ...nota, datasets } });
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
    const { tipo, gestion } = req.query;
    if (!TIPOS.includes(tipo) || !GESTIONES.includes(gestion)) {
      return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    }
    res.json({ success: true, data: await notas.previewNota({ tipo, gestion }) });
  } catch (error) {
    errorInterno(res, 'Error al generar la vista previa', error);
  }
};

export const enviarPrueba = async (req, res) => {
  try {
    const { tipo, gestion } = req.body ?? {};
    if (!TIPOS.includes(tipo) || !GESTIONES.includes(gestion)) {
      return res.status(400).json({ success: false, error: 'Tipo o gestión inválidos' });
    }
    const resultado = await notas.enviarPrueba({ tipo, gestion, usuarioId: req.user?.userId ?? null });
    if (!resultado.success) return res.status(502).json({ success: false, error: `No se pudo enviar la prueba: ${resultado.error}` });
    res.json({
      success: true,
      message: `Prueba enviada a ${resultado.destinatarios.join(', ')}${resultado.ejemplo ? ' (con datos de ejemplo)' : ''}`,
      data: { id: resultado.id, ejemplo: resultado.ejemplo, destinatarios: resultado.destinatarios }
    });
  } catch (error) {
    if (error instanceof notas.ErrorDeUso) return res.status(400).json({ success: false, error: error.message });
    errorInterno(res, 'Error al enviar la prueba', error);
  }
};

export const verConfig = async (req, res) => {
  try {
    res.json({ success: true, data: configPublica(await obtenerConfig()) });
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
      const texto = (valor ?? '').trim();
      if (texto.length > maximo) errores.push(`${campo}: máximo ${maximo} caracteres`);
      else cambios[campo] = texto;
    }
    if (cuerpo.envio_activo !== undefined) {
      cambios.envio_activo = [true, 1, '1', 'true'].includes(cuerpo.envio_activo) ? 1 : 0;
    }

    if (errores.length) return res.status(400).json({ success: false, error: errores.join('. ') });
    if (Object.keys(cambios).length === 0) return res.status(400).json({ success: false, error: 'No hay cambios para guardar' });

    const resultante = { ...(await obtenerConfig()), ...cambios };
    const faltan = notas.configuracionCompleta(resultante);
    if (resultante.envio_activo && faltan.length) {
      return res.status(400).json({ success: false, error: `No se puede activar el envío automático: falta ${faltan.join(', ')}` });
    }

    // Las columnas salen de LISTAS, TEXTOS y envio_activo: listas fijas del código
    const columnas = Object.keys(cambios);
    await pool.query(
      `UPDATE notas_digitales_config SET ${columnas.map(c => `${c} = ?`).join(', ')}, updated_by = ? WHERE id = 1`,
      [...Object.values(cambios), req.user?.userId ?? null]
    );
    res.json({ success: true, message: 'Configuración guardada', data: configPublica(await obtenerConfig()) });
  } catch (error) {
    errorInterno(res, 'Error al guardar la configuración', error);
  }
};

export const subirFirma = async (req, res) => {
  // Todo el cuerpo del handler va dentro del try: Express 4 no atrapa los rechazos de un handler async
  // y una excepción sin atrapar tumbaría el proceso.
  try {
    const { imagen, mime } = req.body ?? {};
    // Object.hasOwn: 'constructor' o '__proto__' no son firmas válidas aunque existan en Object.prototype
    if (typeof mime !== 'string' || !Object.hasOwn(FIRMAS, mime) || typeof imagen !== 'string') {
      return res.status(400).json({ success: false, error: 'La firma debe ser una imagen PNG o JPEG' });
    }
    const cabecera = FIRMAS[mime];
    const base64 = imagen.replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return res.status(400).json({ success: false, error: 'La imagen no es base64 válido' });
    }
    const datos = Buffer.from(base64, 'base64');
    if (datos.length === 0 || datos.length > FIRMA_MAX_BYTES) {
      return res.status(400).json({ success: false, error: 'La imagen debe pesar como máximo 500 KB' });
    }
    if (!cabecera.every((byte, i) => datos[i] === byte)) {
      return res.status(400).json({ success: false, error: 'El contenido no corresponde a una imagen PNG o JPEG' });
    }
    await pool.query('UPDATE notas_digitales_config SET firma_imagen = ?, firma_mime = ?, updated_by = ? WHERE id = 1',
      [datos, mime, req.user?.userId ?? null]);
    res.json({ success: true, message: 'Firma guardada' });
  } catch (error) {
    errorInterno(res, 'Error al guardar la firma', error);
  }
};

export const verFirma = async (req, res) => {
  try {
    const config = await obtenerConfig();
    if (!config.firma_imagen) return res.status(404).json({ success: false, error: 'No hay firma cargada' });
    res.setHeader('Content-Type', config.firma_mime || 'image/png');
    res.send(config.firma_imagen);
  } catch (error) {
    errorInterno(res, 'Error al obtener la firma', error);
  }
};
