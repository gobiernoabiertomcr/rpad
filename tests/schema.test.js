// database/schema.sql debe crear la misma estructura que la base real, sin datos personales
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { query, cerrarDb } from './helpers.js';
import { feriadosDelAnio, validarFeriado, TIPOS_FERIADO } from '../services/feriadosReglas.js';

const BASE_TEMPORAL = 'rpad_schema_test';
let root;

// Meses entre actualizaciones de cada frecuencia del catálogo (Eventual no tiene período)
const MESES_POR_FRECUENCIA = {
  'Mensualmente': 1, 'Bimestralmente': 2, 'Trimestralmente': 3, 'Cuatrimestralmente': 4, 'Cada medio año': 6,
  'Anualmente': 12, 'Cada dos años': 24, 'Cada tres años': 36, 'Cada cuatro años': 48, 'Cada diez años': 120,
  'Eventual': null
};

const columnas = async (conexion, base) => {
  const [filas] = await conexion.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo,
            IS_NULLABLE AS nulo, COLUMN_DEFAULT AS defecto, COLUMN_KEY AS clave
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [base]
  );
  return filas.map(f => `${f.tabla}.${f.columna} ${f.tipo} null=${f.nulo} default=${f.defecto} key=${f.clave}`);
};

// Claves foráneas e índices de unas tablas: `columnas` no los ve
const clavesAjenasDe = async (conexion, base, tablas) => {
  const [filas] = await conexion.query(
    `SELECT rc.CONSTRAINT_NAME AS nombre, rc.TABLE_NAME AS tabla, k.COLUMN_NAME AS columna,
            rc.REFERENCED_TABLE_NAME AS destino, k.REFERENCED_COLUMN_NAME AS destino_columna, rc.DELETE_RULE AS borrado
     FROM information_schema.REFERENTIAL_CONSTRAINTS rc
     JOIN information_schema.KEY_COLUMN_USAGE k USING (CONSTRAINT_SCHEMA, CONSTRAINT_NAME, TABLE_NAME)
     WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME IN (?)
     ORDER BY rc.TABLE_NAME, rc.CONSTRAINT_NAME`,
    [base, tablas]
  );
  return filas.map(f => `${f.tabla}.${f.columna} -> ${f.destino}.${f.destino_columna} (${f.nombre}) borrado=${f.borrado}`);
};

const indicesDe = async (conexion, base, tablas) => {
  const [filas] = await conexion.query(
    `SELECT TABLE_NAME AS tabla, INDEX_NAME AS indice, NON_UNIQUE AS repetible,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?)
     GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME`,
    [base, tablas]
  );
  return filas.map(f => `${f.tabla}.${f.indice} (${f.columnas}) repetible=${f.repetible}`);
};

// Las tres tablas de las notas DGMIT (spec 2026-10-24-notas-dgmit, 4)
const TABLAS_DGMIT = ['notas_dgmit', 'notas_dgmit_datasets', 'notas_dgmit_historial'];
const clavesAjenasDgmit = (conexion, base) => clavesAjenasDe(conexion, base, TABLAS_DGMIT);
const indicesDgmit = (conexion, base) => indicesDe(conexion, base, TABLAS_DGMIT);

// Las dos tablas de Métricas y Reportes (spec 2026-10-24-metricas-y-reportes, 3 y 4): la foto anual y los «Recibido el»
// importados
const TABLAS_METRICAS = ['metricas_fotos', 'actualizaciones_recibido'];

// Las dos tablas de los feriados (spec 2026-10-26-feriados, 1): los que no son los 9 fijos y los años en que uno que se
// repite no rige
const TABLAS_FERIADOS = ['feriados', 'feriados_no_rige'];

// Las seis tablas de Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 5): los años, el arranque, el saldo
// inicial, las licencias, las horas extras y los avisos de vencimiento enviados
const TABLAS_MI_ESPACIO = ['mi_espacio_anios', 'mi_espacio_arranque', 'mi_espacio_saldos', 'mi_espacio_licencias', 'mi_espacio_horas_extras', 'mi_espacio_avisos'];

// Las cuatro tablas de la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 3), en el orden de la migración: los
// eventos, con quién se comparte cada uno, los emails enviados y la última corrida de los recordatorios
const TABLAS_MI_ESPACIO_AGENDA = ['mi_espacio_eventos', 'mi_espacio_evento_personas', 'mi_espacio_evento_envios', 'mi_espacio_eventos_corridas'];

// La tabla de la planilla de horas extras de contrato (spec 2026-10-27-mi-espacio-horas, 6): una fila por persona y día, con
// la salida y, opcional en un día hábil, la entrada
const TABLAS_MI_ESPACIO_HORAS = ['mi_espacio_salidas'];

// Las tablas que crea schema.sql: 41 hasta la agenda de Mi espacio y 42 con la planilla de contrato
const TOTAL_DE_TABLAS = 42;

// Las columnas generadas de unas tablas, con cómo se guardan y su expresión: `columnas` no lee EXTRA
const generadasDe = async (conexion, base, tablas) => {
  const [filas] = await conexion.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, EXTRA AS extra, GENERATION_EXPRESSION AS expresion
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?) AND EXTRA LIKE '%GENERATED%'
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [base, tablas]
  );
  return filas.map(f => `${f.tabla}.${f.columna} ${f.extra}: ${f.expresion}`);
};

// El motor y la colación de unas tablas: `columnas` no los ve
const motoresDe = async (conexion, base, tablas) => {
  const [filas] = await conexion.query(
    `SELECT TABLE_NAME AS tabla, ENGINE AS motor, TABLE_COLLATION AS colacion
     FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?) ORDER BY TABLE_NAME`,
    [base, tablas]
  );
  return filas.map(f => `${f.tabla} ${f.motor} ${f.colacion}`);
};

const contar = async (tabla) => {
  const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_TEMPORAL}\`.\`${tabla}\``);
  return total;
};

before(async () => {
  if (process.env.RPAD_TESTS_DB_LOCAL !== '1' || !process.env.DB_ROOT_PASSWORD) {
    throw new Error('Este test necesita RPAD_TESTS_DB_LOCAL=1 y DB_ROOT_PASSWORD (base Docker local)');
  }
  root = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT), user: 'root',
    password: process.env.DB_ROOT_PASSWORD, multipleStatements: true
  });
  await root.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
  await root.query(`CREATE DATABASE \`${BASE_TEMPORAL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`USE \`${BASE_TEMPORAL}\``);
  await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
});

after(async () => {
  await root?.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
  await root?.end();
  await cerrarDb();
});

