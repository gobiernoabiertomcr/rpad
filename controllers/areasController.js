import pool from '../config/database.js';
import { esAdmin } from '../services/usuariosReglas.js';
import {
  CAMPOS_DE_CONTACTO_AREA, MENSAJES_AREA, sinCampos, textoNoSePuedeBorrar, validarArea
} from '../services/areasReglas.js';

// Ámbito del área (spec 2026-10-24-generador-de-notas, sección 2): decide qué nota de la DGMIT le corresponde.
// 'municipal' → interna (por la Subsecretaría); 'externo' → fuera del municipio (directo al organismo).
export const AMBITOS = ['municipal', 'externo'];
export const MENSAJE_AMBITO = 'Elegí si el área es municipal o de fuera del municipio.';

// Si el ámbito llega (no es undefined), tiene que ser uno de AMBITOS, tal cual: nunca `|| null` (la columna es NOT NULL)
const ambitoInvalido = (ambito) => ambito !== undefined && !AMBITOS.includes(ambito);

const rechazoDeAmbito = (res) => res.status(400).json({
  success: false, error: MENSAJE_AMBITO, campo: 'ambito', errores: { ambito: MENSAJE_AMBITO }
});

// Las columnas que escribe la edición, además del ámbito: solo estas se interpolan en el UPDATE (nunca una clave del pedido)
const CAMPOS_DEL_AREA = [
  'nombre', 'articulo', 'area_superior', 'articulo_superior', 'email_principal', 'email_secundario',
  'telefono_area', 'celular_area', 'nombre_contacto', 'telefono_contacto', 'email_contacto'
];

// Un error con el campo al que corresponde (spec 2026-10-24-configuracion, 5.2): { success: false, error, campo }
const responderError = (res, status, error, campo) =>
  res.status(status).json({ success: false, error, ...(campo ? { campo } : {}) });

const noEncontrada = (res) => responderError(res, 404, MENSAJES_AREA.noEncontrada);
const nombreRepetido = (res) => responderError(res, 400, MENSAJES_AREA.nombreRepetido, 'nombre');

// El id de la ruta, o null si no es un entero positivo (entonces el área no existe: 404)
const idDeRuta = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Las cuentas de un área, como subconsultas sobre `a` (spec 2026-10-24-configuracion, 5.1 y 5.3)
const DATASETS_ACTIVOS = '(SELECT COUNT(*) FROM datasets d WHERE d.area_id = a.id AND d.activo = TRUE)';
const DATASETS_DADOS_DE_BAJA = '(SELECT COUNT(*) FROM datasets d WHERE d.area_id = a.id AND d.activo = FALSE)';
// Los que reciben el email de los 40 días: activos, de gestión externa, con «Requiere nota DGMIT» en Sí o sin dato y con una
// frecuencia que vence (la eventual no tiene días)
const DATASETS_EXTERNOS_CON_NOTA = `(SELECT COUNT(*) FROM datasets d JOIN frecuencias f ON f.id = d.frecuencia_id
  WHERE d.area_id = a.id AND d.activo = TRUE AND d.tipo_gestion = 'externa'
    AND (d.requiere_nota IS NULL OR d.requiere_nota = 1) AND f.dias IS NOT NULL)`;
// Los cambios pendientes que la eligen (altas y ediciones). El area_id de datos_nuevos puede estar guardado como número o como
// texto: JSON_VALUE da '12' en los dos casos (y NULL si no está o es null), y compararlo con a.id, un entero, es una comparación
// numérica, que no depende de colaciones (datos_nuevos es utf8mb4_bin y la conexión tiene la suya)
const CAMBIOS_PENDIENTES_QUE_LA_USAN = `(SELECT COUNT(*) FROM cambios_pendientes cp WHERE cp.estado = 'pendiente'
  AND JSON_VALUE(cp.datos_nuevos, '$.area_id') = a.id)`;

const SELECT_PUBLICO = `SELECT a.*, ${DATASETS_ACTIVOS} AS cantidad_datasets FROM areas a`;
const SELECT_DE_ADMINISTRACION = `SELECT a.*, ${DATASETS_ACTIVOS} AS cantidad_datasets,
  ${DATASETS_DADOS_DE_BAJA} AS datasets_dados_de_baja,
  ${DATASETS_EXTERNOS_CON_NOTA} AS datasets_externos_con_nota,
  ${CAMBIOS_PENDIENTES_QUE_LA_USAN} AS cambios_pendientes_que_la_usan
  FROM areas a`;

// Qué ve quien pide (spec 2026-10-24-configuracion, 5.1). Una sesión de administración (sesionOpcional + esAdmin): el área
// entera, las tres cuentas y `vista: 'administracion'`. El resto (sin sesión, el lector, el colaborador o una sesión que no
// vale): sin los datos de contacto ni las cuentas, y sin `vista`
const esAdministracion = (req) => esAdmin(req.user?.rol);
const selectPara = (administracion) => (administracion ? SELECT_DE_ADMINISTRACION : SELECT_PUBLICO);
const filaPara = (fila, administracion) => (administracion ? fila : sinCampos(fila, CAMPOS_DE_CONTACTO_AREA));
const respuestaPara = (data, administracion) => (
  administracion ? { success: true, data, vista: 'administracion' } : { success: true, data }
);

