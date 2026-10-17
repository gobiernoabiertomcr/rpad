import pool from '../config/database.js';
import { crearCambioPendiente, datasetTieneCambiosPendientes } from './cambiosPendientesController.js';
import { esFechaIso, formatoCorto, hoyArgentina } from '../services/notasDigitalesCalendario.js';
import {
  TIPOS_PEDIDO, esFinDeMes, estadoDelDataset, opcionesDeProxima, pedido as pedidoDe, tipoEfectivo, topeDatosAl
} from '../services/fechasDatasetReglas.js';

// Respuesta cuando el dataset ya tiene un cambio pendiente de aprobación
const responderBloqueado = (res, accion) => res.status(409).json({
  success: false,
  error: `Este dataset tiene cambios pendientes de aprobación. No se puede ${accion} hasta que sean revisados.`
});

/**
 * Funcion auxiliar: Normalizar valor para comparacion
 * Maneja fechas, nulls y strings de forma consistente
 */
const normalizarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '';
  }
  
  // Si es un objeto Date, convertir a YYYY-MM-DD
  if (valor instanceof Date) {
    return valor.toISOString().split('T')[0];
  }
  
  // Si es string que parece fecha ISO (viene de la BD), extraer solo la parte de fecha
  if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}(T|$)/)) {
    return valor.split('T')[0];
  }
  
  return String(valor);
};

// Texto opcional: sin espacios en los extremos; vacío o en blanco queda en NULL
const normalizarTextoOpcional = (valor) => {
  if (valor === null || valor === undefined) return null;
  return valor.trim() || null;
};

// El texto opcional puede faltar, venir null o ser un string (cualquier otro tipo es un error del cliente)
const esTextoOpcionalValido = (valor) => valor === undefined || valor === null || typeof valor === 'string';

// Tope de los textos largos del dataset: se rechaza al proponer, con un mensaje claro, en lugar de fallar al aprobar.
// "Qué se solicita" se guarda sin los espacios de los extremos, así que se cuenta sin ellos.
const LARGO_MAXIMO_TEXTO = 4000;
const TEXTOS_LARGOS = [
  ['que_se_solicita', 'Qué se solicita', (valor) => valor.trim()],
  ['observaciones', 'Observaciones', (valor) => valor]
];
// El primer texto largo que se pasa del tope, como mensaje de error; null si están todos bien
const textoDemasiadoLargo = (data) => {
  for (const [campo, etiqueta, comoSeGuarda] of TEXTOS_LARGOS) {
    if (typeof data[campo] !== 'string') continue;
    const caracteres = [...comoSeGuarda(data[campo])].length;
    if (caracteres > LARGO_MAXIMO_TEXTO) {
      return `${etiqueta} no puede tener más de ${LARGO_MAXIMO_TEXTO} caracteres (tiene ${caracteres})`;
    }
  }
  return null;
};

/**
 * Funcion auxiliar: Comparar dos objetos para detectar si hay cambios reales
 * Retorna true si hay al menos un cambio
 */
const hayCambiosReales = (antes, despues) => {
  const camposComparar = [
    'titulo', 'descripcion', 'area_id', 'frecuencia_id',
    'tema_principal_id', 'tema_secundario_id', 'tipo_gestion',
    'ultima_actualizacion', 'datos_al', 'proxima_actualizacion', 'url_dataset', 'observaciones', 'que_se_solicita',
    'tipo_pedido'
  ];

  // Comparar campos simples
  for (const campo of camposComparar) {
    const valorAntes = normalizarValor(antes[campo]);
    const valorDespues = normalizarValor(despues[campo]);
    if (valorAntes !== valorDespues) {
      return true;
    }
  }

  // Comparar formatos (arrays)
  const formatosAntes = new Set(antes.formatos || []);
  const formatosDespues = new Set(despues.formatos || []);
  
  if (formatosAntes.size !== formatosDespues.size) {
    return true;
  }
  
  for (const f of formatosAntes) {
    if (!formatosDespues.has(f)) {
      return true;
    }
  }

  return false;
};

// =====================================================
// Fechas y tipo de pedido al escribir (spec 2026-10-17-fechas-datasets, secciones 2 y 10.1)
// =====================================================
const ETIQUETAS_DE_FECHA = {
  ultima_actualizacion: 'La fecha de carga en el portal',
  datos_al: 'Datos al',
  recibido_el: 'La fecha de recepción',
  proxima_actualizacion: 'La próxima actualización'
};
const ERROR_TIPO_PEDIDO = 'El tipo de pedido no es válido';
const ERROR_PROXIMA_FIN_DE_MES = 'La próxima actualización tiene que ser el último día de un mes (febrero, el 28)';
const ERROR_DATOS_AL_FIN_DE_MES = 'Datos al tiene que ser el último día de un mes (febrero, el 28)';
const ERROR_DATOS_AL_EJERCICIO = 'En un presupuesto, Datos al tiene que ser el 31/12 del ejercicio publicado';
const ERROR_EVENTUAL_SIN_TIPO = 'Con la frecuencia Eventual, el tipo de pedido tiene que ser Eventual';
const ERROR_TIPO_EVENTUAL = 'El tipo de pedido Eventual va solo con la frecuencia Eventual';
const ERROR_EVENTUAL_CON_PROXIMA = 'Con la frecuencia Eventual, la próxima actualización tiene que ir vacía';
const ERROR_FALTA_PROXIMA = 'Falta la próxima actualización: es obligatoria salvo con la frecuencia Eventual';
const ERROR_FALTA_DATOS_AL = 'Falta Datos al: la fecha a la que son los datos que llegaron';
const errorDatosAlFuturo = (datosAl) => `Todavía no puede haber datos al ${formatoCorto(datosAl)}`;