describe('database/schema.sql', () => {
  it('crea las mismas tablas y columnas que la base actual', async () => {
    // Única diferencia buscada: un usuario nuevo es lector por defecto
    const normalizar = (lista) => lista.map(c => c.startsWith('usuarios.rol ') ? c.replace(/default=\S+/, 'default=*') : c);
    const esperado = normalizar(await columnas(root, process.env.DB_NAME));
    const obtenido = normalizar(await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(obtenido, esperado);
  });

  it('el dataset tiene la columna que_se_solicita (TEXT NULL), justo después de observaciones', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('datasets.'));
    const posicion = (columna) => lista.findIndex(c => c.startsWith(`datasets.${columna} `));
    assert.ok(lista.includes('datasets.que_se_solicita text null=YES default=NULL key='), lista.join('\n'));
    assert.equal(posicion('que_se_solicita'), posicion('observaciones') + 1, lista.join('\n'));
  });

  it('la nota digital tiene la columna anexo_pdf (MEDIUMBLOB NULL), justo después de pdf', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('notas_digitales.'));
    const posicion = (columna) => lista.findIndex(c => c.startsWith(`notas_digitales.${columna} `));
    assert.ok(lista.includes('notas_digitales.anexo_pdf mediumblob null=YES default=NULL key='), lista.join('\n'));
    assert.equal(posicion('anexo_pdf'), posicion('pdf') + 1, lista.join('\n'));
  });

  it('crea un usuario nuevo con rol lector por defecto', async () => {
    const [[rol]] = await root.query(
      `SELECT COLUMN_DEFAULT AS defecto FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'rol'`,
      [BASE_TEMPORAL]
    );
    assert.equal(rol.defecto, "'lector'");
  });

  it('usuarios admite el rol superadmin, contraseña nula, cargo, vínculo, último ingreso y versión de sesión', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('usuarios.'));
    for (const esperada of [
      "usuarios.rol enum('superadmin','admin','editor','colaborador','lector') null=NO default='lector' key=",
      'usuarios.password_hash varchar(255) null=YES default=NULL key=',
      'usuarios.cargo varchar(200) null=YES default=NULL key=',
      "usuarios.vinculo enum('planta_permanente','planta_politica','contrato') null=YES default=NULL key=",
      'usuarios.ultimo_ingreso timestamp null=YES default=NULL key=',
      'usuarios.sesion_version int(11) null=NO default=0 key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.join('\n')}`);
    }
  });

  it('las tablas de links de acceso y de auditoría guardan solo el hash del token y el detalle como JSON', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    assert.ok(lista.includes('usuarios_tokens.token_hash char(64) null=NO default=null key=UNI'), lista.join('\n'));
    assert.ok(lista.includes("usuarios_tokens.tipo enum('invitacion','recuperacion') null=NO default=null key="), lista.join('\n'));
    assert.ok(lista.some(c => c.startsWith('usuarios_auditoria.detalle longtext null=YES')), lista.join('\n'));
  });

  it('licencias y firmas por usuario (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.1)', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    for (const esperada of [
      'usuarios_licencias.usuario_id int(11) null=NO default=null key=MUL',
      'usuarios_licencias.desde date null=NO default=null key=',
      'usuarios_licencias.hasta date null=NO default=null key=',
      'usuarios_licencias.autorizado_id int(11) null=YES default=NULL key=MUL',
      'usuarios_licencias.autorizado_at datetime null=YES default=NULL key=',
      'usuarios_licencias.nota_autorizacion_id int(11) null=YES default=NULL key=',
      'usuarios_licencias.anulada tinyint(1) null=NO default=0 key=',
      'usuarios_firmas.usuario_id int(11) null=NO default=null key=PRI',
      'usuarios_firmas.nombre varchar(150) null=NO default=null key=',
      'usuarios_firmas.cargo varchar(200) null=NO default=null key=',
      'usuarios_firmas.imagen mediumblob null=YES default=NULL key=',
      'notas_digitales_config.firmante_usuario_id int(11) null=YES default=NULL key=',
      'notas_digitales.firmante_id int(11) null=YES default=NULL key=',
      'notas_digitales.presentada_por_id int(11) null=YES default=NULL key=',
      'notas_digitales_datasets.cuenta_desde date null=YES default=NULL key=',
      'usuarios_auditoria.aviso_retenido varchar(300) null=YES default=NULL key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.filter(c => c.startsWith(esperada.split('.')[0])).join('\n')}`);
    }
    assert.ok(lista.some(c => c.startsWith("usuarios_auditoria.accion enum(") && c.includes("'licencia_cargada','licencia_editada','licencia_anulada'")),
      lista.filter(c => c.startsWith('usuarios_auditoria.accion')).join('\n'));
    // La nota de autorización (spec 7.2) es un tipo nuevo, sin gestión
    // (la entrega 3 suma 'auditoria' al final del ENUM; lo que fija este test, que existe 'autorizacion', sigue igual)
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion'")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
    assert.ok(lista.some(c => c.startsWith("notas_digitales.gestion enum('interna','externa') null=YES default=NULL")),
      lista.filter(c => c.startsWith('notas_digitales.gestion')).join('\n'));
  });

  it('editor y auditoría de cambios pendientes (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.2)', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    for (const esperada of [
      // El rol colaborador (spec 2026-10-24-notas-dgmit) se suma después de editor
      "usuarios.rol enum('superadmin','admin','editor','colaborador','lector') null=NO default='lector' key=",
      'cambios_pendientes.primer_recordatorio_at datetime null=YES default=NULL key=',
      'cambios_pendientes.revisado_como_respaldo tinyint(1) null=NO default=0 key=',
      'cambios_pendientes.aviso_sin_auditores_at datetime null=YES default=NULL key=',
      // El editor que audita con auditores disponibles (spec 2026-10-20-editor-sin-responsabilidad)
      'cambios_pendientes.revisado_sin_responsabilidad tinyint(1) null=NO default=0 key=',
      'notas_digitales_cambios.nota_id int(11) null=NO default=null key=PRI',
      'notas_digitales_cambios.cambio_id int(11) null=NO default=null key=PRI',
      "notas_digitales_cambios.seccion enum('nuevo','reiterado') null=NO default=null key=",
      "notas_digitales_config.para_auditoria varchar(500) null=NO default='mit@comodoro.gov.ar' key=",
      'notas_digitales_config.cc_auditoria varchar(500) null=YES default=NULL key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.filter(c => c.startsWith(esperada.split('.')[0])).join('\n')}`);
    }
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion','auditoria') null=NO")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
    // El aviso a quien propone cuando no hay auditor disponible va justo después de la marca de respaldo
    const deCambios = lista.filter(c => c.startsWith('cambios_pendientes.'));
    const posicion = (columna) => deCambios.findIndex(c => c.startsWith(`cambios_pendientes.${columna} `));
    assert.equal(posicion('aviso_sin_auditores_at'), posicion('revisado_como_respaldo') + 1, deCambios.join('\n'));
    // La marca "sin responsabilidad por la auditoría" va al final: así el rollback y la migración de la entrega 3 la dejan
    // en su lugar
    assert.equal(posicion('revisado_sin_responsabilidad'), posicion('aviso_sin_auditores_at') + 1, deCambios.join('\n'));
  });

  it('fechas de los datasets: "Datos al", tipo de pedido, frecuencia en meses, historial y pedido congelado (spec 2026-10-17-fechas-datasets, 6)', async () => {
    const lista = await columnas(root, BASE_TEMPORAL);
    for (const esperada of [
      'frecuencias.meses smallint(6) null=YES default=NULL key=',
      'datasets.datos_al date null=YES default=NULL key=',
      "datasets.tipo_pedido enum('acumulado','foto','anio_anterior','ejercicio','edicion','relevamiento','eventual') null=YES default=NULL key=",
      'historial_actualizaciones.cambio_id int(11) null=YES default=NULL key=MUL',
      'historial_actualizaciones.vencimiento date null=YES default=NULL key=',
      'historial_actualizaciones.datos_al date null=YES default=NULL key=',
      'historial_actualizaciones.recibido_el date null=YES default=NULL key=',
      'historial_actualizaciones.proxima_nueva date null=YES default=NULL key=',
      'notas_digitales_datasets.datos_desde date null=YES default=NULL key=',
      'notas_digitales_datasets.datos_hasta date null=YES default=NULL key=',
      'notas_digitales_datasets.datos_solicitados varchar(255) null=YES default=NULL key='
    ]) {
      assert.ok(lista.includes(esperada), `falta: ${esperada}\n${lista.filter(c => c.startsWith(esperada.split('.')[0] + '.')).join('\n')}`);
    }
    // Cada columna nueva va justo después de la que corresponde
    const despuesDe = (tabla, columna, anterior) => {
      const deTabla = lista.filter(c => c.startsWith(`${tabla}.`));
      const posicion = (nombre) => deTabla.findIndex(c => c.startsWith(`${tabla}.${nombre} `));
      assert.equal(posicion(columna), posicion(anterior) + 1, deTabla.join('\n'));
    };
    despuesDe('frecuencias', 'meses', 'dias');
    despuesDe('datasets', 'datos_al', 'ultima_actualizacion');
    despuesDe('datasets', 'tipo_pedido', 'que_se_solicita');
  });

  // Spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.1: va después de tipo_gestion y no entre que_se_solicita y
  // tipo_pedido, porque crearConEstructuraAnterior (más abajo) borra tipo_pedido y lo vuelve a poner AFTER que_se_solicita
  it('datasets tiene requiere_nota TINYINT(1) NULL después de tipo_gestion', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('datasets.'));
    const posicion = (columna) => lista.findIndex(c => c.startsWith(`datasets.${columna} `));
    assert.ok(lista.includes('datasets.requiere_nota tinyint(1) null=YES default=NULL key='), lista.join('\n'));
    assert.equal(posicion('requiere_nota'), posicion('tipo_gestion') + 1, lista.join('\n'));
  });

  // Notas DGMIT (spec 2026-10-24-notas-dgmit, 1 y 4): el rol Colaborador y las tres tablas nuevas
  it('usuarios admite el rol colaborador (después de editor) y sigue con lector por defecto', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('usuarios.rol '));
    assert.deepEqual(lista, ["usuarios.rol enum('superadmin','admin','editor','colaborador','lector') null=NO default='lector' key="]);
  });

  it('notas DGMIT: tres tablas con sus columnas, claves y FK (spec 2026-10-24-notas-dgmit, 4)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('notas_dgmit'));
    assert.deepEqual(lista, [
      'notas_dgmit.id int(11) null=NO default=null key=PRI',
      'notas_dgmit.numero varchar(40) null=NO default=null key=',
      "notas_dgmit.tipo enum('solicitud','reiteracion') null=NO default=null key=",
      'notas_dgmit.recibida date null=NO default=null key=MUL',
      'notas_dgmit.anulada tinyint(1) null=NO default=0 key=',
      'notas_dgmit.creado_por int(11) null=YES default=NULL key=MUL',
      'notas_dgmit.created_at timestamp null=YES default=current_timestamp() key=',
      'notas_dgmit.updated_at timestamp null=YES default=current_timestamp() key=',
      // La clave primaria es compuesta: una nota no repite un dataset
      'notas_dgmit_datasets.nota_id int(11) null=NO default=null key=PRI',
      'notas_dgmit_datasets.dataset_id int(11) null=NO default=null key=PRI',
      'notas_dgmit_historial.id int(11) null=NO default=null key=PRI',
      'notas_dgmit_historial.nota_id int(11) null=NO default=null key=MUL',
      "notas_dgmit_historial.accion enum('correccion','anulacion') null=NO default=null key=",
      'notas_dgmit_historial.motivo varchar(500) null=NO default=null key=',
      'notas_dgmit_historial.anteriores longtext null=YES default=NULL key=',
      'notas_dgmit_historial.usuario_id int(11) null=YES default=NULL key=MUL',
      'notas_dgmit_historial.created_at timestamp null=YES default=current_timestamp() key='
    ]);
    const [[{ clave }]] = await root.query(
      `SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS clave FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notas_dgmit_datasets' AND INDEX_NAME = 'PRIMARY'`,
      [BASE_TEMPORAL]
    );
    assert.equal(clave, 'nota_id,dataset_id');
    // Borrar la nota o el dataset borra el vínculo; borrar a la persona deja la nota (y su historial) sin autor
    assert.deepEqual(await clavesAjenasDgmit(root, BASE_TEMPORAL), [
      'notas_dgmit.creado_por -> usuarios.id (fk_notas_dgmit_creado_por) borrado=SET NULL',
      'notas_dgmit_datasets.dataset_id -> datasets.id (fk_notas_dgmit_datasets_dataset) borrado=CASCADE',
      'notas_dgmit_datasets.nota_id -> notas_dgmit.id (fk_notas_dgmit_datasets_nota) borrado=CASCADE',
      'notas_dgmit_historial.nota_id -> notas_dgmit.id (fk_notas_dgmit_historial_nota) borrado=CASCADE',
      'notas_dgmit_historial.usuario_id -> usuarios.id (fk_notas_dgmit_historial_usuario) borrado=SET NULL'
    ]);
  });

  it('métricas: la foto anual y los «Recibido el» importados, con sus columnas, claves y FK (spec 2026-10-24-metricas-y-reportes, 3 y 4)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => TABLAS_METRICAS.some(tabla => c.startsWith(`${tabla}.`)));
    assert.deepEqual(lista, [
      // Un «Recibido el» importado por cambio aprobado: la clave es el cambio
      'actualizaciones_recibido.cambio_id int(11) null=NO default=null key=PRI',
      'actualizaciones_recibido.recibido_el date null=YES default=NULL key=',
      "actualizaciones_recibido.origen_datos enum('area','fuente_publica') null=YES default=NULL key=",
      'actualizaciones_recibido.created_at timestamp null=YES default=current_timestamp() key=',
      // Una foto por año, al 31/12 de ese año; datos es el JSON de la foto
      'metricas_fotos.anio smallint(6) null=NO default=null key=PRI',
      'metricas_fotos.al date null=NO default=null key=',
      'metricas_fotos.datos longtext null=NO default=null key=',
      'metricas_fotos.created_at timestamp null=YES default=current_timestamp() key='
    ]);
    // Borrar el cambio pendiente borra su «Recibido el» importado
    assert.deepEqual(await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_METRICAS), [
      'actualizaciones_recibido.cambio_id -> cambios_pendientes.id (fk_actualizaciones_recibido_cambio) borrado=CASCADE'
    ]);
    assert.deepEqual(await indicesDe(root, BASE_TEMPORAL, TABLAS_METRICAS), [
      'actualizaciones_recibido.PRIMARY (cambio_id) repetible=0',
      'metricas_fotos.PRIMARY (anio) repetible=0'
    ]);
  });

  it('feriados: los que no son los 9 fijos y los años en que uno que se repite no rige, con sus columnas, claves y FK (spec 2026-10-26-feriados, 1)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => TABLAS_FERIADOS.some(tabla => c.startsWith(`${tabla}.`)));
    assert.deepEqual(lista, [
      'feriados.id int(11) null=NO default=null key=PRI',
      // En uno que se repite, la fecha de su primer año
      'feriados.fecha date null=NO default=null key=MUL',
      'feriados.nombre varchar(150) null=NO default=null key=',
      "feriados.tipo enum('nacional','provincial','municipal','no_laborable') null=NO default=null key=",
      // La fecha original de un trasladable
      'feriados.trasladado_de date null=YES default=NULL key=',
      'feriados.se_repite tinyint(1) null=NO default=0 key=',
      // En uno que se repite, el último año en que rige (NULL: sigue)
      'feriados.hasta_anio smallint(6) null=YES default=NULL key=',
      'feriados.activo tinyint(1) null=NO default=1 key=',
      'feriados.creado_por int(11) null=YES default=NULL key=MUL',
      'feriados.created_at timestamp null=YES default=current_timestamp() key=',
      'feriados.updated_at timestamp null=YES default=current_timestamp() key=',
      // Un año por feriado: la clave es compuesta
      'feriados_no_rige.feriado_id int(11) null=NO default=null key=PRI',
      'feriados_no_rige.anio smallint(6) null=NO default=null key=PRI'
    ]);
    // Borrar el feriado borra sus años que no rigen; borrar a la persona deja el feriado sin autor
    assert.deepEqual(await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_FERIADOS), [
      'feriados.creado_por -> usuarios.id (fk_feriados_creado_por) borrado=SET NULL',
      'feriados_no_rige.feriado_id -> feriados.id (fk_feriados_no_rige_feriado) borrado=CASCADE'
    ]);
    // Sin índice único en la fecha: el mismo día puede tener dos feriados
    assert.deepEqual(await indicesDe(root, BASE_TEMPORAL, TABLAS_FERIADOS), [
      'feriados.fk_feriados_creado_por (creado_por) repetible=1',
      'feriados.idx_feriados_fecha (fecha) repetible=1',
      'feriados.PRIMARY (id) repetible=0',
      'feriados_no_rige.PRIMARY (feriado_id,anio) repetible=0'
    ]);
  });

  it('Mi espacio: seis tablas con sus columnas, claves y FK (spec 2026-10-26-mi-espacio-licencias-y-horas, 5)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => TABLAS_MI_ESPACIO.some(tabla => c.startsWith(`${tabla}.`)));
    assert.deepEqual(lista, [
      // Los días de vacaciones y los estudios de cada persona, por año
      'mi_espacio_anios.usuario_id int(11) null=NO default=null key=PRI',
      'mi_espacio_anios.anio smallint(6) null=NO default=null key=PRI',
      'mi_espacio_anios.dias_vacaciones tinyint(4) null=NO default=null key=',
      "mi_espacio_anios.estudios enum('universitario','secundario') null=YES default=NULL key=",
      'mi_espacio_anios.created_at timestamp null=YES default=current_timestamp() key=',
      'mi_espacio_anios.updated_at timestamp null=YES default=current_timestamp() key=',
      // El día en que se cargó el saldo inicial: uno por persona
      'mi_espacio_arranque.usuario_id int(11) null=NO default=null key=PRI',
      'mi_espacio_arranque.fecha date null=NO default=null key=',
      'mi_espacio_arranque.created_at timestamp null=YES default=current_timestamp() key=',
      // Los emails de vencimiento enviados: uno por persona y por cosa
      'mi_espacio_avisos.usuario_id int(11) null=NO default=null key=PRI',
      'mi_espacio_avisos.clave varchar(40) null=NO default=null key=PRI',
      'mi_espacio_avisos.enviado_at datetime null=NO default=null key=',
      'mi_espacio_horas_extras.id int(11) null=NO default=null key=PRI',
      'mi_espacio_horas_extras.usuario_id int(11) null=NO default=null key=MUL',
      'mi_espacio_horas_extras.fecha date null=NO default=null key=',
      'mi_espacio_horas_extras.desde time null=NO default=null key=',
      'mi_espacio_horas_extras.hasta time null=NO default=null key=',
      'mi_espacio_horas_extras.nota varchar(200) null=YES default=NULL key=',
      'mi_espacio_horas_extras.activo tinyint(1) null=NO default=1 key=',
      'mi_espacio_horas_extras.created_at timestamp null=YES default=current_timestamp() key=',
      'mi_espacio_horas_extras.updated_at timestamp null=YES default=current_timestamp() key=',
      'mi_espacio_licencias.id int(11) null=NO default=null key=PRI',
      'mi_espacio_licencias.usuario_id int(11) null=NO default=null key=MUL',
      "mi_espacio_licencias.tipo enum('vacaciones','franquicia','estudios','medica','medica_extraordinaria','familiar','franco','horas_a_favor','uso_autorizado') null=NO default=null key=",
      // Iguales en lo de un día
      'mi_espacio_licencias.desde date null=NO default=null key=',
      'mi_espacio_licencias.hasta date null=NO default=null key=',
      // Solo en la franquicia, las horas a favor y el uso autorizado
      'mi_espacio_licencias.horas decimal(3,1) null=YES default=NULL key=',
      // «Mostrar a mis compañeros»
      'mi_espacio_licencias.mostrar tinyint(1) null=NO default=1 key=',
      'mi_espacio_licencias.nota varchar(200) null=YES default=NULL key=',
      // El paso a Configuración → Licencias: la licencia de allá, si la creó o se unió a una que ya estaba, y por qué no pasó
      'mi_espacio_licencias.licencia_oficial_id int(11) null=YES default=NULL key=MUL',
      "mi_espacio_licencias.oficial enum('creada','unida') null=YES default=NULL key=",
      'mi_espacio_licencias.sin_pasar varchar(200) null=YES default=NULL key=',
      'mi_espacio_licencias.activo tinyint(1) null=NO default=1 key=',
      'mi_espacio_licencias.created_at timestamp null=YES default=current_timestamp() key=',
      'mi_espacio_licencias.updated_at timestamp null=YES default=current_timestamp() key=',
      // El saldo inicial, una fila por concepto (en vacaciones, el año de la licencia; en el resto, el del arranque)
      'mi_espacio_saldos.usuario_id int(11) null=NO default=null key=PRI',
      "mi_espacio_saldos.concepto enum('vacaciones','franquicias','estudios','medica','familiar','horas_no_utilizadas') null=NO default=null key=PRI",
      'mi_espacio_saldos.anio smallint(6) null=NO default=null key=PRI',
      'mi_espacio_saldos.cantidad decimal(5,1) null=NO default=0.0 key=',
      'mi_espacio_saldos.updated_at timestamp null=YES default=current_timestamp() key='
    ]);
    // Borrar a la persona borra lo suyo; borrar la licencia de Configuración deja la de Mi espacio sin el vínculo
    assert.deepEqual(await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO), [
      'mi_espacio_anios.usuario_id -> usuarios.id (fk_mi_espacio_anios_usuario) borrado=CASCADE',
      'mi_espacio_arranque.usuario_id -> usuarios.id (fk_mi_espacio_arranque_usuario) borrado=CASCADE',
      'mi_espacio_avisos.usuario_id -> usuarios.id (fk_mi_espacio_avisos_usuario) borrado=CASCADE',
      'mi_espacio_horas_extras.usuario_id -> usuarios.id (fk_mi_espacio_horas_extras_usuario) borrado=CASCADE',
      'mi_espacio_licencias.licencia_oficial_id -> usuarios_licencias.id (fk_mi_espacio_licencias_oficial) borrado=SET NULL',
      'mi_espacio_licencias.usuario_id -> usuarios.id (fk_mi_espacio_licencias_usuario) borrado=CASCADE',
      'mi_espacio_saldos.usuario_id -> usuarios.id (fk_mi_espacio_saldos_usuario) borrado=CASCADE'
    ]);
    assert.deepEqual(await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO), [
      'mi_espacio_anios.PRIMARY (usuario_id,anio) repetible=0',
      'mi_espacio_arranque.PRIMARY (usuario_id) repetible=0',
      'mi_espacio_avisos.PRIMARY (usuario_id,clave) repetible=0',
      'mi_espacio_horas_extras.idx_mi_espacio_horas_usuario (usuario_id,fecha) repetible=1',
      'mi_espacio_horas_extras.PRIMARY (id) repetible=0',
      'mi_espacio_licencias.fk_mi_espacio_licencias_oficial (licencia_oficial_id) repetible=1',
      'mi_espacio_licencias.idx_mi_espacio_licencias_usuario (usuario_id,desde,hasta) repetible=1',
      'mi_espacio_licencias.PRIMARY (id) repetible=0',
      'mi_espacio_saldos.PRIMARY (usuario_id,concepto,anio) repetible=0'
    ]);
    assert.deepEqual(await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO),
      [...TABLAS_MI_ESPACIO].sort().map(tabla => `${tabla} InnoDB utf8mb4_unicode_ci`));
  });

  it('la agenda de Mi espacio: cuatro tablas con sus columnas, claves y FK (spec 2026-10-26-mi-espacio-agenda, 3)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => TABLAS_MI_ESPACIO_AGENDA.some(tabla => c.startsWith(`${tabla}.`)));
    assert.deepEqual(lista, [
      // El evento: personal o compartido (con personas elegidas o con toda la administración), en hora argentina
      'mi_espacio_eventos.id int(11) null=NO default=null key=PRI',
      // Si se borrara a quien lo creó, el evento queda sin autor
      'mi_espacio_eventos.creado_por int(11) null=YES default=NULL key=MUL',
      'mi_espacio_eventos.titulo varchar(150) null=NO default=null key=',
      'mi_espacio_eventos.detalle text null=YES default=NULL key=',
      'mi_espacio_eventos.fecha date null=NO default=null key=MUL',
      'mi_espacio_eventos.desde time null=NO default=null key=',
      // La hora de fin es opcional
      'mi_espacio_eventos.hasta time null=YES default=NULL key=',
      'mi_espacio_eventos.compartido tinyint(1) null=NO default=0 key=',
      // «Todos» es una marca, no una lista: alguien de administración que se suma después también lo ve
      'mi_espacio_eventos.para_todos tinyint(1) null=NO default=0 key=',
      // De entrada, «2 horas antes»
      "mi_espacio_eventos.recordatorio enum('ninguno','1h','2h','dia_anterior') null=NO default='2h' key=",
      'mi_espacio_eventos.activo tinyint(1) null=NO default=1 key=',
      'mi_espacio_eventos.created_at timestamp null=YES default=current_timestamp() key=',
      'mi_espacio_eventos.updated_at timestamp null=YES default=current_timestamp() key=',
      // Una sola fila, con la última corrida de los recordatorios, para Correos → Estado
      'mi_espacio_eventos_corridas.id tinyint(4) null=NO default=null key=PRI',
      'mi_espacio_eventos_corridas.inicio_at datetime null=YES default=NULL key=',
      'mi_espacio_eventos_corridas.fin_at datetime null=YES default=NULL key=',
      'mi_espacio_eventos_corridas.resultado varchar(1000) null=YES default=NULL key=',
      'mi_espacio_eventos_corridas.con_errores tinyint(1) null=NO default=0 key=',
      // Qué email salió a quién y para qué momento del evento
      'mi_espacio_evento_envios.id int(11) null=NO default=null key=PRI',
      'mi_espacio_evento_envios.evento_id int(11) null=NO default=null key=MUL',
      'mi_espacio_evento_envios.usuario_id int(11) null=NO default=null key=MUL',
      "mi_espacio_evento_envios.tipo enum('recordatorio','invitacion','cambio','cancelacion') null=NO default=null key=",
      'mi_espacio_evento_envios.para datetime null=NO default=null key=',
      // NULL mientras el recordatorio está reservado
      'mi_espacio_evento_envios.enviado_at datetime null=YES default=NULL key=',
      'mi_espacio_evento_envios.success tinyint(1) null=NO default=0 key=',
      // 1 en los recordatorios y NULL en el resto: la clave única vale solo para los recordatorios
      'mi_espacio_evento_envios.recordatorio_unico tinyint(1) null=YES default=NULL key=',
      // Con quién se compartió, y si esa persona apagó su recordatorio
      'mi_espacio_evento_personas.evento_id int(11) null=NO default=null key=PRI',
      'mi_espacio_evento_personas.usuario_id int(11) null=NO default=null key=PRI',
      'mi_espacio_evento_personas.sin_recordatorio tinyint(1) null=NO default=0 key='
    ]);
    // La columna generada se guarda (STORED): se calcula al escribir la fila, no en cada lectura
    assert.deepEqual((await generadasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA)).map(c => c.split(':')[0]),
      ['mi_espacio_evento_envios.recordatorio_unico STORED GENERATED']);
    // Borrar el evento borra sus personas y sus envíos; borrar a una persona borra su lugar y sus envíos, y deja sin autor
    // los eventos que creó
    assert.deepEqual(await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA), [
      'mi_espacio_eventos.creado_por -> usuarios.id (fk_mi_espacio_eventos_creado_por) borrado=SET NULL',
      'mi_espacio_evento_envios.evento_id -> mi_espacio_eventos.id (fk_mi_espacio_evento_envios_evento) borrado=CASCADE',
      'mi_espacio_evento_envios.usuario_id -> usuarios.id (fk_mi_espacio_evento_envios_usuario) borrado=CASCADE',
      'mi_espacio_evento_personas.evento_id -> mi_espacio_eventos.id (fk_mi_espacio_evento_personas_evento) borrado=CASCADE',
      'mi_espacio_evento_personas.usuario_id -> usuarios.id (fk_mi_espacio_evento_personas_usuario) borrado=CASCADE'
    ]);
    assert.deepEqual(await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA), [
      'mi_espacio_eventos.fk_mi_espacio_eventos_creado_por (creado_por) repetible=1',
      'mi_espacio_eventos.idx_mi_espacio_eventos_fecha (fecha,activo) repetible=1',
      'mi_espacio_eventos.PRIMARY (id) repetible=0',
      'mi_espacio_eventos_corridas.PRIMARY (id) repetible=0',
      'mi_espacio_evento_envios.fk_mi_espacio_evento_envios_usuario (usuario_id) repetible=1',
      'mi_espacio_evento_envios.PRIMARY (id) repetible=0',
      // Un recordatorio no se repite: la misma persona, el mismo evento y el mismo momento
      'mi_espacio_evento_envios.uq_mi_espacio_evento_envios_recordatorio (evento_id,usuario_id,para,recordatorio_unico) repetible=0',
      'mi_espacio_evento_personas.fk_mi_espacio_evento_personas_usuario (usuario_id) repetible=1',
      'mi_espacio_evento_personas.PRIMARY (evento_id,usuario_id) repetible=0'
    ]);
    // En el orden de la base, que no distingue mayúsculas: «eventos» va antes que «evento_» (la S antes del guion bajo)
    assert.deepEqual(await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA),
      ['mi_espacio_eventos', 'mi_espacio_eventos_corridas', 'mi_espacio_evento_envios', 'mi_espacio_evento_personas']
        .map(tabla => `${tabla} InnoDB utf8mb4_unicode_ci`));
  });

  it('la planilla de contrato de Mi espacio: mi_espacio_salidas con sus columnas, la clave única y la FK (spec 2026-10-27-mi-espacio-horas, 6)', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => TABLAS_MI_ESPACIO_HORAS.some(tabla => c.startsWith(`${tabla}.`)));
    assert.deepEqual(lista, [
      'mi_espacio_salidas.id int(11) null=NO default=null key=PRI',
      // El primer campo de la clave única de dos: un mismo valor se repite (otro día)
      'mi_espacio_salidas.usuario_id int(11) null=NO default=null key=MUL',
      'mi_espacio_salidas.fecha date null=NO default=null key=',
      // Opcional en un día hábil; obligatoria en uno que no lo es (lo valida la API)
      'mi_espacio_salidas.entrada time null=YES default=NULL key=',
      'mi_espacio_salidas.salida time null=NO default=null key=',
      'mi_espacio_salidas.nota varchar(200) null=YES default=NULL key=',
      'mi_espacio_salidas.activo tinyint(1) null=NO default=1 key=',
      'mi_espacio_salidas.created_at timestamp null=NO default=current_timestamp() key=',
      'mi_espacio_salidas.updated_at timestamp null=NO default=current_timestamp() key='
    ]);
    // Borrar a la persona borra sus salidas (los usuarios no se borran: se desactivan)
    assert.deepEqual(await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS), [
      'mi_espacio_salidas.usuario_id -> usuarios.id (fk_mi_espacio_salidas_usuario) borrado=CASCADE'
    ]);
    // Una fila por persona y día: el guardado es un INSERT … ON DUPLICATE KEY UPDATE. La clave única es también el índice de
    // la FK
    assert.deepEqual(await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS), [
      'mi_espacio_salidas.PRIMARY (id) repetible=0',
      'mi_espacio_salidas.uq_mi_espacio_salidas_dia (usuario_id,fecha) repetible=0'
    ]);
    assert.deepEqual(await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS), ['mi_espacio_salidas InnoDB utf8mb4_unicode_ci']);
    // Sin columnas generadas
    assert.deepEqual(await generadasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS), []);
  });

  it(`crea ${TOTAL_DE_TABLAS} tablas`, async () => {
    const [[{ total }]] = await root.query(
      "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [BASE_TEMPORAL]
    );
    assert.equal(Number(total), TOTAL_DE_TABLAS);
  });

  // Generador de Notas (spec 2026-10-24-generador-de-notas, 2 y 8): el ámbito del área decide qué nota de la DGMIT le toca
  it('areas tiene ambito (municipal o externo, municipal por defecto) después de articulo_superior', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('areas.'));
    const posicion = (columna) => lista.findIndex(c => c.startsWith(`areas.${columna} `));
    assert.ok(lista.includes("areas.ambito enum('municipal','externo') null=NO default='municipal' key="), lista.join('\n'));
    assert.equal(posicion('ambito'), posicion('articulo_superior') + 1, lista.join('\n'));
  });

  it('el historial borra el vínculo al cambio (SET NULL) cuando se borra el cambio pendiente', async () => {
    const [[fk]] = await root.query(
      `SELECT k.REFERENCED_TABLE_NAME AS tabla, k.REFERENCED_COLUMN_NAME AS columna, rc.DELETE_RULE AS borrado
       FROM information_schema.REFERENTIAL_CONSTRAINTS rc
       JOIN information_schema.KEY_COLUMN_USAGE k USING (CONSTRAINT_SCHEMA, CONSTRAINT_NAME, TABLE_NAME)
       WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.CONSTRAINT_NAME = 'fk_historial_cambio'
         AND rc.TABLE_NAME = 'historial_actualizaciones' AND k.COLUMN_NAME = 'cambio_id'`,
      [BASE_TEMPORAL]
    );
    assert.deepEqual({ ...fk }, { tabla: 'cambios_pendientes', columna: 'id', borrado: 'SET NULL' });
  });

  for (const tabla of ['usuarios', 'areas', 'datasets', 'cambios_pendientes', 'notificaciones_log', 'historial_actualizaciones', 'proyectos', 'metricas_manuales', 'notas_digitales', 'notas_digitales_datasets', 'usuarios_tokens', 'usuarios_auditoria', 'usuarios_licencias', 'usuarios_firmas', 'notas_digitales_cambios', 'metricas_fotos', 'actualizaciones_recibido', 'feriados', 'feriados_no_rige', ...TABLAS_MI_ESPACIO, ...TABLAS_MI_ESPACIO_AGENDA, ...TABLAS_MI_ESPACIO_HORAS]) {
    it(`no trae datos en ${tabla}`, async () => {
      assert.equal(await contar(tabla), 0);
    });
  }

  it('trae la configuración inicial de Notas Digitales, sin firma, banner del membrete ni casillas de prueba', async () => {
    const [[config]] = await root.query(`SELECT * FROM \`${BASE_TEMPORAL}\`.notas_digitales_config`);
    assert.equal(config.id, 1);
    assert.equal(config.envio_activo, 0);
    assert.equal(config.para_interna, 'mit@comodoro.gov.ar');
    assert.equal(config.cc_interna, 'geoestadisticas@comodoro.gov.ar');
    assert.equal(config.para_externa, 'mit@comodoro.gov.ar');
    assert.equal(config.cc_externa, 'investigacionterritorial@comodoro.gov.ar');
    assert.equal(config.cco, 'datospublicos@comodoro.gov.ar');
    assert.equal(config.linea_cc_interna, 'CC. Dir. de Investigación Territorial');
    assert.equal(config.linea_cc_externa, 'CC. Dir. Administrativa');
    assert.equal(config.firma_nombre, '');
    assert.equal(config.firma_imagen, null);
    // El banner del membrete se carga desde Correos (no se versiona); el texto del pie es información pública
    assert.equal(config.membrete_imagen, null);
    assert.equal(config.membrete_mime, null);
    assert.equal(config.membrete_pie, 'www.comodoroweb.gov.ar – Moreno 815, Comodoro Rivadavia, Chubut.');
    assert.equal(config.casillas_prueba, '');
    // Sin corridas registradas todavía
    assert.equal(config.ultima_corrida_fecha, null);
    assert.equal(config.ultima_corrida_inicio, null);
    assert.equal(config.ultima_corrida_fin, null);
    assert.equal(config.ultima_corrida_resultado, null);
    assert.equal(config.ultima_corrida_con_errores, 0);
  });

  it('la configuración de Notas Digitales tiene las columnas del membrete del PDF, después de la firma', async () => {
    const lista = (await columnas(root, BASE_TEMPORAL)).filter(c => c.startsWith('notas_digitales_config.'));
    const posicion = (columna) => lista.findIndex(c => c.startsWith(`notas_digitales_config.${columna} `));
    // firmante_usuario_id (licencias y firmas por usuario) va justo después de firma_mime
    assert.deepEqual(['firma_mime', 'firmante_usuario_id', 'membrete_imagen', 'membrete_mime', 'membrete_pie', 'casillas_prueba'].map(posicion),
      [12, 13, 14, 15, 16, 17], lista.join('\n'));
    assert.ok(lista.includes('notas_digitales_config.membrete_imagen mediumblob null=YES default=NULL key='), lista.join('\n'));
    assert.ok(lista.includes('notas_digitales_config.membrete_mime varchar(20) null=YES default=NULL key='), lista.join('\n'));
    assert.ok(lista.includes('notas_digitales_config.membrete_pie varchar(300) null=YES default=NULL key='), lista.join('\n'));
  });

  for (const tabla of ['temas', 'frecuencias', 'formatos']) {
    it(`trae el catálogo completo de ${tabla}`, async () => {
      const [{ total }] = await query(`SELECT COUNT(*) AS total FROM \`${tabla}\``);
      assert.ok(total > 0);
      assert.equal(await contar(tabla), total);
    });
  }

  // La aritmética de fechas usa meses, no días (spec 2026-10-17-fechas-datasets, 6): `dias` sigue para los filtros
  const mesesDelCatalogo = async (consulta) => {
    const filas = await consulta('SELECT nombre, meses FROM frecuencias ORDER BY orden');
    return Object.fromEntries(filas.map(f => [f.nombre, f.meses]));
  };
  const enSchema = async (sqlTexto) => (await root.query(sqlTexto.replace('FROM frecuencias', `FROM \`${BASE_TEMPORAL}\`.frecuencias`)))[0];
  for (const [origen, consulta] of [['schema.sql', enSchema], ['la base actual', query]]) {
    it(`el catálogo de frecuencias de ${origen} trae meses (Eventual queda sin meses)`, async () => {
      assert.deepEqual(await mesesDelCatalogo(consulta), MESES_POR_FRECUENCIA);
    });

    it(`toda frecuencia de ${origen} de 12 meses o menos divide a 12 (los períodos caen siempre en los mismos meses)`, async () => {
      const catalogo = await mesesDelCatalogo(consulta);
      const cortas = Object.entries(catalogo).filter(([, meses]) => meses !== null && meses <= 12);
      assert.ok(cortas.length >= 6, 'el catálogo trae al menos las seis frecuencias de hasta 12 meses');
      for (const [nombre, meses] of cortas) {
        assert.equal(12 % meses, 0, `${nombre} (${meses} meses) no divide a 12`);
      }
    });
  }
});

