// Seguimiento del dataset: las consultas (solo lectura). De la base a `Fuentes`, la entrada de seguimientoReglas.js
// (spec 2026-10-20-seguimiento-dataset-design). Trae lo que hay, tal cual: no filtra por `activo`, no cambia nombres ni
// correos y no decide nada; las reglas están en seguimientoReglas.js (puro) y se pueden probar sin base.
//
// Fuentes = { dataset, altasSinDataset, cambios, historial, emails, notas, auditorias, notasDgmit, catalogos }; la forma exacta
// es la de CASOS[id] de tests/seguimiento-casos.js más `catalogos`.
//
// notasDgmit (spec 2026-10-24-notas-dgmit, 5): las notas que la DGMIT le mandó al área, cargadas a mano, todas (también las
// anuladas). Su consulta va aislada (notasDgmitDe): fuentesDe también arma el anexo de la reiteración, y si falla (por ejemplo,
// sin la migración) cada dataset queda con notasDgmit vacía y el resto de las fuentes sale como siempre.
//
// Fechas y momentos (la base no usa `dateStrings` ni `timezone`: sin esto, DATE y TIMESTAMP volverían como Date):
// - DATE → `DATE_FORMAT(col, '%Y-%m-%d')`: 'AAAA-MM-DD'.
// - TIMESTAMP → `UNIX_TIMESTAMP(col)` y `ahoraArgentina(...)`: 'AAAA-MM-DD HH:MM:SS' en hora argentina, sea cual sea la zona
//   de la sesión de la base (en Docker y en el servidor puede ser UTC).
// - DATETIME de `notas_digitales.enviada_at` → `DATE_FORMAT(col, '%Y-%m-%d %H:%i:%s')`, sin convertir: la aplicación ya lo
//   escribe en hora argentina.
import pool from '../config/database.js';
import { ahoraArgentina } from './notasDigitalesCalendario.js';
import { catalogosParaAuditoria } from './auditoriaService.js';

// Un `crear` aprobado queda con dataset_id NULL (aprobarCambio crea el dataset sin escribir el id en el cambio). Se lo une al
// dataset por la hora: la aprobación y el alta ocurren en la misma transacción, con segundos de diferencia.
const SEGUNDOS_DE_UNION_DEL_ALTA = 5;

const momento = (ts) => (ts == null ? null : ahoraArgentina(new Date(Number(ts) * 1000)));

// datos_nuevos y datos_anteriores son LONGTEXT con JSON: según el driver vuelven como texto o ya como objeto. Siempre objeto
// (o null): las reglas no saben leer texto, y un ciclo con los datos en texto se perdería sin avisar.
const leerJson = (valor) => {
  if (valor == null) return null;
  const texto = Buffer.isBuffer(valor) ? valor.toString('utf8') : valor;
  return typeof texto === 'string' ? JSON.parse(texto) : texto;
};

