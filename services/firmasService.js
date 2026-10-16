// Firma de cada usuario para las Notas Digitales (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.1)
import pool from '../config/database.js';
import { caracteresNoEscribibles } from './notasDigitalesPdf.js';

const TEXTOS = [
  { campo: 'nombre', maximo: 150, etiqueta: 'El nombre de la firma' },
  { campo: 'cargo', maximo: 200, etiqueta: 'El cargo de la firma' }
];

// La firma de un usuario, o null. contratado: si es personal contratado (usuarios.vinculo = 'contrato'): las notas lo
// presentan así (pedido del usuario el 16/10/2026). El cargo de la firma sigue siendo solo el cargo.
export const firmaDeUsuario = async (usuarioId, conexion = pool) => {
  if (!usuarioId) return null;
  const [[fila]] = await conexion.query(
    `SELECT f.usuario_id, f.nombre, f.cargo, f.imagen, f.mime, (u.vinculo <=> 'contrato') AS contratado
     FROM usuarios_firmas f LEFT JOIN usuarios u ON u.id = f.usuario_id WHERE f.usuario_id = ?`,
    [usuarioId]
  );
  return fila ? { ...fila, contratado: Number(fila.contratado) === 1 } : null;
};

// Los dos textos van al PDF: obligatorios, en NFC y sin caracteres que Helvetica no puede escribir
export const validarTextosFirma = (entrada) => {
  const errores = [];
  const datos = {};
  for (const { campo, maximo, etiqueta } of TEXTOS) {
    const valor = entrada?.[campo];
    const texto = typeof valor === 'string' ? valor.normalize('NFC').trim() : '';
    const noEscribibles = caracteresNoEscribibles(texto);
    if (!texto) errores.push({ campo, error: `${etiqueta} es obligatorio` });
    else if (texto.length > maximo) errores.push({ campo, error: `${etiqueta} admite hasta ${maximo} caracteres` });
    else if (noEscribibles.length) errores.push({ campo, error: `${etiqueta} tiene caracteres que el PDF no puede escribir: ${noEscribibles.join(' ')}` });
    else datos[campo] = texto;
  }
  return { errores, datos };
};

// Guarda la firma propia. imagen null conserva la que ya estaba guardada.
export const guardarFirma = async (usuarioId, { nombre, cargo, imagen = null, mime = null }) => {
  await pool.query(
    `INSERT INTO usuarios_firmas (usuario_id, nombre, cargo, imagen, mime) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), cargo = VALUES(cargo),
       imagen = COALESCE(VALUES(imagen), imagen), mime = COALESCE(VALUES(mime), mime)`,
    [usuarioId, nombre, cargo, imagen, imagen ? mime : null]
  );
};