// Migración de las fechas de los datasets (spec 2026-10-17-fechas-datasets, 6): sobre una base descartable con la
// estructura anterior, deja exactamente la estructura de schema.sql, se puede repetir y se pega tal cual en phpMyAdmin
describe('migración de las fechas de los datasets', () => {
  const BASE_FECHAS = 'rpad_schema_fechas_test';
  const ARCHIVO = 'migracion-fechas-datasets.sql';
  const sql = () => fs.readFileSync(new URL(`../database/updates/${ARCHIVO}`, import.meta.url), 'utf8');

  // Deja la base con la estructura de antes de esta entrega
  const crearConEstructuraAnterior = async () => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_FECHAS}\``);
    await root.query(`CREATE DATABASE \`${BASE_FECHAS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_FECHAS}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    await root.query(`
      ALTER TABLE historial_actualizaciones DROP FOREIGN KEY fk_historial_cambio;
      ALTER TABLE historial_actualizaciones DROP COLUMN cambio_id, DROP COLUMN vencimiento, DROP COLUMN datos_al,
        DROP COLUMN recibido_el, DROP COLUMN proxima_nueva;
      ALTER TABLE notas_digitales_datasets DROP COLUMN datos_desde, DROP COLUMN datos_hasta, DROP COLUMN datos_solicitados;
      ALTER TABLE datasets DROP COLUMN datos_al, DROP COLUMN tipo_pedido;
      ALTER TABLE frecuencias DROP COLUMN meses;`);
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_FECHAS}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y solo agrega (nada de DROP ni RENAME)', () => {
    const codigo = sql().split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    assert.doesNotMatch(codigo, /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
  });

  it('desde la estructura anterior deja la de schema.sql, con los meses de cada frecuencia, y se puede repetir', async () => {
    await crearConEstructuraAnterior();
    const anterior = await columnas(root, BASE_FECHAS);
    assert.ok(!anterior.some(c => c.startsWith('frecuencias.meses ') || c.startsWith('datasets.datos_al ')), 'la base de partida ya tiene columnas nuevas');
    await root.query(sql());
    await root.query(sql());
    assert.deepEqual(await columnas(root, BASE_FECHAS), await columnas(root, BASE_TEMPORAL));
    const [catalogo] = await root.query(`SELECT nombre, meses FROM \`${BASE_FECHAS}\`.frecuencias ORDER BY orden`);
    assert.deepEqual(Object.fromEntries(catalogo.map(f => [f.nombre, f.meses])), MESES_POR_FRECUENCIA);
  });

  it('no toca los datos: los datasets y su historial quedan con las columnas nuevas en NULL', async () => {
    await crearConEstructuraAnterior();
    await root.query(`
      INSERT INTO \`${BASE_FECHAS}\`.areas (id, nombre) VALUES (1, 'Área de prueba');
      INSERT INTO \`${BASE_FECHAS}\`.datasets (id, titulo, area_id, frecuencia_id, tema_principal_id, ultima_actualizacion, proxima_actualizacion)
        VALUES (1, 'Dataset de prueba', 1, 6, 1, '2026-03-15', '2027-03-15');
      INSERT INTO \`${BASE_FECHAS}\`.historial_actualizaciones (dataset_id, fecha_actualizacion) VALUES (1, '2026-03-15');`);
    await root.query(sql());
    const [[dataset]] = await root.query(`SELECT datos_al, tipo_pedido, DATE_FORMAT(ultima_actualizacion, '%Y-%m-%d') AS ultima FROM \`${BASE_FECHAS}\`.datasets WHERE id = 1`);
    assert.deepEqual({ ...dataset }, { datos_al: null, tipo_pedido: null, ultima: '2026-03-15' });
    const [[historial]] = await root.query(`SELECT cambio_id, vencimiento, datos_al, recibido_el, proxima_nueva FROM \`${BASE_FECHAS}\`.historial_actualizaciones`);
    assert.deepEqual({ ...historial }, { cambio_id: null, vencimiento: null, datos_al: null, recibido_el: null, proxima_nueva: null });
  });
});

// «Requiere nota DGMIT» (spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 1.1 y 1.2): la estructura y la carga inicial,
// cada una sobre una base descartable propia creada con schema.sql
describe('migración de «Requiere nota DGMIT»', () => {
  const BASE_NOTA = 'rpad_schema_requiere_nota_test';
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta (para no confundir una palabra de la cabecera con una sentencia)
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--'));

  // La carga inicial que aprobó el usuario con el Excel RPAD-requiere-nota.xlsx: los 45 externos activos
  const IDS_NO = [10, 30, 35, 36, 50, 63, 74, 77, 78, 81];
  const IDS_SI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 22, 23, 25, 27, 32, 33, 42, 44, 46, 48, 52, 53, 54, 56, 57, 58, 59, 61,
    69, 70, 71, 72, 73, 75];
  const IDS_EXTERNOS = [...IDS_NO, ...IDS_SI].sort((a, b) => a - b);
  const TOTAL_DATASETS = 81;

  // Una base con la estructura de schema.sql y, si no se quiere la columna nueva, la de antes de esta entrega
  const crearBase = async ({ conColumna }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_NOTA}\``);
    await root.query(`CREATE DATABASE \`${BASE_NOTA}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_NOTA}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conColumna) await root.query('ALTER TABLE datasets DROP COLUMN requiere_nota');
  };
  // Los 81 datasets del registro: son externos los 45 de la carga y el resto, internos
  const cargarDatasets = async () => {
    await root.query(`INSERT INTO \`${BASE_NOTA}\`.areas (id, nombre) VALUES (1, 'Área de prueba')`);
    const filas = Array.from({ length: TOTAL_DATASETS }, (_, i) => i + 1)
      .map(id => [id, `Dataset ${id}`, 1, 6, 1, IDS_EXTERNOS.includes(id) ? 'externa' : 'interna']);
    await root.query(`INSERT INTO \`${BASE_NOTA}\`.datasets (id, titulo, area_id, frecuencia_id, tema_principal_id, tipo_gestion) VALUES ?`, [filas]);
  };
  const valores = async () => {
    const [filas] = await root.query(`SELECT id, requiere_nota FROM \`${BASE_NOTA}\`.datasets ORDER BY id`);
    return new Map(filas.map(f => [f.id, f.requiere_nota]));
  };
  const conValor = (mapa, valor) => [...mapa].filter(([, v]) => v === valor).map(([id]) => id);

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_NOTA}\``);
  });

  describe('migracion-requiere-nota.sql (estructura)', () => {
    const ARCHIVO = 'migracion-requiere-nota.sql';

    it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y solo agrega (nada de DROP, RENAME ni CHECK)', () => {
      assert.doesNotMatch(codigo(ARCHIVO).join('\n'), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    });

    it('la cabecera dice la spec, que solo agrega y que va ANTES de subir el código', () => {
      const cabecera = sql(ARCHIVO).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
      assert.match(cabecera, /2026-10-20-requiere-nota-y-anexo-reiteracion/);
      assert.match(cabecera, /Solo agrega/);
      assert.match(cabecera, /ANTES de subir el código/);
    });

    it('migracion-requiere-nota.sql se puede repetir y deja NULL', async () => {
      await crearBase({ conColumna: false });
      const anterior = await columnas(root, BASE_NOTA);
      assert.ok(!anterior.some(c => c.startsWith('datasets.requiere_nota ')), 'la base de partida ya tiene la columna');
      await cargarDatasets();
      await root.query(sql(ARCHIVO));
      await root.query(sql(ARCHIVO));
      // Deja exactamente la estructura de schema.sql, con la columna después de tipo_gestion
      assert.deepEqual(await columnas(root, BASE_NOTA), await columnas(root, BASE_TEMPORAL));
      // Y no toca los datos: todos los datasets quedan sin dato
      const mapa = await valores();
      assert.equal(mapa.size, TOTAL_DATASETS);
      assert.equal(conValor(mapa, null).length, TOTAL_DATASETS);
    });
  });

  describe('migracion-requiere-nota-datos.sql (carga inicial)', () => {
    const ARCHIVO = 'migracion-requiere-nota-datos.sql';
    const FORMA = /^UPDATE datasets SET requiere_nota = ([01]) WHERE id = (\d+) AND tipo_gestion = 'externa' AND requiere_nota IS NULL;$/;
    const LINEAS = sql(ARCHIVO).split(/\r?\n/);
    // Una entrada por UPDATE, en el orden del archivo: { id, valor (0 o 1), comentario (la línea de arriba) }
    const UPDATES = LINEAS.map((linea, i) => ({ linea, i })).filter(({ linea }) => /^\s*UPDATE\b/i.test(linea)).map(({ linea, i }) => {
      const m = FORMA.exec(linea);
      assert.ok(m, `UPDATE con una forma distinta de la acordada: ${linea}`);
      return { id: Number(m[2]), valor: Number(m[1]), comentario: LINEAS[i - 1] };
    });
    // La consulta de verificación va comentada, en una sola línea: -- SELECT … ;
    const VERIFICACION = LINEAS.map(l => /^-- (SELECT .+;)$/.exec(l)?.[1]).filter(Boolean);

    it('se pega tal cual en phpMyAdmin: empieza con SET NAMES utf8mb4 y solo escribe UPDATE sobre datasets', () => {
      const sentencias = codigo(ARCHIVO);
      assert.equal(sentencias[0], 'SET NAMES utf8mb4;');
      for (const l of sentencias.slice(1)) assert.match(l, FORMA, `sentencia inesperada: ${l}`);
      assert.doesNotMatch(sentencias.join('\n'), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    });

    it('la cabecera dice la spec, el orden (después de la estructura y ANTES de subir el código) y que se corre una sola vez', () => {
      const cabecera = LINEAS.filter(l => l.startsWith('--')).join('\n');
      assert.match(cabecera, /2026-10-20-requiere-nota-y-anexo-reiteracion/);
      assert.match(cabecera, /migracion-requiere-nota\.sql/);
      assert.match(cabecera, /Excel/);
      assert.match(cabecera, /20\/10\/2026/);
      assert.match(cabecera, /DESPUÉS de migracion-requiere-nota\.sql y ANTES de subir el código/);
      assert.match(cabecera, /UNA SOLA VEZ/);
    });

    it('hay un UPDATE por cada uno de los 45 externos de la carga (10 en 0 y 35 en 1), sin repetir', () => {
      assert.equal(UPDATES.length, 45);
      assert.deepEqual(UPDATES.map(u => u.id).sort((a, b) => a - b), IDS_EXTERNOS);
      assert.deepEqual(UPDATES.filter(u => u.valor === 0).map(u => u.id).sort((a, b) => a - b), [...IDS_NO].sort((a, b) => a - b));
      assert.deepEqual(UPDATES.filter(u => u.valor === 1).map(u => u.id).sort((a, b) => a - b), [...IDS_SI].sort((a, b) => a - b));
    });

    it('cada UPDATE lleva arriba el comentario con su id y el título del dataset', () => {
      for (const { id, comentario } of UPDATES) {
        assert.match(comentario ?? '', new RegExp(`^-- ${id}\\. \\S`), `id ${id}: sin comentario con el título`);
      }
    });

    it('termina con la consulta de verificación comentada: ningún externo activo queda sin dato', () => {
      assert.deepEqual(VERIFICACION, ["SELECT id, titulo FROM datasets WHERE activo = 1 AND tipo_gestion = 'externa' AND requiere_nota IS NULL;"]);
      const cabecera = LINEAS.filter(l => l.startsWith('--')).join('\n');
      assert.match(cabecera, /0 filas/);
    });

    it('migracion-requiere-nota-datos.sql: los 10 «No» quedan en 0, los 35 «Sí» en 1, los internos en NULL y no pisa un valor ya cargado', async () => {
      await crearBase({ conColumna: true });
      await cargarDatasets();
      await root.query(sql(ARCHIVO));
      const mapa = await valores();
      assert.deepEqual(conValor(mapa, 0), [...IDS_NO].sort((a, b) => a - b));
      assert.deepEqual(conValor(mapa, 1), [...IDS_SI].sort((a, b) => a - b));
      const internos = Array.from({ length: TOTAL_DATASETS }, (_, i) => i + 1).filter(id => !IDS_EXTERNOS.includes(id));
      assert.equal(internos.length, 36);
      assert.deepEqual(conValor(mapa, null), internos);

      // Un cambio aprobado después de la carga (uno de «No» a «Sí» y uno de «Sí» a «No») sobrevive a una segunda corrida
      await root.query(`UPDATE \`${BASE_NOTA}\`.datasets SET requiere_nota = 1 WHERE id = 10`);
      await root.query(`UPDATE \`${BASE_NOTA}\`.datasets SET requiere_nota = 0 WHERE id = 1`);
      await root.query(sql(ARCHIVO));
      const repetido = await valores();
      assert.equal(repetido.get(10), 1);
      assert.equal(repetido.get(1), 0);
      assert.deepEqual(conValor(repetido, 0), [1, ...IDS_NO.filter(id => id !== 10)].sort((a, b) => a - b));
      assert.deepEqual(conValor(repetido, 1), [10, ...IDS_SI.filter(id => id !== 1)].sort((a, b) => a - b));
    });

    it('no carga un dataset de la lista que pasó a gestión interna (queda en NULL)', async () => {
      await crearBase({ conColumna: true });
      await cargarDatasets();
      await root.query(`UPDATE \`${BASE_NOTA}\`.datasets SET tipo_gestion = 'interna' WHERE id IN (1, 10)`);
      await root.query(sql(ARCHIVO));
      const mapa = await valores();
      assert.equal(mapa.get(1), null);
      assert.equal(mapa.get(10), null);
      assert.equal(mapa.get(2), 1);
      assert.equal(mapa.get(30), 0);
    });

    it('la consulta de verificación da 45 filas antes de la carga y 0 después', async () => {
      await crearBase({ conColumna: true });
      await cargarDatasets();
      const consulta = VERIFICACION[0].replace('FROM datasets', `FROM \`${BASE_NOTA}\`.datasets`);
      const [antes] = await root.query(consulta);
      assert.equal(antes.length, 45);
      await root.query(sql(ARCHIVO));
      const [despues] = await root.query(consulta);
      assert.equal(despues.length, 0, JSON.stringify(despues));
    });
  });
});

