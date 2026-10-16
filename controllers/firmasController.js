// Firma propia para las Notas Digitales, en Mi Perfil (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1).
// Las rutas exigen authMiddleware + adminOnly: cada uno trabaja solo sobre su propia firma.
import pool from '../config/database.js';
import { firmaDeUsuario, validarTextosFirma, guardarFirma } from '../services/firmasService.js';
import { decodificarImagenSubida, ImagenSubidaInvalida } from '../services/imagenesSubidas.js';
import { validarImagenFirma } from '../services/notasDigitalesPdf.js';

const errorInterno = (res, mensaje, error) => {
  console.error(`${mensaje}:`, error);
  res.status(500).json({ success: false, error: mensaje });
};

const aRespuesta = async (usuarioId) => {
  const firma = await firmaDeUsuario(usuarioId);
  if (firma) return { cargada: true, nombre: firma.nombre, cargo: firma.cargo, tiene_imagen: Boolean(firma.imagen) };
  // Sin firma: se proponen el nombre y el cargo del usuario
  const [[usuario]] = await pool.query('SELECT nombre_completo, cargo FROM usuarios WHERE id = ?', [usuarioId]);
  return { cargada: false, nombre: usuario?.nombre_completo ?? '', cargo: usuario?.cargo ?? '', tiene_imagen: false };
};

// GET /auth/profile/firma
export const verMiFirma = async (req, res) => {
  try {
    res.json({ success: true, data: await aRespuesta(req.user.userId) });
  } catch (error) {
    errorInterno(res, 'Error al obtener la firma', error);
  }
};

// PUT /auth/profile/firma: { nombre, cargo, imagen?, mime? }
export const guardarMiFirma = async (req, res) => {
  try {
    const cuerpo = req.body ?? {};
    const { errores, datos } = validarTextosFirma(cuerpo);
    if (errores.length) return res.status(400).json({ success: false, error: errores[0].error, campo: errores[0].campo });
    let imagen = null;
    if (cuerpo.imagen !== undefined && cuerpo.imagen !== null) {
      try {
        imagen = decodificarImagenSubida(cuerpo, { tipoInvalido: 'La firma debe ser una imagen PNG o JPEG', validar: validarImagenFirma });
      } catch (error) {
        if (error instanceof ImagenSubidaInvalida) return res.status(400).json({ success: false, error: error.message, campo: 'imagen' });
        throw error;
      }
    }
    await guardarFirma(req.user.userId, { ...datos, imagen, mime: cuerpo.mime });
    res.json({ success: true, message: 'Firma guardada', data: await aRespuesta(req.user.userId) });
  } catch (error) {
    errorInterno(res, 'Error al guardar la firma', error);
  }
};

// GET /auth/profile/firma/imagen (404 si no hay)
export const verImagenMiFirma = async (req, res) => {
  try {
    const firma = await firmaDeUsuario(req.user.userId);
    if (!firma?.imagen) return res.status(404).json({ success: false, error: 'No hay imagen de la firma' });
    res.setHeader('Content-Type', firma.mime || 'image/png');
    res.send(firma.imagen);
  } catch (error) {
    errorInterno(res, 'Error al obtener la imagen de la firma', error);
  }
};