const vacio = (valor) => valor === undefined || valor === null || valor === '';
// La frecuencia Eventual es la que no tiene meses (frecuencias.meses NULL)
const esFrecuenciaEventual = (meses) => !(Number.isInteger(meses) && meses > 0);

// null si es una fecha 'AAAA-MM-DD' válida; si no, el error con el nombre del campo
const errorDeFecha = (campo, valor) =>
  (esFechaIso(valor) ? null : `${ETIQUETAS_DE_FECHA[campo]} tiene que ser una fecha válida (AAAA-MM-DD)`);
// Una fecha que no puede ser posterior a hoy: la carga en el portal y la recepción
const errorDeFechaPasada = (campo, valor, hoy) => errorDeFecha(campo, valor)
  ?? (valor > hoy ? `${ETIQUETAS_DE_FECHA[campo]} no puede ser posterior a hoy (${formatoCorto(hoy)})` : null);
// R1: la próxima es siempre el último día de un mes, con febrero en 28
const errorDeProxima = (proxima) => errorDeFecha('proxima_actualizacion', proxima)
  ?? (esFinDeMes(proxima) ? null : ERROR_PROXIMA_FIN_DE_MES);
// R5: Datos al es fin de mes y no pasa del tope (topeDatosAl). En un presupuesto es el 31/12 del ejercicio publicado: si
// no, el pedido y lo que cubre no coincidirían
const errorDeDatosAl = (datosAl, tipo, hoy) => errorDeFecha('datos_al', datosAl)
  ?? (esFinDeMes(datosAl) ? null : ERROR_DATOS_AL_FIN_DE_MES)
  ?? (tipo === 'ejercicio' && !datosAl.endsWith('-12-31') ? ERROR_DATOS_AL_EJERCICIO : null)
  ?? (datosAl > topeDatosAl(tipo, hoy) ? errorDatosAlFuturo(datosAl) : null);

/**
 * Lo que validan POST y PUT /datasets de las fechas y el tipo de pedido (spec 10.1), solo sobre lo que cambia (sección 4):
 * un dataset viejo con una fecha mala se edita sin tocarla. La próxima no es obligatoria acá (la exige el formulario).
 * - cambia(campo): si el campo llega en el pedido y es distinto del guardado (en un alta, si llega).
 * - final: el dataset como quedaría, { frecuencia_meses, tipo_pedido, tipo_gestion, ultima_actualizacion, datos_al,
 *   proxima_actualizacion }: lo que llega o, si no llega, lo guardado.
 * La coherencia de Eventual (frecuencia Eventual ⇔ tipo eventual) se mira sobre el tipo efectivo del estado final, si
 * cambia la frecuencia o el tipo. Devuelve el primer error, o null.
 */
const errorDeFechasDelDataset = ({ cambia, final, hoy }) => {
  if (cambia('tipo_pedido') && !vacio(final.tipo_pedido) && !TIPOS_PEDIDO.includes(final.tipo_pedido)) return ERROR_TIPO_PEDIDO;
  for (const campo of ['ultima_actualizacion', 'datos_al', 'proxima_actualizacion']) {
    if (cambia(campo) && !vacio(final[campo]) && errorDeFecha(campo, final[campo])) return errorDeFecha(campo, final[campo]);
  }

  const eventual = esFrecuenciaEventual(final.frecuencia_meses);
  const tipo = tipoEfectivo({ tipo_pedido: final.tipo_pedido || null, tipo_gestion: final.tipo_gestion, meses: final.frecuencia_meses });
  if (cambia('frecuencia_id') || cambia('tipo_pedido')) {
    if (eventual && tipo !== 'eventual') return ERROR_EVENTUAL_SIN_TIPO;
    if (!eventual && tipo === 'eventual') return ERROR_TIPO_EVENTUAL;
  }
  if (eventual && (cambia('frecuencia_id') || cambia('proxima_actualizacion')) && !vacio(final.proxima_actualizacion)) {
    return ERROR_EVENTUAL_CON_PROXIMA;
  }

  if (cambia('proxima_actualizacion') && !vacio(final.proxima_actualizacion)) {
    const error = errorDeProxima(final.proxima_actualizacion);
    if (error) return error;
  }
  if (cambia('datos_al') && !vacio(final.datos_al)) {
    const error = errorDeDatosAl(final.datos_al, tipo, hoy);
    if (error) return error;
  }
  if (cambia('ultima_actualizacion') && !vacio(final.ultima_actualizacion)) {
    return errorDeFechaPasada('ultima_actualizacion', final.ultima_actualizacion, hoy);
  }
  return null;
};