// Rollback de la entrega 3 (spec 2026-10-15-dias-habiles-licencias-auditoria, 11.2 y 14), sobre una base descartable creada
// con schema.sql: con editores, sin editores, repetido, y la migración vuelve a dejar la estructura de schema.sql
describe('rollback y migración de la entrega 3 (editor y auditoría)', () => {
  const BASE_ROLLBACK = 'rpad_schema_rollback_test';
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  const crearDesdeSchema = async () => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_ROLLBACK}\``);
    await root.query(`CREATE DATABASE \`${BASE_ROLLBACK}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_ROLLBACK}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  };
  const crearUsuario = (username, rol) => root.query(
    `INSERT INTO \`${BASE_ROLLBACK}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, 'x', ?, ?, ?)`,
    [username, username, `${username}@rpad.test`, rol]
  );

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_ROLLBACK}\``);
  });

  it('con editores: los pasa a admin, el rol vuelve a tres valores y notas_digitales.tipo queda ampliado', async () => {
    await crearDesdeSchema();
    await crearUsuario('t_editor', 'editor');
    await crearUsuario('t_admin', 'admin');
    await crearUsuario('t_lector', 'lector');
    await root.query(sql('rollback-editor-auditoria.sql'));
    const lista = await columnas(root, BASE_ROLLBACK);
    assert.ok(lista.includes("usuarios.rol enum('superadmin','admin','lector') null=NO default='lector' key="),
      lista.filter(c => c.startsWith('usuarios.rol')).join('\n'));
    const [filas] = await root.query(`SELECT username, rol FROM \`${BASE_ROLLBACK}\`.usuarios ORDER BY username`);
    assert.deepEqual(filas.map(f => [f.username, f.rol]), [['t_admin', 'admin'], ['t_editor', 'admin'], ['t_lector', 'lector']]);
    for (const quitada of ['cambios_pendientes.primer_recordatorio_at ', 'cambios_pendientes.revisado_como_respaldo ',
      'cambios_pendientes.aviso_sin_auditores_at ', 'notas_digitales_config.para_auditoria ', 'notas_digitales_config.cc_auditoria ', 'notas_digitales_cambios.']) {
      assert.ok(!lista.some(c => c.startsWith(quitada)), `quedó: ${quitada}`);
    }
    assert.ok(lista.some(c => c.startsWith("notas_digitales.tipo enum('aviso','reiteracion','autorizacion','auditoria') null=NO")),
      lista.filter(c => c.startsWith('notas_digitales.tipo')).join('\n'));
  });

  it('sin editores: se puede repetir, y la migración (dos veces) vuelve a dejar exactamente la estructura de schema.sql', async () => {
    await crearDesdeSchema();
    const original = await columnas(root, BASE_ROLLBACK);
    await root.query(sql('rollback-editor-auditoria.sql'));
    await root.query(sql('rollback-editor-auditoria.sql'));
    await root.query(sql('migracion-editor-auditoria.sql'));
    await root.query(sql('migracion-editor-auditoria.sql'));
    // Esa migración es anterior al rol colaborador (spec 2026-10-24-notas-dgmit): lo vuelve a dejar migracion-notas-dgmit.sql
    await root.query(sql('migracion-notas-dgmit.sql'));
    assert.deepEqual(await columnas(root, BASE_ROLLBACK), original);
  });
});

// El editor audita sin responsabilidad por la auditoría (spec 2026-10-20-editor-sin-responsabilidad): la migración y su
// rollback, sobre una base descartable creada con schema.sql
describe('migración del editor que audita sin responsabilidad', () => {
  const BASE_SIN_RESPONSABILIDAD = 'rpad_schema_sin_responsabilidad_test';
  const MIGRACION = 'migracion-editor-sin-responsabilidad.sql';
  const ROLLBACK = 'rollback-editor-sin-responsabilidad.sql';
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  // La estructura de schema.sql y, si no se quiere la columna nueva, la de antes de esta entrega
  const crearBase = async ({ conColumna }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_SIN_RESPONSABILIDAD}\``);
    await root.query(`CREATE DATABASE \`${BASE_SIN_RESPONSABILIDAD}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_SIN_RESPONSABILIDAD}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conColumna) await root.query('ALTER TABLE cambios_pendientes DROP COLUMN revisado_sin_responsabilidad');
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_SIN_RESPONSABILIDAD}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
  });

  it('las cabeceras dicen la spec, el orden y cómo se deshace', () => {
    assert.match(cabecera(MIGRACION), /2026-10-20-editor-sin-responsabilidad/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    assert.match(cabecera(MIGRACION), /ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /rollback-editor-sin-responsabilidad\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /rollback-editor-auditoria\.sql/);
  });

  it('la migración se puede repetir y deja exactamente la estructura de schema.sql', async () => {
    await crearBase({ conColumna: false });
    const anterior = await columnas(root, BASE_SIN_RESPONSABILIDAD);
    assert.ok(!anterior.some(c => c.startsWith('cambios_pendientes.revisado_sin_responsabilidad ')), 'la base de partida ya tiene la columna');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_SIN_RESPONSABILIDAD), await columnas(root, BASE_TEMPORAL));
  });

  it('el rollback se puede repetir y solo quita la columna nueva; la migración la vuelve a dejar en su lugar', async () => {
    await crearBase({ conColumna: true });
    const original = await columnas(root, BASE_SIN_RESPONSABILIDAD);
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    const sinColumna = original.filter(c => !c.startsWith('cambios_pendientes.revisado_sin_responsabilidad '));
    assert.equal(sinColumna.length, original.length - 1);
    assert.deepEqual(await columnas(root, BASE_SIN_RESPONSABILIDAD), sinColumna);
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_SIN_RESPONSABILIDAD), original);
  });
});

// Notas DGMIT (spec 2026-10-24-notas-dgmit, 4 y 11): el rol Colaborador y las tres tablas. La migración y su vuelta atrás,
// sobre una base descartable creada con schema.sql
describe('migración de las notas DGMIT', () => {
  const BASE_DGMIT = 'rpad_schema_notas_dgmit_test';
  const MIGRACION = 'migracion-notas-dgmit.sql';
  const ROLLBACK = 'rollback-notas-dgmit.sql';
  const ROL_ANTERIOR = "usuarios.rol enum('superadmin','admin','editor','lector') null=NO default='lector' key=";
  const ROL_NUEVO = "usuarios.rol enum('superadmin','admin','editor','colaborador','lector') null=NO default='lector' key=";
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_DGMIT}\``);
    await root.query(`CREATE DATABASE \`${BASE_DGMIT}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_DGMIT}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query(`
        DROP TABLE notas_dgmit_historial;
        DROP TABLE notas_dgmit_datasets;
        DROP TABLE notas_dgmit;
        ALTER TABLE usuarios MODIFY COLUMN rol enum('superadmin','admin','editor','lector') NOT NULL DEFAULT 'lector';`);
    }
  };
  const crearUsuario = async (username, rol) => {
    const [{ insertId }] = await root.query(
      `INSERT INTO \`${BASE_DGMIT}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, 'x', ?, ?, ?)`,
      [username, username, `${username}@rpad.test`, rol]
    );
    return insertId;
  };
  // Una nota con un dataset y una anulación: lo que la vuelta atrás tiene que poder borrar con las FK puestas
  const cargarUnaNota = async (usuarioId) => {
    await root.query(`
      INSERT INTO \`${BASE_DGMIT}\`.areas (id, nombre) VALUES (1, 'Área de prueba');
      INSERT INTO \`${BASE_DGMIT}\`.datasets (id, titulo, area_id, frecuencia_id, tema_principal_id) VALUES (1, 'Dataset de prueba', 1, 6, 1);`);
    await root.query(`INSERT INTO \`${BASE_DGMIT}\`.notas_dgmit (id, numero, tipo, recibida, creado_por) VALUES (1, 'NO-2026-0001', 'solicitud', '2026-10-01', ?)`, [usuarioId]);
    await root.query(`INSERT INTO \`${BASE_DGMIT}\`.notas_dgmit_datasets (nota_id, dataset_id) VALUES (1, 1)`);
    await root.query(`INSERT INTO \`${BASE_DGMIT}\`.notas_dgmit_historial (nota_id, accion, motivo, usuario_id) VALUES (1, 'anulacion', 'Prueba', ?)`, [usuarioId]);
  };
  const roles = async () => {
    const [filas] = await root.query(`SELECT username, rol FROM \`${BASE_DGMIT}\`.usuarios ORDER BY username`);
    return filas.map(f => [f.username, f.rol]);
  };
  const sinTablas = (lista) => !lista.some(c => c.startsWith('notas_dgmit'));

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_DGMIT}\``);
  });

  describe('migracion-notas-dgmit.sql', () => {
    it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y solo agrega (nada de DROP, RENAME ni CHECK)', () => {
      assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    });

    it('la cabecera dice la spec y que va ANTES de subir el código', () => {
      assert.match(cabecera(MIGRACION), /2026-10-24-notas-dgmit/);
      assert.match(cabecera(MIGRACION), /Solo agrega/);
      assert.match(cabecera(MIGRACION), /ANTES de subir el código/);
      assert.match(cabecera(MIGRACION), /rollback-notas-dgmit\.sql/);
    });

    it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
      await crearBase({ conLoNuevo: false });
      const anterior = await columnas(root, BASE_DGMIT);
      assert.ok(sinTablas(anterior), 'la base de partida ya tiene las tablas');
      assert.ok(anterior.includes(ROL_ANTERIOR), anterior.filter(c => c.startsWith('usuarios.rol')).join('\n'));
      await root.query(sql(MIGRACION));
      await root.query(sql(MIGRACION));
      assert.deepEqual(await columnas(root, BASE_DGMIT), await columnas(root, BASE_TEMPORAL));
      // Y también las claves foráneas y los índices, que las columnas no muestran
      assert.deepEqual(await clavesAjenasDgmit(root, BASE_DGMIT), await clavesAjenasDgmit(root, BASE_TEMPORAL));
      assert.deepEqual(await indicesDgmit(root, BASE_DGMIT), await indicesDgmit(root, BASE_TEMPORAL));
    });

    it('no cambia el rol de nadie y desde entonces admite colaborador', async () => {
      await crearBase({ conLoNuevo: false });
      for (const rol of ['superadmin', 'admin', 'editor', 'lector']) await crearUsuario(`t_${rol}`, rol);
      await root.query(sql(MIGRACION));
      assert.deepEqual(await roles(), [['t_admin', 'admin'], ['t_editor', 'editor'], ['t_lector', 'lector'], ['t_superadmin', 'superadmin']]);
      await crearUsuario('t_colaborador', 'colaborador');
      assert.deepEqual((await roles()).find(([username]) => username === 't_colaborador'), ['t_colaborador', 'colaborador']);
    });
  });

  describe('rollback-notas-dgmit.sql', () => {
    it('se pega tal cual en phpMyAdmin, y su cabecera dice el orden, que se pierden las notas y que va antes que las del editor', () => {
      assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
      assert.match(cabecera(ROLLBACK), /migracion-notas-dgmit\.sql/);
      assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
      assert.match(cabecera(ROLLBACK), /se pierden/i);
      assert.match(cabecera(ROLLBACK), /colaborador/i);
      assert.match(cabecera(ROLLBACK), /rollback-editor-auditoria\.sql/);
      // Borra primero el historial, después los vínculos y al final la nota: así no choca con sus FK
      const borrados = [...codigo(ROLLBACK).matchAll(/DROP TABLE IF EXISTS `(\w+)`/gi)].map(m => m[1]);
      assert.deepEqual(borrados, ['notas_dgmit_historial', 'notas_dgmit_datasets', 'notas_dgmit']);
    });

    it('sin colaboradores: borra las tres tablas y el rol vuelve a cuatro valores', async () => {
      await crearBase({ conLoNuevo: true });
      await crearUsuario('t_editor', 'editor');
      const autor = await crearUsuario('t_lector', 'lector');
      await cargarUnaNota(autor);
      await root.query(sql(ROLLBACK));
      await root.query(sql(ROLLBACK));
      const lista = await columnas(root, BASE_DGMIT);
      assert.ok(sinTablas(lista), lista.filter(c => c.startsWith('notas_dgmit')).join('\n'));
      assert.ok(lista.includes(ROL_ANTERIOR), lista.filter(c => c.startsWith('usuarios.rol')).join('\n'));
      assert.deepEqual(await roles(), [['t_editor', 'editor'], ['t_lector', 'lector']]);
      // La migración vuelve a dejar exactamente la estructura de schema.sql
      await root.query(sql(MIGRACION));
      assert.deepEqual(await columnas(root, BASE_DGMIT), await columnas(root, BASE_TEMPORAL));
      assert.deepEqual(await clavesAjenasDgmit(root, BASE_DGMIT), await clavesAjenasDgmit(root, BASE_TEMPORAL));
    });

    it('con un colaborador: lo pasa a lector y el rol vuelve a cuatro valores', async () => {
      await crearBase({ conLoNuevo: true });
      const colaborador = await crearUsuario('t_colaborador', 'colaborador');
      await crearUsuario('t_editor', 'editor');
      await cargarUnaNota(colaborador);
      await root.query(sql(ROLLBACK));
      const lista = await columnas(root, BASE_DGMIT);
      assert.ok(lista.includes(ROL_ANTERIOR), lista.filter(c => c.startsWith('usuarios.rol')).join('\n'));
      assert.ok(!lista.includes(ROL_NUEVO));
      assert.ok(sinTablas(lista));
      assert.deepEqual(await roles(), [['t_colaborador', 'lector'], ['t_editor', 'editor']]);
    });

    it('en el orden de la cabecera, antes que la vuelta atrás del editor, aun con un colaborador y un editor', async () => {
      await crearBase({ conLoNuevo: true });
      await crearUsuario('t_colaborador', 'colaborador');
      await crearUsuario('t_editor', 'editor');
      await crearUsuario('t_admin', 'admin');
      await root.query(sql(ROLLBACK));
      await root.query(sql('rollback-editor-sin-responsabilidad.sql'));
      await root.query(sql('rollback-editor-auditoria.sql'));
      const lista = await columnas(root, BASE_DGMIT);
      assert.ok(lista.includes("usuarios.rol enum('superadmin','admin','lector') null=NO default='lector' key="),
        lista.filter(c => c.startsWith('usuarios.rol')).join('\n'));
      assert.deepEqual(await roles(), [['t_admin', 'admin'], ['t_colaborador', 'lector'], ['t_editor', 'admin']]);
    });
  });
});

