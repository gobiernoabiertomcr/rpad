import pool from '../config/database.js';

// Ámbito del área (spec 2026-10-24-generador-de-notas, sección 2): decide qué nota de la DGMIT le corresponde.
// 'municipal' → interna (por la Subsecretaría); 'externo' → fuera del municipio (directo al organismo).
export const AMBITOS = ['municipal', 'externo'];
export const MENSAJE_AMBITO = 'Elegí si el área es municipal o de fuera del municipio.';

// Si el ámbito llega (no es undefined), tiene que ser uno de AMBITOS, tal cual: nunca `|| null` (la columna es NOT NULL)
const ambitoInvalido = (ambito) => ambito !== undefined && !AMBITOS.includes(ambito);

const rechazoDeAmbito = (res) => res.status(400).json({
  success: false, error: MENSAJE_AMBITO, campo: 'ambito', errores: { ambito: MENSAJE_AMBITO }
});

// Obtener todas las áreas (ordenadas alfabéticamente)
export const getAreas = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM datasets d WHERE d.area_id = a.id AND d.activo = TRUE) as cantidad_datasets
      FROM areas a 
      ORDER BY a.nombre ASC
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error obteniendo áreas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las áreas'
    });
  }
};

// Obtener un área por ID
export const getAreaById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      'SELECT * FROM areas WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Área no encontrada'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error obteniendo área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el área'
    });
  }
};

// Crear nueva área
export const createArea = async (req, res) => {
  try {
    const data = req.body;

    if (!data.nombre) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del área es obligatorio'
      });
    }

    if (ambitoInvalido(data.ambito)) return rechazoDeAmbito(res);

    // Verificar que no exista un área con el mismo nombre
    const [existing] = await pool.execute(
      'SELECT id FROM areas WHERE nombre = ?',
      [data.nombre]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un área con ese nombre'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO areas (
        nombre, articulo, area_superior, articulo_superior, ambito, email_principal, email_secundario,
        telefono_area, celular_area, nombre_contacto, telefono_contacto, email_contacto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nombre,
        data.articulo || 'la',
        data.area_superior || null,
        data.articulo_superior || null,
        data.ambito ?? 'municipal',
        data.email_principal || null,
        data.email_secundario || null,
        data.telefono_area || null,
        data.celular_area || null,
        data.nombre_contacto || null,
        data.telefono_contacto || null,
        data.email_contacto || null
      ]
    );

    // Obtener el área creada
    const [rows] = await pool.execute(
      'SELECT * FROM areas WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Área creada correctamente'
    });
  } catch (error) {
    console.error('Error creando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear el área'
    });
  }
};

// Actualizar área
export const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Verificar que el área existe
    const [existing] = await pool.execute(
      'SELECT id FROM areas WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Área no encontrada'
      });
    }

    if (ambitoInvalido(data.ambito)) return rechazoDeAmbito(res);

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (data.nombre) {
      const [duplicate] = await pool.execute(
        'SELECT id FROM areas WHERE nombre = ? AND id != ?',
        [data.nombre, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe otra área con ese nombre'
        });
      }
    }

    // Construir query dinámico
    const updates = [];
    const values = [];

    const fields = [
      'nombre', 'articulo', 'area_superior', 'articulo_superior', 'email_principal', 'email_secundario',
      'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto', 'email_contacto'
    ];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field] || null);
      }
    });

    // El ámbito, ya validado, se escribe tal cual (sin `|| null`)
    if (data.ambito !== undefined) {
      updates.push('ambito = ?');
      values.push(data.ambito);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay datos para actualizar'
      });
    }

    values.push(Number(id));

    await pool.execute(
      `UPDATE areas SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Obtener el área actualizada
    const [rows] = await pool.execute(
      'SELECT * FROM areas WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: rows[0],
      message: 'Área actualizada correctamente'
    });
  } catch (error) {
    console.error('Error actualizando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el área'
    });
  }
};

// Eliminar área
export const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si tiene datasets asociados
    const [datasets] = await pool.execute(
      'SELECT COUNT(*) as count FROM datasets WHERE area_id = ? AND activo = TRUE',
      [id]
    );

    if (datasets[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar el área porque tiene ${datasets[0].count} dataset(s) asociado(s)`
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM areas WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Área no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Área eliminada correctamente'
    });
  } catch (error) {
    console.error('Error eliminando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el área'
    });
  }
};