/**
 * Lo que valida POST /datasets/:id/actualizar (spec 10.1): lo mismo que una edición, más la próxima obligatoria salvo en
 * Eventual (donde va vacía), Datos al obligatorio y la recepción no posterior a la carga. cargado ya trae hoy si no vino.
 * Devuelve el primer error, o null.
 */
const errorDelRegistro = ({ datosAl, cargado, recibido, proxima, tipo, eventual, hoy }) => {
  if (vacio(datosAl)) return ERROR_FALTA_DATOS_AL;
  const error = errorDeDatosAl(datosAl, tipo, hoy) ?? errorDeFechaPasada('ultima_actualizacion', cargado, hoy);
  if (error) return error;
  if (!vacio(recibido)) {
    const errorDeRecibido = errorDeFechaPasada('recibido_el', recibido, hoy);
    if (errorDeRecibido) return errorDeRecibido;
    if (recibido > cargado) {
      return `La fecha de recepción (${formatoCorto(recibido)}) no puede ser posterior a la de carga en el portal (${formatoCorto(cargado)})`;
    }
  }
  if (eventual) return vacio(proxima) ? null : ERROR_EVENTUAL_CON_PROXIMA;
  return vacio(proxima) ? ERROR_FALTA_PROXIMA : errorDeProxima(proxima);
};

// La frecuencia en meses (null si es Eventual), o undefined si la frecuencia no existe
const mesesDeLaFrecuencia = async (frecuenciaId) => {
  const [filas] = await pool.execute('SELECT meses FROM frecuencias WHERE id = ?', [frecuenciaId]);
  return filas.length === 0 ? undefined : filas[0].meses;
};

// Query base para obtener datasets con datos relacionados
const DATASET_SELECT_QUERY = `
  SELECT 
    d.*,
    f.nombre AS frecuencia_nombre,
    f.dias AS frecuencia_dias,
    f.meses AS frecuencia_meses,
    DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS proxima_iso,
    DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al_iso,
    tp.nombre AS tema_principal_nombre,
    ts.nombre AS tema_secundario_nombre,
    a.nombre AS area_nombre,
    a.area_superior AS area_superior,
    a.email_principal AS area_email_principal,
    a.email_secundario AS area_email_secundario,
    a.telefono_area AS area_telefono,
    a.celular_area AS area_celular,
    a.nombre_contacto AS area_contacto_nombre,
    a.telefono_contacto AS area_contacto_telefono,
    a.email_contacto AS area_contacto_email,
    GROUP_CONCAT(DISTINCT fmt.nombre ORDER BY fmt.nombre SEPARATOR ', ') AS formatos
  FROM datasets d
  LEFT JOIN frecuencias f ON d.frecuencia_id = f.id
  LEFT JOIN temas tp ON d.tema_principal_id = tp.id
  LEFT JOIN temas ts ON d.tema_secundario_id = ts.id
  LEFT JOIN areas a ON d.area_id = a.id
  LEFT JOIN dataset_formatos df ON d.id = df.dataset_id
  LEFT JOIN formatos fmt ON df.formato_id = fmt.id
  WHERE d.activo = TRUE
`;