// Métricas y Reportes (spec 2026-10-24-metricas-y-reportes, 3 y 4): la foto anual de las métricas y los «Recibido el»
// importados. La migración y su vuelta atrás, sobre una base descartable creada con schema.sql
describe('migracion-metricas.sql', () => {
  const BASE_METRICAS = 'rpad_schema_metricas_test';
  const MIGRACION = 'migracion-metricas.sql';
  const ROLLBACK = 'rollback-metricas.sql';
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  const esDeLasTablas = (c) => TABLAS_METRICAS.some(tabla => c.startsWith(`${tabla}.`));
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega (la de main)
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_METRICAS}\``);
    await root.query(`CREATE DATABASE \`${BASE_METRICAS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_METRICAS}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query(`
        DROP TABLE actualizaciones_recibido;
        DROP TABLE metricas_fotos;`);
    }
  };
  // Una foto y un «Recibido el» importado: lo que la vuelta atrás tiene que poder borrar con la FK puesta
  const cargarDatos = async () => {
    const [{ insertId: usuario }] = await root.query(
      `INSERT INTO \`${BASE_METRICAS}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_editor', 'x', 't_editor', 't_editor@rpad.test', 'editor')`);
    const [{ insertId: cambio }] = await root.query(
      `INSERT INTO \`${BASE_METRICAS}\`.cambios_pendientes (tipo_cambio, datos_nuevos, usuario_id, estado) VALUES ('editar', '{}', ?, 'aprobado')`, [usuario]);
    await root.query(`INSERT INTO \`${BASE_METRICAS}\`.metricas_fotos (anio, al, datos) VALUES (2026, '2026-12-31', '{"version":1}')`);
    await root.query(`INSERT INTO \`${BASE_METRICAS}\`.actualizaciones_recibido (cambio_id, recibido_el, origen_datos) VALUES (?, '2026-03-02', 'area')`, [cambio]);
  };
  const contarEn = async (tabla) => {
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_METRICAS}\`.\`${tabla}\``);
    return total;
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_METRICAS}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega (nada de DROP, RENAME ni CHECK)', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
  });

  it('las cabeceras dicen la spec, el orden, que se puede repetir y cómo se deshace; el rollback, que se pierden la foto y lo importado', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-24-metricas-y-reportes-design\.md/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-metricas\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-metricas\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /se pierden/i);
    assert.match(cabecera(ROLLBACK), /foto/);
    assert.match(cabecera(ROLLBACK), /importad/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
    await crearBase({ conLoNuevo: false });
    const anterior = await columnas(root, BASE_METRICAS);
    assert.ok(!anterior.some(esDeLasTablas), 'la base de partida ya tiene las tablas');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_METRICAS), await columnas(root, BASE_TEMPORAL));
    // Y también la clave foránea y las claves primarias, que las columnas no muestran del todo
    assert.deepEqual(await clavesAjenasDe(root, BASE_METRICAS, TABLAS_METRICAS), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_METRICAS));
    assert.deepEqual(await indicesDe(root, BASE_METRICAS, TABLAS_METRICAS), await indicesDe(root, BASE_TEMPORAL, TABLAS_METRICAS));
  });

  it('el rollback deja la estructura anterior', async () => {
    await crearBase({ conLoNuevo: true });
    await cargarDatos();
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    // La estructura de main: la de schema.sql sin las dos tablas
    const deMain = (await columnas(root, BASE_TEMPORAL)).filter(c => !esDeLasTablas(c));
    assert.deepEqual(await columnas(root, BASE_METRICAS), deMain);
    // El cambio al que apuntaba el «Recibido el» importado sigue ahí
    assert.equal(await contarEn('cambios_pendientes'), 1);
    // La migración vuelve a dejar exactamente la estructura de schema.sql
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_METRICAS), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await clavesAjenasDe(root, BASE_METRICAS, TABLAS_METRICAS), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_METRICAS));
  });
});

// Los «Recibido el» y los orígenes de las actualizaciones viejas, del Excel que completó el usuario (spec
// 2026-10-24-metricas-y-reportes, 4). Acá, sobre una base de prueba con cambios inventados: la forma, que se puede repetir, que un
// cambio que no existe no hace nada y qué lista la consulta de verificación. La cuenta con la base real («quedan 5 sin Recibido
// el») se verifica una vez contra la base de la rama, fuera de la suite: los datos reales no se versionan.
describe('migracion-metricas-recibido-datos.sql', () => {
  const BASE_RECIBIDO = 'rpad_schema_recibido_test';
  const RUTA = new URL('../database/updates/migracion-metricas-recibido-datos.sql', import.meta.url);
  // Se lee en cada test: si el archivo falta, falla cada uno y no el archivo de tests entero
  const archivo = () => fs.readFileSync(RUTA, 'utf8');
  const lineas = () => archivo().split(/\r?\n/);
  // Sin los comentarios: lo que de verdad se ejecuta
  const sentencias = () => lineas().filter(l => l.trim() && !l.trim().startsWith('--'));
  const FORMA = /^INSERT INTO actualizaciones_recibido \(cambio_id, recibido_el, origen_datos\) SELECT (\d+), (?:NULL|'(\d{4}-\d{2}-\d{2})'), (?:NULL|'(area|fuente_publica)') FROM cambios_pendientes WHERE id = (\d+) ON DUPLICATE KEY UPDATE recibido_el = VALUES\(recibido_el\), origen_datos = VALUES\(origen_datos\);$/;
  const esInsert = (linea) => /^\s*INSERT\b/i.test(linea);
  // Uno por INSERT, en el orden del archivo: { cambio (el del SELECT), id (el del WHERE), recibido, origen }
  const inserts = () => sentencias().filter(esInsert).map((linea) => {
    const m = FORMA.exec(linea);
    assert.ok(m, `INSERT con una forma distinta de la acordada: ${linea}`);
    return { cambio: Number(m[1]), recibido: m[2] ?? null, origen: m[3] ?? null, id: Number(m[4]) };
  });
  // La consulta de verificación va comentada, en un solo renglón: -- SELECT … ;
  const verificacion = () => lineas().map(l => /^-- (SELECT .+;)$/.exec(l)?.[1]).filter(Boolean);
  const esFecha = (texto) => {
    const fecha = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
  };
  const ordenados = (ids) => [...ids].sort((a, b) => a - b);

  // Una base con la estructura de schema.sql y un usuario que propone los cambios; devuelve su id
  const crearBase = async () => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_RECIBIDO}\``);
    await root.query(`CREATE DATABASE \`${BASE_RECIBIDO}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_RECIBIDO}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    const [{ insertId }] = await root.query(
      `INSERT INTO \`${BASE_RECIBIDO}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_editor', 'x', 't_editor', 't_editor@rpad.test', 'editor')`);
    return insertId;
  };
  // Una actualización como las del Excel, sin «Recibido el»: la registrada con el modal (registro_actualizacion, con
  // recibido_el en null) o la de la edición de antes (mueve la carga y la próxima, sin la clave); la carga anterior, con la
  // fecha vieja de datos_anteriores (2025-07-31T03:00:00.000Z). [id, tipo_cambio, datos_nuevos, datos_anteriores, estado]
  const actualizacion = (id, { registro = true, recibido = null, estado = 'aprobado' } = {}) => [id, 'editar',
    JSON.stringify({
      ultima_actualizacion: '2026-03-02', proxima_actualizacion: '2027-01-31',
      ...(registro ? { registro_actualizacion: true, recibido_el: recibido } : (recibido ? { recibido_el: recibido } : {}))
    }),
    JSON.stringify({ ultima_actualizacion: '2025-07-31T03:00:00.000Z', proxima_actualizacion: '2026-01-31' }), estado];
  const cargarCambios = async (usuario, filas) => {
    await root.query(
      `INSERT INTO \`${BASE_RECIBIDO}\`.cambios_pendientes (id, tipo_cambio, datos_nuevos, datos_anteriores, estado, usuario_id) VALUES ?`,
      [filas.map(f => [...f, usuario])]);
  };
  const correr = async () => {
    await root.query(`USE \`${BASE_RECIBIDO}\``);
    await root.query(archivo());
  };
  const importados = async () => {
    const [filas] = await root.query(
      `SELECT cambio_id, DATE_FORMAT(recibido_el, '%Y-%m-%d') recibido, origen_datos FROM \`${BASE_RECIBIDO}\`.actualizaciones_recibido ORDER BY cambio_id`);
    return filas.map(f => ({ cambio: f.cambio_id, recibido: f.recibido, origen: f.origen_datos }));
  };
  const cambios = async () => {
    const [filas] = await root.query(`SELECT id, tipo_cambio, datos_nuevos, datos_anteriores, estado FROM \`${BASE_RECIBIDO}\`.cambios_pendientes ORDER BY id`);
    return filas;
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_RECIBIDO}\``);
  });

  it('existe y se pega tal cual en phpMyAdmin: empieza con SET NAMES utf8mb4 y solo escribe INSERT con la forma acordada (sin DELIMITER, USE, DROP, RENAME ni CHECK)', () => {
    assert.ok(fs.existsSync(RUTA), 'falta database/updates/migracion-metricas-recibido-datos.sql');
    const [primera, ...resto] = sentencias();
    assert.equal(primera, 'SET NAMES utf8mb4;');
    assert.ok(resto.length > 0, 'no hay ningún INSERT');
    for (const linea of resto) assert.match(linea, FORMA, `sentencia inesperada: ${linea}`);
    assert.doesNotMatch(sentencias().join('\n'), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
  });

  it('la cabecera dice la spec, el Excel, que no lleva las observaciones, el orden (después de migracion-metricas.sql y antes del 10/01/2027), que se puede repetir y cómo se verifica', () => {
    const cabecera = lineas().filter(l => l.startsWith('--')).join('\n');
    assert.match(cabecera, /docs\/superpowers\/specs\/2026-10-24-metricas-y-reportes-design\.md/);
    assert.match(cabecera, /Excel/);
    assert.match(cabecera, /observaciones del Excel no se importan/);
    assert.match(cabecera, /ORDEN: correr DESPUÉS de migracion-metricas\.sql/);
    assert.match(cabecera, /ANTES del 10\/01\/2027/);
    assert.match(cabecera, /Se puede volver a correr/);
    assert.match(cabecera, /VERIFICACIÓN/);
  });

  it('28 INSERT: uno por cada fila del Excel con fecha u origen (27) y, al final, el origen confirmado del cambio 51; sin repetir, el mismo cambio en el SELECT y en el WHERE, y una fecha válida o un origen', () => {
    const lista = inserts();
    assert.equal(lista.length, 28);
    // El último no sale del Excel (Ruling 35): el cambio 51 ya trae su «Recibido el»; se le suma solo el origen que confirmó el usuario
    assert.deepEqual(lista.at(-1), { cambio: 51, recibido: null, origen: 'fuente_publica', id: 51 });
    assert.match(lineas().filter(l => l.startsWith('--')).join('\n'), /cambio 51[^]*NO sale del Excel[^]*línea 13/);
    assert.equal(new Set(lista.map(i => i.cambio)).size, lista.length, 'hay un cambio repetido');
    for (const { cambio, id, recibido, origen } of lista) {
      assert.equal(id, cambio, `el SELECT y el WHERE no dicen el mismo cambio: ${cambio} y ${id}`);
      assert.ok(recibido !== null || origen !== null, `el cambio ${cambio} no trae ni la fecha ni el origen`);
      if (recibido !== null) {
        assert.ok(esFecha(recibido) && recibido >= '2025-01-01' && recibido <= '2026-10-24', `fecha inválida en el cambio ${cambio}: ${recibido}`);
      }
    }
  });

  it('solo ids, fechas y orígenes: ningún renglón entre los INSERT (ni un comentario con el título del dataset) y la verificación al final, comentada y en un solo renglón', () => {
    const todas = lineas();
    const posiciones = todas.map((l, i) => (esInsert(l) ? i : -1)).filter(i => i >= 0);
    assert.ok(posiciones.length > 0, 'no hay ningún INSERT');
    assert.deepEqual(todas.slice(posiciones[0], posiciones.at(-1) + 1).filter(l => !esInsert(l)), []);
    const consultas = verificacion();
    assert.equal(consultas.length, 1);
    assert.ok(todas.findIndex(l => l === `-- ${consultas[0]}`) > posiciones.at(-1), 'la verificación no está al final');
    assert.match(consultas[0], /FROM cambios_pendientes c LEFT JOIN actualizaciones_recibido r ON r\.cambio_id = c\.id/);
  });

  it('se puede repetir y un cambio que no existe no hace nada: dos corridas dejan una fila por cambio, con su fecha y su origen, y no tocan los cambios', async () => {
    const usuario = await crearBase();
    const [faltante, ...resto] = inserts();
    // Todos los cambios del archivo menos el primero, que en esta base no existe; la mitad registrados con el modal y la otra mitad
    // con la edición de antes
    await cargarCambios(usuario, resto.map((ins, i) => actualizacion(ins.cambio, { registro: i % 2 === 0 })));
    // Uno ya tenía algo importado, con otra fecha y sin origen: se vuelve a escribir con lo del archivo (no se duplica)
    await root.query(
      `INSERT INTO \`${BASE_RECIBIDO}\`.actualizaciones_recibido (cambio_id, recibido_el, origen_datos) VALUES (?, '2025-01-02', NULL)`, [resto[0].cambio]);
    const antes = await cambios();
    await correr();
    await correr();
    const esperado = resto.map(({ cambio, recibido, origen }) => ({ cambio, recibido, origen })).sort((a, b) => a.cambio - b.cambio);
    assert.deepEqual(await importados(), esperado);
    // El que no existe no dejó fila ni frenó la corrida, y no se creó
    assert.ok(!(await importados()).some(f => f.cambio === faltante.cambio));
    assert.deepEqual(await cambios(), antes);
    assert.ok(!(await cambios()).some(c => c.id === faltante.cambio));
  });

  it('la consulta de verificación lista las actualizaciones aprobadas que siguen sin «Recibido el», antes y después de la carga', async () => {
    const usuario = await crearBase();
    const delArchivo = inserts();
    const SIN_IMPORTAR = 9001;
    const DE_LA_EDICION = 9005;
    // Los del archivo que solo traen el origen (el cambio 51) son, como en la base real, actualizaciones que ya tienen su «Recibido el»:
    // no figuran ni antes ni después. Los demás, sin la fecha, la mitad registrados con el modal y la otra mitad por la edición de antes
    const soloOrigen = new Set(delArchivo.filter(i => i.recibido === null).map(i => i.cambio));
    assert.ok(soloOrigen.has(51), 'el cambio 51 no está en el archivo como «solo el origen»');
    await cargarCambios(usuario, [
      ...delArchivo.map((ins, i) => actualizacion(ins.cambio, { registro: i % 2 === 0, recibido: soloOrigen.has(ins.cambio) ? '2026-10-19' : null })),
      // Una actualización aprobada sin la fecha que no está en el archivo (registrada con el modal y por la edición de antes)
      actualizacion(SIN_IMPORTAR),
      actualizacion(DE_LA_EDICION, { registro: false }),
      // No se listan: una con «Recibido el», una rechazada, una edición que solo mueve la próxima, una que solo mueve la carga y un alta
      actualizacion(9002, { recibido: '2026-03-01' }),
      actualizacion(9003, { registro: false, recibido: '2026-03-01' }),
      actualizacion(9004, { estado: 'rechazado' }),
      [9006, 'editar', JSON.stringify({ proxima_actualizacion: '2027-01-31' }), JSON.stringify({ proxima_actualizacion: '2026-01-31' }), 'aprobado'],
      [9007, 'editar', JSON.stringify({ ultima_actualizacion: '2026-03-02', proxima_actualizacion: '2026-01-31' }),
        JSON.stringify({ ultima_actualizacion: '2025-07-31T03:00:00.000Z', proxima_actualizacion: '2026-01-31' }), 'aprobado'],
      [9008, 'crear', JSON.stringify({ titulo: 'Dataset de prueba', ultima_actualizacion: '2026-03-02', proxima_actualizacion: '2027-01-31' }), null, 'aprobado']
    ]);
    const [consulta] = verificacion();
    const listados = async () => {
      await root.query(`USE \`${BASE_RECIBIDO}\``);
      const [filas] = await root.query(consulta);
      return filas.map(f => f.cambio_id);
    };
    assert.deepEqual(await listados(), ordenados([...delArchivo.filter(i => !soloOrigen.has(i.cambio)).map(i => i.cambio), SIN_IMPORTAR, DE_LA_EDICION]));
    await correr();
    // Después de la carga quedan solo los que no están en el archivo (el 51 tampoco figura: su fecha es la suya, no la importada)
    assert.deepEqual(await listados(), [SIN_IMPORTAR, DE_LA_EDICION]);
  });
});

