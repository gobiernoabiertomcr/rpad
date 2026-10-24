// database/schema.sql debe crear la misma estructura que la base real, sin datos personales
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { query, cerrarDb } from './helpers.js';

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

  for (const tabla of ['usuarios', 'areas', 'datasets', 'cambios_pendientes', 'notificaciones_log', 'historial_actualizaciones', 'proyectos', 'metricas_manuales', 'notas_digitales', 'notas_digitales_datasets', 'usuarios_tokens', 'usuarios_auditoria', 'usuarios_licencias', 'usuarios_firmas', 'notas_digitales_cambios', 'metricas_fotos', 'actualizaciones_recibido']) {
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