// Otra área con ese nombre: la colación no distingue mayúsculas ni tildes. En el alta, id 0 (ninguna)
const hayOtraConElNombre = async (nombre, id) => {
  const [filas] = await pool.execute('SELECT id FROM areas WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, id]);
  return filas.length > 0;
};

// Obtener todas las áreas (ordenadas alfabéticamente)
export const getAreas = async (req, res) => {
  const administracion = esAdministracion(req);
  try {
    const [rows] = await pool.execute(`${selectPara(administracion)} ORDER BY a.nombre ASC`);
    res.json(respuestaPara(rows.map((fila) => filaPara(fila, administracion)), administracion));
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
  const id = idDeRuta(req);
  if (!id) return noEncontrada(res);
  const administracion = esAdministracion(req);
  try {
    const [rows] = await pool.execute(`${selectPara(administracion)} WHERE a.id = ?`, [id]);
    if (rows.length === 0) return noEncontrada(res);
    res.json(respuestaPara(filaPara(rows[0], administracion), administracion));
  } catch (error) {
    console.error('Error obteniendo área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el área'
    });
  }
};

// Crear nueva área. Los controles, en este orden: los campos (validarArea), el ámbito y el nombre repetido
export const createArea = async (req, res) => {
  const entrada = req.body ?? {};
  const { datos, error } = validarArea(entrada);
  if (error) return responderError(res, 400, error.mensaje, error.campo);
  if (ambitoInvalido(entrada.ambito)) return rechazoDeAmbito(res);

  try {
    if (await hayOtraConElNombre(datos.nombre, 0)) return nombreRepetido(res);

    // Cada columna opcional que no vino va en NULL, no en el DEFAULT de la tabla (articulo_superior quedaría en 'la'): el alta
    // rápida de admin.js manda solo el nombre
    const [result] = await pool.execute(
      `INSERT INTO areas (
        nombre, articulo, area_superior, articulo_superior, ambito, email_principal, email_secundario,
        telefono_area, celular_area, nombre_contacto, telefono_contacto, email_contacto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.nombre,
        datos.articulo,
        datos.area_superior ?? null,
        datos.articulo_superior ?? null,
        entrada.ambito ?? 'municipal',
        datos.email_principal ?? null,
        datos.email_secundario ?? null,
        datos.telefono_area ?? null,
        datos.celular_area ?? null,
        datos.nombre_contacto ?? null,
        datos.telefono_contacto ?? null,
        datos.email_contacto ?? null
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
    // Dos altas simultáneas con el mismo nombre: la segunda choca con el índice único
    if (error.code === 'ER_DUP_ENTRY') return nombreRepetido(res);
    console.error('Error creando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear el área'
    });
  }
};

// Actualizar área. Los controles, en este orden: que exista, los campos (validarArea, contra la fila guardada), el ámbito y el
// nombre repetido. La edición es parcial: se escriben solo los campos que vinieron
export const updateArea = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return noEncontrada(res);
  const entrada = req.body ?? {};

  try {
    const [existentes] = await pool.execute('SELECT * FROM areas WHERE id = ?', [id]);
    if (existentes.length === 0) return noEncontrada(res);

    const { datos, error } = validarArea(entrada, existentes[0]);
    if (error) return responderError(res, 400, error.mensaje, error.campo);
    if (ambitoInvalido(entrada.ambito)) return rechazoDeAmbito(res);
    if (datos.nombre !== undefined && await hayOtraConElNombre(datos.nombre, id)) return nombreRepetido(res);

    // Los campos que vinieron, ya normalizados (un vacío es NULL); el ámbito, ya validado, tal cual (sin `|| null`)
    const campos = CAMPOS_DEL_AREA.filter((campo) => datos[campo] !== undefined);
    const valores = campos.map((campo) => datos[campo]);
    if (entrada.ambito !== undefined) {
      campos.push('ambito');
      valores.push(entrada.ambito);
    }

    if (campos.length === 0) return responderError(res, 400, 'No hay datos para actualizar');

    await pool.execute(
      `UPDATE areas SET ${campos.map((campo) => `${campo} = ?`).join(', ')} WHERE id = ?`,
      [...valores, id]
    );

    // Obtener el área actualizada
    const [rows] = await pool.execute(
      'SELECT * FROM areas WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return noEncontrada(res);

    res.json({
      success: true,
      data: rows[0],
      message: 'Área actualizada correctamente'
    });
  } catch (error) {
    // Dos guardados simultáneos con el mismo nombre: el segundo choca con el índice único
    if (error.code === 'ER_DUP_ENTRY') return nombreRepetido(res);
    console.error('Error actualizando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el área'
    });
  }
};

// Eliminar área (spec 2026-10-24-configuracion, 5.3): no se borra si tiene datasets (activos o dados de baja) o si un cambio
// pendiente la elige, porque aprobarlo chocaría con fk_datasets_area
export const deleteArea = async (req, res) => {
  const id = idDeRuta(req);
  if (!id) return noEncontrada(res);

  try {
    const [filas] = await pool.execute(
      `SELECT ${DATASETS_ACTIVOS} AS activos, ${DATASETS_DADOS_DE_BAJA} AS de_baja,
        ${CAMBIOS_PENDIENTES_QUE_LA_USAN} AS pendientes
       FROM areas a WHERE a.id = ?`,
      [id]
    );
    if (filas.length === 0) return noEncontrada(res);

    const { activos, de_baja: deBaja, pendientes } = filas[0];
    const motivo = textoNoSePuedeBorrar({ activos, deBaja, pendientes });
    if (motivo) return responderError(res, 400, motivo);

    const [result] = await pool.execute(
      'DELETE FROM areas WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) return noEncontrada(res);

    res.json({
      success: true,
      message: 'Área eliminada correctamente'
    });
  } catch (error) {
    // Una carrera: entre la cuenta y el DELETE alguien le sumó un dataset
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return responderError(res, 400, MENSAJES_AREA.enUso);
    console.error('Error eliminando área:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el área'
    });
  }
};