// Generador de Notas (spec 2026-10-24-generador-de-notas, 2 y 8, y Anexo A): el ámbito de las áreas (municipal o fuera del
// municipio) y la clasificación inicial de las 13 de afuera. La migración y su vuelta atrás, sobre una base descartable creada
// con schema.sql
describe('migración del generador de notas', () => {
  const BASE_GENERADOR = 'rpad_schema_generador_test';
  const MIGRACION = 'migracion-generador-notas.sql';
  const ROLLBACK = 'rollback-generador-notas.sql';
  // Se leen en cada test: si un archivo falta, falla cada uno y no el archivo de tests entero
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  const lineas = (archivo) => sql(archivo).split(/\r?\n/);
  // Sin los comentarios: lo que de verdad se ejecuta
  const sentencias = (archivo) => lineas(archivo).filter(l => l.trim() && !l.trim().startsWith('--'));
  const codigo = (archivo) => sentencias(archivo).join('\n');
  const cabecera = (archivo) => lineas(archivo).filter(l => l.startsWith('--')).join('\n');
  const FORMA = /^UPDATE areas SET ambito = 'externo' WHERE id = (\d+) AND nombre = '([^']+)';$/;
  const esUpdate = (linea) => /^\s*UPDATE\b/i.test(linea);
  // Uno por UPDATE, en el orden del archivo: { id, nombre, comentario (la línea de arriba) }
  const updates = () => {
    const todas = lineas(MIGRACION);
    return todas.map((linea, i) => ({ linea, i })).filter(({ linea }) => esUpdate(linea)).map(({ linea, i }) => {
      const m = FORMA.exec(linea);
      assert.ok(m, `UPDATE con una forma distinta de la acordada: ${linea}`);
      return { id: Number(m[1]), nombre: m[2], comentario: todas[i - 1] };
    });
  };
  // La consulta de verificación va comentada, en un solo renglón: -- SELECT … ;
  const verificacion = () => lineas(MIGRACION).map(l => /^-- (SELECT .+;)$/.exec(l)?.[1]).filter(Boolean);
  // Las 13 áreas fuera del municipio del Anexo A, confirmadas por el usuario el 24/10/2026
  const IDS_EXTERNOS = [2, 3, 4, 6, 24, 27, 28, 29, 30, 35, 41, 43, 44];
  // Seis áreas con sus textos del dump de producción del 25/10/2026 (las 6 y 35 ya con las correcciones del usuario): cuatro
  // de afuera (la 27 y la 35 sin dependencia) y dos municipales (la 25 con artículo «el»)
  const AREAS = [
    { id: 2, nombre: 'Agencia Provincial de Seguridad Vial', articulo: 'la',
      area_superior: 'Subsecretaría de Seguridad Vial. Ministerio de Seguridad. Provincia del Chubut', articulo_superior: 'la' },
    { id: 6, nombre: 'Dirección de Estadística y Evaluación Educativa', articulo: 'la',
      area_superior: 'Ministerio de Educación del Chubut', articulo_superior: 'el' },
    { id: 18, nombre: 'Dirección General de Recursos Humanos', articulo: 'la',
      area_superior: 'Subsec. de Recursos Humanos. Sec. Gobierno, Modernización y Transparencia', articulo_superior: 'la' },
    { id: 25, nombre: 'Ente Autárquico Comodoro Deportes', articulo: 'el', area_superior: 'Intendencia', articulo_superior: 'la' },
    { id: 27, nombre: 'Honorable Concejo Deliberante de Comodoro Rivadavia', articulo: 'el', area_superior: null, articulo_superior: null },
    { id: 35, nombre: 'Secretaría de Energía de Nación', articulo: 'la', area_superior: null, articulo_superior: null }
  ];
  const esDeLaColumna = (c) => c.startsWith('areas.ambito ');

  // La estructura de schema.sql y, si no se quiere la columna nueva, la de antes de esta entrega (la de main)
  const crearBase = async ({ conColumna }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_GENERADOR}\``);
    await root.query(`CREATE DATABASE \`${BASE_GENERADOR}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_GENERADOR}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conColumna) await root.query('ALTER TABLE areas DROP COLUMN ambito');
  };
  const cargarAreas = async (areas = AREAS) => {
    await root.query(
      `INSERT INTO \`${BASE_GENERADOR}\`.areas (id, nombre, articulo, area_superior, articulo_superior) VALUES ?`,
      [areas.map(a => [a.id, a.nombre, a.articulo, a.area_superior, a.articulo_superior])]);
  };
  const correr = async (archivo) => {
    await root.query(`USE \`${BASE_GENERADOR}\``);
    await root.query(sql(archivo));
  };
  const textos = async () => {
    const [filas] = await root.query(
      `SELECT id, nombre, articulo, area_superior, articulo_superior FROM \`${BASE_GENERADOR}\`.areas ORDER BY id`);
    return filas.map(f => ({ ...f }));
  };
  const ambitos = async () => {
    const [filas] = await root.query(`SELECT id, ambito FROM \`${BASE_GENERADOR}\`.areas ORDER BY id`);
    return Object.fromEntries(filas.map(f => [f.id, f.ambito]));
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_GENERADOR}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER, USE, DROP, RENAME ni CHECK; empieza con SET NAMES utf8mb4, agrega la columna y solo marca áreas como externas', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
    const [primera, ...resto] = sentencias(MIGRACION);
    assert.equal(primera, 'SET NAMES utf8mb4;');
    // Fuera de los UPDATE, solo la columna nueva: ningún UPDATE de nombre, area_superior ni articulo_superior
    assert.equal(resto.filter(l => !esUpdate(l)).join(' ').replace(/\s+/g, ' ').trim(),
      "ALTER TABLE `areas` ADD COLUMN IF NOT EXISTS `ambito` enum('municipal','externo') NOT NULL DEFAULT 'municipal' AFTER `articulo_superior`;");
    for (const linea of resto.filter(esUpdate)) assert.match(linea, FORMA, `sentencia inesperada: ${linea}`);
  });

  it('las cabeceras dicen la spec, el orden, que se puede repetir, cuándo no volver a correrla y cómo se deshace', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-24-generador-de-notas-design\.md/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código y después de migracion-metricas\.sql/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION),
      /Si después alguien cambia en Áreas el ámbito de una de las 13, no la vuelvas a correr: la vuelve a marcar como externa/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-generador-notas\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-generador-notas\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('un UPDATE por cada una de las 13 áreas de afuera, sin repetir, con el comentario «-- <id>. <nombre>» arriba', () => {
    const lista = updates();
    assert.deepEqual(lista.map(u => u.id).sort((a, b) => a - b), IDS_EXTERNOS);
    assert.equal(lista.length, IDS_EXTERNOS.length, 'hay un área repetida');
    for (const { id, nombre, comentario } of lista) {
      assert.equal(comentario, `-- ${id}. ${nombre}`, `área ${id}: sin el comentario con su nombre`);
    }
    // Las cuatro de las seis de prueba van con el nombre tal como está en la base
    for (const area of AREAS.filter(a => IDS_EXTERNOS.includes(a.id))) {
      assert.equal(lista.find(u => u.id === area.id)?.nombre, area.nombre, `área ${area.id}`);
    }
  });

  it('termina con la consulta de verificación comentada: cuántas áreas quedaron fuera del municipio (13)', () => {
    const consultas = verificacion();
    assert.deepEqual(consultas, ["SELECT COUNT(*) AS externas FROM areas WHERE ambito = 'externo';"]);
    const todas = lineas(MIGRACION);
    const ultimoUpdate = todas.map((l, i) => (esUpdate(l) ? i : -1)).filter(i => i >= 0).at(-1);
    assert.ok(todas.indexOf(`-- ${consultas[0]}`) > ultimoUpdate, 'la verificación no está al final');
    assert.match(cabecera(MIGRACION), /\b13\b/);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir: marca las de afuera y no toca los textos', async () => {
    await crearBase({ conColumna: false });
    assert.ok(!(await columnas(root, BASE_GENERADOR)).some(esDeLaColumna), 'la base de partida ya tiene la columna');
    await cargarAreas();
    const antes = await textos();
    await correr(MIGRACION);
    await correr(MIGRACION);
    assert.deepEqual(await columnas(root, BASE_GENERADOR), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await ambitos(), { 2: 'externo', 6: 'externo', 18: 'municipal', 25: 'municipal', 27: 'externo', 35: 'externo' });
    // El nombre, la dependencia y los dos artículos de las seis, sin ningún cambio
    assert.deepEqual(await textos(), antes);
    assert.deepEqual(antes, AREAS);
    // La consulta de verificación cuenta las cuatro de afuera de esta base
    const [[{ externas }]] = await root.query(verificacion()[0].replace('FROM areas', `FROM \`${BASE_GENERADOR}\`.areas`));
    assert.equal(externas, 4);
  });

  it('un área de la lista con otro nombre (un renombre hecho a mano) queda municipal: el UPDATE no la encuentra', async () => {
    await crearBase({ conColumna: false });
    await cargarAreas([{ ...AREAS[0], nombre: 'Agencia Provincial de Seguridad Vial del Chubut' }, AREAS[1]]);
    await correr(MIGRACION);
    assert.deepEqual(await ambitos(), { 2: 'municipal', 6: 'externo' });
    assert.equal((await textos())[0].nombre, 'Agencia Provincial de Seguridad Vial del Chubut');
  });

  it('la vuelta atrás se puede repetir y solo quita la columna (las áreas quedan); la migración la vuelve a dejar en su lugar', async () => {
    await crearBase({ conColumna: true });
    const original = await columnas(root, BASE_GENERADOR);
    await cargarAreas();
    await correr(MIGRACION);
    await correr(ROLLBACK);
    await correr(ROLLBACK);
    const sinColumna = original.filter(c => !esDeLaColumna(c));
    assert.equal(sinColumna.length, original.length - 1);
    assert.deepEqual(await columnas(root, BASE_GENERADOR), sinColumna);
    assert.deepEqual(await textos(), AREAS);
    await correr(MIGRACION);
    assert.deepEqual(await columnas(root, BASE_GENERADOR), original);
    assert.deepEqual(await columnas(root, BASE_GENERADOR), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await ambitos(), { 2: 'externo', 6: 'externo', 18: 'municipal', 25: 'municipal', 27: 'externo', 35: 'externo' });
  });
});

// Feriados (spec 2026-10-26-feriados, 1): los feriados que no son los 9 fijos y los años en que uno que se repite no rige.
// La migración y su vuelta atrás, sobre una base descartable creada con schema.sql
describe('migracion-feriados.sql', () => {
  const BASE_FERIADOS = 'rpad_schema_feriados_test';
  const MIGRACION = 'migracion-feriados.sql';
  const ROLLBACK = 'rollback-feriados.sql';
  // Se leen en cada test: si un archivo falta, falla cada uno y no el archivo de tests entero
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  const esDeLasTablas = (c) => TABLAS_FERIADOS.some(tabla => c.startsWith(`${tabla}.`));
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega (la de main)
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_FERIADOS}\``);
    await root.query(`CREATE DATABASE \`${BASE_FERIADOS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_FERIADOS}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query(`
        DROP TABLE feriados_no_rige;
        DROP TABLE feriados;`);
    }
  };
  // Un feriado que se repite, cargado por un usuario, y un año en que no rige: lo que la vuelta atrás tiene que poder
  // borrar con las FK puestas
  const cargarDatos = async () => {
    const [{ insertId: usuario }] = await root.query(
      `INSERT INTO \`${BASE_FERIADOS}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_admin', 'x', 't_admin', 't_admin@rpad.test', 'admin')`);
    const [{ insertId: feriado }] = await root.query(
      `INSERT INTO \`${BASE_FERIADOS}\`.feriados (fecha, nombre, tipo, se_repite, creado_por) VALUES ('2026-12-13', 'Feriado de prueba', 'municipal', 1, ?)`, [usuario]);
    await root.query(`INSERT INTO \`${BASE_FERIADOS}\`.feriados_no_rige (feriado_id, anio) VALUES (?, 2027)`, [feriado]);
  };
  const contarEn = async (tabla) => {
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_FERIADOS}\`.\`${tabla}\``);
    return total;
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_FERIADOS}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega (nada de DROP, RENAME ni CHECK)', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
  });

  it('las cabeceras dicen la spec, el orden, que se puede repetir y cómo se deshace; el rollback, que se pierden los feriados', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-26-feriados-design\.md/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-feriados\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-feriados\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /se pierden/i);
    // Lo que se pierde, dicho con su nombre (no alcanza con el del archivo)
    assert.match(cabecera(ROLLBACK), /los feriados cargados/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('el rollback borra primero los años que no rigen y después los feriados: así no choca con la FK', () => {
    const borrados = [...codigo(ROLLBACK).matchAll(/DROP TABLE IF EXISTS `(\w+)`/gi)].map(m => m[1]);
    assert.deepEqual(borrados, ['feriados_no_rige', 'feriados']);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
    await crearBase({ conLoNuevo: false });
    const anterior = await columnas(root, BASE_FERIADOS);
    assert.ok(!anterior.some(esDeLasTablas), 'la base de partida ya tiene las tablas');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_FERIADOS), await columnas(root, BASE_TEMPORAL));
    // Y también las claves foráneas y los índices, que las columnas no muestran del todo
    assert.deepEqual(await clavesAjenasDe(root, BASE_FERIADOS, TABLAS_FERIADOS), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_FERIADOS));
    assert.deepEqual(await indicesDe(root, BASE_FERIADOS, TABLAS_FERIADOS), await indicesDe(root, BASE_TEMPORAL, TABLAS_FERIADOS));
  });

  it('el rollback se puede repetir, deja la estructura de main sin borrar al usuario que cargó el feriado, y la migración la recupera', async () => {
    await crearBase({ conLoNuevo: true });
    await cargarDatos();
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    // La estructura de main: la de schema.sql sin las dos tablas
    const deMain = (await columnas(root, BASE_TEMPORAL)).filter(c => !esDeLasTablas(c));
    assert.deepEqual(await columnas(root, BASE_FERIADOS), deMain);
    // El usuario que había cargado el feriado sigue ahí
    assert.equal(await contarEn('usuarios'), 1);
    // La migración vuelve a dejar exactamente la estructura de schema.sql
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_FERIADOS), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await clavesAjenasDe(root, BASE_FERIADOS, TABLAS_FERIADOS), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_FERIADOS));
    assert.deepEqual(await indicesDe(root, BASE_FERIADOS, TABLAS_FERIADOS), await indicesDe(root, BASE_TEMPORAL, TABLAS_FERIADOS));
  });
});