// Función auxiliar para calcular estado
// Ahora considera tipo_gestion para diferenciar 'atrasado' de 'sin-respuesta'
function calcularEstado(proximaActualizacion, frecuenciaDias, tipoGestion = 'externa') {
  // Si es frecuencia eventual (sin días definidos), siempre está actualizado
  if (frecuenciaDias === null) {
    return 'actualizado';
  }

  if (!proximaActualizacion) {
    return 'sin-fecha';
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const proxima = new Date(proximaActualizacion);
  proxima.setHours(0, 0, 0, 0);
  
  const diffDias = Math.floor((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    // Dataset vencido: diferenciar según tipo de gestión
    return tipoGestion === 'interna' ? 'atrasado' : 'sin-respuesta';
  }
  if (diffDias <= 60) return 'proximo';
  return 'actualizado';
}

/**
 * Suma a la fila de un dataset lo que calculan las reglas de las fechas (spec 2026-10-17-fechas-datasets, 10.1): Datos al,
 * el tipo de pedido (efectivo y guardado), la frecuencia en meses, el pedido y el estado. Las fechas nuevas viajan como
 * 'AAAA-MM-DD' (DATE_FORMAT en el SELECT) y las reglas leen la próxima de esa misma columna; proxima_actualizacion y
 * ultima_actualizacion siguen como vienen de d.*. Un dataset con una fecha mala o sin fecha da pedido null, nunca falla;
 * un Datos al que no es una fecha (por ejemplo '0000-00-00') sale null. hoy es la fecha de Argentina ('AAAA-MM-DD').
 */
const enriquecer = (fila, hoy) => {
  const { proxima_iso: proxima, datos_al_iso: datosAlGuardado, ...resto } = fila;
  const datosAl = esFechaIso(datosAlGuardado) ? datosAlGuardado : null;
  const meses = fila.frecuencia_meses ?? null;
  const tipo = tipoEfectivo({ tipo_pedido: fila.tipo_pedido, tipo_gestion: fila.tipo_gestion, meses });
  const { estado, dias } = estadoDelDataset({ proxima, meses, tipoGestion: fila.tipo_gestion, hoy });
  return {
    ...resto,
    datos_al: datosAl,
    tipo_pedido: tipo,
    tipo_pedido_guardado: fila.tipo_pedido,
    frecuencia_meses: meses,
    pedido: pedidoDe({ vencimiento: proxima, tipo, datosAl, meses, hoy }),
    estado,
    dias_para_vencer: dias
  };
};

// Obtener todos los datasets
export const getDatasets = async (req, res) => {
  try {
    const { tema, frecuencia, estado, busqueda } = req.query;

    let query = DATASET_SELECT_QUERY;
    const params = [];

    // Filtro por tema
    if (tema && tema !== 'todos') {
      query += ' AND tp.nombre = ?';
      params.push(tema);
    }

    // Filtro por frecuencia
    if (frecuencia && frecuencia !== 'todas') {
      query += ' AND f.nombre = ?';
      params.push(frecuencia);
    }

    // Filtro por búsqueda
    if (busqueda) {
      query += ' AND (d.titulo LIKE ? OR a.nombre LIKE ? OR d.descripcion LIKE ?)';
      const searchTerm = `%${busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' GROUP BY d.id ORDER BY d.proxima_actualizacion ASC, d.titulo ASC';

    const [rows] = await pool.execute(query, params);
    let datasets = rows;

    // Filtro por estado (se hace en memoria porque depende de la fecha actual)
    if (estado && estado !== 'todos') {
      datasets = datasets.filter(d => {
        const estadoDataset = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
        return estadoDataset === estado;
      });
    }

    const hoy = hoyArgentina();
    res.json({
      success: true,
      data: datasets.map(d => enriquecer(d, hoy))
    });
  } catch (error) {
    console.error('Error obteniendo datasets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datasets'
    });
  }
};

// Obtener un dataset por ID
export const getDatasetById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      DATASET_SELECT_QUERY + ' AND d.id = ? GROUP BY d.id',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    const dataset = enriquecer(rows[0], hoyArgentina());

    // Obtener formatos como array de objetos (para edición)
    const [formatosRows] = await pool.execute(
      `SELECT f.id, f.nombre 
       FROM dataset_formatos df
       JOIN formatos f ON df.formato_id = f.id
       WHERE df.dataset_id = ?
       ORDER BY f.nombre`,
      [id]
    );
    
    dataset.formatos_array = formatosRows;

    res.json({
      success: true,
      data: dataset
    });
  } catch (error) {
    console.error('Error obteniendo dataset:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el dataset'
    });
  }
};

// Parámetro opcional de la URL: ausente o vacío es null; cualquier otra cosa se devuelve tal cual para validarla
const parametroOpcional = (valor) => (valor === undefined || valor === '' ? null : valor);

// La frecuencia en meses de la URL: null si falta o viene vacía, NaN si no es un número entero positivo
const mesesDeLaUrl = (valor) => {
  const texto = parametroOpcional(valor);
  if (texto === null) return null;
  return typeof texto === 'string' && /^\d{1,4}$/.test(texto) && Number(texto) > 0 ? Number(texto) : NaN;
};

const responderInvalido = (res, error) => res.status(400).json({ success: false, error });

/**
 * Qué datos pide la nota para un tipo de pedido, una frecuencia en meses y una próxima (spec 10.2). No guarda nada: es
 * la vista previa del formulario y sirve también para un alta, que todavía no tiene id. Meses, próxima y datos_al
 * pueden faltar (vacío es null); sin próxima, o con un tipo que no pide período, el pedido da null.
 */
export const getCalculoPedido = (req, res) => {
  const { tipo } = req.query;
  if (!TIPOS_PEDIDO.includes(tipo)) return responderInvalido(res, 'El tipo de pedido no es válido');

  const meses = mesesDeLaUrl(req.query.meses);
  if (Number.isNaN(meses)) return responderInvalido(res, 'La frecuencia en meses tiene que ser un número entero positivo');

  const vencimiento = parametroOpcional(req.query.proxima);
  if (vencimiento !== null && !esFechaIso(vencimiento)) {
    return responderInvalido(res, 'La próxima actualización tiene que ser una fecha válida (AAAA-MM-DD)');
  }
  const datosAl = parametroOpcional(req.query.datos_al);
  if (datosAl !== null && !esFechaIso(datosAl)) {
    return responderInvalido(res, 'Datos al tiene que ser una fecha válida (AAAA-MM-DD)');
  }

  res.json({
    success: true,
    data: { pedido: pedidoDe({ vencimiento, tipo, datosAl, meses, hoy: hoyArgentina() }) }
  });
};

/**
 * Las próximas que se pueden elegir al registrar una actualización de este dataset con datos al datos_al (spec 10.2):
 * { pedido, opciones }. El pedido es el del vencimiento actual, con los datos que el dataset ya tiene publicados.
 */
export const getOpcionesProxima = async (req, res) => {
  try {
    const [filas] = await pool.execute(DATASET_SELECT_QUERY + ' AND d.id = ? GROUP BY d.id', [req.params.id]);
    if (filas.length === 0) {
      return res.status(404).json({ success: false, error: 'Dataset no encontrado' });
    }

    // Datos al, con las mismas reglas que al registrar la actualización (fin de mes, el 31/12 en un presupuesto y el
    // tope). El tope importa también acá: con datos de un futuro lejano la lista recorrería años de ciclos
    const datosNuevo = req.query.datos_al;
    const hoy = hoyArgentina();
    const dataset = enriquecer(filas[0], hoy);
    const errorDeDatos = errorDeDatosAl(datosNuevo, dataset.tipo_pedido, hoy);
    if (errorDeDatos) return responderInvalido(res, errorDeDatos);

    res.json({
      success: true,
      data: {
        pedido: dataset.pedido,
        opciones: opcionesDeProxima({
          vencimiento: filas[0].proxima_iso, tipo: dataset.tipo_pedido, meses: dataset.frecuencia_meses, datosNuevo, hoy
        })
      }
    });
  } catch (error) {
    console.error('Error calculando las opciones de la próxima actualización:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular las opciones de la próxima actualización'
    });
  }
};

// Crear nuevo dataset (crea cambio pendiente para aprobación)
export const createDataset = async (req, res) => {
  try {
    const data = req.body;
    const usuarioId = req.user?.userId;

    // Validaciones básicas
    if (!data.titulo || !data.area_id || !data.frecuencia_id || 
        !data.formatos || !Array.isArray(data.formatos) || data.formatos.length === 0 ||
        !data.tema_principal_id || !data.tipo_gestion) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: titulo, area_id, frecuencia_id, formatos (array con al menos 1), tema_principal_id, tipo_gestion'
      });
    }

    // Validar que tipo_gestion sea válido
    if (!['interna', 'externa'].includes(data.tipo_gestion)) {
      return res.status(400).json({
        success: false,
        error: 'tipo_gestion debe ser "interna" o "externa"'
      });
    }

    if (!esTextoOpcionalValido(data.que_se_solicita)) {
      return res.status(400).json({
        success: false,
        error: 'que_se_solicita debe ser un texto'
      });
    }

    const largoAlta = textoDemasiadoLargo(data);
    if (largoAlta) {
      return res.status(400).json({ success: false, error: largoAlta });
    }

    // Fechas y tipo de pedido (spec 2026-10-17-fechas-datasets, 10.1): en un alta cambia todo lo que llega, y la
    // coherencia de Eventual se mira siempre
    const frecuenciaMeses = await mesesDeLaFrecuencia(data.frecuencia_id);
    if (frecuenciaMeses === undefined) return responderInvalido(res, 'La frecuencia no es válida');
    const errorDeFechas = errorDeFechasDelDataset({
      cambia: (campo) => ['frecuencia_id', 'tipo_pedido'].includes(campo) || data[campo] !== undefined,
      final: { ...data, frecuencia_meses: frecuenciaMeses },
      hoy: hoyArgentina()
    });
    if (errorDeFechas) return responderInvalido(res, errorDeFechas);

    // Extraer IDs de formatos (pueden venir como objetos o números)
    const formatoIds = data.formatos.map(f => typeof f === 'object' ? f.id : f);
    
    // Validar que los formatos existan
    const [formatosExistentes] = await pool.execute(
      `SELECT id FROM formatos WHERE id IN (${formatoIds.map(() => '?').join(',')}) AND activo = 1`,
      formatoIds
    );
    
    if (formatosExistentes.length !== formatoIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Uno o más formatos no son válidos'
      });
    }

    // Preparar datos para el cambio pendiente
    const datosNuevos = {
      titulo: data.titulo,
      descripcion: data.descripcion || null,
      area_id: data.area_id,
      frecuencia_id: data.frecuencia_id,
      ultima_actualizacion: data.ultima_actualizacion || null,
      datos_al: data.datos_al || null,
      proxima_actualizacion: data.proxima_actualizacion || null,
      tema_principal_id: data.tema_principal_id,
      tema_secundario_id: data.tema_secundario_id || null,
      url_dataset: data.url_dataset || null,
      observaciones: data.observaciones || null,
      que_se_solicita: normalizarTextoOpcional(data.que_se_solicita),
      tipo_pedido: data.tipo_pedido || null,
      tipo_gestion: data.tipo_gestion,
      formatos: formatoIds
    };

    // Crear cambio pendiente (dataset_id es null porque aún no existe)
    const cambioId = await crearCambioPendiente('crear', null, datosNuevos, null, usuarioId);

    res.status(201).json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de creación enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de dataset:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud'
    });
  }
};

// Actualizar dataset (crea cambio pendiente para aprobación)
export const updateDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const usuarioId = req.user?.userId;

    // Verificar que el dataset existe. Datos al se lee como 'AAAA-MM-DD' (como en GET /datasets)
    const [existing] = await pool.execute(
      `SELECT d.*, DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al_iso, f.meses AS frecuencia_meses
       FROM datasets d LEFT JOIN frecuencias f ON f.id = d.frecuencia_id
       WHERE d.id = ? AND d.activo = TRUE`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'editar');
    }

    // Validar tipo_gestion si se proporciona
    if (data.tipo_gestion !== undefined && !['interna', 'externa'].includes(data.tipo_gestion)) {
      return res.status(400).json({
        success: false,
        error: 'tipo_gestion debe ser "interna" o "externa"'
      });
    }

    if (!esTextoOpcionalValido(data.que_se_solicita)) {
      return res.status(400).json({
        success: false,
        error: 'que_se_solicita debe ser un texto'
      });
    }

    const largoEdicion = textoDemasiadoLargo(data);
    if (largoEdicion) {
      return res.status(400).json({ success: false, error: largoEdicion });
    }

    // Validar formatos si se proporcionan
    let formatoIds = null;
    if (data.formatos !== undefined) {
      if (!Array.isArray(data.formatos) || data.formatos.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'formatos debe ser un array con al menos 1 elemento'
        });
      }
      
      formatoIds = data.formatos.map(f => typeof f === 'object' ? f.id : f);
      
      // Validar que los formatos existan
      const [formatosExistentes] = await pool.execute(
        `SELECT id FROM formatos WHERE id IN (${formatoIds.map(() => '?').join(',')}) AND activo = 1`,
        formatoIds
      );
      
      if (formatosExistentes.length !== formatoIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Uno o más formatos no son válidos'
        });
      }
    }

    // Obtener datos actuales del dataset para guardar como "datos_anteriores"
    const datasetActual = existing[0];
    // Un Datos al que no es una fecha (por ejemplo, 0000-00-00) cuenta como sin dato, como en GET /datasets
    const datosAlGuardado = esFechaIso(datasetActual.datos_al_iso) ? datasetActual.datos_al_iso : null;

    // Fechas y tipo de pedido (spec 2026-10-17-fechas-datasets, 10.1): solo lo que llega y cambia; el estado final es lo
    // que llega o, si no llega, lo guardado
    const guardado = { ...datasetActual, datos_al: datosAlGuardado };
    const cambia = (campo) => data[campo] !== undefined && normalizarValor(data[campo]) !== normalizarValor(guardado[campo]);
    const final = (campo) => (data[campo] !== undefined ? data[campo] : guardado[campo]);
    if (['frecuencia_id', 'tipo_pedido', 'datos_al', 'proxima_actualizacion', 'ultima_actualizacion'].some(cambia)) {
      const frecuenciaMeses = cambia('frecuencia_id') ? await mesesDeLaFrecuencia(data.frecuencia_id) : datasetActual.frecuencia_meses;
      if (frecuenciaMeses === undefined) return responderInvalido(res, 'La frecuencia no es válida');
      const errorDeFechas = errorDeFechasDelDataset({
        cambia,
        final: {
          frecuencia_meses: frecuenciaMeses,
          tipo_pedido: final('tipo_pedido'),
          tipo_gestion: final('tipo_gestion'),
          ultima_actualizacion: final('ultima_actualizacion'),
          datos_al: final('datos_al'),
          proxima_actualizacion: final('proxima_actualizacion')
        },
        hoy: hoyArgentina()
      });
      if (errorDeFechas) return responderInvalido(res, errorDeFechas);
    }

    // Obtener formatos actuales
    const [formatosActuales] = await pool.execute(
      'SELECT formato_id FROM dataset_formatos WHERE dataset_id = ?',
      [id]
    );

    const datosAnteriores = {
      titulo: datasetActual.titulo,
      descripcion: datasetActual.descripcion,
      area_id: datasetActual.area_id,
      frecuencia_id: datasetActual.frecuencia_id,
      ultima_actualizacion: datasetActual.ultima_actualizacion,
      datos_al: datosAlGuardado,
      proxima_actualizacion: datasetActual.proxima_actualizacion,
      tema_principal_id: datasetActual.tema_principal_id,
      tema_secundario_id: datasetActual.tema_secundario_id,
      url_dataset: datasetActual.url_dataset,
      observaciones: datasetActual.observaciones,
      que_se_solicita: datasetActual.que_se_solicita,
      tipo_pedido: datasetActual.tipo_pedido,
      tipo_gestion: datasetActual.tipo_gestion,
      formatos: formatosActuales.map(f => f.formato_id)
    };

    // Construir datos nuevos (merge de actuales con los cambios)
    const datosNuevos = {
      titulo: data.titulo !== undefined ? data.titulo : datasetActual.titulo,
      descripcion: data.descripcion !== undefined ? (data.descripcion || null) : datasetActual.descripcion,
      area_id: data.area_id !== undefined ? data.area_id : datasetActual.area_id,
      frecuencia_id: data.frecuencia_id !== undefined ? data.frecuencia_id : datasetActual.frecuencia_id,
      ultima_actualizacion: data.ultima_actualizacion !== undefined ? (data.ultima_actualizacion || null) : datasetActual.ultima_actualizacion,
      datos_al: data.datos_al !== undefined ? (data.datos_al || null) : datosAlGuardado,
      proxima_actualizacion: data.proxima_actualizacion !== undefined ? (data.proxima_actualizacion || null) : datasetActual.proxima_actualizacion,
      tema_principal_id: data.tema_principal_id !== undefined ? data.tema_principal_id : datasetActual.tema_principal_id,
      tema_secundario_id: data.tema_secundario_id !== undefined ? (data.tema_secundario_id || null) : datasetActual.tema_secundario_id,
      url_dataset: data.url_dataset !== undefined ? (data.url_dataset || null) : datasetActual.url_dataset,
      observaciones: data.observaciones !== undefined ? (data.observaciones || null) : datasetActual.observaciones,
      que_se_solicita: data.que_se_solicita !== undefined ? normalizarTextoOpcional(data.que_se_solicita) : datasetActual.que_se_solicita,
      tipo_pedido: data.tipo_pedido !== undefined ? (data.tipo_pedido || null) : datasetActual.tipo_pedido,
      tipo_gestion: data.tipo_gestion !== undefined ? data.tipo_gestion : datasetActual.tipo_gestion,
      formatos: formatoIds !== null ? formatoIds : formatosActuales.map(f => f.formato_id)
    };

    // Verificar si hay cambios reales
    if (!hayCambiosReales(datosAnteriores, datosNuevos)) {
      return res.status(400).json({
        success: false,
        error: 'No se detectaron cambios. El dataset no fue modificado.'
      });
    }

    // Crear cambio pendiente
    const cambioId = await crearCambioPendiente('editar', Number(id), datosNuevos, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'editar');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de edición enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de edición:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de edición'
    });
  }
};

// Eliminar dataset (crea cambio pendiente para aprobación)
export const deleteDataset = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.userId;

    // Verificar que el dataset existe
    const [existing] = await pool.execute(
      'SELECT * FROM datasets WHERE id = ? AND activo = TRUE',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'eliminar');
    }

    const datasetActual = existing[0];

    // Guardar datos actuales para el registro
    const datosAnteriores = {
      titulo: datasetActual.titulo,
      descripcion: datasetActual.descripcion,
      area_id: datasetActual.area_id,
      frecuencia_id: datasetActual.frecuencia_id,
      tipo_gestion: datasetActual.tipo_gestion
    };

    // Crear cambio pendiente de eliminación
    const cambioId = await crearCambioPendiente('eliminar', Number(id), { eliminado: true }, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'eliminar');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de eliminación enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de eliminación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de eliminación'
    });
  }
};

// Obtener estadísticas para el dashboard
export const getEstadisticas = async (req, res) => {
  try {
    const [datasets] = await pool.execute(DATASET_SELECT_QUERY + ' GROUP BY d.id');
    const data = datasets;

    const hoy = new Date();
    let actualizados = 0;
    let proximos = 0;
    let atrasados = 0;      // Gestión interna
    let sinRespuesta = 0;   // Gestión externa
    let totalDiasAtraso = 0;

    data.forEach(d => {
      const estado = calcularEstado(d.proxima_actualizacion, d.frecuencia_dias, d.tipo_gestion);
      if (estado === 'actualizado') actualizados++;
      else if (estado === 'proximo') proximos++;
      else if (estado === 'atrasado') {
        atrasados++;
        if (d.proxima_actualizacion) {
          const proxima = new Date(d.proxima_actualizacion);
          const diasAtraso = Math.floor((hoy.getTime() - proxima.getTime()) / (1000 * 60 * 60 * 24));
          totalDiasAtraso += diasAtraso;
        }
      } else if (estado === 'sin-respuesta') {
        sinRespuesta++;
        if (d.proxima_actualizacion) {
          const proxima = new Date(d.proxima_actualizacion);
          const diasAtraso = Math.floor((hoy.getTime() - proxima.getTime()) / (1000 * 60 * 60 * 24));
          totalDiasAtraso += diasAtraso;
        }
      }
    });

    // Total de vencidos (atrasados + sin respuesta)
    const totalVencidos = atrasados + sinRespuesta;

    // Datasets por tema
    const [porTema] = await pool.execute(`
      SELECT t.nombre AS tema, COUNT(*) AS cantidad
      FROM datasets d
      JOIN temas t ON d.tema_principal_id = t.id
      WHERE d.activo = TRUE
      GROUP BY t.nombre
      ORDER BY cantidad DESC
    `);

    // Datasets por frecuencia
    const [porFrecuencia] = await pool.execute(`
      SELECT f.nombre AS frecuencia, COUNT(*) AS cantidad
      FROM datasets d
      JOIN frecuencias f ON d.frecuencia_id = f.id
      WHERE d.activo = TRUE
      GROUP BY f.nombre
      ORDER BY f.orden ASC
    `);

    const estadisticas = {
      total: data.length,
      actualizados,
      proximos,
      atrasados,         // Solo gestión interna
      sinRespuesta,      // Solo gestión externa
      totalVencidos,     // Suma de ambos
      tasaActualizacion: data.length > 0 ? Math.round(((actualizados + proximos) / data.length) * 100) : 0,
      promedioAtraso: totalVencidos > 0 ? Math.round(totalDiasAtraso / totalVencidos) : 0,
      porTema,
      porFrecuencia
    };

    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las estadísticas'
    });
  }
};

/**
 * Registrar actualización de dataset (crea cambio pendiente para aprobación). Spec 2026-10-17-fechas-datasets, 10.1:
 * recibe { datos_al, cargado_el (o fecha_actualizacion, por compatibilidad; si falta, hoy), recibido_el?,
 * proxima_actualizacion, notas? } y respeta la próxima que eligió la persona: ya no la calcula con la frecuencia. Los
 * controles van en este orden: 404, 409 (bloqueado) y 400 (lo que llega). Al aprobarse, el cambio escribe el historial
 * (registro_actualizacion).
 */
export const registrarActualizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};
    const usuarioId = req.user?.userId;

    // Obtener el dataset y su frecuencia. Las fechas se leen también como 'AAAA-MM-DD' para validarlas
    const [datasetRows] = await pool.execute(
      `SELECT d.*, f.meses AS frecuencia_meses, DATE_FORMAT(d.datos_al, '%Y-%m-%d') AS datos_al_iso,
              DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') AS ultima_iso,
              DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') AS proxima_iso
       FROM datasets d
       JOIN frecuencias f ON d.frecuencia_id = f.id
       WHERE d.id = ? AND d.activo = TRUE`,
      [id]
    );

    if (datasetRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dataset no encontrado'
      });
    }

    // Verificar si el dataset tiene cambios pendientes (bloqueado)
    const bloqueado = await datasetTieneCambiosPendientes(id);
    if (bloqueado) {
      return responderBloqueado(res, 'marcar como actualizado');
    }

    const dataset = datasetRows[0];
    const hoy = hoyArgentina();
    const cargado = vacio(body.cargado_el) ? (vacio(body.fecha_actualizacion) ? hoy : body.fecha_actualizacion) : body.cargado_el;
    const { datos_al: datosAl, recibido_el: recibido, proxima_actualizacion: proxima, notas } = body;
    if (!esTextoOpcionalValido(notas)) return responderInvalido(res, 'Las notas tienen que ser un texto');

    const eventual = esFrecuenciaEventual(dataset.frecuencia_meses);
    const tipo = tipoEfectivo({ tipo_pedido: dataset.tipo_pedido, tipo_gestion: dataset.tipo_gestion, meses: dataset.frecuencia_meses });
    const error = errorDelRegistro({ datosAl, cargado, recibido, proxima, tipo, eventual, hoy });
    if (error) return responderInvalido(res, error);

    // Datos anteriores, como 'AAAA-MM-DD' (DATE_FORMAT): la próxima anterior es el vencimiento del historial, la clave
    // del ciclo, y no puede depender de la zona horaria del servidor (un Date de mysql2 se guarda en UTC). calcularCambios
    // compara por los primeros 10 caracteres, así que lee igual estas fechas que las de una edición. Una fecha en cero
    // (0000-00-00) no es una fecha: queda null
    const fechaGuardada = (iso) => (esFechaIso(iso) ? iso : null);
    const datosAnteriores = {
      ultima_actualizacion: fechaGuardada(dataset.ultima_iso),
      datos_al: fechaGuardada(dataset.datos_al_iso),
      proxima_actualizacion: fechaGuardada(dataset.proxima_iso)
    };

    // Datos nuevos: la marca registro_actualizacion hace que la aprobación escriba el historial
    const datosNuevos = {
      ultima_actualizacion: cargado,
      datos_al: datosAl,
      proxima_actualizacion: vacio(proxima) ? null : proxima,
      recibido_el: vacio(recibido) ? null : recibido,
      notas: notas || null,
      registro_actualizacion: true
    };

    // Crear cambio pendiente
    const cambioId = await crearCambioPendiente('editar', Number(id), datosNuevos, datosAnteriores, usuarioId);
    if (!cambioId) {
      return responderBloqueado(res, 'marcar como actualizado');
    }

    res.json({
      success: true,
      data: { cambio_pendiente_id: cambioId },
      message: 'Solicitud de actualización enviada. Pendiente de aprobación por otro administrador.'
    });
  } catch (error) {
    console.error('Error creando solicitud de actualización:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la solicitud de actualización'
    });
  }
};