// 'ids separados por coma', a veces con espacios (" 5, 7"): quedan los ids enteros, sin repetir
const idsDeLaLista = (texto) => [...new Set(String(texto ?? '').replace(/ /g, '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))];

const agregar = (mapa, clave, valor) => {
  if (!mapa.has(clave)) mapa.set(clave, []);
  mapa.get(clave).push(valor);
};

const SQL_CAMBIOS = `SELECT c.id, c.tipo_cambio tipo, c.estado, c.dataset_id, UNIX_TIMESTAMP(c.created_at) creado_ts,
    UNIX_TIMESTAMP(c.revisado_at) revisado_ts, u.nombre_completo propuso, r.nombre_completo reviso,
    c.comentario_rechazo motivo, c.datos_nuevos, c.datos_anteriores
  FROM cambios_pendientes c
  LEFT JOIN usuarios u ON u.id = c.usuario_id
  LEFT JOIN usuarios r ON r.id = c.revisor_id`;

const aCambio = (c) => ({
  id: c.id, tipo: c.tipo, estado: c.estado, creado: momento(c.creado_ts), revisado: momento(c.revisado_ts),
  propuso: c.propuso ?? null, reviso: c.reviso ?? null, motivo: c.motivo ?? null,
  nuevos: leerJson(c.datos_nuevos), anteriores: leerJson(c.datos_anteriores), dataset_id: c.dataset_id ?? null
});

const aNota = (n) => ({
  id: n.id, numero: n.numero ?? null, anio: n.anio ?? null, tipo: n.tipo, gestion: n.gestion ?? null, fecha: n.fecha, estado: n.estado,
  enviada: n.enviada ?? null, para: n.para, cc: n.cc ?? null, seccion: n.seccion, vencimiento: n.vencimiento,
  datos_solicitados: n.datos_solicitados ?? null, creado_por: n.creado_por ?? null, firmante: n.firmante ?? null
});

const aDataset = (d) => ({
  id: d.id, titulo: d.titulo, area: d.area, area_superior: d.area_superior ?? null, area_id: d.area_id, tipo_gestion: d.tipo_gestion,
  requiere_nota: d.requiere_nota ?? null, frecuencia: d.frecuencia, meses: d.meses ?? null, proxima: d.proxima ?? null,
  datos_al: d.datos_al ?? null, ultima: d.ultima ?? null, tipo_pedido: d.tipo_pedido ?? null, url_dataset: d.url_dataset ?? null,
  activo: Boolean(d.activo), alta: momento(d.alta_ts)
});

// Reparte las filas de auditoría entre los datasets: datasetsDeCambio dice de qué datasets es cada cambio (o alta unida). Cada
// dataset recibe su propia copia, en el orden de la consulta.
const repartirAuditorias = (filas, datasetsDeCambio) => {
  const porDataset = new Map();
  for (const a of filas) {
    for (const datasetId of datasetsDeCambio.get(a.cambio_id) ?? []) {
      agregar(porDataset, datasetId, {
        id: a.id, numero: a.numero, anio: a.anio, fecha: a.fecha, estado: a.estado, cambio_id: a.cambio_id, seccion: a.seccion,
        creado_por: a.creado_por ?? null, firmante: a.firmante ?? null
      });
    }
  }
  return porDataset;
};

// Las notas DGMIT de los datasets, Map<datasetId, [nota]>, cada lista en orden de recibida y después de id. Cada nota trae todos
// sus datasets ({ id, titulo }, por título; también los dados de baja y los que no se pidieron), quién la cargó (nombre completo
// y id, o null) y su historial (correcciones y anulación, la más nueva primero). Tres consultas para todos los datasets juntos.
// Nunca tira: si algo falla, lo registra y devuelve un Map vacío (una falla acá no puede frenar el anexo de la reiteración).
const notasDgmitDe = async (datasetIds) => {
  try {
    const [notas] = await pool.query(
      `SELECT n.id, n.numero, n.tipo, DATE_FORMAT(n.recibida, '%Y-%m-%d') recibida, n.anulada, UNIX_TIMESTAMP(n.created_at) cargada_ts,
         u.nombre_completo por, n.creado_por por_id
       FROM notas_dgmit n LEFT JOIN usuarios u ON u.id = n.creado_por
       WHERE n.id IN (SELECT nota_id FROM notas_dgmit_datasets WHERE dataset_id IN (?))
       ORDER BY n.recibida, n.id`, [datasetIds]
    );
    const resultado = new Map();
    if (notas.length === 0) return resultado;
    const notaIds = notas.map((n) => n.id);
    const [[datasets], [historial]] = await Promise.all([
      pool.query(
        `SELECT nd.nota_id, d.id, d.titulo FROM notas_dgmit_datasets nd JOIN datasets d ON d.id = nd.dataset_id
         WHERE nd.nota_id IN (?) ORDER BY d.titulo, d.id`, [notaIds]
      ),
      pool.query(
        `SELECT h.nota_id, h.accion, h.motivo, u.nombre_completo por, UNIX_TIMESTAMP(h.created_at) ts
         FROM notas_dgmit_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
         WHERE h.nota_id IN (?) ORDER BY h.created_at DESC, h.id DESC`, [notaIds]
      )
    ]);
    const datasetsDe = new Map();
    for (const d of datasets) agregar(datasetsDe, d.nota_id, { id: d.id, titulo: d.titulo });
    const historialDe = new Map();
    for (const h of historial) agregar(historialDe, h.nota_id, { accion: h.accion, motivo: h.motivo, por: h.por ?? null, momento: momento(h.ts) });

    const pedidos = new Set(datasetIds);
    for (const n of notas) {
      const nota = {
        id: n.id, numero: n.numero, tipo: n.tipo, recibida: n.recibida, anulada: Boolean(n.anulada), cargada: momento(n.cargada_ts),
        por: n.por ?? null, por_id: n.por_id ?? null, datasets: datasetsDe.get(n.id) ?? [], historial: historialDe.get(n.id) ?? []
      };
      // Una copia por dataset pedido, con sus propias listas: ninguna se comparte con la de otro dataset
      for (const d of nota.datasets) {
        if (!pedidos.has(d.id)) continue;
        agregar(resultado, d.id, {
          ...nota, datasets: nota.datasets.map((x) => ({ ...x })), historial: nota.historial.map((h) => ({ ...h }))
        });
      }
    }
    return resultado;
  } catch (error) {
    console.error('No se pudieron leer las notas DGMIT:', error);
    return new Map();
  }
};

// `ids`: lista de ids de datasets, o null (también sin argumento) para todos. Devuelve Map<id, Fuentes>; un id que no existe
// no figura. Los inactivos también vienen (activo: false): el Seguimiento sirve para ver qué pasó con un dataset dado de baja.
export const fuentesDe = async (ids = null) => {
  const pedidos = ids == null ? null : [...new Set(Array.from(ids, Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (pedidos && pedidos.length === 0) return new Map();

  const [datasets] = await pool.query(
    `SELECT d.id, d.titulo, a.nombre area, a.area_superior, d.area_id, d.tipo_gestion, d.requiere_nota, f.nombre frecuencia, f.meses,
       DATE_FORMAT(d.proxima_actualizacion, '%Y-%m-%d') proxima, DATE_FORMAT(d.datos_al, '%Y-%m-%d') datos_al,
       DATE_FORMAT(d.ultima_actualizacion, '%Y-%m-%d') ultima, d.tipo_pedido, d.url_dataset, d.activo,
       UNIX_TIMESTAMP(d.created_at) alta_ts
     FROM datasets d
     JOIN areas a ON a.id = d.area_id
     JOIN frecuencias f ON f.id = d.frecuencia_id
     ${pedidos ? 'WHERE d.id IN (?)' : ''}
     ORDER BY d.id`,
    pedidos ? [pedidos] : []
  );
  const resultado = new Map();
  if (datasets.length === 0) return resultado;
  const datasetIds = datasets.map((d) => d.id);

  // notasDgmitDe nunca rechaza: si su consulta falla, las demás siguen y cada dataset queda sin notas DGMIT
  const [catalogosCompletos, [cambios], [altas], [historial], [logs], [notas], notasDgmitPorDataset] = await Promise.all([
    catalogosParaAuditoria(),
    pool.query(`${SQL_CAMBIOS} WHERE c.dataset_id IN (?) ORDER BY c.created_at, c.id`, [datasetIds]),
    pool.query(`${SQL_CAMBIOS} WHERE c.tipo_cambio = 'crear' AND c.estado = 'aprobado' AND c.dataset_id IS NULL ORDER BY c.created_at, c.id`),
    pool.query(
      `SELECT h.dataset_id, DATE_FORMAT(h.fecha_actualizacion, '%Y-%m-%d') fecha, UNIX_TIMESTAMP(h.created_at) creado_ts,
         u.nombre_completo usuario, h.cambio_id
       FROM historial_actualizaciones h LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.dataset_id IN (?) ORDER BY h.created_at, h.id`, [datasetIds]
    ),
    pool.query(
      `SELECT l.id, l.tipo, UNIX_TIMESTAMP(l.enviado_at) ts, l.success, l.cantidad_datasets, a.nombre area, a.articulo area_articulo,
         l.destinatarios, l.error_message, REPLACE(l.datasets_ids, ' ', '') ids
       FROM notificaciones_log l LEFT JOIN areas a ON a.id = l.area_id
       ORDER BY l.enviado_at, l.id`
    ),
    pool.query(
      `SELECT nd.dataset_id, n.id, n.numero, n.anio, n.tipo, n.gestion, DATE_FORMAT(n.fecha, '%Y-%m-%d') fecha, n.estado,
         DATE_FORMAT(n.enviada_at, '%Y-%m-%d %H:%i:%s') enviada, n.para, n.cc, nd.seccion,
         DATE_FORMAT(nd.vencimiento, '%Y-%m-%d') vencimiento, nd.datos_solicitados,
         cp.nombre_completo creado_por, fi.nombre_completo firmante
       FROM notas_digitales_datasets nd
       JOIN notas_digitales n ON n.id = nd.nota_id
       LEFT JOIN usuarios cp ON cp.id = n.creado_por
       LEFT JOIN usuarios fi ON fi.id = n.firmante_id
       WHERE n.es_prueba = 0 AND n.tipo IN ('aviso', 'reiteracion') AND nd.dataset_id IN (?)
       ORDER BY n.fecha, n.id`, [datasetIds]
    ),
    notasDgmitDe(datasetIds)
  ]);
  // Un solo objeto de catálogos para todos los datasets (los temas y los formatos, para decir sus nombres en los cambios)
  const catalogos = {
    areas: catalogosCompletos.areas, frecuencias: catalogosCompletos.frecuencias, temas: catalogosCompletos.temas, formatos: catalogosCompletos.formatos
  };

  const porDataset = (filas) => {
    const mapa = new Map();
    for (const fila of filas) agregar(mapa, fila.dataset_id, fila);
    return mapa;
  };
  const cambiosDe = porDataset(cambios);
  const historialDe = porDataset(historial);
  const notasDe = porDataset(notas);

  const emailsDe = new Map();
  for (const l of logs) {
    const email = {
      id: l.id, tipo: l.tipo, enviado: momento(l.ts), success: Boolean(l.success), cantidad: l.cantidad_datasets,
      area: l.area ?? null, area_articulo: l.area_articulo ?? null, destinatarios: l.destinatarios, error: l.error_message ?? null
    };
    // Una copia por dataset: ninguna lista comparte objetos con la de otro dataset
    for (const datasetId of idsDeLaLista(l.ids)) agregar(emailsDe, datasetId, { ...email });
  }

  // Cambios y altas unidas de cada dataset, para buscar sus notas de auditoría
  const datasetsDeCambio = new Map();
  const altasDe = new Map();
  for (const d of datasets) {
    const delDataset = [];
    for (const c of cambiosDe.get(d.id) ?? []) delDataset.push(c.id);
    if (d.alta_ts != null) {
      for (const c of altas) {
        if (c.revisado_ts == null) continue;
        if (Math.abs(Number(c.revisado_ts) - Number(d.alta_ts)) > SEGUNDOS_DE_UNION_DEL_ALTA) continue;
        agregar(altasDe, d.id, aCambio(c));
        delDataset.push(c.id);
      }
    }
    for (const id of delDataset) agregar(datasetsDeCambio, id, d.id);
  }
  let auditoriasDe = new Map();
  if (datasetsDeCambio.size > 0) {
    const [auditorias] = await pool.query(
      `SELECT n.id, n.numero, n.anio, DATE_FORMAT(n.fecha, '%Y-%m-%d') fecha, n.estado, nc.cambio_id, nc.seccion,
         cp.nombre_completo creado_por, fi.nombre_completo firmante
       FROM notas_digitales_cambios nc JOIN notas_digitales n ON n.id = nc.nota_id
       LEFT JOIN usuarios cp ON cp.id = n.creado_por
       LEFT JOIN usuarios fi ON fi.id = n.firmante_id
       WHERE n.es_prueba = 0 AND nc.cambio_id IN (?) ORDER BY n.fecha, n.id`, [[...datasetsDeCambio.keys()]]
    );
    auditoriasDe = repartirAuditorias(auditorias, datasetsDeCambio);
  }

  for (const d of datasets) {
    resultado.set(d.id, {
      dataset: aDataset(d),
      altasSinDataset: altasDe.get(d.id) ?? [],
      cambios: (cambiosDe.get(d.id) ?? []).map(aCambio),
      historial: (historialDe.get(d.id) ?? []).map((h) => ({ fecha: h.fecha, creado: momento(h.creado_ts), usuario: h.usuario ?? null, cambio_id: h.cambio_id ?? null })),
      emails: emailsDe.get(d.id) ?? [],
      notas: (notasDe.get(d.id) ?? []).map(aNota),
      auditorias: auditoriasDe.get(d.id) ?? [],
      notasDgmit: notasDgmitPorDataset.get(d.id) ?? [],
      catalogos
    });
  }
  return resultado;
};