// La precarga de los feriados de 2026 y 2027 (spec 2026-10-26-feriados, 5), con las fechas verificadas de
// docs/superpowers/specs/2026-10-26-feriados-fuentes.md (sección «Respuestas del usuario y lista para la precarga»). Sobre una
// base descartable creada con schema.sql: la forma, la fuente de cada fila, que se puede repetir y que deja exactamente esa lista
describe('migracion-feriados-datos.sql', () => {
  const BASE_DATOS = 'rpad_schema_feriados_datos_test';
  const RUTA = new URL('../database/updates/migracion-feriados-datos.sql', import.meta.url);
  // Se lee en cada test: si el archivo falta, falla cada uno y no el archivo de tests entero
  const archivo = () => fs.readFileSync(RUTA, 'utf8');
  const lineas = () => archivo().split(/\r?\n/);
  const esComentario = (linea) => linea.trim().startsWith('--');
  // Sin los comentarios: lo que de verdad se ejecuta
  const sentencias = () => lineas().filter(l => l.trim() && !esComentario(l));
  // La cabecera: los comentarios de antes de la primera sentencia (los renglones de las fuentes van más abajo)
  const cabecera = () => {
    const todas = lineas();
    const primera = todas.findIndex(l => l.trim() && !esComentario(l));
    return todas.slice(0, primera < 0 ? todas.length : primera).filter(l => l.startsWith('--')).join('\n');
  };
  const esInsert = (linea) => /^\s*INSERT\b/i.test(linea);
  const FORMA = /^INSERT INTO feriados \(fecha, nombre, tipo, trasladado_de, se_repite, creado_por\) SELECT '(\d{4}-\d{2}-\d{2})', '([^']+)', '(\w+)', (?:NULL|'(\d{4}-\d{2}-\d{2})'), ([01]), NULL FROM DUAL WHERE NOT EXISTS \(SELECT 1 FROM feriados WHERE fecha = '(\d{4}-\d{2}-\d{2})' AND nombre = '([^']+)'\);$/;
  // Uno por INSERT, en el orden del archivo: { fecha, nombre, tipo, trasladado_de, se_repite } y la fecha y el nombre del WHERE
  const inserts = () => sentencias().filter(esInsert).map((linea) => {
    const m = FORMA.exec(linea);
    assert.ok(m, `INSERT con una forma distinta de la acordada: ${linea}`);
    return {
      fecha: m[1], nombre: m[2], tipo: m[3], trasladado_de: m[4] ?? null, se_repite: Number(m[5]),
      dondeFecha: m[6], dondeNombre: m[7]
    };
  });
  // La consulta de verificación va comentada, en un solo renglón: -- SELECT … ;
  const verificacion = () => lineas().map(l => /^-- (SELECT .+;)$/.exec(l)?.[1]).filter(Boolean);

  // La lista para la precarga del archivo de fuentes, copiada a mano: [fecha, nombre, tipo, trasladado_de, se_repite]. Las que se
  // repiten (el 23/2, el 28/7 y el 8/11) van una sola vez, con la fecha de 2026
  const LISTA = [
    ['2026-01-02', 'Asueto administrativo municipal', 'no_laborable', null, 0],
    ['2026-02-16', 'Carnaval', 'nacional', null, 0],
    ['2026-02-17', 'Carnaval', 'nacional', null, 0],
    ['2026-02-23', 'Aniversario de Comodoro Rivadavia', 'municipal', null, 1],
    ['2026-03-23', 'Día no laborable con fines turísticos', 'no_laborable', null, 0],
    ['2026-04-02', 'Jueves Santo', 'no_laborable', null, 0],
    ['2026-04-03', 'Viernes Santo', 'nacional', null, 0],
    ['2026-04-30', 'Plebiscito de 1902', 'provincial', null, 0],
    ['2026-06-15', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2026-06-17', 0],
    ['2026-07-10', 'Día no laborable con fines turísticos', 'no_laborable', null, 0],
    ['2026-07-28', 'Desembarco de los colonos galeses (Gesta galesa)', 'provincial', null, 1],
    ['2026-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', null, 0],
    ['2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional', null, 0],
    ['2026-11-02', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2026-11-03', 0],
    ['2026-11-08', 'Día del Empleado Municipal', 'municipal', null, 1],
    ['2026-11-09', 'Visita de Su Santidad el Papa León XIV', 'nacional', null, 0],
    ['2026-11-23', 'Día de la Soberanía Nacional', 'nacional', '2026-11-20', 0],
    ['2026-12-07', 'Día no laborable con fines turísticos', 'no_laborable', null, 0],
    ['2026-12-13', 'Día del Petróleo Nacional', 'provincial', null, 0],
    ['2027-02-08', 'Carnaval', 'nacional', null, 0],
    ['2027-02-09', 'Carnaval', 'nacional', null, 0],
    ['2027-03-25', 'Jueves Santo', 'no_laborable', null, 0],
    ['2027-03-26', 'Viernes Santo', 'nacional', null, 0],
    ['2027-06-21', 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes', 'nacional', '2027-06-17', 0],
    ['2027-08-16', 'Paso a la Inmortalidad del General José de San Martín', 'nacional', '2027-08-17', 0],
    ['2027-10-11', 'Día del Respeto a la Diversidad Cultural', 'nacional', '2027-10-12', 0],
    ['2027-11-01', 'Jura de fidelidad a la Bandera Argentina de los pueblos tehuelches y mapuches', 'provincial', '2027-11-03', 0],
    ['2027-12-13', 'Día del Petróleo Nacional', 'provincial', null, 0]
  ];
  const porFecha = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const comoLista = (filas) => filas.map(f => [f.fecha, f.nombre, f.tipo, f.trasladado_de, f.se_repite]).sort(porFecha);

  // Una base con la estructura de schema.sql y un administrador, el que carga desde la pestaña; devuelve su id
  const crearBase = async () => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_DATOS}\``);
    await root.query(`CREATE DATABASE \`${BASE_DATOS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_DATOS}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    const [{ insertId }] = await root.query(
      `INSERT INTO \`${BASE_DATOS}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_admin', 'x', 't_admin', 't_admin@rpad.test', 'admin')`);
    return insertId;
  };
  const correr = async () => {
    await root.query(`USE \`${BASE_DATOS}\``);
    await root.query(archivo());
  };
  // Las filas de la base, con la forma de las reglas (la de services/feriadosDatos.js) más quién la cargó
  const filas = async () => {
    const [lista] = await root.query(
      `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nombre, tipo, DATE_FORMAT(trasladado_de, '%Y-%m-%d') AS trasladado_de,
              se_repite, hasta_anio, activo, creado_por
         FROM \`${BASE_DATOS}\`.feriados ORDER BY fecha, id`);
    return lista.map(f => ({
      id: Number(f.id), fecha: f.fecha, nombre: f.nombre, tipo: f.tipo, trasladado_de: f.trasladado_de ?? null,
      se_repite: Number(f.se_repite), hasta_anio: f.hasta_anio === null ? null : Number(f.hasta_anio), activo: Number(f.activo),
      creado_por: f.creado_por === null ? null : Number(f.creado_por), no_rige: []
    }));
  };
  const cargarDesdeLaPestana = async (usuario, fecha, nombre, tipo) => {
    await root.query(`INSERT INTO \`${BASE_DATOS}\`.feriados (fecha, nombre, tipo, creado_por) VALUES (?, ?, ?, ?)`,
      [fecha, nombre, tipo, usuario]);
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_DATOS}\``);
  });

  it('existe y se pega tal cual en phpMyAdmin: empieza con SET NAMES utf8mb4 y solo escribe INSERT con la forma acordada (sin DELIMITER, USE, DROP, RENAME, CHECK, DELETE ni UPDATE)', () => {
    assert.ok(fs.existsSync(RUTA), 'falta database/updates/migracion-feriados-datos.sql');
    const [primera, ...resto] = sentencias();
    assert.equal(primera, 'SET NAMES utf8mb4;');
    assert.ok(resto.length > 0, 'no hay ningún INSERT');
    for (const linea of resto) assert.match(linea, FORMA, `sentencia inesperada: ${linea}`);
    assert.doesNotMatch(sentencias().join('\n'), /\b(DELIMITER|USE|DROP|RENAME|CHECK|DELETE|UPDATE)\b/i);
  });

  it('la cabecera dice la spec y el archivo de las fuentes, el orden, cómo se corre, que se puede repetir, que las que se repiten van una vez con la fecha de 2026, que lo no decretado se carga desde la pestaña y cómo se verifica', () => {
    const texto = cabecera();
    assert.match(texto, /docs\/superpowers\/specs\/2026-10-26-feriados-design\.md/);
    assert.match(texto, /docs\/superpowers\/specs\/2026-10-26-feriados-fuentes\.md/);
    assert.match(texto, /ORDEN: correr DESPUÉS de migracion-feriados\.sql/);
    assert.match(texto, /phpMyAdmin > base del RPAD > pestaña SQL/);
    assert.match(texto, /Se puede volver a correr/);
    assert.match(texto, /9 feriados nacionales fijos/);
    assert.match(texto, /una sola vez, con la fecha de 2026/);
    // Lo que todavía no está decretado no se inventa: se carga desde la pestaña cuando salga
    assert.match(texto, /desde Configuración → Feriados/);
    assert.match(texto, /fines turísticos de 2027/);
    assert.match(texto, /30\/04\/2027/);
    assert.match(texto, /13\/12\/2026/);
    assert.match(texto, /VERIFICACIÓN/);
    assert.match(texto, /Para deshacer: rollback-feriados\.sql/);
  });

  it('cada INSERT lleva arriba, en su propio renglón, «-- Fuente:» con la norma y un link, y cada fuente es la de un INSERT', () => {
    const todas = lineas();
    const posiciones = todas.map((l, i) => (esInsert(l) ? i : -1)).filter(i => i >= 0);
    assert.ok(posiciones.length > 0, 'no hay ningún INSERT');
    for (const i of posiciones) {
      assert.match(todas[i - 1] ?? '', /^-- Fuente: \S.*\(https:\/\/\S+\)/, `el INSERT del renglón ${i + 1} no tiene arriba su fuente`);
    }
    const fuentes = todas.map((l, i) => (/^\s*-- Fuente:/.test(l) ? i : -1)).filter(i => i >= 0);
    assert.deepEqual(fuentes.map(i => i + 1), posiciones, 'hay una fuente que no va justo arriba de un INSERT');
  });

  it('son las 28 filas de la lista de las fuentes (19 de 2026 y 9 de 2027), cada una con la misma fecha y el mismo nombre en el SELECT y en el NOT EXISTS, y todas pasan la validación de la pestaña', () => {
    const lista = inserts();
    assert.equal(lista.length, 28);
    for (const ins of lista) {
      assert.equal(ins.dondeFecha, ins.fecha, `el NOT EXISTS de ${ins.fecha} mira otra fecha: ${ins.dondeFecha}`);
      assert.equal(ins.dondeNombre, ins.nombre, `el NOT EXISTS de ${ins.fecha} mira otro nombre: ${ins.dondeNombre}`);
      // Lo que la API exigiría si se cargara desde la pestaña (un hoy de 2026: las fechas van hasta el 31/12/2027)
      const { datos, error } = validarFeriado(ins, '2026-10-26');
      assert.equal(error, null, `${ins.fecha} ${ins.nombre}: ${error?.mensaje}`);
      assert.deepEqual(datos, { fecha: ins.fecha, nombre: ins.nombre, tipo: ins.tipo, trasladado_de: ins.trasladado_de, se_repite: ins.se_repite });
    }
    assert.deepEqual(comoLista(lista), [...LISTA].sort(porFecha));
  });

  it('corrida dos veces sobre una base nueva deja exactamente las 28 filas, activas, sin quién las cargó y sin años que no rigen: la segunda no agrega ninguna', async () => {
    await crearBase();
    await correr();
    const primera = await filas();
    assert.equal(primera.length, 28);
    await correr();
    const segunda = await filas();
    assert.equal(segunda.length, primera.length);
    assert.deepEqual(segunda, primera);
    assert.deepEqual(comoLista(segunda), [...LISTA].sort(porFecha));
    for (const fila of segunda) {
      assert.equal(fila.activo, 1, `${fila.fecha} no quedó activa`);
      assert.equal(fila.creado_por, null, `${fila.fecha} quedó con quién la cargó`);
      assert.equal(fila.hasta_anio, null, `${fila.fecha} quedó con un hasta_anio`);
    }
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_DATOS}\`.feriados_no_rige`);
    assert.equal(total, 0);
  });

  it('las fechas son todas de 2026 o 2027 (19 y 9); se repiten exactamente tres, el 23/2, el 28/7 y el 8/11, con la fecha de 2026; están los cuatro tipos, y el Jueves Santo de los dos años es no laborable', async () => {
    await crearBase();
    await correr();
    const lista = await filas();
    assert.ok(lista.every(f => /^202[67]-/.test(f.fecha)), 'hay una fecha que no es de 2026 ni de 2027');
    assert.equal(lista.filter(f => f.fecha.startsWith('2026-')).length, 19);
    assert.equal(lista.filter(f => f.fecha.startsWith('2027-')).length, 9);
    assert.deepEqual(lista.filter(f => f.se_repite === 1).map(f => f.fecha), ['2026-02-23', '2026-07-28', '2026-11-08']);
    assert.deepEqual([...new Set(lista.map(f => f.tipo))].sort(), [...TIPOS_FERIADO].sort());
    const juevesSanto = lista.filter(f => f.nombre === 'Jueves Santo');
    assert.deepEqual(juevesSanto.map(f => [f.fecha, f.tipo]), [['2026-04-02', 'no_laborable'], ['2027-03-25', 'no_laborable']]);
  });

  it('en la lista de 2027 de la pestaña, las 9 filas de 2027 más las tres que se repiten, proyectadas: el 23/2, el 28/7 y el 8/11', async () => {
    await crearBase();
    await correr();
    const lista = await filas();
    const deLaTabla = (anio) => feriadosDelAnio(lista, anio).filter(f => !f.fijo);
    assert.equal(deLaTabla(2026).length, 19);
    const de2027 = deLaTabla(2027);
    assert.equal(de2027.length, 12);
    assert.deepEqual(de2027.filter(f => f.se_repite === 1).map(f => [f.fecha, f.nombre]), [
      ['2027-02-23', 'Aniversario de Comodoro Rivadavia'],
      ['2027-07-28', 'Desembarco de los colonos galeses (Gesta galesa)'],
      ['2027-11-08', 'Día del Empleado Municipal']
    ]);
    assert.ok(de2027.every(f => f.rige), 'hay uno que en 2027 no rige');
  });

  it('no duplica lo que ya se cargó desde la pestaña con la misma fecha y el mismo nombre, sí carga el de otro nombre el mismo día, y una fila que se dio de baja no vuelve', async () => {
    const usuario = await crearBase();
    // Desde la pestaña, antes de correrla: uno igual a una fila de la precarga y otro distinto el mismo día que otra
    await cargarDesdeLaPestana(usuario, '2026-03-23', 'Día no laborable con fines turísticos', 'no_laborable');
    await cargarDesdeLaPestana(usuario, '2026-12-13', 'Otro feriado de prueba', 'municipal');
    await correr();
    let lista = await filas();
    assert.equal(lista.length, 28 + 1);
    const del23 = lista.filter(f => f.fecha === '2026-03-23');
    assert.equal(del23.length, 1);
    assert.equal(del23[0].creado_por, usuario, 'la del 23/3 no es la que se cargó desde la pestaña');
    assert.deepEqual(lista.filter(f => f.fecha === '2026-12-13').map(f => f.nombre).sort(), ['Día del Petróleo Nacional', 'Otro feriado de prueba']);
    // Una de la precarga se da de baja desde la pestaña: volver a correrla no la resucita ni carga otra
    const carnaval = lista.find(f => f.fecha === '2026-02-16');
    await root.query(`UPDATE \`${BASE_DATOS}\`.feriados SET activo = 0 WHERE id = ?`, [carnaval.id]);
    await correr();
    lista = await filas();
    assert.equal(lista.length, 28 + 1);
    assert.deepEqual(lista.filter(f => f.fecha === '2026-02-16').map(f => [f.id, f.activo]), [[carnaval.id, 0]]);
  });

  it('la consulta de verificación, comentada en un solo renglón al final: 28 filas, 19 de 2026, 9 de 2027 y 3 que se repiten, sin contar lo cargado desde la pestaña', async () => {
    const todas = lineas();
    const consultas = verificacion();
    assert.equal(consultas.length, 1);
    const ultimoInsert = todas.map((l, i) => (esInsert(l) ? i : -1)).filter(i => i >= 0).at(-1);
    assert.ok(todas.findIndex(l => l === `-- ${consultas[0]}`) > ultimoInsert, 'la verificación no está al final');
    const usuario = await crearBase();
    await cargarDesdeLaPestana(usuario, '2026-12-24', 'Asueto de prueba', 'no_laborable');
    await correr();
    await root.query(`USE \`${BASE_DATOS}\``);
    const [[fila]] = await root.query(consultas[0]);
    assert.deepEqual(Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, Number(valor)])),
      { filas: 28, de_2026: 19, de_2027: 9, se_repiten: 3 });
  });
});

// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 5): los años, el arranque, el saldo inicial, las licencias, las
// horas extras y los avisos de vencimiento enviados. La migración y su vuelta atrás, sobre una base descartable creada con
// schema.sql
describe('migracion-mi-espacio.sql', () => {
  const BASE_MI_ESPACIO = 'rpad_schema_mi_espacio_test';
  const MIGRACION = 'migracion-mi-espacio.sql';
  const ROLLBACK = 'rollback-mi-espacio.sql';
  // Se leen en cada test: si un archivo falta, falla cada uno y no el archivo de tests entero
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  const esDeLasTablas = (c) => TABLAS_MI_ESPACIO.some(tabla => c.startsWith(`${tabla}.`));
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega (la de main)
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO}\``);
    await root.query(`CREATE DATABASE \`${BASE_MI_ESPACIO}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_MI_ESPACIO}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query([...TABLAS_MI_ESPACIO].reverse().map(tabla => `DROP TABLE ${tabla};`).join('\n'));
    }
  };
  // Una persona con una licencia de Configuración y una fila en cada tabla, con la licencia de Mi espacio apuntando a la de
  // Configuración: lo que la vuelta atrás tiene que poder borrar con las FK puestas
  const cargarDatos = async () => {
    const [{ insertId: usuario }] = await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_admin', 'x', 'Persona de Prueba', 't_admin@rpad.test', 'admin')`);
    const [{ insertId: oficial }] = await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO}\`.usuarios_licencias (usuario_id, desde, hasta, creado_por) VALUES (?, '2026-11-03', '2026-11-05', ?)`, [usuario, usuario]);
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_anios (usuario_id, anio, dias_vacaciones, estudios) VALUES (?, 2026, 20, 'universitario')`, [usuario]);
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_arranque (usuario_id, fecha) VALUES (?, '2026-10-26')`, [usuario]);
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_saldos (usuario_id, concepto, anio, cantidad) VALUES (?, 'franquicias', 2026, 10.5)`, [usuario]);
    await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_licencias (usuario_id, tipo, desde, hasta, licencia_oficial_id, oficial) VALUES (?, 'vacaciones', '2026-11-03', '2026-11-05', ?, 'creada')`,
      [usuario, oficial]);
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_horas_extras (usuario_id, fecha, desde, hasta) VALUES (?, '2026-10-20', '19:00', '22:00')`, [usuario]);
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO}\`.mi_espacio_avisos (usuario_id, clave, enviado_at) VALUES (?, 'horas-2026-10', '2026-10-26 08:15:00')`, [usuario]);
    return { usuario, oficial };
  };
  const contarEn = async (tabla) => {
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_MI_ESPACIO}\`.\`${tabla}\``);
    return total;
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega (nada de DROP, RENAME ni CHECK)', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
  });

  it('las cabeceras dicen la spec, el orden, que se puede repetir y cómo se deshace; el rollback, que se pierde lo cargado y que lo de Configuración queda', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-26-mi-espacio-licencias-y-horas-design\.md/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /después de migracion-feriados\.sql/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-mi-espacio\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-mi-espacio\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /se pierden/i);
    assert.match(cabecera(ROLLBACK), /Las licencias que pasaron a Configuración → Licencias quedan allí/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('el rollback solo borra las seis tablas, en orden inverso: no toca usuarios_licencias ni ninguna otra', () => {
    const borrados = [...codigo(ROLLBACK).matchAll(/DROP TABLE IF EXISTS `(\w+)`/gi)].map(m => m[1]);
    assert.deepEqual(borrados, [...TABLAS_MI_ESPACIO].reverse());
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELETE|UPDATE|ALTER|TRUNCATE|INSERT)\b/i);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
    await crearBase({ conLoNuevo: false });
    const anterior = await columnas(root, BASE_MI_ESPACIO);
    assert.ok(!anterior.some(esDeLasTablas), 'la base de partida ya tiene las tablas');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO), await columnas(root, BASE_TEMPORAL));
    // Y también las claves foráneas, los índices, el motor y la colación, que las columnas no muestran
    assert.deepEqual(await clavesAjenasDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
    assert.deepEqual(await indicesDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
    assert.deepEqual(await motoresDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
  });

  it('el rollback se puede repetir, deja la estructura de main sin borrar a la persona ni la licencia de Configuración a la que apuntaba, y la migración la recupera', async () => {
    await crearBase({ conLoNuevo: true });
    const { usuario, oficial } = await cargarDatos();
    for (const tabla of TABLAS_MI_ESPACIO) assert.equal(await contarEn(tabla), 1, tabla);
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    // La estructura de main: la de schema.sql sin las seis tablas
    const deMain = (await columnas(root, BASE_TEMPORAL)).filter(c => !esDeLasTablas(c));
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO), deMain);
    // La persona y la licencia que había pasado a Configuración siguen ahí, tal cual
    assert.equal(await contarEn('usuarios'), 1);
    const [licencias] = await root.query(
      `SELECT id, usuario_id, DATE_FORMAT(desde, '%Y-%m-%d') AS desde, DATE_FORMAT(hasta, '%Y-%m-%d') AS hasta, anulada
       FROM \`${BASE_MI_ESPACIO}\`.usuarios_licencias`);
    assert.deepEqual(licencias.map(l => ({ ...l })), [{ id: oficial, usuario_id: usuario, desde: '2026-11-03', hasta: '2026-11-05', anulada: 0 }]);
    // La migración vuelve a dejar exactamente la estructura de schema.sql
    await root.query(sql(MIGRACION));
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await clavesAjenasDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
    assert.deepEqual(await indicesDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
    assert.deepEqual(await motoresDe(root, BASE_MI_ESPACIO, TABLAS_MI_ESPACIO), await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO));
  });
});

// La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 3): los eventos, con quién se comparte cada uno, los emails
// enviados y la última corrida de los recordatorios. La migración y su vuelta atrás, sobre una base descartable creada con
// schema.sql
describe('migracion-mi-espacio-agenda.sql', () => {
  const BASE_MI_ESPACIO_AGENDA = 'rpad_schema_mi_espacio_agenda_test';
  const MIGRACION = 'migracion-mi-espacio-agenda.sql';
  const ROLLBACK = 'rollback-mi-espacio-agenda.sql';
  // Se leen en cada test: si un archivo falta, falla cada uno y no el archivo de tests entero
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  const esDeLasTablas = (c) => TABLAS_MI_ESPACIO_AGENDA.some(tabla => c.startsWith(`${tabla}.`));
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega (la de main)
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO_AGENDA}\``);
    await root.query(`CREATE DATABASE \`${BASE_MI_ESPACIO_AGENDA}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_MI_ESPACIO_AGENDA}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query([...TABLAS_MI_ESPACIO_AGENDA].reverse().map(tabla => `DROP TABLE ${tabla};`).join('\n'));
    }
  };
  // Quien crea el evento, una persona invitada y el evento compartido con ella
  const cargarEvento = async () => {
    const [{ insertId: creadora }] = await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_admin', 'x', 'Persona de Prueba', 't_admin@rpad.test', 'admin')`);
    const [{ insertId: invitada }] = await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.usuarios (username, password_hash, nombre_completo, email, rol) VALUES ('t_editor', 'x', 'Test Editor', 't_editor@rpad.test', 'editor')`);
    const [{ insertId: evento }] = await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_eventos (creado_por, titulo, detalle, fecha, desde, hasta, compartido) VALUES (?, 'Reunión de equipo', 'En la sala grande', '2026-10-27', '10:00', '11:00', 1)`,
      [creadora]);
    return { creadora, invitada, evento };
  };
  // Una fila en cada tabla: lo que la vuelta atrás tiene que poder borrar con las FK puestas
  const cargarDatos = async () => {
    const { evento, invitada } = await cargarEvento();
    await root.query(`INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_evento_personas (evento_id, usuario_id, sin_recordatorio) VALUES (?, ?, 1)`, [evento, invitada]);
    await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_evento_envios (evento_id, usuario_id, tipo, para, enviado_at, success) VALUES (?, ?, 'invitacion', '2026-10-27 10:00:00', '2026-10-26 09:12:00', 1)`,
      [evento, invitada]);
    await root.query(
      `INSERT INTO \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_eventos_corridas (id, inicio_at, fin_at, resultado, con_errores) VALUES (1, '2026-10-27 08:30:00', '2026-10-27 08:30:04', 'Recordatorios enviados: 1. Fallidos: 0.', 0)`);
  };
  const contarEn = async (tabla) => {
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${BASE_MI_ESPACIO_AGENDA}\`.\`${tabla}\``);
    return total;
  };
  // La misma estructura que schema.sql: las columnas y también las claves foráneas, los índices, el motor, la colación y la
  // columna generada, que las columnas no muestran
  const comoSchema = async () => {
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO_AGENDA), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await clavesAjenasDe(root, BASE_MI_ESPACIO_AGENDA, TABLAS_MI_ESPACIO_AGENDA), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA));
    assert.deepEqual(await indicesDe(root, BASE_MI_ESPACIO_AGENDA, TABLAS_MI_ESPACIO_AGENDA), await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA));
    assert.deepEqual(await motoresDe(root, BASE_MI_ESPACIO_AGENDA, TABLAS_MI_ESPACIO_AGENDA), await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA));
    assert.deepEqual(await generadasDe(root, BASE_MI_ESPACIO_AGENDA, TABLAS_MI_ESPACIO_AGENDA), await generadasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_AGENDA));
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO_AGENDA}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega (nada de DROP, RENAME ni CHECK)', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
    // Los acentos de los comentarios y de los datos llegan bien desde phpMyAdmin
    assert.match(codigo(MIGRACION), /^SET NAMES utf8mb4;/);
    assert.match(codigo(ROLLBACK), /^SET NAMES utf8mb4;/);
  });

  it('las cabeceras dicen la spec, el orden, que se puede repetir y cómo se deshace; el rollback, que se pierden los eventos', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-26-mi-espacio-agenda-design\.md/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /después de migracion-mi-espacio\.sql/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-mi-espacio-agenda\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-mi-espacio-agenda\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /se pierden/i);
    // Lo que se pierde, dicho con su nombre (no alcanza con el del archivo)
    assert.match(cabecera(ROLLBACK), /los eventos de la agenda/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('el rollback solo borra las cuatro tablas, en orden inverso (corridas, envíos, personas y eventos): no toca usuarios ni ninguna otra', () => {
    const borrados = [...codigo(ROLLBACK).matchAll(/DROP TABLE IF EXISTS `(\w+)`/gi)].map(m => m[1]);
    assert.deepEqual(borrados, [...TABLAS_MI_ESPACIO_AGENDA].reverse());
    assert.deepEqual(borrados, ['mi_espacio_eventos_corridas', 'mi_espacio_evento_envios', 'mi_espacio_evento_personas', 'mi_espacio_eventos']);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELETE|UPDATE|ALTER|TRUNCATE|INSERT)\b/i);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
    await crearBase({ conLoNuevo: false });
    const anterior = await columnas(root, BASE_MI_ESPACIO_AGENDA);
    assert.ok(!anterior.some(esDeLasTablas), 'la base de partida ya tiene las tablas');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    await comoSchema();
  });

  it('el rollback se puede repetir, deja la estructura de main sin borrar a las personas, y la migración la recupera', async () => {
    await crearBase({ conLoNuevo: true });
    await cargarDatos();
    for (const tabla of TABLAS_MI_ESPACIO_AGENDA) assert.equal(await contarEn(tabla), 1, tabla);
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    // La estructura de main: la de schema.sql sin las cuatro tablas
    const deMain = (await columnas(root, BASE_TEMPORAL)).filter(c => !esDeLasTablas(c));
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO_AGENDA), deMain);
    // Quien creó el evento y la persona invitada siguen ahí
    assert.equal(await contarEn('usuarios'), 2);
    // La migración vuelve a dejar exactamente la estructura de schema.sql
    await root.query(sql(MIGRACION));
    await comoSchema();
  });

  // Un recordatorio no se repite (spec, sección 3): la corrida lo reserva con un INSERT IGNORE sobre la clave única, que vale
  // solo para los recordatorios. Con la estructura de schema.sql y con la de la migración
  for (const origen of ['schema.sql', 'la migración']) {
    it(`la clave única vale solo para los recordatorios (${origen})`, async () => {
      await crearBase({ conLoNuevo: origen === 'schema.sql' });
      if (origen === 'la migración') await root.query(sql(MIGRACION));
      const { creadora, invitada, evento } = await cargarEvento();
      const reservar = async (tipo, para, usuario = invitada) => {
        const [resultado] = await root.query(
          `INSERT IGNORE INTO \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_evento_envios (evento_id, usuario_id, tipo, para) VALUES (?, ?, ?, ?)`,
          [evento, usuario, tipo, para]);
        return resultado.affectedRows;
      };
      assert.equal(await reservar('recordatorio', '2026-10-27 10:00:00'), 1);
      // La corrida siguiente no lo vuelve a reservar
      assert.equal(await reservar('recordatorio', '2026-10-27 10:00:00'), 0);
      // A otra persona del mismo evento le toca el suyo
      assert.equal(await reservar('recordatorio', '2026-10-27 10:00:00', creadora), 1);
      // Si el evento cambia de hora, cambia el momento y el recordatorio vuelve a salir
      assert.equal(await reservar('recordatorio', '2026-10-27 11:00:00'), 1);
      // Las invitaciones, los cambios y las cancelaciones no tienen clave única: dos iguales entran
      for (const tipo of ['invitacion', 'invitacion', 'cambio', 'cambio', 'cancelacion', 'cancelacion']) {
        assert.equal(await reservar(tipo, '2026-10-27 10:00:00'), 1, tipo);
      }
      const [filas] = await root.query(
        `SELECT tipo, recordatorio_unico, success, enviado_at FROM \`${BASE_MI_ESPACIO_AGENDA}\`.mi_espacio_evento_envios ORDER BY id`);
      // Reservados: sin enviar todavía (enviado_at NULL) y sin éxito; recordatorio_unico, 1 solo en los recordatorios
      assert.deepEqual(filas.map(f => `${f.tipo} ${f.recordatorio_unico} ${f.success} ${f.enviado_at}`), [
        'recordatorio 1 0 null',
        'recordatorio 1 0 null',
        'recordatorio 1 0 null',
        'invitacion null 0 null',
        'invitacion null 0 null',
        'cambio null 0 null',
        'cambio null 0 null',
        'cancelacion null 0 null',
        'cancelacion null 0 null'
      ]);
    });
  }
});

// La planilla de horas extras de contrato de Mi espacio (spec 2026-10-27-mi-espacio-horas, 6 y 11): una fila por persona y
// día, con la salida y la entrada. La migración y su vuelta atrás, sobre una base descartable creada con schema.sql
describe('migracion-mi-espacio-horas.sql', () => {
  const BASE_MI_ESPACIO_HORAS = 'rpad_schema_mi_espacio_horas_test';
  const MIGRACION = 'migracion-mi-espacio-horas.sql';
  const ROLLBACK = 'rollback-mi-espacio-horas.sql';
  // Se leen en cada test: si un archivo falta, falla cada uno y no el archivo de tests entero
  const sql = (archivo) => fs.readFileSync(new URL(`../database/updates/${archivo}`, import.meta.url), 'utf8');
  // Sin los comentarios: lo que de verdad se ejecuta
  const codigo = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
  const cabecera = (archivo) => sql(archivo).split(/\r?\n/).filter(l => l.startsWith('--')).join('\n');
  const esDeLasTablas = (c) => TABLAS_MI_ESPACIO_HORAS.some(tabla => c.startsWith(`${tabla}.`));
  const enLaBase = (tabla) => `\`${BASE_MI_ESPACIO_HORAS}\`.\`${tabla}\``;
  // La estructura de schema.sql y, si no se quiere lo nuevo, la de antes de esta entrega (la de main)
  const crearBase = async ({ conLoNuevo }) => {
    await root.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO_HORAS}\``);
    await root.query(`CREATE DATABASE \`${BASE_MI_ESPACIO_HORAS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${BASE_MI_ESPACIO_HORAS}\``);
    await root.query(fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    if (!conLoNuevo) {
      await root.query([...TABLAS_MI_ESPACIO_HORAS].reverse().map(tabla => `DROP TABLE ${tabla};`).join('\n'));
    }
  };
  // Una persona de contrato (inventada) con unas horas extras de planta de antes y una salida de la planilla, sin entrada
  const cargarDatos = async () => {
    const [{ insertId: usuario }] = await root.query(
      `INSERT INTO ${enLaBase('usuarios')} (username, password_hash, nombre_completo, email, rol, vinculo) VALUES ('t_editor', 'x', 'Carla Benítez', 't_editor@rpad.test', 'editor', 'contrato')`);
    await root.query(`INSERT INTO ${enLaBase('mi_espacio_horas_extras')} (usuario_id, fecha, desde, hasta) VALUES (?, '2026-09-14', '19:00', '22:00')`, [usuario]);
    await root.query(`INSERT INTO ${enLaBase('mi_espacio_salidas')} (usuario_id, fecha, salida, nota) VALUES (?, '2026-10-05', '16:20', 'Cierre del mes')`, [usuario]);
    return { usuario };
  };
  const contarEn = async (tabla) => {
    const [[{ total }]] = await root.query(`SELECT COUNT(*) AS total FROM ${enLaBase(tabla)}`);
    return total;
  };
  // La misma estructura que schema.sql: las columnas y también las claves foráneas, los índices, el motor y la colación, que
  // las columnas no muestran
  const comoSchema = async () => {
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO_HORAS), await columnas(root, BASE_TEMPORAL));
    assert.deepEqual(await clavesAjenasDe(root, BASE_MI_ESPACIO_HORAS, TABLAS_MI_ESPACIO_HORAS), await clavesAjenasDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS));
    assert.deepEqual(await indicesDe(root, BASE_MI_ESPACIO_HORAS, TABLAS_MI_ESPACIO_HORAS), await indicesDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS));
    assert.deepEqual(await motoresDe(root, BASE_MI_ESPACIO_HORAS, TABLAS_MI_ESPACIO_HORAS), await motoresDe(root, BASE_TEMPORAL, TABLAS_MI_ESPACIO_HORAS));
  };

  after(async () => {
    await root?.query(`DROP DATABASE IF EXISTS \`${BASE_MI_ESPACIO_HORAS}\``);
  });

  it('se pega tal cual en phpMyAdmin: sin DELIMITER ni USE, y la migración solo agrega (nada de DROP, RENAME ni CHECK)', () => {
    assert.doesNotMatch(codigo(MIGRACION), /\b(DELIMITER|USE|DROP|RENAME|CHECK)\b/i);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELIMITER|USE)\b/i);
    // Los acentos de los comentarios llegan bien desde phpMyAdmin
    assert.match(codigo(MIGRACION), /^SET NAMES utf8mb4;/);
    assert.match(codigo(ROLLBACK), /^SET NAMES utf8mb4;/);
    // Lo único que se ejecuta, además de SET NAMES: la tabla, si todavía no está
    const sentencias = codigo(MIGRACION).split(';').map(s => s.trim()).filter(Boolean);
    assert.equal(sentencias.length, 2, sentencias.join('\n---\n'));
    assert.match(sentencias[1], /^CREATE TABLE IF NOT EXISTS `mi_espacio_salidas`/);
  });

  it('las cabeceras dicen la spec, la consulta previa, el orden, que se puede repetir y cómo se deshace; el rollback, que se pierde lo cargado en la planilla', () => {
    assert.match(cabecera(MIGRACION), /docs\/superpowers\/specs\/2026-10-27-mi-espacio-horas-design\.md/);
    assert.match(cabecera(MIGRACION), /Solo agrega/);
    // La consulta de antes (spec, sección 11): ninguna persona de contrato con horas extras de planta activas
    assert.match(cabecera(MIGRACION),
      /SELECT COUNT\(\*\) FROM mi_espacio_horas_extras h JOIN usuarios u ON u\.id = h\.usuario_id WHERE h\.activo = 1 AND u\.vinculo = 'contrato';/);
    assert.match(cabecera(MIGRACION), /tiene que dar 0/);
    assert.match(cabecera(MIGRACION), /ORDEN: correr ANTES de subir el código/);
    assert.match(cabecera(MIGRACION), /después de migracion-mi-espacio-agenda\.sql/);
    assert.match(cabecera(MIGRACION), /Se puede volver a correr/);
    assert.match(cabecera(MIGRACION), /Para deshacer: rollback-mi-espacio-horas\.sql/);
    assert.match(cabecera(ROLLBACK), /migracion-mi-espacio-horas\.sql/);
    assert.match(cabecera(ROLLBACK), /primero volver a subir los archivos anteriores/);
    assert.match(cabecera(ROLLBACK), /se pierde/i);
    // Lo que se pierde, dicho con su nombre (no alcanza con el del archivo), y lo que queda
    assert.match(cabecera(ROLLBACK), /lo cargado en la planilla/);
    assert.match(cabecera(ROLLBACK), /mi_espacio_horas_extras/);
    assert.match(cabecera(ROLLBACK), /Se puede volver a correr/);
  });

  it('el rollback solo borra mi_espacio_salidas: no toca las horas extras de planta, usuarios ni ninguna otra', () => {
    const borrados = [...codigo(ROLLBACK).matchAll(/DROP TABLE IF EXISTS `(\w+)`/gi)].map(m => m[1]);
    assert.deepEqual(borrados, ['mi_espacio_salidas']);
    assert.doesNotMatch(codigo(ROLLBACK), /\b(DELETE|UPDATE|ALTER|TRUNCATE|INSERT)\b/i);
  });

  it('desde la estructura de main deja la de schema.sql y se puede repetir', async () => {
    await crearBase({ conLoNuevo: false });
    const anterior = await columnas(root, BASE_MI_ESPACIO_HORAS);
    assert.ok(!anterior.some(esDeLasTablas), 'la base de partida ya tiene la tabla');
    await root.query(sql(MIGRACION));
    await root.query(sql(MIGRACION));
    await comoSchema();
  });

  it('el rollback se puede repetir, deja la estructura de main sin borrar a la persona ni sus horas extras de planta, y la migración la recupera', async () => {
    await crearBase({ conLoNuevo: true });
    await cargarDatos();
    assert.equal(await contarEn('mi_espacio_salidas'), 1);
    await root.query(sql(ROLLBACK));
    await root.query(sql(ROLLBACK));
    // La estructura de main: la de schema.sql sin la tabla
    const deMain = (await columnas(root, BASE_TEMPORAL)).filter(c => !esDeLasTablas(c));
    assert.deepEqual(await columnas(root, BASE_MI_ESPACIO_HORAS), deMain);
    assert.equal(await contarEn('usuarios'), 1);
    assert.equal(await contarEn('mi_espacio_horas_extras'), 1);
    // La migración vuelve a dejar exactamente la estructura de schema.sql
    await root.query(sql(MIGRACION));
    await comoSchema();
  });

  // Una fila por persona y día (spec, sección 6): el guardado de la planilla es un INSERT … ON DUPLICATE KEY UPDATE, que
  // vuelve a activar una fila dada de baja; borrar a la persona borra sus salidas. Con la estructura de schema.sql y con la
  // de la migración
  for (const origen of ['schema.sql', 'la migración']) {
    it(`una fila por persona y día, y borrar a la persona borra sus salidas (${origen})`, async () => {
      await crearBase({ conLoNuevo: origen === 'schema.sql' });
      if (origen === 'la migración') await root.query(sql(MIGRACION));
      const { usuario } = await cargarDatos();
      // El mismo día otra vez, con un INSERT a secas: la clave única lo frena
      await assert.rejects(
        root.query(`INSERT INTO ${enLaBase('mi_espacio_salidas')} (usuario_id, fecha, salida) VALUES (?, '2026-10-05', '17:00')`, [usuario]),
        { code: 'ER_DUP_ENTRY' });
      // Dado de baja y vuelto a guardar: la misma fila, activa otra vez y con lo nuevo
      await root.query(`UPDATE ${enLaBase('mi_espacio_salidas')} SET activo = 0 WHERE usuario_id = ?`, [usuario]);
      await root.query(
        `INSERT INTO ${enLaBase('mi_espacio_salidas')} (usuario_id, fecha, entrada, salida, nota) VALUES (?, '2026-10-05', '08:02', '17:00', NULL)
         ON DUPLICATE KEY UPDATE entrada = VALUES(entrada), salida = VALUES(salida), nota = VALUES(nota), activo = 1`, [usuario]);
      // Otro día de la misma persona entra
      await root.query(`INSERT INTO ${enLaBase('mi_espacio_salidas')} (usuario_id, fecha, salida) VALUES (?, '2026-10-06', '15:46')`, [usuario]);
      const [filas] = await root.query(
        `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(entrada, '%H:%i') AS entrada,
                TIME_FORMAT(salida, '%H:%i') AS salida, nota, activo
         FROM ${enLaBase('mi_espacio_salidas')} ORDER BY fecha`);
      assert.deepEqual(filas.map(f => ({ ...f })), [
        { fecha: '2026-10-05', entrada: '08:02', salida: '17:00', nota: null, activo: 1 },
        { fecha: '2026-10-06', entrada: null, salida: '15:46', nota: null, activo: 1 }
      ]);
      await root.query(`DELETE FROM ${enLaBase('usuarios')} WHERE id = ?`, [usuario]);
      assert.equal(await contarEn('mi_espacio_salidas'), 0);
    });
  }
});
